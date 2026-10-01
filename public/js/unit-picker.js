/* UnitPicker — ô "Đơn vị" có bảng đơn vị mẫu của ngành xây dựng / thiết kế nội thất: bấm vào ô là xổ danh sách, gõ 1-2 chữ là lọc (không cần dấu, hiểu cả tên gọi khác:
   "m2", "mét vuông", "met vuong", "cong", "bo"…), ↑↓ + Enter hoặc bấm chuột để chọn. Vẫn gõ tự do được đơn vị không có trong bảng. Dùng ở orders.html. */
(function (global) {
  'use strict';

  // [đơn vị, tên đầy đủ / ghi chú, nhóm, từ khoá thêm]
  var UNITS = [
    // --- Diện tích ---
    ['m2', 'Mét vuông', 'Diện tích', 'met vuong m vuong'],
    ['m2 sàn', 'Mét vuông sàn xây dựng', 'Diện tích', 'san xay dung dien tich san'],
    ['m2 sàn quy đổi', 'Mét vuông sàn quy đổi (móng, mái, sân…)', 'Diện tích', 'quy doi'],
    ['m2 thông thủy', 'Diện tích thông thủy', 'Diện tích', 'thong thuy'],
    ['m2 VL', 'Mét vuông vật liệu (đã gồm hao hụt)', 'Diện tích', 'vat lieu hao hut'],
    ['m2 mặt dựng', 'Mét vuông mặt dựng / mặt đứng', 'Diện tích', 'mat dung mat dung facade'],
    ['m2 thiết kế', 'Mét vuông thiết kế (tính phí thiết kế)', 'Diện tích', 'thiet ke phi'],
    ['m2 tường', 'Mét vuông tường', 'Diện tích', 'tuong'],
    ['m2 trần', 'Mét vuông trần', 'Diện tích', 'tran'],
    ['m2 sơn', 'Mét vuông bề mặt sơn', 'Diện tích', 'son be mat'],
    ['m2 kính', 'Mét vuông kính', 'Diện tích', 'kinh'],
    ['m2 cửa', 'Mét vuông cửa', 'Diện tích', 'cua'],
    ['m2/tháng', 'Mét vuông trên tháng (thuê cốp pha, giàn giáo…)', 'Diện tích', 'thang thue'],
    ['ha', 'Héc-ta', 'Diện tích', 'hecta'],
    // --- Chiều dài ---
    ['m', 'Mét', 'Chiều dài', 'met'],
    ['md', 'Mét dài', 'Chiều dài', 'met dai m dai'],
    ['m dài', 'Mét dài', 'Chiều dài', 'md'],
    ['cm', 'Xen-ti-mét', 'Chiều dài', 'xenti'],
    ['mm', 'Mi-li-mét', 'Chiều dài', 'mili'],
    ['km', 'Ki-lô-mét', 'Chiều dài', 'kilomet'],
    ['m dầm', 'Mét dài dầm', 'Chiều dài', 'dam'],
    ['m ống', 'Mét dài ống', 'Chiều dài', 'ong'],
    ['m dây', 'Mét dài dây', 'Chiều dài', 'day cap'],
    // --- Thể tích ---
    ['m3', 'Mét khối', 'Thể tích', 'met khoi m khoi'],
    ['m3 bê tông', 'Mét khối bê tông', 'Thể tích', 'be tong'],
    ['m3 đất', 'Mét khối đất', 'Thể tích', 'dat dao'],
    ['m3 gỗ', 'Mét khối gỗ', 'Thể tích', 'go'],
    ['lít', 'Lít', 'Thể tích', 'lit l'],
    ['ml', 'Mi-li-lít', 'Thể tích', 'mili lit'],
    // --- Khối lượng ---
    ['kg', 'Ki-lô-gam', 'Khối lượng', 'kilogam ki lo'],
    ['tấn', 'Tấn', 'Khối lượng', 'tan'],
    ['g', 'Gam', 'Khối lượng', 'gram'],
    ['tạ', 'Tạ (100 kg)', 'Khối lượng', 'ta'],
    // --- Số lượng / đóng gói ---
    ['cái', 'Cái', 'Số lượng', 'cai'],
    ['chiếc', 'Chiếc', 'Số lượng', 'chiec'],
    ['bộ', 'Bộ', 'Số lượng', 'bo'],
    ['cây', 'Cây', 'Số lượng', 'cay'],
    ['tấm', 'Tấm', 'Số lượng', 'tam'],
    ['viên', 'Viên', 'Số lượng', 'vien gach'],
    ['thanh', 'Thanh', 'Số lượng', 'thanh'],
    ['cuộn', 'Cuộn', 'Số lượng', 'cuon'],
    ['tờ', 'Tờ', 'Số lượng', 'to'],
    ['quả', 'Quả', 'Số lượng', 'qua'],
    ['con', 'Con (con tán, con lăn…)', 'Số lượng', 'con'],
    ['đôi', 'Đôi', 'Số lượng', 'doi'],
    ['cặp', 'Cặp', 'Số lượng', 'cap'],
    ['bao', 'Bao', 'Đóng gói', 'bao xi mang'],
    ['bao 25kg', 'Bao 25 kg', 'Đóng gói', 'bao 25'],
    ['bao 40kg', 'Bao 40 kg', 'Đóng gói', 'bao 40 bot ba'],
    ['bao 50kg', 'Bao 50 kg', 'Đóng gói', 'bao 50 xi mang'],
    ['thùng', 'Thùng', 'Đóng gói', 'thung son'],
    ['thùng 5L', 'Thùng 5 lít', 'Đóng gói', 'thung 5'],
    ['thùng 18L', 'Thùng 18 lít', 'Đóng gói', 'thung 18 son'],
    ['lon', 'Lon', 'Đóng gói', 'lon'],
    ['hộp', 'Hộp', 'Đóng gói', 'hop'],
    ['gói', 'Gói', 'Đóng gói', 'goi'],
    ['can', 'Can', 'Đóng gói', 'can'],
    ['chai', 'Chai', 'Đóng gói', 'chai'],
    ['tuýp', 'Tuýp', 'Đóng gói', 'tuyp silicon'],
    ['lọ', 'Lọ', 'Đóng gói', 'lo'],
    ['bộ/25kg', 'Bộ 25 kg (2 thành phần)', 'Đóng gói', 'bo 25kg chong tham'],
    ['kiện', 'Kiện', 'Đóng gói', 'kien'],
    ['pallet', 'Pallet', 'Đóng gói', 'pa let'],
    ['xe', 'Xe (chuyến xe)', 'Đóng gói', 'xe chuyen van chuyen'],
    ['chuyến', 'Chuyến', 'Đóng gói', 'chuyen van chuyen'],
    // --- Thiết bị / công trình ---
    ['điểm', 'Điểm (điện, nước, mạng…)', 'Thiết bị / công trình', 'diem'],
    ['vị trí', 'Vị trí', 'Thiết bị / công trình', 'vi tri'],
    ['phòng', 'Phòng', 'Thiết bị / công trình', 'phong'],
    ['tầng', 'Tầng', 'Thiết bị / công trình', 'tang'],
    ['căn', 'Căn (nhà, căn hộ)', 'Thiết bị / công trình', 'can ho nha'],
    ['trục', 'Trục', 'Thiết bị / công trình', 'truc'],
    ['cột', 'Cột', 'Thiết bị / công trình', 'cot'],
    ['bậc', 'Bậc (cầu thang)', 'Thiết bị / công trình', 'bac cau thang'],
    ['cánh', 'Cánh (cửa)', 'Thiết bị / công trình', 'canh cua'],
    ['ô', 'Ô (ô cửa, ô vách)', 'Thiết bị / công trình', 'o'],
    ['máy', 'Máy', 'Thiết bị / công trình', 'may'],
    ['dàn', 'Dàn (dàn lạnh, dàn nóng)', 'Thiết bị / công trình', 'dan'],
    ['hệ', 'Hệ (hệ thống)', 'Thiết bị / công trình', 'he thong'],
    ['hệ thống', 'Hệ thống', 'Thiết bị / công trình', 'he'],
    ['hạng mục', 'Hạng mục', 'Thiết bị / công trình', 'hang muc'],
    ['lô', 'Lô', 'Thiết bị / công trình', 'lo'],
    // --- Nhân công / thời gian ---
    ['công', 'Công (ngày công)', 'Nhân công / thời gian', 'cong ngay cong'],
    ['ngày công', 'Ngày công', 'Nhân công / thời gian', 'cong'],
    ['giờ', 'Giờ', 'Nhân công / thời gian', 'gio'],
    ['ca', 'Ca (ca máy, ca làm việc)', 'Nhân công / thời gian', 'ca may'],
    ['ca máy', 'Ca máy', 'Nhân công / thời gian', 'may'],
    ['ngày', 'Ngày', 'Nhân công / thời gian', 'ngay'],
    ['tuần', 'Tuần', 'Nhân công / thời gian', 'tuan'],
    ['tháng', 'Tháng', 'Nhân công / thời gian', 'thang'],
    ['quý', 'Quý', 'Nhân công / thời gian', 'quy'],
    ['năm', 'Năm', 'Nhân công / thời gian', 'nam'],
    ['cây/tháng', 'Cây trên tháng (thuê cây chống)', 'Nhân công / thời gian', 'thue cay chong'],
    ['bộ/tháng', 'Bộ trên tháng (thuê giàn giáo)', 'Nhân công / thời gian', 'thue gian giao'],
    ['người', 'Người', 'Nhân công / thời gian', 'nguoi nhan su'],
    // --- Thiết kế / hồ sơ ---
    ['bộ hồ sơ', 'Bộ hồ sơ thiết kế', 'Thiết kế / hồ sơ', 'ho so thiet ke'],
    ['bản vẽ', 'Bản vẽ', 'Thiết kế / hồ sơ', 'ban ve'],
    ['bộ bản vẽ', 'Bộ bản vẽ', 'Thiết kế / hồ sơ', 'ban ve'],
    ['mặt bằng', 'Mặt bằng', 'Thiết kế / hồ sơ', 'mat bang'],
    ['phối cảnh', 'Phối cảnh 3D', 'Thiết kế / hồ sơ', 'phoi canh 3d'],
    ['view', 'View (góc nhìn phối cảnh)', 'Thiết kế / hồ sơ', 'goc nhin phoi canh'],
    ['concept', 'Concept thiết kế', 'Thiết kế / hồ sơ', 'y tuong'],
    ['lần chỉnh sửa', 'Lần chỉnh sửa', 'Thiết kế / hồ sơ', 'chinh sua revision'],
    ['buổi', 'Buổi (tư vấn, giám sát, khảo sát)', 'Thiết kế / hồ sơ', 'buoi tu van giam sat'],
    ['lần', 'Lần', 'Thiết kế / hồ sơ', 'lan'],
    ['đợt', 'Đợt (thanh toán theo đợt)', 'Thiết kế / hồ sơ', 'dot thanh toan'],
    ['giai đoạn', 'Giai đoạn', 'Thiết kế / hồ sơ', 'giai doan'],
    // --- Tính tiền ---
    ['trọn gói', 'Trọn gói', 'Tính tiền', 'tron goi khoan'],
    ['khoán', 'Khoán', 'Tính tiền', 'khoan tron goi'],
    ['tạm tính', 'Tạm tính', 'Tính tiền', 'tam tinh'],
    ['%', 'Phần trăm (phí theo % giá trị)', 'Tính tiền', 'phan tram phi'],
    ['VNĐ', 'Đồng', 'Tính tiền', 'vnd dong']
  ];

  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  UNITS.forEach(function (u) { u._k = norm(u[0]); u._h = u._k + ' ' + norm(u[1]) + ' ' + norm(u[3] || ''); });

  function search(q) {
    var nq = norm(q).trim();
    if (!nq) return UNITS.slice();
    var toks = nq.split(/\s+/), res = [];
    UNITS.forEach(function (u) {
      for (var i = 0; i < toks.length; i++) if (u._h.indexOf(toks[i]) === -1) return;
      var s = 0; if (u._k === nq) s += 10; else if (u._k.indexOf(nq) === 0) s += 6; else if (u._h.indexOf(nq) === 0) s += 3; else s += 1;
      res.push({ u: u, s: s - u._k.length / 100 });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.map(function (x) { return x.u; });
  }

  var CSS = '#upPop{position:fixed;z-index:810;max-height:330px;overflow-y:auto;background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.35);font:400 .8125rem Inter,sans-serif;color:var(--color-text);padding:4px;min-width:260px}' +
    '#upPop .gh{padding:8px 10px 3px;font-size:.625rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted)}' +
    '#upPop .it{display:flex;align-items:baseline;gap:10px;padding:6px 10px;border-radius:8px;cursor:pointer}#upPop .it.on,#upPop .it:hover{background:color-mix(in srgb,var(--color-bronze) 14%,transparent)}' +
    '#upPop .u{font-family:"JetBrains Mono",monospace;font-weight:600;color:var(--color-bronze);min-width:74px}#upPop .n{color:var(--color-text-muted);font-size:.75rem}#upPop .em{padding:10px;color:var(--color-text-muted);font-size:.75rem}';

  function attach(opts) {
    if (!document.getElementById('upCss')) { var st = document.createElement('style'); st.id = 'upCss'; st.textContent = CSS; document.head.appendChild(st); }
    var sel = opts.selector || '[data-i="unit"]', box = null, cur = -1, list = [], input = null;
    function close() { if (box) { box.remove(); box = null; } cur = -1; }
    function draw(showAll) {
      if (!input) return;
      var q = showAll ? '' : input.value;
      list = search(q);
      if (!box) { box = document.createElement('div'); box.id = 'upPop'; document.body.appendChild(box); }
      var r = input.getBoundingClientRect();
      box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + 'px';
      var below = window.innerHeight - r.bottom, up = below < 240 && r.top > below;
      box.style.top = up ? 'auto' : (r.bottom + 4) + 'px'; box.style.bottom = up ? (window.innerHeight - r.top + 4) + 'px' : 'auto';
      if (!list.length) { box.innerHTML = '<div class="em">Không có trong bảng — cứ gõ đơn vị của bạn.</div>'; return; }
      var html = '', lastG = '', grouped = !String(q).trim();
      list.forEach(function (u, i) {
        if (grouped && u[2] !== lastG) { lastG = u[2]; html += '<div class="gh">' + esc(u[2]) + '</div>'; }
        html += '<div class="it' + (i === cur ? ' on' : '') + '" data-i="' + i + '"><span class="u">' + esc(u[0]) + '</span><span class="n">' + esc(u[1]) + '</span></div>';
      });
      box.innerHTML = html;
      var on = box.querySelector('.it.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function pick(i) {
      var u = list[i]; if (!u || !input) return;
      input.value = u[0]; input.dispatchEvent(new Event('input', { bubbles: true }));
      var tr = input.closest('tr'); close();
      if (opts.onPick) opts.onPick(input, u[0]);
      var q = tr && tr.querySelector('[data-i="qty"]'); if (q) { q.focus(); q.select(); }
    }
    opts.container.addEventListener('focusin', function (e) { if (e.target.matches(sel)) { input = e.target; cur = -1; draw(!input.value.trim()); } });
    opts.container.addEventListener('click', function (e) { if (e.target.matches(sel)) { input = e.target; if (!box) draw(!input.value.trim()); } });
    opts.container.addEventListener('input', function (e) { if (e.target.matches(sel)) { input = e.target; cur = list.length && String(input.value).trim() ? 0 : -1; draw(false); } });
    opts.container.addEventListener('keydown', function (e) {
      if (!e.target.matches(sel)) return;
      if (!box && (e.key === 'ArrowDown')) { input = e.target; draw(!input.value.trim()); e.preventDefault(); return; }
      if (!box) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(list.length - 1, cur + 1); draw(!input.value.trim() && cur < 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); draw(false); }
      else if (e.key === 'Enter' && cur >= 0) { e.preventDefault(); pick(cur); }
      else if (e.key === 'Tab' && cur >= 0 && String(input.value).trim()) { pick(cur); }
      else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('mousedown', function (e) {
      var it = e.target.closest && e.target.closest('#upPop .it');
      if (it) { e.preventDefault(); pick(Number(it.getAttribute('data-i'))); return; }
      if (box && !(e.target.matches && e.target.matches(sel))) close();
    });
    window.addEventListener('scroll', function (e) { if (box && !(e.target && e.target.id === 'upPop')) draw(!input.value.trim()); }, true);
    return { close: close };
  }

  global.UnitPicker = { attach: attach, search: search, UNITS: UNITS };
})(window);
