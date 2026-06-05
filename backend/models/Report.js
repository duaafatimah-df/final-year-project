const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason:     { type: String, required: true },
  details:    { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'dismissed', 'actioned'],
    default: 'pending'
  },
  adminNote:  { type: String, default: '' }
}, { timestamps: true });

ReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', ReportSchema);
