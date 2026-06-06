const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Donation = require('./models/Donation');
const Notification = require('./models/Notification');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const donors = await User.find({ role: 'donor' });
    console.log("\nCounts per Donor:");
    for (const d of donors) {
      const donCount = await Donation.countDocuments({ donorId: d._id });
      const notifCount = await Notification.countDocuments({ donorId: d._id });
      console.log(`Donor: ${d.name} (${d.email}) | ID: ${d._id}`);
      console.log(`  - Donations count: ${donCount}`);
      console.log(`  - Notifications count: ${notifCount}`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
