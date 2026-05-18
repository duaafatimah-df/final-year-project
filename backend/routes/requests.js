const express = require('express');
const jwt = require('jsonwebtoken');
const Request = require('../models/Request');
const Donation = require('../models/Donation');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token is not valid' }); }
};

// POST /api/requests — Receiver requests a donation
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'receiver') return res.status(403).json({ error: 'Only receivers can request donations' });
    const { donationId, message } = req.body;

    // Check donation is still active
    const donation = await Donation.findById(donationId);
    if (!donation || donation.status !== 'active') {
      return res.status(400).json({ error: 'Donation is no longer available.' });
    }

    // Check if already requested
    const existing = await Request.findOne({ donationId, receiverId: req.user.userId });
    if (existing) return res.status(400).json({ error: 'You already requested this donation.' });

    const request = new Request({
      donationId,
      receiverId: req.user.userId,
      message: message || ''
    });
    await request.save();
    res.status(201).json(request);
  } catch (err) {
    console.error('Request POST Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/requests/my-requests — Receiver's own requests
router.get('/my-requests', authMiddleware, async (req, res) => {
  try {
    const requests = await Request.find({ receiverId: req.user.userId })
      .populate({
        path: 'donationId',
        populate: { path: 'donorId', select: 'name email phone' }
      })
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/requests/for-my-donations — Donor sees requests on their donations
router.get('/for-my-donations', authMiddleware, async (req, res) => {
  try {
    const myDonations = await Donation.find({ donorId: req.user.userId }).select('_id');
    const ids = myDonations.map(d => d._id);
    const requests = await Request.find({ donationId: { $in: ids } })
      .populate('donationId', 'title category imageUrl expiryTime')
      .populate('receiverId', 'name email phone orgType')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// PUT /api/requests/:id/status — Donor approves/rejects a request
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    const request = await Request.findById(req.params.id).populate('donationId');
    if (!request) return res.status(404).json({ error: 'Request not found' });

    // Verify ownership
    if (String(request.donationId.donorId) !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    request.status = status;
    await request.save();

    // If approved → mark donation as completed
    if (status === 'approved') {
      await Donation.findByIdAndUpdate(request.donationId._id, { status: 'completed' });
    }

    res.json(request);
  } catch (err) {
    console.error('Request status Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/requests/all — Admin view all requests
router.get('/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const requests = await Request.find()
      .populate('donationId', 'title category')
      .populate('receiverId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
