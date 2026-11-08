/**
 * Utility đồng bộ hình ảnh thực đơn nhà hàng với hình ảnh đơn hàng đã đặt
 * Đảm bảo các món ăn hiển thị trong Giỏ hàng, Đơn đã mua, Lịch sử, Đang đến
 * luôn đồng nhất 100% với hình ảnh món ăn trên Menu quán FoodFast.
 */

// Danh mục hình ảnh chuẩn từ Menu quán (seed data & thực đơn đối tác FoodFast)
export const MENU_DISH_IMAGES = {
  // Burger & Fast Food (FastFood Kitchen - Burger & Pizza)
  'burger bò phô mai': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  'cheeseburger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  'pizza hải sản': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
  'pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
  'gà rán giòn': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80',
  'gà rán': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80',
  'fried chicken': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80',
  'khoai tây chiên': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
  'khoai tây': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
  'coca-cola': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
  'coca': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
  'pepsi': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',

  // Cơm Tấm Sài Gòn & Món Cơm
  'sườn bì chả': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
  'cơm tấm sườn': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
  'cơm tấm': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
  'đùi gà nướng': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80',
  'đùi gà': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80',
  'canh khổ qua': 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80',
  'chả trứng': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=400&q=80',
  'trà đá': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',

  // Trà Sữa & Đồ Uống (Trà Sữa Phúc Long / Sunday Basic)
  'ô long': 'https://images.unsplash.com/photo-1558857563-b37cf5c8f85f?auto=format&fit=crop&w=400&q=80',
  'trà sữa': 'https://images.unsplash.com/photo-1558857563-b37cf5c8f85f?auto=format&fit=crop&w=400&q=80',
  'trà đào': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  'trà hoa hồng': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
  'cà phê phin': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
  'cà phê sữa': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
  'cà phê': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
  'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80',
  'bánh sừng bò': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80',

  // Bún, Phở, Xôi, Bánh mì
  'xôi chiên': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
  'xôi': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
  'bún bò': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  'phở': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=400&q=80',
  'bánh mì': 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=400&q=80'
};

// Ảnh món ăn mặc định chất lượng cao khi không khớp từ khóa
export const DEFAULT_DISH_FALLBACK =
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';

export const isInvalidDishImage = (img) => {
  if (!img || typeof img !== 'string') return true;
  const clean = img.trim();
  if (clean === '') return true;
  // Bỏ qua ảnh không gian / nội thất quán ăn (bàn ghế, phòng ốc) để dùng ảnh món ăn thật
  if (clean.includes('photo-1555396273-367ea4eb4db5')) return true;
  if (clean.includes('photo-1517248135467-4c7edcad34c4')) return true;
  return false;
};

/**
 * Tra cứu hình ảnh món ăn chính xác dựa trên tên món
 * @param {string} dishName - Tên món ăn (VD: "Burger Bò Phô Mai Kép")
 * @returns {string} URL hình ảnh món ăn
 */
export const getDishImageByName = (dishName) => {
  if (!dishName || typeof dishName !== 'string') {
    return DEFAULT_DISH_FALLBACK;
  }

  const clean = dishName.toLowerCase().trim();

  // Tìm theo từ khóa dài trước để có độ chính xác cao nhất
  const sortedKeywords = Object.keys(MENU_DISH_IMAGES).sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeywords) {
    if (clean.includes(keyword)) {
      return MENU_DISH_IMAGES[keyword];
    }
  }

  return DEFAULT_DISH_FALLBACK;
};

/**
 * Lấy hình ảnh món ăn đại diện chuẩn cho đơn hàng (đã đặt)
 * Ưu tiên:
 * 1. Image được lưu trực tiếp trong phần tử item của đơn (nếu là ảnh món ăn hợp lệ)
 * 2. Tra cứu theo tên món ăn đầu tiên trong danh sách items
 * 3. Tra cứu theo tên quán ăn
 * 4. Image quán ăn (nếu không phải ảnh phòng trống mặc định)
 * 5. Default Dish Fallback
 *
 * @param {object} order - Object đơn hàng
 * @returns {string} URL hình ảnh món ăn
 */
export const getOrderDishImage = (order) => {
  if (!order) return DEFAULT_DISH_FALLBACK;

  // 1. Kiểm tra ảnh trong items (bỏ qua ảnh nội thất quán)
  if (Array.isArray(order.items) && order.items.length > 0) {
    for (const it of order.items) {
      if (!isInvalidDishImage(it?.image)) {
        return it.image;
      }
      if (!isInvalidDishImage(it?.imageUrl)) {
        return it.imageUrl;
      }
    }

    // 2. Tra cứu theo tên của từng item
    for (const it of order.items) {
      if (it?.name) {
        const found = getDishImageByName(it.name);
        if (found !== DEFAULT_DISH_FALLBACK) {
          return found;
        }
      }
    }

    // Nếu tên item không khớp từ khóa chuyên biệt, lấy ảnh mặc định của món đầu tiên
    if (order.items[0]?.name) {
      return getDishImageByName(order.items[0].name);
    }
  }

  // 3. Tra cứu theo tên quán nếu có từ khóa món ăn
  if (order.restaurantName) {
    const fromStore = getDishImageByName(order.restaurantName);
    if (fromStore !== DEFAULT_DISH_FALLBACK) {
      return fromStore;
    }
  }

  // 4. Nếu có ảnh quán ăn hợp lệ (không phải ảnh phòng nhà hàng trống 1555396273)
  if (!isInvalidDishImage(order.restaurantImage)) {
    return order.restaurantImage;
  }

  return DEFAULT_DISH_FALLBACK;
};

/**
 * Tự động đồng bộ và bổ sung ảnh món ăn cho toàn bộ items trong đơn hàng
 * @param {object} order - Đơn hàng cần làm giàu dữ liệu
 * @returns {object} Đơn hàng đã có hình ảnh chuẩn
 */
export const enrichOrderWithDishImages = (order) => {
  if (!order) return order;

  const enrichedItems = Array.isArray(order.items)
    ? order.items.map((it) => {
        let image = it.image || it.imageUrl;
        if (isInvalidDishImage(image)) {
          image = getDishImageByName(it.name);
        }
        return { ...it, image };
      })
    : [];

  const displayImage = getOrderDishImage({ ...order, items: enrichedItems });

  return {
    ...order,
    items: enrichedItems,
    displayImage,
    dishImage: displayImage
  };
};

