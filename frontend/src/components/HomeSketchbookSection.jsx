import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLocationCity } from '../context/LocationContext';

export default function HomeSketchbookSection({ onDishSelect, autoScrollOnMount = true }) {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const getMinHeight = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 380 : 780);
  const [iframeHeight, setIframeHeight] = useState(getMinHeight);
  const { selectedCity } = useLocationCity();
  const lastNavigatedCodeRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const userInteractedRef = useRef(false);
  const bookMetricsRef = useRef({ top: 0, height: 0 });

  // Gửi thông điệp điều hướng 1 chiều từ City sang Sổ tay Ký họa
  const postCityToSketchbook = useCallback((city) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow || !city) return;
    try {
      iframeRef.current.contentWindow.postMessage({
        type: 'FOODFAST_NAVIGATE_CITY',
        cityCode: city.code,
        cityName: city.shortName || city.name
      }, '*');
      lastNavigatedCodeRef.current = city.code;
    } catch (err) {
      console.warn('Could not postMessage to sketchbook:', err);
    }
  }, []);

  // Tự động scroll xuống cuốn sách khi mở web để người dùng nhìn trọn vẹn hiệu ứng lật sách
  const scrollToSketchbookAndPlay = useCallback(() => {
    const playRiffle = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: 'FOODFAST_PLAY_INTRO_RIFFLE' }, '*');
      } catch {}
    };

    if (!autoScrollOnMount || hasAutoScrolledRef.current || userInteractedRef.current) {
      playRiffle();
      return;
    }

    hasAutoScrolledRef.current = true;
    const container = containerRef.current;
    if (!container || window.scrollY > 120) {
      playRiffle();
      return;
    }

    const rect = container.getBoundingClientRect();
    const docTop = rect.top + window.scrollY;
    const bookTopOffset = bookMetricsRef.current.top || 0;
    const measuredBookH = bookMetricsRef.current.height;
    const bookHeight = measuredBookH > 120 ? measuredBookH : Math.min(rect.height, 640);
    const navbarHeight = 72;
    const availH = Math.max(300, window.innerHeight - navbarHeight);

    // Căn giữa cuốn sách trong phần viewport dưới Navbar; nếu màn hình thấp thì đặt sát dưới Navbar
    const targetY = bookHeight < availH - 24
      ? docTop + bookTopOffset - navbarHeight - (availH - bookHeight) / 2
      : docTop + bookTopOffset - navbarHeight - 12;

    window.scrollTo({
      top: Math.max(0, Math.round(targetY)),
      behavior: 'smooth'
    });

    // Đợi smooth scroll đưa sách vào tầm nhìn rồi mới kích hoạt hiệu ứng lật trang 3D
    setTimeout(playRiffle, 450);
  }, [autoScrollOnMount]);

  // Nếu người dùng tự tay cuộn trang trước khi sách boot xong thì không cướp thao tác cuộn
  useEffect(() => {
    const markInteracted = () => {
      userInteractedRef.current = true;
    };
    window.addEventListener('wheel', markInteracted, { passive: true, once: true });
    window.addEventListener('touchmove', markInteracted, { passive: true, once: true });
    return () => {
      window.removeEventListener('wheel', markInteracted);
      window.removeEventListener('touchmove', markInteracted);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data) return;
      if (e.data.type === 'FOODFAST_SKETCHBOOK_READY') {
        if (e.data.bookHeight) {
          bookMetricsRef.current = {
            top: Number(e.data.bookTop) || 0,
            height: Number(e.data.bookHeight) || 0
          };
        }
        if (selectedCity) {
          postCityToSketchbook(selectedCity);
        }
        // Chờ DOM ổn định nhẹ rồi tự động scroll mượt xuống cuốn sách và lật trang
        setTimeout(scrollToSketchbookAndPlay, 150);
      }
      if (e.data.type === 'FOODFAST_SKETCHBOOK_PAGE_CHANGED') {
        // LIÊN KẾT 1 CHIỀU: Tuyệt đối KHÔNG thay đổi selectedCity của hệ thống khi người dùng lật sách
        if (typeof onDishSelect === 'function') {
          onDishSelect(e.data);
        }
      }
      if (e.data.type === 'FOODFAST_SKETCHBOOK_HEIGHT' && e.data.height) {
        const minH = window.innerWidth < 640 ? 380 : 780;
        setIframeHeight(Math.max(minH, Math.ceil(e.data.height)));
        if (e.data.bookHeight) {
          bookMetricsRef.current = {
            top: Number(e.data.bookTop) || 0,
            height: Number(e.data.bookHeight) || 0
          };
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onDishSelect, selectedCity, postCityToSketchbook, scrollToSketchbookAndPlay]);

  // Khi người dùng chọn thành phố mới (qua Navbar CitySelector hay Address Modal),
  // tự động lật mở sách sang trang ẩm thực đặc trưng tương ứng
  useEffect(() => {
    if (selectedCity && selectedCity.code !== lastNavigatedCodeRef.current) {
      postCityToSketchbook(selectedCity);
    }
  }, [selectedCity, postCityToSketchbook]);

  return (
    <div ref={containerRef} id="foodfast-sketchbook-section" className="relative w-full overflow-hidden bg-transparent my-0 -mt-5 sm:-mt-8">
      {/* Sổ tay Ký họa Ẩm thực Ba Miền & Ghi chú món ăn hòa làm 1 trực tiếp với toàn trang */}
      <iframe
        ref={iframeRef}
        src="/landing-pages/meng-to-sketchbook.html?embed=1"
        title="FoodFast — Sổ Tay Ký Họa Ẩm Thực Ba Miền"
        style={{
          width: '100%',
          height: `${iframeHeight}px`,
          border: 'none',
          background: 'transparent',
          overflow: 'hidden'
        }}
        className="w-full border-none m-0 p-0 block bg-transparent"
        scrolling="no"
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
      />
    </div>
  );
}
