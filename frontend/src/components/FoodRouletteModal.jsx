import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Compass,
  Flame,
  Coins,
  Clock,
  RotateCw,
  ArrowRight,
  AlertCircle,
  Utensils,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { rouletteApi } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { playNotificationChime } from '../utils/realtimeSync';

// 8 món mặc định hiển thị trên vòng quay trước lượt quay đầu tiên
const DEFAULT_PREVIEW_ITEMS = [
  { name: 'Cơm Tấm Sườn', price: 45000, restaurantName: 'Cơm Tấm Ba Ghiền' },
  { name: 'Phở Bò Tái', price: 55000, restaurantName: 'Phở Thìn Hà Nội' },
  { name: 'Bún Chả Đặc Biệt', price: 50000, restaurantName: 'Bún Chả Hương Liên' },
  { name: 'Trà Sữa Trân Châu', price: 35000, restaurantName: 'Trà Sữa Phúc Long' },
  { name: 'Bánh Mì Chảo', price: 40000, restaurantName: 'Bánh Mì Chảo Cột Điện' },
  { name: 'Gà Rán Giòn Cay', price: 65000, restaurantName: "Gà Rán McDonald's" },
  { name: 'Pizza Hải Sản', price: 89000, restaurantName: 'The Pizza Company' },
  { name: 'Mì Quảng Tôm Thịt', price: 48000, restaurantName: 'Mì Quảng Mỹ Sơn' }
];

// Màu sắc tươi sáng, tương phản cao cho 8 lát cắt vòng quay
const SLICE_COLORS = [
  '#EE4D2D', // Đỏ cam FoodFast
  '#f97316', // Cam ấm
  '#f59e0b', // Vàng hoàng kim
  '#10b981', // Xanh ngọc mint
  '#06b6d4', // Cyan tươi mát
  '#8b5cf6', // Tím thạch anh
  '#ec4899', // Hồng đào
  '#9a6a3e'  // Nâu đất Sổ Tay Ký Họa
];

const BUDGET_OPTIONS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'under_40k', label: '< 40k' },
  { id: '40k_70k', label: '40k - 70k' },
  { id: 'above_70k', label: '> 70k' }
];

const MOOD_OPTIONS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'sleepy', label: '😴 Buồn ngủ / Tỉnh táo' },
  { id: 'saving', label: '💰 Tiết kiệm' },
  { id: 'snack', label: '🍿 Ăn vặt' }
];

export default function FoodRouletteModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  // Bộ lọc
  const [budget, setBudget] = useState('all');
  const [mood, setMood] = useState('all');

  // Trạng thái vòng quay
  const [slices, setSlices] = useState(DEFAULT_PREVIEW_ITEMS);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [resetCountdown, setResetCountdown] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Kết quả trúng thưởng
  const [winningResult, setWinningResult] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(300);

  const spinTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const resetIntervalRef = useRef(null);

  // 1. Tải trạng thái lượt quay hôm nay
  const fetchStatus = async () => {
    if (!isAuthenticated) {
      setSpinsRemaining(3);
      return;
    }
    try {
      const res = await rouletteApi.getStatus();
      if (res.data?.success && res.data.data) {
        const { spinsRemaining: remaining, resetInSeconds } = res.data.data;
        setSpinsRemaining(typeof remaining === 'number' ? remaining : 3);
        if (remaining <= 0 && resetInSeconds > 0) {
          startResetTimer(resetInSeconds);
        }
      }
    } catch {
      // Giữ mặc định nếu chưa đăng nhập hoặc lỗi mạng
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setErrorMsg('');
    } else {
      setShowCelebration(false);
    }
  }, [isOpen, isAuthenticated]);

  // Bộ đếm lùi thời gian reset lượt quay lúc 00:00
  const startResetTimer = (initialSecs) => {
    if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
    let remaining = initialSecs;
    const updateText = () => {
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setResetCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      if (remaining <= 0) {
        clearInterval(resetIntervalRef.current);
        setSpinsRemaining(3);
        setResetCountdown('');
      } else {
        remaining -= 1;
      }
    };
    updateText();
    resetIntervalRef.current = setInterval(updateText, 1000);
  };

  // 2. Bộ đếm ngược 5 phút nhận ưu đãi sau khi trúng thưởng
  useEffect(() => {
    if (winningResult?.expiresAt) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      const targetTime = new Date(winningResult.expiresAt).getTime();

      const updateCountdown = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
        setSessionSecondsLeft(diff);
        if (diff <= 0) {
          clearInterval(countdownIntervalRef.current);
        }
      };

      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [winningResult]);

  // Dọn dẹp timers khi unmount
  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
    };
  }, []);

  // 3. Thực hiện quay thưởng
  const handleSpin = async () => {
    if (isSpinning) return;

    if (!isAuthenticated) {
      setErrorMsg('Vui lòng đăng nhập để quay thưởng và nhận x2 Xu FoodFast!');
      return;
    }

    if (spinsRemaining <= 0) {
      setErrorMsg('Bạn đã dùng hết 3 lượt quay hôm nay. Vui lòng quay lại vào ngày mai!');
      return;
    }

    setIsSpinning(true);
    setErrorMsg('');
    setShowCelebration(false);
    setWinningResult(null);

    try {
      const response = await rouletteApi.spin({ budget, mood });
      const resData = response.data;

      if (!resData?.success) {
        throw new Error(resData?.message || 'Không thể quay thưởng lúc này');
      }

      const { items, winnerIndex, winnerItem, sessionId, bonusType, expiresAt, spinsRemaining: newRemaining } = resData.data;

      // Cập nhật danh sách món trên bánh xe
      if (Array.isArray(items) && items.length >= 8) {
        setSlices(items.slice(0, 8));
      }

      if (typeof newRemaining === 'number') {
        setSpinsRemaining(newRemaining);
      }

      // Tính góc quay dừng chính xác tại winnerIndex (từ 0 đến 7)
      // Pointer ở 12 giờ: R_target = (5 * 360) + (360 - (winnerIndex * 45 + 22.5))
      const safeIndex = (winnerIndex >= 0 && winnerIndex < 8) ? winnerIndex : 0;
      const baseTurns = Math.floor(rotation / 360) * 360 + (5 * 360);
      const stopOffset = (360 - (safeIndex * 45 + 22.5));
      let targetDeg = baseTurns + stopOffset;
      if (targetDeg <= rotation) {
        targetDeg += 360;
      }

      setRotation(targetDeg);

      // Chờ đúng 3.5 giây animation CSS hoàn thành
      spinTimeoutRef.current = setTimeout(() => {
        setIsSpinning(false);
        setShowCelebration(true);
        playNotificationChime();

        setWinningResult({
          winnerItem,
          sessionId,
          bonusType: bonusType || 'DOUBLE_COINS',
          expiresAt
        });
      }, 3500);

    } catch (err) {
      setIsSpinning(false);
      const errMsg = err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ';
      setErrorMsg(errMsg);
      if (err.response?.status === 429) {
        setSpinsRemaining(0);
        if (err.response?.data?.resetInSeconds) {
          startResetTimer(err.response.data.resetInSeconds);
        }
      }
    }
  };

  // 4. Chốt đơn ngay
  const handleOrderNow = () => {
    if (!winningResult?.winnerItem) return;

    const { winnerItem, sessionId, expiresAt } = winningResult;

    // Chuẩn bị item cho CartContext
    const cartItem = {
      _id: winnerItem.menuItemId || `menu_${Date.now()}`,
      menuItemId: winnerItem.menuItemId,
      name: winnerItem.name,
      price: winnerItem.price,
      image: winnerItem.image || '',
      quantity: 1,
      options: []
    };

    const restaurant = {
      _id: winnerItem.restaurantId,
      name: winnerItem.restaurantName || 'Quán ăn FoodFast',
      image: winnerItem.restaurantImage || ''
    };

    // Đính kèm session vào sessionStorage để Checkout nhận diện
    try {
      sessionStorage.setItem(
        'foodfast_roulette_session',
        JSON.stringify({
          sessionId,
          menuItemId: winnerItem.menuItemId,
          itemName: winnerItem.name,
          restaurantId: winnerItem.restaurantId,
          restaurantName: winnerItem.restaurantName,
          price: winnerItem.price,
          image: winnerItem.image,
          bonusType: 'DOUBLE_COINS',
          expiresAt: expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
      );
    } catch {}

    const success = addToCart(cartItem, restaurant);
    if (success !== false) {
      onClose();
      navigate('/checkout');
    }
  };

  // Format giây sang mm:ss
  const formattedCountdown = useMemo(() => {
    const m = Math.floor(sessionSecondsLeft / 60);
    const s = sessionSecondsLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [sessionSecondsLeft]);

  // Vẽ 8 lát cắt SVG
  const wheelSlices = useMemo(() => {
    const cx = 160;
    const cy = 160;
    const r = 150;
    const sliceAngle = 45;

    return slices.slice(0, 8).map((item, idx) => {
      const a1 = idx * sliceAngle;
      const a2 = (idx + 1) * sliceAngle;
      const rad1 = (a1 * Math.PI) / 180;
      const rad2 = (a2 * Math.PI) / 180;

      const x1 = cx + r * Math.sin(rad1);
      const y1 = cy - r * Math.cos(rad1);
      const x2 = cx + r * Math.sin(rad2);
      const y2 = cy - r * Math.cos(rad2);

      const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
      const midAngle = idx * sliceAngle + 22.5;

      // Rút gọn tên món nếu quá dài để hiển thị gọn gàng trên lát bánh xe
      const rawName = item.name || `Món ${idx + 1}`;
      const shortName = rawName.length > 14 ? rawName.slice(0, 13) + '…' : rawName;

      return {
        idx,
        pathData,
        color: SLICE_COLORS[idx % SLICE_COLORS.length],
        midAngle,
        shortName,
        price: item.price ? `${Math.round(item.price / 1000)}k` : ''
      };
    });
  }, [slices]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-7 shadow-2xl transition-all
          bg-[#faf7f2] dark:bg-[#1a1714] text-[#2b2520] dark:text-[#ede6d8] border border-[#e5ded3] dark:border-[#38312b]"
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Nút đóng */}
        <button
          onClick={onClose}
          disabled={isSpinning}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 
            hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Lượt quay */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pr-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-[#EE4D2D]/10 text-[#EE4D2D]">
                <Compass className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#1e1b18] dark:text-[#f4efe6]">
                Hôm Nay Ăn Gì?
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Vòng quay chọn món thông minh — Nhận <span className="font-bold text-[#EE4D2D]">x2 Xu FoodFast</span> khi đặt món!
            </p>
          </div>

          {/* Huy hiệu lượt quay */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                spinsRemaining > 0
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#EE4D2D]" />
              <span>{spinsRemaining}/3 lượt hôm nay</span>
            </div>
          </div>
        </div>

        {/* Thông báo hết lượt */}
        {spinsRemaining <= 0 && resetCountdown && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Bạn đã dùng hết 3 lượt quay hôm nay. Làm mới lượt sau: <strong>{resetCountdown}</strong></span>
          </div>
        )}

        {/* Báo lỗi nếu có */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-300 dark:border-red-800 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* BỘ LỌC CHIPS: Ngân sách & Tâm trạng */}
        <div className="mb-5 space-y-2.5 p-3.5 rounded-2xl bg-[#f0eae1] dark:bg-[#231f1b] border border-[#e2d8cb] dark:border-[#322b24]">
          {/* Ngân sách */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-[#EE4D2D]" />
              Ngân sách:
            </span>
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={isSpinning}
                onClick={() => setBudget(opt.id)}
                className={`px-2.5 py-1 rounded-xl font-medium transition-all text-xs ${
                  budget === opt.id
                    ? 'bg-[#EE4D2D] text-white shadow-sm'
                    : 'bg-white dark:bg-[#1a1714] text-gray-700 dark:text-gray-300 hover:border-[#EE4D2D]/50 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tâm trạng */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5 text-[#9a6a3e]" />
              Tâm trạng:
            </span>
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={isSpinning}
                onClick={() => setMood(opt.id)}
                className={`px-2.5 py-1 rounded-xl font-medium transition-all text-xs ${
                  mood === opt.id
                    ? 'bg-[#9a6a3e] text-white shadow-sm'
                    : 'bg-white dark:bg-[#1a1714] text-gray-700 dark:text-gray-300 hover:border-[#9a6a3e]/50 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* KHUNG BÁNH XE QUAY & KIM CHỈ THỊ */}
        <div className="relative flex flex-col items-center justify-center my-3">
          {/* Kim chỉ thị (Pointer needle) ở vị trí 12 giờ (đỉnh bánh xe) */}
          <div className="absolute top-0 z-20 -mt-2.5 flex flex-col items-center filter drop-shadow-md">
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-[#EE4D2D]" />
            <div className="w-2.5 h-2.5 rounded-full bg-white -mt-5" />
          </div>

          {/* Khung viền bánh xe */}
          <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full p-2.5 bg-gradient-to-br from-[#f8d7b3] via-[#e5ded3] to-[#845831] shadow-xl">
            {/* Vòng quay có hiệu ứng transition CSS 3.5s */}
            <div
              className="w-full h-full rounded-full overflow-hidden shadow-inner relative"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning
                  ? 'transform 3.5s cubic-bezier(0.25, 0.1, 0.25, 1)'
                  : 'none'
              }}
            >
              <svg viewBox="0 0 320 320" className="w-full h-full">
                {/* 8 lát cắt */}
                {wheelSlices.map((slice) => (
                  <path
                    key={slice.idx}
                    d={slice.pathData}
                    fill={slice.color}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                ))}

                {/* Nhãn chữ trên từng lát quạt */}
                {wheelSlices.map((slice) => (
                  <g
                    key={`label-${slice.idx}`}
                    transform={`rotate(${slice.midAngle} 160 160)`}
                  >
                    <text
                      x="160"
                      y="62"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      style={{
                        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                        letterSpacing: '-0.2px'
                      }}
                    >
                      {slice.shortName}
                    </text>
                    {slice.price && (
                      <text
                        x="160"
                        y="76"
                        fill="#fef08a"
                        fontSize="9.5"
                        fontWeight="800"
                        textAnchor="middle"
                        style={{
                          textShadow: '0 1px 2px rgba(0,0,0,0.7)'
                        }}
                      >
                        {slice.price}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>

            {/* Trục tâm bánh xe */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-white to-[#faecd8] dark:from-[#2e2620] dark:to-[#171412] 
                shadow-lg border-4 border-[#EE4D2D] flex items-center justify-center">
                <Flame className="w-6 h-6 text-[#EE4D2D] animate-pulse" />
              </div>
            </div>
          </div>

          {/* NÚT QUAY */}
          <div className="mt-5 w-full flex justify-center">
            <button
              type="button"
              onClick={handleSpin}
              disabled={isSpinning || spinsRemaining <= 0}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                isSpinning || spinsRemaining <= 0
                  ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-[#EE4D2D] to-[#f97316] hover:from-[#dc3f1f] hover:to-[#ea580c] text-white active:scale-95 shadow-[#EE4D2D]/30'
              }`}
            >
              <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'Đang quay món ngon...' : 'Quay Ngay!'}</span>
            </button>
          </div>
        </div>

        {/* THẺ KẾT QUẢ KHI DỪNG QUAY (RESULT CARD) */}
        {winningResult?.winnerItem && (
          <div
            className={`mt-5 p-4 sm:p-5 rounded-2xl border transition-all animate-slideUp ${
              sessionSecondsLeft > 0
                ? 'bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:from-[#241e19] dark:to-[#221c17] border-[#EE4D2D]/30 shadow-md'
                : 'bg-gray-100 dark:bg-gray-800/40 border-gray-300 dark:border-gray-700 opacity-80'
            }`}
          >
            {/* Header kết quả */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#EE4D2D]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Món Ăn May Mắn Dành Cho Bạn</span>
              </div>

              {/* Huy hiệu x2 Xu thưởng */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EE4D2D] text-white text-[11px] font-extrabold shadow-sm">
                <Coins className="w-3.5 h-3.5" />
                <span>Nhận x2 Xu thưởng</span>
              </div>
            </div>

            {/* Chi tiết món */}
            <div className="flex items-center gap-3.5">
              {winningResult.winnerItem.image ? (
                <img
                  src={winningResult.winnerItem.image}
                  alt={winningResult.winnerItem.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-black/10 dark:border-white/10"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-300 dark:border-amber-800">
                  <Utensils className="w-8 h-8 text-[#EE4D2D]" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate">
                  {winningResult.winnerItem.name}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                  {winningResult.winnerItem.restaurantName || 'Quán ngon FoodFast'}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-black text-[#EE4D2D]">
                    {Number(winningResult.winnerItem.price || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>
            </div>

            {/* ĐỒNG HỒ ĐẾM NGƯỢC 5 PHÚT */}
            <div className="mt-3.5 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                {sessionSecondsLeft > 0 ? (
                  <span className="text-gray-700 dark:text-gray-300">
                    Ưu đãi x2 Xu kết thúc trong:{' '}
                    <strong className="text-[#EE4D2D] font-mono text-sm">{formattedCountdown}</strong>
                  </span>
                ) : (
                  <span className="text-gray-500">Phiên ưu đãi đã hết hạn (quá 5 phút).</span>
                )}
              </div>

              {/* Nút Chốt đơn ngay */}
              {sessionSecondsLeft > 0 ? (
                <button
                  type="button"
                  onClick={handleOrderNow}
                  className="px-5 py-2.5 rounded-xl bg-[#EE4D2D] hover:bg-[#dc3f1f] text-white font-bold text-xs uppercase tracking-wider 
                    transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>Chốt đơn ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSpin}
                  disabled={spinsRemaining <= 0}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold"
                >
                  Quay lượt khác
                </button>
              )}
            </div>
          </div>
        )}

        {/* Confetti Ribbon Effect */}
        {showCelebration && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl z-30">
            <div className="absolute inset-0 flex justify-center items-start pt-6">
              <span className="animate-ping absolute inline-flex h-24 w-24 rounded-full bg-amber-400 opacity-20" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
