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

module.exports = router;
