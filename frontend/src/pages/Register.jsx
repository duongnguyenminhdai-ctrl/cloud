import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, AlertCircle, CheckCircle, KeyRound, Loader2, ArrowLeft, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import FlashlightAuthCard, { InteractiveOwl } from '../components/FlashlightAuthCard';

export default function Register() {
  const [step, setStep] = useState(1); // 1: Điền Email & OTP | 2: Tạo Mật khẩu & Xác nhận
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);
  const [isNightMode, setIsNightMode] = useState(() => {
    try {
      return localStorage.getItem('foodfast_auth_night_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [activeFlashlight, setActiveFlashlight] = useState(null); // 'password' | 'confirm' | null

  const passwordInputRef = useRef(null);
  const passwordButtonRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const confirmPasswordButtonRef = useRef(null);
  const emailInputRef = useRef(null);
  const owlRef = useRef(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Đếm ngược 60 giây cho nút Gửi OTP
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ trước khi lấy mã OTP.');
      return;
    }

    setError(null);
    setInfoMsg(null);
    setOtpSending(true);

    try {
      const res = await authApi.sendOTP({ email: email.trim(), type: 'REGISTER' });
      if (res.data?.success) {
        if (res.data.devOtp) {
          setOtp(res.data.devOtp);
          setInfoMsg(`Mã OTP xác thực: ${res.data.devOtp} (Đã tự động điền vào ô mã xác thực bên dưới)`);
        } else {
          setInfoMsg(res.data.message || 'Mã OTP đã được gửi về Gmail của bạn.');
        }
        setCountdown(60);
      } else {
        setError(res.data?.message || 'Không thể gửi mã OTP.');
      }
    } catch (err) {
      const remainingSec = err.response?.data?.remaining;
      if (remainingSec) {
        setCountdown(remainingSec);
      }
      setError(err.response?.data?.message || 'Lỗi kết nối khi gửi email OTP. Vui lòng thử lại sau giây lát.');
    } finally {
      setOtpSending(false);
    }
  };

  // Bước 1: Xác thực OTP trước khi cho nhập mật khẩu
  const handleVerifyStep1 = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (!name || name.trim().length < 2) {
      setError('Vui lòng nhập họ và tên đầy đủ (tối thiểu 2 ký tự).');
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    if (!otp || otp.trim().length !== 6) {
      setError('Vui lòng nhập đúng mã OTP 6 chữ số được gửi tới Gmail.');
      return;
    }

    setVerifyingOtp(true);

    try {
      const res = await authApi.verifyOTP({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        type: 'REGISTER'
      });

      if (res.data?.success) {
        setError(null);
        setInfoMsg('Xác thực OTP thành công! Vui lòng thiết lập mật khẩu.');
        setStep(2);
      } else {
        setError(res.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn. Vui lòng thử lại.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Bước 2: Tạo tài khoản với Mật khẩu & Xác nhận mật khẩu
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (!password || password.length < 6) {
      setError('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu đã nhập.');
      return;
    }

    setLoading(true);

    const result = await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'CUSTOMER',
      otp: otp.trim()
    });
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Không thể tạo tài khoản');
    }
  };

  const toggleEye = (which) => {
    if (activeFlashlight === which) {
      setActiveFlashlight(null); // Tắt đèn pin
    } else {
      setActiveFlashlight(which); // Bật đèn pin soi trường này
    }
  };

  const isPasswordMatch = password && confirmPassword && password === confirmPassword;
  const isPasswordMismatch = confirmPassword && password !== confirmPassword;

  return (
    <FlashlightAuthCard
      title={step === 1 ? 'Đăng Ký Tài Khoản' : 'Thiết Lập Mật Khẩu'}
      subtitle={
        step === 1
          ? 'Bước 1/2: Xác thực Gmail OTP bảo vệ tài khoản'
          : 'Bước 2/2: Đặt mật khẩu và xác nhận để hoàn tất'
      }
      sceneTitle="GIA NHẬP FOODFAST"
      sceneDesc="Khám phá ẩm thực 9 miền & nhận 1.000 Xu FoodFast khi đặt đơn đầu tiên."
      passwordValue={step === 2 ? password : ''}
      passwordInputRef={passwordInputRef}
      passwordButtonRef={passwordButtonRef}
      confirmPasswordValue={step === 2 ? confirmPassword : ''}
      confirmPasswordInputRef={confirmPasswordInputRef}
      confirmPasswordButtonRef={confirmPasswordButtonRef}
      activeEye={activeFlashlight || 'password'}
      emailInputRef={step === 1 ? emailInputRef : null}
      isNightMode={isNightMode}
      onToggleNightMode={setIsNightMode}
      isFlashlightOn={step === 2 && Boolean(activeFlashlight)}
      hasPasswordField={step === 2}
    >
      {/* Thông báo lỗi */}
      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Thông báo thông tin */}
      {infoMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{infoMsg}</span>
        </div>
      )}

      {/* ======================= BƯỚC 1: XÁC THỰC EMAIL & OTP ======================= */}
      {step === 1 && (
        <>
          {/* Nút Đăng ký nhanh bằng Google */}
          <button
            type="button"
            onClick={() => { window.location.href = authApi.getGoogleAuthUrl(); }}
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
            <span>Đăng ký nhanh với Google</span>
          </button>

          {/* Phân cách Hoặc */}
          <div className="relative flex items-center justify-center mb-4">
            <div className="border-t border-gray-300/40 dark:border-slate-700 w-full" />
            <span className="px-3 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
              Hoặc đăng ký bằng Email & OTP
            </span>
            <div className="border-t border-gray-300/40 dark:border-slate-700 w-full" />
          </div>

          <form onSubmit={handleVerifyStep1} className="space-y-3.5">
            {/* Họ và tên */}
            <div className="space-y-1">
              <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Họ và tên
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="auth-input w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900"
                />
              </div>
            </div>

            {/* Địa chỉ Gmail kèm nút Gửi OTP & Chú Cú */}
            <div className="space-y-1 relative">
              <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Địa chỉ Gmail
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 email-owl-wrapper" ref={emailInputRef}>
                  <InteractiveOwl owlRef={owlRef} isLit={isNightMode} />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="auth-input w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={otpSending || countdown > 0 || !email}
                  className="px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-500 shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {otpSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gửi...
                    </>
                  ) : countdown > 0 ? (
                    `Lại (${countdown}s)`
                  ) : (
                    'Gửi mã OTP'
                  )}
                </button>
              </div>
            </div>

            {/* Mã OTP 6 chữ số */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Mã xác thực OTP (6 chữ số từ Gmail)
                </label>
                <span className="text-[10px] text-gray-400 dark:text-slate-400">Hiệu lực 5 phút</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="auth-input w-full pl-10 pr-4 py-2.5 text-sm tracking-widest font-mono font-bold rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900 placeholder:tracking-normal placeholder:font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifyingOtp}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {verifyingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra mã OTP...
                </>
              ) : (
                <>
                  Xác thực & Tiếp tục <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </>
      )}

      {/* ======================= BƯỚC 2: THIẾT LẬP MẬT KHẨU & XÁC NHẬN ======================= */}
      {step === 2 && (
        <form onSubmit={handleFinalSubmit} className="space-y-3.5">
          {/* Card tóm tắt tài khoản đã xác thực */}
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between text-xs">
            <div className="space-y-0.5 min-w-0 pr-2">
              <div className="font-bold text-gray-900 dark:text-white truncate">{name}</div>
              <div className="text-gray-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                <span>{email}</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3 h-3" /> Đã xác thực OTP
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setStep(1); setError(null); }}
              className="text-orange-600 dark:text-orange-400 hover:underline font-bold shrink-0 text-[11px] cursor-pointer"
            >
              Thay đổi
            </button>
          </div>

          {/* Trường 1: Mật khẩu chính */}
          <div className="space-y-1">
            <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Mật khẩu (tối thiểu 6 ký tự)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                ref={passwordInputRef}
                type={activeFlashlight === 'password' ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => { if (activeFlashlight) setActiveFlashlight('password'); }}
                placeholder="••••••••"
                className={`auth-input w-full pl-10 pr-12 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900 ${
                  activeFlashlight === 'password' ? 'auth-password-input font-mono' : ''
                }`}
              />
              {/* Nút bật đèn pin cho Mật khẩu */}
              <button
                ref={passwordButtonRef}
                type="button"
                onClick={() => toggleEye('password')}
                className="absolute right-2 top-2 p-1.5 rounded-lg text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
                title={activeFlashlight === 'password' ? 'Tắt đèn pin' : 'Bật đèn pin soi sáng mật khẩu'}
                aria-pressed={activeFlashlight === 'password'}
              >
                <img
                  src="/flashlight-assets/icon-eye.svg"
                  alt="Toggle Flashlight"
                  className={`w-4 h-4 transition-transform ${
                    activeFlashlight === 'password'
                      ? 'scale-110 brightness-150 ring-2 ring-amber-400 rounded-full'
                      : 'opacity-70'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Trường 2: Xác nhận mật khẩu (cũng có đèn pin soi sáng) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Xác nhận mật khẩu
              </label>
              {isPasswordMatch && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Khớp mật khẩu
                </span>
              )}
              {isPasswordMismatch && (
                <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Chưa khớp
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                ref={confirmPasswordInputRef}
                type={activeFlashlight === 'confirm' ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => { if (activeFlashlight) setActiveFlashlight('confirm'); }}
                placeholder="Nhập lại mật khẩu ở trên"
                className={`auth-input w-full pl-10 pr-12 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900 ${
                  activeFlashlight === 'confirm' ? 'auth-password-input font-mono' : ''
                }`}
              />
              {/* Nút bật đèn pin cho Xác nhận mật khẩu */}
              <button
                ref={confirmPasswordButtonRef}
                type="button"
                onClick={() => toggleEye('confirm')}
                className="absolute right-2 top-2 p-1.5 rounded-lg text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
                title={activeFlashlight === 'confirm' ? 'Tắt đèn pin' : 'Bật đèn pin soi sáng xác nhận mật khẩu'}
                aria-pressed={activeFlashlight === 'confirm'}
              >
                <img
                  src="/flashlight-assets/icon-eye.svg"
                  alt="Toggle Flashlight Confirm"
                  className={`w-4 h-4 transition-transform ${
                    activeFlashlight === 'confirm'
                      ? 'scale-110 brightness-150 ring-2 ring-amber-400 rounded-full'
                      : 'opacity-70'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={() => { setStep(1); setError(null); }}
              className="py-3 px-4 rounded-xl border border-gray-300/80 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo tài khoản...
                </>
              ) : (
                <>
                  Hoàn tất & Đăng nhập <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Switch to Login */}
      <div className="text-center text-xs text-gray-500 dark:text-slate-400 pt-3 border-t border-gray-200/40 dark:border-slate-800 mt-4">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
          Đăng nhập
        </Link>
      </div>
    </FlashlightAuthCard>
  );
}
