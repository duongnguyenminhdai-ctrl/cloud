const Delivery = require('../models/Delivery');

// 1. Theo dõi lộ trình đơn hàng theo orderId (GET /deliveries/order/:orderId)
exports.getDeliveryByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const delivery = await Delivery.findOne({ orderId }).sort({ createdAt: -1 });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: `Chưa có thông tin chuyến giao hàng cho đơn hàng: ${orderId}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin lộ trình giao hàng thành công',
      data: delivery
    });
  } catch (error) {
    console.error('[deliveryController] ❌ Lỗi tra cứu chuyến giao hàng:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tra cứu lộ trình: ' + error.message
    });
  }
};

// 2. Lấy danh sách tất cả các chuyến giao hàng (GET /deliveries)
exports.getAllDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find().sort({ createdAt: -1 });
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

// 3. Cập nhật trạng thái giao hàng hoặc gán tài xế (PUT /deliveries/order/:orderId/status)
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, driverName } = req.body;

    const updateFields = { updatedAt: new Date() };
    if (status) updateFields.status = status;
    if (driverName) updateFields.driverName = driverName;

    const updatedDelivery = await Delivery.findOneAndUpdate(
      { orderId },
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
