const request = require('supertest');

// Mock Redis và Restaurant Model
jest.mock('../redis', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  deleteCache: jest.fn(),
  invalidateRestaurantCache: jest.fn(),
  TTL: 3600
}));

jest.mock('../src/models/Restaurant');

const { getCache, setCache } = require('../redis');
const Restaurant = require('../src/models/Restaurant');
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
});

