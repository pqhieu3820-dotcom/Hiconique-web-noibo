/* Trang "Dự toán & Thanh quyết toán" (pages/estimate.html) — 2026-10-02.
 * Dữ liệu: sheet DTQT-Dự toán / DTQT-Mã công việc / DTQT-Đơn giá tỉnh / DTQT-Thanh quyết toán (qua TaskManager.loadColl/saveColl…); đơn giá gốc đọc TRỰC TIẾP từ DG-* (getPriceDb) — không ghi vào DG-.
 * Cách tính đơn giá 1 công tác tại tỉnh P, mức giá T, kỳ M (giống phần mềm dự toán: đơn giá cập nhật theo tỉnh & kỳ giá):
 *   1) có dòng "Đơn giá tỉnh" (DTQT-, loại công tác) của tỉnh P, kỳ ≤ M → dùng; 2) mã thuộc thư viện DTQT có định mức hao phí → Σ định mức × giá hao phí (theo tỉnh);
 *   3) mã thuộc thư viện không định mức → VL/NC/Máy gốc; 4) mã thuộc DG-* → giá thấp/trung bình/cao của tỉnh P.
 * Chi phí (TT 11/2021/TT-BXD, tỷ lệ sửa được): T = VL + NC×Knc + M×Kmtc; CP trực tiếp khác = T×%; CP chung = (T+khác)×%; TN chịu thuế tính trước = (T+khác+chung)×%; VAT; dự phòng. */
(function () {
  'use strict';
  var TM = window.TaskManager, $ = function (id) { return document.getElementById(id); };
  if (!TM || !$('esEst')) return;

  // ---------- tiện ích ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n0(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function fmt(n) { return Math.round(n0(n)).toLocaleString('vi-VN'); }
  function fmtQ(n) { n = n0(n); return (Math.round(n * 1000) / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 3 }); }
  function pnum(s) { if (typeof s === 'number') return s; var t = String(s == null ? '' : s).replace(/\s/g, ''); if (!t) return 0; if (/,/.test(t) && /\./.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else if (/,/.test(t)) t = t.replace(',', '.'); else if (/\.\d{3}(\D|$)/.test(t) && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, ''); var v = parseFloat(t); return isFinite(v) ? v : 0; }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function user() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function today() { return new Date().toISOString().split('T')[0]; }
  function thisMonth() { return today().slice(0, 7); }
  function uid(p) { return (p || 'r') + Math.random().toString(36).slice(2, 9); }
  function toast(msg) { var t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#22272E;color:#fff;border:1px solid #B8935A;padding:10px 18px;border-radius:10px;font:600 .8125rem Inter,sans-serif;z-index:900;max-width:90vw'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function modal(title, body, wide) {
    var ov = document.createElement('div'); ov.className = 'es-overlay';
    ov.innerHTML = '<div class="es-modal" style="max-width:' + (wide || 920) + 'px"><h2><span>' + title + '</span><button type="button" class="es-x" data-x aria-label="Đóng">×</button></h2><div data-body>' + body + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('[data-x]').addEventListener('click', function () { ov.remove(); });
    ov.close = function () { ov.remove(); };
    return ov;
  }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600); }
  function plain(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'du-toan'; }

  // ---------- hằng số ----------
  var PROVINCES = ['Tuyên Quang', 'Cao Bằng', 'Lào Cai', 'Điện Biên', 'Lai Châu', 'Sơn La', 'Lạng Sơn', 'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh', 'Quảng Ninh', 'Hà Nội', 'Hải Phòng', 'Hưng Yên', 'Ninh Bình', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Trị', 'Huế', 'Đà Nẵng', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Đắk Lắk', 'Lâm Đồng', 'Đồng Nai', 'TP. Hồ Chí Minh', 'Tây Ninh', 'Đồng Tháp', 'Vĩnh Long', 'Cần Thơ', 'Cà Mau', 'An Giang'];
  // tỷ lệ tham khảo theo TT 11/2021/TT-BXD (chi phí chung / thu nhập chịu thuế tính trước, %) — có thể sửa từng dự toán
  var KINDS = { dandung: ['Công trình dân dụng', 6.5, 5.5], congnghiep: ['Công trình công nghiệp', 5.5, 5.5], giaothong: ['Giao thông / hạ tầng kỹ thuật', 5.3, 5.5], noithat: ['Nội thất / hoàn thiện', 6.5, 5.5] };
  var TIERS = { low: 'Giá thấp', mid: 'Giá trung bình', high: 'Giá cao' };
  var SRC_LABEL = { lib: 'Thư viện', ct: 'DG công tác', vt: 'DG vật tư', nc: 'DG nhân công', manual: 'Nhập tay' };

  var st = { tab: 'est', est: null, estId: '', dirty: false, saving: false, set: null, setId: '', setView: 'period', libTab: 'codes', provinces: PROVINCES.slice() };
  var dgMem = {};

  // ---------- đọc DG-* (không ghi) ----------
  function api() { return typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL ? GSHEETS_CONFIG.API_URL : ''; }
  function jget(url, tries) {
    tries = tries || 3;
    return fetch(url, { redirect: 'follow' }).then(function (r) { return r.text(); }).then(function (t) { var c = t.charAt(0); if (c === '{' || c === '[') return JSON.parse(t); throw new Error('Máy chủ trả dữ liệu lỗi'); })
      .catch(function (e) { if (tries <= 1) throw e; return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return jget(url, tries - 1); }); });
  }
  function idxOf(h, names) { for (var i = 0; i < names.length; i++) { var k = h.indexOf(names[i]); if (k !== -1) return k; } return -1; }
  function parseDg(res) {
    var out = { ct: [], vt: [], nc: [] }, T = (res && res.tables) || {};
    if (T.ct) { var h = T.ct.headers, ci = { code: idxOf(h, ['Mã']), grp: idxOf(h, ['Nhóm']), name: idxOf(h, ['Công tác']), spec: idxOf(h, ['Phạm vi/spec']), unit: idxOf(h, ['ĐVT']), vl0: idxOf(h, ['VL thấp']), vl1: idxOf(h, ['VL cao']), nc0: idxOf(h, ['NC thấp']), nc1: idxOf(h, ['NC cao']), d0: idxOf(h, ['DGHT thấp']), d1: idxOf(h, ['DGHT cao']) };
      T.ct.rows.forEach(function (r) { var vl0 = n0(r[ci.vl0]), vl1 = n0(r[ci.vl1]), nc0 = n0(r[ci.nc0]), nc1 = n0(r[ci.nc1]); if (!vl0 && !vl1 && !nc0 && !nc1) { nc0 = n0(r[ci.d0]); nc1 = n0(r[ci.d1]); }
        out.ct.push({ src: 'ct', code: String(r[ci.code]), name: String(r[ci.name] || ''), spec: String(r[ci.spec] || ''), unit: String(r[ci.unit] || ''), group: String(r[ci.grp] || ''), lo: { vl: vl0, nc: nc0 }, hi: { vl: vl1 || vl0, nc: nc1 || nc0 } }); }); }
    if (T.vt) { var hv = T.vt.headers, vi = { code: idxOf(hv, ['Mã']), grp: idxOf(hv, ['Nhóm']), name: idxOf(hv, ['Vật tư/thiết bị']), spec: idxOf(hv, ['Spec kỹ thuật tối thiểu']), unit: idxOf(hv, ['ĐVT']), a: idxOf(hv, ['Giá thấp']), b: idxOf(hv, ['Giá cao']) };
      T.vt.rows.forEach(function (r) { out.vt.push({ src: 'vt', code: String(r[vi.code]), name: String(r[vi.name] || ''), spec: String(r[vi.spec] || ''), unit: String(r[vi.unit] || ''), group: String(r[vi.grp] || ''), lo: { vl: n0(r[vi.a]), nc: 0 }, hi: { vl: n0(r[vi.b]) || n0(r[vi.a]), nc: 0 } }); }); }
    if (T.nc) { var hn = T.nc.headers, ni = { code: idxOf(hn, ['Mã']), type: idxOf(hn, ['Loại nhà']), spec: idxOf(hn, ['Quy mô/spec giả định']), unit: idxOf(hn, ['ĐVT']), a: idxOf(hn, ['Giá thấp']), b: idxOf(hn, ['Giá cao']) };
      T.nc.rows.forEach(function (r) { out.nc.push({ src: 'nc', code: String(r[ni.code]), name: 'Nhân công khoán — ' + String(r[ni.type] || ''), spec: String(r[ni.spec] || ''), unit: String(r[ni.unit] || ''), group: 'Nhân công khoán', lo: { vl: 0, nc: n0(r[ni.a]) }, hi: { vl: 0, nc: n0(r[ni.b]) || n0(r[ni.a]) } }); }); }
    return out;
  }
  function dgLoad(prov) {
    if (!prov) return Promise.resolve({ ct: [], vt: [], nc: [] });
    if (dgMem[prov]) return Promise.resolve(dgMem[prov]);
    var key = 'hq_dtqt_dg_' + prov;
    try { var c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 6 * 3600 * 1000) { dgMem[prov] = c.d; return Promise.resolve(c.d); } } catch (e) { }
    if (!api()) return Promise.resolve({ ct: [], vt: [], nc: [] });
    return jget(api() + '?action=getPriceDb&province=' + encodeURIComponent(prov)).then(function (res) {
      var d = parseDg(res); dgMem[prov] = d;
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { }
      return d;
    }).catch(function () { return { ct: [], vt: [], nc: [] }; });
  }
  function dgFind(prov, src, code) { var d = dgMem[prov]; if (!d || !d[src]) return null; for (var i = 0; i < d[src].length; i++) if (d[src][i].code === code) return d[src][i]; return null; }
  function dgTier(e, tier) { var t = tier === 'low' ? 0 : tier === 'high' ? 1 : 0.5, r = function (a, b) { var v = a + (b - a) * t; return t === 0.5 ? (Math.round(v / 1000) * 1000 || Math.round(v)) : Math.round(v); }; return { vl: r(e.lo.vl, e.hi.vl), nc: r(e.lo.nc, e.hi.nc), may: 0 }; }

  // ---------- thư viện DTQT & đơn giá tỉnh ----------
  function libCodes() { return TM.listColl('dtqtCodes').filter(function (c) { return !(c.active === false || String(c.active).toLowerCase() === 'false'); }); }
  function libResources(rec) { var a = TM.unpackJson(rec, 'res', 2, []); return Array.isArray(a) ? a : []; }
  function priceRows() { return TM.listColl('dtqtPrices'); }
  function findOv(code, prov, month) {
    var l = priceRows().filter(function (p) { return p.kind === 'work' && String(p.key) === String(code) && p.province === prov; });
    if (!l.length) return null;
    l.sort(function (a, b) { return String(b.month || '').localeCompare(String(a.month || '')); });
    for (var i = 0; i < l.length; i++) if (!month || !l[i].month || String(l[i].month) <= month) return l[i];
    return l[l.length - 1];
  }
  function resPrice(r, prov, month) {
    var key = String(r.code || r.name), l = priceRows().filter(function (p) { return p.kind === 'resource' && String(p.key) === key && (p.province === prov || !p.province); });
    l.sort(function (a, b) { return (b.province === prov ? 1 : 0) - (a.province === prov ? 1 : 0) || String(b.month || '').localeCompare(String(a.month || '')); });
    for (var i = 0; i < l.length; i++) if (!month || !l[i].month || String(l[i].month) <= month) return n0(l[i].price);
    return n0(r.price);
  }
  function libPrice(rec, prov, month) {
    var res = libResources(rec);
    if (!res.length) return { vl: n0(rec.vl), nc: n0(rec.nc), may: n0(rec.may), by: 'Thư viện DTQT' };
    var s = { vl: 0, nc: 0, may: 0 };
    res.forEach(function (r) { var t = String(r.t || 'VL').toUpperCase(), k = t === 'NC' ? 'nc' : t === 'M' || t === 'MAY' ? 'may' : 'vl'; s[k] += n0(r.qty) * resPrice(r, prov, month); });
    return { vl: Math.round(s.vl), nc: Math.round(s.nc), may: Math.round(s.may), by: 'Định mức × giá hao phí' };
  }
  function priceFor(e, prov, tier, month) {
    var ov = findOv(e.code, prov, month);
    if (ov) return { vl: n0(ov.vl), nc: n0(ov.nc), may: n0(ov.may), by: 'Đơn giá tỉnh DTQT-' + (ov.month ? ' (' + ov.month + ')' : '') };
    if (e.src === 'lib') return libPrice(e.rec, prov, month);
    var p = dgTier(e, tier); p.by = 'DG- ' + prov; return p;
  }
  function catalog(prov) {
    var out = libCodes().map(function (c) { return { src: 'lib', code: c.code, name: c.name, unit: c.unit, group: c.group || '', spec: c.normSource || '', rec: c }; });
    var d = dgMem[prov] || { ct: [], vt: [], nc: [] };
    return out.concat(d.ct, d.nc, d.vt);
  }
  function entryOf(line, prov) {
    if (line.src === 'lib') { var c = libCodes().filter(function (x) { return x.code === line.code; })[0]; return c ? { src: 'lib', code: c.code, rec: c } : null; }
    return dgFind(prov, line.src, line.code);
  }

  // ---------- dự toán: mô hình & tính tiền ----------
  function defaultParams(kind) { var k = KINDS[kind] || KINDS.dandung; return { knc: 1, kmay: 1, other: 0, cc: k[1], tl: k[2], vat: 10, prov: 0, kns: 1, crew: 10, target: 0 }; }
  function parseParams(rec) { var p = rec.params; if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } } return Object.assign(defaultParams(rec.kind), p && typeof p === 'object' ? p : {}); }
  function newEst(o) {
    var kind = o.kind || 'dandung';
    return { id: '', name: o.name || 'Dự toán mới', projectId: o.projectId || '', province: o.province || 'Hải Phòng', kind: kind, tier: 'mid', priceMonth: thisMonth(), customer: '', contractNo: '', status: 'Nháp', params: defaultParams(kind), note: '', items: [] };
  }
  function loadEstRec(rec) {
    var items = TM.unpackJson(rec, 'items', 6, []);
    return { id: rec.id, name: rec.name || '', projectId: rec.projectId || '', province: rec.province || '', kind: rec.kind || 'dandung', tier: rec.tier || 'mid', priceMonth: rec.priceMonth || thisMonth(), customer: rec.customer || '', contractNo: rec.contractNo || '', status: rec.status || 'Nháp', params: parseParams(rec), note: rec.note || '', items: Array.isArray(items) ? items : [] };
  }
  function calc(est, qtyOf) {
    // qtyOf(item) cho phép tái dùng cho thanh toán (khối lượng kỳ này); mặc định khối lượng dự toán
    var P = est.params, rows = [], g = null, gi = 0, ii = 0, VL = 0, NC = 0, MM = 0;
    est.items.forEach(function (it) {
      if (it.t === 'g') { g = { id: it.id, vl: 0, nc: 0, mm: 0, tot: 0 }; gi++; ii = 0; rows.push({ it: it, grp: g, stt: String.fromCharCode(64 + ((gi - 1) % 26) + 1) }); return; }
      var q = qtyOf ? n0(qtyOf(it)) : n0(it.qty), a = q * n0(it.vl), b = q * n0(it.nc) * P.knc, c = q * n0(it.may) * P.kmay;
      ii++; rows.push({ it: it, stt: String(ii), up: n0(it.vl) + n0(it.nc) * P.knc + n0(it.may) * P.kmay, vl: a, nc: b, mm: c, tot: a + b + c, grp: g });
      VL += a; NC += b; MM += c; if (g) { g.vl += a; g.nc += b; g.mm += c; g.tot += a + b + c; }
    });
    return { rows: rows, VL: VL, NC: NC, MM: MM, cost: costOf(VL + NC + MM, P) };
  }
  function costOf(T, P) {
    var other = T * n0(P.other) / 100, direct = T + other, cc = direct * n0(P.cc) / 100, tl = (direct + cc) * n0(P.tl) / 100, G = direct + cc + tl, vat = G * n0(P.vat) / 100, gxd = G + vat, prov = gxd * n0(P.prov) / 100;
    return { T: T, other: other, direct: direct, cc: cc, tl: tl, G: G, vat: vat, gxd: gxd, prov: prov, total: gxd + prov };
  }
  var saveTimer = null;
  function touch() { st.dirty = true; setStatus('Chưa lưu…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveEst, 1500); }
  function setStatus(t) { var e = $('esSaveState'); if (e) e.textContent = t; }
  function saveEst(cb) {
    clearTimeout(saveTimer);
    var e = st.est; if (!e || !st.dirty) { if (typeof cb === 'function') cb(); return; }
    var c = calc(e), pk = TM.packJson('items', e.items, 6);
    if (!pk) { alert('Dự toán quá lớn để lưu (hơn ~1.500 dòng). Hãy tách thành nhiều dự toán.'); return; }
    var rec = Object.assign({ id: e.id || undefined, name: e.name, projectId: e.projectId, province: e.province, kind: e.kind, tier: e.tier, priceMonth: e.priceMonth, customer: e.customer, contractNo: e.contractNo, status: e.status, params: JSON.stringify(e.params), note: e.note, directCost: Math.round(c.cost.direct), total: Math.round(c.cost.total) }, pk);
    if (!e.id) delete rec.id;
    var saved = TM.saveColl('dtqtEstimates', rec, user());
    if (saved) { e.id = saved.id; st.estId = saved.id; st.dirty = false; setStatus('Đã lưu ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })); var sel = $('esPick'); if (sel && !sel.querySelector('option[value="' + saved.id + '"]')) renderEst(); else refreshPickLabel(); }
    else setStatus('Không lưu được (mất mạng hoặc chưa đăng nhập)');
    if (typeof cb === 'function') cb();
  }
  function refreshPickLabel() { var sel = $('esPick'); if (!sel || !st.est) return; var o = sel.querySelector('option[value="' + st.est.id + '"]'); if (o) o.textContent = st.est.name; }
  function estList() { return TM.listColl('dtqtEstimates').sort(function (a, b) { return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')); }); }

  // ---------- TAB DỰ TOÁN ----------
  function projectOptions(cur) { var ps = []; try { ps = TM.getProjects() || []; } catch (e) { } return '<option value="">— Không gắn dự án —</option>' + ps.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' + esc(p.name || p.id) + '</option>'; }).join(''); }
  function provOptions(cur) { var l = st.provinces.slice(); if (cur && l.indexOf(cur) === -1) l.push(cur); return l.map(function (p) { return '<option' + (p === cur ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join(''); }
  function renderEst() {
    var list = estList(), root = $('esEst');
    if (!st.est && list.length) { var pick = st.estId && list.filter(function (x) { return x.id === st.estId; })[0] || list[0]; st.est = loadEstRec(pick); st.estId = pick.id; }
    var e = st.est;
    var bar = '<div class="es-toolbar"><select class="es-select" id="esPick" style="min-width:260px">' + (list.length ? list.map(function (x) { return '<option value="' + x.id + '"' + (e && x.id === e.id ? ' selected' : '') + '>' + esc(x.name || x.id) + '</option>'; }).join('') : '<option value="">(chưa có dự toán)</option>') + '</select>' +
      '<button class="es-btn es-btn-primary" id="esNew" type="button">+ Dự toán mới</button>' + (e ? '<button class="es-btn" id="esDup" type="button">Nhân bản</button><button class="es-btn es-btn-danger" id="esDel" type="button">Xoá</button>' : '') +
      '<span class="es-spacer"></span><span class="es-note" id="esSaveState">' + (st.dirty ? 'Chưa lưu…' : (e && e.id ? 'Đã lưu' : '')) + '</span>' +
      (e ? '<button class="es-btn" id="esExcel" type="button">Xuất Excel</button><button class="es-btn" id="esPrint" type="button">In / PDF</button>' : '') + '</div>';
    if (!e) { root.innerHTML = bar + '<div class="es-card"><div class="es-empty">Chưa có dự toán nào. Bấm <b>+ Dự toán mới</b> để bắt đầu.</div></div>'; bindEstTop(); return; }
    var P = e.params;
    var info = '<div class="es-card"><h3>Thông tin dự toán <small>· đơn giá lấy theo tỉnh/thành và kỳ giá bên dưới</small></h3><div class="es-grid4">' +
      '<div style="grid-column:span 2"><label class="es-label">Tên dự toán / công trình</label><input class="es-input" id="eName" value="' + esc(e.name) + '"></div>' +
      '<div><label class="es-label">Dự án</label><select class="es-select" id="eProj">' + projectOptions(e.projectId) + '</select></div>' +
      '<div><label class="es-label">Trạng thái</label><select class="es-select" id="eStatus">' + ['Nháp', 'Đã gửi khách', 'Đã chốt (hợp đồng)', 'Đang thực hiện', 'Đã quyết toán'].map(function (s) { return '<option' + (s === e.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="es-label">Tỉnh / Thành phố</label><select class="es-select" id="eProv">' + provOptions(e.province) + '</select></div>' +
      '<div><label class="es-label">Loại công trình</label><select class="es-select" id="eKind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (k === e.kind ? ' selected' : '') + '>' + KINDS[k][0] + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="es-label">Mức giá</label><select class="es-select" id="eTier">' + Object.keys(TIERS).map(function (k) { return '<option value="' + k + '"' + (k === e.tier ? ' selected' : '') + '>' + TIERS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="es-label">Kỳ giá (tháng)</label><input class="es-input" type="month" id="eMonth" value="' + esc(e.priceMonth) + '"></div>' +
      '<div style="grid-column:span 2"><label class="es-label">Chủ đầu tư / khách hàng</label><input class="es-input" id="eCust" value="' + esc(e.customer) + '"></div>' +
      '<div><label class="es-label">Số hợp đồng</label><input class="es-input" id="eCon" value="' + esc(e.contractNo) + '"></div>' +
      '<div><label class="es-label">&nbsp;</label><button class="es-btn" id="eReprice" type="button" style="width:100%" title="Tính lại đơn giá các dòng (trừ dòng đã sửa tay) theo tỉnh, mức giá và kỳ giá đang chọn">⟳ Cập nhật đơn giá</button></div>' +
      '</div></div>';
    var tb = '<div class="es-card"><div class="es-toolbar" style="margin-bottom:10px"><h3 style="margin:0">Bảng dự toán chi tiết</h3><span class="es-spacer"></span>' +
      '<button class="es-btn es-btn-sm" id="eAddGrp" type="button">+ Hạng mục</button><button class="es-btn es-btn-sm es-btn-primary" id="eAddItem" type="button">+ Công tác (từ mã việc / DG-)</button><button class="es-btn es-btn-sm" id="eAddBlank" type="button">+ Dòng trống</button><button class="es-btn es-btn-sm" id="ePaste" type="button">Dán từ Excel</button></div>' +
      '<div class="es-tablewrap"><table class="es-table"><thead><tr><th style="width:42px">STT</th><th style="width:96px">Mã hiệu</th><th>Nội dung công tác</th><th style="width:66px">ĐVT</th><th class="num" style="width:96px">Khối lượng</th><th class="num" style="width:104px">Vật liệu</th><th class="num" style="width:104px">Nhân công</th><th class="num" style="width:90px">Máy</th><th class="num" style="width:110px">Đơn giá</th><th class="num" style="width:130px">Thành tiền</th><th style="width:92px"></th></tr></thead><tbody id="eRows"></tbody></table></div>' +
      '<p class="es-note" style="margin:8px 0 0">Ô màu cam = đơn giá đã sửa tay (không bị ghi đè khi bấm “Cập nhật đơn giá”). Đơn giá lấy theo mức <b>' + TIERS[e.tier] + '</b> của <b>' + esc(e.province) + '</b>.</p></div>';
    var sum = '<div class="es-card"><h3>Tổng hợp chi phí <small>· tỷ lệ theo TT 11/2021/TT-BXD, sửa được</small></h3><div id="eSum" class="es-sum"></div></div>';
    root.innerHTML = bar + info + tb + sum;
    bindEstTop(); bindEstInfo(); bindEstTable();
    renderRows(); renderSum();
    if (e.province) dgLoad(e.province).then(function () { /* nạp sẵn để tìm/ cập nhật giá */ });
  }
  function bindEstTop() {
    var pick = $('esPick'); if (pick) pick.addEventListener('change', function () { saveEst(function () { var rec = estList().filter(function (x) { return x.id === pick.value; })[0]; if (rec) { st.est = loadEstRec(rec); st.estId = rec.id; } renderEst(); }); });
    var nw = $('esNew'); if (nw) nw.addEventListener('click', openNewEst);
    var dup = $('esDup'); if (dup) dup.addEventListener('click', function () { saveEst(function () { var c = JSON.parse(JSON.stringify(st.est)); c.id = ''; c.name += ' (bản sao)'; c.status = 'Nháp'; st.est = c; st.dirty = true; saveEst(function () { toast('Đã nhân bản dự toán'); renderEst(); }); }); });
    var del = $('esDel'); if (del) del.addEventListener('click', function () { if (!st.est.id || !confirm('Xoá dự toán "' + st.est.name + '"? (chuyển vào danh sách đã xoá, dữ liệu không mất khỏi Google Sheet)')) return; TM.removeColl('dtqtEstimates', st.est.id, user()); st.est = null; st.estId = ''; st.dirty = false; renderEst(); });
    var ex = $('esExcel'); if (ex) ex.addEventListener('click', function () { exportEstExcel(); });
    var pr = $('esPrint'); if (pr) pr.addEventListener('click', function () { printEst(); });
  }
  function openNewEst() {
    var ov = modal('Dự toán mới', '<div class="es-grid2"><div style="grid-column:span 2"><label class="es-label">Tên dự toán / công trình *</label><input class="es-input" id="nName" placeholder="VD: Nhà phố anh Nam — 3 tầng"></div><div><label class="es-label">Dự án</label><select class="es-select" id="nProj">' + projectOptions('') + '</select></div><div><label class="es-label">Tỉnh / Thành phố</label><select class="es-select" id="nProv">' + provOptions('Hải Phòng') + '</select></div><div style="grid-column:span 2"><label class="es-label">Loại công trình</label><select class="es-select" id="nKind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + KINDS[k][0] + '</option>'; }).join('') + '</select></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="es-btn" data-x2 type="button">Huỷ</button><button class="es-btn es-btn-primary" id="nOk" type="button">Tạo dự toán</button></div>', 560);
    ov.querySelector('[data-x2]').addEventListener('click', ov.close);
    ov.querySelector('#nOk').addEventListener('click', function () {
      var nm = ov.querySelector('#nName').value.trim(); if (!nm) { ov.querySelector('#nName').focus(); return; }
      saveEst(function () { st.est = newEst({ name: nm, projectId: ov.querySelector('#nProj').value, province: ov.querySelector('#nProv').value, kind: ov.querySelector('#nKind').value }); st.dirty = true; saveEst(function () { ov.close(); renderEst(); }); });
    });
  }
  function bindEstInfo() {
    var e = st.est, bind = function (id, key, after) { var el = $(id); if (el) el.addEventListener('change', function () { e[key] = el.value; touch(); if (after) after(); }); };
    bind('eName', 'name', refreshPickLabel); bind('eProj', 'projectId'); bind('eStatus', 'status'); bind('eCust', 'customer'); bind('eCon', 'contractNo');
    bind('eTier', 'tier'); bind('eMonth', 'priceMonth');
    var pv = $('eProv'); if (pv) pv.addEventListener('change', function () { e.province = pv.value; touch(); dgLoad(e.province).then(function () { if (confirm('Đã đổi tỉnh/thành sang ' + e.province + '. Cập nhật đơn giá các dòng theo tỉnh mới?')) reprice(); }); });
    var kd = $('eKind'); if (kd) kd.addEventListener('change', function () { e.kind = kd.value; var k = KINDS[e.kind]; if (confirm('Áp tỷ lệ chi phí chung ' + k[1] + '% và thu nhập chịu thuế tính trước ' + k[2] + '% cho loại công trình này?')) { e.params.cc = k[1]; e.params.tl = k[2]; renderSum(); } touch(); });
    var rp = $('eReprice'); if (rp) rp.addEventListener('click', function () { reprice(); });
  }
  function reprice(quiet) {
    var e = st.est; if (!e) return;
    dgLoad(e.province).then(function () {
      var n = 0, miss = 0;
      e.items.forEach(function (it) { if (it.t === 'g' || it.manual || it.src === 'manual') return; var en = entryOf(it, e.province); if (!en) { miss++; return; } var p = priceFor(en, e.province, e.tier, e.priceMonth); it.vl = p.vl; it.nc = p.nc; it.may = p.may; n++; });
      touch(); renderRows(); renderSum();
      if (!quiet) toast('Đã cập nhật đơn giá ' + n + ' dòng theo ' + e.province + ' · ' + TIERS[e.tier] + ' · kỳ ' + e.priceMonth + (miss ? ' — ' + miss + ' dòng không tìm thấy mã trong bảng giá tỉnh này (giữ nguyên)' : ''));
    });
  }

  function rowHtml(r) {
    var it = r.it, id = it.id;
    var btns = '<button class="es-x" data-mv="-1" title="Lên">↑</button> <button class="es-x" data-mv="1" title="Xuống">↓</button> <button class="es-x" data-del title="Xoá dòng">×</button>';
    if (it.t === 'g') return '<tr class="grp" data-id="' + id + '"><td>' + r.stt + '</td><td colspan="8"><input data-f="name" value="' + esc(it.name) + '" placeholder="Tên hạng mục (VD: Phần móng, Phần thân…)"></td><td class="num" data-sub>' + fmt(r.grp.tot) + '</td><td>' + btns + '</td></tr>';
    var man = it.manual || it.src === 'manual' ? ' manual' : '';
    return '<tr data-id="' + id + '"><td>' + r.stt + '</td><td><input data-f="code" value="' + esc(it.code) + '"></td><td><input data-f="name" value="' + esc(it.name) + '" title="' + esc(it.spec || '') + '"></td><td><input data-f="unit" value="' + esc(it.unit) + '"></td>' +
      '<td><input class="num" data-f="qty" value="' + (it.qty === '' || it.qty == null ? '' : fmtQ(it.qty)) + '" inputmode="decimal"></td>' +
      '<td><input class="num' + man + '" data-f="vl" value="' + (n0(it.vl) ? fmt(it.vl) : '') + '" inputmode="numeric"></td><td><input class="num' + man + '" data-f="nc" value="' + (n0(it.nc) ? fmt(it.nc) : '') + '" inputmode="numeric"></td><td><input class="num' + man + '" data-f="may" value="' + (n0(it.may) ? fmt(it.may) : '') + '" inputmode="numeric"></td>' +
      '<td class="num" data-up>' + fmt(r.up) + '</td><td class="num" data-tot>' + fmt(r.tot) + '</td><td>' + btns + '</td></tr>';
  }
  function renderRows() {
    var e = st.est, c = calc(e); $('eRows').innerHTML = c.rows.length ? c.rows.map(rowHtml).join('') : '<tr><td colspan="11" class="es-empty">Chưa có dòng nào. Bấm “+ Hạng mục” rồi “+ Công tác” để thêm từ mã việc / bảng giá DG- của tỉnh.</td></tr>';
  }
  function refreshAmounts() {
    var e = st.est, c = calc(e);
    c.rows.forEach(function (r) {
      var tr = document.querySelector('#eRows tr[data-id="' + r.it.id + '"]'); if (!tr) return;
      if (r.it.t === 'g') { var s = tr.querySelector('[data-sub]'); if (s) s.textContent = fmt(r.grp.tot); return; }
      var u = tr.querySelector('[data-up]'), t = tr.querySelector('[data-tot]'); if (u) u.textContent = fmt(r.up); if (t) t.textContent = fmt(r.tot);
    });
    renderSum(c);
  }
  function bindEstTable() {
    var body = $('eRows'), e = st.est;
    body.addEventListener('input', function (ev) {
      var inp = ev.target; if (!inp.dataset.f) return; var tr = inp.closest('tr'), it = e.items.filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!it) return;
      var f = inp.dataset.f;
      if (f === 'qty' || f === 'vl' || f === 'nc' || f === 'may') { it[f] = pnum(inp.value); if (f !== 'qty') { it.manual = true; inp.classList.add('manual'); } } else it[f] = inp.value;
      touch(); refreshAmounts();
    });
    body.addEventListener('blur', function (ev) {
      var inp = ev.target; if (!inp.dataset || !inp.dataset.f) return; var f = inp.dataset.f;
      if (f === 'qty') inp.value = inp.value === '' ? '' : fmtQ(pnum(inp.value)); else if (f === 'vl' || f === 'nc' || f === 'may') inp.value = pnum(inp.value) ? fmt(pnum(inp.value)) : '';
    }, true);
    body.addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr'); if (!tr) return; var i = e.items.findIndex(function (x) { return x.id === tr.dataset.id; }); if (i < 0) return;
      if (ev.target.closest('[data-del]')) { e.items.splice(i, 1); touch(); renderRows(); renderSum(); }
      else { var mv = ev.target.closest('[data-mv]'); if (mv) { var j = i + Number(mv.dataset.mv); if (j < 0 || j >= e.items.length) return; var t = e.items[i]; e.items[i] = e.items[j]; e.items[j] = t; touch(); renderRows(); } }
    });
    $('eAddGrp').addEventListener('click', function () { e.items.push({ id: uid('g'), t: 'g', name: '' }); touch(); renderRows(); var ins = $('eRows').querySelectorAll('tr.grp input'); if (ins.length) ins[ins.length - 1].focus(); });
    $('eAddBlank').addEventListener('click', function () { e.items.push({ id: uid('i'), t: 'i', code: '', name: '', unit: '', qty: 0, vl: 0, nc: 0, may: 0, src: 'manual', manual: true }); touch(); renderRows(); });
    $('eAddItem').addEventListener('click', function () { openPicker(function (en) { addEntry(en); }); });
    $('ePaste').addEventListener('click', openPasteLines);
  }
  function addEntry(en) {
    var e = st.est, p = priceFor(en, e.province, e.tier, e.priceMonth);
    e.items.push({ id: uid('i'), t: 'i', code: en.code, name: en.name, unit: en.unit, spec: en.spec || '', qty: 0, vl: p.vl, nc: p.nc, may: p.may, src: en.src, manual: false });
    touch();
  }

  // ---------- chọn công tác (thư viện + DG-) ----------
  function openPicker(onPick, opts) {
    opts = opts || {}; var e = st.est, prov = opts.province || (e && e.province) || 'Hải Phòng', tier = (e && e.tier) || 'mid', month = (e && e.priceMonth) || thisMonth(), added = 0, srcSel = 'all';
    var ov = modal('Thêm công tác <small style="font-weight:500;color:var(--es-muted)">· ' + esc(prov) + ' · ' + TIERS[tier] + '</small>', '<div class="es-toolbar"><input class="es-input" id="pkQ" placeholder="Tìm theo mã hiệu hoặc tên công tác (không cần dấu)…" style="flex:1 1 260px"><select class="es-select" id="pkSrc"><option value="all">Tất cả nguồn</option><option value="lib">Thư viện DTQT</option><option value="ct">DG — công tác hoàn chỉnh</option><option value="vt">DG — vật tư thiết bị</option><option value="nc">DG — nhân công khoán</option></select><span class="es-note" id="pkCnt"></span></div><div class="es-list" id="pkList"><div class="es-empty">Đang tải bảng giá tỉnh…</div></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="es-note" id="pkAdded"></span><button class="es-btn es-btn-primary" id="pkDone" type="button">Xong</button></div>', 980);
    function draw() {
      var q = norm(ov.querySelector('#pkQ').value), src = ov.querySelector('#pkSrc').value, list = catalog(prov).filter(function (x) { return (src === 'all' || x.src === src) && (!q || norm(x.code + ' ' + x.name + ' ' + (x.spec || '') + ' ' + (x.group || '')).indexOf(q) !== -1); });
      ov.querySelector('#pkCnt').textContent = list.length + ' kết quả' + (list.length > 120 ? ' (hiện 120 đầu)' : '');
      ov.querySelector('#pkList').innerHTML = list.length ? list.slice(0, 120).map(function (x, i) { var p = priceFor(x, prov, tier, month); return '<div class="row"><span class="c">' + esc(x.code) + '</span><span>' + esc(x.name) + '<small>' + esc((x.spec || x.group || '')) + '</small></span><span class="u">' + esc(x.unit) + '</span><span class="p">' + fmt(p.vl + p.nc + p.may) + '<small>VL ' + fmt(p.vl) + ' · NC ' + fmt(p.nc) + (p.may ? ' · M ' + fmt(p.may) : '') + '</small></span><span class="a"><button class="es-btn es-btn-sm" data-i="' + i + '" type="button">+ Thêm</button><small>' + SRC_LABEL[x.src] + '</small></span></div>'; }).join('') : '<div class="es-empty">Không tìm thấy. Thử từ khoá khác, hoặc thêm mã mới ở tab “Mã công việc & đơn giá tỉnh”.</div>';
      ov._shown = list.slice(0, 120);
    }
    dgLoad(prov).then(draw);
    ov.querySelector('#pkQ').addEventListener('input', draw); ov.querySelector('#pkSrc').addEventListener('change', draw);
    ov.querySelector('#pkList').addEventListener('click', function (ev) { var b = ev.target.closest('[data-i]'); if (!b) return; onPick(ov._shown[Number(b.dataset.i)]); added++; ov.querySelector('#pkAdded').textContent = 'Đã thêm ' + added + ' dòng'; b.textContent = '✓ Đã thêm'; });
    ov.querySelector('#pkDone').addEventListener('click', function () { ov.close(); if (!opts.noRender) { renderRows(); renderSum(); } });
    setTimeout(function () { ov.querySelector('#pkQ').focus(); }, 50);
  }
  function openPasteLines() {
    var ov = modal('Dán khối lượng từ Excel', '<p class="es-note">Mỗi dòng 1 công tác, các cột cách nhau bằng Tab (copy từ Excel) hoặc dấu “;”: <b>Mã hiệu · Nội dung · ĐVT · Khối lượng · Đơn giá VL · Đơn giá NC · Đơn giá máy</b>. Dòng chỉ có 1 ô → thành tên hạng mục. Cột đơn giá để trống → lấy theo mã trong thư viện/DG- của tỉnh.</p><textarea class="es-textarea" id="psTxt" style="min-height:220px" placeholder="W01&#9;Đào đất móng thủ công&#9;m3&#9;45,5"></textarea><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px"><button class="es-btn" data-x2 type="button">Huỷ</button><button class="es-btn es-btn-primary" id="psOk" type="button">Thêm vào bảng</button></div>', 820);
    ov.querySelector('[data-x2]').addEventListener('click', ov.close);
    ov.querySelector('#psOk').addEventListener('click', function () {
      var e = st.est, lines = ov.querySelector('#psTxt').value.split(/\r?\n/).filter(function (l) { return l.trim(); }), n = 0;
      dgLoad(e.province).then(function () {
        var cat = catalog(e.province);
        lines.forEach(function (l) {
          var c = l.indexOf('\t') !== -1 ? l.split('\t') : l.split(';'); c = c.map(function (x) { return x.trim(); });
          if (c.length === 1) { e.items.push({ id: uid('g'), t: 'g', name: c[0] }); n++; return; }
          var en = c[0] ? cat.filter(function (x) { return x.code === c[0]; })[0] : null, p = en ? priceFor(en, e.province, e.tier, e.priceMonth) : { vl: 0, nc: 0, may: 0 };
          var has = c[4] !== undefined && c[4] !== '' || c[5] !== undefined && c[5] !== '' || c[6] !== undefined && c[6] !== '';
          e.items.push({ id: uid('i'), t: 'i', code: c[0], name: c[1] || (en && en.name) || '', unit: c[2] || (en && en.unit) || '', qty: pnum(c[3]), vl: has ? pnum(c[4]) : p.vl, nc: has ? pnum(c[5]) : p.nc, may: has ? pnum(c[6]) : p.may, src: has ? 'manual' : (en ? en.src : 'manual'), manual: has || !en }); n++;
        });
        touch(); ov.close(); renderRows(); renderSum(); toast('Đã thêm ' + n + ' dòng');
      });
    });
  }

  // ---------- tổng hợp chi phí ----------
  function renderSum(c) {
    var e = st.est; if (!e || !$('eSum')) return; c = c || calc(e); var P = e.params, k = c.cost;
    var pct = function (key, step) { return '<input data-p="' + key + '" value="' + String(P[key]).replace('.', ',') + '" inputmode="decimal" title="Có thể sửa">'; };
    var line = function (label, val, ctl, cls) { return '<span class="k">' + label + '</span><span>' + (ctl || '') + '</span><span class="v ' + (cls || '') + '">' + fmt(val) + '</span>'; };
    $('eSum').innerHTML =
      line('Chi phí vật liệu', c.VL) + line('Chi phí nhân công <i style="opacity:.7">(× hệ số Knc)</i>', c.NC, pct('knc')) + line('Chi phí máy thi công <i style="opacity:.7">(× hệ số Kmtc)</i>', c.MM, pct('kmay')) +
      line('<b>Chi phí trực tiếp (T)</b>', k.T, '', 'tot') + line('Chi phí trực tiếp khác (% × T)', k.other, pct('other') + ' %') + line('Chi phí chung (% × trực tiếp)', k.cc, pct('cc') + ' %') + line('Thu nhập chịu thuế tính trước (% × (trực tiếp + chung))', k.tl, pct('tl') + ' %') +
      line('<b>Giá trị dự toán xây dựng trước thuế (G)</b>', k.G, '', 'tot') + line('Thuế giá trị gia tăng (VAT)', k.vat, pct('vat') + ' %') + line('<b>Giá trị dự toán sau thuế</b>', k.gxd, '', 'tot') + line('Chi phí dự phòng (% × sau thuế)', k.prov, pct('prov') + ' %') + line('<b>TỔNG GIÁ TRỊ DỰ TOÁN</b>', k.total, '', 'tot');
    $('eSum').querySelectorAll('input[data-p]').forEach(function (inp) {
      inp.addEventListener('input', function () { P[inp.dataset.p] = pnum(inp.value); touch(); var cc = calc(e); var hold = inp; renderSumValuesOnly(cc); });
    });
  }
  function renderSumValuesOnly(c) {
    var vals = $('eSum').querySelectorAll('.v'), k = c.cost, arr = [c.VL, c.NC, c.MM, k.T, k.other, k.cc, k.tl, k.G, k.vat, k.gxd, k.prov, k.total];
    vals.forEach(function (v, i) { v.textContent = fmt(arr[i]); });
  }

  // ---------- xuất Excel / in ----------
  function exportEstExcel() {
    var e = st.est; if (!e) return; if (typeof ExcelJS === 'undefined') { alert('Chưa tải xong bộ xuất Excel. Thử lại sau vài giây.'); return; }
    var c = calc(e), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Dự toán');
    ws.columns = [{ width: 6 }, { width: 14 }, { width: 52 }, { width: 9 }, { width: 13 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 15 }, { width: 17 }];
    ws.addRow(['DỰ TOÁN CHI PHÍ XÂY DỰNG']).font = { bold: true, size: 14 };
    ws.addRow(['Công trình: ' + e.name]); ws.addRow(['Địa điểm: ' + e.province + ' · Mức giá: ' + TIERS[e.tier] + ' · Kỳ giá: ' + e.priceMonth + (e.customer ? ' · CĐT: ' + e.customer : '')]); ws.addRow([]);
    var hr = ws.addRow(['STT', 'Mã hiệu', 'Nội dung công tác', 'ĐVT', 'Khối lượng', 'Đơn giá VL', 'Đơn giá NC', 'Đơn giá máy', 'Đơn giá', 'Thành tiền']);
    hr.font = { bold: true }; hr.eachCell(function (cl) { cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6D6' } }; cl.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; });
    c.rows.forEach(function (r) {
      var row = r.it.t === 'g' ? ws.addRow([r.stt, '', r.it.name, '', '', '', '', '', '', r.grp.tot]) : ws.addRow([r.stt, r.it.code, r.it.name, r.it.unit, n0(r.it.qty), n0(r.it.vl), n0(r.it.nc) * e.params.knc, n0(r.it.may) * e.params.kmay, r.up, r.tot]);
      if (r.it.t === 'g') row.font = { bold: true };
      row.eachCell({ includeEmpty: true }, function (cl, i) { cl.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }; if (i >= 5) cl.numFmt = '#,##0.###'; if (i >= 6) cl.numFmt = '#,##0'; });
      row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    });
    ws.addRow([]);
    var k = c.cost, P = e.params, sm = [['Chi phí vật liệu', c.VL], ['Chi phí nhân công (Knc = ' + P.knc + ')', c.NC], ['Chi phí máy thi công (Kmtc = ' + P.kmay + ')', c.MM], ['Chi phí trực tiếp (T)', k.T], ['Chi phí trực tiếp khác (' + P.other + '%)', k.other], ['Chi phí chung (' + P.cc + '%)', k.cc], ['Thu nhập chịu thuế tính trước (' + P.tl + '%)', k.tl], ['Giá trị dự toán xây dựng trước thuế (G)', k.G], ['Thuế GTGT (' + P.vat + '%)', k.vat], ['Giá trị dự toán sau thuế', k.gxd], ['Chi phí dự phòng (' + P.prov + '%)', k.prov], ['TỔNG GIÁ TRỊ DỰ TOÁN', k.total]];
    sm.forEach(function (s, i) { var row = ws.addRow(['', '', s[0], '', '', '', '', '', '', s[1]]); row.getCell(10).numFmt = '#,##0'; if (/^(Chi phí trực tiếp \(T\)|Giá trị|TỔNG)/.test(s[0])) row.font = { bold: true }; });
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    if (typeof HiconiqueExcel !== 'undefined' && HiconiqueExcel.standardize) { try { HiconiqueExcel.standardize(wb); } catch (er) { } }
    wb.xlsx.writeBuffer().then(function (buf) { download('du-toan-' + plain(e.name) + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); });
  }
  function printHtml(title, inner) {
    var w = window.open('', '_blank'); if (!w) { alert('Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi thử lại.'); return; }
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font:12px "Times New Roman",serif;margin:18mm 14mm;color:#000}h1{font-size:16px;text-align:center;margin:0 0 4px}p{margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #000;padding:3px 5px;vertical-align:top}th{background:#eee}td.n{text-align:right;white-space:nowrap}tr.g td{font-weight:bold;background:#f3f3f3}.sum td{border:none}.sum td.n{width:140px}@media print{@page{size:A4 landscape;margin:10mm}body{margin:0}}</style>' + inner + '<script>setTimeout(function(){window.print()},300)<\/script>');
    w.document.close();
  }
  function printEst() {
    var e = st.est; if (!e) return; var c = calc(e), k = c.cost, P = e.params;
    var rows = c.rows.map(function (r) { return r.it.t === 'g' ? '<tr class="g"><td>' + r.stt + '</td><td></td><td colspan="6">' + esc(r.it.name) + '</td><td class="n">' + fmt(r.grp.tot) + '</td></tr>' : '<tr><td>' + r.stt + '</td><td>' + esc(r.it.code) + '</td><td>' + esc(r.it.name) + '</td><td>' + esc(r.it.unit) + '</td><td class="n">' + fmtQ(r.it.qty) + '</td><td class="n">' + fmt(r.it.vl) + '</td><td class="n">' + fmt(n0(r.it.nc) * P.knc) + '</td><td class="n">' + fmt(n0(r.it.may) * P.kmay) + '</td><td class="n">' + fmt(r.tot) + '</td></tr>'; }).join('');
    var sm = [['Chi phí vật liệu', c.VL], ['Chi phí nhân công', c.NC], ['Chi phí máy thi công', c.MM], ['Chi phí trực tiếp (T)', k.T], ['Chi phí trực tiếp khác (' + P.other + '%)', k.other], ['Chi phí chung (' + P.cc + '%)', k.cc], ['Thu nhập chịu thuế tính trước (' + P.tl + '%)', k.tl], ['Giá trị trước thuế (G)', k.G], ['Thuế GTGT (' + P.vat + '%)', k.vat], ['Giá trị sau thuế', k.gxd], ['Dự phòng (' + P.prov + '%)', k.prov], ['TỔNG GIÁ TRỊ DỰ TOÁN', k.total]].map(function (s) { return '<tr class="sum"><td></td><td style="text-align:right">' + s[0] + '</td><td class="n"><b>' + fmt(s[1]) + '</b></td></tr>'; }).join('');
    printHtml('Dự toán ' + e.name, '<h1>DỰ TOÁN CHI PHÍ XÂY DỰNG</h1><p><b>Công trình:</b> ' + esc(e.name) + '</p><p><b>Địa điểm:</b> ' + esc(e.province) + ' · <b>Mức giá:</b> ' + TIERS[e.tier] + ' · <b>Kỳ giá:</b> ' + esc(e.priceMonth) + (e.customer ? ' · <b>CĐT:</b> ' + esc(e.customer) : '') + '</p><table><thead><tr><th>STT</th><th>Mã hiệu</th><th>Nội dung công tác</th><th>ĐVT</th><th>Khối lượng</th><th>Vật liệu</th><th>Nhân công</th><th>Máy</th><th>Thành tiền</th></tr></thead><tbody>' + rows + '</tbody></table><table class="sum" style="width:60%;margin-left:auto">' + sm + '</table>');
  }

  // =====================================================================================
  // TAB THANH TOÁN · QUYẾT TOÁN
  // =====================================================================================
  function setsOf(estId) { return TM.listColl('dtqtSettlements').filter(function (s) { return s.estimateId === estId; }).sort(function (a, b) { return n0(a.periodNo) - n0(b.periodNo) || String(a.date).localeCompare(String(b.date)); }); }
  function setData(rec) { var d = TM.unpackJson(rec, 'd', 4, null); return d && typeof d === 'object' ? { q: d.q || {}, ex: Array.isArray(d.ex) ? d.ex : [] } : { q: {}, ex: [] }; }
  function setDirectOf(est, d) { // chi phí trực tiếp (T) của 1 đợt với khối lượng d.q + phát sinh d.ex
    var P = est.params, T = 0; est.items.forEach(function (it) { if (it.t === 'g') return; T += n0(d.q[it.id]) * (n0(it.vl) + n0(it.nc) * P.knc + n0(it.may) * P.kmay); });
    d.ex.forEach(function (x) { T += n0(x.qty) * (n0(x.vl) + n0(x.nc) * P.knc + n0(x.may) * P.kmay); });
    return T;
  }
  function renderSet() {
    var root = $('esSet'), list = estList();
    if (!list.length) { root.innerHTML = '<div class="es-card"><div class="es-empty">Chưa có dự toán nào để thanh toán. Lập dự toán ở tab “Dự toán” trước (đơn giá của dự toán sẽ là đơn giá hợp đồng).</div></div>'; return; }
    if (!st.setEstId || !list.some(function (x) { return x.id === st.setEstId; })) st.setEstId = (st.est && st.est.id) || list[0].id;
    var estRec = list.filter(function (x) { return x.id === st.setEstId; })[0], est = loadEstRec(estRec), sets = setsOf(est.id);
    if (!st.setId || !sets.some(function (s) { return s.id === st.setId; })) st.setId = sets.length ? sets[sets.length - 1].id : '';
    var contract = calc(est).cost.total, doneVal = 0, paidSum = 0;
    sets.forEach(function (s) { var d = setData(s); doneVal += costOf(setDirectOf(est, d), est.params).total; paidSum += n0(s.paid); });
    var bar = '<div class="es-toolbar"><select class="es-select" id="stEst" style="min-width:280px">' + list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === est.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<div class="es-seg" style="margin:0" id="stView"><button data-v="period" class="' + (st.setView === 'period' ? 'on' : '') + '">Các đợt thanh toán</button><button data-v="final" class="' + (st.setView === 'final' ? 'on' : '') + '">Tổng hợp quyết toán</button></div><span class="es-spacer"></span><button class="es-btn es-btn-primary" id="stNew" type="button">+ Đợt thanh toán</button><button class="es-btn" id="stNewFinal" type="button">+ Biên bản quyết toán</button></div>';
    var kp = '<div class="es-kpis"><div class="es-kpi"><span>Giá trị hợp đồng / dự toán</span><b>' + fmt(contract) + '</b></div><div class="es-kpi"><span>Giá trị đã nghiệm thu (lũy kế)</span><b>' + fmt(doneVal) + '</b></div><div class="es-kpi"><span>% thực hiện</span><b>' + (contract ? (doneVal / contract * 100).toFixed(1) : '0') + '%</b></div><div class="es-kpi"><span>Đã thanh toán</span><b>' + fmt(paidSum) + '</b></div></div>';
    if (st.setView === 'final') { root.innerHTML = bar + kp + finalHtml(est, sets); bindSetTop(est); var fx = $('stFinalXls'); if (fx) fx.addEventListener('click', function () { exportFinalExcel(est, sets); }); var fp = $('stFinalPrint'); if (fp) fp.addEventListener('click', function () { printFinal(est, sets); }); return; }
    var chips = sets.length ? '<div class="es-toolbar">' + sets.map(function (s) { return '<button class="es-btn es-btn-sm' + (s.id === st.setId ? ' es-btn-primary' : '') + '" data-sid="' + s.id + '" type="button">' + esc(s.kind === 'Quyết toán' ? 'Quyết toán' : 'Đợt ' + s.periodNo) + ' · ' + esc(String(s.date || '').slice(0, 10)) + '</button>'; }).join('') + '</div>' : '<div class="es-card"><div class="es-empty">Chưa có đợt thanh toán nào cho dự toán này. Bấm <b>+ Đợt thanh toán</b>.</div></div>';
    root.innerHTML = bar + kp + chips + '<div id="stEditor"></div>';
    bindSetTop(est);
    var cur = sets.filter(function (s) { return s.id === st.setId; })[0];
    if (cur) renderSetEditor(est, sets, cur);
  }
  function bindSetTop(est) {
    var se = $('stEst'); if (se) se.addEventListener('change', function () { st.setEstId = se.value; st.setId = ''; renderSet(); });
    var sv = $('stView'); if (sv) sv.addEventListener('click', function (ev) { var b = ev.target.closest('[data-v]'); if (b) { st.setView = b.dataset.v; renderSet(); } });
    var nb = $('stNew'); if (nb) nb.addEventListener('click', function () { newSettlement(est, 'Thanh toán'); });
    var nf = $('stNewFinal'); if (nf) nf.addEventListener('click', function () { newSettlement(est, 'Quyết toán'); });
    document.querySelectorAll('[data-sid]').forEach(function (b) { b.addEventListener('click', function () { st.setId = b.dataset.sid; renderSet(); }); });
  }
  function newSettlement(est, kind) {
    var sets = setsOf(est.id), no = sets.reduce(function (m, s) { return Math.max(m, n0(s.periodNo)); }, 0) + 1;
    var rec = { estimateId: est.id, projectId: est.projectId, name: (kind === 'Quyết toán' ? 'Quyết toán — ' : 'Thanh toán đợt ' + no + ' — ') + est.name, kind: kind, periodNo: no, date: today(), status: 'Nháp', advance: 0, retentionPct: kind === 'Quyết toán' ? 0 : 5, total: 0, paid: 0, note: '' };
    Object.assign(rec, TM.packJson('d', { q: {}, ex: [] }, 4));
    var s = TM.saveColl('dtqtSettlements', rec, user()); if (s) { st.setId = s.id; renderSet(); }
  }
  function renderSetEditor(est, sets, cur) {
    var idx = sets.findIndex(function (s) { return s.id === cur.id; }), d = setData(cur), P = est.params;
    var prevQ = {}; sets.slice(0, idx).forEach(function (s) { var pd = setData(s); Object.keys(pd.q).forEach(function (k) { prevQ[k] = n0(prevQ[k]) + n0(pd.q[k]); }); });
    var rows = '', gi = 0, ii = 0, cum = 0;
    est.items.forEach(function (it) {
      if (it.t === 'g') { gi++; ii = 0; rows += '<tr class="grp"><td>' + String.fromCharCode(64 + ((gi - 1) % 26) + 1) + '</td><td colspan="10">' + esc(it.name) + '</td></tr>'; return; }
      ii++; var up = n0(it.vl) + n0(it.nc) * P.knc + n0(it.may) * P.kmay, q = d.q[it.id], pq = n0(prevQ[it.id]), cq = pq + n0(q), pctv = n0(it.qty) ? cq / n0(it.qty) * 100 : 0;
      rows += '<tr data-id="' + it.id + '"><td>' + ii + '</td><td>' + esc(it.code) + '</td><td>' + esc(it.name) + '</td><td>' + esc(it.unit) + '</td><td class="num">' + fmtQ(it.qty) + '</td><td class="num">' + fmt(up) + '</td><td class="num">' + (pq ? fmtQ(pq) : '') + '</td><td style="width:100px"><input class="num" data-q value="' + (q ? fmtQ(q) : '') + '" inputmode="decimal"></td><td class="num" data-cq>' + (cq ? fmtQ(cq) : '') + '</td><td class="num" data-pc style="' + (pctv > 100.0001 ? 'color:var(--es-bad)' : '') + '">' + (cq ? pctv.toFixed(1) + '%' : '') + '</td><td class="num" data-am>' + fmt(n0(q) * up) + '</td></tr>';
    });
    var ex = d.ex.map(function (x, i) { return '<tr class="ps" data-xi="' + i + '"><td>PS' + (i + 1) + '</td><td><input data-xf="code" value="' + esc(x.code || '') + '"></td><td><input data-xf="name" value="' + esc(x.name || '') + '"></td><td><input data-xf="unit" value="' + esc(x.unit || '') + '"></td><td></td><td class="num" data-xup>' + fmt(n0(x.vl) + n0(x.nc) * P.knc + n0(x.may) * P.kmay) + '</td><td colspan="2"><input class="num" data-xf="qty" value="' + (x.qty ? fmtQ(x.qty) : '') + '" placeholder="KL"></td><td colspan="2" style="min-width:210px"><div style="display:flex;gap:4px"><input class="num" data-xf="vl" value="' + (x.vl ? fmt(x.vl) : '') + '" placeholder="VL"><input class="num" data-xf="nc" value="' + (x.nc ? fmt(x.nc) : '') + '" placeholder="NC"><input class="num" data-xf="may" value="' + (x.may ? fmt(x.may) : '') + '" placeholder="Máy"></div></td><td class="num" data-xam>' + fmt(n0(x.qty) * (n0(x.vl) + n0(x.nc) * P.knc + n0(x.may) * P.kmay)) + ' <button class="es-x" data-xdel title="Xoá">×</button></td></tr>'; }).join('');
    var html = '<div class="es-card"><div class="es-toolbar"><h3 style="margin:0">' + esc(cur.kind === 'Quyết toán' ? 'Biên bản quyết toán' : 'Thanh toán đợt ' + cur.periodNo) + '</h3><span class="es-spacer"></span>' +
      '<label class="es-note">Điền nhanh theo % hoàn thành lũy kế:</label><input class="es-input" id="sFill" style="width:80px" placeholder="vd 40"><button class="es-btn es-btn-sm" id="sFillBtn" type="button">Áp dụng</button>' +
      '<button class="es-btn" id="sXls" type="button">Xuất Excel</button><button class="es-btn" id="sPrint" type="button">In / PDF</button><button class="es-btn es-btn-danger" id="sDel" type="button">Xoá</button></div>' +
      '<div class="es-grid4" style="margin-bottom:12px"><div style="grid-column:span 2"><label class="es-label">Tên</label><input class="es-input" id="sName" value="' + esc(cur.name) + '"></div><div><label class="es-label">Ngày</label><input type="date" class="es-input" id="sDate" value="' + esc(String(cur.date || '').slice(0, 10)) + '"></div><div><label class="es-label">Trạng thái</label><select class="es-select" id="sStatus">' + ['Nháp', 'Đã nghiệm thu', 'Đã đề nghị thanh toán', 'Đã thanh toán'].map(function (s) { return '<option' + (s === cur.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="es-tablewrap"><table class="es-table" style="min-width:1050px"><thead><tr><th>STT</th><th>Mã hiệu</th><th>Nội dung công việc</th><th>ĐVT</th><th class="num">KL hợp đồng</th><th class="num">Đơn giá</th><th class="num">KL lũy kế kỳ trước</th><th class="num">KL kỳ này</th><th class="num">KL lũy kế</th><th class="num">% HĐ</th><th class="num">Thành tiền kỳ này</th></tr></thead><tbody id="sRows">' + rows + (d.ex.length ? '<tr class="grp"><td colspan="11">Khối lượng phát sinh ngoài hợp đồng</td></tr>' + ex : '') + '</tbody></table></div>' +
      '<div class="es-toolbar" style="margin-top:10px"><button class="es-btn es-btn-sm" id="sAddEx" type="button">+ Phát sinh (nhập tay)</button><button class="es-btn es-btn-sm" id="sAddExLib" type="button">+ Phát sinh từ mã việc / DG-</button></div>' +
      '<h3 style="margin-top:14px">Giá trị thanh toán</h3><div id="sSum" class="es-sum"></div></div>';
    $('stEditor').innerHTML = html;
    var recalc = function () {
      var T = setDirectOf(est, d), k = costOf(T, P), adv = n0(cur.advance), ret = k.total * n0(cur.retentionPct) / 100, pay = k.total - adv - ret;
      $('sSum').innerHTML = '<span class="k">Chi phí trực tiếp kỳ này (T)</span><span></span><span class="v">' + fmt(T) + '</span>' +
        '<span class="k">Chi phí chung + thu nhập chịu thuế + chi phí khác</span><span></span><span class="v">' + fmt(k.cc + k.tl + k.other) + '</span>' +
        '<span class="k">Thuế GTGT (' + P.vat + '%)</span><span></span><span class="v">' + fmt(k.vat) + '</span>' +
        '<span class="k"><b>Giá trị nghiệm thu kỳ này (sau thuế' + (n0(P.prov) ? ' + dự phòng' : '') + ')</b></span><span></span><span class="v tot">' + fmt(k.total) + '</span>' +
        '<span class="k">Trừ thu hồi tạm ứng</span><span></span><span class="v"><input id="sAdv" value="' + (adv ? fmt(adv) : '') + '" inputmode="numeric"></span>' +
        '<span class="k">Giữ lại bảo hành (% × giá trị)</span><span><input id="sRet" value="' + String(cur.retentionPct || 0).replace('.', ',') + '" inputmode="decimal"></span><span class="v">' + fmt(ret) + '</span>' +
        '<span class="k"><b>Số tiền đề nghị thanh toán</b></span><span></span><span class="v tot">' + fmt(pay) + '</span>' +
        '<span class="k">Đã thanh toán thực tế</span><span></span><span class="v"><input id="sPaid" value="' + (n0(cur.paid) ? fmt(cur.paid) : '') + '" inputmode="numeric"></span>' +
        '<span class="k">Còn phải thanh toán</span><span></span><span class="v">' + fmt(pay - n0(cur.paid)) + '</span>';
      var save = function (ex2) { cur.total = Math.round(k.total); var pk = TM.packJson('d', d, 4); if (!pk) { alert('Dữ liệu quá lớn.'); return; } Object.assign(cur, pk, ex2 || {}); TM.saveColl('dtqtSettlements', Object.assign({ id: cur.id, name: cur.name, date: cur.date, status: cur.status, advance: cur.advance, retentionPct: cur.retentionPct, paid: cur.paid, total: cur.total }, pk), user()); };
      recalc.save = save;
      ['sAdv', 'sPaid'].forEach(function (id) { $(id).addEventListener('change', function () { cur[id === 'sAdv' ? 'advance' : 'paid'] = pnum($(id).value); save(); renderSetEditor(est, sets, cur); }); });
      $('sRet').addEventListener('change', function () { cur.retentionPct = pnum($('sRet').value); save(); renderSetEditor(est, sets, cur); });
    };
    recalc();
    var rowsEl = $('sRows');
    rowsEl.addEventListener('input', function (ev) {
      var inp = ev.target, tr = inp.closest('tr');
      if (inp.matches('[data-q]')) {
        var id = tr.dataset.id, v = pnum(inp.value); if (v) d.q[id] = v; else delete d.q[id];
        var it = est.items.filter(function (x) { return x.id === id; })[0], up = n0(it.vl) + n0(it.nc) * P.knc + n0(it.may) * P.kmay, cq = n0(prevQ[id]) + v;
        tr.querySelector('[data-cq]').textContent = cq ? fmtQ(cq) : ''; var pc = tr.querySelector('[data-pc]'); var pv = n0(it.qty) ? cq / n0(it.qty) * 100 : 0; pc.textContent = cq ? pv.toFixed(1) + '%' : ''; pc.style.color = pv > 100.0001 ? 'var(--es-bad)' : ''; tr.querySelector('[data-am]').textContent = fmt(v * up);
      } else if (inp.dataset.xf) {
        var x = d.ex[Number(tr.dataset.xi)], f = inp.dataset.xf; x[f] = (f === 'qty' || f === 'vl' || f === 'nc' || f === 'may') ? pnum(inp.value) : inp.value;
        tr.querySelector('[data-xup]').textContent = fmt(n0(x.vl) + n0(x.nc) * P.knc + n0(x.may) * P.kmay); tr.querySelector('[data-xam]').firstChild.textContent = fmt(n0(x.qty) * (n0(x.vl) + n0(x.nc) * P.knc + n0(x.may) * P.kmay)) + ' ';
      } else return;
      clearTimeout(recalc.t); recalc.t = setTimeout(function () { recalc(); recalc.save(); }, 700); var T = setDirectOf(est, d), kk = costOf(T, P); var sumEl = $('sSum'); if (sumEl) { var vs = sumEl.querySelectorAll('.v'); if (vs[0]) vs[0].textContent = fmt(T); if (vs[3]) vs[3].textContent = fmt(kk.total); }
    });
    rowsEl.addEventListener('click', function (ev) { var x = ev.target.closest('[data-xdel]'); if (!x) return; d.ex.splice(Number(x.closest('tr').dataset.xi), 1); recalc.save(); renderSetEditor(est, sets, cur); });
    $('sAddEx').addEventListener('click', function () { d.ex.push({ id: uid('x'), code: '', name: '', unit: '', qty: 0, vl: 0, nc: 0, may: 0 }); recalc.save(); renderSetEditor(est, sets, cur); });
    $('sAddExLib').addEventListener('click', function () { openPicker(function (en) { var p = priceFor(en, est.province, est.tier, est.priceMonth); d.ex.push({ id: uid('x'), code: en.code, name: en.name, unit: en.unit, qty: 0, vl: p.vl, nc: p.nc, may: p.may }); recalc.save(); }, { province: est.province, noRender: true }); var obs = setInterval(function () { if (!document.querySelector('.es-overlay')) { clearInterval(obs); renderSetEditor(est, sets, cur); } }, 400); });
    var bind = function (id, key) { $(id).addEventListener('change', function () { cur[key] = $(id).value; recalc.save(); }); };
    bind('sName', 'name'); bind('sDate', 'date'); bind('sStatus', 'status');
    $('sFillBtn').addEventListener('click', function () { var pc = pnum($('sFill').value); if (!pc) return; est.items.forEach(function (it) { if (it.t === 'g') return; var want = n0(it.qty) * pc / 100 - n0(prevQ[it.id]); if (want > 0) d.q[it.id] = Math.round(want * 1000) / 1000; else delete d.q[it.id]; }); recalc.save(); renderSetEditor(est, sets, cur); });
    $('sDel').addEventListener('click', function () { if (!confirm('Xoá ' + cur.name + '?')) return; TM.removeColl('dtqtSettlements', cur.id, user()); st.setId = ''; renderSet(); });
    $('sXls').addEventListener('click', function () { exportSetExcel(est, sets, cur, d, prevQ); });
    $('sPrint').addEventListener('click', function () { printSet(est, sets, cur, d, prevQ); });
  }
  function setLines(est, d, prevQ) {
    var P = est.params, out = [], gi = 0, ii = 0;
    est.items.forEach(function (it) { if (it.t === 'g') { gi++; ii = 0; out.push({ g: true, stt: String.fromCharCode(64 + ((gi - 1) % 26) + 1), name: it.name }); return; } ii++; var up = n0(it.vl) + n0(it.nc) * P.knc + n0(it.may) * P.kmay, q = n0(d.q[it.id]), pq = n0(prevQ[it.id]); out.push({ stt: ii, code: it.code, name: it.name, unit: it.unit, hd: n0(it.qty), up: up, pq: pq, q: q, cq: pq + q, am: q * up }); });
    d.ex.forEach(function (x, i) { var up = n0(x.vl) + n0(x.nc) * P.knc + n0(x.may) * P.kmay; out.push({ stt: 'PS' + (i + 1), code: x.code, name: x.name, unit: x.unit, hd: 0, up: up, pq: 0, q: n0(x.qty), cq: n0(x.qty), am: n0(x.qty) * up, ps: true }); });
    return out;
  }
  function exportSetExcel(est, sets, cur, d, prevQ) {
    if (typeof ExcelJS === 'undefined') { alert('Chưa tải xong bộ xuất Excel.'); return; }
    var P = est.params, lines = setLines(est, d, prevQ), k = costOf(setDirectOf(est, d), P), adv = n0(cur.advance), ret = k.total * n0(cur.retentionPct) / 100;
    var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Thanh toán'); ws.columns = [{ width: 6 }, { width: 13 }, { width: 50 }, { width: 8 }, { width: 13 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 16 }];
    ws.addRow([(cur.kind === 'Quyết toán' ? 'BẢNG GIÁ TRỊ QUYẾT TOÁN' : 'BẢNG GIÁ TRỊ KHỐI LƯỢNG HOÀN THÀNH — ĐỢT ' + cur.periodNo)]).font = { bold: true, size: 14 };
    ws.addRow(['Công trình: ' + est.name + (est.contractNo ? ' · HĐ số ' + est.contractNo : '')]); ws.addRow(['Ngày: ' + String(cur.date).slice(0, 10) + ' · Địa điểm: ' + est.province]); ws.addRow([]);
    var hr = ws.addRow(['STT', 'Mã hiệu', 'Nội dung công việc', 'ĐVT', 'KL hợp đồng', 'Đơn giá', 'KL kỳ trước', 'KL kỳ này', 'KL lũy kế', 'Thành tiền kỳ này']); hr.font = { bold: true }; hr.eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6D6' } }; });
    lines.forEach(function (l) { var r = l.g ? ws.addRow([l.stt, '', l.name]) : ws.addRow([l.stt, l.code, l.name, l.unit, l.hd, l.up, l.pq, l.q, l.cq, l.am]); if (l.g) r.font = { bold: true }; [5, 7, 8, 9].forEach(function (i) { r.getCell(i).numFmt = '#,##0.###'; }); [6, 10].forEach(function (i) { r.getCell(i).numFmt = '#,##0'; }); });
    ws.addRow([]);
    [['Chi phí trực tiếp (T)', k.T], ['Chi phí chung + thu nhập chịu thuế + chi phí khác', k.cc + k.tl + k.other], ['Thuế GTGT (' + P.vat + '%)', k.vat], ['Giá trị nghiệm thu kỳ này', k.total], ['Trừ thu hồi tạm ứng', adv], ['Giữ lại bảo hành (' + n0(cur.retentionPct) + '%)', ret], ['SỐ TIỀN ĐỀ NGHỊ THANH TOÁN', k.total - adv - ret]].forEach(function (s) { var r = ws.addRow(['', '', s[0], '', '', '', '', '', '', s[1]]); r.getCell(10).numFmt = '#,##0'; if (/^(Giá trị|SỐ TIỀN)/.test(s[0])) r.font = { bold: true }; });
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    if (typeof HiconiqueExcel !== 'undefined' && HiconiqueExcel.standardize) { try { HiconiqueExcel.standardize(wb); } catch (er) { } }
    wb.xlsx.writeBuffer().then(function (buf) { download('thanh-toan-' + plain(est.name) + '-dot-' + cur.periodNo + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); });
  }
  function printSet(est, sets, cur, d, prevQ) {
    var P = est.params, lines = setLines(est, d, prevQ), k = costOf(setDirectOf(est, d), P), adv = n0(cur.advance), ret = k.total * n0(cur.retentionPct) / 100;
    var rows = lines.map(function (l) { return l.g ? '<tr class="g"><td>' + l.stt + '</td><td colspan="9">' + esc(l.name) + '</td></tr>' : '<tr><td>' + l.stt + '</td><td>' + esc(l.code) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.unit) + '</td><td class="n">' + fmtQ(l.hd) + '</td><td class="n">' + fmt(l.up) + '</td><td class="n">' + fmtQ(l.pq) + '</td><td class="n">' + fmtQ(l.q) + '</td><td class="n">' + fmtQ(l.cq) + '</td><td class="n">' + fmt(l.am) + '</td></tr>'; }).join('');
    var sm = [['Chi phí trực tiếp (T)', k.T], ['Chi phí chung + thu nhập chịu thuế + khác', k.cc + k.tl + k.other], ['Thuế GTGT (' + P.vat + '%)', k.vat], ['Giá trị nghiệm thu kỳ này', k.total], ['Trừ thu hồi tạm ứng', adv], ['Giữ lại bảo hành (' + n0(cur.retentionPct) + '%)', ret], ['SỐ TIỀN ĐỀ NGHỊ THANH TOÁN', k.total - adv - ret]].map(function (s) { return '<tr class="sum"><td></td><td style="text-align:right">' + s[0] + '</td><td class="n"><b>' + fmt(s[1]) + '</b></td></tr>'; }).join('');
    printHtml(cur.name, '<h1>' + (cur.kind === 'Quyết toán' ? 'BẢNG GIÁ TRỊ QUYẾT TOÁN' : 'BẢNG GIÁ TRỊ KHỐI LƯỢNG HOÀN THÀNH — ĐỢT ' + cur.periodNo) + '</h1><p><b>Công trình:</b> ' + esc(est.name) + (est.contractNo ? ' · <b>Hợp đồng số:</b> ' + esc(est.contractNo) : '') + '</p><p><b>Ngày:</b> ' + esc(String(cur.date).slice(0, 10)) + ' · <b>Địa điểm:</b> ' + esc(est.province) + '</p><table><thead><tr><th>STT</th><th>Mã hiệu</th><th>Nội dung công việc</th><th>ĐVT</th><th>KL hợp đồng</th><th>Đơn giá</th><th>KL kỳ trước</th><th>KL kỳ này</th><th>KL lũy kế</th><th>Thành tiền kỳ này</th></tr></thead><tbody>' + rows + '</tbody></table><table class="sum" style="width:60%;margin-left:auto">' + sm + '</table><table class="sum" style="margin-top:30px"><tr><td style="text-align:center"><b>ĐẠI DIỆN BÊN NHẬN THẦU</b><br><i>(Ký, ghi rõ họ tên)</i></td><td style="text-align:center"><b>ĐẠI DIỆN BÊN GIAO THẦU</b><br><i>(Ký, ghi rõ họ tên)</i></td></tr></table>');
  }
  // Tổng hợp quyết toán: lũy kế mọi đợt so với dự toán
  function finalCalc(est, sets) {
    var P = est.params, acc = { q: {}, ex: [] }, tot = {};
    sets.forEach(function (s) { var d = setData(s); Object.keys(d.q).forEach(function (k) { acc.q[k] = n0(acc.q[k]) + n0(d.q[k]); }); d.ex.forEach(function (x) { acc.ex.push(x); }); });
    var lines = [], gi = 0, ii = 0, hdTot = 0, qtTot = 0;
    est.items.forEach(function (it) { if (it.t === 'g') { gi++; ii = 0; lines.push({ g: true, stt: String.fromCharCode(64 + ((gi - 1) % 26) + 1), name: it.name }); return; } ii++; var up = n0(it.vl) + n0(it.nc) * P.knc + n0(it.may) * P.kmay, q = n0(acc.q[it.id]); lines.push({ stt: ii, code: it.code, name: it.name, unit: it.unit, up: up, hd: n0(it.qty), qt: q, hdAm: n0(it.qty) * up, qtAm: q * up }); hdTot += n0(it.qty) * up; qtTot += q * up; });
    acc.ex.forEach(function (x, i) { var up = n0(x.vl) + n0(x.nc) * P.knc + n0(x.may) * P.kmay; lines.push({ stt: 'PS' + (i + 1), code: x.code, name: x.name, unit: x.unit, up: up, hd: 0, qt: n0(x.qty), hdAm: 0, qtAm: n0(x.qty) * up, ps: true }); qtTot += n0(x.qty) * up; });
    var paid = sets.reduce(function (s, x) { return s + n0(x.paid); }, 0), adv = sets.reduce(function (s, x) { return s + n0(x.advance); }, 0), ret = sets.reduce(function (s, x) { return s + costOf(setDirectOf(est, setData(x)), P).total * n0(x.retentionPct) / 100; }, 0);
    return { lines: lines, hd: costOf(hdTot, P), qt: costOf(qtTot, P), paid: paid, adv: adv, ret: ret };
  }
  function finalHtml(est, sets) {
    if (!sets.length) return '<div class="es-card"><div class="es-empty">Chưa có đợt thanh toán nào để tổng hợp.</div></div>';
    var f = finalCalc(est, sets);
    var rows = f.lines.map(function (l) { if (l.g) return '<tr class="grp"><td>' + l.stt + '</td><td colspan="9">' + esc(l.name) + '</td></tr>'; var diff = l.qt - l.hd; return '<tr' + (l.ps ? ' class="ps"' : '') + '><td>' + l.stt + '</td><td>' + esc(l.code) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.unit) + '</td><td class="num">' + fmtQ(l.hd) + '</td><td class="num">' + fmtQ(l.qt) + '</td><td class="num" style="color:' + (diff > 0.0005 ? 'var(--es-warn)' : diff < -0.0005 ? 'var(--es-ok)' : 'inherit') + '">' + (Math.abs(diff) > 0.0005 ? (diff > 0 ? '+' : '') + fmtQ(diff) : '') + '</td><td class="num">' + fmt(l.up) + '</td><td class="num">' + fmt(l.hdAm) + '</td><td class="num">' + fmt(l.qtAm) + '</td></tr>'; }).join('');
    var dif = f.qt.total - f.hd.total;
    return '<div class="es-card"><div class="es-toolbar"><h3 style="margin:0">Tổng hợp quyết toán <small>· cộng dồn ' + sets.length + ' đợt, so với dự toán</small></h3><span class="es-spacer"></span><button class="es-btn" id="stFinalXls" type="button">Xuất Excel</button><button class="es-btn" id="stFinalPrint" type="button">In / PDF</button></div>' +
      '<div class="es-tablewrap"><table class="es-table" style="min-width:1000px"><thead><tr><th>STT</th><th>Mã hiệu</th><th>Nội dung</th><th>ĐVT</th><th class="num">KL dự toán</th><th class="num">KL quyết toán</th><th class="num">Chênh lệch KL</th><th class="num">Đơn giá</th><th class="num">Giá trị dự toán (trực tiếp)</th><th class="num">Giá trị quyết toán (trực tiếp)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="es-sum" style="margin-top:14px"><span class="k">Giá trị dự toán (tổng sau thuế)</span><span></span><span class="v">' + fmt(f.hd.total) + '</span><span class="k"><b>Giá trị quyết toán (tổng sau thuế)</b></span><span></span><span class="v tot">' + fmt(f.qt.total) + '</span><span class="k">Chênh lệch quyết toán − dự toán</span><span></span><span class="v" style="color:' + (dif > 0 ? 'var(--es-warn)' : 'var(--es-ok)') + '">' + (dif > 0 ? '+' : '') + fmt(dif) + '</span><span class="k">Trừ tạm ứng đã thu hồi</span><span></span><span class="v">' + fmt(f.adv) + '</span><span class="k">Giữ lại bảo hành</span><span></span><span class="v">' + fmt(f.ret) + '</span><span class="k">Đã thanh toán</span><span></span><span class="v">' + fmt(f.paid) + '</span><span class="k"><b>Còn phải thanh toán</b></span><span></span><span class="v tot">' + fmt(f.qt.total - f.adv - f.ret - f.paid) + '</span></div></div>';
  }
  function exportFinalExcel(est, sets) {
    if (typeof ExcelJS === 'undefined') { alert('Chưa tải xong bộ xuất Excel.'); return; }
    var f = finalCalc(est, sets), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Quyết toán'); ws.columns = [{ width: 6 }, { width: 13 }, { width: 50 }, { width: 8 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 16 }, { width: 16 }];
    ws.addRow(['BẢNG TỔNG HỢP QUYẾT TOÁN']).font = { bold: true, size: 14 }; ws.addRow(['Công trình: ' + est.name + (est.contractNo ? ' · HĐ số ' + est.contractNo : '')]); ws.addRow([]);
    var hr = ws.addRow(['STT', 'Mã hiệu', 'Nội dung', 'ĐVT', 'KL dự toán', 'KL quyết toán', 'Chênh lệch', 'Đơn giá', 'GT dự toán', 'GT quyết toán']); hr.font = { bold: true };
    f.lines.forEach(function (l) { var r = l.g ? ws.addRow([l.stt, '', l.name]) : ws.addRow([l.stt, l.code, l.name, l.unit, l.hd, l.qt, l.qt - l.hd, l.up, l.hdAm, l.qtAm]); if (l.g) r.font = { bold: true }; [5, 6, 7].forEach(function (i) { r.getCell(i).numFmt = '#,##0.###'; }); [8, 9, 10].forEach(function (i) { r.getCell(i).numFmt = '#,##0'; }); });
    ws.addRow([]);
    [['Giá trị dự toán (sau thuế)', f.hd.total], ['Giá trị quyết toán (sau thuế)', f.qt.total], ['Chênh lệch', f.qt.total - f.hd.total], ['Trừ tạm ứng', f.adv], ['Giữ lại bảo hành', f.ret], ['Đã thanh toán', f.paid], ['CÒN PHẢI THANH TOÁN', f.qt.total - f.adv - f.ret - f.paid]].forEach(function (s) { var r = ws.addRow(['', '', s[0], '', '', '', '', '', '', s[1]]); r.getCell(10).numFmt = '#,##0'; if (/^(Giá trị quyết|CÒN)/.test(s[0])) r.font = { bold: true }; });
    if (typeof HiconiqueExcel !== 'undefined' && HiconiqueExcel.standardize) { try { HiconiqueExcel.standardize(wb); } catch (er) { } }
    wb.xlsx.writeBuffer().then(function (buf) { download('quyet-toan-' + plain(est.name) + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); });
  }
  function printFinal(est, sets) {
    var f = finalCalc(est, sets);
    var rows = f.lines.map(function (l) { return l.g ? '<tr class="g"><td>' + l.stt + '</td><td colspan="9">' + esc(l.name) + '</td></tr>' : '<tr><td>' + l.stt + '</td><td>' + esc(l.code) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.unit) + '</td><td class="n">' + fmtQ(l.hd) + '</td><td class="n">' + fmtQ(l.qt) + '</td><td class="n">' + fmtQ(l.qt - l.hd) + '</td><td class="n">' + fmt(l.up) + '</td><td class="n">' + fmt(l.hdAm) + '</td><td class="n">' + fmt(l.qtAm) + '</td></tr>'; }).join('');
    var sm = [['Giá trị dự toán (sau thuế)', f.hd.total], ['Giá trị quyết toán (sau thuế)', f.qt.total], ['Chênh lệch', f.qt.total - f.hd.total], ['Trừ tạm ứng', f.adv], ['Giữ lại bảo hành', f.ret], ['Đã thanh toán', f.paid], ['CÒN PHẢI THANH TOÁN', f.qt.total - f.adv - f.ret - f.paid]].map(function (s) { return '<tr class="sum"><td></td><td style="text-align:right">' + s[0] + '</td><td class="n"><b>' + fmt(s[1]) + '</b></td></tr>'; }).join('');
    printHtml('Quyết toán ' + est.name, '<h1>BẢNG TỔNG HỢP QUYẾT TOÁN</h1><p><b>Công trình:</b> ' + esc(est.name) + (est.contractNo ? ' · <b>Hợp đồng số:</b> ' + esc(est.contractNo) : '') + '</p><table><thead><tr><th>STT</th><th>Mã hiệu</th><th>Nội dung</th><th>ĐVT</th><th>KL dự toán</th><th>KL quyết toán</th><th>Chênh lệch</th><th>Đơn giá</th><th>GT dự toán</th><th>GT quyết toán</th></tr></thead><tbody>' + rows + '</tbody></table><table class="sum" style="width:60%;margin-left:auto">' + sm + '</table>');
  }

  // =====================================================================================
  // TAB THƯ VIỆN MÃ CÔNG VIỆC & ĐƠN GIÁ TỈNH
  // =====================================================================================
  function renderLib() {
    var root = $('esLib');
    var seg = '<div class="es-seg" id="lbTabs" style="margin-top:0"><button data-l="codes" class="' + (st.libTab === 'codes' ? 'on' : '') + '">Mã công việc (thư viện DTQT)</button><button data-l="prices" class="' + (st.libTab === 'prices' ? 'on' : '') + '">Cập nhật đơn giá theo tỉnh · kỳ giá</button><button data-l="import" class="' + (st.libTab === 'import' ? 'on' : '') + '">Nhập từ Excel / CSV</button></div>';
    root.innerHTML = seg + '<div id="lbBody"></div>';
    $('lbTabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-l]'); if (b) { st.libTab = b.dataset.l; renderLib(); } });
    if (st.libTab === 'codes') libCodesView(); else if (st.libTab === 'prices') libPricesView(); else libImportView();
  }
  function parseRes(txt) { return String(txt || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { var c = l.split(/[;\t]/).map(function (x) { return x.trim(); }); return { t: (c[0] || 'VL').toUpperCase(), code: c[1] || '', name: c[2] || c[1] || '', unit: c[3] || '', qty: pnum(c[4]), price: pnum(c[5]) }; }).filter(function (r) { return r.name; }); }
  function resText(rec) { return libResources(rec).map(function (r) { return [r.t, r.code, r.name, r.unit, String(r.qty).replace('.', ','), r.price || ''].join(';'); }).join('\n'); }
  function libCodesView() {
    var body = $('lbBody'), q = st.libQ || '';
    var all = TM.listColl('dtqtCodes').sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    body.innerHTML = '<div class="es-card"><div class="es-toolbar"><h3 style="margin:0">Thư viện mã công việc <small>· ' + all.length + ' mã · sheet DTQT-Mã công việc</small></h3><span class="es-spacer"></span><input class="es-input" id="lcQ" placeholder="Tìm mã / tên…" value="' + esc(q) + '" style="width:240px"><button class="es-btn es-btn-primary" id="lcAdd" type="button">+ Thêm mã công việc</button></div>' +
      '<p class="es-note" style="margin:0 0 10px">Mã trong thư viện dùng được ở mọi dự toán, bên cạnh bảng giá <b>DG-</b> (công tác hoàn chỉnh, vật tư, nhân công khoán — đọc trực tiếp theo tỉnh, không sao chép, không sửa). Mỗi mã có thể có <b>đơn giá gốc</b> hoặc <b>định mức hao phí</b> (vật liệu / nhân công / máy × đơn giá hao phí của từng tỉnh, khai ở tab “Cập nhật đơn giá”). Muốn nạp hàng loạt định mức/đơn giá lấy từ phần mềm khác (Excel) → tab “Nhập từ Excel / CSV”.</p>' +
      '<div class="es-tablewrap"><table class="es-table" style="min-width:900px"><thead><tr><th style="width:110px">Mã hiệu</th><th>Tên công tác</th><th style="width:70px">ĐVT</th><th>Nhóm</th><th class="num">VL</th><th class="num">NC</th><th class="num">Máy</th><th>Định mức</th><th style="width:100px"></th></tr></thead><tbody id="lcRows"></tbody></table></div></div>';
    function draw() {
      var qq = norm($('lcQ').value); st.libQ = $('lcQ').value;
      var l = all.filter(function (c) { return !qq || norm(c.code + ' ' + c.name + ' ' + (c.group || '')).indexOf(qq) !== -1; });
      $('lcRows').innerHTML = l.length ? l.slice(0, 300).map(function (c) { var nr = libResources(c).length; return '<tr' + (c.active === false || String(c.active).toLowerCase() === 'false' ? ' style="opacity:.5"' : '') + '><td style="font-family:JetBrains Mono,monospace;font-size:.75rem">' + esc(c.code) + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.unit) + '</td><td>' + esc(c.group || '') + '</td><td class="num">' + (n0(c.vl) ? fmt(c.vl) : '') + '</td><td class="num">' + (n0(c.nc) ? fmt(c.nc) : '') + '</td><td class="num">' + (n0(c.may) ? fmt(c.may) : '') + '</td><td>' + (nr ? '<span class="es-chip ok">' + nr + ' hao phí</span>' : '') + '</td><td><button class="es-btn es-btn-sm" data-ed="' + c.id + '">Sửa</button></td></tr>'; }).join('') : '<tr><td colspan="9" class="es-empty">Chưa có mã nào' + (qq ? ' khớp từ khoá' : '') + '. Bấm “+ Thêm mã công việc” hoặc nhập từ Excel.</td></tr>';
    }
    draw(); $('lcQ').addEventListener('input', draw);
    $('lcAdd').addEventListener('click', function () { codeForm(null); });
    $('lcRows').addEventListener('click', function (ev) { var b = ev.target.closest('[data-ed]'); if (b) codeForm(all.filter(function (c) { return c.id === b.dataset.ed; })[0]); });
  }
  function codeForm(rec) {
    rec = rec || {};
    var ov = modal(rec.id ? 'Sửa mã công việc' : 'Thêm mã công việc', '<div class="es-grid3"><div><label class="es-label">Mã hiệu *</label><input class="es-input" id="cfCode" value="' + esc(rec.code || '') + '" placeholder="VD: AF.11110"></div><div style="grid-column:span 2"><label class="es-label">Tên công tác *</label><input class="es-input" id="cfName" value="' + esc(rec.name || '') + '"></div><div><label class="es-label">ĐVT</label><input class="es-input" id="cfUnit" value="' + esc(rec.unit || '') + '"></div><div><label class="es-label">Nhóm</label><input class="es-input" id="cfGroup" value="' + esc(rec.group || '') + '" placeholder="Bê tông, Cốt thép, Xây, Trát…"></div><div><label class="es-label">Căn cứ định mức</label><input class="es-input" id="cfSrc" value="' + esc(rec.normSource || '') + '" placeholder="VD: ĐM 1776/BXD-VP; TT 12/2021"></div>' +
      '<div><label class="es-label">Đơn giá gốc — Vật liệu</label><input class="es-input" id="cfVl" value="' + esc(rec.vl || '') + '" inputmode="numeric"></div><div><label class="es-label">Nhân công</label><input class="es-input" id="cfNc" value="' + esc(rec.nc || '') + '" inputmode="numeric"></div><div><label class="es-label">Máy thi công</label><input class="es-input" id="cfMay" value="' + esc(rec.may || '') + '" inputmode="numeric"></div></div>' +
      '<label class="es-label" style="margin-top:12px">Định mức hao phí (tuỳ chọn — nếu có thì đơn giá = Σ định mức × đơn giá hao phí của tỉnh, bỏ qua đơn giá gốc)</label><textarea class="es-textarea" id="cfRes" placeholder="Mỗi dòng: Loại(VL/NC/M);Mã;Tên hao phí;ĐVT;Định mức;Đơn giá mặc định&#10;VL;XM-PC40;Xi măng PC40;kg;320;1450&#10;NC;NC-3.5;Nhân công bậc 3,5/7;công;1,85;300000&#10;M;MAY-TRON;Máy trộn 250l;ca;0,095;350000">' + esc(resText(rec)) + '</textarea>' +
      '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:16px"><div>' + (rec.id ? '<button class="es-btn es-btn-danger" id="cfDel" type="button">Xoá mã</button>' : '') + '</div><div style="display:flex;gap:10px"><label class="es-note" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="cfAct" ' + (rec.active === false || String(rec.active).toLowerCase() === 'false' ? '' : 'checked') + '> Còn dùng</label><button class="es-btn" data-x2 type="button">Huỷ</button><button class="es-btn es-btn-primary" id="cfOk" type="button">Lưu</button></div></div>', 820);
    ov.querySelector('[data-x2]').addEventListener('click', ov.close);
    var del = ov.querySelector('#cfDel'); if (del) del.addEventListener('click', function () { if (confirm('Xoá mã ' + rec.code + '?')) { TM.removeColl('dtqtCodes', rec.id, user()); ov.close(); renderLib(); } });
    ov.querySelector('#cfOk').addEventListener('click', function () {
      var g = function (id) { return ov.querySelector('#' + id).value.trim(); }, code = g('cfCode'), name = g('cfName');
      if (!code || !name) { alert('Nhập mã hiệu và tên công tác.'); return; }
      if (!rec.id && libCodes().some(function (c) { return c.code === code; })) { alert('Mã ' + code + ' đã có trong thư viện.'); return; }
      var res = parseRes(ov.querySelector('#cfRes').value), pk = TM.packJson('res', res, 2);
      var data = Object.assign({ id: rec.id || undefined, code: code, name: name, unit: g('cfUnit'), group: g('cfGroup'), normSource: g('cfSrc'), vl: pnum(g('cfVl')), nc: pnum(g('cfNc')), may: pnum(g('cfMay')), active: ov.querySelector('#cfAct').checked, note: rec.note || '' }, pk || {});
      if (!rec.id) delete data.id; TM.saveColl('dtqtCodes', data, user()); ov.close(); renderLib(); toast('Đã lưu mã ' + code);
    });
  }
  function libPricesView() {
    var body = $('lbBody'), prov = st.libProv || (st.est && st.est.province) || 'Hải Phòng', month = st.libMonth || thisMonth();
    body.innerHTML = '<div class="es-card"><h3>Cập nhật đơn giá theo tỉnh / kỳ giá <small>· ghi vào sheet DTQT-Đơn giá tỉnh, KHÔNG đụng DG-</small></h3><div class="es-toolbar"><select class="es-select" id="lpProv">' + provOptions(prov) + '</select><input class="es-input" type="month" id="lpMonth" value="' + esc(month) + '" title="Kỳ giá (tháng áp dụng)"><input class="es-input" id="lpQ" placeholder="Tìm mã / tên công tác…" style="flex:1 1 220px"><select class="es-select" id="lpSrc"><option value="all">Tất cả nguồn</option><option value="lib">Thư viện DTQT</option><option value="ct">DG — công tác</option><option value="vt">DG — vật tư</option></select><span class="es-spacer"></span><input class="es-input" id="lpSrcTxt" placeholder="Nguồn / văn bản công bố giá" style="width:230px"><button class="es-btn es-btn-primary" id="lpSave" type="button">Lưu các dòng đã sửa</button></div>' +
      '<p class="es-note" style="margin:0 0 10px">Cột “Giá DG- (TB)” là giá hiện có của tỉnh trong bảng DG-. Nhập VL / NC / Máy vào ô bên phải nếu muốn dùng <b>đơn giá riêng của tỉnh trong kỳ giá này</b> (VD: giá công bố hàng tháng của Sở Xây dựng, báo giá nhà cung cấp). Dự toán lập sau sẽ tự lấy đơn giá mới nhất có kỳ ≤ kỳ giá của dự toán. Hiện tối đa 200 dòng — dùng ô tìm để thu hẹp.</p>' +
      '<div class="es-tablewrap"><table class="es-table" style="min-width:1050px"><thead><tr><th style="width:90px">Mã</th><th>Tên công tác / vật tư</th><th style="width:60px">ĐVT</th><th class="num">Giá DG- (TB) VL</th><th class="num">NC</th><th class="num" style="width:120px">Đơn giá tỉnh VL</th><th class="num" style="width:120px">NC</th><th class="num" style="width:110px">Máy</th><th style="width:96px">Kỳ đang dùng</th></tr></thead><tbody id="lpRows"><tr><td colspan="9" class="es-empty">Đang tải…</td></tr></tbody></table></div></div>';
    var shown = [];
    function draw() {
      prov = $('lpProv').value; month = $('lpMonth').value; st.libProv = prov; st.libMonth = month;
      var q = norm($('lpQ').value), src = $('lpSrc').value;
      shown = catalog(prov).filter(function (x) { return x.src !== 'nc' && (src === 'all' || x.src === src) && (!q || norm(x.code + ' ' + x.name).indexOf(q) !== -1); }).slice(0, 200);
      $('lpRows').innerHTML = shown.length ? shown.map(function (x, i) { var base = x.src === 'lib' ? libPrice(x.rec, prov, month) : dgTier(x, 'mid'), ov = findOv(x.code, prov, month); return '<tr data-i="' + i + '"><td style="font-family:JetBrains Mono,monospace;font-size:.75rem">' + esc(x.code) + '</td><td>' + esc(x.name) + '<div style="font-size:.6875rem;color:var(--es-muted)">' + SRC_LABEL[x.src] + '</div></td><td>' + esc(x.unit) + '</td><td class="num">' + fmt(base.vl) + '</td><td class="num">' + fmt(base.nc) + '</td><td><input class="num" data-k="vl" value="' + (ov ? fmt(ov.vl) : '') + '" inputmode="numeric"></td><td><input class="num" data-k="nc" value="' + (ov ? fmt(ov.nc) : '') + '" inputmode="numeric"></td><td><input class="num" data-k="may" value="' + (ov && n0(ov.may) ? fmt(ov.may) : '') + '" inputmode="numeric"></td><td>' + (ov ? '<span class="es-chip ok">' + esc(ov.month || 'không kỳ') + '</span>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="9" class="es-empty">Không có dòng nào.</td></tr>';
    }
    dgLoad(prov).then(draw);
    $('lpProv').addEventListener('change', function () { $('lpRows').innerHTML = '<tr><td colspan="9" class="es-empty">Đang tải…</td></tr>'; dgLoad($('lpProv').value).then(draw); });
    ['lpMonth', 'lpSrc'].forEach(function (id) { $(id).addEventListener('change', draw); }); $('lpQ').addEventListener('input', draw);
    $('lpRows').addEventListener('input', function (ev) { if (ev.target.dataset.k) ev.target.closest('tr').dataset.dirty = '1'; });
    $('lpRows').addEventListener('blur', function (ev) { var i = ev.target; if (i.dataset && i.dataset.k) i.value = pnum(i.value) ? fmt(pnum(i.value)) : ''; }, true);
    $('lpSave').addEventListener('click', function () {
      var rows = $('lpRows').querySelectorAll('tr[data-dirty="1"]'), n = 0, src = $('lpSrcTxt').value.trim(), adds = [];
      rows.forEach(function (tr) {
        var x = shown[Number(tr.dataset.i)], g = function (k) { return pnum(tr.querySelector('[data-k="' + k + '"]').value); }, vl = g('vl'), nc = g('nc'), may = g('may');
        if (!x || (!vl && !nc && !may)) return;
        var ex = priceRows().filter(function (p) { return p.kind === 'work' && String(p.key) === String(x.code) && p.province === prov && (p.month || '') === month; })[0];
        var data = { kind: 'work', key: x.code, name: x.name, unit: x.unit, province: prov, vl: vl, nc: nc, may: may, month: month, source: src || (ex && ex.source) || '' };
        if (ex) TM.saveColl('dtqtPrices', Object.assign({ id: ex.id }, data), user()); else adds.push(data); n++;
      });
      if (adds.length) TM.addCollBatch('dtqtPrices', adds, user());
      toast(n ? 'Đã lưu ' + n + ' đơn giá tỉnh ' + prov + ' · kỳ ' + month : 'Chưa có dòng nào được sửa'); if (n) draw();
    });
  }
  function readTable(file, cb) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx') {
      if (typeof ExcelJS === 'undefined') { alert('Chưa tải xong bộ đọc Excel. Thử lại sau vài giây.'); return; }
      var fr = new FileReader(); fr.onload = function () { var wb = new ExcelJS.Workbook(); wb.xlsx.load(fr.result).then(function () { var ws = wb.worksheets[0], rows = []; ws.eachRow({ includeEmpty: false }, function (row) { var a = []; for (var i = 1; i <= row.cellCount; i++) { var v = row.getCell(i).value; if (v && typeof v === 'object') v = v.result != null ? v.result : v.text != null ? v.text : (v.richText ? v.richText.map(function (r) { return r.text; }).join('') : ''); a.push(v == null ? '' : String(v)); } rows.push(a); }); cb(rows); }).catch(function () { alert('Không đọc được file Excel.'); }); }; fr.readAsArrayBuffer(file);
    } else { var fr2 = new FileReader(); fr2.onload = function () { cb(textRows(String(fr2.result))); }; fr2.readAsText(file, 'utf-8'); }
  }
  function textRows(txt) { return txt.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) { return (l.indexOf('\t') !== -1 ? l.split('\t') : l.indexOf(';') !== -1 ? l.split(';') : l.split(',')).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); }); }
  function libImportView() {
    var body = $('lbBody'), rows = [];
    body.innerHTML = '<div class="es-card"><h3>Nhập mã công việc / đơn giá từ Excel hoặc CSV <small>· ví dụ file định mức, đơn giá xuất từ phần mềm dự toán khác</small></h3>' +
      '<div class="es-grid2"><div><label class="es-label">Loại dữ liệu</label><select class="es-select" id="imType"><option value="codes">Mã công việc → DTQT-Mã công việc</option><option value="prices">Đơn giá theo tỉnh → DTQT-Đơn giá tỉnh</option></select></div><div><label class="es-label">File .xlsx / .csv / .txt (hoặc dán bên dưới)</label><input type="file" id="imFile" accept=".xlsx,.csv,.txt,.tsv" class="es-input" style="padding-top:7px"></div></div>' +
      '<p class="es-note" id="imHelp" style="margin:10px 0"></p><textarea class="es-textarea" id="imTxt" style="min-height:160px" placeholder="Dán nội dung copy từ Excel vào đây (các cột cách nhau bằng Tab)…"></textarea>' +
      '<div class="es-toolbar" style="margin-top:12px"><button class="es-btn" id="imPrev" type="button">Xem trước</button><span class="es-spacer"></span><span class="es-note" id="imInfo"></span><button class="es-btn es-btn-primary" id="imGo" type="button" disabled>Nhập vào Sheet</button></div><div id="imPreview"></div></div>';
    var help = { codes: 'Cột theo thứ tự: <b>Mã hiệu · Tên công tác · ĐVT · Nhóm · Vật liệu · Nhân công · Máy · Căn cứ định mức</b>. Dòng tiêu đề (nếu có) tự bỏ qua. Mã đã có trong thư viện sẽ bị bỏ qua (không ghi đè).', prices: 'Cột theo thứ tự: <b>Mã hiệu · Tỉnh/Thành · Vật liệu · Nhân công · Máy · Kỳ giá (YYYY-MM) · Nguồn</b>. Mỗi dòng là 1 đơn giá riêng của tỉnh đó cho mã đó trong kỳ đó.' };
    function setHelp() { $('imHelp').innerHTML = help[$('imType').value]; } setHelp(); $('imType').addEventListener('change', function () { setHelp(); rows = []; $('imPreview').innerHTML = ''; $('imGo').disabled = true; });
    function parse(list) {
      var type = $('imType').value, out = [];
      list.forEach(function (c) {
        if (!c.length || !String(c[0]).trim()) return;
        if (type === 'codes') { if (!String(c[1] || '').trim()) return; var isHead = /m[aã] hi[eệ]u|^m[aã]$/i.test(c[0]) && isNaN(pnum(c[4])); if (isHead) return; out.push({ code: String(c[0]).trim(), name: String(c[1]).trim(), unit: c[2] || '', group: c[3] || '', vl: pnum(c[4]), nc: pnum(c[5]), may: pnum(c[6]), normSource: c[7] || '', active: true }); }
        else { if (/m[aã] hi[eệ]u|^m[aã]$/i.test(c[0])) return; var pv = String(c[1] || '').trim(); if (!pv) return; out.push({ kind: 'work', key: String(c[0]).trim(), province: pv, vl: pnum(c[2]), nc: pnum(c[3]), may: pnum(c[4]), month: (c[5] || thisMonth()).trim().slice(0, 7), source: c[6] || 'Nhập từ Excel' }); }
      });
      return out;
    }
    function prev(list) {
      rows = parse(list); $('imInfo').textContent = rows.length + ' dòng hợp lệ'; $('imGo').disabled = !rows.length;
      $('imPreview').innerHTML = rows.length ? '<div class="es-tablewrap" style="margin-top:10px;max-height:260px;overflow:auto"><table class="es-table" style="min-width:600px"><tbody>' + rows.slice(0, 30).map(function (r) { return '<tr><td>' + esc(r.code || r.key) + '</td><td>' + esc(r.name || r.province) + '</td><td>' + esc(r.unit || r.month || '') + '</td><td class="num">' + fmt(r.vl) + '</td><td class="num">' + fmt(r.nc) + '</td><td class="num">' + fmt(r.may) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (rows.length > 30 ? '<p class="es-note">… và ' + (rows.length - 30) + ' dòng nữa</p>' : '') : '';
    }
    $('imFile').addEventListener('change', function () { var f = this.files[0]; if (f) readTable(f, prev); });
    $('imPrev').addEventListener('click', function () { prev(textRows($('imTxt').value)); });
    $('imGo').addEventListener('click', function () {
      if (!rows.length) return; var type = $('imType').value, list = rows;
      if (type === 'codes') { var have = {}; libCodes().forEach(function (c) { have[c.code] = 1; }); var seen = {}; list = rows.filter(function (r) { if (have[r.code] || seen[r.code]) return false; seen[r.code] = 1; return true; }); }
      var made = TM.addCollBatch(type === 'codes' ? 'dtqtCodes' : 'dtqtPrices', list, user());
      toast(made ? 'Đã nhập ' + made.length + ' dòng' + (type === 'codes' && made.length < rows.length ? ' (bỏ qua ' + (rows.length - made.length) + ' mã trùng)' : '') : 'Không nhập được (mất mạng?)');
      rows = []; $('imGo').disabled = true; $('imPreview').innerHTML = ''; $('imTxt').value = '';
    });
  }

  // =====================================================================================
  // TAB NHÂN CÔNG · MÁY · NGÀY CÔNG — khối lượng dự toán × định mức hao phí → số công, ca máy, số ngày
  // Định mức: ưu tiên thư viện DTQT (dòng NC = công/ĐVT, dòng M = ca máy/ĐVT, nạp từ định mức chính thức); không có thì dùng số ước tính tham khảo trong norms-data.js (cần đối chiếu).
  // =====================================================================================
  function normOf(line) {
    var c = libCodes().filter(function (x) { return x.code === line.code; })[0];
    if (c) { var nc = 0, may = []; libResources(c).forEach(function (r) { var t = String(r.t || '').toUpperCase(); if (t === 'NC') nc += n0(r.qty); else if (t === 'M' || t === 'MAY') may.push({ name: r.name, qty: n0(r.qty) }); }); if (nc || may.length) return { nc: nc, may: may, grade: '', src: 'Thư viện DTQT', official: true }; }
    var s = window.VnNorms && VnNorms.get(line.code);
    return s ? { nc: s.nc, may: s.may, grade: s.grade, src: s.src, official: false } : null;
  }
  function resCalc(e) {
    var P = e.params, K = n0(P.kns) || 1, crew = Math.max(1, n0(P.crew) || 1), rows = [], g = null, tot = { cong: 0, may: {}, miss: 0, n: 0, off: 0, est: 0 };
    e.items.forEach(function (it) {
      if (it.t === 'g') { g = { cong: 0, name: it.name }; rows.push({ g: g, it: it }); return; }
      var nm = normOf(it), q = n0(it.qty); tot.n++;
      if (!nm) { tot.miss++; rows.push({ it: it, nm: null }); return; }
      var cong = q * nm.nc * K; if (nm.official) tot.off++; else tot.est++;
      tot.cong += cong; if (g) g.cong += cong;
      var mays = nm.may.map(function (m) { var ca = q * m.qty * K; tot.may[m.name] = n0(tot.may[m.name]) + ca; return { name: m.name, ca: ca }; });
      rows.push({ it: it, nm: nm, cong: cong, mays: mays, days: cong / crew });
    });
    tot.days = tot.cong / crew; tot.need = n0(P.target) > 0 ? Math.ceil(tot.cong / n0(P.target)) : 0;
    return { rows: rows, tot: tot, K: K, crew: crew };
  }
  function renderRes() {
    var root = $('esRes'), list = estList();
    if (!st.est && list.length) { st.est = loadEstRec(list[0]); st.estId = list[0].id; }
    var e = st.est;
    if (!e) { root.innerHTML = '<div class="es-card"><div class="es-empty">Chưa có dự toán. Lập dự toán ở tab “Dự toán” trước — khối lượng của dự toán sẽ được dùng để tính nhân công, máy, ngày công.</div></div>'; return; }
    var P = e.params, c = resCalc(e), t = c.tot, f2 = function (v) { return (Math.round(n0(v) * 100) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };
    var kp = '<div class="es-kpis"><div class="es-kpi"><span>Tổng ngày công (người·ngày)</span><b>' + f2(t.cong) + '</b></div><div class="es-kpi"><span>Số ngày với ' + c.crew + ' thợ</span><b>' + f2(t.days) + '</b></div><div class="es-kpi"><span>' + (t.need ? 'Thợ cần để xong trong ' + P.target + ' ngày' : 'Nhập số ngày mục tiêu') + '</span><b>' + (t.need || '—') + '</b></div><div class="es-kpi"><span>Dòng có định mức</span><b>' + (t.n - t.miss) + ' / ' + t.n + '</b></div></div>';
    var warn = t.est ? '<div class="es-card" style="border-color:var(--es-warn)"><div class="es-note"><b style="color:var(--es-warn)">Lưu ý:</b> ' + t.est + ' dòng đang dùng định mức <b>ước tính tham khảo</b> (chưa phải số liệu chính thức theo Thông tư 12/2021/TT-BXD, Quyết định 1776/BXD-VP…). Muốn dùng định mức chính thức: ở tab “Mã công việc & đơn giá tỉnh” thêm / nhập mã với “Định mức hao phí” (dòng NC = công/ĐVT, dòng M = ca máy/ĐVT) — định mức trong thư viện luôn được ưu tiên.</div></div>' : '';
    var ctl = '<div class="es-card"><h3>Điều kiện thi công <small>· dùng cho dự toán “' + esc(e.name) + '”</small></h3><div class="es-toolbar" style="margin:0"><select class="es-select" id="rsPick" style="min-width:260px">' + list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === e.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select><label class="es-note">Số thợ bố trí</label><input class="es-input" id="rsCrew" style="width:90px" value="' + esc(String(P.crew)) + '" inputmode="numeric"><label class="es-note">Hệ số điều chỉnh định mức (K)</label><input class="es-input" id="rsK" style="width:90px" value="' + esc(String(P.kns).replace('.', ',')) + '" inputmode="decimal" title="K lớn hơn 1: thi công khó (nhà cao tầng, mặt bằng hẹp…); nhỏ hơn 1: thuận lợi"><label class="es-note">Số ngày mục tiêu</label><input class="es-input" id="rsTarget" style="width:90px" value="' + (P.target ? esc(String(P.target)) : '') + '" inputmode="numeric" placeholder="vd 60"><span class="es-spacer"></span><button class="es-btn" id="rsXls" type="button">Xuất Excel</button></div></div>';
    var rows = c.rows.map(function (r, i) {
      if (r.g) return '<tr class="grp"><td colspan="6">' + esc(r.it.name) + '</td><td class="num">' + f2(r.g.cong) + '</td><td class="num">' + f2(r.g.cong / c.crew) + '</td><td></td></tr>';
      var it = r.it;
      if (!r.nm) return '<tr><td>' + esc(it.code) + '</td><td>' + esc(it.name) + '</td><td>' + esc(it.unit) + '</td><td class="num">' + fmtQ(it.qty) + '</td><td class="num" colspan="3" style="color:var(--es-muted)">chưa có định mức</td><td></td><td><button class="es-btn es-btn-sm" data-addnorm="' + i + '" type="button">+ Thêm định mức</button></td></tr>';
      return '<tr><td>' + esc(it.code) + '</td><td>' + esc(it.name) + '</td><td>' + esc(it.unit) + '</td><td class="num">' + fmtQ(it.qty) + '</td><td class="num">' + f2(r.nm.nc) + '<div style="font-size:.6875rem;color:var(--es-muted)">' + esc(r.nm.grade || '') + '</div></td><td style="min-width:200px">' + (r.mays.length ? r.mays.map(function (m) { return esc(m.name) + ' <b>' + f2(m.ca) + '</b> ca'; }).join('<br>') : '<span style="color:var(--es-muted)">—</span>') + '</td><td class="num">' + f2(r.cong) + '</td><td class="num">' + f2(r.days) + '</td><td><span class="es-chip ' + (r.nm.official ? 'ok' : 'warn') + '" title="' + esc(r.nm.src) + '">' + (r.nm.official ? 'Thư viện' : 'Tham khảo') + '</span></td></tr>';
    }).join('');
    var mach = Object.keys(t.may).sort().map(function (k) { return '<span class="k">Máy: ' + esc(k) + '</span><span></span><span class="v">' + f2(t.may[k]) + ' ca</span>'; }).join('');
    root.innerHTML = kp + warn + ctl + '<div class="es-card"><div class="es-tablewrap"><table class="es-table" style="min-width:1000px"><thead><tr><th style="width:90px">Mã hiệu</th><th>Công tác</th><th style="width:70px">ĐVT</th><th class="num" style="width:100px">Khối lượng</th><th class="num" style="width:130px">Định mức công/ĐVT</th><th>Máy thi công (ca)</th><th class="num" style="width:110px">Tổng công</th><th class="num" style="width:110px">Số ngày</th><th style="width:130px">Nguồn</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="es-empty">Dự toán chưa có dòng công tác.</td></tr>') + '</tbody></table></div>' +
      '<div class="es-sum" style="margin-top:14px"><span class="k"><b>Tổng nhân công (người·ngày công)</b></span><span></span><span class="v tot">' + f2(t.cong) + '</span>' + mach + '<span class="k"><b>Số ngày thi công (nếu làm tuần tự theo ' + c.crew + ' thợ)</b></span><span></span><span class="v tot">' + f2(t.days) + ' ngày</span></div><p class="es-note" style="margin:10px 0 0">Số ngày = tổng công × K ÷ số thợ, cộng dồn theo thứ tự công tác; thực tế các tổ đội làm song song nên tiến độ ngắn hơn — dùng ô “Số ngày mục tiêu” để biết cần bao nhiêu thợ. Công = ngày công 8 giờ.</p></div>';
    var rd = function () { P.crew = Math.max(1, Math.round(pnum($('rsCrew').value)) || 1); P.kns = pnum($('rsK').value) || 1; P.target = Math.max(0, Math.round(pnum($('rsTarget').value))); touch(); renderRes(); };
    $('rsCrew').addEventListener('change', rd); $('rsK').addEventListener('change', rd); $('rsTarget').addEventListener('change', rd);
    $('rsPick').addEventListener('change', function () { var rec = estList().filter(function (x) { return x.id === $('rsPick').value; })[0]; saveEst(function () { if (rec) { st.est = loadEstRec(rec); st.estId = rec.id; } renderRes(); }); });
    $('rsXls').addEventListener('click', function () { exportRes(e, c); });
    root.querySelector('tbody').addEventListener('click', function (ev) { var b = ev.target.closest('[data-addnorm]'); if (!b) return; var it = c.rows[Number(b.dataset.addnorm)].it; st.libTab = 'codes'; showTab('lib'); codeForm({ code: it.code, name: it.name, unit: it.unit }); });
  }
  function exportRes(e, c) {
    if (typeof ExcelJS === 'undefined') { alert('Chưa tải xong bộ xuất Excel.'); return; }
    var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Nhân công - Máy'); ws.columns = [{ width: 12 }, { width: 46 }, { width: 8 }, { width: 12 }, { width: 14 }, { width: 40 }, { width: 13 }, { width: 11 }, { width: 14 }];
    ws.addRow(['BẢNG TỔNG HỢP NHÂN CÔNG, MÁY THI CÔNG VÀ SỐ NGÀY CÔNG']).font = { bold: true, size: 14 }; ws.addRow(['Công trình: ' + e.name + ' · K = ' + c.K + ' · ' + c.crew + ' thợ']); ws.addRow([]);
    var hr = ws.addRow(['Mã hiệu', 'Công tác', 'ĐVT', 'Khối lượng', 'ĐM công/ĐVT', 'Máy thi công (ca)', 'Tổng công', 'Số ngày', 'Nguồn định mức']); hr.font = { bold: true };
    c.rows.forEach(function (r) { var row = r.g ? ws.addRow(['', r.it.name, '', '', '', '', r.g.cong, r.g.cong / c.crew]) : ws.addRow([r.it.code, r.it.name, r.it.unit, n0(r.it.qty), r.nm ? r.nm.nc : '', r.nm ? r.mays.map(function (m) { return m.name + ': ' + (Math.round(m.ca * 100) / 100); }).join('; ') : '', r.nm ? r.cong : '', r.nm ? r.days : '', r.nm ? r.nm.src : 'chưa có định mức']); if (r.g) row.font = { bold: true }; [4, 5, 7, 8].forEach(function (i) { row.getCell(i).numFmt = '#,##0.00'; }); });
    ws.addRow([]); ws.addRow(['', 'TỔNG NHÂN CÔNG (người·ngày)', '', '', '', '', c.tot.cong]).font = { bold: true }; ws.addRow(['', 'Số ngày với ' + c.crew + ' thợ', '', '', '', '', '', c.tot.days]).font = { bold: true };
    Object.keys(c.tot.may).sort().forEach(function (k) { ws.addRow(['', 'Máy: ' + k, '', '', '', '', c.tot.may[k]]); });
    ws.addRow([]); ws.addRow(['', 'Ghi chú: định mức nguồn "Ước tính tham khảo" cần đối chiếu Thông tư 12/2021/TT-BXD / Quyết định 1776/BXD-VP trước khi dùng chính thức.']);
    if (typeof HiconiqueExcel !== 'undefined' && HiconiqueExcel.standardize) { try { HiconiqueExcel.standardize(wb); } catch (er) { } }
    wb.xlsx.writeBuffer().then(function (buf) { download('nhan-cong-may-' + plain(e.name) + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); });
  }

  // =====================================================================================
  // TAB HƯỚNG DẪN
  // =====================================================================================
  function renderHelp() {
    $('esHelp').innerHTML = '<div class="es-card"><h3>Quy trình lập dự toán</h3><ol class="es-steps"><li><b>Dự toán mới</b> → chọn tỉnh/thành, loại công trình (tự gợi ý tỷ lệ chi phí chung và thu nhập chịu thuế tính trước, sửa được).</li><li>Thêm <b>hạng mục</b>, rồi <b>công tác</b> từ thư viện mã việc hoặc bảng giá <b>DG-</b> của tỉnh — hoặc dán khối lượng từ Excel. Đơn giá tự điền theo mức giá (thấp / trung bình / cao) và kỳ giá.</li><li>Nhập <b>khối lượng</b>; sửa tay đơn giá nếu cần (ô chuyển cam, không bị ghi đè khi cập nhật giá).</li><li>Kiểm tra bảng <b>tổng hợp chi phí</b> (trực tiếp → chung → thu nhập chịu thuế tính trước → VAT → dự phòng) rồi <b>xuất Excel / In PDF</b>.</li><li>Tab <b>Nhân công · Máy · Ngày công</b>: khối lượng dự toán × định mức hao phí → tổng công, ca máy từng loại, số ngày với số thợ bố trí (hoặc số thợ cần để xong đúng hạn).</li><li>Khi chốt hợp đồng: tab <b>Thanh toán · Quyết toán</b> → mỗi đợt nhập khối lượng nghiệm thu kỳ này (+ khối lượng phát sinh), trừ tạm ứng, giữ lại bảo hành; cuối cùng <b>Tổng hợp quyết toán</b> đối chiếu với dự toán.</li></ol></div>' +
      '<div class="es-card"><h3>Cập nhật mã công việc &amp; đơn giá theo từng tỉnh</h3><ol class="es-steps"><li>Tab <b>Mã công việc &amp; đơn giá tỉnh → Cập nhật đơn giá</b>: chọn tỉnh + kỳ giá, nhập đơn giá riêng (VD giá công bố hàng tháng) cho từng mã. Lưu vào <b>DTQT-Đơn giá tỉnh</b>.</li><li>Dự toán dùng <b>đơn giá mới nhất có kỳ ≤ kỳ giá của dự toán</b>; bấm “⟳ Cập nhật đơn giá” để tính lại cả dự toán sau khi đổi tỉnh / kỳ giá.</li><li>Có file định mức / đơn giá từ phần mềm khác (ETA, G8, F1…) → <b>Nhập từ Excel / CSV</b>.</li><li>Bảng <b>DG-</b> (công ty tự khảo sát) vẫn là nguồn gốc, chỉ được đọc — không bị ghi đè.</li></ol></div>' +
      '<div class="es-card"><h3>Căn cứ &amp; lưu ý</h3><p class="es-note">Cấu trúc chi phí theo Nghị định 10/2021/NĐ-CP (quản lý chi phí đầu tư xây dựng) và Thông tư 11/2021/TT-BXD; định mức theo Thông tư 12/2021/TT-BXD và các văn bản sửa đổi. <b>Trang này không kèm sẵn toàn bộ bộ định mức / đơn giá nhà nước</b> — hãy nạp bằng file hoặc khai vào thư viện. Tỷ lệ chi phí chung / thu nhập chịu thuế tính trước / VAT là giá trị mặc định tham khảo — luôn đối chiếu văn bản hiện hành và yêu cầu của chủ đầu tư rồi chỉnh trong từng dự toán. Chỉnh “Knc / Kmtc” để áp hệ số điều chỉnh nhân công / máy theo vùng, theo quý.</p></div>';
  }

  // ---------- khởi động ----------
  function showTab(t) {
    st.tab = t;
    document.querySelectorAll('#esTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    ['est', 'set', 'res', 'lib', 'help'].forEach(function (k) { $('es' + k.charAt(0).toUpperCase() + k.slice(1)).hidden = k !== t; });
    if (t === 'est') renderEst(); else if (t === 'set') saveEst(renderSet); else if (t === 'res') renderRes(); else if (t === 'lib') saveEst(renderLib); else renderHelp();
  }
  $('esTabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  window.addEventListener('beforeunload', function () { if (st.dirty) saveEst(); });
  function init() {
    try { var c = JSON.parse(localStorage.getItem('hq_dtqt_prov') || 'null'); if (c && c.length > 20) st.provinces = c; } catch (e) { }
    showTab(location.hash === '#set' ? 'set' : location.hash === '#lib' ? 'lib' : 'est');
    var left = 4, done = function () { if (--left === 0 && st.tab !== 'est' || (left === 0 && !st.dirty)) showTab(st.tab); };
    ['dtqtEstimates', 'dtqtCodes', 'dtqtPrices', 'dtqtSettlements'].forEach(function (t) { TM.loadColl(t, function () { if (!st.dirty && !document.querySelector('.es-overlay') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { st.est = st.est && st.est.id ? (function () { var r = TM.listColl('dtqtEstimates').filter(function (x) { return x.id === st.est.id; })[0]; return r ? loadEstRec(r) : st.est; })() : st.est; showTab(st.tab); } }); });
    if (api()) jget(api() + '?action=getPriceDbProvinces').then(function (a) { var names = a.map(function (x) { return x['Tỉnh/thành']; }).filter(Boolean); if (names.length) { st.provinces = names; try { localStorage.setItem('hq_dtqt_prov', JSON.stringify(names)); } catch (e) { } } }).catch(function () { });
  }
  init();
  window.EstimatePage = { calc: calc, costOf: costOf, priceFor: priceFor };
})();
