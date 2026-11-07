const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

// 1. Áp dụng mã giảm giá (POST /api/v1/vouchers/apply)
router.post(['/apply', '/vouchers/apply'], voucherController.applyVoucher);

// 2. Lấy danh sách mã giảm giá (GET /api/v1/vouchers)
router.get(['/', '/vouchers'], voucherController.getVouchers);

// 3. Tạo mã giảm giá mới (POST /api/v1/vouchers)
router.post(['/', '/vouchers'], voucherController.createVoucher);

module.exports = router;
