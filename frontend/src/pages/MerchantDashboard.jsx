import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Clock,
  MapPin,
  UtensilsCrossed,
  DollarSign,
  Layers,
  ChevronRight,
  TrendingUp,
  Settings2,
  Star,
  Check,
  X,
  FileText,
  Phone,
  Shield,
  KeyRound,
  Users,
  Calendar,
  Coffee,
  RotateCw,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Send,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Wallet,
  ArrowUpRight,
  ShoppingBag,
  SlidersHorizontal,
  CalendarDays,
  UserPlus,
  BadgeAlert,
  Bell,
  Unlock,
  Ticket,
  Percent,
  Calculator,
  Info,
  ShieldCheck,
  Gift,
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2
} from 'lucide-react';
import { storeApi, orderApi, reviewApi, uploadApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pagination, { paginateList } from '../components/Pagination';
import { compressReviewImage } from '../utils/imageHelpers';
import {
  calculateMerchantSettlement,
  simulateMerchantVoucher,
  MERCHANT_TYPE_LABELS
} from '../utils/merchantSettlement';
import {
  subscribeRealtimeStream,
  publishRealtimeSignal,
  playNotificationChime
} from '../utils/realtimeSync';

// Định dạng tiền tệ VNĐ
const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount || 0)) + ' đ';
};

export default function MerchantDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Dữ liệu cửa hàng
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Trung tâm thông báo từ Admin (Cảnh báo, Khóa quán, Mở cấm, Ví đối tác)
  const [notifications, setNotifications] = useState([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [liveNotifBanner, setLiveNotifBanner] = useState(null);
  const knownNotifIdsRef = useRef(null);
  const knownOrderIdsRef = useRef(null);
  const storeRef = useRef(null);
  const showCategoryModalRef = useRef(false);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('foodfast_merchant_read_notifs') || '[]');
    } catch {
      return [];
    }
  });

  const unreadNotifCount = useMemo(() => {
    return (notifications || []).filter((n) => {
      const nid = String(n.id || n._id || '');
      return !n.isRead && !readNotifIds.includes(nid);
    }).length;
  }, [notifications, readNotifIds]);

  const handleMarkAllNotifsAsRead = async () => {
    const allIds = (notifications || []).map((n) => String(n.id || n._id || '')).filter(Boolean);
    setReadNotifIds((prev) => Array.from(new Set([...prev, ...allIds])));
    setNotifications((prev) => (prev || []).map((n) => ({ ...n, isRead: true })));
    setLiveNotifBanner(null);
    try {
      localStorage.setItem('foodfast_merchant_read_notifs', JSON.stringify(allIds));
    } catch {}
    try {
      await storeApi.markNotificationsRead(allIds);
    } catch {}
  };

  // 5 Tabs chính: 'orders' | 'menu' | 'operations' | 'staff' | 'wallet'
  const [activeMainTab, setActiveMainTab] = useState('orders');

  // =========================================================================
  // 1. PHÂN HỆ ĐƠN HÀNG (LIVE ORDERS - Images 1, 2)
  // =========================================================================
  const [orders, setOrders] = useState([]);
  const [orderSubTab, setOrderSubTab] = useState('new'); // 'new' | 'preparing' | 'delivering' | 'history' | 'all'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyReason, setModifyReason] = useState('Món đã hết'); // 'Món đã hết' | 'Sai giá món'
  const [modifyingItems, setModifyingItems] = useState([]);

  // =========================================================================
  // 2. PHÂN HỆ THỰC ĐƠN & TOPPING (Images 3 - 9)
  // =========================================================================
  const [menuSubTab, setMenuSubTab] = useState('items'); // 'items' | 'topping_groups'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [menuSearch, setMenuSearch] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemModalTab, setItemModalTab] = useState('basic'); // 'basic' | 'customization' | 'hours' | 'toppings'

  // Modal Sắp xếp thứ tự danh mục (Image 5)
  const [showCategoryOrderModal, setShowCategoryOrderModal] = useState(false);
  const [editingCategories, setEditingCategories] = useState([]);

  // Modal Thêm / Sửa Nhóm Topping (Images 7, 8)
  const [showToppingGroupModal, setShowToppingGroupModal] = useState(false);
  const [editingToppingGroup, setEditingToppingGroup] = useState(null);
  const [toppingGroupForm, setToppingGroupForm] = useState({
    name: '',
    isRequired: false,
    minChoices: 0,
    maxChoices: 1,
    layout: 'VERTICAL',
    toppings: []
  });

  // Form Thêm / Sửa Món ăn
  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    description: '',
    image: '',
    categoryId: '',
    isAvailable: true,
    sellingHours: {
      isAllDay: true,
      customDays: [1, 2, 3, 4, 5, 6, 0],
      shifts: [{ start: '07:00', end: '22:00' }]
    },
    linkedToppingGroupIds: [],
    customization: {
      hasCustomization: false,
      optionGroups: [],
      allowNotes: true,
      notePlaceholder: 'Ví dụ: không hành, ít cay, để riêng nước chấm...'
    }
  });

  // Quản lý Chế độ tải ảnh món ăn: 'upload' (từ máy) | 'url' (nhập link)
  const [dishImageMode, setDishImageMode] = useState('upload');
  const [uploadingDishImage, setUploadingDishImage] = useState(false);
  const [dishImageError, setDishImageError] = useState(false);
  const dishFileInputRef = useRef(null);

  // =========================================================================
  // 3. PHÂN HỆ TRẠNG THÁI & LỊCH HOẠT ĐỘNG (Images 10 - 15)
  // =========================================================================
  const [showBusyModal, setShowBusyModal] = useState(false);
  const [busyDuration, setBusyDuration] = useState('30'); // '30' | '60' | 'today' | 'custom'
  const [showSpecialScheduleModal, setShowSpecialScheduleModal] = useState(false);
  const [specialScheduleForm, setSpecialScheduleForm] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'CLOSED',
    is24h: false,
    shifts: [{ open: '08:00', close: '22:00' }]
  });

  // =========================================================================
  // 4. PHÂN HỆ QUẢN LÝ NHÂN VIÊN (Images 16 - 17)
  // =========================================================================
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'STAFF', // 'MANAGER' | 'STAFF'
    scope: 'ALL' // 'ALL' | 'SPECIFIC'
  });

  // =========================================================================
  // 5. PHÂN HỆ TÀI CHÍNH & VÍ ĐỐI TÁC (Images 17 - 18)
  // =========================================================================
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState('amount'); // 'amount' | 'pin' | 'success'
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [lastPayoutRecord, setLastPayoutRecord] = useState(null);

  // Hiển thị toast thông báo
  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  // Đồng bộ danh sách thông báo & phát hiện thông báo mới realtime từ Admin
  const syncNotificationsList = (rawList) => {
    if (!Array.isArray(rawList)) return;
    const sorted = [...rawList]
      .map((n) => ({ ...n, id: String(n.id || n._id || '') }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (knownNotifIdsRef.current === null) {
      knownNotifIdsRef.current = new Set(sorted.map((n) => n.id).filter(Boolean));
    } else {
      const freshUnread = sorted.find(
        (n) => n.id && !knownNotifIdsRef.current.has(n.id) && !n.isRead
      );
      sorted.forEach((n) => {
        if (n.id) knownNotifIdsRef.current.add(n.id);
      });
      if (freshUnread) {
        setLiveNotifBanner(freshUnread);
        playNotificationChime();
      }
    }

    setNotifications(sorted);
  };

  // Tải danh sách thông báo trực tiếp từ API chuông
  const fetchNotifications = async () => {
    try {
      const res = await storeApi.getNotifications();
      if (res.data?.success && Array.isArray(res.data?.data)) {
        syncNotificationsList(res.data.data);
      }
    } catch {}
  };

  // Tải dữ liệu quán từ Backend (hỗ trợ chế độ silent để cập nhật realtime mượt không chớp màn hình)
  const fetchStoreData = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setErrorMsg('');
    }
    try {
      const res = await storeApi.getMyStore();
      if (res.data?.success) {
        const storeData = res.data.data;
        setStore(storeData);
        const currentUserId = user?.id || user?._id || user?.userId;
        if (currentUserId && storeData.status) {
          localStorage.setItem(`foodfast_store_status_${currentUserId}`, storeData.status);
        }
        if (Array.isArray(storeData.notifications)) {
          syncNotificationsList(storeData.notifications);
        }

        // Chỉ cập nhật editingCategories khi modal sắp xếp danh mục KHÔNG mở
        if (!showCategoryModalRef.current) {
          if (!storeData.categories || storeData.categories.length === 0) {
            const defaultCats = [
              { id: 'cat_main', name: 'Món chính', order: 1 },
              { id: 'cat_drink', name: 'Đồ uống & Trà sữa', order: 2 },
              { id: 'cat_snack', name: 'Đồ ăn vặt', order: 3 }
            ];
            setEditingCategories(defaultCats);
            storeData.categories = defaultCats;
            setStore({ ...storeData, categories: defaultCats });
            storeApi.updateCategories({ categories: defaultCats }).catch((catErr) => {
              console.warn('[MerchantDashboard] Auto-save default categories failed:', catErr.message);
            });
          } else {
            setEditingCategories(storeData.categories);
          }
        }
      }
    } catch (err) {
      if (!silent) {
        if (err.response?.status === 404) {
          navigate('/merchant/status');
        } else {
          setErrorMsg(err.response?.data?.message || err.message || 'Lỗi tải thông tin quán');
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Tải danh sách đánh giá thật của quán & tự động đồng bộ lại số sao
  const [storeReviews, setStoreReviews] = useState([]);

  const fetchReviews = async () => {
    const targetId = storeRef.current?._id || store?._id;
    if (!targetId) return;
    try {
      const res = await reviewApi.getByStore(targetId);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setStoreReviews(res.data.data);
      }
    } catch {
      // Giữ danh sách hiện tại
    }
  };

  const fetchOrders = async (overrideStoreId = null) => {
    const activeStore = storeRef.current || store;
    const targetStoreId = overrideStoreId || activeStore?._id;
    if (!targetStoreId) return;
    try {
      const res = await orderApi.getAll({ restaurantId: targetStoreId });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        const realOrders = res.data.data;

        if (knownOrderIdsRef.current === null) {
          knownOrderIdsRef.current = new Set(realOrders.map((o) => String(o._id)));
        } else {
          const newlyArrived = realOrders.find(
            (o) => o._id && !knownOrderIdsRef.current.has(String(o._id)) && ['PENDING', 'NEW', 'CONFIRMED'].includes(o.status)
          );
          realOrders.forEach((o) => {
            if (o._id) knownOrderIdsRef.current.add(String(o._id));
          });
          if (newlyArrived) {
            showToast(`Có đơn hàng mới #${String(newlyArrived._id).slice(-6).toUpperCase()} vừa đặt!`);
            playNotificationChime();
          }
        }

        setOrders(realOrders);

        const completedOrders = realOrders.filter((o) => ['COMPLETED', 'DELIVERED'].includes(o.status));
        const pendingOrders = realOrders.filter((o) =>
          ['PENDING', 'NEW', 'CONFIRMED', 'PREPARING', 'FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'].includes(o.status)
        );

        const settledOrderIds = new Set(
          (activeStore?.walletTransactions || [])
            .filter((t) => t.type === 'ORDER_SETTLEMENT' && t.orderId)
            .map((t) => String(t.orderId))
        );
        const hasUnsettledOrder = completedOrders.some((o) => !settledOrderIds.has(String(o._id)));
        const hasLegacyFakeDefaults =
          !(activeStore?.walletTransactions?.length) &&
          !(activeStore?.payouts?.length) &&
          (activeStore?.wallet?.availableBalance === 1368922 || activeStore?.completed_orders === 25);

        if (hasUnsettledOrder || hasLegacyFakeDefaults) {
          try {
            const syncRes = await storeApi.syncSettlements({
              completedOrders,
              pendingOrders
            });
            if (syncRes.data?.success && syncRes.data?.data) {
              setStore(syncRes.data.data);
            }
          } catch {}
        }
      }
    } catch {
      // Giữ orders hiện tại
    }
  };

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    showCategoryModalRef.current = showCategoryOrderModal;
  }, [showCategoryOrderModal]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/merchant/dashboard');
      return;
    }
    if (user?.role === 'ADMIN') {
      navigate('/admin');
      return;
    }
    fetchStoreData();
  }, [isAuthenticated, user?.role]);

  // Kênh Realtime 1: Thông báo chuông Admin, Khóa/Mở quán, Ví đối tác, Voucher, Đánh giá, Thực đơn
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribeStoreStream = subscribeRealtimeStream({
      service: 'restaurant',
      path: '/stores/my-store/stream',
      events: [
        'notification.created', 'store.banned', 'store.unbanned', 'store.approved',
        'store.rejected', 'wallet.granted', 'wallet.withdrawn', 'wallet.settled',
        'store.updated', 'store.operations_updated', 'store.menu_updated',
        'voucher.updated', 'review.created', 'order.updated', 'notifications.read'
      ],
      broadcastChannels: ['restaurant', 'admin', 'voucher', 'review', 'order'],
      fallbackIntervalMs: 4000,
      onEvent: (evtName) => {
        if (evtName === 'order.updated' && storeRef.current?._id) {
          fetchOrders(storeRef.current._id);
        }
      },
      onPoll: async () => {
        await Promise.all([
          fetchStoreData({ silent: true }),
          fetchNotifications(),
          storeRef.current?._id ? fetchReviews() : Promise.resolve(),
          storeRef.current?._id ? fetchMerchantVouchers({ silent: true }) : Promise.resolve()
        ]);
      }
    });
    return () => unsubscribeStoreStream();
  }, [isAuthenticated]);

  // Kênh Realtime 2: Đơn hàng Live Orders từ Order Service SSE Stream
  useEffect(() => {
    if (!store?._id) return;
    fetchOrders(store._id);
    fetchReviews();

    const unsubscribeOrderStream = subscribeRealtimeStream({
      service: 'order',
      path: '/orders/stream',
      params: { restaurantId: store._id },
      events: ['order.created', 'order.updated'],
      broadcastChannels: ['order'],
      fallbackIntervalMs: 4000,
      onPoll: async () => {
        await fetchOrders(store._id);
      }
    });

    return () => unsubscribeOrderStream();
  }, [store?._id]);

  // Tính toán 100% SỐ LIỆU THẬT ("Tiền tươi thóc thật" - Tuyệt đối không dùng số ảo)
  const realMetrics = useMemo(() => {
    const allOrders = Array.isArray(orders) ? orders : [];
    const completedList = allOrders.filter((o) => ['COMPLETED', 'DELIVERED'].includes(o.status));
    const activePendingList = allOrders.filter((o) =>
      ['PENDING', 'NEW', 'CONFIRMED', 'PREPARING', 'FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'].includes(o.status)
    );

    const todayStr = new Date().toLocaleDateString('vi-VN');
    const todayRevenue = completedList
      .filter((o) => new Date(o.createdAt || o.updatedAt).toLocaleDateString('vi-VN') === todayStr)
      .reduce((sum, ord) => sum + calculateMerchantSettlement(ord, store).netMerchant, 0);

    const activePendingRevenue = activePendingList.reduce(
      (sum, ord) => sum + calculateMerchantSettlement(ord, store).netMerchant,
      0
    );

    const revCount = storeReviews.length;
    const avgRating =
      revCount > 0
        ? Number((storeReviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / revCount).toFixed(1))
        : 0;

    const hasTxHistory = (store?.walletTransactions?.length || 0) > 0 || (store?.payouts?.length || 0) > 0;
    const rawAvail = Number(store?.wallet?.availableBalance || 0);
    const availableBalance =
      !hasTxHistory && rawAvail === 1368922 && completedList.length === 0 ? 0 : rawAvail;

    const rawPending = Number(store?.wallet?.pendingBalance || 0);
    const pendingBalance =
      activePendingRevenue > 0
        ? activePendingRevenue
        : !hasTxHistory && rawPending === 327850
        ? 0
        : rawPending;

    return {
      todayRevenue,
      completedOrdersCount: completedList.length,
      reviewCount: revCount,
      avgRating,
      availableBalance,
      pendingBalance
    };
  }, [orders, storeReviews, store]);

  // Tổng hợp Lịch sử giao dịch & Quyết toán thật từ Sổ cái ví (walletTransactions + payouts)
  const realTransactions = useMemo(() => {
    const txs = Array.isArray(store?.walletTransactions) ? [...store.walletTransactions] : [];
    const existingCodes = new Set(txs.map((t) => t.code));
    const payouts = Array.isArray(store?.payouts) ? store.payouts : [];

    payouts.forEach((p) => {
      if (!existingCodes.has(p.code)) {
        txs.push({
          id: p.id || p.code,
          code: p.code,
          type: 'WITHDRAWAL',
          amount: -Math.abs(Number(p.amount) || 0),
          desc: `Rút tiền thủ công về ${p.bankInfo?.bankName || 'Ngân hàng'} (${p.bankInfo?.accountNumber || 'N/A'})`,
          status: p.status || 'PENDING',
          createdAt: p.requestedAt || p.createdAt || new Date()
        });
      }
    });

    return txs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [store?.walletTransactions, store?.payouts]);

  // =========================================================================
  // XỬ LÝ PHÂN HỆ ĐƠN HÀNG
  // =========================================================================
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    if (orderSubTab === 'all') return orders;
    if (orderSubTab === 'new') return orders.filter((o) => ['PENDING', 'NEW'].includes(o.status));
    if (orderSubTab === 'preparing') return orders.filter((o) => ['CONFIRMED', 'PREPARING'].includes(o.status));
    if (orderSubTab === 'delivering') return orders.filter((o) => ['FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'].includes(o.status));
    if (orderSubTab === 'history') return orders.filter((o) => ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.status));
    return orders;
  }, [orders, orderSubTab]);

  // Phân trang đơn hàng quán (Live Orders)
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 6;

  useEffect(() => {
    setOrderPage(1);
  }, [orderSubTab]);

  const paginatedOrdersState = useMemo(
    () => paginateList(filteredOrders, orderPage, ORDER_PAGE_SIZE),
    [filteredOrders, orderPage]
  );
  const paginatedOrders = paginatedOrdersState.items;

  // Phân trang thực đơn món ăn (Menu Items)
  const [menuPage, setMenuPage] = useState(1);
  const MENU_PAGE_SIZE = 9;

  useEffect(() => {
    setMenuPage(1);
  }, [selectedCategory, menuSearch]);

  // Nguồn dữ liệu danh mục đồng bộ duy nhất: kết hợp store.categories, editingCategories, menuItems và danh mục mặc định
  const availableCategories = useMemo(() => {
    const catsMap = new Map();
    const defaultCats = [
      { id: 'cat_main', name: 'Món chính', order: 1 },
      { id: 'cat_drink', name: 'Đồ uống & Trà sữa', order: 2 },
      { id: 'cat_snack', name: 'Đồ ăn vặt', order: 3 }
    ];

    // 1. Ưu tiên store.categories hoặc editingCategories
    const initialList = (store?.categories && store.categories.length > 0)
      ? store.categories
      : (editingCategories && editingCategories.length > 0)
        ? editingCategories
        : defaultCats;

    initialList.forEach((c) => {
      const catId = c.id || c._id || c.name;
      if (catId && !catsMap.has(catId)) {
        catsMap.set(catId, {
          id: catId,
          name: c.name || catId,
          order: c.order !== undefined ? c.order : catsMap.size + 1
        });
      }
    });

    // 2. Tự động đồng bộ các categoryId/category đang có trên menuItems của quán
    (store?.menuItems || []).forEach((item) => {
      const itemCatId = item.categoryId || item.category;
      if (itemCatId && !catsMap.has(itemCatId)) {
        let fallbackName = itemCatId;
        if (itemCatId === 'cat_main') fallbackName = 'Món chính';
        else if (itemCatId === 'cat_drink') fallbackName = 'Đồ uống & Trà sữa';
        else if (itemCatId === 'cat_snack') fallbackName = 'Đồ ăn vặt';

        catsMap.set(itemCatId, {
          id: itemCatId,
          name: fallbackName,
          order: catsMap.size + 1
        });
      }
    });

    // 3. Đảm bảo 3 danh mục mặc định luôn có mặt
    defaultCats.forEach((dc) => {
      if (!catsMap.has(dc.id)) {
        catsMap.set(dc.id, { ...dc, order: dc.order || catsMap.size + 1 });
      }
    });

    return Array.from(catsMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [store?.categories, store?.menuItems, editingCategories]);

  const filteredMenuItems = useMemo(() => {
    return (store?.menuItems || []).filter((m) => {
      if (selectedCategory === 'ALL') return true;
      const cat = m.categoryId || m.category;
      if (!cat && (selectedCategory === 'cat_main' || selectedCategory === 'Món chính')) return true;
      return cat === selectedCategory;
    });
  }, [store?.menuItems, selectedCategory]);

  const paginatedMenuState = useMemo(
    () => paginateList(filteredMenuItems, menuPage, MENU_PAGE_SIZE),
    [filteredMenuItems, menuPage]
  );
  const paginatedMenuItems = paginatedMenuState.items;

  // Phân trang cho các danh sách còn lại: Topping, Lịch đặc biệt, Nhân viên, Voucher Quán, Lịch sử giao dịch, Thông báo
  const [toppingGroupPage, setToppingGroupPage] = useState(1);
  const TOPPING_PAGE_SIZE = 4;
  const paginatedToppingGroups = useMemo(
    () => paginateList(store?.toppingGroups || [], toppingGroupPage, TOPPING_PAGE_SIZE),
    [store?.toppingGroups, toppingGroupPage]
  );

  const [specialSchedulePage, setSpecialSchedulePage] = useState(1);
  const SCHEDULE_PAGE_SIZE = 5;
  const paginatedSpecialSchedules = useMemo(
    () => paginateList(store?.specialSchedules || [], specialSchedulePage, SCHEDULE_PAGE_SIZE),
    [store?.specialSchedules, specialSchedulePage]
  );

  const [staffPage, setStaffPage] = useState(1);
  const STAFF_PAGE_SIZE = 6;
  const paginatedStaff = useMemo(
    () => paginateList(store?.staff || [], staffPage, STAFF_PAGE_SIZE),
    [store?.staff, staffPage]
  );

  const [merchantVoucherPage, setMerchantVoucherPage] = useState(1);
  const MERCHANT_VOUCHER_PAGE_SIZE = 4;

  const [txPage, setTxPage] = useState(1);
  const [txLimit, setTxLimit] = useState(6);
  const paginatedTransactions = useMemo(
    () => paginateList(realTransactions, txPage, txLimit),
    [realTransactions, txPage, txLimit]
  );

  const [notifPage, setNotifPage] = useState(1);
  const NOTIF_PAGE_SIZE = 5;
  const paginatedNotifications = useMemo(
    () => paginateList(notifications, notifPage, NOTIF_PAGE_SIZE),
    [notifications, notifPage]
  );

  // Xác nhận đơn hàng mới -> chuyển sang PREPARING
  const handleConfirmOrder = async (orderId) => {
    try {
      await orderApi.updateStatus(orderId, { status: 'PREPARING' });
      showToast('Đã xác nhận đơn hàng thành công! Quán tiến hành làm món.');
      fetchOrders();
      publishRealtimeSignal('order', { type: 'order.updated', orderId, status: 'PREPARING' });
    } catch (err) {
      alert('Lỗi xác nhận đơn: ' + (err.response?.data?.message || err.message));
    }
  };

  // Báo đã nấu xong món -> chuyển sang READY
  const handleReadyOrder = async (orderId) => {
    try {
      await orderApi.updateStatus(orderId, { status: 'READY' });
      showToast('Đã báo hoàn tất làm món! Đang chờ tài xế đến nhận.');
      fetchOrders();
      publishRealtimeSignal('order', { type: 'order.updated', orderId, status: 'READY' });
    } catch (err) {
      alert('Lỗi cập nhật: ' + (err.response?.data?.message || err.message));
    }
  };

  // Mở modal Chỉnh sửa đơn do Hết món / Sai giá (Image 2)
  const handleOpenModifyModal = (order) => {
    setSelectedOrder(order);
    setModifyingItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
    setModifyReason('Món đã hết');
    setShowModifyModal(true);
  };

  // Xóa một món hết khỏi đơn hàng
  const handleRemoveModifyingItem = (idx) => {
    const updated = modifyingItems.filter((_, i) => i !== idx);
    setModifyingItems(updated);
  };

  // Xác nhận chỉnh sửa đơn hàng
  const handleConfirmModifyOrder = async () => {
    if (!selectedOrder) return;
    try {
      await orderApi.modifyItems(selectedOrder._id, {
        items: modifyingItems,
        reason: modifyReason,
        note: `Chủ quán sửa đơn do: ${modifyReason}`
      });
      showToast('Chỉnh sửa đơn hàng thành công! Hệ thống đã gửi thông báo đến khách.');
      setShowModifyModal(false);
      setSelectedOrder(null);
      fetchOrders();
      publishRealtimeSignal('order', { type: 'order.modified', orderId: selectedOrder._id });
    } catch (err) {
      alert('Không thể chỉnh sửa đơn: ' + (err.response?.data?.message || err.message));
    }
  };

  // =========================================================================
  // XỬ LÝ PHÂN HỆ THỰC ĐƠN & TOPPING
  // =========================================================================

  // Bật / Tắt nhanh 1 chạm Còn món / Hết món (Image 3, 4)
  const handleToggleItemAvailability = async (itemId) => {
    try {
      const res = await storeApi.toggleItemAvailability(itemId);
      if (res.data?.success) {
        showToast(res.data.message);
        // Cập nhật state nội bộ
        setStore((prev) => {
          if (!prev) return prev;
          const updated = prev.menuItems.map((m) =>
            m._id === itemId ? { ...m, isAvailable: res.data.isAvailable } : m
          );
          return { ...prev, menuItems: updated };
        });
        publishRealtimeSignal('restaurant', { type: 'store.menu_updated', storeId: store?._id });
      }
    } catch (err) {
      alert('Lỗi chuyển trạng thái: ' + (err.response?.data?.message || err.message));
    }
  };

  // Lưu thứ tự danh mục món ăn (Image 5)
  const handleSaveCategoryOrder = async () => {
    try {
      await storeApi.updateCategories({ categories: editingCategories });
      showToast('Đã lưu thứ tự danh mục thành công!');
      setShowCategoryOrderModal(false);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.menu_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi lưu thứ tự: ' + (err.response?.data?.message || err.message));
    }
  };

  // Di chuyển danh mục lên/xuống
  const handleMoveCategory = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= editingCategories.length) return;
    const updated = [...editingCategories];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    // Cập nhật lại trường order
    updated.forEach((c, idx) => {
      c.order = idx + 1;
    });
    setEditingCategories(updated);
  };

  // Thêm mới danh mục
  const handleAddCategory = () => {
    const catName = prompt('Nhập tên danh mục món mới (VD: Cơm trưa, Trà sữa, Khai vị):');
    if (!catName || !catName.trim()) return;
    const newCat = {
      id: `cat_${Date.now()}`,
      name: catName.trim(),
      order: editingCategories.length + 1
    };
    setEditingCategories([...editingCategories, newCat]);
  };

  // Thêm nhanh danh mục ngay trong Modal Món ăn
  const handleQuickAddCategory = async () => {
    const catName = prompt('Nhập tên danh mục món mới (VD: Cơm trưa, Trà sữa, Khai vị):');
    if (!catName || !catName.trim()) return;
    const trimmed = catName.trim();
    const newCatId = `cat_${Date.now()}`;
    const newCat = {
      id: newCatId,
      name: trimmed,
      order: (availableCategories?.length || 0) + 1
    };

    const nextCats = [...availableCategories, newCat];
    setEditingCategories(nextCats);
    if (store) {
      setStore({ ...store, categories: nextCats });
    }
    setItemForm((prev) => ({ ...prev, categoryId: newCatId }));

    try {
      await storeApi.updateCategories({ categories: nextCats });
      showToast(`Đã thêm danh mục "${trimmed}" thành công!`);
    } catch (err) {
      console.warn('Lỗi tự động lưu danh mục mới:', err);
    }
  };

  // Xử lý upload ảnh món ăn lên Cloudinary CDN
  const handleDishFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WebP)!');
      return;
    }

    try {
      setUploadingDishImage(true);
      setDishImageError(false);

      // 1. Nén ảnh nhanh phía client qua canvas
      const compressed = await compressReviewImage(file);
      // Hiển thị preview lạc quan ngay lập tức
      setItemForm((prev) => ({ ...prev, image: compressed }));

      // 2. Upload lên Cloudinary CDN
      const res = await uploadApi.uploadImage(compressed, 'foodfast/dishes');
      const cdnUrl = res.data?.data?.url || res.data?.url || res.data?.data?.secure_url;
      if (cdnUrl) {
        setItemForm((prev) => ({ ...prev, image: cdnUrl }));
        showToast('Đã tải ảnh món lên Cloudinary CDN thành công!');
      }
    } catch (err) {
      console.error('Lỗi upload ảnh món:', err);
      alert('Không thể tải ảnh lên: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingDishImage(false);
      if (dishFileInputRef.current) dishFileInputRef.current.value = '';
    }
  };

  // Mở modal Thêm món mới (Image 3)
  const handleOpenAddItemModal = () => {
    setEditingItem(null);
    setItemModalTab('basic');
    setDishImageMode('upload');
    setUploadingDishImage(false);
    setDishImageError(false);
    if (dishFileInputRef.current) dishFileInputRef.current.value = '';

    const initialCatId = (selectedCategory !== 'ALL' ? selectedCategory : availableCategories?.[0]?.id) || 'cat_main';

    setItemForm({
      name: '',
      price: '',
      description: '',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      categoryId: initialCatId,
      isAvailable: true,
      sellingHours: {
        isAllDay: true,
        customDays: [1, 2, 3, 4, 5, 6, 0],
        shifts: [{ start: '07:00', end: '22:00' }]
      },
      linkedToppingGroupIds: [],
      customization: {
        hasCustomization: false,
        optionGroups: [],
        allowNotes: true,
        notePlaceholder: 'Ví dụ: không hành, ít cay, để riêng nước chấm...'
      }
    });
    setShowItemModal(true);
  };

  // Mở modal Sửa món (Image 4)
  const handleOpenEditItemModal = (item) => {
    setEditingItem(item);
    setItemModalTab('basic');
    const isUrlMode = item.image?.startsWith('http') && !item.image.includes('cloudinary');
    setDishImageMode(isUrlMode ? 'url' : 'upload');
    setUploadingDishImage(false);
    setDishImageError(false);
    if (dishFileInputRef.current) dishFileInputRef.current.value = '';

    setItemForm({
      name: item.name || '',
      price: item.price || '',
      description: item.description || '',
      image: item.image || '',
      categoryId: item.categoryId || item.category || availableCategories?.[0]?.id || 'cat_main',
      isAvailable: item.isAvailable !== false,
      sellingHours: item.sellingHours || {
        isAllDay: true,
        customDays: [1, 2, 3, 4, 5, 6, 0],
        shifts: [{ start: '07:00', end: '22:00' }]
      },
      linkedToppingGroupIds: item.linkedToppingGroupIds || [],
      customization: item.customization || {
        hasCustomization: false,
        optionGroups: [],
        allowNotes: true,
        notePlaceholder: 'Ví dụ: không hành, ít cay, để riêng nước chấm...'
      }
    });
    setShowItemModal(true);
  };

  // Lưu món ăn
  const handleSaveMenuItem = async () => {
    if (!itemForm.name || !itemForm.price) {
      alert('Vui lòng nhập Tên món và Giá món!');
      return;
    }
    try {
      if (editingItem) {
        await storeApi.updateMenuItem(editingItem._id, itemForm);
        showToast(`Đã cập nhật món [${itemForm.name}] thành công!`);
      } else {
        await storeApi.addMenuItem(itemForm);
        showToast(`Đã thêm món mới [${itemForm.name}] vào thực đơn!`);
      }
      setShowItemModal(false);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.menu_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi lưu món: ' + (err.response?.data?.message || err.message));
    }
  };

  // Xóa món ăn
  const handleDeleteMenuItem = async (itemId, itemName) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa món [${itemName}] khỏi thực đơn?`)) return;
    try {
      await storeApi.deleteMenuItem(itemId);
      showToast(`Đã xóa món [${itemName}] thành công!`);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.menu_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi xóa món: ' + (err.response?.data?.message || err.message));
    }
  };

  // =========================================================================
  // XỬ LÝ NHÓM TOPPING (Images 7, 8)
  // =========================================================================
  const handleOpenAddToppingGroupModal = () => {
    setEditingToppingGroup(null);
    setToppingGroupForm({
      name: '',
      isRequired: false,
      minChoices: 0,
      maxChoices: 1,
      layout: 'VERTICAL',
      toppings: [
        { id: `top_${Date.now()}_1`, name: '', extraPrice: 0, isAvailable: true }
      ]
    });
    setShowToppingGroupModal(true);
  };

  const handleOpenEditToppingGroupModal = (group) => {
    setEditingToppingGroup(group);
    setToppingGroupForm({
      name: group.name,
      isRequired: Boolean(group.isRequired),
      minChoices: group.minChoices || 0,
      maxChoices: group.maxChoices || 1,
      layout: group.layout || 'VERTICAL',
      toppings: group.toppings ? JSON.parse(JSON.stringify(group.toppings)) : []
    });
    setShowToppingGroupModal(true);
  };

  const handleSaveToppingGroup = async () => {
    if (!toppingGroupForm.name.trim()) {
      alert('Vui lòng nhập Tên nhóm Topping (VD: Kích cỡ, Mức đường, Topping thêm)!');
      return;
    }
    const currentGroups = store?.toppingGroups ? [...store.toppingGroups] : [];
    if (editingToppingGroup) {
      const idx = currentGroups.findIndex((g) => g.id === editingToppingGroup.id);
      if (idx !== -1) {
        currentGroups[idx] = { ...toppingGroupForm, id: editingToppingGroup.id };
      }
    } else {
      currentGroups.push({
        ...toppingGroupForm,
        id: `tg_${Date.now()}`
      });
    }

    try {
      await storeApi.updateToppingGroups({ toppingGroups: currentGroups });
      showToast('Đã lưu Nhóm Topping thành công!');
      setShowToppingGroupModal(false);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.menu_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi lưu nhóm topping: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteToppingGroup = async (groupId, groupName) => {
    if (!confirm(`Bạn có chắc muốn xóa nhóm topping [${groupName}]?`)) return;
    const updated = (store?.toppingGroups || []).filter((g) => g.id !== groupId);
    try {
      await storeApi.updateToppingGroups({ toppingGroups: updated });
      showToast(`Đã xóa nhóm topping [${groupName}]!`);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.menu_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi xóa nhóm topping: ' + (err.response?.data?.message || err.message));
    }
  };

  // =========================================================================
  // XỬ LÝ PHÂN HỆ TRẠNG THÁI & LỊCH HOẠT ĐỘNG (Images 10 - 15)
  // =========================================================================

  // Đổi trạng thái mở/đóng tức thì
  const handleToggleStoreOpen = async () => {
    if (store?.status === 'BANNED' || store?.status === 'LOCKED' || store?.banInfo?.isBanned) {
      alert(`Quán đang trong thời gian bị tạm khóa hoạt động đến ${store.banInfo?.banUntil ? new Date(store.banInfo.banUntil).toLocaleString('vi-VN') : 'khi có thông báo mới'}. Lý do: ${store.banInfo?.banReason || 'Vi phạm chính sách'}. Quán không thể mở cửa trong thời gian này.`);
      return;
    }
    const currentOpen = store?.operatingStatus?.isOpen !== false;
    const newOpen = !currentOpen;
    try {
      await storeApi.updateOperations({
        operatingStatus: {
          isOpen: newOpen,
          isBusy: false,
          busyUntil: null
        }
      });
      showToast(`Quán đã chuyển sang trạng thái: ${newOpen ? '🟢 Đang mở cửa' : '🔴 Đã đóng cửa'}`);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.operations_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi đổi trạng thái: ' + (err.response?.data?.message || err.message));
    }
  };

  // Kích hoạt chế độ Quán Bận (Image 15)
  const handleApplyBusyMode = async () => {
    let busyUntil = new Date();
    if (busyDuration === '30') {
      busyUntil = new Date(Date.now() + 30 * 60 * 1000);
    } else if (busyDuration === '60') {
      busyUntil = new Date(Date.now() + 60 * 60 * 1000);
    } else if (busyDuration === 'today') {
      busyUntil = new Date();
      busyUntil.setHours(23, 59, 59, 999);
    }

    try {
      await storeApi.updateOperations({
        operatingStatus: {
          isOpen: true,
          isBusy: true,
          busyReason: 'Quán đang quá tải đơn bếp, tạm dừng nhận đơn mới',
          busyUntil: busyUntil
        }
      });
      showToast(`Đã kích hoạt chế độ Quán Bận đến ${busyUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}!`);
      setShowBusyModal(false);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.operations_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi cài đặt quán bận: ' + (err.response?.data?.message || err.message));
    }
  };

  // Lưu lịch thường ngày (Images 10, 11)
  const handleSaveWeeklySchedule = async (newWeekly) => {
    try {
      await storeApi.updateOperations({ weeklySchedule: newWeekly });
      showToast('Đã lưu Lịch mở cửa thường ngày thành công!');
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.operations_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi lưu lịch: ' + (err.response?.data?.message || err.message));
    }
  };

  // Thêm lịch ngày lễ đặc biệt (Images 12 - 14)
  const handleAddSpecialSchedule = async () => {
    const currentSpecial = store?.specialSchedules ? [...store.specialSchedules] : [];
    currentSpecial.push(specialScheduleForm);
    try {
      await storeApi.updateOperations({ specialSchedules: currentSpecial });
      showToast(`Đã thêm lịch đặc biệt cho ngày ${specialScheduleForm.date}!`);
      setShowSpecialScheduleModal(false);
      fetchStoreData({ silent: true });
      publishRealtimeSignal('restaurant', { type: 'store.operations_updated', storeId: store?._id });
    } catch (err) {
      alert('Lỗi lưu lịch đặc biệt: ' + (err.response?.data?.message || err.message));
    }
  };

  // =========================================================================
  // XỬ LÝ PHÂN HỆ QUẢN LÝ NHÂN VIÊN (Images 16, 17)
  // =========================================================================
  const handleAddStaff = async () => {
    if (!staffForm.name || !staffForm.phone) {
      alert('Vui lòng nhập Tên và Số điện thoại nhân viên!');
      return;
    }
    const currentStaff = store?.staff ? [...store.staff] : [];
    currentStaff.push({
      id: `staff_${Date.now()}`,
      name: staffForm.name,
      phone: staffForm.phone.replace(/^0+/, ''), // Chuẩn hóa SĐT theo FoodFast Partner
      email: staffForm.email || '',
      role: staffForm.role,
      scope: staffForm.scope,
      status: 'ACTIVE',
      createdAt: new Date()
    });

    try {
      await storeApi.updateStaff({ staff: currentStaff });
      showToast(`Đã thêm nhân viên [${staffForm.name}] thành công!`);
      setShowStaffModal(false);
      setStaffForm({ name: '', phone: '', email: '', role: 'STAFF', scope: 'ALL' });
      fetchStoreData({ silent: true });
    } catch (err) {
      alert('Lỗi thêm nhân viên: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản nhân viên [${staffName}]?`)) return;
    const updated = (store?.staff || []).filter((s) => s.id !== staffId);
    try {
      await storeApi.updateStaff({ staff: updated });
      showToast(`Đã xóa nhân viên [${staffName}]!`);
      fetchStoreData({ silent: true });
    } catch (err) {
      alert('Lỗi xóa nhân viên: ' + (err.response?.data?.message || err.message));
    }
  };

  // =========================================================================
  // XỬ LÝ PHÂN HỆ VÍ ĐỐI TÁC & RÚT TIỀN (Images 17, 18)
  // =========================================================================
  const handleOpenWithdrawModal = () => {
    setWithdrawStep('amount');
    setWithdrawAmount('');
    setEnteredPin('');
    setPinError('');
    setShowWithdrawModal(true);
  };

  // Chuyển sang bước nhập PIN 6 số
  const handleProceedToPin = () => {
    const amount = Number(withdrawAmount);
    const available = realMetrics.availableBalance;
    if (!amount || amount < 100000) {
      alert('Số tiền rút tối thiểu là 100.000đ!');
      return;
    }
    if (amount > available) {
      alert(`Số dư khả dụng hiện tại (${formatVND(available)}) không đủ!`);
      return;
    }
    setWithdrawStep('pin');
    setEnteredPin('');
    setPinError('');
  };

  // Xử lý bấm phím số trên bàn phím PIN pad bảo mật (Image 18)
  const handlePinKeyPress = (digit) => {
    if (enteredPin.length < 6) {
      const newPin = enteredPin + digit;
      setEnteredPin(newPin);
      if (newPin.length === 6) {
        // Tự động gửi lệnh rút tiền khi đủ 6 số
        executeWithdrawal(newPin);
      }
    }
  };

  const handlePinDelete = () => {
    setEnteredPin(enteredPin.slice(0, -1));
    setPinError('');
  };

  const executeWithdrawal = async (pin) => {
    try {
      const res = await storeApi.manageWallet({
        action: 'withdraw',
        amount: Number(withdrawAmount),
        pin: pin
      });
      if (res.data?.success) {
        setLastPayoutRecord(res.data.data.payout);
        setWithdrawStep('success');
        fetchStoreData({ silent: true });
        publishRealtimeSignal('restaurant', { type: 'wallet.withdrawn', storeId: store?._id });
      }
    } catch (err) {
      setPinError(err.response?.data?.message || 'Mã PIN bảo mật không chính xác. Vui lòng thử lại!');
      setEnteredPin('');
    }
  };

  // =========================================================================
  // 6. PHÂN HỆ VOUCHER TỰ TẠO CỦA QUÁN & TÍNH THUẾ HỘ KINH DOANH (MODULE 6)
  // =========================================================================
  const [merchantVouchers, setMerchantVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);

  const paginatedMerchantVouchers = useMemo(
    () => paginateList(merchantVouchers, merchantVoucherPage, MERCHANT_VOUCHER_PAGE_SIZE),
    [merchantVouchers, merchantVoucherPage]
  );
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  const [submittingVoucher, setSubmittingVoucher] = useState(false);
  const [simOrderAmount, setSimOrderAmount] = useState(100000);
  const [voucherForm, setVoucherForm] = useState({
    code: '',
    title: '',
    discount_type: 'FIXED_AMOUNT',
    discount_value: 20000,
    max_discount_amount: '',
    min_order_value: 100000,
    usage_limit: 100,
    start_date: '',
    end_date: '',
    is_active: true
  });

  const fetchMerchantVouchers = async ({ silent = false } = {}) => {
    const targetStoreId = storeRef.current?._id || store?._id;
    if (!targetStoreId) return;
    if (!silent) setVouchersLoading(true);
    try {
      const res = await storeApi.getVouchers();
      if (res.data?.success) {
        setMerchantVouchers(res.data.data || []);
      }
    } catch {
      // Giữ nguyên danh sách hiện tại nếu offline
    } finally {
      if (!silent) setVouchersLoading(false);
    }
  };

  useEffect(() => {
    if (store?._id) {
      fetchMerchantVouchers();
    }
  }, [store?._id]);

  const handleOpenCreateVoucher = () => {
    setEditingVoucherId(null);
    const now = new Date();
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setVoucherForm({
      code: '',
      title: '',
      discount_type: 'FIXED_AMOUNT',
      discount_value: 20000,
      max_discount_amount: '',
      min_order_value: 100000,
      usage_limit: 100,
      start_date: now.toISOString().slice(0, 16),
      end_date: nextMonth.toISOString().slice(0, 16),
      is_active: true
    });
    setSimOrderAmount(100000);
    setShowVoucherModal(true);
  };

  const handleOpenEditVoucher = (v) => {
    setEditingVoucherId(v._id);
    const minVal = v.min_order_value || 0;
    setVoucherForm({
      code: v.code,
      title: v.title || '',
      discount_type: v.discount_type || 'FIXED_AMOUNT',
      discount_value: v.discount_value || 0,
      max_discount_amount: v.max_discount_amount || '',
      min_order_value: minVal,
      usage_limit: v.usage_limit || 100,
      start_date: v.start_date ? new Date(v.start_date).toISOString().slice(0, 16) : '',
      end_date: v.end_date ? new Date(v.end_date).toISOString().slice(0, 16) : '',
      is_active: v.is_active !== false
    });
    setSimOrderAmount(Math.max(100000, minVal));
    setShowVoucherModal(true);
  };

  const handleSaveVoucher = async (e) => {
    e.preventDefault();
    if (!voucherForm.code.trim()) {
      alert('Vui lòng nhập mã Voucher!');
      return;
    }
    if (!voucherForm.discount_value || Number(voucherForm.discount_value) <= 0) {
      alert('Vui lòng nhập giá trị giảm hợp lệ (> 0)!');
      return;
    }
    setSubmittingVoucher(true);
    try {
      const payload = {
        ...voucherForm,
        code: voucherForm.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
        discount_value: Number(voucherForm.discount_value),
        max_discount_amount:
          voucherForm.discount_type === 'PERCENTAGE' && voucherForm.max_discount_amount
            ? Number(voucherForm.max_discount_amount)
            : null,
        min_order_value: Math.max(0, Number(voucherForm.min_order_value) || 0),
        usage_limit: Math.max(1, Number(voucherForm.usage_limit) || 100),
        start_date: voucherForm.start_date ? new Date(voucherForm.start_date).toISOString() : new Date().toISOString(),
        end_date: voucherForm.end_date ? new Date(voucherForm.end_date).toISOString() : null
      };

      if (editingVoucherId) {
        const res = await storeApi.updateVoucher(editingVoucherId, payload);
        showToast(res.data?.message || `Đã cập nhật voucher [${payload.code}]!`);
      } else {
        const res = await storeApi.createVoucher(payload);
        showToast(res.data?.message || `Đã tạo voucher [${payload.code}] miễn phí khởi tạo thành công!`);
      }
      setShowVoucherModal(false);
      fetchMerchantVouchers({ silent: true });
      publishRealtimeSignal('voucher', { type: 'voucher.saved', code: payload.code, storeId: store?._id });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi lưu voucher quán');
    } finally {
      setSubmittingVoucher(false);
    }
  };

  const handleToggleVoucher = async (voucherId) => {
    try {
      const res = await storeApi.toggleVoucher(voucherId);
      showToast(res.data?.message || 'Đã chuyển trạng thái voucher!');
      fetchMerchantVouchers({ silent: true });
      publishRealtimeSignal('voucher', { type: 'voucher.toggled', voucherId, storeId: store?._id });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi chuyển trạng thái');
    }
  };

  const handleDeleteVoucher = async (voucherId, code) => {
    if (!window.confirm(`Xóa mã voucher [${code}] của quán? Mã sẽ ngừng hiệu lực ngay với khách hàng.`)) return;
    try {
      const res = await storeApi.deleteVoucher(voucherId);
      showToast(res.data?.message || `Đã xóa voucher [${code}]!`);
      fetchMerchantVouchers({ silent: true });
      publishRealtimeSignal('voucher', { type: 'voucher.deleted', code, storeId: store?._id });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi xóa voucher');
    }
  };

  // Bộ mô phỏng trực tiếp khi Chủ quán nhập thông số Voucher
  const liveVoucherSimulation = useMemo(() => {
    return simulateMerchantVoucher({
      orderAmount: simOrderAmount,
      discountType: voucherForm.discount_type,
      discountValue: voucherForm.discount_value,
      maxDiscountAmount: voucherForm.max_discount_amount,
      minOrderValue: voucherForm.min_order_value,
      commissionRate: store?.commissionRate ?? 0.25,
      merchantType: store?.merchantType || 'HOUSEHOLD'
    });
  }, [simOrderAmount, voucherForm, store?.commissionRate, store?.merchantType]);

  // Tổng hợp quyết toán tài chính & Thuế Hộ Kinh Doanh trên các đơn hàng thành công của quán
  const walletSummary = useMemo(() => {
    const settledOrders = (orders || []).filter((o) =>
      ['COMPLETED', 'DELIVERED'].includes(o.status)
    );
    return settledOrders.reduce(
      (acc, ord) => {
        const s = calculateMerchantSettlement(ord, store);
        acc.orderCount += 1;
        acc.grossFoodTotal += s.grossFoodTotal;
        acc.storeVoucherDiscount += s.storeVoucherDiscount;
        acc.platformVoucherDiscount += s.platformVoucherDiscount;
        acc.taxableRevenue += s.taxableRevenue;
        acc.platformCommission += s.platformCommission;
        acc.withholdingTax += s.withholdingTax;
        acc.taxSavedByStoreVoucher += s.taxSavedByStoreVoucher;
        acc.commissionSavedByStoreVoucher += s.commissionSavedByStoreVoucher;
        acc.netMerchant += s.netMerchant;
        return acc;
      },
      {
        orderCount: 0,
        grossFoodTotal: 0,
        storeVoucherDiscount: 0,
        platformVoucherDiscount: 0,
        taxableRevenue: 0,
        platformCommission: 0,
        withholdingTax: 0,
        taxSavedByStoreVoucher: 0,
        commissionSavedByStoreVoucher: 0,
        netMerchant: 0
      }
    );
  }, [orders, store]);

  // =========================================================================
  // RENDER TRẠNG THÁI LOADING / ERROR
  // =========================================================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <RotateCw className="w-8 h-8 text-orange-600 animate-spin" />
          <p className="text-sm font-semibold text-gray-600">Đang tải Cổng Đối tác Chủ Quán...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-gray-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Không thể tải thông tin quán</h2>
          <p className="text-sm text-gray-600">{errorMsg || 'Vui lòng kiểm tra lại tài khoản hoặc kết nối mạng.'}</p>
          <button
            onClick={() => navigate('/merchant/status')}
            className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-md shadow-orange-600/20"
          >
            Kiểm tra trạng thái hồ sơ
          </button>
        </div>
      </div>
    );
  }

  const isStoreBanned = store.status === 'BANNED' || store.status === 'LOCKED' || Boolean(store.banInfo?.isBanned);
  const isStoreOpen = !isStoreBanned && store.operatingStatus?.isOpen !== false;
  const isStoreBusy = !isStoreBanned && Boolean(store.operatingStatus?.isBusy);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      {/* Toast thông báo thành công */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn border border-emerald-400/30">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {/* Banner Popup Thông báo Mới Realtime từ Ban quản trị / Ví đối tác */}
      {liveNotifBanner && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm w-full p-4 rounded-2xl shadow-2xl border-2 backdrop-blur-md animate-fadeIn flex items-start gap-3 ${
            liveNotifBanner.type === 'BAN'
              ? 'bg-red-950/95 border-red-500 text-red-100'
              : liveNotifBanner.type === 'WARNING'
              ? 'bg-amber-950/95 border-amber-500 text-amber-100'
              : 'bg-slate-900/95 border-emerald-500 text-slate-100'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-5 h-5 text-orange-400 animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-orange-400">
              Thông báo mới từ FoodFast
            </div>
            <div className="text-xs font-bold text-white truncate mt-0.5">{liveNotifBanner.title}</div>
            <p className="text-[11px] opacity-85 line-clamp-2 mt-1">{liveNotifBanner.content}</p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => {
                  setLiveNotifBanner(null);
                  setShowNotificationsModal(true);
                  handleMarkAllNotifsAsRead();
                }}
                className="px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition"
              >
                Mở chuông xem ngay
              </button>
              <button
                onClick={() => setLiveNotifBanner(null)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
              >
                Ẩn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. HEADER CHỦ QUÁN (FOODFAST PARTNER HERO BAR) */}
      {/* ===================================================================== */}
      <div className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Thông tin quán + Nút đổi trạng thái Mở/Đóng/Quán Bận */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
              isStoreBanned
                ? 'bg-red-600/20 border-red-500/40 text-red-400'
                : 'bg-orange-600/20 border-orange-500/30 text-orange-400'
            }`}>
              {isStoreBanned ? <Lock className="w-6 h-6" /> : <Store className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-white truncate max-w-[200px] sm:max-w-md">
                  {store.name}
                </h1>
                {/* Trạng thái hiện tại */}
                {isStoreBanned ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                    <Lock className="w-3 h-3" /> ĐÃ BỊ KHÓA ({store.banInfo?.banDurationDays || 7} NGÀY)
                  </span>
                ) : isStoreBusy ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                    Quán Bận
                  </span>
                ) : isStoreOpen ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    Đang mở cửa
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    Đã đóng cửa
                  </span>
                )}
                <span
                  className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                  title="Tự động đồng bộ thông báo, đơn hàng, ví và số liệu theo thời gian thực"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                {store.address || 'TP. Hồ Chí Minh'}
              </p>
            </div>
          </div>

          {/* Quick Actions Trạng thái quán & Chuông thông báo */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Nút bật/tắt Mở cửa / Đóng cửa */}
            <button
              onClick={handleToggleStoreOpen}
              disabled={isStoreBanned}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                isStoreBanned
                  ? 'bg-red-500/10 text-red-400/60 border-red-500/20 cursor-not-allowed opacity-60'
                  : isStoreOpen
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
              title={isStoreBanned ? 'Quán đang trong thời gian bị khóa hoạt động' : undefined}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isStoreBanned ? 'Bị tạm khóa' : isStoreOpen ? 'Đóng cửa quán' : 'Mở cửa ngay'}</span>
            </button>

            {/* Nút Quán bận */}
            {!isStoreBanned && (
              <button
                onClick={() => setShowBusyModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1.5"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Quán bận</span>
              </button>
            )}

            {/* Nút Chuông Thông báo từ Admin */}
            <button
              onClick={async () => {
                setShowNotificationsModal(true);
                await fetchNotifications();
                handleMarkAllNotifsAsRead();
              }}
              className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
              title="Thông báo từ Ban quản trị FoodFast"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce shadow">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Nút Làm mới dữ liệu */}
            <button
              onClick={async () => {
                await Promise.all([
                  fetchStoreData({ silent: true }),
                  fetchNotifications(),
                  fetchOrders(),
                  fetchReviews(),
                  fetchMerchantVouchers({ silent: true })
                ]);
                showToast('Đã đồng bộ toàn bộ dữ liệu đối tác mới nhất!');
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
              title="Làm mới dữ liệu"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Banner Quán Bị Khóa Hoạt Động (Lệnh cấm có thời hạn của Admin) */}
        {isStoreBanned && (
          <div className="bg-gradient-to-r from-red-950/80 via-red-900/60 to-slate-900 border-2 border-red-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl text-red-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-600/30 border border-red-500/60 text-red-400 flex items-center justify-center shrink-0 shadow-lg shadow-red-950">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base sm:text-xl font-black text-white tracking-wide">
                    QUÁN ĐANG BỊ TẠM KHÓA HOẠT ĐỘNG
                  </h2>
                  <span className="px-3 py-0.5 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-md border border-red-400/40">
                    Bị cấm {store.banInfo?.banDurationDays || 7} ngày
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-red-200 leading-relaxed">
                  <strong className="text-white">Lý do khóa:</strong> {store.banInfo?.banReason || 'Vi phạm chính sách hoạt động của nền tảng FoodFast'}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-red-300/90 pt-1 border-t border-red-800/40 font-medium">
                  <span>
                    📅 Thời điểm bắt đầu cấm: {store.banInfo?.bannedAt ? new Date(store.banInfo.bannedAt).toLocaleString('vi-VN') : 'Gần đây'}
                  </span>
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Thời hạn mở cấm dự kiến: {store.banInfo?.banUntil ? new Date(store.banInfo.banUntil).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' }) : 'Chưa xác định'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowNotificationsModal(true);
                handleMarkAllNotifsAsRead();
              }}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/40 transition flex items-center gap-2 shrink-0 self-end md:self-center"
            >
              <Bell className="w-4 h-4" /> Xem chi tiết thông báo
            </button>
          </div>
        )}
        {/* ===================================================================== */}
        {/* 2. THỐNG KÊ NHANH KPI (Doanh thu hôm nay, Số đơn, Đánh giá, Ví) */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Doanh thu hôm nay</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">
                {formatVND(realMetrics.todayRevenue)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Tính từ đơn hoàn tất trong ngày
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Đơn thành công</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5">
                {realMetrics.completedOrdersCount} đơn
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Đơn đã giao cho khách hàng
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Đánh giá quán</p>
              <p className="text-lg sm:text-xl font-black text-white mt-0.5 flex items-center gap-1">
                <span>{realMetrics.reviewCount > 0 ? realMetrics.avgRating.toFixed(1) : '0.0'}</span>
                <span className="text-amber-400 text-sm">★</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {realMetrics.reviewCount > 0 ? `Từ ${realMetrics.reviewCount} lượt đánh giá` : 'Chưa có đánh giá nào'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-sm flex items-center justify-between cursor-pointer hover:border-orange-500/50 transition-all"
            onClick={() => setActiveMainTab('wallet')}
          >
            <div>
              <p className="text-xs text-slate-400 font-medium">Số dư Ví đối tác</p>
              <p className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5">
                {formatVND(realMetrics.availableBalance)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {realTransactions.length} giao dịch ghi nhận
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. THANH ĐIỀU HƯỚNG 6 TABS CHUẨN FOODFAST PARTNER */}
        {/* ===================================================================== */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          {[
            { id: 'orders', label: '1. Đơn hàng (Live Orders)', icon: ShoppingBag, badge: orders.filter((o) => ['PENDING', 'NEW'].includes(o.status)).length },
            { id: 'menu', label: '2. Thực đơn & Topping', icon: UtensilsCrossed, badge: store.menuItems?.length || 0 },
            { id: 'operations', label: '3. Giờ mở cửa & Quán bận', icon: Clock },
            { id: 'staff', label: '4. Quản lý Nhân viên', icon: Users, badge: store.staff?.length || 0 },
            { id: 'vouchers', label: '5. Voucher của Quán', icon: Ticket, badge: merchantVouchers.filter((v) => v.is_active).length },
            { id: 'wallet', label: '6. Tài chính & Ví đối tác', icon: Wallet }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMainTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-2 py-0.2 rounded-full text-[11px] font-extrabold ${isActive ? 'bg-white text-orange-600' : 'bg-orange-500/20 text-orange-400'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ===================================================================== */}
        {/* PHÂN HỆ 1: ĐƠN HÀNG (LIVE ORDERS - Images 1, 2) */}
        {/* ===================================================================== */}
        {activeMainTab === 'orders' && (
          <div className="space-y-4">
            {/* Sub-tabs trạng thái đơn */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
                {[
                  { id: 'new', label: 'Đơn mới', count: orders.filter((o) => ['PENDING', 'NEW'].includes(o.status)).length },
                  { id: 'preparing', label: 'Đang chuẩn bị', count: orders.filter((o) => ['CONFIRMED', 'PREPARING'].includes(o.status)).length },
                  { id: 'delivering', label: 'Đang giao', count: orders.filter((o) => ['FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'].includes(o.status)).length },
                  { id: 'history', label: 'Lịch sử', count: orders.filter((o) => ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.status)).length },
                  { id: 'all', label: 'Tất cả', count: orders.length }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setOrderSubTab(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      orderSubTab === st.id
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {st.label} ({st.count})
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Tự động cập nhật đơn thời gian thực</span>
              </div>
            </div>

            {/* Danh sách đơn hàng */}
            {filteredOrders.length === 0 ? (
              <div className="bg-slate-800/40 rounded-3xl p-12 text-center border border-slate-800 space-y-3">
                <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-base font-bold text-slate-300">Không có đơn hàng nào trong mục này</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Khi khách hàng đặt món, đơn hàng sẽ hiển thị tại đây kèm chuông báo và thời gian đếm ngược.
                </p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedOrders.map((ord) => {
                  const isNew = ['PENDING', 'NEW'].includes(ord.status);
                  const isPreparing = ['CONFIRMED', 'PREPARING'].includes(ord.status);
                  const isDelivering = ['FINDING_DRIVER', 'DRIVER_ASSIGNED', 'DELIVERING'].includes(ord.status);
                  const isDelivered = ['COMPLETED', 'DELIVERED'].includes(ord.status);

                  // Tính tài chính đơn hàng theo công thức FoodFast Partner & Thuế Hộ Kinh Doanh
                  const settlement = calculateMerchantSettlement(ord, store);

                  return (
                    <div
                      key={ord._id}
                      className={`bg-slate-800/90 rounded-2xl p-4 border transition-all space-y-3.5 shadow-md ${
                        isNew ? 'border-orange-500 shadow-orange-500/10' : 'border-slate-700'
                      }`}
                    >
                      {/* Header đơn */}
                      <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 font-black text-xs">
                            #{ord._id?.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {isNew && (
                          <span className="px-2.5 py-0.5 rounded-full bg-orange-600 text-white text-[11px] font-bold animate-pulse">
                            Đơn mới cần nhận
                          </span>
                        )}
                        {isPreparing && (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[11px] font-bold">
                            Đang làm món
                          </span>
                        )}
                        {isDelivering && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold">
                            Tài xế đang giao
                          </span>
                        )}
                        {isDelivered && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                            Đã giao thành công
                          </span>
                        )}
                      </div>

                      {/* Ghi chú của khách hàng (Đóng khung cam nổi bật - Image 1) */}
                      {ord.driverNote && (
                        <div className="p-2.5 rounded-xl bg-orange-950/40 border border-orange-500/30 text-xs text-orange-300 flex items-start gap-2">
                          <BadgeAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-orange-400">Ghi chú của khách: </span>
                            <span>{ord.driverNote}</span>
                          </div>
                        </div>
                      )}

                      {/* Danh sách món ăn trong đơn */}
                      <div className="space-y-1.5 divide-y divide-slate-700/60">
                        {ord.items?.map((it, idx) => (
                          <div key={idx} className="pt-1.5 flex items-start justify-between text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-white">
                                <span className="text-orange-400 mr-1.5">{it.quantity || 1}x</span>
                                {it.name}
                              </p>
                              {it.selectedSize && (
                                <p className="text-[11px] text-slate-400">Kích cỡ: {it.selectedSize.name}</p>
                              )}
                              {it.selectedToppings?.length > 0 && (
                                <p className="text-[11px] text-slate-400">
                                  Topping: {it.selectedToppings.map((t) => t.name).join(', ')}
                                </p>
                              )}
                            </div>
                            <span className="font-semibold text-slate-300">
                              {formatVND((it.price || 0) * (it.quantity || 1))}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Thông tin tài xế */}
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-750 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                            🛵
                          </div>
                          <div>
                            <p className="font-bold text-slate-200">
                              {ord.driver_info?.name || 'Chưa chỉ định tài xế'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {ord.driver_info?.phone ? `SĐT: ${ord.driver_info.phone}` : 'Đang tìm tài xế gần quán...'}
                            </p>
                          </div>
                        </div>
                        {ord.driver_info?.phone && (
                          <a
                            href={`tel:${ord.driver_info.phone}`}
                            className="p-1.5 rounded-lg bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 transition-colors"
                            title="Gọi tài xế"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Bảng kê tài chính đơn (Công thức FoodFast Partner & Thuế Hộ Kinh Doanh) */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-300">
                          <span>Giá gốc món ăn:</span>
                          <span className="font-semibold">{formatVND(settlement.grossFoodTotal)}</span>
                        </div>

                        {settlement.storeVoucherDiscount > 0 && (
                          <>
                            <div className="flex justify-between items-center text-amber-300">
                              <span className="flex items-center gap-1">
                                <span>(-) Voucher Quán [{settlement.voucherCode}]:</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold">
                                  Giảm trừ thuế
                                </span>
                              </span>
                              <span className="font-semibold">-{formatVND(settlement.storeVoucherDiscount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-200 border-t border-dashed border-slate-800 pt-1">
                              <span>Doanh thu sau giảm (Tính CK & Thuế):</span>
                              <span className="font-bold text-white">{formatVND(settlement.taxableRevenue)}</span>
                            </div>
                          </>
                        )}

                        {settlement.platformVoucherDiscount > 0 && (
                          <div className="flex justify-between items-center text-sky-300 bg-sky-950/40 px-2 py-1 rounded-lg border border-sky-500/20">
                            <span className="text-[11px]">
                              Voucher Sàn [{settlement.voucherCode}]: FoodFast bù {formatVND(settlement.platformVoucherDiscount)}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 shrink-0 ml-2">Không trừ quán</span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-400">
                          <span>
                            (-) Phí chiết khấu sàn ({Math.round(settlement.commissionRate * 100)}%):
                          </span>
                          <span className="text-rose-400">-{formatVND(settlement.platformCommission)}</span>
                        </div>

                        {settlement.isTaxWithheld ? (
                          <div className="flex justify-between text-slate-400">
                            <span>
                              (-) Thuế khấu trừ hộ (Hộ KD 1.5%: 1% GTGT + 0.5% TNCN):
                            </span>
                            <span className="text-rose-400">-{formatVND(settlement.withholdingTax)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Thuế khấu trừ hộ (Doanh nghiệp tự kê khai):</span>
                            <span>0 đ</span>
                          </div>
                        )}

                        {settlement.taxSavedByStoreVoucher > 0 && (
                          <div className="text-[10px] text-emerald-400/90 italic text-right">
                            * Đã tiết kiệm {formatVND(settlement.taxSavedByStoreVoucher)} tiền thuế & {formatVND(settlement.commissionSavedByStoreVoucher)} chiết khấu nhờ giảm trừ Voucher Quán
                          </div>
                        )}

                        <div className="border-t border-slate-800 pt-1.5 flex justify-between items-baseline font-bold text-sm text-emerald-400">
                          <div>
                            <span>Tiền Quán thực nhận về Ví:</span>
                            {settlement.isTaxWithheld && (
                              <span className="block text-[10px] font-normal text-slate-400">
                                (Chưa tính thuế: {formatVND(settlement.beforeTaxAmount)})
                              </span>
                            )}
                          </div>
                          <span>{formatVND(settlement.netMerchant)}</span>
                        </div>
                      </div>

                      {/* Nút hành động đơn hàng (Image 1, 2) */}
                      <div className="flex items-center gap-2 pt-1">
                        {isNew && (
                          <>
                            <button
                              onClick={() => handleConfirmOrder(ord._id)}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                            >
                              Xác nhận làm đơn
                            </button>
                            <button
                              onClick={() => handleOpenModifyModal(ord)}
                              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                              title="Chỉnh sửa đơn do hết món/sai giá"
                            >
                              Sửa / Hủy đơn
                            </button>
                          </>
                        )}

                        {isPreparing && (
                          <button
                            onClick={() => handleReadyOrder(ord._id)}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                          >
                            Đã nấu xong - Báo tài xế lấy món
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* Phân trang danh sách đơn hàng của quán */}
                <Pagination
                  currentPage={paginatedOrdersState.page}
                  totalPages={paginatedOrdersState.totalPages}
                  totalItems={paginatedOrdersState.totalItems}
                  pageSize={paginatedOrdersState.pageSize}
                  itemLabel="đơn hàng"
                  theme="dark"
                  onPageChange={(p) => setOrderPage(p)}
                  className="mt-4"
                />
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* PHÂN HỆ 2: THỰC ĐƠN & TOPPING (Images 3 - 9) */}
        {/* ===================================================================== */}
        {activeMainTab === 'menu' && (
          <div className="space-y-4">
            {/* Thanh chuyển đổi Món ăn | Nhóm Topping */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMenuSubTab('items')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    menuSubTab === 'items'
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Món ăn ({store.menuItems?.length || 0})
                </button>
                <button
                  onClick={() => setMenuSubTab('topping_groups')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    menuSubTab === 'topping_groups'
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Nhóm Topping ({store.toppingGroups?.length || 0})
                </button>
              </div>

              {menuSubTab === 'items' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCategoryOrderModal(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                    <span>Sắp xếp danh mục</span>
                  </button>
                  <button
                    onClick={handleOpenAddItemModal}
                    className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Thêm món mới</span>
                  </button>
                </div>
              )}

              {menuSubTab === 'topping_groups' && (
                <button
                  onClick={handleOpenAddToppingGroupModal}
                  className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Thêm nhóm Topping</span>
                </button>
              )}
            </div>

            {/* TAB MÓN ĂN */}
            {menuSubTab === 'items' && (
              <div className="space-y-4">
                {/* Lọc danh mục */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      selectedCategory === 'ALL'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Tất cả món
                  </button>
                  {availableCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Danh sách món ăn có công tắc Còn món / Hết món (Image 3, 4) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {paginatedMenuItems.map((item) => {
                      const isAvailable = item.isAvailable !== false;
                      return (
                        <div
                          key={item._id}
                          className={`p-3.5 rounded-2xl bg-slate-800/80 border transition-all flex flex-col justify-between space-y-3 ${
                            isAvailable ? 'border-slate-700' : 'border-rose-900/60 opacity-70'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}
                              alt={item.name}
                              className="w-16 h-16 rounded-xl object-cover bg-slate-900 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <h3 className="text-sm font-bold text-white truncate" title={item.name}>
                                {item.name}
                              </h3>
                              <p className="text-sm font-extrabold text-orange-400">
                                {formatVND(item.price)}
                              </p>
                              {item.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Toggle Còn món / Hết món 1 chạm & Thao tác Sửa/Xóa */}
                          <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
                            {/* Toggle Còn món / Hết món */}
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isAvailable}
                                onChange={() => handleToggleItemAvailability(item._id)}
                                className="sr-only"
                              />
                              <div
                                className={`w-9 h-5 rounded-full transition-colors relative ${
                                  isAvailable ? 'bg-emerald-500' : 'bg-slate-600'
                                }`}
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                                    isAvailable ? 'right-1' : 'left-1'
                                  }`}
                                />
                              </div>
                              <span className={`text-xs font-bold ${isAvailable ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {isAvailable ? 'Còn món' : 'Hết món'}
                              </span>
                            </label>

                            {/* Buttons Sửa / Xóa */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditItemModal(item)}
                                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                                title="Chỉnh sửa món"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMenuItem(item._id, item.name)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="Xóa món"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Phân trang danh sách món ăn của quán */}
                <Pagination
                  currentPage={paginatedMenuState.page}
                  totalPages={paginatedMenuState.totalPages}
                  totalItems={paginatedMenuState.totalItems}
                  pageSize={paginatedMenuState.pageSize}
                  itemLabel="món ăn"
                  theme="dark"
                  onPageChange={(p) => setMenuPage(p)}
                  className="mt-4"
                />
              </div>
            )}

            {/* TAB NHÓM TOPPING (Images 7, 8) */}
            {menuSubTab === 'topping_groups' && (
              <div className="space-y-4">
                {(store.toppingGroups || []).length === 0 ? (
                  <div className="bg-slate-800/40 rounded-3xl p-10 text-center border border-slate-800 space-y-3">
                    <Layers className="w-12 h-12 text-slate-600 mx-auto" />
                    <p className="text-base font-bold text-slate-300">Chưa có Nhóm Topping nào</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Tạo các nhóm như: Kích cỡ (Size M/L), Độ ngọt (100%, 70%, 50%), Mức đá, hoặc Topping gọi thêm (Trân châu, Flan...).
                    </p>
                    <button
                      onClick={handleOpenAddToppingGroupModal}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tạo Nhóm Topping đầu tiên</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paginatedToppingGroups.items.map((group) => (
                      <div
                        key={group.id}
                        className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shadow-md space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                          <div>
                            <h4 className="font-bold text-white text-sm">{group.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                group.isRequired
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-slate-700 text-slate-300'
                              }`}>
                                {group.isRequired ? `Bắt buộc (Chọn ${group.minChoices || 1})` : 'Không bắt buộc'}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">
                                {group.layout === 'HORIZONTAL' ? 'Dạng ngang' : 'Dạng dọc'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditToppingGroupModal(group)}
                              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                              title="Sửa nhóm topping"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteToppingGroup(group.id, group.name)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                              title="Xóa nhóm topping"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Danh sách Topping trong nhóm */}
                        <div className="space-y-1.5">
                          {group.toppings?.map((top, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900 border border-slate-800"
                            >
                              <span className="text-slate-200 font-medium">{top.name}</span>
                              <span className="font-bold text-orange-400">
                                {top.extraPrice > 0 ? `+${formatVND(top.extraPrice)}` : '0 đ'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    </div>

                    <Pagination
                      currentPage={paginatedToppingGroups.page}
                      totalPages={paginatedToppingGroups.totalPages}
                      totalItems={paginatedToppingGroups.totalItems}
                      pageSize={paginatedToppingGroups.pageSize}
                      itemLabel="nhóm topping"
                      theme="dark"
                      onPageChange={(p) => setToppingGroupPage(p)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* PHÂN HỆ 3: LỊCH HOẠT ĐỘNG & QUÁN BẬN (Images 10 - 15) */}
        {/* ===================================================================== */}
        {activeMainTab === 'operations' && (
          <div className="space-y-6">
            {/* 1. Lịch thường ngày (Thứ 2 đến Chủ nhật - Images 10, 11) */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-400" />
                    <span>Lịch đóng/mở cửa thường ngày</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Áp dụng cho việc cài đặt mặc định thời gian kinh doanh các ngày trong tuần
                  </p>
                </div>
                <button
                  onClick={() => handleSaveWeeklySchedule(store.weeklySchedule)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  Lưu lịch tuần
                </button>
              </div>

              {/* Danh sách 7 ngày trong tuần */}
              <div className="divide-y divide-slate-700/60">
                {[
                  { key: 'mon', label: 'Thứ Hai' },
                  { key: 'tue', label: 'Thứ Ba' },
                  { key: 'wed', label: 'Thứ Tư' },
                  { key: 'thu', label: 'Thứ Năm' },
                  { key: 'fri', label: 'Thứ Sáu' },
                  { key: 'sat', label: 'Thứ Bảy' },
                  { key: 'sun', label: 'Chủ Nhật' }
                ].map((d) => {
                  const dayData = store.weeklySchedule?.[d.key] || { isOpen: true, is24h: false, shifts: [{ open: '08:00', close: '22:00' }] };
                  return (
                    <div key={d.key} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="w-24">
                        <span className="font-bold text-white">{d.label}</span>
                      </div>

                      {/* Công tắc Mở/Đóng ngày này */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dayData.isOpen}
                          onChange={(e) => {
                            const updated = { ...store.weeklySchedule };
                            updated[d.key] = { ...dayData, isOpen: e.target.checked };
                            setStore({ ...store, weeklySchedule: updated });
                          }}
                          className="sr-only"
                        />
                        <div className={`w-8 h-4.5 rounded-full transition-colors relative ${dayData.isOpen ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${dayData.isOpen ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                        <span className={dayData.isOpen ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
                          {dayData.isOpen ? 'Mở cửa' : 'Đóng cửa'}
                        </span>
                      </label>

                      {/* Checkbox 24 giờ */}
                      {dayData.isOpen && (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dayData.is24h}
                            onChange={(e) => {
                              const updated = { ...store.weeklySchedule };
                              updated[d.key] = { ...dayData, is24h: e.target.checked };
                              setStore({ ...store, weeklySchedule: updated });
                            }}
                            className="rounded border-slate-700 text-orange-600 focus:ring-0"
                          />
                          <span className="text-slate-300 font-semibold">Mở 24 giờ</span>
                        </label>
                      )}

                      {/* Khung giờ mở - đóng */}
                      {dayData.isOpen && !dayData.is24h && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayData.shifts?.[0]?.open || '08:00'}
                            onChange={(e) => {
                              const updated = { ...store.weeklySchedule };
                              const shifts = [{ open: e.target.value, close: dayData.shifts?.[0]?.close || '22:00' }];
                              updated[d.key] = { ...dayData, shifts };
                              setStore({ ...store, weeklySchedule: updated });
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                          />
                          <span className="text-slate-400">đến</span>
                          <input
                            type="time"
                            value={dayData.shifts?.[0]?.close || '22:00'}
                            onChange={(e) => {
                              const updated = { ...store.weeklySchedule };
                              const shifts = [{ open: dayData.shifts?.[0]?.open || '08:00', close: e.target.value }];
                              updated[d.key] = { ...dayData, shifts };
                              setStore({ ...store, weeklySchedule: updated });
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Lịch đóng/mở dịp đặc biệt (Images 12 - 14) */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-orange-400" />
                    <span>Lịch đóng/mở cửa dịp đặc biệt</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Áp dụng cho ngày lễ, Tết, sự kiện hoặc có việc nghỉ kinh doanh đột xuất
                  </p>
                </div>
                <button
                  onClick={() => setShowSpecialScheduleModal(true)}
                  className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm lịch đặc biệt</span>
                </button>
              </div>

              {/* Danh sách ngày đặc biệt */}
              {(store.specialSchedules || []).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Chưa có lịch đặc biệt nào được thiết lập.</p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {paginatedSpecialSchedules.items.map((sc, idx) => {
                      const globalIdx = (paginatedSpecialSchedules.page - 1) * SCHEDULE_PAGE_SIZE + idx;
                      return (
                        <div key={`${sc.date || 'sc'}-${globalIdx}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                          <div>
                            <span className="font-bold text-white">{sc.date}</span>
                            <span className={`ml-3 px-2 py-0.5 rounded text-[10px] font-bold ${
                              sc.status === 'CLOSED' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {sc.status === 'CLOSED' ? 'Đóng cửa cả ngày' : 'Mở theo giờ riêng'}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              const updated = store.specialSchedules.filter((_, i) => i !== globalIdx);
                              await storeApi.updateOperations({ specialSchedules: updated });
                              showToast('Đã xóa lịch đặc biệt!');
                              fetchStoreData({ silent: true });
                              publishRealtimeSignal('restaurant', { type: 'store.operations_updated', storeId: store?._id });
                            }}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <Pagination
                    currentPage={paginatedSpecialSchedules.page}
                    totalPages={paginatedSpecialSchedules.totalPages}
                    totalItems={paginatedSpecialSchedules.totalItems}
                    pageSize={paginatedSpecialSchedules.pageSize}
                    itemLabel="lịch đặc biệt"
                    theme="dark"
                    onPageChange={(p) => setSpecialSchedulePage(p)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PHÂN HỆ 4: QUẢN LÝ NHÂN VIÊN (Images 16, 17) */}
        {/* ===================================================================== */}
        {activeMainTab === 'staff' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  <span>Danh sách nhân viên cửa hàng</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Phân quyền tài khoản riêng cho nhân viên để quản lý đơn hàng và món ăn an toàn
                </p>
              </div>
              <button
                onClick={() => setShowStaffModal(true)}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm nhân viên</span>
              </button>
            </div>

            {(store.staff || []).length === 0 ? (
              <div className="bg-slate-800/40 rounded-3xl p-10 text-center border border-slate-800 space-y-3">
                <Users className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-base font-bold text-slate-300">Chưa có tài khoản nhân viên</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Tạo tài khoản riêng cho nhân viên đứng bếp hoặc thu ngân để nhận đơn và cập nhật hết món.
                </p>
                <button
                  onClick={() => setShowStaffModal(true)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm nhân viên đầu tiên</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedStaff.items.map((st) => (
                  <div key={st.id} className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 shadow-md space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-sm">
                          {st.name?.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{st.name}</p>
                          <p className="text-xs text-slate-400">+84 {st.phone}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Hoạt động
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Vai trò:</span>
                        <span className="font-bold text-orange-400">
                          {st.role === 'MANAGER' ? 'Quản lý (Manager)' : 'Nhân viên (Staff)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Phạm vi:</span>
                        <span className="text-slate-300">
                          {st.scope === 'ALL' ? 'Tất cả quán' : 'Quán này'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleDeleteStaff(st.id, st.name)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa quyền</span>
                      </button>
                    </div>
                  </div>
                ))}
                </div>

                <Pagination
                  currentPage={paginatedStaff.page}
                  totalPages={paginatedStaff.totalPages}
                  totalItems={paginatedStaff.totalItems}
                  pageSize={paginatedStaff.pageSize}
                  itemLabel="nhân viên"
                  theme="dark"
                  onPageChange={(p) => setStaffPage(p)}
                />
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* PHÂN HỆ 5: VOUCHER KHUYẾN MÃI CỦA QUÁN & TÍNH THUẾ HỘ KINH DOANH */}
        {/* ===================================================================== */}
        {activeMainTab === 'vouchers' && (
          <div className="space-y-6">
            {/* Header & Nút tạo Voucher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-orange-400" />
                  <span>Quản lý Voucher khuyến mãi riêng của Quán</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự tạo mã giảm giá thu hút khách hàng — 0đ phí khởi tạo, chỉ trừ khi có đơn giao thành công.
                </p>
              </div>
              <button
                onClick={handleOpenCreateVoucher}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/25 flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Voucher Quán Mới</span>
              </button>
            </div>

            {/* Banner Chính sách Tài chính & Giảm trừ thuế Hộ Kinh Doanh */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-orange-500/30 space-y-3 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-bold text-orange-400 text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Cơ chế quyết toán Voucher & Khấu trừ thuế dành cho {store.merchantType === 'ENTERPRISE' ? 'Doanh nghiệp' : store.merchantType === 'INDIVIDUAL' ? 'Cá nhân' : 'Hộ Kinh Doanh'}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {MERCHANT_TYPE_LABELS[store.merchantType || 'HOUSEHOLD']}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <p className="font-bold text-emerald-400">1. Chỉ trừ khi có đơn thành công</p>
                  <p className="text-slate-400 leading-relaxed">
                    Thoải mái cài đặt ngân sách voucher. FoodFast không thu phí khởi tạo và không giam tiền ví trước.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <p className="font-bold text-amber-400">2. Công thức trừ trực tiếp</p>
                  <p className="text-slate-400 leading-relaxed">
                    Tiền Quán Nhận = (Giá gốc - Voucher Quán) - Chiết khấu sàn ({Math.round((store.commissionRate ?? 0.25) * 100)}%) - Thuế hộ ({store.merchantType === 'ENTERPRISE' ? '0%' : '1.5%'}).
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <p className="font-bold text-blue-400">3. Giảm trừ doanh thu tính thuế</p>
                  <p className="text-slate-400 leading-relaxed">
                    Voucher Quán tự tài trợ được trừ thẳng khỏi doanh thu chịu thuế GTGT (1%) &amp; TNCN (0.5%) và chiết khấu sàn!
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <p className="font-bold text-purple-400">4. Phân biệt Voucher Sàn</p>
                  <p className="text-slate-400 leading-relaxed">
                    Khi khách dùng mã của sàn FoodFast (Freeship, Đại tiệc...), Quán vẫn nhận đủ tiền món, FoodFast tự bù tiền giảm.
                  </p>
                </div>
              </div>
            </div>

            {/* Danh sách Voucher Quán tự tạo */}
            {vouchersLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RotateCw className="w-7 h-7 animate-spin text-orange-500 mx-auto mb-2" />
                <p className="text-xs">Đang tải danh sách mã khuyến mãi của quán...</p>
              </div>
            ) : merchantVouchers.length === 0 ? (
              <div className="bg-slate-800/40 rounded-3xl p-10 text-center border border-slate-800 space-y-3">
                <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-base font-bold text-slate-200">Quán chưa phát hành mã Voucher nào</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Hãy tạo mã giảm giá đầu tiên (VD: Giảm 15.000đ cho đơn từ 120.000đ) để tăng tỷ lệ chuyển đổi đơn hàng và được giảm trừ doanh thu tính thuế!
                </p>
                <button
                  onClick={handleOpenCreateVoucher}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tạo Voucher Đầu Tiên
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedMerchantVouchers.items.map((v) => {
                  const usagePct = v.usage_limit > 0 ? Math.min(100, Math.round(((v.used_count || 0) / v.usage_limit) * 100)) : 0;
                  const isExpired = v.end_date && new Date(v.end_date) < new Date();
                  const sampleSim = simulateMerchantVoucher({
                    orderAmount: Math.max(100000, v.min_order_value || 100000),
                    discountType: v.discount_type,
                    discountValue: v.discount_value,
                    maxDiscountAmount: v.max_discount_amount,
                    minOrderValue: v.min_order_value,
                    commissionRate: store.commissionRate ?? 0.25,
                    merchantType: store.merchantType || 'HOUSEHOLD'
                  });

                  return (
                    <div
                      key={v._id}
                      className={`p-4 rounded-2xl bg-slate-800/80 border transition-all space-y-3 ${
                        v.is_active ? 'border-slate-700 hover:border-orange-500/40' : 'border-slate-800 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-orange-400 tracking-wider bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                              {v.code}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Voucher Quán
                            </span>
                            {isExpired && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                Hết hạn
                              </span>
                            )}
                          </div>
                          <p className="text-white font-bold text-sm mt-1.5">{v.title}</p>
                        </div>

                        <button
                          onClick={() => handleToggleVoucher(v._id)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer shrink-0 ${
                            v.is_active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-700 text-slate-400 border-slate-600'
                          }`}
                        >
                          {v.is_active ? 'Đang bật' : 'Tạm tắt'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Mức giảm:</span>
                          <strong className="text-emerald-400">
                            {v.discount_type === 'PERCENTAGE'
                              ? `Giảm ${v.discount_value}%${v.max_discount_amount ? ` (tối đa ${formatVND(v.max_discount_amount)})` : ''}`
                              : `Giảm ${formatVND(v.discount_value)}`}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Đơn tối thiểu:</span>
                          <strong className="text-white">{formatVND(v.min_order_value || 0)}</strong>
                        </div>
                      </div>

                      {/* Tiến độ lượt dùng */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Đã dùng: <strong className="text-white">{v.used_count || 0}</strong> / {v.usage_limit} lượt</span>
                          <span className="text-orange-400 font-bold">{usagePct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                      </div>

                      {/* Ước tính thực nhận trên đơn mẫu */}
                      <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] flex items-center justify-between text-emerald-300">
                        <span>Đơn {formatVND(sampleSim.grossFoodTotal)} sau trừ CK &amp; thuế:</span>
                        <strong className="text-emerald-400">Ví nhận {formatVND(sampleSim.netMerchant)}</strong>
                      </div>

                      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">
                          HSD: {v.end_date ? new Date(v.end_date).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditVoucher(v)}
                            className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteVoucher(v._id, v.code)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>

                <Pagination
                  currentPage={paginatedMerchantVouchers.page}
                  totalPages={paginatedMerchantVouchers.totalPages}
                  totalItems={paginatedMerchantVouchers.totalItems}
                  pageSize={paginatedMerchantVouchers.pageSize}
                  itemLabel="voucher"
                  theme="dark"
                  onPageChange={(p) => setMerchantVoucherPage(p)}
                />
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* PHÂN HỆ 6: TÀI CHÍNH, THUẾ HỘ KINH DOANH & VÍ ĐỐI TÁC */}
        {/* ===================================================================== */}
        {activeMainTab === 'wallet' && (
          <div className="space-y-6">
            {/* Thẻ ví tổng quan */}
            <div className="bg-gradient-to-br from-orange-950/60 to-slate-900 rounded-3xl p-6 border border-orange-500/30 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet className="w-4 h-4" />
                      <span>Ví Đối Tác FoodFast Partner</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {MERCHANT_TYPE_LABELS[store.merchantType || 'HOUSEHOLD']}
                    </span>
                  </div>
                  <p className="text-3xl font-black text-white">
                    {formatVND(realMetrics.availableBalance)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Số dư khả dụng thật (Sẵn sàng rút về tài khoản ngân hàng)
                  </p>
                </div>

                <button
                  onClick={handleOpenWithdrawModal}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                  <span>Rút tiền ngay</span>
                </button>
              </div>

              {/* Thông tin số dư đang chờ xử lý & Tài khoản ngân hàng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium">Số dư đang chờ xử lý (Đơn đang giao):</span>
                  <p className="text-base font-extrabold text-amber-400">
                    {formatVND(realMetrics.pendingBalance)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Tiền dự kiến từ các đơn đang giao hoặc được cấp chờ quyết toán vào Số dư khả dụng.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium">Tài khoản ngân hàng thụ hưởng:</span>
                  <p className="text-sm font-extrabold text-white">
                    {store.wallet?.bankAccount?.bankName || store.bankName || 'Chưa cập nhật ngân hàng'}{' '}
                    {(store.wallet?.bankAccount?.accountNumber || store.bankAccountNumber) && (
                      <>• {store.wallet?.bankAccount?.accountNumber || store.bankAccountNumber}</>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Chủ tài khoản: {store.wallet?.bankAccount?.accountHolder || store.bankAccountHolder || store.representativeName || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bảng Quyết toán Tổng hợp Thuế & Voucher Hộ Kinh Doanh từ các đơn hoàn tất */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-orange-400" />
                    <span>Tổng hợp Quyết toán Voucher &amp; Thuế Hộ Kinh Doanh ({walletSummary.orderCount} đơn thành công)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Áp dụng giảm trừ doanh thu tính thuế &amp; chiết khấu cho các mã khuyến mãi do Quán tự tài trợ.
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  Chiết khấu sàn: {Math.round((store.commissionRate ?? 0.25) * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400">Tổng giá gốc món ăn</span>
                  <p className="text-base font-black text-white">{formatVND(walletSummary.grossFoodTotal)}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/30 space-y-1">
                  <span className="text-amber-300">(-) Voucher Quán tài trợ</span>
                  <p className="text-base font-black text-amber-400">-{formatVND(walletSummary.storeVoucherDiscount)}</p>
                  <span className="text-[10px] text-slate-400 block">Đã trừ vào DT tính thuế</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-sky-500/30 space-y-1">
                  <span className="text-sky-300">Voucher Sàn FoodFast bù</span>
                  <p className="text-base font-black text-sky-400">+{formatVND(walletSummary.platformVoucherDiscount)}</p>
                  <span className="text-[10px] text-slate-400 block">Không trừ tiền Quán</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-1">
                  <span className="text-emerald-300">Tổng thực nhận sau thuế</span>
                  <p className="text-base font-black text-emerald-400">{formatVND(walletSummary.netMerchant)}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Doanh thu chịu thuế &amp; chiết khấu (= Giá gốc - Voucher Quán):</span>
                  <strong className="text-white">{formatVND(walletSummary.taxableRevenue)}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>(-) Phí chiết khấu sàn FoodFast ({Math.round((store.commissionRate ?? 0.25) * 100)}%):</span>
                  <span className="text-rose-400 font-semibold">-{formatVND(walletSummary.platformCommission)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>
                    (-) Thuế khấu trừ hộ TMĐT ({store.merchantType === 'ENTERPRISE' ? '0% - DN tự kê khai' : '1.5% = 1% GTGT + 0.5% TNCN'}):
                  </span>
                  <span className="text-rose-400 font-semibold">-{formatVND(walletSummary.withholdingTax)}</span>
                </div>
                {(walletSummary.taxSavedByStoreVoucher > 0 || walletSummary.commissionSavedByStoreVoucher > 0) && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-400">
                    <span>Quyền lợi giảm trừ từ Voucher Quán tự tạo:</span>
                    <span>
                      Tiết kiệm <strong>{formatVND(walletSummary.taxSavedByStoreVoucher)}</strong> tiền thuế &amp;{' '}
                      <strong>{formatVND(walletSummary.commissionSavedByStoreVoucher)}</strong> phí chiết khấu!
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bảng kê lịch sử giao dịch & Quyết toán THẬT (Không có dòng tiền ảo) */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold text-white text-base">Lịch sử giao dịch &amp; Quyết toán ({realTransactions.length})</h3>
                <span className="text-[11px] text-slate-400">
                  Mọi biến động số dư từ Đơn hàng thật, Admin tặng tiền &amp; Rút tiền ngân hàng
                </span>
              </div>

              {realTransactions.length === 0 ? (
                <div className="py-10 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <Wallet className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">Chưa có giao dịch tài chính hoặc quyết toán nào</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Doanh thu thực nhận từ các đơn hàng hoàn tất hoặc tiền thưởng / quỹ kiểm thử do Admin FoodFast cấp sẽ hiển thị minh bạch tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="divide-y divide-slate-700/60">
                    {paginatedTransactions.items.map((tr, idx) => {
                    const isPositive = Number(tr.amount) > 0;
                    const isGrant = tr.type === 'ADMIN_GRANT';
                    const isOrder = tr.type === 'ORDER_SETTLEMENT';
                    return (
                      <div key={tr.id || tr.code || idx} className="py-3.5 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isGrant && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                <Gift className="w-3 h-3" /> Admin tặng tiền
                              </span>
                            )}
                            {isOrder && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Quyết toán đơn hàng
                              </span>
                            )}
                            {!isGrant && !isOrder && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Rút tiền ngân hàng
                              </span>
                            )}
                            <p className="font-bold text-white">{tr.desc}</p>
                          </div>

                          <p className="text-[11px] text-slate-400">
                            Mã GD: <span className="font-mono text-slate-300">{tr.code}</span> •{' '}
                            {tr.createdAt ? new Date(tr.createdAt).toLocaleString('vi-VN') : ''}
                            {tr.createdBy && tr.createdBy !== 'SYSTEM' && ` • Bởi: ${tr.createdBy}`}
                          </p>

                          {isOrder && tr.grossAmount > 0 && (
                            <p className="text-[10px] text-slate-400">
                              Giá gốc: {formatVND(tr.grossAmount)}
                              {tr.storeVoucherDiscount > 0 && ` • Voucher quán: -${formatVND(tr.storeVoucherDiscount)}`}
                              {tr.commission > 0 && ` • Chiết khấu sàn: -${formatVND(tr.commission)}`}
                              {tr.withholdingTax > 0 && ` • Thuế Hộ KD: -${formatVND(tr.withholdingTax)}`}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`font-black text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? `+${formatVND(tr.amount)}` : formatVND(tr.amount)}
                          </p>
                          <span
                            className={`text-[10px] font-bold ${
                              tr.status === 'SUCCESS' || tr.status === 'Thành công'
                                ? 'text-emerald-400'
                                : tr.status === 'REJECTED'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {tr.status === 'SUCCESS' ? 'Thành công' : tr.status === 'PENDING' ? 'Đang xử lý' : tr.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  </div>

                  <Pagination
                    currentPage={paginatedTransactions.page}
                    totalPages={paginatedTransactions.totalPages}
                    totalItems={paginatedTransactions.totalItems}
                    pageSize={paginatedTransactions.pageSize}
                    pageSizeOptions={[6, 12, 24]}
                    onPageSizeChange={(lim) => {
                      setTxLimit(lim);
                      setTxPage(1);
                    }}
                    itemLabel="giao dịch"
                    theme="dark"
                    onPageChange={(p) => setTxPage(p)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: CHỈNH SỬA ĐƠN HÀNG KHI HẾT MÓN / SAI GIÁ (Image 2) */}
      {/* ===================================================================== */}
      {showModifyModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Chỉnh sửa đơn hàng</h3>
                <p className="text-xs text-slate-400">Mã đơn: #{selectedOrder._id?.slice(-6).toUpperCase()}</p>
              </div>
              <button onClick={() => setShowModifyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cảnh báo nghiêm ngặt theo quy chuẩn FoodFast Partner */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Vui lòng gọi cho khách để thông báo thay đổi:</span>
              </p>
              <p>• Quán có thể bị phạt nếu không thông báo cho khách hàng trước.</p>
              <p>• Đơn hàng chỉ được phép chỉnh sửa tối đa 1 lần duy nhất.</p>
            </div>

            {/* Chọn lý do chỉnh sửa (Image 2) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Lý do chỉnh sửa (*):</label>
              <div className="grid grid-cols-2 gap-2">
                {['Món đã hết', 'Sai giá món'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setModifyReason(r)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                      modifyReason === r
                        ? 'bg-orange-600/20 text-orange-400 border-orange-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách món và nút xóa món đã hết */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Danh sách món trong đơn:</label>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                {modifyingItems.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{it.quantity || 1}x {it.name}</p>
                      <p className="text-orange-400 font-semibold">{formatVND(it.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveModifyingItem(idx)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 font-bold transition-colors cursor-pointer"
                    >
                      Xóa món hết
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleConfirmModifyOrder}
              disabled={modifyingItems.length === 0}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              Xác nhận chỉnh sửa đơn hàng
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: SẮP XẾP THỨ TỰ DANH MỤC MÓN (Image 5) */}
      {/* ===================================================================== */}
      {showCategoryOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Vị trí danh mục món ăn</h3>
              <button onClick={() => setShowCategoryOrderModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Điều chỉnh các mũi tên $\uparrow \downarrow$ để sắp xếp nhóm danh mục xuất hiện trước mắt khách hàng.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {editingCategories.map((cat, idx) => (
                <div key={cat.id} className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{idx + 1}. {cat.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveCategory(idx, -1)}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === editingCategories.length - 1}
                      onClick={() => handleMoveCategory(idx, 1)}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddCategory}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
              >
                + Thêm nhóm
              </button>
              <button
                type="button"
                onClick={handleSaveCategoryOrder}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Lưu vị trí danh mục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CÀI ĐẶT QUÁN BẬN (Image 15) */}
      {/* ===================================================================== */}
      {showBusyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Cài đặt trạng thái Quán Bận</h3>
              <button onClick={() => setShowBusyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Tính năng tạm thời ngừng nhận đơn cho những khung giờ cao điểm hoặc bếp quá tải.
            </p>

            <div className="space-y-2">
              {[
                { id: '30', label: '30 phút' },
                { id: '60', label: '60 phút' },
                { id: 'today', label: 'Hết hôm nay' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBusyDuration(opt.id)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer ${
                    busyDuration === opt.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleApplyBusyMode}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Xác nhận Quán Bận
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: RÚT TIỀN THỦ CÔNG & BÀN PHÍM PIN 6 SỐ (Images 17, 18) */}
      {/* ===================================================================== */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Rút tiền về tài khoản ngân hàng</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BƯỚC 1: NHẬP SỐ TIỀN RÚT */}
            {withdrawStep === 'amount' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <span className="text-slate-400">Số dư khả dụng:</span>
                  <p className="text-xl font-black text-emerald-400">
                    {formatVND(realMetrics.availableBalance)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Số tiền muốn rút (VNĐ):</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Tối thiểu 100.000đ"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(String(realMetrics.availableBalance))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-orange-600/20 text-orange-400 text-xs font-bold hover:bg-orange-600/30"
                    >
                      Rút toàn bộ
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1 text-slate-400">
                  <p className="font-bold text-white">Ngân hàng nhận tiền:</p>
                  <p>{store.wallet?.bankAccount?.bankName || store.bankName || 'Chưa cập nhật'} • {store.wallet?.bankAccount?.accountNumber || store.bankAccountNumber || 'Chưa có STK'}</p>
                  <p>Chủ thụ hưởng: {store.wallet?.bankAccount?.accountHolder || store.bankAccountHolder || store.representativeName || 'Chưa cập nhật'}</p>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToPin}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  Tiếp tục xác thực PIN
                </button>
              </div>
            )}

            {/* BƯỚC 2: BÀN PHÍM SỐ BẢO MẬT NHẬP MÃ PIN 6 SỐ (Image 18) */}
            {withdrawStep === 'pin' && (
              <div className="space-y-5 text-center">
                <div className="space-y-1">
                  <KeyRound className="w-8 h-8 text-orange-400 mx-auto" />
                  <h4 className="font-bold text-white text-base">Nhập mã PIN bảo mật</h4>
                  <p className="text-xs text-slate-400">Nhập mã PIN 6 số để xác nhận lệnh rút tiền về ví</p>
                </div>

                {/* 6 ô tròn mã PIN */}
                <div className="flex items-center justify-center gap-3 py-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        enteredPin.length > i
                          ? 'bg-orange-500 border-orange-500 scale-110'
                          : 'border-slate-600 bg-transparent'
                      }`}
                    />
                  ))}
                </div>

                {pinError && (
                  <p className="text-xs text-rose-400 font-semibold">{pinError}</p>
                )}

                {/* Bàn phím số bảo mật 0 - 9 */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handlePinKeyPress(String(digit))}
                      className="h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-extrabold text-lg transition-all border border-slate-700/60 flex items-center justify-center"
                    >
                      {digit}
                    </button>
                  ))}
                  <div />
                  <button
                    type="button"
                    onClick={() => handlePinKeyPress('0')}
                    className="h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-extrabold text-lg transition-all border border-slate-700/60 flex items-center justify-center"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinDelete}
                    className="h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-sm transition-all border border-slate-700/60 flex items-center justify-center"
                  >
                    ⌫
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  (Mã PIN mặc định ban đầu: 123456)
                </p>
              </div>
            )}

            {/* BƯỚC 3: THÔNG BÁO RÚT TIỀN THÀNH CÔNG (Image 18) */}
            {withdrawStep === 'success' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-white text-lg">Yêu cầu rút tiền thành công!</h4>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 text-left text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số tiền rút:</span>
                    <span className="font-bold text-emerald-400">{formatVND(withdrawAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mã giao dịch:</span>
                    <span className="font-mono">{lastPayoutRecord?.code || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thời gian nhận tiền:</span>
                    <span>Từ 2 - 4 ngày làm việc</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm"
                >
                  Đã xong
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: THÊM / SỬA NHÓM TOPPING (Images 7, 8) */}
      {/* ===================================================================== */}
      {showToppingGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingToppingGroup ? 'Chỉnh sửa Nhóm Topping' : 'Thêm Nhóm Topping mới'}
              </h3>
              <button onClick={() => setShowToppingGroupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Tên Nhóm / Trường chính (*):</label>
                <input
                  type="text"
                  value={toppingGroupForm.name}
                  onChange={(e) => setToppingGroupForm({ ...toppingGroupForm, name: e.target.value })}
                  placeholder="VD: Kích cỡ (Size), Mức ngọt (Đường), Mức lạnh (Đá), Topping..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                />
              </div>

              {/* Mẫu gợi ý nhanh chuẩn FoodFast */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Gợi ý tạo nhanh:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setToppingGroupForm({
                        name: 'Kích cỡ (Size)',
                        layout: 'VERTICAL',
                        isRequired: true,
                        minChoices: 1,
                        maxChoices: 1,
                        toppings: [
                          { id: `top_${Date.now()}_1`, name: 'Size Vừa (M)', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_2`, name: 'Size Lớn (L)', extraPrice: 10000, isAvailable: true }
                        ]
                      })
                    }
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-orange-600/30 text-[11px] text-orange-400 border border-slate-700"
                  >
                    + Size (M, L - Dọc lớn)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setToppingGroupForm({
                        name: 'Mức ngọt (Đường)',
                        layout: 'HORIZONTAL',
                        isRequired: true,
                        minChoices: 1,
                        maxChoices: 1,
                        toppings: [
                          { id: `top_${Date.now()}_1`, name: '100% Đường', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_2`, name: '70% Đường (Chuẩn)', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_3`, name: '50% Đường', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_4`, name: '30% Đường', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_5`, name: 'Không đường', extraPrice: 0, isAvailable: true }
                        ]
                      })
                    }
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-orange-600/30 text-[11px] text-orange-400 border border-slate-700"
                  >
                    + Đường (Ngang nhỏ)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setToppingGroupForm({
                        name: 'Mức lạnh (Đá)',
                        layout: 'HORIZONTAL',
                        isRequired: true,
                        minChoices: 1,
                        maxChoices: 1,
                        toppings: [
                          { id: `top_${Date.now()}_1`, name: '100% Đá', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_2`, name: '70% Đá (Chuẩn)', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_3`, name: '50% Đá', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_4`, name: 'Ít đá', extraPrice: 0, isAvailable: true },
                          { id: `top_${Date.now()}_5`, name: 'Không đá', extraPrice: 0, isAvailable: true }
                        ]
                      })
                    }
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-orange-600/30 text-[11px] text-orange-400 border border-slate-700"
                  >
                    + Đá (Ngang nhỏ)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setToppingGroupForm({
                        name: 'Topping gọi thêm',
                        layout: 'VERTICAL',
                        isRequired: false,
                        minChoices: 0,
                        maxChoices: 99,
                        toppings: [
                          { id: `top_${Date.now()}_1`, name: 'Trân châu đường đen dẻo', extraPrice: 8000, isAvailable: true },
                          { id: `top_${Date.now()}_2`, name: 'Thạch sương sáo thanh mát', extraPrice: 6000, isAvailable: true },
                          { id: `top_${Date.now()}_3`, name: 'Trân châu hoàng kim', extraPrice: 10000, isAvailable: true }
                        ]
                      })
                    }
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-orange-600/30 text-[11px] text-orange-400 border border-slate-700"
                  >
                    + Topping thêm (Dọc lớn)
                  </button>
                </div>
              </div>

              {/* Kiểu hiển thị (Định dạng Layout: Dạng dọc lớn vs Dạng ngang nhỏ) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Định dạng hiển thị (*):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setToppingGroupForm({ ...toppingGroupForm, layout: 'VERTICAL' })}
                    className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                      toppingGroupForm.layout !== 'HORIZONTAL'
                        ? 'bg-orange-600/20 text-orange-400 border-orange-500 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🔘</span>
                      <span className="font-extrabold">Dạng dọc lớn</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-400 mt-0.5">
                      Thẻ danh sách dọc kèm giá (Size, Topping, Nước sốt)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setToppingGroupForm({ ...toppingGroupForm, layout: 'HORIZONTAL' })}
                    className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                      toppingGroupForm.layout === 'HORIZONTAL'
                        ? 'bg-orange-600/20 text-orange-400 border-orange-500 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>🔲</span>
                      <span className="font-extrabold">Dạng ngang nhỏ</span>
                    </div>
                    <p className="text-[10px] font-normal text-slate-400 mt-0.5">
                      Các nút bấm bo tròn nằm ngang (Đường, Đá, Độ cay)
                    </p>
                  </button>
                </div>
              </div>

              {/* Quyền tùy chọn (Image 8) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Quyền tùy chọn của khách (*):</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setToppingGroupForm({ ...toppingGroupForm, isRequired: true, minChoices: 1, maxChoices: 1 })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                      toppingGroupForm.isRequired && toppingGroupForm.maxChoices === 1
                        ? 'bg-orange-600/20 text-orange-400 border-orange-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Bắt buộc chọn 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setToppingGroupForm({ ...toppingGroupForm, isRequired: false, minChoices: 0, maxChoices: 1 })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                      !toppingGroupForm.isRequired && toppingGroupForm.maxChoices === 1
                        ? 'bg-orange-600/20 text-orange-400 border-orange-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Tùy chọn (Chọn 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setToppingGroupForm({ ...toppingGroupForm, isRequired: false, minChoices: 0, maxChoices: 99 })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                      toppingGroupForm.maxChoices > 1
                        ? 'bg-orange-600/20 text-orange-400 border-orange-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Chọn nhiều (Topping)
                  </button>
                </div>
              </div>

              {/* Danh sách các Topping trong nhóm */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Các lựa chọn / Topping trong nhóm:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const toppings = [...toppingGroupForm.toppings];
                      toppings.push({ id: `top_${Date.now()}`, name: '', extraPrice: 0, isAvailable: true });
                      setToppingGroupForm({ ...toppingGroupForm, toppings });
                    }}
                    className="text-xs text-orange-400 font-bold hover:underline"
                  >
                    + Thêm dòng
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {toppingGroupForm.toppings.map((top, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={top.name}
                        onChange={(e) => {
                          const toppings = [...toppingGroupForm.toppings];
                          toppings[idx].name = e.target.value;
                          setToppingGroupForm({ ...toppingGroupForm, toppings });
                        }}
                        placeholder="VD: Size L / Trân châu"
                        className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                      />
                      <input
                        type="number"
                        value={top.extraPrice}
                        onChange={(e) => {
                          const toppings = [...toppingGroupForm.toppings];
                          toppings[idx].extraPrice = Number(e.target.value);
                          setToppingGroupForm({ ...toppingGroupForm, toppings });
                        }}
                        placeholder="+Giá"
                        className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-orange-400 font-bold text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const toppings = toppingGroupForm.toppings.filter((_, i) => i !== idx);
                          setToppingGroupForm({ ...toppingGroupForm, toppings });
                        }}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveToppingGroup}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Lưu Nhóm Topping
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: THÊM / SỬA MÓN ĂN (Images 3, 4, 6, 8) */}
      {/* ===================================================================== */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món mới vào thực đơn'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs bên trong modal thêm món: Thông tin cơ bản | Giờ bán | Nhóm Topping */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              {[
                { id: 'basic', label: '1. Thông tin cơ bản' },
                { id: 'hours', label: '2. Giờ bán (Image 6)' },
                { id: 'toppings', label: '3. Nhóm Topping (Image 8)' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setItemModalTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    itemModalTab === tab.id
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Thông tin cơ bản */}
            {itemModalTab === 'basic' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Tên món ăn (*):</label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="VD: Trà Sữa Oolong Nướng, Cơm Tấm Sườn..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Giá bán (VNĐ) (*):</label>
                    <input
                      type="number"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                      placeholder="35000"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">Danh mục:</label>
                      <button
                        type="button"
                        onClick={handleQuickAddCategory}
                        className="text-[11px] text-orange-400 hover:text-orange-300 font-medium flex items-center gap-0.5 transition-colors cursor-pointer"
                        title="Tạo danh mục mới nhanh"
                      >
                        <Plus className="w-3 h-3" />
                        Thêm danh mục
                      </button>
                    </div>
                    <select
                      value={itemForm.categoryId}
                      onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">Chọn danh mục</option>
                      {availableCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phần Chọn & Xem trước Ảnh món ăn */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                      Ảnh món ăn:
                    </label>
                    {/* Bộ chuyển chế độ: Tải từ máy vs Dán link URL */}
                    <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDishImageMode('upload')}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          dishImageMode === 'upload'
                            ? 'bg-orange-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Upload className="w-3 h-3" />
                        Tải từ máy
                      </button>
                      <button
                        type="button"
                        onClick={() => setDishImageMode('url')}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          dishImageMode === 'url'
                            ? 'bg-orange-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <LinkIcon className="w-3 h-3" />
                        Dán URL
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    {/* Khung Xem trước (Preview Thumbnail) */}
                    <div className="relative group shrink-0">
                      <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden flex items-center justify-center relative shadow-inner">
                        {itemForm.image && !dishImageError ? (
                          <img
                            src={itemForm.image}
                            alt="Preview món"
                            className="w-full h-full object-cover"
                            onError={() => setDishImageError(true)}
                            onLoad={() => setDishImageError(false)}
                          />
                        ) : dishImageError ? (
                          <div className="flex flex-col items-center justify-center p-2 text-rose-400 text-center">
                            <AlertCircle className="w-5 h-5 mb-1" />
                            <span className="text-[9px] leading-tight font-medium">Link ảnh lỗi</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500 text-center p-2">
                            <ImageIcon className="w-6 h-6 mb-1 text-slate-600" />
                            <span className="text-[9px] leading-tight">Chưa có ảnh</span>
                          </div>
                        )}

                        {/* Nút xóa ảnh khi đã có ảnh */}
                        {itemForm.image && (
                          <button
                            type="button"
                            onClick={() => {
                              setItemForm({ ...itemForm, image: '' });
                              setDishImageError(false);
                              if (dishFileInputRef.current) dishFileInputRef.current.value = '';
                            }}
                            className="absolute top-1 right-1 p-1 rounded-md bg-black/75 hover:bg-rose-600 text-slate-300 hover:text-white transition-all shadow cursor-pointer"
                            title="Gỡ ảnh này"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}

                        {/* Spinner khi đang upload */}
                        {uploadingDishImage && (
                          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-orange-400">
                            <Loader2 className="w-6 h-6 animate-spin mb-1" />
                            <span className="text-[9px] font-bold">Đang tải...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Khung Thao tác nhập liệu theo Chế độ */}
                    <div className="flex-1 min-w-0">
                      {dishImageMode === 'upload' ? (
                        <div>
                          <input
                            ref={dishFileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={handleDishFileUpload}
                          />
                          <div
                            onClick={() => !uploadingDishImage && dishFileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-3.5 text-center cursor-pointer transition-all ${
                              uploadingDishImage
                                ? 'border-orange-500 bg-orange-950/20'
                                : 'border-slate-700 hover:border-orange-500 bg-slate-800/60 hover:bg-slate-800'
                            }`}
                          >
                            {uploadingDishImage ? (
                              <div className="flex items-center justify-center gap-2 text-orange-400 text-xs">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang xử lý & lưu vào Cloudinary CDN...</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-orange-400">
                                  <Upload className="w-4 h-4" />
                                  <span>Chọn ảnh từ máy tính</span>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  Hỗ trợ JPG, PNG, WebP (Tối đa 5MB) • Tự động nén & tối ưu CDN
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <input
                              type="text"
                              value={itemForm.image}
                              onChange={(e) => {
                                setItemForm({ ...itemForm, image: e.target.value.trim() });
                                setDishImageError(false);
                              }}
                              placeholder="Dán link ảnh: https://..."
                              className="w-full pl-8 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                            />
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                            {itemForm.image && (
                              <button
                                type="button"
                                onClick={() => {
                                  setItemForm({ ...itemForm, image: '' });
                                  setDishImageError(false);
                                }}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Dán đường dẫn ảnh HTTPS trực tiếp từ website của bạn hoặc nguồn ảnh trực tuyến.
                          </p>
                        </div>
                      )}

                      {/* Gợi ý / Trạng thái ảnh */}
                      {itemForm.image && itemForm.image.includes('cloudinary.com') && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Ảnh đã được lưu trữ an toàn trên Cloudinary CDN</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Mô tả món ăn:</label>
                  <textarea
                    rows={2}
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    placeholder="Mô tả hương vị, thành phần nguyên liệu..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Cài đặt giờ bán cho món (Image 6) */}
            {itemModalTab === 'hours' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-400">
                  Cài đặt khung giờ và các ngày trong tuần được phép bán món này.
                </p>

                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemForm.sellingHours?.isAllDay}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          sellingHours: { ...itemForm.sellingHours, isAllDay: e.target.checked }
                        })
                      }
                      className="rounded text-orange-600 focus:ring-0"
                    />
                    <span className="font-bold text-white">Bán cả ngày (Khi quán mở cửa)</span>
                  </label>
                </div>

                {!itemForm.sellingHours?.isAllDay && (
                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
                    <p className="font-bold text-white">Khung giờ bán tùy chỉnh:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={itemForm.sellingHours?.shifts?.[0]?.start || '07:00'}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            sellingHours: {
                              ...itemForm.sellingHours,
                              shifts: [{ start: e.target.value, end: itemForm.sellingHours?.shifts?.[0]?.end || '10:00' }]
                            }
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                      />
                      <span className="text-slate-400">đến</span>
                      <input
                        type="time"
                        value={itemForm.sellingHours?.shifts?.[0]?.end || '10:00'}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            sellingHours: {
                              ...itemForm.sellingHours,
                              shifts: [{ start: itemForm.sellingHours?.shifts?.[0]?.start || '07:00', end: e.target.value }]
                            }
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Liên kết Nhóm Topping vào món (Image 8) */}
            {itemModalTab === 'toppings' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-400">
                  Tick chọn các Nhóm Topping áp dụng khi khách hàng đặt món này:
                </p>

                {(store.toppingGroups || []).length === 0 ? (
                  <p className="text-slate-500 py-3 text-center">
                    Quán chưa tạo Nhóm Topping nào. Hãy sang tab "Nhóm Topping" để tạo trước!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {store.toppingGroups.map((tg) => {
                      const isLinked = itemForm.linkedToppingGroupIds?.includes(tg.id);
                      return (
                        <label
                          key={tg.id}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isLinked
                              ? 'bg-orange-600/10 border-orange-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={(e) => {
                                let linked = [...(itemForm.linkedToppingGroupIds || [])];
                                if (e.target.checked) {
                                  linked.push(tg.id);
                                } else {
                                  linked = linked.filter((id) => id !== tg.id);
                                }
                                setItemForm({ ...itemForm, linkedToppingGroupIds: linked });
                              }}
                              className="rounded text-orange-600 focus:ring-0"
                            />
                            <div>
                              <p className="font-bold">{tg.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {tg.isRequired ? 'Bắt buộc chọn' : 'Tùy chọn thêm'} • {tg.toppings?.length || 0} mục
                              </p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSaveMenuItem}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Lưu món ăn
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 7: THÊM NHÂN VIÊN MỚI (Image 16) */}
      {/* ===================================================================== */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Thêm tài khoản nhân viên</h3>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Tên nhân viên (*):</label>
                <input
                  type="text"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="Điền tên đầy đủ"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Số điện thoại nhân viên (*):</label>
                <div className="flex items-center mt-1">
                  <span className="px-3 py-2 bg-slate-800 border border-r-0 border-slate-700 rounded-l-xl text-slate-400 text-xs font-bold">
                    +84
                  </span>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="Điền SĐT không gồm số 0 (VD: 969535231)"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-r-xl text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Chỉ định vai trò (*):</label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                >
                  <option value="STAFF">Nhân viên (Staff - Nhận đơn, chuẩn bị món, hết món)</option>
                  <option value="MANAGER">Quản lý (Manager - Toàn quyền quản lý quán)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleAddStaff}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Lưu tài khoản nhân viên
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 8: THÊM LỊCH NGÀY LỄ ĐẶC BIỆT (Images 12 - 14) */}
      {/* ===================================================================== */}
      {showSpecialScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Cài đặt lịch dịp đặc biệt</h3>
              <button onClick={() => setShowSpecialScheduleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Ngày áp dụng (*):</label>
                <input
                  type="date"
                  value={specialScheduleForm.date}
                  onChange={(e) => setSpecialScheduleForm({ ...specialScheduleForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Trạng thái quán (*):</label>
                <select
                  value={specialScheduleForm.status}
                  onChange={(e) => setSpecialScheduleForm({ ...specialScheduleForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs mt-1"
                >
                  <option value="CLOSED">Đóng cửa cả ngày</option>
                  <option value="OPEN">Mở theo khung giờ riêng</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleAddSpecialSchedule}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Lưu lịch đặc biệt
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 9: TRUNG TÂM THÔNG BÁO TỪ QUẢN TRỊ VIÊN FOODFAST */}
      {/* ===================================================================== */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Thông báo từ Ban quản trị</h3>
                  <p className="text-xs text-slate-400">Các thông báo, cảnh báo vi phạm và trạng thái hoạt động của quán</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {(!notifications || notifications.length === 0) ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Bell className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold">Hiện chưa có thông báo nào từ Quản trị viên</p>
                  <p className="text-xs text-slate-500">Mọi cảnh báo hoặc thay đổi trạng thái quán sẽ được gửi về đây.</p>
                </div>
              ) : (
                paginatedNotifications.items.map((notif, idx) => {
                  const isBan = notif.type === 'BAN';
                  const isUnban = notif.type === 'UNBAN';
                  const isWarning = notif.type === 'WARNING';
                  const isWallet = notif.type === 'WALLET';

                  return (
                    <div
                      key={notif.id || notif._id || idx}
                      className={`p-4 rounded-2xl border transition-all space-y-2 ${
                        isBan
                          ? 'bg-red-950/40 border-red-500/40 text-red-100'
                          : isUnban
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                          : isWallet
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                          : isWarning
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-100'
                          : 'bg-slate-800/60 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isBan && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white flex items-center gap-1 shrink-0">
                              <Lock className="w-2.5 h-2.5" /> LỆNH KHÓA QUÁN
                            </span>
                          )}
                          {isUnban && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1 shrink-0">
                              <Unlock className="w-2.5 h-2.5" /> MỞ KHÓA QUÁN
                            </span>
                          )}
                          {isWallet && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1 shrink-0">
                              <Wallet className="w-2.5 h-2.5" /> VÍ ĐỐI TÁC
                            </span>
                          )}
                          {isWarning && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white flex items-center gap-1 shrink-0">
                              <AlertCircle className="w-2.5 h-2.5" /> CẢNH BÁO
                            </span>
                          )}
                          {!isBan && !isUnban && !isWallet && !isWarning && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shrink-0">
                              HỆ THỐNG
                            </span>
                          )}
                          <span className="font-bold text-xs text-white truncate max-w-[220px]">
                            {notif.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {notif.createdAt ? new Date(notif.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed whitespace-pre-wrap opacity-90 pl-1">
                        {notif.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {notifications && notifications.length > 0 && (
              <div className="px-5 py-2 border-t border-slate-800 bg-slate-950/40">
                <Pagination
                  currentPage={paginatedNotifications.page}
                  totalPages={paginatedNotifications.totalPages}
                  totalItems={paginatedNotifications.totalItems}
                  pageSize={paginatedNotifications.pageSize}
                  itemLabel="thông báo"
                  theme="dark"
                  className="border-t-0 pt-2"
                  onPageChange={(p) => setNotifPage(p)}
                />
              </div>
            )}

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 9: TẠO / SỬA VOUCHER QUÁN TỰ TÀI TRỢ (TÍCH HỢP MÔ PHỎNG HỘ KD) */}
      {/* ===================================================================== */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingVoucherId ? 'Chỉnh sửa Voucher của Quán' : 'Tạo Voucher Khuyến Mãi Riêng của Quán'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Miễn phí khởi tạo (0đ) — Chỉ trừ trực tiếp vào doanh thu đơn khi khách đặt thành công.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowVoucherModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Mã Voucher * <span className="text-slate-400 font-normal">(Chữ hoa không dấu)</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingVoucherId}
                    value={voucherForm.code}
                    onChange={(e) =>
                      setVoucherForm({
                        ...voucherForm,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')
                      })
                    }
                    placeholder="VD: QUANGIAM20, DFOOD15K..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-orange-400 font-mono font-bold tracking-wider focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Tiêu đề hiển thị cho khách *</label>
                  <input
                    type="text"
                    required
                    value={voucherForm.title}
                    onChange={(e) => setVoucherForm({ ...voucherForm, title: e.target.value })}
                    placeholder="VD: Giảm 20.000đ cho đơn từ 100.000đ"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVoucherForm({ ...voucherForm, discount_type: 'FIXED_AMOUNT' })}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
                    voucherForm.discount_type === 'FIXED_AMOUNT'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <DollarSign className="w-4 h-4" /> Giảm số tiền cố định (đ)
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherForm({ ...voucherForm, discount_type: 'PERCENTAGE' })}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
                    voucherForm.discount_type === 'PERCENTAGE'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Percent className="w-4 h-4" /> Giảm theo phần trăm (%)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Giá trị giảm * {voucherForm.discount_type === 'PERCENTAGE' ? '(%)' : '(VNĐ)'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={voucherForm.discount_type === 'PERCENTAGE' ? 100 : 10000000}
                    value={voucherForm.discount_value}
                    onChange={(e) => setVoucherForm({ ...voucherForm, discount_value: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-orange-500"
                  />
                </div>
                {voucherForm.discount_type === 'PERCENTAGE' ? (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Giảm tối đa (VNĐ)</label>
                    <input
                      type="number"
                      min={0}
                      value={voucherForm.max_discount_amount}
                      onChange={(e) => setVoucherForm({ ...voucherForm, max_discount_amount: e.target.value })}
                      placeholder="VD: 30000"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Số lượt phát hành (Quota) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={voucherForm.usage_limit}
                      onChange={(e) => setVoucherForm({ ...voucherForm, usage_limit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Giá trị đơn hàng tối thiểu (Min Order VNĐ) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={voucherForm.min_order_value}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setVoucherForm({ ...voucherForm, min_order_value: val });
                      if (val > 0) setSimOrderAmount(val);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-orange-500"
                  />
                  {/* Nút chọn nhanh Mẹo cài Min Order */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[60000, 100000, 120000, 150000, 200000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setVoucherForm({ ...voucherForm, min_order_value: preset });
                          setSimOrderAmount(preset);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          Number(voucherForm.min_order_value) === preset
                            ? 'bg-orange-600 text-white border-orange-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        Từ {preset / 1000}k
                      </button>
                    ))}
                  </div>
                </div>

                {voucherForm.discount_type === 'PERCENTAGE' ? (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Số lượt phát hành (Quota) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={voucherForm.usage_limit}
                      onChange={(e) => setVoucherForm({ ...voucherForm, usage_limit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-orange-500"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Ngày bắt đầu</label>
                      <input
                        type="datetime-local"
                        value={voucherForm.start_date}
                        onChange={(e) => setVoucherForm({ ...voucherForm, start_date: e.target.value })}
                        className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Ngày hết hạn</label>
                      <input
                        type="datetime-local"
                        value={voucherForm.end_date}
                        onChange={(e) => setVoucherForm({ ...voucherForm, end_date: e.target.value })}
                        className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-[11px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {voucherForm.discount_type === 'PERCENTAGE' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Ngày bắt đầu</label>
                    <input
                      type="datetime-local"
                      value={voucherForm.start_date}
                      onChange={(e) => setVoucherForm({ ...voucherForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Ngày hết hạn</label>
                    <input
                      type="datetime-local"
                      value={voucherForm.end_date}
                      onChange={(e) => setVoucherForm({ ...voucherForm, end_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* BỘ MÔ PHỎNG LỢI NHUẬN THỰC NHẬN & THUẾ HỘ KINH DOANH */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                    <Calculator className="w-4 h-4" />
                    Mô phỏng Tiền Quán Nhận &amp; Thuế ({store.merchantType === 'ENTERPRISE' ? 'Doanh nghiệp' : 'Hộ Kinh Doanh'})
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Giả lập đơn hàng:</span>
                    <input
                      type="number"
                      min={10000}
                      step={10000}
                      value={simOrderAmount}
                      onChange={(e) => setSimOrderAmount(Number(e.target.value) || 0)}
                      className="w-24 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-right"
                    />
                    <span className="text-slate-400">đ</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] border-t border-slate-800 pt-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Giá gốc món ăn:</span>
                    <span className="font-semibold">{formatVND(liveVoucherSimulation.grossFoodTotal)}</span>
                  </div>
                  <div className="flex justify-between text-amber-300">
                    <span>(-) Voucher Quán tài trợ (Trừ vào doanh thu tính thuế):</span>
                    <span className="font-semibold">-{formatVND(liveVoucherSimulation.storeVoucherDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-200">
                    <span>(=) Giá sau giảm (Doanh thu tính chiết khấu &amp; thuế):</span>
                    <span className="font-bold">{formatVND(liveVoucherSimulation.taxableRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-rose-300">
                    <span>(-) Phí chiết khấu sàn ({Math.round(liveVoucherSimulation.commissionRate * 100)}%):</span>
                    <span>-{formatVND(liveVoucherSimulation.platformCommission)}</span>
                  </div>
                  {liveVoucherSimulation.isTaxWithheld && (
                    <div className="flex justify-between text-rose-300">
                      <span>(-) Thuế khấu trừ hộ Hộ KD (1% GTGT + 0.5% TNCN = 1.5%):</span>
                      <span>-{formatVND(liveVoucherSimulation.withholdingTax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-800 text-emerald-400 font-black text-sm">
                    <span>
                      (=) Số tiền đổ về Ví FoodFast của Quán:
                      {liveVoucherSimulation.isTaxWithheld && (
                        <span className="block text-[10px] font-normal text-slate-400">
                          (Chưa tính thuế: {formatVND(liveVoucherSimulation.beforeTaxAmount)})
                        </span>
                      )}
                    </span>
                    <span>{formatVND(liveVoucherSimulation.netMerchant)}</span>
                  </div>
                </div>

                {liveVoucherSimulation.taxSavedByStoreVoucher > 0 && (
                  <p className="text-[10px] text-emerald-400/90 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Nhờ giảm trừ doanh thu tính thuế, bạn không bị đóng {formatVND(liveVoucherSimulation.taxSavedByStoreVoucher)} tiền thuế &amp; giảm {formatVND(liveVoucherSimulation.commissionSavedByStoreVoucher)} phí chiết khấu trên phần đã tặng khách!
                    </span>
                  </p>
                )}

                {/* Cảnh báo mẹo cài Giá trị đơn hàng tối thiểu */}
                {(Number(voucherForm.min_order_value) === 0 ||
                  liveVoucherSimulation.netMerchant < liveVoucherSimulation.grossFoodTotal * 0.4) && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Mẹo cho quán:</strong> Bạn nên cài đặt kèm <em>"Giá trị đơn hàng tối thiểu"</em> (VD: Giảm 15k cho đơn từ 120k) để đảm bảo sau khi trừ Voucher, Chiết khấu sàn và Thuế Hộ KD, quán vẫn giữ được mức biên lợi nhuận tối ưu.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={submittingVoucher}
                  onClick={() => setShowVoucherModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingVoucher}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-600/25 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingVoucher ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> {editingVoucherId ? 'Lưu Thay Đổi' : 'Phát Hành Voucher (0đ phí)'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
