/**
 * Tính toán chiếu sáng — port từ Light.py (app PyQt6) lên web, dùng chung khung
 * UI HICONIQUE. Tính số bóng theo phương pháp quang thông (lumen method), cho
 * click trực tiếp trên mặt bằng 2D để thử bố trí, và vẽ độ rọi ước tính 2D/3D.
 *
 * So với bản Python (2026-09-26, các điểm đã tối ưu):
 *  - Bản đồ độ rọi TÍNH TẠI MẶT LÀM VIỆC (H - Hw) và CHUẨN HOÁ để trung bình khớp
 *    Φ·U·K/S của phương pháp quang thông => nhãn LUX là số ước tính thật, so sánh
 *    được với LUX yêu cầu (bản cũ dùng công thức khác, không có K/U/Hw).
 *  - Chùm sáng mô hình hoá bằng cos^n (n suy từ góc chiếu) thay cho hàm bậc thang
 *    1.0 / 0.1 — không còn vạch gãy ở mép chùm.
 *  - Lưới ban đầu đặt ĐÚNG số bóng tính được (bản cũ cols*rows có thể dư bóng).
 *  - Báo lỗi theo từng ô nhập; không nuốt Exception chung.
 *  - Nhập Excel kiểm tra từng dòng, KHÔNG ép ô trống thành 0; dòng hỏng bị bỏ và
 *    báo số dòng. Danh mục nhập vào được nhớ trên máy (localStorage).
 *  - Không quét lại toàn bộ stylesheet mỗi lần vẽ; đổi theme sáng/tối theo theme
 *    chung của Web và vẽ lại tự động.
 */
(function () {
  'use strict';

  var TCVN_DATA = {
    "Nhà ở, căn hộ": {
      "Phòng khách": { "lux": 300, "cri": 80 },
      "Phòng ngủ": { "lux": 150, "cri": 80 },
      "Bếp": { "lux": 500, "cri": 80 },
      "Phòng tắm/WC": { "lux": 200, "cri": 80 },
      "Phòng làm việc/Đọc sách": { "lux": 500, "cri": 80 },
      "Hành lang, cầu thang": { "lux": 100, "cri": 80 },
      "Gara để xe": { "lux": 75, "cri": 80 }
    },
    "Văn phòng": {
      "Khu làm việc chung, đánh máy": { "lux": 500, "cri": 80 },
      "Phòng vẽ kỹ thuật, CAD": { "lux": 750, "cri": 80 },
      "Phòng họp": { "lux": 500, "cri": 80 },
      "Quầy tiếp tân": { "lux": 300, "cri": 80 },
      "Phòng lưu trữ, copy": { "lux": 300, "cri": 80 }
    },
    "Nhà hàng khách sạn": {
      "Sảnh lễ tân": { "lux": 300, "cri": 80 },
      "Phòng ngủ khách sạn": { "lux": 150, "cri": 80 },
      "Phòng ăn, nhà hàng": { "lux": 200, "cri": 80 },
      "Khu vực bếp": { "lux": 500, "cri": 80 },
      "Hành lang": { "lux": 100, "cri": 80 }
    },
    "Nhà xưởng công nghiệp": {
      "Kho bãi, logistics": { "lux": 100, "cri": 40 },
      "Khu vực lưu trữ hàng hóa": { "lux": 200, "cri": 60 },
      "Lắp ráp thô, hàn, tiện": { "lux": 300, "cri": 80 },
      "Lắp ráp chi tiết tinh": { "lux": 500, "cri": 80 },
      "Kiểm tra chất lượng (KCS)": { "lux": 1000, "cri": 80 }
    },
    "Trường học": {
      "Phòng học chuẩn": { "lux": 300, "cri": 80 },
      "Khu vực bảng đen": { "lux": 500, "cri": 80 },
      "Phòng thực hành, thí nghiệm": { "lux": 500, "cri": 80 },
      "Phòng máy tính": { "lux": 500, "cri": 80 },
      "Hội trường, phòng đa năng": { "lux": 200, "cri": 80 }
    },
    "Thư viện": {
      "Khu vực giá sách": { "lux": 200, "cri": 80 },
      "Khu vực đọc sách": { "lux": 500, "cri": 80 },
      "Quầy mượn trả": { "lux": 300, "cri": 80 }
    },
    "Siêu thị, trung tâm thương mại": {
      "Khu vực bán hàng chung": { "lux": 300, "cri": 80 },
      "Khu vực trưng bày sản phẩm": { "lux": 500, "cri": 80 },
      "Quầy thu ngân": { "lux": 500, "cri": 80 }
    },
    "Nơi vui chơi giải trí": {
      "Khu vực sảnh, phòng chờ": { "lux": 200, "cri": 80 },
      "Phòng thể hình (Gym)": { "lux": 300, "cri": 80 },
      "Nhà thi đấu thể thao": { "lux": 500, "cri": 80 },
      "Bể bơi trong nhà": { "lux": 300, "cri": 80 }
    },
    "Bệnh viện": {
      "Phòng bệnh nhân": { "lux": 100, "cri": 80 },
      "Phòng khám, điều trị": { "lux": 500, "cri": 90 },
      "Phòng phẫu thuật": { "lux": 1000, "cri": 90 }
    }
  };

  var LAMP_CATALOG = {
    "Nhóm Led Downlight": {
      "Led Downlight 3W": { "watt": 3, "lumen": 270, "beam": 100, "ip": 20, "cct": "3000K", "m_p": 0.5, "r9": 40, "b_y": 0.35, "link_anh": "" },
      "Led Downlight 5W": { "watt": 5, "lumen": 450, "beam": 100, "ip": 20, "cct": "4000K", "m_p": 0.5, "r9": 40, "b_y": 0.35, "link_anh": "" },
      "Led Downlight 7W": { "watt": 7, "lumen": 630, "beam": 100, "ip": 20, "cct": "4000K", "m_p": 0.6, "r9": 45, "b_y": 0.38, "link_anh": "" },
      "Led Downlight 9W": { "watt": 9, "lumen": 850, "beam": 100, "ip": 20, "cct": "6500K", "m_p": 0.7, "r9": 50, "b_y": 0.4, "link_anh": "" },
      "Led Downlight 12W": { "watt": 12, "lumen": 1100, "beam": 100, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 55, "b_y": 0.45, "link_anh": "" },
      "Led Downlight 18W": { "watt": 18, "lumen": 1600, "beam": 100, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 55, "b_y": 0.45, "link_anh": "" },
      "Led Downlight 24W": { "watt": 24, "lumen": 2400, "beam": 100, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 55, "b_y": 0.45, "link_anh": "" }
    },
    "Nhóm Led Panel tròn": {
      "Led Panel tròn 6W": { "watt": 6, "lumen": 480, "beam": 120, "ip": 20, "cct": "4000K", "m_p": 0.8, "r9": 50, "b_y": 0.4, "link_anh": "" },
      "Led Panel tròn 9W": { "watt": 9, "lumen": 750, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 50, "b_y": 0.4, "link_anh": "" },
      "Led Panel tròn 12W": { "watt": 12, "lumen": 1000, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 50, "b_y": 0.4, "link_anh": "" },
      "Led Panel tròn 18W": { "watt": 18, "lumen": 1500, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 50, "b_y": 0.4, "link_anh": "" },
      "Led Panel tròn 24W": { "watt": 24, "lumen": 2160, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 50, "b_y": 0.4, "link_anh": "" }
    },
    "Nhóm Led Bulb": {
      "Led Bulb 3W": { "watt": 3, "lumen": 270, "beam": 200, "ip": 20, "cct": "3000K", "m_p": 0.7, "r9": 40, "b_y": 0.35, "link_anh": "" },
      "Led Bulb 5W": { "watt": 5, "lumen": 450, "beam": 200, "ip": 20, "cct": "4000K", "m_p": 0.7, "r9": 40, "b_y": 0.35, "link_anh": "" },
      "Led Bulb 9W": { "watt": 9, "lumen": 850, "beam": 200, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 40, "b_y": 0.4, "link_anh": "" },
      "Led Bulb 12W": { "watt": 12, "lumen": 1150, "beam": 200, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 40, "b_y": 0.4, "link_anh": "" },
      "Led Bulb 20W": { "watt": 20, "lumen": 1900, "beam": 200, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 40, "b_y": 0.4, "link_anh": "" },
      "Led Bulb 30W": { "watt": 30, "lumen": 2850, "beam": 200, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 40, "b_y": 0.4, "link_anh": "" },
      "Led Bulb 50W": { "watt": 50, "lumen": 4800, "beam": 200, "ip": 20, "cct": "6500K", "m_p": 0.8, "r9": 40, "b_y": 0.4, "link_anh": "" }
    },
    "Nhóm Led Spotlight âm trần": {
      "Spotlight 3W": { "watt": 3, "lumen": 250, "beam": 24, "ip": 20, "cct": "3000K", "m_p": 0.5, "r9": 85, "b_y": 0.3, "link_anh": "" },
      "Spotlight 5W": { "watt": 5, "lumen": 420, "beam": 24, "ip": 20, "cct": "3000K", "m_p": 0.5, "r9": 85, "b_y": 0.3, "link_anh": "" },
      "Spotlight 7W": { "watt": 7, "lumen": 600, "beam": 24, "ip": 20, "cct": "4000K", "m_p": 0.5, "r9": 85, "b_y": 0.3, "link_anh": "" },
      "Spotlight 10W": { "watt": 10, "lumen": 850, "beam": 36, "ip": 20, "cct": "4000K", "m_p": 0.6, "r9": 85, "b_y": 0.35, "link_anh": "" },
      "Spotlight 15W": { "watt": 15, "lumen": 1300, "beam": 36, "ip": 20, "cct": "4000K", "m_p": 0.6, "r9": 85, "b_y": 0.35, "link_anh": "" },
      "Spotlight 20W": { "watt": 20, "lumen": 1800, "beam": 36, "ip": 20, "cct": "4000K", "m_p": 0.6, "r9": 85, "b_y": 0.35, "link_anh": "" }
    },
    "Nhóm Led mica": {
      "Led Mica Bán Nguyệt 0.6m 18W": { "watt": 18, "lumen": 1600, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 55, "b_y": 0.45, "link_anh": "" },
      "Led Mica Bán Nguyệt 1.2m 36W": { "watt": 36, "lumen": 3400, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 55, "b_y": 0.45, "link_anh": "" },
      "Led Mica Bán Nguyệt 1.2m 40W": { "watt": 40, "lumen": 4000, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 55, "b_y": 0.45, "link_anh": "" }
    },
    "Nhóm Led Doublewing": {
      "Doublewing 36W": { "watt": 36, "lumen": 3200, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" },
      "Doublewing 45W": { "watt": 45, "lumen": 4000, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" }
    },
    "Nhóm Led tube": {
      "Led Tube T8 0.6m 10W": { "watt": 10, "lumen": 950, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" },
      "Led Tube T8 1.2m 18W": { "watt": 18, "lumen": 1800, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" },
      "Led Tube T8 1.2m 20W": { "watt": 20, "lumen": 2000, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" },
      "Led Tube T8 1.2m 24W": { "watt": 24, "lumen": 2400, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" }
    },
    "Nhóm bộ Led tube": {
      "Bộ Led Tube T8 1.2m 20W": { "watt": 20, "lumen": 2000, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" },
      "Bộ Đôi Led Tube T8 1.2m 40W": { "watt": 40, "lumen": 4000, "beam": 120, "ip": 20, "cct": "6500K", "m_p": 0.9, "r9": 50, "b_y": 0.45, "link_anh": "" }
    },
    "Nhóm Led ốp trần cao cấp": {
      "Ốp trần 12W": { "watt": 12, "lumen": 1000, "beam": 120, "ip": 44, "cct": "4000K", "m_p": 0.8, "r9": 60, "b_y": 0.4, "link_anh": "" },
      "Ốp trần 18W": { "watt": 18, "lumen": 1600, "beam": 120, "ip": 44, "cct": "6500K", "m_p": 0.8, "r9": 60, "b_y": 0.4, "link_anh": "" },
      "Ốp trần 24W": { "watt": 24, "lumen": 2200, "beam": 120, "ip": 44, "cct": "6500K", "m_p": 0.8, "r9": 60, "b_y": 0.4, "link_anh": "" },
      "Ốp trần 36W": { "watt": 36, "lumen": 3200, "beam": 120, "ip": 44, "cct": "6500K", "m_p": 0.8, "r9": 60, "b_y": 0.4, "link_anh": "" }
    },
    "Nhóm Led Panel vuông": {
      "Panel 300x300 12W": { "watt": 12, "lumen": 1080, "beam": 120, "ip": 40, "cct": "6500K", "m_p": 0.9, "r9": 60, "b_y": 0.45, "link_anh": "" },
      "Panel 600x600 40W": { "watt": 40, "lumen": 4000, "beam": 120, "ip": 40, "cct": "6500K", "m_p": 0.9, "r9": 60, "b_y": 0.45, "link_anh": "" },
      "Panel 600x600 48W": { "watt": 48, "lumen": 4800, "beam": 120, "ip": 40, "cct": "6500K", "m_p": 0.9, "r9": 60, "b_y": 0.45, "link_anh": "" },
      "Panel 600x600 72W": { "watt": 72, "lumen": 7200, "beam": 120, "ip": 40, "cct": "6500K", "m_p": 0.9, "r9": 60, "b_y": 0.45, "link_anh": "" },
      "Panel 300x1200 40W": { "watt": 40, "lumen": 4000, "beam": 120, "ip": 40, "cct": "6500K", "m_p": 0.9, "r9": 60, "b_y": 0.45, "link_anh": "" },
      "Panel 600x1200 72W": { "watt": 72, "lumen": 7200, "beam": 120, "ip": 40, "cct": "6500K", "m_p": 0.9, "r9": 60, "b_y": 0.45, "link_anh": "" }
    }
  };


  var LS_KEY = 'hiconique_lighting_catalog_v1';
  var hasLocalOverride = false;
  var tcvn = clone(TCVN_DATA);
  var catalog = clone(LAMP_CATALOG);
  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved && saved.tcvn && saved.catalog) { tcvn = saved.tcvn; catalog = saved.catalog; hasLocalOverride = true; }
  } catch (e) { /* cache hỏng — dùng danh mục gốc */ }

  // Bảng hệ số sử dụng U theo Ri cho 3 kiểu phản xạ trần-tường-sàn (CIE).
  var U_TABLE = {
    '70-50-20': [[0.6, 0.43], [0.8, 0.54], [1.0, 0.63], [1.25, 0.70], [1.5, 0.75], [2.0, 0.83], [2.5, 0.88], [3.0, 0.91], [4.0, 0.96], [5.0, 0.99]],
    '50-30-20': [[0.6, 0.38], [0.8, 0.48], [1.0, 0.55], [1.25, 0.62], [1.5, 0.67], [2.0, 0.75], [2.5, 0.80], [3.0, 0.83], [4.0, 0.88], [5.0, 0.91]],
    '30-10-20': [[0.6, 0.33], [0.8, 0.42], [1.0, 0.49], [1.25, 0.55], [1.5, 0.60], [2.0, 0.67], [2.5, 0.72], [3.0, 0.75], [4.0, 0.80], [5.0, 0.83]]
  };

  // inferno rút gọn (giống cmap của bản Python)
  var CMAP = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]];

  var state = {
    calc: false, L: 0, W: 0, H: 0, Hw: 0.8, req: 0, lumen: 0, watt: 0, beam: 100,
    K: 0.8, U: 0, Ueff: 0, nSuggest: 0, snap: 0.5, lamps: [], specs: null,
    grid: null, az: -35, el: 42
  };

  var $ = function (id) { return document.getElementById(id); };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? '' : s); }
  function fmt(n, d) { return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 }); }
  function toast(msg, bad) {
    var el = document.createElement('div');
    el.className = 'lt-toast' + (bad ? ' bad' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4500);
  }
  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }
  function cssVar(name, fallback) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }

  // ---------- Danh mục / TCVN (select) ----------
  function fillSelect(sel, first, items) {
    sel.innerHTML = '';
    var o = document.createElement('option'); o.value = ''; o.textContent = first; sel.appendChild(o);
    items.forEach(function (it) { var op = document.createElement('option'); op.value = it; op.textContent = it; sel.appendChild(op); });
  }
  function refreshCatalogSelects() {
    fillSelect($('ltArea'), '-- Chọn khu vực --', Object.keys(tcvn));
    fillSelect($('ltRoom'), '-- Chọn không gian --', []);
    fillSelect($('ltLampGroup'), '-- Chọn nhóm đèn --', Object.keys(catalog));
    fillSelect($('ltLampType'), '-- Chọn loại đèn --', []);
  }
  $('ltArea').addEventListener('change', function () {
    fillSelect($('ltRoom'), '-- Chọn không gian --', tcvn[this.value] ? Object.keys(tcvn[this.value]) : []);
  });
  $('ltRoom').addEventListener('change', function () {
    var a = tcvn[$('ltArea').value]; var r = a && a[this.value];
    if (r) { $('ltLux').value = r.lux; $('ltCri').value = r.cri; clearErr('ltLux'); }
  });
  $('ltLampGroup').addEventListener('change', function () {
    fillSelect($('ltLampType'), '-- Chọn loại đèn --', catalog[this.value] ? Object.keys(catalog[this.value]) : []);
  });
  $('ltLampType').addEventListener('change', function () {
    var g = catalog[$('ltLampGroup').value]; var s = g && g[this.value];
    if (!s) return;
    $('ltWatt').value = s.watt; $('ltLumen').value = s.lumen; $('ltBeam').value = s.beam;
    $('ltIp').value = s.ip; $('ltCct').value = s.cct;
    ['ltLampType', 'ltWatt', 'ltLumen', 'ltBeam'].forEach(clearErr);
  });

  // ---------- Kiểm tra nhập liệu theo từng ô ----------
  function setErr(id, msg) {
    var box = document.querySelector('[data-err="' + id + '"]'); if (box) box.textContent = msg;
    var inp = $(id); if (inp && inp.classList) inp.classList.add('invalid');
  }
  function clearErr(id) {
    var box = document.querySelector('[data-err="' + id + '"]'); if (box) box.textContent = '';
    var inp = $(id); if (inp && inp.classList) inp.classList.remove('invalid');
  }
  function readNum(id, label, opt) {
    opt = opt || {};
    clearErr(id);
    var raw = $(id).value.trim().replace(',', '.');
    if (raw === '') {
      if (opt.optional) return opt.def == null ? 0 : opt.def;
      setErr(id, 'Nhập ' + label); return NaN;
    }
    var v = Number(raw);
    if (!isFinite(v)) { setErr(id, label + ' phải là số'); return NaN; }
    if (opt.gt != null && !(v > opt.gt)) { setErr(id, label + ' phải lớn hơn ' + opt.gt); return NaN; }
    if (opt.min != null && v < opt.min) { setErr(id, label + ' tối thiểu ' + opt.min); return NaN; }
    if (opt.max != null && v > opt.max) { setErr(id, label + ' tối đa ' + opt.max); return NaN; }
    return v;
  }
  ['ltL', 'ltW', 'ltH', 'ltHw', 'ltLux', 'ltWatt', 'ltLumen', 'ltBeam'].forEach(function (id) {
    $(id).addEventListener('input', function () { clearErr(id); });
    $(id).addEventListener('blur', function () {
      var t = this.value.trim().replace(',', '.'); if (t.charAt(0) === '.') t = '0' + t;
      var n = Number(t); if (t !== '' && isFinite(n)) this.value = String(n);
    });
  });

  // ---------- Tính toán quang thông ----------
  function interp(x, pts) {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (var i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        var a = pts[i - 1], b = pts[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return pts[pts.length - 1][1];
  }

  function calculate() {
    var L = readNum('ltL', 'chiều dài', { gt: 0 });
    var W = readNum('ltW', 'chiều rộng', { gt: 0 });
    var H = readNum('ltH', 'chiều cao trần', { gt: 0 });
    var Hw = readNum('ltHw', 'chiều cao mặt làm việc', { min: 0 });
    var req = readNum('ltLux', 'LUX yêu cầu', { gt: 0 });
    var lumen = readNum('ltLumen', 'quang thông', { gt: 0 });
    var watt = readNum('ltWatt', 'công suất', { optional: true, min: 0 });
    var beam = readNum('ltBeam', 'góc chiếu', { optional: true, def: 100, gt: 0, max: 180 });
    if ([L, W, H, Hw, req, lumen, watt, beam].some(isNaN)) { toast('Kiểm tra lại các ô báo đỏ.', true); return; }
    if (H <= Hw) { setErr('ltH', 'Trần phải cao hơn mặt làm việc (' + Hw + ' m)'); toast('Chiều cao trần phải lớn hơn chiều cao mặt làm việc.', true); return; }

    var Hm = Math.max(0.1, H - Hw);
    var Ri = (L * W) / (Hm * (L + W));
    var K = Number($('ltMaint').value);
    var U = interp(Ri, U_TABLE[$('ltReflect').value]);
    // Đèn beam hẹp ít thất thoát ra tường/trần hơn giả định của bảng U (tham chiếu 120°).
    var beamCorr = Math.min(1.5, 1 + Math.max(0, 120 - beam) / 200);
    var Ueff = Math.min(U * beamCorr, 0.98);
    var area = L * W;
    // ceil (bản Python dùng round nên có thể thiếu ~1 lux so với yêu cầu, báo 'chưa đạt' ngay sau khi tính)
    var n = Math.max(1, Math.ceil(((req * area) / (Ueff * K)) / lumen - 1e-9));

    var specs = null;
    var g = catalog[$('ltLampGroup').value];
    if (g && g[$('ltLampType').value]) specs = g[$('ltLampType').value];

    state.calc = true;
    Object.assign(state, { L: L, W: W, H: H, Hw: Hw, req: req, lumen: lumen, watt: watt, beam: beam, K: K, U: U, Ueff: Ueff, nSuggest: n, specs: specs });
    state.snap = Math.max(L, W) > 20 ? 1 : 0.5;
    $('ltSnapLabel').textContent = fmt(state.snap, 1) + ' m';
    state.lamps = initialLayout(n, L, W, state.snap);
    refresh();
  }

  // Đặt ĐÚNG n bóng: chia đều vào các hàng, mỗi hàng chia đều theo chiều dài, rồi bắt lưới.
  function initialLayout(n, L, W, snap) {
    var cols = Math.max(1, Math.ceil(Math.sqrt(n * L / W)));
    var rows = Math.max(1, Math.ceil(n / cols));
    var pts = [], taken = {};
    function key(x, y) { return x + ',' + y; }
    function place(x, y) {
      var sx = clampTo(Math.round(x / snap) * snap, 0, L), sy = clampTo(Math.round(y / snap) * snap, 0, W);
      if (taken[key(sx, sy)]) {
        var found = false;
        for (var r = 1; r <= 6 && !found; r++) {
          for (var dx = -r; dx <= r && !found; dx++) for (var dy = -r; dy <= r && !found; dy++) {
            var nx = sx + dx * snap, ny = sy + dy * snap;
            if (nx < 0 || ny < 0 || nx > L || ny > W || taken[key(nx, ny)]) continue;
            sx = nx; sy = ny; found = true;
          }
        }
        if (!found) return;
      }
      taken[key(sx, sy)] = true; pts.push({ x: sx, y: sy });
    }
    var base = Math.floor(n / rows), extra = n % rows;
    for (var r = 0; r < rows; r++) {
      var cnt = base + (r < extra ? 1 : 0);
      for (var i = 0; i < cnt; i++) place((i + 0.5) * L / cnt, (r + 0.5) * W / rows);
    }
    return pts;
  }
  function clampTo(v, a, b) { return Math.min(b, Math.max(a, v)); }

  // ---------- Mô phỏng độ rọi (chuẩn hoá theo phương pháp quang thông) ----------
  function simulate(nx, ny) {
    var L = state.L, W = state.W, h = Math.max(0.1, state.H - state.Hw);
    var half = Math.min(85, Math.max(5, state.beam / 2)) * Math.PI / 180;
    var nExp = Math.log(0.5) / Math.log(Math.cos(half)); // cos^n giảm còn 50% tại nửa góc chiếu
    var data = new Float64Array(nx * ny), sum = 0;
    for (var j = 0; j < ny; j++) {
      var y = (j + 0.5) * W / ny;
      for (var i = 0; i < nx; i++) {
        var x = (i + 0.5) * L / nx, e = 0;
        for (var k = 0; k < state.lamps.length; k++) {
          var dx = x - state.lamps[k].x, dy = y - state.lamps[k].y;
          var d2 = dx * dx + dy * dy + h * h, cosT = h / Math.sqrt(d2);
          e += Math.pow(cosT, nExp) * cosT / d2;
        }
        data[j * nx + i] = e; sum += e;
      }
    }
    var mean = sum / data.length, n = state.lamps.length;
    var target = n * state.lumen * state.Ueff * state.K / (L * W);
    var scale = mean > 0 ? target / mean : 0;
    var mn = Infinity, mx = 0;
    for (var t = 0; t < data.length; t++) { data[t] *= scale; if (data[t] < mn) mn = data[t]; if (data[t] > mx) mx = data[t]; }
    if (!isFinite(mn)) mn = 0;
    return { nx: nx, ny: ny, data: data, min: mn, max: mx, avg: target };
  }

  function colorAt(t) {
    t = clampTo(t, 0, 1) * (CMAP.length - 1);
    var i = Math.min(CMAP.length - 2, Math.floor(t)), f = t - i, a = CMAP[i], b = CMAP[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  // ---------- Thẻ kết quả ----------
  function setText(id, v) { $(id).textContent = v; }
  function updateCard() {
    var n = state.lamps.length, area = state.L * state.W, s = state.specs;
    setText('ltBrand', ($('ltLampGroup').value || 'DÒNG SẢN PHẨM').toUpperCase());
    setText('ltName', $('ltLampType').value || 'Tự nhập thông số');
    setText('ltQty', n + ' bóng' + (n !== state.nSuggest ? ' (đề xuất ' + state.nSuggest + ')' : ''));
    setText('ltCriOut', $('ltCri').value ? '≥ ' + $('ltCri').value + ' Ra' : '—');
    setText('ltCctOut', $('ltCct').value || '—');
    setText('ltMp', s && s.m_p != null ? s.m_p : '—');
    setText('ltR9', s && s.r9 != null ? s.r9 : '—');
    setText('ltBy', s && s.b_y != null ? s.b_y : '—');
    setText('ltTotalLm', fmt(n * state.lumen, 0) + ' Lm');
    setText('ltTotalW', state.watt ? fmt(n * state.watt, 0) + ' W' : '—');
    setText('ltWm2', state.watt ? fmt(n * state.watt / area, 2) + ' W/m²' : '—');

    var box = $('ltImg'), link = s && s.link_anh ? String(s.link_anh).trim() : '';
    box.innerHTML = '';
    if (/^https?:\/\//i.test(link)) {
      var img = document.createElement('img'); img.alt = $('ltLampType').value || 'Ảnh thiết bị';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () { box.textContent = 'Lỗi tải ảnh'; };
      img.src = link; box.appendChild(img);
    } else { box.textContent = 'Ảnh minh họa thiết bị'; }

    var g = state.grid, st = $('ltStatus');
    if (!n) {
      setText('ltAvg', '0 lux'); setText('ltMinMax', '—'); setText('ltUni', '—');
      st.className = 'lt-status bad'; st.textContent = 'Chưa có bóng nào — click vào mặt bằng để thêm.';
      return;
    }
    setText('ltAvg', fmt(g.avg, 0) + ' lux');
    setText('ltMinMax', fmt(g.min, 0) + ' / ' + fmt(g.max, 0));
    var uni = g.avg > 0 ? g.min / g.avg : 0;
    setText('ltUni', fmt(uni, 2));
    var ok = g.avg >= state.req, msg;
    if (ok) {
      msg = 'Đạt: TB ' + fmt(g.avg, 0) + ' ≥ yêu cầu ' + fmt(state.req, 0) + ' lux';
    } else {
      var need = Math.max(1, Math.ceil(state.req * area / (state.Ueff * state.K) / state.lumen) - n);
      msg = 'Chưa đạt: thiếu ' + fmt(state.req - g.avg, 0) + ' lux — cần thêm khoảng ' + need + ' bóng';
    }
    if (uni < 0.4) msg += ' · độ đồng đều thấp (' + fmt(uni, 2) + '), nên dàn đều hơn';
    st.className = 'lt-status ' + (ok ? 'ok' : 'bad'); st.textContent = msg;
  }

  // ---------- Vẽ 2D ----------
  var c2 = $('ltCanvas2D'), c3 = $('ltCanvas3D');
  var geo2 = null;

  function fitCanvas(c, ratio) {
    var dpr = window.devicePixelRatio || 1, w = c.clientWidth || 600;
    c.width = Math.round(w * dpr); c.height = Math.round(w * ratio * dpr);
    c.style.height = Math.round(w * ratio) + 'px';
    return { dpr: dpr, w: c.width, h: c.height };
  }

  function draw2D() {
    var f = fitCanvas(c2, 0.66), ctx = c2.getContext('2d'), dpr = f.dpr;
    ctx.clearRect(0, 0, f.w, f.h);
    var text = cssVar('--color-text-muted', '#999'), line = cssVar('--color-border', '#333');
    if (!state.calc) { ctx.fillStyle = text; ctx.font = (13 * dpr) + 'px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Nhập thông số rồi bấm "Tính toán & khởi tạo lưới"', f.w / 2, f.h / 2); geo2 = null; return; }
    var mL = 44 * dpr, mR = 12 * dpr, mT = 12 * dpr, mB = 30 * dpr;
    var s = Math.min((f.w - mL - mR) / state.L, (f.h - mT - mB) / state.W);
    var ox = mL, oy = mT, rw = state.L * s, rh = state.W * s;
    geo2 = { ox: ox, oy: oy, s: s, dpr: dpr };

    var g = state.grid, off = document.createElement('canvas'); off.width = g.nx; off.height = g.ny;
    var octx = off.getContext('2d'), img = octx.createImageData(g.nx, g.ny), hi = Math.max(g.max, 1);
    for (var i = 0; i < g.data.length; i++) {
      var c = colorAt(g.data[i] / hi);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.fillStyle = cssVar('--color-surface', '#111'); ctx.fillRect(ox, oy, rw, rh);
    ctx.globalAlpha = Number($('ltOpacity').value) / 100;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, ox, oy, rw, rh);
    ctx.globalAlpha = 1;

    // lưới bắt điểm
    var step = state.snap; while (step * s < 9 * dpr) step *= 2;
    ctx.strokeStyle = isLight() ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = dpr * 0.6; ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    for (var x = 0; x <= state.L + 1e-6; x += step) { ctx.moveTo(ox + x * s, oy); ctx.lineTo(ox + x * s, oy + rh); }
    for (var y = 0; y <= state.W + 1e-6; y += step) { ctx.moveTo(ox, oy + y * s); ctx.lineTo(ox + rw, oy + y * s); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = line; ctx.lineWidth = dpr * 1.5; ctx.strokeRect(ox, oy, rw, rh);

    // nhãn trục
    ctx.fillStyle = text; ctx.font = (10 * dpr) + 'px JetBrains Mono, monospace';
    var lab = 1; while (lab * s < 34 * dpr) lab *= 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var lx = 0; lx <= state.L + 1e-6; lx += lab) ctx.fillText(fmt(lx, 1), ox + lx * s, oy + rh + 5 * dpr);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var ly = 0; ly <= state.W + 1e-6; ly += lab) ctx.fillText(fmt(ly, 1), ox - 6 * dpr, oy + ly * s);

    // bóng đèn
    ctx.strokeStyle = isLight() ? '#1565C0' : '#4DD0E1'; ctx.lineWidth = 2 * dpr;
    var r = 6 * dpr; ctx.beginPath();
    state.lamps.forEach(function (p) {
      var px = ox + p.x * s, py = oy + p.y * s;
      ctx.moveTo(px - r, py); ctx.lineTo(px + r, py); ctx.moveTo(px, py - r); ctx.lineTo(px, py + r);
    });
    ctx.stroke();

    // thang màu
    var hiV = Math.max(g.max, 1);
    $('ltLegMin').textContent = '0'; $('ltLegMax').textContent = fmt(hiV, 0);
    var stops = CMAP.map(function (c, i) { return 'rgb(' + c.join(',') + ') ' + Math.round(i / (CMAP.length - 1) * 100) + '%'; }).join(',');
    $('ltLegBar').style.background = 'linear-gradient(90deg,' + stops + ')';
  }

  function onCanvasClick(ev) {
    if (!state.calc || !geo2) return;
    var rect = c2.getBoundingClientRect();
    var px = (ev.clientX - rect.left) * (c2.width / rect.width), py = (ev.clientY - rect.top) * (c2.height / rect.height);
    var x = (px - geo2.ox) / geo2.s, y = (py - geo2.oy) / geo2.s;
    var sx = Math.round(x / state.snap) * state.snap, sy = Math.round(y / state.snap) * state.snap;
    if (sx < 0 || sx > state.L || sy < 0 || sy > state.W) return;
    var idx = -1, tol = state.snap / 2;
    for (var i = 0; i < state.lamps.length; i++) {
      if (Math.abs(state.lamps[i].x - sx) < tol && Math.abs(state.lamps[i].y - sy) < tol) { idx = i; break; }
    }
    if (idx >= 0) state.lamps.splice(idx, 1); else state.lamps.push({ x: sx, y: sy });
    refresh();
  }
  c2.addEventListener('click', onCanvasClick);

  // ---------- Vẽ 3D (chiếu song song, xoay bằng kéo chuột) ----------
  function draw3D() {
    var f = fitCanvas(c3, 0.42), ctx = c3.getContext('2d'), dpr = f.dpr;
    ctx.clearRect(0, 0, f.w, f.h);
    if (!state.calc || !state.grid) return;
    var g = state.grid, step = Math.max(1, Math.round(g.nx / 30));
    var xs = [], ys = [];
    for (var i = 0; i < g.nx; i += step) xs.push(i);
    for (var j = 0; j < g.ny; j += Math.max(1, Math.round(g.ny / 30))) ys.push(j);
    var S = Math.max(state.L, state.W), hi = Math.max(g.max, 1);
    var az = state.az * Math.PI / 180, el = state.el * Math.PI / 180;
    var ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    function P(x, y, z) { // x,y trong mét, z chuẩn hoá 0..1
      var X = (x - state.L / 2) / S, Y = (y - state.W / 2) / S, Z = z * 0.55;
      var xr = X * ca - Y * sa, yr = X * sa + Y * ca;
      return { x: xr, y: -yr * se - Z * ce, d: yr };
    }
    var quads = [], minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var a = 0; a < xs.length - 1; a++) for (var b = 0; b < ys.length - 1; b++) {
      var i0 = xs[a], i1 = xs[a + 1], j0 = ys[b], j1 = ys[b + 1];
      var pts = [[i0, j0], [i1, j0], [i1, j1], [i0, j1]].map(function (q) {
        var e = g.data[q[1] * g.nx + q[0]];
        var p = P((q[0] + 0.5) * state.L / g.nx, (q[1] + 0.5) * state.W / g.ny, e / hi);
        p.e = e; return p;
      });
      var em = (pts[0].e + pts[1].e + pts[2].e + pts[3].e) / 4, dm = (pts[0].d + pts[1].d + pts[2].d + pts[3].d) / 4;
      pts.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      quads.push({ pts: pts, e: em, d: dm });
    }
    var sc = Math.min((f.w * 0.92) / (maxX - minX || 1), (f.h * 0.74) / (maxY - minY || 1));
    var cx = f.w / 2 - (minX + maxX) / 2 * sc, cy = f.h / 2 - (minY + maxY) / 2 * sc + 12 * dpr;
    // khung nền (z = 0) để định hướng khi xoay
    ctx.strokeStyle = cssVar('--color-border-strong', '#444'); ctx.lineWidth = dpr; ctx.beginPath();
    [[0, 0], [state.L, 0], [state.L, state.W], [0, state.W]].forEach(function (c, k) {
      var p = P(c[0], c[1], 0), X = cx + p.x * sc, Y = cy + p.y * sc;
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.closePath(); ctx.stroke();
    quads.sort(function (p, q) { return q.d - p.d; }); // xa trước, gần sau
    var op = Number($('ltOpacity').value) / 100;
    quads.forEach(function (q) {
      var c = colorAt(q.e / hi);
      ctx.fillStyle = 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + op + ')';
      ctx.strokeStyle = 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',0.6)';
      ctx.lineWidth = dpr * 0.5; ctx.beginPath();
      q.pts.forEach(function (p, k) { var X = cx + p.x * sc, Y = cy + p.y * sc; if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = cssVar('--color-text-muted', '#999'); ctx.font = (11 * dpr) + 'px JetBrains Mono, monospace'; ctx.textAlign = 'left';
    ctx.fillText('Đỉnh ' + fmt(g.max, 0) + ' lux · TB ' + fmt(g.avg, 0) + ' lux · Trần ' + fmt(state.H, 1) + ' m', 10 * dpr, 16 * dpr);
  }

  var drag = null;
  c3.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el }; c3.setPointerCapture(e.pointerId); c3.style.cursor = 'grabbing'; });
  c3.addEventListener('pointermove', function (e) {
    if (!drag) return;
    state.az = drag.az + (e.clientX - drag.x) * 0.5;
    state.el = clampTo(drag.el + (e.clientY - drag.y) * 0.3, 8, 85);
    draw3D();
  });
  c3.addEventListener('pointerup', function () { drag = null; c3.style.cursor = 'grab'; });

  // ---------- Điều phối vẽ lại ----------
  function refresh() {
    if (state.calc) {
      var ratio = state.W / state.L;
      var nx = 60, ny = clampTo(Math.round(60 * ratio), 16, 90);
      state.grid = simulate(nx, ny);
      updateCard();
    }
    draw2D(); draw3D();
  }
  var rz = null;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { draw2D(); draw3D(); }, 120); });
  $('ltOpacity').addEventListener('input', function () { draw2D(); draw3D(); });
  new MutationObserver(function () { draw2D(); draw3D(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  $('ltCalcBtn').addEventListener('click', calculate);

  // ---------- Excel ----------
  function needExcel() {
    if (typeof ExcelJS === 'undefined') { toast('Thư viện Excel chưa tải xong, thử lại sau vài giây.', true); return false; }
    return true;
  }
  $('ltExportBtn').addEventListener('click', function () {
    if (!needExcel()) return;
    var wb = new ExcelJS.Workbook();
    var s1 = wb.addWorksheet('TCVN_Standards');
    s1.addRow(['Khu Vuc', 'Khong Gian', 'LUX', 'CRI']);
    Object.keys(tcvn).forEach(function (a) { Object.keys(tcvn[a]).forEach(function (r) { s1.addRow([a, r, tcvn[a][r].lux, tcvn[a][r].cri]); }); });
    var s2 = wb.addWorksheet('Product_Catalog');
    s2.addRow(['Nhom Den', 'Loai Den', 'Watt', 'Lumen', 'Do K (CCT)', 'Beam Angle', 'IP', 'M_P', 'R9', 'B_Y', 'Link Anh']);
    Object.keys(catalog).forEach(function (g) {
      Object.keys(catalog[g]).forEach(function (l) {
        var s = catalog[g][l];
        s2.addRow([g, l, s.watt, s.lumen, s.cct, s.beam, s.ip, s.m_p, s.r9, s.b_y, s.link_anh || '']);
      });
    });
    [s1, s2].forEach(function (ws) { ws.getRow(1).font = { bold: true }; ws.columns.forEach(function (c) { c.width = 22; }); });
    wb.xlsx.writeBuffer().then(function (buf) {
      var url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      var a = document.createElement('a'); a.href = url; a.download = 'HICONIQUE_Lighting_Data.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('Đã xuất file Excel (2 sheet). Thêm link ảnh vào cột cuối rồi nhập lại.');
    }).catch(function (e) { toast('Không xuất được file: ' + e.message, true); });
  });

  function cellVal(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.result != null) return v.result;
      if (v.richText) return v.richText.map(function (t) { return t.text; }).join('');
      if (v.text != null) return v.text;
    }
    return v;
  }
  function numOrNull(v) { v = cellVal(v); if (v === '' || v == null) return null; var n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
  function txt(v) { return String(cellVal(v) == null ? '' : cellVal(v)).trim(); }

  $('ltImportBtn').addEventListener('click', function () { $('ltImportFile').click(); });
  $('ltImportFile').addEventListener('change', function () {
    var file = this.files && this.files[0]; this.value = '';
    if (!file || !needExcel()) return;
    file.arrayBuffer().then(function (buf) { return new ExcelJS.Workbook().xlsx.load(buf); }).then(function (wb) {
      var report = [], newT = null, newC = null;
      var w1 = wb.getWorksheet('TCVN_Standards');
      if (w1) {
        var t = {}, ok = 0, bad = 0;
        w1.eachRow(function (row, rn) {
          if (rn === 1) return;
          var area = txt(row.getCell(1).value), room = txt(row.getCell(2).value), lux = numOrNull(row.getCell(3).value), cri = numOrNull(row.getCell(4).value);
          if (!area || !room || lux == null || !(lux > 0) || isNaN(lux) || cri == null || isNaN(cri) || cri < 0) { if (area || room) bad++; return; }
          (t[area] = t[area] || {})[room] = { lux: lux, cri: cri }; ok++;
        });
        if (ok) newT = t;
        report.push('TCVN: ' + ok + ' dòng hợp lệ' + (bad ? ', bỏ ' + bad + ' dòng lỗi' : ''));
      }
      var w2 = wb.getWorksheet('Product_Catalog');
      if (w2) {
        var c = {}, ok2 = 0, bad2 = 0;
        w2.eachRow(function (row, rn) {
          if (rn === 1) return;
          var g = txt(row.getCell(1).value), l = txt(row.getCell(2).value);
          var watt = numOrNull(row.getCell(3).value), lm = numOrNull(row.getCell(4).value), beam = numOrNull(row.getCell(6).value);
          var ip = numOrNull(row.getCell(7).value), mp = numOrNull(row.getCell(8).value), r9 = numOrNull(row.getCell(9).value), by = numOrNull(row.getCell(10).value);
          var bad = !g || !l || watt == null || isNaN(watt) || watt < 0 || lm == null || isNaN(lm) || lm <= 0 || beam == null || isNaN(beam) || beam <= 0 || beam > 180 || isNaN(ip) || isNaN(mp) || isNaN(r9) || isNaN(by);
          if (bad) { if (g || l) bad2++; return; }
          var link = txt(row.getCell(11).value);
          (c[g] = c[g] || {})[l] = { watt: watt, lumen: lm, beam: beam, ip: ip == null ? 20 : ip, cct: txt(row.getCell(5).value), m_p: mp, r9: r9, b_y: by, link_anh: /^https?:\/\//i.test(link) ? link : '' };
          ok2++;
        });
        if (ok2) newC = c;
        report.push('Đèn: ' + ok2 + ' dòng hợp lệ' + (bad2 ? ', bỏ ' + bad2 + ' dòng lỗi' : ''));
      }
      if (!newT && !newC) { toast('Không có dòng hợp lệ nào để nhập. ' + report.join(' · '), true); return; }
      if (newT) tcvn = newT;
      if (newC) catalog = newC;
      hasLocalOverride = true;
      try { localStorage.setItem(LS_KEY, JSON.stringify({ tcvn: tcvn, catalog: catalog })); } catch (e) { /* đầy bộ nhớ — vẫn dùng được trong phiên này */ }
      refreshCatalogSelects();
      toast('Đã cập nhật danh mục. ' + report.join(' · '));
    }).catch(function (e) { toast('Không đọc được file Excel: ' + e.message, true); });
  });

  $('ltResetCatalogBtn').addEventListener('click', function () {
    tcvn = clone(TCVN_DATA); catalog = clone(LAMP_CATALOG); hasLocalOverride = false;
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* bỏ qua */ }
    applySheetCatalogs();
    refreshCatalogSelects();
    toast('Đã quay về danh mục gốc (theo Sheet TTCS- nếu có).');
  });

  // ---------- Đồng bộ với Google Sheet nhóm TTCS- ----------
  // Sheet là nguồn danh mục chính (quản lý sửa thẳng trên Sheet). Bản nhúng ở
  // trên chỉ là dự phòng khi Sheet trống/offline. Ô TRUE/FALSE trên Sheet có
  // thể về dạng chữ nên phía TaskManager đã xử lý (lightingOff_).
  function numOr(v, d) { var n = Number(String(v).replace(',', '.')); return v === '' || v == null || !isFinite(n) ? d : n; }
  var TM = window.TaskManager;

  function applySheetCatalogs() {
    if (!TM || !TM.getLightingStandards) return;
    var std = TM.getLightingStandards(), lamps = TM.getLightingLamps(), fac = TM.getLightingFactors();
    if (!hasLocalOverride) {
      var t = {};
      std.forEach(function (r) {
        if (!r.area || !r.room || !isFinite(Number(r.lux)) || Number(r.lux) <= 0) return;
        (t[r.area] = t[r.area] || {})[r.room] = { lux: Number(r.lux), cri: numOr(r.cri, 0) };
      });
      if (Object.keys(t).length) tcvn = t;
      var c = {};
      lamps.forEach(function (r) {
        var lm = Number(r.lumen);
        if (!r.group || !r.name || !isFinite(lm) || lm <= 0) return;
        (c[r.group] = c[r.group] || {})[r.name] = {
          watt: numOr(r.watt, 0), lumen: lm, beam: numOr(r.beam, 100), ip: numOr(r.ip, 20), cct: String(r.cct == null ? '' : r.cct),
          m_p: numOr(r.mp, 0), r9: numOr(r.r9, 0), b_y: numOr(r.by, 0), link_anh: /^https?:\/\//i.test(r.imageUrl || '') ? r.imageUrl : ''
        };
      });
      if (Object.keys(c).length) catalog = c;
    }
    // Hệ số U (theo kiểu phản xạ) và K (môi trường) — thay bảng nhúng nếu Sheet có đủ điểm
    var u = {}, labels = {}, ks = [];
    fac.forEach(function (r) {
      if (r.type === 'U' && r.group && isFinite(Number(r.ri)) && isFinite(Number(r.value))) {
        (u[r.group] = u[r.group] || []).push([Number(r.ri), Number(r.value)]); labels[r.group] = r.label || '';
      } else if (r.type === 'K' && isFinite(Number(r.value)) && Number(r.value) > 0 && Number(r.value) <= 1) {
        ks.push({ v: Number(r.value), label: r.label || '' });
      }
    });
    var ukeys = Object.keys(u).filter(function (k) { return u[k].length >= 2; });
    if (ukeys.length) {
      ukeys.forEach(function (k) { U_TABLE[k] = u[k].sort(function (a, b) { return a[0] - b[0]; }); });
      var rs = $('ltReflect'), cur = rs.value;
      rs.innerHTML = '';
      Object.keys(U_TABLE).forEach(function (k) {
        var o = document.createElement('option'); o.value = k; o.textContent = k + (labels[k] ? ' · ' + labels[k] : ''); rs.appendChild(o);
      });
      if (U_TABLE[cur]) rs.value = cur;
    }
    if (ks.length) {
      var ms = $('ltMaint'), curK = ms.value;
      ms.innerHTML = '';
      ks.sort(function (a, b) { return b.v - a.v; }).forEach(function (k) {
        var o = document.createElement('option'); o.value = String(k.v); o.textContent = fmt(k.v, 2) + (k.label ? ' · ' + k.label : ''); ms.appendChild(o);
      });
      if (ks.some(function (k) { return String(k.v) === curK; })) ms.value = curK;
    }
  }

  // ---------- Phương án đã lưu (TTCS-Phương án) ----------
  function me() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function selVal(id, v) { var el = $(id); el.value = v; el.dispatchEvent(new Event('change')); }
  function markInvalid(el) { el.classList.add('invalid'); el.addEventListener('input', function f() { el.classList.remove('invalid'); el.removeEventListener('input', f); }); }

  function renderPlans() {
    var box = $('ltPlanList');
    var plans = TM && TM.getLightingPlans ? TM.getLightingPlans() : [];
    var u = me();
    box.innerHTML = '';
    if (!plans.length) { box.innerHTML = '<div class="lt-hint">Chưa có phương án nào được lưu.</div>'; return; }
    plans.slice(0, 30).forEach(function (p) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border:1px solid var(--lt-border); border-radius:8px;';
      var info = document.createElement('div');
      info.style.cssText = 'min-width:0; font-size:0.75rem;';
      var b = document.createElement('div'); b.style.fontWeight = '600'; b.textContent = p.name || '(không tên)';
      var sub = document.createElement('div'); sub.className = 'lt-hint';
      sub.textContent = fmt(p.length, 1) + '×' + fmt(p.width, 1) + ' m · ' + (p.lampCount || 0) + ' bóng · TB ' + fmt(p.avgLux, 0) + ' lux' + (p.verdict ? ' · ' + String(p.verdict).split(':')[0] : '');
      info.appendChild(b); info.appendChild(sub);
      var acts = document.createElement('div'); acts.style.cssText = 'display:flex; gap:6px; flex:none;';
      var open = document.createElement('button'); open.type = 'button'; open.className = 'lt-btn lt-btn-ghost'; open.textContent = 'Mở';
      open.addEventListener('click', function () { loadPlan(p); });
      acts.appendChild(open);
      if (u && (p.createdBy === u.id || u.roleLevel === 'admin' || u.roleLevel === 'manager')) {
        var hide = document.createElement('button'); hide.type = 'button'; hide.className = 'lt-btn lt-btn-ghost'; hide.textContent = 'Ẩn';
        hide.addEventListener('click', function () {
          if (!window.confirm('Ẩn phương án "' + (p.name || '') + '"? (Dòng vẫn còn trên Sheet, chỉ tắt cột Hiển thị)')) return;
          if (TM.hideLightingPlan(p.id, u)) { renderPlans(); toast('Đã ẩn phương án.'); } else toast('Bạn không có quyền ẩn phương án này.', true);
        });
        acts.appendChild(hide);
      }
      row.appendChild(info); row.appendChild(acts); box.appendChild(row);
    });
  }

  function savePlan() {
    var u = me();
    if (!u) { toast('Cần đăng nhập để lưu phương án.', true); return; }
    if (!state.calc) { toast('Hãy bấm "Tính toán" trước khi lưu phương án.', true); return; }
    var name = $('ltPlanName').value.trim();
    if (!name) { markInvalid($('ltPlanName')); toast('Nhập tên phương án.', true); return; }
    var g = state.grid || { avg: 0, min: 0, max: 0 };
    var n = state.lamps.length, w = state.watt || 0;
    var pa = {
      name: name, projectId: $('ltPlanProject').value, note: $('ltPlanNote').value.trim(),
      length: state.L, width: state.W, height: state.H, workplane: state.Hw,
      reflect: $('ltReflect').value, maintenance: state.K,
      standardArea: $('ltArea').value, standardRoom: $('ltRoom').value, reqLux: state.req, reqCri: $('ltCri').value,
      lampGroup: $('ltLampGroup').value, lampName: $('ltLampType').value, lampLumen: state.lumen, lampWatt: state.watt,
      lampCct: $('ltCct').value, lampBeam: state.beam, lampIp: $('ltIp').value,
      suggestCount: state.nSuggest, lampCount: n,
      lamps: JSON.stringify(state.lamps.map(function (l) { return [Math.round(l.x * 100) / 100, Math.round(l.y * 100) / 100]; })),
      avgLux: Math.round(g.avg), minLux: Math.round(g.min), maxLux: Math.round(g.max),
      uniformity: g.avg > 0 ? Math.round(g.min / g.avg * 100) / 100 : 0,
      totalWatt: Math.round(n * w * 10) / 10, wattPerM2: Math.round(n * w / (state.L * state.W) * 100) / 100,
      verdict: $('ltStatus').textContent.trim()
    };
    if (TM.saveLightingPlan(pa, u)) { $('ltPlanName').value = ''; $('ltPlanNote').value = ''; renderPlans(); toast('Đã lưu phương án "' + name + '".'); }
    else toast('Không lưu được phương án.', true);
  }

  function loadPlan(p) {
    $('ltL').value = p.length; $('ltW').value = p.width; $('ltH').value = p.height; $('ltHw').value = p.workplane;
    if (U_TABLE[p.reflect]) $('ltReflect').value = p.reflect;
    $('ltMaint').value = String(p.maintenance);
    if (p.standardArea && tcvn[p.standardArea]) { selVal('ltArea', p.standardArea); if (tcvn[p.standardArea][p.standardRoom]) selVal('ltRoom', p.standardRoom); }
    $('ltLux').value = p.reqLux; if (p.reqCri !== '' && p.reqCri != null) $('ltCri').value = p.reqCri;
    if (p.lampGroup && catalog[p.lampGroup]) { selVal('ltLampGroup', p.lampGroup); if (catalog[p.lampGroup][p.lampName]) selVal('ltLampType', p.lampName); }
    // Thông số đèn lấy đúng như lúc lưu (danh mục có thể đã đổi từ đó)
    $('ltLumen').value = p.lampLumen; $('ltWatt').value = p.lampWatt; $('ltBeam').value = p.lampBeam;
    if (p.lampIp !== '' && p.lampIp != null) $('ltIp').value = p.lampIp;
    if (p.lampCct !== '' && p.lampCct != null) $('ltCct').value = p.lampCct;
    calculate();
    if (!state.calc) return;
    try {
      var arr = JSON.parse(p.lamps || '[]');
      var ok = Array.isArray(arr) && arr.length && arr.every(function (l) { return Array.isArray(l) && isFinite(l[0]) && isFinite(l[1]); });
      if (ok) { state.lamps = arr.map(function (l) { return { x: clampTo(Number(l[0]), 0, state.L), y: clampTo(Number(l[1]), 0, state.W) }; }); refresh(); }
    } catch (e) { /* vị trí hỏng — giữ lưới khởi tạo */ }
    toast('Đã mở phương án "' + (p.name || '') + '".');
  }

  $('ltPlanSaveBtn').addEventListener('click', savePlan);
  function fillProjects() {
    try {
      var sel = $('ltPlanProject'), cur = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      (TM && TM.getProjects ? TM.getProjects() : []).forEach(function (p) {
        var o = document.createElement('option'); o.value = p.id; o.textContent = p.name || p.id; sel.appendChild(o);
      });
      sel.value = cur;
    } catch (e) { /* không có dự án — bỏ qua */ }
  }

  applySheetCatalogs();
  refreshCatalogSelects();
  fillProjects();
  renderPlans();
  refresh();
  // Tải danh mục + phương án mới nhất từ Sheet rồi áp dụng (giữ lựa chọn hiện tại nếu còn)
  if (TM && TM.loadLightingData) {
    var stEl = $('ltSyncState'); if (stEl) stEl.textContent = 'Đang đồng bộ…';
    TM.loadLightingData(function (out) {
      var got = out.lightingStandards.length + out.lightingLamps.length + out.lightingFactors.length;
      var keep = { a: $('ltArea').value, r: $('ltRoom').value, g: $('ltLampGroup').value, t: $('ltLampType').value };
      applySheetCatalogs();
      refreshCatalogSelects();
      if (keep.a && tcvn[keep.a]) { selVal('ltArea', keep.a); if (tcvn[keep.a][keep.r]) $('ltRoom').value = keep.r; }
      if (keep.g && catalog[keep.g]) { selVal('ltLampGroup', keep.g); if (catalog[keep.g][keep.t]) $('ltLampType').value = keep.t; }
      renderPlans();
      if (stEl) stEl.textContent = got ? 'Đã đồng bộ Sheet' : 'Sheet TTCS- chưa có dữ liệu — dùng danh mục nhúng';
    });
  }
})();
