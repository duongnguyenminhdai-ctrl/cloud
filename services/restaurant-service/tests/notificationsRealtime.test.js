const request = require('supertest');
const jwt = require('jsonwebtoken');
const EventEmitter = require('events');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');

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

jest.mock('../src/models/Restaurant');
jest.mock('../src/models/Voucher');
jest.mock('../src/models/Review');
jest.mock('../src/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue({}),
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn().mockResolvedValue({})
}));

const Restaurant = require('../src/models/Restaurant');
const app = require('../app');
const realtimeHub = require('../src/utils/realtimeHub');

describe('Bell Notifications & Realtime SSE Sync API', () => {
  const adminToken = jwt.sign({ userId: 'admin_1', role: 'ADMIN', email: 'admin@foodfast.vn' }, JWT_SECRET);
  const merchantTokenUserId = jwt.sign({ userId: 'owner_99', role: 'USER', email: 'dfood@gmail.com' }, JWT_SECRET);
  const merchantTokenId = jwt.sign({ id: 'owner_99', role: 'USER', email: 'dfood@gmail.com' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/v1/restaurants/admin/:id/warn - Lưu thông báo WARNING và phát SSE realtime tới chủ quán', async () => {
    const mockStore = {
      _id: 'store_99',
      ownerId: 'owner_99',
      name: 'DFOOD - Chè Thái & Trà Sữa',
      status: 'ACTIVE',
      notifications: [],
      save: jest.fn().mockResolvedValue(true)
    };
    Restaurant.findById.mockResolvedValue(mockStore);

    // Đăng ký 1 mock SSE client giả lập chủ quán đang mở dashboard
    const mockReq = new EventEmitter();
    const written = [];
    const mockRes = new EventEmitter();
    mockRes.writeHead = jest.fn();
    mockRes.write = jest.fn((chunk) => written.push(chunk));
    mockRes.flushHeaders = jest.fn();
    mockRes.writableEnded = false;
    mockRes.destroyed = false;

    realtimeHub.subscribe(mockReq, mockRes, ['merchant:owner_99']);

    const res = await request(app)
      .post('/api/v1/restaurants/admin/store_99/warn')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Cảnh báo vi phạm quy trình giao nhận',
        content: 'Quán vui lòng xác nhận đơn nhanh hơn trong giờ cao điểm.'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockStore.save).toHaveBeenCalled();
    expect(mockStore.notifications).toHaveLength(1);
    expect(mockStore.notifications[0].type).toBe('WARNING');
    expect(mockStore.notifications[0].isRead).toBe(false);
    expect(mockStore.notifications[0].id).toMatch(/^notif_/);

    // Kiểm tra SSE stream đã nhận ngay event notification.created
    const combinedStream = written.join('');
    expect(combinedStream).toContain('event: notification.created');
    expect(combinedStream).toContain('Cảnh báo vi phạm quy trình giao nhận');

    // Dọn dẹp mock SSE client
    mockReq.emit('close');
  });

  it('GET /api/v1/stores/my-store/notifications - Lấy danh sách thông báo chuông theo userId hoặc id trong JWT', async () => {
    const mockStore = {
      _id: 'store_99',
      ownerId: 'owner_99',
      name: 'DFOOD',
      status: 'ACTIVE',
      notifications: [
        {
          id: 'notif_old',
          type: 'INFO',
          title: 'Thông báo cũ',
          content: 'Đã đọc trước đó',
          isRead: true,
          createdAt: new Date('2026-11-01T10:00:00Z')
        },
        {
          id: 'notif_new',
          type: 'WARNING',
          title: 'Cảnh báo mới từ Admin',
          content: 'Vui lòng kiểm tra chất lượng món ăn',
          isRead: false,
          createdAt: new Date('2026-11-10T10:00:00Z')
        }
      ],
      save: jest.fn().mockResolvedValue(true)
    };
    Restaurant.findOne.mockResolvedValue(mockStore);

    const res1 = await request(app)
      .get('/api/v1/stores/my-store/notifications')
      .set('Authorization', `Bearer ${merchantTokenUserId}`);

    expect(res1.statusCode).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.unreadCount).toBe(1);
    expect(res1.body.data).toHaveLength(2);
    expect(res1.body.data[0].id).toBe('notif_new'); // Mới nhất đứng đầu

    const res2 = await request(app)
      .get('/api/v1/stores/my-store/notifications')
      .set('Authorization', `Bearer ${merchantTokenId}`);

    expect(res2.statusCode).toBe(200);
    expect(res2.body.unreadCount).toBe(1);
  });

  it('PUT /api/v1/stores/my-store/notifications/read - Đánh dấu đã đọc vào Database và giảm unreadCount về 0', async () => {
    const mockStore = {
      _id: 'store_99',
      ownerId: 'owner_99',
      name: 'DFOOD',
      status: 'ACTIVE',
      notifications: [
        { id: 'notif_1', type: 'WARNING', title: 'Cảnh báo', content: 'Test', isRead: false, createdAt: new Date() },
        { id: 'notif_2', type: 'WALLET', title: 'Cấp ví', content: '+500k', isRead: false, createdAt: new Date() }
      ],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
    };
    Restaurant.findOne.mockResolvedValue(mockStore);

    const res = await request(app)
      .put('/api/v1/stores/my-store/notifications/read')
      .set('Authorization', `Bearer ${merchantTokenUserId}`)
      .send({ notificationIds: ['notif_1', 'notif_2'] });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.unreadCount).toBe(0);
    expect(mockStore.notifications.every((n) => n.isRead === true)).toBe(true);
    expect(mockStore.markModified).toHaveBeenCalledWith('notifications');
    expect(mockStore.save).toHaveBeenCalled();
  });

  it('GET /api/v1/stores/my-store/stream - Yêu cầu JWT hợp lệ trước khi mở luồng SSE', async () => {
    const res = await request(app).get('/api/v1/stores/my-store/stream');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

