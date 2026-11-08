const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');
const {
  acceptDeliveryJob,
  pickUpDeliveryJob,
  completeDeliveryJob,
  updateOrderDirectly,
  DEFAULT_SIMULATED_DRIVER
} = require('../services/deliveryStateMachine');

// Danh sách tài xế đối tác giả lập
const SIMULATED_DRIVERS = [
  DEFAULT_SIMULATED_DRIVER,
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
 * Giả lập quy trình điều phối và cập nhật trạng thái giao hàng (Delivery Worker Simulation)
 * Bước 1 (0s): FINDING_DRIVER ("Tìm tài xế")
 * Nếu ENABLE_DELIVERY_SIMULATION === 'true':
 *   Bước 2 (sau 3s): Gán tài xế DRIVER_ASSIGNED
 *   Bước 3 (sau 7s tiếp theo): DELIVERING ("Đang giao hàng")
 *   Bước 4 (sau 10s tiếp theo): COMPLETED ("Hoàn tất giao hàng") -> Bắn event delivery.completed & order.completed
 * Nếu ENABLE_DELIVERY_SIMULATION === 'false':
 *   Dừng lại ở FINDING_DRIVER, chờ tài xế gọi Driver REST APIs (accept -> pick-up -> complete)
 */
async function startDeliverySimulation(orderId, options = {}) {
  const cleanOrderId = (orderId || '').toString().trim();
  if (!cleanOrderId) return null;

  const step2Delay = options.step2Delay !== undefined ? options.step2Delay : 3000;  // Sau 3 giây
  const step3Delay = options.step3Delay !== undefined ? options.step3Delay : 7000;  // Sau 7 giây tiếp theo
  const step4Delay = options.step4Delay !== undefined ? options.step4Delay : 10000; // Sau 10 giây tiếp theo

  console.log(`[delivery-service] 🚀 Khởi tạo bản ghi giao hàng cho đơn [${cleanOrderId}]...`);

  // =========================================================================
  // BƯỚC 1: Nhận sự kiện (0s) -> FINDING_DRIVER ("Tìm tài xế")
  // =========================================================================
  const delivery = new Delivery({
    orderId: cleanOrderId,
    order_id: cleanOrderId,
    driverName: null,
    driverInfo: null,
    status: 'FINDING_DRIVER',
    pickup_address: options.pickup_address || {
      address: 'Cửa hàng đối tác FoodFast',
      lat: 10.7769,
      lng: 106.7009
    },
    dropoff_address: options.dropoff_address || {
      address: 'Địa chỉ nhận hàng',
      lat: 10.7769,
      lng: 106.7009
    },
    current_location: options.pickup_address || {
      lat: 10.7769,
      lng: 106.7009
    },
    updatedAt: new Date(),
    updated_at: new Date()
  });

  const savedDelivery = await delivery.save();
  await updateOrderDirectly(cleanOrderId, 'FINDING_DRIVER');

  try {
    await publishEvent(DEFAULT_EXCHANGE, 'delivery.created', {
      deliveryId: savedDelivery._id ? savedDelivery._id.toString() : `DEL-${Date.now()}`,
      orderId: cleanOrderId,
      status: 'FINDING_DRIVER',
      updatedAt: savedDelivery.updated_at || savedDelivery.updatedAt || new Date()
    });
  } catch (mqErr) {
    console.warn(`[delivery-service] ⚠️ Chưa thể phát delivery.created:`, mqErr.message);
  }

  console.log(`[delivery-service] 📦 [Bước 1 - 0s] Đơn [${cleanOrderId}] trạng thái: FINDING_DRIVER`);

  // Kiểm tra cờ cấu hình chuyển đổi chế độ Simulation Toggle
  const isSimulationEnabled =
    options.enableSimulation !== undefined
      ? options.enableSimulation
      : (process.env.ENABLE_DELIVERY_SIMULATION === undefined ||
         String(process.env.ENABLE_DELIVERY_SIMULATION).toLowerCase() === 'true');

  if (!isSimulationEnabled) {
    console.log(`[delivery-service] ⏸️ Chế độ mô phỏng TẮT (ENABLE_DELIVERY_SIMULATION=false). Đơn [${cleanOrderId}] dừng ở FINDING_DRIVER, chờ tài xế nhận cuốc qua Driver API.`);
    return savedDelivery;
  }

  // =========================================================================
  // BƯỚC 2: Gán tài xế giả lập (sau 3 giây) -> DRIVER_ASSIGNED
  // =========================================================================
  setTimeout(async () => {
    try {
      const selectedDriver = options.driver || SIMULATED_DRIVERS[0];
      console.log(`[delivery-service] 🛵 [Bước 2 - +3s] Gán tài xế [${selectedDriver.name}] cho đơn [${cleanOrderId}]`);

      await acceptDeliveryJob(cleanOrderId, selectedDriver);

      // =======================================================================
      // BƯỚC 3: Chuyển sang Đang giao hàng (sau 7 giây tiếp theo) -> DELIVERING
      // =======================================================================
      setTimeout(async () => {
        try {
          console.log(`[delivery-service] ⚡ [Bước 3 - +7s] Tài xế đang giao đơn [${cleanOrderId}]`);

          await pickUpDeliveryJob(cleanOrderId);

          // ===================================================================
          // BƯỚC 4: Hoàn tất giao hàng (sau 10 giây tiếp theo) -> COMPLETED / DELIVERED
          // ===================================================================
          setTimeout(async () => {
            try {
              console.log(`[delivery-service] 🎉 [Bước 4 - +10s] Đã hoàn tất giao hàng đơn [${cleanOrderId}]!`);

              const completeStatus = options.completeStatus || 'DELIVERED';
              await completeDeliveryJob(cleanOrderId, { status: completeStatus });

            } catch (err4) {
              console.error(`[delivery-service] ❌ Lỗi Bước 4 (COMPLETED):`, err4.message);
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
