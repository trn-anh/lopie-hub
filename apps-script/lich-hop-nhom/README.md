# Lịch Họp Nhóm (Google Apps Script)

Mã nguồn web app đặt lịch họp của CLB, chạy trên Google Apps Script và lưu dữ liệu vào Google Sheet.
Thư mục này **không phải** một trang của hub, chỉ để lưu mã và lịch sử sửa.

| File | Dán vào đâu trong Apps Script |
|---|---|
| `Code.gs` | File `Code.gs` (phía máy chủ) |
| `Index.html` | File `Index` (giao diện) |

## Cập nhật bản đang chạy

Làm đủ 4 bước mỗi lần dán code mới. Chỉ dán code mà bỏ bước 2–3 thì **link chính vẫn chạy bản cũ**.

1. Mở dự án Apps Script, dán đè toàn bộ nội dung `Code.gs` và `Index.html`, bấm Lưu.
2. Chọn **Triển khai (Deploy) → Quản lý triển khai (Manage deployments)**. Chọn triển khai có **Mã triển khai (Deployment ID) trùng mã in ở dòng "Mã triển khai link chính"** của `kiemTraCauHinh()`.
3. Bấm **bút chì (Edit) → Phiên bản (Version): Phiên bản mới (New version) → Triển khai (Deploy)**. Link `/exec` giữ nguyên, không cần cấu hình lại OAuth.
4. Chạy `kiemTraCauHinh()`: dòng **Link chính đang chạy** phải có dấu ✓. Hoặc mở app: chân trang đăng nhập và dòng cuối menu tài khoản ghi **Phiên bản 3.7**.

> **Vì sao đăng xuất rồi đăng nhập lại thì thấy giao diện cũ:**
> - Link thử (Test deployments, đuôi `/dev`) luôn chạy code mới nhất, nhưng chỉ chủ dự án mở được.
> - Link chính (đuôi `/exec`) chỉ chạy phiên bản đã chọn trong "Quản lý triển khai".
> - Đăng nhập Google xong luôn quay về link chính. Nếu link chính chưa được cập nhật, sau khi đăng nhập bạn và mọi người đều thấy bản cũ.
>
> Không bấm "Triển khai mới" (New deployment): nó tạo ra link khác, còn đăng nhập vẫn quay về link cũ.
>
> Từ bản 3.7:
> - Nếu link chính còn chạy bản cũ, quản trị viên thấy **thanh cảnh báo màu cam** ngay trong app, kèm nút **Cách cập nhật** và **Kiểm tra lại**.
> - Máy chủ tự hỏi link chính đang chạy bản nào, bằng cách gọi link đó với `?lhn_probe=1`.

> **Bảo mật:** hàm `napCauHinh()` trong repo để trống, vì client secret thật đã nằm trong Script Properties.
> Không commit client secret lên GitHub.

## Bản 3.7: link chính và giao diện gọn hơn

- **Tự kiểm tra link chính.** Quản trị viên được báo khi link `/exec` còn chạy bản cũ. `kiemTraCauHinh()` in "Link chính đang chạy" và "Mã triển khai link chính".
- Chân trang đăng nhập ghi số phiên bản, để biết ngay đang mở bản nào.
- **Cột trái:** lịch nhỏ nằm ngay dưới menu. Bộ lọc khu xuống dưới cùng; khi trường có hơn 10 khu, các nhóm cơ sở thu gọn, bấm để mở. App nhớ nhóm nào đang mở.
- **Lọc khu nhất quán:**
  - Đang lọc thì phòng tạm ngưng thuộc khu không có ô lọc (VD Phòng họp 1, 2 cũ) không còn lẫn vào lịch.
  - Có cuộc họp ở khu bị ẩn thì thanh công cụ báo **"+N cuộc họp ở khu khác"**, bấm để xem tất cả khu.
- Rê chuột lên giờ đã qua không còn khung đỏ "Đã qua", chỉ đổi con trỏ.
- Trên điện thoại, đầu cột lịch ngày chỉ giữ tên phòng.

## Bản 3.6: nhận diện HCM-UTE

- **Trang đăng nhập theo bố cục cổng thông tin của trường:**
  - Nền xám, logo HCM-UTE, tên trường viết hoa, thẻ trắng "ĐĂNG NHẬP", chân trang.
  - Chỉ còn một nút **Đăng nhập với Google Giảng viên**. Đây là nhãn cho bản demo: tài khoản Google nào cũng đăng nhập được, người mới vẫn phải gửi yêu cầu để quản trị viên duyệt.
  - Không có ô tên đăng nhập hay mật khẩu; app chỉ dùng đăng nhập Google.
  - Trang không còn hiện lịch họp trong ngày trước khi đăng nhập. Máy chủ chỉ trả tên app, tên trường, tên tổ chức.
  - Màn hình đăng ký, chờ duyệt, báo lỗi dùng chung khung này. Có thêm nút **Đăng nhập bằng tài khoản khác** khi lỡ chọn nhầm tài khoản.
- **Tên trường** là cài đặt mới (Quản trị → Cài đặt → Tên trường). Mặc định "Trường Đại học Công nghệ Kỹ thuật TP.HCM".
  - Hiện ở trang đăng nhập.
  - Thanh trên cùng hiện tên rút gọn "ĐH Công nghệ Kỹ thuật TP.HCM".
  - Hiện ở đầu bảng lịch tuần khi in.
- **Chữ:** dùng Segoe UI (phông hệ thống của Windows), bỏ tải phông Inter từ Google Fonts.
  - Máy Mac và điện thoại tự dùng phông hệ thống tương đương.
  - Tiêu đề màu xanh đậm; nhãn mục nhỏ viết hoa (VD "CƠ SỞ 1 · VÕ VĂN NGÂN").
  - Độ đậm chỉ dùng 400 / 600 / 700, nên hiển thị giống nhau trên mọi máy.
- **Ảnh đại diện:** bỏ lựa chọn ảnh tài khoản Google. Chỉ còn ảnh tự tải lên hoặc chữ viết tắt; ảnh Google cũ trong sheet không còn được dùng.

## Phòng HCMUTE (bản 3.5–3.6)

**Tự nạp (từ bản 3.6).** Lần đầu có người mở app sau khi cập nhật, máy chủ tự thêm phòng theo sơ đồ trường, đúng một lần:

| Loại | Phòng |
|---|---|
| Địa điểm có tên trên sơ đồ, bảng sân GDTC | Hội trường lớn, Nhà mái vòm khu A, Nhà tập khu E, Sân quần vợt khu E, Sân bóng đá, Hội trường CS2, Sân bóng CS2, Sân cầu lông CS2 |
| Phòng học **mẫu** theo khu (122 phòng) | Khu A2–A5: tầng 1–3 × 4 phòng · Khối B, C, D: tầng 1–3 × 3 · Khối E4: 4 phòng · Khối F1, G: tầng 1–2 × 3 · Khối V (CS2): tầng 1–9 × 3 · Khối phòng học (CS2): 4 phòng |

- **Phòng mẫu chưa phải số phòng thật.**
  - Sơ đồ chỉ ghi tên khu, không ghi số phòng hay sức chứa.
  - Mã phòng mẫu có dạng `A4-101`, sức chứa "chưa rõ", cột `sample` = TRUE trong sheet Rooms.
  - Quản trị viên thấy nhãn **mẫu** cạnh tên phòng.
- **Thay bằng danh sách thật:** vào **Quản trị → Phòng họp**.
  1. Bấm **Xoá phòng mẫu**. Nếu đang lọc một khu thì chỉ xoá phòng mẫu của khu đó.
  2. Chọn **Thêm hàng loạt → Dán danh sách**.
  - Phòng đã có lịch họp không bị xoá mà chuyển sang tạm ngưng, để lịch cũ vẫn đúng tên phòng.
  - Mỗi dòng trong bảng cũng có nút Xoá riêng.
- Khu nào đã có phòng do quản trị viên tự thêm thì không thêm phòng mẫu cho khu đó.
- **4 phòng mẫu cũ** (Phòng họp 1, Phòng họp 2, Hội trường A5, Phòng CLB) được tạm ngưng, nếu tên chưa bị sửa. Lịch họp cũ vẫn hiện.
- **Trong trình soạn thảo Apps Script:**
  - Chạy `napPhongHCMUTE()` để nạp lại phần còn thiếu.
  - Muốn tắt hẳn việc tự nạp: đặt Script Property `HCMUTE_SEED` = `off`.
  - `kiemTraCauHinh()` có dòng "Phòng HCMUTE" cho biết đã nạp chưa.

**Tab Phòng họp = sơ đồ khu.**
- Mỗi khu là một thẻ, gom theo Cơ sở 1 · Võ Văn Ngân và Cơ sở 2 · Lê Văn Việt. Xếp theo thứ tự trên sơ đồ: A2–A5, B, C, D, E4, F1, G, rồi hội trường, thể thao.
- Viền thẻ tô màu theo chú thích bản đồ: cam = phòng học, hồng = hội trường, xanh dương = xưởng/PTN; thêm xanh lá = thể thao, tím = online.
- Thẻ ghi số phòng, số lượt đặt trong ngày, số cuộc họp đang diễn ra.
- Bấm một khu để xem các phòng và giờ trống, bấm **Tất cả khu** để quay lại.
- Dưới sơ đồ chỉ liệt kê phòng có lịch trong ngày, vì liệt kê hơn 100 phòng thì quá dài.

**Lịch ngày khi xem cả trường** tự bật "Ẩn phòng trống", chỉ hiện cột của phòng có lịch.
- Chọn một khu hoặc tìm phòng thì hiện đủ phòng để đặt.
- Bấm nút "Ẩn phòng trống" để đổi, lựa chọn được nhớ lại.

**Thêm phòng bằng tay (từ bản 3.5):** vào **Quản trị → Phòng họp → Thêm hàng loạt**. Hộp thoại có 3 tab:

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
- **Ảnh đại diện**: ảnh tự chọn hoặc chữ viết tắt (bản 3.6 bỏ lựa chọn ảnh Google).
  - Ảnh tự chọn được tự cắt vuông và thu nhỏ còn 256px, nên ảnh điện thoại vài MB vẫn dùng được.
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
