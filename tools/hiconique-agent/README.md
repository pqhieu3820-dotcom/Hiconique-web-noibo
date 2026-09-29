# HICONIQUE Agent (v2.0.2 — PyQt5, 5 mục, khay hệ thống)

Một ứng dụng Windows duy nhất (1 file .exe), cửa sổ co kéo được, thanh điều hướng bên trái gồm 5 mục theo đúng thứ tự:

1. **Kiểm soát dữ liệu thao tác** — bật/tạm dừng ghi nhận, xem ứng dụng đã dùng hôm nay (bảng, không phải chỉ số), mở file dữ liệu, gửi ngay lên Hub.
2. **Thông số linh kiện máy tính** — quét CPU/mainboard/RAM/ổ cứng/card đồ họa/màn hình/pin/bảo mật/card mạng/diệt virus, hiển thị đầy đủ ngay trong app; nút **"Cập nhật lên web"** đẩy ngay lên trang Thiết bị (bình thường app tự gửi mỗi 24 giờ).
3. **Convert Ảnh ↔ SketchUp Material (.skm)** — 3 tab con: Ảnh → SKM, SKM → Ảnh, Cập nhật Thumbnail. Kéo-thả file/thư mục trực tiếp vào danh sách.
4. **Lấy màu (Pick Color)** — trích màu từ ảnh/màn hình (kính lúp, trích hàng loạt), quản lý danh sách màu (nhập/xuất Excel), canvas đặt chữ có snap, xuất ảnh/Excel hàng loạt.
5. **Hẹn giờ tắt máy** — đặt giờ/phút, đếm ngược, hủy bất cứ lúc nào.

**Đóng cửa sổ (nút X) chỉ ẩn xuống khay hệ thống** — app vẫn chạy nền (vẫn ghi nhận thao tác, vẫn báo phần cứng, vẫn tự cập nhật). Chuột phải icon khay > **Thoát** mới tắt hẳn. Bấm icon khay (hoặc icon Desktop lần nữa) để mở lại cửa sổ.

## Vì sao đổi từ Tkinter (v1.x) sang PyQt5
Công cụ Pick Color vốn viết bằng PyQt5 với canvas kéo-thả/snap phức tạp — không thể nhúng chung 1 cửa sổ với app Tkinter cũ. Để có **1 app thật sự, có tab**, toàn bộ app được viết lại bằng PyQt5 (giữ nguyên logic xử lý của cả 3 công cụ, chỉ đổi lớp giao diện). Đánh đổi: file cài đặt tăng từ ~12MB (Tkinter) lên **~67MB** (đóng gói thêm PyQt5, pandas, openpyxl cho tính năng Excel của Pick Color).

`agent.py` (Tkinter, v1.0.2) không còn được build nữa, giữ lại chỉ để tham khảo lịch sử.

## Ghi gì / không ghi gì (tab 1 + tab 2)
| Có | Không |
|---|---|
| Tên ứng dụng, tiêu đề cửa sổ đang mở (trong giờ làm việc) | Chụp màn hình, phím gõ, clipboard |
| Cấu hình phần cứng máy (CPU/RAM/ổ cứng/pin...) | Nội dung file, tin nhắn, mật khẩu, camera, micro |
| Chỉ trong giờ làm việc đã cấu hình | Ngoài giờ làm việc (trừ quét phần cứng, không phụ thuộc giờ) |

Cửa sổ ẩn danh/riêng tư bị che tiêu đề. Nhân viên tích đồng ý khi cài, đọc được dữ liệu của mình ở `%LOCALAPPDATA%\HiconiqueAgent\hoat-dong-hom-nay.txt`, và tự tạm dừng ghi nhận bất cứ lúc nào ở tab 1.

## Cài cho nhân viên
Tải ở trang **Theo dõi hiệu suất** của Hub, hoặc trực tiếp `https://github.com/pqhieu3820-dotcom/Hiconique-web-noibo/releases/latest/download/HiconiqueAgentSetup.exe`. Bấm 2 lần → chọn tên → tích đồng ý → **Cài đặt**. Ứng dụng mở ngay sau khi cài, tạo icon **"HICONIQUE Agent"** trên Desktop, tự khởi động cùng Windows (ẩn xuống khay) từ lần sau.

**Vì sao tải từ GitHub Releases chứ không phải từ web Hub trực tiếp:** Cloudflare Pages (chỗ host web Hub) giới hạn **25MB mỗi file tĩnh**. File cài đặt PyQt5 (~67MB) vượt giới hạn này, nên chỉ `latest.json` (vài KB) ở Cloudflare — bản thân file `.exe` được đăng lên **GitHub Releases** (giới hạn tới 2GB/file, miễn phí). Link `releases/latest/download/...` luôn tự trỏ tới bản mới nhất, không cần đổi link mỗi lần phát hành.
- Windows SmartScreen có thể cảnh báo "unknown publisher" (chưa ký số) → *More info > Run anyway*.
- Diệt virus (Kaspersky…) có thể báo nhầm "PDM:Trojan.Win32.Generic" — đây là **false positive theo hành vi** của exe PyInstaller chưa ký số, không phải virus thật (mã nguồn nằm trong `app.py`/`hardware.py`). Xử lý: thêm ngoại lệ, gửi xác minh tại https://opentip.kaspersky.com, hoặc mua chữ ký số (code signing) để hết cả hai loại cảnh báo.
- Gỡ: chuột phải icon khay hoặc Cài đặt Windows > Ứng dụng > **HICONIQUE Agent** > Gỡ cài đặt.

## Phát hành bản cập nhật
1. Sửa `app.py`, tăng `VERSION`, thêm mục mới (đầu danh sách) vào `CHANGELOG.json`.
2. `pip install -r requirements.txt` (lần đầu) rồi `python build.py` → build .exe, **tự đăng lên GitHub Release** `agent-v<version>` (dùng token GitHub đã đăng nhập sẵn qua Git Credential Manager — cần đã `git push` ít nhất 1 lần trước đó), rồi ghi `public/agent/latest.json` (chỉ vài KB). Build + tải lên mất vài phút.
3. `git add -A && git commit && git push` (chỉ đẩy `latest.json`, không đẩy file .exe lên Cloudflare). Các máy đã cài kiểm tra `latest.json` mỗi 6 giờ, tải bản mới từ GitHub Releases, kiểm SHA-256, thay file rồi tự khởi động lại. Chỉ nhận URL từ `hiconique-web-noibo.pqhieu3820.workers.dev` hoặc `github.com/pqhieu3820-dotcom/Hiconique-web-noibo/releases/` (xem `ALLOWED_UPDATE_HOSTS` trong `app.py`).

## Icon
`icon.ico` + `logo.png` do `make_icon.py` tạo từ `public/icon-512.png` — CHÍNH icon app đang dùng trên điện thoại (logo trắng trên nền gradient đen-xám-xanh), bo góc. Dùng cho file exe, cửa sổ (taskbar/title bar), icon khay hệ thống, shortcut Desktop và logo trên thanh tiêu đề trong app. Đổi icon web thì chạy lại `python make_icon.py` rồi build lại. Icon sáng/tối trong app (mặt trời vàng đồng / mặt trăng xanh) vẽ bằng SVG cùng nét với icon trên web.

## Tự cập nhật (đã kiểm thử)
Nút **Kiểm tra cập nhật** (và tự động mỗi 6 giờ): đọc `latest.json` trên web → nếu có bản mới thì tự tải từ GitHub Releases (hiện % tiến trình), kiểm SHA-256, đổi tên exe đang chạy thành `.old`, ghi bản mới vào đúng đường dẫn cũ, rồi tự khởi động lại (làm mới luôn thông tin phiên bản trong Cài đặt Windows và icon Desktop). Bản mới hỏng giữa chừng thì tự khôi phục bản cũ.
**Lưu ý quan trọng:** Cloudflare (host web Hub) chặn 403 (mã 1010) mọi yêu cầu mang User-Agent mặc định `Python-urllib` — mọi lời gọi tới `hiconique-web-noibo.pqhieu3820.workers.dev` phải qua `http_open()` (có User-Agent riêng). Các bản Agent ≤ 2.0.1 vì lỗi này KHÔNG tự cập nhật được — cài tay bản 2.0.2 một lần, từ đó tự cập nhật bình thường.

## Kiến trúc (app.py, ~3000 dòng)
- **Nền chia sẻ**: `Shared` (cấu hình + dữ liệu hôm nay) + `BackgroundWorker` (QThread) — ghi nhận ứng dụng, gửi lên Hub, báo phần cứng, tự kiểm tra cập nhật; chạy độc lập với cửa sổ ẩn/hiện.
- **MainWindow**: QTabWidget 5 tab + `QSystemTrayIcon` (khay) + `QLocalServer`/`QLocalSocket` (đảm bảo chỉ 1 cửa sổ, lần mở thứ 2 tự đưa cửa sổ cũ lên trước thay vì mở trùng).
- **Tab 3** (`Skm*` — hàm `skm_*`): logic y hệt `Convert_JPEG_sang_SKM.py` gốc, chỉ đổi UI Tkinter → Qt (kéo-thả dùng `QListWidget` override `dragEnterEvent`/`dropEvent`, thay cho `tkinterdnd2`).
- **Tab 4** (`ColorPickerPanel`, các lớp `Cp*`): port gần như nguyên vẹn từ `Picker Point Color.py` (đổi `ColorApp(QMainWindow)` → `QWidget` để nhúng làm tab; bỏ đoạn tự `pip install` lúc chạy vì đã đóng gói sẵn; nơi lưu `colors_data.json` chuyển vào `%LOCALAPPDATA%\HiconiqueAgent`).
- **Tab 5**: port `Tự động tắt máy tính.py`, dùng `QSpinBox`/`QTimer` thay `tkinter.Entry`/`root.after`.

## Giới hạn đã biết
- Chưa có ký số — Windows/diệt virus còn cảnh báo (xem trên).
- File cài đặt nặng (~67MB) do PyQt5 + pandas + openpyxl.
- Việc kiểm tra giao diện (bố cục, màu sắc, độ "đẹp") được làm bằng cách dựng thử toàn bộ cửa sổ và các luồng nền (không lỗi, quét phần cứng chạy đúng ~15-20s, IPC mở-lại-cửa-sổ chạy đúng) — nhưng **chưa xem trực tiếp giao diện thật trên màn hình**, vì công cụ hiện có chỉ lái được trình duyệt web, không chụp được cửa sổ ứng dụng Windows gốc. Hãy tự chạy `dist/HiconiqueAgent.exe` (hoặc bản đã cài) và báo lại nếu có chỗ cần chỉnh bố cục/màu sắc.

## Phát triển
`python app.py` chạy trực tiếp từ mã nguồn (cần `pip install PyQt5 pandas openpyxl`, `hardware.py` cùng thư mục), mở thẳng MainWindow không qua bước cài đặt.
