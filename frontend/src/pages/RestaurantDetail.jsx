import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Star,
  MapPin,
  Phone,
  ArrowLeft,
  Plus,
  Minus,
  Check,
  ShoppingBag,
  Zap,
  AlertCircle,
  MessageSquare,
  Sparkles,
  Gift,
  X,
  User,
  Clock,
  Heart,
  Coins
} from 'lucide-react';
import { restaurantApi, reviewApi, orderApi } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useUserLocation } from '../hooks/useUserLocation';
import DeliveryBadge from '../components/DeliveryBadge';
import AddressPickerModal from '../components/AddressPickerModal';
import DishCustomizationModal from '../components/DishCustomizationModal';
import UpdateVariantModal from '../components/UpdateVariantModal';
import { hasDishCustomization } from '../utils/dishCustomization';
import Pagination from '../components/Pagination';
import { subscribeRealtimeStream, publishRealtimeSignal } from '../utils/realtimeSync';

export default function RestaurantDetail() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [addedItemIds, setAddedItemIds] = useState([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Review & Event-Driven Incentive States
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewReward, setReviewReward] = useState(null);
  const [reviewError, setReviewError] = useState(null);

  const {
    addToCart,
    totalItems,
    totalPrice,
    getDishVariants,
    getDishTotalQuantity,
    updateVariantQuantity
  } = useCart();
  const { user, isAuthenticated, updateUserProfile } = useAuth();
  const [targetOrderId, setTargetOrderId] = useState(null);
  const { location: userCoord, setManualLocation } = useUserLocation();

  // Trạng thái Quán yêu thích (Like / Wishlist)
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Trạng thái modal cập nhật biến thể (FoodFast Variant Modal)
  const [updatingDishVariants, setUpdatingDishVariants] = useState(null);

  // Tab danh mục món ăn đang chọn
  const [activeCategoryTab, setActiveCategoryTab] = useState('ALL');

  const fetchReviews = async ({ silent = false } = {}) => {
    if (!silent) setReviewsLoading(true);
    try {
      const res = await reviewApi.getByStore(id);
      if (res.data?.success) {
        setReviews(res.data.data || []);
      }
    } catch (err) {
      if (!silent) {
        console.error('Lỗi tải đánh giá quán:', err);
      }
    } finally {
      if (!silent) setReviewsLoading(false);
    }
  };

  const fetchDetail = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await restaurantApi.getById(id);
      if (res.data?.success) {
        const storeData = res.data.data;
        setRestaurant(storeData);
        setDataSource(res.data.source || 'database');

        const uid = user?.id || user?.userId || user?._id || user?.email;
        if (uid && storeData.likes) {
          setIsLiked(storeData.likes.includes(String(uid)));
        }
        setLikeCount(storeData.likeCount || storeData.likes?.length || 0);
      } else if (!silent) {
        setError('Không tìm thấy nhà hàng');
      }
    } catch (err) {
      if (!silent) {
        console.error('Lỗi tải chi tiết quán:', err);
        setError('Không thể tải thông tin nhà hàng.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchReviews();

    const unsubscribe = subscribeRealtimeStream({
      service: 'restaurant',
      path: '/restaurants/stream',
      params: { storeId: id },
      events: [
        'store.updated', 'store.operations_updated', 'store.menu_updated',
        'store.banned', 'store.unbanned', 'review.created', 'voucher.updated'
      ],
      broadcastChannels: ['restaurant', 'review', 'voucher'],
      fallbackIntervalMs: 5000,
      onPoll: async () => {
        await Promise.all([
          fetchDetail({ silent: true }),
          fetchReviews({ silent: true })
        ]);
      }
    });

    return () => unsubscribe();
  }, [id, user]);

  const handleToggleFavorite = async () => {
    const uid = user?.id || user?.userId || user?._id || user?.email || 'guest';
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    if (isAuthenticated) {
      try {
        await restaurantApi.toggleLike(id, uid);
      } catch (err) {
        console.error('Lỗi lưu yêu thích:', err);
      }
    }
  };

  const handleDecrement = (item) => {
    const itemId = item._id || item.menuItemId || item.name;
    const variants = getDishVariants(itemId, item.name);
    if (!variants || variants.length === 0) return;

    if (variants.length === 1) {
      // Chỉ có 1 biến thể duy nhất -> trừ trực tiếp
      updateVariantQuantity(variants[0].cartItemId, -1);
    } else {
      // Có nhiều biến thể khác nhau (ví dụ 1 Size M, 2 Size L) -> mở UpdateVariantModal chuẩn FoodFast
      setUpdatingDishVariants({
        dish: item,
        variants
      });
    }
  };

  // Trích xuất danh sách danh mục thực đơn của quán (FoodFast Menu Categories)
  const categoriesList = useMemo(() => {
    if (!restaurant) return [];
    if (restaurant.categories && restaurant.categories.length > 0) {
      return restaurant.categories;
    }
    const catsMap = new Map();
    (restaurant.menuItems || []).forEach((item) => {
      const catKey = item.categoryId || item.category || 'Món chính';
      if (!catsMap.has(catKey)) {
        catsMap.set(catKey, { id: catKey, name: catKey });
      }
    });
    return Array.from(catsMap.values());
  }, [restaurant]);

  // Lọc món theo category đang chọn
  const filteredMenuItems = useMemo(() => {
    if (!restaurant?.menuItems) return [];
    if (activeCategoryTab === 'ALL') return restaurant.menuItems;
    return restaurant.menuItems.filter((item) => {
      return (
        item.categoryId === activeCategoryTab ||
        item.category === activeCategoryTab ||
        (activeCategoryTab === 'Món chính' && !item.categoryId)
      );
    });
  }, [restaurant, activeCategoryTab]);

  // Phân trang danh sách món ăn và đánh giá của quán
  const [menuPage, setMenuPage] = useState(1);
  const MENU_PAGE_SIZE = 8;

  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PAGE_SIZE = 5;

  useEffect(() => {
    setMenuPage(1);
  }, [activeCategoryTab]);

  const paginatedMenuItems = useMemo(() => {
    const start = (menuPage - 1) * MENU_PAGE_SIZE;
    return filteredMenuItems.slice(start, start + MENU_PAGE_SIZE);
  }, [filteredMenuItems, menuPage]);

  const paginatedReviews = useMemo(() => {
    const start = (reviewsPage - 1) * REVIEWS_PAGE_SIZE;
    return reviews.slice(start, start + REVIEWS_PAGE_SIZE);
  }, [reviews, reviewsPage]);

  const handleOpenReviewModal = async () => {
    if (!isAuthenticated) {
      alert('Vui lòng đăng nhập để gửi đánh giá và nhận 1.000 Xu FoodFast!');
      return;
    }

    try {
      const res = await orderApi.getMyOrders();
      const allOrders = res.data?.data || [];
      const now = Date.now();
      const eligibleOrder = allOrders.find((o) => {
        const isMatchStore = String(o.restaurantId) === String(id);
        const isDelivered = o.status === 'DELIVERED';
        const orderTime = new Date(o.createdAt || o.updatedAt || now).getTime();
        const within7Days = (now - orderTime) <= (7 * 24 * 60 * 60 * 1000);
        return isMatchStore && isDelivered && within7Days;
      });

      if (!eligibleOrder) {
        alert('Cơ chế đánh giá chuẩn FoodFast: Bạn chỉ có thể đánh giá sau khi đã mua hàng và nhận món thành công tại quán trong vòng 7 ngày gần nhất để nhận 1.000 Xu.');
        return;
      }

      setTargetOrderId(eligibleOrder._id);
      setReviewError(null);
      setReviewReward(null);
      setIsReviewModalOpen(true);
    } catch {
      alert('Vui lòng đặt món và nhận hàng thành công tại quán để tham gia đánh giá nhận 1.000 Xu.');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      setReviewError('Vui lòng nhập nhận xét của bạn.');
      return;
    }

    setSubmittingReview(true);
    setReviewError(null);

    try {
      const res = await reviewApi.create({
        store_id: id,
        rating: Number(reviewRating),
        comment: reviewComment.trim(),
        order_id: targetOrderId
      });

      if (res.data?.success) {
        if (res.data.newCoinsBalance !== undefined) {
          updateUserProfile({ coins: res.data.newCoinsBalance });
        } else if (user) {
          updateUserProfile({ coins: (user.coins || 0) + 1000 });
        }

        if (reviewRating === 5) {
          setReviewReward({
            type: 'FIVE_STAR',
            title: '🎉 Nhận 1.000 Xu & Voucher Tri Ân 10% (THANKYOU)!',
            message: 'Đã cộng 1.000 Xu FoodFast vào tài khoản của bạn và tặng thêm voucher tri ân giảm 10% cho đơn sau!'
          });
        } else if (reviewRating <= 2) {
          setReviewReward({
            type: 'SORRY',
            title: '🎁 Nhận 1.000 Xu & Voucher Đền Bù 20% (SORRY)!',
            message: 'Đã cộng 1.000 Xu FoodFast vào tài khoản của bạn và tặng thêm voucher đền bù 20% cho đơn kế tiếp!'
          });
        } else {
          setReviewReward({
            type: 'NORMAL',
            title: '✨ Nhận 1.000 Xu FoodFast Thành Công!',
            message: 'Cảm ơn bạn đã đóng góp đánh giá. 1.000 Xu đã được lưu vào ví để giảm trừ vào đơn hàng tiếp theo.'
          });
        }

        setReviewComment('');
        fetchReviews({ silent: true });
        fetchDetail({ silent: true });
        publishRealtimeSignal('review', { storeId: id, rating: Number(reviewRating) });
      } else {
        setReviewError(res.data?.message || 'Không thể gửi đánh giá.');
      }
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Lỗi gửi đánh giá. Vui lòng thử lại.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const [customizingDish, setCustomizingDish] = useState(null);

  const handleOpenCustomization = (item) => {
    setCustomizingDish(item);
  };

  const handleConfirmCustomization = (customizedItem) => {
    const success = addToCart(customizedItem, restaurant);
    if (success) {
      const itemId = customizedItem._id || customizedItem.menuItemId || customizedItem.name;
      setAddedItemIds((prev) => [...prev, itemId]);
      setTimeout(() => {
        setAddedItemIds((prev) => prev.filter((id) => id !== itemId));
      }, 1200);
    }
  };

  const handleAdd = (item) => {
    // Nếu món có cấu hình tùy chọn (Size, sốt, topping do quán đặt) -> mở Modal tùy chọn
    if (hasDishCustomization(item)) {
      handleOpenCustomization(item);
    } else {
      // Món chỉ có 1 size chuẩn, không topping -> thêm ngay vào giỏ hàng
      const directItem = {
        ...item,
        menuItemId: item._id || item.menuItemId || item.name,
        name: item.name,
        price: Number(item.price) || 0,
        basePrice: Number(item.price) || 0,
        quantity: 1,
        selectedSize: null,
        selectedToppings: [],
        options: {},
        note: '',
        cartItemId: `${item._id || item.name}_std`
      };
      const success = addToCart(directItem, restaurant);
      if (success) {
        const itemId = item._id || item.menuItemId || item.name;
        setAddedItemIds((prev) => [...prev, itemId]);
        setTimeout(() => {
          setAddedItemIds((prev) => prev.filter((id) => id !== itemId));
        }, 1200);
      }
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
            {/* Nút Thả tim lưu quán yêu thích (FoodFast Wishlist) */}
            <button
              onClick={handleToggleFavorite}
              className={`absolute top-4 right-4 px-3 py-2 rounded-2xl backdrop-blur-md transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                isLiked
                  ? 'bg-red-500 text-white scale-105 shadow-red-500/30'
                  : 'bg-black/40 text-white hover:bg-black/60 hover:text-red-400'
              }`}
              title={isLiked ? 'Bỏ lưu yêu thích' : 'Lưu quán yêu thích'}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-white text-white' : ''}`} />
              <span className="text-xs font-bold">{likeCount}</span>
            </button>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              {!restaurant.image && (
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{restaurant.name}</h1>
                  <button
                    onClick={handleToggleFavorite}
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isLiked
                        ? 'bg-red-50 border-red-300 text-red-600'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{likeCount}</span>
                  </button>
                </div>
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
              {reviews.length > 0
                ? `${(reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)} / 5.0 (${reviews.length})`
                : restaurant.rating > 0
                ? `${Number(restaurant.rating).toFixed(1)} / 5.0`
                : 'Chưa có đánh giá'}
            </div>
          </div>

          {/* Khoảng cách & Thời gian giao hàng thực tế (OSRM Routing) */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <DeliveryBadge store={restaurant} userCoord={userCoord} variant="detail" />
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(true)}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline px-2.5 py-1 bg-orange-50 rounded-lg transition-colors cursor-pointer"
            >
              Đổi vị trí ({userCoord?.shortAddress || 'TP.HCM'})
            </button>
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

        {/* Thanh danh mục Sticky phong cách FoodFast */}
        {categoriesList.length > 0 && (
          <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md py-2 px-1 border-b border-gray-100 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-xs rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveCategoryTab('ALL')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategoryTab === 'ALL'
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả ({restaurant.menuItems?.length || 0})
            </button>
            {categoriesList.map((cat) => {
              const catId = cat.id || cat._id || cat.name;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setActiveCategoryTab(catId)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeCategoryTab === catId
                      ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {filteredMenuItems.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-100 text-gray-400">
            Không có món ăn nào trong danh mục này.
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paginatedMenuItems.map((item, idx) => {
              const itemId = item._id || item.menuItemId || `${item.name}-${idx}`;
              const isAdded = addedItemIds.includes(itemId);
              const dishQty = getDishTotalQuantity(itemId, item.name);

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
                        onError={(e) => {
                          e.currentTarget.src = '/dishes/res3-1725269549453.jpg';
                        }}
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

                    {dishQty > 0 ? (
                      <div className="flex items-center gap-2 bg-orange-50 px-2 py-1 rounded-xl border border-orange-200">
                        <button
                          type="button"
                          onClick={() => handleDecrement(item)}
                          className="w-7 h-7 rounded-lg bg-white text-orange-600 shadow-xs hover:bg-orange-100 flex items-center justify-center transition-colors font-bold cursor-pointer"
                          title="Giảm món / Chọn biến thể để giảm"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center font-black text-xs text-orange-600">{dishQty}</span>
                        <button
                          type="button"
                          onClick={() => handleAdd(item)}
                          className="w-7 h-7 rounded-lg bg-orange-600 text-white shadow-xs hover:bg-orange-700 flex items-center justify-center transition-colors font-bold cursor-pointer"
                          title="Thêm món"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAdd(item)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isAdded
                            ? 'bg-emerald-600 text-white scale-105'
                            : 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Đã thêm
                          </>
                        ) : hasDishCustomization(item) ? (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Tùy chọn & Thêm
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Thêm vào giỏ
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            {/* Phân trang danh sách món ăn */}
            <Pagination
              currentPage={menuPage}
              totalPages={Math.ceil(filteredMenuItems.length / MENU_PAGE_SIZE) || 1}
              totalItems={filteredMenuItems.length}
              pageSize={MENU_PAGE_SIZE}
              itemLabel="món ăn"
              theme="light"
              onPageChange={(p) => setMenuPage(p)}
              className="mt-4"
            />
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* Reviews & Event-Driven Incentive Section */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-600" />
              <span>Đánh giá từ khách hàng ({reviews.length})</span>
            </h2>
            <p className="text-xs text-gray-400">
              Đánh giá 5 sao nhận ngay Voucher 10%, đánh giá dưới 2 sao nhận Voucher đền bù 20%!
            </p>
          </div>

          <button
            onClick={handleOpenReviewModal}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-600/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>Viết đánh giá & nhận voucher</span>
          </button>
        </div>

        {reviewsLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-2xl space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
            <p className="text-sm font-semibold text-gray-600">Chưa có đánh giá nào cho quán này.</p>
            <p className="text-xs text-gray-400">
              Hãy là người đầu tiên trải nghiệm món ăn và để lại cảm nhận của bạn!
            </p>
          </div>
        ) : (
          <div>
            <div className="divide-y divide-gray-100">
              {paginatedReviews.map((rev) => (
                <div key={rev._id} className="py-4 space-y-2 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">
                          {rev.user_id ? `Khách hàng #${String(rev.user_id).slice(-4)}` : 'Khách hàng FoodFast'}
                        </p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= rev.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-200 fill-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(rev.created_at || Date.now()).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 pl-10 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>

            {/* Phân trang danh sách đánh giá */}
            <Pagination
              currentPage={reviewsPage}
              totalPages={Math.ceil(reviews.length / REVIEWS_PAGE_SIZE) || 1}
              totalItems={reviews.length}
              pageSize={REVIEWS_PAGE_SIZE}
              itemLabel="đánh giá"
              theme="light"
              onPageChange={(p) => setReviewsPage(p)}
              className="mt-4"
            />
          </div>
        )}
      </div>

      {/* Modal Viết Đánh Giá Kích Hoạt RabbitMQ Incentive */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                <Gift className="w-5 h-5 text-orange-600" />
                Đánh giá quán & Nhận 1.000 Xu
              </h3>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewReward ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-center">
                <p className="font-extrabold text-sm text-emerald-800">{reviewReward.title}</p>
                <p className="text-xs text-emerald-700 leading-relaxed">{reviewReward.message}</p>
                <div className="p-2 bg-white rounded-xl border border-emerald-300 font-mono text-xs font-bold text-emerald-800">
                  {reviewReward.type === 'FIVE_STAR' ? 'Mã áp dụng: THANKYOU (Giảm 10%)' : reviewReward.type === 'SORRY' ? 'Mã áp dụng: SORRY (Giảm 20%)' : 'Đã ghi nhận!'}
                </div>
                <button
                  onClick={() => setIsReviewModalOpen(false)}
                  className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Đóng & Tiếp tục đặt món
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* Chọn số sao */}
                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-bold text-gray-700">Chất lượng món ăn & phục vụ:</label>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setReviewRating(num)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            num <= reviewRating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'fill-gray-200 text-gray-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold text-orange-600">
                    {reviewRating === 5 && 'Tuyệt vời! (Tự động tặng mã THANKYOU giảm 10%)'}
                    {reviewRating === 4 && 'Rất ngon & hài lòng'}
                    {reviewRating === 3 && 'Bình thường'}
                    {reviewRating <= 2 && 'Chưa hài lòng (Tự động kích hoạt mã SORRY đền bù 20%)'}
                  </p>
                </div>

                {/* Nhập bình luận */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Cảm nhận chi tiết:</label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Món ăn ngon, giao nhanh, đóng gói cẩn thận..."
                    className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                {reviewError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{reviewError}</span>
                  </p>
                )}

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                  <span>🎁 Hoàn tất đánh giá đơn hàng để nhận ngay <strong>1.000 Xu FoodFast</strong> tích lũy (dùng giảm trừ 1:1 cho các đơn hàng tiếp theo)!</span>
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-2"
                >
                  {submittingReview ? 'Đang gửi đánh giá...' : 'Gửi Đánh Giá (+1.000 Xu) →'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

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

      {/* Modal chọn địa chỉ giao hàng phong cách FoodFast */}
      <AddressPickerModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        currentLocation={userCoord}
        onSelectLocation={setManualLocation}
      />

      {/* Modal tùy biến món ăn chuẩn FoodFast (Size, Toppings, Mức ngọt/đá, Ghi chú quán) */}
      <DishCustomizationModal
        dish={customizingDish}
        isOpen={!!customizingDish}
        onClose={() => setCustomizingDish(null)}
        onConfirm={handleConfirmCustomization}
      />

      {/* Modal chỉnh sửa / giảm biến thể giỏ hàng phong cách FoodFast */}
      <UpdateVariantModal
        isOpen={Boolean(updatingDishVariants)}
        dish={updatingDishVariants?.dish}
        variants={
          updatingDishVariants
            ? getDishVariants(
                updatingDishVariants.dish._id || updatingDishVariants.dish.menuItemId || updatingDishVariants.dish.name,
                updatingDishVariants.dish.name
              )
            : []
        }
        onClose={() => setUpdatingDishVariants(null)}
        onUpdateQuantity={(cartItemId, delta) => {
          updateVariantQuantity(cartItemId, delta);
          setTimeout(() => {
            if (updatingDishVariants) {
              const remaining = getDishVariants(
                updatingDishVariants.dish._id || updatingDishVariants.dish.menuItemId || updatingDishVariants.dish.name,
                updatingDishVariants.dish.name
              );
              if (remaining.length === 0) setUpdatingDishVariants(null);
            }
          }, 50);
        }}
      />
    </div>
  );
}

