/**
 * FoodFast Partner Settlement & Tax Withholding Engine (Restaurant Service)
 * Áp dụng chuẩn quy tắc tài chính cho Hộ Kinh Doanh, Cá nhân và Doanh nghiệp trên sàn FoodFast.
 */

const DEFAULT_COMMISSION_RATE = 0.25;
const HOUSEHOLD_VAT_RATE = 0.01;
const HOUSEHOLD_PIT_RATE = 0.005;

function calculateMerchantSettlement(order = {}, store = {}) {
  const itemsTotal = Array.isArray(order.items)
    ? order.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
    : 0;

  const grossFoodTotal = Math.max(0, Number(order.originalTotal) || itemsTotal || Number(order.totalPrice) || 0);
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

  const taxableRevenue = Math.max(0, grossFoodTotal - storeVoucherDiscount);
  const commissionRate =
    store?.commissionRate !== undefined && store?.commissionRate !== null
      ? Number(store.commissionRate)
      : DEFAULT_COMMISSION_RATE;

  const platformCommission = Math.round(taxableRevenue * commissionRate);
  const beforeTaxAmount = Math.max(0, taxableRevenue - platformCommission);

  const merchantType = store?.merchantType || 'HOUSEHOLD';
  const isTaxWithheld = merchantType === 'HOUSEHOLD' || merchantType === 'INDIVIDUAL';

  const vatRate = isTaxWithheld ? HOUSEHOLD_VAT_RATE : 0;
  const pitRate = isTaxWithheld ? HOUSEHOLD_PIT_RATE : 0;
  const vatAmount = Math.round(taxableRevenue * vatRate);
  const pitAmount = Math.round(taxableRevenue * pitRate);
  const withholdingTax = vatAmount + pitAmount;

  const taxSavedByStoreVoucher = isTaxWithheld ? Math.round(storeVoucherDiscount * (HOUSEHOLD_VAT_RATE + HOUSEHOLD_PIT_RATE)) : 0;
  const commissionSavedByStoreVoucher = Math.round(storeVoucherDiscount * commissionRate);
  const packagingFee = Math.max(0, Number(order.packagingFee) || 0);
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
  calculateMerchantSettlement
};
