const express = require('express');
const cors = require('cors');
const path = require('path');

// Nạp biến môi trường từ .env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const restaurantRoutes = require('./src/routes/restaurantRoutes');
const restaurantController = require('./src/controllers/restaurantController');

const app = express();
const SERVICE_NAME = 'restaurant-service';

// 1. Bật CORS đầy đủ ngay trên đầu file
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Endpoint kiểm tra sức khỏe chuẩn
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: SERVICE_NAME
  });
});

// 3. Viết route trực tiếp với mảng path để bất kể Nginx forward nguyên path hay cắt gọn đều hoạt động chính xác
const restaurantPaths = ['/', '/restaurants', '/api/restaurants', '/api/v1/restaurants'];
const restaurantIdPaths = ['/:id', '/restaurants/:id', '/api/restaurants/:id', '/api/v1/restaurants/:id'];

app.get(restaurantPaths, restaurantController.getAllRestaurants);
app.get(restaurantIdPaths, restaurantController.getRestaurantById);
app.post(restaurantPaths, restaurantController.createRestaurant);
app.put(restaurantIdPaths, restaurantController.updateRestaurant);

// Chuẩn hóa thêm router middleware
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/restaurants', restaurantRoutes);

module.exports = app;

