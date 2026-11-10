const admin = require('firebase-admin');

let firebaseApp = null;
let initAttempted = false;

/**
 * Khởi tạo Firebase Admin SDK (singleton) từ biến môi trường:
 *  - FIREBASE_SERVICE_ACCOUNT_JSON: Chuỗi JSON Service Account từ Firebase Console
 *  - Hoặc cặp biến riêng: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
function ensureFirebaseAdminInitialized() {
  if (firebaseApp) return firebaseApp;
  if (admin.apps && admin.apps.length > 0) {
    firebaseApp = admin.apps[0];
    return firebaseApp;
  }
  if (initAttempted) return null;
  initAttempted = true;

  try {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      serviceAccount = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };
    }

    if (!serviceAccount) {
      return null;
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase Admin] ✅ Đã khởi tạo Firebase Admin SDK thành công!');
    return firebaseApp;
  } catch (error) {
    console.error('[Firebase Admin] ❌ Lỗi khởi tạo Firebase Admin SDK:', error.message);
    return null;
  }
}

function isFirebaseAdminConfigured() {
  return Boolean(ensureFirebaseAdminInitialized());
}

/**
 * Chuẩn hóa và kiểm tra định dạng SĐT di động Việt Nam (03/05/07/08/09 + 8 chữ số)
 * Chặn các SĐT sai định dạng, thiếu số, hoặc dãy toàn số 0.
 */
function normalizeVietnamPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, local: '', e164: '', reason: 'Số điện thoại không được để trống.' };
  }

  let cleaned = rawPhone.replace(/[\s().-]/g, '').trim();
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }

  if (!/^0(3|5|7|8|9)\d{8}$/.test(cleaned)) {
    return {
      valid: false,
      local: cleaned,
      e164: '',
      reason: 'Số điện thoại phải là số di động Việt Nam hợp lệ gồm 10 chữ số (đầu 03, 05, 07, 08 hoặc 09).'
    };
  }

  if (/^0+$/.test(cleaned)) {
    return { valid: false, local: cleaned, e164: '', reason: 'Số điện thoại không hợp lệ.' };
  }

  return {
    valid: true,
    local: cleaned,
    e164: '+84' + cleaned.slice(1),
    reason: ''
  };
}

/**
 * Xác thực Firebase ID Token được gửi từ client sau khi nhập mã SMS OTP
 */
async function verifyFirebasePhoneToken(idToken) {
  const app = ensureFirebaseAdminInitialized();
  if (!app) {
    const err = new Error('Máy chủ chưa cấu hình Firebase Admin SDK (FIREBASE_SERVICE_ACCOUNT_JSON hoặc FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY).');
    err.code = 'FIREBASE_NOT_CONFIGURED';
    throw err;
  }

  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('Thiếu mã Firebase ID Token xác thực SMS.');
    err.code = 'MISSING_TOKEN';
    throw err;
  }

  const decoded = await admin.auth(app).verifyIdToken(idToken, true);
  if (!decoded || !decoded.phone_number) {
    const err = new Error('Token Firebase không chứa số điện thoại đã xác thực SMS.');
    err.code = 'PHONE_CLAIM_MISSING';
    throw err;
  }

  const norm = normalizeVietnamPhone(decoded.phone_number);
  if (!norm.valid) {
    const err = new Error(norm.reason || 'Số điện thoại xác thực từ Firebase không hợp lệ.');
    err.code = 'INVALID_VN_PHONE';
    throw err;
  }

  return {
    uid: decoded.uid,
    localPhone: norm.local,
    e164Phone: norm.e164,
    provider: decoded.firebase?.sign_in_provider || 'phone'
  };
}

module.exports = {
  ensureFirebaseAdminInitialized,
  isFirebaseAdminConfigured,
  normalizeVietnamPhone,
  verifyFirebasePhoneToken
};

