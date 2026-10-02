/* Định mức hao phí NHÂN CÔNG – MÁY THI CÔNG tham khảo, khoá theo mã công tác của bảng giá DG- (AA01…AM16, W01…W30) — dùng ở estimate.html (tab "Nhân công · Máy · Ngày công").
 * ⚠ ĐÂY LÀ SỐ ƯỚC TÍNH THAM KHẢO cho công tác nhà dân dụng — KHÔNG phải trích nguyên văn định mức nhà nước (Thông tư 12/2021/TT-BXD, Quyết định 1776/BXD-VP, 1091/QĐ-BXD, 1129/QĐ-BXD và các văn bản sửa đổi).
 *   Cần đối chiếu rồi ghi đè bằng định mức chính thức: ở tab "Mã công việc" thêm mã có "Định mức hao phí" (dòng NC = công/ĐVT, dòng M = ca máy/ĐVT) hoặc nhập từ Excel — định mức trong thư viện DTQT luôn được ưu tiên hơn số này.
 * Đơn vị: nc = công (ngày công 8 giờ) trên 1 ĐVT của công tác; máy = ca máy trên 1 ĐVT. Bậc thợ bình quân ghi ở cột grade. */
(function (global) {
  'use strict';
  var list = [], map = {};
  function n(codes, name, unit, grade, nc, mach) {
    var e = { codes: codes, name: name, unit: unit, grade: grade, nc: nc, may: (mach || []).map(function (m) { return { name: m[0], qty: m[1] }; }), src: 'Ước tính tham khảo' };
    list.push(e); codes.forEach(function (c) { map[c] = e; });
  }
  var TRON = ['Máy trộn bê tông 250L', 0.095], DAM = ['Đầm dùi 1,5kW', 0.089], TV = ['Máy trộn vữa 80L', 0.003], CUT = ['Máy cắt uốn thép 5kW', 0.0003], HAN = ['Máy hàn 23kW', 0.04];
  // --- AA. Chuẩn bị, phá dỡ ---
  n(['AA01'], 'Dọn mặt bằng công trình', 'm2', '3,0/7', 0.03);
  n(['AA02'], 'Định vị tim trục nhà', 'm2 sàn', '3,5/7', 0.02, [['Máy toàn đạc / thủy bình', 0.002]]);
  n(['AA04'], 'Hàng rào tôn tạm', 'md', '3,0/7', 0.25);
  n(['AA06'], 'Phá tường gạch 100', 'm2', '2,5/7', 0.25);
  n(['AA07'], 'Phá tường gạch 200', 'm2', '2,5/7', 0.45);
  n(['AA08'], 'Phá nền gạch và lớp vữa', 'm2', '2,5/7', 0.3);
  n(['AA09'], 'Cắt phá bê tông cốt thép', 'm3', '3,0/7', 4.0, [['Máy khoan / phá bê tông', 0.5]]);
  n(['AA10'], 'Vận chuyển phế thải ≤10km', 'm3', '3,0/7', 0.2, [['Ô tô tự đổ 7T', 0.015]]);
  // --- AB. Đất, móng ---
  n(['AB01', 'W01'], 'Đào đất móng thủ công', 'm3', '2,5/7', 0.65);
  n(['AB02'], 'Đào đất móng bằng máy', 'm3', '3,0/7', 0.1, [['Máy đào 0,8m3', 0.0035]]);
  n(['W02'], 'Vận chuyển đất thải', 'm3', '3,0/7', 0.05, [['Ô tô tự đổ 7T', 0.012]]);
  n(['AB03'], 'Đắp cát nền K≥0,90', 'm3', '3,0/7', 0.6, [['Đầm cóc', 0.04]]);
  n(['AB04'], 'Đắp cấp phối đá dăm K≥0,95', 'm3', '3,0/7', 0.4, [['Lu rung / đầm cóc', 0.03]]);
  n(['AB05', 'W03'], 'Bê tông lót móng M100', 'm3', '3,0/7', 1.3, [TRON, DAM]);
  n(['AB08'], 'Ép cọc BTCT 200x200', 'md', '3,5/7', 0.06, [['Máy ép cọc thủy lực', 0.0075]]);
  n(['AB09'], 'Ép cọc BTCT 250x250', 'md', '3,5/7', 0.07, [['Máy ép cọc thủy lực', 0.0085]]);
  n(['AB14', 'W04'], 'Gia công lắp thép móng', 'kg', '3,5/7', 0.017, [CUT]);
  n(['AB15'], 'Cốp pha móng', 'm2', '3,5/7', 0.3);
  n(['W05'], 'Cốp pha móng / dầm / sàn', 'm2', '3,5/7', 0.35);
  // --- AC. Bê tông cốt thép ---
  n(['AC01'], 'Gia công lắp thép cột', 'kg', '3,5/7', 0.02, [CUT]);
  n(['AC02'], 'Gia công lắp thép dầm', 'kg', '3,5/7', 0.018, [CUT]);
  n(['AC03'], 'Gia công lắp thép sàn', 'kg', '3,5/7', 0.016, [CUT]);
  n(['AC04'], 'Lắp lưới thép hàn', 'kg', '3,5/7', 0.012);
  n(['AC07'], 'Cốp pha cột', 'm2', '3,5/7', 0.4);
  n(['AC08'], 'Cốp pha dầm', 'm2', '3,5/7', 0.42);
  n(['AC09'], 'Cốp pha sàn', 'm2', '3,5/7', 0.35);
  n(['AC10'], 'Cốp pha cầu thang', 'm2', '3,5/7', 0.55);
  n(['AC11'], 'Đổ bê tông cột M250', 'm3', '3,5/7', 1.4, [['Xe bơm bê tông', 0.0035], DAM]);
  n(['AC12', 'W06'], 'Đổ bê tông dầm sàn M250 bằng bơm', 'm3', '3,5/7', 0.9, [['Xe bơm bê tông', 0.0035], DAM]);
  n(['AC13'], 'Đổ bê tông cầu thang M250', 'm3', '3,5/7', 1.8, [['Xe bơm bê tông', 0.0035], DAM]);
  n(['AC14'], 'Bê tông mái dốc M250', 'm3', '3,5/7', 1.2, [['Xe bơm bê tông', 0.0035], DAM]);
  n(['AC15'], 'Bảo dưỡng bê tông', 'm2', '3,0/7', 0.012);
  n(['AC16'], 'Xoa nền bê tông máy', 'm2', '3,5/7', 0.03, [['Máy xoa nền', 0.003]]);
  // --- AD. Xây, trát, cán ---
  n(['AD01', 'W07'], 'Xây tường gạch 100', 'm2', '3,5/7', 0.28, [TV]);
  n(['AD02', 'W08'], 'Xây tường gạch 200', 'm2', '3,5/7', 0.42, [TV]);
  n(['AD03'], 'Xây gạch đặc 100', 'm2', '3,5/7', 0.34, [TV]);
  n(['AD04', 'W09'], 'Xây tường AAC 100', 'm2', '3,5/7', 0.17);
  n(['AD05'], 'Xây tường AAC 150', 'm2', '3,5/7', 0.2);
  n(['AD07', 'W10'], 'Trát tường trong dày 15mm', 'm2', '3,5/7', 0.19, [TV]);
  n(['AD08', 'W11'], 'Trát tường ngoài dày 15mm', 'm2', '3,5/7', 0.23, [TV]);
  n(['AD09'], 'Trát trần dày 10mm', 'm2', '3,5/7', 0.27, [TV]);
  n(['AD11'], 'Cán nền dày 20mm', 'm2', '3,0/7', 0.1, [TV]);
  n(['AD12', 'W12'], 'Cán nền dày 30–40mm', 'm2', '3,0/7', 0.13, [TV]);
  n(['AD13'], 'Láng nền xi măng đánh màu', 'm2', '3,0/7', 0.12);
  n(['AD14'], 'Lắp lưới chống nứt', 'm2', '3,0/7', 0.05);
  // --- AE. Chống thấm, mái ---
  n(['AE01', 'W13'], 'Chống thấm WC vữa 2 thành phần', 'm2', '3,5/7', 0.09);
  n(['AE02'], 'Chống thấm ban công', 'm2', '3,5/7', 0.09);
  n(['AE03'], 'Chống thấm mái vữa polymer', 'm2', '3,5/7', 0.1);
  n(['AE04', 'W14'], 'Chống thấm mái màng khò 3mm', 'm2', '3,5/7', 0.12);
  n(['AE05'], 'Chống thấm mái màng khò 4mm', 'm2', '3,5/7', 0.13);
  n(['AE11'], 'Lợp tôn 0,45mm', 'm2', '3,5/7', 0.08);
  n(['AE12'], 'Lợp tôn PU 3 lớp', 'm2', '3,5/7', 0.1);
  n(['AE13'], 'Lợp ngói màu', 'm2', '3,5/7', 0.18);
  n(['AE14'], 'Lắp máng xối inox', 'md', '3,5/7', 0.25);
  n(['AE15'], 'Lắp phễu thu mái', 'bộ', '3,5/7', 0.4);
  n(['W20'], 'Mái tôn khung thép hộp', 'm2', '3,5/7', 0.3, [HAN]);
  // --- AF. Lát, ốp ---
  n(['AF01'], 'Lát gạch ceramic 300x300', 'm2', '3,5/7', 0.14);
  n(['AF02', 'W15'], 'Lát gạch 600x600', 'm2', '3,5/7', 0.15, [['Máy cắt gạch', 0.01]]);
  n(['AF03'], 'Lát gạch 800x800', 'm2', '3,5/7', 0.17, [['Máy cắt gạch', 0.01]]);
  n(['AF04'], 'Lát gạch 600x1200', 'm2', '3,5/7', 0.22, [['Máy cắt gạch', 0.012]]);
  n(['AF05'], 'Ốp tường 250x400', 'm2', '3,5/7', 0.2, [['Máy cắt gạch', 0.01]]);
  n(['AF06', 'W16'], 'Ốp tường 300x600', 'm2', '3,5/7', 0.22, [['Máy cắt gạch', 0.01]]);
  n(['AF07'], 'Ốp gạch khổ lớn', 'm2', '4,0/7', 0.32, [['Máy cắt gạch', 0.015]]);
  n(['AF08'], 'Lát gạch giả gỗ', 'm2', '3,5/7', 0.2);
  n(['AF10', 'W22'], 'Lát / ốp đá granite cầu thang', 'm2', '4,0/7', 0.4, [['Máy cắt đá', 0.02]]);
  n(['AF12'], 'Ốp đá mặt tiền', 'm2', '4,0/7', 0.5, [['Máy cắt đá', 0.02]]);
  n(['AF13'], 'Lắp sàn gỗ 8mm', 'm2', '3,5/7', 0.08);
  n(['AF14'], 'Lắp sàn gỗ 12mm', 'm2', '3,5/7', 0.09);
  n(['AF15'], 'Lắp sàn SPC', 'm2', '3,5/7', 0.07);
  n(['AF16'], 'Chà ron epoxy', 'm2', '3,0/7', 0.05);
  // --- AG. Trần, vách, sơn ---
  n(['AG01', 'W19'], 'Trần thạch cao chìm phẳng', 'm2', '3,5/7', 0.26);
  n(['AG02'], 'Trần thạch cao giật cấp', 'm2', '3,5/7', 0.34);
  n(['AG03'], 'Trần thạch cao chống ẩm', 'm2', '3,5/7', 0.28);
  n(['AG04'], 'Trần thả 600x600', 'm2', '3,5/7', 0.16);
  n(['AG06'], 'Vách thạch cao 1 mặt', 'm2', '3,5/7', 0.3);
  n(['AG07'], 'Vách thạch cao 2 mặt', 'm2', '3,5/7', 0.4);
  n(['AG10', 'W17'], 'Bả và sơn nội thất', 'm2', '3,5/7', 0.12, [['Máy mài / máy phun sơn', 0.004]]);
  n(['AG11'], 'Sơn nội thất không bả', 'm2', '3,5/7', 0.05);
  n(['AG12', 'W18'], 'Sơn ngoại thất', 'm2', '3,5/7', 0.09);
  n(['AG13'], 'Sơn epoxy sàn hệ lăn', 'm2', '3,5/7', 0.08);
  n(['AG14'], 'Sơn PU gỗ', 'm2', '4,0/7', 0.2);
  n(['AG15'], 'Dán giấy tường', 'm2', '3,5/7', 0.1);
  // --- AH. Cửa, lan can ---
  n(['AH01'], 'Lắp vách kính cố định hệ 55', 'm2', '3,5/7', 0.35);
  n(['AH02'], 'Lắp cửa sổ mở quay hệ 55', 'm2', '3,5/7', 0.45);
  n(['AH03'], 'Lắp cửa sổ mở hất hệ 55', 'm2', '3,5/7', 0.4);
  n(['AH04'], 'Lắp cửa đi hệ 55', 'm2', '3,5/7', 0.5);
  n(['AH05'], 'Lắp cửa lùa hệ 93', 'm2', '3,5/7', 0.5);
  n(['W21'], 'Lắp cửa nhôm kính', 'm2', '3,5/7', 0.42);
  n(['AH06'], 'Lắp cửa gỗ HDF', 'bộ', '3,5/7', 1.2);
  n(['AH07'], 'Lắp cửa MDF Melamine', 'bộ', '3,5/7', 1.0);
  n(['AH08'], 'Lắp cửa composite WC', 'bộ', '3,5/7', 0.8);
  n(['AH09'], 'Lắp cửa thép chống cháy EI60', 'm2', '4,0/7', 0.7);
  n(['AH10'], 'Lắp cửa cuốn khe thoáng', 'm2', '3,5/7', 0.3);
  n(['AH11'], 'Lắp vách tắm kính', 'm2', '3,5/7', 0.5);
  n(['AH12'], 'Lan can kính trụ inox', 'md', '3,5/7', 0.5);
  n(['AH13'], 'Lan can kính pad hông', 'md', '3,5/7', 0.45);
  n(['AH14'], 'Lan can sắt hộp sơn', 'm2', '3,5/7', 0.4, [HAN]);
  n(['AH15'], 'Lắp cổng sắt hộp', 'm2', '3,5/7', 0.4, [HAN]);
  // --- AI. Thiết bị vệ sinh ---
  n(['AI01', 'W27'], 'Lắp bồn cầu 2 khối', 'bộ', '3,5/7', 0.7);
  n(['AI02'], 'Lắp bồn cầu 1 khối', 'bộ', '3,5/7', 0.8);
  n(['AI03'], 'Lắp két âm / bồn cầu treo', 'bộ', '4,0/7', 1.4);
  n(['AI04'], 'Lắp lavabo treo', 'bộ', '3,5/7', 0.6);
  n(['AI05'], 'Lắp lavabo đặt bàn', 'bộ', '3,5/7', 0.7);
  n(['AI06'], 'Lắp vòi lavabo', 'bộ', '3,5/7', 0.25);
  n(['AI07'], 'Lắp sen tắm nóng lạnh', 'bộ', '3,5/7', 0.5);
  n(['AI08'], 'Lắp sen cây', 'bộ', '3,5/7', 0.8);
  n(['AI09'], 'Lắp sen âm tường', 'bộ', '4,0/7', 1.3);
  n(['AI10'], 'Lắp ga thoát sàn', 'cái', '3,5/7', 0.2);
  n(['AI11'], 'Lắp gương phòng tắm', 'bộ', '3,0/7', 0.3);
  n(['AI12'], 'Lắp bộ phụ kiện WC', 'bộ', '3,0/7', 0.8);
  n(['AI13'], 'Lắp bình nước nóng', 'bộ', '3,5/7', 0.8);
  n(['AI14'], 'Lắp quạt hút WC', 'bộ', '3,5/7', 0.6);
  // --- AJ. Điện ---
  n(['AJ01'], 'Điểm đèn âm trần', 'điểm', '3,5/7', 0.4);
  n(['AJ02', 'W23'], 'Điểm đèn có công tắc', 'điểm', '3,5/7', 0.5);
  n(['AJ03', 'W24'], 'Điểm ổ cắm thường', 'điểm', '3,5/7', 0.38);
  n(['AJ04'], 'Điểm ổ cắm chống nước', 'điểm', '3,5/7', 0.45);
  n(['AJ05'], 'Điểm điều hòa 1 pha', 'điểm', '3,5/7', 0.6);
  n(['AJ06'], 'Điểm bình nước nóng', 'điểm', '3,5/7', 0.6);
  n(['AJ07'], 'Điểm mạng Cat6', 'điểm', '3,5/7', 0.45);
  n(['AJ08'], 'Điểm TV', 'điểm', '3,5/7', 0.4);
  n(['AJ09'], 'Lắp tủ điện 12 module', 'tủ', '4,0/7', 1.2);
  n(['AJ10'], 'Lắp tủ điện 24 module', 'tủ', '4,0/7', 1.8);
  n(['AJ11'], 'Hệ tiếp địa nhà dân', 'hệ', '3,5/7', 4.0);
  n(['AJ12'], 'Lắp đèn downlight', 'bộ', '3,5/7', 0.15);
  n(['AJ13'], 'Lắp đèn ốp trần', 'bộ', '3,5/7', 0.3);
  n(['AJ14'], 'Lắp LED hắt', 'md', '3,5/7', 0.12);
  n(['AJ15'], 'Lắp camera IP', 'điểm', '3,5/7', 0.6);
  n(['AJ16'], 'Hệ chuông cửa có hình', 'hệ', '3,5/7', 2.0);
  // --- AK. Cấp thoát nước ---
  n(['AK01', 'W25'], 'Điểm cấp nước lạnh PPR', 'điểm', '3,5/7', 0.5);
  n(['AK02'], 'Điểm cấp nóng lạnh', 'điểm', '3,5/7', 0.7);
  n(['AK03'], 'Điểm thoát lavabo', 'điểm', '3,5/7', 0.45);
  n(['AK04', 'W26'], 'Điểm thoát sàn', 'điểm', '3,5/7', 0.5);
  n(['AK05'], 'Điểm thoát bồn cầu', 'điểm', '3,5/7', 0.55);
  n(['AK06'], 'Ống cấp PPR D20 âm tường', 'md', '3,5/7', 0.12);
  n(['AK07'], 'Ống cấp PPR D25 âm tường', 'md', '3,5/7', 0.14);
  n(['AK08'], 'Ống thoát uPVC D60', 'md', '3,5/7', 0.12);
  n(['AK09'], 'Ống thoát uPVC D90', 'md', '3,5/7', 0.15);
  n(['AK10'], 'Ống thoát uPVC D110', 'md', '3,5/7', 0.18);
  n(['AK11'], 'Lắp bồn nước inox 1.500L', 'bộ', '3,5/7', 1.0);
  n(['AK12'], 'Lắp bơm tăng áp', 'bộ', '3,5/7', 1.2);
  n(['AK13'], 'Lắp bơm chìm nước thải', 'bộ', '3,5/7', 1.5);
  n(['AK14'], 'Lắp bộ lọc đầu nguồn', 'hệ', '3,5/7', 2.0);
  n(['AK15'], 'Lắp bể tự hoại composite', 'bộ', '3,5/7', 4.0);
  // --- AL. Điều hòa, thông gió ---
  n(['AL01', 'W28'], 'Lắp điều hòa treo tường 1HP', 'bộ', '3,5/7', 1.0);
  n(['AL02'], 'Lắp điều hòa treo tường 1.5HP', 'bộ', '3,5/7', 1.1);
  n(['AL03'], 'Lắp điều hòa treo tường 2HP', 'bộ', '3,5/7', 1.3);
  n(['AL04'], 'Lắp cassette 2HP', 'bộ', '4,0/7', 2.5);
  n(['AL05'], 'Lắp điều hòa giấu trần 2HP', 'bộ', '4,0/7', 2.5);
  n(['AL06'], 'Ống đồng đôi 1HP', 'md', '3,5/7', 0.12);
  n(['AL07'], 'Ống đồng đôi 1.5HP', 'md', '3,5/7', 0.12);
  n(['AL08'], 'Ống nước ngưng', 'md', '3,5/7', 0.1);
  n(['AL09'], 'Ống gió tôn mạ', 'kg', '3,5/7', 0.06);
  n(['AL10'], 'Bảo ôn ống gió 13mm', 'm2', '3,5/7', 0.1);
  n(['AL11'], 'Lắp miệng gió', 'bộ', '3,5/7', 0.4);
  n(['AL12'], 'Lắp quạt thông gió', 'bộ', '3,5/7', 0.8);
  // --- AM. Nội thất ---
  n(['AM01', 'W29'], 'Tủ bếp Melamine', 'md kép', '4,0/7', 1.5);
  n(['AM02'], 'Tủ bếp Laminate', 'md kép', '4,0/7', 1.6);
  n(['AM03'], 'Tủ bếp Acrylic', 'md kép', '4,0/7', 1.8);
  n(['AM04'], 'Mặt đá bếp quartz', 'md', '4,0/7', 0.5);
  n(['AM05'], 'Kính ốp bếp', 'md', '3,5/7', 0.35);
  n(['AM06', 'W30'], 'Tủ áo Melamine', 'm2 mặt', '4,0/7', 0.7);
  n(['AM07'], 'Tủ áo cánh kính', 'm2 mặt', '4,0/7', 0.8);
  n(['AM08'], 'Tủ lavabo plywood', 'md', '4,0/7', 0.9);
  n(['AM09'], 'Kệ TV Melamine', 'md', '4,0/7', 0.9);
  n(['AM10'], 'Vách ốp MDF Melamine', 'm2', '4,0/7', 0.4);
  n(['AM11'], 'Vách ốp Laminate', 'm2', '4,0/7', 0.45);
  n(['AM12'], 'Giường MDF MR', 'bộ', '4,0/7', 3.0);
  n(['AM13'], 'Bàn làm việc', 'bộ', '4,0/7', 1.5);
  n(['AM14'], 'Bàn trang điểm', 'bộ', '4,0/7', 1.5);
  n(['AM16'], 'Rèm 2 lớp', 'm ngang', '3,0/7', 0.1);
  global.VnNorms = { list: list, get: function (code) { return map[String(code)] || null; }, count: list.length };
})(window);
