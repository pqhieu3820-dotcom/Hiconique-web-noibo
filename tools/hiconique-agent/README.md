# HICONIQUE Agent (ứng dụng Windows, 1 file .exe)

Chạy nền trên **máy tính công ty**, ghi nhận ứng dụng đang dùng trong giờ làm việc → sheet `NS-Ứng dụng` → xem ở Hub > Theo dõi hiệu suất. Tự cài, tự khởi động cùng Windows, **tự cập nhật online**, gỡ như ứng dụng thường.

## Ghi gì / không ghi gì
| Có | Không |
|---|---|
| Tên ứng dụng phía trước, tiêu đề cửa sổ (tắt bằng `sendTitles:false`) | Chụp màn hình, phím gõ, clipboard |
| Phút không thao tác (chỉ đếm) | Nội dung file, tin nhắn, mật khẩu, camera, micro |
| Chỉ trong giờ làm việc (mặc định 07:30–18:00, T2–T7) | Ngoài giờ làm việc |

Cửa sổ ẩn danh / có chữ "mật khẩu/password" được che thành `(cửa sổ riêng tư)`. Nhân viên phải tích đồng ý khi cài, được thông báo mỗi ngày, và đọc được dữ liệu của mình ở `%LOCALAPPDATA%\HiconiqueAgent\hoat-dong-hom-nay.txt`.

## Cài cho nhân viên
Gửi file `HiconiqueAgentSetup.exe` (tải ở `https://hiconique-web-noibo.pqhieu3820.workers.dev/agent/HiconiqueAgentSetup.exe`), bấm 2 lần → chọn tên → tích đồng ý → **Cài đặt**. Xong. Không cần cài Python.
- Windows SmartScreen có thể cảnh báo "unknown publisher" vì file chưa ký số → bấm *More info > Run anyway*. Phần mềm diệt virus đôi khi cũng nghi ngờ file đóng gói bằng PyInstaller: thêm ngoại lệ, hoặc mua chứng chỉ ký mã (code signing) để hết cảnh báo.
- Gỡ: Cài đặt Windows > Ứng dụng > **HICONIQUE Agent** > Gỡ cài đặt.

## Phát hành bản cập nhật
1. Sửa `agent.py`, tăng `VERSION`, thêm mục mới (đầu danh sách) vào `CHANGELOG.json` — nội dung hiện ở trang Theo dõi hiệu suất.
2. `python build.py` (cần `pip install pyinstaller`) → tạo `public/agent/HiconiqueAgentSetup.exe` + `latest.json` (có SHA-256).
3. Commit + push. Các máy đã cài kiểm tra `latest.json` mỗi 6 giờ (và khi khởi động), tải bản mới, **kiểm SHA-256**, thay file rồi tự chạy lại. Chỉ tải từ `hiconique-web-noibo.pqhieu3820.workers.dev` (https).

Bảo mật: ai điều khiển được repo/host này thì đẩy được mã chạy lên mọi máy đã cài → giữ tài khoản GitHub/Cloudflare có 2FA. Có thể nâng cấp bằng ký số bản cập nhật nếu cần.

## Cấu hình (không bắt buộc)
`%LOCALAPPDATA%\HiconiqueAgent\config.json`: `memberId`, `workHours`, `workDays`, `sendTitles`. Nhật ký lỗi: `agent.log` cùng thư mục.

## Phát triển
`python agent.py --once` (cần `config.json` cạnh `agent.py` hoặc trong thư mục dữ liệu) ghi 1 lần và in ra.
