require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/User');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

// Geocoding helper using Google Maps API (with OSM Nominatim fallback)
async function geocode(address, city) {
  const query = [address, city].filter(Boolean).join(', ').trim();
  if (!query) return null;

  // 1. Try Google Maps Geocoding API
  if (GOOGLE_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY.trim()}`;
      const res = await axios.get(url, { timeout: 5000 });
      if (res.data?.status === 'OK' && res.data?.results?.[0]?.geometry?.location) {
        const { lat, lng } = res.data.results[0].geometry.location;
        console.log(`[Google Maps] Resolved "${query}" to: ${lat}, ${lng}`);
        return { lat, lng };
      } else {
        console.warn(`[Google Maps] Could not resolve "${query}". Status: ${res.data?.status}`);
      }
    } catch (err) {
      console.error(`[Google Maps] Error geocoding "${query}":`, err.message);
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim API
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'SpareShareAI-Location-Migration' },
      timeout: 5000
    });
    if (res.data && res.data.length > 0) {
      const lat = parseFloat(res.data[0].lat);
      const lng = parseFloat(res.data[0].lon);
      console.log(`[OSM Nominatim] Resolved "${query}" to: ${lat}, ${lng}`);
      return { lat, lng };
    } else {
      console.warn(`[OSM Nominatim] Could not resolve "${query}"`);
    }
  } catch (err) {
    console.error(`[OSM Nominatim] Error geocoding "${query}":`, err.message);
  }

  // 3. Fallback to city center defaults if geocoding fails completely
  const CITY_COORDS = {
    karachi: { lat: 24.8607, lng: 67.0011 },
    lahore: { lat: 31.5204, lng: 74.3587 },
    islamabad: { lat: 33.6844, lng: 73.0479 },
    peshawar: { lat: 34.0151, lng: 71.5249 },
    quetta: { lat: 30.1798, lng: 66.975 },
    multan: { lat: 30.1575, lng: 71.5249 }
  };

  const cleanCity = (city || '').trim().toLowerCase();
  if (CITY_COORDS[cleanCity]) {
    console.log(`[City Fallback] Resolved "${city}" to: ${CITY_COORDS[cleanCity].lat}, ${CITY_COORDS[cleanCity].lng}`);
    return CITY_COORDS[cleanCity];
  }

  return null;
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is missing in environment.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✓ Connected to MongoDB.");

  const users = await User.find({});
  console.log(`Found ${users.length} total users in DB.`);

  let updatedCount = 0;

  for (const user of users) {
    const lat = user.location?.lat;
    const lng = user.location?.lng;
    const city = user.city || '';
    const address = user.location?.address || '';

    // Check if user has incorrect Karachi default coordinates while they are in a different city
    const hasWrongKarachiFallback = (lat === 24.8607 && lng === 67.0011 && city.toLowerCase() !== 'karachi');
    const isMissingCoordinates = (lat === null || lat === undefined || lng === null || lng === undefined || (lat === 0 && lng === 0));

    if (hasWrongKarachiFallback || isMissingCoordinates) {
      console.log(`\nGeocoding user: "${user.name}" (Role: ${user.role}, City: "${city}", Address: "${address}")`);
      const coords = await geocode(address, city);
      
      if (coords) {
        user.location = {
          lat: coords.lat,
          lng: coords.lng,
          address: address || city
        };
        await user.save();
        console.log(`✓ Updated "${user.name}" coordinates to: ${coords.lat}, ${coords.lng}`);
        updatedCount++;
      } else {
        // Keep location null if geocoding fails, as per instructions
        user.location = {
          lat: null,
          lng: null,
          address: address || city
        };
        await user.save();
        console.log(`⚠ Geocoding failed for "${user.name}". Set coordinates to null.`);
        updatedCount++;
      }
    } else {
      console.log(`Skipping user: "${user.name}" (Already has valid coordinates: ${lat}, ${lng})`);
    }
  }

  console.log(`\n=================================================`);
  console.log(`MIGRATION COMPLETED SUCCESSFULLY`);
  console.log(`Total users updated: ${updatedCount}`);
  console.log(`=================================================`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
