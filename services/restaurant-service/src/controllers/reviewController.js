const mongoose = require('mongoose');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const CustomerNotification = require('../models/CustomerNotification');
const { publishEvent } = require('../rabbitmq');
const { invalidateRestaurantCache } = require('../../redis');
const { emitStoreUpdate, emitUserEvent } = require('../utils/realtimeHub');

/**
 * Hàm hỗ trợ cộng 1.000 Xu cho người dùng (Thực hiện trực tiếp trên Atlas auth_db hoặc qua API)
 */
async function creditUserCoins(userId, amount = 1000, reason = 'REVIEW_REWARD', orderId = null) {
  if (process.env.NODE_ENV === 'test') {
    return 1000;
  }
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const authDb = mongoose.connection.useDb('auth_db');
      const usersCol = authDb.collection('users');
      const query = mongoose.isValidObjectId(userId) ? { _id: new mongoose.Types.ObjectId(userId) } : { _id: userId };
      const updated = await usersCol.findOneAndUpdate(
        query,
        { $inc: { coins: amount } },
        { returnDocument: 'after' }
      );
      if (updated && (updated.value?.coins !== undefined || updated.coins !== undefined)) {
        return updated.value?.coins ?? updated.coins;
      }
    }
  } catch (dbErr) {
    console.warn('[Review] Cập nhật coins trực tiếp qua DB thất bại, fallback sang API:', dbErr.message);
  }

  try {
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3005';
    const resp = await fetch(`${authUrl}/api/v1/auth/coins/reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount, reason, orderId })
    });
    const data = await resp.json();
    if (data && data.success) {
      return data.coins;
    }
  } catch (apiErr) {
    console.warn('[Review] Gọi API cộng xu auth-service thất bại:', apiErr.message);
  }
  return null;
}

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

    // 1.2 Kiểm tra thời hạn đánh giá qua CustomerNotification (nếu có thông báo gắn với đơn)
    try {
      const linkedNotif = await CustomerNotification.findOne({ orderId: String(order_id) });
      if (linkedNotif) {
        if (linkedNotif.expiresAt && new Date(linkedNotif.expiresAt) <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Đơn hàng này đã hết hạn đánh giá (chỉ được đánh giá trong vòng 7 ngày sau khi giao thành công).'
          });
        }
        // Đánh dấu thông báo đã hoàn tất để không hiện trên chuông nữa
        linkedNotif.isCompleted = true;
        linkedNotif.isRead = true;
        await linkedNotif.save();
      }
    } catch (notifErr) {
      console.warn('[Review] Bỏ qua kiểm tra CustomerNotification:', notifErr.message);
    }

    // 1.3 Lưu Review vào MongoDB
    const newReview = new Review({
      order_id,
      user_id: userId,
      userName: authorName,
      store_id,
      rating: numRating,
      comment: comment ? comment.trim() : ''
    });

    const savedReview = await newReview.save();

    // 1.4 Cập nhật điểm Rating trung bình & số lượng đánh giá của Nhà hàng
    const storeReviews = await Review.find({ store_id });
    if (storeReviews.length > 0) {
      const avgRating = (storeReviews.reduce((sum, r) => sum + r.rating, 0) / storeReviews.length).toFixed(1);
      await Restaurant.findByIdAndUpdate(store_id, {
        rating: Number(avgRating),
        review_count: storeReviews.length
      });
      await invalidateRestaurantCache(store_id.toString());
    }

    // 1.5 Cộng 1.000 Xu FoodFast cho người dùng đánh giá
    const REWARD_COINS = 1000;
    const newCoinsBalance = await creditUserCoins(userId, REWARD_COINS, 'REVIEW_REWARD', order_id);

    // 1.6 Event-Driven: Đẩy sự kiện review.submitted vào RabbitMQ (Exchange: foodfast_events)
    const eventPayload = {
      review_id: savedReview._id.toString(),
      order_id,
      user_id: userId,
      store_id: store_id.toString(),
      rating: numRating,
      comment: savedReview.comment,
      rewardCoins: REWARD_COINS,
      timestamp: Date.now()
    };

    // Bắn sự kiện lên cả exchange foodfast_events và food_order_topic
    try {
      await publishEvent('foodfast_events', 'review.submitted', eventPayload);
    } catch (pubErr) {
      console.warn('[Review] ⚠️ Không thể publish event foodfast_events, thử exchange mặc định:', pubErr.message);
      await publishEvent(undefined, 'review.submitted', eventPayload).catch(() => {});
    }

    emitStoreUpdate({
      storeId: store_id.toString(),
      event: 'review.created',
      includePublic: true,
      extra: { review: savedReview }
    });

    if (userId && userId !== 'guest_user') {
      emitUserEvent(userId, 'coins.updated', {
        rewardCoins: REWARD_COINS,
        newCoinsBalance,
        orderId: order_id
      });
    }

    return res.status(201).json({
      success: true,
      message: `Đánh giá món ăn thành công! Bạn nhận được ${REWARD_COINS.toLocaleString('vi-VN')} Xu FoodFast.`,
      rewardCoins: REWARD_COINS,
      newCoinsBalance,
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

