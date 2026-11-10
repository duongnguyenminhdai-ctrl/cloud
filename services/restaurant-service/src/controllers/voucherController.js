const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const Restaurant = require('../models/Restaurant');
const { client, decrQuota, incrQuota, setQuota } = require('../../redis');
const { broadcastAdminEvent, emitStoreUpdate } = require('../utils/realtimeHub');

function emitVoucherUpdate(action, voucher, store = null) {
  const storeId = voucher?.store_id ? String(voucher.store_id) : (store?._id ? String(store._id) : null);
  broadcastAdminEvent('voucher.updated', { action, code: voucher?.code, storeId });
  if (storeId) {
    emitStoreUpdate({
      store,
      storeId,
      event: 'voucher.updated',
      includePublic: true,
      extra: { action, code: voucher?.code }
    });
  }
}

/**
 * 1. Khởi tạo sẵn một số mã Voucher mẫu (Seed Data)
 */
async function seedDefaultVouchers() {
  try {
    const count = await Voucher.countDocuments();
    if (count === 0) {
      const defaultVouchers = [
        {
          code: 'FREESHIP50',
          title: 'Freeship 15.000đ cho đơn từ 50.000đ',
          issuer_type: 'PLATFORM',
          discount_type: 'FIXED_AMOUNT',
          discount_value: 15000,
          min_order_value: 50000,
          usage_limit: 500,
          used_count: 0,
          is_active: true
        },
        {
          code: 'QUANNGON20',
          title: 'Giảm 20% tối đa 40.000đ cho đơn từ 60.000đ',
          issuer_type: 'PLATFORM',
          discount_type: 'PERCENTAGE',
          discount_value: 20,
          max_discount_amount: 40000,
          min_order_value: 60000,
          usage_limit: 200,
          used_count: 0,
          is_active: true
        },
        {
          code: 'FOODFAST10',
          title: 'Giảm 10.000đ cho mọi đơn hàng',
          issuer_type: 'PLATFORM',
          discount_type: 'FIXED_AMOUNT',
          discount_value: 10000,
          min_order_value: 0,
          usage_limit: 1000,
          used_count: 0,
          is_active: true
        }
      ];

      for (const v of defaultVouchers) {
        await Voucher.create(v);
        await setQuota(`voucher:quota:${v.code}`, v.usage_limit);
      }
      console.log('[Voucher] 🎫 Đã khởi tạo 3 voucher mẫu mặc định vào Database & Redis!');
    }
  } catch (err) {
    console.warn('[Voucher] Lỗi seed voucher:', err.message);
  }
}

seedDefaultVouchers().catch(() => {});

/**
 * 2. POST /api/v1/vouchers/apply
 * Áp dụng mã giảm giá kèm Concurrency Control qua Redis DECR/INCR
 */
exports.applyVoucher = async (req, res) => {
  try {
    const { voucher_code, cart_total, store_id } = req.body;

    if (!voucher_code) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã voucher (voucher_code)'
      });
    }

    const total = Number(cart_total) || 0;
    const cleanCode = voucher_code.trim().toUpperCase();

    // 2.1 Tìm Voucher trong MongoDB
    const voucher = await Voucher.findOne({ code: cleanCode });
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: `Mã giảm giá "${cleanCode}" không tồn tại trên hệ thống.`
      });
    }

    // 2.2 Kiểm tra trạng thái hoạt động & thời hạn
    if (!voucher.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Mã giảm giá này hiện đang tạm khóa hoặc đã ngưng hoạt động.'
      });
    }

    const now = new Date();
    if (voucher.start_date && now < new Date(voucher.start_date)) {
      return res.status(400).json({
        success: false,
        message: 'Mã giảm giá này chưa đến ngày kích hoạt.'
      });
    }

    if (voucher.end_date && now > new Date(voucher.end_date)) {
      return res.status(400).json({
        success: false,
        message: 'Mã giảm giá này đã hết hạn sử dụng.'
      });
    }

    // 2.3 Kiểm tra giá trị đơn hàng tối thiểu
    if (voucher.min_order_value && total < voucher.min_order_value) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng tối thiểu phải từ ${voucher.min_order_value.toLocaleString('vi-VN')} đ để áp dụng mã này.`
      });
    }

    // 2.4 Kiểm tra quyền sở hữu nếu là voucher riêng của quán (STORE)
    if (voucher.issuer_type === 'STORE' && voucher.store_id) {
      if (!store_id || voucher.store_id.toString() !== store_id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Mã giảm giá này chỉ áp dụng cho quán ăn phát hành.'
        });
      }
    }

    // 2.5 Kiểm tra số lượng còn lại bằng Redis (Concurrency Control / Race Condition Prevention)
    const redisQuotaKey = `voucher:quota:${voucher.code}`;

    // Đảm bảo quota đã có trong Redis
    if (client && client.isOpen) {
      const exists = await client.exists(redisQuotaKey);
      if (!exists) {
        const initialQuota = Math.max(0, voucher.usage_limit - voucher.used_count);
        await setQuota(redisQuotaKey, initialQuota);
      }

      // Thao tác nguyên tử DECR
      const remaining = await decrQuota(redisQuotaKey);
      if (remaining !== null && remaining < 0) {
        // Quota đã cạn -> Hoàn trả lại số đã trừ (Rollback)
        await incrQuota(redisQuotaKey);
        return res.status(400).json({
          success: false,
          message: `Mã giảm giá "${cleanCode}" đã hết lượt sử dụng!`
        });
      }
    } else {
      // Fallback về kiểm tra Database khi Redis offline
      if (voucher.used_count >= voucher.usage_limit) {
        return res.status(400).json({
          success: false,
          message: `Mã giảm giá "${cleanCode}" đã hết lượt sử dụng!`
        });
      }
    }

    // 2.6 Tính toán số tiền chiết khấu
    let discountAmount = 0;
    if (voucher.discount_type === 'PERCENTAGE') {
      discountAmount = Math.round((total * voucher.discount_value) / 100);
      if (voucher.max_discount_amount && discountAmount > voucher.max_discount_amount) {
        discountAmount = voucher.max_discount_amount;
      }
    } else if (voucher.discount_type === 'FIXED_AMOUNT') {
      discountAmount = voucher.discount_value;
    }

    // Không được giảm quá tổng tiền giỏ hàng
    discountAmount = Math.min(discountAmount, total);
    const finalTotal = Math.max(0, total - discountAmount);

    // Cập nhật số lượt dùng trong MongoDB
    await Voucher.updateOne({ _id: voucher._id }, { $inc: { used_count: 1 } });
    emitVoucherUpdate('applied', voucher);

    return res.status(200).json({
      success: true,
      message: `Áp dụng mã [${voucher.code}] thành công! Bạn được giảm ${discountAmount.toLocaleString('vi-VN')} đ.`,
      data: {
        voucher_code: voucher.code,
        title: voucher.title,
        issuer_type: voucher.issuer_type,
        store_id: voucher.store_id || null,
        discount_type: voucher.discount_type,
        discount_value: voucher.discount_value,
        discount_amount: discountAmount,
        original_total: total,
        final_total: finalTotal
      }
    });
  } catch (error) {
    console.error('[Voucher] ❌ Lỗi áp dụng voucher:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi áp dụng mã giảm giá: ' + error.message
    });
  }
};

/**
 * 3. GET /api/v1/vouchers
 * Lấy danh sách voucher khả dụng (Gồm Voucher Sàn PLATFORM & Voucher Quán STORE nếu truyền store_id)
 */
exports.getVouchers = async (req, res) => {
  try {
    const { store_id } = req.query;
    const now = new Date();
    const validStoreObjectId = store_id && mongoose.Types.ObjectId.isValid(store_id) ? store_id : null;

    const query = {
      is_active: true,
      $and: [
        { $or: [{ end_date: null }, { end_date: { $gte: now } }] },
        validStoreObjectId
          ? { $or: [{ issuer_type: 'PLATFORM' }, { issuer_type: 'STORE', store_id: validStoreObjectId }] }
          : { issuer_type: 'PLATFORM' }
      ]
    };

    const vouchers = await Voucher.find(query).sort({ issuer_type: -1, discount_value: -1 });

    return res.status(200).json({
      success: true,
      count: vouchers.length,
      data: vouchers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách voucher: ' + error.message
    });
  }
};

/**
 * 4. POST /api/v1/vouchers (Admin hoặc Quán tạo mới mã)
 */
exports.createVoucher = async (req, res) => {
  try {
    const {
      code,
      title,
      issuer_type,
      store_id,
      discount_type,
      discount_value,
      max_discount_amount,
      min_order_value,
      usage_limit,
      end_date
    } = req.body;

    if (!code || !discount_type || discount_value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: code, discount_type, discount_value'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await Voucher.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã voucher [${cleanCode}] đã tồn tại!`
      });
    }

    const newVoucher = new Voucher({
      code: cleanCode,
      title: title || `Giảm ${discount_value}${discount_type === 'PERCENTAGE' ? '%' : 'đ'}`,
      issuer_type: issuer_type || 'PLATFORM',
      store_id: store_id || null,
      city_code: (req.body.city_code || 'ALL').toLowerCase().trim(),
      discount_type,
      discount_value: Number(discount_value),
      max_discount_amount: max_discount_amount ? Number(max_discount_amount) : null,
      min_order_value: min_order_value ? Number(min_order_value) : 0,
      usage_limit: usage_limit ? Number(usage_limit) : 100,
      used_count: 0,
      start_date: req.body.start_date ? new Date(req.body.start_date) : Date.now(),
      end_date: end_date ? new Date(end_date) : null,
      is_active: req.body.is_active !== false
    });

    const saved = await newVoucher.save();
    await setQuota(`voucher:quota:${cleanCode}`, saved.usage_limit);

    return res.status(201).json({
      success: true,
      message: 'Tạo mã voucher thành công!',
      data: saved
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tạo voucher: ' + error.message
    });
  }
};

/**
 * =============================================================================
 * ADMIN VOUCHER MANAGEMENT CONTROLLERS
 * =============================================================================
 */

// 5. GET /api/v1/admin/vouchers - Lấy danh sách Voucher toàn hệ thống
exports.adminGetVouchers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const {
      search,
      issuer_type,
      is_active,
      city_code,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { code: { $regex: cleanSearch, $options: 'i' } },
        { title: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    if (issuer_type && issuer_type !== 'ALL') {
      query.issuer_type = issuer_type;
    }

    if (is_active !== undefined && is_active !== 'ALL') {
      query.is_active = is_active === 'true' || is_active === true;
    }

    if (city_code && city_code !== 'ALL') {
      query.$or = [{ city_code: city_code.toLowerCase().trim() }, { city_code: 'ALL' }];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [vouchers, total] = await Promise.all([
      Voucher.find(query)
        .populate('store_id', 'name address phone city city_code image')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Voucher.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      count: vouchers.length,
      data: vouchers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('[voucherController] ❌ Lỗi lấy danh sách voucher admin:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách voucher: ' + error.message
    });
  }
};

// 6. POST /api/v1/admin/vouchers - Admin tạo Voucher mới & Đồng bộ Redis
exports.adminCreateVoucher = async (req, res) => {
  try {
    const {
      code,
      title,
      issuer_type = 'PLATFORM',
      store_id,
      discount_type,
      discount_value,
      max_discount_amount,
      min_order_value = 0,
      usage_limit = 500,
      city_code = 'ALL',
      start_date,
      end_date,
      is_active = true
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã voucher (code)'
      });
    }

    if (!discount_type || !['PERCENTAGE', 'FIXED_AMOUNT'].includes(discount_type)) {
      return res.status(400).json({
        success: false,
        message: 'Loại giảm giá không hợp lệ (PERCENTAGE hoặc FIXED_AMOUNT)'
      });
    }

    const numValue = Number(discount_value);
    if (isNaN(numValue) || numValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá trị giảm giá phải lớn hơn 0'
      });
    }

    if (discount_type === 'PERCENTAGE' && numValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Giảm giá phần trăm không được vượt quá 100%'
      });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const existing = await Voucher.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã voucher [${cleanCode}] đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`
      });
    }

    const numLimit = Math.max(1, parseInt(usage_limit) || 100);

    const newVoucher = new Voucher({
      code: cleanCode,
      title: title && title.trim() ? title.trim() : `Mã giảm ${numValue}${discount_type === 'PERCENTAGE' ? '%' : 'đ'}`,
      issuer_type: issuer_type === 'STORE' ? 'STORE' : 'PLATFORM',
      store_id: issuer_type === 'STORE' ? (store_id || null) : null,
      discount_type,
      discount_value: numValue,
      max_discount_amount: (discount_type === 'PERCENTAGE' && max_discount_amount) ? Number(max_discount_amount) : null,
      min_order_value: min_order_value ? Math.max(0, Number(min_order_value)) : 0,
      usage_limit: numLimit,
      used_count: 0,
      city_code: (city_code || 'ALL').toLowerCase().trim(),
      start_date: start_date ? new Date(start_date) : new Date(),
      end_date: end_date ? new Date(end_date) : null,
      is_active: is_active !== false
    });

    const saved = await newVoucher.save();

    // Đồng bộ ngay lập tức với Redis để chống Race Condition
    await setQuota(`voucher:quota:${cleanCode}`, numLimit);
    console.log(`[voucherController] ⚡ Đã tạo voucher [${cleanCode}] và đồng bộ quota Redis [voucher:quota:${cleanCode} = ${numLimit}]`);
    emitVoucherUpdate('created', saved);

    return res.status(201).json({
      success: true,
      message: `Tạo voucher [${cleanCode}] thành công và đã đồng bộ với Redis!`,
      data: saved
    });
  } catch (error) {
    console.error('[voucherController] ❌ Lỗi tạo voucher admin:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo voucher: ' + error.message
    });
  }
};

// 7. PUT /api/v1/admin/vouchers/:id - Cập nhật thông tin Voucher
exports.adminUpdateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      discount_type,
      discount_value,
      max_discount_amount,
      min_order_value,
      usage_limit,
      city_code,
      start_date,
      end_date,
      is_active
    } = req.body;

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });
    }

    if (title !== undefined) voucher.title = title.trim();
    if (discount_type && ['PERCENTAGE', 'FIXED_AMOUNT'].includes(discount_type)) {
      voucher.discount_type = discount_type;
    }
    if (discount_value !== undefined && Number(discount_value) > 0) {
      voucher.discount_value = Number(discount_value);
    }
    if (max_discount_amount !== undefined) {
      voucher.max_discount_amount = max_discount_amount ? Number(max_discount_amount) : null;
    }
    if (min_order_value !== undefined) {
      voucher.min_order_value = Math.max(0, Number(min_order_value));
    }
    if (usage_limit !== undefined) {
      const newLimit = Math.max(1, parseInt(usage_limit) || 100);
      voucher.usage_limit = newLimit;
      const remaining = Math.max(0, newLimit - voucher.used_count);
      await setQuota(`voucher:quota:${voucher.code}`, remaining);
    }
    if (city_code !== undefined) {
      voucher.city_code = (city_code || 'ALL').toLowerCase().trim();
    }
    if (start_date !== undefined) {
      voucher.start_date = start_date ? new Date(start_date) : new Date();
    }
    if (end_date !== undefined) {
      voucher.end_date = end_date ? new Date(end_date) : null;
    }
    if (is_active !== undefined) {
      voucher.is_active = Boolean(is_active);
    }

    await voucher.save();
    emitVoucherUpdate('updated', voucher);

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật mã voucher [${voucher.code}] thành công!`,
      data: voucher
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật voucher: ' + error.message });
  }
};

// 8. PATCH/PUT /api/v1/admin/vouchers/:id/toggle - Bật/Tắt kích hoạt Voucher
exports.adminToggleVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher' });
    }

    voucher.is_active = !voucher.is_active;
    await voucher.save();
    emitVoucherUpdate('toggled', voucher);

    return res.status(200).json({
      success: true,
      message: `Đã ${voucher.is_active ? 'kích hoạt' : 'tạm ngưng'} mã voucher [${voucher.code}] thành công!`,
      data: voucher
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi chuyển trạng thái voucher: ' + error.message });
  }
};

// 9. DELETE /api/v1/admin/vouchers/:id - Xóa Voucher & Dọn sạch Redis Cache
exports.adminDeleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher để xóa' });
    }

    const code = voucher.code;
    await Voucher.findByIdAndDelete(id);
    emitVoucherUpdate('deleted', voucher);

    // Dọn sạch key trong Redis Cache
    if (client && client.isOpen) {
      try {
        await client.del(`voucher:quota:${code}`);
        console.log(`[voucherController] 🧹 Đã dọn dẹp Redis key [voucher:quota:${code}]`);
      } catch (redisErr) {
        console.warn(`[voucherController] Lỗi xóa key Redis [voucher:quota:${code}]:`, redisErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Đã xóa mã voucher [${code}] và dọn sạch Redis Cache thành công!`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa voucher: ' + error.message });
  }
};

/**
 * =============================================================================
 * MERCHANT SELF-SERVICE VOUCHER MANAGEMENT CONTROLLERS (CHO HỘ KINH DOANH / QUÁN)
 * Quy tắc FoodFast Partner:
 * - Không thu phí khởi tạo, không giam tiền trước khi khách chưa đặt đơn thành công.
 * - Mã tạo mặc định issuer_type = 'STORE', gắn với store_id của quán.
 * - Khi có đơn thành công áp mã, tiền giảm sẽ trừ trực tiếp vào doanh thu tính thuế & chiết khấu của đơn đó.
 * =============================================================================
 */

// 10. GET /api/v1/stores/my-store/vouchers - Lấy danh sách voucher riêng của Quán
exports.merchantGetVouchers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng của bạn.' });
    }

    const vouchers = await Voucher.find({
      store_id: store._id,
      issuer_type: 'STORE'
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: vouchers.length,
      data: vouchers,
      storeMeta: {
        storeId: store._id,
        storeName: store.name,
        merchantType: store.merchantType || 'HOUSEHOLD',
        commissionRate: store.commissionRate ?? 0.25
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải danh sách voucher của quán: ' + error.message
    });
  }
};

// 11. POST /api/v1/stores/my-store/vouchers - Chủ quán tự tạo Voucher khuyến mãi (0đ phí khởi tạo)
exports.merchantCreateVoucher = async (req, res) => {
  try {
    const userId = req.user.userId;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng của bạn.' });
    }

    const {
      code,
      title,
      discount_type,
      discount_value,
      max_discount_amount,
      min_order_value = 0,
      usage_limit = 100,
      start_date,
      end_date,
      is_active = true
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã voucher!' });
    }
    if (!discount_type || !['PERCENTAGE', 'FIXED_AMOUNT'].includes(discount_type)) {
      return res.status(400).json({ success: false, message: 'Loại giảm giá phải là PERCENTAGE hoặc FIXED_AMOUNT.' });
    }

    const numValue = Number(discount_value);
    if (isNaN(numValue) || numValue <= 0) {
      return res.status(400).json({ success: false, message: 'Giá trị giảm phải lớn hơn 0.' });
    }
    if (discount_type === 'PERCENTAGE' && numValue > 100) {
      return res.status(400).json({ success: false, message: 'Phần trăm giảm không được vượt quá 100%.' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Mã voucher chỉ được chứa chữ cái không dấu, số, _ hoặc -.' });
    }

    const existing = await Voucher.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã voucher [${cleanCode}] đã tồn tại trên hệ thống. Vui lòng chọn mã khác.`
      });
    }

    const numLimit = Math.max(1, parseInt(usage_limit) || 100);

    const newVoucher = new Voucher({
      code: cleanCode,
      title:
        title && title.trim()
          ? title.trim()
          : `Ưu đãi quán ${store.name}: Giảm ${numValue}${discount_type === 'PERCENTAGE' ? '%' : 'đ'}`,
      issuer_type: 'STORE',
      store_id: store._id,
      city_code: store.city_code || 'all',
      discount_type,
      discount_value: numValue,
      max_discount_amount:
        discount_type === 'PERCENTAGE' && max_discount_amount ? Number(max_discount_amount) : null,
      min_order_value: Math.max(0, Number(min_order_value) || 0),
      usage_limit: numLimit,
      used_count: 0,
      start_date: start_date ? new Date(start_date) : new Date(),
      end_date: end_date ? new Date(end_date) : null,
      is_active: is_active !== false
    });

    const saved = await newVoucher.save();
    await setQuota(`voucher:quota:${cleanCode}`, numLimit);
    emitVoucherUpdate('created', saved, store);

    return res.status(201).json({
      success: true,
      message: `Tạo voucher quán [${cleanCode}] thành công! Không thu phí khởi tạo – chỉ trừ doanh thu khi có đơn đặt thành công.`,
      data: saved
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tạo voucher quán: ' + error.message
    });
  }
};

// 12. PUT /api/v1/stores/my-store/vouchers/:voucherId - Chủ quán cập nhật Voucher của mình
exports.merchantUpdateVoucher = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { voucherId } = req.params;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    const voucher = await Voucher.findOne({
      _id: voucherId,
      store_id: store._id,
      issuer_type: 'STORE'
    });
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher thuộc quyền sở hữu của quán.' });
    }

    const {
      title,
      discount_type,
      discount_value,
      max_discount_amount,
      min_order_value,
      usage_limit,
      start_date,
      end_date,
      is_active
    } = req.body;

    if (title !== undefined) voucher.title = title.trim();
    if (discount_type && ['PERCENTAGE', 'FIXED_AMOUNT'].includes(discount_type)) {
      voucher.discount_type = discount_type;
    }
    if (discount_value !== undefined && Number(discount_value) > 0) {
      voucher.discount_value = Number(discount_value);
    }
    if (max_discount_amount !== undefined) {
      voucher.max_discount_amount = max_discount_amount ? Number(max_discount_amount) : null;
    }
    if (min_order_value !== undefined) {
      voucher.min_order_value = Math.max(0, Number(min_order_value));
    }
    if (usage_limit !== undefined) {
      const newLimit = Math.max(1, parseInt(usage_limit) || 100);
      voucher.usage_limit = newLimit;
      const remaining = Math.max(0, newLimit - voucher.used_count);
      await setQuota(`voucher:quota:${voucher.code}`, remaining);
    }
    if (start_date !== undefined) {
      voucher.start_date = start_date ? new Date(start_date) : new Date();
    }
    if (end_date !== undefined) {
      voucher.end_date = end_date ? new Date(end_date) : null;
    }
    if (is_active !== undefined) {
      voucher.is_active = Boolean(is_active);
    }

    await voucher.save();
    emitVoucherUpdate('updated', voucher, store);

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật voucher [${voucher.code}] thành công!`,
      data: voucher
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật voucher: ' + error.message });
  }
};

// 13. PATCH /api/v1/stores/my-store/vouchers/:voucherId/toggle - Bật/tắt voucher của quán
exports.merchantToggleVoucher = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { voucherId } = req.params;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    const voucher = await Voucher.findOne({
      _id: voucherId,
      store_id: store._id,
      issuer_type: 'STORE'
    });
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher thuộc quyền sở hữu của quán.' });
    }

    voucher.is_active = !voucher.is_active;
    await voucher.save();
    emitVoucherUpdate('toggled', voucher, store);

    return res.status(200).json({
      success: true,
      message: `Đã ${voucher.is_active ? 'kích hoạt' : 'tạm ngưng'} voucher [${voucher.code}]!`,
      data: voucher
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi chuyển trạng thái voucher: ' + error.message });
  }
};

// 14. DELETE /api/v1/stores/my-store/vouchers/:voucherId - Xóa voucher của quán
exports.merchantDeleteVoucher = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { voucherId } = req.params;
    const store = await Restaurant.findOne({ ownerId: userId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    const voucher = await Voucher.findOne({
      _id: voucherId,
      store_id: store._id,
      issuer_type: 'STORE'
    });
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher thuộc quyền sở hữu của quán.' });
    }

    const code = voucher.code;
    await Voucher.findByIdAndDelete(voucher._id);
    emitVoucherUpdate('deleted', voucher, store);

    if (client && client.isOpen) {
      try {
        await client.del(`voucher:quota:${code}`);
      } catch {}
    }

    return res.status(200).json({
      success: true,
      message: `Đã xóa mã voucher [${code}] thành công!`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa voucher: ' + error.message });
  }
};

