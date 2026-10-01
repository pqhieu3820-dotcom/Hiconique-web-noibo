/* Cơ cấu lương (phiếu lương) — chia nhỏ lương hợp đồng thành: Lương đóng BHXH (tối thiểu vùng I) + các khoản hỗ trợ (xăng xe, điện thoại, ăn trưa…)
   + Lương theo hiệu quả (phần còn lại). Mọi khoản tính THEO NGÀY CÔNG: tiền = mức đủ tháng ÷ 26 × số công (tối đa 26).
   Danh mục khoản + mức trần sửa được ở nút "Cơ cấu lương" (trang Phiếu lương) hoặc trực tiếp trên Sheet "TLCC-Cơ cấu lương". */
(function (global) {
  'use strict';

  // Thông số pháp lý (cập nhật khi luật đổi). Nguồn ghi trong LEGAL_NOTES bên dưới.
  var LEGAL = {
    stdDays: 26,
    minWageRegion1: 5310000,      // NĐ 293/2025/NĐ-CP, hiệu lực 01/01/2026 — vùng I
    trainedUplift: 0.07,          // lao động đã qua đào tạo/học nghề: tối thiểu cao hơn 7%  → 5.681.700 đ
    empRate: 0.105,               // NLĐ: BHXH 8% + BHYT 1,5% + BHTN 1%
    erRate: 0.215,                // Doanh nghiệp: BHXH 17,5% (gồm TNLĐ-BNN 0,5%) + BHYT 3% + BHTN 1%
    maxBase: 46800000,            // trần đóng BH = 20 × lương cơ sở 2.340.000
    minDaysBH: 14                 // làm/hưởng lương dưới 14 ngày công trong tháng → không đóng BH tháng đó
  };
  LEGAL.minWageTrained = Math.round(LEGAL.minWageRegion1 * (1 + LEGAL.trainedUplift));

  var LEGAL_NOTES = [
    ['Lương tối thiểu vùng I (2026)', 'Nghị định 293/2025/NĐ-CP, hiệu lực 01/01/2026: 5.310.000 đ/tháng. Lao động đã qua đào tạo/học nghề: tối thiểu cao hơn 7% → 5.681.700 đ. Mức lương đóng BHXH không được thấp hơn mức này.'],
    ['Tỷ lệ đóng BH bắt buộc', 'Người lao động 10,5% (BHXH 8% + BHYT 1,5% + BHTN 1%); doanh nghiệp 21,5% (BHXH 17,5% gồm 0,5% TNLĐ-BNN + BHYT 3% + BHTN 1%). Mức lương đóng BH tối đa 20 × lương cơ sở (2.340.000 → 46.800.000 đ).'],
    ['Các khoản hỗ trợ không tính đóng BHXH', 'Tiền ăn giữa ca, hỗ trợ xăng xe, điện thoại, đi lại… nếu được ghi thành MỤC RIÊNG trong hợp đồng lao động/quy chế thì không tính vào lương đóng BHXH (Thông tư 10/2020/TT-BLĐTBXH điểm c2 khoản 5 Điều 3; Luật BHXH 2024 + Nghị định 158/2025/NĐ-CP). Cần ghi rõ từng khoản trong hợp đồng/phụ lục.'],
    ['Thuế TNCN của các khoản hỗ trợ', 'Tiền ăn trưa/ăn ca chi bằng tiền: không chịu thuế TNCN trong mức trần theo quy định (trước đây 730.000 đ/tháng; dự kiến 1.200.000 đ/tháng từ 01/07/2026 — kế toán cần xác nhận văn bản hiện hành). Xăng xe/điện thoại: chỉ được miễn thuế khi có quy chế, mức chi hợp lý — nếu không sẽ tính vào thu nhập chịu thuế.'],
    ['Điều kiện đóng BH theo công', 'Tháng làm/hưởng lương dưới 14 ngày công thì không đóng BHXH, BHYT, BHTN tháng đó (Luật BHXH). Web tự áp dụng.'],
    ['Lưu ý', 'Đây là bản tổng hợp tham khảo để cấu hình lương, KHÔNG thay thế tư vấn pháp lý/kế toán. Hãy đối chiếu hợp đồng lao động và văn bản mới nhất trước khi áp dụng.']
  ];

  // Khoản mặc định (id cố định để không nhân đôi). kind: bh | allowance | performance | setting
  var DEFAULTS = [
    { id: 'salc_bh', code: 'LUONG_BH', name: 'Lương đóng BHXH (tối thiểu vùng I)', kind: 'bh', amount: LEGAL.minWageTrained, insured: true, taxCap: '', active: true, order: 1,
      note: 'Mức lương ghi trong hợp đồng làm căn cứ đóng BH. ≥ 5.310.000 (vùng I 2026); lao động qua đào tạo ≥ 5.681.700.' },
    { id: 'salc_xang', code: 'HT_XANG_XE', name: 'Hỗ trợ xăng xe', kind: 'allowance', amount: 700000, insured: false, taxCap: '', active: true, order: 2,
      note: 'Trần 700.000 đ/tháng khi đủ 26 công; ít công hơn thì giảm theo tỷ lệ công. Ghi mục riêng trong HĐLĐ.' },
    { id: 'salc_dt', code: 'HT_DIEN_THOAI', name: 'Hỗ trợ điện thoại', kind: 'allowance', amount: 300000, insured: false, taxCap: '', active: true, order: 3,
      note: 'Mức do công ty quy định (mặc định 300.000 đ/tháng đủ 26 công) — sửa được.' },
    { id: 'salc_an', code: 'HT_AN_TRUA', name: 'Hỗ trợ ăn trưa', kind: 'allowance', amount: 730000, insured: false, taxCap: 730000, active: true, order: 4,
      note: 'Mặc định 730.000 đ/tháng (mức miễn thuế TNCN trước đây; có thể nâng lên 1.200.000 từ 01/07/2026 nếu kế toán xác nhận).' },
    { id: 'salc_perf', code: 'LUONG_HIEU_QUA', name: 'Lương theo hiệu quả công việc', kind: 'performance', amount: '', insured: false, taxCap: '', active: true, order: 9,
      note: 'Phần còn lại = Tổng lương hợp đồng − lương đóng BH − các khoản hỗ trợ. Tính theo công.' },
    { id: 'salc_bhded', code: 'BH_TRU_LUONG', name: 'Trừ phần BH người lao động (10,5%) vào thực lãnh', kind: 'setting', amount: '', insured: false, taxCap: '', active: true, order: 99,
      note: 'Bật: phiếu lương trừ 10,5% × lương đóng BH. Tắt: chỉ hiển thị, không trừ.' }
  ];

  function off(v) { return v === false || String(v).toLowerCase() === 'false'; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function fmt(n) { return (Math.round(Number(n) || 0)).toLocaleString('vi-VN'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // totalMonthly = tổng lương hợp đồng (đủ công); days = số công thực tế. comps = danh mục khoản (TaskManager.getSalaryComponents()).
  function compute(totalMonthly, days, comps) {
    var P = Math.max(0, num(totalMonthly)), STD = LEGAL.stdDays, d = Math.max(0, num(days)), D = Math.min(d, STD), ratio = D / STD;
    var W = Math.round(P / STD * D);
    var deductOn = dedOn(comps);
    comps = (comps || []).filter(function (c) { return !off(c.active); }).sort(function (a, b) { return num(a.order) - num(b.order); });
    var rem = P, items = [], warnings = [], bhBase = 0;
    var bhc = comps.filter(function (c) { return c.kind === 'bh'; })[0];
    comps.forEach(function (c) {
      if (c.kind === 'bh') {
        var full = Math.min(num(c.amount), rem); rem -= full; bhBase = full;
        items.push({ id: c.id, code: c.code, name: c.name, kind: 'bh', full: full, earned: Math.round(full * ratio) });
      } else if (c.kind === 'allowance') {
        var f2 = Math.min(num(c.amount), rem); rem -= f2;
        items.push({ id: c.id, code: c.code, name: c.name, kind: 'allowance', full: f2, earned: Math.round(f2 * ratio), cap: num(c.amount), taxCap: num(c.taxCap) });
        if (num(c.taxCap) > 0 && num(c.amount) > num(c.taxCap)) warnings.push('"' + c.name + '" (' + fmt(c.amount) + ') vượt mức miễn thuế ' + fmt(c.taxCap) + ' — phần vượt tính vào thu nhập chịu thuế TNCN.');
      }
    });
    var perf = comps.filter(function (c) { return c.kind === 'performance'; })[0];
    var sumOther = items.reduce(function (s, x) { return s + x.earned; }, 0);
    if (perf) items.push({ id: perf.id, code: perf.code, name: perf.name, kind: 'performance', full: Math.max(0, rem), earned: Math.max(0, W - sumOther) });
    var workPay = items.reduce(function (s, x) { return s + x.earned; }, 0);
    if (!perf) workPay = W;                                  // không có dòng "hiệu quả": giữ đúng tổng theo công
    if (!items.length) items.push({ id: 'all', code: 'LUONG', name: 'Lương theo ngày công', kind: 'performance', full: P, earned: W });
    var contributes = bhBase > 0 && d >= LEGAL.minDaysBH;
    var bhEmployee = contributes ? Math.round(Math.min(bhBase, LEGAL.maxBase) * LEGAL.empRate) : 0;
    var bhEmployer = contributes ? Math.round(Math.min(bhBase, LEGAL.maxBase) * LEGAL.erRate) : 0;
    if (bhc && num(bhc.amount) > 0 && num(bhc.amount) < LEGAL.minWageRegion1) warnings.push('Lương đóng BH (' + fmt(bhc.amount) + ') thấp hơn lương tối thiểu vùng I ' + fmt(LEGAL.minWageRegion1) + ' — không hợp lệ.');
    else if (bhc && num(bhc.amount) > 0 && num(bhc.amount) < LEGAL.minWageTrained) warnings.push('Lương đóng BH thấp hơn ' + fmt(LEGAL.minWageTrained) + ' (vùng I + 7%): chỉ hợp lệ với lao động CHƯA qua đào tạo.');
    if (bhc && P > 0 && P < num(bhc.amount)) warnings.push('Tổng lương hợp đồng (' + fmt(P) + ') thấp hơn lương đóng BH tối thiểu (' + fmt(bhc.amount) + ').');
    if (bhBase > 0 && d < LEGAL.minDaysBH) warnings.push('Dưới ' + LEGAL.minDaysBH + ' ngày công — không đóng BH tháng này.');
    return { total: P, days: d, usedDays: D, stdDays: STD, ratio: ratio, items: items, workPay: workPay, bhBase: bhBase, bhEmployee: bhEmployee, bhEmployer: bhEmployer, deductBh: deductOn, warnings: warnings, perfFull: Math.max(0, rem) };
  }

  // Phiên bản gọn lưu vào phiếu (cột "Chi tiết cơ cấu lương") để phiếu cũ không đổi khi sau này sửa cơ cấu
  function snapshot(bd, deductOn) {
    return JSON.stringify({ v: 1, std: bd.stdDays, days: bd.usedDays, workPay: bd.workPay, bhBase: bd.bhBase, bhEmployee: bd.bhEmployee, bhEmployer: bd.bhEmployer, ded: deductOn !== false,
      items: bd.items.map(function (x) { return { n: x.name, k: x.kind, f: x.full, e: x.earned }; }) });
  }
  function parseSnapshot(s) {
    if (!s) return null;
    try { var o = typeof s === 'string' ? JSON.parse(s) : s; return o && o.items ? o : null; } catch (e) { return null; }
  }

  function dedOn(comps) {
    var s = (comps || []).filter(function (c) { return c.id === 'salc_bhded' || c.code === 'BH_TRU_LUONG'; })[0];
    return s ? !off(s.active) : true;
  }

  // ---------- giao diện: bảng chi tiết (dùng ở form + phiếu đã gửi) ----------
  function rowsHtml(items, workDaysTxt) {
    return items.map(function (x) {
      return '<div class="pl-breakdown-row"><span>' + esc(x.n || x.name) + ' <span style="color:var(--pl-muted);font-size:.75rem;">' + (workDaysTxt || '') + (x.f != null || x.full != null ? ' · đủ tháng ' + fmt(x.f != null ? x.f : x.full) : '') + '</span></span><span>' + fmt(x.e != null ? x.e : x.earned) + '</span></div>';
    }).join('');
  }

  // ---------- trình soạn danh mục (quản lý) ----------
  var CSS = '#ssOv{position:fixed;inset:0;z-index:600;background:rgba(10,12,15,.55);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow-y:auto}' +
    '#ssOv .ss-box{width:100%;max-width:1080px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);color:var(--color-text)}' +
    '#ssOv .ss-h{display:flex;justify-content:space-between;gap:12px;padding:18px 24px 12px;border-bottom:1px solid var(--color-border)}#ssOv .ss-t{font-size:1.125rem;font-weight:700}#ssOv .ss-s{font-size:.8125rem;color:var(--color-text-muted);margin-top:3px}' +
    '#ssOv .ss-x{background:none;border:none;font-size:1.6rem;line-height:1;color:var(--color-text-faint);cursor:pointer}#ssOv .ss-b{padding:16px 24px 22px}' +
    '#ssOv h4{margin:18px 0 8px;font-size:.8125rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-bronze)}' +
    '#ssOv table{width:100%;border-collapse:collapse;font-size:.8125rem}#ssOv th{text-align:left;font-size:.6875rem;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);padding:6px 6px;border-bottom:1px solid var(--color-border)}#ssOv td{padding:6px;border-bottom:1px solid var(--color-border);vertical-align:top}' +
    '#ssOv input,#ssOv select,#ssOv textarea{width:100%;box-sizing:border-box;padding:7px 9px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:7px;color:var(--color-text);font:400 .8125rem Inter,sans-serif}#ssOv textarea{resize:vertical;min-height:54px}' +
    '#ssOv input:focus,#ssOv textarea:focus,#ssOv select:focus{outline:none;border-color:var(--color-bronze)}#ssOv input[type=checkbox]{width:auto}' +
    '#ssOv .ss-legal{display:grid;gap:8px}#ssOv .ss-legal div{padding:10px 12px;border:1px solid var(--color-border);border-radius:10px;background:var(--color-surface);font-size:.8125rem;line-height:1.5}#ssOv .ss-legal b{display:block;margin-bottom:2px}' +
    '#ssOv .ss-btn{padding:9px 16px;border-radius:9px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text);font:600 .8125rem Inter,sans-serif;cursor:pointer}#ssOv .ss-btn.pri{background:var(--color-bronze);border-color:var(--color-bronze);color:#fff}#ssOv .ss-btn.del{color:#C75B5B}' +
    '#ssOv .ss-f{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}#ssOv .ss-warn{color:#C75B5B;font-size:.75rem;margin-top:6px}#ssOv .ss-form{padding:12px 14px;border:1px dashed var(--color-bronze);border-radius:10px;background:var(--color-surface);font-size:.8125rem;line-height:1.7}' +
    '#ssOv .ss-ex{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:420px;margin-bottom:10px}#ssOv .ss-num{font-family:"JetBrains Mono",monospace;text-align:right}';

  function openEditor(user, onSaved) {
    var TM = global.TaskManager; if (!TM) return;
    var old = document.getElementById('ssOv'); if (old) old.remove();
    if (!document.getElementById('ssCss')) { var st = document.createElement('style'); st.id = 'ssCss'; st.textContent = CSS; document.head.appendChild(st); }
    var rows = TM.getSalaryComponents().map(function (c) { return Object.assign({}, c); });
    var removed = [];
    var ov = document.createElement('div'); ov.id = 'ssOv';
    ov.innerHTML = '<div class="ss-box"><div class="ss-h"><div><div class="ss-t">Cơ cấu lương · bản tổng hợp</div><div class="ss-s">Chia lương hợp đồng thành lương đóng BHXH (tối thiểu vùng I) + các khoản hỗ trợ + lương hiệu quả. Dữ liệu lưu ở Sheet <b>TLCC-Cơ cấu lương</b> — sửa ở đây hoặc trực tiếp trên Sheet đều được.</div></div><button type="button" class="ss-x" data-x aria-label="Đóng">×</button></div>' +
      '<div class="ss-b"><h4>1. Danh mục khoản & mức trần (đủ 26 công)</h4><div id="ssTable"></div><div class="ss-f" style="justify-content:space-between"><button type="button" class="ss-btn" id="ssAdd">+ Thêm khoản hỗ trợ</button><span id="ssWarn" class="ss-warn"></span></div>' +
      '<h4>2. Công thức tính</h4><div class="ss-form"><b>Số công tính lương</b> = min(ngày công thực tế, 26). &nbsp;<b>Tỷ lệ công</b> = số công ÷ 26.<br><b>Mỗi khoản hỗ trợ</b> = mức trần × tỷ lệ công (làm đủ 26 công nhận đủ trần, ví dụ xăng xe 700.000; làm 20 công nhận 700.000 × 20 ÷ 26 = 538.462).<br><b>Lương đóng BH</b> = mức khai báo × tỷ lệ công. &nbsp;<b>Lương hiệu quả</b> = (Tổng lương hợp đồng − lương đóng BH − Σ hỗ trợ) × tỷ lệ công.<br><b>Tổng tiền công</b> = Tổng lương hợp đồng ÷ 26 × số công (không đổi so với cách tính cũ; chỉ chia nhỏ để minh bạch).<br><b>BH người lao động</b> = 10,5% × lương đóng BH (đủ tháng, không theo công; không đóng nếu &lt; 14 công). <b>BH doanh nghiệp đóng thêm</b> = 21,5% × lương đóng BH.<br><b>Thực lãnh</b> = tiền công + OT + hoa hồng + thưởng − khấu trừ − BH người lao động.</div>' +
      '<h4>3. Thử tính nhanh</h4><div class="ss-ex"><div><label style="font-size:.6875rem;color:var(--color-text-muted)">Tổng lương hợp đồng</label><input id="ssExP" class="ss-num" value="15.000.000"></div><div><label style="font-size:.6875rem;color:var(--color-text-muted)">Số công</label><input id="ssExD" class="ss-num" value="26"></div></div><div id="ssEx"></div>' +
      '<h4>4. Cơ sở pháp lý (tham khảo)</h4><div class="ss-legal">' + LEGAL_NOTES.map(function (n) { return '<div><b>' + esc(n[0]) + '</b>' + esc(n[1]) + '</div>'; }).join('') + '</div>' +
      '<div class="ss-f"><button type="button" class="ss-btn" data-x>Đóng</button><button type="button" class="ss-btn pri" id="ssSave">Lưu cơ cấu lương</button></div></div></div>';
    document.body.appendChild(ov);
    var KIND = { bh: 'Lương đóng BH', allowance: 'Hỗ trợ (theo công)', performance: 'Lương hiệu quả (phần còn lại)', setting: 'Thiết lập' };
    function draw() {
      var h = '<table><thead><tr><th>Tên khoản</th><th style="width:150px">Nhóm</th><th style="width:130px">Mức đủ tháng</th><th style="width:110px">Trần miễn thuế</th><th style="width:56px">Bật</th><th style="width:60px">Thứ tự</th><th>Ghi chú / cơ sở pháp lý</th><th style="width:40px"></th></tr></thead><tbody>';
      rows.forEach(function (c, i) {
        var amt = (c.kind === 'performance' || c.kind === 'setting');
        var isDefault = DEFAULTS.some(function (d) { return d.id === c.id; });
        h += '<tr data-i="' + i + '"><td><input data-f="name" value="' + esc(c.name) + '"></td><td>' + (isDefault ? esc(KIND[c.kind] || c.kind) : '<select data-f="kind"><option value="allowance">Hỗ trợ (theo công)</option></select>') + '</td>' +
          '<td>' + (amt ? '<span style="color:var(--color-text-faint)">—</span>' : '<input class="ss-num" data-f="amount" inputmode="numeric" value="' + (c.amount === '' ? '' : fmt(c.amount)) + '">') + '</td>' +
          '<td>' + (c.kind === 'allowance' ? '<input class="ss-num" data-f="taxCap" inputmode="numeric" value="' + (c.taxCap === '' || c.taxCap == null ? '' : fmt(c.taxCap)) + '">' : '') + '</td>' +
          '<td><input type="checkbox" data-f="active"' + (off(c.active) ? '' : ' checked') + '></td><td><input class="ss-num" data-f="order" value="' + esc(c.order) + '"></td>' +
          '<td><textarea data-f="note">' + esc(c.note || '') + '</textarea></td><td>' + (isDefault ? '' : '<button type="button" class="ss-btn del" data-del="' + i + '" title="Xóa khoản">×</button>') + '</td></tr>';
      });
      $('ssTable').innerHTML = h + '</tbody></table>'; recalc();
    }
    function $(id) { return ov.querySelector('#' + id); }
    function readRows() {
      ov.querySelectorAll('#ssTable tr[data-i]').forEach(function (tr) {
        var c = rows[Number(tr.getAttribute('data-i'))];
        tr.querySelectorAll('[data-f]').forEach(function (el) {
          var f = el.getAttribute('data-f');
          if (f === 'active') c.active = el.checked;
          else if (f === 'amount' || f === 'taxCap') c[f] = el.value.replace(/[^\d]/g, '') === '' ? '' : Number(el.value.replace(/[^\d]/g, ''));
          else if (f === 'order') c.order = Number(el.value) || 0;
          else c[f] = el.value;
        });
      });
    }
    function recalc() {
      readRows();
      var w = [];
      rows.forEach(function (c) {
        if (c.kind === 'bh' && !off(c.active)) { if (num(c.amount) < LEGAL.minWageRegion1) w.push('Lương đóng BH phải ≥ ' + fmt(LEGAL.minWageRegion1) + ' (vùng I).'); else if (num(c.amount) < LEGAL.minWageTrained) w.push('Dưới ' + fmt(LEGAL.minWageTrained) + ' chỉ hợp lệ với lao động chưa qua đào tạo.'); if (num(c.amount) > LEGAL.maxBase) w.push('Vượt trần đóng BH ' + fmt(LEGAL.maxBase) + '.'); }
        if (c.kind === 'allowance' && !c.name.trim()) w.push('Có khoản chưa đặt tên.');
      });
      $('ssWarn').textContent = w.join(' ');
      var P = Number(($('ssExP').value || '').replace(/[^\d]/g, '')) || 0, D = Number($('ssExD').value) || 0;
      var bd = compute(P, D, rows);
      $('ssEx').innerHTML = '<table><thead><tr><th>Khoản</th><th class="ss-num" style="text-align:right">Đủ tháng</th><th style="text-align:right">Theo ' + bd.usedDays + '/' + bd.stdDays + ' công</th></tr></thead><tbody>' +
        bd.items.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="ss-num">' + fmt(x.full) + '</td><td class="ss-num">' + fmt(x.earned) + '</td></tr>'; }).join('') +
        '<tr><td><b>Tổng tiền công</b></td><td class="ss-num">' + fmt(P) + '</td><td class="ss-num"><b>' + fmt(bd.workPay) + '</b></td></tr>' +
        '<tr><td>BH người lao động 10,5% × ' + fmt(bd.bhBase) + '</td><td></td><td class="ss-num">− ' + fmt(bd.bhEmployee) + '</td></tr>' +
        '<tr><td>BH doanh nghiệp đóng thêm 21,5%</td><td></td><td class="ss-num">' + fmt(bd.bhEmployer) + '</td></tr></tbody></table>' +
        (bd.warnings.length ? '<div class="ss-warn">' + bd.warnings.map(esc).join('<br>') + '</div>' : '');
    }
    draw();
    ov.addEventListener('input', function (e) { if (e.target.matches('[data-f],#ssExP,#ssExD')) recalc(); });
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]') || e.target === ov) { ov.remove(); return; }
      var d = e.target.closest('[data-del]');
      if (d) { readRows(); var r = rows.splice(Number(d.getAttribute('data-del')), 1)[0]; removed.push(r); draw(); return; }
      if (e.target.closest('#ssAdd')) { readRows(); rows.push({ id: 'salc_' + Date.now(), code: 'HT_KHAC', name: 'Hỗ trợ khác', kind: 'allowance', amount: 0, insured: false, taxCap: '', active: true, order: 5, note: 'Ghi thành mục riêng trong hợp đồng lao động.', _new: true }); draw(); return; }
      if (e.target.closest('#ssSave')) {
        readRows();
        var bh = rows.filter(function (c) { return c.kind === 'bh' && !off(c.active); })[0];
        if (bh && num(bh.amount) < LEGAL.minWageRegion1) { alert('Lương đóng BH phải ≥ lương tối thiểu vùng I (' + fmt(LEGAL.minWageRegion1) + ').'); return; }
        if (rows.some(function (c) { return c.kind === 'allowance' && !String(c.name).trim(); })) { alert('Có khoản hỗ trợ chưa đặt tên.'); return; }
        var ok = TM.saveSalaryComponents(rows, removed, user);
        if (!ok) { alert('Không lưu được (cần quyền quản lý).'); return; }
        ov.remove(); if (onSaved) onSaved();
      }
    });
  }

  global.SalaryStructure = { LEGAL: LEGAL, LEGAL_NOTES: LEGAL_NOTES, DEFAULTS: DEFAULTS, compute: compute, snapshot: snapshot, parseSnapshot: parseSnapshot, dedOn: dedOn, rowsHtml: rowsHtml, openEditor: openEditor, fmt: fmt };
})(window);
