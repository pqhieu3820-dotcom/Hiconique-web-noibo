/**
 * HiconiqueExcel — tiêu đề văn bản CHUẨN + cài đặt in cho MỌI file Excel xuất từ web (2026-09-30).
 * Chèn 5 dòng đầu mỗi sheet:
 *   CÔNG TY TNHH KIẾN TRÚC VÀ XÂY DỰNG HICONIQUE        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
 *   Số: ....../...                                        Độc lập - Tự do - Hạnh phúc
 *                                                         Hải Phòng, ngày … tháng … năm …
 * rồi dời nguyên nội dung cũ xuống (kể cả ô gộp, công thức, định dạng có điều kiện, ngăn đông cứng, bộ lọc, vùng in).
 * Cách dùng: gọi HiconiqueExcel.standardize(wb) NGAY TRƯỚC wb.xlsx.writeBuffer(). Sheet "Bìa báo cáo" của Sổ tài chính tự dựng riêng (finance-export.js).
 */
var HiconiqueExcel = (function () {
  'use strict';
  var COMPANY = 'CÔNG TY TNHH KIẾN TRÚC VÀ XÂY DỰNG HICONIQUE';
  var FONT = 'Times New Roman';
  var N = 5;   // số dòng tiêu đề chèn thêm

  function shiftFormula(f, n) {
    // cộng n vào số hàng của mọi tham chiếu A1 (bỏ qua nội dung trong dấu nháy kép)
    return String(f).split('"').map(function (part, i) {
      if (i % 2 === 1) return part;
      return part.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)(?![\d(])/g, function (m, col, dollar, row) { return col + dollar + (Number(row) + n); });
    }).join('"');
  }
  function shiftRange(rng, n) {
    return String(rng).replace(/([A-Z]+)(\d+)/g, function (m, c, r) { return c + (Number(r) + n); });
  }

  function shiftDown(ws, n) {
    var merges = (ws.model && ws.model.merges ? ws.model.merges : []).slice();
    merges.forEach(function (m) { try { ws.unMergeCells(m); } catch (e) { /* bỏ qua */ } });
    ws.eachRow({ includeEmpty: false }, function (row) {
      row.eachCell({ includeEmpty: false }, function (c) {
        var v = c.value;
        if (v && typeof v === 'object' && typeof v.formula === 'string') {
          var nv = { formula: shiftFormula(v.formula, n) }; if (v.result !== undefined) nv.result = v.result;
          c.value = nv;
        }
      });
    });
    var empties = []; for (var i = 0; i < n; i++) empties.push([]);
    ws.spliceRows.apply(ws, [1, 0].concat(empties));
    merges.forEach(function (m) { try { ws.mergeCells(shiftRange(m, n)); } catch (e) { /* bỏ qua */ } });
    // ngăn đông cứng / bộ lọc / định dạng có điều kiện / vùng in
    if (ws.views && ws.views.length) ws.views = ws.views.map(function (v) { return v.state === 'frozen' && v.ySplit ? Object.assign({}, v, { ySplit: v.ySplit + n }) : v; });
    if (ws.autoFilter && typeof ws.autoFilter === 'object' && ws.autoFilter.from && ws.autoFilter.to) {
      ws.autoFilter = { from: { row: ws.autoFilter.from.row + n, column: ws.autoFilter.from.column }, to: { row: ws.autoFilter.to.row + n, column: ws.autoFilter.to.column } };
    }
    (ws.conditionalFormattings || []).forEach(function (cf) {
      cf.ref = shiftRange(cf.ref, n);
      (cf.rules || []).forEach(function (r) { if (r.formulae) r.formulae = r.formulae.map(function (f) { return shiftFormula(f, n); }); });
    });
  }

  function put(ws, r, c1, c2, val, o) {
    if (c2 > c1) ws.mergeCells(r, c1, r, c2);
    var cell = ws.getCell(r, c1);
    cell.value = val;
    cell.font = { name: FONT, size: (o && o.size) || 12, bold: !!(o && o.bold), italic: !!(o && o.italic), color: { argb: 'FF000000' } };
    cell.alignment = { horizontal: (o && o.h) || 'center', vertical: 'middle' };
    return cell;
  }

  function heading(ws, opts) {
    var n = Math.max(ws.columnCount || 0, 5);
    var rightCols = Math.min(5, Math.max(2, Math.floor(n / 2)));
    var leftCols = Math.max(1, Math.min(4, n - rightCols));
    var r0 = leftCols + 1, r1 = leftCols + rightCols;
    var now = new Date();
    put(ws, 1, 1, leftCols, COMPANY, { bold: true, size: 11 });
    put(ws, 1, r0, r1, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 12 });
    put(ws, 2, 1, leftCols, (opts && opts.number) || 'Số: ....../......', { size: 11 });
    put(ws, 2, r0, r1, 'Độc lập - Tự do - Hạnh phúc', { bold: true, size: 12 });
    put(ws, 3, r0, r1, 'Hải Phòng, ngày ' + now.getDate() + ' tháng ' + (now.getMonth() + 1) + ' năm ' + now.getFullYear(), { italic: true, size: 12, h: 'right' });
    ws.getRow(1).height = 20; ws.getRow(2).height = 20; ws.getRow(3).height = 20; ws.getRow(4).height = 6; ws.getRow(5).height = 6;
    // tên công ty dài: cho xuống dòng trong khối trái
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    if (COMPANY.length > 30) ws.getRow(1).height = 32;
  }

  function printSetup(ws) {
    var rows = ws.rowCount || 1, cols = ws.columnCount || 1;
    ws.pageSetup = Object.assign({}, ws.pageSetup || {}, {
      paperSize: 9, orientation: cols > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      printArea: 'A1:' + colName(cols) + rows,
      margins: { left: 0.6, right: 0.5, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 }
    });
    ws.headerFooter = { oddFooter: '&L&"Times New Roman"&8Hải Phòng, ngày &D&C&"Times New Roman"&8&A&R&"Times New Roman"&8Trang &P / &N' };
  }
  function colName(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s || 'A'; }

  function standardize(wb, opts) {
    try {
      wb.eachSheet(function (ws) {
        if (ws.__hqStd) return;
        shiftDown(ws, N);
        heading(ws, opts);
        printSetup(ws);
        ws.__hqStd = true;
      });
    } catch (err) {
      console.error('HiconiqueExcel.standardize lỗi (file vẫn được xuất, chỉ thiếu tiêu đề chuẩn):', err);
    }
    return wb;
  }

  return { COMPANY: COMPANY, standardize: standardize };
})();
