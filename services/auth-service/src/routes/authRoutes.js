const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

// 1. Gửi mã OTP (đăng ký hoặc quên mật khẩu)
router.post(
  ['/otp/send', '/auth/otp/send', '/api/auth/otp/send', '/api/v1/auth/otp/send'],
  authController.sendOTP
);

// 2. Xác thực mã OTP
router.post(
  ['/otp/verify', '/auth/otp/verify', '/api/auth/otp/verify', '/api/v1/auth/otp/verify'],
  authController.verifyOTP
);

// 3. Đăng ký tài khoản (kèm xác thực OTP)
router.post(
  ['/register', '/auth/register', '/api/auth/register', '/api/v1/auth/register'],
  authController.register
);

// 4. Quên mật khẩu / Đặt lại mật khẩu
router.post(
  ['/reset-password', '/auth/reset-password', '/api/auth/reset-password', '/api/v1/auth/reset-password'],
  authController.resetPassword
);

// 5. Đăng nhập
router.post(
  ['/login', '/auth/login', '/api/auth/login', '/api/v1/auth/login'],
  authController.login
);

// 6. Kiểm tra Token
router.get(
  ['/verify', '/auth/verify', '/api/auth/verify', '/api/v1/auth/verify'],
  verifyToken,
  authController.verify
);

// 7. Khởi tạo đăng nhập Google OAuth 2.0
router.get(
  ['/google', '/auth/google', '/api/auth/google', '/api/v1/auth/google'],
  authController.googleAuthRedirect
);

// 8. Tiếp nhận Callback từ Google OAuth 2.0
router.get(
  ['/google/callback', '/auth/google/callback', '/api/auth/google/callback', '/api/v1/auth/google/callback'],
  authController.googleAuthCallback
);

// 9. Đăng nhập qua Google Credential Token (Google Identity Services)
router.post(
  ['/google', '/auth/google', '/api/auth/google', '/api/v1/auth/google', '/google/credential', '/auth/google/credential', '/api/auth/google/credential', '/api/v1/auth/google/credential'],
  authController.googleCredentialLogin
);

module.exports = router;
