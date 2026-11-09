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

// Cấu hình client hỗ trợ cả Redis thông thường và Upstash Cloud Redis (rediss:// TLS)
const clientOptions = {
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Tự động retry sau tối đa 5 giây khi rớt mạng
      return Math.min(retries * 500, 5000);
    }
  }
};

// Kích hoạt cấu hình TLS nếu dùng giao thức rediss:// của Upstash
if (isTLS) {
  clientOptions.socket.tls = true;
  clientOptions.socket.rejectUnauthorized = false; // Đảm bảo bắt tay TLS mượt mà trên môi trường cloud
}

const client = createClient(clientOptions);

// Lắng nghe các sự kiện và KHÔNG BAO GIỜ để lỗi làm crash ứng dụng
client.on('error', (err) => {
  console.warn(`[Redis Cache] ⚠️ Cảnh báo kết nối (${maskUrl(REDIS_URL)}):`, err.message);
  console.warn(`[Redis Cache] ℹ️ Hệ thống tự động kích hoạt chế độ Fallback: Truy vấn trực tiếp từ MongoDB Atlas.`);
});

client.on('connect', () => {
  console.log(`[Redis Cache] 🔌 Đang kết nối tới ${isTLS ? 'Upstash Redis (TLS)' : 'Redis'}: ${maskUrl(REDIS_URL)}...`);
});

client.on('ready', () => {
  console.log(`[Redis Cache] ✅ Đã kết nối thành công tới Redis Cache!`);
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
    console.warn(`[Redis Cache] ⚠️ Không thể kết nối Redis lúc khởi động (${err.message}). Tự động fallback về MongoDB Atlas.`);
  }
}

// Khởi chạy kết nối Redis trong background
connectRedis().catch(() => {});

/**
 * Đọc dữ liệu từ Redis Cache theo Key (Fallback về null nếu lỗi)
 */
async function getCache(key) {
  try {
    if (!client.isOpen) return null;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn(`[Redis Cache] ⚠️ Lỗi đọc cache key "${key}":`, err.message);
    return null; // Tự động fallback về query database
  }
}

/**
 * Ghi dữ liệu vào Redis Cache kèm thời gian TTL (mặc định 3600s = 1 giờ)
 */
async function setCache(key, value, ttlSeconds = 3600) {
  try {
    if (!client.isOpen) return false;
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.warn(`[Redis Cache] ⚠️ Lỗi ghi cache key "${key}":`, err.message);
    return false;
  }
}

/**
 * Xóa một hoặc nhiều keys trong Redis Cache
 */
async function deleteCache(...keys) {
  try {
    if (!client.isOpen || keys.length === 0) return 0;
    const validKeys = keys.filter(Boolean);
    if (validKeys.length === 0) return 0;
    return await client.del(validKeys);
  } catch (err) {
    console.warn(`[Redis Cache] ⚠️ Lỗi xóa cache:`, err.message);
    return 0;
  }
}

/**
 * Invalidate Cache: Tự động xóa cache danh sách & cache chi tiết quán ăn
 */
async function invalidateRestaurantCache(restaurantId = null) {
  const baseKeys = [
    'restaurants:all',
    'restaurants:city:all',
    'restaurants:city:hcm',
    'restaurants:city:hn',
    'restaurants:city:dn',
    'restaurants:city:ct',
    'restaurants:city:hp',
    'restaurants:city:bd',
    'restaurants:city:binhduong'
  ];
  const keysToDelete = [...baseKeys];
  if (restaurantId) {
    keysToDelete.push(`menu:${restaurantId}`);
  }

  // Quét tìm tất cả các key restaurants:* và recommended_stores:* trong Redis
  if (client.isOpen) {
    try {
      const cityKeys = await client.keys('restaurants:*');
      if (cityKeys && cityKeys.length > 0) {
        keysToDelete.push(...cityKeys);
      }
      const recKeys = await client.keys('recommended_stores:*');
      if (recKeys && recKeys.length > 0) {
        keysToDelete.push(...recKeys);
      }
    } catch (e) {
      console.warn('[Redis Cache] ⚠️ Lỗi quét keys pattern:', e.message);
    }
  }

  const uniqueKeys = Array.from(new Set(keysToDelete));
  const count = await deleteCache(...uniqueKeys);
  console.log(`[Redis Cache] 🧹 Invalidate Cache: Đã xóa ${count} keys [${uniqueKeys.join(', ')}]`);
}

/**
 * Thao tác nguyên tử DECR để trừ quota voucher (Chống Race Condition)
 */
async function decrQuota(key) {
  try {
    if (!client.isOpen) return null;
    return await client.decr(key);
  } catch (err) {
    console.warn(`[Redis Cache] ⚠️ Lỗi decr key "${key}":`, err.message);
    return null;
  }
}

/**
 * Thao tác nguyên tử INCR để hoàn lại quota voucher khi rollback
 */
async function incrQuota(key) {
  try {
    if (!client.isOpen) return null;
    return await client.incr(key);
  } catch (err) {
    console.warn(`[Redis Cache] ⚠️ Lỗi incr key "${key}":`, err.message);
    return null;
  }
}

/**
 * Đặt quota ban đầu cho voucher
 */
async function setQuota(key, value, ttlSeconds = 86400) {
  try {
    if (!client.isOpen) return false;
    await client.set(key, value.toString(), { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.warn(`[Redis Cache] ⚠️ Lỗi set quota key "${key}":`, err.message);
    return false;
  }
}

module.exports = {
  client,
  connectRedis,
  getCache,
  setCache,
  deleteCache,
  invalidateRestaurantCache,
  decrQuota,
  incrQuota,
  setQuota,
  TTL: 3600
};
