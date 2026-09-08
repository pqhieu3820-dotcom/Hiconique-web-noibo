# Hướng dẫn Google Sheets ⇄ Web (đồng bộ 2 chiều)

Web đọc dữ liệu qua **CSV publish-to-web** (nhanh, không cần đăng nhập) và ghi dữ liệu qua
**Google Apps Script Web App** (`gsheets-api-v2.js`). Cả 2 đều đã được cấu hình sẵn cho
Spreadsheet hiện tại — hướng dẫn này dùng khi cần **redeploy lại Apps Script** (ví dụ sau khi
sửa `gsheets-api-v2.js`) hoặc **thêm sheet mới**.

## Cấu trúc Spreadsheet hiện tại

Spreadsheet: `HICONIQUE Task Manager` — 11 tab, mỗi tab một loại dữ liệu:

| Tab | Dùng cho | Cột chính |
|---|---|---|
| `Members` | Thành viên | id, name, role, roleLevel, email, password, dob, cccd, phone, hometown, bank, bankAccount, color, avatar, createdAt, gender, baseSalary |
| `Projects` | Dự án | id, name, type, color, progress, status, members, createdAt, updatedAt, budget |
| `Tasks` | Công việc | id, title, description, projectId, assigneeId, priority, status, startDate, deadline, createdBy, createdAt, updatedAt, progress, dailyTasks |
| `Proposals` | Đề xuất | id, title, description, type, status, requesterId, reviewerId, amount, createdAt, reviewedAt |
| `Timesheet` | Chấm công | id, memberId, date, checkinTime, checkoutTime, totalHours, overtimeHours, status, note, checkinLat, checkinLng, checkinDistance, checkinIp, geoPass, ipPass, verifyPassCount, verifyStatus |
| `Notifications` | Nhắc định kỳ (chuông thông báo) | id, title, message, type, scope, recurring, recurRule, active, createdBy, createdAt, updatedAt |
| `Notices` | Bảng tin (trang Thông báo) | id, title, message, color, createdBy, createdAt, updatedAt |
| `Documents` | Link tài liệu (trang Tài liệu) | id, category, name, url, code, createdBy, createdAt, updatedAt |
| `Payslips` | Phiếu lương (trang Phiếu lương) | id, memberId, month, workDays, totalHours, otHoursAuto, otHoursManual, otHours, otRate, otAmount, baseSalary, commissionAmount, otherBonus, otherBonusNote, deduction, deductionNote, totalAmount, status, note, createdBy, createdAt, updatedAt, reviewedAt, reviewerId |
| `Commissions` | Hoa hồng dự án theo thành viên (trang % Hoa hồng dự án) | id, projectId, memberId, projectValue, percent, amount, month, note, createdBy, createdAt, updatedAt |
| `CommissionRates` | % hoa hồng mặc định theo vai trò | id, roleLevel, percent, updatedAt |

**Quan trọng:** `gsheets-api-v2.js` đọc/ghi theo **tên cột thật trên Sheet** (không theo vị trí
cứng trong code) — nên bạn có thể thêm cột mới trực tiếp trên Sheet mà không lo vỡ dữ liệu.
Nếu thêm hẳn 1 sheet mới, xem mục "Thêm sheet mới" bên dưới. `Payslips`, `Commissions` và
`CommissionRates` **tự động được tạo** (kèm header đúng schema) ngay lần ghi dữ liệu đầu tiên —
không cần tạo tay tab mới khi mở rộng thêm loại dữ liệu tương tự (xem `getOrCreateSheet` trong
`gsheets-api-v2.js`). `Payslips`/`Commissions`/`CommissionRates` cũng đọc trực tiếp qua Apps
Script Web App (JSON) thay vì CSV publish, vì các sheet mới chưa có gid public — không ảnh hưởng
gì tới cách dùng, chỉ khác đường đọc dữ liệu phía code.

**Lưu ý riêng cho `Timesheet.checkinIp`, `Timesheet.verifyPassCount`, và cột `month` trên
`Payslips`/`Commissions`:** phải để định dạng cột là **Văn bản thuần tuý** (Định dạng → Số →
Văn bản thuần tuý), nếu không Google Sheets sẽ tự diễn giải sai: IP dạng `14.171.113.174` bị
hiểu thành số (mất dấu chấm), `2/2` hoặc `2026-09` bị hiểu thành ngày tháng. Với `month`,
`gsheets-api-v2.js` còn tự thêm dấu `'` (nháy đơn) trước khi ghi để ép Google Sheets coi là văn
bản kể cả khi ghi qua API (định dạng cột "Văn bản thuần tuý" chỉ chặn được gõ tay, không chặn
được `appendRow`/`setValue` tự động parse ngày).

## Redeploy Apps Script sau khi sửa `gsheets-api-v2.js`

1. Mở Spreadsheet → **Tiện ích → Apps Script** (mở đúng project đã gắn với Spreadsheet này,
   tên project là `HICONIQUE NỘI BỘ API`).
2. Copy toàn bộ nội dung file `gsheets-api-v2.js` ở root repo, dán đè vào `Mã.gs`.
3. Lưu (Ctrl+S).
4. **Triển khai → Quản lý các tùy chọn triển khai** → chọn deployment đang hoạt động (loại
   `web app`, URL phải trùng với `API_URL` trong `public/js/gsheets-config.js`) → bấm biểu
   tượng bút chì để sửa.
5. Ở mục **Phiên bản**, chọn **Phiên bản mới** (không phải tạo deployment mới — làm vậy sẽ đổi
   URL và phải sửa lại `gsheets-config.js`).
6. Đảm bảo **Người có quyền truy cập** = `Bất kỳ ai` (Anyone) — nếu không web sẽ không đọc/ghi
   được vì bị yêu cầu đăng nhập.
7. Bấm **Triển khai**.

## Thêm sheet mới (ví dụ mở rộng thêm 1 loại dữ liệu)

1. Tạo tab mới trong Spreadsheet, đặt tên (vd `Assets`), dòng đầu là tên cột (header).
2. Trong `gsheets-api-v2.js`: thêm vào `SHEETS` (tên tab) và `HEADERS` (schema tham khảo — chỉ
   dùng để tạo header tự động nếu sheet trống, không bắt buộc trùng thứ tự cột thật), thêm 4
   action `get/add/update/deleteXxx` trong `handleRequest`. Redeploy theo hướng dẫn trên.
3. Trong `public/js/gsheets-config.js`: thêm URL CSV publish (`.../pub?output=csv&gid=<gid của
   tab mới>`) vào `DATA_URLS`. Lấy `gid` từ URL Sheet khi đang mở đúng tab đó.
4. Trong `public/js/task-data.js`: thêm `STORAGE_KEYS`, case trong `getFromGSheets()`, fetch
   trong `initData()`/`refreshFromGSheets()`, và các hàm CRUD tương ứng (theo mẫu Notices/
   Documents đã có sẵn trong file).

## Cột `bank` (tên ngân hàng) và `phone` (số điện thoại) trên tab Members

Form đăng ký thành viên mới đã có thêm trường "Ngân hàng" (tên ngân hàng, tách riêng với "Số tài
khoản") và "Số điện thoại". Giống mọi trường khác, giá trị này chỉ được lưu lại qua Google Sheets
nếu tab `Members` đã có cột `bank`/`phone` trên hàng header — nếu chưa có, tự thêm cột vào Sheet
(đặt `bank` cạnh `bankAccount`, `phone` cạnh `cccd` cho dễ nhìn), không cần redeploy Apps Script.

## Cột `code` (mã tài liệu) trên tab Documents

Trang Tài liệu có trường "Mã tài liệu" tự sinh dạng `DES-SOP-005` (Phòng ban-Loại-STT). Giá trị
này được gửi lên qua Apps Script như mọi cột khác, nhưng vì `addData`/`updateData` chỉ ghi theo
**đúng các cột đã có sẵn trên hàng header của Sheet**, nếu tab `Documents` **chưa có cột `code`**
thì giá trị này sẽ bị bỏ qua khi ghi (không lỗi, chỉ không lưu lại được qua Sheets). Để mã tài
liệu được đồng bộ và giữ lại sau khi tải lại trang: mở tab `Documents`, tự thêm cột `code` vào
hàng header (không cần sửa/redeploy `gsheets-api-v2.js`, code đã đọc/ghi theo tên cột động).

Danh mục chung (dropdown "Danh mục" khi thêm tài liệu, và phần "Quản lý danh mục") **chỉ lưu
trong localStorage của từng máy/trình duyệt** — chưa đồng bộ qua Google Sheets. Nếu cần dùng
chung nhiều máy, cho tôi biết để bổ sung 1 sheet/tab riêng cho danh mục.

## Publish to web (bắt buộc để CSV đọc được)

Spreadsheet phải đang **Xuất bản lên web** ở chế độ **Toàn bộ tài liệu** với tuỳ chọn **Tự động
xuất bản lại khi có thay đổi** đang bật (File/Tệp → Chia sẻ → Xuất bản lên web). Khi bật đúng,
mọi tab mới thêm sau này tự động có link CSV công khai mà không cần publish lại thủ công.
