import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, ChevronDown, Search, X, Check, Sparkles } from 'lucide-react';
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
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Pill Badge Trigger - Phong cách ShopeeFood (TP. HCM ▼) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50/80 hover:bg-orange-100 border border-orange-200/80 text-xs font-bold text-gray-800 hover:text-orange-600 transition-all shadow-sm group"
        title="Chọn Tỉnh/Thành phố của bạn"
      >
        <MapPin className="w-3.5 h-3.5 text-orange-500 group-hover:scale-110 transition-transform" />
        <span className="font-extrabold text-orange-950 group-hover:text-orange-600 truncate max-w-[100px] sm:max-w-none">
          {selectedCity?.shortName || 'TP. HCM'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 group-hover:text-orange-500 transition-transform ${
            isOpen ? 'rotate-180 text-orange-500' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover Modal */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fadeIn">
          {/* Header & Search Bar */}
          <div className="p-3 bg-gray-50/80 border-b border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>Chọn Tỉnh / Thành phố (63 tỉnh)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ô tìm kiếm nhanh */}
            <div className="relative flex items-center bg-white rounded-xl border border-gray-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
              <Search className="w-3.5 h-3.5 text-gray-400 ml-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tỉnh/thành (Hà Nội, Đà Nẵng...)"
                className="w-full px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
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
            <div className="p-3 border-b border-gray-100 bg-white">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-orange-600 text-white shadow-sm'
                          : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200/60'
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
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 p-1">
            {filteredCities.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
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
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-orange-50 text-orange-700 font-bold'
                        : 'text-gray-700 hover:bg-gray-50'
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
