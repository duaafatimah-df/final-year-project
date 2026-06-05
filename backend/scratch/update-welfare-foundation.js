require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ name: 'welfare foundation' });
  if (user) {
    user.city = 'Lahore, Pakistan';
    user.location = {
      lat: 24.8607, // restore incorrect coord so migration script picks it up and resolves it!
      lng: 67.0011,
      address: 'Model Town, Lahore, Pakistan'
    };
    await user.save();
    console.log("✓ Updated welfare foundation to Lahore, Pakistan");
  } else {
    console.log("❌ welfare foundation not found");
  }
  await mongoose.disconnect();
}
run();
