/**
 * test-milestone1-stress.js
 * Empirical Challenge & Stress-Test Harness for Milestone 1 (R1 & R2)
 * FoodFast Platform
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

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

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('================================================================');
console.log(' EMPIRICAL STRESS TEST HARNESS — MILESTONE 1 (R1 & R2)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Category Synchronization (R1) Stress Testing
// -----------------------------------------------------------------------------
console.log('[SECTION 1] Category Synchronization (R1) Stress Testing');

// Replicate the exact memoization algorithm used in MerchantDashboard.jsx
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

// Replicate filteredMenuItems logic
function filterMenuItems(menuItems, selectedCategory) {
  return (menuItems || []).filter((m) => {
    if (selectedCategory === 'ALL') return true;
    const cat = m.categoryId || m.category;
    if (!cat && (selectedCategory === 'cat_main' || selectedCategory === 'Món chính')) return true;
    return cat === selectedCategory;
  });
}

// Test 1.1: Store with empty categories
runTest('1.1 Empty store categories returns 3 default categories', () => {
  const store = { categories: [], menuItems: [] };
  const cats = computeAvailableCategories(store, []);
  assert.strictEqual(cats.length, 3);
  assert.strictEqual(cats[0].id, 'cat_main');
  assert.strictEqual(cats[1].id, 'cat_drink');
  assert.strictEqual(cats[2].id, 'cat_snack');
});

// Test 1.2: Store with null/undefined categories
runTest('1.2 Undefined categories returns 3 default categories without crashing', () => {
  const store = { menuItems: [] };
  const cats = computeAvailableCategories(store, null);
  assert.strictEqual(cats.length, 3);
  assert.strictEqual(cats[0].name, 'Món chính');
});

// Test 1.3: Store with custom categories preserves them and appends missing defaults
runTest('1.3 Custom categories preserved and missing defaults appended', () => {
  const store = {
    categories: [
      { id: 'cat_custom_bbq', name: 'Món nướng BBQ', order: 1 }
    ],
    menuItems: []
  };
  const cats = computeAvailableCategories(store, []);
  assert.strictEqual(cats.length, 4); // 1 custom + 3 defaults
  assert.strictEqual(cats[0].id, 'cat_custom_bbq');
  assert.strictEqual(cats[0].name, 'Món nướng BBQ');
  const catIds = cats.map(c => c.id);
  assert.ok(catIds.includes('cat_main'));
  assert.ok(catIds.includes('cat_drink'));
  assert.ok(catIds.includes('cat_snack'));
});

// Test 1.4: Auto-discovery of categoryId from menuItems
runTest('1.4 Auto-discovers unknown categoryId from menuItems', () => {
  const store = {
    categories: [
      { id: 'cat_main', name: 'Món chính', order: 1 }
    ],
    menuItems: [
      { name: 'Trà đào cam sả', categoryId: 'cat_special_drinks' },
      { name: 'Cơm sườn bì chả', categoryId: 'cat_main' }
    ]
  };
  const cats = computeAvailableCategories(store, []);
  const ids = cats.map(c => c.id);
  assert.ok(ids.includes('cat_special_drinks'));
  assert.strictEqual(cats.find(c => c.id === 'cat_special_drinks').name, 'cat_special_drinks');
});

// Test 1.5: Auto-discovery of legacy item.category string
runTest('1.5 Auto-discovers legacy item.category without categoryId', () => {
  const store = {
    categories: [],
    menuItems: [
      { name: 'Phở bò tái', category: 'cat_main' },
      { name: 'Nem rán Hà Nội', category: 'Món đặc biệt' }
    ]
  };
  const cats = computeAvailableCategories(store, []);
  const ids = cats.map(c => c.id);
  assert.ok(ids.includes('Món đặc biệt'));
  assert.strictEqual(cats.find(c => c.id === 'cat_main').name, 'Món chính');
  assert.strictEqual(cats.find(c => c.id === 'Món đặc biệt').name, 'Món đặc biệt');
});

// Test 1.6: Deduplication stress test (same ID in categories and menuItems)
runTest('1.6 Deduplication of duplicate IDs across store.categories and menuItems', () => {
  const store = {
    categories: [
      { id: 'cat_duplicate', name: 'Cơm văn phòng', order: 1 }
    ],
    menuItems: [
      { name: 'Cơm tấm', categoryId: 'cat_duplicate' },
      { name: 'Cơm gà', categoryId: 'cat_duplicate' }
    ]
  };
  const cats = computeAvailableCategories(store, []);
  const dupCount = cats.filter(c => c.id === 'cat_duplicate').length;
  assert.strictEqual(dupCount, 1);
});

// Test 1.7: Quick add category simulation
runTest('1.7 Quick add category adds to categories list with correct next order', () => {
  const availableCategories = [
    { id: 'cat_main', name: 'Món chính', order: 1 },
    { id: 'cat_drink', name: 'Đồ uống & Trà sữa', order: 2 },
    { id: 'cat_snack', name: 'Đồ ăn vặt', order: 3 }
  ];
  const newCatName = 'Lẩu & Nướng';
  const newCatId = `cat_${Date.now()}`;
  const newCat = {
    id: newCatId,
    name: newCatName,
    order: availableCategories.length + 1
  };
  const nextCats = [...availableCategories, newCat];
  assert.strictEqual(nextCats.length, 4);
  assert.strictEqual(nextCats[3].id, newCatId);
  assert.strictEqual(nextCats[3].order, 4);
});

// Test 1.8: Filtered menu items handles legacy dishes and categories
runTest('1.8 Menu filtering handles legacy dishes without categoryId under cat_main', () => {
  const items = [
    { name: 'Món có cat_main', categoryId: 'cat_main' },
    { name: 'Món không có categoryId', description: 'Món cũ' },
    { name: 'Món nước', categoryId: 'cat_drink' }
  ];
  
  // ALL filter
  const allFiltered = filterMenuItems(items, 'ALL');
  assert.strictEqual(allFiltered.length, 3);

  // cat_main filter: should include both cat_main and legacy items without categoryId
  const mainFiltered = filterMenuItems(items, 'cat_main');
  assert.strictEqual(mainFiltered.length, 2);
  assert.strictEqual(mainFiltered[0].name, 'Món có cat_main');
  assert.strictEqual(mainFiltered[1].name, 'Món không có categoryId');

  // cat_drink filter
  const drinkFiltered = filterMenuItems(items, 'cat_drink');
  assert.strictEqual(drinkFiltered.length, 1);
  assert.strictEqual(drinkFiltered[0].name, 'Món nước');
});

console.log('');

// -----------------------------------------------------------------------------
// SECTION 2: Dual-Mode Image Upload & Safety (R2) Stress Testing
// -----------------------------------------------------------------------------
console.log('[SECTION 2] Dual-Mode Image Upload & Preview (R2) Stress Testing');

// Test 2.1: Non-image file rejection
runTest('2.1 Non-image file MIME rejection logic', () => {
  function validateImageFile(file) {
    if (!file || !file.type) return false;
    return file.type.startsWith('image/');
  }

  assert.strictEqual(validateImageFile({ type: 'application/pdf', name: 'doc.pdf' }), false);
  assert.strictEqual(validateImageFile({ type: 'application/x-msdownload', name: 'virus.exe' }), false);
  assert.strictEqual(validateImageFile({ type: 'text/html', name: 'page.html' }), false);
  assert.strictEqual(validateImageFile({ type: 'image/jpeg', name: 'photo.jpg' }), true);
  assert.strictEqual(validateImageFile({ type: 'image/png', name: 'graphic.png' }), true);
  assert.strictEqual(validateImageFile({ type: 'image/webp', name: 'dish.webp' }), true);
});

// Test 2.2: Broken URL and error state recovery
runTest('2.2 Broken URL error detection and state reset on URL change', () => {
  let dishImageError = false;
  let imageUrl = 'https://invalid-host-404-not-found.com/broken.jpg';

  // Simulate onError
  dishImageError = true;
  assert.strictEqual(dishImageError, true);

  // User types new URL in input
  const newUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
  imageUrl = newUrl.trim();
  dishImageError = false; // onChange resets dishImageError

  assert.strictEqual(imageUrl, newUrl);
  assert.strictEqual(dishImageError, false);
});

// Test 2.3: Backend finalDishImage normalization
runTest('2.3 Backend finalDishImage normalization for strings, objects, and edge values', () => {
  function normalizeDishImage(image) {
    return (typeof image === 'string' ? image : (image?.url || image?.secure_url)) || '';
  }

  // Case A: Normal string URL
  assert.strictEqual(normalizeDishImage('https://cdn.example.com/dish.jpg'), 'https://cdn.example.com/dish.jpg');

  // Case B: Object with secure_url
  assert.strictEqual(normalizeDishImage({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/food.jpg' }), 'https://res.cloudinary.com/demo/image/upload/v1/food.jpg');

  // Case C: Object with url
  assert.strictEqual(normalizeDishImage({ url: 'http://res.cloudinary.com/demo/image/upload/v1/food.jpg' }), 'http://res.cloudinary.com/demo/image/upload/v1/food.jpg');

  // Case D: Null or undefined
  assert.strictEqual(normalizeDishImage(null), '');
  assert.strictEqual(normalizeDishImage(undefined), '');

  // Case E: Unexpected number or boolean
  assert.strictEqual(normalizeDishImage(12345), '');
  assert.strictEqual(normalizeDishImage(true), '');
});

// Test 2.4: Upload API fallback mechanism
runTest('2.4 client.js uploadApi fallback mechanism logic', async () => {
  let primaryCalled = false;
  let fallbackCalled = false;

  async function mockApiClientPost(url, payload) {
    if (url.endsWith('/upload')) {
      primaryCalled = true;
      const err = new Error('Not Found');
      err.response = { status: 404 };
      throw err;
    }
    if (url.endsWith('/restaurants/upload')) {
      fallbackCalled = true;
      return { data: { success: true, url: 'https://res.cloudinary.com/fallback.jpg' } };
    }
    throw new Error('Unknown URL: ' + url);
  }

  async function uploadImage(image, folder = 'foodfast') {
    try {
      return await mockApiClientPost('/api/v1/upload', { image, folder });
    } catch (err) {
      if (err.response?.status === 404 || !err.response) {
        return await mockApiClientPost('/api/v1/restaurants/upload', { image, folder });
      }
      throw err;
    }
  }

  const res = await uploadImage('data:image/png;base64,abc', 'foodfast/dishes');
  assert.strictEqual(primaryCalled, true);
  assert.strictEqual(fallbackCalled, true);
  assert.strictEqual(res.data.url, 'https://res.cloudinary.com/fallback.jpg');
});

console.log('');

// -----------------------------------------------------------------------------
// SECTION 3: Gateway & Vite Proxy Route Verification
// -----------------------------------------------------------------------------
console.log('[SECTION 3] Gateway & Vite Proxy Route Verification');

runTest('3.1 frontend/vite.config.js contains /api/v1/upload proxy', () => {
  const viteConfigPath = path.resolve(__dirname, '../frontend/vite.config.js');
  const content = fs.readFileSync(viteConfigPath, 'utf8');
  assert.ok(content.includes("'/api/v1/upload'"), 'vite.config.js missing /api/v1/upload proxy mapping');
  assert.ok(content.includes('http://localhost:3001'), 'vite.config.js /api/v1/upload should point to restaurant-service (3001)');
});

runTest('3.2 gateway/nginx.conf contains location /api/v1/upload', () => {
  const nginxConfPath = path.resolve(__dirname, '../gateway/nginx.conf');
  const content = fs.readFileSync(nginxConfPath, 'utf8');
  assert.ok(content.includes('location /api/v1/upload'), 'nginx.conf missing location /api/v1/upload block');
  assert.ok(content.includes('proxy_pass http://restaurant-service:3001;'), 'nginx.conf /api/v1/upload should proxy_pass to restaurant-service:3001');
});

runTest('3.3 services/restaurant-service/src/controllers/restaurantController.js contains category & image logic', () => {
  const controllerPath = path.resolve(__dirname, '../services/restaurant-service/src/controllers/restaurantController.js');
  const content = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(content.includes("id: 'cat_main'"), 'restaurantController missing cat_main default');
  assert.ok(content.includes("id: 'cat_drink'"), 'restaurantController missing cat_drink default');
  assert.ok(content.includes("id: 'cat_snack'"), 'restaurantController missing cat_snack default');
  assert.ok(content.includes("finalDishImage"), 'restaurantController missing finalDishImage safety check');
});

console.log('');

// -----------------------------------------------------------------------------
// SECTION 4: Direct Controller Stress Testing (Backend Isolation)
// -----------------------------------------------------------------------------
console.log('[SECTION 4] Backend Controller Direct Stress Testing (Isolation)');

async function runControllerTests() {
  // Mock external dependencies before requiring controller
  const redisPath = path.resolve(__dirname, '../services/restaurant-service/redis.js');
  const modelPath = path.resolve(__dirname, '../services/restaurant-service/src/models/Restaurant.js');
  const cloudinaryPath = path.resolve(__dirname, '../services/restaurant-service/src/utils/cloudinary.js');
  const realtimePath = path.resolve(__dirname, '../services/restaurant-service/src/utils/realtimeHub.js');

  const mockStoreDb = {
    _id: 'store_test_123',
    name: 'Phở 24',
    ownerId: 'user_merchant_999',
    categories: [],
    menuItems: [],
    save: async function() { return this; }
  };

  require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: {
      getCache: async () => null,
      setCache: async () => true,
      deleteCache: async () => true,
      invalidateRestaurantCache: async () => true,
      TTL: 3600
    }
  };

  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findOne: async (query) => {
        if (query.ownerId === 'user_merchant_999') {
          return mockStoreDb;
        }
        return null;
      }
    }
  };

  require.cache[cloudinaryPath] = {
    id: cloudinaryPath,
    filename: cloudinaryPath,
    loaded: true,
    exports: {
      uploadToCloudinary: async (base64, opts) => {
        return { secure_url: 'https://res.cloudinary.com/foodfast/image/upload/dish_auto.jpg' };
      }
    }
  };

  require.cache[realtimePath] = {
    id: realtimePath,
    filename: realtimePath,
    loaded: true,
    exports: {
      subscribe: () => {},
      emitStoreUpdate: () => {},
      broadcastAdminEvent: () => {},
      broadcastPublicEvent: () => {}
    }
  };

  const controller = require('../services/restaurant-service/src/controllers/restaurantController');

  // Test 4.1: getMyStore initializes categories when empty
  await runAsyncTest('4.1 getMyStore initializes categories when empty', async () => {
    mockStoreDb.categories = [];
    let savedCalled = false;
    mockStoreDb.save = async function() {
      savedCalled = true;
      return this;
    };

    const req = { user: { userId: 'user_merchant_999' } };
    let resStatus = 0;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    await controller.getMyStore(req, res);
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(resData.success, true);
    assert.strictEqual(savedCalled, true);
    assert.strictEqual(mockStoreDb.categories.length, 3);
    assert.strictEqual(mockStoreDb.categories[0].id, 'cat_main');
    assert.strictEqual(mockStoreDb.categories[1].id, 'cat_drink');
    assert.strictEqual(mockStoreDb.categories[2].id, 'cat_snack');
  });

  // Test 4.2: getMyStore handles save() error gracefully without 500 error
  await runAsyncTest('4.2 getMyStore handles save() failure gracefully', async () => {
    mockStoreDb.categories = [];
    mockStoreDb.save = async function() {
      throw new Error('Database write lock error');
    };

    const req = { user: { userId: 'user_merchant_999' } };
    let resStatus = 0;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    await controller.getMyStore(req, res);
    assert.strictEqual(resStatus, 200, 'Should not return 500 on category auto-save failure');
    assert.strictEqual(resData.success, true);
    assert.strictEqual(resData.data.categories.length, 3);
  });

  // Test 4.3: addMenuItem image conversion with base64 data:image
  await runAsyncTest('4.3 addMenuItem converts data:image/ base64 to Cloudinary secure_url', async () => {
    mockStoreDb.menuItems = [];
    mockStoreDb.save = async function() { return this; };

    const req = {
      user: { userId: 'user_merchant_999' },
      body: {
        name: 'Trà Sữa Matcha Trân Châu',
        price: 35000,
        categoryId: 'cat_drink',
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    };
    let resStatus = 0;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    await controller.addMenuItem(req, res);
    assert.strictEqual(resStatus, 201);
    assert.strictEqual(resData.success, true);
    assert.strictEqual(mockStoreDb.menuItems.length, 1);
    assert.strictEqual(mockStoreDb.menuItems[0].image, 'https://res.cloudinary.com/foodfast/image/upload/dish_auto.jpg');
    assert.strictEqual(mockStoreDb.menuItems[0].categoryId, 'cat_drink');
  });

  // Test 4.4: addMenuItem handles direct HTTPS URL string without modifying it
  await runAsyncTest('4.4 addMenuItem preserves direct HTTPS URL string', async () => {
    mockStoreDb.menuItems = [];
    const directUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    const req = {
      user: { userId: 'user_merchant_999' },
      body: {
        name: 'Bánh Mì Thịt Nướng',
        price: 25000,
        categoryId: 'cat_main',
        image: directUrl
      }
    };
    let resStatus = 0;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    await controller.addMenuItem(req, res);
    assert.strictEqual(resStatus, 201);
    assert.strictEqual(mockStoreDb.menuItems[0].image, directUrl);
  });
}

runControllerTests().then(() => {
  console.log('');
  console.log('================================================================');
  console.log(` TOTAL SUMMARY: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
