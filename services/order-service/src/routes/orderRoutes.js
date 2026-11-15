const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const groupOrderController = require('../controllers/groupOrderController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// Định tuyến hỗ trợ cả truy cập trực tiếp (/orders) và qua Gateway (/) kèm Optional Token Authentication
router.get(['/stream', '/orders/stream'], orderController.streamOrders);

// Group Order Routes (hỗ trợ cả /group-order/* và /group/*, và cả prefix /orders/group-order/*)
router.post(['/group-order/create', '/group/create', '/orders/group-order/create', '/orders/group/create'], optionalAuth, groupOrderController.createGroupRoom);
router.get(['/group-order/:roomCode/stream', '/group/:roomCode/stream', '/orders/group-order/:roomCode/stream', '/orders/group/:roomCode/stream'], groupOrderController.streamGroupRoom);
router.get(['/group-order/:roomCode', '/group/:roomCode', '/orders/group-order/:roomCode', '/orders/group/:roomCode'], optionalAuth, groupOrderController.getGroupRoom);
router.post(['/group-order/:roomCode/join', '/group/:roomCode/join', '/orders/group-order/:roomCode/join', '/orders/group/:roomCode/join'], optionalAuth, groupOrderController.joinGroupRoom);
router.post(['/group-order/:roomCode/items', '/group/:roomCode/items', '/orders/group-order/:roomCode/items', '/orders/group/:roomCode/items'], optionalAuth, groupOrderController.addGroupItem);
router.delete(['/group-order/:roomCode/items/:itemId', '/group/:roomCode/items/:itemId', '/orders/group-order/:roomCode/items/:itemId', '/orders/group/:roomCode/items/:itemId'], optionalAuth, groupOrderController.removeGroupItem);
router.post(['/group-order/:roomCode/lock', '/group/:roomCode/lock', '/orders/group-order/:roomCode/lock', '/orders/group/:roomCode/lock'], optionalAuth, groupOrderController.lockGroupRoom);
router.post(['/group-order/:roomCode/checkout', '/group/:roomCode/checkout', '/orders/group-order/:roomCode/checkout', '/orders/group/:roomCode/checkout'], optionalAuth, groupOrderController.checkoutGroupRoom);

// Order Management Routes
router.post(['/', '/orders'], optionalAuth, orderController.createOrder);
router.get(['/', '/orders'], optionalAuth, orderController.getAllOrders);
router.post(['/cleanup-stale', '/orders/cleanup-stale'], optionalAuth, orderController.cleanupStaleOrders);
router.put(['/:id/status', '/orders/:id/status'], optionalAuth, orderController.updateOrderStatus);
router.put(['/:id/modify', '/orders/:id/modify'], optionalAuth, orderController.modifyOrderItems);
router.get(['/:id', '/orders/:id'], optionalAuth, orderController.getOrderById);

module.exports = router;
