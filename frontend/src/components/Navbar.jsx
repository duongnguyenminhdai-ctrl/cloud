import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, UtensilsCrossed, Store, ShieldCheck, RefreshCw, FileText, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { storeApi } from '../api/client';
import CitySelector from './CitySelector';
import UserProfileModal from './UserProfileModal';
import UserAvatar from './UserAvatar';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [checkingStore, setCheckingStore] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

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
    <header className="sticky top-0 z-50 bg-[#f7f4ee]/95 backdrop-blur-md border-b border-[rgba(43,39,33,0.14)] text-[#2b2721] shadow-2xs">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo chính thức từ Google AI Studio & City Selector */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 drop-shadow-xs">
              <img
                src="/foodfast-logo.png"
                alt="FoodFast Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center">
              <span className="font-serif text-2xl font-normal tracking-wide text-[#2b2721] group-hover:text-[#9a6a3e] transition-colors leading-none">
                FoodFast
              </span>
            </div>
          </Link>

          {/* FoodFast City Selector (Chuẩn 63 Tỉnh Thành) */}
          <div className="flex items-center">
            <CitySelector />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Nút "Cửa hàng của tôi" - Viền cam / chữ cam tiệp theme FoodFast (Ẩn đối với Admin) */}
          {isAuthenticated && user?.role !== 'ADMIN' && (
            <button
              onClick={handleMyStoreClick}
              disabled={checkingStore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgba(154,106,62,0.35)] text-[#9a6a3e] hover:bg-[#ece7dc] font-bold text-xs sm:text-sm transition-all shadow-xs"
              title="Quản lý hoặc mở cửa hàng kinh doanh trên FoodFast"
            >
              {checkingStore ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#9a6a3e]" />
              ) : (
                <Store className="w-4 h-4 text-[#9a6a3e]" />
              )}
              <span className="hidden sm:inline">Cửa hàng của tôi</span>
              <span className="sm:hidden">Quán tôi</span>
            </button>
          )}

          {/* Nút "Quản trị" dành riêng cho tài khoản ADMIN */}
          {isAuthenticated && user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2b2721] text-white hover:bg-[#1a1714] text-xs font-bold border border-[#2b2721] shadow-xs transition-all"
              title="Trang quản trị hệ thống"
            >
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Quản trị</span>
            </Link>
          )}

          {/* Cart Button: Nhấn vào hiển thị Giỏ hàng và các mục trên */}
          <Link
            to="/orders?tab=cart"
            className="relative p-2.5 rounded-xl text-[#2b2721]/80 hover:text-[#9a6a3e] hover:bg-[#ece7dc]/70 transition-colors"
            title="Xem giỏ hàng"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#9a6a3e] text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse shadow-xs">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>

          {/* Chuông Thông Báo Khách Hàng (Shopee Style) */}
          {isAuthenticated && <NotificationBell />}

          {/* Hiển thị số Xu FoodFast tích lũy */}
          {isAuthenticated && (
            <Link
              to="/orders?tab=reviews"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f2ece1] border border-[rgba(154,106,62,0.25)] text-[#845831] font-extrabold text-xs hover:bg-[#ebdcc8] transition-all shadow-2xs"
              title="Số Xu FoodFast tích lũy (Đánh giá đơn hàng để nhận 1.000 Xu)"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>{Number(user?.coins || 0).toLocaleString('vi-VN')} Xu</span>
            </Link>
          )}

          {/* User Profile / Auth */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-[rgba(43,39,33,0.14)]">
              <Link
                to="/profile"
                className="flex items-center gap-2 p-1 px-2 rounded-xl hover:bg-[#ece7dc]/80 transition-all text-right group cursor-pointer"
                title="Xem và cập nhật thông tin tài khoản & Đổi mật khẩu"
              >
                <UserAvatar
                  src={user?.avatar}
                  name={user?.name}
                  fallbackChar="U"
                  className="w-8 h-8 rounded-full text-xs shadow-xs"
                />
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-sm font-semibold text-[#2b2721] group-hover:text-[#9a6a3e] leading-tight transition">
                    {user?.name || 'Khách hàng'}
                  </span>
                  <span className="text-xs text-[#2b2721]/50 font-medium">
                    {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 text-[#2b2721]/60 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-[#2b2721] hover:text-[#9a6a3e] hover:bg-[#ece7dc]/60 rounded-xl transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="hidden sm:inline-block px-4 py-2 text-sm font-semibold text-white bg-[#9a6a3e] hover:bg-[#845831] rounded-xl shadow-md shadow-[#9a6a3e]/20 transition-all hover:shadow-lg"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modal Quản lý thông tin tài khoản */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        isDark={false}
      />
    </header>
  );
}
