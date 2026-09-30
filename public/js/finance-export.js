/**
 * FinanceExport — "Xuất báo cáo" của Sổ tài chính (finance.html), CEO-only.
 * 1) Hộp chọn KỲ BÁO CÁO: nút nhanh (tuần/tháng/quý/năm/toàn bộ), chuyển kỳ bằng mũi tên, lịch chọn khoảng ngày bằng 2 lần bấm.
 * 2) Xuất Excel (ExcelJS) NHIỀU SHEET, mỗi mục chính 1 sheet, dùng CÔNG THỨC THẬT (SUMIFS, IFERROR, VLOOKUP, AVERAGE, SUBTOTAL...) trỏ về sheet
 *    "Giao dịch" và "Tham số" nên sửa số liệu trong Excel thì mọi báo cáo tự tính lại:
 *      Tổng quan · Giao dịch · Lãi-Lỗ · Dòng tiền & Dự báo · Vay nợ · Công nợ KH · Sức khỏe TC · BCTC (Sổ tay CFO) · Rủi ro · Tham số.
 * Phụ thuộc (truyền qua ctx): TaskManager, TYPES, TYPE_ORDER, receivableStatus, STATUS_LABEL, categoryBreakdown, user.
 */
var FinanceExport = (function () {
  'use strict';

  var ctx = null, modal = null;
  var range = { from: '', to: '' };
  var mode = 'month';                 // week | month | quarter | year | custom | all
  var view = { y: 0, m: 0 };          // tháng đang hiển thị trên lịch
  var picking = false;                // đã bấm ngày đầu, chờ ngày cuối

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function vn(s) { var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }
  function monday(d) { var w = (d.getDay() + 6) % 7; return addDays(d, -w); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------------------------------------------------------------- kỳ báo cáo
  function preset(name) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var a, b;
    if (name === 'today') { a = b = now; }
    else if (name === 'week') { a = monday(now); b = addDays(a, 6); }
    else if (name === 'lastweek') { a = addDays(monday(now), -7); b = addDays(a, 6); }
    else if (name === 'month') { a = new Date(y, m, 1); b = new Date(y, m + 1, 0); }
    else if (name === 'lastmonth') { a = new Date(y, m - 1, 1); b = new Date(y, m, 0); }
    else if (name === 'quarter') { var q = Math.floor(m / 3); a = new Date(y, q * 3, 1); b = new Date(y, q * 3 + 3, 0); }
    else if (name === 'year') { a = new Date(y, 0, 1); b = new Date(y, 11, 31); }
    else if (name === 'lastyear') { a = new Date(y - 1, 0, 1); b = new Date(y - 1, 11, 31); }
    else { // all
      var ds = allEntries().map(function (e) { return e.date || ''; }).filter(Boolean).sort();
      a = ds.length ? parse(ds[0]) : new Date(y, 0, 1); b = ds.length ? parse(ds[ds.length - 1]) : now;
    }
    return { from: ymd(a), to: ymd(b) };
  }
  function setPreset(name) {
    mode = ({ today: 'custom', week: 'week', lastweek: 'week', month: 'month', lastmonth: 'month', quarter: 'quarter', year: 'year', lastyear: 'year', all: 'all' })[name] || 'custom';
    range = preset(name); picking = false;
    var d = parse(range.from); view = { y: d.getFullYear(), m: d.getMonth() };
    render();
  }
  function shiftPeriod(dir) {
    var a = parse(range.from), b = parse(range.to), y = a.getFullYear(), m = a.getMonth();
    if (mode === 'week') { a = addDays(a, 7 * dir); b = addDays(a, 6); }
    else if (mode === 'month') { a = new Date(y, m + dir, 1); b = new Date(y, m + dir + 1, 0); }
    else if (mode === 'quarter') { a = new Date(y, m + 3 * dir, 1); b = new Date(a.getFullYear(), a.getMonth() + 3, 0); }
    else if (mode === 'year') { a = new Date(y + dir, 0, 1); b = new Date(y + dir, 11, 31); }
    else { var span = Math.round((b - a) / 86400000) + 1; a = addDays(a, span * dir); b = addDays(b, span * dir); }
    range = { from: ymd(a), to: ymd(b) }; picking = false; view = { y: a.getFullYear(), m: a.getMonth() };
    render();
  }
  function setMode(md) {
    if (md === 'custom') { mode = 'custom'; render(); return; }
    var base = parse(range.from), a, b, y = base.getFullYear(), m = base.getMonth();
    if (md === 'week') { a = monday(base); b = addDays(a, 6); }
    else if (md === 'month') { a = new Date(y, m, 1); b = new Date(y, m + 1, 0); }
    else if (md === 'quarter') { var q = Math.floor(m / 3); a = new Date(y, q * 3, 1); b = new Date(y, q * 3 + 3, 0); }
    else { a = new Date(y, 0, 1); b = new Date(y, 11, 31); }
    mode = md; range = { from: ymd(a), to: ymd(b) }; picking = false; view = { y: a.getFullYear(), m: a.getMonth() };
    render();
  }
  function periodLabel() {
    var a = parse(range.from), b = parse(range.to);
    if (mode === 'month') return 'Tháng ' + (a.getMonth() + 1) + ' / ' + a.getFullYear();
    if (mode === 'quarter') return 'Quý ' + (Math.floor(a.getMonth() / 3) + 1) + ' / ' + a.getFullYear();
    if (mode === 'year') return 'Năm ' + a.getFullYear();
    if (mode === 'week') return 'Tuần ' + vn(range.from).slice(0, 5) + ' – ' + vn(range.to).slice(0, 5) + '/' + b.getFullYear();
    if (mode === 'all') return 'Toàn bộ dữ liệu';
    return vn(range.from) + ' – ' + vn(range.to);
  }

  // ---------------------------------------------------------------- dữ liệu
  function allEntries() { return ctx.TaskManager.getFinanceEntries() || []; }
  function entryDate(e) { return e.date || ((e.month || '') ? e.month + '-01' : ''); }
  function inRange(e) { var d = entryDate(e); return d && d >= range.from && d <= range.to; }
  function monthsBetween(from, to) {
    var a = parse(from), b = parse(to), out = [], y = a.getFullYear(), m = a.getMonth();
    while ((y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth())) && out.length < 120) { out.push(y + '-' + pad(m + 1)); m++; if (m > 11) { m = 0; y++; } }
    return out;
  }
  function num(v) { return Number(v) || 0; }
  function sumType(list, t) { return list.filter(function (e) { return e.type === t; }).reduce(function (s, e) { return s + num(e.amount); }, 0); }
  function cashOf(list) { return list.reduce(function (s, e) { var t = ctx.TYPES[e.type]; return s + (t ? t.cashSign : 0) * num(e.amount); }, 0); }

  // ---------------------------------------------------------------- giao diện chọn kỳ
  var CSS = '' +
    '.fx-ov{position:fixed;inset:0;background:rgba(8,10,14,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:9700;display:none;align-items:center;justify-content:center;padding:16px;}' +
    '.fx-ov.on{display:flex;}' +
    '.fx{width:min(760px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--fn-surface,#fff);color:var(--fn-text,#222);border:1px solid var(--fn-border,#ddd);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.4);}' +
    '.fx-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 24px 12px;}' +
    '.fx-h h3{margin:0;font-size:1.125rem;font-weight:700;}.fx-h p{margin:4px 0 0;font-size:.8125rem;color:var(--fn-muted,#888);}' +
    '.fx-x{border:none;background:transparent;color:var(--fn-muted,#888);font-size:1.5rem;line-height:1;cursor:pointer;padding:0 4px;}' +
    '.fx-b{display:grid;grid-template-columns:230px 1fr;gap:0;padding:0 24px 8px;}' +
    '.fx-side{padding-right:18px;border-right:1px solid var(--fn-border,#ddd);}' +
    '.fx-lbl{font-size:.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--fn-muted,#888);margin:6px 0 8px;}' +
    '.fx-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}' +
    '.fx-chip{border:1px solid var(--fn-border,#ddd);background:transparent;color:var(--fn-text,#222);border-radius:999px;padding:6px 12px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;}' +
    '.fx-chip:hover,.fx-chip.on{border-color:var(--fn-bronze,#B08D57);color:var(--fn-bronze,#B08D57);background:color-mix(in srgb,var(--fn-bronze,#B08D57) 12%,transparent);}' +
    '.fx-seg{display:flex;border:1px solid var(--fn-border,#ddd);border-radius:10px;overflow:hidden;margin-bottom:10px;}' +
    '.fx-seg button{flex:1;border:none;background:transparent;color:var(--fn-muted,#888);padding:7px 0;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;}' +
    '.fx-seg button.on{background:var(--fn-bronze,#B08D57);color:#0B0D10;}' +
    '.fx-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}' +
    '.fx-nav b{font-size:.875rem;text-align:center;flex:1;}' +
    '.fx-ar{border:1px solid var(--fn-border,#ddd);background:transparent;color:var(--fn-text,#222);width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:1rem;line-height:1;}' +
    '.fx-ar:hover{border-color:var(--fn-bronze,#B08D57);color:var(--fn-bronze,#B08D57);}' +
    '.fx-cal{padding-left:18px;}' +
    '.fx-dow,.fx-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;}' +
    '.fx-dow span{font-size:.6875rem;font-weight:700;color:var(--fn-muted,#888);padding:6px 0;}' +
    '.fx-d{position:relative;border:none;background:transparent;color:var(--fn-text,#222);height:38px;border-radius:10px;font-size:.8125rem;cursor:pointer;font-family:inherit;}' +
    '.fx-d:hover{background:color-mix(in srgb,var(--fn-bronze,#B08D57) 16%,transparent);}' +
    '.fx-d.out{opacity:.35;}.fx-d.in{background:color-mix(in srgb,var(--fn-bronze,#B08D57) 20%,transparent);border-radius:0;}' +
    '.fx-d.s,.fx-d.e{background:var(--fn-bronze,#B08D57);color:#0B0D10;font-weight:700;border-radius:10px;}' +
    '.fx-d.today{outline:1px solid var(--fn-bronze,#B08D57);outline-offset:-2px;}' +
    '.fx-d i{position:absolute;left:50%;bottom:4px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--fn-green,#4F6F52);}' +
    '.fx-d.s i,.fx-d.e i{background:#0B0D10;}' +
    '.fx-f{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 24px 20px;border-top:1px solid var(--fn-border,#ddd);margin-top:8px;}' +
    '.fx-sum{font-size:.8125rem;line-height:1.5;}.fx-sum b{color:var(--fn-bronze,#B08D57);}' +
    '.fx-sheets{font-size:.6875rem;color:var(--fn-muted,#888);margin-top:2px;}' +
    '@media(max-width:640px){.fx-b{grid-template-columns:1fr;}.fx-side{border-right:none;padding-right:0;border-bottom:1px solid var(--fn-border,#ddd);padding-bottom:10px;margin-bottom:10px;}.fx-cal{padding-left:0;}}';

  function build() {
    if (modal) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    modal = document.createElement('div'); modal.className = 'fx-ov';
    modal.innerHTML =
      '<div class="fx" role="dialog" aria-label="Chọn kỳ báo cáo">' +
        '<div class="fx-h"><div><h3>Xuất báo cáo tài chính</h3><p>Chọn kỳ báo cáo — file Excel gồm nhiều sheet, dùng công thức tự tính lại.</p></div><button class="fx-x" data-x aria-label="Đóng">×</button></div>' +
        '<div class="fx-b">' +
          '<div class="fx-side">' +
            '<div class="fx-lbl">Chọn nhanh</div>' +
            '<div class="fx-chips" id="fxChips"></div>' +
            '<div class="fx-lbl">Theo kỳ <span style="text-transform:none;letter-spacing:0;font-weight:500;opacity:.7;">· lăn chuột để đổi</span></div>' +
            '<div class="fx-seg" id="fxSeg"></div>' +
            '<div class="fx-nav"><button class="fx-ar" data-prev aria-label="Kỳ trước">‹</button><b id="fxPeriod"></b><button class="fx-ar" data-next aria-label="Kỳ sau">›</button></div>' +
          '</div>' +
          '<div class="fx-cal">' +
            '<div class="fx-nav"><button class="fx-ar" data-mprev aria-label="Tháng trước">‹</button><b id="fxMonth"></b><button class="fx-ar" data-mnext aria-label="Tháng sau">›</button></div>' +
            '<div class="fx-dow"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span></div>' +
            '<div class="fx-days" id="fxDays"></div>' +
            '<div style="font-size:.6875rem;color:var(--fn-muted,#888);margin-top:8px;">Bấm 1 ngày để bắt đầu, bấm ngày thứ hai để chốt khoảng. Chấm xanh = ngày có giao dịch.</div>' +
          '</div>' +
        '</div>' +
        '<div class="fx-f"><div><div class="fx-sum" id="fxSum"></div><div class="fx-sheets">Sheet: Tổng quan · Giao dịch · Lãi-Lỗ · Dòng tiền & Dự báo · Vay nợ · Công nợ KH · Sức khỏe TC · BCTC · Rủi ro · Tham số</div></div>' +
          '<div style="display:flex;gap:8px;"><button class="fn-btn fn-btn-ghost" data-x>Hủy</button><button class="fn-btn fn-btn-primary" id="fxGo">Xuất Excel</button></div></div>' +
      '</div>';
    document.body.appendChild(modal);
    var chips = [['today', 'Hôm nay'], ['week', 'Tuần này'], ['lastweek', 'Tuần trước'], ['month', 'Tháng này'], ['lastmonth', 'Tháng trước'], ['quarter', 'Quý này'], ['year', 'Năm nay'], ['lastyear', 'Năm trước'], ['all', 'Toàn bộ']];
    modal.querySelector('#fxChips').innerHTML = chips.map(function (c) { return '<button class="fx-chip" data-p="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    modal.querySelector('#fxSeg').innerHTML = [['week', 'Tuần'], ['month', 'Tháng'], ['quarter', 'Quý'], ['year', 'Năm']].map(function (c) { return '<button data-m="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    modal.addEventListener('click', function (e) {
      var t = e.target;
      if (t === modal || t.closest('[data-x]')) { modal.classList.remove('on'); return; }
      var p = t.closest('[data-p]'); if (p) { setPreset(p.getAttribute('data-p')); return; }
      var m = t.closest('[data-m]'); if (m) { setMode(m.getAttribute('data-m')); return; }
      if (t.closest('[data-prev]')) { shiftPeriod(-1); return; }
      if (t.closest('[data-next]')) { shiftPeriod(1); return; }
      if (t.closest('[data-mprev]')) { view.m--; if (view.m < 0) { view.m = 11; view.y--; } render(); return; }
      if (t.closest('[data-mnext]')) { view.m++; if (view.m > 11) { view.m = 0; view.y++; } render(); return; }
      var d = t.closest('[data-d]'); if (d) { pickDay(d.getAttribute('data-d')); return; }
      if (t.closest('#fxGo')) { doExport(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.classList.remove('on'); });
    // Lăn chuột đổi kỳ: lăn xuống = kỳ sau, lăn lên = kỳ trước — trên ô tên kỳ (theo Tuần/Tháng/Quý/Năm đang chọn) và trên lịch (đổi tháng hiển thị)
    var wheelAt = 0;
    function wheelDir(e) { var now = Date.now(); if (now - wheelAt < 140) return 0; wheelAt = now; return e.deltaY > 0 ? 1 : -1; }
    modal.querySelector('.fx-side .fx-nav').addEventListener('wheel', function (e) { e.preventDefault(); var d = wheelDir(e); if (d) shiftPeriod(d); }, { passive: false });
    modal.querySelector('#fxSeg').addEventListener('wheel', function (e) {
      e.preventDefault(); var d = wheelDir(e); if (!d) return;
      var order = ['week', 'month', 'quarter', 'year'], i = Math.max(0, order.indexOf(mode)); setMode(order[Math.min(3, Math.max(0, i + d))]);   // lăn để đổi Tuần → Tháng → Quý → Năm
    }, { passive: false });
    modal.querySelector('.fx-cal').addEventListener('wheel', function (e) {
      e.preventDefault(); var d = wheelDir(e); if (!d) return;
      view.m += d; if (view.m > 11) { view.m = 0; view.y++; } if (view.m < 0) { view.m = 11; view.y--; } render();
    }, { passive: false });
    modal.querySelector('#fxChips').title = 'Mẹo: lăn chuột trên lịch để đổi tháng, trên ô kỳ để đổi kỳ';
  }

  function pickDay(day) {
    if (!picking) { range = { from: day, to: day }; picking = true; mode = 'custom'; }
    else { if (day < range.from) range = { from: day, to: range.from }; else range = { from: range.from, to: day }; picking = false; }
    render();
  }

  function render() {
    var days = {}; allEntries().forEach(function (e) { var d = entryDate(e); if (d) days[d] = (days[d] || 0) + 1; });
    var first = new Date(view.y, view.m, 1), startOffset = (first.getDay() + 6) % 7, today = ymd(new Date());
    var html = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(view.y, view.m, 1 - startOffset + i), key = ymd(d);
      var cls = 'fx-d' + (d.getMonth() !== view.m ? ' out' : '');
      if (key === today) cls += ' today';
      if (key === range.from) cls += ' s'; else if (key === range.to) cls += ' e';
      else if (key > range.from && key < range.to) cls += ' in';
      html += '<button class="' + cls + '" data-d="' + key + '">' + d.getDate() + (days[key] ? '<i></i>' : '') + '</button>';
    }
    modal.querySelector('#fxDays').innerHTML = html;
    modal.querySelector('#fxMonth').textContent = 'Tháng ' + (view.m + 1) + ' / ' + view.y;
    modal.querySelector('#fxPeriod').textContent = periodLabel();
    Array.prototype.forEach.call(modal.querySelectorAll('#fxSeg button'), function (b) { b.classList.toggle('on', b.getAttribute('data-m') === mode); });
    var n = allEntries().filter(inRange).length, span = Math.round((parse(range.to) - parse(range.from)) / 86400000) + 1;
    modal.querySelector('#fxSum').innerHTML = 'Từ <b>' + vn(range.from) + '</b> đến <b>' + vn(range.to) + '</b> · ' + span + ' ngày · <b>' + n + '</b> giao dịch' + (picking ? ' <span style="color:var(--fn-bronze)">— chọn ngày kết thúc</span>' : '');
    modal.querySelector('#fxGo').disabled = picking;
  }

  function open(c) {
    ctx = c; build();
    setPreset('month');
    modal.classList.add('on');
  }

  // ---------------------------------------------------------------- xuất Excel
  var BRONZE = 'FFB08D57', DARK = 'FF22272E', SOFT = 'FFF3ECE0', GREEN = 'FF2E7D4A', RED = 'FFB5402A', BLUE = 'FF1F4E9E';
  var NUM = '#,##0;[Red]-#,##0', PCT = '0.0%', DATEF = 'dd/mm/yyyy';

  function q(name) { return "'" + name + "'"; }
  function title(ws, text, span, sub) {
    ws.mergeCells(1, 1, 1, span);
    var c = ws.getCell(1, 1); c.value = text; c.font = { bold: true, size: 15, color: { argb: 'FF22272E' } };
    ws.getRow(1).height = 26;
    if (sub) { ws.mergeCells(2, 1, 2, span); ws.getCell(2, 1).value = sub; ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF7A7568' } }; }
  }
  function header(ws, row, labels) {
    labels.forEach(function (l, i) {
      var c = ws.getCell(row, i + 1);
      c.value = l; c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = { bottom: { style: 'medium', color: { argb: BRONZE } } };
    });
    ws.getRow(row).height = 24;
  }
  function widths(ws, arr) { arr.forEach(function (w, i) { ws.getColumn(i + 1).width = w; }); }
  function fill(c, argb) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; }
  function total(ws, row, from, to) { for (var i = from; i <= to; i++) { var c = ws.getCell(row, i); c.font = { bold: true }; fill(c, SOFT); c.border = { top: { style: 'thin', color: { argb: BRONZE } } }; } }
  function note(ws, row, text, span) { ws.mergeCells(row, 1, row, span); var c = ws.getCell(row, 1); c.value = text; c.font = { italic: true, size: 10, color: { argb: 'FF7A7568' } }; c.alignment = { wrapText: true, vertical: 'top' }; ws.getRow(row).height = 30; }
  // ---- Tô màu theo đánh giá (Tốt/Thấp/An toàn/Đã thu = xanh · Cần chú ý/Trung bình/Cảnh báo/Chưa thu = vàng · Rủi ro/Cao/Nguy hiểm/Quá hạn = đỏ · Thiếu dữ liệu = xám)
  function fillRule(text, bg, fg) { return { type: 'cellIs', operator: 'equal', formulae: ['"' + text + '"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } }, font: { color: { argb: fg }, bold: true } } }; }
  var CF_GREEN = ['Tốt', 'Thấp', 'An toàn', 'Đã thu'], CF_AMBER = ['Cần chú ý', 'Trung bình', 'Cảnh báo', 'Chưa thu'], CF_RED = ['Rủi ro', 'Cao', 'Nguy hiểm', 'Quá hạn'], CF_GREY = ['Thiếu dữ liệu'];
  function colorEval(ws, ref) {
    var rules = [];
    CF_GREEN.forEach(function (t) { rules.push(fillRule(t, 'FFCFE8D5', 'FF1F6B3A')); });
    CF_AMBER.forEach(function (t) { rules.push(fillRule(t, 'FFF9E6B4', 'FF8A6210')); });
    CF_RED.forEach(function (t) { rules.push(fillRule(t, 'FFF6C9C0', 'FFB5402A')); });
    CF_GREY.forEach(function (t) { rules.push(fillRule(t, 'FFE4E1DA', 'FF6B675C')); });
    ws.addConditionalFormatting({ ref: ref, rules: rules });
  }
  function colorSign(ws, ref) {   // số dương xanh / âm đỏ
    ws.addConditionalFormatting({ ref: ref, rules: [
      { type: 'cellIs', operator: 'lessThan', formulae: ['0'], style: { font: { color: { argb: 'FFB5402A' }, bold: true } } },
      { type: 'cellIs', operator: 'greaterThan', formulae: ['0'], style: { font: { color: { argb: 'FF1F6B3A' } } } }
    ] });
  }
  function centerBold(ws, ref) {   // ref dạng 'D14:D18'
    var m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref); if (!m) return;
    for (var r = +m[2]; r <= +m[4]; r++) for (var c = ws.getColumn(m[1]).number; c <= ws.getColumn(m[3]).number; c++) { var cell = ws.getCell(r, c); cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.font = Object.assign({}, cell.font || {}, { bold: true }); }
  }
  // Kẻ khung mảnh + sọc xen kẽ cho vùng bảng (bỏ qua hàng tiêu đề/tổng đã tô màu riêng)
  function polish(ws, r1, r2, c1, c2) {
    for (var r = r1; r <= r2; r++) {
      for (var c = c1; c <= c2; c++) {
        var cell = ws.getCell(r, c);
        cell.border = { top: { style: 'thin', color: { argb: 'FFE1DACD' } }, left: { style: 'thin', color: { argb: 'FFE1DACD' } }, bottom: { style: 'thin', color: { argb: 'FFE1DACD' } }, right: { style: 'thin', color: { argb: 'FFE1DACD' } } };
        if (!cell.fill || !cell.fill.fgColor) { if ((r - r1) % 2 === 1) fill(cell, 'FFFAF7F2'); }
        if (!cell.alignment) cell.alignment = { vertical: 'middle' };
      }
    }
  }
  // Cài đặt in chuẩn A4: vùng in, tiêu đề lặp lại, căn giữa, lề, đầu trang (Quốc hiệu) + chân trang (số trang)
  var HDR_LEFT = 'CÔNG TY HICONIQUE';
  function printSetup(ws, area, landscape, titleRows) {
    ws.pageSetup = {
      paperSize: 9, orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      horizontalCentered: true, printArea: area,
      margins: { left: 0.6, right: 0.5, top: 1.15, bottom: 0.85, header: 0.35, footer: 0.35 }
    };
    if (titleRows) ws.pageSetup.printTitlesRow = titleRows;
    ws.headerFooter = {
      oddHeader: '&L&"Times New Roman,Bold"&9' + HDR_LEFT + '&R&"Times New Roman,Bold"&9CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n&"Times New Roman,Bold"&9Độc lập - Tự do - Hạnh phúc',
      oddFooter: '&L&"Times New Roman"&8Hải Phòng, ngày &D&C&"Times New Roman"&8&A&R&"Times New Roman"&8Trang &P / &N'
    };
  }
  function dateCell(s) { if (!s) return null; var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function kv(ws, row, label, val, fmt, how, opts) {
    opts = opts || {};
    ws.getCell(row, 1).value = label;
    var c = ws.getCell(row, 2); c.value = val; if (fmt) c.numFmt = fmt;
    c.alignment = { horizontal: 'right' };
    if (opts.input) c.font = { color: { argb: BLUE } };       // ô nhập số liệu (chữ xanh) — sửa được, công thức tự tính lại
    if (opts.bold) { ws.getCell(row, 1).font = { bold: true }; c.font = { bold: true, color: opts.input ? { argb: BLUE } : undefined }; }
    if (how) { var h = ws.getCell(row, 3); h.value = how; h.font = { size: 10, color: { argb: 'FF7A7568' } }; h.alignment = { wrapText: true, vertical: 'middle' }; }
    return c;
  }

  function doExport() {
    if (typeof ExcelJS === 'undefined') { alert('Không tải được thư viện xuất Excel. Kiểm tra kết nối mạng và thử lại.'); return; }
    var btn = modal.querySelector('#fxGo'); btn.disabled = true; btn.textContent = 'Đang tạo file…';
    try { build_(); } catch (err) { console.error('Export failed:', err); alert('Xuất file thất bại: ' + (err && err.message ? err.message : err)); btn.disabled = false; btn.textContent = 'Xuất Excel'; }
  }

  function build_() {
    var TM = ctx.TaskManager, TYPES = ctx.TYPES, ORDER = ctx.TYPE_ORDER;
    var all = allEntries().slice().sort(function (a, b) { return entryDate(a).localeCompare(entryDate(b)); });
    var list = all.filter(inRange);
    var months = monthsBetween(range.from, range.to);
    var toMonth = range.to.slice(0, 7), year = range.to.slice(0, 4);
    var user = ctx.user || {};
    var wb = new ExcelJS.Workbook();
    wb.creator = 'HICONIQUE — Sổ tài chính'; wb.created = new Date();
    wb.calcProperties = { fullCalcOnLoad: true };
    var sub = 'Kỳ báo cáo: ' + vn(range.from) + ' → ' + vn(range.to) + ' · Xuất lúc ' + new Date().toLocaleString('vi-VN') + (user.name ? ' · ' + user.name : '');
    var label = function (t) { return TYPES[t].label; };

    // ---- thứ tự sheet: Tổng quan trước, nhưng tạo trước các sheet dữ liệu để biết địa chỉ ----
    var wsCv = wb.addWorksheet('Bìa báo cáo', { properties: { tabColor: { argb: 'FF22272E' } }, views: [{ showGridLines: false }] });
    var wsOv = wb.addWorksheet('Tổng quan', { properties: { tabColor: { argb: BRONZE } } });
    var wsTx = wb.addWorksheet('Giao dịch');
    var wsPl = wb.addWorksheet('Lãi-Lỗ');
    var wsCf = wb.addWorksheet('Dòng tiền & Dự báo');
    var wsDb = wb.addWorksheet('Vay nợ');
    var wsRc = wb.addWorksheet('Công nợ KH');
    var wsHl = wb.addWorksheet('Sức khỏe TC');
    var wsBs = wb.addWorksheet('BCTC');
    var wsRk = wb.addWorksheet('Rủi ro');
    var wsPr = wb.addWorksheet('Tham số');

    // ============ THAM SỐ ============
    title(wsPr, 'THAM SỐ & GHI CHÚ CÔNG THỨC', 4, sub);
    header(wsPr, 4, ['Loại giao dịch', 'Hệ số dòng tiền', 'Hệ số lãi/lỗ', 'Ý nghĩa']);
    var meaning = { revenue: 'Tiền thu từ khách — tăng dòng tiền và lợi nhuận', expense: 'Chi phí hoạt động — giảm dòng tiền và lợi nhuận', loan: 'Tiền vay nhận — tăng dòng tiền, KHÔNG phải doanh thu', repayment: 'Trả nợ gốc — giảm dòng tiền, không ảnh hưởng lãi/lỗ', bonus: 'Thưởng nhân viên — giảm dòng tiền và lợi nhuận', penalty: 'Phạt nhân viên thu về — tăng dòng tiền và lợi nhuận', idle: 'Tiền ứ đọng — chỉ theo dõi', undisbursed: 'Chưa giải ngân — chỉ theo dõi' };
    ORDER.forEach(function (t, i) {
      var r = 5 + i;
      wsPr.getCell(r, 1).value = label(t);
      wsPr.getCell(r, 2).value = TYPES[t].cashSign; wsPr.getCell(r, 3).value = TYPES[t].pnlSign;
      wsPr.getCell(r, 2).font = { color: { argb: BLUE } }; wsPr.getCell(r, 3).font = { color: { argb: BLUE } };
      wsPr.getCell(r, 4).value = meaning[t] || '';
    });
    var PR = q('Tham số') + '!$A$5:$C$' + (4 + ORDER.length);
    var gr = 6 + ORDER.length;
    wsPr.getCell(gr, 1).value = 'Quy ước'; wsPr.getCell(gr, 1).font = { bold: true };
    ['Chữ XANH DƯƠNG = ô nhập/số liệu gốc, có thể sửa; mọi ô còn lại là công thức tự tính lại.',
      'Lợi nhuận ròng = Doanh thu − Chi phí − Thưởng nhân viên + Phạt nhân viên thu về (khớp mục Báo cáo lãi/lỗ trên web).',
      'Dòng tiền = Σ (Số tiền × Hệ số dòng tiền) — cột G của sheet "Giao dịch".',
      'Dự báo tồn quỹ = Tồn quỹ cuối kỳ + Trung bình (Doanh thu − Chi phí) 3 tháng gần nhất × số tháng dự báo.',
      'Số dư đầu kỳ / dư nợ đầu kỳ tính từ toàn bộ giao dịch TRƯỚC ngày bắt đầu kỳ.',
      'Chỉ số BCTC (Z-Score, thanh khoản, đòn bẩy...) dùng ảnh chụp bảng cân đối năm ' + year + ' nhập ở mục "Báo cáo tài chính" trên web.'].forEach(function (t, i) { wsPr.mergeCells(gr + 1 + i, 1, gr + 1 + i, 4); wsPr.getCell(gr + 1 + i, 1).value = '• ' + t; wsPr.getCell(gr + 1 + i, 1).alignment = { wrapText: true }; wsPr.getRow(gr + 1 + i).height = 28; });
    widths(wsPr, [26, 18, 16, 70]);

    // ============ GIAO DỊCH ============
    title(wsTx, 'SỔ GIAO DỊCH', 8, sub);
    header(wsTx, 4, ['Loại', 'Danh mục', 'Mô tả', 'Ngày', 'Tháng', 'Số tiền (₫)', 'Ảnh hưởng dòng tiền', 'Ảnh hưởng lãi/lỗ']);
    list.forEach(function (e, i) {
      var r = 5 + i;
      wsTx.getCell(r, 1).value = (TYPES[e.type] || { label: e.type }).label;
      wsTx.getCell(r, 2).value = e.category || '';
      wsTx.getCell(r, 3).value = e.description || '';
      var dc = wsTx.getCell(r, 4); dc.value = dateCell(entryDate(e)); dc.numFmt = DATEF;
      wsTx.getCell(r, 5).value = (entryDate(e) || '').slice(0, 7);
      var ac = wsTx.getCell(r, 6); ac.value = num(e.amount); ac.numFmt = NUM; ac.font = { color: { argb: BLUE } };
      var gc = wsTx.getCell(r, 7); gc.value = { formula: 'F' + r + '*VLOOKUP(A' + r + ',' + PR + ',2,FALSE)' }; gc.numFmt = NUM;
      var hc = wsTx.getCell(r, 8); hc.value = { formula: 'F' + r + '*VLOOKUP(A' + r + ',' + PR + ',3,FALSE)' }; hc.numFmt = NUM;
    });
    var txLast = Math.max(5, 4 + list.length), txTot = txLast + 2;
    wsTx.getCell(txTot, 1).value = 'TỔNG (theo bộ lọc)';
    [6, 7, 8].forEach(function (c) { var col = String.fromCharCode(64 + c); var cell = wsTx.getCell(txTot, c); cell.value = { formula: 'SUBTOTAL(109,' + col + '5:' + col + txLast + ')' }; cell.numFmt = NUM; });
    total(wsTx, txTot, 1, 8);
    wsTx.autoFilter = { from: { row: 4, column: 1 }, to: { row: txLast, column: 8 } };
    wsTx.views = [{ state: 'frozen', ySplit: 4 }];
    widths(wsTx, [20, 20, 40, 12, 10, 18, 20, 18]);
    var TX = function (col) { return q('Giao dịch') + '!$' + col + '$5:$' + col + '$' + txLast; };
    var sumT = function (t) { return 'SUMIFS(' + TX('F') + ',' + TX('A') + ',"' + label(t) + '")'; };
    var sumTM = function (t, mref) { return 'SUMIFS(' + TX('F') + ',' + TX('A') + ',"' + label(t) + '",' + TX('E') + ',' + mref + ')'; };

    // ============ CÔNG NỢ KH ============
    title(wsRc, 'CÔNG NỢ KHÁCH HÀNG', 8, 'Toàn bộ công nợ đang ghi nhận (không lọc theo kỳ) · Quá hạn tính theo ngày hôm nay (hàm TODAY)');
    header(wsRc, 4, ['Khách hàng', 'Dự án', 'Mô tả', 'Hạn thanh toán', 'Số tiền (₫)', 'Trạng thái', 'Quá hạn?', 'Số ngày trễ']);
    var rcv = (TM.getReceivables() || []).slice().sort(function (a, b) { return String(a.dueDate || '').localeCompare(String(b.dueDate || '')); });
    rcv.forEach(function (r0, i) {
      var r = 5 + i, st = ctx.receivableStatus(r0);
      wsRc.getCell(r, 1).value = r0.clientName || ''; wsRc.getCell(r, 2).value = r0.projectId || ''; wsRc.getCell(r, 3).value = r0.description || '';
      var dc = wsRc.getCell(r, 4); dc.value = dateCell(r0.dueDate); dc.numFmt = DATEF;
      var ac = wsRc.getCell(r, 5); ac.value = num(r0.amount); ac.numFmt = NUM; ac.font = { color: { argb: BLUE } };
      wsRc.getCell(r, 6).value = st === 'paid' ? 'Đã thu' : 'Chưa thu';
      wsRc.getCell(r, 7).value = { formula: 'IF(AND(F' + r + '<>"Đã thu",D' + r + '<>"",D' + r + '<TODAY()),"Quá hạn","")' };
      var nc = wsRc.getCell(r, 8); nc.value = { formula: 'IF(G' + r + '="Quá hạn",TODAY()-D' + r + ',0)' }; nc.numFmt = '0';
    });
    var rcLast = Math.max(5, 4 + rcv.length), rcT = rcLast + 2;
    var RC = function (col) { return q('Công nợ KH') + '!$' + col + '$5:$' + col + '$' + rcLast; };
    var rcRows = [['Tổng công nợ', 'SUM(E5:E' + rcLast + ')', NUM], ['Chưa thu', 'SUMIFS(E5:E' + rcLast + ',F5:F' + rcLast + ',"Chưa thu")', NUM], ['Quá hạn', 'SUMIFS(E5:E' + rcLast + ',G5:G' + rcLast + ',"Quá hạn")', NUM], ['Tỉ lệ quá hạn / chưa thu', 'IFERROR(B' + (rcT + 2) + '/B' + (rcT + 1) + ',0)', PCT], ['Số khoản quá hạn', 'COUNTIF(G5:G' + rcLast + ',"Quá hạn")', '0']];
    rcRows.forEach(function (x, i) { wsRc.getCell(rcT + i, 1).value = x[0]; wsRc.getCell(rcT + i, 1).font = { bold: true }; var c = wsRc.getCell(rcT + i, 2); c.value = { formula: x[1] }; c.numFmt = x[2]; c.font = { bold: true }; });
    widths(wsRc, [26, 16, 34, 16, 18, 14, 12, 14]);
    wsRc.views = [{ state: 'frozen', ySplit: 4 }];
    var rcUnpaid = q('Công nợ KH') + '!$B$' + (rcT + 1), rcOverdue = q('Công nợ KH') + '!$B$' + (rcT + 2), rcRatio = q('Công nợ KH') + '!$B$' + (rcT + 3), rcCount = q('Công nợ KH') + '!$B$' + (rcT + 4);

    // ============ LÃI-LỖ ============
    title(wsPl, 'BÁO CÁO LÃI / LỖ THEO THÁNG', 9, sub);
    header(wsPl, 4, ['Tháng', 'Doanh thu', '(−) Chi phí hoạt động', '(−) Thưởng nhân viên', '(+) Phạt nhân viên thu về', 'Lợi nhuận ròng', 'Biên lợi nhuận', 'Tăng/giảm LN so tháng trước', 'Doanh thu − Chi phí']);
    months.forEach(function (m, i) {
      var r = 5 + i;
      wsPl.getCell(r, 1).value = m;
      [['B', 'revenue'], ['C', 'expense'], ['D', 'bonus'], ['E', 'penalty']].forEach(function (x) { var c = wsPl.getCell(x[0] + r); c.value = { formula: sumTM(x[1], '$A' + r) }; c.numFmt = NUM; });
      var f = wsPl.getCell('F' + r); f.value = { formula: 'B' + r + '-C' + r + '-D' + r + '+E' + r }; f.numFmt = NUM; f.font = { bold: true };
      var g = wsPl.getCell('G' + r); g.value = { formula: 'IFERROR(F' + r + '/B' + r + ',0)' }; g.numFmt = PCT;
      var h = wsPl.getCell('H' + r); h.value = i === 0 ? '' : { formula: 'IFERROR((F' + r + '-F' + (r - 1) + ')/ABS(F' + (r - 1) + '),"")' }; h.numFmt = PCT;
      var k = wsPl.getCell('I' + r); k.value = { formula: 'B' + r + '-C' + r }; k.numFmt = NUM;
    });
    var plLast = 4 + months.length, plT = plLast + 1;
    wsPl.getCell(plT, 1).value = 'TỔNG KỲ';
    ['B', 'C', 'D', 'E', 'F', 'I'].forEach(function (col) { var c = wsPl.getCell(col + plT); c.value = { formula: 'SUM(' + col + '5:' + col + plLast + ')' }; c.numFmt = NUM; });
    var gT = wsPl.getCell('G' + plT); gT.value = { formula: 'IFERROR(F' + plT + '/B' + plT + ',0)' }; gT.numFmt = PCT;
    total(wsPl, plT, 1, 9);
    note(wsPl, plT + 2, 'Công thức: Lợi nhuận ròng = Doanh thu − Chi phí − Thưởng + Phạt · Biên lợi nhuận = LN ròng / Doanh thu · Mỗi ô tháng dùng SUMIFS trên sheet "Giao dịch" theo Loại và Tháng.', 9);
    widths(wsPl, [12, 18, 20, 20, 22, 18, 14, 22, 20]);
    wsPl.views = [{ state: 'frozen', ySplit: 4 }];
    var PL = function (col, r) { return q('Lãi-Lỗ') + '!$' + col + '$' + r; };

    // ============ DÒNG TIỀN & DỰ BÁO ============
    var before = all.filter(function (e) { return entryDate(e) < range.from; });
    var opening = cashOf(before);
    title(wsCf, 'DÒNG TIỀN & DỰ BÁO', 5, sub);
    wsCf.getCell(4, 1).value = 'Số dư đầu kỳ (luỹ kế các giao dịch trước ' + vn(range.from) + ')'; wsCf.getCell(4, 1).font = { bold: true };
    var opc = wsCf.getCell(4, 5); opc.value = opening; opc.numFmt = NUM; opc.font = { bold: true, color: { argb: BLUE } };
    header(wsCf, 6, ['Tháng', 'Tiền vào', 'Tiền ra', 'Dòng tiền ròng', 'Tồn quỹ cuối tháng']);
    months.forEach(function (m, i) {
      var r = 7 + i;
      wsCf.getCell(r, 1).value = m;
      var b = wsCf.getCell('B' + r); b.value = { formula: 'SUMIFS(' + TX('G') + ',' + TX('E') + ',$A' + r + ',' + TX('G') + ',">0")' }; b.numFmt = NUM;
      var c = wsCf.getCell('C' + r); c.value = { formula: '-SUMIFS(' + TX('G') + ',' + TX('E') + ',$A' + r + ',' + TX('G') + ',"<0")' }; c.numFmt = NUM;
      var d = wsCf.getCell('D' + r); d.value = { formula: 'B' + r + '-C' + r }; d.numFmt = NUM; d.font = { bold: true };
      var e = wsCf.getCell('E' + r); e.value = { formula: (i === 0 ? '$E$4' : 'E' + (r - 1)) + '+D' + r }; e.numFmt = NUM;
    });
    var cfLast = 6 + months.length, cfT = cfLast + 1;
    wsCf.getCell(cfT, 1).value = 'TỔNG KỲ';
    ['B', 'C', 'D'].forEach(function (col) { var c = wsCf.getCell(col + cfT); c.value = { formula: 'SUM(' + col + '7:' + col + cfLast + ')' }; c.numFmt = NUM; });
    var ec = wsCf.getCell('E' + cfT); ec.value = { formula: '$E$4+D' + cfT }; ec.numFmt = NUM;
    total(wsCf, cfT, 1, 5);
    var fr = cfT + 3;
    wsCf.getCell(fr - 1, 1).value = 'DỰ BÁO 3 THÁNG TỚI'; wsCf.getCell(fr - 1, 1).font = { bold: true, size: 12 };
    var k3 = Math.min(3, months.length), plFirst3 = 4 + months.length - k3 + 1;
    wsCf.getCell(fr, 1).value = 'Trung bình (Doanh thu − Chi phí) ' + k3 + ' tháng gần nhất';
    var avg = wsCf.getCell(fr, 5); avg.value = { formula: 'AVERAGE(' + q('Lãi-Lỗ') + '!$I$' + plFirst3 + ':$I$' + plLast + ')' }; avg.numFmt = NUM;
    wsCf.getCell(fr + 1, 1).value = 'Tồn quỹ cuối kỳ'; var ce = wsCf.getCell(fr + 1, 5); ce.value = { formula: 'E' + cfT }; ce.numFmt = NUM;
    header(wsCf, fr + 3, ['Tháng dự báo', '', '', 'Thay đổi dự kiến', 'Tồn quỹ dự báo']);
    var lastM = parse(range.to);
    for (var k = 1; k <= 3; k++) {
      var rr = fr + 3 + k, dm = new Date(lastM.getFullYear(), lastM.getMonth() + k, 1);
      wsCf.getCell(rr, 1).value = dm.getFullYear() + '-' + pad(dm.getMonth() + 1) + ' (+' + k + ')';
      var d1 = wsCf.getCell('D' + rr); d1.value = { formula: '$E$' + fr }; d1.numFmt = NUM;
      var e1 = wsCf.getCell('E' + rr); e1.value = { formula: '$E$' + (fr + 1) + '+$E$' + fr + '*' + k }; e1.numFmt = NUM; e1.font = { bold: true };
    }
    note(wsCf, fr + 8, 'Tồn quỹ cuối tháng = Tồn quỹ tháng trước + Dòng tiền ròng. Dòng tiền ròng = Tiền vào − Tiền ra (SUMIFS cột "Ảnh hưởng dòng tiền" > 0 và < 0). Dự báo = Tồn quỹ cuối kỳ + Trung bình × số tháng.', 5);
    widths(wsCf, [30, 18, 18, 20, 22]);
    var cfClose = q('Dòng tiền & Dự báo') + '!$E$' + cfT, cfProj3 = q('Dòng tiền & Dự báo') + '!$E$' + (fr + 3 + 3);

    // ============ VAY NỢ ============
    var loansIn = list.filter(function (e) { return e.type === 'loan' || e.type === 'repayment'; });
    var debtOpen = sumType(before, 'loan') - sumType(before, 'repayment');
    title(wsDb, 'VAY NỢ & TRẢ NỢ', 5, sub);
    wsDb.getCell(4, 1).value = 'Dư nợ đầu kỳ (Vay − Trả các giao dịch trước ' + vn(range.from) + ')'; wsDb.getCell(4, 1).font = { bold: true };
    var doc = wsDb.getCell(4, 5); doc.value = debtOpen; doc.numFmt = NUM; doc.font = { bold: true, color: { argb: BLUE } };
    header(wsDb, 6, ['Loại', 'Ngày', 'Mô tả', 'Số tiền', 'Dư nợ luỹ kế']);
    loansIn.forEach(function (e, i) {
      var r = 7 + i;
      wsDb.getCell(r, 1).value = label(e.type);
      var dc = wsDb.getCell(r, 2); dc.value = dateCell(entryDate(e)); dc.numFmt = DATEF;
      wsDb.getCell(r, 3).value = e.description || e.category || '';
      var ac = wsDb.getCell(r, 4); ac.value = num(e.amount); ac.numFmt = NUM; ac.font = { color: { argb: BLUE } };
      var oc = wsDb.getCell(r, 5); oc.value = { formula: (i === 0 ? '$E$4' : 'E' + (r - 1)) + '+IF(A' + r + '="' + label('loan') + '",D' + r + ',-D' + r + ')' }; oc.numFmt = NUM;
    });
    var dbLast = Math.max(7, 6 + loansIn.length), dbT = dbLast + 2;
    [['Tổng vay nhận trong kỳ', 'SUMIFS(D7:D' + dbLast + ',A7:A' + dbLast + ',"' + label('loan') + '")'], ['Tổng trả nợ trong kỳ', 'SUMIFS(D7:D' + dbLast + ',A7:A' + dbLast + ',"' + label('repayment') + '")'], ['Dư nợ cuối kỳ', '$E$4+E' + dbT + '-E' + (dbT + 1)]].forEach(function (x, i) {
      wsDb.getCell(dbT + i, 1).value = x[0]; wsDb.getCell(dbT + i, 1).font = { bold: true };
      var c = wsDb.getCell(dbT + i, 5); c.value = { formula: x[1] }; c.numFmt = NUM; c.font = { bold: true };
    });
    widths(wsDb, [24, 14, 40, 18, 20]);
    var debtEnd = q('Vay nợ') + '!$E$' + (dbT + 2);

    // ============ SỨC KHỎE TC ============
    var m3 = monthsBetween(ymd(new Date(parse(range.to).getFullYear(), parse(range.to).getMonth() - 2, 1)), range.to);
    var e3 = all.filter(function (e) { return m3.indexOf((entryDate(e) || '').slice(0, 7)) !== -1; });
    var cashAllTo = cashOf(all.filter(function (e) { return entryDate(e) <= range.to; }));
    var debtAllTo = (function () { var l = all.filter(function (e) { return entryDate(e) <= range.to; }); return sumType(l, 'loan') - sumType(l, 'repayment'); })();
    title(wsHl, 'SỨC KHỎE TÀI CHÍNH (3 THÁNG KẾT THÚC ' + toMonth + ')', 4, sub);
    header(wsHl, 4, ['Số liệu đầu vào', 'Giá trị', 'Nguồn / công thức']);
    kv(wsHl, 5, 'Doanh thu 3 tháng', sumType(e3, 'revenue'), NUM, 'Σ Doanh thu ' + m3.join(', '), { input: true });
    kv(wsHl, 6, 'Chi phí 3 tháng', sumType(e3, 'expense'), NUM, 'Σ Chi phí cùng 3 tháng', { input: true });
    kv(wsHl, 7, 'Thưởng nhân viên 3 tháng', sumType(e3, 'bonus'), NUM, '', { input: true });
    kv(wsHl, 8, 'Phạt nhân viên thu về 3 tháng', sumType(e3, 'penalty'), NUM, '', { input: true });
    kv(wsHl, 9, 'Tiền tồn hiện có (luỹ kế toàn sổ đến ' + vn(range.to) + ')', cashAllTo, NUM, 'Σ Số tiền × Hệ số dòng tiền', { input: true });
    kv(wsHl, 10, 'Dư nợ vay hiện tại (luỹ kế toàn sổ)', debtAllTo, NUM, 'Σ Vay nhận − Σ Trả nợ', { input: true });
    header(wsHl, 12, ['Chỉ số', 'Giá trị', 'Công thức', 'Đánh giá', 'Ngưỡng']);
    kv(wsHl, 13, 'Lợi nhuận ròng 3 tháng', null, NUM, '= Doanh thu − Chi phí − Thưởng + Phạt'); wsHl.getCell('B13').value = { formula: 'B5-B6-B7+B8' };
    kv(wsHl, 14, 'Biên lợi nhuận (%)', null, '0.0', '= LN ròng / Doanh thu × 100'); wsHl.getCell('B14').value = { formula: 'IFERROR(B13/B5*100,0)' };
    kv(wsHl, 15, 'Tỷ lệ chi phí / doanh thu (%)', null, '0.0', '= Chi phí / Doanh thu × 100'); wsHl.getCell('B15').value = { formula: 'IFERROR(B6/B5*100,IF(B6>0,100,0))' };
    kv(wsHl, 16, 'Tỷ lệ nợ / doanh thu (%)', null, '0.0', '= Dư nợ / Doanh thu × 100'); wsHl.getCell('B16').value = { formula: 'IFERROR(B10/B5*100,IF(B10>0,100,0))' };
    kv(wsHl, 17, 'Chi phí bình quân / tháng', null, NUM, '= Chi phí 3 tháng / 3'); wsHl.getCell('B17').value = { formula: 'B6/3' };
    kv(wsHl, 18, 'Dự trữ tiền mặt (tháng)', null, '0.0', '= Tiền tồn / Chi phí bình quân (0 chi phí → 12 nếu có tiền)'); wsHl.getCell('B18').value = { formula: 'IF(B17>0,B9/B17,IF(B9>0,12,0))' };
    wsHl.getCell('D14').value = { formula: 'IF(B14>=15,"Tốt",IF(B14>=0,"Cần chú ý","Rủi ro"))' }; wsHl.getCell('E14').value = '≥15 Tốt · 0–15 Cần chú ý · <0 Rủi ro';
    wsHl.getCell('D15').value = { formula: 'IF(B15<=70,"Tốt",IF(B15<=90,"Cần chú ý","Rủi ro"))' }; wsHl.getCell('E15').value = '≤70 Tốt · 70–90 Cần chú ý · >90 Rủi ro';
    wsHl.getCell('D16').value = { formula: 'IF(B16<=30,"Tốt",IF(B16<=60,"Cần chú ý","Rủi ro"))' }; wsHl.getCell('E16').value = '≤30 Tốt · 30–60 Cần chú ý · >60 Rủi ro';
    wsHl.getCell('D18').value = { formula: 'IF(B18>=3,"Tốt",IF(B18>=1,"Cần chú ý","Rủi ro"))' }; wsHl.getCell('E18').value = '≥3 Tốt · 1–3 Cần chú ý · <1 Rủi ro';
    wsHl.getCell('A20').value = 'Nhận định tự động'; wsHl.getCell('A20').font = { bold: true, size: 12 };
    wsHl.getCell('A21').value = { formula: 'IF(B14<0,"• Đang lỗ 3 tháng gần nhất: rà soát đơn giá, cắt giảm chi phí phát sinh, ưu tiên thu hồi công nợ.",IF(B14<15,"• Biên lợi nhuận mỏng (<15%): xem lại chiết khấu và kiểm soát chi phí vật liệu/nhân công.","• Biên lợi nhuận khoẻ mạnh: duy trì kỷ luật báo giá, cân nhắc trích quỹ dự phòng."))' };
    wsHl.getCell('A22').value = { formula: 'IF(B16>60,"• Đòn bẩy nợ cao: ưu tiên dùng dòng tiền trả bớt nợ trước khi vay thêm.",IF(B16>30,"• Theo dõi sát khoản vay: lên lịch trả nợ rõ ràng.","• Nợ vay ở mức an toàn so với doanh thu."))' };
    wsHl.getCell('A23').value = { formula: 'IF(B18<1,"• Dự trữ tiền mặt rất thấp (<1 tháng): thu hồi công nợ, hạn chế chi không thiết yếu.",IF(B18<3,"• Nên tăng quỹ dự phòng (<3 tháng chi phí).","• Dự trữ tiền mặt đủ dùng."))' };
    widths(wsHl, [46, 20, 52, 16, 40]);
    var HL = { margin: q('Sức khỏe TC') + '!$B$14', expRatio: q('Sức khỏe TC') + '!$B$15', debtRatio: q('Sức khỏe TC') + '!$B$16', runway: q('Sức khỏe TC') + '!$B$18' };

    // ============ BCTC (Sổ tay CFO) ============
    var snap = TM.getBsSnapshotByYear(year) || {};
    var yEntries = all.filter(function (e) { return (entryDate(e) || '').slice(0, 4) === year; });
    title(wsBs, 'BÁO CÁO TÀI CHÍNH & CHỈ SỐ — NĂM ' + year, 3, 'Chữ xanh = số liệu nhập/lấy từ sổ (sửa được) · Các chỉ số bên dưới là công thức Excel · ' + sub);
    var r0 = 4;
    function sec(r, t) { wsBs.mergeCells(r, 1, r, 3); var c = wsBs.getCell(r, 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; fill(c, DARK); }
    sec(r0, 'A. BẢNG CÂN ĐỐI KẾ TOÁN (nhập tay ở mục Báo cáo tài chính)');
    var B = {};
    [['tsnh', 'Tài sản ngắn hạn', 'shortTermAssets'], ['tonkho', 'Hàng tồn kho', 'inventory'], ['tongts', 'Tổng tài sản', 'totalAssets'], ['nonh', 'Nợ ngắn hạn', 'shortTermLiabilities'], ['vaynh', 'Vay ngắn hạn', 'shortTermDebt'], ['vaydh', 'Vay dài hạn', 'longTermDebt'], ['tongno', 'Tổng nợ phải trả', 'totalLiabilities'], ['vcsh', 'Vốn chủ sở hữu', 'equity'], ['laivay', 'Chi phí lãi vay', 'interestExpense'], ['capex', 'CAPEX (mua sắm TSCĐ)', 'capex'], ['vonhoa', 'Vốn hóa thị trường (0 = dùng VCSH)', 'marketCap'], ['lnck', 'LNST chưa phân phối (lũy kế)', 'retainedEarnings']].forEach(function (x, i) {
      var r = r0 + 1 + i; kv(wsBs, r, x[1], num(snap[x[2]]), NUM, '', { input: true }); B[x[0]] = 'B' + r;
    });
    var r1 = r0 + 14;
    sec(r1, 'B. SỐ LIỆU TỪ SỔ GIAO DỊCH NĂM ' + year);
    var revY = sumType(yEntries, 'revenue'), cogsY = sumType(yEntries, 'expense'), bonY = sumType(yEntries, 'bonus'), penY = sumType(yEntries, 'penalty');
    kv(wsBs, r1 + 1, 'Doanh thu thuần', revY, NUM, 'Σ giao dịch "Doanh thu" trong năm', { input: true }); B.dt = 'B' + (r1 + 1);
    kv(wsBs, r1 + 2, 'Giá vốn hàng bán (ước tính)', cogsY, NUM, 'Σ giao dịch "Chi phí" trong năm', { input: true }); B.gv = 'B' + (r1 + 2);
    kv(wsBs, r1 + 3, 'Thưởng nhân viên', bonY, NUM, '', { input: true }); B.thuong = 'B' + (r1 + 3);
    kv(wsBs, r1 + 4, 'Phạt nhân viên thu về', penY, NUM, '', { input: true }); B.phat = 'B' + (r1 + 4);
    kv(wsBs, r1 + 5, 'Vay nhận trong năm', sumType(yEntries, 'loan'), NUM, '', { input: true }); B.vayY = 'B' + (r1 + 5);
    kv(wsBs, r1 + 6, 'Trả nợ gốc trong năm', sumType(yEntries, 'repayment'), NUM, '', { input: true }); B.traY = 'B' + (r1 + 6);
    kv(wsBs, r1 + 7, 'Tiền & tương đương tiền hiện có', cashOf(all.filter(function (e) { return entryDate(e) <= range.to; })), NUM, 'Luỹ kế toàn sổ đến hết kỳ', { input: true }); B.tien = 'B' + (r1 + 7);
    kv(wsBs, r1 + 8, 'Phải thu ngắn hạn (công nợ chưa thu)', null, NUM, 'Liên kết sheet "Công nợ KH"'); wsBs.getCell('B' + (r1 + 8)).value = { formula: rcUnpaid }; B.phaithu = 'B' + (r1 + 8);
    var r2 = r1 + 10;
    sec(r2, 'C. KẾT QUẢ KINH DOANH (công thức)');
    kv(wsBs, r2 + 1, 'Lợi nhuận gộp', null, NUM, '= Doanh thu − Giá vốn'); wsBs.getCell('B' + (r2 + 1)).value = { formula: B.dt + '-' + B.gv }; B.lg = 'B' + (r2 + 1);
    kv(wsBs, r2 + 2, 'EBIT (trước lãi vay & thuế)', null, NUM, '= LN gộp − Thưởng + Phạt'); wsBs.getCell('B' + (r2 + 2)).value = { formula: B.lg + '-' + B.thuong + '+' + B.phat }; B.ebit = 'B' + (r2 + 2);
    kv(wsBs, r2 + 3, 'LNST (sau lãi vay)', null, NUM, '= EBIT − Chi phí lãi vay'); wsBs.getCell('B' + (r2 + 3)).value = { formula: B.ebit + '-' + B.laivay }; B.lnst = 'B' + (r2 + 3);
    var r3 = r2 + 5;
    sec(r3, 'D. CHỈ SỐ TÀI CHÍNH (công thức)');
    var ratios = [
      ['Hệ số thanh toán hiện hành', 'IFERROR(' + B.tsnh + '/' + B.nonh + ',0)', '0.00', 'TSNH / Nợ NH', 'cur'],
      ['Hệ số thanh toán nhanh', 'IFERROR((' + B.tsnh + '-' + B.tonkho + ')/' + B.nonh + ',0)', '0.00', '(TSNH − Tồn kho) / Nợ NH', 'quick'],
      ['Hệ số thanh toán tiền mặt', 'IFERROR(' + B.tien + '/' + B.nonh + ',0)', '0.00', 'Tiền / Nợ NH', 'cash'],
      ['Nợ / Tổng tài sản', 'IFERROR(' + B.tongno + '/' + B.tongts + ',0)', PCT, 'Tổng nợ / Tổng TS', 'dta'],
      ['Nợ vay / Vốn chủ sở hữu', 'IFERROR((' + B.vaynh + '+' + B.vaydh + ')/' + B.vcsh + ',0)', '0.00', '(Vay NH + Vay DH) / VCSH', 'dte'],
      ['Hệ số chi trả lãi vay', 'IF(' + B.laivay + '>0,IFERROR((' + B.lnst + '+' + B.laivay + ')/' + B.laivay + ',0),"N/A")', '0.00', '(LNTT + Lãi vay) / Lãi vay', 'icr'],
      ['Số ngày thu tiền bình quân (DSO)', 'IF(' + B.dt + '>0,' + B.phaithu + '*365/' + B.dt + ',0)', '0', 'Phải thu × 365 / Doanh thu', 'dso'],
      ['Số ngày tồn kho bình quân (DIO)', 'IF(' + B.gv + '>0,' + B.tonkho + '*365/' + B.gv + ',0)', '0', 'Tồn kho × 365 / Giá vốn', 'dio'],
      ['Biên lợi nhuận gộp (GPM)', 'IFERROR(' + B.lg + '/' + B.dt + ',0)', PCT, 'LN gộp / Doanh thu', 'gpm'],
      ['Biên lợi nhuận ròng (NPM)', 'IFERROR(' + B.lnst + '/' + B.dt + ',0)', PCT, 'LNST / Doanh thu', 'npm'],
      ['ROA', 'IFERROR(' + B.lnst + '/' + B.tongts + ',0)', PCT, 'LNST / Tổng TS', 'roa'],
      ['ROE', 'IFERROR(' + B.lnst + '/' + B.vcsh + ',0)', PCT, 'LNST / VCSH', 'roe']
    ];
    var RATIO = {};
    ratios.forEach(function (x, i) { var r = r3 + 1 + i; kv(wsBs, r, x[0], null, x[2], x[3]); wsBs.getCell('B' + r).value = { formula: x[1] }; RATIO[x[4]] = q('BCTC') + '!$B$' + r; });
    var r4 = r3 + ratios.length + 2;
    sec(r4, 'E. ALTMAN Z-SCORE');
    kv(wsBs, r4 + 1, 'X1 = (TSNH − Nợ NH) / Tổng TS', null, '0.000', ''); wsBs.getCell('B' + (r4 + 1)).value = { formula: 'IFERROR((' + B.tsnh + '-' + B.nonh + ')/' + B.tongts + ',0)' };
    kv(wsBs, r4 + 2, 'X2 = LNST lũy kế / Tổng TS', null, '0.000', ''); wsBs.getCell('B' + (r4 + 2)).value = { formula: 'IFERROR(' + B.lnck + '/' + B.tongts + ',0)' };
    kv(wsBs, r4 + 3, 'X3 = EBIT / Tổng TS', null, '0.000', ''); wsBs.getCell('B' + (r4 + 3)).value = { formula: 'IFERROR(' + B.ebit + '/' + B.tongts + ',0)' };
    kv(wsBs, r4 + 4, 'X4 = Vốn hóa / Tổng nợ (vốn hóa = VCSH nếu để 0)', null, '0.000', ''); wsBs.getCell('B' + (r4 + 4)).value = { formula: 'IFERROR(IF(' + B.vonhoa + '>0,' + B.vonhoa + ',' + B.vcsh + ')/' + B.tongno + ',0)' };
    kv(wsBs, r4 + 5, 'X5 = Doanh thu / Tổng TS', null, '0.000', ''); wsBs.getCell('B' + (r4 + 5)).value = { formula: 'IFERROR(' + B.dt + '/' + B.tongts + ',0)' };
    kv(wsBs, r4 + 6, 'Z = 1,2·X1 + 1,4·X2 + 3,3·X3 + 0,6·X4 + 1,0·X5', null, '0.00', '> 2,99 An toàn · 1,81–2,99 Cảnh báo · < 1,81 Nguy hiểm', { bold: true });
    wsBs.getCell('B' + (r4 + 6)).value = { formula: '1.2*B' + (r4 + 1) + '+1.4*B' + (r4 + 2) + '+3.3*B' + (r4 + 3) + '+0.6*B' + (r4 + 4) + '+1*B' + (r4 + 5) };
    wsBs.getCell('B' + (r4 + 6)).font = { bold: true };
    wsBs.getCell('C' + (r4 + 7)).value = { formula: 'IF(B' + (r4 + 6) + '>2.99,"An toàn",IF(B' + (r4 + 6) + '<1.81,"Nguy hiểm","Cảnh báo"))' };
    wsBs.getCell('A' + (r4 + 7)).value = 'Kết luận Z-Score';
    var ZREF = q('BCTC') + '!$B$' + (r4 + 6);
    var r5 = r4 + 9;
    sec(r5, 'F. DÒNG TIỀN THEO HOẠT ĐỘNG (công thức)');
    kv(wsBs, r5 + 1, 'HĐ Kinh doanh (CFO)', null, NUM, '= Doanh thu − Giá vốn − Thưởng + Phạt'); wsBs.getCell('B' + (r5 + 1)).value = { formula: B.dt + '-' + B.gv + '-' + B.thuong + '+' + B.phat };
    kv(wsBs, r5 + 2, 'HĐ Đầu tư (CFI)', null, NUM, '= − CAPEX'); wsBs.getCell('B' + (r5 + 2)).value = { formula: '-' + B.capex };
    kv(wsBs, r5 + 3, 'HĐ Tài chính (CFF)', null, NUM, '= Vay nhận − Trả nợ gốc'); wsBs.getCell('B' + (r5 + 3)).value = { formula: B.vayY + '-' + B.traY };
    kv(wsBs, r5 + 4, 'Dòng tiền tự do (FCF)', null, NUM, '= CFO − CAPEX', { bold: true }); wsBs.getCell('B' + (r5 + 4)).value = { formula: 'B' + (r5 + 1) + '-' + B.capex };
    wsBs.getCell('B' + (r5 + 4)).font = { bold: true };
    widths(wsBs, [52, 22, 56]);

    // ============ RỦI RO ============
    title(wsRk, 'ĐÁNH GIÁ RỦI RO TÀI CHÍNH', 6, sub);
    header(wsRk, 4, ['Nhóm', 'Rủi ro', 'Công thức', 'Giá trị', 'Ngưỡng', 'Mức độ']);
    var BR = function (a) { return q('BCTC') + '!$B$' + a.slice(1); };   // 'B12' → 'BCTC'!$B$12
    var hasBal = num(snap.totalAssets) > 0 && num(snap.shortTermLiabilities) > 0;
    var rows = [];
    function add(g, n, f, ref, fmtc, thr, sev) { rows.push([g, n, f, ref, fmtc, thr, sev]); }
    var lbl = { hi: 'Cao', mid: 'Trung bình', lo: 'Thấp' };
    // sev: hàm dựng công thức mức độ từ ô giá trị (X)
    function sevHi(lowIf, highIf) { return function (X) { return 'IF(' + lowIf(X) + ',"' + lbl.lo + '",IF(' + highIf(X) + ',"' + lbl.hi + '","' + lbl.mid + '"))'; }; }
    if (hasBal) {
      add('Thanh khoản', 'Mất khả năng thanh toán ngắn hạn', 'TSNH / Nợ NH', RATIO.cur, '0.00', '≥2,0 Thấp · 1,0–2,0 TB · <1,0 Cao', sevHi(function (X) { return X + '>=2'; }, function (X) { return X + '<1'; }));
      add('Thanh khoản', 'Không đủ tài sản dễ chuyển đổi', '(TSNH − Tồn kho) / Nợ NH', RATIO.quick, '0.00', '≥1,0 Thấp · 0,5–1,0 TB · <0,5 Cao', sevHi(function (X) { return X + '>=1'; }, function (X) { return X + '<0.5'; }));
      add('Thanh khoản', 'Đệm tiền mặt quá mỏng', 'Tiền / Nợ NH', RATIO.cash, '0.00', '≥0,2 Thấp · 0,1–0,2 TB · <0,1 Cao', sevHi(function (X) { return X + '>=0.2'; }, function (X) { return X + '<0.1'; }));
      add('Đòn bẩy', 'Nợ chiếm tỷ trọng quá lớn trong tài sản', 'Tổng nợ / Tổng TS', RATIO.dta, PCT, '≤65% Thấp · 65–80% TB · >80% Cao', sevHi(function (X) { return X + '<=0.65'; }, function (X) { return X + '>0.8'; }));
      add('Đòn bẩy', 'Vay nợ vượt vốn tự có', '(Vay NH + Vay DH) / VCSH', RATIO.dte, '0.00', '≤1,0 Thấp · 1,0–3,0 TB · >3,0 Cao', sevHi(function (X) { return X + '<=1'; }, function (X) { return X + '>3'; }));
      add('Đòn bẩy', 'Không đủ khả năng trả lãi vay', '(LNTT + Lãi vay) / Lãi vay', RATIO.icr, '0.00', '≥1,5 Thấp · 1,0–1,5 TB · <1,0 Cao', function (X) { return 'IF(ISNUMBER(' + X + '),IF(' + X + '>=1.5,"Thấp",IF(' + X + '<1,"Cao","Trung bình")),"Thiếu dữ liệu")'; });
    }
    add('Dòng tiền', 'Chi vượt thu trong tháng ' + toMonth, 'Lãi/lỗ tháng cuối kỳ', PL('F', plLast), NUM, '≥0 Thấp · <0 Cao', function (X) { return 'IF(' + X + '>=0,"Thấp","Cao")'; });
    add('Dòng tiền', 'Tồn quỹ cuối kỳ cạn kiệt', 'Tồn quỹ cuối kỳ (sheet Dòng tiền)', cfClose, NUM, '≥0 Thấp · <0 Cao', function (X) { return 'IF(' + X + '>=0,"Thấp","Cao")'; });
    if (hasBal) add('Dòng tiền', 'Vốn lưu động ròng âm', 'TSNH − Nợ NH', '(' + BR(B.tsnh) + '-' + BR(B.nonh) + ')', NUM, '≥0 Thấp · <0 Cao', function (X) { return 'IF(' + X + '>=0,"Thấp","Cao")'; });
    add('Công nợ', 'Thu tiền khách hàng quá chậm (DSO)', 'Phải thu × 365 / Doanh thu', RATIO.dso, '0', '<90 Thấp · 90–180 TB · >180 Cao', sevHi(function (X) { return X + '<90'; }, function (X) { return X + '>180'; }));
    add('Công nợ', 'Tỉ lệ công nợ quá hạn / chưa thu', 'Quá hạn / Chưa thu', rcRatio, PCT, '0% Thấp · 1–30% TB · >30% Cao', sevHi(function (X) { return X + '=0'; }, function (X) { return X + '>0.3'; }));
    add('Công nợ', 'Số khoản công nợ đã quá hạn', 'COUNTIF "Quá hạn"', rcCount, '0', '0 Thấp · ≥1 Cao', function (X) { return 'IF(' + X + '=0,"Thấp","Cao")'; });
    add('Sinh lời', 'Biên lợi nhuận gộp quá mỏng', 'LN gộp / Doanh thu', RATIO.gpm, PCT, '≥20% Thấp · 10–20% TB · <10% Cao', function (X) { return 'IF(' + BR(B.dt) + '=0,"Thiếu dữ liệu",IF(' + X + '>=0.2,"Thấp",IF(' + X + '<0.1,"Cao","Trung bình")))'; });
    add('Sinh lời', 'Kinh doanh thua lỗ', 'LNST / Doanh thu', RATIO.npm, PCT, '≥0% Thấp · <0% Cao', function (X) { return 'IF(' + X + '>=0,"Thấp","Cao")'; });
    add('Vận hành', 'Tiền ứ đọng / chưa giải ngân (trong kỳ)', 'Σ "Tiền ứ đọng" + "Chưa giải ngân"', '(' + sumT('idle') + '+' + sumT('undisbursed') + ')', NUM, '0 Thấp · >0 Cần theo dõi', function (X) { return 'IF(' + X + '=0,"Thấp","Trung bình")'; });
    add('Vận hành', 'Còn dư nợ vay chưa trả hết', 'Dư nợ cuối kỳ (sheet Vay nợ)', debtEnd, NUM, '0 Thấp · >0 Cần theo dõi', function (X) { return 'IF(' + X + '<=0,"Thấp","Trung bình")'; });
    add('Sức khỏe', 'Biên lợi nhuận 3 tháng', 'LN ròng / Doanh thu × 100', HL.margin, '0.0', '≥15 Thấp · 0–15 TB · <0 Cao', sevHi(function (X) { return X + '>=15'; }, function (X) { return X + '<0'; }));
    add('Sức khỏe', 'Dự trữ tiền mặt (tháng)', 'Tiền tồn / Chi phí bình quân', HL.runway, '0.0', '≥3 Thấp · 1–3 TB · <1 Cao', sevHi(function (X) { return X + '>=3'; }, function (X) { return X + '<1'; }));
    if (hasBal) add('Phá sản', 'Nguy cơ kiệt quệ tài chính (Altman Z)', 'Z = 1,2X1+1,4X2+3,3X3+0,6X4+X5', ZREF, '0.00', '>2,99 Thấp · 1,81–2,99 TB · <1,81 Cao', sevHi(function (X) { return X + '>2.99'; }, function (X) { return X + '<1.81'; }));
    rows.forEach(function (x, i) {
      var r = 5 + i;
      wsRk.getCell(r, 1).value = x[0]; wsRk.getCell(r, 2).value = x[1]; wsRk.getCell(r, 3).value = x[2];
      var v = wsRk.getCell(r, 4); v.value = { formula: x[3] }; v.numFmt = x[4];
      wsRk.getCell(r, 5).value = x[5];
      wsRk.getCell(r, 6).value = { formula: x[6]('D' + r) }; wsRk.getCell(r, 6).font = { bold: true };
    });
    var rkLast = 4 + rows.length;
    wsRk.addConditionalFormatting({ ref: 'F5:F' + rkLast, rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"Cao"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF4C7BF' } }, font: { color: { argb: RED }, bold: true } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"Trung bình"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF6E3B8' } }, font: { color: { argb: 'FF8A6210' }, bold: true } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"Thấp"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFCFE8D5' } }, font: { color: { argb: GREEN }, bold: true } } }
    ] });
    var st0 = rkLast + 2;
    wsRk.getCell(st0, 2).value = 'Tổng hợp'; wsRk.getCell(st0, 2).font = { bold: true };
    [['Rủi ro Cao', 'Cao'], ['Rủi ro Trung bình', 'Trung bình'], ['Rủi ro Thấp', 'Thấp'], ['Thiếu dữ liệu', 'Thiếu dữ liệu']].forEach(function (x, i) { wsRk.getCell(st0 + 1 + i, 2).value = x[0]; wsRk.getCell(st0 + 1 + i, 4).value = { formula: 'COUNTIF(F5:F' + rkLast + ',"' + x[1] + '")' }; });
    if (!hasBal) note(wsRk, st0 + 6, 'Chưa nhập bảng cân đối kế toán năm ' + year + ' (mục "Báo cáo tài chính" trên web) nên các nhóm Thanh khoản / Đòn bẩy / Z-Score chưa được liệt kê.', 6);
    widths(wsRk, [14, 44, 34, 16, 34, 16]);
    wsRk.views = [{ state: 'frozen', ySplit: 4 }];

    // ============ TỔNG QUAN ============
    title(wsOv, 'BÁO CÁO TÀI CHÍNH — HICONIQUE', 3, sub);
    header(wsOv, 4, ['Chỉ tiêu', 'Giá trị', 'Công thức / ghi chú']);
    var o = 5;
    function ov(labelText, formula, fmtc, how, bold) { kv(wsOv, o, labelText, null, fmtc, how, { bold: bold }); wsOv.getCell('B' + o).value = { formula: formula }; var ref = 'B' + o; o++; return ref; }
    var oDT = ov('Doanh thu trong kỳ', sumT('revenue'), NUM, 'SUMIFS trên sheet "Giao dịch" (Loại = Doanh thu)');
    var oCP = ov('Chi phí hoạt động', sumT('expense'), NUM, 'SUMIFS (Loại = Chi phí)');
    var oTH = ov('Thưởng nhân viên', sumT('bonus'), NUM, '');
    var oPH = ov('Phạt nhân viên thu về', sumT('penalty'), NUM, '');
    var oLN = ov('Lợi nhuận ròng', oDT + '-' + oCP + '-' + oTH + '+' + oPH, NUM, '= Doanh thu − Chi phí − Thưởng + Phạt', true);
    ov('Biên lợi nhuận ròng', 'IFERROR(' + oLN + '/' + oDT + ',0)', PCT, '= Lợi nhuận ròng / Doanh thu');
    o++;
    var oCF = ov('Dòng tiền ròng trong kỳ', 'SUM(' + TX('G') + ')', NUM, 'Σ cột "Ảnh hưởng dòng tiền" (sheet Giao dịch)');
    ov('Số dư đầu kỳ', q('Dòng tiền & Dự báo') + '!$E$4', NUM, 'Luỹ kế các giao dịch trước ngày bắt đầu');
    ov('Tồn quỹ cuối kỳ', cfClose, NUM, '= Số dư đầu kỳ + Dòng tiền ròng', true);
    ov('Dự báo tồn quỹ sau 3 tháng', cfProj3, NUM, 'Xem sheet "Dòng tiền & Dự báo"');
    o++;
    ov('Vay nhận trong kỳ', sumT('loan'), NUM, '');
    ov('Trả nợ trong kỳ', sumT('repayment'), NUM, '');
    ov('Dư nợ cuối kỳ', debtEnd, NUM, 'Xem sheet "Vay nợ"', true);
    ov('Tiền ứ đọng / chưa giải ngân (trong kỳ)', sumT('idle') + '+' + sumT('undisbursed'), NUM, '');
    o++;
    ov('Công nợ khách hàng chưa thu', rcUnpaid, NUM, 'Xem sheet "Công nợ KH"');
    ov('Trong đó quá hạn', rcOverdue, NUM, '');
    ov('Số giao dịch trong kỳ', 'COUNTA(' + TX('A') + ')', '0', '');
    ov('Z-Score năm ' + year, hasBal ? ZREF : '0', '0.00', hasBal ? '> 2,99 An toàn · < 1,81 Nguy hiểm' : 'Chưa nhập bảng cân đối kế toán');
    var rk = o + 1;
    wsOv.getCell(rk, 1).value = 'Số rủi ro mức Cao'; wsOv.getCell(rk, 2).value = { formula: q('Rủi ro') + '!$D$' + (st0 + 1) }; wsOv.getCell(rk, 1).font = { bold: true, color: { argb: RED } };
    // chi phí theo danh mục
    var cats = {}; list.filter(function (e) { return e.type === 'expense'; }).forEach(function (e) { var k = e.category || '(chưa phân loại)'; cats[k] = (cats[k] || 0) + num(e.amount); });
    var catNames = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).slice(0, 15);
    var cr = rk + 3;
    wsOv.getCell(cr - 1, 1).value = 'CHI PHÍ THEO DANH MỤC'; wsOv.getCell(cr - 1, 1).font = { bold: true, size: 12 };
    header(wsOv, cr, ['Danh mục', 'Chi phí', 'Tỉ trọng']);
    catNames.forEach(function (n, i) {
      var r = cr + 1 + i; wsOv.getCell(r, 1).value = n;
      var c = wsOv.getCell(r, 2); c.value = { formula: 'SUMIFS(' + TX('F') + ',' + TX('A') + ',"' + label('expense') + '",' + TX('B') + ',A' + r + ')' }; c.numFmt = NUM;
      var p = wsOv.getCell(r, 3); p.value = { formula: 'IFERROR(B' + r + '/' + oCP + ',0)' }; p.numFmt = PCT;
    });
    widths(wsOv, [44, 22, 60]);
    wsOv.views = [{ state: 'frozen', ySplit: 4 }];

    // ============ HOÀN THIỆN: kẻ khung, tô màu đánh giá, in ấn ============
    polish(wsOv, 5, rk, 1, 3); polish(wsOv, cr + 1, cr + Math.max(1, catNames.length), 1, 3);
    wsOv.addConditionalFormatting({ ref: 'C' + (cr + 1) + ':C' + (cr + Math.max(1, catNames.length)), rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FFD9B98A' }, gradient: false }] });
    colorSign(wsOv, oLN + ':' + oLN); colorSign(wsOv, oCF + ':' + oCF);
    polish(wsTx, 5, txLast, 1, 8); colorSign(wsTx, 'G5:H' + txLast);
    wsTx.addConditionalFormatting({ ref: 'A5:A' + txLast, rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"' + label('revenue') + '"'], style: { font: { color: { argb: 'FF1F6B3A' }, bold: true } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"' + label('expense') + '"'], style: { font: { color: { argb: 'FFB5402A' }, bold: true } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"' + label('loan') + '"'], style: { font: { color: { argb: 'FF8A6210' }, bold: true } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"' + label('repayment') + '"'], style: { font: { color: { argb: 'FF1F4E9E' }, bold: true } } }
    ] });
    polish(wsPl, 5, plLast, 1, 9); colorSign(wsPl, 'F5:F' + plT); colorSign(wsPl, 'H5:H' + plLast);
    wsPl.addConditionalFormatting({ ref: 'G5:G' + plLast, rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: -0.5 }, { type: 'num', value: 1 }], color: { argb: 'FFD9B98A' }, gradient: false }] });
    polish(wsCf, 7, cfLast, 1, 5); colorSign(wsCf, 'D7:D' + cfT); colorSign(wsCf, 'E7:E' + cfT);
    polish(wsDb, 7, dbLast, 1, 5);
    polish(wsRc, 5, rcLast, 1, 8); colorEval(wsRc, 'F5:G' + rcLast); centerBold(wsRc, 'F5:G' + rcLast);
    polish(wsHl, 5, 10, 1, 3); polish(wsHl, 13, 18, 1, 5); colorEval(wsHl, 'D13:D18'); centerBold(wsHl, 'D14:D18');
    polish(wsBs, 5, r5 + 4, 1, 3); colorEval(wsBs, 'C' + (r4 + 7)); centerBold(wsBs, 'C' + (r4 + 7) + ':C' + (r4 + 7));
    polish(wsRk, 5, rkLast, 1, 6); colorEval(wsRk, 'F5:F' + rkLast); centerBold(wsRk, 'F5:F' + rkLast);
    polish(wsPr, 5, 4 + ORDER.length, 1, 4);

    // In ấn: A4, vùng in chuẩn, tiêu đề bảng lặp lại mỗi trang, đầu trang có Quốc hiệu – Tiêu ngữ
    printSetup(wsOv, 'A1:C' + (cr + Math.max(1, catNames.length) + 1), false, '4:4');
    printSetup(wsTx, 'A1:H' + txTot, true, '4:4');
    printSetup(wsPl, 'A1:I' + (plT + 2), true, '4:4');
    printSetup(wsCf, 'A1:E' + (fr + 8), false, '6:6');
    printSetup(wsDb, 'A1:E' + (dbT + 2), false, '6:6');
    printSetup(wsRc, 'A1:H' + (rcT + 4), true, '4:4');
    printSetup(wsHl, 'A1:E23', true, null);
    printSetup(wsBs, 'A1:C' + (r5 + 4), false, null);
    printSetup(wsRk, 'A1:F' + (st0 + 6), true, '4:4');
    printSetup(wsPr, 'A1:D' + (gr + 8), false, null);

    // ============ BÌA BÁO CÁO — văn bản chuẩn, in luôn ============
    (function () {
      var now = new Date(), F = 'Times New Roman';
      widths(wsCv, [6, 34, 20, 20, 20, 14]);
      function m(r, c1, c2, val, o) {
        wsCv.mergeCells(r, c1, r, c2); var c = wsCv.getCell(r, c1); c.value = val;
        c.font = { name: F, size: (o && o.size) || 12, bold: !!(o && o.bold), italic: !!(o && o.italic), underline: !!(o && o.underline), color: { argb: 'FF000000' } };
        c.alignment = { horizontal: (o && o.h) || 'center', vertical: 'middle', wrapText: true };
        return c;
      }
      m(1, 1, 3, HDR_LEFT, { bold: true, size: 12 });
      m(1, 4, 6, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 12 });
      m(2, 1, 3, 'Số: ....../BC-TC', { size: 12 });
      m(2, 4, 6, 'Độc lập - Tự do - Hạnh phúc', { bold: true, size: 13 });
      wsCv.getCell(2, 4).border = {}; ['D', 'E', 'F'].forEach(function (col) { wsCv.getCell(col + '3').border = { top: { style: 'thin', color: { argb: 'FF000000' } } }; });
      wsCv.getRow(3).height = 6;
      m(4, 4, 6, 'Hải Phòng, ngày ' + now.getDate() + ' tháng ' + (now.getMonth() + 1) + ' năm ' + now.getFullYear(), { italic: true, size: 12, h: 'right' });
      wsCv.getRow(6).height = 8;
      m(7, 1, 6, 'BÁO CÁO TÀI CHÍNH', { bold: true, size: 18 });
      m(8, 1, 6, 'Kỳ báo cáo: từ ngày ' + vn(range.from) + ' đến ngày ' + vn(range.to), { bold: true, size: 13 });
      m(9, 1, 6, 'Kính gửi: Ban Giám đốc / Chủ sở hữu Công ty', { italic: true, size: 12 });
      wsCv.getRow(7).height = 30;
      // Chỉ tiêu chủ yếu (công thức liên kết sheet Tổng quan)
      var T = q('Tổng quan') + '!';
      wsCv.getCell(11, 1).value = 'I. CÁC CHỈ TIÊU TÀI CHÍNH CHỦ YẾU'; wsCv.getCell(11, 1).font = { name: F, bold: true, size: 12 };
      var head = ['STT', 'Chỉ tiêu', 'Giá trị', 'Đơn vị', 'Đánh giá', ''];
      [1, 2, 3, 4, 5].forEach(function (i) { var c = wsCv.getCell(12, i); c.value = head[i - 1]; c.font = { name: F, bold: true, color: { argb: 'FFFFFFFF' } }; fill(c, DARK); c.alignment = { horizontal: 'center', vertical: 'middle' }; });
      var kp = [
        ['Doanh thu trong kỳ', T + oDT, NUM, 'VNĐ', null],
        ['Chi phí hoạt động', T + oCP, NUM, 'VNĐ', null],
        ['Lợi nhuận ròng', T + oLN, NUM, 'VNĐ', 'IF(C{r}>=0,"Tốt","Rủi ro")'],
        ['Biên lợi nhuận ròng', 'IFERROR(' + T + oLN + '/' + T + oDT + ',0)', PCT, '%', 'IF(C{r}>=0.15,"Tốt",IF(C{r}>=0,"Cần chú ý","Rủi ro"))'],
        ['Dòng tiền ròng trong kỳ', T + oCF, NUM, 'VNĐ', 'IF(C{r}>=0,"Tốt","Rủi ro")'],
        ['Tồn quỹ cuối kỳ', cfClose, NUM, 'VNĐ', 'IF(C{r}>=0,"Tốt","Rủi ro")'],
        ['Dư nợ vay cuối kỳ', debtEnd, NUM, 'VNĐ', 'IF(C{r}<=0,"Tốt","Cần chú ý")'],
        ['Công nợ khách hàng chưa thu', rcUnpaid, NUM, 'VNĐ', null],
        ['Trong đó công nợ quá hạn', rcOverdue, NUM, 'VNĐ', 'IF(C{r}=0,"Tốt","Rủi ro")'],
        ['Số rủi ro mức Cao', q('Rủi ro') + '!$D$' + (st0 + 1), '0', 'rủi ro', 'IF(C{r}=0,"An toàn","Rủi ro")']
      ];
      kp.forEach(function (x, i) {
        var r = 13 + i;
        wsCv.getCell(r, 1).value = i + 1; wsCv.getCell(r, 1).alignment = { horizontal: 'center' };
        wsCv.getCell(r, 2).value = x[0];
        var v = wsCv.getCell(r, 3); v.value = { formula: x[1] }; v.numFmt = x[2]; v.alignment = { horizontal: 'right' };
        wsCv.getCell(r, 4).value = x[3]; wsCv.getCell(r, 4).alignment = { horizontal: 'center' };
        if (x[4]) wsCv.getCell(r, 5).value = { formula: x[4].replace(/\{r\}/g, r) };
        [1, 2, 3, 4, 5].forEach(function (cc) { wsCv.getCell(r, cc).font = Object.assign({ name: F, size: 12 }, cc === 3 ? { bold: true } : {}); });
      });
      var kEnd = 12 + kp.length;
      polish(wsCv, 13, kEnd, 1, 5); colorEval(wsCv, 'E13:E' + kEnd); centerBold(wsCv, 'E13:E' + kEnd); colorSign(wsCv, 'C15:C15');
      // Nhận xét tự động
      var nr = kEnd + 2;
      wsCv.getCell(nr, 1).value = 'II. NHẬN XÉT'; wsCv.getCell(nr, 1).font = { name: F, bold: true, size: 12 };
      wsCv.mergeCells(nr + 1, 1, nr + 1, 6);
      var nc = wsCv.getCell(nr + 1, 1);
      nc.value = { formula: '"Trong kỳ, công ty "&IF(C15>=0,"có lãi","bị lỗ")&" "&TEXT(ABS(C15),"#,##0")&" đồng trên doanh thu "&TEXT(C13,"#,##0")&" đồng (biên lợi nhuận "&TEXT(C16,"0.0%")&"). Dòng tiền ròng "&IF(C17>=0,"dương ","âm ")&TEXT(ABS(C17),"#,##0")&" đồng, tồn quỹ cuối kỳ "&TEXT(C18,"#,##0")&" đồng. Dư nợ vay "&TEXT(C19,"#,##0")&" đồng; công nợ khách hàng chưa thu "&TEXT(C20,"#,##0")&" đồng"&IF(C21>0,", trong đó quá hạn "&TEXT(C21,"#,##0")&" đồng cần đôn đốc thu hồi","")&". Có "&C22&" rủi ro mức Cao cần xem xét (chi tiết tại sheet Rủi ro)."' };
      nc.font = { name: F, size: 12 }; nc.alignment = { wrapText: true, vertical: 'top', horizontal: 'justify' }; wsCv.getRow(nr + 1).height = 78;
      // Phụ lục (liên kết tới từng sheet)
      var ar = nr + 3;
      wsCv.getCell(ar, 1).value = 'III. DANH MỤC PHỤ LỤC (bấm để chuyển sheet)'; wsCv.getCell(ar, 1).font = { name: F, bold: true, size: 12 };
      var apx = [['Tổng quan', 'Chỉ tiêu tổng hợp, chi phí theo danh mục'], ['Giao dịch', 'Sổ giao dịch trong kỳ (có bộ lọc)'], ['Lãi-Lỗ', 'Kết quả kinh doanh theo tháng'], ['Dòng tiền & Dự báo', 'Tồn quỹ và dự báo 3 tháng'], ['Vay nợ', 'Vay – trả nợ, dư nợ luỹ kế'], ['Công nợ KH', 'Công nợ khách hàng, quá hạn'], ['Sức khỏe TC', 'Chấm điểm sức khỏe tài chính'], ['BCTC', 'Chỉ số thanh khoản, đòn bẩy, Z-Score'], ['Rủi ro', 'Đăng ký & đánh giá rủi ro'], ['Tham số', 'Hệ số & quy ước công thức']];
      apx.forEach(function (x, i) {
        var r = ar + 1 + i;
        wsCv.getCell(r, 1).value = 'PL' + (i + 1); wsCv.getCell(r, 1).alignment = { horizontal: 'center' };
        var l = wsCv.getCell(r, 2); l.value = { text: x[0], hyperlink: "#'" + x[0] + "'!A1" }; l.font = { name: F, size: 12, underline: true, color: { argb: 'FF1F4E9E' } };
        wsCv.mergeCells(r, 3, r, 6); wsCv.getCell(r, 3).value = x[1]; wsCv.getCell(r, 3).font = { name: F, size: 12 };
      });
      var sr = ar + apx.length + 3;
      // Chữ ký
      m(sr, 4, 6, 'Hải Phòng, ngày ' + now.getDate() + ' tháng ' + (now.getMonth() + 1) + ' năm ' + now.getFullYear(), { italic: true, size: 12 });
      m(sr + 1, 1, 2, 'NGƯỜI LẬP BIỂU', { bold: true }); m(sr + 1, 3, 4, 'KẾ TOÁN TRƯỞNG', { bold: true }); m(sr + 1, 5, 6, 'GIÁM ĐỐC', { bold: true });
      m(sr + 2, 1, 2, '(Ký, ghi rõ họ tên)', { italic: true, size: 11 }); m(sr + 2, 3, 4, '(Ký, ghi rõ họ tên)', { italic: true, size: 11 }); m(sr + 2, 5, 6, '(Ký, đóng dấu, ghi rõ họ tên)', { italic: true, size: 11 });
      wsCv.getRow(sr + 3).height = 70;
      m(sr + 4, 1, 2, user.name || '', { bold: true }); m(sr + 4, 3, 4, '', { bold: true }); m(sr + 4, 5, 6, '', { bold: true });
      wsCv.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true, printArea: 'A1:F' + (sr + 4), margins: { left: 0.8, right: 0.6, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3 } };
      wsCv.headerFooter = { oddFooter: '&C&"Times New Roman"&8Bản in lúc &D &T · Tạo tự động từ Sổ tài chính HICONIQUE' };
    })();

    wb.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'Bao-cao-tai-chinh-' + range.from + '_' + range.to + '.xlsx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      modal.classList.remove('on');
      var b = modal.querySelector('#fxGo'); b.disabled = false; b.textContent = 'Xuất Excel';
    }).catch(function (err) {
      console.error('Export failed:', err); alert('Xuất file thất bại. Vui lòng thử lại.');
      var b = modal.querySelector('#fxGo'); b.disabled = false; b.textContent = 'Xuất Excel';
    });
  }

  return { open: open };
})();
