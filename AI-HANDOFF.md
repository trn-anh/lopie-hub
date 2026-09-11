# AI-HANDOFF: đọc file này trước khi sửa repo

> **Gửi AI đang đọc (Claude, Gemini, ChatGPT…):** repo này do nhiều AI cùng phát triển.
> Làm đúng các quy ước dưới đây để người sau (người hoặc AI) biết ai đã làm gì và không phá phần đã có.

## 1. Repo này là gì

- **Chủ repo:** Lơpie, sinh viên ngành Quản lý Công nghiệp, HCMUTE.
- **Mục đích:** kho trang web tĩnh cho học tập, CLB UISC và các dự án cá nhân.
- **Nơi xuất bản:** GitHub Pages, nhánh `main`, thư mục gốc.
- **Link:** `https://trn-anh.github.io/lopie-hub/`
- **Ngôn ngữ nội dung:** tiếng Việt có dấu. Xưng hô trung tính, đi thẳng vào vấn đề, ưu tiên tính thực dụng.

## 2. Cấu trúc thư mục

```
lopie-hub/
├── index.html               # Trang chủ hub: danh sách mọi trang
├── AI-HANDOFF.md            # File này
├── README.md                # Giới thiệu cho người đọc
├── CHANGELOG.md             # Nhật ký thay đổi (bắt buộc cập nhật)
├── .nojekyll                # Tắt Jekyll để Pages phục vụ file nguyên trạng
├── _template/index.html     # Khung trang mới, đã có sẵn design system
├── tools/                   # Script kiểm tra đáp án (Python)
└── <nhom>/<trang>/index.html
    └── ví dụ: toi-uu-hoa/doi-ngau/index.html
```

- **Tên thư mục:** tiếng Việt không dấu, chữ thường, nối bằng gạch ngang. Ví dụ `toi-uu-hoa/van-tai`, `uisc/tuyen-thanh-vien`.
- **Mỗi trang là một thư mục** chứa `index.html`, nên link gọn dạng `…/toi-uu-hoa/doi-ngau/`.

## 3. Quy tắc bắt buộc

1. **Mỗi trang tự chứa.** CSS và JS viết inline trong `index.html`. Không build step, không framework, không npm. Chỉ được tải:
   - Google Fonts
   - Thư viện UMD có ghim phiên bản từ `cdnjs.cloudflare.com`, và chỉ khi thật sự cần.
2. **Sửa tối thiểu, đúng phạm vi được giao.** Không tự viết lại, đổi cấu trúc hay xóa nội dung có sẵn nếu người dùng không yêu cầu.
3. **Giữ design system (mục 4).** Trang mới bắt đầu bằng cách copy `_template/index.html`.
4. **Nội dung toán học phải được kiểm chứng.** Nghiệm, bảng đơn hình, bài toán đối ngẫu phải được giải lại bằng `tools/` hoặc công cụ tương đương trước khi đưa vào trang. Không bịa số.
5. **Ghi nguồn.** Ví dụ lấy từ bài giảng hay đề thi thì ghi rõ ở footer của trang.
6. **Giữ đúng thuật ngữ của môn học:** PATƯ (phương án tối ưu), k.h.c (không hạn chế), RB (ràng buộc), ẩn phụ, ẩn giả, Δⱼ, λ… Trình bày theo đáp án của giảng viên.
7. **Kiểm tra trước khi commit:**
   - Trang không lỗi console.
   - Hiển thị ổn ở bề rộng ~400px (điện thoại).
   - Đọc được ở cả nền sáng lẫn tối.
8. **Cập nhật nhật ký:** mỗi thay đổi thêm một dòng vào `CHANGELOG.md` (mục 5).
9. **Trang mới phải có mặt trên trang chủ:** thêm một mục vào `index.html` ở gốc, ghi tên AI và ngày.

## 4. Design system

### Màu (CSS custom properties)

| Token | Nền sáng | Nền tối | Dùng cho |
|---|---|---|---|
| `--ground` | `#F3F5F9` | `#0E121A` | Nền trang |
| `--surface` | `#FFFFFF` | `#161B26` | Thẻ, bảng |
| `--ink` | `#141B2D` | `#E4E8F1` | Chữ chính |
| `--muted` | `#586174` | `#9BA4B6` | Chữ phụ |
| `--rule` | `#DCE1EB` | `#262E3F` | Đường kẻ |
| `--accent` | `#2346B0` | `#95ABFF` | Màu mực xanh: link, nhấn |
| `--red` | `#C0302F` | `#FF8B80` | Bút đỏ chấm bài: lỗi, điểm |
| `--green` | `#1B7A4B` | `#6ED29B` | Đúng |
| `--hl` | `#FFE594` | `#5A4912` | Tô ô xoay (pivot) |

Quy tắc theme:

- Khai báo đủ bảng màu sáng trong `:root`.
- Định nghĩa lại cho nền tối trong `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` và trong `:root[data-theme="dark"]`.
- Component chỉ lấy màu qua token, không viết mã màu cứng.

### Chữ

| Vai trò | Font | Ghi chú |
|---|---|---|
| Tiêu đề | Literata (serif) | Weight 600 |
| Nội dung | Be Vietnam Pro | Hỗ trợ tiếng Việt tốt |
| Số, bảng, nhãn | JetBrains Mono | `font-variant-numeric: tabular-nums` |
| Biến toán học | Literata italic | `<i>x</i><sub>1</sub>` |
| Điểm bút đỏ | Caveat | Chỉ dùng cho con số như `0,5đ`, `0đ` |

### Component có sẵn

Xem mẫu trong `toi-uu-hoa/doi-ngau/index.html`:

| Class | Thành phần |
|---|---|
| `.lp` + `.sys` + `.brace` | Hệ ràng buộc có dấu ngoặc {, căn thẳng cột theo biến |
| `table.tableau` | Bảng đơn hình theo mẫu đáp án (cᵢ, ẩn CS, bᵢ, λ, hàng f(x), hàng M) |
| `.paper` + `.step` + `.pts` | Tờ bài thi kẻ ô, điểm bút đỏ bên lề |
| `.traps` + `.stamp` | Danh sách lỗi mất điểm |
| `.callout`, `.callout.info` | Hộp lưu ý |
| `details.ex` + `details.ans` | Bài tập có nút xem lời giải |

## 5. Quy ước commit và CHANGELOG

**Commit message:**

```
[Tên AI] loại: mô tả ngắn
```

- **Tên AI:** `Claude`, `Gemini`, `ChatGPT`, `Lơpie` (khi tự tay sửa)…
- **Loại:** `thêm` · `sửa` · `lỗi` (sửa lỗi) · `nội dung` · `giao diện` · `dọn` (dọn dẹp)

Ví dụ:

- `[Gemini] thêm: trang bài toán vận tải`
- `[Claude] lỗi: sai dấu y2 ở đề thi thử`

**CHANGELOG.md:** mục mới nhất nằm trên cùng.

```
## 2026-09-12
- [Gemini] thêm: toi-uu-hoa/van-tai: sổ tay bài toán vận tải
```

## 6. Mẫu giao việc cho AI khác

Người dùng có thể copy nguyên khối này, đính kèm file liên quan rồi gửi:

```
Bạn đang làm tiếp repo "lopie-hub" (GitHub Pages, trang HTML tĩnh tiếng Việt).
Tôi đính kèm: AI-HANDOFF.md (quy ước bắt buộc) và [file cần sửa].

Việc cần làm: [mô tả cụ thể]

Yêu cầu:
- Tuân thủ AI-HANDOFF.md: trang tự chứa, giữ design system, sửa tối thiểu.
- Nội dung toán phải tự kiểm tra lại; chỗ nào không chắc thì ghi rõ.
- Trả về: (1) file hoàn chỉnh để thay thế,
          (2) commit message theo mẫu [Tên AI] loại: mô tả,
          (3) dòng thêm vào CHANGELOG.md.
```
