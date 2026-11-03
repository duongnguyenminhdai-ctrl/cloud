const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');

/**
 * Xử lý khi nhận được tin nhắn payment.success từ RabbitMQ
 */
async function handlePaymentSuccess(paymentData) {
  try {
    const orderId = paymentData.orderId;
    console.log(`[delivery-service] 🔔 Nhận sự kiện payment.success: Đơn [${orderId}] đã thanh toán thành công!`);
    console.log(`[delivery-service] 📦 Đang tự động khởi tạo đơn giao hàng (FINDING_DRIVER)...`);

    const delivery = new Delivery({
      orderId: orderId.toString(),
      driverName: null,
      status: 'FINDING_DRIVER',
      updatedAt: new Date()
    });

    const savedDelivery = await delivery.save();
    console.log(`[delivery-service] 💾 Đã lưu đơn ship vào delivery_db (ID: ${savedDelivery._id})`);

    // Bắn sự kiện delivery.created để các hệ thống realtime / socket.io bắt được
    await publishEvent(DEFAULT_EXCHANGE, 'delivery.created', {
      deliveryId: savedDelivery._id ? savedDelivery._id.toString() : `DEL-${Date.now()}`,
      orderId: savedDelivery.orderId,
      status: savedDelivery.status,
      updatedAt: savedDelivery.updatedAt
    });

    return savedDelivery;
  } catch (err) {
    console.error(`[delivery-service] ❌ Lỗi khởi tạo đơn giao hàng:`, err.message);
    throw err;
  }
}

module.exports = {
  handlePaymentSuccess
};

