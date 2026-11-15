# TEST READY: FoodFast — Decision Roulette & Group Order Integration

> **Tài liệu nghiệm thu kiểm thử tự động toàn diện (Test Readiness Attestation)**  
> **Dự án:** FoodFast (`foodorders`) — "Hôm nay ăn gì?" (Decision Roulette) & "Lập kèo ăn trưa" (Group Order)  
> **Milestone:** Milestone 4 (E2E Integration, Full System Verification & Regression Lead)  
> **Trạng thái:** ✅ **SẴN SÀNG CHO PRODUCTION (TEST READY - EXIT CODE 0)**  
> **Ngày phê duyệt:** 15/11/2026 (UTC: 2026-11-15T12:44:00Z)  

---

## 1. Tóm Tắt Nghiệm Thu (Executive Summary)

Toàn bộ các tính năng cốt lõi thuộc Đề bài Yêu Cầu (**Requirements R1, R2, R3, R4, R5**) và Danh mục tính năng (**Features 1 – 19** trong `PROJECT.md`) đã được triển khai đầy đủ, kết nối thông suốt giữa các Microservices và Frontend, vượt qua 100% tất cả các cấp độ kiểm thử (Tiers 1, 2, 3, 4) cùng với kiểm thử hồi quy toàn bộ hệ thống.

| Hạng mục kiểm thử | Công cụ / Runner | Kết quả | Thời gian | Chi tiết |
| :--- | :--- | :---: | :---: | :--- |
| **Full 5-Service Backend Suite** | `npm test` (`scripts/run-all-tests.js`) | **PASS (5/5)** | 31.61s | 18 Suites, 110 Tests đạt 100% |
| **Restaurant Service Tests** | `npm test --prefix services/restaurant-service` | **PASS (6/6)** | 10.89s | 26/26 Tests đạt 100% |
| **Order Service Tests** | `npm test --prefix services/order-service` | **PASS (5/5)** | 3.64s | 24/24 Tests đạt 100% |
| **E2E Integration Suite** | `npm run test:e2e` (`tests/e2e/decisionRouletteAndGroupOrder.test.js`) | **PASS (1/1)** | 3.53s | 23/23 Tests đạt 100% |
| **Frontend Production Build** | `npm run build --prefix frontend` (Vite) | **PASS** | 10.60s | 1629 modules transformed, 0 errors |
| **GEMINI.md Compliance Check** | PowerShell Regex Case-Insensitive Check | **PASS** | 0.8s | **0 `Sparkles` icon** trong `frontend/src` |

---

## 2. Bảng Ma Trận Tính Năng & Kiểm Thử (Feature Inventory Matrix)

| # | Tính năng | Nguồn yêu cầu | Vị trí mã nguồn | Trạng thái |
| :-: | :--- | :---: | :--- | :-: |
| **F1** | API Vòng quay Roulette: lọc mở cửa, `$sample: 8`, trả `winnerItem`, `winnerIndex` (0–7), `sessionId` 5 phút | R1 | `services/restaurant-service/src/controllers/rouletteController.js` | ✅ VERIFIED |
| **F2** | Rate Limiting 3 lượt quay/ngày theo múi giờ Việt Nam, chặn lượt thứ 4 (HTTP 429), trả về `resetAt` | R1 | `services/restaurant-service/src/models/RouletteSpinLog.js` | ✅ VERIFIED |
| **F3** | Quản lý vòng đời `RouletteSession` (TTL 5 phút), tra cứu `GET /session/:id` và tiêu thụ `POST /session/:id/consume` | R1 | `services/restaurant-service/src/models/RouletteSession.js` | ✅ VERIFIED |
| **F4** | Xác thực Roulette tại Checkout Order: kiểm tra chủ sở hữu, chưa hết hạn, đúng món trúng thưởng trong giỏ hàng | R2 | `services/order-service/src/controllers/orderController.js` | ✅ VERIFIED |
| **F5** | Tự động nhân đôi Xu (`DOUBLE_COINS` -> 2.000 Xu) khi đơn hoàn thành `DELIVERED`, ngăn chặn tái sử dụng | R2 | `services/order-service/src/controllers/orderController.js` | ✅ VERIFIED |
| **F6** | Khởi tạo phòng Group Order: Host tạo phòng gắn `restaurantId`, sinh mã phòng 6 ký tự `roomCode` | R3 | `services/order-service/src/models/GroupOrder.js` | ✅ VERIFIED |
| **F7** | Quản lý thành viên & giỏ hàng chung: Tham gia phòng, thêm món, phân quyền xóa món chỉ chủ món hoặc Host | R3 | `services/order-service/src/controllers/groupOrderController.js` | ✅ VERIFIED |
| **F8** | Thuật toán chia đều phí ship (Bill Splitting Engine): chỉ chia đều cho các thành viên có đặt món (`splitCount`) | R3 | `services/order-service/src/controllers/groupOrderController.js` | ✅ VERIFIED |
| **F9** | Khóa phòng & Chốt đơn nhóm (Lock & Checkout): Host khóa phòng, tạo thành `Order` hoàn chỉnh có `groupOrderInfo` | R3 | `services/order-service/src/controllers/groupOrderController.js` | ✅ VERIFIED |
| **F10**| Component `FoodRouletteModal.jsx`: Vòng quay 8 ô SVG chuyển động 3.5s `cubic-bezier`, filter chips, 3/3 lượt, âm thanh | R4 | `frontend/src/components/FoodRouletteModal.jsx` | ✅ VERIFIED |
| **F11**| Thẻ kết quả món ăn trúng thưởng, đếm ngược 5:00 trực tiếp, nút "Chốt đơn ngay" dẫn sang Checkout | R4 | `frontend/src/components/FoodRouletteModal.jsx` | ✅ VERIFIED |
| **F12**| Nút kích hoạt nổi bật "Hôm nay ăn gì?" với huy hiệu "x2 Xu" trên Navbar và Home banner | R4 | `frontend/src/components/Navbar.jsx`, `Home.jsx` | ✅ VERIFIED |
| **F13**| Nút "Lập kèo ăn trưa" (`Users` icon) tại Header trang chi tiết quán ăn | R5 | `frontend/src/pages/RestaurantDetail.jsx` | ✅ VERIFIED |
| **F14**| Trang phòng đặt nhóm `/group-order/:roomCode`: sao chép link 1-click, giỏ nhóm theo thành viên, bảng chia tiền | R5 | `frontend/src/pages/GroupOrderPage.jsx` | ✅ VERIFIED |
| **F15**| Modal duyệt thực đơn quán ăn cho thành viên phòng nhóm (`GroupOrderMenuModal.jsx`) | R5 | `frontend/src/components/GroupOrderMenuModal.jsx` | ✅ VERIFIED |
| **F16**| Tích hợp Checkout: hiển thị banner x2 Xu, đính kèm `rouletteSessionId` và `groupOrderRoomCode` | R4, R5 | `frontend/src/pages/Checkout.jsx` | ✅ VERIFIED |
| **F17**| Tuân thủ quy tắc `GEMINI.md`: Tuyệt đối không dùng icon `Sparkles`, hỗ trợ Light/Dark mode, màu chuẩn `#EE4D2D` | Quy tắc | `frontend/src/**` | ✅ VERIFIED |
| **F18**| API Client trung tâm xuất `rouletteApi` và `groupOrderApi` kèm localhost fallback tự động | R1, R3 | `frontend/src/api/client.js` | ✅ VERIFIED |
| **F19**| Bộ kiểm thử tích hợp E2E Opaque-box (Tiers 1–4) bao quát toàn bộ luồng nghiệp vụ | M4 | `tests/e2e/decisionRouletteAndGroupOrder.test.js` | ✅ VERIFIED |

---

## 3. Chi Tiết Các Cấp Độ Kiểm Thử E2E (Tiers 1 – 4)

Bộ test tích hợp E2E đặt tại `tests/e2e/decisionRouletteAndGroupOrder.test.js` đã thực thi thành công **23/23 tests** với thời gian **3.53 giây**:

### Tier 1: Functional Happy Paths (Features 1 – 8)
- **T1.1 (F1):** Endpoint `POST /api/v1/restaurants/roulette/spin` trả về đúng 8 món ăn, chỉ số trúng `winnerIndex` (0–7), khớp món trúng thưởng và sinh `sessionId` có thời hạn 5 phút.
- **T1.2 (F2):** Tra cứu `GET /api/v1/restaurants/roulette/status` phản ánh chính xác số lượt đã quay và lượt còn lại trong ngày (3/3).
- **T1.3 (F3):** Tra cứu `GET /api/v1/restaurants/roulette/session/:id` xác thực session hợp lệ, đúng thông tin món và quán ăn.
- **T1.4 (F4):** Đặt hàng thành công với `rouletteSessionId` hợp lệ kích hoạt cờ `coinBonusMultiplier: 2` và tiêu thụ phiên quay ngay lập tức.
- **T1.5 (F5):** Khởi tạo phòng đặt nhóm sinh mã phòng 6 ký tự viết hoa `roomCode`, Host là thành viên đầu tiên.
- **T1.6 (F6):** Đồng nghiệp tham gia phòng qua mã phòng và thêm món ăn vào giỏ hàng chung thành công.
- **T1.7 (F7):** Bộ máy tính tiền (Bill Splitting Engine) chia đều phí giao hàng 16.000đ cho các thành viên có đặt món.
- **T1.8 (F8):** Host khóa phòng và chốt đơn tạo thành đơn hàng `Order` hoàn chỉnh mang thông tin `groupOrderInfo`.

### Tier 2: Boundary Value Analysis (BVA) & Corner/Edge Cases
- **T2.1:** Giới hạn quay 3 lượt/ngày: Lượt quay thứ 4 trong cùng ngày trả về mã lỗi **HTTP 429** kèm thời gian đếm ngược đặt lại (`resetAt` & `resetInSeconds`).
- **T2.2:** Ranh giới hết hạn 5 phút: Phiên quay quá hạn 1 giây bị từ chối đặt hàng với **HTTP 400** (`SESSION_EXPIRED`).
- **T2.3:** Quyền sở hữu phiên: Người dùng B cố tình sử dụng phiên quay của người dùng A bị chặn ngay lập tức với **HTTP 403** (`USER_MISMATCH`).
- **T2.4:** Món trúng thưởng bắt buộc: Giỏ hàng không chứa đúng `menuItemId` đã trúng thưởng bị từ chối với **HTTP 400** (`ITEM_MISMATCH`).
- **T2.5:** Không phân biệt hoa thường mã phòng: Mã phòng nhập bằng chữ thường (`food88`) hoặc chữ hoa (`FOOD88`) đều truy vấn đúng phòng đặt nhóm.
- **T2.6:** Loại trừ thành viên không đặt món: Thành viên tham gia phòng nhưng chọn 0 món ăn được tính `shippingShare = 0đ` và `totalPayable = 0đ`.
- **T2.7:** Cơ chế khóa phòng: Khi phòng đã `LOCKED`, mọi hành động thêm món mới đều bị chặn với **HTTP 400**; khi Host mở khóa (`unlock: true`), việc thêm món hoạt động bình thường.
- **T2.8:** Chặn chốt đơn khi giỏ hàng nhóm rỗng: Giỏ hàng 0 món ăn bị từ chối chốt đơn với **HTTP 400**.

### Tier 3: Combinatorial Matrix Tests (Cart Combinations & Discounts)
- **T3.1:** Kèo ăn trưa 4 thành viên với số lượng món tùy chỉnh, phí ship 24.000đ chia đều mỗi người 6.000đ, tổng tiền nhóm và từng cá nhân được tính toán chính xác tuyệt đối.
- **T3.2:** Đơn hàng quay thưởng áp dụng song song Voucher của Quán (`storeVoucherDiscount`) kết hợp quyền lợi x2 Xu thưởng (`coinBonusMultiplier: 2`).

### Tier 4: Real-World Application Scenarios (1 – 5)
- **Scenario 1 (Solo Lucky Eater):** Người dùng quay vòng quay trúng món -> Chốt đơn ngay với session -> Đơn hàng chuyển sang `DELIVERED` -> Tự động cộng **2.000 Xu** vào tài khoản Auth Service và phát sự kiện `order.completed` qua RabbitMQ.
- **Scenario 2 (Office Lunch Party):** Trưởng nhóm tạo phòng -> 3 đồng nghiệp mở link tham gia -> Mỗi người chọn món yêu thích -> Phí ship chia đều 4 người -> Trưởng nhóm khóa phòng -> Chốt đơn hoàn tất thanh toán VNPay.
- **Scenario 3 (Quota Exhaustion & Next-Day Reset):** Người dùng quay hết 3 lượt -> Lượt thứ 4 bị chặn 429 -> Mô phỏng sang ngày mới (UTC+7) -> Cho phép quay tiếp bình thường.
- **Scenario 4 (Fraud Prevention):** Hệ thống chặn đứng 4 hình thức gian lận: dùng phiên hết hạn, dùng trộm phiên của người khác, đặt đơn bỏ quên món trúng thưởng, và tái sử dụng phiên đã đặt (replay attack).
- **Scenario 5 (Group Cart Conflict & Permissions):** Thành viên cố tình xóa món của người khác bị chặn **HTTP 403**, cố tình khóa phòng hoặc chốt đơn thay Host bị chặn **HTTP 403**, chỉ có thể tự xóa món của chính mình hoặc Host có quyền xóa.

---

## 4. Kết Quả Kiểm Thử Hồi Quy 5 Microservices (`npm test`)

```
==============================================================================
📊 BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ UNIT TEST (TEST MATRIX)
==============================================================================
TÊN MICROSERVICE          | TRẠNG THÁI   | THỜI GIAN  | CHI TIẾT TESTS
------------------------------------------------------------------------------
auth-service              | ✔ PASS       | 9.67s      | Tất cả Đạt
restaurant-service        | ✔ PASS       | 10.60s     | Tất cả Đạt
order-service             | ✔ PASS       | 4.05s      | Tất cả Đạt
payment-service           | ✔ PASS       | 1.75s      | Tất cả Đạt
delivery-service          | ✔ PASS       | 5.53s      | Tất cả Đạt
------------------------------------------------------------------------------
Tổng kết: 5/5 Services Pass | Thất bại: 0 | Tổng thời gian chạy: 31.61s

🎉 XUẤT SẮC! TOÀN BỘ 5 MICROSERVICES ĐỀU VƯỢT QUA TEST SUITE 100%!
```

---

## 5. Kết Quả Kiểm Tra Frontend Build & Tuân Thủ GEMINI.md

### Frontend Production Build
```
> food-delivery-frontend@1.0.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 1629 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     1.54 kB │ gzip:   0.78 kB
dist/assets/index-D5027aob.css    216.25 kB │ gzip:  37.28 kB
dist/assets/index-C-7QVPXR.js   1,481.74 kB │ gzip: 367.98 kB
✓ built in 10.60s
Exit Code: 0
```

### Tuân thủ Bộ Quy Tắc GEMINI.md
- **Icon `Sparkles` (Sao 4 cánh AI):** Kiểm tra toàn bộ mã nguồn `frontend/src` qua regex không phân biệt chữ hoa chữ thường: **0 kết quả**. Sử dụng các icon chuẩn TMĐT: `Gift`, `Users`, `Copy`, `Plus`, `Trash2`, `Lock`, `Unlock`, `CheckCircle`, `Clock`, `Flame`, `Coins`.
- **Màu sắc & Giao diện:** Sử dụng màu đỏ cam `#EE4D2D`, nâu vàng `#9a6a3e` / `#845831`, hỗ trợ mượt mà cả Light Mode và Dark Mode.
- **Toàn vẹn dữ liệu:** Không hardcode số liệu ảo, dữ liệu phòng nhóm và phiên quay thưởng lưu trữ và đồng bộ thực tế qua API.

---

## 6. Lệnh Tái Hiện & Kiểm Chứng Độc Lập (Reproduction Commands)

Người kiểm thử độc lập (Auditor / QA) có thể chạy các lệnh sau tại thư mục gốc `d:\aKTS\DM\foodorders`:

```bash
# 1. Chạy bộ kiểm thử tích hợp E2E mới (Tiers 1 - 4)
npm run test:e2e

# 2. Chạy toàn bộ test suites 5 backend microservices
npm test

# 3. Chạy test riêng cho Restaurant Service và Order Service
npm test --prefix services/restaurant-service
npm test --prefix services/order-service

# 4. Kiểm tra build sản phẩm Frontend
npm run build --prefix frontend

# 5. Kiểm tra nghiêm ngặt không tồn tại icon Sparkles trong frontend/src
powershell -Command "Get-ChildItem -Path frontend/src -Recurse -Include *.js,*.jsx,*.ts,*.tsx | Select-String -Pattern 'sparkles' -CaseSensitive:\$false"
```

---

## 7. Bảng Ký Duyệt Nghiệm Thu (Sign-off Checklist)

- [x] **R1 Backend Roulette:** Endpoint quay thưởng `$sample: 8`, session 5 phút, rate limit 3 lượt/ngày (HTTP 429).
- [x] **R2 Backend Roulette Checkout:** Xác thực session hợp lệ, đúng user, đúng món, cộng x2 Xu (2.000 Xu) khi giao thành công.
- [x] **R3 Backend Group Order:** Tạo phòng mã 6 ký tự, tham gia phòng, giỏ hàng chung, chia đều ship, Host khóa và chốt đơn.
- [x] **R4 Frontend Roulette UI:** Modal 8 ô hoạt họa CSS 3.5s dừng chuẩn xác `winnerIndex`, đếm lượt 3/3, đếm ngược 5:00, nút chốt đơn ngay.
- [x] **R5 Frontend Group Order UI:** Nút "Lập kèo ăn trưa", trang phòng nhóm `/group-order/:roomCode`, chia sẻ link 1-click, giỏ hàng theo thành viên, bảng chia tiền.
- [x] **Kiểm thử E2E:** 23/23 tests Đạt 100% bao quát Tiers 1-4 và 5 Scenarios thực tế.
- [x] **Kiểm thử hồi quy:** 5/5 backend services Đạt 100% (110 tests).
- [x] **Build Frontend:** Vite build thành công 0 lỗi.
- [x] **GEMINI.md Compliance:** 0 icon Sparkles, giao diện chuẩn FoodFast.

**KẾT LUẬN:** Hệ thống đạt chuẩn nghiệm thu kỹ thuật cao nhất và sẵn sàng cho môi trường Production.
