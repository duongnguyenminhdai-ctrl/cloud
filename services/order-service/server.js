const app = require('./app');
const mongoose = require('mongoose');
const connectDB = require('./db');
const { connectRabbitMQ, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const Order = require('./src/models/Order');

const PORT = process.env.PORT || 3002;
const SERVICE_NAME = 'order-service';

// 1. Kết nối MongoDB Atlas (order_db)
connectDB().then(async () => {
  try {
    const threshold = new Date(Date.now() - 45 * 1000);
    const result = await Order.updateMany(
      {
        status: { $in: ['PENDING', 'CONFIRMED', 'FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'] },
        createdAt: { $lt: threshold }
      },
      {
        $set: {
          status: 'DELIVERED',
          driver_info: {
            name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
            vehicle: 'Honda Wave Alpha • 59-X1 888.88',
            phone: '0908 123 456'
          }
        }
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[order-service] 🧹 Khởi động: Đã tự động cập nhật ${result.modifiedCount} đơn hàng cũ sang DELIVERED`);
    }
  } catch (err) {
    console.warn('[order-service] Lỗi khởi động dọn đơn cũ:', err.message);
  }
});

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

  // Lắng nghe sự kiện order.paid từ payment-service / COD
  consumeEvent(
    DEFAULT_EXCHANGE,
    'order_paid_queue',
    'order.paid',
    async (orderData) => {
      try {
        const orderId = orderData.orderId;
        console.log(`[${SERVICE_NAME}] 💰 Nhận event order.paid cho đơn: ${orderId}`);
        if (mongoose.isValidObjectId(orderId)) {
          const updated = await Order.findByIdAndUpdate(orderId, { status: 'FINDING_DRIVER' }, { new: true });
          console.log(`[${SERVICE_NAME}] ✅ Đã cập nhật đơn hàng ${orderId} sang trạng thái FINDING_DRIVER`);
        }
      } catch (err) {
        console.error(`[${SERVICE_NAME}] ❌ Lỗi cập nhật trạng thái đơn (order.paid):`, err.message);
      }
    }
  );

  // Lắng nghe sự kiện delivery.driver_assigned từ delivery-service
  consumeEvent(
    DEFAULT_EXCHANGE,
    'order_driver_assigned_queue',
    'delivery.driver_assigned',
    async (deliveryData) => {
      try {
        const orderId = deliveryData.orderId;
        console.log(`[${SERVICE_NAME}] 🛵 Nhận event delivery.driver_assigned cho đơn: ${orderId}`);
        if (mongoose.isValidObjectId(orderId)) {
          await Order.findByIdAndUpdate(
            orderId,
            {
              status: 'DRIVER_ASSIGNED',
              driver_info: deliveryData.driverInfo
            },
            { new: true }
          );
          console.log(`[${SERVICE_NAME}] ✅ Đã cập nhật đơn hàng ${orderId} sang trạng thái DRIVER_ASSIGNED`);
        }
      } catch (err) {
        console.error(`[${SERVICE_NAME}] ❌ Lỗi cập nhật driver_assigned:`, err.message);
      }
    }
  );

  // Lắng nghe sự kiện delivery.delivering từ delivery-service
  consumeEvent(
    DEFAULT_EXCHANGE,
    'order_delivering_queue',
    'delivery.delivering',
    async (deliveryData) => {
      try {
        const orderId = deliveryData.orderId;
        console.log(`[${SERVICE_NAME}] ⚡ Nhận event delivery.delivering cho đơn: ${orderId}`);
        if (mongoose.isValidObjectId(orderId)) {
          await Order.findByIdAndUpdate(orderId, { status: 'DELIVERING' }, { new: true });
          console.log(`[${SERVICE_NAME}] ✅ Đã cập nhật đơn hàng ${orderId} sang trạng thái DELIVERING`);
        }
      } catch (err) {
        console.error(`[${SERVICE_NAME}] ❌ Lỗi cập nhật delivering:`, err.message);
      }
    }
  );

  // Lắng nghe sự kiện order.completed từ delivery-service
  consumeEvent(
    DEFAULT_EXCHANGE,
    'order_completed_queue',
    'order.completed',
    async (completedData) => {
      try {
        const orderId = completedData.orderId;
        console.log(`[${SERVICE_NAME}] 🎉 Nhận event order.completed cho đơn: ${orderId}`);
        if (mongoose.isValidObjectId(orderId)) {
          await Order.findByIdAndUpdate(orderId, { status: 'DELIVERED' }, { new: true });
          console.log(`[${SERVICE_NAME}] ✅ Đã cập nhật đơn hàng ${orderId} sang trạng thái DELIVERED`);
        }
      } catch (err) {
        console.error(`[${SERVICE_NAME}] ❌ Lỗi cập nhật completed:`, err.message);
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
