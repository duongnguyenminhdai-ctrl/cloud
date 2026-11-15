import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Copy,
  Check,
  Share2,
  Lock,
  Unlock,
  Trash2,
  Plus,
  ArrowLeft,
  Clock,
  MapPin,
  Star,
  Utensils,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Banknote,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { groupOrderApi, restaurantApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import GroupOrderMenuModal from '../components/GroupOrderMenuModal';
import { playNotificationChime } from '../utils/realtimeSync';

export default function GroupOrderPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToCart, clearCart } = useCart();

  const [groupOrder, setGroupOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  // Tham gia phòng (Tên hiển thị)
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joining, setJoining] = useState(false);

  // Host checkout modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('COD');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // Lưu thông tin định danh thành viên hiện tại trong phòng
  const storageMemberKey = `group_member_${roomCode?.toUpperCase()}`;
  const [currentMember, setCurrentMember] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageMemberKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const pollIntervalRef = useRef(null);

  // 1. Tải thông tin phòng từ Order Service
  const fetchGroupRoom = async (isSilent = false) => {
    if (!roomCode) return;
    if (!isSilent) setLoading(true);

    try {
      const res = await groupOrderApi.getRoom(roomCode);
      if (res.data?.success && res.data.data) {
        const roomData = res.data.data;
        setGroupOrder(roomData);
        setError(null);

        if (!checkoutAddress && roomData.deliveryAddress) {
          setCheckoutAddress(roomData.deliveryAddress);
        }

        // Tự động nhận diện quyền Host hoặc Member nếu khớp User ID
        const callerId = user?.id || user?.userId || user?._id;
        if (callerId) {
          const isUserHost = String(roomData.hostId) === String(callerId);
          const matchedMem = (roomData.members || []).find(
            (m) => String(m.userId) === String(callerId)
          );

          if (isUserHost || matchedMem) {
            const memberInfo = {
              memberId: matchedMem ? String(matchedMem._id) : `host_${callerId}`,
              userId: callerId,
              displayName: matchedMem ? matchedMem.displayName : (roomData.hostName || user.name || 'Trưởng nhóm'),
              isHost: isUserHost
            };
            setCurrentMember(memberInfo);
            try {
              sessionStorage.setItem(storageMemberKey, JSON.stringify(memberInfo));
            } catch {}
          }
        }
      } else {
        setError(res.data?.message || 'Không tìm thấy phòng');
      }
    } catch (err) {
      if (!isSilent) {
        setError(err.response?.data?.message || err.message || 'Lỗi kết nối phòng');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Khởi tạo polling mỗi 3 giây
  useEffect(() => {
    fetchGroupRoom(false);

    pollIntervalRef.current = setInterval(() => {
      fetchGroupRoom(true);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [roomCode, user]);

  // Kiểm tra nếu chưa có định danh thành viên thì mở Join Modal
  useEffect(() => {
    if (!loading && groupOrder && !currentMember && groupOrder.status === 'OPEN') {
      if (user?.name || user?.displayName) {
        // Tự động join nếu đã đăng nhập
        handleAutoJoin(user.name || user.displayName);
      } else {
        setJoinModalOpen(true);
      }
    }
  }, [loading, groupOrder, currentMember, user]);

  const handleAutoJoin = async (name) => {
    try {
      const callerId = user?.id || user?.userId || user?._id;
      const res = await groupOrderApi.joinRoom(roomCode, {
        displayName: name,
        userId: callerId || null,
        avatar: user?.avatar || null
      });

      if (res.data?.success && res.data.member) {
        const memberInfo = {
          memberId: String(res.data.member._id),
          userId: callerId || null,
          displayName: res.data.member.displayName,
          isHost: Boolean(res.data.member.isHost)
        };
        setCurrentMember(memberInfo);
        sessionStorage.setItem(storageMemberKey, JSON.stringify(memberInfo));
        fetchGroupRoom(true);
      }
    } catch {}
  };

  const handleManualJoin = async (e) => {
    e.preventDefault();
    if (!joinDisplayName.trim()) return;

    setJoining(true);
    try {
      const callerId = user?.id || user?.userId || user?._id;
      const res = await groupOrderApi.joinRoom(roomCode, {
        displayName: joinDisplayName.trim(),
        userId: callerId || null,
        avatar: user?.avatar || null
      });

      if (res.data?.success && res.data.member) {
        const memberInfo = {
          memberId: String(res.data.member._id),
          userId: callerId || null,
          displayName: res.data.member.displayName,
          isHost: Boolean(res.data.member.isHost)
        };
        setCurrentMember(memberInfo);
        sessionStorage.setItem(storageMemberKey, JSON.stringify(memberInfo));
        setJoinModalOpen(false);
        fetchGroupRoom(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi tham gia phòng');
    } finally {
      setJoining(false);
    }
  };

  // Sao chép link mời vào bộ nhớ tạm
  const handleCopyInviteLink = () => {
    const fullUrl = window.location.href;
    navigator.clipboard?.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Xác định quyền Host
  const isHost = useMemo(() => {
    if (!groupOrder) return false;
    const callerId = user?.id || user?.userId || user?._id;
    if (callerId && String(callerId) === String(groupOrder.hostId)) return true;
    if (currentMember?.isHost) return true;
    return false;
  }, [groupOrder, user, currentMember]);

  // Thêm món vào giỏ nhóm
  const handleAddItemToGroup = async (itemData) => {
    if (!currentMember?.memberId) {
      setJoinModalOpen(true);
      return;
    }

    try {
      const payload = {
        ...itemData,
        memberId: currentMember.memberId,
        memberName: currentMember.displayName
      };

      const res = await groupOrderApi.addItem(roomCode, payload);
      if (res.data?.success) {
        fetchGroupRoom(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Không thể thêm món vào nhóm');
    }
  };

  // Xóa món khỏi giỏ nhóm
  const handleRemoveItem = async (itemId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa món này khỏi giỏ hàng nhóm?')) return;

    try {
      const callerId = currentMember?.memberId || user?.id;
      const res = await groupOrderApi.removeItem(roomCode, itemId, callerId);
      if (res.data?.success) {
        fetchGroupRoom(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi khi xóa món');
    }
  };

  // Khóa / Mở khóa phòng (Host only)
  const handleToggleLock = async () => {
    if (!isHost) return;

    try {
      const callerId = user?.id || user?.userId || user?._id || groupOrder.hostId;
      const willUnlock = groupOrder.status === 'LOCKED';
      const res = await groupOrderApi.lockRoom(roomCode, { hostId: callerId, unlock: willUnlock });
      if (res.data?.success) {
        fetchGroupRoom(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi thay đổi trạng thái phòng');
    }
  };

  // Chốt đơn nhóm (Host only)
  const handleHostCheckout = async (e) => {
    e.preventDefault();
    if (!isHost) return;

    setSubmittingCheckout(true);
    try {
      const callerId = user?.id || user?.userId || user?._id || groupOrder.hostId;
      const payload = {
        hostId: callerId,
        paymentMethod: checkoutPaymentMethod,
        deliveryAddress: checkoutAddress || groupOrder.deliveryAddress || 'TP. Hồ Chí Minh',
        driverNote: checkoutNote.trim()
      };

      const res = await groupOrderApi.checkout(roomCode, payload);
      if (res.data?.success) {
        playNotificationChime();
        setIsCheckoutModalOpen(false);
        const orderId = res.data.order?._id || res.data.data?._id;
        alert('🎉 Chốt đơn nhóm thành công! Đơn hàng đang được điều phối giao.');
        if (orderId) {
          navigate(`/orders/${orderId}`);
        } else {
          navigate('/orders');
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi khi chốt đơn nhóm');
    } finally {
      setSubmittingCheckout(false);
    }
  };

  // Bảng phân bổ chi phí
  const summary = groupOrder?.summary || {
    grossFoodTotal: 0,
    shippingFee: 16000,
    splitCount: 0,
    shippingPerMember: 0,
    membersBreakdown: []
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ece7dc] dark:bg-[#161412] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin text-[#EE4D2D]" />
          <p className="text-sm font-bold">Đang kết nối vào phòng đặt nhóm #{roomCode}...</p>
        </div>
      </div>
    );
  }

  if (error || !groupOrder) {
    return (
      <div className="min-h-screen bg-[#ece7dc] dark:bg-[#161412] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-[#1e1b18] border border-black/10 dark:border-white/10 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Không Thể Truy Cập Phòng</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">{error || 'Phòng không tồn tại hoặc đã bị hủy.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EE4D2D] text-white text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang chủ FoodFast</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ece7dc] dark:bg-[#161412] text-[#2b2520] dark:text-[#ede6d8] transition-colors pb-16">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Nút trở về */}
        <div className="flex items-center justify-between">
          <Link
            to={groupOrder.restaurantId ? `/restaurants/${groupOrder.restaurantId}` : '/'}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-[#EE4D2D] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại quán ăn</span>
          </Link>

          {/* Trạng thái phòng */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Trạng thái:</span>
            {groupOrder.status === 'OPEN' && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đang nhận món (OPEN)
              </span>
            )}
            {groupOrder.status === 'LOCKED' && (
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-extrabold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Đã khóa phòng (LOCKED)
              </span>
            )}
            {groupOrder.status === 'ORDERED' && (
              <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 text-xs font-extrabold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã chốt đơn hoàn tất
              </span>
            )}
          </div>
        </div>

        {/* 1. Header Quán Ăn & Phòng Kèo */}
        <div className="p-6 rounded-3xl sketch-panel bg-[#faf7f2] dark:bg-[#1a1714] border border-[#e5ded3] dark:border-[#38312b] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {groupOrder.restaurantImage ? (
              <img
                src={groupOrder.restaurantImage}
                alt={groupOrder.restaurantName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-black/10"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#EE4D2D]/10 text-[#EE4D2D] flex items-center justify-center shrink-0">
                <Utensils className="w-8 h-8" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-[#EE4D2D] text-white text-[10px] font-black uppercase">
                  Kèo Ăn Trưa
                </span>
                <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
                  Mã: #{groupOrder.roomCode}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                {groupOrder.restaurantName || 'Quán ăn'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span>Trưởng nhóm: <strong>{groupOrder.hostName || 'Host'}</strong></span>
                <span className="mx-1">•</span>
                <span>{groupOrder.members?.length || 1} thành viên tham gia</span>
              </p>
            </div>
          </div>

          {/* Bạn đang tham gia với tư cách */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-white dark:bg-[#221e1a] px-3.5 py-2 rounded-2xl border border-black/5 dark:border-white/5 text-xs">
            <span className="text-gray-500">Bạn là:</span>
            <strong className="text-[#EE4D2D]">
              {currentMember?.displayName || 'Khách'} {isHost && '(Trưởng nhóm)'}
            </strong>
          </div>
        </div>

        {/* 2. Hộp Link Mời (Invite Link Box) */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-[#9a6a3e]/10 border border-[#EE4D2D]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EE4D2D] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-[#EE4D2D]">
                Mời Bạn Bè Cùng Đặt
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Gửi link này cho đồng nghiệp/bạn bè để mọi người tự chọn món vào giỏ chung!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? window.location.href : ''}
              className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#1a1714] border border-black/10 dark:border-white/10 text-gray-700 dark:text-gray-300 font-mono w-48 sm:w-64 truncate"
            />
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="px-3.5 py-1.5 rounded-xl bg-[#EE4D2D] hover:bg-[#dc3f1f] text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. LƯỚI BỐ CỤC: Giỏ hàng chung (Trái) & Bảng phân bổ chi phí (Phải) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (7 Cột): Danh sách giỏ hàng chung gom theo thành viên */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#EE4D2D]" />
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  Giỏ Hàng Nhóm ({groupOrder.items?.length || 0} món)
                </h2>
              </div>

              {groupOrder.status === 'OPEN' && (
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#EE4D2D] hover:bg-[#dc3f1f] text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm món vào kèo</span>
                </button>
              )}
            </div>

            {/* Danh sách món ăn gom theo từng thành viên */}
            {summary.membersBreakdown && summary.membersBreakdown.length > 0 ? (
              <div className="space-y-3.5">
                {summary.membersBreakdown.map((member) => {
                  const isCurrentMemberItem =
                    currentMember &&
                    (String(member.memberId) === String(currentMember.memberId) ||
                      (member.userId && String(member.userId) === String(currentMember.userId)));

                  return (
                    <div
                      key={String(member.memberId)}
                      className={`p-4 rounded-2xl bg-[#faf7f2] dark:bg-[#1a1714] border transition-all ${
                        isCurrentMemberItem
                          ? 'border-[#EE4D2D]/40 shadow-sm ring-1 ring-[#EE4D2D]/20'
                          : 'border-[#e5ded3] dark:border-[#38312b]'
                      }`}
                    >
                      {/* Tiêu đề Thành viên */}
                      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2.5 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-[#EE4D2D] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {member.displayName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                              {member.displayName}
                            </span>
                            {member.isHost && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                Trưởng nhóm
                              </span>
                            )}
                            {isCurrentMemberItem && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EE4D2D]/10 text-[#EE4D2D]">
                                Bạn
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">Tiền món:</span>
                          <span className="text-sm font-black text-[#EE4D2D]">
                            {Number(member.foodTotal || 0).toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      </div>

                      {/* Danh sách món của thành viên này */}
                      {member.items && member.items.length > 0 ? (
                        <div className="space-y-2">
                          {member.items.map((it) => (
                            <div
                              key={String(it._id)}
                              className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-white dark:bg-[#221e1a] border border-black/5 dark:border-white/5"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                  {it.quantity}x {it.name}
                                </span>
                                {it.note && (
                                  <p className="text-[11px] text-gray-400 italic mt-0.5">
                                    Ghi chú: {it.note}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-extrabold text-gray-900 dark:text-gray-100">
                                  {(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString('vi-VN')} đ
                                </span>

                                {/* Nút xóa món: chỉ người tạo món hoặc Host mới được xóa khi phòng OPEN */}
                                {(isCurrentMemberItem || isHost) && groupOrder.status === 'OPEN' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(it._id)}
                                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                    title="Xóa món này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic py-1">
                          Chưa chọn món nào vào giỏ.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#1a1714] border border-dashed border-gray-300 dark:border-gray-700 space-y-2">
                <Utensils className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-500 font-medium">Chưa có thành viên nào chọn món.</p>
                {groupOrder.status === 'OPEN' && (
                  <button
                    type="button"
                    onClick={() => setIsMenuModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#EE4D2D] text-white text-xs font-bold"
                  >
                    Mở thực đơn chọn món ngay
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CỘT PHẢI (5 Cột): Bảng phân bổ chi phí & Điều khiển của Trưởng nhóm */}
          <div className="lg:col-span-5 space-y-4">
            {/* BẢNG PHÂN BỔ CHI PHÍ (BILL SPLITTING ENGINE) */}
            <div className="p-5 rounded-3xl sketch-panel bg-[#faf7f2] dark:bg-[#1a1714] border border-[#e5ded3] dark:border-[#38312b] shadow-sm space-y-4">
              <h3 className="text-base font-black text-gray-900 dark:text-white pb-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <span>Phân Bổ Chi Phí</span>
                <span className="text-xs font-normal text-gray-500">Tự động chia đều ship</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Tổng tiền món ({summary.totalItems || 0} phần):</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {Number(summary.grossFoodTotal || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Phí giao hàng:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {Number(summary.shippingFee || 16000).toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Số người chia ship:</span>
                  <span className="font-bold text-[#EE4D2D]">
                    {summary.splitCount || 0} người có đặt món
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300 bg-amber-500/10 p-2 rounded-xl border border-amber-300 dark:border-amber-800">
                  <span className="font-medium text-amber-800 dark:text-amber-300">Phí ship mỗi người:</span>
                  <span className="font-black text-amber-800 dark:text-amber-300">
                    {Number(summary.shippingPerMember || 0).toLocaleString('vi-VN')} đ / người
                  </span>
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-sm">
                  <span className="font-black text-gray-900 dark:text-white">Tổng đơn cả nhóm:</span>
                  <span className="font-black text-lg text-[#EE4D2D]">
                    {Number(summary.finalTotal || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* BẢNG TIỀN CẦN ĐÓNG TỪNG NGƯỜI */}
              <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                  Chi tiết đóng tiền từng người:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {summary.membersBreakdown && summary.membersBreakdown.map((mb) => (
                    <div
                      key={String(mb.memberId)}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-white dark:bg-[#221e1a] border border-black/5 dark:border-white/5"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-gray-800 dark:text-gray-200 block truncate">
                          {mb.displayName}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Món: {Number(mb.foodTotal || 0).toLocaleString('vi-VN')}đ + Ship: {Number(mb.shippingShare || 0).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <span className="font-black text-[#EE4D2D] whitespace-nowrap">
                        = {Number(mb.totalPayable || 0).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* KHU VỰC ĐIỀU KHIỂN CỦA TRƯỞNG NHÓM (HOST CONTROLS) */}
              {isHost && (
                <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                    Quyền Trưởng Nhóm
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Nút Khóa / Mở phòng */}
                    {groupOrder.status !== 'ORDERED' && (
                      <button
                        type="button"
                        onClick={handleToggleLock}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                          groupOrder.status === 'LOCKED'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        {groupOrder.status === 'LOCKED' ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Mở lại phòng</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Khóa phòng</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Nút Tiến hành chốt đơn */}
                    {groupOrder.status !== 'ORDERED' ? (
                      <button
                        type="button"
                        disabled={(groupOrder.items?.length || 0) === 0}
                        onClick={() => setIsCheckoutModalOpen(true)}
                        className="py-2.5 px-3 rounded-xl bg-[#EE4D2D] hover:bg-[#dc3f1f] text-white font-extrabold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>Chốt đơn nhóm →</span>
                      </button>
                    ) : (
                      <div className="col-span-2 p-2.5 text-center text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                        Đơn hàng đã được chốt và gửi tới nhà hàng!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL NHẬP TÊN THAM GIA PHÒNG */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#1a1714] text-[#2b2520] dark:text-[#ede6d8] border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-[#EE4D2D]/10 text-[#EE4D2D] flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                Tham Gia Kèo #{roomCode}
              </h3>
              <p className="text-xs text-gray-500">
                Nhập tên của bạn để hiển thị cho các thành viên khác trong phòng biết ai đang đặt món.
              </p>
            </div>

            <form onSubmit={handleManualJoin} className="space-y-3">
              <input
                type="text"
                required
                value={joinDisplayName}
                onChange={(e) => setJoinDisplayName(e.target.value)}
                placeholder="Nhập tên của bạn (Ví dụ: Tuấn Anh, Mai Linh...)"
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-[#221e1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/40"
              />

              <button
                type="submit"
                disabled={joining || !joinDisplayName.trim()}
                className="w-full py-2.5 rounded-xl bg-[#EE4D2D] hover:bg-[#dc3f1f] text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {joining ? 'Đang tham gia...' : 'Bắt đầu chọn món'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HOST CHỐT ĐƠN NHÓM */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-white dark:bg-[#1a1714] text-[#2b2520] dark:text-[#ede6d8] border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#EE4D2D]" />
                <span>Xác Nhận Chốt Đơn Cả Nhóm</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleHostCheckout} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-orange-500/10 border border-[#EE4D2D]/30 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                  <span>Tổng cộng cả nhóm:</span>
                  <span className="text-base font-black text-[#EE4D2D]">
                    {Number(summary.finalTotal || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Bao gồm {summary.totalItems || 0} món và phí ship {Number(summary.shippingFee || 16000).toLocaleString('vi-VN')}đ đã được chia đều cho {summary.splitCount} người.
                </p>
              </div>

              {/* Địa chỉ giao hàng */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">Địa chỉ nhận hàng:</label>
                <input
                  type="text"
                  required
                  value={checkoutAddress}
                  onChange={(e) => setCheckoutAddress(e.target.value)}
                  placeholder="Nhập địa chỉ văn phòng / công ty..."
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#221e1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white"
                />
              </div>

              {/* Phương thức thanh toán */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">Phương thức thanh toán:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutPaymentMethod('COD')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold ${
                      checkoutPaymentMethod === 'COD'
                        ? 'border-[#EE4D2D] bg-[#EE4D2D]/10 text-[#EE4D2D]'
                        : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tiền mặt (COD)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckoutPaymentMethod('VNPAY')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold ${
                      checkoutPaymentMethod === 'VNPAY'
                        ? 'border-[#EE4D2D] bg-[#EE4D2D]/10 text-[#EE4D2D]'
                        : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>VNPay Sandbox</span>
                  </button>
                </div>
              </div>

              {/* Ghi chú tài xế */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300">Ghi chú cho tài xế:</label>
                <input
                  type="text"
                  value={checkoutNote}
                  onChange={(e) => setCheckoutNote(e.target.value)}
                  placeholder="Ví dụ: Giao sảnh tòa nhà B, gọi trước khi đến..."
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#221e1a] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingCheckout}
                  className="px-5 py-2 rounded-xl bg-[#EE4D2D] hover:bg-[#dc3f1f] text-white font-extrabold uppercase tracking-wide transition-all shadow-md disabled:opacity-50"
                >
                  {submittingCheckout ? 'Đang tạo đơn...' : 'Xác nhận tạo đơn hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MENU MODAL THỰC ĐƠN QUÁN */}
      <GroupOrderMenuModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        restaurantId={groupOrder.restaurantId}
        onAddItem={handleAddItemToGroup}
        disabled={groupOrder.status !== 'OPEN'}
      />
    </div>
  );
}
