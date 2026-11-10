const request = require('supertest');
const jwt = require('jsonwebtoken');
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

describe('Real Wallet Ledger, Order Settlement Sync & Admin Grant API', () => {
  const adminToken = jwt.sign({ userId: 'admin_1', role: 'ADMIN', email: 'admin@foodfast.vn' }, JWT_SECRET);
  const merchantToken = jwt.sign({ userId: 'owner_1', role: 'USER', email: 'dfood@gmail.com' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/v1/restaurants/admin/:id/grant-wallet - Dọn số ảo cũ 1.368.922đ và tặng đúng +500.000đ tiền thật', async () => {
    const mockStore = {
      _id: 'store_001',
      name: 'DFOOD - Chè Thái & Trà Sữa',
      merchantType: 'HOUSEHOLD',
      wallet: { availableBalance: 1368922, pendingBalance: 327850 },
      walletTransactions: [],
      payouts: [],
      notifications: [],
      save: jest.fn().mockResolvedValue(true)
    };
    Restaurant.findById.mockResolvedValue(mockStore);

    const res = await request(app)
      .post('/api/v1/restaurants/admin/store_001/grant-wallet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 500000,
        reason: 'Cấp ngân sách test chức năng Ví & Voucher Hộ Kinh Doanh'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // Đã xóa số ảo cũ 1.368.922đ -> số dư mới chính xác là 500.000đ
    expect(mockStore.wallet.availableBalance).toBe(500000);
    expect(mockStore.wallet.pendingBalance).toBe(0);
    expect(mockStore.walletTransactions).toHaveLength(1);
    expect(mockStore.walletTransactions[0].type).toBe('ADMIN_GRANT');
    expect(mockStore.walletTransactions[0].amount).toBe(500000);
    expect(mockStore.notifications).toHaveLength(1);
    expect(mockStore.notifications[0].type).toBe('WALLET');
  });

  it('POST /api/v1/stores/my-store/sync-settlements - Quyết toán đơn thật theo công thức Hộ KD và chống cộng trùng', async () => {
    const mockStore = {
      _id: 'store_001',
      ownerId: 'owner_1',
      name: 'DFOOD',
      merchantType: 'HOUSEHOLD',
      commissionRate: 0.25,
      completed_orders: 25, // số ảo cũ
      wallet: { availableBalance: 1368922, pendingBalance: 327850 },
      walletTransactions: [],
      payouts: [],
      save: jest.fn().mockResolvedValue(true)
    };
    Restaurant.findOne.mockResolvedValue(mockStore);

    const realCompletedOrder = {
      _id: '65f999000111222333444555',
      restaurantId: 'store_001',
      originalTotal: 100000,
      voucherCode: 'QUANGIAM20',
      voucherIssuerType: 'STORE',
      storeVoucherDiscount: 20000,
      status: 'DELIVERED',
      createdAt: new Date().toISOString()
    };

    // Lần sync 1: cộng đúng 58.800đ (80k - 25% CK - 1.5% Thuế HKD)
    const res1 = await request(app)
      .post('/api/v1/stores/my-store/sync-settlements')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ completedOrders: [realCompletedOrder], pendingOrders: [] });

    expect(res1.statusCode).toBe(200);
    expect(res1.body.settledNewCount).toBe(1);
    expect(mockStore.wallet.availableBalance).toBe(58800);
    expect(mockStore.completed_orders).toBe(1);
    expect(mockStore.walletTransactions).toHaveLength(1);

    // Lần sync 2 cùng đơn đó: Idempotent -> KHÔNG cộng trùng
    const res2 = await request(app)
      .post('/api/v1/stores/my-store/sync-settlements')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ completedOrders: [realCompletedOrder], pendingOrders: [] });

    expect(res2.statusCode).toBe(200);
    expect(res2.body.settledNewCount).toBe(0);
    expect(mockStore.wallet.availableBalance).toBe(58800);
    expect(mockStore.walletTransactions).toHaveLength(1);
  });
});
