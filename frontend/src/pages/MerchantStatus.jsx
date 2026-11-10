import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Clock, CheckCircle2, XCircle, AlertCircle, ArrowRight, Store, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storeApi } from '../api/client';
import { subscribeRealtimeStream } from '../utils/realtimeSync';

export default function MerchantStatus() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('registration'); // 'my_stores' | 'registration'
  const [storeStatus, setStoreStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStatus = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setErrorMsg('');
    }
    try {
      const res = await storeApi.getMyStatus();
      if (res.data?.success) {
        setStoreStatus(res.data);
      }
    } catch (err) {
      if (!silent) {
        setErrorMsg(err.response?.data?.message || err.message || 'Lỗi tải trạng thái quán');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/merchant/status');
      return;
    }
    fetchStatus();

    const unsubscribe = subscribeRealtimeStream({
      service: 'restaurant',
      path: '/stores/my-store/stream',
      events: ['store.approved', 'store.rejected', 'store.updated', 'notification.created'],
      broadcastChannels: ['restaurant', 'admin'],
      fallbackIntervalMs: 4000,
      onPoll: () => fetchStatus({ silent: true })
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  const store = storeStatus?.store;
  const status = storeStatus?.store_status || 'NOT_REGISTERED';

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      {/* Header Cam Tiêu Chuẩn FoodFast */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Đăng Ký Quán</h1>
              <p className="text-xs text-orange-100">Cổng tiếp nhận và theo dõi tiến độ duyệt gian hàng</p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Làm mới trạng thái"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        {/* Tabs Bar giống ảnh Screenshot 11 */}
        <div className="bg-white rounded-t-2xl border-b border-gray-200 px-6 pt-3 flex gap-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('my_stores')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'my_stores'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Quán của tôi ({status === 'ACTIVE' ? 1 : 0})
          </button>
          <button
            onClick={() => setActiveTab('registration')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'registration'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Đăng ký quán ({status === 'PENDING' || status === 'REJECTED' ? 1 : 0})
          </button>
        </div>

        {/* Content Body */}
        <div className="bg-white rounded-b-2xl border border-t-0 border-gray-100 shadow-sm p-6 sm:p-8">
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-orange-600 mb-3" />
              <p className="text-sm">Đang tải thông tin trạng thái cửa hàng...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : status === 'NOT_REGISTERED' ? (
            /* Chưa đăng ký quán */
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Store className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Bạn chưa có cửa hàng nào</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
                  Đăng ký mở quán trên FoodFast ngay hôm nay để tiếp cận hàng triệu khách hàng và gia tăng doanh số nhanh chóng.
                </p>
              </div>
              <button
                onClick={() => navigate('/merchant/register')}
                className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-600/20 inline-flex items-center gap-2 transition-all"
              >
                <Plus className="w-5 h-5" /> Đăng ký mở quán ngay
              </button>
            </div>
          ) : (
            /* Đã có hồ sơ cửa hàng */
            <div className="space-y-6">
              {/* Card thông tin quán */}
              <div className="p-4 sm:p-6 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <img
                    src={store?.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80'}
                    alt={store?.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-gray-100 shadow-sm"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-md bg-orange-600 text-white text-xs font-black flex items-center justify-center">
                        F
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-gray-900">{store?.name}</h2>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
                      {status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          <Clock className="w-3.5 h-3.5" /> Chờ duyệt
                        </span>
                      )}
                      {status === 'ACTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đang hoạt động
                        </span>
                      )}
                      {status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                          <XCircle className="w-3.5 h-3.5" /> Bị từ chối
                        </span>
                      )}

                      <span>•</span>
                      <span>
                        Cập nhật: {new Date(store?.updatedAt || Date.now()).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                      Địa chỉ: {store?.address}
                    </p>
                  </div>
                </div>

                {/* Nút hành động */}
                <div>
                  {status === 'ACTIVE' && (
                    <button
                      onClick={() => navigate('/merchant/dashboard')}
                      className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-600/20 inline-flex items-center gap-2 transition-all whitespace-nowrap"
                    >
                      Vào quản lý quán <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  {status === 'REJECTED' && (
                    <button
                      onClick={() => navigate('/merchant/register')}
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 inline-flex items-center gap-2 transition-all whitespace-nowrap"
                    >
                      Chỉnh sửa hồ sơ <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Thông báo chi tiết theo trạng thái (Banner) */}
              {status === 'PENDING' && (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-sm flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    !
                  </div>
                  <div>
                    <h4 className="font-bold">Đăng ký của bạn đang trong quá trình duyệt</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      Ban quản trị FoodFast đang kiểm tra thông tin pháp lý và đối soát thông tin tài khoản ngân hàng của quán. 
                      Kết quả xét duyệt sẽ được hoàn tất trong vòng 24h làm việc. Bạn vui lòng quay lại kiểm tra sau.
                    </p>
                  </div>
                </div>
              )}

              {status === 'REJECTED' && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold">Hồ sơ đăng ký chưa đạt yêu cầu</h4>
                    <p className="text-xs text-red-700 mt-1">
                      <strong>Lý do từ chối:</strong> {store?.rejectedReason || 'Thông tin giấy tờ hoặc địa chỉ quán chưa đầy đủ.'}
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      Vui lòng bấm nút "Chỉnh sửa hồ sơ" ở trên để bổ sung đầy đủ và gửi lại yêu cầu duyệt.
                    </p>
                  </div>
                </div>
              )}

              {status === 'ACTIVE' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold">Cửa hàng của bạn đã sẵn sàng mở bán!</h4>
                    <p className="text-xs text-emerald-700 mt-1">
                      Hồ sơ đã được Quản trị viên phê duyệt thành công. Quán của bạn hiện đã hiển thị trên ứng dụng khách hàng FoodFast. 
                      Hãy truy cập trang quản lý để cập nhật danh sách món ăn và đón những đơn hàng đầu tiên!
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

