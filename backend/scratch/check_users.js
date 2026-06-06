const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const users = await User.find({});
    console.log("\nAll Users in DB:");
    users.forEach(u => {
      console.log(`- Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | Verified: ${u.isVerified} | EmailVerified: ${u.isEmailVerified} | Approval: ${u.approvalStatus} | Blocked: ${u.isBlocked}`);
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
