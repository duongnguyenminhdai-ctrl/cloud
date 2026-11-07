const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');

// Danh sách tài xế đối tác giả lập
const SIMULATED_DRIVERS = [
  {
    name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
    vehicle: 'Honda Wave Alpha • 59-X1 888.88',
    phone: '0908 123 456'
  },
  {
    name: 'Nguyễn Thành Tốc Độ (Đối tác Cloud)',
    vehicle: 'Yamaha Sirius • 59-P2 678.90',
    phone: '0912 345 678'
  },
  {
    name: 'Lê Hoàng Giao Nhanh (Đối tác Cloud)',
    vehicle: 'Honda AirBlade • 59-K1 999.99',
    phone: '0987 654 321'
  }
];

/**
 * Cập nhật trạng thái đơn hàng trực tiếp vào order_db nếu cùng kết nối MongoDB
 */
async function updateOrderDirectly(orderId, status, driverInfo = null) {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const orderDb = mongoose.connection.useDb('order_db');
      const updateData = { status, updatedAt: new Date() };
      if (driverInfo) {
        updateData.driver_info = driverInfo;
      }
      const query = mongoose.isValidObjectId(orderId) ? { _id: orderId } : { orderId: orderId.toString() };
      await orderDb.collection('orders').updateOne(query, { $set: updateData });
      console.log(`[delivery-service] 🔄 [DB Sync] Đã đồng bộ Order [${orderId}] sang [${status}]`);
    }
  } catch (err) {
    console.warn(`[delivery-service] ⚠️ Không thể đồng bộ trực tiếp order_db:`, err.message);
  }
}

/**
 * Giả lập quy trình điều phối và cập nhật trạng thái giao hàng (Delivery Worker Simulation)
 * Bước 1 (0s): FINDING_DRIVER ("Tìm tài xế")
 * Bước 2 (sau 3s): Gán tài xế DRIVER_ASSIGNED, kèm driver_info
 * Bước 3 (sau 7s tiếp theo): DELIVERING ("Đang giao hàng")
 * Bước 4 (sau 10s tiếp theo): DELIVERED ("Hoàn tất giao hàng") -> Bắn event order.completed
 */
async function startDeliverySimulation(orderId, options = {}) {
  const cleanOrderId = (orderId || '').toString();
  if (!cleanOrderId) return null;

  const step2Delay = options.step2Delay !== undefined ? options.step2Delay : 3000;  // Sau 3 giây
  const step3Delay = options.step3Delay !== undefined ? options.step3Delay : 7000;  // Sau 7 giây tiếp theo
  const step4Delay = options.step4Delay !== undefined ? options.step4Delay : 10000; // Sau 10 giây tiếp theo

  console.log(`[delivery-service] 🚀 Bắt đầu kịch bản điều phối giao hàng cho đơn [${cleanOrderId}]...`);

  // =========================================================================
  // BƯỚC 1: Nhận sự kiện (0s) -> FINDING_DRIVER ("Tìm tài xế")
  // =========================================================================
  const delivery = new Delivery({
    orderId: cleanOrderId,
    driverName: null,
    driverInfo: null,
    status: 'FINDING_DRIVER',
    updatedAt: new Date()
  });

  const savedDelivery = await delivery.save();
  await updateOrderDirectly(cleanOrderId, 'FINDING_DRIVER');

  try {
    await publishEvent(DEFAULT_EXCHANGE, 'delivery.created', {
      deliveryId: savedDelivery._id ? savedDelivery._id.toString() : `DEL-${Date.now()}`,
      orderId: savedDelivery.orderId,
      status: savedDelivery.status,
      updatedAt: savedDelivery.updatedAt
    });
  } catch (mqErr) {
    console.warn(`[delivery-service] ⚠️ Chưa thể phát delivery.created:`, mqErr.message);
  }

  console.log(`[delivery-service] 📦 [Bước 1 - 0s] Đơn [${cleanOrderId}] trạng thái: FINDING_DRIVER`);

  // =========================================================================
  // BƯỚC 2: Gán tài xế giả lập (sau 3 giây) -> DRIVER_ASSIGNED
  // =========================================================================
  setTimeout(async () => {
    try {
      const selectedDriver = options.driver || SIMULATED_DRIVERS[0];
      console.log(`[delivery-service] 🛵 [Bước 2 - +3s] Gán tài xế [${selectedDriver.name}] cho đơn [${cleanOrderId}]`);

      await Delivery.findOneAndUpdate(
        { orderId: cleanOrderId },
        {
          status: 'DRIVER_ASSIGNED',
          driverName: selectedDriver.name,
          driverInfo: selectedDriver,
          updatedAt: new Date()
        }
      );

      await updateOrderDirectly(cleanOrderId, 'DRIVER_ASSIGNED', selectedDriver);

      try {
        await publishEvent(DEFAULT_EXCHANGE, 'delivery.driver_assigned', {
          orderId: cleanOrderId,
          status: 'DRIVER_ASSIGNED',
          driverInfo: selectedDriver
        });
      } catch {}

      // =======================================================================
      // BƯỚC 3: Chuyển sang Đang giao hàng (sau 7 giây tiếp theo) -> DELIVERING
      // =======================================================================
      setTimeout(async () => {
        try {
          console.log(`[delivery-service] ⚡ [Bước 3 - +7s] Tài xế đang giao đơn [${cleanOrderId}]`);

          await Delivery.findOneAndUpdate(
            { orderId: cleanOrderId },
            {
              status: 'DELIVERING',
              updatedAt: new Date()
            }
          );

          await updateOrderDirectly(cleanOrderId, 'DELIVERING');

          try {
            await publishEvent(DEFAULT_EXCHANGE, 'delivery.delivering', {
              orderId: cleanOrderId,
              status: 'DELIVERING'
            });
          } catch {}

          // ===================================================================
          // BƯỚC 4: Hoàn tất giao hàng (sau 10 giây tiếp theo) -> DELIVERED
          // ===================================================================
          setTimeout(async () => {
            try {
              console.log(`[delivery-service] 🎉 [Bước 4 - +10s] Đã hoàn tất giao hàng đơn [${cleanOrderId}]!`);

              await Delivery.findOneAndUpdate(
                { orderId: cleanOrderId },
                {
                  status: 'DELIVERED',
                  updatedAt: new Date()
                }
              );

              await updateOrderDirectly(cleanOrderId, 'DELIVERED');

              // Bắn sự kiện order.completed vào RabbitMQ
              try {
                await publishEvent(DEFAULT_EXCHANGE, 'order.completed', {
                  orderId: cleanOrderId,
                  status: 'DELIVERED',
                  completedAt: new Date().toISOString()
                });
                console.log(`[delivery-service] 📢 Đã phát sự kiện order.completed cho đơn [${cleanOrderId}]`);
              } catch (mqErr) {
                console.warn(`[delivery-service] ⚠️ Chưa thể phát order.completed:`, mqErr.message);
              }
            } catch (err4) {
              console.error(`[delivery-service] ❌ Lỗi Bước 4 (DELIVERED):`, err4.message);
            }
          }, step4Delay);

        } catch (err3) {
          console.error(`[delivery-service] ❌ Lỗi Bước 3 (DELIVERING):`, err3.message);
        }
      }, step3Delay);

    } catch (err2) {
      console.error(`[delivery-service] ❌ Lỗi Bước 2 (DRIVER_ASSIGNED):`, err2.message);
    }
  }, step2Delay);

  return savedDelivery;
}

/**
 * Handler khi nhận event order.paid hoặc payment.success từ RabbitMQ
 */
async function handleOrderPaid(eventData) {
  try {
    const orderId = eventData.orderId || eventData.order_id || eventData._id;
    console.log(`[delivery-service] 🔔 Nhận sự kiện order.paid: Đơn [${orderId}] kích hoạt quy trình giao hàng!`);
    return await startDeliverySimulation(orderId);
  } catch (err) {
    console.error(`[delivery-service] ❌ Lỗi xử lý order.paid:`, err.message);
    throw err;
  }
}

async function handlePaymentSuccess(paymentData) {
  return await handleOrderPaid(paymentData);
}

module.exports = {
  handleOrderPaid,
  handlePaymentSuccess,
  startDeliverySimulation,
  updateOrderDirectly,
  SIMULATED_DRIVERS
};
