/**
 * Thiết bị văn phòng — equipment.html. Dữ liệu ở TaskManager (sheet TB-Thiết bị).
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
    { name: 'Thiết bị khác', prefix: 'K', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke-linecap="round"/>',
      tpl: [['Loại', 'Điện thoại / Điều hòa / Camera / Máy hủy giấy…', ''], ['Công suất', '', ''], ['Kích thước', '', '']] }
  ];
  var STATUSES = ['Đang dùng', 'Dự phòng', 'Đang sửa', 'Hỏng', 'Thanh lý'];
  var STATUS_CLS = { 'Đang dùng': 'ok', 'Dự phòng': 'mute', 'Đang sửa': 'warn', 'Hỏng': 'bad', 'Thanh lý': 'mute' };
  var WARN_DAYS = 60;
  var state = { view: 'groups', q: '', cat: '', status: '', editingId: null, specs: [], pcId: '' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }
  function money(n) { n = num(n); return n ? n.toLocaleString('vi-VN') + ' ₫' : ''; }
  function moneyShort(n) { n = num(n); if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ'; if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr'; return n ? n.toLocaleString('vi-VN') : '0'; }
  function fmtDate(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
  function user() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function canManage() { return !!(TM && TM.canManageEquipment && TM.canManageEquipment(user())); }
  function toast(msg, bad) { var t = document.createElement('div'); t.className = 'eq-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function memberName(id) { var m = TM.getMember ? TM.getMember(id) : null; return m ? (m.name || id) : (id || ''); }
  function catOf(name) { for (var i = 0; i < CATS.length; i++) if (CATS[i].name === name) return CATS[i]; return CATS[CATS.length - 1]; }
  function parseSpecs(e) { try { var a = typeof e.specs === 'string' ? JSON.parse(e.specs || '[]') : (e.specs || []); return Array.isArray(a) ? a : []; } catch (x) { return []; } }
  function daysTo(d) { if (!d) return null; var t = new Date(String(d).slice(0, 10) + 'T00:00:00').getTime(); return isNaN(t) ? null : Math.ceil((t - new Date().setHours(0, 0, 0, 0)) / 86400000); }
  function warrantyState(e) { var d = daysTo(e.warrantyUntil); if (d == null) return null; return d < 0 ? 'expired' : d <= WARN_DAYS ? 'soon' : 'ok'; }
  function isSupply(e) { return catOf(e.category).supply; }
  function lowStock(e) { return isSupply(e) && String(e.minQty || '') !== '' && num(e.qty) <= num(e.minQty); }

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
        var hay = [e.name, e.code, e.brand, e.model, e.serial, e.location, memberName(e.assigneeId), e.supplier, e.note,
          parseSpecs(e).map(function (s) { return [s.type, s.name, s.spec].join(' '); }).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function kpi(label, value, sub, cls) { return '<div class="eq-kpi"><div class="eq-kpi-label">' + esc(label) + '</div><div class="eq-kpi-value ' + (cls || '') + '">' + esc(value) + '</div><div class="eq-kpi-sub">' + esc(sub) + '</div></div>'; }
  function renderKpis(all) {
    var devices = all.filter(function (e) { return !isSupply(e); });
    var inUse = devices.filter(function (e) { return e.status === 'Đang dùng' || !e.status; }).length;
    var broken = devices.filter(function (e) { return e.status === 'Đang sửa' || e.status === 'Hỏng'; }).length;
    var warn = devices.filter(function (e) { var w = warrantyState(e); return w === 'soon'; }).length;
    var low = all.filter(lowStock).length;
    var pcWarn = devices.filter(function (e) { return pcAlerts(e).length; }).length;
    var total = all.reduce(function (s, e) { return s + num(e.price) * (isSupply(e) ? 1 : 1); }, 0);
    $('eqKpis').innerHTML =
      kpi('Tổng thiết bị', devices.length, all.length - devices.length + ' mục vật tư') +
      kpi('Đang sử dụng', inUse, 'trên tổng ' + devices.length) +
      kpi('Đang sửa / hỏng', broken, 'cần xử lý' + (pcWarn ? ' · ' + pcWarn + ' máy có cảnh báo từ Agent' : ''), broken || pcWarn ? 'bad' : '') +
      kpi('Sắp hết bảo hành', warn, 'trong ' + WARN_DAYS + ' ngày tới' + (low ? ' · ' + low + ' vật tư sắp hết' : ''), warn || low ? 'warn' : '') +
      kpi('Tổng giá trị mua', moneyShort(total), 'cộng giá mua đã nhập');
  }

  // Tóm tắt thông số chính hiển thị ở danh sách
  function summaryHtml(e) {
    var specs = parseSpecs(e);
    if (isSupply(e)) {
      var low = lowStock(e);
      return '<div class="eq-spec"><b>Tồn: ' + esc(e.qty || 0) + ' ' + esc(e.unit || '') + '</b>' + (String(e.minQty || '') !== '' ? ' · tối thiểu ' + esc(e.minQty) : '') + (low ? ' <span class="eq-badge bad">Sắp hết</span>' : '') +
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
      '<td><span class="eq-badge ' + (STATUS_CLS[st] || 'mute') + '">' + esc(st) + '</span>' + (pcAlerts(e).length ? '<div class="eq-alert" title="' + esc(pcAlerts(e).join('; ')) + '">⚠ ' + pcAlerts(e).length + ' cảnh báo</div>' : '') + (pcDiff(e) ? '<div class="eq-diff">Cấu hình máy đã đổi</div>' : '') + '</td>' +
      '<td>' + (e.warrantyUntil ? '<span class="eq-badge ' + (w === 'expired' ? 'bad' : w === 'soon' ? 'warn' : 'ok') + '">' + (w === 'expired' ? 'Hết ' : '') + esc(fmtDate(e.warrantyUntil)) + '</span>' : '<span class="eq-sub">—</span>') + '</td>' +
      '<td class="eq-sub" style="white-space:nowrap;">' + esc(money(e.price)) + '</td></tr>';
  }

  function renderGroups(list) {
    var html = '';
    CATS.forEach(function (c) {
      var items = list.filter(function (e) { return (catOf(e.category) === c); });
      if (!items.length && (state.q || state.status || state.cat)) return;
      var qtyNote = c.supply ? ' · ' + items.reduce(function (s, e) { return s + num(e.qty); }, 0) + ' đơn vị tồn' : '';
      html += '<details class="eq-group" open><summary><svg class="eq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + c.icon + '</svg>' + esc(c.name) +
        '<span class="eq-count">' + items.length + qtyNote + '</span><span class="eq-chev">›</span></summary>' +
        (items.length ? '<div class="eq-table-wrap"><table class="eq-table"><thead><tr><th>Mã</th><th>Thiết bị</th><th>Người dùng · Vị trí</th><th>' + (c.supply ? 'Tồn kho / quy cách' : 'Thông số chính') + '</th><th>Tình trạng</th><th>Bảo hành</th><th>Giá mua</th></tr></thead><tbody>' + items.map(rowHtml).join('') + '</tbody></table></div>'
          : '<div class="eq-empty">Chưa có thiết bị trong nhóm này.' + (canManage() ? ' Bấm “+ Thêm trang thiết bị” để thêm.' : '') + '</div>') + '</details>';
    });
    $('eqGroups').innerHTML = html || '<div class="eq-empty">Không có thiết bị nào khớp bộ lọc.</div>';
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

  function render() {
    var all = TM.getEquipment();
    renderKpis(all);
    var list = filtered();
    $('eqGroups').hidden = state.view !== 'groups';
    $('eqParts').hidden = state.view !== 'parts';
    if (state.view === 'groups') renderGroups(list); else renderParts(list);
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
    cat.innerHTML = CATS.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('');
    if (cur) cat.value = cur;
    $('efStatus').innerHTML = STATUSES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    var members = TM.getActiveMembers ? TM.getActiveMembers() : (TM.getMembers ? TM.getMembers() : []);
    $('efAssignee').innerHTML = '<option value="">— Chưa gán / dùng chung —</option>' + members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name || m.id) + '</option>'; }).join('');
    var fc = $('eqCat'), fcv = fc.value;
    fc.innerHTML = '<option value="">Tất cả nhóm</option>' + CATS.map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join(''); fc.value = fcv;
    var fs = $('eqStatus'), fsv = fs.value;
    fs.innerHTML = '<option value="">Mọi tình trạng</option>' + STATUSES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join(''); fs.value = fsv;
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
        (jparse(r.alerts).length ? '<div class="eq-alert">⚠ ' + jparse(r.alerts).map(esc).join('<br>⚠ ') + '</div>' : '') +
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
    state.specs = rSpecs(r).concat(state.specs.filter(function (s) { return !types[s.type] && (s.type || s.name || s.spec); }));
    refreshTypeList(); renderSpecRows(); renderPcBox();
  }

  function refreshTypeList() {
    $('eqTypeList').innerHTML = catOf($('efCat').value).tpl.map(function (t) { return '<option value="' + esc(t[0]) + '">'; }).join('');
    var sup = catOf($('efCat').value).supply;
    Array.prototype.forEach.call(document.querySelectorAll('[data-supply]'), function (n) { n.hidden = !sup; });
  }
  function suggestCode() {
    var c = catOf($('efCat').value), used = {};
    TM.getEquipment().forEach(function (e) { used[e.code] = true; });
    for (var i = 1; i < 1000; i++) { var code = c.prefix + '-' + ('00' + i).slice(-3); if (!used[code]) return code; }
    return '';
  }
  function renderSpecRows() {
    var ro = !canManage() ? ' disabled' : '';
    $('eqSpecRows').innerHTML = state.specs.length ? state.specs.map(function (s, i) {
      return '<div class="eq-spec-row" data-i="' + i + '">' +
        '<input class="eq-input" data-f="type" list="eqTypeList" value="' + esc(s.type) + '" placeholder="Loại"' + ro + '>' +
        '<input class="eq-input" data-f="name" value="' + esc(s.name) + '" placeholder="Tên / Model"' + ro + '>' +
        '<input class="eq-input" data-f="spec" value="' + esc(s.spec) + '" placeholder="Thông số"' + ro + '>' +
        '<input class="eq-input" data-f="qty" value="' + esc(s.qty) + '" inputmode="numeric"' + ro + '>' +
        (canManage() ? '<button type="button" class="eq-spec-del" data-del="' + i + '" title="Xóa dòng" aria-label="Xóa dòng">×</button>' : '<span></span>') + '</div>';
    }).join('') : '<p class="eq-sub">Chưa có dòng nào. Bấm “Điền mẫu theo nhóm” để có sẵn các đầu mục, hoặc “+ Thêm dòng”.</p>';
  }
  function readSpecs() {
    return state.specs.filter(function (s) { return s.type || s.name || s.spec; }).map(function (s) { return { type: s.type.trim(), name: s.name.trim(), spec: s.spec.trim(), qty: String(s.qty || '1').trim() || '1' }; });
  }
  function openModal(id, cloneFrom, fromReport) {
    var e = id ? TM.getEquipment().filter(function (x) { return x.id === id; })[0] : null;
    var src = e || cloneFrom || null;
    state.editingId = e ? e.id : null;
    fillSelects();
    var g = function (k) { return src && src[k] != null ? src[k] : ''; };
    $('eqModalTitle').textContent = e ? 'Thiết bị: ' + e.name : (cloneFrom ? 'Nhân bản thiết bị' : 'Thêm trang thiết bị');
    $('efCat').value = src ? catOf(g('category')).name : (state.cat || CATS[0].name);
    $('efName').value = cloneFrom ? g('name') + ' (bản sao)' : g('name');
    $('efBrand').value = g('brand'); $('efModel').value = g('model'); $('efSerial').value = cloneFrom ? '' : g('serial');
    $('efStatus').value = g('status') || 'Đang dùng'; $('efAssignee').value = cloneFrom ? '' : g('assigneeId'); $('efLocation').value = g('location');
    $('efBuy').value = String(g('purchaseDate')).slice(0, 10); $('efWar').value = String(g('warrantyUntil')).slice(0, 10);
    $('efPrice').value = g('price'); $('efSupplier').value = g('supplier');
    $('efQty').value = g('qty'); $('efUnit').value = g('unit'); $('efMin').value = g('minQty'); $('efNote').value = g('note');
    $('efCode').value = e ? g('code') : suggestCode();
    state.specs = src ? parseSpecs(src).map(function (s) { return { type: s.type || '', name: s.name || '', spec: s.spec || '', qty: s.qty || '1' }; }) : [];
    state.pcId = (src && !cloneFrom) ? (g('pcId') || '') : '';
    refreshTypeList(); renderSpecRows(); renderPcBox();
    var can = canManage();
    Array.prototype.forEach.call($('eqForm').querySelectorAll('.eq-modal-body > div:first-child input, .eq-modal-body > div:first-child select, .eq-modal-body > div:first-child textarea'), function (n) { n.disabled = !can; });
    $('eqSaveBtn').hidden = !can; $('eqAddSpec').hidden = !can; $('eqPreset').hidden = !can;
    $('eqHideBtn').hidden = !(can && e); $('eqCloneBtn').hidden = !(can && e);
    $('eqModal').classList.add('active');
    if (can && fromReport) { $('efCat').value = 'Máy tính'; applyReport(fromReport); }
    if (can) setTimeout(function () { $('efName').focus(); }, 30);
  }
  function closeModal() { $('eqModal').classList.remove('active'); state.editingId = null; }

  function save(ev) {
    ev.preventDefault();
    var u = user();
    if (!u || !canManage()) { toast('Chỉ CEO/quản lý được thêm hoặc sửa thiết bị', true); return; }
    var name = $('efName').value.trim();
    if (!name) { toast('Nhập tên thiết bị', true); return; }
    var data = {
      code: $('efCode').value.trim(), name: name, category: $('efCat').value, brand: $('efBrand').value.trim(), model: $('efModel').value.trim(),
      serial: $('efSerial').value.trim(), location: $('efLocation').value.trim(), assigneeId: $('efAssignee').value, status: $('efStatus').value,
      purchaseDate: $('efBuy').value, warrantyUntil: $('efWar').value, price: String($('efPrice').value).replace(/[^\d]/g, ''), supplier: $('efSupplier').value.trim(),
      qty: catOf($('efCat').value).supply ? $('efQty').value.trim() : '', unit: catOf($('efCat').value).supply ? $('efUnit').value.trim() : '', minQty: catOf($('efCat').value).supply ? $('efMin').value.trim() : '',
      specs: JSON.stringify(readSpecs()), note: $('efNote').value.trim(), pcId: $('efCat').value === 'Máy tính' ? (state.pcId || '') : ''
    };
    var dup = TM.getEquipment().filter(function (x) { return data.code && x.code === data.code && x.id !== state.editingId; })[0];
    if (dup) { toast('Mã tài sản "' + data.code + '" đã dùng cho "' + dup.name + '"', true); return; }
    var ok = state.editingId ? TM.updateEquipment(state.editingId, data, u) : TM.createEquipment(data, u);
    if (!ok) { toast('Không lưu được', true); return; }
    toast(state.editingId ? 'Đã cập nhật' : 'Đã thêm thiết bị');
    closeModal(); render();
  }

  function exportCsv() {
    var list = filtered();
    var head = ['Mã tài sản', 'Tên thiết bị', 'Nhóm', 'Hãng', 'Model', 'Serial', 'Người sử dụng', 'Vị trí', 'Tình trạng', 'Ngày mua', 'Hết bảo hành', 'Giá mua', 'Nhà cung cấp', 'Số lượng', 'Đơn vị', 'Linh kiện / thông số', 'Ghi chú'];
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [head.map(q).join(',')].concat(list.map(function (e) {
      var sp = parseSpecs(e).map(function (s) { return s.type + ': ' + [s.name, s.spec].filter(Boolean).join(' ') + ((num(s.qty) || 1) > 1 ? ' x' + s.qty : ''); }).join(' | ');
      return [e.code, e.name, e.category, e.brand, e.model, e.serial, memberName(e.assigneeId), e.location, e.status, e.purchaseDate, e.warrantyUntil, e.price, e.supplier, e.qty, e.unit, sp, e.note].map(q).join(',');
    }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'thiet-bi-van-phong-' + new Date().toISOString().slice(0, 10) + '.csv';
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
      refreshTypeList(); renderPcBox();
      if (!state.editingId) $('efCode').value = suggestCode();
    });
    $('eqAddSpec').addEventListener('click', function () { state.specs.push({ type: '', name: '', spec: '', qty: '1' }); renderSpecRows(); var r = $('eqSpecRows').lastElementChild; if (r) r.querySelector('input').focus(); });
    $('eqPreset').addEventListener('click', function () {
      var have = {}; state.specs.forEach(function (s) { have[s.type] = true; });
      catOf($('efCat').value).tpl.forEach(function (t) { if (!have[t[0]]) state.specs.push({ type: t[0], name: '', spec: '', qty: '1' }); });
      renderSpecRows();
    });
    $('eqSpecRows').addEventListener('input', function (e) {
      var row = e.target.closest('.eq-spec-row'); if (!row || !e.target.dataset.f) return;
      state.specs[Number(row.dataset.i)][e.target.dataset.f] = e.target.value;
    });
    $('eqSpecRows').addEventListener('click', function (e) {
      var d = e.target.closest('[data-del]'); if (!d) return;
      state.specs.splice(Number(d.dataset.del), 1); renderSpecRows();
    });
    $('eqPcApply').addEventListener('click', function () {
      var r = reportById($('eqPcPick').value);
      if (!r) { toast('Chọn một máy trong danh sách', true); return; }
      applyReport(r); toast('Đã nhập cấu hình từ Agent — kiểm tra rồi bấm Lưu');
    });
    $('eqSpecRows').addEventListener('input', function () { if (state.pcId) renderPcInfoOnly(); });
    $('eqPcBanner').addEventListener('click', function (e) {
      var b = e.target.closest('[data-addpc]'); if (!b) return;
      openModal(null, null, reportById(b.dataset.addpc));
    });
    $('eqHideBtn').addEventListener('click', function () {
      if (!state.editingId || !confirm('Xóa thiết bị này khỏi danh sách? (dữ liệu vẫn còn trong Sheet, chỉ ẩn đi)')) return;
      TM.hideEquipment(state.editingId, user()); toast('Đã xóa khỏi danh sách'); closeModal(); render();
    });
    $('eqCloneBtn').addEventListener('click', function () {
      var e = TM.getEquipment().filter(function (x) { return x.id === state.editingId; })[0]; if (!e) return;
      var copy = {}; Object.keys(e).forEach(function (k) { copy[k] = e[k]; }); copy.code = '';
      state.editingId = null; openModal(null, copy);
    });
  }

  function init() {
    if (!TM || !TM.loadEquipment) { $('eqGroups').innerHTML = '<p class="eq-empty">Không tải được dữ liệu.</p>'; return; }
    fillSelects(); bind(); render();
    TM.loadEquipment(function () { fillSelects(); render(); });
    if (TM.loadPcReports) TM.loadPcReports(function () { if (!$('eqModal').classList.contains('active')) render(); });
    window.addEventListener('hiconique:data-refreshed', function () { if (!$('eqModal').classList.contains('active')) render(); });
    setInterval(function () { if (!$('eqModal').classList.contains('active') && document.visibilityState === 'visible') TM.loadEquipment(function () { render(); }); if (TM.loadPcReports && document.visibilityState === 'visible' && !$('eqModal').classList.contains('active')) TM.loadPcReports(function () { render(); }); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
