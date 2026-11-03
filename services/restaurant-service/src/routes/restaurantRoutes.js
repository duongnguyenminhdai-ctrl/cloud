const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');

// Định tuyến hỗ trợ cả truy cập trực tiếp (/restaurants) và qua Gateway (/)
router.get(['/', '/restaurants', '/api/restaurants', '/api/v1/restaurants'], restaurantController.getAllRestaurants);
router.get(['/:id', '/restaurants/:id', '/api/restaurants/:id', '/api/v1/restaurants/:id'], restaurantController.getRestaurantById);
router.post(['/', '/restaurants', '/api/restaurants', '/api/v1/restaurants'], restaurantController.createRestaurant);
router.put(['/:id', '/restaurants/:id', '/api/restaurants/:id', '/api/v1/restaurants/:id'], restaurantController.updateRestaurant);

module.exports = router;
