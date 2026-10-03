/* Trang Đơn giá – Định mức = công cụ KIỂM SOÁT CƠ SỞ DỮ LIỆU cho mọi sheet DGDM- (xem / tìm / lọc tỉnh / thêm / sửa / nhân bản / xoá).
 * 2026-10-04: GIAO DIỆN LÀM LẠI — khung (thanh tab, thanh công cụ, bảng, phân trang) là HTML cố định trong dgdm.html; file này CHỈ nạp dữ liệu từ Google Sheet
 * vào khung và ghi thay đổi ngược lại. Kiểu hiển thị từng cột (mã ghim trái, tên xuống dòng, giá căn phải…) suy từ tên cột nên thêm/đổi cột trên Sheet không vỡ khung.
 * API (gsheets-api-v2.js): getDgdmStatus (danh sách sheet), getDgdmRows (đọc có phân trang), dgdmWrite (op update|add|delete; all = mọi tỉnh).
 * Mọi thay đổi ghi vào sheet "DGDM-Nhật ký thay đổi" (xoá thì lưu nguyên dòng cũ). Không đụng "DGDM-Cài đặt" (khoá API).
 * Quyền sửa: Founder/CEO/GĐ/Quản lý (roleLevel admin|manager) — người khác chỉ xem.
 * Phím tắt: "/" tìm kiếm · ↑↓ chọn dòng · Enter hoặc nhấp đúp = sửa · N = thêm dòng · Esc đóng hộp · Ctrl+Enter = lưu.
 */
(function () {
  'use strict';
  var API = (typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL) || '';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var PRICE_RE = /thấp|cao|^VL|^NC |^DGHT|Mức điển hình|Đơn giá|Giá /i;
  var LOG = 'DGDM-Nhật ký thay đổi';
  var ICON = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>'
  };
  var lsGet = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } };
  var st = { sheets: [], sheet: '', prov: '', q: '', offset: 0, data: null, loading: false, page: lsGet('dgdm_page', 100), comfy: lsGet('dgdm_comfy', false), hidden: lsGet('dgdm_hidden', {}), sel: -1 };

  function user() { return (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null; }
  function canEdit() { var u = user(); return !!u && (u.roleLevel === 'admin' || u.roleLevel === 'manager'); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFC').trim().toLowerCase(); }
  function isPrice(h) { return PRICE_RE.test(String(h)); }
  // Loại cột suy từ tên (để khung tự chọn cách hiển thị, không phụ thuộc Sheet có đúng/đủ cột)
  function kindOf(h) {
    h = String(h);
    if (isPrice(h)) return 'price';
    if (/^mã\b|^key$/i.test(h)) return 'code';
    if (/ghi chú|spec|phạm vi|nội dung|ví dụ|quy mô|mô tả|ncc|diễn giải/i.test(h)) return 'note';
    if (/^tên\b|^nhóm$|^hạng mục$|^giai đoạn$|^công tác|^hao phí/i.test(h)) return 'name';
    if (/^đvt|^đơn vị/i.test(h)) return 'unit';
    if (/^(số|stt|hệ số|tỷ lệ|tỉ lệ|%)/i.test(h)) return 'num';
    return 'text';
  }
  function fmtCell(h, v) { if (v === '' || v == null) return ''; if (typeof v === 'number' && isPrice(h)) return v.toLocaleString('vi-VN'); return String(v); }
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#22272E;color:#fff;border:1px solid ' + (bad ? '#C55555' : '#B8935A') + ';padding:10px 18px;border-radius:10px;font:600 .8125rem Inter,sans-serif;z-index:9000;max-width:90vw';
    t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3800);
  }
  function jget(url) { return fetch(url, { redirect: 'follow' }).then(function (r) { return r.text(); }).then(function (t) { var c = t.charAt(0); if (c === '{' || c === '[') return JSON.parse(t); throw new Error('Máy chủ trả dữ liệu lỗi'); }); }
  function post(data) {
    var f = new URLSearchParams(); f.set('action', 'dgdmWrite'); f.set('data', JSON.stringify(data));
    return fetch(API, { method: 'POST', body: f, redirect: 'follow' }).then(function (r) { return r.json(); });
  }

  // ---------- thanh tab (khung cố định trong HTML; chỉ gắn số dòng + ẩn tab chưa có sheet) ----------
  function loadSheets() {
    return jget(API + '?action=getDgdmStatus&_=' + Date.now()).then(function (s) {
      st.sheets = (s.sheets || []).filter(function (x) { return /^DGDM-/i.test(x.name) && norm(x.name) !== norm('DGDM-Cài đặt'); });
      if (!st.sheet) { var first = st.sheets.filter(function (x) { return x.name === 'DGDM-Mã công việc công tác'; })[0] || st.sheets[0]; st.sheet = first ? first.name : ''; }
      renderTabs();
    });
  }
  function renderTabs() {
    var by = {}; st.sheets.forEach(function (x) { by[x.name] = x; });
    var known = {};
    Array.prototype.forEach.call($('dbTabsWrap').querySelectorAll('[data-s]'), function (b) {
      var x = by[b.dataset.s]; known[b.dataset.s] = 1;
      b.hidden = !x; if (!x) return;
      b.classList.toggle('on', b.dataset.s === st.sheet);
      b.querySelector('em').textContent = (x.rows || 0).toLocaleString('vi-VN');
    });
    var extra = $('dbTabsExtra'), rest = st.sheets.filter(function (x) { return !known[x.name]; });
    extra.innerHTML = rest.length ? '<span class="db-tab-sep"></span><span class="db-tab-g">Khác</span>' + rest.map(function (x) { return '<button type="button" class="db-tab' + (x.name === st.sheet ? ' on' : '') + '" data-s="' + esc(x.name) + '">' + esc(x.name.replace(/^DGDM-/, '')) + '<em>' + (x.rows || 0).toLocaleString('vi-VN') + '</em></button>'; }).join('') : '';
  }

  // ---------- bảng dữ liệu ----------
  function skeleton() {
    var tr = '', i, j;
    for (i = 0; i < 9; i++) { tr += '<tr class="db-skel">'; for (j = 0; j < 6; j++) tr += '<td><i style="width:' + (30 + ((i * 7 + j * 13) % 60)) + '%"></i></td>'; tr += '</tr>'; }
    $('dbHead').innerHTML = ''; $('dbBody').innerHTML = tr; $('dbFootInfo').textContent = 'Đang tải ' + st.sheet.replace(/^DGDM-/, '') + '…';
  }
  function loadRows() {
    if (!st.sheet) return Promise.resolve();
    st.loading = true; skeleton();
    var url = API + '?action=getDgdmRows&sheet=' + encodeURIComponent(st.sheet) + '&province=' + encodeURIComponent(st.prov) + '&q=' + encodeURIComponent(st.q) + '&offset=' + st.offset + '&limit=' + st.page;
    return jget(url).then(function (d) {
      st.loading = false;
      if (d.error) { $('dbBody').innerHTML = '<tr><td class="es-empty" style="padding:30px">' + esc(d.error) + '</td></tr>'; return; }
      st.data = d; st.sel = -1;
      if (d.provinces && d.provinces.length && !st.prov && st.sheet !== LOG) { st.prov = d.provinces.indexOf('Hải Phòng') !== -1 ? 'Hải Phòng' : d.provinces[0]; return loadRows(); }
      render();
    }).catch(function () { st.loading = false; $('dbBody').innerHTML = '<tr><td class="es-empty" style="padding:30px">Không tải được dữ liệu (kiểm tra kết nối) — bấm Tải lại.</td></tr>'; });
  }
  function provCol() { var h = (st.data && st.data.headers) || []; return h.indexOf('Tỉnh/Thành'); }
  function visibleCols() {
    var d = st.data, h = d.headers || [], pi = provCol(), hid = st.hidden[st.sheet] || [];
    return h.map(function (x, i) { return { h: x, i: i, k: kindOf(x) }; }).filter(function (c) { return c.h !== '' && (c.i !== pi || !st.prov) && hid.indexOf(c.h) === -1; });
  }
  function render() {
    var d = st.data, ro = d.readonly || !canEdit(), pi = provCol(), cols = visibleCols();
    // thanh công cụ (khung có sẵn — chỉ cập nhật nội dung/hiện ẩn)
    $('dbTitle').textContent = d.sheet.replace(/^DGDM-/, '');
    $('dbSub').textContent = (d.total || 0).toLocaleString('vi-VN') + ' dòng' + (st.prov ? ' · ' + st.prov : '') + (st.q ? ' · lọc “' + st.q + '”' : '');
    var ps = $('dbProv');
    if (d.provinces && d.provinces.length) { ps.hidden = false; ps.innerHTML = d.provinces.map(function (p) { return '<option' + (p === st.prov ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join(''); } else ps.hidden = true;
    if (document.activeElement !== $('dbQ')) $('dbQ').value = st.q;
    $('dbAdd').hidden = ro; $('dbRo').hidden = !(ro && st.sheet !== LOG && !canEdit());
    $('dbDens').classList.toggle('on', st.comfy); $('dbTable').classList.toggle('db-comfy', st.comfy);
    // cột hiện (hộp chọn cột)
    var hid = st.hidden[st.sheet] || [];
    $('dbColList').innerHTML = (d.headers || []).filter(function (x, i) { return x !== '' && !(i === pi && st.prov); }).map(function (x) { return '<label><input type="checkbox" data-col="' + esc(x) + '"' + (hid.indexOf(x) === -1 ? ' checked' : '') + '> ' + esc(x) + '</label>'; }).join('');
    // đầu bảng + thân bảng
    var pin = cols.filter(function (c) { return c.k === 'code'; })[0];
    $('dbHead').innerHTML = '<tr><th class="db-rn">#</th>' + cols.map(function (c) { return '<th class="' + (c.k === 'price' || c.k === 'num' ? 'num' : '') + (pin && c.i === pin.i ? ' db-pin' : '') + '">' + esc(c.h) + '</th>'; }).join('') + (ro ? '' : '<th class="db-act-h"></th>') + '</tr>';
    var rows = (d.rows || []).map(function (r, ri) {
      return '<tr data-r="' + r.r + '" data-i="' + ri + '"><td class="db-rn">' + r.r + '</td>' + cols.map(function (c) {
        var txt = fmtCell(c.h, r.v[c.i]), cls = 'k-' + c.k + (c.k === 'price' || c.k === 'num' ? ' num' : '') + (pin && c.i === pin.i ? ' db-pin' : '');
        var inner = (c.k === 'name' || c.k === 'note') ? '<div>' + esc(txt) + '</div>' : esc(txt);
        return '<td class="' + cls + '"' + (txt.length > 40 ? ' title="' + esc(txt) + '"' : '') + '>' + inner + '</td>';
      }).join('') + (ro ? '' : '<td class="db-act"><button type="button" class="db-a" data-a="edit" title="Sửa (Enter)">' + ICON.edit + '</button><button type="button" class="db-a" data-a="copy" title="Nhân bản thành dòng mới">' + ICON.copy + '</button><button type="button" class="db-a danger" data-a="del" title="Xoá">' + ICON.del + '</button></td>') + '</tr>';
    }).join('');
    $('dbBody').innerHTML = rows || '<tr><td colspan="' + (cols.length + 2) + '" class="es-empty" style="padding:30px;text-align:center">Không có dòng nào' + (st.q ? ' khớp “' + esc(st.q) + '”' : '') + '.</td></tr>';
    // phân trang
    var from = d.total ? d.offset + 1 : 0, to = Math.min(d.offset + st.page, d.total);
    $('dbFootInfo').textContent = d.total ? 'Hiện ' + from.toLocaleString('vi-VN') + '–' + to.toLocaleString('vi-VN') + ' / ' + d.total.toLocaleString('vi-VN') + ' dòng' : '0 dòng';
    $('dbPrev').disabled = !d.offset; $('dbNext').disabled = to >= d.total; $('dbPgNo').textContent = Math.floor(d.offset / st.page) + 1 + ' / ' + Math.max(1, Math.ceil(d.total / st.page));
    $('dbPageSize').value = String(st.page);
  }
  function selectRow(i, scroll) {
    var trs = $('dbBody').querySelectorAll('tr[data-i]'); if (!trs.length) return;
    i = Math.max(0, Math.min(trs.length - 1, i)); st.sel = i;
    Array.prototype.forEach.call(trs, function (t, k) { t.classList.toggle('sel', k === i); });
    if (scroll) trs[i].scrollIntoView({ block: 'nearest' });
  }
  function rowAt(tr) { var rn = +tr.dataset.r; return (st.data.rows || []).filter(function (x) { return x.r === rn; })[0]; }
  function bind() {
    var t, q = $('dbQ');
    q.addEventListener('input', function () { clearTimeout(t); var v = q.value; t = setTimeout(function () { st.q = v.trim(); st.offset = 0; loadRows().then(function () { var e = $('dbQ'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }); }, 450); });
    $('dbProv').addEventListener('change', function () { st.prov = this.value; st.offset = 0; loadRows(); });
    $('dbReload').addEventListener('click', function () { loadRows(); loadSheets(); });
    $('dbAdd').addEventListener('click', function () { openForm(null); });
    $('dbPrev').addEventListener('click', function () { st.offset = Math.max(0, st.offset - st.page); loadRows(); });
    $('dbNext').addEventListener('click', function () { st.offset += st.page; loadRows(); });
    $('dbPageSize').addEventListener('change', function () { st.page = +this.value; lsSet('dgdm_page', st.page); st.offset = 0; loadRows(); });
    $('dbDens').addEventListener('click', function () { st.comfy = !st.comfy; lsSet('dgdm_comfy', st.comfy); $('dbTable').classList.toggle('db-comfy', st.comfy); this.classList.toggle('on', st.comfy); });
    $('dbCols').addEventListener('click', function (e) { e.stopPropagation(); $('dbColPop').hidden = !$('dbColPop').hidden; });
    document.addEventListener('click', function (e) { if (!e.target.closest('.db-tool')) $('dbColPop').hidden = true; });
    $('dbColList').addEventListener('change', function (e) {
      var c = e.target.closest('[data-col]'); if (!c) return;
      var hid = (st.hidden[st.sheet] || []).filter(function (x) { return x !== c.dataset.col; }); if (!c.checked) hid.push(c.dataset.col);
      st.hidden[st.sheet] = hid; lsSet('dgdm_hidden', st.hidden); render();
    });
    $('dbColAll').addEventListener('click', function () { st.hidden[st.sheet] = []; lsSet('dgdm_hidden', st.hidden); render(); });
    $('dbTabsWrap').addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      st.sheet = b.dataset.s; st.prov = ''; st.q = ''; st.offset = 0; renderTabs(); loadRows();
    });
    $('dbBody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-i]'); if (!tr) return;
      selectRow(+tr.dataset.i);
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var row = rowAt(tr); if (!row) return;
      if (b.dataset.a === 'edit') openForm(row); else if (b.dataset.a === 'copy') openForm(null, row); else askDelete(row);
    });
    $('dbBody').addEventListener('dblclick', function (e) { var tr = e.target.closest('tr[data-i]'); if (!tr || !canEdit() || (st.data && st.data.readonly)) return; var row = rowAt(tr); if (row) openForm(row); });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (document.querySelector('.es-overlay')) { if (e.key === 'Escape') { var ov = document.querySelector('.es-overlay'); ov.remove(); } return; }
      if (e.key === '/' && !typing) { e.preventDefault(); $('dbQ').focus(); return; }
      if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); selectRow(st.sel + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectRow(Math.max(0, st.sel - 1), true); }
      else if (e.key === 'Enter' && st.sel >= 0 && canEdit()) { var tr = $('dbBody').querySelector('tr[data-i="' + st.sel + '"]'); var row = tr && rowAt(tr); if (row) openForm(row); }
      else if ((e.key === 'n' || e.key === 'N') && canEdit() && st.data && !st.data.readonly) { e.preventDefault(); openForm(null); }
    });
  }

  // ---------- 2026-10-03: QUY ƯỚC MÃ v2 (bản chốt) — tự gợi ý + kiểm tra khi thêm/sửa ----------
  // Lớp 1 Mã công việc [GĐ]-[HM]-[STT 3 số] (900–999 dành cho phát sinh/VO) · Lớp 2 Mã tài nguyên [Loại]-[Nhóm 2 ký tự]-[STT] (VL/M 4 số, NC 2 số)
  // Đơn giá sơ bộ theo m²: SB-[TH|TG|NC]-[loại nhà] · Loại đơn giá: CT chi tiết · TG trọn gói · NCK nhân công khoán · SB sơ bộ theo m²
  var CONV = {
    'DGDM-Mã công việc công tác': { re: /^[A-Z]+(-[A-Z]+){1,2}-\d{3}$/, hint: '[Giai đoạn]-[Hạng mục]-[STT 3 số], VD TH-BT-001 (900–999 cho phát sinh/VO)', key: 'Hạng mục', digits: 3, loai: 'CT' },
    'DGDM-Vật tư thiết bị': { re: /^(VL|M)-[A-Z]{2}-\d{4}$|^NC-[A-Z]{2}-\d{2}$/, hint: '[Loại]-[Nhóm 2 ký tự]-[STT]: VL-BT-0001, M-DK-0001 (4 số), NC-KS-01 (2 số)', key: 'Nhóm tài nguyên' },
    'DGDM-Nhân công khoán': { re: /^SB-NC-[A-Z0-9]+$/, hint: 'SB-NC-[loại nhà], VD SB-NC-C4', loai: 'SB' },
    'DGDM-Phần thô và trọn gói': { re: /^SB-TH-[A-Z0-9]+$/, hint: 'SB-TH-[loại nhà] (Mã trọn gói: SB-TG-[loại nhà]), VD SB-TH-C4 / SB-TG-C4', loai: 'SB' }
  };
  var CAT = { hm: null, gr: null };
  function loadCats() {
    if (CAT.hm) return Promise.resolve(CAT);
    var get = function (s) { return jget(API + '?action=getDgdmRows&sheet=' + encodeURIComponent(s) + '&limit=500').then(function (d) { return d; }); };
    return Promise.all([get('DGDM-Giai đoạn hạng mục'), get('DGDM-Nhóm tài nguyên')]).then(function (r) {
      var a = r[0], b = r[1], ix = function (d, n) { return (d.headers || []).indexOf(n); };
      CAT.hm = {}; (a.rows || []).forEach(function (x) { var k = String(x.v[ix(a, 'Mã hạng mục')] || '').trim(); if (k) CAT.hm[k] = { gd: String(x.v[ix(a, 'Mã GĐ')] || ''), name: String(x.v[ix(a, 'Tên giai đoạn')] || '') + ' – ' + String(x.v[ix(a, 'Tên hạng mục')] || '') }; });
      CAT.gr = {}; (b.rows || []).forEach(function (x) { var k = String(x.v[ix(b, 'Mã nhóm')] || '').trim(); if (k) CAT.gr[k] = { loai: String(x.v[ix(b, 'Loại')] || ''), name: String(x.v[ix(b, 'Tên nhóm')] || '') }; });
      return CAT;
    });
  }
  // Số thứ tự kế tiếp cho 1 tiền tố (VD "TH-BT-" → TH-BT-009), tra trên tỉnh đang chọn; bỏ dải 900–999 của mã công việc
  function nextCode(prefix, digits) {
    var url = API + '?action=getDgdmRows&sheet=' + encodeURIComponent(st.data.sheet) + '&province=' + encodeURIComponent(st.prov) + '&q=' + encodeURIComponent(prefix) + '&limit=500';
    return jget(url).then(function (d) {
      var mi = (d.headers || []).indexOf('Mã'), max = 0;
      (d.rows || []).forEach(function (x) { var m = String(x.v[mi] || ''); if (m.indexOf(prefix) !== 0) return; var n = parseInt(m.slice(prefix.length), 10); if (n && n < (digits === 3 ? 900 : 1e9) && n > max) max = n; });
      return prefix + String(max + 1).padStart(digits, '0');
    });
  }
  function wireConv(ov, isAdd) {
    var c = CONV[st.data.sheet]; if (!c) return;
    var f = function (h) { return ov.querySelector('[data-h="' + h + '"]'); }, ma = f('Mã'), note = document.createElement('div');
    note.className = 'db-conv'; note.innerHTML = '<b>Quy ước mã v2:</b> ' + esc(c.hint) + (c.key ? ' — nhập <b>' + esc(c.key) + '</b> để tự gợi ý mã kế tiếp.' : '');
    ov.querySelector('.db-form').before(note);
    if (isAdd && c.loai && f('Loại đơn giá') && !f('Loại đơn giá').value) f('Loại đơn giá').value = c.loai;
    if (!c.key || !f(c.key)) return;
    loadCats().then(function (cat) {
      var key = f(c.key), dl = document.createElement('datalist'), src = c.key === 'Hạng mục' ? cat.hm : cat.gr;
      dl.id = 'dbDl' + Date.now(); dl.innerHTML = Object.keys(src).map(function (k) { return '<option value="' + esc(k) + '">' + esc(src[k].name) + '</option>'; }).join('');
      ov.appendChild(dl); key.setAttribute('list', dl.id); key.setAttribute('autocomplete', 'off');
      var apply = function () {
        var k = key.value.trim().toUpperCase(); key.value = k; var it = src[k]; if (!it) return;
        if (f('Nhóm')) f('Nhóm').value = it.name;
        if (c.key === 'Hạng mục' && f('Giai đoạn')) f('Giai đoạn').value = it.gd;
        if (!isAdd || (ma.value && ma.dataset.auto !== '1')) return;
        var digits = c.digits || (it.loai === 'NC' || /^NC-/.test(k) ? 2 : 4);
        ma.placeholder = 'Đang tìm số kế tiếp…';
        nextCode(k + '-', digits).then(function (code) { if (!ma.value || ma.dataset.auto === '1') { ma.value = code; ma.dataset.auto = '1'; } ma.placeholder = ''; }, function () { ma.placeholder = ''; });
      };
      key.addEventListener('change', apply); key.addEventListener('blur', apply);
      ma.addEventListener('input', function () { ma.dataset.auto = ''; });
    }).catch(function () {});
  }
  function convError(vals) {
    var c = CONV[st.data.sheet]; if (!c) return '';
    if ('Mã' in vals && !c.re.test(String(vals['Mã']).trim())) return 'Mã "' + vals['Mã'] + '" chưa đúng quy ước: ' + c.hint;
    if (st.data.sheet === 'DGDM-Mã công việc công tác' && vals['Mã'] && vals['Hạng mục'] && String(vals['Mã']).indexOf(String(vals['Hạng mục']).trim() + '-') !== 0) return 'Mã công việc phải bắt đầu bằng Hạng mục "' + vals['Hạng mục'] + '-"';
    if (st.data.sheet === 'DGDM-Vật tư thiết bị' && vals['Mã'] && vals['Nhóm tài nguyên'] && String(vals['Mã']).indexOf(String(vals['Nhóm tài nguyên']).trim() + '-') !== 0) return 'Mã tài nguyên phải bắt đầu bằng Nhóm tài nguyên "' + vals['Nhóm tài nguyên'] + '-"';
    if (st.data.sheet === 'DGDM-Phần thô và trọn gói' && vals['Mã trọn gói'] && !/^SB-TG-[A-Z0-9]+$/.test(String(vals['Mã trọn gói']).trim())) return 'Mã trọn gói phải dạng SB-TG-[loại nhà]';
    return '';
  }

  // ---------- form thêm / sửa / nhân bản ----------
  function keyExpect(row) {   // các cột dùng để máy chủ kiểm tra dòng chưa bị người khác đổi
    var h = st.data.headers, ex = {};
    ['Tỉnh/Thành', 'Mã'].forEach(function (k) { var i = h.indexOf(k); if (i !== -1) ex[k] = row.v[i]; });
    if (!Object.keys(ex).length) { var j = h.findIndex(function (x) { return x !== ''; }); if (j !== -1) ex[h[j]] = row.v[j]; }
    return ex;
  }
  var SEC_TITLES = { id: 'Định danh & phân loại', desc: 'Mô tả chi tiết', val: 'Giá & số liệu' };
  function fieldHtml(x, i, isAdd, row, src, pi) {
    var v = isAdd ? (i === pi ? st.prov : (src ? src.v[i] : '')) : row.v[i], val = v == null ? '' : String(v), k = kindOf(x);
    var long = k === 'note' || val.length > 70 || k === 'name' && val.length > 40;
    var dis = !isAdd && i === pi ? ' disabled' : '';
    var cls = 'db-f' + (k === 'note' ? ' full' : (long || k === 'name') ? ' wide' : '');
    return '<label class="' + cls + '"><span class="es-label">' + esc(x) + (k === 'price' ? ' <i>(số)</i>' : '') + '</span>' +
      (long ? '<textarea class="es-input db-ta" data-h="' + esc(x) + '"' + dis + '>' + esc(val) + '</textarea>' : '<input class="es-input' + (k === 'price' ? ' num' : '') + '" data-h="' + esc(x) + '" value="' + esc(val) + '"' + dis + (k === 'price' ? ' inputmode="decimal"' : '') + '>') + '</label>';
  }
  function openForm(row, src) {
    var h = st.data.headers, pi = provCol(), isAdd = !row, hasProv = pi !== -1, idx = row ? (st.data.rows || []).indexOf(row) : -1;
    var secs = { id: '', desc: '', val: '' };
    h.forEach(function (x, i) {
      if (!x) return;
      var k = kindOf(x), sec = k === 'price' || k === 'num' ? 'val' : (k === 'note' || k === 'name') ? 'desc' : 'id';
      secs[sec] += fieldHtml(x, i, isAdd, row, src, pi);
    });
    var body = ['id', 'desc', 'val'].filter(function (s) { return secs[s]; }).map(function (s) { return '<section class="db-sec"><h4>' + SEC_TITLES[s] + '</h4><div class="db-grid">' + secs[s] + '</div></section>'; }).join('');
    var opt = hasProv ? (isAdd ? '<label class="db-chk"><input type="checkbox" id="dbAll"> Thêm cho <b>mọi tỉnh</b> (' + ((st.data.provinces || []).length) + ' tỉnh) — giá chỉ ghi cho tỉnh đang chọn, tỉnh khác để trống</label>'
      : '<label class="db-chk"><input type="checkbox" id="dbAll"> Áp dụng thay đổi các cột <b>không phải giá</b> (tên, ĐVT, mã, nhóm…) cho <b>cùng mã ở mọi tỉnh</b></label>') : '';
    var hasNext = !isAdd && idx !== -1 && idx < (st.data.rows || []).length - 1;
    var ov = document.createElement('div'); ov.className = 'es-overlay';
    ov.innerHTML = '<div class="es-modal db-modal"><h2><span>' + (isAdd ? (src ? 'Nhân bản thành dòng mới' : 'Thêm dòng mới') : 'Sửa dòng ' + row.r) + ' — ' + esc(st.data.sheet.replace(/^DGDM-/, '')) + (st.prov ? ' · ' + esc(st.prov) : '') + '</span><button class="es-x" type="button">×</button></h2>' +
      '<div class="db-form">' + body + '</div>' + opt +
      '<div class="db-foot"><span class="es-note">Nhật ký thay đổi tự ghi · <span class="db-key">Ctrl</span>+<span class="db-key">Enter</span> lưu · <span class="db-key">Esc</span> đóng</span><span class="es-spacer"></span><button class="es-btn" type="button" data-x>Huỷ</button>' +
      (hasNext ? '<button class="es-btn" type="button" id="dbSaveNext" title="Lưu rồi mở dòng kế tiếp">Lưu &amp; dòng kế tiếp ›</button>' : '') +
      '<button class="es-btn es-btn-primary" type="button" id="dbSave">' + (isAdd ? 'Thêm' : 'Lưu thay đổi') + '</button></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    ov.querySelector('.es-x').onclick = close; ov.querySelector('[data-x]').onclick = close;
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    var first = ov.querySelector('.db-form input:not([disabled]), .db-form textarea:not([disabled])'); if (first) { first.focus(); try { first.select(); } catch (e) { /* bỏ qua */ } }
    wireConv(ov, isAdd);
    var save = function (btn, goNext) {
      var vals = {}, changed = {};
      ov.querySelectorAll('[data-h]').forEach(function (el) { if (el.disabled) return; var k = el.dataset.h; vals[k] = el.value.trim(); });
      h.forEach(function (x, i) { if (!x || !(x in vals)) return; var old = isAdd ? '' : String(row.v[i] == null ? '' : row.v[i]); if (vals[x] !== old) changed[x] = vals[x]; });
      var all = $('dbAll') && $('dbAll').checked, u = user(), actor = u ? (u.name || u.id) : '';
      var openAfter = function (n) { var nr = (st.data.rows || [])[n]; if (nr) openForm(nr); };
      var cerr = convError(isAdd ? vals : changed); if (cerr) { toast(cerr, true); return; }
      if (!isAdd && !Object.keys(changed).length) { close(); if (goNext) openAfter(idx + 1); return; }
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Đang lưu…';
      var done = function (r) {
        btn.disabled = false; btn.textContent = label;
        if (!r || r.ok === false || r.error) { toast((r && r.error) || 'Lưu không thành công', true); return; }
        close(); toast(isAdd ? 'Đã thêm ' + (r.added || 1) + ' dòng' + (r.skipped ? ' (bỏ qua ' + r.skipped + ' tỉnh đã có mã này)' : '') : 'Đã lưu' + (r.rows > 1 ? ' cho ' + r.rows + ' dòng (mọi tỉnh)' : ''));
        loadSheets(); loadRows().then(function () { if (goNext) openAfter(idx + 1); else if (!isAdd && idx !== -1) selectRow(idx, true); });
      };
      var fail = function () { btn.disabled = false; btn.textContent = label; toast('Không gửi được (kiểm tra kết nối)', true); };
      if (isAdd) { post({ op: 'add', sheet: st.data.sheet, values: vals, all: !!all, province: st.prov, actor: actor }).then(done, fail); return; }
      var shared = {}, price = {};
      Object.keys(changed).forEach(function (k) { (isPrice(k) ? price : shared)[k] = changed[k]; });
      if (all && Object.keys(shared).length) {
        post({ op: 'update', sheet: st.data.sheet, row: row.r, expect: keyExpect(row), values: shared, all: true, actor: actor }).then(function (r) {
          if (!r || r.ok === false || !Object.keys(price).length) return done(r);
          var ex = keyExpect(row); if ('Mã' in shared) ex['Mã'] = shared['Mã'];
          post({ op: 'update', sheet: st.data.sheet, row: row.r, expect: ex, values: price, actor: actor }).then(done, fail);
        }, fail);
      } else post({ op: 'update', sheet: st.data.sheet, row: row.r, expect: keyExpect(row), values: changed, actor: actor }).then(done, fail);
    };
    $('dbSave').onclick = function () { save(this, false); };
    if ($('dbSaveNext')) $('dbSaveNext').onclick = function () { save(this, true); };
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save($('dbSave'), false); } });
  }
  function askDelete(row) {
    var h = st.data.headers, pi = provCol(), mi = h.indexOf('Mã'), label = (mi !== -1 ? row.v[mi] + ' — ' : '') + (row.v[h.findIndex(function (x, i) { return x && i !== pi && i !== mi && typeof row.v[i] === 'string' && row.v[i].length > 2; })] || '');
    var ov = document.createElement('div'); ov.className = 'es-overlay';
    ov.innerHTML = '<div class="es-modal" style="max-width:520px"><h2><span>Xoá dòng ' + row.r + '?</span><button class="es-x" type="button">×</button></h2><p style="margin:0 0 10px;font-size:.875rem">' + esc(String(label).slice(0, 160)) + '</p>' +
      (pi !== -1 && mi !== -1 ? '<label class="db-chk"><input type="checkbox" id="dbDelAll"> Xoá mã <b>' + esc(row.v[mi]) + '</b> ở <b>mọi tỉnh</b></label>' : '') +
      '<p class="es-note" style="margin:10px 0 0">Dòng bị xoá được lưu nguyên vào “Nhật ký thay đổi” để khôi phục khi cần.</p>' +
      '<div class="db-foot"><span class="es-spacer"></span><button class="es-btn" type="button" data-x>Huỷ</button><button class="es-btn es-btn-danger" type="button" id="dbDelOk">Xoá</button></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    ov.querySelector('.es-x').onclick = close; ov.querySelector('[data-x]').onclick = close;
    $('dbDelOk').onclick = function () {
      var btn = this, u = user(); btn.disabled = true; btn.textContent = 'Đang xoá…';
      post({ op: 'delete', sheet: st.data.sheet, row: row.r, expect: keyExpect(row), all: !!($('dbDelAll') && $('dbDelAll').checked), actor: u ? (u.name || u.id) : '' }).then(function (r) {
        if (!r || r.ok === false || r.error) { btn.disabled = false; btn.textContent = 'Xoá'; toast((r && r.error) || 'Xoá không thành công', true); return; }
        close(); toast('Đã xoá ' + (r.deleted || 1) + ' dòng'); loadRows(); loadSheets();
      }, function () { btn.disabled = false; btn.textContent = 'Xoá'; toast('Không gửi được (kiểm tra kết nối)', true); });
    };
  }

  function boot() {
    if (!API) { $('dbBody').innerHTML = '<tr><td class="es-empty" style="padding:30px">Chưa cấu hình API.</td></tr>'; return; }
    bind();
    loadSheets().then(loadRows).catch(function (e) { if (window.console) console.error('DGDM:', e); $('dbBody').innerHTML = '<tr><td class="es-empty" style="padding:30px">Không tải được danh sách sheet (kiểm tra kết nối).</td></tr>'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
