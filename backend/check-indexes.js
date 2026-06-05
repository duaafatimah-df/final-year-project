const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Donation = require('./models/Donation');
const Report = require('./models/Report');
const Request = require('./models/Request');
const Post = require('./models/Post');
const Notification = require('./models/Notification');

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected!");

    const models = [
      { name: 'User', model: User },
      { name: 'Donation', model: Donation },
      { name: 'Report', model: Report },
      { name: 'Request', model: Request },
      { name: 'Post', model: Post },
      { name: 'Notification', model: Notification }
    ];

    for (const m of models) {
      console.log(`\n--- Model: ${m.name} ---`);
      
      // Sync indexes
      console.log(`Syncing indexes for ${m.name}...`);
      try {
        const result = await m.model.syncIndexes();
        console.log(`Sync result for ${m.name}:`, result);
      } catch (err) {
        console.error(`❌ Failed to sync indexes for ${m.name}:`, err.message);
      }

      // List existing indexes in database
      const indexes = await m.model.collection.listIndexes().toArray();
      console.log(`Existing indexes for ${m.name}:`);
      indexes.forEach(idx => {
        console.log(`  - Name: ${idx.name}, Key:`, JSON.stringify(idx.key));
      });
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

run();
