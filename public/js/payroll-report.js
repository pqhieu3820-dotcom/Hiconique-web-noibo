/**
 * Bảng thanh toán tiền lương TOÀN CÔNG TY theo tháng — Mẫu số 02-LĐTL (Thông tư 133/2016/TT-BTC, Phụ lục 3) — xuất Word / PDF (khung xem của payslip-docx.js) và Excel.
 * Bố cục theo file BTTTL 2026.xls của công ty: tiêu đề + Mẫu số, cột TT/Họ tên/Chức vụ/Số công/Lương theo hợp đồng…, dòng "I. Tiền lương", dòng Cộng,
 * ngày tháng, chữ ký (Người lập biểu – Thủ quỹ – Kế toán trưởng – Giám đốc). Thông tin công ty lấy từ PayslipDocx.COMPANY (đã đổi thành tên công ty HICONIQUE).
 * Dữ liệu: phiếu lương của tháng (đã duyệt/chờ duyệt) nếu có; chưa có phiếu thì DỰ TÍNH từ ngày công + cơ cấu lương hiện hành (đánh dấu *).
 * Dùng: PayrollReport.view(month, ctx) / .word(month, ctx) / .excel(month, ctx) — ctx = { TaskManager, SalaryStructure, user }.
 */
var PayrollReport = (function () {
  'use strict';
  var KIND_ORDER = { bh: 1, allowance: 2, performance: 3 };

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function fmt(n) { return Math.round(num(n)).toLocaleString('vi-VN'); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function mmYYYY(m) { var p = String(m).split('-'); return p[1] + '/' + p[0]; }
  function plain(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function company() { return (window.PayslipDocx && PayslipDocx.COMPANY) || 'CÔNG TY TNHH THIẾT KẾ VÀ XÂY DỰNG HICONIQUE'; }
  function place() { return (window.DebtDocx && DebtDocx.COMPANY && DebtDocx.COMPANY.place) || 'Hải Phòng'; }
  function lastDay(m) { var p = String(m).split('-'); return new Date(Number(p[0]), Number(p[1]), 0).getDate(); }

  // ---------------- dữ liệu ----------------
  function collect(month, ctx) {
    var TM = ctx.TaskManager, SS = ctx.SalaryStructure, comps = TM.getSalaryComponents();
    var members = TM.getMembers();
    var slips = TM.getPayslips({ month: month }).filter(function (s) { return s.status !== 'rejected'; });
    var slipOf = {}; slips.forEach(function (s) { if (!slipOf[s.memberId] || s.status === 'approved') slipOf[s.memberId] = s; });
    var rows = [];
    members.forEach(function (m) {
      var slip = slipOf[m.id], base = TaskManager.effectiveBaseSalary(m);
      if (!slip && !base) return;
      var r = { id: m.id, name: m.name, role: m.role || '', contract: base, items: [], status: slip ? slip.status : 'provisional' };
      if (slip) {
        var sn = SS.parseSnapshot(slip.breakdown);
        r.days = num(slip.workDays); r.contract = num(slip.baseSalary) || base;
        r.otHours = num(slip.otHours); r.otAmount = num(slip.otAmount); r.commission = num(slip.commissionAmount); r.bonus = num(slip.otherBonus);
        r.deduct = num(slip.deduction); r.bhEmployee = num(slip.bhEmployee); r.net = num(slip.totalAmount);
        if (sn) { r.items = sn.items.map(function (x) { return { k: x.k, n: x.n, e: num(x.e) }; }); r.workPay = num(sn.workPay); r.bhBase = num(sn.bhBase); }
        else { r.workPay = Math.max(0, r.net - r.otAmount - r.commission - r.bonus + r.deduct + r.bhEmployee); r.items = [{ k: 'performance', n: 'Lương theo ngày công', e: r.workPay }]; r.bhBase = 0; }
      } else {
        var st = TM.getMonthlyTimesheetStats(m.id, month), bd = SS.compute(base, st.workDays, comps);
        var otRate = base / TM.STANDARD_MONTHLY_HOURS * TM.OT_MULTIPLIER;
        r.days = st.workDays; r.workPay = bd.workPay; r.items = bd.items.map(function (x) { return { k: x.kind, n: x.name, e: num(x.earned) }; }); r.bhBase = bd.bhBase;
        r.otHours = st.overtimeHours; r.otAmount = Math.round(st.overtimeHours * otRate); r.commission = num(TM.getMemberCommissionTotal(m.id, month)); r.bonus = 0; r.deduct = 0;
        r.bhEmployee = SS.dedOn(comps) ? bd.bhEmployee : 0;
        r.net = Math.round(r.workPay + r.otAmount + r.commission - r.bhEmployee);
      }
      // khấu trừ BH tách 2 cột: BHXH 8% + BHTN 1% = 9% ; BHYT 1,5% (phần còn lại)
      r.bhxh = r.bhEmployee ? Math.round(r.bhEmployee * 9 / 10.5) : 0; r.byt = r.bhEmployee - r.bhxh;
      r.income = r.workPay + r.otAmount + r.commission + r.bonus;
      rows.push(r);
    });
    // cột khoản lương theo cơ cấu = hợp nhất theo (kind, tên), thứ tự: BH → hỗ trợ → hiệu quả
    var cols = [], seen = {};
    rows.forEach(function (r) { r.items.forEach(function (x) { var key = x.k + '|' + x.n; if (!seen[key]) { seen[key] = 1; cols.push({ k: x.k, n: x.n, key: key }); } }); });
    cols.sort(function (a, b) { return (KIND_ORDER[a.k] || 9) - (KIND_ORDER[b.k] || 9); });
    rows.forEach(function (r) { r.col = {}; r.items.forEach(function (x) { r.col[x.k + '|' + x.n] = (r.col[x.k + '|' + x.n] || 0) + x.e; }); });
    return { month: month, rows: rows, cols: cols };
  }
  function totals(d) {
    var t = { contract: 0, workPay: 0, otHours: 0, otAmount: 0, commission: 0, bonus: 0, income: 0, bhxh: 0, byt: 0, deduct: 0, net: 0, col: {} };
    d.cols.forEach(function (c) { t.col[c.key] = 0; });
    d.rows.forEach(function (r) { ['contract', 'workPay', 'otHours', 'otAmount', 'commission', 'bonus', 'income', 'bhxh', 'byt', 'deduct', 'net'].forEach(function (k) { t[k] += num(r[k]); }); d.cols.forEach(function (c) { t.col[c.key] += num(r.col[c.key]); }); });
    return t;
  }
  function headerLabels(d) {
    // [nhóm, tên cột, loại] — loại: txt | num | sum (dùng cho Excel/Word)
    return { fixed: ['TT', 'Họ và tên', 'Chức vụ', 'Số công TG', 'Lương theo hợp đồng'], items: d.cols.map(function (c) { return c.n; }),
      mid: ['Lương theo thời gian', 'Số giờ làm thêm', 'Lương làm thêm', 'Hoa hồng dự án', 'Thưởng khác', 'Tổng thu nhập'], ded: ['BHXH + BHTN (9%)', 'BHYT (1,5%)', 'Khấu trừ khác'], tail: ['Số tiền thực lĩnh', 'Ký nhận'] };
  }

  // ---------------- Word / PDF ----------------
  function buildDocx(D, d) {
    var FONT = PayslipDocx.FONT, W = D.WidthType, C = D.AlignmentType, SZ = 15;
    var R = function (t, o) { o = o || {}; return new D.TextRun({ text: String(t), font: FONT, size: o.size || SZ, bold: !!o.bold, italics: !!o.italic }); };
    var P = function (runs, o) { o = o || {}; return new D.Paragraph({ children: [].concat(runs), alignment: o.align, spacing: { before: o.before || 0, after: o.after == null ? 40 : o.after, line: 260 } }); };
    var ln = { style: D.BorderStyle.SINGLE, size: 4, color: '000000' }, none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    var allB = { top: ln, bottom: ln, left: ln, right: ln }, noB = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    var L = headerLabels(d), t = totals(d), n = d.cols.length;
    var colsDef = [['TT', 3, C.CENTER], ['Họ và tên', 11, C.LEFT], ['Chức vụ', 8, C.LEFT], ['Số công', 3, C.CENTER], ['Lương theo hợp đồng', 7, C.RIGHT]];
    d.cols.forEach(function (c) { colsDef.push([c.n, 6.2, C.RIGHT]); });
    [['Lương theo thời gian', 7], ['Giờ làm thêm', 3], ['Lương làm thêm', 5.5], ['Hoa hồng dự án', 5.5], ['Thưởng khác', 5], ['Tổng thu nhập', 7], ['BHXH + BHTN (9%)', 5.5], ['BHYT (1,5%)', 5], ['Khấu trừ khác', 5], ['Số tiền thực lĩnh', 7.5], ['Ký nhận', 6]].forEach(function (x) { colsDef.push([x[0], x[1], x[0] === 'Ký nhận' ? C.CENTER : C.RIGHT]); });
    var tot = colsDef.reduce(function (s, c) { return s + c[1]; }, 0);
    var cell = function (txt, i, o) {
      o = o || {};
      return new D.TableCell({ borders: allB, verticalAlign: D.VerticalAlign.CENTER, width: { size: colsDef[i][1] / tot * 100, type: W.PERCENTAGE }, columnSpan: o.span, shading: o.fill ? { type: D.ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined, margins: { top: 30, bottom: 30, left: 40, right: 40 },
        children: [P(R(txt, { bold: o.bold, size: o.size }), { align: o.align || colsDef[i][2], after: 0 })] });
    };
    var hdr = new D.TableRow({ tableHeader: true, cantSplit: true, children: colsDef.map(function (c, i) { return cell(c[0], i, { bold: true, fill: 'E7E6E6', align: C.CENTER }); }) });
    var idx = {}; var base = 5 + n; // chỉ số các cột sau cột khoản lương
    var rowsT = [hdr];
    rowsT.push(new D.TableRow({ cantSplit: true, children: [cell('I', 0, { bold: true, align: C.CENTER }), cell('Tiền lương', 1, { bold: true, span: colsDef.length - 2, align: C.LEFT })] }));
    d.rows.forEach(function (r, k) {
      var v = [String(k + 1), r.name + (r.status === 'provisional' ? ' *' : ''), r.role, r.days ? String(r.days) : '', fmt(r.contract)];
      d.cols.forEach(function (c) { v.push(r.col[c.key] ? fmt(r.col[c.key]) : ''); });
      [fmt(r.workPay), r.otHours ? String(Math.round(r.otHours * 10) / 10).replace('.', ',') : '', r.otAmount ? fmt(r.otAmount) : '', r.commission ? fmt(r.commission) : '', r.bonus ? fmt(r.bonus) : '', fmt(r.income), r.bhxh ? fmt(r.bhxh) : '', r.byt ? fmt(r.byt) : '', r.deduct ? fmt(r.deduct) : '', fmt(r.net), ''].forEach(function (x) { v.push(x); });
      rowsT.push(new D.TableRow({ cantSplit: true, height: { value: 420, rule: D.HeightRule.ATLEAST }, children: v.map(function (x, i) { return cell(x, i, { bold: i === colsDef.length - 2 }); }) }));
    });
    var sumV = ['', 'Cộng:', '', '', fmt(t.contract)];
    d.cols.forEach(function (c) { sumV.push(fmt(t.col[c.key])); });
    [fmt(t.workPay), t.otHours ? String(Math.round(t.otHours * 10) / 10).replace('.', ',') : '', fmt(t.otAmount), fmt(t.commission), fmt(t.bonus), fmt(t.income), fmt(t.bhxh), fmt(t.byt), fmt(t.deduct), fmt(t.net), ''].forEach(function (x) { sumV.push(x); });
    rowsT.push(new D.TableRow({ cantSplit: true, children: sumV.map(function (x, i) { return cell(x, i, { bold: true, fill: 'F2F2F2' }); }) }));
    var table = new D.Table({ width: { size: 100, type: W.PERCENTAGE }, rows: rowsT, borders: { top: ln, bottom: ln, left: ln, right: ln, insideHorizontal: ln, insideVertical: ln } });
    var nowD = new Date(), lastD = lastDay(d.month), p = d.month.split('-');
    var sigCell = function (title, name, w) { return new D.TableCell({ borders: noB, width: { size: w, type: W.PERCENTAGE }, children: [P(R(title, { bold: true, size: 20 }), { align: C.CENTER, after: 0 }), P(R('(Ký, ghi rõ họ tên)', { italic: true, size: 18 }), { align: C.CENTER, after: 0 }), P(R(name || ''), { align: C.CENTER, before: 700 })] }); };
    var sig = new D.Table({ width: { size: 100, type: W.PERCENTAGE }, borders: noB, rows: [new D.TableRow({ children: [sigCell('NGƯỜI LẬP BIỂU', '', 25), sigCell('THỦ QUỸ', '', 25), sigCell('KẾ TOÁN TRƯỞNG', '', 25), sigCell('GIÁM ĐỐC CÔNG TY', '', 25)] })] });
    var head = new D.Table({ width: { size: 100, type: W.PERCENTAGE }, borders: noB, rows: [new D.TableRow({ children: [
      new D.TableCell({ borders: noB, width: { size: 60, type: W.PERCENTAGE }, children: [P(R(company(), { bold: true, size: 22 }), { after: 0 }), P(R('Địa chỉ: ........................................................', { size: 18 }), { after: 0 })] }),
      new D.TableCell({ borders: noB, width: { size: 40, type: W.PERCENTAGE }, children: [P(R('Mẫu số 02 - LĐTL', { bold: true, size: 20 }), { align: C.CENTER, after: 0 }), P(R('(Ban hành kèm theo Thông tư số 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính)', { italic: true, size: 16 }), { align: C.CENTER, after: 0 })] })] })] });
    var body = [head,
      P(R('BẢNG THANH TOÁN TIỀN LƯƠNG', { bold: true, size: 32 }), { align: C.CENTER, before: 80, after: 20 }),
      P(R('Tháng ' + p[1] + ' năm ' + p[0], { bold: true, size: 24 }), { align: C.CENTER, after: 20 }),
      P(R('(Bộ phận: Toàn công ty)', { italic: true, size: 20 }), { align: C.CENTER, after: 100 }),
      table,
      P([R('Tổng số tiền thực lĩnh: ', { bold: true, size: 20 }), R(fmt(t.net) + ' đồng', { bold: true, size: 20 }), R(' — viết bằng chữ: ' + PayslipDocx.moneyWords(t.net), { italic: true, size: 20 })], { before: 100, after: 40 }),
      d.rows.some(function (r) { return r.status === 'provisional'; }) ? P(R('(*) Dự tính theo ngày công chấm và cơ cấu lương hiện hành — chưa có phiếu đề nghị thanh toán lương được duyệt.', { italic: true, size: 16 }), { after: 40 }) : P(R(''), { after: 0 }),
      P(R(place() + ', ngày ' + lastD + ' tháng ' + p[1] + ' năm ' + p[0], { italic: true, size: 20 }), { align: C.RIGHT, after: 60 }),
      sig];
    return new D.Document({ creator: 'HICONIQUE Internal Hub', title: 'Bảng thanh toán tiền lương ' + mmYYYY(d.month), styles: { default: { document: { run: { font: FONT, size: SZ } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838, orientation: D.PageOrientation.LANDSCAPE }, margin: { top: 850, bottom: 850, left: 850, right: 850 } } }, children: body }] });
  }
  function openDoc(month, ctx) {
    var d = collect(month, ctx);
    if (!d.rows.length) { alert('Chưa có nhân viên nào có lương hợp đồng / phiếu lương trong tháng ' + mmYYYY(month) + '.'); return Promise.resolve(); }
    return PayslipDocx.openViewer({ title: 'Bảng thanh toán tiền lương ' + mmYYYY(month), sub: d.rows.length + ' nhân viên · Thực lĩnh ' + fmt(totals(d).net) + ' đ', fileName: 'Bang_thanh_toan_luong_' + month.replace('-', '_') + '.docx',
      makeBlob: function () { return PayslipDocx.ensureDocx().then(function (D) { return D.Packer.toBlob(buildDocx(D, d)); }); } });
  }

  // ---------------- Excel ----------------
  function loadExcelJs() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'; s.onload = res; s.onerror = function () { rej(new Error('Không tải được thư viện Excel')); }; document.head.appendChild(s); });
  }
  function colLetter(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function excel(month, ctx) {
    var d = collect(month, ctx);
    if (!d.rows.length) { alert('Chưa có nhân viên nào có lương hợp đồng / phiếu lương trong tháng ' + mmYYYY(month) + '.'); return Promise.resolve(); }
    return loadExcelJs().then(function () {
      var wb = new ExcelJS.Workbook(); wb.creator = company(); wb.created = new Date();
      var ws = wb.addWorksheet('Bảng thanh toán lương', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .3, footer: .3 } } });
      var F = 'Times New Roman', n = d.cols.length, p = month.split('-');
      // cột: A TT, B Tên, C Chức vụ, D Công, E Lương HĐ, [F.. items], rồi: LTG, giờ OT, lương OT, hoa hồng, thưởng, tổng TN, BHXH, BHYT, KT khác, thực lĩnh, ký nhận
      var cI = 5, cWork = cI + n, cOtH = cWork + 1, cOt = cWork + 2, cCom = cWork + 3, cBon = cWork + 4, cInc = cWork + 5, cBhxh = cWork + 6, cByt = cWork + 7, cDed = cWork + 8, cNet = cWork + 9, cSig = cWork + 10, last = cSig + 1;
      var HR = 6, FIRST = HR + 2;
      var heads = ['TT', 'Họ và tên', 'Chức vụ', 'Số công TG', 'Lương theo hợp đồng'].concat(d.cols.map(function (c) { return c.n; }), ['Lương theo thời gian', 'Số giờ làm thêm', 'Lương làm thêm', 'Hoa hồng dự án', 'Thưởng khác', 'Tổng thu nhập', 'BHXH + BHTN (9%)', 'BHYT (1,5%)', 'Khấu trừ khác', 'Số tiền thực lĩnh', 'Ký nhận']);
      var set = function (r, c, v, o) { var x = ws.getCell(r, c); x.value = v; o = o || {}; x.font = { name: F, size: o.size || 11, bold: !!o.bold, italic: !!o.italic }; if (o.align) x.alignment = { horizontal: o.align, vertical: 'middle', wrapText: !!o.wrap }; if (o.num) x.numFmt = o.num; return x; };
      ws.mergeCells(1, 1, 1, 4); set(1, 1, company(), { bold: true, size: 12 });
      ws.mergeCells(2, 1, 2, 4); set(2, 1, 'Địa chỉ: ........................................', { size: 10 });
      ws.mergeCells(1, last - 4, 1, last); set(1, last - 4, 'Mẫu số 02 - LĐTL', { bold: true, align: 'center' });
      ws.mergeCells(2, last - 4, 2, last); ws.getRow(2).height = 26; set(2, last - 4, '(Ban hành kèm theo Thông tư số 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính)', { italic: true, size: 9, align: 'center', wrap: true });
      ws.mergeCells(3, 1, 3, last); set(3, 1, 'BẢNG THANH TOÁN TIỀN LƯƠNG', { bold: true, size: 16, align: 'center' });
      ws.mergeCells(4, 1, 4, last); set(4, 1, 'Tháng ' + p[1] + ' năm ' + p[0], { bold: true, size: 12, align: 'center' });
      ws.mergeCells(5, 1, 5, last); set(5, 1, '(Bộ phận: Toàn công ty)', { italic: true, align: 'center' });
      // dòng tiêu đề 2 tầng
      heads.forEach(function (h, i) { ws.mergeCells(HR, i + 1, HR + 1, i + 1); var x = set(HR, i + 1, h, { bold: true, align: 'center', wrap: true }); x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }; });
      for (var r = HR; r <= HR + 1; r++) for (var c = 1; c <= last; c++) ws.getCell(r, c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      ws.getRow(HR).height = 24; ws.getRow(HR + 1).height = 24;
      var thin = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      var secRow = FIRST; ws.mergeCells(secRow, 2, secRow, last); set(secRow, 1, 'I', { bold: true, align: 'center' }); set(secRow, 2, 'Tiền lương', { bold: true });
      for (c = 1; c <= last; c++) ws.getCell(secRow, c).border = thin;
      var r0 = secRow + 1;
      d.rows.forEach(function (row, k) {
        var r = r0 + k;
        set(r, 1, k + 1, { align: 'center' }); set(r, 2, row.name + (row.status === 'provisional' ? ' *' : ''), {}); set(r, 3, row.role, {}); set(r, 4, row.days || '', { align: 'center' }); set(r, 5, row.contract, { num: '#,##0' });
        d.cols.forEach(function (c2, j) { set(r, cI + 1 + j, row.col[c2.key] || 0, { num: '#,##0;-#,##0;""' }); });
        var A = colLetter(cI), B = colLetter(cWork - 1);
        set(r, cWork, n ? { formula: 'SUM(' + colLetter(cI) + r + ':' + colLetter(cWork - 1) + r + ')' } : row.workPay, { num: '#,##0' });
        set(r, cOtH, row.otHours || '', { num: '0.0' }); set(r, cOt, row.otAmount || 0, { num: '#,##0;-#,##0;""' }); set(r, cCom, row.commission || 0, { num: '#,##0;-#,##0;""' }); set(r, cBon, row.bonus || 0, { num: '#,##0;-#,##0;""' });
        set(r, cInc, { formula: colLetter(cWork - 1) + r + '+' + colLetter(cOt - 1) + r + '+' + colLetter(cCom - 1) + r + '+' + colLetter(cBon - 1) + r }, { num: '#,##0' });
        set(r, cBhxh, row.bhxh || 0, { num: '#,##0;-#,##0;""' }); set(r, cByt, row.byt || 0, { num: '#,##0;-#,##0;""' }); set(r, cDed, row.deduct || 0, { num: '#,##0;-#,##0;""' });
        set(r, cNet, { formula: colLetter(cInc - 1) + r + '-' + colLetter(cBhxh - 1) + r + '-' + colLetter(cByt - 1) + r + '-' + colLetter(cDed - 1) + r }, { num: '#,##0', bold: true });
        for (var c3 = 1; c3 <= last; c3++) { ws.getCell(r, c3).border = thin; if (!ws.getCell(r, c3).alignment) ws.getCell(r, c3).alignment = { vertical: 'middle', wrapText: c3 === 2 || c3 === 3 }; }
        ws.getRow(r).height = 22;
      });
      var rl = r0 + d.rows.length - 1, rs = rl + 1;
      set(rs, 2, 'Cộng:', { bold: true });
      for (c = 5; c <= cNet; c++) { if (c === cOtH) { set(rs, c, { formula: 'SUM(' + colLetter(c - 1) + r0 + ':' + colLetter(c - 1) + rl + ')' }, { bold: true, num: '0.0' }); continue; } set(rs, c, { formula: 'SUM(' + colLetter(c - 1) + r0 + ':' + colLetter(c - 1) + rl + ')' }, { bold: true, num: '#,##0' }); }
      for (c = 1; c <= last; c++) { var x2 = ws.getCell(rs, c); x2.border = thin; x2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; }
      ws.mergeCells(rs + 2, 1, rs + 2, last);
      set(rs + 2, 1, 'Tổng số tiền thực lĩnh bằng chữ: ' + PayslipDocx.moneyWords(totals(d).net), { italic: true });
      var dr = rs + 3; if (d.rows.some(function (r) { return r.status === 'provisional'; })) { ws.mergeCells(dr, 1, dr, last); set(dr, 1, '(*) Dự tính theo ngày công chấm và cơ cấu lương hiện hành — chưa có phiếu đề nghị thanh toán lương được duyệt.', { italic: true, size: 9 }); }
      ws.mergeCells(rs + 4, last - 5, rs + 4, last); set(rs + 4, last - 5, place() + ', ngày ' + lastDay(month) + ' tháng ' + p[1] + ' năm ' + p[0], { italic: true, align: 'center' });
      var sg = rs + 5, seg = Math.max(4, Math.floor((last - 1) / 4)), cols4 = [['NGƯỜI LẬP BIỂU', 2], ['THỦ QUỸ', 2 + seg], ['KẾ TOÁN TRƯỞNG', 2 + 2 * seg], ['GIÁM ĐỐC CÔNG TY', 2 + 3 * seg]];
      cols4.forEach(function (s) { var e = Math.min(last, s[1] + seg - 2); if (s[1] > last) return; ws.mergeCells(sg, s[1], sg, e); set(sg, s[1], s[0], { bold: true, align: 'center' }); ws.mergeCells(sg + 1, s[1], sg + 1, e); set(sg + 1, s[1], '(Ký, ghi rõ họ tên)', { italic: true, size: 9, align: 'center' }); });
      ws.getColumn(1).width = 5; ws.getColumn(2).width = 24; ws.getColumn(3).width = 18; ws.getColumn(4).width = 8; for (var cc = 5; cc <= last; cc++) ws.getColumn(cc).width = cc === cOtH ? 8 : (cc === last ? 14 : 14);
      ws.views = [{ state: 'frozen', xSplit: 2, ySplit: HR + 1 }];
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = 'Bang_thanh_toan_luong_' + month.replace('-', '_') + '.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  }

  return { collect: collect, totals: totals, view: openDoc, word: openDoc, excel: excel, fmt: fmt };
})();
