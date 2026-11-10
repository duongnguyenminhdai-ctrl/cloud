/**
 * FoodFast Partner Settlement & Tax Withholding Engine (Backend)
 * Áp dụng chuẩn quy tắc tài chính cho Hộ Kinh Doanh, Cá nhân và Doanh nghiệp trên sàn FoodFast.
 *
 * Công thức cốt lõi:
 * Tiền Quán Nhận = (Giá gốc món ăn - Giá trị Voucher của Quán) - Phí chiết khấu sàn - Thuế khấu trừ hộ (nếu có)
 */

const DEFAULT_COMMISSION_RATE = 0.25; // Chiết khấu sàn mặc định 25%
const HOUSEHOLD_VAT_RATE = 0.01; // 1% Thuế GTGT (Hộ kinh doanh / Cá nhân kinh doanh TMĐT)
const HOUSEHOLD_PIT_RATE = 0.005; // 0.5% Thuế TNCN (Hộ kinh doanh / Cá nhân kinh doanh TMĐT)

/**
 * Tính toán chi tiết bảng kê quyết toán & thuế cho một đơn hàng
 *
 * @param {Object} order - Dữ liệu đơn hàng
 * @param {Object} [store] - Thông tin quán (chứa merchantType, commissionRate)
 * @returns {Object} Chi tiết quyết toán
 */
function calculateMerchantSettlement(order = {}, store = {}) {
  const itemsTotal = Array.isArray(order.items)
    ? order.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
    : 0;

  // 1. Giá gốc món ăn trước khi trừ bất kỳ voucher/xu nào
  const grossFoodTotal = Math.max(0, Number(order.originalTotal) || itemsTotal || Number(order.totalPrice) || 0);

  // 2. Xác định nguồn tài trợ Voucher (STORE vs PLATFORM)
  const issuerType = order.voucherIssuerType || (order.storeVoucherDiscount > 0 ? 'STORE' : (order.voucherDiscount > 0 ? 'PLATFORM' : null));

  let storeVoucherDiscount = 0;
  let platformVoucherDiscount = 0;

  if (issuerType === 'STORE') {
    storeVoucherDiscount = Math.min(
      grossFoodTotal,
      Math.max(0, Number(order.storeVoucherDiscount ?? order.voucherDiscount) || 0)
    );
  } else if (issuerType === 'PLATFORM') {
    platformVoucherDiscount = Math.max(0, Number(order.platformVoucherDiscount ?? order.voucherDiscount) || 0);
  }

  // 3. Doanh thu sau khi trừ Voucher của Quán (= Doanh thu tính chiết khấu & Doanh thu tính thuế)
  // Theo quy định: Voucher Quán tự tài trợ ĐƯỢC GIẢM TRỪ thẳng vào doanh thu tính thuế
  const taxableRevenue = Math.max(0, grossFoodTotal - storeVoucherDiscount);

  // 4. Tỷ lệ chiết khấu sàn (Mặc định 25% hoặc theo hợp đồng của quán)
  const commissionRate = store?.commissionRate !== undefined && store?.commissionRate !== null
    ? Number(store.commissionRate)
    : DEFAULT_COMMISSION_RATE;

  const platformCommission = Math.round(taxableRevenue * commissionRate);

  // Số tiền quán nhận trước thuế (Khớp ví dụ: (100k - 20k) - (80k * 25%) = 60k)
  const beforeTaxAmount = Math.max(0, taxableRevenue - platformCommission);

  // 5. Thuế khấu trừ hộ TMĐT (Áp dụng cho Hộ kinh doanh HOUSEHOLD & Cá nhân INDIVIDUAL)
  const merchantType = store?.merchantType || 'HOUSEHOLD';
  const isTaxWithheld = merchantType === 'HOUSEHOLD' || merchantType === 'INDIVIDUAL';

  const vatRate = isTaxWithheld ? HOUSEHOLD_VAT_RATE : 0;
  const pitRate = isTaxWithheld ? HOUSEHOLD_PIT_RATE : 0;
  const totalTaxRate = vatRate + pitRate; // 1.5% cho Hộ kinh doanh

  const vatAmount = Math.round(taxableRevenue * vatRate);
  const pitAmount = Math.round(taxableRevenue * pitRate);
  const withholdingTax = vatAmount + pitAmount;

  // Tính số tiền thuế & chiết khấu mà Quán tiết kiệm được nhờ quy tắc giảm trừ Voucher Quán
  const taxSavedByStoreVoucher = isTaxWithheld ? Math.round(storeVoucherDiscount * (HOUSEHOLD_VAT_RATE + HOUSEHOLD_PIT_RATE)) : 0;
  const commissionSavedByStoreVoucher = Math.round(storeVoucherDiscount * commissionRate);

  // 6. Phí đóng gói (nếu quán có cấu hình thu)
  const packagingFee = Math.max(0, Number(order.packagingFee) || 0);

  // 7. Tiền Quán Thực Nhận về Ví FoodFast
  const netMerchant = Math.max(0, beforeTaxAmount - withholdingTax + packagingFee);

  return {
    grossFoodTotal,
    voucherCode: order.voucherCode || null,
    voucherIssuerType: issuerType,
    storeVoucherDiscount,
    platformVoucherDiscount,
    taxableRevenue,
    commissionRate,
    platformCommission,
    beforeTaxAmount,
    merchantType,
    isTaxWithheld,
    vatRate,
    pitRate,
    totalTaxRate,
    vatAmount,
    pitAmount,
    withholdingTax,
    taxSavedByStoreVoucher,
    commissionSavedByStoreVoucher,
    packagingFee,
    netMerchant
  };
}

module.exports = {
  DEFAULT_COMMISSION_RATE,
  HOUSEHOLD_VAT_RATE,
  HOUSEHOLD_PIT_RATE,
  calculateMerchantSettlement
};
