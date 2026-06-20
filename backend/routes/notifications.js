const express = require('express');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const Donation = require('../models/Donation');
const User = require('../models/User');
const aiService = require('../utils/aiService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware
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

// ─── GET /api/notifications ────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const query = { receiverId: req.user.userId };
    if (req.query.status) {
      query.status = req.query.status;
    }
    let notifications = await Notification.find(query)
      .populate('donorId', 'name city profilePic email phone location')
      .populate('donationId')
      .sort({ createdAt: -1 });

    const lang = req.query.lang || 'en';
    if (lang === 'ur') {
      const notificationsToTranslate = notifications.slice(0, 20);
      const remainingNotifications = notifications.slice(20);

      const translated = await Promise.all(notificationsToTranslate.map(async (n) => {
        try {
          const trTitle = await aiService.translate(n.title, 'ur');
          const trMsg = await aiService.translate(n.message, 'ur');
          const nObj = n.toObject();
          if (nObj.donationId) {
            const trDonTitle = await aiService.translate(nObj.donationId.title, 'ur');
            const trDonDesc = await aiService.translate(nObj.donationId.description, 'ur');
            nObj.donationId.title = trDonTitle.translatedText;
            nObj.donationId.description = trDonDesc.translatedText;
          }
          return {
            ...nObj,
            title: trTitle.translatedText,
            message: trMsg.translatedText
          };
        } catch (trErr) {
          console.warn("Notification translation failed:", trErr.message);
          return n.toObject();
        }
      }));
      notifications = [...translated, ...remainingNotifications.map(n => n.toObject())];
    }

    res.json(notifications);
  } catch (err) {
    console.error('Fetch Notifications Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── PUT /api/notifications/claim/:donationId ──────────────────────────────
router.put('/claim/:donationId', authMiddleware, async (req, res) => {
  try {
    const receiver = await User.findById(req.user.userId);
    if (!receiver) return res.status(404).json({ error: 'Receiver user not found' });

    // Atomically claim the donation by verifying status is in an active/pending state
    const updatedDonation = await Donation.findOneAndUpdate(
      { _id: req.params.donationId, status: { $in: ['active', 'pending_receiver', 'needs_review'] } },
      {
        status: 'completed',
        receiverId: req.user.userId,
        claimedBy: req.user.userId,
        receiverDetails: {
          name: receiver.name,
          city: receiver.city || '',
          description: receiver.bio || receiver.email
        }
      },
      { new: true }
    );

    if (!updatedDonation) {
      // Mark current user's notification as completed/locked since donation is taken
      await Notification.updateMany(
        { donationId: req.params.donationId, receiverId: req.user.userId },
        { status: 'completed' }
      );
      return res.status(400).json({ error: 'Donation already accepted by another receiver.' });
    }

    // Mark current user's notification as accepted
    let notification = await Notification.findOne({ donationId: updatedDonation._id, receiverId: req.user.userId });
    if (notification) {
      notification.status = 'accepted';
      await notification.save();
    } else {
      // Create an accepted one for record keeping
      notification = new Notification({
        donorId: updatedDonation.donorId,
        receiverId: req.user.userId,
        donationId: updatedDonation._id,
        title: 'Claimed Match',
        message: `Claimed donation '${updatedDonation.title}'!`,
        status: 'accepted'
      });
      await notification.save();
    }

    // Mark all other notifications for this donation as completed (locked)
    await Notification.updateMany(
      { donationId: updatedDonation._id, _id: { $ne: notification._id } },
      { status: 'completed' }
    );

    res.json({ message: 'Donation claimed successfully!', donation: updatedDonation, notification });
  } catch (err) {
    console.error('Claim Donation Error:', err.message);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
});

// ─── PUT /api/notifications/:id/accept ─────────────────────────────────────
router.put('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.receiverId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to accept this claim' });
    }

    const receiver = await User.findById(req.user.userId);
    if (!receiver) return res.status(404).json({ error: 'Receiver user not found' });

    // Atomically claim the donation
    const updatedDonation = await Donation.findOneAndUpdate(
      { _id: notification.donationId, status: { $in: ['active', 'pending_receiver', 'needs_review'] } },
      {
        status: 'completed',
        receiverId: req.user.userId,
        claimedBy: req.user.userId,
        receiverDetails: {
          name: receiver.name,
          city: receiver.city || '',
          description: receiver.bio || receiver.email
        }
      },
      { new: true }
    );

    if (!updatedDonation) {
      notification.status = 'completed';
      await notification.save();
      return res.status(400).json({ error: 'Donation already accepted by another receiver.' });
    }

    // Mark current notification as accepted
    notification.status = 'accepted';
    await notification.save();

    // Mark all other notifications for this donation as completed
    await Notification.updateMany(
      { donationId: updatedDonation._id, _id: { $ne: notification._id } },
      { status: 'completed' }
    );

    res.json({ message: 'Donation claimed successfully!', donation: updatedDonation, notification });
  } catch (err) {
    console.error('Accept Notification Error:', err.message);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
});

// ─── PUT /api/notifications/:id/reject ─────────────────────────────────────
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.receiverId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    notification.status = 'rejected';
    await notification.save();

    // If the donation was pending receiver or claimed by this receiver, return it to 'active'
    const donation = await Donation.findById(notification.donationId);
    if (donation) {
      donation.status = 'active';
      donation.receiverId = undefined;
      donation.orgName = undefined;
      donation.claimedBy = undefined;
      donation.receiverDetails = undefined;
      await donation.save();
    }

    res.json({ message: 'Notification dismissed and donation returned to available state', notification });
  } catch (err) {
    console.error('Reject Notification Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── GET /api/notifications/donor ─ Donor own notification logs ───────────
router.get('/donor', authMiddleware, async (req, res) => {
  try {
    const query = { donorId: req.user.userId };
    if (req.query.status) {
      query.status = req.query.status;
    }
    let notifications = await Notification.find(query)
      .populate('receiverId', 'name city profilePic email phone location bio')
      .populate('donationId')
      .sort({ updatedAt: -1 });

    const lang = req.query.lang || 'en';
    if (lang === 'ur') {
      const notificationsToTranslate = notifications.slice(0, 20);
      const remainingNotifications = notifications.slice(20);

      const translated = await Promise.all(notificationsToTranslate.map(async (n) => {
        try {
          const trTitle = await aiService.translate(n.title, 'ur');
          const trMsg = await aiService.translate(n.message, 'ur');
          const nObj = n.toObject();
          if (nObj.donationId) {
            const trDonTitle = await aiService.translate(nObj.donationId.title, 'ur');
            const trDonDesc = await aiService.translate(nObj.donationId.description, 'ur');
            nObj.donationId.title = trDonTitle.translatedText;
            nObj.donationId.description = trDonDesc.translatedText;
          }
          return {
            ...nObj,
            title: trTitle.translatedText,
            message: trMsg.translatedText
          };
        } catch (trErr) {
          console.warn("Notification translation failed:", trErr.message);
          return n.toObject();
        }
      }));
      notifications = [...translated, ...remainingNotifications.map(n => n.toObject())];
    }

    res.json(notifications);
  } catch (err) {
    console.error('Fetch Donor Notifications Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ─── DELETE /api/notifications/:id ─────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Authorize: either donorId or receiverId must match req.user.userId
    if (
      notification.receiverId.toString() !== req.user.userId &&
      notification.donorId.toString() !== req.user.userId
    ) {
      return res.status(403).json({ error: 'Not authorized to delete this notification' });
    }

    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Delete Notification Error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
