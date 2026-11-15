import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Search,
  Utensils,
  Check,
  Tag,
  AlertCircle
} from 'lucide-react';
import { restaurantApi } from '../api/client';

export default function GroupOrderMenuModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantData,
  onAddItem,
  disabled
}) {
  const [restaurant, setRestaurant] = useState(restaurantData || null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Trạng thái số lượng và ghi chú đang chọn theo từng món
  const [quantities, setQuantities] = useState({});
  const [notes, setNotes] = useState({});
  const [addedItemIds, setAddedItemIds] = useState(new Set());

  useEffect(() => {
    if (restaurantData) {
      setRestaurant(restaurantData);
    } else if (isOpen && restaurantId) {
      setLoading(true);
      restaurantApi.getById(restaurantId)
        .then((res) => {
          if (res.data?.success && res.data.data) {
            setRestaurant(res.data.data);
          }
        })
        .catch((err) => {
          console.error('Lỗi tải thực đơn quán cho Kèo ăn trưa:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, restaurantId, restaurantData]);

  const menuItems = useMemo(() => {
    return restaurant?.menuItems || [];
  }, [restaurant]);

  // Danh mục món ăn
  const categories = useMemo(() => {
    const cats = new Set();
    menuItems.forEach((it) => {
      if (it.category) cats.add(it.category);
    });
    return ['ALL', ...Array.from(cats)];
  }, [menuItems]);

  // Lọc món theo tìm kiếm và danh mục
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchSearch = !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const handleQtyChange = (itemId, delta) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const handleNoteChange = (itemId, text) => {
    setNotes((prev) => ({ ...prev, [itemId]: text }));
  };

  const handleAddDish = (item) => {
    const qty = quantities[item._id || item.menuItemId] || 1;
    const note = notes[item._id || item.menuItemId] || '';

    const payload = {
      menuItemId: item._id || item.menuItemId,
      name: item.name,
      price: Number(item.price) || 0,
      quantity: qty,
      options: item.options || [],
      note: note.trim(),
      image: item.image || item.imageUrl || ''
    };

    onAddItem(payload);

    // Đánh dấu hiệu ứng đã thêm
    const key = item._id || item.menuItemId;
    setAddedItemIds((prev) => new Set([...prev, key]));
    setTimeout(() => {
      setAddedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-[#faf7f2] dark:bg-[#1a1714] text-[#2b2520] dark:text-[#ede6d8] border border-[#e5ded3] dark:border-[#38312b] shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-[#EE4D2D]/10 text-[#EE4D2D]">
                <Utensils className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                Thực Đơn Quán: {restaurant?.name || 'Đang tải...'}
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Chọn món yêu thích của bạn để thêm vào giỏ hàng chung của nhóm
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh tìm kiếm & Danh mục */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3 bg-[#f2ede4] dark:bg-[#201c18] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm món ăn trong thực đơn..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#161412] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EE4D2D]/30"
            />
          </div>

          {categories.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#EE4D2D] text-white shadow-sm'
                      : 'bg-white dark:bg-[#161412] text-gray-700 dark:text-gray-300 hover:border-[#EE4D2D]/40 border border-transparent'
                  }`}
                >
                  {cat === 'ALL' ? 'Tất cả' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Danh sách món ăn cuộn được */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-xs sm:text-sm">
              Đang tải danh sách món ăn từ quán...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs sm:text-sm">
              Không tìm thấy món ăn nào phù hợp với từ khóa.
            </div>
          ) : (
            filteredItems.map((item) => {
              const itemId = item._id || item.menuItemId;
              const qty = quantities[itemId] || 1;
              const isAdded = addedItemIds.has(itemId);

              return (
                <div
                  key={itemId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#221e1a] border border-black/5 dark:border-white/5 hover:border-[#EE4D2D]/30 transition-all shadow-xs"
                >
                  {/* Ảnh & Thông tin món */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.image || item.imageUrl ? (
                      <img
                        src={item.image || item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-black/5"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 text-[#EE4D2D]">
                        <Utensils className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                        {item.name}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-sm font-extrabold text-[#EE4D2D]">
                          {Number(item.price || 0).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bộ chọn số lượng & Nút Thêm vào kèo */}
                  <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                    <div className="flex items-center border border-black/10 dark:border-white/10 rounded-xl overflow-hidden bg-[#faf7f2] dark:bg-[#1a1714]">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(itemId, -1)}
                        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2.5 text-xs font-bold min-w-[24px] text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(itemId, 1)}
                        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleAddDish(item)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95 ${
                        isAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#EE4D2D] hover:bg-[#dc3f1f] text-white shadow-[#EE4D2D]/20'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã thêm!</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm vào kèo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-black/5 dark:border-white/10 bg-[#f2ede4] dark:bg-[#201c18] flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Món ăn được thêm sẽ xuất hiện trực tiếp trong giỏ hàng chung của nhóm.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
