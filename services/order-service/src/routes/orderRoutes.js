const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// Định tuyến hỗ trợ cả truy cập trực tiếp (/orders) và qua Gateway (/) kèm Optional Token Authentication
router.get(['/stream', '/orders/stream'], orderController.streamOrders);
router.post(['/', '/orders'], optionalAuth, orderController.createOrder);
router.get(['/', '/orders'], optionalAuth, orderController.getAllOrders);
router.post(['/cleanup-stale', '/orders/cleanup-stale'], optionalAuth, orderController.cleanupStaleOrders);
router.put(['/:id/status', '/orders/:id/status'], optionalAuth, orderController.updateOrderStatus);
router.put(['/:id/modify', '/orders/:id/modify'], optionalAuth, orderController.modifyOrderItems);
router.get(['/:id', '/orders/:id'], optionalAuth, orderController.getOrderById);

module.exports = router;
