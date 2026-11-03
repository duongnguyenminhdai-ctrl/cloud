import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentRestaurant, setCurrentRestaurant] = useState(() => {
    try {
      const saved = localStorage.getItem('cart_restaurant');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Lưu vào LocalStorage khi giỏ hàng thay đổi
  useEffect(() => {
    localStorage.setItem('cart_items', JSON.stringify(cartItems));
    if (currentRestaurant) {
      localStorage.setItem('cart_restaurant', JSON.stringify(currentRestaurant));
    } else {
      localStorage.removeItem('cart_restaurant');
    }
  }, [cartItems, currentRestaurant]);

  // Thêm món vào giỏ hàng
  const addToCart = (item, restaurant) => {
    // Nếu thêm món từ quán khác, làm mới giỏ hàng theo quán mới
    if (currentRestaurant && currentRestaurant._id !== restaurant._id && cartItems.length > 0) {
      const confirmChange = window.confirm(
        `Giỏ hàng của bạn đang có món từ "${currentRestaurant.name}". Bạn có muốn đổi sang đặt món từ "${restaurant.name}" không?`
      );
      if (!confirmChange) return false;
      setCartItems([{ ...item, quantity: 1 }]);
      setCurrentRestaurant(restaurant);
      return true;
    }

    if (!currentRestaurant) {
      setCurrentRestaurant(restaurant);
    }

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) => (i.menuItemId || i._id) === (item.menuItemId || item._id)
      );

      if (existingIndex > -1) {
        const newItems = [...prevItems];
        newItems[existingIndex].quantity += 1;
        return newItems;
      } else {
        return [...prevItems, { ...item, menuItemId: item._id || item.menuItemId, quantity: 1 }];
      }
    });

    return true;
  };

  // Giảm bớt số lượng hoặc xóa món
  const removeFromCart = (itemId) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find((i) => (i.menuItemId || i._id) === itemId);
      if (existing && existing.quantity > 1) {
        return prevItems.map((i) =>
          (i.menuItemId || i._id) === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      const filtered = prevItems.filter((i) => (i.menuItemId || i._id) !== itemId);
      if (filtered.length === 0) {
        setCurrentRestaurant(null);
      }
      return filtered;
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
        (i.menuItemId || i._id) === itemId ? { ...i, quantity } : i
      )
    );
  };

  // Xóa toàn bộ giỏ hàng
  const clearCart = () => {
    setCartItems([]);
    setCurrentRestaurant(null);
    localStorage.removeItem('cart_items');
    localStorage.removeItem('cart_restaurant');
  };

  // Tính tổng tiền & tổng số lượng món
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );

  const totalItems = cartItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 1),
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        currentRestaurant,
        totalPrice,
        totalItems,
        addToCart,
        removeFromCart,
        updateQuantity,
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

