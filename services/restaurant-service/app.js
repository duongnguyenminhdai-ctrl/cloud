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

// 3. Mount router cho cả các prefix: /api/v1/restaurants, /api/v1/stores, /api/v1/users, v.v.
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/restaurants', restaurantRoutes);
app.use('/api/v1/stores', restaurantRoutes);
app.use('/api/stores', restaurantRoutes);
app.use('/stores', restaurantRoutes);
app.use('/api/v1/users', restaurantRoutes);
app.use('/api/users', restaurantRoutes);
app.use('/users', restaurantRoutes);
app.use('/', restaurantRoutes);

module.exports = app;

