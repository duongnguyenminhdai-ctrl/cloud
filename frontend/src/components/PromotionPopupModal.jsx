import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Flame, Tag, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { voucherApi } from '../api/client';

/**
 * Modal Popup Khuyến mãi Deal sốc đầu ứng dụng thương hiệu FoodFast (Flash Sale)
 * Hỗ trợ phân trang nhiều Voucher Banner thật, có nút điều hướng mũi tên và sao chép mã.
 */
export default function PromotionPopupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchBanners = async () => {
      try {
        const res = await voucherApi.getBanners();
        const list = res.data?.data || res.data || [];
        if (isMounted) {
          if (Array.isArray(list) && list.length > 0) {
            setBanners(list);
          } else {
            // Fallback voucher mặc định
            setBanners([
              {
                code: 'FREESHIP50K',
                banner_title: 'Đại Tiệc FoodFast - Giảm 50%',
                banner_description: 'Áp dụng cho tất cả quán ăn đối tác tại TP. Hồ Chí Minh & toàn quốc. Giảm tối đa 50.000đ cho đơn hàng đầu tiên!',
                banner_image: '/popups/foodfast-promo.jpg',
                discount_type: 'PERCENTAGE',
                discount_value: 50,
                max_discount_amount: 50000
              }
            ]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setBanners([
            {
              code: 'FREESHIP50K',
              banner_title: 'Đại Tiệc FoodFast - Giảm 50%',
              banner_description: 'Áp dụng cho tất cả quán ăn đối tác tại TP. Hồ Chí Minh & toàn quốc. Giảm tối đa 50.000đ cho đơn hàng đầu tiên!',
              banner_image: '/popups/foodfast-promo.jpg',
              discount_type: 'PERCENTAGE',
              discount_value: 50,
              max_discount_amount: 50000
            }
          ]);
        }
      }
    };

    // Kiểm tra xem đã hiển thị trong phiên duyệt web hiện tại chưa
    const hasShown = sessionStorage.getItem('foodfast_popup_sale_shown');
    if (!hasShown) {
      fetchBanners();
      const timer = setTimeout(() => {
        if (isMounted) {
          setIsOpen(true);
          sessionStorage.setItem('foodfast_popup_sale_shown', 'true');
        }
      }, 1000);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isOpen || banners.length === 0) return null;

  const currentBanner = banners[currentIndex] || banners[0];
  const promoCode = currentBanner?.code || 'FREESHIP50K';

  const handleCopyCode = (e) => {
    e?.stopPropagation();
    navigator.clipboard?.writeText(promoCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrev = (e) => {
    e?.stopPropagation();
    setIsCopied(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : banners.length - 1));
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    setIsCopied(false);
    setCurrentIndex((prev) => (prev < banners.length - 1 ? prev + 1 : 0));
  };

  const handleClaim = () => {
    navigator.clipboard?.writeText(promoCode);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-orange-600 via-orange-500 to-amber-500 rounded-3xl p-1 shadow-2xl text-white overflow-hidden animate-scaleUp">
        {/* Nút đóng */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/80 flex items-center justify-center transition-all shadow-md cursor-pointer"
          title="Đóng popup"
          aria-label="Đóng popup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Nội dung Popup */}
        <div className="relative bg-white text-gray-900 rounded-[22px] overflow-hidden p-5 sm:p-6 space-y-4">
          {/* Banner ảnh khuyến mãi độc quyền FoodFast */}
          <div className="relative h-48 sm:h-52 rounded-2xl overflow-hidden bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center shadow-inner group">
            <img
              src={currentBanner.banner_image || '/popups/foodfast-promo.jpg'}
              alt={currentBanner.banner_title || currentBanner.title || 'FoodFast Flash Sale'}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = '/popups/foodfast-promo.jpg';
              }}
            />
            <div className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-black uppercase px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 animate-pulse z-10">
              <Flame className="w-3.5 h-3.5 text-white fill-white" />
              HOT DEAL HÔM NAY
            </div>

            {/* Nút mũi tên chuyển banner nếu có nhiều hơn 1 banner */}
            {banners.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-orange-600 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer backdrop-blur-xs"
                  title="Voucher trước"
                  aria-label="Voucher trước"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-orange-600 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer backdrop-blur-xs"
                  title="Voucher tiếp theo"
                  aria-label="Voucher tiếp theo"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Badge số trang voucher */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
                  {currentIndex + 1} / {banners.length}
                </div>
              </>
            )}
          </div>

          {/* Tiêu đề & Mô tả */}
          <div className="text-center space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
              {currentBanner.banner_title || currentBanner.title || 'Đại Tiệc FoodFast - Giảm 50%'}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
              {currentBanner.banner_description ||
                (currentBanner.discount_type === 'PERCENTAGE'
                  ? `Giảm ${currentBanner.discount_value}% tối đa ${currentBanner.max_discount_amount?.toLocaleString('vi-VN')}đ cho mọi đơn hàng!`
                  : `Giảm ${currentBanner.discount_value?.toLocaleString('vi-VN')}đ cho đơn hàng từ ${currentBanner.min_order_value?.toLocaleString('vi-VN')}đ!`)}
            </p>
          </div>

          {/* Dấu chấm chuyển trang (Pagination Dots) */}
          {banners.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsCopied(false);
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex
                      ? 'w-6 bg-orange-600'
                      : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Trang ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Hộp mã Voucher */}
          <div className="p-3 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0 truncate">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Mã giảm giá</p>
                <p className="font-mono font-black text-sm text-orange-600 tracking-wider truncate">
                  {promoCode}
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
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
            onClick={handleClaim}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Săn Ngay Thôi</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
