const express = require('express');
const router = express.Router();
const aiService = require('../utils/aiService');

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

module.exports = router;
