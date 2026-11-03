import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, Phone, Zap, ArrowRight, RefreshCw, Clock } from 'lucide-react';
import { restaurantApi } from '../api/client';

export default function Home() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);

  const fetchRestaurants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await restaurantApi.getAll();
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setRestaurants(res.data.data);
        setDataSource(res.data.source || 'database');
      } else {
        console.warn('Dữ liệu phản hồi không đúng chuẩn:', res.data);
        setError('Không thể lấy danh sách quán ăn từ máy chủ. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi tải danh sách quán:', err);
      setError('Không thể kết nối tới Restaurant Service qua API Gateway. Vui lòng đảm bảo container Gateway (cổng 8080) hoặc restaurant-service (cổng 3001) đang chạy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 text-white p-6 sm:p-10 shadow-xl shadow-orange-500/15">
        <div className="relative z-10 max-w-xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide">
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            Cloud Microservices Delivery
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Món Ngon Nóng Hổi, <br />
            <span className="text-amber-200">Giao Nhanh Tận Cửa!</span>
          </h1>
          <p className="text-sm sm:text-base text-orange-100 font-medium">
            Hệ thống đặt món phân tán tích hợp RabbitMQ Event Bus, Redis Caching tốc độ cao và MongoDB Atlas.
          </p>
        </div>
        {/* Background decorative blob */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Header Danh sách quán ăn + Cache Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quán Ăn Nổi Bật</h2>
          <p className="text-sm text-gray-500">Khám phá các nhà hàng và quán ăn đối tác quanh bạn</p>
        </div>

        <div className="flex items-center gap-2">
          {dataSource && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                dataSource === 'cache'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              {dataSource === 'cache' ? '⚡ Redis Cache Hit' : '🔍 MongoDB Atlas Query'}
            </span>
          )}
          <button
            onClick={fetchRestaurants}
            className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl border border-gray-200 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={fetchRestaurants}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse space-y-4">
              <div className="h-40 bg-gray-200 rounded-xl" />
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Restaurant List */}
      {!loading && !error && (
        restaurants.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 p-8 space-y-3">
            <p className="text-gray-500 font-medium">Chưa có nhà hàng nào trong hệ thống.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((res) => (
              <Link
                key={res._id}
                to={`/restaurants/${res._id}`}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Visual Header / Cover */}
                <div className="h-44 relative p-4 flex flex-col justify-between text-white overflow-hidden bg-gradient-to-tr from-orange-500 to-amber-400">
                  {res.image && (
                    <img
                      src={res.image}
                      alt={res.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30 pointer-events-none" />
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-xs font-semibold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                      {res.rating ? Number(res.rating).toFixed(1) : '5.0'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-xs font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      15-25 phút
                    </span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold drop-shadow group-hover:text-amber-200 transition-colors">
                      {res.name}
                    </h3>
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{res.address}</span>
                    </div>
                    {res.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>{res.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Menu count & CTA */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-400">
                      {res.menuItems?.length || 0} món ăn trong thực đơn
                    </span>
                    <span className="text-orange-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      Xem Menu <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}

