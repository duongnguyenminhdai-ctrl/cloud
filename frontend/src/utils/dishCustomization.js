/**
 * Bộ quy tắc cấu hình Tùy biến món ăn (Dish Customization) chuẩn ShopeeFood:
 * DO CHÍNH NGƯỜI BÁN (MERCHANT / QUÁN ĂN) THIẾT LẬP VÀ QUY ĐỊNH.
 *
 * Quy tắc cốt lõi:
 * 1. Nếu quán chỉ có 1 kích cỡ: Tuyệt đối KHÔNG hiển thị bước chọn Size (khách không phải chọn size).
 * 2. Nước sốt / Tùy chọn đi kèm: Chỉ hiển thị các nhóm tùy chọn do quán thiết lập (vd: Nước sốt, Mức đá, Mức đường, Độ cay...).
 * 3. Topping: Chỉ hiển thị danh sách topping do quán tạo kèm giá cộng thêm.
 * 4. Món không có tùy chọn: Mặc định là món 1 size chuẩn, không ép buộc chọn size hay nước sốt.
 */

/**
 * Lấy cấu hình tùy biến của món ăn dựa trên dữ liệu quán thiết lập
 * @param {object} dish - Món ăn
 * @returns {object} Cấu hình tùy biến
 */
export const getDishCustomizationConfig = (dish) => {
  if (!dish) return null;

  // 1. Cấu hình do chính Chủ quán (Merchant) thiết lập cho món ăn
  if (dish.customization && (dish.customization.hasCustomization || dish.customization.sizes?.length > 0 || dish.customization.optionGroups?.length > 0 || dish.customization.toppings?.length > 0)) {
    const cust = dish.customization;
    const rawSizes = Array.isArray(cust.sizes) ? cust.sizes : [];
    const rawOptionGroups = Array.isArray(cust.optionGroups) ? cust.optionGroups : [];
    const rawToppings = Array.isArray(cust.toppings) ? cust.toppings : [];

    // Chỉ khi quán thiết lập từ 2 kích cỡ trở lên thì khách mới cần chọn size.
    // Nếu quán chỉ có 0 hoặc 1 size, sizes = [] để không hiển thị bước chọn size!
    const effectiveSizes = rawSizes.length > 1 ? rawSizes.map((s, idx) => ({
      id: s.id || s._id || `size_${idx}`,
      name: s.name,
      price: Number(s.price || s.priceBonus || 0),
      isDefault: s.isDefault || idx === 0
    })) : [];

    const effectiveOptionGroups = rawOptionGroups.map((og, idx) => ({
      id: og.id || og._id || `opt_${idx}`,
      name: og.name,
      required: og.required !== false,
      options: Array.isArray(og.options) ? og.options : [],
      defaultOption: og.defaultOption || (Array.isArray(og.options) && og.options.length > 0 ? og.options[0] : '')
    }));

    const effectiveToppings = rawToppings.map((t, idx) => ({
      id: t.id || t._id || `top_${idx}`,
      name: t.name,
      price: Number(t.price || 0)
    }));

    return {
      type: 'MERCHANT_CUSTOM',
      sizes: effectiveSizes,
      optionGroups: effectiveOptionGroups,
      toppings: effectiveToppings,
      allowNotes: cust.allowNotes !== false,
      notePlaceholder: cust.notePlaceholder || 'Ghi chú cho quán (không hành, ít cay, để riêng nước sốt...)'
    };
  }

  // 2. Món chưa có cấu hình riêng (Món 1 size chuẩn mặc định):
  // Không ép khách chọn size, không ép chọn nước sốt
  return {
    type: 'SINGLE_SIZE',
    sizes: [], // 0 hoặc 1 size -> Không hiển thị chọn size
    optionGroups: [],
    toppings: [],
    allowNotes: true,
    notePlaceholder: 'Ghi chú cho quán (không hành, ít cay, để riêng nước chấm...)'
  };
};

/**
 * Kiểm tra xem một món ăn có các tùy chọn (Size, Nước sốt, Topping) do quán thiết lập hay không
 * @param {object} dish - Món ăn
 * @returns {boolean} true nếu có ít nhất 1 tùy chọn
 */
export const hasDishCustomization = (dish) => {
  if (!dish) return false;
  const config = getDishCustomizationConfig(dish);
  if (!config) return false;
  const hasMultipleSizes = Array.isArray(config.sizes) && config.sizes.length > 1;
  const hasOptionGroups = Array.isArray(config.optionGroups) && config.optionGroups.length > 0;
  const hasToppings = Array.isArray(config.toppings) && config.toppings.length > 0;
  return hasMultipleSizes || hasOptionGroups || hasToppings;
};
