const app = require('./app');
const connectDB = require('./db');
const { connectRabbitMQ, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const { handleOrderPaid, handlePaymentSuccess } = require('./src/workers/deliveryWorker');

const Delivery = require('./src/models/Delivery');

const PORT = process.env.PORT || 3004;
const SERVICE_NAME = 'delivery-service';

// 1. Kết nối MongoDB Atlas (delivery_db)
connectDB().then(async () => {
  try {
    const threshold = new Date(Date.now() - 45 * 1000);
    const res = await Delivery.updateMany(
      {
        status: { $in: ['FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'] },
        updatedAt: { $lt: threshold }
      },
      {
        $set: {
          status: 'DELIVERED',
          driverName: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
          updatedAt: new Date()
        }
      }
    );
    if (res.modifiedCount > 0) {
      console.log(`[delivery-service] 🧹 Khởi động: Đã đồng bộ ${res.modifiedCount} chuyến giao cũ sang DELIVERED`);
    }
  } catch (e) {
    console.warn('[delivery-service] Lỗi cleanup giao hàng cũ:', e.message);
  }
});

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
