# Lịch Họp Nhóm (Google Apps Script)

Mã nguồn web app đặt lịch họp của CLB, chạy trên Google Apps Script và lưu dữ liệu vào Google Sheet.
Thư mục này **không phải** một trang của hub, chỉ để lưu mã và lịch sử sửa.

| File | Dán vào đâu trong Apps Script |
|---|---|
| `Code.gs` | File `Code.gs` (phía máy chủ) |
| `Index.html` | File `Index` (giao diện) |

## Cập nhật bản đang chạy

1. Mở dự án Apps Script, dán đè toàn bộ nội dung `Code.gs` và `Index.html`.
2. Chọn **Triển khai → Quản lý triển khai → ✏️ Sửa → Phiên bản: Phiên bản mới → Triển khai**.
3. URL `/exec` giữ nguyên, không cần cấu hình lại OAuth.

> **Bảo mật:** hàm `napCauHinh()` trong repo để trống, vì client secret thật đã nằm trong Script Properties.
> Không commit client secret lên GitHub.

## Quy tắc trùng lịch (từ bản 3.2)

| Trường hợp | Khi đặt hoặc sửa lịch | Trên lịch |
|---|---|---|
| Cùng phòng thật, giao giờ | Chặn lưu (như cũ) | Báo đỏ "Trùng phòng" |
| Chủ trì hoặc thư ký đã có lịch khác cùng giờ | **Chặn lưu (mới)** | Báo đỏ "Trùng người" |
| Thành viên đã có lịch khác cùng giờ | Chỉ nhắc, vẫn lưu được | Báo đỏ "Trùng người" |

- Phòng Online không tính trùng phòng.
- Ai đã báo "Vắng" ở một cuộc họp thì không bị tính trùng ở cuộc họp đó.
- Lịch cũ đã lỡ bị trùng cũng được báo đỏ ở mọi màn hình: lịch ngày, tuần, bảng tuần, phòng họp, cuộc họp của tôi, lịch nhỏ và panel chi tiết.
