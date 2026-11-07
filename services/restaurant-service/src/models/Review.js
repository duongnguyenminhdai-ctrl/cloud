const mongoose = require('mongoose');

// Schema Đánh giá & Nhận xét quán ăn (Review)
const reviewSchema = new mongoose.Schema(
  {
    order_id: {
      type: String,
      required: [true, 'order_id không được để trống'],
      unique: true,
      index: true
    },
    user_id: {
      type: String,
      required: [true, 'user_id không được để trống'],
      index: true
    },
    userName: {
      type: String,
      trim: true,
      default: 'Khách hàng FoodFast'
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'store_id không được để trống'],
      index: true
    },
    rating: {
      type: Number,
      required: [true, 'Điểm đánh giá không được để trống'],
      min: [1, 'Đánh giá tối thiểu 1 sao'],
      max: [5, 'Đánh giá tối đa 5 sao']
    },
    comment: {
      type: String,
      trim: true,
      default: ''
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Review', reviewSchema);
