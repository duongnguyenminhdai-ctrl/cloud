const express = require('express');
const router = express.Router();
const customerNotificationController = require('../controllers/customerNotificationController');
const { verifyToken } = require('../middlewares/authMiddleware');

// 1. Lấy danh sách thông báo chuông của người dùng hiện tại
router.get(
  ['/my-notifications', '/me', '/'],
  verifyToken,
  customerNotificationController.getMyNotifications
);

// 2. Đánh dấu tất cả thông báo là đã đọc
router.put(
  ['/read-all', '/all/read'],
  verifyToken,
  customerNotificationController.markAsRead
);

// 3. Đánh dấu 1 thông báo cụ thể là đã đọc
router.put(
  ['/:id/read', '/:id'],
  verifyToken,
  customerNotificationController.markAsRead
);

// 4. Xóa thông báo
router.delete(
  ['/:id'],
  verifyToken,
  customerNotificationController.deleteNotification
);

module.exports = router;

