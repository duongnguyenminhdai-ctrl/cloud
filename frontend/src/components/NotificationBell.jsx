import React, { useState, useEffect, useRef } from 'react';
import { Bell, Gift, Check, Trash2, Clock, Star, X, CheckCircle2, Camera, Upload, Briefcase, UserCheck, UserX } from 'lucide-react';
import { notificationApi, reviewApi, storeApi } from '../api/client';
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

  // Xử lý Lời mời làm nhân viên quán
  const [respondingStaffId, setRespondingStaffId] = useState(null);

  const handleRespondStaffInvitation = async (notif, action) => {
    try {
      setRespondingStaffId(notif._id);
      const res = await storeApi.respondStaffInvitation({
        storeId: notif.storeId,
        staffId: notif.staffId,
        action
      });
      if (res.data?.success) {
        alert(res.data.message || (action === 'ACCEPT' ? 'Đã đồng ý gia nhập quán!' : 'Đã từ chối lời mời.'));
        await fetchNotifications();
      } else {
        alert(res.data?.message || 'Có lỗi xảy ra khi xử lý phản hồi.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi khi phản hồi lời mời làm việc.');
    } finally {
      setRespondingStaffId(null);
    }
  };

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
        className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center text-[#2b2721]/80 dark:text-[#ede6d8]/80 hover:text-[#9a6a3e] dark:hover:text-[#e5b887] hover:bg-[#ece7dc]/70 dark:hover:bg-[#2b2520]/70 transition-colors cursor-pointer shrink-0"
        title="Thông báo của bạn"
      >
        <Bell className="w-4 h-4 sm:w-[19px] sm:h-[19px] stroke-[1.75]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-4 sm:h-[18px] px-1 bg-[#c04a2c] text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Thông Báo (Tối ưu full fit trên Mobile: w-[calc(100vw-24px)] max-w-sm) */}
      {isOpen && (
        <div className="absolute -right-10 sm:right-0 mt-2 w-[calc(100vw-24px)] max-w-sm sm:w-96 sketch-panel bg-[#fffdfa] dark:bg-[#1e1b18] rounded-2xl shadow-2xl border border-[rgba(43,39,33,0.14)] dark:border-[rgba(240,234,224,0.12)] z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 bg-[#f2ece1] dark:bg-[#28231e] border-b border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.08)] flex items-center justify-between text-[#2b2721] dark:text-[#ede6d8]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#9a6a3e] dark:text-[#e5b887]" />
              <h4 className="font-extrabold text-sm tracking-tight text-[#2b2721] dark:text-[#ede6d8]">Thông báo</h4>
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-[#845831] dark:text-[#e5b887] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                Đã đọc
              </button>
            )}
          </div>

          {/* Danh sách thông báo */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[rgba(43,39,33,0.06)] dark:divide-[rgba(240,234,224,0.06)]">
            {notifications.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Bell className="w-9 h-9 mx-auto text-[#2b2721]/30 dark:text-[#ede6d8]/30 stroke-[1.5]" />
                <p className="text-xs font-bold text-[#2b2721]/75 dark:text-[#ede6d8]/75">Chưa có thông báo mới nào</p>
                <p className="text-[10px] text-[#2b2721]/50 dark:text-[#ede6d8]/50">Các lời mời làm việc và đánh giá nhận 1.000 Xu sẽ hiện ở đây</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const daysLeft = getDaysRemaining(notif.expiresAt);
                const isStaffInvitation = notif.type === 'STAFF_INVITATION';

                const roleNameMap = {
                  MANAGER: 'Quản lý (Manager)',
                  CASHIER: 'Thu ngân (Cashier)',
                  CHEF: 'Bếp (Chef)',
                  STAFF: 'Nhân viên (Staff)'
                };

                return (
                  <div
                    key={notif._id}
                    className={`p-3.5 hover:bg-[#f2ece1]/60 dark:hover:bg-[#2b2621]/60 transition-colors flex items-start gap-3 relative group ${
                      !notif.isRead
                        ? (isStaffInvitation ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'bg-[#f7f2ea] dark:bg-[#25211c]')
                        : ''
                    }`}
                  >
                    {isStaffInvitation ? (
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                        <Briefcase className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#f2ece1] dark:bg-[#2d2721] text-[#9a6a3e] dark:text-[#e5b887] flex items-center justify-center shrink-0 border border-[rgba(154,106,62,0.25)] dark:border-[rgba(181,129,76,0.25)] shadow-2xs">
                        <Gift className="w-5 h-5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isStaffInvitation && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900 shrink-0">
                              Lời mời việc
                            </span>
                          )}
                          <p className="text-xs font-black text-[#2b2721] dark:text-[#ede6d8] truncate">
                            {notif.title || (isStaffInvitation ? 'Lời mời làm việc' : 'Đơn hàng đã giao thành công!')}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-[#2b2721]/60 dark:text-[#ede6d8]/60 bg-[#ece7dc] dark:bg-[#2b2621] px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-[#2b2721]/40 dark:text-[#ede6d8]/40" />
                          Còn {daysLeft} ngày
                        </span>
                      </div>

                      <p className="text-[11px] text-[#2b2721]/80 dark:text-[#ede6d8]/80 leading-relaxed">
                        {notif.content}
                      </p>

                      {isStaffInvitation && notif.staffRole && (
                        <div className="inline-block text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 px-2 py-0.5 rounded-md">
                          Vị trí đề xuất: {roleNameMap[notif.staffRole] || notif.staffRole}
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between gap-2">
                        {isStaffInvitation ? (
                          !notif.isCompleted ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRespondStaffInvitation(notif, 'ACCEPT')}
                                disabled={respondingStaffId === notif._id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-extrabold rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>{respondingStaffId === notif._id ? 'Đang duyệt...' : 'Đồng ý gia nhập'}</span>
                              </button>
                              <button
                                onClick={() => handleRespondStaffInvitation(notif, 'REJECT')}
                                disabled={respondingStaffId === notif._id}
                                className="px-2 py-1 bg-[#f2ece1] dark:bg-[#2a241f] hover:bg-red-50 dark:hover:bg-red-950/40 text-[#2b2721]/70 dark:text-[#ede6d8]/70 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                <span>Từ chối</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã phản hồi
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => handleOpenReview(notif)}
                            className="px-2.5 py-1 bg-gradient-to-r from-[#9a6a3e] to-[#c28448] dark:from-[#b5814c] dark:to-[#845831] hover:brightness-105 text-white text-[11px] font-extrabold rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                            <span>Đánh giá (+1.000 Xu)</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => handleDeleteNotification(notif._id, e)}
                          className="p-1 text-[#2b2721]/30 dark:text-[#ede6d8]/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn">
          <div className="sketch-panel relative w-full max-w-sm sm:max-w-md bg-[#fffdfa] dark:bg-[#1e1b18] rounded-3xl p-5 sm:p-6 shadow-2xl border border-[rgba(43,39,33,0.14)] dark:border-[rgba(240,234,224,0.12)] space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.08)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#f2ece1] dark:bg-[#2b2520] text-[#9a6a3e] dark:text-[#e5b887] flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#2b2721] dark:text-[#ede6d8]">Đánh giá đơn hàng & Nhận 1.000 Xu</h3>
                  <p className="text-[11px] text-[#2b2721]/60 dark:text-[#ede6d8]/60">{activeReviewModal.storeName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveReviewModal(null)}
                className="p-1 text-[#2b2721]/50 dark:text-[#ede6d8]/50 hover:text-[#2b2721] dark:hover:text-[#ede6d8] rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewedSuccess ? (
              <div className="py-6 text-center space-y-2 text-emerald-600 dark:text-emerald-400 animate-scaleUp">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 animate-bounce" />
                <p className="font-extrabold text-base">Đã nhận 1.000 Xu FoodFast!</p>
                <p className="text-xs text-[#2b2721]/60 dark:text-[#ede6d8]/60">Xu đã được cộng vào tài khoản của bạn để trừ tiền cho đơn sau.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReviewFromBell} className="space-y-4">
                {/* 5 Sao chọn điểm */}
                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-bold text-[#2b2721] dark:text-[#ede6d8]">Chất lượng món ăn & phục vụ:</label>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingScore(star)}
                        className="p-1 hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= ratingScore ? 'fill-[#EE4D2D] text-[#EE4D2D]' : 'fill-[#e5decb] dark:fill-[#383129] text-[#e5decb] dark:text-[#383129]'
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
                  <label className="text-xs font-bold text-[#2b2721] dark:text-[#ede6d8]">Cảm nhận chi tiết:</label>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Món ăn ngon, giao nhanh, đóng gói cẩn thận..."
                    className="w-full p-3 text-xs rounded-xl bg-[#fcfaf7] dark:bg-[#26221d] border border-[rgba(43,39,33,0.18)] dark:border-[rgba(240,234,224,0.14)] text-[#2b2721] dark:text-[#ede6d8] placeholder-[#2b2721]/40 dark:placeholder-[#ede6d8]/40 focus:outline-none focus:ring-2 focus:ring-[#9a6a3e]/15 focus:border-[#9a6a3e] dark:focus:border-[#e5b887]"
                  />
                </div>

                {/* Tải lên hình ảnh món ăn thực tế (Tối đa 5 ảnh) */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#2b2721] dark:text-[#ede6d8] flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-[#EE4D2D]" />
                      Ảnh chụp món ăn ({reviewImages.length}/5)
                    </span>
                    <span className="text-[11px] text-[#2b2721]/50 dark:text-[#ede6d8]/50">JPG, PNG</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {reviewImages.map((img, idx) => (
                      <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border border-[rgba(43,39,33,0.15)] dark:border-[rgba(240,234,224,0.12)] shadow-2xs group">
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
                        className="w-12 h-12 rounded-xl border-2 border-dashed border-[rgba(43,39,33,0.25)] dark:border-[rgba(240,234,224,0.2)] hover:border-[#9a6a3e] dark:hover:border-[#e5b887] hover:bg-[#f2ece1]/50 dark:hover:bg-[#28231e]/50 flex flex-col items-center justify-center text-[#2b2721]/50 dark:text-[#ede6d8]/50 hover:text-[#9a6a3e] dark:hover:text-[#e5b887] cursor-pointer transition"
                      >
                        {uploadingReviewImg ? (
                          <div className="w-3 h-3 border-2 border-[#9a6a3e] border-t-transparent rounded-full animate-spin" />
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

                <div className="p-2.5 bg-[#f5ede1] dark:bg-[#2a241e] rounded-xl border border-[rgba(154,106,62,0.3)] dark:border-[rgba(181,129,76,0.3)] text-[11px] text-[#845831] dark:text-[#e5b887] font-medium">
                  🎁 Đánh giá đơn hàng để nhận ngay <strong>1.000 Xu FoodFast</strong> tích lũy (dùng giảm giá 1:1 khi thanh toán đơn hàng tiếp theo).
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReviewModal(null);
                      setReviewImages([]);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#f2ece1] dark:bg-[#28231e] hover:bg-[#ebe2d3] dark:hover:bg-[#322c26] text-[#2b2721] dark:text-[#ede6d8] text-xs font-bold transition-colors cursor-pointer"
                  >
                    Để sau
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#9a6a3e] to-[#b57d47] dark:from-[#b5814c] dark:to-[#845831] hover:brightness-105 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#9a6a3e]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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

