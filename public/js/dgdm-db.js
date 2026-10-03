/* 2026-10-03: Trang Đơn giá – Định mức = công cụ KIỂM SOÁT CƠ SỞ DỮ LIỆU cho mọi sheet DGDM- (xem / tìm / lọc tỉnh / thêm / sửa / xoá).
 * API (gsheets-api-v2.js): getDgdmStatus (danh sách sheet), getDgdmRows (đọc có phân trang), dgdmWrite (op update|add|delete; all = mọi tỉnh).
 * Mọi thay đổi ghi vào sheet "DGDM-Nhật ký thay đổi" (xoá thì lưu nguyên dòng cũ). Không đụng "DGDM-Cài đặt" (khoá API).
 * Quyền sửa: Founder/CEO/GĐ/Quản lý (roleLevel admin|manager) — người khác chỉ xem.
 */
(function () {
  'use strict';
  var API = (typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL) || '';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var PRICE_RE = /thấp|cao|^VL|^NC |^DGHT|Mức điển hình|Đơn giá|Giá /i;
  var LOG = 'DGDM-Nhật ký thay đổi', PAGE = 100;
  var GROUPS = [
    ['Dữ liệu giá theo tỉnh', ['DGDM-Mã công việc công tác', 'DGDM-Vật tư thiết bị', 'DGDM-Nhân công khoán', 'DGDM-Phần thô và trọn gói']],
    ['Danh mục chuẩn', ['DGDM-Giai đoạn hạng mục', 'DGDM-Đơn vị tính', 'DGDM-Nhóm tài nguyên', 'DGDM-Tỉnh thành', 'DGDM-Nguồn', 'DGDM-Quy đổi ĐVT cũ']]
  ];
  var st = { sheets: [], sheet: '', prov: '', q: '', offset: 0, data: null, loading: false };

  function user() { return (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser() : null; }
  function canEdit() { var u = user(); return !!u && (u.roleLevel === 'admin' || u.roleLevel === 'manager'); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFC').trim().toLowerCase(); }
  function isPrice(h) { return PRICE_RE.test(String(h)); }
  function fmtCell(h, v) { if (v === '' || v == null) return ''; if (typeof v === 'number' && isPrice(h)) return v.toLocaleString('vi-VN'); return String(v); }
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#22272E;color:#fff;border:1px solid ' + (bad ? '#C55555' : '#B8935A') + ';padding:10px 18px;border-radius:10px;font:600 .8125rem Inter,sans-serif;z-index:900;max-width:90vw';
    t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3800);
  }
  function jget(url) { return fetch(url, { redirect: 'follow' }).then(function (r) { return r.text(); }).then(function (t) { var c = t.charAt(0); if (c === '{' || c === '[') return JSON.parse(t); throw new Error('Máy chủ trả dữ liệu lỗi'); }); }
  function post(data) {
    var f = new URLSearchParams(); f.set('action', 'dgdmWrite'); f.set('data', JSON.stringify(data));
    return fetch(API, { method: 'POST', body: f, redirect: 'follow' }).then(function (r) { return r.json(); });
  }

  // ---------- danh sách sheet ----------
  function loadSheets() {
    return jget(API + '?action=getDgdmStatus&_=' + Date.now()).then(function (s) {
      st.sheets = (s.sheets || []).filter(function (x) { return /^DGDM-/i.test(x.name) && norm(x.name) !== norm('DGDM-Cài đặt'); });
      if (!st.sheet) { var first = st.sheets.filter(function (x) { return x.name === GROUPS[0][1][0]; })[0] || st.sheets[0]; st.sheet = first ? first.name : ''; }
      renderNav();
    });
  }
  function renderNav() {
    var used = {}, html = '';
    var item = function (x) { used[x.name] = 1; return '<button type="button" class="db-nav-i' + (x.name === st.sheet ? ' on' : '') + '" data-s="' + esc(x.name) + '"><span>' + esc(x.name.replace(/^DGDM-/, '')) + '</span><em>' + (x.rows || 0).toLocaleString('vi-VN') + '</em></button>'; };
    GROUPS.forEach(function (g) {
      var list = g[1].map(function (n) { return st.sheets.filter(function (x) { return x.name === n; })[0]; }).filter(Boolean);
      if (list.length) html += '<div class="db-nav-g">' + esc(g[0]) + '</div>' + list.map(item).join('');
    });
    var rest = st.sheets.filter(function (x) { return !used[x.name] && x.name !== LOG; });
    if (rest.length) html += '<div class="db-nav-g">Mẫu &amp; tham khảo</div>' + rest.map(item).join('');
    var log = st.sheets.filter(function (x) { return x.name === LOG; })[0];
    if (log) html += '<div class="db-nav-g">Lịch sử</div>' + item(log);
    $('dbNav').innerHTML = html;
  }

  // ---------- bảng dữ liệu ----------
  function loadRows() {
    if (!st.sheet) return;
    st.loading = true; $('dbBody').innerHTML = '<div class="es-empty" style="padding:30px">Đang tải ' + esc(st.sheet) + '…</div>';
    var url = API + '?action=getDgdmRows&sheet=' + encodeURIComponent(st.sheet) + '&province=' + encodeURIComponent(st.prov) + '&q=' + encodeURIComponent(st.q) + '&offset=' + st.offset + '&limit=' + PAGE;
    return jget(url).then(function (d) {
      st.loading = false;
      if (d.error) { $('dbBody').innerHTML = '<div class="es-empty" style="padding:30px">' + esc(d.error) + '</div>'; return; }
      st.data = d;
      if (d.provinces && d.provinces.length && !st.prov && st.sheet !== LOG) { st.prov = d.provinces.indexOf('Hải Phòng') !== -1 ? 'Hải Phòng' : d.provinces[0]; return loadRows(); }
      render();
    }).catch(function () { st.loading = false; $('dbBody').innerHTML = '<div class="es-empty" style="padding:30px">Không tải được dữ liệu (kiểm tra kết nối) — bấm Tải lại.</div>'; });
  }
  function provCol() { var h = (st.data && st.data.headers) || []; return h.indexOf('Tỉnh/Thành'); }
  function render() {
    var d = st.data, h = d.headers || [], ro = d.readonly || !canEdit(), pi = provCol();
    var provSel = d.provinces && d.provinces.length ? '<select class="es-select" id="dbProv" style="min-width:170px">' + d.provinces.map(function (p) { return '<option' + (p === st.prov ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>' : '';
    var from = d.total ? d.offset + 1 : 0, to = Math.min(d.offset + PAGE, d.total);
    var bar = '<div class="es-toolbar db-bar"><div class="db-title"><b>' + esc(d.sheet.replace(/^DGDM-/, '')) + '</b><span>' + (d.total || 0).toLocaleString('vi-VN') + ' dòng' + (st.prov ? ' · ' + esc(st.prov) : '') + (st.q ? ' · lọc “' + esc(st.q) + '”' : '') + '</span></div>' +
      provSel + '<input class="es-input" id="dbQ" placeholder="Tìm mã, tên, ghi chú…" value="' + esc(st.q) + '" style="min-width:220px">' +
      '<button class="es-btn" id="dbReload" type="button">Tải lại</button>' +
      (ro ? '' : '<button class="es-btn es-btn-primary" id="dbAdd" type="button">+ Thêm dòng</button>') + '</div>';
    var cols = h.map(function (x, i) { return { h: x, i: i }; }).filter(function (c) { return c.h !== '' && (c.i !== pi || !st.prov); });
    var thead = '<tr><th class="db-rn">#</th>' + cols.map(function (c) { return '<th' + (isPrice(c.h) ? ' class="num"' : '') + '>' + esc(c.h) + '</th>'; }).join('') + (ro ? '' : '<th class="db-act-h">Thao tác</th>') + '</tr>';
    var rows = (d.rows || []).map(function (r) {
      return '<tr data-r="' + r.r + '"><td class="db-rn">' + r.r + '</td>' + cols.map(function (c) {
        var v = r.v[c.i], txt = fmtCell(c.h, v), long = txt.length > 60;
        return '<td class="' + (isPrice(c.h) ? 'num' : '') + (/^mã/i.test(c.h) ? ' mono' : '') + '"' + (long ? ' title="' + esc(txt) + '"' : '') + '>' + esc(long ? txt.slice(0, 60) + '…' : txt) + '</td>';
      }).join('') + (ro ? '' : '<td class="db-act"><button type="button" data-a="edit">Sửa</button><button type="button" data-a="del" class="danger">Xoá</button></td>') + '</tr>';
    }).join('');
    var pager = d.total > PAGE ? '<div class="db-pager"><button class="es-btn es-btn-sm" id="dbPrev" type="button"' + (d.offset ? '' : ' disabled') + '>‹ Trước</button><span>' + from + '–' + to + ' / ' + d.total.toLocaleString('vi-VN') + '</span><button class="es-btn es-btn-sm" id="dbNext" type="button"' + (to < d.total ? '' : ' disabled') + '>Sau ›</button></div>' : '';
    $('dbBody').innerHTML = bar + (ro && st.sheet !== LOG && !canEdit() ? '<p class="es-note" style="margin:0 0 10px">Bạn đang ở chế độ <b>chỉ xem</b> — chỉ Founder/CEO/Giám đốc/Quản lý được thêm, sửa, xoá.</p>' : '') +
      '<div class="es-tablewrap db-wrap"><table class="es-table db-table"><thead>' + thead + '</thead><tbody>' + (rows || '<tr><td colspan="' + (cols.length + 2) + '" class="es-empty" style="padding:24px">Không có dòng nào.</td></tr>') + '</tbody></table></div>' + pager;
    bind();
  }
  function bind() {
    var t; var q = $('dbQ');
    q.addEventListener('input', function () { clearTimeout(t); var v = q.value; t = setTimeout(function () { st.q = v.trim(); st.offset = 0; loadRows().then(function () { var e = $('dbQ'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }); }, 450); });
    if ($('dbProv')) $('dbProv').addEventListener('change', function () { st.prov = this.value; st.offset = 0; loadRows(); });
    $('dbReload').addEventListener('click', function () { loadRows(); loadSheets(); });
    if ($('dbAdd')) $('dbAdd').addEventListener('click', function () { openForm(null); });
    if ($('dbPrev')) $('dbPrev').addEventListener('click', function () { st.offset = Math.max(0, st.offset - PAGE); loadRows(); });
    if ($('dbNext')) $('dbNext').addEventListener('click', function () { st.offset += PAGE; loadRows(); });
    $('dbBody').querySelector('tbody').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var rn = +b.closest('tr').dataset.r, row = (st.data.rows || []).filter(function (x) { return x.r === rn; })[0]; if (!row) return;
      if (b.dataset.a === 'edit') openForm(row); else askDelete(row);
    });
  }

  // ---------- form thêm / sửa ----------
  function keyExpect(row) {   // các cột dùng để máy chủ kiểm tra dòng chưa bị người khác đổi
    var h = st.data.headers, ex = {};
    ['Tỉnh/Thành', 'Mã'].forEach(function (k) { var i = h.indexOf(k); if (i !== -1) ex[k] = row.v[i]; });
    if (!Object.keys(ex).length) { var j = h.findIndex(function (x) { return x !== ''; }); if (j !== -1) ex[h[j]] = row.v[j]; }
    return ex;
  }
  function openForm(row) {
    var h = st.data.headers, pi = provCol(), isAdd = !row, hasProv = pi !== -1;
    var fields = h.map(function (x, i) {
      if (!x) return '';
      var v = isAdd ? (i === pi ? st.prov : '') : row.v[i], val = v == null ? '' : String(v), long = val.length > 70 || /spec|ghi chú|phạm vi|nội dung|ncc|ví dụ|quy mô/i.test(x);
      var dis = !isAdd && i === pi ? ' disabled' : '';
      return '<label class="db-f' + (long ? ' wide' : '') + '"><span class="es-label">' + esc(x) + (isPrice(x) ? ' <i>(số)</i>' : '') + '</span>' +
        (long ? '<textarea class="es-input db-ta" data-h="' + esc(x) + '"' + dis + '>' + esc(val) + '</textarea>' : '<input class="es-input' + (isPrice(x) ? ' num' : '') + '" data-h="' + esc(x) + '" value="' + esc(val) + '"' + dis + (isPrice(x) ? ' inputmode="decimal"' : '') + '>') + '</label>';
    }).join('');
    var opt = hasProv ? (isAdd ? '<label class="db-chk"><input type="checkbox" id="dbAll"> Thêm cho <b>mọi tỉnh</b> (' + ((st.data.provinces || []).length) + ' tỉnh) — giá chỉ ghi cho tỉnh đang chọn, tỉnh khác để trống</label>'
      : '<label class="db-chk"><input type="checkbox" id="dbAll"> Áp dụng thay đổi các cột <b>không phải giá</b> (tên, ĐVT, mã, nhóm…) cho <b>cùng mã ở mọi tỉnh</b></label>') : '';
    var ov = document.createElement('div'); ov.className = 'es-overlay';
    ov.innerHTML = '<div class="es-modal"><h2><span>' + (isAdd ? 'Thêm dòng mới' : 'Sửa dòng ' + row.r) + ' — ' + esc(st.data.sheet.replace(/^DGDM-/, '')) + '</span><button class="es-x" type="button">×</button></h2>' +
      '<div class="db-form">' + fields + '</div>' + opt +
      '<div class="db-foot"><span class="es-note">Mọi thay đổi được lưu vào “Nhật ký thay đổi”.</span><span class="es-spacer"></span><button class="es-btn" type="button" data-x>Huỷ</button><button class="es-btn es-btn-primary" type="button" id="dbSave">' + (isAdd ? 'Thêm' : 'Lưu thay đổi') + '</button></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    ov.querySelector('.es-x').onclick = close; ov.querySelector('[data-x]').onclick = close;
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    var first = ov.querySelector('.db-form input:not([disabled]), .db-form textarea:not([disabled])'); if (first) first.focus();
    $('dbSave').onclick = function () {
      var vals = {}, changed = {};
      ov.querySelectorAll('[data-h]').forEach(function (el) { if (el.disabled) return; var k = el.dataset.h; vals[k] = el.value.trim(); });
      h.forEach(function (x, i) { if (!x || !(x in vals)) return; var old = isAdd ? '' : String(row.v[i] == null ? '' : row.v[i]); if (vals[x] !== old) changed[x] = vals[x]; });
      var all = $('dbAll') && $('dbAll').checked, btn = this, u = user(), actor = u ? (u.name || u.id) : '';
      if (!isAdd && !Object.keys(changed).length) { close(); return; }
      btn.disabled = true; btn.textContent = 'Đang lưu…';
      var done = function (r) {
        btn.disabled = false; btn.textContent = isAdd ? 'Thêm' : 'Lưu thay đổi';
        if (!r || r.ok === false || r.error) { toast((r && r.error) || 'Lưu không thành công', true); return; }
        close(); toast(isAdd ? 'Đã thêm ' + (r.added || 1) + ' dòng' + (r.skipped ? ' (bỏ qua ' + r.skipped + ' tỉnh đã có mã này)' : '') : 'Đã lưu' + (r.rows > 1 ? ' cho ' + r.rows + ' dòng (mọi tỉnh)' : '')); loadRows(); loadSheets();
      };
      var fail = function () { btn.disabled = false; btn.textContent = isAdd ? 'Thêm' : 'Lưu thay đổi'; toast('Không gửi được (kiểm tra kết nối)', true); };
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
    if (!API) { $('dbBody').innerHTML = '<div class="es-empty">Chưa cấu hình API.</div>'; return; }
    $('dbNav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      st.sheet = b.dataset.s; st.prov = ''; st.q = ''; st.offset = 0; renderNav(); loadRows();
    });
    loadSheets().then(loadRows).catch(function () { $('dbBody').innerHTML = '<div class="es-empty" style="padding:30px">Không tải được danh sách sheet (kiểm tra kết nối).</div>'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
