# Hướng dẫn cài đặt Google Sheets cho Task Manager

## Bước 1: Tạo Google Apps Script

1. Truy cập: https://script.google.com
2. Nhấn **Dự án mới** (New Project)
3. Xóa toàn bộ code mặc định
4. Copy nội dung từ file `gsheets-auto-setup.js` và dán vào

## Bước 2: Cấp quyền truy cập

1. Nhấn biểu tượng **Chạy** (▶️) bên cạnh hàm `createMonthlySheet`
2. Chọn **Hàm để chạy**: `createMonthlySheet`
3. Nhấn **Chạy**
4. Nếu hiện cảnh báo "Ủy quyền cần thiết":
   - Nhấn "Xem lỗi..."
   - Chọn **Advanced** > **Go to (untitled project) (unsafe)**
   - Nhấn **Allow**

## Bước 3: Tạo Spreadsheet

1. Sau khi chạy xong, vào **View** > **Logs** (hoặc nhấn Ctrl+Enter)
2. Bạn sẽ thấy thông tin như:
   ```
   Created: https://docs.google.com/spreadsheets/d/ABC123XYZ/edit
   ID: ABC123XYZ
   ```
3. **QUAN TRỌNG**: Copy ID đó (`ABC123XYZ`)

## Bước 4: Deploy Web App

1. Nhấn **Deploy** > **New deployment**
2. Chọn biểu tượng **Select type** > **Web app**
3. Điền:
   - Description: `HICONIQUE API`
   - Execute as: `Me`
   - Who has access: `Anyone` (để web truy cập được)
4. Nhấn **Deploy**
5. Copy **Web app URL**

## Bước 5: Cấu hình trong code

Mở file `public/js/gsheets-config.js` và thay:

```javascript
const GSHEETS_CONFIG = {
  SPREADSHEET_ID: 'ABC123XYZ',  // ID từ Bước 3
  API_URL: 'https://script.google.com/macros/s/XXX/exec'  // URL từ Bước 4
};
```

## Bước 6: Bật chế độ Google Sheets

Mở file `public/js/task-data.js`, tìm và sửa:

```javascript
useGSheets: true,  // Thay từ false thành true
```

---

## File đã tạo trong project

- `gsheets-auto-setup.js` - Script tự động tạo sheet + API
- `gsheets-api.js` - Script API đơn giản hơn
- `gsheets-config.js` - File cấu hình
- `GSHEETS_TEMPLATE.md` - Hướng dẫn chi tiết

---

## Sau khi cài đặt xong

Bạn sẽ có:
- ✅ File Google Sheet trong Drive với dữ liệu mẫu
- ✅ API để web truy cập
- ✅ Quản lý dữ liệu theo tháng (trong cùng 1 file, các tab riêng)
- ✅ Nhiều người truy cập cùng lúc được
- ✅ Dữ liệu lưu vĩnh viễn

Cần hỗ trợ gì thêm không?
