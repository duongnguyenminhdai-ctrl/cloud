const mongoose = require('mongoose');

const customerNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    orderId: {
      type: String,
      required: true,
      index: true
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true
    },
    storeName: {
      type: String,
      required: true,
      trim: true
    },
    storeImage: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      enum: ['ORDER_REVIEW_PROMPT', 'SYSTEM', 'COINS_REWARD'],
      default: 'ORDER_REVIEW_PROMPT'
    },
    title: {
      type: String,
      default: 'Đơn hàng đã giao thành công!'
    },
    content: {
      type: String,
      required: true
    },
    rewardCoins: {
      type: Number,
      default: 1000
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày (1 tuần)
      index: { expireAfterSeconds: 0 } // MongoDB TTL Index: tự động xóa sau khi hết hạn 7 ngày
    }
  },
  {
    timestamps: true
  }
);

// Hợp nhất index truy vấn nhanh cho chuông thông báo người dùng
customerNotificationSchema.index({ userId: 1, isCompleted: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerNotification', customerNotificationSchema);

