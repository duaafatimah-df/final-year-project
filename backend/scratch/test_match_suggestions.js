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

    // Find any donor user
    const user = await User.findOne({ role: 'donor' });
    if (!user) {
      console.error("No donor user found in database!");
      process.exit(1);
    }
    console.log(`Using donor user: ${user.name} (${user.email}) - ID: ${user._id}`);

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);
    console.log("Generated JWT Token:", token);

    // Call match-suggestions endpoint on the running server
    const payload = {
      category: "Meat",
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
    console.log("RESPONSE STATUS:", res.status);
    console.log("RESPONSE DATA:", JSON.stringify(res.data, null, 2));
    console.log("==========================================");

    process.exit(0);
  } catch (err) {
    console.error("Error calling match-suggestions API:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    process.exit(1);
  }
}

run();
