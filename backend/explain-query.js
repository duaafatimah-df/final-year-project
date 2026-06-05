const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Donation = require('./models/Donation');
const User = require('./models/User');

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected!");

    // Find a test donor ID from User collection to use in explain
    const testDonor = await User.findOne({ role: 'donor' });
    if (!testDonor) {
      console.log("No test donor user found. Please run test-flow or create a donor.");
      return;
    }
    const donorId = testDonor._id;
    console.log(`Using donorId: ${donorId} (${testDonor.name})`);

    // Run explain on my-donations query
    console.log("\nRunning explain on Donation query...");
    const explainResult = await Donation.find({ donorId: donorId })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    console.log("Query Plan:");
    console.log(JSON.stringify(explainResult.queryPlanner, null, 2));

    console.log("\nExecution Stats:");
    console.log(JSON.stringify(explainResult.executionStats, null, 2));

  } catch (err) {
    console.error("❌ Explain query failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
