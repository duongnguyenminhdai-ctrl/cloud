import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Gift,
  Flame,
  Coins,
  Check,
  CheckCircle2,
  X,
  HelpCircle,
  Trophy,
  Zap,
  Tag
} from 'lucide-react';
import { checkInApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function DailyCheckInModal({ isOpen, onClose }) {
  const { user, isAuthenticated, updateUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  // Dữ liệu bảng điểm danh
  const [checkInData, setCheckInData] = useState({
    monthYear: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    todayDay: new Date().getDate(),
    todayDateStr: '',
    daysInMonth: 30,
    firstDayOfWeek: 0,
    checkedInDays: [],
    totalCheckedInDays: 0,
    currentStreak: 0,
    highestStreak: 0,
    isCheckedInToday: false,
    claimedMilestones: [],
    rewardIfCheckIn: 500,
    userCoins: user?.coins || 0
  });

  const fetchStatus = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await checkInApi.getCheckInStatus();
      if (res.data?.success && res.data?.data) {
        setCheckInData(res.data.data);
        if (res.data.data.userCoins !== undefined) {
          updateUserProfile({ coins: res.data.data.userCoins });
        }
      }
    } catch (err) {
      console.warn('Lỗi lấy trạng thái điểm danh:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, isAuthenticated]);

  // Thực hiện điểm danh hôm nay
  const handleClaimDaily = async () => {
    if (checkInData.isCheckedInToday || claimingDaily) return;
    try {
      setClaimingDaily(true);
      const res = await checkInApi.claimDaily();
      if (res.data?.success) {
        const { rewardCoins, newCoinsBalance, currentStreak, totalCheckedInDays, checkedInDays } = res.data.data;
        setCheckInData((prev) => ({
          ...prev,
          isCheckedInToday: true,
          currentStreak,
          totalCheckedInDays,
          checkedInDays,
          userCoins: newCoinsBalance
        }));
        updateUserProfile({ coins: newCoinsBalance });
        setSuccessToast(`+${rewardCoins.toLocaleString('vi-VN')} Xu FoodFast! (Chuỗi ${currentStreak} ngày liên tiếp)`);
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi điểm danh.');
    } finally {
      setClaimingDaily(false);
    }
  };

  // Nhận quà theo mốc
  const handleClaimMilestone = async (milestone) => {
    if (claimingMilestone) return;
    try {
      setClaimingMilestone(milestone);
      const res = await checkInApi.claimMilestone(milestone);
      if (res.data?.success) {
        const { claimedMilestones, newCoinsBalance, voucherCode } = res.data.data;
        setCheckInData((prev) => ({
          ...prev,
          claimedMilestones,
          userCoins: newCoinsBalance || prev.userCoins
        }));
        if (newCoinsBalance) {
          updateUserProfile({ coins: newCoinsBalance });
        }
        if (milestone === 25) {
          setSuccessToast(`🎉 Đã mở khóa thành công Voucher độc quyền GIAM30K (Giảm 30.000đ khi đặt món)!`);
        } else {
          setSuccessToast(res.data.message || `Đã nhận quà mốc ${milestone} ngày!`);
        }
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi nhận thưởng mốc.');
    } finally {
      setClaimingMilestone(null);
    }
  };

  // Tạo lưới ô lịch
  const calendarCells = useMemo(() => {
    const cells = [];
    const { daysInMonth, firstDayOfWeek } = checkInData;
    // Các ô trống đầu tháng
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ isBlank: true, key: `blank-${i}` });
    }
    // Các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
      const isChecked = checkInData.checkedInDays.includes(day);
      const isToday = day === checkInData.todayDay;
      const isPast = day < checkInData.todayDay;
      const isFuture = day > checkInData.todayDay;
      // Dự kiến xu: ngày 1-7 là 500 xu, ngày 8-31 là 1000 xu
      const estimatedCoins = day <= 7 ? 500 : 1000;
      cells.push({
        isBlank: false,
        day,
        isChecked,
        isToday,
        isPast,
        isFuture,
        estimatedCoins,
        key: `day-${day}`
      });
    }
    return cells;
  }, [checkInData]);

  const milestonesList = [
    {
      day: 3,
      rewardText: '+500 Xu',
      rewardSub: 'Thỏi Xu Bạc',
      icon: <Coins className="w-5 h-5 text-amber-500 fill-amber-400" />
    },
    {
      day: 7,
      rewardText: '+1.000 Xu',
      rewardSub: 'Hũ Vàng Tích Lũy',
      icon: <Coins className="w-6 h-6 text-amber-500 fill-amber-400" />
    },
    {
      day: 14,
      rewardText: '+2.000 Xu',
      rewardSub: 'Rương Kho Báu Xu',
      icon: <Trophy className="w-6 h-6 text-amber-600 fill-amber-500" />
    },
    {
      day: 25,
      rewardText: 'Voucher GIAM30K',
      rewardSub: 'Giảm 30K trên giá món',
      isVoucher: true,
      icon: <Tag className="w-6 h-6 text-red-500 fill-red-400" />
    }
  ];

  // Khóa scroll của body khi modal điểm danh mở để không bị cuộn trang nền
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[999999] overflow-y-auto p-2 sm:p-4 bg-black/70 dark:bg-black/85 backdrop-blur-xs flex items-start sm:items-center justify-center py-4 sm:py-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Toast thông báo chúc mừng */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000000] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-bounce">
          <Coins className="w-4 h-4 text-yellow-200 fill-yellow-200" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Panel Điểm Danh - Đồng bộ 100% Theme Sổ Tay Ký Họa & TMĐT FoodFast (Light & Dark) */}
      <div
        className="relative w-full max-w-4xl my-auto max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-[rgba(43,39,33,0.14)] dark:border-[rgba(240,234,224,0.12)] bg-[#f7f4ee] dark:bg-[#1c1916] text-[#2b2721] dark:text-[#ede6d8] font-sans flex flex-col select-none transition-colors duration-200 scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* =================================================================== */}
        {/* HEADER PANEL: Logo FoodFast + Tiêu Đề & Ngày Chuẩn Tiếng Việt + Controls */}
        {/* =================================================================== */}
        <div className="relative px-4 sm:px-6 py-3.5 sm:py-4 bg-[#fbf9f5] dark:bg-[#1f1b17] border-b border-[rgba(43,39,33,0.12)] dark:border-[rgba(240,234,224,0.12)] flex items-center justify-between gap-3 transition-colors">
          {/* Cụm trái: Logo FoodFast & Nhận diện thương hiệu */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-[rgba(154,106,62,0.25)] dark:border-[rgba(240,234,224,0.14)] shadow-xs">
              <img
                src="/foodfast-logo.png"
                alt="FoodFast Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-serif text-sm sm:text-base font-bold text-[#2b2721] dark:text-[#ede6d8] leading-tight">
                FoodFast
              </span>
              <span className="text-[10px] text-[#9a6a3e] dark:text-[#e5b887] font-semibold uppercase tracking-wider">
                Sổ tay mỹ vị
              </span>
            </div>
          </div>

          {/* Cụm giữa: Tiêu đề ĐIỂM DANH & Ngày tháng chuẩn tiếng Việt (Ngày 15 tháng 11 năm 2026) */}
          <div className="text-center flex flex-col items-center">
            <h2 className="font-serif text-base sm:text-xl font-bold tracking-wide text-[#845831] dark:text-[#f5c542] flex items-center justify-center gap-1.5 uppercase drop-shadow-xs">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />
              <span>ĐIỂM DANH MỖI NGÀY</span>
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2b2721]/70 dark:text-[#ede6d8]/80 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-[#9a6a3e] dark:text-[#e5b887]" />
              <span>Ngày {checkInData.todayDay} tháng {checkInData.month} năm {checkInData.year}</span>
            </div>
          </div>

          {/* Cụm phải: Số dư Xu badge & Nút Quy tắc ? & Nút Đóng X */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-[11px] font-bold text-amber-800 dark:text-amber-300 shadow-2xs">
              <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>{Number(checkInData.userCoins || 0).toLocaleString('vi-VN')} Xu</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRules(!showRules)}
              className="p-1.5 sm:p-2 text-stone-500 hover:text-[#9a6a3e] dark:text-[#ede6d8]/60 dark:hover:text-[#f5c542] hover:bg-[#ece7dc]/60 dark:hover:bg-[#2b2520] rounded-xl transition-colors cursor-pointer"
              title="Quy tắc điểm danh nhận xu"
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-stone-500 hover:text-red-500 dark:text-[#ede6d8]/60 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
              title="Đóng bảng điểm danh"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal nhỏ hiển thị Quy tắc nếu bấm nút ? */}
        {showRules && (
          <div className="p-3.5 bg-[#f0e7d8] dark:bg-[#231e19] border-b border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.1)] text-xs text-[#2b2721] dark:text-[#ede6d8] space-y-1.5 animate-fadeIn transition-colors">
            <p className="font-bold text-[#845831] dark:text-[#f5c542] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Quy tắc Điểm danh FoodFast:</span>
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-[#2b2721]/80 dark:text-[#ede6d8]/80 pl-1">
              <li>Mỗi ngày điểm danh nhận ngay <strong>500 Xu FoodFast</strong> vào tài khoản.</li>
              <li>Nếu duy trì chuỗi liên tục (streak) trên 7 ngày: nhận gấp đôi <strong>1.000 Xu / ngày</strong>!</li>
              <li>Tích lũy mốc trong tháng: <strong>3 ngày (500 xu)</strong>, <strong>7 ngày (1.000 xu)</strong>, <strong>14 ngày (2.000 xu)</strong>, <strong>25 ngày (Voucher độc quyền GIAM30K)</strong>.</li>
              <li>Voucher <strong>GIAM30K</strong> là voucher đặc quyền, chỉ người hoàn thành mốc 25 ngày mới có thể áp dụng khi đặt món.</li>
            </ul>
          </div>
        )}

        {/* =================================================================== */}
        {/* BODY PANEL: LƯỚI LỊCH (TRÁI) & CỘT ĐIỀU KHIỂN (PHẢI) */}
        {/* =================================================================== */}
        <div className="p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 bg-[#f2ece1] dark:bg-[#161412] transition-colors">
          
          {/* CỘT TRÁI: LƯỚI LỊCH THÁNG (7 CỘT) */}
          <div className="lg:col-span-8 bg-[#fffdfa] dark:bg-[#1e1b18] border border-[rgba(43,39,33,0.12)] dark:border-[rgba(240,234,224,0.1)] rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col justify-between transition-colors">
            {/* Hàng Tiêu Đề 7 Thứ trong tuần */}
            <div className="grid grid-cols-7 gap-1 text-center pb-2 border-b border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.1)] text-[11px] sm:text-xs font-bold">
              <span className="text-[#EE4D2D] dark:text-[#f5c542]">Chủ Nhật</span>
              <span className="text-[#5c4f43] dark:text-[#ede6d8]/80">Thứ hai</span>
              <span className="text-[#5c4f43] dark:text-[#ede6d8]/80">Thứ ba</span>
              <span className="text-[#5c4f43] dark:text-[#ede6d8]/80">Thứ tư</span>
              <span className="text-[#5c4f43] dark:text-[#ede6d8]/80">Thứ năm</span>
              <span className="text-[#5c4f43] dark:text-[#ede6d8]/80">Thứ sáu</span>
              <span className="text-[#9a6a3e] dark:text-[#e5b887]">Thứ bảy</span>
            </div>

            {/* Các ô ngày trong tháng */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-2">
              {calendarCells.map((cell) => {
                if (cell.isBlank) {
                  return <div key={cell.key} className="h-10 sm:h-12 bg-transparent rounded-xl" />;
                }

                return (
                  <div
                    key={cell.key}
                    onClick={() => {
                      if (cell.isToday && !cell.isChecked) {
                        handleClaimDaily();
                      }
                    }}
                    className={`relative h-10 sm:h-12 rounded-xl border p-1 flex flex-col justify-between transition-all select-none ${
                      cell.isToday
                        ? 'border-[#EE4D2D] dark:border-[#f5c542] bg-orange-50/80 dark:bg-[#2c221a] shadow-[0_0_12px_rgba(238,77,45,0.2)] dark:shadow-[0_0_12px_rgba(245,197,66,0.15)] ring-1 ring-[#EE4D2D] dark:ring-[#f5c542]'
                        : cell.isChecked
                        ? 'border-[rgba(154,106,62,0.2)] dark:border-[rgba(240,234,224,0.08)] bg-[#f7f3eb] dark:bg-[#181512]'
                        : 'border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.08)] bg-[#fffdfa] dark:bg-[#25201b] hover:bg-[#f2ece1] dark:hover:bg-[#2e2820]'
                    } ${cell.isToday && !cell.isChecked ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
                  >
                    {/* Số ngày */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] sm:text-xs font-black ${
                          cell.isToday
                            ? 'text-[#EE4D2D] dark:text-[#f5c542]'
                            : cell.isChecked
                            ? 'text-stone-400 dark:text-stone-500'
                            : 'text-[#2b2721] dark:text-[#ede6d8]'
                        }`}
                      >
                        {cell.day}
                      </span>

                      {/* Icon xu nhỏ góc phải */}
                      <div className="flex items-center gap-0.5 opacity-80">
                        <Coins className="w-2.5 h-2.5 text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400" />
                      </div>
                    </div>

                    {/* MỘC DẤU ĐỎ: "ĐÃ ĐIỂM DANH" (Phong cách mộc son Sổ Tay Ký Họa) */}
                    {cell.isChecked && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                        <div className="px-1 py-0.5 border border-[#c04a2c] dark:border-[#e5533d] text-[#c04a2c] dark:text-[#f87171] text-[8px] sm:text-[9px] font-black uppercase tracking-tighter -rotate-12 rounded bg-red-50/90 dark:bg-red-950/70 shadow-2xs scale-90 sm:scale-100">
                          ĐÃ ĐIỂM DANH
                        </div>
                      </div>
                    )}

                    {/* Trạng thái hôm nay chưa điểm danh */}
                    {cell.isToday && !cell.isChecked && (
                      <div className="text-[8px] font-extrabold text-[#EE4D2D] dark:text-[#f5c542] text-center animate-pulse">
                        Nhận ngay!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chú thích chân lịch */}
            <div className="pt-2 mt-2 border-t border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.08)] flex items-center justify-between text-[11px] text-[#2b2721]/60 dark:text-[#ede6d8]/60 transition-colors">
              <span>Lịch chuẩn: Tháng {checkInData.month} có {checkInData.daysInMonth} ngày</span>
              <span className="flex items-center gap-1 text-[#845831] dark:text-[#f5c542] font-bold">
                <Coins className="w-3.5 h-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400" />
                <span>Số dư ví: <strong>{Number(checkInData.userCoins || 0).toLocaleString('vi-VN')} Xu</strong></span>
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: BANNER, NÚT ĐIỂM DANH & TIẾN ĐỘ THÁNG */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
            {/* Banner Chuỗi Điểm Danh */}
            <div className="relative rounded-2xl overflow-hidden border border-orange-200/80 dark:border-orange-800/40 bg-gradient-to-br from-[#fff7ed] via-[#fef3c7] to-[#fed7aa] dark:from-[#2a221b] dark:via-[#231d17] dark:to-[#1a1613] p-3.5 text-center shadow-xs transition-colors">
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                  <Flame className="w-5 h-5 fill-yellow-200 text-yellow-200 animate-pulse" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-[#2b2721]/60 dark:text-[#ede6d8]/60 tracking-wider">Chuỗi điểm danh</div>
                  <div className="text-sm font-black text-[#845831] dark:text-[#f5c542]">
                    {checkInData.currentStreak} ngày liên tiếp
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/90 dark:bg-black/40 border border-amber-200/80 dark:border-stone-800 text-xs space-y-1 text-[#2b2721] dark:text-[#ede6d8]">
                <p>
                  Điểm danh hàng ngày: nhận <span className="text-[#845831] dark:text-[#f5c542] font-bold">500 Xu</span>
                </p>
                <p>
                  Chuỗi trên 7 ngày: nhận <span className="text-emerald-600 dark:text-emerald-400 font-bold">1.000 Xu/ngày</span>
                </p>
              </div>
            </div>

            {/* Khối Thao Tác: Nút Điểm danh to & Nút Đã điểm danh */}
            <div className="space-y-2">
              {checkInData.isCheckedInToday ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl bg-[#ece4d6] dark:bg-[#25201b] border border-[rgba(154,106,62,0.3)] dark:border-[rgba(240,234,224,0.14)] text-emerald-700 dark:text-emerald-400 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-default shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Đã điểm danh hôm nay</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClaimDaily}
                  disabled={claimingDaily}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#EE4D2D] via-orange-500 to-[#c04a2c] hover:from-[#d73f21] hover:to-[#a93b1e] text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 transition-all cursor-pointer animate-pulse"
                >
                  <Coins className="w-4 h-4 text-yellow-200 fill-yellow-200" />
                  <span>
                    {claimingDaily
                      ? 'Đang nhận xu...'
                      : `Điểm danh ngay (+${checkInData.rewardIfCheckIn.toLocaleString('vi-VN')} Xu)`}
                  </span>
                </button>
              )}

              {/* Thông số thống kê */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-[#fffdfa] dark:bg-[#1e1b18] border border-[rgba(43,39,33,0.12)] dark:border-[rgba(240,234,224,0.1)] transition-colors shadow-2xs">
                  <div className="text-[10px] text-[#2b2721]/60 dark:text-[#ede6d8]/60 font-medium">Đã điểm danh</div>
                  <div className="font-extrabold text-[#845831] dark:text-[#f5c542] text-sm">
                    {checkInData.totalCheckedInDays} / {checkInData.daysInMonth} Ngày
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#fffdfa] dark:bg-[#1e1b18] border border-[rgba(43,39,33,0.12)] dark:border-[rgba(240,234,224,0.1)] transition-colors shadow-2xs">
                  <div className="text-[10px] text-[#2b2721]/60 dark:text-[#ede6d8]/60 font-medium">Kỷ lục chuỗi</div>
                  <div className="font-extrabold text-orange-600 dark:text-orange-400 text-sm">
                    {checkInData.highestStreak} Ngày 🔥
                  </div>
                </div>
              </div>
            </div>

            {/* Dòng thông báo số lần điểm danh trong tháng */}
            <div className="text-center text-xs text-[#2b2721]/70 dark:text-[#ede6d8]/70">
              Tháng này đã tích lũy <strong className="text-[#845831] dark:text-[#f5c542]">{checkInData.totalCheckedInDays}</strong> ngày điểm danh
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* FOOTER PANEL: DÃY PHẦN THƯỞNG MỐC 3, 7, 14, 25 NGÀY */}
        {/* =================================================================== */}
        <div className="px-3 sm:px-5 py-3.5 bg-[#fbf9f5] dark:bg-[#1c1916] border-t border-[rgba(43,39,33,0.12)] dark:border-[rgba(240,234,224,0.12)] space-y-2.5 transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#845831] dark:text-[#f5c542] uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Quà Tặng Tích Lũy Theo Mốc Tháng</span>
            </span>
            <span className="text-[11px] text-[#2b2721]/60 dark:text-[#ede6d8]/60">
              Đạt đủ số ngày để mở khóa quà mốc
            </span>
          </div>

          {/* Dãy 4 thẻ mốc */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {milestonesList.map((m) => {
              const isClaimed = checkInData.claimedMilestones?.includes(m.day);
              const isEligible = checkInData.totalCheckedInDays >= m.day;

              return (
                <div
                  key={m.day}
                  className={`p-2.5 rounded-2xl border flex flex-col justify-between relative transition-all ${
                    isClaimed
                      ? 'bg-[#f0e8dc] dark:bg-[#181512] border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.08)] opacity-85'
                      : isEligible
                      ? 'bg-[#fffdfa] dark:bg-[#28211b] border-[#EE4D2D] dark:border-[#f5c542] shadow-[0_0_12px_rgba(238,77,45,0.15)] ring-1 ring-[#EE4D2D]/30'
                      : 'bg-[#fffdfa] dark:bg-[#201c18] border-[rgba(43,39,33,0.1)] dark:border-[rgba(240,234,224,0.08)]'
                  }`}
                >
                  {/* Nhãn mốc ngày */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#845831] dark:text-[#f5c542]">
                      {m.day} Ngày
                    </span>
                    <span className="text-[10px] font-semibold text-[#2b2721]/50 dark:text-[#ede6d8]/50">
                      {checkInData.totalCheckedInDays}/{m.day}
                    </span>
                  </div>

                  {/* Icon quà & Tên quà */}
                  <div className="text-center py-1">
                    <div className="w-9 h-9 mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center mb-1 shadow-2xs">
                      {m.icon}
                    </div>
                    <div className="text-xs font-extrabold text-[#2b2721] dark:text-[#ede6d8] truncate" title={m.rewardText}>
                      {m.rewardText}
                    </div>
                    <div className="text-[10px] text-[#2b2721]/60 dark:text-[#ede6d8]/60 truncate">
                      {m.rewardSub}
                    </div>
                  </div>

                  {/* Nút hành động cho mốc */}
                  <div className="mt-2 pt-1 border-t border-[rgba(43,39,33,0.08)] dark:border-[rgba(240,234,224,0.08)]">
                    {isClaimed ? (
                      <div className="w-full py-1 text-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg border border-emerald-300 dark:border-emerald-700/50 flex items-center justify-center gap-1">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Đã nhận</span>
                      </div>
                    ) : isEligible ? (
                      <button
                        type="button"
                        onClick={() => handleClaimMilestone(m.day)}
                        disabled={claimingMilestone === m.day}
                        className="w-full py-1 bg-gradient-to-r from-[#EE4D2D] to-orange-500 hover:from-[#d73f21] hover:to-orange-600 text-white text-[10px] font-bold uppercase rounded-lg shadow-xs active:scale-95 transition cursor-pointer animate-pulse"
                      >
                        {claimingMilestone === m.day ? 'Đang nhận...' : 'Nhận quà'}
                      </button>
                    ) : (
                      <div className="w-full py-1 text-center text-[10px] font-medium text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-[#181512] rounded-lg">
                        Chưa đạt
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
