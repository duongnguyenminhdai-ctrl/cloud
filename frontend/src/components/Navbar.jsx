import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, UtensilsCrossed, Store, ShieldCheck, RefreshCw, FileText, Coins, Sun, Moon, Flame, CalendarDays, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { storeApi, checkInApi } from '../api/client';
import CitySelector from './CitySelector';
import UserProfileModal from './UserProfileModal';
import UserAvatar from './UserAvatar';
import NotificationBell from './NotificationBell';
import DailyCheckInModal from './DailyCheckInModal';
import FoodRouletteModal from './FoodRouletteModal';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const { theme, isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [checkingStore, setCheckingStore] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showRouletteModal, setShowRouletteModal] = useState(false);
  const [isCheckedInToday, setIsCheckedInToday] = useState(false);

  // Lắng nghe sự kiện mở vòng quay từ Home hoặc các component khác
  useEffect(() => {
    const handleOpenRoulette = () => setShowRouletteModal(true);
    window.addEventListener('open_food_roulette', handleOpenRoulette);
    return () => window.removeEventListener('open_food_roulette', handleOpenRoulette);
  }, []);

  // Tải trạng thái điểm danh hôm nay
  useEffect(() => {
    if (!isAuthenticated) return;
    checkInApi.getCheckInStatus()
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setIsCheckedInToday(Boolean(res.data.data.isCheckedInToday));
        }
      })
      .catch(() => {});
  }, [isAuthenticated, showCheckInModal]);

  // Pre-warm backend & Cập nhật cache trạng thái cửa hàng ngầm ngay khi vào web
  useEffect(() => {
    if (!isAuthenticated || user?.role === 'ADMIN') return;
    const userId = user?.id || user?._id || user?.userId;

    storeApi.getMyStatus()
      .then((res) => {
        if (res.data?.success && res.data.store_status && userId) {
          localStorage.setItem(`foodfast_store_status_${userId}`, res.data.store_status);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, user?.id, user?._id, user?.userId, user?.role]);

  // Xử lý sự kiện OnClick nút "Cửa hàng của tôi"
  const handleMyStoreClick = async () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/merchant/register');
      return;
    }

    if (user?.role === 'ADMIN') {
      navigate('/admin');
      return;
    }

    const userId = user?.id || user?._id || user?.userId;
    const cachedStatus = userId ? localStorage.getItem(`foodfast_store_status_${userId}`) : null;

    // 1. Chuyển trang NGAY LẬP TỨC (0s độ trễ) nếu đã có trạng thái trong cache
    if (cachedStatus === 'ACTIVE') {
      navigate('/merchant/dashboard');
      return;
    } else if (cachedStatus === 'PENDING' || cachedStatus === 'REJECTED') {
      navigate('/merchant/status');
      return;
    } else if (cachedStatus === 'NOT_REGISTERED') {
      navigate('/merchant/register');
      return;
    }

    // 2. Nếu là lần đầu tiên chưa có cache, kiểm tra từ server
    setCheckingStore(true);
    try {
      const res = await storeApi.getMyStatus();
      if (res.data?.success) {
        const status = res.data.store_status;
        if (userId && status) {
          localStorage.setItem(`foodfast_store_status_${userId}`, status);
        }
        if (status === 'ACTIVE') {
          navigate('/merchant/dashboard');
        } else if (status === 'NOT_REGISTERED') {
          navigate('/merchant/register');
        } else {
          navigate('/merchant/status');
        }
      } else {
        navigate('/merchant/register');
      }
    } catch (err) {
      navigate('/merchant/register');
    } finally {
      setCheckingStore(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-[60] bg-[#f7f4ee]/95 dark:bg-[#1c1916]/95 backdrop-blur-md border-b border-[rgba(43,39,33,0.14)] dark:border-[rgba(240,234,224,0.12)] text-[#2b2721] dark:text-[#ede6d8] shadow-2xs transition-colors duration-200 w-full">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3 w-full">
          {/* CỤM 1 (TRÁI): Brand Logo & City Selector */}
          <div className="flex items-center gap-1.5 sm:gap-3.5 shrink-0 min-w-0">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5 group shrink-0">
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 drop-shadow-xs">
                <img
                  src="/foodfast-logo.png"
                  alt="FoodFast Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center">
                <span className="font-serif text-base sm:text-2xl font-normal tracking-wide text-[#2b2721] dark:text-[#ede6d8] group-hover:text-[#9a6a3e] dark:group-hover:text-[#e5b887] transition-colors leading-none">
                  FoodFast
                </span>
              </div>
            </Link>

            {/* City Selector (Chuẩn 63 Tỉnh Thành) */}
            <div className="flex items-center shrink-0">
              <CitySelector />
            </div>
          </div>

          {/* CỤM 2 (PHẢI): Thứ tự chuẩn TMĐT cao cấp (Portal -> Gamification -> Utilities -> User) */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* 1. Portal Hub: "Cửa hàng của tôi" (Merchant) hoặc "Quản trị" (ADMIN) */}
            {isAuthenticated && user?.role !== 'ADMIN' && (
              <button
                type="button"
                onClick={handleMyStoreClick}
                disabled={checkingStore}
                className="hidden md:flex items-center gap-1.5 px-3 h-9 rounded-xl border border-[rgba(154,106,62,0.3)] dark:border-[rgba(229,184,135,0.3)] bg-[#f2ece1]/60 dark:bg-[#26211c]/60 text-[#9a6a3e] dark:text-[#e5b887] hover:bg-[#ece7dc] dark:hover:bg-[#2b2520] font-bold text-xs transition-all shadow-2xs cursor-pointer"
                title="Quản lý hoặc mở cửa hàng kinh doanh trên FoodFast"
              >
                {checkingStore ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#9a6a3e] dark:text-[#e5b887]" />
                ) : (
                  <Store className="w-3.5 h-3.5 text-[#9a6a3e] dark:text-[#e5b887]" />
                )}
                <span>Cửa hàng của tôi</span>
              </button>
            )}

            {isAuthenticated && user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="hidden md:flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#9a6a3e] hover:bg-[#845831] text-white text-xs font-bold border border-[#845831] shadow-2xs transition-all cursor-pointer"
                title="Trang quản trị hệ thống"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
                <span>Quản trị</span>
              </Link>
            )}

            {/* 1.5. Nút Kích Hoạt "Hôm nay ăn gì?" — Hòm gợi ý chọn món vui vẻ */}
            <button
              type="button"
              onClick={() => setShowRouletteModal(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 h-8 sm:h-9 rounded-xl border border-[#EE4D2D]/30 bg-gradient-to-r from-[#EE4D2D]/10 to-orange-500/10 hover:from-[#EE4D2D]/20 hover:to-orange-500/20 text-[#EE4D2D] dark:text-[#ff6b4a] font-bold text-xs transition-all shadow-2xs cursor-pointer group shrink-0"
              title="Hòm món ngon ngẫu nhiên — Gợi ý ăn gì hôm nay?"
            >
              <Compass className="w-3.5 h-3.5 text-[#EE4D2D] group-hover:rotate-45 transition-transform shrink-0" />
              <span className="hidden sm:inline">Hôm nay ăn gì?</span>
            </button>

            {/* 2. Gamification Capsule: Hợp nhất [🪙 Số dư Xu | 🔥 Điểm danh] thành 1 Pill thanh lịch */}
            {isAuthenticated && (
              <div className="hidden lg:flex items-center h-9 rounded-xl bg-[#f2ece1] dark:bg-[#26211c] border border-[rgba(154,106,62,0.25)] dark:border-[rgba(240,234,224,0.15)] shadow-2xs p-0.5">
                <Link
                  to="/orders?tab=reviews"
                  className="flex items-center gap-1.5 px-2.5 h-full rounded-lg hover:bg-[#e8dfd2] dark:hover:bg-[#312b24] text-[#845831] dark:text-[#e5b887] font-bold text-xs transition-colors"
                  title="Số Xu FoodFast tích lũy (Đánh giá đơn hàng nhận 1.000 Xu)"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                  <span>{Number(user?.coins || 0).toLocaleString('vi-VN')} Xu</span>
                </Link>
                <div className="w-px h-4 bg-[rgba(154,106,62,0.2)] dark:bg-[rgba(240,234,224,0.12)]" />
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(true)}
                  className="relative flex items-center gap-1.5 px-2.5 h-full rounded-lg hover:bg-[#e8dfd2] dark:hover:bg-[#312b24] text-[#845831] dark:text-[#e5b887] font-bold text-xs transition-colors cursor-pointer group"
                  title="Điểm danh mỗi ngày nhận 500 - 1.000 Xu & Quà mốc tháng"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 group-hover:scale-110 transition-transform shrink-0" />
                  <span>Điểm danh</span>
                  {!isCheckedInToday && (
                    <span className="relative flex h-2 w-2 ml-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Divider giữa nhóm Gamification/Portal và nhóm Utilities (Desktop) */}
            {isAuthenticated && (
              <div className="hidden md:block w-px h-5 bg-[rgba(43,39,33,0.14)] dark:bg-[rgba(240,234,224,0.12)]" />
            )}

            {/* 3. Tiện ích (Utilities): Cart (chỉ desktop) + Notification Bell + Theme Toggle */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Giỏ hàng (chỉ hiển thị desktop vì mobile đã có Bottom Navigation) */}
              <Link
                to="/orders?tab=cart"
                className="hidden md:flex relative h-9 w-9 rounded-xl items-center justify-center text-[#2b2721]/80 dark:text-[#ede6d8]/80 hover:text-[#9a6a3e] dark:hover:text-[#e5b887] hover:bg-[#ece7dc]/70 dark:hover:bg-[#2b2520]/70 transition-colors"
                title="Xem giỏ hàng của bạn"
              >
                <ShoppingBag className="w-[19px] h-[19px] stroke-[1.75]" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#9a6a3e] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Link>

              {/* Chuông Thông Báo */}
              {isAuthenticated && <NotificationBell />}

              {/* Nút chuyển đổi Light / Dark Mode (Icon-only h-8 w-8 sm:h-9 sm:w-9 gọn gàng tinh tế) */}
              <button
                type="button"
                onClick={toggleTheme}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center border border-[rgba(43,39,33,0.14)] dark:border-[rgba(240,234,224,0.14)] bg-[#f2ece1] dark:bg-[#26211c] text-[#2b2721] dark:text-[#ede6d8] hover:border-[#9a6a3e] dark:hover:border-[#e5b887] hover:bg-[#ece7dc] dark:hover:bg-[#302a24] transition-all shadow-2xs cursor-pointer shrink-0"
                title={`Chuyển sang chế độ ${isDark ? 'Sáng' : 'Tối'}`}
                aria-label="Chuyển chế độ Sáng / Tối"
              >
                {isDark ? (
                  <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 stroke-[1.75]" />
                ) : (
                  <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9a6a3e] stroke-[1.75]" />
                )}
              </button>
            </div>

            {/* Divider giữa nhóm Tiện ích và User Hub */}
            <div className="w-px h-4 sm:h-5 bg-[rgba(43,39,33,0.14)] dark:bg-[rgba(240,234,224,0.12)] shrink-0" />

            {/* 4. User Profile Hub hoặc Đăng nhập / Đăng ký */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Link
                  to="/profile"
                  className="flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-1 sm:px-2 rounded-lg sm:rounded-xl hover:bg-[#ece7dc]/70 dark:hover:bg-[#2b2520]/70 transition-colors text-right group cursor-pointer shrink-0"
                  title="Xem và cập nhật thông tin tài khoản"
                >
                  <UserAvatar
                    src={user?.avatar}
                    name={user?.name}
                    fallbackChar="U"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs shadow-xs"
                  />
                  <div className="hidden sm:flex flex-col text-left max-w-[120px] lg:max-w-[150px]">
                    <span className="text-xs font-bold text-[#2b2721] dark:text-[#ede6d8] group-hover:text-[#9a6a3e] dark:group-hover:text-[#e5b887] leading-tight truncate transition">
                      {user?.name || 'Khách hàng'}
                    </span>
                    <span className="text-[10px] text-[#2b2721]/50 dark:text-[#ede6d8]/50 font-medium leading-none mt-0.5 truncate">
                      {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center text-[#2b2721]/60 dark:text-[#ede6d8]/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                  title="Đăng xuất"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[1.75]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Link
                  to="/login"
                  className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl flex items-center text-xs font-semibold text-[#2b2721] dark:text-[#ede6d8] hover:text-[#9a6a3e] dark:hover:text-[#e5b887] hover:bg-[#ece7dc]/60 dark:hover:bg-[#2b2520]/60 transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-lg sm:rounded-xl flex items-center text-xs font-bold text-white bg-[#9a6a3e] hover:bg-[#845831] shadow-2xs transition-all"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Quản lý thông tin tài khoản (Tự động Portal ra body với ưu tiên cao nhất) */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        isDark={false}
      />

      {/* Modal Điểm Danh Nhận Xu (Tự động Portal ra body với z-[999999] cao nhất hệ thống) */}
      <DailyCheckInModal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
      />

      {/* Modal Vòng Quay Hôm Nay Ăn Gì (Milestone 3 - R4) */}
      <FoodRouletteModal
        isOpen={showRouletteModal}
        onClose={() => setShowRouletteModal(false)}
      />
    </>
  );
}
