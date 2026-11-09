import React from 'react';
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';

/**
 * Modal cập nhật / giảm số lượng biến thể trong giỏ hàng phong cách ShopeeFood (UpdateModal)
 * Khi một món ăn có nhiều biến thể trong giỏ hàng (ví dụ 1 Size M, 2 Size L),
 * bấm nút giảm (-) sẽ mở modal này để khách hàng chỉ định chính xác biến thể muốn giảm/xóa.
 */
export default function UpdateVariantModal({
  isOpen,
  dish,
  variants = [],
  onClose,
  onUpdateQuantity
}) {
  if (!isOpen || !dish || variants.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 max-h-[85vh] flex flex-col overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900 leading-tight">
                Chỉnh sửa biến thể đã chọn
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dish.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách các biến thể của món trong giỏ hàng */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-gray-100">
          {variants.map((v, idx) => {
            const variantId = v.cartItemId || v._id;
            const price = Number(v.price) || 0;
            const qty = Number(v.quantity) || 1;
            const subtotal = price * qty;

            // Xây dựng mô tả biến thể (Size, options, toppings, note)
            const details = [];
            if (v.selectedSize?.name) details.push(`Size ${v.selectedSize.name}`);
            if (v.options && Object.keys(v.options).length > 0) {
              Object.entries(v.options).forEach(([groupName, optVal]) => {
                if (optVal) details.push(`${groupName}: ${optVal}`);
              });
            }
            if (v.selectedToppings && v.selectedToppings.length > 0) {
              const toppingNames = v.selectedToppings.map((t) => t.name).join(', ');
              details.push(`Topping: ${toppingNames}`);
            }
            if (v.note) details.push(`Ghi chú: "${v.note}"`);

            return (
              <div key={variantId || idx} className="pt-3.5 first:pt-0 flex items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">
                      {details.length > 0 ? details[0] : 'Phần tiêu chuẩn'}
                    </span>
                  </div>
                  {details.length > 1 && (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {details.slice(1).join(' • ')}
                    </p>
                  )}
                  <p className="text-xs font-bold text-orange-600">
                    {price.toLocaleString('vi-VN')} đ{' '}
                    <span className="font-normal text-gray-400">× {qty} = </span>
                    <span className="font-black text-gray-900">{subtotal.toLocaleString('vi-VN')} đ</span>
                  </p>
                </div>

                {/* Bộ điều khiển tăng giảm */}
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(variantId, -1)}
                    className="w-8 h-8 rounded-xl bg-white text-gray-700 shadow-xs hover:bg-orange-50 hover:text-orange-600 flex items-center justify-center transition-colors"
                    title={qty === 1 ? 'Xóa biến thể này' : 'Giảm 1'}
                  >
                    {qty === 1 ? (
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <Minus className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="w-6 text-center font-black text-sm text-gray-900">{qty}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(variantId, 1)}
                    className="w-8 h-8 rounded-xl bg-orange-600 text-white shadow-xs hover:bg-orange-700 flex items-center justify-center transition-colors"
                    title="Tăng 1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Tổng cộng <strong className="text-gray-900">{variants.reduce((s, v) => s + (v.quantity || 1), 0)} phần</strong> trong giỏ
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-orange-600/20 transition-all"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
