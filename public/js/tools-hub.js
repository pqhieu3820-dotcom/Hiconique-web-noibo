/**
 * Công cụ chính (trang chủ) — phân 4 nhóm theo luồng việc + tìm nhanh + ghim + dùng gần đây (2026-09-30).
 * Không đổi markup gốc của 15 thẻ (data-tool): script gom lại thành nhóm, thêm thanh lọc và hàng "Truy cập nhanh".
 * Ghim/gần đây lưu localStorage của từng trình duyệt (không cần Sheet). Thêm công cụ mới: thêm thẻ .tool-card có data-tool rồi khai báo nhóm ở GROUPS.
 */
(function () {
  'use strict';
  var GROUPS = [
    { id: 'project', title: 'Dự án & thi công', hint: 'Bản vẽ, tiến độ, thi công', tools: ['dashboard', 'meeting', 'drive', 'lighting', 'khai-toan', 'estimate', 'quality', 'hicon-bim'] },
    { id: 'sales', title: 'Kinh doanh & khách hàng', hint: 'Khách, báo giá, đơn hàng, hoa hồng', tools: ['crm', 'pricing', 'orders', 'commission'] },
    { id: 'hr', title: 'Nhân sự & chấm công', hint: 'Chấm công, lương, hiệu suất', tools: ['timesheet', 'payslip', 'staff-monitor'] },
    { id: 'finance', title: 'Tài chính & tài sản', hint: 'Sổ tài chính, tài sản – vật tư', tools: ['finance', 'equipment'] }
  ];
  var PIN_KEY = 'hiconique_tool_pins', REC_KEY = 'hiconique_tool_recent';

  function load(k) { try { var a = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  function init() {
    var grid = document.querySelector('#tools .tool-grid');
    if (!grid || grid.dataset.hubReady) return;
    grid.dataset.hubReady = '1';
    var cards = {}, order = [];
    Array.prototype.forEach.call(grid.querySelectorAll('.tool-card[data-tool]'), function (c) { cards[c.dataset.tool] = c; order.push(c.dataset.tool); });
    var placed = {}; GROUPS.forEach(function (g) { g.tools.forEach(function (t) { placed[t] = true; }); });
    var others = order.filter(function (t) { return !placed[t]; });          // công cụ mới chưa khai báo nhóm → gom vào "Khác"
    var groups = GROUPS.concat(others.length ? [{ id: 'other', title: 'Khác', hint: '', tools: others }] : []);

    var wrap = el('div', 'tool-hub');
    // ---- thanh lọc + tìm ----
    var bar = el('div', 'tool-hub-bar');
    var search = el('input', 'tool-hub-search'); search.type = 'search'; search.placeholder = 'Tìm công cụ…'; search.setAttribute('aria-label', 'Tìm công cụ');
    var chips = el('div', 'tool-hub-chips');
    var state = { g: 'all', q: '' };
    function chip(id, label, n) { var b = el('button', 'tool-hub-chip', label + ' <span>' + n + '</span>'); b.type = 'button'; b.dataset.g = id; b.addEventListener('click', function () { state.g = id; apply(); }); return b; }
    chips.appendChild(chip('all', 'Tất cả', order.length));
    groups.forEach(function (g) { chips.appendChild(chip(g.id, g.title, g.tools.filter(function (t) { return cards[t]; }).length)); });
    bar.appendChild(search); bar.appendChild(chips);
    wrap.appendChild(bar);

    // ---- truy cập nhanh (ghim + gần đây) ----
    var quick = el('div', 'tool-hub-quick'); wrap.appendChild(quick);

    // ---- các nhóm ----
    var sections = {};
    groups.forEach(function (g) {
      var sec = el('section', 'tool-group'); sec.dataset.g = g.id;
      sec.appendChild(el('div', 'tool-group-head', '<h3>' + g.title + '</h3><span class="tool-group-hint">' + g.hint + '</span><span class="tool-group-count"></span>'));
      var gg = el('div', 'tool-grid');
      g.tools.forEach(function (t) {
        var c = cards[t]; if (!c) return;
        var pin = el('button', 'tool-pin', '★'); pin.type = 'button'; pin.title = 'Ghim lên Truy cập nhanh'; pin.setAttribute('aria-label', 'Ghim công cụ');
        pin.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); togglePin(t); });
        c.appendChild(pin);
        c.addEventListener('click', function () { var r = load(REC_KEY).filter(function (x) { return x !== t; }); r.unshift(t); save(REC_KEY, r.slice(0, 8)); });
        gg.appendChild(c);
      });
      sec.appendChild(gg); wrap.appendChild(sec); sections[g.id] = sec;
    });
    var empty = el('p', 'tool-hub-empty', 'Không có công cụ nào khớp — thử từ khóa khác.'); empty.hidden = true; wrap.appendChild(empty);
    grid.parentNode.replaceChild(wrap, grid);

    function togglePin(t) { var p = load(PIN_KEY); var i = p.indexOf(t); if (i === -1) p.unshift(t); else p.splice(i, 1); save(PIN_KEY, p); apply(); }
    function quickLink(t, pinned) {
      var c = cards[t]; if (!c) return null;
      var a = el('a', 'tool-quick' + (pinned ? ' pinned' : ''));
      a.href = c.getAttribute('href'); if (c.target) { a.target = c.target; a.rel = 'noopener'; }
      var ic = c.querySelector('.tool-icon'); a.innerHTML = (ic ? '<span class="tool-quick-ic">' + ic.innerHTML + '</span>' : '') + '<span>' + (c.querySelector('.tool-title') ? c.querySelector('.tool-title').textContent : t) + '</span>' + (pinned ? '<i>★</i>' : '');
      a.addEventListener('click', function () { var r = load(REC_KEY).filter(function (x) { return x !== t; }); r.unshift(t); save(REC_KEY, r.slice(0, 8)); });
      return a;
    }
    function apply() {
      var pins = load(PIN_KEY).filter(function (t) { return cards[t]; }), rec = load(REC_KEY).filter(function (t) { return cards[t] && pins.indexOf(t) === -1; }).slice(0, 5);
      // truy cập nhanh (ẩn khi đang tìm/lọc)
      quick.innerHTML = '';
      if ((pins.length || rec.length) && state.g === 'all' && !state.q) {
        if (pins.length) { var r1 = el('div', 'tool-quick-row', '<span class="tool-quick-label">Đã ghim</span>'); pins.forEach(function (t) { var a = quickLink(t, true); if (a) r1.appendChild(a); }); quick.appendChild(r1); }
        if (rec.length) { var r2 = el('div', 'tool-quick-row', '<span class="tool-quick-label">Dùng gần đây</span>'); rec.forEach(function (t) { var a = quickLink(t, false); if (a) r2.appendChild(a); }); quick.appendChild(r2); }
      }
      quick.hidden = !quick.children.length;
      Array.prototype.forEach.call(chips.children, function (b) { b.classList.toggle('on', b.dataset.g === state.g); });
      var q = norm(state.q), any = false;
      groups.forEach(function (g) {
        var sec = sections[g.id], shown = 0;
        g.tools.forEach(function (t) {
          var c = cards[t]; if (!c) return;
          var hay = norm(c.textContent), ok = !q || q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
          c.hidden = !ok; if (ok) shown++;
          c.classList.toggle('is-pinned', pins.indexOf(t) !== -1);
          var pb = c.querySelector('.tool-pin'); if (pb) pb.title = pins.indexOf(t) !== -1 ? 'Bỏ ghim' : 'Ghim lên Truy cập nhanh';
        });
        var visible = (state.g === 'all' || state.g === g.id) && shown > 0;
        sec.hidden = !visible; if (visible) any = true;
        sec.querySelector('.tool-group-count').textContent = shown + ' công cụ';
      });
      empty.hidden = any;
    }
    search.addEventListener('input', function () { state.q = search.value.trim(); apply(); });
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
