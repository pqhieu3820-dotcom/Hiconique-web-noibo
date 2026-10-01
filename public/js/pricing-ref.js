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
  function renderSources(wrap) {
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
