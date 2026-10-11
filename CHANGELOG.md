# CHANGELOG

Nhật ký thay đổi của repo. Mục mới nhất nằm trên cùng.

**Mẫu một dòng:**

```
- [Tên AI] loại: đường-dẫn: mô tả
```

**Loại:** `thêm` · `sửa` · `lỗi` · `nội dung` · `giao diện` · `dọn`

## 2026-10-11

- [Claude] thêm: `qtda/scholarlink/`: ScholarLink · hồ sơ khoa học & kết nối chuyên gia (bài tập môn Quản trị dự án)
  - `Code.gs` + `Index.html` + `appsscript.json`: web app Google Apps Script, đăng nhập Google OAuth 2.0, phân quyền chuyên gia / quản trị
  - Nhập CV (.docx/.doc/.pdf) có rà soát, xác minh học vị & công bố, ghép nối, thống kê, kho tài liệu
  - Xuất lý lịch khoa học theo mẫu Bộ GD&ĐT (TT 08/2011, Phụ lục V), mẫu đơn vị v2, CV học thuật, danh sách giới thiệu ẩn liên hệ
  - `tools/`: kiểm thử quy tắc dùng chung và bộ tách CV (`node qtda/scholarlink/tools/test.js`)

## 2026-09-11

- [Claude] thêm: `index.html`: trang chủ hub, liệt kê các trang và quy trình nhờ AI sửa
- [Claude] thêm: `toi-uu-hoa/doi-ngau/`: Sổ tay Bài toán đối ngẫu
  - Nội dung: quy tắc dấu, định lý độ lệch bù, giải mẫu đề HK2 22–23, bẫy mất điểm, máy tập lập (D), 3 đề có lời giải
- [Claude] thêm: `_template/index.html`: khung trang mới theo design system
- [Claude] thêm: `tools/`: `simplex.py` (bảng đơn hình kiểu đáp án) và `dual.py` (lập đối ngẫu + giải đối chiếu)
- [Claude] thêm: `AI-HANDOFF.md`, `README.md`, `CHANGELOG.md`, `.nojekyll`
