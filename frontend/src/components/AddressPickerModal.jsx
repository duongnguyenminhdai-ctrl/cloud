import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Crosshair, MapPin, Check, Loader2, Navigation, Home as HomeIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode, searchAddress } from '../utils/geocoding';

/**
 * Modal "Bạn muốn giao đến đâu?" chuẩn ShopeeFood
 * - Bản đồ tương tác CartoDB Voyager (dữ liệu OpenStreetMap, không bị chặn CORS, kéo thả mượt mà)
 * - Nút "Done" luôn nổi ở đáy, không bị chìm hay tràn viền
 * - Hỗ trợ tìm kiếm theo số nhà, hẻm, tên đường đồng bộ với bản đồ
 * - Trường nhập bổ sung số nhà/số tầng/căn hộ chi tiết
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
  const [houseDetail, setHouseDetail] = useState(''); // Số nhà, tầng, phòng cụ thể
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

  // Khởi tạo bản đồ Leaflet với CartoDB Voyager Tiles (chuẩn màu Google/ShopeeFood, tốc độ cao)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const initialLat = selectedCoord.lat || 10.7769;
    const initialLng = selectedCoord.lng || 106.7009;

    if (!mapInstanceRef.current) {
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

      // Sử dụng OpenStreetMap Humanitarian (HOT) - 100% MIỄN PHÍ, KHÔNG cần bất kỳ API Key nào
      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19
      }).addTo(map);

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
    } else {
      mapInstanceRef.current.setView([initialLat, initialLng], 16);
    }

    // Force Leaflet tính lại kích thước chính xác sau khi modal mở (tránh bản đồ bị xám)
    const timer1 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize(true);
      }
    }, 100);

    const timer2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize(true);
      }
    }, 350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen]);

  // Dọn dẹp bản đồ khi unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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

  // Tìm kiếm địa chỉ với Photon (Komoot) + Nominatim
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
      (err) => {
        alert('Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí trên trình duyệt.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Xác nhận vị trí
  const handleConfirm = () => {
    // Ghép số nhà/chi tiết cụ thể nếu người dùng có nhập
    let finalAddress = addressInfo.address;
    if (houseDetail.trim()) {
      // Nếu địa chỉ chưa chứa số nhà này thì nối vào đầu
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Khung Modal chính: Cố định chiều cao flex h-[88vh] max-h-[640px] để nút Done không bao giờ bị chìm */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[640px]">
        
        {/* =================================================================== */}
        {/* 1. HEADER (Cố định - flex-shrink-0) */}
        {/* =================================================================== */}
        <div className="flex-shrink-0 px-5 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between border-b border-gray-100 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
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
        <div className="flex-shrink-0 p-3 sm:p-4 bg-gray-50 border-b border-gray-100 relative z-30">
          <div className="relative flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 ml-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Nhập địa chỉ (VD: 53 Đường 12, Hiệp Bình, Landmark 81...)"
              className="w-full px-3 py-2.5 sm:py-3 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-orange-500 animate-spin mr-2 shrink-0" />
            )}
            <button
              onClick={handleUseCurrentGPS}
              disabled={gpsLoading}
              className="mr-2 px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors shrink-0"
              title="Định vị theo GPS hiện tại"
            >
              <Crosshair className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Vị trí hiện tại</span>
            </button>
          </div>

          {/* Dropdown gợi ý tìm kiếm có số nhà, tên đường */}
          {searchResults.length > 0 && (
            <div className="absolute left-3 right-3 sm:left-4 sm:right-4 top-[64px] sm:top-[70px] bg-white rounded-2xl shadow-2xl border border-gray-100 divide-y divide-gray-50 max-h-52 overflow-y-auto z-40 animate-fadeIn">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left p-3 hover:bg-orange-50/70 transition-colors flex items-start gap-2.5"
                >
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{item.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* 3. BẢN ĐỒ TƯƠNG TÁC (Tự co giãn - flex-1 min-h-0) */}
        {/* =================================================================== */}
        <div className="relative flex-1 min-h-0 w-full bg-slate-100 overflow-hidden cursor-grab active:cursor-grabbing">
          {/* Leaflet container tuyệt đối chiếm trọn 100% diện tích còn lại */}
          <div
            ref={mapContainerRef}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 1 }}
          />

          {/* Ghim đỏ chính giữa bản đồ (Center Pin ShopeeFood) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[1000] flex flex-col items-center">
            {/* Tooltip trạng thái geocoding */}
            <div className="mb-1 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-medium shadow-xl backdrop-blur-sm whitespace-nowrap animate-bounce flex items-center gap-1.5">
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
              <svg width="38" height="46" viewBox="0 0 24 28" fill="none" className="drop-shadow-xl">
                <path
                  d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 10.5 27 12 28C13.5 27 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z"
                  fill="#EE4D2D"
                />
                <circle cx="12" cy="11" r="5" fill="white" />
                <circle cx="12" cy="11" r="2.5" fill="#EE4D2D" />
              </svg>
            </div>
            {/* Đổ bóng đáy pin */}
            <div className="w-3 h-1.5 bg-black/40 rounded-full blur-[1px] -mt-0.5" />
          </div>

          {/* Gợi ý tương tác góc dưới */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200/80 shadow-md text-[11px] text-gray-700 font-medium flex items-center gap-1.5 pointer-events-none">
            <Navigation className="w-3.5 h-3.5 text-orange-500" />
            <span>Kéo hoặc nhấp bản đồ để đổi vị trí</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. FOOTER: CHI TIẾT ĐỊA CHỈ & NÚT DONE (Cố định - flex-shrink-0) */}
        {/* =================================================================== */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-20 space-y-3">
          {/* Hàng 1: Địa chỉ trên bản đồ */}
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Địa chỉ giao hàng trên bản đồ
              </p>
              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate" title={addressInfo.address}>
                {addressInfo.address}
              </p>
            </div>
          </div>

          {/* Hàng 2: Ô nhập số nhà / tầng / căn hộ cụ thể chuẩn ShopeeFood */}
          <div className="relative flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
            <HomeIcon className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
            <input
              type="text"
              value={houseDetail}
              onChange={(e) => setHouseDetail(e.target.value)}
              placeholder="Chi tiết số nhà, số tầng, số phòng (VD: Số 53, Tòa S1.02...)"
              className="w-full px-2.5 py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
            />
          </div>

          {/* Hàng 3: NÚT DONE NỔI BẬT KHÔNG BAO GIỜ BỊ CHÌM */}
          <button
            onClick={handleConfirm}
            className="w-full py-3 sm:py-3.5 rounded-xl bg-[#0084ff] hover:bg-[#0073e6] active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>Done</span>
          </button>
        </div>

      </div>
    </div>
  );
}
