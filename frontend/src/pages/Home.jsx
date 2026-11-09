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
  ChevronDown,
  Crosshair,
  Compass,
  Tag,
  Sparkles,
  SlidersHorizontal,
  Flame,
  Award,
  Check,
  Heart
} from 'lucide-react';
import { restaurantApi } from '../api/client';
import { useUserLocation } from '../hooks/useUserLocation';
import { useLocationCity } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { calculateHaversineDistance } from '../utils/deliveryEstimate';
import DeliveryBadge from '../components/DeliveryBadge';
import AddressPickerModal from '../components/AddressPickerModal';
import PromotionPopupModal from '../components/PromotionPopupModal';

// Danh sách quán ăn mẫu chuẩn FoodFast (Hiển thị ngay khi database chưa có dữ liệu)
const DEFAULT_FOODFAST_STORES = [
  {
    _id: 'store_mcdonalds',
    name: "Gà Rán & Burger McDonald's",
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 1',
    address: 'Đa Kao, Quận 1, TP. Hồ Chí Minh',
    rating: 4.8,
    completed_orders: 1420,
    locationsCount: 22,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Giảm món',
    latitude: 10.7769,
    longitude: 106.7009
  },
  {
    _id: 'store_xoichien',
    name: 'Xôi Chiên',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 3',
    address: 'Phường 4, Quận 3, TP. Hồ Chí Minh',
    rating: 4.7,
    completed_orders: 860,
    locationsCount: 4,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Giảm món',
    latitude: 10.7725,
    longitude: 106.6980
  },
  {
    _id: 'store_sundaybasic',
    name: 'Trà Sữa Sunday Basic',
    image: 'https://images.unsplash.com/photo-1558857563-b37cf5288219?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 10',
    address: 'Đường 3 Tháng 2, Quận 10, TP. Hồ Chí Minh',
    rating: 4.9,
    completed_orders: 2150,
    locationsCount: 42,
    min_order_value: 20000,
    isVerified: false,
    promo: 'Giảm món',
    latitude: 10.7690,
    longitude: 106.6730
  },
  {
    _id: 'store_comtamsaigon',
    name: 'Cơm Tấm Sài Gòn - Nguyễn Trãi',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 5',
    address: 'Nguyễn Trãi, Quận 5, TP. Hồ Chí Minh',
    rating: 4.9,
    completed_orders: 1980,
    locationsCount: 8,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Mã giảm 20%',
    latitude: 10.7550,
    longitude: 106.6660
  },
  {
    _id: 'store_bunbohue',
    name: 'Bún Bò Huế Cay Nồng',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
    district: 'Bình Thạnh',
    address: 'Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh',
    rating: 4.8,
    completed_orders: 1240,
    locationsCount: 6,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Giảm món',
    latitude: 10.7950,
    longitude: 106.7218
  },
  {
    _id: 'store_sushihokkaido',
    name: 'Sushi Hokkaido Sachi - Đông Du',
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 1',
    address: 'Đông Du, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    rating: 5.0,
    completed_orders: 950,
    locationsCount: 5,
    min_order_value: 50000,
    isVerified: true,
    promo: 'Freeship 50k',
    latitude: 10.7761,
    longitude: 106.7042
  }
];

// Helper hiển thị số địa điểm / chi nhánh
const getLocationCountText = (store) => {
  if (store.locationsCount) return `${store.locationsCount} địa điểm`;
  const nameLower = (store.name || '').toLowerCase();
  if (nameLower.includes('mcdonald')) return '22 địa điểm';
  if (nameLower.includes('xôi chiên') || nameLower.includes('xôi')) return '4 địa điểm';
  if (nameLower.includes('sunday')) return '42 địa điểm';
  if (store.district) return `${store.district}`;
  return '1 địa điểm';
};

// Helper hiển thị đơn tối thiểu
const getMinOrderText = (store) => {
  if (store.min_order_value) return `Tối thiểu ${store.min_order_value / 1000}k`;
  return 'Tối thiểu 20k';
};

// Helper hiển thị khoảng giá
const getPriceRangeText = (store) => {
  if (store.menuItems && store.menuItems.length > 0) {
    const prices = store.menuItems.map((m) => m.price).filter((p) => typeof p === 'number' && p > 0);
    if (prices.length > 0) {
      return `Giá từ ${Math.min(...prices) / 1000}k`;
    }
  }
  return 'Giá 0';
};

// Helper hiển thị tag khuyến mãi
const getPromoTag = (store) => {
  if (store.promo) return store.promo;
  if (store.promo_text) return store.promo_text;
  if ((store.rating || 0) >= 4.7) return 'Giảm món';
  return 'Mã giảm 20%';
};

// Các danh mục món ăn chuẩn phong cách FoodFast (Image 1)
const FOODFAST_CATEGORIES = [
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

// 20 Danh mục đặc trưng chuẩn ShopeeFood (Kèm Icon 3D chính hãng từ shopeefood-app-main)
const SHOPEEFOOD_TOP_CATEGORIES = [
  { id: 'all', name: 'Tất cả', icon: '/icons/nice-shop.png', keyword: '' },
  { id: 'deal', name: 'Hot Deal', icon: '/icons/flash-deals.png', keyword: 'giảm|deal|khuyến mãi' },
  { id: 'rice', name: 'Cơm Trưa', icon: '/icons/rice.png', keyword: 'cơm' },
  { id: 'bun_pho', name: 'Bún Mì Phở', icon: '/icons/bun-pho.png', keyword: 'bún|phở|mì|hủ tiếu' },
  { id: 'milk_tea', name: 'Trà Sữa', icon: '/icons/sweet-food.png', keyword: 'trà sữa|chè|nước ngọt|trà' },
  { id: 'fastfood', name: 'Fast Food', icon: '/icons/fastfood.png', keyword: 'burger|gà rán|fast food|khoai tây' },
  { id: 'bbq', name: 'BBQ Nướng', icon: '/icons/bbq.png', keyword: 'nướng|bbq|lẩu' },
  { id: 'pizza', name: 'Pizza', icon: '/icons/Pizza.png', keyword: 'pizza' },
  { id: 'burger', name: 'Burger', icon: '/icons/burger.png', keyword: 'burger' },
  { id: 'fried_chicken', name: 'Gà Rán', icon: '/icons/fried-chicken.png', keyword: 'gà rán|gà' },
  { id: 'korean', name: 'Món Hàn', icon: '/icons/korean-food.png', keyword: 'hàn|kimchi|tokbokki' },
  { id: 'steak', name: 'Bít Tết', icon: '/icons/Steak.png', keyword: 'bò|bít tết|steak' },
  { id: 'healthy', name: 'Sống Khỏe', icon: '/icons/salad.png', keyword: 'salad|chay|healthy' },
  { id: 'points', name: 'Tích Điểm', icon: '/icons/points.png', keyword: '' },
  { id: 'freeship', name: 'Freeship 0Đ', icon: '/icons/moi-moi.png', keyword: '' },
  { id: 'deal_0d', name: 'Deal 0Đ', icon: '/icons/tomato.png', keyword: '' },
  { id: 'afternoon', name: 'Ăn Chiều', icon: '/icons/chowmein.png', keyword: 'ăn vặt|bánh tráng|xiên que' },
  { id: 'sandwich', name: 'Bánh Mì', icon: '/icons/Sub-sandiwch.png', keyword: 'bánh mì|sandwich' },
  { id: 'veg', name: 'Món Chay', icon: '/icons/vegetable.png', keyword: 'chay' },
  { id: 'combos', name: 'Combo Hot', icon: '/icons/elipse.png', keyword: 'combo' }
];

// Chuẩn hóa tên Quận/Huyện để so sánh chính xác ("TP. Thủ Đức" và "Thành phố Thủ Đức" đều thành "thủ đức")
function normalizeDistrictName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/^(thành phố|tp\.|tp|quận|huyện|thị xã)\s+/i, '')
    .trim();
}

function matchDistrict(res, targetDistrict) {
  if (!targetDistrict || targetDistrict === 'ALL') return true;
  const selNorm = normalizeDistrictName(targetDistrict);
  const resDistNorm = normalizeDistrictName(res.district);
  const resAddrNorm = (res.address || '').toLowerCase();

  if (resDistNorm && (resDistNorm === selNorm || resDistNorm.includes(selNorm) || selNorm.includes(resDistNorm))) {
    return true;
  }
  if (resAddrNorm && (resAddrNorm.includes(selNorm) || resAddrNorm.includes(targetDistrict.toLowerCase()))) {
    return true;
  }
  return false;
}

export default function Home() {
  const { selectedCity } = useLocationCity();
  const { user, isAuthenticated } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);

  // Bộ lọc tìm kiếm và danh mục
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTopCatId, setSelectedTopCatId] = useState('all');

  // Tabs FoodFast: 'near' (Gần tôi) | 'bestseller' (Bán chạy) | 'rating' (Đánh giá) | 'favorites' (Yêu thích)
  const [activeTab, setActiveTab] = useState('near');
  // Lọc theo Quận/Huyện
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');

  const [copiedVoucher, setCopiedVoucher] = useState(null);
  const [likedStoreIds, setLikedStoreIds] = useState([]);

  // Khởi tạo danh sách quán yêu thích từ API hoặc localStorage
  useEffect(() => {
    const loadFavorites = async () => {
      const uid = user?.id || user?.userId || user?._id || user?.email;
      if (uid) {
        try {
          const res = await restaurantApi.getFavorites(uid);
          if (res.data?.success && Array.isArray(res.data.data)) {
            setLikedStoreIds(res.data.data.map((s) => s._id));
          }
        } catch {}
      } else {
        try {
          const saved = localStorage.getItem('foodfast_guest_likes');
          if (saved) setLikedStoreIds(JSON.parse(saved));
        } catch {}
      }
    };
    loadFavorites();
  }, [user]);

  const handleToggleFavorite = async (storeId) => {
    const uid = user?.id || user?.userId || user?._id || user?.email || 'guest';
    const isLiked = likedStoreIds.includes(storeId);
    const updated = isLiked ? likedStoreIds.filter((id) => id !== storeId) : [...likedStoreIds, storeId];
    setLikedStoreIds(updated);
    localStorage.setItem('foodfast_guest_likes', JSON.stringify(updated));

    if (isAuthenticated) {
      try {
        await restaurantApi.toggleLike(storeId, uid);
      } catch (e) {
        console.error('Lỗi lưu yêu thích:', e);
      }
    }
  };

  // Vị trí giao hàng (Địa chỉ thực tế + Tọa độ OSRM - Đồng bộ 100% với Tỉnh/Thành phố)
  const {
    location: userCoord,
    refreshLocation,
    setManualLocation,
    loading: locationLoading
  } = useUserLocation();

  // Trạng thái mở modal "Bạn muốn giao đến đâu?"
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const fetchRestaurants = async (bypassCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = { city: selectedCity?.code || 'hcm' };
      if (bypassCache) {
        params.refresh = 'true';
        params._t = Date.now();
      }
      const res = await restaurantApi.getAll(params);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setRestaurants(res.data.data);
        setDataSource(res.data.source || 'database');
      } else {
        console.warn('Dữ liệu phản hồi không đúng chuẩn:', res.data);
        setError('Không thể lấy danh sách quán ăn từ máy chủ. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi tải danh sách quán:', err);
      // Giữ demo fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants(true);
    setSelectedDistrict('ALL');
  }, [selectedCity?.code]);

  const handleCopyVoucher = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedVoucher(code);
    setTimeout(() => setCopiedVoucher(null), 2500);
  };

  // Danh sách quán gốc (Kết hợp API và demo fallback khi trống)
  const storeList = useMemo(() => {
    if (restaurants.length > 0) return restaurants;
    if (selectedCity?.code === 'hcm' || !selectedCity?.code) return DEFAULT_FOODFAST_STORES;
    return [];
  }, [restaurants, selectedCity?.code]);

  // Trích xuất danh sách quận/huyện có sẵn theo tỉnh thành (loại bỏ trùng lặp chuẩn hóa)
  const availableDistricts = useMemo(() => {
    const list = [];
    const seen = new Set();

    const addDistrict = (d) => {
      if (!d || !d.trim()) return;
      const clean = d.trim();
      const norm = normalizeDistrictName(clean);
      if (!seen.has(norm)) {
        seen.add(norm);
        list.push(clean);
      }
    };

    if (selectedCity?.code === 'hcm' || !selectedCity?.code) {
      ['Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 7', 'Quận 10', 'TP. Thủ Đức', 'Bình Thạnh', 'Tân Bình', 'Phú Nhuận', 'Gò Vấp'].forEach(addDistrict);
    } else if (selectedCity?.code === 'hn') {
      ['Hoàn Kiếm', 'Ba Đình', 'Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 'Tây Hồ', 'Thanh Xuân', 'Nam Từ Liêm'].forEach(addDistrict);
    } else if (selectedCity?.code === 'dn') {
      ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ'].forEach(addDistrict);
    }

    storeList.forEach((r) => {
      if (r.district && r.district.trim()) {
        addDistrict(r.district.trim());
      }
    });

    return list;
  }, [selectedCity?.code, storeList]);

  // Lọc và sắp xếp quán ăn theo Tab (Gần tôi / Bán chạy / Đánh giá) và Quận/Huyện
  const displayedRestaurants = useMemo(() => {
    let list = storeList.filter((res) => {
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

      // 2. Lọc theo danh mục ShopeeFood (Top 20 Categories Grid)
      if (selectedTopCatId !== 'all') {
        const topCat = SHOPEEFOOD_TOP_CATEGORIES.find((c) => c.id === selectedTopCatId);
        if (topCat && topCat.keyword) {
          const regex = new RegExp(topCat.keyword, 'i');
          const matchName = regex.test(res.name || '');
          const matchDish = regex.test(res.specialtyDish || '');
          const matchCuisine = (res.cuisineTypes || []).some((c) => regex.test(c));
          const matchItems = (res.menuItems || []).some((item) => regex.test(item.name || ''));
          if (!matchName && !matchDish && !matchCuisine && !matchItems) {
            return false;
          }
        }
      }

      // 2.1 Lọc theo danh mục FoodFast
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

      // 3. Lọc theo Quận/Huyện (chuẩn hóa tên quận, không phân biệt hoa thường và tiền tố TP/Quận)
      if (selectedDistrict !== 'ALL') {
        if (!matchDistrict(res, selectedDistrict)) {
          return false;
        }
      }

      return true;
    });

    // 4. Sắp xếp theo Tab FoodFast
    const uLat = userCoord?.lat || selectedCity?.lat || 10.7769;
    const uLng = userCoord?.lng || selectedCity?.lng || 106.7009;

    if (activeTab === 'favorites') {
      list = list.filter((r) => likedStoreIds.includes(r._id));
    } else if (activeTab === 'near') {
      list.sort((a, b) => {
        const distA = calculateHaversineDistance(uLat, uLng, a.latitude || uLat, a.longitude || uLng);
        const distB = calculateHaversineDistance(uLat, uLng, b.latitude || uLat, b.longitude || uLng);
        return distA - distB;
      });
    } else if (activeTab === 'bestseller') {
      list.sort((a, b) => (b.completed_orders || 0) - (a.completed_orders || 0));
    } else if (activeTab === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [storeList, searchKeyword, selectedCategory, selectedTopCatId, selectedDistrict, activeTab, likedStoreIds, userCoord, selectedCity]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* ===================================================================== */}
      {/* 1. HERO BANNER CHUẨN FOODFAST (Image 1) */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800">
        {/* Ảnh nền đêm đô thị phong cách FoodFast */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity scale-105"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=80")'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-transparent" />

        <div className="relative z-10 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Cột trái: Tiêu đề, Thanh tìm kiếm & Danh mục FoodFast */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Đặt Đồ ăn, giao hàng từ 20'...
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Có {restaurants.length}+ Địa Điểm Tại {selectedCity?.name || 'TP. HCM'} & Lân Cận Từ 00:00 - 23:59
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

            {/* Danh sách Tags Danh mục FoodFast */}
            <div className="flex flex-wrap gap-2 pt-1">
              {FOODFAST_CATEGORIES.map((cat) => {
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
            {/* Thanh điều hướng Chọn địa chỉ giao hàng FoodFast */}
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

              {/* 3 Thẻ món ăn ưu đãi mini (Nhấp để chép mã Voucher) */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    name: 'Cơm Tấm Sài Gòn',
                    deal: 'Mã giảm 20%',
                    code: 'QUANNGON20',
                    img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80'
                  },
                  {
                    name: 'Trà Sữa Trân Châu',
                    deal: 'Giảm 10k',
                    code: 'FOODFAST10',
                    img: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=300&q=80'
                  },
                  {
                    name: 'Bún Bò Huế Cay',
                    deal: 'Freeship 50k',
                    code: 'FREESHIP50',
                    img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80'
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleCopyVoucher(item.code)}
                    className="group/item flex flex-col space-y-1.5 cursor-pointer hover:opacity-95 transition-all"
                    title={`Bấm để sao chép mã ${item.code}`}
                  >
                    <div className="h-16 w-full rounded-xl overflow-hidden bg-gray-100 relative">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform"
                      />
                      {copiedVoucher === item.code && (
                        <div className="absolute inset-0 bg-black/75 flex items-center justify-center text-[10px] text-emerald-400 font-bold">
                          ✓ Đã chép mã
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-gray-800 line-clamp-1">{item.name}</p>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200/60 rounded px-1.5 py-0.5 w-fit group-hover/item:bg-red-100 transition-colors">
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
      {/* 1.5. DANH MỤC ĐẶC TRƯNG SHOPEEFOOD (20 Icon Grid từ shopeefood-app-main) */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-ping" />
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              Khám Phá Món Ngon ShopeeFood
            </h2>
          </div>
          {selectedTopCatId !== 'all' && (
            <button
              onClick={() => setSelectedTopCatId('all')}
              className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          )}
        </div>

        {/* 20 Icon danh mục ShopeeFood dạng grid 2 hàng lướt ngang mượt mà */}
        <div className="grid grid-rows-2 grid-flow-col auto-cols-[84px] sm:auto-cols-[98px] gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none">
          {SHOPEEFOOD_TOP_CATEGORIES.map((cat) => {
            const isSelected = selectedTopCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedTopCatId(isSelected ? 'all' : cat.id);
                  if (activeTab === 'favorites') setActiveTab('near');
                }}
                className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all group cursor-pointer ${
                  isSelected
                    ? 'bg-orange-50 border-2 border-orange-500 scale-102 shadow-xs'
                    : 'bg-gray-50/70 hover:bg-orange-50/60 border border-gray-100 hover:border-orange-200'
                }`}
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center overflow-hidden mb-1 group-hover:scale-110 transition-transform">
                  <img
                    src={cat.icon}
                    alt={cat.name}
                    className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = '/icons/nice-shop.png';
                    }}
                  />
                </div>
                <span
                  className={`text-[11px] sm:text-xs text-center font-bold leading-tight line-clamp-1 ${
                    isSelected ? 'text-orange-600' : 'text-gray-700 group-hover:text-orange-600'
                  }`}
                >
                  {cat.name}
                </span>
              </button>
            );
          })}
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
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">
                {selectedCity?.shortName || 'TP. HCM'}
              </span>
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
      {/* 3. TABS CHUẨN FOODFAST: GẦN TÔI | BÁN CHẠY | ĐÁNH GIÁ & CHỌN QUẬN */}
      {/* ===================================================================== */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
        {/* Left: 3 Tabs (Gần tôi, Bán chạy, Đánh giá) - Đã bỏ Giao nhanh theo yêu cầu */}
        <div className="flex items-center gap-6 sm:gap-8">
          <button
            onClick={() => setActiveTab('near')}
            className={`text-sm sm:text-base transition-colors relative pb-2 cursor-pointer ${
              activeTab === 'near'
                ? 'text-[#0084ff] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0084ff]'
                : 'text-gray-700 hover:text-gray-950 font-medium'
            }`}
          >
            Gần tôi
          </button>

          <button
            onClick={() => setActiveTab('bestseller')}
            className={`text-sm sm:text-base transition-colors relative pb-2 cursor-pointer ${
              activeTab === 'bestseller'
                ? 'text-[#0084ff] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0084ff]'
                : 'text-gray-700 hover:text-gray-950 font-medium'
            }`}
          >
            Bán chạy
          </button>

          <button
            onClick={() => setActiveTab('rating')}
            className={`text-sm sm:text-base transition-colors relative pb-2 cursor-pointer ${
              activeTab === 'rating'
                ? 'text-[#0084ff] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0084ff]'
                : 'text-gray-700 hover:text-gray-950 font-medium'
            }`}
          >
            Đánh giá
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`text-sm sm:text-base transition-colors relative pb-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'favorites'
                ? 'text-red-500 font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-red-500'
                : 'text-gray-700 hover:text-red-500 font-medium'
            }`}
          >
            <Heart className={`w-4 h-4 ${activeTab === 'favorites' || likedStoreIds.length > 0 ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            <span>Yêu thích ({likedStoreIds.length})</span>
          </button>
        </div>

        {/* Right: Nút làm mới + Dropdown "Chọn quận/ huyện ▾" */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchRestaurants(true)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-500 hover:text-orange-600 transition-all shadow-xs cursor-pointer"
            title="Đồng bộ / Làm mới danh sách quán ngay lập tức"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-500' : ''}`} />
          </button>

          <div className="relative">
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="appearance-none bg-white border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0084ff]/20 focus:border-[#0084ff] cursor-pointer shadow-xs transition-all"
            >
              <option value="ALL">Chọn quận/ huyện</option>
              {availableDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm animate-pulse flex items-start gap-3">
              <div className="w-28 h-20 sm:w-32 sm:h-24 bg-gray-200 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. DANH SÁCH NHÀ HÀNG DẠNG THẺ NGANG CHUẨN FOODFAST (Image Upload) */}
      {/* ===================================================================== */}
      {!loading && (
        displayedRestaurants.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
              <MapPin className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base text-gray-900 font-extrabold">
                Chưa có quán ăn nào phù hợp tại {selectedDistrict !== 'ALL' ? selectedDistrict : (selectedCity?.name || 'khu vực này')}
              </p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Bạn có thể thử chọn quận/huyện khác hoặc chuyển sang danh mục món ăn khác.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSearchKeyword('');
                  setSelectedCategory('All');
                  setSelectedDistrict('ALL');
                  setActiveTab('near');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {displayedRestaurants.map((res) => (
              <Link
                key={res._id}
                to={`/restaurants/${res._id}`}
                className="bg-white rounded-2xl p-3 border border-gray-100 hover:border-sky-300 hover:shadow-md transition-all duration-200 flex items-start gap-3 group cursor-pointer relative"
              >
                {/* Left: Thumbnail ảnh quán kèm Chấm xanh trực tuyến 🟢 và Nút Thả tim ❤️ */}
                <div className="relative w-28 h-20 sm:w-32 sm:h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  <img
                    src={res.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80'}
                    alt={res.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* Chấm xanh trạng thái trực tuyến chuẩn FoodFast */}
                  <span
                    className="absolute top-1.5 left-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm"
                    title="Đang mở cửa / phục vụ"
                  />
                  {/* Nút Thả tim lưu quán yêu thích (Wishlist) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleFavorite(res._id);
                    }}
                    className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-xs cursor-pointer ${
                      likedStoreIds.includes(res._id)
                        ? 'bg-red-500 text-white scale-110 shadow-sm'
                        : 'bg-black/35 text-white/90 hover:bg-black/60 hover:text-red-400'
                    }`}
                    title={likedStoreIds.includes(res._id) ? 'Bỏ yêu thích' : 'Lưu quán yêu thích'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${likedStoreIds.includes(res._id) ? 'fill-white text-white' : ''}`} />
                  </button>
                </div>

                {/* Right: Thông tin quán chuẩn FoodFast */}
                <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5 space-y-1">
                  {/* Hàng 1: Icon cam xác thực + Tên Quán */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {res.isVerified !== false && (
                      <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 text-xs sm:text-sm group-hover:text-[#0084ff] transition-colors truncate">
                      {res.name}
                    </h3>
                  </div>

                  {/* Hàng 2: Số địa điểm / chi nhánh màu xanh dương FoodFast */}
                  <p className="text-xs font-semibold text-[#0084ff] truncate">
                    {getLocationCountText(res)}
                  </p>

                  {/* Hàng 3: Tối thiểu 20k / Giá 0 */}
                  <div className="flex items-center gap-2.5 text-[11px] sm:text-xs text-gray-500 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-gray-400 rotate-90" />
                      <span>{getMinOrderText(res)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded-full border border-gray-400 text-[10px] flex items-center justify-center font-bold text-gray-500 leading-none">
                        $
                      </span>
                      <span>{getPriceRangeText(res)}</span>
                    </div>
                  </div>

                  {/* Hàng 4: Tag khuyến mãi màu đỏ Giảm món */}
                  <div className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                    <Tag className="w-3 h-3 text-red-500 fill-red-500" />
                    <span>{getPromoTag(res)}</span>
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
        currentLocation={
          userCoord?.isDefault && selectedCity
            ? { ...userCoord, lat: selectedCity.lat, lng: selectedCity.lng, shortAddress: selectedCity.name }
            : userCoord
        }
        onSelectLocation={setManualLocation}
      />
      {/* Modal Popup Khuyến mãi Deal sốc đầu ứng dụng (ShopeeFood Flash Sale Popup) */}
      <PromotionPopupModal />
    </div>
  );
}
