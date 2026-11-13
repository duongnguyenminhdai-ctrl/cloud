const request = require('supertest');

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

// Mock verifyToken middleware
jest.mock('../src/middlewares/authMiddleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { userId: 'user_123', name: 'Nguyễn Văn Test', role: 'USER' };
    next();
  },
  requireAdmin: (req, res, next) => next()
}));

const CustomerNotification = require('../src/models/CustomerNotification');
const app = require('../app');

describe('Customer Notification Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/notifications/my-notifications: Lấy danh sách thông báo chuông còn hiệu lực', async () => {
    const mockNotifications = [
      {
        _id: 'notif_001',
        userId: 'user_123',
        orderId: 'ord_999',
        storeName: 'Cơm Tấm Sài Gòn',
        title: 'Đơn hàng đã giao thành công!',
        content: 'Đánh giá nhận 1.000 Xu',
        rewardCoins: 1000,
        isRead: false,
        isCompleted: false,
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
      }
    ];

    CustomerNotification.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockNotifications)
      })
    });
    CustomerNotification.countDocuments.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/notifications/my-notifications');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.data[0].orderId).toBe('ord_999');
  });

  it('PUT /api/v1/notifications/read-all: Đánh dấu tất cả thông báo là đã đọc', async () => {
    CustomerNotification.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const res = await request(app).put('/api/v1/notifications/read-all');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(CustomerNotification.updateMany).toHaveBeenCalled();
  });
});

