import React, { useState, useEffect, useRef } from 'react';
import {
  X, User, Phone, MapPin, Calendar, Mail, Key, Lock,
  ShieldCheck, Eye, EyeOff, Save, CheckCircle2, AlertCircle, Sparkles, Camera, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import UserAvatar from './UserAvatar';
import { compressAvatarFile } from '../utils/imageHelpers';

export default function UserProfileModal({ isOpen, onClose, isDark = false }) {
  const { user, updateUserProfile } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password'

  // Form Thông tin liên hệ
  const [profileForm, setProfileForm] = useState({
    name: '',
    birthYear: '',
    phone: '',
    address: '',
    email: '',
    avatar: '',
  });
  const avatarInputRef = useRef(null);

  // Form Đổi mật khẩu
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Khởi tạo và đồng bộ dữ liệu người dùng khi mở modal
  useEffect(() => {
    if (isOpen) {
      setFeedback({ type: '', msg: '' });
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });

      // Nạp từ user state trước
      setProfileForm({
        name: user?.name || '',
        birthYear: user?.birthYear || '',
        phone: user?.phone || '',
        address: user?.address || '',
        email: user?.email || '',
        avatar: user?.avatar || '',
      });

      // Tải dữ liệu mới nhất từ backend API
      const fetchLatestProfile = async () => {
        try {
          const res = await authApi.getProfile();
          if (res.data?.success && res.data?.data) {
            const d = res.data.data;
            setProfileForm({
              name: d.name || '',
              birthYear: d.birthYear || '',
              phone: d.phone || '',
              address: d.address || '',
              email: d.email || '',
              avatar: d.avatar || '',
            });
            updateUserProfile(d);
          }
        } catch (err) {
          // Fallback giữ nguyên dữ liệu từ AuthContext
        }
      };

      fetchLatestProfile();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const showMsg = (type, msg) => {
    setFeedback({ type, msg });
  };

  // Cập nhật thông tin liên hệ
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback({ type: '', msg: '' });

    try {
      if (!profileForm.name.trim()) {
        showMsg('error', 'Họ và tên không được để trống.');
        setSavingProfile(false);
        return;
      }

      const payload = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        birthYear: profileForm.birthYear ? Number(profileForm.birthYear) : null,
        address: profileForm.address.trim(),
        avatar: profileForm.avatar,
      };

      const res = await authApi.updateProfile(payload);
      if (res.data?.success) {
        showMsg('success', res.data?.message || 'Cập nhật thông tin thành công!');
        updateUserProfile(res.data?.data || payload);
      } else {
        showMsg('error', res.data?.message || 'Không thể cập nhật thông tin.');
      }
    } catch (err) {
      showMsg('error', err.response?.data?.message || err.message || 'Lỗi cập nhật thông tin');
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
        newPassword: passwordForm.newPassword,
      });

      if (res.data?.success) {
        showMsg('success', res.data?.message || 'Đổi mật khẩu thành công!');
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

  const handleModalAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressAvatarFile(file, { maxSize: 400, quality: 0.85 });
      setProfileForm((prev) => ({ ...prev, avatar: compressed }));
      const res = await authApi.updateProfile({ avatar: compressed });
      if (res.data?.success) {
        updateUserProfile(res.data?.data || { avatar: compressed });
        showMsg('success', 'Đã cập nhật ảnh đại diện thành công!');
      }
    } catch (err) {
      showMsg('error', err.response?.data?.message || err.message || 'Không thể tải ảnh đại diện.');
    }
  };

  // Styling theo chế độ isDark (Admin) hoặc Light (Khách hàng)
  const bgModal = isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-gray-800 border-gray-100';
  const bgHeader = isDark ? 'bg-slate-900/60 border-slate-700/80' : 'bg-gray-50/80 border-gray-100';
  const bgInput = isDark ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-orange-500' : 'bg-white border-gray-200 text-gray-800 focus:border-orange-500';
  const textLabel = isDark ? 'text-slate-300' : 'text-gray-700';
  const textMuted = isDark ? 'text-slate-400' : 'text-gray-500';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className={`rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col border shadow-2xl overflow-hidden ${bgModal}`}>
        
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${bgHeader}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <UserAvatar
                src={profileForm.avatar}
                name={profileForm.name}
                fallbackChar="U"
                className="w-11 h-11 rounded-full text-base shadow-md"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Đổi ảnh đại diện"
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center border border-white shadow-xs cursor-pointer"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleModalAvatarChange}
                className="hidden"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Quản lý thông tin tài khoản</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  user?.role === 'ADMIN'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {user?.role === 'ADMIN' ? 'QUẢN TRỊ VIÊN' : 'THÀNH VIÊN'}
                </span>
              </div>
              <p className={`text-xs ${textMuted}`}>{profileForm.email || 'user@foodfast.vn'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className={`flex border-b px-4 pt-2 gap-2 ${bgHeader}`}>
          <button
            onClick={() => {
              setActiveTab('profile');
              setFeedback({ type: '', msg: '' });
            }}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Thông tin liên hệ
          </button>

          <button
            onClick={() => {
              setActiveTab('password');
              setFeedback({ type: '', msg: '' });
            }}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'password'
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            Đổi mật khẩu
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
          
          {/* Thông báo Alert */}
          {feedback.msg && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium animate-in fade-in duration-150 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/15 border-red-500/30 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              )}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* TAB 1: THÔNG TIN LIÊN HỆ */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    src={profileForm.avatar}
                    name={profileForm.name}
                    fallbackChar="U"
                    className="w-10 h-10 rounded-xl text-sm"
                  />
                  <div className="min-w-0">
                    <p className={`font-bold text-xs ${textLabel}`}>Ảnh đại diện</p>
                    <p className={`text-[11px] truncate ${textMuted}`}>JPG, PNG, WebP (tối đa 5MB)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] transition cursor-pointer"
                  >
                    Đổi ảnh
                  </button>
                  {profileForm.avatar && (
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileForm((prev) => ({ ...prev, avatar: '' }));
                        try {
                          const res = await authApi.updateProfile({ avatar: '' });
                          if (res.data?.success) {
                            updateUserProfile(res.data?.data || { avatar: '' });
                            showMsg('success', 'Đã gỡ ảnh đại diện.');
                          }
                        } catch {}
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                      title="Xóa ảnh đại diện"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Họ và tên */}
                <div className="sm:col-span-2">
                  <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                    Họ và tên *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Nhập họ và tên đầy đủ"
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${bgInput}`}
                      required
                    />
                  </div>
                </div>

                {/* Năm sinh */}
                <div>
                  <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                    Năm sinh
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="number"
                      min="1920"
                      max={new Date().getFullYear()}
                      value={profileForm.birthYear}
                      onChange={(e) => setProfileForm({ ...profileForm, birthYear: e.target.value })}
                      placeholder="vd: 1995"
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${bgInput}`}
                    />
                  </div>
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="vd: 0987654321"
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${bgInput}`}
                    />
                  </div>
                </div>

                {/* Địa chỉ liên hệ */}
                <div className="sm:col-span-2">
                  <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                    Địa chỉ liên hệ
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      placeholder="vd: Số 2 Đường Đỗ Xuân Hợp, Phường Phú Hữu, TP. Thủ Đức"
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${bgInput}`}
                    />
                  </div>
                </div>

                {/* Email định danh */}
                <div className="sm:col-span-2">
                  <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                    Email định danh tài khoản (Không thể thay đổi)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      value={profileForm.email}
                      disabled
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border opacity-70 cursor-not-allowed ${bgInput}`}
                    />
                  </div>
                  <p className={`text-[11px] mt-1 ${textMuted}`}>
                    Email được dùng để nhận mã OTP và thông báo quan trọng từ hệ thống.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-600/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: ĐỔI MẬT KHẨU */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div className={`p-3 rounded-xl border text-xs ${
                isDark ? 'bg-slate-900/60 border-slate-700/60 text-slate-400' : 'bg-orange-50/50 border-orange-100 text-gray-600'
              }`}>
                <p>• Mật khẩu mới cần tối thiểu 6 ký tự để đảm bảo tính an toàn cho tài khoản.</p>
                <p>• Hãy bảo mật mật khẩu và không chia sẻ cho bất kỳ ai.</p>
              </div>

              {/* Mật khẩu hiện tại */}
              <div>
                <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                  Mật khẩu hiện tại *
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    placeholder="Nhập mật khẩu hiện tại"
                    className={`w-full pl-9 pr-10 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${bgInput}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                  Mật khẩu mới (tối thiểu 6 ký tự) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Nhập mật khẩu mới"
                    className={`w-full pl-9 pr-10 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${bgInput}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label className={`block font-bold mb-1 text-xs ${textLabel}`}>
                  Xác nhận lại mật khẩu mới *
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Nhập lại mật khẩu mới"
                    className={`w-full pl-9 pr-10 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${bgInput}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-600/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  {savingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-3.5 border-t flex items-center justify-end ${bgHeader}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

