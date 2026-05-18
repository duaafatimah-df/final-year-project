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

module.exports = mongoose.model('Request', RequestSchema);
