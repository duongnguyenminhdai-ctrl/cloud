import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function MengToSketchbookLandingPage({ fullPage = true }) {
  const iframeRef = useRef(null);
  const navigate = useNavigate();
  const { totalItems } = useCart();

  useEffect(() => {
    // Lắng nghe message từ bên trong iframe (nếu người dùng bấm Đặt món / Tìm món)
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'FOODFAST_NAVIGATE') {
        const targetUrl = e.data.url || '/';
        navigate(targetUrl);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  return (
    <div className={`relative w-full ${fullPage ? 'h-screen overflow-hidden' : 'h-[850px] rounded-3xl overflow-hidden shadow-2xl border border-hairline'}`}>
      {/* Nút Floating góc trên bên trái: Trở về Mua Sắm FoodFast */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="px-3.5 py-2 rounded-full bg-[#ece7dc]/90 hover:bg-[#ece7dc] text-[#2b2721] border border-[rgba(43,39,33,0.18)] backdrop-blur-md shadow-md text-xs font-serif flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105"
          title="Trở về trang chủ FoodFast"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#9a6a3e]" />
          <span className="font-medium tracking-wide">Trang Chủ FoodFast</span>
        </button>

        <button
          onClick={() => navigate('/orders')}
          className="relative px-3.5 py-2 rounded-full bg-[#ece7dc]/90 hover:bg-[#ece7dc] text-[#2b2721] border border-[rgba(43,39,33,0.18)] backdrop-blur-md shadow-md text-xs font-serif flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105"
          title="Xem giỏ hàng & Đơn mua"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-[#9a6a3e]" />
          <span className="font-medium tracking-wide">Giỏ Hàng</span>
          {totalItems > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#9a6a3e] text-white text-[10px] font-bold flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {/* iFrame nhúng giao diện Sổ tay Ký họa Meng To Sketchbook với đầy đủ 100% hiệu ứng lật trang 3D & Kính lúp Loupe */}
      <iframe
        ref={iframeRef}
        src="/landing-pages/meng-to-sketchbook.html"
        title="FOODFAST (FF) — Sổ Tay Ký Họa Ẩm Thực Việt Nam"
        className="w-full h-full border-none m-0 p-0 block"
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
      />
    </div>
  );
}
