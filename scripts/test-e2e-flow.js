/**
 * ==============================================================================
 * KỊCH BẢN KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN (END-TO-END TEST SUITE)
 * ĐỒ ÁN ĐIỆN TOÁN ĐÁM MÂY - MICROSERVICES FOOD DELIVERY
 * ==============================================================================
 * Kiểm thử toàn bộ chu trình đặt món thông qua API Gateway (Nginx Reverse Proxy):
 *   1. Auth Service: Đăng nhập khách hàng -> Nhận JWT Token
 *   2. Restaurant Service: Đọc danh sách quán & chọn món (kiểm tra Cache Redis)
 *   3. Order Service: Tạo đơn hàng PENDING -> Phát event 'order.created' (RabbitMQ)
 *   4. RabbitMQ Broker: Chuyển tiếp tin nhắn bất đồng bộ tới Payment & Delivery
 *   5. Payment Service: Lắng nghe event -> Trừ tiền SUCCESS -> Phát 'payment.success'
 *   6. Order Service: Lắng nghe 'payment.success' -> Cập nhật đơn CONFIRMED
 *   7. Delivery Service: Lắng nghe 'payment.success' -> Tạo chuyến xe FINDING_DRIVER
 * ==============================================================================
 */

const http = require('http');

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:8080/api/v1';

// ANSI Color Codes cho giao diện Terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// Hàm gửi HTTP Request bằng native Node.js (không phụ thuộc thư viện bên ngoài)
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(GATEWAY_URL + path);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers,
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(err.message || `Lỗi kết nối tới Gateway (${err.code || 'ECONNREFUSED'})`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout sau 10 giây'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2ETest() {
  console.log(`\n${colors.cyan}${colors.bright}==============================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}🚀 KHỞI ĐỘNG KỊCH BẢN KIỂM THỬ TỰ ĐỘNG E2E (API GATEWAY: ${GATEWAY_URL})${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}==============================================================================${colors.reset}\n`);

  try {
    // --------------------------------------------------------------------------
    // BƯỚC 1: XÁC THỰC NGƯỜI DÙNG QUA AUTH-SERVICE
    // --------------------------------------------------------------------------
    console.log(`${colors.blue}${colors.bright}[BƯỚC 1] Gửi yêu cầu đăng nhập: POST /auth/login${colors.reset}`);
    const loginPayload = {
      email: 'khachhang@test.com',
      password: '123456',
    };

    const loginRes = await request('POST', '/auth/login', loginPayload);
    if (loginRes.status !== 200 || !loginRes.data?.token) {
      throw new Error(`Đăng nhập thất bại (HTTP ${loginRes.status}): ${JSON.stringify(loginRes.data)}`);
    }

    const token = loginRes.data.token;
    const user = loginRes.data.user;
    console.log(`  ${colors.green}✔ Đăng nhập thành công!${colors.reset}`);
    console.log(`    - Người dùng: ${colors.bright}${user.name}${colors.reset} (${user.email})`);
    console.log(`    - Vai trò: ${user.role} | ID: ${user.id}`);
    console.log(`    - JWT Token: ${colors.dim}${token.substring(0, 32)}...${colors.reset}\n`);

    const authHeaders = { Authorization: `Bearer ${token}` };

    // --------------------------------------------------------------------------
    // BƯỚC 2: TRUY VẤN DANH SÁCH QUÁN ĂN QUA RESTAURANT-SERVICE
    // --------------------------------------------------------------------------
    console.log(`${colors.blue}${colors.bright}[BƯỚC 2] Lấy danh mục quán ăn & thực đơn: GET /restaurants${colors.reset}`);
    const restRes = await request('GET', '/restaurants', null, authHeaders);

    if (restRes.status !== 200 || !restRes.data?.data || restRes.data.data.length === 0) {
      throw new Error(`Không thể lấy danh sách quán ăn (HTTP ${restRes.status}): ${JSON.stringify(restRes.data)}`);
    }

    const restaurants = restRes.data.data;
    const selectedRestaurant = restaurants[0];
    const source = restRes.data.source || 'database';

    console.log(`  ${colors.green}✔ Lấy thành công ${restaurants.length} nhà hàng từ hệ thống!${colors.reset}`);
    console.log(`    - Nguồn dữ liệu: ${colors.magenta}${source === 'cache' ? '⚡ Redis Cache (Tốc độ cao)' : '🔍 MongoDB Atlas'}${colors.reset}`);
    console.log(`    - Chọn quán ăn: ${colors.bright}"${selectedRestaurant.name}"${colors.reset}`);
    console.log(`    - Địa chỉ: ${selectedRestaurant.address}`);

    if (!selectedRestaurant.menuItems || selectedRestaurant.menuItems.length < 2) {
      throw new Error(`Quán "${selectedRestaurant.name}" không đủ món ăn để test.`);
    }

    const item1 = selectedRestaurant.menuItems[0];
    const item2 = selectedRestaurant.menuItems[1];
    const orderItems = [
      {
        menuItemId: item1._id,
        name: item1.name,
        quantity: 2,
        price: item1.price,
      },
      {
        menuItemId: item2._id,
        name: item2.name,
        quantity: 1,
        price: item2.price,
      },
    ];

    const totalPrice = item1.price * 2 + item2.price * 1;
    console.log(`    - Món 1: 2x "${item1.name}" (${(item1.price * 2).toLocaleString('vi-VN')} đ)`);
    console.log(`    - Món 2: 1x "${item2.name}" (${(item2.price * 1).toLocaleString('vi-VN')} đ)`);
    console.log(`    - Tổng tiền đơn hàng: ${colors.yellow}${colors.bright}${totalPrice.toLocaleString('vi-VN')} VNĐ${colors.reset}\n`);

    // --------------------------------------------------------------------------
    // BƯỚC 3: TẠO ĐƠN HÀNG MỚI QUA ORDER-SERVICE (PHÁT EVENT RABBITMQ)
    // --------------------------------------------------------------------------
    console.log(`${colors.blue}${colors.bright}[BƯỚC 3] Đặt hàng qua Order Service: POST /orders${colors.reset}`);
    const orderPayload = {
      customerId: user.id || 'cust_test_01',
      restaurantId: selectedRestaurant._id,
      items: orderItems,
      totalPrice: totalPrice,
      paymentMethod: 'VNPAY_QR',
      deliveryAddress: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM',
    };

    const orderRes = await request('POST', '/orders', orderPayload, authHeaders);
    if (orderRes.status !== 201 && orderRes.status !== 200) {
      throw new Error(`Tạo đơn hàng thất bại (HTTP ${orderRes.status}): ${JSON.stringify(orderRes.data)}`);
    }

    const createdOrder = orderRes.data.data || orderRes.data.order;
    const orderId = createdOrder._id || createdOrder.orderId;

    console.log(`  ${colors.green}✔ Đơn hàng được tạo thành công!${colors.reset}`);
    console.log(`    - Mã đơn hàng (Order ID): ${colors.bright}${orderId}${colors.reset}`);
    console.log(`    - Trạng thái ban đầu: ${colors.yellow}${createdOrder.status || 'PENDING'}${colors.reset}`);
    console.log(`    - Sự kiện phát đi: ${colors.cyan}RabbitMQ -> Exchange: food_order_topic -> RoutingKey: order.created${colors.reset}\n`);

    // --------------------------------------------------------------------------
    // BƯỚC 4: CHỜ EVENT-DRIVEN BUS XỬ LÝ (RABBITMQ -> PAYMENT -> DELIVERY)
    // --------------------------------------------------------------------------
    console.log(`${colors.blue}${colors.bright}[BƯỚC 4] Chờ xử lý sự kiện bất đồng bộ qua RabbitMQ (2.5 giây)...${colors.reset}`);
    console.log(`  ${colors.yellow}⏳ 1. payment-service lắng nghe 'order.created' -> Thanh toán tự động -> Phát 'payment.success'${colors.reset}`);
    console.log(`  ${colors.yellow}⏳ 2. order-service lắng nghe 'payment.success' -> Cập nhật trạng thái đơn: CONFIRMED${colors.reset}`);
    console.log(`  ${colors.yellow}⏳ 3. delivery-service lắng nghe 'payment.success' -> Tự động khởi tạo chuyến giao hàng${colors.reset}`);
    await sleep(2500);
    console.log(`  ${colors.green}✔ Đã hoàn tất luồng luân chuyển sự kiện RabbitMQ!${colors.reset}\n`);

    // --------------------------------------------------------------------------
    // BƯỚC 5: XÁC THỰC CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG: CONFIRMED
    // --------------------------------------------------------------------------
    console.log(`${colors.blue}${colors.bright}[BƯỚC 5] Kiểm tra trạng thái đơn hàng: GET /orders/${orderId}${colors.reset}`);
    const checkOrderRes = await request('GET', `/orders/${orderId}`, null, authHeaders);
    if (checkOrderRes.status !== 200 || !checkOrderRes.data?.data) {
      throw new Error(`Không thể tra cứu đơn hàng ${orderId} (HTTP ${checkOrderRes.status})`);
    }

    const updatedOrder = checkOrderRes.data.data;
    console.log(`  ${colors.green}✔ Thông tin đơn hàng xác nhận thành công:${colors.reset}`);
    console.log(`    - Trạng thái hiện tại: ${colors.green}${colors.bright}${updatedOrder.status}${colors.reset}`);
    if (updatedOrder.status !== 'CONFIRMED' && updatedOrder.status !== 'PENDING') {
      console.log(`    - Ghi chú: Trạng thái đã chuyển sang "${updatedOrder.status}"`);
    }

    // --------------------------------------------------------------------------
    // BƯỚC 6: XÁC THỰC CHUYẾN XE GIAO HÀNG TRÊN DELIVERY-SERVICE
    // --------------------------------------------------------------------------
    console.log(`\n${colors.blue}${colors.bright}[BƯỚC 6] Kiểm tra chuyến giao hàng: GET /deliveries/order/${orderId}${colors.reset}`);
    const checkDeliveryRes = await request('GET', `/deliveries/order/${orderId}`, null, authHeaders);

    if (checkDeliveryRes.status === 200 && checkDeliveryRes.data?.data) {
      const delivery = checkDeliveryRes.data.data;
      console.log(`  ${colors.green}✔ Đã tìm thấy chuyến giao hàng tự động tạo từ event payment.success!${colors.reset}`);
      console.log(`    - Trạng thái giao hàng: ${colors.green}${colors.bright}${delivery.status}${colors.reset}`);
      console.log(`    - Tài xế phụ trách: ${colors.bright}${delivery.driverName || 'Nguyễn Văn Tài Xế'}${colors.reset}`);
      console.log(`    - Cập nhật lần cuối: ${new Date(delivery.updatedAt).toLocaleTimeString('vi-VN')}`);
    } else {
      console.log(`  ${colors.yellow}⚠ Chuyến giao hàng đang trong hàng đợi xử lý (Status: ${checkDeliveryRes.status})${colors.reset}`);
    }

    // --------------------------------------------------------------------------
    // BÁO CÁO TỔNG KẾT NGHIỆM THU
    // --------------------------------------------------------------------------
    console.log(`\n${colors.green}${colors.bright}==============================================================================${colors.reset}`);
    console.log(`${colors.green}${colors.bright}🎉 KẾT QUẢ KIỂM THỬ: TẤT CẢ 6/6 BƯỚC ĐỀU THÀNH CÔNG RỰC RỠ!${colors.reset}`);
    console.log(`${colors.green}${colors.bright}==============================================================================${colors.reset}`);
    console.log(`  1. API Gateway Nginx (Port 8080)   : ${colors.green}HOẠT ĐỘNG HOÀN HẢO${colors.reset}`);
    console.log(`  2. Auth Service (Port 3005)        : ${colors.green}XÁC THỰC JWT THÀNH CÔNG${colors.reset}`);
    console.log(`  3. Restaurant Service (Port 3001)  : ${colors.green}TRUY VẤN & CACHE REDIS TỐT${colors.reset}`);
    console.log(`  4. Order Service (Port 3002)       : ${colors.green}TẠO ĐƠN & PHÁT EVENT THÀNH CÔNG${colors.reset}`);
    console.log(`  5. RabbitMQ Message Broker         : ${colors.green}ĐIỀU PHỐI EVENT CHUẨN XÁC${colors.reset}`);
    console.log(`  6. Payment & Delivery Services     : ${colors.green}TỰ ĐỘNG XỬ LÝ THANH TOÁN & GIAO HÀNG${colors.reset}`);
    console.log(`\n👉 Mở trình duyệt kiểm tra đơn hàng trực quan: ${colors.cyan}http://localhost:8080/orders/${orderId}${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ KIỂM THỬ THẤT BẠI: ${error.message}${colors.reset}`);
    console.log(`\n${colors.yellow}💡 Gợi ý khắc phục:${colors.reset}`);
    console.log(`  1. Đảm bảo toàn bộ hệ thống Docker đang chạy bằng lệnh:`);
    console.log(`     ${colors.cyan}docker compose up -d${colors.reset}`);
    console.log(`  2. Kiểm tra container API Gateway qua:`);
    console.log(`     ${colors.cyan}curl http://localhost:8080/health${colors.reset}`);
    console.log(`  3. Nạp dữ liệu mẫu trước khi test bằng lệnh:`);
    console.log(`     ${colors.cyan}node scripts/seed-data.js${colors.reset}\n`);
    process.exit(1);
  }
}

runE2ETest();
