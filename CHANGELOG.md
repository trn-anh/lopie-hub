# CHANGELOG

Nhật ký thay đổi của repo. Mục mới nhất nằm trên cùng.

**Mẫu một dòng:**

```
- [Tên AI] loại: đường-dẫn: mô tả
```

**Loại:** `thêm` · `sửa` · `lỗi` · `nội dung` · `giao diện` · `dọn`

## 2026-09-23

- [Claude] lỗi: `apps-script/lich-hop-nhom/`: bản 3.8, báo chắc chắn khi link chính còn chạy bản cũ
  - Bản 3.7 không báo vì đoán theo nội dung trang (trang app nào cũng có link ServiceLogin); nay hỏi link chính và tự đi theo từng bước chuyển hướng
  - Link bắt đăng nhập Google: dựa vào phiên bản đã xử lý lần đăng nhập gần nhất (`EXEC_VERSION`, ghi ở bước đổi mã đăng nhập)
  - Trang đăng nhập nhắc ngay khi link chính còn bản cũ; hướng dẫn tự mở một lần cho quản trị viên, có nút mở dự án Apps Script
- [Claude] lỗi: `apps-script/lich-hop-nhom/`: bản 3.7, đăng nhập lại bị về giao diện cũ
  - Nguyên nhân: link chính `/exec` (nơi Google trả về sau đăng nhập) vẫn gắn phiên bản cũ, chỉ link thử `/dev` chạy code mới
  - Máy chủ tự hỏi link chính đang chạy bản nào (`?lhn_probe=1`, `api_checkDeploy`); quản trị viên thấy thanh cảnh báo kèm cách cập nhật và nút kiểm tra lại
  - `kiemTraCauHinh()` in "Link chính đang chạy" và mã triển khai; chân trang đăng nhập ghi số phiên bản
  - Lịch nhỏ lên trên bộ lọc khu; nhóm cơ sở thu gọn khi nhiều khu và được nhớ
  - Lọc khu không còn lẫn phòng tạm ngưng khu khác; báo "+N cuộc họp ở khu khác"; bỏ khung đỏ "Đã qua"; đầu cột gọn trên điện thoại
- [Claude] thêm: `apps-script/lich-hop-nhom/`: bản 3.6, nhận diện HCM-UTE và phòng theo sơ đồ trường
  - Trang đăng nhập theo bố cục cổng trường (logo, tên trường, thẻ "ĐĂNG NHẬP"), chỉ một nút "Đăng nhập với Google Giảng viên"; khung chung cho màn hình đăng ký, chờ duyệt, báo lỗi; nút đổi tài khoản
  - Trang chưa đăng nhập không còn trả lịch họp trong ngày, chỉ tên app, trường, tổ chức
  - Tự nạp một lần 8 địa điểm + 122 phòng học mẫu theo khu (cột `sample`); tạm ngưng phòng mẫu cũ; `napPhongHCMUTE()`, Script Property `HCMUTE_SEED`
  - Tab Phòng họp thành sơ đồ khu theo cơ sở, màu theo chú thích bản đồ; khu xếp theo thứ tự sơ đồ; lịch ngày cả trường tự ẩn phòng trống
  - Quản trị: nhãn "mẫu", nút "Xoá phòng mẫu", xoá từng phòng (phòng đã có lịch thì chỉ tạm ngưng); `api_deleteRooms`
  - Cài đặt "Tên trường" (`SCHOOL_NAME`); logo và tên trường trên thanh trên cùng, đầu bảng lịch tuần
  - Chữ: Segoe UI, thang cỡ chữ, độ đậm 400/600/700, tiêu đề xanh đậm, nhãn mục viết hoa; bỏ tải phông Inter
  - Bỏ ảnh đại diện Google (không hỏi userinfo, không lưu ảnh Google)
  - Sửa: chọn "chỉ một khu" vẫn lẫn phòng tạm ngưng của khu khác; thanh giờ phòng tạm ngưng lệch cột; thanh trên cùng trên điện thoại thừa khoảng trống
- [Claude] thêm: `apps-script/lich-hop-nhom/`: bản 3.5, dùng cho HCMUTE và trường nhiều phòng
  - Quản trị › Phòng họp › Thêm hàng loạt: địa điểm HCMUTE theo sơ đồ + bảng sân GDTC, tạo dãy phòng theo khu, dán danh sách từ Excel; `api_importRooms`
  - Sức chứa 0 = chưa rõ, không cảnh báo quá chỗ
  - Tiêu đề cột một dòng; chú thích, mẹo gom vào nút ⓘ; chọn khu, tìm phòng, ẩn phòng trống; lọc khu gom theo cơ sở và được nhớ; form chọn phòng theo nhóm khu
- [Claude] lỗi: `apps-script/lich-hop-nhom/`: bản 3.4, sửa ảnh đại diện
  - Ảnh Google không lấy được: id_token có thể không kèm ảnh, nay hỏi thêm userinfo; lấy ảnh 256px; ghi nhật ký đăng nhập
  - Người mới xin tham gia có sẵn ảnh Google; sửa nhầm `s.profileName`
  - Đang online hiện ngay ảnh vừa đổi; bỏ chữ "Đổi ảnh" và lời nhắc tự bật
  - Bỏ dòng "Đồng bộ với Google Sheets"; ghi số phiên bản trong menu tài khoản; `kiemTraCauHinh()` hướng dẫn cập nhật đúng triển khai
- [Claude] thêm: `apps-script/lich-hop-nhom/`: bản 3.3, xử lý góp ý demo và yêu cầu mới
  - Kéo thả cuộc họp như Google Calendar (lịch ngày: đổi giờ, phòng, giờ kết thúc; lịch tuần: đổi ngày), có hoàn tác
  - Chọn giờ dạng 24h thay ô AM/PM (lỗi gõ 12:30 thành 00:30); báo lỗi và gợi ý giờ trống ngay dưới hàng giờ
  - Khung chèn tài liệu gộp: tải lên kéo thả / dán link / đã dùng gần đây
  - Ảnh đại diện: ảnh Google / ảnh tự chọn (tự cắt 256px) / chữ viết tắt
  - Tô xám giờ đã qua; gạch ngang cuộc họp đã báo vắng
  - Sửa lỗi form mất cú bấm khi ô khác vừa mất focus
- [Claude] thêm: `apps-script/lich-hop-nhom/`: mã nguồn web app Lịch Họp Nhóm (Google Apps Script), đã xoá client secret
- [Claude] lỗi: `apps-script/lich-hop-nhom/`: sửa 3 lỗi giao diện và trùng lịch
  - Thanh nhắc: bỏ nền đỏ; nêu rõ tên lời mời chưa phản hồi; tự cập nhật theo giờ; ẩn rồi thì không hiện lại cho tới khi có nhắc mới
  - Lịch nhỏ: hết lệch cột khi cột trái hiện thanh cuộn
  - Trùng lịch: báo đỏ trùng phòng và trùng người ở mọi màn hình; chặn lưu khi chủ trì hoặc thư ký bị trùng

## 2026-09-11

- [Claude] thêm: `index.html`: trang chủ hub, liệt kê các trang và quy trình nhờ AI sửa
- [Claude] thêm: `toi-uu-hoa/doi-ngau/`: Sổ tay Bài toán đối ngẫu
  - Nội dung: quy tắc dấu, định lý độ lệch bù, giải mẫu đề HK2 22–23, bẫy mất điểm, máy tập lập (D), 3 đề có lời giải
- [Claude] thêm: `_template/index.html`: khung trang mới theo design system
- [Claude] thêm: `tools/`: `simplex.py` (bảng đơn hình kiểu đáp án) và `dual.py` (lập đối ngẫu + giải đối chiếu)
- [Claude] thêm: `AI-HANDOFF.md`, `README.md`, `CHANGELOG.md`, `.nojekyll`
