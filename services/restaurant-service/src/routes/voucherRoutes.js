const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

// 1. Áp dụng mã giảm giá (POST /api/v1/vouchers/apply)
router.post(['/apply', '/vouchers/apply'], voucherController.applyVoucher);

// 1.1 Lấy danh sách Voucher Banner Popup trang chủ (GET /api/v1/vouchers/banners)
router.get(['/banners', '/vouchers/banners'], voucherController.getBannerVouchers);

// 2. Admin Voucher Management Routes (khi router được gọi qua tiền tố /vouchers)
router.get(['/admin', '/admin/list'], voucherController.adminGetVouchers);
router.post(['/admin', '/admin/create'], voucherController.adminCreateVoucher);
router.put('/admin/:id', voucherController.adminUpdateVoucher);
router.patch('/admin/:id/toggle', voucherController.adminToggleVoucher);
router.put('/admin/:id/toggle', voucherController.adminToggleVoucher);
router.delete('/admin/:id', voucherController.adminDeleteVoucher);

// 3. Xử lý linh hoạt khi router được mount tại /api/v1/admin/vouchers hoặc /vouchers
router.get(['/', '/vouchers'], (req, res, next) => {
  if (req.baseUrl && req.baseUrl.includes('admin')) {
    return voucherController.adminGetVouchers(req, res, next);
  }
  return voucherController.getVouchers(req, res, next);
});

router.post(['/', '/vouchers'], (req, res, next) => {
  if (req.baseUrl && req.baseUrl.includes('admin')) {
    return voucherController.adminCreateVoucher(req, res, next);
  }
  return voucherController.createVoucher(req, res, next);
});

router.put('/:id', voucherController.adminUpdateVoucher);
router.patch('/:id/toggle', voucherController.adminToggleVoucher);
router.put('/:id/toggle', voucherController.adminToggleVoucher);
router.delete('/:id', voucherController.adminDeleteVoucher);

module.exports = router;

