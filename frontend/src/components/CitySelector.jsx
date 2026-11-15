import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, ChevronDown, Search, X, Check, Flame } from 'lucide-react';
import { useLocationCity } from '../context/LocationContext';
import { TOP_CITIES, OTHER_CITIES } from '../constants/vietnamLocations';

export default function CitySelector() {
  const { selectedCity, changeCity, allCities } = useLocationCity();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef(null);

  // Đóng dropdown khi nhấp ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Lọc tỉnh thành theo từ khóa tìm kiếm
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return allCities;
    const q = searchQuery.toLowerCase().trim();
    return allCities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.shortName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [allCities, searchQuery]);

  const handleSelect = (city) => {
    changeCity(city);
    setIsOpen(false);
    setSearchQuery('');

    // Phát tín hiệu 1 chiều trực tiếp tới cuốn sách ký họa iframe (City -> Sách)
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((ifr) => {
        ifr.contentWindow?.postMessage({
          type: 'FOODFAST_NAVIGATE_CITY',
          cityCode: city.code,
          cityName: city.shortName || city.name
        }, '*');
      });
    } catch (err) {
      console.warn('Could not postMessage to iframe:', err);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Pill Badge Trigger - Phong cách FoodFast (TP. HCM ▼) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2ece1] hover:bg-[#ebdcc8] border border-[rgba(154,106,62,0.3)] text-xs font-bold text-[#2b2721] hover:text-[#845831] transition-all shadow-2xs group cursor-pointer"
        title="Chọn Tỉnh/Thành phố của bạn"
      >
        <MapPin className="w-3.5 h-3.5 text-[#9a6a3e] group-hover:scale-110 transition-transform" />
        <span className="font-extrabold text-[#2b2721] group-hover:text-[#845831] truncate max-w-[100px] sm:max-w-none">
          {selectedCity?.shortName || 'TP. HCM'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#2b2721]/50 group-hover:text-[#845831] transition-transform ${
            isOpen ? 'rotate-180 text-[#845831]' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover Modal (Tối ưu full fit trên Mobile: w-[calc(100vw-32px)] max-w-xs) */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[calc(100vw-32px)] max-w-xs sm:w-80 sketch-panel rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header & Search Bar */}
          <div className="p-3 bg-[#f2ece1] border-b border-[rgba(43,39,33,0.1)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2b2721] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#9a6a3e]" />
                <span>Chọn Tỉnh / Thành phố (63 tỉnh)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-[#2b2721]/50 hover:text-[#2b2721] rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ô tìm kiếm nhanh */}
            <div className="relative flex items-center bg-[#fffdfa] rounded-xl border border-[rgba(43,39,33,0.18)] focus-within:border-[#9a6a3e] focus-within:ring-2 focus-within:ring-[#9a6a3e]/15 transition-all">
              <Search className="w-3.5 h-3.5 text-[#2b2721]/40 ml-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tỉnh/thành (Hà Nội, Đà Nẵng...)"
                className="w-full px-2.5 py-1.5 text-xs text-[#2b2721] placeholder-[#2b2721]/40 focus:outline-none bg-transparent font-medium"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mr-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Thành phố trọng điểm (Khi chưa gõ search) */}
          {!searchQuery && (
            <div className="p-3 border-b border-[rgba(43,39,33,0.1)] bg-[#fffdfa]">
              <p className="text-[10px] font-bold text-[#2b2721]/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Flame className="w-3 h-3 text-[#9a6a3e] fill-[#9a6a3e]" />
                <span>Thành phố trọng điểm</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TOP_CITIES.map((c) => {
                  const isSelected = selectedCity?.code === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-[#9a6a3e] text-white shadow-sm'
                          : 'bg-[#f2ece1] text-[#845831] hover:bg-[#ebdcc8] border border-[rgba(154,106,62,0.2)]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{c.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Danh sách 63 Tỉnh Thành */}
          <div className="max-h-60 overflow-y-auto divide-y divide-[rgba(43,39,33,0.06)] p-1 bg-[#fffdfa]">
            {filteredCities.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#2b2721]/50">
                Không tìm thấy tỉnh thành phù hợp với "{searchQuery}"
              </div>
            ) : (
              filteredCities.map((c) => {
                const isSelected = selectedCity?.code === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#f2ece1] text-[#845831] font-bold'
                        : 'text-[#2b2721] hover:bg-[#f2ece1]/50'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-orange-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

