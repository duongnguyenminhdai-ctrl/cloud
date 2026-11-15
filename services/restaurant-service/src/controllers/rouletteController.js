const crypto = require('crypto');
const Restaurant = require('../models/Restaurant');
const RouletteSession = require('../models/RouletteSession');
const RouletteSpinLog = require('../models/RouletteSpinLog');
const RouletteConfig = require('../models/RouletteConfig');

/**
 * Danh sách món tiêu biểu mặc định (fallback tĩnh khi chưa có config trong DB)
 */
const FALLBACK_CONFIG_ITEMS = [
  { name: 'Bánh Mì Thịt Nướng', description: 'Bánh mì giòn nhân thịt nướng thơm', image: 'https://images.unsplash.com/photo-1549611016-3a70d82b5040?w=400&auto=format&fit=crop', priceRange: '25.000đ - 35.000đ', rarity: 'COMMON' },
  { name: 'Trà Sữa Trân Châu', description: 'Trà sữa trân châu ấm dẻo thơm ngon', image: 'https://images.unsplash.com/photo-1558857563-b37cf5290a1?w=400&auto=format&fit=crop', priceRange: '30.000đ - 45.000đ', rarity: 'COMMON' },
  { name: 'Bún Thịt Nướng Chả Giò', description: 'Bún thịt nướng kèm chả giò giòn rụm', image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&auto=format&fit=crop', priceRange: '40.000đ - 55.000đ', rarity: 'COMMON' },
  { name: 'Cơm Tấm Sườn Bì Chả', description: 'Cơm tấm sườn bì chả trứng ốp la', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop', priceRange: '45.000đ - 65.000đ', rarity: 'RARE' },
  { name: 'Phở Bò Tái Nạm Gầu', description: 'Phở bò truyền thống với nước dùng đậm đà', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&auto=format&fit=crop', priceRange: '55.000đ - 70.000đ', rarity: 'RARE' },
  { name: 'Hủ Tiếu Nam Vang', description: 'Hủ tiếu Nam Vang tôm mực tươi ngon', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop', priceRange: '45.000đ - 60.000đ', rarity: 'RARE' },
  { name: 'Gà Rán Giòn Cay', description: 'Gà rán giòn ướp sốt cay Hàn Quốc', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop', priceRange: '55.000đ - 85.000đ', rarity: 'RARE' },
  { name: 'Pizza Hải Sản', description: 'Pizza hải sản phong cách Ý thượng hạng', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop', priceRange: '79.000đ - 129.000đ', rarity: 'LEGENDARY' },
  { name: 'Lẩu Thái Hải Sản', description: 'Lẩu Thái chua cay hải sản tươi sống', image: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=400&auto=format&fit=crop', priceRange: '89.000đ - 150.000đ', rarity: 'LEGENDARY' },
  { name: 'Bít Tết Bò Mỹ', description: 'Bít tết bò Mỹ nướng medium-rare', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&auto=format&fit=crop', priceRange: '99.000đ - 180.000đ', rarity: 'LEGENDARY' },
  { name: 'Cơm Chay Nấm Kho', description: 'Cơm chay nấm kho tiêu tươi lành mạnh', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop', priceRange: '28.000đ - 40.000đ', rarity: 'COMMON' },
  { name: 'Mì Ramen Tonkotsu', description: 'Mì Ramen Nhật Bản nước dùng xương hầm đậm vị', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop', priceRange: '65.000đ - 95.000đ', rarity: 'RARE' }
];

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
 * Hàm helper kiểm tra độ tương đồng tên món ăn
 * - Normalize, lowercase, loại bỏ stop words & ký tự đặc biệt ngắn
 * - Trả về true nếu có ít nhất 1 keyword chính trùng nhau
 */
function nameSimilarityMatch(nameA, nameB) {
  if (!nameA || !nameB) return false;

  const STOP_WORDS = new Set([
    'và', 'với', 'có', 'của', 'cho', 'các', 'một', 'món', 'ăn', 'uống',
    'đặc', 'biệt', 'số', 'thêm', 'không', 'bao', 'gồm', 'size', 'phần',
    'combo', 'set', 'mix', 'the', 'and', 'with', 'or', 'in', 'of', 'a', 'an',
    'trúng', 'thưởng', 'quay'
  ]);

  const normalize = (str) => str
    .toLowerCase()
    .normalize('NFD')
    // Keep Vietnamese chars, letters, numbers, spaces
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

  // Also check partial match (one contains the other keyword)
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
 * Lấy danh sách config items (từ DB hoặc fallback tĩnh)
 */
async function getConfigItems() {
  try {
    const config = await RouletteConfig.findOne().sort({ updatedAt: -1 });
    if (config && config.items && config.items.length > 0) {
      const activeItems = config.items.filter(item => item.isActive !== false);
      if (activeItems.length > 0) {
        return activeItems.map(item => ({
          name: item.name,
          description: item.description || '',
          image: item.image || '',
          priceRange: item.priceRange || '',
          rarity: item.rarity || 'COMMON'
        }));
      }
    }
  } catch (err) {
    console.warn('[rouletteController] Không thể lấy RouletteConfig từ DB, dùng fallback:', err.message);
  }
  return FALLBACK_CONFIG_ITEMS;
}

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

    // 2. Lấy danh sách config items (từ DB hoặc fallback tĩnh)
    const configItems = await getConfigItems();

    // 3. Đảm bảo đủ 8 ô cho vòng quay
    let items = [...configItems];

    // Shuffle ngẫu nhiên
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    // Nếu ít hơn 8, pad thêm bằng cách lặp lại
    if (items.length < 8) {
      const originalLen = items.length;
      let padIndex = 0;
      while (items.length < 8) {
        items.push({ ...items[padIndex % originalLen], displaySlotId: `slot_${items.length}` });
        padIndex++;
      }
    } else if (items.length > 8) {
      items = items.slice(0, 8);
    }

    // 4. Chọn ngẫu nhiên 1 món thắng (winnerIndex từ 0 đến 7)
    const winnerIndex = Math.floor(Math.random() * items.length);
    const winnerItem = {
      name: items[winnerIndex].name,
      description: items[winnerIndex].description || '',
      image: items[winnerIndex].image || '',
      priceRange: items[winnerIndex].priceRange || '',
      rarity: items[winnerIndex].rarity || 'COMMON'
    };

    // 5. Sinh mã phiên quay và lưu RouletteSession có hiệu lực 10 phút
    const sessionId = `rsess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    const session = await RouletteSession.create({
      sessionId,
      userId,
      menuItemId: 'ANY',          // Không ràng buộc menuItemId cụ thể
      menuItemName: winnerItem.name,
      restaurantId: 'ANY',        // Không ràng buộc quán
      restaurantName: '',
      bonusType: 'DOUBLE_COINS',
      isUsed: false,
      expiresAt
    });

    // 6. Ghi nhận lượt quay vào RouletteSpinLog (Atomic increment)
    const spinRecord = {
      spunAt: new Date(),
      sessionId: session.sessionId,
      menuItemId: 'ANY',
      winnerIndex,
      budget: (req.body?.budget || 'all').toLowerCase(),
      mood: (req.body?.mood || 'all').toLowerCase()
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
 * Body: { userId, orderId, orderItemName } — backward-compatible: fallback sang menuItemId nếu không có orderItemName
 */
exports.consumeRouletteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, orderId, orderItemName, menuItemId } = req.body || {};

    if (!sessionId || !userId || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: sessionId, userId, orderId.'
      });
    }

    const cleanUserId = String(userId).trim();
    const cleanOrderId = String(orderId).trim();

    // 1. Tìm phiên quay thưởng
    const session = await RouletteSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        code: 'SESSION_NOT_FOUND',
        message: 'Phiên quay thưởng không tồn tại.'
      });
    }

    // 2. Kiểm tra tài khoản sở hữu
    if (session.userId !== cleanUserId) {
      return res.status(403).json({
        success: false,
        code: 'USER_MISMATCH',
        message: 'Phiên quay thưởng không thuộc về tài khoản này.'
      });
    }

    // 3. Kiểm tra đã sử dụng
    if (session.isUsed) {
      return res.status(400).json({
        success: false,
        code: 'SESSION_ALREADY_USED',
        message: 'Phiên quay thưởng này đã được sử dụng cho một đơn hàng khác.'
      });
    }

    // 4. Kiểm tra hết hạn (10 phút)
    if (new Date() > new Date(session.expiresAt)) {
      return res.status(400).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'Phiên quay thưởng đã hết hạn (quá 10 phút).'
      });
    }

    // Kiểm tra khớp tên món:
    // Ưu tiên orderItemName (tên tương tự), backward-compatible với menuItemId
    const isAnyRestaurant = session.restaurantId === 'ANY';
    const isAnyMenuItem = session.menuItemId === 'ANY';

    let itemMatched = false;

    if (orderItemName) {
      // Khớp tên tương tự
      itemMatched = nameSimilarityMatch(session.menuItemName, orderItemName);
    } else if (menuItemId) {
      // Backward-compatible: khớp menuItemId chính xác (chỉ khi không phải ANY)
      if (isAnyMenuItem) {
        itemMatched = true; // ANY = chấp nhận mọi món
      } else {
        itemMatched = session.menuItemId === String(menuItemId).trim();
      }
    } else {
      // Không có cả hai → trả lỗi
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin: cần cung cấp orderItemName hoặc menuItemId.'
      });
    }

    if (!itemMatched) {
      return res.status(400).json({
        success: false,
        code: 'ITEM_MISMATCH',
        message: `Món ăn không khớp với món đã trúng thưởng "${session.menuItemName}" trong vòng quay.`
      });
    }

    // Atomic update: đánh dấu đã dùng
    const consumedSession = await RouletteSession.findOneAndUpdate(
      {
        sessionId,
        userId: cleanUserId,
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

    if (!consumedSession) {
      // Race condition: session vừa bị consume bởi request khác
      return res.status(400).json({
        success: false,
        code: 'SESSION_ALREADY_USED',
        message: 'Phiên quay thưởng này đã được sử dụng.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Xác thực và áp dụng ưu đãi vòng quay thành công.',
      bonusType: consumedSession.bonusType || 'DOUBLE_COINS',
      data: {
        sessionId: consumedSession.sessionId,
        orderId: consumedSession.orderId,
        menuItemId: consumedSession.menuItemId,
        menuItemName: consumedSession.menuItemName,
        bonusType: consumedSession.bonusType || 'DOUBLE_COINS'
      }
    });
  } catch (error) {
    console.error('[rouletteController] ❌ Lỗi consumeRouletteSession:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tiêu thụ phiên quay: ' + error.message
    });
  }
};

/**
 * Controller: Lấy danh sách config hòm quay thưởng (public)
 * GET /api/v1/restaurants/roulette/config
 */
exports.getRouletteConfig = async (req, res) => {
  try {
    const items = await getConfigItems();
    return res.status(200).json({
      success: true,
      data: { items }
    });
  } catch (error) {
    console.error('[rouletteController] ❌ Lỗi getRouletteConfig:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy config hòm quay: ' + error.message
    });
  }
};

/**
 * Controller: Admin cập nhật danh sách config hòm quay thưởng
 * PUT /api/v1/restaurants/roulette/config
 * Yêu cầu: verifyToken + role ADMIN
 */
exports.updateRouletteConfig = async (req, res) => {
  try {
    // Kiểm tra quyền ADMIN (bổ sung phòng trường hợp không dùng requireAdmin middleware)
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Quyền truy cập bị từ chối. Chỉ dành riêng cho Quản trị viên (ADMIN).'
      });
    }

    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách items không hợp lệ.'
      });
    }

    const userId = getAuthenticatedUserId(req);

    // Validate từng item
    const validItems = items.map((item, idx) => {
      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        throw new Error(`Item #${idx + 1} thiếu trường name.`);
      }
      return {
        name: item.name.trim(),
        description: (item.description || '').trim(),
        image: (item.image || '').trim(),
        priceRange: (item.priceRange || '').trim(),
        rarity: ['COMMON', 'RARE', 'LEGENDARY'].includes(item.rarity) ? item.rarity : 'COMMON',
        isActive: item.isActive !== false,
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0
      };
    });

    // Upsert: tìm config đầu tiên hoặc tạo mới
    const existing = await RouletteConfig.findOne().sort({ updatedAt: -1 });
    let config;
    if (existing) {
      existing.items = validItems;
      existing.updatedBy = userId;
      config = await existing.save();
    } else {
      config = await RouletteConfig.create({ items: validItems, updatedBy: userId });
    }

    return res.status(200).json({
      success: true,
      data: { items: config.items }
    });
  } catch (error) {
    console.error('[rouletteController] ❌ Lỗi updateRouletteConfig:', error);
    return res.status(error.message.includes('thiếu') ? 400 : 500).json({
      success: false,
      message: 'Lỗi khi cập nhật config hòm quay: ' + error.message
    });
  }
};
