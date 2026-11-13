const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const voucherController = require('../controllers/voucherController');
const recommendationController = require('../controllers/recommendationController');
const reviewController = require('../controllers/reviewController');
const uploadController = require('../controllers/uploadController');
const { verifyToken, requireAdmin } = require('../middlewares/authMiddleware');

// 0. Cloudinary Media Upload API
router.post(
  ['/upload', '/stores/upload', '/restaurants/upload', '/api/v1/upload', '/api/v1/restaurants/upload'],
  uploadController.uploadImage
);

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

// 1.1 Toggle nhanh Còn món / Hết món (Module 2)
router.put(
  ['/my-store/menu/:itemId/toggle-availability', '/stores/my-store/menu/:itemId/toggle-availability'],
  verifyToken,
  restaurantController.toggleMenuItemAvailability
);

// 1.2 Quản lý Trạng thái hoạt động, Chế độ Quán Bận & Lịch mở cửa (Module 3)
router.put(
  ['/my-store/operations', '/stores/my-store/operations'],
  verifyToken,
  restaurantController.updateStoreOperations
);

// 1.3 Quản lý Danh mục món & Thứ tự danh mục (Module 2)
router.put(
  ['/my-store/categories', '/stores/my-store/categories'],
  verifyToken,
  restaurantController.manageCategories
);

// 1.4 Quản lý Nhóm Topping & Tùy chọn độc lập của Quán (Module 2)
router.put(
  ['/my-store/toppings', '/stores/my-store/toppings'],
  verifyToken,
  restaurantController.manageToppingGroups
);

// 1.5 Quản lý Nhân viên của Quán (Module 4)
router.put(
  ['/my-store/staff', '/stores/my-store/staff'],
  verifyToken,
  restaurantController.manageStaff
);

// 1.6 Quản lý Ví đối tác, Rút tiền thủ công & PIN bảo mật (Module 5)
router.post(
  ['/my-store/wallet', '/stores/my-store/wallet'],
  verifyToken,
  restaurantController.manageWallet
);
router.get(
  ['/my-store/wallet', '/stores/my-store/wallet'],
  verifyToken,
  restaurantController.manageWallet
);

// 1.7 Quản lý Voucher khuyến mãi riêng của Quán (Module 6 - Tự tạo & giảm trừ thuế Hộ KD)
router.get(
  ['/my-store/vouchers', '/stores/my-store/vouchers'],
  verifyToken,
  voucherController.merchantGetVouchers
);
router.post(
  ['/my-store/vouchers', '/stores/my-store/vouchers'],
  verifyToken,
  voucherController.merchantCreateVoucher
);
router.put(
  ['/my-store/vouchers/:voucherId', '/stores/my-store/vouchers/:voucherId'],
  verifyToken,
  voucherController.merchantUpdateVoucher
);
router.patch(
  ['/my-store/vouchers/:voucherId/toggle', '/stores/my-store/vouchers/:voucherId/toggle'],
  verifyToken,
  voucherController.merchantToggleVoucher
);
router.delete(
  ['/my-store/vouchers/:voucherId', '/stores/my-store/vouchers/:voucherId'],
  verifyToken,
  voucherController.merchantDeleteVoucher
);

// 1.8 Đồng bộ quyết toán đơn thật & doanh thu ví thật (Real Cash & Order Sync)
router.post(
  ['/my-store/sync-settlements', '/stores/my-store/sync-settlements'],
  verifyToken,
  restaurantController.syncMyStoreSettlements
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

// Khóa quán có thời hạn / Tạm ngưng hoạt động
router.put(
  ['/admin/:id/ban', '/restaurants/admin/:id/ban', '/api/v1/restaurants/admin/:id/ban'],
  verifyToken,
  requireAdmin,
  restaurantController.adminBanRestaurant
);

// Mở khóa quán / Bỏ cấm
router.put(
  ['/admin/:id/unban', '/restaurants/admin/:id/unban', '/api/v1/restaurants/admin/:id/unban'],
  verifyToken,
  requireAdmin,
  restaurantController.adminUnbanRestaurant
);

// Gửi cảnh báo vi phạm tới chủ quán
router.post(
  ['/admin/:id/warn', '/restaurants/admin/:id/warn', '/api/v1/restaurants/admin/:id/warn'],
  verifyToken,
  requireAdmin,
  restaurantController.adminWarnRestaurant
);

// Tặng tiền / Cấp số dư Ví đối tác cho quán (Admin Wallet Grant)
router.post(
  ['/admin/:id/grant-wallet', '/restaurants/admin/:id/grant-wallet', '/api/v1/restaurants/admin/:id/grant-wallet'],
  verifyToken,
  requireAdmin,
  restaurantController.adminGrantWallet
);

// Chủ quán nhận danh sách thông báo & cảnh báo + Đánh dấu đã đọc + SSE Realtime
router.get(
  ['/my-store/stream', '/stores/my-store/stream', '/api/v1/stores/my-store/stream'],
  verifyToken,
  restaurantController.streamMyStore
);

router.get(
  ['/my-store/notifications', '/stores/my-store/notifications', '/api/v1/stores/my-store/notifications'],
  verifyToken,
  restaurantController.getStoreNotifications
);

router.put(
  ['/my-store/notifications/read', '/stores/my-store/notifications/read', '/api/v1/stores/my-store/notifications/read'],
  verifyToken,
  restaurantController.markStoreNotificationsRead
);

router.get(
  ['/admin/stream', '/restaurants/admin/stream', '/api/v1/restaurants/admin/stream'],
  verifyToken,
  requireAdmin,
  restaurantController.streamAdmin
);

router.get(
  ['/stream', '/restaurants/stream', '/api/v1/restaurants/stream'],
  restaurantController.streamPublicStores
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
router.get(
  ['/vouchers/banners', '/api/v1/vouchers/banners', '/banners'],
  voucherController.getBannerVouchers
);
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
router.post(
  ['/reviews/:reviewId/like', '/api/v1/reviews/:reviewId/like'],
  reviewController.toggleLikeReview
);
router.post(
  ['/reviews/:reviewId/reply', '/api/v1/reviews/:reviewId/reply'],
  reviewController.replyReview
);

// -----------------------------------------------------------------------------
// 6. Khách hàng xem danh sách và chi tiết quán ăn (Public Endpoints)
// -----------------------------------------------------------------------------
router.get(['/favorites', '/restaurants/favorites', '/api/v1/restaurants/favorites'], restaurantController.getFavoriteRestaurants);
router.post(['/:id/like', '/restaurants/:id/like', '/api/v1/restaurants/:id/like'], restaurantController.toggleRestaurantLike);

router.get(['/', '/restaurants', '/api/restaurants', '/api/v1/restaurants'], restaurantController.getAllRestaurants);
router.get(['/:id', '/restaurants/:id', '/api/restaurants/:id', '/api/v1/restaurants/:id'], restaurantController.getRestaurantById);
router.post(['/', '/restaurants', '/api/restaurants', '/api/v1/restaurants'], restaurantController.createRestaurant);
router.put(['/:id', '/restaurants/:id', '/api/restaurants/:id', '/api/v1/restaurants/:id'], restaurantController.updateRestaurant);

module.exports = router;
