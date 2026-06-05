require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({});
  users.forEach(u => {
    console.log({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      city: u.city,
      address: u.location?.address,
      lat: u.location?.lat,
      lng: u.location?.lng
    });
  });
  await mongoose.disconnect();
}
run();
