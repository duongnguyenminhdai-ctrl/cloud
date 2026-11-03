const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// 1. Tạo link thanh toán VNPay Sandbox
router.post(
  ['/create-vnpay-url', '/payments/create-vnpay-url', '/api/payments/create-vnpay-url', '/api/v1/payments/create-vnpay-url'],
  paymentController.createVNPayPaymentUrl
);

// 2. Nhận kết quả điều hướng (Redirect Return URL) từ VNPay
router.get(
  ['/vnpay-return', '/payments/vnpay-return', '/api/payments/vnpay-return', '/api/v1/payments/vnpay-return'],
  paymentController.vnpayReturn
);

// 3. Tra cứu lịch sử thanh toán
router.get(['/', '/payments', '/api/payments', '/api/v1/payments'], paymentController.getAllPayments);

// 4. Tra cứu thanh toán theo orderId
router.get(
  ['/order/:orderId', '/payments/order/:orderId', '/api/payments/order/:orderId', '/api/v1/payments/order/:orderId'],
  paymentController.getPaymentByOrderId
);

module.exports = router;
