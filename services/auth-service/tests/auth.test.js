const request = require('supertest');

// 1. Mocking triệt để Models, Redis, Mailer và Fetch trước khi nạp app
jest.mock('../src/models/User');
jest.mock('../src/utils/redis');
jest.mock('../src/utils/mailer');

const User = require('../src/models/User');
const { getOTP, deleteOTP, saveOTP, checkAndSetRateLimit } = require('../src/utils/redis');
const app = require('../app');

describe('Auth Service - Unit Tests (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REQUIRE_PHONE_VERIFICATION = 'false';
  });

  // ---------------------------------------------------------------------------
  // a. Test POST /api/v1/auth/register
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/auth/register', () => {
    it('Đăng ký thành công trả về 201 kèm JWT token', async () => {
      // Mock OTP hợp lệ trong Redis
      getOTP.mockResolvedValue('123456');
      deleteOTP.mockResolvedValue(true);

      // Mock chưa có email trong hệ thống
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: '65f1234567890abcdef12345',
        name: 'Nguyễn Văn Test',
        email: 'testuser@example.com',
        role: 'CUSTOMER'
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Nguyễn Văn Test',
          email: 'testuser@example.com',
          password: 'password123',
          role: 'CUSTOMER',
          otp: '123456'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('testuser@example.com');
      expect(deleteOTP).toHaveBeenCalledWith('REGISTER', 'testuser@example.com');
    });

    it('Từ chối khi trùng email trả về 400', async () => {
      getOTP.mockResolvedValue('123456');

      // Giả lập email đã tồn tại
      User.findOne.mockResolvedValue({
        _id: 'existing_id',
        email: 'testuser@example.com'
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Nguyễn Văn Test',
          email: 'testuser@example.com',
          password: 'password123',
          otp: '123456'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/đã được sử dụng/i);
    });
  });

  // ---------------------------------------------------------------------------
  // b. Test POST /api/v1/auth/login
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/auth/login', () => {
    it('Đăng nhập thành công trả về 200 kèm JWT token khi đúng mật khẩu', async () => {
      const mockUser = {
        _id: '65f1234567890abcdef12345',
        name: 'Nguyễn Văn Test',
        email: 'testuser@example.com',
        role: 'CUSTOMER',
        matchPassword: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.name).toBe('Nguyễn Văn Test');
      expect(mockUser.matchPassword).toHaveBeenCalledWith('password123');
    });

    it('Từ chối khi sai mật khẩu trả về 401', async () => {
      const mockUser = {
        _id: '65f1234567890abcdef12345',
        email: 'testuser@example.com',
        matchPassword: jest.fn().mockResolvedValue(false)
      };

      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'wrong_password'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/không chính xác/i);
    });
  });

  // ---------------------------------------------------------------------------
  // c. Test POST /api/v1/auth/otp/verify
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/auth/otp/verify', () => {
    it('Xác thực mã OTP 6 số thành công từ Redis mock trả về 200', async () => {
      getOTP.mockResolvedValue('654321');

      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          email: 'testuser@example.com',
          otp: '654321',
          type: 'REGISTER'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/thành công/i);
    });
  });

  // ---------------------------------------------------------------------------
  // d. Test POST /api/v1/auth/google
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/auth/google', () => {
    it('Trả về JWT hợp lệ khi Google IdToken được verify thành công (200)', async () => {
      // Mock Google Tokeninfo API response
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          aud: '706124961536-m0cegjnn45imfdo5ejpcseaafkdnjg8m.apps.googleusercontent.com',
          sub: 'google_user_id_9999',
          email: 'googleuser@gmail.com',
          name: 'Google User Tester',
          picture: 'https://lh3.googleusercontent.com/avatar.png'
        })
      });

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'google_mongo_user_123',
        name: 'Google User Tester',
        email: 'googleuser@gmail.com',
        googleId: 'google_user_id_9999',
        role: 'CUSTOMER',
        avatar: 'https://lh3.googleusercontent.com/avatar.png'
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({
          credential: 'mock_google_id_token_xyz'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('googleuser@gmail.com');

      // Khôi phục fetch gốc
      global.fetch = originalFetch;
    });
  });
});
