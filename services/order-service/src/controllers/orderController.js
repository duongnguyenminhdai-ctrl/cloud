const Order = require('../models/Order');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');
const { subscribe, emitOrderEvent } = require('../utils/realtimeHub');

/**
 * Hàm helper kiểm tra độ tương đồng tên món ăn (cho ưu đãi vòng quay Roulette)
 */
function nameSimilarityMatch(nameA, nameB) {
  if (!nameA || !nameB) return false;

  const STOP_WORDS = new Set([
    'và', 'với', 'có', 'của', 'cho', 'các', 'một', 'món', 'ăn', 'uống',
    'đặc', 'biệt', 'số', 'thêm', 'không', 'bao', 'gồm', 'size', 'phần',
    'combo', 'set', 'mix', 'the', 'and', 'with', 'or', 'in', 'of', 'a', 'an',
    'trúng', 'thưởng', 'quay'
  ]);

  const normalize = (str) => String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s\u0300-\u036f]/g, ' ')
    .normalize('NFC')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

  const wordsA = normalize(nameA);
  const wordsB = normalize(nameB);

  const setA = new Set(wordsA);
  for (const word of wordsB) {
    if (setA.has(word)) return true;
  }

  for (const wA of wordsA) {
    for (const wB of wordsB) {
      if (wA.length >= 3 && wB.length >= 3 && (wA.includes(wB) || wB.includes(wA))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Tra cứu thông tin phiên quay Roulette từ restaurant-service hoặc trực tiếp từ MongoDB Atlas
 */
async function fetchRouletteSession(sessionId) {
  if (!sessionId) return null;
  const restaurantUrl = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3001';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${restaurantUrl}/api/v1/restaurants/roulette/session/${sessionId}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.success && data.data) {
        return data.data;
      }
    }
  } catch (err) {
    // Timeout hoặc network error, tiến hành fallback MongoDB
  }

  // Fallback sang MongoDB cluster trực tiếp nếu đang kết nối
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const restDb = mongoose.connection.useDb('restaurant_db');
      const sessionsCol = restDb.collection('roulettesessions');
      const doc = await sessionsCol.findOne({ sessionId: String(sessionId) });
      if (doc) return doc;
    }
  } catch (dbErr) {
    // Không truy cập được fallback
  }

  return null;
}

/**
 * Đánh dấu tiêu thụ phiên quay Roulette sau khi đơn hàng được tạo thành công
 */
async function consumeRouletteSession(sessionId, { orderId, userId, menuItemId, orderItemName }) {
  if (!sessionId) return false;
  const restaurantUrl = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3001';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${restaurantUrl}/api/v1/restaurants/roulette/session/${sessionId}/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderId ? String(orderId) : null,
        userId: userId ? String(userId) : null,
        menuItemId: menuItemId ? String(menuItemId) : null,
        orderItemName: orderItemName ? String(orderItemName) : null
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      return true;
    }
  } catch (err) {
    // Network fallback
  }

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const restDb = mongoose.connection.useDb('restaurant_db');
      const sessionsCol = restDb.collection('roulettesessions');
      await sessionsCol.updateOne(
        { sessionId: String(sessionId), isUsed: false },
        {
          $set: {
            isUsed: true,
            usedAt: new Date(),
            orderId: orderId ? String(orderId) : null
          }
        }
      );
      return true;
    }
  } catch (dbErr) {
    // silent
  }

  return false;
}

/**
 * Cộng Xu FoodFast cho người dùng qua MongoDB auth_db hoặc API Auth Service
 */
async function creditUserCoins(userId, amount = 2000, reason = 'ROULETTE_DOUBLE_COINS', orderId = null) {
  if (!userId || amount <= 0) return null;

  // 1. Direct MongoDB update across databases on the same Atlas cluster
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const authDb = mongoose.connection.useDb('auth_db');
      const usersCol = authDb.collection('users');
      const query = mongoose.isValidObjectId(userId) ? { _id: new mongoose.Types.ObjectId(userId) } : { _id: String(userId) };
      const updated = await usersCol.findOneAndUpdate(
        query,
        { $inc: { coins: amount } },
        { returnDocument: 'after' }
      );
      if (updated && (updated.value?.coins !== undefined || updated.coins !== undefined)) {
        return updated.value?.coins ?? updated.coins;
      }
    }
  } catch (dbErr) {
    console.warn('[orderController] ⚠️ Lỗi cộng xu trực tiếp qua auth_db:', dbErr.message);
  }

  // 2. HTTP fallback via Auth Service API
  try {
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3005';
    const resp = await fetch(`${authUrl}/api/v1/auth/coins/reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: String(userId),
        amount,
        reason,
        orderId: orderId ? String(orderId) : null
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      return data?.coins;
    }
  } catch (httpErr) {
    console.warn('[orderController] ⚠️ Lỗi gọi API Auth Service cộng xu:', httpErr.message);
  }

  return null;
}

/**
 * Tự động nhân đôi xu thưởng khi đơn hàng hoàn thành DELIVERED / COMPLETED
 */
async function rewardRouletteCoinsIfEligible(order) {
  if (!order || Number(order.coinBonusMultiplier) <= 1 || order.coinsRewarded) {
    return false;
  }
  const coinsToReward = 2000;
  try {
    await creditUserCoins(order.customerId, coinsToReward, 'ROULETTE_DOUBLE_COINS', order._id);
    order.coinsRewarded = true;
    order.coinsRewardAmount = coinsToReward;
    await order.save();
    console.log(`[orderController] 🎁 Đã tặng x2 Xu (${coinsToReward} Xu) cho khách hàng ${order.customerId} từ đơn hàng ${order._id}`);
    return true;
  } catch (err) {
    console.warn('[orderController] ⚠️ Lỗi thưởng xu roulette:', err.message);
    return false;
  }
}

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
      shippingFee,
      rouletteSessionId,
      isGroupOrder,
      groupOrderRoomCode,
      groupOrderInfo
    } = req.body;

    const resolvedCustomerId = (req.user && req.user.userId) ? req.user.userId : customerId;

    if (!restaurantId || !resolvedCustomerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: restaurantId, customerId và danh sách items'
      });
    }

    // Bảo mật STRIDE (Tampering): Kiểm tra giá tiền và số lượng từng món ăn không được âm
    for (const item of items) {
      const price = Number(item.price);
      const qty = Number(item.quantity);
      if (isNaN(price) || price < 0 || isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu món ăn không hợp lệ: Số lượng phải là số nguyên dương (>= 1) và giá tiền không được âm.'
        });
      }
    }

    // Xác thực ưu đãi phiên quay Roulette (Requirement R2)
    let coinBonusMultiplier = 1;
    let validatedRouletteSession = null;
    let rouletteMenuItemId = null;
    let rouletteMatchedItemName = null;

    if (rouletteSessionId) {
      const sessId = String(rouletteSessionId).trim();
      const session = await fetchRouletteSession(sessId);

      if (!session) {
        return res.status(400).json({
          success: false,
          message: 'Phiên quay thưởng không tồn tại.'
        });
      }

      // Check 1: Thuộc đúng người dùng hiện tại
      if (session.userId && String(session.userId) !== String(resolvedCustomerId)) {
        return res.status(403).json({
          success: false,
          message: 'Phiên quay thưởng không thuộc về tài khoản này.'
        });
      }

      // Check 2: Chưa từng sử dụng
      if (session.isUsed) {
        return res.status(400).json({
          success: false,
          message: 'Phiên quay thưởng đã được sử dụng cho một đơn hàng khác.'
        });
      }

      // Check 3: Chưa quá hạn (10 phút)
      if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'Phiên quay thưởng đã hết hạn (quá thời hạn 10 phút).'
        });
      }

      // Check 4: Giỏ hàng có chứa món tương tự hoặc đúng menuItemId đã trúng thưởng
      const isAnyMenuItem = !session.menuItemId || session.menuItemId === 'ANY';
      const winningName = session.menuItemName || session.menuItemId || 'Món trúng thưởng';

      const matchedItem = items.find((it) => {
        const itId = it.menuItemId || it._id || it.id;
        // Trùng id
        if (itId && session.menuItemId && String(itId) === String(session.menuItemId)) {
          return true;
        }
        // Hoặc tên món tương tự
        if (session.menuItemName && it.name && nameSimilarityMatch(session.menuItemName, it.name)) {
          return true;
        }
        return false;
      });

      if (!matchedItem && !isAnyMenuItem) {
        return res.status(400).json({
          success: false,
          message: `Giỏ hàng phải chứa món ăn trúng thưởng [${winningName}] (hoặc món có tên tương tự) trong vòng 10 phút để kích hoạt ưu đãi x2 Xu.`
        });
      }

      // Check 5: Quán ăn: Chỉ kiểm tra nếu phiên chỉ định cụ thể một quán (khác ANY)
      if (session.restaurantId && session.restaurantId !== 'ANY' && String(restaurantId) !== String(session.restaurantId)) {
        return res.status(400).json({
          success: false,
          message: 'Quán ăn không khớp với món ăn trúng thưởng từ vòng quay.'
        });
      }

      coinBonusMultiplier = 2;
      validatedRouletteSession = session;
      rouletteMenuItemId = matchedItem ? (matchedItem.menuItemId || matchedItem._id || matchedItem.id || 'ANY') : (session.menuItemId || 'ANY');
      rouletteMatchedItemName = matchedItem ? matchedItem.name : session.menuItemName;
    }

    const grossItemsTotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    // Tự động tính toán tổng tiền nếu client không gửi
    const calculatedTotal = totalPrice !== undefined ? Math.max(0, Number(totalPrice)) : grossItemsTotal;
    const resolvedOriginalTotal = originalTotal !== undefined ? Math.max(0, Number(originalTotal)) : grossItemsTotal;
    const totalVoucherDisc = Math.max(0, Number(voucherDiscount) || 0);
    const resolvedIssuerType =
      voucherIssuerType === 'STORE' || voucherIssuerType === 'PLATFORM'
        ? voucherIssuerType
        : totalVoucherDisc > 0
        ? 'PLATFORM'
        : null;

    const resolvedStoreDiscount =
      resolvedIssuerType === 'STORE'
        ? Math.min(resolvedOriginalTotal, Math.max(0, Number(storeVoucherDiscount ?? totalVoucherDisc) || 0))
        : 0;
    const resolvedPlatformDiscount =
      resolvedIssuerType === 'PLATFORM'
        ? Math.max(0, Number(platformVoucherDiscount ?? totalVoucherDisc) || 0)
        : 0;

    // Tạo đơn hàng trạng thái PENDING
    const newOrder = new Order({
      restaurantId,
      customerId: resolvedCustomerId,
      restaurantName: restaurantName || null,
      restaurantImage: restaurantImage || null,
      items,
      totalPrice: calculatedTotal,
      originalTotal: resolvedOriginalTotal,
      status: 'PENDING',
      paymentMethod: paymentMethod || 'VNPAY',
      driverNote: driverNote || '',
      coinDiscount: Math.max(0, Number(coinDiscount) || 0),
      voucherDiscount: totalVoucherDisc,
      voucherCode: voucherCode || null,
      voucherIssuerType: resolvedIssuerType,
      storeVoucherDiscount: resolvedStoreDiscount,
      platformVoucherDiscount: resolvedPlatformDiscount,
      shippingFee: Math.max(0, Number(shippingFee) || 16000),
      rouletteSessionId: validatedRouletteSession ? validatedRouletteSession.sessionId : null,
      coinBonusMultiplier,
      rouletteMenuItemId,
      coinsRewarded: false,
      coinsRewardAmount: 0,
      isGroupOrder: Boolean(isGroupOrder),
      groupOrderRoomCode: groupOrderRoomCode || null,
      groupOrderInfo: groupOrderInfo || null
    });

    const savedOrder = await newOrder.save();
    emitOrderEvent('order.created', savedOrder);
    console.log(`[orderController] 📝 Đã lưu đơn hàng vào MongoDB: ${savedOrder._id} (Phương thức: ${savedOrder.paymentMethod}, x2 Xu: ${coinBonusMultiplier > 1})`);

    // Tiêu thụ phiên quay roulette ngay lập tức để chống replay attack
    if (validatedRouletteSession) {
      try {
        await consumeRouletteSession(validatedRouletteSession.sessionId, {
          orderId: savedOrder._id,
          userId: resolvedCustomerId,
          menuItemId: validatedRouletteSession.menuItemId,
          orderItemName: rouletteMatchedItemName || validatedRouletteSession.menuItemName
        });
      } catch (consumeErr) {
        console.warn('[orderController] ⚠️ Lỗi tiêu thụ session quay roulette:', consumeErr.message);
      }
    }

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
      coinBonusMultiplier: savedOrder.coinBonusMultiplier,
      rouletteSessionId: savedOrder.rouletteSessionId,
      isGroupOrder: savedOrder.isGroupOrder,
      groupOrderRoomCode: savedOrder.groupOrderRoomCode,
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
      await rewardRouletteCoinsIfEligible(order);
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

    // Bảo mật STRIDE (Denial of Service): Giới hạn số lượng bản ghi trả về tối đa 100
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 100);
    const page = Math.max(1, Number(req.query.page) || 1);
    const skip = (page - 1) * limit;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.status(200).json({
      success: true,
      page,
      limit,
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

// 5. Cập nhật trạng thái đơn hàng (CONFIRMED, PREPARING, READY, CANCELLED, DELIVERED, COMPLETED)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    // Bảo mật STRIDE (Tampering): Whitelist các trạng thái hợp lệ
    const validStatuses = [
      'PENDING', 'CONFIRMED', 'PREPARING', 'READY',
      'FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING',
      'DELIVERED', 'COMPLETED', 'CANCELLED'
    ];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ: ${status}`
      });
    }

    // Bảo mật STRIDE (Elevation of Privilege): Kiểm tra quyền nếu có token định danh
    if (req.user) {
      const userRole = req.user.role || req.user.userRole;
      const userId = req.user.userId || req.user.id;
      // Khách hàng thông thường chỉ có thể hủy đơn (CANCELLED) khi đơn đang ở PENDING
      if (userRole === 'CUSTOMER' || userRole === 'USER') {
        if (order.customerId && String(order.customerId) !== String(userId)) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền can thiệp vào đơn hàng của người khác!'
          });
        }
        if (status !== 'CANCELLED') {
          return res.status(403).json({
            success: false,
            message: 'Khách hàng chỉ được phép hủy đơn hàng!'
          });
        }
        if (order.status !== 'PENDING') {
          return res.status(400).json({
            success: false,
            message: 'Đơn hàng đã được quán xác nhận hoặc đang chuẩn bị, không thể tự hủy!'
          });
        }
      }
    }

    if (status) order.status = status;
    if (note) order.driverNote = (order.driverNote ? order.driverNote + ' | ' : '') + note;

    // Tự động thưởng x2 Xu khi hoàn tất giao hàng thành công (DELIVERED / COMPLETED)
    if (['DELIVERED', 'COMPLETED'].includes(order.status)) {
      await rewardRouletteCoinsIfEligible(order);
    }

    await order.save();

    emitOrderEvent('order.updated', order);
    const routingKey = ['DELIVERED', 'COMPLETED'].includes(order.status) ? 'order.completed' : 'order.status_updated';
    if (typeof publishEvent === 'function') {
      Promise.resolve(publishEvent(DEFAULT_EXCHANGE, routingKey, {
        orderId: order._id ? String(order._id) : id,
        restaurantId: order.restaurantId ? String(order.restaurantId) : null,
        customerId: order.customerId ? String(order.customerId) : null,
        status: order.status,
        coinBonusMultiplier: order.coinBonusMultiplier,
        rewardCoins: order.coinsRewardAmount || (order.coinBonusMultiplier > 1 ? 2000 : 1000)
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
      // Bảo mật STRIDE (Tampering): Kiểm tra giá và số lượng món ăn khi sửa
      for (const item of items) {
        const price = Number(item.price);
        const qty = Number(item.quantity);
        if (isNaN(price) || price < 0 || isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
          return res.status(400).json({
            success: false,
            message: 'Dữ liệu món ăn không hợp lệ: Số lượng phải là số nguyên dương và giá không âm.'
          });
        }
      }

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

exports.fetchRouletteSession = fetchRouletteSession;
exports.consumeRouletteSession = consumeRouletteSession;
exports.creditUserCoins = creditUserCoins;
exports.rewardRouletteCoinsIfEligible = rewardRouletteCoinsIfEligible;
