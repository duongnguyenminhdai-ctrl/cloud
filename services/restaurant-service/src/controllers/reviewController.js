const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const { publishEvent } = require('../rabbitmq');
const { invalidateRestaurantCache } = require('../../redis');

/**
 * 1. POST /api/v1/reviews
 * Khách hàng gửi đánh giá quán ăn & Bắn sự kiện RabbitMQ review.submitted
 */
exports.createReview = async (req, res) => {
  try {
    const { order_id, store_id, rating, comment, userName } = req.body;
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.user_id || 'guest_user';
    const authorName = (req.user && req.user.name) || userName || 'Khách hàng FoodFast';

    if (!order_id || !store_id || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: order_id, store_id, rating (1-5 sao)'
      });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Điểm đánh giá phải từ 1 đến 5 sao.'
      });
    }

    // 1.1 Kiểm tra trùng lặp đánh giá trên cùng một đơn hàng
    const existing = await Review.findOne({ order_id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng này đã được gửi đánh giá trước đó.'
      });
    }

    // 1.2 Lưu Review vào MongoDB
    const newReview = new Review({
      order_id,
      user_id: userId,
      userName: authorName,
      store_id,
      rating: numRating,
      comment: comment ? comment.trim() : ''
    });

    const savedReview = await newReview.save();

    // 1.3 Cập nhật điểm Rating trung bình & số lượng đánh giá của Nhà hàng
    const storeReviews = await Review.find({ store_id });
    if (storeReviews.length > 0) {
      const avgRating = (storeReviews.reduce((sum, r) => sum + r.rating, 0) / storeReviews.length).toFixed(1);
      await Restaurant.findByIdAndUpdate(store_id, {
        rating: Number(avgRating),
        review_count: storeReviews.length
      });
      await invalidateRestaurantCache(store_id.toString());
    }

    // 1.4 Event-Driven: Đẩy sự kiện review.submitted vào RabbitMQ (Exchange: foodfast_events)
    const eventPayload = {
      review_id: savedReview._id.toString(),
      order_id,
      user_id: userId,
      store_id: store_id.toString(),
      rating: numRating,
      comment: savedReview.comment,
      timestamp: Date.now()
    };

    // Bắn sự kiện lên cả exchange foodfast_events và food_order_topic
    try {
      await publishEvent('foodfast_events', 'review.submitted', eventPayload);
    } catch (pubErr) {
      console.warn('[Review] ⚠️ Không thể publish event foodfast_events, thử exchange mặc định:', pubErr.message);
      await publishEvent(undefined, 'review.submitted', eventPayload).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi đánh giá món ăn thành công! Hệ thống đang xử lý ưu đãi cho bạn.',
      data: savedReview
    });
  } catch (error) {
    console.error('[Review] ❌ Lỗi tạo đánh giá:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo đánh giá: ' + error.message
    });
  }
};

/**
 * 2. GET /api/v1/reviews/store/:storeId
 * Lấy danh sách đánh giá của một quán ăn
 */
exports.getStoreReviews = async (req, res) => {
  try {
    const { storeId } = req.params;
    const reviews = await Review.find({ store_id: storeId }).sort({ createdAt: -1 }).limit(50);

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách đánh giá quán: ' + error.message
    });
  }
};

