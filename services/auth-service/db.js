const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

// Cấu hình DNS Server dự phòng cho Node.js khi resolve MongoDB Atlas SRV trên Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Bỏ qua nếu môi trường container không cho phép
}

// Nạp biến môi trường từ .env của service hoặc từ thư mục gốc
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI_AUTH || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[auth-service] ❌ LỖI: Biến MONGO_URI_AUTH hoặc MONGO_URI chưa được khai báo!');
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000
    });
    console.log(`[auth-service] ✅ Đã kết nối thành công tới MongoDB Atlas (Database: ${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`[auth-service] ❌ Lỗi kết nối MongoDB Atlas: ${error.message}`);
    // Tự động thử lại kết nối sau 5s
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;

