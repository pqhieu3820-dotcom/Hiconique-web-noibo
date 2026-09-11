const SPREADSHEET_ID = '1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY';

// Tab names on the live Sheet are Vietnamese (renamed by hand). Code below
// always reads/writes through FIELD_MAP so client JS keeps using English
// keys (m.title, m.status...) no matter what the Sheet's header text says.
const SHEETS = {
  projects: 'Dự án',
  tasks: 'Công việc',
  members: 'Thành viên',
  proposals: 'Đề xuất',
  timesheet: 'Chấm công',
  notifications: 'Thông báo',
  notices: 'Bảng tin',
  documents: 'Tài liệu',
  payslips: 'Phiếu lương',
  commissions: 'Hoa hồng dự án',
  commissionRates: 'Mức hoa hồng',
  priceCatalog: 'Bảng giá dịch vụ',
  financeEntries: 'Tài chính công ty',
  receivables: 'Công nợ khách hàng',
  bsSnapshots: 'Chỉ số cân đối kế toán',
  orders: 'Đơn hàng',
  // 6 sheet mới (2026-09-09) — công cụ theo dự án đi kèm database đơn giá 34
  // tỉnh, xem GHI_CHU_DU_AN.md. Tên KHÔNG có tiền tố "Bản sao của " nên không
  // đụng tới 46 sheet tham khảo read-only đã copy trước đó (VD "Bản sao của
  // Dòng tiền" khác hẳn "Dòng tiền" ở đây).
  contractorComparisons: 'So sánh nhà thầu',
  cashFlowPlans: 'Dòng tiền',
  changeOrders: 'Phát sinh',
  scheduleItems: 'Tiến độ',
  acceptanceChecks: 'Nghiệm thu',
  projectDocuments: 'Hồ sơ công trình',
  // HICON-BIM (2026-09-09) — danh mục Sản phẩm/Vật liệu/Nhà cung cấp dùng
  // chung toàn tổ chức, và Issue/BOQ theo dự án. Tên sheet có tiền tố "BIM"
  // để không đụng "Sản phẩm"/"Vật liệu" nếu sau này có sheet khác cùng tên.
  bimProducts: 'Sản phẩm BIM',
  bimMaterials: 'Vật liệu BIM',
  bimSuppliers: 'Nhà cung cấp BIM',
  bimIssues: 'Issue BIM',
  bimBoqItems: 'BOQ BIM'
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
    ['Mã NV', 'id'], ['Họ tên', 'name'], ['Chức vụ', 'role'], ['Cấp bậc', 'roleLevel'],
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
    // Header thật trên Sheet dùng "kí" (không dấu ý dài) chứ không phải "ký" —
    // đã verify qua API (getMembers trả nguyên header này làm key khi không
    // khớp FIELD_MAP thay vì "deviceIds"), sửa lại đúng chính tả người dùng
    // đã gõ trên Sheet.
    ['Thiết bị đăng kí để chấm công', 'deviceIds']
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
    ['Ngày hoàn thành', 'completedAt']
  ],
  tasks: [
    ['Mã CV', 'id'], ['Tên công việc', 'title'], ['Mô tả', 'description'], ['Mã dự án', 'projectId'],
    ['Mã người phụ trách', 'assigneeIds'], ['Mức độ ưu tiên', 'priority'], ['Trạng thái', 'status'],
    ['Ngày bắt đầu', 'startDate'], ['Ngày tới hạn deadline', 'deadline'], ['Người tạo', 'createdBy'],
    ['Ngày tạo', 'createdAt'], ['Ngày cập nhật', 'updatedAt'], ['Tiến độ', 'progress'],
    ['Update tiến độ việc hàng ngày', 'dailyTasks'], ['Ngày hoàn thành', 'completedAt']
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
    ['Trạng thái đạt IP', 'ipPass'], ['Số điều kiện đạt', 'verifyPassCount'], ['Trạng thái xác thực', 'verifyStatus']
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
  // matrix...) via the literal string 'admin' — only the Sheet's display value
  // changed to "CEO", the internal key must stay 'admin' or the CEO silently
  // loses every admin-only feature.
  'members.roleLevel': [
    ['CEO', 'admin']
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
  ]
};

// Đơn giá 34 tỉnh — đọc trực tiếp từ 46 sheet "Bản sao của <tên gốc>" migrate
// sang ngày 2026-09-09 (xem GHI_CHU_DU_AN.md). Đây là dữ liệu tham khảo nhiều
// bảng xếp chồng trong 1 sheet (nhân công, phần thô/hoàn thiện, vật tư/thiết
// bị theo tỉnh...), không phải 1 bảng đơn giản như các SHEETS khác nên KHÔNG
// đi qua FIELD_MAP — trả thẳng lưới giá trị thô (displayValues, giữ nguyên
// định dạng số như trên Sheet), pricing.html tự dựng bảng hiển thị theo cấu
// trúc "dòng chỉ có cột A = tiêu đề mục, dòng ngay sau = header cột".
var PROVINCE_SHEET_PREFIX = 'B' + String.fromCharCode(7843) + 'n sao c' + String.fromCharCode(7911) + 'a ';
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
    } else if (action === 'getNotifications') {
      result = getAllData(ss, SHEETS.notifications);
    } else if (action === 'addNotification') {
      result = addData(ss, SHEETS.notifications, JSON.parse(params.data));
    } else if (action === 'updateNotification') {
      result = updateData(ss, SHEETS.notifications, params.id, JSON.parse(params.data));
    } else if (action === 'deleteNotification') {
      result = deleteData(ss, SHEETS.notifications, params.id);
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
      if (Object.prototype.toString.call(val) === '[object Date]') {
        const pattern = (key === 'checkinTime' || key === 'checkoutTime') ? 'HH:mm' : 'yyyy-MM-dd';
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
    return obj;
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
var FORCE_TEXT_FIELDS = { phone: true, cccd: true, bankAccount: true };
function forceTextIfDateLike(val, enKey) {
  if (typeof val === 'string' && /^\d{4}-\d{1,2}$/.test(val)) return "'" + val;
  if (enKey && FORCE_TEXT_FIELDS[enKey] && typeof val === 'string' && /^\d+$/.test(val)) return "'" + val;
  return val;
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

function addData(ss, sheetName, data) {
  const sheet = getOrCreateSheet(ss, sheetName);
  let headers = getHeaders(sheet);
  // Brand-new empty sheet with no header row yet: seed it (in Vietnamese) from FIELD_MAP.
  if (headers.length === 0) {
    const schemaKey = sheetKeyFor(sheetName);
    const pairs = schemaKey && FIELD_MAP[schemaKey];
    headers = pairs ? pairs.map(function (p) { return p[0]; }) : Object.keys(data);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  if (!data.id) {
    const prefix = (sheetKeyFor(sheetName) || sheetName).toLowerCase().replace(/s$/, '');
    data.id = makeId(prefix);
  }
  data.createdAt = data.createdAt || new Date().toISOString().split('T')[0];
  const row = headers.map(function (h) {
    const enKey = viToEnHeader(sheetName, h);
    let val = data[enKey];
    if (Array.isArray(val)) return stringifyArrayForCell(enKey, val);
    if (typeof val === 'string') val = enToViValue(sheetName, enKey, val);
    val = toRealDateIfDateField(val, enKey);
    if (val instanceof Date) return val;
    return forceTextIfDateLike(val !== undefined && val !== null ? val : '', enKey);
  });
  sheet.appendRow(row);
  fillComputedHelperFormulas(sheet, headers, sheet.getLastRow(), 1);
  return data;
}

function updateData(ss, sheetName, id, updates) {
  const sheet = getOrCreateSheet(ss, sheetName);
  const headers = getHeaders(sheet);
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
      sheet.getRange(rowNum, i + 1).setValue(val instanceof Date ? val : (forceTextIfDateLike(val, enKey) || ''));
    }
  });
  return Object.assign({}, data[index], updates);
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
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (normalizeName(sheet.getName()) !== normalizeName(SHEETS.members)) return;
    const headers = getHeaders(sheet);
    const col = e.range.getColumn();
    if (headers[col - 1] !== enToViHeader(SHEETS.members, 'id')) return;
    if (e.range.getRow() === 1) return; // header row itself

    const oldId = e.oldValue;
    const newId = e.value;
    if (!oldId || !newId || oldId === newId) return;

    cascadeMemberIdChange(oldId, newId);
  } catch (err) {
    // Never let a cascade failure block the user's manual edit.
  }
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
