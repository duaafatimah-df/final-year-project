const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const result = await User.updateOne(
      { _id: '6a2548bf669392569391613c' },
      { 
        $set: { 
          'location.lat': 31.4697, 
          'location.lng': 74.2728,
          'location.address': 'Johar Town, Lahore, Pakistan'
        } 
      }
    );

    console.log("Update result:", result);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
