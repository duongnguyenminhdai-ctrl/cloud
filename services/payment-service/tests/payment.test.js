const request = require('supertest');

// Mocking RabbitMQ, Payment Model và VNPay Service
jest.mock('../src/rabbitmq', () => ({
  publishEvent: jest.fn().mockResolvedValue(true),
  consumeEvent: jest.fn(),
  connectRabbitMQ: jest.fn().mockResolvedValue(true),
  DEFAULT_EXCHANGE: 'food_order_topic'
}));

jest.mock('../src/models/Payment', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({
    _id: 'pay_mock_123456',
    orderId: 'order_vnpay_123',
    amount: 150000,
    status: 'SUCCESS',
    paymentMethod: 'VNPAY',
    transactionId: 'VNP_TXN_99999'
  }),
  findOne: jest.fn(),
  find: jest.fn()
}));

jest.mock('../src/services/vnpayService', () => ({
  createVNPayUrl: jest.fn().mockReturnValue(
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=15000000&vnp_TxnRef=order_vnpay_123&vnp_SecureHash=mock_hash_512'
  ),
  verifyVNPayReturn: jest.fn()
}));

const { publishEvent, DEFAULT_EXCHANGE } = require('../src/rabbitmq');
const Payment = require('../src/models/Payment');
const { createVNPayUrl, verifyVNPayReturn } = require('../src/services/vnpayService');
const app = require('../app');

describe('Payment Service - Unit Tests (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Test POST /api/v1/payments/create-vnpay-url
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/payments/create-vnpay-url', () => {
    it('Sinh URL thanh toán VNPay hợp lệ (200)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-vnpay-url')
        .send({
          orderId: 'order_vnpay_123',
          amount: 150000,
          orderInfo: 'Thanh toan don hang'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.paymentUrl).toContain('sandbox.vnpayment.vn');
      expect(res.body.orderId).toBe('order_vnpay_123');
      expect(res.body.amount).toBe(150000);
      expect(createVNPayUrl).toHaveBeenCalled();
      expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: 'order_vnpay_123' },
        expect.objectContaining({
          status: 'PENDING',
          paymentMethod: 'VNPAY'
        }),
        expect.anything()
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Test GET /api/v1/payments/vnpay-return
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/payments/vnpay-return', () => {
    it('Xác thực chữ ký HMAC-SHA512 hợp lệ với mã 00 -> Cập nhật SUCCESS và bắn event payment.success vào RabbitMQ', async () => {
      verifyVNPayReturn.mockReturnValue({
        isValid: true,
        orderId: 'order_vnpay_123',
        amount: 150000,
        responseCode: '00',
        transactionNo: 'VNP_TXN_99999',
        rawParams: { vnp_ResponseCode: '00' }
      });

      const res = await request(app)
        .get('/api/v1/payments/vnpay-return')
        .query({
          vnp_Amount: '15000000',
          vnp_ResponseCode: '00',
          vnp_TxnRef: 'order_vnpay_123',
          vnp_SecureHash: 'valid_hmac_hash'
        });

      // Endpoint redirect 302 về trang frontend
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('/orders/order_vnpay_123?payment=success');

      // Kiểm tra Payment được cập nhật sang SUCCESS
      expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
        { orderId: 'order_vnpay_123' },
        expect.objectContaining({
          status: 'SUCCESS',
          paymentMethod: 'VNPAY',
          transactionId: 'VNP_TXN_99999'
        }),
        expect.anything()
      );

      // Kiểm tra event payment.success được bắn qua RabbitMQ
      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(publishEvent).toHaveBeenCalledWith(
        DEFAULT_EXCHANGE,
        'payment.success',
        expect.objectContaining({
          orderId: 'order_vnpay_123',
          status: 'SUCCESS',
          paymentMethod: 'VNPAY'
        })
      );
    });
  });
});

