const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const User = require('./models/User');

const ADMIN_EMAIL    = 'admin@spareshare.com';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_NAME     = 'SpareShare Admin';

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      const salt = await bcrypt.genSalt(10);
      existing.password = await bcrypt.hash(ADMIN_PASSWORD, salt);
      existing.role = 'admin';
      existing.isVerified = true;
      existing.isEmailVerified = true;
      existing.approvalStatus = 'approved';
      await existing.save();
      console.log('✅ Admin account updated / verified successfully!');
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

      await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        phone: '03000000000',
        role: 'admin',
        isVerified: true,
        isEmailVerified: true,
        approvalStatus: 'approved'
      });
      console.log('✅ Admin account created successfully!');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ADMIN LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email    : ${ADMIN_EMAIL}`);
    console.log(`   Password : ${ADMIN_PASSWORD}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createAdmin();
