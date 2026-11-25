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

describe('Order Creation & Roulette Removal Verification', () => {
  const testUserId = 'cust_order_user_001';
  const validToken = createAuthToken(testUserId);

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrders = [];
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  });

  it('Test 1: Tạo đơn hàng bình thường luôn có coinBonusMultiplier = 1 và không ràng buộc roulette', async () => {
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

  it('Test 2: Kể cả client cũ gửi kèm rouletteSessionId cũng không chặn đơn và không kích hoạt x2 Xu', async () => {
    const payload = {
      restaurantId: 'rest_001',
      rouletteSessionId: 'rsess_legacy_ignored',
      items: [{ menuItemId: 'dish_1', name: 'Phở bò', price: 55000, quantity: 1 }],
      totalPrice: 71000
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.coinBonusMultiplier).toBe(1);
    expect(res.body.data.rouletteSessionId).toBeNull();
  });

  it('Test 3: Khi đơn hàng chuyển sang DELIVERED không tự cộng 2.000 Xu từ vòng quay nữa', async () => {
    const driverToken = createAuthToken('driver_partner_001', 'DRIVER');

    const order = new Order({
      customerId: testUserId,
      restaurantId: 'rest_001',
      items: [{ menuItemId: 'dish_1', name: 'Bún bò', price: 50000, quantity: 1 }],
      totalPrice: 66000,
      coinBonusMultiplier: 2,
      status: 'DELIVERING',
      coinsRewarded: false
    });
    await order.save();

    const res = await request(app)
      .put(`/api/v1/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'DELIVERED' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DELIVERED');

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.coinsRewarded).toBe(false);
    expect(updatedOrder.coinsRewardAmount).toBe(0);
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/coins/reward'), expect.anything());
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'order.completed',
      expect.objectContaining({
        orderId: String(order._id),
        status: 'DELIVERED'
      })
    );
  });
});
