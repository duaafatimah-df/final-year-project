const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  urgency: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  desc: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Partially Fulfilled', 'Fulfilled'], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
