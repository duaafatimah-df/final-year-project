require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Post = require('../models/Post');
const Donation = require('../models/Donation');

// Haversine helper
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distance matrix helper
const calculateTravelTimeMin = async (dLat, dLng, rLat, rLng, dist) => {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${dLat},${dLng}&destinations=${rLat},${rLng}&key=${googleKey.trim()}`;
      const response = await axios.get(url, { timeout: 3000 });
      if (response.data?.status === 'OK' && response.data?.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const durationSec = response.data.rows[0].elements[0].duration.value;
        return durationSec / 60;
      }
    } catch (err) {
      console.warn("Google Maps Distance Matrix query failed, using fallback:", err.message);
    }
  }
  return dist * 1.5; // fallback
};

function isFoodCategory(cat) {
  return ['Food', 'Meat', 'Vegetables', 'Fruit', 'Dairy'].includes(cat);
}

function isSummerNow() {
  const m = new Date().getMonth(); // 0-indexed
  return m >= 4 && m <= 8; // May-Sep
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to database.\n");

  // Donor coordinates in Lahore Center
  const donorLat = 31.5204;
  const donorLng = 74.3587;
  const queryCategory = 'Food';

  console.log("=================================================");
  console.log("SIMULATING DONATION MATCH TEST");
  console.log(`Donor Location: Lahore (${donorLat}, ${donorLng})`);
  console.log(`Donated Category: "${queryCategory}"`);
  console.log("=================================================\n");

  // 1. Get receivers and posts
  const activePosts = await Post.find({ status: 'Active' }).populate('receiverId');
  const validPosts = activePosts.filter(p => p.receiverId);

  console.log("--- RECEIVER COORDINATES IN DB ---");
  const receiversChecked = new Set();
  validPosts.forEach(p => {
    const rec = p.receiverId;
    if (!receiversChecked.has(rec._id.toString())) {
      receiversChecked.add(rec._id.toString());
      console.log(`Org: "${rec.name}"`);
      console.log(`  City: "${rec.city}"`);
      console.log(`  Address: "${rec.location?.address || 'N/A'}"`);
      console.log(`  Coordinates: ${rec.location?.lat}, ${rec.location?.lng}`);
    }
  });
  console.log("");

  // 2. Perform suggestions engine checks
  const isFood = isFoodCategory(queryCategory);
  const isSummer = isSummerNow();

  console.log("--- MAPPED SUGGESTIONS ---");
  const mappedMatches = await Promise.all(validPosts.map(async post => {
    const rec = post.receiverId;
    const recLat = rec.location?.lat;
    const recLng = rec.location?.lng;

    const resolvedRecLat = recLat !== undefined && recLat !== null ? recLat : null;
    const resolvedRecLng = recLng !== undefined && recLng !== null ? recLng : null;

    let distance = 0;
    let travelTimeMin = 0;
    if (donorLat !== null && donorLng !== null && resolvedRecLat !== null && resolvedRecLng !== null) {
      distance = haversineKm(donorLat, donorLng, resolvedRecLat, resolvedRecLng);
      travelTimeMin = await calculateTravelTimeMin(donorLat, donorLng, resolvedRecLat, resolvedRecLng, distance);
    }

    return { post, distance, travelTimeMin, recLat, recLng };
  }));

  // Apply Food Safety filters
  let filteredMatches = mappedMatches;
  if (isFood && isSummer) {
    filteredMatches = mappedMatches.filter(m => {
      const isMissingOrZero = m.recLat === undefined || m.recLat === null || m.recLng === undefined || m.recLng === null || (m.recLat === 0 && m.recLng === 0);
      return isMissingOrZero || m.travelTimeMin <= 20;
    });
  }

  // Calculate scores and prioritize
  const results = [];
  filteredMatches.forEach(m => {
    let priority = 3;
    const postCat = (m.post.category || '').toLowerCase();
    const donCat = queryCategory.toLowerCase();

    if (postCat === donCat) {
      priority = 1; // Level 1: Exact Match
    } else if (
      (['meat', 'vegetables', 'fruit', 'dairy'].includes(donCat) && postCat === 'food') ||
      (donCat === 'food' && ['meat', 'vegetables', 'fruit', 'dairy'].includes(postCat))
    ) {
      priority = 2; // Level 2: Sub-category match
    }

    if (priority === 1 || priority === 2) {
      results.push({
        post: m.post,
        distanceKm: Math.round(m.distance * 10) / 10,
        travelTimeMin: Math.round(m.travelTimeMin),
        priority
      });
    }
  });

  // Sort: priority first, then distance
  results.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.distanceKm - b.distanceKm;
  });

  // Print results
  results.forEach(r => {
    console.log(`Suggestion Match Found:`);
    console.log(`- Post: "${r.post.title}"`);
    console.log(`- Organization: "${r.post.receiverId.name}"`);
    console.log(`- Priority: ${r.priority} (${r.priority === 1 ? 'Exact Match' : 'Category Match'})`);
    console.log(`- Coordinates: ${r.post.receiverId.location?.lat}, ${r.post.receiverId.location?.lng}`);
    console.log(`- Calculated Distance: ${r.distanceKm} km`);
    console.log(`- Travel Duration: ${r.travelTimeMin} minutes`);
    console.log("");
  });

  if (results.length === 0) {
    console.log("No matching receiver suggestions found.");
  }

  await mongoose.disconnect();
}
run();
