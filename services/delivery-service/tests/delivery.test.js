const request = require('supertest');

// 1. Mocking RabbitMQ và Model Delivery
jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

const mockDeliveryInstance = {
  _id: 'del_mock_123456789',
  orderId: 'order_test_999',
  driverName: null,
  status: 'FINDING_DRIVER',
  updatedAt: new Date('2026-11-04T00:00:00.000Z'),
  save: jest.fn().mockResolvedValue({
    _id: 'del_mock_123456789',
    orderId: 'order_test_999',
    driverName: null,
    status: 'FINDING_DRIVER',
    updatedAt: new Date('2026-11-04T00:00:00.000Z')
  })
};

jest.mock('../src/models/Delivery', () => {
  const MockDelivery = jest.fn().mockImplementation(() => mockDeliveryInstance);
  MockDelivery.findOne = jest.fn();
  MockDelivery.find = jest.fn();
  MockDelivery.findOneAndUpdate = jest.fn();
  return MockDelivery;
});

const { publishEvent, DEFAULT_EXCHANGE } = require('../src/rabbitmq');
const Delivery = require('../src/models/Delivery');
const { handlePaymentSuccess } = require('../src/workers/deliveryWorker');
const app = require('../app');

describe('Delivery Service - Unit Tests (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Test GET /api/v1/deliveries/order/:orderId
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/deliveries/order/:orderId', () => {
    it('Trả về thông tin tài xế và trạng thái giao hàng FINDING_DRIVER / DELIVERING (200)', async () => {
      Delivery.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          _id: 'del_mock_123456789',
          orderId: 'order_test_999',
          driverName: 'Nguyễn Văn Tài Xế',
          status: 'DELIVERING'
        })
      });

      const res = await request(app).get('/api/v1/deliveries/order/order_test_999');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe('order_test_999');
      expect(res.body.data.driverName).toBe('Nguyễn Văn Tài Xế');
      expect(res.body.data.status).toBe('DELIVERING');
      expect(Delivery.findOne).toHaveBeenCalledWith({ orderId: 'order_test_999' });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Test Giả lập nhận tin nhắn RabbitMQ payment.success
  // ---------------------------------------------------------------------------
  describe('Worker RabbitMQ payment.success', () => {
    it('Đảm bảo hàm tự động khởi tạo đơn giao hàng mới trong delivery_db được kích hoạt', async () => {
      const incomingMessage = {
        orderId: 'order_test_999',
        amount: 250000,
        status: 'SUCCESS'
      };

      const result = await handlePaymentSuccess(incomingMessage);

      // Kiểm tra việc tạo instance Delivery và gọi save()
      expect(Delivery).toHaveBeenCalled();
      expect(mockDeliveryInstance.save).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('FINDING_DRIVER');
      expect(result.orderId).toBe('order_test_999');

      // Kiểm tra event delivery.created được phát đi
      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(publishEvent).toHaveBeenCalledWith(
        DEFAULT_EXCHANGE,
        'delivery.created',
        expect.objectContaining({
          deliveryId: 'del_mock_123456789',
          orderId: 'order_test_999',
          status: 'FINDING_DRIVER'
        })
      );
    });
  });
});

