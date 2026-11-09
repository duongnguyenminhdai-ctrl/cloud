import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Sparkles, Tag, ArrowRight } from 'lucide-react';

/**
 * Modal Popup Khuyến mãi Deal sốc đầu ứng dụng phong cách ShopeeFood (PopupSale)
 * Lấy cảm hứng từ popup.sale.tsx trong shopeefood-app-main
 */
export default function PromotionPopupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const PROMO_CODE = 'FREESHIP50K';

  useEffect(() => {
    // Chỉ hiển thị 1 lần duy nhất trong mỗi phiên duyệt web
    const hasShown = sessionStorage.getItem('foodfast_popup_sale_shown');
    if (!hasShown) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem('foodfast_popup_sale_shown', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(PROMO_CODE);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-orange-600 via-orange-500 to-amber-500 rounded-3xl p-1 shadow-2xl text-white overflow-hidden animate-scaleUp">
        {/* Nút đóng */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center transition-colors shadow-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Nội dung Popup */}
        <div className="bg-white text-gray-900 rounded-[22px] overflow-hidden p-5 sm:p-6 space-y-4">
          {/* Banner ảnh khuyến mãi */}
          <div className="relative h-44 sm:h-48 rounded-2xl overflow-hidden bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center shadow-inner">
            <img
              src="/popups/2.png"
              alt="ShopeeFood Flash Sale"
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                // Fallback nếu ảnh không load
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-black uppercase px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3 h-3" />
              HOT DEAL HÔM NAY
            </div>
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
              Đại Tiệc FoodFast - Giảm 50%
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Áp dụng cho tất cả quán ăn đối tác tại TP. Hồ Chí Minh & toàn quốc. Giảm tối đa 50.000đ cho đơn hàng đầu tiên!
            </p>
          </div>

          {/* Hộp mã Voucher */}
          <div className="p-3 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Mã giảm giá</p>
                <p className="font-mono font-black text-sm text-orange-600 tracking-wider">
                  {PROMO_CODE}
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-orange-600 border border-orange-300 hover:bg-orange-100'
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Đã sao chép
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Sao chép
                </>
              )}
            </button>
          </div>

          {/* Nút Săn Deal Ngay */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Săn Ngay Thôi</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
