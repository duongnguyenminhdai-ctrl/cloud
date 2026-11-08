import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Check, Sparkles } from 'lucide-react';
import { getDishCustomizationConfig } from '../utils/dishCustomization';
import { getDishImageByName } from '../utils/menuImageSync';

export default function DishCustomizationModal({ dish, isOpen, onClose, onConfirm }) {
  if (!isOpen || !dish) return null;

  const config = useMemo(() => getDishCustomizationConfig(dish), [dish]);
  const dishImage = dish.image || dish.imageUrl || getDishImageByName(dish.name);

  // States tùy chọn
  const [selectedSize, setSelectedSize] = useState(() => {
    return config.sizes?.[0] || { id: 'std', name: 'Tiêu chuẩn', price: 0 };
  });

  const [selectedSugar, setSelectedSugar] = useState(config.defaultSugar || '70% Đường (Chuẩn)');
  const [selectedIce, setSelectedIce] = useState(config.defaultIce || '70% Đá (Chuẩn)');
  const [selectedSpice, setSelectedSpice] = useState(config.defaultSpice || 'Cay nhẹ (Chuẩn)');
  const [selectedSauce, setSelectedSauce] = useState(config.defaultSauce || 'Sốt Phô mai đặc biệt (Chuẩn)');

  const [selectedToppings, setSelectedToppings] = useState([]);
  const [customerNote, setCustomerNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Bật/tắt topping
  const toggleTopping = (topping) => {
    setSelectedToppings((prev) => {
      const exists = prev.some((t) => t.id === topping.id);
      if (exists) {
        return prev.filter((t) => t.id !== topping.id);
      } else {
        return [...prev, topping];
      }
    });
  };

  // Tính đơn giá 1 phần sau khi cộng size và toppings
  const unitPrice = useMemo(() => {
    const base = Number(dish.price) || 0;
    const sizeExtra = Number(selectedSize?.price) || 0;
    const toppingsExtra = selectedToppings.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    return base + sizeExtra + toppingsExtra;
  }, [dish.price, selectedSize, selectedToppings]);

  // Tổng tiền cho toàn bộ số lượng
  const totalPrice = unitPrice * quantity;

  // Xác nhận thêm vào giỏ hàng
  const handleAddToCart = () => {
    const customizedItem = {
      ...dish,
      menuItemId: dish._id || dish.menuItemId || dish.id,
      name: dish.name,
      basePrice: Number(dish.price) || 0,
      price: unitPrice, // Giá đã gồm size + toppings
      quantity,
      image: dishImage,
      selectedSize,
      selectedToppings,
      options: {
        sugar: config.type === 'BEVERAGE' ? selectedSugar : undefined,
        ice: config.type === 'BEVERAGE' ? selectedIce : undefined,
        spice: config.type === 'VIETNAMESE' ? selectedSpice : undefined,
        sauce: config.type === 'FASTFOOD' ? selectedSauce : undefined
      },
      note: customerNote.trim(),
      // Khóa định danh duy nhất trong giỏ hàng
      cartItemId: `${dish._id || dish.name}_${selectedSize.id}_${selectedToppings.map(t => t.id).sort().join('-')}_${encodeURIComponent(customerNote.trim())}`
    };

    onConfirm(customizedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header món ăn */}
        <div className="relative border-b border-gray-100 p-4 flex gap-3.5 bg-gray-50/50">
          <img
            src={dishImage}
            alt={dish.name}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border border-gray-200/80 shadow-xs"
          />
          <div className="flex-1 min-w-0 pr-6 space-y-1">
            <h3 className="font-extrabold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2">
              {dish.name}
            </h3>
            {dish.description && (
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                {dish.description}
              </p>
            )}
            <p className="text-sm sm:text-base font-black text-[#EE4D2D]">
              {(Number(dish.price) || 0).toLocaleString('vi-VN')} đ
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 text-gray-500 transition-colors shadow-xs"
            title="Đóng"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Nội dung các nhóm tùy chọn cuộn dọc */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* 1. Chọn Kích cỡ (Bắt buộc) */}
          {config.sizes && config.sizes.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <span>Kích cỡ (Size)</span>
                  <span className="text-[10px] text-red-500 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
                    Bắt buộc
                  </span>
                </span>
                <span className="text-xs text-gray-400">Chọn 1</span>
              </div>

              <div className="space-y-2">
                {config.sizes.map((size) => {
                  const isSelected = selectedSize?.id === size.id;
                  return (
                    <label
                      key={size.id}
                      onClick={() => setSelectedSize(size)}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#EE4D2D] bg-orange-50/50 shadow-xs font-semibold'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? 'border-[#EE4D2D] bg-[#EE4D2D]' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs sm:text-sm text-gray-800">{size.name}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-600">
                        {size.price > 0 ? `+${size.price.toLocaleString('vi-VN')} đ` : '0 đ'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Mức Đường & Mức Đá (Nếu là Đồ uống) */}
          {config.type === 'BEVERAGE' && (
            <>
              {/* Mức đường */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-gray-900">
                    Mức ngọt (Đường)
                  </span>
                  <span className="text-xs text-gray-400">Chọn 1</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.sugarLevels.map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setSelectedSugar(lvl)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        selectedSugar === lvl
                          ? 'bg-[#EE4D2D] text-white font-bold shadow-xs'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mức đá */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-gray-900">
                    Mức lạnh (Đá)
                  </span>
                  <span className="text-xs text-gray-400">Chọn 1</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.iceLevels.map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setSelectedIce(lvl)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        selectedIce === lvl
                          ? 'bg-[#EE4D2D] text-white font-bold shadow-xs'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 3. Mức Cay (Nếu là Món Việt) */}
          {config.type === 'VIETNAMESE' && config.spiceLevels && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-gray-900">
                  Mức độ cay
                </span>
                <span className="text-xs text-gray-400">Chọn 1</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.spiceLevels.map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setSelectedSpice(lvl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      selectedSpice === lvl
                        ? 'bg-[#EE4D2D] text-white font-bold shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Loại Sốt (Nếu là Fast food) */}
          {config.type === 'FASTFOOD' && config.sauces && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-gray-900">
                  Nước sốt đi kèm
                </span>
                <span className="text-xs text-gray-400">Chọn 1</span>
              </div>
              <div className="space-y-1.5">
                {config.sauces.map((s) => (
                  <label
                    key={s}
                    onClick={() => setSelectedSauce(s)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedSauce === s ? 'border-[#EE4D2D] bg-orange-50/50 font-bold text-orange-950' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedSauce === s ? 'border-[#EE4D2D] bg-[#EE4D2D]' : 'border-gray-300'
                      }`}
                    >
                      {selectedSauce === s && <div className="w-1 h-1 rounded-full bg-white" />}
                    </div>
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 5. Danh sách Topping (Chọn nhiều) */}
          {config.toppings && config.toppings.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-gray-900">
                  Topping gọi thêm
                </span>
                <span className="text-xs text-gray-400">Không bắt buộc</span>
              </div>

              <div className="space-y-2">
                {config.toppings.map((topping) => {
                  const isChecked = selectedToppings.some((t) => t.id === topping.id);
                  return (
                    <label
                      key={topping.id}
                      onClick={() => toggleTopping(topping)}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-[#EE4D2D] bg-orange-50/40 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked ? 'border-[#EE4D2D] bg-[#EE4D2D] text-white' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs sm:text-sm text-gray-800 font-medium">{topping.name}</span>
                      </div>
                      <span className="text-xs font-bold text-[#EE4D2D]">
                        +{topping.price.toLocaleString('vi-VN')} đ
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Ghi chú cho quán */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-bold text-gray-900 block">
              Ghi chú cho quán
            </label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder={config.notePlaceholder || 'Ví dụ: không hành, ớt để riêng, ít ngọt...'}
              maxLength={150}
              rows={2}
              className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#EE4D2D] transition-colors resize-none placeholder:text-gray-400"
            />
            <div className="text-right text-[10px] text-gray-400">
              {customerNote.length}/150
            </div>
          </div>
        </div>

        {/* Footer: Bộ chọn số lượng & Nút Thêm vào giỏ */}
        <div className="border-t border-gray-100 p-4 bg-white flex items-center gap-3">
          {/* Bộ đếm số lượng */}
          <div className="flex items-center border border-gray-200 rounded-2xl px-2 py-1.5 bg-gray-50 shrink-0">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-extrabold text-gray-900">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="p-1 text-gray-700 hover:text-[#EE4D2D] cursor-pointer"
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
