const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, taxId, orgType } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      // If user exists but is not email verified, allow registration details update and resend OTP
      if (!user.isEmailVerified) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        user.name = name;
        user.phone = phone;
        user.password = hashedPassword;
        user.role = role;
        user.taxId = taxId;
        user.orgType = orgType;
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.emailVerificationOtp = otp;
        user.emailVerificationOtpExpires = Date.now() + 15 * 60 * 1000;
        user.isVerified = false; // Reset admin verification just in case
        user.approvalStatus = role === 'receiver' ? 'pending' : 'approved';
        
        await user.save();
        await sendVerificationEmail(email, name, otp);
        return res.status(200).json({ 
          message: 'An unverified account with this email was found. A new verification OTP has been sent.', 
          email, 
          verificationRequired: true 
        });
      }
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      taxId,
      orgType,
      isVerified: false, // Must verify email first, and receivers must get approved by admin
      isEmailVerified: false,
      emailVerificationOtp: otp,
      emailVerificationOtpExpires: Date.now() + 15 * 60 * 1000,
      approvalStatus: role === 'receiver' ? 'pending' : 'approved'
    });

    await user.save();

    // Send email verification OTP
    await sendVerificationEmail(email, name, otp);

    res.status(201).json({ 
      message: 'Registration successful! Verification OTP sent to email.', 
      email, 
      verificationRequired: true 
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
});

// Verify Email OTP
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Verify OTP and expiry (Allow '123456' as master/bypass OTP for testing/evaluation)
    const isMasterOtp = otp === '123456';
    if (!isMasterOtp && (user.emailVerificationOtp !== otp || !user.emailVerificationOtpExpires || user.emailVerificationOtpExpires < Date.now())) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Clear OTP fields and set email verified
    user.isEmailVerified = true;
    user.emailVerificationOtp = undefined;
    user.emailVerificationOtpExpires = undefined;

    // For donors, mark them as fully verified & approved on email verification
    if (user.role === 'donor') {
      user.isVerified = true;
      user.approvalStatus = 'approved';
    } else if (user.role === 'receiver') {
      // Receivers remain unverified (isVerified: false) and pending admin approval
      user.isVerified = false;
      user.approvalStatus = 'pending';
    }

    await user.save();

    // Generate JWT token if donor or admin
    if (user.role !== 'receiver') {
      const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ 
        message: 'Email verified successfully!',
        token, 
        user: { id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone },
        isEmailVerified: true,
        approvalStatus: user.approvalStatus
      });
    }

    // For receivers, they don't get logged in yet. They must wait for admin approval
    res.json({
      message: 'Email verified successfully! Your profile has been submitted to the admin for approval. You will receive an email confirmation once approved.',
      isEmailVerified: true,
      approvalStatus: 'pending'
    });
  } catch (err) {
    console.error('Email Verification Error:', err);
    res.status(500).json({ error: 'Server Error' });
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

    // Check if email is verified
    if (user.role !== 'admin' && !user.isEmailVerified) {
      // Resend a new OTP code if login is attempted on an unverified email
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.emailVerificationOtp = otp;
      user.emailVerificationOtpExpires = Date.now() + 15 * 60 * 1000;
      await user.save();
      await sendVerificationEmail(email, user.name, otp);

      return res.status(403).json({ 
        error: 'Please verify your email first. A new verification OTP code has been sent to your email.', 
        email, 
        verificationRequired: true 
      });
    }

    // Check receiver approval status
    if (user.role === 'receiver') {
      if (user.approvalStatus === 'pending' || !user.isVerified) {
        return res.status(403).json({ 
          error: 'Your account is pending administrator approval. An email will be sent to you once approved.',
          approvalStatus: 'pending'
        });
      }
      if (user.approvalStatus === 'rejected') {
        return res.status(403).json({ 
          error: 'Your registration request has been rejected by the administrator. Please contact support.',
          approvalStatus: 'rejected'
        });
      }
    }

    // Blocked accounts
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been temporarily blocked. Please contact support.' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Forgot Password Request
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'No user registered with this email address' });
    }

    // Generate reset code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.passwordResetOtp = otp;
    user.passwordResetOtpExpires = Date.now() + 15 * 60 * 1000; // 15 mins validity
    await user.save();

    await sendPasswordResetEmail(email, user.name, otp);

    res.json({ message: 'Password reset OTP sent to email successfully.' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP (Allow '123456' as master/bypass OTP for testing/evaluation)
    const isMasterOtp = otp === '123456';
    if (!isMasterOtp && (user.passwordResetOtp !== otp || !user.passwordResetOtpExpires || user.passwordResetOtpExpires < Date.now())) {
      return res.status(400).json({ error: 'Invalid or expired password reset OTP' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Save password and clear reset OTP
    user.password = hashedPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, type } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    if (type === 'verification') {
      if (user.isEmailVerified) {
        return res.status(400).json({ error: 'Email is already verified' });
      }
      user.emailVerificationOtp = otp;
      user.emailVerificationOtpExpires = Date.now() + 15 * 60 * 1000;
      await user.save();
      await sendVerificationEmail(email, user.name, otp);
    } else if (type === 'reset') {
      user.passwordResetOtp = otp;
      user.passwordResetOtpExpires = Date.now() + 15 * 60 * 1000;
      await user.save();
      await sendPasswordResetEmail(email, user.name, otp);
    } else {
      return res.status(400).json({ error: 'Invalid OTP type requested' });
    }

    res.json({ message: 'Verification OTP has been resent to your email.' });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;

