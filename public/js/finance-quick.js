/**
 * Báo cáo nhanh — xem trực tiếp trên web, bố cục & số liệu GIỐNG file Excel "Xuất báo cáo" (2026-09-30).
 * Cửa sổ có chọn kỳ (Tuần/Tháng/Quý/Năm/Toàn bộ hoặc từ–đến ngày) và các thẻ: Tổng hợp · Giao dịch · Sổ quỹ 111 · Sổ TGNH 112 · Lãi-Lỗ · Dòng tiền · Công nợ.
 * Dùng chung dữ liệu với trang (ctx do finance.html truyền vào: TaskManager, TYPES, TYPE_ORDER, receivableStatus, STATUS_LABEL, user).
 */
var FinanceQuick = (function () {
  'use strict';
  var COMPANY = 'CÔNG TY TNHH THIẾT KẾ VÀ XÂY DỰNG HICONIQUE';
  var ctx = null, box = null, range = { from: '', to: '' }, mode = 'month', tab = 'sum';
  var TABS = [['sum', 'Tổng hợp'], ['ov', 'Tổng quan'], ['tx', 'Giao dịch'], ['l111', 'Sổ quỹ 111'], ['l112', 'Sổ TGNH 112'], ['pnl', 'Lãi-Lỗ'], ['cf', 'Dòng tiền'], ['debt', 'Vay nợ'], ['rc', 'Công nợ'], ['hl', 'Sức khỏe TC'], ['bs', 'BCTC'], ['rk', 'Rủi ro'], ['pr', 'Tham số']];

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
    return '<div class="fq-wrap"><table class="fq-grid' + (opts.cols ? ' fq-fixed' : '') + (opts.cards ? ' fq-cards' : '') + '">' + cg + '<thead><tr>' + head.map(function (h, i) { return '<th' + (opts.num && opts.num.indexOf(i) !== -1 ? ' class="n"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
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
      body.push('<tr><td class="c" data-l="Ngày HT">' + vn(entryDate(e)) + '</td><td class="c" data-l="Ngày CT">' + vn(e.voucherDate || entryDate(e)) + '</td>' +
        '<td data-l="Phiếu thu">' + (isIn ? esc(e.voucherNo || '') : '') + '</td><td data-l="Phiếu chi">' + (isIn ? '' : esc(e.voucherNo || '')) + '</td><td data-l="Diễn giải">' + esc(e.description || e.category || '') + '</td>' +
        '<td class="c" data-l="TK quỹ">' + acc + '</td><td class="c" data-l="TK đối ứng">' + esc(code) + '</td><td class="n" data-l="Nợ (thu)">' + fmt(isIn ? a : 0) + '</td><td class="n" data-l="Có (chi)">' + fmt(isIn ? 0 : a) + '</td>' +
        '<td class="n ' + (run < 0 ? 'neg' : '') + '" data-l="Số tồn">' + fmt(run) + '</td><td data-l="Người">' + esc(e.actor || '') + '</td></tr>');
    });
    var names = window.HQ_ACCT || [], nm = function (k) { for (var i = 0; i < names.length; i++) if (names[i][0] === k) return names[i][1]; return ''; };
    var byRows = Object.keys(by).sort().map(function (k) { return '<tr><td class="c"><b>' + k + '</b></td><td colspan="3">' + esc(nm(k) || (k === 'Chưa gán' ? 'Chưa gán TK đối ứng — nên bổ sung' : '')) + '</td><td class="c">' + by[k].n + '</td><td class="n">' + fmt(by[k].i) + '</td><td class="n">' + fmt(by[k].o) + '</td></tr>'; });
    return '<h3 class="fq-sec">SỔ KẾ TOÁN CHI TIẾT ' + (acc === '111' ? 'QUỸ TIỀN MẶT' : 'TIỀN GỬI NGÂN HÀNG') + ' — TK ' + acc + '</h3>' +
      table(['Ngày hạch toán', 'Ngày chứng từ', 'Số phiếu thu', 'Số phiếu chi', 'Diễn giải', 'TK quỹ', 'TK đối ứng', 'Phát sinh Nợ', 'Phát sinh Có', 'Số tồn', 'Người nhận / nộp'], body, { cards: true, cols: [8, 8, 9, 9, 19, 4.5, 6, 9, 9, 9, 10.5], num: [7, 8, 9], foot: '<tr><td colspan="7">CỘNG PHÁT SINH TRONG KỲ / SỐ DƯ CUỐI KỲ</td><td class="n">' + fmt(sIn) + '</td><td class="n">' + fmt(sOut) + '</td><td class="n ' + (run < 0 ? 'neg' : '') + '">' + fmt(run) + '</td><td></td></tr>' }) +
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


  // ================= CÁC THẺ CÒN LẠI (Tổng quan · Vay nợ · Sức khỏe TC · BCTC · Rủi ro · Tham số) =================
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + '%'; }
  function dv(a, b) { return b ? a / b : 0; }
  function kvRows(rows) { return rows.map(function (x) { return '<tr' + (x.bold ? ' class="fq-b"' : '') + '><td>' + esc(x[0]) + '</td><td class="n ' + (typeof x[1] === 'number' ? (x[1] < 0 ? 'neg' : '') : '') + '">' + (typeof x[1] === 'number' ? fmt(x[1]) : x[1]) + '</td><td class="fq-dim">' + esc(x[2] || '') + '</td>' + (x.length > 3 ? '<td class="c">' + x[3] + '</td>' : '') + '</tr>'; }); }
  function lvlPill(l) { var c = { 'Cao': 'r', 'Trung bình': 'a', 'Thấp': 'g' }[l] || ''; return '<span class="fq-pill ' + c + '">' + esc(l) + '</span>'; }
  function calc() {
    var m = metrics(), all_ = all(), TM = ctx.TaskManager, toMonth = range.to.slice(0, 7), year = range.to.slice(0, 4);
    var upto = all_.filter(function (e) { return entryDate(e) <= range.to; });
    var m3 = months(ymd(new Date(parse(range.to).getFullYear(), parse(range.to).getMonth() - 2, 1)), range.to);
    var e3 = all_.filter(function (e) { return m3.indexOf(entryDate(e).slice(0, 7)) !== -1; });
    var h = { rev: sumT(e3, 'revenue'), exp: sumT(e3, 'expense'), bon: sumT(e3, 'bonus'), pen: sumT(e3, 'penalty'), cash: cashOf(upto), debt: sumT(upto, 'loan') - sumT(upto, 'repayment'), m3: m3 };
    h.ln = h.rev - h.exp - h.bon + h.pen; h.margin = h.rev ? h.ln / h.rev * 100 : 0; h.expRatio = h.rev ? h.exp / h.rev * 100 : (h.exp > 0 ? 100 : 0); h.debtRatio = h.rev ? h.debt / h.rev * 100 : (h.debt > 0 ? 100 : 0);
    h.avgExp = h.exp / 3; h.runway = h.avgExp > 0 ? h.cash / h.avgExp : (h.cash > 0 ? 12 : 0);
    var snap = (TM.getBsSnapshotByYear && TM.getBsSnapshotByYear(year)) || {}, ye = all_.filter(function (e) { return entryDate(e).slice(0, 4) === year; });
    var S = function (k) { return num(snap[k]); };
    var b = { tsnh: S('shortTermAssets'), tonkho: S('inventory'), tongts: S('totalAssets'), nonh: S('shortTermLiabilities'), vaynh: S('shortTermDebt'), vaydh: S('longTermDebt'), tongno: S('totalLiabilities'), vcsh: S('equity'), laivay: S('interestExpense'), capex: S('capex'), vonhoa: S('marketCap'), lnck: S('retainedEarnings'),
      dt: sumT(ye, 'revenue'), gv: sumT(ye, 'expense'), thuong: sumT(ye, 'bonus'), phat: sumT(ye, 'penalty'), vayY: sumT(ye, 'loan'), traY: sumT(ye, 'repayment'), tien: h.cash, phaithu: m.unpaid };
    b.lg = b.dt - b.gv; b.ebit = b.lg - b.thuong + b.phat; b.lnst = b.ebit - b.laivay;
    var r = { cur: dv(b.tsnh, b.nonh), quick: dv(b.tsnh - b.tonkho, b.nonh), cash: dv(b.tien, b.nonh), dta: dv(b.tongno, b.tongts), dte: dv(b.vaynh + b.vaydh, b.vcsh), icr: b.laivay > 0 ? dv(b.lnst + b.laivay, b.laivay) : null, dso: b.dt > 0 ? b.phaithu * 365 / b.dt : 0, dio: b.gv > 0 ? b.tonkho * 365 / b.gv : 0, gpm: dv(b.lg, b.dt), npm: dv(b.lnst, b.dt), roa: dv(b.lnst, b.tongts), roe: dv(b.lnst, b.vcsh) };
    var z = { x1: dv(b.tsnh - b.nonh, b.tongts), x2: dv(b.lnck, b.tongts), x3: dv(b.ebit, b.tongts), x4: dv(b.vonhoa > 0 ? b.vonhoa : b.vcsh, b.tongno), x5: dv(b.dt, b.tongts) };
    z.z = 1.2 * z.x1 + 1.4 * z.x2 + 3.3 * z.x3 + 0.6 * z.x4 + z.x5;
    var overdueCount = m.rcs.filter(function (x) { return ctx.receivableStatus(x) === 'overdue'; }).length;
    return { m: m, h: h, b: b, r: r, z: z, year: year, toMonth: toMonth, hasBal: S('totalAssets') > 0 && S('shortTermLiabilities') > 0, overdueCount: overdueCount, idle: sumT(m.list, 'idle') + sumT(m.list, 'undisbursed') };
  }

  function viewOv() {
    var c = calc(), m = c.m, cats = {};
    m.list.filter(function (e) { return e.type === 'expense'; }).forEach(function (e) { var k = e.category || '(chưa phân loại)'; cats[k] = (cats[k] || 0) + num(e.amount); });
    var names = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).slice(0, 15);
    var rows = kvRows([['Doanh thu trong kỳ', m.rev, 'Loại = Doanh thu'], ['Chi phí hoạt động', m.exp, 'Loại = Chi phí'], ['Thưởng nhân viên', m.bon, ''], ['Phạt nhân viên thu về', m.pen, ''], { 0: 'Lợi nhuận ròng', 1: m.pnl, 2: '= Doanh thu − Chi phí − Thưởng + Phạt', bold: true, length: 3 }, ['Biên lợi nhuận ròng', pct(m.margin), '= Lợi nhuận ròng / Doanh thu'],
      ['Dòng tiền ròng trong kỳ', m.net, 'Σ ảnh hưởng dòng tiền'], ['Số dư đầu kỳ', m.opening, 'Luỹ kế các giao dịch trước ngày bắt đầu'], { 0: 'Tồn quỹ cuối kỳ', 1: m.closing, 2: '= Số dư đầu kỳ + Dòng tiền ròng', bold: true, length: 3 },
      ['Vay nhận trong kỳ', sumT(m.list, 'loan'), ''], ['Trả nợ trong kỳ', sumT(m.list, 'repayment'), ''], { 0: 'Dư nợ cuối kỳ', 1: m.debt, 2: 'Xem thẻ Vay nợ', bold: true, length: 3 }, ['Tiền ứ đọng / chưa giải ngân (trong kỳ)', c.idle, ''],
      ['Công nợ khách hàng chưa thu', m.unpaid, ''], ['Trong đó quá hạn', m.overdue, ''], ['Số giao dịch trong kỳ', String(m.list.length), ''], ['Z-Score năm ' + c.year, c.hasBal ? c.z.z.toFixed(2) : '0.00', c.hasBal ? '> 2,99 An toàn · < 1,81 Nguy hiểm' : 'Chưa nhập bảng cân đối kế toán']]);
    var tot = m.exp || 0;
    var catRows = names.map(function (n) { return '<tr><td>' + esc(n) + '</td><td class="n">' + fmt(cats[n]) + '</td><td class="n">' + pct(dv(cats[n], tot)) + '</td></tr>'; });
    return '<h3 class="fq-sec">BÁO CÁO TÀI CHÍNH — HICONIQUE</h3>' + table(['Chỉ tiêu', 'Giá trị', 'Công thức / ghi chú'], rows, { num: [1] }) + '<h3 class="fq-sec">CHI PHÍ THEO DANH MỤC</h3>' + table(['Danh mục', 'Chi phí', 'Tỉ trọng'], catRows, { num: [1, 2] });
  }

  function viewDebt() {
    var upto0 = all().filter(function (e) { return entryDate(e) < range.from; }), open = sumT(upto0, 'loan') - sumT(upto0, 'repayment');
    var ls = all().filter(inRange).filter(function (e) { return e.type === 'loan' || e.type === 'repayment'; }).sort(function (a, b) { return entryDate(a).localeCompare(entryDate(b)); }), run = open, li = 0, lo = 0;
    var rows = ls.map(function (e) { var a = num(e.amount), isL = e.type === 'loan'; run += isL ? a : -a; if (isL) li += a; else lo += a; return '<tr><td>' + esc(ctx.TYPES[e.type].label) + '</td><td class="c">' + vn(entryDate(e)) + '</td><td>' + esc(e.description || e.category || '') + '</td><td class="n">' + fmt(a) + '</td><td class="n ' + (run > 0 ? 'neg' : '') + '">' + fmt(run) + '</td></tr>'; });
    return '<h3 class="fq-sec">VAY NỢ &amp; TRẢ NỢ</h3><p class="fq-p">Dư nợ đầu kỳ (Vay − Trả các giao dịch trước ' + vn(range.from) + '): <b>' + fmt(open) + '</b></p>' + table(['Loại', 'Ngày', 'Mô tả', 'Số tiền', 'Dư nợ luỹ kế'], rows, { num: [3, 4], foot: '<tr><td colspan="3">Tổng vay nhận <b>' + fmt(li) + '</b> · Tổng trả nợ <b>' + fmt(lo) + '</b></td><td class="n"></td><td class="n">' + fmt(open + li - lo) + '</td></tr>' });
  }

  function viewHl() {
    var c = calc(), h = c.h;
    var g = function (v, good, mid) { return v >= good ? 'Tốt' : (v >= mid ? 'Cần chú ý' : 'Rủi ro'); }, gl = function (v, good, mid) { return v <= good ? 'Tốt' : (v <= mid ? 'Cần chú ý' : 'Rủi ro'); };
    var inputs = kvRows([['Doanh thu 3 tháng', h.rev, 'Σ Doanh thu ' + h.m3.map(mm).join(', ')], ['Chi phí 3 tháng', h.exp, 'Σ Chi phí cùng 3 tháng'], ['Thưởng nhân viên 3 tháng', h.bon, ''], ['Phạt nhân viên thu về 3 tháng', h.pen, ''], ['Tiền tồn hiện có (luỹ kế toàn sổ đến ' + vn(range.to) + ')', h.cash, 'Σ Số tiền × Hệ số dòng tiền'], ['Dư nợ vay hiện tại (luỹ kế toàn sổ)', h.debt, 'Σ Vay nhận − Σ Trả nợ']]);
    var idx = [['Lợi nhuận ròng 3 tháng', fmt(h.ln), '= Doanh thu − Chi phí − Thưởng + Phạt', '', ''], ['Biên lợi nhuận (%)', h.margin.toFixed(1), '= LN ròng / Doanh thu × 100', g(h.margin, 15, 0), '≥15 Tốt · 0–15 Cần chú ý · <0 Rủi ro'], ['Tỷ lệ chi phí / doanh thu (%)', h.expRatio.toFixed(1), '= Chi phí / Doanh thu × 100', gl(h.expRatio, 70, 90), '≤70 Tốt · 70–90 Cần chú ý · >90 Rủi ro'], ['Tỷ lệ nợ / doanh thu (%)', h.debtRatio.toFixed(1), '= Dư nợ / Doanh thu × 100', gl(h.debtRatio, 30, 60), '≤30 Tốt · 30–60 Cần chú ý · >60 Rủi ro'], ['Chi phí bình quân / tháng', fmt(h.avgExp), '= Chi phí 3 tháng / 3', '', ''], ['Dự trữ tiền mặt (tháng)', h.runway.toFixed(1), '= Tiền tồn / Chi phí bình quân', g(h.runway, 3, 1), '≥3 Tốt · 1–3 Cần chú ý · <1 Rủi ro']]
      .map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td class="n">' + x[1] + '</td><td class="fq-dim">' + esc(x[2]) + '</td><td class="c">' + pill(x[3]) + '</td><td class="fq-dim">' + esc(x[4]) + '</td></tr>'; });
    var notes = [h.margin < 0 ? '• Đang lỗ 3 tháng gần nhất: rà soát đơn giá, cắt giảm chi phí phát sinh, ưu tiên thu hồi công nợ.' : (h.margin < 15 ? '• Biên lợi nhuận mỏng (<15%): xem lại chiết khấu và kiểm soát chi phí vật liệu/nhân công.' : '• Biên lợi nhuận khoẻ mạnh: duy trì kỷ luật chi phí.'),
      h.debtRatio > 60 ? '• Đòn bẩy nợ cao: ưu tiên dùng dòng tiền trả bớt nợ trước khi vay thêm.' : (h.debtRatio > 30 ? '• Theo dõi sát khoản vay: lên lịch trả nợ rõ ràng.' : '• Nợ vay ở mức an toàn so với doanh thu.'),
      h.runway < 1 ? '• Dự trữ tiền mặt rất thấp (<1 tháng): thu hồi công nợ, hạn chế chi không thiết yếu.' : (h.runway < 3 ? '• Nên tăng quỹ dự phòng (<3 tháng chi phí).' : '• Dự trữ tiền mặt đủ dùng.')];
    return '<h3 class="fq-sec">SỨC KHỎE TÀI CHÍNH (3 THÁNG KẾT THÚC ' + mm(c.toMonth) + ')</h3>' + table(['Số liệu đầu vào', 'Giá trị', 'Nguồn / công thức'], inputs, { num: [1] }) + '<h3 class="fq-sec">CHỈ SỐ</h3>' + table(['Chỉ số', 'Giá trị', 'Công thức', 'Đánh giá', 'Ngưỡng'], idx, { num: [1] }) + '<h3 class="fq-sec">NHẬN ĐỊNH TỰ ĐỘNG</h3><p class="fq-p">' + notes.map(esc).join('<br>') + '</p>';
  }

  function viewBs() {
    var c = calc(), b = c.b, r = c.r, z = c.z;
    var A = kvRows([['Tài sản ngắn hạn', b.tsnh, ''], ['Hàng tồn kho', b.tonkho, ''], ['Tổng tài sản', b.tongts, ''], ['Nợ ngắn hạn', b.nonh, ''], ['Vay ngắn hạn', b.vaynh, ''], ['Vay dài hạn', b.vaydh, ''], ['Tổng nợ phải trả', b.tongno, ''], ['Vốn chủ sở hữu', b.vcsh, ''], ['Chi phí lãi vay', b.laivay, ''], ['CAPEX (mua sắm TSCĐ)', b.capex, ''], ['Vốn hóa thị trường (0 = dùng VCSH)', b.vonhoa, ''], ['LNST chưa phân phối (lũy kế)', b.lnck, '']]);
    var B_ = kvRows([['Doanh thu thuần', b.dt, 'Σ giao dịch "Doanh thu" trong năm'], ['Giá vốn hàng bán (ước tính)', b.gv, 'Σ giao dịch "Chi phí" trong năm'], ['Thưởng nhân viên', b.thuong, ''], ['Phạt nhân viên thu về', b.phat, ''], ['Vay nhận trong năm', b.vayY, ''], ['Trả nợ gốc trong năm', b.traY, ''], ['Tiền & tương đương tiền hiện có', b.tien, 'Luỹ kế toàn sổ đến hết kỳ'], ['Phải thu ngắn hạn (công nợ chưa thu)', b.phaithu, 'Liên kết thẻ Công nợ']]);
    var C = kvRows([['Lợi nhuận gộp', b.lg, '= Doanh thu − Giá vốn'], ['EBIT (trước lãi vay & thuế)', b.ebit, '= LN gộp − Thưởng + Phạt'], ['LNST (sau lãi vay)', b.lnst, '= EBIT − Chi phí lãi vay']]);
    var f2 = function (x) { return x == null ? 'N/A' : x.toFixed(2); };
    var D = kvRows([['Hệ số thanh toán hiện hành', f2(r.cur), 'TSNH / Nợ NH'], ['Hệ số thanh toán nhanh', f2(r.quick), '(TSNH − Tồn kho) / Nợ NH'], ['Hệ số thanh toán tiền mặt', f2(r.cash), 'Tiền / Nợ NH'], ['Nợ / Tổng tài sản', pct(r.dta), 'Tổng nợ / Tổng TS'], ['Nợ vay / Vốn chủ sở hữu', f2(r.dte), '(Vay NH + Vay DH) / VCSH'], ['Hệ số chi trả lãi vay', f2(r.icr), '(LNTT + Lãi vay) / Lãi vay'], ['Số ngày thu tiền bình quân (DSO)', Math.round(r.dso), 'Phải thu × 365 / Doanh thu'], ['Số ngày tồn kho bình quân (DIO)', Math.round(r.dio), 'Tồn kho × 365 / Giá vốn'], ['Biên lợi nhuận gộp (GPM)', pct(r.gpm), 'LN gộp / Doanh thu'], ['Biên lợi nhuận ròng (NPM)', pct(r.npm), 'LNST / Doanh thu'], ['ROA', pct(r.roa), 'LNST / Tổng TS'], ['ROE', pct(r.roe), 'LNST / VCSH']]);
    var zc = z.z > 2.99 ? 'An toàn' : (z.z < 1.81 ? 'Nguy hiểm' : 'Cảnh báo');
    var E = kvRows([['X1 = (TSNH − Nợ NH) / Tổng TS', z.x1.toFixed(3), ''], ['X2 = LNST lũy kế / Tổng TS', z.x2.toFixed(3), ''], ['X3 = EBIT / Tổng TS', z.x3.toFixed(3), ''], ['X4 = Vốn hóa / Tổng nợ', z.x4.toFixed(3), ''], ['X5 = Doanh thu / Tổng TS', z.x5.toFixed(3), ''], { 0: 'Z = 1,2·X1 + 1,4·X2 + 3,3·X3 + 0,6·X4 + 1,0·X5', 1: z.z.toFixed(2), 2: '> 2,99 An toàn · 1,81–2,99 Cảnh báo · < 1,81 Nguy hiểm', bold: true, length: 3 }, ['Kết luận Z-Score', '', pill(zc === 'An toàn' ? 'Tốt' : (zc === 'Nguy hiểm' ? 'Rủi ro' : 'Cần chú ý')).replace(/>[^<]*</, '>' + zc + '<')]]);
    var cfo = b.dt - b.gv - b.thuong + b.phat, F = kvRows([['HĐ Kinh doanh (CFO)', cfo, '= Doanh thu − Giá vốn − Thưởng + Phạt'], ['HĐ Đầu tư (CFI)', -b.capex, '= − CAPEX'], ['HĐ Tài chính (CFF)', b.vayY - b.traY, '= Vay nhận − Trả nợ gốc'], { 0: 'Dòng tiền tự do (FCF)', 1: cfo - b.capex, 2: '= CFO − CAPEX', bold: true, length: 3 }]);
    var H = ['Chỉ tiêu', 'Giá trị', 'Ghi chú'];
    return '<h3 class="fq-sec">BÁO CÁO TÀI CHÍNH &amp; CHỈ SỐ — NĂM ' + c.year + '</h3>' + (c.hasBal ? '' : '<p class="fq-p">Chưa nhập bảng cân đối kế toán năm ' + c.year + ' (mục "Báo cáo tài chính" trên web) — các chỉ số thanh khoản / đòn bẩy / Z-Score sẽ bằng 0 cho tới khi nhập.</p>') +
      '<h3 class="fq-sec">A. BẢNG CÂN ĐỐI KẾ TOÁN</h3>' + table(H, A, { num: [1] }) + '<h3 class="fq-sec">B. SỐ LIỆU TỪ SỔ GIAO DỊCH NĂM ' + c.year + '</h3>' + table(H, B_, { num: [1] }) + '<h3 class="fq-sec">C. KẾT QUẢ KINH DOANH</h3>' + table(H, C, { num: [1] }) +
      '<h3 class="fq-sec">D. CHỈ SỐ TÀI CHÍNH</h3>' + table(H, D, { num: [1] }) + '<h3 class="fq-sec">E. ALTMAN Z-SCORE</h3>' + table(H, E, { num: [1] }) + '<h3 class="fq-sec">F. DÒNG TIỀN THEO HOẠT ĐỘNG</h3>' + table(H, F, { num: [1] });
  }

  function viewRk() {
    var c = calc(), r = c.r, b = c.b, h = c.h, m = c.m, rows = [];
    var lo = function (v, low, high) { return v >= low ? 'Thấp' : (v < high ? 'Cao' : 'Trung bình'); }, hi = function (v, low, high) { return v <= low ? 'Thấp' : (v > high ? 'Cao' : 'Trung bình'); };
    function add(g, n, f, v, fm, thr, lv) { rows.push([g, n, f, v, fm, thr, lv]); }
    if (c.hasBal) {
      add('Thanh khoản', 'Mất khả năng thanh toán ngắn hạn', 'TSNH / Nợ NH', r.cur, '0.00', '≥2,0 Thấp · 1,0–2,0 TB · <1,0 Cao', lo(r.cur, 2, 1));
      add('Thanh khoản', 'Không đủ tài sản dễ chuyển đổi', '(TSNH − Tồn kho) / Nợ NH', r.quick, '0.00', '≥1,0 Thấp · 0,5–1,0 TB · <0,5 Cao', lo(r.quick, 1, 0.5));
      add('Thanh khoản', 'Đệm tiền mặt quá mỏng', 'Tiền / Nợ NH', r.cash, '0.00', '≥0,2 Thấp · 0,1–0,2 TB · <0,1 Cao', lo(r.cash, 0.2, 0.1));
      add('Đòn bẩy', 'Nợ chiếm tỷ trọng quá lớn trong tài sản', 'Tổng nợ / Tổng TS', r.dta, '%', '≤65% Thấp · 65–80% TB · >80% Cao', hi(r.dta, 0.65, 0.8));
      add('Đòn bẩy', 'Vay nợ vượt vốn tự có', '(Vay NH + Vay DH) / VCSH', r.dte, '0.00', '≤1,0 Thấp · 1,0–3,0 TB · >3,0 Cao', hi(r.dte, 1, 3));
      add('Đòn bẩy', 'Không đủ khả năng trả lãi vay', '(LNTT + Lãi vay) / Lãi vay', r.icr, '0.00', '≥1,5 Thấp · 1,0–1,5 TB · <1,0 Cao', r.icr == null ? 'Thiếu dữ liệu' : lo(r.icr, 1.5, 1));
    }
    var lastM = m.list.length ? null : null, pl = 0, tm = c.toMonth;
    var ml = all().filter(function (e) { return entryDate(e).slice(0, 7) === tm; }); pl = sumT(ml, 'revenue') - sumT(ml, 'expense') - sumT(ml, 'bonus') + sumT(ml, 'penalty');
    add('Dòng tiền', 'Chi vượt thu trong tháng ' + mm(tm), 'Lãi/lỗ tháng cuối kỳ', pl, 'n', '≥0 Thấp · <0 Cao', pl >= 0 ? 'Thấp' : 'Cao');
    add('Dòng tiền', 'Tồn quỹ cuối kỳ cạn kiệt', 'Tồn quỹ cuối kỳ', m.closing, 'n', '≥0 Thấp · <0 Cao', m.closing >= 0 ? 'Thấp' : 'Cao');
    if (c.hasBal) add('Dòng tiền', 'Vốn lưu động ròng âm', 'TSNH − Nợ NH', b.tsnh - b.nonh, 'n', '≥0 Thấp · <0 Cao', b.tsnh - b.nonh >= 0 ? 'Thấp' : 'Cao');
    var rcRatio = m.unpaid > 0 ? m.overdue / m.unpaid : 0;
    add('Công nợ', 'Thu tiền khách hàng quá chậm (DSO)', 'Phải thu × 365 / Doanh thu', r.dso, '0', '<90 Thấp · 90–180 TB · >180 Cao', hi(r.dso, 90, 180));
    add('Công nợ', 'Tỉ lệ công nợ quá hạn / chưa thu', 'Quá hạn / Chưa thu', rcRatio, '%', '0% Thấp · 1–30% TB · >30% Cao', rcRatio === 0 ? 'Thấp' : (rcRatio > 0.3 ? 'Cao' : 'Trung bình'));
    add('Công nợ', 'Số khoản công nợ đã quá hạn', 'Đếm "Quá hạn"', c.overdueCount, '0', '0 Thấp · ≥1 Cao', c.overdueCount === 0 ? 'Thấp' : 'Cao');
    add('Sinh lời', 'Biên lợi nhuận gộp quá mỏng', 'LN gộp / Doanh thu', r.gpm, '%', '≥20% Thấp · 10–20% TB · <10% Cao', b.dt === 0 ? 'Thiếu dữ liệu' : lo(r.gpm, 0.2, 0.1));
    add('Sinh lời', 'Kinh doanh thua lỗ', 'LNST / Doanh thu', r.npm, '%', '≥0% Thấp · <0% Cao', r.npm >= 0 ? 'Thấp' : 'Cao');
    add('Vận hành', 'Tiền ứ đọng / chưa giải ngân (trong kỳ)', 'Σ "Tiền ứ đọng" + "Chưa giải ngân"', c.idle, 'n', '0 Thấp · >0 Cần theo dõi', c.idle === 0 ? 'Thấp' : 'Trung bình');
    add('Vận hành', 'Còn dư nợ vay chưa trả hết', 'Dư nợ cuối kỳ', m.debt, 'n', '0 Thấp · >0 Cần theo dõi', m.debt <= 0 ? 'Thấp' : 'Trung bình');
    add('Sức khỏe', 'Biên lợi nhuận 3 tháng', 'LN ròng / Doanh thu × 100', h.margin, '0.0', '≥15 Thấp · 0–15 TB · <0 Cao', lo(h.margin, 15, 0));
    add('Sức khỏe', 'Dự trữ tiền mặt (tháng)', 'Tiền tồn / Chi phí bình quân', h.runway, '0.0', '≥3 Thấp · 1–3 TB · <1 Cao', lo(h.runway, 3, 1));
    if (c.hasBal) add('Phá sản', 'Nguy cơ kiệt quệ tài chính (Altman Z)', 'Z = 1,2X1+1,4X2+3,3X3+0,6X4+X5', c.z.z, '0.00', '>2,99 Thấp · 1,81–2,99 TB · <1,81 Cao', c.z.z > 2.99 ? 'Thấp' : (c.z.z < 1.81 ? 'Cao' : 'Trung bình'));
    var cnt = { 'Cao': 0, 'Trung bình': 0, 'Thấp': 0, 'Thiếu dữ liệu': 0 };
    var body = rows.map(function (x) { cnt[x[6]] = (cnt[x[6]] || 0) + 1; var v = x[4] === '%' ? pct(x[3]) : (x[4] === 'n' ? fmt(x[3]) : (x[3] == null ? 'N/A' : Number(x[3]).toFixed(x[4] === '0' ? 0 : (x[4] === '0.0' ? 1 : 2)))); return '<tr><td>' + esc(x[0]) + '</td><td>' + esc(x[1]) + '</td><td class="fq-dim">' + esc(x[2]) + '</td><td class="n">' + v + '</td><td class="fq-dim">' + esc(x[5]) + '</td><td class="c">' + (x[6] === 'Thiếu dữ liệu' ? '<span class="fq-pill">Thiếu dữ liệu</span>' : lvlPill(x[6])) + '</td></tr>'; });
    var sum = kvRows([['Rủi ro Cao', String(cnt['Cao']), ''], ['Rủi ro Trung bình', String(cnt['Trung bình']), ''], ['Rủi ro Thấp', String(cnt['Thấp']), ''], ['Thiếu dữ liệu', String(cnt['Thiếu dữ liệu']), '']]);
    return '<h3 class="fq-sec">ĐÁNH GIÁ RỦI RO TÀI CHÍNH</h3>' + table(['Nhóm', 'Rủi ro', 'Công thức', 'Giá trị', 'Ngưỡng', 'Mức độ'], body, { num: [3] }) + '<h3 class="fq-sec">TỔNG HỢP</h3>' + table(['Mức', 'Số lượng', ''], sum, { num: [1] }) +
      (c.hasBal ? '' : '<p class="fq-p">Chưa nhập bảng cân đối kế toán năm ' + c.year + ' (mục "Báo cáo tài chính" trên web) nên các nhóm Thanh khoản / Đòn bẩy / Z-Score chưa được liệt kê.</p>');
  }

  function viewPr() {
    var TY = ctx.TYPES, mean = { revenue: 'Tiền thu từ khách — tăng dòng tiền và lợi nhuận', expense: 'Chi phí hoạt động — giảm dòng tiền và lợi nhuận', loan: 'Tiền vay nhận — tăng dòng tiền, KHÔNG phải doanh thu', repayment: 'Trả nợ gốc — giảm dòng tiền, không ảnh hưởng lãi/lỗ', bonus: 'Thưởng nhân viên — giảm dòng tiền và lợi nhuận', penalty: 'Phạt nhân viên thu về — tăng dòng tiền và lợi nhuận', idle: 'Tiền ứ đọng — chỉ theo dõi, không ảnh hưởng', undisbursed: 'Chưa giải ngân — chỉ theo dõi, không ảnh hưởng' };
    var rows = (ctx.TYPE_ORDER || Object.keys(TY)).map(function (k) { return '<tr><td>' + esc(TY[k].label) + '</td><td class="c">' + TY[k].cashSign + '</td><td class="c">' + TY[k].pnlSign + '</td><td>' + esc(mean[k] || '') + '</td></tr>'; });
    var notes = ['Lợi nhuận ròng = Doanh thu − Chi phí − Thưởng nhân viên + Phạt nhân viên thu về (khớp mục Báo cáo lãi/lỗ).', 'Dòng tiền = Σ (Số tiền × Hệ số dòng tiền).', 'Dự báo tồn quỹ = Tồn quỹ cuối kỳ + Trung bình (Doanh thu − Chi phí) các tháng trong kỳ × số tháng dự báo.', 'Số dư đầu kỳ / dư nợ đầu kỳ tính từ toàn bộ giao dịch TRƯỚC ngày bắt đầu kỳ.', 'Chỉ số BCTC (Z-Score, thanh khoản, đòn bẩy…) dùng ảnh chụp bảng cân đối năm nhập ở mục "Báo cáo tài chính".'];
    return '<h3 class="fq-sec">THAM SỐ &amp; GHI CHÚ CÔNG THỨC</h3>' + table(['Loại giao dịch', 'Hệ số dòng tiền', 'Hệ số lãi/lỗ', 'Ý nghĩa'], rows) + '<h3 class="fq-sec">QUY ƯỚC</h3><p class="fq-p">' + notes.map(function (n) { return '• ' + esc(n); }).join('<br>') + '</p>';
  }

  // ---------------- khung cửa sổ ----------------
  var CSS = '.fq-ov{position:fixed;inset:0;z-index:520;background:rgba(10,12,15,.55);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:3vh 12px;overflow-y:auto}' +
    '.fq-box{width:100%;max-width:min(1500px,97vw);background:var(--fn-bg,#f7f4ef);border:1px solid var(--fn-border,#e1dacd);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:fnDtIn .22s ease}' +
    '.fq-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--fn-border,#e1dacd)}.fq-top h2{margin:0;font-size:1.05rem}.fq-x{background:none;border:none;font-size:1.6rem;color:var(--fn-muted,#888);cursor:pointer;line-height:1}' +
    '.fq-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 20px;border-bottom:1px solid var(--fn-border,#e1dacd)}.fq-chip{padding:6px 12px;border-radius:16px;border:1px solid var(--fn-border,#e1dacd);background:var(--fn-surface,#fff);color:var(--fn-text,#222);font:600 .75rem inherit;cursor:pointer}.fq-chip.on{background:var(--fn-bronze,#b08d57);border-color:var(--fn-bronze,#b08d57);color:#fff}.fq-bar input{padding:6px 8px;border:1px solid var(--fn-border,#e1dacd);border-radius:8px;background:var(--fn-surface,#fff);color:var(--fn-text,#222);font:inherit;font-size:.75rem}' +
    '.fq-tabs{display:flex;gap:2px;padding:10px 20px 10px;overflow-x:auto;border-bottom:1px solid var(--fn-border,#e1dacd)}.fq-tabs::-webkit-scrollbar{height:21px}.fq-tabs::-webkit-scrollbar-button{display:none;width:0;height:0}.fq-tabs::-webkit-scrollbar-track{background:transparent;margin:0 14px}.fq-tabs::-webkit-scrollbar-thumb{background:#D3CEC5;border:5px solid transparent;border-top-width:6px;border-bottom-width:11px;background-clip:padding-box;border-radius:8px}.fq-tabs::-webkit-scrollbar-thumb:hover{background:#ABA69B;background-clip:padding-box}.fq-tab{padding:8px 14px;border:1px solid transparent;border-radius:8px;background:none;color:var(--fn-muted,#777);font:600 .8125rem inherit;cursor:pointer;white-space:nowrap}.fq-tab.on{background:var(--fn-surface,#fff);border-color:var(--fn-border,#e1dacd);border-bottom:1px solid var(--fn-border,#e1dacd);border-radius:8px;color:var(--fn-bronze,#b08d57);box-shadow:0 2px 8px rgba(0,0,0,.06)}' +
    '.fq-body{padding:16px 20px 22px;background:var(--fn-surface,#fff);border-radius:0 0 16px 16px;overscroll-behavior:contain}' +
    '.fq-doc{max-width:860px;margin:0 auto;font-family:"Times New Roman",Times,serif;color:var(--fn-text,#222)}.fq-hd{display:flex;justify-content:space-between;gap:16px;margin-bottom:14px;font-size:.8125rem}.fq-hd .l,.fq-hd .r{display:flex;flex-direction:column;gap:2px}.fq-hd .l{max-width:46%;text-align:center}.fq-hd .r{text-align:center;align-items:center}.fq-hd i{align-self:flex-end;margin-top:6px}' +
    '.fq-title{text-align:center;margin:18px 0 4px;font-size:1.5rem;letter-spacing:.04em}.fq-sub{text-align:center;display:flex;flex-direction:column;gap:2px;margin-bottom:12px}.fq-sec{margin:18px 0 8px;font-size:.9375rem}' +
    '.fq-p{line-height:1.6;text-align:justify;font-size:.875rem}.fq-sign{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;margin-top:26px}.fq-sign div{display:flex;flex-direction:column;gap:2px;min-height:110px}.fq-sign span{margin-top:auto;font-weight:700}' +
    '.fq-wrap{overflow:auto;border:1px solid var(--fn-border,#e1dacd);border-radius:8px;max-height:60vh;overscroll-behavior:contain}' +
    '.fq-grid{width:100%;border-collapse:collapse;font:400 .8125rem Inter,system-ui,sans-serif;color:var(--fn-text,#222)}.fq-grid th{position:sticky;top:0;background:#22272E;color:#fff;font-weight:700;padding:9px 10px;text-align:center;border-bottom:2px solid var(--fn-bronze,#b08d57);white-space:nowrap}.fq-grid td{padding:7px 10px;border:1px solid #E1DACD;vertical-align:middle;overflow-wrap:anywhere}.fq-grid tbody tr:nth-child(even){background:#FAF7F2}.fq-grid .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.fq-grid .c{text-align:center;white-space:nowrap}.fq-grid .pos{color:#1F6B3A}.fq-grid .neg{color:#B5402A;font-weight:700}' +
    '.fq-b td{font-weight:700;background:#F2EBDD}.fq-dim{color:#7A7568;font-size:.75rem}.fq-fixed{table-layout:fixed;font-size:.75rem!important}.fq-fixed th{white-space:normal!important;padding:8px 5px!important;font-size:.6875rem;line-height:1.25}.fq-fixed td{padding:6px 5px!important}.fq-fixed .c{white-space:nowrap}.fq-fixed .n{white-space:nowrap}.fq-grid tfoot td{background:#F2EBDD;font-weight:700;border-top:2px solid var(--fn-bronze,#b08d57)}.fq-soft td{background:#F2EBDD!important}.fq-empty{text-align:center;color:#888;padding:18px!important}' +
    '.fq-pill{display:inline-block;min-width:74px;padding:2px 10px;border-radius:4px;font-weight:700;font-size:.75rem;background:#E4E1DA;color:#6B675C}.fq-pill.g{background:#CFE8D5;color:#1F6B3A}.fq-pill.a{background:#F9E6B4;color:#8A6210}.fq-pill.r{background:#F6C9C0;color:#B5402A}' +
    '@media(max-width:760px){.fq-ov{padding:0}.fq-box{max-width:none;min-height:100vh;border-radius:0;border:none}.fq-top,.fq-bar,.fq-tabs{padding-left:12px;padding-right:12px}.fq-bar{gap:6px}.fq-chip{padding:5px 10px;font-size:.6875rem}.fq-bar>span{margin-left:0!important;width:100%;flex-wrap:wrap}.fq-tab{padding:7px 10px;font-size:.75rem}.fq-body{padding:12px;border-radius:0}.fq-sec{font-size:.8125rem}' +
    '.fq-fixed{table-layout:auto!important;min-width:860px;font-size:.6875rem!important}.fq-fixed col{width:auto!important}.fq-fixed td,.fq-fixed th{padding:5px 6px!important}.fq-fixed th{white-space:nowrap!important}.fq-fixed td:not(.n):not(.c){min-width:118px;overflow-wrap:break-word}.fq-grid{font-size:.6875rem}.fq-grid td,.fq-grid th{padding:6px 7px}' +
    '.fq-cards{min-width:0!important;display:block}.fq-cards thead{display:none}.fq-cards tbody,.fq-cards tfoot{display:block}.fq-cards tr{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;padding:9px 12px;border-bottom:1px solid #E1DACD;background:transparent}.fq-cards tbody tr:nth-child(even){background:#FAF7F2}' +
    '.fq-cards td{display:block;border:none!important;padding:0!important;min-width:0!important;white-space:normal!important;text-align:left!important}.fq-cards td[data-l]::before{content:attr(data-l);display:block;font-size:.5625rem;text-transform:uppercase;letter-spacing:.04em;color:#8a857a;font-weight:600}' +
    '.fq-cards td[data-l="Diễn giải"]{grid-column:1/-1;font-weight:600}.fq-cards td:empty{display:none}.fq-cards td.n{font-variant-numeric:tabular-nums}.fq-cards tr.fq-soft,.fq-cards tfoot tr{display:flex;justify-content:space-between;gap:8px}.fq-cards tfoot tr{background:#F2EBDD;font-weight:700}.fq-cards tfoot td:empty{display:none}.fq-cards tfoot td[colspan]{flex:1}.fq-hd{flex-direction:column}.fq-hd .l{max-width:none}.fq-sign{grid-template-columns:1fr}.fq-title{font-size:1.2rem}.fq-wrap{max-height:none}}';

  function render() {
    var views = { sum: viewSum, ov: viewOv, debt: viewDebt, hl: viewHl, bs: viewBs, rk: viewRk, pr: viewPr, tx: viewTx, l111: function () { return viewLedger('111'); }, l112: function () { return viewLedger('112'); }, pnl: viewPnl, cf: viewCf, rc: viewRc };
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
    // rê chuột vào thanh thẻ + lăn → cuộn ngang thanh thẻ (tới mép thì đứng yên, không kéo trang)
    var tabsEl = ov.querySelector('.fq-tabs');
    tabsEl.addEventListener('wheel', function (e) {
      if (e.ctrlKey || tabsEl.scrollWidth <= tabsEl.clientWidth + 1) return;
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!d) return;
      e.preventDefault(); tabsEl.scrollLeft += d;
    }, { passive: false });
    document.addEventListener('keydown', onKey);
    render();
  }
  return { open: open };
})();
