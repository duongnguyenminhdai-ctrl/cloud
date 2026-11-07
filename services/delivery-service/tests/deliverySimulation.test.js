// Mock Models và RabbitMQ (biến mock bắt đầu bằng 'mock' để Jest hoisting cho phép)
const mockDeliveryInstance = {
  _id: 'del_sim_123',
  orderId: 'order_sim_888',
  driverName: null,
  driverInfo: null,
  status: 'FINDING_DRIVER',
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue({
    _id: 'del_sim_123',
    orderId: 'order_sim_888',
    status: 'FINDING_DRIVER',
    updatedAt: new Date()
  })
};

jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

jest.mock('../src/models/Delivery', () => {
  const MockDelivery = jest.fn().mockImplementation(() => ({
    _id: 'del_sim_123',
    orderId: 'order_sim_888',
    driverName: null,
    driverInfo: null,
    status: 'FINDING_DRIVER',
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue({
      _id: 'del_sim_123',
      orderId: 'order_sim_888',
      status: 'FINDING_DRIVER',
      updatedAt: new Date()
    })
  }));
  MockDelivery.findOne = jest.fn();
  MockDelivery.find = jest.fn();
  MockDelivery.findOneAndUpdate = jest.fn().mockResolvedValue({
    _id: 'del_sim_123',
    orderId: 'order_sim_888',
    status: 'FINDING_DRIVER'
  });
  return MockDelivery;
});

const { startDeliverySimulation, handleOrderPaid } = require('../src/workers/deliveryWorker');
const Delivery = require('../src/models/Delivery');
const { publishEvent, DEFAULT_EXCHANGE } = require('../src/rabbitmq');

describe('Delivery Worker Simulation - Full Lifecycle Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Thực hiện đúng 4 bước giả lập điều phối: FINDING_DRIVER -> DRIVER_ASSIGNED -> DELIVERING -> DELIVERED', async () => {
    const orderId = 'order_sim_888';

    // Bắt đầu simulation với độ trễ chuẩn: 3000ms, 7000ms, 10000ms
    const simPromise = startDeliverySimulation(orderId, {
      step2Delay: 3000,
      step3Delay: 7000,
      step4Delay: 10000
    });

    // Bước 1: 0s -> FINDING_DRIVER
    const res1 = await simPromise;
    expect(res1.status).toBe('FINDING_DRIVER');
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'delivery.created',
      expect.objectContaining({ orderId, status: 'FINDING_DRIVER' })
    );

    // Bước 2: Sau 3s -> DRIVER_ASSIGNED
    await jest.advanceTimersByTimeAsync(3000);

    expect(Delivery.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId },
      expect.objectContaining({
        status: 'DRIVER_ASSIGNED',
        driverName: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
        driverInfo: expect.objectContaining({
          name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
          vehicle: 'Honda Wave Alpha • 59-X1 888.88',
          phone: '0908 123 456'
        })
      })
    );
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'delivery.driver_assigned',
      expect.objectContaining({
        orderId,
        status: 'DRIVER_ASSIGNED',
        driverInfo: expect.objectContaining({ name: 'Trần Văn Vận Chuyển (Đối tác Cloud)' })
      })
    );

    // Bước 3: Sau 7s tiếp theo -> DELIVERING
    await jest.advanceTimersByTimeAsync(7000);

    expect(Delivery.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId },
      expect.objectContaining({ status: 'DELIVERING' })
    );
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'delivery.delivering',
      expect.objectContaining({ orderId, status: 'DELIVERING' })
    );

    // Bước 4: Sau 10s tiếp theo -> DELIVERED & phát order.completed
    await jest.advanceTimersByTimeAsync(10000);

    expect(Delivery.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId },
      expect.objectContaining({ status: 'DELIVERED' })
    );
    expect(publishEvent).toHaveBeenCalledWith(
      DEFAULT_EXCHANGE,
      'order.completed',
      expect.objectContaining({ orderId, status: 'DELIVERED' })
    );
  });

  it('handleOrderPaid kích hoạt startDeliverySimulation thành công', async () => {
    const event = { order_id: 'order_test_paid_123', paymentMethod: 'VNPAY' };
    const result = await handleOrderPaid(event);

    expect(result).toBeDefined();
    expect(result.status).toBe('FINDING_DRIVER');
  });
});
