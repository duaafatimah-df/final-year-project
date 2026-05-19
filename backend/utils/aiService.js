const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const AI_URL = 'https://spareshare.up.railway.app/ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const aiService = {
  // 1. Item Image Analysis (Multimodal AI - Gemini Vision)
  analyzeItem: async (imageBase64, category) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in .env');
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      let prompt = '';
      if (category === 'Food') {
        prompt = `
You are a strict food safety inspector.

Analyze this food image and decide clearly:

- Fresh food → score 80–100
- Spoiled food → score 0–40
- Only use 50–69 if uncertain

Respond ONLY in JSON:

{
  "status": "approved" | "needs_review" | "rejected",
  "safetyScore": number,
  "reason": "short reason",
  "keywords": ["keyword1", "keyword2"]
}
`;
      } else if (category === 'Medicine') {
        prompt = `
You are a pharmaceutical safety inspector.

Analyze the image and determine:

1. Is this a valid medicine product?
2. Check packaging condition (sealed/open/damaged)
3. Detect expiry date if visible
4. Identify medicine type (tablets, capsules, syrup, etc.)
5. Evaluate if safe for donation (NOT food safety)

Return JSON:
{
  "status": "valid | rejected | needs_review",
  "safetyScore": number (0-100),
  "reason": "clear medical reasoning",
  "keywords": ["capsules", "medicine", "tablets"]
}

IMPORTANT:
- DO NOT mention food
- DO NOT compare with food
- Treat this ONLY as medicine
`;
      } else {
        prompt = `
You are an item quality and safety inspector.

Look at this ${category || 'item'} image and evaluate its condition for donation.

Respond ONLY in JSON:

{
  "status": "approved" | "needs_review" | "rejected",
  "safetyScore": number,
  "reason": "short reason",
  "keywords": ["keyword1", "keyword2"]
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
        keywords: parsed.keywords || []
      };

    } catch (err) {
      console.error('❌ Gemini analyzeItem FAILED:', err.message);
      // Fallback ONLY when API/JSON fails
      return {
        status: "needs_review",
        safetyScore: 55,
        reason: "AI service error — manual review required",
        keywords: []
      };
    }
  },

  // 2. OCR Medicine Expiry
  extractExpiry: async (imageBase64) => {
    try {
      const res = await axios.post(`${AI_URL}/extract-expiry`, { imageBase64 });
      return res.data;
    } catch (err) {
      console.error('Python API Error (extractExpiry):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service failed OCR extraction.');
    }
  },

  // 3. Smart Matching
  match: async (donorLat, donorLng, receivers) => {
    try {
      const res = await axios.post(`${AI_URL}/match`, { donorLat, donorLng, receivers });
      return res.data;
    } catch (err) {
      console.error('Python API Error (match):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service matching failed.');
    }
  },

  // 4. Fraud Score
  getFraudScore: async (userId, reports, avgRating, dailyPosts) => {
    try {
      const res = await axios.get(`${AI_URL}/fraud-score`, { params: { reports, avgRating, dailyPosts } });
      return res.data;
    } catch (err) {
      console.error('Python API Error (getFraudScore):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service fraud detection failed.');
    }
  },

  // 5. Deep Translation
  translate: async (text, targetLang = 'ur') => {
    if (!text) return { translatedText: "" };
    try {
      const res = await axios.post(`${AI_URL}/translate`, { text, targetLang });
      return res.data;
    } catch (err) {
      console.error('Python API Error (translate):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service translation failed.');
    }
  },

  // 6. Smart Suggestion
  suggestDonation: async (userId, lat, lng, category, dbDemand = 0) => {
    try {
      const weatherRes = await axios.get(`${AI_URL}/weather-insights`, { params: { lat, lng } });
      const temp = weatherRes.data.temperature;
      const res = await axios.get(`${AI_URL}/suggest-donation`, { params: { category, temp, dbDemand } });
      return res.data;
    } catch (err) {
      console.error('Python API Error (suggestDonation):', err.message);
      throw new Error('Python AI Service suggestions failed.');
    }
  },

  // 7. Forecast
  forecast: async () => {
    try {
      const res = await axios.get(`${AI_URL}/forecast`);
      return res.data;
    } catch (err) {
      console.error('Python API Error (forecast):', err.message);
      throw new Error('Python AI Service forecast failed.');
    }
  },

  // 8. Food Expiry Prediction (Time/Temp check)
  predictExpiry: async (category, condition, foodPreparedTime, temp = 25.0) => {
    try {
      const res = await axios.post(`${AI_URL}/predict-expiry`, { category, condition, foodPreparedTime, temp });
      return res.data;
    } catch (err) {
      console.error('Python API Error (predictExpiry):', err.message);
      throw new Error(err.response?.data?.detail || 'Python AI Service predict expiry failed.');
    }
  },

  // 9. Weather Insights
  weatherInsights: async (lat, lng) => {
    try {
      const res = await axios.get(`${AI_URL}/weather-insights`, { params: { lat, lng } });
      return res.data;
    } catch (err) {
      console.error('Python API Error (weatherInsights):', err.message);
      throw new Error('Python AI Service weather fetch failed.');
    }
  },

  // 10. Trust Score
  getTrustScore: async (rating, completed, reports) => {
    try {
      const res = await axios.get(`${AI_URL}/trust-score`, { params: { rating, completed, reports } });
      return res.data;
    } catch (err) {
      console.error('Python API Error (trustScore):', err.message);
      throw new Error('Python AI Service trust score failed.');
    }
  },

  // 11. Weather Radius
  getWeatherRadius: async (category, temp) => {
    try {
      const res = await axios.get(`${AI_URL}/weather-radius`, { params: { category, temp } });
      return res.data;
    } catch (err) {
      console.error('Python API Error (weatherRadius):', err.message);
      throw new Error('Python AI Service weather radius failed.');
    }
  }
};

module.exports = aiService;
