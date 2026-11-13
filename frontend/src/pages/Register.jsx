import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, UtensilsCrossed, AlertCircle, ShieldCheck, CheckCircle, KeyRound, Loader2, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import PhoneVerificationBox from '../components/PhoneVerificationBox';
import { isFirebasePhoneConfigured, normalizeVNPhone } from '../utils/firebase';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState('');
  const [firebaseIdToken, setFirebaseIdToken] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CUSTOMER');

  const [requirePhoneVerification, setRequirePhoneVerification] = useState(true);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Nạp trạng thái kiểm soát xác minh SĐT từ hệ thống
  useEffect(() => {
    let isMounted = true;
    const fetchPhoneConfig = async () => {
      try {
        const res = await authApi.getPhoneConfigStatus();
        if (isMounted && res.data?.success) {
          setRequirePhoneVerification(Boolean(res.data.required));
        }
      } catch (err) {
        console.warn('Không thể kiểm tra cấu hình Phone Auth:', err);
      }
    };
    fetchPhoneConfig();
    return () => {
      isMounted = false;
    };
  }, []);

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
      setError('Vui lòng nhập email hợp lệ trước khi lấy mã OTP.');
      return;
    }

    setError(null);
    setInfoMsg(null);
    setOtpSending(true);

    try {
      const res = await authApi.sendOTP({ email, type: 'REGISTER' });
      if (res.data?.success) {
        setInfoMsg(res.data.message || 'Mã OTP đã được gửi về Gmail của bạn.');
        setCountdown(60);
      } else {
        setError(res.data?.message || 'Không thể gửi mã OTP.');
      }
    } catch (err) {
      const remainingSec = err.response?.data?.remaining;
      if (remainingSec) {
        setCountdown(remainingSec);
      }
      setError(err.response?.data?.message || 'Lỗi kết nối khi gửi email OTP.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (!otp || otp.trim().length !== 6) {
      setError('Vui lòng nhập đúng mã OTP 6 chữ số được gửi tới email.');
      return;
    }

    let finalPhone = undefined;
    if (phone && phone.trim()) {
      const norm = normalizeVNPhone(phone);
      if (!norm) {
        setError('Số điện thoại không hợp lệ (Vui lòng nhập SĐT di động Việt Nam 10 chữ số đầu 03/05/07/08/09).');
        return;
      }
      finalPhone = norm;
    }

    const isPhoneSmsVerified = Boolean(
      firebaseIdToken &&
      verifiedPhone &&
      normalizeVNPhone(phone) === normalizeVNPhone(verifiedPhone)
    );

    if (requirePhoneVerification && isFirebasePhoneConfigured && !isPhoneSmsVerified) {
      setError('Vui lòng xác thực số điện thoại qua mã OTP SMS để chống tài khoản SĐT rác.');
      return;
    }

    setLoading(true);

    const result = await register({
      name,
      email,
      password,
      role,
      otp: otp.trim(),
      phone: finalPhone,
      firebaseIdToken: isPhoneSmsVerified ? firebaseIdToken : undefined
    });
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Không thể tạo tài khoản');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-orange-500/5 space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 mx-auto flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Đăng Ký Tài Khoản</h1>
          <p className="text-sm text-gray-500">Bảo mật xác thực tự động qua Gmail OTP</p>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Thông báo thông tin */}
        {infoMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Nút Đăng ký nhanh bằng Google */}
        <button
          type="button"
          onClick={() => { window.location.href = authApi.getGoogleAuthUrl(); }}
          className="w-full py-3 px-4 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-bold text-sm rounded-xl border border-gray-200 shadow-sm hover:shadow transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
        <div className="relative flex items-center justify-center">
          <div className="border-t border-gray-200 w-full" />
          <span className="bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
            Hoặc đăng ký bằng Email & OTP
          </span>
          <div className="border-t border-gray-200 w-full" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Họ và tên */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Họ và tên</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* Email kèm nút Gửi OTP */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Địa chỉ Gmail</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={otpSending || countdown > 0 || !email}
                className="px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-500 shrink-0 flex items-center gap-1.5"
              >
                {otpSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi...
                  </>
                ) : countdown > 0 ? (
                  `Gửi lại (${countdown}s)`
                ) : (
                  'Gửi mã OTP'
                )}
              </button>
            </div>
          </div>

          {/* Ô nhập mã OTP 6 số */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">Mã xác thực OTP (6 chữ số)</label>
              <span className="text-[10px] text-gray-400">Hiệu lực trong 5 phút</span>
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
                className="w-full pl-10 pr-4 py-2.5 text-sm tracking-widest font-mono font-bold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* Số điện thoại (Tự động thích ứng: Bắt buộc OTP SMS hoặc Nhập trực tiếp khi tắt xác minh) */}
          {requirePhoneVerification ? (
            <PhoneVerificationBox
              phone={phone}
              onPhoneChange={(val) => {
                setPhone(val);
                if (normalizeVNPhone(val) !== normalizeVNPhone(verifiedPhone)) {
                  setFirebaseIdToken('');
                  setVerifiedPhone('');
                }
              }}
              isVerified={Boolean(
                firebaseIdToken &&
                verifiedPhone &&
                normalizeVNPhone(phone) === normalizeVNPhone(verifiedPhone)
              )}
              purpose="REGISTER"
              syncWithBackend={false}
              label="Số điện thoại di động (Xác thực SMS chống SĐT rác)"
              onVerified={({ phone: vPhone, idToken }) => {
                setPhone(vPhone);
                setVerifiedPhone(vPhone);
                setFirebaseIdToken(idToken);
                setError(null);
              }}
            />
          ) : (
            <div className="space-y-1.5 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-orange-500" /> Số điện thoại di động
                </label>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                  Chế độ kiểm thử (Bỏ qua OTP)
                </span>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
                  placeholder="0912345678 (tùy chọn khi kiểm thử)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white"
                />
              </div>
              <p className="text-[11px] text-gray-500 leading-tight">
                Hệ thống đang mở chế độ kiểm thử, bạn có thể hoàn tất đăng ký ngay mà không cần mã OTP SMS Firebase.
              </p>
            </div>
          )}

          {/* Mật khẩu */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Mật khẩu (tối thiểu 6 ký tự)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* Vai trò */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Vai trò tài khoản</label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRole('CUSTOMER')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                  role === 'CUSTOMER'
                    ? 'bg-orange-50 border-orange-500 text-orange-600'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Khách hàng
              </button>
              <button
                type="button"
                onClick={() => setRole('RESTAURANT_OWNER')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                  role === 'RESTAURANT_OWNER'
                    ? 'bg-orange-50 border-orange-500 text-orange-600'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Chủ nhà hàng
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang xác thực OTP & tạo tài khoản...
              </>
            ) : (
              <>
                Xác thực & Đăng ký ngay <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Login */}
        <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-100">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-bold text-orange-600 hover:underline">
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
