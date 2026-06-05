const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT || 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM || 'SpareShare <noreply@spareshare.com>';

console.log('🔍 Loaded SMTP Configuration:');
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`User: ${user}`);
console.log(`Pass: ${pass ? '****' : 'NOT SET'}`);
console.log(`From: ${from}`);

if (!user || !pass || user === 'yourgmail@gmail.com' || pass === 'your_16_character_google_app_password') {
  console.log('\n❌ SMTP_USER and SMTP_PASS are not configured or still contain placeholder values in your .env file!');
  console.log('Please edit c:/Users/HP/Downloads/fyp/backend/.env and add your REAL Gmail address and 16-character Gmail App Password first.');
  process.exit(1);
}

const getTransporter = () => {
  if ((host && host.includes('gmail')) || (!host && user.includes('gmail.com'))) {
    console.log('ℹ️ Using standard Gmail Service config...');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }
  
  console.log('ℹ️ Using generic SMTP Host config...');
  return nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: port == 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
};

const transporter = getTransporter();

console.log('\n📧 Sending test email to', user, '...');

transporter.sendMail({
  from,
  to: user,
  subject: 'SpareShare AI - SMTP Connection Test ✅',
  text: 'Congratulations! Your SMTP/Nodemailer credentials are set up and working perfectly with Gmail!',
  html: '<h3>SpareShare AI - SMTP Connection Test ✅</h3><p>Congratulations! Your SMTP/Nodemailer credentials are set up and working perfectly with Gmail!</p>'
}).then((info) => {
  console.log('🎉 SMTP Test Successful!');
  console.log(`Message ID: ${info.messageId}`);
  console.log('Check your inbox (or spam) to verify delivery!');
}).catch((err) => {
  console.error('❌ SMTP Test Failed with error:', err.message);
});
