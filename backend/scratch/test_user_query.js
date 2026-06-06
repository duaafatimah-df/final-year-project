const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");
    console.log("Querying one user...");
    const user = await User.findOne();
    console.log("User found:", user ? user.name : "None");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
