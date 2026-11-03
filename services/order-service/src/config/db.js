const mongoose = require('mongoose');
const dns = require('dns');

// Cấu hình DNS Server giải quyết lỗi ECONNREFUSED khi truy vấn SRV record MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Bỏ qua nếu môi trường không hỗ trợ
}

const SERVICE_NAME = process.env.SERVICE_NAME || 'order-service';

// Bắt các sự kiện vòng đời kết nối của Mongoose
mongoose.connection.on('connected', () => {
  console.log(`[${SERVICE_NAME}] ✅ Đã kết nối thành công tới MongoDB Atlas (Database: ${mongoose.connection.name})`);
});

mongoose.connection.on('error', (err) => {
  console.error(`[${SERVICE_NAME}] ❌ Lỗi kết nối MongoDB: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn(`[${SERVICE_NAME}] ⚠️ Mất kết nối tới MongoDB Atlas`);
});

/**
 * Hàm khởi tạo kết nối MongoDB Atlas qua Mongoose
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error(`[${SERVICE_NAME}] ❌ Biến môi trường MONGO_URI chưa được định nghĩa trong .env!`);
    return;
  }

  try {
    await mongoose.connect(mongoURI);
  } catch (error) {
    console.error(`[${SERVICE_NAME}] ❌ Khởi tạo kết nối MongoDB thất bại: ${error.message}`);
  }
};

module.exports = connectDB;
