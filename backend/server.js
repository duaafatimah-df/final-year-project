const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cron = require('node-cron');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── MongoDB Connection Middleware ──────────────────────────────────────────
const connectDB = async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  try {
    console.log('🔄 Connecting to MongoDB Atlas (Serverless Warmup)...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas (SpareShare AI)');
    next();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
};

app.use(connectDB);

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SpareShare AI API is running', timestamp: new Date() });
});

// ─── Auto-Expiry Cron Job (every 15 minutes) ──────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  try {
    const Donation = require('./models/Donation');
    const result = await Donation.updateMany(
      {
        status: 'active',
        isExpired: false,
        expiryTime: { $lt: new Date() }   // expired donations
      },
      { $set: { status: 'expired', isExpired: true } }
    );
    if (result.modifiedCount > 0) {
      console.log(`⏰ [CRON] Auto-expired ${result.modifiedCount} donation(s) at ${new Date().toISOString()}`);
    }
  } catch (err) {
    console.error('❌ [CRON] Auto-expiry error:', err.message);
  }
});

console.log('⏰ Auto-expiry cron job started (runs every 15 minutes)');

// ─── Server ───────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 SpareShare AI Backend running on port ${PORT}`);
  });
}

module.exports = app;
