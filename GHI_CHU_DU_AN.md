# Ghi chú dự án — đọc trước khi làm việc

File này tồn tại để không phải hỏi lại các thông tin dưới đây mỗi khi đổi máy hoặc mở đoạn
chat mới với Claude. Đây là nguồn tham chiếu chính (source of truth) cho các liên kết và quy
tắc làm việc của dự án **HICONIQUE Internal Hub**.

## 1. Liên kết quan trọng

| Việc | Link |
|---|---|
| GitHub repo | https://github.com/pqhieu3820-dotcom/Hiconique-web-noibo |
| Google Sheet — database chính (chỉnh sửa trực tiếp) | https://docs.google.com/spreadsheets/d/1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY/edit |
| Google Apps Script — cầu nối đồng bộ Web ⇄ Sheet | https://script.google.com/u/1/home/projects/13qWJLAwWHzeH7nyfcVHlMrxwOOWAUi4X2gD7CgB2EfwQseFX30RJo_RJ/edit |

Ghi chú:
- Web **đọc** dữ liệu qua CSV publish-to-web (URL trong `public/js/gsheets-config.js`,
  `DATA_URLS`) và **ghi** dữ liệu qua Apps Script Web App (`API_URL` cùng file). Cả hai đều
  trỏ vào chính Google Sheet ở trên — chỉ khác dạng ID (ID chỉnh sửa vs. ID publish-to-web).
- Source code đang chạy trên Apps Script = file `gsheets-api-v2.js` ở root repo. Sửa xong phải
  dán đè vào Apps Script rồi **Triển khai → Phiên bản mới** (không tạo deployment mới) — chi
  tiết đầy đủ ở [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md).

## 2. Cấu trúc dữ liệu (11 tab trong Sheet)

Xem bảng đầy đủ tên cột ở [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md#cấu-trúc-spreadsheet-hiện-tại):
Members, Projects, Tasks, Proposals, Timesheet, Notifications, Notices, Documents, Payslips,
Commissions, CommissionRates.

## 3. Quy tắc làm việc với Claude trong repo này

- **Luôn commit local sau mỗi lần sửa code xong** — không để thay đổi trôi nổi chưa commit.
- **Không tự ý `git push`** — luôn hỏi và chờ xác nhận trước khi push lên GitHub, để có thời
  gian kiểm tra kỹ. (Repo: xem link ở mục 1.)
- File `.claude/` (skill/tool nội bộ của Claude Code) **không** được track trên GitHub —
  đã thêm vào `.gitignore`.
- Server local đọc `.env` — đảm bảo `NODE_ENV=development` khi dev local để tránh cache CSS/JS
  1 ngày (nếu để `production` như mẫu `.env.example`, sửa CSS/JS sẽ không thấy ngay khi reload).

## 4. ID member & đồng bộ tự động khi sửa tay trên Sheet

- ID member mới có dạng `MEM.<Viết tắt tên>.<Ngày sinh DDMMYY>`, ví dụ Lê Thành sinh
  08/11/1993 → `MEM.LT.081193`. Viết tắt lấy chữ cái đầu của 2 từ cuối trong tên (kiểu
  họ-tên VN), sinh ra trong `auth.js` (hàm `register`) mỗi khi có người đăng ký mới.
- Nếu bạn **sửa tay ID của một member trực tiếp trên Google Sheet** (tab Members, cột `id`),
  một Apps Script trigger (`onEdit` trong `gsheets-api-v2.js`, đã cài đặt installable trigger
  "Từ bảng tính - Đang chỉnh sửa") sẽ tự động cập nhật ID đó ở mọi chỗ khác đang tham chiếu tới:
  Tasks (`assigneeId`, `createdBy`), Proposals (`requesterId`, `reviewerId`), Timesheet
  (`memberId`), Projects (`members` — hỗ trợ cả 2 dạng: chuỗi JSON `["id1","id2"]` và chuỗi
  phân tách bởi dấu phẩy `id1,id2` tuỳ theo dòng cũ/mới).
- Trigger này cần quyền `script.scriptapp` — nếu vì lý do gì đó bị gỡ quyền, vào Apps Script →
  chọn hàm bất kỳ có gọi `ScriptApp.getProjectTriggers()` → Chạy → bấm qua màn hình cấp quyền
  1 lần là xong (không cần chạy lại hàm cài đặt trigger nếu trigger đã tồn tại — kiểm tra ở
  mục "Trình kích hoạt" bên trái trong Apps Script).
- **Lưu ý khi đổi ID của chính tài khoản CEO (admin)**: phiên đăng nhập hiện tại trên trình
  duyệt lưu `id` cũ trong localStorage, nên sau khi đổi cần đăng xuất và đăng nhập lại để
  khớp với ID mới trên Sheet.

## 5. Phiếu lương & % Hoa hồng dự án (`payslip.html`, `commission.html`)

- **Phiếu lương**: nhân viên tự chọn tháng, trang tự lấy `baseSalary` (Members), ngày công/giờ
  OT (Timesheet của tháng đó), và tổng hoa hồng dự án (Commissions của tháng đó — chỉ hiện số
  tiền, không lộ % hay giá trị dự án). Nhân viên có thể cộng thêm giờ OT nhập tay, thưởng khác,
  khấu trừ. Gửi xong ở trạng thái `pending`, CEO/quản lý (`roleLevel` admin/manager) duyệt hoặc
  từ chối. Đơn giá OT/giờ = `baseSalary / 208 giờ x 1.5` (quy ước 26 công x 8h/tháng, hệ số OT
  ngày thường x1.5 theo Luật Lao động — có thể chỉnh 2 hằng số `OT_MULTIPLIER` và
  `STANDARD_MONTHLY_HOURS` trong `task-data.js` nếu công ty áp dụng quy tắc khác).
- **% Hoa hồng dự án**: 2 phần — (1) % mặc định theo vai trò (admin/manager/member, sửa được ở
  bảng trên cùng trang), dùng làm % gợi ý; (2) bảng theo từng dự án: nhập giá trị dự án
  (`Projects.budget`) và % riêng cho từng thành viên trong dự án, bấm Lưu để tính tiền và ghi
  vào Commissions — số tiền này sau đó tự hiện trong Phiếu lương của người đó. Chỉ admin/quản
  lý sửa được (regular member chỉ xem read-only).
- **Lương cơ bản (`Members.baseSalary`)** chỉ admin/quản lý sửa được — có bảng nhỏ ngay trong
  trang Phiếu lương (mục "Lương cơ bản nhân viên", chỉ CEO/quản lý thấy) để cập nhật.
- Cả 3 sheet mới (`Payslips`, `Commissions`, `CommissionRates`) tự tạo khi ghi dữ liệu lần đầu
  — không cần tạo tay. Đọc dữ liệu 3 sheet này đi qua Apps Script Web App (JSON), không qua CSV
  publish như các sheet cũ.

## 6. Tài liệu khác trong repo

- [README.md](README.md) — tổng quan kiến trúc, cấu trúc thư mục, cách chạy local/deploy.
- [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md) — chi tiết Google Sheets ⇄ Web, redeploy Apps Script,
  thêm sheet mới.
- [design-system/hiconique-internal-hub/MASTER.md](design-system/hiconique-internal-hub/MASTER.md)
  — source of truth cho thiết kế (màu, font, spacing...).
