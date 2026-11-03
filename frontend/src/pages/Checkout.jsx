import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, Trash2, ArrowLeft, CreditCard, Banknote, QrCode, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderApi, paymentApi } from '../api/client';

export default function Checkout() {
  const { cartItems, currentRestaurant, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState('72 Đường Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh');
  const [paymentMethod, setPaymentMethod] = useState('VNPAY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }

    if (cartItems.length === 0) {
      setError('Giỏ hàng của bạn đang trống!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderPayload = {
        customerId: user?.id || user?.userId || 'guest_user',
        restaurantId: currentRestaurant?._id || 'default_restaurant',
        items: cartItems.map((item) => ({
          menuItemId: item.menuItemId || item._id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalPrice,
        paymentMethod,
        deliveryAddress: address,
      };

      const res = await orderApi.create(orderPayload);
      if (res.data?.success) {
        const orderId = res.data.data?._id || res.data.order?._id || res.data.data?.orderId;
        clearCart();

        // Nếu chọn thanh toán qua VNPay Sandbox: lấy URL thanh toán và chuyển hướng ngay
        if (paymentMethod === 'VNPAY') {
          try {
            const vnpRes = await paymentApi.createVNPayUrl({
              orderId,
              amount: totalPrice,
              orderInfo: `Thanh toan don hang ${orderId} tai FoodFast`
            });

            if (vnpRes.data?.success && vnpRes.data?.paymentUrl) {
              console.log('[Checkout] 🚀 Chuyển hướng tới cổng thanh toán VNPay:', vnpRes.data.paymentUrl);
              window.location.href = vnpRes.data.paymentUrl;
              return;
            }
          } catch (vnpErr) {
            console.error('Lỗi khi tạo VNPay payment URL:', vnpErr);
            setError('Không thể tạo liên kết thanh toán VNPay. Đơn đã được lưu, chuyển hướng theo dõi...');
          }
        }

        navigate(`/orders/${orderId}`);
      } else {
        setError(res.data?.message || 'Không thể tạo đơn hàng');
      }
    } catch (err) {
      console.error('Lỗi khi đặt hàng:', err);
      setError(err.response?.data?.message || 'Lỗi kết nối Order Service. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">Giỏ hàng trống</h2>
        <p className="text-sm text-gray-500">
          Hãy chọn các món ăn thơm ngon từ nhà hàng để bắt đầu đặt hàng nhé!
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-600/25 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Khám phá món ăn ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-20 space-y-6">
      {/* Back button */}
      <Link
        to={currentRestaurant ? `/restaurants/${currentRestaurant._id}` : '/'}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tiếp tục chọn món
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900">Xác Nhận & Đặt Hàng</h1>
        {currentRestaurant && (
          <span className="text-xs font-semibold px-3 py-1 bg-orange-50 text-orange-700 rounded-full border border-orange-200">
            Quán: {currentRestaurant.name}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Cart Items & Delivery Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Món ăn đã chọn */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900 text-base flex items-center justify-between">
              <span>Món đã chọn ({cartItems.length})</span>
              <button
                onClick={clearCart}
                className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
              </button>
            </h2>

            <div className="divide-y divide-gray-100">
              {cartItems.map((item) => {
                const itemId = item.menuItemId || item._id;
                return (
                  <div key={itemId} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                      <p className="text-xs text-orange-600 font-extrabold">
                        {Number(item.price).toLocaleString('vi-VN')} đ
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
                        <button
                          onClick={() => removeFromCart(itemId)}
                          className="p-1 text-gray-500 hover:text-orange-600 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(itemId, item.quantity + 1)}
                          className="p-1 text-gray-500 hover:text-orange-600 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="font-bold text-gray-800 text-sm min-w-[70px] text-right">
                        {(item.price * item.quantity).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Địa chỉ nhận hàng */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
            <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-600" />
              Địa chỉ nhận hàng
            </h2>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              placeholder="Nhập địa chỉ nhận món..."
            />
          </div>

          {/* Phương thức thanh toán */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
            <h2 className="font-bold text-gray-900 text-base">Phương thức thanh toán</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'VNPAY',
                  label: 'VNPay (Sandbox)',
                  desc: 'Thẻ ATM / QR / Ngân hàng',
                  icon: QrCode,
                  badge: 'Khuyên dùng'
                },
                {
                  id: 'MOMO',
                  label: 'MoMo Sandbox',
                  desc: 'Ví điện tử liên kết',
                  icon: CreditCard
                },
                {
                  id: 'COD',
                  label: 'Tiền mặt (COD)',
                  desc: 'Thanh toán khi nhận hàng',
                  icon: Banknote
                },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`relative p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {m.badge && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[9px] font-bold bg-gradient-to-r from-orange-600 to-amber-500 text-white rounded-full shadow-sm">
                        {m.badge}
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-gray-400'}`} />
                      {isSelected && <CheckCircle className="w-4 h-4 text-orange-600" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-gray-900">{m.label}</p>
                      <p className="text-[10px] text-gray-500">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 sticky top-24">
            <h2 className="font-bold text-gray-900 text-base">Chi tiết thanh toán</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Tiền món ăn</span>
                <span>{totalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Phí vận chuyển</span>
                <span className="text-emerald-600 font-semibold">Miễn phí</span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
                <span className="font-bold text-gray-900">Tổng thanh toán</span>
                <span className="text-2xl font-extrabold text-orange-600">
                  {totalPrice.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-orange-600/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Đang phát sự kiện tạo đơn...</>
              ) : (
                <>Xác nhận đặt hàng →</>
              )}
            </button>

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              * Nhấn đặt hàng sẽ tự động bắn event <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">order.created</code> vào RabbitMQ Broker để kích hoạt Payment & Delivery Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

