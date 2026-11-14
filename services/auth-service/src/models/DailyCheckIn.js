const mongoose = require('mongoose');

// Schema Điểm danh nhận Xu hàng ngày & Quà theo mốc (Phong cách Truy Kích / FoodFast)
const dailyCheckInSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId không được để trống'],
      index: true
    },
    monthYear: {
      type: String,
      required: [true, 'monthYear không được để trống'], // Định dạng: 'YYYY-MM' (ví dụ: '2026-11')
      trim: true,
      index: true
    },
    checkedInDays: {
      type: [Number],
      default: [] // Mảng các ngày trong tháng đã điểm danh (ví dụ: [1, 2, 3, 14, 15])
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    highestStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    lastCheckInDate: {
      type: Date,
      default: null
    },
    claimedMilestones: {
      type: [Number],
      default: [] // Các mốc ngày đã nhận thưởng trong tháng: [3, 7, 14, 25]
    },
    totalCoinsEarned: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Một tài khoản chỉ có duy nhất 1 bản ghi điểm danh cho mỗi tháng
dailyCheckInSchema.index({ userId: 1, monthYear: 1 }, { unique: true });

module.exports = mongoose.model('DailyCheckIn', dailyCheckInSchema);
