/**
 * Quản lý tài sản & vật tư nội bộ — equipment.html. Dữ liệu ở TaskManager (sheet TB-Thiết bị).
 * 2026-09-29: mở rộng từ "thiết bị văn phòng" thành toàn bộ tài sản hữu hình: văn phòng phẩm, dụng cụ đo đạc, máy móc thi công,
 * giàn giáo & cốp pha, bảo hộ lao động, nội thất. Nhóm tính theo SỐ LƯỢNG (supply: true) có phân bổ theo vị trí (`stock` JSON)
 * và lịch sử nhập/xuất/điều chuyển (`history` JSON).
 * Mỗi thiết bị có danh sách linh kiện/thông số `specs` (JSON mảng {type,name,spec,qty}).
 * Mọi thành viên đăng nhập xem được; CEO/quản lý thêm/sửa/xóa (TaskManager.canManageEquipment).
 */
(function () {
  'use strict';
  var TM = window.TaskManager;
  var $ = function (id) { return document.getElementById(id); };

  // Nhóm chính + mẫu linh kiện/thông số gợi ý cho từng nhóm
  var CATS = [
    { name: 'Máy tính', prefix: 'MT', icon: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4" stroke-linecap="round"/>',
      defaultParts: ['Bàn phím', 'Chuột'],  // luôn có sẵn dòng trống cho 2 loại này, không cần bấm "Điền mẫu theo nhóm"
      tpl: [['CPU', 'Intel Core i7-13700 / AMD Ryzen 7…', '16 nhân 24 luồng, 2.1–5.2GHz'], ['Mainboard', '', 'Socket, chipset, khe RAM'], ['RAM', '', 'DDR4/DDR5, dung lượng, bus'], ['SSD', '', 'NVMe/SATA, dung lượng'], ['HDD', '', 'Dung lượng, tốc độ vòng quay'],
        ['VGA / Card đồ họa', '', 'VRAM, dòng card'], ['Nguồn (PSU)', '', 'Công suất, chuẩn 80 Plus'], ['Vỏ case', '', ''], ['Tản nhiệt', '', 'Khí / nước'], ['Màn hình', '', 'Kích thước, độ phân giải, tần số quét'],
        ['Bàn phím', '', ''], ['Chuột', '', ''], ['Card mạng / Wifi', '', ''], ['Hệ điều hành', 'Windows 11 Pro', 'Bản quyền / key']] },
    { name: 'Máy in – Photo', prefix: 'MI', icon: '<path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" stroke-linecap="round"/><rect x="7" y="14" width="10" height="6" rx="1"/>',
      tpl: [['Loại máy', 'In / Photo / Scan / Fax', 'Đen trắng hoặc màu, laser/phun'], ['Chức năng', '', 'In · Copy · Scan · Fax'], ['Khổ giấy tối đa', '', 'A4 / A3'], ['Tốc độ', '', 'trang/phút'], ['Độ phân giải', '', 'dpi'],
        ['Kết nối', '', 'USB · LAN · Wifi'], ['Hộp mực / Drum', '', 'Mã mực, năng suất trang'], ['Khay giấy', '', 'Số khay, sức chứa'], ['Bộ đếm bản in', '', 'Số trang đã in / ngày ghi']] },
    { name: 'Vật tư', prefix: 'VT', supply: true, icon: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8" stroke-linecap="round"/>',
      tpl: [['Loại vật tư', 'Mực in / Giấy / Dây mạng / Pin…', ''], ['Quy cách', '', 'Kích thước, dung lượng, màu…'], ['Dùng cho thiết bị', '', 'Model máy tương thích']] },
    { name: 'Thiết bị mạng', prefix: 'MG', icon: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M12 12l-6 5M12 12l6 5" stroke-linecap="round"/>',
      tpl: [['Loại', 'Router / Switch / Access Point / Camera NVR', ''], ['Số cổng', '', 'LAN / PoE'], ['Tốc độ', '', '100Mbps / 1Gbps'], ['Chuẩn Wifi', '', 'Wifi 5 / 6'], ['Địa chỉ IP quản trị', '', 'IP, tài khoản (không ghi mật khẩu)']] },
    { name: 'Màn hình & ngoại vi', prefix: 'MH', icon: '<rect x="4" y="3" width="16" height="11" rx="1.5"/><path d="M9 21h6M12 14v7" stroke-linecap="round"/>',
      tpl: [['Loại', 'Màn hình / Máy chiếu / Loa / Webcam / UPS', ''], ['Kích thước', '', 'inch'], ['Độ phân giải', '', 'FHD / 2K / 4K'], ['Tần số quét', '', 'Hz'], ['Cổng kết nối', '', 'HDMI · DP · USB-C']] },
    { name: 'Văn phòng phẩm', prefix: 'VPP', supply: true, unit: 'cái', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-linecap="round" stroke-linejoin="round"/>',
      names: ['Bút bi', 'Bút chì', 'Bút dạ quang', 'Bút lông bảng', 'Giấy A4', 'Giấy A3', 'Sổ tay', 'Kẹp giấy', 'Ghim bấm', 'Băng keo', 'Hồ dán', 'Cặp file', 'Bìa còng', 'Kéo', 'Dao rọc giấy', 'Thước kẻ'],
      tpl: [['Loại', 'Bút bi / Bút chì / Giấy / Sổ / Băng keo…', ''], ['Quy cách', '', 'Màu, cỡ ngòi, khổ giấy, định lượng…'], ['Nhãn hiệu', '', '']] },
    { name: 'Dụng cụ đo đạc', prefix: 'DD', unit: 'cái', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5"/>',
      names: ['Máy thủy bình', 'Máy cân bằng laser', 'Máy toàn đạc', 'Máy đo khoảng cách laser', 'Thước laser', 'Thước dây', 'Mia', 'Chân máy', 'Ni vô', 'Máy dò cốt thép'],
      tpl: [['Loại máy', 'Thủy bình / Cân bằng laser / Toàn đạc / Đo khoảng cách laser', ''], ['Độ chính xác', '', '± mm trên bao nhiêu m'], ['Tầm hoạt động', '', 'm'], ['Nguồn / Pin', '', ''], ['Phụ kiện đi kèm', 'Chân máy, mia, hộp, sạc…', ''],
        ['Hiệu chuẩn lần cuối', '', 'dd/mm/yyyy'], ['Hạn hiệu chuẩn tiếp theo', '', 'dd/mm/yyyy']] },
    { name: 'Máy móc & dụng cụ thi công', prefix: 'MM', unit: 'cái', icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke-linecap="round" stroke-linejoin="round"/>',
      names: ['Máy khoan', 'Máy khoan bê tông', 'Máy cắt', 'Máy mài', 'Máy hàn', 'Máy nén khí', 'Máy bơm nước', 'Máy đục', 'Máy cưa', 'Máy trộn', 'Máy phát điện'],
      tpl: [['Loại máy', 'Khoan / Cắt / Mài / Hàn / Nén khí / Bơm…', ''], ['Công suất', '', 'W / HP'], ['Điện áp', '', '220V / 380V'], ['Phụ kiện đi kèm', 'Mũi khoan, đĩa cắt, pin, sạc…', ''], ['Tình trạng bảo dưỡng', '', 'Ngày bảo dưỡng gần nhất']] },
    { name: 'Giàn giáo & cốp pha', prefix: 'GG', supply: true, unit: 'bộ', icon: '<path d="M4 3v18M12 3v18M20 3v18M4 8h16M4 14h16M4 20h16" stroke-linecap="round"/><path d="M4 8l8 6M12 8l8 6" stroke-linecap="round"/>',
      names: ['Khung giàn giáo', 'Mâm giàn giáo', 'Thang giàn giáo', 'Thanh giằng chéo', 'Kích chân giàn giáo', 'Kích đầu giàn giáo', 'Cây chống tăng', 'Ván khuôn thép', 'Ván khuôn gỗ phủ phim', 'Ván khuôn nhôm', 'Xà gồ', 'Chân đế', 'Khóa giằng'],
      tpl: [['Loại', 'Khung / Mâm / Thang / Chéo / Kích / Cây chống / Ván khuôn…', ''], ['Kích thước', '', 'Cao × rộng × dày (m / mm)'], ['Vật liệu', 'Thép mạ kẽm / Thép sơn / Gỗ phủ phim / Nhôm', ''], ['Tải trọng cho phép', '', 'kg/m²'], ['Nguồn gốc', 'Mua / Thuê ngoài', 'Tên đơn vị cho thuê nếu thuê']] },
    { name: 'Bảo hộ lao động', prefix: 'BH', supply: true, unit: 'cái', icon: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke-linecap="round" stroke-linejoin="round"/>',
      names: ['Mũ bảo hộ', 'Giày bảo hộ', 'Kính bảo hộ', 'Găng tay', 'Dây an toàn', 'Áo phản quang', 'Khẩu trang', 'Nút tai chống ồn'],
      tpl: [['Loại', 'Mũ / Giày / Kính / Găng tay / Dây an toàn…', ''], ['Cỡ / Size', '', ''], ['Tiêu chuẩn', '', 'TCVN / EN…']] },
    { name: 'Nội thất văn phòng', prefix: 'NT', supply: true, unit: 'cái', icon: '<path d="M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M3 11h18v4H3zM6 15v5M18 15v5" stroke-linecap="round" stroke-linejoin="round"/>',
      names: ['Bàn làm việc', 'Ghế văn phòng', 'Tủ hồ sơ', 'Kệ', 'Bàn họp', 'Ghế họp', 'Tủ locker', 'Bảng trắng'],
      tpl: [['Loại', 'Bàn / Ghế / Tủ / Kệ…', ''], ['Kích thước', '', 'D × R × C (mm)'], ['Chất liệu', '', 'Gỗ / Sắt / Nhôm / Da…']] },
    { name: 'Thiết bị khác', prefix: 'K', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke-linecap="round"/>',
      tpl: [['Loại', 'Điện thoại / Điều hòa / Camera / Máy hủy giấy…', ''], ['Công suất', '', ''], ['Kích thước', '', '']] }
  ];
  var STATUSES = ['Đang dùng', 'Dự phòng', 'Đang sửa', 'Hỏng', 'Thanh lý'];
  // Đơn vị tính chuẩn (dropdown) — PHẢI khớp EQUIPMENT_UNITS trong gsheets-api-v2.js (dropdown trên Sheet). Chọn "Khác…" để nhập đơn vị riêng.
  var UNITS = ['cái', 'chiếc', 'bộ', 'cặp', 'đôi', 'hộp', 'thùng', 'cây', 'cuộn', 'ram', 'tờ', 'quyển', 'chai', 'lọ', 'gói', 'túi', 'bao', 'kg', 'lít', 'm', 'm²', 'm³', 'tấm', 'thanh', 'viên'];
  // 2026-10-03: Tình trạng + Đơn vị tính lấy từ sheet TT-Danh mục (sửa tại chỗ để mọi chỗ đang giữ 2 mảng này đều thấy); chưa tải được thì dùng danh sách mặc định ở trên
  function syncCatalog() {
    if (!TM || !TM.getCatalog) return;
    [[STATUSES, 'equipStatus'], [UNITS, 'equipUnit']].forEach(function (p) { var c = TM.getCatalog(p[1], []); if (c.length) { p[0].length = 0; Array.prototype.push.apply(p[0], c); } });
  }
  var EMPTY_CAT = { name: '', prefix: '', tpl: [] };   // form "Thêm mới" chưa chọn nhóm — chưa hiện gì theo nhóm
  // Icon cảnh báo dùng chung toàn app (giống overdue task ở projects.js) — không dùng emoji
  var WARN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;flex-shrink:0;vertical-align:-2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  var STATUS_CLS = { 'Đang dùng': 'ok', 'Dự phòng': 'mute', 'Đang sửa': 'warn', 'Hỏng': 'bad', 'Thanh lý': 'mute' };
  var WARN_DAYS = 60;
  var state = { view: 'groups', q: '', cat: '', status: '', editingId: null, specs: [], pcId: '', stock: [], history: [], prevCat: '' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }
  function money(n) { n = num(n); return n ? n.toLocaleString('vi-VN') + ' ₫' : ''; }
  function moneyShort(n) { n = num(n); if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ'; if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr'; return n ? n.toLocaleString('vi-VN') : '0'; }
  function fmtDate(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
  function user() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function canManage() { return !!(TM && TM.canManageEquipment && TM.canManageEquipment(user())); }
  function toast(msg, bad) { var t = document.createElement('div'); t.className = 'eq-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function memberName(id) { var m = TM.getMember ? TM.getMember(id) : null; return m ? (m.name || id) : (id || ''); }
  function formCat(name) { return name ? catOf(name) : EMPTY_CAT; }
  function catOf(name) { for (var i = 0; i < CATS.length; i++) if (CATS[i].name === name) return CATS[i]; return CATS[CATS.length - 1]; }
  function parseSpecs(e) { try { var a = typeof e.specs === 'string' ? JSON.parse(e.specs || '[]') : (e.specs || []); return Array.isArray(a) ? a : []; } catch (x) { return []; } }
  function daysTo(d) { if (!d) return null; var t = new Date(String(d).slice(0, 10) + 'T00:00:00').getTime(); return isNaN(t) ? null : Math.ceil((t - new Date().setHours(0, 0, 0, 0)) / 86400000); }
  function warrantyState(e) { var d = daysTo(e.warrantyUntil); if (d == null) return null; return d < 0 ? 'expired' : d <= WARN_DAYS ? 'soon' : 'ok'; }
  function isSupply(e) { return catOf(e.category).supply; }
  // Phân bổ tồn kho theo vị trí (kho, văn phòng, từng công trình…) — JSON mảng {loc, qty}
  function stockRows(e) { return jparse(e.stock).map(function (r) { return { loc: String(r.loc || '').trim(), qty: num(r.qty) }; }).filter(function (r) { return r.loc; }); }
  function stockTotal(rows) { return rows.reduce(function (s, r) { return s + num(r.qty); }, 0); }
  function historyOf(e) { return jparse(e.history); }
  var DEFAULT_LOC = 'Kho công ty';
  function totalQty(e) { var rows = stockRows(e); return rows.length ? stockTotal(rows) : num(e.qty); }
  function fmtDT(iso) { var d = new Date(iso); if (isNaN(d)) return ''; var p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function locSuggestions() {
    var set = {}; set[DEFAULT_LOC] = 1; set['Văn phòng'] = 1;
    try { (TM.getProjects ? TM.getProjects() : []).forEach(function (p) { if (p && p.name) set['Công trình: ' + p.name] = 1; }); } catch (x) { /* bỏ qua */ }
    TM.getEquipment().forEach(function (e) { if (e.location) set[e.location] = 1; stockRows(e).forEach(function (r) { set[r.loc] = 1; }); });
    return Object.keys(set);
  }
  function lowStock(e) { return isSupply(e) && String(e.minQty || '') !== '' && totalQty(e) <= num(e.minQty); }

  // ---- Máy tính đã cài HICONIQUE Agent báo cấu hình (sheet TB-Máy đã báo) ----
  function jparse(v) { try { var a = typeof v === 'string' ? JSON.parse(v || '[]') : (v || []); return Array.isArray(a) ? a : []; } catch (x) { return []; } }
  function reports() { return TM.getPcReports ? TM.getPcReports() : []; }
  function reportById(id) { return id ? reports().filter(function (r) { return r.id === id; })[0] || null : null; }
  function rSpecs(r) { return jparse(r.specs).map(function (s) { return { type: s.type || '', name: s.name || '', spec: s.spec || '', qty: s.qty || '1' }; }); }
  function specKey(list, types) {
    return list.filter(function (s) { return types[s.type]; }).map(function (s) { return [s.type, s.name, s.spec, String(s.qty || '1')].join('|').toLowerCase(); }).sort().join('\n');
  }
  function reportTypes(r) { var t = {}; rSpecs(r).forEach(function (s) { t[s.type] = true; }); return t; }
  function pcDiff(e) {
    var r = reportById(e.pcId); if (!r) return false;
    var types = reportTypes(r);
    return specKey(parseSpecs(e), types) !== specKey(rSpecs(r), types);
  }
  function pcAlerts(e) { var r = reportById(e.pcId); return r ? jparse(r.alerts) : []; }
  function unlinkedReports() {
    var linked = {}; TM.getEquipment().forEach(function (e) { if (e.pcId) linked[e.pcId] = true; });
    return reports().filter(function (r) { return !linked[r.id]; });
  }
  function fmtAt(v) { var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/.exec(String(v || '')); return m ? m[4] + ' ' + m[3] + '/' + m[2] : (v || ''); }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return TM.getEquipment().filter(function (e) {
      if (state.cat && e.category !== state.cat) return false;
      if (state.status && e.status !== state.status) return false;
      if (q) {
        var hay = [e.name, e.code, e.brand, e.model, e.serial, e.location, stockRows(e).map(function (r) { return r.loc; }).join(' '), memberName(e.assigneeId), e.supplier, e.note,
          parseSpecs(e).map(function (s) { return [s.type, s.name, s.spec].join(' '); }).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function kpi(label, value, sub, cls) { return '<div class="eq-kpi"><div class="eq-kpi-label">' + esc(label) + '</div><div class="eq-kpi-value ' + (cls || '') + '">' + esc(value) + '</div><div class="eq-kpi-sub">' + esc(sub) + '</div></div>'; }
  function renderKpis(all) {
    var devices = all.filter(function (e) { return !isSupply(e); });
    var supplies = all.filter(isSupply);
    var inUse = devices.filter(function (e) { return e.status === 'Đang dùng' || !e.status; }).length;
    var broken = all.filter(function (e) { return e.status === 'Đang sửa' || e.status === 'Hỏng'; }).length;
    var warn = devices.filter(function (e) { var w = warrantyState(e); return w === 'soon'; }).length;
    var low = supplies.filter(lowStock).length;
    var pcWarn = devices.filter(function (e) { return pcAlerts(e).length; }).length;
    // Giá trị: thiết bị = giá mua; vật tư/vật dụng tính theo SỐ LƯỢNG = đơn giá × tồn
    var total = all.reduce(function (s, e) { return s + (isSupply(e) ? num(e.price) * totalQty(e) : num(e.price)); }, 0);
    var totalUnits = supplies.reduce(function (s, e) { return s + totalQty(e); }, 0);
    $('eqKpis').innerHTML =
      kpi('Tổng tài sản', all.length, devices.length + ' thiết bị · ' + supplies.length + ' loại vật tư/vật dụng') +
      kpi('Thiết bị đang dùng', inUse, 'trên tổng ' + devices.length + ' thiết bị') +
      kpi('Đang sửa / hỏng', broken, 'cần xử lý' + (pcWarn ? ' · ' + pcWarn + ' máy có cảnh báo từ Agent' : ''), broken || pcWarn ? 'bad' : '') +
      kpi('Cảnh báo', warn + low, (low ? low + ' vật tư sắp hết' : 'không có vật tư sắp hết') + ' · ' + warn + ' sắp hết bảo hành (' + WARN_DAYS + ' ngày)', warn || low ? 'warn' : '') +
      kpi('Tổng giá trị', moneyShort(total), totalUnits + ' đơn vị vật tư trong kho · giá trị đã nhập');
  }

  // Tóm tắt thông số chính hiển thị ở danh sách
  function summaryHtml(e) {
    var specs = parseSpecs(e);
    if (isSupply(e)) {
      var low = lowStock(e);
      var rows = stockRows(e);
      return '<div class="eq-spec"><b>Tồn: ' + esc(totalQty(e)) + ' ' + esc(e.unit || '') + '</b>' + (String(e.minQty || '') !== '' ? ' · tối thiểu ' + esc(e.minQty) : '') + (low ? ' <span class="eq-badge bad">Sắp hết</span>' : '') +
        (rows.length ? '<br>' + rows.slice(0, 4).map(function (r) { return esc(r.loc) + ': <b>' + esc(r.qty) + '</b>'; }).join(' · ') + (rows.length > 4 ? ' … +' + (rows.length - 4) : '') : '') +
        (specs.length ? '<br>' + esc(specs.slice(0, 2).map(function (s) { return [s.name, s.spec].filter(Boolean).join(' ') || s.type; }).join(' · ')) : '') + '</div>';
    }
    if (e.category === 'Máy tính') {
      var pick = ['CPU', 'RAM', 'SSD', 'HDD', 'VGA / Card đồ họa'];
      var parts = pick.map(function (t) {
        var rows = specs.filter(function (s) { return s.type === t; });
        if (!rows.length) return '';
        var q = rows.reduce(function (a, s) { return a + (num(s.qty) || 1); }, 0);
        var txt = rows.map(function (s) { return [s.name, s.spec].filter(Boolean).join(' '); }).filter(Boolean).join(' + ');
        return '<b>' + esc(t.replace(' / Card đồ họa', '')) + '</b> ' + (q > 1 ? q + '× ' : '') + esc(txt || '—');
      }).filter(Boolean);
      return '<div class="eq-spec">' + (parts.length ? parts.join('<br>') : '—') + (specs.length > 0 ? '<br><span style="opacity:.7">' + specs.length + ' linh kiện đã ghi</span>' : '') + '</div>';
    }
    return '<div class="eq-spec">' + (specs.length ? specs.slice(0, 4).map(function (s) { return '<b>' + esc(s.type || '') + '</b> ' + esc([s.name, s.spec].filter(Boolean).join(' ')); }).join('<br>') : '—') + '</div>';
  }

  function rowHtml(e) {
    var w = warrantyState(e), st = e.status || 'Đang dùng';
    var who = [memberName(e.assigneeId), e.location].filter(Boolean).join(' · ');
    return '<tr class="eq-row" data-id="' + esc(e.id) + '">' +
      '<td class="eq-code">' + esc(e.code || '—') + '</td>' +
      '<td><div class="eq-name">' + esc(e.name) + '</div><div class="eq-sub">' + esc([e.brand, e.model].filter(Boolean).join(' ') || '') + (e.serial ? ' · SN ' + esc(e.serial) : '') + '</div></td>' +
      '<td>' + (who ? esc(who) : '<span class="eq-sub">—</span>') + '</td>' +
      '<td>' + summaryHtml(e) + '</td>' +
      '<td><span class="eq-badge ' + (STATUS_CLS[st] || 'mute') + '">' + esc(st) + '</span>' + (pcAlerts(e).length ? '<div class="eq-alert" title="' + esc(pcAlerts(e).join('; ')) + '">' + WARN_ICON + ' ' + pcAlerts(e).length + ' cảnh báo</div>' : '') + (pcDiff(e) ? '<div class="eq-diff">Cấu hình máy đã đổi</div>' : '') + '</td>' +
      '<td>' + (e.warrantyUntil ? '<span class="eq-badge ' + (w === 'expired' ? 'bad' : w === 'soon' ? 'warn' : 'ok') + '">' + (w === 'expired' ? 'Hết ' : '') + esc(fmtDate(e.warrantyUntil)) + '</span>' : '<span class="eq-sub">—</span>') + '</td>' +
      '<td class="eq-sub" style="white-space:nowrap;">' + esc(money(e.price)) + '</td></tr>';
  }

  function renderGroups(list) {
    var html = '';
    CATS.forEach(function (c) {
      var items = list.filter(function (e) { return (catOf(e.category) === c); });
      if (!items.length && (state.q || state.status || state.cat)) return;
      var qtyNote = c.supply ? ' · ' + items.reduce(function (s, e) { return s + totalQty(e); }, 0) + ' đơn vị tồn' : '';
      html += '<details class="eq-group" open><summary><svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + c.icon + '</svg>' + esc(c.name) +
        '<span class="eq-count">' + items.length + qtyNote + '</span><span class="eq-chev">›</span></summary>' +
        (items.length ? '<div class="eq-table-wrap"><table class="eq-table"><thead><tr><th>Mã</th><th>Thiết bị</th><th>Người dùng · Vị trí</th><th>' + (c.supply ? 'Tồn kho · phân bổ vị trí' : 'Thông số chính') + '</th><th>Tình trạng</th><th>Bảo hành</th><th>' + (c.supply ? 'Đơn giá' : 'Giá mua') + '</th></tr></thead><tbody>' + items.map(rowHtml).join('') + '</tbody></table></div>'
          : '<div class="eq-empty">Chưa có mục nào trong nhóm này.' + (canManage() ? ' Bấm “+ Thêm tài sản / vật tư” để thêm.' : '') + '</div>') + '</details>';
    });
    $('eqGroups').innerHTML = html || '<div class="eq-empty">Không có tài sản nào khớp bộ lọc.</div>';
  }

  // Tổng hợp linh kiện: loại → (tên + thông số) → số lượng, số thiết bị dùng
  function renderParts(list) {
    var byType = {};
    list.forEach(function (e) {
      parseSpecs(e).forEach(function (s) {
        if (!s.type || !(s.name || s.spec)) return;
        var t = byType[s.type] || (byType[s.type] = { type: s.type, total: 0, items: {} });
        var key = (s.name || '').trim() + '||' + (s.spec || '').trim();
        var it = t.items[key] || (t.items[key] = { name: s.name || '', spec: s.spec || '', qty: 0, devices: [] });
        var q = num(s.qty) || 1;
        it.qty += q; t.total += q;
        if (it.devices.indexOf(e.name) === -1) it.devices.push(e.name);
      });
    });
    var types = Object.keys(byType).sort(function (a, b) { return byType[b].total - byType[a].total; });
    if (!types.length) { $('eqParts').innerHTML = '<div class="eq-empty">Chưa có linh kiện/thông số nào được ghi. Mở một thiết bị và thêm dòng linh kiện để tổng hợp tại đây.</div>'; return; }
    $('eqParts').innerHTML = types.map(function (k) {
      var t = byType[k];
      var rows = Object.keys(t.items).map(function (x) { return t.items[x]; }).sort(function (a, b) { return b.qty - a.qty; });
      return '<details class="eq-group" open><summary>' + esc(t.type) + '<span class="eq-count">' + t.total + ' cái · ' + rows.length + ' loại</span><span class="eq-chev">›</span></summary>' +
        '<div class="eq-table-wrap"><table class="eq-table" style="min-width:640px"><thead><tr><th>Tên / Model</th><th>Thông số</th><th>Số lượng</th><th>Đang gắn trong</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td class="eq-name">' + esc(r.name || '—') + '</td><td>' + esc(r.spec || '—') + '</td><td style="font-family:\'JetBrains Mono\',monospace">' + r.qty + '</td><td class="eq-sub">' + esc(r.devices.slice(0, 6).join(', ')) + (r.devices.length > 6 ? ' … +' + (r.devices.length - 6) : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div></details>';
    }).join('');
  }

  // Xem theo vị trí: thiết bị theo trường "Vị trí", vật tư/vật dụng theo từng dòng phân bổ (kho, văn phòng, công trình…)
  function renderLocations(list) {
    var map = {};
    var put = function (loc, item) { (map[loc] || (map[loc] = [])).push(item); };
    list.forEach(function (e) {
      if (isSupply(e)) {
        var rows = stockRows(e);
        if (!rows.length && num(e.qty) > 0) rows = [{ loc: e.location || 'Chưa ghi vị trí', qty: num(e.qty) }];
        rows.forEach(function (r) { put(r.loc, { e: e, qty: r.qty, supply: true }); });
      } else put(e.location || 'Chưa ghi vị trí', { e: e, qty: 1, supply: false });
    });
    var locs = Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'vi'); });
    if (!locs.length) { $('eqLocs').innerHTML = '<div class="eq-empty">Chưa có tài sản nào có vị trí. Ghi “Vị trí” cho thiết bị hoặc “Phân bổ theo vị trí” cho vật tư.</div>'; return; }
    $('eqLocs').innerHTML = locs.map(function (loc) {
      var items = map[loc].sort(function (a, b) { return String(a.e.category).localeCompare(String(b.e.category), 'vi') || String(a.e.name).localeCompare(String(b.e.name), 'vi'); });
      var units = items.reduce(function (s, it) { return s + (it.qty || 0); }, 0);
      return '<details class="eq-group" open><summary><svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.5"/></svg>' + esc(loc) +
        '<span class="eq-count">' + items.length + ' mục · ' + units + ' đơn vị</span><span class="eq-chev">›</span></summary>' +
        '<div class="eq-table-wrap"><table class="eq-table" style="min-width:640px"><thead><tr><th>Mã</th><th>Tên</th><th>Nhóm</th><th>Số lượng</th><th>Tình trạng</th></tr></thead><tbody>' +
        items.map(function (it) {
          var st = it.e.status || 'Đang dùng';
          return '<tr class="eq-row" data-id="' + esc(it.e.id) + '"><td class="eq-code">' + esc(it.e.code || '—') + '</td><td class="eq-name">' + esc(it.e.name) + '</td><td class="eq-sub">' + esc(it.e.category) + '</td>' +
            '<td style="font-family:\'JetBrains Mono\',monospace">' + esc(it.qty) + (it.supply ? ' ' + esc(it.e.unit || '') : '') + '</td><td><span class="eq-badge ' + (STATUS_CLS[st] || 'mute') + '">' + esc(st) + '</span></td></tr>';
        }).join('') + '</tbody></table></div></details>';
    }).join('');
  }

  function render() {
    var all = TM.getEquipment();
    renderKpis(all);
    var list = filtered();
    $('eqGroups').hidden = state.view !== 'groups';
    $('eqParts').hidden = state.view !== 'parts';
    $('eqLocs').hidden = state.view !== 'loc';
    if (state.view === 'groups') renderGroups(list); else if (state.view === 'loc') renderLocations(list); else renderParts(list);
    $('eqAddBtn').hidden = !canManage();
    renderBanner();
  }
  function renderBanner() {
    var un = unlinkedReports(), box = $('eqPcBanner');
    if (!un.length) { box.hidden = true; return; }
    box.className = 'eq-banner'; box.hidden = false;
    box.innerHTML = '<span><b>' + un.length + ' máy đã cài HICONIQUE Agent</b> chưa có trong danh sách thiết bị:</span>' + un.slice(0, 8).map(function (r) {
      return canManage() ? '<button type="button" class="eq-btn eq-btn-sm" data-addpc="' + esc(r.id) + '">+ ' + esc(r.hostname || r.id) + (r.memberId ? ' · ' + esc(memberName(r.memberId)) : '') + '</button>'
        : '<span class="eq-badge mute">' + esc(r.hostname || r.id) + '</span>';
    }).join('') + (un.length > 8 ? '<span class="eq-sub">… +' + (un.length - 8) + '</span>' : '');
  }

  // ---------- Modal ----------
  function fillSelects() {
    var cat = $('efCat'), cur = cat.value;
    cat.innerHTML = '<option value="">— Chọn nhóm —</option>' + CATS.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('');
    if (cur) cat.value = cur;
    fillUnits();
    $('efStatus').innerHTML = STATUSES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    var members = TM.getActiveMembers ? TM.getActiveMembers() : (TM.getMembers ? TM.getMembers() : []);
    $('efAssignee').innerHTML = '<option value="">— Chưa gán / dùng chung —</option>' + members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name || m.id) + '</option>'; }).join('');
    var fc = $('eqCat'), fcv = fc.value;
    fc.innerHTML = '<option value="">Tất cả nhóm</option>' + CATS.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join(''); fc.value = fcv;
    var fs = $('eqStatus'), fsv = fs.value;
    fs.innerHTML = '<option value="">Mọi tình trạng</option>' + STATUSES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join(''); fs.value = fsv;
  }
  // ---- Đơn vị: dropdown chuẩn + "Khác…" (nhập tay) ----
  function fillUnits() {
    var u = $('efUnit'), cur = u.value;
    u.innerHTML = '<option value="">— Chọn đơn vị —</option>' + UNITS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '<option value="__other">Khác… (nhập tay)</option>';
    if (cur) u.value = cur;
  }
  function setUnit(v) {
    v = String(v || '').trim();
    var u = $('efUnit'), other = $('efUnitOther');
    if (!v) { u.value = ''; other.hidden = true; other.value = ''; return; }
    if (UNITS.indexOf(v) !== -1) { u.value = v; other.hidden = true; other.value = ''; }
    else { u.value = '__other'; other.hidden = false; other.value = v; }
  }
  function getUnit() { var u = $('efUnit').value; return u === '__other' ? $('efUnitOther').value.trim() : u; }
  function fillHintLists() {
    var uniq = function (f) { var s = {}; TM.getEquipment().forEach(function (e) { if (e[f]) s[String(e[f]).trim()] = 1; }); return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'vi'); }); };
    $('eqBrandList').innerHTML = uniq('brand').map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    $('eqSupList').innerHTML = uniq('supplier').map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
  }
  var infoTimer = null;
  function renderPcInfoOnly() { clearTimeout(infoTimer); infoTimer = setTimeout(renderPcBox, 500); }
  function renderPcBox() {
    var box = $('eqPcBox');
    var show = canManage() && $('efCat').value === 'Máy tính' && reports().length > 0;
    box.hidden = !show;
    if (!show) return;
    var linkedTo = {}; TM.getEquipment().forEach(function (e) { if (e.pcId && e.id !== state.editingId) linkedTo[e.pcId] = e.name; });
    $('eqPcPick').innerHTML = '<option value="">— Chọn máy đã báo về —</option>' + reports().map(function (r) {
      return '<option value="' + esc(r.id) + '"' + (r.id === state.pcId ? ' selected' : '') + '>' + esc((r.hostname || r.id) + ' · ' + memberName(r.memberId) + ' · ' + [r.brand, r.model].filter(Boolean).join(' ') + (linkedTo[r.id] ? ' (đã gắn: ' + linkedTo[r.id] + ')' : '')) + '</option>';
    }).join('');
    var r = reportById(state.pcId), info = '';
    if (r) {
      var cur = { specs: JSON.stringify(readSpecs()) }, types = reportTypes(r);
      var changed = specKey(parseSpecs(cur), types) !== specKey(rSpecs(r), types);
      info = '<div class="eq-sub" style="margin-top:6px;">Đang gắn với máy <b>' + esc(r.hostname) + '</b> · Agent v' + esc(r.agentVersion || '?') + ' · báo lúc ' + esc(fmtAt(r.reportedAt)) + '</div>' +
        (changed ? '<div class="eq-diff">Cấu hình trong sổ khác với máy thực tế — bấm “Nhập / đồng bộ cấu hình” để cập nhật.</div>' : '<div class="eq-sub" style="color:#7FA783;">Cấu hình khớp với máy thực tế.</div>') +
        (jparse(r.alerts).length ? '<div class="eq-alert">' + WARN_ICON + ' ' + jparse(r.alerts).map(esc).join('<br>' + WARN_ICON + ' ') + '</div>' : '') +
        (jparse(r.live).length ? '<div class="eq-live">' + jparse(r.live).map(esc).join(' · ') + '</div>' : '');
    }
    $('eqPcInfo').innerHTML = info;
  }
  // Nhập cấu hình từ báo cáo của Agent: điền các ô còn trống, thay các dòng linh kiện cùng loại, giữ dòng nhập tay khác (Case, bàn phím...)
  function applyReport(r) {
    if (!r) return;
    state.pcId = r.id;
    $('efCat').value = 'Máy tính';
    if (!$('efName').value.trim()) $('efName').value = (r.hostname ? r.hostname + ' — ' : '') + [r.brand, r.model].filter(Boolean).join(' ');
    if (!$('efBrand').value.trim()) $('efBrand').value = r.brand || '';
    if (!$('efModel').value.trim()) $('efModel').value = r.model || '';
    if (!$('efSerial').value.trim() && r.serial && !/system serial|to be filled|default string/i.test(r.serial)) $('efSerial').value = r.serial;
    if (!$('efAssignee').value && r.memberId) $('efAssignee').value = r.memberId;
    var types = reportTypes(r);
    var oldPrice = {}; state.specs.forEach(function (s) { if (s.price) (oldPrice[s.type] = oldPrice[s.type] || []).push(s.price); });
    var fresh = rSpecs(r).map(function (s) { var l = oldPrice[s.type]; if (l && l.length) s.price = l.shift(); return s; });
    state.specs = fresh.concat(state.specs.filter(function (s) { return !types[s.type] && (s.type || s.name || s.spec); }));
    ensureDefaultParts('Máy tính');  // Agent không đọc được bàn phím/chuột — vẫn giữ dòng mặc định để điền tay
    refreshTypeList(); renderSpecRows(); renderPcBox(); syncPriceFromSpecs();
  }

  function refreshTypeList() {
    var cat = formCat($('efCat').value), sup = !!cat.supply, picked = !!cat.name;
    $('eqTypeList').innerHTML = cat.tpl.map(function (t) { return '<option value="' + esc(t[0]) + '">'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-supply]'), function (n) { n.hidden = !sup; });
    // Chưa chọn nhóm: chưa hiện thông số/linh kiện (VD Bàn phím, Chuột chỉ hiện khi chọn nhóm Máy tính)
    Array.prototype.forEach.call(document.querySelectorAll('[data-needcat]'), function (n) { n.hidden = !picked; });
    $('eqPickCat').hidden = picked;
    $('eqNameList').innerHTML = (cat.names || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    $('eqLocList').innerHTML = locSuggestions().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
    $('efPriceLbl').textContent = sup ? 'Đơn giá (₫ / đơn vị)' : 'Giá mua (₫)';
    if (sup && !getUnit() && cat.unit) setUnit(cat.unit);
    fillHintLists();
  }
  // Luôn có sẵn 1 dòng trống cho các loại "mặc định" của nhóm (VD: Bàn phím, Chuột ở Máy tính) — không cần bấm "Điền mẫu theo nhóm"
  function ensureDefaultParts(catName) {
    var parts = formCat(catName).defaultParts; if (!parts) return;
    var have = {}; state.specs.forEach(function (s) { have[s.type] = true; });
    parts.forEach(function (t) { if (!have[t]) state.specs.push({ type: t, name: '', spec: '', qty: '1' }); });
  }
  function suggestCode() {
    // Mã tăng dần theo nhóm: <tiền tố>-<số lớn nhất đang có + 1> (MT-001, MT-002…); mã nhập tay kiểu khác không ảnh hưởng
    var c = formCat($('efCat').value), max = 0, used = {};
    if (!c.prefix) return '';
    var re = new RegExp('^' + c.prefix + '-([0-9]+)$', 'i');   // tiền tố chỉ gồm chữ cái
    TM.getEquipment().forEach(function (e) { if (e.id === state.editingId) return; used[String(e.code || '').toLowerCase()] = true; var m = re.exec(String(e.code || '').trim()); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    var n = max + 1, code;
    do { code = c.prefix + '-' + ('00' + n).slice(-3); n++; } while (used[code.toLowerCase()]);
    return code;
  }
  // Báo trùng mã ngay khi gõ
  function checkCodeDup() {
    var v = $('efCode').value.trim().toLowerCase(), hint = $('eqCodeHint'); if (!hint) return false;
    var dup = v && TM.getEquipment().filter(function (x) { return String(x.code || '').trim().toLowerCase() === v && x.id !== state.editingId; })[0];
    hint.hidden = !dup; hint.textContent = dup ? 'Trùng mã với "' + dup.name + '" — hãy đổi mã khác' : '';
    $('efCode').style.borderColor = dup ? '#C0644A' : '';
    return !!dup;
  }
  // ---- Phân bổ tồn kho theo vị trí + nhập/xuất/điều chuyển + lịch sử ----
  function renderStock() {
    var can = canManage();
    $('eqStockRows').innerHTML = state.stock.length ? state.stock.map(function (r, i) {
      return '<div class="eq-stock-row" data-i="' + i + '"><input class="eq-input" data-f="loc" list="eqLocList" value="' + esc(r.loc) + '" placeholder="Vị trí (kho, công trình…)"' + (can ? '' : ' disabled') + '>' +
        '<input class="eq-input" data-f="qty" inputmode="decimal" value="' + esc(r.qty) + '" placeholder="SL"' + (can ? '' : ' disabled') + '>' +
        (can ? '<button type="button" class="eq-spec-del" data-delstock="' + i + '" title="Xóa dòng" aria-label="Xóa dòng">×</button>' : '<span></span>') + '</div>';
    }).join('') : '<p class="eq-sub">Chưa phân bổ. Nhập “Số lượng tồn” chung ở bên trái, hoặc thêm từng vị trí để biết mỗi nơi đang giữ bao nhiêu.</p>';
    syncQtyFromStock();
    $('eqHistory').innerHTML = state.history.length ? state.history.slice().reverse().slice(0, 25).map(function (h) {
      var label = h.type === 'in' ? 'Nhập' : h.type === 'out' ? 'Xuất' : h.type === 'move' ? 'Chuyển' : 'Điều chỉnh';
      return '<div class="eq-hist-row"><span class="eq-badge ' + (h.type === 'in' ? 'ok' : h.type === 'out' ? 'bad' : 'mute') + '">' + label + '</span> <b>' + esc(h.qty) + '</b> ' +
        esc(h.type === 'move' ? (h.loc || '') + ' → ' + (h.to || '') : (h.loc || '')) + ' <span class="eq-sub">· ' + esc(fmtDT(h.t)) + ' · ' + esc(memberName(h.by)) + (h.note ? ' · ' + esc(h.note) : '') + '</span></div>';
    }).join('') : '<p class="eq-sub">Chưa có lịch sử nhập / xuất.</p>';
  }
  function syncQtyFromStock() {
    var hasRows = state.stock.length > 0;
    $('efQty').readOnly = hasRows;
    if (hasRows) $('efQty').value = stockTotal(state.stock);
  }
  function applyMovement() {
    var u = user(); if (!u || !canManage()) { toast('Chỉ CEO/quản lý được nhập/xuất kho', true); return; }
    var e = TM.getEquipment().filter(function (x) { return x.id === state.editingId; })[0];
    if (!e) { toast('Hãy lưu vật tư trước khi nhập/xuất', true); return; }
    var type = $('emType').value, q = num($('emQty').value), loc = $('emLoc').value.trim() || DEFAULT_LOC, to = $('emTo').value.trim(), note = $('emNote').value.trim();
    if (q <= 0) { toast('Nhập số lượng lớn hơn 0', true); return; }
    if (type === 'move' && (!to || to === loc)) { toast('Chọn vị trí đến khác vị trí đi', true); return; }
    var rows = stockRows(e).length ? stockRows(e) : (num(e.qty) > 0 ? [{ loc: e.location || DEFAULT_LOC, qty: num(e.qty) }] : []);
    var find = function (l) { for (var i = 0; i < rows.length; i++) if (rows[i].loc === l) return rows[i]; return null; };
    var add = function (l, n) { var r = find(l); if (r) r.qty = num(r.qty) + n; else rows.push({ loc: l, qty: n }); };
    if (type === 'in') add(loc, q);
    else {
      var src = find(loc);
      if (!src || num(src.qty) < q) { toast('Không đủ số lượng tại “' + loc + '” (đang có ' + (src ? src.qty : 0) + ')', true); return; }
      src.qty = num(src.qty) - q;
      if (type === 'move') add(to, q);
    }
    rows = rows.filter(function (r) { return num(r.qty) > 0; });
    var hist = historyOf(e); hist.push({ t: new Date().toISOString(), type: type, qty: q, loc: loc, to: type === 'move' ? to : '', by: u.id, note: note });
    if (hist.length > 60) hist = hist.slice(hist.length - 60);
    var data = { stock: JSON.stringify(rows), qty: String(stockTotal(rows)), history: JSON.stringify(hist) };
    if (!TM.updateEquipment(e.id, data, u)) { toast('Không ghi được', true); return; }
    state.stock = rows; state.history = hist;
    $('efQty').value = data.qty;
    $('emQty').value = ''; $('emNote').value = '';
    renderStock(); render();
    toast((type === 'in' ? 'Đã nhập ' : type === 'out' ? 'Đã xuất ' : 'Đã chuyển ') + q + ' ' + (e.unit || '') + ' — còn ' + data.qty + ' ' + (e.unit || ''));
  }

  function renderSpecRows() {
    var ro = !canManage() ? ' disabled' : '';
    $('eqSpecRows').innerHTML = state.specs.length ? state.specs.map(function (s, i) {
      return '<div class="eq-spec-row" data-i="' + i + '">' +
        '<input class="eq-input" data-f="type" list="eqTypeList" value="' + esc(s.type) + '" placeholder="Loại"' + ro + '>' +
        '<textarea class="eq-input eq-ta" rows="1" data-f="name" placeholder="Tên / Model"' + ro + '>' + esc(s.name) + '</textarea>' +
        '<textarea class="eq-input eq-ta" rows="1" data-f="spec" placeholder="Thông số"' + ro + '>' + esc(s.spec) + '</textarea>' +
        '<input class="eq-input" data-f="qty" value="' + esc(s.qty) + '" inputmode="numeric"' + ro + '>' +
        '<input class="eq-input" data-f="price" value="' + esc(fmtMoney(s.price)) + '" inputmode="numeric" placeholder="Đơn giá"' + ro + '>' +
        (canManage() ? '<button type="button" class="eq-spec-del" data-del="' + i + '" title="Xóa dòng" aria-label="Xóa dòng">×</button>' : '<span></span>') + '</div>';
    }).join('') : '<p class="eq-sub">Chưa có dòng nào. Bấm “Điền mẫu theo nhóm” để có sẵn các đầu mục, hoặc “+ Thêm dòng”.</p>';
    autosizeSpecs(); setTimeout(autosizeSpecs, 60); syncPriceFromSpecs(true);
  }
  // Ô Loại / Tên / Thông số tự xuống dòng và cao ra theo nội dung (không cắt chữ dài)
  function autosizeTa(t) { t.style.height = 'auto'; if (t.scrollHeight > 4) t.style.height = t.scrollHeight + 2 + 'px'; }
  function autosizeSpecs() { Array.prototype.forEach.call($('eqSpecRows').querySelectorAll('textarea.eq-ta'), autosizeTa); }
  function fmtMoney(v) { var d = String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+(?=\d)/, ''); return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; }
  // Tổng giá mua = Σ (đơn giá × SL) các dòng linh kiện; có ít nhất 1 đơn giá thì tự điền vào ô Giá mua
  function specsTotal() { return state.specs.reduce(function (t, s) { return t + num(String(s.price || '').replace(/\D/g, '')) * (num(s.qty) || 1); }, 0); }
  function syncPriceFromSpecs(labelOnly) {
    if (formCat($('efCat').value).supply) return;
    var t = specsTotal(); if (t > 0 && !labelOnly) $('efPrice').value = fmtMoney(t);
    var el = $('eqSpecTotal'); if (el) el.textContent = t > 0 ? 'Tổng linh kiện: ' + money(t) : '';
  }
  function readSpecs() {
    return state.specs.filter(function (s) { return s.type || s.name || s.spec; }).map(function (s) { return { type: s.type.trim(), name: s.name.trim(), spec: s.spec.trim(), qty: String(s.qty || '1').trim() || '1', price: String(s.price || '').replace(/\D/g, '') }; });
  }
  function openModal(id, cloneFrom, fromReport) {
    var e = id ? TM.getEquipment().filter(function (x) { return x.id === id; })[0] : null;
    var src = e || cloneFrom || null;
    state.editingId = e ? e.id : null;
    fillSelects();
    var g = function (k) { return src && src[k] != null ? src[k] : ''; };
    $('eqModalTitle').textContent = e ? e.name : (cloneFrom ? 'Nhân bản' : 'Thêm tài sản / vật tư');
    $('efCat').value = src ? catOf(g('category')).name : (state.cat || '');   // thêm mới: chưa chọn nhóm (trừ khi đang lọc theo 1 nhóm)
    state.prevCat = $('efCat').value;
    $('efName').value = cloneFrom ? g('name') + ' (bản sao)' : g('name');
    $('efBrand').value = g('brand'); $('efModel').value = g('model'); $('efSerial').value = cloneFrom ? '' : g('serial');
    $('efStatus').value = g('status') || 'Đang dùng'; $('efAssignee').value = cloneFrom ? '' : g('assigneeId'); $('efLocation').value = g('location');
    $('efBuy').value = String(g('purchaseDate')).slice(0, 10); $('efWar').value = String(g('warrantyUntil')).slice(0, 10);
    $('efPrice').value = g('price') ? Number(String(g('price')).replace(/[^\d]/g, '')).toLocaleString('vi-VN') : ''; $('efSupplier').value = g('supplier');
    $('efQty').value = g('qty'); setUnit(g('unit')); $('efMin').value = g('minQty'); $('efNote').value = g('note');
    state.codeTouched = false;
    $('efCode').value = (e && g('code')) ? g('code') : suggestCode();   // chưa có mã (kể cả tài sản cũ) → tự điền mã kế tiếp; có mã thì giữ nguyên
    if (cloneFrom) $('efCode').value = suggestCode();
    checkCodeDup();
    state.specs = src ? parseSpecs(src).map(function (s) { return { type: s.type || '', name: s.name || '', spec: s.spec || '', qty: s.qty || '1', price: s.price || '' }; }) : [];
    state.pcId = (src && !cloneFrom) ? (g('pcId') || '') : '';
    state.stock = src ? stockRows(src) : [];
    state.history = (src && !cloneFrom) ? historyOf(src) : [];
    ensureDefaultParts($('efCat').value);
    refreshTypeList(); renderSpecRows(); renderPcBox(); renderStock();
    $('eqMoveBox').hidden = !e; $('emTo').hidden = true; $('emType').value = 'in';
    if (window.HiconiqueMoney) { HiconiqueMoney.bind($('efPrice')); }
    var can = canManage();
    Array.prototype.forEach.call($('eqForm').querySelectorAll('.eq-modal-body > div:first-child input, .eq-modal-body > div:first-child select, .eq-modal-body > div:first-child textarea'), function (n) { n.disabled = !can; });
    $('eqSaveBtn').hidden = !can; $('eqAddSpec').hidden = !can; $('eqPreset').hidden = !can;
    $('eqHideBtn').hidden = !(can && e); $('eqCloneBtn').hidden = !(can && e);
    $('eqModal').classList.add('active');
    if (can && fromReport) { $('efCat').value = 'Máy tính'; state.prevCat = 'Máy tính'; applyReport(fromReport); }
    if (can) setTimeout(function () { $('efName').focus(); }, 30);
  }
  // Hộp xác nhận tự dựng — quy tắc dự án: KHÔNG dùng confirm()/alert() gốc của trình duyệt
  function showConfirm(msg, onOk) {
    var ov = document.createElement('div'); ov.className = 'eq-overlay active'; ov.style.zIndex = '9600'; ov.style.alignItems = 'center';
    ov.innerHTML = '<div class="eq-modal" style="max-width:380px;padding:22px;"><div style="font-weight:600;margin-bottom:16px;">' + esc(msg) + '</div><div style="display:flex;gap:8px;justify-content:flex-end;"><button type="button" class="eq-btn" data-no>Hủy</button><button type="button" class="eq-btn eq-btn-danger" data-yes>Xóa</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('[data-no]').addEventListener('click', function () { ov.remove(); });
    ov.querySelector('[data-yes]').addEventListener('click', function () { ov.remove(); onOk(); });
  }
  function closeModal() { $('eqModal').classList.remove('active'); state.editingId = null; }

  function save(ev) {
    ev.preventDefault();
    var u = user();
    if (!u || !canManage()) { toast('Chỉ CEO/quản lý được thêm hoặc sửa tài sản', true); return; }
    if (!$('efCat').value) { toast('Chọn nhóm trước khi lưu', true); $('efCat').focus(); return; }
    var name = $('efName').value.trim();
    if (!name) { toast('Nhập tên tài sản', true); return; }
    var data = {
      code: $('efCode').value.trim(), name: name, category: $('efCat').value, brand: $('efBrand').value.trim(), model: $('efModel').value.trim(),
      serial: $('efSerial').value.trim(), location: $('efLocation').value.trim(), assigneeId: $('efAssignee').value, status: $('efStatus').value,
      purchaseDate: $('efBuy').value, warrantyUntil: $('efWar').value, price: String($('efPrice').value).replace(/[^\d]/g, ''), supplier: $('efSupplier').value.trim(),
      qty: formCat($('efCat').value).supply ? String(state.stock.length ? stockTotal(state.stock) : $('efQty').value.trim()) : '', stock: formCat($('efCat').value).supply ? JSON.stringify(state.stock.filter(function (r) { return r.loc && num(r.qty) > 0; })) : '', unit: formCat($('efCat').value).supply ? getUnit() : '', minQty: formCat($('efCat').value).supply ? $('efMin').value.trim() : '',
      specs: JSON.stringify(readSpecs()), note: $('efNote').value.trim(), pcId: $('efCat').value === 'Máy tính' ? (state.pcId || '') : ''
    };
    if (!data.code) { data.code = suggestCode(); $('efCode').value = data.code; }
    var dup = TM.getEquipment().filter(function (x) { return data.code && x.code === data.code && x.id !== state.editingId; })[0];
    if (dup) { toast('Mã tài sản "' + data.code + '" đã dùng cho "' + dup.name + '"', true); return; }
    if (!formCat($('efCat').value).supply) { data.stock = ''; }
    var ok = state.editingId ? TM.updateEquipment(state.editingId, data, u) : TM.createEquipment(data, u);
    if (!ok) { toast('Không lưu được', true); return; }
    toast(state.editingId ? 'Đã cập nhật' : 'Đã thêm vào danh sách');
    closeModal(); render();
  }

  function exportCsv() {
    var list = filtered();
    var head = ['Mã tài sản', 'Tên thiết bị', 'Nhóm', 'Hãng', 'Model', 'Serial', 'Người sử dụng', 'Vị trí', 'Tình trạng', 'Ngày mua', 'Hết bảo hành', 'Giá mua', 'Nhà cung cấp', 'Số lượng', 'Đơn vị', 'Phân bổ theo vị trí', 'Linh kiện / thông số', 'Ghi chú'];
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [head.map(q).join(',')].concat(list.map(function (e) {
      var sp = parseSpecs(e).map(function (s) { return s.type + ': ' + [s.name, s.spec].filter(Boolean).join(' ') + ((num(s.qty) || 1) > 1 ? ' x' + s.qty : ''); }).join(' | ');
      return [e.code, e.name, e.category, e.brand, e.model, e.serial, memberName(e.assigneeId), e.location, e.status, e.purchaseDate, e.warrantyUntil, e.price, e.supplier, isSupply(e) ? totalQty(e) : '', e.unit, stockRows(e).map(function (r) { return r.loc + ': ' + r.qty; }).join(' | '), sp, e.note].map(q).join(',');
    }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tai-san-vat-tu-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function bind() {
    $('eqSearch').addEventListener('input', function () { state.q = this.value; render(); });
    $('eqCat').addEventListener('change', function () { state.cat = this.value; render(); });
    $('eqStatus').addEventListener('change', function () { state.status = this.value; render(); });
    $('eqView').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-view]'); if (!b) return;
      state.view = b.dataset.view;
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
      render();
    });
    $('eqAddBtn').addEventListener('click', function () { openModal(null); });
    $('eqExport').addEventListener('click', exportCsv);
    document.addEventListener('click', function (e) { var r = e.target.closest('.eq-row'); if (r) openModal(r.dataset.id); });
    $('eqModalClose').addEventListener('click', closeModal);
    $('eqModal').addEventListener('mousedown', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    $('eqForm').addEventListener('submit', save);
    $('efCat').addEventListener('change', function () {
      // Đổi nhóm: bỏ các dòng mặc định còn TRỐNG của nhóm cũ (VD Bàn phím/Chuột khi rời nhóm Máy tính)
      var prev = formCat(state.prevCat);
      if (prev.defaultParts) state.specs = state.specs.filter(function (s) { return !(prev.defaultParts.indexOf(s.type) !== -1 && !s.name && !s.spec); });
      state.prevCat = this.value;
      ensureDefaultParts(this.value); renderSpecRows();
      setUnit('');
      refreshTypeList(); renderPcBox();
      if (!state.codeTouched && (!state.editingId || !$('efCode').value.trim())) $('efCode').value = suggestCode();
      checkCodeDup();
    });
    $('efCode').addEventListener('input', function () { state.codeTouched = true; checkCodeDup(); });
    $('efUnit').addEventListener('change', function () { $('efUnitOther').hidden = this.value !== '__other'; if (this.value === '__other') $('efUnitOther').focus(); });
    $('eqAddStock').addEventListener('click', function () { state.stock.push({ loc: '', qty: '' }); renderStock(); var r = $('eqStockRows').lastElementChild; if (r) r.querySelector('input').focus(); });
    $('eqStockRows').addEventListener('input', function (e) {
      var row = e.target.closest('.eq-stock-row'); if (!row || !e.target.dataset.f) return;
      state.stock[Number(row.dataset.i)][e.target.dataset.f] = e.target.value;
      if (e.target.dataset.f === 'qty') { $('efQty').value = stockTotal(state.stock); }
    });
    $('eqStockRows').addEventListener('click', function (e) {
      var d = e.target.closest('[data-delstock]'); if (!d) return;
      state.stock.splice(Number(d.dataset.delstock), 1); renderStock();
    });
    $('emType').addEventListener('change', function () { $('emTo').hidden = this.value !== 'move'; });
    $('eqMoveBtn').addEventListener('click', applyMovement);
    $('eqAddSpec').addEventListener('click', function () { state.specs.push({ type: '', name: '', spec: '', qty: '1', price: '' }); renderSpecRows(); var r = $('eqSpecRows').lastElementChild; if (r) r.querySelector('input').focus(); });
    $('eqPreset').addEventListener('click', function () {
      var have = {}; state.specs.forEach(function (s) { have[s.type] = true; });
      formCat($('efCat').value).tpl.forEach(function (t) { if (!have[t[0]]) state.specs.push({ type: t[0], name: '', spec: '', qty: '1' }); });
      renderSpecRows();
    });
    $('eqSpecRows').addEventListener('input', function (e) {
      var row = e.target.closest('.eq-spec-row'); if (!row || !e.target.dataset.f) return;
      if (e.target.dataset.f === 'price') e.target.value = fmtMoney(e.target.value);
      state.specs[Number(row.dataset.i)][e.target.dataset.f] = e.target.value;
      if (e.target.dataset.f === 'price' || e.target.dataset.f === 'qty') syncPriceFromSpecs();
      if (e.target.tagName === 'TEXTAREA') autosizeTa(e.target);
    });
    $('eqSpecRows').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'TEXTAREA') e.preventDefault(); });
    window.addEventListener('resize', autosizeSpecs);
    $('eqSpecRows').addEventListener('click', function (e) {
      var d = e.target.closest('[data-del]'); if (!d) return;
      state.specs.splice(Number(d.dataset.del), 1); renderSpecRows(); syncPriceFromSpecs();
    });
    $('eqPcApply').addEventListener('click', function () {
      var r = reportById($('eqPcPick').value);
      if (!r) { toast('Chọn một máy trong danh sách', true); return; }
      applyReport(r); toast('Đã nhập cấu hình từ Agent — kiểm tra rồi bấm Lưu');
    });
    $('eqPcDelete').addEventListener('click', function () {
      var r = reportById($('eqPcPick').value);
      if (!r) { toast('Chọn một máy trong danh sách để xóa', true); return; }
      var linked = TM.getEquipment().filter(function (e) { return e.pcId === r.id && e.id !== state.editingId; })[0];
      showConfirm('Xóa máy "' + (r.hostname || r.id) + '" khỏi danh sách máy đã báo và XÓA LUÔN dòng trong Google Sheet (TB-Máy đã báo)?' +
        (linked ? ' Máy này đang gắn với tài sản "' + linked.name + '" (tài sản không bị xóa).' : '') +
        ' Nếu Agent trên máy đó còn chạy, máy sẽ tự xuất hiện lại ở lần báo sau.', function () {
        if (!TM.deletePcReport(r.id, user())) { toast('Bạn không có quyền xóa', true); return; }
        if (state.pcId === r.id) state.pcId = '';
        renderPcBox(); toast('Đã xóa máy khỏi danh sách và Google Sheet');
      });
    });
    $('eqSpecRows').addEventListener('input', function () { if (state.pcId) renderPcInfoOnly(); });
    $('eqPcBanner').addEventListener('click', function (e) {
      var b = e.target.closest('[data-addpc]'); if (!b) return;
      openModal(null, null, reportById(b.dataset.addpc));
    });
    $('eqHideBtn').addEventListener('click', function () {
      if (!state.editingId) return;
      showConfirm('Xóa mục này khỏi danh sách? (dữ liệu vẫn còn trong Sheet, chỉ ẩn đi)', function () {
        TM.hideEquipment(state.editingId, user()); toast('Đã xóa khỏi danh sách'); closeModal(); render();
      });
      return;
      /* (đã chuyển sang hộp xác nhận tự dựng — không dùng confirm() gốc) */
    });
    $('eqCloneBtn').addEventListener('click', function () {
      var e = TM.getEquipment().filter(function (x) { return x.id === state.editingId; })[0]; if (!e) return;
      var copy = {}; Object.keys(e).forEach(function (k) { copy[k] = e[k]; }); copy.code = '';
      state.editingId = null; openModal(null, copy);
    });
  }

  function init() {
    if (!TM || !TM.loadEquipment) { $('eqGroups').innerHTML = '<p class="eq-empty">Không tải được dữ liệu.</p>'; return; }
    fillSelects(); bind();
    // Mở từ kết quả tìm kiếm chung: /pages/equipment.html?q=<mã hoặc tên>
    try { var qp = new URLSearchParams(location.search).get('q'); if (qp) { state.q = qp; $('eqSearch').value = qp; } } catch (x) { /* bỏ qua */ }
    render();
    TM.loadEquipment(function () { fillSelects(); render(); });
    if (TM.loadCatalog) TM.loadCatalog(function () { syncCatalog(); fillSelects(); render(); });
    if (TM.loadPcReports) TM.loadPcReports(function () { if (!$('eqModal').classList.contains('active')) render(); });
    window.addEventListener('hiconique:data-refreshed', function () { if (!$('eqModal').classList.contains('active')) render(); });
    setInterval(function () { if (!$('eqModal').classList.contains('active') && document.visibilityState === 'visible') TM.loadEquipment(function () { render(); }); if (TM.loadPcReports && document.visibilityState === 'visible' && !$('eqModal').classList.contains('active')) TM.loadPcReports(function () { render(); }); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
