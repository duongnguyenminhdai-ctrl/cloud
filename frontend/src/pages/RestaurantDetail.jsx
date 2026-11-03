import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, MapPin, Phone, ArrowLeft, Plus, Check, ShoppingBag, Zap, AlertCircle } from 'lucide-react';
import { restaurantApi } from '../api/client';
import { useCart } from '../context/CartContext';

export default function RestaurantDetail() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [addedItemIds, setAddedItemIds] = useState([]);

  const { addToCart, totalItems, totalPrice } = useCart();

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await restaurantApi.getById(id);
        if (res.data?.success) {
          setRestaurant(res.data.data);
          setDataSource(res.data.source || 'database');
        } else {
          setError('Không tìm thấy nhà hàng');
        }
      } catch (err) {
        console.error('Lỗi tải chi tiết quán:', err);
        setError('Không thể tải thông tin nhà hàng.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const handleAdd = (item) => {
    const success = addToCart(item, restaurant);
    if (success) {
      const itemId = item._id || item.menuItemId || item.name;
      setAddedItemIds((prev) => [...prev, itemId]);
      setTimeout(() => {
        setAddedItemIds((prev) => prev.filter((id) => id !== itemId));
      }, 1200);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-3xl" />
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">{error || 'Không tìm thấy thông tin quán'}</h2>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Back button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Danh sách nhà hàng
      </Link>

      {/* Restaurant Header Banner */}
      <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {restaurant.image && (
          <div className="h-52 sm:h-64 w-full relative">
            <img
              src={restaurant.image}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <h1 className="text-2xl sm:text-3xl font-extrabold drop-shadow">{restaurant.name}</h1>
              <p className="text-xs sm:text-sm text-gray-200 flex items-center gap-1.5 mt-1">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                {restaurant.address}
              </p>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              {!restaurant.image && (
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{restaurant.name}</h1>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {dataSource && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      dataSource === 'cache'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    {dataSource === 'cache' ? 'Redis Cached' : 'Live Atlas DB'}
                  </span>
                )}
              </div>
              {!restaurant.image && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                  <span>{restaurant.address}</span>
                </div>
              )}
              {restaurant.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{restaurant.phone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-sm shrink-0 self-start">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              {restaurant.rating ? Number(restaurant.rating).toFixed(1) : '5.0'} / 5.0
            </div>
          </div>
        </div>
      </div>

      {/* Menu Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Thực đơn món ăn ({restaurant.menuItems?.length || 0})
          </h2>
          <span className="text-xs font-medium text-gray-400">Chọn món yêu thích vào giỏ</span>
        </div>

        {(!restaurant.menuItems || restaurant.menuItems.length === 0) ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-100 text-gray-400">
            Quán chưa cập nhật món ăn trong thực đơn.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {restaurant.menuItems.map((item, idx) => {
              const itemId = item._id || item.menuItemId || `${item.name}-${idx}`;
              const isAdded = addedItemIds.includes(itemId);

              return (
                <div
                  key={itemId}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-orange-200 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                        loading="lazy"
                      />
                    )}
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug">{item.name}</h3>
                      </div>
                      <p className="font-black text-orange-600 text-sm">
                        {Number(item.price).toLocaleString('vi-VN')} đ
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className="text-xs text-emerald-600 font-medium">Sẵn sàng phục vụ</span>
                    <button
                      onClick={() => handleAdd(item)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isAdded
                          ? 'bg-emerald-600 text-white scale-105'
                          : 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Đã thêm
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Thêm món
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar for Mobile */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto z-40 animate-bounce-subtle">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-gray-700/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative p-2 rounded-xl bg-orange-600 text-white">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-orange-600 text-xs font-bold rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Tổng tiền ({totalItems} món)</p>
                <p className="text-lg font-extrabold text-white">
                  {totalPrice.toLocaleString('vi-VN')} đ
                </p>
              </div>
            </div>

            <Link
              to="/checkout"
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-600/30 transition-all"
            >
              Xem Giỏ Hàng & Thanh Toán →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

