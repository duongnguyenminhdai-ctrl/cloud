/**
 * FoodFast Partner Settlement & Tax Withholding Engine (Frontend)
 * Đồng bộ 100% với thuật toán quyết toán phía Order Service & Restaurant Service.
 *
 * Công thức:
 * Tiền Quán Nhận = (Giá gốc món ăn - Giá trị Voucher của Quán) - Phí chiết khấu sàn - Thuế khấu trừ hộ (nếu có)
 *
 * Lưu ý cho Hộ kinh doanh (HOUSEHOLD) & Cá nhân (INDIVIDUAL):
 * - Thuế GTGT 1% + Thuế TNCN 0.5% = 1.5% được tính trên Doanh thu sau khi ĐÃ TRỪ Voucher của Quán (được giảm trừ doanh thu tính thuế).
 * - Nếu khách dùng Voucher Sàn FoodFast (PLATFORM), Sàn tự bù tiền, Quán vẫn giữ nguyên doanh thu gốc.
 */

export const DEFAULT_COMMISSION_RATE = 0.25; // 25%
export const HOUSEHOLD_VAT_RATE = 0.01; // 1.0% GTGT
export const HOUSEHOLD_PIT_RATE = 0.005; // 0.5% TNCN
export const HOUSEHOLD_TOTAL_TAX_RATE = 0.015; // 1.5% Tổng thuế khấu trừ hộ TMĐT

export const MERCHANT_TYPE_LABELS = {
  HOUSEHOLD: 'Hộ kinh doanh (Khấu trừ thuế hộ 1.5%)',
  INDIVIDUAL: 'Cá nhân tự doanh (Khấu trừ thuế hộ 1.5%)',
  ENTERPRISE: 'Doanh nghiệp (Tự kê khai VAT - 0% khấu trừ hộ)'
};

/**
 * Tính toán chi tiết bảng kê quyết toán & thuế cho một đơn hàng
 *
 * @param {Object} order - Dữ liệu đơn hàng
 * @param {Object} [store] - Thông tin cửa hàng
 * @returns {Object} Bảng kê quyết toán
 */
export function calculateMerchantSettlement(order = {}, store = {}) {
  const itemsTotal = Array.isArray(order.items)
    ? order.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
    : 0;

  // 1. Giá gốc món ăn
  const grossFoodTotal = Math.max(0, Number(order.originalTotal) || itemsTotal || Number(order.totalPrice) || 0);

  // 2. Phân tách Voucher Quán vs Voucher Sàn FoodFast
  const issuerType =
    order.voucherIssuerType ||
    (order.storeVoucherDiscount > 0 ? 'STORE' : order.voucherDiscount > 0 ? 'PLATFORM' : null);

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

  // 3. Doanh thu sau giảm giá (Doanh thu tính chiết khấu & tính thuế)
  const taxableRevenue = Math.max(0, grossFoodTotal - storeVoucherDiscount);

  // 4. Chiết khấu sàn (Mặc định 25%)
  const commissionRate =
    store?.commissionRate !== undefined && store?.commissionRate !== null
      ? Number(store.commissionRate)
      : DEFAULT_COMMISSION_RATE;

  const platformCommission = Math.round(taxableRevenue * commissionRate);
  const beforeTaxAmount = Math.max(0, taxableRevenue - platformCommission);

  // 5. Thuế khấu trừ hộ (1% GTGT + 0.5% TNCN cho Hộ kinh doanh / Cá nhân)
  const merchantType = store?.merchantType || 'HOUSEHOLD';
  const isTaxWithheld = merchantType === 'HOUSEHOLD' || merchantType === 'INDIVIDUAL';

  const vatRate = isTaxWithheld ? HOUSEHOLD_VAT_RATE : 0;
  const pitRate = isTaxWithheld ? HOUSEHOLD_PIT_RATE : 0;
  const totalTaxRate = vatRate + pitRate;

  const vatAmount = Math.round(taxableRevenue * vatRate);
  const pitAmount = Math.round(taxableRevenue * pitRate);
  const withholdingTax = vatAmount + pitAmount;

  const taxSavedByStoreVoucher = isTaxWithheld ? Math.round(storeVoucherDiscount * HOUSEHOLD_TOTAL_TAX_RATE) : 0;
  const commissionSavedByStoreVoucher = Math.round(storeVoucherDiscount * commissionRate);

  // 6. Phí đóng gói (nếu có)
  const packagingFee = Math.max(0, Number(order.packagingFee) || 0);

  // 7. Số tiền thực nhận về Ví
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

/**
 * Mô phỏng nhanh lợi nhuận dự kiến khi chủ quán tạo Voucher khuyến mãi riêng
 * Dùng trong Modal Tạo Voucher để đưa ra gợi ý "Giá trị đơn hàng tối thiểu" bảo vệ biên lợi nhuận.
 */
export function simulateMerchantVoucher({
  orderAmount,
  discountType = 'FIXED_AMOUNT',
  discountValue = 0,
  maxDiscountAmount = null,
  minOrderValue = 0,
  commissionRate = DEFAULT_COMMISSION_RATE,
  merchantType = 'HOUSEHOLD'
}) {
  const sampleOrderTotal = Math.max(0, Number(orderAmount) || Number(minOrderValue) || 100000);
  let voucherDiscount = 0;

  if (discountType === 'PERCENTAGE') {
    voucherDiscount = Math.round((sampleOrderTotal * (Number(discountValue) || 0)) / 100);
    if (maxDiscountAmount && Number(maxDiscountAmount) > 0) {
      voucherDiscount = Math.min(voucherDiscount, Number(maxDiscountAmount));
    }
  } else {
    voucherDiscount = Number(discountValue) || 0;
  }

  voucherDiscount = Math.min(sampleOrderTotal, Math.max(0, voucherDiscount));

  return calculateMerchantSettlement(
    {
      originalTotal: sampleOrderTotal,
      voucherIssuerType: 'STORE',
      storeVoucherDiscount: voucherDiscount,
      voucherDiscount
    },
    {
      merchantType,
      commissionRate
    }
  );
}

