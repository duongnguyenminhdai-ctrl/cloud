const crypto = require('crypto');
const Restaurant = require('../models/Restaurant');
const RouletteSession = require('../models/RouletteSession');
const RouletteSpinLog = require('../models/RouletteSpinLog');

/**
 * Trích xuất User ID từ req.user (được decode bởi verifyToken)
 */
function getAuthenticatedUserId(req) {
  return String(req.user?.userId || req.user?.id || req.user?._id || '').trim();
}

/**
 * Tính toán ngày và thời điểm reset 00:00:00 theo múi giờ Việt Nam (UTC+7)
 */
function getVietnamDateInfo() {
  const now = new Date();
  const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnTime.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Thời điểm 00:00:00 sáng hôm sau giờ Việt Nam (tương đương 17:00 UTC hôm nay)
  const nextMidnightUtc = Date.UTC(year, vnTime.getUTCMonth(), vnTime.getUTCDate() + 1, -7, 0, 0, 0);
  const resetAt = new Date(nextMidnightUtc);
  const resetInSeconds = Math.max(0, Math.floor((resetAt.getTime() - now.getTime()) / 1000));

  return { dateStr, resetAt, resetInSeconds };
}

/**
 * Xây dựng điều kiện lọc theo Budget (Ngân sách)
 */
function buildBudgetCondition(budget) {
  switch (budget) {
    case 'under_40k':
      return { 'menuItems.price': { $gt: 0, $lt: 40000 } };
    case '40k_70k':
      return { 'menuItems.price': { $gte: 40000, $lte: 70000 } };
    case 'above_70k':
      return { 'menuItems.price': { $gt: 70000 } };
    default:
      return { 'menuItems.price': { $gt: 0 } };
  }
}

/**
 * Xây dựng điều kiện lọc theo Mood (Tâm trạng)
 */
function buildMoodCondition(mood) {
  switch (mood) {
    case 'sleepy':
      // Cần tỉnh táo / Nạp năng lượng: Cà phê, trà, nước ép
      return {
        $or: [
          { 'menuItems.name': { $regex: /(cà phê|cafe|coffee|trà|tea|boba|latte|espresso|đá xay|macchiato|nước ép|sinh tố|tỉnh táo)/i } },
          { 'menuItems.description': { $regex: /(cà phê|cafe|coffee|trà|tea|boba|latte|espresso)/i } },
          { cuisineTypes: { $regex: /(Đồ uống|Trà sữa|Cà phê)/i } }
        ]
      };
    case 'saving':
      // Tiết kiệm / Bình dân: Cơm, bánh mì, bún, phở giá rẻ
      return {
        $or: [
          { 'menuItems.price': { $gt: 0, $lte: 40000 } },
          { 'menuItems.name': { $regex: /(cơm|bánh mì|xôi|bún|phở|tiết kiệm|bình dân)/i } }
        ]
      };
    case 'snack':
      // Ăn vặt / Xế chiều: Đồ ăn nhẹ, tráng miệng, bánh
      return {
        $or: [
          { 'menuItems.name': { $regex: /(ăn vặt|snack|chè|bánh|khoai tây|nem|trà sữa|kem|croissant|topping|gà rán|dimsum|xiên)/i } },
          { cuisineTypes: { $regex: /(Ăn vặt|Tráng miệng|Fast food|Bánh ngọt)/i } }
        ]
      };
    default:
      return null;
  }
}

/**
 * Projection chuẩn DTO cho 8 ô vòng quay
 */
const rouletteItemProjection = {
  $project: {
    _id: 0,
    menuItemId: { $toString: '$menuItems._id' },
    name: '$menuItems.name',
    price: '$menuItems.price',
    description: { $ifNull: ['$menuItems.description', ''] },
    image: { $ifNull: ['$menuItems.image', ''] },
    restaurantId: { $toString: '$_id' },
    restaurantName: '$name',
    restaurantAddress: { $ifNull: ['$address', ''] },
    restaurantImage: { $ifNull: ['$image', ''] },
    restaurantRating: { $ifNull: ['$rating', 0] }
  }
};

/**
 * Controller: Quay thưởng Vòng quay ẩm thực
 * POST /api/v1/restaurants/roulette/spin
 */
exports.spinRoulette = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tham gia vòng quay chọn món.'
      });
    }

    const { dateStr, resetAt, resetInSeconds } = getVietnamDateInfo();

    // 1. Kiểm tra giới hạn 3 lượt quay / ngày
    const existingLog = await RouletteSpinLog.findOne({ userId, dateStr });
    if (existingLog && existingLog.count >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã sử dụng hết 3/3 lượt quay hôm nay. Vui lòng quay lại vào ngày mai!',
        spinsRemaining: 0,
        maxSpins: 3,
        resetAt,
        resetInSeconds
      });
    }

    const budget = (req.body?.budget || 'all').toLowerCase();
    const mood = (req.body?.mood || 'all').toLowerCase();

    // 2. Tạo MongoDB Aggregation Pipeline
    const restaurantBaseMatch = {
      status: { $nin: ['BANNED', 'REJECTED', 'NOT_REGISTERED', 'LOCKED'] },
      'banInfo.isBanned': { $ne: true },
      $or: [
        { 'operatingStatus.isOpen': true },
        { 'operatingStatus.isOpen': { $exists: false } },
        { operatingStatus: { $exists: false } }
      ],
      'menuItems.0': { $exists: true }
    };

    const itemBaseMatch = {
      'menuItems.isAvailable': { $ne: false },
      ...buildBudgetCondition(budget)
    };

    const moodMatch = buildMoodCondition(mood);

    // Pipeline chính: Cả Budget + Mood
    const primaryPipeline = [
      { $match: restaurantBaseMatch },
      { $unwind: '$menuItems' },
      { $match: moodMatch ? { $and: [itemBaseMatch, moodMatch] } : itemBaseMatch },
      { $sample: { size: 8 } },
      rouletteItemProjection
    ];

    let items = await Restaurant.aggregate(primaryPipeline);

    // Fallback 1: Nếu chưa đủ 8 món (do mood lọc quá hẹp), lấy bổ sung theo chỉ riêng Budget
    if (!items || items.length < 8) {
      const fallbackBudgetPipeline = [
        { $match: restaurantBaseMatch },
        { $unwind: '$menuItems' },
        { $match: itemBaseMatch },
        { $sample: { size: 8 } },
        rouletteItemProjection
      ];
      const fallbackItems = await Restaurant.aggregate(fallbackBudgetPipeline);
      if (fallbackItems && fallbackItems.length > 0) {
        const existingIds = new Set((items || []).map((it) => it.menuItemId));
        for (const fbItem of fallbackItems) {
          if (!existingIds.has(fbItem.menuItemId)) {
            items.push(fbItem);
            existingIds.add(fbItem.menuItemId);
            if (items.length >= 8) break;
          }
        }
      }
    }

    // Fallback 2: Nếu môi trường dev/seed data có ít hơn 8 quán/món, lấy thêm từ bất kỳ món nào đang mở
    if (!items || items.length < 8) {
      const fallbackAllPipeline = [
        { $match: restaurantBaseMatch },
        { $unwind: '$menuItems' },
        { $match: { 'menuItems.isAvailable': { $ne: false }, 'menuItems.price': { $gt: 0 } } },
        { $sample: { size: 8 } },
        rouletteItemProjection
      ];
      const allActiveItems = await Restaurant.aggregate(fallbackAllPipeline);
      if (allActiveItems && allActiveItems.length > 0) {
        const existingIds = new Set((items || []).map((it) => it.menuItemId));
        for (const item of allActiveItems) {
          if (!existingIds.has(item.menuItemId)) {
            items.push(item);
            existingIds.add(item.menuItemId);
            if (items.length >= 8) break;
          }
        }
      }
    }

    // Fallback 3: Đảm bảo mảng luôn có đúng 8 phần tử cho vòng quay (nếu DB có < 8 món)
    if (!items || items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hiện không tìm thấy món ăn nào phù hợp với bộ lọc lúc này.'
      });
    }

    if (items.length < 8) {
      const originalLen = items.length;
      let padIndex = 0;
      while (items.length < 8) {
        const source = items[padIndex % originalLen];
        items.push({
          ...source,
          // Đảm bảo client có định danh duy nhất cho render
          displaySlotId: `slot_${items.length}`
        });
        padIndex++;
      }
    } else if (items.length > 8) {
      items = items.slice(0, 8);
    }

    // 3. Chọn ngẫu nhiên 1 món thắng (winnerIndex từ 0 đến 7)
    const winnerIndex = Math.floor(Math.random() * items.length);
    const winnerItem = items[winnerIndex];

    // 4. Sinh mã phiên quay và lưu RouletteSession có hiệu lực 5 phút
    const sessionId = `rsess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    const session = await RouletteSession.create({
      sessionId,
      userId,
      menuItemId: winnerItem.menuItemId,
      menuItemName: winnerItem.name,
      restaurantId: winnerItem.restaurantId,
      restaurantName: winnerItem.restaurantName,
      bonusType: 'DOUBLE_COINS',
      isUsed: false,
      expiresAt
    });

    // 5. Ghi nhận lượt quay vào RouletteSpinLog (Atomic increment)
    const spinRecord = {
      spunAt: new Date(),
      sessionId: session.sessionId,
      menuItemId: winnerItem.menuItemId,
      winnerIndex,
      budget,
      mood
    };

    let updatedLog;
    if (!existingLog) {
      updatedLog = await RouletteSpinLog.findOneAndUpdate(
        { userId, dateStr },
        {
          $setOnInsert: { userId, dateStr },
          $inc: { count: 1 },
          $push: { spins: spinRecord }
        },
        { upsert: true, new: true }
      );
    } else {
      updatedLog = await RouletteSpinLog.findOneAndUpdate(
        { userId, dateStr, count: { $lt: 3 } },
        {
          $inc: { count: 1 },
          $push: { spins: spinRecord }
        },
        { new: true }
      );

      // Nếu không update được do lượt quay đã chạm 3 trong race condition
      if (!updatedLog) {
        // Thu hồi session vừa tạo để không lãng phí
        await RouletteSession.deleteOne({ sessionId });
        return res.status(429).json({
          success: false,
          message: 'Bạn đã sử dụng hết 3/3 lượt quay hôm nay. Vui lòng quay lại vào ngày mai!',
          spinsRemaining: 0,
          maxSpins: 3,
          resetAt,
          resetInSeconds
        });
      }
    }

    const currentCount = updatedLog ? updatedLog.count : 1;
    const spinsRemaining = Math.max(0, 3 - currentCount);

    return res.status(200).json({
      success: true,
      data: {
        items,
        winnerIndex,
        winnerItem,
        sessionId: session.sessionId,
        bonusType: 'DOUBLE_COINS',
        expiresAt: session.expiresAt,
        spinsRemaining
      }
    });
  } catch (error) {
    console.error('[rouletteController] ❌ Lỗi spinRoulette:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi quay thưởng: ' + error.message
    });
  }
};

/**
 * Controller: Lấy trạng thái số lượt quay còn lại trong ngày
 * GET /api/v1/restaurants/roulette/status
 */
exports.getRouletteStatus = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để kiểm tra trạng thái lượt quay.'
      });
    }

    const { dateStr, resetAt, resetInSeconds } = getVietnamDateInfo();
    const log = await RouletteSpinLog.findOne({ userId, dateStr });
    const spinsUsed = log ? log.count : 0;
    const spinsRemaining = Math.max(0, 3 - spinsUsed);

    return res.status(200).json({
      success: true,
      data: {
        spinsRemaining,
        maxSpins: 3,
        spinsUsed,
        resetAt,
        resetInSeconds
      }
    });
  } catch (error) {
    console.error('[rouletteController] ❌ Lỗi getRouletteStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra trạng thái vòng quay: ' + error.message
    });
  }
};

/**
 * Controller: Tra cứu thông tin và tính hợp lệ của phiên quay thưởng
 * GET /api/v1/restaurants/roulette/session/:sessionId
 */
exports.getRouletteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu sessionId.'
      });
    }

    const session = await RouletteSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Phiên quay thưởng không tồn tại.'
      });
    }

    const now = new Date();
    const isExpired = now > new Date(session.expiresAt);
    const isValid = !session.isUsed && !isExpired;

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        userId: session.userId,
        menuItemId: session.menuItemId,
        menuItemName: session.menuItemName,
        restaurantId: session.restaurantId,
        restaurantName: session.restaurantName,
        bonusType: session.bonusType || 'DOUBLE_COINS',
        isUsed: session.isUsed,
        usedAt: session.usedAt,
        orderId: session.orderId,
        expiresAt: session.expiresAt,
        isValid,
        isExpired
      }
    });
  } catch (error) {
    console.error('[rouletteController] ❌ Lỗi getRouletteSession:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tra cứu phiên quay: ' + error.message
    });
  }
};

/**
 * Controller: Xác thực và tiêu thụ phiên quay thưởng khi tạo đơn hàng (Order Service gọi)
 * POST /api/v1/restaurants/roulette/session/:sessionId/consume
 */
exports.consumeRouletteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, orderId, menuItemId } = req.body || {};

    if (!sessionId || !userId || !orderId || !menuItemId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: sessionId, userId, orderId, menuItemId.'
      });
    }

    const cleanUserId = String(userId).trim();
    const cleanOrderId = String(orderId).trim();
    const cleanMenuItemId = String(menuItemId).trim();

    // Thực hiện Atomic Update: Chỉ cập nhật nếu phiên chưa dùng, chưa hết hạn, đúng user và đúng món
    const consumedSession = await RouletteSession.findOneAndUpdate(
      {
        sessionId,
        userId: cleanUserId,
        menuItemId: cleanMenuItemId,
        isUsed: false,
        expiresAt: { $gt: new Date() }
      },
      {
        $set: {
          isUsed: true,
          usedAt: new Date(),
          orderId: cleanOrderId
        }
      },
      { new: true }
    );

    if (consumedSession) {
      return res.status(200).json({
        success: true,
        message: 'Xác thực và áp dụng ưu đãi vòng quay thành công.',
        bonusType: consumedSession.bonusType || 'DOUBLE_COINS',
        data: {
          sessionId: consumedSession.sessionId,
          orderId: consumedSession.orderId,
          menuItemId: consumedSession.menuItemId,
          bonusType: consumedSession.bonusType || 'DOUBLE_COINS'
        }
      });
    }

    // Nếu không cập nhật được, kiểm tra lý do cụ thể để phản hồi chi tiết
    const existing = await RouletteSession.findOne({ sessionId });
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: 'SESSION_NOT_FOUND',
        message: 'Phiên quay thưởng không tồn tại.'
      });
    }

    if (existing.isUsed) {
      return res.status(400).json({
        success: false,
        code: 'SESSION_ALREADY_USED',
        message: 'Phiên quay thưởng này đã được sử dụng cho một đơn hàng khác.'
      });
    }

    if (new Date() > new Date(existing.expiresAt)) {
      return res.status(400).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'Phiên quay thưởng đã hết hạn (quá 5 phút).'
      });
    }

    if (existing.userId !== cleanUserId) {
      return res.status(403).json({
        success: false,
        code: 'USER_MISMATCH',
        message: 'Phiên quay thưởng không thuộc về tài khoản này.'
      });
    }

    if (existing.menuItemId !== cleanMenuItemId) {
      return res.status(400).json({
        success: false,
        code: 'ITEM_MISMATCH',
        message: 'Món ăn không khớp với món đã trúng thưởng trong vòng quay.'
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Không thể áp dụng phiên quay thưởng.'
    });
  } catch (error) {
    console.error('[rouletteController] ❌ Lỗi consumeRouletteSession:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tiêu thụ phiên quay: ' + error.message
    });
  }
};
