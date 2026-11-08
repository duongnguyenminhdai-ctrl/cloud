const Delivery = require('../models/Delivery');
const {
  findDeliveryByAnyId,
  acceptDeliveryJob,
  pickUpDeliveryJob,
  completeDeliveryJob,
  updateDeliveryLocation
} = require('../services/deliveryStateMachine');
const { calculateShippingFee } = require('../utils/pricingEngine');

/**
 * 1. Theo dõi tiến trình giao hàng theo order_id (GET /api/v1/deliveries/track/:order_id)
 * Hỗ trợ polling / realtime cho màn hình Order Tracking của khách hàng
 */
exports.trackDelivery = async (req, res) => {
  try {
    const orderId = req.params.order_id || req.params.orderId;
    const delivery = await findDeliveryByAnyId(orderId);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: `Chưa có thông tin chuyến giao hàng cho đơn hàng: ${orderId}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin tiến trình giao hàng thành công',
      data: delivery
    });
  } catch (error) {
    console.error('[deliveryController] ❌ Lỗi tra cứu tiến trình giao hàng:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tra cứu lộ trình: ' + error.message
    });
  }
};

// Bí danh tương thích ngược
exports.getDeliveryByOrderId = exports.trackDelivery;

/**
 * 2. Endpoint tài xế nhận cuốc (PATCH /api/v1/deliveries/:id/accept)
 * Đổi trạng thái từ FINDING_DRIVER sang DRIVER_ASSIGNED
 */
exports.acceptDelivery = async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await acceptDeliveryJob(id, req.body || {});

    return res.status(200).json({
      success: true,
      message: 'Tài xế nhận cuốc thành công',
      data: updated
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 3. Endpoint xác nhận đã lấy món (PATCH /api/v1/deliveries/:id/pick-up)
 * Đổi trạng thái sang DELIVERING
 */
exports.pickUpDelivery = async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await pickUpDeliveryJob(id);

    return res.status(200).json({
      success: true,
      message: 'Xác nhận đã lấy món, bắt đầu giao hàng',
      data: updated
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 4. Endpoint xác nhận giao hàng thành công (PATCH /api/v1/deliveries/:id/complete)
 * Đổi trạng thái sang COMPLETED, đồng thời bắn sự kiện delivery.completed và order.completed
 */
exports.completeDelivery = async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await completeDeliveryJob(id);

    return res.status(200).json({
      success: true,
      message: 'Xác nhận giao hàng thành công',
      data: updated
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 5. Cập nhật tọa độ GPS tài xế thời gian thực (PATCH /api/v1/deliveries/:id/location)
 * Nhận body: { lat, lng }
 */
exports.updateLocation = async (req, res) => {
  try {
    const id = req.params.id;
    const { lat, lng } = req.body || {};

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin tọa độ: vui lòng truyền lat và lng.'
      });
    }

    const updated = await updateDeliveryLocation(id, lat, lng);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật tọa độ GPS thời gian thực thành công',
      data: {
        current_location: updated.current_location,
        delivery: updated
      }
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 6. Lấy danh sách tất cả các chuyến giao hàng (GET /api/v1/deliveries)
 */
exports.getAllDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find().sort({ created_at: -1, createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: deliveries.length,
      data: deliveries
    });
  } catch (error) {
    console.error('[deliveryController] ❌ Lỗi lấy danh sách giao hàng:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách giao hàng: ' + error.message
    });
  }
};

/**
 * 7. Cập nhật trạng thái giao hàng cũ (PUT /api/v1/deliveries/order/:orderId/status)
 */
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, driverName } = req.body;

    const updateFields = { updated_at: new Date() };
    if (status) updateFields.status = status;
    if (driverName) {
      updateFields.driver_name = driverName;
      updateFields.driverName = driverName;
    }

    const updatedDelivery = await Delivery.findOneAndUpdate(
      { $or: [{ order_id: orderId }, { orderId }] },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedDelivery) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chuyến giao hàng cho đơn: ${orderId}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái giao hàng thành công!',
      data: updatedDelivery
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Lỗi cập nhật: ' + error.message
    });
  }
};

/**
 * 8. Tính phí giao hàng linh hoạt (Dynamic Surge Pricing theo giờ & thời tiết)
 * (GET / POST /api/v1/deliveries/shipping-fee)
 */
exports.getShippingFee = async (req, res) => {
  try {
    const rawDistance = req.method === 'POST' ? req.body.distanceKm : (req.query.distanceKm || req.query.distance);
    const distanceKm = Number(rawDistance !== undefined ? rawDistance : 2.0);

    const lat = Number(req.query.lat || req.body?.lat || req.query.latitude || req.body?.latitude || 10.78);
    const lng = Number(req.query.lng || req.body?.lng || req.query.longitude || req.body?.longitude || 106.70);

    const mockParams = {
      hour: req.query.mock_hour || req.body?.mock_hour || req.query.hour || req.body?.hour || req.headers['x-mock-hour'],
      simulate_rain: req.query.simulate_rain !== undefined ? req.query.simulate_rain : (req.body?.simulate_rain !== undefined ? req.body?.simulate_rain : req.headers['x-simulate-rain']),
      isRaining: req.query.isRaining !== undefined ? req.query.isRaining : req.body?.isRaining
    };

    const feeCalculation = await calculateShippingFee({
      distanceKm,
      userCoords: { lat, lng },
      mockParams
    });

    return res.status(200).json({
      success: true,
      message: 'Tính cước phí giao hàng thành công',
      data: feeCalculation
    });
  } catch (error) {
    console.error('[deliveryController] ❌ Lỗi tính cước phí giao hàng:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tính cước giao hàng: ' + error.message
    });
  }
};

