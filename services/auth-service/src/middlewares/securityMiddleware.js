/**
 * Security Middleware: Chống NoSQL Injection, DoS Brute-force & X-Frame Clickjacking
 * Chuẩn STRIDE: Tampering (T), Denial of Service (D), Information Disclosure (I)
 */

/**
 * 1. Chống NoSQL Injection (Loại bỏ các toán tử $, . trong Object keys)
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Chặn keys bắt đầu bằng $ (toán tử MongoDB như $ne, $gt, $where...) hoặc chứa dấu chấm
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const sanitizeNoSql = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};

/**
 * 2. HTTP Security Headers (Helmet-light)
 */
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

/**
 * 3. Rate Limiter in-memory chống Brute-force và DoS
 */
function createRateLimiter({ windowMs = 60000, max = 60, message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }) {
  const hits = new Map();

  // Dọn dẹp bộ nhớ định kỳ mỗi 5 phút
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of hits.entries()) {
      if (now - data.resetTime > windowMs) {
        hits.delete(ip);
      }
    }
  }, 300000);

  return (req, res, next) => {
    // Không chặn test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const now = Date.now();
    let record = hits.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(ip, record);
      return next();
    }

    record.count++;
    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        message: `${message} Vui lòng thử lại sau ${retryAfterSec} giây.`
      });
    }

    next();
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 phút
  max: 30, // 30 lần đăng nhập/đăng ký / phút / IP
  message: 'Bạn đã thao tác đăng nhập / đăng ký quá nhiều lần.'
});

const otpRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 phút
  max: 10, // 10 lần gửi OTP / phút / IP
  message: 'Bạn đã yêu cầu gửi mã OTP quá nhiều lần.'
});

module.exports = {
  sanitizeNoSql,
  securityHeaders,
  createRateLimiter,
  authRateLimiter,
  otpRateLimiter
};
