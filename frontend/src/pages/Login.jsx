import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import FlashlightAuthCard, { InteractiveOwl } from '../components/FlashlightAuthCard';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isNightMode, setIsNightMode] = useState(false);

  const passwordInputRef = useRef(null);
  const passwordButtonRef = useRef(null);
  const emailInputRef = useRef(null);
  const owlRef = useRef(null);

  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  // Lắng nghe token hoặc lỗi từ Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const authError = params.get('error');

    if (authError) {
      setError(decodeURIComponent(authError));
    } else if (token) {
      const name = params.get('name') || 'Người dùng Google';
      const userEmail = params.get('email') || '';
      const role = params.get('role') || 'CUSTOMER';
      setSuccessMsg(`Chào mừng ${name}! Đăng nhập Google thành công.`);
      loginWithToken(token, { name, email: userEmail, role });
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 800);
    }
  }, [location.search, loginWithToken, navigate, from]);

  const handleGoogleLogin = () => {
    setError(null);
    window.location.href = authApi.getGoogleAuthUrl();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.message || 'Email hoặc mật khẩu không chính xác');
    }
  };

  return (
    <FlashlightAuthCard
      title="Đăng Nhập Tài Khoản"
      subtitle="Khám phá ẩm thực 9 miền giao nhanh trong 15 phút"
      sceneTitle="FOODFAST"
      sceneDesc="Sổ tay ký họa ẩm thực & ngàn món ngon giao tận cửa."
      passwordValue={password}
      passwordInputRef={passwordInputRef}
      passwordButtonRef={passwordButtonRef}
      emailInputRef={emailInputRef}
      isNightMode={isNightMode}
      onToggleNightMode={setIsNightMode}
    >
      {/* Thông báo thành công từ Google */}
      {successMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Thông báo lỗi */}
      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Nút Đăng nhập với Google OAuth */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full py-2.5 px-4 bg-white/90 dark:bg-slate-800/90 hover:bg-white active:bg-gray-100 text-gray-700 dark:text-slate-200 font-bold text-xs sm:text-sm rounded-xl border border-gray-200/80 dark:border-slate-700 shadow-sm hover:shadow transition-all flex items-center justify-center gap-2.5 cursor-pointer mb-4"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>Đăng nhập với Google</span>
      </button>

      {/* Phân cách Hoặc */}
      <div className="relative flex items-center justify-center mb-4">
        <div className="border-t border-gray-300/40 dark:border-slate-700 w-full" />
        <span className="px-3 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
          Hoặc dùng Email
        </span>
        <div className="border-t border-gray-300/40 dark:border-slate-700 w-full" />
      </div>

      {/* Form đăng nhập email / password */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field with Owl on top */}
        <div className="space-y-1 relative">
          <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Email
          </label>
          <div className="relative email-owl-wrapper" ref={emailInputRef}>
            <InteractiveOwl owlRef={owlRef} isLit={isNightMode} />
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@foodfast.vn"
              className="auth-input w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900"
            />
          </div>
        </div>

        {/* Password Field with Flashlight eye button */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Mật khẩu
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              ref={passwordInputRef}
              type={isNightMode ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`auth-input w-full pl-10 pr-12 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900 ${
                isNightMode ? 'auth-password-input font-mono' : ''
              }`}
            />
            {/* Eye toggle for Flashlight */}
            <button
              ref={passwordButtonRef}
              type="button"
              onClick={() => setIsNightMode(!isNightMode)}
              className="absolute right-2 top-2 p-1.5 rounded-lg text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
              title={isNightMode ? 'Tắt đèn pin' : 'Bật đèn pin soi sáng mật khẩu'}
              aria-pressed={isNightMode}
            >
              <img
                src="/flashlight-assets/icon-eye.svg"
                alt="Toggle Flashlight"
                className={`w-4 h-4 transition-transform ${isNightMode ? 'scale-110 brightness-150' : 'opacity-70'}`}
              />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Đang xác thực...' : 'Đăng nhập ngay'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Demo Accounts */}
      <div className="mt-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          <span>💡</span> Tài khoản mẫu thử nghiệm:
        </p>
        <p>
          Khách hàng: <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">khachhang@test.com</code> | Pass: <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">123456</code>
        </p>
        <p>
          Chủ quán: <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">chuquan@test.com</code> | Pass: <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">123456</code>
        </p>
      </div>

      {/* Switch to Register */}
      <div className="text-center text-xs text-gray-500 dark:text-slate-400 pt-3 border-t border-gray-200/40 dark:border-slate-800 mt-4">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
          Đăng ký tài khoản mới
        </Link>
      </div>
    </FlashlightAuthCard>
  );
}
