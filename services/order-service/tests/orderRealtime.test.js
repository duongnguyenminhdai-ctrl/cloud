const request = require('supertest');
const EventEmitter = require('events');

jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

jest.mock('../src/models/Order');

const Order = require('../src/models/Order');
const { publishEvent } = require('../src/rabbitmq');
const app = require('../app');
const realtimeHub = require('../src/utils/realtimeHub');

describe('Order Service - Realtime SSE Stream & Event Emission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUT /api/v1/orders/:id/status - Phát SSE order.updated tới đúng khách hàng và chủ quán', async () => {
    const mockOrder = {
      _id: 'ord_rt_001',
      restaurantId: 'store_001',
      customerId: 'user_001',
      status: 'PENDING',
      driverNote: '',
      save: jest.fn().mockResolvedValue(true)
    };
    Order.findById.mockResolvedValue(mockOrder);

    const reqCust = new EventEmitter();
    const resCust = new EventEmitter();
    const custWrites = [];
    resCust.writeHead = jest.fn();
    resCust.flushHeaders = jest.fn();
    resCust.write = jest.fn((chunk) => custWrites.push(chunk));
    resCust.writableEnded = false;
    resCust.destroyed = false;

    const reqStore = new EventEmitter();
    const resStore = new EventEmitter();
    const storeWrites = [];
    resStore.writeHead = jest.fn();
    resStore.flushHeaders = jest.fn();
    resStore.write = jest.fn((chunk) => storeWrites.push(chunk));
    resStore.writableEnded = false;
    resStore.destroyed = false;

    const reqOther = new EventEmitter();
    const resOther = new EventEmitter();
    const otherWrites = [];
    resOther.writeHead = jest.fn();
    resOther.flushHeaders = jest.fn();
    resOther.write = jest.fn((chunk) => otherWrites.push(chunk));
    resOther.writableEnded = false;
    resOther.destroyed = false;

    realtimeHub.subscribe(reqCust, resCust, { customerId: 'user_001' });
    realtimeHub.subscribe(reqStore, resStore, { restaurantId: 'store_001' });
    realtimeHub.subscribe(reqOther, resOther, { customerId: 'user_999' });

    const res = await request(app)
      .put('/api/v1/orders/ord_rt_001/status')
      .send({ status: 'PREPARING' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockOrder.status).toBe('PREPARING');
    expect(publishEvent).toHaveBeenCalledWith(
      'food_order_topic',
      'order.status_updated',
      expect.objectContaining({ orderId: 'ord_rt_001', restaurantId: 'store_001', status: 'PREPARING' })
    );

    expect(custWrites.join('')).toContain('event: order.updated');
    expect(custWrites.join('')).toContain('PREPARING');
    expect(storeWrites.join('')).toContain('event: order.updated');
    expect(otherWrites.join('')).not.toContain('event: order.updated');

    reqCust.emit('close');
    reqStore.emit('close');
    reqOther.emit('close');
  });
});

