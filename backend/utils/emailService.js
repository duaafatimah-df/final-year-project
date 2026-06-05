const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configure transporter
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Ignore placeholder values from .env template
  if (
    user && 
    pass && 
    user !== 'yourgmail@gmail.com' && 
    pass !== 'your_16_character_google_app_password' &&
    user.trim() !== '' &&
    pass.trim() !== ''
  ) {
    // If the host is gmail, or email ends with gmail.com and no host specified, default to Gmail service
    if ((host && host.includes('gmail')) || (!host && user.includes('gmail.com'))) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 5000, // 5 seconds connection timeout
        greetingTimeout: 5000,
        socketTimeout: 10000
      });
    } else if (host) {
      return nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: port == 465, // true for 465, false for other ports
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false // Avoid self-signed certificate rejections
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      });
    }
  }
  return null; // Fallback to console/file logging
};

const sendEmail = async ({ to, subject, html, text }) => {
  // 1. Try Brevo HTTP API (Port 443 - Never Blocked on live servers)
  if (process.env.BREVO_API_KEY) {
    try {
      await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { name: "SpareShare AI", email: process.env.SMTP_USER || "spareshareai@gmail.com" },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text
      }, {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        }
      });
      console.log(`✉️ Email sent successfully via Brevo HTTP API to ${to}`);
      return true;
    } catch (err) {
      console.error('❌ Brevo HTTP API Error:', err.response?.data || err.message);
    }
  }

  // 2. Try Resend HTTP API (Port 443 - Never Blocked on live servers)
  if (process.env.RESEND_API_KEY) {
    try {
      await axios.post('https://api.resend.com/emails', {
        from: 'SpareShare AI <onboarding@resend.dev>',
        to: to,
        subject: subject,
        html: html,
        text: text
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'content-type': 'application/json'
        }
      });
      console.log(`✉️ Email sent successfully via Resend HTTP API to ${to}`);
      return true;
    } catch (err) {
      console.error('❌ Resend HTTP API Error:', err.response?.data || err.message);
    }
  }

  // 3. Try Nodemailer SMTP (Default fallback)
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || 'SpareShare <noreply@spareshare.com>';

  if (transporter) {
    try {
      const info = await transporter.sendMail({ from, to, subject, html, text });
      console.log(`✉️ Email sent successfully via SMTP to ${to}. Message ID: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error(`❌ Error sending real SMTP email to ${to}:`, err);
      // Fall back to mock if real fails
    }
  }

  // Fallback / Mock logic: log to console and write to a local file
  console.log('\n======================================================');
  console.log(`📨 [SIMULATED EMAIL SENDER]`);
  console.log(`To:      ${to}`);
  console.log(`From:    ${from}`);
  console.log(`Subject: ${subject}`);
  console.log('------------------------------------------------------');
  console.log(text || html);
  console.log('======================================================\n');

  // Save mock email to a file for easy inspection during development
  try {
    const tempDir = path.join(__dirname, '..', 'temp_emails');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filename = `${Date.now()}_to_${to.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    const filepath = path.join(tempDir, filename);
    const fileContent = `
      <h3>To: ${to}</h3>
      <h3>Subject: ${subject}</h3>
      <hr/>
      <div>${html}</div>
    `;
    fs.writeFileSync(filepath, fileContent);
    console.log(`💾 Mock email saved to file: ${filepath}`);
  } catch (fileErr) {
    console.error('❌ Failed to save mock email to file:', fileErr);
  }

  return true;
};

// Send OTP for email verification
const sendVerificationEmail = async (email, name, otp) => {
  const subject = 'Verify Your Email - SpareShare';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #10b981; text-align: center;">Welcome to SpareShare, ${name}!</h2>
      <p style="font-size: 1rem; color: #475569;">Thank you for registering with us. To complete your sign-up and verify your email address, please use the following 6-digit verification code:</p>
      <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
        <span style="font-size: 2.2rem; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${otp}</span>
      </div>
      <p style="font-size: 0.88rem; color: #64748b; text-align: center;">This code will expire in 15 minutes. If you did not request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">SpareShare - Reduce Food Waste, Share Love.</p>
    </div>
  `;
  const text = `Hello ${name},\n\nYour SpareShare verification code is: ${otp}\n\nThis code will expire in 15 minutes.`;
  return sendEmail({ to: email, subject, html, text });
};

// Send OTP for password reset
const sendPasswordResetEmail = async (email, name, otp) => {
  const subject = 'Password Reset Request - SpareShare';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #ef4444; text-align: center;">Reset Your Password</h2>
      <p style="font-size: 1rem; color: #475569;">Hello ${name},</p>
      <p style="font-size: 1rem; color: #475569;">We received a request to reset the password for your SpareShare account. Please use the following 6-digit code to reset your password:</p>
      <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
        <span style="font-size: 2.2rem; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${otp}</span>
      </div>
      <p style="font-size: 0.88rem; color: #64748b; text-align: center;">This code is valid for 15 minutes. If you did not request this, please ignore this email or contact support if you suspect unauthorized access.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">SpareShare - Reduce Food Waste, Share Love.</p>
    </div>
  `;
  const text = `Hello ${name},\n\nWe received a request to reset your password. Use verification code: ${otp} to complete your reset.\n\nThis code will expire in 15 minutes.`;
  return sendEmail({ to: email, subject, html, text });
};

// Send Approval email
const sendApprovalEmail = async (email, name) => {
  const subject = 'SpareShare Account Approved! 🎉';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #10b981; text-align: center;">Congratulations! 🎉</h2>
      <p style="font-size: 1rem; color: #475569;">Hello ${name},</p>
      <p style="font-size: 1rem; color: #475569;">We are thrilled to inform you that your SpareShare Receiver Portal application has been <strong>approved</strong> by our administrative team!</p>
      <p style="font-size: 1rem; color: #475569;">You can now log in to the Receiver Portal to list demands, accept food/medicine/clothes donations, and coordinate collections with donors.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1rem; display: inline-block;">Log In Now</a>
      </div>
      <p style="font-size: 0.88rem; color: #64748b;">If you have any questions or need assistance, feel free to reach out to our support team.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">SpareShare - Reduce Food Waste, Share Love.</p>
    </div>
  `;
  const text = `Hello ${name},\n\nWe are happy to inform you that your SpareShare Receiver application has been approved! You can now log in at ${process.env.FRONTEND_URL || 'http://localhost:5173'}.`;
  return sendEmail({ to: email, subject, html, text });
};

// Send Rejection email
const sendRejectionEmail = async (email, name, reason = 'Verification criteria not met') => {
  const subject = 'SpareShare Receiver Account Status';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #ef4444; text-align: center;">Application Update</h2>
      <p style="font-size: 1rem; color: #475569;">Hello ${name},</p>
      <p style="font-size: 1rem; color: #475569;">Thank you for your interest in joining SpareShare as a receiver. After carefully reviewing your application and verified details, we regret to inform you that we are unable to approve your account at this time.</p>
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
        <p style="font-size: 0.95rem; color: #991b1b; margin: 0;"><strong>Reason for rejection:</strong> ${reason}</p>
      </div>
      <p style="font-size: 0.88rem; color: #64748b;">If you believe this decision was made in error or if you can provide additional tax documentation or NGO validation, please reply to this email or register again with correct details.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">SpareShare - Reduce Food Waste, Share Love.</p>
    </div>
  `;
  const text = `Hello ${name},\n\nWe regret to inform you that your SpareShare Receiver application was not approved. Reason: ${reason}. Please contact us if you need details.`;
  return sendEmail({ to: email, subject, html, text });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendApprovalEmail,
  sendRejectionEmail
};
