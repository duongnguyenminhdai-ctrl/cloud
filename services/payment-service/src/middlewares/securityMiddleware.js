/**
 * Middleware bảo mật chuẩn STRIDE cho Payment Service:
 * - Tampering: Làm sạch payload chống NoSQL Injection
 * - Information Disclosure: Thêm HTTP Security Headers chuẩn
 */

function cleanNoSqlKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanNoSqlKeys(item));
  }
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = cleanNoSqlKeys(obj[key]);
  }
  return clean;
}

const sanitizeNoSql = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanNoSqlKeys(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = cleanNoSqlKeys(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = cleanNoSqlKeys(req.params);
  }
  next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

module.exports = {
  sanitizeNoSql,
  securityHeaders
};
