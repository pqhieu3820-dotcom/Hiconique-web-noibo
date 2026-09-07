# Hướng dẫn Google Sheets ⇄ Web (đồng bộ 2 chiều)

Web đọc dữ liệu qua **CSV publish-to-web** (nhanh, không cần đăng nhập) và ghi dữ liệu qua
**Google Apps Script Web App** (`gsheets-api-v2.js`). Cả 2 đều đã được cấu hình sẵn cho
Spreadsheet hiện tại — hướng dẫn này dùng khi cần **redeploy lại Apps Script** (ví dụ sau khi
sửa `gsheets-api-v2.js`) hoặc **thêm sheet mới**.

## Cấu trúc Spreadsheet hiện tại

Spreadsheet: `HICONIQUE Task Manager` — 8 tab, mỗi tab một loại dữ liệu:

| Tab | Dùng cho | Cột chính |
|---|---|---|
| `Members` | Thành viên | id, name, role, roleLevel, email, password, dob, cccd, hometown, bankAccount, color, avatar, createdAt |
| `Projects` | Dự án | id, name, type, color, progress, status, members, createdAt, updatedAt |
| `Tasks` | Công việc | id, title, description, projectId, assigneeId, priority, status, startDate, deadline, createdBy, createdAt, updatedAt, progress, dailyTasks |
| `Proposals` | Đề xuất | id, title, description, type, status, requesterId, reviewerId, amount, createdAt, reviewedAt |
| `Timesheet` | Chấm công | id, memberId, date, checkinTime, checkoutTime, totalHours, overtimeHours, status |
| `Notifications` | Nhắc định kỳ (chuông thông báo) | id, title, message, type, scope, recurring, recurRule, active, createdBy, createdAt, updatedAt |
| `Notices` | Bảng tin (trang Thông báo) | id, title, message, color, createdBy, createdAt, updatedAt |
| `Documents` | Link tài liệu (trang Tài liệu) | id, category, name, url, createdBy, createdAt, updatedAt |

**Quan trọng:** `gsheets-api-v2.js` đọc/ghi theo **tên cột thật trên Sheet** (không theo vị trí
cứng trong code) — nên bạn có thể thêm cột mới trực tiếp trên Sheet mà không lo vỡ dữ liệu.
Nếu thêm hẳn 1 sheet mới, xem mục "Thêm sheet mới" bên dưới.

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

## Publish to web (bắt buộc để CSV đọc được)

Spreadsheet phải đang **Xuất bản lên web** ở chế độ **Toàn bộ tài liệu** với tuỳ chọn **Tự động
xuất bản lại khi có thay đổi** đang bật (File/Tệp → Chia sẻ → Xuất bản lên web). Khi bật đúng,
mọi tab mới thêm sau này tự động có link CSV công khai mà không cần publish lại thủ công.
