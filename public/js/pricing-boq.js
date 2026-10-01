/* Tab "Dự toán xây dựng" (pricing.html) — BẢNG DỰ TOÁN CHI TIẾT từng hạng mục, đơn giá lấy từ cơ sở dữ liệu DG-* của tỉnh/thành công trình.
   - Tìm hạng mục trong DG-* (nhân công khoán, phần thô/trọn gói, vật tư-thiết bị, công tác hoàn chỉnh) → thêm vào bảng, đơn giá tự điền theo mức giá đang chọn (thấp / trung bình / cao).
   - Khối lượng nhập tay hoặc "Gợi ý theo diện tích dự án" (lấy từ Thông tin chung công trình). Sửa tay đơn giá được (dòng đó không đổi theo mức giá nữa).
   - Chi phí chung / lợi nhuận định mức / VAT theo %. Lưu theo từng dự án (localStorage 'pr-boq:<id>'), xuất Excel / In PDF.
   Dùng PriceLookup (price-lookup.js) để đọc & tìm trong bảng giá tỉnh. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('boqRows') || typeof PriceLookup === 'undefined') return;

  var GROUP_ORDER = ['Phần thô', 'Trọn gói', 'Nhân công khoán', 'Công tác', 'Vật tư', 'Hạng mục khác'];
  var state = { tier: 'mid', lines: [], pct: { overhead: 0, profit: 0, vat: 8 } };
  var entries = [], entriesProv = '', seq = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN'); }
  function pnum(s) { var v = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(v) ? v : 0; }
  function province() { var el = $('prProvinceSelect'); return el ? el.value : ''; }
  function projectId() { var el = $('prToolProjectSelect'); return el && el.value ? el.value : 'none'; }
  function key() { return 'pr-boq:' + projectId(); }
  function areaFromSite() {
    var g = function (id) { var e = $(id); return e ? pnum(e.value) : 0; };
    return Math.round((g('siLength') * g('siWidth') * Math.max(1, g('siFloors') || 1) + g('siTum')) * 10) / 10;
  }
  function priceOf(l) { return l.edited ? l.price : PriceLookup.priceOf({ low: l.low, high: l.high }, state.tier); }
  function lineAmount(l) { return (Number(l.qty) || 0) * priceOf(l); }

  function save() { try { localStorage.setItem(key(), JSON.stringify(state)); } catch (e) { /* bỏ qua */ } }
  function load() {
    var o = null; try { o = JSON.parse(localStorage.getItem(key()) || 'null'); } catch (e) {}
    state = o && Array.isArray(o.lines) ? o : { tier: 'mid', lines: [], pct: { overhead: 0, profit: 0, vat: 8 } };
    state.pct = state.pct || { overhead: 0, profit: 0, vat: 8 };
    $('boqTier').value = state.tier || 'mid';
    $('boqOverhead').value = state.pct.overhead; $('boqProfit').value = state.pct.profit; $('boqVat').value = state.pct.vat;
    render();
  }

  function loadEntries() {
    var p = province();
    var st = $('boqStatus');
    if (!p) { entries = []; entriesProv = ''; if (st) st.textContent = 'Chưa chọn tỉnh/thành — chọn dự án (có tỉnh/thành) hoặc chọn ở tab "Đơn giá theo tỉnh".'; return Promise.resolve(); }
    if (entriesProv === p && entries.length) { if (st) st.textContent = 'Đơn giá: DG-* · ' + p + ' · ' + entries.length + ' mục'; return Promise.resolve(); }
    if (st) st.textContent = 'Đang tải đơn giá ' + p + '…';
    return PriceLookup.loadProvince(p).then(function (items) {
      entries = items || []; entriesProv = p;
      if (st) st.textContent = entries.length ? 'Đơn giá: DG-* · ' + p + ' · ' + entries.length + ' mục' : 'Chưa có đơn giá cho ' + p + ' trong DG-*.';
    });
  }

  // ---------- Tìm & thêm hạng mục ----------
  var box = null;
  function closeSug() { if (box) { box.remove(); box = null; } }
  function drawSug() {
    var inp = $('boqSearch'), q = inp.value.trim();
    if (q.length < 2) { closeSug(); return; }
    var list = PriceLookup.search(entries, q, 14);
    if (!box) { box = document.createElement('div'); box.className = 'boq-sug'; document.body.appendChild(box); }
    var r = inp.getBoundingClientRect(), w = Math.max(r.width, 560);
    box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px'; box.style.top = (r.bottom + 4) + 'px'; box.style.width = w + 'px';
    box.innerHTML = list.length ? list.map(function (e, i) {
      return '<div class="it" data-i="' + i + '"><div class="nm"><span class="tg">' + esc(e.kind || '') + '</span>' + esc(e.name) + '</div><div class="pr">' + fmt(PriceLookup.priceOf(e, state.tier)) + ' ₫/' + esc(e.unit || '') + '</div><div class="mt">' + esc((e.code ? e.code + ' · ' : '') + (e.spec || '')) + '</div></div>';
    }).join('') : '<div class="em">Không thấy hạng mục khớp trong DG-* của tỉnh này.</div>';
    box._list = list;
  }
  function addFromEntry(e, qty) {
    state.lines.push({ id: 'b' + Date.now() + (seq++), code: e.code || '', name: e.name, spec: e.spec || '', unit: e.unit || '', qty: qty || 0, low: e.low, high: e.high, kind: e.kind || 'Hạng mục khác', edited: false, price: 0 });
    save(); render();
  }

  // ---------- Vẽ bảng ----------
  function grouped() {
    var g = {};
    state.lines.forEach(function (l) { var k = GROUP_ORDER.indexOf(l.kind) >= 0 ? l.kind : 'Hạng mục khác'; (g[k] = g[k] || []).push(l); });
    return GROUP_ORDER.filter(function (k) { return g[k]; }).map(function (k) { return { name: k, lines: g[k] }; });
  }
  function totals() {
    var sub = state.lines.reduce(function (s, l) { return s + lineAmount(l); }, 0);
    var oh = sub * (Number(state.pct.overhead) || 0) / 100, pf = (sub + oh) * (Number(state.pct.profit) || 0) / 100;
    var pre = sub + oh + pf, vat = pre * (Number(state.pct.vat) || 0) / 100;
    return { sub: sub, oh: oh, pf: pf, pre: pre, vat: vat, total: pre + vat };
  }
  function render() {
    var gs = grouped(), n = 0;
    var html = '';
    gs.forEach(function (g) {
      var gsum = g.lines.reduce(function (s, l) { return s + lineAmount(l); }, 0);
      html += '<tr class="boq-grp"><td colspan="5">' + esc(g.name) + ' <span class="boq-cnt">(' + g.lines.length + ' mục)</span></td><td class="num">' + fmt(gsum) + '</td><td></td></tr>';
      g.lines.forEach(function (l) {
        n++;
        html += '<tr data-id="' + l.id + '"><td class="boq-stt">' + n + '</td>' +
          '<td><div class="boq-name">' + esc(l.name) + '</div>' + ((l.code || l.spec) ? '<div class="boq-spec">' + esc((l.code ? l.code + ' · ' : '') + (l.spec || '')) + '</div>' : '') + '</td>' +
          '<td class="boq-unit">' + esc(l.unit) + '</td>' +
          '<td class="num"><input class="pr-input boq-in" data-f="qty" inputmode="decimal" value="' + (l.qty ? String(l.qty).replace('.', ',') : '') + '" placeholder="0"></td>' +
          '<td class="num"><input class="pr-input boq-in' + (l.edited ? ' boq-edited' : '') + '" data-f="price" inputmode="numeric" data-money-input value="' + fmt(priceOf(l)) + '" title="' + (l.edited ? 'Đơn giá đã sửa tay — bấm ↺ để về giá DG-*' : 'Đơn giá theo DG-*; sửa tay được') + '"></td>' +
          '<td class="num boq-amt">' + fmt(lineAmount(l)) + '</td>' +
          '<td class="boq-act">' + (l.edited ? '<button class="boq-x" data-act="reset" title="Về giá DG-*">↺</button>' : '') + '<button class="boq-x" data-act="del" title="Xoá dòng">×</button></td></tr>';
      });
    });
    $('boqRows').innerHTML = html || '<tr><td colspan="7" class="boq-empty">Chưa có hạng mục. Gõ tên hạng mục vào ô tìm kiếm phía trên (VD "sơn", "gạch ốp lát", "điện") hoặc bấm "Gợi ý theo diện tích dự án".</td></tr>';
    var t = totals();
    $('boqSub').textContent = fmt(t.sub); $('boqOhAmt').textContent = fmt(t.oh); $('boqPfAmt').textContent = fmt(t.pf);
    $('boqVatAmt').textContent = fmt(t.vat); $('boqTotal').textContent = fmt(t.total);
    var a = areaFromSite();
    $('boqPerM2').textContent = a > 0 ? 'Suất đầu tư ≈ ' + (t.total / a / 1e6).toFixed(2).replace('.', ',') + ' triệu/m² sàn (' + fmt(a) + ' m²)' : '';
    if (window.HiconiqueMoney) HiconiqueMoney.bindAll($('boqRows'));
  }
  // chỉ cập nhật số (không vẽ lại cả bảng khi đang gõ → không mất con trỏ)
  function refreshNumbers() {
    Array.prototype.forEach.call($('boqRows').querySelectorAll('tr[data-id]'), function (tr) {
      var l = state.lines.filter(function (x) { return x.id === tr.getAttribute('data-id'); })[0]; if (l) tr.querySelector('.boq-amt').textContent = fmt(lineAmount(l));
    });
    var t = totals();
    $('boqSub').textContent = fmt(t.sub); $('boqOhAmt').textContent = fmt(t.oh); $('boqPfAmt').textContent = fmt(t.pf); $('boqVatAmt').textContent = fmt(t.vat); $('boqTotal').textContent = fmt(t.total);
    var gs = grouped();
    Array.prototype.forEach.call($('boqRows').querySelectorAll('tr.boq-grp'), function (tr, i) { var g = gs[i], c = tr.querySelector('td.num'); if (g && c) c.textContent = fmt(g.lines.reduce(function (s, l) { return s + lineAmount(l); }, 0)); });
  }

  // ---------- Sự kiện ----------
  $('boqSearch').addEventListener('input', function () { loadEntries().then(drawSug); });
  $('boqSearch').addEventListener('focus', function () { loadEntries().then(drawSug); });
  $('boqSearch').addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSug(); });
  document.addEventListener('mousedown', function (e) {
    if (box && !box.contains(e.target) && e.target !== $('boqSearch')) closeSug();
    var it = e.target.closest && e.target.closest('.boq-sug .it');
    if (it && box) { e.preventDefault(); var ent = box._list[Number(it.getAttribute('data-i'))]; closeSug(); $('boqSearch').value = ''; if (ent) addFromEntry(ent, 0); }
  });
  $('boqTier').addEventListener('change', function () { state.tier = this.value; save(); render(); });
  [['boqOverhead', 'overhead'], ['boqProfit', 'profit'], ['boqVat', 'vat']].forEach(function (p) {
    $(p[0]).addEventListener('input', function () { state.pct[p[1]] = pnum(this.value); save(); refreshNumbers(); });
  });
  $('boqRows').addEventListener('input', function (e) {
    var inp = e.target.closest('.boq-in'); if (!inp) return;
    var tr = inp.closest('tr'), l = state.lines.filter(function (x) { return x.id === tr.getAttribute('data-id'); })[0]; if (!l) return;
    if (inp.getAttribute('data-f') === 'qty') l.qty = pnum(inp.value);
    else { var v = (window.HiconiqueMoney ? HiconiqueMoney.parse(inp.value) : pnum(inp.value)); l.price = v; l.edited = true; inp.classList.add('boq-edited'); }
    save(); refreshNumbers();
  });
  $('boqRows').addEventListener('change', function () { render(); });   // rời ô → vẽ lại (tổng nhóm, nút ↺)
  $('boqRows').addEventListener('click', function (e) {
    var b = e.target.closest('.boq-x'); if (!b) return;
    var id = b.closest('tr').getAttribute('data-id'), act = b.getAttribute('data-act');
    if (act === 'del') state.lines = state.lines.filter(function (x) { return x.id !== id; });
    else state.lines.forEach(function (x) { if (x.id === id) { x.edited = false; x.price = 0; } });
    save(); render();
  });
  $('boqSuggest').addEventListener('click', function () {
    var a = areaFromSite();
    if (a <= 0) { alert('Chưa có diện tích: nhập Chiều dài, Chiều rộng, Số tầng ở "Thông tin chung công trình" đầu trang.'); return; }
    loadEntries().then(function () {
      if (!entries.length) { alert('Chưa có đơn giá của tỉnh/thành này trong DG-*. Chọn dự án có tỉnh/thành hoặc chọn tỉnh ở tab "Đơn giá theo tỉnh".'); return; }
      var pick = function (kind) { var c = entries.filter(function (e) { return e.kind === kind; }); var np = c.filter(function (e) { return /nha pho|nha cap|nha o/.test((e._n || (e._n = String(e.name).toLowerCase())) + ' ' + String(e.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')); }); return (np[0] || c[0]); };
      var e1 = pick('Phần thô'), added = [];
      if (e1) { addFromEntry(e1, a); added.push(e1.name); }
      if (!added.length) alert('Không tìm thấy mục "Phần thô" trong DG-* của tỉnh này — hãy tìm hạng mục bằng ô tìm kiếm.');
      else alert('Đã thêm: ' + added.join(', ') + ' × ' + fmt(a) + ' m². Dùng ô tìm kiếm để thêm các hạng mục hoàn thiện, điện nước, vật tư…');
    });
  });
  $('boqAddBlank').addEventListener('click', function () {
    state.lines.push({ id: 'b' + Date.now() + (seq++), code: '', name: 'Hạng mục mới (sửa tên)', spec: '', unit: 'm²', qty: 0, low: 0, high: 0, kind: 'Hạng mục khác', edited: true, price: 0 }); save(); render();
  });
  $('boqClear').addEventListener('click', function () { if (!state.lines.length || !confirm('Xoá toàn bộ bảng dự toán của dự án này?')) return; state.lines = []; save(); render(); });
  // tên dòng "Hạng mục khác" sửa được bằng nhấp đúp
  $('boqRows').addEventListener('dblclick', function (e) {
    var nm = e.target.closest('.boq-name'); if (!nm) return;
    var l = state.lines.filter(function (x) { return x.id === nm.closest('tr').getAttribute('data-id'); })[0]; if (!l) return;
    var v = prompt('Tên hạng mục', l.name); if (v && v.trim()) { l.name = v.trim(); var u = prompt('Đơn vị tính', l.unit); if (u != null) l.unit = u.trim(); save(); render(); }
  });
  var provSel = $('prProvinceSelect'); if (provSel) provSel.addEventListener('change', function () { entries = []; entriesProv = ''; var act = document.querySelector('.pr-tab-btn.active'); if (act && act.getAttribute('data-tab') === 'boq') loadEntries(); });
  var projSel = $('prToolProjectSelect'); if (projSel) projSel.addEventListener('change', function () { load(); });
  Array.prototype.forEach.call(document.querySelectorAll('.pr-tab-btn'), function (b) { b.addEventListener('click', function () { if (b.getAttribute('data-tab') === 'boq') { load(); loadEntries(); } }); });

  // ---------- Xuất ----------
  function docRows() {
    var out = [], n = 0;
    grouped().forEach(function (g) {
      out.push({ grp: g.name, sum: g.lines.reduce(function (s, l) { return s + lineAmount(l); }, 0) });
      g.lines.forEach(function (l) { n++; out.push({ stt: n, name: l.name, spec: (l.code ? l.code + ' · ' : '') + (l.spec || ''), unit: l.unit, qty: l.qty, price: priceOf(l), amt: lineAmount(l) }); });
    });
    return out;
  }
  function projName() { var el = $('prToolProjectSelect'); return el && el.selectedIndex >= 0 && el.value ? el.options[el.selectedIndex].text : 'Công trình'; }
  var TIER = { low: 'Giá thấp', mid: 'Giá trung bình', high: 'Giá cao' };
  $('boqExcel').addEventListener('click', function () {
    if (typeof ExcelJS === 'undefined') { alert('Chưa tải xong bộ xuất Excel. Thử lại sau vài giây.'); return; }
    var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Dự toán xây dựng');
    ws.columns = [{ width: 6 }, { width: 52 }, { width: 38 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 18 }];
    ws.mergeCells('A1:G1'); ws.getCell('A1').value = 'BẢNG DỰ TOÁN XÂY DỰNG CHI TIẾT'; ws.getCell('A1').font = { bold: true, size: 15 };
    ws.mergeCells('A2:G2'); ws.getCell('A2').value = 'Công trình: ' + projName() + ' · Tỉnh/thành: ' + (province() || '—') + ' · ' + TIER[state.tier];
    ws.addRow([]);
    var hr = ws.addRow(['STT', 'Hạng mục', 'Quy cách / mã', 'ĐVT', 'Khối lượng', 'Đơn giá', 'Thành tiền']);
    hr.font = { bold: true }; hr.eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F7' } }; c.border = { bottom: { style: 'thin' } }; });
    docRows().forEach(function (r) {
      if (r.grp) { var gr = ws.addRow(['', r.grp.toUpperCase(), '', '', '', '', r.sum]); gr.font = { bold: true }; gr.getCell(7).numFmt = '#,##0'; return; }
      var row = ws.addRow([r.stt, r.name, r.spec, r.unit, r.qty, r.price, r.amt]); row.getCell(5).numFmt = '#,##0.##'; row.getCell(6).numFmt = '#,##0'; row.getCell(7).numFmt = '#,##0';
    });
    var t = totals();
    [['Cộng chi phí trực tiếp', t.sub], ['Chi phí chung (' + state.pct.overhead + '%)', t.oh], ['Lợi nhuận định mức (' + state.pct.profit + '%)', t.pf], ['Thuế VAT (' + state.pct.vat + '%)', t.vat], ['TỔNG DỰ TOÁN', t.total]].forEach(function (x, i, arr) {
      var r = ws.addRow(['', '', '', '', '', x[0], x[1]]); r.getCell(6).font = { bold: true }; r.getCell(7).numFmt = '#,##0'; if (i === arr.length - 1) r.font = { bold: true, size: 12 };
    });
    wb.xlsx.writeBuffer().then(function (buf) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = 'du-toan-xay-dung.xlsx'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  });
  $('boqPrint').addEventListener('click', function () {
    var w = window.open('', '_blank'); if (!w) { alert('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up.'); return; }
    var t = totals();
    var rows = docRows().map(function (r) {
      return r.grp ? '<tr class="g"><td colspan="6">' + esc(r.grp) + '</td><td class="n">' + fmt(r.sum) + '</td></tr>'
        : '<tr><td>' + r.stt + '</td><td>' + esc(r.name) + (r.spec ? '<div class="s">' + esc(r.spec) + '</div>' : '') + '</td><td>' + esc(r.unit) + '</td><td class="n">' + (r.qty ? String(r.qty).replace('.', ',') : '') + '</td><td class="n">' + fmt(r.price) + '</td><td class="n" colspan="1"></td><td class="n">' + fmt(r.amt) + '</td></tr>';
    }).join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Dự toán xây dựng</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:12px}h2{margin:0 0 4px;font-size:18px}p{margin:0 0 12px;color:#555}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:5px 6px;text-align:left;vertical-align:top}th{background:#eef1f7}td.n{text-align:right;white-space:nowrap}.g td{background:#f6f6f6;font-weight:700}.s{color:#666;font-size:10.5px;margin-top:2px}.t td{font-weight:700;border:none;border-top:1px solid #aaa}@page{size:A4 landscape;margin:10mm}</style></head><body><h2>BẢNG DỰ TOÁN XÂY DỰNG CHI TIẾT</h2><p>Công trình: ' + esc(projName()) + ' · Tỉnh/thành: ' + esc(province() || '—') + ' · ' + TIER[state.tier] + ' · Lập ngày ' + new Date().toLocaleDateString('vi-VN') + '</p>' +
      '<table><thead><tr><th>STT</th><th>Hạng mục</th><th>ĐVT</th><th>Khối lượng</th><th>Đơn giá</th><th></th><th>Thành tiền</th></tr></thead><tbody>' + rows +
      '<tr class="t"><td colspan="6" style="text-align:right">Cộng chi phí trực tiếp</td><td class="n">' + fmt(t.sub) + '</td></tr>' +
      '<tr class="t"><td colspan="6" style="text-align:right">Chi phí chung (' + state.pct.overhead + '%)</td><td class="n">' + fmt(t.oh) + '</td></tr>' +
      '<tr class="t"><td colspan="6" style="text-align:right">Lợi nhuận định mức (' + state.pct.profit + '%)</td><td class="n">' + fmt(t.pf) + '</td></tr>' +
      '<tr class="t"><td colspan="6" style="text-align:right">Thuế VAT (' + state.pct.vat + '%)</td><td class="n">' + fmt(t.vat) + '</td></tr>' +
      '<tr class="t"><td colspan="6" style="text-align:right;font-size:14px">TỔNG DỰ TOÁN</td><td class="n" style="font-size:14px">' + fmt(t.total) + '</td></tr></tbody></table>' +
      '<p style="margin-top:10px;font-style:italic">* Đơn giá tham khảo theo cơ sở dữ liệu DG-* của tỉnh/thành; chỉ mang tính chất dự toán sơ bộ.</p></body></html>');
    w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
  });

  // Nhận hạng mục + khối lượng từ tab "Mô hình 3D" (cùng mã + tên + đơn giá thì cộng dồn khối lượng thay vì thêm dòng mới)
  window.HiconiqueBoq = {
    addLine: function (e, qty) {
      var ex = state.lines.filter(function (l) { return !l.edited && l.name === e.name && (l.code || '') === (e.code || ''); })[0];
      if (ex) ex.qty = Math.round(qty * 100) / 100;   // lần đẩy sau ghi đè khối lượng của chính dòng đó (mô hình là nguồn)
      else state.lines.push({ id: 'b' + Date.now() + (seq++), code: e.code || '', name: e.name, spec: 'Từ mô hình 3D', unit: e.unit || '', qty: qty, low: e.low, high: e.high, kind: e.kind || 'Hạng mục khác', edited: false, price: 0 });
      save(); render();
    }
  };
  load();
})();
