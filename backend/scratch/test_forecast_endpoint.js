const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Post = require('../models/Post');
const Donation = require('../models/Donation');
const User = require('../models/User'); // just in case receiverId references User

async function test() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/spareshare');
    console.log("Connected.");

    console.log("Fetching active requests...");
    const activeRequests = await Post.find({ status: { $ne: 'Fulfilled' } }).populate('receiverId', 'name location');
    console.log("Found requests:", activeRequests.length);
    if (activeRequests.length > 0) {
      console.log("First request receiverId:", activeRequests[0].receiverId);
    }

    console.log("Fetching active donations...");
    const activeDonations = await Donation.find({ status: 'active' });
    console.log("Found donations:", activeDonations.length);

    console.log("Running aggregation...");
    const requestCounts = {};
    const donationCounts = {};
    const categories = ['Food', 'Medicine', 'Clothes', 'Grocery', 'Household'];

    categories.forEach(c => {
      requestCounts[c] = 0;
      donationCounts[c] = 0;
    });

    activeRequests.forEach(p => {
      const cat = p.category || 'Other';
      if (categories.includes(cat)) {
        requestCounts[cat] = (requestCounts[cat] || 0) + 1;
      }
    });

    activeDonations.forEach(d => {
      const cat = d.category || 'Other';
      if (categories.includes(cat)) {
        donationCounts[cat] = (donationCounts[cat] || 0) + 1;
      }
    });

    console.log("Request counts:", requestCounts);
    console.log("Donation counts:", donationCounts);

    const forecasts = categories.map(cat => {
      const reqCount = requestCounts[cat] || 0;
      const donCount = donationCounts[cat] || 0;
      let score = 15;
      if (reqCount > 0) score += reqCount * 12;
      score -= donCount * 5;
      const finalScore = Math.max(10, Math.min(Math.round(score), 98));
      let trend = 'Stable';
      if (reqCount > donCount * 1.2) trend = 'Increasing';
      else if (donCount > reqCount * 1.2) trend = 'Decreasing';

      return {
        category: cat,
        demandScore: finalScore,
        activeRequests: reqCount,
        activeDonations: donCount,
        trend
      };
    });

    console.log("Forecasts calculated successfully.");

    const areaRequests = {};
    activeRequests.forEach(p => {
      const address = p.receiverId?.location?.address || 'Lahore';
      let area = 'Lahore';
      if (address.toLowerCase().includes('johar town')) area = 'Johar Town';
      else if (address.toLowerCase().includes('model town')) area = 'Model Town';
      else if (address.toLowerCase().includes('ghazi road') || address.toLowerCase().includes('gazi road')) area = 'Ghazi Road';
      else if (address.toLowerCase().includes('saddar')) area = 'Saddar Town';
      else if (address.toLowerCase().includes('dha')) area = 'DHA';
      else {
        const parts = address.split(',');
        area = parts[0].trim();
      }

      if (!areaRequests[area]) {
        areaRequests[area] = { Food: 0, Medicine: 0, Clothes: 0, Grocery: 0, Household: 0, total: 0 };
      }
      const cat = p.category;
      if (categories.includes(cat)) {
        areaRequests[area][cat]++;
      }
      areaRequests[area].total++;
    });

    const hotspots = Object.keys(areaRequests).map(area => {
      const stats = areaRequests[area];
      let primaryCategory = 'Food';
      let maxVal = -1;
      categories.forEach(c => {
        if (stats[c] > maxVal) {
          maxVal = stats[c];
          primaryCategory = c;
        }
      });

      return {
        area,
        totalRequests: stats.total,
        primaryDemand: primaryCategory,
        urgency: stats.total > 3 ? 'Critical' : stats.total > 1 ? 'High' : 'Moderate'
      };
    }).sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 5);

    console.log("Hotspots calculated:", hotspots);
    console.log("All done!");
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

test();
