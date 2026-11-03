const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

// Định tuyến hỗ trợ cả truy cập trực tiếp (/deliveries) và qua Gateway (/)
router.get(['/order/:orderId', '/deliveries/order/:orderId'], deliveryController.getDeliveryByOrderId);
router.get(['/', '/deliveries'], deliveryController.getAllDeliveries);
router.put(['/order/:orderId/status', '/deliveries/order/:orderId/status'], deliveryController.updateDeliveryStatus);

module.exports = router;
