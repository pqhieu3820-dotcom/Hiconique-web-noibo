# Ghi chú dự án — đọc trước khi làm việc

File này tồn tại để không phải hỏi lại các thông tin dưới đây mỗi khi đổi máy hoặc mở đoạn
chat mới với Claude. Đây là nguồn tham chiếu chính (source of truth) cho các liên kết và quy
tắc làm việc của dự án **HICONIQUE Internal Hub**.

## 0. Trạng thái hiện tại (cập nhật lần cuối: 2026-09-08, cuối buổi — SẮP CHUYỂN MÁY, đọc kỹ mục này)

**Kiến trúc tóm tắt:** Web tĩnh (HTML/CSS/JS thuần, không framework) trong `public/`, chạy local
qua Node/Express (`server.js`), deploy Netlify cho production. Dữ liệu sống trên 1 Google Sheet
(11 tab) — web đọc qua CSV publish-to-web (sheet cũ) hoặc trực tiếp qua Apps Script Web App JSON
(3 sheet mới nhất — xem mục 6), ghi luôn qua Apps Script Web App (`gsheets-api-v2.js`, deploy tại
link ở mục 1). Lớp dữ liệu client (`public/js/task-data.js`, biến global `TaskManager`) là nguồn
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
8. **CÒN SÓT LẠI CHƯA LÀM XONG (làm tiếp ở phiên sau):**
   - **Chưa xoá 3 sheet tiếng Anh dư thừa** (`CommissionRates`, `Commissions`, `Payslips`) — đây là
     3 sheet cũ bị `getOrCreateSheet()` tự tạo lại (từ trước khi đổi tên tiếng Việt, code cũ tìm
     sheet theo tên Anh không thấy nên tự tạo mới). Code hiện tại đã trỏ đúng sang sheet tiếng Việt
     (`Phiếu lương`, `Hoa hồng dự án`, `Mức hoa hồng`) nên 3 sheet Anh này **an toàn để xoá** (chỉ
     cần xác nhận trống/không có dữ liệu quan trọng trước khi xoá — nhìn sơ bộ lúc nãy có vẻ trống
     hoặc chỉ có dữ liệu cũ). Xoá bằng cách click chuột phải vào tên tab ở cuối màn hình Google
     Sheet → Xoá. Lưu ý: bấm theo toạ độ pixel vào thanh tab sheet **rất hay trật** trong phiên này
     (client toạ độ bị lệch khi chụp màn hình không đồng bộ) — nên dùng `read_page`/`find` lấy đúng
     `ref` của tab rồi bấm qua ref, tương tự cách đã làm ổn với menu Apps Script.
   - Có vài mã thành viên lạ `"A7"` xuất hiện rải rác trong Tasks/Projects (assigneeId, members
     list...) — đây là dữ liệu lỗi **có từ trước phiên này** (không phải do các thao tác đổi ID vừa
     rồi gây ra), chưa rõ nguồn gốc, chưa xử lý — có thể cần hỏi người dùng xem "A7" là ai/lỗi gõ
     nhầm từ khi nào.
   - Chưa làm phần data-validation dropdown cho các cột khác theo yêu cầu "bổ sung trình duyệt ấn
     thả... cố định những dữ liệu fix" (người dùng muốn thêm dropdown màu như cột Cấp bậc/Giới tính
     cho các cột enum khác) — mới dừng ở bước xem cột Cấp bậc, chưa mở rộng sang cột khác.
   - Chưa bắt đầu: cải thiện thêm UI mobile ngoài phần đã làm ở mục 5 (nếu người dùng phản hồi cần
     thêm), gộp 2 hệ thống quản lý dự án trùng lặp (xem mục cũ bên dưới).

**Trước khi làm tiếp phiên sau, đọc `SETUP_HUONG_DAN.md` mục "Cấu trúc Spreadsheet" đã lỗi thời
(vẫn ghi tên cột tiếng Anh) — cần cập nhật lại theo tên tiếng Việt mới, chưa làm.**
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
| Netlify — hosting production | Chưa có URL cố định ghi trong repo (auto-deploy mỗi lần push `master`, xem Netlify dashboard của tài khoản để lấy link site + biến `AUTH_USERS` cho Basic Auth — chi tiết ở [README.md](README.md)) |

**Lưu ý khi thay đổi các link trên:** nếu redeploy Apps Script ra **deployment mới** (không phải
"Phiên bản mới" trên deployment cũ) thì "Apps Script Web App — URL đang chạy thật" ở trên SẼ ĐỔI
— phải cập nhật lại `API_URL` trong `public/js/gsheets-config.js` VÀ dòng link này trong file ghi
chú, nếu không web sẽ ngừng ghi được dữ liệu.

Ghi chú:
- Web **đọc** dữ liệu qua CSV publish-to-web (URL trong `public/js/gsheets-config.js`,
  `DATA_URLS`) và **ghi** dữ liệu qua Apps Script Web App (`API_URL` cùng file, chính là link
  "Apps Script Web App — URL đang chạy thật" ở bảng trên). Cả hai đều trỏ vào chính Google Sheet
  ở trên — chỉ khác dạng ID (ID chỉnh sửa vs. ID publish-to-web).
- Source code đang chạy trên Apps Script = file `gsheets-api-v2.js` ở root repo. Sửa xong phải
  dán đè vào Apps Script rồi **Triển khai → Quản lý các tùy chọn triển khai → chọn "Phiên bản
  mới"** (không tạo deployment mới, sẽ đổi URL) — chi tiết đầy đủ ở
  [SETUP_HUONG_DAN.md](SETUP_HUONG_DAN.md).

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
