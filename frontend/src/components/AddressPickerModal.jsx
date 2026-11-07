import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Crosshair, MapPin, Check, Loader2, Navigation, Home as HomeIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode, searchAddress } from '../utils/geocoding';

/**
 * Modal "Bạn muốn giao đến đâu?" chuẩn ShopeeFood
 * - Sử dụng Google Maps Tiles công cộng (tiếng Việt, không watermark CartoDB, không cần API Key)
 * - Nút "Done" luôn hiển thị trọn vẹn ở đáy, không bao giờ bị chìm/tràn viền màn hình
 * - Kéo thả bản đồ mượt mà, định vị lại vị trí và Reverse Geocode tự động
 * - Hỗ trợ tìm kiếm theo số nhà, hẻm, tên đường đồng bộ với bản đồ
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
  const [houseDetail, setHouseDetail] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Khi modal mở, đồng bộ tọa độ hiện tại
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

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    // Hủy instance cũ nếu có trước khi tạo mới
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        // ignore
      }
      mapInstanceRef.current = null;
    }

    const initialLat = selectedCoord.lat || 10.7769;
    const initialLng = selectedCoord.lng || 106.7009;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Google Maps Tiles công cộng (giống ShopeeFood, tiếng Việt đầy đủ, KHÔNG cần API Key, không watermark)
    const googleTiles = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20
    });

    // Fallback sang OpenStreetMap nếu Google tiles gặp sự cố
    googleTiles.on('tileerror', () => {
      if (!map._osmFallbackAttached) {
        map._osmFallbackAttached = true;
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
      }
    });

    googleTiles.addTo(map);

    // Kéo thả bản đồ -> Tự động Reverse Geocode khi dừng kéo
    map.on('moveend', () => {
      const center = map.getCenter();
      setSelectedCoord({ lat: center.lat, lng: center.lng });
      triggerReverseGeocode(center.lat, center.lng);
    });

    // Nhấp vào bất kỳ điểm nào trên bản đồ để di chuyển ghim tới đó
    map.on('click', (e) => {
      map.panTo(e.latlng);
    });

    mapInstanceRef.current = map;

    // Force Leaflet tính toán kích thước container chính xác sau khi modal mở
    const timers = [
      setTimeout(() => map.invalidateSize(true), 50),
      setTimeout(() => map.invalidateSize(true), 150),
      setTimeout(() => map.invalidateSize(true), 350),
      setTimeout(() => map.invalidateSize(true), 600)
    ];

    return () => {
      timers.forEach(clearTimeout);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Gọi Reverse Geocoding
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

  // Tìm kiếm địa chỉ với Photon + Nominatim
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
      const results = await searchAddress(val, selectedCoord.lat, selectedCoord.lng);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  };

  // Chọn từ danh sách gợi ý tìm kiếm
  const handleSelectSearchResult = (item) => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCoord({ lat: item.lat, lng: item.lng });
    setAddressInfo({
      address: item.address,
      shortAddress: item.name
    });

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lng], 17, { duration: 1.2 });
    }
  };

  // Định vị GPS hiện tại
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị GPS.');
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
      () => {
        alert('Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí trên trình duyệt.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Xác nhận vị trí
  const handleConfirm = () => {
    let finalAddress = addressInfo.address;
    if (houseDetail.trim()) {
      if (!finalAddress.toLowerCase().includes(houseDetail.trim().toLowerCase())) {
        finalAddress = `${houseDetail.trim()}, ${finalAddress}`;
      }
    }

    onSelectLocation({
      lat: selectedCoord.lat,
      lng: selectedCoord.lng,
      address: finalAddress,
      shortAddress: houseDetail.trim() ? `${houseDetail.trim()} ${addressInfo.shortAddress}` : addressInfo.shortAddress
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      {/* Khung Modal chính: h-[520px] max-h-[85vh] đảm bảo nút Done luôn nằm trong tầm mắt, không bị tràn màn hình */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[520px] max-h-[85vh] my-auto">
        
        {/* =================================================================== */}
        {/* 1. HEADER (Cố định - flex-shrink-0) */}
        {/* =================================================================== */}
        <div className="flex-shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between border-b border-gray-100 bg-white">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">
            Bạn muốn giao đến đâu?
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =================================================================== */}
        {/* 2. THANH TÌM KIẾM ĐỊA CHỈ (Cố định - flex-shrink-0) */}
        {/* =================================================================== */}
        <div className="flex-shrink-0 p-3 bg-gray-50/80 border-b border-gray-100 relative z-30">
          <div className="relative flex items-center bg-white rounded-xl border border-gray-200 shadow-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
            <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Nhập địa chỉ giao hàng (VD: 53 Đường 12, Đông Du...)"
              className="w-full px-2.5 py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-orange-500 animate-spin mr-2 shrink-0" />
            )}
            <button
              type="button"
              onClick={handleUseCurrentGPS}
              disabled={gpsLoading}
              className="mr-1.5 px-2 py-1 flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors shrink-0"
              title="Định vị theo GPS hiện tại"
            >
              <Crosshair className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Vị trí hiện tại</span>
            </button>
          </div>

          {/* Dropdown gợi ý tìm kiếm có số nhà, tên đường */}
          {searchResults.length > 0 && (
            <div className="absolute left-3 right-3 top-[58px] bg-white rounded-xl shadow-2xl border border-gray-100 divide-y divide-gray-50 max-h-48 overflow-y-auto z-40 animate-fadeIn">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left p-2.5 hover:bg-orange-50/70 transition-colors flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{item.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* 3. BẢN ĐỒ TƯƠNG TÁC (Tự co giãn - flex-1 min-h-[200px]) */}
        {/* =================================================================== */}
        <div className="relative flex-1 min-h-[200px] w-full bg-slate-100 overflow-hidden cursor-grab active:cursor-grabbing">
          {/* Leaflet container */}
          <div
            ref={mapContainerRef}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 1 }}
          />

          {/* Ghim đỏ chính giữa bản đồ (Center Pin ShopeeFood) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[1000] flex flex-col items-center">
            {/* Tooltip trạng thái geocoding */}
            <div className="mb-1 px-2.5 py-0.5 rounded-full bg-slate-900/90 text-white text-[11px] font-medium shadow-xl backdrop-blur-sm whitespace-nowrap animate-bounce flex items-center gap-1.5">
              {isGeocoding ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
                  <span>Đang dò địa chỉ...</span>
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
              <svg width="34" height="42" viewBox="0 0 24 28" fill="none" className="drop-shadow-xl">
                <path
                  d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 10.5 27 12 28C13.5 27 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z"
                  fill="#EE4D2D"
                />
                <circle cx="12" cy="11" r="5" fill="white" />
                <circle cx="12" cy="11" r="2.5" fill="#EE4D2D" />
              </svg>
            </div>
            {/* Đổ bóng đáy pin */}
            <div className="w-2.5 h-1 bg-black/40 rounded-full blur-[1px] -mt-0.5" />
          </div>

          {/* Gợi ý tương tác góc dưới */}
          <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-200/80 shadow-md text-[10px] text-gray-700 font-medium flex items-center gap-1 pointer-events-none">
            <Navigation className="w-3 h-3 text-orange-500" />
            <span>Kéo hoặc nhấp bản đồ để đổi vị trí</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. FOOTER: CHI TIẾT ĐỊA CHỈ & NÚT DONE (Cố định - flex-shrink-0) */}
        {/* =================================================================== */}
        <div className="flex-shrink-0 p-3 sm:p-3.5 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-20 space-y-2">
          {/* Hàng 1: Địa chỉ trên bản đồ */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate" title={addressInfo.address}>
                {addressInfo.address}
              </p>
            </div>
          </div>

          {/* Hàng 2: Ô nhập số nhà / tầng / căn hộ cụ thể (gọn gàng, không chiếm chỗ) */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1 border border-gray-200 focus-within:border-orange-500 focus-within:bg-white text-xs">
            <HomeIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={houseDetail}
              onChange={(e) => setHouseDetail(e.target.value)}
              placeholder="Chi tiết số nhà, số tầng, tòa nhà (tùy chọn)..."
              className="w-full bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none text-xs"
            />
          </div>

          {/* Hàng 3: NÚT DONE NỔI BẬT CHUẨN SHOPEEFOOD - LUÔN HIỂN THỊ 100% */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-[#0084ff] hover:bg-[#0073e6] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            <span>Done</span>
          </button>
        </div>

      </div>
    </div>
  );
}
