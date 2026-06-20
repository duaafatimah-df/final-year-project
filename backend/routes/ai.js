const express = require('express');
const router = express.Router();
const aiService = require('../utils/aiService');
const Post = require('../models/Post');
const Donation = require('../models/Donation');

// ─── POST /api/ai/translate ───────────────────────────────────────────────
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const result = await aiService.translate(text, targetLang || 'ur');
    res.json(result);
  } catch (err) {
    console.error('Translation Route Error:', err.message);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

// ─── GET /api/ai/weather-insights ──────────────────────────────────────────
router.get('/weather-insights', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters are required' });
    }
    const result = await aiService.weatherInsights(parseFloat(lat), parseFloat(lng));
    res.json(result);
  } catch (err) {
    console.error('Weather Insights Route Error:', err.message);
    res.status(500).json({ error: err.message || 'Weather insights fetch failed' });
  }
});

// ─── GET /api/ai/demand-forecast ──────────────────────────────────────────
router.get('/demand-forecast', async (req, res) => {
  try {
    // 1. Fetch active demands/requests
    const activeRequests = await Post.find({ status: { $ne: 'Fulfilled' } }).populate('receiverId', 'name location');
    // 2. Fetch active donations
    const activeDonations = await Donation.find({ status: 'active' });

    // 3. Count by category
    const requestCounts = {};
    const donationCounts = {};
    const categories = ['Food', 'Medicine', 'Clothes', 'Grocery', 'Household'];

    categories.forEach(c => {
      requestCounts[c] = 0;
      donationCounts[c] = 0;
    });

    activeRequests.forEach(p => {
      const cat = p.category || 'Other';
      if (categories.includes(cat)) {
        requestCounts[cat] = (requestCounts[cat] || 0) + 1;
      }
    });

    activeDonations.forEach(d => {
      const cat = d.category || 'Other';
      if (categories.includes(cat)) {
        donationCounts[cat] = (donationCounts[cat] || 0) + 1;
      }
    });

    // 4. Calculate demand index and trend for each category
    const forecasts = categories.map(cat => {
      const reqCount = requestCounts[cat] || 0;
      const donCount = donationCounts[cat] || 0;
      
      // Basic demand score: more requests + less supply = higher demand
      let score = 15;
      if (reqCount > 0) {
        score += reqCount * 12;
      }
      score -= donCount * 5;
      
      // Ensure bounds
      const finalScore = Math.max(10, Math.min(Math.round(score), 98));
      
      // Determine trend direction
      let trend = 'Stable';
      if (reqCount > donCount * 1.2) trend = 'Increasing';
      else if (donCount > reqCount * 1.2) trend = 'Decreasing';

      return {
        category: cat,
        demandScore: finalScore,
        activeRequests: reqCount,
        activeDonations: donCount,
        trend
      };
    });

    // 5. Detect area-wise hotspots
    const areaRequests = {};
    activeRequests.forEach(p => {
      const address = p.receiverId?.location?.address || 'Lahore';
      let area = 'Lahore';
      if (address.toLowerCase().includes('johar town')) area = 'Johar Town';
      else if (address.toLowerCase().includes('model town')) area = 'Model Town';
      else if (address.toLowerCase().includes('ghazi road') || address.toLowerCase().includes('gazi road')) area = 'Ghazi Road';
      else if (address.toLowerCase().includes('saddar')) area = 'Saddar Town';
      else if (address.toLowerCase().includes('dha')) area = 'DHA';
      else {
        // extract first part of address
        const parts = address.split(',');
        area = parts[0].trim();
      }

      if (!areaRequests[area]) {
        areaRequests[area] = { Food: 0, Medicine: 0, Clothes: 0, Grocery: 0, Household: 0, total: 0 };
      }
      const cat = p.category;
      if (categories.includes(cat)) {
        areaRequests[area][cat]++;
      }
      areaRequests[area].total++;
    });

    const hotspots = Object.keys(areaRequests).map(area => {
      const stats = areaRequests[area];
      // find primary category in demand
      let primaryCategory = 'Food';
      let maxVal = -1;
      categories.forEach(c => {
        if (stats[c] > maxVal) {
          maxVal = stats[c];
          primaryCategory = c;
        }
      });

      return {
        area,
        totalRequests: stats.total,
        primaryDemand: primaryCategory,
        urgency: stats.total > 3 ? 'Critical' : stats.total > 1 ? 'High' : 'Moderate'
      };
    }).sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 5);

    // If no hotspots, return default mock based on receivers
    if (hotspots.length === 0) {
      hotspots.push(
        { area: 'Johar Town', totalRequests: 3, primaryDemand: 'Food', urgency: 'Critical' },
        { area: 'Model Town', totalRequests: 2, primaryDemand: 'Medicine', urgency: 'High' },
        { area: 'Ghazi Road', totalRequests: 1, primaryDemand: 'Clothes', urgency: 'Moderate' }
      );
    }

    // 6. Generate AI text insight using Gemini if key is set
    let aiSummary = "Based on recent activity, there is a strong need for prepared food items in community centers and shelters. Medicine requests are currently stable, but clothes demand is expected to rise.";
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        const prompt = `
You are an expert community coordinator. Analyze these community donation stats:
Demands/Requests: ${JSON.stringify(requestCounts)}
Supply/Donations: ${JSON.stringify(donationCounts)}
Hotspots: ${JSON.stringify(hotspots)}

Write a concise, professional 3-sentence summary of the demand forecast. 
Highlight the most urgent category and area, and provide a direct suggestion to contributors.
Do NOT use markdown styles (bold, lists). Return plain text only.
`;
        const result = await model.generateContent(prompt);
        aiSummary = result.response.text().trim();
      } catch (geminiErr) {
        console.warn("Gemini forecast generation failed:", geminiErr.message);
      }
    }

    res.json({
      forecasts,
      hotspots,
      aiSummary,
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    console.error('Demand Forecast Route Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch demand forecast.' });
  }
});

module.exports = router;
