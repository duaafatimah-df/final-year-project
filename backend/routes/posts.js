const express = require('express');
const jwt = require('jsonwebtoken');
const Post = require('../models/Post');
const aiService = require('../utils/aiService');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

function cleanToStandardCategory(cat) {
  if (!cat) return 'Food';
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
  return 'Food';
}

// Create a new demand post
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'receiver') {
      return res.status(403).json({ error: 'Only receivers can create demand posts' });
    }

    const { title, category, urgency, desc } = req.body;
    if (!category) return res.status(400).json({ error: 'Category is required' });

    const cleanCategory = cleanToStandardCategory(category);

    const post = new Post({
      receiverId: req.user.userId,
      title,
      category: cleanCategory,
      urgency,
      desc
    });

    await post.save();
    res.status(201).json(post);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get posts for a specific receiver
router.get('/my-posts', authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({ receiverId: req.user.userId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Get all active posts (for donors to view)
router.get('/active', async (req, res) => {
  try {
    const posts = await Post.find({ status: { $ne: 'Fulfilled' } })
      .populate('receiverId', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Update post status
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    let post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Ensure owner
    if (post.receiverId.toString() !== req.user.userId) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    post.status = status;
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Get nearby receiver demands (backend-driven map filtering)
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 50, category, temp } = req.query;
    const uLat = parseFloat(lat);
    const uLng = parseFloat(lng);

    if (isNaN(uLat) || isNaN(uLng)) {
      return res.status(400).json({ error: 'lat and lng are required.' });
    }

    const query = { status: { $ne: 'Fulfilled' } };

    let posts = await Post.find(query)
      .populate('receiverId', 'name email phone location')
      .limit(200);

    // Weather-Based Radius
    const temperature = temp ? parseFloat(temp) : (await aiService.weatherInsights(uLat, uLng)).temperature;

    let appliedRadius = parseFloat(radius) || 50;
    let aiMessage = '';

    if (category === 'Food') {
      const radiusData = await aiService.getWeatherRadius('Food', temperature);
      if (radiusData.radiusKm < appliedRadius) {
        appliedRadius = radiusData.radiusKm;
        aiMessage = radiusData.message;
      }
    }

    posts = posts
      .map(p => {
        const pLat = p.receiverId?.location?.lat;
        const pLng = p.receiverId?.location?.lng;
        if (pLat === undefined || pLat === null || pLng === undefined || pLng === null) {
          return { ...p._doc, distanceKm: 999999 };
        }
        const dist = haversineKm(uLat, uLng, pLat, pLng);
        return { ...p._doc, distanceKm: Math.round(dist * 10) / 10 };
      })
      .filter(p => {
        // Strict category match
        if (category && category !== 'All' && p.category && p.category.toLowerCase() !== category.toLowerCase()) {
          return false;
        }
        const itemMax = (category === 'Food') ? appliedRadius : parseFloat(radius) || 50;
        return p.distanceKm <= itemMax;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      receivers: posts,
      aiStats: {
        appliedRadius,
        temperature,
        message: aiMessage
      }
    });
  } catch (err) {
    console.error('Nearby Posts Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
