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
  // 2026-10-04: KHUNG CỘT CỐ ĐỊNH — tên cột của từng sheet có sẵn trong code (FRAME) và được nhớ lại sau mỗi lần tải (HDR cache) nên đầu bảng + khung dòng hiện NGAY,
  // trang không còn xoá khung rồi chờ Google Sheet; dữ liệu tải về sau chỉ điền vào. Cột mới/đổi tên trên Sheet vẫn được cập nhật khi dữ liệu về.
  var FRAME = {
    'DGDM-Giai đoạn hạng mục': ['Mã GĐ', 'Tên giai đoạn', 'Mã hạng mục', 'Tên hạng mục', 'Phạm vi công việc', 'Nhóm chi phí dự toán', 'Đưa vào phần mềm dự toán?', 'Mã cũ tương ứng'],
    'DGDM-Đơn vị tính': ['ĐVT chuẩn', 'ĐVT cũ trên app', 'Số dòng (lúc đối chiếu)', 'Chuyển thành', 'Ghi chú điều kiện đo'],
    'DGDM-Nhóm tài nguyên': ['Loại', 'Nhóm', 'Tên nhóm', 'Ví dụ']
  };
  var HDR = lsGet('dgdm_hdr', {}), PROV = lsGet('dgdm_prov', {});
  function frameOf(sheet) { return HDR[sheet] || FRAME[sheet] || null; }
  var st = { sheets: [], sheet: '', prov: '', all: false, q: '', offset: 0, data: null, loading: false, page: lsGet('dgdm_page', 100), comfy: lsGet('dgdm_comfy', false), hidden: lsGet('dgdm_hidden', {}), sel: -1 };

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
  function jget(url) {
    var ctl = window.AbortController ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, 60000) : 0;
    return fetch(url, { redirect: 'follow', signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.text(); }).then(function (t) { clearTimeout(tm); var c = t.charAt(0); if (c === '{' || c === '[') return JSON.parse(t); throw new Error('Máy chủ trả dữ liệu lỗi'); }, function (e) { clearTimeout(tm); throw e; });
  }
  function post(data) {
    var f = new URLSearchParams(); f.set('action', 'dgdmWrite'); f.set('data', JSON.stringify(data));
    return fetch(API, { method: 'POST', body: f, redirect: 'follow' }).then(function (r) { return r.json(); });
  }

  // ---------- thanh tab (khung cố định trong HTML; chỉ gắn số dòng + ẩn tab chưa có sheet) ----------
  // đoán tỉnh ngay từ đầu (đã chọn lần trước, hoặc Hải Phòng nếu sheet có cột Tỉnh/Thành) để KHÔNG phải tải thêm 1 vòng chỉ để biết danh sách tỉnh
  function guessProv(sheet) {
    if (PROV[sheet] === '*') return '';   // đã chọn "Tất cả các tỉnh"
    if (PROV[sheet]) return PROV[sheet];
    var h = frameOf(sheet); return h && h.indexOf('Tỉnh/Thành') !== -1 ? 'Hải Phòng' : '';
  }
  function setProvFor(sheet) { st.prov = guessProv(sheet); st.all = PROV[sheet] === '*'; }
  function loadSheets() {
    return jget(API + '?action=getDgdmStatus&_=' + Date.now()).then(function (s) {
      st.sheets = (s.sheets || []).filter(function (x) { return /^DGDM-/i.test(x.name) && norm(x.name) !== norm('DGDM-Cài đặt') && norm(x.name) !== norm('DGDM-Quy đổi ĐVT cũ'); });   // 2026-10-04: bỏ tab Quy đổi ĐVT cũ
      if (!st.sheet) { var first = st.sheets.filter(function (x) { return x.name === 'DGDM-Mã công việc công tác'; })[0] || st.sheets[0]; st.sheet = first ? first.name : ''; }
      renderTabs();
    });
  }
  function renderTabs() {
    var by = {}; st.sheets.forEach(function (x) { by[x.name] = x; });
    var known = {};
    Array.prototype.forEach.call($('dbTabsWrap').querySelectorAll('[data-s]'), function (b) {
      var x = by[b.dataset.s]; known[b.dataset.s] = 1;
      b.hidden = !x; if (!x) return; b.title = (x.rows || 0).toLocaleString('vi-VN') + ' dòng trong cả bảng (mọi tỉnh)';
      b.classList.toggle('on', b.dataset.s === st.sheet);
      b.querySelector('em').textContent = (x.rows || 0).toLocaleString('vi-VN');
    });
    var extra = $('dbTabsExtra'), rest = st.sheets.filter(function (x) { return !known[x.name]; });
    extra.innerHTML = rest.length ? '<div class="db-tgrp"><span class="db-tab-g">Khác</span><div class="db-tgl">' + rest.map(function (x) { return '<button type="button" class="db-tab' + (x.name === st.sheet ? ' on' : '') + '" data-s="' + esc(x.name) + '">' + esc(x.name.replace(/^DGDM-/, '')) + '<em>' + (x.rows || 0).toLocaleString('vi-VN') + '</em></button>'; }).join('') + '</div></div>' : '';
  }

  // ---------- bảng dữ liệu ----------
  function skeleton() {
    var h = frameOf(st.sheet), tr = '', i, j, cols = [], pi, hid = st.hidden[st.sheet] || [];
    if (h) {
      pi = h.indexOf('Tỉnh/Thành');
      cols = h.map(function (x, k) { return { h: x, i: k, k: kindOf(x) }; }).filter(function (c) { return c.h !== '' && (c.i !== pi || !st.prov) && hid.indexOf(c.h) === -1; });
      var pin = cols.filter(function (c) { return c.k === 'code'; })[0];
      $('dbHead').innerHTML = '<tr><th class="db-rn">STT</th>' + cols.map(function (c) { return '<th class="' + (c.k === 'price' || c.k === 'num' ? 'num' : '') + (pin && c.i === pin.i ? ' db-pin' : '') + '">' + esc(c.h) + '</th>'; }).join('') + '<th class="db-act-h"></th></tr>';
    } else $('dbHead').innerHTML = '';
    var n = cols.length || 6;
    for (i = 0; i < 9; i++) { tr += '<tr class="db-skel"><td class="db-rn"></td>'; for (j = 0; j < n; j++) tr += '<td><i style="width:' + (30 + ((i * 7 + j * 13) % 60)) + '%"></i></td>'; tr += '</tr>'; }
    $('dbTitle').textContent = st.sheet.replace(/^DGDM-/, ''); $('dbBody').innerHTML = tr; $('dbFootInfo').textContent = 'Đang tải ' + st.sheet.replace(/^DGDM-/, '') + '…';
  }
  // 2026-10-04: bộ nhớ đệm theo (sheet, tỉnh, từ khoá, trang) — quay lại tab/trang đã xem thì hiện NGAY rồi cập nhật ngầm; mọi thao tác ghi xoá đệm. reqId chặn trường hợp phản hồi cũ đến sau ghi đè phản hồi mới.
  var CACHE = {}, reqId = 0;
  function loadRows(force) {
    if (!st.sheet) return Promise.resolve();
    var key = [st.sheet, st.prov, st.all ? '*' : '', st.q, st.offset, st.page].join('|'), hit = !force && CACHE[key], my = ++reqId;
    if (hit) { st.data = hit.d; st.sel = -1; render(); } else { st.loading = true; skeleton(); }
    var url = API + '?action=getDgdmRows&sheet=' + encodeURIComponent(st.sheet) + '&province=' + encodeURIComponent(st.prov) + '&q=' + encodeURIComponent(st.q) + '&offset=' + st.offset + '&limit=' + st.page;
    return jget(url).then(function (d) {
      if (my !== reqId) return;
      st.loading = false;
      if (d.error) { $('dbBody').innerHTML = '<tr><td class="es-empty" style="padding:30px">' + esc(d.error) + '</td></tr>'; return; }
      if (d.headers && d.headers.length) { HDR[st.sheet] = d.headers; lsSet('dgdm_hdr', HDR); }
      if (d.provinces && d.provinces.length && st.prov && d.provinces.indexOf(st.prov) === -1) { st.prov = ''; st.all = false; }   // tỉnh nhớ lại không còn trong sheet
      if (d.provinces && d.provinces.length && !st.prov && !st.all && st.sheet !== LOG) { st.prov = d.provinces.indexOf('Hải Phòng') !== -1 ? 'Hải Phòng' : d.provinces[0]; return loadRows(); }
      CACHE[key] = { d: d };
      var same = hit && hit.d.total === d.total && JSON.stringify(hit.d.rows) === JSON.stringify(d.rows);
      var keep = st.sel; st.data = d;
      if (!same) { st.sel = -1; render(); if (hit && keep >= 0) selectRow(keep); }
    }).catch(function () {
      if (my !== reqId) return;
      st.loading = false;
      if (!hit) $('dbBody').innerHTML = '<tr><td class="es-empty" style="padding:30px;text-align:center">Không tải được dữ liệu (mạng chậm hoặc Google Sheet không phản hồi). <button type="button" class="es-btn" data-retry style="margin-left:8px">Thử lại</button></td></tr>';
    });
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
    $('dbSub').textContent = (d.total || 0).toLocaleString('vi-VN') + ' dòng' + (st.prov ? ' · ' + st.prov : (st.all && d.provinces && d.provinces.length ? ' · tất cả ' + d.provinces.length + ' tỉnh' : '')) + (function () { var x = st.sheets.filter(function (y) { return y.name === st.sheet; })[0]; return x && x.rows && x.rows !== d.total && !st.q ? ' (toàn bảng ' + x.rows.toLocaleString('vi-VN') + ' dòng, mọi tỉnh)' : ''; })() + (st.q ? ' · lọc “' + st.q + '”' : '');
    var ps = $('dbProv');
    if (d.provinces && d.provinces.length) { ps.hidden = false; ps.innerHTML = '<option value=""' + (st.all && !st.prov ? ' selected' : '') + '>Tất cả các tỉnh</option>' + d.provinces.map(function (p) { return '<option' + (p === st.prov ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join(''); } else ps.hidden = true;
    if (document.activeElement !== $('dbQ')) $('dbQ').value = st.q;
    $('dbAdd').hidden = ro; $('dbRo').hidden = !(ro && st.sheet !== LOG && !canEdit());
    $('dbDens').classList.toggle('on', st.comfy); $('dbTable').classList.toggle('db-comfy', st.comfy);
    // cột hiện (hộp chọn cột)
    var hid = st.hidden[st.sheet] || [];
    $('dbColList').innerHTML = (d.headers || []).filter(function (x, i) { return x !== '' && !(i === pi && st.prov); }).map(function (x) { return '<label><input type="checkbox" data-col="' + esc(x) + '"' + (hid.indexOf(x) === -1 ? ' checked' : '') + '> ' + esc(x) + '</label>'; }).join('');
    // đầu bảng + thân bảng
    var pin = cols.filter(function (c) { return c.k === 'code'; })[0];
    $('dbHead').innerHTML = '<tr><th class="db-rn">STT</th>' + cols.map(function (c) { return '<th class="' + (c.k === 'price' || c.k === 'num' ? 'num' : '') + (pin && c.i === pin.i ? ' db-pin' : '') + '">' + esc(c.h) + '</th>'; }).join('') + (ro ? '' : '<th class="db-act-h"></th>') + '</tr>';
    var rows = (d.rows || []).map(function (r, ri) {
      return '<tr data-r="' + r.r + '" data-i="' + ri + '"><td class="db-rn">' + ((d.offset || 0) + ri + 1) + '</td>' + cols.map(function (c) {
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
  // 2026-10-04: số thứ tự hiển thị = 1, 2, 3… theo danh sách đang xem (đúng tỉnh/bộ lọc đang chọn), KHÔNG dùng số dòng thật trong Google Sheet (r.r vẫn dùng ngầm để sửa/xoá đúng dòng)
  function stt(row) { var i = (st.data.rows || []).indexOf(row); return (st.data.offset || 0) + (i < 0 ? 0 : i) + 1; }
  function rowAt(tr) { var rn = +tr.dataset.r; return (st.data.rows || []).filter(function (x) { return x.r === rn; })[0]; }
  function bind() {
    var t, q = $('dbQ');
    q.addEventListener('input', function () { clearTimeout(t); var v = q.value; t = setTimeout(function () { st.q = v.trim(); st.offset = 0; loadRows().then(function () { var e = $('dbQ'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }); }, 450); });
    $('dbProv').addEventListener('change', function () { st.prov = this.value; st.all = !st.prov; PROV[st.sheet] = st.prov || '*'; lsSet('dgdm_prov', PROV); st.offset = 0; loadRows(); });
    $('dbReload').addEventListener('click', function () { CACHE = {}; loadRows(true); loadSheets(); });
    $('dbBody').addEventListener('click', function (e) { if (e.target.closest('[data-retry]')) { CACHE = {}; loadRows(true); } });
    $('dbExport').addEventListener('click', exportCsv);
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
      st.sheet = b.dataset.s; setProvFor(st.sheet); st.q = ''; st.offset = 0; renderTabs(); loadRows();
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
      if (document.querySelector('.es-overlay')) { if (e.key === 'Escape') { var ov = document.querySelector('.es-overlay'); if (ov.__tryClose) ov.__tryClose(); else ov.remove(); } return; }
      if (e.key === '/' && !typing) { e.preventDefault(); $('dbQ').focus(); return; }
      if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); selectRow(st.sel + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectRow(Math.max(0, st.sel - 1), true); }
      else if (e.key === 'Enter' && st.sel >= 0 && canEdit()) { var tr = $('dbBody').querySelector('tr[data-i="' + st.sel + '"]'); var row = tr && rowAt(tr); if (row) openForm(row); }
      else if ((e.key === 'n' || e.key === 'N') && canEdit() && st.data && !st.data.readonly) { e.preventDefault(); openForm(null); }
    });
  }

  // ---------- 2026-10-03: QUY ƯỚC MÃ (form chuẩn) — tự gợi ý + kiểm tra khi thêm/sửa ----------
  // Lớp 1 Mã công việc [GĐ]-[HM]-[STT 3 số] (900–999 dành cho phát sinh/VO) · Lớp 2 Mã tài nguyên [Loại]-[Nhóm 2 ký tự]-[STT] (VL/M 4 số, NC 2 số)
  // Đơn giá sơ bộ theo m²: SB-[TH|TG|NC]-[loại nhà] · Loại đơn giá: CT chi tiết · TG trọn gói · NCK nhân công khoán · SB sơ bộ theo m²
  var CONV = {
    'DGDM-Mã công việc công tác': { re: /^[A-Z]+(-[A-Z]+){1,2}-\d{3}$/, hint: '[Giai đoạn]-[Hạng mục]-[STT 3 số], VD TH-BT-001 (900–999 cho phát sinh/VO)', key: 'Hạng mục', digits: 3, loai: 'CT' },
    'DGDM-Vật tư thiết bị': { re: /^(VL|M)-[A-Z]{2}-\d{4}$|^NC-[A-Z]{2}-\d{2}$/, hint: '[Loại]-[Nhóm 2 ký tự]-[STT]: VL-BT-0001, M-DK-0001 (4 số), NC-KS-01 (2 số)', key: 'Nhóm tài nguyên' },
    'DGDM-Nhân công khoán': { re: /^SB-NC-[A-Z0-9]+$/, hint: 'SB-NC-[loại nhà], VD SB-NC-C4', loai: 'SB' },
    'DGDM-Phần thô và trọn gói': { re: /^SB-TH-[A-Z0-9]+$/, hint: 'SB-TH-[loại nhà] (Mã trọn gói: SB-TG-[loại nhà]), VD SB-TH-C4 / SB-TG-C4', loai: 'SB' }
  };
  // mã tự sinh theo thông tin đã chọn (cột phụ thuộc → mã); partial = chỉ gợi ý tiền tố, người dùng gõ nốt
  var CODEF = { 'DGDM-Giai đoạn hạng mục': 'Mã hạng mục', 'DGDM-Nhóm tài nguyên': 'Mã nhóm' };
  var NAMEF = { 'DGDM-Mã công việc công tác': 'Công tác', 'DGDM-Vật tư thiết bị': 'Vật tư/thiết bị', 'DGDM-Giai đoạn hạng mục': 'Tên hạng mục', 'DGDM-Nhóm tài nguyên': 'Tên nhóm' };
  var AUTO = {
    'DGDM-Mã công việc công tác': { tbl: true, deps: ['Hạng mục'], ph: 'Chọn Hạng mục để tự tạo mã', make: function (f) { var k = f('Hạng mục') ? f('Hạng mục').value.trim() : ''; return k ? nextCode(k + '-', 3) : ''; } },
    'DGDM-Vật tư thiết bị': { tbl: true, deps: ['Nhóm tài nguyên'], ph: 'Chọn Nhóm tài nguyên để tự tạo mã', make: function (f) { var k = f('Nhóm tài nguyên') ? f('Nhóm tài nguyên').value.trim() : ''; return k ? nextCode(k + '-', /^NC-/.test(k) ? 2 : 4) : ''; } },
    'DGDM-Nhân công khoán': { deps: ['Loại nhà'], ph: 'Chọn Loại nhà để tự tạo mã', make: function (f) { var v = f('Loại nhà') ? f('Loại nhà').value.trim().toUpperCase().replace(/\s+/g, '') : ''; return v ? 'SB-NC-' + v : ''; } },
    'DGDM-Phần thô và trọn gói': { deps: ['Loại nhà'], ph: 'Chọn Loại nhà để tự tạo mã', make: function (f) {
      var v = f('Loại nhà') ? f('Loại nhà').value.trim().toUpperCase().replace(/\s+/g, '') : '';
      if (f('Mã trọn gói')) f('Mã trọn gói').value = v ? 'SB-TG-' + v : '';
      return v ? 'SB-TH-' + v : ''; } },
    'DGDM-Giai đoạn hạng mục': { deps: ['Mã GĐ'], partial: true, ph: 'VD TH-BT (Mã GĐ + 2 chữ)', make: function (f) { var v = f('Mã GĐ') ? f('Mã GĐ').value.trim().toUpperCase() : ''; return v ? v + '-' : ''; } },
    'DGDM-Nhóm tài nguyên': { deps: ['Loại'], partial: true, ph: 'VD VL-BT (Loại + 2 ký tự)', make: function (f) { var v = f('Loại') ? f('Loại').value.trim().toUpperCase() : ''; return v ? v + '-' : ''; } }
  };
  var CAT = { hm: null, gr: null, gd: null };
  function loadCats() {
    if (CAT.hm) return Promise.resolve(CAT);
    var get = function (s) { return jget(API + '?action=getDgdmRows&sheet=' + encodeURIComponent(s) + '&limit=500').then(function (d) { return d; }); };
    return Promise.all([get('DGDM-Giai đoạn hạng mục'), get('DGDM-Nhóm tài nguyên')]).then(function (r) {
      var a = r[0], b = r[1], ix = function (d, n) { return (d.headers || []).indexOf(n); };
      CAT.hm = {}; (a.rows || []).forEach(function (x) { var k = String(x.v[ix(a, 'Mã hạng mục')] || '').trim(); if (k) CAT.hm[k] = { gd: String(x.v[ix(a, 'Mã GĐ')] || ''), name: String(x.v[ix(a, 'Tên giai đoạn')] || '') + ' – ' + String(x.v[ix(a, 'Tên hạng mục')] || '') }; });
      CAT.gd = {}; (a.rows || []).forEach(function (x) { var k = String(x.v[ix(a, 'Mã GĐ')] || '').trim(); if (k && !CAT.gd[k]) CAT.gd[k] = String(x.v[ix(a, 'Tên giai đoạn')] || ''); });
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
  // đối chiếu với bảng: các dòng (tỉnh đang chọn) có cùng giá trị ở cột field, trừ chính dòng đang sửa
  function findSame(field, value, exceptRow) {
    var url = API + '?action=getDgdmRows&sheet=' + encodeURIComponent(st.data.sheet) + '&province=' + encodeURIComponent(st.prov) + '&q=' + encodeURIComponent(value) + '&limit=200';
    return jget(url).then(function (d) {
      var ci = (d.headers || []).indexOf(field), ni = (d.headers || []).indexOf(NAMEF[st.data.sheet] || '');
      return (d.rows || []).filter(function (r) { return norm(r.v[ci]) === norm(value) && (!exceptRow || r.r !== exceptRow.r); }).map(function (r) { return { r: r, name: ni !== -1 ? String(r.v[ni] || '') : '', code: String(r.v[(d.headers || []).indexOf(CODEF[st.data.sheet] || 'Mã')] || '') }; });
    });
  }
  function wireConv(ov, isAdd, row) {
    var sh = st.data.sheet, c = CONV[sh], cf = CODEF[sh] || 'Mã', au = AUTO[sh];
    var f = function (h) { return ov.querySelector('[data-h="' + h + '"]'); }, ma = f(cf), nf = NAMEF[sh] ? f(NAMEF[sh]) : null;
    if (c) {
      var note = document.createElement('div');
      note.className = 'db-conv'; note.innerHTML = '<b>Quy ước mã:</b> ' + esc(c.hint) + (au && !au.partial ? ' — chọn thông tin ở dưới, <b>mã tự hiện</b> và được đối chiếu với bảng để không trùng; <b>click đúp</b> vào ô Mã để sửa tay.' : '');
      ov.querySelector('.db-form').before(note);
    }
    if (isAdd && c && c.loai && f('Loại đơn giá') && !f('Loại đơn giá').value) f('Loại đơn giá').value = c.loai;
    if (!ma) return;
    var stl = document.createElement('small'); stl.className = 'db-codest'; ma.closest('label').appendChild(stl);
    var manual = !isAdd || !au, seq = 0;
    var setSt = function (msg, cls) { stl.textContent = msg; stl.className = 'db-codest ' + (cls || ''); };
    if (isAdd && au && !au.partial) {
      ma.readOnly = true; ma.classList.add('db-auto'); ma.placeholder = au.ph; ma.title = 'Click đúp để sửa tay';
      ma.addEventListener('dblclick', function () { manual = true; ma.readOnly = false; ma.classList.remove('db-auto'); ma.focus(); ma.select(); setSt('Đang sửa tay — mã sẽ được đối chiếu khi bạn rời ô', 'warn'); });
    } else if (au) ma.placeholder = au.ph;
    var check = function () {
      var code = ma.value.trim(); ma.dataset.dup = '';
      if (!code || (au && au.partial && /-$/.test(code))) { setSt(''); return Promise.resolve(); }
      var my = ++seq; setSt('Đang đối chiếu với bảng…', '');
      return findSame(cf, code, isAdd ? null : row).then(function (hit) {
        if (my !== seq) return;
        if (hit.length) { ma.dataset.dup = '1'; setSt('⚠ Mã đã có trong bảng' + (hit[0].name ? ' (“' + hit[0].name + '”)' : '') + ' — chọn số khác', 'bad'); }
        else setSt('✔ Mã chưa trùng với dòng nào trong bảng', 'ok');
      }, function () { if (my === seq) setSt('Không đối chiếu được (mạng) — hệ thống kiểm tra lại khi lưu', 'warn'); });
    };
    ma.addEventListener('input', function () { ma.dataset.auto = ''; setSt(''); if (au && au.partial) manual = true; });   // gõ tay vào ô mã gợi ý-tiền-tố thì thôi tự ghi đè
    ma.addEventListener('change', check); ma.addEventListener('blur', function () { if (!ma.readOnly) check(); });
    if (nf) {
      var nst = document.createElement('small'); nst.className = 'db-codest'; nf.closest('label').appendChild(nst);
      var nseq = 0;
      var nameCheck = function () {
        var v = nf.value.trim(); nst.textContent = ''; nst.className = 'db-codest'; if (v.length < 3) return;
        var my = ++nseq;
        findSame(NAMEF[sh], v, isAdd ? null : row).then(function (hit) {
          if (my !== nseq || !hit.length) return;
          nst.className = 'db-codest warn'; nst.textContent = '⚠ Trùng tên với mã ' + hit[0].code + ' — kiểm tra xem có phải việc đã có không';
        }, function () { /* bỏ qua */ });
      };
      nf.addEventListener('blur', nameCheck);
    }
    var recompute = function () {
      if (!au || !isAdd || manual) return;
      Promise.resolve(au.make(f)).then(function (code) { if (manual) return; ma.value = code || ''; ma.dataset.auto = '1'; if (au.partial) { if (!code) setSt(''); else ma.focus(); } else if (au.tbl && code) setSt('✔ Mã tự tạo từ số lớn nhất trong bảng — chưa trùng', 'ok'); else check(); }, function () { setSt('Không tạo được mã tự động — click đúp để nhập tay', 'warn'); });
    };
    if (isAdd && ma.value && !au) check();
    loadCats().then(function (cat) {
      if (isAdd && au && !au.partial && au.deps.every(function (d) { return f(d) && f(d).value.trim(); })) { ma.value = ''; recompute(); }   // nhân bản / nhập tiếp: tạo mã mới ngay
      (au ? au.deps : []).forEach(function (d) {
        var el = f(d); if (!el) return;
        ['change', 'blur'].forEach(function (ev) { el.addEventListener(ev, function () {
          var k = el.value.trim();
          if (d === 'Hạng mục' && cat.hm[k]) { if (f('Nhóm')) f('Nhóm').value = cat.hm[k].name; if (f('Giai đoạn')) f('Giai đoạn').value = cat.hm[k].gd; }
          if (d === 'Nhóm tài nguyên' && cat.gr[k]) { if (f('Nhóm')) f('Nhóm').value = cat.gr[k].name; if (f('Loại') && cat.gr[k].loai) f('Loại').value = cat.gr[k].loai; }
          // đổi bất kỳ thông tin gốc nào → LUÔN tạo lại mã (kể cả đã click đúp sửa tay trước đó), khoá ô mã trở lại
          if (isAdd && au) { manual = false; if (!au.partial) { ma.readOnly = true; ma.classList.add('db-auto'); } }
          recompute();
        }); });
      });
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
  // ---------- 2026-10-04: ô CHỌN từ danh mục chuẩn + giải thích từng cột + bảng viết tắt + MÃ TỰ SINH có kiểm tra trùng ----------
  var REF = null, REFP = null;
  function loadRefs() {
    if (REF) return Promise.resolve(REF);
    var c = lsGet('dgdm_ref', null);
    if (c && c.ref && c.ref.cat && Date.now() - c.t < 864e5) { REF = c.ref; CAT.hm = REF.cat.hm; CAT.gr = REF.cat.gr; CAT.gd = REF.cat.gd; return Promise.resolve(REF); }
    return refreshRefs();
  }
  function refreshRefs() {
    if (REFP) return REFP;
    var get = function (s) { return jget(API + '?action=getDgdmRows&sheet=' + encodeURIComponent(s) + '&limit=500').catch(function () { return { headers: [], rows: [] }; }); };
    CAT.hm = null;
    REFP = Promise.all([loadCats(), get('DGDM-Đơn vị tính'), get('DGDM-Nguồn')]).then(function (r) {
      var u = r[1], so = r[2], ui = (u.headers || []).indexOf('ĐVT chuẩn'); if (ui < 0) ui = 0;
      var units = [], seen = {};
      (u.rows || []).forEach(function (x) { var v = String(x.v[ui] == null ? '' : x.v[ui]).trim(); if (v && !seen[v]) { seen[v] = 1; units.push(v); } });
      var sources = (so.rows || []).map(function (x) { return { v: String(x.v[0] == null ? '' : x.v[0]).trim(), l: String(x.v[1] == null ? '' : x.v[1]).trim() }; }).filter(function (o) { return o.v; });
      REF = { cat: { hm: r[0].hm, gr: r[0].gr, gd: r[0].gd }, units: units, sources: sources };
      lsSet('dgdm_ref', { t: Date.now(), ref: REF }); REFP = null;
      return REF;
    }).catch(function () { REFP = null; return null; });
    return REFP;
  }
  var LOAI_TN = [{ v: 'VL', l: 'VL — Vật liệu' }, { v: 'M', l: 'M — Máy thi công / thiết bị' }, { v: 'NC', l: 'NC — Nhân công' }];
  var LOAI_DG = [{ v: 'CT', l: 'CT — Đơn giá công tác hoàn chỉnh (theo định mức)' }, { v: 'TG', l: 'TG — Trọn gói (theo m² sàn)' }, { v: 'NCK', l: 'NCK — Nhân công khoán' }, { v: 'SB', l: 'SB — Đơn giá sơ bộ theo m² sàn' }];
  var OPEN_COLS = ['loại nhà', 'phần thô điển hình', 'trọn gói điển hình', 'nhóm chi phí dự toán', 'đưa vào phần mềm dự toán?', 'vùng', 'vùng giá cần tách'];
  // giải thích từng cột (khoá = tên cột viết thường)
  var HELP = {
    'tỉnh/thành': 'Tỉnh/thành áp dụng giá. Mỗi tỉnh có 1 dòng riêng cho cùng một mã; muốn tạo cho mọi tỉnh thì tích ô “Thêm cho mọi tỉnh” ở cuối form.',
    'mã hiệu đm': 'Mã hiệu định mức chuẩn để nhập/xuất sang phần mềm dự toán: theo Định mức xây dựng của Nhà nước (VD AF.11110) hoặc thư viện ETA / G8 / F1. Việc chưa có trong ĐM Nhà nước dùng mã nội bộ, nguồn HICONIQUE.',
    'nhóm': 'Nhóm công việc/vật tư để lọc và gom báo giá. Tự điền theo Hạng mục / Nhóm tài nguyên đã chọn.',
    'hạng mục': 'Hạng mục thi công (VD BT = Bê tông, XD = Xây). Mã công việc được tạo tự động từ mã hạng mục này.',
    'giai đoạn': 'Giai đoạn của dự án (VD TK = Thiết kế, TH = Phần thô). Tự điền theo Hạng mục.',
    'công tác': 'Tên công tác thi công — viết ngắn gọn, đúng như ghi trong dự toán. Hệ thống báo nếu trùng tên công tác đã có.',
    'phạm vi/spec': 'Phạm vi công việc đã bao gồm + quy cách kỹ thuật chính (mác, kích thước, vật liệu, điều kiện thi công).',
    'ghi chú loại trừ': 'Những việc/chi phí KHÔNG nằm trong đơn giá này (để tránh tính trùng hoặc thiếu).',
    'vl thấp': 'Đơn giá VẬT LIỆU thấp nhất ghi nhận tại tỉnh, cho 1 ĐVT. Đơn vị: đồng.', 'vl cao': 'Đơn giá VẬT LIỆU cao nhất ghi nhận tại tỉnh, cho 1 ĐVT. Đơn vị: đồng.',
    'nc thấp': 'Đơn giá NHÂN CÔNG thấp nhất ghi nhận tại tỉnh, cho 1 ĐVT. Đơn vị: đồng.', 'nc cao': 'Đơn giá NHÂN CÔNG cao nhất ghi nhận tại tỉnh, cho 1 ĐVT. Đơn vị: đồng.',
    'dght thấp': 'Đơn giá hoàn thiện (DGHT) thấp = vật liệu + nhân công, cho 1 ĐVT. Đơn vị: đồng.', 'dght cao': 'Đơn giá hoàn thiện (DGHT) cao = vật liệu + nhân công, cho 1 ĐVT. Đơn vị: đồng.',
    'ncc/đơn vị chào giá': 'Nhà cung cấp / đơn vị đã chào giá, hoặc nguồn của mức giá này.',
    'loại đơn giá': 'Phân loại đơn giá: CT công tác, TG trọn gói, NCK nhân công khoán, SB sơ bộ theo m². Tự điền theo từng bảng.',
    'loại nhà': 'Loại công trình áp dụng đơn giá sơ bộ (chọn trong danh sách hoặc gõ mã mới). Mã đơn giá được tạo tự động từ ô này.',
    'mã trọn gói': 'Mã đơn giá trọn gói tương ứng, dạng SB-TG-[loại nhà]. Tự tạo theo Loại nhà.',
    'phần thô điển hình': 'Mô tả công trình điển hình dùng để tính đơn giá phần thô.', 'trọn gói điển hình': 'Mô tả công trình điển hình dùng để tính đơn giá trọn gói.',
    'quy mô/spec giả định': 'Quy mô và quy cách giả định khi lập đơn giá sơ bộ (số tầng, diện tích, mức hoàn thiện…).',
    'phần thô thấp': 'Đơn giá phần thô thấp nhất, theo m² sàn. Đơn vị: đồng/m².', 'phần thô cao': 'Đơn giá phần thô cao nhất, theo m² sàn. Đơn vị: đồng/m².',
    'trọn gói thấp': 'Đơn giá trọn gói thấp nhất, theo m² sàn. Đơn vị: đồng/m².', 'trọn gói cao': 'Đơn giá trọn gói cao nhất, theo m² sàn. Đơn vị: đồng/m².',
    'giá thấp': 'Giá thấp nhất ghi nhận tại tỉnh, cho 1 ĐVT. Đơn vị: đồng.', 'giá cao': 'Giá cao nhất ghi nhận tại tỉnh, cho 1 ĐVT. Đơn vị: đồng.',
    'vật tư/thiết bị': 'Tên vật tư/thiết bị đầy đủ (kèm chủng loại chính). Hệ thống báo nếu trùng tên đã có.',
    'nhóm tài nguyên': 'Nhóm tài nguyên (VD VL-BT = vật liệu bê tông). Mã vật tư được tạo tự động từ nhóm này.',
    'loại': 'Loại tài nguyên: VL vật liệu · M máy/thiết bị · NC nhân công.',
    'spec kỹ thuật tối thiểu': 'Yêu cầu kỹ thuật tối thiểu để mức giá này hợp lệ (tiêu chuẩn, mác, kích thước…).',
    'ncc/brand giao tại tỉnh': 'Nhà cung cấp / thương hiệu có giao hàng tại tỉnh này.',
    'nguồn': 'Nguồn của mức giá (mã nguồn S01…, xem tab Nguồn).',
    'mã gđ': 'Mã giai đoạn 2 chữ cái, duy nhất (VD TK, TH).', 'tên giai đoạn': 'Tên đầy đủ của giai đoạn.',
    'mã hạng mục': 'Mã hạng mục dạng [Mã GĐ]-[2 chữ], VD TH-BT. Tự gợi ý theo Mã GĐ; click đúp để sửa tay.', 'tên hạng mục': 'Tên đầy đủ của hạng mục.',
    'phạm vi công việc': 'Phạm vi các công việc thuộc hạng mục này.', 'nhóm chi phí dự toán': 'Nhóm chi phí khi lập dự toán (VD chi phí xây dựng, chi phí tư vấn).',
    'đưa vào phần mềm dự toán?': 'Có đưa hạng mục này vào phần mềm dự toán (ETA/G8/F1) khi xuất hay không.', 'mã cũ tương ứng': 'Mã cũ trước khi đổi quy ước, dùng để đối chiếu.',
    'đvt chuẩn': 'Đơn vị tính chuẩn dùng thống nhất toàn hệ thống.', 'đvt cũ trên app': 'Cách ghi cũ của đơn vị này trên app (để đổi sang chuẩn).', 'chuyển thành': 'ĐVT chuẩn sẽ thay thế cho cách ghi cũ.', 'ghi chú điều kiện đo': 'Điều kiện đo bóc áp dụng cho đơn vị này.',
    'mã nhóm': 'Mã nhóm tài nguyên dạng [Loại]-[2 ký tự], VD VL-BT. Tự gợi ý theo Loại; click đúp để sửa tay.', 'tên nhóm': 'Tên đầy đủ của nhóm tài nguyên.', 'ví dụ': 'Ví dụ vật tư/nhân công thuộc nhóm.',
    'vùng': 'Vùng địa lý/vùng giá của tỉnh.', 'vùng giá cần tách': 'Các tỉnh/khu vực có mức giá khác nhau cần tách riêng.', 'mã tỉnh': 'Mã tỉnh 3 chữ cái (VD HPH = Hải Phòng).'
  };
  var HELP_MA = {
    'DGDM-Mã công việc công tác': 'Quy ước [Giai đoạn]-[Hạng mục]-[STT 3 số]. VD TH-BT-001 = Phần thô – Bê tông – việc số 1. Số 900–999 dành cho việc phát sinh (VO). Chọn Hạng mục, mã tự sinh; click đúp để sửa tay.',
    'DGDM-Vật tư thiết bị': 'Quy ước [Loại]-[Nhóm 2 ký tự]-[STT]. VD VL-BT-0001 = Vật liệu – Bê tông – số 1 (VL, M: 4 số; NC: 2 số). Chọn Nhóm tài nguyên, mã tự sinh; click đúp để sửa tay.',
    'DGDM-Nhân công khoán': 'Quy ước SB-NC-[loại nhà], VD SB-NC-C4 = Sơ bộ – Nhân công – nhà cấp 4. Chọn Loại nhà, mã tự sinh; click đúp để sửa tay.',
    'DGDM-Phần thô và trọn gói': 'Quy ước SB-TH-[loại nhà], VD SB-TH-C4 = Sơ bộ – Phần thô – nhà cấp 4 (mã trọn gói: SB-TG-[loại nhà]). Chọn Loại nhà, mã tự sinh; click đúp để sửa tay.'
  };
  var GLOSS_COMMON = [
    ['ĐVT', 'Đơn vị tính (m², m³, kg, bộ, công…). Chọn trong danh sách chuẩn ở tab “Đơn vị tính”.'],
    ['ĐM', 'Định mức — mức hao phí vật liệu, nhân công, máy cho 1 đơn vị công tác.'],
    ['Mã hiệu ĐM', 'Mã định mức chuẩn (Định mức xây dựng của Nhà nước hoặc thư viện phần mềm dự toán ETA, G8, F1).'],
    ['VL · NC · M', 'Vật liệu · Nhân công · Máy thi công.'],
    ['DGHT', 'Đơn giá hoàn thiện = vật liệu + nhân công cho 1 ĐVT.'],
    ['Thấp / Cao', 'Mức giá thấp nhất / cao nhất ghi nhận tại tỉnh (đồng).'],
    ['NCC', 'Nhà cung cấp.'], ['Spec', 'Quy cách kỹ thuật (chủng loại, kích thước, tiêu chuẩn).'],
    ['VO', 'Variation Order — việc phát sinh ngoài hợp đồng (mã số 900–999).'],
    ['SB', 'Sơ bộ — đơn giá ước tính theo m² sàn.'], ['TH · TG', 'Phần thô · Trọn gói.'],
    ['CT · NCK', 'Công tác (hoàn chỉnh) · Nhân công khoán.'],
    ['C4 · BT · HD · TCD · MEP', 'Loại nhà: C4 nhà cấp 4 · BT biệt thự · HD nhà phố hiện đại · TCD tân cổ điển · MEP cơ điện (điện – nước – điều hòa).']
  ];
  function glossHtml() {
    var cat = REF && REF.cat, rows = GLOSS_COMMON.map(function (g) { return '<tr><th>' + esc(g[0]) + '</th><td>' + esc(g[1]) + '</td></tr>'; }).join('');
    var sh = st.data.sheet;
    if (cat && cat.gd && /Mã công việc|Giai đoạn/.test(sh)) rows += '<tr><th>Mã giai đoạn</th><td>' + Object.keys(cat.gd).map(function (k) { return '<b>' + esc(k) + '</b> ' + esc(cat.gd[k]); }).join(' · ') + '</td></tr>';
    if (cat && cat.hm && sh === 'DGDM-Mã công việc công tác') rows += '<tr><th>Mã hạng mục</th><td>' + Object.keys(cat.hm).map(function (k) { return '<b>' + esc(k) + '</b> ' + esc(cat.hm[k].name); }).join('<br>') + '</td></tr>';
    if (cat && cat.gr && /Vật tư|Nhóm tài nguyên/.test(sh)) rows += '<tr><th>Mã nhóm tài nguyên</th><td>' + Object.keys(cat.gr).map(function (k) { return '<b>' + esc(k) + '</b> ' + esc(cat.gr[k].name); }).join('<br>') + '</td></tr>';
    return '<details class="db-gloss"><summary>Bảng giải thích viết tắt &amp; mã</summary><div class="db-gl-b"><table class="db-gl-t"><tbody>' + rows + '</tbody></table></div></details>';
  }
  function distinctOf(h) {
    var i = (st.data.headers || []).indexOf(h), seen = {}, out = [];
    (st.data.rows || []).forEach(function (r) { var v = String(r.v[i] == null ? '' : r.v[i]).trim(); if (v && !seen[v]) { seen[v] = 1; out.push({ v: v, l: v }); } });
    return out;
  }
  function specFor(h) {
    var sh = st.data.sheet, n = norm(h), cat = REF && REF.cat, help = (n === 'mã' ? HELP_MA[sh] : '') || HELP[n] || '', mk = function (t, opts) { return { t: t, opts: opts, help: help }; };
    if (n === 'tỉnh/thành') return mk('select', (st.data.provinces || []).map(function (p) { return { v: p, l: p }; }));
    if (!REF) return mk('text');
    if (n === 'đvt' && sh !== 'DGDM-Đơn vị tính') return mk('select', REF.units.map(function (u) { return { v: u, l: u }; }));
    if (n === 'nguồn' && sh !== 'DGDM-Nguồn' && REF.sources.length) return mk('combo', REF.sources.map(function (o) { return { v: o.v, l: o.v + (o.l ? ' — ' + o.l : '') }; }));
    if (n === 'nhóm tài nguyên' && sh === 'DGDM-Vật tư thiết bị' && cat) return mk('select', Object.keys(cat.gr).map(function (k) { return { v: k, l: k + ' — ' + cat.gr[k].name }; }));
    if (n === 'loại' && (sh === 'DGDM-Vật tư thiết bị' || sh === 'DGDM-Nhóm tài nguyên')) return mk('select', LOAI_TN);
    if (n === 'hạng mục' && sh === 'DGDM-Mã công việc công tác' && cat) return mk('select', Object.keys(cat.hm).map(function (k) { return { v: k, l: k + ' — ' + cat.hm[k].name }; }));
    if (n === 'giai đoạn' && sh === 'DGDM-Mã công việc công tác' && cat && cat.gd) return mk('select', Object.keys(cat.gd).map(function (k) { return { v: k, l: k + ' — ' + cat.gd[k] }; }));
    if (n === 'loại đơn giá') return mk('select', LOAI_DG);
    if (OPEN_COLS.indexOf(n) !== -1) return mk('combo', distinctOf(h));
    return mk('text');
  }
  var SEC_TITLES = { id: 'Định danh & phân loại', desc: 'Mô tả chi tiết', val: 'Giá & số liệu' };
  function fieldHtml(x, i, isAdd, row, src, pi) {
    var v = isAdd ? (i === pi ? st.prov : (src ? src.v[i] : '')) : row.v[i], val = v == null ? '' : String(v), k = kindOf(x), sp = specFor(x);
    var long = sp.t === 'text' && (k === 'note' || val.length > 70 || k === 'name' && val.length > 40);
    var dis = !isAdd && i === pi ? ' disabled' : '';
    var cls = 'db-f' + (k === 'note' ? ' full' : (long || k === 'name') ? ' wide' : '');
    var ctl;
    if (sp.t === 'select') {
      var has = false, opts = sp.opts.map(function (o) { if (o.v === val) has = true; return '<option value="' + esc(o.v) + '"' + (o.v === val ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('');
      if (val && !has) opts = '<option value="' + esc(val) + '" selected>' + esc(val) + ' (giá trị hiện có)</option>' + opts;
      ctl = '<select class="es-input db-sel" data-h="' + esc(x) + '"' + dis + '><option value="">— Chọn —</option>' + opts + '</select>';
    } else if (sp.t === 'combo') {
      var dl = 'dbL' + i;
      ctl = '<input class="es-input db-combo" data-h="' + esc(x) + '" value="' + esc(val) + '" list="' + dl + '" autocomplete="off" placeholder="Chọn hoặc gõ…"' + dis + '><datalist id="' + dl + '">' + sp.opts.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.l) + '</option>'; }).join('') + '</datalist>';
    } else if (long) ctl = '<textarea class="es-input db-ta" data-h="' + esc(x) + '"' + dis + '>' + esc(val) + '</textarea>';
    else ctl = '<input class="es-input' + (k === 'price' ? ' num' : '') + '" data-h="' + esc(x) + '" value="' + esc(val) + '"' + dis + (k === 'price' ? ' inputmode="decimal"' : '') + '>';
    return '<label class="' + cls + '"><span class="es-label">' + esc(x) + (k === 'price' ? ' <i>(số)</i>' : '') + '</span>' + ctl + (sp.help ? '<small class="db-help">' + esc(sp.help) + '</small>' : '') + '</label>';
  }
  function openForm(row, src) { loadRefs().then(function () { openForm_(row, src); }, function () { openForm_(row, src); }); }
  function openForm_(row, src) {
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
    ov.innerHTML = '<div class="es-modal db-modal"><h2><span>' + (isAdd ? (src ? 'Nhân bản thành dòng mới' : 'Thêm dòng mới') : 'Sửa dòng ' + stt(row)) + ' — ' + esc(st.data.sheet.replace(/^DGDM-/, '')) + (st.prov ? ' · ' + esc(st.prov) : '') + '</span><button class="es-x" type="button">×</button></h2>' +
      '<div class="db-form">' + body + '</div>' + opt +
      '<div class="db-foot"><span class="es-note">Nhật ký thay đổi tự ghi · <span class="db-key">Ctrl</span>+<span class="db-key">Enter</span> lưu · <span class="db-key">Esc</span> đóng</span><span class="es-spacer"></span><button class="es-btn" type="button" data-x>Huỷ</button>' +
      (hasNext ? '<button class="es-btn" type="button" id="dbSaveNext" title="Lưu rồi mở dòng kế tiếp">Lưu &amp; dòng kế tiếp ›</button>' : '') +
      (isAdd ? '<button class="es-btn" type="button" id="dbSaveMore" title="Lưu rồi mở ngay form mới, giữ nguyên Tỉnh/Hạng mục/Nhóm đã chọn">Thêm &amp; nhập tiếp ›</button>' : '') +
      '<button class="es-btn es-btn-primary" type="button" id="dbSave">' + (isAdd ? 'Thêm' : 'Lưu thay đổi') + '</button></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); }, dirty = false;
    // 2026-10-04: đã gõ/chọn dở thì KHÔNG đóng bừa khi bấm ra ngoài; bấm ×/Huỷ/Esc sẽ hỏi lại
    var tryClose = function () { if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')) return; close(); };
    ov.__tryClose = tryClose;
    ov.querySelector('.db-form').addEventListener('input', function () { dirty = true; }); ov.querySelector('.db-form').addEventListener('change', function () { dirty = true; });
    ov.querySelector('.es-x').onclick = tryClose; ov.querySelector('[data-x]').onclick = tryClose;
    ov.addEventListener('mousedown', function (e) { if (e.target === ov && !dirty) close(); });
    var first = ov.querySelector('.db-form input:not([disabled]), .db-form textarea:not([disabled])'); if (first) { first.focus(); try { first.select(); } catch (e) { /* bỏ qua */ } }
    wireConv(ov, isAdd, row);
    ov.querySelector('.db-form').before(Object.assign(document.createElement('div'), { innerHTML: glossHtml() }).firstChild);
    var save = function (btn, goNext, more) {
      var vals = {}, changed = {};
      ov.querySelectorAll('[data-h]').forEach(function (el) { if (el.disabled) return; var k = el.dataset.h; vals[k] = el.value.trim(); });
      h.forEach(function (x, i) { if (!x || !(x in vals)) return; var old = isAdd ? '' : String(row.v[i] == null ? '' : row.v[i]); if (vals[x] !== old) changed[x] = vals[x]; });
      var all = $('dbAll') && $('dbAll').checked, u = user(), actor = u ? (u.name || u.id) : '';
      var openAfter = function (n) { var nr = (st.data.rows || [])[n]; if (nr) openForm(nr); };
      var cerr = convError(isAdd ? vals : changed); if (cerr) { toast(cerr, true); return; }
      var mcode = ov.querySelector('[data-h="' + (CODEF[st.data.sheet] || 'Mã') + '"]'); if (mcode && mcode.dataset.dup === '1' && (isAdd || (CODEF[st.data.sheet] || 'Mã') in changed)) { toast('Mã này đã có trong bảng — hãy đổi số khác (click đúp ô Mã để sửa).', true); return; }
      if (!isAdd && !Object.keys(changed).length) { close(); if (goNext) openAfter(idx + 1); return; }
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Đang lưu…';
      var done = function (r) {
        btn.disabled = false; btn.textContent = label;
        if (!r || r.ok === false || r.error) { toast((r && r.error) || 'Lưu không thành công', true); return; }
        close(); CACHE = {};
        toast(isAdd ? 'Đã thêm ' + (r.added || 1) + ' dòng' + (r.skipped ? ' (bỏ qua ' + r.skipped + ' tỉnh đã có mã này)' : '') : 'Đã lưu' + (r.rows > 1 ? ' cho ' + r.rows + ' dòng (mọi tỉnh)' : ''));
        if (isAdd) {
          loadSheets();
          loadRows(true).then(function () { if (more) openMore(vals); });
          return;
        }
        // sửa: cập nhật ngay dòng đang hiển thị (không chờ tải lại cả bảng)
        var local = idx !== -1 && !(all && Object.keys(changed).some(function (k) { return !isPrice(k); }) && !st.prov);
        if (local) {
          h.forEach(function (x, i) { if (x in changed) { var nv = changed[x]; row.v[i] = isPrice(x) && nv !== '' && isFinite(parseFloat(String(nv).replace(/\./g, '').replace(',', '.'))) && /^[\d.,\s]+$/.test(nv) ? parseFloat(String(nv).replace(/\./g, '').replace(',', '.')) : nv; } });
          render(); selectRow(idx, true); flashRow(idx);
          if (goNext) openAfter(idx + 1);
          if (r.rows > 1) { loadSheets(); }
        } else { loadSheets(); loadRows(true).then(function () { if (goNext) openAfter(idx + 1); else if (idx !== -1) selectRow(idx, true); }); }
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
    if ($('dbSaveMore')) $('dbSaveMore').onclick = function () { save(this, false, true); };
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save($('dbSave'), false); } });
  }
  function flashRow(i) { var tr = $('dbBody').querySelector('tr[data-i="' + i + '"]'); if (!tr) return; tr.classList.add('flash'); setTimeout(function () { tr.classList.remove('flash'); }, 1600); }
  // "Thêm & nhập tiếp": mở form mới, giữ các ô chọn (tỉnh, hạng mục, nhóm…) và xoá tên/mã/giá để nhập việc kế tiếp
  function openMore(vals) {
    var h = st.data.headers, v = h.map(function (x) {
      if (!x) return '';
      var n = norm(x), keep = (n === 'tỉnh/thành') || (specFor(x).t !== 'text' && n !== 'mã') || n === 'nhóm' || n === 'giai đoạn' || n === 'loại nhà';
      return keep && vals[x] != null ? vals[x] : '';
    });
    openForm(null, { r: 0, v: v });
  }
  // Xuất CSV theo đúng bộ lọc đang xem (mọi trang) — dùng chuẩn bị import/export phần mềm dự toán
  function exportCsv() {
    var btn = $('dbExport'), all = [], off = 0, total = 0, head = null;
    if (btn.disabled) return; btn.disabled = true;
    var step = function () {
      var url = API + '?action=getDgdmRows&sheet=' + encodeURIComponent(st.sheet) + '&province=' + encodeURIComponent(st.prov) + '&q=' + encodeURIComponent(st.q) + '&offset=' + off + '&limit=500';
      return jget(url).then(function (d) {
        if (d.error) throw new Error(d.error);
        head = d.headers; total = d.total; all = all.concat(d.rows || []); off += 500;
        btn.lastChild.textContent = ' ' + Math.min(all.length, total).toLocaleString('vi-VN') + '/' + total.toLocaleString('vi-VN');
        if (off < total) return step();
      });
    };
    step().then(function () {
      var cell = function (x) { x = x == null ? '' : String(x); return /[",\n;]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
      var keep = head.map(function (x, i) { return x ? i : -1; }).filter(function (i) { return i !== -1; });
      var csv = '\ufeff' + [keep.map(function (i) { return cell(head[i]); }).join(',')].concat(all.map(function (r) { return keep.map(function (i) { return cell(r.v[i]); }).join(','); })).join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = st.sheet.replace(/^DGDM-/, '') + (st.prov ? ' - ' + st.prov : '') + ' - ' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      toast('Đã xuất ' + all.length.toLocaleString('vi-VN') + ' dòng');
    }).catch(function () { toast('Xuất không thành công (mạng chậm?) — thử lại', true); }).then(function () { btn.disabled = false; btn.lastChild.textContent = ' Xuất CSV'; });
  }
  function askDelete(row) {
    var h = st.data.headers, pi = provCol(), mi = h.indexOf('Mã'), label = (mi !== -1 ? row.v[mi] + ' — ' : '') + (row.v[h.findIndex(function (x, i) { return x && i !== pi && i !== mi && typeof row.v[i] === 'string' && row.v[i].length > 2; })] || '');
    var ov = document.createElement('div'); ov.className = 'es-overlay';
    ov.innerHTML = '<div class="es-modal" style="max-width:520px"><h2><span>Xoá dòng ' + stt(row) + '?</span><button class="es-x" type="button">×</button></h2><p style="margin:0 0 10px;font-size:.875rem">' + esc(String(label).slice(0, 160)) + '</p>' +
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
        close(); CACHE = {}; toast('Đã xoá ' + (r.deleted || 1) + ' dòng');
        var ix = (st.data.rows || []).indexOf(row); if (ix !== -1) { st.data.rows.splice(ix, 1); st.data.total = Math.max(0, (st.data.total || 1) - (r.deleted > 1 ? r.deleted : 1)); render(); selectRow(Math.min(ix, st.data.rows.length - 1)); }
        loadSheets();
        if (st.data.rows.length < 3 || r.deleted > 1) loadRows(true);   // gần cạn trang hoặc xoá nhiều tỉnh → tải lại cho chuẩn
      }, function () { btn.disabled = false; btn.textContent = 'Xoá'; toast('Không gửi được (kiểm tra kết nối)', true); });
    };
  }

  function boot() {
    if (!API) { $('dbBody').innerHTML = '<tr><td class="es-empty" style="padding:30px">Chưa cấu hình API.</td></tr>'; return; }
    bind();
    try { var qp = new URLSearchParams(location.search); if (qp.get('sheet')) st.sheet = qp.get('sheet'); if (qp.get('q')) st.q = qp.get('q'); } catch (e) { /* bỏ qua */ }   // mở từ kết quả tìm kiếm chung
    if (!st.sheet) st.sheet = 'DGDM-Mã công việc công tác';   // mở sẵn sheet mặc định — không chờ danh sách sheet
    setProvFor(st.sheet);
    loadRows().then(function () { loadRefs(); setTimeout(refreshRefs, 4000); });   // tải dòng và danh sách tab SONG SONG (trước đây nối đuôi nhau: danh sách sheet → dòng → dòng lần 2 có tỉnh)
    loadSheets().catch(function (e) { if (window.console) console.error('DGDM:', e); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
