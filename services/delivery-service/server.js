const app = require('./app');
const connectDB = require('./db');
const { connectRabbitMQ, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const { handleOrderPaid, handlePaymentSuccess } = require('./src/workers/deliveryWorker');

const PORT = process.env.PORT || 3004;
const SERVICE_NAME = 'delivery-service';

// 1. Kết nối MongoDB Atlas (delivery_db)
connectDB();

// 2. Khởi tạo RabbitMQ và Worker tự động điều phối giao hàng
connectRabbitMQ().then(() => {
  console.log(`[${SERVICE_NAME}] 🛵 Worker đang lắng nghe các sự kiện điều phối giao hàng...`);

  // Lắng nghe sự kiện order.paid từ RabbitMQ
  consumeEvent(
    DEFAULT_EXCHANGE,
    'delivery_order_paid_queue',
    'order.paid',
    handleOrderPaid
  );

  // Lắng nghe sự kiện payment.success từ payment-service (tương đương order.paid)
  consumeEvent(
    DEFAULT_EXCHANGE,
    'delivery_payment_success_queue',
    'payment.success',
    handlePaymentSuccess
  );

  // Lắng nghe sự kiện order.created cho đơn thanh toán khi nhận hàng (COD)
  consumeEvent(
    DEFAULT_EXCHANGE,
    'delivery_order_cod_queue',
    'order.created',
    async (orderData) => {
      if (orderData.paymentMethod === 'COD') {
        console.log(`[${SERVICE_NAME}] 💵 Nhận đơn COD [${orderData.orderId}] -> Tự động kích hoạt điều phối giao hàng!`);
        await handleOrderPaid(orderData);
      }
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] ${SERVICE_NAME} đang chạy tại cổng ${PORT}`);
});
