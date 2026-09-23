# Lơpie Hub

Kho trang học tập và dự án của Lơpie, làm cùng nhiều AI (Claude, Gemini, ChatGPT).
Mỗi trang là một file HTML tự chạy, xuất bản miễn phí bằng GitHub Pages.

🌐 **Xem trang:** https://trn-anh.github.io/lopie-hub/

## Các trang

| Trang | Nhóm | Làm bởi | Cập nhật |
|---|---|---|---|
| [Sổ tay Bài toán đối ngẫu](https://trn-anh.github.io/lopie-hub/toi-uu-hoa/doi-ngau/) | Tối ưu hóa · Chương 2 | Claude | 11/09/2026 |

## Cấu trúc

```
index.html                  trang chủ hub
toi-uu-hoa/doi-ngau/        sổ tay bài toán đối ngẫu
_template/                  khung trang mới
tools/                      script Python kiểm tra đáp án
apps-script/lich-hop-nhom/  mã nguồn web app Lịch Họp Nhóm (Apps Script)
AI-HANDOFF.md               quy ước cho mọi AI khi sửa repo
CHANGELOG.md                nhật ký thay đổi
```

## Thêm hoặc sửa một trang

### Cách 1: làm trên web GitHub (không cần cài gì)

1. **Nhờ AI làm.** Gửi AI file `AI-HANDOFF.md` và file cần sửa (hoặc `_template/index.html` nếu là trang mới).
2. **Upload file.**
   - Trang có sẵn: mở file trên GitHub, bấm biểu tượng ✏️ để sửa, dán nội dung mới.
   - Trang mới: vào đúng thư mục, bấm **Add file → Upload files**.
3. **Ghi tên AI vào commit.** Ở ô *Commit changes*, ghi theo mẫu `[Gemini] thêm: trang bài toán vận tải`.
4. **Cập nhật hai file:**
   - `CHANGELOG.md`: thêm một dòng.
   - `index.html` ở gốc: nếu là trang mới, thêm trang vào danh sách.
5. **Chờ xuất bản.** Khoảng 1–2 phút sau, GitHub Pages tự cập nhật.

### Cách 2: cho AI đọc thẳng repo

| AI | Cách đọc repo |
|---|---|
| Gemini | Mục **Import code** trong Gemini, dán link repo |
| ChatGPT | Bật connector **GitHub** trong phần cài đặt |
| Claude (Cowork) | Kết nối thư mục chứa bản clone của repo |

## Quy ước commit

```
[Tên AI] loại: mô tả ngắn
```

- **Loại:** `thêm` · `sửa` · `lỗi` · `nội dung` · `giao diện` · `dọn`
- **Xem toàn bộ lịch sử:** tab **Commits** của repo. Cần xem một trang thì mở thư mục của trang đó rồi bấm **History**.

## Nguồn nội dung

- Trang *Bài toán đối ngẫu* dùng ví dụ từ bài giảng Chương 2 môn Tối ưu hóa (GV Nguyễn Thị Anh Vân, HCMUTE) và các đề cuối kỳ có đáp án của môn.
- Nghiệm và bảng đơn hình đều được giải lại bằng `tools/` để đối chiếu.
