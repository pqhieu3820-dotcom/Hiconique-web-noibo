// DÁN TOÀN BỘ FILE NÀY VÀO CUỐI Mã.gs trong Apps Script → Ctrl+S → chọn hàm dgdmConvertData → Chạy.
// Hàm tự sao lưu cả file Sheet trước khi chuyển; chạy lại nhiều lần không sao.

// ===== 2026-10-02: CHUYỂN ĐỔI DỮ LIỆU THẬT sang chuẩn mới (không chỉ bảng tham chiếu) — chạy tay trong editor: dgdmConvertData() =====
// 1) Sao lưu cả file. 2) Tạo "DGDM-Quy đổi ĐVT cũ" (giữ bảng ánh xạ cũ→chuẩn). 3) Ở 4 sheet dữ liệu (công tác, vật tư, nhân công khoán, phần thô): thêm cột "ĐVT cũ" (giữ nguyên giá trị cũ) rồi ghi ĐVT chuẩn mới vào cột "ĐVT";
// công tác thêm "Hạng mục" + "Giai đoạn" (suy từ mã công việc mới), vật tư thêm "Nhóm tài nguyên" (suy từ mã tài nguyên). 4) Viết lại 3 sheet danh mục thành danh mục sống: số dòng đang dùng tính từ dữ liệu thật.
// Chạy lại được nhiều lần (cột "ĐVT cũ" đã có thì không đổi lại). Không xoá dòng nào, không đụng cột giá.
function dgdmConvertData() {
  const T = function (rg) { return rg; };   // KHÔNG đặt định dạng: các sheet là Bảng (Table) đã định kiểu cột; lệnh định dạng bị gom lại và báo lỗi ở lệnh đọc kế tiếp nên try/catch không bắt được
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID), L = function (m) { Logger.log(m); };
  const fd = function (n) { return ss.getSheets().filter(function (x) { return dgNorm_(x.getName()) === dgNorm_(n); })[0]; };
  const bname = 'SAO LƯU trước khi chuyển đổi dữ liệu DGDM — ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM HH:mm');
  try { ss.copy(bname); L('Đã sao lưu: ' + bname); } catch (e) { L('DUNG: không sao lưu được — ' + e); return; }
  const uSh = fd('DGDM-Đơn vị tính'), gSh = fd('DGDM-Nhóm tài nguyên'), sSh = fd('DGDM-Giai đoạn hạng mục');
  if (!uSh || !gSh || !sSh) { L('DUNG: thiếu sheet danh mục'); return; }
  // --- 1. bảng quy đổi ĐVT
  let qSh = fd('DGDM-Quy đổi ĐVT cũ'), uv = uSh.getDataRange().getValues();
  const oldLayout = dgNorm_(uv[0][1]) === dgNorm_('ĐVT cũ trên app');
  if (!qSh) {
    if (!oldLayout) { L('DUNG: không có bảng quy đổi để tạo'); return; }
    const idx = ss.getSheets().indexOf(uSh) + 1;
    qSh = ss.insertSheet('DGDM-Quy đổi ĐVT cũ', idx);
    const rows = [['ĐVT cũ', 'ĐVT chuẩn mới', 'Số dòng lúc đối chiếu', 'Ghi chú điều kiện đo']];
    uv.slice(1).forEach(function (r) { if (String(r[1]).trim()) rows.push([r[1], r[3], r[2], r[4]]); });
    T(qSh.getRange(1, 1, rows.length, 4).setValues(rows)); qSh.getRange(1, 1, 1, 4).setFontWeight('bold'); qSh.setFrozenRows(1);
    qSh.getRange(2, 3, rows.length - 1, 1);
    L('Tạo DGDM-Quy đổi ĐVT cũ (' + (rows.length - 1) + ' dòng)');
  }
  const unitMap = {}; qSh.getDataRange().getValues().slice(1).forEach(function (r) { const o = String(r[0]).trim(); if (o) unitMap[o] = String(r[1]).trim() || o; });
  const std = []; if (oldLayout) uv.slice(1).forEach(function (r) { const s = String(r[0]).trim(); if (s) std.push([s, '']); });
  const stdNotes = {}; Object.keys(unitMap).forEach(function (o) { });
  if (oldLayout) { uv.slice(1).forEach(function (r) { const o = String(r[1]).trim(), n = String(r[4]).trim(); if (o && unitMap[o] === o && n && n !== 'Giữ nguyên') stdNotes[o] = n; }); }
  // --- hạng mục → giai đoạn
  const hm2gd = {}; sSh.getDataRange().getValues().slice(1).forEach(function (r) { if (String(r[2]).trim()) hm2gd[String(r[2]).trim()] = String(r[0]).trim(); });
  // --- 2. chuyển 4 sheet dữ liệu
  const unitCount = {}, hmCodes = {}, grCodes = {};
  [['DGDM-Mã công việc công tác', 'ct'], ['DGDM-Vật tư thiết bị', 'vt'], ['DGDM-Nhân công khoán', 'nc'], ['DGDM-Phần thô và trọn gói', 'tho']].forEach(function (p) {
    const sh = fd(p[0]); if (!sh) { L('THIEU ' + p[0]); return; }
    const addCol = function (h) { const hs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(dgNorm_), i = hs.indexOf(dgNorm_(h)); if (i !== -1) return i + 1; const lc = sh.getLastColumn(); if (sh.getMaxColumns() < lc + 1) sh.insertColumnAfter(lc); sh.getRange(1, lc + 1).setValue(h); return lc + 1; };
    const hs0 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(dgNorm_), uC = hs0.indexOf(dgNorm_('ĐVT')) + 1;
    if (!uC) { L('KHONG CO cot DVT o ' + p[0]); return; }
    const oC = addCol('ĐVT cũ'), n = sh.getLastRow() - 1; if (n < 1) return;
    const cur = sh.getRange(2, uC, n, 1).getValues(), old = sh.getRange(2, oC, n, 1).getValues(), outU = [], outO = []; let changed = 0, filled = 0;
    for (let i = 0; i < n; i++) {
      const c = String(cur[i][0]).trim(), o = String(old[i][0]).trim();
      if (o) { outO.push([o]); outU.push([cur[i][0]]); filled++; unitCount[String(cur[i][0]).trim()] = (unitCount[String(cur[i][0]).trim()] || 0) + 1; continue; }
      const nu = unitMap[c] || c; outO.push([c]); outU.push([nu]); if (nu !== c) changed++;
      unitCount[nu] = (unitCount[nu] || 0) + 1;
    }
    T(sh.getRange(2, oC, n, 1)).setValues(outO); T(sh.getRange(2, uC, n, 1)).setValues(outU);
    L(p[0] + ': ĐVT chuẩn hoá ' + changed + ' dòng đổi giá trị / ' + n + ' dòng (đã có sẵn ĐVT cũ: ' + filled + ')');
    if (p[1] === 'ct' || p[1] === 'vt') {
      const hs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(dgNorm_), cc = hs.indexOf(dgNorm_(p[1] === 'ct' ? 'Mã công việc' : 'Mã tài nguyên')) + 1;
      const codes = sh.getRange(2, cc, n, 1).getValues();
      if (p[1] === 'ct') {
        const hC = addCol('Hạng mục'), gC = addCol('Giai đoạn'), oh = [], og = [];
        codes.forEach(function (r) { const c = String(r[0]).trim(), hm = c.replace(/-\d{3,4}$/, ''); oh.push([c ? hm : '']); og.push([c ? (hm2gd[hm] || '') : '']); if (c) { hmCodes[hm] = hmCodes[hm] || {}; hmCodes[hm][c] = 1; } });
        T(sh.getRange(2, hC, n, 1)).setValues(oh); T(sh.getRange(2, gC, n, 1)).setValues(og);
        L('Công tác: điền Hạng mục + Giai đoạn cho ' + oh.filter(function (x) { return x[0]; }).length + ' dòng');
      } else {
        const rC = addCol('Nhóm tài nguyên'), og = [];
        codes.forEach(function (r) { const c = String(r[0]).trim(), g = c.replace(/-\d{3,5}$/, ''); og.push([g]); if (c) { grCodes[g] = grCodes[g] || {}; grCodes[g][c] = 1; } });
        T(sh.getRange(2, rC, n, 1)).setValues(og);
        L('Vật tư: điền Nhóm tài nguyên cho ' + og.filter(function (x) { return x[0]; }).length + ' dòng');
      }
    }
  });
  // --- 3. danh mục sống
  if (oldLayout && uv[0].map(dgNorm_).indexOf(dgNorm_('Số dòng đang dùng')) === -1) {
    const rows = [['ĐVT chuẩn (mới)', 'Ghi chú điều kiện đo (mới)', 'Số dòng đang dùng']];
    std.forEach(function (s) { rows.push([s[0], stdNotes[s[0]] || '', unitCount[s[0]] || 0]); });
    const c0 = uSh.getLastColumn() + 1; uSh.getRange(1, c0, rows.length, 3).setValues(rows);   // ghi sang CỘT MỚI bên phải, không xoá nội dung cũ (người dùng tự xoá cột cũ sau)
    const extra = Object.keys(unitCount).filter(function (u) { return std.every(function (s) { return s[0] !== u; }); });
    L('DGDM-Đơn vị tính: viết lại ' + std.length + ' ĐVT chuẩn' + (extra.length ? ' — CÒN ĐVT ngoài danh sách: ' + extra.join(', ') : ' (không còn ĐVT ngoài danh sách)'));
  }
  const gh = gSh.getRange(1, 1, 1, gSh.getLastColumn()).getValues()[0].map(dgNorm_);
  if (gh.indexOf(dgNorm_('Mã nhóm')) === -1) {
    const gv = gSh.getDataRange().getValues().slice(1), c1 = gSh.getLastColumn() + 1;
    gSh.getRange(1, c1, 1, 2).setValues([['Mã nhóm', 'Số mã đang dùng']]);
    T(gSh.getRange(2, c1, gv.length, 2)).setValues(gv.map(function (r) { const k = String(r[0]).trim() + '-' + String(r[1]).trim(); return [k, grCodes[k] ? Object.keys(grCodes[k]).length : 0]; }));
    L('DGDM-Nhóm tài nguyên: thêm Mã nhóm + Số mã đang dùng');
  }
  const sh2 = sSh.getRange(1, 1, 1, sSh.getLastColumn()).getValues()[0].map(dgNorm_);
  if (sh2.indexOf(dgNorm_('Số mã công việc')) === -1) {
    const sv = sSh.getDataRange().getValues().slice(1), c1 = sSh.getLastColumn() + 1;
    sSh.getRange(1, c1, 1, 1).setValues([['Số mã công việc']]);
    sSh.getRange(2, c1, sv.length, 1).setValues(sv.map(function (r) { const k = String(r[2]).trim(); return [hmCodes[k] ? Object.keys(hmCodes[k]).length : 0]; }));
    L('DGDM-Giai đoạn hạng mục: thêm Số mã công việc');
  }
  SHEET_MEMO_ = null; bumpReadCacheVersion_();
  L('XONG chuyển đổi dữ liệu.');
}
