const mongoose = require('mongoose');

/**
 * RouletteSpinLog Model
 * Ghi nhận số lượt quay trong ngày (Múi giờ Việt Nam UTC+7, tối đa 3 lượt/ngày).
 */
const rouletteSpinLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    dateStr: {
      type: String,
      required: true,
      trim: true
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    },
    spins: [
      {
        spunAt: {
          type: Date,
          default: Date.now
        },
        sessionId: {
          type: String,
          default: ''
        },
        menuItemId: {
          type: String,
          default: ''
        },
        winnerIndex: {
          type: Number,
          default: 0
        },
        budget: {
          type: String,
          default: 'all'
        },
        mood: {
          type: String,
          default: 'all'
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Đảm bảo mỗi user chỉ có duy nhất 1 bản ghi đếm cho 1 ngày cụ thể
rouletteSpinLogSchema.index({ userId: 1, dateStr: 1 }, { unique: true });

module.exports = mongoose.model('RouletteSpinLog', rouletteSpinLogSchema);
