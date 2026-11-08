const request = require('supertest');

// Mock Models và RabbitMQ
jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

const mockDeliveryDoc = {
  _id: '65f1234567890abcdef12345',
  order_id: 'order_test_driver_777',
  orderId: 'order_test_driver_777',
  status: 'FINDING_DRIVER',
  driver_name: null,
  driver_phone: null,
  driver_vehicle: null,
  current_location: { lat: 10.7769, lng: 106.7009 },
  created_at: new Date(),
  updated_at: new Date(),
  save: jest.fn().mockResolvedValue(this)
};

jest.mock('../src/models/Delivery', () => {
  const MockDelivery = jest.fn().mockImplementation(() => ({
    _id: '65f1234567890abcdef12345',
    order_id: 'order_test_driver_777',
    orderId: 'order_test_driver_777',
    status: 'FINDING_DRIVER',
    save: jest.fn().mockResolvedValue({
      _id: '65f1234567890abcdef12345',
      order_id: 'order_test_driver_777',
      orderId: 'order_test_driver_777',
      status: 'FINDING_DRIVER'
    })
  }));
  MockDelivery.findOne = jest.fn();
  MockDelivery.findById = jest.fn();
  MockDelivery.find = jest.fn();
  MockDelivery.findOneAndUpdate = jest.fn();
  return MockDelivery;
});

const app = require('../app');
const Delivery = require('../src/models/Delivery');
const { publishEvent, DEFAULT_EXCHANGE } = require('../src/rabbitmq');
const { startDeliverySimulation } = require('../src/workers/deliveryWorker');

describe('Driver API Endpoints & Evolutionary Architecture Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. GET /api/v1/deliveries/track/:order_id
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/deliveries/track/:order_id', () => {
    it('Khách hàng theo dõi realtime tiến trình giao hàng thành công (200)', async () => {
      Delivery.findOne.mockResolvedValue({
        _id: '65f1234567890abcdef12345',
        order_id: 'order_test_driver_777',
        orderId: 'order_test_driver_777',
        status: 'DRIVER_ASSIGNED',
        driver_name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
        current_location: { lat: 10.7769, lng: 106.7009 }
      });

      const res = await request(app).get('/api/v1/deliveries/track/order_test_driver_777');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe('order_test_driver_777');
      expect(res.body.data.status).toBe('DRIVER_ASSIGNED');
    });

    it('Báo lỗi 404 nếu không tìm thấy thông tin chuyến giao', async () => {
      Delivery.findOne.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/deliveries/track/order_not_found');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. PATCH /api/v1/deliveries/:id/accept (Tài xế nhận cuốc)
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/deliveries/:id/accept', () => {
    it('Tài xế nhận cuốc: chuyển FINDING_DRIVER sang DRIVER_ASSIGNED và phát event RabbitMQ (200)', async () => {
      Delivery.findOneAndUpdate.mockResolvedValue({
        _id: '65f1234567890abcdef12345',
        order_id: 'order_test_driver_777',
        orderId: 'order_test_driver_777',
        status: 'DRIVER_ASSIGNED',
        driver_name: 'Nguyễn Văn Tài Xế Thực',
        driver_phone: '0933 888 999',
        driver_vehicle: 'Exciter • 59-X1 999.99'
      });

      const res = await request(app)
        .patch('/api/v1/deliveries/order_test_driver_777/accept')
        .send({
          driver_name: 'Nguyễn Văn Tài Xế Thực',
          driver_phone: '0933 888 999',
          driver_vehicle: 'Exciter • 59-X1 999.99'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRIVER_ASSIGNED');
      expect(Delivery.findOneAndUpdate).toHaveBeenCalled();
      expect(publishEvent).toHaveBeenCalledWith(
        DEFAULT_EXCHANGE,
        'delivery.driver_assigned',
        expect.objectContaining({
          orderId: 'order_test_driver_777',
          status: 'DRIVER_ASSIGNED'
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. PATCH /api/v1/deliveries/:id/pick-up (Tài xế lấy món)
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/deliveries/:id/pick-up', () => {
    it('Xác nhận đã lấy món: chuyển trạng thái sang DELIVERING (200)', async () => {
      Delivery.findOneAndUpdate.mockResolvedValue({
        _id: '65f1234567890abcdef12345',
        order_id: 'order_test_driver_777',
        orderId: 'order_test_driver_777',
        status: 'DELIVERING'
      });

      const res = await request(app).patch('/api/v1/deliveries/order_test_driver_777/pick-up');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DELIVERING');
      expect(publishEvent).toHaveBeenCalledWith(
        DEFAULT_EXCHANGE,
        'delivery.delivering',
        expect.objectContaining({
          orderId: 'order_test_driver_777',
          status: 'DELIVERING'
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. PATCH /api/v1/deliveries/:id/complete (Tài xế hoàn tất đơn hàng)
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/deliveries/:id/complete', () => {
    it('Xác nhận giao thành công: chuyển sang COMPLETED và bắn sự kiện delivery.completed (200)', async () => {
      Delivery.findOneAndUpdate.mockResolvedValue({
        _id: '65f1234567890abcdef12345',
        order_id: 'order_test_driver_777',
        orderId: 'order_test_driver_777',
        status: 'COMPLETED'
      });

      const res = await request(app).patch('/api/v1/deliveries/order_test_driver_777/complete');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(publishEvent).toHaveBeenCalledWith(
        DEFAULT_EXCHANGE,
        'delivery.completed',
        expect.objectContaining({
          orderId: 'order_test_driver_777',
          status: 'COMPLETED'
        })
      );
      expect(publishEvent).toHaveBeenCalledWith(
        DEFAULT_EXCHANGE,
        'order.completed',
        expect.objectContaining({
          orderId: 'order_test_driver_777',
          status: 'DELIVERED'
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 5. PATCH /api/v1/deliveries/:id/location (Cập nhật tọa độ GPS)
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/deliveries/:id/location', () => {
    it('Cập nhật tọa độ GPS thời gian thực (lat, lng) thành công (200)', async () => {
      Delivery.findOneAndUpdate.mockResolvedValue({
        _id: '65f1234567890abcdef12345',
        order_id: 'order_test_driver_777',
        current_location: { lat: 10.7788, lng: 106.7022 }
      });

      const res = await request(app)
        .patch('/api/v1/deliveries/order_test_driver_777/location')
        .send({ lat: 10.7788, lng: 106.7022 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.current_location).toEqual({ lat: 10.7788, lng: 106.7022 });
    });

    it('Báo lỗi 400 nếu truyền tọa độ không hợp lệ', async () => {
      const res = await request(app)
        .patch('/api/v1/deliveries/order_test_driver_777/location')
        .send({ lat: 'khong_phai_so', lng: 106.7022 });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Simulation Toggle: ENABLE_DELIVERY_SIMULATION=false
  // ---------------------------------------------------------------------------
  describe('Simulation Toggle: ENABLE_DELIVERY_SIMULATION=false', () => {
    it('Đơn hàng dừng lại ở FINDING_DRIVER và không chạy timer khi simulation bị tắt', async () => {
      jest.useFakeTimers();

      const savedDoc = await startDeliverySimulation('order_manual_driver_999', {
        enableSimulation: false
      });

      expect(savedDoc.status).toBe('FINDING_DRIVER');

      // Chạy qua 30 giây thời gian giả lập
      await jest.advanceTimersByTimeAsync(30000);

      // Vì simulation bị tắt, findOneAndUpdate không được gọi cho bước gán tài xế tự động
      expect(Delivery.findOneAndUpdate).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});

