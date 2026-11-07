/**
 * Tiện ích tính khoảng cách và thời gian giao hàng thực tế
 * Sử dụng OpenStreetMap / OSRM API (Open Source Routing Machine)
 * Hỗ trợ in-memory cache, in-flight request deduplication và Haversine fallback.
 */

// In-memory cache lưu kết quả tính toán lộ trình
const estimateCache = new Map();
// Deduplicate các request đang bay (in-flight)
const pendingRequests = new Map();

/**
 * Tính khoảng cách đường chim bay theo công thức Haversine (km)
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Tính ước lượng dự phòng (Fallback) khi API OSRM bị lỗi hoặc timeout
 * Sử dụng khoảng cách Haversine * 1.25 (hệ số uốn lượn đường bộ thành phố)
 */
export function computeFallbackEstimate(userCoord, storeCoord, prepTime = 15) {
  if (
    !userCoord ||
    typeof userCoord.lat !== 'number' ||
    typeof userCoord.lng !== 'number' ||
    !storeCoord ||
    typeof storeCoord.lat !== 'number' ||
    typeof storeCoord.lng !== 'number'
  ) {
    return {
      distanceKm: '2.5',
      drivingMinutes: 7,
      minEstimate: prepTime + 7,
      maxEstimate: prepTime + 17,
      isFallback: true
    };
  }

  const directKm = calculateHaversineDistance(
    userCoord.lat,
    userCoord.lng,
    storeCoord.lat,
    storeCoord.lng
  );
  // Hệ số khúc khuỷu đường bộ TP.HCM ~ 1.25
  const roadKm = Math.max(0.3, directKm * 1.25);
  // Vận tốc trung bình xe máy đô thị khoảng 24 km/h (~ 2.5 phút/km)
  const drivingMinutes = Math.max(3, Math.ceil((roadKm / 24) * 60));
  const minEstimate = prepTime + drivingMinutes;
  const maxEstimate = minEstimate + 10;

  return {
    distanceKm: roadKm.toFixed(1),
    drivingMinutes,
    minEstimate,
    maxEstimate,
    isFallback: true
  };
}

/**
 * Lấy thời gian và khoảng cách giao hàng bằng OSRM
 * Endpoint OSRM: https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false
 * Lưu ý quan trọng: Thứ tự tham số OSRM là {kinh_độ lng}, {vĩ_độ lat}
 *
 * @param {Object} options
 * @param {{ lat: number, lng: number }} options.userCoord Tọa độ GPS người dùng
 * @param {{ lat: number, lng: number }} options.storeCoord Tọa độ GPS quán ăn
 * @param {number} [options.prepTime=15] Thời gian chuẩn bị món (phút)
 * @param {string} [options.storeId] Mã quán ăn để tối ưu cache key
 * @returns {Promise<{ distanceKm: string, drivingMinutes: number, minEstimate: number, maxEstimate: number, isFallback: boolean }>}
 */
export async function getDeliveryEstimate({ userCoord, storeCoord, prepTime = 15, storeId = '' }) {
  const safePrep = typeof prepTime === 'number' && prepTime >= 0 ? prepTime : 15;

  if (
    !userCoord ||
    typeof userCoord.lat !== 'number' ||
    typeof userCoord.lng !== 'number' ||
    !storeCoord ||
    typeof storeCoord.lat !== 'number' ||
    typeof storeCoord.lng !== 'number'
  ) {
    return computeFallbackEstimate(userCoord, storeCoord, safePrep);
  }

  // Làm tròn tọa độ tới 3 chữ số thập phân (~100m) để cache tối ưu khi GPS dao động nhẹ
  const uLat = userCoord.lat.toFixed(3);
  const uLng = userCoord.lng.toFixed(3);
  const sLat = storeCoord.lat.toFixed(3);
  const sLng = storeCoord.lng.toFixed(3);
  const cacheKey = `${storeId || ''}_${uLng},${uLat}_${sLng},${sLat}_${safePrep}`;

  // 1. Kiểm tra cache trong bộ nhớ
  if (estimateCache.has(cacheKey)) {
    return estimateCache.get(cacheKey);
  }

  // 2. Kiểm tra nếu đang có request cùng cặp tọa độ đang chạy
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    // 3. Chuẩn bị request OSRM với AbortController (timeout 4.5 giây)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      // Chú ý: OSRM yêu cầu thứ tự: lng,lat;lng,lat
      const url = `https://router.project-osrm.org/route/v1/driving/${userCoord.lng},${userCoord.lat};${storeCoord.lng},${storeCoord.lat}?overview=false`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        // route.distance tính bằng mét
        const distanceKm = (route.distance / 1000).toFixed(1);
        // route.duration tính bằng giây
        const drivingMinutes = Math.max(2, Math.ceil(route.duration / 60));
        const minEstimate = safePrep + drivingMinutes;
        const maxEstimate = minEstimate + 10;

        const result = {
          distanceKm,
          drivingMinutes,
          minEstimate,
          maxEstimate,
          isFallback: false
        };

        estimateCache.set(cacheKey, result);
        return result;
      }

      throw new Error(data.message || 'OSRM did not return valid route');
    } catch (err) {
      clearTimeout(timeoutId);
      // Fallback về tính toán Haversine nếu mạng chậm hoặc lỗi
      const fallbackResult = computeFallbackEstimate(userCoord, storeCoord, safePrep);
      // Cache cả kết quả fallback trong 30 giây để tránh bắn liên tục vào OSRM khi down
      estimateCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

