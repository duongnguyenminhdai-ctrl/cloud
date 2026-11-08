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
  const rawOptionGroups = Array.isArray(cust?.optionGroups) ? cust.optionGroups : [];
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
