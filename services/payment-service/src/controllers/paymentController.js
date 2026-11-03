const Payment = require('../models/Payment');
const { createVNPayUrl, verifyVNPayReturn } = require('../services/vnpayService');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');

// 1. Lấy danh sách lịch sử thanh toán (GET /payments)
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('[paymentController] ❌ Lỗi lấy danh sách thanh toán:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch sử thanh toán: ' + error.message
    });
  }
};

// 2. Lấy thông tin thanh toán theo orderId (GET /payments/order/:orderId)
exports.getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = await Payment.findOne({ orderId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: `Chưa có giao dịch thanh toán cho đơn hàng: ${orderId}`
      });
    }

    return res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('[paymentController] ❌ Lỗi lấy giao dịch:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy giao dịch thanh toán: ' + error.message
    });
  }
};

// 3. Tạo URL thanh toán VNPay Sandbox (POST /payments/create-vnpay-url)
exports.createVNPayPaymentUrl = async (req, res) => {
  try {
    const { orderId, amount, orderInfo, bankCode } = req.body;

    if (!orderId || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp orderId và số tiền amount hợp lệ'
      });
    }

    // Tạo VNPay payment URL
    const paymentUrl = createVNPayUrl(req, {
      orderId,
      amount,
      orderInfo: orderInfo || `Thanh toan don hang ${orderId}`,
      bankCode
    });

    // Tạo hoặc cập nhật bản ghi Payment trạng thái PENDING
    await Payment.findOneAndUpdate(
      { orderId: orderId.toString() },
      {
        orderId: orderId.toString(),
        amount: Number(amount),
        status: 'PENDING',
        paymentMethod: 'VNPAY',
        transactionId: `VNP-${Date.now()}`
      },
      { upsert: true, new: true }
    );

    console.log(`[paymentController] 🔗 Đã tạo VNPay URL cho đơn hàng [${orderId}]: ${paymentUrl}`);

    return res.status(200).json({
      success: true,
      message: 'Tạo URL thanh toán VNPay thành công',
      paymentUrl,
      orderId,
      amount
    });
  } catch (error) {
    console.error('[paymentController] ❌ Lỗi tạo link thanh toán VNPay:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo link thanh toán VNPay: ' + error.message
    });
  }
};

// 4. Hứng kết quả redirect từ VNPay (GET /payments/vnpay-return)
exports.vnpayReturn = async (req, res) => {
  try {
    console.log('[paymentController] 🔄 Nhận redirect từ VNPay Return URL:', req.query);

    const {
      isValid,
      orderId,
      amount,
      responseCode,
      transactionNo,
      rawParams
    } = verifyVNPayReturn(req.query);

    // Xác định frontend URL để redirect
    let frontendUrl = 'http://localhost:8080';
    if (req.headers.host && req.headers.host.includes(':3000')) {
      frontendUrl = 'http://localhost:3000';
    }

    if (!isValid) {
      console.error('[paymentController] ❌ Sai chữ ký bảo mật (Checksum Failed)!');
      return res.redirect(`${frontendUrl}/orders/${orderId || 'unknown'}?payment=failed&reason=checksum_failed`);
    }

    // vnp_ResponseCode === '00' là Thành công
    if (responseCode === '00') {
      console.log(`[paymentController] ✅ VNPay thanh toán THÀNH CÔNG cho đơn [${orderId}]! Mã GD VNPay: ${transactionNo}`);

      // Cập nhật bản ghi Payment sang SUCCESS
      const updatedPayment = await Payment.findOneAndUpdate(
        { orderId: orderId.toString() },
        {
          orderId: orderId.toString(),
          amount: Number(amount),
          status: 'SUCCESS',
          paymentMethod: 'VNPAY',
          transactionId: transactionNo || `VNP-${Date.now()}`,
          vnpayData: rawParams
        },
        { upsert: true, new: true }
      );

      // Bắn event payment.success vào RabbitMQ
      try {
        await publishEvent(DEFAULT_EXCHANGE, 'payment.success', {
          paymentId: updatedPayment._id ? updatedPayment._id.toString() : (transactionNo || updatedPayment.transactionId),
          orderId: updatedPayment.orderId,
          amount: updatedPayment.amount,
          paymentMethod: 'VNPAY',
          status: 'SUCCESS',
          transactionId: updatedPayment.transactionId,
          paidAt: new Date().toISOString()
        });
        console.log(`[paymentController] 📢 Đã phát sự kiện payment.success cho đơn [${orderId}]`);
      } catch (mqErr) {
        console.warn(`[paymentController] ⚠️ Chưa thể phát sự kiện payment.success:`, mqErr.message);
      }

      // Chuyển hướng trình duyệt về màn hình theo dõi đơn hàng
      return res.redirect(`${frontendUrl}/orders/${orderId}?payment=success&txnRef=${transactionNo}`);
    } else {
      console.warn(`[paymentController] ⚠️ VNPay thanh toán THẤT BẠI cho đơn [${orderId}]! Mã lỗi: ${responseCode}`);

      // Cập nhật bản ghi Payment sang FAILED
      await Payment.findOneAndUpdate(
        { orderId: orderId.toString() },
        {
          orderId: orderId.toString(),
          amount: Number(amount),
          status: 'FAILED',
          paymentMethod: 'VNPAY',
          transactionId: transactionNo || `VNP-${Date.now()}`,
          vnpayData: rawParams
        },
        { upsert: true, new: true }
      );

      // Bắn event payment.failed vào RabbitMQ
      try {
        await publishEvent(DEFAULT_EXCHANGE, 'payment.failed', {
          orderId: orderId.toString(),
          status: 'FAILED',
          reason: `VNPay response code: ${responseCode}`
        });
      } catch (mqErr) {
        console.warn(`[paymentController] ⚠️ Chưa thể phát sự kiện payment.failed:`, mqErr.message);
      }

      return res.redirect(`${frontendUrl}/orders/${orderId}?payment=failed&code=${responseCode}`);
    }
  } catch (error) {
    console.error('[paymentController] ❌ Lỗi xử lý VNPay return:', error.message);
    return res.status(500).send('Lỗi máy chủ khi xử lý phản hồi từ VNPay: ' + error.message);
  }
};
