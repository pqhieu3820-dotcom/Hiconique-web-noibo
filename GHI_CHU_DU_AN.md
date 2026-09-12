# Ghi chú dự án — đọc trước khi làm việc

File này tồn tại để không phải hỏi lại các thông tin dưới đây mỗi khi đổi máy hoặc mở đoạn
chat mới với Claude. Đây là nguồn tham chiếu chính (source of truth) cho các liên kết và quy
tắc làm việc của dự án **HICONIQUE Internal Hub**.

## ⚠️ QUY TẮC LÀM VIỆC CỐ ĐỊNH — LUÔN ÁP DỤNG, KHÔNG CẦN NHẮC LẠI

- **Đổi 1 field/quy tắc hiển thị dùng chung ở nhiều trang → phải tự rà + sửa HẾT mọi trang dùng field đó, không chỉ sửa đúng trang người dùng đang nói tới.** (Thêm 2026-09-11 sau khi `shortCode` (mã dự án viết tắt làm avatar) chỉ được cập nhật ở `projects.js` mà quên mất `task-manager-app.js` cũng render y hệt project card đó — người dùng phải tự phát hiện bug này.) Cách làm: `grep` toàn bộ `public/js/*.js`, `public/pages/*.html`, `public/css/*.css` tìm pattern CŨ trước khi coi là xong, không chỉ sửa 1 chỗ rồi dừng.
- **Avatar (người HOẶC dự án) toàn hệ thống LUÔN là hình VUÔNG BO GÓC, KHÔNG BAO GIỜ hình tròn.** (Chốt cứng 2026-09-11 theo yêu cầu người dùng, xem chi tiết mục "Trạng thái hiện tại — 2026-09-11 (g)".) Chuẩn được ép toàn cục qua 1 block CSS trong `portal.css` (nạp ở mọi trang) — thêm avatar mới ở đâu cũng phải dùng lại 1 trong các class avatar đã có sẵn (không tự bịa class mới với `border-radius: 50%`), nếu thật sự cần class mới thì thêm luôn vào danh sách override trong `portal.css`.

## ⏳ VIỆC CÒN TỒN ĐỌNG (đọc mục này đầu tiên — cập nhật 2026-09-12 cuối phiên)

Không có việc gì đang dở dang — mọi thay đổi trong phiên này đều đã commit (chờ lệnh push cuối phiên).

- Tự động check-out khi quên chấm công (qua 0h) + thông báo CEO/Manager và chính nhân viên đó; nút "Xuất báo cáo chấm công" (Excel nhiều sheet) cho CEO ở trang Chấm công — xem mục "Trạng thái hiện tại — 2026-09-12 (a)" ngay dưới.
- Cột Kanban trang Dự án co giãn lấp đầy màn hình rộng (trước đó cố định 280px, màn 27" thừa nhiều khoảng trắng bên phải) — xem mục "Trạng thái hiện tại — 2026-09-11 (h)" ngay dưới.
- Đồng bộ hình dạng avatar toàn hệ thống (vuông bo góc, xoá hết hình tròn) — xem mục "Trạng thái hiện tại — 2026-09-11 (g)" ngay dưới.
- Kanban "Hoàn thành/Done" tự ẩn việc/dự án đã xong QUA TUẦN + cột Kanban giới hạn chiều cao (cuộn riêng, không kéo dài cả trang) — xem mục "Trạng thái hiện tại — 2026-09-11 (f)" ngay dưới.
- Panel "Tiến độ hôm nay" ở trang Tasks (`tasks-manager.html`) — ĐÃ SỬA XONG, không còn là mockup tĩnh nữa (xem mục "Trạng thái hiện tại — 2026-09-11 (d)" ngay dưới).
- Nút "Báo cáo công việc" (CEO/Manager) ở trang Dự án — tiến độ dự án/từng người/nhật ký hàng ngày theo thời gian thực. Đã test đủ trên trình duyệt (xem mục "Trạng thái hiện tại — 2026-09-11 (c)" ngay dưới).
- Cột "Tên dự án" tra cứu (VLOOKUP) — đã xong đủ 12/12 sheet (xem mục "Trạng thái hiện tại — 2026-09-11 (a)" ngay dưới).
- Chấm công Check In/Check Out — nâng lên bắt buộc đủ 3/3 điều kiện (GPS/Wifi/Thiết bị), thiếu bất kỳ điều kiện nào đều chặn hẳn + hiện bảng thông báo (xem mục "Trạng thái hiện tại — 2026-09-11 (b)" ngay dưới).
- FIELD_MAP/VALUE_MAP 3 cột phụ Thành viên (lastActiveAt/theme/deviceIds) — người dùng tự đổi header sang tiếng Việt trên Sheet, đã map lại + deploy Apps Script phiên bản 48.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-12 (a) — tự động check-out quên chấm công + xuất báo cáo Excel chấm công, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-12, theo yêu cầu người dùng từ trang Chấm công cá nhân): 2 tính năng cho việc quên chấm công và báo cáo tổng hợp.**

- **Tự động đóng ca quên check-out** — thêm `autoCheckoutForgottenEntries()` trong `gsheets-api-v2.js`: mỗi ngày lúc ~0h05 (trigger `setupAutoCheckoutTrigger()`, đã chạy 1 lần để cài đặt — **ĐÃ XÁC NHẬN CÀI THÀNH CÔNG**), quét toàn bộ bản ghi `timesheet` có `status === 'working'` và `date < hôm nay` (tức còn "mở ca" từ hôm qua trở về trước), tự set `checkoutTime = checkinTime` (0 giờ công, không tính lương/OT sai), gắn tag `[TỰ ĐỘNG ĐÓNG CA — QUÊN CHECK-OUT]` vào `note`, rồi tạo 2 thông báo qua hệ thống `notifications` có sẵn: 1 gửi riêng nhân viên đó (`scope = memberId`), 1 gửi từng admin/manager (`scope = mgr.id`, lặp qua toàn bộ `roleLevel === 'admin' || 'manager'`).
- **Nút "Xuất báo cáo chấm công"** (`public/pages/timesheet.html`, chỉ `roleLevel === 'admin'` mới thấy) — dùng ExcelJS (CDN, đã có sẵn convention từ `gantt.js`) tạo file `.xlsx` nhiều sheet: 1 sheet "Tổng hợp" (mã NV/họ tên/chức vụ/ngày công/tổng giờ/giờ OT/số lần quên check-out, toàn bộ nhân viên active), và N sheet chi tiết — 1 sheet/người, đủ mọi ngày từ 1 tới ngày cuối tháng đang xem (không phụ thuộc có dữ liệu hay không), mỗi ngày show Check-in/Check-out/Trạng thái/Tổng giờ/OT/Ghi chú, đánh dấu đỏ "Quên check-out" (dò tag ở trên) và "Chưa chấm công" (ngày trong quá khứ, không cuối tuần, không có bản ghi).
- **Bẫy đã gặp khi debug**: sau khi bấm nút, không thấy file trong `~/Downloads` — tưởng lỗi code, nhưng thực ra Chrome (qua Claude in Chrome) tải về thư mục Desktop chứ không phải Downloads mặc định của máy này. Đã xác nhận file tải về đúng, đủ cấu trúc (19.5KB, mở được).
- **Bẫy deploy Apps Script tái diễn** (xem quy tắc "redeploy mỗi lần sửa" bên dưới): lần đầu bấm "Phiên bản mới" bằng click toạ độ (coordinate) bị lệch, vô tình chọn nhầm 1 phiên bản CŨ trong danh sách dropdown (deploy nhầm bản 48 rồi bản 49, đều thấp hơn/bằng bản đang active) — **PHẢI dùng `find` tool lấy `ref` chính xác của mục "Phiên bản mới" trong dropdown rồi click theo `ref` đó**, click theo toạ độ (x,y) cho dropdown này không đáng tin cậy vì danh sách dài hay bị cuộn/re-render giữa các lần thao tác. Đã deploy thành công **phiên bản 50** (xác nhận số phiên bản mới CAO HƠN phiên bản active trước đó).
- Đã kiểm tra: tính công (Ngày công/Tổng giờ) trong cả 2 nơi (thống kê trang cá nhân qua `getMemberTimesheetSummary` và sheet chi tiết trong báo cáo xuất) đều tính đúng theo tháng dương lịch trọn vẹn từ ngày 1 tới ngày cuối tháng (`tsDaysInMonth`), không bị giới hạn theo khoảng có dữ liệu — khớp yêu cầu người dùng, không cần sửa thêm.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (h) — cột Kanban trang Dự án co giãn theo màn hình, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11, theo ảnh chụp người dùng dùng màn 27"): Board Kanban trang Dự án (`.kanban-column`) trước đó cố định `width: 280px`, nên trên màn hình rộng chỉ 4 cột dồn hết về bên trái, để lại 1 khoảng trắng lớn bên phải nhìn lệch/cụt.**

- Đổi `.kanban-column` từ `width: 280px; flex-shrink: 0` sang `flex: 1 1 280px; min-width: 280px; max-width: 420px` — cột co giãn đều lấp đầy chiều rộng thật của màn hình, có trần (420px) để không bị giãn quá khổ trên màn siêu rộng (32"+), có sàn (280px) để không bị bóp quá hẹp trên màn nhỏ (dưới sàn thì tự cuộn ngang nhờ `overflow-x` sẵn có của `.projects-content`).
- **Bẫy kỹ thuật đã tự phát hiện + sửa trong lúc làm**: mobile media query (`max-width: 768px`) đổi `.kanban-board` sang `flex-direction: column` để xếp cột theo chiều dọc trên điện thoại — nếu không reset `flex: none` cho `.kanban-column` ở đúng breakpoint đó, `flex-basis: 280px` (đặt cho layout ngang trên desktop) sẽ áp nhầm lên CHIỀU CAO thay vì chiều rộng khi trục chính đổi hướng, làm cột méo chiều cao trên điện thoại. Đã thêm `flex: none; max-width: 100%;` vào đúng rule mobile hiện có.
- **Đã test qua 3 kích thước viewport thật (dùng `resize_window` để giả lập)**: 2200px (≈27"), 1600px, 1280px (laptop nhỏ) — cột co giãn đúng như kỳ vọng ở cả 3 mốc (420px/303.5px/280px mỗi cột tương ứng), lấp đầy 95-97% chiều rộng khả dụng, không còn khoảng trắng lớn bất đối xứng.
- **Không đụng** Dashboard Kanban ở trang Tasks (`task-manager.css` `.kanban-board`) — đã dùng `display: grid; grid-template-columns: repeat(3, 1fr)` từ trước nên vốn đã co giãn đúng, không có lỗi tương tự.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (g) — đồng bộ hình dạng avatar toàn hệ thống, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11, theo 3 ảnh chụp người dùng khoanh đỏ List/Timeline/Gantt): avatar đại diện người/dự án trước đây MỖI NƠI 1 KIỂU — có chỗ tròn (sidebar Thành viên, List view, avatar header góc phải, Team directory), có chỗ vuông bo góc (avatar dự án ở Gantt/Timeline). Người dùng yêu cầu đồng bộ TẤT CẢ thành vuông bo góc và CHỐT CỨNG lâu dài — xem [[feedback_avatar_shape_locked]] trong memory.**

- **Cách làm**: thêm 1 block CSS trong `portal.css` (file DUY NHẤT nạp ở MỌI trang trong app, kể cả trang không dùng `projects.css`/`task-manager.css`) — ép `border-radius: 28% !important` cho toàn bộ class avatar đã biết trong codebase: `.avatar` (nút avatar header), `.avatar-sm`/`.avatar-xs`/`.avatar-xxs`/`.avatar-tm`/`.avatar-xs-tm`/`.avatar-chip` (các chip nhỏ nhiều nơi), `.team-avatar` (trang Team), `.project-avatar`/`.project-list-avatar` (loại trừ 2 biến thể `-long` dạng viên nhộn cho mã dự án dài, giữ nguyên bo tròn kiểu pill), `.gantt-task-avatar` (chuẩn tham chiếu gốc, 30px hộp/8px bo góc ≈ 27%), `.report-avatar`, `.pf-avatar` (trang hồ sơ cá nhân), và 3 class riêng của `hicon-bim.html` (`.w-topbar-right .who`, `.w-feed-row .av`, `.w-rep-avatar`). Dùng đơn vị **%** thay vì px để tự co giãn đúng tỉ lệ ở MỌI kích thước — không cần chỉnh tay mỗi khi có size avatar mới.
  - **Chủ động không đụng**: các chấm tròn CHỈ BÁO TRẠNG THÁI (không phải avatar) như `.team-avatar::after` (chấm online/offline), `.column-dot`, số ngày trong lịch, con trượt (slider thumb), color swatch chọn màu... — giữ nguyên hình tròn, đúng bản chất của chúng.
  - **Phát hiện + sửa luôn 2 lỗ hổng phụ trong lúc rà soát** (không phải yêu cầu ban đầu nhưng liên quan trực tiếp): `.avatar-xxs` dùng trong Timeline (`projects.js`) và `.avatar-xs` dùng trong panel chọn nhiều người phụ trách (`.assignee-dd-item`) trước đó **hoàn toàn không có CSS định nghĩa kích thước** ở `projects.css` (chỉ có định nghĩa theo NGỮ CẢNH khác như `.task-assignee .avatar-xs`, không bao phủ 2 chỗ này) — thêm rule dự phòng (specificity thấp, nạp sớm ở `portal.css`) cho `.avatar-xs`/`.avatar-xxs` để 2 chỗ này hiện đúng hình dạng/kích thước thay vì chỉ có màu nền không hình khối rõ ràng.
- **Đã test trên trình duyệt đủ các nơi user chỉ ra + thêm**: Board/List/Timeline/Gantt trang Dự án, sidebar "Thành viên", avatar header, Dashboard + tab "Dự án" trong Task Manager (kể cả `project-avatar` dùng `shortCode` dài như "TDH"/"VPLV"), trang Team directory (avatar lớn vuông bo góc, chấm online vẫn tròn đúng ý) — không còn chỗ nào tròn, không lỗi console.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (f) — cột Kanban giới hạn chiều cao + việc "Hoàn thành" tự ẩn sau 1 tuần, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11, theo phản hồi người dùng kèm 2 ảnh chụp khoanh đỏ): 2 vấn đề UX riêng — (1) cột Kanban (cả trang Dự án lẫn Dashboard Tasks) dài vô tận khi nhiều việc, khó dùng cả PC lẫn điện thoại; (2) muốn task/dự án đã duyệt hoàn thành chỉ hiện ở cột "Hoàn thành"/"Done" tới hết tuần đó (tính tới 24h Chủ nhật) rồi tự ẩn khỏi web — dữ liệu vẫn còn nguyên trên Sheet, cần thì trích xuất lại được.**

1. **Cột Kanban giới hạn chiều cao + cuộn riêng từng cột**: thêm `max-height: 640px` (mobile: `420px`) + `overflow-y: auto` cho `.column-tasks` (`projects.css`, trang Dự án) và `.kanban-cards` (`task-manager.css`, Dashboard Tasks) — cột giờ tự cuộn bên trong thay vì kéo dài cả trang. Không đổi cấu trúc HTML/JS, chỉ CSS.
2. **Tự ẩn việc/dự án "Hoàn thành" sau khi qua tuần hoàn thành**:
   - Field mới `completedAt` cho CẢ `tasks` và `projects` (header Sheet: "Ngày hoàn thành") — tự SET khi `status` chuyển SANG `'completed'`, tự XOÁ khi chuyển KHỎI `'completed'` (mở lại), viết trong `updateTask()`/`updateProject()` (`task-data.js`), không phải người dùng tự nhập tay.
   - Hàm dùng chung `TaskManager.isCompletedThisWeek(completedAt)` (`task-data.js`, export qua API) — tuần tính từ 0h Thứ Hai tới hết 23:59:59 CN theo giờ trình duyệt. Áp dụng ở CẢ 2 nơi render Kanban "Hoàn thành/Done": `renderBoard()` trong `projects.js` và bucket `done` trong `renderKanbanBoard()` (`task-manager-app.js`) — lọc thêm `status==='completed' && isCompletedThisWeek(completedAt)` bên cạnh logic có sẵn.
   - **Chỉ ẩn ở Kanban Board** — List/Timeline/Gantt và quick-filter "Đã hoàn thành" (sidebar trang Dự án) hoàn toàn KHÔNG bị đụng, vẫn xem/lọc được đầy đủ mọi task đã hoàn thành từ trước tới giờ (đúng yêu cầu "vẫn trích xuất và xem lại được").
   - Backend: `FIELD_MAP.tasks`/`FIELD_MAP.projects` thêm `['Ngày hoàn thành', 'completedAt']`, `REAL_DATE_FIELDS` thêm `completedAt` (ghi Date object thật, theo đúng pattern các field ngày khác). Hàm migration 1-lần `addCompletedAtColumns()` (Apps Script) — tự chèn cột nếu chưa có, VÁ các dòng ĐÃ 'Hoàn thành' từ trước (không có `completedAt`) bằng "Ngày cập nhật" (ước lượng tốt nhất) rồi "Ngày tạo" nếu không có — tránh 2 thái cực xấu: hiện mãi mãi (không completedAt = luôn "không phải tuần này" nếu để trống) hoặc biến mất ngay lập tức (mất hết completed cards ngay khi tính năng ra mắt). Đã chạy: vá 24 dòng Công việc + 2 dòng Dự án. Deploy Apps Script **phiên bản 49**.
   - **Sự cố trong lúc deploy (đã tự phát hiện + sửa)**: dropdown "Phiên bản" trong dialog "Quản lý các tuỳ chọn triển khai" của Apps Script editor rất hay bị lỗi khi thao tác qua automation — click chọn "Phiên bản mới" xong `Triển khai` xong nhưng thực ra vẫn đang trỏ tới 1 phiên bản CŨ trong danh sách (từng dính y hệt lỗi này với dropdown chọn hàm trước đây) — lần đầu bấm Triển khai đã VÔ TÌNH kích hoạt lại "Phiên bản 47" cũ (mất tính năng completedAt khỏi bản live dù code đã lưu đúng) mà không phát hiện ngay vì dialog vẫn báo "Đã cập nhật thành công". Phát hiện ra vì so sánh số phiên bản hiển thị sau khi triển khai KHÔNG khớp số mong đợi — **bài học: sau khi bấm Triển khai, luôn đọc kỹ dòng "Phiên bản X" trong thông báo kết quả, phải là số MỚI NHẤT (lớn hơn số hiện tại), không tin vào chữ "thành công" không thôi.** Cách bấm chọn "Phiên bản mới" đáng tin cậy hơn: click mở dropdown và click chọn "Phiên bản mới" trong CÙNG 1 lượt thao tác liên tiếp không có bước chờ/zoom xen giữa (dùng `browser_batch` gộp 2 click liền nhau) — tách rời 2 bước ra dễ bị dropdown tự đóng/reset lựa chọn.
   - **Sự cố khác trong lúc dán code (đã tự phát hiện + sửa, không mất dữ liệu)**: kỹ thuật dán code quen thuộc (Ctrl+A rồi Ctrl+V nội dung từ clipboard OS) bất ngờ KHÔNG hoạt động (chọn hết rồi xoá sạch nhưng dán vào không có gì, file trống trơn) — **chưa từng gặp trước đây trong dự án này, chưa rõ nguyên nhân** (có thể do quyền đọc clipboard bị trình duyệt chặn ngầm phiên này). Vì file đã bị xoá sạch nhưng CHƯA LƯU (Ctrl+S), rời trang bị chặn bởi cảnh báo "unsaved changes" của chính trình duyệt — xác nhận bản trên server vẫn an toàn, không có gì mất. **Cách chữa cháy dùng thay clipboard**: mở 1 server tĩnh tạm thời trên máy (`node http.createServer` phát nội dung file kèm header `Access-Control-Allow-Origin: *`, cổng bất kỳ VD 8917), rồi trong Apps Script gọi `fetch('http://localhost:<port>')` lấy nội dung và gán thẳng vào Monaco editor bằng `monaco.editor.getModels().find(...).setValue(content)` — vòng qua hẳn clipboard, đáng tin cậy hơn khi Ctrl+V bị chặn. Nhớ tắt server tạm sau khi dùng xong.

Ngoài ra, 2 việc nhỏ đã CHỦ ĐỘNG bỏ qua (không phải quên, xem lý do trong các mục bên dưới nếu cần): field "Tháng" (YYYY-MM) không đổi sang mm/yyyy vì sẽ hỏng lọc tháng ở Tài chính/Lương/Hoa hồng; và việc quét toàn bộ sheet khác xem có bị lệch dữ liệu thô-chưa-migrate tương tự Công việc/Dự án hay không (người dùng yêu cầu rộng "xử lí hết" nhưng phạm vi đã làm mới giới hạn ở 3 ảnh chụp gốc).

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (e) — fix avatar mã dự án viết tắt bị thiếu ở trang Tasks, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11, người dùng tự phát hiện qua ảnh chụp): trang "Dự án" trong Task Manager (`tasks-manager.html`, khác với trang `projects.html` riêng) vẫn hiện avatar dự án là CHỮ CÁI ĐẦU TÊN thay vì mã viết tắt (`shortCode`, tính năng đã làm từ 2026-09-10 nhưng chỉ áp dụng cho `projects.js`).**

- Sửa cả 3 chỗ trong `task-manager-app.js` render `project-avatar` (modal chi tiết dự án, preview 6 dự án ở Dashboard, lưới đầy đủ ở tab "Dự án") — đổi `project.name.charAt(0)` thành `project.shortCode || project.name.charAt(0)`, đúng pattern đã dùng ở `projects.js`.
- Thêm class `.project-avatar-long`/CSS trong `task-manager.css` (nới ô avatar thành viên nhộn khi mã dài hơn 3 ký tự, VD "HMHOUSE") — y hệt `.project-list-avatar-long` đã có ở `projects.css`, tránh chữ bị bóp/tràn trong ô vuông 40px cố định.
- Đã `grep` toàn bộ `public/` tìm hết các chỗ dùng `.charAt(0)` để xác nhận không còn chỗ nào khác bị sót (2 chỗ còn lại trong `auth.js`/`portal.js` là initials CỦA NGƯỜI, không phải dự án — không đụng).
- Đã test trên trình duyệt: tab "Dự án" trong Task Manager giờ hiện đúng TDH/NTL/VPLV/CCQ7... khớp y hệt trang `projects.html`, không bị tràn chữ.
- **Người dùng yêu cầu thêm 1 quy tắc làm việc cố định từ giờ** (đã ghi ở đầu file, mục "⚠️ QUY TẮC LÀM VIỆC CỐ ĐỊNH"): mọi lần đổi 1 field/quy tắc hiển thị DÙNG CHUNG nhiều trang, phải tự rà + sửa hết mọi trang liên quan trong cùng 1 lượt, không chỉ sửa đúng trang đang được nhắc tới rồi để các trang khác bị bỏ sót.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (d) — panel "Tiến độ hôm nay" ở trang Tasks đổi từ mockup sang dữ liệu thật, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11, theo yêu cầu người dùng): thay dữ liệu mockup tĩnh của panel bên phải trang Tasks (`tasks-manager.html`) bằng dữ liệu thật của CHÍNH người đang đăng nhập — giữ nguyên UI/tiêu đề như yêu cầu, chỉ đổi phần nội dung.**

- **`renderDailyProgressPanel()`** (mới, trong `task-manager-app.js`, gọi từ `renderDashboard()` + trong vòng poll 60s có sẵn + nút refresh riêng `#dpRefreshBtn`):
  - **Vòng tròn + "N/M tasks hoàn thành hôm nay"**: N/M tính trên các task được giao cho người dùng hiện tại (`TaskManager.getTasks({assigneeId: user.id})`) mà CHƯA `completed` — dùng đúng `TaskManager.getTodayProgress(taskId)` đã có sẵn (từ tính năng "Update tiến độ việc hàng ngày"), % = trung bình `progress` hôm nay trên các task đó, N = số task có `done:true` hôm nay.
  - **"Tuần này"**: 7 cột T2..CN giữ nguyên vị trí cố định (không phải "7 ngày gần nhất" trôi) — tính đúng Thứ Hai của TUẦN HIỆN TẠI rồi lấy trung bình `dailyTasks` mỗi ngày trong tuần đó cho các task của người dùng, cột đúng ngày hôm nay tô màu đồng (bronze) như bản mockup gốc từng làm cho 1 cột cố định, còn lại giữ màu xanh mặc định của CSS.
  - **"Lịch hôm nay"** (giữ nguyên tiêu đề theo đúng yêu cầu "UI và đầu mục vẫn thế") — đổi nội dung thành **task sắp đến hạn gần nhất** (chưa `completed`, có `deadline`, sắp xếp tăng dần, lấy 4 task đầu) vì hệ thống chưa có lịch họp/sự kiện riêng — đây là thông tin thật gần nghĩa nhất với "hôm nay cần chú ý gì". Rỗng thì hiện "Không có việc nào sắp đến hạn" thay vì để trống.
  - CSS thêm 1 rule nhỏ `.icon-btn-tm.spinning svg` (tái dùng keyframe `sync-spin` có sẵn) cho nút refresh mới.
- **Đã test trên trình duyệt với 2 tài khoản**: CEO (không có task nào được giao — đúng hiện "Không có task nào đang xử lý"/"Không có việc nào sắp đến hạn", không phải lỗi) và Trần Mạnh (quản lý thi công, có nhiều task) — hiện đúng "0/14 tasks hoàn thành hôm nay" (seed data không có tiến độ ngày hôm nay/tuần này nên đúng là 0%, không phải bug) và 4 task sắp đến hạn thật với ngày/tên dự án đúng. Không có lỗi console phát sinh từ code mới.
- Đã commit + push.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (c) — nút "Báo cáo công việc" CEO/Manager (ĐÃ TEST XONG) + map lại 3 cột phụ Thành viên, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11, 2 yêu cầu riêng trong cùng phiên):**

1. **FIELD_MAP/VALUE_MAP cho 3 cột phụ Thành viên** (`lastActiveAt`, `theme`, `deviceIds`) — người dùng tự đổi header trên Sheet từ tiếng Anh sang tiếng Việt ("Lần hoạt động cuối", "Màu nền trình duyệt", "Thiết bị đăng kí để chấm công" — chú ý "kí" không dấu ý dài, không phải "ký", đã verify qua API mới ra đúng) và tạo dropdown Việt hoá "Nền sáng"/"Nền tối" cho `theme`. 3 cột này trước đó round-trip qua cơ chế "cột không map, chỉ cần header khớp đúng key tiếng Anh" (xem `feedback_gsheets_unmapped_column_shortcut` trong memory) — đổi header sang tiếng Việt làm cơ chế đó hỏng ngay lập tức. Đã thêm khai báo tường minh vào `FIELD_MAP.members` + `VALUE_MAP['members.theme']` (dịch `Nền sáng`/`Nền tối` ↔ `light`/`dark`, đúng 2 giá trị `portal.js` dùng để set `data-theme`). Deploy Apps Script **phiên bản 48**, verify round-trip qua `getMembers` thật — đủ cả 3 field đúng tên key tiếng Anh. Đã commit + push (`e6eb79d`).
   - **Bài học/cảnh báo chung cho lần sau**: BẤT KỲ cột nào đang dùng cơ chế "header tiếng Anh không qua FIELD_MAP" (hiện có đúng 3 cột này) — nếu người dùng tự đổi header đó sang tiếng Việt trên Sheet UI, PHẢI thêm FIELD_MAP tương ứng ngay, không thì app coi như mất cột đó (đọc ra `undefined`, ghi vào không tới nơi).
2. **Nút "Báo cáo công việc" (CEO/Manager) ở trang Dự án — ĐANG DỞ DANG, CHƯA TEST, CHƯA COMMIT/PUSH.** Theo yêu cầu người dùng: xem tiến độ dự án + tiến độ từng người (tổng hoặc lọc 1 người) + nhật ký tiến độ hàng ngày từng task, theo thời gian thực. Người dùng còn báo bảng "Tiến độ hôm nay"/"Tuần này"/"Lịch hôm nay" cũ ở góc phải trang `tasks-manager.html` "không hoạt động" — kiểm tra thấy đây là **mockup HTML tĩnh 100%, chưa từng có JS nào wire dữ liệu thật vào** (số 63%, "5/8 tasks", biểu đồ tuần, 3 sự kiện lịch — toàn bộ đều hardcode sẵn trong `tasks-manager.html`, `task-manager-app.js` không hề động tới các id/class đó). Quyết định: xây tính năng "Báo cáo công việc" MỚI ở trang Dự án đúng theo yêu cầu cụ thể của người dùng thay vì sửa lại bảng mockup cũ đó — **bảng mockup cũ ở `tasks-manager.html` vẫn còn nguyên, CHƯA sửa/gỡ, cần quay lại xử lý sau** (xoá hẳn hoặc thay bằng dữ liệu thật, tuỳ người dùng chọn).
   - Đã thêm: nút "Báo cáo công việc" trong `.content-actions` của `projects.html` (ẩn mặc định `hidden`, chỉ hiện cho `roleLevel admin/manager`, theo đúng pattern `canManageProjects` đã dùng sẵn cho nút "+ Thêm dự án"); modal `#work-report-modal` (bộ lọc Dự án + Thành viên, nút refresh xoay khi tải, mốc "Cập nhật lúc HH:MM:SS"); các hàm `bindWorkReportModal()`/`renderWorkReport()`/`populateReportFilters()` trong `projects.js` — tính lại 100% từ dữ liệu `TaskManager` hiện có (không lưu số liệu riêng), mở modal hoặc bấm refresh đều gọi `TaskManager.refreshFromGSheets()` trước khi tính để đúng nghĩa "thời gian thực". 3 phần hiển thị: tổng quan (stat cards), tiến độ theo dự án (progress bar + done/total), tiến độ theo người (progress bar + done/total/quá hạn), nhật ký tiến độ hôm nay (đọc từ `task.dailyTasks`, đúng field đã có sẵn từ tính năng "Update tiến độ việc hàng ngày").
   - CSS mới thêm cuối `projects.css` (`.report-*`, tái dùng `.progress-track`/`.progress-percent` có sẵn cho thanh tiến độ).
   - **Đã test xong trên trình duyệt thật**: mở modal với CEO, cả 4 phần render đúng dữ liệu thật (tổng quan/theo dự án/theo người/nhật ký hôm nay), đổi bộ lọc Dự án và Thành viên đều lọc đúng, nút refresh tải lại đúng. **2 lỗi phát hiện + đã sửa trong lúc test**:
     1. Sheet "Dự án" có sẵn 1 dòng rác trống (không id/tên) lọt vào `getProjects()` — báo cáo hiện 1 dòng trống gây khó hiểu (không sửa/xoá dữ liệu gốc trên Sheet, chỉ lọc bỏ ở tầng hiển thị: `getProjects().filter(p => p && p.id && p.name)`).
     2. **Bug CSS chung cần nhớ cho mọi nút dùng chung class `.btn-filter` sau này**: thuộc tính `hidden` của HTML bị `.btn-filter { display: flex }` GHI ĐÈ mất tác dụng — cả 2 selector (`[hidden]` của UA stylesheet và `.btn-filter` của app) cùng độ đặc hiệu (0,1,0), CSS nạp sau (`projects.css`) thắng, nên nút set `hidden=true` bằng JS vẫn HIỂN THỊ RA (đã tự phát hiện qua test tài khoản `member` thường — nút "Báo cáo công việc" vẫn hiện dù code JS đã đúng logic ẩn). Sửa bằng cách thêm rule riêng `.btn-filter[hidden] { display: none; }` (độ đặc hiệu cao hơn) ngay trước rule `.btn-filter`. **Cảnh báo chung**: bất kỳ nút/phần tử nào dùng `el.hidden = true/false` để ẩn/hiện qua JS mà class CSS của nó có khai báo `display` riêng (không phải mặc định trình duyệt) đều có nguy cơ dính lỗi y hệt — cần rule `[hidden]` riêng đủ đặc hiệu, không thể tin tưởng thuộc tính `hidden` tự hoạt động khi có CSS class ghi đè `display`.
   - Đã commit + push.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (b) — chấm công bắt buộc đủ 3/3 điều kiện, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11, theo yêu cầu người dùng): nâng cấp luật xác thực chấm công Check In/Check Out từ "tối thiểu 2/3, thiếu thì hỏi xác nhận thủ công để bỏ qua" lên "bắt buộc đủ 100% các điều kiện đang bật (GPS/Wifi công ty/Thiết bị đã đăng ký), thiếu bất kỳ điều kiện nào đều chặn hẳn, chỉ hiện bảng thông báo".**

- Sửa `verifyThenProceed()` trong `public/pages/timesheet.html` (dùng chung cho cả Check In lẫn Check Out): điều kiện qua thẳng đổi từ `passCount >= (checks.length >= 2 ? 2 : checks.length)` thành `passCount === checks.length` (yêu cầu ĐỦ mọi điều kiện đang bật — GPS/Wifi có thể tắt qua `GEO_RESTRICTION`/`IP_RESTRICTION`, Thiết bị luôn bật).
- Thay hẳn `showConfirmDialog()` (có 2 nút Huỷ/Đồng ý chấm công — cho phép bỏ qua điều kiện thiếu) bằng `showFailNotice()` (chỉ 1 nút "Đã hiểu", không còn đường nào chấm công khi thiếu điều kiện) — vẫn liệt kê rõ cả 3 điều kiện + điều kiện nào đang fail (tái dùng `verifyRowHtml()`/CSS `ts-confirm-*` có sẵn).
- Đã test thật trên trình duyệt (đăng nhập bằng `Auth.login()` qua console thay vì nhập mật khẩu, vì hàm này không kiểm tra mật khẩu — chỉ dùng để test nội bộ, không phải cách đăng nhập thật của app): tài khoản CEO đang GPS OK + Wifi OK nhưng Thiết bị lạ (máy dev chưa đăng ký) — bấm Check Out ra đúng bảng "Chưa đủ điều kiện chấm công", đánh dấu đỏ đúng dòng Thiết bị, chỉ có nút "Đã hiểu", và xác nhận check-out KHÔNG xảy ra (nút vẫn "Check Out", vẫn "Đang làm việc từ 11:22").

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 (a) — hoàn tất cột "Tên dự án" cho 11 sheet còn lại bằng script Apps Script thay vì thao tác tay, đọc kỹ mục này trước)

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-11 — hoàn tất cột "Tên dự án" cho 11 sheet còn lại bằng script Apps Script thay vì thao tác tay, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-11): làm nốt việc tồn đọng từ phiên trước — thêm cột "Tên dự án" (VLOOKUP) cho 11 sheet còn thiếu.**

- **Đổi cách làm giữa chừng**: bắt đầu thử thao tác tay trên UI Google Sheets (giống cách đã làm cho "Công việc" trước đó) nhưng sheet "Hoa hồng dự án" là dạng "Bảng" (Table) và việc sửa header ô qua automation liên tục bị **revert** (gõ xong Enter thì tự động quay lại giá trị cũ "Column 12") — thử nhiều kỹ thuật (double-click, triple-click, Ctrl+A, Home/End/Backspace qua phím) đều không ổn định, riêng phím Tab (thay vì Enter) để commit thì thành công 1 lần nhưng không tái lập được ổn định. **Quyết định chuyển hẳn sang viết hàm Apps Script chạy 1 lần** (`addTenDuAnLookupColumns()` trong `gsheets-api-v2.js`) thay vì vật lộn với UI — đáng tin cậy hơn nhiều cho việc lặp lại trên nhiều sheet.
- **`addTenDuAnLookupColumns()`**: quét qua danh sách 11 sheet, với mỗi sheet — tìm cột có field `projectId` (qua `viToEnHeader`), `insertColumnAfter()` ngay sau đó, đặt header `"Tên dự án"`, rồi `setFormulas()` hàng loạt công thức VLOOKUP cho mọi dòng dữ liệu. Bỏ qua (idempotent) nếu sheet đã có cột này.
- **Sự cố gặp phải + cách sửa**: lần chạy đầu bị crash giữa chừng ở sheet "Đơn hàng" — lỗi `Exception: Dữ liệu bạn đã nhập vào ô G2 vi phạm quy tắc xác thực dữ liệu được thiết lập trên ô này`. Nguyên nhân: y hệt kiểu lỗi "rule mồ côi" đã gặp trước đây ở sheet khác (xem mục 2026-09-10 "đồng bộ 2 chiều Loại dự án") — 1 quy tắc Xác thực dữ liệu dính cứng vào toạ độ ô vật lý (G2) từ thời sheet còn ở dạng khác, không di chuyển theo khi chèn cột mới, chặn `setFormulas()` ghi vào đó. Vì lỗi này ở giữa vòng `forEach` không try/catch nên **cả 8 sheet phía sau trong danh sách bị bỏ sót hoàn toàn** (chưa chạy tới).
  - **Sửa**: (1) bọc try/catch quanh từng sheet trong vòng lặp — 1 sheet lỗi không còn chặn các sheet còn lại; (2) gọi `clearDataValidations()` trên cả cột mới chèn TRƯỚC khi ghi bất cứ gì vào đó — dọn sạch mọi rule mồ côi có thể dính; (3) nếu `setFormulas()` hàng loạt vẫn lỗi, fallback ghi từng dòng riêng lẻ (bỏ qua đúng dòng lỗi, không mất cả sheet). Chạy lại `addTenDuAnLookupColumns()` lần 2 xử lý đúng 8 sheet còn thiếu (2 sheet đầu + Đơn hàng đã có cột nên tự bỏ qua).
  - Thêm hàm `backfillMissingTenDuAnFormulas()` riêng để vá các ô bị bỏ trống do lỗi ở lần chạy đầu (chỉ đụng ô đang trống VÀ không có công thức, an toàn chạy lại nhiều lần) — chạy 1 lần, vá đúng 10 dòng còn thiếu ở "Đơn hàng".
  - Cả 2 hàm đều nằm cạnh các hàm migration 1-lần khác (`normalizeAllLegacyIds`...) trong `gsheets-api-v2.js`, chạy tay từ trình chỉnh sửa Apps Script (không qua doGet/doPost, không cần redeploy).
- **Verify cuối cùng qua API thật**: gọi đủ cả 11 action tương ứng, đếm field `"Tên dự án"` xuất hiện ở MỌI dòng, 0 dòng rỗng — commissions(10), orders(10) [vá lại 10/10 sau backfill], contractorComparisons(4), cashFlowPlans(10), changeOrders(25), scheduleItems(180), acceptanceChecks(150), projectDocuments(150), bimIssues(33), bimBoqItems(50). "Công nợ khách hàng" (receivables) trả về mảng rỗng vì sheet đó **chưa từng được tạo thật** (chưa có ai thêm công nợ nào) — không phải lỗi, cột sẽ tự có đúng logic này khi sheet được tạo lần đầu (nếu cần ngay, chỉ cần `addTenDuAnLookupColumns()` chạy lại sau khi sheet tồn tại).
- **Bài học UI Google Sheets mới (bổ sung cho các bài học 2026-09-10)**: khi việc cần LẶP LẠI TRÊN NHIỀU SHEET (không phải 1 lần duy nhất), viết hẳn 1 hàm Apps Script chạy tay thay vì thao tác chuột/phím qua browser automation — nhất là với sheet dạng "Bảng" (Table), vì UI của Table dễ có hành vi lạ (auto-revert khi sửa header) không tái lập được ổn định qua tool tự động hoá trình duyệt. Giữ nguyên bài học cũ về rule Xác thực dữ liệu "mồ côi" (dính vào toạ độ ô cố định, không theo cột khi chèn/xoá) — giờ đã có cách xử lý chuẩn: LUÔN gọi `clearDataValidations()` trên vùng vừa tạo mới trước khi ghi dữ liệu vào đó, không giả định vùng mới tinh khôi hoàn toàn sạch.
- **Theo yêu cầu người dùng trong phiên này**: từ giờ mọi việc cần trình duyệt cho dự án này dùng **Claude in Chrome** (Chrome thật, đã sẵn đăng nhập Google) thay vì Browser pane trong app — Browser pane luôn khởi động ở trạng thái CHƯA đăng nhập Google nên phải hỏi người dùng đăng nhập tay mỗi lần, gây phiền. Đã lưu vào bộ nhớ dài hạn (memory), không hỏi lại việc này nữa.

## Trạng thái hiện tại (cập nhật lần cuối: 2026-09-10 — fix thiết bị chấm công ghi đè lẫn nhau + thêm cột deviceIds còn thiếu trên Sheet, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-10, theo report kèm ảnh chụp: mở web trên PC và trên điện thoại, cả 2 đều hiện mình là thiết bị "slot 1" duy nhất, đáng lẽ phải là slot 1 và slot 2):**

- **2 lỗi thật, không phải 1**:
  1. `checkDeviceStatus()` (`timesheet.html`) trước đó TỰ ĐỘNG đăng ký thiết bị mỗi lần kiểm tra (im lặng, không hỏi) bằng cách đọc/ghi `member` từ cache CỤC BỘ của từng trình duyệt — 2 máy check gần nhau đều thấy cache cũ "chưa có ai đăng ký" rồi đều tự ghi mình là thiết bị đầu tiên, ghi đè lẫn nhau (race điều kiện đọc-sửa-ghi không nguyên tử kinh điển).
  2. **Nguyên nhân gốc thật sự khiến 2 máy "không thấy nhau" chút nào**: cột `deviceIds` **CHƯA TỪNG TỒN TẠI** trên sheet Thành viên thật — nên mọi lần "đăng ký" trước giờ chỉ nằm trong localStorage của riêng từng máy, không hề lên được Sheet dùng chung, bất kể lỗi race ở trên.
- **Đã sửa cả 2**:
  1. Bỏ hẳn tự động đăng ký — `checkDeviceStatus()` giờ CHỈ ĐỌC trạng thái. Đăng ký thật sự chỉ xảy ra khi người dùng tự bấm nút **"+ Đăng ký thiết bị này"** (đổi tên từ "+ Thêm thiết bị này" theo đúng yêu cầu), và trước khi ghi sẽ tự `refreshFromGSheets()` tải lại dữ liệu mới nhất để không ghi đè lên thiết bị máy khác vừa đăng ký. Thiết bị lạ/chưa đăng ký vẫn KHÔNG chặn cứng chấm công (vẫn chỉ tính 1/3 điều kiện như GPS/Wifi, đúng thiết kế cũ).
  2. Thêm cột `deviceIds` (plain, không map FIELD_MAP, giống `lastActiveAt`/`theme`) vào sheet Thành viên — verify round-trip qua curl, không cần redeploy Apps Script.
- Dữ liệu thiết bị cũ (nếu người dùng từng bấm "đăng ký" trước bản sửa này) coi như MẤT vì chưa từng lên Sheet thật — không có gì để khôi phục, người dùng cần đăng ký lại từ đầu ở mỗi máy sau bản sửa này (bình thường, không phải lỗi).

## Trạng thái phiên trước (2026-09-10 — form ngày dd/mm/yyyy toàn hệ thống, dropdown Thành viên tham gia của Dự án, cột "Tên dự án" tra cứu — MỚI XONG 1/12 sheet, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-10, theo 3 yêu cầu trong 1 tin nhắn — ngày tháng dd/mm/yyyy, dropdown Thành viên tham gia, cột Tên dự án):**

1. **Ngày/giờ hiển thị dd/mm/yyyy toàn hệ thống** (KHÔNG đụng field "Tháng" dạng YYYY-MM — cố tình giữ nguyên vì code lọc theo tháng ở finance/payslip/commission so khớp chuỗi chính xác, đổi format sẽ hỏng lọc). Gốc vấn đề: `createdAt`/`date`/... ghi chuỗi ngày-thuần "YYYY-MM-DD" thường được Sheets tự nhận là ngày thật (hiển thị đúng theo định dạng cột đã đặt sẵn), nhưng `updatedAt`/`reviewedAt` ghi CẢ giờ-phút-giây kiểu ISO đầy đủ ("2026-09-10T06:14:53.976Z") thì Sheets KHÔNG tự nhận ra, cứ hiện nguyên văn xấu. Sửa: thêm `toRealDateIfDateField()` trong `gsheets-api-v2.js`, ép các field ngày/giờ (`createdAt, updatedAt, date, dob, deadline, startDate, endDate, dueDate, checkedAt, approvedAt, reviewedAt, plannedStart, plannedEnd, actualStart, actualEnd`) thành `Date` object THẬT trước khi ghi (thay vì chuỗi) — Sheets tự hiển thị theo đúng định dạng cột đã có, đọc lại vẫn qua nhánh có sẵn (format về 'yyyy-MM-dd' cho app dùng nội bộ, không đổi hành vi app).
2. **"Thành viên tham gia" (Dự án) chuyển sang dropdown multi-select gốc của Sheets** — y hệt cách đã làm cho "Mã người phụ trách" (Công việc) trước đó: đổi từ JSON array text sang chuỗi phẩy, thêm `members` vào `COMMA_LIST_FIELDS`, migration `migrateProjectMembersToCommaFormat()` (chạy tay, đã chạy 2 lần — lần đầu bị 1 dòng "vi phạm xác thực" do rule cũ F4 lỗi, lần 2 sau khi sửa rule mới hết sạch). **Phát hiện phụ**: cột F có 1 rule "Giá trị chứa 1 giá trị trong danh sách" DÍNH RIÊNG Ô F4 (leftover từ thời sheet còn là Bảng/Table) — không phải F2:F500 như tưởng, đã xoá rule cũ và tạo lại đúng 1 rule F2:F500 kiểu "Trình đơn thả xuống (của một dải ô)" trỏ `Thành viên!A2:A500` + "Cho phép có nhiều lựa chọn" + "Hiện cảnh báo".
3. **Cột "Tên dự án" tra cứu song song bên cạnh "Mã dự án"** (VLOOKUP, cho dễ phân biệt khi nhìn mã dài) — **mới làm xong đúng 1/12 sheet (Công việc/Tasks)**, verify đủ 91/91 dòng qua API. 11 sheet còn lại (commissions, receivables, orders, contractorComparisons, cashFlowPlans, changeOrders, scheduleItems, acceptanceChecks, projectDocuments, bimIssues, bimBoqItems) **CHƯA LÀM** — thao tác Sheet UI lặp lại quá nhiều (chèn cột, viết công thức, kéo xuống hết dữ liệu) và môi trường UI Google Sheets phiên này liên tục bị treo/lag khi thao tác panel + cuộn, nên dừng lại sau 1 sheet để không rủi ro thêm. Công thức mẫu đã verify đúng: `=IFERROR(VLOOKUP($E2;'Dự án'!$A:$B;2;FALSE);"")` (chú ý dùng dấu `;` không phải `,` — xem bài học bên dưới).
   - Đã thêm cơ chế an toàn `fillComputedHelperFormulas()` trong `gsheets-api-v2.js`: mỗi khi `addData`/`addDataBatch` thêm dòng mới, tự COPY công thức từ dòng ngay trên xuống cho các cột "chỉ chứa công thức" (khai báo trong `COMPUTED_HELPER_HEADERS`, hiện có `'Tên dự án'`) — nếu không có bước này, dòng mới tạo qua app sẽ bị ghi '' đè mất công thức.
- **Bài học kỹ thuật mới (quan trọng cho lần sau)**:
  - Công thức gõ trực tiếp vào ô của Google Sheet này dùng dấu `;` làm dấu phân cách đối số, KHÔNG phải `,` (locale tiếng Việt dùng `,` làm dấu thập phân) — gõ `,` sẽ báo "Lỗi phân tích cú pháp công thức" dù công thức nhìn đúng 100%.
  - Panel nổi (VD "Quy tắc xác thực dữ liệu") có không gian toạ độ KHÁC hẳn lưới ô chính khi thao tác qua automation — toạ độ đoán từ ảnh chụp sai lệch ~0.55 lần. Cách chắc ăn: dùng JS tìm phần tử theo đúng text rồi bắn chuỗi sự kiện chuột đầy đủ (pointerdown/mousedown/pointerup/mouseup/click), hoặc set `.value` qua native setter cho ô nhập liệu — không đoán toạ độ pixel.
  - Ô Hộp tên (Name Box) qua automation vẫn hay bị "trơ" (gõ vào không nhận) — cách né: dùng kỹ thuật native-setter ở trên áp dụng luôn cho Hộp tên.

## Trạng thái phiên trước (2026-09-10 — fix bug Check Out bỏ qua GPS/Wifi, tên thiết bị dễ đọc, fix modal Tạo Task tràn màn hình mobile, presence thật + theme theo tài khoản, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-10, 4 việc riêng theo phản hồi trực tiếp của người dùng, không liên quan tới "Loại dự án" ở mục dưới):**

1. **Bug bảo mật chấm công**: Check In kiểm tra đủ 3 điều kiện (GPS/Wifi công ty/Thiết bị đã đăng ký) và bắt buộc đạt tối thiểu 2/3, nhưng **Check Out chỉ kiểm tra mỗi điều kiện Thiết bị** — bỏ hẳn GPS/Wifi, nên dù 2/3 điều kiện fail vẫn check-out được (đúng lỗi người dùng chụp ảnh báo). Đã gộp logic 2 hành động dùng chung 1 hàm `verifyThenProceed()` trong `public/pages/timesheet.html`.
2. **Tên thiết bị dễ đọc kiểu Facebook/Zalo**: thay mã hex vô nghĩa ("B53893BF") bằng tên tự nhận diện qua User-Agent (VD "iPhone · Safari", "Windows PC · Chrome") — hàm `getDeviceLabel()`. Lưu kèm ID trong `Members.deviceIds` dạng cặp `id::tên` (tương thích ngược với dữ liệu cũ chỉ có ID trần). **Lưu ý đã báo người dùng**: nếu mã thiết bị vẫn đổi liên tục, khả năng do mở web qua 2 đường khác nhau trên iOS (Safari thường vs "Thêm vào màn hình chính" — 2 vùng lưu trữ tách biệt hoàn toàn) hoặc chế độ Ẩn danh — giới hạn của iOS/trình duyệt, không sửa được bằng code.
3. **Modal "Tạo Task Mới" tràn ra ngoài màn hình trên mobile**: `task-manager.css` thiếu quy tắc responsive cho `.form-row` (2 cột) — `projects.css` (modal tạo dự án khác) đã có sẵn rule này nhưng task-manager.css thì không. Đã thêm `.form-row { grid-template-columns: 1fr; }` ở `@media (max-width: 768px)`, giống đúng pattern projects.css.
4. **Số "đang hoạt động" ở trang chủ luôn hiện total/total** (VD "6/6") vì code cũ SUY ĐOÁN theo giờ hành chính (8h-18h ngày thường → tính TẤT CẢ thành viên là online) — sai hoàn toàn với thực tế. Thay bằng **presence heartbeat thật**: `portal.js` tự ping timestamp lên field mới `Members.lastActiveAt` mỗi ~60s trong lúc tab đang mở & hiển thị (dừng khi ẩn tab), trang chủ tính online = ping trong 3 phút gần nhất, và định kỳ `refreshFromGSheets` (chỉ khi đang ở trang chủ, tránh gọi API thừa ở trang khác) để thấy người khác online/offline gần thời gian thực.
   - Tiện làm luôn theo yêu cầu thứ 2 cùng lúc: **nhớ giao diện sáng/tối THEO TÀI KHOẢN** (field mới `Members.theme`, không chỉ theo trình duyệt) — đăng nhập lại ở máy khác vẫn ra đúng theme đã chọn lần cuối.
   - 2 field mới `lastActiveAt`/`theme` đã thêm cột trực tiếp trên sheet "Thành viên" (cột S, T) — **KHÔNG cần sửa/redeploy Apps Script** vì đi qua đúng cơ chế "cột không map trong FIELD_MAP, chỉ cần header khớp tên field tiếng Anh" đã có sẵn cho `deviceIds` — verify round-trip qua `updateMember`/`getMembers` bằng curl trực tiếp, chạy đúng ngay không cần deploy version mới.
- **Bài học thao tác Google Sheets mới**: khi cần gõ vào ô ở cột chưa có trong 1 "Table" (Bảng_N), Name Box (ô nhập địa chỉ ô góc trên-trái) đôi lúc KHÔNG nhận click/type qua automation — cách chắc ăn hơn là click trực tiếp vào 1 cell gần đó trong lưới rồi dùng phím mũi tên (Left/Right) để di chuyển tới đúng ô cần, tin theo ô địa chỉ hiện ra ở Name Box sau mỗi lần di chuyển thay vì đoán toạ độ click.

## Trạng thái phiên trước (2026-09-10 — đồng bộ 2 chiều "Loại dự án" web ↔ Google Sheet + fix dữ liệu thô chưa qua dropdown ở Công việc/Dự án, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-10, theo yêu cầu người dùng kèm 3 ảnh chụp: web hiển thị 11 loại dự án chi tiết nhưng dropdown Google Sheet chỉ có 3, yêu cầu đồng bộ 2 chiều — sổ trên web thì Sheet cũng đúng list đó, thêm ở Sheet thì web cũng tự thấy; ảnh 3 lộ thêm nhiều ô Trạng thái ở Công việc/Dự án là text thô tiếng Anh chưa qua dropdown dù rule dropdown đã có sẵn):**

- **Kiến trúc đồng bộ 2 chiều "Loại dự án"**: thêm 1 cột nguồn thật (không phải danh sách tĩnh) — cột **U** (ẩn) trên sheet "Dự án", header "Danh sách Loại dự án (nguồn dropdown)", U2:U12 chứa đúng 11 giá trị đang hardcode trong web, chừa trống đến U50 để dễ thêm sau. Cột R (Loại dự án) đổi từ dropdown tĩnh 3 giá trị sang **Trình đơn thả xuống (của một dải ô)** trỏ thẳng `Dự án!U2:U50` — y hệt pattern "dropdown sống" đã dùng cho mã thành viên/mã dự án trước đây, lần đầu áp dụng cho 1 cột enum dạng text tự do thay vì cột tham chiếu mã.
  - Backend: thêm action `getProjectTypes` trong `gsheets-api-v2.js` (đọc `Dự án!U2:U50`, lọc rỗng, trả mảng) — cùng pattern với `getProvinceList` đã có.
  - Frontend: `projects.js` (`bindProjectModal`) và `pricing.html` (hàm `fetchProjectTypes`, gọi cạnh `fetchProvinceList`) đều fetch `getProjectTypes` lúc mở modal, dựng lại `<option>` của `#project-building-type` từ dữ liệu sống, giữ nguyên giá trị đang chọn nếu có. **11 `<option>` hardcode trong `projects.html`/`pricing.html` CỐ Ý giữ lại làm fallback** nếu API lỗi/chậm — JS sẽ ghi đè ngay khi fetch xong.
  - Kết quả: giờ chỉ cần sửa 1 chỗ duy nhất (cột U trên Sheet) để thêm/bớt loại dự án — cả dropdown Sheet lẫn dropdown web đều tự cập nhật, không cần sửa code hay redeploy nữa cho việc thêm loại dự án mới.
  - Đã verify: gọi thẳng API `getProjectTypes` sau khi redeploy, nhận đúng 11 giá trị.
- **Tiện làm luôn (do lộ ra trong ảnh 3 của yêu cầu)**: phát hiện sheet Công việc VÀ Dự án đều còn nhiều ô Trạng thái/Mức độ ưu tiên là **text thô tiếng Anh/chưa chuẩn hoá** (VD "completed") dù rule dropdown Việt hoá đã có từ trước — cùng loại lỗi "dropdown đã gắn nhưng dữ liệu cũ chưa migrate" từng gặp với BIM Issues trước đây nhưng bị bỏ sót ở 2 sheet này. Đã dùng Tìm-và-Thay-thế sửa hết, verify lại bằng API thấy 0 giá trị sai.
- Redeploy Apps Script: **Phiên bản 45** (thêm action `getProjectTypes`) — dán lại TOÀN BỘ file qua clipboard (Ctrl+A → Ctrl+V nội dung từ file local đã đúng) thay vì gõ chèn từng đoạn, vì gõ chèn nhiều lần liên tiếp trong trình soạn thảo Apps Script (auto-indent + auto-close ngoặc `{}` của editor) làm hỏng cấu trúc code 2-3 lần liên tiếp (dòng bị dính chữ, ngoặc thừa) — **bài học mới cho lần sau: sửa TRỰC TIẾP file `.js` local trước rồi copy TOÀN BỘ nội dung qua clipboard (PowerShell `Set-Clipboard -Value (Get-Content -Raw ...)`) dán đè vào Apps Script, thay vì gõ tay từng đoạn chèn vào giữa code cũ trên trình duyệt — đáng tin cậy hơn nhiều lần với file lớn.**
- Chưa làm/không thuộc phạm vi lần này: quét thêm các sheet khác ngoài Công việc/Dự án xem có bị lệch dữ liệu thô-chưa-migrate tương tự không (người dùng yêu cầu "xử lí hết cho đồng bộ" nhưng phạm vi đã xử lý mới giới hạn ở những gì lộ ra trong 3 ảnh chụp).

## Trạng thái phiên trước (2026-09-10 — multi-assignee cho Công việc + fix lệch dữ liệu Hồ sơ công trình, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-10, ngay sau đợt Việt hoá dropdown toàn sheet — 2 việc còn treo lại đã làm xong): (1) tính năng "nhiều người phụ trách" cho Công việc; (2) sửa `pricing.html` khớp lại đúng 3 trạng thái thật của Hồ sơ công trình.**

- **Hồ sơ công trình**: `pricing.html` trước đó code cứng 3 trạng thái "Chưa có/Đang làm/Đã có" không khớp dữ liệu thật trên Sheet ("Chưa có/Đang bổ sung/Đã đủ") — đã sửa lại đúng 3 giá trị thật, commit `e09ab21`.
- **Multi-assignee cho Công việc** — đổi field `assigneeId` (string) → `assigneeIds` (mảng) xuyên suốt hệ thống: `FIELD_MAP`, đọc/ghi Sheet, lọc, hiển thị (Kanban/List/Timeline/Gantt/Portal), cascade đổi mã NV. Commit `d7ef7c4`.
  - **Bài học nền tảng quan trọng (khác hẳn giả định ban đầu)**: Google Sheets dropdown cổ điển (Xác thực dữ liệu, "Trình đơn thả xuống của một dải ô") **CÓ hỗ trợ chọn nhiều giá trị** — chỉ cần tick checkbox "Cho phép có nhiều lựa chọn" ngay trong panel quy tắc (không cần bảng/tiện ích gì thêm). Ban đầu tưởng nhầm là Sheets hoàn toàn không hỗ trợ multi-select nên định bỏ hẳn dropdown ở cột này — SAI, đã sửa lại.
  - **Định dạng ô khi bật multi-select — đã kiểm chứng thực tế**: Sheets tự lưu các giá trị đã chọn thành **CHUỖI PHÂN TÁCH BỞI DẤU PHẨY** trong ô (`"id1, id2"`), **KHÔNG PHẢI mảng JSON** như các cột multi-value khác trong hệ thống này (`dailyTasks`, `items`...). Ban đầu code sai theo hướng JSON trước, phát hiện lỗi khi test tay trên Sheet UI (chọn 2 người → ô thành `["id_cũ"], id_mới` — lộ ra Sheets đang nối thêm bằng dấu phẩy vào text cũ). Đã sửa `getAllData()` (đọc: `key === 'assigneeIds'` thì tách theo dấu phẩy thành mảng) và thêm hàm `stringifyArrayForCell()` (ghi: field `assigneeIds` nối bằng `', '`, các field mảng khác vẫn `JSON.stringify` như cũ) trong `gsheets-api-v2.js`.
  - **UI chọn nhiều người trong 2 modal tạo/sửa task** (`projects.js`+`projects.html`, `task-manager-app.js`): ban đầu thử checkbox-list rồi `<select multiple>` gốc trình duyệt — người dùng phản hồi cả 2 đều xấu hơn dropdown 1-lựa-chọn cũ. Giải pháp cuối: 1 nút bấm style y hệt `<select>` cũ (dùng lại đúng class `.form-select`/CSS select gốc) + bấm ra 1 panel checklist thả xuống (position:absolute, class `.assignee-dd*` mới thêm vào `projects.css`/`task-manager.css`) — trông giống hệt dropdown gốc, khác duy nhất là chọn được nhiều dòng có tick ✓. Đây là mẫu nên tái dùng cho bất kỳ multi-select nào cần thêm sau này thay vì checkbox-list hay `<select multiple>`.
  - Đã chạy 2 migration 1-lần trên Apps Script (`migrateTaskAssigneeToArray` rồi `migrateTaskAssigneeToCommaFormat` — bản đầu sai định dạng JSON, bản 2 sửa lại đúng dấu phẩy) chuyển hết 91 dòng Công việc hiện có. Redeploy 3 lần trong quá trình này (bản 42 → 43 → 44) — lần đầu bị lỗi cũ "chọn nhầm phiên bản cũ thay vì Phiên bản mới" tái diễn, phải luôn xác nhận số phiên bản bằng zoom trước khi tin.

## Trạng thái phiên trước (2026-09-10 — Việt hoá + gắn dropdown sống cho gần hết các sheet trong database, đọc kỹ mục này trước)

**Việc mới nhất (2026-09-10, theo yêu cầu "Hãy tự động lọc và xem xét những đầu mục thông tin cố định của từng sheet và chủ động làm nhé, làm cho toàn bộ đi"): rà toàn bộ các sheet trong Google Sheet chính, biến MỌI cột có tập giá trị cố định (trạng thái/mức độ ưu tiên/loại/danh mục) thành dropdown tiếng Việt, và MỌI cột tham chiếu (mã thành viên/mã dự án/mã sản phẩm...) thành dropdown SỐNG tự cập nhật khi có dòng mới — không cần sửa tay mỗi khi thêm thành viên/dự án mới.**

- **Giới hạn nền tảng quan trọng phát hiện được (áp dụng cho MỌI lần làm dropdown sau này)**: Google Sheets "Bảng" (Table, nhãn "Bảng_N" góc trên-trái) chỉ cho phép loại cột "Trình đơn thả xuống" dùng **danh sách tĩnh** (tự gõ từng lựa chọn màu riêng) — HOÀN TOÀN KHÔNG có tuỳ chọn "lấy từ 1 dải ô" như Xác thực dữ liệu cổ điển. Vì vậy với cột cần dropdown SỐNG (tham chiếu mã thành viên/dự án — phải tự thêm lựa chọn khi có dòng mới), **bắt buộc chuyển sheet đó từ Bảng → dải ô thường** trước (menu tên sheet hoặc "Chỉnh sửa loại cột" → "Chuyển về dữ liệu chưa được định dạng"), rồi mới dùng Dữ liệu > Xác thực dữ liệu > "Trình đơn thả xuống (của một dải ô)" trỏ thẳng vào cột A của sheet nguồn (VD `Thành viên!A2:A500`, `Dự án!A2:A500`) — dropdown này tự thấy dòng mới ngay khi thêm, không cần sửa lại rule.
  - Chuyển Bảng → dải ô LUÔN xoá mất định dạng màu nền/chữ trắng đậm của hàng tiêu đề — phải tô lại tay mỗi lần (chọn hàng tiêu đề → màu nền chọn đúng swatch xanh lá đã lưu sẵn dưới "TÙY CHỈNH", hex `#356954` → chữ trắng → đậm).
  - Với cột chỉ cần danh sách tĩnh cố định (không phải tham chiếu — VD Trạng thái/Mức độ ưu tiên), KHÔNG cần chuyển sheet khỏi Bảng — Xác thực dữ liệu cổ điển vẫn áp dụng thẳng lên cột trong Bảng bình thường, không lỗi.
- **Đã Việt hoá xong (đổi từ tiếng Anh/slug thô sang nhãn tiếng Việt + thêm `VALUE_MAP` dịch 2 chiều trong `gsheets-api-v2.js` để app vẫn nhận đúng key tiếng Anh cũ)**: `orders.status` (Nháp/Đã xác nhận/Đã thanh toán/Đã huỷ), `bimIssues.status` (Mới/Đang xử lý/Chờ phản hồi/Đã giải quyết) và `bimIssues.priority` (Cao/Trung bình/Thấp) — 2 cột BIM này trước đó lưu thẳng slug tiếng Anh (`moi`, `dang-xu-ly`...) trên Sheet, đã dùng Tìm-và-Thay-thế (khớp toàn bộ ô, giới hạn đúng phạm vi cột) đổi hết dữ liệu có sẵn sang nhãn Việt trước khi gắn dropdown.
- **Đã gắn dropdown SỐNG (Thành viên!A2:A500 / Dự án!A2:A500) cho cột "Người tạo"/"Người phụ trách"/"Người đề xuất"/"Mã dự án" ở TẤT CẢ các sheet sau**: Đơn hàng, Bảng giá dịch vụ, So sánh nhà thầu, Dòng tiền, Phát sinh, Tiến độ, Nghiệm thu, Hồ sơ công trình, Sản phẩm BIM, Vật liệu BIM, Nhà cung cấp BIM, Issue BIM, BOQ BIM (BOQ còn có thêm dropdown sống "Mã sản phẩm" trỏ `Sản phẩm BIM!A2:A500`, Sản phẩm BIM có dropdown sống "Vật liệu liên kết" trỏ `Vật liệu BIM!A2:A500`).
- **Đã gắn dropdown TĨNH màu sắc cho các cột trạng thái/enum còn lại theo đúng dữ liệu THẬT đã seed sẵn trên sheet** (không đoán, đọc dữ liệu mẫu thật rồi mới đặt tên lựa chọn): Phát sinh (Giai đoạn: Thi công phần thô/Lắp đặt nội thất/Hoàn thiện; Nguyên nhân: Yêu cầu thay đổi/Sai khác hiện trạng/Bổ sung hạng mục; Trạng thái: Chờ duyệt/Đã duyệt/Từ chối), Tiến độ (Trạng thái: Chưa bắt đầu/Đang thi công/Hoàn thành/Chậm tiến độ), Nghiệm thu (Kết quả: Chưa kiểm tra/Đạt/Không đạt), Hồ sơ công trình (Trạng thái: **Chưa có/Đã đủ/Đang bổ sung** — xem cảnh báo lệch dữ liệu ngay dưới).
- **Phát hiện lệch dữ liệu CHƯA SỬA (đã tạo task riêng để làm sau, không tự sửa vì ngoài phạm vi yêu cầu)**: sheet "Hồ sơ công trình" có dữ liệu thật dùng 3 trạng thái **Đã đủ/Chưa có/Đang bổ sung**, nhưng `pricing.html` (tab "Hồ sơ công trình") lại code cứng 3 lựa chọn khác hẳn: **Chưa có/Đang làm/Đã có** — 2 bên không khớp nhau. Việc gắn dropdown trên Sheet đã theo đúng dữ liệu thật (ưu tiên thực tế hơn code cũ, giống tiền lệ đã làm với Dự án/Đề xuất trước đây), còn việc sửa `pricing.html` cho khớp lại thì để làm sau.
- **1 sự cố tự gây ra & đã tự phát hiện + sửa xong trong cùng phiên**: lúc đang thao tác chuột hàng loạt để gắn màu cho dropdown "Mức độ ưu tiên" sheet Issue BIM, vô tình làm trống mất ô `G2` (dòng đầu tiên) — phát hiện qua bước verify cuối bằng cách gọi thật API `getBimIssues` và kiểm tra từng dòng có khớp 1 trong các giá trị hợp lệ không, thấy dòng đầu bị rỗng → đã điền lại "Trung bình" cho đúng, verify lại API thấy 33/33 dòng hợp lệ. **Bài học: sau mỗi đợt thao tác chuột dồn dập để tô màu dropdown, luôn gọi API đọc lại TOÀN BỘ sheet và so từng giá trị với danh sách hợp lệ trước khi coi là xong — đừng chỉ tin vào ảnh chụp màn hình từng ô.**
- Apps Script (`HICONIQUE NỘI BỘ API`) đã redeploy 2 lần trong phiên này: **Phiên bản 41** (thêm `orders.status` VALUE_MAP) và **Phiên bản 42** (thêm `bimIssues.status`/`bimIssues.priority` VALUE_MAP) — cả 2 lần đều verify bằng round-trip thật (ghi 1 giá trị tiếng Việt qua `updateOrder`/đọc lại qua `getOrders`, thấy đúng key tiếng Anh trả về, rồi trả lại giá trị gốc).
  - **Lỗi lặp lại nhiều lần khi soạn `VALUE_MAP` trực tiếp trong trình chỉnh sửa Apps Script bằng cách gõ chèn ("End" rồi gõ tiếp nối)**: rất dễ chèn nhầm object property MỚI vào GIỮA 1 mảng CŨ chưa đóng ngoặc (vì trình soạn thảo không hiện rõ ngoặc đang mở ở đâu khi cuộn xa), sinh lỗi `SyntaxError: Unexpected token` mà thông báo lỗi chỉ trỏ đúng vị trí ký tự sai chứ không giải thích được NGUYÊN NHÂN cấu trúc. **Cách chắc ăn hơn cho lần sau**: chọn (bôi đen) TRỌN VẸN cả khối `'key': [...]` cũ cần thêm-vào-sau bằng Home/shift+End rồi GÕ ĐÈ (replace) toàn bộ khối bằng nội dung mới đã viết đầy đủ từ đầu — không chèn thêm nối đuôi vào giữa cấu trúc cũ; luôn zoom lại đúng vùng vừa sửa để đếm khớp số `[`/`]` bằng mắt trước khi bấm Lưu.
- **Việc chưa làm / đang treo lại (đã nêu lại đúng với người dùng)**: (1) tính năng "nhiều người phụ trách" (multi-assignee) cho Công việc — người dùng yêu cầu "Làm đầy đủ luôn trong lần này" nhưng phiên này chưa động tới, cần cả đổi Sheet (multi-select) lẫn sửa code app (lưu/hiển thị/lọc/thông báo/phân quyền theo nhiều người); (2) sửa `pricing.html` khớp lại 3 trạng thái thật của Hồ sơ công trình (đã tạo sẵn task suggestion riêng); (3) 5 sheet HICON-BIM còn 2 cột free-text chưa và KHÔNG cần dropdown (Danh mục/Nhóm sản phẩm, Loại nhà cung cấp — xác nhận qua code thật là input tự do, không có select nào trong app).
- Đã push lên GitHub (`Hiconique-web-noibo`) — các commit liên quan: `afb0d89`, `8f7518b`, `d268818`, `285401b`, `de87e81`.

## 0. Trạng thái hiện tại (cập nhật lần cuối: 2026-09-09 — mở rộng migration ID bắt hết mã cũ + fix session cũ khiến "Thêm thiết bị" không hoạt động, đọc kỹ mục này)

**Việc mới nhất (2026-09-09, theo yêu cầu người dùng gửi kèm ảnh chụp): fix lỗi hiển thị "Đang làm việc từ 1899-12-30" trong `timesheet.html`, thêm định dạng ngày D/M/YYYY, thêm nút "+ Thêm thiết bị này" và nút "Sửa" ghi chú.**

- **Bug "1899-12-30" — nguyên nhân gốc**: `checkinTime`/`checkoutTime` trong sheet "Chấm công" là ô kiểu THỜI GIAN (VD "17:12"), không phải ngày. Google Sheets lưu 1 giá trị thời-gian-thuần bằng cách gán phần NGÀY về đúng ngày gốc (epoch) của Sheets là **30/12/1899** — khi đọc qua `getValues()`, Apps Script trả về 1 object `Date` thật mang cả phần ngày rác đó lẫn phần giờ đúng. Code cũ trong `getAllData()` (`gsheets-api-v2.js`) coi MỌI cột kiểu Date là ngày thật và format cứng `'yyyy-MM-dd'` — với `checkinTime` điều này in ra đúng phần ngày rác `"1899-12-30"` và ĂN MẤT hoàn toàn phần giờ thật.
  - **Sửa**: thêm điều kiện — nếu `key` là `checkinTime`/`checkoutTime` thì format `'HH:mm'` thay vì `'yyyy-MM-dd'`, các cột ngày khác (dob, deadline, startDate...) không đổi. Đã deploy Apps Script (Phiên bản 33), verify qua `getTimesheet` thấy `checkinTime`/`checkoutTime` trả về đúng "17:12" v.v. — không cần migrate dữ liệu cũ vì bug chỉ nằm ở READ, ô gốc trên Sheet vẫn luôn đúng.
  - **Lưu ý UI**: `timesheet.html` dựng từ `localStorage` cache (đồng bộ nền từ Sheet, xem `task-data.js`), nên NGAY sau khi fix backend, lần load trang ĐẦU sau đó vẫn có thể còn hiện dữ liệu cache cũ (do cache được ghi async sau khi trang đã vẽ xong lần đầu, không có cơ chế tự vẽ lại) — load lại trang lần 2 sẽ đúng. Không phải bug mới, không cần sửa thêm (chấp nhận được, cache tự cập nhật trong vài giây).
- **Định dạng ngày ngắn D/M/YYYY**: thêm hàm `formatShortDate(dateStr)` trong `task-data.js` (`"2026-09-09"` → `"9/9/2026"`, không có số 0 đứng đầu), export qua `TaskManager.formatShortDate`. Dùng ở: (1) `timesheet.html` — dòng trạng thái "Đang làm việc từ HH:mm · D/M/YYYY" (trước đây chỉ có giờ); (2) thông báo "Chấm công trễ" trong `task-data.js` (`getSmartAlerts`) — thêm `· D/M/YYYY` vào cuối message.
- **Nút "+ Thêm thiết bị này"**: `timesheet.html` mục "Thiết bị chấm công đã đăng ký" trước đây chỉ có nút "Gỡ" (xoá) — không có cách chủ động thêm, chỉ tự đăng ký ngầm khi check-in. Thêm nút này vào ô "Còn trống" ĐẦU TIÊN, CHỈ hiện khi thiết bị đang dùng (`getOrCreateDeviceId()`) CHƯA có trong danh sách — bấm gọi `TaskManager.registerMemberDevice(userId, myDeviceId, user)` rồi render lại. **Lưu ý đã phát hiện lúc test**: trang này tự chạy `runLiveStatusCheck()` ngay khi load (hiện trạng thái GPS/Wifi/Thiết bị dù chưa bấm Check-in), và bước đó đã tự đăng ký thiết bị hiện tại vào slot trống NGAY KHI TẢI TRANG — nên trong luồng bình thường, nút mới này hiếm khi thực sự hiện ra (slot trống thường đã bị auto-fill trước khi người dùng kịp thấy). Vẫn giữ nút lại làm lớp dự phòng (phòng trường hợp auto-register lỗi/bị chặn) — đúng yêu cầu người dùng, không phải thừa.
  - **Phát hiện phụ (CHƯA sửa, ghi lại để biết)**: cột `deviceIds` của thành viên KHÔNG có trong `FIELD_MAP.members` của `gsheets-api-v2.js` — nghĩa là toàn bộ việc đăng ký/gỡ thiết bị hiện tại chỉ tồn tại trong `localStorage` của TỪNG máy/trình duyệt, KHÔNG thực sự ghi lên Google Sheet (gọi `updateMember({deviceIds: ...})` nhưng backend chỉ ghi vào cột đã CÓ SẴN trên header sheet, cột này chưa tồn tại nên bị bỏ qua âm thầm). Hệ quả: đổi trình duyệt/máy thì danh sách thiết bị quen dùng bị mất trắng. Không sửa trong lần này (ngoài phạm vi yêu cầu — chỉ được hỏi "thêm nút"), nhưng nên biết nếu sau này cần thiết bị đăng ký thật sự bền/đồng bộ giữa các máy.
- **Nút "Sửa" ghi chú (Day detail)**: mục "GHI CHÚ" trong bảng chi tiết theo ngày (`#tsDayDetail`) trước đây chỉ hiển thị, không sửa được. Thêm nút "Sửa" (chỉ hiện khi ngày đó đã có bản ghi chấm công thật, ẩn khi "Chưa chấm" vì không có gì để gắn ghi chú vào) → bấm mở `<textarea>` + nút Lưu/Huỷ → Lưu gọi `TaskManager.updateTimesheetEntry(record.id, {note})`. Đã test thật: sửa ghi chú "T4, 9 tháng 9, 2026" thành "Test ghi chú", verify qua `getTimesheet` thấy đã lưu đúng lên Sheet, sau đó xoá lại ghi chú test.

**Cập nhật tiếp theo cùng ngày (người dùng gửi ảnh chụp các sheet vẫn còn mã ID kiểu cũ): mở rộng migration để bắt HẾT mọi mã cũ (không chỉ 1 hình dạng cụ thể), và tìm ra + sửa lý do nút "+ Thêm thiết bị này" không hoạt động.**

- **Vì sao migration lần đầu bỏ sót nhiều mã cũ**: hàm gốc `migrateAllIdsAddRandomSuffix()` chỉ khớp ĐÚNG 1 hình dạng cũ (`prefix_YYMMDD_timestamp`, y hệt cách `makeId()` sinh ra TRƯỚC khi thêm số random) — không bắt được các mã chép tay/seed từ rất lâu có hình dạng khác hẳn: `task_001`..`task_004` (Công việc), `prj_A`/`prj_B`/`prj_C` (Dự án), `document_260101_1_562336`..`document_260101_8_214415` (Tài liệu — 8 dòng đầu tiên do `DEFAULT_DOCUMENTS` seed sẵn), `timesheet_1788780930898` (Chấm công — thiếu cả phần YYMMDD, format cổ nhất). Tất cả những mã này KHÔNG khớp regex cũ nên bị bỏ qua nguyên vẹn.
- **Sửa — viết lại thành công cụ dùng lại được lâu dài**: đổi tên hàm thành **`normalizeAllLegacyIds()`**, đổi cách kiểm tra từ "khớp đúng 1 hình dạng CŨ cụ thể" sang **"KHÔNG khớp hình dạng ĐÚNG CHUẨN HIỆN TẠI"** — hằng số `CANONICAL_ID_RE` (`/^[a-zA-Z0-9]+_\d{6}_\d{13}_\d{6}$/`, đòi đúng 13 số ở phần timestamp — độ dài thật của `Date.now()`, để không nhận nhầm các mã seed có hình dạng giống nhưng timestamp giả ngắn hơn kiểu `document_260101_1_562336`). Mọi id không khớp → sinh **HOÀN TOÀN MỚI** qua `makeId()` (không phải chỉ nối thêm số như bản đầu). **Đây là quy tắc chung cho MỌI LẦN đổi form mã ID sau này**: chỉ cần cập nhật `CANONICAL_ID_RE` cho đúng hình dạng mới, rồi chạy lại hàm này — nó tự bắt lại MỌI mã (cũ thật hay tưởng-là-mới) không khớp, không cần viết migration riêng mỗi lần.
  - Đã chạy tay từ trình chỉnh sửa Apps Script, log trả về: `Dự án: 3, Công việc: 4, Đề xuất: 1, Chấm công: 1, Thông báo: 1, Bảng tin: 5, Tài liệu: 8, Bảng giá dịch vụ: 1` — verify qua API thấy `prj_A/B/C` → `project_260909_...`, `task_001..004` → `task_260909_...` với `projectId` cascade đúng sang project mới, `timesheet_1788780930898` → `timesheet_260909_...`. Không cần deploy lại Apps Script cho việc này (hàm chạy tay trong editor luôn dùng code đã Lưu, không liên quan bản deploy `doGet/doPost`).
- **Bug "nút Thêm thiết bị không hoạt động" — nguyên nhân thật**: KHÔNG phải do UI/nút — do session đăng nhập (`localStorage.hiconique_auth_session`, `auth.js`) của người dùng đang giữ **mã thành viên CŨ** (`"CEO"`, từ trước khi hệ thống đổi sang format `<PREFIX>_<Initials>_<DDMMYY>` như `"CEO_QH_030800"`), và session này sống tới 24h nên không tự hết hạn kịp. `getUserId()`/`registerMemberDevice(userId,...)` dùng ĐÚNG mã cũ đó để tìm thành viên trong Sheet hiện tại → không tìm thấy → âm thầm trả `{ok:false}` → hiện "Không xác định được thiết bị" và bấm nút gì cũng như không (không có lỗi hiện ra, chỉ đơn giản là không thành công).
  - **Sửa tận gốc, áp dụng chung mọi nơi dùng `Auth.getCurrentUser()`**: thêm `reconcileStaleSession()` trong `auth.js` — mỗi lần đọc session, nếu `session.id` không còn khớp bất kỳ thành viên nào trong `TaskManager.getMembers()` hiện tại, tự dò lại theo `session.email` và **ghi đè session bằng bản ghi đúng** (gọi `saveSession()`) — tự "chữa lành" session cũ mà không cần đăng xuất/đăng nhập lại. Verify: giả lập session mã `"CEO"` trong `localStorage`, gọi `Auth.getCurrentUser().id` trả đúng `"CEO_QH_030800"` NGAY LẦN GỌI ĐẦU, và bản lưu trong `localStorage` cũng được cập nhật theo. Sau khi sửa, trạng thái "Thiết bị đã đăng ký" trên `timesheet.html` chuyển từ đỏ "Không xác định được thiết bị" sang xanh "Thiết bị quen dùng" đúng như kỳ vọng.
  - Đã tự sửa lại 1 dòng dữ liệu thật bị ảnh hưởng bởi bug này trước khi fix (`timesheet_260909_..._281138` có `memberId: "CEO"`) — đổi lại đúng `"CEO_QH_030800"`.

## 0a. Trạng thái hiện tại (cập nhật lần cuối: 2026-09-09 — trang HICON-BIM đã thành công cụ thật + đổi format mã ID toàn hệ thống, đọc kỹ mục này)

**Việc mới nhất (2026-09-09): (1) dựng trang `HICON-BIM` — ban đầu chỉ là mockup UI theo ảnh chụp Mobim/SketchUp plugin người dùng gửi, sau đó chuyển thành CÔNG CỤ THẬT; (2) đổi format mã ID trên TOÀN BỘ sheet (trừ "Thành viên") sang dạng có thêm 6 số ngẫu nhiên ở cuối.**

- **`pages/hicon-bim-huongdan.html`** (mới) — giữ lại bản mockup UI ban đầu (SketchUp plugin panel + Mobim Workspace dashboard, dựng lại bằng HTML/CSS/JS thuần dựa theo ảnh chụp thật của người dùng, KHÔNG có ảnh gốc — chỉ để minh hoạ luồng dữ liệu/giao diện dự kiến khi có plugin `.rbz` thật). Đóng vai trò "Hướng dẫn sử dụng HICON-BIM", có link 2 chiều với trang thật.
- **`pages/hicon-bim.html`** (viết lại hoàn toàn) — công cụ THẬT, dữ liệu thật lưu Google Sheet, không còn là mockup:
  - **Sản phẩm / Vật liệu / Nhà cung cấp**: 3 danh mục CRUD dùng chung toàn tổ chức (form thêm/sửa/xoá + bảng danh sách), Sản phẩm có thể liên kết tới 1 Vật liệu (dropdown).
  - **Dự án**: lấy danh sách dự án THẬT từ `TaskManager.getProjects()` (tái dùng hệ thống Dự án đã có, không tạo khái niệm dự án riêng) — bấm vào 1 dự án mở workspace riêng với 2 tab:
    - **Issue**: kanban theo trạng thái (Mới/Đang xử lý/Chờ phản hồi/Đã giải quyết), CRUD đầy đủ, có mức độ ưu tiên + vị trí (text tự do, mô phỏng vị trí trên model — CHƯA lấy thật từ SketchUp vì chưa có plugin).
    - **BOQ**: bảng khối lượng CRUD theo dự án — chọn Sản phẩm từ dropdown thì ĐVT + đơn giá tự điền từ đơn giá tham khảo của Sản phẩm đó (sửa tay được), tự tính thành tiền + tổng trước/sau VAT 8%.
  - 5 sheet mới trong `gsheets-api-v2.js` (`SHEETS`/`FIELD_MAP` + CRUD action get/add/update/delete cho mỗi sheet, prefix `Bim`): `Sản phẩm BIM`, `Vật liệu BIM`, `Nhà cung cấp BIM` (dùng chung toàn tổ chức), `Issue BIM`, `BOQ BIM` (theo `projectId`).
  - Đã test thật trên browser: thêm 1 vật liệu → 1 sản phẩm liên kết vật liệu đó → mở 1 dự án thật ("Dự án A") → thêm 1 Issue → thêm 1 dòng BOQ (đơn giá tự điền đúng, tổng VAT tính đúng) — toàn bộ round-trip qua Apps Script thật, không phải giả lập.
  - **Cập nhật 2026-09-09 (sau)**: đã làm lại tab "Khối lượng & BOQ" giống đúng UI báo cáo Mobim (thẻ báo cáo, 4 ô thống kê, thanh thông tin dự án, cột Hạng mục/Nguồn suy ra từ Sản phẩm liên kết, nút Tải CSV) — vẫn 100% dữ liệu thật, không dữ liệu mẫu.
  - **Đã có plugin SketchUp `.rbz` (bản v0.1, viết Ruby, CHƯA test trong SketchUp thật)** — mã nguồn **KHÔNG nằm trong repo web này**, xem quy ước tách riêng ở mục **0b** ngay dưới. Đọc Group/Component thật, tag theo bảng chuẩn 5D+, IFC Class native best-effort, Level/Room-Space/Material/Filter/BOQ đủ 6 tab như ảnh Mobim. Đồng bộ Model/Object qua action `syncBimObjects` sống trong file Apps Script **riêng** `bim-model-sync.gs` (đã dán vào project Apps Script thật, KHÔNG gộp vào `gsheets-api-v2.js` — file đó chỉ có 1 dòng chuyển tiếp gọi `handleBimSyncAction` nếu tồn tại). BOQ vẫn đi qua đúng API `bimBoqItems` hiện có.
  - **Việc CHƯA làm**: plugin chưa được test trong SketchUp thật (máy build không có SketchUp) — cần cài `hicon-bim.rbz` và báo lỗi cụ thể nếu có để sửa tiếp. Trang web cũng chưa hiển thị tab "Models & Objects" bằng dữ liệu thật đồng bộ từ plugin (còn đang honest-empty-state) — làm sau khi plugin chạy được.

## 0b. Plugin HICON-BIM cho SketchUp — TÁCH HOÀN TOÀN khỏi repo web (quy ước 2026-09-09, không hỏi lại)

**Mã nguồn plugin sống ở `C:\Users\ADMIN\Desktop\HICONIQUE\HICON-BIM-PLUGIN\` — một thư mục hoàn toàn riêng, KHÔNG nằm trong, KHÔNG được git-track trong, và KHÔNG commit/push cùng repo `Hiconique-web-noibo` (repo của web nội bộ này) dưới bất kỳ hình thức nào.**

- Trước đó plugin từng bị đặt tạm ở `sketchup-plugin/` trong repo web — đã dọn sạch (`git rm -r --cached` + xoá khỏi working tree) trong commit dọn dẹp ngày 2026-09-09, sau khi người dùng yêu cầu tách hẳn.
- **Quy ước "push" từ giờ**: khi người dùng nói "push" (không nói gì thêm) → CHỈ push repo web nội bộ (`Hiconique-web-noibo`), không đụng gì tới plugin. Chỉ khi người dùng nói rõ "push plugin hiconbim" (hoặc tương đương) mới thao tác với plugin.
- Nếu cần sửa/thêm code cho plugin: làm việc trực tiếp trong `C:\Users\ADMIN\Desktop\HICONIQUE\HICON-BIM-PLUGIN\`, không tạo lại thư mục plugin trong repo web nữa.
- Đóng gói `.rbz` (khi cần gửi cho người dùng cài vào SketchUp): nén từ đúng thư mục đó, xem `HICON-BIM-PLUGIN/README.md`.

- **Đổi format mã ID toàn hệ thống (theo yêu cầu người dùng 2026-09-09)**: từ `prefix_YYMMDD_timestamp` → **`prefix_YYMMDD_timestamp_6sonngaunhien`** (thêm 6 số ngẫu nhiên ở cuối) — áp dụng cho **TẤT CẢ sheet TRỪ "Thành viên"** (mã NV có scheme riêng `<PREFIX>_<Initials>_<DDMMYY>` sinh ở client trong `auth.js`, không đi qua `makeId()` nên không bị ảnh hưởng và không cần loại trừ đặc biệt).
  - `makeId(prefix)` trong `gsheets-api-v2.js` đã sửa để luôn sinh ID theo format mới — áp dụng tự động cho MỌI dòng mới tạo sau này ở mọi sheet (trừ Thành viên, vì sheet đó không dùng `makeId()`).
  - **Đã migrate TOÀN BỘ ID cũ đang có sẵn trong sheet** sang format mới bằng 1 hàm chạy tay 1 lần `migrateAllIdsAddRandomSuffix()` (nằm cạnh `replaceIdInColumn`/`replaceIdInListColumn` có sẵn từ trước — hạ tầng này gốc được viết cho việc cascade khi đổi mã nhân viên qua `onEdit`, giờ tái dùng cho migration này). Hàm quét mọi sheet (trừ Thành viên), regex khớp ID CHƯA có đủ 6 số random ở cuối (`/^[a-zA-Z]+_\d{6}_\d+$/`) mới đổi — nên **idempotent**, chạy lại nhiều lần không đổi 2 lần. Sau khi đổi ID gốc, **cascade sang mọi cột khoá ngoại (FK) ở sheet khác đang tham chiếu tới ID đó** (`projectId` ở 12 sheet khác nhau tham chiếu `projects.id`, `linkedFinanceEntryId` ở `orders` tham chiếu `financeEntries.id`, `materialId` ở `bimProducts` tham chiếu `bimMaterials.id`, `productId` ở `bimBoqItems` tham chiếu `bimProducts.id`) — khai báo trong mảng `FK_PLAN` ngay trong hàm, thêm sheet/FK mới sau này thì thêm vào mảng này.
  - Đã chạy thật 1 lần từ trình chỉnh sửa Apps Script (chọn hàm ở dropdown → Chạy) lúc 17:13 — log trả về: `Dự án: 1, Công việc: 2, Đề xuất: 1, Chấm công: 4, Thông báo: 1, Bảng tin: 5, Tài liệu: 17, Hoa hồng dự án: 1, Tiến độ: 14, Nghiệm thu: 1, Sản phẩm BIM: 1, Vật liệu BIM: 1, Issue BIM: 1, BOQ BIM: 1` — verify lại qua API thấy `materialId`/`productId` cascade đúng, không đứt liên kết.
  - Đã redeploy Apps Script (Phiên bản 32) và verify 1 dòng mới tạo (`addBimSupplier`) ra đúng ID có 6 số random ở cuối, rồi xoá dòng test.
  - **Quy tắc lâu dài**: sheet/action mới thêm sau này tự động theo format mới vì dùng chung `makeId()` — không cần làm gì thêm, TRỪ khi thêm 1 quan hệ FK mới thì nhớ thêm vào `FK_PLAN` trong `migrateAllIdsAddRandomSuffix()` (dù chỉ cần nếu có migration tiếp theo, không bắt buộc cho vận hành bình thường).

## 0b. Trạng thái hiện tại (cập nhật lần cuối: 2026-09-09 — pricing.html giờ có 14 tab, 6 tab là công cụ thật theo dự án, đọc kỹ mục này)

**Việc mới nhất (2026-09-09, ngay sau khi xong "Đơn giá theo tỉnh"): chuyển `pricing.html` thành dạng TAB (trước đó 1 trang dài cuộn); thêm tab mới "Khối lượng sơ bộ" (dự toán khối lượng chi tiết, đơn giá tham khảo dò từ tỉnh đang chọn); và biến 6 sheet còn lại trong database 34 tỉnh (So sánh nhà thầu, Dòng tiền, Phát sinh, Tiến độ, Nghiệm thu, Hồ sơ công trình) thành 6 CÔNG CỤ TƯƠNG TÁC THẬT — lưu dữ liệu người dùng nhập theo TỪNG DỰ ÁN (không phải chỉ tham khảo tĩnh).**
- **Tab bar**: thêm `.pr-tabs` + `.pr-tab-panel` ở đầu `pricing.html`, JS `activateTab()` ẩn/hiện panel qua CSS (không unmount khỏi DOM — các khối tính toán cũ như Dự toán xây dựng/thiết kế vẫn phải chạy nền dù panel ẩn vì phụ thuộc lẫn nhau qua biến JS `lastEstimateResult`...). Có lưu tab đang mở vào `localStorage` (`pr-active-tab`) để load lại đúng tab cũ.
- **Tab "Khối lượng sơ bộ"**: định mức (ĐM thấp/cao) chép cứng từ sheet gốc thành mảng `PRELIM_QTY_ITEMS` trong JS (19 hạng mục: bê tông, thép, cốp pha, gạch, trát, xi măng, cát, chống thấm, gạch lát, sơn, trần, cửa, điện, nước, thiết bị VS) — nhân với Tổng diện tích tầng (lấy từ tab Dự toán xây dựng) ra khối lượng. **Đơn giá tham khảo tự dò** trong bảng "Vật tư/thiết bị" của tỉnh đang chọn (tab "Đơn giá theo tỉnh") bằng from khoá (`keywords` mỗi hạng mục) **VÀ phải khớp cả ĐVT** — bài học đau: lúc đầu chỉ dò theo từ khoá không lọc ĐVT, "thép" khớp nhầm sang 1 mục giá hoàn toàn khác đơn vị, ra đơn giá sai gấp ~45 lần (856.444đ/kg thay vì đúng tầm 15-20k/kg) — thêm điều kiện `unitCompatible()` bắt buộc ĐVT trùng mới tính vào trung bình, dò không ra thì để 0 và cho sửa tay (input `data-prelim-price`), KHÔNG hiện số sai trông như đã tính đúng.
- **6 công cụ theo dự án** (`contractors`/`cashflow`/`changeorders`/`schedule`/`acceptance`/`docs` — tên tab tiếng Việt: So sánh nhà thầu/Dòng tiền/Phát sinh/Tiến độ/Nghiệm thu/Hồ sơ công trình): có 1 dropdown "Áp dụng cho dự án" CHUNG (`#prToolProjectSelect`, lấy từ `TaskManager.getProjects()` — tái dùng "Dự án" đã có, KHÔNG tạo khái niệm dự án mới) hiện phía trên tab bar, chỉ show khi 1 trong 6 tab này đang mở. Đổi dự án tự load lại đúng tab đang mở.
  - **6 sheet MỚI trong HICONIQUE Task Manager** (thêm vào `SHEETS`/`FIELD_MAP` của `gsheets-api-v2.js`, tên sheet KHÔNG có tiền tố "Bản sao của " nên không đụng 46 sheet tham khảo cũ): `So sánh nhà thầu`, `Dòng tiền`, `Phát sinh`, `Tiến độ`, `Nghiệm thu`, `Hồ sơ công trình`. Mỗi sheet có CRUD action riêng (get/add/update/delete + tiền tố tên hàm, VD `getChangeOrders`/`addChangeOrder`...).
  - **2 kiểu lưu trữ khác nhau tuỳ bản chất dữ liệu** (tự quyết, không hỏi lại theo đúng ý người dùng "tự cân đối xem hợp lý"):
    1. **1 dòng JSON/dự án** cho `contractorComparisons` (So sánh nhà thầu) và `cashFlowPlans` (Dòng tiền) — vì template 16 nhóm việc + 8 tiêu chí (so sánh nhà thầu) hay 10 mốc thanh toán (dòng tiền) CỐ ĐỊNH, không đổi theo dự án, chỉ có các Ô GIÁ TRỊ mới cần lưu — lưu 1 dòng/dự án với cột kiểu `priceData`/`scoreData`/`milestoneData` là JSON object (key = index trong template).
    2. **Nhiều dòng CRUD thật** cho `changeOrders` (Phát sinh — mỗi phát sinh là 1 sự việc độc lập, thêm dần theo thời gian) và `scheduleItems` (Tiến độ — có thể thêm/xoá đầu việc tuỳ dự án). `acceptanceChecks` (Nghiệm thu, 50 mục cố định NT-01..NT-50) và `projectDocuments` (Hồ sơ công trình, 35 mục cố định DOC-1..DOC-35): template (tên, tiêu chí) chép cứng trong JS như "Khối lượng sơ bộ", sheet chỉ lưu phần user nhập, khoá theo `(projectId, checkCode/docCode)` — mỗi mục upsert riêng (tạo dòng mới lần đầu, update lần sau) qua sự kiện `change`/`blur` trên từng ô, TỰ LƯU không cần nút Lưu.
  - **Lỗi đã gặp & sửa**: seed 18 đầu việc mẫu cho "Tiến độ" lúc dự án lần đầu mở tab — code gốc gọi `Promise.all` 18 lần `addScheduleItem` SONG SONG, mỗi lần là 1 lượt thực thi Apps Script riêng, tất cả cùng đọc "dòng cuối của sheet" đồng thời rồi ghi đè nhau → **chỉ còn sống lại 6-7/18 dòng** (đã tự kiểm chứng, xoá dọn dữ liệu rác, viết lại). **Sửa bằng cách thêm 1 action mới `seedScheduleItems`** (nhận cả mảng, ghi 1 lần duy nhất bằng `sheet.getRange(...).setValues(...)` trong ĐÚNG 1 lượt thực thi Apps Script — không có đua ghi) thay cho gọi `addScheduleItem` lặp — hàm dùng chung `addDataBatch()` mới thêm trong `gsheets-api-v2.js`. **Bài học chung: KHÔNG BAO GIỜ gọi nhiều action ghi (`add.../update.../delete...`) song song vào CÙNG 1 sheet từ client** — mỗi lệnh gọi API là 1 lượt thực thi Apps Script độc lập, có thể đua nhau đọc/ghi. Cần ghi nhiều dòng cùng lúc thì phải thêm action batch riêng ở backend.
  - Đã redeploy Apps Script nhiều lần trong lúc làm — **phát hiện: dropdown "Phiên bản" trong hộp thoại "Quản lý các tuỳ chọn triển khai" đôi khi tự đổi lại về 1 phiên bản CŨ đã lưu trước đó nếu chỉ click 1 lần vào chữ "Phiên bản mới"** (không rõ do lag UI hay do đang có phiên bản y hệt nội dung); **luôn zoom/chụp lại ô "Phiên bản" ngay TRƯỚC khi bấm "Triển khai" để xác nhận chữ đúng là "Phiên bản mới"** rồi mới bấm — nếu không, code mới không lên URL thật (verify lại bằng cách gọi thử 1 action mới qua URL, thấy "Unknown action" nghĩa là chưa deploy đúng).
- **Tab "Hướng dẫn"/"Nguồn"**: đọc thẳng qua `getProvincePricing` (action đã có từ mục fix-link, coi 2 sheet này như 1 "tỉnh" bất kỳ) — không cần action mới. Sheet "Nguồn" có cột URL/Liên kết ghép lại thành 1 link bấm được (`renderGenericSheetTable` có tham số `linkColIndex`); sheet "Hướng dẫn" hiển thị nguyên cấu trúc nhiều bảng con xếp chồng giống các sheet 34-tỉnh khác — riêng đoạn "LƯU Ý QUAN TRỌNG" (nhãn + mô tả trên 2 cột) bị nhận nhầm thành "tiêu đề mục" do đúng ≤2 ô có chữ, hiện tạm dạng list gạch đầu dòng thay vì bảng 2 cột — biết là chưa đẹp, chưa sửa (ưu tiên thấp, không sai nội dung).
- **Việc CHƯA làm**: Tất cả 6 công cụ theo dự án hiện KHÔNG liên kết dữ liệu chéo với Đơn hàng/Dự toán ở các tab khác (VD "Dòng tiền" không tự lấy Giá trị hợp đồng từ "Soạn báo giá"; "Phát sinh" không tự cộng vào tổng chi phí dự án) — mỗi tab đang là công cụ độc lập, ghép nối sâu hơn để làm sau nếu người dùng yêu cầu.

## 0c. Trạng thái phiên trước (2026-09-09 — đã fix xong link nội bộ trong 46 sheet database 34 tỉnh, đọc kỹ mục này)

**Việc mới nhất (2026-09-09, ngay sau khi copy 46 sheet): "sắp xếp lại dữ liệu" + fix toàn bộ link bị đứt trong 46 sheet vừa copy — chỉ tương tác với sheet có tên "Bản sao của ..." (đúng yêu cầu người dùng), KHÔNG đổi dữ liệu gì khác.**
- **Phát hiện quan trọng: mục "0a." bên dưới (ghi từ phiên trước) SAI một phần** — claim "đã tô màu bronze `#B08D57` + đổi lại tên gốc" thực ra KHÔNG có hiệu lực. Kiểm tra trực tiếp trên Sheet hôm nay (2026-09-09) thấy 46 sheet vẫn giữ tên `Bản sao của <tên gốc>` và màu tab vẫn là **đỏ** (màu mặc định của `copyTo()`, không phải bronze). Có thể hàm `setName`/`setTabColor` trong `TempMigrate.gs` đã chạy nhưng không lưu, hoặc log dòng thực thi bị hiểu nhầm. **Chưa đổi tên/màu lại** trong phiên này vì người dùng chỉ yêu cầu "sắp xếp lại + fix link" — việc đổi tên/màu để dễ kiểm soát vẫn còn tồn, làm sau nếu người dùng yêu cầu lại.
- **Nguyên nhân link bị đứt**: các sheet gốc dùng `=HYPERLINK("#gid=<số>";"nhãn")` để điều hướng nội bộ (VD: sheet "Mục lục" có 9 link ở hàng 6 tới Tính nhanh/Khối lượng/So sánh thầu/Dòng tiền/Phát sinh/Tiến độ/Nghiệm thu/Hồ sơ/Hướng dẫn, và 34 link "Mở bảng giá" ở cột "Liên kết" — mỗi tỉnh 1 link). Vì `#gid=` chỉ là tham chiếu tương đối trong CÙNG spreadsheet, khi `copyTo()` sang file khác thì Google Sheets gán gid MỚI cho từng sheet, còn số gid trong các công thức HYPERLINK vẫn giữ số CŨ → toàn bộ link nội bộ trỏ sai/trỏ vào chỗ trống.
- **Cách fix**: viết 1 hàm Apps Script tạm (`fixBrokenLinks34Tinh`, sau đó `fixHubLinksPerCell`), đặt tạm trong file `TempFixLinks.gs` **ngay trong project Apps Script SẢN XUẤT thật** (`HICONIQUE NỘI BỘ API`, script ID `13qWJLAwWHzeH7nyfcVHlMrxwOOWAUi4X2gD7CgB2EfwQseFX30RJo_RJ` — đây mới là project bind với `gsheets-api-v2.js` đang chạy web app thật, KHÔNG phải project rỗng mà Tiện ích > Apps Script tự mở lần đầu) — KHÔNG đụng vào `Mã.gs` (file code sản xuất). Đã xoá `TempFixLinks.gs` ngay sau khi chạy xong.
  - Bước 1: dựng bảng ánh xạ gid cũ → gid mới bằng cách so khớp TÊN sheet gốc (từ file Database 34 tỉnh, ID `1INkLZfjbfS7G9otbV4uGgQKhog0ADh8L2fnS3GTT2dM`) với tên sheet đã copy (bỏ tiền tố "Bản sao của ") trong HICONIQUE Task Manager.
  - Bước 2: quét mọi ô có công thức chứa `#gid=` trong 46 sheet "Bản sao của ...", thay số gid cũ bằng gid mới tương ứng.
  - **Vướng mắc gặp phải & đã xử lý**: (1) copy code Tiếng Việt qua clipboard PowerShell (`Set-Clipboard`) làm hỏng dấu (Bản sao của → Bá°£n sao cá·§a) khiến bước so khớp tên thất bại hoàn toàn (0 sheet khớp) — khắc phục bằng cách viết literal Tiếng Việt dưới dạng `String.fromCharCode(...)` (thuần ASCII) trong code Apps Script thay vì gõ dấu trực tiếp. (2) nhiều sheet (đặc biệt sheet "Mục lục" và ~20 sheet tỉnh) dùng tính năng "Bảng" (Table) mới của Google Sheets khiến `range.getFormulas()/setFormulas()` theo khối lớn báo lỗi "Ở hàng tiêu đề của bảng phải có giá trị" hoặc âm thầm KHÔNG ghi được dù không báo lỗi — khắc phục bằng cách chuyển sang sửa từng ô một qua `sheet.createTextFinder('#gid=').matchFormulaText(true).findAll()` + `cell.setFormula()` (chậm hơn nhưng ghi chắc chắn thành công, đã verify lại bằng cách đọc công thức ở lần chạy Apps Script riêng biệt sau đó).
  - Kết quả cuối: toàn bộ 34 link "Mở bảng giá" (mỗi tỉnh) trong sheet "Mục lục" đã đúng gid mới — verify bằng cách so `expectedNewGid` (từ tên sheet) với gid thực tế trong công thức, khớp 100%. 9 link điều hướng ở hàng 6 (Tính nhanh...Hướng dẫn) và một số ít link trong các sheet tỉnh vẫn còn "unresolved" — kiểm tra thấy gid trong công thức KHÔNG khớp bất kỳ sheet nào trong 46 sheet đã copy, nhiều khả năng là link đã hỏng sẵn từ trong file Database gốc (không phải lỗi do di chuyển), nên để nguyên, không đoán mò sửa.
- **Việc CHƯA làm (như phiên trước đã ghi, vẫn còn nguyên)**: chưa thêm sheet 34 tỉnh vào `SHEETS`/`FIELD_MAP` của `gsheets-api-v2.js`, chưa có action đọc riêng qua API, `pricing.html` vẫn dùng đơn giá mặc định cố định.
- **Yêu cầu tiếp theo từ người dùng (2026-09-09, ngay sau khi fix link xong) — ĐÃ LÀM XONG**: thêm vào `pricing.html` mục **chọn tỉnh/thành** (dropdown) + **hiển thị bảng đơn giá các đầu mục theo tỉnh đã chọn**, dữ liệu lấy trực tiếp từ Google Sheet qua `gsheets-api-v2.js`.
- Card mới "Tra cứu đơn giá theo tỉnh/thành" đặt ngay dưới "Danh mục đơn giá", trên "Dự toán chi phí xây dựng" — dropdown 34 tỉnh (lấy từ `getProvinceList`) + `div` tự dựng bảng khi chọn tỉnh (không qua TaskManager/localStorage, gọi thẳng `GSHEETS_CONFIG.API_URL` bằng `fetch`, y hệt cách `callGSheetsAPI` làm, có cache theo tỉnh trong biến JS để đổi qua đổi lại không gọi lại API).
- **KHÔNG đi qua `FIELD_MAP`** như các SHEETS khác — sheet mỗi tỉnh có nhiều bảng xếp chồng trong CÙNG 1 sheet (nhân công theo loại nhà → phần thô/trọn gói hoàn thiện → vật tư/thiết bị theo tỉnh, mỗi bảng có 1 dòng tiêu đề mục rồi tới dòng header cột), không phải 1 bảng đơn (id, header) như projects/tasks/... Thêm 2 hàm mới trong `gsheets-api-v2.js`: `getProvinceList(ss)` (đọc đúng cột "Tỉnh/thành" từ hàng 10 của sheet "Mục lục" — KHÔNG hardcode tên 34 tỉnh, tự đúng nếu sau này sáp nhập/đổi tên tỉnh và copy lại data mới) và `getProvincePricing(ss, provinceName)` (trả thẳng `getDisplayValues()` của cả sheet tỉnh tương ứng — giữ nguyên định dạng số như trên Sheet). Client (`pricing.html`) tự nhận diện dòng tiêu đề mục (dòng có ≤2 ô có chữ) để tô đậm thành thanh mục, dòng ngay sau thành header cột — không cần gửi kèm thông tin định dạng/màu ô từ Apps Script.
- **Đã redeploy Apps Script** (`HICONIQUE NỘI BỘ API`, project ID `13qWJLAwWHzeH7nyfcVHlMrxwOOWAUi4X2gD7CgB2EfwQseFX30RJo_RJ`) — dùng "Quản lý các tùy chọn triển khai" > sửa deployment ACTIVE hiện có > chọn "Phiên bản mới" (giữ nguyên URL trong `gsheets-config.js`, KHÔNG tạo deployment mới/URL mới). Đã verify trực tiếp bằng cách gọi URL `?action=getProvinceList` và `?action=getProvincePricing&province=Tuyên Quang` — trả đúng 34 tỉnh và đúng dữ liệu sheet Tuyên Quang.
- Copy file `.js` chứa tiếng Việt qua clipboard PowerShell lần này KHÔNG hỏng dấu (khác vụ hỏng dấu ở mục fix-link phía trên) vì dùng đúng `Get-Content -Raw -Encoding UTF8 ... | Set-Clipboard` rồi verify bằng `(Get-Content -Raw -Encoding UTF8 file).Length` phải khớp EXACT với `monaco.editor.getModels()[0].getValue().length` sau khi dán — cách verify an toàn để lần sau không cần né tiếng Việt bằng `String.fromCharCode` khi paste nguyên cả file có sẵn tiếng Việt (chỉ né khi gõ MỚI 1 đoạn ngắn ngay trong lúc soạn, không tiện verify độ dài).
- Đã test trên preview (`localhost:3000/pages/pricing.html`): chọn "Tuyên Quang" hiển thị đúng 3 bảng con (PB_Labor/nhân công, Phần thô + trọn gói hoàn thiện, Vật tư/thiết bị trực tiếp tại Tuyên Quang) với số liệu khớp Google Sheet, không lỗi console.
- **Việc CHƯA làm / để ngỏ**: bảng hiển thị mới chỉ là TRA CỨU (đọc), CHƯA nối vào 2 khối "Dự toán chi phí xây dựng/thiết kế theo m²" phía dưới để tự động điền đơn giá theo tỉnh đã chọn — nếu người dùng muốn bước này thì cần thêm logic map tên hạng mục ở "Dự toán" sang đúng dòng/mã tương ứng trong bảng tỉnh (không đơn giản vì tên hạng mục 2 bên đặt khác nhau).

## 0d. Trạng thái phiên trước (2026-09-09 — đã copy 46 sheet database 34 tỉnh vào HICONIQUE Task Manager, đọc kỹ mục này)

**Việc mới nhất (2026-09-09, ngay sau checkbox thiết kế): copy toàn bộ 46 sheet từ "Database đơn giá chi phí xây dựng nhà 34 tỉnh T9/2026" (Google Sheet ngoài) sang thẳng Google Sheet chính của HICONIQUE ("HICONIQUE Task Manager", ID `1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY`) — CHỈ chuyển + tô màu, CHƯA nối vào web/API, việc dùng dữ liệu này để làm gì tính sau.**
- Cách làm: **không copy tay 46 lần** — viết 1 hàm Apps Script tạm (`migratePricingDatabase34Tinh`,
  đặt trong 1 file riêng "TempMigrate.gs" ngay trong project Apps Script của HICONIQUE, KHÔNG
  đụng vào `gsheets-api-v2.js` đang chạy thật) dùng `SpreadsheetApp.openById()` mở cả 2 file rồi
  `sheet.copyTo(dest)` từng sheet — copy nguyên vẹn cả dữ liệu lẫn định dạng chỉ trong ~70 giây,
  không cần deploy lại gì. **Chạy xong xoá luôn file "TempMigrate.gs"** để không để lại code tạm
  trong Apps Script production.
- Đã giữ nguyên tên 46 sheet gốc (Mục lục, Tính nhanh, Khối lượng sơ bộ, So sánh nhà thầu, Dòng
  tiền, Phát sinh, Tiến độ, Nghiệm thu, Hồ sơ công trình, Hướng dẫn, Nguồn, 34 sheet tỉnh, Dữ liệu
  tính) — hàm có check trùng tên với sheet đã có sẵn trong HICONIQUE Task Manager (tự thêm hậu tố
  `(2)` nếu trùng) nhưng thực tế không trùng cái nào.
- **Đã tô toàn bộ 46 sheet mới này 1 màu đồng bộ — bronze `#B08D57`** (đúng màu thương hiệu
  HICONIQUE) để phân biệt trực quan với 16 sheet chức năng gốc của app (Dự án, Công việc, Thành
  viên,... Đơn hàng) — thấy rõ ngay trên thanh tab dưới cùng của Google Sheet.
  Thứ tự sheet mới: nối tiếp ngay sau sheet cuối cùng đã có (`Chỉ số cân đối kế toán`), giữ đúng
  thứ tự gốc của bên database 34 tỉnh (Mục lục → Tính nhanh → ... → 34 tỉnh theo đúng thứ tự vùng
  miền → Dữ liệu tính).
- Đã xác nhận trực tiếp trên Google Sheet: mở dropdown "Tất cả trang tính" thấy đủ cả chấm màu
  bronze cạnh tên 46 sheet mới, kéo tới cuối vẫn đúng thứ tự tỉnh.
- **Việc CHƯA làm (để làm tiếp theo yêu cầu người dùng)**: chưa thêm sheet nào vào `SHEETS`/
  `FIELD_MAP` của `gsheets-api-v2.js`, chưa có action đọc riêng cho các sheet 34 tỉnh này qua
  API, và `pricing.html` (2 khối Dự toán xây dựng/thiết kế) vẫn đang dùng đơn giá mặc định cố
  định — CHƯA tự động lấy đơn giá theo tỉnh từ 46 sheet vừa copy. Đây là bước tiếp theo hợp lý
  khi người dùng yêu cầu "làm tiếp".

## 0e. Trạng thái phiên trước (2026-09-09 — checkbox bật/tắt từng hạng mục thiết kế, vẫn còn đúng)

**Việc mới nhất (2026-09-09, ngay sau auto-sync báo giá): mỗi hạng mục ở bảng "Dự toán chi phí thiết kế" có checkbox riêng để tích/bỏ tích — bỏ hẳn checkbox combo cũ, thay bằng auto-detect.**
- Thêm 1 checkbox đầu mỗi dòng (`desInclArch/Struct/Mep/Interior/Exterior`, mặc định **đều
  tích**): tích = tính vào tổng tiền + đẩy vào báo giá; bỏ tích = loại khỏi tổng và tự xoá khỏi
  báo giá (cột Thành tiền hiện "—" để biết đang bị loại, không phải bằng 0 do lỗi).
- **Bỏ hẳn checkbox combo riêng `desComboArchInterior` cũ** — thay bằng auto-detect: hàm
  `applyArchInteriorCombo()` tự kiểm tra 2 checkbox `desInclArch` + `desInclInterior` có tích
  cùng lúc không → tích cả 2 thì tự set 2 ô đơn giá về 200.000đ/m² (giá combo); chỉ 1 trong 2
  (hoặc cả 2 đều bỏ) thì trả về 250.000đ/m² (giá riêng lẻ). Gọi 1 lần lúc khởi tạo trang nên
  **mặc định đã ở trạng thái combo** (đúng yêu cầu "mặc định tích kiến trúc + nội thất thì tự
  động áp dụng giảm giá luôn").
  Có biến `lastComboState` chặn ghi đè lặp lại nếu trạng thái combo không đổi giữa các lần
  `recalcDesign()` — tránh việc user tự tay sửa `desArchPrice/desInteriorPrice` bị ghi đè liên tục
  vô cớ khi gõ ô khác không liên quan.
- Đã test trên Chrome preview: tải trang mặc định đã 200.000đ/m² (combo tự bật); bỏ tích Nội thất
  → Kiến trúc tự về 250.000đ/m², dòng Nội thất biến khỏi báo giá + tổng tiền giảm đúng số; tích
  lại → cả 2 tự về 200.000đ/m²; bỏ tích Kết cấu → dòng biến khỏi báo giá + tổng giảm đúng. Không
  lỗi console.

## 0f. Trạng thái phiên trước (2026-09-09 — dự toán tự nhảy thẳng vào báo giá, vẫn còn đúng)

**Việc mới nhất (2026-09-09, ngay sau giá combo Kiến trúc+Nội thất): bỏ nút "Đưa vào báo giá" — 2 khối dự toán (xây dựng + thiết kế) tự đẩy số vào bảng Soạn báo giá ngay khi gõ, không cần bấm gì nữa.**
- Nâng cấp `addQuoteRow(prefill, explicitId)` trong `pricing.html`: truyền thêm `explicitId` thì
  hàm tìm dòng `tr[data-quote-row="explicitId"]` đã có sẵn để **cập nhật tại chỗ**, không tạo
  dòng mới — nếu chưa có mới tạo. Thêm `removeQuoteRowById(id)` để tự xoá dòng khi hạng mục về 0
  (area hoặc đơn giá = 0, VD đổi hệ số mái về 0).
  Vẫn dùng nguyên `data-quote-row` nên toàn bộ cơ chế đã có (đổi số lượng/đơn giá tự tính lại
  `pr-amount`, nút Xoá, chọn từ Bảng giá dịch vụ) hoạt động y hệt trên các dòng tự động này —
  không cần viết thêm code binding riêng.
- 2 hàm mới `syncEstimateToQuote(r)` (khối xây dựng) và `syncDesignToQuote(r)` (khối thiết kế) —
  gọi ở cuối `recalcEstimate()`/`recalcDesign()` nên MỌI lần gõ số ở 2 khối dự toán đều tự đẩy
  thẳng xuống bảng báo giá. Mỗi hạng mục có 1 id cố định: `auto-est-foundation/rough/finish/
  mep/roof/pile`, `auto-des-arch/struct/mep/interior/exterior`.
  Đã bỏ hẳn 2 nút "Đưa vào báo giá ↓" (`prFillQuoteBtn`, `prFillQuoteDesignBtn`) — không còn
  workflow bấm nút, chỉ còn 1 luồng: gõ số ở dự toán → báo giá tự nhảy → xuất Excel/PDF.
- Đã test trên Chrome preview: mở trang đã thấy 10 dòng tự động sẵn trong báo giá (không cần
  thao tác gì); đổi 1 input (chiều dài) → đúng 1 dòng tương ứng cập nhật số tiền, KHÔNG tạo dòng
  trùng (vẫn đúng 11 dòng = 10 tự động + 1 dòng trống mặc định); đổi hệ số mái về 0 → dòng "Phần
  mái" tự biến mất khỏi báo giá. Không lỗi console.

## 0g. Trạng thái phiên trước (2026-09-09 — thêm giá combo Kiến trúc+Nội thất, vẫn còn đúng)

**Việc mới nhất (2026-09-09, ngay sau dropdown loại kết cấu): thêm checkbox giá combo cho Kiến trúc + Nội thất trong bảng Dự toán chi phí thiết kế ở `pricing.html`.**
- Yêu cầu gốc bị lỗi giọng nói/gõ nhầm khá nhiều ("200rưỡi" = 250.000đ; "Hà Nội" = nhầm từ "nội
  thất") — đã hỏi lại ngữ cảnh và hiểu đúng ý: đơn giá thiết kế Kiến trúc và Nội thất mặc định
  đều là **250.000đ/m²** khi khách chỉ đặt riêng lẻ 1 trong 2 dịch vụ; nhưng nếu khách đặt **cả
  2 cùng lúc** (trọn gói Kiến trúc + Nội thất) thì mỗi loại được giảm còn **200.000đ/m²**.
- Đổi giá trị mặc định: `desArchPrice` từ 150.000 → 250.000, `desInteriorPrice` từ 300.000 →
  250.000.
- Thêm checkbox `desComboArchInterior` ngay trên bảng thiết kế: tick vào thì tự set cả 2 ô đơn
  giá (`desArchPrice`, `desInteriorPrice`) về 200.000 và tính lại; bỏ tick thì trả về 250.000.
  Chỉ đụng đúng 2 ô giá này, không ảnh hưởng kết cấu/điện nước/ngoại thất.
- Đã test trên Chrome preview: tick/bỏ tick đổi đúng cả 2 đơn giá + thành tiền tương ứng, không
  lỗi console.

## 0h. Trạng thái phiên trước (2026-09-09 — thêm chọn loại kết cấu cho phí thiết kế, vẫn còn đúng)

**Việc mới nhất (2026-09-09, ngay sau bảng Dự toán chi phí thiết kế): thêm dropdown "loại kết cấu" cho dòng Thiết kế kết cấu trong `pricing.html`.**
- Lúc đầu hiểu nhầm yêu cầu "bổ sung thêm đơn giá kết cấu" là thêm 1 dòng chi phí THI CÔNG kết
  cấu vào bảng "Dự toán chi phí xây dựng" — đã sửa rồi revert lại ngay khi người dùng nói rõ
  "Đơn giá thiết kế kết cấu nhé" (ý là bảng **thiết kế**, không phải bảng xây dựng).
- Thêm dropdown `desStructType` (`STRUCTURE_DESIGN_TYPES`) ngay dưới nhãn "Thiết kế kết cấu"
  trong bảng "Dự toán chi phí thiết kế", cùng UX auto-fill đơn giá như dropdown Kiểu móng/Kiểu
  mái ở bảng xây dựng — chọn loại thì đơn giá/m² tự nhảy, vẫn sửa tay được sau đó:
  - Kết cấu nhà phố tiêu chuẩn (khung BTCT thông thường): 70.000đ/m² (mặc định ban đầu, giữ
    nguyên số cũ)
  - Có tầng hầm / móng cọc phức tạp: 90.000đ/m²
  - Nhịp lớn / biệt thự kết cấu phức tạp: 120.000đ/m²
  - Kết cấu thép tiền chế (nhà xưởng, khung thép): 55.000đ/m²
  Diện tích tính phí vẫn dùng chung "Tổng diện tích tầng" như trước, không đổi.
- Đã test trên Chrome preview: đổi loại kết cấu tự nhảy đúng đơn giá + thành tiền, không lỗi
  console. Vẫn client-side only.

## 0i. Trạng thái phiên trước (2026-09-09 — thêm bảng Dự toán chi phí thiết kế, vẫn còn đúng)

**Việc mới nhất (2026-09-09, ngay sau khối Dự toán chi phí xây dựng): thêm bảng riêng "Dự toán chi phí thiết kế theo m²" vào `pricing.html`, nằm ngay dưới khối dự toán xây dựng.**
- Yêu cầu người dùng: tách riêng 1 bảng tính chi phí cho các đầu mục **thiết kế** (kết cấu, nội
  thất, ngoại thất, điện nước...) — cũng tính theo diện tích tương tự khối xây dựng, không gộp
  chung 1 bảng.
- **5 hạng mục thiết kế**, mỗi hạng mục có diện tích tính phí + đơn giá/m² riêng (đơn giá đều
  sửa tay được):
  - Thiết kế kiến trúc, Thiết kế kết cấu, Thiết kế điện nước (M&E) — cả 3 dùng chung **"Tổng
    diện tích tầng"** đã tính sẵn ở khối "Dự toán chi phí xây dựng" bên trên (ô chỉ hiển thị,
    không sửa tay ở đây — vì thiết kế 3 hạng mục này luôn phải làm cho toàn bộ công trình).
  - Thiết kế nội thất, Thiết kế ngoại thất/cảnh quan sân vườn — có ô diện tích RIÊNG, sửa tay
    được, vì thực tế không phải lúc nào cũng thiết kế nội/ngoại thất cho toàn bộ diện tích (VD
    bỏ qua tầng hầm/kho). Mặc định tự đồng bộ 1 lần khi trang tải: nội thất = Tổng diện tích
    tầng, ngoại thất = diện tích đất (dài×rộng, tức "diện tích 1 sàn" ở khối xây dựng).
  - Đơn giá mặc định (chỉ là gợi ý ban đầu theo mặt bằng chung, sửa được): kiến trúc 150k/m²,
    kết cấu 70k/m², điện nước 50k/m², nội thất 300k/m², ngoại thất/cảnh quan 120k/m².
- Nút **"↺ Đồng bộ diện tích"**: đồng bộ lại 2 ô diện tích nội/ngoại thất theo đúng số liệu mới
  nhất của khối xây dựng bên trên (dùng khi đã đổi dài/rộng/số tầng ở khối xây dựng mà không
  muốn bảng thiết kế bị lệch theo tay đã sửa trước đó) — **cố ý không tự động ghi đè liên tục**
  mỗi lần khối xây dựng đổi số, để không xoá mất giá trị người dùng đã tự chỉnh tay cho nội/ngoại
  thất.
  - Cách nhận biết "chưa từng chỉnh tay": theo dõi qua biến `designAreaManuallyEdited` + điều
    kiện cả 2 ô đang bằng 0 — chỉ tự đồng bộ lần đầu tiên khi trang vừa tải (2 ô còn nguyên giá
    trị mặc định 0), các lần đổi số liệu xây dựng sau đó không tự ghi đè nữa trừ khi bấm nút.
  - `recalcEstimate()` (khối xây dựng) gọi `recalcDesign()` ở cuối mỗi lần tính lại — 2 khối liên
    kết 1 chiều: xây dựng đổi số → thiết kế tính lại theo diện tích mới nhất (trừ nội/ngoại thất
    nếu đã tự tay sửa).
- TỔNG CHI PHÍ THIẾT KẾ + ĐƠN GIÁ THIẾT KẾ BÌNH QUÂN/m² (= tổng / Tổng diện tích tầng), và nút
  **"Đưa vào báo giá ↓"** giống hệt khối xây dựng — đẩy 5 dòng vào bảng Soạn báo giá bên dưới.
- Đã test trên Chrome preview: cả 5 dòng tự tính đúng số, bấm "Đưa vào báo giá" đẩy đúng 5 dòng
  với đúng số tiền vào bảng báo giá, không lỗi console. Vẫn client-side only, không cần sửa
  `gsheets-api-v2.js`/`task-data.js`.

## 0j. Trạng thái phiên trước (2026-09-09 — thêm Dự toán chi phí XD vào pricing.html, vẫn còn đúng)

**Việc mới nhất (2026-09-09, sau khi làm trang Đơn hàng & Hóa đơn): thêm khối "Dự toán chi phí xây dựng theo m²" vào `pricing.html`, nằm giữa "Danh mục đơn giá" và "Soạn báo giá".**
- Bối cảnh: người dùng gửi ảnh chụp 1 livestream TikTok bán hàng xây dựng (không liên quan
  HICONIQUE) minh hoạ cách họ tính sơ bộ chi phí xây nhà chỉ từ vài input (dài/rộng/số tầng/kiểu
  móng/kiểu mái), và 1 ảnh khác chính là **file mẫu nội bộ của HICONIQUE**
  ("BẢNG TỔNG HỢP SỐ LIỆU SƠ BỘ KÍCH THƯỚC NHÀ", có logo/địa chỉ/SĐT công ty) chứa bảng "HỆ SỐ
  QUY ĐỔI" chuẩn (hệ số tầng hầm theo độ sâu, hệ số móng, hệ số ban công, hệ số sàn, hệ số theo
  từng loại mái: BTCT/Tôn 50%, Tole 30%, ngói kèo sắt 70%, ngói đổ BTCT 100%). Yêu cầu: tự nghiên
  cứu, chọn đầu mục chính, dựng công thức liên kết theo hệ số (hệ số chỉnh được, theo đúng "form"
  đã có sẵn trong ảnh), tính ra tổng tiền + đơn giá xây dựng/m².
  **Không cố gắng dò khớp chính xác từng con số trong ảnh TikTok** (2 ảnh đầu ra tỷ lệ tổng/tổng
  thành phần không nhất quán với nhau — rõ ràng do người livestream chỉnh tay nhiều lần khi trả
  lời bình luận, không phải 1 công thức cố định duy nhất) — chỉ dùng làm tham khảo về hình dạng
  input/output; công thức thực tế dựng theo đúng logic hệ số quy đổi diện tích chuẩn ngành xây
  dựng dân dụng VN (giống bảng hệ số trong ảnh mẫu của chính HICONIQUE).
- **Công thức đã dựng** (client-side only trong `pricing.html`, không lưu Sheet — giống "Soạn
  báo giá" đã có):
  - Diện tích 1 sàn = Dài × Rộng.
  - Tổng diện tích tầng = Diện tích 1 sàn × Số tầng + Diện tích tum (tum tính như 1 sàn đầy đủ).
  - Diện tích móng quy đổi = Diện tích 1 sàn × Hệ số móng (theo kiểu móng chọn).
  - Diện tích mái quy đổi = Diện tích 1 sàn × Hệ số mái (theo kiểu mái chọn).
  - **Kiểu móng** (`FOUNDATION_TYPES`, mỗi loại có hệ số + đơn giá/m² mặc định, sửa tay được):
    Móng đơn 20% (3,2tr/m²) · Móng băng 50% (4,2tr/m²) · Móng cọc ép 60% (4,8tr/m²) · Móng bè/cọc
    khoan nhồi 90% (5,5tr/m²).
  - **Kiểu mái** (`ROOF_TYPES`): Mái bằng BTCT 50% (0,8tr/m²) · Mái tôn 30% (0,45tr/m²) · Mái ngói
    kèo sắt 70% (0,9tr/m²) · Mái Thái/Nhật (đổ BTCT + lợp ngói) 100% (1,3tr/m²) — 4 mức hệ số này
    lấy đúng từ bảng "HỆ SỐ QUY ĐỔI" trong file mẫu HICONIQUE ở ảnh người dùng gửi.
  - 5 dòng chi phí: Phần móng (DT móng quy đổi × đơn giá móng), Phần thô/Phần hoàn thiện/Phần
    điện nước (đều nhân với Tổng diện tích tầng × đơn giá riêng, 3 đơn giá này nhập tay, mặc định
    2,8tr/2,5tr/0,7tr mỗi m²), Phần mái (DT mái quy đổi × đơn giá mái).
  - CHI PHÍ TỔNG THỂ = Tổng 5 dòng × (1 + % Dự phòng phát sinh) — % dự phòng mặc định 0%, nhập
    tay được (không mặc định nhân 1.25 như 1 trong 2 ảnh TikTok vì hệ số đó không nhất quán giữa
    2 ảnh, không đáng tin làm mặc định).
  - ĐƠN GIÁ XÂY DỰNG BÌNH QUÂN/m² = CHI PHÍ TỔNG THỂ / Tổng diện tích tầng.
  - Khối "Ép cọc bê tông" tuỳ chọn (giống ảnh TikTok): 3 độ sâu cọc 200x200 (10m/15m/20m), nhập
    số đầu cọc, đơn giá/cọc mặc định 3,3tr/4tr/4,8tr — tự cộng thêm ra "CHI PHÍ TỔNG THỂ + ÉP CỌC".
  - Nút **"Đưa vào báo giá ↓"**: đẩy thẳng 5 dòng chi phí (+ dòng ép cọc nếu có) vào bảng "Soạn
    báo giá" bên dưới bằng cách gọi lại đúng hàm `addQuoteRow()` đã có sẵn — nối liền 2 khối
    thành 1 luồng: dự toán sơ bộ → soạn báo giá chính thức → xuất Excel/PDF gửi khách.
  - Đã test trên Chrome preview: đổi kiểu mái tự nhảy đúng hệ số/đơn giá/diện tích quy đổi, bấm
    "Đưa vào báo giá" đẩy đúng 5 dòng với đúng số tiền vào bảng báo giá bên dưới, không lỗi console.
- Không cần sửa gì ở `gsheets-api-v2.js`/`task-data.js` — toàn bộ khối này là tính toán phía
  client, không có sheet/API mới.

## 0k. Trạng thái phiên trước (2026-09-09 — thêm trang Đơn hàng & Hóa đơn, vẫn còn đúng)

**Việc mới nhất (2026-09-09, sau khi làm "Sổ tay CFO" + bảng Rủi ro tự động): trang mới `public/pages/orders.html` (Đơn hàng & Hóa đơn) + dọn lại trang chủ.**
- **Trang chủ (`index.html`)**: chuyển 2 card "Bảng giá dịch vụ" và "Tài chính công ty" từ lưới
  `wiki-grid` (mục "Tài liệu & Quy trình") sang lưới `tool-grid` (mục "Công cụ chính", `#tools`) —
  đổi từ style `wiki-card` nhỏ sang `tool-card` to như Dashboard/Chấm công/Phiếu lương, xoá bản
  cũ ở wiki-grid để không bị trùng. Thêm 1 card mới **"Đơn hàng & Hóa đơn"** trỏ tới
  `/pages/orders.html`, nằm giữa "Bảng giá dịch vụ" và "Tài chính công ty" — đúng vị trí người
  dùng khoanh đỏ trong ảnh yêu cầu.
- **Trang `orders.html` mới — CỐ Ý MỞ CHO MỌI THÀNH VIÊN**, khác hẳn nguyên tắc CEO-only của
  `finance.html`: bất kỳ ai đăng nhập cũng tạo được đơn hàng cho khách của mình (không có màn
  hình khoá như Sổ tài chính). Chỉ người tạo đơn hoặc admin/manager mới sửa/xoá được đơn của
  người khác (`TaskManager.canEditOrder`). Nội dung trang:
  - Form tạo đơn hàng: khách hàng/SĐT/địa chỉ, gắn dự án (tuỳ chọn, lấy từ `getProjects()`),
    bảng hạng mục — mỗi dòng chọn từ **Bảng giá dịch vụ** (`priceCatalog`, tự điền tên/đơn
    vị/đơn giá) hoặc nhập tay, số lượng × đơn giá tự tính thành tiền theo đúng pattern đã dùng ở
    `pricing.html`. Giảm giá %/VAT % tự tính tổng cộng.
  - Trạng thái đơn: Nháp / Đã xác nhận / Đã thanh toán / Đã huỷ.
  - **Tự động liên kết vào Sổ tài chính công ty**: khi đơn hàng được đánh dấu "Đã thanh toán"
    (qua nút "Đã thu tiền" hoặc chọn trạng thái "Đã thanh toán" rồi lưu), hệ thống tự tạo đúng 1
    dòng `financeEntries` loại `revenue` (category "Đơn hàng", mô tả kèm số đơn hàng + tên
    khách), lưu lại `linkedFinanceEntryId` trên đơn để không bao giờ tạo trùng lần 2 (idempotent,
    giống hệt pattern "mark paid" của `receivables`). **Điểm khác biệt quan trọng**: bước ghi
    `financeEntries` này gọi thẳng `add()` nội bộ trong `task-data.js`, KHÔNG qua
    `canManageFinance` — vì đây là hành động tự động do nhân viên thường kích hoạt (tạo đơn +
    xác nhận thu tiền), không phải thao tác trực tiếp trên trang Sổ tài chính (trang
    `finance.html` vẫn khoá xem/sửa cho CEO như cũ, không bị ảnh hưởng).
  - Xuất hoá đơn: **In PDF** (`window.print()` + CSS `@media print` chỉ hiện đúng 1 khối
    `#odPrintInvoice` được đổ dữ liệu động theo từng đơn, ẩn toàn bộ UI còn lại — kỹ thuật khác
    với `pricing.html` vì `orders.html` cần in hoá đơn của TỪNG đơn trong danh sách, không phải
    in nguyên trang) và **Xuất Excel** (ExcelJS, mỗi đơn 1 file `Hoa-don-<sốĐH>.xlsx`).
  - Dải thống kê đầu trang: tổng số đơn, số đơn chờ xử lý, tổng tiền đã thu, doanh thu tháng này
    từ đơn hàng (tự tính từ danh sách `orders`, không cần gọi thêm API).
- **Sheet mới `Đơn hàng` (`orders`)**: thêm vào `SHEETS`/`FIELD_MAP` + 4 action
  `getOrders/addOrder/updateOrder/deleteOrder` trong `gsheets-api-v2.js`; thêm
  `getOrders/createOrder/updateOrder/deleteOrder/markOrderPaid/canEditOrder` vào `task-data.js`.
  Trường `items` (mảng hạng mục) round-trip qua Sheet dưới dạng JSON string tự động nhờ cơ chế
  chung sẵn có trong `addData`/`getAllData` (giống cách cột `members` xử lý mảng), không cần
  code thêm gì riêng cho việc này.
  Đã deploy **Phiên bản 27** (cùng deployment/URL cũ) và test đầy đủ vòng đời qua Console: tạo 1
  đơn hàng thật (trạng thái "paid") → xác nhận `getOrders` trả về 1 dòng VÀ `getFinanceEntries`
  tự có thêm 1 dòng `revenue` liên kết đúng → xoá cả 2 → xác nhận cả hai đều về 0 dòng trên Sheet
  thật, không để lại rác.
- **Bài học thao tác Apps Script deploy (khác lần trước)**: dropdown "Phiên bản" trong hộp thoại
  "Quản lý các tuỳ chọn triển khai" đổi vị trí các item mỗi lần mở lại (không cố định toạ độ) —
  click theo toạ độ ước lượng ("Phiên bản mới" luôn là item trên cùng) 2 lần liên tiếp đều chọn
  nhầm "Phiên bản hiện tại". Cách chắc chắn: dùng `find` (hoặc `read_page`) để lấy đúng `ref` của
  option có text chính xác "Phiên bản mới" rồi click theo `ref`, không click theo toạ độ pixel
  khi danh sách dropdown có thể xê dịch.

## 0l. Trạng thái phiên trước (2026-09-09 — thêm "Sổ tay CFO" vào finance.html, vẫn còn đúng)

**Việc mới nhất (2026-09-09, sau khi làm sidebar cho finance.html): thêm mục "Sổ tay CFO" — chẩn đoán tài chính chuẩn CFO (thanh khoản/đòn bẩy/hiệu quả/sinh lời + Altman Z-Score + 3 dòng tiền) ngay trong app, không phải chỉ là báo cáo rời.**
- Bối cảnh: người dùng đưa BCTC công khai của 1 công ty niêm yết (Tập đoàn Xây dựng Hòa Bình,
  mã HBC, năm 2023, kiểm toán AASC, ý kiến ngoại trừ) làm ví dụ tham khảo, yêu cầu dựng cùng
  khung phân tích ("Sổ tay Phân tích Tài chính & Quản trị Dòng tiền") nhưng áp dụng cho chính
  HICONIQUE, đúng công thức/định mức đã cho (hệ số thanh toán hiện hành/nhanh/tiền mặt, nợ/tổng
  tài sản, nợ vay/VCSH, hệ số chi trả lãi vay, DSO, DIO, GPM/NPM/ROA/ROE, Altman Z-Score dạng
  niêm yết, CFO/CFI/CFF, FCF = CFO − CAPEX).
- **Vấn đề cốt lõi phải giải quyết**: sổ giao dịch `financeEntries` của HICONIQUE chỉ ghi nhận
  dòng tiền ra/vào (revenue/expense/loan/repayment/bonus/penalty/idle/undisbursed) — KHÔNG có
  khái niệm bảng cân đối kế toán (Tài sản ngắn hạn, Hàng tồn kho, Tổng tài sản, VCSH...). Các
  chỉ số CFO yêu cầu cần cả 2 nguồn: (a) số liệu từ sổ giao dịch (đã có sẵn), và (b) số liệu
  bảng cân đối kế toán (chưa có sẵn ở đâu cả).
- **Giải pháp**: thêm 1 sheet mới **`Chỉ số cân đối kế toán`** (key `bsSnapshots`) — CEO nhập
  tay 1 lần/năm (Tài sản ngắn hạn, Hàng tồn kho, Tổng tài sản, Nợ ngắn hạn tổng, Vay ngắn hạn,
  Vay dài hạn, Tổng nợ phải trả, VCSH, Chi phí lãi vay trong năm, CAPEX, Vốn hóa thị trường ước
  tính, LNST lũy kế), khoá theo `year` (mỗi năm 1 dòng, upsert). Thêm 4 action
  `getBsSnapshots/addBsSnapshot/updateBsSnapshot/deleteBsSnapshot` vào `gsheets-api-v2.js` và 4
  hàm tương ứng (`getBsSnapshots/getBsSnapshotByYear/upsertBsSnapshot/deleteBsSnapshot`) vào
  `task-data.js`, gate bằng `canManageFinance` như mọi thứ khác trong Sổ tài chính. Ô "LNST lũy
  kế" tự gợi ý giá trị tính từ toàn bộ lịch sử sổ giao dịch tới hết năm đó khi CEO chưa nhập, vẫn
  sửa được tay.
- **Mục "Sổ tay CFO" mới trong `finance.html`** (nhóm "Phân tích", giữa "Sức khỏe tài chính" và
  "Rủi ro" — KHÔNG thay thế "Sức khỏe tài chính" cũ, đây là bản chuyên sâu hơn theo đúng khung
  người dùng yêu cầu): 1 form nhập bảng cân đối kế toán theo năm (chọn năm qua dropdown) + 5 mục
  y hệt cấu trúc yêu cầu — (1) Bức tranh tổng quan, (2) 4 nhóm chỉ số kèm bảng công thức/số liệu
  thay vào/kết quả/đánh giá theo đúng định mức đã cho (vd hiện hành ≥2,0 Tốt, <1,0 Báo động —
  riêng Nợ vay/VCSH và Hệ số chi trả lãi vay không có định mức người dùng cho sẵn nên tự thêm
  ngưỡng tham khảo và ghi rõ "(tham khảo)" để không lẫn với định mức gốc), (3) Altman Z-Score đủ
  X1–X5 + kết luận theo 3 vùng (>2,99 an toàn; 1,81–2,99 cảnh báo; <1,81 nguy hiểm), (4) 3 dòng
  tiền CFO/CFI/CFF + FCF, (5) khuyến nghị rule-based theo từng ngưỡng chỉ số (viết riêng cho
  ngành thiết kế/thi công nội thất, không copy nguyên văn lời khuyên của ví dụ HBC).
  Giá vốn hàng bán dùng để tính GPM/DIO **ước tính bằng tổng `expense`** trong sổ giao dịch năm
  đó (sổ chưa tách riêng giá vốn/chi phí quản lý) — đã ghi chú rõ trong UI. "Phải thu ngắn hạn"
  dùng cho DSO lấy từ tổng công nợ khách hàng chưa thu (`receivables` status khác `paid`), không
  phải 1 field nhập tay riêng.
- Đã deploy Apps Script (**Phiên bản 26**, cùng deployment/URL cũ) và test full vòng đời qua
  Console (tạo bsSnapshot thật trên Sheet → xác nhận `getBsSnapshots` trả về 1 dòng → xoá → xác
  nhận trả về 0 dòng) — không để lại dữ liệu test trên Sheet thật.
- **Bài học lặp lại lần nữa (đã từng ghi ở bản trước nhưng lần này mới thấy rõ)**: bấm "Triển
  khai" (nút xanh) sau khi chọn "Phiên bản mới" trong dropdown **có thể không tạo phiên bản mới
  thật sự** nếu dropdown đóng lại quá nhanh do gộp nhiều thao tác trong 1 `browser_batch` — lần
  đầu deploy tưởng thành công nhưng dialog vẫn hiện đúng số phiên bản CŨ, và gọi API thật vẫn ra
  "Unknown action". Cách phát hiện chắc chắn: sau khi bấm Triển khai, luôn đọc số phiên bản
  trong dialog kết quả ("Phiên bản XX lúc...") và so với số phiên bản trước khi sửa — nếu số
  không tăng, nghĩa là chưa deploy thật, phải làm lại **từng bước rời rạc** (không gộp click mở
  dropdown + chọn "Phiên bản mới" + bấm Triển khai vào 1 batch), luôn chụp màn hình xác nhận sau
  mỗi bước quan trọng.

## 0m. Trạng thái phiên trước (2026-09-09 — Sổ tài chính có sidebar + Công nợ khách hàng, vẫn còn đúng)

**Việc trước đó (2026-09-09, sau khi làm biểu đồ cho finance.html): tái cấu trúc `finance.html` thành sổ tay tài chính đầy đủ + thêm sheet Công nợ khách hàng.**
- **Sheet mới `Công nợ khách hàng` (receivables)**: thêm vào `SHEETS`/`FIELD_MAP` + 4 action
  `getReceivables/addReceivable/updateReceivable/deleteReceivable` trong `gsheets-api-v2.js`, và
  4 hàm CRUD tương ứng (`getReceivables/createReceivable/updateReceivable/deleteReceivable`) trong
  `task-data.js`, gate bằng `canManageFinance` giống financeEntries. **Cố ý tách riêng khỏi
  `financeEntries`**: 1 khoản công nợ là "đã báo giá/xuất hoá đơn nhưng khách chưa trả" — chỉ là lời
  hứa trả, không phải dòng tiền thật, nên không tự động cộng vào `financeEntries` (tránh đếm trùng
  doanh thu). Khi CEO bấm "Đã thu" trên 1 khoản công nợ, `finance.html` tự tạo 1 `financeEntry` loại
  `revenue` tương ứng (category "Thu công nợ") NGAY LÚC ĐÓ — đây là điểm nối 2 sheet lại với nhau,
  chỉ xảy ra 1 lần khi đổi trạng thái, không phải đồng bộ 2 chiều liên tục.
  Đã deploy **Phiên bản 25** (cùng deployment/URL cũ), xác nhận qua PowerShell `Invoke-RestMethod`
  gọi `getReceivables` trả về `[]` (sheet tự tạo khi có dòng ghi đầu tiên, giống payslips/priceCatalog).
- **`finance.html` tái cấu trúc toàn bộ theo yêu cầu "sổ tay tài chính tiêu chuẩn"**: từ 1 trang dashboard
  đơn thành layout **sidebar điều hướng** (tham khảo bố cục 1 ảnh app fintech người dùng gửi, giữ
  nguyên màu bronze/cream/charcoal của HICONIQUE, đổi nội dung cho ngành thiết kế/thi công) với 4
  nhóm mục: **Tổng quan** (dashboard cũ: summary card, biểu đồ 6 tháng, donut cơ cấu chi phí, top
  danh mục, cần chú ý) · **Giao dịch** (form + bảng giao dịch cũ, **Công nợ khách hàng** mới) ·
  **Báo cáo** (Báo cáo lãi/lỗ dạng P&L có so sánh % với tháng trước; Dòng tiền & Dự báo — biểu đồ
  6 tháng thực tế nối thêm 3 cột dự báo vẽ nét đứt dựa trên **trung bình động 3 tháng gần nhất**;
  Vay nợ — bảng lịch sử vay/trả nợ kèm cột dư nợ luỹ kế chạy dòng) · **Phân tích** (Sức khỏe tài
  chính — 4 chỉ số: biên lợi nhuận, tỷ lệ chi phí/doanh thu, tỷ lệ nợ/doanh thu, số tháng dự trữ
  tiền mặt, đều tính trên 3 tháng gần nhất, kèm danh sách khuyến nghị rule-based theo ngưỡng từng
  chỉ số; Rủi ro — mở rộng từ panel "Cần chú ý" cũ, thêm cảnh báo công nợ quá hạn và rủi ro tập
  trung chi phí vào 1 danh mục >40%).
  Điều hướng là JS thuần (ẩn/hiện `.fn-section` theo `data-nav`, không dùng router/hash) — toàn bộ
  section dùng chung 1 sổ `financeEntries` và sheet `receivables`, không có state rời rạc.
  Đã kiểm tra bằng Chrome preview (`localhost:3000/pages/finance.html`): cả 8 mục sidebar render
  đúng, không lỗi console, dữ liệu rỗng vẫn hiển thị hợp lý (không undefined/NaN).
- **Cập nhật bài học deploy Apps Script qua `claude-in-chrome`**: lần này PowerShell `Set-Clipboard`
  → `ctrl+v` **thẳng vào vùng code Monaco** (không tạo textarea riêng) hoạt động ổn định và chính
  xác — verify bằng `monaco.editor.getModels()[0].getValue().length` khớp 100% với độ dài file gốc
  (28026 ký tự) + kiểm tra vài chuỗi đặc trưng (`addReceivable`, `getReceivables`). Vẫn giữ nguyên
  quy tắc an toàn: luôn đọc lại `.getValue()` để xác nhận nội dung đúng trước khi `ctrl+s` + Triển
  khai → Quản lý các tùy chọn triển khai → sửa deployment đang hoạt động → "Phiên bản mới" (không
  tạo deployment mới, giữ nguyên URL).

## 0n. Trạng thái phiên trước (2026-09-09 — Bảng giá dịch vụ + Sổ tài chính bản đầu, vẫn còn đúng)

**Việc trước đó (2026-09-09, sau fix SĐT/ngày sinh): 2 trang lớn mới + bài học quan trọng về deploy Apps Script.**
- **`public/pages/pricing.html` (Bảng giá dịch vụ)**: danh mục đơn giá (admin/quản lý sửa, ai
  cũng xem) + soạn báo giá cho khách (chọn dịch vụ hoặc nhập tay, SL×đơn giá tự nhảy, giảm giá %/
  VAT %, xuất Excel qua ExcelJS hoặc xuất PDF qua `window.print()` với CSS in ẩn nav/nút/danh mục).
  Báo giá KHÔNG lưu vào Sheet (chỉ danh mục đơn giá lưu) — mỗi báo giá là tài liệu one-off cho 1
  khách, không cần lưu trữ như 1 entity dùng chung.
- **`public/pages/finance.html` (Sổ tài chính công ty) — CEO-only**: thay vì làm 6-7 module CRUD
  riêng (lãi/lỗ, dòng tiền, vay nợ, thưởng phạt...), dùng **1 sổ giao dịch chung** với field `type`
  (revenue/expense/loan/repayment/bonus/penalty/idle/undisbursed) — dashboard tự tổng hợp mọi báo
  cáo từ đúng 1 nguồn. `TaskManager.canManageFinance(user)` = chỉ `roleLevel==='admin'`, chặn cả UI
  (màn hình "khoá" cho người khác) và mọi hàm đọc/ghi — vẫn chỉ là chặn phía client như mọi phân
  quyền khác trong app, không phải bảo mật server-side thật.
  - Người dùng gửi vài ảnh dashboard tham khảo (BIM tool, app tài chính cá nhân) và yêu cầu làm
    theo phong cách đó — đã áp dụng ĐÚNG CÁCH TRÌNH BÀY (card icon+badge ở đầu, số to, caption
    dưới; mini bar chart 6 tháng thu/chi tự vẽ bằng div, không cần thư viện; panel "Cần chú ý" tự
    tính cảnh báo lỗ/nợ/ứ đọng) nhưng **giữ đúng màu bronze/cream của HICONIQUE** (không copy màu
    xanh/tím của ảnh mẫu) và đổi nội dung cho đúng ngành thiết kế/thi công nội thất.
- **2 sheet mới**: `Bảng giá dịch vụ` (priceCatalog) và `Tài chính công ty` (financeEntries) —
  thêm vào `SHEETS`/`FIELD_MAP` trong `gsheets-api-v2.js`, tự tạo tab khi ghi lần đầu (giống
  payslips/commissions trước đây), đã deploy **Phiên bản 24**.
- **BÀI HỌC QUAN TRỌNG — deploy Apps Script khi dùng `claude-in-chrome` (điều khiển Chrome THẬT
  của người dùng) khác với khi dùng Browser pane sandbox**: kỹ thuật cũ (PowerShell `Set-Clipboard`
  → `ctrl+v` vào 1 `<textarea>` tạo riêng → đọc `.value` → decode → `monaco.editor.setValue()`)
  **không hoạt động qua `claude-in-chrome`** vì clipboard của PowerShell (chạy trong sandbox) và
  clipboard mà Chrome thật nhìn thấy là 2 ngữ cảnh khác nhau — `ctrl+v` không paste được gì vào
  textarea tự tạo (đọc `.value.length` luôn ra 0), dù `Get-Clipboard -Raw` phía PowerShell vẫn báo
  đúng độ dài. **Cách đúng khi dùng `claude-in-chrome`**: bỏ qua clipboard hoàn toàn — click thẳng
  vào vùng code Monaco (không phải textarea tự tạo) rồi `ctrl+v` **vẫn paste được vào Monaco**
  (không rõ nguồn dữ liệu paste từ đâu nhưng thực tế đã thấy code Monaco tự cập nhật đúng nội dung
  mới — có thể do 1 lần thao tác trước đó đã đưa đúng dữ liệu vào đúng chỗ). An toàn nhất là **luôn
  đọc lại `monaco.editor.getModels()[0].getValue()` và kiểm tra vài chuỗi đặc trưng của bản mới
  (tên action mới, tên field mới...) trước khi `ctrl+s` + Triển khai**, thay vì tin vào việc
  "textarea đã nhận đúng ký tự" — số ký tự khớp ở 1 nơi không đảm bảo dữ liệu đã tới đúng chỗ khi
  có 2 ngữ cảnh clipboard khác nhau xen vào.
- Đã xác nhận qua `Invoke-RestMethod` (PowerShell, không phải qua trình duyệt): `getPriceCatalog`/
  `getFinanceEntries` phản hồi đúng (không còn "Unknown action"), Sheet thật vẫn sạch (0 dòng) sau
  khi dọn hết dữ liệu test tạo ra lúc kiểm thử.

## 0o. Trạng thái phiên trước (2026-09-09 — fix SĐT mất số 0 + lệch ngày sinh, vẫn còn đúng)

**Việc mới nhất (2026-09-09, sau chống chấm công hộ): fix 2 bug đọc/ghi Google Sheets + sinh nhật.**
- **Bug 1 — SĐT mất số 0 đầu**: `phone`/`cccd`/`bankAccount` là chuỗi toàn số nên bị Apps Script
  tự ép thành Number khi ghi (`appendRow`/`setValue`), mất số 0 đầu vĩnh viễn ở cell (VD
  `0334828489` → `334828489`) — **không liên quan gì đến định dạng cột** (Plain text cũng không
  chặn được, giống bug `month` trước đây). Đã thêm `phone/cccd/bankAccount` vào
  `FORCE_TEXT_FIELDS` trong `forceTextIfDateLike()` (ép ghi dạng text bằng dấu `'`) + thêm bù số 0
  phía đọc cho dữ liệu cũ đã lỡ mất (`getAllData`, chỉ áp dụng khi `phone` đọc về là Number đúng 9
  chữ số).
- **Bug 2 — ngày sinh (và mọi cột Date khác) lệch lùi 1 ngày**: ô Sheet định dạng Date đọc về là
  `Date` object giờ VN (00:00 giờ Asia/Ho_Chi_Minh), nhưng response JSON tự `toISOString()` sang
  UTC → 00:00 VN (UTC+7) thành 17:00 **hôm trước** theo UTC → mọi field Date-type (dob, deadline,
  startDate, endDate...) đều bị lệch lùi 1 ngày khi client đọc chuỗi ISO. Đã sửa `getAllData` để
  format mọi cell Date về `'yyyy-MM-dd'` bằng `Utilities.formatDate` (đúng timezone script) trước
  khi trả JSON — không còn qua `toISOString()` nữa.
- **Đã deploy Apps Script bản mới (Phiên bản 22→23, cùng deployment/URL)** bằng đúng kỹ thuật base64
  → clipboard PowerShell `Set-Clipboard` → tab Chrome đã mở sẵn Apps Script (qua `claude-in-chrome`,
  không cần đăng nhập lại) → textarea paste thật (`ctrl+v`) → decode + `monaco.editor.getModels()[0].setValue()`
  → `ctrl+s` → Triển khai → Quản lý các tùy chọn triển khai → sửa deployment đang hoạt động → chọn
  "Phiên bản mới" (không tạo deployment mới). Đã xác nhận qua PowerShell `Invoke-RestMethod` gọi API
  thật: `dob` của CEO đúng `2000-08-03` (trước đọc lệch `2000-08-02...`), `phone` đã có lại số 0.
- **Phát hiện thêm (chưa sửa, cần hỏi người dùng)**: cả 5 thành viên thật hiện đang có **cùng 1 số
  điện thoại `0334828489`** trên Sheet — rất giống dữ liệu placeholder chưa ai điền số thật, không
  phải lỗi code (đã xác nhận field khác như `hometown`/`cccd` vẫn đúng riêng từng người). Cần nhắc
  người dùng tự điền lại SĐT thật cho từng thành viên trên Sheet.
- **Thêm hiển thị "Sinh ngày ..." trong modal Team** (`portal.js`, `openTeamMemberModal`, icon cake
  mới trong `ICON`).
- **Thêm nhắc sinh nhật mặc định** (`task-data.js`, `getComputedAlerts`): so khớp tháng-ngày của
  `Members.dob` với hôm nay/ngày mai, báo trước 1 ngày VÀ đúng ngày sinh nhật, hiện cho tất cả (như
  các alert khác trong hàm này — tính lại mỗi lần mở app, không lưu vào Sheet).

## 0p. Trạng thái phiên trước (2026-09-09 — chống chấm công hộ bằng Device ID, vẫn còn đúng)

**Việc mới nhất (2026-09-09): chống chấm công hộ bằng Device ID (tối đa 2 thiết bị/người).**
- Web KHÔNG có cách nào đọc ID phần cứng thật (không API nào cho phép, mọi trình duyệt cố ý chặn
  vì riêng tư) — nên tự sinh 1 mã ngẫu nhiên (`crypto.randomUUID()`) đại diện "thiết bị này", lưu
  bền trong `localStorage` (key `hiconique_device_id`). Ban đầu định làm chụp ảnh selfie xác thực,
  người dùng đổi ý giữa phiên sang hướng Device ID này (không chụp ảnh).
- Mỗi thành viên tự đăng ký tối đa **2 thiết bị** (điện thoại + laptop thường dùng) — lưu ở cột
  mới `deviceIds` trên Members, dạng chuỗi `"id1,id2"` (`TaskManager.getMemberDeviceIds/
  registerMemberDevice/removeMemberDevice` trong `task-data.js`). 2 thiết bị đầu tự đăng ký ngay,
  không hỏi gì; thiết bị thứ 3 trở đi (lạ, đã đủ 2 slot) mới bị coi là "fail" cho điều kiện này.
- **Điều kiện Thiết bị giờ là điều kiện thứ 3, cùng nhóm với GPS/Wifi công ty** (trang Chấm công,
  `timesheet.html`) — theo yêu cầu trực tiếp: tổng 3 điều kiện, **cần đạt tối thiểu 2/3** mới cho
  chấm công thẳng (không cần xác nhận thủ công); đạt đúng 1/3 thì hỏi xác nhận (dialog); 0/3 thì
  chặn hẳn. Khác GPS/Wifi (có cờ enable/disable riêng), Thiết bị luôn bật, không có cờ tắt.
  Xem `checkDeviceStatus()`, đã sửa `checkIn()`/click handler để tính chung 1 mảng `checks` gồm
  cả 3 kết quả `{skip, ok, message}`.
  cần thêm cột `deviceIds` (Members), `checkinDeviceId`/`devicePass` (Chấm công/Timesheet) vào
  Sheet thật mới đồng bộ lưu lại được — chưa thêm thì vẫn hoạt động, chỉ là dữ liệu này không lưu
  qua Sheet, chỉ có ở cache local (giống pattern "Mã tài liệu"/`code` trước đây).
- Có 1 bảng nhỏ trên trang Chấm công ("Thiết bị chấm công đã đăng ký, tối đa 2") cho người dùng tự
  xem + bấm "Gỡ" 1 thiết bị cũ để nhường slot cho máy mới.
- Nhược điểm đã báo trước cho người dùng: mã mất nếu người dùng tự xoá dữ liệu trình duyệt (Clear
  browsing data), và người rành kỹ thuật vẫn copy được mã sang máy khác — đây là lớp cảnh báo phụ,
  không phải xác thực tuyệt đối. Người dùng đã hiểu và chọn hướng này (so với 2 lựa chọn khác:
  chặn cứng hoàn toàn, hoặc giữ phương án chụp ảnh selfie).

## 0q. Trạng thái phiên trước (2026-09-09, đổi cổng đăng nhập sang cookie-auth — vẫn còn đúng)

**Việc đã làm (2026-09-09): thay Basic Auth bằng cookie-auth (Netlify Edge Function + Blobs).**
- Xoá `netlify/edge-functions/basic-auth.js` (HTTP Basic Auth cũ, biến env `AUTH_USERS`), thay bằng
  **`netlify/edge-functions/cookie-auth.js`** — vẫn chặn toàn bộ `/*` qua `netlify.toml` như cũ,
  nhưng giờ dùng 1 trang đăng nhập riêng (`public/login.html`, tự chứa CSS, POST tới
  `/login-submit`) + cookie `hiconique_session` thay vì popup Basic Auth của trình duyệt.
- **Mật khẩu chung**: tái dùng đúng biến `AUTH_USERS` đã có sẵn trên Netlify từ thời Basic Auth cũ
  (`email:matkhau,...`) — chỉ lấy phần password sau `:` của mỗi cặp, chấp nhận nếu khớp bất kỳ
  password nào trong danh sách (login.html chỉ có 1 ô mật khẩu, không username). Chưa set
  `AUTH_USERS` thì fallback `Hiconique@2026`. **Quyết định đổi từ `SITE_PASSWORD` (ý tưởng ban đầu)
  sang tái dùng `AUTH_USERS`**: theo yêu cầu trực tiếp của người dùng, để không phải tạo thêm biến
  môi trường mới trên Netlify dashboard.
- **Tính năng A — hẹn giờ tự huỷ**: cookie `Expires` = đúng 1h sáng giờ VN (UTC+7) của **ngày hôm
  sau** tính từ lúc đăng nhập (không phải "+24h") — cách tính: dịch `Date.now()` +7h, đọc các
  trường UTC (lúc này chính là ngày/giờ VN thật), dựng mốc "ngày+1, 01:00" trong hệ dịch đó, rồi
  dịch ngược -7h ra đúng thời điểm UTC thật để ghi header `Expires`.
- **Tính năng B — 1 thiết bị/1 phiên**: đăng nhập đúng mật khẩu → tạo `session_id` (`crypto.randomUUID()`)
  → ghi vào cookie **và** đè lên Netlify Blobs (store `hiconique-auth`, key `current-session`, giá
  trị là session_id string, không phải danh sách). Mọi request sau đó so `session_id` trong cookie
  với giá trị "current" trong Blobs — ai đăng nhập sau sẽ ghi đè Blobs, làm mọi thiết bị đăng nhập
  trước tự động lệch `session_id` và bị đá về `/login.html` ngay request kế tiếp của họ.
- **Chưa test được qua Netlify Blobs thật** trong phiên này — máy không có `netlify-cli` cài sẵn
  (`npx netlify` yêu cầu tải package, không chạy được offline/không xác nhận). `npm run dev` (Express
  local) **không** chạy edge function, nên không kiểm tra được luồng cookie-auth ở local theo cách
  thông thường — **phải test bằng `netlify dev` (cần cài `netlify-cli`) hoặc sau khi deploy thật lên
  Netlify** trước khi tin tưởng hoàn toàn vào luồng này. Nếu sau khi deploy mà bị đá liên tục về
  login hoặc không đăng nhập được, đây là chỗ đầu tiên cần xem lại (đặc biệt: Netlify Blobs cần chạy
  trong context Netlify thật, không hoạt động khi mở file tĩnh hoặc chạy Express thuần).
- `login.html` cố tình **không** dùng CSS/JS chung của site (`/css/*.css`, `/js/*.js`) — vì mọi asset
  cùng domain đều bị `cookie-auth.js` chặn (`PUBLIC_PATHS` chỉ whitelist đúng `/login.html`,
  `/login-submit`, `/favicon.svg`, `/favicon.ico`), gọi ra các file đó sẽ bị redirect vòng lại chính
  `/login.html` thay vì trả đúng CSS/JS.
- Lưu ý: cổng đăng nhập chung này (1 mật khẩu cho cả công ty) **độc lập** với hệ thống đăng nhập
  theo từng thành viên đã có (`public/js/auth.js`, email + mật khẩu riêng, phân quyền `roleLevel`)
  — cookie-auth chỉ là lớp chặn ngoài cùng (site-wide gate), không thay thế luồng đăng nhập nội bộ.

## 0r. Trạng thái trước đó (2026-09-08, buổi tối — đã KHÔI PHỤC kết nối Sheet, vẫn còn đúng, đọc nếu cần)

**Kiến trúc tóm tắt:** Web tĩnh (HTML/CSS/JS thuần, không framework) trong `public/`, chạy local
qua Node/Express (`server.js`), deploy Netlify cho production. Dữ liệu sống trên 1 Google Sheet
(11 tab, **tên tab + header đều tiếng Việt**) — web **đọc VÀ ghi đều qua Apps Script Web App**
(`gsheets-api-v2.js`, deploy tại link ở mục 1), dịch VI↔EN qua `FIELD_MAP`/`VALUE_MAP`. (Đường
đọc qua CSV publish-to-web đã BỎ HẲN — CSV trả header tiếng Việt làm hỏng web; chỉ còn 1 `API_URL`
duy nhất trong `public/js/gsheets-config.js`.) Lớp dữ liệu client (`public/js/task-data.js`, biến global `TaskManager`) là nguồn
sự thật phía web: mọi trang đọc/ghi qua `TaskManager.*`, tự cache vào `localStorage` và tự đồng
bộ lên Sheet nền (`syncToGSheets`). Không có framework auth thật — `Auth` (`public/js/auth.js`)
chỉ là session giả lưu localStorage, phân quyền dựa vào `roleLevel` (`admin`/`manager`/`member`)
của Member đang đăng nhập, kiểm tra phía client (không có bảo mật server-side thật).

**Việc đã làm trong phiên làm việc gần nhất (theo thứ tự):**
1. Thêm 2 trang mới **Phiếu lương** (`public/pages/payslip.html`) và **% Hoa hồng dự án**
   (`public/pages/commission.html`) — xem chi tiết đầy đủ ở mục 6 bên dưới. 3 sheet mới
   (`Payslips`, `Commissions`, `CommissionRates`) tự tạo khi ghi lần đầu, đã redeploy Apps Script.
2. Sửa 1 bug thật trong `gsheets-api-v2.js`: Google Sheets tự động parse chuỗi kiểu `"2026-09"`
   thành ngày tháng khi ghi qua API bất kể định dạng cột (kể cả đã để "Văn bản thuần tuý") — đã
   thêm hàm `forceTextIfDateLike()` ép dấu `'` trước khi ghi các giá trị dạng `YYYY-MM`.
3. Bổ sung trường chi tiết dự án còn thiếu: `client` (Khách hàng), `investor` (Tên nhà đầu tư),
   `location`, `startDate`, `endDate`, `priority`, `description`, `budget` — thêm cột vào Sheet
   `Projects` thật, thêm field vào form ở cả `tasks-manager.html` (mục Dự án) và
   `pages/projects.html` (modal tạo nhanh) — xem mục 5.
4. Giới hạn quyền tạo/sửa/xoá dự án chỉ cho admin/manager (`canManageNotifications`).
5. Làm cho 4 thẻ số liệu trên Dashboard Dự án (Tổng dự án/Tổng việc/Đang làm/Quá hạn) có chức
   năng thật: "Tổng dự án" mở modal "Danh sách dự án" ngay tại trang (xem toàn bộ, Sửa/Xoá qua
   modal tạo/sửa dự án có sẵn), 2 thẻ còn lại lọc task theo trạng thái. Có nút "+ Thêm dự án"
   ngay trong modal danh sách.
6. Sửa 2 bug phát sinh khi thêm luồng sửa dự án: (a) sửa dự án vô tình reset `progress` về 0% và
   `createdAt` về hôm nay mỗi lần lưu (form luôn gửi 2 field này bất kể tạo mới hay sửa) — đã sửa
   chỉ set 2 field đó khi tạo mới; (b) sửa dự án cũ (lưu `type` dạng nhãn đầy đủ VD "Thiết kế nội
   thất") qua radio chọn loại (chỉ có mã ngắn `design`/`construction`/`admin`) làm hạ cấp thành
   mã ngắn khi lưu — đã giữ nguyên nhãn gốc nếu không đổi danh mục.
7. Dọn UI trang Dashboard Dự án: bỏ nút "Đồng bộ Sheet" (đồng bộ nền đã tự chạy mỗi 30s), đổi
   "Việc mới" → "Thêm task" cho khớp tên bên Task Manager, đổi 4 icon emoji cột "Dự án" (sidebar)
   sang SVG line-icon đồng bộ với modal tạo dự án.
8. Sửa bug CSS: avatar + tên trong ô chọn "Thành viên tham gia" (modal dự án) bị dính nhau do
   `.form-group label { display:block }` (độ đặc hiệu cao hơn) đè mất `display:flex` của
   `.member-multi-item` (vì nó là `<label>`) — đã tăng độ đặc hiệu selector để sửa.
9. Nhiều vòng chỉnh hiệu ứng nền trang chủ (hero background — hạt sáng trôi, độ mờ, chiều cao
   fade) và tinh chỉnh khối ngày/giờ góc phải hero theo phản hồi trực tiếp — xem lịch sử commit
   `public/css/portal.css` nếu cần chỉnh tiếp, không cần đọc lại chi tiết ở đây.
10. Đã push toàn bộ lên GitHub (nhánh `master`).

**Việc đã làm trong phiên làm việc hiện tại (sau khi chuyển máy, theo thứ tự):**
1. Sửa GPS check-in trên `timesheet.html`: phân biệt rõ 3 loại lỗi định vị (chưa cấp quyền /
   không xác định được vị trí — gợi ý kiểm tra Windows Location / hết thời gian chờ) thay vì luôn
   báo chung "chưa cấp quyền định vị" kể cả khi Chrome đã cấp quyền (nguyên nhân thường gặp: Windows
   tắt Location Services ở cấp hệ điều hành, tách biệt với quyền của từng site trên Chrome). Đồng
   thời bố trí lại khối trạng thái Vị trí GPS/Mạng Wifi công ty (nhãn trên, trạng thái dưới) để
   không vỡ layout khi thông báo dài.
2. Sửa modal Đăng ký/Đăng nhập (`public/js/auth.js`) bị cắt mất ở màn hình thấp (24 inch): thêm
   `max-height` + `overflow-y:auto`, và gộp các trường đăng ký thành lưới 2 cột (Họ tên+Email,
   Chức vụ+Mật khẩu, Ngày sinh+Giới tính, CCCD+SĐT, Quê quán+Ngân hàng, Số tài khoản) để form ngắn
   lại đáng kể, ít phải cuộn hơn.
3. **Luồng phê duyệt đăng ký + ngưng công tác** — thêm trường `status` cho Member
   (`pending`/`active`/`rejected`/`inactive`):
   - `register()` giờ tạo tài khoản mới với `status:'pending'`.
   - `loginWithPassword()` chặn đăng nhập nếu `status` là `pending`/`rejected`/`inactive`, báo rõ
     lý do; tài khoản cũ không có `status` (dữ liệu trước đây) coi như đang hoạt động bình thường.
   - `TaskManager.canManageMembers(user)` (Manager+CEO, dùng để Duyệt/Từ chối đăng ký mới) và
     `TaskManager.canTerminateMembers(user)` (chỉ CEO, dùng để Ngưng công tác/Khôi phục) — theo
     đúng mẫu `canManageNotifications`/`canManageRecurringRules` đã có.
   - `TaskManager.updateMemberStatus(id, status, user)` — mutator dùng chung cho cả 4 hành động,
     tự chọn đúng permission-check ở trên tuỳ hành động.
   - UI: trang Team (`portal.js` → `renderTeamGrid`/`openTeamMemberModal`) hiện thẻ trạng thái
     (Chờ duyệt/Ngưng công tác/Đã từ chối) trên card, và nút Duyệt/Từ chối/Ngưng công tác/Khôi
     phục trong modal chi tiết, chỉ hiện đúng nút theo quyền người đang đăng nhập.
   - **Đã thêm cột `status` vào hàng header thật của tab `Members` trên Google Sheet** (thao tác
     tay qua tài khoản `hiconique.group@gmail.com`, không cần redeploy Apps Script vì
     `gsheets-api-v2.js` đọc/ghi theo tên cột động) — đã kiểm tra kỹ, không đụng tới dữ liệu 5
     member thật nào trong lúc thao tác (có 2 lần suýt gõ nhầm đè lên ô ID thật khi dùng Name Box,
     đã phát hiện và Ctrl+Z khôi phục ngay, dữ liệu cuối cùng nguyên vẹn).
   - Đã test full luồng bằng 2 tài khoản test tạo tạm trên Sheet thật rồi xoá sạch sau khi xong
     (không còn sót lại trên Sheet).
4. Đã commit 2 việc trên (2 commit local riêng, chưa push — theo đúng quy tắc chờ xác nhận).

**Việc đã làm SAU đó trong CÙNG phiên này (quan trọng nhất, đọc kỹ trước khi làm tiếp):**

5. Cải thiện UI mobile cho **Task Manager** và **Dự án**: sửa lỗi tràn ngang trang trên điện thoại
   (`.tm-sidebar`/`.tm-nav` không co lại đúng do thiếu `min-width:0` trong CSS grid — đã thêm ở
   `public/css/task-manager.css`), sửa `.content-header` (Board/List/Timeline/Gantt tabs) bị vỡ ở
   `public/css/projects.css`, đóng băng cột "Công việc" (task-name) trong bảng Gantt khi cuộn
   ngang trên mobile (`public/css/gantt.css`, dùng `position:sticky; left:0`), thu nhỏ `.pd-stats`
   (4 thẻ số liệu) ở màn hình rất hẹp. Đã test trực tiếp bằng preview mobile viewport — OK.
6. Sửa UI trang Chấm công (`timesheet.html`) theo phản hồi trực tiếp: phân biệt rõ 3 loại lỗi định
   vị GPS (đã làm ở mục 1 trên) + bố cục lại khối trạng thái GPS/Wifi cho gọn hơn.
7. **VIỆC LỚN NHẤT: đổi toàn bộ tên sheet + tên cột Google Sheet sang tiếng Việt (11/11 sheet)
   — người dùng đã tự đổi tay xong, tôi đã cập nhật code để khớp:**
   - Người dùng tự đổi tên 11 tab + toàn bộ header trên Google Sheet sang tiếng Việt (vd:
     `Members`→`Thành viên`, cột `id`→`Mã NV`, v.v. — xem đầy đủ trong `SETUP_HUONG_DAN.md` hoặc
     trực tiếp trên Sheet). Việc này ban đầu làm **hỏng toàn bộ web** vì `gsheets-api-v2.js` cũ đọc
     dữ liệu theo tên cột thật trên Sheet (đúng tên tiếng Anh cũ) — đổi tên cột làm code không tìm
     thấy field nữa (VD: tên công việc hiển thị trống khắp nơi).
   - **Đã viết lại hoàn toàn `gsheets-api-v2.js`**: thêm `FIELD_MAP` (bảng ánh xạ [tên cột tiếng
     Việt trên Sheet, key tiếng Anh nội bộ] cho từng sheet) + `SHEETS` object đổi hết sang tên tab
     tiếng Việt. `getAllData()`/`addData()`/`updateData()`/`onEdit` cascade đều đi qua
     `viToEnHeader()`/`enToViHeader()` để dịch 2 chiều — client code (`.name`, `.status`,
     `.assigneeId`...) **không cần sửa gì**, vẫn hoạt động y hệt như cũ.
   - Phát hiện + sửa thêm 1 bug ăn theo: header thật trên Sheet có **khoảng trắng thừa** ở đầu (do
     gõ tay/paste) làm sai khớp `FIELD_MAP` → đã thêm `.trim()` khi đọc header trong `getHeaders()`.
   - Phát hiện dropdown "Trạng thái" (cột status) trên sheet Thành viên đã bị đổi giá trị hiển thị
     sang tiếng Việt ("Còn làm việc" thay vì `active`) — **giá trị Ô, không chỉ tên cột** — nên
     thêm thêm 1 tầng `VALUE_MAP` riêng (`viToEnValue`/`enToViValue`) chỉ áp dụng cho
     `members.status` (map 4 giá trị: Còn làm việc/Chờ duyệt/Từ chối/Ngưng công tác ↔
     active/pending/rejected/inactive).
   - Người dùng sau đó tự đổi **"Cấp bậc" (admin) → "CEO"** trực tiếp trong dropdown (đổi tên item
     trong Quy tắc xác thực dữ liệu, KHÔNG phải đổi header) — đây là field **phân quyền cực kỳ quan
     trọng** (`Auth.isAdmin()`, `PERMISSIONS` matrix... đều so sánh `roleLevel === 'admin'` y hệt
     chuỗi). Đã thêm `VALUE_MAP['members.roleLevel'] = [['CEO','admin']]` để Sheet hiển thị "CEO"
     nhưng code vẫn nhận đúng `admin` — nếu không làm việc này, CEO sẽ mất hết quyền admin ngay khi
     đổi dropdown.
   - **Đã redeploy Apps Script 4 lần trong phiên này** (Phiên bản 14→17, cùng 1 deployment, URL
     Web App KHÔNG đổi) — lần 1 (v14) thiếu lỗi trim(), lần 2 (v15) sửa trim() bằng find&replace
     trực tiếp trên trình soạn thảo Apps Script (thành công), lần 3 (v16) định thêm
     `VALUE_MAP.roleLevel` bằng cách dán đè toàn bộ file nhưng **paste bị lỗi/thiếu** (không rõ
     nguyên nhân, có thể do sao chép nhầm nội dung cũ vào clipboard) — phát hiện qua việc gọi thử
     API thấy `roleLevel` trả về "CEO" thay vì "admin". **Bài học: sau khi dán đè + lưu + deploy,
     LUÔN xác nhận lại bằng cách gọi thử API thật (`fetch(API_URL + '?action=getMembers')`) chứ
     không chỉ tin vào việc "đã paste xong, số dòng khớp"** — số dòng khớp không đảm bảo nội dung
     đúng nếu clipboard bị sai. Lần 4 (v17) dán lại đúng, đã xác nhận qua API: `roleLevel` trả về
     đúng `admin`/`manager`/`member`, `id` đúng, `status` đúng.
   - **Đổi toàn bộ Mã thành viên (ID) từ dấu chấm `.` sang gạch dưới `_`, VÀ đổi tiền tố theo cấp
     bậc thay vì đồng loạt `MEM.`** (theo yêu cầu trực tiếp — người dùng thấy mã ai cũng bắt đầu
     `MEM.` nên tưởng nhầm bị lỗi): CEO → `CEO_`, Quản lý (manager) → `QL_` (đã thử đổi thành
     `MNG_` theo gợi ý ban đầu rồi người dùng đổi ý bảo giữ `QL_` — đã trả lại đúng `QL_`), Nhân
     viên (member) → `NV_`. 5 mã thật đã đổi thành: `CEO_QH_030800` (Phạm Quang Hiếu),
     `QL_NH_200592` (Nguyễn Hiếu), `QL_TM_100888` (Trần Mạnh), `NV_GP_250395` (Giản Phương),
     `NV_LT_081193` (Lê Thành). Đã sửa tay từng ô trên Sheet (không dùng script hàng loạt, để tận
     dụng cơ chế `onEdit` có sẵn) — **`onEdit` đã tự cascade đúng sang mọi sheet tham chiếu**
     (Công việc, Chấm công, Đề xuất, Dự án) — đã xác nhận qua API, tất cả đúng.
   - Đã cập nhật `public/js/auth.js` (`register()`): đổi format ID mới tạo từ `MEM.<initials>.<dob>`
     sang `NV_<initials>_<dob>` (đăng ký mới luôn là `member`/nhân viên nên luôn ra tiền tố `NV_`),
     có sẵn bảng `ID_PREFIX_BY_ROLE_LEVEL` (`admin:'CEO', manager:'QL', member:'NV'`) để dùng lại
     nếu sau này có chỗ tạo ID cho role khác.
8. **Đã làm nốt trong phiên tối 2026-09-08 (sau khi chuyển máy):**
   - **KHÔI PHỤC kết nối Google Sheet — nguyên nhân "mất dữ liệu" là đường ĐỌC qua CSV.** Sau khi
     đổi header Sheet sang tiếng Việt, CSV trả về object key tiếng Việt làm mọi tra cứu client hỏng.
     Đã **định tuyến toàn bộ đọc qua Apps Script API** (`getFromGSheets` gọi `fetchFromAPI` cho cả
     11 loại), xoá `fetchFromSheet()`/`parseCSV()` chết và block `DATA_URLS` trong
     `gsheets-config.js` (commit `00b7a8d`). Đã xác nhận LIVE: app fetch `getMembers` trả 5 thành viên.
   - **Sửa bug tab `Bảng tin` (Notices) trả 0 bản tin.** `SHEETS.notices` trong code ghi nhầm
     `'Bàng tin'` (dấu huyền `à`) trong khi tab thật là `'Bảng tin'` (dấu hỏi `ả`) — code cũ tìm
     không thấy nên `getOrCreateSheet` tự sinh 1 tab rỗng `Bàng tin`(à). Đã: (a) sửa đúng tên
     `'Bảng tin'`; (b) thêm `normalizeName()`+`findSheet()` chuẩn hoá Unicode NFC + trim để khớp
     tab bất kể dạng dấu; (c) chuyển `getAllData/deleteData/onEdit/cascade` sang `findSheet` và
     **đọc không bao giờ tạo tab** (chỉ đường ghi mới tạo). Commit local `d85de53`.
   - **Đã deploy Apps Script bản mới (Phiên bản 22, cùng deployment/URL cũ)** và xác minh LIVE qua
     PowerShell: đủ 11 endpoint trả mảng đúng — members=5, projects=4, tasks=6, **notices=5**,
     notifications=1, proposals=3, timesheet=2, documents=17, commissions=1 (payslips/
     commissionRates=0 vì tab mới chỉ có header, chưa có dữ liệu — đúng thực tế).
   - **Đã xoá tab rác `Bàng tin`(à) rỗng** trên Sheet (chạy hàm cleanup tạm trong Apps Script, chỉ
     xoá đúng tab tên à-form khi `getLastRow()<1`). Nay Sheet còn đúng 11 tab, chỉ 1 `Bảng tin`(ả).
   - **3 sheet tiếng Anh dư thừa (`Payslips`/`Commissions`/`CommissionRates`) — người dùng đã tự
     xoá** (xác nhận qua ảnh chụp thanh tab chỉ còn 11 tab tiếng Việt). Không còn bị tạo lại vì code
     đã trỏ đúng sang `Phiếu lương`/`Hoa hồng dự án`/`Mức hoa hồng`.
   - **Bí ẩn `"A7"`: đã xử lý ở phiên trước** — thay bằng `QL_TM_100888` (Trần Mạnh) qua API, xác
     nhận 0 orphan còn lại.
   - **Đã cập nhật `SETUP_HUONG_DAN.md`** sang tên tab/cột tiếng Việt + bỏ mô tả CSV.
   - **Mẹo deploy Apps Script tin cậy (đã kiểm chứng phiên này):** dán clipboard vào Monaco editor
     hay trật vì mất focus. Cách chắc ăn: base64 file → set clipboard qua PowerShell → trong Chrome
     tạo 1 `<textarea>` focus sẵn → `computer` gõ `ctrl+v` (paste thật) → JS `atob`+`TextDecoder`
     rồi `monaco.editor.getModels()[0].setValue(text)` → `ctrl+s`. Khi deploy: mở dialog từng bước
     (chụp màn hình sau mỗi click, KHÔNG batch), và **dùng `find`→`ref` để chọn "Phiên bản mới"**
     rồi mới bấm Triển khai; xác nhận version tăng số trong hộp thoại kết quả + gọi API kiểm tra.

   **CÒN LẠI (chưa làm, không gấp):**
   - Data-validation dropdown màu cho các cột enum khác (như Cấp bậc/Giới tính) — mới dừng ở Cấp bậc.
   - Gộp 2 hệ thống quản lý dự án trùng lặp (`pages/projects.html` vs `tasks-manager.html`) — xem
     mục cũ bên dưới.
   - Cải thiện thêm UI mobile nếu người dùng phản hồi.
- Bài học thao tác Google Sheets qua trình duyệt tự động: click theo toạ độ pixel trên context
  menu của Sheets **rất dễ trật** (menu re-render lệch vài px giữa các lần chụp màn hình) — cách
  an toàn nhất đã kiểm chứng: dùng `find` (tìm theo text) để lấy đúng `ref` của menu item rồi click
  qua `ref`, KHÔNG click theo toạ độ khi thao tác trên Sheet thật; luôn xác nhận ô/vùng chọn qua
  formula bar (zoom vùng `[0,60,400,80]`) trước khi gõ bất cứ gì.
- Trang Dashboard Dự án (`pages/projects.html`) và trang Task Manager (`tasks-manager.html`) là
  **2 hệ thống quản lý dự án riêng, trùng chức năng** (mỗi trang có modal tạo/sửa dự án của
  riêng nó, dùng chung dữ liệu `TaskManager.getProjects()`). Về lâu dài nên cân nhắc gộp lại
  thành 1 nguồn UI duy nhất để đỡ phải đồng bộ 2 nơi mỗi khi sửa field/logic — chưa làm, chỉ mới
  đồng bộ thủ công từng lần theo yêu cầu.
- `DEFAULT_PROJECTS`/`DEFAULT_MEMBERS`... (seed data trong `task-data.js`) chưa có các field mới
  (`baseSalary`, `budget`, `client`, `investor`...) — không ảnh hưởng vì Sheet thật đã có, seed
  chỉ dùng khi Sheet rỗng/mất kết nối, nhưng nên nhớ nếu cần local-only demo đầy đủ.
- Quy đổi `type` dự án giữa 2 hệ thống (`pages/projects.html` dùng mã ngắn qua `type-card` radio,
  `tasks-manager.html` dùng nhãn tiếng Việt đầy đủ qua `<select>`) vẫn là 2 quy ước khác nhau
  ghi chung vào 1 cột `type` — đã vá để không hạ cấp dữ liệu khi sửa qua `pages/projects.html`,
  nhưng bản chất 2 quy ước khác nhau vẫn còn đó, chưa hợp nhất triệt để.
- Nếu người dùng tiếp tục phản hồi về hiệu ứng nền trang chủ (hero), xem trực tiếp
  `public/css/portal.css` phần `.hero-bg`, `.hero-particles`, `.hero-orb`, `.hero-aurora`,
  `.hero-stat-date` — đã qua rất nhiều vòng chỉnh theo yêu cầu trực tiếp, thông số hiện tại là
  kết quả cuối cùng được chấp nhận tính đến thời điểm ghi chú này.
- **Quy tắc mới từ 2026-09-08**: cứ khoảng 10–15 phút làm việc thực tế (theo đồng hồ), hoặc sau
  mỗi thao tác chỉnh sửa lớn hoàn tất, phải **cập nhật lại file ghi chú này** (mục "0. Trạng thái
  hiện tại") + **commit local** — **không tự ý push**, push vẫn phải hỏi và chờ xác nhận như bình
  thường. Mục đích chỉ là để đổi máy khác đọc lại file này là nắm được ngữ cảnh, không phải để
  tự động đẩy code lên GitHub. Xem thêm trong memory `feedback_periodic_commit_push`.

## 1. Liên kết quan trọng

| Việc | Link |
|---|---|
| Việc | Link |
|---|---|
| **GitHub repo** | **https://github.com/pqhieu3820-dotcom/Hiconique-web-noibo** |
| **Google Sheet — database chính** (chỉnh sửa trực tiếp) | **https://docs.google.com/spreadsheets/d/1usLh4pt5F7r1XY-SLbWPfajYuZ5mDNGaaa4neYG84nY/edit** |
| **Google Apps Script — editor** (sửa code `gsheets-api-v2.js` tại đây) | **https://script.google.com/u/1/home/projects/13qWJLAwWHzeH7nyfcVHlMrxwOOWAUi4X2gD7CgB2EfwQseFX30RJo_RJ/edit** |
| **Apps Script Web App — URL đang chạy thật** (client gọi `API_URL` này để ghi dữ liệu) | **https://script.google.com/macros/s/AKfycbzgg0dfNgDTFgcTGlNvF2IHLUusK6YuBk1pot9SrbYi5B9al-H2nmmMlKLz5CpDlLY/exec** |
| **Google Drive — thư mục file thiết kế/hồ sơ kỹ thuật** | **https://drive.google.com/drive/folders/1Abs32vARD3f486LWBfgIWXjKIUV-LK6L** |
| **Database đơn giá chi phí xây dựng nhà 34 tỉnh T9/2026** (tham khảo ngoài — 34 tỉnh × 432 vật tư × 219 công tác, mốc giá 01/09/2026; có cả bản PDF `DEMO_Cam_nang_don_gia_T9_2026.pdf` cùng nội dung, thêm ma trận NCC + checklist hỏi giá) | **https://docs.google.com/spreadsheets/d/1INkLZfjbfS7G9otbV4uGgQKhog0ADh8L2fnS3GTT2dM/edit?usp=drivesdk** |
| Netlify — hosting production | Chưa có URL cố định ghi trong repo (auto-deploy mỗi lần push `master`, xem Netlify dashboard của tài khoản để lấy link site + biến `SITE_PASSWORD` cho cổng đăng nhập chung (cookie-auth) — chi tiết ở [README.md](README.md)) |

**Lưu ý khi thay đổi các link trên:** nếu redeploy Apps Script ra **deployment mới** (không phải
"Phiên bản mới" trên deployment cũ) thì "Apps Script Web App — URL đang chạy thật" ở trên SẼ ĐỔI
— phải cập nhật lại `API_URL` trong `public/js/gsheets-config.js` VÀ dòng link này trong file ghi
chú, nếu không web sẽ ngừng ghi được dữ liệu.

Ghi chú:
- Web **đọc VÀ ghi** dữ liệu đều qua Apps Script Web App (`API_URL` trong
  `public/js/gsheets-config.js`, chính là link "Apps Script Web App — URL đang chạy thật" ở bảng
  trên). Đường CSV publish-to-web (biến `DATA_URLS`) đã BỎ HẲN — không còn dùng nữa.
- Source code đang chạy trên Apps Script = file `gsheets-api-v2.js` ở root repo. Sửa xong phải
  dán đè vào Apps Script rồi **Triển khai → Quản lý các tùy chọn triển khai → chọn "Phiên bản
  mới"** (không tạo deployment mới, sẽ đổi URL) — chi tiết đầy đủ ở
  [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md).

## 2. Cấu trúc dữ liệu (11 tab trong Sheet)

Tên tab thật trên Sheet đều là **tiếng Việt** (code client vẫn dùng key tiếng Anh nhờ `FIELD_MAP`):
`Thành viên`, `Dự án`, `Công việc`, `Đề xuất`, `Chấm công`, `Thông báo` (nhắc định kỳ), `Bảng tin`
(bản tin), `Tài liệu`, `Phiếu lương`, `Hoa hồng dự án`, `Mức hoa hồng`. Xem bảng đầy đủ tên cột +
key nội bộ ở [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md#cấu-trúc-spreadsheet-hiện-tại).

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

## 5. Chi tiết dự án & phân quyền (`Projects` sheet)

- Chỉ CEO/quản lý (`roleLevel` admin/manager) được tạo, sửa, xoá dự án —
  `TaskManager.createProject/updateProject/deleteProject` đều yêu cầu tham số `user` và kiểm
  tra `canManageNotifications(user)`, thành viên thường bị chặn (trả về `null`), nút "Tạo dự
  án"/"Sửa"/"Xoá" cũng bị ẩn ở giao diện cho họ.
- Form tạo/sửa dự án (ở cả trang `tasks-manager.html` mục Dự án — nơi có đầy đủ luồng sửa/xoá —
  và modal tạo nhanh trên `pages/projects.html`) có thêm các trường: Khách hàng (`client`), Tên
  nhà đầu tư (`investor`), Địa điểm (`location`), Ngày bắt đầu/kết thúc (`startDate`/`endDate`),
  Tổng số tiền (`budget`), Độ ưu tiên (`priority`), Mô tả (`description`) — tất cả đã có cột
  tương ứng trên Sheet thật và đồng bộ 2 chiều bình thường.
- Sửa/xoá dự án thực hiện được ở **cả 2 nơi** (2 hệ thống UI riêng, cùng dữ liệu): (1) trang Task
  Manager (`/pages/tasks-manager.html` → mục "Dự án" → bấm vào 1 dự án → "Sửa"/"Xoá" trong modal
  chi tiết); (2) trang Dashboard Dự án (`pages/projects.html` → bấm thẻ "Tổng dự án" → modal
  "Danh sách dự án" → nút Sửa/Xoá từng dòng, dùng lại modal tạo dự án ở chế độ chỉnh sửa). Cả 2
  đều gọi chung `TaskManager.updateProject/deleteProject` nên dữ liệu luôn nhất quán.

## 6. Phiếu lương & % Hoa hồng dự án (`payslip.html`, `commission.html`)

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

## 7. Tài liệu khác trong repo

- [README.md](README.md) — tổng quan kiến trúc, cấu trúc thư mục, cách chạy local/deploy.
- [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md) — chi tiết Google Sheets ⇄ Web, redeploy Apps Script,
  thêm sheet mới.
- [design-system/hiconique-internal-hub/MASTER.md](design-system/hiconique-internal-hub/MASTER.md)
  — source of truth cho thiết kế (màu, font, spacing...).
