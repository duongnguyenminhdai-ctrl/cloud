import React, { useState, useEffect, useId } from 'react';
import {
  Phone,
  ShieldCheck,
  Send,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';
import { authApi } from '../api/client';
import {
  isFirebasePhoneConfigured,
  normalizeVNPhone,
  isValidVNPhone,
  sendFirebasePhoneOTP,
  confirmFirebasePhoneOTP,
  resetRecaptchaVerifier
} from '../utils/firebase';

/**
 * Component dùng chung để xác thực SĐT bằng SMS OTP qua Firebase Phone Auth
 * Dùng cho: Register, ProfilePage, MerchantRegister và Checkout
 */
export default function PhoneVerificationBox({
  phone = '',
  onPhoneChange,
  isVerified = false,
  onVerified,
  purpose = 'PROFILE',
  syncWithBackend = true,
  label = 'Số điện thoại di động (Việt Nam)',
  placeholder = 'VD: 0969535231',
  disabled = false,
  compact = false,
  stacked = false
}) {
  const reactId = useId().replace(/:/g, '_');
  const recaptchaId = `foodfast_recaptcha_${purpose.toLowerCase()}_${reactId}`;

  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [confirmingOtp, setConfirmingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    return () => {
      resetRecaptchaVerifier(recaptchaId);
    };
  }, [recaptchaId]);

  const handlePhoneInput = (val) => {
    setLocalError('');
    setLocalSuccess('');
    if (confirmationResult) {
      setConfirmationResult(null);
      setOtpCode('');
    }
    if (typeof onPhoneChange === 'function') {
      onPhoneChange(val);
    }
  };

  const handleSendSmsOtp = async () => {
    setLocalError('');
    setLocalSuccess('');

    const cleanLocal = normalizeVNPhone(phone);
    if (!isValidVNPhone(cleanLocal)) {
      setLocalError('Số điện thoại phải là số di động Việt Nam hợp lệ (10 số, đầu 03, 05, 07, 08 hoặc 09).');
      return;
    }

    if (!isFirebasePhoneConfigured) {
      setLocalError('Chưa cấu hình khóa Firebase Web (VITE_FIREBASE_*) trong .env nên chưa thể gửi SMS OTP.');
      return;
    }

    setSendingOtp(true);
    try {
      // Kiểm tra trước SĐT đã bị tài khoản khác xác thực chưa để tiết kiệm SMS Firebase
      const checkRes = await authApi.checkPhoneAvailable({ phone: cleanLocal, purpose });
      if (checkRes.data?.available === false) {
        setLocalError(checkRes.data?.message || 'Số điện thoại này đã được liên kết với một tài khoản khác.');
        setSendingOtp(false);
        return;
      }

      const conf = await sendFirebasePhoneOTP(cleanLocal, recaptchaId);
      setConfirmationResult(conf);
      setCountdown(60);
      setLocalSuccess(`Đã gửi mã OTP SMS tới số ${cleanLocal}. Vui lòng nhập 6 chữ số bên dưới.`);
    } catch (err) {
      setLocalError(err.response?.data?.message || err.message || 'Không thể gửi mã OTP SMS.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmSmsOtp = async () => {
    setLocalError('');
    setLocalSuccess('');
    setConfirmingOtp(true);
    try {
      const fbResult = await confirmFirebasePhoneOTP(confirmationResult, otpCode);
      const cleanLocal = fbResult.phoneNumber || normalizeVNPhone(phone);

      if (syncWithBackend) {
        const res = await authApi.verifyFirebasePhone({
          idToken: fbResult.idToken,
          purpose
        });
        if (!res.data?.success) {
          throw new Error(res.data?.message || 'Backend xác thực Firebase Token thất bại.');
        }
        setConfirmationResult(null);
        setOtpCode('');
        setLocalSuccess(`Đã xác thực SĐT ${cleanLocal} qua SMS thành công!`);
        if (typeof onVerified === 'function') {
          onVerified({
            phone: res.data.phone || cleanLocal,
            idToken: fbResult.idToken,
            storePhoneProofToken: res.data.storePhoneProofToken || null,
            token: res.data.token || null,
            user: res.data.user || null
          });
        }
      } else {
        setConfirmationResult(null);
        setOtpCode('');
        setLocalSuccess(`Đã xác thực SĐT ${cleanLocal} qua SMS thành công!`);
        if (typeof onVerified === 'function') {
          onVerified({
            phone: cleanLocal,
            idToken: fbResult.idToken,
            uid: fbResult.uid
          });
        }
      }
    } catch (err) {
      setLocalError(err.response?.data?.message || err.message || 'Mã OTP SMS không đúng hoặc đã hết hạn.');
    } finally {
      setConfirmingOtp(false);
    }
  };

  return (
    <div className={`space-y-2.5 ${compact ? '' : 'p-3.5 rounded-2xl bg-gray-50/80 border border-gray-200/80'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <span>{label}</span>
        </label>
        {isVerified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Đã xác thực SMS
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
            Chưa xác thực SMS
          </span>
        )}
      </div>

      <div className={stacked ? 'flex flex-col gap-2.5' : 'flex flex-col sm:flex-row gap-2'}>
        <div className="relative flex-1 min-w-0 w-full">
          <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="tel"
            inputMode="numeric"
            disabled={disabled || confirmingOtp}
            value={phone}
            onChange={(e) => handlePhoneInput(e.target.value)}
            placeholder={placeholder}
            className="w-full min-w-0 pl-10 pr-3 py-2.5 text-base sm:text-sm font-semibold tracking-wide rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-900"
          />
        </div>

        <button
          type="button"
          onClick={handleSendSmsOtp}
          disabled={disabled || sendingOtp || countdown > 0 || !phone || !isFirebasePhoneConfigured}
          className={`${stacked ? 'w-full justify-center' : 'w-full sm:w-auto justify-center'} px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-500 shrink-0 flex items-center gap-1.5 cursor-pointer`}
        >
          {sendingOtp ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi...
            </>
          ) : countdown > 0 ? (
            `Gửi lại (${countdown}s)`
          ) : isVerified ? (
            <>
              <Send className="w-3.5 h-3.5" /> Đổi / Xác thực lại
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" /> Gửi OTP SMS
            </>
          )}
        </button>
      </div>

      {/* Ô nhập mã OTP 6 số khi đã gửi thành công */}
      {confirmationResult && (
        <div className="p-3 rounded-xl bg-white border border-orange-200 space-y-2 animate-fadeIn">
          <p className="text-[11px] font-semibold text-gray-600">
            Nhập mã OTP 6 chữ số từ tin nhắn SMS Firebase:
          </p>
          <div className={stacked ? 'flex flex-col gap-2' : 'flex flex-col sm:flex-row gap-2'}>
            <div className="relative flex-1 min-w-0 w-full">
              <KeyRound className="w-4 h-4 text-orange-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full min-w-0 pl-9 pr-3 py-2 text-base tracking-[0.25em] font-mono font-bold rounded-xl border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-gray-900"
              />
            </div>
            <button
              type="button"
              onClick={handleConfirmSmsOtp}
              disabled={confirmingOtp || otpCode.length !== 6}
              className={`${stacked ? 'w-full justify-center' : 'w-full sm:w-auto justify-center'} px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0`}
            >
              {confirmingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Xác nhận OTP</span>
            </button>
          </div>
        </div>
      )}

      {!isFirebasePhoneConfigured && (
        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600" />
          <span>
            Chưa cấu hình biến môi trường Firebase (<code className="font-mono font-bold">VITE_FIREBASE_*</code>). Sau khi điền cấu hình Firebase Project, nút <strong>Gửi OTP SMS</strong> sẽ tự động kích hoạt.
          </span>
        </div>
      )}

      {localError && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium flex items-start gap-1.5 leading-relaxed">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{localError}</span>
        </div>
      )}

      {localSuccess && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-start gap-1.5 leading-relaxed">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
          <span>{localSuccess}</span>
        </div>
      )}

      {/* Neo reCAPTCHA vô hình cho Firebase SDK */}
      <div id={recaptchaId} />
    </div>
  );
}

