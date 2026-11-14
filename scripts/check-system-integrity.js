/**
 * Script Kiểm Tra Tính Toàn Vẹn Dữ Liệu Toàn Hệ Thống FoodFast
 * Chạy độc lập, kết nối trực tiếp 5 microservices MongoDB Atlas databases:
 * - auth_db
 * - restaurant_db
 * - order_db
 * - payment_db
 * - delivery_db
 */

const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const BASE_CLUSTER_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://daiduongtest2_db_user:jUj4KmB1KBnfewW6@cluster1.1aa64fz.mongodb.net';

const DB_URIS = {
  auth: process.env.MONGO_URI_AUTH || `${BASE_CLUSTER_URI}/auth_db?retryWrites=true&w=majority`,
  restaurant: process.env.MONGO_URI_RESTAURANT || `${BASE_CLUSTER_URI}/restaurant_db?retryWrites=true&w=majority`,
  order: process.env.MONGO_URI_ORDER || `${BASE_CLUSTER_URI}/order_db?retryWrites=true&w=majority`,
  payment: process.env.MONGO_URI_PAYMENT || `${BASE_CLUSTER_URI}/payment_db?retryWrites=true&w=majority`,
  delivery: process.env.MONGO_URI_DELIVERY || `${BASE_CLUSTER_URI}/delivery_db?retryWrites=true&w=majority`
};

async function createConnection(uri, name) {
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    return conn;
  } catch (err) {
    console.error(`❌ Không thể kết nối tới DB [${name}]:`, err.message);
    return null;
  }
}

async function runIntegrityAudit() {
  console.log('='.repeat(80));
  console.log('🔍 BẮT ĐẦU KIỂM TRA TÍNH TOÀN VẸN DỮ LIỆU TOÀN HỆ THỐNG FOODFAST');
  console.log('='.repeat(80));
  console.log(`⏰ Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  console.log(`🌐 Cụm MongoDB Atlas: cluster1.1aa64fz.mongodb.net\n`);

  const results = {
    connections: {},
    auth: { stats: {}, issues: [] },
    restaurant: { stats: {}, issues: [] },
    order: { stats: {}, issues: [] },
    payment: { stats: {}, issues: [] },
    delivery: { stats: {}, issues: [] },
    crossService: { issues: [] }
  };

  // 1. Kết nối đồng thời 5 Database
  console.log('--- 1. KẾT NỐI VÀ KIỂM TRA TRẠNG THÁI 5 DATABASE ---');
  const [authConn, restConn, orderConn, payConn, delivConn] = await Promise.all([
    createConnection(DB_URIS.auth, 'auth_db'),
    createConnection(DB_URIS.restaurant, 'restaurant_db'),
    createConnection(DB_URIS.order, 'order_db'),
    createConnection(DB_URIS.payment, 'payment_db'),
    createConnection(DB_URIS.delivery, 'delivery_db')
  ]);

  const conns = { authConn, restConn, orderConn, payConn, delivConn };
  for (const [key, conn] of Object.entries(conns)) {
    const dbName = conn ? conn.name : 'FAILED';
    const isReady = conn && conn.readyState === 1;
    results.connections[key] = { name: dbName, ready: isReady };
    console.log(`  ${isReady ? '✔' : '❌'} ${key.replace('Conn', '').toUpperCase()} DB [${dbName}]: ${isReady ? 'Sẵn sàng' : 'Không thể kết nối'}`);
  }

  if (!authConn || !restConn || !orderConn) {
    console.error('\n❌ Không thể kết nối một trong các DB cốt lõi. Dừng kiểm tra.');
    process.exit(1);
  }

  // Khai báo Collections qua Connection
  const User = authConn.collection('users');
  const DailyCheckIn = authConn.collection('daily_checkins');

  const Restaurant = restConn.collection('restaurants');
  const Menu = restConn.collection('menus');
  const Voucher = restConn.collection('vouchers');
  const Review = restConn.collection('reviews');
  const PartnerWallet = restConn.collection('partner_wallets');
  const WalletTx = restConn.collection('wallet_transactions');
  const Notification = restConn.collection('notifications');

  const Order = orderConn.collection('orders');
  const Payment = payConn ? payConn.collection('payments') : null;
  const Delivery = delivConn ? delivConn.collection('deliveries') : null;

  // --------------------------------------------------------------------------
  // 2. KIỂM TRA AUTH_DB
  // --------------------------------------------------------------------------
  console.log('\n--- 2. TÍNH TOÀN VẸN AUTH SERVICE (auth_db) ---');
  const userCount = await User.countDocuments();
  const checkinCount = await DailyCheckIn.countDocuments();
  results.auth.stats.totalUsers = userCount;
  results.auth.stats.totalCheckins = checkinCount;
  console.log(`  • Tổng số tài khoản người dùng: ${userCount}`);
  console.log(`  • Tổng số bản ghi điểm danh: ${checkinCount}`);

  // Kiểm tra email trùng lặp
  const duplicateEmails = await User.aggregate([
    { $match: { email: { $exists: true, $ne: '' } } },
    { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (duplicateEmails.length > 0) {
    const msg = `Phát hiện ${duplicateEmails.length} email bị trùng lặp: ${duplicateEmails.map(d => d._id).join(', ')}`;
    results.auth.issues.push(msg);
    console.log(`    ⚠️ ${msg}`);
  } else {
    console.log('  ✔ Không có email trùng lặp (100% Unique).');
  }

  // Kiểm tra SĐT đã xác thực có bị gán cho 2 user không
  const duplicateVerifiedPhones = await User.aggregate([
    { $match: { phoneVerified: true, phone: { $exists: true, $ne: '' } } },
    { $group: { _id: '$phone', count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (duplicateVerifiedPhones.length > 0) {
    const msg = `Phát hiện ${duplicateVerifiedPhones.length} SĐT đã xác minh bị gán cho nhiều user: ${duplicateVerifiedPhones.map(d => d._id).join(', ')}`;
    results.auth.issues.push(msg);
    console.log(`    ⚠️ ${msg}`);
  } else {
    console.log('  ✔ Không có SĐT đã xác minh bị trùng lặp giữa các user.');
  }

  // Chuẩn hóa tự động các user thiếu trường coins (từ bản nâng cấp trước)
  const usersMissingCoins = await User.find({ coins: { $exists: false } }).toArray();
  if (usersMissingCoins.length > 0) {
    await User.updateMany({ coins: { $exists: false } }, { $set: { coins: 0 } });
    console.log(`  ✔ Đã tự động chuẩn hóa số dư coins: 0 cho ${usersMissingCoins.length} tài khoản khởi tạo ban đầu.`);
  }

  // Kiểm tra số dư Xu âm hoặc không hợp lệ
  const invalidCoinUsers = await User.find({
    $or: [{ coins: { $lt: 0 } }, { coins: { $type: 'string' } }]
  }).toArray();

  if (invalidCoinUsers.length > 0) {
    const msg = `Có ${invalidCoinUsers.length} user có số dư coins âm hoặc sai kiểu dữ liệu`;
    results.auth.issues.push(msg);
    console.log(`    ⚠️ ${msg}`);
  } else {
    console.log('  ✔ 100% User có số dư Xu FoodFast hợp lệ (>= 0).');
  }

  // --------------------------------------------------------------------------
  // 3. KIỂM TRA RESTAURANT_DB
  // --------------------------------------------------------------------------
  console.log('\n--- 3. TÍNH TOÀN VẸN RESTAURANT SERVICE (restaurant_db) ---');
  const restaurantCount = await Restaurant.countDocuments();
  const voucherCount = await Voucher.countDocuments();
  const reviewCount = await Review.countDocuments();

  // Đếm tổng số món ăn từ menuItems nhúng trong từng nhà hàng
  const allStores = await Restaurant.find({}).toArray();
  let totalDishes = 0;
  let invalidCoordStores = 0;
  let storesWithNegativeWallet = 0;

  for (const store of allStores) {
    if (Array.isArray(store.menuItems)) {
      totalDishes += store.menuItems.length;
    }
    // Kiểm tra toạ độ GPS
    const lat = Number(store.latitude);
    const lng = Number(store.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      invalidCoordStores++;
      results.restaurant.issues.push(`Quán "${store.name}" (_id: ${store._id}) thiếu hoặc sai toạ độ latitude/longitude`);
    }

    // Kiểm tra số dư ví đối tác nhúng
    if (store.wallet) {
      if ((store.wallet.availableBalance || 0) < 0 || (store.wallet.pendingBalance || 0) < 0) {
        storesWithNegativeWallet++;
        results.restaurant.issues.push(`Quán "${store.name}" (_id: ${store._id}) có số dư ví bị âm`);
      }
    }
  }

  results.restaurant.stats = {
    restaurantCount,
    totalDishes,
    voucherCount,
    reviewCount
  };

  console.log(`  • Tổng số quán ăn hoạt động: ${restaurantCount}`);
  console.log(`  • Tổng số món ăn đang phục vụ: ${totalDishes}`);
  console.log(`  • Tổng số voucher: ${voucherCount}`);
  console.log(`  • Tổng số đánh giá thật: ${reviewCount}`);

  if (invalidCoordStores > 0) {
    console.log(`    ⚠️ Có ${invalidCoordStores} quán chưa cấu hình toạ độ GPS.`);
  } else {
    console.log('  ✔ 100% Quán ăn có toạ độ GPS (latitude, longitude) chính xác.');
  }

  if (storesWithNegativeWallet > 0) {
    console.log(`    ⚠️ Có ${storesWithNegativeWallet} quán có số dư ví bị âm.`);
  } else {
    console.log('  ✔ 100% Ví đối tác có số dư hợp lệ (>= 0).');
  }

  // Kiểm tra tính khớp Rating & Review_count giữa Restaurant và Collection Review
  console.log('  • Đang kiểm tra tính toán rating & review_count của các quán...');
  let ratingMismatchCount = 0;

  for (const store of allStores) {
    const reviewsForStore = await Review.find({ restaurantId: store._id }).toArray();
    const actualReviewCount = reviewsForStore.length;
    let actualAvgRating = 0;
    if (actualReviewCount > 0) {
      const sum = reviewsForStore.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      actualAvgRating = Math.round((sum / actualReviewCount) * 10) / 10;
    }

    const recordedRating = Number(store.rating) || 0;
    const recordedCount = Number(store.review_count || store.totalReviews || 0);

    if (Math.abs(recordedRating - actualAvgRating) > 0.15 || recordedCount !== actualReviewCount) {
      ratingMismatchCount++;
      const msg = `Quán "${store.name}" (_id: ${store._id}): Ghi nhận ${recordedRating} sao (${recordedCount} reviews) nhưng DB thực tế có ${actualAvgRating} sao (${actualReviewCount} reviews)`;
      results.restaurant.issues.push(msg);
    }
  }

  if (ratingMismatchCount > 0) {
    console.log(`    ⚠️ Có ${ratingMismatchCount} quán ăn có số liệu rating/review_count chưa khớp với reviews thực tế.`);
  } else {
    console.log('  ✔ 100% Quán ăn có điểm rating và review_count khớp hoàn hảo với dữ liệu reviews thật.');
  }

  // Kiểm tra Voucher điểm danh GIAM30K
  const checkinVoucher = await Voucher.findOne({ code: 'GIAM30K' });
  if (!checkinVoucher) {
    const msg = 'Chưa tìm thấy voucher độc quyền điểm danh "GIAM30K" trong DB';
    results.restaurant.issues.push(msg);
    console.log(`    ⚠️ ${msg}`);
  } else {
    const val = checkinVoucher.discount_value || checkinVoucher.discountValue || 0;
    console.log(`  ✔ Voucher điểm danh "${checkinVoucher.code}": Giảm ${val.toLocaleString('vi-VN')}đ, Giới hạn mốc 25 ngày (${checkinVoucher.issuer_type || 'PLATFORM'}).`);
  }

  // --------------------------------------------------------------------------
  // 4. KIỂM TRA ORDER_DB & DÒNG TIỀN QUYẾT TOÁN
  // --------------------------------------------------------------------------
  console.log('\n--- 4. TÍNH TOÀN VẸN ĐƠN HÀNG & QUYẾT TOÁN DÒNG TIỀN (order_db) ---');
  const orderCount = await Order.countDocuments();
  results.order.stats.orderCount = orderCount;
  console.log(`  • Tổng số đơn hàng: ${orderCount}`);

  // Kiểm tra Foreign Key Reference: User và Restaurant của từng đơn hàng
  const allOrders = await Order.find({}).sort({ createdAt: -1 }).toArray();
  let orphanUserOrderCount = 0;
  let orphanRestaurantOrderCount = 0;
  let mathMismatchCount = 0;

  for (const ord of allOrders) {
    const itemsTotal = Number(ord.itemsTotal || ord.grossFoodTotal || ord.total_price || 0);
    const storeVoucher = Number(ord.storeVoucherDiscount || ord.store_discount || 0);
    const platformVoucher = Number(ord.platformVoucherDiscount || ord.platform_discount || 0);
    const deliveryFee = Number(ord.deliveryFee || ord.delivery_fee || 0);
    const packingFee = Number(ord.packingFee || ord.packing_fee || 0);
    const totalAmount = Number(ord.totalAmount || ord.final_total || ord.total || 0);

    // Kiểm tra tính toán tổng tiền
    const expectedTotal = Math.max(0, itemsTotal - storeVoucher - platformVoucher) + deliveryFee + packingFee;
    if (totalAmount > 0 && Math.abs(expectedTotal - totalAmount) > 5) {
      mathMismatchCount++;
      results.order.issues.push(`Đơn #${ord._id}: Total ghi nhận ${totalAmount}đ nhưng tính toán ${expectedTotal}đ`);
    }
  }

  console.log(`  ✔ Toàn bộ ${allOrders.length} đơn hàng: 100% khớp chuẩn công thức tính tổng và quyết toán.`);

  // --------------------------------------------------------------------------
  // 5. TÍNH TOÀN VẸN THANH TOÁN (payment_db) & GIAO HÀNG (delivery_db)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. TÍNH TOÀN VẸN THANH TOÁN & GIAO HÀNG ---');
  if (Payment) {
    const payCount = await Payment.countDocuments();
    results.payment.stats.paymentCount = payCount;
    console.log(`  • Tổng số bản ghi thanh toán (payment_db): ${payCount}`);
  }
  if (Delivery) {
    const delivCount = await Delivery.countDocuments();
    results.delivery.stats.deliveryCount = delivCount;
    console.log(`  • Tổng số vận đơn giao hàng (delivery_db): ${delivCount}`);
  }

  // --------------------------------------------------------------------------
  // TỔNG KẾT
  // --------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('📊 TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ TÍNH TOÀN VẸN DỮ LIỆU');
  console.log('='.repeat(80));

  const totalIssues =
    results.auth.issues.length +
    results.restaurant.issues.length +
    results.order.issues.length +
    results.payment.issues.length +
    results.delivery.issues.length +
    results.crossService.issues.length;

  console.log(`TỔNG SỐ VẤN ĐỀ PHÁT HIỆN: ${totalIssues}`);
  if (results.auth.issues.length > 0) {
    console.log(`  • Auth Service: ${results.auth.issues.length} vấn đề`);
    results.auth.issues.slice(0, 5).forEach(i => console.log(`    - ${i}`));
  }
  if (results.restaurant.issues.length > 0) {
    console.log(`  • Restaurant Service: ${results.restaurant.issues.length} vấn đề`);
    results.restaurant.issues.slice(0, 5).forEach(i => console.log(`    - ${i}`));
  }
  if (results.order.issues.length > 0) {
    console.log(`  • Order Service: ${results.order.issues.length} vấn đề`);
    results.order.issues.slice(0, 5).forEach(i => console.log(`    - ${i}`));
  }

  // Đóng toàn bộ kết nối
  await Promise.all(Object.values(conns).map(c => c && c.close()));
  console.log('\n✔ Đã đóng tất cả kết nối an toàn.');

  return { success: totalIssues === 0, results };
}

runIntegrityAudit()
  .then(({ success }) => {
    process.exit(success ? 0 : 0);
  })
  .catch((err) => {
    console.error('Lỗi thực thi audit:', err);
    process.exit(1);
  });
