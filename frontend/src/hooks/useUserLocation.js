import { useState, useEffect, useCallback } from 'react';
import { reverseGeocode } from '../utils/geocoding';

// Tọa độ mặc định: Trung tâm Quận 1, TP. Hồ Chí Minh
export const DEFAULT_HCMC_COORDS = {
  lat: 10.7769,
  lng: 106.7009,
  address: 'Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  shortAddress: 'Nguyễn Huệ, Quận 1'
};

const STORAGE_KEY = 'foodfast_user_location';

/**
 * Custom Hook quản lý vị trí giao hàng của người dùng
 * - Lưu trữ địa chỉ thực tế (tên đường, phường, quận, thành phố)
 * - Tự động Reverse Geocoding khi người dùng bật GPS
 * - Cho phép chọn vị trí thủ công từ Bản đồ & Thanh tìm kiếm ShopeeFood
 */
export function useUserLocation() {
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            address: parsed.address || DEFAULT_HCMC_COORDS.address,
            shortAddress: parsed.shortAddress || DEFAULT_HCMC_COORDS.shortAddress,
            isDefault: !!parsed.isDefault
          };
        }
      }
    } catch {
      // Bỏ qua lỗi parse storage
    }
    return { ...DEFAULT_HCMC_COORDS, isDefault: true };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Cập nhật vị trí thủ công do người dùng chọn từ bản đồ hoặc tìm kiếm
   */
  const setManualLocation = useCallback((newLoc) => {
    if (!newLoc || typeof newLoc.lat !== 'number' || typeof newLoc.lng !== 'number') return;

    const locData = {
      lat: newLoc.lat,
      lng: newLoc.lng,
      address: newLoc.address || newLoc.name || 'TP. Hồ Chí Minh',
      shortAddress: newLoc.shortAddress || newLoc.name || 'TP.HCM',
      isDefault: false
    };

    setLocation(locData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(locData));
    } catch {
      // Bỏ qua lỗi storage
    }
  }, []);

  /**
   * Lấy vị trí GPS hiện tại từ trình duyệt và Reverse-geocode sang địa chỉ thực tế
   */
  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ Geolocation.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const geoRes = await reverseGeocode(lat, lng);
          const locData = {
            lat,
            lng,
            address: geoRes.address,
            shortAddress: geoRes.shortAddress,
            isDefault: false
          };
          setLocation(locData);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(locData));
          } catch {
            // Bỏ qua lỗi storage
          }
        } catch {
          const locData = {
            lat,
            lng,
            address: 'Vị trí hiện tại của bạn',
            shortAddress: 'Vị trí hiện tại',
            isDefault: false
          };
          setLocation(locData);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        let errorMsg = 'Không thể lấy vị trí hiện tại.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMsg = 'Quyền truy cập vị trí bị từ chối. Sử dụng vị trí mặc định.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMsg = 'Vị trí GPS không khả dụng.';
            break;
          case err.TIMEOUT:
            errorMsg = 'Yêu cầu định vị bị quá thời gian.';
            break;
          default:
            break;
        }
        setError(errorMsg);
        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000
      }
    );
  }, []);

  useEffect(() => {
    // Nếu chưa từng lưu vị trí hoặc đang dùng default, thử lấy địa chỉ chuẩn từ GPS
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      // Có thể chạy reverse geocode cho vị trí mặc định để có tên đẹp
      reverseGeocode(DEFAULT_HCMC_COORDS.lat, DEFAULT_HCMC_COORDS.lng).then((res) => {
        setLocation((prev) => (prev.isDefault ? { ...prev, address: res.address, shortAddress: res.shortAddress } : prev));
      });
    }
  }, []);

  return {
    location,
    loading,
    error,
    refreshLocation: requestLocation,
    setManualLocation
  };
}
