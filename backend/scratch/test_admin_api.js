const axios = require('axios');

const API = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@spareshare.com';
const ADMIN_PASSWORD = 'Admin@1234';

async function testAdmin() {
  try {
    console.log('🔑 Authenticating as admin...');
    const loginRes = await axios.post(`${API}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const token = loginRes.data.token;
    console.log('✅ Admin Authenticated! Token:', token ? 'OK' : 'MISSING');

    const headers = { 'x-auth-token': token };

    console.log('\n--- GET /api/users/pending ---');
    try {
      const pRes = await axios.get(`${API}/api/users/pending`, { headers });
      console.log('Status:', pRes.status);
      console.log('Count:', pRes.data.length);
      console.log('Data:', JSON.stringify(pRes.data, null, 2));
    } catch (e) {
      console.error('Failed:', e.response?.data || e.message);
    }

    console.log('\n--- GET /api/users/all ---');
    try {
      const uRes = await axios.get(`${API}/api/users/all`, { headers });
      console.log('Status:', uRes.status);
      console.log('Count:', uRes.data.length);
    } catch (e) {
      console.error('Failed:', e.response?.data || e.message);
    }

    console.log('\n--- GET /api/donations/all ---');
    try {
      const dRes = await axios.get(`${API}/api/donations/all`, { headers });
      console.log('Status:', dRes.status);
      console.log('Count:', dRes.data.length);
    } catch (e) {
      console.error('Failed:', e.response?.data || e.message);
    }

    console.log('\n--- GET /api/reports ---');
    try {
      const rRes = await axios.get(`${API}/api/reports`, { headers });
      console.log('Status:', rRes.status);
      console.log('Count:', rRes.data.length);
    } catch (e) {
      console.error('Failed:', e.response?.data || e.message);
    }

    console.log('\n--- GET /api/users/admin-stats ---');
    try {
      const statsRes = await axios.get(`${API}/api/users/admin-stats`, { headers });
      console.log('Status:', statsRes.status);
      console.log('Stats:', JSON.stringify(statsRes.data.stats, null, 2));
      console.log('Weekly Data Example:', JSON.stringify(statsRes.data.weeklyData?.[0] || {}, null, 2));
    } catch (e) {
      console.error('Failed:', e.response?.data || e.message);
    }

  } catch (err) {
    console.error('❌ Login Failed:', err.response?.data || err.message);
  }
}

testAdmin();
