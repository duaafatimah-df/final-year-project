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

// POST /api/ratings — Receiver rates a donor after pickup
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'receiver') return res.status(403).json({ error: 'Only receivers can rate donations' });

    const { donationId, rating } = req.body;
    if (!donationId || rating == null) return res.status(400).json({ error: 'donationId and rating are required.' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });

    const donation = await Donation.findById(donationId);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    // Save rating to donation
    donation.rating = rating;
    await donation.save();

    // Update donor's average rating
    const donor = await User.findById(donation.donorId);
    if (donor) {
      const prevTotal = (donor.avgRating || 0) * (donor.ratingCount || 0);
      const newCount = (donor.ratingCount || 0) + 1;
      const newAvg = (prevTotal + rating) / newCount;
      donor.avgRating = Math.round(newAvg * 10) / 10;
      donor.ratingCount = newCount;

      // Flag donor if avg < 3.0
      if (newAvg < 3.0) {
        donor.flagCount = (donor.flagCount || 0) + 1;
        // Auto-block if flagCount >= 3
        if (donor.flagCount >= 3) {
          donor.isBlocked = true;
        }
      }
      await donor.save();
    }

    res.json({ message: 'Rating submitted successfully.', rating, donorAvgRating: donor?.avgRating });
  } catch (err) {
    console.error('Rating POST Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
