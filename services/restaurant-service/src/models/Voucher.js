const mongoose = require('mongoose');

// Schema Mã giảm giá / Voucher (Chuẩn FoodFast Style)
const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã voucher không được để trống'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    title: {
      type: String,
      trim: true,
      default: ''
    },
    issuer_type: {
      type: String,
      enum: ['PLATFORM', 'STORE'],
      default: 'PLATFORM',
      required: true
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
      index: true
    },
    discount_type: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
      required: [true, 'Loại giảm giá không được để trống']
    },
    discount_value: {
      type: Number,
      required: [true, 'Giá trị giảm không được để trống'],
      min: [0, 'Giá trị giảm phải lớn hơn hoặc bằng 0']
    },
    max_discount_amount: {
      type: Number,
      default: null,
      min: 0
    },
    min_order_value: {
      type: Number,
      default: 0,
      min: 0
    },
    usage_limit: {
      type: Number,
      default: 100,
      min: 0
    },
    used_count: {
      type: Number,
      default: 0,
      min: 0
    },
    city_code: {
      type: String,
      default: 'ALL',
      trim: true,
      lowercase: true,
      index: true
    },
    start_date: {
      type: Date,
      default: Date.now
    },
    end_date: {
      type: Date,
      default: null
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true
    },
    user_id: {
      type: String,
      default: null,
      index: true // Voucher đích danh được tặng riêng cho khách hàng
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Voucher', voucherSchema);

