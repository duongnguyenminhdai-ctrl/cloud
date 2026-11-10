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
import Pagination from '../components/Pagination';
import { subscribeRealtimeStream } from '../utils/realtimeSync';

// Danh sách quán ăn mẫu chuẩn FoodFast (Bao phủ đầy đủ 100% các danh mục món ăn)
const DEFAULT_FOODFAST_STORES = [
  {
    _id: 'store_mcdonalds',
    name: "Gà Rán & Burger McDonald's - Đa Kao",
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
    longitude: 106.7009,
    cuisineTypes: ['Burger', 'Gà rán', 'Pizza/Burger', 'Fast food', 'Đồ ăn'],
    serviceTypes: ['Giao hàng tiêu chuẩn', 'Món ăn nhanh'],
    specialtyDish: 'Burger Bò Big Mac & Gà Giòn Cay',
    menuItems: [
      { name: 'Burger Bò Big Mac', price: 79000, description: 'Burger 2 tầng bò nướng phô mai béo ngậy' },
      { name: 'Gà Rán Giòn Cay (2 Miếng)', price: 69000, description: 'Gà tươi ướp đậm vị chiên giòn tan' },
      { name: 'Khoai Tây Chiên Lắc Phô Mai', price: 35000, description: 'Khoai tây giòn rụm thơm lừng' }
    ]
  },
  {
    _id: 'store_sundaybasic',
    name: 'Trà Sữa Sunday Basic - 3 Tháng 2',
    image: 'https://images.unsplash.com/photo-1558857563-b37cf5288219?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 10',
    address: 'Đường 3 Tháng 2, Quận 10, TP. Hồ Chí Minh',
    rating: 4.9,
    completed_orders: 2150,
    locationsCount: 42,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Giảm 10k',
    latitude: 10.7690,
    longitude: 106.6730,
    cuisineTypes: ['Đồ uống', 'Trà sữa', 'Cà phê', 'Trà trái cây', 'Đá xay'],
    serviceTypes: ['Thức uống giao ngay', 'Trà sữa tự chọn topping'],
    specialtyDish: 'Trà Sữa Oolong Nướng & Trân Châu Hoàng Kim',
    menuItems: [
      { name: 'Trà Sữa Oolong Nướng Đậm Vị', price: 35000, description: 'Trà rang thơm lừng, sữa béo ngọt thanh' },
      { name: 'Trà Đào Cam Sả Tươi Mát', price: 39000, description: 'Đào ngâm giòn ngọt thanh sảng khoái' },
      { name: 'Cà Phê Muối Sữa Đặc Biệt', price: 29000, description: 'Cà phê đậm đà với lớp kem muối béo mặn' }
    ]
  },
  {
    _id: 'store_comchaybode',
    name: 'Cơm Chay Bồ Đề Tâm - Giác Ngộ',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 3',
    address: 'Võ Văn Tần, Phường 5, Quận 3, TP. Hồ Chí Minh',
    rating: 4.9,
    completed_orders: 1120,
    locationsCount: 3,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Giảm 15k',
    latitude: 10.7735,
    longitude: 106.6890,
    cuisineTypes: ['Đồ chay', 'Cơm chay', 'Món chay', 'Thanh tịnh', 'Healthy', 'Đồ ăn'],
    serviceTypes: ['Món chay thuần khiết', 'Cơm trưa văn phòng chay'],
    specialtyDish: 'Cơm Chiên Hạt Sen Bồ Đề & Lẩu Nấm Chay',
    menuItems: [
      { name: 'Cơm Chiên Hạt Sen Bồ Đề', price: 45000, description: 'Hạt sen bùi thơm, rau củ thanh mát' },
      { name: 'Hủ Tiếu Nam Vang Chay Thanh Tịnh', price: 40000, description: 'Nước dùng củ quả hầm ngọt tự nhiên' },
      { name: 'Nấm Đùi Gà Kho Tiêu Chay', price: 50000, description: 'Nấm thơm dẻo đậm đà ăn kèm cơm nóng' }
    ]
  },
  {
    _id: 'store_sweetbakery',
    name: 'Sweet Bakery - Bánh Kem & Tráng Miệng',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 1',
    address: 'Hai Bà Trưng, Phường Tân Định, Quận 1, TP. Hồ Chí Minh',
    rating: 4.9,
    completed_orders: 870,
    locationsCount: 2,
    min_order_value: 50000,
    isVerified: true,
    promo: 'Mã giảm 20%',
    latitude: 10.7900,
    longitude: 106.6940,
    cuisineTypes: ['Bánh kem', 'Tráng miệng', 'Bánh sinh nhật', 'Bakery', 'Bánh ngọt'],
    serviceTypes: ['Bánh ngọt cao cấp', 'Giao bánh kem tươi'],
    specialtyDish: 'Bánh Kem Bắp Phô Mai & Tiramisu Trái Cây',
    menuItems: [
      { name: 'Bánh Kem Bắp Phô Mai Mini', price: 120000, description: 'Cốt bánh mềm mịn nhân bắp phô mai ngậy' },
      { name: 'Bánh Tiramisu Hộp Nhỏ', price: 48000, description: 'Hương vị cà phê nồng nàn cùng kem mascarpone' },
      { name: 'Bánh Bông Lan Trứng Muối Chà Bông', price: 55000, description: 'Sốt phô mai béo ngậy kèm trứng muối thơm' }
    ]
  },
  {
    _id: 'store_chethaiyphuong',
    name: 'Chè Thái Ý Phương & Tráng Miệng Sài Gòn',
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 10',
    address: 'Nguyễn Tri Phương, Phường 4, Quận 10, TP. Hồ Chí Minh',
    rating: 4.8,
    completed_orders: 3100,
    locationsCount: 5,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Giảm món',
    latitude: 10.7630,
    longitude: 106.6690,
    cuisineTypes: ['Tráng miệng', 'Chè', 'Đồ uống', 'Kem', 'Ăn vặt'],
    serviceTypes: ['Chè tươi thơm ngon', 'Món tráng miệng truyền thống'],
    specialtyDish: 'Chè Thái Sầu Riêng Đặc Biệt & Bingsu Xoài',
    menuItems: [
      { name: 'Chè Thái Sầu Riêng Thơm Béo', price: 38000, description: 'Thạch thốt nốt, mít tươi và cơm sầu riêng hảo hạng' },
      { name: 'Chè Khúc Bạch Hạnh Nhân Phô Mai', price: 35000, description: 'Khúc bạch dẻo mềm nước đường phèn thanh mát' },
      { name: 'Bingsu Xoài Tuyết Sữa Tươi', price: 55000, description: 'Đá bào sữa xoài tươi đẫm sốt thơm lừng' }
    ]
  },
  {
    _id: 'store_kpubhotpot',
    name: 'Lẩu & Nướng Tokbokki K-Pub Korean BBQ',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80',
    district: 'Quận 7',
    address: 'Nguyễn Thị Thập, Tân Phú, Quận 7, TP. Hồ Chí Minh',
    rating: 4.7,
    completed_orders: 990,
    locationsCount: 7,
    min_order_value: 100000,
    isVerified: true,
    promo: 'Freeship 50k',
    latitude: 10.7380,
    longitude: 106.7110,
    cuisineTypes: ['Món lẩu', 'Lẩu', 'Nướng', 'BBQ', 'Món Hàn', 'Đồ ăn'],
    serviceTypes: ['Lẩu nóng giao tận nơi', 'BBQ Hàn Quốc chuẩn vị'],
    specialtyDish: 'Set Lẩu Kimchi Bò Mỹ & Nướng Thùng Phuy',
    menuItems: [
      { name: 'Set Lẩu Kimchi Bò Mỹ (2-3 người)', price: 199000, description: 'Nước lẩu kimchi chua cay, thịt bò ba chỉ cuộn nấm' },
      { name: 'Lẩu Thái Chua Cay Hải Sản', price: 219000, description: 'Tôm tươi, mực giòn cùng rau muống nấm kim châm' },
      { name: 'Tokbokki Phô Mai Kéo Sợi', price: 65000, description: 'Bánh gạo dẻo mềm sốt tương ớt Hàn Quốc' }
    ]
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
    longitude: 106.7042,
    cuisineTypes: ['Sushi', 'Sashimi', 'Món Nhật', 'Đồ ăn'],
    serviceTypes: ['Ẩm thực Nhật Bản cao cấp', 'Sushi tươi trong ngày'],
    specialtyDish: 'Sashimi Cá Hồi Tươi & Set Nigiri Sushi',
    menuItems: [
      { name: 'Set Sushi Cá Hồi 8 Miếng', price: 155000, description: 'Cá hồi tươi nhập khẩu béo ngậy' },
      { name: 'Sashimi Thập Cẩm Cao Cấp', price: 280000, description: 'Cá ngừ, cá hồi, sò đỏ, bạch tuộc tươi mát' },
      { name: 'Mì Ramen Xương Hầm Nước Tương', price: 110000, description: 'Thịt chashu hầm mềm, trứng lòng đào ngâm tương' }
    ]
  },
  {
    _id: 'store_bunbohue',
    name: 'Bún Bò Huế Cay Nồng - O Lan',
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
    longitude: 106.7218,
    cuisineTypes: ['Mì phở', 'Bún bò', 'Bún', 'Phở', 'Đồ ăn'],
    serviceTypes: ['Món nước nóng sốt', 'Ẩm thực cố đô Huế'],
    specialtyDish: 'Bún Bò Nạm Gân Chả Cua Đậm Đà',
    menuItems: [
      { name: 'Bún Bò Nạm Gân Chả Cua', price: 50000, description: 'Nước dùng ruốc sả thơm nức, gân bò mềm giòn' },
      { name: 'Bún Bò Giò Nạc Đặc Biệt', price: 65000, description: 'Khoanh giò nạc to bự cùng thịt bò tái mềm' },
      { name: 'Phở Bò Tái Nạm Gia Truyền', price: 55000, description: 'Bánh phở dẻo mềm cùng nước dùng thanh ngọt' }
    ]
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
    longitude: 106.6660,
    cuisineTypes: ['Cơm hộp', 'Cơm tấm', 'Cơm sườn', 'Cơm trưa', 'Đồ ăn'],
    serviceTypes: ['Cơm hộp văn phòng', 'Cơm tấm nướng than hoa'],
    specialtyDish: 'Cơm Tấm Sườn Cốt Lết Nướng & Bì Chả Trứng',
    menuItems: [
      { name: 'Cơm Tấm Sườn Nướng Mật Ong', price: 45000, description: 'Sườn cốt lết dày dặn ướp đậm đà mềm ngọt' },
      { name: 'Cơm Tấm Sườn Bì Chả Trứng Ốp La', price: 65000, description: 'Đầy đủ topping truyền thống cùng mỡ hành tóp mỡ giòn' },
      { name: 'Canh Khổ Qua Nhồi Thịt Nóng Hổi', price: 20000, description: 'Vị đắng thanh mát giải ngấy tuyệt hảo' }
    ]
  },
  {
    _id: 'store_xoichien',
    name: 'Xôi Chiên Giòn & Bánh Mì Sài Gòn',
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
    longitude: 106.6980,
    cuisineTypes: ['Đồ ăn', 'Cơm hộp', 'Ăn vặt', 'Xôi chiên', 'Bánh mì'],
    serviceTypes: ['Ăn xế chiều', 'Đồ ăn nhanh đường phố'],
    specialtyDish: 'Xôi Chiên Thịt Bằm Pát-tê & Bánh Mì Giòn',
    menuItems: [
      { name: 'Xôi Chiên Nhân Thịt Pát-tê (5 cái)', price: 35000, description: 'Vỏ xôi vàng ươm giòn rụm, nhân thịt mộc nhĩ đậm đà' },
      { name: 'Bánh Mì Thịt Nướng Sa Tế', price: 30000, description: 'Bánh mì nóng giòn rụm kẹp thịt nướng xiên thơm' },
      { name: 'Bánh Tráng Trộn Tép Mỡ Hành Phi', price: 25000, description: 'Đậm đà sốt me bò cùng trứng cút lòng đào' }
    ]
  },
  {
    _id: 'store_dfood',
    name: 'DFOOD - Chè Thái & Trà Sữa - Thủ Đức',
    image: 'https://images.unsplash.com/photo-1558857563-b37cf5288219?auto=format&fit=crop&w=400&q=80',
    district: 'TP. Thủ Đức',
    address: 'Số 2 Đường Đỗ Xuân Hợp, Phường Phú Hữu, Thành phố Thủ Đức, TP. Hồ Chí Minh',
    rating: 5.0,
    completed_orders: 540,
    locationsCount: 1,
    min_order_value: 20000,
    isVerified: true,
    promo: 'Giảm 10k',
    latitude: 10.7769,
    longitude: 106.7009,
    cuisineTypes: ['Đồ uống', 'Trà sữa', 'Chè', 'Tráng miệng', 'Cà phê'],
    serviceTypes: ['Trà sữa & chè giao tận nơi', 'Quán mới khai trương'],
    specialtyDish: 'Chè Thái Sầu Riêng Thơm Béo & Coca Ướp Lạnh',
    menuItems: [
      { name: 'Coca-Cola Tươi Mát Lạnh 500ml', price: 18000, description: 'Nước ngọt có gas ướp lạnh sảng khoái' },
      { name: 'Trà Sữa Trân Châu Đường Đen', price: 32000, description: 'Trà sữa đậm đà kèm trân châu nấu mềm dẻo' },
      { name: 'Chè Thái Thập Cẩm Sầu Riêng', price: 35000, description: 'Nước cốt dừa thơm béo, sầu riêng thật 100%' }
    ]
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
  return 'Giá từ 20k';
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

// Bản đồ từ khóa tiếng Việt phong phú để lọc danh mục chuẩn xác ngữ nghĩa
const CATEGORY_KEYWORDS_MAP = {
  'Đồ uống': [
    'trà sữa', 'cà phê', 'cafe', 'coffee', 'trà', 'nước', 'sinh tố',
    'juice', 'sữa chua', 'sữa', 'chè', 'đồ uống', 'boba', 'drink',
    'beverage', 'nước ép', 'macchiato', 'đá xay', 'thức uống', 'topping',
    'coca', 'pepsi', 'chè thái', 'dfood', 'sunday'
  ],
  'Đồ ăn': [
    'cơm', 'bún', 'phở', 'mì', 'gà rán', 'burger', 'xôi', 'sushi',
    'pizza', 'bánh mì', 'lẩu', 'nướng', 'bbq', 'bít tết', 'chay',
    'món ăn', 'cơm hộp', 'thịt', 'hải sản', 'gà', 'bò', 'heo', 'vịt', 'ăn vặt',
    'bánh canh', 'hủ tiếu', 'nem', 'chả'
  ],
  'Đồ chay': [
    'chay', 'thanh tịnh', 'bồ đề', 'rau củ', 'nấm', 'đậu hũ',
    'vegetarian', 'vegan', 'chay âu', 'chay việt', 'cơm chay', 'hủ tiếu chay', 'lẩu nấm'
  ],
  'Bánh kem': [
    'bánh kem', 'bánh sinh nhật', 'cake', 'bakery', 'cupcake',
    'bánh ngọt', 'tiramisu', 'mousse', 'bánh bông lan', 'bánh mỳ ngọt', 'sweet'
  ],
  'Tráng miệng': [
    'chè', 'kem', 'tráng miệng', 'dessert', 'flan', 'tàu hũ',
    'bingsu', 'sữa chua', 'pudding', 'sâm bổ lượng', 'thạch', 'khúc bạch'
  ],
  'Pizza/Burger': [
    'pizza', 'burger', 'mcdonald', 'hamburger', 'fastfood',
    'khoai tây', 'gà rán burger', 'fast food'
  ],
  'Món lẩu': [
    'lẩu', 'hotpot', 'nướng', 'bbq', 'tokbokki', 'lẩu thái',
    'lẩu bò', 'lẩu gà', 'k-pub', 'haidilao', 'korean'
  ],
  'Sushi': [
    'sushi', 'sashimi', 'nhật', 'japan', 'hokkaido', 'tokyo',
    'maki', 'nigiri', 'cá hồi', 'udon', 'tempura'
  ],
  'Mì phở': [
    'mì', 'phở', 'bún', 'hủ tiếu', 'miến', 'bánh canh', 'ramen',
    'noodle', 'bún bò', 'phở bò', 'bún chả', 'mì quảng', 'hủ tíu', 'bún riêu'
  ],
  'Cơm hộp': [
    'cơm', 'cơm tấm', 'cơm niêu', 'cơm gà', 'xôi', 'bento',
    'rice', 'cơm sườn', 'cơm văn phòng', 'cơm thố'
  ]
};

// Bản đồ đồng bộ 2 chiều giữa FoodFast Category Pills và FoodFast 20 Icons Grid
const FOODFAST_TO_TOP_CAT_MAP = {
  'All': 'all',
  'Đồ uống': 'milk_tea',
  'Đồ chay': 'veg',
  'Cơm hộp': 'rice',
  'Mì phở': 'bun_pho',
  'Pizza/Burger': 'burger',
  'Món lẩu': 'bbq',
  'Đồ ăn': 'all',
  'Sushi': 'all',
  'Bánh kem': 'all',
  'Tráng miệng': 'all'
};

const TOP_CAT_TO_FOODFAST_MAP = {
  'all': 'All',
  'milk_tea': 'Đồ uống',
  'veg': 'Đồ chay',
  'rice': 'Cơm hộp',
  'bun_pho': 'Mì phở',
  'burger': 'Pizza/Burger',
  'pizza': 'Pizza/Burger',
  'bbq': 'Món lẩu',
  'fastfood': 'Pizza/Burger',
  'fried_chicken': 'Đồ ăn',
  'sandwich': 'Đồ ăn'
};

// 20 Danh mục đặc trưng chuẩn FoodFast (Kèm Icon 3D trực quan)
const FOODFAST_TOP_CATEGORIES = [
  { id: 'all', name: 'Tất cả', icon: '/icons/nice-shop.png', keyword: '' },
  { id: 'deal', name: 'Hot Deal', icon: '/icons/flash-deals.png', keyword: 'giảm|deal|khuyến mãi' },
  { id: 'rice', name: 'Cơm Trưa', icon: '/icons/rice.png', keyword: 'cơm' },
  { id: 'bun_pho', name: 'Bún Mì Phở', icon: '/icons/bun-pho.png', keyword: 'bún|phở|mì|hủ tiếu' },
  { id: 'milk_tea', name: 'Trà Sữa', icon: '/icons/sweet-food.png', keyword: 'trà sữa|chè|nước ngọt|trà|cà phê|đồ uống' },
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

  // Phân trang danh sách quán ăn trên trang chủ
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 9; // 9 quán mỗi trang (3 hàng x 3 cột trên desktop)

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

  const fetchRestaurants = async (bypassCache = false, { silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
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
      } else if (!silent) {
        console.warn('Dữ liệu phản hồi không đúng chuẩn:', res.data);
        setError('Không thể lấy danh sách quán ăn từ máy chủ. Vui lòng thử lại.');
      }
    } catch (err) {
      if (!silent) {
        console.error('Lỗi tải danh sách quán:', err);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchRestaurants(true);
    setSelectedDistrict('ALL');

    const unsubscribe = subscribeRealtimeStream({
      service: 'restaurant',
      path: '/restaurants/stream',
      events: [
        'store.created', 'store.updated', 'store.approved', 'store.rejected',
        'store.banned', 'store.unbanned', 'store.deleted',
        'store.operations_updated', 'store.menu_updated', 'wallet.settled', 'review.created'
      ],
      broadcastChannels: ['restaurant', 'review', 'voucher'],
      fallbackIntervalMs: 8000,
      onPoll: () => fetchRestaurants(true, { silent: true })
    });
    return () => unsubscribe();
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

  // Helper kiểm tra xem quán ăn có phù hợp với danh mục FoodFast hay không (Quét từ khóa tiếng Việt thông minh)
  const matchCategory = (res, categoryId) => {
    if (!categoryId || categoryId === 'All') return true;
    const keywords = CATEGORY_KEYWORDS_MAP[categoryId];
    if (!keywords || keywords.length === 0) return true;

    // Tổng hợp toàn bộ thông tin nhận diện của quán ăn: tên, món đặc trưng, ẩm thực, mô tả, các món trong thực đơn
    const textPool = [
      res.name || '',
      res.specialtyDish || '',
      res.district || '',
      res.address || '',
      ...(res.cuisineTypes || []),
      ...(res.serviceTypes || []),
      ...(res.menuItems || []).map((m) => m.name || ''),
      ...(res.menuItems || []).map((m) => m.description || '')
    ]
      .join(' ')
      .toLowerCase();

    return keywords.some((kw) => textPool.includes(kw.toLowerCase()));
  };

  // Helper kiểm tra xem quán ăn có phù hợp với danh mục FoodFast (20 Icon) hay không
  const matchTopCategory = (res, topCatId) => {
    if (!topCatId || topCatId === 'all') return true;
    const topCat = FOODFAST_TOP_CATEGORIES.find((c) => c.id === topCatId);
    if (!topCat || !topCat.keyword) return true;

    const regex = new RegExp(topCat.keyword, 'i');
    const textPool = [
      res.name || '',
      res.specialtyDish || '',
      res.district || '',
      res.address || '',
      ...(res.cuisineTypes || []),
      ...(res.serviceTypes || []),
      ...(res.menuItems || []).map((m) => m.name || ''),
      ...(res.menuItems || []).map((m) => m.description || '')
    ].join(' ');

    return regex.test(textPool);
  };

  // Hàm xử lý khi người dùng click vào Tab Danh mục FoodFast ở Hero Banner
  const handleSelectFoodfastCategory = (catId) => {
    if (catId === 'All') {
      setSelectedCategory('All');
      setSelectedTopCatId('all');
    } else {
      setSelectedCategory(catId);
      const mappedTopCatId = FOODFAST_TO_TOP_CAT_MAP[catId];
      if (mappedTopCatId && mappedTopCatId !== 'all') {
        setSelectedTopCatId(mappedTopCatId);
      } else {
        setSelectedTopCatId('all');
      }
    }
    if (activeTab === 'favorites') setActiveTab('near');
  };

  // Hàm xử lý khi người dùng click vào Icon Danh mục FoodFast (20 Icon Grid)
  const handleSelectTopCategory = (catId) => {
    if (catId === 'all' || selectedTopCatId === catId) {
      setSelectedTopCatId('all');
      setSelectedCategory('All');
    } else {
      setSelectedTopCatId(catId);
      const mappedFoodfastId = TOP_CAT_TO_FOODFAST_MAP[catId];
      if (mappedFoodfastId) {
        setSelectedCategory(mappedFoodfastId);
      } else {
        setSelectedCategory('All');
      }
    }
    if (activeTab === 'favorites') setActiveTab('near');
  };

  // Lọc và sắp xếp quán ăn theo Tab (Gần tôi / Bán chạy / Đánh giá) và Quận/Huyện
  const displayedRestaurants = useMemo(() => {
    let list = storeList.filter((res) => {
      // 1. Tìm kiếm theo từ khóa (tên quán, địa chỉ, món đặc trưng, thực đơn)
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

      // 2. Lọc theo danh mục đã chọn (Đồng bộ thông minh, ưu tiên FoodFast Category nếu khác All)
      if (selectedCategory !== 'All') {
        if (!matchCategory(res, selectedCategory)) {
          return false;
        }
      } else if (selectedTopCatId !== 'all') {
        if (!matchTopCategory(res, selectedTopCatId)) {
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

  // Tự động chuyển về trang 1 khi thay đổi từ khóa, danh mục, quận huyện hoặc tab
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, selectedCategory, selectedTopCatId, selectedDistrict, activeTab]);

  // Phân trang danh sách quán ăn hiển thị
  const paginatedRestaurants = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return displayedRestaurants.slice(startIndex, startIndex + PAGE_SIZE);
  }, [displayedRestaurants, currentPage]);

  const totalPages = Math.ceil(displayedRestaurants.length / PAGE_SIZE) || 1;

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
                    onClick={() => handleSelectFoodfastCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-600/30 font-bold scale-105'
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
      {/* 1.5. DANH MỤC ĐẶC TRƯNG FOODFAST (20 Icon Grid) */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-ping" />
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              Khám Phá Món Ngon FoodFast
            </h2>
          </div>
          {selectedTopCatId !== 'all' && (
            <button
              onClick={() => {
                setSelectedTopCatId('all');
                setSelectedCategory('All');
              }}
              className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          )}
        </div>

        {/* 20 Icon danh mục FoodFast dạng grid 2 hàng lướt ngang mượt mà */}
        <div className="grid grid-rows-2 grid-flow-col auto-cols-[84px] sm:auto-cols-[98px] gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none">
          {FOODFAST_TOP_CATEGORIES.map((cat) => {
            const isSelected = selectedTopCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectTopCategory(cat.id)}
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
      <div id="foodfast-restaurants-section" className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4 scroll-mt-24">
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

      {/* 3.1. THANH TRẠNG THÁI BỘ LỌC ĐANG HOẠT ĐỘNG (Hiển thị tức thì khi chọn danh mục) */}
      {(selectedCategory !== 'All' || selectedTopCatId !== 'all' || selectedDistrict !== 'ALL' || searchKeyword.trim()) && (
        <div className="flex items-center justify-between gap-3 p-3 bg-orange-50/90 border border-orange-200 rounded-2xl text-xs shadow-xs animate-fadeIn mb-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-bold text-gray-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-600 fill-orange-600" />
              Đang lọc:
            </span>

            {selectedCategory !== 'All' && (
              <span className="px-2.5 py-1 rounded-xl bg-orange-600 text-white font-bold flex items-center gap-1 shadow-xs">
                <span>{selectedCategory}</span>
                <button
                  type="button"
                  onClick={() => handleSelectFoodfastCategory('All')}
                  className="hover:bg-orange-700 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] ml-0.5 cursor-pointer"
                  title="Bỏ lọc danh mục này"
                >
                  ×
                </button>
              </span>
            )}

            {selectedTopCatId !== 'all' && selectedCategory === 'All' && (
              <span className="px-2.5 py-1 rounded-xl bg-orange-600 text-white font-bold flex items-center gap-1 shadow-xs">
                <span>{FOODFAST_TOP_CATEGORIES.find((c) => c.id === selectedTopCatId)?.name}</span>
                <button
                  type="button"
                  onClick={() => handleSelectTopCategory('all')}
                  className="hover:bg-orange-700 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] ml-0.5 cursor-pointer"
                  title="Bỏ lọc danh mục FoodFast"
                >
                  ×
                </button>
              </span>
            )}

            {selectedDistrict !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-1 shadow-xs">
                <span>{selectedDistrict}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDistrict('ALL')}
                  className="hover:bg-blue-700 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] ml-0.5 cursor-pointer"
                  title="Bỏ lọc quận này"
                >
                  ×
                </button>
              </span>
            )}

            {searchKeyword.trim() && (
              <span className="px-2.5 py-1 rounded-xl bg-gray-800 text-white font-bold flex items-center gap-1 shadow-xs">
                <span>"{searchKeyword.trim()}"</span>
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="hover:bg-gray-700 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] ml-0.5 cursor-pointer"
                  title="Xóa từ khóa tìm kiếm"
                >
                  ×
                </button>
              </span>
            )}

            <span className="text-gray-500 font-semibold ml-1">
              ({displayedRestaurants.length} quán ăn phù hợp)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSelectedTopCatId('all');
              setSelectedDistrict('ALL');
              setSearchKeyword('');
            }}
            className="text-orange-600 hover:text-orange-700 font-bold underline shrink-0 cursor-pointer ml-auto text-xs"
          >
            Xóa tất cả lọc
          </button>
        </div>
      )}

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
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {paginatedRestaurants.map((res) => (
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

            {/* Thanh phân trang danh sách quán ăn */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={displayedRestaurants.length}
              pageSize={PAGE_SIZE}
              itemLabel="quán ăn"
              theme="light"
              className="mt-6"
              onPageChange={(page) => {
                setCurrentPage(page);
                const elem = document.getElementById('foodfast-restaurants-section');
                if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
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
      {/* Modal Popup Khuyến mãi Deal sốc đầu ứng dụng (FoodFast Flash Sale Popup) */}
      <PromotionPopupModal />
    </div>
  );
}
