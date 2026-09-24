/**
 * Khái toán nhanh — bóc tách sơ bộ ngân sách cải tạo/thi công nội thất theo
 * diện tích + hạng mục chọn, dùng để tư vấn khách ngay buổi gặp đầu (không
 * thay thế bóc khối lượng/báo giá chính thức). Đơn giá trong OPTIONS là mức
 * tham khảo thị trường nội thất căn hộ tại HICONIQUE — CEO/Sale có thể sửa
 * trực tiếp file này nếu cần cập nhật đơn giá.
 *
 * Phương án lưu bằng localStorage (không đồng bộ Sheet — chỉ là nháp so
 * sánh tại chỗ trên máy đang dùng, giống quy ước "Lưu PA" không cần chờ
 * server của công cụ gốc tham khảo).
 */
(function () {
  'use strict';

  var LS_KEY = 'hiconique_khaitoan_scenarios_v1';

  function fmtMoney(n) { return Math.round(Number(n) || 0).toLocaleString('vi-VN') + ' ₫'; }
  function fmtDate(d) {
    if (!d) return '—';
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0');
  }
  function fmtDateFull(d) {
    if (!d) return '—';
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
  }
  function addDays(date, days) { var d = new Date(date); d.setDate(d.getDate() + Math.round(days)); return d; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Mô hình đơn giá (VNĐ) ----------
  // ctx = { area, bedrooms, bathrooms }
  var OPTION_GROUPS = [
    {
      title: '1. Cải tạo thô & trần tường',
      items: [
        {
          id: 'demolition', type: 'tier', label: 'Phá dỡ & xây mới',
          desc: 'Đục phá tường ngăn, xây trát, vận chuyển phế thải',
          tiers: [
            { value: '0', label: 'Không', price: function () { return 0; } },
            { value: '20', label: '20%', price: function (c) { return c.area * 0.2 * 420000; } },
            { value: '50', label: '50%', price: function (c) { return c.area * 0.5 * 420000; } },
            { value: '100', label: '100%', price: function (c) { return c.area * 420000; } }
          ], default: '0'
        },
        { id: 'wcReno', type: 'toggle', label: 'Cải tạo WC', desc: 'Đục phá, chống thấm, ốp lát lại', price: function (c) { return c.bathrooms * 9000000; } },
        { id: 'stairReno', type: 'toggle', label: 'Cải tạo cầu thang', desc: 'Xây bê tông, ốp lát, xử lý chi tiết', price: function () { return 15000000; } },
        { id: 'ceiling', type: 'toggle', label: 'Trần thạch cao mới', desc: 'Khung xương, tấm chống ẩm, giật cấp khe rèm âm', price: function (c) { return c.area * 380000; } },
        { id: 'wallPaint', type: 'toggle', label: 'Sơn bả tường trần', desc: 'Bả matit 2 lớp, sơn lót kháng kiềm + phủ cao cấp', price: function (c) { return c.area * 210000; } }
      ]
    },
    {
      title: '2. Hoàn thiện sàn',
      items: [
        {
          id: 'floor', type: 'tier', label: 'Sàn gỗ / gạch', desc: 'Bao gồm vật tư + nhân công lát nền',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'mid', label: 'Tầm trung', price: function (c) { return c.area * 380000; } },
            { value: 'premium', label: 'Cao cấp', price: function (c) { return c.area * 680000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '3. MEP & chiếu sáng',
      items: [
        {
          id: 'lighting', type: 'tier', label: 'Đèn chiếu sáng',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn', price: function (c) { return c.area * 170000; } },
            { value: 'premium', label: 'Cao cấp', price: function (c) { return c.area * 310000; } }
          ], default: 'none'
        },
        {
          id: 'electrical', type: 'tier', label: 'Cải tạo điện & công tắc',
          tiers: [
            { value: 'keep', label: 'Giữ nguyên', price: function () { return 0; } },
            { value: 'light', label: 'Cải tạo nhẹ', price: function (c) { return c.area * 55000; } },
            { value: 'full', label: 'Đi mới toàn bộ', price: function (c) { return c.area * 175000; } }
          ], default: 'keep'
        },
        {
          id: 'smartHome', type: 'tier', label: 'Điện thông minh (Smart Home)',
          tiers: [
            { value: 'none', label: 'Không', desc: '0 đ', price: function () { return 0; } },
            { value: 'std', label: 'Gói tiêu chuẩn', desc: '~28 triệu — điều khiển đèn, điều hoà, rèm, cảm biến', price: function () { return 28000000; } },
            { value: 'premium', label: 'Gói cao cấp', desc: '~85 triệu — tự động hoá toàn bộ, scene & an ninh', price: function () { return 85000000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '4. Đồ gỗ nội thất',
      items: [
        {
          id: 'builtinFurniture', type: 'tier', label: 'Đồ gỗ liền tường',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'economy', label: 'Tiết kiệm', desc: 'Cốt MDF chống ẩm, Melamine phổ thông', price: function (c) { return c.area * 2200000; } },
            { value: 'std', label: 'Tiêu chuẩn', desc: 'Melamine An Cường/Minh Long, kịch trần', price: function (c) { return c.area * 3400000; } },
            { value: 'premium', label: 'Cao cấp', desc: 'Laminate/Sơn/Fenix, phối cánh kính', price: function (c) { return c.area * 5000000; } }
          ], default: 'none'
        },
        {
          id: 'looseFurniture', type: 'tier', label: 'Đồ rời, đồ may đo',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn', desc: 'Sofa, bàn ăn, giường ngủ', price: function (c) { return 18000000 + c.bedrooms * 16000000; } },
            { value: 'premium', label: 'Cao cấp', desc: 'Sofa da, bàn trà mặt đá, giường bọc da', price: function (c) { return 30000000 + c.bedrooms * 30000000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '5. Đá hoàn thiện',
      items: [
        {
          id: 'stone', type: 'tier', label: 'Đá bàn bếp / lavabo',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'quartz', label: 'Thạch anh (Vicostone/Vasta)', price: function (c) { return c.area * 650000; } },
            { value: 'sintered', label: 'Đá nung kết (Neolith/Dekton)', price: function (c) { return c.area * 1050000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '6. Thiết bị',
      items: [
        {
          id: 'kitchenEquip', type: 'tier', label: 'Thiết bị bếp',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn (Garis)', price: function () { return 32000000; } },
            { value: 'premium', label: 'Cao cấp (Hafele, Blum)', price: function () { return 68000000; } }
          ], default: 'none'
        },
        {
          id: 'wcEquip', type: 'tier', label: 'Thiết bị vệ sinh',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn', price: function (c) { return c.bathrooms * 11000000; } },
            { value: 'premium', label: 'Cao cấp', price: function (c) { return c.bathrooms * 24000000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '7. Rèm cửa',
      items: [
        {
          id: 'curtain', type: 'tier', label: 'Rèm cửa',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Rèm thường', price: function (c) { return c.area * 130000; } },
            { value: 'smart', label: 'Rèm điện thông minh', price: function (c) { return c.area * 260000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '★ Thiết bị điện tử bổ sung',
      items: [
        {
          id: 'ac', type: 'tier', label: 'Điều hoà không khí',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'wall', label: 'Treo tường Inverter', price: function (c) { return (c.bedrooms + 1) * 13000000; } },
            { value: 'ceiling', label: 'Âm trần nối ống gió', price: function (c) { return (c.bedrooms + 1) * 21000000; } }
          ], default: 'none'
        },
        { id: 'ventilation', type: 'toggle', label: 'Thông gió & khí tươi', desc: 'Máy cấp khí tươi thu hồi nhiệt', price: function () { return 26000000; } }
      ]
    }
  ];

  var STYLE_MULTIPLIER = { modern: 1, luxury: 1.25 };

  function getCtx() {
    return {
      area: Math.max(1, Number(document.getElementById('ktArea').value) || 1),
      bedrooms: Number(document.getElementById('ktBedrooms').value) || 1,
      bathrooms: Number(document.getElementById('ktBathrooms').value) || 1
    };
  }

  function getState() {
    var state = {};
    OPTION_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.type === 'toggle') {
          var el = document.querySelector('[data-opt="' + it.id + '"]');
          state[it.id] = el ? el.checked : false;
        } else {
          var checked = document.querySelector('input[name="tier-' + it.id + '"]:checked');
          state[it.id] = checked ? checked.value : it.default;
        }
      });
    });
    return state;
  }

  function setState(state) {
    OPTION_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.type === 'toggle') {
          var el = document.querySelector('[data-opt="' + it.id + '"]');
          if (el) el.checked = !!(state && state[it.id]);
        } else {
          var val = (state && state[it.id] != null) ? state[it.id] : it.default;
          var radio = document.querySelector('input[name="tier-' + it.id + '"][value="' + val + '"]');
          if (radio) radio.checked = true;
        }
      });
    });
    refreshOptionStyles();
    recalc();
  }

  // ---------- Render form hạng mục ----------
  function renderOptions() {
    var html = '';
    OPTION_GROUPS.forEach(function (g) {
      html += '<div class="kt-group"><div class="kt-group-title">' + escapeHtml(g.title) + '</div>';
      g.items.forEach(function (it) {
        if (it.type === 'toggle') {
          html += '<label class="kt-opt" data-opt-wrap="' + it.id + '">' +
            '<input type="checkbox" data-opt="' + it.id + '">' +
            '<span class="kt-opt-text"><span class="kt-opt-label">' + escapeHtml(it.label) + '</span>' +
            (it.desc ? '<span class="kt-opt-desc">' + escapeHtml(it.desc) + '</span>' : '') +
            '</span></label>';
        } else {
          html += '<div data-opt-wrap="' + it.id + '" style="margin-bottom:4px;">' +
            '<div class="kt-opt-label" style="padding:0 9px;">' + escapeHtml(it.label) + (it.desc ? ' <span class="kt-opt-desc" style="display:inline;">— ' + escapeHtml(it.desc) + '</span>' : '') + '</div>' +
            '<div class="kt-tier-row">' +
            it.tiers.map(function (t) {
              return '<label class="kt-tier-btn" data-tier-wrap="' + it.id + ':' + t.value + '"><input type="radio" name="tier-' + it.id + '" value="' + t.value + '" style="display:none;" ' + (t.value === it.default ? 'checked' : '') + '>' + escapeHtml(t.label) + '</label>';
            }).join('') +
            '</div></div>';
        }
      });
      html += '</div>';
    });
    document.getElementById('ktOptionsBody').innerHTML = html;

    document.querySelectorAll('[data-opt]').forEach(function (el) { el.addEventListener('change', function () { refreshOptionStyles(); recalc(); }); });
    document.querySelectorAll('input[type="radio"][name^="tier-"]').forEach(function (el) { el.addEventListener('change', function () { refreshOptionStyles(); recalc(); }); });
    document.querySelectorAll('[data-tier-wrap]').forEach(function (label) {
      label.addEventListener('click', function () { setTimeout(function () { refreshOptionStyles(); recalc(); }, 0); });
    });
    refreshOptionStyles();
  }

  function refreshOptionStyles() {
    document.querySelectorAll('[data-opt-wrap]').forEach(function (wrap) {
      var id = wrap.getAttribute('data-opt-wrap');
      var toggle = wrap.querySelector('[data-opt="' + id + '"]');
      if (toggle) wrap.classList.toggle('active', toggle.checked);
    });
    document.querySelectorAll('[data-tier-wrap]').forEach(function (label) {
      var radio = label.querySelector('input[type="radio"]');
      label.classList.toggle('active', !!(radio && radio.checked));
    });
  }

  // ---------- Tính toán ----------
  function findItemDef(id) {
    for (var i = 0; i < OPTION_GROUPS.length; i++) {
      for (var j = 0; j < OPTION_GROUPS[i].items.length; j++) {
        if (OPTION_GROUPS[i].items[j].id === id) return OPTION_GROUPS[i].items[j];
      }
    }
    return null;
  }

  function computeLineItems(ctx, state, styleMult) {
    var lines = [];
    OPTION_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.type === 'toggle') {
          if (state[it.id]) {
            var amt = it.price(ctx) * styleMult;
            if (amt > 0) lines.push({ label: it.label, desc: it.desc || '', amount: amt });
          }
        } else {
          var val = state[it.id];
          var tier = it.tiers.find(function (t) { return t.value === val; });
          if (tier && tier.value !== it.default) {
            var amount = tier.price(ctx) * styleMult;
            if (amount > 0) lines.push({ label: it.label + ' — ' + tier.label, desc: tier.desc || it.desc || '', amount: amount });
          }
        }
      });
    });
    return lines;
  }

  function computeTotal(ctx, state, styleMult) {
    return computeLineItems(ctx, state, styleMult).reduce(function (sum, l) { return sum + l.amount; }, 0);
  }

  // ---------- Tiến độ dự kiến ----------
  var STAGE_TEMPLATE = [
    { key: 'demo', name: 'Phá dỡ, đục phá nền & dọn phế thải', phase: 'rough', needs: function (s) { return s.demolition !== '0'; }, days: function (c) { return 5 + Math.round(c.area / 25); } },
    { key: 'masonry', name: 'Xây tường ngăn, cán nền, chống thấm WC', phase: 'rough', needs: function (s) { return s.demolition !== '0' || s.wcReno; }, days: function (c) { return 6 + Math.round(c.area / 20); } },
    { key: 'mep', name: 'Đi đường điện nước, hạ tầng kỹ thuật', phase: 'rough', needs: function (s) { return s.electrical !== 'keep' || s.lighting !== 'none' || s.smartHome !== 'none'; }, days: function (c) { return 5 + Math.round(c.area / 25); } },
    { key: 'ceiling', name: 'Đóng trần thạch cao & sơn bả tường', phase: 'rough', needs: function (s) { return s.ceiling || s.wallPaint; }, days: function (c) { return 6 + Math.round(c.area / 20); } },
    { key: 'floor', name: 'Lát sàn gỗ/gạch & bảo vệ bề mặt', phase: 'rough', needs: function (s) { return s.floor !== 'none'; }, days: function (c) { return 4 + Math.round(c.area / 30); } },
    { key: 'furnitureShop', name: 'Đo đạc & gia công đồ gỗ tại xưởng', phase: 'finish', needs: function (s) { return s.builtinFurniture !== 'none'; }, days: function () { return 18; } },
    { key: 'lighting', name: 'Lắp đặt hệ thống đèn & công tắc', phase: 'finish', needs: function (s) { return s.lighting !== 'none'; }, days: function () { return 3; } },
    { key: 'furnitureInstall', name: 'Vận chuyển & lắp đặt nội thất đồ gỗ', phase: 'finish', needs: function (s) { return s.builtinFurniture !== 'none'; }, days: function (c) { return 6 + Math.round(c.area / 30); } },
    { key: 'stoneEquip', name: 'Lắp mặt đá bếp, thiết bị bếp/WC', phase: 'finish', needs: function (s) { return s.stone !== 'none' || s.kitchenEquip !== 'none' || s.wcEquip !== 'none'; }, days: function () { return 4; } },
    { key: 'handover', name: 'Kê đồ rời, lắp rèm, vệ sinh & bàn giao', phase: 'finish', needs: function () { return true; }, days: function () { return 4; } }
  ];

  function computeTimeline(ctx, state, startDateStr) {
    var startDate = startDateStr ? new Date(startDateStr) : new Date();
    if (isNaN(startDate.getTime())) startDate = new Date();
    var activeStages = STAGE_TEMPLATE.filter(function (s) { return s.needs(state); });
    if (!activeStages.length) activeStages = [STAGE_TEMPLATE[STAGE_TEMPLATE.length - 1]];

    var roughDays = activeStages.filter(function (s) { return s.phase === 'rough'; }).reduce(function (sum, s) { return sum + s.days(ctx); }, 0);
    var finishDays = activeStages.filter(function (s) { return s.phase === 'finish'; }).reduce(function (sum, s) { return sum + s.days(ctx); }, 0);
    // Gỗ gia công song song với giai đoạn thô cuối — chỉ cộng phần dôi ra thay vì cộng dồn toàn bộ.
    var overlap = Math.min(roughDays * 0.4, finishDays * 0.5);
    var totalDays = Math.round(roughDays + finishDays - overlap);
    if (totalDays < 10) totalDays = 10;
    var calendarDays = Math.round(totalDays * 1.4); // đệm ngày nghỉ/chờ vật tư

    var cursor = new Date(startDate);
    var stageRows = activeStages.map(function (s, idx) {
      var dur = s.days(ctx);
      var rowStart = new Date(cursor);
      var rowEnd = addDays(rowStart, Math.max(1, dur - 1));
      // Giai đoạn "finish" bắt đầu gối đầu sớm khi giai đoạn "rough" đã đi được quá nửa.
      if (s.phase === 'rough' || idx === 0) cursor = addDays(rowStart, dur);
      return { num: idx + 1, name: s.name, phase: s.phase, start: rowStart, end: rowEnd };
    });

    var endDate = addDays(startDate, calendarDays);
    var roughPct = roughDays + finishDays > 0 ? Math.round((roughDays / (roughDays + finishDays)) * 100) : 0;

    return { totalDays: totalDays, calendarDays: calendarDays, startDate: startDate, endDate: endDate, roughDays: roughDays, finishDays: finishDays, roughPct: roughPct, stages: stageRows };
  }

  // ---------- Render kết quả ----------
  function recalc() {
    var ctx = getCtx();
    var state = getState();
    var style = document.getElementById('ktStyle').value;
    var styleMult = STYLE_MULTIPLIER[style] || 1;
    var lines = computeLineItems(ctx, state, styleMult);
    var total = lines.reduce(function (s, l) { return s + l.amount; }, 0);
    var perM2 = ctx.area ? total / ctx.area : 0;

    var projectName = document.getElementById('ktProjectName').value.trim() || 'Dự án chưa đặt tên';
    var styleLabel = style === 'luxury' ? 'Hiện đại Luxury' : 'Hiện đại';
    document.getElementById('ktSummaryMeta').innerHTML = '<b>' + escapeHtml(projectName) + '</b> · ' + ctx.area + ' m² (' + ctx.bedrooms + ' PN, ' + ctx.bathrooms + ' WC) · Phong cách: ' + styleLabel;
    document.getElementById('ktTotalSub').textContent = 'Suất đầu tư trung bình: ' + (perM2 / 1e6).toFixed(2).replace('.', ',') + ' triệu/m²';
    document.getElementById('ktTotalValue').textContent = fmtMoney(total);
    document.getElementById('ktGrandTotal').textContent = fmtMoney(total);

    var rowsEl = document.getElementById('ktItemRows');
    if (!lines.length) {
      rowsEl.innerHTML = '<tr><td class="kt-empty" colspan="2">Chọn hạng mục bên trái để bắt đầu khái toán.</td></tr>';
    } else {
      rowsEl.innerHTML = lines.map(function (l) {
        return '<tr><td><div class="kt-item-name">' + escapeHtml(l.label) + '</div>' + (l.desc ? '<div class="kt-item-desc">' + escapeHtml(l.desc) + '</div>' : '') + '</td><td class="num kt-amount">' + fmtMoney(l.amount) + '</td></tr>';
      }).join('');
    }

    // ---------- Tiến độ ----------
    var startDateVal = document.getElementById('ktStartDate').value;
    var tl = computeTimeline(ctx, state, startDateVal);
    document.getElementById('ktTlDays').textContent = tl.totalDays + ' ngày';
    document.getElementById('ktTlCalendar').textContent = tl.calendarDays + ' ngày';
    document.getElementById('ktTlStart').textContent = 'Khởi công: ' + fmtDate(tl.startDate);
    document.getElementById('ktTlEnd').textContent = 'Bàn giao: ' + fmtDate(tl.endDate);
    document.getElementById('ktTlBar').innerHTML =
      '<span style="width:' + tl.roughPct + '%; background:#C9852F;"></span>' +
      '<span style="width:' + (100 - tl.roughPct) + '%; background:#3B6B8C;"></span>';
    document.getElementById('ktStages').innerHTML = tl.stages.map(function (s) {
      return '<div class="kt-stage"><div class="kt-stage-num">' + s.num + '</div><div><div class="kt-stage-name">' + escapeHtml(s.name) + '</div><div class="kt-stage-date">' + fmtDate(s.start) + ' → ' + fmtDate(s.end) + '</div></div></div>';
    }).join('');

    return { ctx: ctx, state: state, style: style, lines: lines, total: total, perM2: perM2, tl: tl, projectName: projectName, styleLabel: styleLabel };
  }

  // ---------- Dự án liên kết ----------
  function renderProjectOptions() {
    var sel = document.getElementById('ktProjectLink');
    if (!sel || typeof TaskManager === 'undefined' || !TaskManager.getProjects) return;
    try {
      var projects = TaskManager.getProjects();
      var current = sel.value;
      sel.innerHTML = '<option value="">— Không gắn dự án —</option>' +
        projects.map(function (p) { return '<option value="' + p.id + '"' + (p.id === current ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>'; }).join('');
    } catch (e) { /* Sheet chưa sẵn sàng — bỏ qua, form vẫn dùng được độc lập */ }
  }

  // ---------- Lưu / so sánh phương án (localStorage) ----------
  function loadScenarios() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveScenarios(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) { /* storage đầy/bị chặn — bỏ qua im lặng, không chặn thao tác chính */ }
  }

  function renderScenarios() {
    var list = loadScenarios();
    document.getElementById('ktScenarioCount').textContent = list.length;
    var el = document.getElementById('ktScenarioList');
    if (!list.length) {
      el.innerHTML = '<p class="kt-meta" style="margin:0;">Bấm "Lưu phương án" ở bảng khái toán để so sánh nhiều cấu hình cho cùng 1 khách hàng.</p>';
      return;
    }
    el.innerHTML = list.map(function (sc, i) {
      return '<div class="kt-scenario">' +
        '<div class="kt-scenario-name">' + escapeHtml(sc.name) + '</div>' +
        '<div class="kt-scenario-meta">' + sc.area + ' m² · ' + (sc.perM2 / 1e6).toFixed(2).replace('.', ',') + ' triệu/m² · ' + fmtDateFull(sc.savedAt) + '</div>' +
        '<div class="kt-scenario-amount">' + fmtMoney(sc.total) + '</div>' +
        '<div class="kt-scenario-actions">' +
        '<button class="kt-btn kt-btn-ghost kt-btn-sm" data-load-scenario="' + i + '">Tải lại</button>' +
        '<button class="kt-btn kt-btn-danger kt-btn-sm" data-delete-scenario="' + i + '">Xoá</button>' +
        '</div></div>';
    }).join('');
    el.querySelectorAll('[data-load-scenario]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-load-scenario'));
        var sc = loadScenarios()[idx];
        if (!sc) return;
        document.getElementById('ktProjectName').value = sc.projectName || '';
        document.getElementById('ktArea').value = sc.area || 80;
        document.getElementById('ktBedrooms').value = sc.bedrooms || 2;
        document.getElementById('ktBathrooms').value = sc.bathrooms || 2;
        document.getElementById('ktStyle').value = sc.style || 'modern';
        if (sc.startDate) document.getElementById('ktStartDate').value = sc.startDate;
        setState(sc.state || {});
      });
    });
    el.querySelectorAll('[data-delete-scenario]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-delete-scenario'));
        var list2 = loadScenarios();
        list2.splice(idx, 1);
        saveScenarios(list2);
        renderScenarios();
      });
    });
  }

  function saveCurrentAsScenario() {
    var result = recalc();
    var list = loadScenarios();
    var name = result.projectName + ' — PA ' + (list.length + 1);
    list.push({
      name: name, savedAt: new Date().toISOString(), projectName: result.projectName,
      area: result.ctx.area, bedrooms: result.ctx.bedrooms, bathrooms: result.ctx.bathrooms,
      style: result.style, startDate: document.getElementById('ktStartDate').value,
      state: result.state, total: result.total, perM2: result.perM2
    });
    saveScenarios(list);
    renderScenarios();
  }

  // ---------- In / PDF ----------
  function buildPrintDoc() {
    var result = recalc();
    var rowsHtml = result.lines.map(function (l) {
      return '<tr><td>' + escapeHtml(l.label) + (l.desc ? '<br><span style="color:#666;font-size:11px;">' + escapeHtml(l.desc) + '</span>' : '') + '</td><td class="num">' + fmtMoney(l.amount) + '</td></tr>';
    }).join('');
    document.getElementById('ktPrintDoc').innerHTML =
      '<h1>KHÁI TOÁN NHANH — ' + escapeHtml(result.projectName) + '</h1>' +
      '<div class="kt-print-meta">' + result.ctx.area + ' m² · ' + result.ctx.bedrooms + ' PN, ' + result.ctx.bathrooms + ' WC · Phong cách: ' + result.styleLabel + ' · Ngày lập: ' + fmtDateFull(new Date()) + '</div>' +
      '<table><thead><tr><th>Hạng mục</th><th class="num">Thành tiền</th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="2">Chưa chọn hạng mục nào</td></tr>') + '</tbody></table>' +
      '<div class="kt-print-total">TỔNG MỨC ĐẦU TƯ KHÁI TOÁN: ' + fmtMoney(result.total) + '</div>' +
      '<p style="font-size:11px;color:#666;margin-top:16px;">* Thông tin khái toán chỉ mang tính chất tham khảo, không thay thế báo giá/hợp đồng chính thức. Dự kiến thi công ' + result.tl.totalDays + ' ngày, bàn giao ' + fmtDateFull(result.tl.endDate) + '.</p>';
  }

  // ---------- Khởi tạo ----------
  document.addEventListener('DOMContentLoaded', function () {
    renderOptions();
    renderProjectOptions();
    renderScenarios();

    var todayStr = new Date().toISOString().slice(0, 10);
    document.getElementById('ktStartDate').value = todayStr;

    ['ktProjectName', 'ktArea', 'ktBedrooms', 'ktBathrooms', 'ktStyle', 'ktStartDate'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', recalc);
      document.getElementById(id).addEventListener('change', recalc);
    });

    document.getElementById('ktResetBtn').addEventListener('click', function () {
      document.getElementById('ktProjectName').value = '';
      document.getElementById('ktProjectLink').value = '';
      document.getElementById('ktArea').value = 80;
      document.getElementById('ktBedrooms').value = 2;
      document.getElementById('ktBathrooms').value = 2;
      document.getElementById('ktStyle').value = 'modern';
      document.getElementById('ktStartDate').value = new Date().toISOString().slice(0, 10);
      setState({});
    });

    document.getElementById('ktSaveScenarioBtn').addEventListener('click', saveCurrentAsScenario);
    document.getElementById('ktClearScenariosBtn').addEventListener('click', function () {
      if (!confirm('Xoá toàn bộ phương án đã lưu trên máy này?')) return;
      saveScenarios([]);
      renderScenarios();
    });
    document.getElementById('ktPrintBtn').addEventListener('click', function () {
      buildPrintDoc();
      window.print();
    });

    setTimeout(function () { renderProjectOptions(); }, 800); // Sheet có thể load chậm hơn DOMContentLoaded
    recalc();
  });
})();
