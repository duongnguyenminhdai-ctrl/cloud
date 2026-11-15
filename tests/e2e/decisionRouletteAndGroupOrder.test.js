/**
 * ==============================================================================
 * END-TO-END (E2E) INTEGRATION TEST SUITE
 * Decision Roulette & Group Order ("Hôm nay ăn gì?" & "Lập kèo ăn trưa")
 *
 * Requirements Covered:
 * - R1: Decision Roulette API in Restaurant Service (Spin, 8 items, 5m session, rate limit 3/day)
 * - R2: Order Checkout Roulette Verification & Double Coins in Order Service
 * - R3: Group Order Shared Cart, Bill Splitting Engine & Host Lock/Checkout in Order Service
 * - R4 & R5: Real-world integration flows simulating full frontend-to-backend journeys
 *
 * Test Tiers:
 * - Tier 1: Functional Happy Paths (Features 1-8)
 * - Tier 2: Boundary Value Analysis (BVA) & Corner/Edge Cases
 * - Tier 3: Combinatorial Matrix Tests (Cart combinations, vouchers, shipping splits)
 * - Tier 4: Real-World Scenarios 1 to 5
 * ==============================================================================
 */

const request = require('supertest');
const crypto = require('crypto');

// ------------------------------------------------------------------------------
// 1. GLOBAL MOCKS (Redis, RabbitMQ, and Mongo Models)
// ------------------------------------------------------------------------------

// Mock Redis for restaurant-service
jest.mock('../../services/restaurant-service/redis', () => ({
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

// Mock RabbitMQ for restaurant-service
jest.mock('../../services/restaurant-service/src/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue({}),
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn().mockResolvedValue({})
}));

// Mock RabbitMQ for order-service
jest.mock('../../services/order-service/src/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

// In-memory persistent stores across the E2E session
let mockRouletteSessions = [];
let mockSpinLogs = [];
let mockGroupOrders = [];
let mockOrders = [];
let creditedCoinsHistory = [];

// Sample restaurant & menu items for Decision Roulette
const sampleDishes = [
  { menuItemId: 'dish_ca_phe_01', name: 'Cà phê sữa đá Sài Gòn', price: 25000, description: 'Đậm đà tỉnh táo', restaurantId: 'res_coffee_01', restaurantName: 'The Coffee House' },
  { menuItemId: 'dish_banh_mi_02', name: 'Bánh mì thịt nướng giòn rụm', price: 32000, description: 'Tiết kiệm bữa sáng', restaurantId: 'res_banhmi_02', restaurantName: 'Bánh Mì Huỳnh Hoa' },
  { menuItemId: 'dish_com_tam_03', name: 'Cơm tấm sườn bì chả đặc biệt', price: 58000, description: 'Ăn no chắc bụng', restaurantId: 'res_comtam_03', restaurantName: 'Cơm Tấm Ba Ghiền' },
  { menuItemId: 'dish_tra_dao_04', name: 'Trà đào cam sả thanh mát', price: 42000, description: 'Giải nhiệt xế chiều', restaurantId: 'res_coffee_01', restaurantName: 'The Coffee House' },
  { menuItemId: 'dish_nem_chua_05', name: 'Nem chua rán Phố Cổ', price: 35000, description: 'Ăn vặt giòn ngon', restaurantId: 'res_anvat_04', restaurantName: 'Ăn Vặt 36' },
  { menuItemId: 'dish_bun_bo_06', name: 'Bún bò Huế bắp bò giò heo', price: 65000, description: 'Hương vị cung đình', restaurantId: 'res_bunbo_05', restaurantName: 'Bún Bò Đông Ba' },
  { menuItemId: 'dish_ga_ran_07', name: 'Gà rán sốt cay Hàn Quốc', price: 85000, description: 'Giòn cay đậm vị', restaurantId: 'res_garan_06', restaurantName: 'Chimaek Station' },
  { menuItemId: 'dish_pho_bo_08', name: 'Phở bò tái lăn Hà Nội', price: 75000, description: 'Nước dùng gia truyền', restaurantId: 'res_phothin_07', restaurantName: 'Phở Thìn 13 Lò Đúc' }
];

// Mock Models in restaurant-service
jest.mock('../../services/restaurant-service/src/models/Restaurant', () => ({
  aggregate: jest.fn().mockImplementation(async () => sampleDishes.map((d) => ({ ...d }))),
  find: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockImplementation(async (id) => ({ _id: id, name: 'Quán Ăn FoodFast', isOpen: true }))
}));

jest.mock('../../services/restaurant-service/src/models/RouletteSession', () => {
  return {
    create: jest.fn().mockImplementation(async (doc) => {
      const record = {
        _id: `rsess_id_${mockRouletteSessions.length + 1}`,
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
      mockRouletteSessions.push(record);
      return record;
    }),
    findOne: jest.fn().mockImplementation(async (query) => {
      return mockRouletteSessions.find((s) => s.sessionId === query.sessionId) || null;
    }),
    deleteOne: jest.fn().mockImplementation(async (query) => {
      const idx = mockRouletteSessions.findIndex((s) => s.sessionId === query.sessionId);
      if (idx !== -1) mockRouletteSessions.splice(idx, 1);
      return { deletedCount: idx !== -1 ? 1 : 0 };
    }),
    findOneAndUpdate: jest.fn().mockImplementation(async (filter, update) => {
      const session = mockRouletteSessions.find((s) => {
        if (filter.sessionId && s.sessionId !== filter.sessionId) return false;
        if (filter.userId && s.userId !== filter.userId) return false;
        if (filter.menuItemId && s.menuItemId !== filter.menuItemId) return false;
        if (filter.isUsed !== undefined && s.isUsed !== filter.isUsed) return false;
        if (filter.expiresAt?.$gt && !(new Date(s.expiresAt) > filter.expiresAt.$gt)) return false;
        return true;
      });
      if (!session) return null;
      if (update.$set) Object.assign(session, update.$set);
      return { ...session };
    })
  };
});

jest.mock('../../services/restaurant-service/src/models/RouletteSpinLog', () => {
  return {
    findOne: jest.fn().mockImplementation(async (query) => {
      return mockSpinLogs.find((l) => l.userId === query.userId && l.dateStr === query.dateStr) || null;
    }),
    findOneAndUpdate: jest.fn().mockImplementation(async (filter, update, options) => {
      let log = mockSpinLogs.find((l) => l.userId === filter.userId && l.dateStr === filter.dateStr);
      if (filter.count?.$lt !== undefined && log && log.count >= filter.count.$lt) {
        return null;
      }
      if (!log) {
        if (options && options.upsert) {
          log = { userId: filter.userId, dateStr: filter.dateStr, count: 0, spins: [] };
          mockSpinLogs.push(log);
        } else {
          return null;
        }
      }
      if (update.$inc && update.$inc.count) log.count += update.$inc.count;
      if (update.$push && update.$push.spins) log.spins.push(update.$push.spins);
      return { ...log };
    })
  };
});

jest.mock('../../services/restaurant-service/src/models/Voucher', () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  countDocuments: jest.fn().mockResolvedValue(3),
  create: jest.fn().mockResolvedValue({}),
  insertMany: jest.fn().mockResolvedValue([])
}));
jest.mock('../../services/restaurant-service/src/models/Review', () => ({
  find: jest.fn().mockResolvedValue([])
}));
jest.mock('../../services/restaurant-service/src/models/CustomerNotification', () => ({
  create: jest.fn().mockResolvedValue({})
}));

// Mock Models in order-service
jest.mock('../../services/order-service/src/models/GroupOrder', () => {
  const MockGroupOrder = jest.fn().mockImplementation(function (data) {
    const id = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    Object.assign(this, {
      _id: id,
      status: 'OPEN',
      members: [],
      items: [],
      shippingFee: 16000,
      deliveryAddress: '',
      note: '',
      orderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    });

    this.toObject = () => JSON.parse(JSON.stringify(this));

    this.save = jest.fn().mockImplementation(async () => {
      this.updatedAt = new Date();
      if (Array.isArray(this.members)) {
        this.members.forEach((m) => {
          if (!m._id) m._id = `mem_${Math.random().toString(36).slice(2, 8)}`;
        });
      }
      if (Array.isArray(this.items)) {
        this.items.forEach((it) => {
          if (!it._id) it._id = `itm_${Math.random().toString(36).slice(2, 8)}`;
        });
      }
      const idx = mockGroupOrders.findIndex((g) => g.roomCode === this.roomCode);
      if (idx !== -1) {
        mockGroupOrders[idx] = this;
      } else {
        mockGroupOrders.push(this);
      }
      return this;
    });

    return this;
  });

  MockGroupOrder.findOne = jest.fn().mockImplementation(async (query) => {
    if (query.roomCode) {
      const upper = String(query.roomCode).toUpperCase();
      return mockGroupOrders.find((g) => g.roomCode.toUpperCase() === upper) || null;
    }
    return null;
  });

  return MockGroupOrder;
});

jest.mock('../../services/order-service/src/models/Order', () => {
  const MockOrder = jest.fn().mockImplementation(function (data) {
    const id = `ord_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

// Import express applications
const restaurantApp = require('../../services/restaurant-service/app');
const orderApp = require('../../services/order-service/app');
const { publishEvent } = require('../../services/order-service/src/rabbitmq');

// JWT generation helper
function generateToken(userId, name = 'User Test', role = 'USER') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      userId,
      name,
      role,
      email: `${userId}@foodfast.vn`,
      exp: Math.floor(Date.now() / 1000) + 7200
    })
  ).toString('base64url');
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

// ------------------------------------------------------------------------------
// 2. INTER-SERVICE WIRING SETUP (Connecting Order Service to Restaurant Service)
// ------------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Wire Order Service's global.fetch directly to in-memory state & Restaurant Service handlers
  global.fetch = jest.fn().mockImplementation(async (url, options = {}) => {
    const urlStr = String(url);

    // Consume session: POST /api/v1/restaurants/roulette/session/:sessionId/consume
    if (urlStr.includes('/consume')) {
      const sessId = urlStr.split('/session/')[1]?.split('/consume')[0];
      const session = mockRouletteSessions.find((s) => s.sessionId === sessId);
      if (session) {
        session.isUsed = true;
        session.usedAt = new Date();
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Session consumed successfully' })
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ success: false, message: 'Session not found' })
      };
    }

    // Inspect session: GET /api/v1/restaurants/roulette/session/:sessionId
    if (urlStr.includes('/api/v1/restaurants/roulette/session/')) {
      const sessId = urlStr.split('/session/')[1]?.split('?')[0];
      const session = mockRouletteSessions.find((s) => s.sessionId === sessId);
      if (!session) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ success: false, message: 'Phiên quay thưởng không tồn tại.' })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { ...session } })
      };
    }

    // Credit coins in Auth Service: POST /api/v1/auth/coins/reward
    if (urlStr.includes('/api/v1/auth/coins/reward')) {
      const body = JSON.parse(options.body || '{}');
      creditedCoinsHistory.push(body);
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

// ==============================================================================
// TEST SUITES
// ==============================================================================

describe('Decision Roulette & Group Order E2E System Test Suite', () => {
  const soloUser = 'cust_solo_user_101';
  const soloToken = generateToken(soloUser, 'Lê Văn Solo');

  const hostUser = 'cust_host_party_201';
  const hostToken = generateToken(hostUser, 'Nguyễn Trưởng Nhóm');

  const colleagueA = 'cust_colleague_202';
  const tokenA = generateToken(colleagueA, 'Trần Văn A');

  const colleagueB = 'cust_colleague_203';
  const tokenB = generateToken(colleagueB, 'Phạm Thị B');

  const colleagueC = 'cust_colleague_204';
  const tokenC = generateToken(colleagueC, 'Lê Hoàng C');

  const driverUser = 'driver_fast_001';
  const driverToken = generateToken(driverUser, 'Bác Tài Xế', 'DRIVER');

  // ----------------------------------------------------------------------------
  // TIER 1: FUNCTIONAL HAPPY PATHS (Features 1 to 8)
  // ----------------------------------------------------------------------------
  describe('Tier 1: Functional Happy Paths (Features 1 - 8)', () => {
    it('T1.1: F1 - Spin Roulette returns exactly 8 dishes, winner 0-7, and 5-min session', async () => {
      const res = await request(restaurantApp)
        .post('/api/v1/restaurants/roulette/spin')
        .set('Authorization', `Bearer ${soloToken}`)
        .send({ budget: 'all', mood: 'all' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const { items, winnerIndex, winnerItem, sessionId, bonusType, expiresAt } = res.body.data;
      expect(items).toHaveLength(8);
      expect(winnerIndex).toBeGreaterThanOrEqual(0);
      expect(winnerIndex).toBeLessThan(8);
      expect(winnerItem.menuItemId).toBe(items[winnerIndex].menuItemId);
      expect(bonusType).toBe('DOUBLE_COINS');
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
      expect(sessionId).toMatch(/^rsess_\d+_[a-f0-9]+$/);
    });

    it('T1.2: F2 - Rate limiting tracks daily quota and remaining spins', async () => {
      const statusRes = await request(restaurantApp)
        .get('/api/v1/restaurants/roulette/status')
        .set('Authorization', `Bearer ${soloToken}`);

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.body.data.maxSpins).toBe(3);
      expect(statusRes.body.data.spinsUsed).toBe(1);
      expect(statusRes.body.data.spinsRemaining).toBe(2);
    });

    it('T1.3: F3 - Lookup RouletteSession confirms validity and item data', async () => {
      const activeSession = mockRouletteSessions[0];
      expect(activeSession).toBeDefined();

      const inspectRes = await request(restaurantApp)
        .get(`/api/v1/restaurants/roulette/session/${activeSession.sessionId}`);

      expect(inspectRes.statusCode).toBe(200);
      expect(inspectRes.body.data.sessionId).toBe(activeSession.sessionId);
      expect(inspectRes.body.data.isUsed).toBe(false);
      expect(inspectRes.body.data.isValid).toBe(true);
    });

    it('T1.4: F4 - Checkout with valid rouletteSessionId applies coinBonusMultiplier: 2', async () => {
      const activeSession = mockRouletteSessions[0];

      const checkoutRes = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${soloToken}`)
        .send({
          restaurantId: activeSession.restaurantId,
          rouletteSessionId: activeSession.sessionId,
          items: [
            { menuItemId: activeSession.menuItemId, name: activeSession.menuItemName, price: 58000, quantity: 1 }
          ],
          totalPrice: 74000
        });

      expect(checkoutRes.statusCode).toBe(201);
      expect(checkoutRes.body.success).toBe(true);
      expect(checkoutRes.body.data.coinBonusMultiplier).toBe(2);
      expect(checkoutRes.body.data.rouletteSessionId).toBe(activeSession.sessionId);
      expect(activeSession.isUsed).toBe(true);
    });

    it('T1.5: F5 - Create Group Order room returns 6-character roomCode and Host member', async () => {
      const createRes = await request(orderApp)
        .post('/api/v1/orders/group-order/create')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          restaurantId: 'res_comtam_03',
          restaurantName: 'Cơm Tấm Ba Ghiền',
          shippingFee: 16000,
          deliveryAddress: 'Phòng 402, Tòa nhà Bitexco, Q.1'
        });

      expect(createRes.statusCode).toBe(201);
      const room = createRes.body.data;
      expect(room.roomCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(room.status).toBe('OPEN');
      expect(room.hostId).toBe(hostUser);
      expect(room.members).toHaveLength(1);
      expect(room.members[0].isHost).toBe(true);
    });

    it('T1.6: F6 - Colleague joins Group Order and adds items to shared cart', async () => {
      const roomCode = mockGroupOrders[0].roomCode;

      const joinRes = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/join`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ displayName: 'Trần Văn A' });

      expect(joinRes.statusCode).toBe(200);
      expect(joinRes.body.data.members).toHaveLength(2);

      const addItemRes = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/items`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          menuItemId: 'dish_suon_cha',
          name: 'Cơm sườn chả',
          price: 50000,
          quantity: 2
        });

      expect(addItemRes.statusCode).toBe(201);
      expect(addItemRes.body.data.items).toHaveLength(1);
    });

    it('T1.7: F7 - Bill Splitting Engine splits shipping fee equally across members with dishes', async () => {
      const roomCode = mockGroupOrders[0].roomCode;

      // Host also adds a dish
      await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/items`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          menuItemId: 'dish_suon_dac_biet',
          name: 'Cơm sườn đặc biệt',
          price: 60000,
          quantity: 1
        });

      const inspectRes = await request(orderApp).get(`/api/v1/orders/group-order/${roomCode}`);
      expect(inspectRes.statusCode).toBe(200);
      const summary = inspectRes.body.data.summary;

      // Host: 60k; Colleague A: 100k -> Gross: 160k
      expect(summary.grossFoodTotal).toBe(160000);
      expect(summary.shippingFee).toBe(16000);
      expect(summary.splitCount).toBe(2);
      expect(summary.shippingPerMember).toBe(8000);
      expect(summary.finalTotal).toBe(176000);
    });

    it('T1.8: F8 - Host locks room and performs Checkout creating final Order with groupOrderInfo', async () => {
      const roomCode = mockGroupOrders[0].roomCode;

      // Host locks room
      const lockRes = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/lock`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ status: 'LOCKED' });

      expect(lockRes.statusCode).toBe(200);
      expect(lockRes.body.status).toBe('LOCKED');

      // Host checks out
      const checkoutRes = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/checkout`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          deliveryAddress: 'Tầng 12, Keangnam Landmark, Hà Nội',
          paymentMethod: 'VNPAY'
        });

      expect(checkoutRes.statusCode).toBe(201);
      expect(checkoutRes.body.groupOrder.status).toBe('ORDERED');
      expect(checkoutRes.body.order.isGroupOrder).toBe(true);
      expect(checkoutRes.body.order.groupOrderInfo.splitCount).toBe(2);
    });
  });

  // ----------------------------------------------------------------------------
  // TIER 2: BOUNDARY VALUE ANALYSIS (BVA) & CORNER/EDGE CASES
  // ----------------------------------------------------------------------------
  describe('Tier 2: Boundary Value Analysis (BVA) & Edge Cases', () => {
    it('T2.1: Rate Limiting Boundary - 4th spin in same day returns 429 with reset countdown', async () => {
      // User spins spin #2 and spin #3
      await request(restaurantApp).post('/api/v1/restaurants/roulette/spin').set('Authorization', `Bearer ${soloToken}`).send({});
      await request(restaurantApp).post('/api/v1/restaurants/roulette/spin').set('Authorization', `Bearer ${soloToken}`).send({});

      // 4th spin is strictly blocked
      const blockedRes = await request(restaurantApp)
        .post('/api/v1/restaurants/roulette/spin')
        .set('Authorization', `Bearer ${soloToken}`)
        .send({});

      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.body.spinsRemaining).toBe(0);
      expect(blockedRes.body.resetAt).toBeDefined();
      expect(blockedRes.body.resetInSeconds).toBeGreaterThan(0);
    });

    it('T2.2: Session Expiration Boundary - Session expired by 1 second is rejected with HTTP 400', async () => {
      const expiredSessionId = 'rsess_bva_expired';
      mockRouletteSessions.push({
        sessionId: expiredSessionId,
        userId: soloUser,
        menuItemId: 'dish_ca_phe_01',
        menuItemName: 'Cà phê',
        restaurantId: 'res_coffee_01',
        bonusType: 'DOUBLE_COINS',
        isUsed: false,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      });

      const res = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${soloToken}`)
        .send({
          restaurantId: 'res_coffee_01',
          rouletteSessionId: expiredSessionId,
          items: [{ menuItemId: 'dish_ca_phe_01', name: 'Cà phê', price: 25000, quantity: 1 }]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/hết hạn/i);
    });

    it('T2.3: Session Ownership Boundary - User B using User A session is blocked with HTTP 403', async () => {
      const userASessionId = 'rsess_owner_test_a';
      mockRouletteSessions.push({
        sessionId: userASessionId,
        userId: soloUser,
        menuItemId: 'dish_ca_phe_01',
        menuItemName: 'Cà phê',
        restaurantId: 'res_coffee_01',
        bonusType: 'DOUBLE_COINS',
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const res = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${tokenA}`) // Colleague A attempting to use Solo User's session
        .send({
          restaurantId: 'res_coffee_01',
          rouletteSessionId: userASessionId,
          items: [{ menuItemId: 'dish_ca_phe_01', name: 'Cà phê', price: 25000, quantity: 1 }]
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/không thuộc về tài khoản này/i);
    });

    it('T2.4: Dish Mismatch Boundary - Cart omitting the winning menuItemId is rejected with HTTP 400', async () => {
      const validSessionId = 'rsess_mismatch_test';
      mockRouletteSessions.push({
        sessionId: validSessionId,
        userId: colleagueA,
        menuItemId: 'dish_pho_bo_08',
        menuItemName: 'Phở bò tái lăn Hà Nội',
        restaurantId: 'res_phothin_07',
        bonusType: 'DOUBLE_COINS',
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const res = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          restaurantId: 'res_phothin_07',
          rouletteSessionId: validSessionId,
          // Cart contains a completely different dish
          items: [{ menuItemId: 'dish_other_random', name: 'Bánh quẩy', price: 10000, quantity: 2 }]
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/chứa món ăn trúng thưởng/i);
    });

    it('T2.5: Group Order Room Code Case-Insensitivity - Lowercase and uppercase resolve to same room', async () => {
      const createRes = await request(orderApp)
        .post('/api/v1/orders/group-order/create')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ restaurantId: 'res_bva_case', restaurantName: 'Quán Test Mã' });

      const roomCode = createRes.body.data.roomCode;
      const lower = roomCode.toLowerCase();

      const lookupLower = await request(orderApp).get(`/api/v1/orders/group-order/${lower}`);
      expect(lookupLower.statusCode).toBe(200);
      expect(lookupLower.body.data.roomCode).toBe(roomCode);
    });

    it('T2.6: Group Order Zero-Dish Member Exclusion - Member with 0 dishes pays 0 shipping fee', async () => {
      const createRes = await request(orderApp)
        .post('/api/v1/orders/group-order/create')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ restaurantId: 'res_bva_split', shippingFee: 20000 });

      const roomCode = createRes.body.data.roomCode;

      // Colleague A joins and adds dish
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenA}`).send({ displayName: 'A' });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenA}`).send({
        menuItemId: 'dish_a', name: 'Món A', price: 40000, quantity: 1
      });

      // Colleague B joins but selects ZERO dishes
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenB}`).send({ displayName: 'B' });

      const summaryRes = await request(orderApp).get(`/api/v1/orders/group-order/${roomCode}`);
      const summary = summaryRes.body.data.summary;

      expect(summary.splitCount).toBe(1); // Only Colleague A
      expect(summary.shippingPerMember).toBe(20000);

      const bBreakdown = summary.membersBreakdown.find((m) => m.userId === colleagueB);
      expect(bBreakdown.shippingShare).toBe(0);
      expect(bBreakdown.totalPayable).toBe(0);
    });

    it('T2.7: Group Order Lock Immunity - Cannot add items when locked, but can resume when unlocked', async () => {
      const room = mockGroupOrders[mockGroupOrders.length - 1];

      // Lock room
      await request(orderApp).post(`/api/v1/orders/group-order/${room.roomCode}/lock`).set('Authorization', `Bearer ${hostToken}`).send({ status: 'LOCKED' });

      // Add item fails
      const failedAdd = await request(orderApp)
        .post(`/api/v1/orders/group-order/${room.roomCode}/items`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ menuItemId: 'dish_b', name: 'Món B', price: 30000, quantity: 1 });
      expect(failedAdd.statusCode).toBe(400);

      // Unlock room
      await request(orderApp).post(`/api/v1/orders/group-order/${room.roomCode}/lock`).set('Authorization', `Bearer ${hostToken}`).send({ unlock: true });

      // Add item succeeds
      const succeedAdd = await request(orderApp)
        .post(`/api/v1/orders/group-order/${room.roomCode}/items`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ menuItemId: 'dish_b', name: 'Món B', price: 30000, quantity: 1 });
      expect(succeedAdd.statusCode).toBe(201);
    });

    it('T2.8: Group Order Empty Cart Checkout Guard - Cannot checkout room with 0 items', async () => {
      const createRes = await request(orderApp)
        .post('/api/v1/orders/group-order/create')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ restaurantId: 'res_empty' });

      const roomCode = createRes.body.data.roomCode;

      const checkoutRes = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/checkout`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ paymentMethod: 'COD' });

      expect(checkoutRes.statusCode).toBe(400);
      expect(checkoutRes.body.message).toMatch(/giỏ hàng nhóm đang trống/i);
    });
  });

  // ----------------------------------------------------------------------------
  // TIER 3: COMBINATORIAL MATRIX TESTS
  // ----------------------------------------------------------------------------
  describe('Tier 3: Combinatorial Matrix Tests (Cart combinations & Discounts)', () => {
    it('T3.1: Group Order with 4 members + custom quantities + split shipping calculation', async () => {
      const createRes = await request(orderApp)
        .post('/api/v1/orders/group-order/create')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ restaurantId: 'res_pho_thin', shippingFee: 24000 });

      const roomCode = createRes.body.data.roomCode;

      // Join all 3 colleagues
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenA}`).send({ displayName: 'A' });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenB}`).send({ displayName: 'B' });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenC}`).send({ displayName: 'C' });

      // Host: 75k x 1 = 75k
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${hostToken}`).send({ menuItemId: 'd1', name: 'Phở', price: 75000, quantity: 1 });
      // A: 50k x 2 = 100k
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenA}`).send({ menuItemId: 'd2', name: 'Cơm', price: 50000, quantity: 2 });
      // B: 25k x 3 = 75k
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenB}`).send({ menuItemId: 'd3', name: 'Nước', price: 25000, quantity: 3 });
      // C: 80k x 1 = 80k
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenC}`).send({ menuItemId: 'd4', name: 'Gà', price: 80000, quantity: 1 });

      const res = await request(orderApp).get(`/api/v1/orders/group-order/${roomCode}`);
      const summary = res.body.data.summary;

      // Gross: 75 + 100 + 75 + 80 = 330,000đ
      expect(summary.grossFoodTotal).toBe(330000);
      expect(summary.splitCount).toBe(4);
      // Shipping: 24,000 / 4 = 6,000đ
      expect(summary.shippingPerMember).toBe(6000);
      expect(summary.finalTotal).toBe(354000);

      const hostSum = summary.membersBreakdown.find((m) => m.userId === hostUser);
      expect(hostSum.totalPayable).toBe(75000 + 6000);

      const aSum = summary.membersBreakdown.find((m) => m.userId === colleagueA);
      expect(aSum.totalPayable).toBe(100000 + 6000);
    });

    it('T3.2: Roulette Order Checkout with Store Voucher discount preserved alongside x2 Coins', async () => {
      const sessId = 'rsess_combo_voucher';
      mockRouletteSessions.push({
        sessionId: sessId,
        userId: soloUser,
        menuItemId: 'dish_bun_bo_06',
        menuItemName: 'Bún bò Huế',
        restaurantId: 'res_bunbo_05',
        bonusType: 'DOUBLE_COINS',
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const res = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${soloToken}`)
        .send({
          restaurantId: 'res_bunbo_05',
          rouletteSessionId: sessId,
          items: [{ menuItemId: 'dish_bun_bo_06', name: 'Bún bò Huế', price: 65000, quantity: 2 }],
          storeVoucherDiscount: 20000,
          voucherIssuerType: 'STORE',
          shippingFee: 16000,
          totalPrice: 126000
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.coinBonusMultiplier).toBe(2);
      expect(res.body.data.storeVoucherDiscount).toBe(20000);
      expect(res.body.data.rouletteSessionId).toBe(sessId);
    });
  });

  // ----------------------------------------------------------------------------
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (Scenarios 1 to 5)
  // ----------------------------------------------------------------------------
  describe('Tier 4: Real-World Application Scenarios (1 - 5)', () => {
    // Scenario 1: Solo Lucky Eater
    it('Scenario 1: Solo Lucky Eater - Spins roulette -> Wins dish -> Checks out -> Order delivered -> Receives 2,000 Coins', async () => {
      const luckySoloUser = 'cust_lucky_solo_eater';
      const luckyToken = generateToken(luckySoloUser, 'Lê Lucky');

      // 1. User spins roulette
      const spinRes = await request(restaurantApp)
        .post('/api/v1/restaurants/roulette/spin')
        .set('Authorization', `Bearer ${luckyToken}`)
        .send({ budget: '40k_70k', mood: 'snack' });

      expect(spinRes.statusCode).toBe(200);
      const { winnerItem, sessionId } = spinRes.body.data;

      // 2. User immediately checks out with the winning item and session
      const orderRes = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${luckyToken}`)
        .send({
          restaurantId: winnerItem.restaurantId,
          rouletteSessionId: sessionId,
          items: [
            { menuItemId: winnerItem.menuItemId, name: winnerItem.name, price: winnerItem.price, quantity: 1 }
          ],
          totalPrice: winnerItem.price + 16000
        });

      expect(orderRes.statusCode).toBe(201);
      const createdOrder = orderRes.body.data;
      expect(createdOrder.coinBonusMultiplier).toBe(2);
      expect(createdOrder.status).toBe('PENDING');

      // 3. Driver delivers order -> Status DELIVERED
      const deliverRes = await request(orderApp)
        .put(`/api/v1/orders/${createdOrder._id}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'DELIVERED' });

      expect(deliverRes.statusCode).toBe(200);
      expect(deliverRes.body.data.status).toBe('DELIVERED');

      // 4. Verify 2,000 Coins awarded to User in Auth Service
      expect(creditedCoinsHistory.some((c) => c.userId === luckySoloUser && c.amount === 2000)).toBe(true);

      // 5. Verify RabbitMQ event published with x2 Coin metadata
      expect(publishEvent).toHaveBeenCalledWith(
        'food_order_topic',
        'order.completed',
        expect.objectContaining({
          coinBonusMultiplier: 2,
          rewardCoins: 2000
        })
      );
    });

    // Scenario 2: Office Lunch Party
    it('Scenario 2: Office Lunch Party - Host creates room -> 3 colleagues join via roomCode -> Add dishes -> Equal ship split -> Host locks & checks out', async () => {
      // 1. Host creates room for office lunch
      const createRes = await request(orderApp)
        .post('/api/v1/orders/group-order/create')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          restaurantId: 'res_bunbo_05',
          restaurantName: 'Bún Bò Đông Ba',
          shippingFee: 20000,
          deliveryAddress: 'Tầng 8, Tòa nhà Vincom Center, Q.1',
          note: 'Mang theo muỗng đũa đầy đủ'
        });

      expect(createRes.statusCode).toBe(201);
      const roomCode = createRes.body.data.roomCode;

      // 2. 3 colleagues join via shared roomCode
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenA}`).send({ displayName: 'Trần Văn A' });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenB}`).send({ displayName: 'Phạm Thị B' });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenC}`).send({ displayName: 'Lê Hoàng C' });

      // 3. Each adds their dish
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${hostToken}`).send({
        menuItemId: 'dish_bunbo_dacbiet', name: 'Bún bò đặc biệt', price: 65000, quantity: 1, note: 'Không hành tây'
      });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenA}`).send({
        menuItemId: 'dish_bunbo_bap', name: 'Bún bò bắp hoa', price: 60000, quantity: 1
      });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenB}`).send({
        menuItemId: 'dish_bunbo_gio', name: 'Bún bò giò heo', price: 55000, quantity: 1
      });
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenC}`).send({
        menuItemId: 'dish_bunbo_tai', name: 'Bún bò tái', price: 60000, quantity: 1
      });

      // 4. Verify equal shipping split (20,000 / 4 = 5,000đ per person)
      const inspectRes = await request(orderApp).get(`/api/v1/orders/group-order/${roomCode}`);
      const summary = inspectRes.body.data.summary;
      expect(summary.splitCount).toBe(4);
      expect(summary.shippingPerMember).toBe(5000);
      expect(summary.grossFoodTotal).toBe(240000);
      expect(summary.finalTotal).toBe(260000);

      // 5. Host locks room to freeze choices
      const lockRes = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/lock`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ status: 'LOCKED' });
      expect(lockRes.statusCode).toBe(200);

      // 6. Host completes group checkout
      const checkoutRes = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/checkout`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          paymentMethod: 'VNPAY',
          deliveryAddress: 'Tầng 8, Tòa nhà Vincom Center, Q.1'
        });

      expect(checkoutRes.statusCode).toBe(201);
      expect(checkoutRes.body.groupOrder.status).toBe('ORDERED');
      expect(checkoutRes.body.order.isGroupOrder).toBe(true);
      expect(checkoutRes.body.order.groupOrderRoomCode).toBe(roomCode);
    });

    // Scenario 3: Quota Exhaustion & Next-Day Reset
    it('Scenario 3: Quota Exhaustion & Next-Day Reset - Blocked after 3 spins, permitted on simulated next day', async () => {
      const freshUser = 'cust_quota_user_301';
      const freshToken = generateToken(freshUser, 'Nguyễn Quota');

      // Spin 1
      const s1 = await request(restaurantApp).post('/api/v1/restaurants/roulette/spin').set('Authorization', `Bearer ${freshToken}`).send({});
      expect(s1.body.data.spinsRemaining).toBe(2);

      // Spin 2
      const s2 = await request(restaurantApp).post('/api/v1/restaurants/roulette/spin').set('Authorization', `Bearer ${freshToken}`).send({});
      expect(s2.body.data.spinsRemaining).toBe(1);

      // Spin 3
      const s3 = await request(restaurantApp).post('/api/v1/restaurants/roulette/spin').set('Authorization', `Bearer ${freshToken}`).send({});
      expect(s3.body.data.spinsRemaining).toBe(0);

      // Spin 4 is blocked
      const s4 = await request(restaurantApp).post('/api/v1/restaurants/roulette/spin').set('Authorization', `Bearer ${freshToken}`).send({});
      expect(s4.statusCode).toBe(429);
      expect(s4.body.spinsRemaining).toBe(0);
      expect(s4.body.resetAt).toBeDefined();

      // Simulate next day in UTC+7 by updating dateStr
      const todayLog = mockSpinLogs.find((l) => l.userId === freshUser);
      expect(todayLog).toBeDefined();
      todayLog.dateStr = '2026-01-01'; // Mark as yesterday

      // On new day, user can spin again
      const nextDaySpin = await request(restaurantApp).post('/api/v1/restaurants/roulette/spin').set('Authorization', `Bearer ${freshToken}`).send({});
      expect(nextDaySpin.statusCode).toBe(200);
      expect(nextDaySpin.body.data.spinsRemaining).toBe(2);
    });

    // Scenario 4: Fraud Prevention
    it('Scenario 4: Fraud Prevention - Rejects expired session, stolen session, cart dish mismatch, and replay consumption', async () => {
      const victimUser = 'cust_victim_401';
      const attackerUser = 'cust_attacker_402';
      const attackerToken = generateToken(attackerUser, 'Kẻ Gian');

      // 4.1 Create genuine session for victim
      const legitSessionId = 'rsess_legit_victim_401';
      mockRouletteSessions.push({
        sessionId: legitSessionId,
        userId: victimUser,
        menuItemId: 'dish_ga_ran_07',
        menuItemName: 'Gà rán sốt cay',
        restaurantId: 'res_garan_06',
        bonusType: 'DOUBLE_COINS',
        isUsed: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      // Attacker attempts to use victim's session -> 403 Forbidden
      const stolenRes = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          restaurantId: 'res_garan_06',
          rouletteSessionId: legitSessionId,
          items: [{ menuItemId: 'dish_ga_ran_07', name: 'Gà rán', price: 85000, quantity: 1 }]
        });
      expect(stolenRes.statusCode).toBe(403);

      // 4.2 Attacker uses non-existent session -> 400 Bad Request
      const fakeRes = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          restaurantId: 'res_garan_06',
          rouletteSessionId: 'rsess_fake_non_existent',
          items: [{ menuItemId: 'dish_ga_ran_07', name: 'Gà rán', price: 85000, quantity: 1 }]
        });
      expect(fakeRes.statusCode).toBe(400);

      // 4.3 Attacker uses expired session -> 400 Bad Request
      const expId = 'rsess_fraud_expired';
      mockRouletteSessions.push({
        sessionId: expId,
        userId: attackerUser,
        menuItemId: 'dish_ga_ran_07',
        menuItemName: 'Gà rán',
        restaurantId: 'res_garan_06',
        bonusType: 'DOUBLE_COINS',
        isUsed: false,
        expiresAt: new Date(Date.now() - 10000) // expired 10s ago
      });

      const expRes = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          restaurantId: 'res_garan_06',
          rouletteSessionId: expId,
          items: [{ menuItemId: 'dish_ga_ran_07', name: 'Gà rán', price: 85000, quantity: 1 }]
        });
      expect(expRes.statusCode).toBe(400);

      // 4.4 Replay attack: Reuse session that was already marked isUsed: true -> 400 Bad Request
      const usedId = 'rsess_already_consumed_fraud';
      mockRouletteSessions.push({
        sessionId: usedId,
        userId: attackerUser,
        menuItemId: 'dish_ga_ran_07',
        menuItemName: 'Gà rán',
        restaurantId: 'res_garan_06',
        bonusType: 'DOUBLE_COINS',
        isUsed: true, // Already consumed
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const replayRes = await request(orderApp)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          restaurantId: 'res_garan_06',
          rouletteSessionId: usedId,
          items: [{ menuItemId: 'dish_ga_ran_07', name: 'Gà rán', price: 85000, quantity: 1 }]
        });
      expect(replayRes.statusCode).toBe(400);
      expect(replayRes.body.message).toMatch(/đã được sử dụng/i);
    });

    // Scenario 5: Group Cart Conflict & Permissions
    it('Scenario 5: Group Cart Conflict & Permissions - Prevents unauthorized dish deletion, non-host lock, and unauthorized checkout', async () => {
      // 1. Host creates room
      const createRes = await request(orderApp)
        .post('/api/v1/orders/group-order/create')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ restaurantId: 'res_comtam_03', restaurantName: 'Cơm Tấm' });

      const roomCode = createRes.body.data.roomCode;

      // 2. Colleague A joins and adds a dish
      await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/join`).set('Authorization', `Bearer ${tokenA}`).send({ displayName: 'A' });
      const addRes = await request(orderApp).post(`/api/v1/orders/group-order/${roomCode}/items`).set('Authorization', `Bearer ${tokenA}`).send({
        menuItemId: 'dish_item_a', name: 'Món của A', price: 50000, quantity: 1
      });
      const itemAId = addRes.body.data.items[0]._id;

      // 3. Colleague B attempts to delete Colleague A's dish -> 403 Forbidden
      const unauthorizedDel = await request(orderApp)
        .delete(`/api/v1/orders/group-order/${roomCode}/items/${itemAId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(unauthorizedDel.statusCode).toBe(403);
      expect(unauthorizedDel.body.message).toMatch(/không có quyền xóa/i);

      // 4. Colleague A attempts to lock room -> 403 Forbidden (Only Host can lock)
      const unauthorizedLock = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/lock`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(unauthorizedLock.statusCode).toBe(403);
      expect(unauthorizedLock.body.message).toMatch(/chỉ trưởng nhóm/i);

      // 5. Colleague A attempts to checkout room -> 403 Forbidden (Only Host can checkout)
      const unauthorizedCheckout = await request(orderApp)
        .post(`/api/v1/orders/group-order/${roomCode}/checkout`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(unauthorizedCheckout.statusCode).toBe(403);
      expect(unauthorizedCheckout.body.message).toMatch(/chỉ trưởng nhóm/i);

      // 6. Colleague A deletes their own dish -> 200 OK
      const authorizedDel = await request(orderApp)
        .delete(`/api/v1/orders/group-order/${roomCode}/items/${itemAId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(authorizedDel.statusCode).toBe(200);
      expect(authorizedDel.body.data.items).toHaveLength(0);
    });
  });
});
