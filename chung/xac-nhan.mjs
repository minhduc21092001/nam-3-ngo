/*
 * Xác nhận tham dự: dùng chung cho Cloudflare Worker (worker/index.mjs) và máy chủ xem thử (build.js --serve).
 *
 * kho: {
 *   set(khoa, obj) -> Promise, xoa(khoa) -> Promise,
 *   list(tienTo) -> Promise<[{ khoa, ...obj }]>
 * }
 * Mỗi khách một bản ghi "xac-nhan/<bên>/<tên viết thường>": khách gửi lại (cùng bên, cùng tên) thì lần mới ghi đè
 * lần cũ, nên thống kê luôn theo lần điền gần nhất.
 */
import { CAC_BEN } from './lien-ket.mjs';
import { TIEN_TO_LOI_CHUC, danhSachLoiChuc } from './loi-chuc.mjs';

export const TIEN_TO = 'xac-nhan/';
// Mật khẩu riêng từng bên (tuỳ chọn): MAT_KHAU_THONG_KE_NHA_TRAI, MAT_KHAU_THONG_KE_NHA_GAI; không có thì dùng MAT_KHAU_THONG_KE
export const tenBienMatKhau = (ben) => 'MAT_KHAU_THONG_KE_' + ben.toUpperCase().replace(/-/g, '_');
export const layMatKhau = (bien, ben) => bien[tenBienMatKhau(ben)] || bien.MAT_KHAU_THONG_KE || bien.MAT_KHAU_TAO_LINK || '';
const cat = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// "Anh  Đức" và "anh đức" là cùng một khách
const khoaTen = (ten) => ten.normalize('NFC').toLowerCase();

/** Lưu một xác nhận. Trả về { trangThai, duLieu } để nơi gọi tự trả JSON. */
export async function luuXacNhan(kho, body) {
  const ten = cat(body.ten, 100);
  if (!ten) return { trangThai: 400, duLieu: { loi: 'Bạn chưa nhập tên.' } };
  const thamDu = body.thamDu === 'co' || body.thamDu === 'khong' ? body.thamDu : '';
  if (!thamDu) return { trangThai: 400, duLieu: { loi: 'Bạn chưa chọn có đến hay không.' } };
  const soNguoi = thamDu === 'co' ? Math.min(100, Math.max(1, parseInt(body.soNguoi, 10) || 1)) : 0;
  const ben = CAC_BEN.includes(body.ben) ? body.ben : CAC_BEN[0];
  const luc = new Date().toISOString();
  const banGhi = { ben, ten, thamDu, soNguoi, khachMoi: cat(body.khachMoi, 100), loiNhan: cat(body.loiNhan, 300), duongDan: cat(body.duongDan, 120), luc };
  await kho.set(`${TIEN_TO}${ben}/${khoaTen(ten)}`, banGhi);
  return { trangThai: 200, duLieu: { ok: true } };
}

/** Bên mà trang thống kê hỏi tới ('' nếu không hợp lệ). */
export const benThongKe = (body) => (CAC_BEN.includes(body.ben) ? body.ben : '');

/**
 * Trang thống kê của một bên: { ben, matKhau, xoa? } -> { danhSach } (chỉ xác nhận của bên đó).
 * matKhau: mật khẩu đúng (trống = không cần, chỉ dùng khi xem thử trên máy); batBuoc: trên mạng thì bắt buộc có mật khẩu.
 */
export async function thongKe(kho, body, matKhau, batBuoc) {
  const ben = benThongKe(body);
  if (!ben) return { trangThai: 400, duLieu: { loi: 'Thiếu bên (nha-trai / nha-gai).' } };
  const tienTo = `${TIEN_TO}${ben}/`;
  if (batBuoc && !matKhau) {
    return { trangThai: 503, duLieu: { loi: `Chưa đặt mật khẩu xem thống kê: thêm biến MAT_KHAU_THONG_KE (hoặc ${tenBienMatKhau(ben)}) trong Cloudflare (Settings → Variables and Secrets) rồi deploy lại.` } };
  }
  if (matKhau && body.matKhau !== matKhau) return { trangThai: 401, duLieu: { loi: 'Sai mật khẩu.' } };
  if (body.xoa) {
    // Xoá xác nhận của bên này, hoặc một lời chúc trong sổ lưu bút (sổ lưu bút chung cho hai bên)
    const xoa = String(body.xoa);
    if (!xoa.startsWith(tienTo) && !xoa.startsWith(TIEN_TO_LOI_CHUC)) return { trangThai: 400, duLieu: { loi: 'Không xoá được mục này.' } };
    await kho.xoa(xoa);
  }
  const danhSach = (await kho.list(tienTo)).sort((a, b) => String(b.luc).localeCompare(String(a.luc)));
  return { trangThai: 200, duLieu: { danhSach, loiChuc: await danhSachLoiChuc(kho) } };
}
