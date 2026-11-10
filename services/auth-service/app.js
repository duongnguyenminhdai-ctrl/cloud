const express = require('express');
const cors = require('cors');
const path = require('path');

// Nạp file cấu hình môi trường
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const authRoutes = require('./src/routes/authRoutes');

const app = express();
const SERVICE_NAME = 'auth-service';

// 1. Bật CORS đầy đủ ngay trên đầu
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 2. Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: SERVICE_NAME
  });
});

// 3. Chuẩn hóa các route để không bị lệch path giữa Gateway và Service
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ status: "Auth service root ok", service: SERVICE_NAME });
});

module.exports = app;

