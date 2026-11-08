const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const isTLS = REDIS_URL.startsWith('rediss://');

function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '******';
    return u.toString();
  } catch {
    return url.replace(/:([^:@]+)@/, ':******@');
  }
}

// Cấu hình Redis client hỗ trợ cả Redis thường và Upstash Cloud Redis (TLS)
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

// In-memory fallback cache khi Redis offline
const memoryCache = new Map();

client.on('error', (err) => {
  console.warn(`[Delivery Redis] ⚠️ Cảnh báo kết nối (${maskUrl(REDIS_URL)}):`, err.message);
});

client.on('connect', () => {
  console.log(`[Delivery Redis] 🔌 Đang kết nối tới ${isTLS ? 'Upstash Redis (TLS)' : 'Redis'}: ${maskUrl(REDIS_URL)}...`);
});

client.on('ready', () => {
  console.log(`[Delivery Redis] ✅ Đã kết nối thành công tới Redis!`);
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
    console.warn(`[Delivery Redis] ⚠️ Không thể kết nối Redis lúc khởi động (${err.message}). Kích hoạt Memory Fallback.`);
  }
}

// Khởi chạy kết nối Redis trong background (tránh kết nối khi đang chạy unit tests)
if (process.env.NODE_ENV !== 'test') {
  connectRedis().catch(() => {});
}

/**
 * Đọc dữ liệu từ Redis Cache theo Key (Fallback về Memory Cache nếu Redis không khả dụng)
 */
async function getCache(key) {
  try {
    if (client.isOpen) {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (err) {
    console.warn(`[Delivery Redis] ⚠️ Lỗi đọc cache key "${key}":`, err.message);
  }

  // Fallback đọc từ memoryCache
  const memItem = memoryCache.get(key);
  if (memItem) {
    if (Date.now() < memItem.expiresAt) {
      return memItem.value;
    }
    memoryCache.delete(key);
  }
  return null;
}

/**
 * Ghi dữ liệu vào Redis Cache kèm TTL (giây)
 */
async function setCache(key, value, ttlSeconds = 900) {
  try {
    if (client.isOpen) {
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
      return true;
    }
  } catch (err) {
    console.warn(`[Delivery Redis] ⚠️ Lỗi ghi cache key "${key}":`, err.message);
  }

  // Fallback ghi vào memoryCache
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
  return true;
}

module.exports = {
  client,
  connectRedis,
  getCache,
  setCache
};
