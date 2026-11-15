const request = require('supertest');
const crypto = require('crypto');

// 1. Mock RabbitMQ
jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

// 2. In-memory Mock Stores
let mockGroupOrders = [];
let mockOrders = [];

jest.mock('../src/models/GroupOrder', () => {
  const MockGroupOrder = jest.fn().mockImplementation(function (data) {
    const id = `grp_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
      // Gán _id cho members nếu chưa có
      if (Array.isArray(this.members)) {
        this.members.forEach((m) => {
          if (!m._id) m._id = `mem_${Math.random().toString(36).slice(2, 8)}`;
        });
      }
      // Gán _id cho items nếu chưa có
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

jest.mock('../src/models/Order', () => {
  const MockOrder = jest.fn().mockImplementation(function (data) {
    const id = `ord_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    Object.assign(this, {
      _id: id,
      status: 'PENDING',
      paymentMethod: 'VNPAY',
      shippingFee: 16000,
      isGroupOrder: false,
      groupOrderRoomCode: null,
      groupOrderInfo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    });

    this.save = jest.fn().mockImplementation(async () => {
      mockOrders.push(this);
      return this;
    });

    return this;
  });

  MockOrder.findById = jest.fn().mockImplementation(async (id) => {
    return mockOrders.find((o) => String(o._id) === String(id)) || null;
  });

  return MockOrder;
});

// Helper sinh JWT Token cho người dùng
function createAuthToken(userId, name = 'Người Dùng Test', role = 'USER') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      userId,
      name,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600
    })
  ).toString('base64url');

  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_123';
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const { publishEvent, DEFAULT_EXCHANGE } = require('../src/rabbitmq');
const app = require('../app');

describe('Group Order Management - "Lập kèo ăn trưa" (Requirement R3) - Unit & Integration Tests', () => {
  const hostId = 'user_host_001';
  const member1Id = 'user_member_002';
  const member2Id = 'user_member_003';
  const outsiderId = 'user_outsider_999';

  const hostToken = createAuthToken(hostId, 'Trưởng Nhóm Tuấn');
  const member1Token = createAuthToken(member1Id, 'Lan Kế Toán');
  const member2Token = createAuthToken(member2Id, 'Huy IT');
  const outsiderToken = createAuthToken(outsiderId, 'Người Lạ');

  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupOrders = [];
    mockOrders = [];
  });

  // ---------------------------------------------------------------------------
  // Test 1: Khởi tạo phòng đặt nhóm (POST /group-order/create)
  // ---------------------------------------------------------------------------
  it('Test 1: Trưởng nhóm tạo phòng -> sinh roomCode 6 ký tự, host là thành viên đầu tiên', async () => {
    const payload = {
      restaurantId: 'rest_com_tam_01',
      restaurantName: 'Cơm Tấm Ba Ghiền',
      restaurantImage: 'https://cdn.foodfast.vn/ba-ghien.jpg',
      deliveryAddress: 'Tòa nhà Landmark 81, P.22, Bình Thạnh',
      note: 'Giao lên sảnh lễ tân tầng trệt',
      shippingFee: 16000
    };

    const res = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);

    const room = res.body.data;
    expect(room.roomCode).toBeDefined();
    expect(room.roomCode).toHaveLength(6);
    expect(room.roomCode).toMatch(/^[A-Z0-9]{6}$/);

    expect(room.status).toBe('OPEN');
    expect(room.hostId).toBe(hostId);
    expect(room.restaurantId).toBe('rest_com_tam_01');
    expect(room.members).toHaveLength(1);
    expect(room.members[0].isHost).toBe(true);
    expect(room.members[0].userId).toBe(hostId);

    // Initial summary
    expect(room.summary.grossFoodTotal).toBe(0);
    expect(room.summary.splitCount).toBe(0);
    expect(room.summary.shippingFee).toBe(16000);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Tra cứu thông tin phòng và bảng tóm tắt (GET /group-order/:roomCode)
  // ---------------------------------------------------------------------------
  it('Test 2: Lấy thông tin phòng qua mã roomCode (hỗ trợ cả chữ hoa và thường)', async () => {
    // Tạo phòng
    const createRes = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ restaurantId: 'rest_01', restaurantName: 'Quán Ăn Mẫu' });

    const roomCode = createRes.body.data.roomCode;

    // Tra cứu bằng mã viết thường
    const getRes = await request(app).get(`/api/v1/orders/group-order/${roomCode.toLowerCase()}`);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.roomCode).toBe(roomCode.toUpperCase());
    expect(getRes.body.data.summary).toBeDefined();

    // Tra cứu phòng không tồn tại -> 404
    const notFoundRes = await request(app).get('/api/v1/orders/group-order/NOT999');
    expect(notFoundRes.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Thành viên tham gia phòng (POST /group-order/:roomCode/join)
  // ---------------------------------------------------------------------------
  it('Test 3: Tham gia phòng đặt nhóm thành công, hỗ trợ idempotent nếu tham gia lại', async () => {
    const createRes = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ restaurantId: 'rest_01' });

    const roomCode = createRes.body.data.roomCode;

    // Member 1 tham gia
    const join1 = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/join`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({ displayName: 'Lan Kế Toán' });

    expect(join1.statusCode).toBe(200);
    expect(join1.body.success).toBe(true);
    expect(join1.body.member.displayName).toBe('Lan Kế Toán');
    expect(join1.body.data.members).toHaveLength(2);

    // Member 1 tham gia lần 2 (idempotent - không bị trùng lặp)
    const join1Again = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/join`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({ displayName: 'Lan Kế Toán' });

    expect(join1Again.statusCode).toBe(200);
    expect(join1Again.body.message).toMatch(/trước đó/i);
    expect(join1Again.body.data.members).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Test 4 & 5: Thêm món và kiểm tra tính toán chia đều phí ship (Bill Splitting Engine)
  // ---------------------------------------------------------------------------
  it('Test 4 & 5: Các thành viên thêm món -> Phí ship chia đều chính xác cho các thành viên có đặt món', async () => {
    // 1. Tạo phòng
    const createRes = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ restaurantId: 'rest_01', shippingFee: 16000 });

    const roomCode = createRes.body.data.roomCode;

    // 2. Member 1 và Member 2 tham gia phòng
    await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/join`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({ displayName: 'Lan Kế Toán' });

    await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/join`)
      .set('Authorization', `Bearer ${member2Token}`)
      .send({ displayName: 'Huy IT' });

    // 3. Trưởng nhóm thêm món 1: Cơm sườn 50.000đ (SL: 1)
    const hostItemRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/items`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        menuItemId: 'dish_suon_01',
        name: 'Cơm sườn nướng',
        price: 50000,
        quantity: 1,
        note: 'Ít cơm nhiều mỡ hành'
      });
    expect(hostItemRes.statusCode).toBe(201);

    // 4. Member 1 thêm món 2: Cơm sườn bì chả 65.000đ (SL: 2) -> 130.000đ
    const m1ItemRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/items`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({
        menuItemId: 'dish_suon_bi_cha',
        name: 'Cơm sườn bì chả đặc biệt',
        price: 65000,
        quantity: 2
      });
    expect(m1ItemRes.statusCode).toBe(201);

    // Chú ý: Member 2 (Huy IT) tham gia phòng nhưng CHƯA chọn món nào!

    // 5. Kiểm tra bảng phân bổ chi phí (Bill Split Summary)
    const inspectRes = await request(app).get(`/api/v1/orders/group-order/${roomCode}`);
    const summary = inspectRes.body.data.summary;

    // Tổng tiền món cả nhóm: 50.000 + 130.000 = 180.000đ
    expect(summary.grossFoodTotal).toBe(180000);
    expect(summary.shippingFee).toBe(16000);

    // Chỉ có 2 người đặt món (Trưởng nhóm và Lan Kế Toán) -> splitCount = 2
    expect(summary.splitCount).toBe(2);

    // Phí ship mỗi người cần chịu: 16.000 / 2 = 8.000đ
    expect(summary.shippingPerMember).toBe(8000);

    // Bảng breakdown từng người
    const breakdown = summary.membersBreakdown;
    expect(breakdown).toHaveLength(3);

    // Host breakdown
    const hostBreakdown = breakdown.find((b) => b.userId === hostId);
    expect(hostBreakdown.foodTotal).toBe(50000);
    expect(hostBreakdown.shippingShare).toBe(8000);
    expect(hostBreakdown.totalPayable).toBe(58000); // 50.000 + 8.000

    // Member 1 (Lan Kế Toán) breakdown
    const m1Breakdown = breakdown.find((b) => b.userId === member1Id);
    expect(m1Breakdown.foodTotal).toBe(130000);
    expect(m1Breakdown.shippingShare).toBe(8000);
    expect(m1Breakdown.totalPayable).toBe(138000); // 130.000 + 8.000

    // Member 2 (Huy IT - không chọn món) breakdown
    const m2Breakdown = breakdown.find((b) => b.userId === member2Id);
    expect(m2Breakdown.foodTotal).toBe(0);
    expect(m2Breakdown.shippingShare).toBe(0); // Không phải chia ship
    expect(m2Breakdown.totalPayable).toBe(0);

    // Tổng tiền thanh toán cả nhóm = 180.000 + 16.000 = 196.000đ
    expect(summary.finalTotal).toBe(196000);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Phân quyền xóa món (chỉ người tạo món hoặc Host mới được xóa)
  // ---------------------------------------------------------------------------
  it('Test 6: Kiểm tra quyền xóa món - Người ngoài bị chặn 403, chủ món hoặc Host xóa thành công', async () => {
    const createRes = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ restaurantId: 'rest_01' });

    const roomCode = createRes.body.data.roomCode;

    // Member 1 tham gia và thêm món
    await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/join`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({ displayName: 'Lan Kế Toán' });

    const addItemRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/items`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({
        menuItemId: 'dish_lan_01',
        name: 'Trà tắc khổng lồ',
        price: 25000,
        quantity: 1
      });

    const addedItem = addItemRes.body.data.items[0];
    const itemId = addedItem._id;

    // 6.1 Người lạ (outsider) cố tình xóa món của Lan -> Bị chặn 403
    const strangerDeleteRes = await request(app)
      .delete(`/api/v1/orders/group-order/${roomCode}/items/${itemId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(strangerDeleteRes.statusCode).toBe(403);
    expect(strangerDeleteRes.body.message).toMatch(/không có quyền xóa/i);

    // 6.2 Host xóa món của thành viên -> Thành công 200
    const hostDeleteRes = await request(app)
      .delete(`/api/v1/orders/group-order/${roomCode}/items/${itemId}`)
      .set('Authorization', `Bearer ${hostToken}`);

    expect(hostDeleteRes.statusCode).toBe(200);
    expect(hostDeleteRes.body.success).toBe(true);
    expect(hostDeleteRes.body.data.items).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Test 7: Khóa phòng (Lock) và chặn chỉnh sửa khi phòng đã bị khóa
  // ---------------------------------------------------------------------------
  it('Test 7: Khóa phòng nhóm - Chỉ Host mới được khóa, phòng LOCKED chặn thêm/xóa món', async () => {
    const createRes = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ restaurantId: 'rest_01' });

    const roomCode = createRes.body.data.roomCode;

    // 7.1 Thành viên không phải Host cố khóa phòng -> Bị chặn 403
    const memberLockRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/lock`)
      .set('Authorization', `Bearer ${member1Token}`);

    expect(memberLockRes.statusCode).toBe(403);
    expect(memberLockRes.body.message).toMatch(/chỉ trưởng nhóm/i);

    // 7.2 Host khóa phòng -> Chuyển sang LOCKED thành công
    const hostLockRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/lock`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'LOCKED' });

    expect(hostLockRes.statusCode).toBe(200);
    expect(hostLockRes.body.status).toBe('LOCKED');

    // 7.3 Khi đã LOCKED: Cố thêm món mới -> Báo lỗi 400
    const tryAddItemRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/items`)
      .set('Authorization', `Bearer ${member1Token}`)
      .send({ menuItemId: 'dish_late', name: 'Món trễ', price: 30000, quantity: 1 });

    expect(tryAddItemRes.statusCode).toBe(400);
    expect(tryAddItemRes.body.message).toMatch(/phòng đã bị khóa/i);

    // 7.4 Host mở khóa lại phòng (unlock: true) -> Chuyển về OPEN
    const hostUnlockRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/lock`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ unlock: true });

    expect(hostUnlockRes.statusCode).toBe(200);
    expect(hostUnlockRes.body.status).toBe('OPEN');
  });

  // ---------------------------------------------------------------------------
  // Test 8: Chốt đơn nhóm (Checkout Group Order) tạo thành Order hoàn chỉnh
  // ---------------------------------------------------------------------------
  it('Test 8: Host chốt đơn nhóm -> Tạo Order hoàn chỉnh với groupOrderInfo, phòng chuyển sang ORDERED', async () => {
    // Tạo phòng & thêm món
    const createRes = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        restaurantId: 'rest_pho_thin',
        restaurantName: 'Phở Thìn 13 Lò Đúc',
        shippingFee: 16000
      });

    const roomCode = createRes.body.data.roomCode;

    // Thêm 2 món
    await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/items`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ menuItemId: 'dish_pho_tai', name: 'Phở tái lăn', price: 75000, quantity: 2 });

    // 8.1 Thành viên không phải Host cố chốt đơn -> Bị từ chối 403
    const nonHostCheckout = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/checkout`)
      .set('Authorization', `Bearer ${member1Token}`);
    expect(nonHostCheckout.statusCode).toBe(403);

    // 8.2 Host chốt đơn -> Tạo Order và chuyển trạng thái ORDERED
    const checkoutRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/checkout`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        deliveryAddress: 'Phòng 402, Tòa nhà Innovation, Q.1',
        paymentMethod: 'VNPAY',
        driverNote: 'Đến nơi gọi điện trưởng nhóm'
      });

    expect(checkoutRes.statusCode).toBe(201);
    expect(checkoutRes.body.success).toBe(true);
    expect(checkoutRes.body.groupOrder.status).toBe('ORDERED');

    const createdOrder = checkoutRes.body.order;
    expect(createdOrder).toBeDefined();
    expect(createdOrder.isGroupOrder).toBe(true);
    expect(createdOrder.groupOrderRoomCode).toBe(roomCode);
    expect(createdOrder.totalPrice).toBe(75000 * 2 + 16000); // 166.000đ

    // Kiểm tra cấu trúc groupOrderInfo lưu trữ đầy đủ breakdown
    expect(createdOrder.groupOrderInfo).toBeDefined();
    expect(createdOrder.groupOrderInfo.roomCode).toBe(roomCode);
    expect(createdOrder.groupOrderInfo.splitCount).toBe(1);
    expect(createdOrder.groupOrderInfo.shippingPerMember).toBe(16000);

    // Kiểm tra RabbitMQ event order.created được phát sinh
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'order.created',
      expect.objectContaining({
        isGroupOrder: true,
        groupOrderRoomCode: roomCode
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Test 9: Từ chối chốt đơn khi giỏ hàng nhóm rỗng (HTTP 400)
  // ---------------------------------------------------------------------------
  it('Test 9: Từ chối chốt đơn khi giỏ hàng nhóm rỗng với HTTP 400', async () => {
    const createRes = await request(app)
      .post('/api/v1/orders/group-order/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ restaurantId: 'rest_empty_01' });

    const roomCode = createRes.body.data.roomCode;

    const emptyCheckoutRes = await request(app)
      .post(`/api/v1/orders/group-order/${roomCode}/checkout`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ paymentMethod: 'COD' });

    expect(emptyCheckoutRes.statusCode).toBe(400);
    expect(emptyCheckoutRes.body.message).toMatch(/giỏ hàng nhóm đang trống/i);
  });

  // ---------------------------------------------------------------------------
  // Test 10: Hỗ trợ alias đường dẫn /group/* song song với /group-order/*
  // ---------------------------------------------------------------------------
  it('Test 10: Hỗ trợ alias đường dẫn /group/* song song với /group-order/*', async () => {
    // Tạo qua /group/create
    const resCreate = await request(app)
      .post('/api/v1/orders/group/create')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ restaurantId: 'rest_alias_01' });

    expect(resCreate.statusCode).toBe(201);
    const roomCode = resCreate.body.data.roomCode;

    // Lấy chi tiết qua /group/:roomCode
    const resGet = await request(app).get(`/api/v1/orders/group/${roomCode}`);
    expect(resGet.statusCode).toBe(200);
    expect(resGet.body.data.roomCode).toBe(roomCode);
  });
});
