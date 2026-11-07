import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, UtensilsCrossed, Plus, Edit, Trash2, CheckCircle2,
  Clock, MapPin, Phone, RefreshCw, AlertCircle, Save, X
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
  const [itemForm, setItemForm] = useState({
    name: '',
    price: '',
    description: '',
    image: '',
    isAvailable: true,
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
    setItemForm({
      name: '',
      price: '',
      description: '',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
    });
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      price: item.price,
      description: item.description || '',
      image: item.image || '',
      isAvailable: item.isAvailable !== false,
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.price) {
      alert('Vui lòng nhập tên món và giá món');
      return;
    }

    try {
      if (editingItem) {
        await storeApi.updateMenuItem(editingItem._id, itemForm);
        setSuccessMsg('Cập nhật món ăn thành công!');
      } else {
        await storeApi.addMenuItem(itemForm);
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
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/30 shadow-lg"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black">{store?.name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-bold">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-orange-100 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {store?.address}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {store?.phone}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/restaurants/${store?._id}`)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5"
            >
              <Store className="w-4 h-4" /> Xem trang khách hàng
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6">
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Quản lý thực đơn món ăn</h2>
            <p className="text-xs text-gray-500">Danh sách các món ăn hiển thị cho khách hàng đặt món</p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-600/20 inline-flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Thêm món mới
          </button>
        </div>

        {/* Menu Items Grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
          {!store?.menuItems || store.menuItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold">Chưa có món ăn nào trong thực đơn</p>
              <p className="text-xs mt-1">Bấm nút "Thêm món mới" ở trên để bổ sung món đầu tiên.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.menuItems.map((item) => (
                <div
                  key={item._id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    item.isAvailable !== false
                      ? 'border-gray-200 hover:border-orange-300 bg-white'
                      : 'border-gray-100 bg-gray-50/70 opacity-60'
                  }`}
                >
                  <div className="flex gap-3">
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}
                      alt={item.name}
                      className="w-20 h-20 rounded-xl object-cover border flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{item.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.description || 'Chưa có mô tả'}</p>
                      <div className="text-sm font-black text-orange-600 mt-1">
                        {Number(item.price).toLocaleString('vi-VN')} đ
                      </div>
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
                        title="Sửa món"
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Thêm / Sửa Món */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowItemModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món ăn mới'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tên món ăn *</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="vd: Cơm tấm sườn nướng"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Giá bán (VND) *</label>
                <input
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                  placeholder="vd: 45000"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả món</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="vd: Kèm canh chua và đồ chua thơm ngon..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Link hình ảnh món</label>
                <input
                  type="text"
                  value={itemForm.image}
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isAvailable"
                  checked={itemForm.isAvailable}
                  onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                  className="rounded text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="isAvailable" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Món ăn đang sẵn sàng phục vụ
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-md shadow-orange-600/20"
                >
                  {editingItem ? 'Lưu thay đổi' : 'Thêm vào thực đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

