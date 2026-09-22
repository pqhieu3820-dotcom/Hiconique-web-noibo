const SPREADSHEET_ID = '1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY';

// Tab names on the live Sheet are Vietnamese (renamed by hand). Code below
// always reads/writes through FIELD_MAP so client JS keeps using English
// keys (m.title, m.status...) no matter what the Sheet's header text says.
// Tên sheet có tiền tố nhóm/trang (2026-09-15, theo yêu cầu gom cho dễ quản
// lý màu tab) — NS- nhân sự, TLCC- tiền lương chấm công, DA- dự án, BIM-,
// TC- tài chính, TT- truyền thông. Đổi tên tab thật SAU (renameRealSheets())
// phải khớp CHÍNH XÁC các giá trị dưới đây, và phải deploy bản mới ngay sau
// khi đổi tên (xem GHI_CHU_DU_AN.md) — lệch nhau 1 bước là findSheet() trả
// về null, các hàm write sẽ tạo nhầm sheet rỗng trùng tên cũ.
const SHEETS = {
  projects: 'DA-Dự án',
  tasks: 'DA-Công việc',
  members: 'NS-Thành viên',
  proposals: 'DA-Đề xuất',
  timesheet: 'TLCC-Chấm công',
  // Cạnh sheet Chấm công (2026-09-15) — danh sách địa điểm GPS + IP mạng
  // hợp lệ để chấm công, thêm/sửa/xoá thoải mái trên Sheet, không cần đụng
  // code hay redeploy. Xem checkGeoStatus()/checkIpStatus() trong timesheet.html.
  attendanceLocations: 'TLCC-Địa điểm chấm công',
  workSchedule: 'TLCC-Giờ làm việc',
  notifications: 'TT-Thông báo',
  notices: 'TT-Bảng tin',
  documents: 'TT-Tài liệu',
  payslips: 'TLCC-Phiếu lương',
  commissions: 'TLCC-Hoa hồng dự án',
  commissionRates: 'TLCC-Mức hoa hồng',
  priceCatalog: 'TC-Bảng giá dịch vụ',
  financeEntries: 'TC-Tài chính công ty',
  receivables: 'TC-Công nợ khách hàng',
  bsSnapshots: 'TC-Chỉ số cân đối kế toán',
  orders: 'TC-Đơn hàng',
  // 6 sheet mới (2026-09-09) — công cụ theo dự án đi kèm database đơn giá 34
  // tỉnh, xem GHI_CHU_DU_AN.md. Nhóm DA- nên không đụng 46 sheet tham khảo
  // (đã đổi tiền tố "DGXD-" — VD "DGXD-Dòng tiền" khác hẳn "DA-Dòng tiền").
  contractorComparisons: 'DA-So sánh nhà thầu',
  cashFlowPlans: 'DA-Dòng tiền',
  changeOrders: 'DA-Phát sinh',
  scheduleItems: 'DA-Tiến độ',
  acceptanceChecks: 'DA-Nghiệm thu',
  projectDocuments: 'DA-Hồ sơ công trình',
  // HICON-BIM (2026-09-09) — danh mục Sản phẩm/Vật liệu/Nhà cung cấp dùng
  // chung toàn tổ chức, và Issue/BOQ theo dự án.
  bimProducts: 'BIM-Sản phẩm',
  bimMaterials: 'BIM-Vật liệu',
  bimSuppliers: 'BIM-Nhà cung cấp',
  bimIssues: 'BIM-Issue',
  bimBoqItems: 'BIM-BOQ'
};

// [Vietnamese header on the Sheet, internal English key used by client JS].
// Order here is just the seed order for a brand-new empty sheet — reads/
// writes always follow whatever's ACTUALLY on the Sheet's header row (see
// getHeaders), matched against this table by the Vietnamese text. A column
// added by hand that isn't in this list still round-trips fine — it just
// keeps its Vietnamese name as the object key instead of getting an English
// alias, so existing client code (which never looks for it) is unaffected.
const FIELD_MAP = {
  members: [
    ['Mã NV', 'id'], ['Họ tên', 'name'], ['Chức vụ', 'role'],
    // 2026-09-16: "Cấp bậc" đổi từ 3 mức phẳng (CEO/Quản lý/Nhân viên) sang
    // PHÂN TẦNG 5 mức (Founder/CEO/Giám đốc Bộ phận/Quản lý/Nhân viên) — xem
    // LEVELS/LEVEL_TO_ROLELEVEL phía dưới. Cột Sheet đổi tên KEY nội bộ từ
    // 'roleLevel' sang 'level' (giá trị mới: founder/ceo/dept_director/
    // manager/member) — 'roleLevel' (admin/manager/member, 3 mức CŨ) giờ là
    // field TỰ SUY RA (không lưu trên Sheet nữa) trong getAllData(), để toàn
    // bộ ~25 chỗ check `roleLevel === 'admin'/'manager'` rải khắp client
    // KHÔNG phải sửa — founder/ceo/dept_director đều suy ra 'admin'.
    ['Cấp bậc', 'level'],
    ['Giới tính', 'gender'], ['Mail', 'email'], ['Mật khẩu', 'password'], ['Ngày sinh', 'dob'],
    ['SĐT', 'phone'], ['CCCD', 'cccd'], ['Quê quán', 'hometown'], ['Số tài khoản ngân hàng', 'bankAccount'],
    ['Ngân hàng thụ hưởng', 'bank'], ['Màu sắc đại diện', 'color'], ['Tên viết tắt đại diện', 'avatar'],
    ['Làm việc từ', 'createdAt'], ['Lương cơ bản', 'baseSalary'], ['Trạng thái', 'status'],
    // 2026-09-11: 3 cột này ban đầu thêm KHÔNG qua FIELD_MAP (chỉ cần header
    // tiếng Anh khớp key, xem cơ chế "cột không map" ở getAllData/updateData) —
    // người dùng vừa tự đổi header sang tiếng Việt trên Sheet nên PHẢI khai báo
    // ở đây từ giờ, không thì round-trip vỡ (header không khớp key tiếng Anh
    // nữa, addData/updateData sẽ không tìm thấy cột để ghi).
    ['Lần hoạt động cuối', 'lastActiveAt'], ['Màu nền trình duyệt', 'theme'],
    // 2026-09-16: tách cột "Thiết bị đăng kí để chấm công" (1 cột gộp cả 2
    // thiết bị dạng "id1::tên1::trạng1,id2::tên2::trạng2") thành 2 cột riêng
    // "Thiết bị 1"/"Thiết bị 2" (mỗi cột 1 thiết bị "id::tên::trạng") — theo
    // yêu cầu người dùng, dễ nhìn/lọc trực tiếp trên Sheet hơn. Xem
    // splitDeviceColumns() (đã chạy 1 lần, xoá khỏi code) và task-data.js
    // parseDeviceIds()/stringifyDeviceEntries().
    ['Thiết bị 1', 'device1'],
    // 2026-09-19: cột dropdown riêng để XEM/SỬA TRẠNG THÁI TRỰC TIẾP trên
    // Sheet (yêu cầu người dùng) — mirror của trạng thái đã gộp sẵn trong
    // "Thiết bị 1"/"Thiết bị 2" (chuỗi "id::tên::trạng"), KHÔNG thay thế
    // chuỗi đó (id/tên vẫn chỉ sống trong chuỗi). Xem applyDeviceStatusDropdowns()
    // và ghi chú ở VALUE_MAP phía trên.
    ['Trạng thái Thiết bị 1', 'device1Status'],
    ['Thiết bị 2', 'device2'],
    ['Trạng thái Thiết bị 2', 'device2Status'],
    // 2026-09-16: thêm phòng ban — 2 cột riêng (tên đầy đủ + mã 3 ký tự
    // dùng để đánh số văn bản, xem TaskManager.getDepartments() trong
    // task-data.js — danh mục CỐ ĐỊNH theo SOP nội bộ, không tự thêm/sửa).
    ['Phòng ban', 'department'], ['Mã phòng ban', 'departmentCode'],
    // 2026-09-16 (b): thêm Bộ phận — cấp CHA của Phòng ban (4 khối theo SOP,
    // xem TaskManager.getDivisions() trong task-data.js). Quan hệ cha/con:
    // mỗi Phòng ban thuộc đúng 1 Bộ phận (department.divisionCode).
    ['Bộ phận', 'division'], ['Mã bộ phận', 'divisionCode'],
    // 2026-09-16 (c): mốc thời điểm bị Từ chối — nguồn xác định 48h đếm ngược
    // trước khi bị XOÁ VĨNH VIỄN (xem stampMemberRejection()/
    // deleteExpiredRejectedMembers() phía dưới). "Sẽ xoá lúc"/"Đếm ngược" là 2
    // cột CHỈ để người xem trực tiếp trên Sheet biết, không cần map field vào
    // đây — client tự tính deleteAt = rejectedAt + 48h (xem portal.js), không
    // đọc lại 2 cột đó qua API.
    ['Thời điểm từ chối', 'rejectedAt']
  ],
  // 2026-09-09: "Loại dự án" đổi nghĩa thành LOẠI CÔNG TRÌNH thật (Nhà phố,
  // Biệt thự, Căn hộ chung cư...), giá trị cũ (Thiết kế/Thi công/Nội thất...)
  // dời sang cột mới "Hạng mục" — field key bên trong ĐỔI CHỖ theo đúng nghĩa
  // mới (type = loại công trình, category = hạng mục công việc) để code chỗ
  // khác (vd projectType() lọc theo hạng mục) chỉ cần đọc field mới category.
  projects: [
    ['Mã DA', 'id'], ['Tên dự án', 'name'], ['Hạng mục', 'category'], ['Tiến độ', 'progress'],
    ['Trạng thái', 'status'], ['Thành viên tham gia', 'members'], ['Màu sắc đại diện', 'color'],
    ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt'], ['Ngân sách', 'budget'],
    ['Khách hàng', 'client'], ['Nhà đầu tư', 'investor'], ['Địa điểm', 'location'],
    ['Ngày bắt đầu', 'startDate'], ['Ngày kết thúc', 'endDate'], ['Mức độ ưu tiên', 'priority'],
    ['Mô tả', 'description'], ['Loại dự án', 'type'],
    // 2026-09-09: thêm Tỉnh/Thành để tab "Đơn giá theo tỉnh" bên pricing.html
    // lọc nhanh theo dự án thay vì phải tự chọn lại tỉnh mỗi lần.
    ['Tỉnh/Thành', 'province'],
    // 2026-09-10: mã viết tắt dự án do người dùng tự đặt (VD "HMHOUSE") — dùng
    // làm avatar đại diện dự án (thay vì tự lấy chữ đầu tên) và làm phần "Mã dự
    // án" trong số hồ sơ/hợp đồng tự sinh. Đặt tên field là shortCode để không
    // đụng field 'id' (đã map với cột "Mã DA" — mã hệ thống, không phải mã này).
    ['Mã dự án viết tắt', 'shortCode'],
    // 2026-09-11: mốc thời điểm chuyển sang 'completed' — dùng để cột "Hoàn
    // thành" trên Kanban tự ẩn việc/dự án đã xong QUA TUẦN đó (xem
    // TaskManager.isCompletedThisWeek() trong task-data.js). Tự set/xoá ở
    // updateProject()/updateTask(), không phải người dùng tự nhập tay.
    ['Ngày hoàn thành', 'completedAt'],
    // 2026-09-22: cờ ẨN HIỂN THỊ (không xoá dữ liệu) — bấm "Xoá" trên web giờ
    // chỉ set cột này = FALSE thay vì xoá thật dòng Sheet (xem deleteProject()
    // trong task-data.js). Dự án Hoàn thành cũng tự set FALSE khi qua khỏi
    // tháng hoàn thành (autoHideExpiredCompleted() trong task-data.js) để
    // Kanban không dài vô tận — dữ liệu vẫn còn nguyên trên Sheet, thống kê
    // năm/quý vẫn đọc được (đọc thẳng getProjects() không lọc cột này).
    ['Hiển thị', 'visible']
  ],
  tasks: [
    ['Mã CV', 'id'], ['Tên công việc', 'title'], ['Mô tả', 'description'], ['Mã dự án', 'projectId'],
    ['Mã người phụ trách', 'assigneeIds'], ['Mức độ ưu tiên', 'priority'], ['Trạng thái', 'status'],
    ['Ngày bắt đầu', 'startDate'], ['Ngày tới hạn deadline', 'deadline'], ['Người tạo', 'createdBy'],
    ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt'], ['Tiến độ', 'progress'],
    ['Update tiến độ việc hàng ngày', 'dailyTasks'], ['Ngày hoàn thành', 'completedAt'],
    // 2026-09-21: quy trình duyệt việc mới — Chờ xử lý -> Đang làm (nhân viên
    // tự xác nhận nhận việc, hoặc tự tạo cho chính mình thì vào thẳng đây) ->
    // Chờ duyệt (đủ 100% tiến độ, bấm "Hoàn thành") -> Quản lý/CEO duyệt
    // (Hoàn thành) hoặc từ chối (quay lại Đang làm, giữ nguyên deadline, ghi
    // lý do vào cột này để nhân viên biết cần sửa gì). Xem task-data.js
    // submitTaskForReview()/approveTaskReview()/rejectTaskReview().
    ['Ghi chú duyệt', 'reviewNote'],
    // 2026-09-22: cờ ẨN HIỂN THỊ — xem chú thích y hệt ở FIELD_MAP.projects.
    ['Hiển thị', 'visible']
  ],
  proposals: [
    ['Mã ĐX', 'id'], ['Tiêu đề', 'title'], ['Nội dung', 'description'], ['Loại đề xuất', 'type'],
    ['Trạng thái', 'status'], ['Người đề xuất', 'requesterId'], ['Người phê duyệt', 'reviewerId'],
    ['Số tiền', 'amount'], ['Ngày tạo', 'createdAt'], ['Ngày duyệt', 'reviewedAt']
  ],
  timesheet: [
    ['Mã CC', 'id'], ['Mã thành viên', 'memberId'], ['Ngày', 'date'], ['Giờ checkin', 'checkinTime'],
    ['Giờ checkout', 'checkoutTime'], ['Tổng số giờ làm việc', 'totalHours'], ['Số giờ tăng ca', 'overtimeHours'],
    ['Trạng thái', 'status'], ['Ghi chú', 'note'], ['Vĩ độ checkin', 'checkinLat'], ['Kinh độ checkin', 'checkinLng'],
    ['Khoảng cách checkin', 'checkinDistance'], ['IP Checkin', 'checkinIp'], ['Trạng thái đạt vị trí', 'geoPass'],
    ['Trạng thái đạt IP', 'ipPass'], ['Số điều kiện đạt', 'verifyPassCount'], ['Trạng thái xác thực', 'verifyStatus'],
    // 2026-09-19: 2 cột này đã được client (checkIn() trong timesheet.html)
    // gán vào entry từ lâu nhưng CHƯA từng có trong FIELD_MAP nên bị rớt mất
    // khi ghi xuống Sheet (chỉ tồn tại tạm trong cache trình duyệt) — vá nốt.
    ['Mã thiết bị checkin', 'checkinDeviceId'], ['Trạng thái đạt thiết bị', 'devicePass'],
    // 2026-09-19: chấm công theo ca sáng/chiều (Setup thời gian làm việc) —
    // xem shiftCheckIn()/shiftCheckOut() trong task-data.js. checkinTime/
    // checkoutTime cũ vẫn được mirror từ morningCheckin/afternoonCheckout để
    // lịch + báo cáo tháng hiện có không cần sửa gì thêm.
    ['Giờ vào ca sáng', 'morningCheckin'], ['Giờ ra ca sáng', 'morningCheckout'],
    ['Giờ vào ca chiều', 'afternoonCheckin'], ['Giờ ra ca chiều', 'afternoonCheckout'],
    ['Đi muộn', 'isLate'], ['Về sớm', 'isEarly'], ['Lý do muộn/sớm', 'lateEarlyNote']
  ],
  attendanceLocations: [
    ['Mã', 'id'], ['Tên địa điểm / mạng', 'name'], ['Vĩ độ (lat)', 'lat'], ['Kinh độ (lng)', 'lng'],
    ['Bán kính (m)', 'radiusMeters'], ['Địa chỉ IP', 'ip'], ['Đang dùng', 'active'], ['Ghi chú', 'note'],
    // 2026-09-21: Văn phòng (mặc định, rỗng cũng coi là văn phòng — xem
    // client) yêu cầu đủ 3 điều kiện chấm công; Công trình chỉ yêu cầu GPS +
    // Thiết bị (bỏ Wifi vì công trình thường không có mạng nội bộ). Xem
    // applySiteRelaxation() trong timesheet.html.
    ['Loại địa điểm', 'locationType'],
    ['Ngày tạo', 'createdAt']
  ],
  // 2026-09-19: giờ làm việc chuẩn (ca sáng/chiều) — CHỈ 1 dòng duy nhất
  // (id cố định 'default', xem saveWorkSchedule()), dùng làm mốc tính đi
  // muộn/về sớm khi chấm công theo ca. Setup thời gian làm việc (timesheet.html).
  workSchedule: [
    ['Mã', 'id'], ['Giờ vào ca sáng', 'morningStart'], ['Giờ ra ca sáng', 'morningEnd'],
    ['Giờ vào ca chiều', 'afternoonStart'], ['Giờ ra ca chiều', 'afternoonEnd'],
    ['Thời gian cho phép muộn (phút)', 'lateGraceMinutes'], ['Ngày cập nhật', 'updatedAt']
  ],
  notifications: [
    ['Mã TB', 'id'], ['Tiêu đề', 'title'], ['Nội dung', 'message'], ['Loại', 'type'], ['Phạm vi', 'scope'],
    ['Định kỳ', 'recurring'], ['Quy tắc lặp', 'recurRule'], ['Trạng thái bật tắt', 'active'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  notices: [
    ['Mã TB', 'id'], ['Tiêu đề', 'title'], ['Nội dung', 'message'], ['Màu sắc', 'color'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  documents: [
    ['Mã TL', 'id'], ['Danh mục', 'category'], ['Tên tài liệu', 'name'], ['Đường liên kết', 'url'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  payslips: [
    ['Mã PL', 'id'], ['Mã thành viên', 'memberId'], ['Tháng', 'month'], ['Ngày công', 'workDays'],
    ['Tổng số giờ', 'totalHours'], ['Giờ OT tự tính', 'otHoursAuto'], ['Giờ OT nhập tay', 'otHoursManual'],
    ['Tổng giờ OT', 'otHours'], ['Hệ số giờ OT', 'otRate'], ['Tiền OT', 'otAmount'], ['Lương cơ bản', 'baseSalary'],
    ['Tiền hoa hồng', 'commissionAmount'], ['Thưởng khác', 'otherBonus'], ['Ghi chú thưởng', 'otherBonusNote'],
    ['Khấu trừ', 'deduction'], ['Ghi chú khấu trừ', 'deductionNote'], ['Thực lãnh', 'totalAmount'],
    ['Trạng thái', 'status'], ['Ghi chú', 'note'], ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'],
    ['Ngày cập nhật', 'updatedAt'], ['Ngày duyệt', 'reviewedAt'], ['Mã người duyệt', 'reviewerId']
  ],
  commissions: [
    ['Mã dòng', 'id'], ['Dự án', 'projectId'], ['Mã thành viên', 'memberId'], ['Giá trị dự án', 'projectValue'],
    ['Phần trăm', 'percent'], ['Số tiền', 'amount'], ['Tháng', 'month'], ['Ghi chú', 'note'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  commissionRates: [
    ['Mã dòng', 'id'], ['Cấp bậc', 'roleLevel'], ['Phần trăm', 'percent'], ['Ngày cập nhật', 'updatedAt']
  ],
  priceCatalog: [
    ['Mã BG', 'id'], ['Danh mục', 'category'], ['Tên dịch vụ', 'name'], ['Đơn vị tính', 'unit'],
    ['Đơn giá', 'unitPrice'], ['Ghi chú', 'note'], ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'],
    ['Ngày cập nhật', 'updatedAt']
  ],
  // Sổ tài chính công ty — CEO-only (xem mục checkFinanceAccess phía client
  // và canManageFinance trong task-data.js). Thiết kế dạng 1 sổ giao dịch
  // chung (type: revenue/expense/loan/repayment/bonus/penalty/idle/
  // undisbursed) thay vì 6-7 module CRUD riêng — dễ mở rộng thêm loại giao
  // dịch mới về sau mà không cần sửa schema, trang finance.html tự tổng hợp
  // thành các báo cáo (lãi/lỗ, dòng tiền, vay nợ...) từ đúng 1 nguồn dữ liệu.
  financeEntries: [
    ['Mã GD', 'id'], ['Loại', 'type'], ['Danh mục', 'category'], ['Mô tả', 'description'],
    ['Số tiền', 'amount'], ['Tháng', 'month'], ['Ngày', 'date'], ['Ghi chú', 'note'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  // Công nợ phải thu từ khách hàng (không phải giao dịch tiền mặt thật —
  // chỉ là khoản đã xuất hoá đơn/báo giá nhưng khách chưa trả). Tách riêng
  // khỏi financeEntries vì bản chất khác nhau: đây là "hứa trả", chỉ biến
  // thành `revenue` thật trong financeEntries khi status chuyển sang 'paid'.
  receivables: [
    ['Mã CN', 'id'], ['Khách hàng', 'clientName'], ['Mã dự án', 'projectId'], ['Mô tả', 'description'],
    ['Số tiền', 'amount'], ['Hạn thanh toán', 'dueDate'], ['Trạng thái', 'status'], ['Ghi chú', 'note'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  // Ảnh chụp bảng cân đối kế toán theo năm, nhập tay 1 lần/năm — phục vụ
  // riêng "Sổ tay CFO" trong finance.html (thanh khoản, đòn bẩy, Altman
  // Z-score...) vì các khoản mục này không nằm trong sổ giao dịch
  // financeEntries. Mỗi năm chỉ có 1 dòng (khoá theo `year`, upsert phía
  // client trong task-data.js).
  bsSnapshots: [
    ['Mã', 'id'], ['Năm', 'year'], ['Tài sản ngắn hạn', 'shortTermAssets'], ['Hàng tồn kho', 'inventory'],
    ['Tổng tài sản', 'totalAssets'], ['Nợ ngắn hạn', 'shortTermLiabilities'], ['Vay ngắn hạn', 'shortTermDebt'],
    ['Vay dài hạn', 'longTermDebt'], ['Tổng nợ phải trả', 'totalLiabilities'], ['Vốn chủ sở hữu', 'equity'],
    ['Chi phí lãi vay', 'interestExpense'], ['Chi mua sắm TSCĐ', 'capex'], ['Vốn hóa thị trường', 'marketCap'],
    ['LNST lũy kế', 'retainedEarnings'], ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'],
    ['Ngày cập nhật', 'updatedAt']
  ],
  // Đơn hàng / hoá đơn — AI NHÂN VIÊN CŨNG TẠO ĐƯỢC (không chỉ CEO như
  // financeEntries). Khi 1 đơn được đánh dấu "paid", client tự tạo thêm 1
  // dòng financeEntries loại `revenue` liên kết qua `linkedFinanceEntryId`
  // — logic hệt receivables (mark paid -> tạo revenue), chỉ khác là bất kỳ
  // ai cũng kích hoạt được bước link này, không riêng CEO.
  orders: [
    ['Mã ĐH', 'id'], ['Số đơn hàng', 'orderNumber'], ['Khách hàng', 'clientName'],
    ['SĐT khách hàng', 'clientPhone'], ['Địa chỉ khách hàng', 'clientAddress'], ['Mã dự án', 'projectId'],
    ['Danh sách hạng mục', 'items'], ['Tạm tính', 'subtotal'], ['Giảm giá %', 'discountPercent'],
    ['Tiền giảm giá', 'discountAmount'], ['VAT %', 'vatPercent'], ['Tiền VAT', 'vatAmount'],
    ['Tổng cộng', 'totalAmount'], ['Trạng thái', 'status'], ['Phương thức thanh toán', 'paymentMethod'],
    ['Ghi chú', 'note'], ['Mã giao dịch liên kết', 'linkedFinanceEntryId'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  // 6 sheet công cụ theo dự án dưới đây (2026-09-09) đi cùng các tab mới trong
  // pricing.html — mỗi tab lấy TEMPLATE cố định (tên nhóm công việc, tiêu chí
  // chấm điểm, 50 đầu việc nghiệm thu, 35 đầu hồ sơ...) viết thẳng trong
  // pricing.html (giống PRELIM_QTY_ITEMS), sheet chỉ lưu phần NGƯỜI DÙNG NHẬP
  // cho từng dự án — không lưu lại template vì template không đổi theo dự án.
  contractorComparisons: [
    ['Mã', 'id'], ['Mã dự án', 'projectId'], ['Tên nhà thầu A', 'contractorAName'],
    ['Tên nhà thầu B', 'contractorBName'], ['Tên nhà thầu C', 'contractorCName'],
    ['Dữ liệu giá theo nhóm việc', 'priceData'], ['Dữ liệu điểm theo tiêu chí', 'scoreData'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  cashFlowPlans: [
    ['Mã', 'id'], ['Mã dự án', 'projectId'], ['Giá trị hợp đồng', 'contractValue'],
    ['Dữ liệu mốc thanh toán', 'milestoneData'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  changeOrders: [
    ['Mã PS', 'id'], ['Mã dự án', 'projectId'], ['Ngày', 'date'], ['Giai đoạn', 'stage'],
    ['Mô tả phát sinh', 'description'], ['Nguyên nhân', 'reason'], ['ĐVT', 'unit'],
    ['Khối lượng', 'quantity'], ['Đơn giá', 'unitPrice'], ['Thành tiền', 'amount'],
    ['Trạng thái', 'status'], ['Người đề xuất', 'proposedBy'], ['Ngày duyệt', 'approvedAt'],
    ['Bằng chứng/ảnh', 'evidenceUrl'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  scheduleItems: [
    ['Mã CV', 'id'], ['Mã dự án', 'projectId'], ['STT', 'seq'], ['Công việc', 'name'],
    ['Thời lượng (ngày)', 'durationDays'], ['Bắt đầu KH', 'plannedStart'], ['Kết thúc KH', 'plannedEnd'],
    ['Bắt đầu TT', 'actualStart'], ['Kết thúc TT', 'actualEnd'], ['Trạng thái', 'status'], ['Ghi chú', 'note'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  // checkCode = mã cố định NT-01..NT-50 khớp với template trong pricing.html —
  // mỗi (projectId, checkCode) chỉ có tối đa 1 dòng, client tự upsert.
  acceptanceChecks: [
    ['Mã', 'id'], ['Mã dự án', 'projectId'], ['Mã kiểm tra', 'checkCode'], ['Hồ sơ/ảnh', 'evidenceUrl'],
    ['Kết quả', 'result'], ['Ngày kiểm tra', 'checkedAt'], ['Lỗi/cách xử lý', 'issue'], ['Xác nhận', 'confirmedBy'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  // docCode = mã cố định khớp index template (0..34) trong pricing.html.
  projectDocuments: [
    ['Mã', 'id'], ['Mã dự án', 'projectId'], ['Mã hồ sơ', 'docCode'], ['Trạng thái', 'status'],
    ['Nơi lưu/link', 'location'], ['Người phụ trách', 'ownerId'], ['Ghi chú', 'note'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  // HICON-BIM — danh mục dùng chung toàn tổ chức (không theo dự án).
  bimProducts: [
    ['Mã SP', 'id'], ['Tên sản phẩm', 'name'], ['Nhóm sản phẩm', 'group'],
    ['Vật liệu liên kết', 'materialId'], ['Đơn vị tính', 'unit'], ['Đơn giá tham khảo', 'refPrice'],
    ['Ghi chú', 'note'], ['Trạng thái', 'status'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  bimMaterials: [
    ['Mã VL', 'id'], ['Tên vật liệu', 'name'], ['Phân loại', 'category'], ['Chiều dày', 'thickness'],
    ['Đơn vị', 'unit'], ['Ghi chú', 'note'], ['Trạng thái', 'status'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  bimSuppliers: [
    ['Mã NCC', 'id'], ['Tên nhà cung cấp', 'name'], ['Loại', 'type'], ['Địa chỉ', 'address'],
    ['Số điện thoại', 'phone'], ['Người liên hệ', 'contactPerson'], ['Ghi chú', 'note'], ['Trạng thái', 'status'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  // HICON-BIM — theo dự án (lọc theo projectId phía client).
  bimIssues: [
    ['Mã Issue', 'id'], ['Mã dự án', 'projectId'], ['Tiêu đề', 'title'], ['Mô tả', 'description'],
    ['Vị trí', 'location'], ['Trạng thái', 'status'], ['Mức độ ưu tiên', 'priority'],
    ['Người phụ trách', 'assigneeId'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ],
  bimBoqItems: [
    ['Mã dòng', 'id'], ['Mã dự án', 'projectId'], ['Mã hạng mục', 'code'], ['Mã sản phẩm', 'productId'],
    ['Tên công tác', 'name'], ['Đơn vị', 'unit'], ['Khối lượng', 'quantity'], ['Đơn giá', 'unitPrice'],
    ['Ghi chú', 'note'],
    ['Người tạo', 'createdBy'], ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt']
  ]
};

// Field-level VALUE translation — only needed where the cell's actual
// content (not just its header) was changed to Vietnamese, e.g. a data-
// validation dropdown built with Vietnamese options. Add more [sheetKey,
// englishFieldKey] entries here if more dropdowns get "Việt hoá" later.
const VALUE_MAP = {
  'members.status': [
    ['Còn làm việc', 'active'],
    ['Chờ duyệt', 'pending'],
    ['Từ chối', 'rejected'],
    ['Tạm nghỉ việc', 'on-leave'],
    ['Ngưng công tác', 'inactive']
  ],
  // roleLevel gates permissions everywhere in the client (isAdmin(), PERMISSIONS
  // matrix...) via the literal string 'admin'/'manager'/'member' — CHỈ nhãn
  // hiển thị trên Sheet đổi — key nội bộ (founder/ceo/dept_director/manager/
  // member) đổi hay thêm bớt PHẢI đồng bộ với LEVELS/LEVEL_TO_ROLELEVEL và
  // với TaskManager.getLevels() (task-data.js) — 1 nguồn duy nhất, lệch 1 bên
  // là dropdown Sheet với dropdown web hiện khác danh sách nhau ngay.
  'members.level': [
    ['Founder', 'founder'], ['CEO', 'ceo'], ['Giám đốc Bộ phận', 'dept_director'],
    ['Quản lý', 'manager'], ['Nhân viên', 'member']
  ],
  // 2026-09-16: Sheet vẫn hiện "male"/"female" thô (chưa Việt hoá) — client
  // luôn dùng key 'male'/'female' để so sánh (form đăng ký, badge...), chỉ
  // đổi NHÃN hiển thị trên Sheet sang Nam/Nữ, không đổi key nội bộ. Bỏ hẳn
  // 'other' theo yêu cầu — chỉ còn 2 lựa chọn Nam/Nữ.
  'members.gender': [
    ['Nam', 'male'], ['Nữ', 'female']
  ],
  // 2026-09-10: Việt hoá các cột enum tiếng Anh (priority/status) trên Sheet để
  // CEO chọn dropdown bằng tiếng Việt — client vẫn dùng key tiếng Anh như cũ.
  // Nhãn khớp đúng chữ đã dùng sẵn trong UI (xem task-manager-app.js/projects.js)
  // để không tạo ra 2 cách gọi khác nhau cho cùng 1 trạng thái.
  'tasks.priority': [
    ['Thấp', 'low'], ['Trung bình', 'medium'], ['Cao', 'high']
  ],
  'tasks.status': [
    ['Chờ xử lý', 'pending'], ['Đang làm', 'in-progress'], ['Chờ duyệt', 'review'], ['Hoàn thành', 'completed']
  ],
  'projects.priority': [
    ['Thấp', 'low'], ['Trung bình', 'medium'], ['Cao', 'high']
  ],
  'projects.status': [
    ['Đang lên kế hoạch', 'planning'], ['Đang chạy', 'on-track'], ['Có rủi ro', 'at-risk'],
    ['Tạm dừng', 'on-hold'], ['Hoàn thành', 'completed']
  ],
  'proposals.status': [
    ['Chờ duyệt', 'pending'], ['Đã duyệt', 'approved'], ['Từ chối', 'rejected']
  ],
  // 2026-09-21: Văn phòng/Công trình cho sheet "Địa điểm chấm công" — xem
  // FIELD_MAP.attendanceLocations và applySiteRelaxation() (timesheet.html).
  'attendanceLocations.locationType': [
    ['Văn phòng', 'office'], ['Công trình', 'site']
  ],
  // 2026-09-19: cột "Trạng thái Thiết bị 1/2" (mirror của trạng thái đã gộp
  // sẵn trong "Thiết bị 1"/"Thiết bị 2" dạng "id::tên::trạng") — cho CEO/
  // Founder XEM VÀ SỬA TRỰC TIẾP trên Sheet bằng dropdown thay vì phải mở
  // đúng chuỗi ghép để sửa tay, xem parseDeviceIds()/stringifyDeviceEntries()
  // trong task-data.js (đọc cột này ĐÈ LÊN trạng thái trong chuỗi ghép nếu
  // có giá trị — sửa tay trên Sheet có hiệu lực ngay ở lần đồng bộ kế tiếp).
  'members.device1Status': [
    ['Chờ duyệt', 'pending'], ['Đã duyệt', 'approved']
  ],
  'members.device2Status': [
    ['Chờ duyệt', 'pending'], ['Đã duyệt', 'approved']
  ],
  'proposals.type': [
    ['Nghỉ phép', 'nghi-phep'], ['Mua sắm', 'mua-sam'], ['Nhân sự', 'nhan-su'],
    ['Công tác', 'cong-tac'], ['Tài chính', 'tai-chinh'], ['Khen thưởng', 'khen-thuong']
  ],
  // Nhãn khớp đúng TYPES trong finance.html — sổ giao dịch tài chính công ty.
  'financeEntries.type': [
    ['Doanh thu', 'revenue'], ['Chi phí', 'expense'], ['Vay nợ (nhận)', 'loan'],
    ['Trả nợ', 'repayment'], ['Thưởng nhân viên', 'bonus'], ['Phạt nhân viên (thu về)', 'penalty'],
    ['Tiền ứ đọng', 'idle'], ['Chưa giải ngân', 'undisbursed']
  ],
  // Nhãn khớp đúng STATUS_LABEL trong orders.html.
  'orders.status': [
    ['Nháp', 'draft'], ['Đã xác nhận', 'confirmed'], ['Đã thanh toán', 'paid'], ['Đã huỷ', 'cancelled']
  ],
  // Nhãn khớp đúng các slug dùng trong hicon-bim.html cho Issue BIM.
  'bimIssues.status': [
    ['Mới', 'moi'], ['Đang xử lý', 'dang-xu-ly'], ['Chờ phản hồi', 'cho-phan-hoi'], ['Đã giải quyết', 'da-giai-quyet']
  ],
  'bimIssues.priority': [
    ['Cao', 'cao'], ['Trung bình', 'trung-binh'], ['Thấp', 'thap']
  ],
  // portal.js đọc/ghi field theme bằng đúng chuỗi 'light'/'dark' (setTheme(),
  // xem data-theme trên <html>) — dropdown Việt hoá mới thêm 2026-09-11 chỉ
  // đổi NHÃN hiển thị trên Sheet, key nội bộ phải giữ nguyên 'light'/'dark'.
  'members.theme': [
    ['Nền sáng', 'light'], ['Nền tối', 'dark']
  ],
  // 2026-09-15: thêm dropdown cho sheet Thông báo (trước đó cột "Loại" là
  // text tự do payroll/attendance, không có validation) — key khớp đúng
  // 'type' dùng trong addSystemNotificationsBatch() (task-data.js) và
  // autoCheckoutForgottenEntries()/registerMemberDevice() (chỗ khác trong
  // file này). 'general' là mục dự phòng cho ai tạo thông báo thủ công
  // ngay trên Sheet, không khớp payroll/attendance.
  'notifications.type': [
    ['Lương thưởng', 'payroll'], ['Chấm công', 'attendance'], ['Chung', 'general']
  ]
};

// Phân tầng Cấp bậc (Level) — 2026-09-16, theo yêu cầu người dùng:
//   Level 0 Founder — toàn quyền tối thượng (xem/sửa/xoá mọi dữ liệu, cấu
//     hình app, cấp quyền người khác).
//   Level 1 CEO — quản lý vận hành chung, xem báo cáo tổng hợp mọi khối,
//     điều chỉnh tiến độ dự án chung.
//   Level 2 Giám đốc Bộ phận — toàn quyền thêm/sửa/xoá dữ liệu (hiện CHƯA
//     giới hạn theo đúng bộ phận của họ — codebase chưa có cơ chế phân
//     quyền theo phạm vi bộ phận/dự án, đây là đơn giản hoá có chủ đích).
//   Level 3 Quản lý — quản lý/giao việc/duyệt dữ liệu dự án hoặc nhân sự.
//   Level 4 Nhân viên — chỉ xem không gian làm việc của mình, cập nhật task
//     được giao, tạo đề xuất/báo cáo cá nhân.
// TOÀN BỘ code cũ (client lẫn file này) kiểm tra quyền qua field 'roleLevel'
// CŨ (chỉ 3 giá trị admin/manager/member, ~25 chỗ rải rác nhiều file) — thay
// vì sửa hết ngần ấy chỗ (rủi ro cao), 'level' (5 mức) là field MỚI, còn
// 'roleLevel' giờ được SUY RA từ 'level' ở getAllData() (không lưu trên
// Sheet nữa) qua bảng dưới đây, nên mọi chỗ check roleLevel cũ tiếp tục chạy
// đúng như trước — founder/ceo/dept_director đều suy ra 'admin' (chưa phân
// biệt được 3 cấp cao này ở tầng quyền cũ, chỉ khác nhau ở NHÃN hiển thị).
const LEVELS = [
  { code: 'founder', label: 'Founder', order: 0, roleLevel: 'admin' },
  { code: 'ceo', label: 'CEO', order: 1, roleLevel: 'admin' },
  { code: 'dept_director', label: 'Giám đốc Bộ phận', order: 2, roleLevel: 'admin' },
  { code: 'manager', label: 'Quản lý', order: 3, roleLevel: 'manager' },
  { code: 'member', label: 'Nhân viên', order: 4, roleLevel: 'member' }
];
const LEVEL_TO_ROLELEVEL = LEVELS.reduce(function (acc, l) { acc[l.code] = l.roleLevel; return acc; }, {});

// Đơn giá 34 tỉnh — đọc trực tiếp từ 46 sheet "DGXD-<tên gốc>" migrate sang
// ngày 2026-09-09 (xem GHI_CHU_DU_AN.md). Đây là dữ liệu tham khảo nhiều
// bảng xếp chồng trong 1 sheet (nhân công, phần thô/hoàn thiện, vật tư/thiết
// bị theo tỉnh...), không phải 1 bảng đơn giản như các SHEETS khác nên KHÔNG
// đi qua FIELD_MAP — trả thẳng lưới giá trị thô (displayValues, giữ nguyên
// định dạng số như trên Sheet), pricing.html tự dựng bảng hiển thị theo cấu
// trúc "dòng chỉ có cột A = tiêu đề mục, dòng ngay sau = header cột".
// 2026-09-16: đổi từ "Bản sao của " sang "DGXD-" — theo đúng đợt đổi tên
// hàng loạt 46 sheet tham khảo này (renameCopySheets(), xem GHI_CHU_DU_AN.md
// §6.5). QUÊN sửa hằng số này khi đổi tên là NGUYÊN NHÂN cả tab "Đơn giá
// theo tỉnh"/"Hướng dẫn"/"Nguồn" ở pricing.html bị gãy ngay sau lần rename đó.
var PROVINCE_SHEET_PREFIX = 'DGXD-';
var HUB_SHEET_NAME = PROVINCE_SHEET_PREFIX + 'M' + String.fromCharCode(7909) + 'c l' + String.fromCharCode(7909) + 'c';

// Danh sách 34 tỉnh lấy từ đúng cột "Tỉnh/thành" của sheet "Mục lục" (hàng 10
// trở đi) thay vì hardcode — tự động đúng nếu sau này database 34 tỉnh có sáp
// nhập/đổi tên tỉnh và được copy lại.
function getProvinceList(ss) {
  var hub = findSheet(ss, HUB_SHEET_NAME);
  if (!hub) return [];
  var lastRow = hub.getLastRow();
  if (lastRow < 10) return [];
  var values = hub.getRange(10, 2, lastRow - 9, 1).getValues();
  return values.map(function (r) { return r[0]; }).filter(function (v) { return v && String(v).trim(); });
}

function getProjectTypes(ss) {
  var sheet = findSheet(ss, SHEETS.projects);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 21, lastRow - 1, 1).getValues(); // cột U
  return values.map(function (r) { return r[0]; }).filter(function (v) { return v && String(v).trim(); });
}

function getProvincePricing(ss, provinceName) {
  if (!provinceName) return { error: 'Missing province' };
  var sheet = findSheet(ss, PROVINCE_SHEET_PREFIX + provinceName);
  if (!sheet) return { error: 'Province sheet not found: ' + provinceName };
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return { province: provinceName, rows: [] };
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  return { province: provinceName, rows: values };
}

function sheetKeyFor(sheetName) {
  return Object.keys(SHEETS).filter(function (k) { return SHEETS[k] === sheetName; })[0];
}

// Vietnamese header text (as it literally appears on the Sheet) -> English key.
// Unknown/custom header: returned as-is, so manually-added columns still work.
function viToEnHeader(sheetName, viHeader) {
  const key = sheetKeyFor(sheetName);
  const map = key && FIELD_MAP[key];
  if (!map) return viHeader;
  const hit = map.filter(function (p) { return p[0] === viHeader; })[0];
  return hit ? hit[1] : viHeader;
}

// English key -> Vietnamese header text to write against. Unknown key: as-is.
function enToViHeader(sheetName, enKey) {
  const key = sheetKeyFor(sheetName);
  const map = key && FIELD_MAP[key];
  if (!map) return enKey;
  const hit = map.filter(function (p) { return p[1] === enKey; })[0];
  return hit ? hit[0] : enKey;
}

function viToEnValue(sheetName, enKey, val) {
  const key = sheetKeyFor(sheetName);
  const pairs = key && VALUE_MAP[key + '.' + enKey];
  if (!pairs) return val;
  const hit = pairs.filter(function (p) { return p[0] === val; })[0];
  return hit ? hit[1] : val;
}

function enToViValue(sheetName, enKey, val) {
  const key = sheetKeyFor(sheetName);
  const pairs = key && VALUE_MAP[key + '.' + enKey];
  if (!pairs) return val;
  const hit = pairs.filter(function (p) { return p[1] === val; })[0];
  return hit ? hit[0] : val;
}

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;

    // "ping" (Offline.pingCheck() trong offline.js — kiểm tra thật sự có mạng
    // tới Apps Script hay không, chạy định kỳ mỗi 15s) PHẢI trả lời NGAY, trước
    // khi đụng tới SpreadsheetApp.openById() — mở Spreadsheet là thao tác CHẬM
    // nhất trong cả file này (có thể mất vài giây, đặc biệt khi nhiều người
    // dùng cùng lúc), dùng chung đường đi với các action đọc/ghi thật sẽ khiến
    // ping bị timeout giả, offline.js hiểu nhầm thành mất mạng dù mạng vẫn tốt.
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, ts: Date.now() })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let result;

    if (action === 'getProjects') {
      result = getAllData(ss, SHEETS.projects);
    } else if (action === 'getTasks') {
      result = getAllData(ss, SHEETS.tasks);
    } else if (action === 'getMembers') {
      result = getAllData(ss, SHEETS.members);
    } else if (action === 'getProposals') {
      result = getAllData(ss, SHEETS.proposals);
    } else if (action === 'addProject') {
      result = addData(ss, SHEETS.projects, JSON.parse(params.data));
    } else if (action === 'addTask') {
      result = addData(ss, SHEETS.tasks, JSON.parse(params.data));
    } else if (action === 'addMember') {
      result = addData(ss, SHEETS.members, JSON.parse(params.data));
    } else if (action === 'addProposal') {
      result = addData(ss, SHEETS.proposals, JSON.parse(params.data));
    } else if (action === 'updateProject') {
      result = updateData(ss, SHEETS.projects, params.id, JSON.parse(params.data));
    } else if (action === 'updateTask') {
      result = updateData(ss, SHEETS.tasks, params.id, JSON.parse(params.data));
    } else if (action === 'updateMember') {
      result = updateData(ss, SHEETS.members, params.id, JSON.parse(params.data));
    } else if (action === 'updateProposal') {
      result = updateData(ss, SHEETS.proposals, params.id, JSON.parse(params.data));
    } else if (action === 'updateTasksBatch') {
      // 2026-09-22: xem chú thích updateDataBatch() — tự ẩn hàng loạt task
      // Hoàn thành đã qua tháng.
      result = updateDataBatch(ss, SHEETS.tasks, JSON.parse(params.data));
    } else if (action === 'updateProjectsBatch') {
      result = updateDataBatch(ss, SHEETS.projects, JSON.parse(params.data));
    } else if (action === 'deleteProject') {
      result = deleteData(ss, SHEETS.projects, params.id);
    } else if (action === 'deleteTask') {
      result = deleteData(ss, SHEETS.tasks, params.id);
    } else if (action === 'deleteMember') {
      result = deleteData(ss, SHEETS.members, params.id);
    } else if (action === 'deleteProposal') {
      result = deleteData(ss, SHEETS.proposals, params.id);
    } else if (action === 'toggleTask') {
      const task = getDataById(ss, SHEETS.tasks, params.id);
      if (task) {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        result = updateData(ss, SHEETS.tasks, params.id, { status: newStatus });
      } else {
        result = { error: 'Task not found' };
      }
    } else if (action === 'approveProposal') {
      result = updateData(ss, SHEETS.proposals, params.id, { status: 'approved', reviewedAt: new Date().toISOString() });
    } else if (action === 'rejectProposal') {
      result = updateData(ss, SHEETS.proposals, params.id, { status: 'rejected', reviewedAt: new Date().toISOString() });
    } else if (action === 'getTimesheet') {
      result = getAllData(ss, SHEETS.timesheet);
    } else if (action === 'addTimesheet') {
      result = addData(ss, SHEETS.timesheet, JSON.parse(params.data));
    } else if (action === 'updateTimesheet') {
      result = updateData(ss, SHEETS.timesheet, params.id, JSON.parse(params.data));
    } else if (action === 'getAttendanceLocations') {
      result = getAllData(ss, SHEETS.attendanceLocations);
    } else if (action === 'addAttendanceLocation') {
      result = addData(ss, SHEETS.attendanceLocations, JSON.parse(params.data));
    } else if (action === 'updateAttendanceLocation') {
      result = updateData(ss, SHEETS.attendanceLocations, params.id, JSON.parse(params.data));
    } else if (action === 'deleteAttendanceLocation') {
      result = deleteData(ss, SHEETS.attendanceLocations, params.id);
    } else if (action === 'getWorkSchedule') {
      result = getAllData(ss, SHEETS.workSchedule);
    } else if (action === 'saveWorkSchedule') {
      // Upsert 1 dòng duy nhất — sheet này chỉ có ĐÚNG 1 cấu hình chung cho
      // cả công ty, không phải danh sách nhiều dòng như attendanceLocations.
      var wsData = JSON.parse(params.data);
      wsData.updatedAt = new Date().toISOString();
      var wsExisting = getAllData(ss, SHEETS.workSchedule);
      if (wsExisting.length > 0) {
        result = updateData(ss, SHEETS.workSchedule, wsExisting[0].id, wsData);
      } else {
        wsData.id = 'default';
        result = addData(ss, SHEETS.workSchedule, wsData);
      }
    } else if (action === 'getNotifications') {
      result = getAllData(ss, SHEETS.notifications);
    } else if (action === 'addNotification') {
      result = addData(ss, SHEETS.notifications, JSON.parse(params.data));
    } else if (action === 'updateNotification') {
      result = updateData(ss, SHEETS.notifications, params.id, JSON.parse(params.data));
    } else if (action === 'deleteNotification') {
      result = deleteData(ss, SHEETS.notifications, params.id);
    } else if (action === 'addNotificationsBatch') {
      // 1 lần ghi (setValues) cho nhiều thông báo cùng lúc — VD sự kiện đăng
      // ký/duyệt thiết bị chấm công cần báo tới nhiều CEO/Manager một lượt.
      // KHÔNG gọi addNotification() nhiều lần song song từ client cho việc
      // này (xem comment addDataBatch()) — dễ đua nhau ghi đè, rớt dữ liệu.
      result = addDataBatch(ss, SHEETS.notifications, JSON.parse(params.data));
    } else if (action === 'getNotices') {
      result = getAllData(ss, SHEETS.notices);
    } else if (action === 'addNotice') {
      result = addData(ss, SHEETS.notices, JSON.parse(params.data));
    } else if (action === 'updateNotice') {
      result = updateData(ss, SHEETS.notices, params.id, JSON.parse(params.data));
    } else if (action === 'deleteNotice') {
      result = deleteData(ss, SHEETS.notices, params.id);
    } else if (action === 'getDocuments') {
      result = getAllData(ss, SHEETS.documents);
    } else if (action === 'addDocument') {
      result = addData(ss, SHEETS.documents, JSON.parse(params.data));
    } else if (action === 'updateDocument') {
      result = updateData(ss, SHEETS.documents, params.id, JSON.parse(params.data));
    } else if (action === 'deleteDocument') {
      result = deleteData(ss, SHEETS.documents, params.id);
    } else if (action === 'getPayslips') {
      result = getAllData(ss, SHEETS.payslips);
    } else if (action === 'addPayslip') {
      result = addData(ss, SHEETS.payslips, JSON.parse(params.data));
    } else if (action === 'updatePayslip') {
      result = updateData(ss, SHEETS.payslips, params.id, JSON.parse(params.data));
    } else if (action === 'deletePayslip') {
      result = deleteData(ss, SHEETS.payslips, params.id);
    } else if (action === 'getCommissions') {
      result = getAllData(ss, SHEETS.commissions);
    } else if (action === 'addCommission') {
      result = addData(ss, SHEETS.commissions, JSON.parse(params.data));
    } else if (action === 'updateCommission') {
      result = updateData(ss, SHEETS.commissions, params.id, JSON.parse(params.data));
    } else if (action === 'deleteCommission') {
      result = deleteData(ss, SHEETS.commissions, params.id);
    } else if (action === 'getCommissionRates') {
      result = getAllData(ss, SHEETS.commissionRates);
    } else if (action === 'addCommissionRate') {
      result = addData(ss, SHEETS.commissionRates, JSON.parse(params.data));
    } else if (action === 'updateCommissionRate') {
      result = updateData(ss, SHEETS.commissionRates, params.id, JSON.parse(params.data));
    } else if (action === 'deleteCommissionRate') {
      result = deleteData(ss, SHEETS.commissionRates, params.id);
    } else if (action === 'getPriceCatalog') {
      result = getAllData(ss, SHEETS.priceCatalog);
    } else if (action === 'addPriceCatalog') {
      result = addData(ss, SHEETS.priceCatalog, JSON.parse(params.data));
    } else if (action === 'updatePriceCatalog') {
      result = updateData(ss, SHEETS.priceCatalog, params.id, JSON.parse(params.data));
    } else if (action === 'deletePriceCatalog') {
      result = deleteData(ss, SHEETS.priceCatalog, params.id);
    } else if (action === 'getFinanceEntries') {
      result = getAllData(ss, SHEETS.financeEntries);
    } else if (action === 'addFinanceEntry') {
      result = addData(ss, SHEETS.financeEntries, JSON.parse(params.data));
    } else if (action === 'updateFinanceEntry') {
      result = updateData(ss, SHEETS.financeEntries, params.id, JSON.parse(params.data));
    } else if (action === 'deleteFinanceEntry') {
      result = deleteData(ss, SHEETS.financeEntries, params.id);
    } else if (action === 'getReceivables') {
      result = getAllData(ss, SHEETS.receivables);
    } else if (action === 'addReceivable') {
      result = addData(ss, SHEETS.receivables, JSON.parse(params.data));
    } else if (action === 'updateReceivable') {
      result = updateData(ss, SHEETS.receivables, params.id, JSON.parse(params.data));
    } else if (action === 'deleteReceivable') {
      result = deleteData(ss, SHEETS.receivables, params.id);
    } else if (action === 'getBsSnapshots') {
      result = getAllData(ss, SHEETS.bsSnapshots);
    } else if (action === 'addBsSnapshot') {
      result = addData(ss, SHEETS.bsSnapshots, JSON.parse(params.data));
    } else if (action === 'updateBsSnapshot') {
      result = updateData(ss, SHEETS.bsSnapshots, params.id, JSON.parse(params.data));
    } else if (action === 'deleteBsSnapshot') {
      result = deleteData(ss, SHEETS.bsSnapshots, params.id);
    } else if (action === 'getOrders') {
      result = getAllData(ss, SHEETS.orders);
    } else if (action === 'addOrder') {
      result = addData(ss, SHEETS.orders, JSON.parse(params.data));
    } else if (action === 'updateOrder') {
      result = updateData(ss, SHEETS.orders, params.id, JSON.parse(params.data));
    } else if (action === 'deleteOrder') {
      result = deleteData(ss, SHEETS.orders, params.id);
    } else if (action === 'getProvinceList') {
      result = getProvinceList(ss);
    } else if (action === 'getProjectTypes') {
      result = getProjectTypes(ss);
    } else if (action === 'getProvincePricing') {
      result = getProvincePricing(ss, params.province);
    } else if (action === 'getContractorComparisons') {
      result = getAllData(ss, SHEETS.contractorComparisons);
    } else if (action === 'addContractorComparison') {
      result = addData(ss, SHEETS.contractorComparisons, JSON.parse(params.data));
    } else if (action === 'updateContractorComparison') {
      result = updateData(ss, SHEETS.contractorComparisons, params.id, JSON.parse(params.data));
    } else if (action === 'deleteContractorComparison') {
      result = deleteData(ss, SHEETS.contractorComparisons, params.id);
    } else if (action === 'getCashFlowPlans') {
      result = getAllData(ss, SHEETS.cashFlowPlans);
    } else if (action === 'addCashFlowPlan') {
      result = addData(ss, SHEETS.cashFlowPlans, JSON.parse(params.data));
    } else if (action === 'updateCashFlowPlan') {
      result = updateData(ss, SHEETS.cashFlowPlans, params.id, JSON.parse(params.data));
    } else if (action === 'deleteCashFlowPlan') {
      result = deleteData(ss, SHEETS.cashFlowPlans, params.id);
    } else if (action === 'getChangeOrders') {
      result = getAllData(ss, SHEETS.changeOrders);
    } else if (action === 'addChangeOrder') {
      result = addData(ss, SHEETS.changeOrders, JSON.parse(params.data));
    } else if (action === 'updateChangeOrder') {
      result = updateData(ss, SHEETS.changeOrders, params.id, JSON.parse(params.data));
    } else if (action === 'deleteChangeOrder') {
      result = deleteData(ss, SHEETS.changeOrders, params.id);
    } else if (action === 'getScheduleItems') {
      result = getAllData(ss, SHEETS.scheduleItems);
    } else if (action === 'seedScheduleItems') {
      result = addDataBatch(ss, SHEETS.scheduleItems, JSON.parse(params.data));
    } else if (action === 'addScheduleItem') {
      result = addData(ss, SHEETS.scheduleItems, JSON.parse(params.data));
    } else if (action === 'updateScheduleItem') {
      result = updateData(ss, SHEETS.scheduleItems, params.id, JSON.parse(params.data));
    } else if (action === 'deleteScheduleItem') {
      result = deleteData(ss, SHEETS.scheduleItems, params.id);
    } else if (action === 'getAcceptanceChecks') {
      result = getAllData(ss, SHEETS.acceptanceChecks);
    } else if (action === 'addAcceptanceCheck') {
      result = addData(ss, SHEETS.acceptanceChecks, JSON.parse(params.data));
    } else if (action === 'updateAcceptanceCheck') {
      result = updateData(ss, SHEETS.acceptanceChecks, params.id, JSON.parse(params.data));
    } else if (action === 'deleteAcceptanceCheck') {
      result = deleteData(ss, SHEETS.acceptanceChecks, params.id);
    } else if (action === 'getProjectDocuments') {
      result = getAllData(ss, SHEETS.projectDocuments);
    } else if (action === 'addProjectDocument') {
      result = addData(ss, SHEETS.projectDocuments, JSON.parse(params.data));
    } else if (action === 'updateProjectDocument') {
      result = updateData(ss, SHEETS.projectDocuments, params.id, JSON.parse(params.data));
    } else if (action === 'deleteProjectDocument') {
      result = deleteData(ss, SHEETS.projectDocuments, params.id);
    } else if (action === 'getBimProducts') {
      result = getAllData(ss, SHEETS.bimProducts);
    } else if (action === 'addBimProduct') {
      result = addData(ss, SHEETS.bimProducts, JSON.parse(params.data));
    } else if (action === 'updateBimProduct') {
      result = updateData(ss, SHEETS.bimProducts, params.id, JSON.parse(params.data));
    } else if (action === 'deleteBimProduct') {
      result = deleteData(ss, SHEETS.bimProducts, params.id);
    } else if (action === 'getBimMaterials') {
      result = getAllData(ss, SHEETS.bimMaterials);
    } else if (action === 'addBimMaterial') {
      result = addData(ss, SHEETS.bimMaterials, JSON.parse(params.data));
    } else if (action === 'updateBimMaterial') {
      result = updateData(ss, SHEETS.bimMaterials, params.id, JSON.parse(params.data));
    } else if (action === 'deleteBimMaterial') {
      result = deleteData(ss, SHEETS.bimMaterials, params.id);
    } else if (action === 'getBimSuppliers') {
      result = getAllData(ss, SHEETS.bimSuppliers);
    } else if (action === 'addBimSupplier') {
      result = addData(ss, SHEETS.bimSuppliers, JSON.parse(params.data));
    } else if (action === 'updateBimSupplier') {
      result = updateData(ss, SHEETS.bimSuppliers, params.id, JSON.parse(params.data));
    } else if (action === 'deleteBimSupplier') {
      result = deleteData(ss, SHEETS.bimSuppliers, params.id);
    } else if (action === 'getBimIssues') {
      result = getAllData(ss, SHEETS.bimIssues);
    } else if (action === 'addBimIssue') {
      result = addData(ss, SHEETS.bimIssues, JSON.parse(params.data));
    } else if (action === 'updateBimIssue') {
      result = updateData(ss, SHEETS.bimIssues, params.id, JSON.parse(params.data));
    } else if (action === 'deleteBimIssue') {
      result = deleteData(ss, SHEETS.bimIssues, params.id);
    } else if (action === 'getBimBoqItems') {
      result = getAllData(ss, SHEETS.bimBoqItems);
    } else if (action === 'addBimBoqItem') {
      result = addData(ss, SHEETS.bimBoqItems, JSON.parse(params.data));
    } else if (action === 'updateBimBoqItem') {
      result = updateData(ss, SHEETS.bimBoqItems, params.id, JSON.parse(params.data));
    } else if (action === 'deleteBimBoqItem') {
      result = deleteData(ss, SHEETS.bimBoqItems, params.id);
    } else {
      // Đồng bộ Model/Object từ plugin SketchUp (.rbz) — toàn bộ logic sống
      // riêng trong file bim-model-sync.gs (thêm làm 1 file .gs riêng trong
      // cùng project Apps Script này), đây chỉ là 1 dòng chuyển tiếp.
      var bimSyncResult = (typeof handleBimSyncAction === 'function') ? handleBimSyncAction(ss, action, params) : null;
      result = bimSyncResult || { error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Real header row of the sheet — the single source of truth for column order/name.
// Trimmed because manually-typed/pasted headers can carry stray leading/trailing
// whitespace that would otherwise silently break the VN header -> EN key match.
function getHeaders(sheet) {
  if (sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) {
    return typeof h === 'string' ? h.trim() : h;
  });
}

// Robust sheet lookup — tolerant of trailing spaces AND of Unicode form
// differences in the Vietnamese tab names. "ả" can be stored either
// precomposed (U+1EA3) or decomposed ("a" + U+0309 combining hook); a plain
// ss.getSheetByName() compares bytes and misses the other form. That exact
// mismatch (code said one form, the "Bảng tin" tab used the other) made reads
// silently spawn empty duplicate tabs. NFC-normalising both sides fixes it
// for every sheet at once.
function normalizeName(s) {
  return String(s == null ? '' : s).normalize('NFC').trim();
}
function findSheet(ss, sheetName) {
  const target = normalizeName(sheetName);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (normalizeName(sheets[i].getName()) === target) return sheets[i];
  }
  return null;
}
// Only creates when the tab genuinely does not exist (matched via findSheet,
// so a Unicode/whitespace variant is reused, never duplicated). Used by the
// WRITE paths — reads must never create (see getAllData).
function getOrCreateSheet(ss, sheetName) {
  return findSheet(ss, sheetName) || ss.insertSheet(sheetName);
}

function getAllData(ss, sheetName) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return []; // read never creates a tab — avoids phantom empties
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const headers = getHeaders(sheet);
  return data.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      const key = viToEnHeader(sheetName, h);
      let val = row[i];
      // A Sheet cell formatted/entered as an actual Date (dob, deadline,
      // startDate...) comes back from getValues() as a real JS Date object
      // representing midnight in the SCRIPT timezone (Asia/Ho_Chi_Minh). The
      // JSON response later serializes any Date via toISOString(), which
      // converts to UTC and — for a UTC+7 midnight — lands on the PREVIOUS
      // calendar day (e.g. dob "2000-08-03" became "2000-08-02T17:00:00Z").
      // Format it to a plain "yyyy-MM-dd" string here, in the same timezone
      // the sheet/cell actually means, before that UTC shift can happen.
      //
      // "Giờ checkin"/"Giờ checkout" are TIME-only cells (e.g. "17:12") — a
      // time-only value Sheets stores with its date portion pinned to
      // 1899-12-30 (Sheets' own epoch day). Formatting those with 'yyyy-MM-dd'
      // like every other date field threw away the actual time and displayed
      // the literal epoch date to the user ("check-in lúc 1899-12-30", bug
      // reported 2026-09-09) — format checkinTime/checkoutTime as 'HH:mm'
      // instead so the time-of-day survives.
      // 2026-09-19: cùng bug tái diễn ở 4 cột giờ ca sáng/chiều mới thêm
      // (morningCheckin/morningCheckout/afternoonCheckin/afternoonCheckout)
      // — chưa có trong danh sách này nên vẫn hiện "1899-12-30" thay vì giờ
      // thật. Thêm cả 4 field vào đây (KHÔNG cần đổi gì ở write-side — giá
      // trị time không hề bị mất, Sheets chỉ lưu dưới dạng serial Time thay
      // vì text thuần, format lại đúng ở đây là đủ khôi phục nguyên vẹn).
      if (Object.prototype.toString.call(val) === '[object Date]') {
        const TIME_ONLY_FIELDS = { checkinTime: true, checkoutTime: true, morningCheckin: true, morningCheckout: true, afternoonCheckin: true, afternoonCheckout: true };
        const pattern = TIME_ONLY_FIELDS[key] ? 'HH:mm' : 'yyyy-MM-dd';
        val = Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', pattern);
      }
      if (typeof val === 'string' && val.startsWith('[')) {
        try { val = JSON.parse(val); } catch (e) { /* keep raw string */ }
      }
      // "Mã người phụ trách" (Công việc) và "Thành viên tham gia" (Dự án) đều
      // dùng dropdown "Cho phép có nhiều lựa chọn" gốc của Sheets — tính năng
      // này lưu các giá trị đã chọn thành CHUỖI phân tách bởi dấu phẩy trong
      // ô (KHÔNG phải mảng JSON như các cột multi-value khác), vì đây là hành
      // vi Sheets tự viết khi CEO/manager chọn trực tiếp trên Sheet UI (đã
      // kiểm chứng thực tế 2026-09-10, áp dụng thêm cho members cùng ngày).
      // Luôn trả về mảng cho client dù ô đang trống/có 1/có nhiều người.
      if (COMMA_LIST_FIELDS[key]) {
        if (Array.isArray(val)) {
          // đã được JSON.parse ở trên (ô cũ trước khi đổi sang multi-select)
        } else if (typeof val === 'string' && val.trim()) {
          val = val.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        } else {
          val = [];
        }
      }
      if (key === 'phone' && typeof val === 'number') {
        // Legacy rows written before forceTextIfDateLike covered "phone":
        // Sheets already stored it as a Number, so the leading "0" of a VN
        // mobile number (10 digits) is gone for good at the cell level —
        // a 9-digit read here means exactly that happened. Re-add it for
        // display only — doesn't touch the cell itself.
        val = String(val);
        if (val.length === 9) val = '0' + val;
      }
      obj[key] = typeof val === 'string' ? viToEnValue(sheetName, key, val) : val;
    });
    // Sheet Thành viên: suy 'roleLevel' (3 mức CŨ — admin/manager/member,
    // toàn bộ ~25 chỗ check quyền rải rác trong client vẫn dùng field này)
    // từ 'level' (5 mức MỚI) — xem LEVEL_TO_ROLELEVEL phía trên. Field chưa
    // gán 'level' hợp lệ (dữ liệu cũ/trống) mặc định 'member' (an toàn nhất).
    if (sheetName === SHEETS.members) {
      obj.roleLevel = LEVEL_TO_ROLELEVEL[obj.level] || 'member';
    }
    return obj;
  }).filter(function (obj) {
    // Bỏ qua "hàng" hoàn toàn trống ở cột id (VD "Mã DA") — getRange() ở
    // trên đọc tới sheet.getLastColumn(), nên nếu có 1 cột phụ nào đó nằm xa
    // bên phải bảng dữ liệu chính (VD danh sách nguồn cho dropdown data
    // validation) chứa giá trị ở hàng thấp hơn last row thật của bảng chính,
    // hàng đó sẽ bị đọc nhầm thành 1 "bản ghi" rỗng (phát hiện thực tế
    // 2026-09-18 ở Sheet "Dự án" — 1 dự án rỗng hoàn toàn xuất hiện trên
    // trang Hoa hồng, chỉ có đúng 1 cột phụ "Danh sách Loại dự án (nguồn
    // dropdown)" là có giá trị). Sheet nào không có cột "id" thì obj.id là
    // undefined — không lọc nhầm.
    return obj.id === undefined || obj.id !== '';
  });
}

function getDataById(ss, sheetName, id) {
  return getAllData(ss, sheetName).find(function (row) { return row.id === id; });
}

// <prefix>_<yyMMdd>_<timestamp>_<6 random digits> — date prefix keeps ids
// sortable/scannable over years of growth without ever needing to reset the
// sheet; the trailing 6 random digits (2026-09-09) guard against collision
// when addDataBatch() writes several rows within the same millisecond (seen
// in practice — Date.now() alone isn't unique enough under a tight loop).
// Not used for the "Thành viên" sheet — member IDs have their own scheme
// (<PREFIX>_<Initials>_<DDMMYY>) generated client-side in auth.js.
function makeId(prefix) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyMMdd');
  const rand = Math.floor(100000 + Math.random() * 900000);
  return prefix + '_' + stamp + '_' + Date.now() + '_' + rand;
}

// Sheets auto-parses strings that look like dates (e.g. "2026-09") into real
// dates on write — via appendRow/setValue — REGARDLESS of the column's own
// number format (plain-text formatting only protects manual typing, not API
// writes). Fields like "month" ('YYYY-MM') are compared with exact string
// equality elsewhere, so a silent date-coercion breaks all of that filtering.
// A leading apostrophe is the standard Sheets trick to force literal text.
//
// Same problem, different shape, for phone/CCCD/bank account numbers: an
// all-digit string gets auto-coerced to a Number on write, which silently
// drops any leading "0" (e.g. phone "0334828489" -> 334828489). These fields
// are never used arithmetically, so force them to text too.
// 2026-09-18: `lat`/`lng` (Sheet "Địa điểm chấm công") gặp ĐÚNG bug y hệt IP
// đã ghi chú bên dưới — client gửi lên dạng CHUỖI (`<input>.value` luôn là
// string), Apps Script ghi thẳng chuỗi "20.926738" vào ô KHÔNG ép định dạng
// Text trước, Sheet ở locale VN đọc "." là dấu phân cách hàng nghìn nên tự
// biến thành SỐ 20926738 (mất hết phần thập phân) — hậu quả thật: tính
// khoảng cách GPS ra sai lệch hàng nghìn km khiến chấm công báo "cách văn
// phòng 9942450m", tưởng nhầm là lỗi định vị của thiết bị/trình duyệt trong
// khi bản chất là toạ độ ĐÍCH lưu trên Sheet đã bị hỏng ngay từ lúc ghi.
var FORCE_TEXT_FIELDS = { phone: true, cccd: true, bankAccount: true, lat: true, lng: true };
function forceTextIfDateLike(val, enKey) {
  if (typeof val === 'string' && /^\d{4}-\d{1,2}$/.test(val)) return "'" + val;
  if (enKey && FORCE_TEXT_FIELDS[enKey] && typeof val === 'string' && /^\d+$/.test(val)) return "'" + val;
  return val;
}

// Dùng cho field "ip"/"checkinIp"... — KHÔNG dùng cách ép "'" (leading
// apostrophe) như forceTextIfDateLike() ở trên: đã kiểm chứng thực tế
// (2026-09-15) qua Range.setValue() gọi từ Apps Script API, dấu nháy đơn đó
// KHÔNG ép được text — Sheet ở locale Việt Nam vẫn tự đọc "." là dấu phân
// cách hàng nghìn và biến 1 IP như "14.171.113.174" (mỗi cụm sau octet đầu
// đúng 3 chữ số, y hệt cách nhóm hàng nghìn) thành số 14171113174, mất hết
// dấu chấm — IP khác nếu cụm không đủ 3 chữ số (VD "172.225.56.21") lại
// tình cờ giữ đúng dạng chuỗi, khiến bug rất dễ bị bỏ sót khi chỉ test 1 IP.
// Cách ép CHẮC CHẮN: đặt định dạng ô = "Văn bản thuần" (@) TRƯỚC khi ghi.
function needsPlainTextFormat(enKey) {
  return !!(enKey && (FORCE_TEXT_FIELDS[enKey] || /^ip$|Ip$/.test(enKey)));
}
function writeTextForcedCell(cell, val) {
  cell.setNumberFormat('@');
  cell.setValue(val);
}

// 2026-09-10: ghi các field NGÀY/THỜI GIAN (không phải "month" YYYY-MM, đã
// forceTextIfDateLike ép text ở trên — không đụng) dưới dạng Date THẬT thay
// vì chuỗi ISO thô. Trước đây createdAt/date... ghi chuỗi "YYYY-MM-DD" (Sheets
// có tự nhận ra tuỳ trường hợp) còn updatedAt/reviewedAt... ghi cả giờ-phút-
// giây kiểu "2026-09-10T06:14:53.976Z" thì Sheets KHÔNG tự nhận ra được, cứ
// hiện nguyên văn xấu — không theo được định dạng dd/mm/yyyy người dùng đã tự
// đặt cho cột đó. Ghi hẳn 1 Date object thì Apps Script biết chắc là ngày,
// Sheets tự hiển thị đúng theo định dạng cột (không quan tâm chuỗi gốc trông
// thế nào) — đọc lại vẫn qua đúng nhánh "Object Date" có sẵn trong
// getAllData() (format lại về 'yyyy-MM-dd' cho app dùng nội bộ, không đổi).
var REAL_DATE_FIELDS = {
  createdAt: true, updatedAt: true, date: true, dob: true, deadline: true,
  startDate: true, endDate: true, dueDate: true, checkedAt: true, approvedAt: true,
  reviewedAt: true, plannedStart: true, plannedEnd: true, actualStart: true, actualEnd: true,
  completedAt: true
};
function toRealDateIfDateField(val, enKey) {
  if (!REAL_DATE_FIELDS[enKey] || typeof val !== 'string' || !val) return val;
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(val)) return val;
  var d = new Date(val);
  return isNaN(d.getTime()) ? val : d;
}

// Ghi nhiều dòng trong 1 lần thực thi (1 lệnh appendRows) — dùng khi cần tạo
// sẵn nhiều dòng mẫu cùng lúc (VD: seed 18 đầu việc Tiến độ cho 1 dự án mới
// mở tab lần đầu). KHÔNG gọi addData() nhiều lần song song từ client cho việc
// này: mỗi lần gọi API là 1 lần thực thi Apps Script riêng, chạy đồng thời
// đọc/ghi cùng sheet dễ đua nhau đọc sai "dòng cuối" và ghi đè lên nhau, rớt
// mất dữ liệu — đã xảy ra thật khi test seed Tiến độ (18 dòng gửi song song,
// chỉ còn lại 6-7 dòng).
function addDataBatch(ss, sheetName, dataList) {
  const sheet = getOrCreateSheet(ss, sheetName);
  let headers = getHeaders(sheet);
  if (headers.length === 0) {
    const schemaKey = sheetKeyFor(sheetName);
    const pairs = schemaKey && FIELD_MAP[schemaKey];
    headers = pairs ? pairs.map(function (p) { return p[0]; }) : Object.keys(dataList[0] || {});
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  const now = new Date().toISOString().split('T')[0];
  const rows = dataList.map(function (data) {
    if (!data.id) {
      const prefix = (sheetKeyFor(sheetName) || sheetName).toLowerCase().replace(/s$/, '');
      data.id = makeId(prefix);
    }
    data.createdAt = data.createdAt || now;
    return headers.map(function (h) {
      const enKey = viToEnHeader(sheetName, h);
      let val = data[enKey];
      if (Array.isArray(val)) return stringifyArrayForCell(enKey, val);
      if (typeof val === 'string') val = enToViValue(sheetName, enKey, val);
      val = toRealDateIfDateField(val, enKey);
      if (val instanceof Date) return val;
      return forceTextIfDateLike(val !== undefined && val !== null ? val : '', enKey);
    });
  });
  if (rows.length) {
    const firstNewRow = sheet.getLastRow() + 1;
    sheet.getRange(firstNewRow, 1, rows.length, headers.length).setValues(rows);
    fillComputedHelperFormulas(sheet, headers, firstNewRow, rows.length);
  }
  return dataList;
}

// Cột phụ trợ thuần công thức (VD "Tên dự án" tra theo Mã dự án bằng VLOOKUP,
// xem thêm ở phần thêm cột trên Sheet) — client không bao giờ gửi giá trị
// cho các cột này (không nằm trong FIELD_MAP), nên addData/addDataBatch ở
// trên sẽ ghi '' vào ô đó cho MỌI dòng mới nếu không tự xử lý — xoá mất công
// thức. Copy công thức từ dòng ngay trên xuống (đúng cách Sheets tự "kéo
// công thức" khi thêm dòng bằng tay) để dòng mới luôn có công thức, không
// cần người dùng tự kéo lại mỗi lần.
var COMPUTED_HELPER_HEADERS = ['Tên dự án'];
function fillComputedHelperFormulas(sheet, headers, startRow, numRows) {
  if (startRow < 3) return; // không có dòng trên (dòng 1 là header) để copy công thức từ
  headers.forEach(function (h, i) {
    if (COMPUTED_HELPER_HEADERS.indexOf(h) === -1) return;
    var srcCell = sheet.getRange(startRow - 1, i + 1);
    if (!srcCell.getFormula()) return;
    srcCell.copyTo(sheet.getRange(startRow, i + 1, numRows, 1));
  });
}

// Các cột dùng dropdown "Cho phép có nhiều lựa chọn" gốc của Sheets (assigneeIds
// của Công việc, members của Dự án — "Thành viên tham gia") tự lưu dạng CHUỖI
// phân tách bởi dấu phẩy khi CEO/manager chọn trực tiếp trên Sheet UI — ghi
// khớp đúng định dạng đó để không phá dropdown. Các cột mảng khác (dailyTasks,
// items...) vẫn dùng JSON như cũ.
var COMMA_LIST_FIELDS = { assigneeIds: true, members: true };
function stringifyArrayForCell(enKey, val) {
  if (COMMA_LIST_FIELDS[enKey]) return val.join(', ');
  return JSON.stringify(val);
}

// Sheet đã có sẵn header (KHÔNG rỗng) nhưng FIELD_MAP được bổ sung field MỚI
// SAU khi sheet đã tồn tại (VD 2026-09-17 thêm 9 cột ca sáng/chiều + đi muộn/
// về sớm vào FIELD_MAP.timesheet) — addData()/updateData() chỉ ghi field có
// header ĐÃ CÓ SẴN trên Sheet (`headers.forEach`/`headers.map`), field mới
// tinh bị ÂM THẦM BỎ QUA (không lỗi, không cột, mất trắng dữ liệu) vì nhánh
// tự tạo header chỉ chạy khi `headers.length === 0` (sheet hoàn toàn trống).
// Tự bổ sung cột còn thiếu (CHỈ những field đã khai báo trong FIELD_MAP, có
// mặt trong data đang ghi — không tự tạo cột cho field lạ/gõ nhầm) mỗi lần
// addData/updateData gặp field mới, để không phải nhớ tay chạy 1 lần dọn sheet.
function ensureSchemaColumns(sheet, sheetName, headers, dataObj) {
  const schemaKey = sheetKeyFor(sheetName);
  const pairs = schemaKey && FIELD_MAP[schemaKey];
  if (!pairs) return headers;
  const missing = [];
  pairs.forEach(function (p) {
    const viHeader = p[0], enKey = p[1];
    if (headers.indexOf(viHeader) === -1 && dataObj[enKey] !== undefined && missing.indexOf(viHeader) === -1) {
      missing.push(viHeader);
    }
  });
  if (missing.length === 0) return headers;
  sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  return headers.concat(missing);
}

function addData(ss, sheetName, data) {
  const sheet = getOrCreateSheet(ss, sheetName);
  let headers = getHeaders(sheet);
  // Brand-new empty sheet with no header row yet: seed it (in Vietnamese) from FIELD_MAP.
  if (headers.length === 0) {
    const schemaKey = sheetKeyFor(sheetName);
    const pairs = schemaKey && FIELD_MAP[schemaKey];
    headers = pairs ? pairs.map(function (p) { return p[0]; }) : Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers = ensureSchemaColumns(sheet, sheetName, headers, data);
  }
  if (!data.id) {
    const prefix = (sheetKeyFor(sheetName) || sheetName).toLowerCase().replace(/s$/, '');
    data.id = makeId(prefix);
  }
  data.createdAt = data.createdAt || new Date().toISOString().split('T')[0];
  // Cột cần ép TEXT (ip/phone/cccd/bankAccount...) để trống lúc appendRow —
  // ghi lại riêng SAU với định dạng ô đã đặt "Văn bản thuần" (xem
  // writeTextForcedCell) để chắc chắn Sheet không tự đọc nhầm thành số.
  const textForcedCols = [];
  const row = headers.map(function (h, i) {
    const enKey = viToEnHeader(sheetName, h);
    let val = data[enKey];
    if (Array.isArray(val)) return stringifyArrayForCell(enKey, val);
    if (typeof val === 'string') val = enToViValue(sheetName, enKey, val);
    val = toRealDateIfDateField(val, enKey);
    if (val instanceof Date) return val;
    if (typeof val === 'string' && val && needsPlainTextFormat(enKey)) {
      textForcedCols.push({ col: i + 1, val: val });
      return '';
    }
    return val !== undefined && val !== null ? val : '';
  });
  sheet.appendRow(row);
  const newRowNum = sheet.getLastRow();
  textForcedCols.forEach(function (tf) { writeTextForcedCell(sheet.getRange(newRowNum, tf.col), tf.val); });
  fillComputedHelperFormulas(sheet, headers, newRowNum, 1);
  return data;
}

function updateData(ss, sheetName, id, updates) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const headers = ensureSchemaColumns(sheet, sheetName, getHeaders(sheet), updates);
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(function (row) { return row.id === id; });
  if (index === -1) return { error: 'Not found: ' + id };
  const rowNum = index + 2;
  if (headers.indexOf(enToViHeader(sheetName, 'updatedAt')) !== -1) {
    updates.updatedAt = new Date().toISOString();
  }
  headers.forEach(function (h, i) {
    const enKey = viToEnHeader(sheetName, h);
    if (updates[enKey] !== undefined) {
      let val = updates[enKey];
      if (Array.isArray(val)) val = stringifyArrayForCell(enKey, val);
      else if (typeof val === 'string') val = enToViValue(sheetName, enKey, val);
      val = toRealDateIfDateField(val, enKey);
      const cell = sheet.getRange(rowNum, i + 1);
      if (val instanceof Date) {
        cell.setValue(val);
      } else if (typeof val === 'string' && val && needsPlainTextFormat(enKey)) {
        writeTextForcedCell(cell, val);
      } else {
        // Bẫy 2026-09-18: `forceTextIfDateLike(val, enKey) || ''` biến `false`
        // (VD tắt 1 "Nhắc định kỳ", field `active`) thành CHUỖI RỖNG khi ghi —
        // `false` là falsy nên `|| ''` nuốt mất, đọc lại KHÔNG BAO GIỜ ra lại
        // đúng `false` (chỉ ra `""`), làm hỏng mọi so sánh `=== false` ở phía
        // client. Coalesce đúng kiểu: chỉ thay bằng '' khi thật sự undefined/null.
        const forced = forceTextIfDateLike(val, enKey);
        cell.setValue(forced !== undefined && forced !== null ? forced : '');
      }
    }
  });
  // 2026-09-16: chuyển sang 'rejected' (từ trạng thái khác) qua chính API này
  // (nút "Từ chối" trên web) — stamp mốc 48h + báo Founder. Chuyển RA KHỎI
  // 'rejected' (được duyệt lại) — xoá mốc cũ để lần từ chối sau (nếu có) tính
  // lại đủ 48h mới, không kế thừa đồng hồ cũ. Cùng cơ chế với việc admin sửa
  // tay cột "Trạng thái" thẳng trên Sheet — xem onEdit()/stampMemberRejection().
  if (sheetName === SHEETS.members && updates.status !== undefined) {
    const oldStatus = data[index].status;
    const newStatus = updates.status;
    if (newStatus === 'rejected' && oldStatus !== 'rejected') {
      stampMemberRejection(ss, sheet, headers, rowNum, id, data[index].name);
    } else if (oldStatus === 'rejected' && newStatus !== 'rejected') {
      clearMemberRejection(sheet, headers, rowNum);
    }
  }
  return Object.assign({}, data[index], updates);
}

// 2026-09-22: cập nhật NHIỀU dòng cùng lúc trong 1 lần thực thi (VD tự ẩn
// hàng loạt task/dự án Hoàn thành đã qua tháng — autoHideExpiredCompleted()
// trong task-data.js) — KHÔNG gọi updateData() nhiều lần song song từ client
// cho việc này (xem chú thích addDataBatch() ở trên, cùng lý do). updatesList
// là mảng {id, ...field cần sửa}, mỗi item chỉ cần chứa field muốn đổi.
function updateDataBatch(ss, sheetName, updatesList) {
  const results = [];
  (updatesList || []).forEach(function (item) {
    if (!item || !item.id) return;
    var updates = Object.assign({}, item);
    delete updates.id;
    results.push(updateData(ss, sheetName, item.id, updates));
  });
  return results;
}

function deleteData(ss, sheetName, id) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };
  const data = getAllData(ss, sheetName);
  const index = data.findIndex(function (row) { return row.id === id; });
  if (index === -1) return { error: 'Not found' };
  sheet.deleteRow(index + 2);
  return { success: true, deleted: id };
}

// Installable trigger (Triggers > Add Trigger > onEdit > From spreadsheet > On edit).
// When a Member's id cell is edited by hand in the Sheet, cascades the change to every
// other sheet that references that member id, so tasks/projects/timesheet/proposals
// stay linked instead of silently pointing at a now-nonexistent id.
// 2026-09-16: mở rộng thêm — sửa tay cột "Trạng thái" thành "Từ chối" ngay
// trên Sheet (không qua nút Từ chối trên web) cũng phải kích hoạt đúng cơ
// chế 48h đếm ngược + báo Founder y hệt, theo đúng yêu cầu người dùng.
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (normalizeName(sheet.getName()) !== normalizeName(SHEETS.members)) return;
    if (e.range.getRow() === 1) return; // header row itself
    const headers = getHeaders(sheet);
    const col = e.range.getColumn();
    const header = headers[col - 1];

    if (header === enToViHeader(SHEETS.members, 'id')) {
      const oldId = e.oldValue;
      const newId = e.value;
      if (oldId && newId && oldId !== newId) cascadeMemberIdChange(oldId, newId);
      return;
    }

    if (header === enToViHeader(SHEETS.members, 'status')) {
      const oldStatusVi = e.oldValue;
      const newStatusVi = e.value;
      if (newStatusVi === oldStatusVi) return;
      const row = e.range.getRow();
      const ss = sheet.getParent();
      const idColIdx = headers.indexOf(enToViHeader(SHEETS.members, 'id'));
      const nameColIdx = headers.indexOf(enToViHeader(SHEETS.members, 'name'));
      const memberId = idColIdx !== -1 ? sheet.getRange(row, idColIdx + 1).getValue() : null;
      const memberName = nameColIdx !== -1 ? sheet.getRange(row, nameColIdx + 1).getValue() : memberId;
      if (!memberId) return;
      if (newStatusVi === 'Từ chối') {
        stampMemberRejection(ss, sheet, headers, row, memberId, memberName);
      } else if (oldStatusVi === 'Từ chối') {
        clearMemberRejection(sheet, headers, row);
      }
      return;
    }
  } catch (err) {
    // Never let a cascade/side-effect failure block the user's manual edit.
  }
}

// Ghi mốc "Thời điểm từ chối" (nếu chưa có — giữ nguyên mốc cũ nếu bị từ
// chối lại lần 2 mà chưa từng được duyệt lại giữa 2 lần đó), điền cột hiển
// thị "Sẽ xoá lúc"/"Đếm ngược" cho người xem trực tiếp trên Sheet, và báo
// cho Founder (ưu tiên đúng level 'founder'; nếu chưa gán ai làm Founder thì
// báo tạm cho mọi roleLevel='admin' để không rơi vào im lặng không ai biết).
function stampMemberRejection(ss, sheet, headers, row, memberId, memberName) {
  const rejColIdx = headers.indexOf('Thời điểm từ chối');
  if (rejColIdx === -1) return; // chưa chạy addMemberRejectionColumns() — bỏ qua êm, không lỗi
  const existing = sheet.getRange(row, rejColIdx + 1).getValue();
  if (existing) return;

  const now = new Date();
  const deleteAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  sheet.getRange(row, rejColIdx + 1).setValue(now.toISOString());

  const delColIdx = headers.indexOf('Sẽ xoá lúc');
  if (delColIdx !== -1) {
    const delCell = sheet.getRange(row, delColIdx + 1);
    delCell.setValue(deleteAt);
    delCell.setNumberFormat('dd/mm/yyyy hh:mm');
    const cdColIdx = headers.indexOf('Đếm ngược');
    if (cdColIdx !== -1) {
      const a1 = delCell.getA1Notation();
      sheet.getRange(row, cdColIdx + 1).setFormula(
        // 2026-09-16: bảng tính này ở locale VN — Apps Script setFormula() vẫn bị
        // phân tích theo locale sheet (dấu ";" thay ",") giống công thức gõ tay,
        // dùng "," sẽ báo "Lỗi phân tích cú pháp công thức" (đã kiểm chứng thật).
        '=IF(' + a1 + '="";"";IF(' + a1 + '<=NOW();"Đã tới hạn — chờ hệ thống xoá";TEXT(' + a1 + '-NOW();"[h]:mm:ss")))'
      );
    }
    try { ss.setRecalculationInterval(SpreadsheetApp.RecalculationInterval.MINUTE); } catch (e2) { /* không chặn nếu không đổi được */ }
  }

  notifyFounderMemberRejected(ss, memberId, memberName);
}

// Được duyệt lại trước khi hết 48h — xoá sạch mốc cũ để nếu có bị từ chối
// lần sau thì tính lại đủ 48h mới, không kế thừa đồng hồ cũ.
function clearMemberRejection(sheet, headers, row) {
  const rejColIdx = headers.indexOf('Thời điểm từ chối');
  const delColIdx = headers.indexOf('Sẽ xoá lúc');
  const cdColIdx = headers.indexOf('Đếm ngược');
  if (rejColIdx !== -1) sheet.getRange(row, rejColIdx + 1).clearContent();
  if (delColIdx !== -1) sheet.getRange(row, delColIdx + 1).clearContent();
  if (cdColIdx !== -1) sheet.getRange(row, cdColIdx + 1).clearContent();
}

function notifyFounderMemberRejected(ss, memberId, memberName) {
  const members = getAllData(ss, SHEETS.members);
  const founders = members.filter(function (m) { return m.level === 'founder'; });
  const targets = founders.length ? founders : members.filter(function (m) { return m.roleLevel === 'admin'; });
  const name = memberName || memberId;
  targets.forEach(function (f) {
    if (f.id === memberId) return;
    addData(ss, SHEETS.notifications, {
      title: 'Đăng ký bị từ chối: ' + name,
      message: name + ' đã bị từ chối đăng ký tài khoản. Nếu không được duyệt lại, dữ liệu sẽ TỰ ĐỘNG XOÁ VĨNH VIỄN sau 48 giờ.',
      type: 'member',
      scope: f.id,
      recurring: false,
      active: true,
      createdBy: 'SYSTEM'
    });
  });
}

// Thêm 3 cột "Thời điểm từ chối"/"Sẽ xoá lúc"/"Đếm ngược" vào Sheet Thành
// viên nếu chưa có — chạy TAY 1 lần từ trình chỉnh sửa Apps Script trước khi
// tính năng 48h này hoạt động được (giống pattern addDivisionColumns()).
function addMemberRejectionColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const lines = [];
  ['Thời điểm từ chối', 'Sẽ xoá lúc', 'Đếm ngược'].forEach(function (header) {
    if (headers.indexOf(header) !== -1) { lines.push(header + ': đã có sẵn, bỏ qua'); return; }
    const col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(header);
    headers.push(header);
    lines.push(header + ': đã thêm ở cột ' + col);
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// ===== Tự động xoá vĩnh viễn tài khoản bị Từ chối quá 48h (2026-09-16) =====
// Chạy định kỳ qua time-driven trigger (cài 1 LẦN bằng
// setupAutoDeleteRejectedMembersTrigger()). Chỉ xoá khi status HIỆN TẠI vẫn
// là 'rejected' (nếu ai đó đã duyệt lại trước hạn thì status đổi khác rồi,
// tự động bỏ qua — không cần logic huỷ lịch riêng). Xoá từ DƯỚI LÊN để
// index các dòng phía trên không bị lệch sau mỗi lần xoá.
function deleteExpiredRejectedMembers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const data = getAllData(ss, SHEETS.members);
  const now = Date.now();
  const toDelete = [];
  data.forEach(function (m, i) {
    if (m.status !== 'rejected' || !m.rejectedAt) return;
    const t = new Date(m.rejectedAt).getTime();
    if (!isNaN(t) && now - t >= 48 * 60 * 60 * 1000) toDelete.push({ id: m.id, name: m.name, rowIndex: i });
  });
  toDelete.sort(function (a, b) { return b.rowIndex - a.rowIndex; });
  toDelete.forEach(function (t) { sheet.deleteRow(t.rowIndex + 2); });
  const report = 'deleteExpiredRejectedMembers: đã xoá vĩnh viễn ' + toDelete.length + ' tài khoản bị từ chối quá 48h' +
    (toDelete.length ? ' (' + toDelete.map(function (t) { return t.name; }).join(', ') + ')' : '') + '.';
  Logger.log(report);
  return report;
}

// Cài time-driven trigger chạy deleteExpiredRejectedMembers() mỗi 30 phút —
// chạy TAY hàm này ĐÚNG 1 LẦN từ trình chỉnh sửa Apps Script để cài đặt.
// An toàn chạy lại nhiều lần: tự xoá trigger cũ của đúng hàm này trước.
function setupAutoDeleteRejectedMembersTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'deleteExpiredRejectedMembers') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('deleteExpiredRejectedMembers')
    .timeBased()
    .everyMinutes(30)
    .create();
  Logger.log('Đã cài trigger tự động xoá tài khoản bị từ chối quá 48h — chạy mỗi 30 phút.');
}

// Sửa lỗi 1 lần: công thức "Đếm ngược" ban đầu dùng dấu "," làm phân cách
// đối số bị Sheet (locale VN) báo lỗi cú pháp — đã đổi sang ";" trong
// stampMemberRejection(), nhưng dòng nào đã bị Từ chối TRƯỚC lúc sửa vẫn còn
// giữ công thức cũ hỏng. Chạy TAY 1 lần để ghi lại đúng công thức cho các
// dòng đó — an toàn chạy lại nhiều lần (chỉ đụng dòng đang status='rejected'
// và đã có 'Sẽ xoá lúc').
function fixRejectionCountdownFormulas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const delColIdx = headers.indexOf('Sẽ xoá lúc');
  const cdColIdx = headers.indexOf('Đếm ngược');
  if (delColIdx === -1 || cdColIdx === -1) return 'Chưa có cột "Sẽ xoá lúc"/"Đếm ngược" — chạy addMemberRejectionColumns() trước';
  const data = getAllData(ss, SHEETS.members);
  let fixed = 0;
  data.forEach(function (m, i) {
    if (m.status !== 'rejected' || !m.rejectedAt) return;
    const row = i + 2;
    const delCell = sheet.getRange(row, delColIdx + 1);
    if (!delCell.getValue()) return;
    const a1 = delCell.getA1Notation();
    sheet.getRange(row, cdColIdx + 1).setFormula(
      '=IF(' + a1 + '="";"";IF(' + a1 + '<=NOW();"Đã tới hạn — chờ hệ thống xoá";TEXT(' + a1 + '-NOW();"[h]:mm:ss")))'
    );
    fixed++;
  });
  const report = 'Đã sửa lại công thức Đếm ngược cho ' + fixed + ' dòng.';
  Logger.log(report);
  return report;
}

function cascadeMemberIdChange(oldId, newId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  replaceIdInListColumn(ss, SHEETS.tasks, 'assigneeIds', oldId, newId);
  replaceIdInColumn(ss, SHEETS.tasks, 'createdBy', oldId, newId);
  replaceIdInColumn(ss, SHEETS.proposals, 'requesterId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.proposals, 'reviewerId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.timesheet, 'memberId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.payslips, 'memberId', oldId, newId);
  replaceIdInColumn(ss, SHEETS.commissions, 'memberId', oldId, newId);
  replaceIdInListColumn(ss, SHEETS.projects, 'members', oldId, newId);
}

function replaceIdInColumn(ss, sheetName, headerNameEn, oldId, newId) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return;
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(enToViHeader(sheetName, headerNameEn));
  if (colIdx === -1) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  let changed = false;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === oldId) {
      values[i][0] = newId;
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}

// CANONICAL_ID_RE = hình dạng ID "đúng chuẩn hiện tại" mà makeId() sinh ra:
// prefix_YYMMDD_<13 số epoch millis>_<6 số random>. Bắt buộc đúng 13 số ở
// phần timestamp (độ dài thật của Date.now()) để KHÔNG bị nhận nhầm với các
// ID chép tay/seed cũ có hình dạng tương tự nhưng timestamp giả ngắn hơn (VD
// "document_260101_1_562336" — chỉ 1 số ở vị trí timestamp, không phải mã
// thật do makeId() sinh). Đây là hằng số DÙNG CHUNG cho mọi lần "đổi form mã
// ID" sau này — mỗi khi makeId() đổi format, cập nhật lại đúng regex này rồi
// chạy lại normalizeAllLegacyIds(), nó sẽ tự bắt lại MỌI id (cũ hay tưởng là
// mới) không khớp hình dạng hiện tại và sinh lại toàn bộ, không sót.
const CANONICAL_ID_RE = /^[a-zA-Z0-9]+_\d{6}_\d{13}_\d{6}$/;

// MIGRATION DÙNG LẠI ĐƯỢC (2026-09-09, mở rộng lần 2 theo yêu cầu người dùng
// "update toàn bộ dù cũ hay mới, tránh lệch form mã ID") — quét MỌI id không
// khớp CANONICAL_ID_RE ở MỌI sheet (trừ "Thành viên", có scheme riêng), sinh
// mã MỚI HOÀN TOÀN qua makeId() (không phải chỉ nối thêm số như bản đầu) —
// bắt được cả các mã chép tay/seed rất cũ như "task_001", "prj_A",
// "document_260101_1_562336", "timesheet_1788780930898" (thiếu cả phần
// YYMMDD) mà lần chạy đầu (chỉ khớp đúng 1 hình dạng "prefix_YYMMDD_timestamp"
// cụ thể) đã bỏ sót. Chạy TAY từ trình chỉnh sửa Apps Script (chọn hàm này ở
// dropdown rồi bấm Chạy) — không đi qua doGet/doPost. Idempotent: mã đã đúng
// chuẩn hiện tại thì khớp CANONICAL_ID_RE, không bị đổi lại lần 2 — an toàn
// chạy lại bất cứ khi nào, kể cả sau này khi form mã đổi tiếp.
function normalizeAllLegacyIds() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const SKIP_KEYS = ['members'];
  const idMaps = {}; // sheetKey -> { oldId: newId }
  const summary = [];

  Object.keys(SHEETS).forEach(function (key) {
    if (SKIP_KEYS.indexOf(key) !== -1) return;
    const sheetName = SHEETS[key];
    const sheet = findSheet(ss, sheetName);
    if (!sheet) return;
    const headers = getHeaders(sheet);
    const idColIdx = headers.map(function (h) { return viToEnHeader(sheetName, h); }).indexOf('id');
    if (idColIdx === -1) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const range = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1);
    const values = range.getValues();
    const map = {};
    let changed = false;
    // Tiền tố y hệt logic addData()/addDataBatch() dùng khi tạo id mới, để id
    // sinh lại ở đây có cùng "họ" tiền tố với id sinh ra từ giờ về sau.
    const prefix = key.toLowerCase().replace(/s$/, '');
    for (let i = 0; i < values.length; i++) {
      const oldId = String(values[i][0] || '');
      if (oldId && !CANONICAL_ID_RE.test(oldId)) {
        const newId = makeId(prefix);
        map[oldId] = newId;
        values[i][0] = newId;
        changed = true;
      }
    }
    if (changed) {
      range.setValues(values);
      idMaps[key] = map;
      summary.push(sheetName + ': ' + Object.keys(map).length);
    }
  });

  // Cascade sang các cột khoá ngoại (FK) ở sheet khác đang tham chiếu tới id vừa đổi.
  const FK_PLAN = [
    { refKey: 'projects', field: 'projectId', targets: ['tasks', 'commissions', 'receivables', 'orders', 'contractorComparisons', 'cashFlowPlans', 'changeOrders', 'scheduleItems', 'acceptanceChecks', 'projectDocuments', 'bimIssues', 'bimBoqItems'] },
    { refKey: 'financeEntries', field: 'linkedFinanceEntryId', targets: ['orders'] },
    { refKey: 'bimMaterials', field: 'materialId', targets: ['bimProducts'] },
    { refKey: 'bimProducts', field: 'productId', targets: ['bimBoqItems'] }
  ];
  FK_PLAN.forEach(function (plan) {
    const map = idMaps[plan.refKey];
    if (!map) return;
    Object.keys(map).forEach(function (oldId) {
      plan.targets.forEach(function (targetKey) {
        replaceIdInColumn(ss, SHEETS[targetKey], plan.field, oldId, map[oldId]);
      });
    });
  });

  Logger.log('Đã đổi ID: ' + JSON.stringify(summary));
  return summary;
}

// Chèn cột phụ trợ "Tên dự án" (VLOOKUP theo cột projectId của từng sheet,
// tra 'Dự án'!A:B) ngay sau cột projectId, cho MỌI sheet có field projectId
// còn thiếu cột này — làm nốt việc dở dang đã làm tay 1/12 sheet (Công việc)
// trước đó, giờ làm hết 1 lượt qua script thay vì thao tác chuột trên UI
// (UI Bảng/Table dễ bị lag/revert khi sửa header bằng automation). Chạy TAY
// 1 lần từ trình chỉnh sửa Apps Script. Idempotent: sheet đã có cột "Tên dự
// án" thì bị bỏ qua, an toàn chạy lại nhiều lần.
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function addTenDuAnLookupColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const TARGET_KEYS = ['commissions', 'receivables', 'orders', 'contractorComparisons',
    'cashFlowPlans', 'changeOrders', 'scheduleItems', 'acceptanceChecks',
    'projectDocuments', 'bimIssues', 'bimBoqItems'];
  const summary = [];
  TARGET_KEYS.forEach(function (key) {
    const sheetName = SHEETS[key];
    try {
      const sheet = findSheet(ss, sheetName);
      if (!sheet) { summary.push(sheetName + ': sheet không tồn tại'); return; }
      const headers = getHeaders(sheet);
      if (headers.indexOf('Tên dự án') !== -1) { summary.push(sheetName + ': đã có, bỏ qua'); return; }
      const projectIdColIdx = headers.map(function (h) { return viToEnHeader(sheetName, h); }).indexOf('projectId');
      if (projectIdColIdx === -1) { summary.push(sheetName + ': không tìm thấy cột projectId'); return; }
      const projectIdCol1Based = projectIdColIdx + 1;
      const projectIdLetter = colLetter(projectIdCol1Based);
      sheet.insertColumnAfter(projectIdCol1Based);
      const newColIdx = projectIdCol1Based + 1;
      const newColRangeWide = sheet.getRange(1, newColIdx, Math.max(sheet.getLastRow(), 2), 1);
      // Cột vừa chèn đôi khi thừa hưởng 1 quy tắc xác thực dữ liệu "mồ côi"
      // dính vào đúng vị trí cột/ô đó từ thời sheet còn là Bảng (Table) rồi bị
      // chuyển đổi qua lại — xoá sạch trước để formula chắc chắn ghi được.
      newColRangeWide.clearDataValidations();
      sheet.getRange(1, newColIdx).setValue('Tên dự án');
      const lastRow = sheet.getLastRow();
      let failedRows = 0;
      if (lastRow >= 2) {
        const numRows = lastRow - 1;
        const formulas = [];
        for (let r = 2; r <= lastRow; r++) {
          formulas.push(["=IFERROR(VLOOKUP($" + projectIdLetter + r + ";'Dự án'!$A:$B;2;FALSE);\"\")"]);
        }
        try {
          sheet.getRange(2, newColIdx, numRows, 1).setFormulas(formulas);
        } catch (bulkErr) {
          // 1 vài ô cụ thể vẫn có thể bị chặn dù đã xoá validation ở trên (VD
          // rule đặt lại đúng lúc ghi) — fallback ghi từng dòng, bỏ qua dòng lỗi
          // thay vì mất trắng cả sheet.
          for (let r = 2; r <= lastRow; r++) {
            try {
              sheet.getRange(r, newColIdx).setFormula(formulas[r - 2][0]);
            } catch (rowErr) {
              failedRows++;
            }
          }
        }
      }
      summary.push(sheetName + ': đã thêm cột ở vị trí ' + colLetter(newColIdx) + (failedRows ? (' (LỖI ' + failedRows + ' dòng)') : ''));
    } catch (sheetErr) {
      summary.push(sheetName + ': LỖI — ' + sheetErr.message);
    }
  });
  Logger.log('Kết quả thêm cột "Tên dự án": ' + JSON.stringify(summary));
  return summary;
}

// Vá lại các ô "Tên dự án" bị bỏ trống do addTenDuAnLookupColumns() ở trên
// gặp lỗi validation giữa chừng ở 1 số sheet (cột đã có header nhưng công
// thức chưa ghi được cho mọi dòng) — chạy sau addTenDuAnLookupColumns(), an
// toàn chạy lại nhiều lần (chỉ đụng ô đang trống VÀ không có công thức).
function backfillMissingTenDuAnFormulas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const TARGET_KEYS = ['commissions', 'receivables', 'orders', 'contractorComparisons',
    'cashFlowPlans', 'changeOrders', 'scheduleItems', 'acceptanceChecks',
    'projectDocuments', 'bimIssues', 'bimBoqItems'];
  const summary = [];
  TARGET_KEYS.forEach(function (key) {
    const sheetName = SHEETS[key];
    try {
      const sheet = findSheet(ss, sheetName);
      if (!sheet) return;
      const headers = getHeaders(sheet);
      const tenDuAnColIdx = headers.indexOf('Tên dự án');
      const projectIdColIdx = headers.map(function (h) { return viToEnHeader(sheetName, h); }).indexOf('projectId');
      if (tenDuAnColIdx === -1 || projectIdColIdx === -1) return;
      const projectIdLetter = colLetter(projectIdColIdx + 1);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;
      const range = sheet.getRange(2, tenDuAnColIdx + 1, lastRow - 1, 1);
      const formulasNow = range.getFormulas();
      range.clearDataValidations();
      let fixed = 0, stillFailed = 0;
      for (let i = 0; i < formulasNow.length; i++) {
        if (formulasNow[i][0]) continue; // đã có công thức, bỏ qua
        const r = i + 2;
        try {
          sheet.getRange(r, tenDuAnColIdx + 1).setFormula("=IFERROR(VLOOKUP($" + projectIdLetter + r + ";'Dự án'!$A:$B;2;FALSE);\"\")");
          fixed++;
        } catch (e) {
          stillFailed++;
        }
      }
      if (fixed || stillFailed) summary.push(sheetName + ': vá ' + fixed + ' dòng' + (stillFailed ? (', vẫn lỗi ' + stillFailed) : ''));
    } catch (e) {
      summary.push(sheetName + ': LỖI — ' + e.message);
    }
  });
  Logger.log('Kết quả vá công thức "Tên dự án": ' + JSON.stringify(summary));
  return summary;
}

// Chèn cột "Ngày hoàn thành" (completedAt) cho tasks + projects nếu chưa có,
// và VÁ cho những dòng ĐÃ 'Hoàn thành' từ trước (trước khi field này tồn tại)
// bằng "Ngày cập nhật" (ước lượng tốt nhất hiện có) rồi "Ngày tạo" nếu không
// có Ngày cập nhật — để chúng còn hiện đúng 1 tuần rồi tự ẩn khỏi cột "Hoàn
// thành" trên Kanban thay vì hiện MÃI MÃI (không có completedAt) hoặc BIẾN
// MẤT NGAY (completedAt rỗng bị coi là "không phải tuần này"). Chạy TAY 1 lần
// từ trình chỉnh sửa Apps Script, an toàn chạy lại (chỉ vá ô đang trống).
function addCompletedAtColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const TARGET_KEYS = ['tasks', 'projects'];
  const summary = [];
  TARGET_KEYS.forEach(function (key) {
    const sheetName = SHEETS[key];
    try {
      const sheet = findSheet(ss, sheetName);
      if (!sheet) { summary.push(sheetName + ': sheet không tồn tại'); return; }
      let headers = getHeaders(sheet);
      let colIdx = headers.indexOf('Ngày hoàn thành');
      if (colIdx === -1) {
        const newColIdx1Based = headers.length + 1;
        sheet.getRange(1, newColIdx1Based).setValue('Ngày hoàn thành');
        sheet.getRange(1, newColIdx1Based, Math.max(sheet.getLastRow(), 2), 1).clearDataValidations();
        headers = getHeaders(sheet);
        colIdx = headers.indexOf('Ngày hoàn thành');
      }
      const col1Based = colIdx + 1;
      const statusColIdx = headers.indexOf('Trạng thái');
      const updatedAtColIdx = headers.indexOf('Ngày cập nhật');
      const createdAtColIdx = headers.indexOf('Ngày tạo');
      const lastRow = sheet.getLastRow();
      if (lastRow < 2 || statusColIdx === -1) { summary.push(sheetName + ': đã có cột, không có dữ liệu để vá'); return; }
      const numRows = lastRow - 1;
      const statusVals = sheet.getRange(2, statusColIdx + 1, numRows, 1).getValues();
      const completedAtRange = sheet.getRange(2, col1Based, numRows, 1);
      const completedAtVals = completedAtRange.getValues();
      const updatedAtVals = updatedAtColIdx !== -1 ? sheet.getRange(2, updatedAtColIdx + 1, numRows, 1).getValues() : null;
      const createdAtVals = createdAtColIdx !== -1 ? sheet.getRange(2, createdAtColIdx + 1, numRows, 1).getValues() : null;
      let patched = 0;
      for (let i = 0; i < numRows; i++) {
        const isCompleted = String(statusVals[i][0]).trim() === 'Hoàn thành';
        if (!isCompleted || completedAtVals[i][0]) continue;
        const fallback = (updatedAtVals && updatedAtVals[i][0]) || (createdAtVals && createdAtVals[i][0]) || '';
        if (fallback) { completedAtVals[i][0] = fallback; patched++; }
      }
      if (patched) completedAtRange.setValues(completedAtVals);
      summary.push(sheetName + ': đã có cột "Ngày hoàn thành" ở vị trí ' + colLetter(col1Based) + ', vá ' + patched + ' dòng');
    } catch (e) {
      summary.push(sheetName + ': LỖI — ' + e.message);
    }
  });
  Logger.log('completedAt: ' + JSON.stringify(summary));
  return summary;
}

// ===== Tự động đóng ca "quên check-out" (2026-09-12) =====
// Chạy 1 lần/ngày qua time-driven trigger (cài 1 LẦN bằng
// setupAutoCheckoutTrigger(), xem cuối hàm — không tự cài lại mỗi lần đọc
// file). Quét mọi dòng "Chấm công" của các ngày ĐÃ QUA còn status='working'
// (đã check-in, chưa check-out) — đóng ca bằng CHÍNH giờ check-in (0 giờ
// công), KHÔNG suy đoán giờ tan làm thật để tránh tính khống/thiếu công,
// luôn kèm ghi chú cảnh báo rõ ràng + gửi thông báo nội bộ (sheet "Thông
// báo" có sẵn cơ chế hiển thị trên web) cho CHÍNH người quên VÀ mọi
// CEO/Manager để biết mà xác nhận lại thủ công.
var AUTO_CHECKOUT_NOTE_TAG = '[TỰ ĐỘNG ĐÓNG CA — QUÊN CHECK-OUT]'; // PHẢI khớp TS_AUTO_CHECKOUT_TAG trong timesheet.html
function autoCheckoutForgottenEntries() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const todayKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const entries = getAllData(ss, SHEETS.timesheet);
  const members = getAllData(ss, SHEETS.members);
  const memberById = {};
  members.forEach(function (m) { memberById[m.id] = m; });
  const managers = members.filter(function (m) { return m.roleLevel === 'admin' || m.roleLevel === 'manager'; });

  const fixed = [];
  entries.forEach(function (e) {
    if (e.status !== 'working') return;
    if (!e.date || e.date >= todayKey) return; // chỉ đóng ca của ngày ĐÃ QUA — hôm nay vẫn tự check-out bình thường
    if (!e.checkinTime) return; // dữ liệu hỏng (không có giờ check-in) — bỏ qua, không đoán bừa
    const note = (e.note ? e.note + ' | ' : '') + AUTO_CHECKOUT_NOTE_TAG + ' lúc ' + e.checkinTime + ' — vui lòng xác nhận lại giờ làm thực tế.';
    updateData(ss, SHEETS.timesheet, e.id, {
      checkoutTime: e.checkinTime,
      totalHours: 0,
      overtimeHours: 0,
      status: 'completed',
      note: note
    });
    fixed.push(e);
  });

  fixed.forEach(function (e) {
    const member = memberById[e.memberId];
    const name = member ? member.name : e.memberId;
    const msg = name + ' quên check-out ngày ' + e.date + ' (check-in lúc ' + e.checkinTime + ') — hệ thống đã tự động đóng ca (0 giờ công), vui lòng kiểm tra và điều chỉnh lại nếu cần.';
    addData(ss, SHEETS.notifications, {
      title: 'Quên check-out ngày ' + e.date,
      message: msg,
      type: 'attendance',
      scope: e.memberId,
      recurring: false,
      active: true,
      createdBy: 'SYSTEM'
    });
    managers.forEach(function (mgr) {
      if (mgr.id === e.memberId) return; // tránh gửi trùng nếu chính người quên lại là CEO/Manager
      addData(ss, SHEETS.notifications, {
        title: 'NV quên check-out: ' + name,
        message: msg,
        type: 'attendance',
        scope: mgr.id,
        recurring: false,
        active: true,
        createdBy: 'SYSTEM'
      });
    });
  });

  Logger.log('autoCheckoutForgottenEntries: đã tự đóng ' + fixed.length + ' ca quên check-out.');
  return fixed.length;
}

// Cài time-driven trigger chạy autoCheckoutForgottenEntries() mỗi ngày lúc
// ~0h05 — chạy TAY hàm này ĐÚNG 1 LẦN từ trình chỉnh sửa Apps Script để cài
// đặt (Chạy > chọn setupAutoCheckoutTrigger). An toàn chạy lại nhiều lần:
// tự xoá trigger cũ của đúng hàm này trước khi tạo lại, không tạo trùng.
function setupAutoCheckoutTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'autoCheckoutForgottenEntries') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoCheckoutForgottenEntries')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .nearMinute(5)
    .create();
  Logger.log('Đã cài trigger tự động đóng ca — chạy hàng ngày lúc ~0h05.');
}

// Tạo sheet "Địa điểm chấm công" ngay CẠNH sheet "Chấm công" (nếu chưa có) và
// seed sẵn 1 điểm GPS + 2 IP đang hard-code trong timesheet.html (GEO_RESTRICTION/
// IP_RESTRICTION), để chuyển hẳn qua quản lý bằng Sheet — thêm/sửa/xoá GPS hoặc
// IP mới chỉ cần thêm dòng trên Sheet, không cần sửa code/redeploy nữa.
// Chạy TAY hàm này ĐÚNG 1 LẦN từ trình chỉnh sửa Apps Script. An toàn chạy lại
// nhiều lần: chỉ seed khi sheet đang trống, không tạo trùng dữ liệu.
function seedAttendanceLocations() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tsSheet = findSheet(ss, SHEETS.timesheet);
  let sheet = findSheet(ss, SHEETS.attendanceLocations);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.attendanceLocations, tsSheet ? tsSheet.getIndex() : ss.getSheets().length);
  }
  if (sheet.getLastRow() >= 2) {
    Logger.log('Sheet "' + SHEETS.attendanceLocations + '" đã có dữ liệu — không seed lại.');
    return;
  }
  const seedRows = [
    { name: 'Văn phòng — 167 Trường Chinh, Lê Thanh Nghị, Hải Phòng', lat: 20.926738, lng: 106.301584, radiusMeters: 50, ip: '', active: true, note: 'GPS văn phòng chính' },
    { name: 'Wifi văn phòng (IP 1)', lat: '', lng: '', radiusMeters: '', ip: '14.171.113.174', active: true, note: '' },
    { name: 'Wifi văn phòng (IP 2)', lat: '', lng: '', radiusMeters: '', ip: '172.225.56.21', active: true, note: 'Thêm 2026-09-11 theo report thực tế' }
  ];
  seedRows.forEach(function (row) { addData(ss, SHEETS.attendanceLocations, row); });
  Logger.log('Đã seed ' + seedRows.length + ' dòng vào sheet "' + SHEETS.attendanceLocations + '".');
}

function replaceIdInListColumn(ss, sheetName, headerNameEn, oldId, newId) {
  const sheet = findSheet(ss, sheetName);
  if (!sheet) return;
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(enToViHeader(sheetName, headerNameEn));
  if (colIdx === -1) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  let changed = false;
  for (let i = 0; i < values.length; i++) {
    const raw = values[i][0];
    if (!raw) continue;
    // Members lists show up as either a real JSON array (newer rows, written by
    // addData/updateData) or a plain comma-separated string (older seed rows).
    // Handle both, and write back in whichever shape the cell already used.
    let arr, isJson;
    try {
      arr = JSON.parse(raw);
      isJson = Array.isArray(arr);
    } catch (e2) {
      isJson = false;
    }
    if (!isJson) {
      arr = String(raw).split(',').map(function (s) { return s.trim(); });
    }
    const idx = arr.indexOf(oldId);
    if (idx !== -1) {
      arr[idx] = newId;
      values[i][0] = isJson ? JSON.stringify(arr) : arr.join(',');
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}

// MIGRATION 1 LẦN (2026-09-10, bản 2 — đổi từ mảng JSON sang CHUỖI PHẨY) —
// cột "Mã người phụ trách" (Công việc) ban đầu được chuyển sang mảng JSON
// (`["id"]`) để hỗ trợ nhiều người phụ trách, nhưng sau đó phát hiện Sheets
// dropdown "Cho phép có nhiều lựa chọn" (bật trực tiếp trên Sheet UI) lại tự
// lưu dạng CHUỖI PHẨY ("id1, id2"), không phải JSON — nên đổi hẳn sang đúng
// định dạng đó để CEO/manager sửa trực tiếp trên Sheet không phá dropdown.
// Chạy TAY từ trình chỉnh sửa Apps Script. Idempotent: ô không còn ký tự "["
// ở đầu thì bỏ qua, chạy lại nhiều lần không hỏng dữ liệu.
function migrateTaskAssigneeToCommaFormat() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.tasks);
  if (!sheet) return 'Không tìm thấy sheet Công việc';
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(enToViHeader(SHEETS.tasks, 'assigneeIds'));
  if (colIdx === -1) return 'Không tìm thấy cột Mã người phụ trách';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet trống, không có gì để chuyển';
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  let changed = 0;
  for (let i = 0; i < values.length; i++) {
    const raw = values[i][0];
    if (!raw) continue;
    const str = String(raw).trim();
    if (str.charAt(0) !== '[') continue; // đã là chuỗi phẩy (hoặc mã đơn) rồi
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) {
        values[i][0] = arr.join(', ');
        changed++;
      }
    } catch (e) { /* không phải JSON hợp lệ, bỏ qua */ }
  }
  if (changed) range.setValues(values);
  Logger.log('Đã chuyển ' + changed + ' dòng sang chuỗi phẩy');
  return 'Đã chuyển ' + changed + ' dòng sang chuỗi phẩy';
}

// MIGRATION 1 LẦN (2026-09-10) — cùng lý do/cách làm với
// migrateTaskAssigneeToCommaFormat() ở trên, áp dụng cho cột "Thành viên
// tham gia" (Dự án, field members): đổi từ mảng JSON sang chuỗi phẩy để khớp
// đúng định dạng dropdown "Cho phép có nhiều lựa chọn" gốc của Sheets. Chạy
// TAY từ trình chỉnh sửa Apps Script. Idempotent.
function migrateProjectMembersToCommaFormat() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.projects);
  if (!sheet) return 'Không tìm thấy sheet Dự án';
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(enToViHeader(SHEETS.projects, 'members'));
  if (colIdx === -1) return 'Không tìm thấy cột Thành viên tham gia';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet trống, không có gì để chuyển';
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  let changed = 0;
  for (let i = 0; i < values.length; i++) {
    const raw = values[i][0];
    if (!raw) continue;
    const str = String(raw).trim();
    if (str.charAt(0) !== '[') continue; // đã là chuỗi phẩy (hoặc mã đơn) rồi
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) {
        values[i][0] = arr.join(', ');
        changed++;
      }
    } catch (e) { /* không phải JSON hợp lệ, bỏ qua */ }
  }
  if (changed) range.setValues(values);
  Logger.log('Đã chuyển ' + changed + ' dòng sang chuỗi phẩy');
  return 'Đã chuyển ' + changed + ' dòng sang chuỗi phẩy';
}

// Kiểm tra toàn bộ cột enum có trong VALUE_MAP (2026-09-15, theo yêu cầu
// người dùng "kiểm tra lại toàn bộ các sheet xem đúng thông tin dropdown
// chưa"): với mỗi field, so khớp (1) danh sách dropdown đang đặt trên Sheet
// so với nhãn đúng trong VALUE_MAP, và (2) quét toàn bộ dữ liệu cột đó tìm
// giá trị KHÔNG khớp nhãn nào (dữ liệu lạ/hỏng, VD giá trị tiếng Anh thô lọt
// vào do ghi tay/import ngoài luồng addData()). Chạy TAY 1 lần từ Apps
// Script editor, đọc kết quả trong Logger — KHÔNG tự sửa gì, chỉ báo cáo.
function auditDropdowns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const lines = [];
  Object.keys(VALUE_MAP).forEach(function (key) {
    const dot = key.indexOf('.');
    const sheetKey = key.slice(0, dot);
    const enKey = key.slice(dot + 1);
    const sheetName = SHEETS[sheetKey];
    if (!sheetName) { lines.push(key + ': SHEETS.' + sheetKey + ' không tồn tại'); return; }
    const sheet = findSheet(ss, sheetName);
    if (!sheet) { lines.push(key + ' [' + sheetName + ']: KHÔNG TÌM THẤY SHEET'); return; }
    const headers = getHeaders(sheet);
    const viHeader = enToViHeader(sheetName, enKey);
    const colIdx = headers.indexOf(viHeader);
    if (colIdx === -1) { lines.push(key + ' [' + sheetName + ']: KHÔNG TÌM THẤY CỘT "' + viHeader + '"'); return; }
    const validLabels = VALUE_MAP[key].map(function (p) { return p[0]; });

    let dvStatus = 'CHƯA CÓ dropdown';
    const rule = sheet.getRange(2, colIdx + 1).getDataValidation();
    if (rule) {
      let listed = null;
      try { listed = rule.getCriteriaValues()[0]; } catch (e) { /* không phải kiểu danh sách */ }
      if (Array.isArray(listed)) {
        const a = listed.slice().sort().join('|');
        const b = validLabels.slice().sort().join('|');
        dvStatus = a === b ? 'OK' : 'SAI — đang là [' + listed.join(', ') + ']';
      } else {
        dvStatus = 'có dropdown nhưng không đọc được danh sách (có thể theo dải ô)';
      }
    }

    const lastRow = sheet.getLastRow();
    const badCounts = {};
    if (lastRow >= 2) {
      sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues().forEach(function (r) {
        const v = String(r[0] == null ? '' : r[0]).trim();
        if (v && validLabels.indexOf(v) === -1) badCounts[v] = (badCounts[v] || 0) + 1;
      });
    }
    const badList = Object.keys(badCounts).map(function (v) { return v + ' x' + badCounts[v]; }).join(', ');

    lines.push(key + ' [' + sheetName + '!' + viHeader + ']: dropdown ' + dvStatus +
      (badList ? '; DỮ LIỆU LẠ: ' + badList : '; dữ liệu OK'));
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Việt hoá dữ liệu CŨ (ghi trước khi VALUE_MAP có field này, hoặc ghi tay/
// import ngoài luồng addData()/updateData() — 2 hàm đó mới tự dịch VI↔EN):
// quét mỗi cột trong VALUE_MAP, cell nào đang là ĐÚNG key tiếng Anh thô
// (p[1]) thì đổi thành nhãn tiếng Việt tương ứng (p[0]). Bỏ qua cell đã
// đúng nhãn VI hoặc giá trị lạ không khớp key nào (VD "pending" ở
// orders.status — xem fixOrdersPendingStatus() riêng bên dưới, giá trị đó
// không phải 1 trong 4 trạng thái hợp lệ nên hàm này không tự đoán được).
// Idempotent — chạy lại nhiều lần không sao, KHÔNG đụng dữ liệu đã đúng.
function backfillValueMapLabels() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const lines = [];
  Object.keys(VALUE_MAP).forEach(function (key) {
    const dot = key.indexOf('.');
    const sheetKey = key.slice(0, dot);
    const enKey = key.slice(dot + 1);
    const sheetName = SHEETS[sheetKey];
    if (!sheetName) return;
    const sheet = findSheet(ss, sheetName);
    if (!sheet) return;
    const headers = getHeaders(sheet);
    const viHeader = enToViHeader(sheetName, enKey);
    const colIdx = headers.indexOf(viHeader);
    if (colIdx === -1) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
    const values = range.getValues();
    const pairs = VALUE_MAP[key];
    let changed = 0;
    for (let i = 0; i < values.length; i++) {
      const raw = String(values[i][0] == null ? '' : values[i][0]).trim();
      if (!raw) continue;
      const hit = pairs.filter(function (p) { return p[1] === raw; })[0];
      if (hit) { values[i][0] = hit[0]; changed++; }
    }
    if (changed) range.setValues(values);
    if (changed) lines.push(key + ' [' + sheetName + '!' + viHeader + ']: đã Việt hoá ' + changed + ' dòng');
  });
  const report = lines.length ? lines.join('\n') : 'Không có dòng nào cần Việt hoá.';
  Logger.log(report);
  return report;
}

// 1 lần duy nhất (2026-09-15, theo xác nhận người dùng): 7 đơn hàng ghi
// trạng thái "pending" thô — KHÔNG khớp bất kỳ trạng thái hợp lệ nào của
// orders.status (draft/confirmed/paid/cancelled) nên backfillValueMapLabels()
// ở trên không tự sửa được. Những đơn này đã chốt với khách (ghi chú "Tạm
// ứng 50%"), chỉ chưa nhận khoản tạm ứng → map sang 'confirmed' (Đã xác
// nhận), không phải 'draft' (Nháp).
function fixOrdersPendingStatus() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.orders);
  if (!sheet) return 'Không tìm thấy sheet Đơn hàng';
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf(enToViHeader(SHEETS.orders, 'status'));
  if (colIdx === -1) return 'Không tìm thấy cột Trạng thái';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet trống';
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  let changed = 0;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === 'pending') { values[i][0] = 'Đã xác nhận'; changed++; }
  }
  if (changed) range.setValues(values);
  Logger.log('Đã sửa ' + changed + ' đơn hàng "pending" thành "Đã xác nhận"');
  return 'Đã sửa ' + changed + ' đơn hàng "pending" thành "Đã xác nhận"';
}

// Gộp cả 3 bước trên thành 1 lệnh chạy duy nhất (2026-09-15) — tránh phải
// đổi hàm đang chọn trong dropdown "Chọn hàm để chạy" nhiều lần liên tiếp
// (từng bị chọn nhầm hàm cũ do dropdown đó không tin cậy khi đổi lựa chọn
// liên tục, xem GHI_CHU_DU_AN.md). Chạy hàm NÀY một lần duy nhất là đủ.
function runDropdownCleanupAll() {
  const a = backfillValueMapLabels();
  const b = fixOrdersPendingStatus();
  const c = applyStandardDropdowns();
  const report = a + '\n\n' + b + '\n\n' + c;
  Logger.log(report);
  return report;
}

// Chẩn đoán: applyStandardDropdowns() báo lỗi "không được phép ở các ô
// trong các cột đã nhập" cho 1 số cột dù dòng 2 không có dropdown-màu (kiểu
// "Dropdown" mới của Sheets) — nghĩa là có dòng KHÁC trong cột đó đang bị
// gắn dropdown-màu, chặn cả vùng ghi. Hàm này quét TỪNG DÒNG của các cột bị
// lỗi để tìm đúng dòng thủ phạm (chỉ chạy 1 lần để tra cứu, không sửa gì).
function findBlockingValidationRows() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const targets = ['members.level', 'tasks.status', 'projects.status', 'notifications.type'];
  const lines = [];
  targets.forEach(function (key) {
    const dot = key.indexOf('.');
    const sheetKey = key.slice(0, dot);
    const enKey = key.slice(dot + 1);
    const sheetName = SHEETS[sheetKey];
    const sheet = findSheet(ss, sheetName);
    if (!sheet) { lines.push(key + ': không tìm thấy sheet'); return; }
    const headers = getHeaders(sheet);
    const viHeader = enToViHeader(sheetName, enKey);
    const colIdx = headers.indexOf(viHeader);
    if (colIdx === -1) { lines.push(key + ': không tìm thấy cột'); return; }
    // Quét TOÀN BỘ lưới (đến maxRows, không chỉ lastRow) — dòng thủ phạm có
    // thể nằm ngoài vùng dữ liệu thật (ai đó lỡ gắn dropdown-màu vào 1 ô
    // trống xa bên dưới). getDataValidations() đọc cả vùng 1 lần cho nhanh
    // thay vì gọi từng ô (rất chậm nếu maxRows lớn).
    const maxRows = sheet.getMaxRows();
    const dvs = sheet.getRange(2, colIdx + 1, maxRows - 1, 1).getDataValidations();
    let firstRow = -1, lastRowFound = -1, count = 0;
    for (let i = 0; i < dvs.length; i++) {
      if (dvs[i][0]) {
        if (firstRow === -1) firstRow = i + 2;
        lastRowFound = i + 2;
        count++;
      }
    }
    lines.push(key + ' [' + sheetName + '!' + viHeader + ', dòng 2-' + maxRows + ']: ' +
      (count ? count + ' dòng có validation, từ dòng ' + firstRow + ' đến dòng ' + lastRowFound : 'không có dòng nào có validation'));
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Đặt dropdown ĐÚNG nhãn VALUE_MAP cho mọi field trong VALUE_MAP, áp dụng
// cho 999 dòng kể từ dòng 2 (đủ rộng cho mọi sheet hiện tại, giống cách
// dropdown thành viên ở Đề xuất đang dùng $A$2:$A$499). Chạy SAU
// backfillValueMapLabels()/fixOrdersPendingStatus() ở trên (thứ tự không
// bắt buộc — Sheets không xoá dữ liệu cũ không khớp dropdown mới, chỉ gạch
// đỏ cảnh báo — nhưng chạy sau thì sạch ngay, không thấy cảnh báo thừa).
// Chạy TAY 1 lần, an toàn chạy lại nhiều lần (ghi đè cùng 1 rule).

// Đổi tên 26 sheet NGHIỆP VỤ THẬT sang tên có tiền tố nhóm (khớp CHÍNH XÁC
// với SHEETS map ở đầu file — sửa map trước, chạy hàm này ngay sau, rồi
// TRIỂN KHAI PHIÊN BẢN MỚI ngay lập tức, không để hở). Map cũ->mới viết tay
// (không dựa vào SHEETS vì SHEETS lúc chạy hàm này đã là tên MỚI rồi).
function renameRealSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const map = {
    'Dự án': 'DA-Dự án',
    'Công việc': 'DA-Công việc',
    'Thành viên': 'NS-Thành viên',
    'Đề xuất': 'DA-Đề xuất',
    'Chấm công': 'TLCC-Chấm công',
    'Địa điểm chấm công': 'TLCC-Địa điểm chấm công',
    'Thông báo': 'TT-Thông báo',
    'Bảng tin': 'TT-Bảng tin',
    'Tài liệu': 'TT-Tài liệu',
    'Phiếu lương': 'TLCC-Phiếu lương',
    'Hoa hồng dự án': 'TLCC-Hoa hồng dự án',
    'Mức hoa hồng': 'TLCC-Mức hoa hồng',
    'Bảng giá dịch vụ': 'TC-Bảng giá dịch vụ',
    'Tài chính công ty': 'TC-Tài chính công ty',
    'Công nợ khách hàng': 'TC-Công nợ khách hàng',
    'Chỉ số cân đối kế toán': 'TC-Chỉ số cân đối kế toán',
    'Đơn hàng': 'TC-Đơn hàng',
    'So sánh nhà thầu': 'DA-So sánh nhà thầu',
    'Dòng tiền': 'DA-Dòng tiền',
    'Phát sinh': 'DA-Phát sinh',
    'Tiến độ': 'DA-Tiến độ',
    'Nghiệm thu': 'DA-Nghiệm thu',
    'Hồ sơ công trình': 'DA-Hồ sơ công trình',
    'Sản phẩm BIM': 'BIM-Sản phẩm',
    'Vật liệu BIM': 'BIM-Vật liệu',
    'Nhà cung cấp BIM': 'BIM-Nhà cung cấp',
    'Issue BIM': 'BIM-Issue',
    'BOQ BIM': 'BIM-BOQ'
  };
  const lines = [];
  Object.keys(map).forEach(function (oldName) {
    const sheet = ss.getSheetByName(oldName);
    if (!sheet) { lines.push(oldName + ': không tìm thấy (bỏ qua)'); return; }
    sheet.setName(map[oldName]);
    lines.push(oldName + ' -> ' + map[oldName]);
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Liệt kê TOÀN BỘ tên sheet hiện có trong file, theo đúng thứ tự tab trên
// Sheet — dùng để lên kế hoạch đổi tên hàng loạt (thêm tiền tố theo nhóm,
// bỏ "Bản sao của "...) mà không phải đoán từ ảnh chụp màn hình.
// Đổi tên hàng loạt 46 sheet tham khảo (bảng đơn giá xây dựng 34 tỉnh + vài
// sheet công cụ đi kèm) — bỏ tiền tố "Bản sao của " và thay bằng "DGXD-"
// (Đơn giá xây dựng) để gọn, dễ phân biệt với các sheet nghiệp vụ thật.
// AN TOÀN 100% với web app: các sheet này KHÔNG có trong SHEETS map
// (gsheets-api-v2.js dòng 6-45) nên code không tham chiếu theo tên, đổi tên
// không cần redeploy. Idempotent — sheet nào đã đổi tên rồi (không còn bắt
// đầu bằng "Bản sao của ") thì bỏ qua.
function renameCopySheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const prefix = 'Bản sao của ';
  const sheets = ss.getSheets();
  const lines = [];
  sheets.forEach(function (sh) {
    const name = sh.getName();
    if (name.indexOf(prefix) === 0) {
      const newName = 'DGXD-' + name.slice(prefix.length);
      sh.setName(newName);
      lines.push(name + ' -> ' + newName);
    }
  });
  const report = lines.length ? lines.join('\n') : 'Không có sheet nào tên bắt đầu bằng "Bản sao của ".';
  Logger.log(report);
  return report;
}

function listAllSheetNames() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const lines = sheets.map(function (sh, i) { return (i + 1) + '. ' + sh.getName(); });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

function applyStandardDropdowns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const lines = [];
  Object.keys(VALUE_MAP).forEach(function (key) {
    try {
      const dot = key.indexOf('.');
      const sheetKey = key.slice(0, dot);
      const enKey = key.slice(dot + 1);
      const sheetName = SHEETS[sheetKey];
      if (!sheetName) return;
      const sheet = findSheet(ss, sheetName);
      if (!sheet) { lines.push(key + ': không tìm thấy sheet ' + sheetName); return; }
      const headers = getHeaders(sheet);
      const viHeader = enToViHeader(sheetName, enKey);
      const colIdx = headers.indexOf(viHeader);
      if (colIdx === -1) { lines.push(key + ': không tìm thấy cột ' + viHeader); return; }
      const labels = VALUE_MAP[key].map(function (p) { return p[0]; });
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(labels, true).setAllowInvalid(false).build();
      // Chỉ áp dụng cho vùng dữ liệu thật + đệm 50 dòng cho tăng trưởng gần
      // (KHÔNG dùng toàn bộ maxRows) — nhiều cột (roleLevel, status, loại
      // thông báo...) có 1 khối lớn dropdown-màu (kiểu "Dropdown" mới của
      // Sheets, chỉ set/xoá được qua UI, xem GHI_CHU_DU_AN.md) bám từ ~dòng
      // 280 tới hết lưới — ghi đè cả vùng đó luôn bị chặn với lỗi "không
      // được phép ở các ô trong các cột đã nhập", nên tránh đụng tới nó.
      const lastRow = sheet.getLastRow();
      const numRows = Math.min(Math.max(lastRow - 1, 0) + 50, sheet.getMaxRows() - 1);
      const targetRange = sheet.getRange(2, colIdx + 1, numRows, 1);
      targetRange.clearDataValidations();
      targetRange.setDataValidation(rule);
      lines.push(key + ' [' + sheetName + '!' + viHeader + ']: đã đặt dropdown (' + labels.join(', ') + ')');
    } catch (e) {
      lines.push(key + ': LỖI — ' + e.message);
    }
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Tách cột "Thiết bị đăng kí để chấm công" (1 cột gộp "id1::tên1::trạng1,
// id2::tên2::trạng2") thành 2 cột riêng "Thiết bị 1"/"Thiết bị 2" (mỗi cột
// 1 thiết bị "id::tên::trạng") — theo yêu cầu người dùng 2026-09-16, dễ
// nhìn/lọc trực tiếp trên Sheet hơn khi có ai đó cần tra cứu tay. Chạy TAY
// ĐÚNG 1 LẦN rồi xoá hàm này khỏi code (đã cập nhật FIELD_MAP sang
// device1/device2 — chạy hàm này SAU khi paste bản FIELD_MAP mới, rồi
// redeploy ngay, không để hở như applyStandardDropdowns() lúc trước).
function splitDeviceColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const oldColIdx = headers.indexOf('Thiết bị đăng kí để chấm công');
  if (oldColIdx === -1) return 'Không tìm thấy cột "Thiết bị đăng kí để chấm công" (có thể đã tách rồi)';

  const lastRow = sheet.getLastRow();
  const oldValues = lastRow >= 2 ? sheet.getRange(2, oldColIdx + 1, lastRow - 1, 1).getValues() : [];

  // Chèn 2 cột mới ngay sau cột cũ, rồi xoá cột cũ — insertColumnAfter giữ
  // nguyên định dạng/dropdown của các cột khác, không ảnh hưởng dữ liệu.
  sheet.insertColumnAfter(oldColIdx + 1);
  sheet.insertColumnAfter(oldColIdx + 2);
  sheet.getRange(1, oldColIdx + 2).setValue('Thiết bị 1');
  sheet.getRange(1, oldColIdx + 3).setValue('Thiết bị 2');

  let migrated = 0;
  if (oldValues.length) {
    const col1Values = [], col2Values = [];
    oldValues.forEach(function (row) {
      const raw = String(row[0] || '').trim();
      const parts = raw ? raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
      col1Values.push([parts[0] || '']);
      col2Values.push([parts[1] || '']);
      if (raw) migrated++;
    });
    sheet.getRange(2, oldColIdx + 2, col1Values.length, 1).setValues(col1Values);
    sheet.getRange(2, oldColIdx + 3, col2Values.length, 1).setValues(col2Values);
  }

  sheet.deleteColumn(oldColIdx + 1);

  const report = 'Đã tách cột thành "Thiết bị 1"/"Thiết bị 2", di trú ' + migrated + ' dòng có dữ liệu thiết bị.';
  Logger.log(report);
  return report;
}

// 2026-09-19: chèn 2 cột "Trạng thái Thiết bị 1"/"Trạng thái Thiết bị 2"
// NGAY SAU "Thiết bị 1"/"Thiết bị 2" (theo đúng vị trí người dùng yêu cầu,
// không phải nối cuối sheet như cơ chế addData() tự thêm cột thiếu) + dropdown
// "Chờ duyệt"/"Đã duyệt" + di trú trạng thái đã có sẵn trong chuỗi ghép
// "id::tên::trạng" ra cột mới cho dễ xem/sửa tay. Chạy TAY ĐÚNG 1 LẦN (khớp
// với FIELD_MAP mới thêm device1Status/device2Status ở đầu file) — an toàn
// chạy lại (bỏ qua nếu cột đã tồn tại, chỉ đặt lại dropdown + không di trú
// lại dữ liệu).
function addDeviceStatusColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const lines = [];
  const STATUS_LABELS = { pending: 'Chờ duyệt', approved: 'Đã duyệt' };

  [
    { deviceHeader: 'Thiết bị 1', statusHeader: 'Trạng thái Thiết bị 1' },
    { deviceHeader: 'Thiết bị 2', statusHeader: 'Trạng thái Thiết bị 2' }
  ].forEach(function (pair) {
    // Đọc lại headers MỖI VÒNG LẶP — lần chèn cột trước đó (Thiết bị 1) đã
    // làm lệch index của mọi cột phía sau, kể cả "Thiết bị 2".
    const headers = getHeaders(sheet);
    const deviceColIdx = headers.indexOf(pair.deviceHeader);
    if (deviceColIdx === -1) { lines.push(pair.deviceHeader + ': không tìm thấy cột, bỏ qua'); return; }
    let statusColIdx = headers.indexOf(pair.statusHeader);
    if (statusColIdx === -1) {
      sheet.insertColumnAfter(deviceColIdx + 1);
      statusColIdx = deviceColIdx + 1;
      sheet.getRange(1, statusColIdx + 1).setValue(pair.statusHeader);
      // Di trú trạng thái đã có sẵn trong chuỗi ghép "id::tên::trạng" (phần
      // tử thứ 3, mặc định 'approved' nếu thiếu — khớp đúng quy ước parseDeviceIds()
      // phía client) ra cột mới, chỉ 1 lần lúc vừa tạo cột.
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const deviceValues = sheet.getRange(2, deviceColIdx + 1, lastRow - 1, 1).getValues();
        const statusValues = deviceValues.map(function (row) {
          const raw = String(row[0] || '').trim();
          if (!raw) return [''];
          const parts = raw.split('::');
          const status = parts[2] || 'approved';
          return [STATUS_LABELS[status] || STATUS_LABELS.approved];
        });
        sheet.getRange(2, statusColIdx + 1, statusValues.length, 1).setValues(statusValues);
      }
      lines.push(pair.statusHeader + ': đã chèn cột sau "' + pair.deviceHeader + '" + di trú trạng thái có sẵn');
    } else {
      lines.push(pair.statusHeader + ': đã có sẵn, bỏ qua chèn/di trú');
    }
    const lastRow2 = sheet.getLastRow();
    const numRows = Math.min(Math.max(lastRow2 - 1, 0) + 50, sheet.getMaxRows() - 1);
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['Chờ duyệt', 'Đã duyệt'], true).setAllowInvalid(false).build();
    const targetRange = sheet.getRange(2, statusColIdx + 1, numRows, 1);
    targetRange.clearDataValidations();
    targetRange.setDataValidation(rule);
    lines.push(pair.statusHeader + ': đã đặt dropdown (Chờ duyệt / Đã duyệt)');
  });

  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Thêm 2 cột "Phòng ban"/"Mã phòng ban" vào cuối sheet Thành viên — chạy TAY
// ĐÚNG 1 LẦN (khớp với FIELD_MAP mới thêm ở đầu file). Chỉ chèn header, dữ
// liệu để trống (nhân viên hiện có chưa gán phòng ban, gán tay sau hoặc chờ
// họ tự cập nhật ở trang cá nhân). An toàn chạy lại — nếu cột đã tồn tại thì
// bỏ qua, không tạo trùng.
function addDepartmentColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const lines = [];
  [['Phòng ban'], ['Mã phòng ban']].forEach(function (pair) {
    const header = pair[0];
    if (headers.indexOf(header) !== -1) { lines.push(header + ': đã có sẵn, bỏ qua'); return; }
    const col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(header);
    headers.push(header);
    lines.push(header + ': đã thêm ở cột ' + col);
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Thêm 2 cột "Bộ phận"/"Mã bộ phận" (cấp CHA của Phòng ban) vào cuối sheet
// Thành viên — chạy TAY ĐÚNG 1 LẦN, cùng kiểu addDepartmentColumns() ở trên.
function addDivisionColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const lines = [];
  [['Bộ phận'], ['Mã bộ phận']].forEach(function (pair) {
    const header = pair[0];
    if (headers.indexOf(header) !== -1) { lines.push(header + ': đã có sẵn, bỏ qua'); return; }
    const col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(header);
    headers.push(header);
    lines.push(header + ': đã thêm ở cột ' + col);
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Danh sách Bộ phận/Phòng ban CỐ ĐỊNH — CHỈ dùng để dựng dropdown data
// validation trên Sheet (setDataValidation không đọc được task-data.js phía
// client). PHẢI khớp đúng TaskManager.getDivisions()/getDepartments() trong
// public/js/task-data.js — đổi 1 bên thì phải đổi bên kia theo, không có
// cách nào tự đồng bộ 2 runtime khác nhau (giống VALUE_MAP ở đầu file).
const DIVISION_NAMES = [
  'Khối Quản trị & Vận hành chung', 'Khối Kinh doanh & Trải nghiệm Khách hàng',
  'Khối Chuyên môn Thiết kế & Số hóa', 'Khối Kỹ thuật Xây dựng & Sản xuất'
];
const DIVISION_CODES = ['BO', 'FO', 'DDC', 'CPC'];
const DEPARTMENT_NAMES = [
  'Ban Giám đốc', 'Nhân sự', 'Kế toán & Tài chính', 'Hành chính & Công nghệ', 'Pháp chế & Hợp đồng',
  'Kinh doanh', 'Truyền thông', 'Chăm sóc Khách hàng',
  'Thiết kế Ý tưởng & 3D', 'Kỹ thuật Triển khai 2D', 'Quản lý Dữ liệu số', 'Nghiên cứu Kỹ thuật',
  'Dự toán & Bóc tách', 'Cung ứng & Mua hàng', 'Kho bãi & Vận tải', 'Xưởng sản xuất',
  'Quản lý Thi công', 'An toàn & Môi trường', 'Quản lý Chất lượng'
];
const DEPARTMENT_CODES = [
  'BOD', 'HRM', 'ACC', 'ADM', 'LEG', 'BIZ', 'MKT', 'CUS', 'DES', 'DRW', 'BIM', 'RND',
  'QS', 'PUR', 'WHS', 'MFG', 'CON', 'HSE', 'QAC'
];

// Đặt dropdown (data validation, danh sách CỐ ĐỊNH) cho 4 cột Bộ phận/Mã bộ
// phận/Phòng ban/Mã phòng ban trên sheet Thành viên — chạy TAY, an toàn chạy
// lại nhiều lần (ghi đè rule cũ). Theo đúng yêu cầu người dùng 2026-09-16:
// các cột này phải là dropdown chọn từ danh sách cố định, không gõ tay tự do.
function applyDepartmentDropdowns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  const numRows = Math.min(Math.max(lastRow - 1, 0) + 50, sheet.getMaxRows() - 1);
  const lines = [];
  [
    ['Bộ phận', DIVISION_NAMES],
    ['Mã bộ phận', DIVISION_CODES],
    ['Phòng ban', DEPARTMENT_NAMES],
    ['Mã phòng ban', DEPARTMENT_CODES]
  ].forEach(function (pair) {
    const header = pair[0];
    const list = pair[1];
    const colIdx = headers.indexOf(header);
    if (colIdx === -1) { lines.push(header + ': không tìm thấy cột'); return; }
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
    const targetRange = sheet.getRange(2, colIdx + 1, numRows, 1);
    targetRange.clearDataValidations();
    targetRange.setDataValidation(rule);
    lines.push(header + ': đã đặt dropdown (' + list.length + ' lựa chọn)');
  });
  const report = lines.join('\n');
  Logger.log(report);
  return report;
}

// Dọn dữ liệu CŨ trong cột "Cấp bậc" trước khi đổi sang phân tầng 5 mức —
// dữ liệu thật trên Sheet đang LẪN LỘN tiếng Anh thô ("manager"/"member",
// dropdown cũ hỏng ghi thẳng key nội bộ thay vì nhãn Việt) và tiếng Việt
// đúng ("Quản lý"/"Nhân viên") tuỳ dòng tạo trước/sau lúc Việt hoá — người
// dùng phát hiện qua ảnh chụp Sheet thật. Hàm này chuẩn hoá MỌI ô về đúng 1
// trong 5 nhãn mới, KHÔNG tự suy đoán ai là Founder/Giám đốc Bộ phận (2 cấp
// hoàn toàn mới, không có tương đương cũ) — "CEO" cũ giữ nguyên "CEO", CEO
// thật (Phạm Quang Hiếu) tự đổi tay thành "Founder" qua dropdown nếu muốn,
// tránh hàm này tự ý thăng cấp ai. Chạy TAY 1 lần, an toàn chạy lại nhiều lần.
function normalizeMemberLevels() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf('Cấp bậc');
  if (colIdx === -1) return 'Không tìm thấy cột "Cấp bậc"';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet chưa có dữ liệu';
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  // [giá trị cũ có thể gặp trên Sheet thật (tiếng Anh thô lẫn tiếng Việt), nhãn mới]
  const OLD_TO_NEW = {
    'CEO': 'CEO', 'admin': 'CEO',
    'manager': 'Quản lý', 'Quản lý': 'Quản lý',
    'member': 'Nhân viên', 'Nhân viên': 'Nhân viên'
  };
  const lines = [];
  let changed = 0;
  const out = values.map(function (row, i) {
    const raw = String(row[0] || '').trim();
    if (!raw) return row; // trống thì bỏ qua, không tự gán mặc định
    const mapped = OLD_TO_NEW[raw];
    if (!mapped) { lines.push('Dòng ' + (i + 2) + ': giá trị lạ "' + raw + '", để nguyên'); return row; }
    if (mapped !== raw) { changed++; return [mapped]; }
    return row;
  });
  range.setValues(out);
  const report = 'Đã chuẩn hoá ' + changed + ' dòng.' + (lines.length ? '\n' + lines.join('\n') : '');
  Logger.log(report);
  return report;
}

// Cột "Giới tính" trên Sheet đang hiện "male"/"female" thô (VALUE_MAP mới
// thêm 2026-09-16, dữ liệu CŨ tạo trước đó chưa qua dịch) — chuẩn hoá về
// nhãn Việt "Nam"/"Nữ". Chỉ ĐỔI GIÁ TRỊ ô (setValues), không đụng tới
// data-validation nên an toàn với cả ô đã có dữ liệu (không dính giới hạn
// "không ghi đè validation lên ô đã nhập" như cột Cấp bậc). Chạy tay 1 lần,
// an toàn chạy lại nhiều lần.
function normalizeMemberGender() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf('Giới tính');
  if (colIdx === -1) return 'Không tìm thấy cột "Giới tính"';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet chưa có dữ liệu';
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
  const values = range.getValues();
  const OLD_TO_NEW = { 'male': 'Nam', 'female': 'Nữ', 'Nam': 'Nam', 'Nữ': 'Nữ' };
  const lines = [];
  let changed = 0;
  const out = values.map(function (row, i) {
    const raw = String(row[0] || '').trim();
    if (!raw) return row;
    const mapped = OLD_TO_NEW[raw];
    if (!mapped) { lines.push('Dòng ' + (i + 2) + ': giá trị lạ "' + raw + '", để nguyên'); return row; }
    if (mapped !== raw) { changed++; return [mapped]; }
    return row;
  });
  range.setValues(out);
  const report = 'Đã chuẩn hoá ' + changed + ' dòng.' + (lines.length ? '\n' + lines.join('\n') : '');
  Logger.log(report);
  return report;
}

// Đặt dropdown 5 mức MỚI cho cột "Cấp bậc" (thay hẳn dropdown 3 mức cũ) —
// chạy SAU normalizeMemberLevels() để dữ liệu cũ hợp lệ trước khi khoá bằng
// requireValueInList (không thì các ô còn giá trị lạ sẽ bị Sheet báo lỗi).
function applyLevelDropdown() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheet(ss, SHEETS.members);
  if (!sheet) return 'Không tìm thấy sheet Thành viên';
  const headers = getHeaders(sheet);
  const colIdx = headers.indexOf('Cấp bậc');
  if (colIdx === -1) return 'Không tìm thấy cột "Cấp bậc"';
  const lastRow = sheet.getLastRow();
  const labels = LEVELS.map(function (l) { return l.label; });
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(labels, true).setAllowInvalid(false).build();
  // 2026-09-16: Sheets chặn ghi đè validation lên Ô ĐÃ CÓ GIÁ TRỊ (lỗi "Thao
  // tác này không được phép ở các ô trong các cột đã nhập"), và việc xoá-ghi
  // tạm giá trị để né lỗi đó KHÔNG an toàn — SpreadsheetApp gộp các lệnh ghi
  // và chỉ commit khi script kết thúc; nếu bước cuối lỗi, các ghi ĐÃ LOG
  // THÀNH CÔNG vẫn có thể bị mất (đã xảy ra thật, gây mất dữ liệu cột Cấp
  // bậc, phải khôi phục thủ công). Do đó CHỈ áp dropdown mới lên các dòng
  // TRỐNG phía dưới dữ liệu hiện có (dòng nhập tay mới sau này) — không đụng
  // ô đã có giá trị. Dữ liệu ở các dòng cũ vẫn đọc/ghi đúng qua VALUE_MAP dù
  // dropdown UI của chúng còn là kiểu cũ.
  const startRow = lastRow + 1;
  const numRows = 50;
  const targetRange = sheet.getRange(startRow, colIdx + 1, numRows, 1);
  targetRange.clearDataValidations();
  targetRange.setDataValidation(rule);
  const report = 'Cấp bậc: đã đặt dropdown mới cho ' + numRows + ' dòng trống từ dòng ' + startRow + ' trở đi (' + labels.join(', ') + '). Các dòng dữ liệu hiện có (2-' + lastRow + ') giữ nguyên, không đụng vào để tránh mất dữ liệu.';
  Logger.log(report);
  return report;
}
