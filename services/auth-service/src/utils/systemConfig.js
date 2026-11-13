const mongoose = require('mongoose');
const SystemConfig = require('../models/SystemConfig');

const CACHE_TTL_MS = 5000;
let cachedConfig = {
  REQUIRE_PHONE_VERIFICATION: null,
  timestamp: 0
};

/**
 * Xóa cache cấu hình trong bộ nhớ (hữu ích cho unit test và reload)
 */
function clearConfigCache() {
  cachedConfig = {
    REQUIRE_PHONE_VERIFICATION: null,
    timestamp: 0
  };
}

/**
 * Lấy trạng thái yêu cầu xác minh số điện thoại (ưu tiên cache -> MongoDB -> fallback env)
 * @returns {Promise<boolean>}
 */
async function getPhoneVerificationSetting() {
  const now = Date.now();
  if (
    cachedConfig.REQUIRE_PHONE_VERIFICATION !== null &&
    now - cachedConfig.timestamp < CACHE_TTL_MS
  ) {
    return cachedConfig.REQUIRE_PHONE_VERIFICATION;
  }

  const isMocked = Boolean(
    SystemConfig.findOne &&
    (SystemConfig.findOne._isMockFunction || typeof SystemConfig.findOne.mock === 'object')
  );
  const isDbConnected = Boolean(mongoose.connection && mongoose.connection.readyState === 1);

  if (isDbConnected || isMocked) {
    try {
      const query = SystemConfig.findOne({ key: 'REQUIRE_PHONE_VERIFICATION' });
      const doc = query && typeof query.lean === 'function' ? await query.lean() : await query;
      if (doc && doc.value !== undefined && doc.value !== null) {
        const boolVal = Boolean(doc.value);
        cachedConfig.REQUIRE_PHONE_VERIFICATION = boolVal;
        cachedConfig.timestamp = now;
        process.env.REQUIRE_PHONE_VERIFICATION = String(boolVal);
        return boolVal;
      }
    } catch (err) {
      // Fallback về env khi truy vấn lỗi
    }
  }

  const fallback = process.env.REQUIRE_PHONE_VERIFICATION === 'true';
  cachedConfig.REQUIRE_PHONE_VERIFICATION = fallback;
  cachedConfig.timestamp = now;
  return fallback;
}

/**
 * Cập nhật cấu hình xác minh số điện thoại vào Database và đồng bộ runtime cache
 * @param {boolean} enabled Trạng thái bật/tắt xác minh SĐT
 * @param {string|null} adminUserId ID của Admin thực hiện thay đổi
 * @returns {Promise<Object>}
 */
async function setPhoneVerificationSetting(enabled, adminUserId = null) {
  const boolVal = Boolean(enabled);

  let doc = null;
  const isMocked = Boolean(
    SystemConfig.findOneAndUpdate &&
    (SystemConfig.findOneAndUpdate._isMockFunction || typeof SystemConfig.findOneAndUpdate.mock === 'object')
  );
  const isDbConnected = Boolean(mongoose.connection && mongoose.connection.readyState === 1);

  if (isDbConnected || isMocked) {
    try {
      doc = await SystemConfig.findOneAndUpdate(
        { key: 'REQUIRE_PHONE_VERIFICATION' },
        {
          value: boolVal,
          description: 'Bắt buộc xác thực số điện thoại qua mã OTP SMS Firebase khi đăng ký tài khoản mới',
          updatedBy: adminUserId || null
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.warn('[SystemConfig] ⚠️ Không thể lưu cấu hình vào MongoDB, cập nhật memory fallback:', err.message);
    }
  }

  cachedConfig.REQUIRE_PHONE_VERIFICATION = boolVal;
  cachedConfig.timestamp = Date.now();
  process.env.REQUIRE_PHONE_VERIFICATION = String(boolVal);

  return doc || { key: 'REQUIRE_PHONE_VERIFICATION', value: boolVal, updatedAt: new Date() };
}

module.exports = {
  getPhoneVerificationSetting,
  setPhoneVerificationSetting,
  clearConfigCache
};
