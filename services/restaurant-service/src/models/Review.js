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
    userAvatar: {
      type: String,
      default: ''
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
    // Tiêu chí đánh giá cụ thể (chuẩn Shopee Food)
    criteria: {
      taste: { type: String, default: 'Tuyệt vời' }, // Hương vị món ăn: Tuyệt vời | Ngon miệng | Tạm ổn | Chưa ngon
      packaging: { type: String, default: 'Cẩn thận, sạch sẽ' }, // Đóng gói & nhiệt độ: Cẩn thận, sạch sẽ | Nóng hổi | Bình thường
      deliverySpeed: { type: String, default: 'Giao siêu tốc' } // Thời gian giao & phục vụ: Giao siêu tốc | Đúng giờ | Hơi chậm
    },
    comment: {
      type: String,
      trim: true,
      default: ''
    },
    // Danh sách hình ảnh chụp món ăn do khách hàng tải lên
    images: {
      type: [String],
      default: []
    },
    // Thông tin món ăn trong đơn hàng đã mua
    purchasedItem: {
      name: { type: String, default: '' },
      image: { type: String, default: '' },
      options: { type: String, default: '' } // Phân loại hàng / Size / Topping
    },
    // Số lượt thích & Danh sách khách hàng đã nhấn "Hữu ích" (Shopee Style)
    likes: {
      type: Number,
      default: 0
    },
    likedUsers: {
      type: [String],
      default: []
    },
    // Phản hồi từ Chủ quán ăn / Người bán
    sellerReply: {
      comment: { type: String, default: '' },
      repliedAt: { type: Date, default: null }
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

