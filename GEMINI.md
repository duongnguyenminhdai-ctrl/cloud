# FoodFast (`foodorders`) — Hướng dẫn dự án cho Agent

> Tài liệu chuẩn giúp agent nắm nhanh kiến trúc, quy tắc nghiệp vụ và lệnh kiểm thử ngay khi bắt đầu phiên làm việc. Trả lời người dùng bằng **tiếng Việt**.

---

## 1. Thương hiệu & Stack công nghệ
- **Thương hiệu chính thức:** **FoodFast** *(tuyệt đối không dùng tên bên thứ ba như ShopeeFood / Shopee Partner trong giao diện, email, API response hay nội dung mới)*.
- **Frontend:** React 18 + Vite + TailwindCSS (`frontend/`, dev `5173`, Docker `3000`, deploy Vercel qua [`vercel.json`](vercel.json) & [`frontend/vercel.json`](frontend/vercel.json)).
- **API Gateway:** Nginx (`gateway/nginx.conf`, Docker host port `8080 -> 80`), chuyển tiếp `/api/v1/auth`, `/api/v1/restaurants`, `/api/v1/orders`, `/api/v1/payments`, `/api/v1/deliveries`, `/socket.io/`.
- **Hạ tầng dữ liệu:** MongoDB Atlas (`cluster1.1aa64fz.mongodb.net`), Redis, RabbitMQ (`foodfast_events`), Firebase Phone Authentication (`foodfast-38ac0`).

---

## 2. Bản đồ Microservices & Databases

| Service | Thư mục | Port | MongoDB Atlas DB | Nhiệm vụ chính |
| :--- | :--- | :---: | :--- | :--- |
| **Auth Service** | `services/auth-service` | `3005` | `auth_db` | JWT (`JWT_SECRET`), Email OTP (Nodemailer), Google OAuth, Firebase Phone Auth, Profile & Avatar |
| **Restaurant Service** | `services/restaurant-service` | `3001` | `restaurant_db` | Quán ăn, Thực đơn, Voucher, Đánh giá, Ví đối tác & Quyết toán, Admin tặng tiền ví, Thông báo chuông & SSE |
| **Order Service** | `services/order-service` | `3002` | `order_db` | Tạo/quản lý đơn hàng (`order.created`), tính quyết toán (`settlementEngine.js`), SSE đơn hàng |
| **Payment Service** | `services/payment-service` | `3003` | `payment_db` | Thanh toán VNPay Sandbox & COD, bắn event thanh toán RabbitMQ |
| **Delivery Service** | `services/delivery-service` | `3004` | `delivery_db` | Điều phối giao hàng & WebSocket `/socket.io/` realtime |

---

## 3. Quy tắc nghiệp vụ cốt lõi
1. **Dữ liệu & dòng tiền thật 100%:**
   - Doanh thu hôm nay, số đơn thành công, đánh giá quán, số dư ví và lịch sử giao dịch/quyết toán đều phải tính từ thao tác & dữ liệu thật trên DB (không tự sinh số liệu ảo/hardcode). Test ví/voucher qua chức năng Admin tặng tiền cho quán.
   - Giữ quán mẫu hợp lệ để test bộ lọc/search; tránh sinh user ảo rác.
2. **Công thức quyết toán & Voucher quán** ([`settlementEngine.js`](services/order-service/src/utils/settlementEngine.js)):
   - `Tiền Quán Nhận = (Giá gốc món - Voucher Quán) - Phí chiết khấu sàn - Thuế khấu trừ hộ (nếu có) + Phí đóng gói`
   - **Voucher của Quán (`STORE`):** Trừ trực tiếp vào doanh thu tính chiết khấu & tính thuế (`taxableRevenue = grossFoodTotal - storeVoucherDiscount`); chỉ trừ tiền khi đơn hoàn tất, không giam trước. Mặc định chiết khấu sàn `25%`; Hộ kinh doanh (`HOUSEHOLD`) & Cá nhân (`INDIVIDUAL`) khấu trừ hộ `1% GTGT + 0.5% TNCN = 1.5%`.
   - **Voucher của Sàn (`PLATFORM`):** Quán vẫn tính trên giá gốc món ăn, sàn tự bù phần giảm giá.
3. **Realtime & Phân trang:**
   - Thông báo chuông chủ quán, cập nhật đơn hàng, số liệu ví/doanh thu và voucher phải đồng bộ **realtime** (SSE `/stream`, `/my-store/stream`, `/admin/stream`, `realtimeSync.js`, RabbitMQ relay), tránh bắt người dùng F5 mới thấy số liệu.
   - Toàn bộ danh sách dữ liệu (users, quán, đơn hàng, voucher, giao dịch, đánh giá...) phải hỗ trợ **phân trang**.
4. **Xác thực SĐT & Firebase Phone Auth:**
   - Bật kiểm soát SĐT khi `REQUIRE_PHONE_VERIFICATION=true` (Frontend dùng `VITE_FIREBASE_*` + invisible reCAPTCHA tại [`frontend/src/utils/firebase.js`](frontend/src/utils/firebase.js); Backend verify token qua [`firebaseAdmin.js`](services/auth-service/src/utils/firebaseAdmin.js)).
   - Chỉ nhận SĐT di động Việt Nam hợp lệ 10 chữ số đầu `03/05/07/08/09` (E.164 `+84...`); mỗi SĐT đã xác thực chỉ gắn với 1 tài khoản duy nhất.

---

## 4. Quy tắc làm việc, Bảo mật & Kiểm thử
- **Bảo mật & Git:** Tuyệt đối **không** commit `.env`, Service Account JSON, hay token bí mật lên Git. **Không tự ý chạy `git push`** nếu người dùng chưa yêu cầu rõ ràng.
- **Thay đổi trong phạm vi repo:** Trước khi trả lời xong, luôn chạy kiểm tra lại các test/build liên quan sau lần sửa cuối cùng:
  - Test toàn bộ 5 backend services: `npm test` (chạy [`scripts/run-all-tests.js`](scripts/run-all-tests.js))
  - Test từng service riêng: `npm test --prefix services/auth-service` (hoặc `restaurant-service`, `order-service`, `payment-service`, `delivery-service`)
  - Build frontend kiểm tra lỗi bundle: `npm run build --prefix frontend`
- **Deploy:** Backend cấu hình theo [`render.yaml`](render.yaml) (`auth-service` và `restaurant-service` dùng chung `JWT_SECRET` và `REQUIRE_PHONE_VERIFICATION=true`); Frontend deploy Vercel.

---

## 5. Trạng thái dự án & Tính năng gần nhất (Handover Context)
- **Hệ thống Đánh giá & Xu thưởng (Shopee-style) — Commit `91fdb24`:**
  - Khách nhận hàng thành công (`DELIVERED`) nhận thông báo qua **Chuông** [`NotificationBell.jsx`](frontend/src/components/NotificationBell.jsx).
  - Đánh giá đơn thành công nhận ngay **1.000 Xu FoodFast** lưu vào DB thật (`User.coins` trong `auth_db`).
  - Thông báo và quyền đánh giá nhận xu có thời hạn **7 ngày** (sử dụng MongoDB Native TTL Index tự động dọn dẹp và xóa bản ghi).
  - Chặn hoàn toàn việc tạo mã đơn hàng ảo `ord_${Date.now()}`; loại bỏ text kỹ thuật RabbitMQ trong Modal đánh giá quán.
- **Voucher & Popup Khuyến mãi:**
  - Popup Flash Sale tại trang chủ [`PromotionPopupModal.jsx`](frontend/src/components/PromotionPopupModal.jsx).
  - Voucher mặc định hệ thống: `FREESHIP50`, `QUANNGON20`, `FOODFAST10`. Có thể nâng cấp kết nối API Admin quản trị banner popup động từ MongoDB.


