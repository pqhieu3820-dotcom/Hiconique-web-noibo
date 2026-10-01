/**
 * Tab "Đơn giá theo tỉnh/thành" (pricing.html) — giao diện NATIVE trên cơ sở dữ liệu gộp DG-* (getPriceDb), không còn dựng lại lưới thô của sheet DGXD-<tỉnh>.
 * - Chọn tỉnh → tải 4 bảng (nhân công khoán / phần thô & trọn gói / vật tư–thiết bị / công tác hoàn chỉnh), lọc theo loại + nhóm, tìm kiếm không dấu.
 * - Công thức hiển thị: Giá TB = (thấp + cao) ÷ 2; DGHT = VL + NC (đối chiếu với giá ghi trong dữ liệu, lệch >1.000 đ thì cảnh báo ⚠);
 *   nhập diện tích sàn → thành tiền thấp/cao cho các dòng đơn giá theo m² sàn.
 * - Bấm 1 dòng → "So sánh giá giữa các tỉnh" (getPriceDbCompare). Xuất Excel đúng phần đang lọc.
 * API: PricingProv.mount({ select, wrap, onLoaded }) ; PricingProv.entries(province) → mục Vật tư (dùng cho tab Khối lượng sơ bộ).
 */
var PricingProv = (function () {
  'use strict';
  var KINDS = [['all', 'Tất cả'], ['nc', 'Nhân công khoán'], ['tho', 'Phần thô & trọn gói'], ['vt', 'Vật tư – thiết bị'], ['ct', 'Công tác hoàn chỉnh']];
  var KIND_LABEL = { nc: 'Nhân công khoán', tho: 'Phần thô & trọn gói', vt: 'Vật tư – thiết bị', ct: 'Công tác hoàn chỉnh' };
  var data = {}, loading = {}, meta = {}, st = { province: '', kind: 'all', q: '', grp: '', area: 0, limit: 150 }, els = {}, opts = {};
  var CACHE_KEY = 'hq_pdb_v1_', TTL = 6 * 3600 * 1000;

  function api() { return typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL ? GSHEETS_CONFIG.API_URL : ''; }
  // Gọi Apps Script, tự thử lại (Google đôi khi trả trang lỗi HTML khi quá tải) — tối đa 3 lần
  function jget(url, tries) {
    tries = tries || 3;
    return fetch(url, { redirect: 'follow' }).then(function (r) { return r.text(); }).then(function (txt) {
      var c = txt.charAt(0); if (c === '{' || c === '[') return JSON.parse(txt);
      throw new Error('Máy chủ trả dữ liệu lỗi (quá tải tạm thời)');
    }).catch(function (e) { if (tries <= 1) throw e; return new Promise(function (res) { setTimeout(res, 1800); }).then(function () { return jget(url, tries - 1); }); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function num(v) { if (typeof v === 'number') return v; var n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function mid(l, h) { var m = (l + h) / 2; return Math.round(m / 1000) * 1000 || Math.round(m); }

  // ---- bảng dữ liệu → mục thống nhất ----
  function parse(tables, province) {
    var out = [], t = tables || {}, h, g, val = function (r, i) { return i >= 0 && r[i] != null ? String(r[i]).trim() : ''; };
    var H = function (tb) { var hh = (tb && tb.headers) || []; return function (n) { return hh.indexOf(n); }; };
    if (t.nc) { h = H(t.nc); (t.nc.rows || []).forEach(function (r) { var low = num(r[h('Giá thấp')]), high = num(r[h('Giá cao')]); if (!val(r, h('Loại nhà'))) return;
      out.push({ kind: 'nc', type: 'Nhân công khoán', code: val(r, h('Mã')), name: val(r, h('Loại nhà')), spec: val(r, h('Quy mô/spec giả định')), unit: val(r, h('ĐVT')), low: low, high: high || low, grp: '', ncc: val(r, h('NCC/đơn vị chào giá')), src: val(r, h('Nguồn')), typical: num(r[h('Mức điển hình')]) }); }); }
    if (t.tho) { h = H(t.tho); (t.tho.rows || []).forEach(function (r) { var nm = val(r, h('Loại nhà')); if (!nm) return;
      var base = { kind: 'tho', code: val(r, h('Mã')), spec: val(r, h('Quy mô/spec giả định')), unit: val(r, h('ĐVT')), grp: '', ncc: val(r, h('NCC/đơn vị chào giá')), src: val(r, h('Nguồn')) };
      out.push(Object.assign({}, base, { variant: 'tho', type: 'Phần thô', name: nm + ' — phần thô', low: num(r[h('Phần thô thấp')]), high: num(r[h('Phần thô cao')]) }));
      out.push(Object.assign({}, base, { variant: 'tg', type: 'Trọn gói', name: nm + ' — trọn gói hoàn thiện', low: num(r[h('Trọn gói thấp')]), high: num(r[h('Trọn gói cao')]) })); }); }
    if (t.vt) { h = H(t.vt); (t.vt.rows || []).forEach(function (r) { if (!val(r, h('Vật tư/thiết bị'))) return; var low = num(r[h('Giá thấp')]), high = num(r[h('Giá cao')]);
      out.push({ kind: 'vt', type: 'Vật tư', code: val(r, h('Mã')), name: val(r, h('Vật tư/thiết bị')), spec: val(r, h('Spec kỹ thuật tối thiểu')), unit: val(r, h('ĐVT')), low: low, high: high || low, grp: val(r, h('Nhóm')), sub: val(r, h('Loại')), ncc: val(r, h('NCC/brand giao tại tỉnh')), src: val(r, h('Nguồn')) }); }); }
    if (t.ct) { h = H(t.ct); (t.ct.rows || []).forEach(function (r) { if (!val(r, h('Công tác'))) return; var vl = num(r[h('VL thấp')]), vh = num(r[h('VL cao')]), nl = num(r[h('NC thấp')]), nh = num(r[h('NC cao')]), dl = num(r[h('DGHT thấp')]), dh = num(r[h('DGHT cao')]);
      var calcL = vl + nl, calcH = vh + nh, bad = (calcL || dl) && (Math.abs(calcL - dl) > 1000 || Math.abs(calcH - dh) > 1000);
      out.push({ kind: 'ct', type: 'Công tác', code: val(r, h('Mã')), name: val(r, h('Công tác')), spec: val(r, h('Phạm vi/spec')), unit: val(r, h('ĐVT')), low: dl || calcL, high: dh || calcH || dl, grp: val(r, h('Nhóm')), ncc: val(r, h('NCC/đơn vị chào giá')), note: val(r, h('Ghi chú loại trừ')), vlL: vl, vlH: vh, ncL: nl, ncH: nh, bad: !!bad, calcL: calcL, calcH: calcH }); }); }
    out.forEach(function (e) { e.province = province; e.mid = mid(e.low, e.high); e.h = norm([e.code, e.name, e.spec, e.grp, e.sub, e.ncc, e.type].join(' ')); });
    return out;
  }

  function load(name) {
    if (data[name]) return Promise.resolve(data[name]);
    try { var c = JSON.parse(localStorage.getItem(CACHE_KEY + name) || 'null'); if (c && Date.now() - c.t < TTL && c.tables) { data[name] = parse(c.tables, name); return Promise.resolve(data[name]); } } catch (e) { /* bỏ qua */ }
    if (loading[name]) return loading[name];
    loading[name] = jget(api() + '?action=getPriceDb&province=' + encodeURIComponent(name)).then(function (d) {
      if (d.error || !d.tables || !(d.tables.vt && d.tables.vt.rows.length)) throw new Error(d.error || 'Chưa có dữ liệu DG-* cho tỉnh này');
      try { localStorage.setItem(CACHE_KEY + name, JSON.stringify({ t: Date.now(), tables: d.tables })); } catch (e) { /* đầy bộ nhớ → bỏ qua */ }
      data[name] = parse(d.tables, name); delete loading[name]; return data[name];
    }).catch(function (e) { delete loading[name]; throw e; });
    return loading[name];
  }

  // ---- giao diện ----
  var CSS = '.pp-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:14px 24px;border-top:1px solid var(--pr-border)}' +
    '.pp-bar .pr-input,.pp-bar .pr-quote-select{width:auto;min-width:150px}.pp-search{flex:1 1 240px}' +
    '.pp-chips{display:flex;gap:6px;flex-wrap:wrap;padding:12px 24px 0}.pp-chip{padding:6px 12px;border-radius:999px;border:1px solid var(--pr-border);background:transparent;color:var(--pr-muted);font:600 .75rem Inter,sans-serif;cursor:pointer}' +
    '.pp-chip.on{background:var(--pr-bronze);border-color:var(--pr-bronze);color:#fff}.pp-chip b{opacity:.75;font-weight:600;margin-left:3px}' +
    '.pp-meta{padding:10px 24px 0;font-size:.75rem;color:var(--pr-muted)}.pp-meta b{color:var(--pr-text)}' +
    '.pp-tbl{width:100%;border-collapse:collapse;font-size:.8125rem;min-width:860px}.pp-tbl th{position:sticky;top:0;background:var(--pr-surface);text-align:left;font-size:.6875rem;text-transform:uppercase;letter-spacing:.04em;color:var(--pr-muted);font-weight:600;padding:9px 12px;border-bottom:1px solid var(--pr-border);white-space:nowrap}' +
    '.pp-tbl td{padding:9px 12px;border-bottom:1px solid var(--pr-border);vertical-align:top}.pp-tbl tbody tr.pp-row{cursor:pointer}.pp-tbl tbody tr.pp-row:hover{background:color-mix(in srgb,var(--pr-bronze) 7%,transparent)}' +
    '.pp-tbl .n{text-align:right;font-family:"JetBrains Mono",monospace;white-space:nowrap}.pp-tbl .c{font-family:"JetBrains Mono",monospace;font-size:.75rem;color:var(--pr-muted);white-space:nowrap}' +
    '.pp-tbl .sub{display:block;font-size:.6875rem;color:var(--pr-muted);margin-top:2px;line-height:1.45}.pp-tbl .tg{display:inline-block;font-size:.625rem;font-weight:700;padding:1px 7px;border-radius:999px;border:1px solid var(--pr-bronze);color:var(--pr-bronze);margin-bottom:3px}' +
    '.pp-tbl .mid{color:var(--pr-bronze);font-weight:600}.pp-tbl .warn{color:#B5402A;font-size:.6875rem}.pp-sec td{background:var(--pr-bg);color:var(--pr-bronze);font-weight:700;font-size:.6875rem;text-transform:uppercase;letter-spacing:.04em}' +
    '.pp-more{display:block;margin:14px auto;padding:8px 18px}.pp-ov{position:fixed;inset:0;z-index:600;background:rgba(10,12,15,.5);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:6vh 14px;overflow-y:auto}' +
    '.pp-box{width:100%;max-width:760px;background:var(--pr-surface);border:1px solid var(--pr-border);border-radius:16px;overflow:hidden}.pp-box h4{margin:0;padding:16px 20px;font-size:1rem;border-bottom:1px solid var(--pr-border);display:flex;justify-content:space-between;gap:10px}' +
    '.pp-box .x{border:none;background:none;font-size:1.4rem;line-height:1;cursor:pointer;color:var(--pr-muted)}.pp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 20px}.pp-stats div{border:1px solid var(--pr-border);border-radius:10px;padding:8px 10px;font-size:.6875rem;color:var(--pr-muted)}.pp-stats b{display:block;font:600 .9rem "JetBrains Mono",monospace;color:var(--pr-text);margin-bottom:2px}' +
    '.pp-cmp tr.me td{background:color-mix(in srgb,var(--pr-bronze) 12%,transparent);font-weight:600}.pp-bar2{height:6px;border-radius:3px;background:var(--pr-bronze);opacity:.55;min-width:2px}';

  function ensureCss() { if (document.getElementById('ppCss')) return; var s = document.createElement('style'); s.id = 'ppCss'; s.textContent = CSS; document.head.appendChild(s); }

  function filtered() {
    var all = data[st.province] || [], toks = norm(st.q).split(/\s+/).filter(Boolean);
    return all.filter(function (e) {
      if (st.kind !== 'all' && e.kind !== st.kind) return false;
      if (st.grp && e.grp !== st.grp) return false;
      for (var i = 0; i < toks.length; i++) if (e.h.indexOf(toks[i]) === -1) return false;
      return true;
    });
  }
  function frame() {
    var w = els.wrap; ensureCss();
    w.className = '';
    w.innerHTML = '<div class="pp-meta" id="ppMeta"></div><div class="pp-chips" id="ppChips"></div>' +
      '<div class="pp-bar"><input class="pr-input pp-search" id="ppQ" type="search" placeholder="Tìm tên, mã, spec, nhà cung cấp… (không cần gõ dấu)"><select class="pr-quote-select" id="ppGrp"><option value="">Mọi nhóm</option></select>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:.75rem;color:var(--pr-muted);white-space:nowrap;" title="Nhập diện tích sàn để tính thành tiền cho các dòng đơn giá theo m² sàn">Diện tích sàn <input class="pr-input mono" id="ppArea" type="text" inputmode="decimal" placeholder="m²" style="width:90px;min-width:0"></label>' +
      '<button type="button" class="pr-btn pr-btn-ghost" id="ppXls" style="white-space:nowrap">Xuất Excel</button></div>' +
      '<div style="overflow-x:auto;max-height:70vh" id="ppTbl"></div>';
    var q = w.querySelector('#ppQ'), g = w.querySelector('#ppGrp'), a = w.querySelector('#ppArea'), t;
    q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { st.q = q.value; st.limit = 150; render(); }, 160); });
    g.addEventListener('change', function () { st.grp = g.value; st.limit = 150; render(); });
    a.addEventListener('input', function () { st.area = num(a.value); render(); });
    w.querySelector('#ppXls').addEventListener('click', exportXls);
    w.querySelector('#ppChips').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; st.kind = b.getAttribute('data-k'); st.grp = ''; st.limit = 150; render(); });
    w.querySelector('#ppTbl').addEventListener('click', function (e) { var more = e.target.closest('[data-more]'); if (more) { st.limit += 300; render(); return; } var r = e.target.closest('[data-i]'); if (r) openCompare(filtered()[Number(r.getAttribute('data-i'))]); });
  }
  function render() {
    var all = data[st.province] || [], m = meta[st.province] || {};
    var cnt = { all: all.length }; all.forEach(function (e) { cnt[e.kind] = (cnt[e.kind] || 0) + 1; });
    var w = els.wrap;
    w.querySelector('#ppMeta').innerHTML = '<b>' + esc(st.province) + '</b>' + (m['Vùng'] ? ' · ' + esc(m['Vùng']) : '') + (m['Vùng giá cần tách'] && m['Vùng giá cần tách'] !== 'Không sáp nhập' ? ' · vùng giá: ' + esc(m['Vùng giá cần tách']) : '') + ' · mốc giá 01/09/2026 · chưa VAT · bấm 1 dòng để so sánh giữa các tỉnh';
    w.querySelector('#ppChips').innerHTML = KINDS.map(function (k) { return '<button type="button" class="pp-chip' + (st.kind === k[0] ? ' on' : '') + '" data-k="' + k[0] + '">' + k[1] + '<b>' + (cnt[k[0]] || 0) + '</b></button>'; }).join('');
    var gs = {}; all.forEach(function (e) { if (e.grp && (st.kind === 'all' || e.kind === st.kind)) gs[e.grp] = 1; });
    var g = w.querySelector('#ppGrp'), keep = st.grp; g.innerHTML = '<option value="">Mọi nhóm</option>' + Object.keys(gs).sort().map(function (x) { return '<option value="' + esc(x) + '"' + (x === keep ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
    var rows = filtered(), show = rows.slice(0, st.limit), area = st.area, showAmt = area > 0;
    var html = '<table class="pp-tbl"><thead><tr><th>Mã</th><th>Tên / phạm vi</th><th>ĐVT</th><th class="n">Giá thấp</th><th class="n">Giá TB</th><th class="n">Giá cao</th>' + (showAmt ? '<th class="n">Thành tiền thấp</th><th class="n">Thành tiền cao</th>' : '') + '<th>Nhà cung cấp / ghi chú</th></tr></thead><tbody>';
    var last = '';
    show.forEach(function (e, i) {
      var sec = e.kind === 'ct' || e.kind === 'vt' ? KIND_LABEL[e.kind] + (e.grp ? ' · ' + e.grp : '') : KIND_LABEL[e.kind];
      if (sec !== last) { html += '<tr class="pp-sec"><td colspan="' + (showAmt ? 9 : 7) + '">' + esc(sec) + '</td></tr>'; last = sec; }
      var perM2 = showAmt && /m2|m²/i.test(e.unit) && (e.kind === 'nc' || e.kind === 'tho');
      var sub = [e.spec, e.kind === 'ct' && (e.vlL || e.ncL) ? 'VL ' + fmt(e.vlL) + '–' + fmt(e.vlH) + ' + NC ' + fmt(e.ncL) + '–' + fmt(e.ncH) : '', e.note ? 'Loại trừ: ' + e.note : ''].filter(Boolean);
      html += '<tr class="pp-row" data-i="' + rows.indexOf(e) + '"><td class="c">' + esc(e.code) + '</td><td>' + (e.kind === 'tho' ? '<span class="tg">' + esc(e.type) + '</span><br>' : '') + esc(e.name) + sub.map(function (s) { return '<span class="sub">' + esc(s) + '</span>'; }).join('') + (e.bad ? '<span class="warn">⚠ DGHT ghi ' + fmt(e.low) + ' ≠ VL+NC ' + fmt(e.calcL) + '</span>' : '') + '</td><td>' + esc(e.unit) + '</td>' +
        '<td class="n">' + fmt(e.low) + '</td><td class="n mid">' + fmt(e.mid) + '</td><td class="n">' + fmt(e.high) + '</td>' + (showAmt ? '<td class="n">' + (perM2 ? fmt(e.low * area) : '') + '</td><td class="n">' + (perM2 ? fmt(e.high * area) : '') + '</td>' : '') + '<td>' + esc(e.ncc || '') + (e.src ? '<span class="sub">Nguồn: ' + esc(e.src) + '</span>' : '') + '</td></tr>';
    });
    if (!show.length) html += '<tr><td colspan="' + (showAmt ? 9 : 7) + '" class="pr-empty">Không có mục nào khớp bộ lọc.</td></tr>';
    html += '</tbody></table>' + (rows.length > show.length ? '<button type="button" class="pr-btn pr-btn-ghost pp-more" data-more>Hiện thêm (còn ' + (rows.length - show.length) + ' mục — hoặc thu hẹp bằng ô tìm kiếm)</button>' : '');
    w.querySelector('#ppTbl').innerHTML = html;
  }

  // ---- so sánh giá giữa các tỉnh ----
  function openCompare(e) {
    if (!e || !e.code) return;
    var old = document.getElementById('ppOv'); if (old) old.remove();
    var ov = document.createElement('div'); ov.className = 'pp-ov'; ov.id = 'ppOv';
    ov.innerHTML = '<div class="pp-box"><h4><span>' + esc(e.name) + '<span class="sub" style="font-weight:400;font-size:.75rem;color:var(--pr-muted);display:block;margin-top:3px;">Mã ' + esc(e.code) + ' · ' + esc(e.unit) + ' · so sánh giữa các tỉnh/thành</span></span><button class="x" aria-label="Đóng">&times;</button></h4><div id="ppCmpBody" class="pr-empty">Đang tải bảng giá các tỉnh… (vài giây)</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function (ev) { if (ev.target === ov) ov.remove(); }); ov.querySelector('.x').addEventListener('click', function () { ov.remove(); });
    jget(api() + '?action=getPriceDbCompare&kind=' + e.kind + '&code=' + encodeURIComponent(e.code)).then(function (d) {
      if (d.error || !d.rows || !d.rows.length) throw new Error(d.error || 'Không có dữ liệu');
      var h = d.headers, ix = function (n) { return h.indexOf(n); }, list = d.rows.map(function (r) {
        var low, high;
        if (e.kind === 'nc') { low = num(r[ix('Giá thấp')]); high = num(r[ix('Giá cao')]); }
        else if (e.kind === 'tho') { low = num(r[ix(e.variant === 'tg' ? 'Trọn gói thấp' : 'Phần thô thấp')]); high = num(r[ix(e.variant === 'tg' ? 'Trọn gói cao' : 'Phần thô cao')]); }
        else if (e.kind === 'vt') { low = num(r[ix('Giá thấp')]); high = num(r[ix('Giá cao')]); }
        else { low = num(r[ix('DGHT thấp')]); high = num(r[ix('DGHT cao')]); }
        return { p: String(r[0]), low: low, high: high || low };
      }).filter(function (x) { return x.low || x.high; }).sort(function (a, b) { return a.low - b.low; });
      var lows = list.map(function (x) { return x.low; }), mn = Math.min.apply(null, lows), mx = Math.max.apply(null, lows), avg = lows.reduce(function (s, v) { return s + v; }, 0) / lows.length, cur = list.filter(function (x) { return x.p === st.province; })[0];
      var body = '<div class="pp-stats"><div><b>' + fmt(mn) + '</b>Thấp nhất (giá thấp)</div><div><b>' + fmt(avg) + '</b>Trung bình ' + list.length + ' tỉnh</div><div><b>' + fmt(mx) + '</b>Cao nhất</div><div><b>' + (cur ? (cur.low >= avg ? '+' : '') + Math.round((cur.low / avg - 1) * 100) + '%' : '—') + '</b>' + esc(st.province) + ' so với TB</div></div>' +
        '<div style="overflow-x:auto;max-height:55vh"><table class="pp-tbl pp-cmp" style="min-width:520px"><thead><tr><th>#</th><th>Tỉnh/thành</th><th class="n">Giá thấp</th><th class="n">Giá cao</th><th style="width:30%"></th></tr></thead><tbody>' +
        list.map(function (x, i) { return '<tr class="' + (x.p === st.province ? 'me' : '') + '"><td class="c">' + (i + 1) + '</td><td>' + esc(x.p) + '</td><td class="n">' + fmt(x.low) + '</td><td class="n">' + fmt(x.high) + '</td><td><div class="pp-bar2" style="width:' + Math.max(3, Math.round(x.low / mx * 100)) + '%"></div></td></tr>'; }).join('') + '</tbody></table></div>';
      document.getElementById('ppCmpBody').className = ''; document.getElementById('ppCmpBody').innerHTML = body;
    }).catch(function (err) { var b = document.getElementById('ppCmpBody'); if (b) b.textContent = 'Không tải được: ' + (err && err.message || err); });
  }

  // ---- Excel ----
  function exportXls() {
    var rows = filtered(); if (!rows.length) { alert('Không có mục nào để xuất.'); return; }
    var go = function () {
      var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Đơn giá ' + st.province.slice(0, 20));
      ws.columns = [{ header: 'Loại', width: 20 }, { header: 'Nhóm', width: 24 }, { header: 'Mã', width: 9 }, { header: 'Tên', width: 44 }, { header: 'Spec / phạm vi', width: 44 }, { header: 'ĐVT', width: 12 }, { header: 'Giá thấp', width: 14 }, { header: 'Giá TB', width: 14 }, { header: 'Giá cao', width: 14 }, { header: 'NCC / ghi chú', width: 40 }];
      rows.forEach(function (e, i) { var r = ws.addRow([e.type, e.grp || '', e.code, e.name, e.spec, e.unit, e.low, null, e.high, [e.ncc, e.note ? 'Loại trừ: ' + e.note : ''].filter(Boolean).join(' · ')]); r.getCell(8).value = { formula: 'ROUND((G' + (i + 2) + '+I' + (i + 2) + ')/2,-3)' }; [7, 8, 9].forEach(function (c) { r.getCell(c).numFmt = '#,##0'; }); });
      var h = ws.getRow(1); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22272E' } }; }); ws.views = [{ state: 'frozen', ySplit: 1 }]; ws.autoFilter = { from: 'A1', to: 'J1' };
      wb.xlsx.writeBuffer().then(function (buf) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = 'Don-gia-' + norm(st.province).replace(/[^a-z0-9]+/g, '-') + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); });
    };
    if (window.ExcelJS) go(); else { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'; s.onload = go; document.head.appendChild(s); }
  }

  function select(name) {
    st.province = name; st.kind = 'all'; st.q = ''; st.grp = ''; st.limit = 150;
    if (!name) { els.wrap.className = 'pr-empty'; els.wrap.textContent = 'Chọn tỉnh/thành phía trên để xem bảng đơn giá.'; if (opts.onLoaded) opts.onLoaded(''); return; }
    els.wrap.className = 'pr-empty'; els.wrap.textContent = 'Đang tải bảng giá ' + name + '… (lần đầu mất vài giây, sau đó dùng bộ nhớ đệm)';
    load(name).then(function () { if (st.province !== name) return; frame(); render(); if (opts.onLoaded) opts.onLoaded(name); })
      .catch(function (e) { if (st.province === name) { els.wrap.className = 'pr-empty'; els.wrap.textContent = 'Không tải được bảng giá: ' + (e && e.message || e); } });
  }
  function mount(o) {
    opts = o; els.select = o.select; els.wrap = o.wrap;
    o.select.addEventListener('change', function () { select(o.select.value); });
    if (api()) jget(api() + '?action=getPriceDbProvinces').then(function (l) { (Array.isArray(l) ? l : []).forEach(function (x) { meta[x['Tỉnh/thành']] = x; }); if (st.province) render(); }).catch(function () { /* không có thông tin vùng thì thôi */ });
  }
  function entries(name) { return (data[name] || []).filter(function (e) { return e.kind === 'vt'; }).map(function (e) { return { name: e.name, unit: String(e.unit || '').toLowerCase().trim(), low: e.low, high: e.high }; }); }
  return { mount: mount, select: select, entries: entries, load: load, jget: jget };
})();
