import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Crosshair, MapPin, Check, Loader2, Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode, searchAddress, POPULAR_LOCATIONS_HCMC } from '../utils/geocoding';

/**
 * Modal "Bạn muốn giao đến đâu?" chuẩn phong cách ShopeeFood
 * - Thanh tìm kiếm địa chỉ tự động gợi ý
 * - Nút định vị GPS hiện tại
 * - Bản đồ OpenStreetMap tương tác (kéo bản đồ chọn vị trí, ghim tâm)
 * - Tự động Reverse Geocoding ra tên đường, phường, quận, thành phố
 * - Nút "Done" xác nhận lưu địa chỉ
 */
export default function AddressPickerModal({ isOpen, onClose, currentLocation, onSelectLocation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState({
    lat: currentLocation?.lat || 10.7769,
    lng: currentLocation?.lng || 106.7009
  });
  const [addressInfo, setAddressInfo] = useState({
    address: currentLocation?.address || 'Đang xác định địa chỉ...',
    shortAddress: currentLocation?.shortAddress || 'TP. Hồ Chí Minh'
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Khởi tạo hoặc cập nhật tọa độ khi mở modal
  useEffect(() => {
    if (isOpen && currentLocation?.lat && currentLocation?.lng) {
      setSelectedCoord({
        lat: currentLocation.lat,
        lng: currentLocation.lng
      });
      setAddressInfo({
        address: currentLocation.address || 'Đang xác định địa chỉ...',
        shortAddress: currentLocation.shortAddress || 'TP. Hồ Chí Minh'
      });
    }
  }, [isOpen, currentLocation]);

  // Khởi tạo Bản đồ Leaflet khi Modal mở
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Tránh khởi tạo lặp nếu map đã tồn tại
    if (!mapInstanceRef.current) {
      const initialLat = selectedCoord.lat || 10.7769;
      const initialLng = selectedCoord.lng || 106.7009;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: false // Chúng ta sẽ tự thêm zoom control ở góc thuận tiện
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Tile layer OpenStreetMap chuẩn
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Lắng nghe sự kiện di chuyển bản đồ (moveend) -> Cập nhật tâm bản đồ và Reverse Geocode
      map.on('moveend', () => {
        const center = map.getCenter();
        setSelectedCoord({ lat: center.lat, lng: center.lng });
        triggerReverseGeocode(center.lat, center.lng);
      });

      mapInstanceRef.current = map;
    } else {
      // Nếu map đã có, pan tới tọa độ mới
      mapInstanceRef.current.setView([selectedCoord.lat, selectedCoord.lng], 16);
      mapInstanceRef.current.invalidateSize();
    }

    // Fix lỗi hiển thị tile bị xám khi modal render
    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
    };
  }, [isOpen]);

  // Cleanup map khi unmount hoàn toàn
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Gọi Reverse Geocoding khi tâm bản đồ đổi
  const triggerReverseGeocode = async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const geo = await reverseGeocode(lat, lng);
      setAddressInfo({
        address: geo.address,
        shortAddress: geo.shortAddress
      });
    } catch {
      setAddressInfo({
        address: 'Vị trí đã chọn trên bản đồ',
        shortAddress: 'Khu vực TP.HCM'
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  // Xử lý tìm kiếm địa chỉ với debounce
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      const results = await searchAddress(val);
      setSearchResults(results);
      setIsSearching(false);
    }, 350);
  };

  // Chọn địa chỉ từ kết quả gợi ý
  const handleSelectSearchResult = (item) => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCoord({ lat: item.lat, lng: item.lng });
    setAddressInfo({
      address: item.address,
      shortAddress: item.name
    });

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lng], 17, {
        duration: 1.2
      });
    }
  };

  // Định vị GPS hiện tại của thiết bị
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSelectedCoord({ lat, lng });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
        }

        await triggerReverseGeocode(lat, lng);
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        alert('Không thể lấy vị trí hiện tại. Vui lòng cấp quyền truy cập vị trí.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Xác nhận vị trí và đóng modal
  const handleConfirm = () => {
    onSelectLocation({
      lat: selectedCoord.lat,
      lng: selectedCoord.lng,
      address: addressInfo.address,
      shortAddress: addressInfo.shortAddress
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
            Bạn muốn giao đến đâu?
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh tìm kiếm nổi (Search bar with GPS button) */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 relative z-20">
          <div className="relative flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
            <Search className="w-5 h-5 text-gray-400 ml-4 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Nhập địa chỉ giao hàng (VD: Đông Du, Quận 1, Landmark 81...)"
              className="w-full px-3 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-orange-500 animate-spin mr-3 shrink-0" />
            )}
            <button
              onClick={handleUseCurrentGPS}
              disabled={gpsLoading}
              className="mr-2 px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors shrink-0"
              title="Sử dụng vị trí GPS hiện tại"
            >
              <Crosshair className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Vị trí hiện tại</span>
            </button>
          </div>

          {/* Dropdown gợi ý tìm kiếm */}
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-[72px] bg-white rounded-2xl shadow-xl border border-gray-100 divide-y divide-gray-50 max-h-60 overflow-y-auto z-30 animate-fadeIn">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left p-3 hover:bg-orange-50/60 transition-colors flex items-start gap-3"
                >
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 truncate">{item.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Khung bản đồ tương tác với ghim trung tâm */}
        <div className="relative flex-1 min-h-[340px] sm:min-h-[400px] w-full bg-slate-100 overflow-hidden">
          {/* Leaflet container */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Ghim đỏ chính giữa bản đồ (Center Pin phong cách ShopeeFood) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[1000] flex flex-col items-center">
            {/* Tooltip hiển thị trạng thái geocoding */}
            <div className="mb-1 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-medium shadow-lg backdrop-blur-sm whitespace-nowrap animate-bounce flex items-center gap-1.5">
              {isGeocoding ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
                  <span>Đang xác định địa chỉ...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3 h-3 text-orange-400" />
                  <span>Giao đến điểm này</span>
                </>
              )}
            </div>

            {/* Icon Pin đỏ ShopeeFood */}
            <div className="relative">
              <svg width="40" height="48" viewBox="0 0 24 28" fill="none" className="drop-shadow-lg">
                <path
                  d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 10.5 27 12 28C13.5 27 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z"
                  fill="#EE4D2D"
                />
                <circle cx="12" cy="11" r="5" fill="white" />
                <circle cx="12" cy="11" r="2.5" fill="#EE4D2D" />
              </svg>
            </div>
            {/* Đổ bóng đáy pin */}
            <div className="w-3 h-1.5 bg-black/30 rounded-full blur-[1px] -mt-0.5" />
          </div>

          {/* Gợi ý kéo bản đồ */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200/80 shadow-sm text-xs text-gray-600 flex items-center gap-1.5 pointer-events-none">
            <Navigation className="w-3.5 h-3.5 text-orange-500" />
            <span>Kéo bản đồ để chọn vị trí chính xác</span>
          </div>
        </div>

        {/* Khung xem trước địa chỉ đã chọn & Nút Done */}
        <div className="p-4 sm:p-5 bg-white border-t border-gray-100 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Địa chỉ giao hàng đã chọn
              </p>
              <p className="text-sm sm:text-base font-bold text-gray-900 line-clamp-2">
                {addressInfo.address}
              </p>
            </div>
          </div>

          {/* Nút Done chuẩn ShopeeFood (Màu xanh dương/cam nổi bật full-width) */}
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-2xl bg-[#0084ff] hover:bg-[#0073e6] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
