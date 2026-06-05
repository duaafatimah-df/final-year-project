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

  // Email Verification & OTP Security Credentials
  isEmailVerified:             { type: Boolean, default: false },
  emailVerificationOtp:        { type: String },
  emailVerificationOtpExpires: { type: Date },
  passwordResetOtp:            { type: String },
  passwordResetOtpExpires:     { type: Date },
  approvalStatus:              { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },


  // Profile
  bio:           { type: String, default: '' },
  city:          { type: String, default: '' },
  profilePic:    { type: String, default: '' },
  profileBanner: { type: String, default: '' },

  // Notification preference (email-ready)
  emailNotifications: { type: Boolean, default: true },

  // Geospatial Coordinates for distance mapping
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    address: { type: String, default: '' }
  },
}, { timestamps: true });

UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema);
