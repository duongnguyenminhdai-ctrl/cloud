const Restaurant = require('../models/Restaurant');
const { getCache, setCache } = require('../../redis');

/**
 * Tính khoảng cách đường chim bay theo công thức Haversine (km)
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Hệ số đường bộ ~1.25
  return Math.max(0.2, c * 1.25);
}

/**
 * GET /api/v1/stores/recommended
 * Thuật toán đề xuất quán ăn thông minh với Redis Caching theo Geo-grid
 * Công thức: Score = (Rating * 0.4) + (1 / (Distance + 0.1) * 0.4) + (CompletedOrders * 0.2)
 */
exports.getRecommendedStores = async (req, res) => {
  try {
    const userLat = parseFloat(req.query.user_lat) || 10.7769;
    const userLng = parseFloat(req.query.user_lng) || 106.7009;

    // 1. Tạo Redis Cache Key theo khu vực lưới tọa độ (Geo-Grid ~1km)
    const latGrid = Math.round(userLat * 100);
    const lngGrid = Math.round(userLng * 100);
    const cacheKey = `recommended_stores:${latGrid}_${lngGrid}`;

    // 2. Bước 1: Kiểm tra xem key có trên Redis không (Cache Hit)
    const cachedData = await getCache(cacheKey);
    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
      console.log(`[Recommendation] ⚡ [Cache Hit] Lấy ${cachedData.length} quán đề xuất từ Redis Key [${cacheKey}]`);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        cache_key: cacheKey,
        data: cachedData
      });
    }

    // 3. Bước 2 (Cache Miss): Truy vấn MongoDB Atlas & Tính điểm xếp hạng
    console.log(`[Recommendation] 🔍 [Cache Miss] Đang tính toán điểm đề xuất thông minh cho vị trí (${userLat}, ${userLng})...`);

    const stores = await Restaurant.find({
      $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }]
    }).lean();

    const rankedStores = stores.map((store) => {
      const storeLat = store.latitude || 10.7769;
      const storeLng = store.longitude || 106.7009;

      // Khoảng cách ước tính (km)
      const distKm = parseFloat(calculateHaversineKm(userLat, userLng, storeLat, storeLng).toFixed(1));

      // Thông số đánh giá & số đơn hoàn tất
      const rating = typeof store.rating === 'number' ? store.rating : 5.0;
      const completedOrders = typeof store.completed_orders === 'number' ? store.completed_orders : 20;

      // Chuẩn hóa Completed Orders (quy về thang điểm phù hợp để không áp đảo hoàn toàn khoảng cách)
      const normalizedOrders = Math.min(10, completedOrders / 10);

      // Công thức tính điểm đề xuất (Ranking Score) theo đúng yêu cầu:
      // Score = (Rating * 0.4) + ( (1 / (Distance + 0.1)) * 0.4 ) + (CompletedOrders * 0.2)
      const distanceFactor = (1 / (distKm + 0.1)) * 0.4;
      const ratingFactor = rating * 0.4;
      const orderFactor = normalizedOrders * 0.2;
      const totalScore = parseFloat((ratingFactor + distanceFactor + orderFactor).toFixed(3));

      return {
        ...store,
        calculated_distance_km: distKm,
        recommendation_score: totalScore,
        score_breakdown: {
          rating_factor: parseFloat(ratingFactor.toFixed(2)),
          distance_factor: parseFloat(distanceFactor.toFixed(2)),
          order_factor: parseFloat(orderFactor.toFixed(2))
        }
      };
    });

    // 4. Sắp xếp danh sách quán theo thứ tự Score giảm dần
    rankedStores.sort((a, b) => b.recommendation_score - a.recommendation_score);

    // 5. Lưu kết quả vào Redis với TTL = 300 giây (5 phút)
    await setCache(cacheKey, rankedStores, 300);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({
      success: true,
      source: 'database',
      count: rankedStores.length,
      cache_key: cacheKey,
      data: rankedStores
    });
  } catch (error) {
    console.error('[Recommendation] ❌ Lỗi tính toán đề xuất quán:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đề xuất quán ăn: ' + error.message
    });
  }
};

