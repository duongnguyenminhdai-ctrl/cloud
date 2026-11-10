const app = require('./app');
const connectDB = require('./db');
const { connectRabbitMQ } = require('./src/rabbitmq');
const { startVoucherIncentiveWorker, startRealtimeOrderRelayWorker } = require('./src/workers/voucherIncentiveWorker');

const PORT = process.env.PORT || 3001;
const SERVICE_NAME = 'restaurant-service';

// 1. Kết nối cơ sở dữ liệu MongoDB Atlas (restaurant_db) & Redis Cache
connectDB();

// 2. Kết nối RabbitMQ Event Broker & Khởi động Voucher + Realtime Workers
connectRabbitMQ().then(() => {
  startVoucherIncentiveWorker().catch(() => {});
  startRealtimeOrderRelayWorker().catch(() => {});
}).catch(() => {});

// 3. Lắng nghe cổng
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] ${SERVICE_NAME} đang chạy tại cổng ${PORT}`);
});
