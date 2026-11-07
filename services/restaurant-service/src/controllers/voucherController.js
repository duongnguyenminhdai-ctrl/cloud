const Voucher = require('../models/Voucher');
const Restaurant = require('../models/Restaurant');
const { client, decrQuota, incrQuota, setQuota } = require('../../redis');

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

    return res.status(200).json({
      success: true,
      message: `Áp dụng mã [${voucher.code}] thành công! Bạn được giảm ${discountAmount.toLocaleString('vi-VN')} đ.`,
      data: {
        voucher_code: voucher.code,
        title: voucher.title,
        issuer_type: voucher.issuer_type,
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
 * Lấy danh sách voucher khả dụng (Shopee Style)
 */
exports.getVouchers = async (req, res) => {
  try {
    const { store_id } = req.query;
    const query = { is_active: true };

    if (store_id) {
      query.$or = [{ issuer_type: 'PLATFORM' }, { store_id }];
    } else {
      query.issuer_type = 'PLATFORM';
    }

    const vouchers = await Voucher.find(query).sort({ discount_value: -1 });

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
      discount_type,
      discount_value: Number(discount_value),
      max_discount_amount: max_discount_amount ? Number(max_discount_amount) : null,
      min_order_value: min_order_value ? Number(min_order_value) : 0,
      usage_limit: usage_limit ? Number(usage_limit) : 100,
      used_count: 0,
      end_date: end_date ? new Date(end_date) : null,
      is_active: true
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

