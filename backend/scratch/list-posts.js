require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const posts = await Post.find({}).populate('receiverId');
  posts.forEach(p => {
    console.log({
      id: p._id,
      title: p.title,
      category: p.category,
      receiverId: p.receiverId?._id,
      receiverName: p.receiverId?.name,
      receiverCity: p.receiverId?.city,
      receiverAddress: p.receiverId?.location?.address
    });
  });
  await mongoose.disconnect();
}
run();
