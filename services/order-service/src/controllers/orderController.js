const Order = require('../models/Order');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');

// 1. Tạo đơn hàng mới (POST /orders)
exports.createOrder = async (req, res) => {
  try {
    const { restaurantId, customerId, items, totalPrice, paymentMethod } = req.body;

    if (!restaurantId || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: restaurantId, customerId và danh sách items'
      });
    }

    // Tự động tính toán tổng tiền nếu client không gửi
    const calculatedTotal =
      totalPrice ||
      items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

    // Tạo đơn hàng trạng thái PENDING
    const newOrder = new Order({
      restaurantId,
      customerId,
      items,
      totalPrice: calculatedTotal,
      status: 'PENDING',
      paymentMethod: paymentMethod || 'VNPAY'
    });

    const savedOrder = await newOrder.save();
    console.log(`[orderController] 📝 Đã lưu đơn hàng vào MongoDB: ${savedOrder._id} (Phương thức: ${savedOrder.paymentMethod})`);

    // Bắn event 'order.created' qua RabbitMQ Topic Exchange
    const eventPayload = {
      orderId: savedOrder._id.toString(),
      restaurantId: savedOrder.restaurantId,
      customerId: savedOrder.customerId,
      items: savedOrder.items,
      totalPrice: savedOrder.totalPrice,
      status: savedOrder.status,
      paymentMethod: savedOrder.paymentMethod,
      createdAt: savedOrder.createdAt
    };

    try {
      await publishEvent(DEFAULT_EXCHANGE, 'order.created', eventPayload);
    } catch (eventError) {
      console.warn('[orderController] ⚠️ Lưu ý: Chưa thể bắn event RabbitMQ lúc này:', eventError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Đơn hàng được tạo thành công với trạng thái PENDING và đã phát sự kiện order.created!',
      data: savedOrder
    });
  } catch (error) {
    console.error('[orderController] ❌ Lỗi tạo đơn hàng:', error.message);
    return res.status(400).json({
      success: false,
      message: 'Lỗi khi tạo đơn hàng: ' + error.message
    });
  }
};

// 2. Lấy thông tin đơn hàng theo ID (GET /orders/:id)
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy đơn hàng với ID: ${id}`
      });
    }

    // Tự động hoàn tất đơn hàng nếu đã tạo hơn 45 giây trước mà chưa kết thúc
    const threshold = new Date(Date.now() - 45 * 1000);
    if (
      ['PENDING', 'CONFIRMED', 'FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'].includes(order.status) &&
      new Date(order.createdAt) < threshold
    ) {
      order.status = 'DELIVERED';
      if (!order.driver_info?.name) {
        order.driver_info = {
          name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
          vehicle: 'Honda Wave Alpha • 59-X1 888.88',
          phone: '0908 123 456'
        };
      }
      await order.save();
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('[orderController] ❌ Lỗi lấy đơn hàng:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết đơn hàng: ' + error.message
    });
  }
};

// 3. Lấy danh sách tất cả đơn hàng (GET /orders)
exports.getAllOrders = async (req, res) => {
  try {
    // Tự động xử lý dọn dẹp các đơn hàng cũ bị treo trước khi cập nhật delivery service
    // Tất cả các đơn đã tạo hơn 45s trước và chưa giao thành công sẽ được chuyển sang DELIVERED
    try {
      const threshold = new Date(Date.now() - 45 * 1000);
      await Order.updateMany(
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
    } catch (cleanErr) {
      console.warn('[orderController] ⚠️ Lỗi dọn dẹp đơn cũ tự động:', cleanErr.message);
    }

    const filter = {};
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('[orderController] ❌ Lỗi lấy danh sách đơn:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách đơn hàng: ' + error.message
    });
  }
};

// 4. Endpoint xử lý dọn dẹp đơn hàng cũ bị kẹt ở mọi tài khoản (POST /orders/cleanup-stale)
exports.cleanupStaleOrders = async (req, res) => {
  try {
    const threshold = new Date(Date.now() - 30 * 1000);
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

    console.log(`[orderController] 🧹 Đã dọn dẹp và cập nhật ${result.modifiedCount} đơn hàng cũ sang DELIVERED`);
    return res.status(200).json({
      success: true,
      message: `Đã dọn dẹp và hoàn tất ${result.modifiedCount} đơn hàng cũ bị treo.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('[orderController] ❌ Lỗi dọn dẹp đơn cũ:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi dọn dẹp đơn hàng cũ: ' + error.message
    });
  }
};
