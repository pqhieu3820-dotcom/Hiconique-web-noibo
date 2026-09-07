# HICONIQUE Internal Hub

> Cổng thông tin nội bộ dành cho nhân viên **HICONIQUE Vietnam** — đội ngũ thiết kế &amp; thi công xa xỉ.

---

## 1. Tổng quan

Trang web tĩnh (HTML/CSS/JS thuần) + một **Node.js/Express server** để chạy local. Deploy production
trên **Netlify** — mọi request bị chặn bởi một Edge Function yêu cầu Basic Auth (`netlify/edge-functions/basic-auth.js`)
trước khi vào được trang.

| Phân vùng | Vai trò | Công cụ |
|-----------|---------|---------|
| **Giao diện (Portal)** | Trang chủ + các trang phụ | HTML/CSS/JS thuần + Express (local) |
| **Hosting** | Chạy production | Netlify (edge function bảo vệ truy cập) |
| **Đăng nhập nội bộ** | Xác thực thành viên | `public/js/auth.js` (email công ty + mật khẩu) |
| **Dữ liệu** | Dự án / Task / Chấm công / Đề xuất / Thông báo / Tài liệu | Google Sheets (đọc CSV publish) + Apps Script (ghi, `gsheets-api-v2.js`) |
| **Wiki / Tài liệu** | Danh mục + link tài liệu | Lưu trong Google Sheets (tab `Documents`), sửa trực tiếp trên web |

---

## 2. Cấu trúc thư mục

```
WEB NỘI BỘ HICONIQUE/
├── server.js                 ← Express server (chạy local)
├── package.json
├── netlify.toml               ← Cấu hình deploy Netlify (publish dir + edge function)
├── netlify/edge-functions/
│   └── basic-auth.js          ← Chặn truy cập, yêu cầu user/pass (biến env AUTH_USERS)
├── gsheets-api-v2.js          ← Nguồn Apps Script đang chạy trên Google Sheets (xem SETUP_HUONG_DAN.md)
├── SETUP_HUONG_DAN.md         ← Hướng dẫn redeploy/mở rộng Google Sheets ⇄ Web
├── .env.example
├── public/
│   ├── index.html             ← Trang chủ portal
│   ├── favicon.svg
│   ├── robots.txt
│   ├── css/                   ← reset, tokens (sáng/tối), portal, subpage, projects, gantt, task-manager, spc
│   ├── js/
│   │   ├── portal.js          ← Header dùng chung: clock, theme toggle, chuông thông báo, panel trang chủ
│   │   ├── auth.js            ← Đăng nhập / phiên làm việc
│   │   ├── gsheets-config.js  ← URL Apps Script + URL CSV đọc dữ liệu
│   │   ├── task-data.js       ← Lớp dữ liệu dùng chung (TaskManager) — projects/tasks/members/proposals/timesheet/notifications/notices/documents
│   │   ├── projects.js        ← Trang Dự án (Board/List/Timeline/Gantt)
│   │   ├── gantt.js           ← Biểu đồ Gantt theo tháng + xuất Excel
│   │   └── task-manager-app.js← Trang Task Manager cá nhân
│   └── pages/
│       ├── projects.html      ← Dự án & công việc (bao gồm Gantt)
│       ├── tasks-manager.html ← Task Manager cá nhân
│       ├── wiki.html          ← Tài liệu (đọc/ghi từ Sheet)
│       ├── notices.html       ← Thông báo nội bộ (đọc/ghi từ Sheet)
│       ├── team.html          ← Team directory
│       ├── spc.html           ← Quy chuẩn kỹ thuật
│       ├── my-dashboard.html, profile.html, timesheet.html
│       └── progress-board.html← Trang cũ, giờ chỉ redirect sang projects.html#gantt
└── design-system/
    └── hiconique-internal-hub/
        └── MASTER.md          ← Source of truth cho thiết kế
```

---

## 3. Cài đặt & chạy local

Yêu cầu: **Node.js ≥ 18**.

```bash
npm install
cp .env.example .env
npm run dev      # auto-reload, http://localhost:3000
```

Production (chạy trực tiếp server, không qua Netlify):

```bash
NODE_ENV=production npm start
```

---

## 4. Deploy

Repo đã gắn Netlify — mỗi lần `git push` lên `master`, Netlify tự build & publish (xem
`netlify.toml`, publish directory là `public`). Không cần bước thủ công nào thêm.

Truy cập trang production yêu cầu Basic Auth (do `netlify/edge-functions/basic-auth.js`) — danh
sách tài khoản đặt trong Netlify **Site settings → Environment variables → `AUTH_USERS`**, định
dạng `email:matkhau,email2:matkhau2,...`.

---

## 5. Google Sheets ⇄ Web

Xem chi tiết ở [`SETUP_HUONG_DAN.md`](SETUP_HUONG_DAN.md) — cách redeploy Apps Script, thêm sheet
mới, và bảng schema đầy đủ của 8 tab đang dùng (Members/Projects/Tasks/Proposals/Timesheet/
Notifications/Notices/Documents).

---

## 6. Bảo trì

| Tần suất | Việc cần làm |
|----------|--------------|
| Khi có thông báo mới | Đăng trực tiếp trên trang `/pages/notices.html` (CEO/Manager) — không cần sửa code |
| Khi thêm tài liệu | Đăng trực tiếp trên trang `/pages/wiki.html` (CEO/Manager) |
| Khi sửa `gsheets-api-v2.js` | Redeploy theo hướng dẫn trong `SETUP_HUONG_DAN.md` |
| Khi thêm tool mới ở trang chủ | Thêm `tool-card` vào `public/index.html` section `#tools` |

---

**© 2026 HICONIQUE Vietnam · Internal use only.**
