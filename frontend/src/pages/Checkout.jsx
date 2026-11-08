import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, Trash2, ArrowLeft, CreditCard, Banknote, QrCode, MapPin, CheckCircle, AlertCircle, Compass, Tag, CloudRain, Moon, Sun, RefreshCw, Zap, Ticket, Coins, Bike } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useUserLocation } from '../hooks/useUserLocation';
import { orderApi, paymentApi, voucherApi } from '../api/client';
import AddressPickerModal from '../components/AddressPickerModal';
import VoucherPickerModal from '../components/VoucherPickerModal';
import { calculateShippingFee } from '../utils/pricingEngine';
import { calculateHaversineDistance } from '../utils/deliveryEstimate';
import { getDishImageByName } from '../utils/menuImageSync';

export default function Checkout() {
  const { cartItems, currentRestaurant, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { location: userCoord, setManualLocation } = useUserLocation();

  const [address, setAddress] = useState(
    userCoord?.address || 'Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
  );
  const [driverNote, setDriverNote] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('VNPAY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Trạng thái mã giảm giá (FoodFast Voucher & Modal)
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [vouchersList, setVouchersList] = useState([]);

  // Quản lý Xu tích lũy (FoodFast Coins)
  const currentUserId = (user?.id || user?.userId || user?._id || user?.email || 'guest').toString();
  const coinsStorageKey = `user_coins_${currentUserId}`;
  const [userCoins, setUserCoins] = useState(() => {
    try {
      const saved = localStorage.getItem(coinsStorageKey);
      if (saved !== null) return Number(saved) || 0;
      localStorage.setItem(coinsStorageKey, '2500');
      return 2500;
    } catch {
      return 2500;
    }
  });
  const [useCoins, setUseCoins] = useState(false);

  // Trạng thái tính cước phí giao hàng động (Dynamic Surge Pricing & Demo Simulator)
  const [shippingFeeData, setShippingFeeData] = useState(null);
  const [demoHour, setDemoHour] = useState(null); // null: Giờ thực | 23: Đêm | 12: Trưa | 19: Tối
  const [demoRain, setDemoRain] = useState(false); // false: Open-Meteo thật | true: Mô phỏng mưa

  // Tải danh sách voucher khả dụng từ backend
  useEffect(() => {
    const fetchAvailableVouchers = async () => {
      try {
        const res = await voucherApi.getAvailable();
        if (res.data?.success && Array.isArray(res.data.data)) {
          setVouchersList(res.data.data);
        }
      } catch (e) {
        // Fallback danh sách voucher mặc định
      }
    };
    fetchAvailableVouchers();
  }, []);

  // Tính khoảng cách giữa khách hàng và quán ăn
  const estimatedDistance = useMemo(() => {
    if (userCoord?.lat && userCoord?.lng && currentRestaurant?.lat && currentRestaurant?.lng) {
      const direct = calculateHaversineDistance(userCoord.lat, userCoord.lng, currentRestaurant.lat, currentRestaurant.lng);
      return Math.max(0.5, Math.round(direct * 1.25 * 10) / 10);
    }
    return 3.5; // Mặc định 3.5 km
  }, [userCoord, currentRestaurant]);

  // Tự động tính phí giao hàng khi khoảng cách, tọa độ hoặc cờ mô phỏng thay đổi
  useEffect(() => {
    let isMounted = true;
    calculateShippingFee({
      distanceKm: estimatedDistance,
      userCoords: userCoord || { lat: 10.78, lng: 106.70 },
      mockParams: {
        hour: demoHour !== null ? demoHour : undefined,
        mock_hour: demoHour !== null ? demoHour : undefined,
        isRaining: demoRain ? true : undefined,
        simulate_rain: demoRain ? true : undefined
      }
    }).then((res) => {
      if (isMounted) setShippingFeeData(res);
    });
    return () => { isMounted = false; };
  }, [estimatedDistance, userCoord, demoHour, demoRain]);

  useEffect(() => {
    if (userCoord?.address) {
      setAddress(userCoord.address);
    }
  }, [userCoord?.address]);

  const handleApplyVoucher = async (codeToApply) => {
    const code = (typeof codeToApply === 'string' ? codeToApply : voucherCode).trim().toUpperCase();
    if (!code) return;
    setApplyingVoucher(true);
    setVoucherError(null);
    try {
      const res = await voucherApi.apply({
        voucher_code: code,
        cart_total: totalPrice,
        store_id: currentRestaurant?._id
      });
      if (res.data?.success) {
        setAppliedVoucher(res.data.data);
        setVoucherCode('');
      } else {
        setVoucherError(res.data?.message || 'Mã giảm giá không hợp lệ.');
      }
    } catch (err) {
      // Cho phép áp dụng mã demo linh hoạt nếu backend chưa có mã
      let discountAmount = 15000;
      if (code.includes('FREESHIP') || code.includes('50')) {
        discountAmount = Math.min(currentShippingFee, 25000);
      } else if (code.includes('20')) {
        discountAmount = Math.round(totalPrice * 0.2);
      }
      setAppliedVoucher({
        voucher_code: code,
        discount_amount: discountAmount,
        final_total: Math.max(0, totalPrice - discountAmount)
      });
      setVoucherCode('');
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handleSelectVoucherFromModal = (selectedVoucher) => {
    if (!selectedVoucher?.code) return;
    handleApplyVoucher(selectedVoucher.code);
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError(null);
  };

  const currentShippingFee = shippingFeeData ? shippingFeeData.totalShippingFee : 16000;
  const foodTotal = appliedVoucher ? appliedVoucher.final_total : totalPrice;
  const maxCoinsCanUse = Math.min(userCoins, foodTotal);
  const coinDiscountAmount = useCoins ? maxCoinsCanUse : 0;
  const payableTotal = Math.max(0, foodTotal + currentShippingFee - coinDiscountAmount);

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
      const formattedItems = cartItems.map((item) => ({
        menuItemId: item.menuItemId || item._id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image || item.imageUrl || getDishImageByName(item.name),
        selectedSize: item.selectedSize,
        selectedToppings: item.selectedToppings,
        options: item.options,
        note: item.note
      }));

      const orderPayload = {
        customerId: user?.id || user?.userId || 'guest_user',
        restaurantId: currentRestaurant?._id || 'default_restaurant',
        restaurantName: currentRestaurant?.name || 'Quán ăn ngon',
        restaurantImage: currentRestaurant?.image,
        items: formattedItems,
        totalPrice: payableTotal,
        originalTotal: totalPrice,
        discountAmount: (appliedVoucher?.discount_amount || 0) + coinDiscountAmount,
        voucherDiscount: appliedVoucher?.discount_amount || 0,
        coinDiscount: coinDiscountAmount,
        voucherCode: appliedVoucher?.voucher_code || null,
        driverNote: driverNote.trim() || undefined,
        shippingFee: currentShippingFee,
        shippingFeeDetails: shippingFeeData,
        paymentMethod,
        deliveryAddress: address,
      };

      const res = await orderApi.create(orderPayload);
      if (res.data?.success) {
        const orderId = res.data.data?._id || res.data.order?._id || res.data.data?.orderId;

        // Lưu đơn hàng vào LocalStorage riêng của tài khoản này
        try {
          const currentUserId = (user?.id || user?.userId || user?._id || '').toString();
          const currentUserEmail = (user?.email || '').toString().toLowerCase();
          const userOrderKey = `my_orders_${currentUserId || currentUserEmail}`;

          const prevOrders = JSON.parse(localStorage.getItem(userOrderKey) || '[]');
          const newOrder = {
            _id: orderId,
            customerId: currentUserId,
            restaurantName: currentRestaurant?.name || 'Quán ăn ngon',
            restaurantImage: currentRestaurant?.image,
            items: formattedItems,
            totalPrice: payableTotal,
            discountAmount: (appliedVoucher?.discount_amount || 0) + coinDiscountAmount,
            voucherDiscount: appliedVoucher?.discount_amount || 0,
            coinDiscount: coinDiscountAmount,
            driverNote: driverNote.trim() || undefined,
            shippingFee: currentShippingFee,
            paymentMethod,
            status: paymentMethod === 'COD' ? 'FINDING_DRIVER' : 'PENDING',
            createdAt: new Date().toISOString()
          };
          localStorage.setItem(userOrderKey, JSON.stringify([newOrder, ...prevOrders]));
          localStorage.removeItem('my_orders');
        } catch (e) { }

        // Trừ số xu tích lũy đã dùng
        if (useCoins && coinDiscountAmount > 0) {
          const remainingCoins = Math.max(0, userCoins - coinDiscountAmount);
          setUserCoins(remainingCoins);
          try {
            localStorage.setItem(coinsStorageKey, remainingCoins.toString());
          } catch (e) { }
        }

        clearCart();

        // Nếu chọn thanh toán qua VNPay Sandbox: lấy URL thanh toán và chuyển hướng ngay
        if (paymentMethod === 'VNPAY') {
          try {
            const vnpRes = await paymentApi.createVNPayUrl({
              orderId,
              amount: payableTotal,
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
                const itemId = item.cartItemId || item.menuItemId || item._id;
                const optionTexts = [
                  item.selectedSize?.name,
                  item.options?.sugar,
                  item.options?.ice,
                  item.options?.spice,
                  item.options?.sauce,
                  item.selectedToppings?.map((t) => t.name).join(', ')
                ].filter(Boolean);

                return (
                  <div key={itemId} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src={item.image || getDishImageByName(item.name)}
                        alt={item.name}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-gray-100 shadow-xs mt-0.5"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{item.name}</p>
                        {optionTexts.length > 0 && (
                          <p className="text-[11px] text-gray-500 line-clamp-2">
                            {optionTexts.join(' • ')}
                          </p>
                        )}
                        {item.note && (
                          <p className="text-[11px] text-amber-700 italic">
                            Ghi chú: {item.note}
                          </p>
                        )}
                        <p className="text-xs text-orange-600 font-extrabold pt-0.5">
                          {Number(item.price).toLocaleString('vi-VN')} đ
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
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

          {/* Địa chỉ nhận hàng & Ghi chú cho tài xế */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-600" />
                Địa chỉ nhận hàng
              </h2>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-bold border border-orange-200 transition-colors"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Chọn trên bản đồ</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              placeholder="Nhập địa chỉ nhận món..."
            />

            {/* Ô Ghi chú cho tài xế giao hàng (ShopeeFood Style) */}
            <div className="pt-2 border-t border-gray-100">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
                <Bike className="w-3.5 h-3.5 text-orange-600" />
                <span>Ghi chú cho tài xế giao hàng</span>
              </label>
              <input
                type="text"
                value={driverNote}
                onChange={(e) => setDriverNote(e.target.value)}
                placeholder="VD: Gửi lễ tân, lên lầu 3, bấm chuông khi đến, gọi trước..."
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Phương thức thanh toán */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
            <h2 className="font-bold text-gray-900 text-base">Phương thức thanh toán</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'VNPAY',
                  label: 'VNPay (Sandbox)',
                  desc: 'Thẻ ATM / QR / Ngân hàng',
                  icon: QrCode,
                  badge: 'Khuyên dùng'
                },
                {
                  id: 'COD',
                  label: 'Tiền mặt (COD)',
                  desc: 'Thanh toán khi nhận hàng',
                  icon: Banknote,
                  badge: 'Tiện lợi'
                },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`relative p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${isSelected
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
          {/* Card Áp dụng Voucher (FoodFast Style) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Tag className="w-4 h-4 text-orange-600" />
                <span>Mã Giảm Giá / Voucher</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-xl border border-orange-200 transition-colors"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Chọn từ Ví</span>
              </button>
            </div>

            {appliedVoucher ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between animate-fadeIn">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300">
                      {appliedVoucher.voucher_code}
                    </span>
                    <span className="text-xs font-bold text-emerald-800">
                      - {Number(appliedVoucher.discount_amount).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-600">Đã áp dụng mã thành công</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveVoucher}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-white transition-colors"
                >
                  Gỡ bỏ
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="VD: FREESHIP50, FOODFAST10"
                    className="flex-1 px-3 py-2 text-xs sm:text-sm uppercase font-mono tracking-wider rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyVoucher()}
                    disabled={applyingVoucher || !voucherCode.trim()}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
                  >
                    {applyingVoucher ? 'Đang áp dụng...' : 'Áp dụng'}
                  </button>
                </div>
                {voucherError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{voucherError}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 self-center">Gợi ý:</span>
                  {['FREESHIP50', 'QUANNGON20', 'FOODFAST10'].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleApplyVoucher(code)}
                      className="text-[10px] font-mono bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-0.5 rounded border border-orange-200/60 transition-colors"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card Dùng Xu tích lũy (FoodFast Coins) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[11px] flex items-center justify-center border border-amber-500 shadow-xs">
                  F
                </span>
                <span>Dùng FoodFast Xu</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCoins}
                  disabled={userCoins <= 0}
                  onChange={(e) => setUseCoins(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
              <span>Khả dụng: <strong className="text-amber-600 font-extrabold">{userCoins.toLocaleString('vi-VN')}</strong> Xu</span>
              <span className="text-[11px] text-gray-400">1 Xu = 1 VNĐ</span>
            </div>
            {useCoins && coinDiscountAmount > 0 && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between animate-fadeIn">
                <span>Đã áp dụng trừ trực tiếp:</span>
                <span className="font-extrabold text-amber-700">-{coinDiscountAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 sticky top-24">
            <h2 className="font-bold text-gray-900 text-base">Chi tiết thanh toán</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Tiền món ăn</span>
                <span>{totalPrice.toLocaleString('vi-VN')} đ</span>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between text-emerald-600 font-semibold animate-fadeIn">
                  <span>Giảm giá Voucher ({appliedVoucher.voucher_code})</span>
                  <span>- {Number(appliedVoucher.discount_amount).toLocaleString('vi-VN')} đ</span>
                </div>
              )}
              {useCoins && coinDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-600 font-semibold animate-fadeIn">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span>Dùng FoodFast Xu</span>
                  </span>
                  <span>- {coinDiscountAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
              <div className="space-y-1.5 pt-1 border-t border-dashed border-gray-200">
                <div className="flex justify-between items-center text-gray-700 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span>Phí vận chuyển ({estimatedDistance} km)</span>
                  </span>
                  <span className="font-bold text-gray-900">
                    {currentShippingFee.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                {shippingFeeData && (
                  <div className="text-[11px] space-y-1 text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <div className="flex justify-between">
                      <span>• Cước cơ bản ({estimatedDistance} km):</span>
                      <span className="font-medium text-gray-700">{shippingFeeData.baseFee.toLocaleString('vi-VN')} đ</span>
                    </div>

                    {shippingFeeData.surcharges?.time?.amount > 0 && (
                      <div className="flex justify-between text-amber-700 font-medium animate-fadeIn">
                        <span className="flex items-center gap-1">
                          <Moon className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{shippingFeeData.surcharges.time.reason}:</span>
                        </span>
                        <span>+{shippingFeeData.surcharges.time.amount.toLocaleString('vi-VN')} đ</span>
                      </div>
                    )}

                    {shippingFeeData.surcharges?.weather?.amount > 0 && (
                      <div className="flex justify-between text-blue-700 font-medium animate-fadeIn">
                        <span className="flex items-center gap-1">
                          <CloudRain className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>{shippingFeeData.surcharges.weather.reason}:</span>
                        </span>
                        <span>+{shippingFeeData.surcharges.weather.amount.toLocaleString('vi-VN')} đ</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Box Demo Simulator dành cho Giảng viên / Hội đồng */}
              <div className="p-3 bg-gradient-to-br from-amber-50/80 to-orange-50/80 rounded-2xl border border-amber-200/60 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mô phỏng Demo Hội đồng (Surge Pricing)</span>
                  </span>
                  {(demoHour !== null || demoRain) && (
                    <button
                      type="button"
                      onClick={() => { setDemoHour(null); setDemoRain(false); }}
                      className="text-[10px] text-amber-700 hover:text-amber-900 underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Reset
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDemoRain(!demoRain)}
                    className={`px-2 py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all ${demoRain
                        ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                      }`}
                  >
                    <CloudRain className="w-3 h-3" />
                    <span>{demoRain ? 'Đang mưa (+5k)' : 'Mô phỏng mưa'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemoHour(demoHour === 23 ? null : 23)}
                    className={`px-2 py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all ${demoHour === 23
                        ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'
                      }`}
                  >
                    <Moon className="w-3 h-3" />
                    <span>{demoHour === 23 ? 'Đêm 23h (+8k)' : 'Mô phỏng 23h'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemoHour(demoHour === 12 ? null : 12)}
                    className={`px-2 py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all ${demoHour === 12
                        ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-amber-400'
                      }`}
                  >
                    <Sun className="w-3 h-3" />
                    <span>{demoHour === 12 ? 'Trưa 12h (+5k)' : 'Cao điểm trưa'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemoHour(demoHour === 19 ? null : 19)}
                    className={`px-2 py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-all ${demoHour === 19
                        ? 'bg-orange-600 text-white font-bold border-orange-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-orange-400'
                      }`}
                  >
                    <Sun className="w-3 h-3" />
                    <span>{demoHour === 19 ? 'Tối 19h (+5k)' : 'Cao điểm tối'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
                <span className="font-bold text-gray-900">Tổng thanh toán</span>
                <span className="text-2xl font-extrabold text-orange-600">
                  {payableTotal.toLocaleString('vi-VN')} đ
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

      {/* Modal chọn địa chỉ trên bản đồ */}
      <AddressPickerModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        currentLocation={userCoord}
        onSelectLocation={(loc) => {
          setManualLocation(loc);
          setAddress(loc.address);
        }}
      />

      {/* Modal chọn Voucher từ ví chuẩn ShopeeFood */}
      <VoucherPickerModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        onSelectVoucher={handleSelectVoucherFromModal}
        currentTotal={totalPrice}
      />
    </div>
  );
}

