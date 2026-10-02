/* Trang "Hồ sơ chất lượng công trình" (pages/quality.html) — 2026-10-02.
 * Sheet: QLCL-Danh mục công việc (qlclTasks) + QLCL-Hồ sơ nghiệm thu (qlclRecords). Thông tin các bên của dự án lưu trong qlclRecords với docType = 'INFO'.
 * 15 mẫu hồ sơ theo hướng dẫn chung của Nghị định 06/2021/NĐ-CP và Thông tư 10/2021/TT-BXD (quản lý chất lượng, thi công xây dựng và bảo trì công trình).
 * Mẫu là MẪU THAM KHẢO: luôn đối chiếu biểu mẫu mà chủ đầu tư / hợp đồng yêu cầu. Xuất: in / PDF (cửa sổ in) hoặc Word (.doc). */
(function () {
  'use strict';
  var TM = window.TaskManager, $ = function (id) { return document.getElementById(id); };
  if (!TM || !$('qTasks')) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function user() { try { return window.Auth && Auth.getCurrentUser ? Auth.getCurrentUser() : null; } catch (e) { return null; } }
  function today() { return new Date().toISOString().split('T')[0]; }
  function vn(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function uid(p) { return (p || 'r') + Math.random().toString(36).slice(2, 9); }
  function toast(msg) { var t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#22272E;color:#fff;border:1px solid #B8935A;padding:10px 18px;border-radius:10px;font:600 .8125rem Inter,sans-serif;z-index:900;max-width:90vw'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function modal(title, body, wide) {
    var ov = document.createElement('div'); ov.className = 'es-overlay';
    ov.innerHTML = '<div class="es-modal" style="max-width:' + (wide || 920) + 'px"><h2><span>' + title + '</span><button type="button" class="es-x" data-x aria-label="Đóng">×</button></h2><div data-body>' + body + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('[data-x]').addEventListener('click', function () { ov.remove(); });
    ov.close = function () { ov.remove(); };
    return ov;
  }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600); }
  function plain(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ho-so'; }

  // ---------- mẫu hồ sơ ----------
  // field: [khoá, nhãn, loại (text|area|date), gợi ý]   table: { label, cols:[…], rows:[[…]] (dòng mẫu) }
  var F_WORK = ['work', 'Công việc / đối tượng nghiệm thu', 'area', 'VD: Cốt thép dầm sàn tầng 2'], F_LOC = ['location', 'Hạng mục / vị trí', 'text', 'VD: Tầng 2, trục 1–5 / A–D'], F_DWG = ['drawing', 'Thi công theo bản vẽ / chỉ dẫn kỹ thuật', 'text', 'VD: Bản vẽ KC-05, KC-06; chỉ dẫn kỹ thuật phần BTCT'], F_STD = ['standards', 'Tiêu chuẩn áp dụng', 'text', 'VD: TCVN 4453:1995; TCVN 5574:2018'];
  var SIGN = { nt: 'ĐẠI DIỆN NHÀ THẦU THI CÔNG', tvgs: 'ĐẠI DIỆN TƯ VẤN GIÁM SÁT', cdt: 'ĐẠI DIỆN CHỦ ĐẦU TƯ', tk: 'ĐẠI DIỆN TƯ VẤN THIẾT KẾ' };
  var CONCL_OK = 'Chấp nhận nghiệm thu; đồng ý cho triển khai công việc tiếp theo.';
  var DOCS = [
    { code: 'PYC-NT', name: 'Phiếu yêu cầu nghiệm thu công việc xây dựng', kind: 'request', desc: 'Nhà thầu đề nghị tư vấn giám sát / chủ đầu tư nghiệm thu một công việc đã hoàn thành.', to: 'Tư vấn giám sát / Chủ đầu tư', fields: [F_WORK, F_LOC, F_DWG, F_STD, ['when', 'Đề nghị nghiệm thu vào lúc', 'text', 'VD: 14h00 ngày …'], ['docs', 'Hồ sơ, tài liệu kèm theo', 'area', 'Biên bản nghiệm thu nội bộ, kết quả thí nghiệm, nhật ký…']], signers: ['nt', 'tvgs'] },
    { code: 'BB-NTCV', name: 'Biên bản nghiệm thu công việc xây dựng', kind: 'minutes', desc: 'Nghiệm thu từng công việc (cốt thép, ván khuôn, đổ bê tông, xây, trát, chống thấm, ốp lát, sơn…) trước khi chuyển bước.', fields: [F_WORK, F_LOC, F_DWG, F_STD, ['period', 'Thời gian thi công (từ … đến …)', 'text', ''], ['docsRef', 'Căn cứ nghiệm thu (hồ sơ thiết kế, chỉ dẫn kỹ thuật, kết quả thí nghiệm, nhật ký)', 'area', ''], ['quality', 'Đánh giá chất lượng, khối lượng công việc đã thực hiện', 'area', 'Đúng thiết kế, đạt yêu cầu kỹ thuật…']], table: { label: 'Khối lượng nghiệm thu', cols: ['Nội dung', 'ĐVT', 'KL thiết kế', 'KL thực tế', 'Ghi chú'], rows: [['', '', '', '', '']] }, concl: CONCL_OK, signers: ['nt', 'tvgs', 'cdt'] },
    { code: 'PYC-VL', name: 'Phiếu yêu cầu nghiệm thu vật liệu, thiết bị đưa vào sử dụng', kind: 'request', desc: 'Nhà thầu đề nghị kiểm tra, nghiệm thu vật liệu / thiết bị trước khi đưa vào công trình.', to: 'Tư vấn giám sát / Chủ đầu tư', fields: [F_LOC, ['when', 'Đề nghị kiểm tra vào lúc', 'text', ''], ['docs', 'Chứng chỉ, chứng nhận kèm theo (CO, CQ, kết quả thí nghiệm…)', 'area', '']], table: { label: 'Danh mục vật liệu, thiết bị', cols: ['Tên vật liệu / thiết bị', 'Quy cách, chủng loại', 'ĐVT', 'Số lượng', 'Xuất xứ / nhà cung cấp'], rows: [['', '', '', '', '']] }, signers: ['nt', 'tvgs'] },
    { code: 'BB-NTVL', name: 'Biên bản nghiệm thu vật liệu, thiết bị, cấu kiện trước khi sử dụng', kind: 'minutes', desc: 'Xác nhận vật liệu / thiết bị đạt yêu cầu thiết kế, tiêu chuẩn, có đủ chứng chỉ trước khi đưa vào thi công.', fields: [F_LOC, F_STD, ['docsRef', 'Chứng chỉ, chứng nhận (CO, CQ, kết quả thí nghiệm)', 'area', ''], ['sample', 'Kết quả kiểm tra / lấy mẫu thí nghiệm', 'area', '']], table: { label: 'Danh mục vật liệu, thiết bị', cols: ['Tên vật liệu / thiết bị', 'Quy cách, chủng loại', 'ĐVT', 'Số lượng', 'Xuất xứ / nhà cung cấp'], rows: [['', '', '', '', '']] }, concl: 'Vật liệu, thiết bị đạt yêu cầu; đồng ý đưa vào sử dụng cho công trình.', signers: ['nt', 'tvgs', 'cdt'] },
    { code: 'BB-LM', name: 'Biên bản lấy mẫu thí nghiệm hiện trường', kind: 'minutes', desc: 'Lấy mẫu bê tông, vữa, thép… để thí nghiệm có sự chứng kiến của tư vấn giám sát.', fields: [['material', 'Loại vật liệu lấy mẫu', 'text', 'VD: Bê tông thương phẩm B25 — dầm sàn tầng 2'], F_LOC, F_STD, ['lab', 'Đơn vị thí nghiệm', 'text', '']], table: { label: 'Danh sách mẫu', cols: ['Ký hiệu mẫu', 'Số lượng', 'Ngày lấy / đúc mẫu', 'Ngày thí nghiệm dự kiến', 'Ghi chú'], rows: [['', '', '', '', '']] }, concl: 'Việc lấy mẫu được thực hiện đúng quy trình, có sự chứng kiến của các bên.', signers: ['nt', 'tvgs'] },
    { code: 'BB-NTGD', name: 'Biên bản nghiệm thu giai đoạn thi công xây dựng', kind: 'minutes', desc: 'Nghiệm thu một giai đoạn (móng, phần thân, hoàn thiện…) trước khi chuyển giai đoạn.', fields: [['stage', 'Giai đoạn thi công xây dựng', 'text', 'VD: Hoàn thành phần móng'], F_LOC, ['period', 'Thời gian thi công (từ … đến …)', 'text', ''], ['quality', 'Đánh giá chất lượng giai đoạn', 'area', '']], table: { label: 'Các công việc đã nghiệm thu trong giai đoạn', cols: ['Công việc', 'Biên bản số', 'Ngày nghiệm thu', 'Kết quả', 'Ghi chú'], rows: [['', '', '', 'Đạt', '']] }, concl: 'Chấp nhận nghiệm thu giai đoạn; đồng ý chuyển sang giai đoạn thi công tiếp theo.', signers: ['nt', 'tvgs', 'tk', 'cdt'] },
    { code: 'BB-NTHT', name: 'Biên bản nghiệm thu hoàn thành hạng mục / công trình đưa vào sử dụng', kind: 'minutes', desc: 'Nghiệm thu hoàn thành toàn bộ hạng mục hoặc công trình để đưa vào khai thác, sử dụng.', fields: [['scope', 'Hạng mục / công trình nghiệm thu', 'text', ''], ['period', 'Thời gian thi công (từ … đến …)', 'text', ''], ['permit', 'Giấy phép xây dựng / quyết định đầu tư', 'text', ''], ['contractNo', 'Hợp đồng thi công số', 'text', ''], ['quality', 'Đánh giá chất lượng, khối lượng hoàn thành so với thiết kế và hợp đồng', 'area', '']], table: { label: 'Hồ sơ hoàn thành công trình kèm theo', cols: ['Tài liệu', 'Số lượng / số quyển', 'Ghi chú'], rows: [['Bản vẽ hoàn công', '', ''], ['Biên bản nghiệm thu công việc, giai đoạn', '', ''], ['Kết quả thí nghiệm, kiểm định', '', ''], ['Nhật ký thi công', '', '']] }, concl: 'Công trình đủ điều kiện nghiệm thu hoàn thành, đưa vào sử dụng; bên thi công bảo hành theo hợp đồng.', signers: ['nt', 'tvgs', 'tk', 'cdt'] },
    { code: 'BB-BG', name: 'Biên bản bàn giao công trình / mặt bằng', kind: 'minutes', desc: 'Bàn giao mặt bằng thi công hoặc bàn giao công trình hoàn thành giữa các bên.', fields: [['scope', 'Nội dung bàn giao', 'area', 'VD: Bàn giao mặt bằng thi công / bàn giao công trình hoàn thành'], ['condition', 'Hiện trạng khi bàn giao', 'area', ''], ['warranty', 'Thời hạn bảo hành, điều kiện bảo trì', 'text', '']], table: { label: 'Danh mục bàn giao', cols: ['Nội dung', 'ĐVT', 'Số lượng', 'Tình trạng', 'Ghi chú'], rows: [['', '', '', '', '']] }, concl: 'Hai bên đã kiểm tra và thống nhất bàn giao như nội dung trên.', signers: ['nt', 'cdt'] },
    { code: 'PL-KL', name: 'Phụ lục khối lượng nghiệm thu (biên bản phụ lục)', kind: 'attach', desc: 'Bảng kê khối lượng nghiệm thu đính kèm biên bản nghiệm thu.', fields: [['refDoc', 'Kèm theo Biên bản nghiệm thu số', 'text', 'VD: BB-NTCV-26-001'], F_WORK, F_LOC], table: { label: 'Bảng kê khối lượng', cols: ['Nội dung công việc', 'ĐVT', 'KL thiết kế', 'KL thực tế nghiệm thu', 'Ghi chú'], rows: [['', '', '', '', '']] }, signers: ['nt', 'tvgs'] },
    { code: 'BB-XNKL', name: 'Biên bản xác nhận khối lượng hoàn thành (thanh toán)', kind: 'minutes', desc: 'Xác nhận khối lượng đã thực hiện trong kỳ làm cơ sở thanh toán.', fields: [['period', 'Kỳ / đợt thanh toán', 'text', 'VD: Đợt 2 — tháng 10/2026'], ['contractNo', 'Hợp đồng số', 'text', '']], table: { label: 'Khối lượng thực hiện', cols: ['Nội dung', 'ĐVT', 'KL hợp đồng', 'KL kỳ này', 'KL lũy kế'], rows: [['', '', '', '', '']] }, concl: 'Các bên thống nhất khối lượng hoàn thành như bảng trên làm cơ sở thanh toán.', signers: ['nt', 'tvgs', 'cdt'] },
    { code: 'BB-PS', name: 'Biên bản xác nhận khối lượng phát sinh / thay đổi thiết kế', kind: 'minutes', desc: 'Ghi nhận phát sinh, điều chỉnh thiết kế và ảnh hưởng chi phí – tiến độ.', fields: [['reason', 'Nguyên nhân phát sinh / thay đổi', 'area', ''], ['content', 'Nội dung thay đổi', 'area', ''], ['impact', 'Ảnh hưởng đến chi phí, tiến độ', 'area', '']], table: { label: 'Khối lượng phát sinh', cols: ['Nội dung', 'ĐVT', 'Khối lượng', 'Đơn giá', 'Thành tiền'], rows: [['', '', '', '', '']] }, concl: 'Các bên thống nhất nội dung phát sinh như trên; nhà thầu thi công sau khi có xác nhận của chủ đầu tư.', signers: ['nt', 'tvgs', 'tk', 'cdt'] },
    { code: 'BB-KT', name: 'Biên bản kiểm tra hiện trường / họp giao ban', kind: 'minutes', desc: 'Ghi lại nội dung kiểm tra, họp tại công trường và các việc cần xử lý.', fields: [['attendees', 'Thành phần tham dự', 'area', ''], ['content', 'Nội dung kiểm tra / trao đổi', 'area', ''], ['requests', 'Yêu cầu, kiến nghị', 'area', '']], table: { label: 'Công việc cần xử lý', cols: ['Nội dung', 'Người phụ trách', 'Hạn hoàn thành', 'Ghi chú'], rows: [['', '', '', '']] }, concl: '', signers: ['nt', 'tvgs', 'cdt'] },
    { code: 'BB-ATLD', name: 'Biên bản kiểm tra an toàn lao động, vệ sinh môi trường', kind: 'minutes', desc: 'Kiểm tra giàn giáo, lưới an toàn, điện tạm, PCCC, bảo hộ lao động, vệ sinh công trường.', fields: [F_LOC, ['note', 'Nhận xét chung', 'area', '']], table: { label: 'Nội dung kiểm tra', cols: ['Nội dung', 'Kết quả (Đạt / Không đạt)', 'Ghi chú, yêu cầu khắc phục'], rows: [['Giàn giáo, cốp pha, chống đỡ', '', ''], ['Lưới / lan can an toàn, lỗ chờ, mép sàn', '', ''], ['Điện thi công tạm, tủ điện, chống giật', '', ''], ['Bảo hộ lao động (mũ, giày, dây an toàn)', '', ''], ['Phòng cháy chữa cháy, biển báo', '', ''], ['Vệ sinh, che chắn bụi, tập kết vật liệu', '', '']] }, concl: 'Công trường đảm bảo an toàn; nhà thầu khắc phục các nội dung chưa đạt trước khi thi công tiếp.', signers: ['nt', 'tvgs'] },
    { code: 'BB-SC', name: 'Biên bản sự cố / yêu cầu khắc phục công việc không đạt', kind: 'minutes', desc: 'Ghi nhận sự cố, hạng mục không đạt chất lượng và biện pháp, thời hạn khắc phục.', fields: [F_LOC, ['event', 'Mô tả sự cố / nội dung không đạt', 'area', ''], ['cause', 'Nguyên nhân (sơ bộ)', 'area', ''], ['remedy', 'Biện pháp khắc phục', 'area', ''], ['deadline', 'Thời hạn khắc phục', 'text', '']], concl: 'Nhà thầu thi công khắc phục theo biện pháp trên và đề nghị nghiệm thu lại.', signers: ['nt', 'tvgs', 'cdt'] },
    { code: 'NKTC', name: 'Nhật ký thi công hằng ngày', kind: 'log', desc: 'Ghi nhật ký công trường theo ngày: thời tiết, nhân lực, máy móc, công việc, vật liệu nhập.', fields: [['weather', 'Thời tiết', 'text', 'VD: Nắng, 30°C'], ['workforce', 'Nhân lực (số người theo tổ đội)', 'text', ''], ['machines', 'Máy móc, thiết bị', 'text', ''], ['work', 'Công việc thực hiện trong ngày', 'area', ''], ['problems', 'Vướng mắc, sự cố, yêu cầu của giám sát', 'area', ''], ['tomorrow', 'Kế hoạch ngày mai', 'area', '']], table: { label: 'Vật liệu nhập trong ngày', cols: ['Vật liệu', 'ĐVT', 'Số lượng', 'Nhà cung cấp', 'Ghi chú'], rows: [['', '', '', '', '']] }, signers: ['nt', 'tvgs'] }
  ];
  var DOC = {}; DOCS.forEach(function (d) { DOC[d.code] = d; });
  var BASIS = ['Nghị định 06/2021/NĐ-CP ngày 26/01/2021 quy định chi tiết một số nội dung về quản lý chất lượng, thi công xây dựng và bảo trì công trình xây dựng;', 'Thông tư 10/2021/TT-BXD ngày 25/8/2021 hướng dẫn một số điều và biện pháp thi hành Nghị định 06/2021/NĐ-CP;', 'Hồ sơ thiết kế được duyệt, hợp đồng thi công, chỉ dẫn kỹ thuật và các tiêu chuẩn kỹ thuật áp dụng cho công trình.'];
  var STATUS = ['Chưa thi công', 'Đang thi công', 'Chờ nghiệm thu', 'Đã nghiệm thu', 'Cần khắc phục'];
  var ST_CLS = { 'Chưa thi công': '', 'Đang thi công': 'warn', 'Chờ nghiệm thu': 'warn', 'Đã nghiệm thu': 'ok', 'Cần khắc phục': 'bad' };

  // ---------- bộ công việc mẫu ----------
  var REQ_WORK = ['PYC-NT', 'BB-NTCV', 'PL-KL'], REQ_MAT = ['PYC-VL', 'BB-NTVL'];
  function taskSet(kind, floors) {
    var t = [], add = function (phase, name, req, loc) { t.push({ phase: phase, name: name, requiredDocs: req || REQ_WORK, location: loc || '' }); };
    if (kind === 'noithat') {
      add('A. Chuẩn bị', 'Kiểm tra, bàn giao mặt bằng thi công nội thất', ['BB-BG']); add('B. Cơ điện', 'Đường điện âm tường, ống nước cấp thoát'); add('B. Cơ điện', 'Thử áp lực đường ống nước');
      add('C. Hoàn thiện', 'Chống thấm sàn WC, ban công (thử nước)'); add('C. Hoàn thiện', 'Trần thạch cao, vách ngăn'); add('C. Hoàn thiện', 'Ốp lát gạch, đá'); add('C. Hoàn thiện', 'Bả matit, sơn'); add('C. Hoàn thiện', 'Vật liệu gỗ, tấm, phụ kiện (nhập kho)', REQ_MAT);
      add('D. Lắp đặt', 'Lắp đặt tủ, bàn, thiết bị nội thất'); add('D. Lắp đặt', 'Lắp thiết bị điện, đèn, thiết bị vệ sinh'); add('E. Hoàn thành', 'Nghiệm thu hoàn thành, bàn giao', ['BB-NTHT', 'BB-BG', 'PL-KL']);
      return t;
    }
    add('A. Chuẩn bị', 'Bàn giao mặt bằng, định vị tim trục, cao độ', ['BB-BG', 'PYC-NT', 'BB-NTCV']);
    add('B. Phần móng', 'Đào đất hố móng, kiểm tra đáy móng'); add('B. Phần móng', 'Bê tông lót móng'); add('B. Phần móng', 'Cốt thép móng'); add('B. Phần móng', 'Ván khuôn móng'); add('B. Phần móng', 'Đổ bê tông móng (lấy mẫu thí nghiệm)', REQ_WORK.concat(['BB-LM'])); add('B. Phần móng', 'Lấp đất, đắp cát nền tầng trệt');
    add('B. Phần móng', 'Thép xây dựng (vật liệu)', REQ_MAT); add('B. Phần móng', 'Xi măng, cát, đá, bê tông thương phẩm (vật liệu)', REQ_MAT);
    for (var f = 1; f <= floors; f++) { var L = f === 1 ? 'Tầng 1' : 'Tầng ' + f; add('C. Phần thân', 'Cốt thép cột, vách', REQ_WORK, L); add('C. Phần thân', 'Ván khuôn dầm, sàn', REQ_WORK, L); add('C. Phần thân', 'Cốt thép dầm, sàn', REQ_WORK, L); add('C. Phần thân', 'Đổ bê tông cột, dầm, sàn (lấy mẫu)', REQ_WORK.concat(['BB-LM']), L); add('C. Phần thân', 'Xây tường', REQ_WORK, L); }
    add('C. Phần thân', 'Gạch xây (vật liệu)', REQ_MAT); add('D. Mái, chống thấm', 'Chống thấm sàn mái, sê nô (thử nước)'); add('D. Mái, chống thấm', 'Chống thấm sàn WC, ban công (ngâm nước 24h)');
    add('E. Cơ điện', 'Đường ống cấp thoát nước âm tường (thử áp lực)'); add('E. Cơ điện', 'Ống luồn dây điện, hộp nối âm tường'); add('E. Cơ điện', 'Hệ thống tiếp địa chống sét');
    add('F. Hoàn thiện', 'Trát tường, cán nền'); add('F. Hoàn thiện', 'Ốp lát gạch, đá'); add('F. Hoàn thiện', 'Bả matit, sơn nước'); add('F. Hoàn thiện', 'Trần thạch cao'); add('F. Hoàn thiện', 'Cửa, lan can, cầu thang'); add('F. Hoàn thiện', 'Lắp đặt thiết bị điện, nước, đèn');
    add('G. Hoàn thành', 'Nghiệm thu hoàn thành hạng mục / công trình, bàn giao', ['BB-NTHT', 'BB-BG', 'PL-KL']);
    return t;
  }

  // ---------- dữ liệu ----------
  var st = { proj: '', tab: 'tasks', q: '', fs: '', sel: {} };
  function projects() { var l = []; try { l = TM.getProjects() || []; } catch (e) { } return l; }
  function pName(id) { var p = projects().filter(function (x) { return x.id === id; })[0]; return p ? (p.name || p.id) : ''; }
  function tasks() { return TM.listColl('qlclTasks').filter(function (t) { return t.projectId === st.proj; }).sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); }); }
  function allRecs() { return TM.listColl('qlclRecords').filter(function (r) { return r.projectId === st.proj; }); }
  function recs() { return allRecs().filter(function (r) { return r.docType !== 'INFO'; }).sort(function (a, b) { return String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')) || String(b.docNo).localeCompare(String(a.docNo)); }); }
  function infoRec() { return allRecs().filter(function (r) { return r.docType === 'INFO'; })[0]; }
  function info() { var r = infoRec(), d = r ? TM.unpackJson(r, 'd', 3, {}) : {}; d = d || {}; if (!d.name) d.name = pName(st.proj); return d; }
  function docsOf(t) { var v = t.requiredDocs; if (Array.isArray(v)) return v; try { var a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function recData(r) { var d = TM.unpackJson(r, 'd', 3, {}); d = d || {}; return { f: d.f || {}, rows: Array.isArray(d.rows) ? d.rows : [], concl: d.concl || '', place: d.place || '' }; }
  function nextNo(code) { var yy = String(new Date().getFullYear()).slice(-2), n = allRecs().filter(function (r) { return r.docType === code; }).length + 1; return code + '-' + yy + '-' + ('00' + n).slice(-3); }
  function load(cb) { var n = 2, d = function () { if (--n === 0) cb(); }; TM.loadColl('qlclTasks', d); TM.loadColl('qlclRecords', d); }

  // ---------- dựng văn bản ----------
  var DOT = '……………………………………';
  function render(tpl, rec, inf) {
    var d = recData(rec), f = d.f, h = '', ln = function (label, val) { return '<p><b>' + esc(label) + ':</b> ' + (val ? esc(val).replace(/\n/g, '<br>') : DOT) + '</p>'; };
    var dt = rec.date ? rec.date : today(), p = /^(\d{4})-(\d{2})-(\d{2})/.exec(dt) || [0, '....', '..', '..'], place = d.place || inf.place || '';
    var dateLine = (place ? esc(place) + ', ' : '') + 'ngày ' + p[3] + ' tháng ' + p[2] + ' năm ' + p[1];
    var qh = '<p class="c"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập – Tự do – Hạnh phúc</b><br>—————</p>';
    var party = function (k) { var m = { nt: ['contractor', 'conRep', 'conTitle'], tvgs: ['supervisor', 'supRep', 'supTitle'], cdt: ['investor', 'investorRep', 'investorTitle'], tk: ['designer', 'desRep', 'desTitle'] }[k]; return { org: inf[m[0]] || '', rep: inf[m[1]] || '', title: inf[m[2]] || '' }; };
    var table = function () {
      if (!tpl.table) return '';
      var rows = (d.rows.length ? d.rows : []).filter(function (r) { return r.some(function (c) { return String(c || '').trim(); }); });
      if (!rows.length) rows = [tpl.table.cols.map(function () { return ''; })];
      return '<p><b>' + esc(tpl.table.label) + ':</b></p><table class="g"><tr><th style="width:36px">STT</th>' + tpl.table.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>' + rows.map(function (r, i) { return '<tr><td class="c">' + (i + 1) + '</td>' + tpl.table.cols.map(function (c, j) { return '<td>' + esc(r[j] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
    };
    var sign = function () {
      var cells = tpl.signers.map(function (k) { var pa = party(k); return '<td class="c"><b>' + SIGN[k] + '</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>' + (pa.rep ? '<b>' + esc(pa.rep) + '</b><br>' + esc(pa.title) : '') + '</td>'; }).join('');
      return '<table class="s"><tr>' + cells + '</tr></table>';
    };
    var fields = function () { return tpl.fields.map(function (fd) { return ln(fd[1], fd[2] === 'date' ? vn(f[fd[0]]) : f[fd[0]]); }).join(''); };
    var proj = '<p><b>Công trình:</b> ' + esc(inf.name || '') + '</p>' + (inf.address ? '<p><b>Địa điểm xây dựng:</b> ' + esc(inf.address) + '</p>' : '');
    if (tpl.kind === 'request') {
      h = '<table class="hd"><tr><td class="c" style="width:45%">' + (inf.contractor ? '<b>' + esc(inf.contractor.toUpperCase()) + '</b>' : '<b>NHÀ THẦU THI CÔNG</b>') + '<br>Số: ' + esc(rec.docNo || '') + '</td><td class="c">' + qh.replace(/<\/?p[^>]*>/g, '').replace('<br>—————', '') + '<br><i>' + dateLine + '</i></td></tr></table>' +
        '<h1>' + esc(tpl.name.toUpperCase()) + '</h1><p class="c"><i>Kính gửi: ' + esc(inf.supervisor ? inf.supervisor + (inf.investor ? ' / ' + inf.investor : '') : tpl.to) + '</i></p>' + proj +
        '<p>Nhà thầu thi công đề nghị quý đơn vị kiểm tra, nghiệm thu nội dung sau:</p>' + fields() + table() + '<p>Rất mong nhận được sự phối hợp của quý đơn vị.</p>' + sign();
    } else if (tpl.kind === 'attach') {
      h = qh + '<h1>PHỤ LỤC KHỐI LƯỢNG NGHIỆM THU</h1><p class="c"><i>' + (f.refDoc ? 'Kèm theo Biên bản nghiệm thu số ' + esc(f.refDoc) : 'Kèm theo Biên bản nghiệm thu số ' + DOT) + ' — ' + dateLine + '</i></p>' + proj + ln(tpl.fields[1][1], f.work) + ln(tpl.fields[2][1], f.location) + table() + sign();
    } else if (tpl.kind === 'log') {
      h = qh + '<h1>NHẬT KÝ THI CÔNG</h1><p class="c"><i>Ngày ' + p[3] + '/' + p[2] + '/' + p[1] + '</i></p>' + proj + fields() + table() + sign();
    } else {
      var who = tpl.signers.map(function (k, i) { var pa = party(k); return '<p>' + (i + 1) + '. <b>' + SIGN[k].replace('ĐẠI DIỆN', 'Đại diện').replace('TƯ VẤN', 'tư vấn').replace('NHÀ THẦU THI CÔNG', 'nhà thầu thi công').replace('CHỦ ĐẦU TƯ', 'chủ đầu tư').replace('GIÁM SÁT', 'giám sát').replace('THIẾT KẾ', 'thiết kế') + '</b>' + (pa.org ? ' — ' + esc(pa.org) : '') + ':<br>&nbsp;&nbsp;&nbsp;Ông/Bà: ' + (pa.rep ? esc(pa.rep) : DOT) + ' — Chức vụ: ' + (pa.title ? esc(pa.title) : DOT) + '</p>'; }).join('');
      h = qh + '<h1>' + esc(tpl.name.toUpperCase()) + '</h1><p class="c">Số: ' + esc(rec.docNo || '') + '</p>' + proj +
        '<p><b>I. Căn cứ:</b></p>' + BASIS.map(function (b) { return '<p class="b">– ' + esc(b) + '</p>'; }).join('') +
        '<p><b>II. Thành phần trực tiếp nghiệm thu / tham gia:</b></p>' + who +
        '<p><b>III. Thời gian, địa điểm:</b> ' + dateLine + (f.time ? ', hồi ' + esc(f.time) : '') + (inf.address ? ' tại ' + esc(inf.address) : '') + '</p>' +
        '<p><b>IV. Nội dung:</b></p>' + fields() + table() + (tpl.concl !== undefined ? '<p><b>V. Kết luận:</b> ' + (d.concl ? esc(d.concl).replace(/\n/g, '<br>') : DOT) + '</p>' : '') + '<p>Biên bản được lập thành ' + (tpl.signers.length + 1) + ' bản, mỗi bên giữ 01 bản có giá trị như nhau.</p>' + sign();
    }
    return h;
  }
  var CSS = 'body{font:13pt "Times New Roman",serif;color:#000;line-height:1.4}h1{font-size:15pt;text-align:center;margin:12px 0 4px}p{margin:4px 0}p.b{margin-left:18px}p.c,td.c{text-align:center}table{border-collapse:collapse;width:100%}table.g{margin:6px 0 10px}table.g th,table.g td{border:1px solid #000;padding:4px 6px;vertical-align:top;font-size:12pt}table.g th{background:#eee}table.s{margin-top:14px}table.s td{width:' + '33%' + ';vertical-align:top;padding:4px}table.hd td{vertical-align:top}';
  function pageHtml(inner) { return '<style>' + CSS + '@page{size:A4;margin:2cm 1.5cm 2cm 3cm}@media print{body{margin:0}}</style>' + inner; }
  function openPrint(tpl, rec) {
    var w = window.open('', '_blank'); if (!w) { alert('Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi thử lại.'); return; }
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(rec.docNo || tpl.name) + '</title><body style="margin:18mm 14mm 18mm 25mm">' + pageHtml(render(tpl, rec, info())) + '<script>setTimeout(function(){window.print()},300)<\/script>'); w.document.close();
  }
  function saveWord(tpl, rec) {
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(tpl.name) + '</title>' + '</head><body>' + pageHtml(render(tpl, rec, info())) + '</body></html>';
    download(plain((rec.docNo || tpl.code) + '-' + (rec.title || '')) + '.doc', new Blob(['﻿', html], { type: 'application/msword' }));
  }

  // ---------- form lập hồ sơ ----------
  function openDoc(tpl, rec, task) {
    var inf = info(), isNew = !rec, d = rec ? recData(rec) : { f: {}, rows: (tpl.table ? tpl.table.rows.map(function (r) { return r.slice(); }) : []), concl: tpl.concl || '', place: inf.place || '' };
    if (isNew && task) { d.f.work = task.name; d.f.location = task.location || ''; d.f.scope = task.name; d.f.stage = task.name; }
    var rowsCur = d.rows.map(function (r) { return r.slice(); });
    var r0 = rec || { id: '', projectId: st.proj, taskId: task ? task.id : '', docType: tpl.code, docNo: nextNo(tpl.code), title: task ? task.name : '', date: today(), status: 'Nháp', location: d.f.location || '' };
    var fld = tpl.fields.map(function (fd) { var v = d.f[fd[0]] || ''; return '<div style="' + (fd[2] === 'area' ? 'grid-column:1/-1' : '') + '"><label class="es-label">' + esc(fd[1]) + '</label>' + (fd[2] === 'area' ? '<textarea class="es-textarea" style="font-family:Inter,sans-serif;font-size:.8125rem;min-height:64px" data-f="' + fd[0] + '" placeholder="' + esc(fd[3] || '') + '">' + esc(v) + '</textarea>' : '<input class="es-input" ' + (fd[2] === 'date' ? 'type="date" ' : '') + 'data-f="' + fd[0] + '" value="' + esc(v) + '" placeholder="' + esc(fd[3] || '') + '">') + '</div>'; }).join('');
    var ov = modal(esc(tpl.name), '<div class="es-grid3" style="margin-bottom:12px"><div><label class="es-label">Số hiệu</label><input class="es-input" id="dNo" value="' + esc(r0.docNo) + '"></div><div><label class="es-label">Ngày lập</label><input class="es-input" type="date" id="dDate" value="' + esc(String(r0.date || '').slice(0, 10)) + '"></div><div><label class="es-label">Trạng thái</label><select class="es-select" id="dSt">' + ['Nháp', 'Đã ký'].map(function (s) { return '<option' + (s === r0.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div style="grid-column:span 2"><label class="es-label">Tiêu đề / công việc (hiển thị trong danh sách)</label><input class="es-input" id="dTitle" value="' + esc(r0.title || '') + '"></div><div><label class="es-label">Địa danh</label><input class="es-input" id="dPlace" value="' + esc(d.place || '') + '" placeholder="VD: Hải Phòng"></div>' + (tpl.kind === 'minutes' ? '<div><label class="es-label">Giờ lập biên bản</label><input class="es-input" data-f="time" value="' + esc(d.f.time || '') + '" placeholder="VD: 14h30"></div>' : '') + '</div>' +
      '<div class="es-grid2">' + fld + '</div>' + (tpl.table ? '<div id="dTbl" style="margin-top:12px"></div>' : '') + (tpl.concl !== undefined ? '<div style="margin-top:12px"><label class="es-label">Kết luận</label><textarea class="es-textarea" id="dConcl" style="font-family:Inter,sans-serif;font-size:.8125rem;min-height:56px">' + esc(d.concl) + '</textarea></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-top:16px"><div>' + (rec ? '<button class="es-btn es-btn-danger" id="dDel" type="button">Xoá hồ sơ</button>' : '') + '</div><div style="display:flex;flex-wrap:wrap;gap:10px"><button class="es-btn" id="dWord" type="button">Tải Word</button><button class="es-btn" id="dPrint" type="button">In / PDF</button><button class="es-btn es-btn-primary" id="dSave" type="button">Lưu hồ sơ</button></div></div>', 1000);
    function drawTbl() {
      if (!tpl.table) return;
      $('dTbl').innerHTML = '<label class="es-label">' + esc(tpl.table.label) + '</label><div class="es-tablewrap"><table class="es-table" style="min-width:640px"><thead><tr><th style="width:34px">#</th>' + tpl.table.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '<th style="width:36px"></th></tr></thead><tbody>' + rowsCur.map(function (r, i) { return '<tr data-r="' + i + '"><td>' + (i + 1) + '</td>' + tpl.table.cols.map(function (c, j) { return '<td><input data-c="' + j + '" value="' + esc(r[j] || '') + '"></td>'; }).join('') + '<td><button class="es-x" data-rx title="Xoá dòng">×</button></td></tr>'; }).join('') + '</tbody></table></div><button class="es-btn es-btn-sm" id="dAddRow" type="button" style="margin-top:8px">+ Thêm dòng</button>';
      $('dAddRow').addEventListener('click', function () { rowsCur.push(tpl.table.cols.map(function () { return ''; })); drawTbl(); });
    }
    drawTbl();
    ov.addEventListener('input', function (ev) { var i = ev.target; if (i.dataset.c !== undefined) rowsCur[Number(i.closest('tr').dataset.r)][Number(i.dataset.c)] = i.value; });
    ov.addEventListener('click', function (ev) { var x = ev.target.closest('[data-rx]'); if (x) { rowsCur.splice(Number(x.closest('tr').dataset.r), 1); if (!rowsCur.length) rowsCur.push(tpl.table.cols.map(function () { return ''; })); drawTbl(); } });
    function collect() {
      var f = {}; ov.querySelectorAll('[data-f]').forEach(function (e) { f[e.dataset.f] = e.value.trim(); });
      var data = { f: f, rows: rowsCur, concl: $('dConcl') ? $('dConcl').value.trim() : '', place: $('dPlace').value.trim() };
      var pk = TM.packJson('d', data, 3); if (!pk) { alert('Hồ sơ quá lớn.'); return null; }
      return Object.assign({ id: rec ? rec.id : undefined, projectId: st.proj, taskId: r0.taskId || '', docType: tpl.code, docNo: $('dNo').value.trim() || nextNo(tpl.code), title: $('dTitle').value.trim() || f.work || tpl.name, date: $('dDate').value, status: $('dSt').value, location: f.location || '' }, pk);
    }
    function save() {
      var data = collect(); if (!data) return null; if (!data.id) delete data.id;
      var saved = TM.saveColl('qlclRecords', data, user()); if (!saved) { alert('Không lưu được (mất mạng hoặc chưa đăng nhập).'); return null; }
      rec = saved; r0 = saved;
      // tự cập nhật trạng thái công việc khi hồ sơ nghiệm thu đã ký
      if (saved.taskId && saved.status === 'Đã ký' && /^BB-NT/.test(saved.docType)) { var tk = TM.listColl('qlclTasks').filter(function (x) { return x.id === saved.taskId; })[0]; if (tk && tk.status !== 'Đã nghiệm thu' && saved.docType === 'BB-NTCV') TM.saveColl('qlclTasks', { id: tk.id, status: 'Đã nghiệm thu' }, user()); }
      return saved;
    }
    $('dSave').addEventListener('click', function () { if (save()) { ov.close(); toast('Đã lưu hồ sơ ' + rec.docNo); renderAll(); } });
    $('dPrint').addEventListener('click', function () { var s = save(); if (s) { openPrint(tpl, s); renderAll(); } });
    $('dWord').addEventListener('click', function () { var s = save(); if (s) { saveWord(tpl, s); renderAll(); } });
    var del = $('dDel'); if (del) del.addEventListener('click', function () { if (confirm('Xoá hồ sơ ' + rec.docNo + '?')) { TM.removeColl('qlclRecords', rec.id, user()); ov.close(); renderAll(); } });
  }

  // ---------- thông tin các bên ----------
  function openInfo() {
    var inf = info(), g = function (k) { return esc(inf[k] || ''); };
    var row = function (lab, a, b, c) { return '<div class="es-grid3" style="margin-bottom:10px"><div><label class="es-label">' + lab + '</label><input class="es-input" data-i="' + a + '" value="' + g(a) + '"></div><div><label class="es-label">Người đại diện</label><input class="es-input" data-i="' + b + '" value="' + g(b) + '"></div><div><label class="es-label">Chức vụ</label><input class="es-input" data-i="' + c + '" value="' + g(c) + '"></div></div>'; };
    var ov = modal('Thông tin công trình & các bên — ' + esc(pName(st.proj)), '<div class="es-grid3" style="margin-bottom:10px"><div style="grid-column:span 2"><label class="es-label">Tên công trình</label><input class="es-input" data-i="name" value="' + g('name') + '"></div><div><label class="es-label">Địa danh (trên văn bản)</label><input class="es-input" data-i="place" value="' + g('place') + '" placeholder="Hải Phòng"></div><div style="grid-column:span 3"><label class="es-label">Địa điểm xây dựng</label><input class="es-input" data-i="address" value="' + g('address') + '"></div></div>' +
      row('Chủ đầu tư', 'investor', 'investorRep', 'investorTitle') + row('Tư vấn giám sát', 'supervisor', 'supRep', 'supTitle') + row('Nhà thầu thi công', 'contractor', 'conRep', 'conTitle') + row('Tư vấn thiết kế', 'designer', 'desRep', 'desTitle') +
      '<p class="es-note">Các thông tin này tự điền vào mọi hồ sơ (đầu trang, thành phần nghiệm thu, chữ ký). Nên nhập một lần cho mỗi dự án.</p><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px"><button class="es-btn" data-x2 type="button">Huỷ</button><button class="es-btn es-btn-primary" id="iOk" type="button">Lưu</button></div>', 900);
    ov.querySelector('[data-x2]').addEventListener('click', ov.close);
    $('iOk').addEventListener('click', function () {
      var d = {}; ov.querySelectorAll('[data-i]').forEach(function (e) { d[e.dataset.i] = e.value.trim(); });
      var cur = infoRec(), pk = TM.packJson('d', d, 3);
      TM.saveColl('qlclRecords', Object.assign({ id: cur ? cur.id : undefined, projectId: st.proj, docType: 'INFO', docNo: 'INFO', title: 'Thông tin các bên', date: today(), status: '' }, pk), user());
      ov.close(); toast('Đã lưu thông tin các bên'); renderAll();
    });
  }

  // ---------- tab: danh mục công việc ----------
  function chips(t, rs) {
    return docsOf(t).map(function (code) {
      var r = rs.filter(function (x) { return x.taskId === t.id && x.docType === code; }), cls = r.some(function (x) { return x.status === 'Đã ký'; }) ? 'ok' : r.length ? 'warn' : '';
      return '<button type="button" class="es-chip ' + cls + '" data-chip="' + code + '" data-task="' + t.id + '" title="' + esc(DOC[code] ? DOC[code].name : code) + (cls === 'ok' ? ' — đã ký' : r.length ? ' — nháp' : ' — chưa lập') + '" style="cursor:pointer;background:transparent">' + code + '</button>';
    }).join(' ');
  }
  function renderTasks() {
    var root = $('qTasks'), all = tasks(), rs = recs(), q = norm(st.q);
    var list = all.filter(function (t) { return (!st.fs || t.status === st.fs) && (!q || norm(t.name + ' ' + (t.location || '') + ' ' + (t.phase || '')).indexOf(q) !== -1); });
    var done = all.filter(function (t) { return t.status === 'Đã nghiệm thu'; }).length;
    var need = 0, have = 0; all.forEach(function (t) { docsOf(t).forEach(function (c) { need++; if (rs.some(function (x) { return x.taskId === t.id && x.docType === c && x.status === 'Đã ký'; })) have++; }); });
    var bar = '<div class="es-kpis"><div class="es-kpi"><span>Công việc</span><b>' + all.length + '</b></div><div class="es-kpi"><span>Đã nghiệm thu</span><b>' + done + '</b></div><div class="es-kpi"><span>Hồ sơ đã ký / cần lập</span><b>' + have + ' / ' + need + '</b></div><div class="es-kpi"><span>Hoàn thiện hồ sơ</span><b>' + (need ? Math.round(have / need * 100) : 0) + '%</b></div></div>' +
      '<div class="es-toolbar"><input class="es-input" id="tQ" placeholder="Tìm công việc / vị trí…" value="' + esc(st.q) + '" style="flex:1 1 220px"><select class="es-select" id="tFs"><option value="">Mọi trạng thái</option>' + STATUS.map(function (s) { return '<option' + (s === st.fs ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select><span class="es-spacer"></span><button class="es-btn" id="tSet" type="button">Nạp bộ công việc mẫu</button><button class="es-btn" id="tBulk" type="button">Lập biên bản cho mục đã chọn</button><button class="es-btn es-btn-primary" id="tAdd" type="button">+ Công việc</button></div>';
    var phases = [], by = {}; list.forEach(function (t) { var p = t.phase || 'Khác'; if (!by[p]) { by[p] = []; phases.push(p); } by[p].push(t); });
    phases.sort();
    var body = phases.length ? phases.map(function (p) { return '<tr class="grp"><td colspan="7">' + esc(p) + '</td></tr>' + by[p].map(function (t) { return '<tr data-id="' + t.id + '"><td style="width:34px"><input type="checkbox" data-sel ' + (st.sel[t.id] ? 'checked' : '') + ' style="width:auto;height:auto"></td><td style="min-width:110px;white-space:nowrap">' + esc(t.location || '') + '</td><td style="min-width:260px">' + esc(t.name) + '</td><td style="width:120px;white-space:nowrap">' + vn(t.plannedDate) + '</td><td style="width:150px"><select class="es-select" data-st style="height:30px">' + STATUS.map(function (s) { return '<option' + (s === t.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td><td style="min-width:240px">' + chips(t, rs) + '</td><td style="white-space:nowrap;width:130px"><button class="es-btn es-btn-sm" data-mk>Lập hồ sơ</button> <button class="es-x" data-ed title="Sửa">✎</button> <button class="es-x" data-dl title="Xoá">×</button></td></tr>'; }).join(''); }).join('') : '<tr><td colspan="7" class="es-empty">' + (all.length ? 'Không có công việc khớp bộ lọc.' : 'Dự án chưa có danh mục công việc. Bấm “Nạp bộ công việc mẫu” (nhà phố BTCT / nội thất) hoặc “+ Công việc”.') + '</td></tr>';
    root.innerHTML = bar + '<div class="es-tablewrap"><table class="es-table" style="min-width:1050px"><thead><tr><th></th><th>Hạng mục / vị trí</th><th>Công việc</th><th>Dự kiến</th><th>Trạng thái</th><th>Hồ sơ cần lập (xanh = đã ký, cam = nháp)</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>';
    $('tQ').addEventListener('input', function () { st.q = this.value; var p = this.selectionStart; renderTasks(); var e = $('tQ'); e.focus(); e.setSelectionRange(p, p); });
    $('tFs').addEventListener('change', function () { st.fs = this.value; renderTasks(); });
    $('tAdd').addEventListener('click', function () { taskForm(null); });
    $('tSet').addEventListener('click', openSet);
    $('tBulk').addEventListener('click', bulkMake);
    root.querySelector('tbody').addEventListener('change', function (ev) {
      var tr = ev.target.closest('tr'); if (!tr || !tr.dataset.id) return;
      if (ev.target.matches('[data-sel]')) { if (ev.target.checked) st.sel[tr.dataset.id] = 1; else delete st.sel[tr.dataset.id]; }
      else if (ev.target.matches('[data-st]')) { TM.saveColl('qlclTasks', { id: tr.dataset.id, status: ev.target.value }, user()); renderStat(); }
    });
    root.querySelector('tbody').addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr'); if (!tr || !tr.dataset.id) return; var t = all.filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!t) return;
      var chip = ev.target.closest('[data-chip]');
      if (chip) { var code = chip.dataset.chip, ex = recs().filter(function (x) { return x.taskId === t.id && x.docType === code; })[0]; openDoc(DOC[code], ex || null, t); return; }
      if (ev.target.closest('[data-mk]')) { pickDoc(t); return; }
      if (ev.target.closest('[data-ed]')) { taskForm(t); return; }
      if (ev.target.closest('[data-dl]')) { if (confirm('Xoá công việc "' + t.name + '"? (hồ sơ đã lập vẫn giữ)')) { TM.removeColl('qlclTasks', t.id, user()); renderAll(); } }
    });
  }
  function pickDoc(task) {
    var req = docsOf(task), ov = modal('Lập hồ sơ cho: ' + esc(task.name), '<div class="es-list">' + DOCS.map(function (d) { return '<div class="row" style="grid-template-columns:90px minmax(0,1fr) 90px"><span class="c">' + d.code + '</span><span>' + esc(d.name) + '<small>' + esc(d.desc) + '</small></span><span class="a"><button class="es-btn es-btn-sm' + (req.indexOf(d.code) !== -1 ? ' es-btn-primary' : '') + '" data-c="' + d.code + '">Lập</button></span></div>'; }).join('') + '</div>', 900);
    ov.addEventListener('click', function (ev) { var b = ev.target.closest('[data-c]'); if (b) { ov.close(); openDoc(DOC[b.dataset.c], null, task); } });
  }
  function taskForm(t) {
    t = t || {};
    var ov = modal(t.id ? 'Sửa công việc' : 'Thêm công việc', '<div class="es-grid2"><div style="grid-column:1/-1"><label class="es-label">Công việc *</label><input class="es-input" id="tfName" value="' + esc(t.name || '') + '"></div><div><label class="es-label">Giai đoạn / nhóm</label><input class="es-input" id="tfPhase" value="' + esc(t.phase || '') + '" placeholder="VD: C. Phần thân"></div><div><label class="es-label">Hạng mục / vị trí</label><input class="es-input" id="tfLoc" value="' + esc(t.location || '') + '" placeholder="VD: Tầng 2"></div><div><label class="es-label">Ngày dự kiến nghiệm thu</label><input class="es-input" type="date" id="tfDate" value="' + esc(String(t.plannedDate || '').slice(0, 10)) + '"></div><div><label class="es-label">Trạng thái</label><select class="es-select" id="tfSt">' + STATUS.map(function (s) { return '<option' + (s === (t.status || STATUS[0]) ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div><label class="es-label" style="margin-top:12px">Hồ sơ cần lập cho công việc này</label><div style="display:flex;flex-wrap:wrap;gap:8px">' + DOCS.map(function (d) { return '<label class="es-chip" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;padding:4px 10px" title="' + esc(d.name) + '"><input type="checkbox" data-rd="' + d.code + '" ' + (docsOf(t).indexOf(d.code) !== -1 ? 'checked' : '') + ' style="width:auto;height:auto"> ' + d.code + ' · ' + esc(d.name.length > 34 ? d.name.slice(0, 32) + '…' : d.name) + '</label>'; }).join('') + '</div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="es-btn" data-x2 type="button">Huỷ</button><button class="es-btn es-btn-primary" id="tfOk" type="button">Lưu</button></div>', 900);
    ov.querySelector('[data-x2]').addEventListener('click', ov.close);
    $('tfOk').addEventListener('click', function () {
      var name = $('tfName').value.trim(); if (!name) { $('tfName').focus(); return; }
      var req = []; ov.querySelectorAll('[data-rd]').forEach(function (c) { if (c.checked) req.push(c.dataset.rd); });
      var data = { id: t.id, projectId: st.proj, name: name, phase: $('tfPhase').value.trim(), location: $('tfLoc').value.trim(), plannedDate: $('tfDate').value, status: $('tfSt').value, requiredDocs: JSON.stringify(req), order: t.order || (Date.now() % 1000000000) };
      if (!t.id) delete data.id; TM.saveColl('qlclTasks', data, user()); ov.close(); renderAll();
    });
  }
  function openSet() {
    var ov = modal('Nạp bộ công việc mẫu', '<div class="es-grid2"><div><label class="es-label">Loại công trình</label><select class="es-select" id="sKind"><option value="nhapho">Nhà phố / nhà ở riêng lẻ BTCT</option><option value="noithat">Thi công nội thất / hoàn thiện</option></select></div><div><label class="es-label">Số tầng (nhà phố)</label><input class="es-input" id="sFloors" value="3" inputmode="numeric"></div></div><p class="es-note" style="margin-top:10px">Bộ mẫu gồm công việc theo từng giai đoạn kèm danh sách hồ sơ cần lập (phiếu yêu cầu nghiệm thu, biên bản nghiệm thu, phụ lục khối lượng, lấy mẫu thí nghiệm…). Sau khi nạp, sửa / xoá / thêm tuỳ ý. Công việc đã có sẽ không bị xoá.</p><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px"><button class="es-btn" data-x2 type="button">Huỷ</button><button class="es-btn es-btn-primary" id="sOk" type="button">Nạp vào dự án</button></div>', 640);
    ov.querySelector('[data-x2]').addEventListener('click', ov.close);
    $('sOk').addEventListener('click', function () {
      var fl = Math.max(1, Math.min(30, parseInt($('sFloors').value, 10) || 1)), list = taskSet($('sKind').value, fl), base = Date.now() % 1000000000;
      var made = TM.addCollBatch('qlclTasks', list.map(function (x, i) { return { projectId: st.proj, name: x.name, phase: x.phase, location: x.location, requiredDocs: JSON.stringify(x.requiredDocs), status: STATUS[0], order: base + i }; }), user());
      ov.close(); toast(made ? 'Đã nạp ' + made.length + ' công việc' : 'Không nạp được'); renderAll();
    });
  }
  function bulkMake() {
    var ids = Object.keys(st.sel); if (!ids.length) { alert('Tick chọn các công việc ở cột đầu bảng trước.'); return; }
    var ov = modal('Lập hàng loạt hồ sơ nháp cho ' + ids.length + ' công việc', '<label class="es-label">Loại hồ sơ</label><select class="es-select" id="bType">' + DOCS.map(function (d) { return '<option value="' + d.code + '">' + d.code + ' — ' + esc(d.name) + '</option>'; }).join('') + '</select><p class="es-note" style="margin-top:10px">Mỗi công việc được tạo 1 hồ sơ ở trạng thái <b>Nháp</b> (tự điền tên công việc, vị trí, số hiệu). Mở từng hồ sơ ở tab “Hồ sơ đã lập” để hoàn thiện khối lượng rồi in.</p><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px"><button class="es-btn" data-x2 type="button">Huỷ</button><button class="es-btn es-btn-primary" id="bOk" type="button">Tạo hồ sơ nháp</button></div>', 640);
    ov.querySelector('[data-x2]').addEventListener('click', ov.close);
    $('bOk').addEventListener('click', function () {
      var tpl = DOC[$('bType').value], n = 0, rs = recs().filter(function (r) { return r.docType === tpl.code; }).length;
      ids.forEach(function (id) { var t = TM.listColl('qlclTasks').filter(function (x) { return x.id === id; })[0]; if (!t) return; n++; var f = { work: t.name, location: t.location || '', scope: t.name, stage: t.name }, yy = String(new Date().getFullYear()).slice(-2);
        var data = { f: f, rows: tpl.table ? tpl.table.rows.map(function (r) { return r.slice(); }) : [], concl: tpl.concl || '', place: info().place || '' };
        TM.saveColl('qlclRecords', Object.assign({ projectId: st.proj, taskId: t.id, docType: tpl.code, docNo: tpl.code + '-' + yy + '-' + ('00' + (rs + n)).slice(-3), title: t.name, date: today(), status: 'Nháp', location: t.location || '' }, TM.packJson('d', data, 3)), user()); });
      st.sel = {}; ov.close(); toast('Đã tạo ' + n + ' hồ sơ nháp'); st.tab = 'recs'; showTab('recs');
    });
  }

  // ---------- tab: lập nhanh ----------
  function renderMake() {
    $('qMake').innerHTML = '<p class="es-note" style="margin:0 0 12px">Chọn loại hồ sơ cần lập — thông tin công trình, các bên và số hiệu tự điền. Muốn gắn với một công việc trong danh mục, lập từ tab “Danh mục công việc”.</p><div class="es-grid3">' + DOCS.map(function (d) { return '<div class="es-card" style="margin:0;display:flex;flex-direction:column;gap:6px"><div><span class="es-chip">' + d.code + '</span></div><div style="font-weight:700;font-size:.875rem">' + esc(d.name) + '</div><div class="es-note" style="flex:1">' + esc(d.desc) + '</div><button class="es-btn es-btn-sm es-btn-primary" data-c="' + d.code + '" type="button" style="align-self:flex-start">Lập hồ sơ</button></div>'; }).join('') + '</div>';
    $('qMake').onclick = function (ev) { var b = ev.target.closest('[data-c]'); if (b) openDoc(DOC[b.dataset.c], null, null); };
  }

  // ---------- tab: hồ sơ đã lập ----------
  function renderRecs() {
    var root = $('qRecs'), rs = recs(), fq = st.rq || '', ft = st.rt || '', fs = st.rs || '';
    var list = rs.filter(function (r) { return (!ft || r.docType === ft) && (!fs || r.status === fs) && (!fq || norm(r.docNo + ' ' + r.title + ' ' + (r.location || '')).indexOf(norm(fq)) !== -1); });
    root.innerHTML = '<div class="es-toolbar"><input class="es-input" id="rQ" placeholder="Tìm số hiệu, tiêu đề, vị trí…" value="' + esc(fq) + '" style="flex:1 1 220px"><select class="es-select" id="rT"><option value="">Mọi loại hồ sơ</option>' + DOCS.map(function (d) { return '<option value="' + d.code + '"' + (d.code === ft ? ' selected' : '') + '>' + d.code + ' — ' + esc(d.name.slice(0, 40)) + '</option>'; }).join('') + '</select><select class="es-select" id="rS"><option value="">Mọi trạng thái</option><option' + (fs === 'Nháp' ? ' selected' : '') + '>Nháp</option><option' + (fs === 'Đã ký' ? ' selected' : '') + '>Đã ký</option></select><span class="es-note">' + list.length + ' / ' + rs.length + ' hồ sơ</span></div>' +
      '<div class="es-tablewrap"><table class="es-table" style="min-width:900px"><thead><tr><th style="width:140px">Số hiệu</th><th style="min-width:300px">Tiêu đề / công việc</th><th style="min-width:200px">Loại hồ sơ</th><th style="width:110px">Ngày lập</th><th style="width:100px">Trạng thái</th><th style="width:230px"></th></tr></thead><tbody>' + (list.length ? list.map(function (r) { return '<tr data-id="' + r.id + '"><td style="font-family:JetBrains Mono,monospace;font-size:.75rem;white-space:nowrap">' + esc(r.docNo) + '</td><td>' + esc(r.title) + (r.location ? '<div style="font-size:.6875rem;color:var(--es-muted)">' + esc(r.location) + '</div>' : '') + '</td><td>' + esc(DOC[r.docType] ? DOC[r.docType].name : r.docType) + '</td><td style="white-space:nowrap">' + vn(r.date) + '</td><td><span class="es-chip ' + (r.status === 'Đã ký' ? 'ok' : 'warn') + '">' + esc(r.status) + '</span></td><td style="white-space:nowrap"><button class="es-btn es-btn-sm" data-o>Mở / sửa</button> <button class="es-btn es-btn-sm" data-p>In / PDF</button> <button class="es-btn es-btn-sm" data-w>Word</button></td></tr>'; }).join('') : '<tr><td colspan="6" class="es-empty">Chưa có hồ sơ nào' + (rs.length ? ' khớp bộ lọc' : '') + '.</td></tr>') + '</tbody></table></div>';
    var rd = function () { var p = $('rQ').selectionStart; st.rq = $('rQ').value; st.rt = $('rT').value; st.rs = $('rS').value; renderRecs(); var e = $('rQ'); e.focus(); e.setSelectionRange(p, p); };
    $('rQ').addEventListener('input', rd); $('rT').addEventListener('change', rd); $('rS').addEventListener('change', rd);
    root.querySelector('tbody').addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr'); if (!tr || !tr.dataset.id) return; var r = rs.filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!r || !DOC[r.docType]) return;
      if (ev.target.closest('[data-o]')) openDoc(DOC[r.docType], r, null); else if (ev.target.closest('[data-p]')) openPrint(DOC[r.docType], r); else if (ev.target.closest('[data-w]')) saveWord(DOC[r.docType], r);
    });
  }

  function renderHelp() {
    $('qHelp').innerHTML = '<div class="es-card"><h3>Quy trình làm hồ sơ chất lượng</h3><ol class="es-steps"><li>Chọn <b>dự án</b> → bấm <b>Thông tin công trình &amp; các bên</b>, nhập chủ đầu tư, tư vấn giám sát, nhà thầu, tư vấn thiết kế và người đại diện (một lần).</li><li>Tab <b>Danh mục công việc</b> → <b>Nạp bộ công việc mẫu</b> (nhà phố BTCT theo số tầng, hoặc nội thất) rồi thêm / bớt theo thực tế.</li><li>Trước khi nghiệm thu một công việc: bấm chip <b>PYC-NT</b> lập phiếu yêu cầu nghiệm thu; khi nghiệm thu xong lập <b>BB-NTCV</b> + phụ lục khối lượng <b>PL-KL</b>. Vật liệu: <b>PYC-VL</b> → <b>BB-NTVL</b>; lấy mẫu bê tông: <b>BB-LM</b>.</li><li>Tick nhiều công việc → <b>Lập biên bản cho mục đã chọn</b> để tạo hàng loạt hồ sơ nháp, sau đó mở từng hồ sơ điền khối lượng.</li><li>Hồ sơ <b>in / PDF</b> hoặc <b>tải Word</b> để ký; đổi trạng thái sang <b>Đã ký</b> để chip chuyển xanh và tính vào tỷ lệ hoàn thiện hồ sơ. Ký xong BB-NTCV thì công việc tự chuyển “Đã nghiệm thu”.</li></ol></div><div class="es-card"><h3>Căn cứ &amp; lưu ý</h3><p class="es-note">Mẫu dựng theo hướng dẫn chung của Nghị định 06/2021/NĐ-CP và Thông tư 10/2021/TT-BXD về quản lý chất lượng, thi công xây dựng và bảo trì công trình. Đây là <b>mẫu tham khảo</b> — mỗi chủ đầu tư / hợp đồng có thể yêu cầu biểu mẫu riêng (đánh số, bố cục, thành phần ký); luôn đối chiếu trước khi nộp hồ sơ. Hồ sơ được lưu ở sheet QLCL-Hồ sơ nghiệm thu, danh mục ở QLCL-Danh mục công việc.</p></div>';
  }
  function renderStat() { var a = tasks(), d = a.filter(function (t) { return t.status === 'Đã nghiệm thu'; }).length; $('qStat').textContent = st.proj ? a.length + ' công việc · ' + d + ' đã nghiệm thu · ' + recs().length + ' hồ sơ' : ''; }

  function renderAll() { renderStat(); if (st.tab === 'tasks') renderTasks(); else if (st.tab === 'make') renderMake(); else if (st.tab === 'recs') renderRecs(); else renderHelp(); }
  function showTab(t) {
    st.tab = t; document.querySelectorAll('#qTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    [['tasks', 'qTasks'], ['make', 'qMake'], ['recs', 'qRecs'], ['help', 'qHelp']].forEach(function (p) { $(p[1]).hidden = p[0] !== t; });
    renderAll();
  }
  function fillProj() {
    var ps = projects(), keep = st.proj || localStorage.getItem('hq_ql_proj') || '';
    $('qProj').innerHTML = ps.length ? ps.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) + '</option>'; }).join('') : '<option value="">(chưa có dự án)</option>';
    if (keep && ps.some(function (p) { return p.id === keep; })) $('qProj').value = keep;
    st.proj = $('qProj').value;
  }
  $('qProj').addEventListener('change', function () { st.proj = this.value; st.sel = {}; try { localStorage.setItem('hq_ql_proj', st.proj); } catch (e) { } renderAll(); });
  $('qInfoBtn').addEventListener('click', function () { if (!st.proj) { alert('Chưa có dự án. Tạo dự án ở trang Dự án trước.'); return; } openInfo(); });
  $('qTabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-t]'); if (b) showTab(b.dataset.t); });
  fillProj(); showTab('tasks');
  load(function () { if (!document.querySelector('.es-overlay') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { fillProj(); renderAll(); } });
  window.QualityDocs = { DOCS: DOCS, render: render };
})();
