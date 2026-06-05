const axios = require('axios');

const API = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@spareshare.com';
const ADMIN_PASSWORD = 'Admin@1234';

async function testActions() {
  try {
    console.log('🔑 Authenticating as admin...');
    const loginRes = await axios.post(`${API}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const token = loginRes.data.token;
    console.log('✅ Admin Authenticated! Token:', token ? 'OK' : 'MISSING');

    const headers = { 'x-auth-token': token };

    // Get pending receivers
    console.log('\n--- Fetching pending receivers ---');
    const pendingRes = await axios.get(`${API}/api/users/pending`, { headers });
    console.log(`Pending receivers count: ${pendingRes.data.length}`);

    if (pendingRes.data.length > 0) {
      const targetUser = pendingRes.data[0];
      console.log(`Target pending user: ${targetUser.name} (${targetUser.email}) ID: ${targetUser._id}`);

      // Try to approve
      console.log(`\n--- Attempting to approve user ${targetUser._id} ---`);
      try {
        const verifyRes = await axios.put(`${API}/api/users/${targetUser._id}/verify`, {}, { headers });
        console.log('Verify Success:', verifyRes.data);
      } catch (err) {
        console.error('Verify Failed:', err.response?.status, err.response?.data || err.message);
      }
    } else {
      console.log('No pending receivers to test approve.');
    }

    // Get all users
    console.log('\n--- Fetching all users ---');
    const allUsersRes = await axios.get(`${API}/api/users/all`, { headers });
    const receivers = allUsersRes.data.filter(u => u.role === 'receiver');
    console.log(`Total receivers: ${receivers.length}`);

    if (receivers.length > 0) {
      const firstReceiver = receivers[0];
      console.log(`Target receiver for block test: ${firstReceiver.name} ID: ${firstReceiver._id} isBlocked: ${firstReceiver.isBlocked}`);

      // Try block
      console.log(`\n--- Attempting to toggle block for ${firstReceiver._id} ---`);
      try {
        const action = firstReceiver.isBlocked ? 'unblock' : 'block';
        const blockRes = await axios.put(`${API}/api/users/${firstReceiver._id}/${action}`, {}, { headers });
        console.log('Block Success:', blockRes.data);
      } catch (err) {
        console.error('Block Failed:', err.response?.status, err.response?.data || err.message);
      }
    }

  } catch (err) {
    console.error('❌ Login Failed:', err.response?.data || err.message);
  }
}

testActions();
