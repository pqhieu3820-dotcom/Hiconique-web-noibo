/**
 * Quản lý khách hàng (CRM) — crm.html. Dữ liệu ở TaskManager (khách: sheet KH-Khách hàng, lịch sử: KH-Chăm sóc).
 * Mọi thành viên đã đăng nhập xem/thêm khách; sửa hoặc ẩn khách chỉ người phụ trách/người tạo hoặc CEO/quản lý.
 */
(function () {
  'use strict';
  var TM = window.TaskManager;
  var $ = function (id) { return document.getElementById(id); };
  var STAGES = (TM && TM.CRM_STAGES) || ['Tiềm năng', 'Đã liên hệ', 'Báo giá', 'Đàm phán', 'Đã ký', 'Từ chối'];
  var CLOSED = { 'Đã ký': true, 'Từ chối': true };
  var STAGE_COLOR = { 'Tiềm năng': '#8B95A5', 'Đã liên hệ': '#3B6B8C', 'Báo giá': '#B08D57', 'Đàm phán': '#C77A40', 'Đã ký': '#4F6F52', 'Từ chối': '#A04848' };
  // Icon ngày/hạn dùng chung toàn app (giống deadline chip ở task-manager-app.js) — không dùng emoji
  var DUE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;flex-shrink:0;vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
  var state = { view: 'board', q: '', owner: '', filter: '', editingId: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(String(n || '').replace(/[^\d.-]/g, '')) || 0; return n ? n.toLocaleString('vi-VN') + ' ₫' : ''; }
  function moneyShort(n) { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ'; if (n >= 1e6) return Math.round(n / 1e6) + ' tr'; return n ? n.toLocaleString('vi-VN') : '0'; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : d; }
  function user() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function toast(msg, bad) {
    var t = document.createElement('div'); t.className = 'cr-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function memberName(id) { var m = TM.getMember ? TM.getMember(id) : null; return m ? (m.name || id) : (id || '—'); }
  function isDue(c) { return !CLOSED[c.stage] && c.nextFollowUp && String(c.nextFollowUp).slice(0, 10) <= today(); }

  function visibleCustomers() {
    var u = user(), q = state.q.trim().toLowerCase();
    return TM.getCustomers().filter(function (c) {
      if (state.owner && c.ownerId !== state.owner) return false;
      if (state.filter === 'mine' && (!u || c.ownerId !== u.id)) return false;
      if (state.filter === 'due' && !isDue(c)) return false;
      if (q) {
        var hay = [c.name, c.phone, c.company, c.email, c.address, c.note].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderKpis(all) {
    var active = all.filter(function (c) { return c.stage === 'Đã liên hệ' || c.stage === 'Báo giá' || c.stage === 'Đàm phán'; });
    var won = all.filter(function (c) { return c.stage === 'Đã ký'; }).length;
    var lost = all.filter(function (c) { return c.stage === 'Từ chối'; }).length;
    var rate = (won + lost) ? Math.round(won / (won + lost) * 100) + '%' : '—';
    var pipeline = all.filter(function (c) { return !CLOSED[c.stage]; }).reduce(function (s, c) { return s + (Number(String(c.budget || '').replace(/[^\d]/g, '')) || 0); }, 0);
    var due = all.filter(isDue).length;
    $('crKpis').innerHTML =
      kpi('Tổng khách hàng', all.length, won + ' đã ký') +
      kpi('Đang chăm sóc', active.length, 'Đã liên hệ · Báo giá · Đàm phán') +
      kpi('Tỉ lệ chốt', rate, won + ' ký / ' + lost + ' từ chối') +
      kpi('Giá trị đang theo', moneyShort(pipeline), 'ngân sách khách chưa chốt') +
      kpi('Cần chăm sóc', due, 'đến hạn hoặc quá hạn', due ? 'bad' : '');
  }
  function kpi(label, value, sub, cls) {
    return '<div class="cr-kpi"><div class="cr-kpi-label">' + esc(label) + '</div><div class="cr-kpi-value ' + (cls || '') + '">' + esc(value) + '</div><div class="cr-kpi-sub">' + esc(sub) + '</div></div>';
  }

  function cardHtml(c) {
    var due = isDue(c);
    var idx = STAGES.indexOf(c.stage), next = idx >= 0 && idx < 4 ? STAGES[idx + 1] : null;
    return '<div class="cr-card" data-id="' + esc(c.id) + '">' +
      '<div class="cr-card-name">' + esc(c.name) + '</div>' +
      '<div class="cr-card-sub">' + esc([c.company, c.phone].filter(Boolean).join(' · ') || '—') + '</div>' +
      '<div class="cr-card-meta">' +
        (c.budget ? '<span class="cr-chip money">' + esc(moneyShort(String(c.budget).replace(/[^\d]/g, ''))) + '</span>' : '') +
        (c.nextFollowUp ? '<span class="cr-chip' + (due ? ' bad' : '') + '" title="Chăm sóc tiếp theo">' + (due ? DUE_ICON + ' ' : '') + esc(fmtDate(c.nextFollowUp)) + '</span>' : '') +
        '<span class="cr-chip">' + esc(memberName(c.ownerId)) + '</span>' +
        (next ? '<button type="button" class="cr-chip cr-next" data-next="' + esc(c.id) + '" data-stage="' + esc(next) + '" title="Chuyển sang ' + esc(next) + '" style="cursor:pointer;background:none;">→ ' + esc(next) + '</button>' : '') +
      '</div></div>';
  }

  function render() {
    var all = TM.getCustomers();
    renderKpis(all);
    var list = visibleCustomers();
    $('crBoard').hidden = state.view !== 'board';
    $('crList').hidden = state.view !== 'list';
    if (state.view === 'board') {
      $('crBoard').innerHTML = STAGES.map(function (st) {
        var items = list.filter(function (c) { return (c.stage || STAGES[0]) === st; });
        var sum = items.reduce(function (s, c) { return s + (Number(String(c.budget || '').replace(/[^\d]/g, '')) || 0); }, 0);
        return '<div class="cr-col"><div class="cr-col-head"><span style="color:' + STAGE_COLOR[st] + '">● ' + esc(st) + '</span><span class="cr-col-count">' + items.length + '</span></div>' +
          '<div class="cr-col-sum">' + (sum ? esc(moneyShort(sum)) : '&nbsp;') + '</div>' +
          '<div class="cr-cards">' + (items.length ? items.map(cardHtml).join('') : '<div class="cr-empty">Chưa có khách</div>') + '</div></div>';
      }).join('');
    } else {
      $('crList').innerHTML = '<table class="cr-table"><thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Giai đoạn</th><th>Phụ trách</th><th>Ngân sách</th><th>Chăm sóc tiếp</th></tr></thead><tbody>' +
        (list.length ? list.map(function (c) {
          return '<tr class="cr-row" data-id="' + esc(c.id) + '"><td><b>' + esc(c.name) + '</b><div style="font-size:.75rem;color:var(--cr-muted)">' + esc(c.company || '') + '</div></td>' +
            '<td>' + esc([c.phone, c.email].filter(Boolean).join(' · ')) + '</td>' +
            '<td><span style="color:' + STAGE_COLOR[c.stage || STAGES[0]] + '">● ' + esc(c.stage || STAGES[0]) + '</span></td>' +
            '<td>' + esc(memberName(c.ownerId)) + '</td><td>' + esc(money(String(c.budget || '').replace(/[^\d]/g, ''))) + '</td>' +
            '<td' + (isDue(c) ? ' style="color:var(--cr-bad);font-weight:600"' : '') + '>' + esc(fmtDate(c.nextFollowUp)) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="cr-empty">Không có khách hàng phù hợp.</td></tr>') + '</tbody></table>';
    }
  }

  // ---------- Modal ----------
  function fillSelects() {
    $('cfStage').innerHTML = STAGES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    var members = TM.getActiveMembers ? TM.getActiveMembers() : (TM.getMembers ? TM.getMembers() : []);
    var opts = members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name || m.id) + '</option>'; }).join('');
    $('cfOwner').innerHTML = opts;
    $('crOwner').innerHTML = '<option value="">Mọi người phụ trách</option>' + opts;
    $('crOwner').value = state.owner;
    var projects = TM.getProjects ? TM.getProjects() : [];
    $('cfProject').innerHTML = '<option value="">— Chưa có —</option>' + projects.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) + '</option>'; }).join('');
  }

  function openModal(id) {
    var u = user();
    if (!u) { toast('Cần đăng nhập để dùng CRM.', true); return; }
    fillSelects();
    state.editingId = id || null;
    var c = id ? TM.getCustomers().filter(function (x) { return x.id === id; })[0] : null;
    if (id && !c) return;
    $('crModalTitle').textContent = c ? c.name : 'Thêm khách hàng';
    $('cfName').value = c ? c.name || '' : ''; $('cfPhone').value = c ? c.phone || '' : ''; $('cfEmail').value = c ? c.email || '' : '';
    $('cfCompany').value = c ? c.company || '' : ''; $('cfSource').value = c && c.source ? c.source : 'Facebook';
    $('cfAddress').value = c ? c.address || '' : ''; $('cfStage').value = c && c.stage ? c.stage : STAGES[0];
    $('cfOwner').value = c && c.ownerId ? c.ownerId : u.id;
    $('cfBudget').value = c && c.budget ? Number(String(c.budget).replace(/[^\d]/g, '')).toLocaleString('vi-VN') : '';
    $('cfNext').value = c && c.nextFollowUp ? String(c.nextFollowUp).slice(0, 10) : '';
    $('cfProject').value = c && c.projectId ? c.projectId : ''; $('cfNote').value = c ? c.note || '' : '';
    var canEdit = !c || TM.canEditCustomer(u, c);
    Array.prototype.forEach.call($('crForm').elements, function (el) { el.disabled = !canEdit; });
    $('crSaveBtn').hidden = !canEdit;
    $('crHideBtn').hidden = !c || !canEdit;
    $('crLogForm').hidden = !c; $('crLogHint').hidden = !!c; $('crLogs').hidden = !c;
    $('clDate').value = today(); $('clContent').value = '';
    renderLogs();
    $('crModal').classList.add('active');
    setTimeout(function () { $('cfName').focus(); }, 30);
  }
  function closeModal() { $('crModal').classList.remove('active'); state.editingId = null; }

  function renderLogs() {
    var box = $('crLogs');
    if (!state.editingId) { box.innerHTML = ''; return; }
    var logs = TM.getCustomerLogs(state.editingId);
    box.innerHTML = logs.length ? logs.map(function (l) {
      return '<div class="cr-log"><div class="cr-log-meta">' + esc(l.type || 'Ghi chú') + ' · ' + esc(fmtDate(l.date)) + ' · ' + esc(memberName(l.createdBy)) + '</div>' + esc(l.content) + '</div>';
    }).join('') : '<div class="cr-empty" style="padding:10px 0;text-align:left;">Chưa có lịch sử chăm sóc.</div>';
  }

  function collect() {
    return {
      name: $('cfName').value.trim(), phone: $('cfPhone').value.trim(), email: $('cfEmail').value.trim(), company: $('cfCompany').value.trim(),
      source: $('cfSource').value, address: $('cfAddress').value.trim(), stage: $('cfStage').value, ownerId: $('cfOwner').value,
      budget: String($('cfBudget').value).replace(/[^\d]/g, ''), nextFollowUp: $('cfNext').value, projectId: $('cfProject').value, note: $('cfNote').value.trim()
    };
  }

  function bind() {
    $('crSearch').addEventListener('input', function () { state.q = this.value; render(); });
    $('crOwner').addEventListener('change', function () { state.owner = this.value; render(); });
    $('crFilter').addEventListener('change', function () { state.filter = this.value; render(); });
    $('crView').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-view]'); if (!b) return;
      state.view = b.dataset.view;
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
      render();
    });
    $('crAddBtn').addEventListener('click', function () { openModal(null); });
    $('crModalClose').addEventListener('click', closeModal);
    $('crModal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    $('crBoard').addEventListener('click', function (e) {
      var nx = e.target.closest('[data-next]');
      if (nx) {
        e.stopPropagation();
        var r = TM.updateCustomer(nx.dataset.next, { stage: nx.dataset.stage }, user());
        if (!r) toast('Bạn không có quyền đổi giai đoạn khách này.', true); else { toast('Đã chuyển sang "' + nx.dataset.stage + '".'); render(); }
        return;
      }
      var card = e.target.closest('.cr-card'); if (card) openModal(card.dataset.id);
    });
    $('crList').addEventListener('click', function (e) { var r = e.target.closest('.cr-row'); if (r) openModal(r.dataset.id); });
    $('cfBudget').addEventListener('input', function () {
      var d = this.value.replace(/[^\d]/g, ''); this.value = d ? Number(d).toLocaleString('vi-VN') : '';
    });
    $('crForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var u = user(), data = collect();
      if (!data.name) { toast('Nhập tên khách hàng.', true); return; }
      if (state.editingId) {
        if (!TM.updateCustomer(state.editingId, data, u)) { toast('Bạn không có quyền sửa khách này.', true); return; }
        toast('Đã lưu thay đổi.'); closeModal();
      } else {
        var created = TM.createCustomer(data, u);
        if (!created) { toast('Không lưu được khách hàng.', true); return; }
        toast('Đã thêm khách hàng.');
        // giữ modal mở ở chế độ sửa để ghi lịch sử chăm sóc ngay
        state.editingId = created.id; $('crModalTitle').textContent = created.name;
        $('crHideBtn').hidden = false; $('crLogForm').hidden = false; $('crLogHint').hidden = true; $('crLogs').hidden = false; renderLogs();
      }
      render();
    });
    $('crHideBtn').addEventListener('click', function () {
      if (!state.editingId || !window.confirm('Ẩn khách hàng này khỏi danh sách? (Dòng vẫn còn trên Sheet, chỉ tắt cột Hiển thị)')) return;
      if (TM.hideCustomer(state.editingId, user())) { toast('Đã ẩn khách hàng.'); closeModal(); render(); } else toast('Bạn không có quyền ẩn khách này.', true);
    });
    $('clAddBtn').addEventListener('click', function () {
      if (!state.editingId) return;
      var rec = TM.addCustomerLog(state.editingId, $('clType').value, $('clContent').value, $('clDate').value, user());
      if (!rec) { toast('Nhập nội dung trao đổi.', true); return; }
      $('clContent').value = ''; renderLogs(); toast('Đã ghi lịch sử chăm sóc.');
    });
  }

  function init() {
    if (!TM) { $('crBoard').innerHTML = '<p class="cr-empty">Không tải được dữ liệu.</p>'; return; }
    fillSelects(); bind(); render();
    TM.loadCrmData(function () { fillSelects(); render(); });
    // Dữ liệu mới từ máy khác: vẽ lại khi không có modal đang mở (tránh mất nội dung đang nhập)
    window.addEventListener('hiconique:data-refreshed', function () {
      if (!$('crModal').classList.contains('active')) { render(); }
    });
    setInterval(function () { if (!$('crModal').classList.contains('active') && document.visibilityState === 'visible') TM.loadCrmData(function () { render(); }); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
