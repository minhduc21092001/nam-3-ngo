/*
 * Sổ lưu bút (lời chúc): dùng chung cho Cloudflare Worker (worker/index.mjs) và máy chủ xem thử (build.js --serve).
 *
 *   POST /api/loi-chuc { ten, loiChuc, ben }  -> { ok, danhSach }   khách gửi lời chúc
 *   POST /api/loi-chuc { xem: true }          -> { danhSach }       thiệp tải danh sách lời chúc (mới nhất trước)
 * Lời chúc của cả hai bên hiện chung trên cả hai thiệp. Xoá lời chúc ở trang thống kê (/nha-trai/thong-ke/).
 * kho: như chung/xac-nhan.mjs (set, xoa, list).
 */
import { CAC_BEN } from './lien-ket.mjs';

export const TIEN_TO_LOI_CHUC = 'loi-chuc/';
const TOI_DA = 200; // số lời chúc trả về cho thiệp
const cat = (s, n) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

export async function danhSachLoiChuc(kho) {
  const ds = await kho.list(TIEN_TO_LOI_CHUC);
  return ds.sort((a, b) => String(b.luc).localeCompare(String(a.luc))).slice(0, TOI_DA)
    .map(({ khoa, ten, loiChuc, ben, luc }) => ({ khoa, ten, loiChuc, ben, luc }));
}

export async function xuLyLoiChuc(kho, body) {
  if (body.xem) return { trangThai: 200, duLieu: { danhSach: (await danhSachLoiChuc(kho)).map(({ khoa, ...x }) => x) } };
  const ten = cat(body.ten, 60).replace(/\n/g, ' ');
  const loiChuc = cat(body.loiChuc, 500);
  if (!ten) return { trangThai: 400, duLieu: { loi: 'Bạn chưa nhập tên.' } };
  if (!loiChuc) return { trangThai: 400, duLieu: { loi: 'Bạn chưa nhập lời chúc.' } };
  const ben = CAC_BEN.includes(body.ben) ? body.ben : CAC_BEN[0];
  const luc = new Date().toISOString();
  const khoa = `${TIEN_TO_LOI_CHUC}${luc}-${Math.random().toString(36).slice(2, 8)}`;
  await kho.set(khoa, { ten, loiChuc, ben, luc });
  return { trangThai: 200, duLieu: { ok: true, danhSach: (await danhSachLoiChuc(kho)).map(({ khoa: _k, ...x }) => x) } };
}
