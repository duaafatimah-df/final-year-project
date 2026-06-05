const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_spareshare';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const user = await User.findOne({ role: 'donor' });
    if (!user) {
      console.error("No donor user found in database!");
      process.exit(1);
    }
    console.log(`Using donor user: ${user.name} (${user.email})`);

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);

    const payload = {
      category: "Food",
      title: "pizza",
      description: "pizza and samosas",
      lat: 24.8607,
      lng: 67.0011
    };
    console.log("Sending payload:", payload);

    const res = await axios.post("http://localhost:5000/api/donations/match-suggestions", payload, {
      headers: {
        'x-auth-token': token
      }
    });

    console.log("\n==========================================");
    console.log("MATCH SUGGESTIONS API RESULTS (IN RELEVANCE ORDER):");
    res.data.matches.forEach((m, idx) => {
      console.log(`${idx + 1}. Title: "${m.title}"`);
      console.log(`   Receiver: "${m.receiverId?.name}"`);
      console.log(`   Relevance Score: ${m.relevanceScore}`);
      console.log(`   Priority: ${m.priority}`);
      console.log(`   Travel Time: ${m.travelTimeMin} mins (${m.distanceKm} km)`);
    });
    console.log("==========================================");

    process.exit(0);
  } catch (err) {
    console.error("Error running test:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    process.exit(1);
  }
}

run();
