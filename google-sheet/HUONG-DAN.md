# Lưu lời chúc của khách vào Google Sheet

Làm một lần, mất khoảng 5 phút.

1. Vào <https://sheets.google.com>, tạo một bảng tính mới (đặt tên tuỳ ý, ví dụ "Lời chúc đám cưới").
2. Trên menu chọn **Tiện ích mở rộng → Apps Script**.
3. Xoá hết code có sẵn, dán toàn bộ nội dung file [`Code.gs`](Code.gs) vào, bấm 💾 **Lưu**.
4. Bấm **Triển khai → Tùy chọn triển khai mới**:
   - Bấm ⚙️ cạnh "Chọn loại" → chọn **Ứng dụng web**.
   - **Thực thi với tư cách:** Tôi.
   - **Người có quyền truy cập:** Bất kỳ ai.
   - Bấm **Triển khai**, rồi **Cho phép truy cập** và đăng nhập Google. Nếu thấy "Google chưa xác minh ứng dụng này" → **Nâng cao → Đi tới … (không an toàn)** (đây là script của chính bạn).
5. Sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/.../exec`).
6. Mở `noi-dung.md`, dán URL vào dòng:

   ```
   - Lời chúc - link Google Sheet: https://script.google.com/macros/s/.../exec
   ```

7. Chạy `npm run build` rồi đăng lại thư mục `website/`.

Mỗi lời chúc sẽ thành một dòng trong trang tính **Lời chúc**: thời gian, họ tên, mối quan hệ, có tham dự không, lời chúc, tên khách trong link (nếu có) và link khách đã mở.

> Nếu sau này sửa `Code.gs`, phải vào **Triển khai → Quản lý các lần triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai** thì thay đổi mới có hiệu lực (URL giữ nguyên).
