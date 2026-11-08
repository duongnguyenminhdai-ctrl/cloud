import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  ChevronRight,
  ChevronDown,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RotateCcw,
  Star,
  Tag,
  Trash2,
  Plus,
  Minus,
  UtensilsCrossed,
  User,
  FileText,
  Coins,
  Check
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../api/client';

export default function OrdersPage({ initialTab }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { cartItems, currentRestaurant, updateQuantity, removeFromCart, clearCart, subtotal, totalItems } = useCart();

  // Tab hiện tại: 'active' (Đang đến) | 'deals' (Deal đã mua) | 'history' (Lịch sử) | 'reviews' (Đánh giá) | 'cart' (Đơn nháp/Giỏ hàng)
  const tabFromQuery = searchParams.get('tab') || initialTab || 'history';
  const [activeTab, setActiveTab] = useState(tabFromQuery);

  // Cập nhật URL khi đổi tab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  // Trạng thái tìm kiếm
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Bộ lọc của tab Lịch sử (Image 1 & 2)
  const [selectedService, setSelectedService] = useState('ALL'); // 'ALL' | 'FOOD' | 'MART'
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'CANCELLED'
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Khoảng ngày lọc (Mặc định 3 tháng gần nhất như trong ảnh: 10/08/26 - 08/11/26)
  const [dateRange, setDateRange] = useState({
    startDate: '10/08/26',
    endDate: '08/11/26',
    applied: false
  });

  // Calendar Picker State (Image 2)
  const [tempDateRange, setTempDateRange] = useState({
    startDay: 10,
    startMonth: 8,
    startYear: 2026,
    endDay: 8,
    endMonth: 11,
    endYear: 2026
  });

  // Đơn hàng từ Backend + LocalStorage
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Đánh giá sao và nhận xu
  const [reviewOrderModal, setReviewOrderModal] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewedSuccess, setReviewedSuccess] = useState(false);

  // Tải danh sách đơn hàng
  const fetchOrders = async () => {
    setLoadingOrders(true);
    let allOrders = [];

    // 1. Lấy từ LocalStorage trước
    try {
      const local = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (Array.isArray(local)) {
        allOrders = [...local];
      }
    } catch (e) {
      // ignore
    }

    // 2. Lấy từ Order Service qua API
    try {
      const res = await orderApi.getAll();
      if (res.data?.success && Array.isArray(res.data.data)) {
        // Gộp đơn từ API, tránh trùng lặp _id
        const apiOrders = res.data.data;
        const localIds = new Set(allOrders.map((o) => o._id));
        for (const ao of apiOrders) {
          if (!localIds.has(ao._id)) {
            allOrders.push(ao);
          }
        }
      }
    } catch (err) {
      console.warn('Không thể tải đơn hàng từ server:', err.message);
    }

    // Sắp xếp đơn mới nhất lên đầu
    allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setOrders(allOrders);
    setLoadingOrders(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Phân loại đơn: Đang đến (Active) vs Lịch sử (Completed / Cancelled)
  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === 'PENDING' ||
        o.status === 'CONFIRMED' ||
        o.status === 'FINDING_DRIVER' ||
        o.status === 'DRIVER_ASSIGNED' ||
        o.status === 'DELIVERING'
    );
  }, [orders]);

  const historyOrders = useMemo(() => {
    return orders.filter((o) => {
      // Lọc theo trạng thái
      if (selectedStatus === 'COMPLETED' && o.status !== 'DELIVERED') return false;
      if (selectedStatus === 'CANCELLED' && o.status !== 'CANCELLED') return false;

      // Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchStore = (o.restaurantName || '').toLowerCase().includes(q);
        const matchItems = o.items?.some((it) => (it.name || '').toLowerCase().includes(q));
        if (!matchStore && !matchItems) return false;
      }

      // Mặc định hiển thị các đơn đã giao thành công hoặc hủy
      const isPast = o.status === 'DELIVERED' || o.status === 'CANCELLED';
      return isPast;
    });
  }, [orders, selectedStatus, searchQuery]);

  // Đơn chờ đánh giá
  const reviewableOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'DELIVERED');
  }, [orders]);

  // Áp dụng bộ lọc lịch
  const handleApplyCalendar = () => {
    setDateRange({
      startDate: `${String(tempDateRange.startDay).padStart(2, '0')}/${String(tempDateRange.startMonth).padStart(2, '0')}/26`,
      endDate: `${String(tempDateRange.endDay).padStart(2, '0')}/${String(tempDateRange.endMonth).padStart(2, '0')}/26`,
      applied: true
    });
    setIsCalendarOpen(false);
  };

  // Xóa bộ lọc lịch
  const handleClearCalendar = () => {
    setDateRange({
      startDate: '10/08/26',
      endDate: '08/11/26',
      applied: false
    });
    setIsCalendarOpen(false);
  };

  // Đặt lại đơn hàng (Re-order)
  const handleReorder = (order) => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item) => {
        // Thêm vào giỏ
        updateQuantity(item._id || item.menuItemId || item.id, item.quantity || 1);
      });
      navigate('/checkout');
    }
  };

  // Gửi đánh giá quán để nhận 500 xu
  const handleSendReview = () => {
    setReviewedSuccess(true);
    setTimeout(() => {
      setReviewedSuccess(false);
      setReviewOrderModal(null);
    }, 1800);
  };

  // Danh sách các Tabs chuẩn ShopeeFood (Image 1)
  const TABS = [
    { id: 'active', label: 'Đang đến', count: activeOrders.length },
    { id: 'deals', label: 'Deal đã mua' },
    { id: 'history', label: 'Lịch sử' },
    { id: 'reviews', label: 'Đánh giá', count: reviewableOrders.length },
    { id: 'cart', label: 'Đơn nháp', count: totalItems }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      {/* Khung chính tối đa 640px để tạo chuẩn màn hình ứng dụng ShopeeFood */}
      <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm flex flex-col">
        
        {/* =================================================================== */}
        {/* 1. TOP HEADER CHUẨN SHOPEEFOOD (Image 1) */}
        {/* =================================================================== */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1 -ml-1 text-gray-700 hover:text-[#EE4D2D] rounded-full transition-colors"
              title="Quay lại"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              Đơn hàng
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearching(!isSearching)}
              className="p-2 text-gray-700 hover:text-[#EE4D2D] rounded-full transition-colors"
              title="Tìm kiếm đơn hàng"
            >
              <Search className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </header>

        {/* Thanh tìm kiếm khi nhấn vào icon Search */}
        {isSearching && (
          <div className="p-3 bg-gray-50 border-b border-gray-100 animate-fadeIn">
            <div className="relative flex items-center bg-white rounded-xl border border-gray-200 px-3 py-1.5 focus-within:border-[#EE4D2D] transition-colors">
              <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên quán ăn hoặc tên món..."
                className="w-full text-xs sm:text-sm text-gray-800 focus:outline-none bg-transparent"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 2. TABS BAR CHUẨN SHOPEEFOOD (Image 1) */}
        {/* =================================================================== */}
        <div className="border-b border-gray-100 bg-white sticky top-[53px] z-30">
          <div className="flex items-center justify-between px-4 overflow-x-auto no-scrollbar gap-5 text-xs sm:text-sm">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-3 relative font-bold whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'text-[#EE4D2D] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-[#EE4D2D]'
                      : 'text-gray-600 hover:text-gray-900 font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-[#EE4D2D] text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. BANNER NHẬN 500 XU (Shopee Coins Banner - Image 1) */}
        {/* =================================================================== */}
        <div className="px-4 pt-3 pb-1">
          <div
            onClick={() => handleTabChange('reviews')}
            className="bg-[#FFF9E6] border border-[#FFE8B3] rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#FFF3D1] transition-colors shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[11px] flex items-center justify-center border border-amber-500 shadow-xs">
                S
              </span>
              <span className="text-xs sm:text-sm font-semibold text-gray-800">
                Đánh giá quán, nhận ngay 500 xu
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. TAB NỘI DUNG CHÍNH: LỊCH SỬ (Image 1 & Image 2) */}
        {/* =================================================================== */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col">
            {/* Hàng 3 Bộ lọc: Dịch vụ ∨ | Trạng thái ∨ | 10/08/26 - 08/11/26 ∨ */}
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2 text-xs text-gray-700 bg-white relative">
              {/* Lọc Dịch vụ */}
              <div className="relative">
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="appearance-none bg-transparent hover:text-gray-900 pr-5 font-semibold cursor-pointer focus:outline-none"
                >
                  <option value="ALL">Dịch vụ ∨</option>
                  <option value="FOOD">Đồ ăn & Thức uống</option>
                  <option value="MART">ShopeeFood Mart</option>
                </select>
              </div>

              {/* Lọc Trạng thái */}
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="appearance-none bg-transparent hover:text-gray-900 pr-5 font-semibold cursor-pointer focus:outline-none"
                >
                  <option value="ALL">Trạng thái ∨</option>
                  <option value="COMPLETED">Đã hoàn tất</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              {/* Lọc Ngày tháng (Nhấn vào mở Calendar Picker - Image 2) */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className={`font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  isCalendarOpen || dateRange.applied ? 'text-[#EE4D2D]' : 'hover:text-gray-900'
                }`}
              >
                <span>
                  {dateRange.startDate} - {dateRange.endDate}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* =============================================================== */}
            {/* 4.1 BỘ CHỌN LỊCH THỜI GIAN (Calendar Picker - Image 2) */}
            {/* =============================================================== */}
            {isCalendarOpen && (
              <div className="bg-white border-b border-gray-200 p-4 space-y-5 animate-fadeIn shadow-inner">
                {/* Tháng Chín 2026 */}
                <div className="space-y-2">
                  <h4 className="text-center text-xs sm:text-sm font-semibold text-gray-700">
                    Tháng Chín 2026
                  </h4>
                  <div className="grid grid-cols-7 text-center text-[11px] text-gray-400 font-medium">
                    <span>CN</span>
                    <span>T2</span>
                    <span>T3</span>
                    <span>T4</span>
                    <span>T5</span>
                    <span>T6</span>
                    <span>T7</span>
                  </div>
                  <div className="grid grid-cols-7 text-center text-xs font-semibold gap-y-2">
                    <span className="text-gray-300"></span>
                    <span className="text-gray-300"></span>
                    {[...Array(30)].map((_, i) => {
                      const day = i + 1;
                      const isSelected = day >= 10;
                      return (
                        <button
                          key={day}
                          onClick={() => setTempDateRange((prev) => ({ ...prev, startDay: day, startMonth: 9 }))}
                          className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-red-50 text-[#EE4D2D] font-bold'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tháng Mười 2026 */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <h4 className="text-center text-xs sm:text-sm font-semibold text-gray-700">
                    Tháng Mười 2026
                  </h4>
                  <div className="grid grid-cols-7 text-center text-[11px] text-gray-400 font-medium">
                    <span>CN</span>
                    <span>T2</span>
                    <span>T3</span>
                    <span>T4</span>
                    <span>T5</span>
                    <span>T6</span>
                    <span>T7</span>
                  </div>
                  <div className="grid grid-cols-7 text-center text-xs font-semibold gap-y-2">
                    <span className="text-gray-300"></span>
                    <span className="text-gray-300"></span>
                    <span className="text-gray-300"></span>
                    <span className="text-gray-300"></span>
                    {[...Array(31)].map((_, i) => {
                      const day = i + 1;
                      const isSelected = day <= 31;
                      return (
                        <button
                          key={day}
                          onClick={() => setTempDateRange((prev) => ({ ...prev, endDay: day, endMonth: 10 }))}
                          className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-red-50 text-[#EE4D2D] font-bold'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hai nút hành động: Xóa & Chọn chuẩn Image 2 */}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={handleClearCalendar}
                    className="flex-1 py-2.5 rounded-xl border border-[#EE4D2D] text-[#EE4D2D] font-bold text-xs sm:text-sm hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Xóa
                  </button>
                  <button
                    onClick={handleApplyCalendar}
                    className="flex-1 py-2.5 rounded-xl bg-[#EE4D2D] hover:bg-[#d73f21] text-white font-bold text-xs sm:text-sm shadow-md shadow-red-500/20 transition-all cursor-pointer"
                  >
                    Chọn
                  </button>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* 4.2 DANH SÁCH ĐƠN HÀNG LỊCH SỬ HOẶC EMPTY STATE (Image 1) */}
            {/* =============================================================== */}
            {historyOrders.length === 0 ? (
              /* EMPTY STATE CHUẨN 100% SHOPEEFOOD (Image 1) */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 my-auto min-h-[360px]">
                {/* Illustration Sổ ghi chép màu cam kèm bút chì đỏ chuẩn ShopeeFood */}
                <div className="relative w-28 h-32 mx-auto drop-shadow-sm">
                  <svg viewBox="0 0 100 120" className="w-full h-full">
                    {/* Tai kẹp sổ phía trên */}
                    <path d="M35 12 C35 8, 65 8, 65 12 L65 18 L35 18 Z" fill="#F97316" />
                    {/* Bìa sổ màu cam viền đậm */}
                    <rect x="15" y="16" width="70" height="96" rx="8" fill="#FFFBF5" stroke="#F97316" strokeWidth="4" />
                    {/* 4 Dòng ghi chú có chấm tròn đỏ */}
                    <circle cx="28" cy="38" r="3" fill="#EF4444" />
                    <line x1="37" y1="38" x2="72" y2="38" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />
                    
                    <circle cx="28" cy="52" r="3" fill="#EF4444" />
                    <line x1="37" y1="52" x2="72" y2="52" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />

                    <circle cx="28" cy="66" r="3" fill="#EF4444" />
                    <line x1="37" y1="66" x2="72" y2="66" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />

                    <circle cx="28" cy="80" r="3" fill="#EF4444" />
                    <line x1="37" y1="80" x2="72" y2="80" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />

                    {/* Bút chì đỏ nghiêng vào sổ */}
                    <g transform="rotate(-38 72 65)">
                      <rect x="63" y="32" width="11" height="38" rx="2" fill="#EF4444" />
                      <polygon points="63,70 74,70 68.5,82" fill="#FDBA74" />
                      <polygon points="66,77 71,77 68.5,82" fill="#334155" />
                    </g>
                  </svg>
                </div>

                {/* Đoạn văn bản chuẩn từng chữ từ ảnh ShopeeFood (Image 1) */}
                <div className="space-y-2 max-w-sm">
                  <h3 className="text-sm sm:text-base font-bold text-gray-800 leading-snug">
                    Cùng ShopeeFood tạo thật nhiều kỷ niệm ăn uống tưng bừng bạn nhé!
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Bạn sẽ nhìn thấy các món đã đặt tại đây để có thể thưởng thức lại món yêu thích bất cứ lúc nào!
                  </p>
                </div>

                <Link
                  to="/"
                  className="mt-2 px-6 py-2.5 rounded-xl bg-[#EE4D2D] hover:bg-[#d73f21] text-white text-xs sm:text-sm font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
                >
                  Khám phá món ngon ngay
                </Link>
              </div>
            ) : (
              /* Danh sách các đơn hàng đã giao thành công */
              <div className="p-4 space-y-3 divide-y divide-gray-100">
                {historyOrders.map((ord) => (
                  <div key={ord._id} className="pt-3 first:pt-0 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900">
                        <span>{ord.restaurantName || 'Quán ăn ngon'}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đã giao thành công
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                        <img
                          src={ord.restaurantImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80'}
                          alt={ord.restaurantName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1 text-xs">
                        <p className="text-gray-500">
                          {new Date(ord.createdAt || Date.now()).toLocaleString('vi-VN')}
                        </p>
                        <p className="text-gray-700 line-clamp-1 font-medium">
                          {ord.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || '1x Món ăn ngon'}
                        </p>
                        <p className="font-extrabold text-sm text-gray-900">
                          {(ord.totalPrice || 0).toLocaleString('vi-VN')} đ
                        </p>
                      </div>
                    </div>

                    {/* Nút Đặt lại & Đánh giá */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setReviewOrderModal(ord)}
                        className="px-3.5 py-1.5 rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Đánh giá
                      </button>
                      <button
                        onClick={() => handleReorder(ord)}
                        className="px-4 py-1.5 rounded-lg bg-[#EE4D2D] hover:bg-[#d73f21] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        Đặt lại
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 5. TAB: GIỎ HÀNG / ĐƠN NHÁP (Yêu cầu "hiển thị giỏ hàng và các mục trên") */}
        {/* =================================================================== */}
        {activeTab === 'cart' && (
          <div className="flex-1 p-4 space-y-4">
            {cartItems.length === 0 ? (
              <div className="text-center py-16 space-y-4 my-auto">
                <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-gray-900">Chưa có món nào trong đơn nháp</p>
                  <p className="text-xs text-gray-500">
                    Hãy dạo quanh một vòng và chọn những món ăn khoái khẩu của bạn nhé!
                  </p>
                </div>
                <Link
                  to="/"
                  className="inline-block px-5 py-2.5 rounded-xl bg-[#EE4D2D] text-white text-xs font-bold shadow-md shadow-red-500/20"
                >
                  Khám phá món ngon
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Thông tin Quán đang chọn món */}
                {currentRestaurant && (
                  <div className="p-3 bg-orange-50/80 rounded-2xl border border-orange-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <UtensilsCrossed className="w-4 h-4 text-orange-600 shrink-0" />
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {currentRestaurant.name}
                      </span>
                    </div>
                    <button
                      onClick={clearCart}
                      className="text-xs text-red-600 hover:underline shrink-0 font-semibold"
                    >
                      Xóa giỏ
                    </button>
                  </div>
                )}

                {/* Danh sách các món trong giỏ */}
                <div className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.menuItemId || item._id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-[#EE4D2D] font-bold">
                            {(item.price || 0).toLocaleString('vi-VN')} đ
                          </p>
                        </div>
                      </div>

                      {/* Bộ đếm số lượng */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.menuItemId || item._id, item.quantity - 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-gray-900 w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId || item._id, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-orange-100 hover:bg-orange-200 flex items-center justify-center text-orange-700"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tổng tiền & Nút Đặt hàng */}
                <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Tạm tính ({totalItems} món):</span>
                    <span className="font-bold text-gray-900">{subtotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Phí giao hàng:</span>
                    <span className="font-semibold text-emerald-600">15.000 đ</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Tổng thanh toán:</span>
                    <span className="text-base sm:text-lg font-extrabold text-[#EE4D2D]">
                      {(subtotal + 15000).toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  <Link
                    to="/checkout"
                    className="w-full py-3 rounded-xl bg-[#EE4D2D] hover:bg-[#d73f21] text-white font-extrabold text-sm text-center block shadow-lg shadow-red-500/25 transition-all"
                  >
                    Tiến hành thanh toán
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 6. TAB: ĐANG ĐẾN (Đơn hàng đang xử lý & giao) */}
        {/* =================================================================== */}
        {activeTab === 'active' && (
          <div className="flex-1 p-4 space-y-3">
            {activeOrders.length === 0 ? (
              <div className="text-center py-16 space-y-3 my-auto">
                <Truck className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-sm font-bold text-gray-800">Không có đơn hàng nào đang đến</p>
                <p className="text-xs text-gray-500">Món ăn của bạn sẽ hiển thị tiến độ trực tiếp tại đây khi đặt hàng.</p>
                <Link
                  to="/"
                  className="inline-block px-5 py-2 rounded-xl bg-[#EE4D2D] text-white text-xs font-bold"
                >
                  Đặt món ngay
                </Link>
              </div>
            ) : (
              activeOrders.map((ord) => (
                <div
                  key={ord._id}
                  className="p-4 bg-white rounded-2xl border border-orange-200 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-600 flex items-center gap-1.5 animate-pulse">
                      <Truck className="w-4 h-4" /> Đang điều phối & giao hàng
                    </span>
                    <span className="text-xs font-bold text-gray-900">
                      {(ord.totalPrice || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-1">
                    {ord.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Món ăn'}
                  </p>
                  <Link
                    to={`/orders/${ord._id}`}
                    className="block w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold text-xs text-center rounded-xl transition-colors"
                  >
                    Xem tiến độ trực tiếp (Live Tracking) →
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 7. TAB: DEAL ĐÃ MUA */}
        {/* =================================================================== */}
        {activeTab === 'deals' && (
          <div className="flex-1 p-4 space-y-3">
            {[
              { code: 'FREESHIP50', name: 'Mã Giảm Phí Vận Chuyển 50.000đ', exp: 'Hết hạn: 30/11/2026' },
              { code: 'QUANNGON20', name: 'Giảm 20% Cho Quán Đối Tác', exp: 'Hết hạn: 31/12/2026' },
              { code: 'FOODFAST10', name: 'Giảm Ngay 10.000đ Mọi Đơn Hàng', exp: 'Hết hạn: 15/12/2026' }
            ].map((deal) => (
              <div key={deal.code} className="p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs font-bold text-[#EE4D2D]">
                    <Tag className="w-3.5 h-3.5" />
                    <span>{deal.code}</span>
                  </div>
                  <p className="text-xs font-bold text-gray-800">{deal.name}</p>
                  <p className="text-[10px] text-gray-400">{deal.exp}</p>
                </div>
                <Link
                  to="/"
                  className="px-3.5 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-bold"
                >
                  Dùng ngay
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* =================================================================== */}
        {/* 8. TAB: ĐÁNH GIÁ (Nhận 500 xu) */}
        {/* =================================================================== */}
        {activeTab === 'reviews' && (
          <div className="flex-1 p-4 space-y-3">
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-900 font-medium">
                Mỗi đánh giá 5 sao kèm nhận xét sẽ nhận ngay <strong>500 Xu ShopeeFood</strong> và nhận voucher tri ân giảm 10%!
              </p>
            </div>

            {reviewableOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs space-y-2">
                <Star className="w-8 h-8 text-gray-300 mx-auto" />
                <p>Bạn chưa có đơn hàng nào cần đánh giá.</p>
              </div>
            ) : (
              reviewableOrders.map((ord) => (
                <div key={ord._id} className="p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-900">{ord.restaurantName || 'Quán ăn'}</p>
                    <span className="text-[10px] text-gray-400">
                      {new Date(ord.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <button
                    onClick={() => setReviewOrderModal(ord)}
                    className="w-full py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                    <span>Viết đánh giá nhận 500 Xu</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* ===================================================================== */}
      {/* 9. BOTTOM NAVIGATION BAR CHUẨN SHOPEEFOOD (Image 1 & Image 2) */}
      {/* ===================================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around py-1.5 shadow-lg max-w-2xl mx-auto">
        <Link
          to="/"
          className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <UtensilsCrossed className="w-5 h-5 stroke-[2]" />
          <span className="text-[10px] font-semibold">Trang chủ</span>
        </Link>

        <Link
          to="/orders?tab=history"
          className="flex flex-col items-center gap-0.5 text-[#EE4D2D] font-bold transition-colors"
        >
          <div className="relative">
            <FileText className="w-5 h-5 stroke-[2.2]" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-[#EE4D2D] text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px]">Đơn hàng</span>
        </Link>

        <Link
          to={isAuthenticated ? (user?.role === 'ADMIN' ? '/admin' : '/merchant/status') : '/login'}
          className="flex flex-col items-center gap-0.5 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <User className="w-5 h-5 stroke-[2]" />
          <span className="text-[10px] font-semibold">Tôi</span>
        </Link>
      </div>

      {/* ===================================================================== */}
      {/* 10. MODAL ĐÁNH GIÁ QUÁN ĂN (Nhận 500 Xu) */}
      {/* ===================================================================== */}
      {reviewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-gray-900">
                Đánh giá đơn hàng
              </h3>
              <p className="text-xs text-gray-500">
                {reviewOrderModal.restaurantName || 'Quán ăn'}
              </p>
            </div>

            {reviewedSuccess ? (
              <div className="py-6 text-center space-y-2 text-emerald-600">
                <CheckCircle2 className="w-12 h-12 mx-auto animate-bounce" />
                <p className="font-extrabold text-sm">Đã nhận 500 Xu ShopeeFood!</p>
                <p className="text-xs text-gray-500">Cảm ơn bạn đã đóng góp đánh giá hữu ích.</p>
              </div>
            ) : (
              <>
                {/* 5 Sao chọn điểm */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRatingScore(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= ratingScore ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Món ăn ngon, giao nhanh, đóng gói cẩn thận..."
                  className="w-full h-20 p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-[#EE4D2D]"
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReviewOrderModal(null)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSendReview}
                    className="flex-1 py-2.5 rounded-xl bg-[#EE4D2D] hover:bg-[#d73f21] text-white text-xs font-bold shadow-md shadow-red-500/20"
                  >
                    Gửi đánh giá (+500 xu)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
