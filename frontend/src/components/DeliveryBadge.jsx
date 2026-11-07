import React, { useEffect, useState } from 'react';
import { Clock, Navigation } from 'lucide-react';
import { getDeliveryEstimate } from '../utils/deliveryEstimate';

/**
 * Component hiển thị thời gian giao hàng và khoảng cách thực tế (OSRM API)
 * Thay thế thời gian tĩnh "15-25 phút" bằng tính toán thời gian thực theo khoảng cách đường bộ.
 */
export default function DeliveryBadge({ store, userCoord, variant = 'card' }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!userCoord || !store) return;

    // Tọa độ quán (nếu chưa có thì dùng tọa độ mặc định TP.HCM)
    const storeCoord = {
      lat: typeof store.latitude === 'number' && !isNaN(store.latitude) ? store.latitude : 10.7769,
      lng: typeof store.longitude === 'number' && !isNaN(store.longitude) ? store.longitude : 106.7009
    };

    const prepTime = typeof store.prep_time === 'number' && !isNaN(store.prep_time) ? store.prep_time : 15;

    setLoading(true);

    getDeliveryEstimate({
      userCoord,
      storeCoord,
      prepTime,
      storeId: store._id || store.id
    })
      .then((res) => {
        if (isMounted) {
          setEstimate(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Lỗi ước tính giao hàng:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    store?._id,
    store?.id,
    store?.latitude,
    store?.longitude,
    store?.prep_time,
    userCoord?.lat,
    userCoord?.lng
  ]);

  // Trạng thái chờ tải kết quả từ OSRM API
  if (loading && !estimate) {
    if (variant === 'detail') {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold animate-pulse">
          <Clock className="w-4 h-4 animate-spin text-orange-500" />
          <span>Đang tính khoảng cách & thời gian giao hàng OSRM...</span>
        </div>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-xs font-medium flex items-center gap-1.5 animate-pulse text-amber-200">
        <Clock className="w-3.5 h-3.5 animate-spin" />
        <span className="inline-block w-16 h-3 bg-white/20 rounded" />
      </span>
    );
  }

  const { minEstimate = 15, maxEstimate = 25, distanceKm = '2.5' } = estimate || {};

  // Giao diện chi tiết trong trang RestaurantDetail
  if (variant === 'detail') {
    return (
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-orange-50 text-orange-800 border border-orange-200 font-semibold text-xs sm:text-sm">
          <Clock className="w-4 h-4 text-orange-600" />
          <span>Giao dự kiến: {minEstimate} - {maxEstimate} phút</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs sm:text-sm">
          <Navigation className="w-4 h-4 text-emerald-600" />
          <span>Cách bạn {distanceKm} km (OSRM Road)</span>
        </div>
      </div>
    );
  }

  // Giao diện Card quán ăn trên trang Home
  return (
    <span
      className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-medium flex items-center gap-1 text-white shadow-sm"
      title={`Khoảng cách đường bộ OSRM: ${distanceKm} km, thời gian giao hàng: ${minEstimate}-${maxEstimate} phút`}
    >
      <Clock className="w-3.5 h-3.5 text-orange-300" />
      <span>
        {minEstimate}-{maxEstimate} phút ({distanceKm} km)
      </span>
    </span>
  );
}

