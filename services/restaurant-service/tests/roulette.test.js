const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock Redis & RabbitMQ
jest.mock('../redis', () => ({
  client: { isOpen: false },
  getCache: jest.fn(),
  setCache: jest.fn(),
  deleteCache: jest.fn(),
  invalidateRestaurantCache: jest.fn().mockResolvedValue(true),
  decrQuota: jest.fn(),
  incrQuota: jest.fn(),
  setQuota: jest.fn(),
  TTL: 3600
}));

jest.mock('../src/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue({}),
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn().mockResolvedValue({})
}));

// Mock Models
jest.mock('../src/models/Restaurant');
jest.mock('../src/models/RouletteSession');
jest.mock('../src/models/RouletteSpinLog');
jest.mock('../src/models/Voucher');
jest.mock('../src/models/Review');
jest.mock('../src/models/CustomerNotification');

const Restaurant = require('../src/models/Restaurant');
const RouletteSession = require('../src/models/RouletteSession');
const RouletteSpinLog = require('../src/models/RouletteSpinLog');
const app = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

describe('Decision Roulette (Requirement R1) - Unit & Integration Tests', () => {
  const testUserId = 'user_roulette_001';
  const otherUserId = 'user_roulette_999';
  const validToken = jwt.sign({ userId: testUserId, role: 'USER', email: 'roulette@test.com' }, JWT_SECRET);
  const otherToken = jwt.sign({ userId: otherUserId, role: 'USER', email: 'other@test.com' }, JWT_SECRET);

  let mockSessions = [];
  let mockSpinLogs = [];

  const sampleDishes = [
    { menuItemId: 'dish_1', name: 'Cà phê sữa đá Sài Gòn', price: 25000, description: 'Đậm đà tỉnh táo', restaurantId: 'res_1', restaurantName: 'The Coffee House' },
    { menuItemId: 'dish_2', name: 'Bánh mì thịt nướng giòn rụm', price: 30000, description: 'Tiết kiệm bữa sáng', restaurantId: 'res_2', restaurantName: 'Bánh Mì Huỳnh Hoa' },
    { menuItemId: 'dish_3', name: 'Cơm tấm sườn bì chả đặc biệt', price: 55000, description: 'Ăn no chắc bụng', restaurantId: 'res_3', restaurantName: 'Cơm Tấm Ba Ghiền' },
    { menuItemId: 'dish_4', name: 'Trà đào cam sả thanh mát', price: 42000, description: 'Giải nhiệt xế chiều', restaurantId: 'res_1', restaurantName: 'The Coffee House' },
    { menuItemId: 'dish_5', name: 'Nem chua rán Phố Cổ', price: 35000, description: 'Ăn vặt giòn ngon', restaurantId: 'res_4', restaurantName: 'Ăn Vặt 36' },
    { menuItemId: 'dish_6', name: 'Bún bò Huế bắp bò giò heo', price: 65000, description: 'Hương vị cung đình', restaurantId: 'res_5', restaurantName: 'Bún Bò Đông Ba' },
    { menuItemId: 'dish_7', name: 'Gà rán sốt cay Hàn Quốc', price: 85000, description: 'Giòn cay đậm vị', restaurantId: 'res_6', restaurantName: 'Chimaek Station' },
    { menuItemId: 'dish_8', name: 'Phở bò tái lăn Hà Nội', price: 75000, description: 'Nước dùng gia truyền', restaurantId: 'res_7', restaurantName: 'Phở Thìn 13 Lò Đúc' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSessions = [];
    mockSpinLogs = [];

    // Cài đặt hành vi Mock thực tế cho Restaurant.aggregate
    Restaurant.aggregate = jest.fn().mockImplementation(async () => {
      // Trả về bản sao của danh sách 8 món mẫu
      return sampleDishes.map((d) => ({ ...d }));
    });

    // Cài đặt hành vi Mock thực tế cho RouletteSession
    RouletteSession.create = jest.fn().mockImplementation(async (doc) => {
      const record = {
        _id: `sess_id_${mockSessions.length + 1}`,
        sessionId: doc.sessionId,
        userId: doc.userId,
        menuItemId: doc.menuItemId,
        menuItemName: doc.menuItemName,
        restaurantId: doc.restaurantId,
        restaurantName: doc.restaurantName,
        bonusType: doc.bonusType || 'DOUBLE_COINS',
        isUsed: false,
        usedAt: null,
        orderId: null,
        expiresAt: new Date(doc.expiresAt),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockSessions.push(record);
      return record;
    });

    RouletteSession.findOne = jest.fn().mockImplementation(async (query) => {
      return mockSessions.find((s) => s.sessionId === query.sessionId) || null;
    });

    RouletteSession.deleteOne = jest.fn().mockImplementation(async (query) => {
      const idx = mockSessions.findIndex((s) => s.sessionId === query.sessionId);
      if (idx !== -1) mockSessions.splice(idx, 1);
      return { deletedCount: idx !== -1 ? 1 : 0 };
    });

    RouletteSession.findOneAndUpdate = jest.fn().mockImplementation(async (filter, update) => {
      const session = mockSessions.find((s) => {
        if (filter.sessionId && s.sessionId !== filter.sessionId) return false;
        if (filter.userId && s.userId !== filter.userId) return false;
        if (filter.menuItemId && s.menuItemId !== filter.menuItemId) return false;
        if (filter.isUsed !== undefined && s.isUsed !== filter.isUsed) return false;
        if (filter.expiresAt?.$gt && !(new Date(s.expiresAt) > filter.expiresAt.$gt)) return false;
        return true;
      });

      if (!session) return null;

      if (update.$set) {
        Object.assign(session, update.$set);
      }
      return { ...session };
    });

    // Cài đặt hành vi Mock thực tế cho RouletteSpinLog
    RouletteSpinLog.findOne = jest.fn().mockImplementation(async (query) => {
      return mockSpinLogs.find((l) => l.userId === query.userId && l.dateStr === query.dateStr) || null;
    });

    RouletteSpinLog.findOneAndUpdate = jest.fn().mockImplementation(async (filter, update, options) => {
      let log = mockSpinLogs.find((l) => l.userId === filter.userId && l.dateStr === filter.dateStr);

      if (filter.count?.$lt !== undefined) {
        if (log && log.count >= filter.count.$lt) {
          return null; // Quá giới hạn, không khớp filter
        }
      }

      if (!log) {
        if (options && options.upsert) {
          log = {
            userId: filter.userId,
            dateStr: filter.dateStr,
            count: 0,
            spins: []
          };
          mockSpinLogs.push(log);
        } else {
          return null;
        }
      }

      if (update.$inc && update.$inc.count) {
        log.count += update.$inc.count;
      }
      if (update.$push && update.$push.spins) {
        log.spins.push(update.$push.spins);
      }

      return { ...log };
    });
  });

  // ---------------------------------------------------------------------------
  // Test 1: Spin Endpoint trả về 8 món, winnerItem, winnerIndex (0-7), 5m sessionId
  // ---------------------------------------------------------------------------
  it('Test 1: POST /api/v1/restaurants/roulette/spin - Trả về 8 món ăn, winnerIndex (0-7) và session 5 phút', async () => {
    const res = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ budget: 'all', mood: 'all' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const { items, winnerIndex, winnerItem, sessionId, bonusType, expiresAt, spinsRemaining } = res.body.data;

    // Đảm bảo đúng 8 ô cho vòng quay
    expect(items).toHaveLength(8);
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(winnerIndex).toBeLessThan(8);

    // Món trúng thưởng phải khớp với ô chỉ định
    expect(winnerItem.menuItemId).toBe(items[winnerIndex].menuItemId);
    expect(winnerItem.name).toBe(items[winnerIndex].name);

    // Session thông số hợp lệ
    expect(sessionId).toMatch(/^rsess_\d+_[a-f0-9]+$/);
    expect(bonusType).toBe('DOUBLE_COINS');

    // Thời gian hết hạn là khoảng 5 phút trong tương lai
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(4 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(5 * 60 * 1000 + 2000);

    // Lượt quay còn lại giảm xuống 2 (ban đầu 3 - 1)
    expect(spinsRemaining).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Rate Limiting chặn lượt quay thứ 4 trong cùng ngày với HTTP 429
  // ---------------------------------------------------------------------------
  it('Test 2: Rate limit tối đa 3 lượt quay/ngày - Chặn lượt thứ 4 với HTTP 429 và resetAt', async () => {
    // Lượt 1
    const res1 = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ budget: 'all', mood: 'all' });
    expect(res1.statusCode).toBe(200);
    expect(res1.body.data.spinsRemaining).toBe(2);

    // Lượt 2
    const res2 = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ budget: 'under_40k', mood: 'saving' });
    expect(res2.statusCode).toBe(200);
    expect(res2.body.data.spinsRemaining).toBe(1);

    // Lượt 3
    const res3 = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ budget: 'above_70k', mood: 'snack' });
    expect(res3.statusCode).toBe(200);
    expect(res3.body.data.spinsRemaining).toBe(0);

    // Lượt 4: Bị chặn với HTTP 429
    const res4 = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ budget: 'all', mood: 'all' });

    expect(res4.statusCode).toBe(429);
    expect(res4.body.success).toBe(false);
    expect(res4.body.message).toMatch(/hết 3\/3 lượt quay/i);
    expect(res4.body.spinsRemaining).toBe(0);
    expect(res4.body.maxSpins).toBe(3);
    expect(res4.body.resetAt).toBeDefined();
    expect(res4.body.resetInSeconds).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Tra cứu trạng thái số lượt quay còn lại (GET /status)
  // ---------------------------------------------------------------------------
  it('Test 3: GET /api/v1/restaurants/roulette/status - Trả về số lượt quay còn lại chính xác', async () => {
    // Trước khi quay: 3 lượt
    const resInit = await request(app)
      .get('/api/v1/restaurants/roulette/status')
      .set('Authorization', `Bearer ${validToken}`);

    expect(resInit.statusCode).toBe(200);
    expect(resInit.body.data.spinsRemaining).toBe(3);
    expect(resInit.body.data.maxSpins).toBe(3);
    expect(resInit.body.data.resetAt).toBeDefined();

    // Quay 1 lượt
    await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`);

    // Sau khi quay: 2 lượt
    const resAfter = await request(app)
      .get('/api/v1/restaurants/roulette/status')
      .set('Authorization', `Bearer ${validToken}`);

    expect(resAfter.statusCode).toBe(200);
    expect(resAfter.body.data.spinsRemaining).toBe(2);
    expect(resAfter.body.data.spinsUsed).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 4: Tra cứu phiên quay thưởng trước 5 phút (GET /session/:sessionId)
  // ---------------------------------------------------------------------------
  it('Test 4: GET /api/v1/restaurants/roulette/session/:sessionId - Tra cứu phiên hợp lệ', async () => {
    // Tạo 1 phiên quay
    const spinRes = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`);

    const { sessionId, winnerItem } = spinRes.body.data;

    // Tra cứu phiên
    const inspectRes = await request(app)
      .get(`/api/v1/restaurants/roulette/session/${sessionId}`);

    expect(inspectRes.statusCode).toBe(200);
    expect(inspectRes.body.success).toBe(true);
    expect(inspectRes.body.data.sessionId).toBe(sessionId);
    expect(inspectRes.body.data.menuItemId).toBe(winnerItem.menuItemId);
    expect(inspectRes.body.data.bonusType).toBe('DOUBLE_COINS');
    expect(inspectRes.body.data.isValid).toBe(true);
    expect(inspectRes.body.data.isExpired).toBe(false);
    expect(inspectRes.body.data.isUsed).toBe(false);

    // Phiên không tồn tại trả về 404
    const notFoundRes = await request(app)
      .get('/api/v1/restaurants/roulette/session/rsess_invalid_dummy_999');
    expect(notFoundRes.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Tiêu thụ phiên quay (POST /session/:sessionId/consume)
  // ---------------------------------------------------------------------------
  it('Test 5: POST /api/v1/restaurants/roulette/session/:sessionId/consume - Tiêu thụ thành công và chặn tái sử dụng', async () => {
    const spinRes = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`);

    const { sessionId, winnerItem } = spinRes.body.data;

    // Lần tiêu thụ 1: Hợp lệ
    const consumeRes = await request(app)
      .post(`/api/v1/restaurants/roulette/session/${sessionId}/consume`)
      .send({
        userId: testUserId,
        orderId: 'order_test_888',
        menuItemId: winnerItem.menuItemId
      });

    expect(consumeRes.statusCode).toBe(200);
    expect(consumeRes.body.success).toBe(true);
    expect(consumeRes.body.bonusType).toBe('DOUBLE_COINS');
    expect(consumeRes.body.data.orderId).toBe('order_test_888');

    // Lần tiêu thụ 2: Bị từ chối vì đã sử dụng
    const secondConsumeRes = await request(app)
      .post(`/api/v1/restaurants/roulette/session/${sessionId}/consume`)
      .send({
        userId: testUserId,
        orderId: 'order_test_999',
        menuItemId: winnerItem.menuItemId
      });

    expect(secondConsumeRes.statusCode).toBe(400);
    expect(secondConsumeRes.body.success).toBe(false);
    expect(secondConsumeRes.body.code).toBe('SESSION_ALREADY_USED');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Từ chối phiên quá hạn hoặc không khớp tài khoản/món ăn
  // ---------------------------------------------------------------------------
  it('Test 6: Từ chối phiên quá hạn 5 phút hoặc sai người dùng/sai món ăn', async () => {
    const spinRes = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${validToken}`);

    const { sessionId, winnerItem } = spinRes.body.data;

    // 6.1 Sai người dùng (User Mismatch)
    const wrongUserRes = await request(app)
      .post(`/api/v1/restaurants/roulette/session/${sessionId}/consume`)
      .send({
        userId: 'intruder_user_999',
        orderId: 'order_hacker',
        menuItemId: winnerItem.menuItemId
      });

    expect(wrongUserRes.statusCode).toBe(403);
    expect(wrongUserRes.body.code).toBe('USER_MISMATCH');

    // 6.2 Sai món ăn (Item Mismatch)
    const wrongItemRes = await request(app)
      .post(`/api/v1/restaurants/roulette/session/${sessionId}/consume`)
      .send({
        userId: testUserId,
        orderId: 'order_test_777',
        menuItemId: 'dish_completely_different_999'
      });

    expect(wrongItemRes.statusCode).toBe(400);
    expect(wrongItemRes.body.code).toBe('ITEM_MISMATCH');

    // 6.3 Hết hạn phiên (Quá 5 phút)
    const targetSession = mockSessions.find((s) => s.sessionId === sessionId);
    targetSession.expiresAt = new Date(Date.now() - 60 * 1000); // Đã quá hạn 1 phút trước

    const expiredRes = await request(app)
      .post(`/api/v1/restaurants/roulette/session/${sessionId}/consume`)
      .send({
        userId: testUserId,
        orderId: 'order_late',
        menuItemId: winnerItem.menuItemId
      });

    expect(expiredRes.statusCode).toBe(400);
    expect(expiredRes.body.code).toBe('SESSION_EXPIRED');
  });

  // ---------------------------------------------------------------------------
  // Test 7: Yêu cầu xác thực đăng nhập (401 Unauthorized khi không có token)
  // ---------------------------------------------------------------------------
  it('Test 7: Từ chối quay thưởng khi chưa đăng nhập (HTTP 401)', async () => {
    const res = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .send({ budget: 'all', mood: 'all' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
