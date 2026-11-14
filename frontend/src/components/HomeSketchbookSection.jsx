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
    <div className="relative w-full rounded-3xl overflow-hidden border border-[rgba(43,39,33,0.16)] bg-[#ece7dc]/75 shadow-lg backdrop-blur-xs transition-all">
      {/* Khung nhúng Sổ tay Ký họa Ẩm thực Ba Miền (Meng To 3D Sketchbook) */}
      <iframe
        ref={iframeRef}
        src="/landing-pages/meng-to-sketchbook.html?embed=1"
        title="FoodFast — Sổ Tay Ký Họa Ẩm Thực Ba Miền"
        className="w-full h-[620px] sm:h-[700px] md:h-[760px] lg:h-[800px] border-none m-0 p-0 block bg-transparent"
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
      />
    </div>
  );
}
