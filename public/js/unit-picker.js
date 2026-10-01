/* UnitPicker — ô "Đơn vị" có bảng đơn vị mẫu ngành xây dựng / thiết kế: bấm vào ô là xổ danh sách (dạng nút gọn m2 · m3 · kg · bộ…), gõ 1-2 chữ là lọc
   (không cần dấu, hiểu cả tên gọi: "met vuong", "cong", "bo"…), ↑↓ Enter hoặc bấm chuột để chọn. Gõ đơn vị chưa có → hiện nút "+ Thêm … vào bảng đơn vị" (lưu chung cho cả công ty,
   sheet TC-Đơn vị tính). Vẫn gõ tự do được. Dùng ở orders.html. */
(function (global) {
  'use strict';

  // [đơn vị, từ khoá tìm thêm (không hiện), nhóm]
  var G = { area: 'Diện tích', len: 'Chiều dài', vol: 'Thể tích', mass: 'Khối lượng', qty: 'Số lượng', pack: 'Đóng gói / vận chuyển', site: 'Công trình / thiết bị', time: 'Nhân công / thời gian', design: 'Thiết kế / hồ sơ', money: 'Tính tiền', own: 'Đơn vị riêng của công ty' };
  var UNITS = [
    ['m2', 'met vuong dien tich', G.area], ['ha', 'hecta', G.area],
    ['m', 'met', G.len], ['md', 'met dai', G.len], ['cm', 'xenti', G.len], ['mm', 'mili', G.len], ['km', 'kilomet', G.len],
    ['m3', 'met khoi', G.vol], ['lít', 'lit', G.vol],
    ['kg', 'kilogam ki lo', G.mass], ['g', 'gam gram', G.mass], ['tấn', 'tan', G.mass], ['tạ', 'ta', G.mass],
    ['cái', 'cai', G.qty], ['chiếc', 'chiec', G.qty], ['bộ', 'bo', G.qty], ['cây', 'cay', G.qty], ['tấm', 'tam', G.qty], ['viên', 'vien gach', G.qty], ['thanh', '', G.qty],
    ['cuộn', 'cuon', G.qty], ['tờ', 'to', G.qty], ['đôi', 'doi', G.qty], ['cặp', 'cap', G.qty], ['quả', 'qua', G.qty], ['con', '', G.qty],
    ['bao', 'xi mang', G.pack], ['thùng', 'thung son', G.pack], ['lon', '', G.pack], ['hộp', 'hop', G.pack], ['gói', 'goi', G.pack], ['can', '', G.pack], ['chai', '', G.pack],
    ['tuýp', 'tuyp silicon', G.pack], ['lọ', 'lo', G.pack], ['kiện', 'kien', G.pack], ['pallet', 'pa let', G.pack], ['chuyến', 'chuyen xe van chuyen', G.pack], ['xe', 'chuyen', G.pack],
    ['điểm', 'diem dien nuoc mang', G.site], ['vị trí', 'vi tri', G.site], ['phòng', 'phong', G.site], ['tầng', 'tang', G.site], ['căn', 'can ho nha', G.site], ['trục', 'truc', G.site],
    ['cột', 'cot', G.site], ['bậc', 'bac cau thang', G.site], ['cánh', 'canh cua', G.site], ['máy', 'may', G.site], ['dàn', 'dan lanh nong', G.site], ['hệ thống', 'he', G.site], ['hạng mục', 'hang muc', G.site], ['lô', '', G.site],
    ['công', 'ngay cong nhan cong', G.time], ['giờ', 'gio', G.time], ['ca', 'ca may', G.time], ['ngày', 'ngay', G.time], ['tuần', 'tuan', G.time], ['tháng', 'thang', G.time], ['quý', 'quy', G.time], ['năm', 'nam', G.time], ['người', 'nguoi nhan su', G.time],
    ['bộ hồ sơ', 'ho so thiet ke', G.design], ['bản vẽ', 'ban ve', G.design], ['mặt bằng', 'mat bang', G.design], ['phối cảnh', 'phoi canh 3d', G.design], ['view', 'goc nhin', G.design], ['concept', 'y tuong', G.design],
    ['buổi', 'buoi tu van giam sat khao sat', G.design], ['lần', 'lan', G.design], ['đợt', 'dot thanh toan', G.design], ['giai đoạn', 'giai doan', G.design],
    ['trọn gói', 'tron goi', G.money], ['khoán', 'khoan', G.money], ['tạm tính', 'tam tinh', G.money], ['%', 'phan tram', G.money], ['VNĐ', 'vnd dong', G.money]
  ];

  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function prep(u) { return { u: u[0], k: norm(u[0]), h: norm(u[0]) + ' ' + (u[1] || ''), g: u[2] }; }
  var BASE = UNITS.map(prep);

  function all(custom) {
    var seen = {}, out = [];
    (custom || []).forEach(function (c) { var u = String(c.unit || '').trim(); if (u) out.push(prep([u, norm(c.name || ''), c.group || G.own])); });
    return BASE.concat(out).filter(function (x) { var k = x.k; if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function search(q, custom) {
    var list = all(custom), nq = norm(q);
    if (!nq) return list;
    var toks = nq.split(/\s+/), res = [];
    list.forEach(function (x) {
      for (var i = 0; i < toks.length; i++) if (x.h.indexOf(toks[i]) === -1) return;
      var s = x.k === nq ? 10 : x.k.indexOf(nq) === 0 ? 6 : x.h.indexOf(nq) === 0 ? 3 : 1;
      res.push({ x: x, s: s - x.k.length / 100 });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.map(function (r) { return r.x; });
  }

  var CSS = '#upPop{position:fixed;z-index:810;max-height:340px;overflow-y:auto;background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.35);font:400 .8125rem Inter,sans-serif;color:var(--color-text);padding:8px 10px 10px;width:340px}' +
    '#upPop .gh{margin:8px 2px 5px;font-size:.625rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted)}#upPop .gh:first-child{margin-top:0}' +
    '#upPop .wrap{display:flex;flex-wrap:wrap;gap:5px}#upPop .it{padding:5px 11px;border-radius:999px;border:1px solid var(--color-border);background:var(--color-bg);font-family:"JetBrains Mono",monospace;font-size:.8125rem;font-weight:600;cursor:pointer;color:var(--color-text)}' +
    '#upPop .it:hover,#upPop .it.on{border-color:var(--color-bronze);background:color-mix(in srgb,var(--color-bronze) 16%,transparent);color:var(--color-bronze)}' +
    '#upPop .add{display:block;width:100%;margin-top:8px;padding:8px 10px;border-radius:9px;border:1px dashed var(--color-bronze);background:none;color:var(--color-bronze);font:600 .75rem Inter,sans-serif;cursor:pointer;text-align:left}#upPop .add:hover,#upPop .add.on{background:color-mix(in srgb,var(--color-bronze) 12%,transparent)}' +
    '#upPop .em{padding:4px 2px;color:var(--color-text-muted);font-size:.75rem}';

  function attach(opts) {
    // opts: { container, selector, getCustom(): [{unit,name,group}], onAdd(unitText) → true/false (lưu đơn vị mới), onPick }
    if (!document.getElementById('upCss')) { var st = document.createElement('style'); st.id = 'upCss'; st.textContent = CSS; document.head.appendChild(st); }
    var sel = opts.selector || '[data-i="unit"]', box = null, cur = -1, list = [], input = null, canAdd = false;
    function close() { if (box) { box.remove(); box = null; } cur = -1; }
    function draw(showAll) {
      if (!input) return;
      var q = showAll ? '' : input.value, custom = opts.getCustom ? opts.getCustom() : [];
      list = search(q, custom);
      var raw = String(input.value || '').trim(), exact = all(custom).some(function (x) { return x.k === norm(raw); });
      canAdd = !showAll && !!raw && !exact && raw.length <= 24 && !!opts.onAdd;
      if (!box) { box = document.createElement('div'); box.id = 'upPop'; document.body.appendChild(box); }
      var r = input.getBoundingClientRect();
      box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 356)) + 'px';
      var below = window.innerHeight - r.bottom, up = below < 260 && r.top > below;
      box.style.top = up ? 'auto' : (r.bottom + 4) + 'px'; box.style.bottom = up ? (window.innerHeight - r.top + 4) + 'px' : 'auto';
      var html = '', lastG = null, grouped = !String(q).trim(), open = false;
      list.forEach(function (x, i) {
        if (grouped && x.g !== lastG) { if (open) html += '</div>'; lastG = x.g; html += '<div class="gh">' + esc(x.g) + '</div><div class="wrap">'; open = true; }
        else if (!grouped && !open) { html += '<div class="wrap">'; open = true; }
        html += '<span class="it' + (i === cur ? ' on' : '') + '" data-i="' + i + '">' + esc(x.u) + '</span>';
      });
      if (open) html += '</div>';
      if (!list.length) html += '<div class="em">Chưa có đơn vị này trong bảng.</div>';
      if (canAdd) html += '<button type="button" class="add' + (cur === list.length ? ' on' : '') + '" data-add="1">+ Thêm “' + esc(raw) + '” vào bảng đơn vị</button>';
      box.innerHTML = html;
      var on = box.querySelector('.it.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function done(text) {
      input.value = text; input.dispatchEvent(new Event('input', { bubbles: true }));
      var tr = input.closest('tr'); close();
      if (opts.onPick) opts.onPick(input, text);
      var q = tr && tr.querySelector('[data-i="qty"]'); if (q) { q.focus(); q.select(); }
    }
    function pick(i) { var x = list[i]; if (x) done(x.u); }
    function addNew() { var raw = String(input.value || '').trim(); if (!raw || !opts.onAdd) return; var ok = opts.onAdd(raw); if (ok !== false) done(raw); }
    var max = function () { return list.length - 1 + (canAdd ? 1 : 0); };
    opts.container.addEventListener('focusin', function (e) { if (e.target.matches(sel)) { input = e.target; cur = -1; draw(!input.value.trim()); } });
    opts.container.addEventListener('click', function (e) { if (e.target.matches(sel)) { input = e.target; if (!box) draw(!input.value.trim()); } });
    opts.container.addEventListener('input', function (e) { if (e.target.matches(sel)) { input = e.target; cur = String(input.value).trim() ? 0 : -1; draw(false); if (cur === 0 && !list.length && canAdd) { cur = 0; draw(false); } } });
    opts.container.addEventListener('keydown', function (e) {
      if (!e.target.matches(sel)) return;
      if (!box && e.key === 'ArrowDown') { input = e.target; draw(!input.value.trim()); e.preventDefault(); return; }
      if (!box) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(max(), cur + 1); draw(!input.value.trim() && cur < 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); draw(false); }
      else if (e.key === 'Enter' && cur >= 0) { e.preventDefault(); if (cur < list.length) pick(cur); else if (canAdd) addNew(); }
      else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('mousedown', function (e) {
      var it = e.target.closest && e.target.closest('#upPop .it'), ad = e.target.closest && e.target.closest('#upPop .add');
      if (it) { e.preventDefault(); pick(Number(it.getAttribute('data-i'))); return; }
      if (ad) { e.preventDefault(); addNew(); return; }
      if (box && !(e.target.matches && e.target.matches(sel))) close();
    });
    window.addEventListener('scroll', function (e) { if (box && !(e.target && e.target.id === 'upPop')) draw(!input.value.trim()); }, true);
    return { close: close };
  }

  global.UnitPicker = { attach: attach, search: search, UNITS: UNITS };
})(window);
