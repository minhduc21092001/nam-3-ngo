#!/usr/bin/env node
/*
 * Tạo website thiệp cưới từ noi-dung.md + src/ + anh/ + nhac/  →  thư mục website/
 *
 *   node build.js           tạo website/: thiệp nhà trai /nha-trai/, nhà gái /nha-gai/ (trang chủ = nhà trai),
 *                           mỗi bên có /tao-link/ và /thong-ke/ (xác nhận tham dự + lời chúc)
 *   node build.js --serve   tạo website/, mở máy chủ xem thử và tự tạo lại khi bạn sửa file
 *
 * Giao diện dựng lại từ mẫu "Minimalism Nâu" (Chung Đôi). Không cần cài thêm thư viện nào (chỉ cần Node.js 18+).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const GOC = __dirname;
const RA = path.join(GOC, 'website');
const FILE_NOI_DUNG = path.join(GOC, 'noi-dung.md');

const SO_ALBUM_TOI_DA = 30;
const SO_LICH_TRINH_TOI_DA = 12;
const SO_TAI_KHOAN_TOI_DA = 4;
const SO_MAU_TOI_DA = 8;
// Múi giờ Việt Nam (cho nút "Thêm vào lịch")
const MUI_GIO = 7;

/* ------------------------------------------------------------------ hai bản thiệp: nhà trai, nhà gái */
// Thiệp nhà gái dùng chung nội dung, trừ các mục "Thiệp nhà gái - <tên mục>" đã điền trong noi-dung.md.
// Tiền tố phải KHÁC mọi nhãn sẵn có (đã có nhãn "Nhà gái - bố"… nên không dùng "Nhà gái - ").
const CAC_BEN = [
  { ben: 'nha-trai', ten: 'Nhà trai', tienTo: 'Thiệp nhà trai - ' },
  { ben: 'nha-gai', ten: 'Nhà gái', tienTo: 'Thiệp nhà gái - ' },
];
const LA_MUC_RIENG = /^thiệp nhà (trai|gái)\s*-\s*/i;
// Các mục đánh số: điền một dòng trong nhóm là thay cả nhóm (vd. cả album, cả lịch trình)
const NHOM_DANH_SO = [/^album ảnh /, /^lịch trình \d+ -/];
// "Cô dâu đứng trước (có/không): có" (thường cho thiệp nhà gái): đổi chỗ các cặp nhãn khi điền khung thiệp
const CAP_DOI_CHO = [
  ['Tên gọi chú rể', 'Tên gọi cô dâu'], ['Tên chú rể', 'Tên cô dâu'], ['Chú rể - thứ bậc', 'Cô dâu - thứ bậc'],
  ['Nhà trai - xưng hô', 'Nhà gái - xưng hô'], ['Nhà trai - bố', 'Nhà gái - bố'], ['Nhà trai - mẹ', 'Nhà gái - mẹ'],
  ['Nhà trai - địa chỉ', 'Nhà gái - địa chỉ'],
];

class LoiNoiDung extends Error {}

/* ------------------------------------------------------------------ đọc noi-dung.md */
function chuanHoa(nhan) {
  return nhan.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function docNoiDung() {
  const dong = fs.readFileSync(FILE_NOI_DUNG, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const batDau = dong.findIndex((d) => d.trim() === '---'); // phần giải thích ở đầu file bỏ qua
  const muc = new Map();
  dong.slice(batDau + 1).forEach((d, i) => {
    const m = d.match(/^\s*[-*]\s+([^:]+?)\s*:\s?(.*)$/);
    if (!m) return;
    const khoa = chuanHoa(m[1]);
    if (muc.has(khoa)) console.warn(`⚠️  noi-dung.md dòng ${batDau + i + 2}: mục "${m[1]}" bị lặp, dùng giá trị sau cùng.`);
    muc.set(khoa, { nhan: m[1].trim(), giaTri: m[2].trim() });
  });
  return muc;
}

// Nội dung của một bên: nội dung chung + các mục riêng của bên đó ghi đè. Ghi "-" = để trống hẳn (không lấy giá trị chung)
function mucTheoBen(muc, { tienTo, ten }) {
  const t = chuanHoa(tienTo);
  const rieng = [...muc].filter(([k]) => k.startsWith(t))
    .map(([k, m]) => [k.slice(t.length).trim(), { nhan: m.nhan.normalize('NFC').replace(LA_MUC_RIENG, ''), giaTri: m.giaTri === '-' ? '' : m.giaTri, ghi: !!m.giaTri }]);
  const kq = new Map([...muc].filter(([k]) => !LA_MUC_RIENG.test(k)));
  const thayNhom = NHOM_DANH_SO.filter((re) => rieng.some(([k, m]) => re.test(k) && m.ghi));
  for (const re of thayNhom) for (const k of [...kq.keys()]) if (re.test(k)) kq.delete(k);
  // Một mốc lịch trình để trống cả 3 dòng thì bỏ mốc đó
  const moc = (k) => (/^(lịch trình \d+) -/.exec(k) || [, k])[1];
  const mocCoChu = new Set(rieng.filter(([, m]) => m.ghi).map(([k]) => moc(k)));
  const chuaDien = [];
  for (const [k, m] of rieng) {
    if (m.ghi || (thayNhom.some((re) => re.test(k)) && mocCoChu.has(moc(k)))) kq.set(k, m);
    else if (!NHOM_DANH_SO.some((re) => re.test(k))) chuaDien.push(m.nhan);
  }
  if (chuaDien.length) console.warn(`ℹ️  Thiệp ${ten.toLowerCase()} chưa điền (đang dùng giống phần chung): ${chuaDien.join(', ')}`);
  return kq;
}

/* ------------------------------------------------------------------ tiện ích */
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escHtml(s).replace(/"/g, '&quot;');
// "|" = xuống dòng, "\|" = ký tự | thật. Như mẫu: nối chữ cuối mỗi dòng với chữ trước nó (nbsp) để không rơi một chữ xuống dòng
const GACH = '\u0000';
const khongMoCoi = (s) => s.replace(/ (\S+)$/, ' $1');
const nhieuDong = (s) => s.replace(/\\\|/g, GACH).split('|').map((x) => khongMoCoi(escHtml(x.trim())).replace(/\u0000/g, '|')).join('<br>');
const laLinkNgoai = (s) => /^(https?:)?\/\//i.test(s) || s.startsWith('data:');
const laKhong = (v) => /^(không|khong|ko|no|0|ẩn)$/i.test(String(v).trim());
const motDong = (s) => s.replace(/\\\|/g, GACH).replace(/\s*\|\s*/g, ' ').replace(/\u0000/g, '|').replace(/\s+/g, ' ').trim();

function taoBoDoc(muc) {
  const thieu = new Set();
  const lay = (nhan) => {
    const m = muc.get(chuanHoa(nhan));
    if (!m) { thieu.add(nhan); return ''; }
    return m.giaTri;
  };
  // Mục tuỳ chọn: không có trong noi-dung.md thì trả về giá trị mặc định, không báo thiếu
  const layTuyChon = (nhan, macDinh = '') => {
    const m = muc.get(chuanHoa(nhan));
    return m ? m.giaTri : macDinh;
  };
  return { lay, layTuyChon, thieu };
}

function kiemTraFile(duongDan, nhan) {
  if (!duongDan || laLinkNgoai(duongDan)) return;
  const p = path.join(GOC, decodeURI(duongDan));
  if (!fs.existsSync(p)) console.warn(`⚠️  "${nhan}": không tìm thấy file ${duongDan}`);
}
const urlFile = (v, nhan) => { kiemTraFile(v, nhan); return escAttr(laLinkNgoai(v) ? v : encodeURI(v)); };

/* ------------------------------------------------------------------ ngày giờ */
const THU = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];
const hai = (n) => String(n).padStart(2, '0');

// "03/01/2026" (ngày/tháng/năm) -> { ngay, thang, nam }
function docNgay(v, nhan) {
  const m = /^\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})\s*$/.exec(v || '');
  const d = m && new Date(+m[3], +m[2] - 1, +m[1]);
  if (!m || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) {
    throw new LoiNoiDung(`"${nhan}" phải có dạng ngày/tháng/năm, ví dụ 03/01/2026 (đang là "${v}").`);
  }
  return { ngay: +m[1], thang: +m[2], nam: +m[3], thu: d.getDay() };
}
// "18:00" -> { gio, phut } (trống -> null)
function docGio(v, nhan) {
  if (!v) return null;
  const m = /^\s*(\d{1,2})\s*[:hH.]\s*(\d{2})\s*$/.exec(v);
  if (!m || +m[1] > 23 || +m[2] > 59) throw new LoiNoiDung(`"${nhan}" phải là giờ dạng 18:00 (đang là "${v}").`);
  return { gio: +m[1], phut: +m[2] };
}

function phanNgay(tienTo, ngay) {
  return {
    [`@${tienTo}-thu`]: THU[ngay.thu],
    [`@${tienTo}-ngay`]: hai(ngay.ngay),
    [`@${tienTo}-thang`]: `THÁNG ${hai(ngay.thang)}`,
    [`@${tienTo}-nam`]: String(ngay.nam),
  };
}

// Lịch tháng của ngày cưới (tiệc cưới), trái tim ở ngày cưới — giống mẫu: lưới 7 cột, tuần bắt đầu thứ Hai
function taoLich(ngay) {
  const soNgay = new Date(ngay.nam, ngay.thang, 0).getDate();
  const thuDau = (new Date(ngay.nam, ngay.thang - 1, 1).getDay() + 6) % 7; // 0 = thứ 2
  const o = '<div class="flex items-center justify-center h-[30px] md:h-[34px]">';
  let html = '';
  for (let i = 0; i < thuDau; i++) html += `${o}</div>`;
  for (let d = 1; d <= soNgay; d++) {
    html += d === ngay.ngay
      ? `${o}<div class="relative w-[26px] h-[24px] md:w-[30px] md:h-[28px] flex items-center justify-center"><svg viewBox="0 0 24 22" class="absolute inset-0 w-full h-full drop-shadow-sm" fill="#ded9d7"><path d="M12 21C12 21 1.5 13.5 1.5 7.5C1.5 4.46 3.96 2 7 2C8.76 2 10.35 2.81 11.4 4.09L12 4.8L12.6 4.09C13.65 2.81 15.24 2 17 2C20.04 2 22.5 4.46 22.5 7.5C22.5 13.5 12 21 12 21Z"></path></svg><span class="relative z-10 text-[11px] md:text-[12px] font-bold" style="color: rgb(51, 51, 51);">${d}</span></div></div>`
      : `${o}<span class="text-[12px] md:text-[13px]">${d}</span></div>`;
  }
  return { '@lich-tieu-de': `Tháng ${ngay.thang} / ${ngay.nam}`, '@lich-cac-ngay': html };
}

// Link "Thêm vào lịch" (Google Calendar), giờ Việt Nam đổi sang UTC
function linkThemLich(tieuDe, chiTiet, diaDiem, ngay, batDau, ketThuc) {
  const utc = (g) => {
    const t = new Date(Date.UTC(ngay.nam, ngay.thang - 1, ngay.ngay, g.gio - MUI_GIO, g.phut));
    return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const bd = batDau || { gio: 18, phut: 0 };
  const kt = ketThuc || { gio: bd.gio + 2, phut: bd.phut };
  const q = (s) => encodeURIComponent(s);
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${q(tieuDe)}&dates=${utc(bd)}/${utc(kt)}&ctz=Asia/Ho_Chi_Minh&details=${q(chiTiet)}&location=${q(diaDiem)}`;
}

/* ------------------------------------------------------------------ ảnh */
// Đọc kích thước ảnh JPEG/PNG/WebP từ phần đầu file (không cần thư viện)
function kichThuocAnh(duongDan) {
  try {
    const b = fs.readFileSync(path.join(GOC, decodeURI(duongDan)));
    if (b.readUInt32BE(0) === 0x89504e47) return { rong: b.readUInt32BE(16), cao: b.readUInt32BE(20) };
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const loai = b.toString('ascii', 12, 16);
      if (loai === 'VP8X') return { rong: 1 + b.readUIntLE(24, 3), cao: 1 + b.readUIntLE(27, 3) };
      if (loai === 'VP8L') { const v = b.readUInt32LE(21); return { rong: 1 + (v & 0x3fff), cao: 1 + ((v >> 14) & 0x3fff) }; }
      if (loai === 'VP8 ') return { rong: b.readUInt16LE(26) & 0x3fff, cao: b.readUInt16LE(28) & 0x3fff };
    }
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const loai = b[i + 1];
      if (loai >= 0xc0 && loai <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(loai)) return { rong: b.readUInt16BE(i + 7), cao: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  } catch (e) { /* bỏ qua: chỉ là thông tin phụ */ }
  return null;
}

// Album: ảnh xếp vòng kiểu 3D như mẫu (thiep.js đặt vị trí). Khung theo đúng tỉ lệ từng ảnh.
function taoAlbum(lay, layTuyChon) {
  const ds = [];
  for (let i = 1; i <= SO_ALBUM_TOI_DA; i++) {
    const anh = layTuyChon(`Album ảnh ${hai(i)}`);
    if (anh) ds.push(anh);
  }
  const html = ds.map((anh, i) => {
    const k = !laLinkNgoai(anh) && kichThuocAnh(anh);
    const tiLe = k ? +(k.rong / k.cao).toFixed(6) : 0.707031;
    return `<div class="absolute h-[92%] rounded-2xl overflow-hidden shadow-xl cursor-pointer transition-all ease-in-out" data-album-anh="${i}" style="aspect-ratio: ${tiLe} / 1; transition-duration: 1100ms; opacity: 0;"><img alt="" draggable="false" class="h-full w-full object-cover" src="${urlFile(anh, `Album ảnh ${hai(i + 1)}`)}" style="object-position: 50% 50%;"${i > 2 && i < ds.length - 2 ? ' loading="lazy"' : ''} decoding="async"></div>`;
  }).join('');
  return { '@album': html, '@album-so-anh': String(ds.length), soAnh: ds.length };
}

// Lịch trình: giờ | chấm trên đường kẻ | hoạt động, icon (tuỳ chọn) bên trái giờ — y như mẫu
function taoLichTrinh(layTuyChon) {
  const ds = [];
  for (let i = 1; i <= SO_LICH_TRINH_TOI_DA; i++) {
    const gio = layTuyChon(`Lịch trình ${i} - giờ`);
    const viec = layTuyChon(`Lịch trình ${i} - hoạt động`);
    if (!gio && !viec) continue;
    ds.push({ gio, viec, icon: layTuyChon(`Lịch trình ${i} - icon`), i });
  }
  const mau = 'color-mix(in srgb, rgb(124, 106, 96) 40%, transparent 60%)';
  const html = ds.map((m, k) => {
    const dau = k === 0;
    const cuoi = k === ds.length - 1;
    const duong = dau && cuoi ? 'hidden' : dau ? 'top-1/2 -bottom-8 md:-bottom-10' : cuoi ? '-top-8 md:-top-10 bottom-1/2' : '-top-8 md:-top-10 -bottom-8 md:-bottom-10';
    const gio = m.icon
      ? `<span class="relative inline-block"><span aria-hidden="true" class="absolute top-1/2 flex w-max items-center justify-center -translate-y-1/2 right-full" style="margin-right: 30px;"><img alt="" aria-hidden="true" class="block h-9 w-9 shrink-0 object-contain" src="${urlFile(m.icon, `Lịch trình ${m.i} - icon`)}"></span>${escHtml(m.gio)}</span>`
      : escHtml(m.gio);
    return `<li class="contents"><span class="pt-0.5 text-right text-[16px] md:text-[17px] tabular-nums tracking-wide leading-snug" style="color: rgb(124, 106, 96); font-family: &quot;Times New Roman&quot;, ChungDoiIndic, serif;">${gio}</span><span aria-hidden="true" class="relative flex items-center justify-center self-stretch"><span class="absolute left-1/2 -translate-x-1/2 w-px ${duong}" style="background-color: ${mau};"></span><span class="relative block h-2.5 w-2.5 rounded-full" style="background-color: rgb(124, 106, 96); box-shadow: color-mix(in srgb, rgb(124, 106, 96) 13%, transparent 87%) 0px 0px 0px 2px;"></span></span><span class="text-[13px] md:text-[15px]" style="color: rgb(145, 128, 119); font-family: &quot;Times New Roman&quot;, ChungDoiIndic, serif;"><span dir="auto">${nhieuDong(m.viec)}</span></span></li>`;
  }).join('');
  return { html, so: ds.length };
}

// Dress code: các chấm màu
function taoDressCode(v) {
  const mau = v.split('|').map((s) => s.trim()).filter(Boolean).slice(0, SO_MAU_TOI_DA);
  for (const m of mau) if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(m)) throw new LoiNoiDung(`"Dress code - màu": "${m}" không phải mã màu (vd. #e1bc7c).`);
  // màu sáng thì thêm viền mảnh như mẫu
  const sang = (m) => {
    const h = m.length === 4 ? m.slice(1).split('').map((c) => c + c).join('') : m.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 215;
  };
  return mau.map((m) => `<div class="w-10 h-10 md:w-12 md:h-12 rounded-full shadow-md" style="background-color: ${m};${sang(m) ? ' border: 1.5px solid rgba(124, 106, 96, 0.19);' : ''}"></div>`).join('');
}

// Hộp quà: mỗi tài khoản một khung QR. Không có ảnh QR thì tạo mã VietQR từ ngân hàng + số tài khoản (img.vietqr.io)
function taoTaiKhoan(layTuyChon) {
  let html = '';
  for (let i = 1; i <= SO_TAI_KHOAN_TOI_DA; i++) {
    const p = (t) => layTuyChon(`Tài khoản ${i} - ${t}`);
    const stk = p('số tài khoản').replace(/\s+/g, '');
    if (!stk && !p('ảnh QR')) continue;
    const tieuDe = [p('tiêu đề'), p('chủ tài khoản')].filter(Boolean).join(' - ');
    const qr = p('ảnh QR')
      ? urlFile(p('ảnh QR'), `Tài khoản ${i} - ảnh QR`)
      : escAttr(`https://img.vietqr.io/image/${encodeURIComponent(p('mã ngân hàng') || p('ngân hàng'))}-${encodeURIComponent(stk)}-qr_only.png?accountName=${encodeURIComponent(p('chủ tài khoản'))}`);
    const c = 'style="color: rgb(124, 106, 96);"';
    html += `<div class="qua-tk flex flex-col items-center flex-1 max-w-[180px] sm:max-w-none"><h3 class="mb-2 text-xs min-h-[2rem] flex items-start justify-center font-medium text-center line-clamp-2" ${c}>${escHtml(tieuDe)}</h3><div class="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-xl p-2 shadow-lg flex items-center justify-center" style="border: 2px solid rgba(124, 106, 96, 0.125);"><img alt="QR - ${escAttr(tieuDe)}" class="w-full h-full object-contain" src="${qr}" loading="lazy"></div><div class="mt-2 text-center space-y-0.5"><p class="text-[10px]" ${c}>${escHtml(p('ngân hàng'))}</p><p class="text-[10px] font-mono" ${c} data-stk style="color: rgb(124, 106, 96); cursor: copy;">${escHtml(stk)}</p><p class="text-[10px] font-semibold" ${c}>${escHtml(p('chủ tài khoản'))}</p></div><button type="button" data-tai-qr class="mt-1.5 text-[10px] px-2 py-1 inline-flex items-center gap-1 font-medium rounded-full transition-colors" style="color: rgb(124, 106, 96); background-color: rgba(124, 106, 96, 0.082);"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>Lưu QR</button></div>`;
  }
  return html;
}

// Bản đồ (khung nhúng không cần khoá API) + link chỉ đường. Có toạ độ ghim thì dùng toạ độ (chính xác nhất).
function banDo(lay, layTuyChon) {
  const diaChi = motDong(lay('Địa điểm - địa chỉ'));
  const toaDo = (layTuyChon('Địa điểm - toạ độ') || '').replace(/\s+/g, '');
  if (toaDo && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(toaDo)) throw new LoiNoiDung(`"Địa điểm - toạ độ" phải có dạng vĩ độ,kinh độ (vd. 10.7998,106.6729). Đang là "${toaDo}".`);
  const q = toaDo || diaChi;
  return {
    '@ban-do': escAttr(`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&hl=vi&output=embed`),
    '@chi-duong': escAttr(layTuyChon('Địa điểm - link bản đồ') || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`),
    diaChi,
  };
}

function chuanHoaGoc(goc) {
  goc = (goc || '/').trim();
  if (!goc.startsWith('/')) goc = '/' + goc;
  if (!goc.endsWith('/')) goc += '/';
  return goc;
}

function diaChiDayDu(lay, duongDan) {
  if (!duongDan || laLinkNgoai(duongDan)) return duongDan;
  const web = lay('Địa chỉ website').replace(/\/+$/, '');
  return web + chuanHoaGoc(lay('Đường dẫn gốc')) + encodeURI(duongDan);
}

/* ------------------------------------------------------------------ điền template */
function doiCho(lay) {
  const doi = new Map(CAP_DOI_CHO.flatMap(([a, b]) => [[chuanHoa(a), b], [chuanHoa(b), a]]));
  return (nhan) => lay(doi.get(chuanHoa(nhan)) || nhan);
}

function dien(template, lay, tinhSan) {
  return template.replace(/\{\{\s*(?:(attr|url):)?([^}]+?)\s*\}\}/g, (_, kieu, ten) => {
    if (ten.startsWith('@')) {
      if (!(ten in tinhSan)) throw new Error(`Template dùng {{${ten}}} nhưng build.js chưa tính.`);
      return tinhSan[ten];
    }
    const v = lay(ten);
    if (kieu === 'attr') return escAttr(motDong(v));
    if (kieu === 'url') return urlFile(v, ten);
    return nhieuDong(v);
  });
}

// HTML thiệp + trang tạo link + trang thống kê của một bên
function taoTrang(muc, ben) {
  const { lay: layGoc, layTuyChon, thieu } = taoBoDoc(muc);
  // Mục tuỳ chọn: không có trong noi-dung.md thì coi là "không"
  const coDauTruoc = !laKhong(layTuyChon('Cô dâu đứng trước (có/không)', 'không'));
  const lay = coDauTruoc ? doiCho(layGoc) : layGoc;
  const an = (v) => (laKhong(v) ? ' hidden' : '');

  const goc = chuanHoaGoc(lay('Đường dẫn gốc'));
  const ngayLe = docNgay(lay('Lễ cưới - ngày'), 'Lễ cưới - ngày');
  const ngayTiec = docNgay(lay('Tiệc cưới - ngày'), 'Tiệc cưới - ngày');
  const gioTiec = docGio(lay('Tiệc cưới - giờ'), 'Tiệc cưới - giờ');
  const gioKetThuc = docGio(layTuyChon('Tiệc cưới - giờ kết thúc'), 'Tiệc cưới - giờ kết thúc');
  docGio(lay('Lễ cưới - giờ'), 'Lễ cưới - giờ');
  const bd = banDo(lay, layTuyChon);
  const album = taoAlbum(lay, layTuyChon);
  const lichTrinh = taoLichTrinh(layTuyChon);
  const mauDress = taoDressCode(layTuyChon('Dress code - màu'));
  const taiKhoan = taoTaiKhoan(layTuyChon);
  const tenCapDoi = `${motDong(lay('Tên chú rể'))} & ${motDong(lay('Tên cô dâu'))}`;
  // Trống = không giới hạn số khách (như mẫu)
  const soNguoiToiDa = (() => { const v = parseInt(layTuyChon('Xác nhận tham dự - số người tối đa', ''), 10); return v >= 1 ? Math.min(v, 100) : null; })();

  const cauHinh = {
    ben: ben.ben,
    linkGoogleSheet: layTuyChon('Lời chúc - link Google Sheet'),
    khachMacDinh: motDong(lay('Thư mời - khách mời mặc định')),
    goiY: layTuyChon('Lời chúc - câu gợi ý').split('|').map((s) => s.trim()).filter(Boolean),
    thongBao: {
      thieuTen: 'Bạn nhập tên giúp mình nhé!',
      thieuLoiChuc: layTuyChon('Lời chúc - nhắc nhập đủ', 'Vui lòng nhập tên và lời chúc nhé!'),
      daGui: layTuyChon('Lời chúc - cảm ơn', 'Cảm ơn bạn đã gửi lời chúc!'),
      loiMang: 'Gửi chưa được, bạn kiểm tra kết nối mạng rồi thử lại nhé!',
      loiXacNhan: layTuyChon('Xác nhận tham dự - chữ lỗi', 'Có lỗi xảy ra. Vui lòng thử lại.'),
    },
    chuDangGui: layTuyChon('Lời chúc - nút đang gửi', 'ĐANG GỬI...'),
    chuChuaCoLoiChuc: layTuyChon('Lời chúc - chưa có lời chúc', 'Chưa có lời chúc nào. Hãy là người đầu tiên!'),
    goiYChu: {
      tieuDe: layTuyChon('Lời chúc - gợi ý tiêu đề', '✨ Lời chúc gợi ý cho bạn'),
      huongDan: layTuyChon('Lời chúc - gợi ý hướng dẫn', 'Chọn một lời chúc bạn thích hoặc tạo lại để xem thêm gợi ý'),
      taoThem: layTuyChon('Lời chúc - gợi ý tạo thêm', '✨ Tạo thêm'),
      dong: layTuyChon('Lời chúc - gợi ý đóng', 'Đóng'),
    },
    soKhachToiDa: soNguoiToiDa,
    chuToiDa: layTuyChon('Xác nhận tham dự - chữ tối đa', 'Tối đa {{max}} người'),
    mauHatBay: ['#c9a97e', '#918077', '#b89b78', '#e6d6c4'], // màu lá bay khi mở thiệp (như mẫu)
  };
  const tinhSan = {
    '@duong-dan-goc': escAttr(goc),
    '@anh-chia-se': escAttr(diaChiDayDu(lay, lay('Ảnh khi chia sẻ'))),
    '@anh-chia-se-kich-thuoc': (() => {
      const f = lay('Ảnh khi chia sẻ');
      kiemTraFile(f, 'Ảnh khi chia sẻ');
      const k = f && !laLinkNgoai(f) && kichThuocAnh(f);
      return k ? `<meta property="og:image:width" content="${k.rong}">\n<meta property="og:image:height" content="${k.cao}">` : '';
    })(),
    ...phanNgay('le', ngayLe),
    ...phanNgay('tiec', ngayTiec),
    ...taoLich(ngayTiec),
    '@ngay-chu': `${ngayTiec.ngay} tháng ${ngayTiec.thang}, ${ngayTiec.nam}`,
    '@link-them-lich': escAttr(linkThemLich(`Đám cưới ${tenCapDoi}`, `Tiệc cưới của ${tenCapDoi} tại ${bd.diaChi}`, bd.diaChi, ngayTiec, gioTiec, gioKetThuc)),
    '@ban-do': bd['@ban-do'],
    '@chi-duong': bd['@chi-duong'],
    '@album': album['@album'],
    '@album-so-anh': album['@album-so-anh'],
    '@lich-trinh': lichTrinh.html,
    '@dress-code-mau': mauDress,
    '@tai-khoan': taiKhoan,
    '@an-xac-nhan': an(layTuyChon('Hiện nút xác nhận tham dự (có/không)', 'có')),
    '@an-dress-code': mauDress ? an(layTuyChon('Hiện dress code (có/không)', 'có')) : ' hidden',
    '@an-lich-trinh': lichTrinh.so ? an(layTuyChon('Hiện lịch trình (có/không)', 'có')) : ' hidden',
    '@an-loi-chuc': an(layTuyChon('Hiện sổ lưu bút (có/không)', 'có')),
    '@an-mung-cuoi': taiKhoan ? an(layTuyChon('Hiện hộp quà (có/không)', 'có')) : ' hidden',
    '@cau-hinh-js': JSON.stringify(cauHinh).replace(/</g, '\\u003c'),
    '@dia-chi-website': escAttr(lay('Địa chỉ website').replace(/\/+$/, '') + goc + ben.ben + '/'),
    '@ben': ben.ben,
    '@ten-ben': escHtml(ben.ten),
  };
  if (!album.soAnh) console.warn('⚠️  Album chưa có ảnh nào (mục "Album ảnh 01"…).');

  const coManMo = !laKhong(layTuyChon('Màn mở thiệp - bật (có/không)', 'có'));
  tinhSan['@man-mo-thiep'] = coManMo ? dien(fs.readFileSync(path.join(GOC, 'src/man-mo.html'), 'utf8'), lay, tinhSan) : '';
  const thiep = dien(fs.readFileSync(path.join(GOC, 'src/thiep.html'), 'utf8'), lay, tinhSan);
  const taoLink = dien(fs.readFileSync(path.join(GOC, 'src/tao-link.html'), 'utf8'), layGoc, tinhSan);
  const thongKe = dien(fs.readFileSync(path.join(GOC, 'src/thong-ke.html'), 'utf8'), layGoc, tinhSan);
  if (thieu.size) {
    throw new LoiNoiDung('noi-dung.md thiếu các mục sau (có thể bạn đã lỡ sửa/xoá tên mục):\n   - ' + [...thieu].join('\n   - '));
  }
  return { thiep, taoLink, thongKe, goc };
}

function build() {
  const batDau = Date.now();
  const muc = docNoiDung();
  const trang = CAC_BEN.map((ben) => ({ ...ben, ...taoTrang(mucTheoBen(muc, ben), ben) }));
  const { goc } = trang[0];

  fs.rmSync(RA, { recursive: true, force: true });
  fs.mkdirSync(RA, { recursive: true });
  for (const thuMuc of ['css', 'js', 'fonts']) fs.cpSync(path.join(GOC, 'src', thuMuc), path.join(RA, thuMuc), { recursive: true });
  for (const thuMuc of ['anh', 'nhac']) fs.cpSync(path.join(GOC, thuMuc), path.join(RA, thuMuc), { recursive: true });

  for (const t of trang) {
    fs.mkdirSync(path.join(RA, t.ben, 'tao-link'), { recursive: true });
    fs.mkdirSync(path.join(RA, t.ben, 'thong-ke'));
    fs.writeFileSync(path.join(RA, t.ben, 'index.html'), t.thiep);
    fs.writeFileSync(path.join(RA, t.ben, 'tao-link', 'index.html'), t.taoLink);
    fs.writeFileSync(path.join(RA, t.ben, 'thong-ke', 'index.html'), t.thongKe);
  }
  // Trang chủ hiện thiệp nhà trai. Đường dẫn không có file (link ngắn, /nha-gai/<lạ>, link cũ không có /nha-trai/)
  // do Cloudflare Worker (worker/index.mjs) xử lý.
  fs.writeFileSync(path.join(RA, 'index.html'), trang[0].thiep);
  // /tao-link/ cũ chuyển sang trang tạo link nhà trai; /thong-ke/ chỉ để chọn bên
  const sangTaoLink = `${goc}${trang[0].ben}/tao-link/`;
  fs.mkdirSync(path.join(RA, 'tao-link'));
  fs.writeFileSync(path.join(RA, 'tao-link', 'index.html'), `<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${sangTaoLink}"><script>location.replace(${JSON.stringify(sangTaoLink)})</script>\n`);
  fs.writeFileSync(path.join(RA, '_redirects'), `/tao-link  ${sangTaoLink}  301\n`);
  fs.mkdirSync(path.join(RA, 'thong-ke'));
  fs.writeFileSync(path.join(RA, 'thong-ke', 'index.html'), `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Thống kê xác nhận tham dự</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:system-ui,sans-serif;background:#fff7f3;color:#4a3b33}a{display:block;width:240px;text-align:center;padding:14px;border-radius:14px;background:#7c6a60;color:#fff;font-weight:700;text-decoration:none}</style></head>
<body><h1 style="font-weight:600;font-size:22px;margin:0 0 6px">Thống kê xác nhận tham dự</h1>${trang.map((t) => `<a href="${goc}${t.ben}/thong-ke/">${escHtml(t.ten)}</a>`).join('')}</body></html>\n`);

  console.log(`✅ Đã tạo website/ (${Date.now() - batDau} ms)`);
}

/* ------------------------------------------------------------------ máy chủ xem thử */
const KIEU = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

// Link ngắn + xác nhận tham dự + lời chúc khi xem thử trên máy: giống worker/index.mjs trên Cloudflare nhưng lưu vào file thay cho KV
function khoFile(file) {
  const doc = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return {}; } };
  const ghi = (tatCa) => fs.writeFileSync(file, JSON.stringify(tatCa, null, 2));
  return {
    get: async (khoa) => doc()[khoa] || null,
    set: async (khoa, giaTri) => { const tatCa = doc(); tatCa[khoa] = giaTri; ghi(tatCa); },
    xoa: async (khoa) => { const tatCa = doc(); delete tatCa[khoa]; ghi(tatCa); },
    list: async (tienTo) => Object.entries(doc()).filter(([k]) => k.startsWith(tienTo)).map(([khoa, v]) => ({ khoa, ...v })),
  };
}
const khoLienKet = khoFile(path.join(GOC, 'lien-ket.local.json'));
const khoXacNhan = khoFile(path.join(GOC, 'xac-nhan.local.json'));
let lienKet = null; // module chung/lien-ket.mjs (ESM) nạp khi máy chủ khởi động
let xacNhan = null; // module chung/xac-nhan.mjs
let loiChuc = null; // module chung/loi-chuc.mjs
const traJson = (res, trangThai, duLieu) => {
  res.writeHead(trangThai, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(duLieu));
};

async function xuLyLinkNgan(req, res, p) {
  const api = {
    '/api/tao-link': (body) => lienKet.taoLinkMoi(khoLienKet, body, process.env.MAT_KHAU_TAO_LINK),
    '/api/xac-nhan': (body) => xacNhan.luuXacNhan(khoXacNhan, body),
    '/api/loi-chuc': (body) => loiChuc.xuLyLoiChuc(khoXacNhan, body),
    // Không đặt MAT_KHAU_THONG_KE thì xem không cần mật khẩu (giống trên Cloudflare)
    '/api/thong-ke': (body) => xacNhan.thongKe(khoXacNhan, body, xacNhan.layMatKhau(process.env, xacNhan.benThongKe(body) || 'x'), false),
  }[p];
  if (api) {
    if (req.method !== 'POST') return traJson(res, 405, { loi: 'Chỉ nhận POST.' }), true;
    const phan = [];
    for await (const chunk of req) phan.push(chunk);
    const raw = Buffer.concat(phan).toString('utf8');
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch (e) { return traJson(res, 400, { loi: 'Dữ liệu không hợp lệ.' }), true; }
    const kq = await api(body);
    traJson(res, kq.trangThai, kq.duLieu);
    return true;
  }
  const duongDan = lienKet.layDuongDan(p);
  const duLieu = duongDan && !fs.existsSync(path.join(RA, duongDan)) && (await khoLienKet.get(duongDan));
  if (!duLieu) return false;
  const html = lienKet.chenThongTin(fs.readFileSync(path.join(RA, lienKet.benCuaLink(duongDan), 'index.html'), 'utf8'), duLieu);
  res.writeHead(200, { 'Content-Type': KIEU['.html'], 'Cache-Control': 'no-store' });
  res.end(html);
  return true;
}

function moMayChu(cong) {
  http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      if (await xuLyLinkNgan(req, res, p)) return;
    } catch (e) {
      console.error('❌ Máy chủ: ' + e.message);
      return traJson(res, 500, { loi: e.message });
    }
    let file = path.join(RA, path.normalize(p).replace(/^(\.\.[\\/])+/, ''));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(RA) || !fs.existsSync(file)) { // link tuỳ ý -> thiệp (của bên đó nếu nằm trong /nha-trai/, /nha-gai/)
      if (path.extname(p)) { res.writeHead(404); return res.end('Không có file này'); }
      const ben = lienKet.CAC_BEN.find((b) => p.startsWith(`/${b}/`));
      file = path.join(RA, ben || '', 'index.html');
    }
    const dau = { 'Content-Type': KIEU[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const tong = fs.statSync(file).size;
    // Trình duyệt (nhất là Safari/iPhone) xin nhạc/video theo từng đoạn bằng "Range"
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let bd = range[1] ? Number(range[1]) : Math.max(0, tong - Number(range[2]));
      let kt = range[1] && range[2] ? Math.min(Number(range[2]), tong - 1) : tong - 1;
      if (bd > kt || bd >= tong) { res.writeHead(416, { 'Content-Range': `bytes */${tong}` }); return res.end(); }
      res.writeHead(206, { ...dau, 'Content-Range': `bytes ${bd}-${kt}/${tong}`, 'Content-Length': kt - bd + 1 });
      return fs.createReadStream(file, { start: bd, end: kt }).pipe(res);
    }
    res.writeHead(200, { ...dau, 'Content-Length': tong });
    fs.createReadStream(file).pipe(res);
  }).listen(cong, () => {
    console.log(`\n🌐 Thiệp nhà trai: http://localhost:${cong}/nha-trai/   tạo link: /nha-trai/tao-link/   thống kê: /nha-trai/thong-ke/`);
    console.log(`🌐 Thiệp nhà gái:  http://localhost:${cong}/nha-gai/    tạo link: /nha-gai/tao-link/    thống kê: /nha-gai/thong-ke/`);
    console.log('   (Sửa noi-dung.md / ảnh rồi tải lại trang. Ctrl+C để dừng.)\n');
  });
}

function theoDoi() {
  let hen = null;
  const chay = () => {
    clearTimeout(hen);
    hen = setTimeout(() => {
      try { build(); } catch (e) { console.error('❌ ' + e.message); }
    }, 300);
  };
  for (const p of ['noi-dung.md', 'src', 'anh', 'nhac']) {
    fs.watch(path.join(GOC, p), { recursive: true }, chay);
  }
}

try {
  build();
} catch (e) {
  console.error('❌ ' + e.message);
  if (!(e instanceof LoiNoiDung)) console.error(e.stack);
  if (!process.argv.includes('--serve')) process.exit(1);
}
if (process.argv.includes('--serve')) {
  const nap = (f) => import(require('url').pathToFileURL(path.join(GOC, f)).href);
  Promise.all([nap('chung/lien-ket.mjs'), nap('chung/xac-nhan.mjs'), nap('chung/loi-chuc.mjs')]).then(([m, x, l]) => {
    lienKet = m;
    xacNhan = x;
    loiChuc = l;
    moMayChu(Number(process.env.PORT) || 8080);
    theoDoi();
  });
}
