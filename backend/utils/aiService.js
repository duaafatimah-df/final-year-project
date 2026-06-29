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
  analyzeItem: async (images, category) => {
    const imageList = Array.isArray(images) ? images : [images];
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in .env');
      }

      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

      const getPromptForIndex = (cat, idx, total) => {
        const baseCategory = cleanToStandardCategory(cat);
        const imageContext = total > 1 
          ? `NOTE: You are analyzing Image ${idx + 1} of ${total} images uploaded. These images may represent multiple different items, or they may be different views/angles/labels of the SAME single item (e.g. front, back, side, close-up). Treat them as a cohesive unit if they show the same item.`
          : '';

        if (baseCategory === 'Food') {
          return `
You are a welcoming and helpful community donation assistant for SpareShare, a platform designed specifically to share homemade meals and food with those in need.
Evaluate this image of food.
${imageContext}

CRITICAL RULES FOR FOOD (MUST FOLLOW STRICTLY):
1. We EXPLICITLY allow and highly encourage cooked meals, prepared food, and homemade dishes (such as Biryani, rice, pasta, curry, etc.) in unsealed containers, plastic food boxes, takeaway containers, plates, or standard packaging.
2. DO NOT apply commercial packaging rules, tamper-evident seal rules, hygiene verification rules, or professional date/ingredient labeling rules to cooked food. The absence of commercial packaging or seals is normal and expected, and MUST NOT be used as a reason to reject the food.
3. If the food looks fresh, clean, edible, and safe to consume (no mold, rot, or decay), you MUST set status to "approved" and safetyScore to 80-100.
4. Reject food ONLY if it shows clear, visible signs of spoilage, rot, mold, decay, or being clearly stale/unsafe to consume.

Classify the food item into one of these exact sub-categories: "Meat", "Vegetables", "Fruit", "Dairy", or "Food".

Respond ONLY in JSON format:
{
  "status": "approved" | "needs_review" | "rejected",
  "safetyScore": number (0-100),
  "reason": "detailed explanation of freshness and safety, explicitly mentioning if it looks fresh and edible",
  "keywords": ["keyword1", "keyword2"],
  "classifiedCategory": "Food" | "Meat" | "Vegetables" | "Fruit" | "Dairy"
}
`;
        } else if (baseCategory === 'Medicine') {
          const currentDateStr = new Date().toISOString().split('T')[0];
          return `
You are a helpful pharmaceutical safety assistant.
Evaluate this medicine image.
${imageContext}

CRITICAL RULES FOR MEDICINE:
1. Check if it is a valid pharmaceutical product. Check package condition.
2. Do NOT reject a medicine for minor cosmetic outer packaging damage (like a slightly crushed, creased, or bent cardboard box corner) as long as the primary container (bottle, blister pack, tube, or vial) inside is intact, sealed, and undamaged.
3. For minor cosmetic outer box corner damage or crushed corners, set safetyScore to 75-90 (status: approved) instead of rejected. Only reject if the inner container/seal is actually broken or the item is expired.
4. Detect expiry date and manufacturing date if visible.
5. Evaluate safety.

Respond ONLY in JSON format:
{
  "status": "approved" | "needs_review" | "rejected",
  "safetyScore": number (0-100),
  "reason": "clear medical reasoning",
  "keywords": ["medicine", "tablet", "capsule"],
  "classifiedCategory": "Medicine"
}

IMPORTANT:
- The actual current date is ${currentDateStr}. Use this date for any date comparisons.
- Do NOT reject a medicine as "unverifiable" or "unsafe" due to its manufacturing date unless its manufacturing date is in the future (after ${currentDateStr}).
`;
        } else {
          return `
You are a welcoming and helpful community donation assistant for SpareShare, a platform designed specifically to share pre-loved items with those in need.
Evaluate this image for donation.
${imageContext}

Classify the item into one of these categories: "Clothes", "Household", "Grocery", or "Other".

CRITICAL RULES FOR ITEMS (Clothes, Household, Grocery, etc.):
1. We EXPLICITLY allow and highly encourage used, pre-loved, or pre-used items.
2. DO NOT reject items for standard usage wear, minor surface scratches, cosmetic marks, fading, peeling, or scuffs. The presence of wear is normal and expected, and MUST NOT be used as a reason to reject the item.
3. Reject items ONLY if they are torn to pieces, completely broken/shattered/unusable, extremely filthy/muddy/dirty, or heavily stained with blood/mold.
4. If the item is in good, clean, wearable/usable condition, you MUST approve it (status: approved, safetyScore 75-100).
5. If it is acceptable but worn/used, score it 50-74 (status: approved or needs_review). Reject ONLY if completely unusable (0-49).

Respond ONLY in JSON format:
{
  "status": "approved" | "needs_review" | "rejected",
  "safetyScore": number (0-100),
  "reason": "short detailed reason explaining condition",
  "keywords": ["keyword1", "keyword2"],
  "classifiedCategory": "Clothes" | "Household" | "Grocery" | "Other"
}
`;
        }
      };

      const analyzeSingleImage = async (img, idx, total) => {
        const base64Data = img.includes(',') ? img.split(',')[1] : img;
        let mimeType = "image/jpeg";
        if (img.startsWith("data:image/png")) mimeType = "image/png";
        else if (img.startsWith("data:image/webp")) mimeType = "image/webp";

        const prompt = getPromptForIndex(category, idx, total);

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
        const jsonMatch = rawText.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON in AI response");
        }
        const parsed = JSON.parse(jsonMatch[0]);

        let safetyScore = Math.round(Number(parsed.safetyScore) || 60);
        let status = parsed.status || 'needs_review';

        // Normalize status
        if (status === 'valid' || status === 'approved' || status === 'success') {
          status = 'approved';
        } else if (status === 'rejected' || status === 'reject' || status === 'invalid') {
          status = 'rejected';
        }

        // Programmatic overrides to prevent false-positives based on platform policy
        const detectedCat = cleanToStandardCategory(parsed.classifiedCategory || category || 'Other');
        const reasonLower = (parsed.reason || '').toLowerCase();

        if (detectedCat === 'Food') {
          // If food is rejected/flagged purely due to being home-cooked, unsealed, or lacking commercial packaging/seals
          const hasCommercialPackagingRejection = reasonLower.includes('unsealed') || 
                                                  reasonLower.includes('unpackaged') || 
                                                  reasonLower.includes('open meal') || 
                                                  reasonLower.includes('prepared meal') || 
                                                  reasonLower.includes('home-cooked') || 
                                                  reasonLower.includes('homemade') || 
                                                  reasonLower.includes('non-hermetic') || 
                                                  reasonLower.includes('hermetically') || 
                                                  reasonLower.includes('hygiene standard') || 
                                                  reasonLower.includes('preparation environment') || 
                                                  reasonLower.includes('commercial packaging') || 
                                                  reasonLower.includes('liability');
          
          const hasSevereSpoilage = reasonLower.includes('spoiled') || 
                                    reasonLower.includes('mold') || 
                                    reasonLower.includes('rotten') || 
                                    reasonLower.includes('decay') || 
                                    reasonLower.includes('expired') || 
                                    reasonLower.includes('smell') || 
                                    reasonLower.includes('stale');

          if (hasCommercialPackagingRejection && !hasSevereSpoilage) {
            status = 'approved';
            safetyScore = Math.max(85, safetyScore);
            parsed.reason = `[System Approved Cooked Meal] Freshly prepared meal accepted: ${parsed.reason}`;
          }
        } else if (detectedCat === 'Clothes') {
          // If clothes are rejected purely due to standard wear, fading, minor scuffs, or peeling
          const hasMinorWearRejection = reasonLower.includes('wear') || 
                                        reasonLower.includes('surface damage') || 
                                        reasonLower.includes('fading') || 
                                        reasonLower.includes('scuff') || 
                                        reasonLower.includes('peeling') || 
                                        reasonLower.includes('used') || 
                                        reasonLower.includes('pre-loved');

          const hasSevereDamage = reasonLower.includes('torn to pieces') || 
                                  reasonLower.includes('filthy') || 
                                  reasonLower.includes('mold') || 
                                  reasonLower.includes('blood') || 
                                  reasonLower.includes('shredded') || 
                                  reasonLower.includes('completely broken');

          if (hasMinorWearRejection && !hasSevereDamage) {
            status = 'approved';
            safetyScore = Math.max(80, safetyScore);
            parsed.reason = `[System Approved Used Item] Pre-loved item accepted: ${parsed.reason}`;
          }
        }

        if (safetyScore < 50) {
          status = 'rejected';
        } else if (safetyScore < 70 && status === 'approved') {
          status = 'needs_review';
        } else if (safetyScore >= 70 && status === 'needs_review') {
          status = 'approved';
        }

        return {
          status,
          safetyScore,
          reason: parsed.reason || 'AI analysis complete',
          keywords: parsed.keywords || [],
          classifiedCategory: detectedCat
        };
      };

      // Perform analysis on all images in parallel
      const individualResults = await Promise.all(imageList.map(async (img, idx) => {
        try {
          const singleResult = await analyzeSingleImage(img, idx, imageList.length);
          
          // Medicine specific OCR check in parallel
          if (singleResult.classifiedCategory === 'Medicine' && singleResult.status !== 'rejected') {
            try {
              const ocr = await aiService.extractExpiry(img);
              if (!ocr.isValid) {
                if (ocr.message && (ocr.message.includes('expired') || ocr.message.includes('future') || ocr.message.includes('before the manufacturing'))) {
                  singleResult.status = 'rejected';
                  singleResult.safetyScore = 20;
                  singleResult.reason = `Medicine Safety Validation failed: ${ocr.message}`;
                } else {
                  singleResult.safetyScore = Math.max(30, singleResult.safetyScore - 20);
                  singleResult.reason += ` | OCR Warning: ${ocr.message || 'No date found'}`;
                }
              } else {
                singleResult.reason += ` | OCR Found Expiry: ${ocr.expiryDate}`;
              }
            } catch (ocrErr) {
              console.warn(`OCR failed for image index ${idx}:`, ocrErr.message);
            }
          }

          return {
            img,
            idx,
            success: true,
            result: singleResult
          };
        } catch (err) {
          console.error(`AI analysis failed for image index ${idx}:`, err.message);
          return {
            img,
            idx,
            success: false,
            error: err.message
          };
        }
      }));

      const safeItems = [];
      const unsafeItems = [];
      let combinedReason = imageList.length > 1 ? "Multi-Image Evaluation Report:" : "Evaluation Report:";
      let combinedKeywords = [];
      let scoreSum = 0;
      let approvedCount = 0;
      let categoriesFound = [];

      for (const item of individualResults) {
        const imgLabel = `Image ${item.idx + 1}`;
        if (!item.success) {
          unsafeItems.push(item.img);
          combinedReason += `\n- ${imgLabel}: Failed to analyze (${item.error}).`;
          continue;
        }

        const res = item.result;
        combinedKeywords.push(...res.keywords);
        categoriesFound.push(res.classifiedCategory);

        if (res.status === 'rejected' || res.safetyScore < 50) {
          unsafeItems.push(item.img);
          combinedReason += `\n- ${imgLabel} (${res.classifiedCategory}): Rejected - ${res.reason}`;
        } else {
          safeItems.push(item.img);
          approvedCount++;
          scoreSum += res.safetyScore;
          combinedReason += `\n- ${imgLabel} (${res.classifiedCategory}): Approved (${res.safetyScore}%) - ${res.reason}`;
        }
      }

      let finalStatus = 'rejected';
      let finalScore = 0;
      if (approvedCount > 0) {
        finalScore = Math.round(scoreSum / approvedCount);
        finalStatus = finalScore >= 70 ? 'approved' : 'needs_review';
      }

      const mainCategory = categoriesFound.length > 0 ? categoriesFound[0] : (category || 'Other');

      return {
        status: finalStatus,
        safetyScore: finalScore,
        reason: combinedReason,
        keywords: [...new Set(combinedKeywords)],
        classifiedCategory: cleanToStandardCategory(mainCategory),
        safeImages: safeItems,
        hasRejectedItems: unsafeItems.length > 0
      };

    } catch (err) {
      console.error('❌ Gemini analyzeItem FAILED, switching to MobileNetV2 Fallback:', err.message);
      try {
        const imageBase64 = imageList[0] || '';
        const response = await callPythonService('POST', '/analyze-food', { imageBase64 });
        const fallbackData = response;
        return {
          status: fallbackData.status,
          safetyScore: fallbackData.safetyScore,
          reason: `[Local Fallback Model MobileNetV2]: ${fallbackData.reason}`,
          keywords: fallbackData.detectedClasses || [],
          classifiedCategory: cleanToStandardCategory(category || 'Other'),
          safeImages: imageList
        };
      } catch (fallbackErr) {
        console.error('❌ Local MobileNetV2 Fallback FAILED:', fallbackErr.message);
        return {
          status: "needs_review",
          safetyScore: 55,
          reason: "AI service error — manual review required",
          keywords: [],
          classifiedCategory: cleanToStandardCategory(category || 'Other'),
          safeImages: imageList
        };
      }
    }
  },

  // 2. OCR Medicine Expiry
  extractExpiry: async (images) => {
    try {
      const imageList = Array.isArray(images) ? images : [images];
      const imageBase64 = imageList[0] || '';
      const res = await callPythonService('POST', '/extract-expiry', { imageBase64 });
      return res;
    } catch (err) {
      console.warn('Python API Error (extractExpiry), falling back to Gemini OCR:', err.message);
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const prompt = `
Analyze the medicine packaging image(s) and extract the manufacturing date (MFG) and expiration date (EXP) if visible.
Current date is ${new Date().toISOString().split('T')[0]}.
Check if the medicine is expired or expires in less than 30 days.

Return JSON ONLY:
{
  "isValid": boolean,
  "expiryDate": "YYYY-MM-DD" or null,
  "mfgDate": "YYYY-MM-DD" or null,
  "message": "reason or warnings"
}
`;
        const parts = [{ text: prompt }];
        const imageList = Array.isArray(images) ? images : [images];
        for (const img of imageList) {
          if (!img) continue;
          const base64Data = img.includes(',') ? img.split(',')[1] : img;
          let mimeType = "image/jpeg";
          if (img.startsWith("data:image/png")) mimeType = "image/png";
          else if (img.startsWith("data:image/webp")) mimeType = "image/webp";
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          });
        }
        const result = await model.generateContent({
          contents: [{ role: "user", parts }]
        });
        const rawText = result.response.text().trim();
        const jsonMatch = rawText.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Invalid Gemini response format");
      } catch (geminiErr) {
        console.error("Gemini OCR Fallback failed:", geminiErr.message);
        throw new Error("OCR extraction failed: " + geminiErr.message);
      }
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
