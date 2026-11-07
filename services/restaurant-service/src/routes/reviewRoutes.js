const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// 1. Gửi đánh giá món ăn / quán ăn (POST /api/v1/reviews)
router.post(['/', '/reviews'], reviewController.createReview);

// 2. Lấy danh sách đánh giá của quán (GET /api/v1/reviews/store/:storeId)
router.get(['/store/:storeId', '/reviews/store/:storeId'], reviewController.getStoreReviews);

module.exports = router;
