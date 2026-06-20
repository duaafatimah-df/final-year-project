const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");
    const users = await User.find({}, 'name role email location');
    users.forEach(u => {
      console.log(`Name: ${u.name} | Role: ${u.role} | Lat: ${u.location?.lat} | Lng: ${u.location?.lng} | Address: ${u.location?.address}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
