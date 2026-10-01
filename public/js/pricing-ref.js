/**
 * Tab "Hướng dẫn" và "Nguồn" (pricing.html) — nội dung đưa thẳng vào web (trước đây đọc lại từ các sheet DGXD-Hướng dẫn / DGXD-Nguồn).
 * Sửa nội dung: sửa mảng dưới đây (hoặc báo để cập nhật). Giao diện dạng thẻ + bảng, có ô tìm nguồn.
 */
var PricingRef = (function () {
  'use strict';
  var STEPS = [
    ['Chọn đúng tỉnh/thành ở tab "Đơn giá theo tỉnh".', 'Nếu tỉnh mới gồm nhiều địa bàn cũ, cần lấy lại báo giá theo đúng vùng giao thực tế.'],
    ['Chọn đúng spec, mác/cấp bền, kích thước, đơn vị và hãng tương đương.', 'Không so thép CB240 với CB400; không so gạch ceramic với porcelain.'],
    ['Đọc trực tiếp cột giá thấp, giá trung bình và giá cao của tỉnh.', 'Các giá đã được chuẩn hóa trực tiếp cho tỉnh; không nhân thêm hệ số.'],
    ['Lọc theo nhóm, mã, loại vật tư hoặc nhà cung cấp để lập danh sách hỏi giá.', 'Nên mời tối thiểu 3 NCC cùng spec và cùng điều kiện giao.'],
    ['Cộng các khoản chưa gồm trước khi chốt hợp đồng.', 'Kiểm tra VAT, cự ly vượt chuẩn, cấm tải, bốc xếp/lên tầng, bơm xa, hao hụt và mẫu đặc biệt.']
  ];
  var COLS = [
    ['Giá thấp / Giá cao', 'Khoảng ngân sách trực tiếp tại tỉnh cho đúng spec ghi ở dòng.', 'Dùng làm khung dự trù; chốt giá bằng báo giá NCC.'],
    ['Giá TB', 'Trung bình (thấp + cao) ÷ 2, làm tròn nghìn đồng — web tự tính.', 'Dùng khi cần một con số duy nhất để lập ngân sách sơ bộ.'],
    ['VL', 'Vật liệu trong phạm vi spec của công tác.', 'Không cộng lại VL nếu đã chọn đơn giá hoàn chỉnh (DGHT).'],
    ['NC', 'Nhân công thực hiện công tác.', 'Kiểm tra rõ phạm vi, máy/giàn giáo và điều kiện thi công.'],
    ['DGHT', 'Đơn giá hoàn chỉnh = VL + NC trong phạm vi ghi tại dòng. Web đối chiếu và cảnh báo ⚠ nếu dữ liệu ghi lệch >1.000 đ.', 'Dùng để dự trù nhanh; vẫn phải nhân khối lượng và kiểm tra loại trừ.'],
    ['NCC', 'Nhà cung cấp, hãng hoặc nhóm đơn vị cần mời chào giá.', 'Xác minh đại lý, CO/CQ, bảo hành, thời gian và địa điểm giao.']
  ];
  var NOTES = [
    ['Phạm vi', 'Giá tham khảo ngân sách nhà dân, chưa thay thế hồ sơ dự toán hoặc báo giá tại thời điểm ký hợp đồng.'],
    ['Thuế/phí', 'Mặc định chưa VAT, trừ khi báo giá của NCC ghi rõ khác.'],
    ['Biến động', 'Thép, xi măng, cát/đá và bê tông nên cập nhật hàng tuần hoặc trước mỗi đợt đặt hàng.'],
    ['Hợp đồng', 'Khóa rõ spec, brand-list, mẫu duyệt, điều kiện giao, hao hụt, bảo hành và các khoản loại trừ.']
  ];
  var TOOLS = [
    ['Khái toán nhanh', 'Tính diện tích quy đổi và ngân sách thấp – điển hình – cao theo tỉnh, loại nhà và gói thi công.', 'Trước khi thiết kế/ký hợp đồng'],
    ['Khối lượng sơ bộ', 'Ước tính nhanh thép, bê tông, gạch, hoàn thiện và MEP; định mức sửa được, đơn giá tự dò theo tỉnh.', 'Chuẩn bị ngân sách/hỏi giá'],
    ['So sánh nhà thầu', 'Đưa ba báo giá về cùng phạm vi và chấm điểm kỹ thuật – thương mại.', 'Chọn nhà thầu'],
    ['Dòng tiền', 'Chia giá trị hợp đồng theo mốc nghiệm thu và theo dõi đã thanh toán.', 'Ký hợp đồng/thi công'],
    ['Phát sinh', 'Ghi nhận khối lượng, đơn giá, trạng thái duyệt và bằng chứng trước khi làm.', 'Trong thi công'],
    ['Tiến độ', 'Lập lịch dự kiến và cập nhật ngày thực tế, trạng thái chậm/hoàn thành.', 'Trong thi công'],
    ['Nghiệm thu', '50 điểm kiểm tra từ móng đến bàn giao.', 'Trước khi che khuất/thanh toán'],
    ['Hồ sơ công trình', 'Theo dõi giấy phép, bản vẽ, CO/CQ, biên bản, hoàn công và bảo hành.', 'Suốt vòng đời công trình']
  ];
  var SOURCES = [
    ['S01', 'Chính phủ', '34 đơn vị hành chính cấp tỉnh từ 12/6/2025', 'https://xaydungchinhsach.chinhphu.vn/chi-tiet-34-don-vi-hanh-chinh-cap-tinh-tu-12-6-2025-119250612141845533.htm'],
    ['S02', 'Viện Kinh tế xây dựng - Bộ Xây dựng', 'Cổng thông tin giá VLXD, nhân công, ca máy và công bố địa phương', 'https://kinhtexaydung.gov.vn/thong-tin-cong-bo/'],
    ['S03', 'Sở Xây dựng Hà Nội / Viện KTXD', 'Công bố 01.02/2026/CBGVL-SXD ngày 24/04/2026', 'https://kinhtexaydung.gov.vn/thong-tin-cong-bo/cong-bo-gia-mot-so-vat-lieu-xay-dung-thang-4-nam-2026/'],
    ['S04', 'Viện Kinh tế xây dựng', 'Trang giá công bố của các địa phương', 'https://kinhtexaydung.gov.vn/chuyen-muc-thong-tin-cong-bo/gia-cong-bo-cua-dia-phuong/'],
    ['S05', 'Thép Hòa Phát', 'TCVN 1651:2018 và thông số CB300/CB400', 'https://thep.hoaphat.com.vn/tin-cong-nghe/thep-hoa-phat-cb300-va-cb400.html'],
    ['S06', 'VICEM', 'Danh mục PC/PCB/xi măng bền sunfat và tiêu chuẩn áp dụng', 'https://vicem.vn/'],
    ['S07', 'Viglacera', 'Thông tin gạch AAC và cấp cường độ', 'https://www.viglacera.com.vn/blog/gach-be-tong-khi-viglacera-cap-cuong-do-6'],
    ['S08', 'An Cường', 'Tỷ trọng và tiêu chuẩn phát thải ván công nghiệp', 'https://ancuong.com/kien-thuc/vat-lieu/tieu-chuan-go-cong-nghiep.html'],
    ['S09', 'CADIVI', 'Dây cáp điện bọc PVC - TCVN 6610/IEC 60227', 'https://cadivi.vn/vn/day-cap-dien-boc-nhua-pvc.html'],
    ['S10', 'Nhựa Tiền Phong', 'Danh mục ống và phụ tùng uPVC, PP-R', 'https://nhuatienphong.vn/san-pham.html'],
    ['S11', 'INAX Việt Nam', 'Thông số kích thước và cấu hình thiết bị vệ sinh', 'https://www.inax.com.vn/vi/news/kich-thuoc-bon-cau/'],
    ['S12', 'Vĩnh Tường', 'Bảng cấu hình và giá đề nghị hệ trần thạch cao', 'https://vinhtuong.com/bang-gia-de-nghi-vinh-tuong'],
    ['S13', 'An Cường', 'Giá tham khảo ván MDF/MFC/Plywood 2026', 'https://ancuong.com/kien-thuc/vat-lieu/gia-van-go-cong-nghiep.html'],
    ['S14', 'Khảo sát xưởng nội thất', 'Giá tủ bếp MDF chống ẩm theo mét dài 2026', 'https://tubepminhlong.vn/'],
    ['S17', 'Khảo sát đại lý thép', 'Giá thép xây dựng Hòa Phát và thương hiệu theo vùng 2026', 'https://thepbaotin.com/gia-thep-xay-dung-hoa-phat-hom-nay-tang-hay-giam/'],
    ['S18', 'Khảo sát trạm bê tông', 'Giá bê tông thương phẩm M150-M350 và phụ gia', 'https://betongtuoisaigon.com/bao-gia-be-tong-tuoi/'],
    ['S19', 'Khảo sát tổng kho xi măng', 'Khoảng giá xi măng PCB30/PCB40 năm 2026', 'https://scgvlxd.com/gia-xi-mang/'],
    ['S20', 'Khảo sát VLXD', 'Khoảng giá cát, đá xây dựng và điều kiện giao', 'https://vatlieuxaydungbinhchanh.com/bang-gia-cat-da-xay-dung-moi-nhat'],
    ['S21', 'Khảo sát vật liệu chống thấm', 'Giá bán lẻ hệ chống thấm 2 thành phần', 'https://tavaco.vn/'],
    ['S22', 'Khảo sát đại lý gạch', 'Giá gạch ceramic/porcelain 600x600', 'https://viglaceravietnam.com/bao-gia/gach-op-lat-viglacera'],
    ['S23', 'Khảo sát đại lý sơn', 'Giá Dulux và vật tư sơn 2026', 'https://tavaco.vn/'],
    ['S24', 'Khảo sát đơn vị cửa', 'Giá cửa nhôm hệ 55/93 năm 2026', 'https://www.xingfa.vn/bao-gia-cua-nhom-xingfa/'],
    ['S25', 'Khảo sát nhà máy cửa', 'Giá cửa gỗ công nghiệp HDF/MDF 2026', 'https://hoabinhdoor.com/'],
    ['S26', 'Khảo sát đại lý thiết bị vệ sinh', 'Giá thiết bị INAX 2026', 'https://bighousevietnam.com/bang-gia-thiet-bi-ve-sinh-inax/'],
    ['S27', 'Khảo sát vật liệu chống thấm', 'Danh mục và khoảng giá Sika theo hệ ứng dụng', 'https://chongtham.info.vn/'],
    ['S28', 'Khảo sát đại lý ống nước', 'Bảng giá và quy cách ống Nhựa Bình Minh', 'https://ongbinhminh.vn/cap-nhat-gia-ong-nhua-binh-minh-2022-chinh-xac-chi-tiet-nhat/'],
    ['S29', 'Khảo sát đại lý dây cáp', 'Bảng giá dây và cáp điện CADIVI', 'https://etinco.vn/bang-gia-day-cap-dien-cadivi/'],
    ['S30', 'Khảo sát phụ kiện nội thất', 'Danh mục và khoảng giá phụ kiện tủ Cariny', 'https://minhlonghome.com.vn/phu-kien-cariny/'],
    ['S31', 'Viện Kinh tế xây dựng - Bộ Xây dựng', 'Cổng công bố đơn giá nhân công xây dựng của địa phương', 'https://kinhtexaydung.gov.vn/chuyen-muc-thong-tin-cong-bo/gia-cong-bo-cua-dia-phuong-gia-nhan-cong-xay-dung/'],
    ['S32', 'Sở Xây dựng Ninh Bình', 'Công bố đơn giá nhân công xây dựng trên địa bàn tỉnh', 'https://soxaydung.ninhbinh.gov.vn/quyet-dinh-ve-viec-cong-bo-don-gia-nhan-cong-xay-dung-tren-dia-ban-tinh-ninh-binh-820.html'],
    ['S33', 'Khảo sát thị trường nhà dân', 'Khoảng giá khoán nhân công phần xây dựng nhà phố', 'https://symhouse.com/nhan-cong-xay-dung-phan-tho/'],
    ['S34', 'Khảo sát thị trường điện nước', 'Khoảng giá nhân công điện nước dân dụng theo m2', 'https://diennuoctanphat.com/don-gia-thi-cong-dien-nuoc-theo-m2-la-bao-nhieu-78-25.html'],
    ['S35', 'NAMI Design', 'Đơn giá nhân công xây dựng 2026 theo nhà cấp 4, nhà phố và biệt thự', 'https://namidesign.vn/dich-vu/don-gia-nhan-cong-xay-dung'],
    ['S36', 'Xây Dựng Việt Nhật', 'Đơn giá xây nhà cấp 4 trọn gói năm 2026', 'https://vietnhatgroup.com/gia-xay-nha-cap-4/'],
    ['S37', 'Xây Dựng Song Phát', 'Đơn giá nhà phố phần thô và trọn gói năm 2026', 'https://xaynhasaigon.vn/du-an-hoan-thanh/don-gia-xay-dung-nha-tho-va-tron-goi/'],
    ['S38', 'Xây Dựng An Cư', 'Đơn giá biệt thự hiện đại và tân cổ điển năm 2026', 'https://xaydungancu.com.vn/gia-xay-dung-biet-thu']
  ];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase(); }
  var T = 'width:100%;border-collapse:collapse;font-size:.8125rem;', TH = 'text-align:left;font-size:.6875rem;text-transform:uppercase;letter-spacing:.04em;color:var(--pr-muted);font-weight:600;padding:9px 14px;border-bottom:1px solid var(--pr-border);', TD = 'padding:10px 14px;border-bottom:1px solid var(--pr-border);vertical-align:top;';
  function sec(title, inner) { return '<div style="padding:18px 24px 6px;font-weight:700;font-size:.75rem;letter-spacing:.05em;text-transform:uppercase;color:var(--pr-bronze);">' + title + '</div><div style="overflow-x:auto;">' + inner + '</div>'; }
  function table(head, rows, widths) { return '<table style="' + T + '"><thead><tr>' + head.map(function (h, i) { return '<th style="' + TH + (widths && widths[i] ? 'width:' + widths[i] + ';' : '') + '">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td style="' + TD + (i === 0 ? 'font-weight:600;white-space:nowrap;' : '') + '">' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }
  function renderGuide(wrap) {
    wrap.className = '';
    wrap.innerHTML = sec('Cách tra đơn giá — 5 bước', table(['Bước', 'Thao tác', 'Điểm kiểm soát'], STEPS.map(function (s, i) { return [String(i + 1), esc(s[0]), esc(s[1])]; }), ['60px', '45%'])) +
      sec('Cách hiểu các cột giá', table(['Ký hiệu', 'Ý nghĩa', 'Cách dùng'], COLS.map(function (c) { return [esc(c[0]), esc(c[1]), esc(c[2])]; }), ['150px', '45%'])) +
      sec('Lưu ý quan trọng', table(['Mục', 'Nội dung'], NOTES.map(function (n) { return [esc(n[0]), esc(n[1])]; }), ['150px'])) +
      sec('Các công cụ trong trang này', table(['Công cụ', 'Dùng để làm gì', 'Thời điểm sử dụng'], TOOLS.map(function (n) { return [esc(n[0]), esc(n[1]), esc(n[2])]; }), ['170px', '50%']));
  }
  // ---- rà soát nguồn theo tháng (THỦ CÔNG, chỉ quản lý đánh dấu) + chỗ gắn khóa API (chưa dùng) ----
  function monthNow() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function vnMonth(m) { var p = String(m || '').split('-'); return p.length > 1 ? p[1] + '/' + p[0] : '—'; }
  function renderSources(wrap, ctx) {
    ctx = ctx || {};
    var canEdit = !!(ctx.canEdit && ctx.canEdit()), api = ctx.api || '', jget = ctx.jget, status = {};
    wrap.className = '';
    wrap.innerHTML = '<div id="prSrcSum" style="padding:14px 24px 0;font-size:.8125rem;"></div><div style="padding:10px 24px 0;"><input class="pr-input" id="prSrcQ" type="search" placeholder="Tìm nguồn: mã, tổ chức, nội dung…" style="max-width:360px"></div><div style="overflow-x:auto;" id="prSrcTbl"></div><div id="prSrcSet"></div>';
    function badge(s) {
      var cur = monthNow();
      if (!s || !s.checkedMonth) return '<span style="color:var(--pr-muted)">Chưa rà soát</span>';
      var lbl = s.status === 'changed' ? 'Có thay đổi giá' : (s.status === 'dead' ? 'Nguồn lỗi' : 'Không đổi'), col = s.status === 'changed' ? '#B5402A' : (s.status === 'dead' ? '#B5402A' : '#2E7D4A');
      return '<b style="color:' + (s.checkedMonth === cur ? col : '#B08D57') + '">' + (s.checkedMonth === cur ? '✓ ' : '') + vnMonth(s.checkedMonth) + '</b> · ' + lbl + (s.checkedBy ? '<span style="display:block;font-size:.6875rem;color:var(--pr-muted)">' + esc(s.checkedBy) + (s.note ? ' — ' + esc(s.note) : '') + '</span>' : '');
    }
    function draw(q) {
      var toks = norm(q).split(/\s+/).filter(Boolean), list = SOURCES.filter(function (s) { var h = norm(s.join(' ')); return toks.every(function (t) { return h.indexOf(t) !== -1; }); }), cur = monthNow();
      var done = SOURCES.filter(function (s) { return status[s[0]] && status[s[0]].checkedMonth === cur; }), ch = done.filter(function (s) { return status[s[0]].status === 'changed'; }).length, dead = done.filter(function (s) { return status[s[0]].status === 'dead'; }).length;
      wrap.querySelector('#prSrcSum').innerHTML = '<b>Tháng ' + vnMonth(cur) + ':</b> đã rà ' + done.length + '/' + SOURCES.length + ' nguồn · <span style="color:#B5402A">' + ch + ' có thay đổi giá cần cập nhật</span> · ' + dead + ' nguồn lỗi' + (canEdit ? '' : ' <span style="color:var(--pr-muted)">(quản lý mới đánh dấu được)</span>');
      wrap.querySelector('#prSrcTbl').innerHTML = table(['Mã', 'Tổ chức / NCC', 'Nội dung sử dụng', 'Liên kết', 'Rà soát gần nhất'].concat(canEdit ? ['Đánh dấu tháng này'] : []), list.map(function (s) {
        return [esc(s[0]), esc(s[1]), esc(s[2]), '<a href="' + esc(s[3]) + '" target="_blank" rel="noopener">Mở nguồn ↗</a>', badge(status[s[0]])].concat(canEdit ? ['<select class="pr-quote-select" data-src="' + esc(s[0]) + '" style="min-width:170px"><option value="">— Chọn —</option><option value="ok">Đã rà – không đổi</option><option value="changed">Có thay đổi giá</option><option value="dead">Nguồn lỗi / không mở được</option></select>'] : []);
      }), ['70px', '20%', '', '110px', '22%']) + (list.length ? '' : '<div class="pr-empty">Không có nguồn nào khớp.</div>');
    }
    wrap.querySelector('#prSrcQ').addEventListener('input', function () { draw(this.value); });
    wrap.querySelector('#prSrcTbl').addEventListener('change', function (e) {
      var sel = e.target.closest('[data-src]'); if (!sel || !sel.value || !jget) return;
      var code = sel.getAttribute('data-src'), s = SOURCES.filter(function (x) { return x[0] === code; })[0], note = prompt('Ghi chú cho nguồn ' + code + ' (không bắt buộc):', '') || '';
      var rec = { id: code, org: s[1], content: s[2], url: s[3], checkedMonth: monthNow(), status: sel.value, checkedBy: ctx.userName ? ctx.userName() : '', note: note };
      sel.disabled = true;
      jget(api + '?action=upsertPriceSource&data=' + encodeURIComponent(JSON.stringify(rec)), 2).then(function () { status[code] = rec; draw(wrap.querySelector('#prSrcQ').value); }).catch(function (err) { sel.disabled = false; alert('Không lưu được: ' + (err && err.message || err)); });
    });
    draw('');
    if (jget && api) jget(api + '?action=getPriceSources').then(function (l) { (Array.isArray(l) ? l : []).forEach(function (r) { status[r.id] = r; }); draw(wrap.querySelector('#prSrcQ').value); }).catch(function () { /* chưa có sheet DG-Nguồn thì thôi */ });
    if (canEdit && jget && api) renderApiBox(wrap.querySelector('#prSrcSet'), ctx);
  }
  // Chỗ gắn khóa API cập nhật giá (CHƯA dùng): lưu ở sheet DG-Cài đặt, không bao giờ trả khóa về trình duyệt (chỉ hiện 4 ký tự cuối)
  function renderApiBox(box, ctx) {
    var api = ctx.api, jget = ctx.jget;
    box.innerHTML = '<div style="margin:22px 24px 8px;padding:16px 18px;border:1px dashed var(--pr-border);border-radius:14px;"><div style="font-weight:700;font-size:.8125rem;margin-bottom:4px;">Kết nối AI cập nhật giá <span style="font-weight:600;font-size:.6875rem;padding:2px 8px;border-radius:999px;border:1px solid var(--pr-border);color:var(--pr-muted);margin-left:6px;">CHƯA BẬT · đang làm thủ công</span></div>' +
      '<div style="font-size:.75rem;color:var(--pr-muted);line-height:1.6;margin-bottom:12px;">Khi có khóa API (có phí), dán vào đây để sau này máy đọc nguồn và đề xuất giá mới vào hàng chờ duyệt. Hiện tại <b>chưa có tự động hóa nào chạy</b> — mọi cập nhật giá vẫn do người nhập ở nút "Sửa giá". Khóa lưu ở sheet <code>DG-Cài đặt</code> (chỉ nhân sự có quyền xem Sheet mới thấy), không hiển thị lại trên web.</div>' +
      '<div style="display:grid;grid-template-columns:2fr 1fr auto;gap:10px;align-items:end;"><div><span style="font-size:.6875rem;color:var(--pr-muted);text-transform:uppercase;">Khóa API (Anthropic)</span><input class="pr-input mono" id="prApiKey" type="password" autocomplete="off" placeholder="sk-ant-…"></div><div><span style="font-size:.6875rem;color:var(--pr-muted);text-transform:uppercase;">Mô hình</span><input class="pr-input" id="prApiModel" type="text" value="claude-sonnet-5-5"></div><button type="button" class="pr-btn pr-btn-primary" id="prApiSave">Lưu</button></div>' +
      '<div id="prApiState" style="font-size:.75rem;color:var(--pr-muted);margin-top:10px;">Đang kiểm tra…</div></div>';
    var state = box.querySelector('#prApiState');
    function load() { jget(api + '?action=getPriceSettings').then(function (l) { l = Array.isArray(l) ? l : []; var k = l.filter(function (x) { return x.id === 'anthropic_api_key'; })[0], m = l.filter(function (x) { return x.id === 'ai_model'; })[0]; if (m && m.value) box.querySelector('#prApiModel').value = m.value; state.innerHTML = k && k.set ? 'Đã gắn khóa <b>' + esc(k.masked) + '</b> · tự động hóa: <b>TẮT</b> <button type="button" class="pr-btn pr-btn-ghost" id="prApiDel" style="padding:3px 10px;font-size:.6875rem;margin-left:6px">Gỡ khóa</button>' : 'Chưa gắn khóa · tự động hóa: <b>TẮT</b>'; var d = box.querySelector('#prApiDel'); if (d) d.addEventListener('click', function () { if (confirm('Gỡ khóa API khỏi sheet DG-Cài đặt?')) save('anthropic_api_key', '', 'Khóa API Anthropic (bí mật)').then(load); }); }).catch(function () { state.textContent = 'Chưa đọc được cài đặt.'; }); }
    function save(id, value, note) { return jget(api + '?action=savePriceSetting&data=' + encodeURIComponent(JSON.stringify({ id: id, value: value, note: note || '' })), 2); }
    box.querySelector('#prApiSave').addEventListener('click', function () {
      var key = box.querySelector('#prApiKey').value.trim(), model = box.querySelector('#prApiModel').value.trim();
      var jobs = [save('ai_model', model || 'claude-sonnet-5-5', 'Mô hình AI dùng khi bật cập nhật giá'), save('auto_update', 'off', 'Tự động hóa cập nhật giá: off = thủ công')];
      if (key) jobs.push(save('anthropic_api_key', key, 'Khóa API Anthropic (bí mật)'));
      Promise.all(jobs).then(function () { box.querySelector('#prApiKey').value = ''; load(); }).catch(function (err) { alert('Không lưu được: ' + (err && err.message || err)); });
    });
    load();
  }
  function renderSourcesOld_(wrap) {
    wrap.className = '';
    wrap.innerHTML = '<div style="padding:14px 24px 0;"><input class="pr-input" id="prSrcQ" type="search" placeholder="Tìm nguồn: mã, tổ chức, nội dung…" style="max-width:360px"></div><div style="overflow-x:auto;" id="prSrcTbl"></div>';
    function draw(q) {
      var toks = norm(q).split(/\s+/).filter(Boolean), list = SOURCES.filter(function (s) { var h = norm(s.join(' ')); return toks.every(function (t) { return h.indexOf(t) !== -1; }); });
      wrap.querySelector('#prSrcTbl').innerHTML = table(['Mã', 'Tổ chức / NCC', 'Nội dung sử dụng', 'Liên kết'], list.map(function (s) { return [esc(s[0]), esc(s[1]), esc(s[2]), '<a href="' + esc(s[3]) + '" target="_blank" rel="noopener">Mở nguồn ↗</a>']; }), ['70px', '24%', '', '120px']) + (list.length ? '' : '<div class="pr-empty">Không có nguồn nào khớp.</div>');
    }
    wrap.querySelector('#prSrcQ').addEventListener('input', function () { draw(this.value); }); draw('');
  }
  return { renderGuide: renderGuide, renderSources: renderSources, SOURCES: SOURCES };
})();
