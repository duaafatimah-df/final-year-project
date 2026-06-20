const express = require('express');
const jwt = require('jsonwebtoken');
const Donation = require('../models/Donation');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token is not valid' }); }
};

// POST /api/ratings — Either receiver rates donor OR donor rates receiver
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { donationId, rating, comment, feedback } = req.body;
    if (!donationId || rating == null) return res.status(400).json({ error: 'donationId and rating are required.' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });

    const donation = await Donation.findById(donationId);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    let targetUser = null;

    if (req.user.role === 'receiver') {
      // Receiver rating the donor
      donation.rating = rating;
      await donation.save();
      targetUser = await User.findById(donation.donorId);
    } else if (req.user.role === 'donor') {
      // Donor rating the receiver
      donation.donorRating = rating;
      await donation.save();
      targetUser = await User.findById(donation.receiverId || donation.claimedBy);
    } else {
      return res.status(403).json({ error: 'Not authorized to rate exchanges' });
    }

    // Update target partner's average rating
    if (targetUser) {
      const prevTotal = (targetUser.avgRating || 0) * (targetUser.ratingCount || 0);
      const newCount = (targetUser.ratingCount || 0) + 1;
      const newAvg = (prevTotal + rating) / newCount;
      targetUser.avgRating = Math.round(newAvg * 10) / 10;
      targetUser.ratingCount = newCount;

      // Flag if avg < 3.0
      if (newAvg < 3.0) {
        targetUser.flagCount = (targetUser.flagCount || 0) + 1;
        if (targetUser.flagCount >= 3) {
          targetUser.isBlocked = true;
        }
      }
      await targetUser.save();

      // Trigger NLP and multi-factor fraud detection asynchronously in the background so it doesn't block the response
      const { analyzeFraudRisk } = require('../utils/fraudAi');
      const reviewComment = comment || feedback || '';
      analyzeFraudRisk(
        targetUser._id,
        req.user.userId,
        donation._id,
        reviewComment,
        rating
      ).catch(fraudErr => {
        console.error('⚠️ Background Fraud analysis error:', fraudErr.message);
      });
    }

    res.json({ 
      message: 'Rating submitted successfully.', 
      rating, 
      partnerAvgRating: targetUser?.avgRating 
    });
  } catch (err) {
    console.error('Rating POST Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
