/* PriceLookup — gõ tên hạng mục → gợi ý & điền sẵn đơn vị + đơn giá từ BẢNG GIÁ TỈNH/THÀNH của công trình (sheet DGXD-<tỉnh>) và Bảng giá dịch vụ (TC-Bảng giá dịch vụ).
   Sheet tỉnh gồm nhiều bảng xếp chồng: A nhân công khoán (Giá thấp/Giá cao), B phần thô & trọn gói, C vật tư-thiết bị (Giá thấp/Giá cao), D đơn giá công tác hoàn chỉnh (DGHT thấp/cao = VL+NC).
   Dùng ở orders.html (Đơn hàng & hóa đơn). */
(function (global) {
  'use strict';

  var TTL = 6 * 3600 * 1000, KEY = 'hq_prov_prices_v1_';
  var mem = {}, loading = {}, provinceList = null;

  function api() { return typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.API_URL ? GSHEETS_CONFIG.API_URL : ''; }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function num(s) { var n = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---- đọc lưới thô của 1 sheet tỉnh thành danh sách mục có giá ----
  function parseRows(rows, province) {
    var out = [], mode = '', cols = {};
    var idx = function (row, names) { for (var i = 0; i < names.length; i++) { var k = row.indexOf(names[i]); if (k !== -1) return k; } return -1; };
    (rows || []).forEach(function (row) {
      var ne = row.filter(function (c) { return String(c || '').trim() !== ''; });
      if (!ne.length) return;
      var isHeader = row.indexOf('ĐVT') !== -1 && (row.indexOf('Mã') !== -1 || row.indexOf('Nhóm') !== -1);
      if (isHeader) {
        if (row.indexOf('Vật tư/thiết bị') !== -1) { mode = 'C'; cols = { code: idx(row, ['Mã']), name: idx(row, ['Vật tư/thiết bị']), spec: idx(row, ['Spec kỹ thuật tối thiểu']), unit: idx(row, ['ĐVT']), low: idx(row, ['Giá thấp']), high: idx(row, ['Giá cao']), grp: idx(row, ['Loại']) }; }
        else if (row.indexOf('Công tác') !== -1) { mode = 'D'; cols = { code: idx(row, ['Mã']), name: idx(row, ['Công tác']), spec: idx(row, ['Phạm vi/spec']), unit: idx(row, ['ĐVT']), low: idx(row, ['DGHT thấp']), high: idx(row, ['DGHT cao']), grp: idx(row, ['Nhóm']) }; }
        else if (row.indexOf('Phần thô thấp') !== -1) { mode = 'B'; cols = { code: idx(row, ['Mã']), name: idx(row, ['Loại nhà']), spec: idx(row, ['Quy mô/spec giả định']), unit: idx(row, ['ĐVT']), l1: idx(row, ['Phần thô thấp']), h1: idx(row, ['Phần thô cao']), l2: idx(row, ['Trọn gói thấp']), h2: idx(row, ['Trọn gói cao']) }; }
        else if (row.indexOf('Giá thấp') !== -1 && row.indexOf('Loại nhà') !== -1) { mode = 'A'; cols = { code: idx(row, ['Mã']), name: idx(row, ['Loại nhà']), spec: idx(row, ['Quy mô/spec giả định']), unit: idx(row, ['ĐVT']), low: idx(row, ['Giá thấp']), high: idx(row, ['Giá cao']) }; }
        else mode = '';
        return;
      }
      var isSection = ne.length <= 2 && String(row[0] || '').trim() !== '';
      if (isSection) { if (/^[A-Z]\.\s/.test(String(row[0]))) mode = ''; return; }
      if (!mode) return;
      var g = function (k) { return k >= 0 ? String(row[k] || '').trim() : ''; };
      var name = g(cols.name); if (!name) return;
      var base = { name: name, spec: g(cols.spec), unit: g(cols.unit), code: g(cols.code), province: province };
      if (mode === 'B') {
        var a = Object.assign({}, base, { name: name + ' — phần thô', low: num(g(cols.l1)), high: num(g(cols.h1)), kind: 'Phần thô' });
        var b = Object.assign({}, base, { name: name + ' — trọn gói hoàn thiện', low: num(g(cols.l2)), high: num(g(cols.h2)), kind: 'Trọn gói' });
        [a, b].forEach(function (x) { if (x.low || x.high) out.push(x); });
        return;
      }
      var low = num(g(cols.low)), high = num(g(cols.high));
      if (!low && !high) return;
      out.push(Object.assign(base, { low: low || high, high: high || low, kind: mode === 'C' ? 'Vật tư' : mode === 'D' ? 'Công tác' : 'Nhân công khoán', grp: g(cols.grp) }));
    });
    var seen = {}; return out.filter(function (x) { var k = x.kind + '|' + x.name + '|' + x.unit + '|' + x.low + '|' + x.high; if (seen[k]) return false; seen[k] = 1; return true; });
  }

  function loadProvince(name) {
    if (!name) return Promise.resolve([]);
    if (mem[name]) return Promise.resolve(mem[name]);
    try { var c = JSON.parse(localStorage.getItem(KEY + name) || 'null'); if (c && Date.now() - c.t < TTL && c.items && c.items.length) { mem[name] = c.items; return Promise.resolve(c.items); } } catch (e) {}
    if (loading[name]) return loading[name];
    if (!api()) return Promise.resolve([]);
    loading[name] = fetch(api() + '?action=getProvincePricing&province=' + encodeURIComponent(name), { redirect: 'follow' }).then(function (r) { return r.json(); }).then(function (d) {
      var items = d && d.rows ? parseRows(d.rows, name) : [];
      mem[name] = items;
      try { localStorage.setItem(KEY + name, JSON.stringify({ t: Date.now(), items: items })); } catch (e) {}
      delete loading[name]; return items;
    }).catch(function (e) { delete loading[name]; console.error('Không tải được bảng giá tỉnh', name, e); return []; });
    return loading[name];
  }
  function loadProvinceList() {
    if (provinceList) return Promise.resolve(provinceList);
    if (!api()) return Promise.resolve([]);
    return fetch(api() + '?action=getProvinceList', { redirect: 'follow' }).then(function (r) { return r.json(); }).then(function (l) { provinceList = Array.isArray(l) ? l : []; return provinceList; }).catch(function () { return []; });
  }

  function priceOf(e, tier) { return tier === 'low' ? e.low : tier === 'high' ? e.high : Math.round((e.low + e.high) / 2 / 1000) * 1000 || Math.round((e.low + e.high) / 2); }

  function search(entries, q, limit) {
    var toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return [];
    var res = [];
    entries.forEach(function (e) {
      var nm = e._n || (e._n = norm(e.name)), hay = e._h || (e._h = nm + ' ' + norm(e.spec || '') + ' ' + norm(e.grp || '') + ' ' + norm(e.code || ''));
      for (var i = 0; i < toks.length; i++) if (hay.indexOf(toks[i]) === -1) return;
      var score = 0, full = toks.join(' ');
      if (nm.indexOf(full) === 0) score += 6; else if (nm.indexOf(full) !== -1) score += 4;
      toks.forEach(function (t) { if (nm.indexOf(t) !== -1) score += 1; });
      res.push({ e: e, s: score - nm.length / 500 });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, limit || 12).map(function (x) { return x.e; });
  }

  // ---- giao diện gợi ý ----
  var CSS = '#plSug{position:fixed;z-index:800;max-height:340px;overflow-y:auto;background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.35);font:400 .8125rem Inter,sans-serif;color:var(--color-text);padding:4px}' +
    '#plSug .it{padding:8px 10px;border-radius:8px;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:2px 12px}#plSug .it.on,#plSug .it:hover{background:color-mix(in srgb,var(--color-bronze) 14%,transparent)}' +
    '#plSug .nm{font-weight:600}#plSug .pr{font-family:"JetBrains Mono",monospace;color:var(--color-bronze);white-space:nowrap;text-align:right}#plSug .mt{grid-column:1/-1;font-size:.6875rem;color:var(--color-text-muted);line-height:1.4}' +
    '#plSug .tg{display:inline-block;font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:999px;border:1px solid var(--color-bronze);color:var(--color-bronze);margin-right:6px;vertical-align:1px}#plSug .em{padding:10px;color:var(--color-text-muted);font-size:.75rem}';

  function attach(opts) {
    // opts: { container, getProvince(): string, getTier(): 'low'|'mid'|'high', getCatalog(): [{name,unit,unitPrice,category,id}], onPick(tr, entry, price), onStatus(msg) }
    if (!document.getElementById('plSugCss')) { var st = document.createElement('style'); st.id = 'plSugCss'; st.textContent = CSS; document.head.appendChild(st); }
    var box = null, cur = -1, list = [], activeInput = null, timer = null;
    function close() { if (box) { box.remove(); box = null; } cur = -1; list = []; }
    function entriesFor() {
      var cat = (opts.getCatalog ? opts.getCatalog() : []).map(function (c) { return { name: c.name, spec: c.category || '', unit: c.unit || '', low: Number(c.unitPrice) || 0, high: Number(c.unitPrice) || 0, kind: 'Bảng giá dịch vụ', code: '', grp: c.category || '', province: '' }; });
      var prov = mem[opts.getProvince()] || [];
      return prov.concat(cat);
    }
    function draw() {
      if (!activeInput) return;
      var q = activeInput.value.trim();
      if (q.length < 2) { close(); return; }
      var tier = opts.getTier ? opts.getTier() : 'mid';
      list = search(entriesFor(), q, 12);
      var provName = opts.getProvince();
      if (!box) { box = document.createElement('div'); box.id = 'plSug'; document.body.appendChild(box); }
      var r = activeInput.getBoundingClientRect(), w = Math.max(r.width, 460);
      box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px'; box.style.width = w + 'px';
      var below = window.innerHeight - r.bottom, up = r.top > below && below < 260;
      box.style.top = up ? 'auto' : (r.bottom + 4) + 'px'; box.style.bottom = up ? (window.innerHeight - r.top + 4) + 'px' : 'auto';
      box.innerHTML = list.length ? list.map(function (e, i) {
        var p = priceOf(e, tier), rng = e.low === e.high ? '' : ' (' + fmt(e.low) + ' – ' + fmt(e.high) + ')';
        return '<div class="it' + (i === cur ? ' on' : '') + '" data-i="' + i + '"><span class="nm"><span class="tg">' + esc(e.kind) + '</span>' + esc(e.name) + '</span><span class="pr">' + fmt(p) + (e.unit ? ' / ' + esc(e.unit) : '') + '</span><span class="mt">' + esc((e.province ? e.province + ' · ' : '') + (e.code ? e.code + ' · ' : '') + (e.spec || '')) + rng + '</span></div>';
      }).join('') : '<div class="em">' + (provName && !mem[provName] ? 'Đang tải bảng giá ' + esc(provName) + '…' : 'Không thấy mục nào khớp' + (provName ? '' : ' — chọn dự án/tỉnh để tra thêm bảng giá tỉnh') + '.') + '</div>';
    }
    function pick(i) {
      var e = list[i]; if (!e || !activeInput) return;
      var tr = activeInput.closest('tr'); var price = priceOf(e, opts.getTier ? opts.getTier() : 'mid');
      opts.onPick(tr, e, price); close();
    }
    opts.container.addEventListener('input', function (ev) {
      if (!ev.target.matches('[data-i="name"]')) return;
      activeInput = ev.target; clearTimeout(timer);
      var pv = opts.getProvince(); if (pv && !mem[pv]) { if (opts.onStatus) opts.onStatus('Đang tải bảng giá ' + pv + '…'); loadProvince(pv).then(function (it) { if (opts.onStatus) opts.onStatus(it.length ? 'Đã nạp ' + it.length + ' mục bảng giá ' + pv : 'Không đọc được bảng giá ' + pv); draw(); }); }
      timer = setTimeout(draw, 80);
    });
    opts.container.addEventListener('focusin', function (ev) { if (ev.target.matches('[data-i="name"]')) { activeInput = ev.target; var pv = opts.getProvince(); if (pv && !mem[pv]) loadProvince(pv); } });
    opts.container.addEventListener('keydown', function (ev) {
      if (!box || !ev.target.matches('[data-i="name"]')) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); cur = Math.min(list.length - 1, cur + 1); draw(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); cur = Math.max(0, cur - 1); draw(); }
      else if (ev.key === 'Enter' && cur >= 0) { ev.preventDefault(); pick(cur); }
      else if (ev.key === 'Escape') { close(); }
    });
    document.addEventListener('mousedown', function (ev) {
      var it = ev.target.closest && ev.target.closest('#plSug .it');
      if (it) { ev.preventDefault(); pick(Number(it.getAttribute('data-i'))); return; }
      if (box && !(ev.target.matches && ev.target.matches('[data-i="name"]'))) close();
    });
    window.addEventListener('scroll', function () { if (box) draw(); }, true);
    return { close: close };
  }

  global.PriceLookup = { attach: attach, loadProvince: loadProvince, loadProvinceList: loadProvinceList, parseRows: parseRows, search: search, priceOf: priceOf, count: function (n) { return (mem[n] || []).length; }, isLoaded: function (n) { return !!mem[n]; } };
})(window);
