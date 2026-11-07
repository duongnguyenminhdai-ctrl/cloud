const app = require('./app');
const mongoose = require('mongoose');
const connectDB = require('./db');
const { connectRabbitMQ, publishEvent, consumeEvent, DEFAULT_EXCHANGE } = require('./src/rabbitmq');
const Payment = require('./src/models/Payment');

const PORT = process.env.PORT || 3003;
const SERVICE_NAME = 'payment-service';

// 1. Kết nối MongoDB Atlas (payment_db)
connectDB();

// 2. Khởi tạo RabbitMQ và Worker xử lý thanh toán tự động
connectRabbitMQ().then(() => {
  console.log(`[${SERVICE_NAME}] 🎧 Worker đang lắng nghe sự kiện order.created...`);

  /**
   * Worker: Lắng nghe order.created -> Xử lý theo phương thức thanh toán
   */
  consumeEvent(
    DEFAULT_EXCHANGE,
    'payment_order_created_queue',
    'order.created',
    async (orderData) => {
      try {
        const orderId = orderData.orderId || orderData._id;
        const amount = orderData.totalPrice || orderData.amount || 0;
        const method = orderData.paymentMethod || 'VNPAY';

        console.log(`[${SERVICE_NAME}] 💳 Nhận sự kiện order.created: Đơn [${orderId}] - Phương thức: ${method} - Số tiền: ${Number(amount).toLocaleString('vi-VN')} VNĐ`);

        // Nếu thanh toán qua VNPay, không auto-pay mà lưu trạng thái PENDING chờ khách thanh toán trên cổng VNPay
        if (method === 'VNPAY') {
          console.log(`[${SERVICE_NAME}] ⏳ Đơn [${orderId}] chọn thanh toán qua VNPay Sandbox. Chờ kết quả từ Return URL...`);
          if (mongoose.connection.readyState === 1) {
            await Payment.findOneAndUpdate(
              { orderId: orderId.toString() },
              {
                orderId: orderId.toString(),
                amount: Number(amount),
                paymentMethod: 'VNPAY',
                status: 'PENDING',
                transactionId: `VNP-${Date.now()}`
              },
              { upsert: true, new: true }
            );
          }
          return;
        }

        // Xử lý đơn hàng COD (Thanh toán khi nhận hàng)
        if (method === 'COD') {
          console.log(`[${SERVICE_NAME}] 💵 Đơn [${orderId}] chọn phương thức [COD]. Trạng thái thanh toán: COD_PENDING (Thanh toán khi nhận hàng)`);
          const codTransactionId = `COD-${Date.now()}`;
          if (mongoose.connection.readyState === 1) {
            await Payment.findOneAndUpdate(
              { orderId: orderId.toString() },
              {
                orderId: orderId.toString(),
                amount: Number(amount),
                paymentMethod: 'COD',
                status: 'COD_PENDING',
                transactionId: codTransactionId
              },
              { upsert: true, new: true }
            );
          }

          // Bắn sự kiện order.paid để kích hoạt điều phối tài xế giao hàng mà KHÔNG gắn mác đã thanh toán
          console.log(`[${SERVICE_NAME}] 📦 Đã phát sự kiện order.paid cho đơn COD [${orderId}]`);
          await publishEvent(DEFAULT_EXCHANGE, 'order.paid', {
            orderId: orderId.toString(),
            amount: Number(amount),
            paymentMethod: 'COD',
            status: 'COD_PENDING',
            isCod: true,
            createdAt: new Date().toISOString()
          });
          return;
        }

        // Tự động thanh toán MOCK cho các phương thức khác (MOCK,...)
        let savedPayment = null;
        const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        if (mongoose.connection.readyState === 1) {
          const payment = new Payment({
            orderId: orderId.toString(),
            amount: Number(amount),
            paymentMethod: method,
            status: 'SUCCESS',
            transactionId
          });
          savedPayment = await payment.save();
        } else {
          savedPayment = {
            _id: transactionId,
            orderId: orderId.toString(),
            amount: Number(amount),
            paymentMethod: method,
            status: 'SUCCESS',
            transactionId,
            createdAt: new Date()
          };
        }

        // Bắn sự kiện payment.success và order.paid lên RabbitMQ topic exchange
        const paymentSuccessPayload = {
          paymentId: savedPayment._id ? savedPayment._id.toString() : transactionId,
          orderId: savedPayment.orderId,
          amount: savedPayment.amount,
          paymentMethod: savedPayment.paymentMethod,
          status: 'SUCCESS',
          transactionId: savedPayment.transactionId,
          paidAt: new Date().toISOString()
        };

        console.log(`[${SERVICE_NAME}] 💰 Thanh toán THÀNH CÔNG cho đơn [${orderId}]! Đang phát event payment.success...`);
        await publishEvent(DEFAULT_EXCHANGE, 'payment.success', paymentSuccessPayload);
        await publishEvent(DEFAULT_EXCHANGE, 'order.paid', paymentSuccessPayload);
      } catch (err) {
        console.error(`[${SERVICE_NAME}] ❌ Lỗi khi xử lý thanh toán:`, err.message);
      }
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] ${SERVICE_NAME} đang chạy tại cổng ${PORT}`);
});
