/**
 * Báo cáo nhanh — xem trực tiếp trên web, bố cục & số liệu GIỐNG file Excel "Xuất báo cáo" (2026-09-30).
 * Cửa sổ có chọn kỳ (Tuần/Tháng/Quý/Năm/Toàn bộ hoặc từ–đến ngày) và các thẻ: Tổng hợp · Giao dịch · Sổ quỹ 111 · Sổ TGNH 112 · Lãi-Lỗ · Dòng tiền · Công nợ.
 * Dùng chung dữ liệu với trang (ctx do finance.html truyền vào: TaskManager, TYPES, TYPE_ORDER, receivableStatus, STATUS_LABEL, user).
 */
var FinanceQuick = (function () {
  'use strict';
  var COMPANY = 'CÔNG TY TNHH THIẾT KẾ VÀ XÂY DỰNG HICONIQUE';
  var ctx = null, box = null, range = { from: '', to: '' }, mode = 'month', tab = 'sum';
  var TABS = [['sum', 'Tổng hợp'], ['tx', 'Giao dịch'], ['l111', 'Sổ quỹ 111'], ['l112', 'Sổ TGNH 112'], ['pnl', 'Lãi-Lỗ'], ['cf', 'Dòng tiền'], ['rc', 'Công nợ']];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function vn(s) { if (!s) return ''; var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = Math.round(Number(n) || 0); return n < 0 ? '(' + (-n).toLocaleString('vi-VN') + ')' : n.toLocaleString('vi-VN'); }
  function num(v) { return Number(v) || 0; }
  function entryDate(e) { return e.date || (e.month ? e.month + '-01' : ''); }
  function all() { return ctx.TaskManager.getFinanceEntries() || []; }
  function inRange(e) { var d = entryDate(e); return d && d >= range.from && d <= range.to; }
  function sumT(list, t) { return list.filter(function (e) { return e.type === t; }).reduce(function (s, e) { return s + num(e.amount); }, 0); }
  function cashOf(list) { return list.reduce(function (s, e) { var t = ctx.TYPES[e.type]; return s + (t ? t.cashSign : 0) * num(e.amount); }, 0); }
  function counterCode(e) { var m = /^\d{3,4}/.exec(String(e.counterAccount || '')); return m ? m[0] : ''; }
  function months(from, to) { var a = parse(from), b = parse(to), out = [], y = a.getFullYear(), m = a.getMonth(); while ((y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth())) && out.length < 120) { out.push(y + '-' + pad(m + 1)); m++; if (m > 11) { m = 0; y++; } } return out; }
  function mm(ym) { return ym.slice(5) + '/' + ym.slice(0, 4); }

  function setMode(md) {
    var now = new Date(), a, b;
    if (md === 'week') { var dow = (now.getDay() + 6) % 7; a = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow); b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6); }
    else if (md === 'month') { a = new Date(now.getFullYear(), now.getMonth(), 1); b = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
    else if (md === 'lastmonth') { a = new Date(now.getFullYear(), now.getMonth() - 1, 1); b = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (md === 'quarter') { var q = Math.floor(now.getMonth() / 3) * 3; a = new Date(now.getFullYear(), q, 1); b = new Date(now.getFullYear(), q + 3, 0); }
    else if (md === 'year') { a = new Date(now.getFullYear(), 0, 1); b = new Date(now.getFullYear(), 11, 31); }
    else { var ds = all().map(entryDate).filter(Boolean).sort(); a = ds.length ? parse(ds[0]) : new Date(now.getFullYear(), 0, 1); b = now; }
    mode = md; range = { from: ymd(a), to: ymd(b) };
  }

  // ---------------- dựng từng thẻ ----------------
  function table(head, rows, opts) {
    opts = opts || {};
    var cg = opts.cols ? '<colgroup>' + opts.cols.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup>' : '';
    return '<div class="fq-wrap"><table class="fq-grid' + (opts.cols ? ' fq-fixed' : '') + '">' + cg + '<thead><tr>' + head.map(function (h, i) { return '<th' + (opts.num && opts.num.indexOf(i) !== -1 ? ' class="n"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '" class="fq-empty">Không có dữ liệu trong kỳ này.</td></tr>') + '</tbody>' + (opts.foot ? '<tfoot>' + opts.foot + '</tfoot>' : '') + '</table></div>';
  }
  function pill(t) { var c = { 'Tốt': 'g', 'An toàn': 'g', 'Cần chú ý': 'a', 'Rủi ro': 'r', 'Cảnh báo': 'a' }[t] || ''; return t ? '<span class="fq-pill ' + c + '">' + esc(t) + '</span>' : ''; }
  function sign(n, s) { return '<td class="n ' + (n < 0 ? 'neg' : (n > 0 ? 'pos' : '')) + '">' + s + '</td>'; }

  function metrics() {
    var list = all().filter(inRange), TM = ctx.TaskManager;
    var rev = sumT(list, 'revenue'), exp = sumT(list, 'expense'), bon = sumT(list, 'bonus'), pen = sumT(list, 'penalty'), pnl = rev - exp - bon + pen;
    var before = all().filter(function (e) { return entryDate(e) < range.from; }), opening = cashOf(before), net = cashOf(list), closing = opening + net;
    var upto = all().filter(function (e) { return entryDate(e) <= range.to; }), debt = sumT(upto, 'loan') - sumT(upto, 'repayment');
    var rcs = (TM.getReceivables && TM.getReceivables()) || [], unpaid = 0, overdue = 0;
    rcs.forEach(function (r) { var st = ctx.receivableStatus(r); if (st !== 'paid') { unpaid += num(r.amount); if (st === 'overdue') overdue += num(r.amount); } });
    return { list: list, rev: rev, exp: exp, bon: bon, pen: pen, pnl: pnl, margin: rev ? pnl / rev : 0, opening: opening, net: net, closing: closing, debt: debt, unpaid: unpaid, overdue: overdue, rcs: rcs };
  }

  function viewSum() {
    var m = metrics(), u = ctx.user || {}, now = new Date();
    var rows = [
      ['Doanh thu trong kỳ', m.rev, 'VNĐ', ''], ['Chi phí hoạt động', m.exp, 'VNĐ', ''],
      ['Lợi nhuận ròng', m.pnl, 'VNĐ', m.pnl >= 0 ? 'Tốt' : 'Rủi ro'],
      ['Biên lợi nhuận ròng', (m.margin * 100).toFixed(1) + '%', '%', m.margin >= 0.15 ? 'Tốt' : (m.margin >= 0 ? 'Cần chú ý' : 'Rủi ro')],
      ['Dòng tiền ròng trong kỳ', m.net, 'VNĐ', m.net >= 0 ? 'Tốt' : 'Rủi ro'],
      ['Tồn quỹ cuối kỳ', m.closing, 'VNĐ', m.closing >= 0 ? 'Tốt' : 'Rủi ro'],
      ['Dư nợ vay cuối kỳ', m.debt, 'VNĐ', m.debt <= 0 ? 'Tốt' : 'Cần chú ý'],
      ['Công nợ khách hàng chưa thu', m.unpaid, 'VNĐ', ''],
      ['Trong đó công nợ quá hạn', m.overdue, 'VNĐ', m.overdue === 0 ? 'Tốt' : 'Rủi ro']
    ].map(function (x, i) {
      var isNum = typeof x[1] === 'number';
      return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(x[0]) + '</td>' + (isNum ? sign(x[1], fmt(x[1])) : '<td class="n">' + x[1] + '</td>') + '<td class="c">' + x[2] + '</td><td class="c">' + pill(x[3]) + '</td></tr>';
    });
    var cmt = 'Trong kỳ, công ty ' + (m.pnl >= 0 ? 'có lãi ' : 'bị lỗ ') + fmt(Math.abs(m.pnl)) + ' đồng trên doanh thu ' + fmt(m.rev) + ' đồng (biên lợi nhuận ' + (m.margin * 100).toFixed(1) + '%). Dòng tiền ròng ' + (m.net >= 0 ? 'dương ' : 'âm ') + fmt(Math.abs(m.net)) + ' đồng, tồn quỹ cuối kỳ ' + fmt(m.closing) + ' đồng. Dư nợ vay ' + fmt(m.debt) + ' đồng; công nợ khách hàng chưa thu ' + fmt(m.unpaid) + ' đồng' + (m.overdue ? ', trong đó quá hạn ' + fmt(m.overdue) + ' đồng' : '') + '.';
    return '<div class="fq-doc"><div class="fq-hd"><div class="l"><b>' + COMPANY + '</b><span>Số: ....../BC-TC</span></div><div class="r"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><b>Độc lập - Tự do - Hạnh phúc</b><i>Hải Phòng, ngày ' + now.getDate() + ' tháng ' + (now.getMonth() + 1) + ' năm ' + now.getFullYear() + '</i></div></div>' +
      '<h2 class="fq-title">BÁO CÁO TÀI CHÍNH</h2><div class="fq-sub"><b>Kỳ báo cáo: từ ngày ' + vn(range.from) + ' đến ngày ' + vn(range.to) + '</b><i>Kính gửi: Ban Giám đốc / Chủ sở hữu Công ty</i></div>' +
      '<h3 class="fq-sec">I. CÁC CHỈ TIÊU TÀI CHÍNH CHỦ YẾU</h3>' + table(['STT', 'Chỉ tiêu', 'Giá trị', 'Đơn vị', 'Đánh giá'], rows, { num: [2] }) +
      '<h3 class="fq-sec">II. NHẬN XÉT</h3><p class="fq-p">' + esc(cmt) + '</p>' +
      '<div class="fq-sign"><div><b>NGƯỜI LẬP BIỂU</b><i>(Ký, ghi rõ họ tên)</i><span>' + esc(u.name || '') + '</span></div><div><b>KẾ TOÁN TRƯỞNG</b><i>(Ký, ghi rõ họ tên)</i></div><div><b>GIÁM ĐỐC</b><i>(Ký, đóng dấu, ghi rõ họ tên)</i></div></div></div>';
  }

  function viewTx() {
    var TYPES = ctx.TYPES, list = all().filter(inRange).sort(function (a, b) { return entryDate(a).localeCompare(entryDate(b)); }), tot = 0, tp = 0;
    var rows = list.map(function (e) {
      var t = TYPES[e.type] || { label: e.type, cashSign: 0, pnlSign: 0 }, a = num(e.amount), cf = a * t.cashSign, pl = a * t.pnlSign; tot += a; tp += pl;
      return '<tr><td>' + esc(t.label) + '</td><td>' + esc(e.category || '') + '</td><td>' + esc(e.description || '') + '</td><td class="c">' + vn(entryDate(e)) + '</td><td class="c">' + mm(entryDate(e).slice(0, 7)) + '</td><td class="n">' + fmt(a) + '</td>' + sign(cf, fmt(cf)) + sign(pl, fmt(pl)) + '<td>' + esc(e.voucherNo || '') + '</td><td class="c">' + esc(e.account || '111') + '</td><td class="c">' + esc(counterCode(e)) + '</td><td>' + esc(e.actor || '') + '</td></tr>';
    });
    return '<h3 class="fq-sec">SỔ GIAO DỊCH</h3>' + table(['Loại', 'Danh mục', 'Mô tả', 'Ngày', 'Tháng', 'Số tiền (₫)', 'Ảnh hưởng dòng tiền', 'Ảnh hưởng lãi/lỗ', 'Số phiếu', 'TK quỹ', 'TK đối ứng', 'Người giao dịch'], rows, { num: [5, 6, 7], foot: '<tr><td colspan="5">TỔNG (theo kỳ)</td><td class="n">' + fmt(tot) + '</td><td class="n">' + fmt(cashOf(list)) + '</td><td class="n">' + fmt(tp) + '</td><td colspan="4"></td></tr>' });
  }

  function viewLedger(acc) {
    var TYPES = ctx.TYPES, ex = all().filter(function (e) { return TYPES[e.type] && TYPES[e.type].cashSign !== 0 && String(e.account || '111') === acc; }).sort(function (a, b) { return entryDate(a).localeCompare(entryDate(b)); });
    var opening = 0; ex.forEach(function (e) { if (entryDate(e) < range.from) opening += TYPES[e.type].cashSign * num(e.amount); });
    var rows = ex.filter(inRange), run = opening, sIn = 0, sOut = 0, by = {};
    var body = ['<tr class="fq-soft"><td colspan="9"><b>Số dư đầu kỳ</b></td><td class="n ' + (opening < 0 ? 'neg' : '') + '"><b>' + fmt(opening) + '</b></td><td></td></tr>'];
    rows.forEach(function (e) {
      var s = TYPES[e.type].cashSign, a = num(e.amount), isIn = s > 0, code = counterCode(e); run += s * a; if (isIn) sIn += a; else sOut += a;
      var k = code || 'Chưa gán', o = by[k] = by[k] || { n: 0, i: 0, o: 0 }; o.n++; if (isIn) o.i += a; else o.o += a;
      body.push('<tr><td class="c">' + vn(entryDate(e)) + '</td><td class="c">' + vn(e.voucherDate || entryDate(e)) + '</td><td>' + (isIn ? esc(e.voucherNo || '') : '') + '</td><td>' + (isIn ? '' : esc(e.voucherNo || '')) + '</td><td>' + esc(e.description || e.category || '') + '</td><td class="c">' + acc + '</td><td class="c">' + esc(code) + '</td><td class="n">' + fmt(isIn ? a : 0) + '</td><td class="n">' + fmt(isIn ? 0 : a) + '</td><td class="n ' + (run < 0 ? 'neg' : '') + '">' + fmt(run) + '</td><td>' + esc(e.actor || '') + '</td></tr>');
    });
    var names = window.HQ_ACCT || [], nm = function (k) { for (var i = 0; i < names.length; i++) if (names[i][0] === k) return names[i][1]; return ''; };
    var byRows = Object.keys(by).sort().map(function (k) { return '<tr><td class="c"><b>' + k + '</b></td><td colspan="3">' + esc(nm(k) || (k === 'Chưa gán' ? 'Chưa gán TK đối ứng — nên bổ sung' : '')) + '</td><td class="c">' + by[k].n + '</td><td class="n">' + fmt(by[k].i) + '</td><td class="n">' + fmt(by[k].o) + '</td></tr>'; });
    return '<h3 class="fq-sec">SỔ KẾ TOÁN CHI TIẾT ' + (acc === '111' ? 'QUỸ TIỀN MẶT' : 'TIỀN GỬI NGÂN HÀNG') + ' — TK ' + acc + '</h3>' +
      table(['Ngày hạch toán', 'Ngày chứng từ', 'Số phiếu thu', 'Số phiếu chi', 'Diễn giải', 'TK quỹ', 'TK đối ứng', 'Phát sinh Nợ', 'Phát sinh Có', 'Số tồn', 'Người nhận / nộp'], body, { cols: [8, 8, 9, 9, 19, 4.5, 6, 9, 9, 9, 10.5], num: [7, 8, 9], foot: '<tr><td colspan="7">CỘNG PHÁT SINH TRONG KỲ / SỐ DƯ CUỐI KỲ</td><td class="n">' + fmt(sIn) + '</td><td class="n">' + fmt(sOut) + '</td><td class="n ' + (run < 0 ? 'neg' : '') + '">' + fmt(run) + '</td><td></td></tr>' }) +
      '<h3 class="fq-sec">TỔNG HỢP THEO TK ĐỐI ỨNG</h3>' + table(['TK đối ứng', 'Tên tài khoản', '', '', 'Số dòng', 'Thu (Nợ)', 'Chi (Có)'], byRows, { cols: [10, 22, 12, 12, 10, 17, 17], num: [4, 5, 6] });
  }

  function viewPnl() {
    var list = all().filter(inRange), rows = [], tR = 0, tE = 0, tB = 0, tP = 0, prev = null;
    months(range.from, range.to).forEach(function (mo) {
      var ml = list.filter(function (e) { return entryDate(e).slice(0, 7) === mo; }), r = sumT(ml, 'revenue'), x = sumT(ml, 'expense'), b = sumT(ml, 'bonus'), p = sumT(ml, 'penalty'), n = r - x - b + p;
      tR += r; tE += x; tB += b; tP += p;
      rows.push('<tr><td class="c">' + mm(mo) + '</td><td class="n">' + fmt(r) + '</td><td class="n">' + fmt(x) + '</td><td class="n">' + fmt(b) + '</td><td class="n">' + fmt(p) + '</td>' + sign(n, fmt(n)) + '<td class="n">' + (r ? (n / r * 100).toFixed(1) + '%' : '—') + '</td>' + (prev === null ? '<td class="n">—</td>' : sign(n - prev, fmt(n - prev))) + '<td class="n">' + fmt(r - x) + '</td></tr>');
      prev = n;
    });
    var nT = tR - tE - tB + tP;
    return '<h3 class="fq-sec">BÁO CÁO LÃI / LỖ THEO THÁNG</h3>' + table(['Tháng', 'Doanh thu', '(−) Chi phí hoạt động', '(−) Thưởng nhân viên', '(+) Phạt thu về', 'Lợi nhuận ròng', 'Biên lợi nhuận', 'Tăng/giảm LN so tháng trước', 'Doanh thu − Chi phí'], rows, { num: [1, 2, 3, 4, 5, 6, 7, 8], foot: '<tr><td>TỔNG KỲ</td><td class="n">' + fmt(tR) + '</td><td class="n">' + fmt(tE) + '</td><td class="n">' + fmt(tB) + '</td><td class="n">' + fmt(tP) + '</td><td class="n ' + (nT < 0 ? 'neg' : 'pos') + '">' + fmt(nT) + '</td><td class="n">' + (tR ? (nT / tR * 100).toFixed(1) + '%' : '—') + '</td><td></td><td class="n">' + fmt(tR - tE) + '</td></tr>' });
  }

  function viewCf() {
    var TYPES = ctx.TYPES, before = all().filter(function (e) { return entryDate(e) < range.from; }), run = cashOf(before), list = all().filter(inRange), rows = [], sumIn = 0, sumOut = 0;
    months(range.from, range.to).forEach(function (mo) {
      var ml = list.filter(function (e) { return entryDate(e).slice(0, 7) === mo; }), i = 0, o = 0;
      ml.forEach(function (e) { var t = TYPES[e.type]; if (!t) return; var c = t.cashSign * num(e.amount); if (c > 0) i += c; else o -= c; });
      run += i - o; sumIn += i; sumOut += o;
      rows.push('<tr><td class="c">' + mm(mo) + '</td><td class="n">' + fmt(i) + '</td><td class="n">' + fmt(o) + '</td>' + sign(i - o, fmt(i - o)) + sign(run, fmt(run)) + '</tr>');
    });
    var avg = rows.length ? (sumIn - sumOut) / rows.length : 0, fc = [], d = parse(range.to);
    for (var k = 1; k <= 3; k++) { var dm = new Date(d.getFullYear(), d.getMonth() + k, 1); fc.push('<tr><td class="c">' + pad(dm.getMonth() + 1) + '/' + dm.getFullYear() + ' (+' + k + ')</td><td></td><td></td>' + sign(avg, fmt(avg)) + sign(run + avg * k, fmt(run + avg * k)) + '</tr>'); }
    return '<h3 class="fq-sec">DÒNG TIỀN &amp; DỰ BÁO</h3><p class="fq-p">Số dư đầu kỳ (luỹ kế các giao dịch trước ' + vn(range.from) + '): <b>' + fmt(cashOf(before)) + '</b></p>' +
      table(['Tháng', 'Tiền vào', 'Tiền ra', 'Dòng tiền ròng', 'Tồn quỹ cuối tháng'], rows, { num: [1, 2, 3, 4], foot: '<tr><td>TỔNG KỲ</td><td class="n">' + fmt(sumIn) + '</td><td class="n">' + fmt(sumOut) + '</td>' + sign(sumIn - sumOut, fmt(sumIn - sumOut)) + sign(run, fmt(run)) + '</tr>' }) +
      '<h3 class="fq-sec">DỰ BÁO 3 THÁNG TỚI</h3>' + table(['Tháng dự báo', '', '', 'Thay đổi dự kiến (TB dòng tiền ròng/tháng)', 'Tồn quỹ dự báo'], fc, { num: [3, 4] });
  }

  function viewRc() {
    var rows = ((ctx.TaskManager.getReceivables && ctx.TaskManager.getReceivables()) || []).map(function (r) {
      var st = ctx.receivableStatus(r), lb = (ctx.STATUS_LABEL || {})[st] || st;
      return '<tr><td>' + esc(r.clientName || '') + '</td><td>' + esc(r.projectId || '') + '</td><td>' + esc(r.description || '') + '</td><td class="c">' + vn(r.dueDate) + '</td><td class="n">' + fmt(r.amount) + '</td><td class="c">' + pill(st === 'paid' ? 'Tốt' : (st === 'overdue' ? 'Rủi ro' : 'Cần chú ý')).replace(/>[^<]*</, '>' + esc(lb) + '<') + '</td></tr>';
    });
    return '<h3 class="fq-sec">CÔNG NỢ KHÁCH HÀNG</h3>' + table(['Khách hàng', 'Dự án', 'Mô tả', 'Hạn thu', 'Số tiền', 'Trạng thái'], rows, { num: [4] });
  }

  // ---------------- khung cửa sổ ----------------
  var CSS = '.fq-ov{position:fixed;inset:0;z-index:520;background:rgba(10,12,15,.55);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:3vh 12px;overflow-y:auto}' +
    '.fq-box{width:100%;max-width:1180px;background:var(--fn-bg,#f7f4ef);border:1px solid var(--fn-border,#e1dacd);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:fnDtIn .22s ease}' +
    '.fq-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--fn-border,#e1dacd)}.fq-top h2{margin:0;font-size:1.05rem}.fq-x{background:none;border:none;font-size:1.6rem;color:var(--fn-muted,#888);cursor:pointer;line-height:1}' +
    '.fq-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 20px;border-bottom:1px solid var(--fn-border,#e1dacd)}.fq-chip{padding:6px 12px;border-radius:16px;border:1px solid var(--fn-border,#e1dacd);background:var(--fn-surface,#fff);color:var(--fn-text,#222);font:600 .75rem inherit;cursor:pointer}.fq-chip.on{background:var(--fn-bronze,#b08d57);border-color:var(--fn-bronze,#b08d57);color:#fff}.fq-bar input{padding:6px 8px;border:1px solid var(--fn-border,#e1dacd);border-radius:8px;background:var(--fn-surface,#fff);color:var(--fn-text,#222);font:inherit;font-size:.75rem}' +
    '.fq-tabs{display:flex;gap:2px;padding:10px 20px 0;overflow-x:auto;border-bottom:1px solid var(--fn-border,#e1dacd)}.fq-tab{padding:8px 14px;border:1px solid transparent;border-bottom:none;border-radius:8px 8px 0 0;background:none;color:var(--fn-muted,#777);font:600 .8125rem inherit;cursor:pointer;white-space:nowrap}.fq-tab.on{background:var(--fn-surface,#fff);border-color:var(--fn-border,#e1dacd);color:var(--fn-bronze,#b08d57)}' +
    '.fq-body{padding:16px 20px 22px;background:var(--fn-surface,#fff);border-radius:0 0 16px 16px;overscroll-behavior:contain}' +
    '.fq-doc{max-width:860px;margin:0 auto;font-family:"Times New Roman",Times,serif;color:var(--fn-text,#222)}.fq-hd{display:flex;justify-content:space-between;gap:16px;margin-bottom:14px;font-size:.8125rem}.fq-hd .l,.fq-hd .r{display:flex;flex-direction:column;gap:2px}.fq-hd .l{max-width:46%;text-align:center}.fq-hd .r{text-align:center;align-items:center}.fq-hd i{align-self:flex-end;margin-top:6px}' +
    '.fq-title{text-align:center;margin:18px 0 4px;font-size:1.5rem;letter-spacing:.04em}.fq-sub{text-align:center;display:flex;flex-direction:column;gap:2px;margin-bottom:12px}.fq-sec{margin:18px 0 8px;font-size:.9375rem}' +
    '.fq-p{line-height:1.6;text-align:justify;font-size:.875rem}.fq-sign{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;margin-top:26px}.fq-sign div{display:flex;flex-direction:column;gap:2px;min-height:110px}.fq-sign span{margin-top:auto;font-weight:700}' +
    '.fq-wrap{overflow:auto;border:1px solid var(--fn-border,#e1dacd);border-radius:8px;max-height:60vh;overscroll-behavior:contain}' +
    '.fq-grid{width:100%;border-collapse:collapse;font:400 .8125rem Inter,system-ui,sans-serif;color:var(--fn-text,#222)}.fq-grid th{position:sticky;top:0;background:#22272E;color:#fff;font-weight:700;padding:9px 10px;text-align:center;border-bottom:2px solid var(--fn-bronze,#b08d57);white-space:nowrap}.fq-grid td{padding:7px 10px;border:1px solid #E1DACD;vertical-align:middle;overflow-wrap:anywhere}.fq-grid tbody tr:nth-child(even){background:#FAF7F2}.fq-grid .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.fq-grid .c{text-align:center;white-space:nowrap}.fq-grid .pos{color:#1F6B3A}.fq-grid .neg{color:#B5402A;font-weight:700}' +
    '.fq-fixed{table-layout:fixed;font-size:.75rem!important}.fq-fixed th{white-space:normal!important;padding:8px 5px!important;font-size:.6875rem;line-height:1.25}.fq-fixed td{padding:6px 5px!important}.fq-fixed .c{white-space:nowrap}.fq-fixed .n{white-space:nowrap}.fq-grid tfoot td{background:#F2EBDD;font-weight:700;border-top:2px solid var(--fn-bronze,#b08d57)}.fq-soft td{background:#F2EBDD!important}.fq-empty{text-align:center;color:#888;padding:18px!important}' +
    '.fq-pill{display:inline-block;min-width:74px;padding:2px 10px;border-radius:4px;font-weight:700;font-size:.75rem;background:#E4E1DA;color:#6B675C}.fq-pill.g{background:#CFE8D5;color:#1F6B3A}.fq-pill.a{background:#F9E6B4;color:#8A6210}.fq-pill.r{background:#F6C9C0;color:#B5402A}' +
    '@media(max-width:700px){.fq-hd{flex-direction:column}.fq-hd .l{max-width:none}.fq-sign{grid-template-columns:1fr}}';

  function render() {
    var views = { sum: viewSum, tx: viewTx, l111: function () { return viewLedger('111'); }, l112: function () { return viewLedger('112'); }, pnl: viewPnl, cf: viewCf, rc: viewRc };
    var chips = [['week', 'Tuần này'], ['month', 'Tháng này'], ['lastmonth', 'Tháng trước'], ['quarter', 'Quý này'], ['year', 'Năm nay'], ['all', 'Toàn bộ']];
    box.querySelector('.fq-bar').innerHTML = chips.map(function (c) { return '<button type="button" class="fq-chip' + (mode === c[0] ? ' on' : '') + '" data-md="' + c[0] + '">' + c[1] + '</button>'; }).join('') +
      '<span style="margin-left:auto;display:flex;gap:6px;align-items:center;font-size:.75rem">Từ <input type="date" data-f="from" value="' + range.from + '"> đến <input type="date" data-f="to" value="' + range.to + '"></span>';
    box.querySelector('.fq-tabs').innerHTML = TABS.map(function (t) { return '<button type="button" class="fq-tab' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    box.querySelector('.fq-body').innerHTML = views[tab]();
  }

  function close() { var o = document.getElementById('fqOverlay'); if (o) o.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function open(context, monthStr) {
    ctx = context; close();
    if (!document.getElementById('fqCss')) { var st = document.createElement('style'); st.id = 'fqCss'; st.textContent = CSS; document.head.appendChild(st); }
    mode = 'month'; tab = 'sum';
    if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) { var y = +monthStr.slice(0, 4), m = +monthStr.slice(5) - 1; range = { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) }; mode = 'custom'; } else setMode('month');
    var ov = document.createElement('div'); ov.className = 'fq-ov'; ov.id = 'fqOverlay';
    ov.innerHTML = '<div class="fq-box" role="dialog" aria-modal="true"><div class="fq-top"><h2>Báo cáo nhanh</h2><div style="display:flex;gap:10px;align-items:center"><button type="button" class="fn-btn fn-btn-ghost" data-xl>Xuất Excel</button><button type="button" class="fq-x" data-close aria-label="Đóng">&times;</button></div></div><div class="fq-bar"></div><div class="fq-tabs"></div><div class="fq-body"></div></div>';
    document.body.appendChild(ov); box = ov.querySelector('.fq-box');
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab],[data-md],[data-close],[data-xl]'); if (!t) return;
      if (t.hasAttribute('data-close')) close();
      else if (t.hasAttribute('data-xl')) { close(); if (window.FinanceExport) FinanceExport.open(ctx); }
      else if (t.hasAttribute('data-tab')) { tab = t.getAttribute('data-tab'); render(); }
      else { setMode(t.getAttribute('data-md')); render(); }
    });
    ov.addEventListener('change', function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (!f || !e.target.value) return; range[f] = e.target.value; if (range.from > range.to) { var t = range.from; range.from = range.to; range.to = t; } mode = 'custom'; render(); });
    document.addEventListener('keydown', onKey);
    render();
  }
  return { open: open };
})();
