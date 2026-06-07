const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function testSave() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const user = await User.findOne({ email: 'workbase33@gmail.com' });
    if (!user) {
      console.log("User not found!");
      return;
    }

    console.log("Found user. Current values:", JSON.stringify(user, null, 2));

    // Try modifying fields similar to ProfilePage save payload
    user.name = "Duaa fatimah";
    user.phone = "03427708649";
    user.bio = "Test Bio";
    user.city = "Lahore";
    user.location = {
      lat: null,
      lng: null,
      address: ""
    };

    console.log("Attempting to save...");
    await user.save();
    console.log("✅ Saved successfully!");

  } catch (err) {
    console.error("❌ Save Failed with Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

testSave();
