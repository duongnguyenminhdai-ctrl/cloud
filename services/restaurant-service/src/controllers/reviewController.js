const mongoose = require('mongoose');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const CustomerNotification = require('../models/CustomerNotification');
const { publishEvent } = require('../rabbitmq');
const { invalidateRestaurantCache } = require('../../redis');
const { emitStoreUpdate, emitUserEvent } = require('../utils/realtimeHub');
const { uploadToCloudinary } = require('../utils/cloudinary');

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
    const {
      order_id,
      store_id,
      rating,
      comment,
      userName,
      userAvatar,
      criteria,
      images,
      purchasedItem
    } = req.body;
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.user_id || 'guest_user';
    const authorName = (req.user && req.user.name) || userName || 'Khách hàng FoodFast';
    const authorAvatar = (req.user && req.user.avatar) || userAvatar || '';

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

    // 1.3 Upload ảnh đánh giá lên Cloudinary CDN để tiết kiệm bộ nhớ MongoDB
    let uploadedImages = [];
    if (Array.isArray(images) && images.length > 0) {
      uploadedImages = await Promise.all(
        images.slice(0, 5).map(async (img) => {
          if (typeof img === 'string' && img.startsWith('data:image/')) {
            try {
              const res = await uploadToCloudinary(img, { folder: 'foodfast/reviews' });
              return res.secure_url;
            } catch (err) {
              console.warn('[Review] Cloudinary upload review image failed:', err.message);
              return img;
            }
          }
          return img;
        })
      );
    }

    // 1.4 Lưu Review chuẩn Shopee vào MongoDB
    const newReview = new Review({
      order_id,
      user_id: userId,
      userName: authorName,
      userAvatar: authorAvatar,
      store_id,
      rating: numRating,
      comment: comment ? comment.trim() : '',
      criteria: {
        taste: criteria?.taste || (numRating >= 4 ? 'Tuyệt vời' : numRating === 3 ? 'Tạm ổn' : 'Chưa hợp khẩu vị'),
        packaging: criteria?.packaging || (numRating >= 4 ? 'Cẩn thận, sạch sẽ' : 'Bình thường'),
        deliverySpeed: criteria?.deliverySpeed || (numRating >= 4 ? 'Giao siêu tốc' : 'Đúng giờ')
      },
      images: uploadedImages,
      purchasedItem: {
        name: purchasedItem?.name || '',
        image: purchasedItem?.image || '',
        options: purchasedItem?.options || ''
      }
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
 * Lấy danh sách đánh giá của quán ăn kèm bộ lọc sao (Shopee Style) & Thống kê chi tiết
 */
exports.getStoreReviews = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { filter = 'all', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // 2.1 Lấy toàn bộ đánh giá của quán để tính toán breakdown chỉ số thống kê
    const allStoreReviews = await Review.find({ store_id: storeId }).sort({ createdAt: -1 });
    const totalCount = allStoreReviews.length;

    const starCounts = {
      5: allStoreReviews.filter((r) => r.rating === 5).length,
      4: allStoreReviews.filter((r) => r.rating === 4).length,
      3: allStoreReviews.filter((r) => r.rating === 3).length,
      2: allStoreReviews.filter((r) => r.rating === 2).length,
      1: allStoreReviews.filter((r) => r.rating === 1).length
    };

    const withCommentsCount = allStoreReviews.filter((r) => r.comment && r.comment.trim().length > 0).length;
    const withPhotosCount = allStoreReviews.filter((r) => Array.isArray(r.images) && r.images.length > 0).length;

    const avgRating = totalCount > 0
      ? (allStoreReviews.reduce((sum, r) => sum + r.rating, 0) / totalCount).toFixed(1)
      : '0.0';

    // 2.2 Áp dụng bộ lọc (Tất Cả, 5 Sao, 4 Sao, ..., Có Bình Luận, Có Hình Ảnh)
    let queryFilter = { store_id: storeId };
    if (filter === '5') queryFilter.rating = 5;
    else if (filter === '4') queryFilter.rating = 4;
    else if (filter === '3') queryFilter.rating = 3;
    else if (filter === '2') queryFilter.rating = 2;
    else if (filter === '1') queryFilter.rating = 1;
    else if (filter === 'with_comments') {
      queryFilter.comment = { $exists: true, $ne: '' };
    } else if (filter === 'with_photos') {
      queryFilter.images = { $exists: true, $not: { $size: 0 } };
    }

    const filteredReviews = await Review.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const filteredTotal = await Review.countDocuments(queryFilter);

    return res.status(200).json({
      success: true,
      summary: {
        avgRating: Number(avgRating),
        totalReviews: totalCount,
        starCounts,
        withCommentsCount,
        withPhotosCount
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limitNum) || 1
      },
      count: filteredReviews.length,
      data: filteredReviews
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách đánh giá quán: ' + error.message
    });
  }
};

/**
 * 3. POST /api/v1/reviews/:reviewId/like
 * Bấm thích / Hữu ích cho một đánh giá (Shopee Style)
 */
exports.toggleLikeReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.user_id || 'anonymous';

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    const likedIndex = (review.likedUsers || []).indexOf(userId);
    let isLiked = false;

    if (likedIndex > -1) {
      // Hủy thích
      review.likedUsers.splice(likedIndex, 1);
      review.likes = Math.max(0, (review.likes || 1) - 1);
      isLiked = false;
    } else {
      // Thêm thích
      if (!review.likedUsers) review.likedUsers = [];
      review.likedUsers.push(userId);
      review.likes = (review.likes || 0) + 1;
      isLiked = true;
    }

    await review.save();

    return res.status(200).json({
      success: true,
      likes: review.likes,
      isLiked,
      message: isLiked ? 'Cảm ơn bạn đã đánh giá hữu ích!' : 'Đã bỏ hữu ích.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi thao tác thích đánh giá: ' + error.message
    });
  }
};

/**
 * 4. POST /api/v1/reviews/:reviewId/reply
 * Chủ quán ăn / Người bán phản hồi đánh giá của khách
 */
exports.replyReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung phản hồi không được để trống'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });
    }

    review.sellerReply = {
      comment: comment.trim(),
      repliedAt: new Date()
    };

    await review.save();

    return res.status(200).json({
      success: true,
      message: 'Đã gửi phản hồi tới khách hàng thành công!',
      data: review
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi phản hồi đánh giá: ' + error.message
    });
  }
};

