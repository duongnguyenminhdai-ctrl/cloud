const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const voucherController = require('../controllers/voucherController');
const recommendationController = require('../controllers/recommendationController');
const reviewController = require('../controllers/reviewController');
const { verifyToken, requireAdmin } = require('../middlewares/authMiddleware');

// -----------------------------------------------------------------------------
// 1. Cửa hàng của tôi (My Store & Onboarding)
// Chú ý: Các route tĩnh này PHẢI đặt trước các route có dynamic param /:id
// -----------------------------------------------------------------------------
router.get(
  ['/my-status', '/me/store-status', '/users/me/store-status', '/api/v1/users/me/store-status', '/stores/my-status', '/api/v1/stores/my-status'],
  verifyToken,
  restaurantController.getStoreStatus
);

router.post(
  ['/register', '/stores/register', '/api/v1/stores/register'],
  verifyToken,
  restaurantController.registerStore
);

router.get(
  ['/my-store', '/stores/my-store', '/api/v1/stores/my-store'],
  verifyToken,
  restaurantController.getMyStore
);

router.put(
  ['/my-store', '/stores/my-store', '/api/v1/stores/my-store'],
  verifyToken,
  restaurantController.updateMyStore
);

router.post(
  ['/my-store/menu', '/stores/my-store/menu', '/api/v1/stores/my-store/menu'],
  verifyToken,
  restaurantController.addMenuItem
);

router.put(
  ['/my-store/menu/:itemId', '/stores/my-store/menu/:itemId', '/api/v1/stores/my-store/menu/:itemId'],
  verifyToken,
  restaurantController.updateMenuItem
);

router.delete(
  ['/my-store/menu/:itemId', '/stores/my-store/menu/:itemId', '/api/v1/stores/my-store/menu/:itemId'],
  verifyToken,
  restaurantController.deleteMenuItem
);

// -----------------------------------------------------------------------------
// 2. Quản trị viên (Admin Store Management & Approval)
// -----------------------------------------------------------------------------
router.get(
  ['/admin/list', '/restaurants/admin/list', '/api/v1/restaurants/admin/list'],
  verifyToken,
  requireAdmin,
  restaurantController.adminGetRestaurants
);

router.put(
  ['/admin/:id/approve', '/restaurants/admin/:id/approve', '/api/v1/restaurants/admin/:id/approve'],
  verifyToken,
  requireAdmin,
  restaurantController.adminApproveRestaurant
);

router.put(
  ['/admin/:id/reject', '/restaurants/admin/:id/reject', '/api/v1/restaurants/admin/:id/reject'],
  verifyToken,
  requireAdmin,
  restaurantController.adminRejectRestaurant
);

router.delete(
  ['/admin/:id', '/restaurants/admin/:id', '/api/v1/restaurants/admin/:id'],
  verifyToken,
  requireAdmin,
  restaurantController.adminDeleteRestaurant
);

// -----------------------------------------------------------------------------
// 3. Đề xuất quán ăn thông minh (Smart Recommendation & Redis Cache)
// Đặt TRƯỚC route dynamic /:id để không bị Express nuốt route
// -----------------------------------------------------------------------------
router.get(
  ['/recommended', '/stores/recommended', '/api/v1/stores/recommended', '/restaurants/recommended', '/api/v1/restaurants/recommended'],
  recommendationController.getRecommendedStores
);

// -----------------------------------------------------------------------------
// 4. Hệ thống Voucher (FoodFast Style & Concurrency Control với Redis)
// -----------------------------------------------------------------------------
router.post(
  ['/vouchers/apply', '/api/v1/vouchers/apply', '/apply'],
  voucherController.applyVoucher
);
router.get(
  ['/vouchers', '/api/v1/vouchers'],
  voucherController.getVouchers
);
router.post(
  ['/vouchers', '/api/v1/vouchers'],
  voucherController.createVoucher
);

// -----------------------------------------------------------------------------
// 5. Đánh giá quán ăn & Event-Driven Tặng Voucher qua RabbitMQ (Review System)
// -----------------------------------------------------------------------------
router.post(
  ['/reviews', '/api/v1/reviews'],
  reviewController.createReview
);
router.get(
  ['/reviews/store/:storeId', '/api/v1/reviews/store/:storeId'],
  reviewController.getStoreReviews
);

// -----------------------------------------------------------------------------
// 6. Khách hàng xem danh sách và chi tiết quán ăn (Public Endpoints)
// -----------------------------------------------------------------------------
router.get(['/', '/restaurants', '/api/restaurants', '/api/v1/restaurants'], restaurantController.getAllRestaurants);
router.get(['/:id', '/restaurants/:id', '/api/restaurants/:id', '/api/v1/restaurants/:id'], restaurantController.getRestaurantById);
router.post(['/', '/restaurants', '/api/restaurants', '/api/v1/restaurants'], restaurantController.createRestaurant);
router.put(['/:id', '/restaurants/:id', '/api/restaurants/:id', '/api/v1/restaurants/:id'], restaurantController.updateRestaurant);

module.exports = router;
