/**
 * Theo dõi hiệu suất nhân viên — staff-monitor.html.
 * Nguồn dữ liệu (đều có sẵn trong Hub): chấm công (TLCC-Chấm công), hoạt động trên Hub theo ngày (NS-Hoạt động — do
 * TaskManager tự ghi, chỉ đo trong chính Hub), công việc (DA-Công việc). CEO/quản lý xem mọi người; nhân viên chỉ xem
 * số liệu của chính mình. Ứng dụng đang dùng (NS-Ứng dụng) do HICONIQUE Agent trên máy công ty gửi lên — chỉ tên ứng dụng + tiêu đề cửa sổ, không màn hình/phím gõ.
 */
(function () {
  'use strict';
  var TM = window.TaskManager;
  var $ = function (id) { return document.getElementById(id); };
  var state = { range: 'today', date: '' };
  var tracked = { detail: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function user() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDur(min) { min = Math.round(min || 0); if (min < 60) return min + ' phút'; return Math.floor(min / 60) + 'h' + pad(min % 60); }
  function fmtDay(d) { var p = String(d).split('-'); return p[2] + '/' + p[1]; }

  function rangeDates() {
    var today = new Date();
    if (state.date) return [state.date];
    var out = [], d;
    if (state.range === 'today') return [ymd(today)];
    if (state.range === '7d') { for (var i = 6; i >= 0; i--) { d = new Date(today); d.setDate(d.getDate() - i); out.push(ymd(d)); } return out; }
    for (var day = 1; day <= today.getDate(); day++) out.push(ymd(new Date(today.getFullYear(), today.getMonth(), day)));
    return out;
  }

  function minutesOf(t) { var m = /^(\d{1,2})[:.](\d{2})/.exec(String(t == null ? '' : t)); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
  // Số phút "đang trong ca" của 1 dòng chấm công; ca đang mở của HÔM NAY tính tới bây giờ
  function checkedMinutes(e, isToday) {
    var total = 0, now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    [['morningCheckin', 'morningCheckout'], ['afternoonCheckin', 'afternoonCheckout']].forEach(function (p) {
      var a = minutesOf(e[p[0]]), b = minutesOf(e[p[1]]);
      if (a == null) return;
      if (b == null) { if (isToday) total += Math.max(0, nowMin - a); return; }
      total += Math.max(0, b - a);
    });
    return total;
  }

  function collect() {
    var me = user();
    var isMgr = !!me && TM.canManageNotifications(me);
    var dates = rangeDates(), dateSet = {}; dates.forEach(function (d) { dateSet[d] = true; });
    var todayKey = ymd(new Date());
    var members = (TM.getActiveMembers ? TM.getActiveMembers() : TM.getMembers()).filter(function (m) { return isMgr || (me && m.id === me.id); });
    var timesheet = TM.getTimesheetEntries ? TM.getTimesheetEntries() : [];
    var acts = TM.getStaffActivity ? TM.getStaffActivity() : [];
    var tasks = TM.getTasks ? TM.getTasks() : [];
    var nowMs = Date.now();

    return members.map(function (m) {
      var byDay = {};
      dates.forEach(function (d) { byDay[d] = { date: d, checked: 0, active: 0, idle: 0, away: 0, hasAct: false, updates: 0 }; });
      timesheet.forEach(function (e) { if (e.memberId === m.id && dateSet[e.date]) byDay[e.date].checked += checkedMinutes(e, e.date === todayKey); });
      acts.forEach(function (a) {
        if (a.memberId !== m.id || !dateSet[a.date]) return;
        var b = byDay[a.date]; b.hasAct = true;
        b.active += Number(a.activeMin) || 0; b.idle += Number(a.idleMin) || 0; b.away += Number(a.awayMin) || 0;
      });
      var mine = tasks.filter(function (t) { return Array.isArray(t.assigneeIds) ? t.assigneeIds.indexOf(m.id) !== -1 : false; });
      var open = mine.filter(function (t) { return t.status === 'in-progress' || t.status === 'pending' || t.status === 'review'; });
      var doing = mine.filter(function (t) { return t.status === 'in-progress'; });
      var overdue = open.filter(function (t) { return t.deadline && new Date(t.deadline).getTime() < nowMs; });
      mine.forEach(function (t) {
        (t.dailyTasks || []).forEach(function (d) { if (dateSet[d.date] && Number(d.progress) > 0 && byDay[d.date]) byDay[d.date].updates++; });
      });
      var sum = { checked: 0, active: 0, idle: 0, away: 0, updates: 0, actDays: 0, workDays: 0 };
      dates.forEach(function (d) {
        var b = byDay[d]; sum.checked += b.checked; sum.active += b.active; sum.idle += b.idle; sum.away += b.away; sum.updates += b.updates;
        if (b.hasAct) sum.actDays++; if (b.checked > 0) sum.workDays++;
      });
      var last = m.lastActiveAt ? new Date(m.lastActiveAt).getTime() : 0;
      var row = { member: m, byDay: byDay, sum: sum, doing: doing.length, open: open.length, overdue: overdue.length, online: last && (nowMs - last) < 3 * 60 * 1000, dates: dates, lastActive: last };
      row.flags = flagsFor(row, dates.length === 1 && dates[0] === todayKey);
      row.ratio = sum.checked > 0 ? Math.min(1, sum.active / sum.checked) : null;
      return row;
    });
  }

  function flagsFor(r, isTodaySingle) {
    var f = [], s = r.sum;
    if (s.workDays > 0 && s.actDays === 0) f.push({ c: 'warn', t: 'Chưa có dữ liệu hoạt động Hub (có thể làm việc ngoài Hub)' });
    if (s.workDays > 0 && s.actDays > 0 && s.checked >= 120) {
      var ratio = s.active / s.checked;
      if (ratio < 0.3) f.push({ c: 'bad', t: 'Hoạt động Hub thấp: ' + Math.round(ratio * 100) + '% giờ chấm công' });
      else if (ratio < 0.5) f.push({ c: 'warn', t: 'Hoạt động Hub vừa phải: ' + Math.round(ratio * 100) + '%' });
    }
    var tabTotal = s.active + s.idle;
    if (tabTotal >= 60 && s.idle / tabTotal > 0.6) f.push({ c: 'warn', t: 'Mở Hub nhưng ít thao tác (' + Math.round(s.idle / tabTotal * 100) + '% thời gian mở tab)' });
    if (s.checked > 0 && s.away > 120 && s.away > s.active) f.push({ c: 'warn', t: 'Rời tab Hub nhiều: ' + fmtDur(s.away) });
    if (r.overdue > 0) f.push({ c: 'bad', t: r.overdue + ' việc quá hạn' });
    if (r.doing > 0 && s.updates === 0 && s.workDays > 0) f.push({ c: 'warn', t: 'Có ' + r.doing + ' việc đang làm nhưng chưa cập nhật tiến độ' });
    if (!f.length && s.workDays > 0) f.push({ c: 'ok', t: 'Bình thường' });
    return f;
  }

  function avatar(m) { return '<span class="sm-av" style="background:' + esc(m.color || '#B08D57') + '">' + esc(m.avatar || String(m.name || '?').slice(0, 2).toUpperCase()) + '</span>'; }

  function render() {
    if (!TM) return;
    var rows = collect();
    syncDateBox();
    // Giữ chiều cao vùng bảng không bao giờ co lại → các khối phía trên (ô ngày, nút…) đứng yên khi lăn chuột đổi ngày
    var tbEl = $('smTable'); tracked.maxH = Math.max(tracked.maxH || 0, tbEl.offsetHeight); tbEl.style.minHeight = tracked.maxH + 'px';
    var me = user();
    var isMgr = !!me && TM.canManageNotifications(me);
    var attention = rows.filter(function (r) { return r.flags.some(function (f) { return f.c === 'bad'; }); }).length;
    var withData = rows.filter(function (r) { return r.ratio != null; });
    var avgRatio = withData.length ? Math.round(withData.reduce(function (s, r) { return s + r.ratio; }, 0) / withData.length * 100) + '%' : '—';
    var checkedIn = rows.filter(function (r) { return r.sum.workDays > 0; }).length;
    var overdueTotal = rows.reduce(function (s, r) { return s + r.overdue; }, 0);
    $('smKpis').innerHTML =
      kpi('Có chấm công', checkedIn + '/' + rows.length, 'trong khoảng đang xem') +
      kpi('Hoạt động Hub TB', avgRatio, 'so với giờ chấm công') +
      kpi('Cần trao đổi', attention, 'có cảnh báo đỏ', attention ? 'warn' : '') +
      kpi('Việc quá hạn', overdueTotal, 'tổng các việc chưa xong', overdueTotal ? 'warn' : '');
    $('smLede').textContent = isMgr ? 'So sánh giờ chấm công với mức hoạt động thực tế trên Hub, tiến độ công việc và các dấu hiệu cần trao đổi — để quản lý hỗ trợ đúng người, đúng lúc.' : 'Số liệu làm việc của bạn trong Hub: giờ chấm công, thời gian hoạt động, công việc và tiến độ.';

    if (!rows.length) { $('smTable').innerHTML = '<div class="sm-empty">Cần đăng nhập để xem.</div>'; return; }
    $('smTable').innerHTML = '<table class="sm-table"><thead><tr><th>Nhân viên</th><th class="num">Giờ chấm công</th><th class="num">Hoạt động Hub</th><th class="num">Không thao tác</th><th class="num">Rời tab</th><th>Tỉ lệ hoạt động</th><th class="num">Việc đang làm</th><th class="num">Quá hạn</th><th class="num">Cập nhật tiến độ</th><th>Dấu hiệu</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var pct = r.ratio == null ? null : Math.round(r.ratio * 100);
        var cls = pct == null ? '' : pct < 30 ? 'bad' : pct < 50 ? 'warn' : '';
        return '<tr class="sm-row" data-i="' + i + '"><td><div class="sm-who"><span class="sm-dot ' + (r.online ? 'on' : '') + '" title="' + (r.online ? 'Đang online' : 'Không online') + '"></span>' + avatar(r.member) + '<span>' + esc(r.member.name || r.member.id) + '</span></div></td>' +
          '<td class="num">' + (r.sum.checked ? fmtDur(r.sum.checked) : '—') + '</td>' +
          '<td class="num">' + (r.sum.actDays ? fmtDur(r.sum.active) : '—') + '</td>' +
          '<td class="num">' + (r.sum.actDays ? fmtDur(r.sum.idle) : '—') + '</td>' +
          '<td class="num">' + (r.sum.actDays ? fmtDur(r.sum.away) : '—') + '</td>' +
          '<td>' + (pct == null ? '<span class="sm-muted">—</span>' : '<div class="sm-bar" title="' + pct + '%"><span class="' + cls + '" style="width:' + pct + '%"></span></div>') + '</td>' +
          '<td class="num">' + r.doing + '</td><td class="num" style="' + (r.overdue ? 'color:var(--sm-bad)' : '') + '">' + r.overdue + '</td><td class="num">' + r.sum.updates + '</td>' +
          '<td>' + r.flags.map(function (f) { return '<span class="sm-flag ' + f.c + '">' + esc(f.t) + '</span>'; }).join('') + '</td></tr>';
      }).join('') + '</tbody></table>';
    tracked.rows = rows;
    $('smFoot').textContent = 'Tỉ lệ hoạt động = phút có thao tác trong Hub ÷ phút đang trong ca theo chấm công. Người làm việc chủ yếu ngoài Hub (thiết kế bằng phần mềm riêng, ra công trình…) sẽ có tỉ lệ thấp dù làm việc đủ giờ — hãy đối chiếu với tiến độ công việc và trao đổi trực tiếp trước khi kết luận.';
  }
  function kpi(label, value, sub, cls) {
    return '<div class="sm-kpi"><div class="sm-kpi-label">' + esc(label) + '</div><div class="sm-kpi-value ' + (cls || '') + '">' + esc(value) + '</div><div class="sm-kpi-sub">' + esc(sub) + '</div></div>';
  }

  // Ngày nào trong khoảng đang xem có dữ liệu (chấm công hoặc hoạt động Hub hoặc ứng dụng) — ưu tiên chọn mặc định
  function daysWithData(r) {
    return r.dates.filter(function (d) { var b = r.byDay[d]; return b.checked || b.hasAct || appsFor(r.member.id, [d]).length; });
  }

  // ---- Báo cáo tổng toàn bộ nhân viên trong khoảng đang xem (xem · In/PDF · tải Excel) ----
  function rangeText() {
    var ds = rangeDates(); if (!ds.length) return '';
    var f = function (d) { var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
    return ds.length === 1 ? f(ds[0]) : 'từ ' + f(ds[0]) + ' đến ' + f(ds[ds.length - 1]);
  }
  // Ô ngày cố định: hiện 1 ngày (dd/mm/yyyy) hoặc khoảng ngày khi xem 7 ngày / Tháng này
  function syncDateBox() {
    var ds = rangeDates(), f = function (d) { var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
    var txt = ds.length <= 1 ? (ds.length ? f(ds[0]) : 'dd/mm/yyyy') : f(ds[0]) + ' – ' + f(ds[ds.length - 1]);
    var isRange = ds.length > 1;
    if (!state.date && state.range === 'month') {   // Tháng này: luôn hiện CẢ THÁNG (từ ngày 1 đến ngày cuối tháng), dù dữ liệu mới tới hôm nay
      var nw = new Date(); txt = f(ymd(new Date(nw.getFullYear(), nw.getMonth(), 1))) + ' – ' + f(ymd(new Date(nw.getFullYear(), nw.getMonth() + 1, 0))); isRange = true;
    }
    $('smDateText').textContent = txt;
    $('smDateBox').classList.toggle('range', isRange);
    if (ds.length === 1) $('smDate').value = ds[0]; else $('smDate').value = '';
  }
  function reportData() {
    var rows = collect();
    var head = ['Nhân viên', 'Chức vụ', 'Ngày có chấm công', 'Giờ chấm công', 'Hoạt động Hub', 'Không thao tác', 'Rời tab', 'Tỉ lệ hoạt động', 'Việc đang làm', 'Quá hạn', 'Cập nhật tiến độ', 'Dấu hiệu'];
    var body = rows.map(function (r) {
      return [r.member.name || r.member.id, r.member.role || '', r.sum.workDays, r.sum.checked ? fmtDur(r.sum.checked) : '—', r.sum.actDays ? fmtDur(r.sum.active) : '—',
        r.sum.actDays ? fmtDur(r.sum.idle) : '—', r.sum.actDays ? fmtDur(r.sum.away) : '—', r.ratio == null ? '—' : Math.round(r.ratio * 100) + '%',
        r.doing, r.overdue, r.sum.updates, r.flags.map(function (f) { return f.t; })];
    });
    var tot = rows.reduce(function (a, r) { a.c += r.sum.checked; a.a += r.sum.active; a.i += r.sum.idle; a.w += r.sum.away; a.u += r.sum.updates; a.o += r.overdue; a.d += r.doing; a.wd += r.sum.workDays; return a; }, { c: 0, a: 0, i: 0, w: 0, u: 0, o: 0, d: 0, wd: 0 });
    var foot = ['Tổng cộng (' + rows.length + ' người)', '', tot.wd, fmtDur(tot.c), fmtDur(tot.a), fmtDur(tot.i), fmtDur(tot.w), tot.c ? Math.round(Math.min(1, tot.a / tot.c) * 100) + '%' : '—', tot.d, tot.o, tot.u, ''];
    // Chi tiết từng người theo từng ngày trong khoảng
    var dayHead = ['Ngày', 'Giờ chấm công', 'Hoạt động Hub', 'Không thao tác', 'Rời tab', 'Tỉ lệ hoạt động', 'Cập nhật tiến độ'];
    var people = rows.map(function (r) {
      var days = r.dates.map(function (dt) {
        var b = r.byDay[dt];
        var pct = b.checked > 0 && b.hasAct ? Math.round(Math.min(1, b.active / b.checked) * 100) + '%' : '—';
        var p = dt.split('-');
        return [p[2] + '/' + p[1] + '/' + p[0], b.checked ? fmtDur(b.checked) : '—', b.hasAct ? fmtDur(b.active) : '—', b.hasAct ? fmtDur(b.idle) : '—', b.hasAct ? fmtDur(b.away) : '—', pct, b.updates];
      });
      return { name: (r.member.name || r.member.id) + (r.member.role ? ' (' + r.member.role + ')' : ''), flags: r.flags.map(function (f) { return f.t; }), days: days,
        note: 'Việc đang làm: ' + r.doing + ' · Đang mở: ' + r.open + ' · Quá hạn: ' + r.overdue };
    });
    var attention = rows.filter(function (r) { return r.flags.some(function (f) { return f.c === 'bad'; }); }).length;
    var kpi = 'Có chấm công: ' + rows.filter(function (r) { return r.sum.workDays > 0; }).length + '/' + rows.length + ' · Cần trao đổi: ' + attention + ' · Việc quá hạn: ' + tot.o;
    return { head: head, body: body, foot: foot, dayHead: dayHead, people: people, kpi: kpi, title: 'Báo cáo tổng hợp hoạt động nhân viên', range: rangeText() };
  }
  function reportTableHtml(d, withDays) {
    var cell = function (v, h) { var tg = h ? 'th' : 'td'; return '<' + tg + '>' + (Array.isArray(v) ? v.map(function (x) { return '<div class="rp-flag">' + esc(x) + '</div>'; }).join('') : esc(String(v))) + '</' + tg + '>'; };
    var tbl = function (head, body, foot) {
      return '<table class="sm-table rp-tbl" style="font-size:.8125rem"><thead><tr>' + head.map(function (h) { return cell(h, 1); }).join('') + '</tr></thead><tbody>' +
        body.map(function (r) { return '<tr>' + r.map(function (v) { return cell(v); }).join('') + '</tr>'; }).join('') +
        (foot ? '<tr style="font-weight:700">' + foot.map(function (v) { return cell(v); }).join('') + '</tr>' : '') + '</tbody></table>';
    };
    var html = '<div class="rp-sum">' + esc(d.kpi) + '</div><h3 class="rp-h">I. Tổng hợp theo nhân viên</h3>' + tbl(d.head, d.body, d.foot);
    if (withDays !== false) {
      html += '<h3 class="rp-h">II. Chi tiết từng nhân viên theo ngày</h3>' + d.people.map(function (p) {
        return '<div class="rp-person"><div class="rp-name">' + esc(p.name) + '</div><div class="rp-note">' + esc(p.note) + (p.flags.length ? ' · Dấu hiệu: ' + esc(p.flags.join('; ')) : '') + '</div>' + tbl(d.dayHead, p.days) + '</div>';
      }).join('');
    }
    return html;
  }
  function openReport() {
    var d = reportData();
    $('smModalTitle').textContent = d.title + ' — ' + d.range;
    $('smModal').querySelector('.sm-modal').style.maxWidth = 'min(1480px, 96vw)';
    $('smModalBody').innerHTML = '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;"><button class="sm-btn" id="smRepPrint" type="button">In / Lưu PDF</button><button class="sm-btn" id="smRepCsv" type="button">Tải Excel (.csv)</button></div>' +
      '<style>.rp-sum{font-size:.8125rem;font-weight:600;color:var(--sm-bronze);margin-bottom:8px}.rp-h{font-size:.9375rem;margin:16px 0 8px}.rp-person{margin-bottom:14px}.rp-name{font-weight:700;margin-bottom:2px}.rp-note{font-size:.75rem;color:var(--sm-muted);margin-bottom:6px}.rp-tbl th,.rp-tbl td{white-space:nowrap;vertical-align:top;padding:9px 12px}.rp-tbl td:last-child{white-space:normal;min-width:340px}.rp-flag{padding:1px 0;line-height:1.45}.rp-flag+.rp-flag{border-top:1px dashed var(--sm-border);margin-top:3px;padding-top:4px}</style>' +
      '<div style="overflow:auto;max-height:68vh;">' + reportTableHtml(d) + '</div>' +
      '<p class="sm-muted" style="margin:10px 0 0;font-size:.75rem;">Tỉ lệ hoạt động = phút có thao tác trong Hub ÷ giờ chấm công. Người làm việc chủ yếu ngoài Hub sẽ có tỉ lệ thấp — đối chiếu với tiến độ công việc trước khi kết luận.</p>';
    $('smModal').classList.add('active');
    $('smRepPrint').addEventListener('click', function () {
      var w = window.open('', '_blank'); if (!w) { alert('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.'); return; }
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(d.title) + '</title><style>body{font-family:Arial,sans-serif;padding:18px;color:#111}h2{margin:0 0 4px}p{margin:0 0 12px;color:#555;font-size:13px}table{border-collapse:collapse;width:100%;font-size:11px;margin-bottom:6px}th,td{border:1px solid #999;padding:5px 6px;text-align:left}th{background:#eee}.rp-sum{font-weight:700;margin:6px 0}.rp-h{font-size:14px;margin:16px 0 8px}.rp-name{font-weight:700;margin-top:10px}.rp-note{font-size:11px;color:#555;margin-bottom:4px}.rp-person{page-break-inside:avoid}@page{size:A4 landscape;margin:10mm}</style></head><body><h2>' + esc(d.title.toUpperCase()) + '</h2><p>Khoảng thời gian: ' + esc(d.range) + ' · Xuất lúc ' + new Date().toLocaleString('vi-VN') + '</p>' + reportTableHtml(d).split(' class="sm-table"').join('') + '</body></html>');
      w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
    });
    $('smRepCsv').addEventListener('click', function () {
      var q = function (v) { if (Array.isArray(v)) v = v.join('; '); v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var out = [[d.title + ' — ' + d.range], [d.kpi], [], ['I. TỔNG HỢP THEO NHÂN VIÊN'], d.head].concat(d.body, [d.foot, [], ['II. CHI TIẾT TỪNG NHÂN VIÊN THEO NGÀY']]);
      d.people.forEach(function (p) { out.push([], [p.name], [p.note + (p.flags.length ? ' · Dấu hiệu: ' + p.flags.join('; ') : '')], d.dayHead); p.days.forEach(function (r) { out.push(r); }); });
      var lines = out.map(function (r) { return r.map(q).join(';'); });
      var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bao-cao-hoat-dong-nhan-vien-' + ymd(new Date()) + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  }

  function openDetail(i) {
    var r = tracked.rows && tracked.rows[i]; if (!r) return;
    $('smModal').querySelector('.sm-modal').style.maxWidth = '';
    tracked.detail = r;
    $('smModalTitle').textContent = r.member.name || r.member.id;
    var withData = daysWithData(r);
    tracked.selDate = withData.length ? withData[withData.length - 1] : r.dates[r.dates.length - 1];
    var dayRows = r.dates.slice().reverse().map(function (d) {
      var b = r.byDay[d];
      var pct = b.checked > 0 && b.hasAct ? Math.round(Math.min(1, b.active / b.checked) * 100) + '%' : '—';
      return '<tr class="sm-row" data-date="' + esc(d) + '"><td>' + fmtDay(d) + '</td><td class="num">' + (b.checked ? fmtDur(b.checked) : '—') + '</td><td class="num">' + (b.hasAct ? fmtDur(b.active) : '—') + '</td><td class="num">' + (b.hasAct ? fmtDur(b.idle) : '—') + '</td><td class="num">' + (b.hasAct ? fmtDur(b.away) : '—') + '</td><td class="num">' + pct + '</td><td class="num">' + b.updates + '</td></tr>';
    }).join('');
    $('smModalBody').innerHTML =
      '<div style="margin-bottom:12px;">' + r.flags.map(function (f) { return '<span class="sm-flag ' + f.c + '">' + esc(f.t) + '</span>'; }).join('') + '</div>' +
      '<div class="sm-wrap"><table class="sm-table" style="min-width:0"><thead><tr><th>Ngày</th><th class="num">Chấm công</th><th class="num">Hoạt động</th><th class="num">Không thao tác</th><th class="num">Rời tab</th><th class="num">Tỉ lệ</th><th class="num">Cập nhật tiến độ</th></tr></thead><tbody id="smDayRows">' + dayRows + '</tbody></table></div>' +
      '<p class="sm-day-hint">Bấm vào một ngày để xem chi tiết ứng dụng đã dùng trong ngày đó.</p>' +
      '<div id="smAppBox"></div>' +
      '<p class="sm-foot">Việc đang mở: ' + r.open + ' · quá hạn: ' + r.overdue + '. Hoạt động lần cuối trên Hub: ' + (r.lastActive ? new Date(r.lastActive).toLocaleString('vi-VN') : 'chưa có') + '.</p>';
    renderAppBox();
    $('smModal').classList.add('active');
  }

  function renderAppBox() {
    var r = tracked.detail; if (!r) return;
    Array.prototype.forEach.call($('smDayRows').querySelectorAll('tr'), function (tr) { tr.classList.toggle('sel', tr.dataset.date === tracked.selDate); });
    var apps = appsFor(r.member.id, [tracked.selDate]);
    var label = 'ngày ' + fmtDay(tracked.selDate);
    if (!apps.length) {
      $('smAppBox').innerHTML = '<h4 style="margin:14px 0 8px;font-size:0.875rem;">Ứng dụng đang dùng — ' + label + '</h4>' +
        '<p class="sm-foot">Chưa có dữ liệu ứng dụng ngày này (máy chưa cài HICONIQUE Agent, ngoài giờ làm việc, hoặc chưa gửi dữ liệu).</p>';
      return;
    }
    var total = apps.reduce(function (s, a) { return s + a.min; }, 0);
    $('smAppBox').innerHTML = '<h4 style="margin:14px 0 8px;font-size:0.875rem;">Ứng dụng đang dùng — ' + label + ' (' + fmtDur(total) + ')</h4>' +
      '<div class="sm-wrap"><table class="sm-table" style="min-width:0"><thead><tr><th>Ứng dụng</th><th class="num">Thời gian</th><th class="num">Tỉ trọng</th><th>Chi tiết theo cửa sổ / tab (thời gian từng cửa sổ)</th></tr></thead><tbody>' +
      apps.slice(0, 30).map(function (a) {
        return '<tr><td>' + esc(a.app) + '</td><td class="num">' + fmtDur(a.min) + '</td><td class="num">' + Math.round(a.min / total * 100) + '%</td><td class="sm-tcell">' + titleBreakdown(a) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // Gộp dữ liệu ứng dụng của 1 người theo tên ứng dụng, trong tập ngày đã cho (thường là 1 ngày cụ thể)
  function appsFor(memberId, dates) {
    var set = {}; dates.forEach(function (d) { set[d] = true; });
    var by = {};
    (TM.getAppUsage ? TM.getAppUsage() : []).forEach(function (u) {
      if (u.memberId !== memberId || !set[u.date]) return;
      var a = by[u.app] || (by[u.app] = { app: u.app, min: 0, titles: [], _t: {} });
      a.min += Number(u.minutes) || 0;
      parseTitles(u.titles).forEach(function (x) {   // cùng tiêu đề trên nhiều máy/hàng → cộng dồn số phút
        var e = a._t[x.t]; if (!e) { e = a._t[x.t] = { t: x.t, m: 0, known: false }; a.titles.push(e); }
        if (x.m !== null) { e.m += x.m; e.known = true; }
      });
    });
    return Object.keys(by).map(function (k) { var a = by[k]; a.titles.sort(function (p, q) { return q.m - p.m; }); return a; }).sort(function (x, y) { return y.min - x.min; });
  }

  // Cột "Tiêu đề cửa sổ" của Sheet có dạng "Tiêu đề A (24p) | Tiêu đề B (7p)" — tách đúng cả khi tiêu đề có dấu " | " bên trong
  function parseTitles(str) {
    var out = [], s = String(str || ''), re = /(.*?)\s*\((\d+)p\)(?:\s*\|\s*|$)/g, m, last = 0;
    while ((m = re.exec(s)) !== null) { if (m[0] === '') { re.lastIndex++; continue; } var t = m[1].trim(); if (t) out.push({ t: t, m: Number(m[2]) }); last = re.lastIndex; }
    var rest = s.slice(last).trim();   // phần không có "(Np)" (bản Agent cũ / dữ liệu nhập tay)
    if (rest) rest.split(' | ').forEach(function (t) { t = t.trim(); if (t) out.push({ t: t, m: null }); });
    return out;
  }
  function fmtTitleDur(m) { return m < 1 ? '<1 phút' : fmtDur(m); }
  // Từng cửa sổ/tab: tên + thanh tỉ lệ so với cả ứng dụng + số phút; phần còn lại (cửa sổ ít dùng, Agent chỉ gửi vài cửa sổ nhiều nhất) gộp thành 1 dòng
  function titleBreakdown(a) {
    if (!a.titles.length) return '<span class="sm-muted" style="font-size:0.75rem;">Không có dữ liệu cửa sổ (Agent đang tắt gửi tiêu đề hoặc bản Agent cũ)</span>';
    var sum = 0, rows = a.titles.map(function (x) {
      sum += x.m;
      var pct = a.min > 0 ? Math.min(100, Math.round(x.m / a.min * 100)) : 0;
      return '<div class="sm-tl"><span class="sm-tl-bar" style="width:' + pct + '%"></span><span class="sm-tl-t" title="' + esc(x.t) + '">' + esc(x.t) + '</span><span class="sm-tl-m">' + (x.known ? fmtTitleDur(x.m) : '—') + '</span></div>';
    }).join('');
    var rest = Math.round(a.min - sum);
    if (rest >= 1) rows += '<div class="sm-tl sm-tl-rest"><span class="sm-tl-t">Các cửa sổ khác (dùng ít)</span><span class="sm-tl-m">' + fmtDur(rest) + '</span></div>';
    return rows;
  }

  // ---- Thông tin bản phát hành HICONIQUE Agent (đọc /agent/latest.json — do build.py tạo mỗi lần phát hành) ----
  function fmtSize(b) { b = Number(b) || 0; return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'; }
  function fmtDateTime(iso) { var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function loadAgentInfo(manual) {
    var st = $('agStatus');
    if (manual) { st.className = 'sm-agent-status'; st.textContent = 'Đang kiểm tra…'; }
    fetch('/agent/latest.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (a) {
      $('agVer').textContent = 'v' + a.version;
      $('agDate').textContent = a.releasedAt ? fmtDateTime(a.releasedAt) : '—';
      $('agSize').textContent = a.size ? fmtSize(a.size) : '—';
      $('agSha').textContent = a.sha256 || '—';
      // Nút tải LUÔN ghim thẳng folder Google Drive chứa file cài đặt (xem GHI_CHU_DU_AN.md, mục QUAN TRỌNG); a.url (GitHub) chỉ dành cho tự cập nhật của Agent
      if ($('agDlName')) $('agDlName').textContent = 'Tải HiconiqueAgentSetup-v' + a.version + '.exe (Google Drive)';
      $('agHist').innerHTML = (a.history && a.history.length ? a.history : [{ version: a.version, date: '', notes: a.notes || '' }]).map(function (h) {
        return '<li><b>v' + esc(h.version) + '</b>' + (h.date ? ' · ' + esc(String(h.date).split('-').reverse().join('/')) : '') + '<br>' + esc(h.notes || '') + '</li>';
      }).join('');
      var now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      st.className = 'sm-agent-status ok';
      st.textContent = 'Đã kiểm tra lúc ' + now + ' — bản mới nhất là v' + a.version + '. Máy đã cài tự cập nhật trong tối đa 6 giờ.';
    }).catch(function () {
      st.className = 'sm-agent-status bad'; st.textContent = 'Không đọc được thông tin phiên bản (kiểm tra mạng rồi thử lại).';
      $('agVer').textContent = '—';
    });
  }

  function init() {
    if (!TM) return;
    if ($('agCheck')) { $('agCheck').addEventListener('click', function () { loadAgentInfo(true); }); loadAgentInfo(false); }
    $('smRange').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-r]'); if (!b) return;
      state.range = b.dataset.r; state.date = ''; $('smDate').value = state.range === 'today' ? ymd(new Date()) : '';   // Hôm nay → ô ngày hiện đúng ngày hôm nay
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
      render();
    });
    $('smDate').addEventListener('change', function () {
      state.date = this.value;
      Array.prototype.forEach.call($('smRange').querySelectorAll('button'), function (x) { x.classList.remove('active'); });
      render();
    });
    // Lăn chuột trên ô ngày: lên = ngày kế, xuống = ngày trước (không vượt quá hôm nay); ô trống thì bắt đầu từ hôm nay
    $('smDateBox').addEventListener('click', function () { try { if ($('smDate').showPicker) $('smDate').showPicker(); } catch (er) { /* trình duyệt cũ: input date tự xử lý */ } });
    $('smDateBox').addEventListener('wheel', function (e) {
      e.preventDefault();
      var dEl = $('smDate');
      var cur = state.date ? new Date(state.date + 'T00:00:00') : new Date(); cur.setHours(0, 0, 0, 0);
      cur.setDate(cur.getDate() + (e.deltaY < 0 ? 1 : -1));
      var now = new Date(); now.setHours(0, 0, 0, 0); if (cur > now) cur = now;
      dEl.value = ymd(cur);
      dEl.dispatchEvent(new Event('change'));
    }, { passive: false });
    $('smDate').value = ymd(new Date());   // mặc định đang xem "Hôm nay" → hiện ngày hôm nay
    $('smReload').addEventListener('click', reload);
    if ($('smReport')) $('smReport').addEventListener('click', openReport);
    $('smTable').addEventListener('click', function (e) { var r = e.target.closest('.sm-row'); if (r) openDetail(Number(r.dataset.i)); });
    $('smModalBody').addEventListener('click', function (e) {
      var r = e.target.closest('#smDayRows tr.sm-row'); if (!r) return;
      tracked.selDate = r.dataset.date; renderAppBox();
    });
    $('smModalClose').addEventListener('click', function () { $('smModal').classList.remove('active'); });
    $('smModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('active'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('smModal').classList.remove('active'); });
    render(); reload();
    setInterval(function () { if (document.visibilityState === 'visible') reload(); }, 30000);
  }
  function reload() {
    // render lại sau MỖI nguồn tải xong (trước đây ứng dụng tải xong không vẽ lại nên hiện "Chưa có dữ liệu ứng dụng")
    if (TM.loadAppUsage) TM.loadAppUsage(function () { render(); if ($('smModal').classList.contains('active')) renderAppBox(); });
    if (TM.loadStaffActivity) TM.loadStaffActivity(function () { render(); });
    else render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
