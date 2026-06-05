const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config();

const Post = require('../models/Post');
const User = require('../models/User');

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

const calculateTravelTimeMin = async (dLat, dLng, rLat, rLng, dist) => {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${dLat},${dLng}&destinations=${rLat},${rLng}&key=${googleKey.trim()}`;
      console.log("AXIOS TYPE:", typeof axios);
      const response = await axios.get(url, { timeout: 3000 });
      if (response.data?.status === 'OK' && response.data?.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const durationSec = response.data.rows[0].elements[0].duration.value;
        return durationSec / 60;
      }
    } catch (gErr) {
      console.warn("⚠️ Google Maps Distance Matrix API query failed, falling back to distance estimation:", gErr.message);
    }
  }
  return dist * 1.5;
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const category = "Meat";
    const donorLat = 24.8607;
    const donorLng = 67.0011;

    console.log("Input Category:", category);
    console.log("Donor Coordinates:", { lat: donorLat, lng: donorLng });

    // 1. Fetch active posts
    const activePosts = await Post.find({ status: 'Active' }).populate('receiverId', 'name email phone location');
    const validActivePosts = activePosts.filter(post => post.receiverId);

    console.log(`Found ${activePosts.length} active posts, ${validActivePosts.length} have populated receivers.`);

    // 2. Map matches
    const mappedMatches = await Promise.all(validActivePosts.map(async post => {
      const recLat = post.receiverId?.location?.lat;
      const recLng = post.receiverId?.location?.lng;
      
      const resolvedRecLat = recLat !== undefined && recLat !== null ? recLat : 24.8607;
      const resolvedRecLng = recLng !== undefined && recLng !== null ? recLng : 67.0011;
      
      const distance = haversineKm(donorLat, donorLng, resolvedRecLat, resolvedRecLng);
      const travelTimeMin = await calculateTravelTimeMin(donorLat, donorLng, resolvedRecLat, resolvedRecLng, distance);
      return { post, distance, travelTimeMin, recLat, recLng };
    }));

    // 3. Filter
    const isFood = ['Food', 'Meat', 'Vegetables', 'Fruit', 'Dairy'].includes(category);
    let filteredMatches = mappedMatches;
    if (isFood) {
      console.log("\n--- TRAVEL FILTER DIAGNOSTICS ---");
      filteredMatches = mappedMatches.filter(m => {
        const isMissingOrZero = m.recLat === undefined || m.recLat === null || m.recLng === undefined || m.recLng === null || (m.recLat === 0 && m.recLng === 0);
        const passed = isMissingOrZero || (m.travelTimeMin <= 20);
        
        console.log({
          postTitle: m.post.title,
          category: m.post.category,
          receiverName: m.post.receiverId?.name,
          donorLat: donorLat,
          donorLng: donorLng,
          receiverLat: m.recLat,
          receiverLng: m.recLng,
          distanceKm: m.distance,
          travelTimeMin: m.travelTimeMin,
          passedFilter: passed
        });
        
        return passed;
      });
    }

    // 4. Priority
    const results = [];
    filteredMatches.forEach(m => {
      let priority = 3;
      const postCat = (m.post.category || '').toLowerCase();
      const donCat = (category || '').toLowerCase();

      if (postCat === donCat) {
        priority = 1;
      } else if (
        (['meat', 'vegetables', 'fruit', 'dairy'].includes(donCat) && postCat === 'food') ||
        (donCat === 'food' && ['meat', 'vegetables', 'fruit', 'dairy'].includes(postCat))
      ) {
        priority = 2;
      }

      if (priority === 1 || priority === 2) {
        results.push({
          ...m.post.toObject(),
          distanceKm: Math.round(m.distance * 10) / 10,
          travelTimeMin: Math.round(m.travelTimeMin),
          priority
        });
      }
    });

    results.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.distanceKm - b.distanceKm;
    });

    console.log("\n=================================================");
    console.log("FINAL RESULTS returned:", results.length);
    console.log("=================================================");
    console.log("FINAL RESPONSE:", JSON.stringify(results, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Diagnostic error:", err);
    process.exit(1);
  }
}

run();
