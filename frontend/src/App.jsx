import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import RestaurantDetail from './pages/RestaurantDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Checkout from './pages/Checkout';
import OrderTracking from './pages/OrderTracking';
import OrdersPage from './pages/OrdersPage';
import ProfilePage from './pages/ProfilePage';
import MerchantRegister from './pages/MerchantRegister';
import MerchantStatus from './pages/MerchantStatus';
import MerchantDashboard from './pages/MerchantDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import IntroPage from './pages/IntroPage';

// Bộ kiểm soát Intro Gatekeeper:
// Mọi đường dẫn nhập trên thanh địa chỉ/tìm kiếm trình duyệt đều chuyển tới /intro trước.
// Phải bấm button trực tiếp trên trang Intro thì mới được mở khóa để vào trang mong muốn.
function IntroGatekeeper({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Nhận diện khi người dùng nhập URL trực tiếp trên thanh tìm kiếm/địa chỉ của trình duyệt
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0 && navEntries[0].type === 'navigate') {
        const fromButton = sessionStorage.getItem('foodfast_intro_button_clicked');
        if (!fromButton) {
          sessionStorage.removeItem('foodfast_intro_passed');
        } else {
          sessionStorage.removeItem('foodfast_intro_button_clicked');
        }
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (location.pathname === '/intro') return;

    const introPassed = sessionStorage.getItem('foodfast_intro_passed');
    if (introPassed !== 'true') {
      const fullUrl = location.pathname + location.search + location.hash;
      if (fullUrl && fullUrl !== '/') {
        sessionStorage.setItem('foodfast_pending_url', fullUrl);
      }
      navigate('/intro', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return children;
}

function AppContent() {
  const location = useLocation();
  const isIntro = location.pathname === '/intro';
  const isAuthPage = ['/login', '/register', '/forgot-password', '/admin/login'].includes(location.pathname);

  return (
    <IntroGatekeeper>
      <div
        className={`min-h-screen flex flex-col font-sans relative ${isAuthPage
          ? 'bg-transparent'
          : 'bg-[#ece7dc] text-[#2b2721]'
          }`}
      >
        {/* Lớp nền Wash màu nước nghệ thuật Sổ Tay Ký Họa áp dụng toàn hệ thống (trừ các trang Auth) */}
        {!isAuthPage && !isIntro && (
          <>
            <div
              className="fixed inset-0 pointer-events-none z-0 opacity-45 bg-cover bg-top"
              style={{ backgroundImage: 'url("/landing-pages/meng-to-sketchbook/bg-wash.jpg")' }}
              aria-hidden="true"
            />
            <div
              className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#ece7dc]/30 via-[#ece7dc]/70 to-[#ece7dc] opacity-90"
              aria-hidden="true"
            />
          </>
        )}

        {!isIntro && <Navbar />}
        <main className={`flex-1 flex flex-col ${!isAuthPage && !isIntro ? 'relative z-10' : ''}`}>
          <Routes>
            {/* Trang Intro mở đầu */}
            <Route path="/intro" element={<IntroPage />} />

            {/* Khách hàng */}
            <Route path="/" element={<Home />} />
            <Route path="/restaurants/:id" element={<RestaurantDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/cart" element={<OrdersPage initialTab="cart" />} />
            <Route path="/orders/:orderId" element={<OrderTracking />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Sổ Tay Ký Họa Ẩm Thực FoodFast giờ đây chính là Trang Chủ (Home) */}
            <Route path="/sketchbook" element={<Navigate to="/" replace />} />
            <Route path="/ky-hoa" element={<Navigate to="/" replace />} />

            {/* Cửa hàng của tôi (My Store & Seller Onboarding) */}
            <Route path="/merchant/register" element={<MerchantRegister />} />
            <Route path="/store/onboarding" element={<MerchantRegister />} />
            <Route path="/merchant/status" element={<MerchantStatus />} />
            <Route path="/merchant/dashboard" element={<MerchantDashboard />} />

            {/* Quản trị viên (Admin Portal) */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer Sổ Tay Ký Họa FoodFast đồng bộ toàn hệ thống */}
        {!isAuthPage && !isIntro && (
          <footer className="relative z-10 border-t border-[rgba(43,39,33,0.12)] bg-[#f7f4ee]/90 backdrop-blur-xs py-8 mt-auto text-[#2b2721]">
            <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 drop-shadow-xs">
                  <img
                    src="/foodfast-logo.png"
                    alt="FoodFast Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-xl font-bold tracking-tight text-[#2b2721]">
                      FoodFast
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#f2ece1] text-[#9a6a3e] border border-[rgba(154,106,62,0.2)]">
                      Sổ tay mỹ vị
                    </span>
                  </div>
                  <p className="text-xs text-[#2b2721]/65 font-serif italic mt-0.5">
                    Hương vị truyền thống & ngàn món ngon giao nhanh siêu tốc
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#2b2721]/55 space-y-1 sm:text-right">
                <p>© 2026 FoodFast. Nền tảng ẩm thực & ký họa mỹ vị Việt Nam.</p>
                <p className="text-[11px] font-mono text-[#9a6a3e]">Mỹ vị Việt Nam — Giao nhanh tận cửa</p>
              </div>
            </div>
          </footer>
        )}
      </div>
    </IntroGatekeeper>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
