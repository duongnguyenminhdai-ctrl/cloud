/**
 * ==============================================================================
 * UPTIME PINGER / KEEP-ALIVE SCRIPT CHO RENDER FREE TIER
 * ==============================================================================
 * Mục đích:
 * Render Free Tier sẽ tự động "ngủ" (spin down) sau 15 phút không có request,
 * khiến lượt truy cập tiếp theo bị trễ từ 50-60 giây (cold start).
 * Script này định kỳ gửi request GET /health tới các services (mỗi 10-12 phút)
 * để giữ cho tất cả microservices luôn thức (always awake/warm).
 * ==============================================================================
 */

const https = require('https');
const http = require('http');

// Danh sách URL các microservices (được nạp từ biến môi trường hoặc danh sách mặc định)
const SERVICES_TO_PING = process.env.PING_TARGETS
  ? process.env.PING_TARGETS.split(',').map((s) => s.trim())
  : [
      process.env.RENDER_AUTH_URL || 'https://food-delivery-auth-service.onrender.com/health',
      process.env.RENDER_RESTAURANT_URL || 'https://food-delivery-restaurant-service.onrender.com/health',
      process.env.RENDER_ORDER_URL || 'https://food-delivery-order-service.onrender.com/health',
      process.env.RENDER_PAYMENT_URL || 'https://food-delivery-payment-service.onrender.com/health',
      process.env.RENDER_DELIVERY_URL || 'https://food-delivery-delivery-service.onrender.com/health',
      process.env.RENDER_GATEWAY_URL || 'http://localhost:8080/health',
    ];

const INTERVAL_MINUTES = parseInt(process.env.PING_INTERVAL_MINUTES || '10', 10);
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

function pingUrl(urlStr) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(urlStr, { timeout: 15000 }, (res) => {
        const duration = Date.now() - startTime;
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          resolve({
            url: urlStr,
            status: res.statusCode,
            duration,
            success: res.statusCode >= 200 && res.statusCode < 400,
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          url: urlStr,
          status: 'ERROR',
          duration: Date.now() - startTime,
          error: err.message,
          success: false,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          url: urlStr,
          status: 'TIMEOUT',
          duration: Date.now() - startTime,
          error: 'Quá thời gian 15s',
          success: false,
        });
      });
    } catch (e) {
      resolve({
        url: urlStr,
        status: 'INVALID_URL',
        duration: 0,
        error: e.message,
        success: false,
      });
    }
  });
}

async function runPingCycle() {
  const timestamp = new Date().toLocaleString('vi-VN');
  console.log(`\n[${timestamp}] 🔔 Bắt đầu lượt Ping Keep-Alive tới ${SERVICES_TO_PING.length} services...`);

  const results = await Promise.all(SERVICES_TO_PING.map(pingUrl));

  for (const r of results) {
    if (r.success) {
      console.log(`  ✅ [${r.status}] (${r.duration}ms) -> ${r.url}`);
    } else {
      console.log(`  ⚠️ [${r.status}] (${r.duration}ms) -> ${r.url} (${r.error || 'Thất bại'})`);
    }
  }

  console.log(`[${timestamp}] 💤 Hoàn thành lượt ping. Lượt tiếp theo sau ${INTERVAL_MINUTES} phút.\n`);
}

// Kiểm tra cờ chạy 1 lần (--once) hoặc chạy lặp định kỳ
const isOnce = process.argv.includes('--once');

if (isOnce) {
  runPingCycle().then(() => process.exit(0));
} else {
  runPingCycle();
  setInterval(runPingCycle, INTERVAL_MS);
}

