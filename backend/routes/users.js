const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Donation = require('../models/Donation');

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
    const { name, phone, bio, city, profilePic, profileBanner } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (city !== undefined) user.city = city;
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
    const pendingReceivers = await User.find({ role: 'receiver', isVerified: false }).select('-password');
    res.json(pendingReceivers);
  } catch { res.status(500).send('Server Error'); }
});

// GET /api/users/all — admin: all users
router.get('/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch { res.status(500).send('Server Error'); }
});

// PUT /api/users/:id/verify — admin verify NGO
router.put('/:id/verify', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isVerified = true;
    await user.save();
    res.json({ message: 'User verified successfully', user });
  } catch { res.status(500).send('Server Error'); }
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
