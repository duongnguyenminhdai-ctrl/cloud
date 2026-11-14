import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  VIETNAM_CITIES,
  DEFAULT_CITY,
  getCityByCode,
  getDefaultCityAddress,
  detectCityFromAddress
} from '../constants/vietnamLocations';
import { useAuth } from './AuthContext';
import { authApi } from '../api/client';

const LocationContext = createContext();

const STORAGE_KEY_CITY = 'user_city';
const STORAGE_KEY_LOCATION = 'foodfast_user_location';

/**
 * Trích xuất địa chỉ mặc định từ thông tin User trong DB
 */
function extractUserDefaultLocation(user, city) {
  if (!user) {
    const defaultCityAddr = getDefaultCityAddress(city || DEFAULT_CITY);
    return {
      ...defaultCityAddr,
      hasUserAddress: false
    };
  }

  // 1. Tìm trong sổ địa chỉ user.addresses
  if (Array.isArray(user.addresses) && user.addresses.length > 0) {
    const def = user.addresses.find((a) => a.isDefault) || user.addresses[0];
    if (def && def.fullAddress && def.fullAddress.trim()) {
      return {
        lat: typeof def.latitude === 'number' ? def.latitude : city?.lat || DEFAULT_CITY.lat,
        lng: typeof def.longitude === 'number' ? def.longitude : city?.lng || DEFAULT_CITY.lng,
        address: def.fullAddress.trim(),
        shortAddress: def.label || 'Nhà riêng',
        isDefault: true,
        addressId: def._id || null,
        hasUserAddress: true
      };
    }
  }

  // 2. Fallback sang trường địa chỉ đơn user.address
  if (user.address && user.address.trim()) {
    return {
      lat: city?.lat || DEFAULT_CITY.lat,
      lng: city?.lng || DEFAULT_CITY.lng,
      address: user.address.trim(),
      shortAddress: 'Địa chỉ nhận hàng',
      isDefault: true,
      addressId: null,
      hasUserAddress: true
    };
  }

  // 3. Tài khoản chưa có địa chỉ nào
  return {
    lat: city?.lat || DEFAULT_CITY.lat,
    lng: city?.lng || DEFAULT_CITY.lng,
    address: '',
    shortAddress: '',
    isDefault: false,
    addressId: null,
    hasUserAddress: false
  };
}

export function LocationProvider({ children }) {
  const { user, isAuthenticated, updateUserProfile } = useAuth();

  // 1. Tỉnh / Thành phố được chọn (TP. HCM, Hà Nội, Đà Nẵng...)
  const [selectedCity, setSelectedCity] = useState(() => {
    const savedCode = localStorage.getItem(STORAGE_KEY_CITY);
    return getCityByCode(savedCode || 'hcm');
  });

  // 2. Vị trí / Địa chỉ giao hàng hiện tại của người dùng (đồng bộ chặt chẽ với tài khoản)
  const [deliveryLocation, setDeliveryLocationState] = useState(() => {
    const initialCity = getCityByCode(localStorage.getItem(STORAGE_KEY_CITY) || 'hcm');
    const hasToken = Boolean(localStorage.getItem('token'));
    const savedUserStr = localStorage.getItem('user');

    if (!hasToken || !savedUserStr) {
      try {
        localStorage.removeItem(STORAGE_KEY_LOCATION);
      } catch {}
      return {
        ...getDefaultCityAddress(initialCity),
        hasUserAddress: false
      };
    }

    try {
      const parsedUser = JSON.parse(savedUserStr);
      return extractUserDefaultLocation(parsedUser, initialCity);
    } catch {
      return {
        ...getDefaultCityAddress(initialCity),
        hasUserAddress: false
      };
    }
  });

  // Cờ theo dõi để tránh ghi đè lặp lại
  const prevUserRef = useRef(null);

  // Tự động đồng bộ địa chỉ giao hàng mỗi khi User thay đổi (Login, switch user, cập nhật profile)
  useEffect(() => {
    if (isAuthenticated && user) {
      const userLoc = extractUserDefaultLocation(user, selectedCity);
      setDeliveryLocationState(userLoc);

      // Nếu địa chỉ của user thuộc thành phố khác, tự động đồng bộ selectedCity
      if (userLoc.address) {
        const cityOfAddress = detectCityFromAddress(userLoc.address, userLoc.lat, userLoc.lng);
        if (cityOfAddress && cityOfAddress.code !== selectedCity?.code) {
          setSelectedCity(cityOfAddress);
          try {
            localStorage.setItem(STORAGE_KEY_CITY, cityOfAddress.code);
          } catch {}
        }
      }
      prevUserRef.current = user._id || user.id || user.email;
    } else if (!isAuthenticated) {
      // Đăng xuất: Xóa sạch dữ liệu địa chỉ cá nhân, đưa về trung tâm thành phố mặc định
      try {
        localStorage.removeItem(STORAGE_KEY_LOCATION);
      } catch {}
      const targetCity = selectedCity || DEFAULT_CITY;
      setDeliveryLocationState({
        ...getDefaultCityAddress(targetCity),
        hasUserAddress: false
      });
      prevUserRef.current = null;
    }
  }, [isAuthenticated, user?.address, JSON.stringify(user?.addresses)]);

  // Lắng nghe sự kiện đăng xuất toàn cục
  useEffect(() => {
    const handleLogout = () => {
      try {
        localStorage.removeItem(STORAGE_KEY_LOCATION);
      } catch {}
      const targetCity = selectedCity || DEFAULT_CITY;
      setDeliveryLocationState({
        ...getDefaultCityAddress(targetCity),
        hasUserAddress: false
      });
    };

    window.addEventListener('foodfast:logout', handleLogout);
    return () => {
      window.removeEventListener('foodfast:logout', handleLogout);
    };
  }, [selectedCity]);

  // Lắng nghe sự kiện đổi địa chỉ mặc định từ ProfilePage hoặc bất kỳ component nào
  useEffect(() => {
    const handleDefaultAddressChanged = (e) => {
      const newAddr = e.detail;
      if (!newAddr) return;

      const newLoc = {
        lat: typeof newAddr.latitude === 'number' ? newAddr.latitude : selectedCity.lat,
        lng: typeof newAddr.longitude === 'number' ? newAddr.longitude : selectedCity.lng,
        address: newAddr.fullAddress,
        shortAddress: newAddr.label || 'Địa chỉ mặc định',
        isDefault: true,
        addressId: newAddr._id || null,
        hasUserAddress: true
      };

      setDeliveryLocationState(newLoc);

      const cityOfAddress = detectCityFromAddress(newLoc.address, newLoc.lat, newLoc.lng);
      if (cityOfAddress && cityOfAddress.code !== selectedCity?.code) {
        setSelectedCity(cityOfAddress);
        try {
          localStorage.setItem(STORAGE_KEY_CITY, cityOfAddress.code);
        } catch {}
      }
    };

    window.addEventListener('foodfast:default_address_changed', handleDefaultAddressChanged);
    return () => {
      window.removeEventListener('foodfast:default_address_changed', handleDefaultAddressChanged);
    };
  }, [selectedCity]);

  /**
   * Thay đổi Thành phố từ CitySelector
   */
  const changeCity = useCallback((newCityInput, options = {}) => {
    let cityObj;
    if (typeof newCityInput === 'string') {
      cityObj = getCityByCode(newCityInput);
    } else if (newCityInput && newCityInput.code) {
      cityObj = newCityInput;
    } else {
      cityObj = DEFAULT_CITY;
    }

    setSelectedCity(cityObj);
    try {
      localStorage.setItem(STORAGE_KEY_CITY, cityObj.code);
    } catch (e) {
      console.warn('Không thể lưu user_city vào localStorage:', e);
    }

    // Nếu chưa đăng nhập hoặc user chưa có địa chỉ, đồng bộ về trung tâm thành phố mới
    if (options.syncAddress !== false && (!isAuthenticated || !deliveryLocation?.hasUserAddress)) {
      const defaultAddr = {
        ...getDefaultCityAddress(cityObj),
        hasUserAddress: false
      };
      setDeliveryLocationState(defaultAddr);
    }
  }, [isAuthenticated, deliveryLocation?.hasUserAddress]);

  /**
   * Cập nhật địa chỉ nhận hàng thủ công (chỉ lưu tạm thời trong session hiện tại)
   */
  const setDeliveryLocation = useCallback((newLoc) => {
    if (!newLoc || typeof newLoc.lat !== 'number' || typeof newLoc.lng !== 'number') return;

    const locData = {
      lat: newLoc.lat,
      lng: newLoc.lng,
      address: newLoc.address || newLoc.name || 'TP. Hồ Chí Minh',
      shortAddress: newLoc.shortAddress || newLoc.name || 'TP.HCM',
      isDefault: Boolean(newLoc.isDefault),
      addressId: newLoc.addressId || null,
      hasUserAddress: true
    };

    setDeliveryLocationState(locData);

    const detectedCity = detectCityFromAddress(locData.address, locData.lat, locData.lng);
    if (detectedCity) {
      setSelectedCity(detectedCity);
      try {
        localStorage.setItem(STORAGE_KEY_CITY, detectedCity.code);
      } catch {}
    }
  }, []);

  /**
   * Lưu và đồng bộ Địa chỉ mặc định:
   * - Khi người dùng cập nhật địa chỉ ở trang chủ, tính là cập nhật trường địa chỉ mặc định
   * - Tự động lưu vào Profile và database thật của tài khoản (không sinh thêm địa chỉ rác)
   * - Đồng bộ cả hai chiều giữa Trang chủ và Profile
   */
  const saveAndSyncDefaultAddress = useCallback(
    async (newLoc) => {
      if (!newLoc || !newLoc.address || typeof newLoc.lat !== 'number' || typeof newLoc.lng !== 'number') {
        return { success: false, message: 'Dữ liệu vị trí không hợp lệ' };
      }

      const cleanAddress = newLoc.address.trim();
      const updatedLoc = {
        lat: newLoc.lat,
        lng: newLoc.lng,
        address: cleanAddress,
        shortAddress: newLoc.shortAddress || 'Địa chỉ mặc định',
        isDefault: true,
        hasUserAddress: true
      };

      // 1. Cập nhật state hiển thị ngay lập tức
      setDeliveryLocationState(updatedLoc);

      // 2. Nhận diện và cập nhật thành phố
      const detectedCity = detectCityFromAddress(cleanAddress, newLoc.lat, newLoc.lng);
      if (detectedCity) {
        setSelectedCity(detectedCity);
        try {
          localStorage.setItem(STORAGE_KEY_CITY, detectedCity.code);
        } catch {}
      }

      // 3. Nếu người dùng đã đăng nhập, đồng bộ lưu trực tiếp vào Profile & DB
      if (isAuthenticated && user) {
        try {
          const userAddresses = Array.isArray(user.addresses) ? user.addresses : [];
          const currentDef = userAddresses.find((a) => a.isDefault) || userAddresses[0];

          let updatedAddresses = [];

          if (currentDef && currentDef._id) {
            // Đã có địa chỉ mặc định -> Cập nhật chính địa chỉ này
            const res = await authApi.updateAddress(currentDef._id, {
              label: currentDef.label || 'Nhà riêng',
              receiverName: currentDef.receiverName || user.name || '',
              receiverPhone: currentDef.receiverPhone || user.phone || '',
              fullAddress: cleanAddress,
              latitude: newLoc.lat,
              longitude: newLoc.lng,
              isDefault: true
            });
            if (res.data?.success && Array.isArray(res.data.data)) {
              updatedAddresses = res.data.data;
            }
          } else {
            // Chưa có địa chỉ nào -> Tạo mới địa chỉ mặc định đầu tiên
            const res = await authApi.addAddress({
              label: 'Nhà riêng',
              receiverName: user.name || '',
              receiverPhone: user.phone || '',
              fullAddress: cleanAddress,
              latitude: newLoc.lat,
              longitude: newLoc.lng,
              isDefault: true
            });
            if (res.data?.success && Array.isArray(res.data.data)) {
              updatedAddresses = res.data.data;
            }
          }

          // Cập nhật trường address trong profile
          await authApi.updateProfile({ address: cleanAddress });

          // Cập nhật state User trong AuthContext
          if (updateUserProfile) {
            updateUserProfile({
              ...user,
              address: cleanAddress,
              addresses: updatedAddresses.length > 0 ? updatedAddresses : userAddresses
            });
          }

          // Bắn event để thông báo các màn hình khác (như ProfilePage) cập nhật
          window.dispatchEvent(
            new CustomEvent('foodfast:default_address_changed', {
              detail: {
                fullAddress: cleanAddress,
                latitude: newLoc.lat,
                longitude: newLoc.lng,
                label: currentDef?.label || 'Nhà riêng'
              }
            })
          );

          return { success: true };
        } catch (err) {
          console.warn('[LocationContext] Lỗi đồng bộ địa chỉ vào Profile:', err.message);
          return { success: false, error: err.message };
        }
      }

      return { success: true };
    },
    [isAuthenticated, user, updateUserProfile]
  );

  /**
   * Reset địa chỉ giao hàng về mặc định của Thành phố
   */
  const resetDeliveryLocation = useCallback((targetCity) => {
    const city = targetCity || selectedCity || DEFAULT_CITY;
    const defaultAddr = {
      ...getDefaultCityAddress(city),
      hasUserAddress: false
    };
    setDeliveryLocationState(defaultAddr);
    try {
      localStorage.removeItem(STORAGE_KEY_LOCATION);
    } catch {}
  }, [selectedCity]);

  return (
    <LocationContext.Provider
      value={{
        selectedCity,
        changeCity,
        allCities: VIETNAM_CITIES,
        deliveryLocation,
        setDeliveryLocation,
        saveAndSyncDefaultAddress,
        resetDeliveryLocation,
        hasUserAddress: Boolean(deliveryLocation?.hasUserAddress)
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationCity() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationCity must be used within a LocationProvider');
  }
  return context;
}
