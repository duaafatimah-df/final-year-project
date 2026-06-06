const mongoose = require('mongoose');
require('dotenv').config();
const Donation = require('../models/Donation');
const User = require('../models/User');

async function run() {
  try {
    const startConn = Date.now();
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB in ${Date.now() - startConn}ms`);

    const startQuery1 = Date.now();
    const count = await Donation.countDocuments();
    console.log(`Count: ${count} in ${Date.now() - startQuery1}ms`);

    const startQuery2 = Date.now();
    const donations = await Donation.find().limit(200);
    console.log(`Find without populate: ${donations.length} items in ${Date.now() - startQuery2}ms`);

    const startQuery3 = Date.now();
    const donationsPop = await Donation.find().populate('donorId', 'name email').limit(200);
    console.log(`Find with populate: ${donationsPop.length} items in ${Date.now() - startQuery3}ms`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
