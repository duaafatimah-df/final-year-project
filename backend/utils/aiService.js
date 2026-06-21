const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const AI_URL = process.env.PYTHON_AI_URL || 'http://127.0.0.1:8000/ai';
const translationCache = {};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Circuit Breaker state for Python AI service
let isPythonOffline = false;
let lastPythonCheck = 0;
const PYTHON_CHECK_INTERVAL = 30000; // 30 seconds check interval

const callPythonService = async (method, path, data = null, isGet = false) => {
  const now = Date.now();
  if (isPythonOffline) {
    if (now - lastPythonCheck > PYTHON_CHECK_INTERVAL) {
      console.log("🔄 Retrying Python AI service connection...");
      isPythonOffline = false;
    } else {
      throw new Error("Python AI service is marked offline (circuit breaker active)");
    }
  }

  try {
    const config = { timeout: 2000 };
    let res;
    if (isGet) {
      res = await axios.get(`${AI_URL}${path}`, { ...config, params: data });
    } else {
      res = await axios.post(`${AI_URL}${path}`, data, config);
    }
    return res.data;
  } catch (err) {
    // If it's a network error, connection timeout, or refused connection, trip the circuit breaker
    if (!err.response || err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      isPythonOffline = true;
      lastPythonCheck = now;
      console.warn(`🛑 Python AI service connection failed. Tripping circuit breaker. Error: ${err.message}`);
    }
    throw err;
  }
};

function cleanToStandardCategory(cat) {
  if (!cat) return 'Grocery';
  const lower = cat.toLowerCase();
  if (lower.includes('food') || lower.includes('meat') || lower.includes('veg') || lower.includes('fruit') || lower.includes('dairy') || lower.includes('cooked') || lower.includes('dish') || lower.includes('meal')) {
    return 'Food';
  }
  if (lower.includes('med') || lower.includes('health') || lower.includes('pharma') || lower.includes('drug') || lower.includes('syrup') || lower.includes('tablet')) {
    return 'Medicine';
  }
  if (lower.includes('cloth') || lower.includes('garment') || lower.includes('dress') || lower.includes('wear') || lower.includes('shirt') || lower.includes('pant') || lower.includes('shoe')) {
    return 'Clothes';
  }
  if (lower.includes('house') || lower.includes('furniture') || lower.includes('utensil') || lower.includes('appliance') || lower.includes('blanket') || lower.includes('bed') || lower.includes('home')) {
    return 'Household';
  }
  if (lower.includes('groc') || lower.includes('ration') || lower.includes('pantry') || lower.includes('staple') || lower.includes('oil') || lower.includes('flour') || lower.includes('rice')) {
    return 'Grocery';
  }
  return 'Grocery';
}

const aiService = {
  // 1. Item Image Analysis (Multimodal AI - Gemini Vision)
  analyzeItem: async (imageBase64, category) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in .env');
      }

      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

      let prompt = '';
      if (['Food', 'Meat', 'Vegetables', 'Fruit', 'Dairy'].includes(category)) {
        prompt = `
You are a strict food safety inspector.

Analyze this food image and decide clearly:

- Fresh food → score 80–100
- Spoiled food → score 0–40
- Only use 50–69 if uncertain

Classify the food item into one of these exact sub-categories: "Meat", "Vegetables", "Fruit", "Dairy", or "Food" (if it is a general cooked/prepared food item not falling into those specific sub-categories).

Respond ONLY in JSON:

{
  "status": "approved" | "needs_review" | "rejected",
  "safetyScore": number,
  "reason": "short reason",
  "keywords": ["keyword1", "keyword2"],
  "classifiedCategory": "Meat" | "Food" | "Vegetables" | "Fruit" | "Dairy" | "Other"
}
`;
      } else if (category === 'Medicine') {
        const currentDateStr = new Date().toISOString().split('T')[0];
        prompt = `
You are a pharmaceutical safety inspector.

Analyze the image and determine:
1. Is this a valid medicine product?
2. Check packaging condition (sealed/open/damaged).
CRITICAL RULE: Do NOT reject a medicine for minor cosmetic outer packaging damage (like a slightly crushed, creased, or bent cardboard box corner) as long as the primary container (bottle, blister pack, tube, or vial) inside is intact, sealed, and undamaged.
3. Detect expiry date and manufacturing date if visible.
4. Identify medicine type (tablets, capsules, syrup, etc.)
5. Evaluate if safe for donation (NOT food safety).

Return JSON:
{
  "status": "valid" | "rejected" | "needs_review",
  "safetyScore": number (0-100),
  "reason": "clear medical reasoning",
  "keywords": ["capsules", "medicine", "tablets"],
  "classifiedCategory": "Medicine"
}

IMPORTANT:
- The actual current date is ${currentDateStr}. Use this date for any date comparisons.
- Do NOT reject a medicine as "unverifiable" or "unsafe" due to its manufacturing date unless its manufacturing date is in the future (after ${currentDateStr}).
- For minor cosmetic outer box corner damage or crushed corners, set status to "valid" or "needs_review" (with score 75-90) instead of "rejected". Only reject if the inner container/seal is actually broken or the item is expired.
- DO NOT mention food
- DO NOT compare with food
- Treat this ONLY as medicine
`;
      } else {
        prompt = `
You are an item quality and safety inspector.

Look at this ${category || 'item'} image and evaluate its condition for donation.

Classify the item into one of these categories: "Clothes", "Household", "Grocery", "Medicine", "Food", or "Other" (if appropriate).

Respond ONLY in JSON:

{
  "status": "approved" | "needs_review" | "rejected",
  "safetyScore": number,
  "reason": "short reason",
  "keywords": ["keyword1", "keyword2"],
  "classifiedCategory": "Clothes" | "Household" | "Grocery" | "Medicine" | "Food" | "Other"
}

RULES:
- Good, usable condition → score 70-100 (approved)
- Acceptable but worn/used → score 50-69 (needs_review)
- Damaged, unsafe, or unusable → score 0-49 (rejected)
- safetyScore MUST be a number between 0-100.
- Output ONLY JSON
`;
      }

      // Extract pure base64
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      // Detect MIME type
      let mimeType = "image/jpeg";
      if (imageBase64.startsWith("data:image/png")) mimeType = "image/png";
      else if (imageBase64.startsWith("data:image/webp")) mimeType = "image/webp";

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              }
            ]
          }
        ]
      });

      const rawText = result.response.text().trim();
      console.log("=== RAW GEMINI RESPONSE ===\n", rawText, "\n===================");

      // Extract JSON block - handle markdown fences too
      const jsonMatch = rawText.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ No JSON found in Gemini response:", rawText);
        throw new Error("No JSON in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log("=== PARSED AI DATA ===", parsed);

      // Convert score to number (handles both "85" string and 85 integer from Gemini)
      const rawScore = Number(parsed.safetyScore);

      if (isNaN(rawScore) || !parsed.status) {
        console.error("❌ Invalid AI data - score:", parsed.safetyScore, "status:", parsed.status);
        throw new Error("AI returned invalid safetyScore or status");
      }

      let safetyScore = Math.round(rawScore);
      let status = parsed.status || 'needs_review';

      // Enforce absolute safety consistency:
      // If AI flagged status as rejected, score must reflect rejection (below 50)
      if (status === 'rejected' || status === 'reject') {
        status = 'rejected';
        if (safetyScore >= 50) {
          safetyScore = Math.floor(Math.random() * 20) + 15; // 15-35%
        }
      }

      // If score is low, status must be rejected
      if (safetyScore < 50) {
        status = 'rejected';
      } else if (safetyScore < 70) {
        status = 'needs_review';
      } else {
        status = 'approved';
      }

      console.log(`=== AI RECONCILED SCORE: ${safetyScore} | FINAL STATUS: ${status} ===`);

      return {
        status,
        safetyScore,
        reason: parsed.reason || 'AI analysis complete',
        keywords: parsed.keywords || [],
        classifiedCategory: cleanToStandardCategory(
          (parsed.classifiedCategory && parsed.classifiedCategory !== 'Other')
            ? parsed.classifiedCategory
            : (category || 'Other')
        )
      };

    } catch (err) {
      console.error('❌ Gemini analyzeItem FAILED, switching to MobileNetV2 Fallback:', err.message);
      try {
        const response = await callPythonService('POST', '/analyze-food', { imageBase64 });
        const fallbackData = response;
        return {
          status: fallbackData.status,
          safetyScore: fallbackData.safetyScore,
          reason: `[Local Fallback Model MobileNetV2]: ${fallbackData.reason}`,
          keywords: fallbackData.detectedClasses || [],
          classifiedCategory: cleanToStandardCategory(category || 'Other')
        };
      } catch (fallbackErr) {
        console.error('❌ Local MobileNetV2 Fallback FAILED:', fallbackErr.message);
        return {
          status: "needs_review",
          safetyScore: 55,
          reason: "AI service error — manual review required",
          keywords: [],
          classifiedCategory: cleanToStandardCategory(category || 'Other')
        };
      }
    }
  },

  // 2. OCR Medicine Expiry
  extractExpiry: async (imageBase64) => {
    try {
      const res = await callPythonService('POST', '/extract-expiry', { imageBase64 });
      return res;
    } catch (err) {
      console.error('Python API Error (extractExpiry):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service failed OCR extraction.');
    }
  },

  // 3. Smart Matching
  match: async (donorLat, donorLng, receivers) => {
    try {
      const res = await callPythonService('POST', '/match', { donorLat, donorLng, receivers });
      return res;
    } catch (err) {
      console.error('Python API Error (match):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service matching failed.');
    }
  },

  // 4. Fraud Score
  getFraudScore: async (userId, reports, avgRating, dailyPosts) => {
    try {
      const res = await callPythonService('GET', '/fraud-score', { reports, avgRating, dailyPosts }, true);
      return res;
    } catch (err) {
      console.error('Python API Error (getFraudScore):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service fraud detection failed.');
    }
  },

  // 5. Deep Translation
  translate: async (text, targetLang = 'ur', forceGemini = false) => {
    if (!text) return { translatedText: "" };
    const cacheKey = `${targetLang}:${text}`;
    if (translationCache[cacheKey]) {
      return { translatedText: translationCache[cacheKey] };
    }
    if (targetLang === 'en') {
      return { translatedText: text };
    }

    try {
      const data = await callPythonService('POST', '/translate', { text, targetLang });
      if (data && data.translatedText) {
        translationCache[cacheKey] = data.translatedText;
        return data;
      }
    } catch (err) {
      console.warn(`⚠️ Translation via Python failed: ${err.message}`);
      
      // If Python is offline, only use Gemini if forceGemini is true (single item translation)
      // to avoid slowing down list fetches on dashboards
      if (forceGemini) {
        console.log(`🔄 Falling back to Gemini for single item translation...`);
        try {
          if (process.env.GEMINI_API_KEY) {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `Translate this text to Urdu. Output only the translation, no explanation, no formatting: "${text}"`;
            const result = await model.generateContent(prompt);
            const translatedText = result.response.text().trim();
            if (translatedText) {
              translationCache[cacheKey] = translatedText;
              return { translatedText };
            }
          }
        } catch (geminiErr) {
          console.error('❌ Gemini translation failed:', geminiErr.message);
        }
      } else {
        console.log(`⏩ Python is offline. Skipping Gemini fallback for list item to preserve load speed.`);
      }
    }

    // Ultimate fallback: return original text
    return { translatedText: text };
  },

  // 6. Smart Suggestion
  suggestDonation: async (userId, lat, lng, category, dbDemand = 0) => {
    try {
      const weatherData = await callPythonService('GET', '/weather-insights', { lat, lng }, true);
      const temp = weatherData.temperature;
      const res = await callPythonService('GET', '/suggest-donation', { category, temp, dbDemand }, true);
      return res;
    } catch (err) {
      console.error('Python API Error (suggestDonation):', err.message);
      throw new Error('Python AI Service suggestions failed.');
    }
  },

  // 7. Forecast
  forecast: async () => {
    try {
      const res = await callPythonService('GET', '/forecast', null, true);
      return res;
    } catch (err) {
      console.error('Python API Error (forecast):', err.message);
      throw new Error('Python AI Service forecast failed.');
    }
  },

  // 8. Food Expiry Prediction (Time/Temp check)
  predictExpiry: async (category, condition, foodPreparedTime, temp = 25.0) => {
    try {
      const res = await callPythonService('POST', '/predict-expiry', { category, condition, foodPreparedTime, temp });
      return res;
    } catch (err) {
      console.error('Python API Error (predictExpiry):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service predict expiry failed.');
    }
  },

  // 9. Weather Insights
  weatherInsights: async (lat, lng) => {
    try {
      const res = await callPythonService('GET', '/weather-insights', { lat, lng }, true);
      return res;
    } catch (err) {
      console.error('Python API Error (weatherInsights):', err.message);
      throw new Error('Python AI Service weather fetch failed.');
    }
  },

  // 10. Trust Score
  getTrustScore: async (rating, completed, reports) => {
    try {
      const res = await callPythonService('GET', '/trust-score', { rating, completed, reports }, true);
      return res;
    } catch (err) {
      console.error('Python API Error (trustScore):', err.message);
      throw new Error('Python AI Service trust score failed.');
    }
  },

  // 11. Weather Radius
  getWeatherRadius: async (category, temp) => {
    try {
      const res = await callPythonService('GET', '/weather-radius', { category, temp }, true);
      return res;
    } catch (err) {
      console.error('Python API Error (weatherRadius):', err.message);
      throw new Error('Python AI Service weather radius failed.');
    }
  }
};

module.exports = aiService;
