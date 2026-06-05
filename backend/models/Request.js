const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:    { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Notification hook (email-ready)
  notificationSent: { type: Boolean, default: false }
}, { timestamps: true });

RequestSchema.index({ createdAt: -1 });
RequestSchema.index({ receiverId: 1, createdAt: -1 });
RequestSchema.index({ donationId: 1, createdAt: -1 });

module.exports = mongoose.model('Request', RequestSchema);
