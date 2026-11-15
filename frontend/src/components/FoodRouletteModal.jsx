import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Flame,
  Coins,
  Star,
  Tag,
  Zap,
  Utensils,
  Volume2,
  VolumeX,
  Clock,
  ArrowRight,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';
import { rouletteApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CaseAudio } from '../utils/caseAudio';
import {
  TILE_WIDTH,
  TILE_GAP,
  STEP,
  RARITY_TIERS,
  getDishRarity,
  getRaritySound,
  stopFraction,
  spinProgress,
  createSpinProfile
} from '../utils/caseMechanics';

// Bộ lọc ngân sách chuẩn FoodFast
const BUDGET_OPTIONS = [
  { id: 'all', label: 'Tất cả ngân sách', min: 0, max: Infinity },
  { id: 'under_35k', label: '< 35.000 đ (Phổ biến)', min: 0, max: 34999 },
  { id: '35k_70k', label: '35k - 70k (Hiếm)', min: 35000, max: 70000 },
  { id: 'above_70k', label: '> 70.000 đ (Huyền thoại)', min: 70001, max: Infinity }
];

// Ánh xạ rarity sang màu
const RARITY_COLOR = {
  COMMON: '#4b69ff',
  RARE: '#8847ff',
  LEGENDARY: '#ffd700'
};
const RARITY_LABEL = {
  COMMON: 'Phổ biến',
  RARE: 'Hiếm',
  LEGENDARY: 'Huyền thoại'
};

// Danh sách fallback tĩnh nếu API config chưa sẵn sàng
const FALLBACK_CONFIG_ITEMS = [
  { _id: 'ff_01', name: 'Bánh Mì Thịt Nướng', description: 'Bánh mì giòn nhân thịt nướng thơm', image: 'https://images.unsplash.com/photo-1549611016-3a70d82b5040?w=400&auto=format&fit=crop', priceRange: '25.000đ - 35.000đ', rarity: 'COMMON' },
  { _id: 'ff_02', name: 'Trà Sữa Trân Châu', description: 'Trà sữa trân châu ấm dẻo thơm ngon', image: 'https://images.unsplash.com/photo-1558857563-b37cf5290a1?w=400&auto=format&fit=crop', priceRange: '30.000đ - 45.000đ', rarity: 'COMMON' },
  { _id: 'ff_03', name: 'Bún Thịt Nướng Chả Giò', description: 'Bún thịt nướng kèm chả giò giòn rụm', image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&auto=format&fit=crop', priceRange: '40.000đ - 55.000đ', rarity: 'COMMON' },
  { _id: 'ff_04', name: 'Cơm Tấm Sườn Bì Chả', description: 'Cơm tấm sườn bì chả trứng ốp la', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop', priceRange: '45.000đ - 65.000đ', rarity: 'RARE' },
  { _id: 'ff_05', name: 'Phở Bò Tái Nạm Gầu', description: 'Phở bò truyền thống nước dùng đậm đà', image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&auto=format&fit=crop', priceRange: '55.000đ - 70.000đ', rarity: 'RARE' },
  { _id: 'ff_06', name: 'Hủ Tiếu Nam Vang', description: 'Hủ tiếu Nam Vang tôm mực tươi ngon', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop', priceRange: '45.000đ - 60.000đ', rarity: 'RARE' },
  { _id: 'ff_07', name: 'Gà Rán Giòn Cay', description: 'Gà rán giòn ướp sốt cay Hàn Quốc', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop', priceRange: '55.000đ - 85.000đ', rarity: 'RARE' },
  { _id: 'ff_08', name: 'Pizza Hải Sản', description: 'Pizza hải sản phong cách Ý thượng hạng', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop', priceRange: '79.000đ - 129.000đ', rarity: 'LEGENDARY' },
  { _id: 'ff_09', name: 'Lẩu Thái Hải Sản', description: 'Lẩu Thái chua cay hải sản tươi sống', image: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=400&auto=format&fit=crop', priceRange: '89.000đ - 150.000đ', rarity: 'LEGENDARY' },
  { _id: 'ff_10', name: 'Bít Tết Bò Mỹ', description: 'Bít tết bò Mỹ nướng medium-rare', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&auto=format&fit=crop', priceRange: '99.000đ - 180.000đ', rarity: 'LEGENDARY' },
  { _id: 'ff_11', name: 'Cơm Chay Nấm Kho', description: 'Cơm chay nấm kho tiêu tươi lành mạnh', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop', priceRange: '28.000đ - 40.000đ', rarity: 'COMMON' },
  { _id: 'ff_12', name: 'Mì Ramen Tonkotsu', description: 'Mì Ramen Nhật nước dùng xương hầm đậm vị', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop', priceRange: '65.000đ - 95.000đ', rarity: 'RARE' }
];

export default function FoodRouletteModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Audio Engine
  const audio = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Config món tiêu biểu từ API
  const [configItems, setConfigItems] = useState(FALLBACK_CONFIG_ITEMS);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Bộ lọc ngân sách & chay
  const [budget, setBudget] = useState('all');
  const [vegetarianOnly, setVegetarianOnly] = useState(false);

  // Trạng thái lượt quay
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [resetCountdown, setResetCountdown] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);

  // Băng chuyền reel
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const positionRef = useRef(-400);
  const animFrameRef = useRef(0);
  const lastCellRef = useRef(0);
  const isBusyRef = useRef(false);

  const [visibleStart, setVisibleStart] = useState(0);
  const [reelItems, setReelItems] = useState([]);

  // Kết quả trúng thưởng
  const [winningResult, setWinningResult] = useState(null);
  const [showRevealDialog, setShowRevealDialog] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(600); // 10 phút

  const countdownIntervalRef = useRef(null);
  const resetIntervalRef = useRef(null);

  // ─── 1. Khởi tạo Audio Engine ───────────────────────────────────────────────
  useEffect(() => {
    const soundEngine = new CaseAudio();
    audio.current = soundEngine;
    soundEngine.preload();
    const handleVisibility = () => {
      if (document.hidden) soundEngine.pause();
      else soundEngine.recover();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      soundEngine.dispose();
      audio.current = null;
    };
  }, []);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (audio.current) audio.current.setMuted(!nextState);
  };

  // ─── 2. Tải config món tiêu biểu từ API ────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const res = await rouletteApi.getConfig();
      const items = res?.data?.data?.items || [];
      if (items.length >= 3) {
        setConfigItems(items);
      } else {
        setConfigItems(FALLBACK_CONFIG_ITEMS);
      }
    } catch {
      setConfigItems(FALLBACK_CONFIG_ITEMS);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  // ─── 3. Lấy trạng thái lượt quay ───────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) { setSpinsRemaining(3); return; }
    try {
      const res = await rouletteApi.getStatus();
      if (res.data?.success && res.data.data) {
        const { spinsRemaining: remaining, resetInSeconds } = res.data.data;
        setSpinsRemaining(typeof remaining === 'number' ? remaining : 3);
        if (remaining <= 0 && resetInSeconds > 0) startResetTimer(resetInSeconds);
      }
    } catch {}
  }, [isAuthenticated]);

  const startResetTimer = (initialSecs) => {
    if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
    let remaining = initialSecs;
    const updateText = () => {
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setResetCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      if (remaining <= 0) { clearInterval(resetIntervalRef.current); setSpinsRemaining(3); setResetCountdown(''); }
      else remaining -= 1;
    };
    updateText();
    resetIntervalRef.current = setInterval(updateText, 1000);
  };

  // ─── 4. Kích hoạt khi modal mở ─────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      fetchConfig();
      setErrorMsg('');
      setShowRevealDialog(false);
      setWinningResult(null);
    } else {
      setShowRevealDialog(false);
      setIsSpinning(false);
      isBusyRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  }, [isOpen, fetchStatus, fetchConfig]);

  // Dọn dẹp timers
  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
  }, []);

  // Khóa cuộn trang nền khi modal mở
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // ─── 5. Lọc danh sách theo ngân sách & chay ────────────────────────────────
  const eligibleItems = useMemo(() => {
    let list = configItems.filter(d => d.isActive !== false);

    if (vegetarianOnly) {
      list = list.filter(d =>
        /(chay|nấm|đậu|rau|healthy)/i.test(d.name) ||
        /(chay|nấm|đậu|rau|healthy)/i.test(d.description || '')
      );
    }

    if (budget !== 'all') {
      const budgetConfig = BUDGET_OPTIONS.find(b => b.id === budget);
      if (budgetConfig) {
        list = list.filter(d => {
          // Ánh xạ rarity → phân khúc giá
          if (budget === 'under_35k') return d.rarity === 'COMMON';
          if (budget === '35k_70k') return d.rarity === 'RARE';
          if (budget === 'above_70k') return d.rarity === 'LEGENDARY';
          return true;
        });
      }
    }

    return list.length > 0 ? list : configItems.filter(d => d.isActive !== false);
  }, [configItems, budget, vegetarianOnly]);

  // ─── 6. Khởi tạo dải thẻ băng chuyền ──────────────────────────────────────
  useEffect(() => {
    if (isSpinning || !eligibleItems.length) return;
    const initialItems = [];
    for (let id = 0; id < 14; id++) {
      const dish = eligibleItems[id % eligibleItems.length];
      initialItems.push({ id, dish });
    }
    setReelItems(initialItems);
    setVisibleStart(0);
    positionRef.current = -400;
    if (trackRef.current) trackRef.current.style.transform = 'translate3d(-400px, 0, 0)';
  }, [eligibleItems, isSpinning]);

  // ─── 7. Đếm ngược 10 phút ưu đãi ──────────────────────────────────────────
  useEffect(() => {
    if (winningResult?.expiresAt) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      const targetTime = new Date(winningResult.expiresAt).getTime();
      const updateCountdown = () => {
        const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
        setSessionSecondsLeft(diff);
        if (diff <= 0) clearInterval(countdownIntervalRef.current);
      };
      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    }
    return () => { if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); };
  }, [winningResult]);

  const formattedCountdown = useMemo(() => {
    const m = Math.floor(sessionSecondsLeft / 60);
    const s = sessionSecondsLeft % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }, [sessionSecondsLeft]);

  // ─── 8. Mở hòm (spin) ──────────────────────────────────────────────────────
  const handleOpenCase = async () => {
    if (isBusyRef.current || isSpinning) return;
    if (!viewportRef.current || !trackRef.current) return;
    if (!isAuthenticated) {
      setErrorMsg('Vui lòng đăng nhập để mở hòm chọn món và nhận x2 Xu FoodFast!');
      return;
    }
    if (spinsRemaining <= 0) {
      setErrorMsg('Bạn đã dùng hết 3 lượt mở hòm hôm nay. Vui lòng quay lại vào ngày mai!');
      return;
    }

    audio.current?.unlock();
    isBusyRef.current = true;
    setIsSpinning(true);
    setErrorMsg('');
    setShowRevealDialog(false);

    try {
      const response = await rouletteApi.spin({ budget, mood: 'all' });
      const resData = response.data;
      if (!resData?.success) throw new Error(resData?.message || 'Không thể mở hòm lúc này');

      const { winnerItem, sessionId, bonusType, expiresAt, spinsRemaining: newRemaining } = resData.data;
      if (typeof newRemaining === 'number') setSpinsRemaining(newRemaining);

      // Nếu backend trả về winnerItem chỉ có name (không có restaurantId), tìm trong eligibleItems
      const localWinner = eligibleItems.find(d =>
        d.name?.toLowerCase() === winnerItem?.name?.toLowerCase()
      ) || eligibleItems[Math.floor(Math.random() * eligibleItems.length)];

      const finalWinner = {
        ...localWinner,
        name: winnerItem?.name || localWinner.name,
        image: winnerItem?.image || localWinner.image,
        priceRange: winnerItem?.priceRange || localWinner.priceRange,
        rarity: winnerItem?.rarity || localWinner.rarity || 'COMMON',
        sessionId,
        expiresAt
      };

      // Build spin animation
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const profile = createSpinProfile(Math.random, reducedMotion);
      const width = viewportRef.current.clientWidth;
      const start = positionRef.current;
      const center = Math.floor((width / 2 - start) / STEP);
      const target = center + profile.tiles;
      const sf = stopFraction();
      const end = width / 2 - TILE_WIDTH * sf - target * STEP;

      const items = reelItems.filter(it => it.id >= center - Math.ceil(width / STEP) - 2 && it.id <= target + 6);
      const lastId = items.length ? Math.max(...items.map(i => i.id)) : center;

      for (let id = lastId + 1; id <= target + 6; id++) {
        if (id === target) {
          items.push({ id, dish: finalWinner });
        } else {
          const randomDish = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
          items.push({ id, dish: randomDish });
        }
      }

      setReelItems(items);
      audio.current?.play('csgo_ui_crate_open');

      const duration = profile.durationMs;
      const started = performance.now();
      let renderedStart = visibleStart;
      lastCellRef.current = Math.floor((start - width / 2) / STEP);

      const animate = (now) => {
        const progress = Math.max(0, Math.min(1, (now - started) / duration));
        const next = start + (end - start) * spinProgress(progress, profile.friction);
        positionRef.current = next;

        const firstVisible = Math.max(0, Math.floor(-next / STEP));
        if (firstVisible - renderedStart >= 3 || firstVisible < renderedStart) {
          renderedStart = Math.max(0, firstVisible - 2);
          setVisibleStart(renderedStart);
        }

        if (trackRef.current) trackRef.current.style.transform = `translate3d(${next}px, 0, 0)`;

        const cell = Math.floor((next - width / 2) / STEP);
        if (cell !== lastCellRef.current) {
          audio.current?.play('csgo_ui_crate_item_scroll');
          lastCellRef.current = cell;
        }

        if (progress < 1) { animFrameRef.current = requestAnimationFrame(animate); return; }

        isBusyRef.current = false;
        setIsSpinning(false);

        setWinningResult({
          winnerItem: finalWinner,
          sessionId,
          bonusType: bonusType || 'DOUBLE_COINS',
          expiresAt: expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });
        setShowRevealDialog(true);

        const rarityMap = { COMMON: 'csgo_reveal_common', RARE: 'csgo_reveal_rare', LEGENDARY: 'csgo_reveal_legendary' };
        audio.current?.play(rarityMap[finalWinner.rarity] || 'csgo_reveal_common');
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } catch (err) {
      isBusyRef.current = false;
      setIsSpinning(false);
      const errMsg = err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ';
      setErrorMsg(errMsg);
      if (err.response?.status === 429) {
        setSpinsRemaining(0);
        if (err.response?.data?.resetInSeconds) startResetTimer(err.response.data.resetInSeconds);
      }
    }
  };

  // ─── 9. CTA: Đặt Món Ngay (không gắn link quán, chỉ điều hướng về trang chủ) ──
  const handleGoOrder = () => {
    if (!winningResult?.winnerItem) return;
    const { winnerItem, sessionId, expiresAt } = winningResult;

    // Lưu session x2 Xu vào sessionStorage (Checkout sẽ dùng để match tên món)
    try {
      sessionStorage.setItem('foodfast_roulette_session', JSON.stringify({
        sessionId,
        itemName: winnerItem.name,
        bonusType: 'DOUBLE_COINS',
        expiresAt: expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        matchByName: true  // Flag báo cho Order Service: so sánh theo tên, không theo ID
      }));
    } catch {}

    onClose();
    // Điều hướng về trang chủ, người dùng tự chọn quán và đặt món tương tự
    navigate('/');
  };

  // Sắp xếp inventory: LEGENDARY → RARE → COMMON
  const sortedInventory = useMemo(() => {
    const order = { LEGENDARY: 0, RARE: 1, COMMON: 2 };
    return [...eligibleItems].sort((a, b) => (order[a.rarity] ?? 2) - (order[b.rarity] ?? 2));
  }, [eligibleItems]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-hidden animate-fadeIn">
      <div
        className="relative w-full max-w-5xl h-full max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl border border-[#303844]
          bg-[#13171d] text-[#e3e6eb] flex flex-col my-auto"
        style={{ boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)' }}
      >
        {/* ── HEADER CỐ ĐỊNH Ở TRÊN ĐỈNH MODAL (shrink-0) ────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#242b35] bg-[#171d24]">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#dfc681]/15 text-[#dfc681] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#dfc681]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">Hôm Nay Ăn Gì?</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-[#EE4D2D] text-white">
                  Hòm Món Ngon FoodFast
                </span>
              </div>
              <p className="text-xs text-[#8c98a4] hidden sm:block">
                Mở hòm nhận gợi ý món — Đặt món tên tương tự trong{' '}
                <span className="text-[#dfc681] font-semibold">10 phút</span> để nhận{' '}
                <span className="text-[#dfc681] font-semibold">+x2 Xu</span> tại bất kỳ quán nào!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Lượt quay */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
              spinsRemaining > 0
                ? 'bg-amber-500/10 text-[#dfc681] border-[#dfc681]/40'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}>
              <Flame className="w-3.5 h-3.5 text-[#EE4D2D]" />
              <span>{spinsRemaining}/3 lượt</span>
            </div>

            {/* Âm thanh */}
            <button
              type="button"
              onClick={toggleSound}
              className={`p-2 rounded-lg border transition-all ${
                soundEnabled
                  ? 'bg-[#202832] text-[#dfc681] border-[#384452] hover:bg-[#28323e]'
                  : 'bg-[#181f26] text-gray-500 border-gray-700 hover:text-gray-300'
              }`}
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Đóng */}
            <button
              type="button"
              onClick={onClose}
              disabled={isSpinning}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── THÔNG BÁO LỖI / HẾT LƯỢT (shrink-0) ───────────────────────── */}
        {errorMsg && (
          <div className="shrink-0 mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {spinsRemaining <= 0 && resetCountdown && (
          <div className="shrink-0 mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-200">
            <Clock className="w-4 h-4 shrink-0 text-[#dfc681]" />
            <span>
              Bạn đã mở hết 3/3 lượt hòm hôm nay. Lượt mới sẽ được làm mới sau:{' '}
              <strong className="text-white font-mono">{resetCountdown}</strong>
            </span>
          </div>
        )}

        {/* ── INFO BANNER: CƠ CHẾ ƯU ĐÃI (shrink-0) ─────────────────────── */}
        <div className="shrink-0 mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-[#dfc681]/8 border border-[#dfc681]/25 flex items-start gap-2.5 text-xs text-[#c8b97a]">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#dfc681] mt-0.5" />
          <div>
            <span className="font-bold text-[#dfc681]">Cơ chế x2 Xu:</span>{' '}
            Quay ra món nào → Đặt món có tên tương tự tại{' '}
            <strong className="text-white">bất kỳ quán nào</strong> bạn thích trong{' '}
            <strong className="text-[#dfc681]">10 phút</strong> → Tự động nhận x2 Xu!
          </div>
        </div>

        {/* ── THÂN MODAL CUỘN ĐƯỢC ĐỘC LẬP (flex-1 overflow-y-auto) ─────── */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">

          {/* ── KHUNG BĂNG CHUYỀN ───────────────────────────────────────── */}
          <div className="relative rounded-xl overflow-hidden border border-[#2b3542] bg-[#171a20] shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 bg-[#1b2027] border-b border-[#28323e] text-xs text-[#8c98a4]">
              <span className="font-semibold text-[#c8d1dc] flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-[#dfc681]" />
                Băng chuyền món ngon FoodFast
              </span>
              <span className="text-[11px]">Vạch dừng tự động chọn ngẫu nhiên món thắng</span>
            </div>

            {/* REEL WINDOW */}
            <div
              ref={viewportRef}
              className="relative w-full h-[225px] overflow-hidden select-none"
              style={{ background: 'linear-gradient(180deg, #12151b 0%, #1a2029 50%, #12151b 100%)' }}
            >
              {/* Vạch chỉ báo trung tâm */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-[#dfc681] z-30 pointer-events-none -translate-x-1/2"
                style={{ boxShadow: '0 0 12px rgba(223,198,129,0.8), 0 0 2px #dfc681' }}
              >
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-[#dfc681]" />
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-[#dfc681]" />
              </div>

              {/* Fade cạnh */}
              <div className="absolute top-0 bottom-0 left-0 w-24 sm:w-36 bg-gradient-to-r from-[#12151b] via-[#12151b]/80 to-transparent pointer-events-none z-20" />
              <div className="absolute top-0 bottom-0 right-0 w-24 sm:w-36 bg-gradient-to-l from-[#12151b] via-[#12151b]/80 to-transparent pointer-events-none z-20" />

              {/* TRACK */}
              <div
                ref={trackRef}
                className="relative h-full w-full"
                style={{ transform: 'translate3d(-400px, 0, 0)', willChange: 'transform' }}
              >
                {reelItems
                  .filter(({ id }) => id >= visibleStart && id < visibleStart + 16)
                  .map(({ id, dish }) => {
                    const rarityColor = RARITY_COLOR[dish.rarity] || '#4b69ff';
                    const rarityLabel = RARITY_LABEL[dish.rarity] || 'Phổ biến';
                    return (
                      <div
                        key={id}
                        className="absolute top-4 w-[240px] h-[190px] rounded-lg overflow-hidden border border-[#2e3744] flex flex-col justify-between p-3.5"
                        style={{
                          left: `${id * STEP}px`,
                          borderBottom: `6px solid ${rarityColor}`,
                          background: `radial-gradient(ellipse at 50% 60%, ${rarityColor}22 0%, #1d222b 75%)`,
                          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.4)'
                        }}
                      >
                        {/* Huy hiệu độ hiếm + giá tham khảo */}
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded"
                            style={{ color: rarityColor, backgroundColor: `${rarityColor}15`, border: `1px solid ${rarityColor}30` }}
                          >
                            {rarityLabel}
                          </span>
                          <span className="text-[10px] font-semibold text-white/70 truncate max-w-[90px]">
                            {dish.priceRange || '—'}
                          </span>
                        </div>

                        {/* Ảnh món */}
                        <div className="flex-1 flex items-center justify-center my-1">
                          {dish.image ? (
                            <img
                              src={dish.image}
                              alt={dish.name}
                              className="max-h-[85px] max-w-[150px] object-cover rounded-md filter drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-black/30 flex items-center justify-center">
                              <Utensils className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Tên món (không có tên quán) */}
                        <div className="pt-1.5 border-t border-white/5">
                          <h4 className="text-xs font-bold text-white truncate" title={dish.name}>
                            {dish.name}
                          </h4>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">
                            {dish.description || 'Món ngon FoodFast'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* ── BỘ LỌC & NÚT MỞ HÒM ────────────────────────────────────── */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#171c22] border border-[#262f3a] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Lọc ngân sách */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#dfc681]" />
                  Ngân sách:
                </span>
                {BUDGET_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isSpinning}
                    onClick={() => setBudget(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      budget === opt.id
                        ? 'bg-[#dfc681] text-[#12161b] font-bold shadow-md'
                        : 'bg-[#202731] text-gray-300 hover:bg-[#28323e] border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Lọc chay */}
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => setVegetarianOnly(!vegetarianOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  vegetarianOnly
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-[#202731] text-gray-400 border-transparent hover:text-gray-200'
                }`}
              >
                🌿
                <span>Món chay</span>
              </button>
            </div>

            {/* NÚT MỞ HÒM */}
            <button
              type="button"
              onClick={handleOpenCase}
              disabled={isSpinning || spinsRemaining <= 0}
              className={`w-full md:w-auto min-w-[200px] px-7 py-3 rounded-xl font-black text-sm tracking-wide uppercase transition-all shadow-lg flex items-center justify-center gap-2.5 ${
                isSpinning || spinsRemaining <= 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700 shadow-none'
                  : 'bg-gradient-to-r from-[#dfc681] to-[#e4ae39] hover:from-[#e8d192] hover:to-[#f0ba45] text-[#14181f] active:scale-95 shadow-[#dfc681]/20'
              }`}
            >
              {isSpinning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-[#14181f]" />
                  <span>Đang mở hòm...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#14181f]" />
                  <span>{winningResult ? 'Mở Hòm Tiếp' : 'Mở Hòm Ngay'}</span>
                </>
              )}
            </button>
          </div>

          {/* ── LƯỚI VẬT PHẨM TRONG HÒM ────────────────────────────────── */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#28323e] pb-2.5">
              <div>
                <span className="text-[11px] font-mono tracking-wider text-gray-400 uppercase font-semibold">
                  TRONG HÒM CÓ GÌ?
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-base font-bold text-white">Vật phẩm trong hòm</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#202731] text-[#dfc681] border border-[#2e3744]">
                    {sortedInventory.length.toString().padStart(2, '0')} món
                  </span>
                </div>
              </div>

              {/* Chú giải */}
              <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4b69ff]" />Phổ biến (&lt;35k)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#8847ff]" />Hiếm (35k-70k)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ffd700]" />Huyền thoại (&gt;70k)</span>
              </div>
            </div>

            {/* Grid món */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {sortedInventory.map((dish, idx) => {
                const rarityColor = RARITY_COLOR[dish.rarity] || '#4b69ff';
                const rarityLabel = RARITY_LABEL[dish.rarity] || 'Phổ biến';
                return (
                  <div
                    key={`${dish._id || dish.name}-${idx}`}
                    className="group rounded-lg overflow-hidden border border-[#262f3a] bg-[#1a1f26] hover:bg-[#202731]
                      transition-all hover:scale-[1.02] flex flex-col justify-between p-2.5"
                    style={{ borderBottom: `4px solid ${rarityColor}` }}
                  >
                    <div className="w-full h-24 rounded bg-black/25 flex items-center justify-center overflow-hidden mb-2">
                      {dish.image ? (
                        <img
                          src={dish.image}
                          alt={dish.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <Utensils className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white truncate" title={dish.name}>
                        {dish.name}
                      </h5>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span
                          className="font-semibold truncate max-w-[70%]"
                          style={{ color: rarityColor }}
                        >
                          {rarityLabel}
                        </span>
                        <span className="font-bold text-[#dfc681] text-[10px]">
                          {dish.priceRange || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── OVERLAY KẾT QUẢ MỞ HÒM ─────────────────────────────────────── */}
        {showRevealDialog && winningResult?.winnerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg">
            <div
              className="relative w-full max-w-lg rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center border overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #18222b 0%, #25333e 100%)',
                borderColor: `${RARITY_COLOR[winningResult.winnerItem.rarity] || '#dfc681'}60`,
                boxShadow: `0 0 50px ${RARITY_COLOR[winningResult.winnerItem.rarity] || '#dfc681'}40`
              }}
            >
              <span className="text-xs font-mono font-bold tracking-[3px] text-[#b6c2ca] uppercase mb-1">
                VẬT PHẨM MỚI
              </span>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 mb-2 tracking-tight">
                {winningResult.winnerItem.name}
              </h2>

              <p className="text-sm text-[#aebbc5] mb-4">
                {winningResult.winnerItem.description || 'Món ngon FoodFast gợi ý cho bạn'}{' '}
                <span className="text-[#dfc681] font-semibold">{winningResult.winnerItem.priceRange}</span>
              </p>

              {/* Ảnh món */}
              <div
                className="relative my-3 p-4 rounded-2xl w-full max-w-[280px] aspect-square flex items-center justify-center overflow-hidden"
                style={{
                  background: `radial-gradient(circle, ${RARITY_COLOR[winningResult.winnerItem.rarity] || '#dfc681'}33 0%, transparent 70%)`,
                  borderBottom: `4px solid ${RARITY_COLOR[winningResult.winnerItem.rarity] || '#dfc681'}`
                }}
              >
                {winningResult.winnerItem.image ? (
                  <img
                    src={winningResult.winnerItem.image}
                    alt={winningResult.winnerItem.name}
                    className="w-full h-full object-cover rounded-xl shadow-2xl"
                  />
                ) : (
                  <Utensils className="w-14 h-14 text-[#dfc681]" />
                )}
              </div>

              {/* Huy hiệu rarity + x2 Xu */}
              <div className="flex items-center gap-2 my-2 flex-wrap justify-center">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase"
                  style={{
                    backgroundColor: `${RARITY_COLOR[winningResult.winnerItem.rarity] || '#dfc681'}25`,
                    color: RARITY_COLOR[winningResult.winnerItem.rarity] || '#dfc681',
                    border: `1px solid ${RARITY_COLOR[winningResult.winnerItem.rarity] || '#dfc681'}50`
                  }}
                >
                  {RARITY_LABEL[winningResult.winnerItem.rarity] || 'Phổ biến'}
                </span>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EE4D2D] text-white text-xs font-bold shadow-md">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Nhận x2 Xu FoodFast (2.000 Xu)</span>
                </div>
              </div>

              {/* Đồng hồ 10 phút */}
              <div className="my-3 flex items-center gap-2 text-xs text-gray-300">
                <Clock className="w-4 h-4 text-[#dfc681]" />
                {sessionSecondsLeft > 0 ? (
                  <span>
                    Đặt món tên tương tự trong:{' '}
                    <strong className="text-[#dfc681] font-mono text-sm">{formattedCountdown}</strong>
                    {' '}để nhận x2 Xu!
                  </span>
                ) : (
                  <span className="text-gray-400">Phiên ưu đãi đã hết hạn.</span>
                )}
              </div>

              {/* Gợi ý */}
              <div className="w-full p-3 rounded-lg bg-[#dfc681]/10 border border-[#dfc681]/20 text-xs text-[#c8b97a] text-left mb-4">
                <strong className="text-[#dfc681]">💡 Gợi ý:</strong> Vào trang chủ, tìm quán bạn thích và đặt bất kỳ
                món có tên tương tự "<span className="font-bold text-white">{winningResult.winnerItem.name}</span>"
                là được tự động nhận x2 Xu!
              </div>

              {/* Buttons */}
              <div className="mt-2 w-full flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRevealDialog(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Tiếp tục quay
                </button>

                <button
                  type="button"
                  onClick={handleGoOrder}
                  disabled={sessionSecondsLeft <= 0}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#EE4D2D] to-[#f97316] hover:from-[#dc3f1f] hover:to-[#ea580c]
                    text-white font-extrabold text-xs uppercase tracking-wider shadow-lg hover:shadow-[#EE4D2D]/30 transition-all active:scale-95
                    flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Đặt Món Ngay (+x2 XU)</span>
                  <span className="font-mono text-amber-200">({formattedCountdown})</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
