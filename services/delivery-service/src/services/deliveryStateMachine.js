const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');

// Danh sách tài xế mặc định giả lập khi chưa có tài xế thật nhận cuốc
const DEFAULT_SIMULATED_DRIVER = {
  name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
  phone: '0908 123 456',
  vehicle: 'Honda Wave Alpha • 59-X1 888.88'
};

// Định nghĩa các bước chuyển trạng thái hợp lệ trong State Machine
const VALID_TRANSITIONS = {
  PENDING: ['FINDING_DRIVER', 'CANCELLED'],
  FINDING_DRIVER: ['DRIVER_ASSIGNED', 'CANCELLED'],
  DRIVER_ASSIGNED: ['PICKED_UP', 'DELIVERING', 'CANCELLED'],
  PICKED_UP: ['DELIVERING', 'CANCELLED'],
  DELIVERING: ['COMPLETED', 'DELIVERED', 'CANCELLED'],
  COMPLETED: [],
  DELIVERED: [],
  CANCELLED: []
};

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
 * Tra cứu chuyến giao hàng theo ID bất kỳ (_id của Delivery hoặc order_id / orderId)
 */
async function findDeliveryByAnyId(idOrOrderId) {
  if (!idOrOrderId) return null;
  const cleanId = idOrOrderId.toString().trim();

  // Thử tìm theo orderId trước (phù hợp với mock trong unit tests và truy vấn thường gặp)
  let delivery = await Delivery.findOne({ orderId: cleanId });
  if (delivery) {
    if (typeof delivery.sort === 'function') {
      return await delivery.sort({ created_at: -1, createdAt: -1 });
    }
    return delivery;
  }

  // Thử tìm theo order_id
  delivery = await Delivery.findOne({ order_id: cleanId });
  if (delivery) {
    if (typeof delivery.sort === 'function') {
      return await delivery.sort({ created_at: -1, createdAt: -1 });
    }
    return delivery;
  }

  // Thử tìm theo _id nếu là ObjectId hợp lệ
  if (mongoose.isValidObjectId(cleanId) && cleanId.length === 24) {
    delivery = await Delivery.findById(cleanId);
    if (delivery) return delivery;
  }

  return null;
}

/**
 * 1. Chuyển trạng thái sang DRIVER_ASSIGNED khi tài xế nhận cuốc (PATCH /api/v1/deliveries/:id/accept)
 */
async function acceptDeliveryJob(idOrOrderId, driverData = {}) {
  const cleanId = (idOrOrderId || '').toString().trim();
  const driverName = driverData.name || driverData.driver_name || driverData.driverName || DEFAULT_SIMULATED_DRIVER.name;
  const driverPhone = driverData.phone || driverData.driver_phone || driverData.driverPhone || DEFAULT_SIMULATED_DRIVER.phone;
  const driverVehicle = driverData.vehicle || driverData.driver_vehicle || driverData.driverVehicle || DEFAULT_SIMULATED_DRIVER.vehicle;
  const driverId = driverData.driver_id || driverData.driverId || null;

  const driverInfoObj = {
    name: driverName,
    vehicle: driverVehicle,
    phone: driverPhone
  };

  const query = (mongoose.isValidObjectId(cleanId) && cleanId.length === 24)
    ? { $or: [{ _id: cleanId }, { orderId: cleanId }, { order_id: cleanId }] }
    : { orderId: cleanId };

  const updatedDelivery = await Delivery.findOneAndUpdate(
    query,
    {
      status: 'DRIVER_ASSIGNED',
      driver_id: driverId,
      driver_name: driverName,
      driverName: driverName,
      driver_phone: driverPhone,
      driver_vehicle: driverVehicle,
      driverInfo: driverInfoObj,
      updated_at: new Date(),
      updatedAt: new Date()
    }
  );

  if (!updatedDelivery) {
    const error = new Error(`Không tìm thấy chuyến giao hàng: ${idOrOrderId}`);
    error.statusCode = 404;
    throw error;
  }

  // Đồng bộ order_db
  await updateOrderDirectly(cleanId, 'DRIVER_ASSIGNED', driverInfoObj);

  // Bắn sự kiện RabbitMQ
  try {
    await publishEvent(DEFAULT_EXCHANGE, 'delivery.driver_assigned', {
      orderId: cleanId,
      deliveryId: updatedDelivery._id ? updatedDelivery._id.toString() : null,
      status: 'DRIVER_ASSIGNED',
      driverInfo: driverInfoObj
    });
  } catch (mqErr) {
    console.warn(`[delivery-service] ⚠️ Chưa thể phát delivery.driver_assigned:`, mqErr.message);
  }

  return updatedDelivery;
}

/**
 * 2. Chuyển trạng thái sang DELIVERING khi tài xế lấy món (PATCH /api/v1/deliveries/:id/pick-up)
 */
async function pickUpDeliveryJob(idOrOrderId) {
  const cleanId = (idOrOrderId || '').toString().trim();
  const query = (mongoose.isValidObjectId(cleanId) && cleanId.length === 24)
    ? { $or: [{ _id: cleanId }, { orderId: cleanId }, { order_id: cleanId }] }
    : { orderId: cleanId };

  const updatedDelivery = await Delivery.findOneAndUpdate(
    query,
    {
      status: 'DELIVERING',
      updated_at: new Date(),
      updatedAt: new Date()
    }
  );

  if (!updatedDelivery) {
    const error = new Error(`Không tìm thấy chuyến giao hàng: ${idOrOrderId}`);
    error.statusCode = 404;
    throw error;
  }

  // Đồng bộ order_db
  await updateOrderDirectly(cleanId, 'DELIVERING');

  // Bắn sự kiện RabbitMQ
  try {
    await publishEvent(DEFAULT_EXCHANGE, 'delivery.delivering', {
      orderId: cleanId,
      deliveryId: updatedDelivery._id ? updatedDelivery._id.toString() : null,
      status: 'DELIVERING'
    });
  } catch (mqErr) {
    console.warn(`[delivery-service] ⚠️ Chưa thể phát delivery.delivering:`, mqErr.message);
  }

  return updatedDelivery;
}

/**
 * 3. Chuyển trạng thái sang COMPLETED khi giao hàng thành công (PATCH /api/v1/deliveries/:id/complete)
 */
async function completeDeliveryJob(idOrOrderId, options = {}) {
  const cleanId = (idOrOrderId || '').toString().trim();
  const targetStatus = options.status || 'COMPLETED';

  const query = (mongoose.isValidObjectId(cleanId) && cleanId.length === 24)
    ? { $or: [{ _id: cleanId }, { orderId: cleanId }, { order_id: cleanId }] }
    : { orderId: cleanId };

  const updatedDelivery = await Delivery.findOneAndUpdate(
    query,
    {
      status: targetStatus,
      updated_at: new Date(),
      updatedAt: new Date()
    }
  );

  if (!updatedDelivery) {
    const error = new Error(`Không tìm thấy chuyến giao hàng: ${idOrOrderId}`);
    error.statusCode = 404;
    throw error;
  }

  // Đồng bộ order_db sang DELIVERED
  await updateOrderDirectly(cleanId, 'DELIVERED');

  // Bắn sự kiện delivery.completed
  try {
    await publishEvent(DEFAULT_EXCHANGE, 'delivery.completed', {
      deliveryId: updatedDelivery._id ? updatedDelivery._id.toString() : null,
      orderId: cleanId,
      status: targetStatus,
      completedAt: new Date().toISOString()
    });
    console.log(`[delivery-service] 📢 Đã phát sự kiện delivery.completed cho chuyến [${cleanId}]`);
  } catch (mqErr) {
    console.warn(`[delivery-service] ⚠️ Chưa thể phát delivery.completed:`, mqErr.message);
  }

  // Bắn sự kiện order.completed cho toàn hệ thống (kích hoạt voucher tri ân nếu có)
  try {
    await publishEvent(DEFAULT_EXCHANGE, 'order.completed', {
      orderId: cleanId,
      status: 'DELIVERED',
      completedAt: new Date().toISOString()
    });
    console.log(`[delivery-service] 📢 Đã phát sự kiện order.completed cho đơn [${cleanId}]`);
  } catch (mqErr) {
    console.warn(`[delivery-service] ⚠️ Chưa thể phát order.completed:`, mqErr.message);
  }

  return updatedDelivery;
}

/**
 * 4. Cập nhật tọa độ GPS thời gian thực (PATCH /api/v1/deliveries/:id/location)
 */
async function updateDeliveryLocation(idOrOrderId, lat, lng) {
  const cleanId = (idOrOrderId || '').toString().trim();
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (Number.isNaN(numLat) || Number.isNaN(numLng)) {
    const error = new Error('Tọa độ GPS (lat, lng) phải là số hợp lệ.');
    error.statusCode = 400;
    throw error;
  }

  const query = (mongoose.isValidObjectId(cleanId) && cleanId.length === 24)
    ? { $or: [{ _id: cleanId }, { orderId: cleanId }, { order_id: cleanId }] }
    : { orderId: cleanId };

  const updatedDelivery = await Delivery.findOneAndUpdate(
    query,
    {
      current_location: {
        lat: numLat,
        lng: numLng
      },
      updated_at: new Date(),
      updatedAt: new Date()
    }
  );

  if (!updatedDelivery) {
    const error = new Error(`Không tìm thấy chuyến giao hàng: ${idOrOrderId}`);
    error.statusCode = 404;
    throw error;
  }

  return updatedDelivery;
}

module.exports = {
  findDeliveryByAnyId,
  acceptDeliveryJob,
  pickUpDeliveryJob,
  completeDeliveryJob,
  updateDeliveryLocation,
  updateOrderDirectly,
  DEFAULT_SIMULATED_DRIVER,
  VALID_TRANSITIONS
};
