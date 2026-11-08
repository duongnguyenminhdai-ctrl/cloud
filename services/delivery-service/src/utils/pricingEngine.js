const { getWeatherStatus } = require('./weatherService');

/**
 * Lấy giờ hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7)
 */
function getVietnamHour() {
  try {
    const now = new Date();
    const vnTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    return new Date(vnTimeString).getHours();
  } catch {
    return new Date().getHours();
  }
}

/**
 * Tính cước phí giao hàng linh hoạt theo chuẩn ShopeeFood / FoodFast
 * (Dynamic Surge Pricing theo khoảng cách, khung giờ & thời tiết)
 *
 * @param {Object} params
 * @param {number} params.distanceKm Khoảng cách giao hàng (km)
 * @param {{ lat?: number, lng?: number }} [params.userCoords] Tọa độ giao hàng
 * @param {{ hour?: number, mock_hour?: number, isRaining?: boolean, simulate_rain?: boolean|string }} [params.mockParams] Tham số mô phỏng thuyết trình
 * @returns {Promise<{
 *   distanceKm: number,
 *   baseFee: number,
 *   surcharges: {
 *     time: { amount: number, reason: string|null },
 *     weather: { amount: number, isRaining: boolean, reason: string|null }
 *   },
 *   totalShippingFee: number
 * }>}
 */
async function calculateShippingFee({ distanceKm, userCoords = {}, mockParams = {} }) {
  // 1. Chuẩn hóa khoảng cách (km)
  const safeDistance =
    typeof distanceKm === 'number' && !Number.isNaN(distanceKm) && distanceKm > 0
      ? Math.round(distanceKm * 10) / 10
      : 2.0;

  // 2. Tính cước cơ bản theo khoảng cách: 16.000đ cho 2 km đầu, mỗi km tiếp theo +5.000đ/km
  let baseFee = 16000;
  if (safeDistance > 2) {
    baseFee += Math.round((safeDistance - 2) * 5000);
  }

  // 3. Phụ phí khung giờ (Time Surge)
  // - Ban đêm / Khuya muộn (22:00 – 06:00 sáng hôm sau): Cộng 8.000đ/đơn
  // - Giờ cao điểm trưa (11:00 – 13:00) hoặc tối (18:00 – 20:00): Cộng 5.000đ/đơn
  let activeHour = getVietnamHour();
  if (mockParams.hour !== undefined && !Number.isNaN(Number(mockParams.hour))) {
    activeHour = Number(mockParams.hour);
  } else if (mockParams.mock_hour !== undefined && !Number.isNaN(Number(mockParams.mock_hour))) {
    activeHour = Number(mockParams.mock_hour);
  }

  let timeSurcharge = {
    amount: 0,
    reason: null
  };

  if (activeHour >= 22 || activeHour < 6) {
    timeSurcharge = {
      amount: 8000,
      reason: 'Phụ phí giao đêm khuya (22h-06h)'
    };
  } else if (activeHour >= 11 && activeHour < 13) {
    timeSurcharge = {
      amount: 5000,
      reason: 'Phụ phí giờ cao điểm (11h-13h)'
    };
  } else if (activeHour >= 18 && activeHour < 20) {
    timeSurcharge = {
      amount: 5000,
      reason: 'Phụ phí giờ cao điểm (18h-20h)'
    };
  }

  // 4. Phụ phí thời tiết xấu (Weather Surge): Cộng thêm 5.000đ nếu đang mưa
  const weatherResult = await getWeatherStatus(userCoords, mockParams);
  let weatherSurcharge = {
    amount: 0,
    isRaining: false,
    reason: null
  };

  if (weatherResult && weatherResult.isRaining) {
    weatherSurcharge = {
      amount: 5000,
      isRaining: true,
      reason: 'Phụ phí thời tiết mưa bão'
    };
  }

  // 5. Tổng cước phí vận chuyển
  const totalShippingFee = baseFee + timeSurcharge.amount + weatherSurcharge.amount;

  return {
    distanceKm: safeDistance,
    baseFee,
    surcharges: {
      time: timeSurcharge,
      weather: weatherSurcharge
    },
    totalShippingFee
  };
}

module.exports = {
  calculateShippingFee,
  getVietnamHour
};

