/* 2026-10-03: Bảng "Thiết bị nhận thông báo" trên trang Thông báo (notices.html).
 * - Mỗi người thấy + sửa tên / bật-tắt / gửi thử / xoá thiết bị CỦA MÌNH; Founder/CEO thấy thiết bị của mọi người (nhóm theo người, báo ai chưa đủ 2 thiết bị).
 * - "+ Đăng ký thiết bị này" bật thông báo trên trình duyệt đang mở (PushNotify.enableAndWait).
 * - Dữ liệu: sheet TT-Thiết bị đăng ký thông báo qua API getPushDevices / updatePushDevice / deletePushDevice / testPushDevice (gsheets-api-v2.js).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var st = { res: null, busy: false };
  function user() { return (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null; }
  function fmt(s) { var d = new Date(s); if (isNaN(d)) return '—'; var p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function ago(s) { var d = new Date(s); if (isNaN(d)) return ''; var m = Math.round((Date.now() - d) / 60000); return m < 60 ? m + ' phút trước' : m < 1440 ? Math.round(m / 60) + ' giờ trước' : Math.round(m / 1440) + ' ngày trước'; }
  function toast(msg, ok) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10060;max-width:440px;padding:12px 18px;background:var(--color-surface);border:1px solid var(--color-border);border-left:4px solid ' + (ok === false ? 'var(--color-destructive,#c55)' : 'var(--color-bronze)') + ';border-radius:10px;font-size:.8125rem;box-shadow:0 10px 30px rgba(0,0,0,.25);';
    el.textContent = msg; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 4200);
  }
  function confirmBox(title, onOk, okLabel) {
    var ov = document.createElement('div'); ov.className = 'ts-confirm-overlay';
    ov.innerHTML = '<div class="ts-confirm-box"><div class="ts-confirm-title">' + esc(title) + '</div><div class="ts-confirm-actions"><button type="button" class="ts-confirm-cancel">Huỷ</button><button type="button" class="ts-confirm-ok">' + esc(okLabel || 'Xác nhận') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ts-confirm-cancel').onclick = function () { ov.remove(); };
    ov.querySelector('.ts-confirm-ok').onclick = function () { ov.remove(); onOk(); };
  }
  function promptBox(title, value, onOk) {
    var ov = document.createElement('div'); ov.className = 'ts-confirm-overlay';
    ov.innerHTML = '<div class="ts-confirm-box"><div class="ts-confirm-title">' + esc(title) + '</div><input type="text" class="nd-input" maxlength="80" value="' + esc(value) + '"><div class="ts-confirm-actions"><button type="button" class="ts-confirm-cancel">Huỷ</button><button type="button" class="ts-confirm-ok">Lưu</button></div></div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('input'); inp.focus(); inp.select();
    ov.querySelector('.ts-confirm-cancel').onclick = function () { ov.remove(); };
    var ok = function () { var v = inp.value.trim(); if (!v) return; ov.remove(); onOk(v); };
    ov.querySelector('.ts-confirm-ok').onclick = ok; inp.onkeydown = function (e) { if (e.key === 'Enter') ok(); };
  }

  function load() {
    var u = user(), box = $('ndBody'); if (!u || !box) return;
    if (typeof PushNotify === 'undefined' || !PushNotify.listDevices) { box.innerHTML = '<p class="nd-empty">Chưa tải được mô-đun thông báo.</p>'; return; }
    box.innerHTML = '<p class="nd-empty">Đang tải danh sách thiết bị…</p>';
    PushNotify.listDevices(u).then(function (res) { st.res = res; render(); }).catch(function () { box.innerHTML = '<p class="nd-empty">Không tải được danh sách thiết bị (kiểm tra kết nối).</p>'; });
  }

  function statusLine(u, mine) {
    var need = PushNotify.REQUIRED_DEVICES || 2, cnt = mine.filter(function (d) { return d.active; }).length, here = mine.some(function (d) { return d.isThis && d.active; });
    var perm = PushNotify.getStatus();
    var mx = PushNotify.MAX_DEVICES || 5, msg = cnt >= mx ? '<span class="nd-warn">Đã đủ ' + mx + '/' + mx + ' thiết bị — muốn thêm thiết bị mới hãy xoá bớt 1 thiết bị cũ.</span>' : cnt >= need ? '<span class="nd-ok">Đang có ' + cnt + ' thiết bị nhận thông báo (tối đa ' + mx + ').</span>' : '<span class="nd-warn">Bạn mới có ' + cnt + '/' + need + ' thiết bị nhận thông báo — hãy đăng ký thêm trên ' + (here ? 'thiết bị còn lại (điện thoại hoặc máy tính)' : 'thiết bị này') + '.</span>';
    var here2 = here ? '<span class="nd-chip ok">Thiết bị này: đang nhận</span>' : perm === 'denied' ? '<span class="nd-chip bad">Thiết bị này: trình duyệt đang chặn</span>' : '<span class="nd-chip">Thiết bị này: chưa đăng ký</span>';
    return '<div class="nd-status">' + msg + here2 + '</div>';
  }

  function row(d, showOwner) {
    return '<tr data-id="' + esc(d.id) + '" class="' + (d.active ? '' : 'off') + '">' +
      (showOwner ? '<td>' + esc(d.memberName) + '</td>' : '') +
      '<td><div class="nd-name">' + esc(d.deviceLabel || 'Thiết bị') + (d.isThis ? ' <span class="nd-chip ok">thiết bị này</span>' : '') + '</div><div class="nd-sub">' + esc(d.browserFamily || '') + ' · mã …' + esc(d.tokenTail.slice(-6)) + '</div></td>' +
      '<td>' + (d.active ? '<span class="nd-chip ok">Đang nhận</span>' : '<span class="nd-chip">Đã tắt</span>') + '</td>' +
      '<td class="nd-time">' + fmt(d.createdAt) + '</td>' +
      '<td class="nd-time">' + fmt(d.lastActiveAt) + '<div class="nd-sub">' + ago(d.lastActiveAt) + '</div></td>' +
      '<td class="nd-act"><button type="button" data-a="test">Gửi thử</button><button type="button" data-a="rename">Đổi tên</button><button type="button" data-a="toggle">' + (d.active ? 'Tắt' : 'Bật') + '</button><button type="button" data-a="del" class="danger">Xoá</button></td></tr>';
  }

  function render() {
    var u = user(), box = $('ndBody'), res = st.res || {}; if (!u || !box) return;
    if (res.error) { box.innerHTML = '<p class="nd-empty">' + esc(res.error) + '</p>'; return; }
    var all = res.devices || [], mine = all.filter(function (d) { return d.memberId === u.id; });
    var head = function (owner) { return '<thead><tr>' + (owner ? '<th>Người dùng</th>' : '') + '<th>Thiết bị</th><th>Trạng thái</th><th>Đăng ký lúc</th><th>Hoạt động gần nhất</th><th class="nd-act-h">Thao tác</th></tr></thead>'; };
    var html = statusLine(u, mine);
    html += '<div class="nd-tablewrap"><table class="nd-table">' + head(false) + '<tbody>' + (mine.length ? mine.map(function (d) { return row(d, false); }).join('') : '<tr><td colspan="5" class="nd-empty">Bạn chưa đăng ký thiết bị nào.</td></tr>') + '</tbody></table></div>';
    if (res.admin) {
      var others = all.filter(function (d) { return d.memberId !== u.id; });
      var members = (typeof TaskManager !== 'undefined' && TaskManager.getMembers) ? TaskManager.getMembers() : [];
      var byM = {}; others.forEach(function (d) { (byM[d.memberId] = byM[d.memberId] || []).push(d); });
      var summary = members.filter(function (m) { return m.id !== u.id && m.status !== 'archived'; }).map(function (m) {
        var c = (byM[m.id] || []).filter(function (d) { return d.active; }).length, need = PushNotify.REQUIRED_DEVICES || 2;
        return '<span class="nd-chip ' + (c >= need ? 'ok' : c ? '' : 'bad') + '">' + esc(m.name) + ': ' + c + '/' + need + '</span>';
      }).join('');
      html += '<h3 class="nd-h3">Thiết bị của mọi người <small>· chỉ Founder/CEO thấy</small></h3><div class="nd-summary">' + summary + '</div>';
      html += '<div class="nd-tablewrap"><table class="nd-table">' + head(true) + '<tbody>' + (others.length ? others.sort(function (a, b) { return String(a.memberName).localeCompare(String(b.memberName)); }).map(function (d) { return row(d, true); }).join('') : '<tr><td colspan="6" class="nd-empty">Chưa có ai khác đăng ký thiết bị.</td></tr>') + '</tbody></table></div>';
    }
    box.innerHTML = html;
  }

  function act(id, a) {
    var u = user(), d = ((st.res && st.res.devices) || []).filter(function (x) { return x.id === id; })[0]; if (!u || !d || st.busy) return;
    var done = function (msg) { return function (r) { st.busy = false; if (r && (r.error || r.ok === false)) toast((r.error || 'Lỗi') + '', false); else { if (msg) toast(msg); load(); } }; };
    var fail = function () { st.busy = false; toast('Không gửi được lệnh (kiểm tra kết nối).', false); };
    if (a === 'test') { st.busy = true; toast('Đang gửi thông báo thử tới "' + d.deviceLabel + '"…'); PushNotify.testDevice(u, id).then(function (r) { st.busy = false; if (r && r.ok) toast('Đã gửi — kiểm tra thiết bị "' + d.deviceLabel + '" xem có hiện thông báo không.'); else { toast((r && r.error) || 'Gửi thử thất bại', false); load(); } }, fail); }
    else if (a === 'rename') promptBox('Đổi tên thiết bị', d.deviceLabel, function (v) { st.busy = true; PushNotify.updateDevice(u, id, { deviceLabel: v }).then(done('Đã đổi tên.'), fail); });
    else if (a === 'toggle') { st.busy = true; PushNotify.updateDevice(u, id, { active: !d.active }).then(done(d.active ? 'Đã tắt thông báo trên thiết bị này.' : 'Đã bật lại.'), fail); }
    else if (a === 'del') confirmBox('Xoá thiết bị "' + d.deviceLabel + '" khỏi danh sách nhận thông báo?', function () { st.busy = true; PushNotify.deleteDevice(u, id).then(done('Đã xoá thiết bị.'), fail); }, 'Xoá');
  }

  function boot() {
    if (!$('ndBody')) return;
    if (typeof PushNotify === 'undefined' || typeof Auth === 'undefined' || !user()) { setTimeout(boot, 300); return; }
    load();
    $('ndBody').addEventListener('click', function (e) { var b = e.target.closest('button[data-a]'); if (!b) return; act(b.closest('tr').dataset.id, b.dataset.a); });
    $('ndReload').addEventListener('click', load);
    $('ndAddThis').addEventListener('click', function () {
      var btn = this; btn.disabled = true; btn.textContent = 'Đang bật…';
      PushNotify.enableAndWait(user()).then(function (r) {
        btn.disabled = false; btn.textContent = '+ Đăng ký thiết bị này';
        if (r.ok) { toast('Đã đăng ký thiết bị này nhận thông báo.'); setTimeout(load, 800); } else toast(PushNotify.reasonText(r.reason), false);
      });
    });
    if (location.hash === '#devices') setTimeout(function () { var s = $('ndSection'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 200); }); else setTimeout(boot, 200);
})();
