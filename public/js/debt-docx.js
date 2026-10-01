/**
 * Văn bản công nợ — xuất DOCX / PDF + xem nhanh (dùng khung xem chung của payslip-docx.js: PayslipDocx.openViewer). 2026-10-01.
 * Thể thức theo quy định pháp luật Việt Nam:
 *  - Công văn: Nghị định 30/2020/NĐ-CP về công tác văn thư (Quốc hiệu – Tiêu ngữ, tên cơ quan, số/ký hiệu, địa danh – ngày tháng, trích yếu "V/v", "Kính gửi", nội dung,
 *    nơi nhận, chức vụ – chữ ký – đóng dấu); khổ A4, lề trên/dưới 2 cm, trái 3 cm, phải 1,5 cm, font Times New Roman 13.
 *  - Biên bản đối chiếu công nợ: Luật Kế toán 88/2015/QH13, Thông tư 133/2016/TT-BTC (đối chiếu số dư công nợ, xác nhận 2 bên).
 *  - Phiếu thu (Mẫu 01-TT) / Phiếu chi (Mẫu 02-TT) / Giấy đề nghị thanh toán (Mẫu 05-TT): Thông tư 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính.
 * Dùng: DebtDocx.open(kind, { debt, party:[debts cùng đối tượng], payment, user }) với kind: 'cv' | 'dc' | 'dn' | 'pt' | 'pc'.
 * Thông tin công ty ở DebtDocx.COMPANY — điền địa chỉ/MST/TK ngân hàng/người đại diện để in đầy đủ trên văn bản (để trống thì in dấu chấm cho điền tay).
 */
var DebtDocx = (function () {
  'use strict';
  var COMPANY = {
    name: 'CÔNG TY TNHH THIẾT KẾ VÀ XÂY DỰNG HICONIQUE', short: 'HICON', place: 'Hải Phòng',
    address: '', taxCode: '', phone: '', email: '', bankAccount: '', bankName: '',
    director: '', directorTitle: 'Giám đốc', accountant: ''
  };
  var PT = null;   // PayslipDocx
  var DOTS = '..........................................';

  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); }
  function vn(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function plain(s) { return String(s || 'NV').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function nowParts() { var d = new Date(); return { dd: pad(d.getDate()), mm: pad(d.getMonth() + 1), yyyy: d.getFullYear(), iso: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }; }
  function words(n) { return PT.moneyWords(n); }
  var PARTY_LABEL = { customer: 'Khách hàng', supplier: 'Nhà cung cấp', subcontractor: 'Nhà thầu phụ', employee: 'Nhân viên', partner: 'Đối tác', bank: 'Ngân hàng', gov: 'Cơ quan nhà nước', landlord: 'Chủ nhà / bên cho thuê', investor: 'Nhà đầu tư', other: 'Đối tác' };

  function kit(D) {
    var FONT = PT.FONT, W = D.WidthType;
    var R = function (t, o) { o = o || {}; return new D.TextRun({ text: t, font: FONT, size: o.size || 26, bold: !!o.bold, italics: !!o.italic, color: o.color, underline: o.underline ? {} : undefined }); };
    var P = function (runs, o) { o = o || {}; return new D.Paragraph({ children: [].concat(runs), alignment: o.align, spacing: { before: o.before || 0, after: o.after == null ? 80 : o.after, line: o.line || 300 }, indent: o.indent, keepNext: o.keepNext }); };
    var none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, noB = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    var ln = { style: D.BorderStyle.SINGLE, size: 4, color: '000000' }, allB = { top: ln, bottom: ln, left: ln, right: ln };
    var C = D.AlignmentType;
    var cell = function (txt, o) {
      o = o || {};
      return new D.TableCell({ borders: allB, verticalAlign: D.VerticalAlign.CENTER, columnSpan: o.span, width: o.w ? { size: o.w, type: W.PERCENTAGE } : undefined, shading: o.fill ? { type: D.ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined, margins: { top: 50, bottom: 50, left: 90, right: 90 },
        children: [P(R(txt, { bold: o.bold, italic: o.italic, size: o.size || 24 }), { align: o.align, after: 0 })] });
    };
    var table = function (rows) { return new D.Table({ width: { size: 100, type: W.PERCENTAGE }, borders: { top: ln, bottom: ln, left: ln, right: ln, insideHorizontal: ln, insideVertical: ln }, rows: rows }); };
    var row = function (cells) { return new D.TableRow({ cantSplit: true, children: cells }); };
    var plainCell = function (children, w) { return new D.TableCell({ borders: noB, verticalAlign: D.VerticalAlign.TOP, width: { size: w, type: W.PERCENTAGE }, children: children }); };
    var plainTable = function (cells) { return new D.Table({ width: { size: 100, type: W.PERCENTAGE }, borders: noB, rows: [new D.TableRow({ children: cells })] }); };
    var sig = function (cols) {   // khối chữ ký n cột: [[chức danh, ghi chú]]
      var w = Math.floor(100 / cols.length);
      return plainTable(cols.map(function (c) { return plainCell([P(R(c[0], { bold: true, size: 24 }), { align: C.CENTER, after: 0 }), P(R(c[1] || '(Ký, họ tên)', { italic: true, size: 22 }), { align: C.CENTER, after: 0 })].concat(c[2] ? [P(R(c[2], { bold: true, size: 24 }), { align: C.CENTER, before: 900 })] : []), w); }));
    };
    var page = function (children) {
      return new D.Document({ creator: 'HICONIQUE Internal Hub', styles: { default: { document: { run: { font: FONT, size: 26 } } } },
        sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 851 } } }, children: children }] });
    };
    // Quốc hiệu – Tiêu ngữ (khối giữa) theo NĐ 30/2020/NĐ-CP
    var quocHieu = function () { return [P(R('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 26 }), { align: C.CENTER, after: 0 }), P(R('Độc lập - Tự do - Hạnh phúc', { bold: true, size: 28 }), { align: C.CENTER, after: 0 }), P(R('───────────────', { size: 24 }), { align: C.CENTER, after: 160 })]; };
    return { R: R, P: P, cell: cell, table: table, row: row, plainCell: plainCell, plainTable: plainTable, sig: sig, page: page, quocHieu: quocHieu, C: C, W: W };
  }

  // ---------- thông tin dùng chung ----------
  function partyLines(d) {
    var l = [];
    l.push([PARTY_LABEL[d.partyType] || 'Đối tượng', d.clientName || DOTS]);
    l.push(['Địa chỉ', d.partyAddress || DOTS]); l.push(['Mã số thuế', d.partyTaxCode || DOTS]); l.push(['Điện thoại', d.partyPhone || DOTS]);
    if (d.partyContact) l.push(['Người liên hệ', d.partyContact]);
    return l;
  }
  function companyContact() {
    var c = [];
    c.push('Địa chỉ: ' + (COMPANY.address || DOTS)); if (COMPANY.taxCode) c.push('MST: ' + COMPANY.taxCode); c.push('Điện thoại: ' + (COMPANY.phone || DOTS));
    return c.join(' · ');
  }
  function debtLabel(d) { return (d.description || 'Công nợ') + (d.refNo ? ' (' + d.refNo + ')' : (d.orderNumber ? ' (ĐH ' + d.orderNumber + ')' : '')); }

  // ---------- A. Công văn (NĐ 30/2020/NĐ-CP) ----------
  function buildCongVan(D, a) {
    var k = kit(D), R = k.R, P = k.P, d = a.debt, n = nowParts(), recv = d.direction === 'receivable';
    var party = (a.party && a.party.length ? a.party : [d]).filter(function (x) { return x.outstanding > 0; });
    if (!party.length) party = [d];
    var total = party.reduce(function (s, x) { return s + (x.outstanding || 0); }, 0);
    var deadline = recv ? (function () { var dt = new Date(); dt.setDate(dt.getDate() + 7); return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); })() : (d.dueDate || n.iso);
    var head = k.plainTable([
      k.plainCell([P(R(COMPANY.name, { bold: true, size: 24 }), { align: k.C.CENTER, after: 0 }), P(R('───────', { size: 22 }), { align: k.C.CENTER, after: 40 }), P(R('Số: ......../CV-' + COMPANY.short, { size: 26 }), { align: k.C.CENTER, after: 0 }),
        P(R('V/v: ' + (recv ? 'đề nghị thanh toán công nợ' : 'thông báo kế hoạch thanh toán công nợ'), { size: 26 }), { align: k.C.CENTER, before: 40, after: 0 })], 40),
      k.plainCell(k.quocHieu().concat([P(R(COMPANY.place + ', ngày ' + n.dd + ' tháng ' + n.mm + ' năm ' + n.yyyy, { italic: true, size: 26 }), { align: k.C.CENTER, after: 0 })]), 60)
    ]);
    var rows = [k.row([k.cell('STT', { bold: true, align: k.C.CENTER, w: 6, fill: 'E7E6E6' }), k.cell('Nội dung / chứng từ', { bold: true, align: k.C.CENTER, w: 34, fill: 'E7E6E6' }), k.cell('Hạn thanh toán', { bold: true, align: k.C.CENTER, w: 16, fill: 'E7E6E6' }), k.cell('Giá trị (đồng)', { bold: true, align: k.C.CENTER, w: 16, fill: 'E7E6E6' }), k.cell('Đã thanh toán', { bold: true, align: k.C.CENTER, w: 14, fill: 'E7E6E6' }), k.cell('Còn lại (đồng)', { bold: true, align: k.C.CENTER, w: 14, fill: 'E7E6E6' })])];
    party.forEach(function (x, i) { rows.push(k.row([k.cell(String(i + 1), { align: k.C.CENTER }), k.cell(debtLabel(x)), k.cell(vn(x.dueDate), { align: k.C.CENTER }), k.cell(fmt(x.amount), { align: k.C.RIGHT }), k.cell(fmt(x.paidAmount), { align: k.C.RIGHT }), k.cell(fmt(x.outstanding), { align: k.C.RIGHT })])); });
    rows.push(k.row([k.cell('Tổng cộng', { bold: true, span: 5, align: k.C.RIGHT, fill: 'F2F2F2' }), k.cell(fmt(total), { bold: true, align: k.C.RIGHT, fill: 'F2F2F2' })]));
    var ind = { firstLine: 567 };
    var body = [head,
      P(R(''), { after: 120 }),
      P([R('Kính gửi: ', { bold: true }), R((PARTY_LABEL[d.partyType] ? '' : '') + (d.clientName || DOTS), { bold: true })], { align: k.C.CENTER, after: 160 })
    ];
    if (recv) {
      body.push(P(R('Căn cứ Bộ luật Dân sự 2015, Luật Thương mại 2005 và ' + (d.refNo ? 'hợp đồng/chứng từ số ' + d.refNo : 'các thỏa thuận giữa hai bên') + ';'), { align: k.C.JUSTIFIED, indent: ind }));
      body.push(P(R('Theo số liệu kế toán của ' + COMPANY.name + ' tính đến ngày ' + n.dd + '/' + n.mm + '/' + n.yyyy + ', Quý đơn vị/Quý khách hiện còn khoản công nợ chưa thanh toán với chúng tôi như sau:'), { align: k.C.JUSTIFIED, indent: ind }));
      body.push(k.table(rows));
      body.push(P([R('Bằng chữ: ', { italic: true }), R(words(total), { italic: true, bold: true })], { before: 80, after: 100, indent: ind }));
      body.push(P(R('Chúng tôi đề nghị Quý đơn vị/Quý khách thanh toán khoản công nợ nêu trên trước ngày ' + vn(deadline) + ', bằng hình thức chuyển khoản theo thông tin dưới đây (hoặc tiền mặt tại văn phòng Công ty):'), { align: k.C.JUSTIFIED, indent: ind }));
      body.push(P(R('- Đơn vị thụ hưởng: ' + COMPANY.name), { indent: { left: 567 }, after: 20 }));
      body.push(P(R('- Số tài khoản: ' + (COMPANY.bankAccount || DOTS) + ' tại ' + (COMPANY.bankName || DOTS)), { indent: { left: 567 }, after: 20 }));
      body.push(P(R('- Nội dung chuyển khoản: Thanh toán công nợ ' + (d.refNo || d.clientName || '')), { indent: { left: 567 }, after: 100 }));
      body.push(P(R('Trường hợp có sai lệch số liệu, đề nghị Quý đơn vị/Quý khách liên hệ bộ phận kế toán của Công ty (' + companyContact() + ') để đối chiếu trong vòng 03 ngày làm việc kể từ ngày nhận văn bản này. Sau thời hạn trên, nếu không có ý kiến phản hồi, số liệu công nợ được coi là đã thống nhất.'), { align: k.C.JUSTIFIED, indent: ind }));
      body.push(P(R('Rất mong nhận được sự hợp tác của Quý đơn vị/Quý khách. Trân trọng cảm ơn!'), { align: k.C.JUSTIFIED, indent: ind, after: 140 }));
    } else {
      body.push(P(R('Căn cứ ' + (d.refNo ? 'hợp đồng/chứng từ số ' + d.refNo : 'các thỏa thuận giữa hai bên') + ' và số liệu kế toán tính đến ngày ' + n.dd + '/' + n.mm + '/' + n.yyyy + ';'), { align: k.C.JUSTIFIED, indent: ind }));
      body.push(P(R(COMPANY.name + ' xác nhận hiện còn khoản phải thanh toán cho Quý đơn vị/Quý ông (bà) như sau:'), { align: k.C.JUSTIFIED, indent: ind }));
      body.push(k.table(rows));
      body.push(P([R('Bằng chữ: ', { italic: true }), R(words(total), { italic: true, bold: true })], { before: 80, after: 100, indent: ind }));
      body.push(P(R('Công ty dự kiến thanh toán khoản nợ trên chậm nhất vào ngày ' + vn(deadline) + '. Đề nghị Quý đơn vị/Quý ông (bà) cung cấp đầy đủ hóa đơn, chứng từ hợp lệ và thông tin tài khoản nhận tiền để Công ty thực hiện thanh toán đúng hạn.'), { align: k.C.JUSTIFIED, indent: ind }));
      body.push(P(R('Công ty chân thành cảm ơn sự hợp tác của Quý đơn vị/Quý ông (bà).'), { align: k.C.JUSTIFIED, indent: ind, after: 140 }));
    }
    var foot = k.plainTable([
      k.plainCell([P(R('Nơi nhận:', { bold: true, italic: true, size: 24 }), { after: 0 }), P(R('- Như trên;', { size: 22 }), { after: 0 }), P(R('- Lưu: VT, KT.', { size: 22 }), { after: 0 })], 50),
      k.plainCell([P(R((COMPANY.directorTitle || 'Giám đốc').toUpperCase(), { bold: true, size: 26 }), { align: k.C.CENTER, after: 0 }), P(R('(Ký, ghi rõ họ tên, đóng dấu)', { italic: true, size: 22 }), { align: k.C.CENTER, after: 0 }), P(R(COMPANY.director || ''), { align: k.C.CENTER, before: 1100, after: 0 })], 50)
    ]);
    body.push(foot);
    return k.page(body);
  }

  // ---------- B. Biên bản đối chiếu công nợ ----------
  function buildDoiChieu(D, a) {
    var k = kit(D), R = k.R, P = k.P, d = a.debt, n = nowParts(), recv = d.direction === 'receivable';
    var list = (a.party && a.party.length ? a.party : [d]);
    var totalAmt = list.reduce(function (s, x) { return s + x.amount; }, 0), totalPaid = list.reduce(function (s, x) { return s + x.paidAmount; }, 0), totalOut = list.reduce(function (s, x) { return s + x.outstanding; }, 0);
    var rows = [k.row(['STT', 'Chứng từ / nội dung', 'Ngày phát sinh', 'Hạn thanh toán', 'Giá trị', 'Đã thanh toán', 'Còn lại'].map(function (h, i) { return k.cell(h, { bold: true, align: k.C.CENTER, fill: 'E7E6E6', w: [5, 31, 12, 12, 14, 13, 13][i] }); }))];
    list.forEach(function (x, i) { rows.push(k.row([k.cell(String(i + 1), { align: k.C.CENTER }), k.cell(debtLabel(x)), k.cell(vn(x.issueDate || String(x.createdAt || '').slice(0, 10)), { align: k.C.CENTER }), k.cell(vn(x.dueDate), { align: k.C.CENTER }), k.cell(fmt(x.amount), { align: k.C.RIGHT }), k.cell(fmt(x.paidAmount), { align: k.C.RIGHT }), k.cell(fmt(x.outstanding), { align: k.C.RIGHT })])); });
    rows.push(k.row([k.cell('Cộng', { bold: true, span: 4, align: k.C.RIGHT, fill: 'F2F2F2' }), k.cell(fmt(totalAmt), { bold: true, align: k.C.RIGHT, fill: 'F2F2F2' }), k.cell(fmt(totalPaid), { bold: true, align: k.C.RIGHT, fill: 'F2F2F2' }), k.cell(fmt(totalOut), { bold: true, align: k.C.RIGHT, fill: 'F2F2F2' })]));
    var who = recv ? 'Bên B còn nợ Bên A' : 'Bên A còn nợ Bên B';
    var ind = { firstLine: 567 };
    var body = [].concat(k.quocHieu(), [
      P(R('BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ', { bold: true, size: 32 }), { align: k.C.CENTER, before: 80, after: 40 }),
      P(R('(Số dư tại ngày ' + n.dd + '/' + n.mm + '/' + n.yyyy + ')', { italic: true }), { align: k.C.CENTER, after: 160 }),
      P(R('Căn cứ Luật Kế toán số 88/2015/QH13, Thông tư số 133/2016/TT-BTC ' + (d.refNo ? 'và hợp đồng/chứng từ số ' + d.refNo : 'và các thỏa thuận giữa hai bên') + ';'), { align: k.C.JUSTIFIED, indent: ind }),
      P(R('Hôm nay, ngày ' + n.dd + ' tháng ' + n.mm + ' năm ' + n.yyyy + ', tại ' + COMPANY.place + ', chúng tôi gồm:'), { indent: ind }),
      P([R('BÊN A: ', { bold: true }), R(COMPANY.name, { bold: true })], { after: 20 }),
      P(R('Địa chỉ: ' + (COMPANY.address || DOTS) + '   Mã số thuế: ' + (COMPANY.taxCode || DOTS)), { after: 20 }),
      P(R('Đại diện: ' + (COMPANY.director || DOTS) + '   Chức vụ: ' + (COMPANY.directorTitle || 'Giám đốc')), { after: 100 }),
      P([R('BÊN B: ', { bold: true }), R(d.clientName || DOTS, { bold: true }), R(' (' + (PARTY_LABEL[d.partyType] || 'Đối tượng') + ')')], { after: 20 }),
      P(R('Địa chỉ: ' + (d.partyAddress || DOTS) + '   Mã số thuế: ' + (d.partyTaxCode || DOTS)), { after: 20 }),
      P(R('Đại diện: ' + (d.partyContact || DOTS) + '   Điện thoại: ' + (d.partyPhone || DOTS)), { after: 120 }),
      P(R('Hai bên cùng đối chiếu số liệu công nợ phát sinh như sau:'), { indent: ind }),
      k.table(rows),
      P([R('Số dư công nợ tại thời điểm đối chiếu: ', { bold: true }), R(fmt(totalOut) + ' đồng', { bold: true }), R(' (' + words(totalOut).replace(/^./, function (c) { return c.toLowerCase(); }) + '). ' + (totalOut > 0 ? who + ' khoản tiền nêu trên.' : 'Hai bên không còn công nợ với nhau.'))], { before: 100, after: 100, indent: ind, align: k.C.JUSTIFIED }),
      P(R('Hai bên thống nhất số liệu nêu trên và cam kết thanh toán đúng hạn theo thỏa thuận. Mọi sai lệch (nếu có) được hai bên cùng rà soát, điều chỉnh bằng văn bản. Biên bản được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.'), { align: k.C.JUSTIFIED, indent: ind, after: 160 }),
      k.sig([['ĐẠI DIỆN BÊN A', '(Ký, ghi rõ họ tên, đóng dấu)', COMPANY.director || ''], ['ĐẠI DIỆN BÊN B', '(Ký, ghi rõ họ tên, đóng dấu)', d.partyContact || '']])
    ]);
    return k.page(body);
  }

  // ---------- C. Giấy đề nghị thanh toán (Mẫu 05-TT) — khoản phải trả ----------
  function buildDeNghi(D, a) {
    var k = kit(D), R = k.R, P = k.P, d = a.debt, n = nowParts(), amt = a.amount != null ? a.amount : d.outstanding;
    var head = k.plainTable([
      k.plainCell([P(R(COMPANY.name, { bold: true, size: 24 }), { align: k.C.CENTER, after: 0 })], 55),
      k.plainCell([P(R('Mẫu số 05 - TT', { bold: true, size: 24 }), { align: k.C.CENTER, after: 20 }), P(R('(Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính)', { italic: true, size: 20 }), { align: k.C.CENTER, after: 0 })], 45)
    ]);
    var rows = [k.row([k.cell('STT', { bold: true, align: k.C.CENTER, w: 8, fill: 'E7E6E6' }), k.cell('Nội dung thanh toán', { bold: true, align: k.C.CENTER, w: 52, fill: 'E7E6E6' }), k.cell('Hạn thanh toán', { bold: true, align: k.C.CENTER, w: 18, fill: 'E7E6E6' }), k.cell('Số tiền (đồng)', { bold: true, align: k.C.CENTER, w: 22, fill: 'E7E6E6' })]),
      k.row([k.cell('1', { align: k.C.CENTER }), k.cell(debtLabel(d)), k.cell(vn(d.dueDate), { align: k.C.CENTER }), k.cell(fmt(amt), { align: k.C.RIGHT })]),
      k.row([k.cell('TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN', { bold: true, span: 3, align: k.C.CENTER, fill: 'F2F2F2' }), k.cell(fmt(amt), { bold: true, align: k.C.RIGHT, fill: 'F2F2F2' })])];
    var body = [head].concat(k.quocHieu().map(function (x) { return x; }), [
      P(R('GIẤY ĐỀ NGHỊ THANH TOÁN', { bold: true, size: 32 }), { align: k.C.CENTER, before: 60, after: 40 }),
      P(R('Ngày ' + n.dd + ' tháng ' + n.mm + ' năm ' + n.yyyy, { italic: true }), { align: k.C.CENTER, after: 40 }),
      P(R('Số: ......../GĐNTT', { italic: true }), { align: k.C.CENTER, after: 160 }),
      P([R('Kính gửi: ', { bold: true }), R('Ban Giám đốc ' + COMPANY.name)], { after: 140 }),
      P([R('Họ và tên người đề nghị thanh toán: '), R((a.user && a.user.name) || DOTS, { bold: true })]),
      P([R('Bộ phận / Chức vụ: '), R((a.user && a.user.role) || DOTS)]),
      P([R('Nội dung thanh toán: '), R('Thanh toán công nợ cho ' + (d.clientName || DOTS) + (d.refNo ? ' theo ' + d.refNo : ''), { bold: true })]),
      P([R('Đơn vị nhận tiền: '), R(d.clientName || DOTS, { bold: true }), R('   Mã số thuế: ' + (d.partyTaxCode || DOTS))]),
      P([R('Số tiền đề nghị thanh toán: '), R(fmt(amt) + ' đồng', { bold: true })]),
      P([R('(Viết bằng chữ: '), R(words(amt), { italic: true, bold: true }), R(')')], { after: 140 }),
      k.table(rows),
      P(R(''), { after: 60 }),
      P([R('Hình thức thanh toán: '), R('☐ Chuyển khoản        ☐ Tiền mặt')]),
      P([R('Thời hạn thanh toán: '), R(vn(d.dueDate) || '......../......../' + n.yyyy)]),
      P([R('Kèm theo: '), R('hợp đồng, hóa đơn, biên bản nghiệm thu / chứng từ gốc có liên quan.')], { after: 100 }),
      P(R('Kính đề nghị Ban Giám đốc xem xét và phê duyệt.', { italic: true }), { after: 100 }),
      P(R(COMPANY.place + ', ngày ' + n.dd + ' tháng ' + n.mm + ' năm ' + n.yyyy, { italic: true }), { align: k.C.RIGHT, after: 100, keepNext: true }),
      k.sig([['GIÁM ĐỐC'], ['KẾ TOÁN TRƯỞNG'], ['TRƯỞNG BỘ PHẬN'], ['NGƯỜI ĐỀ NGHỊ']])
    ]);
    return k.page(body);
  }

  // ---------- D. Phiếu thu (Mẫu 01-TT) / Phiếu chi (Mẫu 02-TT) ----------
  function buildPhieu(D, a, isIn) {
    var k = kit(D), R = k.R, P = k.P, d = a.debt, p = a.payment || {}, n = nowParts();
    var dt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(p.date || '')) || [null, n.yyyy, n.mm, n.dd];
    var acc = p.account || '111', counter = p.counter || (isIn ? '131' : (d.partyType === 'employee' ? '334' : d.partyType === 'bank' || d.partyType === 'investor' ? '341' : d.partyType === 'gov' ? '333' : '331'));
    var head = k.plainTable([
      k.plainCell([P(R('Đơn vị: ' + COMPANY.name, { bold: true, size: 22 }), { after: 0 }), P(R('Địa chỉ: ' + (COMPANY.address || DOTS), { size: 22 }), { after: 0 })], 58),
      k.plainCell([P(R('Mẫu số ' + (isIn ? '01' : '02') + ' - TT', { bold: true, size: 22 }), { align: k.C.CENTER, after: 0 }), P(R('(Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính)', { italic: true, size: 18 }), { align: k.C.CENTER, after: 0 })], 42)
    ]);
    var line = function (label, val, bold) { return P([R(label), R(val, { bold: !!bold })], { after: 70 }); };
    var amt = Number(p.amount) || 0;
    var body = [head,
      k.plainTable([
        k.plainCell([P(R(isIn ? 'PHIẾU THU' : 'PHIẾU CHI', { bold: true, size: 36 }), { align: k.C.CENTER, before: 100, after: 0 }), P(R('Ngày ' + dt[3] + ' tháng ' + dt[2] + ' năm ' + dt[1], { italic: true }), { align: k.C.CENTER, after: 60 }), P(R('Quyển số: .........', { size: 24 }), { align: k.C.CENTER, after: 0 })], 60),
        k.plainCell([P(R('Số: ' + (p.voucherNo || '.........'), { bold: true }), { before: 100, after: 20 }), P(R('Nợ: ' + (isIn ? acc : counter)), { after: 20 }), P(R('Có: ' + (isIn ? counter : acc)), { after: 0 })], 40)
      ]),
      P(R(''), { after: 60 }),
      line(isIn ? 'Họ và tên người nộp tiền: ' : 'Họ và tên người nhận tiền: ', d.clientName || DOTS, true),
      line('Địa chỉ: ', d.partyAddress || DOTS),
      line(isIn ? 'Lý do nộp: ' : 'Lý do chi: ', p.reason || ((isIn ? 'Thanh toán công nợ ' : 'Thanh toán công nợ cho ') + (d.clientName || '') + (d.refNo ? ' theo ' + d.refNo : '') + (p.note ? ' — ' + p.note : ''))),
      line('Số tiền: ', fmt(amt) + ' đồng', true),
      line('(Viết bằng chữ): ', words(amt)),
      line('Kèm theo: ', '.......... chứng từ gốc.'),
      line(isIn ? 'Đã nhận đủ số tiền (viết bằng chữ): ' : 'Đã nhận đủ số tiền (viết bằng chữ): ', words(amt)),
      P(R(COMPANY.place + ', ngày ' + dt[3] + ' tháng ' + dt[2] + ' năm ' + dt[1], { italic: true }), { align: k.C.RIGHT, before: 80, after: 80, keepNext: true }),
      k.sig(isIn ? [['GIÁM ĐỐC'], ['KẾ TOÁN TRƯỞNG'], ['NGƯỜI NỘP TIỀN'], ['NGƯỜI LẬP PHIẾU'], ['THỦ QUỸ']] : [['GIÁM ĐỐC'], ['KẾ TOÁN TRƯỞNG'], ['NGƯỜI LẬP PHIẾU'], ['THỦ QUỸ'], ['NGƯỜI NHẬN TIỀN']]),
      P(R('Chứng từ hạch toán: ' + (p.method || 'Tiền mặt') + ' (TK ' + acc + ')'), { before: 200, after: 0 })
    ];
    return k.page(body);
  }


  // ---------- E. Phiếu thu / chi từ 1 giao dịch trong Sổ tài chính ----------
  // args.entry = giao dịch; args.cashSign > 0 → Phiếu thu, < 0 → Phiếu chi
  function buildEntry(D, a) {
    var e = a.entry, isIn = a.cashSign > 0, code = (/^\d{3,4}/.exec(String(e.counterAccount || '')) || [''])[0];
    var d = { clientName: e.actor || '', partyAddress: '', partyType: 'other' };
    var p = { amount: e.amount, date: e.voucherDate || e.date, voucherNo: e.voucherNo, account: e.account || '111', counter: code || undefined, method: e.account === '112' ? 'Chuyển khoản' : 'Tiền mặt',
      reason: [e.category, e.description].filter(Boolean).join(' — ') };
    return buildPhieu(D, { debt: d, payment: p }, isIn);
  }

  // ---------- F. Chứng từ đơn hàng ----------
  function orderParts(o) {
    var items = Array.isArray(o.items) ? o.items : [], total = Number(o.totalAmount) || 0;
    var col = o.collectedAmount != null && o.collectedAmount !== '' ? Number(o.collectedAmount) || 0 : 0;
    if (o.status === 'paid' || o.financeStatus === 'paid') col = total;
    return { items: items, total: total, col: col, debt: Math.max(0, total - col) };
  }
  function itemsTable(k, items) {
    var hd = ['STT', 'Mã', 'Tên hàng hóa, dịch vụ', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền'], w = [6, 11, 31, 8, 10, 16, 18];
    var rows = [k.row(hd.map(function (h, i) { return k.cell(h, { bold: true, align: k.C.CENTER, fill: 'E7E6E6', w: w[i], size: 22 }); }))];
    items.forEach(function (it, i) { rows.push(k.row([k.cell(String(i + 1), { align: k.C.CENTER, size: 22 }), k.cell(it.code || '', { size: 22 }), k.cell(it.name || '', { size: 22 }), k.cell(it.unit || '', { align: k.C.CENTER, size: 22 }), k.cell(fmt(it.qty), { align: k.C.RIGHT, size: 22 }), k.cell(fmt(it.price), { align: k.C.RIGHT, size: 22 }), k.cell(fmt(it.lineTotal != null ? it.lineTotal : (Number(it.qty) || 0) * (Number(it.price) || 0)), { align: k.C.RIGHT, size: 22 })])); });
    return k.table(rows);
  }
  function totalsLines(k, o, op) {
    var R = k.R, P = k.P, ln = function (l, v, b) { return P([R(l + ': ', { bold: !!b }), R(v, { bold: !!b })], { align: k.C.RIGHT, after: 20 }); };
    var out = [ln('Cộng tiền hàng, dịch vụ', fmt(o.subtotal != null ? o.subtotal : op.items.reduce(function (s, it) { return s + (Number(it.lineTotal) || 0); }, 0)) + ' đ')];
    if (Number(o.discountAmount)) out.push(ln('Chiết khấu / giảm giá (' + (o.discountPercent || 0) + '%)', '-' + fmt(o.discountAmount) + ' đ'));
    out.push(ln('Thuế suất GTGT ' + (o.vatPercent || 0) + '%, tiền thuế GTGT', fmt(o.vatAmount || 0) + ' đ'));
    out.push(ln('TỔNG CỘNG TIỀN THANH TOÁN', fmt(op.total) + ' đ', true));
    out.push(P([R('Số tiền viết bằng chữ: ', { italic: true }), R(words(op.total), { italic: true, bold: true })], { before: 60, after: 100 }));
    return out;
  }
  function orderHead(k, o, kindTitle, note) {
    var R = k.R, P = k.P, n = nowParts(), dt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(o.createdAt || '')) || [null, n.yyyy, n.mm, n.dd];
    return [k.plainTable([
      k.plainCell([P(R(COMPANY.name, { bold: true, size: 24 }), { after: 0 }), P(R('Địa chỉ: ' + (COMPANY.address || DOTS) + (COMPANY.taxCode ? ' · MST: ' + COMPANY.taxCode : ''), { size: 22 }), { after: 0 }), P(R('Điện thoại: ' + (COMPANY.phone || DOTS) + (COMPANY.bankAccount ? ' · TK: ' + COMPANY.bankAccount + ' ' + (COMPANY.bankName || '') : ''), { size: 22 }), { after: 0 })], 60),
      k.plainCell([P(R('Số: ' + (o.orderNumber || o.id), { bold: true, size: 24 }), { align: k.C.CENTER, after: 0 }), P(R('Ngày ' + dt[3] + ' tháng ' + dt[2] + ' năm ' + dt[1], { italic: true, size: 22 }), { align: k.C.CENTER, after: 0 })], 40)
    ]),
    P(R(kindTitle, { bold: true, size: 32 }), { align: k.C.CENTER, before: 140, after: 40 }),
    P(R(note || '', { italic: true, size: 22 }), { align: k.C.CENTER, after: 120 }),
    P([R('Đơn vị bán hàng: '), R(COMPANY.name, { bold: true })], { after: 20 }),
    P([R('Họ tên người mua hàng / Tên đơn vị: '), R(o.clientName || DOTS, { bold: true })], { after: 20 }),
    P(R('Mã số thuế: ' + (o.clientTaxCode || DOTS) + '   Điện thoại: ' + (o.clientPhone || DOTS)), { after: 20 }),
    P(R('Địa chỉ: ' + (o.clientAddress || DOTS)), { after: 20 }),
    P(R('Hình thức thanh toán: ' + (o.paymentMethod || 'TM/CK')), { after: 100 })];
  }
  // F1. Bảng kê hàng hóa, dịch vụ & đề nghị thanh toán (nội dung theo Điều 10 NĐ 123/2020/NĐ-CP) — KHÔNG thay thế hóa đơn GTGT điện tử
  function buildOrderBill(D, a) {
    var k = kit(D), o = a.order, op = orderParts(o), R = k.R, P = k.P;
    var body = orderHead(k, o, 'BẢNG KÊ HÀNG HÓA, DỊCH VỤ KIÊM ĐỀ NGHỊ THANH TOÁN', '(Chứng từ nội bộ — hóa đơn GTGT điện tử được lập riêng theo Nghị định 123/2020/NĐ-CP)').concat([
      itemsTable(k, op.items), P(R(''), { after: 60 })], totalsLines(k, o, op), [
      P([R('Đã thanh toán: '), R(fmt(op.col) + ' đ', { bold: true }), R('      Còn phải thanh toán: '), R(fmt(op.debt) + ' đ', { bold: true }), op.debt > 0 && o.debtDueDate ? R(' (hạn thanh toán ' + vn(o.debtDueDate) + ')') : R('')], { after: 140 }),
      k.sig([['NGƯỜI MUA HÀNG', '(Ký, ghi rõ họ tên)'], ['NGƯỜI LẬP BẢNG KÊ', '(Ký, ghi rõ họ tên)'], ['THỦ TRƯỞNG ĐƠN VỊ', '(Ký, đóng dấu, ghi rõ họ tên)']])]);
    return k.page(body);
  }
  // F2. Báo giá
  function buildOrderQuote(D, a) {
    var k = kit(D), o = a.order, op = orderParts(o), R = k.R, P = k.P, I = { firstLine: 567 };
    var body = [].concat(k.quocHieu(), orderHead(k, o, 'BẢNG BÁO GIÁ', '(Có giá trị trong 15 ngày kể từ ngày báo giá)'), [P(R('Kính gửi: ' + (o.clientName || DOTS), { bold: true }), { align: k.C.CENTER, after: 80 }),
      P(R(COMPANY.name + ' trân trọng gửi tới Quý khách bảng báo giá hàng hóa, dịch vụ như sau:'), { indent: I }), itemsTable(k, op.items), P(R(''), { after: 60 })], totalsLines(k, o, op), [
      P(R('Điều kiện thanh toán: ' + (op.debt > 0 && o.debtDueDate ? 'thanh toán ' + fmt(op.col) + ' đ khi ký xác nhận, số còn lại ' + fmt(op.debt) + ' đ trước ngày ' + vn(o.debtDueDate) + '.' : 'thanh toán theo thỏa thuận hai bên.') + ' Giá đã ' + (Number(o.vatPercent) ? 'bao gồm' : 'chưa bao gồm') + ' thuế GTGT.'), { indent: I, align: k.C.JUSTIFIED, after: 140 }),
      k.sig([['KHÁCH HÀNG XÁC NHẬN', '(Ký, ghi rõ họ tên)'], ['ĐẠI DIỆN ' + COMPANY.short, '(Ký, ghi rõ họ tên, đóng dấu)']])]);
    return k.page(body);
  }
  // F3. Biên bản giao nhận / nghiệm thu
  function buildOrderHandover(D, a) {
    var k = kit(D), o = a.order, op = orderParts(o), R = k.R, P = k.P, n = nowParts(), I = { firstLine: 567 };
    var body = [].concat(k.quocHieu(), [
      P(R('BIÊN BẢN GIAO NHẬN, NGHIỆM THU', { bold: true, size: 32 }), { align: k.C.CENTER, before: 80, after: 40 }),
      P(R('Số đơn hàng: ' + (o.orderNumber || o.id), { italic: true }), { align: k.C.CENTER, after: 140 }),
      P(R('Căn cứ Bộ luật Dân sự 2015, Luật Thương mại 2005 và đơn hàng số ' + (o.orderNumber || o.id) + ';'), { indent: I, align: k.C.JUSTIFIED }),
      P(R('Hôm nay, ngày ' + n.dd + ' tháng ' + n.mm + ' năm ' + n.yyyy + ', tại ' + (o.clientAddress || COMPANY.place) + ', chúng tôi gồm:'), { indent: I }),
      P([R('BÊN GIAO (Bên A): ', { bold: true }), R(COMPANY.name, { bold: true })], { after: 20 }), P(R('Đại diện: ' + (COMPANY.director || DOTS) + '   Chức vụ: ' + (COMPANY.directorTitle || 'Giám đốc')), { after: 80 }),
      P([R('BÊN NHẬN (Bên B): ', { bold: true }), R(o.clientName || DOTS, { bold: true })], { after: 20 }), P(R('Địa chỉ: ' + (o.clientAddress || DOTS) + '   Điện thoại: ' + (o.clientPhone || DOTS)), { after: 100 }),
      P(R('Hai bên cùng xác nhận việc bàn giao, nghiệm thu các hạng mục sau:'), { indent: I }), itemsTable(k, op.items),
      P([R('Giá trị: ', { bold: true }), R(fmt(op.total) + ' đồng', { bold: true }), R(' (' + words(op.total).replace(/^./, function (c) { return c.toLowerCase(); }) + '), đã thanh toán ' + fmt(op.col) + ' đồng, còn lại ' + fmt(op.debt) + ' đồng.')], { before: 100, after: 80, indent: I, align: k.C.JUSTIFIED }),
      P(R('Bên B đã kiểm tra số lượng, chất lượng và đồng ý nghiệm thu. Biên bản lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.'), { indent: I, align: k.C.JUSTIFIED, after: 140 }),
      k.sig([['ĐẠI DIỆN BÊN A', '(Ký, ghi rõ họ tên, đóng dấu)'], ['ĐẠI DIỆN BÊN B', '(Ký, ghi rõ họ tên, đóng dấu)']])]);
    return k.page(body);
  }
  // F4. Phiếu thu cho phần đã thu của đơn
  function buildOrderReceipt(D, a) {
    var o = a.order, op = orderParts(o);
    var d = { clientName: o.clientName, partyAddress: o.clientAddress, partyType: 'customer' };
    var date = String(o.financeReviewedAt || o.updatedAt || o.createdAt || '').slice(0, 10);
    return buildPhieu(D, { debt: d, payment: { amount: op.col, date: date, voucherNo: o.voucherNo || '', method: o.paymentMethod || 'Tiền mặt', reason: 'Thu tiền đơn hàng ' + (o.orderNumber || o.id) } }, true);
  }

  var KINDS = {
    cv: { title: 'Công văn đề nghị thanh toán công nợ', title2: 'Công văn thông báo kế hoạch thanh toán công nợ', build: buildCongVan, file: 'Cong_van_cong_no' },
    dc: { title: 'Biên bản đối chiếu công nợ', build: buildDoiChieu, file: 'Bien_ban_doi_chieu_cong_no' },
    dn: { title: 'Giấy đề nghị thanh toán (Mẫu 05-TT)', build: buildDeNghi, file: 'Giay_de_nghi_thanh_toan' },
    pt: { title: 'Phiếu thu (Mẫu 01-TT)', build: function (D, a) { return buildPhieu(D, a, true); }, file: 'Phieu_thu' },
    ent: { title: 'Phiếu thu / chi (TT 133/2016/TT-BTC)', build: buildEntry, file: 'Phieu' },
    ob: { title: 'Bảng kê hàng hóa, dịch vụ kiêm đề nghị thanh toán', build: buildOrderBill, file: 'Bang_ke' },
    oq: { title: 'Bảng báo giá', build: buildOrderQuote, file: 'Bao_gia' },
    oh: { title: 'Biên bản giao nhận, nghiệm thu', build: buildOrderHandover, file: 'Bien_ban_giao_nhan' },
    or: { title: 'Phiếu thu (Mẫu 01-TT)', build: buildOrderReceipt, file: 'Phieu_thu_don_hang' },
    pc: { title: 'Phiếu chi (Mẫu 02-TT)', build: function (D, a) { return buildPhieu(D, a, false); }, file: 'Phieu_chi' }
  };

  function open(kind, args) {
    PT = window.PayslipDocx;
    if (!PT || !PT.openViewer) { alert('Chưa tải xong bộ tạo file Word. Thử lại sau vài giây.'); return Promise.resolve(); }
    var cfgK = KINDS[kind]; if (!cfgK) return Promise.resolve();
    var d = args.debt, title, sub, who;
    if (args.order) { title = cfgK.title; sub = (args.order.clientName || '') + ' · ' + (args.order.orderNumber || '') + ' · ' + fmt(args.order.totalAmount) + ' đ'; who = (args.order.orderNumber || '') + '_' + (args.order.clientName || ''); }
    else if (args.entry) { var inn = args.cashSign > 0; title = inn ? 'Phiếu thu (Mẫu 01-TT)' : 'Phiếu chi (Mẫu 02-TT)'; sub = (args.entry.voucherNo || '') + ' · ' + (args.entry.actor || '') + ' · ' + fmt(args.entry.amount) + ' đ'; who = (inn ? 'thu' : 'chi') + '_' + (args.entry.voucherNo || '') + '_' + (args.entry.actor || ''); }
    else { title = (kind === 'cv' && d.direction === 'payable') ? cfgK.title2 : cfgK.title; sub = (d.clientName || '') + ' · ' + (d.direction === 'payable' ? 'Phải trả' : 'Phải thu') + ' ' + fmt(d.outstanding != null ? d.outstanding : d.amount) + ' đ'; who = (d.clientName || '') + (args.payment && args.payment.voucherNo ? '_' + args.payment.voucherNo : ''); }
    var fileName = cfgK.file + '_' + plain(who) + '_' + nowParts().iso.replace(/-/g, '') + '.docx';
    return PT.openViewer({
      title: title, sub: sub, fileName: fileName,
      makeBlob: function () { return PT.ensureDocx().then(function (D) { return D.Packer.toBlob(cfgK.build(D, args)); }); }
    });
  }

  return { open: open, COMPANY: COMPANY, KINDS: KINDS };
})();
