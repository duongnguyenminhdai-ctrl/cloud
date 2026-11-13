const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

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
const {
  getPhoneVerificationSetting,
  setPhoneVerificationSetting,
  clearConfigCache
} = require('../src/utils/systemConfig');
const { checkAndSetRateLimit, getOTP, deleteOTP } = require('../src/utils/redis');
const { verifyFirebasePhoneToken } = require('../src/utils/firebaseAdmin');
const app = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

describe('Empirical Adversarial Challenge Suite: Phone Verification & SystemConfig', () => {
  const customerToken = jwt.sign(
    { userId: 'usr_cust_01', role: 'CUSTOMER', email: 'cust@foodfast.vn', name: 'Cust Test' },
    JWT_SECRET
  );
  const merchantToken = jwt.sign(
    { userId: 'usr_merch_01', role: 'RESTAURANT_OWNER', email: 'owner@foodfast.vn', name: 'Owner Test' },
    JWT_SECRET
  );
  const userToken = jwt.sign(
    { userId: 'usr_user_01', role: 'USER', email: 'user@foodfast.vn', name: 'User Test' },
    JWT_SECRET
  );
  const adminToken = jwt.sign(
    { userId: 'usr_admin_01', role: 'ADMIN', email: 'admin@foodfast.vn', name: 'Admin Root' },
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

  // =========================================================================
  // 1. SYSTEM CONFIG CACHING & DATABASE FALLBACK CHALLENGES
  // =========================================================================
  describe('SystemConfig Utility Stress Tests', () => {
    it('CHALLENGE 1.1: Cache hit vs Cache expiration (TTL = 5000ms)', async () => {
      const realDateNow = Date.now;
      let mockTime = 1000000;
      global.Date.now = jest.fn(() => mockTime);

      try {
        // Mock DB returns { value: true } on first call
        SystemConfig.findOne.mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ key: 'REQUIRE_PHONE_VERIFICATION', value: true })
        });

        // 1st call: DB hit
        const val1 = await getPhoneVerificationSetting();
        expect(val1).toBe(true);
        expect(SystemConfig.findOne).toHaveBeenCalledTimes(1);

        // 2nd call at mockTime + 2000ms (< TTL 5000ms): Cache hit, DB must NOT be called again
        mockTime += 2000;
        const val2 = await getPhoneVerificationSetting();
        expect(val2).toBe(true);
        expect(SystemConfig.findOne).toHaveBeenCalledTimes(1);

        // 3rd call at mockTime + 4000ms (total 6000ms > TTL 5000ms): Cache expired, DB MUST be called
        mockTime += 4000;
        SystemConfig.findOne.mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ key: 'REQUIRE_PHONE_VERIFICATION', value: false })
        });
        const val3 = await getPhoneVerificationSetting();
        expect(val3).toBe(false);
        expect(SystemConfig.findOne).toHaveBeenCalledTimes(2);
      } finally {
        global.Date.now = realDateNow;
      }
    });

    it('CHALLENGE 1.2: Cache invalidation upon setPhoneVerificationSetting()', async () => {
      // Seed initial cache as true
      SystemConfig.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ key: 'REQUIRE_PHONE_VERIFICATION', value: true })
      });
      const initial = await getPhoneVerificationSetting();
      expect(initial).toBe(true);

      // Now update setting to false
      await setPhoneVerificationSetting(false, 'admin_test_123');
      expect(process.env.REQUIRE_PHONE_VERIFICATION).toBe('false');

      // Next getPhoneVerificationSetting() must immediately reflect false without waiting for TTL
      const immediate = await getPhoneVerificationSetting();
      expect(immediate).toBe(false);
    });

    it('CHALLENGE 1.3: DB Disconnected or ReadState = 0 fallback to process.env', async () => {
      clearConfigCache();
      // Simulate disconnected Mongoose
      const origReadyState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

      // Ensure mock is not detected as active mock for this test
      const origFindOne = SystemConfig.findOne;
      delete SystemConfig.findOne._isMockFunction;
      SystemConfig.findOne.mock = null;

      try {
        process.env.REQUIRE_PHONE_VERIFICATION = 'true';
        clearConfigCache();
        const resTrue = await getPhoneVerificationSetting();
        expect(resTrue).toBe(true);

        process.env.REQUIRE_PHONE_VERIFICATION = 'false';
        clearConfigCache();
        const resFalse = await getPhoneVerificationSetting();
        expect(resFalse).toBe(false);
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
        SystemConfig.findOne = origFindOne;
      }
    });

    it('CHALLENGE 1.4: Database findOne exception handled gracefully without crashing', async () => {
      clearConfigCache();
      process.env.REQUIRE_PHONE_VERIFICATION = 'false';

      // Mock findOne throwing an unhandled MongoNetworkError
      SystemConfig.findOne.mockImplementation(() => {
        throw new Error('MongoNetworkTimeoutException: Atlas connection timed out');
      });

      // Must not throw, must fallback safely to false
      let result;
      expect(async () => {
        result = await getPhoneVerificationSetting();
      }).not.toThrow();
      result = await getPhoneVerificationSetting();
      expect(result).toBe(false);
    });

    it('CHALLENGE 1.5: Database findOneAndUpdate exception handled gracefully without crashing', async () => {
      clearConfigCache();
      SystemConfig.findOneAndUpdate.mockImplementation(() => {
        throw new Error('MongoWriteException: Primary stepped down');
      });

      let updatedDoc;
      expect(async () => {
        updatedDoc = await setPhoneVerificationSetting(true, 'admin_err_test');
      }).not.toThrow();

      updatedDoc = await setPhoneVerificationSetting(true, 'admin_err_test');
      expect(updatedDoc).toBeDefined();
      expect(updatedDoc.value).toBe(true);
      expect(process.env.REQUIRE_PHONE_VERIFICATION).toBe('true');
    });
  });

  // =========================================================================
  // 2. ADMIN TOGGLE SECURITY & ROUTE AUTHORIZATION CHALLENGES
  // =========================================================================
  describe('Admin Toggle Endpoint Security & Authorization', () => {
    it('CHALLENGE 2.1: Authentication rejections (Missing, Invalid, Malformed, Expired tokens)', async () => {
      // 1. Missing Authorization header -> 401
      const noAuth = await request(app).put('/api/v1/auth/admin/config/phone-verification').send({ required: true });
      expect(noAuth.statusCode).toBe(401);

      // 2. Empty Bearer token -> 401
      const emptyBearer = await request(app)
        .put('/api/v1/auth/admin/config/phone-verification')
        .set('Authorization', 'Bearer ')
        .send({ required: true });
      expect(emptyBearer.statusCode).toBe(401);

      // 3. Invalid token signature -> 401
      const fakeToken = jwt.sign({ userId: 'hacker', role: 'ADMIN' }, 'wrong_secret_attack');
      const badSig = await request(app)
        .put('/api/v1/auth/admin/config/phone-verification')
        .set('Authorization', `Bearer ${fakeToken}`)
        .send({ required: true });
      expect(badSig.statusCode).toBe(401);

      // 4. Expired token -> 401
      const expiredToken = jwt.sign(
        { userId: 'admin_expired', role: 'ADMIN' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );
      const expiredRes = await request(app)
        .put('/api/v1/auth/admin/config/phone-verification')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ required: true });
      expect(expiredRes.statusCode).toBe(401);
    });

    it('CHALLENGE 2.2: Role escalation attack: Non-admin roles (CUSTOMER, RESTAURANT_OWNER, USER) must receive 403', async () => {
      for (const token of [customerToken, merchantToken, userToken]) {
        // GET check
        const getRes = await request(app)
          .get('/api/v1/auth/admin/config/phone-verification')
          .set('Authorization', `Bearer ${token}`);
        expect(getRes.statusCode).toBe(403);
        expect(getRes.body.success).toBe(false);

        // PUT check
        const putRes = await request(app)
          .put('/api/v1/auth/admin/config/phone-verification')
          .set('Authorization', `Bearer ${token}`)
          .send({ required: false });
        expect(putRes.statusCode).toBe(403);
        expect(putRes.body.success).toBe(false);
      }
    });

    it('CHALLENGE 2.3: Input validation attacks on PUT body', async () => {
      const invalidPayloads = [
        {}, // Empty payload
        { required: 'true' }, // String instead of boolean
        { required: 'false' }, // String instead of boolean
        { required: 1 }, // Number instead of boolean
        { required: 0 }, // Number instead of boolean
        { required: null }, // Null
        { required: undefined }, // Undefined
        { enabled: 'yes' }, // Invalid string
        { enabled: [] }, // Array
        { enabled: {} }, // Object
      ];

      for (const payload of invalidPayloads) {
        const res = await request(app)
          .put('/api/v1/auth/admin/config/phone-verification')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload);
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });

    it('CHALLENGE 2.4: Valid admin toggles both required and enabled parameter names', async () => {
      // 1. With required: true
      SystemConfig.findOneAndUpdate.mockResolvedValueOnce({
        key: 'REQUIRE_PHONE_VERIFICATION',
        value: true,
        updatedAt: new Date()
      });
      const resReqTrue = await request(app)
        .put('/api/v1/auth/admin/config/phone-verification')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ required: true });
      expect(resReqTrue.statusCode).toBe(200);
      expect(resReqTrue.body.required).toBe(true);

      // 2. With enabled: false
      SystemConfig.findOneAndUpdate.mockResolvedValueOnce({
        key: 'REQUIRE_PHONE_VERIFICATION',
        value: false,
        updatedAt: new Date()
      });
      const resEnFalse = await request(app)
        .put('/api/v1/auth/admin/config/phone-verification')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false });
      expect(resEnFalse.statusCode).toBe(200);
      expect(resEnFalse.body.required).toBe(false);
    });
  });

  // =========================================================================
  // 3. REGISTRATION ADAPTIVE FLOW STRESS & EDGE CASES
  // =========================================================================
  describe('Registration Adaptive Flow Stress & Edge Cases', () => {
    beforeEach(() => {
      getOTP.mockResolvedValue('654321');
    });

    it('CHALLENGE 3.1: When required=true, attempts with mock phone but no firebaseIdToken are blocked with 400', async () => {
      process.env.REQUIRE_PHONE_VERIFICATION = 'true';
      clearConfigCache();
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Bypass Attempter',
          email: 'bypass@foodfast.vn',
          password: 'password123',
          otp: '654321',
          phone: '0969535231' // Trying to pass raw phone without firebaseIdToken
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Hệ thống yêu cầu xác thực số điện thoại qua mã OTP SMS');
    });

    it('CHALLENGE 3.2: When required=false, all valid Vietnam telco prefixes succeed with phoneVerified=true', async () => {
      process.env.REQUIRE_PHONE_VERIFICATION = 'false';
      clearConfigCache();
      User.findOne.mockResolvedValue(null);
      User.create.mockImplementation((data) => Promise.resolve({ _id: 'created_' + Math.random(), ...data }));

      const validPrefixPhones = [
        '0321234567', // Viettel 032
        '0389998888', // Viettel 038
        '0561234567', // Vietnamobile 056
        '0591234567', // Gmobile 059
        '0701234567', // Mobifone 070
        '0771234567', // Mobifone 077
        '0811234567', // Vinaphone 081
        '0881234567', // Vinaphone 088
        '0901234567', // Mobifone 090
        '0911234567', // Vinaphone 091
        '0981234567', // Viettel 098
        '+84 989 123 456', // International format with spacing
        '84989123456', // 84 prefix without +
        '098-912-3456' // Hyphenated format
      ];

      for (const testPhone of validPrefixPhones) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({
            name: 'Valid Phone Tester',
            email: `test_${Math.random().toString(36).substring(7)}@foodfast.vn`,
            password: 'password123',
            otp: '654321',
            phone: testPhone
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.user.phoneVerified).toBe(true);
        expect(res.body.user.phone).toMatch(/^0[35789]\d{8}$/);
      }
    });

    it('CHALLENGE 3.3: When required=false, invalid phone formats are rejected with 400', async () => {
      process.env.REQUIRE_PHONE_VERIFICATION = 'false';
      clearConfigCache();
      User.findOne.mockResolvedValue(null);

      const invalidPhones = [
        '0123456789', // Old 11-digit prefix
        '0000000000', // All zeros
        '0241234567', // Landline prefix (024)
        '123456', // Too short
        '096953523199', // Too long (12 digits)
        '0969abc231', // Non-numeric
        '+12025550123', // US Phone number
        'phone_test' // Plain text
      ];

      for (const badPhone of invalidPhones) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({
            name: 'Bad Phone Tester',
            email: `bad_${Math.random().toString(36).substring(7)}@foodfast.vn`,
            password: 'password123',
            otp: '654321',
            phone: badPhone
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });

    it('CHALLENGE 3.4: When required=false, duplicate phone against existing VERIFIED account returns 409', async () => {
      process.env.REQUIRE_PHONE_VERIFICATION = 'false';
      clearConfigCache();

      // Return existing user when searching by verified phone
      User.findOne.mockImplementation(({ email, phone, phoneVerified }) => {
        if (email) return Promise.resolve(null);
        if (phone === '0969535231' && phoneVerified === true) {
          return Promise.resolve({
            _id: 'existing_verified_user',
            phone: '0969535231',
            phoneVerified: true
          });
        }
        return Promise.resolve(null);
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Duplicate Phone Tester',
          email: 'dup_tester@foodfast.vn',
          password: 'password123',
          otp: '654321',
          phone: '0969535231'
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đã được tài khoản khác xác thực');
    });

    it('CHALLENGE 3.5: When required=false, duplicate phone against an UNVERIFIED account is permitted', async () => {
      process.env.REQUIRE_PHONE_VERIFICATION = 'false';
      clearConfigCache();

      // Email is unique. Phone exists in DB but phoneVerified is FALSE
      User.findOne.mockImplementation(({ email, phone, phoneVerified }) => {
        if (email) return Promise.resolve(null);
        if (phone === '0969535231' && phoneVerified === true) {
          // Unverified account doesn't match phoneVerified: true
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      User.create.mockImplementation((data) => Promise.resolve({ _id: 'user_created_unverified_dup', ...data }));

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Unverified Dup Phone Tester',
          email: 'unverified_dup@foodfast.vn',
          password: 'password123',
          otp: '654321',
          phone: '0969535231'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phoneVerified).toBe(true);
    });

    it('CHALLENGE 3.6: When required=false, empty/whitespace/null phone succeeds with phoneVerified=false', async () => {
      process.env.REQUIRE_PHONE_VERIFICATION = 'false';
      clearConfigCache();
      User.findOne.mockResolvedValue(null);
      User.create.mockImplementation((data) => Promise.resolve({ _id: 'no_phone_user', ...data }));

      const emptyPhones = ['', '   ', null, undefined];

      for (const emptyVal of emptyPhones) {
        const payload = {
          name: 'No Phone Tester',
          email: `nophone_${Math.random().toString(36).substring(7)}@foodfast.vn`,
          password: 'password123',
          otp: '654321'
        };
        if (emptyVal !== undefined) payload.phone = emptyVal;

        const res = await request(app)
          .post('/api/v1/auth/register')
          .send(payload);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.user.phone).toBe('');
        expect(res.body.user.phoneVerified).toBe(false);
      }
    });
  });
});
