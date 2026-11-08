/**
 * Pricing Engine phía Frontend (Dynamic Surge Pricing)
 * Tính toán cước phí giao hàng linh hoạt theo khoảng cách, khung giờ & thời tiết
 */

export function getClientVietnamHour() {
  try {
    const now = new Date();
    const vnTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    return new Date(vnTimeString).getHours();
  } catch {
    return new Date().getHours();
  }
}

/**
 * Tính cước phí giao hàng linh hoạt chuẩn ShopeeFood / FoodFast
 *
 * @param {Object} params
 * @param {number} params.distanceKm Khoảng cách giao hàng (km)
 * @param {{ lat?: number, lng?: number }} [params.userCoords] Tọa độ người nhận
 * @param {{ hour?: number, mock_hour?: number, isRaining?: boolean, simulate_rain?: boolean|string }} [params.mockParams] Tham số demo
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
export async function calculateShippingFee({ distanceKm, userCoords = {}, mockParams = {} }) {
  const safeDistance =
    typeof distanceKm === 'number' && !Number.isNaN(distanceKm) && distanceKm > 0
      ? Math.round(distanceKm * 10) / 10
      : 2.0;

  // 1. Cước theo khoảng cách: 16.000đ cho 2 km đầu, mỗi km tiếp theo +5.000đ/km
  let baseFee = 16000;
  if (safeDistance > 2) {
    baseFee += Math.round((safeDistance - 2) * 5000);
  }

  // 2. Phụ phí khung giờ (Time Surge)
  let activeHour = getClientVietnamHour();
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

  // 3. Phụ phí thời tiết (Weather Surge)
  let isRaining = false;
  if (mockParams.isRaining !== undefined) {
    isRaining = Boolean(mockParams.isRaining);
  } else if (mockParams.simulate_rain !== undefined) {
    isRaining = mockParams.simulate_rain === true || mockParams.simulate_rain === 'true';
  } else {
    // Thử truy vấn Open-Meteo trực tiếp từ client
    try {
      const lat = userCoords.lat || 10.78;
      const lng = userCoords.lng || 106.70;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(2)}&longitude=${Number(lng).toFixed(2)}&current=precipitation`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        isRaining = Number(data?.current?.precipitation || 0) > 0;
      }
    } catch {}
  }

  const weatherSurcharge = {
    amount: isRaining ? 5000 : 0,
    isRaining,
    reason: isRaining ? 'Phụ phí thời tiết mưa bão' : null
  };

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
