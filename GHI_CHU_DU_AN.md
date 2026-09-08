# Ghi chú dự án — đọc trước khi làm việc

File này tồn tại để không phải hỏi lại các thông tin dưới đây mỗi khi đổi máy hoặc mở đoạn
chat mới với Claude. Đây là nguồn tham chiếu chính (source of truth) cho các liên kết và quy
tắc làm việc của dự án **HICONIQUE Internal Hub**.

## 0. Trạng thái hiện tại (cập nhật lần cuối: 2026-09-09 — fix SĐT mất số 0 + lệch ngày sinh, đọc kỹ mục này)

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

## 0b. Trạng thái phiên trước (2026-09-09 — chống chấm công hộ bằng Device ID, vẫn còn đúng)

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

## 0c. Trạng thái phiên trước (2026-09-09, đổi cổng đăng nhập sang cookie-auth — vẫn còn đúng)

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

## 0d. Trạng thái trước đó (2026-09-08, buổi tối — đã KHÔI PHỤC kết nối Sheet, vẫn còn đúng, đọc nếu cần)

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
