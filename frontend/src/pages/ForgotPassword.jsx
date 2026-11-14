import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle, KeyRound, CheckCircle2, Loader2, ArrowLeft, Check, X } from 'lucide-react';
import { authApi } from '../api/client';
import FlashlightAuthCard, { InteractiveOwl } from '../components/FlashlightAuthCard';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: Điền Email & OTP | 2: Thiết lập Mật khẩu mới & Xác nhận
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
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
      setError('Vui lòng nhập địa chỉ email hợp lệ trước khi gửi mã OTP.');
      return;
    }

    setError(null);
    setInfoMsg(null);
    setOtpSending(true);

    try {
      const res = await authApi.sendOTP({ email: email.trim(), type: 'FORGOT_PASSWORD' });
      if (res.data?.success) {
        if (res.data.devOtp) {
          setOtp(res.data.devOtp);
          setInfoMsg(`Mã OTP khôi phục mật khẩu: ${res.data.devOtp} (Đã tự động điền vào ô mã xác thực bên dưới)`);
        } else {
          setInfoMsg(res.data.message || 'Mã OTP khôi phục mật khẩu đã được gửi về Gmail của bạn.');
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
      setError(err.response?.data?.message || 'Lỗi khi gửi email OTP. Vui lòng thử lại sau giây lát.');
    } finally {
      setOtpSending(false);
    }
  };

  // Bước 1: Xác thực mã OTP trước khi sang trang con điền mật khẩu mới
  const handleVerifyStep1 = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    if (!otp || otp.trim().length !== 6) {
      setError('Vui lòng nhập đúng mã OTP 6 chữ số gửi về Gmail.');
      return;
    }

    setVerifyingOtp(true);

    try {
      const res = await authApi.verifyOTP({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        type: 'FORGOT_PASSWORD'
      });

      if (res.data?.success) {
        setError(null);
        setInfoMsg('Xác thực OTP thành công! Vui lòng thiết lập mật khẩu mới.');
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

  // Bước 2: Cập nhật mật khẩu mới và xác nhận mật khẩu mới
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword
      });

      if (res.data?.success) {
        setIsSuccess(true);
      } else {
        setError(res.data?.message || 'Không thể đặt lại mật khẩu.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra mã OTP.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEye = (which) => {
    if (activeFlashlight === which) {
      setActiveFlashlight(null); // Tắt đèn pin
    } else {
      setActiveFlashlight(which); // Bật đèn pin soi trường này
    }
  };

  const isPasswordMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const isPasswordMismatch = confirmPassword && newPassword !== confirmPassword;

  return (
    <FlashlightAuthCard
      title={step === 1 ? 'Khôi Phục Mật Khẩu' : 'Đặt Lại Mật Khẩu'}
      subtitle={
        step === 1
          ? 'Bước 1/2: Xác thực mã OTP gửi về Gmail của bạn'
          : 'Bước 2/2: Nhập mật khẩu mới và xác nhận để khôi phục'
      }
      sceneTitle="BẢO MẬT TÀI KHOẢN"
      sceneDesc="FoodFast bảo vệ tài khoản và điểm tích lũy của bạn an toàn 100%."
      passwordValue={step === 2 ? newPassword : ''}
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
      {isSuccess ? (
        <div className="space-y-5 text-center py-4">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-1.5">
            <h3 className={`text-xl font-bold transition-colors ${isNightMode ? 'text-white' : 'text-gray-900'}`}>
              Đổi Mật Khẩu Thành Công!
            </h3>
            <p className={`text-xs transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-600'}`}>
              Mật khẩu tài khoản của bạn đã được cập nhật thành công. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Đăng nhập ngay
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
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
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* ======================= BƯỚC 1: NHẬP EMAIL & XÁC THỰC OTP ======================= */}
          {step === 1 && (
            <form onSubmit={handleVerifyStep1} className="space-y-3.5">
              {/* Email tài khoản kèm chú cú Owl */}
              <div className="space-y-1 relative">
                <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Email tài khoản
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
                      placeholder="example@foodfast.vn"
                      className="auth-input w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={otpSending || countdown > 0 || !email}
                    className="shrink-0 px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-500 flex items-center gap-1.5 cursor-pointer"
                  >
                    {otpSending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Gửi...</span>
                      </>
                    ) : countdown > 0 ? (
                      <span>Lại ({countdown}s)</span>
                    ) : (
                      <span>Gửi mã OTP</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Mã OTP 6 chữ số */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                    Mã xác thực OTP (6 số từ Gmail)
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
                    placeholder="Nhập 6 số từ Gmail"
                    className="auth-input w-full pl-10 pr-4 py-2.5 text-sm font-mono tracking-widest font-bold rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900 placeholder:tracking-normal placeholder:font-sans"
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kiểm tra mã OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Xác thực & Tiếp tục</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================= BƯỚC 2: THIẾT LẬP MẬT KHẨU MỚI & XÁC NHẬN ======================= */}
          {step === 2 && (
            <form onSubmit={handleFinalSubmit} className="space-y-3.5">
              {/* Card tóm tắt tài khoản */}
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between text-xs">
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="font-bold text-gray-900 dark:text-white truncate">Khôi phục mật khẩu</div>
                  <div className="text-gray-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                    <span>{email}</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3" /> OTP hợp lệ
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

              {/* Mật khẩu mới có đèn pin soi */}
              <div className="space-y-1">
                <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  Mật khẩu mới (tối thiểu 6 ký tự)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    ref={passwordInputRef}
                    type={activeFlashlight === 'password' ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onFocus={() => { if (activeFlashlight) setActiveFlashlight('password'); }}
                    placeholder="Tối thiểu 6 ký tự"
                    className={`auth-input w-full pl-10 pr-12 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900 ${
                      activeFlashlight === 'password' ? 'auth-password-input font-mono' : ''
                    }`}
                  />
                  {/* Eye toggle for Flashlight */}
                  <button
                    ref={passwordButtonRef}
                    type="button"
                    onClick={() => toggleEye('password')}
                    className="absolute right-2 top-2 p-1.5 rounded-lg text-gray-500 hover:text-orange-600 transition-colors cursor-pointer"
                    title={activeFlashlight === 'password' ? 'Tắt đèn pin' : 'Bật đèn pin soi sáng mật khẩu mới'}
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

              {/* Xác nhận mật khẩu mới (cũng có đèn pin soi) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-bold transition-colors ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                    Xác nhận mật khẩu mới
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
                    placeholder="Nhập lại mật khẩu mới"
                    className={`auth-input w-full pl-10 pr-12 py-2.5 text-sm rounded-xl border border-gray-200/80 bg-white/70 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900 ${
                      activeFlashlight === 'confirm' ? 'auth-password-input font-mono' : ''
                    }`}
                  />
                  {/* Eye toggle for Confirm Password Flashlight */}
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
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang cập nhật mật khẩu...</span>
                    </>
                  ) : (
                    <>
                      <span>Đặt lại mật khẩu</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Back to Login */}
          <div className="text-center text-xs text-gray-500 dark:text-slate-400 pt-3 border-t border-gray-200/40 dark:border-slate-800 mt-4 flex items-center justify-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 font-bold text-orange-600 dark:text-orange-400 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Đăng nhập</span>
            </Link>
          </div>
        </>
      )}
    </FlashlightAuthCard>
  );
}
