import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  VIETNAM_CITIES,
  DEFAULT_CITY,
  getCityByCode,
  getDefaultCityAddress,
  detectCityFromAddress
} from '../constants/vietnamLocations';

const LocationContext = createContext();

const STORAGE_KEY_CITY = 'user_city';
const STORAGE_KEY_LOCATION = 'foodfast_user_location';

export function LocationProvider({ children }) {
  // 1. Tỉnh / Thành phố được chọn (TP. HCM, Hà Nội, Đà Nẵng...)
  const [selectedCity, setSelectedCity] = useState(() => {
    const savedCode = localStorage.getItem(STORAGE_KEY_CITY);
    return getCityByCode(savedCode || 'hcm');
  });

  // 2. Vị trí / Địa chỉ giao hàng hiện tại của người dùng
  const [deliveryLocation, setDeliveryLocationState] = useState(() => {
    try {
      const savedLoc = localStorage.getItem(STORAGE_KEY_LOCATION);
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && parsed.address) {
          return parsed;
        }
      }
    } catch {}
    const initialCity = getCityByCode(localStorage.getItem(STORAGE_KEY_CITY) || 'hcm');
    return getDefaultCityAddress(initialCity);
  });

  // Đồng bộ hai chiều khi khởi tạo nếu chưa khớp tỉnh thành
  useEffect(() => {
    if (deliveryLocation?.address) {
      const cityOfAddress = detectCityFromAddress(deliveryLocation.address, deliveryLocation.lat, deliveryLocation.lng);
      if (cityOfAddress && selectedCity && cityOfAddress.code !== selectedCity.code) {
        setSelectedCity(cityOfAddress);
        try {
          localStorage.setItem(STORAGE_KEY_CITY, cityOfAddress.code);
        } catch {}
      }
    }
  }, []);

  /**
   * Thay đổi Thành phố từ CitySelector
   * Tự động đồng bộ Địa chỉ giao hàng về trung tâm thành phố mới
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

    // Tự động đồng bộ địa chỉ giao hàng về trung tâm thành phố này
    if (options.syncAddress !== false) {
      const defaultAddr = getDefaultCityAddress(cityObj);
      setDeliveryLocationState(defaultAddr);
      try {
        localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(defaultAddr));
      } catch {}
    }
  }, []);

  /**
   * Cập nhật địa chỉ giao hàng thủ công (từ bản đồ Leaflet hoặc GPS)
   * Tự động nhận diện Thành phố của địa chỉ này và cập nhật selectedCity
   */
  const setDeliveryLocation = useCallback((newLoc) => {
    if (!newLoc || typeof newLoc.lat !== 'number' || typeof newLoc.lng !== 'number') return;

    const locData = {
      lat: newLoc.lat,
      lng: newLoc.lng,
      address: newLoc.address || newLoc.name || 'TP. Hồ Chí Minh',
      shortAddress: newLoc.shortAddress || newLoc.name || 'TP.HCM',
      isDefault: false
    };

    setDeliveryLocationState(locData);
    try {
      localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(locData));
    } catch {}

    // Nhận diện Thành phố của địa chỉ vừa chọn và đồng bộ header CitySelector
    const detectedCity = detectCityFromAddress(locData.address, locData.lat, locData.lng);
    if (detectedCity) {
      setSelectedCity(detectedCity);
      try {
        localStorage.setItem(STORAGE_KEY_CITY, detectedCity.code);
      } catch {}
    }
  }, []);

  return (
    <LocationContext.Provider
      value={{
        selectedCity,
        changeCity,
        allCities: VIETNAM_CITIES,
        deliveryLocation,
        setDeliveryLocation
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
