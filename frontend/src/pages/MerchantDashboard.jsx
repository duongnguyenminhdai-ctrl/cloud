import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, UtensilsCrossed, Plus, Edit, Trash2, CheckCircle2,
  Clock, MapPin, Phone, RefreshCw, AlertCircle, Save, X,
  Sparkles, Settings2, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storeApi } from '../api/client';

export default function MerchantDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal thêm/sửa món
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalTab, setModalTab] = useState('basic'); // 'basic' | 'customization'

  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    description: '',
    image: '',
    isAvailable: true,
    customization: {
      hasCustomization: false,
      sizes: [],
      optionGroups: [],
      toppings: [],
      allowNotes: true,
      notePlaceholder: 'Ví dụ: không hành, ít cay, để riêng nước chấm...'
    }
  });

  const fetchStoreData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await storeApi.getMyStore();
      if (res.data?.success) {
        setStore(res.data.data);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/merchant/status');
      } else {
        setErrorMsg(err.response?.data?.message || err.message || 'Lỗi tải thông tin quán');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/merchant/dashboard');
      return;
    }
    fetchStoreData();
  }, [isAuthenticated]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setModalTab('basic');
    setItemForm({
      name: '',
      price: '',
      description: '',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      customization: {
        hasCustomization: false,
        sizes: [],
        optionGroups: [],
        toppings: [],
        allowNotes: true,
        notePlaceholder: 'Ví dụ: không hành, ít cay, để riêng nước chấm...'
      }
    });
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setModalTab('basic');
    const cust = item.customization || {};
    const formattedGroups = Array.isArray(cust.optionGroups)
      ? cust.optionGroups.map((g) => ({
          ...g,
          optionsText: Array.isArray(g.options) ? g.options.join(', ') : ''
        }))
      : [];

    setItemForm({
      name: item.name,
      price: item.price,
      description: item.description || '',
      image: item.image || '',
      isAvailable: item.isAvailable !== false,
      customization: {
        hasCustomization: cust.hasCustomization || false,
        sizes: Array.isArray(cust.sizes) ? cust.sizes : [],
        optionGroups: formattedGroups,
        toppings: Array.isArray(cust.toppings) ? cust.toppings : [],
        allowNotes: cust.allowNotes !== false,
        notePlaceholder: cust.notePlaceholder || 'Ví dụ: không hành, ít cay, để riêng nước chấm...'
      }
    });
    setShowItemModal(true);
  };

  // Quản lý Kích cỡ (Size) do quán thiết lập
  const handleAddSize = () => {
    const currentSizes = itemForm.customization?.sizes || [];
    const newSizes = [
      ...currentSizes,
      {
        id: `size_${Date.now()}`,
        name: currentSizes.length === 0 ? 'Khẩu phần Tiêu chuẩn' : 'Size Lớn (Double)',
        price: currentSizes.length === 0 ? 0 : 15000,
        isDefault: currentSizes.length === 0
      }
    ];
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        hasCustomization: true,
        sizes: newSizes
      }
    });
  };

  const handleUpdateSize = (index, field, value) => {
    const currentSizes = [...(itemForm.customization?.sizes || [])];
    currentSizes[index] = {
      ...currentSizes[index],
      [field]: field === 'price' ? Number(value) || 0 : value
    };
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        sizes: currentSizes
      }
    });
  };

  const handleRemoveSize = (index) => {
    const currentSizes = (itemForm.customization?.sizes || []).filter((_, i) => i !== index);
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        sizes: currentSizes
      }
    });
  };

  // Quản lý Nhóm Tùy Chọn Đi Kèm (Nước sốt, Mức đá, Mức đường, Độ cay...) do quán thiết lập
  const handleAddOptionGroup = () => {
    const currentGroups = itemForm.customization?.optionGroups || [];
    const newGroup = {
      id: `opt_${Date.now()}`,
      name: 'Nước sốt đi kèm',
      required: true,
      optionsText: 'Sốt Phô mai đặc biệt, Sốt Cay Gochujang, Sốt BBQ',
      options: ['Sốt Phô mai đặc biệt', 'Sốt Cay Gochujang', 'Sốt BBQ'],
      defaultOption: 'Sốt Phô mai đặc biệt'
    };
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        hasCustomization: true,
        optionGroups: [...currentGroups, newGroup]
      }
    });
  };

  const handleUpdateOptionGroup = (index, field, value) => {
    const currentGroups = [...(itemForm.customization?.optionGroups || [])];
    if (field === 'optionsText') {
      const opts = value.split(',').map((s) => s.trim()).filter(Boolean);
      currentGroups[index] = {
        ...currentGroups[index],
        optionsText: value,
        options: opts,
        defaultOption: opts[0] || ''
      };
    } else {
      currentGroups[index] = { ...currentGroups[index], [field]: value };
    }
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        optionGroups: currentGroups
      }
    });
  };

  const handleRemoveOptionGroup = (index) => {
    const currentGroups = (itemForm.customization?.optionGroups || []).filter((_, i) => i !== index);
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        optionGroups: currentGroups
      }
    });
  };

  // Quản lý Topping do quán thiết lập
  const handleAddTopping = () => {
    const currentToppings = itemForm.customization?.toppings || [];
    const newToppings = [
      ...currentToppings,
      { id: `top_${Date.now()}`, name: 'Thêm phô mai', price: 8000 }
    ];
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        hasCustomization: true,
        toppings: newToppings
      }
    });
  };

  const handleUpdateTopping = (index, field, value) => {
    const currentToppings = [...(itemForm.customization?.toppings || [])];
    currentToppings[index] = {
      ...currentToppings[index],
      [field]: field === 'price' ? Number(value) || 0 : value
    };
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        toppings: currentToppings
      }
    });
  };

  const handleRemoveTopping = (index) => {
    const currentToppings = (itemForm.customization?.toppings || []).filter((_, i) => i !== index);
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        toppings: currentToppings
      }
    });
  };

  // Áp dụng Preset Templates nhanh
  const handleApplyPreset = (presetType) => {
    if (presetType === 'BEVERAGE') {
      setItemForm({
        ...itemForm,
        customization: {
          hasCustomization: true,
          sizes: [
            { id: 'size_m', name: 'Size Vừa (M)', price: 0, isDefault: true },
            { id: 'size_l', name: 'Size Lớn (L)', price: 10000 }
          ],
          optionGroups: [
            {
              id: 'sugar',
              name: 'Mức đường',
              required: true,
              options: ['100% Đường', '70% Đường (Chuẩn)', '50% Đường', 'Không đường'],
              optionsText: '100% Đường, 70% Đường (Chuẩn), 50% Đường, Không đường',
              defaultOption: '70% Đường (Chuẩn)'
            },
            {
              id: 'ice',
              name: 'Lượng đá',
              required: true,
              options: ['100% Đá', '70% Đá (Chuẩn)', '50% Đá', 'Không đá'],
              optionsText: '100% Đá, 70% Đá (Chuẩn), 50% Đá, Không đá',
              defaultOption: '70% Đá (Chuẩn)'
            }
          ],
          toppings: [
            { id: 'top_boba', name: 'Trân châu đường đen', price: 8000 },
            { id: 'top_cheese', name: 'Thạch phô mai tươi', price: 10000 }
          ],
          allowNotes: true,
          notePlaceholder: 'Ví dụ: ít đá, ngọt dịu, lấy thêm ống hút to...'
        }
      });
    } else if (presetType === 'FASTFOOD') {
      setItemForm({
        ...itemForm,
        customization: {
          hasCustomization: true,
          sizes: [
            { id: 'std', name: 'Khẩu phần Tiêu chuẩn', price: 0, isDefault: true },
            { id: 'double', name: 'Double Size (Gấp đôi nhân)', price: 15000 }
          ],
          optionGroups: [
            {
              id: 'sauce',
              name: 'Nước sốt đi kèm',
              required: true,
              options: ['Sốt Phô mai đặc biệt', 'Sốt BBQ nướng', 'Sốt Mayonnaise tương cà'],
              optionsText: 'Sốt Phô mai đặc biệt, Sốt BBQ nướng, Sốt Mayonnaise tương cà',
              defaultOption: 'Sốt Phô mai đặc biệt'
            }
          ],
          toppings: [
            { id: 'top_cheddar', name: 'Thêm lát Phô mai Cheddar', price: 8000 },
            { id: 'top_egg', name: 'Trứng ốp la', price: 7000 }
          ],
          allowNotes: true,
          notePlaceholder: 'Ví dụ: không lấy dưa chuột muối, nước sốt để riêng...'
        }
      });
    } else if (presetType === 'VIETNAMESE') {
      setItemForm({
        ...itemForm,
        customization: {
          hasCustomization: true,
          sizes: [
            { id: 'std', name: 'Phần Tiêu chuẩn', price: 0, isDefault: true },
            { id: 'extra', name: 'Phần Đặc biệt (Thêm thịt & cơm)', price: 15000 }
          ],
          optionGroups: [],
          toppings: [
            { id: 'top_egg', name: 'Trứng ốp la lòng đào', price: 7000 },
            { id: 'top_cha', name: 'Chả trứng hấp thêm', price: 12000 }
          ],
          allowNotes: true,
          notePlaceholder: 'Ví dụ: không mỡ hành, ớt để riêng...'
        }
      });
    } else if (presetType === 'SINGLE_SIZE') {
      // Món chỉ có 1 size chuẩn duy nhất, không sốt, không topping
      setItemForm({
        ...itemForm,
        customization: {
          hasCustomization: false,
          sizes: [],
          optionGroups: [],
          toppings: [],
          allowNotes: true,
          notePlaceholder: 'Ghi chú cho quán (không hành, ít cay...)'
        }
      });
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.price) {
      alert('Vui lòng nhập tên món và giá món');
      return;
    }

    // Chuẩn hóa dữ liệu customization trước khi gửi lên API
    const sizes = (itemForm.customization?.sizes || []).filter((s) => s.name?.trim());
    const optionGroups = (itemForm.customization?.optionGroups || [])
      .filter((og) => og.name?.trim())
      .map((og) => {
        const rawOpts = og.optionsText
          ? og.optionsText.split(',').map((s) => s.trim()).filter(Boolean)
          : Array.isArray(og.options) ? og.options : [];
        return {
          id: og.id,
          name: og.name,
          required: og.required !== false,
          options: rawOpts,
          defaultOption: og.defaultOption || rawOpts[0] || ''
        };
      });
    const toppings = (itemForm.customization?.toppings || []).filter((t) => t.name?.trim());

    const hasCust = sizes.length > 1 || optionGroups.length > 0 || toppings.length > 0;

    const payload = {
      ...itemForm,
      customization: {
        hasCustomization: hasCust,
        sizes,
        optionGroups,
        toppings,
        allowNotes: itemForm.customization?.allowNotes !== false,
        notePlaceholder: itemForm.customization?.notePlaceholder || 'Ghi chú cho quán...'
      }
    };

    try {
      if (editingItem) {
        await storeApi.updateMenuItem(editingItem._id, payload);
        setSuccessMsg('Cập nhật món ăn thành công!');
      } else {
        await storeApi.addMenuItem(payload);
        setSuccessMsg('Thêm món mới vào thực đơn thành công!');
      }
      setShowItemModal(false);
      fetchStoreData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi lưu món ăn');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa món này khỏi thực đơn?')) return;
    try {
      await storeApi.deleteMenuItem(itemId);
      setSuccessMsg('Đã xóa món ăn khỏi thực đơn!');
      fetchStoreData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi xóa món ăn');
    }
  };

  const handleToggleAvailable = async (item) => {
    try {
      await storeApi.updateMenuItem(item._id, { isAvailable: !item.isAvailable });
      fetchStoreData();
    } catch (err) {
      alert('Lỗi cập nhật trạng thái món');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={store?.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80'}
                alt={store?.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/50 shadow-md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black">{store?.name || 'Cửa hàng của tôi'}</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-orange-700">
                    Đối tác FoodFast
                  </span>
                </div>
                <p className="text-xs text-orange-100 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {store?.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchStoreData}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quản lý Thực Đơn Món Ăn */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Quản lý thực đơn món ăn</h2>
              <p className="text-xs text-gray-500">Chủ quán có toàn quyền quy định giá, kích cỡ (size), nước sốt và topping cho từng món ăn</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Thêm món mới
            </button>
          </div>

          {/* Menu Items Grid */}
          {!store?.menuItems || store.menuItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold">Chưa có món ăn nào trong thực đơn</p>
              <p className="text-xs mt-1">Bấm nút "Thêm món mới" ở trên để bổ sung món đầu tiên.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.menuItems.map((item) => {
                const sizes = item.customization?.sizes || [];
                const optionGroups = item.customization?.optionGroups || [];
                const toppings = item.customization?.toppings || [];

                return (
                  <div
                    key={item._id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      item.isAvailable !== false
                        ? 'border-gray-200 hover:border-orange-300 bg-white shadow-xs'
                        : 'border-gray-100 bg-gray-50/70 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex gap-3">
                        <img
                          src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}
                          alt={item.name}
                          className="w-20 h-20 rounded-xl object-cover border flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{item.name}</h3>
                          <p className="text-xs text-gray-500 line-clamp-1">{item.description || 'Chưa có mô tả'}</p>
                          <div className="text-sm font-black text-orange-600">
                            {Number(item.price).toLocaleString('vi-VN')} đ
                          </div>
                        </div>
                      </div>

                      {/* Badges hiển thị cấu hình quán thiết lập cho món */}
                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-dashed border-gray-100">
                        {sizes.length > 1 ? (
                          <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                            {sizes.length} kích cỡ
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            1 size chuẩn
                          </span>
                        )}

                        {optionGroups.length > 0 && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                            {optionGroups.length} nhóm tùy chọn/sốt
                          </span>
                        )}

                        {toppings.length > 0 && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                            {toppings.length} topping
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleAvailable(item)}
                        className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ${
                          item.isAvailable !== false
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {item.isAvailable !== false ? '● Đang bán' : '○ Hết món'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                          title="Sửa thông tin & tùy chọn món"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item._id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa món"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Thêm / Sửa Món Ăn Toàn Diện Cho Chủ Quán */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {editingItem ? 'Chỉnh sửa món ăn & tùy chọn' : 'Thêm món ăn mới vào thực đơn'}
                </h3>
                <p className="text-xs text-gray-500">
                  Thiết lập giá bán, kích cỡ (size), nước sốt và topping do chính quán quy định
                </p>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-gray-200 px-5 bg-white text-xs sm:text-sm font-bold">
              <button
                type="button"
                onClick={() => setModalTab('basic')}
                className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
                  modalTab === 'basic'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>1. Thông tin cơ bản</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('customization')}
                className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
                  modalTab === 'customization'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                <span>2. Kích cỡ & Tùy chọn (Shop tự quy định)</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-5 space-y-5">
              {modalTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Tên món ăn *</label>
                    <input
                      type="text"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      placeholder="vd: Burger Bò Phô Mai Kép, Trà Sữa Ô Long, Cơm Tấm Sườn..."
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Giá bán cơ bản (VND) *</label>
                    <input
                      type="number"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                      placeholder="vd: 45000"
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      required
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Đây là giá chuẩn cho món ăn khi khách không chọn thêm size lớn hay topping.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả món ăn</label>
                    <textarea
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      placeholder="vd: Thịt bò nướng than hoa, kèm sốt phô mai thơm ngon..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Link hình ảnh món ăn</label>
                    <input
                      type="text"
                      value={itemForm.image}
                      onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isAvailable"
                      checked={itemForm.isAvailable}
                      onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                      className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="isAvailable" className="text-xs font-semibold text-gray-700 cursor-pointer">
                      Món ăn đang sẵn sàng phục vụ (Đang bán)
                    </label>
                  </div>
                </div>
              )}

              {modalTab === 'customization' && (
                <div className="space-y-6">
                  {/* Banner hướng dẫn người bán */}
                  <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200/80 text-xs text-orange-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-orange-900">
                      <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>Quyền tự chủ thực đơn của Chủ quán:</span>
                    </div>
                    <p className="text-orange-800 leading-relaxed">
                      Quán tự do thêm kích cỡ (size), nhóm nước sốt hoặc topping riêng của quán. 
                      <strong> Nếu quán chỉ bán 1 kích cỡ chuẩn, hãy để trống phần Size</strong> để khách hàng mua nhanh mà không bị bắt chọn size!
                    </p>
                  </div>

                  {/* Nút Chọn Mẫu Nhanh (Preset Templates) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-700 block">
                      Gợi ý thiết lập nhanh theo mẫu (1-Click Template):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('FASTFOOD')}
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-orange-400 bg-gray-50/60 hover:bg-orange-50/50 text-left text-xs transition-all"
                      >
                        <span className="block font-bold text-gray-900">🍔 Burger / Gà</span>
                        <span className="text-[10px] text-gray-500">Size, Nước sốt, Phô mai</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('BEVERAGE')}
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-orange-400 bg-gray-50/60 hover:bg-orange-50/50 text-left text-xs transition-all"
                      >
                        <span className="block font-bold text-gray-900">☕ Trà sữa / Nước</span>
                        <span className="text-[10px] text-gray-500">Size M/L, Đường/Đá, Thạch</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('VIETNAMESE')}
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-orange-400 bg-gray-50/60 hover:bg-orange-50/50 text-left text-xs transition-all"
                      >
                        <span className="block font-bold text-gray-900">🍚 Cơm / Bún / Phở</span>
                        <span className="text-[10px] text-gray-500">Tô đặc biệt, Trứng, Chả</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('SINGLE_SIZE')}
                        className="p-2.5 rounded-xl border border-red-200 hover:border-red-400 bg-red-50/40 hover:bg-red-50 text-left text-xs transition-all"
                      >
                        <span className="block font-bold text-red-700">🥫 Chỉ 1 size chuẩn</span>
                        <span className="text-[10px] text-red-500">Xóa hết (Lon nước, Canh...)</span>
                      </button>
                    </div>
                  </div>

                  {/* Mục 1: Kích cỡ (Size) do quán thiết lập */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                          1. Kích cỡ (Size) của món
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          Nếu để trống hoặc chỉ có 1 size, hệ thống tự hiểu món có 1 kích cỡ chuẩn theo giá cơ bản.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSize}
                        className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Thêm size
                      </button>
                    </div>

                    {itemForm.customization?.sizes?.length === 0 ? (
                      <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 text-center border border-dashed border-gray-200">
                        Chưa có kích cỡ riêng (Món đang áp dụng 1 kích cỡ chuẩn theo giá bán {Number(itemForm.price || 0).toLocaleString('vi-VN')} đ).
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {itemForm.customization.sizes.map((sz, idx) => (
                          <div key={sz.id || idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={sz.name}
                              onChange={(e) => handleUpdateSize(idx, 'name', e.target.value)}
                              placeholder="Tên size (vd: Size Lớn)"
                              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-orange-500"
                            />
                            <div className="relative w-32">
                              <input
                                type="number"
                                value={sz.price}
                                onChange={(e) => handleUpdateSize(idx, 'price', e.target.value)}
                                placeholder="+Giá (VND)"
                                className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-orange-500 text-right pr-6"
                              />
                              <span className="absolute right-2 top-1.5 text-[10px] text-gray-400">đ</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSize(idx)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title="Xóa size này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mục 2: Nhóm Tùy Chọn Đi Kèm (Nước sốt, Mức đá, Mức đường, Độ cay...) */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                          2. Nhóm tùy chọn đi kèm (Nước sốt, Độ cay, Mức đá...)
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          Nhập các lựa chọn cách nhau bằng dấu phẩy để khách chọn 1 món.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddOptionGroup}
                        className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Thêm nhóm
                      </button>
                    </div>

                    {itemForm.customization?.optionGroups?.length === 0 ? (
                      <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 text-center border border-dashed border-gray-200">
                        Chưa có nhóm tùy chọn nào (Khách sẽ không phải chọn nước sốt hay tùy chỉnh).
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {itemForm.customization.optionGroups.map((og, idx) => (
                          <div key={og.id || idx} className="p-3 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={og.name}
                                onChange={(e) => handleUpdateOptionGroup(idx, 'name', e.target.value)}
                                placeholder="Tên nhóm (vd: Nước sốt đi kèm)"
                                className="font-bold text-xs px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 flex-1"
                              />
                              <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={og.required !== false}
                                  onChange={(e) => handleUpdateOptionGroup(idx, 'required', e.target.checked)}
                                  className="rounded text-orange-600"
                                />
                                <span>Bắt buộc chọn</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveOptionGroup(idx)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg"
                                title="Xóa nhóm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div>
                              <input
                                type="text"
                                value={og.optionsText || (Array.isArray(og.options) ? og.options.join(', ') : '')}
                                onChange={(e) => handleUpdateOptionGroup(idx, 'optionsText', e.target.value)}
                                placeholder="Các lựa chọn (ngăn cách bằng dấu phẩy: Sốt BBQ, Sốt phô mai...)"
                                className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-gray-200 focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mục 3: Topping / Món ăn kèm do quán thiết lập */}
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                          3. Topping / Món ăn kèm gọi thêm
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          Khách hàng có thể chọn nhiều topping cùng lúc và cộng dồn vào hóa đơn.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTopping}
                        className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Thêm topping
                      </button>
                    </div>

                    {itemForm.customization?.toppings?.length === 0 ? (
                      <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 text-center border border-dashed border-gray-200">
                        Chưa có topping kèm theo.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {itemForm.customization.toppings.map((top, idx) => (
                          <div key={top.id || idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={top.name}
                              onChange={(e) => handleUpdateTopping(idx, 'name', e.target.value)}
                              placeholder="Tên topping (vd: Thêm lát phô mai Cheddar)"
                              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-orange-500"
                            />
                            <div className="relative w-32">
                              <input
                                type="number"
                                value={top.price}
                                onChange={(e) => handleUpdateTopping(idx, 'price', e.target.value)}
                                placeholder="+Giá (VND)"
                                className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-orange-500 text-right pr-6"
                              />
                              <span className="absolute right-2 top-1.5 text-[10px] text-gray-400">đ</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTopping(idx)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title="Xóa topping này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Modal */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                {modalTab === 'basic' ? (
                  <button
                    type="button"
                    onClick={() => setModalTab('customization')}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <span>Sang bước thiết lập kích cỡ & tùy chọn</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalTab('basic')}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700"
                  >
                    ← Quay lại thông tin cơ bản
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowItemModal(false)}
                    className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-orange-600/20"
                  >
                    {editingItem ? 'Lưu thay đổi' : 'Thêm vào thực đơn'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
