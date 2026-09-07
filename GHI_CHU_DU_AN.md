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

## 2. Cấu trúc dữ liệu (8 tab trong Sheet)

Xem bảng đầy đủ tên cột ở [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md#cấu-trúc-spreadsheet-hiện-tại):
Members, Projects, Tasks, Proposals, Timesheet, Notifications, Notices, Documents.

## 3. Quy tắc làm việc với Claude trong repo này

- **Luôn commit local sau mỗi lần sửa code xong** — không để thay đổi trôi nổi chưa commit.
- **Không tự ý `git push`** — luôn hỏi và chờ xác nhận trước khi push lên GitHub, để có thời
  gian kiểm tra kỹ. (Repo: xem link ở mục 1.)
- File `.claude/` (skill/tool nội bộ của Claude Code) **không** được track trên GitHub —
  đã thêm vào `.gitignore`.
- Server local đọc `.env` — đảm bảo `NODE_ENV=development` khi dev local để tránh cache CSS/JS
  1 ngày (nếu để `production` như mẫu `.env.example`, sửa CSS/JS sẽ không thấy ngay khi reload).

## 4. Tài liệu khác trong repo

- [README.md](README.md) — tổng quan kiến trúc, cấu trúc thư mục, cách chạy local/deploy.
- [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md) — chi tiết Google Sheets ⇄ Web, redeploy Apps Script,
  thêm sheet mới.
- [design-system/hiconique-internal-hub/MASTER.md](design-system/hiconique-internal-hub/MASTER.md)
  — source of truth cho thiết kế (màu, font, spacing...).
