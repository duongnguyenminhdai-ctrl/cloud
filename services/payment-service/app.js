const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const paymentRoutes = require('./src/routes/paymentRoutes');

const app = express();
const SERVICE_NAME = 'payment-service';

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: SERVICE_NAME
  });
});

// API Endpoints: Lịch sử & Chi tiết Giao dịch
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ status: "Payment service root ok", service: SERVICE_NAME });
});

module.exports = app;

