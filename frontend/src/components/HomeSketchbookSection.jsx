import React, { useRef, useEffect } from 'react';

export default function HomeSketchbookSection({ onDishSelect }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data) return;
      if (e.data.type === 'FOODFAST_SKETCHBOOK_PAGE_CHANGED') {
        if (typeof onDishSelect === 'function') {
          onDishSelect(e.data);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onDishSelect]);

  return (
    <div className="relative w-full overflow-hidden bg-transparent my-0">
      {/* Sổ tay Ký họa Ẩm thực Ba Miền hòa làm 1 trực tiếp với toàn trang (Không viền hộp, không thanh cuộn) */}
      <iframe
        ref={iframeRef}
        src="/landing-pages/meng-to-sketchbook.html?embed=1"
        title="FoodFast — Sổ Tay Ký Họa Ẩm Thực Ba Miền"
        className="w-full h-[580px] sm:h-[650px] md:h-[700px] lg:h-[730px] border-none m-0 p-0 block bg-transparent"
        style={{ border: 'none', background: 'transparent', overflow: 'hidden' }}
        scrolling="no"
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
      />
    </div>
  );
}
