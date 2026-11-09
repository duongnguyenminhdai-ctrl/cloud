import { useState, useCallback } from 'react';
import { reverseGeocode } from '../utils/geocoding';
import { useLocationCity } from '../context/LocationContext';

// Tọa độ mặc định: Trung tâm Quận 1, TP. Hồ Chí Minh
export const DEFAULT_HCMC_COORDS = {
  lat: 10.7769,
  lng: 106.7009,
  address: 'Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  shortAddress: 'Nguyễn Huệ, Quận 1'
};

/**
 * Custom Hook quản lý vị trí giao hàng của người dùng
 * - Đồng bộ chặt chẽ hai chiều với Tỉnh/Thành phố (LocationContext)
 * - Tự động Reverse Geocoding khi người dùng bật GPS
 * - Đồng bộ với thanh hiển thị địa chỉ trên Header và Hero Banner
 */
export function useUserLocation() {
  const {
    deliveryLocation: location,
    setDeliveryLocation: setManualLocation,
    selectedCity,
    changeCity
  } = useLocationCity();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
          setManualLocation(locData);
        } catch {
          const locData = {
            lat,
            lng,
            address: 'Vị trí hiện tại của bạn',
            shortAddress: 'Vị trí hiện tại',
            isDefault: false
          };
          setManualLocation(locData);
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
  }, [setManualLocation]);

  return {
    location,
    setManualLocation,
    requestLocation,
    refreshLocation: requestLocation,
    loading,
    error,
    selectedCity,
    changeCity
  };
}
