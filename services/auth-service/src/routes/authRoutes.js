const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const checkInController = require('../controllers/checkInController');
const { verifyToken, requireAdmin } = require('../middlewares/authMiddleware');
const { authRateLimiter, otpRateLimiter } = require('../middlewares/securityMiddleware');

// 1. Gửi mã OTP (đăng ký hoặc quên mật khẩu) - Chống DoS OTP
router.post(
  ['/otp/send', '/auth/otp/send', '/api/auth/otp/send', '/api/v1/auth/otp/send'],
  otpRateLimiter,
  authController.sendOTP
);

// 2. Xác thực mã OTP
router.post(
  ['/otp/verify', '/auth/otp/verify', '/api/auth/otp/verify', '/api/v1/auth/otp/verify'],
  authRateLimiter,
  authController.verifyOTP
);

// 3. Đăng ký tài khoản (kèm xác thực OTP)
router.post(
  ['/register', '/auth/register', '/api/auth/register', '/api/v1/auth/register'],
  authRateLimiter,
  authController.register
);

// 4. Quên mật khẩu / Đặt lại mật khẩu
router.post(
  ['/reset-password', '/auth/reset-password', '/api/auth/reset-password', '/api/v1/auth/reset-password'],
  authRateLimiter,
  authController.resetPassword
);

// 5. Đăng nhập - Chống Brute-force mật khẩu
router.post(
  ['/login', '/auth/login', '/api/auth/login', '/api/v1/auth/login'],
  authRateLimiter,
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

// Đăng nhập Admin - Chống Brute-force tài khoản quản trị
router.post(
  ['/admin/login', '/auth/admin/login', '/api/auth/admin/login', '/api/v1/auth/admin/login'],
  authRateLimiter,
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

// Cấu hình kiểm soát xác minh số điện thoại hệ thống (Admin only)
router.get(
  ['/admin/config/phone-verification', '/auth/admin/config/phone-verification', '/api/auth/admin/config/phone-verification', '/api/v1/auth/admin/config/phone-verification'],
  verifyToken,
  requireAdmin,
  authController.getAdminPhoneVerificationConfig
);

router.put(
  ['/admin/config/phone-verification', '/auth/admin/config/phone-verification', '/api/auth/admin/config/phone-verification', '/api/v1/auth/admin/config/phone-verification'],
  verifyToken,
  requireAdmin,
  authController.updateAdminPhoneVerificationConfig
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

// -----------------------------------------------------------------------------
// XU TÍCH LŨY (FOODFAST COINS)
// -----------------------------------------------------------------------------
router.get(
  ['/coins/balance', '/auth/coins/balance', '/api/auth/coins/balance', '/api/v1/auth/coins/balance'],
  verifyToken,
  authController.getCoinsBalance
);

router.post(
  ['/coins/reward', '/auth/coins/reward', '/api/auth/coins/reward', '/api/v1/auth/coins/reward'],
  authController.rewardCoins
);

router.post(
  ['/coins/deduct', '/auth/coins/deduct', '/api/auth/coins/deduct', '/api/v1/auth/coins/deduct'],
  verifyToken,
  authController.deductCoins
);

// -----------------------------------------------------------------------------
// SỔ ĐỊA CHỈ GIAO HÀNG (MULTI-ADDRESS MANAGEMENT & DEFAULT PICKER)
// -----------------------------------------------------------------------------
router.get(
  ['/addresses', '/auth/addresses', '/api/auth/addresses', '/api/v1/auth/addresses'],
  verifyToken,
  authController.getAddresses
);

router.post(
  ['/addresses', '/auth/addresses', '/api/auth/addresses', '/api/v1/auth/addresses'],
  verifyToken,
  authController.addAddress
);

router.put(
  ['/addresses/:id', '/auth/addresses/:id', '/api/auth/addresses/:id', '/api/v1/auth/addresses/:id'],
  verifyToken,
  authController.updateAddress
);

router.patch(
  ['/addresses/:id/default', '/auth/addresses/:id/default', '/api/auth/addresses/:id/default', '/api/v1/auth/addresses/:id/default'],
  verifyToken,
  authController.setDefaultAddress
);

router.delete(
  ['/addresses/:id', '/auth/addresses/:id', '/api/auth/addresses/:id', '/api/v1/auth/addresses/:id'],
  verifyToken,
  authController.deleteAddress
);

// -----------------------------------------------------------------------------
// ĐIỂM DANH HÀNG NGÀY & NHẬN QUÀ THEO MỐC (DAILY CHECK-IN)
// -----------------------------------------------------------------------------
router.get(
  ['/checkin/status', '/auth/checkin/status', '/api/auth/checkin/status', '/api/v1/auth/checkin/status'],
  verifyToken,
  checkInController.getCheckInStatus
);

router.post(
  ['/checkin/claim-daily', '/auth/checkin/claim-daily', '/api/auth/checkin/claim-daily', '/api/v1/auth/checkin/claim-daily'],
  verifyToken,
  checkInController.claimDailyCheckIn
);

router.post(
  ['/checkin/claim-milestone', '/auth/checkin/claim-milestone', '/api/auth/checkin/claim-milestone', '/api/v1/auth/checkin/claim-milestone'],
  verifyToken,
  checkInController.claimMilestoneReward
);

router.get(
  ['/checkin/verify-giam30k-eligibility', '/auth/checkin/verify-giam30k-eligibility', '/api/auth/checkin/verify-giam30k-eligibility', '/api/v1/auth/checkin/verify-giam30k-eligibility'],
  checkInController.verifyGiam30kEligibility
);

module.exports = router;
