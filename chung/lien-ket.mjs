/*
 * Link ngắn cho từng khách: dùng chung cho Cloudflare Worker (worker/index.mjs) và máy chủ xem thử (build.js --serve).
 *
 * Mỗi link ngắn (vd. /nha-trai/ban-duc-va-nguoi-thuong, /nha-gai/co-lan) được lưu kèm tiêu đề và tên khách.
 * Link cũ không có /nha-trai/ hay /nha-gai/ (vd. /ban-duc) vẫn mở được, hiện thiệp nhà trai.
 * Khi có người mở link (kể cả Zalo/Messenger đọc để làm khung xem trước), máy chủ chèn:
 *   - tiêu đề xem trước: "<tiêu đề thiệp> – Mời <tiêu đề bạn nhập>"
 *   - tên khách vào dòng "Thư Mời" và màn hình mở thiệp
 */

// Tên thư mục có thật trên website — không dùng làm link để tránh trùng
export const TEN_DANH_RIENG = ['anh', 'css', 'js', 'fonts', 'nhac', 'tao-link', 'api', 'index', '404', 'nha-trai', 'nha-gai', 'thong-ke'];

// Hai bản thiệp: /nha-trai/ và /nha-gai/ (mỗi bên có trang /tao-link/ riêng)
export const CAC_BEN = ['nha-trai', 'nha-gai'];

export function taoDuongDan(tieuDe) {
  let s = String(tieuDe || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  if (TEN_DANH_RIENG.includes(s)) s += '-1';
  return s;
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tiêu đề xem trước cho một link: thêm "Mời ..." (không lặp chữ "Mời" nếu bạn đã gõ). */
export function phanMoi(tieuDe) {
  const t = String(tieuDe || '').trim();
  return /^mời(\s|$)/i.test(t) ? t : 'Mời ' + t;
}

/** Chèn tiêu đề và tên khách của link vào HTML thiệp. */
export function chenThongTin(html, duLieu) {
  const them = escHtml(phanMoi(duLieu.tieuDe));
  html = html.replace(/<title>([^<]*)<\/title>/, (_, cu) => `<title>${cu} – ${them}</title>`);
  // Khung xem trước (Zalo/Messenger/Facebook) hiện tiêu đề ở dòng trên, mô tả ở dòng dưới:
  // dòng 1 = tên thiệp, dòng 2 = "Mời ..." (thay cho mô tả mặc định là ngày cưới)
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a, b) => `${a}${them}${b}`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => `${a}${them}${b}`);
  if (duLieu.khach) {
    html = html.replace(/(<span data-khach-moi>)[^<]*(<\/span>)/g, (_, a, b) => a + escHtml(duLieu.khach) + b);
  }
  return html;
}

/**
 * Tạo (hoặc dùng lại) link ngắn.
 * kho: { get(khoa) -> Promise<obj|null>, set(khoa, obj) -> Promise }
 * Trả về { trangThai, duLieu } để nơi gọi tự trả JSON.
 */
export async function taoLinkMoi(kho, body, matKhau) {
  if (matKhau && body.matKhau !== matKhau) return { trangThai: 401, duLieu: { loi: 'Sai mật khẩu tạo link.' } };
  // Chỉ cần 1 ô "người nhận": vừa là tiêu đề "Mời ..." khi chia sẻ, vừa là tên ở dòng "Thư Mời" (bỏ chữ "Mời" đứng đầu).
  // Vẫn nhận tieuDe/khach riêng để tương thích với bản cũ.
  const nguoiNhan = String(body.nguoiNhan ?? body.tieuDe ?? '').trim().slice(0, 120);
  const tieuDe = nguoiNhan;
  const khach = String(body.khach ?? (nguoiNhan.replace(/^mời\s+/i, '').trim() || nguoiNhan)).trim().slice(0, 120);
  const ben = CAC_BEN.includes(body.ben) ? body.ben : CAC_BEN[0];
  const ten = taoDuongDan(tieuDe);
  if (!ten) return { trangThai: 400, duLieu: { loi: 'Tiêu đề cần có ít nhất một chữ cái hoặc chữ số.' } };
  const goc = `${ben}/${ten}`;
  let duongDan = goc;
  for (let i = 2; ; i++) {
    const cu = await kho.get(duongDan);
    if (!cu) break;
    if (cu.tieuDe === tieuDe && cu.khach === khach) return { trangThai: 200, duLieu: { duongDan: duongDan.slice(ben.length + 1) } }; // đã có sẵn
    duongDan = `${goc}-${i}`; // trùng đường dẫn nhưng khác nội dung: thêm số
  }
  await kho.set(duongDan, { tieuDe, khach, ben, tao: new Date().toISOString() });
  // Trang tạo link nằm trong thư mục của bên đó nên chỉ cần phần tên (vd. "co-lan")
  return { trangThai: 200, duLieu: { duongDan: duongDan.slice(ben.length + 1) } };
}

/** Lấy đường dẫn ngắn từ URL ("nha-gai/co-lan", hoặc "ban-duc" với link cũ), hoặc '' nếu không phải link thiệp. */
export function layDuongDan(pathname) {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch (e) { /* giữ nguyên */ }
  p = p.replace(/^\/+|\/+$/g, '');
  if (!p || p.includes('.')) return '';
  const phan = p.split('/');
  if (phan.length === 1) return CAC_BEN.includes(p) ? '' : p;
  return phan.length === 2 && CAC_BEN.includes(phan[0]) && !['tao-link', 'thong-ke'].includes(phan[1]) ? p : '';
}

/** Bên của một link ngắn: link cũ (không có thư mục) là nhà trai. */
export function benCuaLink(duongDan) {
  const dau = duongDan.split('/')[0];
  return CAC_BEN.includes(dau) && duongDan.includes('/') ? dau : CAC_BEN[0];
}
