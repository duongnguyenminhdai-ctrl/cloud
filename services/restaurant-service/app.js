const express = require('express');
const cors = require('cors');
const path = require('path');

// Nạp biến môi trường từ .env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const restaurantRoutes = require('./src/routes/restaurantRoutes');
const voucherRoutes = require('./src/routes/voucherRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const customerNotificationRoutes = require('./src/routes/customerNotificationRoutes');

const app = express();
const SERVICE_NAME = 'restaurant-service';

// 1. Bật CORS đầy đủ ngay trên đầu file
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 2. Endpoint kiểm tra sức khỏe chuẩn
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: SERVICE_NAME
  });
});

// 3. Mount các router chuyên biệt
// 3.1 Voucher Service Endpoints (/api/v1/vouchers/apply, /api/v1/vouchers, /api/v1/admin/vouchers)
app.use('/api/v1/admin/vouchers', voucherRoutes);
app.use('/api/admin/vouchers', voucherRoutes);
app.use('/admin/vouchers', voucherRoutes);
app.use('/api/v1/restaurants/admin/vouchers', voucherRoutes);
app.use('/api/v1/vouchers', voucherRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/vouchers', voucherRoutes);

// 3.2 Review Service Endpoints (/api/v1/reviews)
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/reviews', reviewRoutes);

// 3.3 Customer Notifications Endpoints (/api/v1/notifications, /api/v1/customer-notifications)
app.use('/api/v1/notifications', customerNotificationRoutes);
app.use('/api/notifications', customerNotificationRoutes);
app.use('/notifications', customerNotificationRoutes);
app.use('/api/v1/customer-notifications', customerNotificationRoutes);
app.use('/api/customer-notifications', customerNotificationRoutes);
app.use('/customer-notifications', customerNotificationRoutes);
app.use('/api/v1/restaurants/customer-notifications', customerNotificationRoutes);
app.use('/api/restaurants/customer-notifications', customerNotificationRoutes);

// 3.3 Restaurant & Store & Recommendation Endpoints
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

