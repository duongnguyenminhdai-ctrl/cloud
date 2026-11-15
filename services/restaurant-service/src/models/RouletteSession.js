const mongoose = require('mongoose');

/**
 * RouletteSession Model
 * Lưu trữ phiên quay thưởng "Hôm nay ăn gì?" (Decision Roulette).
 * Mỗi phiên có hiệu lực 5 phút để hoàn tất đặt đơn nhận ưu đãi (x2 Xu FoodFast).
 */
const rouletteSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    menuItemId: {
      type: String,
      required: true,
      trim: true
    },
    menuItemName: {
      type: String,
      default: '',
      trim: true
    },
    restaurantId: {
      type: String,
      required: true,
      trim: true
    },
    restaurantName: {
      type: String,
      default: '',
      trim: true
    },
    bonusType: {
      type: String,
      default: 'DOUBLE_COINS'
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    orderId: {
      type: String,
      default: null,
      trim: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// TTL Index tự động dọn dẹp bản ghi sau 3600s (1 giờ) kể từ khi hết hạn
rouletteSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('RouletteSession', rouletteSessionSchema);
