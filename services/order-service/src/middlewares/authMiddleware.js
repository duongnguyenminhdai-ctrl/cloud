const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

/**
 * Hàm giải mã và xác thực JWT HS256 chuẩn Native Node.js (chống Timing Attacks & không phụ thuộc external lib)
 */
function verifyJwtToken(token, secret = JWT_SECRET) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    const sigBuf = Buffer.from(signatureB64, 'utf-8');
    const expBuf = Buffer.from(expectedSig, 'utf-8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Middleware bắt buộc xác thực JWT Token
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

  const decoded = verifyJwtToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn.'
    });
  }

  req.user = decoded; // { userId, role, email, name, ... }
  next();
};

/**
 * Middleware kiểm tra token tuỳ chọn (gắn req.user nếu có token hợp lệ)
 */
const optionalAuth = (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    const decoded = verifyJwtToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
};

module.exports = {
  verifyToken,
  optionalAuth,
  verifyJwtToken
};
