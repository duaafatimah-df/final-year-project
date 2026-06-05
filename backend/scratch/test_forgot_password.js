const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const API = 'http://localhost:5000';
const TARGET_EMAIL = 'duaafatimah00@gmail.com';
const NEW_PASSWORD = 'NewReceiverPassword@123';

async function testForgotPassword() {
  try {
    // 1. Connect to DB to check OTP later
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB!');

    const User = require('../models/User');

    // 2. Trigger forgot password via API
    console.log(`\n📧 Sending forgot password request for ${TARGET_EMAIL}...`);
    const forgotRes = await axios.post(`${API}/api/auth/forgot-password`, {
      email: TARGET_EMAIL
    });
    console.log('Forgot Password response:', forgotRes.data);

    // 3. Find user and get OTP from DB
    const user = await User.findOne({ email: TARGET_EMAIL });
    if (!user) {
      throw new Error('User not found in DB!');
    }
    const otp = user.passwordResetOtp;
    console.log(`🔑 Recovered Password Reset OTP from DB: ${otp}`);
    console.log(`⏳ OTP Expires: ${user.passwordResetOtpExpires}`);

    if (!otp) {
      throw new Error('OTP was not set on the user document!');
    }

    // 4. Verify/Reset password via API
    console.log(`\n🔐 Submitting reset password request with OTP ${otp}...`);
    const resetRes = await axios.post(`${API}/api/auth/reset-password`, {
      email: TARGET_EMAIL,
      otp: otp,
      newPassword: NEW_PASSWORD
    });
    console.log('Reset Password response:', resetRes.data);

    // 5. Verify login with the new password
    console.log('\n🔑 Attempting login with new password...');
    const loginRes = await axios.post(`${API}/api/auth/login`, {
      email: TARGET_EMAIL,
      password: NEW_PASSWORD
    });
    console.log('Login Success! User:', loginRes.data.user?.name);
    console.log('Token received:', loginRes.data.token ? 'YES' : 'NO');

  } catch (err) {
    console.error('❌ Test Failed:', err.response?.data || err.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 DB connection closed.');
  }
}

testForgotPassword();
