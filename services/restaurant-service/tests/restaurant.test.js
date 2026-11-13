const request = require('supertest');

// Mock Redis và Models
jest.mock('../redis', () => ({
  client: { isOpen: true, exists: jest.fn().mockResolvedValue(true) },
  getCache: jest.fn(),
  setCache: jest.fn(),
  deleteCache: jest.fn(),
  invalidateRestaurantCache: jest.fn(),
  decrQuota: jest.fn(),
  incrQuota: jest.fn(),
  setQuota: jest.fn(),
  TTL: 3600
}));

jest.mock('../src/models/Restaurant');
jest.mock('../src/models/Voucher');
jest.mock('../src/models/Review');
jest.mock('../src/models/CustomerNotification');
jest.mock('../src/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue({}),
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn().mockResolvedValue({})
}));

const { getCache, setCache, decrQuota, incrQuota } = require('../redis');
const Restaurant = require('../src/models/Restaurant');
const Voucher = require('../src/models/Voucher');
const Review = require('../src/models/Review');
const { publishEvent } = require('../src/rabbitmq');
const app = require('../app');

describe('Restaurant Service - Unit Tests (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRestaurants = [
    {
      _id: '65f9876543210fedcba54321',
      name: 'Cơm Tấm Sài Gòn',
      address: '123 Nguyễn Tri Phương, Q5',
      phone: '0901234567',
      rating: 4.8,
      latitude: 10.7769,
      longitude: 106.7009,
      completed_orders: 50,
      menuItems: [{ name: 'Sườn Bì Chả', price: 45000 }]
    }
  ];

  // ---------------------------------------------------------------------------
  // 1. Test GET /api/v1/restaurants
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/restaurants', () => {
    it('Cache Hit: Trả về 200 từ Redis Cache mà không truy vấn MongoDB', async () => {
      getCache.mockResolvedValue(mockRestaurants);

      const res = await request(app).get('/api/v1/restaurants');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('cache');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Cơm Tấm Sài Gòn');
      expect(Restaurant.find).not.toHaveBeenCalled();
    });

    it('Cache Miss: Truy vấn MongoDB và lưu cache vào Redis, trả về 200', async () => {
      getCache.mockResolvedValue(null);
      Restaurant.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockRestaurants)
      });
      setCache.mockResolvedValue(true);

      const res = await request(app).get('/api/v1/restaurants');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('database');
      expect(res.body.data).toHaveLength(1);
      expect(Restaurant.find).toHaveBeenCalled();
      expect(setCache).toHaveBeenCalledWith('restaurants:all', mockRestaurants, 3600);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Test GET /api/v1/restaurants/:id
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/restaurants/:id', () => {
    it('Trả về 200 kèm menu khi tìm thấy nhà hàng', async () => {
      getCache.mockResolvedValue(null);
      Restaurant.findById.mockResolvedValue(mockRestaurants[0]);
      setCache.mockResolvedValue(true);

      const res = await request(app).get('/api/v1/restaurants/65f9876543210fedcba54321');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Cơm Tấm Sài Gòn');
      expect(res.body.data.menuItems).toHaveLength(1);
      expect(setCache).toHaveBeenCalledWith('menu:65f9876543210fedcba54321', mockRestaurants[0], 3600);
    });

    it('Trả về 404 khi ID nhà hàng không tồn tại', async () => {
      getCache.mockResolvedValue(null);
      Restaurant.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/restaurants/000000000000000000000000');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/không tìm thấy/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Test POST /api/v1/vouchers/apply (Concurrency Control với Redis)
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/vouchers/apply', () => {
    const mockVoucher = {
      _id: '65f111222333444555666777',
      code: 'FREESHIP50',
      is_active: true,
      min_order_value: 50000,
      discount_type: 'FIXED_AMOUNT',
      discount_value: 15000,
      usage_limit: 100,
      used_count: 5
    };

    it('Áp dụng mã thành công khi thỏa điều kiện và trừ quota nguyên tử qua Redis', async () => {
      Voucher.findOne.mockResolvedValue(mockVoucher);
      decrQuota.mockResolvedValue(94); // Còn 94 lượt
      Voucher.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app).post('/api/v1/vouchers/apply').send({
        voucher_code: 'FREESHIP50',
        cart_total: 100000
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.discount_amount).toBe(15000);
      expect(res.body.data.final_total).toBe(85000);
      expect(decrQuota).toHaveBeenCalledWith('voucher:quota:FREESHIP50');
    });

    it('Từ chối và rollback quota khi voucher hết lượt dùng (decr < 0)', async () => {
      Voucher.findOne.mockResolvedValue(mockVoucher);
      decrQuota.mockResolvedValue(-1); // Hết lượt

      const res = await request(app).post('/api/v1/vouchers/apply').send({
        voucher_code: 'FREESHIP50',
        cart_total: 100000
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/hết lượt sử dụng/i);
      expect(incrQuota).toHaveBeenCalledWith('voucher:quota:FREESHIP50');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Test GET /api/v1/stores/recommended (Thuật toán Ranking & Redis Cache)
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/stores/recommended', () => {
    it('Cache Hit: Trả về kết quả ngay từ Redis kèm header X-Cache: HIT', async () => {
      getCache.mockResolvedValue(mockRestaurants);

      const res = await request(app).get('/api/v1/stores/recommended?user_lat=10.7769&user_lng=106.7009');

      expect(res.statusCode).toBe(200);
      expect(res.header['x-cache']).toBe('HIT');
      expect(res.body.source).toBe('cache');
      expect(Restaurant.find).not.toHaveBeenCalled();
    });

    it('Cache Miss: Tính điểm Ranking Score, lưu Redis TTL 300s và trả X-Cache: MISS', async () => {
      getCache.mockResolvedValue(null);
      Restaurant.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRestaurants)
      });
      setCache.mockResolvedValue(true);

      const res = await request(app).get('/api/v1/stores/recommended?user_lat=10.7769&user_lng=106.7009');

      expect(res.statusCode).toBe(200);
      expect(res.header['x-cache']).toBe('MISS');
      expect(res.body.source).toBe('database');
      expect(res.body.data[0].recommendation_score).toBeGreaterThan(0);
      expect(setCache).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Test POST /api/v1/reviews (Event-Driven RabbitMQ)
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/reviews', () => {
    it('Lưu đánh giá thành công và bắn sự kiện review.submitted lên RabbitMQ', async () => {
      Review.findOne.mockResolvedValue(null);
      const mockSavedReview = {
        _id: '65f999888777666555444333',
        order_id: 'ord_123456',
        user_id: 'user_001',
        store_id: '65f9876543210fedcba54321',
        rating: 5,
        comment: 'Món ăn rất ngon, giao nhanh!'
      };
      Review.prototype.save = jest.fn().mockResolvedValue(mockSavedReview);
      Review.find = jest.fn().mockResolvedValue([{ rating: 5 }]);
      Restaurant.findByIdAndUpdate = jest.fn().mockResolvedValue({});

      const res = await request(app).post('/api/v1/reviews').send({
        order_id: 'ord_123456',
        store_id: '65f9876543210fedcba54321',
        user_id: 'user_001',
        rating: 5,
        comment: 'Món ăn rất ngon, giao nhanh!'
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(publishEvent).toHaveBeenCalledWith(
        'foodfast_events',
        'review.submitted',
        expect.objectContaining({
          order_id: 'ord_123456',
          rating: 5
        })
      );
    });
  });
});
