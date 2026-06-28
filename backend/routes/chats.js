const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Donation = require('../models/Donation');
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// GET all recent messages where the user is a participant (sender or receiver)
router.get('/all/recent', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(userId) },
            { receiverId: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$donationId',
          latestMessage: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latestMessage' }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    const populated = await Message.populate(messages, [
      { path: 'senderId', select: 'name role' },
      { path: 'receiverId', select: 'name role' },
      { path: 'donationId', select: 'title category donorId receiverId' }
    ]);

    res.json(populated);
  } catch (err) {
    console.error('Fetch Recent Messages Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET messages for a donation chat
router.get('/:donationId', authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.donationId);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    // Ensure user is authorized (must be donor or receiver)
    if (donation.donorId.toString() !== req.user.userId && 
        donation.receiverId?.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to view this chat' });
    }

    let query = { donationId: req.params.donationId };
    if (donation.receiverId) {
      query = {
        $or: [
          { donationId: req.params.donationId },
          { senderId: donation.donorId, receiverId: donation.receiverId },
          { senderId: donation.receiverId, receiverId: donation.donorId }
        ]
      };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .populate('senderId', 'name role');

    res.json(messages);
  } catch (err) {
    console.error('Fetch Messages Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST message in a donation chat
router.post('/:donationId', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const donation = await Donation.findById(req.params.donationId);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    // Determine sender and receiver
    const isDonor = donation.donorId.toString() === req.user.userId;
    const isReceiver = donation.receiverId?.toString() === req.user.userId;

    if (!isDonor && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to post to this chat' });
    }

    const senderId = req.user.userId;
    const receiverId = isDonor ? donation.receiverId : donation.donorId;

    if (!receiverId) {
      return res.status(400).json({ error: 'No receiver is assigned to this donation yet.' });
    }

    const newMessage = new Message({
      donationId: donation._id,
      senderId,
      receiverId,
      text: text.trim()
    });

    await newMessage.save();
    
    // Return message populated with sender details
    const populated = await Message.findById(newMessage._id).populate('senderId', 'name role');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Send Message Error:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
