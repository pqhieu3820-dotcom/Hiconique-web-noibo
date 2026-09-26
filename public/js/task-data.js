/**
 * Task Manager Data Layer
 * Supports localStorage and Google Sheets integration
 */

// Check if using Google Sheets (from gsheets-config.js)
function isUsingGSheets() {
  return typeof GSHEETS_CONFIG !== 'undefined' && GSHEETS_CONFIG.USE_GSHEETS === true;
}

// 2026-09-24: phát hiện thực tế — nhiều lượt cập nhật tiến độ/chấm công ghi
// ĐÚNG vào localStorage (người dùng thấy trên máy mình) nhưng KHÔNG BAO GIỜ
// tới được Google Sheet (Founder kiểm tra Sheet không thấy). Nguyên nhân:
// callGSheetsAPI() cũ không có timeout (fetch() có thể treo vô thời hạn trên
// mạng di động chập chờn/Apps Script cold-start — y hệt lý do fetchFromAPI()
// đã thêm timeout+retry cho luồng ĐỌC từ 2026-09-19), KHÔNG retry, và lỗi chỉ
// console.error() — người dùng không hề biết lần lưu đó đã mất, tưởng đã
// xong vì UI local vẫn hiện đúng dữ liệu vừa nhập.
function callGSheetsAPI(action, data, id, isRetry) {
  if (!isUsingGSheets() || !GSHEETS_CONFIG.API_URL) return;
  // Bẫy phòng hờ: bản thân add()/update()/remove() đã chặn từ trước khi gọi
  // tới đây, nhưng vài hàm ghi đặc biệt gọi callGSheetsAPI() trực tiếp — chặn
  // luôn ở đây để không bao giờ có request ghi nào lọt ra ngoài lúc mất mạng.
  if (typeof Offline !== 'undefined' && !Offline.isOnline()) return;

  function fail(reason) {
    console.error('GSheets API error (' + action + '):', reason);
    if (isRetry) {
      // Đã thử lại 1 lần vẫn lỗi — báo cho UI biết để không im lặng mất dữ
      // liệu nữa (xem listener 'hiconique:sync-failed' trong portal.js).
      window.dispatchEvent(new CustomEvent('hiconique:sync-failed', { detail: { action: action, id: id } }));
      return;
    }
    setTimeout(function () { callGSheetsAPI(action, data, id, true); }, 1500);
  }

  try {
    var params = '?action=' + encodeURIComponent(action);
    if (id) params += '&id=' + encodeURIComponent(id);
    if (data && Object.keys(data).length > 0) {
      params += '&data=' + encodeURIComponent(JSON.stringify(data));
    }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);

    fetch(GSHEETS_CONFIG.API_URL + params, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal
    }).then(function(response) {
      clearTimeout(timer);
      return response.json();
    }).then(function(result) {
      if (result && result.error) fail(result.error);
    }).catch(function(e) {
      clearTimeout(timer);
      fail(e);
    });
  } catch (e) {
    fail(e);
  }
}

function syncToGSheets(type, action, data, id) {
  var actionMap = {
    members: { add: 'addMember', update: 'updateMember', delete: 'deleteMember' },
    projects: { add: 'addProject', update: 'updateProject', delete: 'deleteProject' },
    tasks: { add: 'addTask', update: 'updateTask', delete: 'deleteTask', toggle: 'toggleTask' },
    proposals: { add: 'addProposal', update: 'updateProposal', delete: 'deleteProposal', approve: 'approveProposal', reject: 'rejectProposal' },
    timesheet: { add: 'addTimesheet', update: 'updateTimesheet' },
    notifications: { add: 'addNotification', update: 'updateNotification', delete: 'deleteNotification' },
    notices: { add: 'addNotice', update: 'updateNotice', delete: 'deleteNotice' },
    documents: { add: 'addDocument', update: 'updateDocument', delete: 'deleteDocument' },
    payslips: { add: 'addPayslip', update: 'updatePayslip', delete: 'deletePayslip' },
    commissions: { add: 'addCommission', update: 'updateCommission', delete: 'deleteCommission' },
    commissionRates: { add: 'addCommissionRate', update: 'updateCommissionRate', delete: 'deleteCommissionRate' },
    priceCatalog: { add: 'addPriceCatalog', update: 'updatePriceCatalog', delete: 'deletePriceCatalog' },
    lightingPlans: { add: 'addLightingPlan', update: 'updateLightingPlan' },
    financeEntries: { add: 'addFinanceEntry', update: 'updateFinanceEntry', delete: 'deleteFinanceEntry' },
    receivables: { add: 'addReceivable', update: 'updateReceivable', delete: 'deleteReceivable' },
    bsSnapshots: { add: 'addBsSnapshot', update: 'updateBsSnapshot', delete: 'deleteBsSnapshot' },
    orders: { add: 'addOrder', update: 'updateOrder', delete: 'deleteOrder' }
  };

  var apiAction = actionMap[type] ? actionMap[type][action] : null;
  if (!apiAction) return;

  callGSheetsAPI(apiAction, data, id);
}

// Payslips/Commissions/CommissionRates are brand-new sheets with no CSV
// publish gid available yet, so they're read straight from the Apps Script
// Web App (JSON) instead of the CSV-publish path used for the older sheets.
// 2026-09-19: fetch() KHÔNG có timeout mặc định — trên mạng di động chập
// chờn, 1 request có thể treo rất lâu (nhiều chục giây tới cả phút) trước khi
// trình duyệt tự bỏ cuộc, và hàm này là ĐƯỜNG DUY NHẤT đọc dữ liệu Sheet cho
// TOÀN BỘ app (kể cả loadAttendanceLocations() dùng ở trang Chấm công) — đây
// mới là nguyên nhân chính khiến người dùng phản ánh "kiểm tra để chấm công
// lâu hơn 1-2 phút", không chỉ riêng phần định vị GPS. Ép timeout cứng 8s
// bằng AbortController, quá giờ thì coi như đọc lỗi (rơi về callback([]) có
// sẵn) thay vì treo vô thời hạn.
// 2026-09-19 (2): 1 lần timeout/lỗi (mạng chập chờn, hay gặp nhất là Apps
// Script "cold start" — lần gọi đầu tiên sau 1 lúc không ai dùng có thể mất
// 10-20s+ để khởi động lại) trước đây bị coi là "hết dữ liệu" ngay — hậu quả
// thật: máy MỚI hoàn toàn (chưa có cache localStorage nào, VD lần đầu đăng
// nhập ở 1 thiết bị khác) hiện sai "Chưa cấu hình địa điểm"/"Chưa cấu hình
// IP" dù Sheet vẫn còn đủ dữ liệu (chỉ là lần gọi ĐẦU bị cold-start timeout),
// và bảng "Thiết bị đã đăng ký" không thấy các thiết bị đã đăng ký từ máy
// khác vì getMembers() cũng lỡ y hệt. Thêm 1 lần thử lại (cách nhau 1.5s)
// trước khi thật sự chấp nhận rỗng — đủ để qua khỏi 1 lần cold-start điển
// hình mà không kéo dài tới mức "chờ 1-2 phút" như bug gốc đã fix trước đó
// (8s timeout/lần, tối đa 2 lần = ~17.5s xấu nhất, thay vì vô thời hạn).
function fetchFromAPI(action, callback, isRetry) {
  if (!isUsingGSheets() || !GSHEETS_CONFIG.API_URL) { callback([]); return; }
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 8000);
  fetch(GSHEETS_CONFIG.API_URL + '?action=' + encodeURIComponent(action), { redirect: 'follow', signal: controller.signal })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      // Đọc thành công = mốc "dữ liệu mới nhất" cho banner offline — đánh dấu
      // TRƯỚC khi trả callback để mọi trang đều thấy mốc giờ cập nhật đúng.
      if (typeof Offline !== 'undefined') Offline.markSynced();
      clearTimeout(timer);
      callback(Array.isArray(data) ? data : []);
    })
    .catch(function (e) {
      clearTimeout(timer);
      if (!isRetry) { setTimeout(function () { fetchFromAPI(action, callback, true); }, 1500); return; }
      console.error('GSheets API read failed:', e);
      callback([]);
    });
}

var TaskManager = (function() {
  'use strict';

  // Default members
  var DEFAULT_MEMBERS = [
    { id: 'CEO', name: 'Phạm Quang Hiếu', role: 'CEO', roleLevel: 'admin', email: 'pqhieu3820@gmail.com', password: '123456', dob: '1990-01-15', cccd: '012345678901', hometown: 'Hà Nội', bankAccount: '1234567890', color: '#B08D57', avatar: 'HQ', createdAt: '2026-01-01' },
    { id: 'MGR1', name: 'Nguyễn Hiếu', role: 'Quản lý thiết kế', roleLevel: 'manager', email: 'hieu@hiconique.vn', password: '123456', dob: '1992-05-20', cccd: '012345678902', hometown: 'TP.HCM', bankAccount: '1234567891', color: '#8E7CC3', avatar: 'NH', createdAt: '2026-01-01' },
    { id: 'MGR2', name: 'Trần Mạnh', role: 'Quản lý thi công', roleLevel: 'manager', email: 'manh@hiconique.vn', password: '123456', dob: '1988-08-10', cccd: '012345678903', hometown: 'Hà Nội', bankAccount: '1234567892', color: '#4F6F52', avatar: 'TM', createdAt: '2026-01-01' },
    { id: 'MEM1', name: 'Giản Phương', role: 'Thiết kế đồ họa', roleLevel: 'member', email: 'phuong@hiconique.vn', password: '123456', dob: '1995-03-25', cccd: '012345678904', hometown: 'Đà Nẵng', bankAccount: '1234567893', color: '#3B6B8C', avatar: 'GP', createdAt: '2026-01-01' },
    { id: 'MEM2', name: 'Lê Thành', role: 'Kỹ sư nội thất', roleLevel: 'member', email: 'thanh@hiconique.vn', password: '123456', dob: '1993-11-08', cccd: '012345678905', hometown: 'Hải Phòng', bankAccount: '1234567894', color: '#B8725A', avatar: 'LT', createdAt: '2026-01-01' }
  ];

  // Phân tầng Cấp bậc (Level) CỐ ĐỊNH (2026-09-16, theo yêu cầu người dùng) —
  // 5 mức, PHẢI khớp đúng LEVELS trong gsheets-api-v2.js (đổi 1 bên phải đổi
  // bên kia, không thì dropdown Sheet lệch dropdown web). `roleLevel` là
  // field CŨ (3 mức admin/manager/member) mà ~25 chỗ check quyền rải khắp
  // client vẫn dùng — server tự suy roleLevel từ level (xem
  // LEVEL_TO_ROLELEVEL trong gsheets-api-v2.js), field `roleLevel` client
  // nhận về đã là giá trị suy sẵn, không cần tự suy lại ở đây.
  //   Level 0 Founder — toàn quyền tối thượng.
  //   Level 1 CEO — quản lý vận hành chung, xem báo cáo tổng hợp mọi khối.
  //   Level 2 Giám đốc Bộ phận — toàn quyền thêm/sửa/xoá dữ liệu.
  //   Level 3 Quản lý — quản lý/giao việc/duyệt dữ liệu dự án hoặc nhân sự.
  //   Level 4 Nhân viên — chỉ xem không gian làm việc của mình.
  var LEVELS = [
    { code: 'founder', label: 'Founder', order: 0, roleLevel: 'admin' },
    { code: 'ceo', label: 'CEO', order: 1, roleLevel: 'admin' },
    { code: 'dept_director', label: 'Giám đốc Bộ phận', order: 2, roleLevel: 'admin' },
    { code: 'manager', label: 'Quản lý', order: 3, roleLevel: 'manager' },
    { code: 'member', label: 'Nhân viên', order: 4, roleLevel: 'member' }
  ];
  function getLevels() { return LEVELS.slice(); }
  function getLevelByCode(code) { return LEVELS.find(function (l) { return l.code === code; }) || null; }

  // Danh mục BỘ PHẬN (khối) CỐ ĐỊNH (2026-09-16) — cấp cha của Phòng ban,
  // theo đúng 4 nhóm trong "Standard Operating Procedure" nội bộ. Mã viết
  // tắt lấy từ tên tiếng Anh trong ngoặc của SOP (Back-Office -> BO,
  // Front-Office -> FO, Design & Data Core -> DDC, Construct & Product
  // Core -> CPC) — cùng quy ước với mã Phòng ban bên dưới.
  var DIVISIONS = [
    { code: 'BO', name: 'Khối Quản trị & Vận hành chung', desc: 'Back-Office — quản trị chiến lược, nhân sự, kế toán & tài chính, hành chính & công nghệ, pháp chế.' },
    { code: 'FO', name: 'Khối Kinh doanh & Trải nghiệm Khách hàng', desc: 'Front-Office — kinh doanh, truyền thông thương hiệu và chăm sóc khách hàng.' },
    { code: 'DDC', name: 'Khối Chuyên môn Thiết kế & Số hóa', desc: 'Design & Data Core — thiết kế ý tưởng & 3D, kỹ thuật triển khai 2D, quản lý dữ liệu số (BIM) và nghiên cứu kỹ thuật.' },
    { code: 'CPC', name: 'Khối Kỹ thuật Xây dựng & Sản xuất', desc: 'Construct & Product Core — dự toán, cung ứng, kho vận, sản xuất, thi công, an toàn và quản lý chất lượng.' }
  ];
  function getDivisions() { return DIVISIONS.slice(); }
  function getDivisionByCode(code) { return DIVISIONS.find(function (d) { return d.code === code; }) || null; }

  // Danh mục phòng ban CỐ ĐỊNH (2026-09-16) — theo đúng "Standard Operating
  // Procedure" nội bộ (mã phòng ban dùng trong đánh số văn bản), dùng chung
  // cho form đăng ký (auth.js), trang cá nhân (profile.html) và trang quản
  // lý thành viên (team.html) — 1 nguồn duy nhất, không viết trùng 3 nơi.
  // Không tự thêm/sửa danh sách này khi không có yêu cầu — đây là danh mục
  // chuẩn hoá dùng cho đánh số văn bản/hồ sơ, đổi tuỳ tiện sẽ lệch với SOP.
  // Cập nhật 2026-09-18: đủ 19 phòng ban theo SOP mới nhất (thêm DRW; đổi mã
  // EST -> QS, QAS -> QAC cho khớp SOP — không có thành viên nào đang gán 2
  // mã cũ này nên đổi an toàn) + thêm `desc` (mô tả chức năng) cho mỗi mục,
  // dùng để hiện tooltip khi di chuột vào thông tin ban ngành ở modal Team
  // (xem bindDeptTooltip() trong portal.js). Cũng nhớ đồng bộ 2 mảng
  // DEPARTMENT_NAMES/DEPARTMENT_CODES trong gsheets-api-v2.js rồi redeploy
  // Apps Script — nếu không, dropdown chọn phòng ban trên Google Sheet sẽ
  // lệch với danh sách này.
  // `divisionCode` = mã Bộ phận cha (xem DIVISIONS ở trên) — quan hệ cha/con
  // dùng để lọc dropdown Phòng ban theo Bộ phận đã chọn ở form đăng ký/trang
  // cá nhân (chọn Bộ phận trước sẽ thu hẹp danh sách Phòng ban tương ứng).
  var DEPARTMENTS = [
    { code: 'BOD', name: 'Ban Giám đốc', group: 'Khối Quản trị & Vận hành chung', divisionCode: 'BO', desc: 'Quản trị chiến lược, lập kế hoạch năm, quy chế công ty, ủy quyền và pháp lý doanh nghiệp.' },
    { code: 'HRM', name: 'Nhân sự', group: 'Khối Quản trị & Vận hành chung', divisionCode: 'BO', desc: 'Tuyển dụng, đào tạo, đánh giá năng lực, chấm công, tính lương thưởng và phúc lợi.' },
    { code: 'ACC', name: 'Kế toán & Tài chính', group: 'Khối Quản trị & Vận hành chung', divisionCode: 'BO', desc: 'Lập ngân sách, tạm ứng, thanh toán, quản lý công nợ, và kiểm soát dòng tiền dự án.' },
    { code: 'ADM', name: 'Hành chính & Công nghệ', group: 'Khối Quản trị & Vận hành chung', divisionCode: 'BO', desc: 'Quản lý tài sản văn phòng, cấp phát trang thiết bị (đồng phục, máy tính), bảo trì hệ thống và bản quyền phần mềm.' },
    { code: 'LEG', name: 'Pháp chế & Hợp đồng', group: 'Khối Quản trị & Vận hành chung', divisionCode: 'BO', desc: 'Soạn thảo hợp đồng, phụ lục, thỏa thuận bảo mật (NDA) và kiểm soát rủi ro pháp lý.' },
    { code: 'BIZ', name: 'Kinh doanh', group: 'Khối Kinh doanh & Trải nghiệm Khách hàng', divisionCode: 'FO', desc: 'Tiếp cận khách hàng, tư vấn sơ bộ, thương thảo báo giá và chốt hợp đồng nguyên tắc.' },
    { code: 'MKT', name: 'Truyền thông', group: 'Khối Kinh doanh & Trải nghiệm Khách hàng', divisionCode: 'FO', desc: 'Quản trị nhận diện thương hiệu, tiêu chuẩn hóa ấn phẩm truyền thông, nhiếp ảnh kiến trúc và quản lý kênh truyền thông.' },
    { code: 'CUS', name: 'Chăm sóc Khách hàng', group: 'Khối Kinh doanh & Trải nghiệm Khách hàng', divisionCode: 'FO', desc: 'Khảo sát mức độ hài lòng sau bàn giao, tiếp nhận khiếu nại và tổ chức tri ân khách hàng.' },
    { code: 'DES', name: 'Thiết kế Ý tưởng & 3D', group: 'Khối Chuyên môn Thiết kế & Số hóa', divisionCode: 'DDC', desc: 'Khảo sát hiện trạng, thiết kế Concept, dựng hình 3D (SketchUp, 3ds Max, Blender), định hình ngôn ngữ không gian, ứng dụng công thái học.' },
    { code: 'DRW', name: 'Kỹ thuật Triển khai 2D', group: 'Khối Chuyên môn Thiết kế & Số hóa', divisionCode: 'DDC', desc: 'Khảo sát hiện trạng, lên mặt bằng bố trí công năng 2D, tiếp nhận Concept 3D để khai triển hồ sơ bản vẽ kỹ thuật thi công (Shop Drawing). Kiểm soát chặt chẽ các tiêu chuẩn kích thước cấu tạo thực tế và độ hoàn thiện bản vẽ.' },
    { code: 'BIM', name: 'Quản lý Dữ liệu số', group: 'Khối Chuyên môn Thiết kế & Số hóa', divisionCode: 'DDC', desc: 'Quản lý dự án theo tiêu chuẩn IFC (định dạng dữ liệu mở quốc tế trao đổi mô hình BIM giữa các phần mềm), quản lý môi trường dữ liệu chung (CDE), luồng luân chuyển file đa phần mềm và quy tắc lưu trữ đám mây.' },
    { code: 'RND', name: 'Nghiên cứu Kỹ thuật', group: 'Khối Chuyên môn Thiết kế & Số hóa', divisionCode: 'DDC', desc: 'Xây dựng thư viện vật liệu hoàn thiện, đánh giá đặc tính lý hóa vật tư, cập nhật công nghệ vật liệu mới, quy chuẩn trong thiết kế.' },
    { code: 'QS', name: 'Dự toán & Bóc tách', group: 'Khối Kỹ thuật Xây dựng & Sản xuất', divisionCode: 'CPC', desc: 'Bóc tách khối lượng từ bản vẽ kỹ thuật, áp giá, lập dự toán thi công (BOQ) và tính toán chi phí phát sinh.' },
    { code: 'PUR', name: 'Cung ứng & Mua hàng', group: 'Khối Kỹ thuật Xây dựng & Sản xuất', divisionCode: 'CPC', desc: 'Đánh giá nhà cung cấp, đặt hàng vật tư thô, phụ kiện kim khí và thiết bị hoàn thiện.' },
    { code: 'WHS', name: 'Kho bãi & Vận tải', group: 'Khối Kỹ thuật Xây dựng & Sản xuất', divisionCode: 'CPC', desc: 'Quản lý xuất/nhập/tồn kho gỗ, vật tư tại xưởng và điều phối phương tiện vận chuyển hàng lên công trình.' },
    { code: 'MFG', name: 'Xưởng sản xuất', group: 'Khối Kỹ thuật Xây dựng & Sản xuất', divisionCode: 'CPC', desc: 'Bóc tách module CNC, gia công đồ mộc, dán cạnh, sơn hoàn thiện, lắp ráp thử (mock-up) và đóng gói.' },
    { code: 'CON', name: 'Quản lý Thi công', group: 'Khối Kỹ thuật Xây dựng & Sản xuất', divisionCode: 'CPC', desc: 'Lập tiến độ, tổ chức mặt bằng hiện trường, họp phối hợp các bộ môn và giám sát nhà thầu phụ (MEP, thạch cao, đá).' },
    { code: 'HSE', name: 'An toàn & Môi trường', group: 'Khối Kỹ thuật Xây dựng & Sản xuất', divisionCode: 'CPC', desc: 'Quản lý bảo hộ lao động, an toàn giàn giáo, an toàn điện, phòng chống cháy nổ và kiểm soát rác thải.' },
    { code: 'QAC', name: 'Quản lý Chất lượng', group: 'Khối Kỹ thuật Xây dựng & Sản xuất', divisionCode: 'CPC', desc: 'Nghiệm thu vật tư đầu vào, kiểm tra dung sai các điểm dừng kỹ thuật, vệ sinh công nghiệp và quy trình bảo hành/bảo trì.' }
  ];
  function getDepartments() { return DEPARTMENTS.slice(); }
  function getDepartmentByCode(code) { return DEPARTMENTS.find(function (d) { return d.code === code; }) || null; }
  function getDepartmentsByDivision(divisionCode) { return DEPARTMENTS.filter(function (d) { return d.divisionCode === divisionCode; }); }

  // Default projects
  var DEFAULT_PROJECTS = [
    { id: 'prj_A', name: 'Dự án A', type: 'Thiết kế nội thất', progress: 50, status: 'on-track', members: ['CEO', 'MGR1', 'MEM1'], color: '#B08D57', createdAt: '2026-08-01' },
    { id: 'prj_B', name: 'Dự án B', type: 'Thi công xây dựng', progress: 30, status: 'on-track', members: ['MGR2', 'MEM2'], color: '#3B6B8C', createdAt: '2026-08-10' },
    { id: 'prj_C', name: 'Dự án C', type: 'Thiết kế kiến trúc', progress: 10, status: 'on-track', members: ['MGR1', 'MGR2'], color: '#4F6F52', createdAt: '2026-08-15' }
  ];

  // Default tasks
  var DEFAULT_TASKS = [
    { id: 'task_001', title: 'Thiết kế phòng khách Dự án A', description: 'Hoàn thiện bản vẽ thiết kế nội thất phòng khách', projectId: 'prj_A', assigneeIds: ['MGR1'], priority: 'high', status: 'in-progress', deadline: '2026-08-25T17:00', createdBy: 'CEO', createdAt: '2026-08-20', progress: 50, dailyTasks: [
      { date: '2026-08-21', progress: 30, note: 'Đã hoàn thành bản vẽ 3D', done: true },
      { date: '2026-08-22', progress: 20, note: 'Đang chỉnh sửa theo yêu cầu', done: false }
    ]},
    { id: 'task_002', title: 'Giám sát thi công Dự án B', description: 'Theo dõi tiến độ thi công tại công trường', projectId: 'prj_B', assigneeIds: ['MGR2'], priority: 'high', status: 'pending', deadline: '2026-08-30T08:00', createdBy: 'CEO', createdAt: '2026-08-15', progress: 0, dailyTasks: [] },
    { id: 'task_003', title: 'Thiết kế kiến trúc Dự án C', description: 'Lập phương án thiết kế kiến trúc sơ bộ', projectId: 'prj_C', assigneeIds: ['MEM1'], priority: 'medium', status: 'pending', deadline: '2026-09-01T17:00', createdBy: 'MGR1', createdAt: '2026-08-18', progress: 0, dailyTasks: [] },
    { id: 'task_004', title: 'Lập dự toán công trình', description: 'Tính toán chi phí vật liệu và nhân công', projectId: 'prj_B', assigneeIds: ['MEM2'], priority: 'medium', status: 'pending', deadline: '2026-08-28T17:00', createdBy: 'MGR2', createdAt: '2026-08-19', progress: 0, dailyTasks: [] }
  ];

  // Default proposals
  var DEFAULT_PROPOSALS = [
    { id: 'prop_001', title: 'Mua thêm máy tính cho team design', description: 'Cần thêm 2 máy tính cấu hình mạnh cho công việc 3D', type: 'mua-sam', status: 'pending', requesterId: 'MGR1', reviewerId: 'CEO', amount: 50000000, createdAt: '2026-08-10' },
    { id: 'prop_002', title: 'Đăng ký khóa học SketchUp nâng cao', description: 'Khóa học online cho 3 thành viên', type: 'dao-tao', status: 'approved', requesterId: 'MEM1', reviewerId: 'MGR1', amount: 15000000, createdAt: '2026-08-05' },
    { id: 'prop_003', title: 'Sửa chữa máy chiếu phòng họp', description: 'Máy chiếu bị hỏng cần mang đi sửa', type: 'sua-chua', status: 'rejected', requesterId: 'MEM2', reviewerId: 'CEO', amount: 3000000, createdAt: '2026-08-01' }
  ];

  // Storage keys
  var STORAGE_KEYS = {
    projects: 'hiconique_projects',
    tasks: 'hiconique_tasks',
    members: 'hiconique_members',
    proposals: 'hiconique_proposals',
    settings: 'hiconique_settings',
    timesheet: 'hiconique_timesheet',
    notifications: 'hiconique_notifications',
    readNotifications: 'hiconique_read_notifications',
    dismissedNotifications: 'hiconique_dismissed_notifications',
    notices: 'hiconique_notices',
    documents: 'hiconique_documents',
    docCategories: 'hiconique_doc_categories',
    payslips: 'hiconique_payslips',
    commissions: 'hiconique_commissions',
    commissionRates: 'hiconique_commission_rates',
    priceCatalog: 'hiconique_price_catalog',
    lightingStandards: 'hiconique_lighting_standards',
    lightingLamps: 'hiconique_lighting_lamps',
    lightingFactors: 'hiconique_lighting_factors',
    lightingPlans: 'hiconique_lighting_plans',
    financeEntries: 'hiconique_finance_entries',
    receivables: 'hiconique_receivables',
    bsSnapshots: 'hiconique_bs_snapshots',
    orders: 'hiconique_orders'
  };

  // % hoa hồng mặc định theo vai trò — gợi ý khi tạo hoa hồng dự án, admin/
  // quản lý có thể chỉnh lại ở trang % Hoa hồng dự án.
  var DEFAULT_COMMISSION_RATES = [
    { id: 'crate_admin', roleLevel: 'admin', percent: 5, updatedAt: '2026-01-01' },
    { id: 'crate_manager', roleLevel: 'manager', percent: 3, updatedAt: '2026-01-01' },
    { id: 'crate_member', roleLevel: 'member', percent: 1, updatedAt: '2026-01-01' }
  ];

  // Recurring notification rules — seeded once, editable by CEO from the bell panel.
  var DEFAULT_NOTIFICATIONS = [
    { id: 'notification_260101_1', title: 'Nhắc làm đề xuất thanh toán lương', message: 'Đầu tháng — vui lòng hoàn tất đề xuất thanh toán lương cho kỳ trước.', type: 'payroll', scope: 'all', recurring: true, recurRule: 'monthly:1-5', active: true, createdBy: 'CEO', createdAt: '2026-01-01' }
  ];

  // Notice board (public/pages/notices.html) — seeded from the page's original static content.
  // color: xanh (green, nhẹ) < vàng (yellow, trung bình) < đỏ (red, ưu tiên) < tím (purple, khẩn cấp)
  var DEFAULT_NOTICES = [
    { id: 'notice_260101_1', title: 'Nhắc nhở cuối tuần', message: 'Mọi người cập nhật bảng Google Sheets và sao lưu dữ liệu quan trọng trước khi kết thúc ngày làm việc nhé!', color: 'green', createdBy: 'CEO', createdAt: '2026-08-22' },
    { id: 'notice_260101_2', title: 'Họp team tháng 9', message: 'Bàn giao & cải tiến, review dự án đang chạy, kế hoạch tháng mới. Thứ Năm 07/09/2026 · 9:00–10:00.', color: 'yellow', createdBy: 'CEO', createdAt: '2026-08-25' },
    { id: 'notice_260101_3', title: 'Nhắc nhở: cập nhật phiếu lương tháng 9/2026', message: 'Mọi người vào cập nhật phiếu lương từ ngày 01–05 hàng tháng.', color: 'red', createdBy: 'CEO', createdAt: '2026-08-28' },
    { id: 'notice_260101_4', title: 'Bàn giao công trình Vinhouse', message: 'Buổi nghiệm thu cuối cùng dự kiến 30/08/2026. Mời các bộ phận liên quan đến công trường để hoàn tất checklist bàn giao.', color: 'yellow', createdBy: 'MGR2', createdAt: '2026-08-20' },
    { id: 'notice_260101_5', title: 'Lịch training nội bộ', message: 'HICONIQUE mở lớp training về quy trình SPC vào 20/08/2026. Đăng ký trước ngày 18/08.', color: 'green', createdBy: 'MGR1', createdAt: '2026-08-10' }
  ];

  // Wiki / document links (public/pages/wiki.html) — seeded from the page's original static links.
  var DEFAULT_DOCUMENTS = [
    { id: 'document_260101_1', category: 'Template chung', name: 'Hướng dẫn dàn trang bản vẽ', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_2', category: 'Template chung', name: 'Layout trình bày báo giá', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_3', category: 'Template chung', name: 'Template trình bày concept', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_9', category: 'Template chung', name: 'Bảng giá dịch vụ 2026', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_10', category: 'Template chung', name: 'Hợp đồng mẫu · TK · TC', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_4', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Bục ngồi gỗ · chiều cao 600–700 mm', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_5', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Tay vịn · chiều cao 850–950 mm', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_11', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Độ dày kính cường lực · an toàn', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_12', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Vật liệu bề mặt gỗ tự nhiên', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_13', category: 'SPC · Quy chuẩn kỹ thuật', name: 'Đặc tính đá tự nhiên · marble', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_6', category: 'Sổ tay nhân sự', name: 'Quy trình onboarding · nhân viên mới', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_7', category: 'Sổ tay nhân sự', name: 'Chính sách làm việc & OT', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_14', category: 'Sổ tay nhân sự', name: 'Quy chế KPI & lương tháng', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_15', category: 'Sổ tay nhân sự', name: 'Đào tạo nội bộ · lịch học', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_8', category: 'Brand & Marketing', name: 'Logo, màu, font HICONIQUE', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_16', category: 'Brand & Marketing', name: 'Tone & voice thương hiệu', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' },
    { id: 'document_260101_17', category: 'Brand & Marketing', name: 'Template bài viết mạng xã hội', url: '#', createdBy: 'CEO', createdAt: '2026-01-01' }
  ];

  // Danh mục chung cho trang Tài liệu — quản lý riêng (thêm/xoá), không đi qua Google Sheets.
  var DEFAULT_DOC_CATEGORIES = ['Template chung', 'SPC · Quy chuẩn kỹ thuật', 'Sổ tay nhân sự', 'Brand & Marketing'];

  // Cache for Google Sheets data
  // Bug 2026-09-19 phát hiện cùng lúc với bug refreshFromGSheets() trùng tên ở
  // trên: `lastFetch` là 1 mốc giờ DÙNG CHUNG cho MỌI loại dữ liệu thay vì
  // riêng từng loại — hễ BẤT KỲ loại nào khác (projects/tasks/...) fetch
  // thành công thì mốc giờ chung này nhảy lên mới, khiến 1 loại chưa từng
  // fetch lại thật sự (VD `attendanceLocations`, không nằm trong danh sách
  // refreshFromGSheets() làm mới định kỳ) bị "khoá cứng" ở kết quả CŨ (kể cả
  // kết quả rỗng do 1 lần lỗi/timeout) suốt cả phiên mở trang — checkGeoStatus()/
  // checkIpStatus() ở timesheet.html tưởng nhầm là "Chưa cấu hình" rồi hiện
  // ra "Đang tắt" dù dữ liệu thật vẫn còn nguyên trên Sheet. Đổi sang mốc giờ
  // RIÊNG từng loại (`gsCacheTime[type]`).
  var gsCache = {
    projects: null,
    tasks: null,
    members: null,
    proposals: null,
    timesheet: null
  };
  var gsCacheTime = {};

  // 2026-09-22: fix bug "đổi trạng thái xong, rời trang rồi quay lại thì bị
  // trả về giá trị cũ" — người dùng phản ánh Sheet đã ghi nhận đúng nhưng app
  // hiện lại sai. Nguyên nhân: updateTask()/updateProject() ghi localStorage
  // NGAY (đúng) nhưng chỉ BẮN request lên Apps Script (syncToGSheets — fire-
  // and-forget, không chờ), việc ghi thật trên Sheet có thể mất 1-3s+ (đặc
  // biệt lúc Apps Script "cold start"). Nếu refreshFromGSheets() chạy TRONG
  // lúc đó (chuyển trang = initData() tự gọi lại, hoặc silentRefresh() định
  // kỳ 20s) thì bản GET trả về data CŨ (ghi chưa kịp lên Sheet) và bị
  // `localStorage.setItem()` ghi đè thẳng lên bản local ĐÚNG vừa đổi — đây
  // chính là bug. Fix: khi nhận dữ liệu mới từ Sheet, GỘP theo từng bản ghi
  // thay vì ghi đè cả mảng — giữ lại bản có `updatedAt` MỚI HƠN (local hay
  // server), và giữ luôn các bản ghi CHỈ có ở local trong vài phút gần đây
  // (mới tạo/mới xoá mềm, server chưa kịp phản ánh). Chỉ áp dụng cho
  // tasks/projects (nơi người dùng phản ánh bug, sửa đổi nhiều nhất).
  var MERGE_GRACE_MS = 5 * 60 * 1000; // 5 phút — đủ qua khỏi 1 lần cold-start Apps Script chậm nhất

  // 2026-09-24: mergeServerData() gốc chọn NGUYÊN 1 BÊN (local hoặc server)
  // theo updatedAt mới hơn — với task NHIỀU NGƯỜI được giao (VD Khánh+Sáng
  // cùng 1 việc), nếu 2 người cùng lưu tiến độ hàng ngày của MÌNH gần nhau
  // (vài giây/phút), bên "thắng" có thể là bản KHÔNG có dòng dailyTasks của
  // người kia — mất trắng 1 lượt cập nhật dù không ai thao tác sai. Gộp
  // riêng `dailyTasks` theo NGÀY (giữ dòng của CẢ 2 bên, ngày nào trùng thì
  // lấy dòng có `progress` >= — coi như "ghi sau trong cùng ngày thắng")
  // trước khi tính lại "Tổng", thay vì để nguyên bên thua mất hẳn dữ liệu.
  function mergeDailyTasks_(winner, loser) {
    if (!loser || !Array.isArray(loser.dailyTasks) || !loser.dailyTasks.length) return winner;
    var byDate = {};
    (winner.dailyTasks || []).forEach(function (d) { byDate[d.date] = d; });
    var changed = false;
    loser.dailyTasks.forEach(function (d) {
      var existing = byDate[d.date];
      if (!existing || (Number(d.progress) || 0) > (Number(existing.progress) || 0)) {
        byDate[d.date] = d;
        changed = true;
      }
    });
    if (!changed) return winner;
    var mergedDaily = Object.keys(byDate).map(function (k) { return byDate[k]; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var totalProgress = Math.min(100, mergedDaily.reduce(function (s, d) { return s + (Number(d.progress) || 0); }, 0));
    return Object.assign({}, winner, { dailyTasks: mergedDaily, progress: totalProgress });
  }

  function mergeServerData(storageKey, serverArr) {
    var localArr = [];
    try { localArr = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (e) {}
    var localById = {};
    localArr.forEach(function (it) { if (it && it.id) localById[it.id] = it; });
    var now = Date.now();
    var seenIds = {};
    var merged = serverArr.map(function (serverItem) {
      seenIds[serverItem.id] = true;
      var localItem = localById[serverItem.id];
      if (!localItem) return serverItem;
      var localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
      var serverTime = serverItem.updatedAt ? new Date(serverItem.updatedAt).getTime() : 0;
      var winner = localTime > serverTime ? localItem : serverItem;
      var loser = winner === localItem ? serverItem : localItem;
      return storageKey === STORAGE_KEYS.tasks ? mergeDailyTasks_(winner, loser) : winner;
    });
    // Bản ghi CHỈ có ở local (mới tạo, hoặc mới xoá mềm nên visible vừa đổi)
    // và còn trong "grace period" — giữ lại, server sẽ tự phản ánh ở lần sau.
    localArr.forEach(function (it) {
      if (!it || !it.id || seenIds[it.id]) return;
      var stamp = it.updatedAt || it.createdAt;
      var t = stamp ? new Date(stamp).getTime() : 0;
      if (t && now - t < MERGE_GRACE_MS) merged.push(it);
    });
    return merged;
  }

  // Force refresh from Google Sheets (bypass cache).
  // Bug 2026-09-19 phát hiện khi rà lỗi "đăng ký thiết bị mãi không được":
  // file này có 2 hàm CÙNG TÊN `refreshFromGSheets` (hàm này, thêm 2026-09-10
  // để dùng trước khi ghi — nhận callback; và 1 bản thêm sau 2026-09-17 cho
  // silentRefresh() định kỳ — KHÔNG nhận callback, xem lịch sử git). Function
  // declaration trùng tên thì bản khai báo SAU thắng (ghi đè hẳn bản trước) —
  // export `TaskManager.refreshFromGSheets` vì vậy luôn trỏ vào bản KHÔNG hỗ
  // trợ callback, khiến `TaskManager.refreshFromGSheets(doRegister)` trong
  // timesheet.html (nút "Đăng ký thiết bị này") không bao giờ gọi lại
  // `doRegister` — nút kẹt mãi ở "Đang đăng ký..." trên MỌI thiết bị, không
  // phải do mạng hay do 1 máy cụ thể. Đã gộp lại thành 1 hàm duy nhất (đủ
  // field của cả 2 bản cũ + hỗ trợ callback), `silentRefresh` giờ trỏ chung
  // vào đây luôn (gọi không kèm callback vẫn chạy bình thường).
  function refreshFromGSheets(callback) {
    gsCacheTime = {};
    if (!isUsingGSheets()) {
      if (callback) callback(false);
      return;
    }

    var done = 0;
    var total = 16;
    var success = false;

    // 2026-09-19: refreshFromGSheets() (kể cả bản chạy NGẦM mỗi 20s qua
    // silentRefresh trong offline.js) trước đây chỉ ghi lại localStorage,
    // KHÔNG có gì báo cho UI đang mở biết mà vẽ lại — dữ liệu chấm công từ
    // 1 thiết bị khác (VD điện thoại) lên Sheet xong vẫn không hiện ra trên
    // máy đang mở sẵn timesheet.html cho tới khi bấm nút đổi tháng (vô tình
    // gọi lại renderCalendar()) hoặc F5. Phát 1 CustomEvent khi TOÀN BỘ các
    // fetch ở trên xong (dù thành công hay không) để trang đang mở tự vẽ lại
    // — xem timesheet.html lắng nghe 'hiconique:data-refreshed'.
    function checkDone() {
      done++;
      if (done >= total) {
        if (success) autoHideExpiredCompleted();
        if (callback) callback(success);
        try { window.dispatchEvent(new CustomEvent('hiconique:data-refreshed')); } catch (e) {}
      }
    }

    getFromGSheets('projects', function(projects) {
      if (projects.length > 0) {
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(mergeServerData(STORAGE_KEYS.projects, projects)));
        success = true;
      }
      checkDone();
    });
    getFromGSheets('tasks', function(tasks) {
      if (tasks.length > 0) {
        localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(mergeServerData(STORAGE_KEYS.tasks, tasks)));
      }
      checkDone();
    });
    getFromGSheets('members', function(members) {
      if (members.length > 0) {
        localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
      }
      checkDone();
    });
    getFromGSheets('proposals', function(proposals) {
      if (proposals.length > 0) {
        localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(proposals));
      }
      checkDone();
    });
    getFromGSheets('timesheet', function(timesheet) {
      if (timesheet.length > 0) {
        localStorage.setItem(STORAGE_KEYS.timesheet, JSON.stringify(timesheet));
      }
      checkDone();
    });
    getFromGSheets('notifications', function(notifications) {
      if (notifications.length > 0) {
        localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
      }
      checkDone();
    });
    getFromGSheets('notices', function(notices) {
      if (notices.length > 0) {
        localStorage.setItem(STORAGE_KEYS.notices, JSON.stringify(notices));
      }
      checkDone();
    });
    getFromGSheets('documents', function(documents) {
      if (documents.length > 0) {
        localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents));
      }
      checkDone();
    });
    getFromGSheets('payslips', function(payslips) {
      localStorage.setItem(STORAGE_KEYS.payslips, JSON.stringify(payslips));
      checkDone();
    });
    getFromGSheets('commissions', function(commissions) {
      localStorage.setItem(STORAGE_KEYS.commissions, JSON.stringify(commissions));
      checkDone();
    });
    getFromGSheets('commissionRates', function(rates) {
      if (rates.length > 0) {
        localStorage.setItem(STORAGE_KEYS.commissionRates, JSON.stringify(rates));
      }
      checkDone();
    });
    getFromGSheets('priceCatalog', function(items) {
      localStorage.setItem(STORAGE_KEYS.priceCatalog, JSON.stringify(items));
      checkDone();
    });
    getFromGSheets('financeEntries', function(entries) {
      localStorage.setItem(STORAGE_KEYS.financeEntries, JSON.stringify(entries));
      checkDone();
    });
    getFromGSheets('receivables', function(list) {
      localStorage.setItem(STORAGE_KEYS.receivables, JSON.stringify(list));
      checkDone();
    });
    getFromGSheets('bsSnapshots', function(list) {
      localStorage.setItem(STORAGE_KEYS.bsSnapshots, JSON.stringify(list));
      checkDone();
    });
    getFromGSheets('orders', function(list) {
      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(list));
      checkDone();
    });
  }

  // Get data from Google Sheets (all via the Apps Script Web App — see note
  // inside about why the old CSV publish path was removed).
  // "YYYY-MM-DD" -> "D/M/YYYY" (no leading zeros, e.g. "2026-09-09" -> "9/9/2026").
  function formatShortDate(dateStr) {
    var parts = String(dateStr || '').split('-');
    if (parts.length !== 3) return dateStr;
    return Number(parts[2]) + '/' + Number(parts[1]) + '/' + parts[0];
  }

  function getFromGSheets(type, callback) {
    var now = Date.now();
    // Cache for 30 seconds — chỉ tin cache khi THẬT SỰ có dữ liệu (mảng rỗng
    // do 1 lần fetch lỗi/timeout KHÔNG được coi là cache hợp lệ, tự thử lại
    // ngay ở lần gọi kế tiếp thay vì khoá cứng cả 30s hoặc lâu hơn).
    if (gsCache[type] && gsCache[type].length > 0 && (now - (gsCacheTime[type] || 0)) < 30000) {
      callback(gsCache[type]);
      return;
    }

    // ALL reads now go through the Apps Script Web App (JSON), which
    // translates the Sheet's Vietnamese headers AND value dropdowns back to
    // the English keys/values the client uses (FIELD_MAP + VALUE_MAP in
    // gsheets-api-v2.js). The old CSV publish-to-web path is intentionally
    // no longer used: raw CSV exposes the Vietnamese column names verbatim
    // (e.g. "Mã NV" instead of "id", "Còn làm việc" instead of "active"),
    // which silently broke every .id/.name/.status/.roleLevel lookup after
    // the Sheet was renamed to Vietnamese.
    var apiReadActions = {
      projects: 'getProjects', tasks: 'getTasks', members: 'getMembers',
      proposals: 'getProposals', timesheet: 'getTimesheet',
      notifications: 'getNotifications', notices: 'getNotices',
      documents: 'getDocuments', payslips: 'getPayslips',
      commissions: 'getCommissions', commissionRates: 'getCommissionRates',
      priceCatalog: 'getPriceCatalog', financeEntries: 'getFinanceEntries',
      lightingStandards: 'getLightingStandards', lightingLamps: 'getLightingLamps',
      lightingFactors: 'getLightingFactors', lightingPlans: 'getLightingPlans',
      receivables: 'getReceivables', bsSnapshots: 'getBsSnapshots', orders: 'getOrders',
      attendanceLocations: 'getAttendanceLocations'
    };
    var action = apiReadActions[type];
    if (!action) { callback([]); return; }
    fetchFromAPI(action, function (data) {
      // Chỉ ghi đè cache khi có dữ liệu thật — 1 lần lỗi/timeout trả về []
      // không được phép xoá mất cache TỐT trước đó (nếu có), y hệt nguyên
      // tắc "không đè dữ liệu thật bằng kết quả rỗng" đã áp dụng ở
      // refreshFromGSheets().
      if (Array.isArray(data) && data.length > 0) {
        gsCache[type] = data;
        gsCacheTime[type] = now;
      }
      callback(Array.isArray(data) && data.length > 0 ? data : (gsCache[type] || []));
    });
  }

  // Get current user
  function getCurrentUser() {
    // First try Auth module (real session)
    if (typeof Auth !== 'undefined') {
      var authUser = Auth.getCurrentUser();
      if (authUser) return authUser;
    }
    // Fallback to first member (development only)
    return DEFAULT_MEMBERS[0];
  }

  // Initialize data from localStorage or Google Sheets — chạy 1 lần lúc trang
  // load. Với Sheets, gọi refreshFromGSheets() (dùng lại được cho làm mới
  // ngầm định kỳ); không dùng Sheets thì seed dữ liệu mẫu localStorage như cũ.
  function initData() {
    // Danh mục tài liệu chỉ sống trong localStorage của từng máy (không qua Sheets).
    if (!localStorage.getItem(STORAGE_KEYS.docCategories)) {
      localStorage.setItem(STORAGE_KEYS.docCategories, JSON.stringify(DEFAULT_DOC_CATEGORIES));
    }
    if (isUsingGSheets()) {
      refreshFromGSheets();
    } else {
      // Use localStorage
      if (!localStorage.getItem(STORAGE_KEYS.projects)) {
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(DEFAULT_PROJECTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.tasks)) {
        localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(DEFAULT_TASKS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.members)) {
        localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(DEFAULT_MEMBERS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.proposals)) {
        localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(DEFAULT_PROPOSALS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.notifications)) {
        localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(DEFAULT_NOTIFICATIONS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.notices)) {
        localStorage.setItem(STORAGE_KEYS.notices, JSON.stringify(DEFAULT_NOTICES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.documents)) {
        localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(DEFAULT_DOCUMENTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.payslips)) {
        localStorage.setItem(STORAGE_KEYS.payslips, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.commissions)) {
        localStorage.setItem(STORAGE_KEYS.commissions, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.commissionRates)) {
        localStorage.setItem(STORAGE_KEYS.commissionRates, JSON.stringify(DEFAULT_COMMISSION_RATES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.priceCatalog)) {
        localStorage.setItem(STORAGE_KEYS.priceCatalog, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.financeEntries)) {
        localStorage.setItem(STORAGE_KEYS.financeEntries, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.receivables)) {
        localStorage.setItem(STORAGE_KEYS.receivables, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.bsSnapshots)) {
        localStorage.setItem(STORAGE_KEYS.bsSnapshots, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.orders)) {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify([]));
      }
    }
  }

  // Generic CRUD operations
  function getAll(key) {
    var data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  function getById(key, id) {
    var items = getAll(key);
    return items.find(function(item) { return item.id === id; });
  }

  function save(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  // <prefix>_<yyMMdd>_<timestamp> — date prefix keeps ids sortable/scannable
  // over years of growth without needing to reset the sheet.
  function makeId(prefix) {
    var d = new Date();
    var yy = String(d.getFullYear()).slice(-2);
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    return prefix + '_' + yy + mm + dd + '_' + Date.now();
  }

  // Chặn TẤT CẢ ghi dữ liệu (thêm/sửa/xoá) khi mất mạng — đây là 3 hàm dùng
  // chung cho gần như mọi loại dữ liệu (task/project/proposal/...), chặn ở
  // đây là chặn được phần lớn thao tác ghi của cả app cùng lúc. Các luồng ghi
  // KHÔNG đi qua 3 hàm này (vài hàm gọi thẳng API — attendanceLocations,
  // addSystemNotificationsBatch, Auth.register, gsWrite trong hicon-bim.html/
  // pricing.html) tự gọi Offline.guard() riêng, xem GHI_CHU_DU_AN.md.
  function add(key, item) {
    if (typeof Offline !== 'undefined' && Offline.guard('thêm dữ liệu')) return null;
    var items = getAll(key);
    var prefix = key.replace('hiconique_', '').replace(/s$/, '');
    item.id = makeId(prefix);
    item.createdAt = new Date().toISOString().split('T')[0];
    items.push(item);
    save(key, items);
    return item;
  }

  function update(key, id, updates) {
    if (typeof Offline !== 'undefined' && Offline.guard('cập nhật dữ liệu')) return null;
    var items = getAll(key);
    var index = items.findIndex(function(item) { return item.id === id; });
    if (index !== -1) {
      items[index] = Object.assign({}, items[index], updates, { updatedAt: new Date().toISOString() });
      save(key, items);
      return items[index];
    }
    return null;
  }

  function remove(key, id) {
    var items = getAll(key);
    if (typeof Offline !== 'undefined' && Offline.guard('xoá dữ liệu')) return items;
    var filtered = items.filter(function(item) { return item.id !== id; });
    save(key, filtered);
    return filtered;
  }

  // "Hoàn thành trong tuần này" — tuần tính từ 0h Thứ Hai tới hết 23:59:59 CN
  // (giờ trình duyệt của người dùng). Dùng để cột "Hoàn thành"/"Done" trên
  // Kanban (projects.js, task-manager-app.js) tự ẩn bớt việc/dự án đã xong
  // TỪ TUẦN TRƯỚC trở về trước — tránh cột dài vô tận theo thời gian. Dữ liệu
  // KHÔNG bị xoá, các view khác (List, quick-filter "Đã hoàn thành"...) vẫn
  // hiển thị đầy đủ để tra cứu/trích xuất lại khi cần.
  function isCompletedThisWeek(completedAt) {
    if (!completedAt) return false;
    var d = new Date(completedAt);
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    var day = now.getDay(); // 0 = Chủ nhật
    var diffToMonday = day === 0 ? -6 : 1 - day;
    var monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    var nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return d >= monday && d < nextMonday;
  }

  // 2026-09-22: quy tắc ẨN HIỂN THỊ hợp nhất cho task/dự án (thay thế
  // isCompletedThisWeek() ở phần Kanban "Hoàn thành" — nay tính theo THÁNG
  // hoàn thành thay vì tuần, theo yêu cầu người dùng). Dùng ở board/list UI
  // (task-manager-app.js, projects.js); các nơi cần thống kê/báo cáo năm/quý
  // PHẢI đọc thẳng getTasks()/getProjects() (không lọc), KHÔNG gọi hàm này.
  //   - visible === false (đã bấm Xoá, hoặc tự ẩn sau khi qua tháng hoàn
  //     thành) -> luôn ẩn.
  //   - status 'completed' và completedAt KHÔNG cùng tháng/năm hiện tại ->
  //     ẩn (sẽ được autoHideExpiredCompleted() ghi hẳn visible=false ở lần
  //     đồng bộ kế tiếp, nhưng lọc ngay ở đây để không phải chờ).
  //   - còn lại -> hiển thị.
  function isVisibleNow(item) {
    if (!item) return false;
    if (item.visible === false || item.visible === 'FALSE' || item.visible === 'false') return false;
    if (item.status === 'completed' && item.completedAt) {
      var d = new Date(item.completedAt);
      if (!isNaN(d.getTime())) {
        var now = new Date();
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      }
    }
    return true;
  }

  // Tự ẩn (visible=false) hàng loạt task/dự án Hoàn thành đã qua tháng hoàn
  // thành — ghi THẬT xuống cột "Hiển thị" trên Sheet (không chỉ lọc phía
  // client) để CEO/quản lý nhìn thẳng trên Sheet cũng thấy đúng trạng thái.
  // Chạy 1 lần/ngày/máy (throttle qua localStorage, tránh quét + ghi lại mỗi
  // lần refreshFromGSheets() chạy ngầm mỗi 20s). Ghi bằng 1 lệnh batch duy
  // nhất mỗi loại (updateTasksBatch/updateProjectsBatch) — không loop gọi API
  // đơn lẻ song song (xem quy tắc addDataBatch()).
  var AUTO_HIDE_THROTTLE_KEY = 'hiconique_last_auto_hide_check';
  function collectExpiredCompletedIds(list) {
    var now = new Date();
    return list.filter(function (item) {
      if (!item || item.visible === false || item.visible === 'FALSE' || item.visible === 'false') return false;
      if (item.status !== 'completed' || !item.completedAt) return false;
      var d = new Date(item.completedAt);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth();
    }).map(function (item) { return item.id; });
  }
  function autoHideExpiredCompleted() {
    if (!isUsingGSheets()) return;
    if (typeof Offline !== 'undefined' && !Offline.isOnline()) return;
    var todayStr = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(AUTO_HIDE_THROTTLE_KEY) === todayStr) return;
    localStorage.setItem(AUTO_HIDE_THROTTLE_KEY, todayStr);

    var expiredTaskIds = collectExpiredCompletedIds(getAll(STORAGE_KEYS.tasks));
    var expiredProjectIds = collectExpiredCompletedIds(getAll(STORAGE_KEYS.projects));

    if (expiredTaskIds.length) {
      var taskUpdates = expiredTaskIds.map(function (id) { return { id: id, visible: false }; });
      taskUpdates.forEach(function (u) { update(STORAGE_KEYS.tasks, u.id, { visible: false }); });
      callGSheetsAPI('updateTasksBatch', taskUpdates);
    }
    if (expiredProjectIds.length) {
      var projectUpdates = expiredProjectIds.map(function (id) { return { id: id, visible: false }; });
      projectUpdates.forEach(function (u) { update(STORAGE_KEYS.projects, u.id, { visible: false }); });
      callGSheetsAPI('updateProjectsBatch', projectUpdates);
    }
  }

  // Projects
  function getProjects() {
    return getAll(STORAGE_KEYS.projects);
  }

  function getProject(id) {
    return getById(STORAGE_KEYS.projects, id);
  }

  // 2026-09-22: mở quyền TẠO dự án cho mọi cấp bậc (kể cả Nhân viên) theo yêu
  // cầu người dùng — chỉ bỏ gate ở đây, sửa/xoá dự án vẫn giữ nguyên chỉ CEO/
  // quản lý (canManageNotifications() bên dưới) vì không được yêu cầu mở rộng.
  function createProject(project, user) {
    user = user || getCurrentUser();
    if (!user) return null;
    project.status = project.status || 'on-track';
    project.progress = project.progress || 0;
    var newProject = add(STORAGE_KEYS.projects, project);
    // Sync to Google Sheets
    syncToGSheets('projects', 'add', newProject);
    return newProject;
  }

  function updateProject(id, updates, user) {
    user = user || getCurrentUser();
    if (!canManageNotifications(user)) return null;
    if (updates && updates.status) {
      var existing = getProject(id);
      var wasCompleted = existing && existing.status === 'completed';
      if (updates.status === 'completed' && !wasCompleted) {
        updates.completedAt = new Date().toISOString();
      } else if (updates.status !== 'completed' && wasCompleted) {
        updates.completedAt = '';
      }
    }
    var updated = update(STORAGE_KEYS.projects, id, updates);
    // Sync to Google Sheets
    if (updated) syncToGSheets('projects', 'update', updates, id);
    return updated;
  }

  // 2026-09-22: "Xoá" dự án giờ chỉ ẨN (cột "Hiển thị" -> FALSE) như task,
  // KHÔNG xoá thật — xem chú thích deleteTask(). Các task thuộc dự án này
  // TRƯỚC ĐÂY bị xoá cứng theo, giờ giữ nguyên (dự án ẩn thì Kanban/board tự
  // lọc theo projectId sẽ không còn ai điều hướng vào được, nhưng dữ liệu
  // task không mất — nhất quán với việc dự án chỉ ẩn chứ không mất).
  function deleteProject(id, user) {
    user = user || getCurrentUser();
    if (!canManageNotifications(user)) return null;
    var updated = updateProject(id, { visible: false }, user);
    if (!updated) return null;
    return getAll(STORAGE_KEYS.projects).filter(function (p) { return p.id !== id; });
  }

  // Tasks
  function getTasks(filters) {
    filters = filters || {};
    var tasks = getAll(STORAGE_KEYS.tasks);

    if (filters.status) {
      tasks = tasks.filter(function(t) { return t.status === filters.status; });
    }
    if (filters.priority) {
      tasks = tasks.filter(function(t) { return t.priority === filters.priority; });
    }
    if (filters.assigneeId) {
      tasks = tasks.filter(function(t) { return Array.isArray(t.assigneeIds) && t.assigneeIds.indexOf(filters.assigneeId) !== -1; });
    }
    if (filters.projectId) {
      tasks = tasks.filter(function(t) { return t.projectId === filters.projectId; });
    }
    if (filters.search) {
      var search = filters.search.toLowerCase();
      tasks = tasks.filter(function(t) {
        return t.title.toLowerCase().includes(search) ||
          (t.description && t.description.toLowerCase().includes(search));
      });
    }

    return tasks.sort(function(a, b) {
      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return 0;
    });
  }

  function getTask(id) {
    return getById(STORAGE_KEYS.tasks, id);
  }

  // 2026-09-21: quy trình 4 cột Chờ xử lý -> Đang làm -> Chờ duyệt -> Hoàn
  // thành (giống "Dự án"). Tự suy trạng thái ban đầu thay vì luôn 'pending':
  // NGƯỜI TẠO cũng nằm trong danh sách được giao (tự tạo việc cho chính mình,
  // hoặc giao cho cả nhóm trong đó có mình) -> vào thẳng "Đang làm" (không ai
  // cần tự xác nhận nhận việc của chính mình); còn lại (quản lý/CEO giao hẳn
  // cho người khác, bản thân không có tên trong đó) -> "Chờ xử lý", chờ đúng
  // người được giao tự xác nhận (xem confirmTaskAssignment()).
  function taskAssigneeIdsOf(task) {
    if (!task) return [];
    if (Array.isArray(task.assigneeIds)) return task.assigneeIds;
    if (typeof task.assigneeIds === 'string' && task.assigneeIds) {
      try { var arr = JSON.parse(task.assigneeIds); if (Array.isArray(arr)) return arr; } catch (e) {}
      return [task.assigneeIds];
    }
    return [];
  }
  function createTask(task) {
    if (!task.status) {
      var assigneeIds = taskAssigneeIdsOf(task);
      var selfAssigned = !assigneeIds.length || (task.createdBy && assigneeIds.indexOf(task.createdBy) !== -1);
      task.status = selfAssigned ? 'in-progress' : 'pending';
    }
    var newTask = add(STORAGE_KEYS.tasks, task);
    syncToGSheets('tasks', 'add', newTask);
    syncProjectProgress_(newTask.projectId);
    // Giao việc hẳn cho người khác (không tự tạo cho mình) -> báo ngay cho
    // TỪNG người được giao, trừ chính người tạo (nếu lỡ có tên trong đó thì
    // task đã tự vào 'in-progress' ở trên rồi, không cần báo "chờ xử lý" nữa).
    if (newTask.status === 'pending') {
      var creator = task.createdBy ? getMember(task.createdBy) : null;
      var recipientIds = taskAssigneeIdsOf(newTask).filter(function (aid) { return aid !== task.createdBy; });
      if (recipientIds.length) {
        addSystemNotificationsBatch(recipientIds.map(function (aid) {
          return {
            title: 'Bạn được giao việc mới',
            message: (creator ? creator.name : 'Quản lý') + ' vừa giao việc "' + (newTask.title || '') + '" cho bạn — vào xem và bấm "Xác nhận nhận việc".',
            type: 'task', scope: aid, recurring: false
          };
        }));
      }
    }
    return newTask;
  }

  // Người được giao TỰ xác nhận đã nhận việc (chỉ hợp lệ khi đang 'pending').
  function confirmTaskAssignment(taskId, user) {
    var task = getTask(taskId);
    if (!task || task.status !== 'pending') return null;
    if (!user || taskAssigneeIdsOf(task).indexOf(user.id) === -1) return null;
    return updateTask(taskId, { status: 'in-progress' });
  }

  // Người được giao nộp việc để chờ duyệt — bắt buộc tiến độ đã đạt 100%
  // (nút "Hoàn thành" chỉ hiện khi đủ điều kiện này, xem task-manager-app.js).
  function submitTaskForReview(taskId, user) {
    var task = getTask(taskId);
    if (!task || task.status !== 'in-progress') return null;
    if (!user || taskAssigneeIdsOf(task).indexOf(user.id) === -1) return null;
    // 2026-09-22: hạ ngưỡng nộp duyệt từ 100% xuống 95% theo yêu cầu người
    // dùng — nút "Hoàn thành — nộp duyệt" ở UI cũng sáng lên đúng mốc này
    // (xem openTaskDetail() trong projects.js / openTaskDetailModal() trong
    // task-manager-app.js), phải khớp ngưỡng ở cả 2 nơi.
    if ((Number(task.progress) || 0) < 95) return null;
    var updated = updateTask(taskId, { status: 'review' });
    addSystemNotificationsBatch(adminAndManagerMembers(user.id).map(function (mgr) {
      return {
        title: 'Công việc chờ duyệt',
        message: (user.name || user.id) + ' đã hoàn thành "' + (task.title || '') + '" — đang chờ duyệt.',
        type: 'task', scope: mgr.id, recurring: false
      };
    }));
    return updated;
  }

  // CHỈ CEO/Quản lý (canReviewTasks) duyệt/từ chối 1 việc đang 'review'.
  // Duyệt -> 'completed' (tự stamp completedAt trong updateTask()). Từ chối
  // -> quay lại 'in-progress', GIỮ NGUYÊN deadline (không đụng tới field đó),
  // ghi lý do vào reviewNote để người được giao biết cần sửa gì.
  function canReviewTasks(user) {
    return !!user && (user.roleLevel === 'admin' || user.roleLevel === 'manager');
  }
  function approveTaskReview(taskId, user) {
    if (!canReviewTasks(user)) return null;
    var task = getTask(taskId);
    if (!task || task.status !== 'review') return null;
    var updated = updateTask(taskId, { status: 'completed', reviewNote: '' });
    addSystemNotificationsBatch(taskAssigneeIdsOf(task).map(function (aid) {
      return {
        title: 'Công việc đã được duyệt',
        message: '"' + (task.title || '') + '" đã được ' + (user.name || 'quản lý') + ' duyệt hoàn thành.',
        type: 'task', scope: aid, recurring: false
      };
    }));
    return updated;
  }
  function rejectTaskReview(taskId, note, user) {
    if (!canReviewTasks(user)) return null;
    var task = getTask(taskId);
    if (!task || task.status !== 'review') return null;
    var updated = updateTask(taskId, { status: 'in-progress', reviewNote: note || '' });
    addSystemNotificationsBatch(taskAssigneeIdsOf(task).map(function (aid) {
      return {
        title: 'Công việc bị từ chối',
        message: '"' + (task.title || '') + '" bị ' + (user.name || 'quản lý') + ' từ chối' + (note ? ' — lý do: ' + note : '') + '. Vui lòng sửa lại.',
        type: 'task', scope: aid, recurring: false
      };
    }));
    return updated;
  }

  // completedAt tự set khi status chuyển SANG 'completed', tự xoá khi chuyển
  // KHỎI 'completed' (mở lại) — dùng để tự ẩn khỏi cột "Hoàn thành" sau khi
  // hết tuần hoàn thành (xem isCompletedThisWeek() + nơi dùng ở projects.js/
  // task-manager-app.js), KHÔNG xoá dữ liệu, chỉ ẩn hiển thị mặc định.
  function updateTask(id, updates) {
    if (updates && updates.status) {
      var existing = getTask(id);
      var wasCompleted = existing && existing.status === 'completed';
      if (updates.status === 'completed' && !wasCompleted) {
        updates.completedAt = new Date().toISOString();
      } else if (updates.status !== 'completed' && wasCompleted) {
        updates.completedAt = '';
      }
    }
    var before = getTask(id);
    var updated = update(STORAGE_KEYS.tasks, id, updates);
    // Sync to Google Sheets
    if (updated) {
      syncToGSheets('tasks', 'update', updates, id);
      // Tiến độ / ẩn-hiện / đổi dự án của task đổi -> "Tiến độ" của dự án liên
      // quan (cột riêng trên Sheet Dự án) phải theo kịp, nếu không Sheet cứ 0%
      // dù task đã làm được 80% (đo thực tế 2026-09-26: 3/3 dự án lệch).
      var touchesProgress = updates && (updates.progress !== undefined || updates.visible !== undefined || updates.projectId !== undefined);
      if (touchesProgress) {
        syncProjectProgress_(updated.projectId);
        if (before && before.projectId && before.projectId !== updated.projectId) syncProjectProgress_(before.projectId);
      }
    }
    return updated;
  }

  // Tiến độ dự án = trung bình tiến độ các task ĐANG HIỆN của dự án đó. Là dữ
  // liệu SUY RA từ task (không ai nhập tay) nên ghi thẳng, không đòi quyền
  // quản lý như updateProject() — người thường cập nhật tiến độ task của mình
  // vẫn phải làm dự án cập nhật theo. Dự án chưa có task nào giữ nguyên giá
  // trị nhập tay cũ. Chỉ ghi khi giá trị thật sự đổi.
  function syncProjectProgress_(projectId) {
    if (!projectId) return null;
    var project = getProject(projectId);
    if (!project) return null;
    var pt = getAll(STORAGE_KEYS.tasks).filter(function (t) { return t.projectId === projectId && t.visible !== false; });
    if (!pt.length) return null;
    var avg = Math.round(pt.reduce(function (sum, t) { return sum + (Number(t.progress) || 0); }, 0) / pt.length);
    if (Number(project.progress) === avg) return null;
    var updated = update(STORAGE_KEYS.projects, projectId, { progress: avg });
    if (updated) syncToGSheets('projects', 'update', { progress: avg }, projectId);
    return updated;
  }

  // Gọi 1 lần (có chủ đích, do người dùng bấm/gọi tay) để đồng bộ lại tiến độ
  // MỌI dự án theo task hiện có — dùng để vá dữ liệu cũ đã lệch.
  function syncAllProjectProgress() {
    return getAll(STORAGE_KEYS.projects).map(function (p) { return syncProjectProgress_(p.id) ? p.id : null; }).filter(Boolean);
  }

  // 2026-09-22: "Xoá" giờ chỉ ẨN (cột "Hiển thị" -> FALSE), KHÔNG xoá dòng
  // thật khỏi Sheet nữa, theo yêu cầu người dùng — lỡ ẩn nhầm còn cứu được
  // bằng cách vào thẳng Sheet sửa lại cột "Hiển thị". Trả về mảng còn lại
  // giống hệt remove() cũ (đã lọc bỏ item vừa ẩn) để không phá vỡ các chỗ
  // đang gọi deleteTask() và mong đợi UI tự cập nhật danh sách ngay.
  function deleteTask(id) {
    var updated = updateTask(id, { visible: false });
    if (!updated) return getAll(STORAGE_KEYS.tasks);
    return getAll(STORAGE_KEYS.tasks).filter(function (t) { return t.id !== id; });
  }

  function toggleTaskStatus(id) {
    var task = getTask(id);
    if (task) {
      var newStatus = task.status === 'completed' ? 'pending' : 'completed';
      var updated = updateTask(id, { status: newStatus });
      // Sync toggle to Google Sheets
      syncToGSheets('tasks', 'toggle', {}, id);
      return updated;
    }
    return null;
  }

  // 2026-09-24 (2): CHỐT ĐÚNG tư duy tính "Tổng" theo đúng yêu cầu — mỗi
  // dòng "tiến độ hôm nay" là % CÔNG VIỆC LÀM THÊM ĐƯỢC TRONG NGÀY ĐÓ (số
  // gia tăng riêng của ngày, không phải mốc tuyệt đối đã đạt tới đâu), và
  // "Tổng" = TỔNG CỘNG các ngày (không phải trung bình cộng, cũng không
  // phải lấy mốc cao nhất 1 ngày) — VD ngày 1 làm 20%, ngày 2 làm thêm 30%
  // => Tổng = 50%. Nếu 1 ngày báo hẳn 100% (coi như xong trong ngày đó) thì
  // Tổng = 100% (cộng dồn rồi chặn trần ở 100, không vượt quá). Sửa lần 1
  // (2026-09-24, lấy max của các ngày) SAI vì hiểu nhầm — ghi đè bằng bản
  // sửa lần 2 (cộng dồn, chặn trần) này, khớp đúng ví dụ người dùng đưa ra.
  function sumDailyProgress_(dailyTasks) {
    var total = dailyTasks.reduce(function (sum, d) { return sum + (Number(d.progress) || 0); }, 0);
    return Math.min(100, total);
  }

  // Add daily progress to task — `progress` truyền vào là % LÀM THÊM ĐƯỢC
  // HÔM NAY (không phải mốc tuyệt đối), ghi ĐÈ đúng dòng của hôm nay (sửa
  // lại trong ngày thì thay số cũ, không cộng dồn thêm 1 lần nữa) rồi tính
  // lại "Tổng" = tổng cộng mọi ngày (xem sumDailyProgress_()).
  function addDailyProgress(taskId, progress, note) {
    var task = getTask(taskId);
    if (!task) return null;

    var today = todayStr();
    var dailyTasks = task.dailyTasks || [];
    var todayProgress = parseInt(progress) || 0;

    var todayEntry = dailyTasks.find(function(d) { return d.date === today; });
    if (todayEntry) {
      todayEntry.progress = todayProgress;
      todayEntry.note = note || '';
    } else {
      todayEntry = { date: today, progress: todayProgress, note: note || '', done: false };
      dailyTasks.push(todayEntry);
    }

    var totalProgress = sumDailyProgress_(dailyTasks);
    todayEntry.done = totalProgress >= 100;

    updateTask(taskId, { dailyTasks: dailyTasks, progress: totalProgress });

    return task;
  }

  // Get today's progress for a task — `progress` ở đây LUÔN là % làm thêm
  // RIÊNG của hôm nay (đã lưu hoặc mặc định 0 nếu chưa lưu gì), không phải
  // "Tổng" của cả task — xem getRemainingBudgetToday()/addDailyProgress().
  function getTodayProgress(taskId) {
    var task = getTask(taskId);
    if (!task) return null;

    var today = todayStr();
    var dailyTasks = task.dailyTasks || [];
    return dailyTasks.find(function(d) { return d.date === today; }) || { progress: 0, note: '', done: false };
  }

  // Trần cho phép nhập hôm nay = 100% - tổng % các ngày KHÁC (không tính
  // hôm nay, vì sửa lại hôm nay là THAY THẾ chứ không cộng thêm) — chặn
  // không cho tổng vượt quá 100% dù người dùng kéo slider hết cỡ.
  function getTodayProgressCap(taskId) {
    var task = getTask(taskId);
    if (!task) return 100;
    var today = todayStr();
    var otherDaysTotal = (task.dailyTasks || [])
      .filter(function (d) { return d.date !== today; })
      .reduce(function (sum, d) { return sum + (Number(d.progress) || 0); }, 0);
    return Math.max(0, 100 - otherDaysTotal);
  }

  // 2026-09-24: nút "Xác nhận & đồng bộ lại" trên thông báo dạng `resync`
  // (Founder gửi riêng cho 1-2 người bị mất dữ liệu do bug ghi Sheet trước
  // đây) — thay vì bắt người dùng tự mở lại TỪNG task rồi bấm "Lưu tiến độ
  // hôm nay" 1 lần, hàm này tự tìm mọi task họ được giao và ghi lại đúng
  // `dailyTasks`/`progress` hiện có trên máy họ lên Sheet trong 1 lần bấm.
  // Dữ liệu local không đổi gì — chỉ đẩy lại đúng nguyên trạng để
  // callGSheetsAPI() (đã có timeout+retry, xem 2026-09-24 (b)) có cơ hội ghi
  // thành công lần nữa.
  function forceResyncMyTasks(userId) {
    var myTasks = getAll(STORAGE_KEYS.tasks).filter(function (t) {
      return taskAssigneeIdsOf(t).indexOf(userId) !== -1;
    });
    myTasks.forEach(function (t) {
      var dailyTasks = t.dailyTasks || [];
      var totalProgress = sumDailyProgress_(dailyTasks);
      updateTask(t.id, { dailyTasks: dailyTasks, progress: totalProgress });
    });
    return myTasks.length;
  }

  // Generate daily tasks from deadline
  function generateDailyTasks(taskId) {
    var task = getTask(taskId);
    if (!task || !task.deadline) return;

    var startDate = new Date(task.createdAt || new Date().toISOString().split('T')[0]);
    var endDate = new Date(task.deadline);
    var dailyTasks = [];

    for (var d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      var dateStr = d.toISOString().split('T')[0];
      dailyTasks.push({ date: dateStr, progress: 0, note: '', done: false });
    }

    updateTask(taskId, { dailyTasks: dailyTasks });
    return dailyTasks;
  }

  // Members
  // 2026-09-23: sắp xếp MỌI danh sách thành viên theo đúng thứ tự cấp bậc đã
  // thống nhất (Founder → CEO → Giám đốc Bộ phận → Quản lý → Nhân viên, xem
  // LEVELS ở trên) thay vì để nguyên thứ tự thô của Sheet — từ khi đổi sang
  // chèn bản ghi mới ở ĐẦU Sheet (xem GHI_CHU_DU_AN.md), thứ tự thô gần như
  // ngẫu nhiên (mới thêm/sửa gần đây nổi lên đầu), không còn phản ánh đúng sơ
  // đồ tổ chức nữa — người dùng phản ánh "đầu mục chưa đúng thứ tự đã thống
  // nhất" ở trang Chấm công/Team. Sắp ngay tại nguồn (getMembers()/
  // getActiveMembers()) để MỌI nơi dùng 2 hàm này (Team, báo cáo chấm công,
  // dropdown giao việc, sidebar lọc thành viên...) tự động đúng thứ tự, không
  // phải sửa từng trang. Cùng cấp bậc thì xếp theo tên (bảng chữ cái tiếng
  // Việt); thành viên thiếu `level` (dữ liệu cũ) rơi xuống cuối.
  function sortMembersByLevel_(members) {
    return members.slice().sort(function (a, b) {
      var la = a.level && getLevelByCode(a.level);
      var lb = b.level && getLevelByCode(b.level);
      var oa = la ? la.order : 99;
      var ob = lb ? lb.order : 99;
      if (oa !== ob) return oa - ob;
      return (a.name || '').localeCompare(b.name || '', 'vi');
    });
  }

  function getMembers() {
    return sortMembersByLevel_(getAll(STORAGE_KEYS.members));
  }

  // 2026-09-17: danh sách thành viên CÒN LÀM VIỆC — dùng cho MỌI nơi chọn
  // người (giao việc, thêm vào dự án...), KHÔNG dùng getMembers() thô ở
  // những chỗ đó nữa. getMembers() vẫn giữ nguyên trả về TẤT CẢ (kể cả đang
  // chờ duyệt/bị từ chối/tạm nghỉ/ngưng công tác) vì trang Team cần hiển thị
  // đủ để CEO/Manager duyệt — CHỈ nơi chọn người để giao việc/thêm dự án mới
  // cần lọc, người dùng phát hiện tài khoản "bot" chưa duyệt vẫn chọn được
  // để giao việc là sai (họ còn chưa đăng nhập được).
  function getActiveMembers() {
    return sortMembersByLevel_(getAll(STORAGE_KEYS.members).filter(function (m) { return !m.status || m.status === 'active'; }));
  }

  function getMember(id) {
    return getById(STORAGE_KEYS.members, id);
  }

  // Trả về danh sách member object cho 1 task có nhiều người phụ trách
  // (task.assigneeIds là mảng id — tolerate task cũ/hỏng chưa có mảng).
  function getTaskAssignees(task) {
    var ids = (task && Array.isArray(task.assigneeIds)) ? task.assigneeIds : [];
    return ids.map(getMember).filter(Boolean);
  }

  // Self-service profile edit (trang Thông tin cá nhân) — chỉ cho phép sửa
  // các trường không nhạy cảm về quyền hạn (không cho đổi role/roleLevel/email
  // qua đường này). Chủ tài khoản luôn sửa được hồ sơ của chính mình; CEO/Manager
  // sửa được hồ sơ người khác.
  // - lastActiveAt: portal.js tự "ping" mỗi ~60s trong lúc tab đang mở & hiển
  //   thị, để trang chủ tính đúng số người ĐANG THỰC SỰ mở web thay vì đoán
  //   theo giờ hành chính như trước (2026-09-10 — trước đó hiện cứng tổng số
  //   thành viên trong giờ làm, sai hoàn toàn với thực tế).
  // - theme: nhớ giao diện sáng/tối THEO TÀI KHOẢN (không chỉ theo trình
  //   duyệt/máy) — đăng nhập lại ở máy khác vẫn ra đúng theme đã chọn lần
  //   cuối, xem initTheme()/setTheme() trong portal.js.
  var MEMBER_SELF_EDIT_FIELDS = ['dob', 'gender', 'cccd', 'phone', 'hometown', 'bank', 'bankAccount', 'password', 'device1', 'device2', 'lastActiveAt', 'theme', 'department', 'departmentCode', 'division', 'divisionCode', 'color', 'avatar'];
  function updateMember(id, updates, user) {
    if (!user) return null;
    var isSelf = user.id === id;
    if (!isSelf && !canManageNotifications(user)) return null;
    var safeUpdates = {};
    MEMBER_SELF_EDIT_FIELDS.forEach(function (k) {
      if (updates[k] !== undefined) safeUpdates[k] = updates[k];
    });
    var updated = update(STORAGE_KEYS.members, id, safeUpdates);
    if (updated) syncToGSheets('members', 'update', safeUpdates, id);
    return updated;
  }

  // Chống chấm công hộ (kiểu 2) — mỗi thành viên tự "đăng ký" tối đa 2 thiết
  // bị (deviceId sinh ngẫu nhiên, lưu ở localStorage của trình duyệt, xem
  // getOrCreateDeviceId() trong timesheet.html — web không có cách nào đọc
  // ID phần cứng thật). Mỗi thiết bị lưu "id::tên::trạng" trong 1 CỘT RIÊNG
  // `device1`/`device2` của Members (2026-09-16: trước đó gộp cả 2 vào 1 cột
  // `deviceIds` dạng "id1::tên1,id2::tên2" — tách ra cho dễ nhìn/lọc trên
  // Sheet, xem splitDeviceColumns() trong gsheets-api-v2.js, đã chạy 1 lần).
  // Tên thiết bị (VD "iPhone · Safari") tự rút ra từ User-Agent phía
  // timesheet.html, giống kiểu "lịch sử đăng nhập thiết bị" của Facebook/Zalo
  // — entry cũ (chưa có "::tên") vẫn parse được bình thường, chỉ thiếu name.
  var MAX_MEMBER_DEVICES = 2;
  var DEVICE_SLOT_FIELDS = ['device1', 'device2'];
  // 2026-09-19: cột "Trạng thái Thiết bị 1/2" mirror trên Sheet (dropdown
  // Chờ duyệt/Đã duyệt, xem addDeviceStatusColumns() trong gsheets-api-v2.js)
  // — cho CEO/Founder tự sửa tay trực tiếp trên Sheet, không cần mở đúng
  // chuỗi ghép "id::tên::trạng" để sửa. Đọc ĐÈ LÊN trạng thái trong chuỗi
  // ghép nếu có giá trị (parseDeviceIds), và LUÔN ghi lại đồng bộ khi web tự
  // đổi trạng thái qua nút Duyệt/Từ chối (stringifyDeviceEntries) để 2 nơi
  // không bao giờ lệch nhau dù sửa từ web hay sửa tay trên Sheet.
  var DEVICE_STATUS_FIELDS = ['device1Status', 'device2Status'];
  // 2026-09-15: thêm "status" (pending/approved/rejected) — thiết bị đăng ký
  // MỚI phải chờ CEO/Manager duyệt mới tính là "quen dùng" trong 3 điều kiện
  // chấm công (xem checkDeviceStatus() ở timesheet.html). Entry cũ trước khi
  // có tính năng này (chỉ 1-2 phần, không có status) mặc định coi là
  // 'approved' — không đột ngột khoá thiết bị đang hoạt động bình thường của
  // người dùng hiện tại.
  // parts[3] (2026-09-21): "vân tay trình duyệt" — mã suy đoán thô từ đặc
  // điểm máy (màn hình, múi giờ, hệ điều hành...), tính ở computeDeviceFingerprint()
  // trong timesheet.html. KHÔNG phải ID thật (web không đọc được phần cứng
  // thật), chỉ dùng để NHẬN LẠI 1 máy đã quen khi mất/đổi deviceId ngẫu nhiên
  // (VD xoá dữ liệu trình duyệt) — xem logic ghép ở registerMemberDevice().
  function parseDeviceIds(member) {
    var out = [];
    DEVICE_SLOT_FIELDS.forEach(function (field, i) {
      var raw = String((member && member[field]) || '').trim();
      if (!raw) return;
      var parts = raw.split('::');
      var status = parts[2] || 'approved';
      var mirrorStatus = String((member && member[DEVICE_STATUS_FIELDS[i]]) || '').trim();
      if (mirrorStatus) status = mirrorStatus; // sửa tay trên Sheet có hiệu lực ngay
      out.push({ id: parts[0], name: parts[1] || '', status: status, fingerprint: parts[3] || '' });
    });
    return out;
  }

  // entries[0] -> device1, entries[1] -> device2 (thứ tự theo lúc đăng ký,
  // không quan trọng thiết bị nào ở slot nào). Trả về OBJECT 2 field để
  // spread thẳng vào updateMember() — slot trống ghi '' để xoá dữ liệu cũ
  // trên Sheet khi gỡ thiết bị (không để sót giá trị thừa).
  function stringifyDeviceEntries(entries) {
    var out = {};
    DEVICE_SLOT_FIELDS.forEach(function (field, i) {
      var e = entries[i];
      out[field] = e ? [e.id, e.name || '', e.status || 'approved', e.fingerprint || ''].join('::') : '';
      out[DEVICE_STATUS_FIELDS[i]] = e ? (e.status || 'approved') : '';
    });
    return out;
  }

  // Ghi thông báo hệ thống (không do người dùng tự soạn) — VD sự kiện đăng
  // ký/gỡ/duyệt thiết bị chấm công, thường cần báo tới NHIỀU người 1 lúc
  // (mọi CEO/Manager). KHÔNG qua canManageNotifications() như
  // createNotification(): nhân viên thường (không phải admin/manager) vẫn
  // cần kích hoạt được loại thông báo này khi TỰ đăng ký/gỡ thiết bị của
  // chính họ — đây là sự kiện hệ thống ghi hộ, không phải nội dung tự soạn.
  // LUÔN gửi theo BATCH (1 lệnh API duy nhất, kể cả chỉ 1 người nhận) —
  // KHÔNG gọi API nhiều lần song song trong 1 vòng lặp: mỗi lần gọi là 1 lần
  // thực thi Apps Script riêng, đọc/ghi cùng sheet cùng lúc dễ đua nhau đọc
  // sai "dòng cuối" rồi ghi đè lên nhau, rớt mất thông báo — đã xảy ra thật
  // khi test tính năng duyệt thiết bị (gửi 4 thông báo cùng lúc, chỉ còn 3,
  // 2 trong số đó trùng luôn cả ID). Vì action ghi thẳng xuống Sheet (không
  // qua add() nội bộ trước), local cache của TRÌNH DUYỆT NGƯỜI GỬI sẽ không
  // thấy các thông báo này cho tới lần refreshFromGSheets() kế tiếp — chấp
  // nhận được vì thông báo này luôn dành cho NGƯỜI KHÁC, không phải người gửi.
  function addSystemNotificationsBatch(dataList) {
    if (!dataList || !dataList.length || !isUsingGSheets() || !GSHEETS_CONFIG.API_URL) return;
    if (typeof Offline !== 'undefined' && !Offline.isOnline()) return;
    dataList.forEach(function (d) { d.active = d.active !== false; d.createdBy = 'SYSTEM'; });
    try {
      var params = '?action=addNotificationsBatch&data=' + encodeURIComponent(JSON.stringify(dataList));
      fetch(GSHEETS_CONFIG.API_URL + params, { method: 'GET', redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .then(function (result) { if (result && result.error) console.error('addNotificationsBatch error:', result.error); })
        .catch(function (e) { console.error('addNotificationsBatch failed:', e); });
    } catch (e) {
      console.error('addNotificationsBatch error:', e);
    }
  }

  function getMemberDeviceIds(memberId) {
    return parseDeviceIds(getMember(memberId)).map(function (e) { return e.id; });
  }

  function getMemberDevices(memberId) {
    return parseDeviceIds(getMember(memberId));
  }

  function adminAndManagerMembers(excludeId) {
    return getMembers().filter(function (m) {
      return (m.roleLevel === 'admin' || m.roleLevel === 'manager') && m.id !== excludeId;
    });
  }

  // Trả về { ok, isNew, full, status, recovered }. full=true nghĩa là deviceId
  // lạ nhưng đã đủ MAX_MEMBER_DEVICES thiết bị — caller (UI) tự quyết định
  // cảnh báo/hỏi lại, hàm này không tự chặn. Thiết bị MỚI của nhân viên
  // thường luôn ở trạng thái 'pending' — phải chờ CEO/Manager duyệt (xem
  // approveMemberDevice) mới tính là "quen dùng" khi chấm công; CEO/Manager
  // tự đăng ký thì duyệt luôn cho chính mình (không lẽ tự đăng ký xong lại
  // phải tự chờ chính mình).
  //
  // 2026-09-21: thêm `fingerprint` (vân tay trình duyệt, xem
  // computeDeviceFingerprint() ở timesheet.html) — deviceId ngẫu nhiên bị mất
  // (xoá dữ liệu trình duyệt) khiến người dùng cứ phải đăng ký lại rồi chờ
  // duyệt lại từ đầu dù vẫn cùng 1 máy quen. Nếu deviceId LẠ nhưng fingerprint
  // TRÙNG với 1 entry đã có sẵn CỦA CHÍNH người này, coi đây là "cùng máy cũ,
  // chỉ đổi mã lưu trữ" — THAY THẾ id cũ bằng id mới, GIỮ NGUYÊN trạng thái
  // (đã duyệt thì vẫn đã duyệt luôn, không bắt chờ duyệt lại, không tốn thêm
  // slot). Chỉ so trong phạm vi CHÍNH người đó (không so chéo qua người khác)
  // — fingerprint chỉ là gợi ý thô (2 máy cùng đời/cùng cấu hình có thể
  // trùng), không dùng để tự động tin cậy xuyên người dùng; vẫn báo cho
  // CEO/Quản lý biết để họ tự kiểm tra lại nếu nghi ngờ.
  function registerMemberDevice(memberId, deviceId, user, deviceName, fingerprint) {
    var member = getMember(memberId);
    if (!member || !deviceId) return { ok: false, isNew: false, full: false };
    var entries = parseDeviceIds(member);
    var existing = entries.filter(function (e) { return e.id === deviceId; })[0];
    if (existing) {
      // Tự vá lại tên/fingerprint cho entry cũ (VD đăng ký trước khi có tính
      // năng tên thiết bị, hoặc fingerprint đổi nhẹ do cập nhật hệ điều hành).
      var patched = false;
      if (deviceName && existing.name !== deviceName) { existing.name = deviceName; patched = true; }
      if (fingerprint && existing.fingerprint !== fingerprint) { existing.fingerprint = fingerprint; patched = true; }
      if (patched) updateMember(memberId, stringifyDeviceEntries(entries), user);
      return { ok: true, isNew: false, full: false, status: existing.status };
    }
    var fingerprintMatch = fingerprint ? entries.filter(function (e) { return e.fingerprint && e.fingerprint === fingerprint; })[0] : null;
    if (fingerprintMatch) {
      var oldId = fingerprintMatch.id;
      fingerprintMatch.id = deviceId;
      if (deviceName) fingerprintMatch.name = deviceName;
      var updatedRecovered = updateMember(memberId, stringifyDeviceEntries(entries), user);
      if (!updatedRecovered) return { ok: false, isNew: false, full: false, blocked: true };
      addSystemNotificationsBatch(adminAndManagerMembers(user && user.id).map(function (mgr) {
        return {
          title: 'Thiết bị chấm công tự nhận diện lại',
          message: (member.name || memberId) + ' mở lại trang từ 1 mã thiết bị mới nhưng đặc điểm máy trùng với thiết bị cũ đã duyệt — hệ thống tự thay mã, không cần duyệt lại. Kiểm tra ở "Quản lý tất cả thiết bị" nếu nghi ngờ.',
          type: 'attendance', scope: mgr.id, recurring: false
        };
      }));
      return { ok: true, isNew: true, full: false, status: fingerprintMatch.status, recovered: true, oldId: oldId };
    }
    if (entries.length >= MAX_MEMBER_DEVICES) return { ok: false, isNew: false, full: true };
    var isSelfAdmin = canManageMembers(user) && user.id === memberId;
    var status = isSelfAdmin ? 'approved' : 'pending';
    entries.push({ id: deviceId, name: deviceName || '', status: status, fingerprint: fingerprint || '' });
    // Bug 2026-09-19: trước đây hàm này LUÔN trả `ok: true` bất kể
    // updateMember() có thật sự ghi được hay không — nếu bị Offline.guard()
    // chặn (báo mất mạng sai trên mạng di động chập chờn, đã biết ở
    // GHI_CHU_DU_AN.md) thì updateMember() trả `null`, KHÔNG có gì được ghi,
    // nhưng UI vẫn hiện "Đã đăng ký thiết bị thành công" — người dùng tưởng
    // xong, tải lại trang thấy mất, nghĩ là "đăng ký mãi không được". Giờ
    // check đúng kết quả ghi trước khi báo thành công.
    var updated = updateMember(memberId, stringifyDeviceEntries(entries), user);
    if (!updated) return { ok: false, isNew: false, full: false, blocked: true };
    if (!isSelfAdmin) {
      var msg = (member.name || memberId) + ' vừa đăng ký thiết bị chấm công mới (' + (deviceName || 'không rõ tên') + ') — đang chờ duyệt.';
      addSystemNotificationsBatch(adminAndManagerMembers(user && user.id).map(function (mgr) {
        return { title: 'Chờ duyệt thiết bị chấm công', message: msg, type: 'attendance', scope: mgr.id, recurring: false };
      }));
    }
    return { ok: true, isNew: true, full: false, status: status };
  }

  function removeMemberDevice(memberId, deviceId, user) {
    // Tự gỡ thiết bị của chính mình (self-service, timesheet.html) HOẶC
    // CEO/Founder gỡ hộ người khác (bảng quản lý thiết bị) — không cho
    // nhân viên thường gỡ thiết bị của người khác.
    if (!user || (user.id !== memberId && !canManageMembers(user))) return null;
    var member = getMember(memberId);
    if (!member) return null;
    var entries = parseDeviceIds(member);
    var removed = entries.filter(function (e) { return e.id === deviceId; })[0];
    entries = entries.filter(function (e) { return e.id !== deviceId; });
    var updated = updateMember(memberId, stringifyDeviceEntries(entries), user);
    if (updated && removed) {
      var msg = (member.name || memberId) + ' đã gỡ thiết bị chấm công (' + (removed.name || 'không rõ tên') + ').';
      addSystemNotificationsBatch(adminAndManagerMembers(user && user.id).map(function (mgr) {
        return { title: 'Gỡ thiết bị chấm công', message: msg, type: 'attendance', scope: mgr.id, recurring: false };
      }));
    }
    return updated;
  }

  // Danh sách thiết bị đang chờ duyệt của TOÀN CÔNG TY — CEO/Manager dùng để
  // hiển thị panel duyệt trong trang Chấm công (timesheet.html).
  function getPendingDeviceRegistrations() {
    var out = [];
    getMembers().forEach(function (m) {
      parseDeviceIds(m).forEach(function (e) {
        if (e.status === 'pending') out.push({ memberId: m.id, memberName: m.name || m.id, deviceId: e.id, deviceName: e.name });
      });
    });
    return out;
  }

  // CHỈ CEO/Manager (canManageMembers). approve: đánh dấu 'approved', gỡ
  // trạng thái chờ. reject: XOÁ hẳn entry (nhả slot lại cho nhân viên đăng ký
  // thiết bị khác) — không giữ lại trạng thái 'rejected' vì sẽ chiếm mất 1
  // trong tối đa 2 slot của người đó không cần thiết.
  function approveMemberDevice(memberId, deviceId, user) {
    if (!canManageMembers(user)) return null;
    var member = getMember(memberId);
    if (!member) return null;
    var entries = parseDeviceIds(member);
    var entry = entries.filter(function (e) { return e.id === deviceId; })[0];
    if (!entry) return null;
    entry.status = 'approved';
    var updated = updateMember(memberId, stringifyDeviceEntries(entries), user);
    addSystemNotificationsBatch([{
      title: 'Thiết bị chấm công đã được duyệt',
      message: 'Thiết bị "' + (entry.name || deviceId) + '" của bạn đã được ' + (user.name || 'quản lý') + ' duyệt — có thể dùng để chấm công.',
      type: 'attendance', scope: memberId, recurring: false
    }]);
    return updated;
  }

  function rejectMemberDevice(memberId, deviceId, user) {
    if (!canManageMembers(user)) return null;
    var member = getMember(memberId);
    if (!member) return null;
    var entries = parseDeviceIds(member);
    var entry = entries.filter(function (e) { return e.id === deviceId; })[0];
    if (!entry) return null;
    entries = entries.filter(function (e) { return e.id !== deviceId; });
    var updated = updateMember(memberId, stringifyDeviceEntries(entries), user);
    addSystemNotificationsBatch([{
      title: 'Thiết bị chấm công bị từ chối',
      message: 'Thiết bị "' + (entry.name || deviceId) + '" của bạn bị ' + (user.name || 'quản lý') + ' từ chối — vui lòng đăng ký lại hoặc liên hệ để biết thêm.',
      type: 'attendance', scope: memberId, recurring: false
    }]);
    return updated;
  }

  // Danh sách MỌI thiết bị của MỌI thành viên (không chỉ đang chờ duyệt) —
  // dùng cho bảng quản lý thiết bị đầy đủ (sửa/gỡ/reset/thêm hộ) mà CEO/
  // Founder mở từ nút cạnh panel "Thiết bị chấm công chờ duyệt".
  //
  // 2026-09-21: thêm cờ `fingerprintDup` — TRÙNG vân tay trình duyệt với 1
  // thiết bị của NGƯỜI KHÁC (khác `getMemberId`) là dấu hiệu đáng ngờ (VD 2
  // người dùng chung 1 máy để chấm công hộ nhau) nên đánh dấu CẢNH BÁO cho
  // CEO/Founder tự xem lại — KHÔNG tự chặn gì, vân tay chỉ là gợi ý thô (2
  // máy cùng đời/cấu hình vẫn có thể trùng ngẫu nhiên), quyết định cuối vẫn
  // là con người. Trùng vân tay GIỮA 2 thiết bị CỦA CÙNG 1 người là chuyện
  // bình thường (xem registerMemberDevice's fingerprint-recovery), không tính.
  function getAllMemberDeviceRows() {
    var out = [];
    var fingerprintOwners = {}; // fingerprint -> Set các memberId đã thấy
    getMembers().forEach(function (m) {
      parseDeviceIds(m).forEach(function (e) {
        if (e.fingerprint) {
          if (!fingerprintOwners[e.fingerprint]) fingerprintOwners[e.fingerprint] = {};
          fingerprintOwners[e.fingerprint][m.id] = true;
        }
        out.push({ memberId: m.id, memberName: m.name || m.id, deviceId: e.id, deviceName: e.name, status: e.status, fingerprint: e.fingerprint });
      });
    });
    out.forEach(function (row) {
      var owners = row.fingerprint ? Object.keys(fingerprintOwners[row.fingerprint] || {}) : [];
      row.fingerprintDup = owners.length > 1;
    });
    return out;
  }

  // CEO/Founder thêm thủ công 1 mã thiết bị (nhân viên tự gửi mã qua Zalo/
  // tin nhắn khi chờ duyệt lâu quá) cho MỘT người khác — khác registerMemberDevice
  // (tự đăng ký từ đúng máy đó) ở chỗ: admin đã tự xác nhận mã đúng của người
  // đó nên ghi thẳng trạng thái 'approved', không qua hàng chờ duyệt nữa.
  function adminRegisterMemberDevice(memberId, deviceId, deviceName, user) {
    if (!canManageMembers(user)) return { ok: false, reason: 'forbidden' };
    var member = getMember(memberId);
    deviceId = String(deviceId || '').trim();
    if (!member || !deviceId) return { ok: false, reason: 'invalid' };
    var entries = parseDeviceIds(member);
    var existing = entries.filter(function (e) { return e.id === deviceId; })[0];
    if (existing) {
      existing.status = 'approved';
      if (deviceName) existing.name = deviceName;
    } else {
      if (entries.length >= MAX_MEMBER_DEVICES) return { ok: false, reason: 'full' };
      entries.push({ id: deviceId, name: deviceName || '', status: 'approved' });
    }
    var updated = updateMember(memberId, stringifyDeviceEntries(entries), user);
    if (!updated) return { ok: false, reason: 'blocked' };
    addSystemNotificationsBatch([{
      title: 'Thiết bị chấm công đã được thêm',
      message: 'Thiết bị "' + (deviceName || deviceId) + '" đã được ' + (user.name || 'quản lý') + ' thêm thủ công cho bạn — có thể dùng để chấm công ngay.',
      type: 'attendance', scope: memberId, recurring: false
    }]);
    return { ok: true };
  }

  // Sửa tên hiển thị của 1 thiết bị đã đăng ký (VD nhân viên đổi máy nhưng
  // tên cũ ghi sai, hoặc admin muốn ghi chú rõ hơn "Điện thoại - Nam").
  function adminRenameMemberDevice(memberId, deviceId, newName, user) {
    if (!canManageMembers(user)) return null;
    var member = getMember(memberId);
    if (!member) return null;
    var entries = parseDeviceIds(member);
    var entry = entries.filter(function (e) { return e.id === deviceId; })[0];
    if (!entry) return null;
    entry.name = newName || '';
    return updateMember(memberId, stringifyDeviceEntries(entries), user);
  }

  // Reset toàn bộ thiết bị đã đăng ký của 1 thành viên (nhả hết slot) — dùng
  // khi người đó đổi hết máy móc hoặc dữ liệu thiết bị bị rối cần làm sạch.
  function adminResetMemberDevices(memberId, user) {
    if (!canManageMembers(user)) return null;
    var member = getMember(memberId);
    if (!member) return null;
    return updateMember(memberId, stringifyDeviceEntries([]), user);
  }

  // Duyệt/từ chối thành viên đăng ký mới: CHỈ Founder/CEO/Giám đốc Bộ phận
  // (roleLevel 'admin' — cả 3 level này đều suy ra 'admin', xem
  // LEVEL_TO_ROLELEVEL trong gsheets-api-v2.js). Chốt lại 2026-09-16 theo yêu
  // cầu người dùng — trước đó "Quản lý" (level manager) cũng duyệt được,
  // giờ thu hẹp lại đúng 3 cấp cao nhất.
  function canManageMembers(user) {
    return !!user && user.roleLevel === 'admin';
  }

  // Ngưng công tác / khôi phục thành viên: chỉ CEO.
  function canTerminateMembers(user) {
    return !!user && user.roleLevel === 'admin';
  }

  // status: 'active' (duyệt / khôi phục), 'rejected' (từ chối), 'inactive' (ngưng công tác).
  // Duyệt/từ chối một tài khoản đang "pending" chỉ cần Manager+; ngưng công tác hoặc
  // khôi phục một tài khoản đã "inactive" bắt buộc phải là CEO.
  function updateMemberStatus(id, status, user) {
    var member = getMember(id);
    if (!member) return null;
    var isTerminateAction = status === 'inactive' || member.status === 'inactive';
    var allowed = isTerminateAction ? canTerminateMembers(user) : canManageMembers(user);
    if (!allowed) return null;
    var updated = update(STORAGE_KEYS.members, id, { status: status });
    if (updated) syncToGSheets('members', 'update', { status: status }, id);
    return updated;
  }

  // 2026-09-22: sửa Cấp bậc (level) của thành viên khác — CHỈ Founder (level
  // code 'founder', đỉnh của 5 mức) mới làm được, theo đúng yêu cầu người
  // dùng. `roleLevel` (3 mức cũ, ~25 chỗ check quyền rải khắp client) được tự
  // suy lại từ level mới qua LEVELS ở trên để không lệch nhau.
  function isFounder(user) {
    return !!user && user.level === 'founder';
  }

  function updateMemberLevel(id, levelCode, user) {
    user = user || getCurrentUser();
    if (!isFounder(user)) return null;
    var levelInfo = getLevelByCode(levelCode);
    if (!levelInfo) return null;
    var updates = { level: levelCode, roleLevel: levelInfo.roleLevel };
    var updated = update(STORAGE_KEYS.members, id, updates);
    if (updated) syncToGSheets('members', 'update', updates, id);
    return updated;
  }

  // Proposals
  function getProposals(filters) {
    filters = filters || {};
    var proposals = getAll(STORAGE_KEYS.proposals);

    if (filters.status) {
      proposals = proposals.filter(function(p) { return p.status === filters.status; });
    }
    if (filters.requesterId) {
      proposals = proposals.filter(function(p) { return p.requesterId === filters.requesterId; });
    }

    return proposals.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function getProposal(id) {
    return getById(STORAGE_KEYS.proposals, id);
  }

  function createProposal(proposal) {
    proposal.status = proposal.status || 'pending';
    var newProposal = add(STORAGE_KEYS.proposals, proposal);
    // Sync to Google Sheets
    syncToGSheets('proposals', 'add', newProposal);
    return newProposal;
  }

  function updateProposal(id, updates) {
    var updated = update(STORAGE_KEYS.proposals, id, updates);
    // Sync to Google Sheets
    if (updated) syncToGSheets('proposals', 'update', updates, id);
    return updated;
  }

  function approveProposal(id) {
    var result = updateProposal(id, { status: 'approved', reviewedAt: new Date().toISOString() });
    // Sync approve to Google Sheets
    syncToGSheets('proposals', 'approve', {}, id);
    return result;
  }

  function rejectProposal(id) {
    var result = updateProposal(id, { status: 'rejected', reviewedAt: new Date().toISOString() });
    // Sync reject to Google Sheets
    syncToGSheets('proposals', 'reject', {}, id);
    return result;
  }

  // Notifications
  // Persisted items (announcements + recurring rule definitions) live in the
  // Notifications sheet. "Alerts" (overdue tasks, late check-in, an active
  // recurring rule for today) are computed on the fly and never written —
  // keeps the sheet small no matter how long the company runs on it.

  // 2026-09-21: BUG NGHIÊM TRỌNG phát hiện qua báo cáo thật — chấm công lúc
  // 01:17 sáng (giờ VN, UTC+7) ghi lên Sheet với "Ngày" là HÔM QUA, khiến
  // lịch/chi tiết ngày ở timesheet.html (tự tính "hôm nay" đúng theo giờ
  // ĐỊA PHƯƯƠNG qua getFullYear()/getMonth()/getDate()) không bao giờ khớp
  // được bản ghi vừa tạo — trông y hệt "chấm công xong mà web không cập
  // nhật", trong khi Sheet đã có đúng dữ liệu. Nguyên nhân: toISOString()
  // luôn quy đổi sang UTC trước khi cắt chuỗi ngày — với UTC+7, bất kỳ giờ
  // nào TRƯỚC 07:00 sáng giờ VN đều bị lùi về ĐÚNG NGÀY HÔM TRƯỚC theo UTC.
  // Đổi sang lấy trực tiếp năm/tháng/ngày ở giờ địa phương của máy/server
  // (Apps Script chạy timezone Asia/Ho_Chi_Minh nên khớp) — không quy đổi
  // UTC. Ảnh hưởng dây chuyền: shiftCheckIn()/shiftCheckOut() (chấm công
  // theo ca), addDailyProgress()/getTodayProgress() (tiến độ hàng ngày),
  // getComputedAlerts() (nhắc việc quá hạn/sinh nhật), getStats() (việc đến
  // hạn hôm nay), markOrderPaid() (ngày ghi nhận doanh thu) — tất cả dùng
  // chung hàm này thay vì tự lặp lại `new Date().toISOString().split('T')[0]`
  // rải rác (đã lỡ SAI y hệt ở nhiều chỗ trước khi fix).
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function canManageNotifications(user) {
    return !!user && (user.roleLevel === 'admin' || user.roleLevel === 'manager');
  }

  // Sổ tài chính công ty (finance.html) — CEO-only, không phải admin/manager
  // thường như hầu hết các quyền khác trong file này. Đây vẫn chỉ là kiểm
  // tra phía client (giống mọi "phân quyền" khác trong app) — không phải
  // bảo mật server-side thật, xem GHI_CHU_DU_AN.md.
  function canManageFinance(user) {
    return !!user && user.roleLevel === 'admin';
  }

  function canManageRecurringRules(user) {
    return !!user && user.roleLevel === 'admin';
  }

  // All persisted rows — used by the CEO/manager management panel.
  function getNotificationRules() {
    return getAll(STORAGE_KEYS.notifications);
  }

  // One-off announcements visible to a given user (scope 'all' or their own id).
  function getNotifications(user) {
    if (!user) return [];
    return getAll(STORAGE_KEYS.notifications).filter(function(n) {
      if (n.recurring) return false;
      if (n.active === false) return false;
      return n.scope === 'all' || n.scope === user.id;
    });
  }

  function createNotification(data, user) {
    if (!canManageNotifications(user)) return null;
    data.active = data.active !== false;
    data.createdBy = user.id;
    var newItem = add(STORAGE_KEYS.notifications, data);
    syncToGSheets('notifications', 'add', newItem);
    return newItem;
  }

  function updateNotification(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.notifications, id, updates);
    if (updated) syncToGSheets('notifications', 'update', updates, id);
    return updated;
  }

  function deleteNotification(id, user) {
    if (!canManageNotifications(user)) return false;
    var result = remove(STORAGE_KEYS.notifications, id);
    syncToGSheets('notifications', 'delete', {}, id);
    return result;
  }

  function parseRecurWindow(rule) {
    var m = /^monthly:(\d+)-(\d+)$/.exec(rule || '');
    if (!m) return null;
    return { from: parseInt(m[1], 10), to: parseInt(m[2], 10) };
  }

  function isRecurringActiveToday(rule) {
    if (!rule.recurring || rule.active === false) return false;
    var win = parseRecurWindow(rule.recurRule);
    if (!win) return false;
    var day = new Date().getDate();
    return day >= win.from && day <= win.to;
  }

  // Read/unread — per-device only, not synced (mark-as-read isn't shared data).
  function getReadIds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.readNotifications) || '[]'); }
    catch (e) { return []; }
  }

  function markNotificationRead(id) {
    var ids = getReadIds();
    if (ids.indexOf(id) === -1) {
      ids.push(id);
      localStorage.setItem(STORAGE_KEYS.readNotifications, JSON.stringify(ids));
    }
  }

  function markAllNotificationsRead(ids) {
    var read = getReadIds();
    ids.forEach(function(id) { if (read.indexOf(id) === -1) read.push(id); });
    localStorage.setItem(STORAGE_KEYS.readNotifications, JSON.stringify(read));
  }

  function isNotificationRead(id) {
    return getReadIds().indexOf(id) !== -1;
  }

  // 2026-09-17: "Xoá tất cả thông báo" — CHỈ ẩn khỏi danh sách của CHÍNH
  // người dùng đó trên MÁY này (per-device, giống cơ chế đã đọc/chưa đọc ở
  // trên, không đồng bộ Sheet). KHÔNG xoá dữ liệu thông báo thật (deleteNotification()
  // đòi quyền canManageNotifications, nhân viên thường không có) — 1 thông
  // báo scope='all' vẫn phải còn nguyên cho người khác thấy, chỉ người bấm
  // xoá mới không thấy nó nữa từ nay.
  function getDismissedIds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.dismissedNotifications) || '[]'); }
    catch (e) { return []; }
  }

  function dismissAllNotifications(ids) {
    var dismissed = getDismissedIds();
    ids.forEach(function(id) { if (dismissed.indexOf(id) === -1) dismissed.push(id); });
    localStorage.setItem(STORAGE_KEYS.dismissedNotifications, JSON.stringify(dismissed));
  }

  function isNotificationDismissed(id) {
    return getDismissedIds().indexOf(id) !== -1;
  }

  // Live alerts derived from current data — never persisted.
  function getComputedAlerts(user) {
    if (!user) return [];
    var alerts = [];
    var today = todayStr();
    var members = getAll(STORAGE_KEYS.members);

    // Task deadlines assigned to this user
    getAll(STORAGE_KEYS.tasks).filter(function(t) {
      return Array.isArray(t.assigneeIds) && t.assigneeIds.indexOf(user.id) !== -1 && t.status !== 'completed' && t.deadline;
    }).forEach(function(t) {
      var overdue = new Date(t.deadline) < new Date();
      var dueToday = (t.deadline.split('T')[0] === today);
      if (overdue) {
        alerts.push({ id: 'alert_overdue_' + t.id, title: 'Việc quá hạn', message: t.title, type: 'task', level: 'danger', createdAt: t.deadline });
      } else if (dueToday) {
        alerts.push({ id: 'alert_duetoday_' + t.id, title: 'Việc đến hạn hôm nay', message: t.title, type: 'task', level: 'warning', createdAt: t.deadline });
      }
    });

    // Late check-in — self always, team view for CEO/manager
    var LATE_THRESHOLD = '08:30';
    var canSeeTeam = canManageNotifications(user);
    getAll(STORAGE_KEYS.timesheet).map(deriveShiftFields_).filter(function(e) {
      return e.date === today && e.checkinTime && e.checkinTime > LATE_THRESHOLD;
    }).forEach(function(e) {
      if (e.memberId !== user.id && !canSeeTeam) return;
      var m = members.filter(function(mm) { return mm.id === e.memberId; })[0];
      alerts.push({ id: 'alert_late_' + e.id, title: 'Chấm công trễ', message: (m ? m.name : e.memberId) + ' check-in lúc ' + e.checkinTime + ' · ' + formatShortDate(e.date), type: 'checkin', level: 'warning', createdAt: today });
    });

    // Active recurring rules (e.g. payroll reminder days 1-5)
    getAll(STORAGE_KEYS.notifications).filter(function(n) {
      return isRecurringActiveToday(n) && (n.scope === 'all' || n.scope === user.id);
    }).forEach(function(n) {
      alerts.push({ id: 'alert_recur_' + n.id + '_' + today, title: n.title, message: n.message, type: n.type || 'system', level: 'info', createdAt: today, recurring: true });
    });

    // Sinh nhật thành viên — lịch nhắc mặc định, không cần tạo tay trên
    // Notifications sheet: so khớp tháng-ngày của Members.dob (bỏ qua năm),
    // báo trước 1 ngày VÀ đúng ngày sinh nhật, hiện cho tất cả (scope 'all')
    // để cả team biết mà gửi lời chúc. Tính lại mỗi lần mở app, không lưu.
    var todayMD = today.slice(5);
    var tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    var tomorrowMD = String(tomorrowDate.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDate.getDate()).padStart(2, '0');
    members.filter(function (m) { return m.dob; }).forEach(function (m) {
      var dobMD = String(m.dob).slice(5, 10);
      if (dobMD === todayMD) {
        alerts.push({ id: 'alert_birthday_today_' + m.id + '_' + today, title: '🎂 Sinh nhật hôm nay', message: m.name + ' sinh nhật hôm nay — gửi lời chúc nhé!', type: 'birthday', level: 'info', createdAt: today });
      } else if (dobMD === tomorrowMD) {
        alerts.push({ id: 'alert_birthday_soon_' + m.id + '_' + today, title: 'Sinh nhật sắp tới', message: m.name + ' sinh nhật vào ngày mai.', type: 'birthday', level: 'info', createdAt: today });
      }
    });

    return alerts;
  }

  // Notice board (public/pages/notices.html)
  function getNotices() {
    return getAll(STORAGE_KEYS.notices).sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
  }

  function createNotice(data, user) {
    if (!canManageNotifications(user)) return null;
    data.color = data.color || 'bronze';
    data.createdBy = user.id;
    var newItem = add(STORAGE_KEYS.notices, data);
    syncToGSheets('notices', 'add', newItem);
    return newItem;
  }

  function updateNotice(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.notices, id, updates);
    if (updated) syncToGSheets('notices', 'update', updates, id);
    return updated;
  }

  function deleteNotice(id, user) {
    if (!canManageNotifications(user)) return false;
    var result = remove(STORAGE_KEYS.notices, id);
    syncToGSheets('notices', 'delete', {}, id);
    return result;
  }

  // Wiki document links (public/pages/wiki.html)
  function getDocuments() {
    var docs = getAll(STORAGE_KEYS.documents);
    var byCategory = {};
    var order = [];
    docs.forEach(function(d) {
      if (!byCategory[d.category]) { byCategory[d.category] = []; order.push(d.category); }
      byCategory[d.category].push(d);
    });
    return order.map(function(cat) { return { category: cat, items: byCategory[cat] }; });
  }

  function createDocument(data, user) {
    if (!canManageNotifications(user)) return null;
    data.createdBy = user.id;
    var newItem = add(STORAGE_KEYS.documents, data);
    syncToGSheets('documents', 'add', newItem);
    return newItem;
  }

  function updateDocument(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.documents, id, updates);
    if (updated) syncToGSheets('documents', 'update', updates, id);
    return updated;
  }

  function deleteDocument(id, user) {
    if (!canManageNotifications(user)) return false;
    var result = remove(STORAGE_KEYS.documents, id);
    syncToGSheets('documents', 'delete', {}, id);
    return result;
  }

  // Danh mục chung (dropdown "Danh mục" khi thêm tài liệu) — CEO/Manager thêm/xoá được,
  // lưu riêng trong localStorage của máy (không đồng bộ qua Google Sheets).
  function getDocCategories() {
    var list = getAll(STORAGE_KEYS.docCategories);
    return list.slice().sort(function (a, b) { return a.localeCompare(b, 'vi'); });
  }

  function addDocCategory(name, user) {
    if (!canManageNotifications(user)) return null;
    name = String(name || '').trim();
    if (!name) return null;
    var list = getAll(STORAGE_KEYS.docCategories);
    var exists = list.some(function (c) { return c.toLowerCase() === name.toLowerCase(); });
    if (exists) return list;
    list.push(name);
    save(STORAGE_KEYS.docCategories, list);
    return list;
  }

  function deleteDocCategory(name, user) {
    if (!canManageNotifications(user)) return null;
    var list = getAll(STORAGE_KEYS.docCategories);
    var filtered = list.filter(function (c) { return c.toLowerCase() !== String(name || '').toLowerCase(); });
    save(STORAGE_KEYS.docCategories, filtered);
    return filtered;
  }

  // Mã tài liệu — [Phòng ban]-[Loại tài liệu]-[STT 3 số], STT tự tăng theo cặp
  // phòng ban+loại đã có, không phụ thuộc tài liệu bị xoá hay chưa (luôn tăng dần).
  function getNextDocCode(dept, type) {
    if (!dept || !type) return '';
    var prefix = dept + '-' + type + '-';
    var maxSeq = 0;
    getAll(STORAGE_KEYS.documents).forEach(function (d) {
      if (d.code && d.code.indexOf(prefix) === 0) {
        var seq = parseInt(d.code.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    var next = maxSeq + 1;
    return prefix + ('00' + next).slice(-3);
  }

  // Timesheet
  // 2026-09-23: phòng hờ dữ liệu trùng còn sót/lỡ lọt (VD do mạng chập chờn
  // gọi trùng request check-in trước khi addData() phía server được vá chặn —
  // xem gsheets-api-v2.js) — gộp mọi dòng CÙNG memberId+date thành 1, ưu tiên
  // giữ field đã có giá trị (đặc biệt checkoutTime/status/totalHours của dòng
  // đã check-out), thay vì để dòng đọc SAU ghi đè trắng dòng đọc TRƯỚC như
  // trước đây (nguyên nhân "có checkout trong Sheet nhưng app không hiển thị").
  function dedupeTimesheetEntries_(entries) {
    var byKey = {};
    var order = [];
    entries.forEach(function (e) {
      var key = e.memberId + '|' + e.date;
      if (!byKey[key]) { byKey[key] = e; order.push(key); return; }
      var merged = byKey[key];
      if ((e.afternoonCheckout || e.morningCheckout) && !(merged.afternoonCheckout || merged.morningCheckout)) merged = Object.assign({}, e);
      Object.keys(e).forEach(function (k) {
        var val = e[k];
        if (val !== '' && val !== null && val !== undefined && (merged[k] === '' || merged[k] === null || merged[k] === undefined)) {
          merged[k] = val;
        }
      });
      byKey[key] = merged;
    });
    return order.map(function (k) { return byKey[k]; });
  }

  // 2026-09-26: 4 cột ca (morningCheckin/Checkout, afternoonCheckin/Checkout —
  // cột P/Q/R/S trên Sheet "Chấm công") là NGUỒN DUY NHẤT của giờ vào/ra. 2 cột
  // cũ checkinTime/checkoutTime đã bỏ khỏi Sheet nên mọi chỗ còn đọc chúng
  // (lịch, báo cáo tháng, tính công/lương, cảnh báo đi muộn) được cấp bằng
  // cách SUY RA từ 4 cột ca ở đây — không lưu trùng, không thể lệch nhau.
  // totalHours/overtimeHours cũng tính lại từ đúng các cặp vào/ra đã đủ.
  function timeToMin_(t) {
    var m = /^(\d{1,2})[:.](\d{2})/.exec(String(t == null ? '' : t));
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }
  function shiftPairHours_(inT, outT) {
    var a = timeToMin_(inT), b = timeToMin_(outT);
    if (a == null || b == null) return 0;
    return Math.max(0, (b - a) / 60);
  }
  function calcTimesheetHours_(e) {
    var total = shiftPairHours_(e.morningCheckin, e.morningCheckout) + shiftPairHours_(e.afternoonCheckin, e.afternoonCheckout);
    total = parseFloat(total.toFixed(1));
    var ot = (e.date && isOtDay(e.date)) ? total : parseFloat(Math.max(0, total - 8).toFixed(1));
    return { totalHours: total, overtimeHours: ot };
  }
  function deriveShiftFields_(e) {
    var d = Object.assign({}, e);
    d.checkinTime = e.morningCheckin || e.afternoonCheckin || '';
    d.checkoutTime = e.afternoonCheckout || e.morningCheckout || '';
    var h = calcTimesheetHours_(e);
    d.totalHours = h.totalHours;
    d.overtimeHours = h.overtimeHours;
    return d;
  }

  function getTimesheetEntries(filters) {
    filters = filters || {};
    var entries = dedupeTimesheetEntries_(getAll(STORAGE_KEYS.timesheet)).map(deriveShiftFields_);
    if (filters.memberId) {
      entries = entries.filter(function(e) { return e.memberId === filters.memberId; });
    }
    if (filters.month && filters.year) {
      entries = entries.filter(function(e) {
        if (!e.date) return false;
        var d = e.date.split('-');
        return d[0] === String(filters.year) && d[1] === String(filters.month).padStart(2, '0');
      });
    }
    return entries;
  }

  function addTimesheetEntry(entry) {
    var newEntry = add(STORAGE_KEYS.timesheet, entry);
    syncToGSheets('timesheet', 'add', newEntry);
    return newEntry;
  }

  // Địa điểm GPS + IP hợp lệ để chấm công — sống hẳn trên sheet "Địa điểm
  // chấm công" (không cache vào localStorage như các sheet khác, vì đây là
  // dữ liệu cấu hình đọc trực tiếp mỗi lần check-in/out, cần luôn mới nhất;
  // getFromGSheets() đã tự cache 30s ở tầng dưới nên không gọi API dồn dập).
  function getAttendanceLocations(callback) {
    if (!isUsingGSheets()) { callback([]); return; }
    getFromGSheets('attendanceLocations', callback);
  }

  // Thêm/sửa/xoá địa điểm GPS/IP — CHỈ CEO/admin dùng (xem bindLocationManagerUI()
  // trong timesheet.html), gọi thẳng API (không qua localStorage) rồi xoá cache
  // 30s để lần đọc kế tiếp lấy đúng dữ liệu mới nhất, không phải chờ hết cache.
  function addAttendanceLocation(data, callback) {
    if (!isUsingGSheets()) { callback && callback(null); return; }
    if (typeof Offline !== 'undefined' && Offline.guard('thêm địa điểm')) { callback && callback(null); return; }
    fetch(GSHEETS_CONFIG.API_URL + '?action=addAttendanceLocation&data=' + encodeURIComponent(JSON.stringify(data)), { redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (result) { gsCacheTime.attendanceLocations = 0; callback && callback(result); })
      .catch(function (e) { console.error('addAttendanceLocation failed:', e); callback && callback(null); });
  }
  function updateAttendanceLocation(id, updates, callback) {
    if (!isUsingGSheets()) { callback && callback(null); return; }
    if (typeof Offline !== 'undefined' && Offline.guard('sửa địa điểm')) { callback && callback(null); return; }
    fetch(GSHEETS_CONFIG.API_URL + '?action=updateAttendanceLocation&id=' + encodeURIComponent(id) + '&data=' + encodeURIComponent(JSON.stringify(updates)), { redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (result) { gsCacheTime.attendanceLocations = 0; callback && callback(result); })
      .catch(function (e) { console.error('updateAttendanceLocation failed:', e); callback && callback(null); });
  }
  function deleteAttendanceLocation(id, callback) {
    if (!isUsingGSheets()) { callback && callback(null); return; }
    if (typeof Offline !== 'undefined' && Offline.guard('xoá địa điểm')) { callback && callback(null); return; }
    fetch(GSHEETS_CONFIG.API_URL + '?action=deleteAttendanceLocation&id=' + encodeURIComponent(id), { redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (result) { gsCacheTime.attendanceLocations = 0; callback && callback(result); })
      .catch(function (e) { console.error('deleteAttendanceLocation failed:', e); callback && callback(null); });
  }

  function updateTimesheetEntry(id, updates) {
    var updated = update(STORAGE_KEYS.timesheet, id, updates);
    if (updated) syncToGSheets('timesheet', 'update', updates, id);
    return updated;
  }

  // Giờ làm việc chuẩn (ca sáng/chiều) — Setup thời gian làm việc, xem
  // GHI_CHU_DU_AN.md. Sống hẳn trên sheet riêng "Giờ làm việc" (CHỈ 1 dòng
  // duy nhất, upsert phía server — xem action `saveWorkSchedule` trong
  // gsheets-api-v2.js), KHÔNG cache localStorage (giống attendanceLocations)
  // vì chấm công cần luôn đọc đúng giờ chuẩn mới nhất; getFromGSheets() vẫn
  // tự cache 30s ở tầng dưới nên không gọi API dồn dập.
  // `lateGraceMinutes` (2026-09-19, theo yêu cầu Founder): số phút "ân hạn"
  // sau giờ vào ca chuẩn — chấm công trong khoảng này vẫn tính đúng giờ,
  // không bị đánh dấu "đi muộn" (VD giờ vào 07:30 + ân hạn 5 phút = chấm
  // công trước 07:35 vẫn OK). CHỈ áp dụng cho check-IN (đi muộn đầu giờ),
  // không áp dụng cho check-OUT (về sớm) — xem isLateOrEarly() trong
  // timesheet.html.
  // `morningAutoCheckoutTime` (2026-09-22): giờ hệ thống TỰ ĐỘNG đóng ca sáng
  // nếu đã check-in mà quên check-out — xem autoCheckoutForgottenMorningShifts()
  // trong gsheets-api-v2.js (đọc field này mỗi lần chạy, KHÔNG cần cài lại
  // trigger khi đổi giờ — trigger tự chạy mỗi 15 phút, tự so sánh giờ hiện
  // tại với giờ cấu hình ở đây).
  var DEFAULT_WORK_SCHEDULE = { morningStart: '07:30', morningEnd: '11:30', afternoonStart: '13:30', afternoonEnd: '17:30', lateGraceMinutes: 5, morningAutoCheckoutTime: '12:30' };

  // Ngày nghỉ lễ chính thức theo lịch nhà nước — KHÔNG có API/thư viện âm
  // lịch nào trong dự án để tự tính, nên liệt kê tay theo từng năm (thêm
  // ngày mới vào đây mỗi khi có lịch nghỉ lễ năm sau, định dạng "YYYY-MM-DD").
  // Dùng cùng với thứ Bảy/Chủ nhật để xác định ngày chấm công tính lương OT —
  // xem isOtDay()/shiftCheckOut() bên dưới.
  var VN_HOLIDAYS = [
    // 2026
    '2026-01-01', // Tết Dương lịch
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', // Tết Nguyên Đán Bính Ngọ
    '2026-04-27', // Giỗ Tổ Hùng Vương (nghỉ bù, 10/3 âm rơi vào CN 26/4)
    '2026-04-30', // Giải phóng miền Nam
    '2026-05-01', // Quốc tế Lao động
    '2026-09-01', '2026-09-02', // Quốc khánh
    '2026-11-24' // Ngày Văn hoá Việt Nam (mới, lần đầu áp dụng 2026)
  ];

  // Thứ Bảy/Chủ nhật hoặc ngày lễ trong VN_HOLIDAYS — vẫn cho chấm công bình
  // thường (không chặn gì cả), chỉ khác ở chỗ giờ làm được TÍNH TOÀN BỘ là
  // giờ OT (x1.5 lương, xem OT_MULTIPLIER) thay vì chỉ phần vượt 8h/ngày như
  // ngày thường.
  function isOtDay(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var dow = d.getDay();
    return dow === 0 || dow === 6 || VN_HOLIDAYS.indexOf(dateStr) !== -1;
  }
  function getWorkSchedule(callback) {
    if (!isUsingGSheets()) { callback(DEFAULT_WORK_SCHEDULE); return; }
    getFromGSheets('workSchedule', function (rows) {
      // Object.assign với DEFAULT_WORK_SCHEDULE trước — dòng đã lưu TRƯỚC KHI
      // có field `lateGraceMinutes` (2026-09-19) sẽ thiếu hẳn cột này (chuỗi
      // rỗng từ Sheet, không phải undefined), cần fallback về mặc định thay
      // vì hiện trống/0 sai ý ở form và khi tính "đi muộn" trong
      // isLateOrEarly().
      var ws = rows && rows.length > 0 ? Object.assign({}, DEFAULT_WORK_SCHEDULE, rows[0]) : DEFAULT_WORK_SCHEDULE;
      if (ws.lateGraceMinutes === '' || ws.lateGraceMinutes == null || isNaN(Number(ws.lateGraceMinutes))) {
        ws.lateGraceMinutes = DEFAULT_WORK_SCHEDULE.lateGraceMinutes;
      } else {
        ws.lateGraceMinutes = Number(ws.lateGraceMinutes);
      }
      if (!/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(ws.morningAutoCheckoutTime || '')) {
        ws.morningAutoCheckoutTime = DEFAULT_WORK_SCHEDULE.morningAutoCheckoutTime;
      }
      callback(ws);
    });
  }
  function saveWorkSchedule(data, callback) {
    if (!isUsingGSheets()) { callback && callback(null); return; }
    if (typeof Offline !== 'undefined' && Offline.guard('lưu giờ làm việc')) { callback && callback(null); return; }
    fetch(GSHEETS_CONFIG.API_URL + '?action=saveWorkSchedule&data=' + encodeURIComponent(JSON.stringify(data)), { redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (result) { gsCacheTime.workSchedule = 0; callback && callback(result); })
      .catch(function (e) { console.error('saveWorkSchedule failed:', e); callback && callback(null); });
  }

  // Chấm công theo ca sáng/chiều — thay cho checkIn()/checkOut() 1-lần/ngày cũ
  // (vẫn giữ nguyên `addTimesheetEntry`/`updateTimesheetEntry` phía trên cho
  // chỗ nào còn dùng kiểu cũ). Đặt trong task-data.js (không phải
  // timesheet.html) vì cần gọi addSystemNotificationsBatch()/
  // adminAndManagerMembers() — 2 hàm PRIVATE của module này, xem
  // registerMemberDevice() ở trên làm mẫu cùng kiểu.
  // `isLate`/`isEarly`/`lateEarlyNote` do PHÍA GỌI (timesheet.html) tự tính
  // trước bằng cách so giờ hiện tại với getWorkSchedule() rồi truyền vào —
  // hàm này chỉ ghi lại đúng những gì đã được UI xác định, không tự tính lại
  // để tránh 2 nơi có 2 quy tắc khác nhau.
  function shiftCheckIn(memberId, shift, fields, user) {
    var today = todayStr();
    var entries = getAll(STORAGE_KEYS.timesheet);
    var record = entries.filter(function (e) { return e.memberId === memberId && e.date === today; })[0];
    var patch = {};
    patch[shift + 'Checkin'] = fields.time;
    patch.status = 'working'; // check-in lại (VD sau khi đã check-out ca trước) thì ngày chưa xong nữa
    if (fields.isLate) { patch.isLate = true; patch.lateEarlyNote = fields.lateEarlyNote || ''; }
    Object.keys(fields.verify || {}).forEach(function (k) { patch[k] = fields.verify[k]; });

    var result;
    if (record) {
      result = updateTimesheetEntry(record.id, patch);
    } else {
      var entry = Object.assign({
        id: 'TS_' + Date.now(), memberId: memberId, date: today,
        totalHours: 0, overtimeHours: 0, status: 'working', note: ''
      }, patch);
      result = addTimesheetEntry(entry);
    }
    if (fields.isLate) {
      var shiftLabel = shift === 'morning' ? 'sáng' : 'chiều';
      var member = getMember(memberId);
      var msg = (member ? member.name : memberId) + ' vào ca ' + shiftLabel + ' lúc ' + fields.time + ' (muộn) — lý do: ' + (fields.lateEarlyNote || 'không ghi rõ');
      addSystemNotificationsBatch(adminAndManagerMembers(user && user.id).map(function (mgr) {
        return { title: 'Đi muộn ca ' + shiftLabel, message: msg, type: 'attendance', scope: mgr.id, recurring: false };
      }));
    }
    return result;
  }

  function shiftCheckOut(memberId, shift, fields, user) {
    var today = todayStr();
    var entries = getAll(STORAGE_KEYS.timesheet);
    var record = entries.filter(function (e) { return e.memberId === memberId && e.date === today; })[0];
    if (!record) return null;
    var patch = {};
    patch[shift + 'Checkout'] = fields.time;
    // status = 'completed' sau mỗi lần check-out; check-in lại ca khác thì
    // shiftCheckIn() tự đặt về 'working'. Giờ vào/ra chỉ sống ở 4 cột ca.
    patch.status = 'completed';
    if (fields.isEarly) { patch.isEarly = true; patch.lateEarlyNote = fields.lateEarlyNote || record.lateEarlyNote || ''; }

    // Tính lại tổng giờ = tổng thời lượng các cặp check-in/out ĐÃ CÓ (sáng +
    // chiều), cặp nào chưa đủ (thiếu checkin hoặc checkout) thì bỏ qua —
    // không giả định phải làm đủ cả 2 ca mới tính được giờ.
    var h = calcTimesheetHours_(Object.assign({}, record, patch));
    patch.totalHours = h.totalHours;
    patch.overtimeHours = h.overtimeHours;

    var result = updateTimesheetEntry(record.id, patch);
    if (fields.isEarly) {
      var shiftLabel = shift === 'morning' ? 'sáng' : 'chiều';
      var member = getMember(memberId);
      var msg = (member ? member.name : memberId) + ' ra ca ' + shiftLabel + ' lúc ' + fields.time + ' (sớm) — lý do: ' + (fields.lateEarlyNote || 'không ghi rõ');
      addSystemNotificationsBatch(adminAndManagerMembers(user && user.id).map(function (mgr) {
        return { title: 'Về sớm ca ' + shiftLabel, message: msg, type: 'attendance', scope: mgr.id, recurring: false };
      }));
    }
    return result;
  }

  function getMonthlyTimesheetStats(memberId, month) {
    // month: 'YYYY-MM'
    var parts = String(month).split('-');
    var entries = getTimesheetEntries({ memberId: memberId, year: parts[0], month: parts[1] });
    var workDays = 0, totalHours = 0, overtimeHours = 0;
    entries.forEach(function (e) {
      if (e.checkoutTime) {
        workDays++;
        totalHours += parseFloat(e.totalHours) || 0;
        overtimeHours += parseFloat(e.overtimeHours) || 0;
      }
    });
    return { workDays: workDays, totalHours: totalHours, overtimeHours: overtimeHours };
  }

  // Lương cơ bản — chỉ admin/quản lý được sửa (không cho tự sửa lương của mình).
  function setMemberBaseSalary(id, baseSalary, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.members, id, { baseSalary: baseSalary });
    if (updated) syncToGSheets('members', 'update', { baseSalary: baseSalary }, id);
    return updated;
  }

  // % Hoa hồng dự án theo vai trò — cấu hình mặc định, admin/quản lý chỉnh được.
  function getCommissionRates() {
    return getAll(STORAGE_KEYS.commissionRates);
  }

  function getCommissionRateFor(roleLevel) {
    var found = getCommissionRates().find(function (r) { return r.roleLevel === roleLevel; });
    return found ? (Number(found.percent) || 0) : 0;
  }

  function saveCommissionRate(roleLevel, percent, user) {
    if (!canManageNotifications(user)) return null;
    var existing = getCommissionRates().find(function (r) { return r.roleLevel === roleLevel; });
    if (existing) {
      var updated = update(STORAGE_KEYS.commissionRates, existing.id, { percent: percent });
      if (updated) syncToGSheets('commissionRates', 'update', { percent: percent }, existing.id);
      return updated;
    }
    var created = add(STORAGE_KEYS.commissionRates, { roleLevel: roleLevel, percent: percent });
    syncToGSheets('commissionRates', 'add', created);
    return created;
  }

  // Hoa hồng dự án — mỗi dòng là hoa hồng của 1 thành viên trên 1 dự án, cho 1 tháng.
  function getCommissions(filters) {
    filters = filters || {};
    var list = getAll(STORAGE_KEYS.commissions);
    if (filters.projectId) list = list.filter(function (c) { return c.projectId === filters.projectId; });
    if (filters.memberId) list = list.filter(function (c) { return c.memberId === filters.memberId; });
    if (filters.month) list = list.filter(function (c) { return c.month === filters.month; });
    return list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function createCommission(data, user) {
    if (!canManageNotifications(user)) return null;
    var created = add(STORAGE_KEYS.commissions, data);
    syncToGSheets('commissions', 'add', created);
    return created;
  }

  function updateCommission(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.commissions, id, updates);
    if (updated) syncToGSheets('commissions', 'update', updates, id);
    return updated;
  }

  function deleteCommission(id, user) {
    if (!canManageNotifications(user)) return null;
    var result = remove(STORAGE_KEYS.commissions, id);
    syncToGSheets('commissions', 'delete', {}, id);
    return result;
  }

  function getMemberCommissionTotal(memberId, month) {
    return getCommissions({ memberId: memberId, month: month }).reduce(function (sum, c) {
      return sum + (Number(c.amount) || 0);
    }, 0);
  }

  // Bảng giá dịch vụ — danh mục đơn giá dùng chung để soạn báo giá cho
  // khách (pricing.html). Admin/quản lý quản lý danh mục, ai cũng xem được.
  function getPriceCatalog() {
    return getAll(STORAGE_KEYS.priceCatalog).sort(function (a, b) {
      return (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || '');
    });
  }

  function createPriceCatalogItem(data, user) {
    if (!canManageNotifications(user)) return null;
    var created = add(STORAGE_KEYS.priceCatalog, data);
    syncToGSheets('priceCatalog', 'add', created);
    return created;
  }

  function updatePriceCatalogItem(id, updates, user) {
    if (!canManageNotifications(user)) return null;
    var updated = update(STORAGE_KEYS.priceCatalog, id, updates);
    if (updated) syncToGSheets('priceCatalog', 'update', updates, id);
    return updated;
  }

  function deletePriceCatalogItem(id, user) {
    if (!canManageNotifications(user)) return null;
    var result = remove(STORAGE_KEYS.priceCatalog, id);
    syncToGSheets('priceCatalog', 'delete', {}, id);
    return result;
  }

  // Tính toán chiếu sáng (lighting.html) — nhóm sheet TTCS-. 3 sheet danh mục
  // (tiêu chuẩn TCVN, danh mục đèn, hệ số U/K) chỉ đọc từ web, quản lý sửa
  // thẳng trên Sheet; trang lighting.js có bản nhúng sẵn làm dự phòng khi Sheet
  // trống/offline. Phương án đã lưu (TTCS-Phương án) thì ghi từ web.
  // Ô 'active'/'visible' trên Sheet có thể về dạng chữ "FALSE"/"false".
  function lightingOff_(v) { return v === false || String(v).toLowerCase() === 'false'; }

  function loadLightingData(callback) {
    var keys = ['lightingStandards', 'lightingLamps', 'lightingFactors', 'lightingPlans'];
    var out = {}, left = keys.length;
    keys.forEach(function (k) {
      getFromGSheets(k, function (items) {
        out[k] = items || [];
        // Chỉ ghi đè cache khi server có dữ liệu — tránh xoá cache bằng kết quả rỗng do lỗi mạng
        if (out[k].length) localStorage.setItem(STORAGE_KEYS[k], JSON.stringify(out[k]));
        if (--left === 0 && callback) callback(out);
      });
    });
  }

  function getLightingStandards() { return getAll(STORAGE_KEYS.lightingStandards); }
  function getLightingLamps() {
    return getAll(STORAGE_KEYS.lightingLamps).filter(function (l) { return !lightingOff_(l.active); });
  }
  function getLightingFactors() { return getAll(STORAGE_KEYS.lightingFactors); }
  function getLightingPlans() {
    return getAll(STORAGE_KEYS.lightingPlans).filter(function (p) { return !lightingOff_(p.visible); })
      .sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
  }
  function saveLightingPlan(data, user) {
    if (!user) return null;
    var now = new Date().toISOString();
    data.visible = true; data.createdBy = user.id; data.createdAt = now; data.updatedAt = now;
    var created = add(STORAGE_KEYS.lightingPlans, data);
    syncToGSheets('lightingPlans', 'add', created);
    return created;
  }
  // Ẩn phương án (giữ dòng trên Sheet, chỉ tắt cột Hiển thị) — chỉ người tạo hoặc quản lý
  function hideLightingPlan(id, user) {
    if (!user) return null;
    var cur = getAll(STORAGE_KEYS.lightingPlans).filter(function (p) { return p.id === id; })[0];
    if (!cur || (cur.createdBy !== user.id && !canManageNotifications(user))) return null;
    var upd = { visible: false, updatedAt: new Date().toISOString() };
    var updated = update(STORAGE_KEYS.lightingPlans, id, upd);
    if (updated) syncToGSheets('lightingPlans', 'update', upd, id);
    return updated;
  }

  // Sổ tài chính công ty — 1 sổ giao dịch chung cho mọi khoản tiền của công
  // ty (doanh thu/chi phí/vay nợ/trả nợ/thưởng/phạt/tiền ứ đọng/chưa giải
  // ngân...), CEO-only cả đọc và ghi (finance.html tự chặn trước khi gọi
  // các hàm này, nhưng vẫn kiểm tra lại ở đây cho chắc).
  function getFinanceEntries(filters) {
    filters = filters || {};
    var list = getAll(STORAGE_KEYS.financeEntries);
    if (filters.type) list = list.filter(function (e) { return e.type === filters.type; });
    if (filters.month) list = list.filter(function (e) { return e.month === filters.month; });
    return list.sort(function (a, b) { return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0); });
  }

  function createFinanceEntry(data, user) {
    if (!canManageFinance(user)) return null;
    data.createdBy = user.id;
    var created = add(STORAGE_KEYS.financeEntries, data);
    syncToGSheets('financeEntries', 'add', created);
    return created;
  }

  function updateFinanceEntry(id, updates, user) {
    if (!canManageFinance(user)) return null;
    var updated = update(STORAGE_KEYS.financeEntries, id, updates);
    if (updated) syncToGSheets('financeEntries', 'update', updates, id);
    return updated;
  }

  function deleteFinanceEntry(id, user) {
    if (!canManageFinance(user)) return null;
    var result = remove(STORAGE_KEYS.financeEntries, id);
    syncToGSheets('financeEntries', 'delete', {}, id);
    return result;
  }

  // Công nợ phải thu — khoản đã báo giá/xuất hoá đơn cho khách nhưng chưa
  // thu tiền thật. Khi đánh dấu 'paid', UI (finance.html) tự tạo thêm 1
  // dòng `revenue` bên financeEntries — 2 sheet này không tự động đồng bộ
  // 2 chiều trong tầng dữ liệu, để tránh 1 khoản thu bị đếm 2 lần nếu tự
  // ý sửa tay trên Sheet.
  function getReceivables(filters) {
    filters = filters || {};
    var list = getAll(STORAGE_KEYS.receivables);
    if (filters.status) list = list.filter(function (r) { return r.status === filters.status; });
    return list.sort(function (a, b) { return new Date(a.dueDate || 0) - new Date(b.dueDate || 0); });
  }

  function createReceivable(data, user) {
    if (!canManageFinance(user)) return null;
    data.status = data.status || 'unpaid';
    data.createdBy = user.id;
    var created = add(STORAGE_KEYS.receivables, data);
    syncToGSheets('receivables', 'add', created);
    return created;
  }

  function updateReceivable(id, updates, user) {
    if (!canManageFinance(user)) return null;
    var updated = update(STORAGE_KEYS.receivables, id, updates);
    if (updated) syncToGSheets('receivables', 'update', updates, id);
    return updated;
  }

  function deleteReceivable(id, user) {
    if (!canManageFinance(user)) return null;
    var result = remove(STORAGE_KEYS.receivables, id);
    syncToGSheets('receivables', 'delete', {}, id);
    return result;
  }

  // Ảnh chụp bảng cân đối kế toán theo năm — các khoản mục (Tài sản ngắn
  // hạn, Hàng tồn kho, Vốn chủ sở hữu...) không tồn tại trong sổ giao dịch
  // financeEntries (vốn chỉ ghi nhận dòng tiền ra/vào), nên CEO nhập tay 1
  // lần/năm để "Sổ tay CFO" có đủ dữ liệu tính các nhóm chỉ số tài chính
  // chuẩn (thanh khoản, đòn bẩy, Altman Z-score...). Khoá theo `year`, mỗi
  // năm chỉ có tối đa 1 bản ghi (upsert).
  function getBsSnapshots() {
    return getAll(STORAGE_KEYS.bsSnapshots);
  }

  function getBsSnapshotByYear(year) {
    return getBsSnapshots().find(function (s) { return String(s.year) === String(year); }) || null;
  }

  function upsertBsSnapshot(year, data, user) {
    if (!canManageFinance(user)) return null;
    var existing = getBsSnapshotByYear(year);
    data.year = String(year);
    data.createdBy = user.id;
    if (existing) {
      var updated = update(STORAGE_KEYS.bsSnapshots, existing.id, data);
      if (updated) syncToGSheets('bsSnapshots', 'update', data, existing.id);
      return updated;
    }
    var created = add(STORAGE_KEYS.bsSnapshots, data);
    syncToGSheets('bsSnapshots', 'add', created);
    return created;
  }

  function deleteBsSnapshot(id, user) {
    if (!canManageFinance(user)) return null;
    var result = remove(STORAGE_KEYS.bsSnapshots, id);
    syncToGSheets('bsSnapshots', 'delete', {}, id);
    return result;
  }

  // Đơn hàng & hoá đơn — CỐ Ý MỞ CHO MỌI THÀNH VIÊN (không gate bằng
  // canManageFinance như financeEntries): bất kỳ ai đã đăng nhập cũng tạo
  // được đơn hàng cho khách của mình. Chỉ người tạo hoặc admin/manager mới
  // sửa/xoá được đơn của người khác. Khi đánh dấu "paid", tự tạo 1 dòng
  // financeEntries loại `revenue` liên kết qua `linkedFinanceEntryId` —
  // bước ghi này KHÔNG qua canManageFinance vì đây là hành động tự động do
  // chính nhân viên tạo đơn kích hoạt, không phải thao tác trực tiếp trên
  // Sổ tài chính (trang finance.html vẫn khoá xem/sửa cho CEO như cũ).
  function canEditOrder(order, user) {
    return !!user && (order.createdBy === user.id || user.roleLevel === 'admin' || user.roleLevel === 'manager');
  }

  function nextOrderNumber() {
    var year = new Date().getFullYear();
    var countThisYear = getAll(STORAGE_KEYS.orders).filter(function (o) {
      return (o.orderNumber || '').indexOf('-' + year) !== -1;
    }).length;
    return 'DH' + String(countThisYear + 1).padStart(4, '0') + '-' + year;
  }

  function getOrders(filters) {
    filters = filters || {};
    var list = getAll(STORAGE_KEYS.orders);
    if (filters.status) list = list.filter(function (o) { return o.status === filters.status; });
    if (filters.createdBy) list = list.filter(function (o) { return o.createdBy === filters.createdBy; });
    return list.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
  }

  function createOrder(data, user) {
    if (!user) return null;
    data.orderNumber = data.orderNumber || nextOrderNumber();
    data.status = data.status || 'draft';
    data.createdBy = user.id;
    var created = add(STORAGE_KEYS.orders, data);
    syncToGSheets('orders', 'add', created);
    return created;
  }

  function updateOrder(id, updates, user) {
    var order = getById(STORAGE_KEYS.orders, id);
    if (!order || !canEditOrder(order, user)) return null;
    var updated = update(STORAGE_KEYS.orders, id, updates);
    if (updated) syncToGSheets('orders', 'update', updates, id);
    return updated;
  }

  function deleteOrder(id, user) {
    var order = getById(STORAGE_KEYS.orders, id);
    if (!order || !canEditOrder(order, user)) return null;
    var result = remove(STORAGE_KEYS.orders, id);
    syncToGSheets('orders', 'delete', {}, id);
    return result;
  }

  // Đánh dấu đơn hàng đã thanh toán -> tự tạo đúng 1 lần 1 khoản doanh thu
  // tương ứng trong Sổ tài chính (idempotent nhờ `linkedFinanceEntryId`).
  function markOrderPaid(id, user) {
    if (!user) return null;
    var order = getById(STORAGE_KEYS.orders, id);
    if (!order) return null;
    if (order.linkedFinanceEntryId) {
      return updateOrder(id, { status: 'paid' }, user);
    }
    var today = todayStr();
    var financeData = {
      type: 'revenue',
      category: 'Đơn hàng',
      description: 'Đơn hàng ' + (order.orderNumber || order.id) + ' — ' + (order.clientName || 'Khách lẻ'),
      amount: order.totalAmount,
      date: today,
      month: today.slice(0, 7)
    };
    var createdEntry = add(STORAGE_KEYS.financeEntries, financeData);
    syncToGSheets('financeEntries', 'add', createdEntry);
    var updated = update(STORAGE_KEYS.orders, id, { status: 'paid', linkedFinanceEntryId: createdEntry.id });
    if (updated) syncToGSheets('orders', 'update', { status: 'paid', linkedFinanceEntryId: createdEntry.id }, id);
    return updated;
  }

  // Phiếu lương — nhân viên tự tạo cho chính mình mỗi tháng, CEO/quản lý duyệt.
  var OT_MULTIPLIER = 1.5;
  var STANDARD_MONTHLY_HOURS = 208; // 26 công x 8 giờ/ngày — quy ước tính đơn giá giờ OT

  function getPayslips(filters) {
    filters = filters || {};
    var list = getAll(STORAGE_KEYS.payslips);
    if (filters.memberId) list = list.filter(function (p) { return p.memberId === filters.memberId; });
    if (filters.month) list = list.filter(function (p) { return p.month === filters.month; });
    if (filters.status) list = list.filter(function (p) { return p.status === filters.status; });
    return list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function getPayslip(id) {
    return getById(STORAGE_KEYS.payslips, id);
  }

  function createPayslip(payslip) {
    payslip.status = 'pending';
    var created = add(STORAGE_KEYS.payslips, payslip);
    syncToGSheets('payslips', 'add', created);
    return created;
  }

  function updatePayslip(id, updates) {
    var updated = update(STORAGE_KEYS.payslips, id, updates);
    if (updated) syncToGSheets('payslips', 'update', updates, id);
    return updated;
  }

  function approvePayslip(id, user) {
    if (!canManageNotifications(user)) return null;
    return updatePayslip(id, { status: 'approved', reviewedAt: new Date().toISOString(), reviewerId: user.id });
  }

  function rejectPayslip(id, user) {
    if (!canManageNotifications(user)) return null;
    return updatePayslip(id, { status: 'rejected', reviewedAt: new Date().toISOString(), reviewerId: user.id });
  }

  // Chỉ chủ phiếu (hoặc quản lý) xoá được, và chỉ khi còn ở trạng thái chờ duyệt.
  function deletePayslip(id, user) {
    var slip = getPayslip(id);
    if (!slip || !user) return null;
    var isOwner = slip.memberId === user.id;
    if (!isOwner && !canManageNotifications(user)) return null;
    if (slip.status !== 'pending') return null;
    var result = remove(STORAGE_KEYS.payslips, id);
    syncToGSheets('payslips', 'delete', {}, id);
    return result;
  }

  // Statistics
  function getStats() {
    var tasks = getAll(STORAGE_KEYS.tasks);
    var projects = getAll(STORAGE_KEYS.projects);
    var members = getAll(STORAGE_KEYS.members);

    var completedTasks = tasks.filter(function(t) { return t.status === 'completed'; }).length;
    var pendingTasks = tasks.filter(function(t) { return t.status === 'pending'; }).length;
    var inProgressTasks = tasks.filter(function(t) { return t.status === 'in-progress'; }).length;

    var today = todayStr();
    var dueToday = tasks.filter(function(t) {
      if (!t.deadline) return false;
      return t.deadline.startsWith(today) && t.status !== 'completed';
    }).length;

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(function(p) { return p.status !== 'completed'; }).length,
      completedTasks: completedTasks,
      pendingTasks: pendingTasks,
      inProgressTasks: inProgressTasks,
      totalTasks: tasks.length,
      dueToday: dueToday,
      totalMembers: members.length,
      onlineMembers: 3
    };
  }

  // Initialize on load
  initData();

  // Public API
  return {
    // Làm mới dữ liệu ngầm (không reload trang) — gọi định kỳ từ offline.js.
    // Chỉ ghi đè localStorage, KHÔNG tự vẽ lại UI — trang nào cần cập nhật
    // ngay khi có dữ liệu mới tự lắng nghe sự kiện 'hiconique:data-refreshed'
    // trên window (bắn ra ở offline.js sau khi gọi xong).
    silentRefresh: refreshFromGSheets,

    // User
    getCurrentUser: getCurrentUser,
    getActiveMembers: getActiveMembers,

    // Phân tầng Cấp bậc (danh mục cố định, xem LEVELS ở trên)
    getLevels: getLevels,
    getLevelByCode: getLevelByCode,
    // Bộ phận/Phòng ban (danh mục cố định, xem DIVISIONS/DEPARTMENTS ở trên)
    getDivisions: getDivisions,
    getDivisionByCode: getDivisionByCode,
    getDepartments: getDepartments,
    getDepartmentByCode: getDepartmentByCode,
    getDepartmentsByDivision: getDepartmentsByDivision,

    // Projects
    getProjects: getProjects,
    getProject: getProject,
    createProject: createProject,
    updateProject: updateProject,
    deleteProject: deleteProject,
    isCompletedThisWeek: isCompletedThisWeek,
    isVisibleNow: isVisibleNow,

    // Tasks
    getTasks: getTasks,
    getTask: getTask,
    createTask: createTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    toggleTaskStatus: toggleTaskStatus,
    addDailyProgress: addDailyProgress,
    getTodayProgress: getTodayProgress,
    getTodayProgressCap: getTodayProgressCap,
    forceResyncMyTasks: forceResyncMyTasks,
    syncAllProjectProgress: syncAllProjectProgress,
    generateDailyTasks: generateDailyTasks,
    confirmTaskAssignment: confirmTaskAssignment,
    submitTaskForReview: submitTaskForReview,
    approveTaskReview: approveTaskReview,
    rejectTaskReview: rejectTaskReview,
    canReviewTasks: canReviewTasks,

    // Members
    getMembers: getMembers,
    getMember: getMember,
    getTaskAssignees: getTaskAssignees,
    updateMember: updateMember,
    getMemberDeviceIds: getMemberDeviceIds,
    getMemberDevices: getMemberDevices,
    registerMemberDevice: registerMemberDevice,
    removeMemberDevice: removeMemberDevice,
    getPendingDeviceRegistrations: getPendingDeviceRegistrations,
    approveMemberDevice: approveMemberDevice,
    rejectMemberDevice: rejectMemberDevice,
    getAllMemberDeviceRows: getAllMemberDeviceRows,
    adminRegisterMemberDevice: adminRegisterMemberDevice,
    adminRenameMemberDevice: adminRenameMemberDevice,
    adminResetMemberDevices: adminResetMemberDevices,
    canManageMembers: canManageMembers,
    canTerminateMembers: canTerminateMembers,
    updateMemberStatus: updateMemberStatus,
    isFounder: isFounder,
    updateMemberLevel: updateMemberLevel,

    // Proposals
    getProposals: getProposals,
    getProposal: getProposal,
    createProposal: createProposal,
    updateProposal: updateProposal,
    approveProposal: approveProposal,
    rejectProposal: rejectProposal,

    // Stats
    getStats: getStats,

    // Timesheet
    getTimesheetEntries: getTimesheetEntries,
    formatShortDate: formatShortDate,
    addTimesheetEntry: addTimesheetEntry,
    updateTimesheetEntry: updateTimesheetEntry,
    getAttendanceLocations: getAttendanceLocations,
    addAttendanceLocation: addAttendanceLocation,
    updateAttendanceLocation: updateAttendanceLocation,
    deleteAttendanceLocation: deleteAttendanceLocation,
    getWorkSchedule: getWorkSchedule,
    saveWorkSchedule: saveWorkSchedule,
    shiftCheckIn: shiftCheckIn,
    shiftCheckOut: shiftCheckOut,
    isOtDay: isOtDay,

    // Notifications
    getNotifications: getNotifications,
    getNotificationRules: getNotificationRules,
    createNotification: createNotification,
    updateNotification: updateNotification,
    deleteNotification: deleteNotification,
    getComputedAlerts: getComputedAlerts,
    canManageNotifications: canManageNotifications,
    canManageRecurringRules: canManageRecurringRules,
    markNotificationRead: markNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    isNotificationRead: isNotificationRead,
    dismissAllNotifications: dismissAllNotifications,
    isNotificationDismissed: isNotificationDismissed,

    // Notice board
    getNotices: getNotices,
    createNotice: createNotice,
    updateNotice: updateNotice,
    deleteNotice: deleteNotice,

    // Wiki documents
    getDocuments: getDocuments,
    createDocument: createDocument,
    updateDocument: updateDocument,
    deleteDocument: deleteDocument,
    getDocCategories: getDocCategories,
    addDocCategory: addDocCategory,
    deleteDocCategory: deleteDocCategory,
    getNextDocCode: getNextDocCode,

    // Lương cơ bản (Members.baseSalary)
    setMemberBaseSalary: setMemberBaseSalary,

    // % Hoa hồng dự án
    getCommissionRates: getCommissionRates,
    getCommissionRateFor: getCommissionRateFor,
    saveCommissionRate: saveCommissionRate,
    getCommissions: getCommissions,
    createCommission: createCommission,
    updateCommission: updateCommission,
    deleteCommission: deleteCommission,
    getMemberCommissionTotal: getMemberCommissionTotal,

    // Bảng giá dịch vụ
    getPriceCatalog: getPriceCatalog,
    loadLightingData: loadLightingData,
    getLightingStandards: getLightingStandards,
    getLightingLamps: getLightingLamps,
    getLightingFactors: getLightingFactors,
    getLightingPlans: getLightingPlans,
    saveLightingPlan: saveLightingPlan,
    hideLightingPlan: hideLightingPlan,
    createPriceCatalogItem: createPriceCatalogItem,
    updatePriceCatalogItem: updatePriceCatalogItem,
    deletePriceCatalogItem: deletePriceCatalogItem,

    // Tài chính công ty (CEO-only)
    canManageFinance: canManageFinance,
    getFinanceEntries: getFinanceEntries,
    createFinanceEntry: createFinanceEntry,
    updateFinanceEntry: updateFinanceEntry,
    deleteFinanceEntry: deleteFinanceEntry,
    getReceivables: getReceivables,
    createReceivable: createReceivable,
    updateReceivable: updateReceivable,
    deleteReceivable: deleteReceivable,

    // Sổ tay CFO — ảnh chụp bảng cân đối kế toán theo năm
    getBsSnapshots: getBsSnapshots,
    getBsSnapshotByYear: getBsSnapshotByYear,
    upsertBsSnapshot: upsertBsSnapshot,
    deleteBsSnapshot: deleteBsSnapshot,

    // Đơn hàng & hoá đơn — mọi thành viên đều tạo được
    getOrders: getOrders,
    createOrder: createOrder,
    updateOrder: updateOrder,
    deleteOrder: deleteOrder,
    markOrderPaid: markOrderPaid,
    canEditOrder: canEditOrder,

    // Phiếu lương
    getMonthlyTimesheetStats: getMonthlyTimesheetStats,
    getPayslips: getPayslips,
    getPayslip: getPayslip,
    createPayslip: createPayslip,
    updatePayslip: updatePayslip,
    approvePayslip: approvePayslip,
    rejectPayslip: rejectPayslip,
    deletePayslip: deletePayslip,
    OT_MULTIPLIER: OT_MULTIPLIER,
    STANDARD_MONTHLY_HOURS: STANDARD_MONTHLY_HOURS,

    // Storage
    STORAGE_KEYS: STORAGE_KEYS,

    // Sync helpers
    refreshFromGSheets: refreshFromGSheets,
    isUsingGSheets: isUsingGSheets
  };
})();

// Export globally so other pages can use TaskManager.*
window.TaskManager = TaskManager;

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskManager;
}
