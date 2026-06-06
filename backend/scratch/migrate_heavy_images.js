const mongoose = require('mongoose');
require('dotenv').config();
const Donation = require('../models/Donation');
const User = require('../models/User');

const LIGHTWEIGHT_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%230f172a"/><rect x="10" y="10" width="280" height="280" rx="15" fill="none" stroke="%2310b981" stroke-width="4" stroke-dasharray="10 5"/><path d="M150 90 C130 60, 90 60, 90 100 C90 140, 150 200, 150 210 C150 200, 210 140, 210 100 C210 60, 170 60, 150 90 Z" fill="%2310b981" opacity="0.8"/><text x="50%" y="80%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23f1f5f9">SpareShare AI</text><text x="50%" y="87%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%2394a3b8">Verified Donation Item</text></svg>`;

const USER_PIC_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%2310b981"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="bold" fill="white">U</text></svg>`;

const USER_BANNER_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200"><rect width="800" height="200" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="bold" fill="%2310b981">SpareShare Partner</text></svg>`;

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    // 1. Migrate Donations
    console.log("Checking Donations...");
    const donations = await Donation.find({});
    let donationUpdatedCount = 0;

    for (const don of donations) {
      if (don.imageUrl && don.imageUrl.length > 100 * 1024) { // larger than 100KB
        console.log(`Donation [${don._id}] "${don.title}" has image of size ${(don.imageUrl.length / 1024).toFixed(1)} KB. Migrating to placeholder...`);
        don.imageUrl = LIGHTWEIGHT_PLACEHOLDER;
        await don.save();
        donationUpdatedCount++;
      }
    }
    console.log(`Successfully migrated ${donationUpdatedCount} heavy donation images.`);

    // 2. Migrate User profiles
    console.log("Checking Users...");
    const users = await User.find({});
    let userUpdatedCount = 0;

    for (const user of users) {
      let updated = false;
      if (user.profilePic && user.profilePic.length > 50 * 1024) { // larger than 50KB
        console.log(`User [${user._id}] "${user.name}" has profilePic of size ${(user.profilePic.length / 1024).toFixed(1)} KB. Migrating to placeholder...`);
        user.profilePic = USER_PIC_PLACEHOLDER;
        updated = true;
      }
      if (user.profileBanner && user.profileBanner.length > 100 * 1024) { // larger than 100KB
        console.log(`User [${user._id}] "${user.name}" has profileBanner of size ${(user.profileBanner.length / 1024).toFixed(1)} KB. Migrating to placeholder...`);
        user.profileBanner = USER_BANNER_PLACEHOLDER;
        updated = true;
      }
      if (updated) {
        await user.save();
        userUpdatedCount++;
      }
    }
    console.log(`Successfully migrated ${userUpdatedCount} users with heavy profile assets.`);

  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
