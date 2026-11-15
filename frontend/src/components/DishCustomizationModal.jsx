import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import { getDishCustomizationConfig } from '../utils/dishCustomization';
import { getDishImageByName } from '../utils/menuImageSync';

export default function DishCustomizationModal({ dish, isOpen, onClose, onConfirm }) {
  if (!isOpen || !dish) return null;

  const config = useMemo(() => getDishCustomizationConfig(dish), [dish]);
  const dishImage = dish.image || dish.imageUrl || getDishImageByName(dish.name);
  const optionGroups = config?.optionGroups || [];

  // Trạng thái lưu trữ các lựa chọn của từng nhóm:
  // - single select: object choice { id, name, price }
  // - multi select: array of choice objects [{ id, name, price }]
  const [selectedMap, setSelectedMap] = useState(() => {
    const init = {};
    optionGroups.forEach((group) => {
      if (group.multiple) {
        // Multi-select (vd: Topping)
        init[group.id] = group.choices.filter((c) => c.isDefault);
      } else {
        // Single-select (vd: Kích cỡ, Mức đường, Mức đá, Nước sốt)
        const defaultChoice = group.choices.find((c) => c.isDefault) || (group.required ? group.choices[0] : null);
        init[group.id] = defaultChoice || null;
      }
    });
    return init;
  });

  const [customerNote, setCustomerNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Xử lý khi bấm vào 1 lựa chọn
  const handleChoiceClick = (group, choice) => {
    setSelectedMap((prev) => {
      if (group.multiple) {
        const currentList = Array.isArray(prev[group.id]) ? prev[group.id] : [];
        const exists = currentList.some((c) => c.id === choice.id);
        const nextList = exists
          ? currentList.filter((c) => c.id !== choice.id)
          : [...currentList, choice];
        return { ...prev, [group.id]: nextList };
      } else {
        // Single-select: Nếu không bắt buộc thì cho phép bấm lại để hủy chọn
        const current = prev[group.id];
        if (!group.required && current?.id === choice.id) {
          return { ...prev, [group.id]: null };
        }
        return { ...prev, [group.id]: choice };
      }
    });
  };

  // Tính đơn giá 1 phần sau khi cộng các lựa chọn đã chọn
  const unitPrice = useMemo(() => {
    const base = Number(dish.price) || 0;
    let extra = 0;

    optionGroups.forEach((group) => {
      const selected = selectedMap[group.id];
      if (!selected) return;

      if (Array.isArray(selected)) {
        selected.forEach((c) => {
          extra += Number(c.price || 0);
        });
      } else if (selected && selected.price) {
        extra += Number(selected.price || 0);
      }
    });

    return base + extra;
  }, [dish.price, optionGroups, selectedMap]);

  // Tổng tiền cho toàn bộ số lượng
  const totalPrice = unitPrice * quantity;

  // Xác nhận thêm vào giỏ hàng
  const handleAddToCart = () => {
    // Thu thập danh sách tóm tắt các lựa chọn đã chọn để hiển thị chi tiết trong đơn hàng
    const selectedOptionsSummary = [];
    let detectedSize = null;

    optionGroups.forEach((group) => {
      const selected = selectedMap[group.id];
      if (!selected) return;

      if (Array.isArray(selected)) {
        selected.forEach((c) => {
          selectedOptionsSummary.push({
            groupName: group.name,
            choiceName: c.name,
            price: Number(c.price || 0)
          });
        });
      } else if (selected) {
        if (group.name.toLowerCase().includes('size') || group.name.toLowerCase().includes('kích cỡ')) {
          detectedSize = selected;
        }
        selectedOptionsSummary.push({
          groupName: group.name,
          choiceName: selected.name,
          price: Number(selected.price || 0)
        });
      }
    });

    const signatureKey = selectedOptionsSummary
      .map((s) => `${s.groupName}:${s.choiceName}`)
      .sort()
      .join('|');

    const customizedItem = {
      ...dish,
      menuItemId: dish._id || dish.menuItemId || dish.id,
      name: dish.name,
      basePrice: Number(dish.price) || 0,
      price: unitPrice,
      quantity,
      image: dishImage,
      selectedSize: detectedSize,
      selectedOptionsSummary,
      optionsMap: selectedMap,
      note: customerNote.trim(),
      // Khóa định danh duy nhất trong giỏ hàng
      cartItemId: `${dish._id || dish.name}_${encodeURIComponent(signatureKey)}_${encodeURIComponent(customerNote.trim())}`
    };

    onConfirm(customizedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white dark:bg-[#1e1b18] text-[#2b2721] dark:text-[#ede6d8] border border-gray-100 dark:border-[rgba(240,234,224,0.12)] w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header món ăn */}
        <div className="relative border-b border-gray-100 dark:border-[rgba(240,234,224,0.1)] p-4 flex gap-3.5 bg-gray-50/50 dark:bg-[#25201a]/70">
          <img
            src={dishImage}
            alt={dish.name}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border border-gray-200/80 dark:border-[rgba(240,234,224,0.12)] shadow-xs"
          />
          <div className="flex-1 min-w-0 pr-6 space-y-1">
            <h3 className="font-extrabold text-gray-900 dark:text-[#ede6d8] text-sm sm:text-base leading-snug line-clamp-2">
              {dish.name}
            </h3>
            {dish.description && (
              <p className="text-xs text-gray-500 dark:text-[#ede6d8]/60 line-clamp-2 leading-relaxed">
                {dish.description}
              </p>
            )}
            <p className="text-sm sm:text-base font-black text-[#EE4D2D]">
              {(Number(dish.price) || 0).toLocaleString('vi-VN')} đ
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 dark:bg-[#2a241e] hover:bg-gray-100 dark:hover:bg-[#342b23] text-gray-500 dark:text-[#ede6d8]/70 transition-colors shadow-xs cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Nội dung các nhóm tùy chọn cuộn dọc */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Render từng nhóm tùy chọn do Quán thiết lập */}
          {optionGroups.map((group) => {
            const isHorizontal = group.layout === 'HORIZONTAL';
            const selectedVal = selectedMap[group.id];

            return (
              <div key={group.id} className="space-y-2.5">
                {/* Tiêu đề nhóm (Trường chính) */}
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-[#ede6d8] flex items-center gap-1.5">
                    <span>{group.name}</span>
                    {group.required && (
                      <span className="text-[10px] text-red-500 font-semibold bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                        Bắt buộc
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-[#ede6d8]/50">
                    {group.multiple ? 'Chọn nhiều' : 'Chọn 1'}
                  </span>
                </div>

                {/* 1. DẠNG NGANG NHỎ (Horizontal small pills/chips - vd Đường, Đá, Mức cay) */}
                {isHorizontal ? (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {group.choices.map((choice) => {
                      const isSelected = group.multiple
                        ? Array.isArray(selectedVal) && selectedVal.some((c) => c.id === choice.id)
                        : selectedVal?.id === choice.id;

                      return (
                        <button
                          type="button"
                          key={choice.id}
                          onClick={() => handleChoiceClick(group, choice)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#EE4D2D] text-white shadow-xs scale-[1.02]'
                              : 'bg-gray-100 dark:bg-[#26211c] hover:bg-gray-200 dark:hover:bg-[#302a24] text-gray-700 dark:text-[#ede6d8]/80'
                          }`}
                        >
                          {choice.name}
                          {choice.price > 0 && ` (+${choice.price.toLocaleString('vi-VN')} đ)`}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* 2. DẠNG DỌC LỚN (Vertical large cards - vd Size, Nước sốt, Topping) */
                  <div className="space-y-2 pt-0.5">
                    {group.choices.map((choice) => {
                      const isSelected = group.multiple
                        ? Array.isArray(selectedVal) && selectedVal.some((c) => c.id === choice.id)
                        : selectedVal?.id === choice.id;

                      return (
                        <div
                          key={choice.id}
                          onClick={() => handleChoiceClick(group, choice)}
                          className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#EE4D2D] bg-orange-50/50 dark:bg-orange-950/30 shadow-xs font-semibold'
                              : 'border-gray-200 dark:border-[rgba(240,234,224,0.12)] hover:border-gray-300 dark:hover:border-stone-600 bg-white dark:bg-[#25201a]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {group.multiple ? (
                              <div
                                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'border-[#EE4D2D] bg-[#EE4D2D] text-white'
                                    : 'border-gray-300 dark:border-stone-600 bg-white dark:bg-[#1a1714]'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            ) : (
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'border-[#EE4D2D] bg-[#EE4D2D]'
                                    : 'border-gray-300 dark:border-stone-600 bg-white dark:bg-[#1a1714]'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            )}
                            <span className="text-xs sm:text-sm text-gray-800 dark:text-[#ede6d8]">{choice.name}</span>
                          </div>
                          <span className="text-xs font-bold text-gray-600 dark:text-[#ede6d8]/70">
                            {choice.price > 0 ? `+${choice.price.toLocaleString('vi-VN')} đ` : '0 đ'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ghi chú cho quán */}
          {config?.allowNotes && (
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-gray-900 dark:text-[#ede6d8] block">
                Ghi chú cho quán
              </label>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder={config.notePlaceholder || 'Ví dụ: không hành, ớt để riêng, ít cay...'}
                maxLength={150}
                rows={2}
                className="w-full text-xs sm:text-sm p-3 border border-gray-200 dark:border-[rgba(240,234,224,0.14)] bg-white dark:bg-[#1a1714] text-gray-900 dark:text-[#ede6d8] focus:outline-none focus:border-[#EE4D2D] transition-colors resize-none placeholder:text-gray-400 dark:placeholder:text-[#ede6d8]/40 rounded-2xl"
              />
              <div className="text-right text-[10px] text-gray-400 dark:text-[#ede6d8]/40">
                {customerNote.length}/150
              </div>
            </div>
          )}
        </div>

        {/* Footer: Bộ chọn số lượng & Nút Thêm vào giỏ */}
        <div className="border-t border-gray-100 dark:border-[rgba(240,234,224,0.1)] p-4 bg-white dark:bg-[#1e1b18] flex items-center gap-3">
          {/* Bộ đếm số lượng */}
          <div className="flex items-center border border-gray-200 dark:border-[rgba(240,234,224,0.14)] rounded-2xl px-2 py-1.5 bg-gray-50 dark:bg-[#25201a] shrink-0">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="p-1 text-gray-500 dark:text-[#ede6d8]/60 hover:text-gray-900 dark:hover:text-[#ede6d8] disabled:opacity-30 cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-extrabold text-gray-900 dark:text-[#ede6d8]">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="p-1 text-gray-700 dark:text-[#ede6d8]/80 hover:text-[#EE4D2D] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Nút Thêm vào giỏ hàng */}
          <button
            onClick={handleAddToCart}
            className="flex-1 py-3.5 px-4 bg-[#EE4D2D] hover:bg-[#d73211] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-between transition-all cursor-pointer active:scale-98"
          >
            <span>Thêm vào giỏ hàng</span>
            <span>{totalPrice.toLocaleString('vi-VN')} đ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
