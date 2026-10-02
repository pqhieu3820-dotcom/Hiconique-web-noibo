/* Trang "Đơn giá – Định mức" (pages/dgdm.html) — 2026-10-02.
 * Kiểm soát mã công việc / mã vật liệu / đơn vị tính / giai đoạn – hạng mục / nhóm tài nguyên theo Form mã công việc v2 (dữ liệu chuẩn: dgdm-data.js).
 * NGUYÊN TẮC (người dùng chốt): KHÔNG xoá / sửa dữ liệu trong Sheet — chỉ đổi tên tab DG- → DGDM- (chạy migrateDgdm trong Apps Script) và THÊM cột mã.
 *  Gợi ý ánh xạ nằm ở dgdm-map.js; mọi dòng "cần duyệt" phải được người dùng xác nhận trên trang này rồi mới "Chốt & ghi" (action applyDgdmCodes: chỉ ghi vào 2 cột mới "Mã công việc" / "Mã tài nguyên"). */
(function () {
  'use strict';
  var D = window.DGDM_DATA, M = window.DgdmMap, $ = function (id) { return document.getElementById(id); };
  if (!D || !M || !$('dgOv')) return;
  var API = (typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL) || '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return M.norm(s); }
  function fmt(n) { return (Number(n) || 0).toLocaleString('vi-VN'); }
  function toast(msg) { var t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#22272E;color:#fff;border:1px solid #B8935A;padding:10px 18px;border-radius:10px;font:600 .8125rem Inter,sans-serif;z-index:900;max-width:90vw'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function jget(url, tries) { tries = tries || 3; return fetch(url, { redirect: 'follow' }).then(function (r) { return r.text(); }).then(function (t) { var c = t.charAt(0); if (c === '{' || c === '[') return JSON.parse(t); throw new Error('Máy chủ trả dữ liệu lỗi'); }).catch(function (e) { if (tries <= 1) throw e; return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return jget(url, tries - 1); }); }); }
  function post(action, data) {
    var f = new URLSearchParams(); f.set('action', action); f.set('data', JSON.stringify(data));
    return fetch(API, { method: 'POST', body: f, redirect: 'follow' }).then(function (r) { return r.json(); });
  }
  function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function download(name, text) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600); }
  function csv(rows) { return rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n;]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\r\n'); }

  var HM_LIST = D.stages.map(function (s) { return { gd: s[0], gdName: s[1], hm: s[2], name: s[3], scope: s[4], cost: s[5], inEst: s[6], old: s[7] }; });
  var HM_NAME = {}; HM_LIST.forEach(function (h) { HM_NAME[h.hm] = h.name; });
  var GR_VL = D.resGroups.filter(function (g) { return g[0] === 'VL'; }), GR_NAME = {}; GR_VL.forEach(function (g) { GR_NAME[g[1]] = g[2]; });
  var UNIT_MAP = {}; D.unitMap.forEach(function (u) { UNIT_MAP[u[0]] = u[1]; });
  var st = { tab: 'ov', prov: 'Hải Phòng', loaded: false, ct: [], vt: [], ctRaw: [], vtRaw: [], status: null, fCt: 'all', fVt: 'all', q: '' };
  var overCt = ls('dgdm_over_ct', {}), overVt = ls('dgdm_over_vt', {}), okCt = ls('dgdm_ok_ct', {}), okVt = ls('dgdm_ok_vt', {});

  // ---------- nạp dữ liệu ----------
  function parseTables(res) {
    var T = (res && res.tables) || {}, ix = function (h, n) { return h.indexOf(n); }, out = { ct: [], vt: [] };
    if (T.ct) { var h = T.ct.headers, c = ix(h, 'Mã'), n = ix(h, 'Công tác'), u = ix(h, 'ĐVT'), g = ix(h, 'Nhóm'), sp = ix(h, 'Phạm vi/spec'), nm = ix(h, 'Mã công việc'); T.ct.rows.forEach(function (r) { out.ct.push({ code: String(r[c]), name: String(r[n] || ''), unit: String(r[u] || ''), group: String(r[g] || ''), spec: String(r[sp] || ''), done: nm >= 0 ? String(r[nm] || '') : '' }); }); }
    if (T.vt) { var hv = T.vt.headers, cv = ix(hv, 'Mã'), nv = ix(hv, 'Vật tư/thiết bị'), uv = ix(hv, 'ĐVT'), gv = ix(hv, 'Nhóm'), sv = ix(hv, 'Spec kỹ thuật tối thiểu'), mv = ix(hv, 'Mã tài nguyên'); T.vt.rows.forEach(function (r) { out.vt.push({ code: String(r[cv]), name: String(r[nv] || ''), unit: String(r[uv] || ''), group: String(r[gv] || ''), spec: String(r[sv] || ''), done: mv >= 0 ? String(r[mv] || '') : '' }); }); }
    return out;
  }
  function rebuild() {
    st.ct = M.buildCt(st.ctRaw, overCt); st.vt = M.buildVt(st.vtRaw, overVt);
  }
  function load(cb) {
    if (!API) { cb && cb(); return; }
    var p1 = jget(API + '?action=getDgdmStatus&_=' + Date.now()).then(function (s) { st.status = s; }).catch(function () { st.status = null; });
    var p2 = jget(API + '?action=getPriceDb&province=' + encodeURIComponent(st.prov)).then(function (res) { var o = parseTables(res); st.ctRaw = o.ct; st.vtRaw = o.vt; st.loaded = true; rebuild(); }).catch(function () { st.loaded = false; });
    Promise.all([p1, p2]).then(function () { cb && cb(); });
  }

  // ---------- TAB tổng quan ----------
  function renderOv() {
    var s = st.status, root = $('dgOv'), ctN = st.ct.length, vtN = st.vt.length;
    var rn = s && s.renames ? s.renames : [];
    var done = rn.filter(function (r) { return r.toExists; }).length;
    var kp = '<div class="es-kpis"><div class="es-kpi"><span>Đổi tên sheet</span><b>' + done + ' / ' + (rn.length || D.stages.length && 15) + '</b></div><div class="es-kpi"><span>Mã công việc (mã app → mới)</span><b>' + (st.loaded ? st.ctRaw.length + ' → ' + ctN : '…') + '</b></div><div class="es-kpi"><span>Mã vật liệu (mã app → mới)</span><b>' + (st.loaded ? st.vtRaw.length + ' → ' + vtN : '…') + '</b></div><div class="es-kpi"><span>Cần duyệt</span><b>' + (st.loaded ? needReview().length : '…') + '</b></div></div>';
    var rows = rn.map(function (r) { return '<tr><td>' + esc(r.from) + '</td><td>' + esc(r.to) + '</td><td>' + (r.toExists ? '<span class="es-chip ok">Đã đổi tên</span>' : r.fromExists ? '<span class="es-chip warn">Chưa đổi</span>' : '<span class="es-chip bad">Không có sheet</span>') + '</td></tr>'; }).join('');
    var codes = s && s.codes ? ['ct', 'vt'].map(function (k) { var c = s.codes[k] || {}; return '<tr><td>' + (k === 'ct' ? 'Công tác (' + esc(c.sheet || '') + ')' : 'Vật tư (' + esc(c.sheet || '') + ')') + '</td><td>' + (c.has ? '<span class="es-chip ok">Đã có cột</span>' : '<span class="es-chip warn">Chưa có cột</span>') + '</td><td class="num">' + fmt(c.filled) + ' / ' + fmt(c.rows) + '</td></tr>'; }).join('') : '';
    var extra = ['DGDM-Giai đoạn hạng mục', 'DGDM-Đơn vị tính', 'DGDM-Nhóm tài nguyên'].map(function (n) { var has = s && s.sheets && s.sheets.some(function (x) { return norm(x.name) === norm(n); }); return '<tr><td>' + n + '</td><td>' + (has ? '<span class="es-chip ok">Đã có</span>' : '<span class="es-chip warn">Chưa tạo</span>') + '</td></tr>'; }).join('');
    root.innerHTML = kp +
      '<div class="es-card"><h3>Các bước chuyển đổi <small>· làm theo thứ tự, mỗi bước an toàn và không xoá dữ liệu</small></h3><ol class="es-steps">' +
        '<li><b>Chạy thử:</b> mở Apps Script (script.google.com) → chọn hàm <code>migrateDgdmThu</code> → Chạy. Chỉ <i>in báo cáo</i> (Nhật ký thực thi), chưa đổi gì.</li>' +
        '<li><b>Đổi tên thật:</b> chọn hàm <code>migrateDgdmThat</code> → Chạy → hệ thống <b>tự sao lưu cả file Sheet</b> rồi mới đổi tên DG- → DGDM-, gộp DGXD-Nguồn vào DGDM-Nguồn (giữ nguyên DGXD-Nguồn), thêm cột <i>Mã tỉnh</i>, <i>Mã công việc</i>, <i>Mã hiệu ĐM</i>, <i>Mã tài nguyên</i>. <b>Các sheet DGXD-&lt;tỉnh&gt; GIỮ NGUYÊN</b> (chưa xoá).</li>' +
        '<li><b>Nạp 3 sheet danh mục</b> (Giai đoạn hạng mục, Đơn vị tính, Nhóm tài nguyên) bằng nút bên dưới nếu bước 2 chưa tạo.</li>' +
        '<li><b>Rà soát &amp; duyệt mã mới</b> ở tab Mã công việc / Mã vật liệu — những dòng “Cần duyệt” phải tick đã duyệt.</li>' +
        '<li><b>Chốt &amp; ghi</b> mã vào Sheet (chỉ ghi vào cột mới). Sau đó các trang dùng đơn giá đọc được cả mã cũ lẫn mã mới.</li></ol></div>' +
      '<div class="es-grid2"><div class="es-card"><h3>Đổi tên sheet <small>· theo “3. DGDM_Bang_doi_ten_sheet.csv”</small></h3><div class="es-tablewrap"><table class="es-table" style="min-width:480px"><thead><tr><th>Tên hiện tại</th><th>Tên mới</th><th>Trạng thái</th></tr></thead><tbody>' + (rows || '<tr><td colspan="3" class="es-empty">Chưa đọc được trạng thái sheet (chưa kết nối Apps Script).</td></tr>') + '</tbody></table></div></div>' +
      '<div><div class="es-card"><h3>Cột mã mới</h3><div class="es-tablewrap"><table class="es-table" style="min-width:420px"><thead><tr><th>Sheet</th><th>Cột</th><th class="num">Đã điền</th></tr></thead><tbody>' + (codes || '<tr><td colspan="3" class="es-empty">—</td></tr>') + '</tbody></table></div></div>' +
      '<div class="es-card"><h3>3 sheet danh mục mới</h3><div class="es-tablewrap"><table class="es-table" style="min-width:380px"><tbody>' + extra + '</tbody></table></div><div style="margin-top:12px"><button class="es-btn" id="dgSeed" type="button">Tạo 3 sheet danh mục + điền Mã tỉnh</button></div><p class="es-note" style="margin:8px 0 0">Chỉ <b>tạo sheet chưa có</b> (không ghi đè). Dữ liệu lấy từ Form v2: ' + D.stages.length + ' hạng mục, ' + D.unitStd.length + ' ĐVT chuẩn (m và md tách riêng; thêm “m2 sàn quy đổi”), ' + D.resGroups.length + ' nhóm tài nguyên, ' + D.provinces.length + ' mã tỉnh.</p></div></div></div>';
    var sb = $('dgSeed'); if (sb) sb.addEventListener('click', function () {
      if (!confirm('Tạo các sheet DGDM-Giai đoạn hạng mục, DGDM-Đơn vị tính, DGDM-Nhóm tài nguyên (nếu chưa có) và điền cột Mã tỉnh? Không xoá hay ghi đè dữ liệu cũ.')) return;
      var prov = {}; D.provinces.forEach(function (p) { prov[p[0]] = p[1]; });
      var hdr1 = [['Mã GĐ', 'Tên giai đoạn', 'Mã hạng mục', 'Tên hạng mục', 'Phạm vi công việc', 'Nhóm chi phí dự toán', 'Đưa vào phần mềm dự toán?', 'Mã cũ tương ứng']].concat(D.stages);
      var hdr2 = [['ĐVT chuẩn', 'ĐVT cũ trên app', 'Số dòng (lúc đối chiếu)', 'Chuyển thành', 'Ghi chú điều kiện đo']]; var n = Math.max(D.unitStd.length, D.unitMap.length);
      for (var i = 0; i < n; i++) hdr2.push([D.unitStd[i] || '', D.unitMap[i] ? D.unitMap[i][0] : '', D.unitMap[i] ? D.unitMap[i][2] : '', D.unitMap[i] ? D.unitMap[i][1] : '', D.unitMap[i] ? D.unitMap[i][3] : '']);
      post('seedDgdm', { stages: hdr1, units: hdr2, groups: [['Loại', 'Nhóm', 'Tên nhóm', 'Ví dụ']].concat(D.resGroups), prov: prov }).then(function (r) { toast((r && r.log ? r.log.join(' · ') : 'Xong').slice(0, 220)); load(function () { renderAll(); }); }).catch(function () { toast('Không gửi được lệnh (kiểm tra kết nối).'); });
    });
  }
  function needReview() {
    var a = st.ct.filter(function (e) { return e.review && !okCt[e.old]; }).map(function (e) { return ['ct', e]; });
    return a.concat(st.vt.filter(function (e) { return e.review && !okVt[e.old]; }).map(function (e) { return ['vt', e]; }));
  }

  // ---------- TAB mã công việc / vật liệu ----------
  function hmOptions(cur) { var gd = ''; return HM_LIST.filter(function (h) { return h.inEst.indexOf('Không') !== 0 || h.gd === 'HSPL' || h.gd === 'TK' ? true : true; }).map(function (h) { var o = ''; if (h.gd !== gd) { o += (gd ? '</optgroup>' : '') + '<optgroup label="' + esc(h.gd + ' — ' + h.gdName) + '">'; gd = h.gd; } return o + '<option value="' + h.hm + '"' + (h.hm === cur ? ' selected' : '') + '>' + esc(h.hm + ' · ' + h.name) + '</option>'; }).join('') + '</optgroup>'; }
  function grOptions(cur) { return GR_VL.map(function (g) { return '<option value="' + g[1] + '"' + (g[1] === cur ? ' selected' : '') + '>VL-' + g[1] + ' · ' + esc(g[2]) + '</option>'; }).join(''); }
  function listView(kind) {
    var isCt = kind === 'ct', list = isCt ? st.ct : st.vt, ok = isCt ? okCt : okVt, f = isCt ? st.fCt : st.fVt, q = norm(st.q);
    var rows = list.filter(function (e) { return (f === 'all' || (f === 'review' && e.review && !ok[e.old]) || (f === 'merged' && e.merged.length > 1) || (f === 'ok' && e.review && ok[e.old])) && (!q || norm(e.old + ' ' + e.merged.join(' ') + ' ' + e.name + ' ' + e.newCode).indexOf(q) !== -1); });
    var pend = list.filter(function (e) { return e.review && !ok[e.old]; }).length, merged = list.filter(function (e) { return e.merged.length > 1; }).length;
    var head = '<div class="es-kpis"><div class="es-kpi"><span>' + (isCt ? 'Mã công việc app' : 'Mã vật liệu app') + '</span><b>' + (isCt ? st.ctRaw.length : st.vtRaw.length) + '</b></div><div class="es-kpi"><span>Mã mới (sau gộp)</span><b>' + list.length + '</b></div><div class="es-kpi"><span>Đã gộp (tên + ĐVT khớp 100%)</span><b>' + merged + '</b></div><div class="es-kpi"><span>Còn cần duyệt</span><b>' + pend + '</b></div></div>';
    var bar = '<div class="es-toolbar"><input class="es-input" id="dgQ" placeholder="Tìm mã cũ, mã mới, tên…" value="' + esc(st.q) + '" style="flex:1 1 240px"><select class="es-select" id="dgF"><option value="all">Tất cả</option><option value="review"' + (f === 'review' ? ' selected' : '') + '>Cần duyệt (' + pend + ')</option><option value="ok"' + (f === 'ok' ? ' selected' : '') + '>Đã duyệt</option><option value="merged"' + (f === 'merged' ? ' selected' : '') + '>Dòng đã gộp</option></select><span class="es-spacer"></span><button class="es-btn" id="dgCsv" type="button">Xuất bảng ánh xạ (CSV)</button><button class="es-btn es-btn-primary" id="dgApply" type="button">Chốt &amp; ghi mã vào Sheet</button></div>';
    var body = rows.slice(0, 400).map(function (e, i) {
      var rev = e.review && !ok[e.old];
      return '<tr data-old="' + esc(e.old) + '"' + (rev ? ' style="background:color-mix(in srgb,var(--es-warn) 8%,transparent)"' : '') + '><td style="font-family:JetBrains Mono,monospace;font-size:.75rem;white-space:nowrap">' + esc(e.merged.join('; ')) + '</td><td style="min-width:240px">' + esc(e.name) + (e.spec ? '<div style="font-size:.6875rem;color:var(--es-muted)">' + esc(e.spec.slice(0, 90)) + '</div>' : '') + '</td><td style="white-space:nowrap">' + esc(e.unit) + (UNIT_MAP[e.unit] && UNIT_MAP[e.unit] !== e.unit ? '<div style="font-size:.6875rem;color:var(--es-muted)">→ ' + esc(UNIT_MAP[e.unit]) + '</div>' : '') + '</td><td style="min-width:220px"><select class="es-select" data-sel style="height:30px;font-size:.75rem">' + (isCt ? hmOptions(e.hm) : grOptions(e.grp)) + '</select></td><td style="font-family:JetBrains Mono,monospace;font-size:.75rem;white-space:nowrap"><b>' + esc(e.newCode) + '</b>' + (e.manual ? ' <span class="es-chip">sửa tay</span>' : '') + '</td><td style="min-width:150px;font-size:.75rem">' + (e.review ? (ok[e.old] ? '<span class="es-chip ok">Đã duyệt</span>' : '<span style="color:var(--es-warn)">' + esc(e.review) + '</span><div><label style="cursor:pointer"><input type="checkbox" data-ok style="width:auto;height:auto"> Duyệt</label></div>') : '') + '</td></tr>';
    }).join('');
    return head + bar + '<div class="es-tablewrap"><table class="es-table" style="min-width:980px"><thead><tr><th>Mã cũ trên app</th><th>' + (isCt ? 'Tên công tác' : 'Vật tư / thiết bị') + '</th><th>ĐVT</th><th>' + (isCt ? 'Hạng mục' : 'Nhóm tài nguyên') + '</th><th>Mã mới</th><th>Ghi chú</th></tr></thead><tbody id="dgRows">' + (body || '<tr><td colspan="6" class="es-empty">' + (st.loaded ? 'Không có dòng nào.' : 'Chưa tải được dữ liệu từ Sheet.') + '</td></tr>') + '</tbody></table></div><p class="es-note" style="margin-top:8px">Đang xem dữ liệu của <b>' + esc(st.prov) + '</b> (mọi tỉnh dùng chung một bộ mã, chỉ khác giá). Hiện tối đa 400 dòng — dùng ô tìm / bộ lọc. ' + (rows.length > 400 ? '(Còn ' + (rows.length - 400) + ' dòng nữa.)' : '') + '</p>';
  }
  function bindList(kind, root) {
    var isCt = kind === 'ct', over = isCt ? overCt : overVt, ok = isCt ? okCt : okVt, key = isCt ? 'dgdm_over_ct' : 'dgdm_over_vt', okKey = isCt ? 'dgdm_ok_ct' : 'dgdm_ok_vt';
    $('dgQ').addEventListener('input', function () { st.q = this.value; var p = this.selectionStart; renderTab(kind); var e = $('dgQ'); e.focus(); e.setSelectionRange(p, p); });
    $('dgF').addEventListener('change', function () { if (isCt) st.fCt = this.value; else st.fVt = this.value; renderTab(kind); });
    $('dgRows').addEventListener('change', function (ev) {
      var tr = ev.target.closest('tr'); if (!tr) return; var old = tr.dataset.old;
      if (ev.target.matches('[data-sel]')) { over[old] = ev.target.value; lsSet(key, over); delete ok[old]; lsSet(okKey, ok); ok[old] = true; lsSet(okKey, ok); rebuild(); renderTab(kind); }   // chọn tay = đã duyệt
      else if (ev.target.matches('[data-ok]')) { if (ev.target.checked) ok[old] = true; else delete ok[old]; lsSet(okKey, ok); renderTab(kind); }
    });
    $('dgCsv').addEventListener('click', function () { exportCsv(kind); });
    $('dgApply').addEventListener('click', function () { applyCodes(); });
  }
  function exportCsv(kind) {
    var rows = [kind === 'ct' ? ['ma_cu', 'ma_moi', 'ten_cong_tac', 'ghi_chu'] : ['ma_cu', 'ma_moi', 'ten_vat_tu', 'ghi_chu']];
    (kind === 'ct' ? st.ct : st.vt).forEach(function (e) { e.merged.forEach(function (o) { rows.push([o, e.newCode, e.name, (e.merged.length > 1 ? 'Gộp: ' + e.merged.join('; ') + '. ' : '') + (e.review || '') + (e.manual ? ' (sửa tay)' : '')]); }); });
    download('anh-xa-' + (kind === 'ct' ? 'cong-viec' : 'vat-lieu') + '.csv', csv(rows));
  }
  function applyCodes() {
    var pend = needReview();
    if (pend.length) { alert('Còn ' + pend.length + ' dòng “Cần duyệt”. Duyệt hết (hoặc chọn lại hạng mục / nhóm) rồi mới chốt.'); return; }
    if (!st.status || !st.status.codes) { alert('Chưa đọc được trạng thái Sheet.'); return; }
    var ct = {}, vt = {}; st.ct.forEach(function (e) { if (e.newCode) e.merged.forEach(function (o) { ct[o] = e.newCode; }); }); st.vt.forEach(function (e) { if (e.newCode) e.merged.forEach(function (o) { vt[o] = e.newCode; }); });
    if (!confirm('CHỐT và ghi ' + Object.keys(ct).length + ' mã công việc + ' + Object.keys(vt).length + ' mã vật liệu vào 2 cột mới của Sheet (' + (st.status.codes.ct ? st.status.codes.ct.sheet : '') + ', ' + (st.status.codes.vt ? st.status.codes.vt.sheet : '') + ')?\n\nChỉ ghi vào cột “Mã công việc” / “Mã tài nguyên”; không đụng cột nào khác; ô đã có mã khác sẽ KHÔNG bị ghi đè.')) return;
    toast('Đang ghi vào Sheet… (có thể mất vài chục giây)');
    post('applyDgdmCodes', { ct: ct, vt: vt }).then(function (r) { if (r && r.ok) toast('Đã ghi: ' + fmt((r.written || {}).ct) + ' dòng công tác, ' + fmt((r.written || {}).vt) + ' dòng vật tư' + (r.conflicts && r.conflicts.length ? ' · ' + r.conflicts.length + ' dòng xung đột (không ghi đè)' : '')); else toast('Lỗi: ' + (r && (r.error || (r.missing || []).join(', ')) || 'không rõ')); load(function () { renderAll(); }); }).catch(function () { toast('Không gửi được lệnh (kiểm tra kết nối / thử lại).'); });
  }

  // ---------- các tab danh mục ----------
  function renderUnits() {
    var seen = {}; st.ctRaw.concat(st.vtRaw).forEach(function (r) { seen[r.unit] = (seen[r.unit] || 0) + 1; });
    var unmapped = Object.keys(seen).filter(function (u) { return !(u in UNIT_MAP); });
    var rows = D.unitMap.map(function (u) { return '<tr><td>' + esc(u[0]) + '</td><td style="text-align:right">' + (seen[u[0]] || 0) + '</td><td><b>' + esc(u[1]) + '</b></td><td style="font-size:.75rem;color:var(--es-muted)">' + esc(u[3]) + '</td></tr>'; }).join('');
    $('dgUn').innerHTML = '<div class="es-card"><h3>Đơn vị tính chuẩn <small>· ' + D.unitStd.length + ' ĐVT; “m” (mét thẳng) và “md” (mét dài theo tuyến) là hai đơn vị riêng; “m2 sàn” và “m2 sàn quy đổi” tách riêng (chốt 02/10/2026)</small></h3><div style="display:flex;flex-wrap:wrap;gap:6px">' + D.unitStd.map(function (u) { return '<span class="es-chip">' + esc(u) + '</span>'; }).join('') + '</div></div>' +
      (st.loaded ? '<div class="es-card" style="' + (unmapped.length ? 'border-color:var(--es-bad)' : '') + '"><b>' + (unmapped.length ? 'ĐVT trong dữ liệu chưa có trong bảng quy đổi: ' + unmapped.map(esc).join(', ') + ' — dừng và báo, không tự thêm.' : 'Mọi ĐVT trong dữ liệu (' + esc(st.prov) + ') đều có trong bảng quy đổi.') + '</b></div>' : '') +
      '<div class="es-card"><h3>Bảng quy đổi ĐVT cũ trên app → ĐVT chuẩn <small>· cột “Số dòng ở ' + esc(st.prov) + '” đếm trên dữ liệu thật</small></h3><div class="es-tablewrap"><table class="es-table" style="min-width:600px"><thead><tr><th>ĐVT cũ trên app</th><th class="num">Số dòng (' + esc(st.prov) + ')</th><th>Chuyển thành</th><th>Điều kiện đo</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="es-note" style="margin:8px 0 0">Bảng quy đổi chỉ để chuẩn hoá khi xuất sang Form / phần mềm dự toán. Cột “ĐVT” trong các sheet DGDM- giữ nguyên giá trị cũ (không sửa dữ liệu).</p></div>';
  }
  function renderStages() {
    var cnt = {}; st.ct.forEach(function (e) { if (e.hm) cnt[e.hm] = (cnt[e.hm] || 0) + 1; });
    var gd = '', html = '';
    HM_LIST.forEach(function (h) { if (h.gd !== gd) { gd = h.gd; html += '<tr class="grp"><td colspan="6">' + esc(h.gd + ' — ' + h.gdName) + '</td></tr>'; } html += '<tr><td style="font-family:JetBrains Mono,monospace;font-size:.75rem"><b>' + esc(h.hm) + '</b></td><td>' + esc(h.name) + '</td><td style="font-size:.75rem;color:var(--es-muted)">' + esc(h.scope) + '</td><td style="font-size:.75rem">' + esc(h.cost) + '</td><td style="font-size:.75rem;color:var(--es-muted)">' + esc(h.old) + '</td><td class="num">' + (cnt[h.hm] || '') + '</td></tr>'; });
    $('dgSt').innerHTML = '<div class="es-card"><h3>Giai đoạn – hạng mục <small>· ' + HM_LIST.length + ' hạng mục (MEP chia E điện / P nước / M cơ)</small></h3><div class="es-tablewrap"><table class="es-table" style="min-width:980px"><thead><tr><th>Mã hạng mục</th><th>Tên hạng mục</th><th>Phạm vi công việc</th><th>Nhóm chi phí dự toán</th><th>Mã cũ</th><th class="num">Số công tác đang gán</th></tr></thead><tbody>' + html + '</tbody></table></div></div>';
  }
  function renderGroups() {
    var cnt = {}; st.vt.forEach(function (e) { cnt[e.grp] = (cnt[e.grp] || 0) + 1; });
    $('dgGr').innerHTML = '<div class="es-card"><h3>Nhóm tài nguyên <small>· mã tài nguyên = [Loại]-[Nhóm]-[số TT] (VL-BT-0001; NC- 2 số; M-)</small></h3><div class="es-tablewrap"><table class="es-table" style="min-width:640px"><thead><tr><th>Loại</th><th>Nhóm</th><th>Tên nhóm</th><th>Ví dụ</th><th class="num">Vật tư đang gán</th></tr></thead><tbody>' + D.resGroups.map(function (g) { return '<tr><td>' + esc(g[0]) + '</td><td><b>' + esc(g[1]) + '</b></td><td>' + esc(g[2]) + '</td><td style="font-size:.75rem;color:var(--es-muted)">' + esc(g[3]) + '</td><td class="num">' + (g[0] === 'VL' ? (cnt[g[1]] || '') : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function renderProv() {
    $('dgPv').innerHTML = '<div class="es-card"><h3>Tỉnh/thành <small>· ' + D.provinces.length + ' đơn vị hành chính cấp tỉnh · mã tỉnh đề xuất</small></h3><div class="es-toolbar"><span class="es-note">Tỉnh dùng để rà soát mã:</span><select class="es-select" id="dgProvSel">' + D.provinces.map(function (p) { return '<option' + (p[0] === st.prov ? ' selected' : '') + '>' + esc(p[0]) + '</option>'; }).join('') + '</select></div><div class="es-tablewrap"><table class="es-table" style="min-width:600px"><thead><tr><th>Tỉnh/thành</th><th>Mã tỉnh</th><th>Vùng</th><th>Vùng giá cần tách</th></tr></thead><tbody>' + D.provinces.map(function (p) { return '<tr><td>' + esc(p[0]) + '</td><td><b>' + esc(p[1]) + '</b></td><td>' + esc(p[2]) + '</td><td>' + esc(p[3]) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    $('dgProvSel').addEventListener('change', function () { st.prov = this.value; $('dgPv').innerHTML = '<div class="es-card"><div class="es-empty">Đang tải…</div></div>'; load(function () { renderAll(); showTab('pv'); }); });
  }
  function renderTab(t) {
    if (t === 'ov') renderOv();
    else if (t === 'ct') { $('dgCt').innerHTML = listView('ct'); bindList('ct'); }
    else if (t === 'vt') { $('dgVt').innerHTML = listView('vt'); bindList('vt'); }
    else if (t === 'un') renderUnits(); else if (t === 'st') renderStages(); else if (t === 'gr') renderGroups(); else if (t === 'pv') renderProv();
  }
  function renderAll() { renderTab(st.tab); }
  function showTab(t) {
    st.tab = t; document.querySelectorAll('#dgTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    ['ov', 'ct', 'vt', 'un', 'st', 'gr', 'pv'].forEach(function (k) { $('dg' + k.charAt(0).toUpperCase() + k.slice(1)).hidden = k !== t; });
    renderTab(t);
  }
  $('dgTabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-t]'); if (b) { st.q = ''; showTab(b.dataset.t); } });
  showTab('ov'); load(function () { renderAll(); });
})();
