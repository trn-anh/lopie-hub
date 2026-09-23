# Lịch Họp Nhóm (Google Apps Script)

Mã nguồn web app đặt lịch họp của CLB, chạy trên Google Apps Script và lưu dữ liệu vào Google Sheet.
Thư mục này **không phải** một trang của hub, chỉ để lưu mã và lịch sử sửa.

| File | Dán vào đâu trong Apps Script |
|---|---|
| `Code.gs` | File `Code.gs` (phía máy chủ) |
| `Index.html` | File `Index` (giao diện) |

## Cập nhật bản đang chạy

1. Mở dự án Apps Script, dán đè toàn bộ nội dung `Code.gs` và `Index.html`.
2. Chọn **Triển khai → Quản lý triển khai**. Chọn **đúng triển khai có URL trùng `WEBAPP_URL`**, là URL đã khai trong `setOAuthCredentials`. Chạy `kiemTraCauHinh()` nếu không nhớ.
3. Bấm **✏️ Sửa → Phiên bản: Phiên bản mới → Triển khai**. URL `/exec` giữ nguyên, không cần cấu hình lại OAuth.
4. Kiểm tra: mở app, bấm ảnh đại diện góc phải. Dòng cuối menu phải ghi **Phiên bản 3.5**.

> **Vì sao phải đúng triển khai:** đăng nhập Google xong luôn quay về `WEBAPP_URL`.
> Nếu cập nhật nhầm triển khai khác, hoặc chỉ thử bằng link `/dev`, thì lúc đăng nhập lại sẽ rơi về giao diện cũ.
> Phần lấy ảnh Google chạy trong bước đăng nhập, nên cũng không có tác dụng.

> **Bảo mật:** hàm `napCauHinh()` trong repo để trống, vì client secret thật đã nằm trong Script Properties.
> Không commit client secret lên GitHub.

## Dùng cho HCMUTE (bản 3.5)

Vào **Quản trị → Phòng họp → Thêm hàng loạt**. Hộp thoại có 3 tab:

| Tab | Việc làm |
|---|---|
| Địa điểm HCMUTE | Nạp 8 địa điểm có tên trên sơ đồ và bảng sân GDTC: Hội trường lớn, Nhà mái vòm khu A, Nhà tập khu E, Sân quần vợt khu E, Sân bóng đá, Hội trường CS2, Sân bóng CS2, Sân cầu lông CS2. Có tuỳ chọn tạm ngưng 4 phòng mẫu của app. |
| Tạo dãy phòng | Chọn khu theo sơ đồ, nhập số tầng và số phòng mỗi tầng. VD Khu A4, tầng 1–5, 10 phòng/tầng tạo ra A4-101 … A4-510. Xem trước trước khi tạo. |
| Dán danh sách | Dán từ Excel hoặc Google Sheets, mỗi dòng một phòng: `Mã phòng · Sức chứa · Khu · Thiết bị`. Chỉ cần cột đầu. |

- **Nguồn:** chú thích "Bản đồ hiện trạng" cơ sở 1 (1 Võ Văn Ngân: khu A1–A5, khối B, C, D, E0–E4, F1, G), cơ sở 2 (Lê Văn Việt: khối V 9 tầng…), và bảng phân bố sân GDTC HK1 2024–2025.
- **Giới hạn:** sơ đồ không ghi số phòng, số tầng (trừ khối V) và sức chứa, nên app không tự bịa số phòng.
  - Số tầng, số phòng mỗi tầng cần kiểm tra với trường.
  - Sức chứa để trống nghĩa là "chưa rõ"; phòng như vậy không bị cảnh báo quá chỗ.
- Mã phòng đã có thì được bỏ qua, không ghi đè.
- Nhiều phòng vẫn dễ xem:
  - Chọn khu, tìm phòng, "Ẩn phòng trống" trên thanh công cụ.
  - Lọc khu bên trái gom theo cơ sở, có nút "chỉ" để xem riêng một khu, lựa chọn được nhớ lại.
  - Tiêu đề cột một dòng; chú thích và mẹo gom vào nút ⓘ.

## Tính năng chính (bản 3.3–3.4)

- **Kéo thả như Google Calendar** (chuột hoặc bút):
  - Lịch ngày: kéo khối để đổi giờ hoặc sang phòng khác; kéo mép dưới để đổi giờ kết thúc.
  - Lịch tuần: kéo thẻ sang ngày khác.
  - Khi đang kéo, khung xem trước báo đỏ nếu vị trí mới bị trùng. Dời xong có nút **Hoàn tác**.
  - Chỉ người tạo, chủ trì hoặc quản trị viên được kéo. Trên điện thoại vẫn dời bằng nút "Sửa".
- **Chọn giờ dạng 24h**, bước 15 phút, chỉ có giờ trong khung cho phép.
  - Hết nhầm sáng/chiều: gõ "12:30" lên một giờ buổi sáng không còn thành 00:30.
  - Giờ đang bận được ghi ngay trong danh sách ("· phòng bận", "· chủ trì bận").
  - Lỗi hiện ngay dưới hàng ngày/giờ/phòng, kèm nút gợi ý giờ trống gần nhất hoặc phòng khác.
- **Chèn tài liệu** trong một khung, có 3 tab:
  - *Tải lên*: kéo thả, chọn nhiều tệp; tệp tự lưu vào thư mục Drive "Lich Hop Nhom — Tai lieu".
  - *Dán link*.
  - *Đã dùng gần đây*: lấy lại tài liệu đã gắn ở cuộc họp khác.
- **Ảnh đại diện**: chọn ảnh Google, ảnh tự chọn hoặc chữ viết tắt.
  - Ảnh tự chọn được tự cắt vuông và thu nhỏ còn 256px, nên ảnh điện thoại vài MB vẫn dùng được.
  - Ảnh Google lấy lúc đăng nhập. id_token của Google không bảo đảm có ảnh, nên thiếu thì app hỏi thêm userinfo (bản 3.4).
    Nhật ký ghi "Đăng nhập · có ảnh Google" hoặc "Google không trả ảnh đại diện".
- **Giờ đã qua** trong lịch ngày được tô sọc xám phía trên đường đỏ và không đặt lịch được. Đường đỏ cập nhật mỗi 30 giây.
- **Cuộc họp đã báo vắng** hiện gạch ngang trên lịch.

## Quy tắc trùng lịch (từ bản 3.2)

| Trường hợp | Khi đặt hoặc sửa lịch | Trên lịch |
|---|---|---|
| Cùng phòng thật, giao giờ | Chặn lưu (như cũ) | Báo đỏ "Trùng phòng" |
| Chủ trì hoặc thư ký đã có lịch khác cùng giờ | **Chặn lưu (mới)** | Báo đỏ "Trùng người" |
| Thành viên đã có lịch khác cùng giờ | Chỉ nhắc, vẫn lưu được | Báo đỏ "Trùng người" |

- Phòng Online không tính trùng phòng.
- Ai đã báo "Vắng" ở một cuộc họp thì không bị tính trùng ở cuộc họp đó.
- Kéo dài giờ kết thúc của cuộc họp đang diễn ra thì được. Dời ngày hoặc giờ bắt đầu về thời điểm đã qua thì vẫn bị chặn.
- Lịch cũ đã lỡ bị trùng cũng được báo đỏ ở mọi màn hình: lịch ngày, tuần, bảng tuần, phòng họp, cuộc họp của tôi, lịch nhỏ và panel chi tiết.
