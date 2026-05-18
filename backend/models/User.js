const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phone:    { type: String, required: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['donor', 'receiver', 'admin'], required: true },
  taxId:    { type: String },
  orgType:  { type: String, enum: ['NGO', 'Foundation', 'Instagram Page', 'Community Group'] },

  // Verification & trust
  isVerified:  { type: Boolean, default: false },
  isBlocked:   { type: Boolean, default: false },
  flagCount:   { type: Number, default: 0 },
  avgRating:   { type: Number, default: null },
  ratingCount: { type: Number, default: 0 },

  // Profile
  bio:        { type: String, default: '' },
  city:       { type: String, default: '' },
  profilePic: { type: String, default: '' },

  // Notification preference (email-ready)
  emailNotifications: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
