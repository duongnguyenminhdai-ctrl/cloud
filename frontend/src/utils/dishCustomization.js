/**
 * Bộ quy tắc cấu hình Tùy biến món ăn (Dish Customization) chuẩn ShopeeFood:
 * DO CHÍNH NGƯỜI BÁN (MERCHANT / CHỦ CỬA HÀNG) THIẾT LẬP VÀ QUY ĐỊNH.
 *
 * Người bán có toàn quyền:
 * 1. Tự đặt tên trường chính (vd: "Kích cỡ (Size)", "Mức ngọt (Đường)", "Mức lạnh (Đá)", "Nước sốt đi kèm", "Topping thêm"...).
 * 2. Chọn định dạng hiển thị cho từng nhóm:
 *    - Dạng dọc lớn (VERTICAL): Thẻ hàng dọc lớn có hiển thị giá cộng thêm (chuẩn cho Size, Nước sốt, Topping).
 *    - Dạng ngang nhỏ (HORIZONTAL): Các nút bấm bo tròn nhỏ nằm ngang (chuẩn cho Mức đường, Mức đá, Mức cay).
 * 3. Tự chọn số lượng và tự điền tên từng lựa chọn (vd: Size M, Size L, 70% Đường, Sốt Phô mai) kèm giá cộng thêm (0đ, 10.000đ...).
 * 4. Nếu món ăn không có tùy chọn nào (món 1 size tiêu chuẩn như Coca-Cola): Tuyệt đối KHÔNG hiển thị bước chọn size hay tùy chọn giả lập.
 */

/**
 * Lấy cấu hình tùy biến của món ăn dựa trên dữ liệu quán thiết lập
 * @param {object} dish - Món ăn
 * @returns {object} Cấu hình tùy biến
 */
export const getDishCustomizationConfig = (dish) => {
  if (!dish) return null;

  const cust = dish.customization;
  const rawOptionGroups = Array.isArray(cust?.optionGroups)
    ? cust.optionGroups
    : Array.isArray(dish.optionGroups)
    ? dish.optionGroups
    : [];
  const rawSizes = Array.isArray(cust?.sizes) ? cust.sizes : [];
  const rawToppings = Array.isArray(cust?.toppings) ? cust.toppings : [];

  // Chuẩn hóa danh sách các nhóm tùy chọn (Option Groups)
  const normalizedGroups = [];

  // 1. Chuyển đổi các optionGroups do người bán cấu hình
  rawOptionGroups.forEach((og, idx) => {
    if (!og || !og.name?.trim()) return;

    const groupId = og.id || og._id || `group_${idx}`;
    const groupName = og.name.trim();
    const layout = og.layout === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL';
    const required = og.required === true;
    const multiple = og.multiple === true;

    // Chuẩn hóa danh sách các lựa chọn bên trong nhóm
    let choices = [];
    if (Array.isArray(og.choices) && og.choices.length > 0) {
      choices = og.choices
        .filter((c) => c && c.name?.trim())
        .map((c, cIdx) => ({
          id: c.id || c._id || `${groupId}_choice_${cIdx}`,
          name: c.name.trim(),
          price: Math.max(0, Number(c.price || 0)),
          isDefault: Boolean(c.isDefault || (!multiple && cIdx === 0))
        }));
    } else if (Array.isArray(og.options) && og.options.length > 0) {
      // Tương thích với dữ liệu mảng chuỗi đơn giản
      choices = og.options
        .filter((opt) => typeof opt === 'string' && opt.trim())
        .map((opt, cIdx) => ({
          id: `${groupId}_choice_${cIdx}`,
          name: opt.trim(),
          price: 0,
          isDefault: opt.trim() === og.defaultOption || (!multiple && cIdx === 0)
        }));
    }

    if (choices.length > 0) {
      normalizedGroups.push({
        id: groupId,
        name: groupName,
        layout,
        required,
        multiple,
        choices
      });
    }
  });

  // 1.5. Chuyển đổi từ toppingGroups đính kèm trên món (nếu có)
  const linkedGroups = Array.isArray(dish.toppingGroups) ? dish.toppingGroups : [];
  linkedGroups.forEach((tg, idx) => {
    if (!tg || !tg.name?.trim()) return;
    const groupId = tg.id || `tg_${idx}`;
    if (normalizedGroups.some((g) => g.name.toLowerCase() === tg.name.trim().toLowerCase())) return;

    const layout = tg.layout === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL';
    const required = Boolean(tg.isRequired);
    const multiple = tg.maxChoices > 1 || !tg.isRequired;
    const choices = (tg.toppings || [])
      .filter((t) => t && t.name?.trim())
      .map((t, cIdx) => ({
        id: t.id || `${groupId}_${cIdx}`,
        name: t.name.trim(),
        price: Math.max(0, Number(t.extraPrice || t.price || 0)),
        isDefault: Boolean(t.isDefault || (!multiple && cIdx === 0))
      }));

    if (choices.length > 0) {
      normalizedGroups.push({
        id: groupId,
        name: tg.name.trim(),
        layout,
        required,
        multiple,
        choices
      });
    }
  });

  // 2. Tương thích ngược: Nếu có rawSizes > 1 mà chưa có nhóm size trong optionGroups
  const hasSizeGroup = normalizedGroups.some((g) =>
    g.name.toLowerCase().includes('size') || g.name.toLowerCase().includes('kích cỡ')
  );
  if (!hasSizeGroup && rawSizes.length > 1) {
    normalizedGroups.unshift({
      id: 'group_sizes_legacy',
      name: 'Kích cỡ (Size)',
      layout: 'VERTICAL',
      required: true,
      multiple: false,
      choices: rawSizes.map((s, idx) => ({
        id: s.id || s._id || `size_${idx}`,
        name: s.name,
        price: Number(s.price || s.priceBonus || 0),
        isDefault: Boolean(s.isDefault || idx === 0)
      }))
    });
  }

  // 3. Tương thích ngược: Nếu có rawToppings mà chưa có nhóm topping trong optionGroups
  const hasToppingGroup = normalizedGroups.some((g) =>
    g.name.toLowerCase().includes('topping')
  );
  if (!hasToppingGroup && rawToppings.length > 0) {
    normalizedGroups.push({
      id: 'group_toppings_legacy',
      name: 'Topping gọi thêm',
      layout: 'VERTICAL',
      required: false,
      multiple: true,
      choices: rawToppings.map((t, idx) => ({
        id: t.id || t._id || `top_${idx}`,
        name: t.name,
        price: Number(t.price || 0),
        isDefault: false
      }))
    });
  }

  // 4. Mẫu tùy biến chuẩn phong cách ShopeeFood cho các món đồ uống / nước giải khát (Image 1)
  const nameLower = (dish.name || '').toLowerCase();
  const isBeverage =
    nameLower.includes('coca') ||
    nameLower.includes('trà sữa') ||
    nameLower.includes('pepsi') ||
    nameLower.includes('cà phê') ||
    nameLower.includes('matcha') ||
    nameLower.includes('sinh tố') ||
    nameLower.includes('trà đào') ||
    nameLower.includes('nước ngọt');

  if (normalizedGroups.length === 0 && (isBeverage || dish.isCustomizable)) {
    normalizedGroups.push(
      {
        id: 'group_coca_size',
        name: 'Kích cỡ (Size)',
        layout: 'VERTICAL',
        required: true,
        multiple: false,
        choices: [
          { id: 'size_m', name: 'Size Vừa (M)', price: 0, isDefault: true },
          { id: 'size_l', name: 'Size Lớn (L)', price: 10000, isDefault: false }
        ]
      },
      {
        id: 'group_coca_sugar',
        name: 'Mức ngọt (Đường)',
        layout: 'HORIZONTAL',
        required: true,
        multiple: false,
        choices: [
          { id: 'sugar_100', name: '100% Đường', price: 0, isDefault: false },
          { id: 'sugar_70', name: '70% Đường (Chuẩn)', price: 0, isDefault: true },
          { id: 'sugar_50', name: '50% Đường', price: 0, isDefault: false },
          { id: 'sugar_30', name: '30% Đường', price: 0, isDefault: false },
          { id: 'sugar_0', name: 'Không đường', price: 0, isDefault: false }
        ]
      },
      {
        id: 'group_coca_ice',
        name: 'Mức lạnh (Đá)',
        layout: 'HORIZONTAL',
        required: true,
        multiple: false,
        choices: [
          { id: 'ice_100', name: '100% Đá', price: 0, isDefault: false },
          { id: 'ice_70', name: '70% Đá (Chuẩn)', price: 0, isDefault: true },
          { id: 'ice_50', name: '50% Đá', price: 0, isDefault: false },
          { id: 'ice_low', name: 'Ít đá', price: 0, isDefault: false },
          { id: 'ice_0', name: 'Không đá', price: 0, isDefault: false }
        ]
      },
      {
        id: 'group_coca_topping',
        name: 'Topping gọi thêm',
        layout: 'VERTICAL',
        required: false,
        multiple: true,
        choices: [
          { id: 'top_tranchau', name: 'Trân châu đường đen dẻo', price: 8000, isDefault: false },
          { id: 'top_suongchao', name: 'Thạch củ năng giòn', price: 7000, isDefault: false },
          { id: 'top_pudding', name: 'Pudding trứng béo ngậy', price: 9000, isDefault: false }
        ]
      }
    );
  }

  return {
    type: normalizedGroups.length > 0 ? 'MERCHANT_CUSTOM' : 'SINGLE_SIZE',
    optionGroups: normalizedGroups,
    // Giữ trường sizes và toppings cũ để tương thích hoàn toàn
    sizes: normalizedGroups.find(g => g.name.toLowerCase().includes('size'))?.choices || [],
    toppings: normalizedGroups.find(g => g.multiple)?.choices || [],
    allowNotes: cust?.allowNotes !== false,
    notePlaceholder: cust?.notePlaceholder || 'Ghi chú cho quán (không hành, ít cay, để riêng nước chấm...)'
  };
};

/**
 * Kiểm tra xem một món ăn có các tùy chọn (Size, Nước sốt, Topping) do quán thiết lập hay không
 * @param {object} dish - Món ăn
 * @returns {boolean} true nếu quán có cấu hình ít nhất 1 nhóm tùy chọn với các lựa chọn hợp lệ
 */
export const hasDishCustomization = (dish) => {
  if (!dish) return false;
  const config = getDishCustomizationConfig(dish);
  if (!config) return false;
  return Array.isArray(config.optionGroups) && config.optionGroups.length > 0;
};
