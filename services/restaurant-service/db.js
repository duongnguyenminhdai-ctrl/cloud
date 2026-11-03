const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Tránh lỗi phân giải DNS SRV trên Windows/Local DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const SERVICE_NAME = 'restaurant-service';
const MONGO_URI =
  process.env.MONGO_URI_RESTAURANT ||
  process.env.MONGO_URI ||
  'mongodb+srv://daiduongtest2_db_user:jUj4KmB1KBnfewW6@cluster1.1aa64fz.mongodb.net/restaurant_db?retryWrites=true&w=majority';

mongoose.connection.on('connected', () => {
  console.log(`[${SERVICE_NAME}] ✅ Đã kết nối thành công tới MongoDB Atlas (Database: ${mongoose.connection.name})`);
});

mongoose.connection.on('error', (err) => {
  console.error(`[${SERVICE_NAME}] ❌ Lỗi kết nối MongoDB: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn(`[${SERVICE_NAME}] ⚠️ Mất kết nối tới MongoDB Atlas`);
});

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] ❌ Khởi tạo kết nối MongoDB thất bại: ${error.message}`);
  }
};

module.exports = connectDB;
