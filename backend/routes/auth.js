const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, taxId, orgType } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      taxId,
      orgType,
      isVerified: role === 'donor' // Donors auto-verified, Receivers need admin check
    });

    await user.save();

    // Create token
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
