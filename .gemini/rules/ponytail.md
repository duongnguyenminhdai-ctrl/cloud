# Ponytail — Tối Giản Hóa Code & Chống Over-Engineering

> **Triết lý cốt lõi:** *"The best code is the code you never wrote"* (Đoạn code tốt nhất là đoạn code không cần phải viết). Tư duy như một *lazy senior developer* để giữ codebase luôn tinh gọn, trực diện, dễ đọc và dễ bảo trì.

---

## 1. Thang Ưu Tiên 7 Bậc (The 7-Rung Ladder)

Trước khi viết bất kỳ đoạn code mới nào, Agent **bắt buộc** phải duyệt từ trên xuống dưới qua 7 bậc này và dừng lại ở bậc đầu tiên giải quyết được vấn đề:

1. **YAGNI (Does this need to exist?):**
   * Tính năng hay cấu hình này có thực sự cần thiết không?
   * Loại bỏ ngay các abstraction phỏng đoán trước tương lai, các wrapper vô nghĩa, hoặc các tính năng người dùng không yêu cầu.
2. **Already in the codebase (Đã có sẵn trong Repo):**
   * Kiểm tra xem repo đã có sẵn helper, hook, service, utils hoặc component nào tương tự chưa.
   * *Ưu tiên tái sử dụng* các hàm dùng chung đã có (`apiClient`, `imageHelpers`, `realtimeSync`, `settlementEngine`, v.v.) thay vì viết mới.
3. **Standard Library (Thư viện chuẩn của ngôn ngữ):**
   * Sử dụng tối đa các phương thức có sẵn của JavaScript / Node.js (như `Array.prototype.find/filter/map/reduce`, `Set`, `URLSearchParams`, `Intl`, `Math`, `Promise`).
4. **Native Platform Feature (Tính năng gốc của nền tảng):**
   * Ưu tiên các tính năng gốc của trình duyệt và DOM (ví dụ: HTML5 native attributes, Tailwind utility classes có sẵn) thay vì cài cắm plugin/library phức tạp.
5. **Installed Dependency (Tận dụng dependency đã cài đặt):**
   * Chỉ sử dụng các packages đã có trong `package.json`.
   * **Tuyệt đối không tự ý cài đặt thêm package mới** chỉ để thay thế vài dòng logic đơn giản.
6. **One Line (Viết gọn trong một dòng nếu sạch sẽ):**
   * Nếu giải pháp có thể viết ngắn gọn, rõ ràng trong 1-2 dòng code, hãy giữ nguyên như vậy. Tránh chia tách thành quá nhiều hàm/file nhỏ vụn vặt không cần thiết.
7. **Minimum Viable (Chỉ viết code tối thiểu cần thiết):**
   * Viết số dòng code ít nhất có thể để hoàn thành đúng và đủ yêu cầu.

---

## 2. Giới Hạn Bắt Buộc (Hard Boundaries — Không Bao Giờ Cắt Giảm)

Tối giản không đồng nghĩa với cẩu thả. Ponytail **tuyệt đối không cắt bỏ** các thành phần sau:
* **Bảo mật & Phân quyền:** Luôn giữ vững kiểm tra xác thực (JWT), phân quyền vai trò (Role ADMIN, MERCHANT, USER), chống NoSQL/SQL Injection.
* **Xử lý lỗi (Error Handling):** Bắt buộc có `try/catch` hoặc fallback ở các vị trí có nguy cơ gây crash app hoặc mất dữ liệu người dùng.
* **Quy tắc nghiệp vụ cốt lõi (`GEMINI.md`):** Luôn tuân thủ tuyệt đối các quy tắc nghiệp vụ của FoodFast:
  * Dữ liệu và dòng tiền thật 100% (không hardcode số ảo).
  * Chuẩn trải nghiệm Shopee-style, Realtime SSE/RabbitMQ, Firebase Phone Auth.
* **Kiểm thử & Build Verification:** Luôn chạy kiểm tra `npm test` và `npm run build` để đảm bảo code hoạt động hoàn hảo không lỗi trước khi bàn giao.

