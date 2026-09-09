# HICON-BIM — plugin SketchUp

Đọc model SketchUp thật (Group/Component, tag/layer, IFC Class nếu có gán, material, kích thước), bóc tách khối lượng, và đồng bộ 2 chiều với trang `HICON-BIM` trên hệ thống Nội bộ HICONIQUE (qua đúng Google Apps Script Web App đang chạy `gsheets-api-v2.js` + `bim-model-sync.gs`).

**Trạng thái**: bản v0.1 viết bằng Ruby, chưa test trong SketchUp thật (không có môi trường SketchUp ở máy build này) — cần bạn cài và test lại, báo lỗi cụ thể (thông báo lỗi + bước tái hiện) để sửa tiếp.

## Cấu trúc

```
sketchup-plugin/
  hicon_bim.rb              <- file loader, SketchUp quét file .rb nằm trực tiếp trong Plugins/
  hicon_bim/
    main.rb                 <- menu Extensions > HICON-BIM, toolbar, mở dialog
    config.rb                <- lưu API URL / Mã dự án (Sketchup.write_default, theo máy)
    constants.rb             <- bảng tag/layer chuẩn 5D+ -> nhãn tiếng Việt + IFC Class
    scanner.rb                <- đọc model thật (SketchUp Ruby API), không có số liệu giả
    api_client.rb             <- gọi Apps Script Web App (Net::HTTP, theo đúng quy ước action=...&data=...)
    dialog.rb                 <- UI::HtmlDialog, nối scanner + api_client với UI
    html/panel.{html,css,js}  <- giao diện 6 tab: Objects/Level/Room-Space/Material/Filter/BOQ
```

## Cách cài để test (chưa đóng gói .rbz)

1. Tìm thư mục Plugins của SketchUp, ví dụ Windows: `%APPDATA%\SketchUp\SketchUp 2026\SketchUp\Plugins`.
2. Copy `hicon_bim.rb` và cả thư mục `hicon_bim/` vào đúng thư mục Plugins đó (giữ đúng cấu trúc — `hicon_bim.rb` nằm ngang hàng thư mục `hicon_bim/`, không phải nằm trong).
3. Mở SketchUp > `Window > Extension Manager`, đảm bảo "HICON-BIM" đã bật (mặc định bật sẵn).
4. Mở lại model — menu `Extensions > HICON-BIM > Mở HICON-BIM` hoặc bấm icon trên toolbar.

## Đóng gói `.rbz` để cài như file bình thường

`.rbz` chỉ là 1 file `.zip` đổi đuôi, với đúng cấu trúc trên nén ở gốc (không nén luôn cả thư mục `sketchup-plugin/` cha). Từ trong thư mục `sketchup-plugin/`:

```bash
cd sketchup-plugin
zip -r ../hicon-bim.rbz hicon_bim.rb hicon_bim
```

Cài bằng `Extension Manager > Install Extension...` rồi chọn file `hicon-bim.rbz`.

## Cấu hình trong plugin

Mở tab ⚙ (Cài đặt) trong panel:
- **API URL**: URL Apps Script Web App hiện đang publish cho `gsheets-api-v2.js` (xem `reference_hiconique_links` trong bộ nhớ dự án, hoặc lấy trong Apps Script editor > Triển khai > Quản lý phiên bản triển khai).
- **Mã dự án**: copy đúng `id` của dự án từ trang HICON-BIM > Dự án (hiện ngay dưới tên dự án khi mở chi tiết, dạng `project_...`).

## Yêu cầu phía Apps Script (đã có sẵn trong repo, cần dán vào project thật)

`bim-model-sync.gs` ở gốc repo là 1 file **riêng**, không đụng `gsheets-api-v2.js` — mở Apps Script editor của project "HICONIQUE NỘI BỘ API", bấm "+" cạnh "Tệp" > Script, đặt tên `bim-model-sync`, dán nội dung file đó vào, Lưu. `gsheets-api-v2.js` đã có sẵn 1 dòng chuyển tiếp gọi `handleBimSyncAction` nếu hàm đó tồn tại — không cần sửa gì thêm.

## Cách dùng theo tab (khớp UI ảnh Mobim Workspace bạn gửi)

- **Objects**: bấm "Scan / Đồng bộ" — nếu đã cấu hình API URL + Mã dự án, quét xong sẽ tự đẩy toàn bộ Object lên sheet "Object BIM" (ghi đè theo `modelId`, luôn khớp đúng model hiện tại). Nếu chưa cấu hình, chỉ quét xem tại chỗ.
- **Level**: khai báo tên tầng + khoảng cao độ (m); "Tạo từ selection" lấy nhanh khoảng Z của object đang chọn. Lưu lại thì object ở tab Objects sẽ tự có cột "Tầng".
- **Room/Space**: đọc Face gán tag `!space` — diện tích/cao độ lấy thật từ hình học, không nhập tay.
- **Material**: liệt kê material đang dùng + tổng diện tích phủ thật, đối chiếu mã `m_xxx` chuẩn 5D+ nếu material đặt đúng tên.
- **Filter**: lọc theo Tầng/Nhóm/Tag/IFC Class/Vật liệu/kích thước, rồi Highlight (chọn) hoặc Safe Isolate (ẩn object không khớp) ngay trên model.
- **BOQ**: khớp tên định nghĩa Component/Group với đúng tên trong danh mục Sản phẩm HICON-BIM (đã tạo trên web) — object không khớp được báo rõ số lượng "chưa gán sản phẩm" thay vì âm thầm bỏ qua. "Đẩy lên BOQ dự án" ghi/</br>cập nhật đúng sheet BOQ BIM hiện có, dùng lại y hệt logic trang web.

## Giới hạn đã biết ở bản v0.1

- Đọc IFC Class native (Window > Model Info > Classifications) là best-effort — API `classifications` có thể khác chút giữa các bản SketchUp, nếu không đọc được sẽ trả `nil` (không suy đoán bậy), lúc đó vẫn còn IFC Class gợi ý từ bảng tag 5D+.
- "Diện tích"/"Thể tích" của 1 Object chỉ tính hình học **trực tiếp** trong Group/Component đó (không cộng luôn phần bên trong các Group/Component con lồng bên trong — những cái đó đã là object riêng trong danh sách).
- BOQ hiện khớp theo đúng tên định nghĩa == tên sản phẩm (không phân biệt hoa/thường) — chưa có UI để map tay khi tên không khớp hẳn.
