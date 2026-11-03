# Thiệp cưới online (giao diện "Minimalism Nâu")

Thiệp cưới một trang, dựng lại theo giao diện mẫu *Minimalism Nâu* của chungdoi.com: màn "Mở thiệp", ảnh bìa khung polaroid, thông tin lễ cưới, album ảnh xoay 3D, tiệc cưới + lịch tháng, bản đồ, dress code, lịch trình, sổ lưu bút, hộp quà mừng cưới (QR), nhạc nền. Có **hai bản thiệp** (nhà trai, nhà gái), trang **tạo link riêng cho từng khách** và trang **thống kê xác nhận tham dự**.

## Thư mục

```
noi-dung.md        ← MỌI CHỮ trên thiệp + đường dẫn ảnh. Sửa ở đây.
anh/
├── anh-cuoi/      ảnh bìa (01-anh-bia…)
├── album/         ảnh album 01, 02, … theo thứ tự hiện
├── mung-cuoi/     ảnh QR ngân hàng (nếu không dùng QR tự tạo)
├── chia-se/       ảnh xem trước khi gửi link (ngang 1200×630)
└── trang-tri/     hoa, lá, khung ảnh, giấy, icon lịch trình, hộp quà (ít khi đổi)
nhac/nhac-nen.mp3  nhạc nền
src/               khung giao diện (thiep.html, css, js, phông chữ) — thường không cần sửa
chung/, worker/    phần máy chủ: link ngắn, xác nhận tham dự, lời chúc (Cloudflare Worker)
website/           kết quả build — KHÔNG sửa tay (mỗi lần build bị tạo lại)
```

Ảnh/nhạc có ở cả `anh/` và `website/anh/` là bình thường: `website/` là bản thành phẩm tự chép ra khi build.

## Chạy thử trên máy

Cần [Node.js](https://nodejs.org) 18 trở lên.

```
npm run dev
```

Mở `http://localhost:8080/nha-trai/` (thiệp nhà gái: `/nha-gai/`). Sửa `noi-dung.md` hay ảnh rồi tải lại trang là thấy. Dữ liệu thử (link, xác nhận, lời chúc) lưu trong `*.local.json` — xoá đi khi xong.

## Sửa nội dung

Mở `noi-dung.md`, sửa phần sau dấu `:` của từng dòng. `|` = xuống dòng. Ngày viết `03/01/2026`, giờ `18:00` — **thứ trong tuần, lịch tháng có trái tim, dòng "3 tháng 1, 2026" ở màn mở thiệp đều tự tính**. Ngày âm lịch thì tự ghi (kiểm tra lại cho khớp ngày dương).

- **Ẩn bớt phần:** đặt `không` ở các mục `Hiện … (có/không)` (dress code, lịch trình, sổ lưu bút, hộp quà, nút xác nhận tham dự). Để trống "Dress code - màu" cũng ẩn dress code.
- **Album:** thêm/bớt dòng `- Album ảnh NN: …` (tối đa 30). Ảnh dọc hay ngang đều được.
- **Lịch trình:** mỗi mốc 3 dòng (giờ, hoạt động, icon). Icon có sẵn: `gate.webp`, `cake.webp`, `water.webp` trong `anh/trang-tri/`.
- **Bản đồ:** điền "Địa điểm - toạ độ" (vĩ độ,kinh độ lấy từ Google Maps) để ghim đúng chỗ, và "link bản đồ" để nút Chỉ đường mở đúng điểm.

**Đổi ảnh:** chép ảnh vào `anh/…` rồi sửa đường dẫn trong `noi-dung.md`. Ảnh máy ảnh rất nặng — thu nhỏ còn khoảng 1000×1500 px (≈200–300 KB) trước khi dùng. Ảnh xem trước khi gửi link (`anh/chia-se/`) nên là ảnh **ngang 1200×630** thấy rõ mặt.

**Hộp quà mừng cưới:** điền ngân hàng, mã ngân hàng (`vcb`, `tcb`, `mb`, `acb`, `bidv`, `vietinbank`, `tpbank`…), số tài khoản, chủ tài khoản. Không có ảnh QR thì thiệp tự tạo mã VietQR (qua img.vietqr.io). Muốn dùng ảnh QR chụp từ app ngân hàng thì chép vào `anh/mung-cuoi/` và điền "ảnh QR". Nhớ quét thử QR trên thiệp trước khi gửi.

## Hiệu ứng (đã đối chiếu với mã nguồn của mẫu)

- **Mở thiệp:** bấm → tiếng "ting" + nhạc nền, dấu sáp vỡ, lá bay tung toé, thẻ bay lên, 1,3 giây sau lộ thiệp.
- **Tự động cuộn:** 2 giây sau khi mở thiệp, trang tự cuộn xuống 50px/giây (đổi tốc độ bằng `?scroll=100` thêm vào cuối địa chỉ). Khách lăn chuột, chạm màn hình hay gõ vào ô nhập thì dừng; **bấm vào chỗ trống** để dừng/chạy tiếp.
- **Album:** ảnh xoay 3D, tự chuyển mỗi 1,4 giây (dừng khi rê chuột/chạm); bấm ảnh giữa để xem lớn — phóng 2,5× bằng bấm đúp, hai ngón để phóng/thu, kéo khi đã phóng, vuốt ngang đổi ảnh.
- Hoa, lá nổi nhẹ; chữ tên cô dâu chú rể tự co theo khung (31px điện thoại, 46px máy tính).
- Nút nhạc: bong bóng "Chạm để phát nhạc" khi trình duyệt chặn tự phát.

## Hai bản thiệp: nhà trai, nhà gái

- `…/nha-trai/` (cũng là trang chủ): dùng toàn bộ nội dung trong `noi-dung.md`.
- `…/nha-gai/`: giống nhà trai, trừ các dòng `Thiệp nhà gái - …` đã điền ở mục 15 (giờ, ngày, nơi tổ chức, "LỄ VU QUY"…; cô dâu đứng trước). Khi build, dòng `ℹ️ Thiệp nhà gái chưa điền…` liệt kê mục đang dùng tạm của nhà trai — **đừng gửi link nhà gái khi chưa điền**.
- Chỉ có một tiệc chung: để trống mục 15 và chỉ gửi link nhà trai.

## Tạo link cho khách

Khách nhà trai: `…/nha-trai/tao-link/`; khách nhà gái: `…/nha-gai/tao-link/`. Gõ **Người nhận** (vd. "Anh Đức và người thương") → **Tạo link** → link ngắn `…/nha-trai/anh-duc-va-nguoi-thuong`.

- Gửi qua Zalo/Messenger: dòng đậm là tiêu đề thiệp, dòng dưới "**Mời** Anh Đức và người thương".
- Trên thiệp: tên khách hiện dưới chữ "Thân Mời" ở màn mở thiệp, và được điền sẵn vào ô tên khi xác nhận tham dự / gửi lời chúc.

## Xác nhận tham dự, sổ lưu bút, thống kê

- Khách bấm **XÁC NHẬN THAM DỰ** → nhập tên (link riêng thì tên điền sẵn), chọn đến/không đến, số khách (bộ đếm − 1 +), lời nhắn tuỳ chọn. Gửi lại thì lần mới ghi đè lần cũ. Lời nhắn hiện ở trang thống kê.
- **Sổ lưu bút:** lời chúc hiện ngay trên thiệp cho mọi người xem (chung hai bên). Nút 🪄 mở popup 5 lời chúc gợi ý để khách chọn.
- Xem ở `…/nha-trai/thong-ke/` và `…/nha-gai/thong-ke/`: số khách tham gia, số người, danh sách, tải Excel (CSV); bên dưới là **danh sách lời chúc, có nút Xoá** cho lời chúc không phù hợp.

## Đăng lên mạng (Cloudflare Workers)

1. `"name"` trong `wrangler.jsonc` (đang là `nam-3-ngo`) = tên Worker trên Cloudflare.
2. **Qua GitHub (khuyên dùng):** đưa thư mục này lên một repo GitHub (**để Private** nếu không muốn lộ số tài khoản, địa chỉ). Cloudflare → *Workers & Pages → Create → Import a repository* → chọn repo. *Build command*: `node build.js`; *Deploy command*: `npx wrangler deploy`.
   **Từ máy:** `npm run deploy` (lần đầu mở trình duyệt để đăng nhập Cloudflare).
3. Lần deploy đầu, Cloudflare tự tạo kho dữ liệu KV `LIEN_KET` — không cần làm gì thêm.
4. Mật khẩu (tuỳ chọn) — Worker → *Settings → Variables and Secrets*, loại **Secret**: `MAT_KHAU_TAO_LINK`, `MAT_KHAU_THONG_KE`. Không đặt thì ai biết địa chỉ trang thống kê cũng xem/xoá được.
5. Sửa `Địa chỉ website` ở mục 14 trong `noi-dung.md` thành địa chỉ thật (vd. `https://nam-3-ngo.ten-tai-khoan.workers.dev`) rồi đẩy lại — ảnh xem trước khi gửi link cần địa chỉ này. Thử bằng một **link mới** (Zalo/Messenger nhớ khung xem trước cũ).

Thử y như trên Cloudflare: `npm run cf-dev` → `http://localhost:8788`.

## Khác so với mẫu gốc

- Bỏ: nút chat Messenger, dòng "♡ chungdoi.com", mã theo dõi, khoá Google Maps của mẫu, tài khoản ngân hàng/QR giả của mẫu.
- Thêm: số người đi cùng khi xác nhận tham dự, nút "Chép STK" trong hộp quà, trang thống kê, link riêng từng khách, bản thiệp nhà gái.
- Ảnh cưới, nhạc nền ("Hôn ca yêu" – Đức Phúc) và mọi tên/ngày trong `noi-dung.md` hiện là **dữ liệu mẫu** — thay bằng của hai bạn trước khi gửi thiệp.
