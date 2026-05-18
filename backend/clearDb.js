require('dotenv').config();
const mongoose = require('mongoose');
const Donation = require('./models/Donation');

async function wipe() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  const res = await Donation.deleteMany({});
  console.log(`Deleted ${res.deletedCount} old donations.`);
  process.exit(0);
}
wipe();
