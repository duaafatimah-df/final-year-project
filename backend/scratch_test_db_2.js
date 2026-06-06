const mongoose = require('mongoose');
require('dotenv').config();
const Donation = require('./models/Donation');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const count = await Donation.countDocuments();
    console.log("Donations count:", count);

    const doc = await Donation.findOne();
    if (doc) {
      console.log("Found one donation:", JSON.stringify(doc.toObject(), null, 2));
    } else {
      console.log("No donation document found.");
    }
  } catch (err) {
    console.error("Error in query:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
