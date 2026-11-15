const request = require('supertest');
const crypto = require('crypto');

// 1. Mock RabbitMQ
jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

// 2. In-memory Mock Store cho Order
let mockOrders = [];

jest.mock('../src/models/Order', () => {
  const MockOrder = jest.fn().mockImplementation(function (data) {
    const id = `ord_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    Object.assign(this, {
      _id: id,
      status: 'PENDING',
      paymentMethod: 'VNPAY',
      shippingFee: 16000,
      coinBonusMultiplier: 1,
      rouletteSessionId: null,
      rouletteMenuItemId: null,
      coinsRewarded: false,
      coinsRewardAmount: 0,
      isGroupOrder: false,
      groupOrderRoomCode: null,
      groupOrderInfo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    });

    this.save = jest.fn().mockImplementation(async () => {
      this.updatedAt = new Date();
      const idx = mockOrders.findIndex((o) => String(o._id) === String(this._id));
      if (idx !== -1) {
        mockOrders[idx] = this;
      } else {
        mockOrders.push(this);
      }
      return this;
    });

    return this;
  });

  MockOrder.findById = jest.fn().mockImplementation(async (id) => {
    return mockOrders.find((o) => String(o._id) === String(id)) || null;
  });

  MockOrder.find = jest.fn().mockImplementation(() => ({
    sort: () => ({
      skip: () => ({
        limit: async () => mockOrders
      })
    })
  }));

  MockOrder.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });

  return MockOrder;
});

// Helper sinh JWT Token hợp lệ
function createAuthToken(userId, role = 'USER') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      userId,
      role,
      name: 'Người Dùng Test',
      email: `${userId}@foodfast.vn`,
      exp: Math.floor(Date.now() / 1000) + 3600
    })
  ).toString('base64url');

  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const { publishEvent, DEFAULT_EXCHANGE } = require('../src/rabbitmq');
const Order = require('../src/models/Order');
const app = require('../app');

describe('Roulette Order Verification & Double Coins (Requirement R2) - Unit & Integration Tests', () => {
  const testUserId = 'cust_roulette_user_001';
  const otherUserId = 'cust_roulette_user_999';
  const validToken = createAuthToken(testUserId);

  let mockSessions;
  let creditedCoinsLog;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrders = [];
    creditedCoinsLog = [];
    mockSessions = new Map();

    // Thiết lập Mock global.fetch cho inter-service communication
    global.fetch = jest.fn().mockImplementation(async (url, options = {}) => {
      const urlStr = String(url);

      // Tiêu thụ session: POST /api/v1/restaurants/roulette/session/:sessionId/consume
      if (urlStr.includes('/consume')) {
        const sessId = urlStr.split('/session/')[1]?.split('/consume')[0];
        const session = mockSessions.get(sessId);
        if (session) {
          session.isUsed = true;
          session.usedAt = new Date();
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Session consumed' })
        };
      }

      // Tra cứu session: GET /api/v1/restaurants/roulette/session/:sessionId
      if (urlStr.includes('/api/v1/restaurants/roulette/session/')) {
        const parts = urlStr.split('/session/');
        const sessId = parts[1]?.split('?')[0];
        const session = mockSessions.get(sessId);
        if (!session) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ success: false, message: 'Session not found' })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { ...session } })
        };
      }

      // Cộng xu Auth Service: POST /api/v1/auth/coins/reward
      if (urlStr.includes('/api/v1/auth/coins/reward')) {
        const body = JSON.parse(options.body || '{}');
        creditedCoinsLog.push(body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, coins: body.amount || 2000 })
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ success: false })
      };
    });
  });

  // ---------------------------------------------------------------------------
  // Test 1: Tạo đơn bình thường (không có rouletteSessionId)
  // ---------------------------------------------------------------------------
  it('Test 1: Tạo đơn không kèm rouletteSessionId -> coinBonusMultiplier = 1, không cộng xu thêm', async () => {
    const payload = {
      restaurantId: 'rest_001',
      items: [{ menuItemId: 'item_normal_1', name: 'Cơm sườn', price: 45000, quantity: 1 }],
      totalPrice: 61000
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.coinBonusMultiplier).toBe(1);
    expect(res.body.data.rouletteSessionId).toBeNull();
    expect(res.body.data.coinsRewarded).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Tạo đơn với rouletteSessionId hợp lệ & có món trúng thưởng trong giỏ
  // ---------------------------------------------------------------------------
  it('Test 2: Tạo đơn với rouletteSessionId hợp lệ -> coinBonusMultiplier = 2 và kích hoạt tiêu thụ session', async () => {
    const validSessionId = 'rsess_valid_12345';
    mockSessions.set(validSessionId, {
      sessionId: validSessionId,
      userId: testUserId,
      menuItemId: 'dish_roulette_winner',
      menuItemName: 'Trà Đào Cam Sả',
      restaurantId: 'rest_001',
      restaurantName: 'Quán Nước FoodFast',
      bonusType: 'DOUBLE_COINS',
      isUsed: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

    const payload = {
      restaurantId: 'rest_001',
      rouletteSessionId: validSessionId,
      items: [
        { menuItemId: 'dish_roulette_winner', name: 'Trà Đào Cam Sả', price: 35000, quantity: 1 },
        { menuItemId: 'dish_extra_1', name: 'Bánh flan', price: 15000, quantity: 1 }
      ],
      totalPrice: 66000
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.coinBonusMultiplier).toBe(2);
    expect(res.body.data.rouletteSessionId).toBe(validSessionId);
    expect(res.body.data.rouletteMenuItemId).toBe('dish_roulette_winner');

    // Kiểm tra session đã được gọi consume
    const sessionInDb = mockSessions.get(validSessionId);
    expect(sessionInDb.isUsed).toBe(true);

    // RabbitMQ event phát sinh mang cờ coinBonusMultiplier: 2
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'order.created',
      expect.objectContaining({
        coinBonusMultiplier: 2,
        rouletteSessionId: validSessionId
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Test 3: Từ chối phiên quay thưởng không tồn tại (HTTP 400)
  // ---------------------------------------------------------------------------
  it('Test 3: Từ chối phiên quay thưởng không tồn tại với HTTP 400', async () => {
    const payload = {
      restaurantId: 'rest_001',
      rouletteSessionId: 'rsess_non_existent_999',
      items: [{ menuItemId: 'dish_1', name: 'Món ăn', price: 40000, quantity: 1 }]
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/phiên quay thưởng không tồn tại/i);
  });

  // ---------------------------------------------------------------------------
  // Test 4: Từ chối phiên quay thưởng thuộc về tài khoản khác (HTTP 403)
  // ---------------------------------------------------------------------------
  it('Test 4: Từ chối phiên quay thưởng của tài khoản khác với HTTP 403', async () => {
    const stolenSessionId = 'rsess_stolen_001';
    mockSessions.set(stolenSessionId, {
      sessionId: stolenSessionId,
      userId: otherUserId, // Thuộc về user khác
      menuItemId: 'dish_winner',
      menuItemName: 'Món trúng thưởng',
      restaurantId: 'rest_001',
      bonusType: 'DOUBLE_COINS',
      isUsed: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

    const payload = {
      restaurantId: 'rest_001',
      rouletteSessionId: stolenSessionId,
      items: [{ menuItemId: 'dish_winner', name: 'Món trúng thưởng', price: 40000, quantity: 1 }]
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/không thuộc về tài khoản này/i);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Từ chối phiên quay thưởng đã hết hạn (> 5 phút) (HTTP 400)
  // ---------------------------------------------------------------------------
  it('Test 5: Từ chối phiên quay thưởng đã quá hạn 5 phút với HTTP 400', async () => {
    const expiredSessionId = 'rsess_expired_001';
    mockSessions.set(expiredSessionId, {
      sessionId: expiredSessionId,
      userId: testUserId,
      menuItemId: 'dish_winner',
      menuItemName: 'Món trúng thưởng',
      restaurantId: 'rest_001',
      bonusType: 'DOUBLE_COINS',
      isUsed: false,
      expiresAt: new Date(Date.now() - 30 * 1000).toISOString() // Đã hết hạn 30s trước
    });

    const payload = {
      restaurantId: 'rest_001',
      rouletteSessionId: expiredSessionId,
      items: [{ menuItemId: 'dish_winner', name: 'Món trúng thưởng', price: 40000, quantity: 1 }]
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/hết hạn/i);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Từ chối phiên quay thưởng đã được sử dụng (isUsed: true)
  // ---------------------------------------------------------------------------
  it('Test 6: Từ chối phiên quay thưởng đã được sử dụng trước đó với HTTP 400', async () => {
    const usedSessionId = 'rsess_already_used_001';
    mockSessions.set(usedSessionId, {
      sessionId: usedSessionId,
      userId: testUserId,
      menuItemId: 'dish_winner',
      menuItemName: 'Món trúng thưởng',
      restaurantId: 'rest_001',
      bonusType: 'DOUBLE_COINS',
      isUsed: true, // Đã sử dụng
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

    const payload = {
      restaurantId: 'rest_001',
      rouletteSessionId: usedSessionId,
      items: [{ menuItemId: 'dish_winner', name: 'Món trúng thưởng', price: 40000, quantity: 1 }]
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/đã được sử dụng/i);
  });

  // ---------------------------------------------------------------------------
  // Test 7: Từ chối khi giỏ hàng thiếu món ăn trúng thưởng
  // ---------------------------------------------------------------------------
  it('Test 7: Từ chối khi giỏ hàng không chứa đúng menuItemId đã trúng thưởng', async () => {
    const validSessionId = 'rsess_item_mismatch_001';
    mockSessions.set(validSessionId, {
      sessionId: validSessionId,
      userId: testUserId,
      menuItemId: 'dish_special_winner',
      menuItemName: 'Món Trúng Thưởng Đặc Biệt',
      restaurantId: 'rest_001',
      bonusType: 'DOUBLE_COINS',
      isUsed: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });

    // Giỏ hàng chỉ có món khác
    const payload = {
      restaurantId: 'rest_001',
      rouletteSessionId: validSessionId,
      items: [{ menuItemId: 'dish_other_random', name: 'Món không trúng thưởng', price: 40000, quantity: 1 }]
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/chứa món ăn trúng thưởng/i);
  });

  // ---------------------------------------------------------------------------
  // Test 8: Tự động cộng 2.000 Xu FoodFast khi đơn hàng hoàn tất DELIVERED
  // ---------------------------------------------------------------------------
  it('Test 8: Khi đơn hàng x2 Xu chuyển sang DELIVERED -> thưởng 2.000 Xu cho tài khoản', async () => {
    const driverToken = createAuthToken('driver_partner_001', 'DRIVER');

    // Tạo đơn hàng x2 xu có sẵn trong DB
    const order = new Order({
      customerId: testUserId,
      restaurantId: 'rest_001',
      items: [{ menuItemId: 'dish_winner', name: 'Món trúng thưởng', price: 50000, quantity: 1 }],
      totalPrice: 66000,
      coinBonusMultiplier: 2,
      rouletteSessionId: 'rsess_delivered_test',
      status: 'DELIVERING',
      coinsRewarded: false
    });
    await order.save();

    // Cập nhật trạng thái sang DELIVERED bởi tài xế
    const res = await request(app)
      .put(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'DELIVERED' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DELIVERED');

    // Kiểm tra order được cập nhật coinsRewarded = true và amount = 2000
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.coinsRewarded).toBe(true);
    expect(updatedOrder.coinsRewardAmount).toBe(2000);

    // Kiểm tra API Auth Service được gọi để cộng 2.000 Xu
    expect(creditedCoinsLog).toHaveLength(1);
    expect(creditedCoinsLog[0]).toEqual(
      expect.objectContaining({
        userId: testUserId,
        amount: 2000,
        reason: 'ROULETTE_DOUBLE_COINS',
        orderId: String(order._id)
      })
    );

    // Kiểm tra RabbitMQ bắn event order.completed với thông tin x2 Xu
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'order.completed',
      expect.objectContaining({
        orderId: String(order._id),
        status: 'DELIVERED',
        coinBonusMultiplier: 2,
        rewardCoins: 2000
      })
    );
  });
});
