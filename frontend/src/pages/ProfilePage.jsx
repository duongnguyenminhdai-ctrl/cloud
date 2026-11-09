import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Key,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Camera,
  ArrowLeft,
  ChevronRight,
  LogOut,
  Package,
  Ticket,
  Compass,
  Sparkles,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocationCity } from '../context/LocationContext';
import { useUserLocation } from '../hooks/useUserLocation';
import { authApi, storeApi } from '../api/client';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, updateUserProfile, logout } = useAuth();
  const { selectedCity } = useLocationCity();
  const { location: userCoord } = useUserLocation();

  const tabFromQuery = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(tabFromQuery); // 'profile' | 'password' | 'address'

  // Form Thông tin cá nhân
  const [profileForm, setProfileForm] = useState({
    name: '',
    birthYear: '',
    phone: '',
    address: '',
    email: '',
    gender: 'other', // 'male' | 'female' | 'other'
    avatar: ''
  });

  // Form Đổi mật khẩu
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });
  const [linkedStoreInfo, setLinkedStoreInfo] = useState(null);

  // Tự động chuyển hướng nếu chưa đăng nhập
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/profile');
    }
  }, [isAuthenticated, navigate]);

  // Cập nhật URL query khi đổi tab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
    setFeedback({ type: '', msg: '' });
  };

  // Nạp dữ liệu hồ sơ mới nhất từ API backend
  useEffect(() => {
    if (isAuthenticated) {
      setProfileForm({
        name: user?.name || '',
        birthYear: user?.birthYear || '',
        phone: user?.phone || '',
        address: user?.address || userCoord?.address || '',
        email: user?.email || '',
        gender: user?.gender || 'other',
        avatar: user?.avatar || ''
      });

      const fetchProfile = async () => {
        setLoadingProfile(true);
        try {
          const res = await authApi.getProfile();
          let storePhone = '';
          let storeName = '';

          // Lấy thêm thông tin quán đối tác nếu có để tìm SĐT đã liên kết
          try {
            const storeRes = await storeApi.getMyStore();
            if (storeRes.data?.success && storeRes.data?.data) {
              const st = storeRes.data.data;
              storePhone = st.phone || st.repPhone || '';
              storeName = st.name || '';
              if (storePhone) {
                setLinkedStoreInfo({ name: storeName, phone: storePhone });
              }
            }
          } catch {}

          if (res.data?.success && res.data?.data) {
            const d = res.data.data;
            const finalPhone = d.phone || storePhone || '';
            setProfileForm((prev) => ({
              ...prev,
              name: d.name || prev.name,
              birthYear: d.birthYear || prev.birthYear,
              phone: finalPhone || prev.phone,
              address: d.address || prev.address,
              email: d.email || prev.email,
              gender: d.gender || prev.gender,
              avatar: d.avatar || prev.avatar
            }));
            updateUserProfile({ ...d, phone: finalPhone });
          }
        } catch (err) {
          console.warn('Lấy thông tin profile từ server:', err.message);
        } finally {
          setLoadingProfile(false);
        }
      };

      fetchProfile();
    }
  }, [user, isAuthenticated]);

  const showMsg = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => {
      setFeedback({ type: '', msg: '' });
    }, 4000);
  };

  // Lưu thông tin cá nhân
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback({ type: '', msg: '' });

    if (!profileForm.name.trim()) {
      showMsg('error', 'Họ và tên không được để trống.');
      setSavingProfile(false);
      return;
    }

    try {
      const payload = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        birthYear: profileForm.birthYear ? Number(profileForm.birthYear) : null,
        address: profileForm.address.trim(),
        gender: profileForm.gender,
        avatar: profileForm.avatar
      };

      const res = await authApi.updateProfile(payload);
      if (res.data?.success) {
        showMsg('success', res.data?.message || 'Cập nhật thông tin cá nhân thành công!');
        updateUserProfile(res.data?.data || payload);
      } else {
        showMsg('error', res.data?.message || 'Không thể cập nhật thông tin.');
      }
    } catch (err) {
      showMsg('error', err.response?.data?.message || err.message || 'Lỗi lưu thông tin cá nhân');
    } finally {
      setSavingProfile(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setFeedback({ type: '', msg: '' });

    if (!passwordForm.oldPassword) {
      showMsg('error', 'Vui lòng nhập mật khẩu hiện tại.');
      setSavingPassword(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showMsg('error', 'Mật khẩu mới phải có tối thiểu 6 ký tự.');
      setSavingPassword(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMsg('error', 'Xác nhận mật khẩu mới không trùng khớp.');
      setSavingPassword(false);
      return;
    }

    try {
      const res = await authApi.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });

      if (res.data?.success) {
        showMsg('success', res.data?.message || 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showMsg('error', res.data?.message || 'Không thể đổi mật khẩu.');
      }
    } catch (err) {
      showMsg('error', err.response?.data?.message || err.message || 'Lỗi đổi mật khẩu');
    } finally {
      setSavingPassword(false);
    }
  };

  // Đánh giá độ mạnh mật khẩu mới
  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    if (pwd.length < 6) return { label: 'Quá ngắn', color: 'bg-red-500', width: 'w-1/4' };
    const hasNum = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    if (pwd.length >= 8 && hasNum && hasSpecial) {
      return { label: 'Mạnh', color: 'bg-emerald-500', width: 'w-full' };
    }
    if (pwd.length >= 6 && (hasNum || hasSpecial)) {
      return { label: 'Trung bình', color: 'bg-amber-500', width: 'w-2/3' };
    }
    return { label: 'Yếu', color: 'bg-orange-500', width: 'w-1/3' };
  };

  const pwdStrength = getPasswordStrength(passwordForm.newPassword);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb điều hướng */}
      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
        <Link to="/" className="hover:text-orange-600 transition-colors">
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-bold">Tài khoản của tôi</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-orange-600 font-bold">
          {activeTab === 'profile'
            ? 'Hồ sơ cá nhân'
            : activeTab === 'password'
            ? 'Đổi mật khẩu'
            : 'Địa chỉ nhận hàng'}
        </span>
      </div>

      {/* Thông báo Feedback (Thành công / Lỗi) */}
      {feedback.msg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-semibold shadow-sm animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', msg: '' })}
            className="text-gray-400 hover:text-gray-700 text-xs cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Khung bố cục chính: Sidebar Trái & Nội dung Phải */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =================================================================== */}
        {/* CỘT TRÁI: SIDEBAR THÔNG TIN TÀI KHOẢN & ĐIỀU HƯỚNG */}
        {/* =================================================================== */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card Thẻ User Profile */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-2xl flex items-center justify-center shadow-md shadow-orange-500/20">
                  {profileForm.name ? profileForm.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center border-2 border-white shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-gray-900 text-base truncate">
                  {profileForm.name || 'Người dùng FoodFast'}
                </h3>
                <p className="text-xs text-gray-500 truncate">{profileForm.email || 'user@foodfast.vn'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      user?.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-orange-100 text-orange-700 border border-orange-200'
                    }`}
                  >
                    {user?.role === 'ADMIN' ? 'Quản trị viên Hệ thống' : 'Thành viên FoodFast'}
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách Menu điều hướng */}
            <div className="border-t border-gray-100 pt-3 space-y-1">
              <button
                onClick={() => handleTabChange('profile')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-orange-50 text-orange-600 border border-orange-200/80 shadow-xs'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-orange-500" />
                  <span>Hồ sơ của tôi</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => handleTabChange('password')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'password'
                    ? 'bg-orange-50 text-orange-600 border border-orange-200/80 shadow-xs'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-orange-500" />
                  <span>Đổi mật khẩu & Bảo mật</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => handleTabChange('address')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'address'
                    ? 'bg-orange-50 text-orange-600 border border-orange-200/80 shadow-xs'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <span>Địa chỉ nhận hàng</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <Link
                to="/orders"
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span>Đơn mua của tôi</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>

              <Link
                to="/orders?tab=vouchers"
                className="w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Ticket className="w-4 h-4 text-emerald-500" />
                  <span>Kho Voucher & Khuyến mãi</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
            </div>

            {/* Nút Đăng xuất an toàn */}
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200/60 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất tài khoản</span>
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* CỘT PHẢI: NỘI DUNG TỪNG TAB (HỒ SƠ / MẬT KHẨU / ĐỊA CHỈ) */}
        {/* =================================================================== */}
        <div className="lg:col-span-8">
          {/* TAB 1: HỒ SƠ CỦA TÔI */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">Hồ Sơ Của Tôi</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Quản lý thông tin hồ sơ để bảo mật tài khoản và nhận đồ ăn nhanh chóng.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Email định danh tài khoản */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                  <label className="text-xs sm:text-sm font-bold text-gray-700 sm:text-right">
                    Email đăng ký:
                  </label>
                  <div className="sm:col-span-3">
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 text-xs sm:text-sm">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-medium truncate">{profileForm.email || 'Chưa cập nhật'}</span>
                      <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Đã xác thực
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 pl-1">
                      Email định danh tài khoản chính thức không thể thay đổi.
                    </p>
                  </div>
                </div>

                {/* Họ và tên */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                  <label className="text-xs sm:text-sm font-bold text-gray-700 sm:text-right">
                    Họ và tên (*):
                  </label>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        placeholder="Nhập họ và tên đầy đủ"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-gray-900 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Số điện thoại */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                  <label className="text-xs sm:text-sm font-bold text-gray-700 sm:text-right">
                    Số điện thoại:
                  </label>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder={linkedStoreInfo?.phone || "VD: 0987654321"}
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-gray-900 transition-all font-medium"
                      />
                    </div>
                    {linkedStoreInfo?.phone && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
                        <Phone className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span>
                          SĐT liên kết từ quán <strong>{linkedStoreInfo.name}</strong>: <span className="font-mono text-gray-800 font-bold">{linkedStoreInfo.phone}</span>
                        </span>
                        {profileForm.phone !== linkedStoreInfo.phone && (
                          <button
                            type="button"
                            onClick={() => setProfileForm((p) => ({ ...p, phone: linkedStoreInfo.phone }))}
                            className="text-[10px] text-orange-600 hover:underline font-bold ml-1 cursor-pointer"
                          >
                            Dùng số này
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Năm sinh */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                  <label className="text-xs sm:text-sm font-bold text-gray-700 sm:text-right">
                    Năm sinh:
                  </label>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="number"
                        min="1940"
                        max={new Date().getFullYear() - 10}
                        value={profileForm.birthYear}
                        onChange={(e) => setProfileForm({ ...profileForm, birthYear: e.target.value })}
                        placeholder="VD: 2000"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-gray-900 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Giới tính */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                  <label className="text-xs sm:text-sm font-bold text-gray-700 sm:text-right">
                    Giới tính:
                  </label>
                  <div className="sm:col-span-3 flex items-center gap-6 text-xs sm:text-sm">
                    {[
                      { id: 'male', label: 'Nam' },
                      { id: 'female', label: 'Nữ' },
                      { id: 'other', label: 'Khác' }
                    ].map((g) => (
                      <label key={g.id} className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                        <input
                          type="radio"
                          name="gender"
                          value={g.id}
                          checked={profileForm.gender === g.id}
                          onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                          className="w-4 h-4 text-orange-600 focus:ring-0 cursor-pointer"
                        />
                        <span>{g.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Địa chỉ giao hàng mặc định */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-start">
                  <label className="text-xs sm:text-sm font-bold text-gray-700 sm:text-right pt-2.5">
                    Địa chỉ liên hệ:
                  </label>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <textarea
                        rows={2}
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        placeholder="VD: Số 2 Đường Đỗ Xuân Hợp, Phường Phú Hữu, TP. Thủ Đức, TP. Hồ Chí Minh"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-gray-900 transition-all font-medium resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Nút submit lưu hồ sơ */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 pt-3">
                  <div className="hidden sm:block" />
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-8 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingProfile ? 'Đang lưu thông tin...' : 'Lưu Thay Đổi'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: ĐỔI MẬT KHẨU & BẢO MẬT */}
          {activeTab === 'password' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">Đổi Mật Khẩu</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Để bảo mật tài khoản, vui lòng không chia sẻ mật khẩu của bạn cho người khác.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5 max-w-lg">
                {/* Mật khẩu hiện tại */}
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-gray-700">Mật khẩu hiện tại (*):</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="w-full pl-10 pr-11 py-2.5 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-gray-900 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-gray-700">Mật khẩu mới (*):</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full pl-10 pr-11 py-2.5 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-gray-900 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Thanh đo độ mạnh mật khẩu */}
                  {pwdStrength && (
                    <div className="space-y-1 pt-1">
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${pwdStrength.color} ${pwdStrength.width} transition-all duration-300`} />
                      </div>
                      <p className="text-[11px] font-semibold text-gray-500">
                        Độ mạnh: <span className="font-bold">{pwdStrength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-gray-700">Xác nhận mật khẩu mới (*):</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full pl-10 pr-11 py-2.5 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-gray-900 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{savingPassword ? 'Đang cập nhật mật khẩu...' : 'Xác Nhận Đổi Mật Khẩu'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: ĐỊA CHỈ NHẬN HÀNG */}
          {activeTab === 'address' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">Địa Chỉ Nhận Hàng</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Địa chỉ này sẽ được ưu tiên điền tự động khi bạn đặt đồ ăn tại FoodFast.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-orange-50/70 border border-orange-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-orange-600" />
                    <span className="font-extrabold text-gray-900 text-sm">Địa chỉ giao hàng mặc định:</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">
                    Mặc định
                  </span>
                </div>

                <p className="text-sm font-semibold text-gray-800 pl-7">
                  {profileForm.address || userCoord?.address || 'Chưa thiết lập địa chỉ mặc định'}
                </p>

                <div className="pl-7 pt-2 flex items-center gap-3">
                  <button
                    onClick={() => handleTabChange('profile')}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-orange-100 text-orange-600 border border-orange-200 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Chỉnh sửa địa chỉ
                  </button>
                  <Link
                    to="/"
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    Bắt đầu đặt món
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

