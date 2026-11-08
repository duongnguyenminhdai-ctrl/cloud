/**
 * Bộ quy tắc cấu hình Tùy biến món ăn (Dish Customization) chuẩn ShopeeFood:
 * - Kích cỡ (Size: Vừa/Lớn)
 * - Mức độ ngọt/đá (cho đồ uống) hoặc mức cay/sốt (cho đồ ăn)
 * - Topping kèm giá cộng thêm (+x.000đ)
 * - Ghi chú cho quán (Ví dụ: không hành, ớt để riêng...)
 */

export const getDishCustomizationConfig = (dish) => {
  const name = (dish?.name || '').toLowerCase();

  // 1. Nhóm Đồ uống: Trà sữa, Trà đào, Cà phê, Nước ngọt, v.v.
  if (
    name.includes('trà') ||
    name.includes('cà phê') ||
    name.includes('sữa') ||
    name.includes('nước') ||
    name.includes('coca') ||
    name.includes('pepsi') ||
    name.includes('đá xay')
  ) {
    return {
      type: 'BEVERAGE',
      sizes: [
        { id: 'M', name: 'Size Vừa (M)', price: 0, default: true },
        { id: 'L', name: 'Size Lớn (L)', price: 10000 }
      ],
      sugarLevels: [
        '100% Đường',
        '70% Đường (Chuẩn)',
        '50% Đường',
        '30% Đường',
        'Không đường'
      ],
      iceLevels: [
        '100% Đá',
        '70% Đá (Chuẩn)',
        '50% Đá',
        'Ít đá',
        'Không đá'
      ],
      defaultSugar: '70% Đường (Chuẩn)',
      defaultIce: '70% Đá (Chuẩn)',
      toppings: [
        { id: 'top_boba', name: 'Trân châu đường đen dẻo', price: 8000 },
        { id: 'top_cheese', name: 'Thạch phô mai tươi', price: 10000 },
        { id: 'top_pudding', name: 'Pudding trứng béo ngậy', price: 8000 },
        { id: 'top_macchiato', name: 'Kem sữa Macchiato', price: 12000 },
        { id: 'top_white_pearl', name: 'Trân châu trắng giòn 3Q', price: 8000 }
      ],
      notePlaceholder: 'Ví dụ: ít đá, ngọt dịu, lấy thêm ống hút to...'
    };
  }

  // 2. Nhóm Burger / Pizza / Gà rán / Fast food
  if (
    name.includes('burger') ||
    name.includes('pizza') ||
    name.includes('gà rán') ||
    name.includes('khoai tây') ||
    name.includes('fast')
  ) {
    return {
      type: 'FASTFOOD',
      sizes: [
        { id: 'std', name: 'Khẩu phần Tiêu chuẩn', price: 0, default: true },
        { id: 'double', name: 'Double Size (Gấp đôi nhân)', price: 15000 }
      ],
      sauces: [
        'Sốt Phô mai đặc biệt (Chuẩn)',
        'Sốt Cay Gochujang Hàn Quốc',
        'Sốt Tiêu đen nướng BBQ',
        'Sốt Mayonnaise tương cà'
      ],
      defaultSauce: 'Sốt Phô mai đặc biệt (Chuẩn)',
      toppings: [
        { id: 'top_cheddar', name: 'Thêm lát Phô mai Cheddar Mỹ', price: 8000 },
        { id: 'top_bacon', name: 'Thịt xông khói áp chảo giòn', price: 12000 },
        { id: 'top_fries', name: 'Khoai tây chiên giòn ăn kèm', price: 15000 },
        { id: 'top_egg', name: 'Trứng ốp la lòng đào', price: 7000 }
      ],
      notePlaceholder: 'Ví dụ: không lấy dưa chuột muối, nước sốt để riêng, thêm khăn ướt...'
    };
  }

  // 3. Nhóm Cơm tấm / Bún / Phở / Món Việt
  if (
    name.includes('cơm') ||
    name.includes('sườn') ||
    name.includes('bún') ||
    name.includes('phở') ||
    name.includes('xôi') ||
    name.includes('bánh mì')
  ) {
    return {
      type: 'VIETNAMESE',
      sizes: [
        { id: 'std', name: 'Phần Tiêu chuẩn', price: 0, default: true },
        { id: 'extra', name: 'Phần Đặc biệt (Thêm thịt & cơm)', price: 12000 }
      ],
      spiceLevels: [
        'Không cay',
        'Cay nhẹ (Chuẩn)',
        'Cay vừa',
        'Cay nhiều'
      ],
      defaultSpice: 'Cay nhẹ (Chuẩn)',
      toppings: [
        { id: 'top_egg', name: 'Trứng ốp la lòng đào', price: 7000 },
        { id: 'top_cha', name: 'Chả trứng thịt nướng thêm', price: 12000 },
        { id: 'top_bi', name: 'Bì heo thơm sợi giòn', price: 10000 },
        { id: 'top_soup', name: 'Chén canh khổ qua dồn thịt', price: 15000 },
        { id: 'top_pickles', name: 'Đồ chua & dưa leo thêm', price: 5000 }
      ],
      notePlaceholder: 'Ví dụ: không lấy hành lá, sườn nướng cháy xém, nước mắm ngọt...'
    };
  }

  // 4. Món ăn chung khác (Default General Food)
  return {
    type: 'GENERAL',
    sizes: [
      { id: 'std', name: 'Khẩu phần Tiêu chuẩn', price: 0, default: true },
      { id: 'large', name: 'Khẩu phần Lớn (Nhiều hơn)', price: 10000 }
    ],
    toppings: [
      { id: 'top_sauce', name: 'Thêm chén sốt đặc biệt', price: 5000 },
      { id: 'top_egg', name: 'Trứng ốp la', price: 7000 },
      { id: 'top_cheese', name: 'Phô mai lát', price: 8000 }
    ],
    notePlaceholder: 'Ví dụ: không hành, cay vừa, để riêng nước chấm...'
  };
};
