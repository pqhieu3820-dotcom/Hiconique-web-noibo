# Google Sheets Template - HICONIQUE Task Manager

## Cách sử dụng:

### Bước 1: Tạo Google Sheet mới
1. Vào https://sheets.google.com
2. Tạo spreadsheet mới
3. Đặt tên: "HICONIQUE Task Manager"

### Bước 2: Tạo các tabs (sheets)
Tạo 4 sheets với các tên chính xác:
- **Projects**
- **Tasks**
- **Members**
- **Proposals**

### Bước 3: Thêm headers và dữ liệu

#### Sheet: Members
Headers: id, name, role, color, avatar

| id | name | role | color | avatar |
|----|------|------|-------|--------|
| HQ | Trần Minh Quân | CEO | #B08D57 | HQ |
| HN | Nguyễn Hiếu | Trưởng phòng Thiết kế | #8E7CC3 | HN |
| PH | Phạm Hoàng | Giám sát thi công | #C7A464 | PH |
| TM | Trần Mạnh | Truyền thông | #4F6F52 | TM |
| GP | Giản Phương | Thiết kế đồ họa | #3B6B8C | GP |
| LT | Lê Thành | Kỹ sư nội thất | #B8725A | LT |
| NT | Ngọc Trang | Nhân sự | #6B5B95 | NT |
| VH | Vũ Hùng | Kế toán | #88B04B | VH |
| DN | Đỗ Nam | Thiết kế nội thất | #F7CAC9 | DN |
| QM | Quách Minh | Thi công | #92A8D1 | QM |

#### Sheet: Projects
Headers: id, name, type, color, progress, status, members, createdAt

| id | name | type | color | progress | status | members | createdAt |
|----|------|------|-------|----------|--------|---------|-----------|
| prj_001 | Vinhouse Mỹ Đình | Thiết kế nội thất | #B08D57 | 65 | on-track | ["HQ","HN","PH"] | 2026-07-15 |
| prj_002 | Penthouse HP | Triển khai bản vẽ | #3B6B8C | 40 | on-track | ["HN","PH"] | 2026-07-20 |
| prj_003 | Biệt thự Đà Lạt | Thi công nội thất | #B8725A | 91 | on-track | ["PH","TM"] | 2026-06-01 |
| prj_004 | Showroom HCM | Concept 3D | #4F6F52 | 24 | on-track | ["GP"] | 2026-08-01 |
| prj_005 | Risk Project | Thiết kế web | #A04848 | 30 | at-risk | ["TM"] | 2026-07-10 |
| prj_006 | 20 Landing page | Web design | #C7A464 | 85 | on-track | ["TM","GP"] | 2026-06-15 |

#### Sheet: Tasks
Headers: id, title, description, projectId, assigneeId, priority, status, deadline, createdBy, createdAt

| id | title | description | projectId | assigneeId | priority | status | deadline | createdBy | createdAt |
|----|-------|-------------|-----------|------------|----------|--------|----------|----------|-----------|
| task_001 | Review design mockups cho Vinhouse | Kiểm tra và phản hồi bản mockup mới nhất | prj_001 | HN | high | pending | 2026-08-12T11:00 | HQ | 2026-08-10 |
| task_002 | Chuẩn bị presentation khách hàng | Slide trình bày cho buổi họp với khách hàng | prj_001 | TM | high | in-progress | 2026-08-12T14:00 | HN | 2026-08-09 |
| task_003 | Code review - Authentication module | Kiểm tra code module đăng nhập | prj_005 | GP | medium | pending | 2026-08-12T15:00 | HQ | 2026-08-08 |
| task_004 | Quản lý social media | Đăng bài lên fanpage và Instagram | prj_006 | TM | low | in-progress | 2026-08-12T16:30 | HN | 2026-08-07 |
| task_005 | Visual design review | Review thiết kế visual cho website | prj_005 | GP | low | pending | 2026-08-12T17:00 | TM | 2026-08-06 |

#### Sheet: Proposals
Headers: id, title, description, type, status, requesterId, reviewerId, amount, createdAt, reviewedAt

| id | title | description | type | status | requesterId | reviewerId | amount | createdAt | reviewedAt |
|----|-------|-------------|------|--------|--------------|------------|--------|-----------|------------|
| prop_001 | Mua thêm máy tính cho team design | Cần thêm 2 máy tính cấu hình mạnh cho công việc 3D | mua-sam | pending | HN | HQ | 50000000 | 2026-08-10 | |
| prop_002 | Đăng ký khóa học SketchUp nâng cao | Khóa học online cho 3 thành viên | dao-tao | approved | GP | HN | 15000000 | 2026-08-05 | 2026-08-06 |
| prop_003 | Sửa chữa máy chiếu phòng họp | Máy chiếu bị hỏng cần mang đi sửa | sua-chua | rejected | NT | HQ | 3000000 | 2026-08-01 | 2026-08-02 |

### Bước 4: Lấy Spreadsheet ID
1. Copy URL của Google Sheet
2. Lấy ID từ URL:
   - URL: `https://docs.google.com/spreadsheets/d/ABC123XYZ/edit#gid=0`
   - ID: `ABC123XYZ` (đoạn giữa `/d/` và `/edit`)

### Bước 5: Cấu hình trong code
Mở file `public/js/gsheets-config.js` và thay:
```javascript
SPREADSHEET_ID: 'YOUR_SHEET_ID',
API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL'
```

---

## Tùy chọn: Sử dụng Google Apps Script API (nâng cao)

Nếu muốn dùng API thay vì direct sheet access:

1. Vào https://script.google.com
2. Tạo project mới
3. Copy nội dung từ file `gsheets-api.js`
4. Thay `SPREADSHEET_ID` bằng ID từ Bước 4
5. Deploy > New deployment > Web app
6. Copy URL và dán vào `gsheets-config.js`

## Tùy chọn: Dùng trực tiếp không cần API

Hiện tại code đã hỗ trợ dùng localStorage. Để chuyển sang Google Sheets:
- Mở `public/js/task-data.js`
- Sửa phần `useGSheets: false` thành `useGSheets: true`
- Nhập Spreadsheet ID
