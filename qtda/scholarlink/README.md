# ScholarLink · Hồ sơ khoa học & kết nối chuyên gia

Web app Google Apps Script cho bài tập cuối kỳ môn **Quản trị dự án**. Giao diện bám Design System trên Figma
*"ScholarLink · Hồ sơ khoa học — UX/UI System"* (token màu `--sl-*`, font Be Vietnam Pro, các màn hình desktop
và quy tắc dữ liệu, kể cả bản góp ý UX v1.2 của giảng viên).

- **Demo chạy ngay trên trình duyệt** (không cần cài gì, dữ liệu minh họa lưu trong trình duyệt):
  https://trn-anh.github.io/lopie-hub/qtda/scholarlink/Index.html
- **Bản chạy thật**: dán `Code.gs`, `Index.html`, `appsscript.json` vào một dự án Apps Script (hướng dẫn bên dưới).

## 1. Chức năng

| Vai trò | Màn hình | Làm được gì |
|---|---|---|
| Chung | Đăng nhập | Đăng nhập Google → kiểm tra quyền tại ScholarLink → vào đúng không gian vai trò. Không có form đăng ký hay mật khẩu riêng. |
| Chuyên gia | Tổng quan | Mức hoàn thiện hồ sơ, việc cần làm, thông báo riêng |
| | Hồ sơ của tôi | 6 tab: cơ bản & liên hệ, đào tạo & ngoại ngữ, học vị/chức danh/chức vụ (có minh chứng, chờ xác minh), công tác, đề tài, giải thưởng |
| | Nhập từ CV | 3 bước: tải CV (.docx/.doc/.pdf) → đối chiếu từng mục với đoạn nguồn, sửa, chọn thêm/cập nhật/bỏ qua, xử lý trùng → xác nhận lưu |
| | Công bố khoa học | Danh sách + bộ lọc, thêm/sửa, đối chiếu DOI với Crossref, kiểm tra trùng, tải file minh chứng, gửi xác minh |
| | Thông tin bổ sung | Bật từng nhu cầu hợp tác; hội đồng/hướng dẫn kiểm tra điều kiện học vị theo bậc đào tạo |
| | Đề xuất kết nối | Đề xuất riêng, lý do phù hợp, Quan tâm / Không phù hợp |
| | Xuất hồ sơ | Chọn mẫu, mục, định dạng → xem toàn bộ → **xác nhận bản xem trước** → tải. Đổi dữ liệu/mẫu sẽ hủy xác nhận cũ |
| | Hỗ trợ & nhập nhanh | Dán danh sách trích dẫn → tách thành công bố nháp; gửi yêu cầu hỗ trợ; câu hỏi thường gặp |
| Quản trị | Tổng quan | Hàng chờ, hồ sơ cần nhắc, hỗ trợ, phản hồi ghép nối |
| | Hồ sơ chuyên gia | Lọc đa điều kiện (học vị, lĩnh vực, nhu cầu, bậc đào tạo, đủ điều kiện), xem chi tiết, chọn vào đợt ghép nối |
| | Ghép nối nhu cầu | Tạo đợt → lọc điều kiện trước, xếp hạng sau → chọn danh sách → gửi đề xuất riêng; xuất danh sách giới thiệu **ẩn liên hệ**, CV đầy đủ một người |
| | Duyệt & xác minh | Học vị/chức danh: so sánh hồ sơ trước–sau; công bố: metadata, trùng, tiêu chí, ghi chú |
| | Thống kê công bố | Theo tháng/quý, theo ngày tải lên hoặc ngày xuất bản, cùng DOI chỉ tính một; xuất CSV |
| | Quy tắc & danh mục | Điều kiện theo bậc đào tạo, thứ bậc học vị/chức danh, lĩnh vực, cấp đề tài, cài đặt chung |
| | Kho tài liệu | File riêng tư trên Drive, phiên bản, liên kết bản ghi, quyền Riêng tư/Nội bộ |
| | Tài khoản & quyền | Cấp tài khoản (lẻ hoặc hàng loạt), vai trò, khoá |
| | Nhật ký & hỗ trợ | Trả lời hỗ trợ, nhật ký thao tác (đăng nhập, xác minh, xuất CV…) |

### Mẫu xuất

| Mẫu | Nội dung |
|---|---|
| Lý lịch khoa học · mẫu Bộ GD&ĐT | Đúng bố cục Thông tư 08/2011/TT-BGDĐT, Phụ lục V (mục I–IV, bảng công tác, đề tài, công trình, khối ký). Ô trống in thành dòng chấm để điền tay |
| Mẫu đơn vị v2 (I–VI) | Cấu trúc đã chốt trong Figma: I cá nhân · II đào tạo · III công tác · IV công bố & đề tài · V sách/giáo trình · VI giải thưởng |
| CV học thuật | Bản rút gọn, trích dẫn dạng APA |
| Hồ sơ giới thiệu | 1 trang, luôn ẩn liên hệ |
| Danh sách giới thiệu (quản trị) | Tên, học vị/chức danh, đơn vị, lĩnh vực, nhu cầu, lý do phù hợp; không có email, điện thoại, địa chỉ, số định danh |

Định dạng: **.docx** và **.pdf** (dựng qua Google Docs trên máy chủ), **.doc** (Word mở trực tiếp, tạo ngay trên trình duyệt), **In / Lưu PDF**.

## 2. Cài đặt bản chạy thật (khoảng 15 phút)

### Bước 1. Tạo dự án Apps Script
1. Vào https://script.google.com → **Dự án mới**. Đặt tên `ScholarLink`.
2. **Cài đặt dự án** (biểu tượng bánh răng) → bật **Hiển thị tệp kê khai "appsscript.json"**.
3. Dán nội dung 3 file trong thư mục này:
   - `Code.gs` → thay toàn bộ file `Code.gs` mặc định
   - `appsscript.json` → thay toàn bộ file kê khai (đã bật sẵn **Drive API v3** nâng cao)
   - `Index.html` → **Tệp + → HTML**, đặt tên đúng là `Index`
4. Lưu (Ctrl + S).

### Bước 2. Khởi tạo dữ liệu
Chọn hàm `setup` → **Chạy** → cấp quyền khi Google hỏi. Nhật ký in ra link Google Sheet (cơ sở dữ liệu) và thư mục kho tài liệu.
Bạn (chủ script) tự động là quản trị viên.

### Bước 3. Triển khai web app
**Triển khai → Tùy chọn triển khai mới → Ứng dụng web**
- Thực thi với tư cách: **Tôi**
- Người có quyền truy cập: **Bất kỳ ai**

Sao chép URL kết thúc bằng `/exec`.

### Bước 4. Tạo OAuth Client trên Google Cloud
1. https://console.cloud.google.com → tạo hoặc chọn một project.
2. **APIs & Services → OAuth consent screen**: chọn External, điền tên app, email hỗ trợ; scope `openid`, `email`, `profile`. Khi đang ở chế độ Testing, thêm email cả nhóm vào **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   **Authorized redirect URIs**: dán đúng URL `/exec` ở bước 3.
4. Lấy **Client ID** và **Client secret**.

### Bước 5. Lưu cấu hình và cấp quyền
1. Trong `Code.gs`, tìm hàm `napCauHinh()`, điền Client ID, Client secret, URL `/exec` → chạy hàm này **một lần** → xóa lại về rỗng.
   **Không commit client secret lên GitHub.**
2. Chạy `capQuyen()` để Google hỏi đủ quyền (Drive, Docs, gửi mail, gọi mạng).
3. **Triển khai → Quản lý triển khai → bút chì → Phiên bản: Phiên bản mới → Triển khai** (giữ nguyên link `/exec`).

### Bước 6. Dùng thử
- Mở link `/exec`, đăng nhập bằng tài khoản Google của bạn → vào không gian quản trị (bấm huy hiệu "Quản trị viên" góc phải để chuyển sang không gian chuyên gia).
- **Tài khoản & quyền** → cấp tài khoản cho thành viên khác (dán danh sách `email, Họ tên, Đơn vị, chuyên gia`).
- Muốn có dữ liệu minh họa để thuyết trình: chạy `napDuLieuMau()`.

### Hàm tiện ích trong `Code.gs`
| Hàm | Dùng khi |
|---|---|
| `kiemTraCauHinh()` | Xem nhanh cấu hình còn thiếu gì |
| `dangXuatTatCa()` | Hủy mọi phiên đăng nhập (nghi lộ token) |
| `napDuLieuMau()` | Nạp dữ liệu minh họa khớp màn hình Figma (không ghi đè dữ liệu có sẵn) |

**Mỗi lần dán code mới**: Quản lý triển khai → sửa → Phiên bản mới. Không bấm "Triển khai mới", nếu không link `/exec` sẽ đổi và Google báo `redirect_uri_mismatch`.

## 3. Kiến trúc

```
Trình duyệt (Index.html)                       Google Apps Script (Code.gs)
┌────────────────────────────┐  google.script.run  ┌─────────────────────────────────┐
│ Giao diện 1 trang, router #│ ───────────────────▶ │ api_* (mọi hàm nhận token trước) │
│ Khối SL-SHARED (quy tắc)   │   token HMAC         │ Khối SL-SHARED (giống hệt)       │
│ Dựng văn bản xuất (HTML)   │ ◀─────────────────── │ LockService · Google Sheets      │
│ MockAPI (bản demo)         │                      │ Drive (file riêng tư) · Docs     │
└────────────────────────────┘                      │ Crossref · MailApp               │
                                                    └─────────────────────────────────┘
```

- **Xác thực**: OAuth 2.0 authorization code do chính web app chạy, đổi `code` lấy `id_token`, kiểm tra `aud`, `iss`, hạn,
  email đã xác minh; phát session token ký HMAC-SHA256 (12 giờ); mã trao tay một lần để token không nằm trên URL.
  (Kế thừa từ app Lịch Họp Nhóm.)
- **Phân quyền**: xác thực Google ≠ có quyền. Email phải có trong sheet `Users` và đang hoạt động; mỗi API kiểm tra vai trò
  (`expert_`, `admin_`). Chuyên gia chỉ đọc/ghi dữ liệu của chính mình; file chỉ tải qua `api_getFile` sau khi kiểm tra quyền.
- **Dữ liệu** (mỗi bảng một trang tính): `Users, Profiles, Credentials, Work, Projects, Publications, Awards, Needs, Rounds,
  Matches, Files, Catalog, Support, Settings, Logs`. Mọi ô lưu dạng văn bản; mọi thao tác ghi chạy trong khóa.
- **Quy tắc dùng chung** (`src/shared.js`, chép y hệt vào cả hai file):
  - Học vị/chức danh cao nhất = cao nhất theo **thứ bậc** trên các mục **đã xác minh** (không lấy mục nhập sau cùng).
  - Điều kiện vai trò: bậc đại học từ Thạc sĩ, cao học từ Tiến sĩ (quy tắc minh họa, sửa được trong Quy tắc & danh mục).
  - Trùng công bố: cùng DOI; không DOI thì tiêu đề chuẩn hóa + năm (+ họ tác giả đầu).
  - Ghép nối: lọc điều kiện trước (nhu cầu đang bật, còn hạn, học vị theo bậc), rồi chấm điểm theo chủ đề và từ khóa.
  - Tách CV theo nhãn của mẫu Bộ GD&ĐT và các bảng III, IV; kết quả chỉ là **bản nháp** chờ người dùng xác nhận.
- **Xuất .docx/.pdf**: HTML đã xem trước → Google Docs (Drive API) → đặt khổ A4, lề 2–2–3–2 cm → xuất → xóa bản tạm.
  Thiếu Drive API nâng cao vẫn dùng được `.doc` và In/PDF.

## 4. Đối chiếu với Figma

| Figma | Trong app |
|---|---|
| Brand guidelines (Fluxience) | Màn hình đăng nhập: khẩu hiệu "Dòng chảy tri thức. Dấu ấn học thuật.", 3 trụ cột |
| Import 6:814 → Review 6:944 | `#/import` bước 1 và 2 |
| Publications 6:1126 · Upload 8:467 | `#/pubs`, `#/pub` |
| Preferences 8:662 · Matches 8:847 | `#/needs`, `#/matches` |
| Export 8:1006 | `#/export` |
| Directory 9:2 · Matching 9:233 | `#/experts`, `#/matching` (quản trị) |
| Approval 9:615 · Analytics 9:425 · Storage 9:958 | `#/review`, `#/stats`, `#/files` |
| UX revision v1.2 (góp ý GV) | Phân loại hợp tác tách riêng · Google + kiểm tra quyền · học vị theo bậc · hai điểm kiểm tra độc lập · mẫu V–VI · thống kê theo kỳ |

Màn hình không có trong Figma được thêm theo cùng hệ thống: Tổng quan (2 vai trò), Hồ sơ của tôi, Quy tắc & danh mục,
Tài khoản & quyền, Nhật ký & hỗ trợ, Hỗ trợ & nhập nhanh. Có nền tối và bố cục điện thoại (menu trượt).

## 5. Kiểm thử

```bash
node qtda/scholarlink/tools/test.js            # 30 kiểm thử: khối dùng chung đồng bộ, tách CV, học vị, trùng, ghép nối
python3 qtda/scholarlink/tools/make-fixture.py # tạo lại file LLKH mẫu đã điền (cần python-docx)
node qtda/scholarlink/tools/sync-shared.js     # sau khi sửa src/shared.js
```

Đã chạy thử bản demo bằng Chromium qua toàn bộ luồng của cả hai vai trò (đăng nhập, từ chối quyền, lưu hồ sơ, chặn ngày sai,
chặn vai trò chưa đủ điều kiện, trùng công bố, tải minh chứng, nhập CV, xuất .doc, xác minh học vị, tạo đợt ghép nối,
danh sách ẩn liên hệ, thống kê theo quý, giao diện 390 px và nền tối): không lỗi console.
File .doc xuất ra đã mở bằng LibreOffice để kiểm tra bố cục.

## 6. Giới hạn đã biết

- Bản Figma ghi AI, OCR, Google Maps là phạm vi giai đoạn sau. Bản này: ghép nối bằng **luật + từ khóa** (có giải thích lý do),
  OCR PDF dùng chức năng chuyển đổi của Google Drive; địa chỉ chọn tỉnh/thành (34 đơn vị sau sắp xếp 2025), phường/xã nhập tay.
- Tách CV đọc tốt nhất CV theo mẫu Bộ GD&ĐT; CV tự do chỉ tách được nhãn quen thuộc và dòng trích dẫn.
- Google Sheets phù hợp quy mô một khoa/trường (vài trăm hồ sơ). Lớn hơn nên chuyển sang cơ sở dữ liệu thật.
- Apps Script giới hạn khoảng 100 email/ngày với tài khoản Gmail thường.
