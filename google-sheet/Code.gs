/**
 * Nhận lời chúc từ thiệp cưới và ghi vào Google Sheet.
 * Cách cài: xem google-sheet/HUONG-DAN.md
 */
const TEN_TRANG_TINH = 'Lời chúc';
const TIEU_DE_COT = ['Thời gian', 'Họ tên', 'Mối quan hệ', 'Tham dự', 'Lời chúc', 'Khách mời (từ link)', 'Link đã mở'];

function doPost(e) {
  const khoa = LockService.getScriptLock();
  khoa.waitLock(10000);
  try {
    const bang = SpreadsheetApp.getActiveSpreadsheet();
    const trang = bang.getSheetByName(TEN_TRANG_TINH) || bang.insertSheet(TEN_TRANG_TINH);
    if (trang.getLastRow() === 0) {
      trang.appendRow(TIEU_DE_COT);
      trang.getRange(1, 1, 1, TIEU_DE_COT.length).setFontWeight('bold');
      trang.setFrozenRows(1);
    }
    const p = e.parameter;
    trang.appendRow([
      new Date(),
      an(p.ho_ten), an(p.quan_he), an(p.tham_du), an(p.loi_chuc), an(p.khach_moi), an(p.link),
    ]);
    return ContentService.createTextOutput('ok');
  } finally {
    khoa.releaseLock();
  }
}

// Chặn khách nhập công thức (=, +, -, @) vào bảng tính
function an(giaTri) {
  const s = String(giaTri || '').slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
