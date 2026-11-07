import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, Store, Key, LogOut, Search, Filter,
  Trash2, Edit, CheckCircle2, XCircle, Clock, Plus, ChevronLeft,
  ChevronRight, RefreshCw, AlertCircle, Save, X, Eye, EyeOff, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';

export default function AdminDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // Active Admin Tabs: 'approvals' | 'stores' | 'users' | 'security'
  const [activeTab, setActiveTab] = useState('approvals');

  // Kiểm tra quyền Admin
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }
    if (user?.role !== 'ADMIN') {
      alert('Bạn không có quyền truy cập trang Quản trị viên!');
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  // Alert Notification
  const [notification, setNotification] = useState({ type: '', msg: '' });
  const showNotif = (type, msg) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification({ type: '', msg: '' }), 4000);
  };

  // =========================================================================
  // TAB 1 & 2: QUẢN LÝ QUÁN & PHÊ DUYỆT (STORES & APPROVALS)
  // =========================================================================
  const [stores, setStores] = useState([]);
  const [storeTotal, setStoreTotal] = useState(0);
  const [storePage, setStorePage] = useState(1);
  const [storeLimit] = useState(8);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState('ALL');
  const [storeSortBy, setStoreSortBy] = useState('createdAt');
  const [storeSortOrder, setStoreSortOrder] = useState('desc');
  const [storesLoading, setStoresLoading] = useState(false);

  // Modal Chi Tiết / Duyệt Quán
  const [selectedStore, setSelectedStore] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Modal Thêm / Sửa Quán (Admin CRUD)
  const [showStoreEditModal, setShowStoreEditModal] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [storeFormData, setStoreFormData] = useState({
    name: '',
    address: '',
    phone: '',
    rating: 5.0,
    image: '',
    status: 'ACTIVE',
  });

  const fetchStores = async () => {
    setStoresLoading(true);
    try {
      const params = {
        page: storePage,
        limit: storeLimit,
        search: storeSearch || undefined,
        status: activeTab === 'approvals' ? 'PENDING' : (storeStatusFilter !== 'ALL' ? storeStatusFilter : undefined),
        sortBy: storeSortBy,
        sortOrder: storeSortOrder,
      };
      const res = await adminApi.getRestaurants(params);
      if (res.data?.success) {
        setStores(res.data.data);
        setStoreTotal(res.data.pagination.total);
      }
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi tải danh sách quán');
    } finally {
      setStoresLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'approvals' || activeTab === 'stores') {
      fetchStores();
    }
  }, [activeTab, storePage, storeStatusFilter, storeSortBy, storeSortOrder]);

  const handleSearchStores = (e) => {
    e.preventDefault();
    setStorePage(1);
    fetchStores();
  };

  const handleApproveStore = async (id) => {
    try {
      const res = await adminApi.approveRestaurant(id);
      showNotif('success', res.data?.message || 'Đã phê duyệt quán thành công!');
      setSelectedStore(null);
      fetchStores();
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi duyệt quán');
    }
  };

  const handleRejectStore = async () => {
    if (!selectedStore) return;
    try {
      const res = await adminApi.rejectRestaurant(selectedStore._id, rejectReason);
      showNotif('success', res.data?.message || 'Đã từ chối đơn đăng ký quán');
      setShowRejectModal(false);
      setSelectedStore(null);
      setRejectReason('');
      fetchStores();
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi từ chối quán');
    }
  };

  const handleDeleteStore = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn quán [${name}] khỏi hệ thống?`)) return;
    try {
      await adminApi.deleteRestaurant(id);
      showNotif('success', `Đã xóa quán [${name}] thành công!`);
      fetchStores();
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi xóa quán');
    }
  };

  const handleOpenCreateStore = () => {
    setEditingStoreId(null);
    setStoreFormData({
      name: '',
      address: '',
      phone: '',
      rating: 5.0,
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
      status: 'ACTIVE',
    });
    setShowStoreEditModal(true);
  };

  const handleOpenEditStore = (st) => {
    setEditingStoreId(st._id);
    setStoreFormData({
      name: st.name,
      address: st.address,
      phone: st.phone || '',
      rating: st.rating || 5.0,
      image: st.image || '',
      status: st.status || 'ACTIVE',
    });
    setShowStoreEditModal(true);
  };

  const handleSaveStore = async (e) => {
    e.preventDefault();
    try {
      if (editingStoreId) {
        await adminApi.updateRestaurant(editingStoreId, storeFormData);
        showNotif('success', 'Cập nhật thông tin quán thành công!');
      } else {
        await adminApi.createRestaurant(storeFormData);
        showNotif('success', 'Thêm quán mới thành công!');
      }
      setShowStoreEditModal(false);
      fetchStores();
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi lưu thông tin quán');
    }
  };

  // =========================================================================
  // TAB 3: QUẢN LÝ DANH SÁCH TÀI KHOẢN (USERS MANAGEMENT)
  // =========================================================================
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userLimit] = useState(10);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userSortBy, setUserSortBy] = useState('createdAt');
  const [userSortOrder, setUserSortOrder] = useState('desc');
  const [usersLoading, setUsersLoading] = useState(false);

  // Modal Thêm / Sửa User
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    phone: '',
    isActive: true,
  });

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const params = {
        page: userPage,
        limit: userLimit,
        search: userSearch || undefined,
        role: userRoleFilter !== 'ALL' ? userRoleFilter : undefined,
        sortBy: userSortBy,
        sortOrder: userSortOrder,
      };
      const res = await adminApi.getUsers(params);
      if (res.data?.success) {
        setUsers(res.data.data);
        setUserTotal(res.data.pagination.total);
      }
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi tải danh sách tài khoản');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, userPage, userRoleFilter, userSortBy, userSortOrder]);

  const handleSearchUsers = (e) => {
    e.preventDefault();
    setUserPage(1);
    fetchUsers();
  };

  const handleToggleUserActive = async (u) => {
    try {
      await adminApi.updateUser(u._id, { isActive: !u.isActive });
      showNotif('success', `Đã ${!u.isActive ? 'mở khóa' : 'khóa'} tài khoản [${u.email}] thành công!`);
      fetchUsers();
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi đổi trạng thái tài khoản');
    }
  };

  const handleDeleteUser = async (id, email) => {
    if (id === user?.id) {
      alert('Bạn không thể tự xóa tài khoản Admin đang đăng nhập!');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản [${email}]? Dữ liệu không thể phục hồi.`)) return;
    try {
      await adminApi.deleteUser(id);
      showNotif('success', `Đã xóa tài khoản [${email}] thành công!`);
      fetchUsers();
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi xóa tài khoản');
    }
  };

  const handleOpenCreateUser = () => {
    setEditingUserId(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      phone: '',
      isActive: true,
    });
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u) => {
    setEditingUserId(u._id);
    setUserForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role || 'USER',
      phone: u.phone || '',
      isActive: u.isActive !== false,
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await adminApi.updateUser(editingUserId, {
          name: userForm.name,
          role: userForm.role,
          phone: userForm.phone,
          isActive: userForm.isActive,
        });
        showNotif('success', 'Cập nhật tài khoản thành công!');
      } else {
        await adminApi.createUser(userForm);
        showNotif('success', 'Tạo tài khoản mới thành công!');
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi lưu tài khoản');
    }
  };

  // =========================================================================
  // TAB 4: ĐỔI MẬT KHẨU TÀI KHOẢN QUẢN TRỊ (SECURITY)
  // =========================================================================
  const [securityForm, setSecurityForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [securityLoading, setSecurityLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      showNotif('error', 'Mật khẩu xác nhận không khớp');
      return;
    }
    if (securityForm.newPassword.length < 6) {
      showNotif('error', 'Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }

    setSecurityLoading(true);
    try {
      const res = await adminApi.changePassword({
        oldPassword: securityForm.oldPassword,
        newPassword: securityForm.newPassword,
      });
      showNotif('success', res.data?.message || 'Đổi mật khẩu Admin thành công!');
      setSecurityForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showNotif('error', err.response?.data?.message || err.message || 'Lỗi đổi mật khẩu');
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      {/* Top Navbar Admin */}
      <header className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 font-black">
              FF
            </div>
            <div>
              <span className="text-base font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                FoodFast Admin Portal
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                QUẢN TRỊ VIÊN
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-200">{user?.name}</span>
              <span className="text-[11px] text-slate-400">{user?.email}</span>
            </div>

            <button
              onClick={() => {
                logout();
                navigate('/admin/login');
              }}
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-red-500/20 hover:text-red-400 text-slate-300 transition-colors"
              title="Đăng xuất quản trị"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {/* Toast Notification */}
        {notification.msg && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center gap-2.5 text-sm ${
              notification.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/80 border-red-500/40 text-red-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            )}
            <span>{notification.msg}</span>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-800 border border-slate-700 overflow-x-auto mb-6">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'approvals'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Duyệt hồ sơ quán ({stores.filter((s) => s.status === 'PENDING').length || '...'})
          </button>

          <button
            onClick={() => setActiveTab('stores')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'stores'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Store className="w-4 h-4" />
            Danh sách các quán
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Quản lý tài khoản
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Key className="w-4 h-4" />
            Đổi mật khẩu Admin
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: DUYỆT HỒ SƠ QUÁN (PENDING APPROVALS) */}
        {/* ================================================================= */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Hồ sơ quán chờ xét duyệt</h2>
                <p className="text-xs text-slate-400 mt-0.5">Kiểm tra thông tin giấy tờ, CCCD và phê duyệt quán mới mở</p>
              </div>
              <button
                onClick={fetchStores}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${storesLoading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>

            {storesLoading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-orange-500 mb-2" />
                <p className="text-sm">Đang tải danh sách chờ duyệt...</p>
              </div>
            ) : stores.filter((s) => s.status === 'PENDING').length === 0 ? (
              <div className="py-16 text-center rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-2" />
                <h3 className="text-base font-bold text-white">Không có hồ sơ nào đang chờ duyệt</h3>
                <p className="text-xs text-slate-400 mt-1">Tất cả các quán đăng ký mới đã được xử lý hoàn tất!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stores
                  .filter((s) => s.status === 'PENDING')
                  .map((st) => (
                    <div
                      key={st._id}
                      className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-orange-500/50 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={st.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=150&q=80'}
                              alt={st.name}
                              className="w-14 h-14 rounded-xl object-cover border border-slate-700"
                            />
                            <div>
                              <h3 className="font-bold text-white text-base leading-snug">{st.name}</h3>
                              <p className="text-xs text-slate-400 line-clamp-1">{st.address}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                                CHỜ DUYỆT
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-700/40 text-xs">
                          <div>
                            <span className="text-slate-500">Đại diện:</span>{' '}
                            <strong className="text-slate-300">{st.representativeName || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">SĐT:</span>{' '}
                            <strong className="text-slate-300">{st.phone || st.repPhone || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Ngân hàng:</span>{' '}
                            <strong className="text-slate-300">{st.bankName || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Gói:</span>{' '}
                            <strong className="text-orange-400">{st.growthPackage || 'FREE'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedStore(st)}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors"
                        >
                          Xem hồ sơ
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStore(st);
                            setShowRejectModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/30 transition-colors"
                        >
                          Từ chối
                        </button>
                        <button
                          onClick={() => handleApproveStore(st._id)}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
                        >
                          Phê duyệt ngay
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: QUẢN LÝ TẤT CẢ CÁC QUÁN (STORE CRUD, FILTER, SORT, PAGINATION) */}
        {/* ================================================================= */}
        {activeTab === 'stores' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Quản lý danh sách các quán</h2>
                <p className="text-xs text-slate-400 mt-0.5">Tổng số {storeTotal} quán trong hệ thống</p>
              </div>
              <button
                onClick={handleOpenCreateStore}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" /> Thêm quán mới
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col sm:flex-row items-center gap-3">
              <form onSubmit={handleSearchStores} className="flex-1 w-full flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Tìm theo tên quán, địa chỉ, số điện thoại..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200"
                >
                  Tìm kiếm
                </button>
              </form>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={storeStatusFilter}
                  onChange={(e) => {
                    setStoreStatusFilter(e.target.value);
                    setStorePage(1);
                  }}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                  <option value="PENDING">Chờ duyệt (PENDING)</option>
                  <option value="REJECTED">Bị từ chối (REJECTED)</option>
                </select>

                <select
                  value={`${storeSortBy}:${storeSortOrder}`}
                  onChange={(e) => {
                    const [f, o] = e.target.value.split(':');
                    setStoreSortBy(f);
                    setStoreSortOrder(o);
                  }}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="createdAt:desc">Mới nhất</option>
                  <option value="createdAt:asc">Cũ nhất</option>
                  <option value="name:asc">Tên A-Z</option>
                  <option value="rating:desc">Đánh giá cao nhất</option>
                </select>
              </div>
            </div>

            {/* Stores Table */}
            <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Quán ăn</th>
                      <th className="py-3 px-4">Địa chỉ & Liên hệ</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4">Đánh giá</th>
                      <th className="py-3 px-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {stores.map((st) => (
                      <tr key={st._id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={st.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=100&q=80'}
                              alt={st.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                            />
                            <div>
                              <div className="font-bold text-white">{st.name}</div>
                              <div className="text-[11px] text-slate-400">
                                {st.menuItems?.length || 0} món trong thực đơn
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-300 line-clamp-1">{st.address}</div>
                          <div className="text-[11px] text-slate-400">{st.phone || 'Chưa cập nhật SĐT'}</div>
                        </td>
                        <td className="py-3 px-4">
                          {st.status === 'ACTIVE' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 text-[10px]">
                              ACTIVE
                            </span>
                          )}
                          {st.status === 'PENDING' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 text-[10px]">
                              PENDING
                            </span>
                          )}
                          {st.status === 'REJECTED' && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30 text-[10px]">
                              REJECTED
                            </span>
                          )}
                          {!st.status && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 font-bold text-[10px]">
                              ACTIVE (Mặc định)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-amber-400 font-bold">★ {st.rating || 5.0}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditStore(st)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-slate-700"
                              title="Sửa thông tin quán"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStore(st._id, st.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700"
                              title="Xóa quán"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Trang {storePage} / {Math.ceil(storeTotal / storeLimit) || 1} (Tổng {storeTotal} quán)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={storePage <= 1}
                    onClick={() => setStorePage((p) => p - 1)}
                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={storePage >= Math.ceil(storeTotal / storeLimit)}
                    onClick={() => setStorePage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: QUẢN LÝ DANH SÁCH TÀI KHOẢN (USER MANAGEMENT) */}
        {/* ================================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Quản lý danh sách tài khoản</h2>
                <p className="text-xs text-slate-400 mt-0.5">Tổng số {userTotal} tài khoản người dùng và quản trị</p>
              </div>
              <button
                onClick={handleOpenCreateUser}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" /> Thêm tài khoản mới
              </button>
            </div>

            {/* User Search & Filter */}
            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col sm:flex-row items-center gap-3">
              <form onSubmit={handleSearchUsers} className="flex-1 w-full flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm theo tên, email, số điện thoại..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200"
                >
                  Tìm kiếm
                </button>
              </form>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="ALL">Tất cả vai trò</option>
                  <option value="USER">USER (Người dùng / Chủ quán)</option>
                  <option value="ADMIN">ADMIN (Quản trị viên)</option>
                </select>

                <select
                  value={`${userSortBy}:${userSortOrder}`}
                  onChange={(e) => {
                    const [f, o] = e.target.value.split(':');
                    setUserSortBy(f);
                    setUserSortOrder(o);
                  }}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="createdAt:desc">Mới tạo nhất</option>
                  <option value="createdAt:asc">Cũ nhất</option>
                  <option value="name:asc">Tên A-Z</option>
                  <option value="email:asc">Email A-Z</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Người dùng</th>
                      <th className="py-3 px-4">Vai trò (Role)</th>
                      <th className="py-3 px-4">Cửa hàng</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {users.map((u) => (
                      <tr key={u._id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                          {u.phone && <div className="text-[10px] text-slate-500">SĐT: {u.phone}</div>}
                        </td>
                        <td className="py-3 px-4">
                          {u.role === 'ADMIN' ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30 text-[10px]">
                              ADMIN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30 text-[10px]">
                              USER
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.has_store ? (
                            <span className="text-emerald-400 font-bold">✓ Đã có quán</span>
                          ) : (
                            <span className="text-slate-500">Chưa tạo quán</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                              u.isActive !== false
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                            }`}
                          >
                            {u.isActive !== false ? '● Đang hoạt động' : '○ Bị khóa'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-slate-700"
                              title="Sửa tài khoản"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              disabled={u._id === user?.id}
                              onClick={() => handleDeleteUser(u._id, u.email)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 disabled:opacity-20"
                              title="Xóa tài khoản"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* User Pagination */}
              <div className="p-4 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Trang {userPage} / {Math.ceil(userTotal / userLimit) || 1} (Tổng {userTotal} tài khoản)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((p) => p - 1)}
                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={userPage >= Math.ceil(userTotal / userLimit)}
                    onClick={() => setUserPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ĐỔI MẬT KHẨU TÀI KHOẢN QUẢN TRỊ */}
        {/* ================================================================= */}
        {activeTab === 'security' && (
          <div className="max-w-md mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Đổi mật khẩu tài khoản quản trị</h2>
              <p className="text-xs text-slate-400 mt-0.5">Bảo vệ an toàn quyền truy cập quản trị hệ thống</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mật khẩu hiện tại *</label>
                  <input
                    type="password"
                    value={securityForm.oldPassword}
                    onChange={(e) => setSecurityForm({ ...securityForm, oldPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mật khẩu mới *</label>
                  <input
                    type="password"
                    value={securityForm.newPassword}
                    onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Xác nhận mật khẩu mới *</label>
                  <input
                    type="password"
                    value={securityForm.confirmPassword}
                    onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={securityLoading}
                  className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-md shadow-orange-600/20 transition-all disabled:opacity-50"
                >
                  {securityLoading ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal Chi Tiết Đơn Đăng Ký Quán */}
      {selectedStore && !showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-700 text-slate-200 shadow-2xl relative">
            <button
              onClick={() => setSelectedStore(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Chi tiết hồ sơ đăng ký quán</h3>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60">
                <h4 className="font-bold text-orange-400 mb-2">1. Thông tin quán</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Tên quán: <strong className="text-white">{selectedStore.name}</strong></div>
                  <div>Số điện thoại: <strong className="text-white">{selectedStore.phone}</strong></div>
                  <div className="col-span-2">Địa chỉ: <strong className="text-white">{selectedStore.address}</strong></div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60">
                <h4 className="font-bold text-orange-400 mb-2">2. Người đại diện & Pháp lý</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Họ tên: <strong className="text-white">{selectedStore.representativeName}</strong></div>
                  <div>Email: <strong className="text-white">{selectedStore.repEmail}</strong></div>
                  <div>CCCD: <strong className="text-white">{selectedStore.citizenId}</strong></div>
                  <div>Nơi cấp: <strong className="text-white">{selectedStore.citizenIdPlace}</strong></div>
                </div>

                {selectedStore.citizenIdFront && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Mặt trước CCCD</p>
                      <img src={selectedStore.citizenIdFront} alt="CCCD" className="w-full h-24 object-cover rounded-lg border border-slate-700" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1">Mặt sau CCCD</p>
                      <img src={selectedStore.citizenIdBack} alt="CCCD" className="w-full h-24 object-cover rounded-lg border border-slate-700" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60">
                <h4 className="font-bold text-orange-400 mb-2">3. Ngân hàng & Gói dịch vụ</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Ngân hàng: <strong className="text-white">{selectedStore.bankName}</strong></div>
                  <div>Số tài khoản: <strong className="text-white">{selectedStore.bankAccountNumber}</strong></div>
                  <div>Chủ tài khoản: <strong className="text-white">{selectedStore.bankAccountHolder}</strong></div>
                  <div>Gói: <strong className="text-emerald-400">{selectedStore.growthPackage}</strong></div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedStore(null)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/30"
              >
                Từ chối hồ sơ
              </button>
              <button
                onClick={() => handleApproveStore(selectedStore._id)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Duyệt mở quán ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Từ Chối Hồ Sơ (Nhập lý do) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-700 text-slate-200 shadow-2xl">
            <h3 className="text-base font-bold text-red-400 mb-2">Lý do từ chối hồ sơ quán</h3>
            <p className="text-xs text-slate-400 mb-4">
              Người bán sẽ nhìn thấy lý do này trên ứng dụng để chỉnh sửa và gửi lại.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="vd: Ảnh chụp CCCD bị mờ, địa chỉ kinh doanh chưa rõ số nhà..."
              rows={3}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectStore}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm / Sửa Quán (Admin CRUD) */}
      {showStoreEditModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-700 text-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowStoreEditModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">
              {editingStoreId ? 'Chỉnh sửa thông tin quán' : 'Thêm quán mới'}
            </h3>

            <form onSubmit={handleSaveStore} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tên quán ăn *</label>
                <input
                  type="text"
                  value={storeFormData.name}
                  onChange={(e) => setStoreFormData({ ...storeFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Địa chỉ quán *</label>
                <input
                  type="text"
                  value={storeFormData.address}
                  onChange={(e) => setStoreFormData({ ...storeFormData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={storeFormData.phone}
                    onChange={(e) => setStoreFormData({ ...storeFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Đánh giá (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={storeFormData.rating}
                    onChange={(e) => setStoreFormData({ ...storeFormData, rating: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Ảnh đại diện quán (URL)</label>
                <input
                  type="text"
                  value={storeFormData.image}
                  onChange={(e) => setStoreFormData({ ...storeFormData, image: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Trạng thái</label>
                <select
                  value={storeFormData.status}
                  onChange={(e) => setStoreFormData({ ...storeFormData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                  <option value="PENDING">Chờ duyệt (PENDING)</option>
                  <option value="REJECTED">Bị từ chối (REJECTED)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStoreEditModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm / Sửa Tài Khoản (User CRUD) */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-700 text-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowUserModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">
              {editingUserId ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  disabled={!!editingUserId}
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                  required
                />
              </div>

              {!editingUserId && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Mật khẩu *</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Vai trò (Role)</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="USER">USER (Người dùng / Chủ quán)</option>
                    <option value="ADMIN">ADMIN (Quản trị viên)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userForm.isActive}
                  onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                  className="rounded text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="userActiveCheck" className="font-bold text-slate-300 cursor-pointer">
                  Kích hoạt tài khoản (Cho phép đăng nhập)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
