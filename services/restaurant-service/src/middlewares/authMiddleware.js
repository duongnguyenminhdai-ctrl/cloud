const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

/**
 * Middleware xác thực JWT Token từ Header Authorization
 */
const verifyToken = (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy Token xác thực. Vui lòng đăng nhập.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, role, email, name, ... }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn: ' + error.message
    });
  }
};

/**
 * Middleware chỉ cho phép Quản trị viên (ADMIN) truy cập
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối. Chỉ dành riêng cho Quản trị viên (ADMIN).'
    });
  }
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  JWT_SECRET
};
