import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || user?.userId || user?._id || user?.email;

  const [cartItems, setCartItems] = useState([]);
  const [currentRestaurant, setCurrentRestaurant] = useState(null);

  // Đồng bộ giỏ hàng theo trạng thái xác thực của người dùng
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      // Khi CHƯA ĐĂNG NHẬP: Giỏ hàng bắt buộc rỗng 100%
      setCartItems([]);
      setCurrentRestaurant(null);
      // Dọn dẹp các key giỏ hàng vãng lai cũ nếu có
      localStorage.removeItem('cart_items');
      localStorage.removeItem('cart_restaurant');
    } else {
      // Khi ĐÃ ĐĂNG NHẬP: Tải giỏ hàng riêng biệt theo userId
      try {
        const userCartKey = `cart_items_${userId}`;
        const userRestKey = `cart_restaurant_${userId}`;
        const savedItems = localStorage.getItem(userCartKey) || localStorage.getItem('cart_items');
        const savedRest = localStorage.getItem(userRestKey) || localStorage.getItem('cart_restaurant');

        setCartItems(savedItems ? JSON.parse(savedItems) : []);
        setCurrentRestaurant(savedRest ? JSON.parse(savedRest) : null);

        // Xóa key dùng chung để tránh rò rỉ dữ liệu giữa các phiên
        localStorage.removeItem('cart_items');
        localStorage.removeItem('cart_restaurant');
      } catch {
        setCartItems([]);
        setCurrentRestaurant(null);
      }
    }
  }, [isAuthenticated, userId]);

  // Lưu giỏ hàng vào LocalStorage riêng của từng user
  useEffect(() => {
    if (isAuthenticated && userId) {
      const userCartKey = `cart_items_${userId}`;
      const userRestKey = `cart_restaurant_${userId}`;

      if (cartItems.length > 0) {
        localStorage.setItem(userCartKey, JSON.stringify(cartItems));
        if (currentRestaurant) {
          localStorage.setItem(userRestKey, JSON.stringify(currentRestaurant));
        }
      } else {
        localStorage.removeItem(userCartKey);
        localStorage.removeItem(userRestKey);
      }
    }
  }, [cartItems, currentRestaurant, isAuthenticated, userId]);

  // Thêm món vào giỏ hàng
  const addToCart = (item, restaurant) => {
    if (!isAuthenticated) {
      alert('Vui lòng đăng nhập để thêm món vào giỏ hàng và đặt món!');
      window.location.href = '/login';
      return false;
    }

    const addQty = Number(item.quantity) || 1;
    const targetKey = item.cartItemId || item.menuItemId || item._id;

    // Nếu thêm món từ quán khác, làm mới giỏ hàng theo quán mới
    if (currentRestaurant && currentRestaurant._id !== restaurant._id && cartItems.length > 0) {
      const confirmChange = window.confirm(
        `Giỏ hàng của bạn đang có món từ "${currentRestaurant.name}". Bạn có muốn đổi sang đặt món từ "${restaurant.name}" không?`
      );
      if (!confirmChange) return false;
      setCartItems([{ ...item, cartItemId: targetKey, quantity: addQty }]);
      setCurrentRestaurant(restaurant);
      return true;
    }

    if (!currentRestaurant) {
      setCurrentRestaurant(restaurant);
    }

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) => (i.cartItemId || i.menuItemId || i._id) === targetKey
      );

      if (existingIndex > -1) {
        const newItems = [...prevItems];
        newItems[existingIndex].quantity += addQty;
        return newItems;
      } else {
        return [
          ...prevItems,
          {
            ...item,
            cartItemId: targetKey,
            menuItemId: item._id || item.menuItemId,
            quantity: addQty
          }
        ];
      }
    });

    return true;
  };

  // Giảm bớt số lượng hoặc xóa món
  const removeFromCart = (itemId) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find((i) => (i.cartItemId || i.menuItemId || i._id) === itemId);
      if (existing && existing.quantity > 1) {
        return prevItems.map((i) =>
          (i.cartItemId || i.menuItemId || i._id) === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      const filtered = prevItems.filter((i) => (i.cartItemId || i.menuItemId || i._id) !== itemId);
      if (filtered.length === 0) {
        setCurrentRestaurant(null);
      }
      return filtered;
    });
  };

  // Lấy tất cả biến thể của một món ăn cụ thể đang có trong giỏ hàng (Chuẩn FoodFast)
  const getDishVariants = (menuItemId, dishName) => {
    return cartItems.filter((i) => {
      const matchId = menuItemId && (i.menuItemId === menuItemId || i._id === menuItemId);
      const matchName = dishName && i.name === dishName;
      return matchId || matchName;
    });
  };

  // Tính tổng số lượng của tất cả các biến thể của món ăn trong giỏ
  const getDishTotalQuantity = (menuItemId, dishName) => {
    const variants = getDishVariants(menuItemId, dishName);
    return variants.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  };

  // Tăng/giảm số lượng của một biến thể cụ thể
  const updateVariantQuantity = (cartItemId, delta) => {
    setCartItems((prevItems) => {
      const index = prevItems.findIndex(
        (i) => (i.cartItemId || i._id) === cartItemId
      );
      if (index === -1) return prevItems;

      const currentItem = prevItems[index];
      const newQty = (currentItem.quantity || 1) + delta;

      if (newQty <= 0) {
        const remaining = prevItems.filter((_, idx) => idx !== index);
        if (remaining.length === 0) {
          setCurrentRestaurant(null);
        }
        return remaining;
      } else {
        const next = [...prevItems];
        next[index] = { ...currentItem, quantity: newQty };
        return next;
      }
    });
  };

  // Cập nhật trực tiếp số lượng
  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((i) =>
        (i.cartItemId || i.menuItemId || i._id) === itemId ? { ...i, quantity } : i
      )
    );
  };

  // Xóa toàn bộ giỏ hàng
  const clearCart = () => {
    setCartItems([]);
    setCurrentRestaurant(null);
    if (userId) {
      localStorage.removeItem(`cart_items_${userId}`);
      localStorage.removeItem(`cart_restaurant_${userId}`);
    }
    localStorage.removeItem('cart_items');
    localStorage.removeItem('cart_restaurant');
  };

  // Tính tổng tiền & tổng số lượng món (Nếu chưa đăng nhập luôn trả về 0)
  const totalPrice = isAuthenticated
    ? cartItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      )
    : 0;

  const totalItems = isAuthenticated
    ? cartItems.reduce(
        (sum, item) => sum + (Number(item.quantity) || 1),
        0
      )
    : 0;

  return (
    <CartContext.Provider
      value={{
        cartItems: isAuthenticated ? cartItems : [],
        currentRestaurant: isAuthenticated ? currentRestaurant : null,
        totalPrice,
        totalItems,
        subtotal: totalPrice,
        addToCart,
        removeFromCart,
        updateQuantity,
        getDishVariants,
        getDishTotalQuantity,
        updateVariantQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart phải được sử dụng bên trong CartProvider');
  }
  return context;
};
