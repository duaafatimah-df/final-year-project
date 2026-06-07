const express = require('express');
const jwt = require('jsonwebtoken');
const Donation = require('../models/Donation');
const User = require('../models/User');
const aiService = require('../utils/aiService');
const axios = require('axios');

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

function cleanToStandardCategory(cat) {
  if (!cat) return 'Other';
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
  return 'Other';
}

function isFoodCategory(cat) {
  return ['Food', 'Meat', 'Vegetables', 'Fruit', 'Dairy'].includes(cat);
}

const calculateTravelTimeMin = async (dLat, dLng, rLat, rLng, dist) => {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${dLat},${dLng}&destinations=${rLat},${rLng}&key=${googleKey.trim()}`;
      console.log("AXIOS TYPE:", typeof axios);
      const response = await axios.get(url, { timeout: 3000 });
      if (response.data?.status === 'OK' && response.data?.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const durationSec = response.data.rows[0].elements[0].duration.value;
        return durationSec / 60;
      }
    } catch (gErr) {
      console.warn("⚠️ Google Maps Distance Matrix API query failed, falling back to distance estimation:", gErr.message);
    }
  }
  return dist * 1.5;
};

// ─── Food/Medicine validation ─────────────────────────────────────────────
function validateDonation(category, expiryTime, foodPreparedTime, isSealed) {
  const now = new Date();

  if (isFoodCategory(category)) {
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

// ─── POST /api/donations/scan ─ Scan donation image via AI ────────────────
router.post('/scan', authMiddleware, async (req, res) => {
  try {
    const { imageUrl, category } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image is required for AI scan.' });
    }

    const visualAi = await aiService.analyzeItem(imageUrl, category);
    res.json(visualAi);
  } catch (err) {
    console.error('Scan Error:', err.message);
    res.status(500).json({ error: err.message || 'AI Scan Failed' });
  }
});

// ─── POST /api/donations ─ Create donation ────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title, category, itemType, condition, imageUrl, quantity, description,
      expiryTime, foodPreparedTime, isSealed,
      lat, lng, address,
      targetReceiverIds, // New: array of receiver IDs to notify
      aiSafetyScore: preAiSafetyScore,
      isVerifiedSafe: preIsVerifiedSafe,
      aiAnalysisReason: preAiAnalysisReason,
      classifiedCategory: preClassifiedCategory,
      receiverId, orgName, postId   // legacy fields
    } = req.body;

    const cleanCategoryInput = cleanToStandardCategory(category);

    // Block if no image
    if (!imageUrl) return res.status(400).json({ error: 'An image is required for the donation.' });

    // Validation
    const validationError = validateDonation(cleanCategoryInput, expiryTime, foodPreparedTime, isSealed);
    if (validationError) return res.status(400).json({ error: validationError });

    const donor = await User.findById(req.user.userId);
    const donorLat = (lat !== undefined && lat !== null && lat !== '') ? parseFloat(lat) : (donor?.location?.lat ?? null);
    const donorLng = (lng !== undefined && lng !== null && lng !== '') ? parseFloat(lng) : (donor?.location?.lng ?? null);

    // Direct Donation Travel limit safety check for Summer Food
    if (isFoodCategory(cleanCategoryInput) && isSummerNow()) {
      const targets = [];
      if (Array.isArray(targetReceiverIds)) {
        targets.push(...targetReceiverIds);
      } else if (targetReceiverIds) {
        targets.push(targetReceiverIds);
      }
      if (receiverId) {
        targets.push(receiverId);
      }

      for (const recId of targets) {
        const receiver = await User.findById(recId);
        if (receiver) {
          const recLat = receiver.location?.lat;
          const recLng = receiver.location?.lng;
          const resolvedRecLat = recLat !== undefined && recLat !== null ? recLat : null;
          const resolvedRecLng = recLng !== undefined && recLng !== null ? recLng : null;
          
          let distance = 0;
          let travelTimeMin = 0;
          if (donorLat !== null && donorLng !== null && resolvedRecLat !== null && resolvedRecLng !== null) {
            distance = haversineKm(donorLat, donorLng, resolvedRecLat, resolvedRecLng);
            travelTimeMin = await calculateTravelTimeMin(donorLat, donorLng, resolvedRecLat, resolvedRecLng, distance);
          }

          // Discard or block if exceeds 20 minutes
          const isMissingOrZero = recLat === undefined || recLat === null || recLng === undefined || recLng === null || (recLat === 0 && recLng === 0) || donorLat === null || donorLng === null;
          if (!isMissingOrZero && travelTimeMin > 20) {
            return res.status(400).json({
              error: `Summer Food Safety Validation failed. Travel time to receiver '${receiver.name}' is estimated at ${Math.round(travelTimeMin)} minutes, which exceeds the safe 20-minute limit. High temperatures make transport unsafe.`
            });
          }
        }
      }
    }

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
      itemAi = await aiService.predictExpiry(cleanCategoryInput, condition, foodPreparedTime, temp);
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
    let finalCategory = cleanCategoryInput || 'Food';

    // If pre-analyzed AI parameters are passed, use them!
    if (preAiSafetyScore !== undefined) {
      aiSafetyScore = preAiSafetyScore;
      isVerifiedSafe = !!preIsVerifiedSafe;
      aiAnalysisReason = preAiAnalysisReason || aiAnalysisReason;
      finalCategory = cleanToStandardCategory(
        (preClassifiedCategory && preClassifiedCategory !== 'Other')
          ? preClassifiedCategory
          : (category || 'Other')
      );
      
      if (aiSafetyScore >= 70) {
        finalStatus = (targetReceiverIds && targetReceiverIds.length > 0) || receiverId ? 'pending_receiver' : 'active';
      } else if (aiSafetyScore >= 50) {
        finalStatus = 'needs_review';
      } else {
        finalStatus = 'rejected';
      }
    } else {
      // Universal Image Analysis fallback if not pre-scanned
      const visualAi = await aiService.analyzeItem(imageUrl, cleanCategoryInput);
      aiSafetyScore = visualAi.safetyScore !== undefined ? visualAi.safetyScore : 60;
      isVerifiedSafe = visualAi.safetyScore >= 70;
      aiAnalysisReason += ` | AI Vision Analysis: ${visualAi.reason}`;
      donationKeywords = visualAi.keywords || [];
      const aiCat = visualAi.classifiedCategory;
      finalCategory = cleanToStandardCategory(
        (aiCat && aiCat !== 'Other') ? aiCat : (category || 'Other')
      );

      if (aiSafetyScore >= 70) {
        finalStatus = (targetReceiverIds && targetReceiverIds.length > 0) || receiverId ? 'pending_receiver' : 'active';
      } else if (aiSafetyScore >= 50) {
        finalStatus = 'needs_review';
      } else {
        finalStatus = 'rejected';
      }
    }

    // AI Integration 3: Medicine Validation
    if (finalCategory === 'Medicine') {
      try {
        const ocr = await aiService.extractExpiry(imageUrl);
        if (ocr.isValid) {
          aiAnalysisReason += ` | OCR Found Expiry: ${ocr.expiryDate}`;
          if (ocr.mfgDate) {
            aiAnalysisReason += `, MFG: ${ocr.mfgDate}`;
          }
        } else {
          // If it's a critical safety error, reject the donation
          if (ocr.message && (ocr.message.includes('expired') || ocr.message.includes('future') || ocr.message.includes('before the manufacturing'))) {
            return res.status(400).json({ error: `Medicine Safety Validation failed: ${ocr.message}` });
          }
          aiSafetyScore -= 20;
          aiAnalysisReason += ` | OCR Warning: ${ocr.message || 'No date found'}`;
        }
      } catch (err) {
        console.warn("OCR failed. AI Vision Analysis already performed.");
      }
    }

    // Re-validate using the final AI-reconciled category
    const postValidationError = validateDonation(finalCategory, expiryTime, foodPreparedTime, isSealed);
    if (postValidationError) return res.status(400).json({ error: postValidationError });

    const donation = new Donation({
      donorId: req.user.userId,
      title: title || 'Donation Items',
      category: finalCategory,
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
      aiDetectedItems: finalCategory,
      // Legacy
      receiverId: (targetReceiverIds && targetReceiverIds.length === 1) ? targetReceiverIds[0] : receiverId,
      orgName, postId,
    });

    await donation.save();

    // Notify target receivers
    let autoMatchedCount = 0;
    const Notification = require('../models/Notification');
    
    // Format full details including Quantity, AI Analysis, Location and Expiry
    const notificationMessage = `Donation Title: ${donation.title}
Category: ${donation.category}
Quantity: ${donation.quantity || 'N/A'}
AI Analysis: [Safety Score: ${donation.aiSafetyScore}%] ${donation.aiAnalysisReason}
Location: ${donation.location?.address || 'N/A'}
Expiry: ${donation.expiryTime ? new Date(donation.expiryTime).toLocaleString('en-PK') : 'N/A'}`;

    if (targetReceiverIds && targetReceiverIds.length > 0) {
      for (const recId of targetReceiverIds) {
        const newNotif = new Notification({
          donorId: req.user.userId,
          receiverId: recId,
          donationId: donation._id,
          title: 'Direct Donation Offered!',
          message: notificationMessage,
          status: 'pending'
        });
        await newNotif.save();
        autoMatchedCount++;
      }
    } else {
      // Background Auto-Match & Notify fallback if targetReceiverIds not provided (e.g. older flow/API)
      try {
        const Post = require('../models/Post');
        const activePosts = await Post.find({ status: 'Active' }).populate('receiverId');

        let matchedPosts = activePosts.filter(p => (p.category || '').toLowerCase() === finalCategory.toLowerCase());

        // Strict hot weather travel limit for Food
        if (isFoodCategory(finalCategory) && temp > 30) {
          matchedPosts = matchedPosts.filter(p => {
            const recLat = p.receiverId?.location?.lat || 24.8607;
            const recLng = p.receiverId?.location?.lng || 67.0011;
            const dist = haversineKm(lat, lng, recLat, recLng);
            return dist <= 10;
          });
        }

        // Notify matching receivers
        for (const post of matchedPosts) {
          if (post.receiverId) {
            const newNotif = new Notification({
              donorId: req.user.userId,
              receiverId: post.receiverId._id || post.receiverId,
              donationId: donation._id,
              title: 'AI Matched Donation Demand!',
              message: notificationMessage,
              status: 'pending'
            });
            await newNotif.save();
            autoMatchedCount++;
          }
        }
      } catch (matchErr) {
        console.error('❌ Auto-matching error:', matchErr.message);
      }
    }

    // Increment stats
    if (user && user.stats) {
      user.stats.donationsMade += 1;
      await user.save();
    }
    
    // Populate donor info for response
    await donation.populate('donorId', 'name city profilePic');

    const responseObj = { 
      ...donation.toObject(), 
      aiKeywords: donationKeywords,
      temperature: temp,
      autoMatchedCount
    };
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
        try {
          const trTitle = await aiService.translate(d.title, 'ur');
          const trDesc = await aiService.translate(d.description, 'ur');
          return { ...d._doc, title: trTitle.translatedText, description: trDesc.translatedText };
        } catch (trErr) {
          console.warn("Donation browse translation failed:", trErr.message);
          return d._doc || d;
        }
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
        try {
          const trTitle = await aiService.translate(d.title, 'ur');
          const trDesc = await aiService.translate(d.description, 'ur');
          return { ...d, title: trTitle.translatedText, description: trDesc.translatedText };
        } catch (trErr) {
          console.warn("Donation nearby translation failed:", trErr.message);
          return d;
        }
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
      .populate('donorId', 'name email phone city profilePic location')
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

    // receiver location
    const recLat = receiver?.location?.lat !== undefined && receiver?.location?.lat !== null ? receiver.location.lat : null;
    const recLng = receiver?.location?.lng !== undefined && receiver?.location?.lng !== null ? receiver.location.lng : null;

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
        try {
          const trTitle = await aiService.translate(d.title, 'ur');
          const trDesc = await aiService.translate(d.description, 'ur');
          return { ...d, title: trTitle.translatedText, description: trDesc.translatedText };
        } catch (trErr) {
          console.warn("Donation ai-matched translation failed:", trErr.message);
          return d;
        }
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

// ─── POST /api/donations/match-suggestions ─ AI Suggestion matching engine ─────────────────
router.post('/match-suggestions', authMiddleware, async (req, res) => {
  try {
    const { category, lat, lng, title, description, keywords, directReceiverId } = req.body;
    const donor = await User.findById(req.user.userId);
    const donorLat = (lat !== undefined && lat !== null && lat !== '') ? parseFloat(lat) : (donor?.location?.lat ?? null);
    const donorLng = (lng !== undefined && lng !== null && lng !== '') ? parseFloat(lng) : (donor?.location?.lng ?? null);

    const Post = require('../models/Post');

    // If direct receiver donation, bypass suggestions list and return single direct target details
    if (directReceiverId) {
      const receiver = await User.findById(directReceiverId).select('name email phone location bio city profilePic orgType isVerified');
      if (!receiver) {
        return res.status(404).json({ error: 'Selected receiver not found' });
      }

      const recLat = receiver.location?.lat;
      const recLng = receiver.location?.lng;
      const resolvedRecLat = recLat !== undefined && recLat !== null ? recLat : null;
      const resolvedRecLng = recLng !== undefined && recLng !== null ? recLng : null;

      let distance = 0;
      let travelTimeMin = 0;
      if (donorLat !== null && donorLng !== null && resolvedRecLat !== null && resolvedRecLng !== null) {
        distance = haversineKm(donorLat, donorLng, resolvedRecLat, resolvedRecLng);
        travelTimeMin = await calculateTravelTimeMin(donorLat, donorLng, resolvedRecLat, resolvedRecLng, distance);
      }

      const isFood = isFoodCategory(category);
      const isSummer = isSummerNow();
      let passedSafety = true;
      if (isFood && isSummer) {
        const isMissingOrZero = recLat === undefined || recLat === null || recLng === undefined || recLng === null || (recLat === 0 && recLng === 0) || donorLat === null || donorLng === null;
        passedSafety = isMissingOrZero || (travelTimeMin <= 20);
      }

      return res.json({
        directReceiver: {
          receiver,
          distanceKm: Math.round(distance * 10) / 10,
          travelTimeMin: Math.round(travelTimeMin),
          passedSafety
        }
      });
    }

    // Helper to calculate relevance score between donation title and post title/desc with AI keywords
    const calculateRelevanceScore = (donTitle, postTitle, postDesc, aiKeywords = []) => {
      const cleanDon = (donTitle || '').toLowerCase();
      const cleanPostTitle = (postTitle || '').toLowerCase();
      const cleanPostDesc = (postDesc || '').toLowerCase();

      let score = 0;

      // 1. Direct substring check
      if (cleanDon && (cleanPostTitle.includes(cleanDon) || cleanPostDesc.includes(cleanDon))) {
        score += 100; // Big bonus for exact keyword match
      }
      if (cleanPostTitle && (cleanDon.includes(cleanPostTitle) || cleanDon.includes(cleanPostDesc))) {
        score += 100;
      }

      // 2. AI Keywords check
      if (Array.isArray(aiKeywords) && aiKeywords.length > 0) {
        aiKeywords.forEach(kw => {
          const cleanKw = kw.toLowerCase();
          if (cleanPostTitle.includes(cleanKw) || cleanPostDesc.includes(cleanKw)) {
            score += 80;
          }
        });
      }

      // 3. Semantic association mapping
      const associations = [
        {
          keywords: ['pizza', 'burger', 'sandwich', 'fries', 'nuggets', 'fast food', 'fast-food', 'shawarma', 'roll', 'samosa', 'pasta'],
          matches: ['fast food', 'fastfood', 'fast-food', 'pizza', 'burger', 'samosa', 'roll', 'sandwich', 'fries', 'street food', 'hot dog']
        },
        {
          keywords: ['biryani', 'rice', 'pulao', 'chawal'],
          matches: ['biryani', 'rice', 'pulao', 'chawal', 'cooked food', 'box biryani', 'food box']
        },
        {
          keywords: ['meat', 'chicken', 'beef', 'mutton', 'karahi', 'kebab', 'tikka'],
          matches: ['meat', 'chicken', 'beef', 'mutton', 'qurbani', 'karahi', 'orphanage meat', 'cooked meat']
        },
        {
          keywords: ['veg', 'vegetable', 'vegetables', 'potato', 'onion', 'tomato', 'sabzi', 'aloo'],
          matches: ['vegetable', 'vegetables', 'potato', 'onion', 'tomato', 'sabzi', 'aloo', 'salad', 'fresh veg']
        },
        {
          keywords: ['fruit', 'fruits', 'apple', 'banana', 'orange', 'mango'],
          matches: ['fruit', 'fruits', 'apple', 'banana', 'orange', 'mango', 'fresh fruit']
        },
        {
          keywords: ['cloth', 'clothes', 'shirt', 'pants', 'tshirt', 'dress'],
          matches: ['cloth', 'clothes', 'clothing', 'garments', 'winter clothes']
        },
        {
          keywords: ['med', 'medicine', 'medicines', 'tablet', 'capsule', 'syrup'],
          matches: ['med', 'medicine', 'medicines', 'health', 'tablet', 'capsule']
        }
      ];

      for (const assoc of associations) {
        const hasDonKeyword = assoc.keywords.some(kw => cleanDon.includes(kw)) ||
                              (Array.isArray(aiKeywords) && aiKeywords.some(kw => assoc.keywords.includes(kw.toLowerCase())));
        if (hasDonKeyword) {
          const hasPostMatch = assoc.matches.some(m => cleanPostTitle.includes(m) || cleanPostDesc.includes(m));
          if (hasPostMatch) {
            score += 50; // Semantic association bonus
          }
        }
      }

      // 4. Simple word overlap (excluding common stop words)
      const stopWords = ['need', 'items', 'item', 'food', 'want', 'please', 'required', 'donation', 'donations'];
      const donWords = cleanDon.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
      const postWords = `${cleanPostTitle} ${cleanPostDesc}`.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

      donWords.forEach(dw => {
        postWords.forEach(pw => {
          if (pw === dw) {
            score += 10;
          }
        });
      });

      return score;
    };

    // 1. Fetch all active receiver demand posts
    const activePosts = await Post.find({ status: 'Active' }).populate('receiverId', 'name email phone location');
    const validActivePosts = activePosts.filter(post => post.receiverId);

    // 2. Perform distance filtering (Food Safety Travel range check: 10-20 mins)
    const isFood = isFoodCategory(category);
    const isSummer = isSummerNow();

    const mappedMatches = await Promise.all(validActivePosts.map(async post => {
      const recLat = post.receiverId?.location?.lat;
      const recLng = post.receiverId?.location?.lng;
      
      const resolvedRecLat = recLat !== undefined && recLat !== null ? recLat : null;
      const resolvedRecLng = recLng !== undefined && recLng !== null ? recLng : null;
      
      let distance = 0;
      let travelTimeMin = 0;
      if (donorLat !== null && donorLng !== null && resolvedRecLat !== null && resolvedRecLng !== null) {
        distance = haversineKm(donorLat, donorLng, resolvedRecLat, resolvedRecLng);
        travelTimeMin = await calculateTravelTimeMin(donorLat, donorLng, resolvedRecLat, resolvedRecLng, distance);
      }
      return { post, distance, travelTimeMin, recLat, recLng };
    }));

    let filteredMatches = mappedMatches;
    if (isFood && isSummer) {
      filteredMatches = mappedMatches.filter(m => {
        const isMissingOrZero = m.recLat === undefined || m.recLat === null || m.recLng === undefined || m.recLng === null || (m.recLat === 0 && m.recLng === 0) || donorLat === null || donorLng === null;
        const passed = isMissingOrZero || (m.travelTimeMin <= 20);
        
        console.log({
          postTitle: m.post.title,
          category: m.post.category,
          receiverName: m.post.receiverId?.name,
          donorLat: donorLat,
          donorLng: donorLng,
          receiverLat: m.recLat,
          receiverLng: m.recLng,
          distanceKm: m.distance,
          travelTimeMin: m.travelTimeMin,
          passedFilter: passed,
          note: "SUMMER SAFETY FILTER ACTIVE (FOOD)"
        });
        return passed;
      });
    } else {
      mappedMatches.forEach(m => {
        console.log({
          postTitle: m.post.title,
          category: m.post.category,
          receiverName: m.post.receiverId?.name,
          donorLat: donorLat,
          donorLng: donorLng,
          receiverLat: m.recLat,
          receiverLng: m.recLng,
          distanceKm: m.distance,
          travelTimeMin: m.travelTimeMin,
          passedFilter: true,
          note: "NO TRAVEL FILTER (NOT SUMMER OR NOT FOOD)"
        });
      });
    }

    // 3. Score & Classify matching priority levels
    const results = [];
    filteredMatches.forEach(m => {
      let priority = 3; // default fallback priority
      const postCat = (m.post.category || '').toLowerCase();
      const donCat = (category || '').toLowerCase();

      if (postCat === donCat) {
        priority = 1; // Exact match
      } else if (
        (['meat', 'vegetables', 'fruit', 'dairy'].includes(donCat) && postCat === 'food') ||
        (donCat === 'food' && ['meat', 'vegetables', 'fruit', 'dairy'].includes(postCat))
      ) {
        priority = 2; // Category match
      }

      const relevanceScore = calculateRelevanceScore(title, m.post.title, m.post.description || m.post.desc, keywords || []);
      if (relevanceScore > 0 && priority === 3) {
        priority = 2; // Upgrade priority if semantic matching has matches
      }

      if (priority === 1 || priority === 2) {
        results.push({
          ...m.post.toObject(),
          distanceKm: Math.round(m.distance * 10) / 10,
          travelTimeMin: Math.round(m.travelTimeMin),
          priority,
          relevanceScore
        });
      }
    });

    // Sort by:
    // 1. Relevance Score (highest score first)
    // 2. Priority (1 then 2)
    // 3. Distance (closest first)
    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.distanceKm - b.distanceKm;
    });

    // Temporary diagnostic logging
    console.log("=================================================");
    console.log("MATCH SUGGESTIONS ROUTE DIAGNOSTICS");
    console.log("Category scanned by AI:", category);
    console.log("Total active receiver posts found in DB:", activePosts.length);
    console.log("Total matches mapped:", mappedMatches.length);
    console.log("Total matches after travel time filtering:", filteredMatches.length);
    console.log("Final suggestions returned:", results.length);
    console.log("=================================================");

    // 4. Fallback NGOs if no matches found
    let fallbackNGOs = [];
    if (results.length === 0) {
      const ngos = await User.find({ role: 'receiver', isVerified: true, approvalStatus: 'approved' }).select('name email phone location');
      
      const ngoMatches = await Promise.all(ngos.map(async ngo => {
        const recLat = ngo.location?.lat !== undefined && ngo.location?.lat !== null ? ngo.location.lat : null;
        const recLng = ngo.location?.lng !== undefined && ngo.location?.lng !== null ? ngo.location.lng : null;
        
        let distance = 0;
        let travelTimeMin = 0;
        if (donorLat !== null && donorLng !== null && recLat !== null && recLng !== null) {
          distance = haversineKm(donorLat, donorLng, recLat, recLng);
          travelTimeMin = await calculateTravelTimeMin(donorLat, donorLng, recLat, recLng, distance);
        }
        return {
          ngo,
          distanceKm: Math.round(distance * 10) / 10,
          travelTimeMin: Math.round(travelTimeMin),
          recLat,
          recLng
        };
      }));

      fallbackNGOs = ngoMatches;
      if (isFood && isSummer) {
        fallbackNGOs = fallbackNGOs.filter(f => {
          const isMissingOrZero = f.recLat === undefined || f.recLat === null || f.recLng === undefined || f.recLng === null || (f.recLat === 0 && f.recLng === 0) || donorLat === null || donorLng === null;
          return isMissingOrZero || f.travelTimeMin <= 20;
        });
      }
      fallbackNGOs.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    res.json({
      matches: results,
      fallbackNGOs
    });

  } catch (err) {
    console.error('Match Suggestions Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/donations/all ─ Admin: all donations ────────────────────────
router.get('/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const donations = await Donation.find()
      .select('-imageUrl')
      .populate('donorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(donations);
  } catch (err) {
    console.error('All Donations Error:', err);
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
    donation.status = 'pending_receiver'; // pending receiver acceptance claim
    await donation.save();

    // Create a real-time Notification in DB if not already exists
    const Notification = require('../models/Notification');
    const existingNotif = await Notification.findOne({ donationId: donation._id, receiverId: receiver._id });
    if (!existingNotif) {
      const newNotif = new Notification({
        donorId: donation.donorId,
        receiverId: receiver._id,
        donationId: donation._id,
        title: 'Direct Donation Offered!',
        message: `Donor ${req.user.name || 'someone'} offered you a direct donation: '${donation.title}'!`,
        status: 'pending'
      });
      await newNotif.save();
    }

    // Create a Request in DB for legacy compatibility
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
