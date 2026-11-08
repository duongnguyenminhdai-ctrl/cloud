import React, { useState } from 'react';
import { X, Ticket, Truck, Store, BadgePercent, CheckCircle2 } from 'lucide-react';

export default function VoucherPickerModal({
  isOpen,
  onClose,
  vouchers,
  currentAppliedCode,
  onSelectVoucher
}) {
  if (!isOpen) return null;

  const [activeCategory, setActiveCategory] = useState('ALL');

  const filteredVouchers = vouchers.filter((v) => {
    if (activeCategory === 'ALL') return true;
    return v.type === activeCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#EE4D2D] text-white rounded-xl shadow-sm">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">
                Chọn Voucher FoodFast
              </h3>
              <p className="text-xs text-gray-500">
                Áp dụng mã ưu đãi để nhận giảm giá món & freeship
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Filter Category Pills */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-100 overflow-x-auto no-scrollbar text-xs font-bold">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'FREESHIP', label: 'Freeship' },
            { id: 'DISCOUNT', label: 'Giảm giá món' },
            { id: 'STORE', label: 'Quán đối tác' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#EE4D2D] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Danh sách Voucher */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredVouchers.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              Không có mã giảm giá nào thuộc danh mục này.
            </div>
          ) : (
            filteredVouchers.map((voucher) => {
              const isFreeship = voucher.type === 'FREESHIP';
              const isStore = voucher.type === 'STORE';
              const isSelected = (currentAppliedCode || '').toUpperCase() === (voucher.code || '').toUpperCase();

              return (
                <div
                  key={voucher.code}
                  className={`relative bg-white rounded-2xl border transition-all flex items-stretch overflow-hidden group shadow-xs ${
                    isSelected
                      ? 'border-[#EE4D2D] ring-2 ring-orange-500/20 bg-orange-50/20'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {/* Left Badge */}
                  <div
                    className={`w-24 sm:w-28 p-3 flex flex-col items-center justify-center text-center text-white shrink-0 relative border-r border-dashed border-gray-200 ${
                      isFreeship
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                        : isStore
                        ? 'bg-gradient-to-br from-red-500 to-rose-600'
                        : 'bg-gradient-to-br from-[#EE4D2D] to-orange-500'
                    }`}
                  >
                    {isFreeship ? (
                      <Truck className="w-6 h-6 mb-1" />
                    ) : isStore ? (
                      <Store className="w-6 h-6 mb-1" />
                    ) : (
                      <BadgePercent className="w-6 h-6 mb-1" />
                    )}
                    <span className="text-[10px] font-black tracking-wide uppercase leading-tight">
                      {voucher.badge || 'Ưu đãi'}
                    </span>

                    {/* Vết cắt tròn */}
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full border border-gray-200 z-10" />
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full border border-gray-200 z-10" />
                  </div>

                  {/* Right Content */}
                  <div className="flex-1 p-3.5 flex items-center justify-between gap-3 min-w-0">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">
                          {voucher.code}
                        </span>
                      </div>
                      <p className="font-bold text-xs sm:text-sm text-gray-900 line-clamp-1">
                        {voucher.title}
                      </p>
                      <p className="text-[11px] text-gray-500 line-clamp-1">
                        {voucher.condition}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {voucher.expiry || 'HSD: 30 ngày'}
                      </p>
                    </div>

                    {/* Button Áp dụng */}
                    <button
                      type="button"
                      onClick={() => onSelectVoucher(voucher.code)}
                      disabled={isSelected}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1'
                          : 'bg-[#EE4D2D] hover:bg-[#d73211] text-white shadow-xs active:scale-95'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đang dùng</span>
                        </>
                      ) : (
                        'Áp dụng'
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
