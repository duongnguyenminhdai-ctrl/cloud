import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import MerchantRegister from './pages/MerchantRegister';
import MerchantStatus from './pages/MerchantStatus';
import MerchantDashboard from './pages/MerchantDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <CartProvider>
            <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  {/* Khách hàng */}
                  <Route path="/" element={<Home />} />
                  <Route path="/restaurants/:id" element={<RestaurantDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/orders/:orderId" element={<OrderTracking />} />

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
          </CartProvider>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
