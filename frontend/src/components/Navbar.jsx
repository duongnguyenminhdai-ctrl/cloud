import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, UtensilsCrossed, Store, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { storeApi } from '../api/client';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [checkingStore, setCheckingStore] = useState(false);

  // Xử lý sự kiện OnClick nút "Cửa hàng của tôi"
  const handleMyStoreClick = async () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/merchant/register');
      return;
    }

    setCheckingStore(true);
    try {
      const res = await storeApi.getMyStatus();
      if (res.data?.success) {
        const status = res.data.store_status;
        if (status === 'ACTIVE') {
          navigate('/merchant/dashboard');
        } else if (status === 'NOT_REGISTERED') {
          navigate('/merchant/register');
        } else {
          // PENDING hoặc REJECTED: hiển thị màn hình tiến độ duyệt hồ sơ
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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              FoodFast
            </span>
            <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 ml-2 rounded-full bg-orange-100 text-orange-700">
              Cloud Delivery
            </span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Nút "Cửa hàng của tôi" - Viền cam / chữ cam tiệp theme FoodFast */}
          {isAuthenticated && (
            <button
              onClick={handleMyStoreClick}
              disabled={checkingStore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-500/50 text-orange-600 hover:bg-orange-50 font-bold text-xs sm:text-sm transition-all shadow-sm"
              title="Quản lý hoặc mở cửa hàng kinh doanh trên FoodFast"
            >
              {checkingStore ? (
                <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
              ) : (
                <Store className="w-4 h-4 text-orange-600" />
              )}
              <span className="hidden sm:inline">Cửa hàng của tôi</span>
              <span className="sm:hidden">Quán tôi</span>
            </button>
          )}

          {/* Nút "Quản trị" dành riêng cho tài khoản ADMIN */}
          {isAuthenticated && user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold border border-slate-700 shadow-sm transition-all"
              title="Trang quản trị hệ thống"
            >
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Quản trị</span>
            </Link>
          )}

          {/* Cart Button */}
          <Link
            to="/checkout"
            className="relative p-2.5 rounded-xl text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            title="Giỏ hàng"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>

          {/* User Profile / Auth */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-gray-800 leading-tight">
                  {user?.name || 'Khách hàng'}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                </span>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="hidden sm:inline-block px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-600/20 transition-all hover:shadow-lg"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
