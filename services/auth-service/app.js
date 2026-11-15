const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns');

// Cấu hình DNS Server dự phòng cho Node.js khi resolve MongoDB Atlas SRV
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

// Nạp file cấu hình môi trường
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const authRoutes = require('./src/routes/authRoutes');
const { sanitizeNoSql, securityHeaders } = require('./src/middlewares/securityMiddleware');

const app = express();
const SERVICE_NAME = 'auth-service';

// 1. HTTP Security Headers & NoSQL Injection Protection
app.use(securityHeaders);

// 2. Bật CORS đầy đủ ngay trên đầu
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(sanitizeNoSql);

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

