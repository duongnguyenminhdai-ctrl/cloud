import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Flame,
  Coins,
  Star,
  Tag,
  Zap,
  Leaf,
  Utensils,
  Volume2,
  VolumeX,
  Clock,
  ArrowRight,
  RotateCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { rouletteApi, restaurantApi } from '../api/client';
import { useCart } from '../context/CartContext';
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

// Danh sách món ăn mẫu chất lượng cao FoodFast làm dự phòng nếu chưa tải kịp DB
const FALLBACK_DISHES = [
  {
    menuItemId: 'dish_ff_01',
    _id: 'dish_ff_01',
    name: 'Bánh Mì Thịt Nướng Đặc Biệt',
    price: 32000,
    image: 'https://images.unsplash.com/photo-1549611016-3a70d82b5040?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_01',
    restaurantName: 'Bánh Mì Huỳnh Hoa FoodFast',
    restaurantRating: 4.9,
    isVegetarian: false
  },
  {
    menuItemId: 'dish_ff_02',
    _id: 'dish_ff_02',
    name: 'Trà Sữa Trân Châu Hoàng Kim',
    price: 34000,
    image: 'https://images.unsplash.com/photo-1558857563-b37cf5c490a1?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_02',
    restaurantName: 'Trà Sữa Phúc Long Station',
    restaurantRating: 4.8,
    isVegetarian: true
  },
  {
    menuItemId: 'dish_ff_03',
    _id: 'dish_ff_03',
    name: 'Bún Thịt Nướng Chả Giò Giòn',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_03',
    restaurantName: 'Bún Thịt Nướng Bà Ba',
    restaurantRating: 4.7,
    isVegetarian: false
  },
  {
    menuItemId: 'dish_ff_04',
    _id: 'dish_ff_04',
    name: 'Cơm Tấm Sườn Bì Chả Đặc Biệt',
    price: 55000,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_04',
    restaurantName: 'Cơm Tấm Sài Gòn 1985',
    restaurantRating: 4.9,
    isVegetarian: false
  },
  {
    menuItemId: 'dish_ff_05',
    _id: 'dish_ff_05',
    name: 'Phở Bò Tái Nạm Gầu Bắp Hoa',
    price: 65000,
    image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_05',
    restaurantName: 'Phở Gia Truyền Bát Đàn',
    restaurantRating: 4.9,
    isVegetarian: false
  },
  {
    menuItemId: 'dish_ff_06',
    _id: 'dish_ff_06',
    name: 'Hủ Tiếu Nam Vang Tôm Mực Tươi',
    price: 52000,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_06',
    restaurantName: 'Hủ Tiếu Nam Vang Cô Dung',
    restaurantRating: 4.8,
    isVegetarian: false
  },
  {
    menuItemId: 'dish_ff_07',
    _id: 'dish_ff_07',
    name: 'Gà Rán Giòn Cay Sốt Mật Ong Cỡ Lớn',
    price: 85000,
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_07',
    restaurantName: 'Chimaek Seoul FoodFast',
    restaurantRating: 5.0,
    isVegetarian: false
  },
  {
    menuItemId: 'dish_ff_08',
    _id: 'dish_ff_08',
    name: 'Pizza Hải Sản Pesto Cao Cấp',
    price: 99000,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_08',
    restaurantName: 'The Italian Oven FoodFast',
    restaurantRating: 4.9,
    isVegetarian: false
  },
  {
    menuItemId: 'dish_ff_09',
    _id: 'dish_ff_09',
    name: 'Cơm Chay Nấm Kho Tiêu Thố Đá',
    price: 32000,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_09',
    restaurantName: 'Quán Chay Bồ Đề Tâm',
    restaurantRating: 4.9,
    isVegetarian: true
  },
  {
    menuItemId: 'dish_ff_10',
    _id: 'dish_ff_10',
    name: 'Bún Bò Huế Chay Thanh Tịnh',
    price: 42000,
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_09',
    restaurantName: 'Quán Chay Bồ Đề Tâm',
    restaurantRating: 4.9,
    isVegetarian: true
  },
  {
    menuItemId: 'dish_ff_11',
    _id: 'dish_ff_11',
    name: 'Lẩu Nấm Nhật Bản Chay Thượng Hạng',
    price: 89000,
    image: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_09',
    restaurantName: 'Quán Chay Bồ Đề Tâm',
    restaurantRating: 4.9,
    isVegetarian: true
  },
  {
    menuItemId: 'dish_ff_12',
    _id: 'dish_ff_12',
    name: 'Bánh Mì Chay Nấm Đùi Gà Nướng',
    price: 28000,
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=60',
    restaurantId: 'rest_ff_09',
    restaurantName: 'Quán Chay Bồ Đề Tâm',
    restaurantRating: 4.8,
    isVegetarian: true
  }
];

export default function FoodRouletteModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  // Audio Engine instance
  const audio = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Bộ lọc
  const [budget, setBudget] = useState('all');
  const [vegetarianOnly, setVegetarianOnly] = useState(false);

  // Danh mục món ăn thực tế từ FoodFast
  const [allDishes, setAllDishes] = useState(FALLBACK_DISHES);
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);

  // Trạng thái vòng quay
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [resetCountdown, setResetCountdown] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);

  // Băng chuyền CS:GO reel
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const positionRef = useRef(-400);
  const animFrameRef = useRef(0);
  const lastCellRef = useRef(0);
  const isBusyRef = useRef(false);

  const [visibleStart, setVisibleStart] = useState(0);
  const [reelItems, setReelItems] = useState([]);

  // Kết quả trúng thưởng & Popup "VẬT PHẨM MỚI"
  const [winningResult, setWinningResult] = useState(null);
  const [showRevealDialog, setShowRevealDialog] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(300);

  const countdownIntervalRef = useRef(null);
  const resetIntervalRef = useRef(null);

  // 1. Khởi tạo Web Audio API Audio Engine
  useEffect(() => {
    const soundEngine = new CaseAudio();
    audio.current = soundEngine;
    soundEngine.preload();

    const handleVisibility = () => {
      if (document.hidden) {
        soundEngine.pause();
      } else {
        soundEngine.recover();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      soundEngine.dispose();
      audio.current = null;
    };
  }, []);

  // Cập nhật trạng thái mute
  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (audio.current) {
      audio.current.setMuted(!nextState);
    }
  };

  // 2. Tải danh sách món ăn thật từ database FoodFast
  const fetchLiveDishes = useCallback(async () => {
    setIsLoadingDishes(true);
    try {
      const res = await restaurantApi.getAll();
      const rawData = res.data?.data || res.data || [];
      const extracted = [];

      if (Array.isArray(rawData)) {
        rawData.forEach((restaurant) => {
          if (restaurant.status && ['BANNED', 'LOCKED', 'REJECTED'].includes(restaurant.status)) return;
          if (restaurant.menuItems && Array.isArray(restaurant.menuItems)) {
            restaurant.menuItems.forEach((item) => {
              if (item.isAvailable === false) return;
              const price = Number(item.price);
              if (!price || price <= 0) return;

              const isVeg = Boolean(
                item.isVegetarian ||
                /(chay|thanh tịnh|bồ đề|rau củ|nấm|đậu hũ|vegetarian|vegan|tofu)/i.test(item.name || '') ||
                /(chay|thanh tịnh|bồ đề|rau củ|nấm|đậu hũ|vegetarian|vegan|tofu)/i.test(item.description || '') ||
                (Array.isArray(restaurant.cuisineTypes) &&
                  restaurant.cuisineTypes.some((t) => /(chay|healthy)/i.test(t)))
              );

              extracted.push({
                menuItemId: String(item._id || item.menuItemId),
                _id: String(item._id || item.menuItemId),
                name: item.name,
                price: price,
                image: item.image || '',
                description: item.description || '',
                restaurantId: String(restaurant._id),
                restaurantName: restaurant.name || 'Quán ngon FoodFast',
                restaurantImage: restaurant.image || '',
                restaurantRating: restaurant.rating || 4.8,
                isVegetarian: isVeg
              });
            });
          }
        });
      }

      if (extracted.length >= 6) {
        setAllDishes(extracted);
      } else {
        // Kết hợp món lấy được với fallback để đảm bảo luôn đủ món trong hòm
        setAllDishes([...extracted, ...FALLBACK_DISHES]);
      }
    } catch {
      setAllDishes(FALLBACK_DISHES);
    } finally {
      setIsLoadingDishes(false);
    }
  }, []);

  // 3. Tải trạng thái lượt quay và số giây reset
  const fetchStatus = useCallback(async () => {
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
      // Giữ mặc định 3 lượt
    }
  }, [isAuthenticated]);

  const startResetTimer = (initialSecs) => {
    if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
    let remaining = initialSecs;
    const updateText = () => {
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setResetCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
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

  // Kích hoạt khi modal mở
  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      fetchLiveDishes();
      setErrorMsg('');
      setShowRevealDialog(false);
    } else {
      setShowRevealDialog(false);
      setIsSpinning(false);
      isBusyRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  }, [isOpen, fetchStatus, fetchLiveDishes]);

  // Dọn dẹp timers khi unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
    };
  }, []);

  // 4. Lọc danh sách món ăn hợp lệ theo bộ lọc
  const eligibleDishes = useMemo(() => {
    let list = allDishes;
    if (vegetarianOnly) {
      list = list.filter((dish) => dish.isVegetarian);
    }

    const budgetConfig = BUDGET_OPTIONS.find((b) => b.id === budget);
    if (budgetConfig && budgetConfig.id !== 'all') {
      list = list.filter((d) => d.price >= budgetConfig.min && d.price <= budgetConfig.max);
    }

    return list.length > 0 ? list : allDishes;
  }, [allDishes, budget, vegetarianOnly]);

  // 5. Khởi tạo dải thẻ trên băng chuyền khi danh sách hợp lệ đổi
  useEffect(() => {
    if (isSpinning || !eligibleDishes.length) return;
    const initialItems = [];
    for (let id = 0; id < 14; id++) {
      const dish = eligibleDishes[id % eligibleDishes.length];
      initialItems.push({ id, dish });
    }
    setReelItems(initialItems);
    setVisibleStart(0);
    positionRef.current = -400;
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(-400px, 0, 0)`;
    }
  }, [eligibleDishes, isSpinning]);

  // Đếm ngược 5 phút ưu đãi x2 Xu sau khi trúng thưởng
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

  const formattedCountdown = useMemo(() => {
    const m = Math.floor(sessionSecondsLeft / 60);
    const s = sessionSecondsLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [sessionSecondsLeft]);

  // 6. Thực hiện mở hòm CS:GO (Open Case)
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
      // Gọi API quay thưởng backend FoodFast
      const response = await rouletteApi.spin({ budget, mood: 'all' });
      const resData = response.data;

      if (!resData?.success) {
        throw new Error(resData?.message || 'Không thể mở hòm lúc này');
      }

      const {
        winnerItem,
        sessionId,
        bonusType,
        expiresAt,
        spinsRemaining: newRemaining
      } = resData.data;

      if (typeof newRemaining === 'number') {
        setSpinsRemaining(newRemaining);
      }

      // Xây dựng Profile vòng quay chuẩn CS:GO
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const profile = createSpinProfile(Math.random, reducedMotion);

      const width = viewportRef.current.clientWidth;
      const start = positionRef.current;
      const center = Math.floor((width / 2 - start) / STEP);
      const target = center + profile.tiles;
      const sf = stopFraction();
      const end = width / 2 - TILE_WIDTH * sf - target * STEP;

      // Chuẩn bị các thẻ quanh mục tiêu
      const items = reelItems.filter(
        (it) => it.id >= center - Math.ceil(width / STEP) - 2 && it.id <= target + 6
      );
      const lastId = items.length ? Math.max(...items.map((i) => i.id)) : center;

      for (let id = lastId + 1; id <= target + 6; id++) {
        if (id === target) {
          items.push({ id, dish: winnerItem });
        } else {
          const randomDish = eligibleDishes[Math.floor(Math.random() * eligibleDishes.length)];
          items.push({ id, dish: randomDish });
        }
      }

      setReelItems(items);

      // Bắt đầu âm thanh mở hòm
      audio.current?.play('csgo_ui_crate_open');

      const duration = profile.durationMs;
      const started = performance.now();
      let renderedStart = visibleStart;
      lastCellRef.current = Math.floor((start - width / 2) / STEP);

      const animate = (now) => {
        const progress = Math.max(0, Math.min(1, (now - started) / duration));
        const next = start + (end - start) * spinProgress(progress, profile.friction);
        positionRef.current = next;

        // Cơ chế ảo hóa DOM
        const firstVisible = Math.max(0, Math.floor(-next / STEP));
        if (firstVisible - renderedStart >= 3 || firstVisible < renderedStart) {
          renderedStart = Math.max(0, firstVisible - 2);
          setVisibleStart(renderedStart);
        }

        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${next}px, 0, 0)`;
        }

        // Kích hoạt âm thanh tíc tíc khi một thẻ trượt qua vạch vàng trung tâm
        const cell = Math.floor((next - width / 2) / STEP);
        if (cell !== lastCellRef.current) {
          audio.current?.play('csgo_ui_crate_item_scroll');
          lastCellRef.current = cell;
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // Hoàn tất quay: hiển thị thông báo kết quả và phát âm thanh trúng thưởng
        isBusyRef.current = false;
        setIsSpinning(false);

        const wonDishWithRarity = {
          ...winnerItem,
          rarity: getDishRarity(winnerItem.price)
        };

        setWinningResult({
          winnerItem: wonDishWithRarity,
          sessionId,
          bonusType: bonusType || 'DOUBLE_COINS',
          expiresAt
        });
        setShowRevealDialog(true);

        const revealSound = getRaritySound(winnerItem.price);
        audio.current?.play(revealSound);
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } catch (err) {
      isBusyRef.current = false;
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

  // 7. Hành động CTA: ĐẶT MÓN NÀY NGAY (+x2 XU)
  const handleOrderWonDish = () => {
    if (!winningResult?.winnerItem) return;

    const { winnerItem, sessionId, expiresAt } = winningResult;

    // 1. Lưu phiên x2 Xu vào sessionStorage để Checkout nhận diện
    try {
      sessionStorage.setItem(
        'foodfast_roulette_session',
        JSON.stringify({
          sessionId,
          menuItemId: winnerItem.menuItemId || winnerItem._id,
          itemName: winnerItem.name,
          restaurantId: winnerItem.restaurantId,
          restaurantName: winnerItem.restaurantName || 'Quán ăn FoodFast',
          price: winnerItem.price,
          image: winnerItem.image || '',
          bonusType: 'DOUBLE_COINS',
          expiresAt: expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
      );
    } catch {}

    // 2. Thêm món vào Giỏ hàng
    const cartItem = {
      _id: winnerItem.menuItemId || winnerItem._id,
      menuItemId: winnerItem.menuItemId || winnerItem._id,
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

    const added = addToCart(cartItem, restaurant);
    if (added !== false) {
      onClose();
      navigate('/checkout');
    }
  };

  // Sắp xếp các món trong kho hiển thị dưới lưới inventory
  const sortedInventoryDishes = useMemo(() => {
    return [...eligibleDishes].sort((a, b) => {
      const rarityA = getDishRarity(a.price).id;
      const rarityB = getDishRarity(b.price).id;
      if (rarityA !== rarityB) return rarityA - rarityB;
      return a.price - b.price;
    });
  }, [eligibleDishes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-5xl my-auto rounded-2xl overflow-hidden shadow-2xl border border-[#303844] 
          bg-[#13171d] text-[#e3e6eb] flex flex-col max-h-[95vh]"
        style={{
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* THANH TIÊU ĐỀ (HEADER) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#242b35] bg-[#171d24]">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#dfc681]/15 text-[#dfc681] flex items-center justify-center font-bold">
              <Zap className="w-5 h-5 text-[#dfc681]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Hôm Nay Ăn Gì?
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-[#EE4D2D] text-white">
                  Hòm Món Ngon FoodFast
                </span>
              </div>
              <p className="text-xs text-[#8c98a4] hidden sm:block">
                Mở hòm nhận món ăn chuẩn vị — Tự động nhận <span className="text-[#dfc681] font-semibold">+x2 Xu</span> khi đặt ngay!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Lượt quay */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                spinsRemaining > 0
                  ? 'bg-amber-500/10 text-[#dfc681] border-[#dfc681]/40'
                  : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#EE4D2D]" />
              <span>{spinsRemaining}/3 lượt</span>
            </div>

            {/* Bật / Tắt âm thanh */}
            <button
              type="button"
              onClick={toggleSound}
              className={`p-2 rounded-lg border transition-all ${
                soundEnabled
                  ? 'bg-[#202832] text-[#dfc681] border-[#384452] hover:bg-[#28323e]'
                  : 'bg-[#181f26] text-gray-500 border-gray-700 hover:text-gray-300'
              }`}
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Nút đóng */}
            <button
              type="button"
              onClick={onClose}
              disabled={isSpinning}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* THÔNG BÁO LỖI HOẶC HẾT LƯỢT */}
        {errorMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {spinsRemaining <= 0 && resetCountdown && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-200">
            <Clock className="w-4 h-4 shrink-0 text-[#dfc681]" />
            <span>
              Bạn đã mở hết 3/3 lượt hòm hôm nay. Lượt mở mới sẽ được làm mới sau:{' '}
              <strong className="text-white font-mono">{resetCountdown}</strong>
            </span>
          </div>
        )}

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* KHUNG BĂNG CHUYỀN CS:GO CASE OPENING STAGE */}
          <div className="relative rounded-xl overflow-hidden border border-[#2b3542] bg-[#171a20] shadow-inner">
            {/* Header Stage */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#1b2027] border-b border-[#28323e] text-xs text-[#8c98a4]">
              <span className="font-semibold text-[#c8d1dc] flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-[#dfc681]" />
                Băng chuyền món ngon FoodFast
              </span>
              <span className="text-[11px]">Vạch dừng tự động chọn ngẫu nhiên món thắng</span>
            </div>

            {/* CỬA SỔ REEL WINDOW */}
            <div
              ref={viewportRef}
              className="relative w-full h-[225px] overflow-hidden bg-[#15191f] select-none"
              style={{
                background: 'linear-gradient(180deg, #12151b 0%, #1a2029 50%, #12151b 100%)'
              }}
            >
              {/* VẠCH CHỈ BÁO TRUNG TÂM MÀU VÀNG (CENTER SELECTOR LINE) */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-[#dfc681] z-30 pointer-events-none -translate-x-1/2"
                style={{
                  boxShadow: '0 0 12px rgba(223, 198, 129, 0.8), 0 0 2px #dfc681'
                }}
              >
                {/* Mũi tên chỉ thị đỉnh hướng xuống */}
                <div
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0 h-0 
                    border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent 
                    border-t-[14px] border-t-[#dfc681] filter drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                />
                {/* Mũi tên chỉ thị đáy hướng lên */}
                <div
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-0 h-0 
                    border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent 
                    border-b-[14px] border-b-[#dfc681] filter drop-shadow(0 -2px 4px rgba(0,0,0,0.8))"
                />
              </div>

              {/* Dải bóng mờ hai bên cạnh (Reel Fades) */}
              <div className="absolute top-0 bottom-0 left-0 w-24 sm:w-36 bg-gradient-to-r from-[#12151b] via-[#12151b]/80 to-transparent pointer-events-none z-20" />
              <div className="absolute top-0 bottom-0 right-0 w-24 sm:w-36 bg-gradient-to-l from-[#12151b] via-[#12151b]/80 to-transparent pointer-events-none z-20" />

              {/* TRACK BĂNG CHUYỀN */}
              <div
                ref={trackRef}
                className="relative h-full w-full"
                style={{
                  transform: 'translate3d(-400px, 0, 0)',
                  willChange: 'transform'
                }}
              >
                {reelItems
                  .filter(({ id }) => id >= visibleStart && id < visibleStart + 16)
                  .map(({ id, dish }) => {
                    const rarity = getDishRarity(dish.price);
                    return (
                      <div
                        key={id}
                        className="absolute top-4 w-[240px] h-[190px] rounded-lg overflow-hidden border border-[#2e3744] flex flex-col justify-between p-3.5 transition-transform"
                        style={{
                          left: `${id * STEP}px`,
                          borderBottom: `6px solid ${rarity.color}`,
                          background: `radial-gradient(ellipse at 50% 60%, ${rarity.color}22 0%, #1d222b 75%)`,
                          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.4)'
                        }}
                      >
                        {/* Huy hiệu độ hiếm góc trên */}
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded"
                            style={{
                              color: rarity.color,
                              backgroundColor: `${rarity.color}15`,
                              border: `1px solid ${rarity.color}30`
                            }}
                          >
                            {rarity.label}
                          </span>
                          <span className="text-[11px] font-bold text-white/90">
                            {dish.price?.toLocaleString('vi-VN')} đ
                          </span>
                        </div>

                        {/* Hình ảnh món ăn */}
                        <div className="flex-1 flex items-center justify-center my-1">
                          {dish.image ? (
                            <img
                              src={dish.image}
                              alt={dish.name}
                              className="max-h-[85px] max-w-[150px] object-contain rounded-md filter drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-black/30 flex items-center justify-center">
                              <Utensils className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Tên món & Quán */}
                        <div className="pt-1.5 border-t border-white/5">
                          <h4 className="text-xs font-bold text-white truncate" title={dish.name}>
                            {dish.name}
                          </h4>
                          <p className="text-[10px] text-gray-400 truncate">
                            {dish.restaurantName || 'Quán ngon FoodFast'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* BỘ ĐIỀU KHIỂN & LỌC (CONTROL BAR) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#171c22] border border-[#262f3a] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Lọc ngân sách */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#dfc681]" />
                  Ngân sách:
                </span>
                {BUDGET_OPTIONS.map((opt) => (
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

              {/* Lọc món chay */}
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
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                <span>Món chay ({allDishes.filter((d) => d.isVegetarian).length})</span>
              </button>
            </div>

            {/* NÚT MỞ HÒM (ACTION BUTTON) */}
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

          {/* LƯỚI DANH MỤC VẬT PHẨM TRONG HÒM ("ITEMS IN CASE" GRID) */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#28323e] pb-2.5">
              <div>
                <span className="text-[11px] font-mono tracking-wider text-gray-400 uppercase font-semibold">
                  TRONG HÒM CÓ GÌ?
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-base font-bold text-white">Vật phẩm trong hòm</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#202731] text-[#dfc681] border border-[#2e3744]">
                    {sortedInventoryDishes.length.toString().padStart(2, '0')} món
                  </span>
                </div>
              </div>

              {/* Chú giải độ hiếm (Rarity Legend) */}
              <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4b69ff]" />
                  Phổ biến (&lt;35k)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8847ff]" />
                  Hiếm (35k-70k)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffd700]" />
                  Huyền thoại (&gt;70k)
                </span>
              </div>
            </div>

            {/* Grid các món */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {sortedInventoryDishes.map((dish, idx) => {
                const rarity = getDishRarity(dish.price);
                return (
                  <div
                    key={`${dish.menuItemId}-${idx}`}
                    className="group rounded-lg overflow-hidden border border-[#262f3a] bg-[#1a1f26] hover:bg-[#202731] 
                      transition-all hover:scale-[1.02] flex flex-col justify-between p-2.5"
                    style={{
                      borderBottom: `4px solid ${rarity.color}`
                    }}
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
                        <span className="text-gray-400 truncate max-w-[60%]">
                          {dish.restaurantName}
                        </span>
                        <span className="font-bold text-[#dfc681]">
                          {dish.price ? `${Math.round(dish.price / 1000)}k` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* OVERLAY KẾT QUẢ MỞ HÒM ("VẬT PHẨM MỚI" REVEAL DIALOG) */}
        {showRevealDialog && winningResult?.winnerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fadeIn">
            <div
              className="relative w-full max-w-lg rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center border overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #18222b 0%, #25333e 100%)',
                borderColor: `${winningResult.winnerItem.rarity?.color || '#dfc681'}60`,
                boxShadow: `0 0 50px ${winningResult.winnerItem.rarity?.color || '#dfc681'}40`
              }}
            >
              {/* Tiêu đề "VẬT PHẨM MỚI" */}
              <span className="text-xs font-mono font-bold tracking-[3px] text-[#b6c2ca] uppercase mb-1">
                VẬT PHẨM MỚI
              </span>

              {/* Tên món ăn trúng thưởng */}
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 mb-2 tracking-tight">
                {winningResult.winnerItem.name}
              </h2>

              <p className="text-sm text-[#aebbc5] mb-4">
                Giá tham khảo ·{' '}
                <strong className="text-white font-bold">
                  {Number(winningResult.winnerItem.price || 0).toLocaleString('vi-VN')} đ
                </strong>{' '}
                / phần · {winningResult.winnerItem.restaurantName || 'FoodFast'}
              </p>

              {/* Khung tranh món ăn với vạch độ hiếm & hiệu ứng tỏa sáng */}
              <div
                className="relative my-3 p-4 rounded-2xl w-full max-w-[320px] aspect-square flex items-center justify-center overflow-hidden"
                style={{
                  background: `radial-gradient(circle, ${winningResult.winnerItem.rarity?.color || '#dfc681'}33 0%, transparent 70%)`,
                  borderBottom: `4px solid ${winningResult.winnerItem.rarity?.color || '#dfc681'}`
                }}
              >
                {winningResult.winnerItem.image ? (
                  <img
                    src={winningResult.winnerItem.image}
                    alt={winningResult.winnerItem.name}
                    className="w-full h-full object-cover rounded-xl shadow-2xl animate-pulse"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-black/30 flex items-center justify-center">
                    <Utensils className="w-14 h-14 text-[#dfc681]" />
                  </div>
                )}
              </div>

              {/* Huy hiệu độ hiếm & x2 Xu thưởng */}
              <div className="flex items-center gap-2 my-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase"
                  style={{
                    backgroundColor: `${winningResult.winnerItem.rarity?.color || '#dfc681'}25`,
                    color: winningResult.winnerItem.rarity?.color || '#dfc681',
                    border: `1px solid ${winningResult.winnerItem.rarity?.color || '#dfc681'}50`
                  }}
                >
                  {winningResult.winnerItem.rarity?.label || 'Phổ biến'}
                </span>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EE4D2D] text-white text-xs font-bold shadow-md">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Nhận x2 Xu FoodFast (2.000 Xu)</span>
                </div>
              </div>

              {/* Đồng hồ đếm ngược 5 phút */}
              <div className="my-3 flex items-center gap-2 text-xs text-gray-300">
                <Clock className="w-4 h-4 text-[#dfc681]" />
                {sessionSecondsLeft > 0 ? (
                  <span>
                    Ưu đãi x2 Xu kết thúc trong:{' '}
                    <strong className="text-[#dfc681] font-mono text-sm">{formattedCountdown}</strong>
                  </span>
                ) : (
                  <span className="text-gray-400">Phiên ưu đãi đã hết hạn.</span>
                )}
              </div>

              {/* HÀNG NÚT HÀNH ĐỘNG (WINNER ACTIONS) */}
              <div className="mt-4 pt-4 border-t border-white/10 w-full flex flex-col sm:flex-row items-center justify-end gap-3">
                {/* Nút Tiếp tục */}
                <button
                  type="button"
                  onClick={() => setShowRevealDialog(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  TIẾP TỤC
                </button>

                {/* NÚT CHÍNH: ĐẶT MÓN NÀY NGAY (+x2 XU) */}
                <button
                  type="button"
                  onClick={handleOrderWonDish}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#EE4D2D] to-[#f97316] hover:from-[#dc3f1f] hover:to-[#ea580c] 
                    text-white font-extrabold text-xs uppercase tracking-wider shadow-lg hover:shadow-[#EE4D2D]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  <span>ĐẶT MÓN NÀY NGAY (+x2 XU)</span>
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
}
