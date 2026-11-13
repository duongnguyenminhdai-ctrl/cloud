const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/models/User');
jest.mock('../src/models/SystemConfig');
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
const SystemConfig = require('../src/models/SystemConfig');
const { clearConfigCache } = require('../src/utils/systemConfig');
const { checkAndSetRateLimit, getOTP, deleteOTP } = require('../src/utils/redis');
const { normalizeVietnamPhone, verifyFirebasePhoneToken } = require('../src/utils/firebaseAdmin');
const app = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

describe('Firebase Phone Auth & Anti-Spam Phone Tests', () => {
  const userToken = jwt.sign(
    { userId: 'user_phone_01', role: 'CUSTOMER', email: 'buyer@foodfast.vn', name: 'Nguyen Van A' },
    JWT_SECRET
  );
  const adminToken = jwt.sign(
    { userId: 'admin_phone_01', role: 'ADMIN', email: 'admin@foodfast.vn', name: 'Admin Root' },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
    clearConfigCache();
    checkAndSetRateLimit.mockResolvedValue({ allowed: true, remaining: 0 });
    deleteOTP.mockResolvedValue(true);
    SystemConfig.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });
    SystemConfig.findOneAndUpdate.mockResolvedValue({
      key: 'REQUIRE_PHONE_VERIFICATION',
      value: false,
      updatedAt: new Date()
    });
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

  // ---------------------------------------------------------------------------
  // PUBLIC & ADMIN PHONE CONFIGURATION ENDPOINTS
  // ---------------------------------------------------------------------------
  it('GET /api/v1/auth/phone/config-status: Trả về trạng thái cấu hình công khai', async () => {
    process.env.REQUIRE_PHONE_VERIFICATION = 'false';
    const res = await request(app).get('/api/v1/auth/phone/config-status');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.firebaseConfigured).toBe(true);
    expect(res.body.required).toBe(false);
  });

  it('GET /api/v1/auth/admin/config/phone-verification: Kiểm tra phân quyền Admin', async () => {
    // 1. Chưa đăng nhập -> 401
    const unauthRes = await request(app).get('/api/v1/auth/admin/config/phone-verification');
    expect(unauthRes.statusCode).toBe(401);

    // 2. Tài khoản thường (CUSTOMER) -> 403
    const forbiddenRes = await request(app)
      .get('/api/v1/auth/admin/config/phone-verification')
      .set('Authorization', `Bearer ${userToken}`);
    expect(forbiddenRes.statusCode).toBe(403);

    // 3. Admin hợp lệ -> 200
    const adminRes = await request(app)
      .get('/api/v1/auth/admin/config/phone-verification')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(typeof adminRes.body.required).toBe('boolean');
    expect(adminRes.body.firebaseConfigured).toBe(true);
  });

  it('PUT /api/v1/auth/admin/config/phone-verification: Admin cập nhật toggle trạng thái xác minh SĐT', async () => {
    // 1. Chặn người dùng thường
    const forbiddenRes = await request(app)
      .put('/api/v1/auth/admin/config/phone-verification')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ required: false });
    expect(forbiddenRes.statusCode).toBe(403);

    // 2. Chặn giá trị không phải boolean
    const badReqRes = await request(app)
      .put('/api/v1/auth/admin/config/phone-verification')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ required: 'invalid_string' });
    expect(badReqRes.statusCode).toBe(400);

    // 3. Admin tắt xác minh thành công -> required = false
    SystemConfig.findOneAndUpdate.mockResolvedValue({
      key: 'REQUIRE_PHONE_VERIFICATION',
      value: false,
      updatedAt: new Date()
    });
    const turnOffRes = await request(app)
      .put('/api/v1/auth/admin/config/phone-verification')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ required: false });
    expect(turnOffRes.statusCode).toBe(200);
    expect(turnOffRes.body.success).toBe(true);
    expect(turnOffRes.body.required).toBe(false);
    expect(process.env.REQUIRE_PHONE_VERIFICATION).toBe('false');

    // 4. Admin bật lại xác minh thành công -> required = true
    clearConfigCache();
    SystemConfig.findOneAndUpdate.mockResolvedValue({
      key: 'REQUIRE_PHONE_VERIFICATION',
      value: true,
      updatedAt: new Date()
    });
    const turnOnRes = await request(app)
      .put('/api/v1/auth/admin/config/phone-verification')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ required: true });
    expect(turnOnRes.statusCode).toBe(200);
    expect(turnOnRes.body.success).toBe(true);
    expect(turnOnRes.body.required).toBe(true);
    expect(process.env.REQUIRE_PHONE_VERIFICATION).toBe('true');
  });

  // ---------------------------------------------------------------------------
  // REGISTRATION FLOW: ADAPTIVE PHONE VERIFICATION
  // ---------------------------------------------------------------------------
  it('POST /api/v1/auth/register: Từ chối 400 nếu REQUIRE_PHONE_VERIFICATION=true mà không có firebaseIdToken', async () => {
    process.env.REQUIRE_PHONE_VERIFICATION = 'true';
    clearConfigCache();
    getOTP.mockResolvedValue('123456');
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Nguyen Van B',
        email: 'newuser@foodfast.vn',
        password: 'password123',
        otp: '123456'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Hệ thống yêu cầu xác thực số điện thoại qua mã OTP SMS');
  });

  it('POST /api/v1/auth/register: Cho phép đăng ký khi REQUIRE_PHONE_VERIFICATION=false mà không cần firebaseIdToken (Tài khoản kiểm thử)', async () => {
    process.env.REQUIRE_PHONE_VERIFICATION = 'false';
    clearConfigCache();
    getOTP.mockResolvedValue('123456');
    User.findOne.mockResolvedValue(null); // Không trùng email, không trùng SĐT
    User.create.mockImplementation((userData) =>
      Promise.resolve({
        _id: 'user_test_mock_123',
        ...userData
      })
    );

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Tester Nguyen',
        email: 'tester@foodfast.vn',
        password: 'password123',
        otp: '123456',
        phone: '0969535231' // SĐT hợp lệ, không có firebaseIdToken
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.phone).toBe('0969535231');
    expect(res.body.user.phoneVerified).toBe(true);

    // Kiểm tra User.create được truyền phoneVerified = true và phoneVerifiedAt
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'tester@foodfast.vn',
        phone: '0969535231',
        phoneVerified: true,
        phoneVerifiedAt: expect.any(Date)
      })
    );
  });

  it('POST /api/v1/auth/register: Từ chối 409 nếu SĐT kiểm thử đã được tài khoản khác xác thực trước đó', async () => {
    process.env.REQUIRE_PHONE_VERIFICATION = 'false';
    clearConfigCache();
    getOTP.mockResolvedValue('123456');

    // Email chưa tồn tại, nhưng SĐT đã có tài khoản khác xác thực
    User.findOne.mockImplementation(({ email, phone }) => {
      if (email) return Promise.resolve(null);
      if (phone === '0969535231') return Promise.resolve({ _id: 'other_owner_id', phone: '0969535231', phoneVerified: true });
      return Promise.resolve(null);
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Tester Dup Phone',
        email: 'tester_dup@foodfast.vn',
        password: 'password123',
        otp: '123456',
        phone: '0969535231'
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('đã được tài khoản khác xác thực');
  });

  it('POST /api/v1/auth/register: Từ chối 400 nếu SĐT nhập vào sai định dạng di động Việt Nam', async () => {
    process.env.REQUIRE_PHONE_VERIFICATION = 'false';
    clearConfigCache();
    getOTP.mockResolvedValue('123456');
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Tester Bad Phone',
        email: 'tester_bad@foodfast.vn',
        password: 'password123',
        otp: '123456',
        phone: '0123456789' // Đầu số 012 không còn hợp lệ tại Việt Nam
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/register: Cho phép đăng ký không kèm SĐT khi REQUIRE_PHONE_VERIFICATION=false', async () => {
    process.env.REQUIRE_PHONE_VERIFICATION = 'false';
    clearConfigCache();
    getOTP.mockResolvedValue('123456');
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation((userData) =>
      Promise.resolve({
        _id: 'user_test_no_phone',
        ...userData
      })
    );

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Tester No Phone',
        email: 'tester_nophone@foodfast.vn',
        password: 'password123',
        otp: '123456'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.phone).toBe('');
    expect(res.body.user.phoneVerified).toBe(false);
  });
});

