import { useState, useEffect, useCallback } from 'react';

// Tọa độ mặc định: Trung tâm Quận 1, TP. Hồ Chí Minh (Nhà thờ Đức Bà / Chợ Bến Thành)
export const DEFAULT_HCMC_COORDS = {
  lat: 10.7769,
  lng: 106.7009,
  address: 'Trung tâm Quận 1, TP. Hồ Chí Minh'
};

const STORAGE_KEY = 'foodfast_user_location';

/**
 * Custom Hook quản lý vị trí GPS của người dùng
 * - Ưu tiên lấy tọa độ chính xác qua trình duyệt navigator.geolocation
 * - Lưu vào localStorage để tái sử dụng nhanh khi load trang
 * - Tự động fallback về tọa độ trung tâm TP.HCM nếu bị từ chối cấp quyền hoặc timeout
 */
export function useUserLocation() {
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return { lat: parsed.lat, lng: parsed.lng, isDefault: false };
        }
      }
    } catch {
      // Bỏ qua lỗi parse storage
    }
    return { ...DEFAULT_HCMC_COORDS, isDefault: true };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ Geolocation. Sử dụng vị trí mặc định TP.HCM.');
      setLocation({ ...DEFAULT_HCMC_COORDS, isDefault: true });
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          isDefault: false
        };
        setLocation(coords);
        setLoading(false);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
        } catch {
          // Bỏ qua lỗi storage
        }
      },
      (err) => {
        let errorMsg = 'Không thể lấy vị trí hiện tại.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMsg = 'Quyền truy cập vị trí bị từ chối. Sử dụng vị trí mặc định TP.HCM.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMsg = 'Vị trí không khả dụng. Sử dụng vị trí mặc định TP.HCM.';
            break;
          case err.TIMEOUT:
            errorMsg = 'Yêu cầu định vị bị quá thời gian. Sử dụng vị trí mặc định TP.HCM.';
            break;
          default:
            break;
        }
        setError(errorMsg);
        setLoading(false);
        // Giữ vị trí đã lưu nếu có, hoặc dùng tọa độ mặc định TP.HCM
        setLocation((prev) => (prev && !prev.isDefault ? prev : { ...DEFAULT_HCMC_COORDS, isDefault: true }));
      },
      {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 300000 // Cache vị trí trình duyệt 5 phút
      }
    );
  }, []);

  useEffect(() => {
    // Tự động gọi định vị nếu chưa có hoặc đang dùng default
    requestLocation();
  }, [requestLocation]);

  return {
    location,
    loading,
    error,
    refreshLocation: requestLocation
  };
}

