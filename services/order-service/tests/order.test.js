const request = require('supertest');

// 1. Mocking RabbitMQ và Model Order
jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

const mockOrderInstance = {
  _id: '65f111222333444555666777',
  restaurantId: 'rest_123',
  customerId: 'cust_456',
  items: [{ name: 'Burger Bò', price: 50000, quantity: 2 }],
  totalPrice: 100000,
  status: 'PENDING',
  paymentMethod: 'VNPAY',
  createdAt: new Date('2026-11-04T00:00:00.000Z'),
  save: jest.fn().mockResolvedValue({
    _id: '65f111222333444555666777',
    restaurantId: 'rest_123',
    customerId: 'cust_456',
    items: [{ name: 'Burger Bò', price: 50000, quantity: 2 }],
    totalPrice: 100000,
    status: 'PENDING',
    paymentMethod: 'VNPAY',
    createdAt: new Date('2026-11-04T00:00:00.000Z')
  })
};

jest.mock('../src/models/Order', () => {
  const MockOrder = jest.fn().mockImplementation(() => mockOrderInstance);
  MockOrder.findById = jest.fn();
  MockOrder.find = jest.fn();
  return MockOrder;
});

const { publishEvent, DEFAULT_EXCHANGE } = require('../src/rabbitmq');
const Order = require('../src/models/Order');
const app = require('../app');

describe('Order Service - Unit Tests (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Test POST /api/v1/orders
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/orders', () => {
    it('Tạo đơn thành công (201) và kiểm tra publish event RabbitMQ order.created đúng format', async () => {
      const orderPayload = {
        restaurantId: 'rest_123',
        customerId: 'cust_456',
        items: [{ name: 'Burger Bò', price: 50000, quantity: 2 }],
        totalPrice: 100000,
        paymentMethod: 'VNPAY'
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(orderPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');

      // Kiểm tra event RabbitMQ được bắn đúng exchange, routing key và payload
      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(publishEvent).toHaveBeenCalledWith(
        DEFAULT_EXCHANGE,
        'order.created',
        expect.objectContaining({
          orderId: '65f111222333444555666777',
          restaurantId: 'rest_123',
          customerId: 'cust_456',
          totalPrice: 100000,
          status: 'PENDING',
          paymentMethod: 'VNPAY'
        })
      );
    });

    it('Báo lỗi 400 khi giỏ hàng trống hoặc thiếu thông tin', async () => {
      const invalidPayload = {
        restaurantId: 'rest_123',
        customerId: 'cust_456',
        items: [] // Giỏ hàng rỗng
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(invalidPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/danh sách items/i);
      expect(publishEvent).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Test GET /api/v1/orders/:orderId
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/orders/:orderId', () => {
    it('Lấy thông tin đơn hàng hiện tại thành công (200)', async () => {
      Order.findById.mockResolvedValue({
        _id: '65f111222333444555666777',
        status: 'CONFIRMED',
        totalPrice: 100000,
        items: [{ name: 'Burger Bò', price: 50000, quantity: 2 }]
      });

      const res = await request(app).get('/api/v1/orders/65f111222333444555666777');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe('65f111222333444555666777');
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(Order.findById).toHaveBeenCalledWith('65f111222333444555666777');
    });
  });
});

