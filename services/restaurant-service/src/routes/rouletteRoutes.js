const express = require('express');
const router = express.Router();
const rouletteController = require('../controllers/rouletteController');
const { verifyToken } = require('../middlewares/authMiddleware');

/**
 * Decision Roulette Routes
 * Phụ trách tính năng "Hôm nay ăn gì?" - Vòng quay chọn món nhận ưu đãi x2 Xu FoodFast.
 */

// 1. Quay thưởng (Yêu cầu đăng nhập)
router.post(['/spin', '/'], verifyToken, rouletteController.spinRoulette);

// 2. Tra cứu số lượt quay còn lại trong ngày (Yêu cầu đăng nhập)
router.get(['/status'], verifyToken, rouletteController.getRouletteStatus);

// 3. Tra cứu thông tin và tính hợp lệ của phiên quay thưởng
router.get(['/session/:sessionId'], rouletteController.getRouletteSession);

// 4. Xác thực và tiêu thụ phiên quay thưởng khi tạo đơn hàng (Order Service gọi)
router.post(['/session/:sessionId/consume'], rouletteController.consumeRouletteSession);

module.exports = router;
