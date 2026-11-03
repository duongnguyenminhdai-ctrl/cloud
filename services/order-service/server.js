const app = require('./app');
const mongoose = require('mongoose');
const connectDB = require('./db');
const { connectRabbitMQ, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const Order = require('./src/models/Order');

const PORT = process.env.PORT || 3002;
const SERVICE_NAME = 'order-service';

// 1. Kết nối MongoDB Atlas (order_db)
connectDB();

// 2. Kết nối RabbitMQ và khởi tạo consumer cập nhật trạng thái đơn hàng
connectRabbitMQ().then(() => {
  // Lắng nghe sự kiện payment.success từ payment-service
  consumeEvent(
    DEFAULT_EXCHANGE,
    'order_payment_success_queue',
    'payment.success',
    async (paymentData) => {
      try {
        const orderId = paymentData.orderId;
        console.log(`[${SERVICE_NAME}] 💰 Nhận event payment.success cho đơn: ${orderId}`);
        if (mongoose.isValidObjectId(orderId)) {
          const updated = await Order.findByIdAndUpdate(orderId, { status: 'CONFIRMED' }, { new: true });
          console.log(`[${SERVICE_NAME}] ✅ Đã cập nhật đơn hàng ${orderId} sang trạng thái CONFIRMED`);
        }
      } catch (err) {
        console.error(`[${SERVICE_NAME}] ❌ Lỗi cập nhật trạng thái đơn:`, err.message);
      }
    }
  );

  // Lắng nghe sự kiện payment.failed
  consumeEvent(
    DEFAULT_EXCHANGE,
    'order_payment_failed_queue',
    'payment.failed',
    async (failedData) => {
      try {
        const orderId = failedData.orderId;
        console.log(`[${SERVICE_NAME}] ❌ Nhận event payment.failed cho đơn: ${orderId}`);
        if (mongoose.isValidObjectId(orderId)) {
          await Order.findByIdAndUpdate(orderId, { status: 'CANCELLED' });
          console.log(`[${SERVICE_NAME}] ⚠️ Đã cập nhật đơn hàng ${orderId} sang trạng thái CANCELLED`);
        }
      } catch (err) {
        console.error(`[${SERVICE_NAME}] ❌ Lỗi cập nhật đơn CANCELLED:`, err.message);
      }
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] ${SERVICE_NAME} đang chạy tại cổng ${PORT}`);
});
