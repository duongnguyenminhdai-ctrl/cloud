const { calculateMerchantSettlement } = require('../src/utils/settlementEngine');

describe('FoodFast Partner Settlement & Tax Withholding Engine', () => {
  test('Áp dụng Voucher Quán (STORE) cho Hộ Kinh Doanh: được giảm trừ doanh thu tính chiết khấu và thuế 1.5%', () => {
    const order = {
      originalTotal: 100000,
      voucherCode: 'QUANGIAM20',
      voucherIssuerType: 'STORE',
      storeVoucherDiscount: 20000,
      voucherDiscount: 20000
    };
    const store = {
      merchantType: 'HOUSEHOLD',
      commissionRate: 0.25
    };

    const res = calculateMerchantSettlement(order, store);

    expect(res.grossFoodTotal).toBe(100000);
    expect(res.storeVoucherDiscount).toBe(20000);
    expect(res.platformVoucherDiscount).toBe(0);
    // Giá sau giảm trừ Voucher Quán
    expect(res.taxableRevenue).toBe(80000);
    // Phí chiết khấu sàn 25% tính trên giá đã giảm (80k * 25% = 20k)
    expect(res.platformCommission).toBe(20000);
    // Tiền về Ví trước thuế = 80k - 20k = 60k
    expect(res.beforeTaxAmount).toBe(60000);
    // Thuế khấu trừ hộ Hộ KD (1% GTGT = 800đ, 0.5% TNCN = 400đ -> 1.200đ)
    expect(res.isTaxWithheld).toBe(true);
    expect(res.vatAmount).toBe(800);
    expect(res.pitAmount).toBe(400);
    expect(res.withholdingTax).toBe(1200);
    // Tiết kiệm 300đ tiền thuế & 5.000đ tiền chiết khấu do Voucher Quán được giảm trừ
    expect(res.taxSavedByStoreVoucher).toBe(300);
    expect(res.commissionSavedByStoreVoucher).toBe(5000);
    // Tiền thực nhận về Ví = 60.000 - 1.200 = 58.800đ
    expect(res.netMerchant).toBe(58800);
  });

  test('Áp dụng Voucher Sàn (PLATFORM) cho Hộ Kinh Doanh: Quán nhận đủ doanh thu gốc, Sàn tự bù tiền giảm', () => {
    const order = {
      originalTotal: 100000,
      voucherCode: 'FOODFAST20',
      voucherIssuerType: 'PLATFORM',
      platformVoucherDiscount: 20000,
      voucherDiscount: 20000
    };
    const store = {
      merchantType: 'HOUSEHOLD',
      commissionRate: 0.25
    };

    const res = calculateMerchantSettlement(order, store);

    expect(res.storeVoucherDiscount).toBe(0);
    expect(res.platformVoucherDiscount).toBe(20000);
    // Quán vẫn hưởng doanh thu gốc 100.000đ
    expect(res.taxableRevenue).toBe(100000);
    expect(res.platformCommission).toBe(25000);
    expect(res.beforeTaxAmount).toBe(75000);
    expect(res.withholdingTax).toBe(1500); // 1.5% của 100k
    expect(res.netMerchant).toBe(73500);
  });

  test('Doanh nghiệp (ENTERPRISE) có hóa đơn GTGT: Không bị khấu trừ thuế hộ (0%)', () => {
    const order = {
      originalTotal: 100000,
      voucherCode: 'QUANVIP20',
      voucherIssuerType: 'STORE',
      storeVoucherDiscount: 20000
    };
    const store = {
      merchantType: 'ENTERPRISE',
      commissionRate: 0.25
    };

    const res = calculateMerchantSettlement(order, store);

    expect(res.isTaxWithheld).toBe(false);
    expect(res.withholdingTax).toBe(0);
    expect(res.netMerchant).toBe(60000);
  });
});

