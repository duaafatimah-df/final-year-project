const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Donation = require('../models/Donation');
const { sendApprovalEmail, sendRejectionEmail } = require('../utils/emailService');


const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token is not valid' }); }
};

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch { res.status(500).send('Server Error'); }
});

// PUT /api/users/me
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name, phone, bio, city, profilePic, profileBanner, address, lat, lng } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Validation during profile save: address, lat, and lng are required
    if (address === undefined || address === null || String(address).trim() === '') {
      return res.status(400).json({ error: 'Full Street Address is required' });
    }
    if (lat === undefined || lat === null || lat === '' || isNaN(parseFloat(lat))) {
      return res.status(400).json({ error: 'Latitude is required and must be a valid number' });
    }
    if (lng === undefined || lng === null || lng === '' || isNaN(parseFloat(lng))) {
      return res.status(400).json({ error: 'Longitude is required and must be a valid number' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (city !== undefined) user.city = city;

    user.location = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address: String(address).trim()
    };
    if (profilePic !== undefined) user.profilePic = profilePic;
    if (profileBanner !== undefined) user.profileBanner = profileBanner;
    await user.save();
    const updatedUser = user.toObject();
    delete updatedUser.password;
    res.json(updatedUser);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// GET /api/users/receivers — verified receivers (public)
router.get('/receivers', async (req, res) => {
  try {
    const receivers = await User.find({ role: 'receiver', isVerified: true }).select('-password');
    res.json(receivers);
  } catch { res.status(500).send('Server Error'); }
});

// GET /api/users/donors
router.get('/donors', authMiddleware, async (req, res) => {
  try {
    const donors = await User.find({ role: 'donor' }).select('-password');
    res.json(donors);
  } catch { res.status(500).send('Server Error'); }
});

// GET /api/users/org/:id — public org profile + posts
router.get('/org/:id', async (req, res) => {
  try {
    const org = await User.findById(req.params.id).select('-password');
    if (!org || org.role !== 'receiver') return res.status(404).json({ error: 'Organization not found' });
    const posts = await Post.find({ receiverId: req.params.id }).sort({ createdAt: -1 });
    res.json({ org, posts });
  } catch { res.status(500).send('Server Error'); }
});

// GET /api/users/pending — admin: pending receivers
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const pendingReceivers = await User.find({ role: 'receiver', isVerified: false, isEmailVerified: true, approvalStatus: 'pending' }).select('-password');
    res.json(pendingReceivers);
  } catch { res.status(500).send('Server Error'); }
});

// GET /api/users/admin-stats — admin stats & charts
router.get('/admin-stats', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });

    const totalUsers = await User.countDocuments();
    const verifiedNGOs = await User.countDocuments({ role: 'receiver', isVerified: true });
    const pendingNGOs = await User.countDocuments({ role: 'receiver', isVerified: false, isEmailVerified: true, approvalStatus: 'pending' });
    
    // Check if Report model is available
    const Report = require('../models/Report');
    const activeReports = await Report.countDocuments({ status: 'pending' });

    // Last 7 days dynamic chart data
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const chartData = [];

    // Import other models for counting
    const Request = require('../models/Request');

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const name = days[d.getDay()];

      const regCount = await User.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
      const donCount = await Donation.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
      const reqCount = await Request.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
      const claimCount = await Donation.countDocuments({ 
        status: { $in: ['accepted', 'completed', 'delivered'] },
        updatedAt: { $gte: d, $lt: nextD }
      });
      const approvalCount = await User.countDocuments({
        role: 'receiver',
        approvalStatus: 'approved',
        updatedAt: { $gte: d, $lt: nextD }
      });

      chartData.push({
        name,
        registrations: regCount,
        donations: donCount,
        approvals: approvalCount,
        requests: reqCount,
        receiverActivity: reqCount + claimCount,
        claims: claimCount
      });
    }

    res.json({
      stats: {
        totalUsers,
        verifiedNGOs,
        pendingNGOs,
        activeReports
      },
      weeklyData: chartData
    });
  } catch (err) {
    console.error('Admin Stats Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/users/all — admin: all users
router.get('/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(500);
    res.json(users);
  } catch (err) {
    console.error('All Users Error:', err);
    res.status(500).send('Server Error');
  }
});

// PUT /api/users/:id/verify — admin verify NGO (Approve)
router.put('/:id/verify', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isVerified = true;
    user.approvalStatus = 'approved';
    await user.save();
    
    // Trigger real-time email notification
    await sendApprovalEmail(user.email, user.name);

    res.json({ message: 'User verified and approved successfully', user });
  } catch (err) { 
    console.error('Verify Error:', err);
    res.status(500).send('Server Error'); 
  }
});

// PUT /api/users/:id/reject — admin reject NGO
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.isVerified = false;
    user.approvalStatus = 'rejected';
    await user.save();

    // Trigger real-time email notification
    await sendRejectionEmail(user.email, user.name);

    res.json({ message: 'User rejected successfully', user });
  } catch (err) {
    console.error('Reject Error:', err);
    res.status(500).send('Server Error');
  }
});


// PUT /api/users/:id/block — admin block user
router.put('/:id/block', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User blocked', user });
  } catch { res.status(500).send('Server Error'); }
});

// PUT /api/users/:id/unblock — admin unblock user
router.put('/:id/unblock', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false, flagCount: 0 }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User unblocked', user });
  } catch { res.status(500).send('Server Error'); }
});

// DELETE /api/users/:id — admin delete user
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch { res.status(500).send('Server Error'); }
});

module.exports = router;
