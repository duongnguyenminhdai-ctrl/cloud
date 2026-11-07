import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  MapPin,
  Phone,
  Zap,
  ArrowRight,
  RefreshCw,
  Search,
  ChevronRight,
  Crosshair,
  Compass,
  Tag,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { restaurantApi } from '../api/client';
import { useUserLocation } from '../hooks/useUserLocation';
import DeliveryBadge from '../components/DeliveryBadge';
import AddressPickerModal from '../components/AddressPickerModal';

// Các danh mục món ăn chuẩn phong cách ShopeeFood (Image 1)
const SHOPEE_CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: 'Đồ ăn', label: 'Đồ ăn' },
  { id: 'Đồ uống', label: 'Đồ uống' },
  { id: 'Đồ chay', label: 'Đồ chay' },
  { id: 'Bánh kem', label: 'Bánh kem' },
  { id: 'Tráng miệng', label: 'Tráng miệng' },
  { id: 'Pizza/Burger', label: 'Pizza/Burger' },
  { id: 'Món lẩu', label: 'Món lẩu' },
  { id: 'Sushi', label: 'Sushi' },
  { id: 'Mì phở', label: 'Mì phở' },
  { id: 'Cơm hộp', label: 'Cơm hộp' }
];

export default function Home() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);

  // Bộ lọc tìm kiếm và danh mục
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Vị trí giao hàng (Địa chỉ thực tế + Tọa độ OSRM)
  const {
    location: userCoord,
    refreshLocation,
    setManualLocation,
    loading: locationLoading
  } = useUserLocation();

  // Trạng thái mở modal "Bạn muốn giao đến đâu?"
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const fetchRestaurants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await restaurantApi.getAll();
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setRestaurants(res.data.data);
        setDataSource(res.data.source || 'database');
      } else {
        console.warn('Dữ liệu phản hồi không đúng chuẩn:', res.data);
        setError('Không thể lấy danh sách quán ăn từ máy chủ. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi tải danh sách quán:', err);
      setError('Không thể kết nối tới Restaurant Service qua API Gateway.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Lọc quán ăn theo từ khóa tìm kiếm và danh mục
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((res) => {
      // 1. Tìm kiếm theo tên quán, địa chỉ, món ăn
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchName = res.name?.toLowerCase().includes(q);
        const matchAddr = res.address?.toLowerCase().includes(q);
        const matchDish = res.specialtyDish?.toLowerCase().includes(q);
        const matchItems = res.menuItems?.some((item) => item.name?.toLowerCase().includes(q));
        if (!matchName && !matchAddr && !matchDish && !matchItems) {
          return false;
        }
      }

      // 2. Lọc theo danh mục ShopeeFood
      if (selectedCategory !== 'All') {
        const cat = selectedCategory.toLowerCase();
        const matchName = res.name?.toLowerCase().includes(cat);
        const matchCuisine = res.cuisineTypes?.some((c) => c.toLowerCase().includes(cat));
        const matchService = res.serviceTypes?.some((s) => s.toLowerCase().includes(cat));
        const matchDish = res.specialtyDish?.toLowerCase().includes(cat);
        const matchItems = res.menuItems?.some((item) => item.name?.toLowerCase().includes(cat));
        if (!matchName && !matchCuisine && !matchService && !matchDish && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [restaurants, searchKeyword, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* ===================================================================== */}
      {/* 1. HERO BANNER CHUẨN SHOPEEFOOD.VN (Image 1) */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800">
        {/* Ảnh nền đêm đô thị phong cách ShopeeFood */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity scale-105"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=80")'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-transparent" />

        <div className="relative z-10 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Cột trái: Tiêu đề, Thanh tìm kiếm & Danh mục Shopee */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Đặt Đồ ăn, giao hàng từ 20'...
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Có {restaurants.length || 100}+ Địa Điểm Tại TP. HCM & Lân Cận Từ 00:00 - 23:59
              </p>
            </div>

            {/* Thanh tìm kiếm món ăn / địa chỉ */}
            <div className="flex bg-white rounded-2xl shadow-xl overflow-hidden p-1 border border-white/20 focus-within:ring-4 focus-within:ring-orange-500/30 transition-all">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm địa điểm, món ăn, địa chỉ..."
                className="w-full px-4 py-2.5 text-sm sm:text-base text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
              />
              <button
                className="px-5 py-2.5 bg-[#0084ff] hover:bg-[#0073e6] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-md"
                title="Tìm kiếm"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Danh sách Tags Danh mục ShopeeFood */}
            <div className="flex flex-wrap gap-2 pt-1">
              {SHOPEE_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-600/30'
                        : 'bg-white/10 hover:bg-white/20 text-white/90 border-white/10 backdrop-blur-sm'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Badges tải App */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-slate-300 border-t border-white/10">
              <span>Sử dụng App FoodFast để có nhiều giảm giá và trải nghiệm tốt hơn</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-black/60 border border-white/20 text-[11px] font-semibold">
                  App Store
                </span>
                <span className="px-3 py-1 rounded-lg bg-black/60 border border-white/20 text-[11px] font-semibold">
                  Google Play
                </span>
              </div>
            </div>
          </div>

          {/* Cột phải: Trigger chọn địa chỉ & Thẻ Ưu đãi (Image 1) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Thanh điều hướng Chọn địa chỉ giao hàng ShopeeFood */}
            <button
              onClick={() => setIsAddressModalOpen(true)}
              className="w-full bg-white text-gray-900 p-3 sm:p-3.5 rounded-2xl shadow-xl border border-gray-100 flex items-center justify-between hover:border-orange-400 hover:shadow-orange-500/10 transition-all group"
              title="Nhấn để đổi địa chỉ giao hàng"
            >
              <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
                <span className="font-bold text-orange-600 shrink-0">Đồ ăn</span>
                <span className="text-gray-300 shrink-0">→</span>
                <span className="text-gray-700 font-semibold truncate group-hover:text-orange-600 transition-colors">
                  {userCoord?.shortAddress || userCoord?.address || 'Chọn địa chỉ giao hàng'}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>

            {/* Khung thẻ Ưu đãi & Quán nổi bật thu nhỏ */}
            <div className="bg-white rounded-3xl p-4 shadow-xl border border-gray-100 text-gray-900 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900">
                  <Sparkles className="w-4 h-4 text-orange-500 fill-orange-500" />
                  <span>Ưu đãi hôm nay</span>
                </div>
                <span className="text-[11px] font-semibold text-[#0084ff] hover:underline cursor-pointer">
                  Xem tất cả
                </span>
              </div>

              {/* 3 Thẻ món ăn ưu đãi mini */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    name: 'Cơm Tấm Sài Gòn',
                    deal: 'Mã giảm 20%',
                    img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80'
                  },
                  {
                    name: 'Trà Sữa Trân Châu',
                    deal: 'Giảm đến 15k',
                    img: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=300&q=80'
                  },
                  {
                    name: 'Bún Bò Huế Cay',
                    deal: 'Freeship 0đ',
                    img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="group/item flex flex-col space-y-1.5">
                    <div className="h-16 w-full rounded-xl overflow-hidden bg-gray-100 relative">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform"
                      />
                    </div>
                    <p className="text-[11px] font-bold text-gray-800 line-clamp-1">{item.name}</p>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200/60 rounded px-1.5 py-0.5 w-fit">
                      <Tag className="w-2.5 h-2.5" /> {item.deal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. THANH HIỂN THỊ ĐỊA CHỈ GIAO HÀNG (Chuẩn Tên Đường - Không hiện IP) */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 bg-orange-50/70 border border-orange-200/70 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-orange-900 uppercase tracking-wider">
                Giao hàng đến:
              </span>
              {userCoord?.isDefault && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                  Mặc định TP.HCM
                </span>
              )}
            </div>
            {/* Hiển thị địa chỉ có nghĩa của con người (Không phải dãy số GPS/IP) */}
            <p
              onClick={() => setIsAddressModalOpen(true)}
              className="text-sm sm:text-base font-bold text-gray-900 truncate hover:text-orange-600 cursor-pointer transition-colors"
              title={userCoord?.address}
            >
              {userCoord?.address || 'Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'}
            </p>
          </div>
        </div>

        {/* Nút thao tác nhanh với vị trí */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setIsAddressModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-orange-100 text-orange-600 border border-orange-200 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            title="Mở bản đồ chọn địa chỉ giao hàng"
          >
            <Compass className="w-4 h-4 text-orange-600" />
            <span>Đổi địa chỉ</span>
          </button>

          <button
            onClick={refreshLocation}
            disabled={locationLoading}
            className="p-2 rounded-xl bg-white hover:bg-orange-100 text-gray-600 hover:text-orange-600 border border-orange-200 text-xs font-semibold shadow-sm transition-all"
            title="Định vị lại GPS của bạn"
          >
            <Crosshair className={`w-4 h-4 ${locationLoading ? 'animate-spin text-orange-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. HEADER DANH SÁCH QUÁN ĂN & CACHE TAG */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedCategory === 'All' ? 'Quán Ăn Nổi Bật' : `Quán Ăn: ${selectedCategory}`}
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {filteredRestaurants.length} quán
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Khoảng cách và thời gian giao hàng được tính từ lộ trình đường bộ thực tế (OSRM)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dataSource && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                dataSource === 'cache'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              {dataSource === 'cache' ? '⚡ Redis Cache Hit' : '🔍 MongoDB Atlas Query'}
            </span>
          )}
          <button
            onClick={fetchRestaurants}
            className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl border border-gray-200 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={fetchRestaurants}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse space-y-4">
              <div className="h-44 bg-gray-200 rounded-xl" />
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. DANH SÁCH NHÀ HÀNG KÈM TÍNH KHOẢNG CÁCH OSRM THỰC TẾ */}
      {/* ===================================================================== */}
      {!loading && !error && (
        filteredRestaurants.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 p-8 space-y-3">
            <p className="text-base text-gray-700 font-bold">Không tìm thấy quán ăn nào phù hợp.</p>
            <p className="text-xs text-gray-400">
              Hãy thử tìm kiếm từ khóa khác hoặc bấm chọn danh mục "All".
            </p>
            <button
              onClick={() => {
                setSearchKeyword('');
                setSelectedCategory('All');
              }}
              className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-xs font-bold transition-colors"
            >
              Xem tất cả quán ăn
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((res) => (
              <Link
                key={res._id}
                to={`/restaurants/${res._id}`}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Visual Header / Cover */}
                <div className="h-44 relative p-4 flex flex-col justify-between text-white overflow-hidden bg-gradient-to-tr from-orange-500 to-amber-400">
                  {res.image && (
                    <img
                      src={res.image}
                      alt={res.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30 pointer-events-none" />

                  {/* Rating và Badge Khoảng cách / Thời gian giao hàng OSRM */}
                  <div className="relative z-10 flex justify-between items-start gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-xs font-semibold flex items-center gap-1 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                      {res.rating ? Number(res.rating).toFixed(1) : '5.0'}
                    </span>
                    <DeliveryBadge store={res} userCoord={userCoord} />
                  </div>

                  <div className="relative z-10">
                    <h3 className="text-lg sm:text-xl font-bold drop-shadow group-hover:text-amber-200 transition-colors line-clamp-1">
                      {res.name}
                    </h3>
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{res.address}</span>
                    </div>
                    {res.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>{res.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Menu count & CTA */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-400">
                      {res.menuItems?.length || 0} món ăn trong thực đơn
                    </span>
                    <span className="text-orange-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      Xem Menu <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {/* ===================================================================== */}
      {/* 5. MODAL "BẠN MUỐN GIAO ĐẾN ĐÂU?" (Image 2) */}
      {/* ===================================================================== */}
      <AddressPickerModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        currentLocation={userCoord}
        onSelectLocation={setManualLocation}
      />
    </div>
  );
}
