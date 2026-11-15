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
        className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#f2ece1] dark:bg-[#26211c] hover:bg-[#ebdcc8] dark:hover:bg-[#302a24] border border-[rgba(154,106,62,0.3)] dark:border-[rgba(240,234,224,0.18)] text-xs font-bold text-[#2b2721] dark:text-[#ede6d8] hover:text-[#845831] dark:hover:text-[#e5b887] transition-all shadow-2xs group cursor-pointer"
        title="Chọn Tỉnh/Thành phố của bạn"
      >
        <MapPin className="w-3.5 h-3.5 text-[#9a6a3e] dark:text-[#e5b887] group-hover:scale-110 transition-transform" />
        <span className="font-extrabold text-[#2b2721] dark:text-[#ede6d8] group-hover:text-[#845831] dark:group-hover:text-[#e5b887] truncate max-w-[100px] sm:max-w-none">
          {selectedCity?.shortName || 'TP. HCM'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#2b2721]/50 dark:text-[#ede6d8]/50 group-hover:text-[#845831] dark:group-hover:text-[#e5b887] transition-transform ${
            isOpen ? 'rotate-180 text-[#845831] dark:text-[#e5b887]' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover Modal (Tối ưu full fit trên Mobile: w-[calc(100vw-32px)] max-w-xs) */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[calc(100vw-32px)] max-w-xs sm:w-80 sketch-panel rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn border border-[rgba(154,106,62,0.25)] dark:border-[rgba(240,234,224,0.15)]">
          {/* Header & Search Bar */}
          <div className="p-3 bg-[#f2ece1] dark:bg-[#26211c] border-b border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.1)] space-y-2.5 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2b2721] dark:text-[#ede6d8] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#9a6a3e] dark:text-[#e5b887]" />
                <span>Chọn Tỉnh / Thành phố (63 tỉnh)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-[#2b2721]/50 dark:text-[#ede6d8]/50 hover:text-[#2b2721] dark:hover:text-[#ede6d8] rounded-full cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ô tìm kiếm nhanh */}
            <div className="relative flex items-center bg-[#fffdfa] dark:bg-[#1a1714] rounded-xl border border-[rgba(43,39,33,0.18)] dark:border-[rgba(240,234,224,0.18)] focus-within:border-[#9a6a3e] dark:focus-within:border-[#e5b887] focus-within:ring-2 focus-within:ring-[#9a6a3e]/15 transition-all">
              <Search className="w-3.5 h-3.5 text-[#2b2721]/40 dark:text-[#ede6d8]/40 ml-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tỉnh/thành (Hà Nội, Đà Nẵng...)"
                className="w-full px-2.5 py-1.5 text-xs text-[#2b2721] dark:text-[#ede6d8] placeholder-[#2b2721]/40 dark:placeholder-[#ede6d8]/40 focus:outline-none bg-transparent font-medium"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mr-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Thành phố trọng điểm (Khi chưa gõ search) */}
          {!searchQuery && (
            <div className="p-3 border-b border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.1)] bg-[#fffdfa] dark:bg-[#1e1a16] transition-colors">
              <p className="text-[10px] font-bold text-[#2b2721]/50 dark:text-[#ede6d8]/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#9a6a3e] dark:text-[#e5b887] fill-[#9a6a3e] dark:fill-[#e5b887]" />
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
                          ? 'bg-[#9a6a3e] dark:bg-[#b5814c] text-white shadow-xs'
                          : 'bg-[#f2ece1] dark:bg-[#2b2520] text-[#845831] dark:text-[#e5b887] hover:bg-[#ebdcc8] dark:hover:bg-[#383029] border border-[rgba(154,106,62,0.2)] dark:border-[rgba(229,184,135,0.25)]'
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
          <div className="max-h-60 overflow-y-auto divide-y divide-[rgba(43,39,33,0.06)] dark:divide-[rgba(240,234,224,0.06)] p-1 bg-[#fffdfa] dark:bg-[#1e1a16] transition-colors">
            {filteredCities.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#2b2721]/50 dark:text-[#ede6d8]/50">
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
                        ? 'bg-[#f2ece1] dark:bg-[#2b2520] text-[#845831] dark:text-[#e5b887] font-bold'
                        : 'text-[#2b2721] dark:text-[#ede6d8] hover:bg-[#f2ece1]/60 dark:hover:bg-[#2b2520]/60'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#9a6a3e] dark:text-[#e5b887] shrink-0" />}
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

