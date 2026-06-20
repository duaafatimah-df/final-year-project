const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('SpareShare AI API Health & Verification Tests', () => {
  beforeAll(async () => {
    // Wait for connection to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('should respond with 200 OK on health check endpoint', async () => {
    const res = await request(app)
      .get('/api/health');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body.message).toContain('SpareShare AI API is running');
  });

  it('should return 400/401 Bad Request on invalid login credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: "nonexistent_test_user_xyz@spareshare.com",
        password: "wrongpassword"
      });

    expect([400, 401, 404]).toContain(res.statusCode);
  });
});
