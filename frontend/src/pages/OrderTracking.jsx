import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Bike,
  PackageCheck,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  MapPin,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { orderApi, deliveryApi, paymentApi } from '../api/client';

export default function OrderTracking() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const paymentQueryStatus = searchParams.get('payment');
  const txnRef = searchParams.get('txnRef');
  const vnpCode = searchParams.get('code');

  const [order, setOrder] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchTrackingData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Lấy thông tin đơn hàng từ Order Service
      const orderRes = await orderApi.getById(orderId);
      if (orderRes.data?.success) {
        setOrder(orderRes.data.data);
      }

      // 2. Lấy thông tin chuyến giao hàng từ Delivery Service
      try {
        const deliveryRes = await deliveryApi.getByOrderId(orderId);
        if (deliveryRes.data?.success && deliveryRes.data?.data) {
          setDelivery(deliveryRes.data.data);
        }
      } catch (e) {
        // Delivery có thể chưa sinh nếu payment chưa xong
      }

      // 3. Lấy thông tin thanh toán từ Payment Service
      try {
        const paymentRes = await paymentApi.getByOrderId(orderId);
        if (paymentRes.data?.success && paymentRes.data?.data) {
          setPayment(paymentRes.data.data);
        }
      } catch (e) {
        // Payment đang xử lý
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Lỗi khi polling trạng thái đơn:', err);
      if (showLoading) {
        setError('Không thể tìm thấy thông tin đơn hàng này.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Khởi tạo và thiết lập Polling định kỳ mỗi 3 giây
  useEffect(() => {
    fetchTrackingData(true);

    const intervalId = setInterval(() => {
      fetchTrackingData(false);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [orderId]);

  // Xác định bước tiến trình (Stepper Step 1..5)
  // 1: PENDING
  // 2: CONFIRMED / PAYMENT SUCCESS
  // 3: FINDING_DRIVER
  // 4: DELIVERING / PICKING_UP
  // 5: DELIVERED / COMPLETED
  const getActiveStep = () => {
    if (!order) return 1;

    const deliveryStatus = delivery?.status;
    const orderStatus = order?.status;
    const paymentStatus = payment?.status;

    if (deliveryStatus === 'DELIVERED' || orderStatus === 'COMPLETED') return 5;
    if (deliveryStatus === 'DELIVERING' || deliveryStatus === 'PICKING_UP' || orderStatus === 'DELIVERING') return 4;
    if (deliveryStatus === 'FINDING_DRIVER') return 3;
    if (paymentStatus === 'SUCCESS' || orderStatus === 'CONFIRMED') return 2;
    return 1;
  };

  const activeStep = getActiveStep();

  const steps = [
    { step: 1, label: 'Đã nhận đơn', desc: 'Order Service', icon: Clock },
    { step: 2, label: 'Đã thanh toán', desc: 'Payment Service', icon: CreditCard },
    { step: 3, label: 'Tìm tài xế', desc: 'RabbitMQ Event', icon: Bike },
    { step: 4, label: 'Đang giao hàng', desc: 'Delivery Service', icon: Bike },
    { step: 5, label: 'Đã giao', desc: 'Hoàn tất', icon: PackageCheck },
  ];

  const handleRetryVNPay = async () => {
    if (!order) return;
    setRetryLoading(true);
    try {
      const res = await paymentApi.createVNPayUrl({
        orderId: order._id || orderId,
        amount: order.totalPrice,
        orderInfo: `Thanh toan don hang ${order._id || orderId} tai FoodFast`
      });
      if (res.data?.success && res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      }
    } catch (e) {
      alert('Không thể tạo lại liên kết VNPay: ' + (e.response?.data?.message || e.message));
    } finally {
      setRetryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6 animate-pulse">
        <div className="h-40 bg-gray-200 rounded-3xl" />
        <div className="h-64 bg-gray-100 rounded-3xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">{error || 'Không tìm thấy đơn hàng'}</h2>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-6">
      {/* Back button & Polling Badge */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Về trang chủ
        </Link>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Realtime Polling (3s)</span>
        </div>
      </div>

      {/* VNPay Payment Success Alert */}
      {paymentQueryStatus === 'success' && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-sm text-emerald-900">
              🎉 Thanh toán VNPay Sandbox thành công!
            </p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Giao dịch của bạn đã được cổng thanh toán VNPay xác thực{txnRef ? ` (Mã giao dịch: #${txnRef})` : ''}. Hệ thống đã gửi đơn tới quán ăn và đang kết nối tài xế giao hàng!
            </p>
          </div>
        </div>
      )}

      {/* VNPay Payment Failed Alert */}
      {(paymentQueryStatus === 'failed' || payment?.status === 'FAILED') && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-extrabold text-sm text-amber-900">
                Giao dịch VNPay chưa hoàn tất {vnpCode ? `(Mã phản hồi: ${vnpCode})` : ''}
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Đơn hàng vẫn đang ở trạng thái chờ thanh toán. Bạn có thể bấm nút bên cạnh để thanh toán lại qua VNPay.
              </p>
            </div>
          </div>
          <button
            onClick={handleRetryVNPay}
            disabled={retryLoading}
            className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl shadow-md transition-all shrink-0 flex items-center justify-center gap-1.5"
          >
            {retryLoading ? 'Đang tạo link...' : 'Thanh toán lại qua VNPay'} <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Status Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
              Theo dõi đơn hàng trực tuyến
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 break-all">
              Mã đơn: #{orderId}
            </h1>
            <p className="text-xs text-gray-400">
              Đặt lúc: {new Date(order.createdAt || Date.now()).toLocaleString('vi-VN')}
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <p className="text-xs text-gray-400 font-medium">Tổng thanh toán</p>
            <p className="text-2xl font-black text-orange-600">
              {Number(order.totalPrice || 0).toLocaleString('vi-VN')} đ
            </p>
          </div>
        </div>

        {/* Visual Stepper */}
        <div className="py-2">
          <div className="grid grid-cols-5 gap-2 relative">
            {steps.map((s) => {
              const Icon = s.icon;
              const isPassed = activeStep >= s.step;
              const isCurrent = activeStep === s.step;

              return (
                <div key={s.step} className="flex flex-col items-center text-center space-y-2">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all ${
                      isPassed
                        ? 'bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-md shadow-orange-500/20'
                        : 'bg-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-4 ring-orange-500/20 scale-105' : ''}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p
                      className={`text-[11px] sm:text-xs font-bold leading-tight ${
                        isPassed ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="hidden sm:block text-[10px] text-gray-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Driver & Delivery Information */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
        <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
          <Bike className="w-5 h-5 text-orange-600" />
          Thông tin Vận chuyển & Tài xế
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-2xl bg-gray-50 space-y-1">
            <p className="text-xs text-gray-400 font-medium">Tài xế nhận chuyến</p>
            <p className="font-extrabold text-gray-900 text-base">
              {delivery?.driverName || (activeStep >= 3 ? 'Trần Văn Vận Chuyển (Đối tác Cloud)' : 'Đang điều phối tài xế...')}
            </p>
            <p className="text-xs text-emerald-600 font-medium">Honda Wave Alpha • 59-X1 888.88</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 space-y-1">
            <p className="text-xs text-gray-400 font-medium">Trạng thái thanh toán</p>
            <p className="font-extrabold text-emerald-600 text-base flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {payment?.status === 'SUCCESS' || activeStep >= 2 ? 'ĐÃ THANH TOÁN THÀNH CÔNG' : 'ĐANG XỬ LÝ THANH TOÁN'}
            </p>
            <p className="text-xs text-gray-500">Mã giao dịch: {payment?.transactionId || 'TXN-PENDING'}</p>
          </div>
        </div>
      </div>

      {/* Ordered Items List */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
        <h2 className="font-bold text-gray-900 text-base">Chi tiết các món ăn</h2>
        <div className="divide-y divide-gray-100">
          {order.items?.map((item, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-600">{item.quantity}x</span>
                <span className="font-semibold text-gray-800">{item.name}</span>
              </div>
              <span className="font-bold text-gray-900">
                {(Number(item.price) * Number(item.quantity)).toLocaleString('vi-VN')} đ
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Event Stream Log Explainer */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-2">
        <div className="flex items-center gap-1.5 font-bold">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Kiến trúc Event-Driven Microservices hoạt động ngầm:</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-amber-800">
          <li><strong>Order Service</strong>: Lưu trạng thái PENDING ➔ phát <code className="bg-white/80 px-1 rounded font-mono">order.created</code>.</li>
          <li><strong>Payment Service</strong>: Bắt event ➔ trừ tiền SUCCESS ➔ phát <code className="bg-white/80 px-1 rounded font-mono">payment.success</code>.</li>
          <li><strong>Delivery Service</strong>: Bắt event ➔ tự động tạo chuyến giao hàng trạng thái FINDING_DRIVER.</li>
        </ul>
      </div>
    </div>
  );
}

