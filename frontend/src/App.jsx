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
    } catch {}
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

  return (
    <IntroGatekeeper>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        {!isIntro && <Navbar />}
        <main className="flex-1 flex flex-col">
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
