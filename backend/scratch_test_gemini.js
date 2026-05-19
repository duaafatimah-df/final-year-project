const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCLdBtPXZSUQ78h4ut2Yge4xRZyL4k4Brs';
console.log("Using API Key:", apiKey);

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Respond with hello world");
    console.log("SUCCESS! Gemini Response:", result.response.text());
  } catch (err) {
    console.error("FAILED! Detailed Error:", err);
  }
}

run();
