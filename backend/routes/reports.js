const express = require('express');
const jwt = require('jsonwebtoken');
const Report = require('../models/Report');
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

// POST /api/reports — Submit a report
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { donationId, reason, details } = req.body;
    if (!donationId || !reason) return res.status(400).json({ error: 'donationId and reason are required.' });

    const report = new Report({
      donationId,
      reporterId: req.user.userId,
      reason,
      details: details || ''
    });
    await report.save();

    // Increment report count on donation
    const donation = await Donation.findByIdAndUpdate(
      donationId,
      { $inc: { reportCount: 1 } },
      { new: true }
    );

    // Auto-action: if 3+ reports → flag donor
    if (donation && donation.reportCount >= 3) {
      await User.findByIdAndUpdate(donation.donorId, { $inc: { flagCount: 1 } });
      // Auto-block donor if flagCount >= 3
      const donor = await User.findById(donation.donorId);
      if (donor && donor.flagCount >= 3) {
        await User.findByIdAndUpdate(donation.donorId, { isBlocked: true });
      }
    }

    res.status(201).json({ message: 'Report submitted successfully.', report });
  } catch (err) {
    console.error('Report POST Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/reports — Admin: all reports
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const reports = await Report.find()
      .populate('donationId', 'title category status')
      .populate('reporterId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// PUT /api/reports/:id/review — Admin reviews a report
router.put('/:id/review', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const { status, adminNote } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, adminNote },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
