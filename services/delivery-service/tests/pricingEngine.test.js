const request = require('supertest');

// Mock Redis cho delivery-service
jest.mock('../src/redis', () => {
  const store = new Map();
  return {
    client: { isOpen: true },
    connectRedis: jest.fn().mockResolvedValue(true),
    getCache: jest.fn(async (key) => store.get(key) || null),
    setCache: jest.fn(async (key, value, ttl) => {
      store.set(key, value);
      return true;
    }),
    _store: store
  };
});

// Mock RabbitMQ & Models để tránh dependency bên ngoài khi nạp app
jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

const { calculateShippingFee } = require('../src/utils/pricingEngine');
const { getWeatherStatus } = require('../src/utils/weatherService');
const { getCache, setCache } = require('../src/redis');
const app = require('../app');

describe('Dynamic Surge Pricing Engine - Phí Giao Hàng Động (Giờ & Thời Tiết)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Kiểm tra Cước phí theo Khoảng cách (Base Fee)
  // ===========================================================================
  describe('Cước cơ bản theo khoảng cách (16k/2km đầu, +5k/km tiếp theo)', () => {
    it('Khoảng cách <= 2 km: tính đúng 16.000đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 1.5,
        mockParams: { hour: 9, isRaining: false }
      });

      expect(res.distanceKm).toBe(1.5);
      expect(res.baseFee).toBe(16000);
      expect(res.totalShippingFee).toBe(16000);
    });

    it('Khoảng cách 3.5 km: tính đúng 16.000 + 1.5 * 5.000 = 23.500đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 3.5,
        mockParams: { hour: 9, isRaining: false }
      });

      expect(res.distanceKm).toBe(3.5);
      expect(res.baseFee).toBe(23500);
      expect(res.totalShippingFee).toBe(23500);
    });

    it('Khoảng cách 5.0 km: tính đúng 16.000 + 3 * 5.000 = 31.000đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 5.0,
        mockParams: { hour: 9, isRaining: false }
      });

      expect(res.distanceKm).toBe(5.0);
      expect(res.baseFee).toBe(31000);
      expect(res.totalShippingFee).toBe(31000);
    });
  });

  // ===========================================================================
  // 2. Kiểm tra Phụ phí Khung giờ (Time Surge)
  // ===========================================================================
  describe('Phụ phí khung giờ (Time Surge)', () => {
    it('Khung giờ đêm muộn (23:00): cộng thêm 8.000đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 2.0,
        mockParams: { hour: 23, isRaining: false }
      });

      expect(res.surcharges.time.amount).toBe(8000);
      expect(res.surcharges.time.reason).toContain('đêm khuya');
      expect(res.totalShippingFee).toBe(16000 + 8000);
    });

    it('Khung giờ sáng sớm (04:00): cộng thêm 8.000đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 2.0,
        mockParams: { hour: 4, isRaining: false }
      });

      expect(res.surcharges.time.amount).toBe(8000);
      expect(res.surcharges.time.reason).toContain('đêm khuya');
      expect(res.totalShippingFee).toBe(16000 + 8000);
    });

    it('Giờ cao điểm trưa (12:00): cộng thêm 5.000đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 2.0,
        mockParams: { hour: 12, isRaining: false }
      });

      expect(res.surcharges.time.amount).toBe(5000);
      expect(res.surcharges.time.reason).toContain('11h-13h');
      expect(res.totalShippingFee).toBe(16000 + 5000);
    });

    it('Giờ cao điểm tối (19:00): cộng thêm 5.000đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 2.0,
        mockParams: { hour: 19, isRaining: false }
      });

      expect(res.surcharges.time.amount).toBe(5000);
      expect(res.surcharges.time.reason).toContain('18h-20h');
      expect(res.totalShippingFee).toBe(16000 + 5000);
    });

    it('Khung giờ bình thường (10:00 hoặc 15:00): phụ phí 0đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 2.0,
        mockParams: { hour: 15, isRaining: false }
      });

      expect(res.surcharges.time.amount).toBe(0);
      expect(res.surcharges.time.reason).toBeNull();
      expect(res.totalShippingFee).toBe(16000);
    });
  });

  // ===========================================================================
  // 3. Kiểm tra Phụ phí Thời tiết xấu (Weather Surge)
  // ===========================================================================
  describe('Phụ phí thời tiết xấu (Weather Surge)', () => {
    it('Trời mưa (isRaining = true): cộng thêm 5.000đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 2.0,
        mockParams: { hour: 9, isRaining: true }
      });

      expect(res.surcharges.weather.amount).toBe(5000);
      expect(res.surcharges.weather.isRaining).toBe(true);
      expect(res.surcharges.weather.reason).toContain('thời tiết mưa bão');
      expect(res.totalShippingFee).toBe(16000 + 5000);
    });

    it('Trời không mưa (isRaining = false): phụ phí 0đ', async () => {
      const res = await calculateShippingFee({
        distanceKm: 2.0,
        mockParams: { hour: 9, isRaining: false }
      });

      expect(res.surcharges.weather.amount).toBe(0);
      expect(res.surcharges.weather.isRaining).toBe(false);
      expect(res.surcharges.weather.reason).toBeNull();
      expect(res.totalShippingFee).toBe(16000);
    });
  });

  // ===========================================================================
  // 4. Test Tích hợp đúng chuẩn Ví dụ trong Yêu cầu
  // ===========================================================================
  describe('Tích hợp đầy đủ theo mẫu Output yêu cầu', () => {
    it('Khớp 100% ví dụ: 3.5 km, giờ cao điểm trưa, trời mưa -> Tổng 33.500đ', async () => {
      const output = await calculateShippingFee({
        distanceKm: 3.5,
        userCoords: { lat: 10.78, lng: 106.70 },
        mockParams: { hour: 12, isRaining: true }
      });

      expect(output).toEqual({
        distanceKm: 3.5,
        baseFee: 23500,
        surcharges: {
          time: { amount: 5000, reason: 'Phụ phí giờ cao điểm (11h-13h)' },
          weather: { amount: 5000, isRaining: true, reason: 'Phụ phí thời tiết mưa bão' }
        },
        totalShippingFee: 33500
      });
    });
  });

  // ===========================================================================
  // 5. Kiểm tra Tích hợp Redis Caching & Open-Meteo
  // ===========================================================================
  describe('Dịch vụ thời tiết & Redis Caching (TTL = 900s)', () => {
    it('Cache Hit: Trả về trạng thái từ Redis Cache không cần gọi Open-Meteo', async () => {
      getCache.mockResolvedValueOnce({
        isRaining: true,
        precipitation: 8.5
      });

      const weather = await getWeatherStatus({ lat: 10.78, lng: 106.70 });

      expect(weather.isRaining).toBe(true);
      expect(weather.fromCache).toBe(true);
      expect(getCache).toHaveBeenCalledWith('weather:10.78_106.70');
    });

    it('Demo Simulator: Cờ simulate_rain=true ép trạng thái mưa cho buổi thuyết trình', async () => {
      const weather = await getWeatherStatus(
        { lat: 10.78, lng: 106.70 },
        { simulate_rain: true }
      );

      expect(weather.isRaining).toBe(true);
      expect(weather.isMocked).toBe(true);
    });
  });

  // ===========================================================================
  // 6. Test REST API Endpoint (GET /api/v1/deliveries/shipping-fee)
  // ===========================================================================
  describe('REST API: GET /api/v1/deliveries/shipping-fee', () => {
    it('Nhận tham số qua Query & Headers và trả về kết quả tính cước chuẩn xác (200)', async () => {
      const res = await request(app)
        .get('/api/v1/deliveries/shipping-fee')
        .query({
          distanceKm: 3.5,
          mock_hour: 23,
          simulate_rain: true
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.distanceKm).toBe(3.5);
      expect(res.body.data.baseFee).toBe(23500);
      expect(res.body.data.surcharges.time.amount).toBe(8000);
      expect(res.body.data.surcharges.weather.amount).toBe(5000);
      expect(res.body.data.totalShippingFee).toBe(23500 + 8000 + 5000);
    });
  });
});
