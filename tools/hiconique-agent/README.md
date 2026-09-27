# HICONIQUE Agent

Công cụ chạy nền trên **máy tính công ty** (Windows), ghi nhận ứng dụng đang dùng trong giờ làm việc và gửi lên Google Sheet `NS-Ứng dụng`. Xem kết quả ở trang **Theo dõi hiệu suất** của Hub (bấm vào một nhân viên).

## Ghi gì / không ghi gì
| Có | Không |
|---|---|
| Tên ứng dụng phía trước (chrome, excel, autocad…) | Chụp màn hình |
| Tiêu đề cửa sổ (tắt được bằng `sendTitles: false`) | Phím gõ, clipboard |
| Phút không thao tác (chuột/phím) — chỉ đếm, không ghi gì thêm | Nội dung file, tin nhắn, mật khẩu |
| Chỉ trong giờ làm việc (`workHours`, `workDays`) | Camera, micro, vị trí |

Cửa sổ ẩn danh/riêng tư hoặc có chữ "mật khẩu/password" trong tiêu đề được thay bằng `(cửa sổ riêng tư)`.

Nhân viên **được thông báo** khi agent khởi động, và đọc được toàn bộ dữ liệu của mình ở `%LOCALAPPDATA%\HiconiqueAgent\hoat-dong-hom-nay.txt`. **Chỉ cài trên máy của công ty, có sự đồng ý của người dùng** (nên ghi vào nội quy / thỏa thuận sử dụng thiết bị). Không dùng để chạy ẩn.

## Cài đặt (mỗi máy ~3 phút)
1. Cài Python 3 từ python.org (tick "Add to PATH"). Không cần cài thêm thư viện.
2. Sao chép thư mục `hiconique-agent` vào máy, ví dụ `C:\HiconiqueAgent`.
3. Sao chép `config.example.json` → `config.json`, điền `memberId` (mã thành viên trên Hub, xem sheet `NS-Thành viên`).
4. Chạy `cai-dat.bat`. Agent chạy nền và tự khởi động cùng Windows.
5. Thử nhanh: `python agent.py --once` in ra dữ liệu đang ghi.

Gỡ: chạy `go-cai-dat.bat`.

## Cách hoạt động
- Mỗi 15 giây: nếu có thao tác chuột/phím trong 2 phút gần nhất thì cộng 15 giây cho ứng dụng đang ở phía trước; nếu không thì cộng vào "không thao tác".
- Mỗi 5 phút gửi tổng cộng dồn trong ngày lên Sheet (mỗi ứng dụng/ngày/máy một dòng, cập nhật lại thay vì thêm dòng).
- Mất mạng thì giữ dữ liệu trên máy và gửi lại sau.
- Trang Hub chỉ hiển thị cho quản lý và cho chính nhân viên đó.

## Lưu ý
- Số liệu là tham khảo để trao đổi, không phải bằng chứng lười biếng: xem ứng dụng thiết kế lâu là bình thường, đọc tài liệu/họp thì không có thao tác.
- Cần deploy Apps Script phiên bản có action `upsertAppUsage` trước khi chạy agent.
