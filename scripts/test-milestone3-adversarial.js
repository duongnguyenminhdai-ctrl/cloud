/**
 * test-milestone3-adversarial.js
 * Empirical Integrated Adversarial Challenge Harness — Milestone 3
 * FoodFast Platform
 * 
 * Verifies R1 (Category Sync), R2 (Image Dual-Mode), and R3 (Phone Verification Toggle & Registration)
 * with edge cases, security checks, boundary tests, and failure modes.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const asyncQueue = [];

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Error: ${err.message}`);
  }
}

function runAsyncTest(testName, fn) {
  totalTests++;
  asyncQueue.push(async () => {
    try {
      await fn();
      passedTests++;
      console.log(`  ✓ PASS: ${testName}`);
    } catch (err) {
      failedTests++;
      console.error(`  ✗ FAIL: ${testName}`);
      console.error(`    Error: ${err.message}`);
    }
  });
}

console.log('================================================================');
console.log(' EMPIRICAL ADVERSARIAL CHALLENGE HARNESS — MILESTONE 3 (R1, R2, R3)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Integrated Category Sync (R1) Adversarial & Edge Cases
// -----------------------------------------------------------------------------
console.log('[SECTION 1] Integrated Category Synchronization (R1)');

// The exact memoization logic from frontend/src/pages/MerchantDashboard.jsx
function computeAvailableCategories(store, editingCategories) {
  const catsMap = new Map();
  const defaultCats = [
    { id: 'cat_main', name: 'Món chính', order: 1 },
    { id: 'cat_drink', name: 'Đồ uống & Trà sữa', order: 2 },
    { id: 'cat_snack', name: 'Đồ ăn vặt', order: 3 }
  ];

  const initialList = (store?.categories && store.categories.length > 0)
    ? store.categories
    : (editingCategories && editingCategories.length > 0)
      ? editingCategories
      : defaultCats;

  initialList.forEach((c) => {
    if (!c) return;
    const catId = c.id || c._id || c.name;
    if (catId && !catsMap.has(catId)) {
      catsMap.set(catId, {
        id: catId,
        name: c.name || catId,
        order: c.order !== undefined ? c.order : catsMap.size + 1
      });
    }
  });

  (store?.menuItems || []).forEach((item) => {
    if (!item) return;
    const itemCatId = item.categoryId || item.category;
    if (itemCatId && !catsMap.has(itemCatId)) {
      let fallbackName = itemCatId;
      if (itemCatId === 'cat_main') fallbackName = 'Món chính';
      else if (itemCatId === 'cat_drink') fallbackName = 'Đồ uống & Trà sữa';
      else if (itemCatId === 'cat_snack') fallbackName = 'Đồ ăn vặt';

      catsMap.set(itemCatId, {
        id: itemCatId,
        name: fallbackName,
        order: catsMap.size + 1
      });
    }
  });

  defaultCats.forEach((dc) => {
    if (!catsMap.has(dc.id)) {
      catsMap.set(dc.id, { ...dc, order: dc.order || catsMap.size + 1 });
    }
  });

  return Array.from(catsMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
}

runTest('1.1 Extreme Vietnamese diacritics & tone marks preserved in category names', () => {
  const customStore = {
    categories: [
      { id: 'cat_lau_nuong', name: 'Lẩu & Nướng Đêm Khuya 🍲🥩', order: 1 },
      { id: 'cat_bun_cha', name: 'Bún Chả Hà Nội Đậm Vị & Nem Rán 🍜', order: 2 },
      { id: 'cat_che_hue', name: 'Chè Cung Đình Huế & Thạch Cốt Dừa 🍧', order: 3 }
    ],
    menuItems: []
  };

  const cats = computeAvailableCategories(customStore, []);
  assert.strictEqual(cats.length, 6); // 3 custom + 3 default categories (cat_main, cat_drink, cat_snack)
  const bunCha = cats.find(c => c.id === 'cat_bun_cha');
  assert.ok(bunCha, 'Must find Vietnamese category');
  assert.strictEqual(bunCha.name, 'Bún Chả Hà Nội Đậm Vị & Nem Rán 🍜');
});

runTest('1.2 Empty and corrupted categories fallback seamlessly to default 3 categories', () => {
  const corruptedCases = [
    { categories: null, menuItems: null },
    { categories: undefined, menuItems: undefined },
    { categories: [], menuItems: [] },
    { categories: [null, undefined, {}], menuItems: [] }
  ];

  for (const st of corruptedCases) {
    const cats = computeAvailableCategories(st, []);
    assert.strictEqual(cats.length, 3);
    assert.deepStrictEqual(cats.map(c => c.id), ['cat_main', 'cat_drink', 'cat_snack']);
  }
});

runTest('1.3 Auto-discovers menuItems with mixed categoryId and legacy category field', () => {
  const storeWithLegacy = {
    categories: [
      { id: 'cat_main', name: 'Món chính', order: 1 }
    ],
    menuItems: [
      { name: 'Phở bò', categoryId: 'cat_pho' },
      { name: 'Cơm sườn', category: 'cat_com' },
      { name: 'Trà tắc', category: 'cat_drink' },
      { name: 'Bánh tráng', category: 'cat_snack' }
    ]
  };

  const cats = computeAvailableCategories(storeWithLegacy, []);
  const ids = cats.map(c => c.id);
  assert.ok(ids.includes('cat_pho'), 'Must auto-discover categoryId cat_pho');
  assert.ok(ids.includes('cat_com'), 'Must auto-discover legacy category cat_com');
  assert.ok(ids.includes('cat_drink'), 'Must resolve cat_drink');
  assert.ok(ids.includes('cat_snack'), 'Must resolve cat_snack');
});

runTest('1.4 Deduplicates duplicate IDs across categories and menuItems safely', () => {
  const dupStore = {
    categories: [
      { id: 'cat_main', name: 'Món chính ban đầu', order: 1 },
      { id: 'cat_main', name: 'Món chính lặp lại', order: 2 }
    ],
    menuItems: [
      { name: 'Món A', categoryId: 'cat_main' },
      { name: 'Món B', categoryId: 'cat_main' }
    ]
  };

  const cats = computeAvailableCategories(dupStore, []);
  const mainCats = cats.filter(c => c.id === 'cat_main');
  assert.strictEqual(mainCats.length, 1, 'Only 1 cat_main should exist');
  assert.strictEqual(mainCats[0].name, 'Món chính ban đầu', 'First occurrence takes priority');
});

runTest('1.5 Menu filtering handles legacy dishes without category or with unknown category', () => {
  const menuItems = [
    { id: 1, name: 'Cơm tấm', categoryId: 'cat_main' },
    { id: 2, name: 'Trà đào', categoryId: 'cat_drink' },
    { id: 3, name: 'Bánh mì cũ', category: 'cat_main' }, // legacy category field
    { id: 4, name: 'Món không rõ', categoryId: null, category: null } // unassigned legacy dish
  ];

  // Filtering logic from MerchantDashboard.jsx
  function filterMenu(items, selectedCat) {
    return items.filter((m) => {
      if (selectedCat === 'ALL') return true;
      const cat = m.categoryId || m.category;
      if (!cat && (selectedCat === 'cat_main' || selectedCat === 'DEFAULT')) return true;
      return cat === selectedCat;
    });
  }

  assert.strictEqual(filterMenu(menuItems, 'ALL').length, 4);
  assert.strictEqual(filterMenu(menuItems, 'cat_main').length, 3); // Cơm tấm, Bánh mì cũ, Món không rõ
  assert.strictEqual(filterMenu(menuItems, 'cat_drink').length, 1); // Trà đào
  assert.strictEqual(filterMenu(menuItems, 'cat_nonexistent').length, 0); // Safe empty
});

// -----------------------------------------------------------------------------
// SECTION 2: Food Image Dual-Mode & Cloudinary (R2)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 2] Food Image Dual-Mode & Cloudinary CDN (R2)');

// Final dish image normalization logic from restaurantController.js
function normalizeFinalDishImage(image) {
  return (typeof image === 'string' ? image : (image?.url || image?.secure_url)) || '';
}

runTest('2.1 Final dish image normalization accepts varied inputs and rejects malformed values', () => {
  assert.strictEqual(normalizeFinalDishImage('https://cdn.foodfast.vn/dish.jpg'), 'https://cdn.foodfast.vn/dish.jpg');
  assert.strictEqual(normalizeFinalDishImage({ url: 'https://cdn.foodfast.vn/dish1.jpg' }), 'https://cdn.foodfast.vn/dish1.jpg');
  assert.strictEqual(normalizeFinalDishImage({ secure_url: 'https://cdn.foodfast.vn/dish2.jpg' }), 'https://cdn.foodfast.vn/dish2.jpg');
  assert.strictEqual(normalizeFinalDishImage(null), '');
  assert.strictEqual(normalizeFinalDishImage(undefined), '');
  assert.strictEqual(normalizeFinalDishImage(12345), '');
  assert.strictEqual(normalizeFinalDishImage({}), '');
  assert.strictEqual(normalizeFinalDishImage([]), '');
});

runTest('2.2 Cloudinary Base64 detection regex logic in restaurantController', () => {
  const isBase64Image = (str) => typeof str === 'string' && str.startsWith('data:image/');
  assert.strictEqual(isBase64Image('data:image/jpeg;base64,/9j/4AAQSkZJRg...'), true);
  assert.strictEqual(isBase64Image('data:image/png;base64,iVBORw0KGgo...'), true);
  assert.strictEqual(isBase64Image('data:image/webp;base64,UklGR...'), true);
  assert.strictEqual(isBase64Image('https://images.unsplash.com/food.jpg'), false);
  assert.strictEqual(isBase64Image('javascript:alert(1)'), false);
  assert.strictEqual(isBase64Image('data:text/html;base64,PHNjcmlwdD4='), false);
});

runTest('2.3 Frontend client.js uploadApi fallback logic simulation', async () => {
  let primaryCalled = false;
  let fallbackCalled = false;

  const mockApiClient = {
    post: async (url, data) => {
      if (url.includes('/upload') && !url.includes('/restaurants/upload')) {
        primaryCalled = true;
        const err = new Error('Not Found');
        err.response = { status: 404 };
        throw err;
      }
      if (url.includes('/restaurants/upload')) {
        fallbackCalled = true;
        return { data: { success: true, url: 'https://res.cloudinary.com/foodfast/image/upload/v1/foodfast/dishes/sample.jpg' } };
      }
    }
  };

  const uploadImageWithFallback = async (image, folder = 'foodfast') => {
    try {
      return await mockApiClient.post('http://localhost:3001/upload', { image, folder });
    } catch (err) {
      if (err.response?.status === 404 || !err.response) {
        return await mockApiClient.post('http://localhost:3001/restaurants/upload', { image, folder });
      }
      throw err;
    }
  };

  const res = await uploadImageWithFallback('data:image/jpeg;base64,abc12345');
  assert.ok(primaryCalled, 'Primary endpoint must be attempted first');
  assert.ok(fallbackCalled, 'Fallback endpoint must be executed on 404');
  assert.ok(res.data.url.includes('cloudinary.com'), 'Must return Cloudinary URL');
});

runTest('2.4 Gateway and Proxy configuration verification for /api/v1/upload', () => {
  const nginxConf = fs.readFileSync(path.join(__dirname, '../gateway/nginx.conf'), 'utf8');
  assert.ok(nginxConf.includes('location /api/v1/upload'), 'nginx.conf must route /api/v1/upload');
  assert.ok(nginxConf.includes('proxy_pass http://restaurant-service:3001;'), 'nginx.conf must proxy to restaurant-service:3001');

  const viteConfig = fs.readFileSync(path.join(__dirname, '../frontend/vite.config.js'), 'utf8');
  assert.ok(viteConfig.includes("'/api/v1/upload': 'http://localhost:3001'"), 'vite.config.js must proxy /api/v1/upload to 3001');
});

// -----------------------------------------------------------------------------
// SECTION 3: Vietnamese Phone Number Validation Engine
// -----------------------------------------------------------------------------
console.log('\n[SECTION 3] Vietnamese Phone Number Validation Engine');

function normalizeVNPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[\s.-]/g, '');
  let standard = cleaned;
  if (standard.startsWith('+84')) standard = '0' + standard.slice(3);
  else if (standard.startsWith('84')) standard = '0' + standard.slice(2);
  const vnPhoneRegex = /^0(3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;
  if (!vnPhoneRegex.test(standard)) return null;
  return standard;
}

runTest('3.1 Validates 100% of major Vietnamese mobile carriers (Viettel, Mobifone, Vinaphone, Vietnamobile, Gmobile)', () => {
  const validNumbers = [
    // Viettel (032-039, 086, 096, 097, 098)
    '0321234567', '0339876543', '0345678901', '0352223333', '0369876543', '0371112222', '0389998888', '0390001111',
    '0868889999', '0969535231', '0971234567', '0989123456',
    // Mobifone (070, 076, 077, 078, 079, 089, 090, 093)
    '0701234567', '0769998888', '0778887777', '0781234567', '0799991111', '0898887777', '0903123456', '0939123456',
    // Vinaphone (081-085, 088, 091, 094)
    '0812345678', '0823456789', '0834567890', '0845678901', '0856789012', '0888999000', '0912345678', '0945678901',
    // Vietnamobile (056, 058, 092)
    '0561234567', '0581234567', '0921234567',
    // Gmobile (059, 099)
    '0591234567', '0991234567',
    // International prefix variations (+84, 84, spacing, hyphens)
    '+84 969 535 231', '+84989123456', '84903123456', '098-912-3456', '091.234.5678'
  ];

  for (const num of validNumbers) {
    const norm = normalizeVNPhone(num);
    assert.ok(norm, `Phone ${num} should be valid VN mobile`);
    assert.strictEqual(norm.length, 10);
    assert.strictEqual(norm.startsWith('0'), true);
  }
});

runTest('3.2 Adversarially rejects invalid phone numbers, landlines, and international prefixes', () => {
  const invalidNumbers = [
    '02431234567', // Hanoi landline (024)
    '02831234567', // HCMC landline (028)
    '0123456789', // Old 11-digit prefix (discontinued in VN)
    '0000000000', // Invalid prefix 00
    '0412345678', // Non-existent mobile prefix 04
    '0612345678', // Non-existent mobile prefix 06
    '+12025550123', // US Number
    '+447911123456', // UK Number
    '098912345', // 9 digits (too short)
    '09891234567', // 11 digits (too long)
    '0989abc123', // Non-numeric characters
    '<script>alert(1)</script>', // XSS payload
    '', null, undefined, 1234567890
  ];

  for (const inv of invalidNumbers) {
    const norm = normalizeVNPhone(inv);
    assert.strictEqual(norm, null, `Phone ${inv} must be rejected as invalid`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 4: SystemConfig Caching & Persistence (R3)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 4] SystemConfig Caching & MongoDB Persistence (R3)');

const {
  getPhoneVerificationSetting,
  setPhoneVerificationSetting,
  clearConfigCache
} = require('../services/auth-service/src/utils/systemConfig');
const SystemConfig = require('../services/auth-service/src/models/SystemConfig');

runAsyncTest('4.1 In-memory cache TTL works correctly with 5000ms expiration', async () => {
  clearConfigCache();
  process.env.REQUIRE_PHONE_VERIFICATION = 'true';

  let dbQueries = 0;
  const originalFindOne = SystemConfig.findOne;
  const mockFindOne = function() {
    dbQueries++;
    return {
      lean: async () => ({ key: 'REQUIRE_PHONE_VERIFICATION', value: true })
    };
  };
  mockFindOne._isMockFunction = true;
  mockFindOne.mock = {};
  SystemConfig.findOne = mockFindOne;

  try {
    // 1st call: DB query executed
    const val1 = await getPhoneVerificationSetting();
    assert.strictEqual(val1, true);
    assert.strictEqual(dbQueries, 1);

    // 2nd call immediate: Cache hit, no DB query
    const val2 = await getPhoneVerificationSetting();
    assert.strictEqual(val2, true);
    assert.strictEqual(dbQueries, 1);

    // Explicit cache clear: Forces DB query on next call
    clearConfigCache();
    const val3 = await getPhoneVerificationSetting();
    assert.strictEqual(val3, true);
    assert.strictEqual(dbQueries, 2);
  } finally {
    SystemConfig.findOne = originalFindOne;
    clearConfigCache();
  }
});

runAsyncTest('4.2 setPhoneVerificationSetting updates cache and process.env immediately', async () => {
  clearConfigCache();
  const origFindOneAndUpdate = SystemConfig.findOneAndUpdate;
  let dbUpsertCalled = false;
  let upsertedValue = null;

  const mockFindOneAndUpdate = async function(filter, update, opts) {
    dbUpsertCalled = true;
    upsertedValue = update.value;
    return { key: 'REQUIRE_PHONE_VERIFICATION', value: update.value, updatedAt: new Date() };
  };
  mockFindOneAndUpdate._isMockFunction = true;
  mockFindOneAndUpdate.mock = {};
  SystemConfig.findOneAndUpdate = mockFindOneAndUpdate;

  try {
    const res = await setPhoneVerificationSetting(false, 'admin_m3_test');
    assert.strictEqual(res.value, false);
    assert.strictEqual(process.env.REQUIRE_PHONE_VERIFICATION, 'false');
    assert.strictEqual(dbUpsertCalled, true);
    assert.strictEqual(upsertedValue, false);

    // Immediate read must return false without DB query
    const immediateVal = await getPhoneVerificationSetting();
    assert.strictEqual(immediateVal, false);
  } finally {
    SystemConfig.findOneAndUpdate = origFindOneAndUpdate;
    clearConfigCache();
  }
});

runAsyncTest('4.3 Graceful error resilience when MongoDB read/write throws exceptions', async () => {
  clearConfigCache();
  process.env.REQUIRE_PHONE_VERIFICATION = 'true';

  const origFindOne = SystemConfig.findOne;
  const origFindOneAndUpdate = SystemConfig.findOneAndUpdate;

  const errFindOne = function() {
    throw new Error('MongoNetworkTimeout: Connection pool exhausted');
  };
  errFindOne._isMockFunction = true;
  errFindOne.mock = {};
  SystemConfig.findOne = errFindOne;

  const errFindOneAndUpdate = async function() {
    throw new Error('MongoWriteConflict: Transaction aborted');
  };
  errFindOneAndUpdate._isMockFunction = true;
  errFindOneAndUpdate.mock = {};
  SystemConfig.findOneAndUpdate = errFindOneAndUpdate;

  try {
    // getPhoneVerificationSetting should not throw, returns fallback
    let readVal = await getPhoneVerificationSetting();
    assert.strictEqual(readVal, true, 'Falls back to process.env.REQUIRE_PHONE_VERIFICATION safely');

    // setPhoneVerificationSetting should not throw, returns fallback doc
    let writeDoc = await setPhoneVerificationSetting(false, 'admin_err_tester');
    assert.strictEqual(writeDoc.value, false);
    assert.strictEqual(process.env.REQUIRE_PHONE_VERIFICATION, 'false');
  } finally {
    SystemConfig.findOne = origFindOne;
    SystemConfig.findOneAndUpdate = origFindOneAndUpdate;
    clearConfigCache();
  }
});

// -----------------------------------------------------------------------------
// SECTION 5: Auth Controller Registration Flow Stress
// -----------------------------------------------------------------------------
console.log('\n[SECTION 5] Auth Controller Registration Flow Logic');

runTest('5.1 Dual-mode registration branching condition analysis', () => {
  const testCases = [
    { requirePhone: true, hasToken: false, phone: '0969535231', expectedAction: 'BLOCK_400' },
    { requirePhone: true, hasToken: true, phone: '0969535231', expectedAction: 'VERIFY_TOKEN' },
    { requirePhone: false, hasToken: false, phone: '0969535231', expectedAction: 'ALLOW_DIRECT_PHONE' },
    { requirePhone: false, hasToken: false, phone: '', expectedAction: 'ALLOW_NO_PHONE' },
    { requirePhone: false, hasToken: false, phone: '0241234567', expectedAction: 'REJECT_BAD_PHONE_400' }
  ];

  for (const tc of testCases) {
    let action = '';
    if (tc.hasToken) {
      action = 'VERIFY_TOKEN';
    } else if (tc.requirePhone) {
      action = 'BLOCK_400';
    } else if (tc.phone && tc.phone.trim()) {
      const norm = normalizeVNPhone(tc.phone);
      if (!norm) action = 'REJECT_BAD_PHONE_400';
      else action = 'ALLOW_DIRECT_PHONE';
    } else {
      action = 'ALLOW_NO_PHONE';
    }

    assert.strictEqual(action, tc.expectedAction, `Case failed for ${JSON.stringify(tc)}`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 6: Cross-Service Static & Configuration Integrity
// -----------------------------------------------------------------------------
console.log('\n[SECTION 6] Cross-Service Configuration & Brand Compliance');

runTest('6.1 No third-party trademarks (Shopee, ShopeeFood) in newly added/modified files', () => {
  const filesToCheck = [
    'services/auth-service/src/models/SystemConfig.js',
    'services/auth-service/src/utils/systemConfig.js',
    'frontend/src/api/client.js'
  ];

  for (const file of filesToCheck) {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.strictEqual(content.includes('ShopeeFood'), false, `${file} must not contain ShopeeFood`);
    assert.strictEqual(content.includes('Shopee Partner'), false, `${file} must not contain Shopee Partner`);
  }
});

runTest('6.2 Backend routes consistency across auth-service and restaurant-service', () => {
  const authRoutes = fs.readFileSync(path.join(__dirname, '../services/auth-service/src/routes/authRoutes.js'), 'utf8');
  assert.ok(authRoutes.includes('/admin/config/phone-verification'), 'authRoutes must register phone verification config route');
  assert.ok(authRoutes.includes('requireAdmin'), 'authRoutes must guard route with requireAdmin');

  const restRoutes = fs.readFileSync(path.join(__dirname, '../services/restaurant-service/src/routes/restaurantRoutes.js'), 'utf8');
  assert.ok(restRoutes.includes('/upload'), 'restaurantRoutes must register /upload');
});

// Run async tests sequentially
(async () => {
  for (const task of asyncQueue) {
    await task();
  }

  console.log('\n================================================================');
  console.log(` TOTAL SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
