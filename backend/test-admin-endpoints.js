const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const API = 'http://localhost:5000';

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected!");

    // Find or create an admin user
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log("No admin found. Creating a temporary test admin...");
      admin = new User({
        name: "Admin Tester",
        email: "admin_test_diag@spareshare.com",
        phone: "+923000000000",
        password: "adminpassword",
        role: "admin",
        isVerified: true,
        isEmailVerified: true
      });
      await admin.save();
    }
    console.log(`Using Admin: ${admin.name} (${admin.email})`);

    // Generate token
    const token = jwt.sign({ userId: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });
    const config = { headers: { 'x-auth-token': token } };

    const endpoints = [
      { name: 'Pending NGOs', url: `${API}/api/users/pending` },
      { name: 'All Users', url: `${API}/api/users/all` },
      { name: 'All Donations', url: `${API}/api/donations/all` },
      { name: 'All Reports', url: `${API}/api/reports` },
      { name: 'Admin Stats', url: `${API}/api/users/admin-stats` }
    ];

    console.log("\nTesting Admin API endpoints (make sure the backend server is running on port 5000)...");
    for (const ep of endpoints) {
      console.log(`\nTesting ${ep.name} [GET ${ep.url}]...`);
      try {
        const res = await axios.get(ep.url, config);
        console.log(`✅ Success (Status ${res.status}): Loaded ${Array.isArray(res.data) ? res.data.length + ' items' : 'data object'}`);
      } catch (err) {
        console.log(`❌ Failed (Status ${err.response?.status || 'No Response'}):`);
        console.log(err.response?.data || err.message);
      }
    }

  } catch (err) {
    console.error("Diagnostic script error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
