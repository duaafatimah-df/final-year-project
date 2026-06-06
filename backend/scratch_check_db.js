const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Donation = require('./models/Donation');
const Notification = require('./models/Notification');

async function runDiagnostics() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas successfully.");

    const userCount = await User.countDocuments();
    const donationCount = await Donation.countDocuments();
    const notificationCount = await Notification.countDocuments();

    console.log(`Total Users: ${userCount}`);
    console.log(`Total Donations: ${donationCount}`);
    console.log(`Total Notifications: ${notificationCount}`);

    // Print all users and roles
    console.log("\n--- Users ---");
    const users = await User.find({}, 'name email role isVerified approvalStatus isEmailVerified');
    users.forEach(u => {
      console.log(`ID: ${u._id} | Role: ${u.role} | Email: ${u.email} | Name: ${u.name} | Verified: ${u.isVerified}/${u.isEmailVerified} | Status: ${u.approvalStatus}`);
    });

    // Print a few donations
    console.log("\n--- Donations Sample ---");
    const donations = await Donation.find({}).limit(5);
    donations.forEach(d => {
      console.log(`ID: ${d._id} | DonorId: ${d.donorId} | ReceiverId: ${d.receiverId} | Title: ${d.title} | Status: ${d.status}`);
    });

    // Print a few notifications
    console.log("\n--- Notifications Sample ---");
    const notifications = await Notification.find({}).limit(5);
    notifications.forEach(n => {
      console.log(`ID: ${n._id} | DonorId: ${n.donorId} | ReceiverId: ${n.receiverId} | DonationId: ${n.donationId} | Title: ${n.title} | Status: ${n.status}`);
    });

  } catch (err) {
    console.error("Diagnostics Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

runDiagnostics();
