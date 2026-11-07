import React, { createContext, useContext, useState } from 'react';
import { VIETNAM_CITIES, DEFAULT_CITY, getCityByCode } from '../constants/vietnamLocations';

const LocationContext = createContext();

export function LocationProvider({ children }) {
  const [selectedCity, setSelectedCity] = useState(() => {
    const savedCode = localStorage.getItem('user_city');
    return getCityByCode(savedCode || 'hcm');
  });

  const changeCity = (newCityInput) => {
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
      localStorage.setItem('user_city', cityObj.code);
    } catch (e) {
      console.warn('Không thể lưu user_city vào localStorage:', e);
    }
  };

  return (
    <LocationContext.Provider
      value={{
        selectedCity,
        changeCity,
        allCities: VIETNAM_CITIES
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
