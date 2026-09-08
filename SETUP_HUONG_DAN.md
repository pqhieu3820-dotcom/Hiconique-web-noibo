# Hướng dẫn Google Sheets ⇄ Web (đồng bộ 2 chiều)

Web đọc **và** ghi dữ liệu đều qua **Google Apps Script Web App** (`gsheets-api-v2.js`).
Trước đây đọc qua CSV publish-to-web, nhưng sau khi đổi tên cột/tab của Sheet sang tiếng Việt
thì CSV trả header tiếng Việt làm hỏng toàn bộ web — **giờ mọi thao tác đọc/ghi đều đi qua Apps
Script để được dịch VI↔EN** (xem `FIELD_MAP`/`VALUE_MAP` trong `gsheets-api-v2.js`). Chỉ còn 1
URL duy nhất là `API_URL` trong `public/js/gsheets-config.js`. Hướng dẫn này dùng khi cần
**redeploy lại Apps Script** (ví dụ sau khi sửa `gsheets-api-v2.js`) hoặc **thêm sheet mới**.

## Cấu trúc Spreadsheet hiện tại

Spreadsheet: `HICONIQUE Task Manager` — **11 tab đặt tên tiếng Việt**, mỗi tab một loại dữ liệu.
Header (dòng 1) của mỗi tab cũng là **tiếng Việt**; code client vẫn dùng key tiếng Anh nhờ bảng
dịch `FIELD_MAP` trong `gsheets-api-v2.js` (cột "Key nội bộ" bên dưới là key tiếng Anh client dùng):

| Tab (tên thật trên Sheet) | Dùng cho | Key nội bộ (client) |
|---|---|---|
| `Thành viên` | Thành viên | id, name, role, roleLevel, gender, email, password, dob, phone, cccd, hometown, bankAccount, bank, color, avatar, createdAt, baseSalary, status |
| `Dự án` | Dự án | id, name, type, progress, status, members, color, createdAt, updatedAt, budget, client, investor, location, startDate, endDate, priority, description |
| `Công việc` | Công việc | id, title, description, projectId, assigneeId, priority, status, startDate, deadline, createdBy, createdAt, updatedAt, progress, dailyTasks |
| `Đề xuất` | Đề xuất | id, title, description, type, status, requesterId, reviewerId, amount, createdAt, reviewedAt |
| `Chấm công` | Chấm công | id, memberId, date, checkinTime, checkoutTime, totalHours, overtimeHours, status, note, checkinLat, checkinLng, checkinDistance, checkinIp, geoPass, ipPass, verifyPassCount, verifyStatus |
| `Thông báo` | Nhắc định kỳ (chuông thông báo) | id, title, message, type, scope, recurring, recurRule, active, createdBy, createdAt, updatedAt |
| `Bảng tin` | Bảng tin (trang Thông báo) | id, title, message, color, createdBy, createdAt, updatedAt |
| `Tài liệu` | Link tài liệu (trang Tài liệu) | id, category, name, url, createdBy, createdAt, updatedAt |
| `Phiếu lương` | Phiếu lương (trang Phiếu lương) | id, memberId, month, workDays, totalHours, otHoursAuto, otHoursManual, otHours, otRate, otAmount, baseSalary, commissionAmount, otherBonus, otherBonusNote, deduction, deductionNote, totalAmount, status, note, createdBy, createdAt, updatedAt, reviewedAt, reviewerId |
| `Hoa hồng dự án` | Hoa hồng dự án theo thành viên (trang % Hoa hồng dự án) | id, projectId, memberId, projectValue, percent, amount, month, note, createdBy, createdAt, updatedAt |
| `Mức hoa hồng` | % hoa hồng mặc định theo vai trò | id, roleLevel, percent, updatedAt |

**Quan trọng:** `gsheets-api-v2.js` đọc/ghi theo **tên cột thật trên Sheet** (không theo vị trí
cứng trong code), khớp tên cột tiếng Việt ↔ key tiếng Anh qua `FIELD_MAP` — nên bạn có thể thêm
cột mới trực tiếp trên Sheet mà không lo vỡ dữ liệu (cột lạ không có trong `FIELD_MAP` vẫn
round-trip được, chỉ giữ nguyên tên tiếng Việt làm key). Việc tra tab cũng **chuẩn hoá Unicode
(NFC) + bỏ khoảng trắng thừa** qua `findSheet()`, nên tên tab có dấu (vd `Bảng tin` với `ả` ở
dạng precomposed U+1EA3 hay decomposed) đều khớp đúng, không tạo tab rỗng trùng lặp. Thao tác
**đọc không bao giờ tạo tab mới** (chỉ `getOrCreateSheet` ở đường ghi mới tạo).

Một vài giá trị ô cũng được dịch VI↔EN qua `VALUE_MAP` (không chỉ header): `Thành viên.status`
(`Còn làm việc`↔`active`, `Chờ duyệt`↔`pending`, `Từ chối`↔`rejected`, `Ngưng công tác`↔`inactive`)
và `Thành viên.roleLevel` (`CEO`↔`admin`). Nếu "Việt hoá" thêm dropdown nào thì bổ sung vào
`VALUE_MAP` tương ứng.

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

1. Tạo tab mới trong Spreadsheet, đặt tên tiếng Việt (vd `Tài sản`), dòng đầu là tên cột
   (header) tiếng Việt.
2. Trong `gsheets-api-v2.js`: thêm vào `SHEETS` (key nội bộ → tên tab tiếng Việt) và `FIELD_MAP`
   (danh sách cặp `['Tên cột tiếng Việt', 'keyTiếngAnh']` — dùng để tạo header tự động nếu sheet
   trống và để dịch VI↔EN khi đọc/ghi), thêm 4 action `get/add/update/deleteXxx` trong
   `handleRequest`. Redeploy theo hướng dẫn trên.
3. Trong `public/js/task-data.js`: thêm case action tương ứng trong `getFromGSheets()` (map
   `loại → action` như `getXxx`), fetch trong `initData()`/`refreshFromGSheets()`, và các hàm
   CRUD tương ứng (theo mẫu Notices/Documents đã có sẵn trong file). **Không cần** thêm URL CSV
   nào nữa — mọi loại dữ liệu đọc qua cùng `API_URL`.

## Cột `bank` (tên ngân hàng) và `phone` (số điện thoại) trên tab Members

Form đăng ký thành viên mới đã có thêm trường "Ngân hàng" (tên ngân hàng, tách riêng với "Số tài
khoản") và "Số điện thoại". Giống mọi trường khác, giá trị này chỉ được lưu lại qua Google Sheets
nếu tab `Members` đã có cột `bank`/`phone` trên hàng header — nếu chưa có, tự thêm cột vào Sheet
(đặt `bank` cạnh `bankAccount`, `phone` cạnh `cccd` cho dễ nhìn), không cần redeploy Apps Script.

## Cột `status` (trạng thái tài khoản) trên tab Members

Đã thêm cột `status` vào hàng header của tab `Members` — dùng cho luồng phê duyệt đăng ký và ngưng
công tác: `pending` (chờ duyệt, chưa đăng nhập được), `active` (đang hoạt động — hoặc để trống,
tương đương active với tài khoản tạo trước khi có cột này), `rejected` (đăng ký bị từ chối),
`inactive` (đã ngưng công tác). Duyệt/từ chối yêu cầu Manager hoặc CEO; ngưng công tác/khôi phục
yêu cầu CEO — xem `TaskManager.canManageMembers`/`canTerminateMembers`/`updateMemberStatus` trong
`public/js/task-data.js`.

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

## Publish to web (KHÔNG còn bắt buộc)

Trước đây phần đọc cần Spreadsheet **Xuất bản lên web** (CSV). Từ khi chuyển toàn bộ đọc/ghi qua
Apps Script Web App, **không còn cần publish CSV nữa** — có thể tắt cũng được. Điều bắt buộc duy
nhất là deployment Apps Script phải để **Người có quyền truy cập = Bất kỳ ai (Anyone)** để web
gọi được mà không phải đăng nhập (xem bước 6 mục Redeploy).
