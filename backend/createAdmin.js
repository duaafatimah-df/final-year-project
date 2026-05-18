const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  role: String,
  isVerified: Boolean,
  taxId: String,
  orgType: String,
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const ADMIN_EMAIL    = 'admin@spareshare.com';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_NAME     = 'SpareShare Admin';

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      // if already exists but not admin, upgrade it
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        existing.isVerified = true;
        await existing.save();
        console.log('✅ Existing account upgraded to Admin role!');
      } else {
        console.log('ℹ️  Admin account already exists. No changes made.');
      }
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
