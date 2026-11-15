import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLocationCity } from '../context/LocationContext';

export default function HomeSketchbookSection({ onDishSelect }) {
  const iframeRef = useRef(null);
  const getMinHeight = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 380 : 780);
  const [iframeHeight, setIframeHeight] = useState(getMinHeight);
  const { selectedCity } = useLocationCity();
  const lastNavigatedCodeRef = useRef(null);

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

  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data) return;
      if (e.data.type === 'FOODFAST_SKETCHBOOK_READY') {
        if (selectedCity) {
          postCityToSketchbook(selectedCity);
        }
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
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onDishSelect, selectedCity, postCityToSketchbook]);

  // Khi người dùng chọn thành phố mới (qua Navbar CitySelector hay Address Modal),
  // tự động lật mở sách sang trang ẩm thực đặc trưng tương ứng
  useEffect(() => {
    if (selectedCity && selectedCity.code !== lastNavigatedCodeRef.current) {
      postCityToSketchbook(selectedCity);
    }
  }, [selectedCity, postCityToSketchbook]);

  return (
    <div className="relative w-full overflow-hidden bg-transparent my-0 -mt-5 sm:-mt-8">
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
