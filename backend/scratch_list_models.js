const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCLdBtPXZSUQ78h4ut2Yge4xRZyL4k4Brs';
console.log("Using API Key:", apiKey);

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    // In @google/generative-ai, we can list models using the ModelService if available,
    // or try generic model names: 'gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'
    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-2.5-flash",
      "gemini-1.5-pro",
      "gemini-2.5-pro",
      "gemini-pro",
      "gemini-1.0-pro"
    ];
    
    for (const m of modelsToTry) {
      try {
        console.log(`Trying model: ${m}...`);
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent("hello");
        console.log(`✅ Model ${m} is working! Response:`, result.response.text());
        break; // found one!
      } catch (err) {
        console.log(`❌ Model ${m} failed:`, err.message);
      }
    }
  } catch (err) {
    console.error("Outer Error:", err);
  }
}

run();
