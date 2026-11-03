const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const isTLS = REDIS_URL.startsWith('rediss://');

const clientOptions = {
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 500, 5000)
  }
};

if (isTLS) {
  clientOptions.socket.tls = true;
  clientOptions.socket.rejectUnauthorized = false;
}

const client = createClient(clientOptions);

client.on('error', (err) => {
  console.warn(`[Auth Redis] ⚠️ Cảnh báo kết nối Redis: ${err.message}. Tự động fallback sang Memory Cache.`);
});

client.on('connect', () => {
  console.log(`[Auth Redis] 🔌 Đang kết nối tới Redis: ${REDIS_URL}...`);
});

client.on('ready', () => {
  console.log(`[Auth Redis] ✅ Đã kết nối thành công tới Redis!`);
});

let isConnecting = false;
async function connectRedis() {
  if (client.isOpen || isConnecting) return;
  isConnecting = true;
  try {
    await client.connect();
    isConnecting = false;
  } catch (err) {
    isConnecting = false;
    console.warn(`[Auth Redis] ⚠️ Không thể kết nối Redis lúc khởi động: ${err.message}. Kích hoạt Fallback RAM.`);
  }
}

connectRedis().catch(() => {});

// Bộ nhớ đệm Memory Fallback phòng khi Redis gặp sự cố
const memoryCache = new Map();

/**
 * Kiểm tra Rate limit gửi OTP (Tối đa 1 lần / 60 giây)
 */
async function checkAndSetRateLimit(type, email, windowSeconds = 60) {
  const key = `ratelimit:otp:${type}:${email.toLowerCase().trim()}`;
  try {
    if (client.isOpen) {
      const exists = await client.get(key);
      if (exists) {
        const ttl = await client.ttl(key);
        return { allowed: false, remaining: ttl > 0 ? ttl : windowSeconds };
      }
      await client.set(key, '1', { EX: windowSeconds });
      return { allowed: true };
    }
  } catch (err) {
    console.warn('[Auth Redis] ⚠️ Lỗi rate limit Redis, chuyển sang memory:', err.message);
  }

  // Memory Fallback
  const mem = memoryCache.get(key);
  const now = Date.now();
  if (mem && mem.expireAt > now) {
    const remaining = Math.ceil((mem.expireAt - now) / 1000);
    return { allowed: false, remaining };
  }
  memoryCache.set(key, { value: '1', expireAt: now + windowSeconds * 1000 });
  return { allowed: true };
}

/**
 * Lưu mã OTP vào Redis (Key: otp:<type>:<email>, TTL: 300s = 5 phút)
 */
async function saveOTP(type, email, otp, ttlSeconds = 300) {
  const key = `otp:${type}:${email.toLowerCase().trim()}`;
  try {
    if (client.isOpen) {
      await client.set(key, otp.toString(), { EX: ttlSeconds });
      return true;
    }
  } catch (err) {
    console.warn('[Auth Redis] ⚠️ Lỗi lưu OTP Redis:', err.message);
  }

  // Memory Fallback
  const expireAt = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { value: otp.toString(), expireAt });
  return true;
}

/**
 * Lấy mã OTP từ Redis
 */
async function getOTP(type, email) {
  const key = `otp:${type}:${email.toLowerCase().trim()}`;
  try {
    if (client.isOpen) {
      return await client.get(key);
    }
  } catch (err) {
    console.warn('[Auth Redis] ⚠️ Lỗi đọc OTP Redis:', err.message);
  }

  // Memory Fallback
  const mem = memoryCache.get(key);
  if (mem && mem.expireAt > Date.now()) {
    return mem.value;
  }
  return null;
}

/**
 * Xóa mã OTP sau khi xác thực thành công
 */
async function deleteOTP(type, email) {
  const key = `otp:${type}:${email.toLowerCase().trim()}`;
  try {
    if (client.isOpen) {
      await client.del(key);
    }
  } catch (err) {
    console.warn('[Auth Redis] ⚠️ Lỗi xóa OTP Redis:', err.message);
  }
  memoryCache.delete(key);
}

module.exports = {
  client,
  connectRedis,
  checkAndSetRateLimit,
  saveOTP,
  getOTP,
  deleteOTP
};

