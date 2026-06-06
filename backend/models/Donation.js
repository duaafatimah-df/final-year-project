const mongoose = require('mongoose');

const DonationSchema = new mongoose.Schema({
  // Core donor link
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Item details
  title: { type: String, required: true },
  category: { type: String, enum: ['Food', 'Medicine', 'Clothes', 'Grocery', 'Household', 'Meat', 'Vegetables', 'Fruit', 'Dairy', 'Other'], required: true },
  itemType: { type: String, required: true },
  condition: { type: String, enum: ['New', 'Good', 'Used'] },
  imageUrl: { type: String, required: true },
  quantity: { type: String, default: '' },
  description: { type: String, default: '' },

  // Expiry / Safety Limits
  expiryTime: { type: Date },
  foodPreparedTime: { type: Date },
  isExpired: { type: Boolean, default: false },

  // Medicine-specific
  isSealed: { type: Boolean, default: false },

  // Location (GeoJSON-compatible + address string)
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    address: { type: String, default: '' }
  },

  // Status lifecycle
  status: {
    type: String,
    enum: ['active', 'expired', 'completed', 'pending_receiver', 'needs_review', 'rejected'],
    default: 'active'
  },

  // Trust / Report
  rating: { type: Number, default: null },   // receiver rating after pickup
  donorRating: { type: Number, default: null }, // donor rating of receiver after pickup
  reportCount: { type: Number, default: 0 },

  // Legacy AI fields (kept for backward compat)
  aiSafetyScore: { type: Number, default: 99 },
  isVerifiedSafe: { type: Boolean, default: true },
  aiAnalysisReason: { type: String, default: 'Item verified by SpareShare AI' },
  aiDetectedItems: { type: String, default: 'Food / Clothing / Supplies' },

  // For backward compat with old flow
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverDetails: {
    name: { type: String, default: '' },
    city: { type: String, default: '' },
    description: { type: String, default: '' }
  },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  orgName: { type: String },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Notification fields (backend-ready for future email integration)
  notificationSent: { type: Boolean, default: false },

}, { timestamps: true });

// 2dsphere index for geospatial queries
DonationSchema.index({ 'location.lat': 1, 'location.lng': 1 });
DonationSchema.index({ createdAt: -1 });
DonationSchema.index({ updatedAt: -1 });
DonationSchema.index({ donorId: 1, createdAt: -1 });
DonationSchema.index({ receiverId: 1, createdAt: -1 });
DonationSchema.index({ receiverId: 1, updatedAt: -1 });

module.exports = mongoose.model('Donation', DonationSchema);
