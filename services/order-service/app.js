const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const orderRoutes = require('./src/routes/orderRoutes');
const { sanitizeNoSql, securityHeaders } = require('./src/middlewares/securityMiddleware');

const app = express();
const SERVICE_NAME = 'order-service';

// Security Headers & CORS
app.use(securityHeaders);
app.use(cors());
app.use(express.json());
app.use(sanitizeNoSql);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: SERVICE_NAME
  });
});

// API Endpoints: Quản lý Đơn hàng
app.use('/api/v1/orders', orderRoutes);
app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ status: "Order service root ok", service: SERVICE_NAME });
});

module.exports = app;

