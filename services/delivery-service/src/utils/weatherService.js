const { getCache, setCache } = require('../redis');

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL = 900; // 900 giây = 15 phút theo yêu cầu

/**
 * Lấy trạng thái thời tiết (có mưa hay không) tại tọa độ GPS
 * Tích hợp Open-Meteo API, Redis Cache (TTL 15m), và Demo Simulator
 *
 * @param {{ lat?: number, lng?: number }} [userCoords] Tọa độ người dùng/điểm giao hàng
 * @param {{ isRaining?: boolean, simulate_rain?: boolean|string }} [mockParams] Cờ giả lập phục vụ thuyết trình
 * @returns {Promise<{ isRaining: boolean, precipitation: number, fromCache?: boolean, isMocked?: boolean }>}
 */
async function getWeatherStatus(userCoords = {}, mockParams = {}) {
  // 1. Kiểm tra cờ giả lập Demo Simulator (simulate_rain hoặc isRaining)
  const isMockedRain =
    mockParams.isRaining !== undefined
      ? Boolean(mockParams.isRaining)
      : mockParams.simulate_rain === true || mockParams.simulate_rain === 'true';

  if (mockParams.isRaining !== undefined || mockParams.simulate_rain !== undefined) {
    console.log(`[WeatherService] 🎭 [Demo Simulator] Kích hoạt giả lập thời tiết: isRaining=${isMockedRain}`);
    return {
      isRaining: isMockedRain,
      precipitation: isMockedRain ? 5.2 : 0,
      isMocked: true
    };
  }

  // 2. Chuẩn hóa tọa độ GPS (mặc định trung tâm TP.HCM nếu không truyền)
  const lat = typeof userCoords.lat === 'number' ? userCoords.lat : 10.78;
  const lng = typeof userCoords.lng === 'number' ? userCoords.lng : 106.70;

  const latShort = Number(lat).toFixed(2);
  const lngShort = Number(lng).toFixed(2);
  const cacheKey = `weather:${latShort}_${lngShort}`;

  // 3. Kiểm tra dữ liệu trong Redis Cache
  try {
    const cachedWeather = await getCache(cacheKey);
    if (cachedWeather) {
      console.log(`[WeatherService] ⚡ [Cache Hit] Thời tiết từ Redis [${cacheKey}]: isRaining=${cachedWeather.isRaining}`);
      return {
        ...cachedWeather,
        fromCache: true
      };
    }
  } catch (err) {
    console.warn(`[WeatherService] ⚠️ Lỗi đọc cache:`, err.message);
  }

  // 4. Cache Miss: Gọi Open-Meteo API (Timeout 4s)
  try {
    const url = `${OPEN_METEO_BASE_URL}?latitude=${latShort}&longitude=${lngShort}&current=precipitation`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Open-Meteo trả về HTTP ${response.status}`);
    }

    const data = await response.json();
    const precipitation = Number(data?.current?.precipitation || 0);
    const isRaining = precipitation > 0;

    const weatherData = {
      isRaining,
      precipitation,
      lat: Number(latShort),
      lng: Number(lngShort),
      updatedAt: new Date().toISOString()
    };

    // 5. Lưu vào Redis Cache với TTL = 900 giây (15 phút)
    await setCache(cacheKey, weatherData, WEATHER_CACHE_TTL);
    console.log(`[WeatherService] 🔍 [Cache Miss] Đã cập nhật Open-Meteo vào Redis [${cacheKey}]: precipitation=${precipitation}mm, isRaining=${isRaining}`);

    return weatherData;
  } catch (err) {
    console.warn(`[WeatherService] ⚠️ Không thể kết nối Open-Meteo API (${err.message}). Tự động fallback về trời đẹp không mưa.`);
    return {
      isRaining: false,
      precipitation: 0,
      isFallback: true
    };
  }
}

module.exports = {
  getWeatherStatus,
  WEATHER_CACHE_TTL
};
