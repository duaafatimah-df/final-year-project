const express = require('express');
const jwt = require('jsonwebtoken');
const Donation = require('../models/Donation');
const User = require('../models/User');
const aiService = require('../utils/aiService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// ─── Auth Middleware ───────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Optional auth (public routes that benefit from knowing the user)
const optionalAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch { }
  }
  next();
};

// ─── Haversine distance helper (km) ───────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Season detection ─────────────────────────────────────────────────────
function isSummerNow() {
  const m = new Date().getMonth(); // 0-indexed
  return m >= 4 && m <= 8; // May(4) through Sep(8)
}

// ─── Food/Medicine validation ─────────────────────────────────────────────
function validateDonation(category, expiryTime, foodPreparedTime, isSealed) {
  const now = new Date();

  if (category === 'Food') {
    if (!foodPreparedTime) return 'Preparation time is required for Food.';
    const prepared = new Date(foodPreparedTime);
    if (prepared > now) return 'Preparation time cannot be in the future.';
  } else if (category === 'Medicine') {
    if (!expiryTime) return 'Expiry date/time is required for Medicine.';
    const expiry = new Date(expiryTime);
    if (expiry <= now) return 'Expiry time must be in the future.';

    const minDays = 30;
    const minExpiry = new Date(now.getTime() + minDays * 24 * 3600 * 1000);
    if (expiry < minExpiry) return 'Medicine must have at least 30 days until expiry.';
    if (!isSealed) return 'Medicine donations must be sealed/unopened.';
  }

  return null; // valid
}

// ─── POST /api/donations ─ Create donation ────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title, category, itemType, condition, imageUrl, quantity, description,
      expiryTime, foodPreparedTime, isSealed,
      lat, lng, address,
      receiverId, orgName, postId   // legacy fields
    } = req.body;

    // Block if no image
    if (!imageUrl) return res.status(400).json({ error: 'An image is required for the donation.' });

    // Validation
    const validationError = validateDonation(category, expiryTime, foodPreparedTime, isSealed);
    if (validationError) return res.status(400).json({ error: validationError });

    // AI Integration 1: Fraud Check
    const user = await User.findById(req.user.userId);
    
    let riskLevel = 'low';
    try {
      const fraudData = await aiService.getFraudScore(req.user.userId, user.flagCount || 0, user.avgRating || 5.0, 1);
      riskLevel = fraudData.riskLevel || 'low';
    } catch (err) {
      console.warn("⚠️ Fraud score Python service offline, falling back to low risk.", err.message);
    }
    
    if (riskLevel === 'high') {
      return res.status(403).json({ error: 'Donation rejected due to high AI risk score. Please contact support.' });
    }

    // Fetch weather to determine strict logic
    let temp = 25.0;
    try {
      const weather = await aiService.weatherInsights(lat, lng);
      temp = weather.temperature !== undefined ? weather.temperature : 25.0;
    } catch (err) {
      console.warn("⚠️ Weather insights Python service offline, falling back to 25°C.", err.message);
    }

    // GENERALIZED AI Integration: Analyze Item for all categories
    let itemAi = { status: 'Verified Safe' };
    try {
      itemAi = await aiService.predictExpiry(category, condition, foodPreparedTime, temp);
    } catch (err) {
      console.warn("⚠️ Expiry prediction Python service offline, falling back to Verified Safe.", err.message);
    }

    // Strict block if expired
    if (itemAi.status === 'Expired (time exceeded)') {
      return res.status(400).json({ error: `System Analysis Failed: ${itemAi.status}. Food is no longer safe to donate.` });
    }

    let isVerifiedSafe = false;
    let aiSafetyScore = 0;
    let aiAnalysisReason = `System Check: ${itemAi.status || 'Verified Safe'}`;
    let finalStatus = 'active';
    let donationKeywords = [];

    // Feature 1: Universal Image Analysis for ALL categories
    const visualAi = await aiService.analyzeItem(imageUrl, category);
    console.log("GEMINI AI RESPONSE:", visualAi);

    aiSafetyScore = visualAi.safetyScore !== undefined ? visualAi.safetyScore : 60;

    if (aiSafetyScore >= 70) {
      finalStatus = receiverId ? 'pending_receiver' : 'active';
      isVerifiedSafe = true;
    } else if (aiSafetyScore >= 50) {
      finalStatus = receiverId ? 'pending_receiver' : 'needs_review';
      isVerifiedSafe = false;
    } else {
      finalStatus = 'rejected';
      isVerifiedSafe = false;
    }

    aiAnalysisReason += ` | AI Vision Analysis: ${visualAi.reason}`;
    donationKeywords = visualAi.keywords || [];

    // AI Integration 3: Medicine Validation
    if (category === 'Medicine') {
      try {
        const ocr = await aiService.extractExpiry(imageUrl);
        if (ocr.isValid) {
          // Compare OCR date with user input expiry
          const userDate = new Date(expiryTime).toISOString().split('T')[0];
          // OCR might return various formats, but as a basic check:
          aiAnalysisReason += ` | OCR Found Expiry: ${ocr.expiryDate}`;
        } else {
          // Even if not found, we don't block strictly unless requested, but we flag it
          aiSafetyScore -= 20;
          aiAnalysisReason += ` | OCR Warning: ${ocr.message || 'No date found'}`;
        }
      } catch (err) {
        console.warn("OCR failed. AI Vision Analysis already performed.");
      }
    }

    const donation = new Donation({
      donorId: req.user.userId,
      title: title || 'Donation Items',
      category: category || 'Grocery',
      itemType: itemType || 'General',
      condition: condition || 'Good',
      imageUrl: imageUrl || '',
      quantity: quantity || '',
      description: description || '',
      expiryTime: expiryTime ? new Date(expiryTime) : null,
      foodPreparedTime: foodPreparedTime ? new Date(foodPreparedTime) : null,
      isSealed: !!isSealed,
      location: { lat: lat || 0, lng: lng || 0, address: address || '' },
      status: finalStatus,
      isExpired: false,
      aiSafetyScore,
      isVerifiedSafe,
      aiAnalysisReason,
      aiDetectedItems: category || 'General',
      // Legacy
      receiverId, orgName, postId,
    });

    await donation.save();
    // Increment stats
    if (user && user.stats) {
      user.stats.donationsMade += 1;
      await user.save();
    }
    // Populate donor info for response
    await donation.populate('donorId', 'name city profilePic');

    const responseObj = { ...donation.toObject(), aiKeywords: donationKeywords };
    res.status(201).json(responseObj);
  } catch (err) {
    console.error('Donation POST Error:', err.message);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
});

// ─── GET /api/donations/browse ─ Public listing with filters ─────────────
router.get('/browse', optionalAuth, async (req, res) => {
  try {
    const { category, maxKm, expiringSoon } = req.query;

    const query = { status: 'active', isExpired: false };
    if (category && category !== 'All') query.category = category;

    let donations = await Donation.find(query)
      .populate('donorId', 'name city')
      .sort({ expiryTime: 1 })
      .limit(100);

    // Distance filter
    const uLat = parseFloat(req.query.lat);
    const uLng = parseFloat(req.query.lng);
    if (!isNaN(uLat) && !isNaN(uLng)) {
      const km = parseFloat(maxKm) || 50;
      donations = donations.filter(d => {
        const dist = haversineKm(uLat, uLng, d.location.lat, d.location.lng);
        d._doc.distanceKm = Math.round(dist * 10) / 10;
        // Food must be within 5km
        if (d.category === 'Food' && dist > 5) return false;
        return dist <= km;
      });
    }

    // Expiring soon (next 2 hours)
    if (expiringSoon === 'true') {
      const cutoff = new Date(Date.now() + 2 * 3600 * 1000);
      donations = donations.filter(d => new Date(d.expiryTime) <= cutoff);
    }

    // Translation Integration
    const lang = req.query.lang || 'en';
    if (lang === 'ur') {
      donations = await Promise.all(donations.map(async d => {
        const trTitle = await aiService.translate(d.title, 'ur');
        const trDesc = await aiService.translate(d.description, 'ur');
        return { ...d._doc, title: trTitle.translatedText, description: trDesc.translatedText };
      }));
    } else {
      donations = donations.map(d => d._doc ? d._doc : d);
    }

    res.json(donations);
  } catch (err) {
    console.error('Browse Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/nearby ─ Map pins (nearby search) ────────────────
router.get('/nearby', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius = 10, category } = req.query;
    const uLat = parseFloat(lat);
    const uLng = parseFloat(lng);

    if (isNaN(uLat) || isNaN(uLng)) {
      return res.status(400).json({ error: 'lat and lng are required.' });
    }

    const query = { status: 'active', isExpired: false };
    if (category && category !== 'All') query.category = category;

    let donations = await Donation.find(query)
      .populate('donorId', 'name city')
      .limit(200);

    // AI Integration: Weather-Based Radius
    // Use a mock temp if not provided, or fetch from AI
    const temp = req.query.temp ? parseFloat(req.query.temp) : (await aiService.weatherInsights(uLat, uLng)).temperature;

    // Calculate radius dynamically using AI rule
    let appliedRadius = parseFloat(radius) || 50;
    let aiMessage = '';

    if (category === 'Food' || !category || category === 'All') {
      const radiusData = await aiService.getWeatherRadius('Food', temp);
      // Only restrict if the user requested radius is larger than the AI allowed radius
      if (radiusData.radiusKm < appliedRadius) {
        appliedRadius = radiusData.radiusKm;
        aiMessage = radiusData.message;
      }
    }

    donations = donations
      .map(d => {
        const dist = haversineKm(uLat, uLng, d.location.lat, d.location.lng);
        return { ...d._doc, distanceKm: Math.round(dist * 10) / 10 };
      })
      .filter(d => {
        // Apply AI dynamic radius constraint
        const itemMax = (d.category === 'Food') ? appliedRadius : parseFloat(radius) || 50;
        return d.distanceKm <= itemMax;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    // Translation Integration
    const lang = req.query.lang || 'en';
    if (lang === 'ur') {
      donations = await Promise.all(donations.map(async d => {
        const trTitle = await aiService.translate(d.title, 'ur');
        const trDesc = await aiService.translate(d.description, 'ur');
        return { ...d, title: trTitle.translatedText, description: trDesc.translatedText };
      }));
    }

    res.json({
      donations,
      aiStats: {
        appliedRadius,
        temperature: temp,
        message: aiMessage
      }
    });
  } catch (err) {
    console.error('Nearby Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/map ─ All active pins for map ────────────────────
router.get('/map', async (req, res) => {
  try {
    const donations = await Donation.find({ status: 'active', isExpired: false })
      .select('title category imageUrl expiryTime location aiSafetyScore donorId quantity')
      .populate('donorId', 'name city')
      .limit(500);
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/completed ─ Receiver completed list ──────────────
router.get('/completed', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'receiver') return res.status(403).json({ error: 'Not authorized' });
    const completed = await Donation.find({
      receiverId: req.user.userId,
      status: { $in: ['accepted', 'completed', 'delivered'] }
    }).populate('donorId', 'name email phone city profilePic').sort({ updatedAt: -1 });
    res.json(completed);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/incoming ─ Receiver pending ──────────────────────
router.get('/incoming', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'receiver') return res.status(403).json({ error: 'Not authorized' });
    const incoming = await Donation.find({
      receiverId: req.user.userId,
      status: 'pending_receiver'
    }).populate('donorId', 'name email phone').sort({ createdAt: -1 });
    res.json(incoming);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/ai-matched ─ Receiver sorted matches ───────────────
router.get('/ai-matched', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'receiver') return res.status(403).json({ error: 'Not authorized' });

    // Get user details
    const receiver = await User.findById(req.user.userId);

    // Get all active donations
    const donations = await Donation.find({ status: 'active', isExpired: false })
      .populate('donorId', 'name city profilePic')
      .limit(50);

    // Format to match AI service structure
    const items = donations.map(d => ({
      id: d._id.toString(),
      lat: d.location.lat,
      lng: d.location.lng,
      category: d.category,
      foodPreparedTime: d.foodPreparedTime,
      expiryTime: d.expiryTime,
      trustScore: d.aiSafetyScore / 20 // scale 0-100 to 0-5
    }));

    // receiver location (mocking if not available)
    const recLat = 24.8607; // Karachi default
    const recLng = 67.0011;

    // Call AI Service Match (Pass receiver lat/lng and items)
    const aiRes = await aiService.match(recLat, recLng, items);

    // Merge scores back
    const matchMap = {};
    aiRes.matches.forEach(m => matchMap[m.receiverId] = m);

    const sortedDonations = donations
      .map(d => ({
        ...d._doc,
        matchScore: matchMap[d._id.toString()]?.matchScore || 0,
        distanceKm: matchMap[d._id.toString()]?.distanceKm || 0
      }))
      .sort((a, b) => b.matchScore - a.matchScore); // Highest first

    // Translation Integration
    const lang = req.query.lang || 'en';
    if (lang === 'ur') {
      const translated = await Promise.all(sortedDonations.map(async d => {
        const trTitle = await aiService.translate(d.title, 'ur');
        const trDesc = await aiService.translate(d.description, 'ur');
        return { ...d, title: trTitle.translatedText, description: trDesc.translatedText };
      }));
      res.json(translated);
    } else {
      res.json(sortedDonations);
    }
  } catch (err) {
    console.error('AI Matched Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/my-history ─ Donor own donations ─────────────────
router.get('/my-history', authMiddleware, async (req, res) => {
  try {
    const donations = await Donation.find({ donorId: req.user.userId }).sort({ createdAt: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/my-donations ─ Donor with receiver info ───────────
router.get('/my-donations', authMiddleware, async (req, res) => {
  try {
    const donations = await Donation.find({ donorId: req.user.userId })
      .populate('receiverId', 'name email phone bio city profilePic orgType isVerified')
      .sort({ createdAt: -1 });
    res.json(donations);
  } catch (err) {
    console.error('my-donations Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/all ─ Admin: all donations ────────────────────────
router.get('/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const donations = await Donation.find()
      .populate('donorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── PUT /api/donations/:id/status ─ Accept/reject ───────────────────────
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (req.user.role !== 'admin' && donation.donorId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to update this donation' });
    }
    donation.status = status;
    await donation.save();
    res.json(donation);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── PUT /api/donations/:id/expire ─ Admin manual expire ─────────────────
router.put('/:id/expire', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status: 'expired', isExpired: true },
      { new: true }
    );
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    res.json(donation);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── DELETE /api/donations/:id ─ Admin/Donor delete ─────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    if (req.user.role !== 'admin' && donation.donorId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this donation' });
    }

    await Donation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Donation deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;

// ─── PUT /api/donations/:id/dispatch ─ Dispatch donation to receiver ───────────────────────
router.put('/:id/dispatch', authMiddleware, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const donation = await Donation.findById(req.params.id);

    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (req.user.role !== 'admin' && donation.donorId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to dispatch this donation' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

    donation.receiverId = receiver._id;
    donation.receiverDetails = {
      name: receiver.name,
      city: receiver.city || '',
      description: receiver.bio || receiver.email
    };
    donation.status = 'completed'; // per user requirements
    await donation.save();

    // Create a Request in DB for notification
    const RequestModel = require('../models/Request');
    const newRequest = new RequestModel({
      donationId: donation._id,
      receiverId: receiver._id,
      status: 'pending',
      message: `Donor ${req.user.name || 'someone'} dispatched a donation to you!`
    });
    await newRequest.save();

    res.json(donation);
  } catch (err) {
    console.error('Dispatch Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});
