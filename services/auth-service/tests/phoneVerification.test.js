const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/models/User');
jest.mock('../src/utils/redis');
jest.mock('../src/utils/mailer');
jest.mock('../src/utils/firebaseAdmin', () => {
  const actual = jest.requireActual('../src/utils/firebaseAdmin');
  return {
    ...actual,
    isFirebaseAdminConfigured: jest.fn(() => true),
    verifyFirebasePhoneToken: jest.fn()
  };
});

const User = require('../src/models/User');
const { checkAndSetRateLimit } = require('../src/utils/redis');
const { normalizeVietnamPhone, verifyFirebasePhoneToken } = require('../src/utils/firebaseAdmin');
const app = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

describe('Firebase Phone Auth & Anti-Spam Phone Tests', () => {
  const userToken = jwt.sign(
    { userId: 'user_phone_01', role: 'CUSTOMER', email: 'buyer@foodfast.vn', name: 'Nguyen Van A' },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
    checkAndSetRateLimit.mockResolvedValue({ allowed: true, remaining: 0 });
  });

  it('normalizeVietnamPhone: Chuẩn hóa đúng +84/84/0xxx và chặn SĐT rác sai định dạng', () => {
    expect(normalizeVietnamPhone('+84 969 535 231')).toEqual({
      valid: true,
      local: '0969535231',
      e164: '+84969535231',
      reason: ''
    });
    expect(normalizeVietnamPhone('84381234567')).toEqual({
      valid: true,
      local: '0381234567',
      e164: '+84381234567',
      reason: ''
    });

    expect(normalizeVietnamPhone('0000000000').valid).toBe(false);
    expect(normalizeVietnamPhone('123456').valid).toBe(false);
    expect(normalizeVietnamPhone('0123456789').valid).toBe(false);
  });

  it('POST /api/v1/auth/phone/check-available: Chặn SĐT đã bị tài khoản khác xác thực SMS', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'other_user_id' })
    });

    const res = await request(app)
      .post('/api/v1/auth/phone/check-available')
      .send({ phone: '0969535231' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(false);
    expect(res.body.normalizedPhone).toBe('0969535231');
  });

  it('POST /api/v1/auth/phone/verify-firebase: Xác thực Firebase ID Token -> cập nhật phoneVerified = true và cấp JWT mới', async () => {
    verifyFirebasePhoneToken.mockResolvedValue({
      uid: 'fb_uid_123',
      localPhone: '0969535231',
      e164Phone: '+84969535231',
      provider: 'phone'
    });

    const mockUser = {
      _id: 'user_phone_01',
      name: 'Nguyen Van A',
      email: 'buyer@foodfast.vn',
      role: 'CUSTOMER',
      phone: '',
      phoneVerified: false,
      save: jest.fn().mockResolvedValue(true)
    };
    User.findById.mockResolvedValue(mockUser);
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/phone/verify-firebase')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ idToken: 'valid_firebase_token', purpose: 'STORE_REGISTER' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.phone).toBe('0969535231');
    expect(res.body.phoneVerified).toBe(true);
    expect(res.body.storePhoneProofToken).toBeDefined();
    expect(mockUser.phone).toBe('0969535231');
    expect(mockUser.phoneVerified).toBe(true);
    expect(mockUser.firebasePhoneUid).toBe('fb_uid_123');
    expect(mockUser.save).toHaveBeenCalled();
  });

  it('POST /api/v1/auth/phone/verify-firebase: Từ chối 409 nếu SĐT đã được xác thực trên tài khoản khác', async () => {
    verifyFirebasePhoneToken.mockResolvedValue({
      uid: 'fb_uid_dup',
      localPhone: '0969535231',
      e164Phone: '+84969535231',
      provider: 'phone'
    });

    User.findById.mockResolvedValue({
      _id: 'user_phone_01',
      email: 'buyer@foodfast.vn'
    });
    User.findOne.mockResolvedValue({
      _id: 'existing_owner_99',
      phone: '0969535231',
      phoneVerified: true
    });

    const res = await request(app)
      .post('/api/v1/auth/phone/verify-firebase')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ idToken: 'valid_firebase_token' });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/v1/auth/profile: Reset phoneVerified = false khi người dùng đổi sang SĐT mới chưa xác thực SMS', async () => {
    const mockUser = {
      _id: 'user_phone_01',
      name: 'Nguyen Van A',
      email: 'buyer@foodfast.vn',
      role: 'CUSTOMER',
      phone: '0969535231',
      phoneVerified: true,
      save: jest.fn().mockResolvedValue(true)
    };
    User.findById.mockResolvedValue(mockUser);
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ phone: '0912345678' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.phone).toBe('0912345678');
    expect(res.body.data.phoneVerified).toBe(false);
    expect(mockUser.phoneVerified).toBe(false);
  });
});

