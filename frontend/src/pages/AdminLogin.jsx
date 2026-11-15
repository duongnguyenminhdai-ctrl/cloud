import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@foodfast.vn');
  const [password, setPassword] = useState('Admin@123456');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await adminApi.login({ email, password });
      if (res.data?.success) {
        const { token, user } = res.data;
        loginWithToken(token, user);
        navigate('/admin');
      } else {
        setErrorMsg(res.data?.message || 'Đăng nhập quản trị viên thất bại');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ece7dc] dark:bg-[#161412] text-[#2b2721] dark:text-[#ede6d8] flex items-center justify-center p-4 relative overflow-hidden transition-colors">
      {/* Lớp nền Wash màu nước nghệ thuật */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-10 bg-cover bg-top"
        style={{ backgroundImage: 'url("/landing-pages/meng-to-sketchbook/bg-wash.jpg")' }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#ece7dc]/30 via-[#ece7dc]/70 to-[#ece7dc] dark:from-[#161412]/40 dark:via-[#161412]/80 dark:to-[#161412] opacity-90 transition-colors" aria-hidden="true" />

      <div className="max-w-md w-full relative z-10">
        {/* Logo Card */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full overflow-hidden mx-auto shadow-md mb-3 border border-[rgba(43,39,33,0.14)] bg-[#fbf9f4]">
            <img src="/foodfast-logo.png" alt="FoodFast Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black text-[#2b2721] font-serif">FoodFast Admin Portal</h1>
          <p className="text-xs text-[#2b2721]/70 mt-1">Đăng nhập dành cho Quản trị viên hệ thống (Admin)</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#fffdfa]/95 border border-[rgba(43,39,33,0.14)] rounded-3xl p-6 sm:p-8 shadow-xl text-[#2b2721]">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#2b2721]/80 mb-1.5">Email Quản trị viên</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2b2721]/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@foodfast.vn"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#fffdfa] border border-[rgba(43,39,33,0.18)] rounded-xl text-xs text-[#2b2721] placeholder-[#2b2721]/40 focus:outline-none focus:border-[#9a6a3e] focus:ring-2 focus:ring-[#9a6a3e]/15"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2b2721]/80 mb-1.5">Mật khẩu bảo mật</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2b2721]/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#fffdfa] border border-[rgba(43,39,33,0.18)] rounded-xl text-xs text-[#2b2721] placeholder-[#2b2721]/40 focus:outline-none focus:border-[#9a6a3e] focus:ring-2 focus:ring-[#9a6a3e]/15"
                  required
                />
              </div>
            </div>

            {/* Hint Box */}
            <div className="p-3 rounded-xl bg-[#f2ece1] border border-[rgba(43,39,33,0.12)] text-[11px] text-[#2b2721]/75">
              <span className="font-bold text-[#9a6a3e]">Tài khoản mặc định:</span>
              <div className="mt-0.5">Email: <code className="text-[#2b2721] font-semibold">admin@foodfast.vn</code></div>
              <div>Mật khẩu: <code className="text-[#2b2721] font-semibold">Admin@123456</code></div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#9a6a3e] hover:bg-[#845831] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#9a6a3e]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Đang xác thực...' : 'Đăng nhập Quản Trị'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[rgba(43,39,33,0.12)] text-center">
            <Link
              to="/"
              className="text-xs text-[#2b2721]/60 hover:text-[#9a6a3e] inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Về trang khách hàng FoodFast
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

