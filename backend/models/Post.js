const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  category: { type: String, enum: ['Food', 'Medicine', 'Clothes', 'Grocery', 'Household', 'Meat', 'Vegetables', 'Fruit', 'Dairy', 'Other'], required: true },
  urgency: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  desc: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Partially Fulfilled', 'Fulfilled'], default: 'Active' },
}, { timestamps: true });

PostSchema.index({ createdAt: -1 });
PostSchema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
