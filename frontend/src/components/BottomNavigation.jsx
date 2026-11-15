import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Compass,
  ShoppingBag,
  Flame,
  Store,
  ShieldCheck,
  User,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { storeApi, checkInApi } from '../api/client';
import DailyCheckInModal from './DailyCheckInModal';
import UserAvatar from './UserAvatar';

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { totalItems } = useCart();
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [isCheckedInToday, setIsCheckedInToday] = useState(false);
  const [checkingStore, setCheckingStore] = useState(false);

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

  // Xử lý điều hướng Cửa hàng / Quản trị
  const handleStoreNavigation = async () => {
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
    } catch {
      navigate('/merchant/register');
    } finally {
      setCheckingStore(false);
    }
  };

  const pathname = location.pathname;
  const isHome = pathname === '/';
  const isOrders = pathname.startsWith('/orders') || pathname === '/cart' || pathname === '/checkout';
  const isStore = pathname.startsWith('/merchant') || pathname.startsWith('/admin');
  const isProfile = pathname === '/profile' || pathname === '/login' || pathname === '/register';

  return (
    <>
      <nav
        aria-label="Thanh điều hướng di động"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f7f4ee]/95 dark:bg-[#1c1916]/95 backdrop-blur-md border-t border-[rgba(43,39,33,0.14)] dark:border-[rgba(240,234,224,0.12)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] transition-colors select-none pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="grid grid-cols-5 h-15 items-center px-1">
          {/* 1. Trang Chủ */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer ${
              isHome
                ? 'text-[#9a6a3e] dark:text-[#f5c542] font-black'
                : 'text-[#2b2721]/60 dark:text-[#ede6d8]/60 hover:text-[#9a6a3e]'
            }`}
          >
            <Compass className={`w-5 h-5 ${isHome ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] leading-tight font-medium">Trang chủ</span>
          </button>

          {/* 2. Đơn Hàng / Giỏ */}
          <button
            type="button"
            onClick={() => navigate('/orders?tab=cart')}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer ${
              isOrders
                ? 'text-[#9a6a3e] dark:text-[#f5c542] font-black'
                : 'text-[#2b2721]/60 dark:text-[#ede6d8]/60 hover:text-[#9a6a3e]'
            }`}
          >
            <div className="relative">
              <ShoppingBag className={`w-5 h-5 ${isOrders ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-[#9a6a3e] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight font-medium">Đơn hàng</span>
          </button>

          {/* 3. Điểm Danh Nhận Xu (Nổi bật ở giữa chuẩn ứng dụng) */}
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                navigate('/login');
              } else {
                setShowCheckInModal(true);
              }
            }}
            className="flex flex-col items-center justify-center gap-0.5 py-1 transition-transform active:scale-95 cursor-pointer text-[#845831] dark:text-[#f5c542]"
          >
            <div className="relative w-10 h-10 -mt-3.5 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/25 border-2 border-[#f7f4ee] dark:border-[#1c1916]">
              <Flame className="w-5 h-5 text-white fill-white animate-pulse" />
              {isAuthenticated && !isCheckedInToday && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute -top-0.5 -right-0.5" />
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white absolute -top-0.5 -right-0.5" />
                </>
              )}
            </div>
            <span className="text-[10px] leading-tight font-extrabold text-[#9a6a3e] dark:text-[#f5c542]">Điểm danh</span>
          </button>

          {/* 4. Quán Tôi / Quản Trị */}
          <button
            type="button"
            onClick={handleStoreNavigation}
            disabled={checkingStore}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer ${
              isStore
                ? 'text-[#9a6a3e] dark:text-[#f5c542] font-black'
                : 'text-[#2b2721]/60 dark:text-[#ede6d8]/60 hover:text-[#9a6a3e]'
            }`}
          >
            {checkingStore ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : user?.role === 'ADMIN' ? (
              <ShieldCheck className={`w-5 h-5 ${isStore ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            ) : (
              <Store className={`w-5 h-5 ${isStore ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            )}
            <span className="text-[10px] leading-tight font-medium">
              {user?.role === 'ADMIN' ? 'Quản trị' : 'Quán tôi'}
            </span>
          </button>

          {/* 5. Tài Khoản / Tôi */}
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? '/profile' : '/login')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer ${
              isProfile
                ? 'text-[#9a6a3e] dark:text-[#f5c542] font-black'
                : 'text-[#2b2721]/60 dark:text-[#ede6d8]/60 hover:text-[#9a6a3e]'
            }`}
          >
            {isAuthenticated && user?.avatar ? (
              <div className="w-5 h-5 rounded-full overflow-hidden border border-[#9a6a3e]">
                <UserAvatar src={user.avatar} name={user.name} className="w-full h-full object-cover text-[8px]" />
              </div>
            ) : (
              <User className={`w-5 h-5 ${isProfile ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            )}
            <span className="text-[10px] leading-tight font-medium">
              {isAuthenticated ? 'Tôi' : 'Đăng nhập'}
            </span>
          </button>
        </div>
      </nav>

      {/* Modal Điểm Danh Nhận Xu (đồng bộ trên cả mobile) */}
      <DailyCheckInModal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
      />
    </>
  );
}
