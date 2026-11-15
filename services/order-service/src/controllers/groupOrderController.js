const GroupOrder = require('../models/GroupOrder');
const Order = require('../models/Order');
const { publishEvent, DEFAULT_EXCHANGE } = require('../rabbitmq');
const { subscribe, emitOrderEvent, emitGroupOrderEvent } = require('../utils/realtimeHub');

/**
 * Sinh mã phòng ngẫu nhiên 6 ký tự chữ hoa và số
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Tính toán bảng phân bổ chi phí (Bill Split) cho nhóm
 */
function calculateGroupSummary(groupOrder) {
  const items = groupOrder.items || [];
  const members = groupOrder.members || [];
  const shippingFee = Number(groupOrder.shippingFee) >= 0 ? Number(groupOrder.shippingFee) : 16000;

  const grossFoodTotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0
  );

  // Tập hợp các memberId có món trong giỏ hàng
  const orderingMemberIds = new Set(items.map((it) => String(it.memberId)));

  // Bảng phân bổ theo từng thành viên đã tham gia
  const membersBreakdown = members.map((m) => {
    const memberIdStr = String(m._id);
    const userIdStr = m.userId ? String(m.userId) : null;

    const mItems = items.filter(
      (it) =>
        String(it.memberId) === memberIdStr ||
        (userIdStr && String(it.memberId) === userIdStr) ||
        it.memberName === m.displayName
    );

    const mFoodTotal = mItems.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );

    return {
      memberId: m._id,
      userId: m.userId,
      displayName: m.displayName,
      avatar: m.avatar,
      isHost: m.isHost,
      itemsCount: mItems.length,
      foodTotal: mFoodTotal,
      hasOrdered: mItems.length > 0,
      items: mItems
    };
  });

  // Đếm số thành viên thực tế có đặt món
  const orderingCount = membersBreakdown.filter((mb) => mb.hasOrdered).length;
  // Nếu có items nhưng member chưa map hết, dùng orderingMemberIds.size
  const splitCount = Math.max(1, orderingCount || orderingMemberIds.size || 1);
  const shippingPerMember = items.length > 0 ? Math.round(shippingFee / splitCount) : 0;

  // Cập nhật shippingShare và totalPayable cho từng member
  membersBreakdown.forEach((mb) => {
    mb.shippingShare = mb.hasOrdered ? shippingPerMember : 0;
    mb.totalPayable = mb.foodTotal + mb.shippingShare;
  });

  const finalTotal = grossFoodTotal + (items.length > 0 ? shippingFee : 0);

  return {
    grossFoodTotal,
    shippingFee,
    finalTotal,
    splitCount: items.length > 0 ? splitCount : 0,
    shippingPerMember,
    totalItems: items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0),
    membersBreakdown
  };
}

// 1. Khởi tạo phòng đặt nhóm (POST /group-order/create)
exports.createGroupRoom = async (req, res) => {
  try {
    const { restaurantId, restaurantName, restaurantImage, hostName, deliveryAddress, note, shippingFee } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp restaurantId của quán ăn'
      });
    }

    const hostId = (req.user && req.user.userId) ? req.user.userId : (req.body.hostId || `host_${Date.now()}`);
    const resolvedHostName = (req.user && (req.user.name || req.user.displayName)) ? (req.user.name || req.user.displayName) : (hostName || 'Trưởng nhóm');
    const resolvedHostAvatar = (req.user && req.user.avatar) ? req.user.avatar : (req.body.hostAvatar || null);

    // Sinh roomCode duy nhất
    let roomCode = generateRoomCode();
    let collisionCheck = await GroupOrder.findOne({ roomCode });
    let attempts = 0;
    while (collisionCheck && attempts < 5) {
      roomCode = generateRoomCode();
      collisionCheck = await GroupOrder.findOne({ roomCode });
      attempts++;
    }

    const hostMember = {
      userId: req.user?.userId || (req.body.hostId ? String(req.body.hostId) : null),
      displayName: resolvedHostName,
      avatar: resolvedHostAvatar,
      isHost: true,
      joinedAt: new Date()
    };

    const newGroupOrder = new GroupOrder({
      roomCode,
      hostId: String(hostId),
      hostName: resolvedHostName,
      restaurantId: String(restaurantId),
      restaurantName: restaurantName || '',
      restaurantImage: restaurantImage || '',
      status: 'OPEN',
      members: [hostMember],
      items: [],
      shippingFee: shippingFee !== undefined ? Math.max(0, Number(shippingFee)) : 16000,
      deliveryAddress: deliveryAddress || '',
      note: note || ''
    });

    const savedGroupOrder = await newGroupOrder.save();
    const summary = calculateGroupSummary(savedGroupOrder);

    emitGroupOrderEvent(roomCode, 'group_order.created', {
      roomCode,
      status: savedGroupOrder.status,
      hostName: resolvedHostName,
      restaurantName: savedGroupOrder.restaurantName
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo phòng đặt đơn nhóm thành công!',
      data: {
        ...savedGroupOrder.toObject(),
        summary
      }
    });
  } catch (error) {
    console.error('[groupOrderController] ❌ Lỗi tạo phòng nhóm:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo phòng nhóm: ' + error.message
    });
  }
};

// 2. Lấy thông tin phòng và bảng phân bổ chi phí (GET /group-order/:roomCode)
exports.getGroupRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Mã phòng không được để trống' });
    }

    const groupOrder = await GroupOrder.findOne({ roomCode: roomCode.toUpperCase() });
    if (!groupOrder) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy phòng đặt nhóm với mã: ${roomCode.toUpperCase()}`
      });
    }

    const summary = calculateGroupSummary(groupOrder);

    return res.status(200).json({
      success: true,
      data: {
        ...groupOrder.toObject(),
        summary
      }
    });
  } catch (error) {
    console.error('[groupOrderController] ❌ Lỗi lấy chi tiết phòng nhóm:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết phòng nhóm: ' + error.message
    });
  }
};

// 3. Tham gia phòng nhóm (POST /group-order/:roomCode/join)
exports.joinGroupRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { displayName, userId, avatar } = req.body;

    const groupOrder = await GroupOrder.findOne({ roomCode: roomCode.toUpperCase() });
    if (!groupOrder) {
      return res.status(404).json({ success: false, message: 'Phòng đặt nhóm không tồn tại' });
    }

    if (groupOrder.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Phòng đã bị khóa hoặc đã chốt đơn, không thể tham gia.'
      });
    }

    const currentUserId = (req.user && req.user.userId) ? req.user.userId : (userId || null);
    const resolvedName = (req.user && (req.user.name || req.user.displayName)) ? (req.user.name || req.user.displayName) : (displayName ? displayName.trim() : '');

    if (!resolvedName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp tên hiển thị (displayName)'
      });
    }

    // Kiểm tra xem thành viên đã tham gia phòng chưa (idempotent)
    let existingMember = groupOrder.members.find((m) =>
      (currentUserId && m.userId && String(m.userId) === String(currentUserId)) ||
      (!currentUserId && m.displayName.toLowerCase() === resolvedName.toLowerCase())
    );

    if (existingMember) {
      const summary = calculateGroupSummary(groupOrder);
      return res.status(200).json({
        success: true,
        message: 'Đã tham gia phòng trước đó',
        member: existingMember,
        data: {
          ...groupOrder.toObject(),
          summary
        }
      });
    }

    const newMember = {
      userId: currentUserId ? String(currentUserId) : null,
      displayName: resolvedName,
      avatar: (req.user && req.user.avatar) ? req.user.avatar : (avatar || null),
      isHost: false,
      joinedAt: new Date()
    };

    groupOrder.members.push(newMember);
    await groupOrder.save();

    const summary = calculateGroupSummary(groupOrder);
    const addedMember = groupOrder.members[groupOrder.members.length - 1];

    emitGroupOrderEvent(groupOrder.roomCode, 'group_order.updated', {
      action: 'member_joined',
      member: addedMember,
      summary
    });

    return res.status(200).json({
      success: true,
      message: 'Tham gia phòng đặt nhóm thành công!',
      member: addedMember,
      data: {
        ...groupOrder.toObject(),
        summary
      }
    });
  } catch (error) {
    console.error('[groupOrderController] ❌ Lỗi tham gia phòng nhóm:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tham gia phòng nhóm: ' + error.message
    });
  }
};

// 4. Thêm món vào giỏ hàng nhóm (POST /group-order/:roomCode/items)
exports.addGroupItem = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { memberId, memberName, menuItemId, name, price, quantity, options, note, image } = req.body;

    const groupOrder = await GroupOrder.findOne({ roomCode: roomCode.toUpperCase() });
    if (!groupOrder) {
      return res.status(404).json({ success: false, message: 'Phòng đặt nhóm không tồn tại' });
    }

    if (groupOrder.status === 'LOCKED') {
      return res.status(400).json({
        success: false,
        message: 'Phòng đã bị khóa, không thể thêm món ăn mới.'
      });
    }

    if (groupOrder.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Phòng không ở trạng thái mở để chọn món.'
      });
    }

    const numPrice = Number(price);
    const numQty = Number(quantity);
    if (!menuItemId || !name || isNaN(numPrice) || numPrice < 0 || isNaN(numQty) || numQty < 1 || !Number.isInteger(numQty)) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu món ăn không hợp lệ: số lượng phải là số nguyên >= 1 và giá không được âm.'
      });
    }

    // Xác định member trong phòng
    const callerUserId = req.user?.userId;
    const matchedMember = groupOrder.members.find(
      (m) =>
        (memberId && (String(m._id) === String(memberId) || (m.userId && String(m.userId) === String(memberId)))) ||
        (callerUserId && m.userId && String(m.userId) === String(callerUserId))
    );

    const resolvedMemberId = matchedMember ? String(matchedMember._id) : (memberId || callerUserId || `guest_${Date.now()}`);
    const resolvedMemberName = matchedMember ? matchedMember.displayName : (memberName || req.user?.name || 'Khách');

    const newItem = {
      memberId: resolvedMemberId,
      memberName: resolvedMemberName,
      menuItemId: String(menuItemId),
      name: String(name).trim(),
      price: numPrice,
      quantity: numQty,
      options: Array.isArray(options) ? options : [],
      note: note || '',
      image: image || ''
    };

    groupOrder.items.push(newItem);
    await groupOrder.save();

    const summary = calculateGroupSummary(groupOrder);

    emitGroupOrderEvent(groupOrder.roomCode, 'group_order.updated', {
      action: 'item_added',
      item: groupOrder.items[groupOrder.items.length - 1],
      summary
    });

    return res.status(201).json({
      success: true,
      message: 'Đã thêm món vào giỏ hàng nhóm!',
      data: {
        ...groupOrder.toObject(),
        summary
      }
    });
  } catch (error) {
    console.error('[groupOrderController] ❌ Lỗi thêm món vào nhóm:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi thêm món vào nhóm: ' + error.message
    });
  }
};

// 5. Xóa món khỏi giỏ hàng nhóm (DELETE /group-order/:roomCode/items/:itemId)
exports.removeGroupItem = async (req, res) => {
  try {
    const { roomCode, itemId } = req.params;

    const groupOrder = await GroupOrder.findOne({ roomCode: roomCode.toUpperCase() });
    if (!groupOrder) {
      return res.status(404).json({ success: false, message: 'Phòng đặt nhóm không tồn tại' });
    }

    if (groupOrder.status === 'LOCKED') {
      return res.status(400).json({
        success: false,
        message: 'Phòng đã bị khóa, không thể xóa món ăn.'
      });
    }

    if (groupOrder.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Phòng không ở trạng thái mở.'
      });
    }

    const itemIndex = groupOrder.items.findIndex((it) => String(it._id) === String(itemId));
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy món ăn trong giỏ hàng nhóm'
      });
    }

    const targetItem = groupOrder.items[itemIndex];
    const callerId = (req.user && req.user.userId) ? req.user.userId : (req.body?.memberId || req.query?.memberId);

    // Kiểm tra quyền: Người tạo món hoặc Host của phòng
    const isHost =
      (callerId && String(callerId) === String(groupOrder.hostId)) ||
      (req.user && String(req.user.userId) === String(groupOrder.hostId));

    const isOwner =
      callerId &&
      (String(callerId) === String(targetItem.memberId) ||
        groupOrder.members.some(
          (m) =>
            (String(m._id) === String(targetItem.memberId) || (m.userId && String(m.userId) === String(targetItem.memberId))) &&
            (String(m._id) === String(callerId) || (m.userId && String(m.userId) === String(callerId)))
        ));

    if (!isHost && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa món của người khác!'
      });
    }

    groupOrder.items.splice(itemIndex, 1);
    await groupOrder.save();

    const summary = calculateGroupSummary(groupOrder);

    emitGroupOrderEvent(groupOrder.roomCode, 'group_order.updated', {
      action: 'item_removed',
      itemId,
      summary
    });

    return res.status(200).json({
      success: true,
      message: 'Đã xóa món ăn khỏi giỏ hàng nhóm!',
      data: {
        ...groupOrder.toObject(),
        summary
      }
    });
  } catch (error) {
    console.error('[groupOrderController] ❌ Lỗi xóa món khỏi nhóm:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa món: ' + error.message
    });
  }
};

// 6. Khóa / Mở khóa phòng nhóm (POST /group-order/:roomCode/lock)
exports.lockGroupRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;

    const groupOrder = await GroupOrder.findOne({ roomCode: roomCode.toUpperCase() });
    if (!groupOrder) {
      return res.status(404).json({ success: false, message: 'Phòng đặt nhóm không tồn tại' });
    }

    const callerId = (req.user && req.user.userId) ? req.user.userId : req.body?.hostId;
    const isHost = callerId && String(callerId) === String(groupOrder.hostId);

    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Trưởng nhóm (Host) mới có quyền khóa/mở khóa phòng!'
      });
    }

    if (groupOrder.status === 'ORDERED' || groupOrder.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Phòng đã hoàn tất hoặc đã bị hủy, không thể thay đổi trạng thái.'
      });
    }

    if (req.body.unlock === true || req.body.status === 'OPEN') {
      groupOrder.status = 'OPEN';
    } else if (req.body.status === 'LOCKED') {
      groupOrder.status = 'LOCKED';
    } else {
      groupOrder.status = groupOrder.status === 'LOCKED' ? 'OPEN' : 'LOCKED';
    }

    await groupOrder.save();
    const summary = calculateGroupSummary(groupOrder);

    emitGroupOrderEvent(groupOrder.roomCode, 'group_order.updated', {
      action: 'status_changed',
      status: groupOrder.status,
      summary
    });

    return res.status(200).json({
      success: true,
      message: `Phòng đã chuyển sang trạng thái ${groupOrder.status}`,
      status: groupOrder.status,
      data: {
        ...groupOrder.toObject(),
        summary
      }
    });
  } catch (error) {
    console.error('[groupOrderController] ❌ Lỗi khóa/mở khóa phòng:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi khóa/mở khóa phòng: ' + error.message
    });
  }
};

// 7. Chốt đơn nhóm thành Order hoàn chỉnh (POST /group-order/:roomCode/checkout)
exports.checkoutGroupRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { hostId, paymentMethod, deliveryAddress, driverNote, voucherCode, coinDiscount } = req.body;

    const groupOrder = await GroupOrder.findOne({ roomCode: roomCode.toUpperCase() });
    if (!groupOrder) {
      return res.status(404).json({ success: false, message: 'Phòng đặt nhóm không tồn tại' });
    }

    const callerId = (req.user && req.user.userId) ? req.user.userId : hostId;
    const isHost = callerId && String(callerId) === String(groupOrder.hostId);

    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Trưởng nhóm (Host) mới có quyền chốt đơn nhóm!'
      });
    }

    if (groupOrder.status === 'ORDERED') {
      return res.status(400).json({
        success: false,
        message: 'Phòng này đã được chốt đơn trước đó.'
      });
    }

    if (groupOrder.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Phòng này đã bị hủy, không thể chốt đơn.'
      });
    }

    if (!groupOrder.items || groupOrder.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giỏ hàng nhóm đang trống, không thể chốt đơn!'
      });
    }

    const summary = calculateGroupSummary(groupOrder);
    const shipping = Number(groupOrder.shippingFee) >= 0 ? Number(groupOrder.shippingFee) : 16000;
    const grossFoodTotal = summary.grossFoodTotal;
    const resolvedCoinDisc = Math.max(0, Number(coinDiscount) || 0);
    const calculatedTotal = Math.max(0, grossFoodTotal + shipping - resolvedCoinDisc);

    // Xây dựng bản ghi Order trong order_db
    const newOrder = new Order({
      customerId: String(groupOrder.hostId),
      restaurantId: String(groupOrder.restaurantId),
      restaurantName: groupOrder.restaurantName || null,
      restaurantImage: groupOrder.restaurantImage || null,
      items: groupOrder.items.map((it) => ({
        memberId: it.memberId,
        memberName: it.memberName,
        menuItemId: it.menuItemId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        options: it.options || [],
        note: it.note || '',
        image: it.image || ''
      })),
      totalPrice: calculatedTotal,
      originalTotal: grossFoodTotal,
      shippingFee: shipping,
      coinDiscount: resolvedCoinDisc,
      voucherCode: voucherCode || null,
      status: 'PENDING',
      paymentMethod: paymentMethod || 'VNPAY',
      driverNote: driverNote || groupOrder.note || '',
      isGroupOrder: true,
      groupOrderRoomCode: groupOrder.roomCode,
      groupOrderInfo: {
        roomCode: groupOrder.roomCode,
        hostId: groupOrder.hostId,
        hostName: groupOrder.hostName,
        membersCount: groupOrder.members.length,
        splitCount: summary.splitCount,
        shippingFee: shipping,
        shippingPerMember: summary.shippingPerMember,
        membersBreakdown: summary.membersBreakdown
      }
    });

    const savedOrder = await newOrder.save();

    groupOrder.status = 'ORDERED';
    groupOrder.orderId = savedOrder._id;
    if (deliveryAddress) groupOrder.deliveryAddress = deliveryAddress;
    await groupOrder.save();

    // Phát sự kiện realtime
    emitOrderEvent('order.created', savedOrder);
    emitGroupOrderEvent(groupOrder.roomCode, 'group_order.updated', {
      action: 'checkout_completed',
      status: 'ORDERED',
      orderId: savedOrder._id,
      order: savedOrder,
      summary
    });

    // Bắn event RabbitMQ topic
    try {
      await publishEvent(DEFAULT_EXCHANGE, 'order.created', {
        orderId: savedOrder._id.toString(),
        restaurantId: savedOrder.restaurantId,
        customerId: savedOrder.customerId,
        isGroupOrder: true,
        groupOrderRoomCode: savedOrder.groupOrderRoomCode,
        items: savedOrder.items,
        totalPrice: savedOrder.totalPrice,
        originalTotal: savedOrder.originalTotal,
        status: savedOrder.status,
        paymentMethod: savedOrder.paymentMethod,
        createdAt: savedOrder.createdAt
      });
    } catch (eventErr) {
      console.warn('[groupOrderController] ⚠️ RabbitMQ publish warning:', eventErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Chốt đơn nhóm thành công!',
      order: savedOrder,
      groupOrder: {
        ...groupOrder.toObject(),
        summary
      }
    });
  } catch (error) {
    console.error('[groupOrderController] ❌ Lỗi chốt đơn nhóm:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi chốt đơn nhóm: ' + error.message
    });
  }
};

// 8. SSE Stream cho phòng nhóm (GET /group-order/:roomCode/stream)
exports.streamGroupRoom = (req, res) => {
  return subscribe(req, res, {
    roomCode: req.params.roomCode
  });
};

module.exports.calculateGroupSummary = calculateGroupSummary;
