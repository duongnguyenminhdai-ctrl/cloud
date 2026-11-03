const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const deliveryRoutes = require('./src/routes/deliveryRoutes');

const app = express();
const SERVICE_NAME = 'delivery-service';

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

// API Endpoints: Điều phối & Theo dõi đơn giao hàng
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/deliveries', deliveryRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ status: "Delivery service root ok", service: SERVICE_NAME });
});

module.exports = app;

