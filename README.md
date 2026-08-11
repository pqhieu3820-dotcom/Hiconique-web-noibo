# HICONIQUE Internal Hub

> Cổng thông tin nội bộ dành cho nhân viên **HICONIQUE Vietnam** — đội ngũ thiết kế &amp; thi công xa xỉ.
> Domain: `noibo.hiconique.com`
> Phiên bản: v1.0 · 2026-08-11

---

## 1. Tổng quan

Trang web tĩnh + một **Node.js server** phục vụ file. Bảo mật bằng **Cloudflare Zero Trust** (xác thực email công ty + OTP). Không cần tự code hệ thống đăng nhập — Cloudflare đứng làm "lớp áo giáp" trước GitHub/Vercel/Hostinger.

| Phân vùng | Vai trò | Công cụ |
|-----------|---------|---------|
| **Giao diện (Portal)** | Trang chủ + các trang phụ | HTML/CSS/JS + Express |
| **Hosting** | Chạy mã nguồn | Vercel (khuyến nghị) hoặc Hostinger |
| **Domain** | Phụ `noibo.hiconique.com` | DNS qua Cloudflare |
| **Bảo mật** | OTP email + kiểm tra policy | Cloudflare Zero Trust (Access) |
| **Task / Tiến độ** | Database + dashboard | Google Sheets + Apps Script |
| **Wiki / Tri thức** | Quy trình + SPC + HR | Notion (link iframe) |
| **File nặng** | Bản vẽ / 3D / video | Google Drive (link từ Notion) |

---

## 2. Cấu trúc thư mục

```
NOIBO HICONIQUE/
├── server.js                 ← Express server
├── package.json
├── vercel.json               ← Cấu hình deploy Vercel
├── .env.example              ← Biến môi trường mẫu
├── public/                   ← Static files phục vụ cho client
│   ├── index.html            ← Trang chủ portal
│   ├── favicon.svg
│   ├── robots.txt
│   ├── css/
│   │   ├── reset.css
│   │   ├── tokens.css        ← Design tokens (charcoal/navy/bronze)
│   │   ├── portal.css        ← Style cho trang chủ
│   │   └── subpage.css       ← Style cho các trang con
│   ├── js/
│   │   └── portal.js         ← Clock, search overlay, team grid
│   └── pages/
│       ├── tasks.html        ← Quản lý công việc
│       ├── wiki.html         ← Bách khoa toàn thư
│       ├── notices.html      ← Thông báo nội bộ
│       └── team.html         ← Team directory
└── design-system/
    └── hiconique-internal-hub/
        └── MASTER.md         ← Source of truth cho thiết kế
```

---

## 3. Cài đặt local

Yêu cầu: **Node.js ≥ 18**.

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file env
cp .env.example .env

# 3. Chạy dev server (auto-reload)
npm run dev

# 4. Mở http://localhost:3000
```

Production:

```bash
NODE_ENV=production npm start
```

---

## 4. Push lên GitHub

```bash
git init
git add .
git commit -m "feat: HICONIQUE internal hub v1.0"
git branch -M main
git remote add origin https://github.com/hiconique/internal-hub.git
git push -u origin main
```

> **Lưu ý:** file `.env` KHÔNG push (đã nằm trong `.gitignore`). Lưu các secret (Sheets API key, Notion link) trong **GitHub Secrets** hoặc **Vercel Environment Variables**.

---

## 5. Deploy lên Vercel (khuyến nghị)

1. Vào [vercel.com](https://vercel.com) → **Add New Project**.
2. Import repo GitHub `hiconique/internal-hub`.
3. Framework Preset: **Other**.
4. Build Command: bỏ trống (đã có `vercel.json`).
5. Output Directory: bỏ trống.
6. Thêm **Environment Variables** (xem `.env.example`).
7. Bấm **Deploy**.

Sau khi deploy xong, Vercel sẽ cấp URL dạng `hiconique-internal-hub.vercel.app`.

---

## 6. Cấu hình Domain phụ `noibo.hiconique.com`

### Trên Vercel
- Project → **Settings → Domains** → Add `noibo.hiconique.com`.
- Vercel sẽ cấp 1 record CNAME trỏ về `cname.vercel-dns.com`.

### Trên Cloudflare DNS (nếu `hiconique.com` đang quản lý ở Cloudflare)
- Thêm record:
  ```
  Type: CNAME
  Name: noibo
  Target: cname.vercel-dns.com
  Proxy: Proxied (orange cloud) ← BẮT BUỘC để bật Zero Trust
  ```

---

## 7. Bảo mật với Cloudflare Zero Trust

Sau khi domain trỏ về Cloudflare (Proxied), bật Zero Trust:

1. Vào [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Access → Applications**.
2. **Add Application** → Self-hosted.
3. Điền:
   - Application domain: `noibo.hiconique.com`
   - Session duration: 24h
4. **Policies** → Add policy:
   - Name: `HICONIQUE Employees`
   - Action: **Allow**
   - Include:
     - **Emails** — match danh sách `@hiconique.com` (hoặc domain email nội bộ).
   - Require:
     - **One-time PIN** (gửi OTP về email).
5. Save.

Từ giờ, mọi request vào `noibo.hiconique.com` sẽ bị Cloudflare chặn — nhân viên phải nhập email công ty + điền OTP mới truy cập được.

---

## 8. Tích hợp Google Sheets (Task management)

### Cách 1 — Iframe (đơn giản)
1. Mở Google Sheet → **File → Share → Publish to web**.
2. Chọn sheet cần nhúng → nhúng dạng **HTML**.
3. Dán URL vào `<iframe>` trong `/pages/tasks.html`.

### Cách 2 — Google Apps Script (khuyến nghị, cho phép edit %)
1. Trong Google Sheet → **Extensions → Apps Script**.
2. Dán script sau:
   ```javascript
   function doGet(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
     const data = sheet.getDataRange().getValues();
     return ContentService.createTextOutput(JSON.stringify(data))
       .setMimeType(ContentService.MimeType.JSON);
   }

   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
     const body = JSON.parse(e.postData.contents);
     sheet.getRange(body.row, 5).setValue(body.percent);
     return ContentService.createTextOutput(JSON.stringify({ ok: true }));
   }
   ```
3. **Deploy → New deployment → Web app** → copy URL.
4. Dán URL vào `SHEET_TASKS_URL` trong `.env` (hoặc Vercel env).

---

## 9. Tích hợp Notion (Wiki)

Mỗi trang Notion có thể embed qua URL `/<page-id>` + tham số `?embed=true`. Đặt link trong `index.html`:

```html
<a href="https://www.notion.so/hiconique/wiki-spc-..." class="wiki-card">...</a>
```

Để file PDF/3D/video nặng: upload lên Drive → Share → copy link → dán vào trang Notion dạng `Embed Google Drive`.

---

## 10. Kiểm tra trước khi deploy

- [ ] `npm install` không lỗi
- [ ] `npm start` chạy tại `http://localhost:3000`
- [ ] Trang chủ render đúng (hero, công cụ, wiki, AI, thông báo, team)
- [ ] 4 trang con mở được: `/pages/tasks.html`, `/wiki.html`, `/notices.html`, `/team.html`
- [ ] Search overlay mở khi click icon hoặc nhấn `/`
- [ ] Clock cập nhật mỗi 30s
- [ ] Responsive OK ở 375 / 768 / 1024 / 1440
- [ ] Console browser không có lỗi

---

## 11. Bảo trì

| Tần suất | Việc cần làm |
|----------|--------------|
| Hàng tuần | Cập nhật "Thông báo nội bộ" trong `public/pages/notices.html` |
| Hàng tháng | Đồng bộ danh sách team trong `public/js/portal.js` |
| Khi có TB mới | Thêm entry mới vào bảng `notice-list` |
| Khi thêm tool mới | Thêm `tool-card` vào `public/index.html` section `#tools` |

---

**© 2026 HICONIQUE Vietnam · Internal use only.**