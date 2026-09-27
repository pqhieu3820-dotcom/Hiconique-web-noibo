/**
 * Theo dõi hiệu suất nhân viên — staff-monitor.html.
 * Nguồn dữ liệu (đều có sẵn trong Hub): chấm công (TLCC-Chấm công), hoạt động trên Hub theo ngày (NS-Hoạt động — do
 * TaskManager tự ghi, chỉ đo trong chính Hub), công việc (DA-Công việc). CEO/quản lý xem mọi người; nhân viên chỉ xem
 * số liệu của chính mình. KHÔNG có bất kỳ dữ liệu nào về web/màn hình/ứng dụng khác của nhân viên.
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

  function openDetail(i) {
    var r = tracked.rows && tracked.rows[i]; if (!r) return;
    $('smModalTitle').textContent = r.member.name || r.member.id;
    var dayRows = r.dates.slice().reverse().map(function (d) {
      var b = r.byDay[d];
      var pct = b.checked > 0 && b.hasAct ? Math.round(Math.min(1, b.active / b.checked) * 100) + '%' : '—';
      return '<tr><td>' + fmtDay(d) + '</td><td class="num">' + (b.checked ? fmtDur(b.checked) : '—') + '</td><td class="num">' + (b.hasAct ? fmtDur(b.active) : '—') + '</td><td class="num">' + (b.hasAct ? fmtDur(b.idle) : '—') + '</td><td class="num">' + (b.hasAct ? fmtDur(b.away) : '—') + '</td><td class="num">' + pct + '</td><td class="num">' + b.updates + '</td></tr>';
    }).join('');
    $('smModalBody').innerHTML =
      '<div style="margin-bottom:12px;">' + r.flags.map(function (f) { return '<span class="sm-flag ' + f.c + '">' + esc(f.t) + '</span>'; }).join('') + '</div>' +
      '<div class="sm-wrap"><table class="sm-table" style="min-width:0"><thead><tr><th>Ngày</th><th class="num">Chấm công</th><th class="num">Hoạt động</th><th class="num">Không thao tác</th><th class="num">Rời tab</th><th class="num">Tỉ lệ</th><th class="num">Cập nhật tiến độ</th></tr></thead><tbody>' + dayRows + '</tbody></table></div>' +
      '<p class="sm-foot">Việc đang mở: ' + r.open + ' · quá hạn: ' + r.overdue + '. Hoạt động lần cuối trên Hub: ' + (r.lastActive ? new Date(r.lastActive).toLocaleString('vi-VN') : 'chưa có') + '.</p>';
    $('smModal').classList.add('active');
  }

  function init() {
    if (!TM) return;
    $('smRange').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-r]'); if (!b) return;
      state.range = b.dataset.r; state.date = ''; $('smDate').value = '';
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
      render();
    });
    $('smDate').addEventListener('change', function () {
      state.date = this.value;
      Array.prototype.forEach.call($('smRange').querySelectorAll('button'), function (x) { x.classList.remove('active'); });
      render();
    });
    $('smReload').addEventListener('click', reload);
    $('smTable').addEventListener('click', function (e) { var r = e.target.closest('.sm-row'); if (r) openDetail(Number(r.dataset.i)); });
    $('smModalClose').addEventListener('click', function () { $('smModal').classList.remove('active'); });
    $('smModal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('active'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('smModal').classList.remove('active'); });
    render(); reload();
    setInterval(function () { if (document.visibilityState === 'visible' && !$('smModal').classList.contains('active')) reload(); }, 120000);
  }
  function reload() {
    if (TM.loadStaffActivity) TM.loadStaffActivity(function () { render(); });
    else render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
