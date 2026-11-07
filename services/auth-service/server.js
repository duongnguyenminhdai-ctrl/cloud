const app = require('./app');
const connectDB = require('./db');

const PORT = process.env.PORT || 3005;
const SERVICE_NAME = 'auth-service';

// Kết nối tới MongoDB Atlas (auth_db)
connectDB().then(() => {
  const { seedAdminDefault } = require('./src/controllers/authController');
  seedAdminDefault();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] ${SERVICE_NAME} đang chạy tại cổng ${PORT}`);
});
