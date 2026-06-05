const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ updatedAt: -1 });
NotificationSchema.index({ receiverId: 1, createdAt: -1 });
NotificationSchema.index({ donorId: 1, updatedAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
