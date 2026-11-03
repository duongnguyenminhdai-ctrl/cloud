const app = require('./app');
const connectDB = require('./db');
const { connectRabbitMQ, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const { handlePaymentSuccess } = require('./src/workers/deliveryWorker');

const PORT = process.env.PORT || 3004;
const SERVICE_NAME = 'delivery-service';

// 1. Kết nối MongoDB Atlas (delivery_db)
connectDB();

// 2. Khởi tạo RabbitMQ và Worker tự động tạo đơn giao hàng
connectRabbitMQ().then(() => {
  console.log(`[${SERVICE_NAME}] 🛵 Worker đang lắng nghe sự kiện payment.success...`);

  /**
   * Worker: Lắng nghe payment.success -> Tạo bản ghi Delivery trạng thái 'FINDING_DRIVER'
   */
  consumeEvent(
    DEFAULT_EXCHANGE,
    'delivery_payment_success_queue',
    'payment.success',
    handlePaymentSuccess
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] ${SERVICE_NAME} đang chạy tại cổng ${PORT}`);
});
