import React, { useRef, useEffect, useState } from 'react';

export default function HomeSketchbookSection({ onDishSelect }) {
  const iframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(980);

  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data) return;
      if (e.data.type === 'FOODFAST_SKETCHBOOK_PAGE_CHANGED') {
        if (typeof onDishSelect === 'function') {
          onDishSelect(e.data);
        }
      }
      if (e.data.type === 'FOODFAST_SKETCHBOOK_HEIGHT' && e.data.height) {
        setIframeHeight(Math.max(920, Math.ceil(e.data.height)));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onDishSelect]);

  return (
    <div className="relative w-full overflow-hidden bg-transparent my-0">
      {/* Sổ tay Ký họa Ẩm thực Ba Miền & Ghi chú món ăn hòa làm 1 trực tiếp với toàn trang (Không viền hộp, không thanh cuộn) */}
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
