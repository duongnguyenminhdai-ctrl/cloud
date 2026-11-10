import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

export const isFirebasePhoneConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let cachedApp = null;
let cachedAuth = null;

function getFirebaseAuthInstance() {
  if (!isFirebasePhoneConfigured) return null;
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
    cachedAuth.languageCode = 'vi';
  }
  return cachedAuth;
}

/**
 * Chuẩn hóa số điện thoại di động Việt Nam (03/05/07/08/09 + 8 số)
 */
export function normalizeVNPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let cleaned = rawPhone.replace(/[\s().-]/g, '').trim();
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

export function isValidVNPhone(rawPhone) {
  const local = normalizeVNPhone(rawPhone);
  return /^0(3|5|7|8|9)\d{8}$/.test(local) && !/^0+$/.test(local);
}

export function toE164VNPhone(rawPhone) {
  const local = normalizeVNPhone(rawPhone);
  if (!isValidVNPhone(local)) return '';
  return '+84' + local.slice(1);
}

const verifierRegistry = new Map();

export function resetRecaptchaVerifier(containerId) {
  const existing = verifierRegistry.get(containerId);
  if (existing) {
    try {
      existing.clear();
    } catch {}
    verifierRegistry.delete(containerId);
  }
  if (typeof document !== 'undefined') {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  }
}

export function translateFirebasePhoneError(error) {
  const code = error?.code || '';
  if (code === 'auth/invalid-phone-number') {
    return 'Số điện thoại không đúng định dạng Việt Nam (+84 / 0xxx).';
  }
  if (code === 'auth/too-many-requests') {
    return 'Bạn yêu cầu gửi mã OTP quá nhiều lần. Vui lòng thử lại sau ít phút.';
  }
  if (code === 'auth/quota-exceeded' || code === 'auth/billing-not-enabled') {
    return 'Dự án Firebase chưa bật gói Blaze hoặc đã hết hạn mức SMS miễn phí. Với gói Spark miễn phí, hãy dùng Test Phone Numbers trong Firebase Console.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Tên miền hiện tại chưa được thêm vào Authorized Domains trong Firebase Authentication Settings.';
  }
  if (code === 'auth/captcha-check-failed') {
    return 'Xác minh reCAPTCHA không thành công. Vui lòng tải lại trang và thử lại.';
  }
  if (code === 'auth/invalid-verification-code') {
    return 'Mã OTP SMS không chính xác. Vui lòng kiểm tra lại 6 chữ số.';
  }
  if (code === 'auth/code-expired') {
    return 'Mã OTP SMS đã hết hạn. Vui lòng bấm Gửi lại mã mới.';
  }
  return error?.message || 'Lỗi gửi/xác thực mã OTP qua Firebase.';
}

/**
 * Gửi SMS OTP thông qua Firebase Phone Authentication + Invisible reCAPTCHA
 */
export async function sendFirebasePhoneOTP(rawPhone, recaptchaContainerId) {
  const auth = getFirebaseAuthInstance();
  if (!auth) {
    throw new Error('Frontend chưa cấu hình Firebase Phone Auth (VITE_FIREBASE_*).');
  }

  const e164Phone = toE164VNPhone(rawPhone);
  if (!e164Phone) {
    throw new Error('Số điện thoại phải là số di động Việt Nam hợp lệ (10 số, đầu 03/05/07/08/09).');
  }

  resetRecaptchaVerifier(recaptchaContainerId);
  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
    size: 'invisible'
  });
  verifierRegistry.set(recaptchaContainerId, verifier);

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, e164Phone, verifier);
    return confirmationResult;
  } catch (err) {
    resetRecaptchaVerifier(recaptchaContainerId);
    throw new Error(translateFirebasePhoneError(err));
  }
}

/**
 * Xác nhận mã OTP 6 số và lấy Firebase ID Token gửi về Backend auth-service kiểm chứng
 */
export async function confirmFirebasePhoneOTP(confirmationResult, otpCode) {
  if (!confirmationResult) {
    throw new Error('Phiên OTP chưa được khởi tạo. Vui lòng bấm Gửi OTP SMS.');
  }
  const cleanCode = String(otpCode || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Vui lòng nhập đủ 6 chữ số OTP từ tin nhắn SMS.');
  }

  try {
    const credential = await confirmationResult.confirm(cleanCode);
    const idToken = await credential.user.getIdToken(true);
    const phoneNumber = normalizeVNPhone(credential.user.phoneNumber || '');
    const uid = credential.user.uid;

    // Đăng xuất phiên client Firebase ngay để tránh lẫn state giữa các tài khoản FoodFast
    const auth = getFirebaseAuthInstance();
    if (auth) {
      await signOut(auth).catch(() => {});
    }

    return { idToken, phoneNumber, uid };
  } catch (err) {
    throw new Error(translateFirebasePhoneError(err));
  }
}

