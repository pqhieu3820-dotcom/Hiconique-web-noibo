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
  //
  // 2026-09-25: ĐỐI CHIẾU NGƯỢC với công cụ tham khảo (mnmldesign.site) bằng
  // cách nhập số thật trên trang đó (đổi diện tích/số PN/số WC/phong cách
  // từng biến một, giữ nguyên các biến khác) rồi so % thay đổi của từng dòng
  // để suy ra công thức gốc — KHÔNG đọc mã nguồn của họ, chỉ đo input/output
  // như người dùng thật. Mọi đơn giá dưới đây đã hiệu chỉnh theo kết quả đo
  // được (xem GHI_CHU_DU_AN.md mục "Khái toán nhanh — đối chiếu công thức"
  // để biết chi tiết từng phép đo). Hạng mục nào KHÔNG đo được (vì không bật
  // sẵn trong cấu hình mặc định của họ) vẫn giữ ước lượng riêng của
  // HICONIQUE, đánh dấu rõ trong comment.
  var OPTION_GROUPS = [
    {
      title: '1. Cải tạo thô & trần tường',
      items: [
        {
          // Đo được: mức % (20/50/100) KHÔNG phải là tỷ lệ của cùng 1 đơn giá
          // đầy đủ — mỗi mức có đơn giá/m² RIÊNG, không theo công thức tuyến
          // tính (20%→400k, 50%→540k, 100%→700k, đo tại 2 diện tích khác
          // nhau cho kết quả nhất quán).
          id: 'demolition', type: 'tier', label: 'Phá dỡ & xây mới',
          desc: 'Đục phá tường ngăn, xây trát, vận chuyển phế thải',
          tiers: [
            { value: '0', label: 'Không', price: function () { return 0; } },
            { value: '20', label: '20%', price: function (c) { return c.area * 400000; } },
            { value: '50', label: '50%', price: function (c) { return c.area * 540000; } },
            { value: '100', label: '100%', price: function (c) { return c.area * 700000; } }
          ], default: '0'
        },
        // Đo được: 28.000.000/WC (không phụ thuộc diện tích).
        { id: 'wcReno', type: 'toggle', label: 'Cải tạo WC', desc: 'Đục phá, chống thấm, ốp lát lại', price: function (c) { return c.bathrooms * 28000000; } },
        {
          // Đo được: gói cơ bản 45.000.000 / gói cao cấp 70.000.000 (flat,
          // không đổi theo diện tích) — đổi từ toggle bật/tắt sang tier
          // basic/luxury cho khớp với bản gốc (có 2 mức, không phải 1).
          id: 'stairReno', type: 'tier', label: 'Cải tạo cầu thang', desc: 'Xây bê tông, ốp lát, xử lý chi tiết',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'basic', label: 'Gói cơ bản', price: function () { return 45000000; } },
            { value: 'luxury', label: 'Gói cao cấp', price: function () { return 70000000; } }
          ], default: 'none'
        },
        // Đo được: 600.000/m², tuyến tính đúng theo diện tích (85→170m² x2 giá).
        // Style Luxury nhân thêm x1.2 (đo được khi so sánh Hiện đại/Luxury).
        { id: 'ceiling', type: 'toggle', styleMult: 1.2, label: 'Trần thạch cao mới', desc: 'Khung xương, tấm chống ẩm, giật cấp khe rèm âm', price: function (c) { return c.area * 600000; } },
        // Đo được: 400.000/m², tuyến tính — KHÔNG đổi khi chuyển style Luxury
        // (đo trực tiếp: 68tr ở cả 2 style tại area=170).
        { id: 'wallPaint', type: 'toggle', label: 'Sơn bả tường trần', desc: 'Bả matit 2 lớp, sơn lót kháng kiềm + phủ cao cấp', price: function (c) { return c.area * 400000; } }
      ]
    },
    {
      title: '2. Hoàn thiện sàn',
      items: [
        {
          // Tầm trung đo được 520.000/m² (tuyến tính, xác nhận x2 diện tích).
          // Cao cấp CHƯA đo được (không bật sẵn ở cấu hình mặc định của bản
          // gốc) — quy đổi theo cùng tỷ lệ cao cấp/tầm trung quan sát được ở
          // các hạng mục khác (~1.8 lần).
          id: 'floor', type: 'tier', label: 'Sàn gỗ / gạch', desc: 'Bao gồm vật tư + nhân công lát nền',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'mid', label: 'Tầm trung', price: function (c) { return c.area * 520000; } },
            { value: 'premium', label: 'Cao cấp', price: function (c) { return c.area * 930000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '3. MEP & chiếu sáng',
      items: [
        {
          // Cao cấp đo được 500.000/m² (tuyến tính). Tiêu chuẩn chưa đo được
          // trực tiếp — quy đổi theo tỷ lệ cao cấp/tiêu chuẩn ~1.8 lần.
          // Style Luxury nhân thêm x1.3 lên bất kể tier nào đang chọn (đo
          // được ở tier cao cấp: 85tr→110,5tr đúng x1.3).
          id: 'lighting', type: 'tier', styleMult: 1.3, label: 'Đèn chiếu sáng',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn', price: function (c) { return c.area * 275000; } },
            { value: 'premium', label: 'Cao cấp', price: function (c) { return c.area * 500000; } }
          ], default: 'none'
        },
        {
          // "Đi mới toàn bộ" đo được 400.000/m² (tuyến tính, không đổi theo
          // style). "Cải tạo nhẹ" chưa đo được — quy đổi theo tỷ lệ quan sát
          // được ở các hạng mục 2-tier khác (~1/3.2 của mức cao nhất).
          id: 'electrical', type: 'tier', label: 'Cải tạo điện & công tắc',
          tiers: [
            { value: 'keep', label: 'Giữ nguyên', price: function () { return 0; } },
            { value: 'light', label: 'Cải tạo nhẹ', price: function (c) { return c.area * 126000; } },
            { value: 'full', label: 'Đi mới toàn bộ', price: function (c) { return c.area * 400000; } }
          ], default: 'keep'
        },
        {
          // Đo được chính xác: gói tiêu chuẩn 29.750.000, gói cao cấp
          // 85.000.000 (flat, không phụ thuộc diện tích/phòng, không đổi
          // theo style).
          id: 'smartHome', type: 'tier', label: 'Điện thông minh (Smart Home)',
          tiers: [
            { value: 'none', label: 'Không', desc: '0 đ', price: function () { return 0; } },
            { value: 'std', label: 'Gói tiêu chuẩn', desc: '~29,75 triệu — điều khiển đèn, điều hoà, rèm, cảm biến', price: function () { return 29750000; } },
            { value: 'premium', label: 'Gói cao cấp', desc: '~85 triệu — tự động hoá toàn bộ, scene & an ninh', price: function () { return 85000000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '4. Đồ gỗ nội thất',
      items: [
        {
          // Tiêu chuẩn đo được CHÍNH XÁC: 3.600.000/m² (tuyến tính đúng theo
          // diện tích) CỘNG THÊM 61.200.000/PN và 15.300.000/WC vượt quá mức
          // tham chiếu 2PN+2WC (đo bằng cách đổi riêng từng biến, giữ nguyên
          // các biến còn lại). Tiết kiệm/Cao cấp quy đổi theo cùng tỷ lệ
          // 3.600.000 (chưa đo trực tiếp 2 tier này). Style Luxury CỘNG
          // THÊM (không nhân) area×650.000 — đo được: 612tr→722,5tr tại
          // area=170, đúng bằng +170×650.000.
          id: 'builtinFurniture', type: 'tier', styleAdd: function (c) { return c.area * 650000; }, label: 'Đồ gỗ liền tường',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'economy', label: 'Tiết kiệm', desc: 'Cốt MDF chống ẩm, Melamine phổ thông', price: function (c) { return c.area * 2330000 + Math.max(0, c.bedrooms - 2) * 61200000 + Math.max(0, c.bathrooms - 2) * 15300000; } },
            { value: 'std', label: 'Tiêu chuẩn', desc: 'Melamine An Cường/Minh Long, kịch trần', price: function (c) { return c.area * 3600000 + Math.max(0, c.bedrooms - 2) * 61200000 + Math.max(0, c.bathrooms - 2) * 15300000; } },
            { value: 'premium', label: 'Cao cấp', desc: 'Laminate/Sơn/Fenix, phối cánh kính', price: function (c) { return c.area * 5300000 + Math.max(0, c.bedrooms - 2) * 61200000 + Math.max(0, c.bathrooms - 2) * 15300000; } }
          ], default: 'none'
        },
        {
          // Tiêu chuẩn đo được CHÍNH XÁC: 56.250.000 + area×250.000 +
          // 17.437.500/PN vượt mức tham chiếu 2PN (đo tại 3 tổ hợp
          // diện tích/số PN khác nhau, khớp cả 3). Cao cấp quy đổi theo tỷ
          // lệ ~1.8 lần (đo được ở style Luxury: tiêu chuẩn nhân x1.2 khi
          // bật Luxury, nhưng CHƯA đo trực tiếp tier cao cấp gốc).
          id: 'looseFurniture', type: 'tier', styleMult: 1.2, label: 'Đồ rời, đồ may đo',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn', desc: 'Sofa, bàn ăn, giường ngủ', price: function (c) { return 56250000 + c.area * 250000 + Math.max(0, c.bedrooms - 2) * 17437500; } },
            { value: 'premium', label: 'Cao cấp', desc: 'Sofa da, bàn trà mặt đá, giường bọc da', price: function (c) { return (56250000 + c.area * 250000 + Math.max(0, c.bedrooms - 2) * 17437500) * 1.8; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '5. Đá hoàn thiện',
      items: [
        {
          // Tầm trung đo được CHÍNH XÁC: 39.200.000 + area×240.000 +
          // 7.450.000/WC vượt mức tham chiếu 2WC (đo tại 3 tổ hợp diện
          // tích/số WC khác nhau, khớp cả 3). Style Luxury CỘNG THÊM
          // (không nhân) 25.000.000 flat — đo được: 80tr→105tr tại
          // area=170. Cao cấp (đá nung kết) quy đổi theo tỷ lệ ~1.8 lần
          // (chưa đo trực tiếp).
          id: 'stone', type: 'tier', styleAdd: function () { return 25000000; }, label: 'Đá bàn bếp / lavabo',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'quartz', label: 'Thạch anh (Vicostone/Vasta)', price: function (c) { return 39200000 + c.area * 240000 + Math.max(0, c.bathrooms - 2) * 7450000; } },
            { value: 'sintered', label: 'Đá nung kết (Neolith/Dekton)', price: function (c) { return (39200000 + c.area * 240000 + Math.max(0, c.bathrooms - 2) * 7450000) * 1.8; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '6. Thiết bị',
      items: [
        {
          // Gói Garis đo được CHÍNH XÁC: 45.000.000 flat (không đổi theo
          // diện tích/số WC/style). Gói Hafele/Blum quy đổi theo tỷ lệ ~1.8
          // lần (chưa đo trực tiếp).
          id: 'kitchenEquip', type: 'tier', label: 'Thiết bị bếp',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn (Garis)', price: function () { return 45000000; } },
            { value: 'premium', label: 'Cao cấp (Hafele, Blum)', price: function () { return 81000000; } }
          ], default: 'none'
        },
        {
          // Đo được CHÍNH XÁC cả 2 tier: tiêu chuẩn 15.000.000/WC, cao cấp
          // 30.000.000/WC (flat theo mỗi WC, xác nhận tại bath=2 → 30tr/60tr).
          id: 'wcEquip', type: 'tier', label: 'Thiết bị vệ sinh',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Tiêu chuẩn', price: function (c) { return c.bathrooms * 15000000; } },
            { value: 'premium', label: 'Cao cấp', price: function (c) { return c.bathrooms * 30000000; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '7. Rèm cửa',
      items: [
        {
          // Rèm thường đo được CHÍNH XÁC: 22.500.000 + area×100.000 +
          // 10.075.000/PN vượt mức tham chiếu 2PN (đo tại 3 tổ hợp diện
          // tích/số PN, khớp cả 3). Rèm điện quy đổi theo tỷ lệ ~1.8 lần
          // (chưa đo trực tiếp).
          id: 'curtain', type: 'tier', label: 'Rèm cửa',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'std', label: 'Rèm thường', price: function (c) { return 22500000 + c.area * 100000 + Math.max(0, c.bedrooms - 2) * 10075000; } },
            { value: 'smart', label: 'Rèm điện thông minh', price: function (c) { return (22500000 + c.area * 100000 + Math.max(0, c.bedrooms - 2) * 10075000) * 1.8; } }
          ], default: 'none'
        }
      ]
    },
    {
      title: '★ Thiết bị điện tử bổ sung',
      items: [
        {
          // Đo được (tại area=170): treo tường 219.400/m², âm trần
          // 341.250/m² (cả 2 đều mô tả "quy đổi tham chiếu theo m²" trong
          // bản gốc, không phụ thuộc số phòng ngủ như ước lượng ban đầu).
          id: 'ac', type: 'tier', label: 'Điều hoà không khí',
          tiers: [
            { value: 'none', label: 'Không', price: function () { return 0; } },
            { value: 'wall', label: 'Treo tường Inverter', price: function (c) { return c.area * 219400; } },
            { value: 'ceiling', label: 'Âm trần nối ống gió', price: function (c) { return c.area * 341250; } }
          ], default: 'none'
        },
        // Đo được (tại area=170): 158.450/m² (không phải flat như ước lượng ban đầu).
        { id: 'ventilation', type: 'toggle', label: 'Thông gió & khí tươi', desc: 'Máy cấp khí tươi thu hồi nhiệt', price: function (c) { return c.area * 158450; } }
      ]
    }
  ];

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

  // Phong cách "Luxury" chỉ tác động lên ĐÚNG các hạng mục đã đo được là có
  // thay đổi khi đối chiếu ngược với bản gốc — KHÔNG áp đồng loạt cho mọi
  // hạng mục (đo trực tiếp: đổi Hiện đại → Luxury chỉ làm đổi giá của trần
  // thạch cao ×1.2, đèn ×1.3, đồ rời ×1.2, đồ gỗ liền tường +area×650.000,
  // đá +25.000.000 — các hạng mục còn lại kể cả sơn bả, sàn, điện, thiết bị
  // bếp, rèm... giữ NGUYÊN giá dù đổi style). Mỗi item khai báo tối đa 1
  // trong 2 cơ chế: `styleMult` (nhân) hoặc `styleAdd(ctx)` (cộng thêm).
  function computeLineItems(ctx, state, isLuxury) {
    var lines = [];
    OPTION_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.type === 'toggle') {
          if (state[it.id]) {
            var amt = it.price(ctx);
            if (isLuxury && it.styleMult) amt *= it.styleMult;
            if (isLuxury && it.styleAdd) amt += it.styleAdd(ctx);
            if (amt > 0) lines.push({ label: it.label, desc: it.desc || '', amount: amt });
          }
        } else {
          var val = state[it.id];
          var tier = it.tiers.find(function (t) { return t.value === val; });
          if (tier && tier.value !== it.default) {
            var amount = tier.price(ctx);
            if (isLuxury && it.styleMult) amount *= it.styleMult;
            if (isLuxury && it.styleAdd) amount += it.styleAdd(ctx);
            if (amount > 0) lines.push({ label: it.label + ' — ' + tier.label, desc: tier.desc || it.desc || '', amount: amount });
          }
        }
      });
    });
    return lines;
  }

  function computeTotal(ctx, state, isLuxury) {
    return computeLineItems(ctx, state, isLuxury).reduce(function (sum, l) { return sum + l.amount; }, 0);
  }

  // ---------- Tiến độ dự kiến ----------
  // Số ngày/hạng mục hiệu chỉnh theo lịch tiến độ 14 bước của bản gốc (đo ở
  // cấu hình mặc định 85m²: phá dỡ 10 ngày, xây/đi kỹ thuật 12 ngày, đóng
  // trần+sơn bả gộp ~11-15 ngày, lát sàn 7 ngày [khớp chính xác], gia công
  // gỗ xưởng 20 ngày, lắp đèn 4 ngày, lắp nội thất 12 ngày, lắp đá/thiết bị
  // 4 ngày [khớp chính xác], hoàn thiện bàn giao gộp 3 bước 3 ngày ~9 ngày).
  // HICONIQUE gộp còn 10 bước (thay vì 14) cho gọn — số ngày mỗi bước đã
  // cộng bù phần việc bị gộp.
  var STAGE_TEMPLATE = [
    { key: 'demo', name: 'Phá dỡ, đục phá nền & dọn phế thải', phase: 'rough', needs: function (s) { return s.demolition !== '0'; }, days: function (c) { return 7 + Math.round(c.area / 28); } },
    { key: 'masonry', name: 'Xây tường ngăn, cán nền, chống thấm WC/cầu thang', phase: 'rough', needs: function (s) { return s.demolition !== '0' || s.wcReno || (s.stairReno && s.stairReno !== 'none'); }, days: function (c) { return 8 + Math.round(c.area / 21); } },
    { key: 'mep', name: 'Đi đường điện nước, hạ tầng kỹ thuật', phase: 'rough', needs: function (s) { return s.electrical !== 'keep' || s.lighting !== 'none' || s.smartHome !== 'none'; }, days: function (c) { return 9 + Math.round(c.area / 28); } },
    { key: 'ceiling', name: 'Đóng trần thạch cao & sơn bả tường', phase: 'rough', needs: function (s) { return s.ceiling || s.wallPaint; }, days: function (c) { return 9 + Math.round(c.area / 21); } },
    { key: 'floor', name: 'Lát sàn gỗ/gạch & bảo vệ bề mặt', phase: 'rough', needs: function (s) { return s.floor !== 'none'; }, days: function (c) { return 4 + Math.round(c.area / 30); } },
    { key: 'furnitureShop', name: 'Đo đạc & gia công đồ gỗ tại xưởng', phase: 'finish', needs: function (s) { return s.builtinFurniture !== 'none'; }, days: function () { return 20; } },
    { key: 'lighting', name: 'Lắp đặt hệ thống đèn & công tắc', phase: 'finish', needs: function (s) { return s.lighting !== 'none'; }, days: function () { return 4; } },
    { key: 'furnitureInstall', name: 'Vận chuyển & lắp đặt nội thất đồ gỗ', phase: 'finish', needs: function (s) { return s.builtinFurniture !== 'none'; }, days: function (c) { return 9 + Math.round(c.area / 28); } },
    { key: 'stoneEquip', name: 'Lắp mặt đá bếp, thiết bị bếp/WC', phase: 'finish', needs: function (s) { return s.stone !== 'none' || s.kitchenEquip !== 'none' || s.wcEquip !== 'none'; }, days: function () { return 4; } },
    { key: 'handover', name: 'Kê đồ rời, lắp rèm, vệ sinh & bàn giao', phase: 'finish', needs: function () { return true; }, days: function () { return 9; } }
  ];

  // Lịch được dựng 1 LẦN DUY NHẤT bằng cách xếp tuần tự từng giai đoạn theo
  // đúng thứ tự trong STAGE_TEMPLATE (rough trước, finish sau, gối đầu vào
  // cuối rough) — số "ngày thi công" hiển thị ở khối tổng quan được TÍNH LẠI
  // từ chính lịch này (ngày kết thúc cuối cùng trừ ngày khởi công), không
  // dùng công thức cộng ngày riêng, để tránh 2 con số lệch nhau.
  function computeTimeline(ctx, state, startDateStr) {
    var startDate = startDateStr ? new Date(startDateStr) : new Date();
    if (isNaN(startDate.getTime())) startDate = new Date();

    var roughStages = STAGE_TEMPLATE.filter(function (s) { return s.phase === 'rough' && s.needs(state); });
    var finishStages = STAGE_TEMPLATE.filter(function (s) { return s.phase === 'finish' && s.needs(state); });
    if (!roughStages.length && !finishStages.length) finishStages = [STAGE_TEMPLATE[STAGE_TEMPLATE.length - 1]];

    var roughDays = roughStages.reduce(function (sum, s) { return sum + s.days(ctx); }, 0);
    var finishDays = finishStages.reduce(function (sum, s) { return sum + s.days(ctx); }, 0);

    // Xếp lịch giai đoạn Thô — tuần tự, nối tiếp nhau từ ngày khởi công.
    var cursor = new Date(startDate);
    var roughRows = roughStages.map(function (s, idx) {
      var dur = s.days(ctx);
      var rowStart = new Date(cursor);
      var rowEnd = addDays(rowStart, Math.max(1, dur - 1));
      cursor = addDays(rowStart, dur);
      return { num: idx + 1, name: s.name, phase: s.phase, start: rowStart, end: rowEnd };
    });
    var roughEndDate = cursor; // ngày kế tiếp sau khi Thô xong

    // Giai đoạn Gỗ & Hoàn thiện gối đầu vào đoạn cuối của Thô (gia công đồ gỗ
    // thường bắt đầu trước khi Thô xong hẳn) — nhưng KHÔNG được bắt đầu trước
    // ngày khởi công, và các hạng mục trong CHÍNH giai đoạn này vẫn xếp tuần
    // tự với nhau (không còn bug trùng ngày như bản cũ).
    var overlapDays = Math.round(Math.min(roughDays * 0.4, finishDays * 0.5));
    var finishStart = addDays(roughEndDate, -overlapDays);
    if (finishStart < startDate) finishStart = new Date(startDate);
    cursor = new Date(finishStart);
    var finishRows = finishStages.map(function (s, idx) {
      var dur = s.days(ctx);
      var rowStart = new Date(cursor);
      var rowEnd = addDays(rowStart, Math.max(1, dur - 1));
      cursor = addDays(rowStart, dur);
      return { num: roughRows.length + idx + 1, name: s.name, phase: s.phase, start: rowStart, end: rowEnd };
    });

    var stageRows = roughRows.concat(finishRows);
    var lastEnd = stageRows.length ? stageRows[stageRows.length - 1].end : startDate;
    // Có thể giai đoạn Thô kết thúc muộn hơn cả Gỗ & Hoàn thiện (VD không chọn
    // hạng mục hoàn thiện nào) — lấy mốc kết thúc MUỘN NHẤT trong toàn bộ lịch.
    stageRows.forEach(function (s) { if (s.end > lastEnd) lastEnd = s.end; });

    var totalDays = Math.max(1, Math.round((lastEnd - startDate) / 86400000) + 1);
    var calendarDays = Math.round(totalDays * 1.4); // đệm ngày nghỉ/chờ vật tư
    var endDate = addDays(startDate, calendarDays);
    var roughPct = (roughDays + finishDays) > 0 ? Math.round((roughDays / (roughDays + finishDays)) * 100) : 0;

    return { totalDays: totalDays, calendarDays: calendarDays, startDate: startDate, endDate: endDate, roughDays: roughDays, finishDays: finishDays, roughPct: roughPct, stages: stageRows };
  }

  // ---------- Render kết quả ----------
  function recalc() {
    var ctx = getCtx();
    var state = getState();
    var style = document.getElementById('ktStyle').value;
    var isLuxury = style === 'luxury';
    var lines = computeLineItems(ctx, state, isLuxury);
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
