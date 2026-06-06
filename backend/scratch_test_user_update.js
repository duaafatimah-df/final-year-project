const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function testUpdate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    // Find any donor
    const donor = await User.findOne({ role: 'donor' });
    if (!donor) {
      console.log("No donor found to test. Creating one...");
      const newDonor = await User.create({
        name: "Test Donor",
        email: `test_donor_${Date.now()}@example.com`,
        password: "hashedpassword",
        phone: "03001234567",
        role: "donor",
        isEmailVerified: true
      });
      console.log("Created donor:", newDonor._id);
      await performUpdate(newDonor);
    } else {
      console.log("Found donor:", donor.email);
      await performUpdate(donor);
    }

  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

async function performUpdate(user) {
  const body = {
    name: user.name + " Updated",
    phone: user.phone,
    bio: "I love to help people.",
    city: "Lahore",
    profilePic: "",
    address: "Street 5, Area Y",
    lat: "",
    lng: ""
  };

  const { name, phone, bio, city, profilePic, address, lat, lng } = body;

  const hasLat = lat !== undefined && lat !== null && lat !== '' && !isNaN(parseFloat(lat));
  const hasLng = lng !== undefined && lng !== null && lng !== '' && !isNaN(parseFloat(lng));
  
  user.location = {
    lat: hasLat ? parseFloat(lat) : null,
    lng: hasLng ? parseFloat(lng) : null,
    address: address ? String(address).trim() : ''
  };

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (bio !== undefined) user.bio = bio;
  if (city !== undefined) user.city = city;
  if (profilePic !== undefined) user.profilePic = profilePic;

  console.log("Saving user location:", user.location);
  await user.save();
  console.log("✅ User saved successfully!");
}

testUpdate();
