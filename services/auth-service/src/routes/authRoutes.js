const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireAdmin } = require('../middlewares/authMiddleware');

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

// -----------------------------------------------------------------------------
// QUẢN TRỊ VIÊN (ADMIN ROUTES)
// -----------------------------------------------------------------------------

// Đăng nhập Admin
router.post(
  ['/admin/login', '/auth/admin/login', '/api/auth/admin/login', '/api/v1/auth/admin/login'],
  authController.adminLogin
);

// Quản lý danh sách tài khoản (phân trang, tìm kiếm, lọc, sắp xếp)
router.get(
  ['/admin/users', '/auth/admin/users', '/api/auth/admin/users', '/api/v1/auth/admin/users'],
  verifyToken,
  requireAdmin,
  authController.adminGetUsers
);

// Thêm tài khoản mới từ Admin
router.post(
  ['/admin/users', '/auth/admin/users', '/api/auth/admin/users', '/api/v1/auth/admin/users'],
  verifyToken,
  requireAdmin,
  authController.adminCreateUser
);

// Sửa tài khoản
router.put(
  ['/admin/users/:id', '/auth/admin/users/:id', '/api/auth/admin/users/:id', '/api/v1/auth/admin/users/:id'],
  verifyToken,
  requireAdmin,
  authController.adminUpdateUser
);

// Xóa tài khoản
router.delete(
  ['/admin/users/:id', '/auth/admin/users/:id', '/api/auth/admin/users/:id', '/api/v1/auth/admin/users/:id'],
  verifyToken,
  requireAdmin,
  authController.adminDeleteUser
);

// Đổi mật khẩu tài khoản Admin
router.put(
  ['/admin/change-password', '/auth/admin/change-password', '/api/auth/admin/change-password', '/api/v1/auth/admin/change-password'],
  verifyToken,
  requireAdmin,
  authController.adminChangePassword
);

// -----------------------------------------------------------------------------
// QUẢN LÝ THÔNG TIN TÀI KHOẢN & ĐỔI MẬT KHẨU (USER & ADMIN)
// -----------------------------------------------------------------------------

// Xem thông tin tài khoản cá nhân
router.get(
  ['/profile', '/auth/profile', '/api/auth/profile', '/api/v1/auth/profile', '/me', '/auth/me'],
  verifyToken,
  authController.getProfile
);

// Cập nhật thông tin liên hệ (tên, năm sinh, địa chỉ, sđt)
router.put(
  ['/profile', '/auth/profile', '/api/auth/profile', '/api/v1/auth/profile'],
  verifyToken,
  authController.updateProfile
);

// Đổi mật khẩu tài khoản
router.put(
  ['/change-password', '/auth/change-password', '/api/auth/change-password', '/api/v1/auth/change-password'],
  verifyToken,
  authController.changeUserPassword
);

// -----------------------------------------------------------------------------
// XÁC THỰC SỐ ĐIỆN THOẠI QUA FIREBASE PHONE AUTH (CHỐNG SĐT RÁC & TRÙNG LẶP)
// -----------------------------------------------------------------------------
router.get(
  ['/phone/config-status', '/auth/phone/config-status', '/api/v1/auth/phone/config-status'],
  authController.getPhoneAuthStatus
);

router.post(
  ['/phone/check-available', '/auth/phone/check-available', '/api/v1/auth/phone/check-available'],
  authController.checkPhoneAvailable
);

router.post(
  ['/phone/verify-firebase', '/auth/phone/verify-firebase', '/api/v1/auth/phone/verify-firebase'],
  verifyToken,
  authController.verifyFirebasePhone
);

module.exports = router;
