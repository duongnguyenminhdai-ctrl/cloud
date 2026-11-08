import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Clock,
  MapPin,
  UtensilsCrossed,
  DollarSign,
  Layers,
  ChevronRight,
  TrendingUp,
  Settings2,
  Sparkles,
  Check,
  X,
  FileText
} from 'lucide-react';
import { storeApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function MerchantDashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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
      optionGroups: [],
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
        optionGroups: [],
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

    // Chuẩn hóa danh sách nhóm lựa chọn (Option Groups)
    let groups = [];
    if (Array.isArray(cust.optionGroups) && cust.optionGroups.length > 0) {
      groups = cust.optionGroups.map((g, gIdx) => {
        let choices = [];
        if (Array.isArray(g.choices) && g.choices.length > 0) {
          choices = g.choices.map((c, cIdx) => ({
            id: c.id || `c_${gIdx}_${cIdx}`,
            name: c.name || '',
            price: Number(c.price || 0),
            isDefault: Boolean(c.isDefault)
          }));
        } else if (Array.isArray(g.options) && g.options.length > 0) {
          choices = g.options.map((opt, cIdx) => ({
            id: `c_${gIdx}_${cIdx}`,
            name: opt,
            price: 0,
            isDefault: opt === g.defaultOption || (!g.multiple && cIdx === 0)
          }));
        }
        return {
          id: g.id || `opt_${gIdx}`,
          name: g.name || '',
          layout: g.layout === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL',
          required: Boolean(g.required),
          multiple: Boolean(g.multiple),
          choices
        };
      });
    }

    // Tương thích ngược: Nếu item có sizes > 1 mà chưa có nhóm size trong optionGroups
    if (Array.isArray(cust.sizes) && cust.sizes.length > 1 && !groups.some((g) => g.name.toLowerCase().includes('size') || g.name.toLowerCase().includes('kích cỡ'))) {
      groups.unshift({
        id: 'opt_sizes_legacy',
        name: 'Kích cỡ (Size)',
        layout: 'VERTICAL',
        required: true,
        multiple: false,
        choices: cust.sizes.map((s, idx) => ({
          id: s.id || `sz_${idx}`,
          name: s.name,
          price: Number(s.price || 0),
          isDefault: Boolean(s.isDefault || idx === 0)
        }))
      });
    }

    // Tương thích ngược: Nếu item có toppings mà chưa có nhóm topping trong optionGroups
    if (Array.isArray(cust.toppings) && cust.toppings.length > 0 && !groups.some((g) => g.name.toLowerCase().includes('topping'))) {
      groups.push({
        id: 'opt_toppings_legacy',
        name: 'Topping gọi thêm',
        layout: 'VERTICAL',
        required: false,
        multiple: true,
        choices: cust.toppings.map((t, idx) => ({
          id: t.id || `top_${idx}`,
          name: t.name,
          price: Number(t.price || 0),
          isDefault: false
        }))
      });
    }

    setItemForm({
      name: item.name,
      price: item.price,
      description: item.description || '',
      image: item.image || '',
      isAvailable: item.isAvailable !== false,
      customization: {
        hasCustomization: groups.length > 0,
        optionGroups: groups,
        allowNotes: cust.allowNotes !== false,
        notePlaceholder: cust.notePlaceholder || 'Ví dụ: không hành, ít cay, để riêng nước chấm...'
      }
    });
    setShowItemModal(true);
  };

  // =========================================================================
  // XỬ LÝ NHÓM LỰA CHỌN DO CHỦ QUÁN TỰ ĐẶT TÊN, TỰ CHỌN ĐỊNH DẠNG & SỐ LƯỢNG
  // =========================================================================

  // Thêm một nhóm lựa chọn mới (Trường chính, layout dọc/ngang, các lựa chọn)
  const handleAddOptionGroup = () => {
    const currentGroups = itemForm.customization?.optionGroups || [];
    const newGroup = {
      id: `opt_${Date.now()}`,
      name: 'Kích cỡ (Size)',
      layout: 'VERTICAL', // 'VERTICAL' (dọc lớn) | 'HORIZONTAL' (ngang nhỏ)
      required: true,
      multiple: false,
      choices: [
        { id: `c_${Date.now()}_1`, name: 'Size Vừa (M)', price: 0, isDefault: true },
        { id: `c_${Date.now()}_2`, name: 'Size Lớn (L)', price: 10000, isDefault: false }
      ]
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

  const handleUpdateOptionGroup = (groupIndex, field, value) => {
    const currentGroups = [...(itemForm.customization?.optionGroups || [])];
    currentGroups[groupIndex] = {
      ...currentGroups[groupIndex],
      [field]: value
    };
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        optionGroups: currentGroups
      }
    });
  };

  const handleRemoveOptionGroup = (groupIndex) => {
    const currentGroups = (itemForm.customization?.optionGroups || []).filter((_, i) => i !== groupIndex);
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        hasCustomization: currentGroups.length > 0,
        optionGroups: currentGroups
      }
    });
  };

  // Thêm 1 lựa chọn con vào nhóm
  const handleAddChoice = (groupIndex) => {
    const currentGroups = [...(itemForm.customization?.optionGroups || [])];
    const group = currentGroups[groupIndex];
    const choices = [...(group.choices || [])];

    choices.push({
      id: `c_${Date.now()}_${choices.length}`,
      name: '',
      price: 0,
      isDefault: choices.length === 0
    });

    currentGroups[groupIndex] = { ...group, choices };
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        optionGroups: currentGroups
      }
    });
  };

  // Cập nhật 1 lựa chọn con
  const handleUpdateChoice = (groupIndex, choiceIndex, field, value) => {
    const currentGroups = [...(itemForm.customization?.optionGroups || [])];
    const group = currentGroups[groupIndex];
    const choices = [...(group.choices || [])];

    if (field === 'isDefault' && !group.multiple && value === true) {
      // Đối với nhóm chọn 1: Chỉ cho phép duy nhất 1 lựa chọn mặc định
      choices.forEach((c, i) => {
        c.isDefault = i === choiceIndex;
      });
    } else {
      choices[choiceIndex] = {
        ...choices[choiceIndex],
        [field]: field === 'price' ? Math.max(0, Number(value) || 0) : value
      };
    }

    currentGroups[groupIndex] = { ...group, choices };
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        optionGroups: currentGroups
      }
    });
  };

  // Xóa 1 lựa chọn con
  const handleRemoveChoice = (groupIndex, choiceIndex) => {
    const currentGroups = [...(itemForm.customization?.optionGroups || [])];
    const group = currentGroups[groupIndex];
    const choices = (group.choices || []).filter((_, i) => i !== choiceIndex);

    currentGroups[groupIndex] = { ...group, choices };
    setItemForm({
      ...itemForm,
      customization: {
        ...itemForm.customization,
        optionGroups: currentGroups
      }
    });
  };

  // =========================================================================
  // CÁC MẪU GỢI Ý THIẾT LẬP NHANH (1-CLICK TEMPLATES)
  // =========================================================================
  const handleApplyPreset = (presetType) => {
    if (presetType === 'BEVERAGE') {
      setItemForm({
        ...itemForm,
        customization: {
          hasCustomization: true,
          optionGroups: [
            {
              id: `opt_size_${Date.now()}`,
              name: 'Kích cỡ (Size)',
              layout: 'VERTICAL', // Dạng dọc lớn
              required: true,
              multiple: false,
              choices: [
                { id: 'sz_m', name: 'Size Vừa (M)', price: 0, isDefault: true },
                { id: 'sz_l', name: 'Size Lớn (L)', price: 10000, isDefault: false }
              ]
            },
            {
              id: `opt_sugar_${Date.now()}`,
              name: 'Mức ngọt (Đường)',
              layout: 'HORIZONTAL', // Dạng ngang nhỏ
              required: true,
              multiple: false,
              choices: [
                { id: 'sg_100', name: '100% Đường', price: 0, isDefault: false },
                { id: 'sg_70', name: '70% Đường (Chuẩn)', price: 0, isDefault: true },
                { id: 'sg_50', name: '50% Đường', price: 0, isDefault: false },
                { id: 'sg_30', name: '30% Đường', price: 0, isDefault: false },
                { id: 'sg_0', name: 'Không đường', price: 0, isDefault: false }
              ]
            },
            {
              id: `opt_ice_${Date.now()}`,
              name: 'Mức lạnh (Đá)',
              layout: 'HORIZONTAL', // Dạng ngang nhỏ
              required: true,
              multiple: false,
              choices: [
                { id: 'ice_100', name: '100% Đá', price: 0, isDefault: false },
                { id: 'ice_70', name: '70% Đá (Chuẩn)', price: 0, isDefault: true },
                { id: 'ice_50', name: '50% Đá', price: 0, isDefault: false },
                { id: 'ice_less', name: 'Ít đá', price: 0, isDefault: false },
                { id: 'ice_none', name: 'Không đá', price: 0, isDefault: false }
              ]
            },
            {
              id: `opt_top_${Date.now()}`,
              name: 'Topping gọi thêm',
              layout: 'VERTICAL', // Dạng dọc lớn
              required: false,
              multiple: true,
              choices: [
                { id: 'top_boba', name: 'Trân châu đường đen dẻo', price: 8000, isDefault: false },
                { id: 'top_jelly', name: 'Thạch củ năng giòn', price: 7000, isDefault: false },
                { id: 'top_cheese', name: 'Phô mai tươi', price: 10000, isDefault: false }
              ]
            }
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
          optionGroups: [
            {
              id: `opt_size_${Date.now()}`,
              name: 'Kích cỡ (Size)',
              layout: 'VERTICAL', // Dạng dọc lớn
              required: true,
              multiple: false,
              choices: [
                { id: 'sz_std', name: 'Khẩu phần Tiêu chuẩn', price: 0, isDefault: true },
                { id: 'sz_double', name: 'Double Size (Gấp đôi nhân)', price: 15000, isDefault: false }
              ]
            },
            {
              id: `opt_sauce_${Date.now()}`,
              name: 'Nước sốt đi kèm',
              layout: 'VERTICAL', // Dạng dọc lớn
              required: true,
              multiple: false,
              choices: [
                { id: 'sc_cheese', name: 'Sốt Phô mai đặc biệt (Chuẩn)', price: 0, isDefault: true },
                { id: 'sc_spicy', name: 'Sốt Cay Gochujang Hàn Quốc', price: 0, isDefault: false },
                { id: 'sc_bbq', name: 'Sốt Tiêu đen nướng BBQ', price: 0, isDefault: false },
                { id: 'sc_mayo', name: 'Sốt Mayonnaise tương cà', price: 0, isDefault: false }
              ]
            },
            {
              id: `opt_top_${Date.now()}`,
              name: 'Topping thêm',
              layout: 'VERTICAL', // Dạng dọc lớn
              required: false,
              multiple: true,
              choices: [
                { id: 'top_egg', name: 'Trứng ốp la lòng đào', price: 10000, isDefault: false },
                { id: 'top_cheddar', name: 'Phô mai Cheddar tan chảy', price: 12000, isDefault: false }
              ]
            }
          ],
          allowNotes: true,
          notePlaceholder: 'Ví dụ: không lấy dưa chuột muối, nước sốt để riêng...'
        }
      });
    } else if (presetType === 'SIZE_ONLY') {
      // Thêm nhóm Size chuẩn (2 lựa chọn: Size M và Size L, dạng dọc lớn)
      setItemForm({
        ...itemForm,
        customization: {
          hasCustomization: true,
          optionGroups: [
            {
              id: `opt_size_${Date.now()}`,
              name: 'Kích cỡ (Size)',
              layout: 'VERTICAL', // Dạng dọc lớn
              required: true,
              multiple: false,
              choices: [
                { id: 'sz_m', name: 'Size Vừa (M)', price: 0, isDefault: true },
                { id: 'sz_l', name: 'Size Lớn (L)', price: 10000, isDefault: false }
              ]
            }
          ],
          allowNotes: true,
          notePlaceholder: 'Ghi chú cho quán...'
        }
      });
    } else if (presetType === 'SINGLE_SIZE') {
      // Món chỉ có 1 size chuẩn duy nhất, không có nhóm tùy chọn nào (như lon Coca-Cola)
      setItemForm({
        ...itemForm,
        customization: {
          hasCustomization: false,
          optionGroups: [],
          allowNotes: true,
          notePlaceholder: 'Ghi chú cho quán...'
        }
      });
    }
  };

  // Lưu món ăn
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.price) {
      alert('Vui lòng nhập tên món và giá món');
      return;
    }

    // Chuẩn hóa và làm sạch dữ liệu các nhóm tùy chọn
    const cleanedOptionGroups = (itemForm.customization?.optionGroups || [])
      .filter((og) => og && og.name?.trim())
      .map((og, ogIdx) => {
        const cleanedChoices = (og.choices || [])
          .filter((c) => c && c.name?.trim())
          .map((c, cIdx) => ({
            id: c.id || `c_${ogIdx}_${cIdx}`,
            name: c.name.trim(),
            price: Math.max(0, Number(c.price || 0)),
            isDefault: Boolean(c.isDefault)
          }));

        return {
          id: og.id || `opt_${ogIdx}_${Date.now()}`,
          name: og.name.trim(),
          layout: og.layout === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL',
          required: Boolean(og.required),
          multiple: Boolean(og.multiple),
          choices: cleanedChoices
        };
      })
      .filter((og) => og.choices.length > 0);

    const hasCust = cleanedOptionGroups.length > 0;

    // Tương thích ngược với các trường sizes và toppings cũ
    const legacySizes = cleanedOptionGroups.find((g) =>
      g.name.toLowerCase().includes('size') || g.name.toLowerCase().includes('kích cỡ')
    )?.choices || [];

    const legacyToppings = cleanedOptionGroups.find((g) => g.multiple)?.choices || [];

    const payload = {
      name: itemForm.name.trim(),
      price: Number(itemForm.price),
      description: itemForm.description?.trim() || '',
      image: itemForm.image?.trim() || '',
      isAvailable: itemForm.isAvailable !== false,
      customization: {
        hasCustomization: hasCust,
        optionGroups: cleanedOptionGroups,
        sizes: legacySizes,
        toppings: legacyToppings,
        allowNotes: itemForm.customization?.allowNotes !== false,
        notePlaceholder: itemForm.customization?.notePlaceholder || 'Ghi chú cho quán (không hành, ít cay...)'
      }
    };

    try {
      if (editingItem) {
        await storeApi.updateMenuItem(editingItem._id, payload);
      } else {
        await storeApi.addMenuItem(payload);
      }
      setShowItemModal(false);
      fetchStoreData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi lưu món ăn');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa món này khỏi thực đơn?')) return;
    try {
      await storeApi.deleteMenuItem(itemId);
      fetchStoreData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi xóa món');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Đã xảy ra lỗi</h2>
          <p className="text-sm text-gray-500 mb-4">{errorMsg}</p>
          <button
            onClick={fetchStoreData}
            className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <Store className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black">{store?.name || 'Cửa hàng của tôi'}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-400 text-emerald-950">
                    Đang hoạt động
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-orange-100 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {store?.address || 'Chưa cập nhật địa chỉ'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {store?.openHours || '07:00 - 22:00'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/restaurant/${store?._id}`)}
                className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md transition flex items-center gap-1.5"
              >
                <span>Xem trang quán</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-4 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Tổng món ăn</p>
              <p className="text-lg font-black text-gray-900">{store?.menuItems?.length || 0}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Đang bán</p>
              <p className="text-lg font-black text-emerald-600">
                {store?.menuItems?.filter((m) => m.isAvailable !== false).length || 0}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Đánh giá sao</p>
              <p className="text-lg font-black text-blue-600">{store?.rating || 5.0} ★</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Doanh thu hôm nay</p>
              <p className="text-lg font-black text-purple-600">Theo dõi realtime</p>
            </div>
          </div>
        </div>

        {/* Menu management section */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                <span>Thực đơn quán ăn (Menu Management)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Chủ quán tự do thiết lập kích cỡ, nước sốt hoặc topping riêng cho từng món ăn.
              </p>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Thêm món mới</span>
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
                const optionGroups = item.customization?.optionGroups || [];
                const hasCustom = optionGroups.length > 0 || (item.customization?.sizes?.length > 1);

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
                        {optionGroups.length > 0 ? (
                          optionGroups.map((g, gIdx) => (
                            <span
                              key={gIdx}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                g.layout === 'HORIZONTAL'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}
                            >
                              {g.layout === 'HORIZONTAL' ? 'Ngang nhỏ: ' : 'Dọc lớn: '}
                              {g.name} ({g.choices?.length || 0})
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            1 size chuẩn (không tùy chọn)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleAvailable(item)}
                        className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors cursor-pointer ${
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
                          className="p-1.5 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition cursor-pointer"
                          title="Chỉnh sửa món & tùy chọn"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item._id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Xóa món ăn"
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

      {/* ========================================================================= */}
      {/* MODAL THÊM / SỬA MÓN ĂN VỚI TÙY CHỌN DỌC LỚN & NGANG NHỎ */}
      {/* ========================================================================= */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div>
                <h3 className="font-extrabold text-base text-gray-900">
                  {editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món ăn mới vào thực đơn'}
                </h3>
                <p className="text-xs text-gray-400">Thiết lập giá bán cơ bản và các nhóm lựa chọn do quán tự quy định</p>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-gray-200 px-5 bg-white text-xs sm:text-sm font-bold">
              <button
                type="button"
                onClick={() => setModalTab('basic')}
                className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
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
                className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  modalTab === 'customization'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                <span>2. Tùy chọn & Kích cỡ (Shop tự quy định)</span>
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
                      placeholder="vd: Burger Bò Phô Mai Kép, Trà Sữa Ô Long, Coca-Cola 500ml..."
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
                      Bạn có thể tạo bất kỳ nhóm tùy chọn nào (Size, Mức đường, Mức đá, Nước sốt, Topping...), 
                      chọn kiểu hiển thị <strong>Dạng dọc lớn</strong> hoặc <strong>Dạng ngang nhỏ</strong>, 
                      và tự do điền số lượng lựa chọn kèm giá cộng thêm. 
                      <strong> Nếu quán chỉ bán 1 kích cỡ chuẩn (như lon nước ngọt), hãy để trống phần này</strong> để khách mua nhanh mà không hiện popup!
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
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-orange-400 bg-gray-50/60 hover:bg-orange-50/50 text-left text-xs transition-all cursor-pointer"
                      >
                        <span className="block font-bold text-gray-900">🍔 Burger / Gà</span>
                        <span className="text-[10px] text-gray-500">Size & Sốt (Dọc lớn)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('BEVERAGE')}
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-orange-400 bg-gray-50/60 hover:bg-orange-50/50 text-left text-xs transition-all cursor-pointer"
                      >
                        <span className="block font-bold text-gray-900">☕ Trà sữa / Nước</span>
                        <span className="text-[10px] text-gray-500">Đường & Đá (Ngang nhỏ)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('SIZE_ONLY')}
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-orange-400 bg-gray-50/60 hover:bg-orange-50/50 text-left text-xs transition-all cursor-pointer"
                      >
                        <span className="block font-bold text-gray-900">📏 Kích cỡ (Size)</span>
                        <span className="text-[10px] text-gray-500">2 lựa chọn (Dọc lớn)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('SINGLE_SIZE')}
                        className="p-2.5 rounded-xl border border-red-200 hover:border-red-400 bg-red-50/40 hover:bg-red-50 text-left text-xs transition-all cursor-pointer"
                      >
                        <span className="block font-bold text-red-700">🥫 Chỉ 1 size chuẩn</span>
                        <span className="text-[10px] text-red-500">Xóa hết (Lon Coca, Canh...)</span>
                      </button>
                    </div>
                  </div>

                  {/* Danh sách các nhóm tùy chọn (Option Groups) do người bán tự cấu hình */}
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                          Danh sách nhóm lựa chọn của món ({itemForm.customization?.optionGroups?.length || 0} nhóm)
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          Chủ quán tự do đặt tên trường chính, chọn định dạng hiển thị và thêm số lượng lựa chọn.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddOptionGroup}
                        className="px-3 py-1.5 rounded-xl bg-orange-600 text-white hover:bg-orange-700 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" /> Thêm nhóm lựa chọn
                      </button>
                    </div>

                    {(!itemForm.customization?.optionGroups || itemForm.customization.optionGroups.length === 0) ? (
                      <div className="p-6 bg-gray-50 rounded-2xl text-xs text-gray-500 text-center border border-dashed border-gray-200 space-y-2">
                        <UtensilsCrossed className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="font-semibold text-gray-700">Chưa có nhóm lựa chọn nào</p>
                        <p className="text-gray-400 max-w-sm mx-auto">
                          Món ăn này sẽ là món 1 size chuẩn theo giá cơ bản ({Number(itemForm.price || 0).toLocaleString('vi-VN')} đ). 
                          Khách hàng bấm thêm vào giỏ ngay mà không bị ép chọn size hay nước sốt.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {itemForm.customization.optionGroups.map((og, gIdx) => (
                          <div
                            key={og.id || gIdx}
                            className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200 hover:border-orange-300 transition-all space-y-3"
                          >
                            {/* Dòng 1: Tên trường chính & Nút xóa nhóm */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center shrink-0">
                                  {gIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={og.name}
                                  onChange={(e) => handleUpdateOptionGroup(gIdx, 'name', e.target.value)}
                                  placeholder="Nhập tên trường chính (vd: Kích cỡ (Size), Mức ngọt (Đường), Nước sốt đi kèm...)"
                                  className="font-bold text-xs sm:text-sm px-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-orange-500 flex-1 shadow-xs"
                                  required
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveOptionGroup(gIdx)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-xl transition cursor-pointer"
                                title="Xóa toàn bộ nhóm này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Dòng 2: Định dạng hiển thị (Dọc lớn vs Ngang nhỏ) - Người bán tự chọn */}
                            <div className="space-y-1.5 bg-white p-3 rounded-xl border border-gray-100">
                              <span className="text-[11px] font-bold text-gray-700 block">
                                Chọn kiểu hiển thị trên màn hình khách hàng:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label
                                  onClick={() => handleUpdateOptionGroup(gIdx, 'layout', 'VERTICAL')}
                                  className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                                    og.layout === 'VERTICAL'
                                      ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                                      : 'border-gray-200 hover:border-gray-300 bg-white'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`layout_${og.id || gIdx}`}
                                    checked={og.layout === 'VERTICAL'}
                                    onChange={() => handleUpdateOptionGroup(gIdx, 'layout', 'VERTICAL')}
                                    className="mt-0.5 text-orange-600"
                                  />
                                  <div className="text-xs">
                                    <span className="font-bold text-gray-900 block">🔘 Dạng dọc lớn (Vertical)</span>
                                    <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                                      Thẻ hàng dọc lớn kèm giá cộng thêm (Chuẩn cho Size, Nước sốt, Khẩu phần, Topping).
                                    </span>
                                  </div>
                                </label>

                                <label
                                  onClick={() => handleUpdateOptionGroup(gIdx, 'layout', 'HORIZONTAL')}
                                  className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                                    og.layout === 'HORIZONTAL'
                                      ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                                      : 'border-gray-200 hover:border-gray-300 bg-white'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`layout_${og.id || gIdx}`}
                                    checked={og.layout === 'HORIZONTAL'}
                                    onChange={() => handleUpdateOptionGroup(gIdx, 'layout', 'HORIZONTAL')}
                                    className="mt-0.5 text-orange-600"
                                  />
                                  <div className="text-xs">
                                    <span className="font-bold text-gray-900 block">🔘 Dạng ngang nhỏ (Horizontal)</span>
                                    <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                                      Các nút bấm nhỏ nằm ngang (Chuẩn cho Mức đường, Mức đá, Mức cay, Nhiệt độ).
                                    </span>
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* Dòng 3: Cấu hình quy tắc chọn (Bắt buộc & Chọn 1 hay Chọn nhiều) */}
                            <div className="flex flex-wrap items-center gap-4 text-xs bg-white p-2.5 rounded-xl border border-gray-100">
                              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={og.required === true}
                                  onChange={(e) => handleUpdateOptionGroup(gIdx, 'required', e.target.checked)}
                                  className="rounded text-orange-600"
                                />
                                <span>Bắt buộc khách phải chọn</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={og.multiple === true}
                                  onChange={(e) => handleUpdateOptionGroup(gIdx, 'multiple', e.target.checked)}
                                  className="rounded text-orange-600"
                                />
                                <span>Cho phép chọn nhiều (vd: Topping gọi thêm)</span>
                              </label>
                            </div>

                            {/* Dòng 4: Danh sách các lựa chọn con (Người bán tự chọn số lượng và tự điền) */}
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-gray-700">
                                  Các lựa chọn trong nhóm ({og.choices?.length || 0} lựa chọn):
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddChoice(gIdx)}
                                  className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" /> Thêm lựa chọn
                                </button>
                              </div>

                              <div className="space-y-2">
                                {(og.choices || []).map((choice, cIdx) => (
                                  <div
                                    key={choice.id || cIdx}
                                    className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200"
                                  >
                                    <span className="text-[11px] font-bold text-gray-400 w-5 text-center">
                                      #{cIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={choice.name}
                                      onChange={(e) => handleUpdateChoice(gIdx, cIdx, 'name', e.target.value)}
                                      placeholder="Tên lựa chọn (vd: Size Vừa (M), 70% Đường, Sốt BBQ...)"
                                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-orange-500 font-medium"
                                      required
                                    />
                                    <div className="relative w-28 sm:w-32">
                                      <input
                                        type="number"
                                        value={choice.price}
                                        onChange={(e) => handleUpdateChoice(gIdx, cIdx, 'price', e.target.value)}
                                        placeholder="+Giá (VND)"
                                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-orange-500 text-right pr-6 font-bold text-gray-800"
                                      />
                                      <span className="absolute right-2 top-1.5 text-[10px] text-gray-400">đ</span>
                                    </div>

                                    {!og.multiple && (
                                      <label
                                        className="flex items-center gap-1 text-[11px] text-gray-600 shrink-0 cursor-pointer px-2 py-1 rounded bg-gray-50 border border-gray-100"
                                        title="Lựa chọn này sẽ được chọn sẵn khi mở món"
                                      >
                                        <input
                                          type="radio"
                                          name={`default_${og.id || gIdx}`}
                                          checked={choice.isDefault === true}
                                          onChange={() => handleUpdateChoice(gIdx, cIdx, 'isDefault', true)}
                                          className="text-orange-600"
                                        />
                                        <span>Mặc định</span>
                                      </label>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveChoice(gIdx, cIdx)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                      title="Xóa lựa chọn này"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mục Ghi chú cho quán */}
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={itemForm.customization?.allowNotes !== false}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            customization: {
                              ...itemForm.customization,
                              allowNotes: e.target.checked
                            }
                          })
                        }
                        className="rounded text-orange-600"
                      />
                      <span>Cho phép khách hàng ghi chú thêm cho quán khi đặt món</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Footer Modal */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                {modalTab === 'basic' ? (
                  <button
                    type="button"
                    onClick={() => setModalTab('customization')}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Sang bước thiết lập kích cỡ & tùy chọn</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalTab('basic')}
                    className="text-xs font-bold text-gray-600 hover:text-gray-800 cursor-pointer"
                  >
                    ← Quay lại thông tin cơ bản
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowItemModal(false)}
                    className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 cursor-pointer"
                  >
                    {editingItem ? 'Lưu thay đổi' : 'Thêm món vào thực đơn'}
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
