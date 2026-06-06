const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function run() {
  try {
    const startConn = Date.now();
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB in ${Date.now() - startConn}ms`);

    for (let i = 1; i <= 5; i++) {
      const startQuery = Date.now();
      const user = await User.findOne();
      console.log(`Query ${i} completed in ${Date.now() - startQuery}ms (User: ${user ? user.name : "None"})`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
