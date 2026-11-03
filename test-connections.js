const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Khắc phục lỗi phân giải DNS SRV của MongoDB Atlas trên Windows / Local DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Bỏ qua nếu môi trường không cho phép đổi DNS
}

const dbs = [
  {
    name: 'auth_db',
    uri: process.env.MONGO_URI_AUTH,
    collection: 'users',
    schema: new mongoose.Schema(
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        password: { type: String, required: true },
        role: { type: String, default: 'CUSTOMER' }
      },
      { timestamps: true }
    ),
    data: {
      name: 'Test Healthcheck User',
      email: 'test_healthcheck_' + Date.now() + '@fooddelivery.com',
      password: 'SamplePasswordHashed123',
      role: 'CUSTOMER'
    }
  },
  {
    name: 'restaurant_db',
    uri: process.env.MONGO_URI_RESTAURANT,
    collection: 'restaurants',
    schema: new mongoose.Schema(
      {
        name: { type: String, required: true },
        address: { type: String, required: true },
        phone: { type: String, default: '0901234567' },
        rating: { type: Number, default: 5.0 },
        menuItems: [
          {
            name: { type: String, required: true },
            price: { type: Number, required: true }
          }
        ]
      },
      { timestamps: true }
    ),
    data: {
      name: 'Nhà Hàng Mẫu Cloud Kitchen (Test)',
      address: '123 Đường Điện Toán Đám Mây, Quận 1, TP.HCM',
      phone: '0901234567',
      rating: 5.0,
      menuItems: [
        { name: 'Cơm Tấm Sườn Nướng', price: 65000 },
        { name: 'Trà Sen Vàng', price: 35000 }
      ]
    }
  },
  {
    name: 'order_db',
    uri: process.env.MONGO_URI_ORDER,
    collection: 'orders',
    schema: new mongoose.Schema(
      {
        customerId: { type: String, required: true },
        restaurantId: { type: String, default: null },
        items: { type: Array, required: true },
        totalPrice: { type: Number, required: true },
        status: { type: String, default: 'PENDING' }
      },
      { timestamps: true }
    ),
    data: {
      customerId: 'CUST-001',
      restaurantId: 'REST-001',
      items: [{ name: 'Cơm Tấm Sườn Nướng', quantity: 2, price: 65000 }],
      totalPrice: 130000,
      status: 'PENDING'
    }
  },
  {
    name: 'payment_db',
    uri: process.env.MONGO_URI_PAYMENT,
    collection: 'payments',
    schema: new mongoose.Schema(
      {
        orderId: { type: String, required: true },
        amount: { type: Number, required: true },
        paymentMethod: { type: String, default: 'VNPAY_QR' },
        status: { type: String, default: 'SUCCESS' },
        transactionId: { type: String, required: true }
      },
      { timestamps: true }
    ),
    data: {
      orderId: 'ORD-INIT-001',
      amount: 130000,
      paymentMethod: 'VNPAY_QR',
      status: 'SUCCESS',
      transactionId: 'TXN-' + Date.now()
    }
  },
  {
    name: 'delivery_db',
    uri: process.env.MONGO_URI_DELIVERY,
    collection: 'deliveries',
    schema: new mongoose.Schema(
      {
        orderId: { type: String, required: true },
        driverName: { type: String, default: null },
        status: { type: String, default: 'FINDING_DRIVER' }
      },
      { timestamps: true }
    ),
    data: {
      orderId: 'ORD-INIT-001',
      driverName: 'Trần Văn Vận Chuyển',
      status: 'FINDING_DRIVER'
    }
  }
];

async function testAll() {
  console.log('🚀 Bắt đầu kiểm tra kết nối và tạo dữ liệu mẫu trên MongoDB Atlas...\n');

  for (const db of dbs) {
    if (!db.uri) {
      console.error(`❌ Lỗi: Thiếu biến môi trường URI cho ${db.name}`);
      process.exit(1);
    }

    try {
      // 1. Kết nối riêng biệt tới từng Database qua URI
      const conn = await mongoose.createConnection(db.uri).asPromise();
      const Model = conn.model(db.collection, db.schema, db.collection);

      // 2. Chèn 1 document mẫu để Atlas tự động tạo database & collection
      await Model.create(db.data);

      // 3. Log chính xác theo định dạng yêu cầu: [OK] Connected & Seeded: <dbname>
      console.log(`[OK] Connected & Seeded: ${db.name}`);

      // 4. Đóng kết nối an toàn
      await conn.close();
    } catch (error) {
      console.error(`❌ [ERROR] Thất bại khi kết nối tới ${db.name}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n🎉 Hoàn thành kiểm tra: Cả 4 database đều đã kết nối và khởi tạo dữ liệu thành công!');
  process.exit(0);
}

testAll();
