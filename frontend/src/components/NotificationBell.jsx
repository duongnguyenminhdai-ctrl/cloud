import React, { useState, useEffect, useRef } from 'react';
import { Bell, Gift, Check, Trash2, Clock, Star, X, CheckCircle2, Camera, Upload } from 'lucide-react';
import { notificationApi, reviewApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { compressReviewImage } from '../utils/imageHelpers';
import { playNotificationChime } from '../utils/realtimeSync';

export default function NotificationBell({ onReviewOrder }) {
  const { user, isAuthenticated, updateUserProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Modal đánh giá trực tiếp từ chuông thông báo
  const [activeReviewModal, setActiveReviewModal] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedSuccess, setReviewedSuccess] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewImages, setReviewImages] = useState([]);
  const [uploadingReviewImg, setUploadingReviewImg] = useState(false);
  const reviewFileInputRef = useRef(null);

  const handleReviewImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (reviewImages.length + files.length > 5) {
      alert('Tối đa 5 hình ảnh cho mỗi đánh giá.');
      return;
    }
    try {
      setUploadingReviewImg(true);
      const newImages = [];
      for (const file of files) {
        const compressed = await compressReviewImage(file);
        newImages.push(compressed);
      }
      setReviewImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      alert('Không thể xử lý ảnh: ' + err.message);
    } finally {
      setUploadingReviewImg(false);
      if (reviewFileInputRef.current) reviewFileInputRef.current.value = '';
    }
  };

  const handleRemoveReviewImage = (idx) => {
    setReviewImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationApi.getMyNotifications();
      if (res.data?.success) {
        const list = res.data.data || [];
        setNotifications(list);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Bỏ qua lỗi kết nối nhẹ
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000); // Polling dự phòng mỗi 25s
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Lắng nghe SSE Realtime chuông thông báo
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const currentUserId = user.id || user.userId || user._id;
    if (!currentUserId) return;

    let eventSource;
    try {
      const streamUrl = `/api/v1/restaurants/stream?userId=${currentUserId}`;
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener('notification.created', (e) => {
        try {
          const payload = JSON.parse(e.data);
          playNotificationChime();
          fetchNotifications();
        } catch {}
      });

      eventSource.addEventListener('coins.updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.newCoinsBalance !== undefined) {
            updateUserProfile({ coins: payload.newCoinsBalance });
          }
        } catch {}
      });
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isAuthenticated, user]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAsRead('all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleDeleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleOpenReview = (notif) => {
    setRatingScore(5);
    setReviewComment('');
    setReviewImages([]);
    setReviewError(null);
    setReviewedSuccess(false);
    setActiveReviewModal(notif);
    setIsOpen(false);
  };

  const handleSubmitReviewFromBell = async (e) => {
    e.preventDefault();
    if (!activeReviewModal) return;

    setSubmittingReview(true);
    setReviewError(null);

    try {
      const res = await reviewApi.create({
        order_id: activeReviewModal.orderId,
        store_id: activeReviewModal.storeId,
        rating: Number(ratingScore),
        comment: reviewComment.trim() || 'Món ăn ngon, giao hàng nhanh chóng!',
        userName: user?.name || 'Khách hàng FoodFast',
        userAvatar: user?.avatar || '',
        criteria: {
          taste: Number(ratingScore) >= 4 ? 'Tuyệt vời' : Number(ratingScore) === 3 ? 'Tạm ổn' : 'Chưa hợp khẩu vị',
          packaging: Number(ratingScore) >= 4 ? 'Cẩn thận, sạch sẽ' : 'Bình thường',
          deliverySpeed: Number(ratingScore) >= 4 ? 'Giao siêu tốc' : 'Đúng giờ'
        },
        purchasedItem: {
          name: activeReviewModal.storeName || 'Món ăn đặc sản',
          options: 'Đơn hàng giao thành công'
        },
        images: reviewImages
      });

      if (res.data?.success) {
        setReviewedSuccess(true);
        // Cập nhật số xu trong context
        if (res.data.newCoinsBalance !== undefined) {
          updateUserProfile({ coins: res.data.newCoinsBalance });
        } else if (user) {
          updateUserProfile({ coins: (user.coins || 0) + 1000 });
        }

        // Tải lại thông báo
        fetchNotifications();

        setTimeout(() => {
          setActiveReviewModal(null);
          setReviewImages([]);
          setReviewedSuccess(false);
        }, 1800);
      } else {
        setReviewError(res.data?.message || 'Không thể gửi đánh giá');
      }
    } catch (err) {
      setReviewError(err.response?.data?.message || err.message || 'Lỗi gửi đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Tính số ngày còn lại đến khi hết hạn
  const getDaysRemaining = (expiresAt) => {
    if (!expiresAt) return 7;
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút Chuông Thông Báo */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            handleMarkAllRead();
          }
        }}
        className="relative p-2.5 rounded-xl text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-colors"
        title="Thông báo của bạn"
      >
        <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-600 text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Thông Báo */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <h4 className="font-black text-sm tracking-tight">Thông báo</h4>
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-orange-100 hover:text-white hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Đã đọc
              </button>
            )}
          </div>

          {/* Danh sách thông báo */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto text-gray-300 stroke-[1.5]" />
                <p className="text-xs font-semibold">Chưa có thông báo mới nào</p>
                <p className="text-[10px] text-gray-400">Các thông báo mời đánh giá nhận 1.000 Xu sẽ hiện ở đây</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const daysLeft = getDaysRemaining(notif.expiresAt);
                return (
                  <div
                    key={notif._id}
                    className={`p-3.5 hover:bg-orange-50/50 transition-colors flex items-start gap-3 relative group ${
                      !notif.isRead ? 'bg-orange-50/30' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Gift className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-black text-gray-900 truncate">
                          {notif.title || 'Đơn hàng đã giao thành công!'}
                        </p>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          Còn {daysLeft} ngày
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">
                        {notif.content}
                      </p>

                      <div className="pt-1 flex items-center justify-between">
                        <button
                          onClick={() => handleOpenReview(notif)}
                          className="px-2.5 py-1 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-[11px] font-extrabold rounded-lg shadow-sm flex items-center gap-1 transition-all"
                        >
                          <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
                          <span>Đánh giá (+1.000 Xu)</span>
                        </button>

                        <button
                          onClick={(e) => handleDeleteNotification(notif._id, e)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Xóa thông báo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal Đánh Giá Trực Tiếp Từ Chuông Thông Báo */}
      {activeReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">Đánh giá đơn hàng & Nhận 1.000 Xu</h3>
                  <p className="text-[11px] text-gray-500">{activeReviewModal.storeName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveReviewModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewedSuccess ? (
              <div className="py-6 text-center space-y-2 text-emerald-600 animate-scaleUp">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 animate-bounce" />
                <p className="font-extrabold text-base">Đã nhận 1.000 Xu FoodFast!</p>
                <p className="text-xs text-gray-500">Xu đã được cộng vào tài khoản của bạn để trừ tiền cho đơn sau.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReviewFromBell} className="space-y-4">
                {/* 5 Sao chọn điểm */}
                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-bold text-gray-700">Chất lượng món ăn & phục vụ:</label>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingScore(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= ratingScore ? 'fill-[#EE4D2D] text-[#EE4D2D]' : 'fill-gray-200 text-gray-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold text-[#EE4D2D]">
                    {ratingScore === 5 && 'Tuyệt vời! (+1.000 Xu & Tặng voucher tri ân)'}
                    {ratingScore === 4 && 'Rất ngon & hài lòng (+1.000 Xu)'}
                    {ratingScore === 3 && 'Bình thường (+1.000 Xu)'}
                    {ratingScore <= 2 && 'Chưa hài lòng (+1.000 Xu & Tặng voucher xin lỗi)'}
                  </p>
                </div>

                {/* Nhập nhận xét */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Cảm nhận chi tiết:</label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Món ăn ngon, giao nhanh, đóng gói cẩn thận..."
                    className="w-full p-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                {/* Tải lên hình ảnh món ăn thực tế (Tối đa 5 ảnh) */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-[#EE4D2D]" />
                      Ảnh chụp món ăn ({reviewImages.length}/5)
                    </span>
                    <span className="text-[11px] text-gray-400">JPG, PNG</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {reviewImages.map((img, idx) => (
                      <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 shadow-2xs group">
                        <img src={img} alt="review upload" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveReviewImage(idx)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {reviewImages.length < 5 && (
                      <button
                        type="button"
                        onClick={() => reviewFileInputRef.current?.click()}
                        disabled={uploadingReviewImg}
                        className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#EE4D2D] hover:bg-orange-50/30 flex flex-col items-center justify-center text-gray-400 hover:text-[#EE4D2D] cursor-pointer transition"
                      >
                        {uploadingReviewImg ? (
                          <div className="w-3 h-3 border-2 border-[#EE4D2D] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span className="text-[8px] font-bold mt-0.5">Thêm ảnh</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    ref={reviewFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleReviewImageUpload}
                  />
                </div>

                {reviewError && (
                  <p className="text-xs text-red-600 font-medium">{reviewError}</p>
                )}

                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 font-medium">
                  🎁 Đánh giá đơn hàng để nhận ngay <strong>1.000 Xu FoodFast</strong> tích lũy (dùng giảm giá 1:1 khi thanh toán đơn hàng tiếp theo).
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReviewModal(null);
                      setReviewImages([]);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                  >
                    Để sau
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex-1 py-2.5 bg-[#EE4D2D] hover:bg-[#d73f21] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    {submittingReview ? 'Đang gửi...' : 'Gửi Đánh Giá (+1.000 Xu)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

