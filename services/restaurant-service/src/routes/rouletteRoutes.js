const express = require('express');
const router = express.Router();
const rouletteController = require('../controllers/rouletteController');
const { verifyToken, requireAdmin } = require('../middlewares/authMiddleware');

/**
 * Decision Roulette Routes
 * Phụ trách tính năng "Hôm nay ăn gì?" - Hòm quay chọn món giải trí, không giới hạn lượt.
 */

// 1. Quay chọn món ngẫu nhiên (Public, không giới hạn lượt)
router.post(['/spin', '/'], rouletteController.spinRoulette);

// 2. Tra cứu trạng thái vòng quay (không giới hạn lượt)
router.get(['/status'], rouletteController.getRouletteStatus);

// 3. Tra cứu thông tin và tính hợp lệ của phiên quay thưởng
router.get(['/session/:sessionId'], rouletteController.getRouletteSession);

// 4. Xác thực và tiêu thụ phiên quay thưởng khi tạo đơn hàng (Order Service gọi)
router.post(['/session/:sessionId/consume'], rouletteController.consumeRouletteSession);

// 5. Lấy danh sách config hòm quay (public, không cần auth)
router.get('/config', rouletteController.getRouletteConfig);

// 6. Admin cập nhật config hòm quay (cần đăng nhập + quyền ADMIN)
router.put('/config', verifyToken, requireAdmin, rouletteController.updateRouletteConfig);

module.exports = router;
