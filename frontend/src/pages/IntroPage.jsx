import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ArrowRight, ShoppingBag, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import '../styles/intro.css';

const FOOD_ITEMS = [
  {
    title: "Trà Matcha Yến Mạch Đá Xay",
    category: "Thức uống · Bột Uji cao cấp · 45.000đ",
    searchKey: "Trà Matcha",
    img: "/assets/food/food_iced_matcha_latte_1794687556325.jpg"
  },
  {
    title: "Bánh Croissant Bơ Hạt Dẻ",
    category: "Bánh ngọt · Nướng mới mỗi sáng · 38.000đ",
    searchKey: "Bánh ngọt",
    img: "/assets/food/food_artisan_croissant_1794687556033.jpg"
  },
  {
    title: "Tô Acai Quả Mọng & Kiwi",
    category: "Healthy · Yến mạch hữu cơ · 65.000đ",
    searchKey: "Healthy",
    img: "/assets/food/food_berry_acai_bowl_1794687556612.jpg"
  },
  {
    title: "Burger Bò Nướng Brioche",
    category: "Fast Food · Phô mai tan chảy · 79.000đ",
    searchKey: "Burger",
    img: "/assets/food/food_artisan_burger_1794687555832.jpg"
  },
  {
    title: "Cà Phê Espresso Cam Tonic",
    category: "Cà phê · Sảng khoái mát lạnh · 42.000đ",
    searchKey: "Cà phê",
    img: "/assets/food/food_espresso_tonic_1794687558551.jpg"
  },
  {
    title: "Tô Poke Cá Hồi Đại Tây Dương",
    category: "Món Nhật · Bơ tươi & Đậu nành · 89.000đ",
    searchKey: "Cá hồi",
    img: "/assets/food/food_salmon_poke_bowl_1794687558491.jpg"
  },
  {
    title: "Pizza Margherita Nướng Củi",
    category: "Pizza Ý · Vỏ men chua giòn xốp · 125.000đ",
    searchKey: "Pizza",
    img: "/assets/food/food_margherita_pizza_1794687559454.jpg"
  },
  {
    title: "Trà Sữa Trân Châu Đường Đen",
    category: "Trà sữa · Trân châu ấm dẻo · 39.000đ",
    searchKey: "Trà sữa",
    img: "/assets/food/food_boba_milk_tea_1794687559306.jpg"
  },
  {
    title: "Mì Ramen Tonkotsu Đậm Đà",
    category: "Món Nhật · Trứng ngâm lòng đào · 85.000đ",
    searchKey: "Mì",
    img: "/assets/food/food_ramen_bowl_1794687560090.jpg"
  },
  {
    title: "Bánh Tiramisu Mascarpone Ý",
    category: "Tráng miệng · Cà phê đậm vị · 48.000đ",
    searchKey: "Tráng miệng",
    img: "/assets/food/food_tiramisu_slice_1794687561046.jpg"
  }
];

const CARD_COUNT = 10;
const PITCH = 196;
const LOOP_LEN = CARD_COUNT * PITCH;
const AUTO_SPEED = -50;
const DECAY_BASE = 0.05;

// Thuật toán dựng đường viền Quad bo cong theo toán học
function buildRoundedQuadPath(pts, radius) {
  const n = pts.length;
  const commands = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const dx1 = prev[0] - curr[0];
    const dy1 = prev[1] - curr[1];
    const len1 = Math.hypot(dx1, dy1) || 1;

    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];
    const len2 = Math.hypot(dx2, dy2) || 1;

    const u1x = dx1 / len1;
    const u1y = dy1 / len1;
    const u2x = dx2 / len2;
    const u2y = dy2 / len2;

    const dot = Math.max(-0.999, Math.min(0.999, u1x * u2x + u1y * u2y));
    const theta = Math.acos(dot);
    const tanHalf = Math.tan(theta / 2) || 1;
    const maxCut = 0.45 * Math.min(len1, len2);
    const dist = Math.min(maxCut, radius / tanHalf);
    const actualR = dist * tanHalf;

    const t1x = curr[0] + u1x * dist;
    const t1y = curr[1] + u1y * dist;
    const t2x = curr[0] + u2x * dist;
    const t2y = curr[1] + u2y * dist;

    if (i === 0) {
      commands.push(`M ${t1x.toFixed(2)} ${t1y.toFixed(2)}`);
    } else {
      commands.push(`L ${t1x.toFixed(2)} ${t1y.toFixed(2)}`);
    }
    commands.push(
      `A ${actualR.toFixed(2)} ${actualR.toFixed(2)} 0 0 1 ${t2x.toFixed(2)} ${t2y.toFixed(2)}`
    );
  }

  commands.push("Z");
  return commands.join(" ");
}

export default function IntroPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const [selectedFood, setSelectedFood] = useState(null);

  // Điều hướng có xác nhận vượt qua Intro Gatekeeper
  const handleProceed = (targetPath = '/') => {
    sessionStorage.setItem('foodfast_intro_passed', 'true');
    sessionStorage.setItem('foodfast_intro_button_clicked', 'true');
    const pendingUrl = sessionStorage.getItem('foodfast_pending_url');
    sessionStorage.removeItem('foodfast_pending_url');

    if (targetPath === '/' && pendingUrl) {
      navigate(pendingUrl);
    } else {
      navigate(targetPath);
    }
  };

  useEffect(() => {
    const trackEl = trackRef.current;
    const stageEl = stageRef.current;
    if (!trackEl || !stageEl) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Build cards
    trackEl.innerHTML = '';
    const cards = [];
    for (let i = 0; i < CARD_COUNT; i++) {
      const item = FOOD_ITEMS[i];
      const el = document.createElement("div");
      el.className = "intro-card";
      el.dataset.index = String(i);
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `Xem món ${item.title}`);

      const mediaLayer = document.createElement("div");
      mediaLayer.className = "intro-card-media-layer";

      const poster = document.createElement("img");
      poster.className = "intro-card-poster";
      poster.src = item.img;
      poster.alt = item.title;
      poster.draggable = false;
      poster.decoding = "async";
      poster.style.animationDelay = `${(-i * 1.3).toFixed(1)}s`;
      mediaLayer.appendChild(poster);

      el.appendChild(mediaLayer);
      trackEl.appendChild(el);

      cards.push({ index: i, el, mediaLayer });
    }

    let scrollOffset = 0;
    let velocity = prefersReducedMotion ? 0 : AUTO_SPEED;
    let lastTime = performance.now() / 1000;

    let isDragging = false;
    let activePointerId = null;
    let dragStartX = 0;
    let dragLastX = 0;
    let dragLastTime = 0;
    let dragDistance = 0;
    let dragVelocity = 0;
    let dragMultiplier = 1;

    function getMetrics() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw <= 820;
      if (isMobile) {
        const stageW = stageEl.clientWidth || vw;
        const stageH = stageEl.clientHeight || 250;
        const uPx = Math.min(vw / 640, stageH / 385);
        const frameWInU = stageW / uPx;
        return { isMobile: true, uPx, centerX: frameWInU / 2, cyBase: stageH / (2 * uPx), frameWInU };
      }
      const uPx = Math.min(vw / 1440, vh / 1080);
      return { isMobile: false, uPx, centerX: 720, cyBase: 687, frameWInU: 1440 };
    }

    function layoutCarousel() {
      const { isMobile, uPx, centerX, cyBase, frameWInU } = getMetrics();
      const cornerRadius = 15 * uPx;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const raw = (((i * PITCH + scrollOffset) % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
        const t = raw > LOOP_LEN / 2 ? raw - LOOP_LEN : raw;

        const normT = t / 706;
        const x = centerX + t * (1 + 0.083 * normT * normT);
        const d = Math.abs(x - centerX) / 706;
        const w = 170 + 48 * d * d;

        const xL = x - w / 2;
        const xR = x + w / 2;

        if (xR < -80 || xL > frameWInU + 80) {
          card.el.style.visibility = "hidden";
          continue;
        }
        card.el.style.visibility = "visible";

        const qL = Math.abs(xL - centerX) / 706;
        const qR = Math.abs(xR - centerX) / 706;
        const hL = 280 + 92 * Math.pow(qL, 2.6);
        const hR = 280 + 92 * Math.pow(qR, 2.6);
        const cy = cyBase - 12 * d * d;

        const topL = cy - hL / 2;
        const topR = cy - hR / 2;
        const botL = cy + hL / 2;
        const botR = cy + hR / 2;

        const topU = Math.min(topL, topR);
        const botU = Math.max(botL, botR);

        const leftPx = xL * uPx;
        const topPx = topU * uPx;
        const cardW = w * uPx;
        const cardH = (botU - topU) * uPx;

        const pts = [
          [0, (topL - topU) * uPx],
          [cardW, (topR - topU) * uPx],
          [cardW, (botR - topU) * uPx],
          [0, (botL - topU) * uPx]
        ];

        const pathStr = buildRoundedQuadPath(pts, cornerRadius);

        card.el.style.width = `${cardW.toFixed(2)}px`;
        card.el.style.height = `${cardH.toFixed(2)}px`;
        card.el.style.transform = `translate3d(${leftPx.toFixed(2)}px, ${topPx.toFixed(2)}px, 0)`;
        card.el.style.clipPath = `path('${pathStr}')`;
      }
    }

    let animId;
    function tick() {
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, Math.max(0, now - lastTime));
      lastTime = now;

      if (!isDragging) {
        const targetSpeed = prefersReducedMotion ? 0 : AUTO_SPEED;
        velocity = targetSpeed + (velocity - targetSpeed) * Math.pow(DECAY_BASE, dt);
        scrollOffset += velocity * dt;
      }

      layoutCarousel();
      animId = requestAnimationFrame(tick);
    }

    const onWheel = (e) => {
      e.preventDefault();
      const { uPx } = getMetrics();
      const modeScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 240 : 1;
      const rawDelta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * modeScale;
      if (!rawDelta) return;

      const stepU = -(rawDelta * 1.6) / uPx;
      scrollOffset += stepU;
      velocity = Math.max(-2800, Math.min(2800, velocity * 0.45 + stepU * 14));
    };

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
      if (e.button === 1) e.preventDefault();
      isDragging = true;
      activePointerId = e.pointerId;
      dragMultiplier = e.button === 1 ? 2.2 : 1;
      dragStartX = e.clientX;
      dragLastX = e.clientX;
      dragLastTime = performance.now() / 1000;
      dragDistance = 0;
      dragVelocity = 0;
      trackEl.classList.add("is-dragging");
      trackEl.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      const { uPx } = getMetrics();
      const dxPx = e.clientX - dragLastX;
      const now = performance.now() / 1000;
      const dt = Math.max(0.004, now - dragLastTime);

      const dxU = (dxPx / uPx) * dragMultiplier;
      dragDistance = Math.max(dragDistance, Math.abs(e.clientX - dragStartX));
      scrollOffset += dxU;

      const instantVel = dxU / dt;
      dragVelocity = dragVelocity * 0.4 + instantVel * 0.6;

      dragLastX = e.clientX;
      dragLastTime = now;
    };

    const onPointerUp = (e) => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      const wasClick = dragDistance < 6 && e.button === 0;
      isDragging = false;
      dragMultiplier = 1;
      trackEl.classList.remove("is-dragging");
      if (trackEl.hasPointerCapture(e.pointerId)) {
        trackEl.releasePointerCapture(e.pointerId);
      }

      const sinceLastMove = performance.now() / 1000 - dragLastTime;
      velocity = sinceLastMove < 0.08 ? Math.max(-2800, Math.min(2800, dragVelocity)) : 0;

      if (wasClick) {
        const cardEl = e.target && e.target.closest ? e.target.closest(".intro-card") : null;
        if (cardEl) {
          const idx = Number(cardEl.dataset.index);
          setSelectedFood(FOOD_ITEMS[idx] || FOOD_ITEMS[0]);
        }
      }
      activePointerId = null;
    };

    trackEl.addEventListener("wheel", onWheel, { passive: false });
    trackEl.addEventListener("pointerdown", onPointerDown);
    trackEl.addEventListener("pointermove", onPointerMove);
    trackEl.addEventListener("pointerup", onPointerUp);
    trackEl.addEventListener("pointercancel", onPointerUp);

    window.addEventListener("resize", layoutCarousel);
    layoutCarousel();
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      trackEl.removeEventListener("wheel", onWheel);
      trackEl.removeEventListener("pointerdown", onPointerDown);
      trackEl.removeEventListener("pointermove", onPointerMove);
      trackEl.removeEventListener("pointerup", onPointerUp);
      trackEl.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", layoutCarousel);
    };
  }, []);

  return (
    <div className="intro-page-container">
      <main className="intro-frame">
        {/* Topbar điều hướng */}
        <header className="intro-topbar">
          <div className="intro-logo" onClick={() => handleProceed('/')} title="Vào FoodFast">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 drop-shadow-xs">
              <img
                src="/foodfast-logo.png"
                alt="FoodFast Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span>FoodFast</span>
          </div>

          <nav className="intro-nav" aria-label="Menu điều hướng">
            <button type="button" onClick={() => handleProceed('/')}>
              Trang Chủ
            </button>
            <button type="button" onClick={() => handleProceed('/?tab=bestseller')}>
              Món Bán Chạy
            </button>
            <button type="button" onClick={() => handleProceed('/?tab=near')}>
              Gần Bạn Nhất
            </button>
            <button type="button" onClick={() => handleProceed('/?filter=deal')}>
              Ưu Đãi & Deal
            </button>
          </nav>

          {/* Nút chuyển đổi Dark / Light Mode ("Candlelit Studio") */}
          <button
            type="button"
            className="intro-btn-theme"
            onClick={toggleTheme}
            title={`Chuyển sang chế độ ${isDark ? 'Sáng' : 'Tối'}`}
            aria-label="Chuyển chế độ Sáng / Tối"
          >
            {isDark ? (
              <>
                <Sun className="intro-theme-icon text-amber-400 stroke-[1.8]" />
                <span className="intro-theme-label">Sáng</span>
              </>
            ) : (
              <>
                <Moon className="intro-theme-icon text-[#9a6a3e] stroke-[1.8]" />
                <span className="intro-theme-label">Tối</span>
              </>
            )}
          </button>

          <button type="button" className="intro-btn-login" onClick={() => handleProceed('/login')}>
            Đăng nhập
          </button>
          <button type="button" className="intro-btn-signup" onClick={() => handleProceed('/register')}>
            Đăng ký
          </button>
        </header>

        {/* Headline & Subline */}
        <div className="intro-mobile-copy">
          <div className="intro-badge">
            ✨ Sổ Tay Mỹ Vị · Đặt Món Giao Nhanh 15 Phút
          </div>

          <h1 className="intro-headline">
            <span className="intro-hero-line">Tinh Hoa Mỹ Vị</span>
            <span className="intro-hero-line">Giao Nhanh Tận Cửa</span>
          </h1>

          <p className="intro-subline">
            Khám phá hương vị đặc sản ba miền cùng hàng ngàn món ngon từ các đầu bếp tuyển chọn.
            Đặt món nóng hổi, giao siêu tốc với ngàn ưu đãi hấp dẫn.
          </p>
        </div>

        {/* Nét vẽ nghệ thuật // */}
        <svg className="intro-doodle-slash" viewBox="0 0 34 36" fill="none" aria-hidden="true">
          <path d="M12.5 5.5C10.2 13.8 7.5 22.5 5.2 30.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M27.5 6.8C24.8 14.9 22.1 23.4 19.5 31.4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>

        {/* Ghi chú chữ viết tay: Món ngon nóng hổi */}
        <div className="intro-note-beseen-wrap">
          <div className="intro-note-beseen">
            Món ngon<br />nóng hổi
          </div>
        </div>

        {/* Mũi tên uốn lượn hướng vào băng chuyền món ăn */}
        <svg className="intro-arrow-beseen" viewBox="0 0 120 145" fill="none" aria-hidden="true">
          <path d="M72 6C96 34 94 82 54 112C40 122 27 127 16 131" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M27 119L14 132L31 137" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Vòng quay món ăn cong 3D Physics */}
        <section className="intro-carousel-stage" ref={stageRef} aria-label="Băng chuyền món ngon FoodFast">
          <div className="intro-carousel-track" ref={trackRef} role="region" aria-label="Vuốt kéo để khám phá món ngon"></div>
        </section>

        {/* Khối Button CTA chính */}
        <div className="intro-mobile-bottom">
          <div className="intro-cta-wrap">
            <button type="button" className="intro-btn-cta" onClick={() => handleProceed('/')}>
              <span>Khám Phá Ngay</span>
              <ArrowRight className="w-5 h-5 stroke-[2.4]" />
            </button>
          </div>

          <div className="intro-note-zerocost-wrap">
            <div className="intro-note-zerocost">Freeship 0Đ</div>
          </div>

          <svg className="intro-arrow-zerocost" viewBox="0 0 56 40" fill="none" aria-hidden="true">
            <path d="M6 28C18 14 34 12 49 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M41 12L50 20.5L38 23.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </main>

      {/* Modal Popup Xem Chi Tiết Món Ăn */}
      {selectedFood && (
        <div className="intro-modal-backdrop is-open" onClick={() => setSelectedFood(null)}>
          <div className="intro-modal-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="intro-modal-close" onClick={() => setSelectedFood(null)} aria-label="Đóng">
              <X className="w-5 h-5" />
            </button>
            <div className="intro-preview-box">
              <img src={selectedFood.img} alt={selectedFood.title} />
            </div>
            <div className="intro-preview-meta">
              <div>
                <h3 className="intro-preview-title">{selectedFood.title}</h3>
                <p className="intro-preview-sub">{selectedFood.category}</p>
              </div>
              <button
                type="button"
                className="intro-preview-use-btn"
                onClick={() => handleProceed(`/?search=${encodeURIComponent(selectedFood.searchKey)}`)}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Đặt Món Này Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
