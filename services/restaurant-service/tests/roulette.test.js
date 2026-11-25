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
jest.mock('../src/models/RouletteConfig');
jest.mock('../src/models/Voucher');
jest.mock('../src/models/Review');
jest.mock('../src/models/CustomerNotification');

const RouletteConfig = require('../src/models/RouletteConfig');
const app = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

describe('Decision Roulette (Giải trí - Không giới hạn lượt, Không Xu)', () => {
  const adminToken = jwt.sign({ userId: 'admin_001', role: 'ADMIN', email: 'admin@test.com' }, JWT_SECRET);
  const userToken = jwt.sign({ userId: 'user_001', role: 'USER', email: 'user@test.com' }, JWT_SECRET);

  let savedConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    savedConfig = null;

    RouletteConfig.findOne = jest.fn().mockImplementation(() => ({
      sort: jest.fn().mockResolvedValue(savedConfig)
    }));

    RouletteConfig.create = jest.fn().mockImplementation(async (doc) => {
      savedConfig = {
        ...doc,
        save: async function () { return this; }
      };
      return savedConfig;
    });
  });

  it('Test 1: POST /api/v1/restaurants/roulette/spin - Trả về 8 món gợi ý, winnerIndex (0-7), unlimited: true', async () => {
    const res = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ budget: 'all' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const { items, winnerIndex, winnerItem, unlimited, bonusType, sessionId } = res.body.data;

    expect(items).toHaveLength(8);
    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(winnerIndex).toBeLessThan(8);
    expect(winnerItem.name).toBe(items[winnerIndex].name);
    expect(winnerItem.rarity).toMatch(/COMMON|RARE|LEGENDARY/);
    expect(unlimited).toBe(true);
    // Không gắn cơ chế thưởng Xu hay session
    expect(bonusType).toBeUndefined();
    expect(sessionId).toBeUndefined();
  });

  it('Test 2: Quay không giới hạn lượt - Gọi 5 lần liên tiếp đều thành công 200 OK', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/restaurants/roulette/spin')
        .send({ budget: 'all' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unlimited).toBe(true);
    }
  });

  it('Test 3: Cho phép quay cả khi chưa đăng nhập (guest) vì chỉ mang tính chất giải trí', async () => {
    const res = await request(app)
      .post('/api/v1/restaurants/roulette/spin')
      .send({ budget: 'under_35k', vegetarianOnly: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.winnerItem).toBeDefined();
  });

  it('Test 4: GET /api/v1/restaurants/roulette/status - Trả về unlimited: true', async () => {
    const res = await request(app).get('/api/v1/restaurants/roulette/status');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unlimited).toBe(true);
    expect(res.body.data.spinsRemaining).toBeNull();
  });

  it('Test 5: GET & PUT /api/v1/restaurants/roulette/config - Admin quản lý danh sách món trong hòm', async () => {
    const getRes = await request(app).get('/api/v1/restaurants/roulette/config');
    expect(getRes.statusCode).toBe(200);
    expect(Array.isArray(getRes.body.data.items)).toBe(true);
    expect(getRes.body.data.items.length).toBeGreaterThan(0);

    // User thường không được cập nhật config
    const forbiddenRes = await request(app)
      .put('/api/v1/restaurants/roulette/config')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ name: 'Bánh Cuốn Nóng', rarity: 'COMMON' }] });
    expect(forbiddenRes.statusCode).toBe(403);

    // Admin cập nhật config thành công
    const updateRes = await request(app)
      .put('/api/v1/restaurants/roulette/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { name: 'Bánh Cuốn Nóng', description: 'Chả lụa thơm ngon', priceRange: '30.000đ', rarity: 'COMMON' },
          { name: 'Bún Đậu Mắm Tôm', description: 'Đầy đủ topping', priceRange: '55.000đ', rarity: 'RARE' }
        ]
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.items).toHaveLength(2);
    expect(updateRes.body.data.items[0].name).toBe('Bánh Cuốn Nóng');
  });
});
