import React, { useState, useEffect, useMemo } from 'react';
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
  Tag,
  Sparkles
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      {/* Toast thông báo chúc mừng */}
      {successToast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-60 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-yellow-200 fill-yellow-200" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Panel Điểm Danh - Phong cách Truy Kích & FoodFast Candlelit (Tối ưu Responsive Mobile: max-h-[92vh] overflow-y-auto) */}
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-[#3b4c5a] dark:border-[#4a5f70] bg-[#1a232c] text-[#e3edf7] font-sans flex flex-col select-none scrollbar-thin">
        
        {/* =================================================================== */}
        {/* HEADER PANEL (Phong cách HUD Truy Kích) */}
        {/* =================================================================== */}
        <div className="relative px-4 py-3 bg-gradient-to-r from-[#17222c] via-[#223342] to-[#17222c] border-b border-[#2e4356] flex items-center justify-between">
          {/* Tab góc trái */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-t-lg bg-[#2b4154] border-t border-l border-r border-[#456784] text-[#86e2d5] text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-inner">
              <Calendar className="w-3.5 h-3.5" />
              <span>Ngày điểm danh</span>
            </div>
          </div>

          {/* Tiêu đề vàng gold ở giữa & Ngày tháng năm */}
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-black tracking-widest text-[#f5c542] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase">
              ĐIỂM DANH
            </h2>
            <p className="text-[11px] font-bold text-[#86e2d5] tracking-wide font-mono">
              {checkInData.year}Năm{String(checkInData.month).padStart(2, '0')}Tháng{String(checkInData.todayDay).padStart(2, '0')}Ngày
            </p>
          </div>

          {/* Logo & Nút Điều khiển góc phải */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-black tracking-widest text-amber-400">
              <span className="px-1.5 py-0.5 rounded bg-black/40 border border-amber-500/40">FOODFAST</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRules(!showRules)}
              className="p-1 text-slate-400 hover:text-amber-400 rounded-full cursor-pointer transition-colors"
              title="Quy tắc điểm danh nhận xu"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-400 rounded-full cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal nhỏ hiển thị Quy tắc nếu bấm nút ? */}
        {showRules && (
          <div className="p-3 bg-[#111921] border-b border-[#2e4356] text-xs text-slate-300 space-y-1 animate-fadeIn">
            <p className="font-bold text-amber-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Quy tắc Điểm danh FoodFast:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
              <li>Mỗi ngày điểm danh nhận <strong>500 Xu</strong>.</li>
              <li>Nếu duy trì chuỗi liên tục (streak) trên 7 ngày: nhận <strong>1.000 Xu / ngày</strong>!</li>
              <li>Tích lũy mốc trong tháng: <strong>3 ngày (500 xu)</strong>, <strong>7 ngày (1.000 xu)</strong>, <strong>14 ngày (2.000 xu)</strong>, <strong>25 ngày (Voucher GIAM30K)</strong>.</li>
              <li>Voucher <strong>GIAM30K</strong> là voucher độc quyền, chỉ người hoàn thành mốc 25 ngày mới có quyền áp dụng khi đặt món.</li>
            </ul>
          </div>
        )}

        {/* =================================================================== */}
        {/* BODY PANEL: LƯỚI LỊCH (TRÁI) & CỘT ĐIỀU KHIỂN (PHẢI) */}
        {/* =================================================================== */}
        <div className="p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 bg-[#141d24]">
          
          {/* CỘT TRÁI: LƯỚI LỊCH THÁNG (7 CỘT) */}
          <div className="lg:col-span-8 bg-[#18242e] border border-[#263747] rounded-2xl p-2.5 sm:p-3 shadow-inner flex flex-col justify-between">
            {/* Hàng Tiêu Đề 7 Thứ trong tuần */}
            <div className="grid grid-cols-7 gap-1 text-center pb-2 border-b border-[#263747] text-[11px] font-bold">
              <span className="text-amber-400">Chủ Nhật</span>
              <span className="text-[#86e2d5]">Thứ hai</span>
              <span className="text-[#86e2d5]">Thứ ba</span>
              <span className="text-[#86e2d5]">Thứ tư</span>
              <span className="text-[#86e2d5]">Thứ năm</span>
              <span className="text-[#86e2d5]">Thứ sáu</span>
              <span className="text-amber-400">Thứ bảy</span>
            </div>

            {/* Các ô ngày trong tháng */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-2">
              {calendarCells.map((cell) => {
                if (cell.isBlank) {
                  return <div key={cell.key} className="h-10 sm:h-12 bg-transparent rounded-lg" />;
                }

                return (
                  <div
                    key={cell.key}
                    onClick={() => {
                      if (cell.isToday && !cell.isChecked) {
                        handleClaimDaily();
                      }
                    }}
                    className={`relative h-10 sm:h-12 rounded-lg border p-1 flex flex-col justify-between transition-all select-none ${
                      cell.isToday
                        ? 'border-amber-400 bg-[#253949] shadow-[0_0_10px_rgba(245,197,66,0.3)] ring-1 ring-amber-400'
                        : cell.isChecked
                        ? 'border-[#2d4659] bg-[#16232d]'
                        : 'border-[#21303d] bg-[#1c2935] hover:bg-[#20313f]'
                    } ${cell.isToday && !cell.isChecked ? 'cursor-pointer hover:scale-105' : ''}`}
                  >
                    {/* Số ngày */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] sm:text-xs font-black ${
                          cell.isToday
                            ? 'text-amber-300 font-extrabold'
                            : cell.isChecked
                            ? 'text-slate-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {cell.day}
                      </span>

                      {/* Icon xu nhỏ góc phải */}
                      <div className="flex items-center gap-0.5 opacity-80">
                        <Coins className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                      </div>
                    </div>

                    {/* MỘC DẤU ĐỎ: "ĐÃ ĐIỂM DANH" (Giống mộc đỏ Truy Kích) */}
                    {cell.isChecked && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                        <div className="px-1 py-0.2 border border-red-500 text-red-500 text-[8px] sm:text-[9px] font-black uppercase tracking-tighter -rotate-15 rounded bg-red-950/60 shadow-xs scale-90 sm:scale-100">
                          ĐÃ ĐIỂM DANH
                        </div>
                      </div>
                    )}

                    {/* Trạng thái hôm nay chưa điểm danh */}
                    {cell.isToday && !cell.isChecked && (
                      <div className="text-[8px] font-extrabold text-amber-300 text-center animate-pulse">
                        Bấm nhận!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chú thích chân lịch */}
            <div className="pt-2 mt-2 border-t border-[#263747] flex items-center justify-between text-[10px] text-slate-400">
              <span>Lịch chuẩn: Tháng {checkInData.month} có {checkInData.daysInMonth} ngày</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Coins className="w-3 h-3 fill-amber-400" />
                Số dư ví: <strong>{Number(checkInData.userCoins || 0).toLocaleString('vi-VN')} Xu</strong>
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: BANNER, NÚT ĐIỂM DANH & TIẾN ĐỘ THÁNG */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
            {/* Banner Minh Họa Phong Cách Truy Kích */}
            <div className="relative rounded-2xl overflow-hidden border border-[#2b3e4f] bg-gradient-to-br from-[#1b2b38] to-[#121c24] p-3 text-center shadow-md">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md">
                  <Flame className="w-5 h-5 fill-yellow-200 text-yellow-200 animate-pulse" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Chuỗi điểm danh</div>
                  <div className="text-sm font-black text-amber-400">
                    {checkInData.currentStreak} ngày liên tiếp
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-slate-700/60 text-[11px] space-y-1 text-slate-300">
                <p>
                  Điểm danh hàng ngày: nhận <span className="text-amber-400 font-bold">500 Xu</span>
                </p>
                <p>
                  Chuỗi trên 7 ngày: nhận <span className="text-emerald-400 font-bold">1.000 Xu/ngày</span>
                </p>
              </div>
            </div>

            {/* Khối Thao Tác: Nút Điểm danh to & Nút Đã điểm danh */}
            <div className="space-y-2">
              {checkInData.isCheckedInToday ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl bg-[#2b4154] border border-[#3e5f7a] text-[#86e2d5] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-default shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Đã điểm danh hôm nay</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClaimDaily}
                  disabled={claimingDaily}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all cursor-pointer animate-pulse"
                >
                  <Sparkles className="w-4 h-4 text-yellow-200 fill-yellow-200" />
                  <span>
                    {claimingDaily
                      ? 'Đang nhận xu...'
                      : `Điểm danh ngay (+${checkInData.rewardIfCheckIn.toLocaleString('vi-VN')} Xu)`}
                  </span>
                </button>
              )}

              {/* Thông số thống kê */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-[#16232d] border border-[#243544]">
                  <div className="text-[10px] text-slate-400">Đã điểm danh</div>
                  <div className="font-extrabold text-[#86e2d5]">
                    {checkInData.totalCheckedInDays} / {checkInData.daysInMonth} Ngày
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#16232d] border border-[#243544]">
                  <div className="text-[10px] text-slate-400">Kỷ lục chuỗi</div>
                  <div className="font-extrabold text-amber-400">
                    {checkInData.highestStreak} Ngày 🔥
                  </div>
                </div>
              </div>
            </div>

            {/* Dòng thông báo số lần điểm danh trong tháng */}
            <div className="text-center text-[11px] text-slate-400">
              Tháng này đã tích lũy <strong className="text-amber-400">{checkInData.totalCheckedInDays}</strong> ngày điểm danh
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* FOOTER PANEL: DÃY PHẦN THƯỞNG MỐC 3, 7, 14, 25 NGÀY */}
        {/* =================================================================== */}
        <div className="px-3 sm:px-5 py-3.5 bg-[#10171e] border-t border-[#263747] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>Quà Tặng Tích Lũy Theo Mốc Tháng</span>
            </span>
            <span className="text-[10px] text-slate-400">
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
                  className={`p-2.5 rounded-xl border flex flex-col justify-between relative transition-all ${
                    isClaimed
                      ? 'bg-[#152028] border-[#223340] opacity-80'
                      : isEligible
                      ? 'bg-[#1c2c38] border-amber-500/80 shadow-[0_0_12px_rgba(245,197,66,0.15)] ring-1 ring-amber-400/50'
                      : 'bg-[#141d24] border-[#1f2d38]'
                  }`}
                >
                  {/* Nhãn mốc ngày */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black text-amber-400">
                      {m.day} Ngày
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      {checkInData.totalCheckedInDays}/{m.day}
                    </span>
                  </div>

                  {/* Icon quà & Tên quà */}
                  <div className="text-center py-1">
                    <div className="w-8 h-8 mx-auto rounded-lg bg-black/30 border border-slate-700/60 flex items-center justify-center mb-1">
                      {m.icon}
                    </div>
                    <div className="text-[11px] font-extrabold text-white truncate" title={m.rewardText}>
                      {m.rewardText}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {m.rewardSub}
                    </div>
                  </div>

                  {/* Nút hành động cho mốc */}
                  <div className="mt-2 pt-1 border-t border-slate-700/40">
                    {isClaimed ? (
                      <div className="w-full py-1 text-center text-[10px] font-bold text-emerald-400 bg-emerald-950/40 rounded border border-emerald-500/30 flex items-center justify-center gap-1">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Đã nhận</span>
                      </div>
                    ) : isEligible ? (
                      <button
                        type="button"
                        onClick={() => handleClaimMilestone(m.day)}
                        disabled={claimingMilestone === m.day}
                        className="w-full py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-black uppercase rounded shadow-xs active:scale-95 transition cursor-pointer animate-pulse"
                      >
                        {claimingMilestone === m.day ? 'Đang nhận...' : 'Nhận quà'}
                      </button>
                    ) : (
                      <div className="w-full py-1 text-center text-[10px] font-bold text-slate-500 bg-black/20 rounded">
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
}
