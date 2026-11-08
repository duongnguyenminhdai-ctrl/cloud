const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

// 1. Tiến trình giao hàng theo order_id (Khách hàng theo dõi realtime)
router.get(['/track/:order_id', '/deliveries/track/:order_id'], deliveryController.trackDelivery);
router.get(['/order/:orderId', '/deliveries/order/:orderId'], deliveryController.getDeliveryByOrderId);

// 2. Khung API RESTful cho Tài xế (Driver API Endpoints)
router.patch(['/:id/accept', '/deliveries/:id/accept'], deliveryController.acceptDelivery);
router.patch(['/:id/pick-up', '/deliveries/:id/pick-up'], deliveryController.pickUpDelivery);
router.patch(['/:id/complete', '/deliveries/:id/complete'], deliveryController.completeDelivery);
router.patch(['/:id/location', '/deliveries/:id/location'], deliveryController.updateLocation);

// 3. Tính phí giao hàng linh hoạt (Dynamic Surge Pricing theo giờ & thời tiết)
router.get(['/shipping-fee', '/deliveries/shipping-fee'], deliveryController.getShippingFee);
router.post(['/shipping-fee', '/deliveries/shipping-fee'], deliveryController.getShippingFee);

// 4. Quản lý danh sách & Cập nhật cũ (Tương thích ngược)
router.get(['/', '/deliveries'], deliveryController.getAllDeliveries);
router.put(['/order/:orderId/status', '/deliveries/order/:orderId/status'], deliveryController.updateDeliveryStatus);

module.exports = router;
