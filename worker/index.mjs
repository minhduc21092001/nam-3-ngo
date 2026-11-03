/*
 * Cloudflare Worker của thiệp (cấu hình trong wrangler.jsonc).
 * File tĩnh trong website/ (thiệp, ảnh, trang tạo link, trang thống kê) Cloudflare tự trả, không chạy qua đây.
 * Worker chỉ nhận các đường dẫn không có file tương ứng:
 *   POST /api/tao-link   { nguoiNhan, ben, matKhau? }        -> { duongDan }     tạo link ngắn
 *   POST /api/xac-nhan   { ben, ten, thamDu, soNguoi, ... }  -> { ok }           khách xác nhận tham dự
 *   POST /api/thong-ke   { ben, matKhau, xoa? }              -> { danhSach, loiChuc }  trang /nha-trai|nha-gai/thong-ke/
 *   POST /api/loi-chuc   { ten, loiChuc, ben } | { xem }      -> { danhSach }     sổ lưu bút trên thiệp
 *   GET  /nha-trai/<ten>, /nha-gai/<ten> (và /<ten> của link cũ) -> thiệp có tiêu đề xem trước + tên khách riêng
 *   GET  đường dẫn lạ khác -> thiệp của bên đó (hoặc thiệp nhà trai)
 * Dữ liệu lưu trong KV "LIEN_KET". Mật khẩu tuỳ chọn (Settings → Variables and Secrets, loại Secret; không đặt = không cần):
 *   MAT_KHAU_TAO_LINK, MAT_KHAU_THONG_KE, MAT_KHAU_THONG_KE_NHA_TRAI, MAT_KHAU_THONG_KE_NHA_GAI.
 */
import { CAC_BEN, taoLinkMoi, chenThongTin, layDuongDan, benCuaLink } from '../chung/lien-ket.mjs';
import { luuXacNhan, thongKe, benThongKe, layMatKhau } from '../chung/xac-nhan.mjs';
import { layKho } from '../chung/kho-cloudflare.mjs';
import { xuLyLoiChuc } from '../chung/loi-chuc.mjs';

const json = (trangThai, duLieu) => new Response(JSON.stringify(duLieu), {
  status: trangThai,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const API = {
  '/api/tao-link': (kho, body, env) => taoLinkMoi(kho, body, env.MAT_KHAU_TAO_LINK),
  '/api/xac-nhan': (kho, body) => luuXacNhan(kho, body),
  '/api/loi-chuc': (kho, body) => xuLyLoiChuc(kho, body),
  // Không đặt mật khẩu thì ai có địa chỉ trang thống kê cũng xem được
  '/api/thong-ke': (kho, body, env) => thongKe(kho, body, layMatKhau(env, benThongKe(body) || 'x'), false),
};

async function xuLyApi(request, env, xuLy) {
  if (request.method !== 'POST') return json(405, { loi: 'Chỉ nhận POST.' });
  const kho = layKho(env);
  if (!kho) return json(500, { loi: 'Chưa gắn KV namespace "LIEN_KET" cho Worker.' });
  let body = {};
  try { body = await request.json(); } catch (e) { return json(400, { loi: 'Dữ liệu không hợp lệ.' }); }
  const kq = await xuLy(kho, body, env);
  return json(kq.trangThai, kq.duLieu);
}

// Trang thiệp của một bên ('' = trang chủ, thiệp nhà trai)
const layThiep = (env, url, ben) => env.ASSETS.fetch(new URL(ben ? `/${ben}/` : '/', url));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const xuLy = API[url.pathname];
    if (xuLy) return xuLyApi(request, env, xuLy);
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

    const duongDan = layDuongDan(url.pathname);
    // Không phải link thiệp (vd. ảnh không tồn tại): trả 404 như thường
    if (!duongDan) return env.ASSETS.fetch(request);

    const kho = layKho(env);
    const duLieu = kho ? await kho.get(duongDan).catch(() => null) : null;
    const ben = CAC_BEN.some((b) => duongDan.startsWith(b + '/')) ? benCuaLink(duongDan) : '';
    const res = await layThiep(env, url, duLieu ? benCuaLink(duongDan) : ben);
    if (!duLieu || !(res.headers.get('content-type') || '').includes('text/html')) return res;

    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('etag');
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
    return new Response(chenThongTin(await res.text(), duLieu), { status: 200, headers });
  },
};
