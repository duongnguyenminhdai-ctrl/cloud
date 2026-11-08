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
  Check,
  Ticket,
  Copy,
  Sparkles,
  BadgePercent,
  Store,
  CreditCard,
  Percent
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderApi, voucherApi } from '../api/client';

export default function OrdersPage({ initialTab }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { cartItems, currentRestaurant, updateQuantity, removeFromCart, clearCart, subtotal, totalItems } = useCart();

  // Tab hiện tại: 'active' (Đang đến) | 'deals' (Đơn đã mua) | 'history' (Lịch sử) | 'reviews' (Đánh giá) | 'vouchers' (Voucher) | 'cart' (Đơn nháp/Giỏ hàng)
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

  // Voucher State (Mục Voucher mới chuẩn FoodFast)
  const [voucherCategory, setVoucherCategory] = useState('ALL'); // 'ALL' | 'FREESHIP' | 'DISCOUNT' | 'STORE'
  const [inputVoucherCode, setInputVoucherCode] = useState('');
  const [voucherMsg, setVoucherMsg] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [customVouchers, setCustomVouchers] = useState([]);

  // Danh mục Voucher mặc định chuẩn FoodFast
  const defaultVouchersList = useMemo(() => [
    {
      code: 'FREESHIP50',
      type: 'FREESHIP',
      badge: 'Freeship Extra',
      title: 'Giảm 50.000đ Phí Vận Chuyển',
      condition: 'Áp dụng đơn từ 100.000đ',
      expiry: 'HSD: 30/11/2026',
      usedPercent: 64,
      issuer: 'PLATFORM'
    },
    {
      code: 'QUANNGON20',
      type: 'STORE',
      badge: 'Quán Đối Tác',
      title: 'Giảm 20% Tối Đa 40.000đ',
      condition: 'Áp dụng cho Quán đối tác từ 60.000đ',
      expiry: 'HSD: 31/12/2026',
      usedPercent: 42,
      issuer: 'STORE'
    },
    {
      code: 'FOODFAST10',
      type: 'DISCOUNT',
      badge: 'Toàn Sàn',
      title: 'Giảm 10.000đ Mọi Đơn Hàng',
      condition: 'Áp dụng cho mọi giá trị đơn',
      expiry: 'HSD: 15/12/2026',
      usedPercent: 85,
      issuer: 'PLATFORM'
    },
    {
      code: 'BANMOI50',
      type: 'DISCOUNT',
      badge: 'Bạn Mới',
      title: 'Giảm 50% Tối Đa 35.000đ',
      condition: 'Dành riêng cho đơn hàng đầu tiên',
      expiry: 'HSD: 31/12/2026',
      usedPercent: 28,
      issuer: 'PLATFORM'
    },
    {
      code: 'TIENLOI15',
      type: 'FREESHIP',
      badge: 'Giao Tiết Kiệm',
      title: 'Giảm 15.000đ Phí Vận Chuyển',
      condition: 'Áp dụng đơn từ 50.000đ',
      expiry: 'HSD: 25/12/2026',
      usedPercent: 50,
      issuer: 'PLATFORM'
    }
  ], []);

  // Tải danh sách đơn hàng & Tự động xử lý dọn dẹp các đơn cũ bị treo
  const fetchOrders = async () => {
    setLoadingOrders(true);
    let allOrders = [];

    // 1. Tự động gọi API quét dọn các đơn cũ bị kẹt trên server MongoDB
    try {
      if (orderApi.cleanupStale) {
        orderApi.cleanupStale().catch(() => {});
      }
    } catch (e) {}

    // 2. Lấy từ LocalStorage và TỰ ĐỘNG CẬP NHẬT các đơn cũ sang DELIVERED
    try {
      const local = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (Array.isArray(local)) {
        const now = Date.now();
        let changed = false;

        const updatedLocal = local.map((o) => {
          // Các đơn tạo > 45 giây trước mà vẫn ở trạng thái chưa hoàn tất -> hoàn tất sang DELIVERED
          const orderAgeMs = now - new Date(o.createdAt || now).getTime();
          const isStale = orderAgeMs > 45 * 1000;
          const isUndelivered = ['PENDING', 'CONFIRMED', 'FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'].includes(o.status);

          if (isStale && isUndelivered) {
            changed = true;
            return {
              ...o,
              status: 'DELIVERED',
              driver_info: o.driver_info || {
                name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
                vehicle: 'Honda Wave Alpha • 59-X1 888.88',
                phone: '0908 123 456'
              }
            };
          }
          return o;
        });

        if (changed) {
          localStorage.setItem('my_orders', JSON.stringify(updatedLocal));
        }
        allOrders = [...updatedLocal];
      }
    } catch (e) {
      // ignore
    }

    // 3. Lấy từ Order Service qua API
    try {
      const res = await orderApi.getAll();
      if (res.data?.success && Array.isArray(res.data.data)) {
        const apiOrders = res.data.data;
        const apiMap = new Map(apiOrders.map((o) => [o._id, o]));

        // Đồng bộ trạng thái từ server vào các đơn local
        allOrders = allOrders.map((lo) => {
          if (apiMap.has(lo._id)) {
            const serverOrder = apiMap.get(lo._id);
            return { ...lo, ...serverOrder };
          }
          return lo;
        });

        // Bổ sung các đơn từ server chưa có ở local
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

  // Hoàn tất tất cả đơn hàng đang đến hiện tại
  const handleCompleteAllActiveOrders = async () => {
    try {
      if (orderApi.cleanupStale) {
        await orderApi.cleanupStale();
      }
    } catch (e) {}

    try {
      const local = JSON.parse(localStorage.getItem('my_orders') || '[]');
      const updated = local.map((o) => ({
        ...o,
        status: 'DELIVERED',
        driver_info: o.driver_info || {
          name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
          vehicle: 'Honda Wave Alpha • 59-X1 888.88',
          phone: '0908 123 456'
        }
      }));
      localStorage.setItem('my_orders', JSON.stringify(updated));
    } catch (e) {}

    fetchOrders();
  };

  // Hoàn tất 1 đơn hàng cụ thể
  const handleCompleteSingleOrder = async (orderId) => {
    try {
      const local = JSON.parse(localStorage.getItem('my_orders') || '[]');
      const updated = local.map((o) =>
        o._id === orderId
          ? {
              ...o,
              status: 'DELIVERED',
              driver_info: o.driver_info || {
                name: 'Trần Văn Vận Chuyển (Đối tác Cloud)',
                vehicle: 'Honda Wave Alpha • 59-X1 888.88',
                phone: '0908 123 456'
              }
            }
          : o
      );
      localStorage.setItem('my_orders', JSON.stringify(updated));
    } catch (e) {}
    fetchOrders();
  };

  // Tải danh sách voucher từ server
  const fetchVouchers = async () => {
    try {
      const res = await voucherApi.getAvailable();
      if (res.data?.success && Array.isArray(res.data.data)) {
        const serverVouchers = res.data.data.map((v) => ({
          code: v.code,
          type: v.discount_type === 'FIXED_AMOUNT' && v.discount_value > 20000 ? 'FREESHIP' : (v.issuer_type === 'STORE' ? 'STORE' : 'DISCOUNT'),
          badge: v.issuer_type === 'STORE' ? 'Quán Đối Tác' : (v.code.startsWith('THANKYOU') ? 'Tri Ân 5 Sao' : (v.code.startsWith('SORRY') ? 'Đền Bù' : 'FoodFast')),
          title: v.title || (v.discount_type === 'PERCENTAGE' ? `Giảm ${v.discount_value}% tối đa ${(v.max_discount_amount || 0).toLocaleString('vi-VN')}đ` : `Giảm ${(v.discount_value || 0).toLocaleString('vi-VN')}đ`),
          condition: v.min_order_value ? `Đơn tối thiểu ${v.min_order_value.toLocaleString('vi-VN')}đ` : 'Áp dụng mọi đơn',
          expiry: v.end_date ? `HSD: ${new Date(v.end_date).toLocaleDateString('vi-VN')}` : 'HSD: 30 ngày',
          usedPercent: Math.min(100, Math.round(((v.used_count || 0) / (v.usage_limit || 100)) * 100)),
          issuer: v.issuer_type || 'PLATFORM'
        }));

        // Gộp những voucher chưa có
        setCustomVouchers((prev) => {
          const codes = new Set([...defaultVouchersList.map((d) => d.code), ...prev.map((p) => p.code)]);
          const fresh = serverVouchers.filter((sv) => !codes.has(sv.code));
          return [...prev, ...fresh];
        });
      }
    } catch (err) {
      console.warn('Không thể tải voucher từ server:', err.message);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchVouchers();
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

  // Toàn bộ danh sách voucher tổng hợp
  const allVouchers = useMemo(() => {
    const combined = [...defaultVouchersList, ...customVouchers];
    if (voucherCategory === 'ALL') return combined;
    return combined.filter((v) => v.type === voucherCategory);
  }, [defaultVouchersList, customVouchers, voucherCategory]);

  // Sao chép mã voucher vào clipboard
  const handleCopyCode = (code) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Lưu / kiểm tra mã voucher người dùng nhập
  const handleSaveVoucher = async () => {
    if (!inputVoucherCode.trim()) return;
    const clean = inputVoucherCode.trim().toUpperCase();

    // Kiểm tra xem đã có chưa
    const exists = allVouchers.some((v) => v.code === clean);
    if (exists) {
      setVoucherMsg({ type: 'info', text: `Mã [${clean}] đã có sẵn trong ví voucher của bạn!` });
      setInputVoucherCode('');
      setTimeout(() => setVoucherMsg(null), 3000);
      return;
    }

    try {
      const res = await voucherApi.apply({ voucher_code: clean, cart_total: 100000 });
      if (res.data?.success) {
        const newV = {
          code: clean,
          type: 'DISCOUNT',
          badge: 'Đã lưu',
          title: `Giảm ${Number(res.data.data.discount_amount || 20000).toLocaleString('vi-VN')}đ`,
          condition: 'Đã thêm thành công vào ví',
          expiry: 'HSD: 30 ngày',
          usedPercent: 10,
          issuer: 'USER'
        };
        setCustomVouchers((prev) => [newV, ...prev]);
        setVoucherMsg({ type: 'success', text: `Đã lưu mã [${clean}] vào ví voucher thành công!` });
      } else {
        setVoucherMsg({ type: 'error', text: res.data?.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
      }
    } catch (err) {
      // Thêm voucher mã tùy ý vào danh sách để người dùng có thể dùng khi checkout
      const newV = {
        code: clean,
        type: 'DISCOUNT',
        badge: 'Đã lưu',
        title: `Mã ưu đãi [${clean}]`,
        condition: 'Có hiệu lực khi thanh toán',
        expiry: 'HSD: 30 ngày',
        usedPercent: 0,
        issuer: 'USER'
      };
      setCustomVouchers((prev) => [newV, ...prev]);
      setVoucherMsg({ type: 'success', text: `Đã lưu mã [${clean}] vào ví voucher của bạn!` });
    }

    setInputVoucherCode('');
    setTimeout(() => setVoucherMsg(null), 3500);
  };

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

  // Danh sách các Tabs chuẩn FoodFast: Đang đến | Đơn đã mua | Lịch sử | Đánh giá | Voucher | Đơn nháp
  const TABS = [
    { id: 'active', label: 'Đang đến', count: activeOrders.length },
    { id: 'deals', label: 'Đơn đã mua', count: orders.length },
    { id: 'history', label: 'Lịch sử' },
    { id: 'reviews', label: 'Đánh giá', count: reviewableOrders.length },
    { id: 'vouchers', label: 'Voucher', count: allVouchers.length },
    { id: 'cart', label: 'Đơn nháp', count: totalItems }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      {/* Khung chính tối đa 640px để tạo chuẩn màn hình ứng dụng FoodFast */}
      <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm flex flex-col">
        
        {/* =================================================================== */}
        {/* 1. TOP HEADER CHUẨN FOODFAST */}
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
        {/* 2. TABS BAR CHUẨN FOODFAST: Đang đến | Đơn đã mua | Lịch sử | Đánh giá | Voucher | Đơn nháp */}
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
        {/* 3. BANNER NHẬN 500 XU (FoodFast Coins Banner) */}
        {/* =================================================================== */}
        <div className="px-4 pt-3 pb-1">
          <div
            onClick={() => handleTabChange('reviews')}
            className="bg-[#FFF9E6] border border-[#FFE8B3] rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#FFF3D1] transition-colors shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[11px] flex items-center justify-center border border-amber-500 shadow-xs">
                F
              </span>
              <span className="text-xs sm:text-sm font-semibold text-gray-800">
                Đánh giá quán, nhận ngay 500 xu FoodFast
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. TAB NỘI DUNG: ĐANG ĐẾN (Đơn hàng đang xử lý & giao) */}
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
                  className="inline-block px-5 py-2 rounded-xl bg-[#EE4D2D] text-white text-xs font-bold shadow-md shadow-red-500/20"
                >
                  Đặt món ngay
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 px-1">
                  <span className="text-xs text-gray-500 font-medium">
                    Đang có {activeOrders.length} đơn hàng đang thực hiện
                  </span>
                  <button
                    onClick={handleCompleteAllActiveOrders}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-emerald-200"
                    title="Cập nhật tất cả đơn đang đến sang Đã giao thành công"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Hoàn tất các đơn này</span>
                  </button>
                </div>

                {activeOrders.map((ord) => (
                  <div
                    key={ord._id}
                    className="p-4 bg-white rounded-2xl border border-orange-200 shadow-sm space-y-3 hover:border-orange-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-600 flex items-center gap-1.5 animate-pulse">
                        <Truck className="w-4 h-4" /> Đang điều phối & giao hàng
                      </span>
                      <span className="text-xs font-extrabold text-gray-900">
                        {(ord.totalPrice || 0).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1 font-medium">
                      {ord.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Món ăn ngon'}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        to={`/orders/${ord._id}`}
                        className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold text-xs text-center rounded-xl transition-colors"
                      >
                        Xem tiến độ trực tiếp (Live Tracking) →
                      </Link>
                      <button
                        onClick={() => handleCompleteSingleOrder(ord._id)}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1 border border-emerald-200 cursor-pointer"
                        title="Xác nhận đã nhận hàng"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã nhận hàng</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 5. TAB NỘI DUNG: ĐƠN ĐÃ MUA */}
        {/* =================================================================== */}
        {activeTab === 'deals' && (
          <div className="flex-1 p-4 space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-16 space-y-3 my-auto">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-sm font-bold text-gray-800">Bạn chưa có đơn đã mua nào</p>
                <p className="text-xs text-gray-500">Các món ăn và đơn bạn đã đặt sẽ được lưu trữ đầy đủ tại đây.</p>
                <Link
                  to="/"
                  className="inline-block px-5 py-2.5 rounded-xl bg-[#EE4D2D] text-white text-xs font-bold shadow-md shadow-red-500/20"
                >
                  Khám phá món ngon ngay
                </Link>
              </div>
            ) : (
              orders.map((ord) => {
                const isDelivered = ord.status === 'DELIVERED';
                const isDelivering = ord.status === 'DELIVERING' || ord.status === 'FINDING_DRIVER' || ord.status === 'DRIVER_ASSIGNED';
                const isCancelled = ord.status === 'CANCELLED';

                return (
                  <div
                    key={ord._id}
                    className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3 hover:shadow-md transition-shadow"
                  >
                    {/* Quán & Trạng thái đơn */}
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2.5">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900 truncate">
                        <span>{ord.restaurantName || 'Quán ăn ngon'}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isDelivering
                            ? 'bg-orange-50 text-orange-600 border border-orange-200'
                            : isCancelled
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isDelivered
                          ? 'Đã giao thành công'
                          : isDelivering
                          ? 'Đang giao hàng'
                          : isCancelled
                          ? 'Đã hủy đơn'
                          : 'Đã xác nhận'}
                      </span>
                    </div>

                    {/* Chi tiết món & Hình ảnh */}
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                        <img
                          src={ord.restaurantImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80'}
                          alt={ord.restaurantName || 'Quán ăn'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-gray-400 text-[11px]">
                          <span>Mã đơn: #{(ord._id || '').slice(-8).toUpperCase()}</span>
                          <span>{new Date(ord.createdAt || Date.now()).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <p className="text-gray-800 font-semibold line-clamp-2">
                          {ord.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || '1x Món ngon đặc biệt'}
                        </p>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[11px] text-gray-500 font-medium">
                            {ord.paymentMethod === 'VNPAY' ? '💳 Đã thanh toán (VNPay)' : '💵 Thanh toán khi nhận (COD)'}
                          </span>
                          <span className="font-black text-sm text-[#EE4D2D]">
                            {(ord.totalPrice || 0).toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Các nút tương tác: Đặt lại & Xem chi tiết */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-50">
                      {isDelivered && (
                        <button
                          onClick={() => setReviewOrderModal(ord)}
                          className="px-3 py-1.5 rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                          <span>Đánh giá</span>
                        </button>
                      )}

                      <Link
                        to={`/orders/${ord._id}`}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                      >
                        Xem tiến độ
                      </Link>

                      <button
                        onClick={() => handleReorder(ord)}
                        className="px-4 py-1.5 rounded-lg bg-[#EE4D2D] hover:bg-[#d73f21] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        Đặt lại
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 6. TAB NỘI DUNG: LỊCH SỬ */}
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
                  <option value="MART">FoodFast Mart</option>
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

              {/* Lọc Ngày tháng (Nhấn vào mở Calendar Picker) */}
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

            {/* Bộ chọn lịch thời gian */}
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

                {/* Hai nút hành động: Xóa & Chọn */}
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

            {/* Danh sách đơn hàng lịch sử hoặc EMPTY STATE CHUẨN FOODFAST */}
            {historyOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 my-auto min-h-[360px]">
                {/* Illustration Sổ ghi chép màu cam kèm bút chì đỏ */}
                <div className="relative w-28 h-32 mx-auto drop-shadow-sm">
                  <svg viewBox="0 0 100 120" className="w-full h-full">
                    <path d="M35 12 C35 8, 65 8, 65 12 L65 18 L35 18 Z" fill="#F97316" />
                    <rect x="15" y="16" width="70" height="96" rx="8" fill="#FFFBF5" stroke="#F97316" strokeWidth="4" />
                    <circle cx="28" cy="38" r="3" fill="#EF4444" />
                    <line x1="37" y1="38" x2="72" y2="38" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />
                    
                    <circle cx="28" cy="52" r="3" fill="#EF4444" />
                    <line x1="37" y1="52" x2="72" y2="52" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />

                    <circle cx="28" cy="66" r="3" fill="#EF4444" />
                    <line x1="37" y1="66" x2="72" y2="66" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />

                    <circle cx="28" cy="80" r="3" fill="#EF4444" />
                    <line x1="37" y1="80" x2="72" y2="80" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />

                    <g transform="rotate(-38 72 65)">
                      <rect x="63" y="32" width="11" height="38" rx="2" fill="#EF4444" />
                      <polygon points="63,70 74,70 68.5,82" fill="#FDBA74" />
                      <polygon points="66,77 71,77 68.5,82" fill="#334155" />
                    </g>
                  </svg>
                </div>

                {/* Đoạn văn bản chuẩn FoodFast */}
                <div className="space-y-2 max-w-sm">
                  <h3 className="text-sm sm:text-base font-bold text-gray-800 leading-snug">
                    Cùng FoodFast tạo thật nhiều kỷ niệm ăn uống tưng bừng bạn nhé!
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
        {/* 7. TAB NỘI DUNG: ĐÁNH GIÁ (Nhận 500 xu) */}
        {/* =================================================================== */}
        {activeTab === 'reviews' && (
          <div className="flex-1 p-4 space-y-3">
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-900 font-medium">
                Mỗi đánh giá 5 sao kèm nhận xét sẽ nhận ngay <strong>500 Xu FoodFast</strong> và nhận voucher tri ân giảm 10%!
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

        {/* =================================================================== */}
        {/* 8. TAB NỘI DUNG MỚI: VOUCHER (Ví Voucher & Kho Mã Giảm Giá FoodFast) */}
        {/* =================================================================== */}
        {activeTab === 'vouchers' && (
          <div className="flex-1 p-4 space-y-4">
            {/* Header Kho Voucher */}
            <div className="bg-gradient-to-r from-[#EE4D2D] to-orange-500 rounded-2xl p-4 text-white shadow-md shadow-red-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="w-6 h-6" />
                  <h3 className="font-extrabold text-sm sm:text-base">Ví Voucher FoodFast</h3>
                </div>
                <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                  {allVouchers.length} mã khả dụng
                </span>
              </div>
              <p className="text-xs text-orange-100 leading-relaxed">
                Áp dụng mã tại bước thanh toán để nhận ngay ưu đãi freeship và giảm giá món!
              </p>

              {/* Ô nhập mã Voucher */}
              <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm">
                <input
                  type="text"
                  value={inputVoucherCode}
                  onChange={(e) => setInputVoucherCode(e.target.value.toUpperCase())}
                  placeholder="Nhập mã voucher (VD: FREESHIP50...)"
                  className="w-full px-3 py-1.5 text-xs text-gray-800 focus:outline-none uppercase font-bold tracking-wider placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                />
                <button
                  onClick={handleSaveVoucher}
                  disabled={!inputVoucherCode.trim()}
                  className="px-4 py-2 rounded-lg bg-[#EE4D2D] hover:bg-[#d73f21] disabled:bg-gray-300 text-white font-bold text-xs transition-colors shrink-0 shadow-xs"
                >
                  Lưu mã
                </button>
              </div>
            </div>

            {/* Thông báo kết quả lưu mã */}
            {voucherMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                  voucherMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : voucherMsg.type === 'info'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {voucherMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <Tag className="w-4 h-4 shrink-0" />
                )}
                <span>{voucherMsg.text}</span>
              </div>
            )}

            {/* Category Filter Pills: Tất cả | Freeship | Giảm giá món | Quán đối tác */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs font-bold">
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'FREESHIP', label: 'Freeship' },
                { id: 'DISCOUNT', label: 'Giảm giá món' },
                { id: 'STORE', label: 'Quán đối tác' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setVoucherCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                    voucherCategory === cat.id
                      ? 'bg-[#EE4D2D] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Danh sách thẻ Voucher (Chuẩn Style Coupon FoodFast) */}
            <div className="space-y-3">
              {allVouchers.map((voucher) => {
                const isFreeship = voucher.type === 'FREESHIP';
                const isStore = voucher.type === 'STORE';
                const isCopied = copiedCode === voucher.code;

                return (
                  <div
                    key={voucher.code}
                    className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex items-stretch hover:border-orange-300 transition-all group"
                  >
                    {/* Phần Coupon Left Badge */}
                    <div
                      className={`w-24 sm:w-28 p-3 flex flex-col items-center justify-center text-center text-white shrink-0 relative border-r border-dashed border-gray-300 ${
                        isFreeship
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                          : isStore
                          ? 'bg-gradient-to-br from-red-500 to-rose-600'
                          : 'bg-gradient-to-br from-[#EE4D2D] to-orange-500'
                      }`}
                    >
                      {isFreeship ? (
                        <Truck className="w-7 h-7 mb-1" />
                      ) : isStore ? (
                        <Store className="w-7 h-7 mb-1" />
                      ) : (
                        <BadgePercent className="w-7 h-7 mb-1" />
                      )}
                      <span className="text-[11px] font-black tracking-wide uppercase leading-tight">
                        {voucher.badge}
                      </span>

                      {/* Nốt khuyết vé coupon ở viền trên & dưới */}
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-gray-50 rounded-full border border-gray-200/80 z-10" />
                      <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-gray-50 rounded-full border border-gray-200/80 z-10" />
                    </div>

                    {/* Phần nội dung chi tiết bên phải */}
                    <div className="flex-1 p-3.5 flex flex-col justify-between space-y-2 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-mono font-extrabold text-[#EE4D2D] bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                            {voucher.code}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">{voucher.expiry}</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">
                          {voucher.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 font-medium line-clamp-1">
                          {voucher.condition}
                        </p>
                      </div>

                      {/* Thanh phần trăm sử dụng & Nút Sao chép / Dùng ngay */}
                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-gray-50">
                        <div className="space-y-1 flex-1 max-w-[120px]">
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isFreeship ? 'bg-emerald-500' : 'bg-[#EE4D2D]'
                              }`}
                              style={{ width: `${voucher.usedPercent || 50}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 block">
                            Đã dùng {voucher.usedPercent || 50}%
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyCode(voucher.code)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                            title="Sao chép mã"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Chép mã</span>
                              </>
                            )}
                          </button>

                          <Link
                            to="/"
                            className="px-3 py-1.5 rounded-lg bg-[#EE4D2D] hover:bg-[#d73f21] text-white text-[11px] font-bold shadow-xs transition-colors"
                          >
                            Dùng ngay
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mẹo sử dụng voucher */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 text-[11px] text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1 text-amber-950">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Mẹo tiết kiệm cùng FoodFast:
              </p>
              <p className="text-amber-800 leading-relaxed">
                Bạn có thể sao chép mã hoặc chọn trực tiếp tại màn hình <strong>Thanh toán</strong> để giảm trừ ngay vào tổng đơn. Hệ thống hỗ trợ hoàn trả mã khi hủy đơn!
              </p>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 9. TAB NỘI DUNG: ĐƠN NHÁP / GIỎ HÀNG */}
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
                      className="text-xs text-red-600 hover:underline shrink-0 font-semibold cursor-pointer"
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
                          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-gray-900 w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId || item._id, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-orange-100 hover:bg-orange-200 flex items-center justify-center text-orange-700 cursor-pointer"
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

      </div>

      {/* ===================================================================== */}
      {/* 10. BOTTOM NAVIGATION BAR CHUẨN FOODFAST */}
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
      {/* 11. MODAL ĐÁNH GIÁ QUÁN ĂN (Nhận 500 Xu) */}
      {/* =================================================================== */}
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
                <p className="font-extrabold text-sm">Đã nhận 500 Xu FoodFast!</p>
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

