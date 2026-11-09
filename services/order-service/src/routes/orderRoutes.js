const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Định tuyến hỗ trợ cả truy cập trực tiếp (/orders) và qua Gateway (/)
router.post(['/', '/orders'], orderController.createOrder);
router.get(['/', '/orders'], orderController.getAllOrders);
router.post(['/cleanup-stale', '/orders/cleanup-stale'], orderController.cleanupStaleOrders);
router.put(['/:id/status', '/orders/:id/status'], orderController.updateOrderStatus);
router.put(['/:id/modify', '/orders/:id/modify'], orderController.modifyOrderItems);
router.get(['/:id', '/orders/:id'], orderController.getOrderById);

module.exports = router;
