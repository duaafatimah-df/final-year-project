const mongoose = require('mongoose');
require('dotenv').config();
const Donation = require('../models/Donation');
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");
    console.log("Running query...");
    const donations = await Donation.find()
      .populate('donorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    console.log("Query complete. Found:", donations.length);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
