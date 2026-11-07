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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo Card */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-orange-500/20 mb-3">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black text-white">FoodFast Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Đăng nhập dành cho Quản trị viên hệ thống (Admin)</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Quản trị viên</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@foodfast.vn"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Mật khẩu bảo mật</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>
            </div>

            {/* Hint Box */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-bold text-orange-400">Tài khoản mặc định:</span>
              <div className="mt-0.5">Email: <code className="text-slate-300">admin@foodfast.vn</code></div>
              <div>Mật khẩu: <code className="text-slate-300">Admin@123456</code></div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? 'Đang xác thực...' : 'Đăng nhập Quản Trị'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <Link
              to="/"
              className="text-xs text-slate-400 hover:text-orange-400 inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Về trang khách hàng FoodFast
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
