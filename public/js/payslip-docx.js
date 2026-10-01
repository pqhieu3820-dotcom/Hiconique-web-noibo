/**
 * Giấy đề nghị thanh toán lương — xuất DOCX + xem nhanh trên web (2026-09-30).
 * Bố cục theo Mẫu số 05-TT "Giấy đề nghị thanh toán" (Thông tư 133/2016/TT-BTC của Bộ Tài chính) kết hợp Quốc hiệu – Tiêu ngữ,
 * khổ A4, lề chuẩn văn bản hành chính (Nghị định 30/2020/NĐ-CP: trên/dưới 2cm, trái 3cm, phải 1.5cm), font Times New Roman 13.
 * Thư viện nạp khi cần (không nặng trang): docx 8.5 (tạo file), JSZip + docx-preview (xem nhanh).
 * Dùng: PayslipDocx.download(data) · PayslipDocx.preview(data)   với data = { member:{name,role,id,bankAccount}, month:'yyyy-mm', baseSalary, workDays, totalHours, otHours, otRate, otAmount, commissionAmount, otherBonus, otherBonusNote, deduction, deductionNote, totalAmount, note }
 */
var PayslipDocx = (function () {
  'use strict';
  var COMPANY = 'CÔNG TY TNHH THIẾT KẾ VÀ XÂY DỰNG HICONIQUE';
  var FONT = 'Times New Roman';
  var LIB = { docx: null, preview: null, loading: null };

  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Không tải được thư viện: ' + src)); }; document.head.appendChild(s); });
  }
  function ensureDocx() {
    if (LIB.docx) return Promise.resolve(LIB.docx);
    return loadScript('https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js').then(function () { LIB.docx = window.docx; return LIB.docx; });
  }
  function loadPdfLibs() {
    if (window.htmlToImage && window.jspdf) return Promise.resolve();
    // html-to-image (SVG foreignObject) chụp bằng chính bộ dựng của trình duyệt → GIỐNG HỆT bản xem (html2canvas làm lệch/cắt chữ ở bảng)
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js').then(function () { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); });
  }
  function ensurePreview() {
    if (LIB.preview) return Promise.resolve(LIB.preview);
    // docx-preview cũng đặt tên global `docx` → chạy SAU khi đã giữ tham chiếu thư viện tạo file
    return ensureDocx().then(function () { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'); })
      .then(function () { return loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js'); })
      .then(function () { LIB.preview = window.docx; return LIB.preview; });
  }

  // ---------- tiện ích ----------
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); }
  var DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function three(n, full) {
    var tr = Math.floor(n / 100), ch = Math.floor((n % 100) / 10), dv = n % 10, s = '';
    if (full || tr > 0) { s += DIGITS[tr] + ' trăm'; if (ch === 0 && dv > 0) s += ' lẻ'; }
    if (ch > 1) { s += ' ' + DIGITS[ch] + ' mươi'; if (dv === 1) s += ' mốt'; else if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + DIGITS[dv]; }
    else if (ch === 1) { s += ' mười'; if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + DIGITS[dv]; }
    else if (dv > 0) { s += (s ? ' ' : '') + DIGITS[dv]; }
    return s.trim();
  }
  function moneyWords(n) {
    n = Math.round(Number(n) || 0);
    if (n === 0) return 'Không đồng';
    var neg = n < 0; n = Math.abs(n);
    var units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'], parts = [], i = 0;
    while (n > 0) { var g = n % 1000; if (g > 0) parts.unshift(three(g, n >= 1000 && parts.length >= 0 && Math.floor(n / 1000) > 0) + units[i]); n = Math.floor(n / 1000); i++; }
    var s = parts.join(' ').replace(/\s+/g, ' ').trim();
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return (neg ? 'Âm ' + s.toLowerCase() : s) + ' đồng chẵn';
  }
  function mmYYYY(ym) { var p = String(ym || '').split('-'); return p.length >= 2 ? p[1] + '/' + p[0] : ym; }

  // ---------- dựng tài liệu ----------
  function build(D, d) {
    var m = d.member || {}, now = new Date(), pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var R = function (t, o) { o = o || {}; return new D.TextRun({ text: t, font: FONT, size: o.size || 26, bold: !!o.bold, italics: !!o.italic, color: o.color }); };
    var P = function (runs, o) { o = o || {}; return new D.Paragraph({ children: [].concat(runs), alignment: o.align, spacing: { before: o.before || 0, after: o.after == null ? 80 : o.after, line: o.line || 300 }, indent: o.indent, keepNext: o.keepNext }); };
    var none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    var noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    var line = { style: D.BorderStyle.SINGLE, size: 4, color: '000000' };
    var allBorders = { top: line, bottom: line, left: line, right: line };
    var W = D.WidthType;

    // Đầu văn bản: đơn vị (trái) + Mẫu số (phải)
    var head = new D.Table({
      width: { size: 100, type: W.PERCENTAGE }, borders: noBorders, columnWidths: [5200, 4200],
      rows: [new D.TableRow({ children: [
        new D.TableCell({ borders: noBorders, verticalAlign: D.VerticalAlign.CENTER, width: { size: 55, type: W.PERCENTAGE }, children: [P(R(COMPANY, { bold: true, size: 24 }), { align: D.AlignmentType.CENTER, after: 0 })] }),
        new D.TableCell({ borders: noBorders, verticalAlign: D.VerticalAlign.CENTER, width: { size: 45, type: W.PERCENTAGE }, children: [P(R('Mẫu số 05 - TT', { bold: true, size: 24 }), { align: D.AlignmentType.CENTER, after: 20 }), P(R('(Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/08/2016 của Bộ Tài chính)', { italic: true, size: 20 }), { align: D.AlignmentType.CENTER, after: 0 })] })
      ] })]
    });

    // Bảng khoản mục
    var cell = function (txt, o) {
      o = o || {};
      return new D.TableCell({ borders: allBorders, verticalAlign: D.VerticalAlign.CENTER, width: o.w ? { size: o.w, type: W.PERCENTAGE } : undefined, shading: o.fill ? { type: D.ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [P(R(txt, { bold: o.bold, italic: o.italic, size: 24 }), { align: o.align, after: 0 })] });
    };
    var rows = [new D.TableRow({ tableHeader: true, children: [cell('STT', { bold: true, align: D.AlignmentType.CENTER, w: 8, fill: 'E7E6E6' }), cell('Khoản mục', { bold: true, align: D.AlignmentType.CENTER, w: 30, fill: 'E7E6E6' }), cell('Diễn giải', { bold: true, align: D.AlignmentType.CENTER, w: 36, fill: 'E7E6E6' }), cell('Số tiền (đồng)', { bold: true, align: D.AlignmentType.CENTER, w: 26, fill: 'E7E6E6' })] })];
    var items = [
      ['1', 'Lương theo ngày công', (function () { var sd = d.stdDays || 26, wp = d.workPay != null ? d.workPay : d.baseSalary, calc = Math.round((Number(d.baseSalary) || 0) / sd * Math.min(Number(d.workDays) || 0, sd)); return Math.abs(wp - calc) <= 1 ? 'Tổng lương hợp đồng ' + fmt(d.baseSalary) + ' ÷ ' + sd + ' công × ' + (d.workDays || 0) + ' ngày công (' + (Number(d.totalHours) || 0).toFixed(1) + ' giờ làm)' : 'Ngày công thực tế: ' + (d.workDays || 0) + ' ngày'; })(), fmt(d.workPay != null ? d.workPay : d.baseSalary)],
      ].concat((d.breakdown && d.breakdown.items || []).map(function (x, i) { return ['1.' + (i + 1), '   - ' + x.n, (x.k === 'bh' ? 'Cố định ' + fmt(x.f) : x.k === 'allowance' ? 'Trần ' + fmt(x.f) + ' × ' + (d.breakdown.days || 0) + '/' + (d.breakdown.std || 26) + ' công' : 'Phần còn lại'), fmt(x.e), true]; })).concat([
      ['2', 'Tiền làm thêm giờ (OT)', (Number(d.otHours) || 0).toFixed(1) + ' giờ × ' + fmt(d.otRate) + ' đồng/giờ (hệ số 1,5)', fmt(d.otAmount)],
      ['3', 'Hoa hồng dự án', 'Theo bảng hoa hồng tháng ' + mmYYYY(d.month), fmt(d.commissionAmount)],
      ['4', 'Thưởng khác', d.otherBonusNote || '', fmt(d.otherBonus)],
      ['5', 'Các khoản khấu trừ (−)', d.deductionNote || '', d.deduction ? '(' + fmt(d.deduction) + ')' : '0']
    ]).concat(d.bhEmployee ? [['6', 'BHXH, BHYT, BHTN người lao động (−)', '10,5% × lương đóng BH ' + fmt(d.breakdown ? d.breakdown.bhBase : 0) + ' đồng', '(' + fmt(d.bhEmployee) + ')']] : []);
    items.forEach(function (x) { var sub = !!x[4]; rows.push(new D.TableRow({ children: [cell(x[0], { align: D.AlignmentType.CENTER, italic: sub }), cell(x[1], { italic: sub }), cell(x[2], { italic: true }), cell(x[3], { align: D.AlignmentType.RIGHT, italic: sub })] })); });
    rows.push(new D.TableRow({ children: [new D.TableCell({ borders: allBorders, columnSpan: 3, margins: { top: 70, bottom: 70, left: 100, right: 100 }, shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, children: [P(R('TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN', { bold: true, size: 24 }), { align: D.AlignmentType.CENTER, after: 0 })] }), cell(fmt(d.totalAmount), { bold: true, align: D.AlignmentType.RIGHT, fill: 'F2F2F2' })] }));
    var table = new D.Table({ width: { size: 100, type: W.PERCENTAGE }, borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line }, rows: rows });

    // Chữ ký (4 cột)
    var sigCell = function (t, name) { return new D.TableCell({ borders: noBorders, width: { size: 25, type: W.PERCENTAGE }, children: [P(R(t, { bold: true, size: 24 }), { align: D.AlignmentType.CENTER, after: 0 }), P(R('(Ký, họ tên)', { italic: true, size: 22 }), { align: D.AlignmentType.CENTER, after: 900 }), P(R(name || '', { bold: true, size: 24 }), { align: D.AlignmentType.CENTER, after: 0 })] }); };
    var sign = new D.Table({ width: { size: 100, type: W.PERCENTAGE }, borders: noBorders, rows: [new D.TableRow({ cantSplit: true, children: [sigCell('GIÁM ĐỐC'), sigCell('KẾ TOÁN TRƯỞNG'), sigCell('TRƯỞNG BỘ PHẬN'), sigCell('NGƯỜI ĐỀ NGHỊ', m.name)] })] });

    var body = [
      head,
      P(R('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 26 }), { align: D.AlignmentType.CENTER, before: 200, after: 20 }),
      P(R('Độc lập - Tự do - Hạnh phúc', { bold: true, size: 26 }), { align: D.AlignmentType.CENTER, after: 0 }),
      P(R('───────────────', { size: 24 }), { align: D.AlignmentType.CENTER, after: 200 }),
      P(R('GIẤY ĐỀ NGHỊ THANH TOÁN LƯƠNG', { bold: true, size: 32 }), { align: D.AlignmentType.CENTER, before: 60, after: 40 }),
      P(R('Tháng ' + mmYYYY(d.month), { bold: true, size: 26 }), { align: D.AlignmentType.CENTER, after: 40 }),
      P(R('Ngày ' + pad(now.getDate()) + ' tháng ' + pad(now.getMonth() + 1) + ' năm ' + now.getFullYear(), { italic: true }), { align: D.AlignmentType.CENTER, after: 40 }),
      P(R('Số: ......../GĐNTT', { italic: true }), { align: D.AlignmentType.CENTER, after: 200 }),
      P([R('Kính gửi: ', { bold: true }), R('Ban Giám đốc Công ty TNHH Thiết kế và Xây dựng HICONIQUE')], { after: 160 }),
      P([R('Họ và tên người đề nghị thanh toán: '), R(m.name || '..........................', { bold: true })]),
      P([R('Bộ phận / Chức vụ: '), R(m.role || '..........................')]),
      P([R('Mã nhân viên: '), R(m.id || '.............'), R('        Số tài khoản: '), R(m.bankAccount || '..........................')]),
      P([R('Nội dung thanh toán: '), R('Thanh toán tiền lương tháng ' + mmYYYY(d.month), { bold: true })]),
      P([R('Số tiền đề nghị thanh toán: '), R(fmt(d.totalAmount) + ' đồng', { bold: true })]),
      P([R('(Viết bằng chữ: '), R(moneyWords(d.totalAmount), { italic: true, bold: true }), R(')')], { after: 160 }),
      table,
      P(R(''), { after: 60 }),
      P([R('Hình thức thanh toán: '), R('☐ Chuyển khoản        ☐ Tiền mặt')]),
      P([R('Thời hạn thanh toán: '), R('......../......../' + now.getFullYear())]),
      P([R('Kèm theo: '), R('01 bảng chấm công tháng ' + mmYYYY(d.month) + ' và chứng từ gốc có liên quan.')]),
      d.note ? P([R('Ghi chú: ', { bold: true }), R(d.note)]) : P(R('')),
      P(R('Kính đề nghị Ban Giám đốc xem xét và phê duyệt.', { italic: true }), { before: 60, after: 100 }),
      P(R('Hải Phòng, ngày ' + pad(now.getDate()) + ' tháng ' + pad(now.getMonth() + 1) + ' năm ' + now.getFullYear(), { italic: true }), { align: D.AlignmentType.RIGHT, after: 120, keepNext: true }),
      sign
    ];
    return new D.Document({
      creator: 'HICONIQUE Internal Hub', title: 'Giấy đề nghị thanh toán lương ' + mmYYYY(d.month),
      styles: { default: { document: { run: { font: FONT, size: 26 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 851 } } }, children: body }]
    });
  }

  function makeBlob(data) {
    return ensureDocx().then(function (D) { return D.Packer.toBlob(build(D, data)); });
  }
  function fileName(d) { return 'Giay_de_nghi_thanh_toan_luong_' + String((d.member && d.member.name) || 'NV').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9]+/g, '_') + '_' + String(d.month).replace('-', '_') + '.docx'; }

  function downloadBlob(name, getBlob) {
    return getBlob().then(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  }
  function download(data) { return downloadBlob(fileName(data), function () { return makeBlob(data); }); }

  var PV_CSS = '#pdxOverlay{position:fixed;inset:0;z-index:600;display:flex;flex-direction:column;background:radial-gradient(1200px 600px at 50% -10%,#4a4f57,#2b2e33 70%);animation:pdxIn .22s ease}@keyframes pdxIn{from{opacity:0}to{opacity:1}}' +
    '#pdxOverlay .pdx-bar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 20px;background:rgba(255,255,255,.07);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);border-bottom:1px solid rgba(255,255,255,.12);color:#f4f1ec;font-family:Inter,system-ui,sans-serif;flex-wrap:wrap}' +
    '#pdxOverlay .pdx-ttl{display:flex;align-items:center;gap:12px;min-width:0}#pdxOverlay .pdx-ic{flex:0 0 auto;width:34px;height:34px;border-radius:9px;background:linear-gradient(160deg,#4A78C9,#2B579A);display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.3)}#pdxOverlay .pdx-ic svg{width:18px;height:18px;color:#fff}' +
    '#pdxOverlay .pdx-ttl b{display:block;font-size:.875rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pdxOverlay .pdx-ttl span{display:block;font-size:.75rem;opacity:.65;margin-top:1px}' +
    '#pdxOverlay .pdx-zoom{display:flex;align-items:center;gap:2px;padding:3px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1)}#pdxOverlay .pdx-zoom button{width:30px;height:28px;border:none;border-radius:7px;background:none;color:#f4f1ec;font-size:1.05rem;line-height:1;cursor:pointer}#pdxOverlay .pdx-zoom button:hover{background:rgba(255,255,255,.14)}#pdxOverlay .pdx-zoom output{min-width:50px;text-align:center;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums}' +
    '#pdxOverlay .pdx-dpi{display:flex;align-items:center;gap:8px;height:36px;padding:0 6px 0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);font-size:.75rem;font-weight:600;color:#f4f1ec;white-space:nowrap}#pdxOverlay .pdx-dpi select{height:26px;border-radius:6px;border:none;background:rgba(255,255,255,.14);color:#fff;font-weight:600;font-size:.75rem;font-family:inherit;padding:0 6px;cursor:pointer}#pdxOverlay .pdx-dpi select option{color:#111}' +
    '#pdxOverlay .pdx-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:5;max-width:92vw;padding:11px 20px;border-radius:14px;background:rgba(28,30,34,.92);color:#fff;font:600 .8125rem Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.12);display:flex;align-items:center;gap:10px;animation:pdxIn .25s ease}#pdxOverlay .pdx-toast i{width:9px;height:9px;border-radius:50%;background:#4fbf7a;box-shadow:0 0 12px #4fbf7a}#pdxOverlay .pdx-toast.warn i{background:#e0a94a;box-shadow:0 0 12px #e0a94a}' +
    '#pdxOverlay .pdx-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#pdxOverlay .pdx-btn{height:36px;padding:0 16px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;font-weight:600;font-size:.8125rem;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:background .15s}#pdxOverlay .pdx-btn:hover{background:rgba(255,255,255,.16)}#pdxOverlay .pdx-btn.pri{background:#B08D57;border-color:#B08D57}#pdxOverlay .pdx-btn.pri:hover{background:#c39d63}#pdxOverlay .pdx-btn svg{width:15px;height:15px}' +
    '#pdxOverlay .pdx-scroll{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:28px 12px 60px}#pdxOverlay #pdxHost{margin:0 auto;width:max-content;max-width:none;transform-origin:top center}' +
    '#pdxOverlay .pdx-wrapper{background:transparent!important;padding:0!important}#pdxOverlay .pdx-wrapper>section.pdx{box-shadow:0 10px 40px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.2)!important;margin-bottom:22px!important;border-radius:2px}' +
    '#pdxOverlay .pdx-load{display:flex;flex-direction:column;align-items:center;gap:14px;padding:80px 0;color:#f4f1ec;font:500 .875rem Inter,system-ui,sans-serif}#pdxOverlay .pdx-load i{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.2);border-top-color:#B08D57;animation:pdxSpin .8s linear infinite}@keyframes pdxSpin{to{transform:rotate(360deg)}}' +
    '@media(max-width:700px){#pdxOverlay .pdx-bar{padding:8px 12px}#pdxOverlay .pdx-zoom{order:3}#pdxOverlay .pdx-btn span{display:none}}';

  // Khung xem nhanh + Tải .docx + Xuất PDF dùng CHUNG cho mọi văn bản (phiếu lương, công nợ…): cfg = { title, sub, fileName('.docx'), makeBlob() → Promise<Blob> }
  function openViewer(cfg) {
    var old = document.getElementById('pdxOverlay'); if (old) old.remove();
    if (!document.getElementById('pdxCss')) { var st = document.createElement('style'); st.id = 'pdxCss'; st.textContent = PV_CSS; document.head.appendChild(st); }
    var escH = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var ov = document.createElement('div'); ov.id = 'pdxOverlay';
    ov.innerHTML =
      '<div class="pdx-bar"><div class="pdx-ttl"><div class="pdx-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg></div><div><b>' + escH(cfg.title) + '</b><span>' + escH(cfg.sub) + ' · ' + escH(cfg.fileName) + '</span></div></div>' +
      '<div class="pdx-zoom"><button type="button" data-z="-1" aria-label="Thu nhỏ">−</button><output id="pdxZ">100%</output><button type="button" data-z="1" aria-label="Phóng to">+</button><button type="button" data-z="0" aria-label="Vừa khung" title="Vừa khung" style="font-size:.7rem;font-weight:700;width:auto;padding:0 8px">Vừa</button></div>' +
      '<div class="pdx-act"><label class="pdx-dpi" title="Độ phân giải ảnh trong file PDF"><span>Chất lượng PDF</span><select id="pdxDpi"><option value="1200" selected>1200 DPI (mặc định)</option><option value="600">600 DPI</option><option value="300">300 DPI</option></select></label><button type="button" class="pdx-btn pri" data-dl><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg><span>Tải file .docx</span></button><button type="button" class="pdx-btn" data-pdf title="Tải file PDF về máy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 14h1.5a1.5 1.5 0 0 1 0 3H8v-3zM8 17v2"/></svg><span>Xuất PDF</span></button><button type="button" class="pdx-btn" data-x><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg><span>Đóng</span></button></div></div>' +
      '<div class="pdx-scroll"><div id="pdxHost"><div class="pdx-load"><i></i>Đang tạo bản xem…</div></div></div>';
    document.body.appendChild(ov);
    var zoom = 1, host = ov.querySelector('#pdxHost'), zEl = ov.querySelector('#pdxZ'), scroller = ov.querySelector('.pdx-scroll');
    function applyZoom(z) { zoom = Math.max(0.4, Math.min(2.5, z)); host.style.zoom = zoom; zEl.textContent = Math.round(zoom * 100) + '%'; }
    function fit() { var page = host.querySelector('section.pdx'); if (!page) return; host.style.zoom = 1; var w = page.offsetWidth || 794; applyZoom(Math.min(1.4, (scroller.clientWidth - 24) / w)); }
    function close() { ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); else if ((e.key === '+' || e.key === '=') && e.ctrlKey) { e.preventDefault(); applyZoom(zoom + 0.1); } else if (e.key === '-' && e.ctrlKey) { e.preventDefault(); applyZoom(zoom - 0.1); } }
    document.addEventListener('keydown', onKey);
    ov.querySelector('[data-x]').addEventListener('click', close);
    ov.querySelector('[data-dl]').addEventListener('click', function () { downloadBlob(cfg.fileName, cfg.makeBlob); });
    function notify(msg, warn) { var o = ov.querySelector('.pdx-toast'); if (o) o.remove(); var n = document.createElement('div'); n.className = 'pdx-toast' + (warn ? ' warn' : ''); n.innerHTML = '<i></i><span></span>'; n.querySelector('span').textContent = msg; ov.appendChild(n); setTimeout(function () { n.remove(); }, 6000); }
    // Xuất PDF: chụp từng trang giấy đang xem (html2canvas, 2x) rồi ghép vào file PDF A4 (jsPDF) và TẢI THẲNG về máy — không mở hộp thoại in
    ov.querySelector('[data-pdf]').addEventListener('click', function () {
      var btn = ov.querySelector('[data-pdf]'), label = btn.querySelector('span'), pages = host.querySelectorAll('section.pdx');
      if (!pages.length || btn.disabled) return;
      btn.disabled = true; var old = label.textContent; label.textContent = 'Đang tạo PDF…';
      var z0 = zoom; host.style.zoom = 1;
      var want = Number(ov.querySelector('#pdxDpi').value) || 1200, chain = [1200, 600, 400, 300, 200].filter(function (d) { return d <= want; }); if (!chain.length) chain = [want];
      var used = [];
      loadPdfLibs().then(function () {
        var jsPDF = window.jspdf.jsPDF, pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }), i = 0;
        function next() {
          if (i >= pages.length) return Promise.resolve();
          label.textContent = 'Trang ' + (i + 1) + '/' + pages.length + '…';
          // 1200 DPI: 1 inch = 96px CSS → pixelRatio = 1200/96 = 12.5 (trang A4 ≈ 9925×14950px, ~150 megapixel, ~6.5MB/trang). Nếu máy không đủ bộ nhớ cho canvas lớn thì hạ dần 600 → 400 → 300 → 200 DPI.
          function shot(list) { return window.htmlToImage.toCanvas(pages[i], { pixelRatio: list[0] / 96, backgroundColor: '#ffffff', cacheBust: false }).then(function (c) { if (!c || !c.width || !c.height) throw new Error('canvas rỗng'); used.push(list[0]); return c; }).catch(function (e) { if (list.length > 1) return shot(list.slice(1)); throw e; }); }
          return shot(chain).then(function (canvas) {
            if (i > 0) pdf.addPage('a4', 'portrait');
            var w = 210, h = 210 * canvas.height / canvas.width, x = 0;
            if (h > 297) { h = 297; w = 297 * canvas.width / canvas.height; x = (210 - w) / 2; }   // giữ đúng tỉ lệ trang, không kéo giãn chữ
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, 0, w, h, undefined, 'FAST'); canvas.width = canvas.height = 0;   // giải phóng bộ nhớ ngay
            i++; return next();
          });
        }
        return next().then(function () { pdf.setProperties({ title: cfg.fileName.replace(/\.docx$/, ''), creator: 'HICONIQUE Internal Hub' }); var blob = pdf.output('blob'), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = cfg.fileName.replace(/\.docx$/, '.pdf'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          var minDpi = Math.min.apply(null, used), reduced = minDpi < want;
          notify('Đã xuất PDF — ' + minDpi + ' DPI · ' + pages.length + ' trang · ' + (blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB' + (reduced ? ' (đã hạ từ ' + want + ' DPI do thiếu bộ nhớ)' : ''), reduced); });
      }).catch(function (err) { alert('Không tạo được PDF: ' + (err && err.message || err)); })
        .then(function () { host.style.zoom = z0; btn.disabled = false; label.textContent = old; });
    });
    ov.querySelector('.pdx-zoom').addEventListener('click', function (e) { var b = e.target.closest('[data-z]'); if (!b) return; var d = Number(b.getAttribute('data-z')); if (d === 0) fit(); else applyZoom(zoom + d * 0.1); });
    scroller.addEventListener('wheel', function (e) { if (!e.ctrlKey) return; e.preventDefault(); applyZoom(zoom * Math.exp(e.deltaY < 0 ? 0.1 : -0.1)); }, { passive: false });
    scroller.addEventListener('mousedown', function (e) { if (e.target === scroller) close(); });
    return cfg.makeBlob().then(function (blob) {
      return ensurePreview().then(function (P) {
        host.innerHTML = '';
        return P.renderAsync(blob, host, null, { className: 'pdx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true });
      });
    }).then(fit).catch(function (err) { host.innerHTML = '<div style="padding:20px;background:#fff;color:#a04848;border-radius:10px;max-width:560px">Không tạo được bản xem: ' + String(err && err.message || err) + '</div>'; });
  }

  function preview(data) { return openViewer({ title: 'Giấy đề nghị thanh toán lương', sub: 'Tháng ' + mmYYYY(data.month) + ' · ' + ((data.member && data.member.name) || ''), fileName: fileName(data), makeBlob: function () { return makeBlob(data); } }); }

  return { download: download, preview: preview, moneyWords: moneyWords, openViewer: openViewer, downloadBlob: downloadBlob, ensureDocx: ensureDocx, fmt: fmt, COMPANY: COMPANY, FONT: FONT };
})();
