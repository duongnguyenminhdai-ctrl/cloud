const Order = require('../models/Order');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');
const { subscribe, emitOrderEvent } = require('../utils/realtimeHub');

exports.streamOrders = (req, res) => {
  return subscribe(req, res, {
    customerId: req.query?.customerId,
    restaurantId: req.query?.restaurantId,
    orderId: req.query?.orderId
  });
};

// 1. Tạo đơn hàng mới (POST /orders)
exports.createOrder = async (req, res) => {
  try {
    const {
      restaurantId,
      customerId,
      items,
      totalPrice,
      originalTotal,
      paymentMethod,
      restaurantName,
      restaurantImage,
      driverNote,
      coinDiscount,
      voucherDiscount,
      voucherCode,
      voucherIssuerType,
      storeVoucherDiscount,
      platformVoucherDiscount,
      shippingFee
    } = req.body;

    if (!restaurantId || !customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: restaurantId, customerId và danh sách items'
      });
    }

    const grossItemsTotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    // Tự động tính toán tổng tiền nếu client không gửi
    const calculatedTotal = totalPrice !== undefined ? Number(totalPrice) : grossItemsTotal;
    const resolvedOriginalTotal = originalTotal !== undefined ? Number(originalTotal) : grossItemsTotal;
    const totalVoucherDisc = Number(voucherDiscount) || 0;
    const resolvedIssuerType =
      voucherIssuerType === 'STORE' || voucherIssuerType === 'PLATFORM'
        ? voucherIssuerType
        : totalVoucherDisc > 0
        ? 'PLATFORM'
        : null;

    const resolvedStoreDiscount =
      resolvedIssuerType === 'STORE'
        ? Math.min(resolvedOriginalTotal, Number(storeVoucherDiscount ?? totalVoucherDisc) || 0)
        : 0;
    const resolvedPlatformDiscount =
      resolvedIssuerType === 'PLATFORM'
        ? Math.max(0, Number(platformVoucherDiscount ?? totalVoucherDisc) || 0)
        : 0;

    // Tạo đơn hàng trạng thái PENDING
    const newOrder = new Order({
      restaurantId,
      customerId,
      restaurantName: restaurantName || null,
      restaurantImage: restaurantImage || null,
      items,
      totalPrice: calculatedTotal,
      originalTotal: resolvedOriginalTotal,
      status: 'PENDING',
      paymentMethod: paymentMethod || 'VNPAY',
      driverNote: driverNote || '',
      coinDiscount: Number(coinDiscount) || 0,
      voucherDiscount: totalVoucherDisc,
      voucherCode: voucherCode || null,
      voucherIssuerType: resolvedIssuerType,
      storeVoucherDiscount: resolvedStoreDiscount,
      platformVoucherDiscount: resolvedPlatformDiscount,
      shippingFee: Number(shippingFee) || 16000
    });

    const savedOrder = await newOrder.save();
    emitOrderEvent('order.created', savedOrder);
    console.log(`[orderController] 📝 Đã lưu đơn hàng vào MongoDB: ${savedOrder._id} (Phương thức: ${savedOrder.paymentMethod})`);

    // Bắn event 'order.created' qua RabbitMQ Topic Exchange
    const eventPayload = {
      orderId: savedOrder._id.toString(),
      restaurantId: savedOrder.restaurantId,
      customerId: savedOrder.customerId,
      items: savedOrder.items,
      totalPrice: savedOrder.totalPrice,
      originalTotal: savedOrder.originalTotal,
      voucherCode: savedOrder.voucherCode,
      voucherIssuerType: savedOrder.voucherIssuerType,
      storeVoucherDiscount: savedOrder.storeVoucherDiscount,
      platformVoucherDiscount: savedOrder.platformVoucherDiscount,
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
    if (req.query.restaurantId) {
      filter.restaurantId = req.query.restaurantId;
    }
    if (req.query.status) {
      filter.status = req.query.status;
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
    if (result.modifiedCount > 0) {
      emitOrderEvent('order.updated', { status: 'DELIVERED', modifiedCount: result.modifiedCount });
    }
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

// 5. Cập nhật trạng thái đơn hàng (CONFIRMED, PREPARING, READY, CANCELLED)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }
    if (status) order.status = status;
    if (note) order.driverNote = (order.driverNote ? order.driverNote + ' | ' : '') + note;
    await order.save();

    emitOrderEvent('order.updated', order);
    const routingKey = ['DELIVERED', 'COMPLETED'].includes(order.status) ? 'order.completed' : 'order.status_updated';
    if (typeof publishEvent === 'function') {
      Promise.resolve(publishEvent(DEFAULT_EXCHANGE, routingKey, {
        orderId: order._id ? String(order._id) : id,
        restaurantId: order.restaurantId ? String(order.restaurantId) : null,
        customerId: order.customerId ? String(order.customerId) : null,
        status: order.status
      })).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái đơn hàng sang ${order.status}`,
      data: order
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Chỉnh sửa đơn hàng khi hết món hoặc sai giá (theo quy trình FoodFast Partner)
exports.modifyOrderItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, reason, note } = req.body;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (order.isModifiedByMerchant) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã được chỉnh sửa 1 lần trước đó. Quy định chỉ cho phép chỉnh sửa tối đa 1 lần!'
      });
    }

    if (items && Array.isArray(items)) {
      order.items = items;
      const newItemsTotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
      const discount = (order.coinDiscount || 0) + (order.voucherDiscount || 0);
      const shipping = order.shippingFee || 16000;
      order.totalPrice = Math.max(0, newItemsTotal - discount + shipping);
    }

    order.isModifiedByMerchant = true;
    order.modifyReason = reason || 'Món đã hết';
    if (note) order.driverNote = (order.driverNote ? order.driverNote + ' | ' : '') + note;

    await order.save();
    emitOrderEvent('order.updated', order);
    return res.status(200).json({
      success: true,
      message: 'Chỉnh sửa đơn hàng thành công!',
      data: order
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
