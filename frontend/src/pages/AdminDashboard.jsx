import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, Store, Key, LogOut, Search, Filter,
  Trash2, Edit, CheckCircle2, XCircle, Clock, Plus, ChevronLeft,
  ChevronRight, RefreshCw, AlertCircle, Save, X, Eye, EyeOff, Lock,
  Building, User, CreditCard, Sparkles, FileText, Check, ExternalLink,
  ZoomIn, MapPin, Phone, Mail, FileCheck, Calendar, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';
import UserProfileModal from '../components/UserProfileModal';

const DAY_LABELS = {
  mon: 'Thứ 2',
  tue: 'Thứ 3',
  wed: 'Thứ 4',
  thu: 'Thứ 5',
  fri: 'Thứ 6',
  sat: 'Thứ 7',
  sun: 'Chủ nhật',
};

const REVIEW_STEPS = [
  { id: 1, title: 'Thông tin cơ bản', shortTitle: '1. Cơ bản', desc: 'Tên & Địa chỉ quán' },
  { id: 2, title: 'Người đại diện & Pháp lý', shortTitle: '2. Đại diện & Pháp lý', desc: 'CCCD & Giấy phép KD' },
  { id: 3, title: 'Thông tin ngân hàng', shortTitle: '3. Ngân hàng', desc: 'Tài khoản nhận tiền' },
  { id: 4, title: 'Chi tiết quán & Giờ mở', shortTitle: '4. Chi tiết quán', desc: 'Lịch 7 ngày & Ảnh quán' },
  { id: 5, title: 'Gói tăng trưởng', shortTitle: '5. Gói tăng trưởng', desc: 'Ưu đãi & Tiếp thị' },
  { id: 6, title: 'Tổng quan & Xét duyệt', shortTitle: '6. Tổng quan & Duyệt', desc: 'Kiểm tra & Quyết định' },
];

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

  // Modal Chi Tiết / Duyệt Quán (Xem toàn bộ 6 mục như lúc đăng ký)
  const [selectedStore, setSelectedStore] = useState(null);
  const [adminReviewStep, setAdminReviewStep] = useState(1);
  const [previewImage, setPreviewImage] = useState(null);
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
  // MODAL QUẢN LÝ THÔNG TIN TÀI KHOẢN (THÔNG TIN LIÊN HỆ & ĐỔI MẬT KHẨU)
  // =========================================================================
  const [showProfileModal, setShowProfileModal] = useState(false);

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
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-orange-500/50 text-right transition cursor-pointer group shadow-xs"
              title="Quản lý thông tin tài khoản & Đổi mật khẩu"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-200 group-hover:text-orange-400 transition">
                  {user?.name || 'Quản trị viên'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {user?.email || 'admin@foodfast.vn'}
                </span>
              </div>
            </button>

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
                          onClick={() => {
                            setSelectedStore(st);
                            setAdminReviewStep(1);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-orange-400" /> Xem hồ sơ 6 mục
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
                              onClick={() => {
                                setSelectedStore(st);
                                setAdminReviewStep(1);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                              title="Xem chi tiết hồ sơ 6 mục"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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
      </div>

      {/* Modal Chi Tiết Đơn Đăng Ký Quán (Đầy đủ 6 mục theo quy trình đăng ký) */}
      {selectedStore && !showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-700 text-slate-200 shadow-2xl overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-700/80 bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white">Hồ sơ đăng ký: {selectedStore.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedStore.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : selectedStore.status === 'REJECTED'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {selectedStore.status || 'PENDING'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Xem xét và đối soát từng mục theo quy trình đăng ký ShopeeFood</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStore(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Tabs Navigation (6 Mục) */}
            <div className="border-b border-slate-700/80 bg-slate-900/60 px-3 py-2 overflow-x-auto scrollbar-none flex items-center gap-1.5">
              {REVIEW_STEPS.map((step) => {
                const isActive = adminReviewStep === step.id;
                return (
                  <button
                    key={step.id}
                    onClick={() => setAdminReviewStep(step.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      isActive
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border-transparent'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {step.id}
                    </span>
                    <span>{step.shortTitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Body (Cuộn độc lập) */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
              
              {/* ========================================================= */}
              {/* MỤC 1: THÔNG TIN CƠ BẢN & VỊ TRÍ OSRM */}
              {/* ========================================================= */}
              {adminReviewStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-orange-400" /> 1. Thông tin quán cơ bản & Vị trí OSRM
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Xác minh định danh quán ăn và địa chỉ giao nhận</p>
                    </div>
                    <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                      Mục 1 / 6
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2.5">
                      <h5 className="font-bold text-orange-400 border-b border-slate-800 pb-1.5">Định danh quán</h5>
                      <div className="space-y-1.5">
                        <div><span className="text-slate-400">Tên quán hiển thị:</span> <strong className="text-white text-sm">{selectedStore.name}</strong></div>
                        <div><span className="text-slate-400">Tên thương hiệu:</span> <strong className="text-slate-200">{selectedStore.brandName || selectedStore.name}</strong></div>
                        <div><span className="text-slate-400">Món đặc trưng:</span> <strong className="text-slate-200">{selectedStore.specialtyDish || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Khu vực / Tuyến đường:</span> <strong className="text-slate-200">{selectedStore.areaStreet || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Số điện thoại quán:</span> <strong className="text-amber-300 font-mono">{selectedStore.phone || 'Chưa cập nhật'}</strong></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2.5">
                      <h5 className="font-bold text-orange-400 border-b border-slate-800 pb-1.5">Địa chỉ & Tọa độ OSRM</h5>
                      <div className="space-y-1.5">
                        <div><span className="text-slate-400">Địa chỉ đầy đủ:</span> <strong className="text-white">{selectedStore.address}</strong></div>
                        <div><span className="text-slate-400">Tỉnh / Thành phố:</span> <strong className="text-slate-200">{selectedStore.city_name || selectedStore.city || 'TP. Hồ Chí Minh'}</strong></div>
                        <div><span className="text-slate-400">Quận / Huyện:</span> <strong className="text-slate-200">{selectedStore.district || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Phường / Xã:</span> <strong className="text-slate-200">{selectedStore.ward || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Số nhà / Đường chi tiết:</span> <strong className="text-slate-200">{selectedStore.streetAddress || selectedStore.address_detail || 'Chưa cập nhật'}</strong></div>
                        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-slate-400">Tọa độ GPS: </span>
                            <strong className="text-cyan-400 font-mono">{selectedStore.latitude || 10.7769}, {selectedStore.longitude || 106.7009}</strong>
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${selectedStore.latitude || 10.7769},${selectedStore.longitude || 106.7009}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-[10px] font-bold flex items-center gap-1 transition"
                          >
                            <MapPin className="w-3 h-3" /> Xem bản đồ
                          </a>
                        </div>
                        <div><span className="text-slate-400">Thời gian chuẩn bị món:</span> <strong className="text-amber-400">{selectedStore.prep_time || 15} phút</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MỤC 2: NGƯỜI ĐẠI DIỆN & PHÁP LÝ (CCCD, HỘ KD, DOANH NGHIỆP) */}
              {/* ========================================================= */}
              {adminReviewStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-orange-400" /> 2. Người đại diện & Hồ sơ Pháp lý
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Xác thực CCCD và giấy tờ kinh doanh cá nhân / hộ kinh doanh / doanh nghiệp</p>
                    </div>
                    <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                      Mục 2 / 6
                    </span>
                  </div>

                  {/* Thông tin người đại diện */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <h5 className="font-bold text-orange-400">Thông tin người đại diện</h5>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedStore.merchantType === 'ENTERPRISE'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : selectedStore.merchantType === 'HOUSEHOLD'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        Danh nghĩa: {selectedStore.merchantType === 'ENTERPRISE' ? 'Doanh nghiệp' : selectedStore.merchantType === 'HOUSEHOLD' ? 'Hộ kinh doanh' : 'Cá nhân'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div><span className="text-slate-400">Họ và tên:</span> <strong className="text-white block mt-0.5">{selectedStore.representativeName || 'Chưa cập nhật'}</strong></div>
                      <div><span className="text-slate-400">Email:</span> <strong className="text-white block mt-0.5">{selectedStore.repEmail || 'Chưa cập nhật'}</strong></div>
                      <div><span className="text-slate-400">Số điện thoại:</span> <strong className="text-white block mt-0.5 font-mono">{selectedStore.repPhone || selectedStore.phone || 'Chưa cập nhật'}</strong></div>
                      <div><span className="text-slate-400">Số điện thoại phụ:</span> <strong className="text-slate-300 block mt-0.5">{selectedStore.repAltPhone || 'Không có'}</strong></div>
                      <div><span className="text-slate-400">Số CCCD/Hộ chiếu:</span> <strong className="text-amber-300 block mt-0.5 font-mono">{selectedStore.citizenId || 'Chưa cập nhật'}</strong></div>
                      <div><span className="text-slate-400">Ngày cấp:</span> <strong className="text-slate-300 block mt-0.5">{selectedStore.citizenIdDate || 'Chưa điền'}</strong></div>
                      <div className="sm:col-span-2 md:col-span-3"><span className="text-slate-400">Nơi cấp:</span> <strong className="text-slate-300">{selectedStore.citizenIdPlace || 'Chưa điền'}</strong></div>
                    </div>
                  </div>

                  {/* Ảnh CCCD Mặt trước & Mặt sau */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-3">
                    <h5 className="font-bold text-slate-200">Ảnh chụp CMND / Căn cước công dân (Bấm để phóng to kiểm tra)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-slate-400 font-medium">Mặt trước CCCD</span>
                          {selectedStore.citizenIdFront && <span className="text-[10px] text-emerald-400 font-bold">✓ Đã tải lên</span>}
                        </div>
                        {selectedStore.citizenIdFront ? (
                          <div
                            onClick={() => setPreviewImage({ url: selectedStore.citizenIdFront, title: 'CCCD Mặt trước - ' + selectedStore.representativeName })}
                            className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group cursor-pointer shadow-md"
                          >
                            <img src={selectedStore.citizenIdFront} alt="CCCD trước" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                              <ZoomIn className="w-4 h-4" /> Bấm xem ảnh gốc
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-700 bg-slate-950/40 flex items-center justify-center text-slate-500 text-xs">
                            Chưa tải lên mặt trước
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-slate-400 font-medium">Mặt sau CCCD</span>
                          {selectedStore.citizenIdBack && <span className="text-[10px] text-emerald-400 font-bold">✓ Đã tải lên</span>}
                        </div>
                        {selectedStore.citizenIdBack ? (
                          <div
                            onClick={() => setPreviewImage({ url: selectedStore.citizenIdBack, title: 'CCCD Mặt sau - ' + selectedStore.representativeName })}
                            className="relative aspect-[16/10] rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group cursor-pointer shadow-md"
                          >
                            <img src={selectedStore.citizenIdBack} alt="CCCD sau" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                              <ZoomIn className="w-4 h-4" /> Bấm xem ảnh gốc
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[16/10] rounded-xl border border-dashed border-slate-700 bg-slate-950/40 flex items-center justify-center text-slate-500 text-xs">
                            Chưa tải lên mặt sau
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Giấy tờ Hộ kinh doanh cá thể */}
                  {selectedStore.merchantType === 'HOUSEHOLD' && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                        <h5 className="font-bold text-amber-300">• Hồ sơ Hộ kinh doanh cá thể</h5>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">HOUSEHOLD</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div><span className="text-slate-400">Tên Hộ kinh doanh:</span> <strong className="text-amber-200">{selectedStore.householdName || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Mã số thuế / Mã ĐKKD:</span> <strong className="text-amber-200 font-mono">{selectedStore.householdTaxCode || 'Chưa cập nhật'}</strong></div>
                      </div>
                      <div>
                        <p className="text-[11px] text-amber-300 font-bold mb-1.5">• Giấy đăng ký Hộ kinh doanh cá thể (bản gốc):</p>
                        {selectedStore.householdBusinessLicense ? (
                          <div
                            onClick={() => setPreviewImage({ url: selectedStore.householdBusinessLicense, title: 'Giấy ĐKKD Hộ kinh doanh: ' + (selectedStore.householdName || selectedStore.name) })}
                            className="relative max-w-sm aspect-[16/10] rounded-xl overflow-hidden border border-amber-500/40 bg-slate-950 group cursor-pointer shadow-md"
                          >
                            <img src={selectedStore.householdBusinessLicense} alt="Giấy phép HKD" className="w-full h-full object-cover group-hover:scale-105 transition" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                              <ZoomIn className="w-4 h-4" /> Bấm phóng to xem bản gốc
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg border border-dashed border-amber-500/40 text-amber-400/80 text-center">
                            Chưa tải lên Giấy đăng ký Hộ kinh doanh cá thể
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Giấy tờ Doanh nghiệp / Công ty */}
                  {selectedStore.merchantType === 'ENTERPRISE' && (
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-3">
                      <div className="flex items-center justify-between border-b border-blue-500/20 pb-1.5">
                        <h5 className="font-bold text-blue-300">• Hồ sơ Doanh nghiệp / Công ty</h5>
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">ENTERPRISE</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div><span className="text-slate-400">Tên Doanh nghiệp:</span> <strong className="text-blue-200">{selectedStore.companyName || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Mã số thuế DN:</span> <strong className="text-blue-200 font-mono">{selectedStore.companyTaxCode || 'Chưa cập nhật'}</strong></div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-400">Vai trò người ký:</span>{' '}
                          <strong className="text-blue-300">
                            {selectedStore.isLegalRepresentative ? 'Người đại diện theo pháp luật' : 'Người được ủy quyền theo văn bản'}
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div>
                          <p className="text-[11px] text-blue-300 font-bold mb-1.5">• Giấy phép ĐKKD công ty (hoặc chi nhánh):</p>
                          {selectedStore.companyBusinessLicense ? (
                            <div
                              onClick={() => setPreviewImage({ url: selectedStore.companyBusinessLicense, title: 'Giấy phép ĐKKD Công ty: ' + (selectedStore.companyName || selectedStore.name) })}
                              className="relative aspect-[16/10] rounded-xl overflow-hidden border border-blue-500/40 bg-slate-950 group cursor-pointer shadow-md"
                            >
                              <img src={selectedStore.companyBusinessLicense} alt="ĐKKD Công ty" className="w-full h-full object-cover group-hover:scale-105 transition" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                                <ZoomIn className="w-4 h-4" /> Bấm phóng to
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-lg border border-dashed border-blue-500/40 text-blue-400/80 text-center">
                              Chưa tải lên Giấy phép ĐKKD công ty
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[11px] text-purple-300 font-bold mb-1.5">• Giấy ủy quyền (nếu người ký không phải ĐDPL):</p>
                          {selectedStore.powerOfAttorney ? (
                            <div
                              onClick={() => setPreviewImage({ url: selectedStore.powerOfAttorney, title: 'Giấy ủy quyền: ' + (selectedStore.companyName || selectedStore.name) })}
                              className="relative aspect-[16/10] rounded-xl overflow-hidden border border-purple-500/40 bg-slate-950 group cursor-pointer shadow-md"
                            >
                              <img src={selectedStore.powerOfAttorney} alt="Giấy ủy quyền" className="w-full h-full object-cover group-hover:scale-105 transition" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                                <ZoomIn className="w-4 h-4" /> Bấm phóng to
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-lg border border-dashed border-slate-700 text-slate-500 text-center">
                              {selectedStore.isLegalRepresentative ? 'Không áp dụng (Là đại diện theo pháp luật)' : 'Chưa tải lên Giấy ủy quyền'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* MỤC 3: THÔNG TIN NGÂN HÀNG & ĐỐI SOÁT */}
              {/* ========================================================= */}
              {adminReviewStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-orange-400" /> 3. Thông tin ngân hàng nhận doanh thu
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Đối soát tài khoản thụ hưởng và đối chiếu tên người đại diện</p>
                    </div>
                    <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                      Mục 3 / 6
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-3">
                      <h5 className="font-bold text-orange-400 border-b border-slate-800 pb-1.5">Tài khoản thụ hưởng</h5>
                      <div className="space-y-2">
                        <div><span className="text-slate-400">Ngân hàng:</span> <strong className="text-white text-sm block">{selectedStore.bankName || 'Vietcombank'}</strong></div>
                        <div><span className="text-slate-400">Số tài khoản:</span> <strong className="text-amber-300 font-mono text-base block">{selectedStore.bankAccountNumber || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Chủ tài khoản:</span> <strong className="text-white block uppercase tracking-wider">{selectedStore.bankAccountHolder || 'Chưa cập nhật'}</strong></div>
                        <div><span className="text-slate-400">Chi nhánh:</span> <strong className="text-slate-300 block">{selectedStore.bankBranch || 'Mặc định / Hội sở'}</strong></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-3">
                      <h5 className="font-bold text-orange-400 border-b border-slate-800 pb-1.5">Đối chiếu thông tin thụ hưởng</h5>
                      {(() => {
                        const rep = (selectedStore.representativeName || '').trim().toLowerCase();
                        const holder = (selectedStore.bankAccountHolder || '').trim().toLowerCase();
                        const isMatch = rep && holder && (rep === holder || holder.includes(rep) || rep.includes(holder));
                        return (
                          <div className="space-y-3">
                            <div className={`p-3 rounded-xl border ${
                              isMatch
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            }`}>
                              <div className="flex items-center gap-2 font-bold mb-1">
                                {isMatch ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                                <span>{isMatch ? 'Tên chủ tài khoản TRÙNG KHỚP' : 'Tên chủ tài khoản CÓ KHÁC BIỆT'}</span>
                              </div>
                              <p className="text-[11px] leading-relaxed">
                                {isMatch
                                  ? 'Tên chủ tài khoản khớp với tên người đại diện pháp lý đã khai báo. Thích hợp duyệt tự động chi trả.'
                                  : 'Tên người đại diện (' + (selectedStore.representativeName || 'N/A') + ') khác với tên chủ tài khoản (' + (selectedStore.bankAccountHolder || 'N/A') + '). Quản trị viên cần kiểm tra xem có giấy ủy quyền tài khoản ngân hàng hay không.'}
                              </p>
                            </div>

                            <div className="p-2.5 rounded-lg bg-slate-800/80 text-[11px] text-slate-400 space-y-1">
                              <div>• Đại diện: <strong className="text-slate-200">{selectedStore.representativeName}</strong></div>
                              <div>• Chủ TK: <strong className="text-slate-200">{selectedStore.bankAccountHolder}</strong></div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MỤC 4: CHI TIẾT QUÁN & GIỜ MỞ (7 NGÀY, AVATAR, COVER, MENU) */}
              {/* ========================================================= */}
              {adminReviewStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-orange-400" /> 4. Chi tiết quán, Hình ảnh & Lịch hoạt động 7 ngày
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Kiểm tra khung giờ mở cửa, ảnh nhận diện quán và hình ảnh thực đơn</p>
                    </div>
                    <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                      Mục 4 / 6
                    </span>
                  </div>

                  {/* Lịch hoạt động 7 ngày */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-3">
                    <h5 className="font-bold text-orange-400 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> Lịch mở cửa trong tuần (Thứ 2 đến Chủ nhật)
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => {
                        const dayInfo = selectedStore.operatingHours?.[d] || { isOpen: true, openTime: '08:00', closeTime: '22:00' };
                        return (
                          <div key={d} className={`p-2.5 rounded-xl border text-center ${
                            dayInfo.isOpen
                              ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                              : 'bg-slate-950/40 border-slate-800 text-slate-500'
                          }`}>
                            <div className="font-bold text-xs text-white mb-1">{DAY_LABELS[d]}</div>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mb-1 ${
                              dayInfo.isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {dayInfo.isOpen ? 'Mở cửa' : 'Đóng cửa'}
                            </span>
                            <div className="text-[10px] font-mono text-slate-300">
                              {dayInfo.isOpen ? `${dayInfo.openTime || '08:00'} - ${dayInfo.closeTime || '22:00'}` : '--:--'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hình ảnh nhận diện quán */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-3">
                    <h5 className="font-bold text-orange-400 border-b border-slate-800 pb-1.5">Hình ảnh nhận diện quán</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-slate-400 font-medium">Ảnh đại diện quán (Avatar / Logo - 550x550px)</span>
                          {selectedStore.image && <span className="text-[10px] text-emerald-400 font-bold">✓ Đã tải lên</span>}
                        </div>
                        {selectedStore.image ? (
                          <div
                            onClick={() => setPreviewImage({ url: selectedStore.image, title: 'Ảnh đại diện quán: ' + selectedStore.name })}
                            className="relative aspect-square max-w-[200px] mx-auto rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group cursor-pointer shadow-md"
                          >
                            <img src={selectedStore.image} alt="Avatar" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                              <ZoomIn className="w-4 h-4" /> Phóng to
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-square max-w-[200px] mx-auto rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                            Chưa tải lên Avatar
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-slate-400 font-medium">Ảnh bìa quán (Cover photo - 960x550px)</span>
                          {selectedStore.coverImage && <span className="text-[10px] text-emerald-400 font-bold">✓ Đã tải lên</span>}
                        </div>
                        {selectedStore.coverImage ? (
                          <div
                            onClick={() => setPreviewImage({ url: selectedStore.coverImage, title: 'Ảnh bìa quán: ' + selectedStore.name })}
                            className="relative aspect-[16/9] rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group cursor-pointer shadow-md"
                          >
                            <img src={selectedStore.coverImage} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                              <ZoomIn className="w-4 h-4" /> Phóng to
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[16/9] rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                            Chưa tải lên Ảnh bìa
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thông tin dịch vụ & Thực đơn */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2.5">
                    <h5 className="font-bold text-orange-400 border-b border-slate-800 pb-1.5">Vận hành & Dịch vụ</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><span className="text-slate-400">Phí gửi xe:</span> <strong className="text-white block mt-0.5">{selectedStore.parkingFee || 'Miễn phí'}</strong></div>
                      <div><span className="text-slate-400">Chuẩn bị món:</span> <strong className="text-white block mt-0.5">{selectedStore.prep_time || 15} phút</strong></div>
                      <div><span className="text-slate-400">Loại hình dịch vụ:</span> <strong className="text-slate-300 block mt-0.5">{selectedStore.serviceTypes?.join(', ') || 'Quán ăn'}</strong></div>
                      <div><span className="text-slate-400">Ẩm thực:</span> <strong className="text-slate-300 block mt-0.5">{selectedStore.cuisineTypes?.join(', ') || 'Món Việt'}</strong></div>
                      <div className="col-span-2 sm:col-span-4"><span className="text-slate-400">Món đặc trưng:</span> <strong className="text-slate-200">{selectedStore.featuredDishes?.join(', ') || 'Chưa cập nhật'}</strong></div>
                    </div>

                    {selectedStore.menuImages?.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <p className="text-[11px] text-slate-400 font-bold mb-2">Ảnh thực đơn đính kèm ({selectedStore.menuImages.length} ảnh):</p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {selectedStore.menuImages.map((mImg, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage({ url: mImg, title: `Thực đơn ${idx + 1} - ${selectedStore.name}` })}
                              className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-950 group cursor-pointer"
                            >
                              <img src={mImg} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <ZoomIn className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MỤC 5: GÓI TĂNG TRƯỞNG DOANH THU */}
              {/* ========================================================= */}
              {adminReviewStep === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-orange-400" /> 5. Gói tăng trưởng doanh thu đã chọn
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Quyền lợi khuyến mãi tiếp thị và trạng thái thanh toán gói</p>
                    </div>
                    <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                      Mục 5 / 6
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Gói FREE */}
                    <div className={`p-4 rounded-xl border transition-all ${
                      (selectedStore.growthPackage || 'FREE') === 'FREE'
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-md shadow-orange-500/10'
                        : 'bg-slate-900/60 border-slate-800 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-200">Gói Khởi Đầu</span>
                        {(selectedStore.growthPackage || 'FREE') === 'FREE' && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">Đã chọn</span>
                        )}
                      </div>
                      <div className="text-xl font-black text-white mb-1">0 VND</div>
                      <p className="text-[11px] text-slate-400 mb-3">Miễn phí kích hoạt tài khoản mở quán</p>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        <li className="flex items-center gap-1.5">✓ Đăng menu không giới hạn</li>
                        <li className="flex items-center gap-1.5">✓ Phí dịch vụ chiết khấu tiêu chuẩn</li>
                        <li className="flex items-center gap-1.5">✓ Quản lý đơn hàng tự động</li>
                      </ul>
                    </div>

                    {/* Gói GROWTH_1 */}
                    <div className={`p-4 rounded-xl border transition-all ${
                      selectedStore.growthPackage === 'GROWTH_1'
                        ? 'bg-orange-500/10 border-orange-500/50 shadow-md shadow-orange-500/10'
                        : 'bg-slate-900/60 border-slate-800 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-orange-400">Gói Tăng Trưởng</span>
                        {selectedStore.growthPackage === 'GROWTH_1' && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">Đã chọn</span>
                        )}
                      </div>
                      <div className="text-xl font-black text-orange-400 mb-1">1.000.000 VND</div>
                      <p className="text-[11px] text-slate-400 mb-3">50 mã khuyến mãi trị giá đến 1.800.000đ</p>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        <li className="flex items-center gap-1.5">✓ Top đề xuất 7 ngày liên tục</li>
                        <li className="flex items-center gap-1.5">✓ 50 mã giảm giá cho khách mới</li>
                        <li className="flex items-center gap-1.5">✓ Tối ưu thực đơn chuẩn SEO</li>
                      </ul>
                    </div>

                    {/* Gói GROWTH_3 */}
                    <div className={`p-4 rounded-xl border transition-all ${
                      selectedStore.growthPackage === 'GROWTH_3'
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900/60 border-slate-800 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-amber-400">Gói Siêu Tăng Trưởng</span>
                        {selectedStore.growthPackage === 'GROWTH_3' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">Đã chọn</span>
                        )}
                      </div>
                      <div className="text-xl font-black text-amber-400 mb-1">2.000.000 VND</div>
                      <p className="text-[11px] text-slate-400 mb-3">120 mã khuyến mãi trị giá đến 4.100.000đ</p>
                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        <li className="flex items-center gap-1.5">✓ Top đề xuất 14 ngày nổi bật</li>
                        <li className="flex items-center gap-1.5">✓ Chụp ảnh món ăn chuyên nghiệp</li>
                        <li className="flex items-center gap-1.5">✓ Hỗ trợ Marketing riêng biệt</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400">Trạng thái thanh toán phí dịch vụ gói:</span>
                      <div className="font-bold text-white text-sm mt-0.5">
                        {selectedStore.growthPackage === 'FREE'
                          ? 'Miễn phí kích hoạt ban đầu (FREE)'
                          : selectedStore.paymentStatus === 'PAID'
                          ? 'Đã hoàn tất thanh toán'
                          : 'Chưa thanh toán (Thu phí sau kích hoạt)'}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      selectedStore.growthPackage === 'FREE'
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : selectedStore.paymentStatus === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {selectedStore.paymentStatus || (selectedStore.growthPackage === 'FREE' ? 'FREE' : 'UNPAID')}
                    </span>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MỤC 6: TỔNG QUAN & DUYỆT HỒ SƠ */}
              {/* ========================================================= */}
              {adminReviewStep === 6 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 6. Bảng tổng quan đối soát & Quyết định duyệt
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Kiểm tra lại toàn bộ 5 bước trước khi phê duyệt hoặc từ chối quán</p>
                    </div>
                    <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                      Mục 6 / 6
                    </span>
                  </div>

                  {/* Bảng checklist 5 mục */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-3">
                    <h5 className="font-bold text-white border-b border-slate-800 pb-2">Checklist hồ sơ mở quán</h5>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-slate-200">1. Thông tin quán & Định vị: </span>
                          <span className="text-slate-300">{selectedStore.name} — {selectedStore.address} (GPS: {selectedStore.latitude || 10.7769}, {selectedStore.longitude || 106.7009})</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-slate-200">2. Đại diện & Pháp lý: </span>
                          <span className="text-slate-300">
                            {selectedStore.representativeName} (CCCD: {selectedStore.citizenId || 'N/A'}) — Danh nghĩa:{' '}
                            <strong className="text-orange-400">{selectedStore.merchantType === 'ENTERPRISE' ? 'Doanh nghiệp' : selectedStore.merchantType === 'HOUSEHOLD' ? 'Hộ kinh doanh' : 'Cá nhân'}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-slate-200">3. Ngân hàng thụ hưởng: </span>
                          <span className="text-slate-300">{selectedStore.bankName} - STK: {selectedStore.bankAccountNumber} ({selectedStore.bankAccountHolder})</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-slate-200">4. Vận hành & Giờ mở cửa: </span>
                          <span className="text-slate-300">Đã thiết lập khung giờ 7 ngày, ảnh đại diện & ảnh bìa quán</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-slate-200">5. Gói tăng trưởng: </span>
                          <span className="text-slate-300">Gói {selectedStore.growthPackage || 'FREE'} ({selectedStore.growthPackage === 'GROWTH_3' ? '2.000.000đ' : selectedStore.growthPackage === 'GROWTH_1' ? '1.000.000đ' : '0đ'})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trạng thái hiện tại & Quyết định */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-slate-400 text-xs">Trạng thái phê duyệt quán hiện tại:</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          selectedStore.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : selectedStore.status === 'REJECTED'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {selectedStore.status === 'ACTIVE' ? 'ĐÃ DUYỆT (ACTIVE)' : selectedStore.status === 'REJECTED' ? 'BỊ TỪ CHỐI (REJECTED)' : 'CHỜ DUYỆT (PENDING)'}
                        </span>
                        {selectedStore.rejectReason && (
                          <span className="text-xs text-red-400">Lý do từ chối: {selectedStore.rejectReason}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setShowRejectModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold border border-red-500/30 transition shadow-sm"
                      >
                        Từ chối hồ sơ
                      </button>
                      <button
                        onClick={() => handleApproveStore(selectedStore._id)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Duyệt mở quán ngay
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Điều hướng 6 bước & Quyết định) */}
            <div className="p-4 border-t border-slate-700 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  type="button"
                  disabled={adminReviewStep <= 1}
                  onClick={() => setAdminReviewStep((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Mục trước
                </button>
                <span className="text-xs text-slate-400 font-medium px-2">
                  Mục {adminReviewStep} / 6
                </span>
                <button
                  type="button"
                  disabled={adminReviewStep >= 6}
                  onClick={() => setAdminReviewStep((p) => Math.min(6, p + 1))}
                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 shadow-sm"
                >
                  Mục tiếp theo <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setSelectedStore(null)}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-300 transition"
                >
                  Đóng
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/30 transition"
                >
                  Từ chối
                </button>
                <button
                  onClick={() => handleApproveStore(selectedStore._id)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Duyệt quán
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Phóng to Xem Chi Tiết Ảnh Giấy Tờ */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] w-full flex flex-col bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700 text-xs">
              <span className="font-bold text-slate-200 truncate pr-4">{previewImage.title || 'Xem ảnh hồ sơ quán'}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {previewImage.url && (
                  <a
                    href={previewImage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium flex items-center gap-1 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Mở trong tab mới
                  </a>
                )}
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[82vh] bg-slate-950/70">
              <img
                src={previewImage.url}
                alt={previewImage.title || 'Chi tiết ảnh'}
                className="max-h-[76vh] max-w-full object-contain rounded-lg border border-slate-800 shadow-xl"
              />
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

      {/* Modal Quản lý thông tin tài khoản & Đổi mật khẩu Admin */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        isDark={true}
      />
    </div>
  );
}

