/**
 * SCHOLARLINK — HỒ SƠ KHOA HỌC & KẾT NỐI CHUYÊN GIA
 * Backend Google Apps Script (Code.gs) · phiên bản 1.0
 *
 * Bài tập cuối kỳ môn Quản trị dự án. Thiết kế: Figma "Fluxience · Hồ sơ học thuật & kết nối chuyên gia — Brand / UX / UI System".
 *
 * KIẾN TRÚC
 * ---------
 *  - Web app deploy "Execute as: Me": Google Sheet và kho file trên Drive vẫn riêng tư.
 *  - Đăng nhập: Google OAuth 2.0 (authorization code) do chính web app chạy, lấy email thật
 *    của người dùng, rồi phát session token có chữ ký HMAC (kế thừa từ app Lịch Họp Nhóm).
 *  - Quyền: đăng nhập Google KHÔNG đồng nghĩa có quyền. Email phải có trong sheet Users
 *    (do đơn vị cấp) mới vào được, đúng không gian theo vai trò: chuyên gia / quản trị.
 *  - Dữ liệu: mỗi bảng là một trang tính. Mọi thao tác ghi chạy trong khóa (LockService).
 *  - Quy tắc dùng chung với giao diện nằm trong khối SL-SHARED (học vị cao nhất, điều kiện
 *    vai trò, khử trùng công bố, tách CV, chấm điểm ghép nối).
 *
 * CÀI ĐẶT: xem README.md, hoặc tóm tắt:
 *  1. Chạy setup_()                         → tạo Google Sheet + danh mục mặc định, bạn là quản trị viên
 *  2. Deploy > New deployment > Web app     → Execute as: Me · Who has access: Anyone
 *  3. Google Cloud Console tạo OAuth Client (Web application), redirect URI = URL /exec
 *  4. Điền napCauHinh_() rồi chạy            → lưu CLIENT_ID, CLIENT_SECRET, URL /exec
 *  5. Chạy capQuyen_()                       → cấp quyền Drive, Docs, gửi mail, gọi mạng
 *  6. (Tùy chọn) napDuLieuMau_()              → dữ liệu minh họa để trình bày
 */

/* =====================================================================
   0. CẤU HÌNH
   ===================================================================== */
const APP_VERSION = '1.9';
const TZ = 'Asia/Ho_Chi_Minh';
const SESSION_HOURS = 12;
const MAX_UPLOAD_MB = 20;
const PROPS = PropertiesService.getScriptProperties();

const DEFAULT_SETTINGS = {
  APP_NAME: 'Fluxience',
  ORG_NAME: 'Phòng Khoa học Công nghệ',
  SCHOOL_NAME: 'Trường Đại học Công nghệ Kỹ thuật TP.HCM',
  CITY: 'TP. Hồ Chí Minh',
  FORM_CODE: '',
  SEND_EMAIL: 'true',
  AUTO_DOMAIN: '',
  PUB_CRITERIA: 'v1',
  LEVEL_RULES: ''
};
const TEXT_KEYS = ['APP_NAME', 'ORG_NAME', 'SCHOOL_NAME', 'CITY', 'FORM_CODE', 'AUTO_DOMAIN', 'PUB_CRITERIA'];

function prop_(k) { return String(PROPS.getProperty(k) || '').trim(); }

/* =====================================================================
   1. QUY TẮC DÙNG CHUNG (giống hệt khối trong Index.html)
   ===================================================================== */
/* ==== SL-SHARED BEGIN ====
 * Quy tắc dùng chung cho máy chủ (Code.gs) và giao diện (Index.html).
 * Hai file phải chứa khối này Y HỆT nhau. Sửa ở src/shared.js rồi chạy:
 *   node qtda/scholarlink/tools/sync-shared.js
 * Kiểm tra: node qtda/scholarlink/tools/test.js
 */
var SL = (function () {
  'use strict';

  /* ---------- Danh mục mặc định (Quản trị có thể sửa trong "Quy tắc & danh mục") ---------- */
  var DEGREES = [
    { code: 'CN', label: 'Cử nhân', rank: 1 },
    { code: 'KS', label: 'Kỹ sư', rank: 1 },
    { code: 'THS', label: 'Thạc sĩ', rank: 2 },
    { code: 'TS', label: 'Tiến sĩ', rank: 3 },
    { code: 'TSKH', label: 'Tiến sĩ khoa học', rank: 4 }
  ];
  var TITLES = [
    { code: 'PGS', label: 'Phó Giáo sư', rank: 1 },
    { code: 'GS', label: 'Giáo sư', rank: 2 }
  ];
  /* Loại hợp tác theo góp ý v1.2: mỗi loại bật riêng, không suy ra nhau */
  var NEED_TYPES = [
    { code: 'council', label: 'Tham gia hội đồng', hint: 'Hội đồng chấm, nghiệm thu theo bậc đào tạo.', leveled: true },
    { code: 'supervise', label: 'Hướng dẫn nghiên cứu', hint: 'Hướng dẫn khóa luận, luận văn theo bậc đào tạo.', leveled: true },
    { code: 'consult', label: 'Tư vấn doanh nghiệp', hint: 'Phân tích vấn đề và đề xuất giải pháp.' },
    { code: 'joint', label: 'Nghiên cứu chung với DN', hint: 'Cùng thực hiện đề tài, tạo kết quả nghiên cứu.' },
    { code: 'guest', label: 'Thỉnh giảng', hint: 'Giảng dạy theo lĩnh vực đã chọn.' },
    { code: 'team', label: 'Tìm đồng đội nghiên cứu', hint: 'Kết nối người có chuyên môn bổ sung.' }
  ];
  /* Bậc đào tạo → học vị tối thiểu (theo ghi chú của GV: đại học từ Thạc sĩ, cao học từ Tiến sĩ) */
  var LEVELS = [
    { code: 'dai_hoc', label: 'Đại học', minDegree: 'Thạc sĩ' },
    { code: 'cao_hoc', label: 'Cao học', minDegree: 'Tiến sĩ' }
  ];
  var PUB_TYPES = [
    { code: 'journal', label: 'Bài báo tạp chí', section: 'IV' },
    { code: 'conference', label: 'Bài báo hội nghị', section: 'IV' },
    { code: 'book', label: 'Sách chuyên khảo', section: 'V' },
    { code: 'textbook', label: 'Giáo trình', section: 'V' },
    { code: 'chapter', label: 'Chương sách', section: 'V' }
  ];
  var PUB_STATUS = {
    draft: { label: 'Nháp', tone: 'neutral' },
    needs_file: { label: 'Cần bổ sung', tone: 'warning' },
    pending: { label: 'Chờ duyệt', tone: 'info' },
    needs_info: { label: 'Cần bổ sung', tone: 'warning' },
    verified: { label: 'Đã xác minh', tone: 'success' },
    rejected: { label: 'Không đạt', tone: 'danger' }
  };
  var CRED_KINDS = [
    { code: 'degree', label: 'Học vị' },
    { code: 'title', label: 'Chức danh khoa học' },
    { code: 'position', label: 'Chức vụ' }
  ];
  var PROJECT_LEVELS = ['Nhà nước', 'Bộ', 'Ngành', 'Tỉnh/Thành phố', 'Trường', 'Cơ sở', 'Hợp tác doanh nghiệp'];
  var PROJECT_ROLES = ['Chủ nhiệm', 'Thư ký', 'Thành viên chính', 'Thành viên'];

  /* Mục I–II của mẫu LLKH (TT 08/2011/TT-BGDĐT, Phụ lục V). key = cột trong sheet Profiles */
  var PROFILE_FIELDS = [
    { key: 'fullName', label: 'Họ và tên', sec: 'I', req: true },
    { key: 'gender', label: 'Giới tính', sec: 'I', req: true },
    { key: 'dob', label: 'Ngày, tháng, năm sinh', sec: 'I', req: true, type: 'date' },
    { key: 'birthPlace', label: 'Nơi sinh', sec: 'I', req: true },
    { key: 'hometown', label: 'Quê quán', sec: 'I' },
    { key: 'ethnicity', label: 'Dân tộc', sec: 'I' },
    { key: 'nationality', label: 'Quốc tịch', sec: 'X' },
    { key: 'addressCountry', label: 'Quốc gia', sec: 'X', contact: true },
    { key: 'ward', label: 'Phường / xã', sec: 'X', contact: true },
    { key: 'position', label: 'Chức vụ (hiện tại hoặc trước khi nghỉ hưu)', sec: 'I' },
    { key: 'unit', label: 'Đơn vị công tác (hiện tại hoặc trước khi nghỉ hưu)', sec: 'I', req: true },
    { key: 'address', label: 'Chỗ ở riêng hoặc địa chỉ liên lạc', sec: 'I', contact: true },
    { key: 'province', label: 'Tỉnh/thành phố', sec: 'I', contact: true },
    { key: 'phoneOffice', label: 'Điện thoại cơ quan', sec: 'I', contact: true },
    { key: 'phoneHome', label: 'Điện thoại nhà riêng', sec: 'I', contact: true },
    { key: 'mobile', label: 'Di động', sec: 'I', contact: true },
    { key: 'fax', label: 'Fax', sec: 'I', contact: true },
    { key: 'contactEmail', label: 'E-mail', sec: 'I', contact: true },
    { key: 'idNumber', label: 'Số CMND/CCCD', sec: 'I', contact: true, sensitive: true },
    { key: 'idDate', label: 'Ngày cấp', sec: 'I', contact: true, sensitive: true, type: 'date' },
    { key: 'idPlace', label: 'Nơi cấp', sec: 'I', contact: true, sensitive: true },
    { key: 'field', label: 'Lĩnh vực chuyên môn', sec: 'X', req: true },
    { key: 'keywords', label: 'Từ khóa chuyên môn', sec: 'X' },
    { key: 'orcid', label: 'ORCID', sec: 'X' },
    { key: 'scholarUrl', label: 'Google Scholar / trang cá nhân', sec: 'X' },
    { key: 'bio', label: 'Giới thiệu ngắn', sec: 'X' },
    { key: 'ugSystem', label: 'Hệ đào tạo', sec: 'II', req: true },
    { key: 'ugPlace', label: 'Nơi đào tạo', sec: 'II', req: true },
    { key: 'ugMajor', label: 'Ngành học', sec: 'II', req: true },
    { key: 'ugCountry', label: 'Nước đào tạo', sec: 'II' },
    { key: 'ugYear', label: 'Năm tốt nghiệp', sec: 'II', req: true },
    { key: 'ug2Major', label: 'Bằng đại học 2', sec: 'II' },
    { key: 'ug2Year', label: 'Năm tốt nghiệp (bằng 2)', sec: 'II' },
    { key: 'msMajor', label: 'Thạc sĩ chuyên ngành', sec: 'II' },
    { key: 'msYear', label: 'Năm cấp bằng thạc sĩ', sec: 'II' },
    { key: 'msPlace', label: 'Nơi đào tạo thạc sĩ', sec: 'II' },
    { key: 'phdMajor', label: 'Tiến sĩ chuyên ngành', sec: 'II' },
    { key: 'phdYear', label: 'Năm cấp bằng tiến sĩ', sec: 'II' },
    { key: 'phdPlace', label: 'Nơi đào tạo tiến sĩ', sec: 'II' },
    { key: 'thesis', label: 'Tên luận án', sec: 'II' },
    { key: 'languages', label: 'Ngoại ngữ', sec: 'II', type: 'json' }
  ];

  /* ---------- Chuỗi ---------- */
  function str(v) { return v == null ? '' : String(v); }
  function trim(v) { return str(v).replace(/\s+/g, ' ').trim(); }
  /** Bỏ dấu tiếng Việt, chữ thường: dùng cho tìm kiếm và so khớp. */
  function fold(s) {
    return str(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }
  function normTitle(s) { return fold(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function normDoi(s) {
    return trim(s).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
  }
  function isDoi(s) { return /^10\.\d{4,9}\/\S+$/.test(normDoi(s)); }
  function words(s) {
    var stop = { va: 1, cua: 1, cho: 1, trong: 1, voi: 1, cac: 1, nhung: 1, mot: 1, the: 1, and: 1, of: 1, in: 1, for: 1, to: 1, a: 1, an: 1, on: 1, tai: 1, theo: 1, ve: 1, la: 1, co: 1, den: 1, tu: 1 };
    return normTitle(s).split(' ').filter(function (w) { return w.length > 1 && !stop[w]; });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- Ngày ---------- */
  /** Nhận dd/mm/yyyy, d-m-yyyy, yyyy-mm-dd, hoặc chỉ năm. Trả { iso, ok, partial }. */
  function parseDate(s) {
    s = trim(s);
    if (!s) return { iso: '', ok: false };
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return mk(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (m) return mk(+m[3], +m[2], +m[1]);
    m = s.match(/ng[aà]y\s*(\d{1,2})\s*th[aá]ng\s*(\d{1,2})\s*n[aă]m\s*(\d{4})/i);
    if (m) return mk(+m[3], +m[2], +m[1]);
    m = s.match(/^(\d{1,2})[\/.\-](\d{4})$/);
    if (m) return { iso: m[2] + '-' + pad(+m[1]) + '-01', ok: true, partial: 'month' };
    m = s.match(/^(\d{4})$/);
    if (m) return { iso: m[1] + '-01-01', ok: true, partial: 'year' };
    return { iso: '', ok: false };
    function mk(y, mo, d) {
      var dt = new Date(Date.UTC(y, mo - 1, d));
      var ok = y > 1900 && y < 2100 && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
      return { iso: ok ? y + '-' + pad(mo) + '-' + pad(d) : '', ok: ok };
    }
  }
  function fmtDate(iso) {
    var m = str(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : str(iso);
  }
  function yearOf(s) { var m = str(s).match(/(19|20)\d{2}/); return m ? m[0] : ''; }

  /* ---------- Học vị, chức danh ---------- */
  function rankOf(list, value) {
    var f = fold(value);
    for (var i = 0; i < list.length; i++) {
      if (fold(list[i].label) === f || fold(list[i].code) === f) return list[i].rank;
    }
    return 0;
  }
  /** Chuẩn hóa chữ tự do ("TS.", "tiến sỹ", "Ph.D") về nhãn danh mục. */
  function normDegree(s) {
    var f = fold(s).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!f) return '';
    if (/tien sy khoa hoc|tien si khoa hoc|tskh|dsc/.test(f)) return 'Tiến sĩ khoa học';
    if (/tien s|^ts\b|phd|ph d|doctor/.test(f)) return 'Tiến sĩ';
    if (/thac s|^ths\b|master|^ms\b|mba/.test(f)) return 'Thạc sĩ';
    if (/ky su|engineer/.test(f)) return 'Kỹ sư';
    if (/cu nhan|bachelor|dai hoc/.test(f)) return 'Cử nhân';
    return '';
  }
  function normTitleRank(s) {
    var f = fold(s);
    if (/pho giao su|pgs/.test(f)) return 'Phó Giáo sư';
    if (/giao su|\bgs\b|professor/.test(f)) return 'Giáo sư';
    return '';
  }
  /**
   * Học vị / chức danh cao nhất ĐÃ XÁC MINH. Xếp theo thứ bậc danh mục, không lấy mục nhập sau cùng.
   * creds: [{ kind, value, date, status }]
   */
  function highest(creds, kind, list) {
    list = list || (kind === 'title' ? TITLES : DEGREES);
    var best = null;
    (creds || []).forEach(function (c) {
      if (c.kind !== kind || c.status !== 'verified') return;
      var r = rankOf(list, c.value);
      if (kind === 'position') r = 1;
      if (!best || r > best.rank || (r === best.rank && str(c.date) > str(best.date))) {
        best = { value: c.value, date: c.date, rank: r, id: c.id };
      }
    });
    return best;
  }
  /** Đủ điều kiện vai trò theo bậc đào tạo (hội đồng / hướng dẫn). */
  function eligible(degree, levelCode, rules, list) {
    var lv = null;
    (rules || LEVELS).forEach(function (l) { if (l.code === levelCode) lv = l; });
    if (!lv) return { ok: true, reason: '' };
    var have = rankOf(list || DEGREES, degree), need = rankOf(list || DEGREES, lv.minDegree);
    if (!degree) return { ok: false, reason: 'Chưa có học vị đã xác minh. Cần tối thiểu ' + lv.minDegree + ' cho bậc ' + lv.label + '.' };
    if (have < need) return { ok: false, reason: 'Bậc ' + lv.label + ' cần tối thiểu ' + lv.minDegree + '; học vị đã xác minh: ' + degree + '.' };
    return { ok: true, reason: 'Đạt điều kiện học vị tối thiểu (' + lv.minDegree + ').' };
  }

  /* ---------- Mức hoàn thiện hồ sơ ---------- */
  function completeness(p, d) {
    p = p || {}; d = d || {};
    var missing = [], total = 0, have = 0;
    PROFILE_FIELDS.forEach(function (f) {
      if (!f.req) return;
      total++;
      if (trim(p[f.key])) have++; else missing.push({ key: f.key, label: f.label, sec: f.sec });
    });
    var extra = [
      { ok: !!d.degree, label: 'Học vị đã xác minh', sec: 'cred' },
      { ok: (d.work || 0) > 0, label: 'Quá trình công tác', sec: 'work' },
      { ok: (d.pubs || 0) > 0, label: 'Ít nhất một công bố', sec: 'pubs' },
      { ok: (d.needsFile || 0) === 0, label: 'Minh chứng cho mọi công bố', sec: 'pubs' }
    ];
    extra.forEach(function (x) { total++; if (x.ok) have++; else missing.push({ key: x.sec, label: x.label, sec: x.sec }); });
    return { pct: total ? Math.round(have * 100 / total) : 0, missing: missing };
  }

  /* ---------- Công bố: khử trùng ---------- */
  function firstAuthor(a) { return normTitle(str(a).split(/[;,]| và | and /)[0]).split(' ').pop() || ''; }
  /** Cùng DOI → trùng. Không DOI → tiêu đề chuẩn hóa + năm (+ họ tác giả đầu nếu có). */
  function sameWork(a, b) {
    var da = normDoi(a.doi), db = normDoi(b.doi);
    if (da && db) return da === db;
    if (normTitle(a.title) !== normTitle(b.title) || !normTitle(a.title)) return false;
    if (yearOf(a.year) && yearOf(b.year) && yearOf(a.year) !== yearOf(b.year)) return false;
    var fa = firstAuthor(a.authors), fb = firstAuthor(b.authors);
    return !(fa && fb && fa !== fb);
  }
  function findDup(p, list) {
    for (var i = 0; i < (list || []).length; i++) {
      if (list[i].id !== p.id && list[i].status !== 'rejected' && sameWork(p, list[i])) return list[i];
    }
    return null;
  }
  /** Danh sách không trùng (giữ bản ghi đầu tiên theo thứ tự). */
  function dedupe(list) {
    var out = [];
    (list || []).forEach(function (p) { if (!findDup(p, out)) out.push(p); });
    return out;
  }
  function pubNeedsFile(p) { return !p.fileId && p.status !== 'rejected'; }

  /* ---------- Ghép nối ---------- */
  function needOn(n, code) {
    if (!n) return false;
    var map = { council: 'council', supervise: 'supervise', consult: 'consult', joint: 'jointResearch', guest: 'guestLecture', team: 'teamUp' };
    return String(n[map[code]]).toLowerCase() === 'true';
  }
  /**
   * Chấm điểm một chuyên gia cho một nhu cầu. Lọc điều kiện TRƯỚC, rồi mới xếp hạng.
   * e = { profile, needs, degree, pubs }, need = { needType, level, tags, goal }
   */
  function matchScore(e, need, today, rules) {
    var reasons = [], blockers = [];
    var n = e.needs || {};
    if (!needOn(n, need.needType)) blockers.push('Chưa bật nhu cầu "' + labelOf(NEED_TYPES, need.needType) + '".');
    if (n.availability && n.availability !== 'ready') blockers.push('Đang tạm dừng nhận đề xuất.');
    if (n.until && today && str(n.until) < str(today)) blockers.push('Thời hạn nhận đề xuất đã hết (' + fmtDate(n.until) + ').');
    if (String(n.allowSuggest).toLowerCase() === 'false') blockers.push('Không nhận đề xuất qua hệ thống.');
    if (need.level && (need.needType === 'council' || need.needType === 'supervise')) {
      var el = eligible(e.degree, need.level, rules);
      if (!el.ok) blockers.push(el.reason);
    }
    var p = e.profile || {};
    var corpus = fold([p.field, p.keywords, p.bio, n.teachField, n.consultField, n.researchDirection]
      .concat((e.pubs || []).filter(function (x) { return x.status !== 'rejected'; }).map(function (x) { return x.title + ' ' + (x.keywords || ''); }))
      .join(' | '));
    var score = 0, hits = [];
    (need.tags || []).forEach(function (t) {
      var ft = fold(trim(t));
      if (ft && corpus.indexOf(ft) >= 0) { score += 22; hits.push(t); }
    });
    var ws = words(need.goal), wh = 0;
    ws.forEach(function (w) { if (w.length > 2 && corpus.indexOf(w) >= 0) wh++; });
    score += Math.min(30, wh * 5);
    if (needOn(n, need.needType)) { score += 20; reasons.push('Đang bật nhu cầu ' + labelOf(NEED_TYPES, need.needType).toLowerCase()); }
    if (hits.length) reasons.push('Trùng chủ đề: ' + hits.join(', '));
    if (wh) reasons.push(wh + ' từ khóa mục tiêu xuất hiện trong hồ sơ/công bố');
    var verifiedPubs = (e.pubs || []).filter(function (x) { return x.status === 'verified'; }).length;
    if (verifiedPubs) { score += Math.min(10, verifiedPubs * 3); reasons.push(verifiedPubs + ' công bố đã xác minh'); }
    if (e.degree) reasons.push('Học vị: ' + e.degree);
    score = Math.min(100, score);
    return {
      score: score, eligible: blockers.length === 0, blockers: blockers, reasons: reasons,
      band: score >= 60 ? 'high' : score >= 30 ? 'mid' : 'low'
    };
  }
  function labelOf(list, code) {
    for (var i = 0; i < list.length; i++) if (list[i].code === code) return list[i].label;
    return code || '';
  }

  /* ---------- Thống kê theo kỳ ---------- */
  function periodKey(iso, by) {
    var m = str(iso).match(/^(\d{4})-(\d{2})/);
    if (!m) return '';
    return by === 'quarter' ? m[1] + '-Q' + Math.ceil(+m[2] / 3) : m[1] + '-' + m[2];
  }
  function periodLabel(key) {
    var q = key.match(/^(\d{4})-Q(\d)$/);
    if (q) return 'Quý ' + q[2] + '/' + q[1];
    var m = key.match(/^(\d{4})-(\d{2})$/);
    return m ? 'Tháng ' + m[2] + '/' + m[1] : key;
  }
  /** Ngày dùng để thống kê: "upload" = lần tải lên đầu tiên; "publish" = năm/tháng xuất bản. */
  function statDate(p, basis) {
    if (basis === 'publish') return p.year ? p.year + '-' + pad(+(p.month || 1)) + '-01' : '';
    return str(p.uploadedAt).slice(0, 10);
  }

  /* ---------- Đọc file Word (.docx → document.xml) ---------- */
  function xmlText(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  /**
   * document.xml → { paras: [chuỗi ngoài bảng], tables: [[[ô]]], blocks: [{p}|{t}] theo thứ tự }.
   * Ô bảng giữ xuống dòng giữa các đoạn. Bảng lồng nhau được trải phẳng vào ô cha.
   */
  function docxToDoc(xml) {
    var re = /<(\/?)w:(tbl|tr|tc|p|t|tab|br|cr)\b([^>]*?)(\/?)>/g, m;
    var stack = [], paras = [], tables = [], blocks = [];
    var cur = null, inText = false, textStart = 0;
    var tbl = null, row = null, cell = null, depth = 0;
    while ((m = re.exec(xml))) {
      var close = m[1] === '/', tag = m[2], self = m[4] === '/';
      if (tag === 't') {
        if (!close && !self) { inText = true; textStart = re.lastIndex; }
        else if (close && inText) { if (cur !== null) cur += xmlText(xml.slice(textStart, m.index)); inText = false; }
        continue;
      }
      if (tag === 'tab' && !close) { if (cur !== null) cur += '\t'; continue; }
      if ((tag === 'br' || tag === 'cr') && !close) { if (cur !== null) cur += '\n'; continue; }
      if (tag === 'p') {
        if (self) { if (depth === 0) { paras.push(''); } continue; }
        if (!close) cur = '';
        else {
          var text = (cur || '').replace(/[ \u00a0]+/g, ' ');
          if (depth > 0 && cell) cell.push(text);
          else { paras.push(text); blocks.push({ p: text }); }
          cur = null;
        }
        continue;
      }
      if (tag === 'tbl') {
        if (!close) { depth++; if (depth === 1) { tbl = []; } stack.push('tbl'); }
        else { stack.pop(); depth--; if (depth === 0 && tbl) { tables.push(tbl); blocks.push({ t: tbl }); tbl = null; } }
        continue;
      }
      if (depth !== 1) continue;            // bảng lồng: chỉ gom chữ vào ô ngoài cùng
      if (tag === 'tr') { if (!close) row = []; else { if (row && tbl) tbl.push(row); row = null; } }
      if (tag === 'tc') { if (!close) cell = []; else { if (cell && row) row.push(cell.join('\n').replace(/\n+$/, '')); cell = null; } }
    }
    return { paras: paras, tables: tables, blocks: blocks };
  }

  /* ---------- Tách lý lịch khoa học theo mẫu Bộ GD&ĐT ---------- */
  var LLKH_LABELS = [
    ['fullName', 'Họ và tên'], ['gender', 'Giới tính'], ['dob', 'Ngày, tháng, năm sinh'], ['birthPlace', 'Nơi sinh'],
    ['hometown', 'Quê quán'], ['ethnicity', 'Dân tộc'], ['_degree', 'Học vị cao nhất'], ['_degreeYC', 'Năm, nước nhận học vị'],
    ['_title', 'Chức danh khoa học cao nhất'], ['_titleYear', 'Năm bổ nhiệm'],
    ['position', 'Chức vụ (hiện tại hoặc trước khi nghỉ hưu)'], ['unit', 'Đơn vị công tác (hiện tại hoặc trước khi nghỉ hưu)'],
    ['address', 'Chỗ ở riêng hoặc địa chỉ liên lạc'], ['_phone', 'Điện thoại liên hệ'], ['phoneOffice', 'CQ'], ['phoneHome', 'NR'], ['mobile', 'DĐ'],
    ['fax', 'Fax'], ['contactEmail', 'E-mail'], ['idNumber', 'Số CMND'], ['idDate', 'Ngày cấp'], ['idPlace', 'Nơi cấp'],
    ['_sec2', 'QUÁ TRÌNH ĐÀO TẠO'], ['_ug', 'Đại học'],
    ['ugSystem', 'Hệ đào tạo'], ['ugPlace', 'Nơi đào tạo'], ['ugMajor', 'Ngành học'], ['ugCountry', 'Nước đào tạo'], ['ugYear', 'Năm tốt nghiệp'],
    ['ug2Major', 'Bằng đại học 2'], ['ug2Year', 'Năm tốt nghiệp'], ['_pg', 'Sau đại học'],
    ['msMajor', 'Thạc sĩ chuyên ngành'], ['msYear', 'Năm cấp bằng'], ['msPlace', 'Nơi đào tạo'],
    ['phdMajor', 'Tiến sĩ chuyên ngành'], ['phdYear', 'Năm cấp bằng'], ['phdPlace', 'Nơi đào tạo'],
    ['thesis', 'Tên luận án'], ['_lang', 'Ngoại ngữ'], ['_sec3', 'QUÁ TRÌNH CÔNG TÁC CHUYÊN MÔN']
  ];
  function labelRe(label) {
    var body = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+').replace(/,/g, '\\s*,');
    var pre = label.length <= 3 ? '(?:^|[\\s:;,.])' : '';   // nhãn ngắn (CQ, NR, DĐ) phải đứng riêng
    return new RegExp(pre + body + (label.length <= 3 ? '(?=\\s*:)' : ''), 'i');
  }
  function cleanVal(s) {
    return str(s).replace(/^[\s:：]+/, '').replace(/[.…·_]{2,}/g, ' ').replace(/\s*[-–]\s*$/, '')
      .replace(/^\s*\d\.\s*$/, '').replace(/\s+/g, ' ').replace(/(?:^|\s)(?:[IVX]{1,4}|\d)\.\s*$/, '')
      .replace(/^[\s:,;]+|[\s:,;]+$/g, '').trim();
  }
  function headerKind(row) {
    var h = fold(row.join(' | '));
    if (/thoi gian/.test(h) && /noi cong tac/.test(h)) return 'work';
    if (/ten de tai/.test(h)) return 'projects';
    if (/ten cong trinh|cong trinh khoa hoc|ten bai bao/.test(h)) return 'pubs';
    if (/ten sach|giao trinh/.test(h)) return 'books';
    if (/giai thuong|khen thuong/.test(h)) return 'awards';
    if (/ngoai ngu|muc do su dung/.test(h)) return 'lang';
    if (/xac nhan cua co quan|nguoi khai/.test(h)) return 'sign';
    return '';
  }
  function splitPeriod(s) {
    var t = trim(s).replace(/[–—]/g, '-');
    var m = t.match(/((?:\d{1,2}\/)?(?:19|20)\d{2})\s*(?:-|đến|\/|to)\s*((?:\d{1,2}\/)?(?:19|20)\d{2}|nay|hiện nay|hien nay|now|present)?/i);
    if (!m) return { from: yearOf(t), to: '' };
    var to = m[2] || '';
    if (/nay|now|present/i.test(to)) to = 'nay';
    return { from: m[1], to: to };
  }
  /**
   * doc = { paras, tables } → bản nháp. Mỗi trường có { value, flag } ; flag = lý do cần kiểm tra.
   * Không ghi gì vào hồ sơ: chỉ tạo bản nháp để người dùng rà soát.
   */
  function parseLLKH(doc, ctx) {
    ctx = ctx || {};
    var text = (doc.paras || []).join('\n');
    var out = { fields: {}, languages: [], work: [], projects: [], pubs: [], books: [], awards: [], credentials: [], notes: [], template: false };
    // 1) Vị trí từng nhãn, tìm tuần tự để nhãn trùng tên (Nơi đào tạo, Năm cấp bằng) rơi đúng mục
    var found = [], pos = 0;
    LLKH_LABELS.forEach(function (l) {
      var re = labelRe(l[1]);
      var sub = text.slice(pos), mm = sub.match(re);
      if (!mm) return;
      var start = pos + mm.index + (mm[0].length - mm[0].replace(/^[\s:;,.]/, '').length);
      var end = pos + mm.index + mm[0].length;
      found.push({ key: l[0], start: start, end: end });
      pos = end;
    });
    out.template = found.length >= 8 || /LÝ\s+LỊCH\s+KHOA\s+HỌC/i.test(text);
    for (var i = 0; i < found.length; i++) {
      var f = found[i], next = found[i + 1];
      var raw = text.slice(f.end, next ? next.start : Math.min(text.length, f.end + 300));
      if (!next) raw = raw.split('\n')[0];
      raw = raw.replace(/\n[\s\S]*$/, function (rest) { return /^\n\s*[-–•]?\s*$/.test(rest) ? '' : rest; });
      var v = cleanVal(raw.replace(/\n+/g, ' '));
      if (f.key.charAt(0) !== '_' && v) set(f.key, v);
      if (f.key === '_degree') out._degree = v;
      if (f.key === '_degreeYC') out._degreeYC = v;
      if (f.key === '_title') out._title = v;
      if (f.key === '_titleYear') out._titleYear = v;
    }
    // Kiểm tra từng trường
    if (out.fields.dob) {
      var d = parseDate(out.fields.dob.value);
      if (!d.ok) flag('dob', 'Không đọc được ngày sinh. Nhập theo dd/mm/yyyy.');
      else { out.fields.dob.value = d.iso; if (d.partial) flag('dob', 'CV chỉ ghi ' + (d.partial === 'year' ? 'năm' : 'tháng/năm') + ' sinh. Đối chiếu ngày và tháng trong CV.'); }
    }
    ['idDate'].forEach(function (k) {
      if (!out.fields[k]) return;
      var d2 = parseDate(out.fields[k].value);
      if (d2.ok) out.fields[k].value = d2.iso; else flag(k, 'Ngày cấp chưa đúng định dạng dd/mm/yyyy.');
    });
    ['ugYear', 'ug2Year', 'msYear', 'phdYear'].forEach(function (k) {
      if (out.fields[k] && !/^(19|20)\d{2}$/.test(out.fields[k].value)) {
        var y = yearOf(out.fields[k].value);
        if (y) out.fields[k].value = y; else flag(k, 'Năm không hợp lệ.');
      }
    });
    if (out.fields.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.fields.contactEmail.value)) flag('contactEmail', 'Email chưa đúng định dạng.');
    if (out.fields.gender) {
      var g = fold(out.fields.gender.value);
      out.fields.gender.value = /^nu|female/.test(g) ? 'Nữ' : /^nam|male/.test(g) ? 'Nam' : out.fields.gender.value;
    }
    // Học vị / chức danh → sự kiện chờ xác minh (không ghi thẳng vào hồ sơ)
    var deg = normDegree(out._degree);
    if (out._degree) {
      var yc = str(out._degreeYC);
      out.credentials.push({
        kind: 'degree', value: deg || out._degree, date: yearOf(yc) ? yearOf(yc) + '-01-01' : '',
        country: cleanVal(yc.replace(/(19|20)\d{2}/, '')), flag: deg ? (yearOf(yc) ? '' : 'Thiếu năm nhận học vị.') : 'Không nhận ra học vị trong danh mục.'
      });
    }
    var tt = normTitleRank(out._title);
    if (out._title && fold(out._title).replace(/[^a-z]/g, '') && !/^khong|^chua/.test(fold(out._title))) {
      out.credentials.push({
        kind: 'title', value: tt || out._title, date: yearOf(out._titleYear) ? yearOf(out._titleYear) + '-01-01' : '',
        flag: tt ? '' : 'Không nhận ra chức danh trong danh mục.'
      });
    }
    if (out.fields.position) out.credentials.push({ kind: 'position', value: out.fields.position.value, date: '', flag: 'Bổ sung ngày bổ nhiệm và minh chứng.' });
    // 2) Bảng
    (doc.tables || []).forEach(function (t) {
      if (!t.length) return;
      var kind = '', hi = 0;
      for (var r = 0; r < Math.min(2, t.length) && !kind; r++) { kind = headerKind(t[r]); hi = r; }
      if (!kind) {
        // Bảng ngoại ngữ trong mẫu không có hàng tiêu đề riêng
        if (/ngoai ngu|muc do su dung/.test(fold(JSON.stringify(t)))) { kind = 'lang'; hi = -1; }
        else return;
      }
      var rows = t.slice(hi + 1).filter(function (row) {
        return row.some(function (c, ci) { return ci > 0 && cleanVal(c); }) || (row.length === 1 && cleanVal(row[0]));
      });
      if (kind === 'lang') return parseLang(t);
      rows.forEach(function (row) {
        var c = row.map(function (x) { return trim(x); });
        if (kind === 'work') {
          var per = splitPeriod(c[0]);
          if (!cleanVal(c[1]) && !cleanVal(c[2])) return;
          out.work.push({ from: per.from, to: per.to, place: cleanVal(c[1]), role: cleanVal(c[2]), flag: per.from ? '' : 'Thiếu mốc thời gian.' });
        } else if (kind === 'projects') {
          var off = /^\d+\.?$/.test(c[0]) || !c[0] ? 1 : 0;
          var yrs = splitPeriod(c[off + 1]);
          if (!cleanVal(c[off])) return;
          out.projects.push({ name: cleanVal(c[off]), from: yrs.from, to: yrs.to, level: cleanVal(c[off + 2]), role: cleanVal(c[off + 3]), flag: yrs.from ? '' : 'Thiếu năm bắt đầu/hoàn thành.' });
        } else if (kind === 'pubs' || kind === 'books') {
          var o2 = /^\d+\.?$/.test(c[0]) || !c[0] ? 1 : 0;
          var title = cleanVal(c[o2]);
          if (!title) return;
          var ref = parseRef(title);
          var p = {
            title: ref.title || title, authors: ref.authors || ctx.ownerName || '', year: yearOf(c[o2 + 1]) || ref.year,
            venue: cleanVal(c[o2 + 2]) || ref.venue, doi: ref.doi, type: kind === 'books' ? 'book' : (/hoi nghi|conference|proceedings|ky yeu/.test(fold(c[o2 + 2] + ' ' + title)) ? 'conference' : 'journal'),
            flag: ''
          };
          if (/giao trinh/.test(fold(title))) p.type = 'textbook';
          if (!ref.authors) p.flag = 'CV không ghi tác giả: đã điền tên chủ hồ sơ, cần kiểm tra.';
          if (!p.year) p.flag = 'Thiếu năm công bố.';
          (p.type === 'journal' || p.type === 'conference' ? out.pubs : out.books).push(p);
        } else if (kind === 'awards') {
          var o3 = /^\d+\.?$/.test(c[0]) ? 1 : 0;
          if (!cleanVal(c[o3])) return;
          out.awards.push({ name: cleanVal(c[o3]), year: yearOf(c.join(' ')), org: cleanVal(c[o3 + 2] || c[o3 + 1]), flag: '' });
        }
      });
    });
    // Ngoại ngữ viết thành đoạn văn (không nằm trong bảng)
    if (!out.languages.length) {
      var lm = text.match(/Ngoại\s+ngữ\s*:?([\s\S]{0,400}?)(?:\n\s*III\.|QUÁ TRÌNH CÔNG TÁC|$)/i);
      if (lm) parseLangText(lm[1]);
    }
    // Công bố nằm trong đoạn văn (CV tự do): dòng có DOI hoặc dạng trích dẫn
    if (!out.pubs.length && !out.template) {
      (doc.paras || []).forEach(function (line) {
        if (/10\.\d{4,9}\//.test(line) || /\((19|20)\d{2}\)\s*\.?/.test(line)) {
          var r2 = parseRef(line);
          if (r2.title) out.pubs.push({ title: r2.title, authors: r2.authors, year: r2.year, venue: r2.venue, doi: r2.doi, type: 'journal', flag: 'Tách từ đoạn văn, cần kiểm tra.' });
        }
      });
    }
    if (!out.template) {
      out.notes.push('File không theo mẫu lý lịch khoa học: chỉ tách được thông tin dạng nhãn và các dòng trích dẫn.');
      var em = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      if (em && !out.fields.contactEmail) set('contactEmail', em[0]);
    }
    // Trùng với hồ sơ hiện tại
    out.pubs.concat(out.books).forEach(function (p) {
      var dup = findDup(p, ctx.existingPubs || []);
      if (dup) p.dup = { id: dup.id, title: dup.title, status: dup.status };
    });
    var flagged = 0, total = 0;
    Object.keys(out.fields).forEach(function (k) { total++; if (out.fields[k].flag) flagged++; });
    ['work', 'projects', 'pubs', 'books', 'awards', 'credentials'].forEach(function (k) {
      out[k].forEach(function (x) { total++; if (x.flag) flagged++; });
    });
    total += out.languages.length;
    out.summary = {
      total: total, flagged: flagged,
      dups: out.pubs.concat(out.books).filter(function (p) { return p.dup; }).length
    };
    delete out._degree; delete out._degreeYC; delete out._title; delete out._titleYear;
    return out;

    function set(k, v) { out.fields[k] = { value: v, flag: '' }; }
    function flag(k, why) { if (out.fields[k]) out.fields[k].flag = why; }
    function parseLang(t) {
      var names = [], levels = [];
      t.forEach(function (row) {
        row.forEach(function (cell) {
          str(cell).split('\n').forEach(function (ln) {
            var lv = ln.match(/M[ứu]c\s+đ[ộo]\s+s[ửu]\s+d[ụu]ng\s*:?(.*)$/i);
            if (lv) { levels.push(cleanVal(lv[1])); return; }
            var nm = ln.match(/^\s*\d\s*[.)]\s*(.*)$/);
            if (nm && !/ngoai ngu/.test(fold(nm[1]))) names.push(cleanVal(nm[1]));
          });
        });
      });
      names.forEach(function (n, i) { if (n) out.languages.push({ name: n, level: levels[i] || '' }); });
    }
    function parseLangText(s) {
      var re2 = /\d\s*[.)]\s*([^\n\d]+?)\s*M[ứu]c\s+đ[ộo]\s+s[ửu]\s+d[ụu]ng\s*:?\s*([^\n]*)/gi, mm2;
      while ((mm2 = re2.exec(s))) { var nn = cleanVal(mm2[1]); if (nn) out.languages.push({ name: nn, level: cleanVal(mm2[2]) }); }
    }
  }

  /**
   * Một dòng trích dẫn → { authors, year, title, venue, doi }.
   * Hỗ trợ APA "Tác giả (2024). Tiêu đề. Tạp chí, 12(3)." và dạng "Tiêu đề, Tạp chí, 2024".
   */
  function parseRef(line) {
    var s = trim(line).replace(/^\[?\d+[\].)]\s*/, '');
    var out = { authors: '', year: '', title: '', venue: '', doi: '' };
    var dm = s.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[^\s,;]+)/i);
    if (dm) { out.doi = dm[1].replace(/[.)]+$/, ''); s = trim(s.replace(dm[0], '')).replace(/[.,;]\s*$/, ''); }
    var apa = s.match(/^(.+?)\s*\(((?:19|20)\d{2})[a-z]?\)\s*\.?\s*(.+)$/);
    if (apa) {
      out.authors = trim(apa[1]).replace(/[,.]$/, ''); out.year = apa[2];
      var rest = apa[3], dot = splitSentence(rest);
      out.title = dot[0]; out.venue = trim(dot[1]).replace(/[.,]$/, '');
      return out;
    }
    out.year = yearOf(s);
    var parts = s.split(/\.\s+|,\s+/);
    if (parts.length >= 2 && /,| và | and |;/.test(parts[0]) === false && parts[0].split(' ').length > 3) {
      out.title = trim(parts[0]); out.venue = trim(parts.slice(1).join(', ').replace(/(19|20)\d{2}/, '')).replace(/^[,.\s]+|[,.\s]+$/g, '');
    } else { out.title = trim(s.replace(/(19|20)\d{2}/, '')).replace(/[,.\s]+$/, ''); }
    return out;
    function splitSentence(t) {
      var i = t.search(/[.?!]\s+[A-ZĐÂĂÊÔƠƯÁÀẢÃẠ]/);
      return i < 0 ? [trim(t).replace(/\.$/, ''), ''] : [trim(t.slice(0, i)), t.slice(i + 1)];
    }
  }

  return {
    DEGREES: DEGREES, TITLES: TITLES, NEED_TYPES: NEED_TYPES, LEVELS: LEVELS, PUB_TYPES: PUB_TYPES, PUB_STATUS: PUB_STATUS,
    CRED_KINDS: CRED_KINDS, PROJECT_LEVELS: PROJECT_LEVELS, PROJECT_ROLES: PROJECT_ROLES, PROFILE_FIELDS: PROFILE_FIELDS,
    str: str, trim: trim, fold: fold, normTitle: normTitle, normDoi: normDoi, isDoi: isDoi, words: words, pad: pad,
    parseDate: parseDate, fmtDate: fmtDate, yearOf: yearOf, rankOf: rankOf, normDegree: normDegree, normTitleRank: normTitleRank,
    highest: highest, eligible: eligible, completeness: completeness, sameWork: sameWork, findDup: findDup, dedupe: dedupe,
    pubNeedsFile: pubNeedsFile, needOn: needOn, matchScore: matchScore, labelOf: labelOf, periodKey: periodKey,
    periodLabel: periodLabel, statDate: statDate, docxToDoc: docxToDoc, parseLLKH: parseLLKH, parseRef: parseRef,
    splitPeriod: splitPeriod
  };
})();
/* ==== SL-SHARED END ==== */

/* =====================================================================
   2. XÁC THỰC GOOGLE OAUTH 2.0 + SESSION TOKEN
   ===================================================================== */
const AUTH = (function () {
  function pad4(s) { const r = s.length % 4; return r ? s + '===='.slice(r) : s; }
  function b64u(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
  function encodeStr(s) { return b64u(Utilities.newBlob(s).getBytes()); }
  function decodeStr(s) { return Utilities.newBlob(Utilities.base64DecodeWebSafe(pad4(String(s)))).getDataAsString(); }

  function secret() {
    let s = prop_('SESSION_SECRET');
    if (!s) { s = Utilities.getUuid() + '-' + Utilities.getUuid(); PROPS.setProperty('SESSION_SECRET', s); }
    return s;
  }
  function sign(payload) { return b64u(Utilities.computeHmacSha256Signature(payload, secret())); }

  /** URL /exec phải trùng tuyệt đối với "Authorized redirect URI". */
  function webAppUrl() {
    let u = prop_('WEBAPP_URL');
    if (u) return u;
    try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { u = ''; }
    return u;
  }
  function isConfigured() { return !!(prop_('OAUTH_CLIENT_ID') && prop_('OAUTH_CLIENT_SECRET') && webAppUrl()); }

  /** Token không lưu ở server: email + tên + hạn, ký HMAC. Đổi SESSION_SECRET là huỷ mọi phiên. */
  function makeToken(profile) {
    const body = encodeStr(JSON.stringify({
      e: String(profile.email || '').toLowerCase(), n: String(profile.name || ''),
      x: Date.now() + SESSION_HOURS * 3600 * 1000
    }));
    return body + '.' + sign(body);
  }
  function readToken(token) {
    if (!token) return null;
    const parts = String(token).split('.');
    if (parts.length !== 2 || sign(parts[0]) !== parts[1]) return null;
    let d;
    try { d = JSON.parse(decodeStr(parts[0])); } catch (e) { return null; }
    if (!d || !d.e || !d.x || Number(d.x) < Date.now()) return null;
    return { email: String(d.e).toLowerCase().trim(), name: String(d.n || '') };
  }

  function loginUrl() {
    if (!isConfigured()) return '';
    const state = Utilities.getUuid().replace(/-/g, '');
    CacheService.getScriptCache().put('oauth_state_' + state, '1', 3600);
    const q = {
      client_id: prop_('OAUTH_CLIENT_ID'), redirect_uri: webAppUrl(), response_type: 'code',
      scope: 'openid email profile', state: state, prompt: 'select_account', access_type: 'online'
    };
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
  }
  function exchangeCode(code) {
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post', muteHttpExceptions: true,
      payload: {
        code: code, client_id: prop_('OAUTH_CLIENT_ID'), client_secret: prop_('OAUTH_CLIENT_SECRET'),
        redirect_uri: webAppUrl(), grant_type: 'authorization_code'
      }
    });
    let body = {};
    try { body = JSON.parse(res.getContentText() || '{}'); } catch (e) {}
    if (res.getResponseCode() !== 200 || !body.id_token) {
      throw new Error(body.error_description || body.error || 'Google từ chối mã đăng nhập (HTTP ' + res.getResponseCode() + ').');
    }
    return readIdToken(body.id_token);
  }
  function readIdToken(jwt) {
    const seg = String(jwt).split('.');
    if (seg.length < 2) throw new Error('id_token không hợp lệ.');
    let c;
    try { c = JSON.parse(decodeStr(seg[1])); } catch (e) { throw new Error('Không đọc được id_token.'); }
    if (String(c.aud) !== prop_('OAUTH_CLIENT_ID')) throw new Error('id_token không thuộc ứng dụng này.');
    if (['accounts.google.com', 'https://accounts.google.com'].indexOf(String(c.iss)) < 0) throw new Error('id_token không do Google phát hành.');
    if (Number(c.exp) * 1000 < Date.now()) throw new Error('id_token đã hết hạn.');
    if (c.email_verified === false) throw new Error('Email Google này chưa được xác minh.');
    if (!c.email) throw new Error('Không lấy được email từ tài khoản Google.');
    return { email: String(c.email).toLowerCase().trim(), name: String(c.name || c.given_name || '').trim() };
  }
  /** Mã trao tay một lần: token không nằm lại trên thanh địa chỉ. */
  function putHandoff(token) {
    const code = Utilities.getUuid().replace(/-/g, '');
    CacheService.getScriptCache().put('handoff_' + code, token, 180);
    return code;
  }
  function takeHandoff(code) {
    if (!code) return '';
    const cache = CacheService.getScriptCache();
    const t = cache.get('handoff_' + code) || '';
    if (t) cache.remove('handoff_' + code);
    return t;
  }
  function checkState(state) {
    if (!state) return false;
    const cache = CacheService.getScriptCache();
    const hit = cache.get('oauth_state_' + state);
    if (hit) cache.remove('oauth_state_' + state);
    return !!hit;
  }
  return { isConfigured, webAppUrl, loginUrl, exchangeCode, makeToken, readToken, putHandoff, takeHandoff, checkState };
})();

/* =====================================================================
   3. CƠ SỞ DỮ LIỆU GOOGLE SHEETS
   ===================================================================== */
const SCHEMA = {
  Users: ['email', 'name', 'roles', 'unit', 'status', 'createdAt', 'createdBy', 'lastLogin', 'requestedRole', 'reviewNote', 'reviewedBy', 'reviewedAt'],
  Profiles: ['email'].concat(SL.PROFILE_FIELDS.map(f => f.key)).concat(['updatedAt']),
  Credentials: ['id', 'email', 'kind', 'value', 'date', 'country', 'fileId', 'fileName', 'status', 'source', 'note', 'reviewNote', 'prevHighest', 'reviewedBy', 'reviewedAt', 'createdAt'],
  Work: ['id', 'email', 'from', 'to', 'place', 'role', 'order'],
  Projects: ['id', 'email', 'name', 'from', 'to', 'level', 'role', 'order'],
  Publications: ['id', 'email', 'type', 'title', 'authors', 'year', 'month', 'venue', 'issn', 'volume', 'pages', 'doi', 'keywords',
    'fileId', 'fileName', 'status', 'source', 'metaStatus', 'metaNote', 'reviewNote', 'reviewedBy', 'reviewedAt', 'uploadedAt', 'updatedAt'],
  Awards: ['id', 'email', 'name', 'year', 'org', 'note', 'order'],
  Needs: ['email', 'council', 'councilLevel', 'supervise', 'superviseLevel', 'consult', 'jointResearch', 'guestLecture', 'teamUp',
    'teachField', 'consultField', 'researchDirection', 'availability', 'until', 'area', 'allowSuggest', 'updatedAt'],
  Rounds: ['id', 'title', 'needType', 'level', 'period', 'goal', 'tags', 'partner', 'status', 'createdBy', 'createdAt', 'sentAt'],
  Matches: ['id', 'roundId', 'email', 'score', 'reason', 'status', 'note', 'createdAt', 'sentAt', 'respondedAt'],
  Files: ['id', 'email', 'name', 'mime', 'size', 'link', 'kind', 'version', 'access', 'uploadedAt', 'uploadedBy'],
  Catalog: ['type', 'code', 'label', 'rank', 'active'],
  Support: ['id', 'email', 'subject', 'body', 'status', 'reply', 'createdAt', 'repliedAt', 'repliedBy'],
  Settings: ['key', 'value'],
  Logs: ['time', 'email', 'action', 'target', 'detail']
};

function ss_() {
  const id = prop_('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); }
    catch (e) { throw new Error('Không mở được Google Sheet (ID ' + id + '). Quản trị viên chạy setup_() để tạo lại.'); }
  }
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) ss = SpreadsheetApp.create('CSDL Fluxience');
  PROPS.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

/** Bộ nhớ đệm trong một lần chạy: đọc mỗi bảng tối đa một lần. */
let MEMO_ = {};
function T_(name) {
  if (MEMO_[name]) return MEMO_[name];
  const sh = ss_().getSheetByName(name);
  const cols = SCHEMA[name];
  if (!sh || sh.getLastRow() < 2) return (MEMO_[name] = []);
  const vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  const head = vals[0].map(h => String(h).trim());
  const rows = [];
  for (let i = 1; i < vals.length; i++) {
    const r = {};
    let any = false;
    cols.forEach(c => { const j = head.indexOf(c); r[c] = j >= 0 ? String(vals[i][j]) : ''; if (r[c]) any = true; });
    if (any) rows.push(r);
  }
  return (MEMO_[name] = rows);
}
/** Ghi lại cả bảng. Mọi ô lưu dạng văn bản để Sheets không tự đổi ngày/giờ hay chạy công thức. */
function save_(name, rows) {
  const ss = ss_();
  const cols = SCHEMA[name];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const matrix = [cols].concat(rows.map(r => cols.map(c => {
    let v = r[c];
    if (v === undefined || v === null) v = '';
    if (typeof v === 'object') v = JSON.stringify(v);
    v = String(v);
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return v.length > 49000 ? v.slice(0, 49000) : v;
  })));
  sh.clearContents();
  const rg = sh.getRange(1, 1, matrix.length, cols.length);
  rg.setNumberFormat('@');
  rg.setValues(matrix);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  MEMO_[name] = rows;
}
function upsert_(name, row, key) {
  key = key || 'id';
  const rows = T_(name).slice();
  const i = rows.findIndex(r => r[key] === row[key]);
  if (i >= 0) rows[i] = Object.assign({}, rows[i], row); else rows.push(row);
  save_(name, rows);
  return i >= 0 ? rows[i] : row;
}
function uid_(p) { return (p || '') + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(); }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function bool_(v) { return String(v).toLowerCase() === 'true'; }
function clip_(v, n) { return SL.trim(v).slice(0, n || 500); }

function log_(email, action, target, detail) {
  try {
    const sh = ss_().getSheetByName('Logs') || ss_().insertSheet('Logs');
    if (sh.getLastRow() === 0) sh.appendRow(SCHEMA.Logs);
    sh.appendRow([now_(), email || 'system', action, target || '', String(detail || '').slice(0, 1000)]);
  } catch (e) {}
}

/** Chạy fn trong khoá ghi; đọc dữ liệu BÊN TRONG fn để không đè thay đổi của người khác. */
function tx_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Hệ thống đang xử lý thao tác khác. Thử lại sau vài giây.');
  try { MEMO_ = {}; return fn(); }
  finally { lock.releaseLock(); }
}

function settings_() {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  T_('Settings').forEach(r => { if (r.key) s[r.key] = r.value; });
  return s;
}
function levelRules_(st) {
  try { const r = JSON.parse(st.LEVEL_RULES || ''); if (Array.isArray(r) && r.length) return r; } catch (e) {}
  return SL.LEVELS;
}
function catalog_() {
  const out = {};
  T_('Catalog').forEach(r => {
    if (String(r.active).toLowerCase() === 'false') return;
    (out[r.type] = out[r.type] || []).push({ code: r.code, label: r.label, rank: Number(r.rank || 0) });
  });
  return out;
}
function degreeList_(cat) { return (cat.degree && cat.degree.length) ? cat.degree : SL.DEGREES; }
function titleList_(cat) { return (cat.title && cat.title.length) ? cat.title : SL.TITLES; }

/** Học vị / chức danh cao nhất đã xác minh, tính ở server. */
function derived_(email, cat) {
  cat = cat || catalog_();
  const creds = T_('Credentials').filter(c => c.email === email);
  const d = SL.highest(creds, 'degree', degreeList_(cat));
  const t = SL.highest(creds, 'title', titleList_(cat));
  const p = SL.highest(creds, 'position');
  return { degree: d ? d.value : '', degreeDate: d ? d.date : '', title: t ? t.value : '', titleDate: t ? t.date : '', position: p ? p.value : '' };
}

/* =====================================================================
   4. ĐIỂM VÀO WEB APP
   ===================================================================== */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.error) return errorPage_('Đăng nhập chưa hoàn tất', 'Google báo: ' + p.error + '. Bạn có thể thử lại.');
  if (p.code) {
    try {
      if (!AUTH.checkState(p.state)) return errorPage_('Phiên đăng nhập đã hết hạn', 'Liên kết đăng nhập chỉ dùng được trong 60 phút. Mở lại ứng dụng và bấm "Đăng nhập với Google".');
      const profile = AUTH.exchangeCode(p.code);
      log_(profile.email, 'login', '', '');
      const handoff = AUTH.putHandoff(AUTH.makeToken(profile));
      return redirectPage_(AUTH.webAppUrl() + '?t=' + handoff, profile.email);
    } catch (err) {
      return errorPage_('Đăng nhập thất bại', (err && err.message) || String(err));
    }
  }
  let boot = '';
  try { boot = AUTH.takeHandoff(p.t); } catch (err) {}
  let html;
  try { html = HtmlService.createTemplateFromFile('Index').evaluate().getContent(); }
  catch (err) { return errorPage_('Thiếu tệp giao diện', 'Tạo đúng các tệp HTML Index, Styles, Scripts, rồi lưu và cập nhật phiên bản triển khai.'); }
  html = html.replace('__SL_BOOT_TOKEN__', boot.replace(/[^A-Za-z0-9._\-]/g, ''));
  let name = DEFAULT_SETTINGS.APP_NAME;
  try { name = settings_().APP_NAME || name; } catch (err) {}
  if (name === 'ScholarLink') name = 'Fluxience';
  return HtmlService.createHtmlOutput(html)
    .setTitle(name + ' · Hồ sơ khoa học')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function shellPage_(inner) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="vi"><head><base target="_top"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&display=swap" rel="stylesheet">' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8fb;font-family:"Be Vietnam Pro",system-ui,sans-serif;color:#172b45}' +
    '.card{width:min(440px,calc(100% - 32px));background:#fff;border:1px solid #d9e1ea;border-radius:12px;padding:32px}' +
    'h1{font-size:20px;font-weight:600;margin:0 0 8px}p{color:#56677d;margin:0 0 20px;line-height:1.6;font-size:14px}' +
    '.btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-weight:500;font-size:14px}</style>' +
    '</head><body><div class="card">' + inner + '</div></body></html>')
    .setTitle('Fluxience').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function redirectPage_(url, email) {
  const safe = esc_(url);
  return shellPage_('<h1>Đăng nhập thành công</h1><p>Xin chào <b>' + esc_(email) + '</b>. Đang kiểm tra quyền truy cập…</p>' +
    '<a class="btn" href="' + safe + '" target="_top">Tiếp tục</a>' +
    '<script>setTimeout(function(){try{window.top.location.href=' + JSON.stringify(String(url)) + ';}catch(e){}},400);<\/script>');
}
function errorPage_(title, msg) {
  const back = esc_(AUTH.webAppUrl() || '');
  return shellPage_('<h1>' + esc_(title) + '</h1><p>' + esc_(msg) + '</p>' + (back ? '<a class="btn" href="' + back + '" target="_top">Quay lại ứng dụng</a>' : ''));
}

/* =====================================================================
   5. PHIÊN LÀM VIỆC & QUYỀN
   ===================================================================== */
function ownerEmail_() {
  let e = prop_('ADMIN_EMAIL').toLowerCase();
  if (!e) { try { e = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (err) {} }
  return e;
}
function rolesOf_(u) { return String(u && u.roles || '').split(/[,\s]+/).filter(Boolean); }

/**
 * Tìm tài khoản của email vừa đăng nhập. Chủ script luôn là quản trị viên.
 * Không có form đăng ký: email chưa được cấp sẽ tự tạo YÊU CẦU TRUY CẬP (status 'pending')
 * để quản trị viên duyệt trong "Duyệt & xác minh → Tài khoản" (trừ khi bật AUTO_DOMAIN).
 */
function account_(email, name, ws) {
  let u = T_('Users').find(x => x.email === email);
  const owner = ownerEmail_();
  const st = settings_();
  const dom = String(st.AUTO_DOMAIN || '').toLowerCase().replace(/^@/, '');
  const autoOk = dom && email.endsWith('@' + dom);
  if (u && !(name && !u.name)) return u;
  if (!u && email !== owner && !autoOk) return requestAccess_(email, name, ws);
  return tx_(() => {
    let x = T_('Users').find(r => r.email === email);
    if (x) { if (name && !x.name) { x.name = name; upsert_('Users', x, 'email'); } return x; }
    x = {
      email: email, name: name || email.split('@')[0], roles: email === owner ? 'admin,expert' : 'expert',
      unit: email === owner ? 'Ban quản trị' : '', status: 'active', createdAt: now_(), createdBy: email === owner ? 'setup' : 'auto-domain', lastLogin: ''
    };
    upsert_('Users', x, 'email');
    log_(email, 'account_created', email, x.createdBy);
    return x;
  });
}

/** Ghi yêu cầu truy cập một lần cho email chưa được cấp; báo quản trị viên qua email. */
function requestAccess_(email, name, ws) {
  return tx_(() => {
    let x = T_('Users').find(r => r.email === email);
    if (x) return x;
    x = {
      email: email, name: name || email.split('@')[0], roles: '', unit: '', status: 'pending', createdAt: now_(), createdBy: 'request', lastLogin: now_(),
      requestedRole: 'expert', reviewNote: '', reviewedBy: '', reviewedAt: ''
    };
    upsert_('Users', x, 'email');
    log_(email, 'access_request', email, x.requestedRole);
    notifyAdmins_('Yêu cầu truy cập mới: ' + email,
      '<p><b>' + esc_(x.name) + '</b> (' + esc_(email) + ') đã đăng nhập Google và xin quyền sử dụng Fluxience.</p>' +
      '<p>Duyệt tại <b>Duyệt &amp; xác minh → Tài khoản</b>.</p>');
    return x;
  });
}

/** Đọc token → { user, email, roles }. Ném lỗi nếu chưa đăng nhập hoặc không có quyền. */
function ctx_(token) {
  const s = AUTH.readToken(token);
  if (!s) throw new Error('Phiên đăng nhập đã hết hạn. Tải lại trang và đăng nhập lại.');
  const u = T_('Users').find(x => x.email === s.email);
  if (!u) throw new Error('Tài khoản ' + s.email + ' chưa được cấp quyền.');
  if (u.status !== 'active') throw new Error('Tài khoản của bạn đang bị khoá.');
  return { user: u, email: s.email, roles: rolesOf_(u) };
}
function admin_(token) {
  const c = ctx_(token);
  if (c.roles.indexOf('admin') < 0) throw new Error('Chỉ quản trị viên mới có quyền thực hiện thao tác này.');
  return c;
}
function expert_(token) {
  const c = ctx_(token);
  if (c.roles.indexOf('expert') < 0) throw new Error('Tài khoản này không có không gian chuyên gia.');
  return c;
}
function publicSettings_(st) {
  return { APP_NAME: st.APP_NAME, ORG_NAME: st.ORG_NAME, SCHOOL_NAME: st.SCHOOL_NAME, CITY: st.CITY, FORM_CODE: st.FORM_CODE, PUB_CRITERIA: st.PUB_CRITERIA };
}

/* =====================================================================
   6. API CHUNG
   ===================================================================== */
function api_bootstrap(token, ws) {
  try {
    if (!AUTH.isConfigured()) {
      return { state: 'error', message: 'Ứng dụng chưa cấu hình đăng nhập Google. Quản trị viên chạy napCauHinh_() trong Apps Script (xem README).' };
    }
    const st = settings_();
    const brand = publicSettings_(st);
    const s = AUTH.readToken(token);
    if (!s) return { state: 'login', authUrl: AUTH.loginUrl(), settings: brand, version: APP_VERSION };
    const u = account_(s.email, s.name, ws);
    if (!u) return { state: 'denied', email: s.email, settings: brand, version: APP_VERSION };
    if (u.status === 'pending') return { state: 'requested', email: s.email, name: u.name, requestedAt: u.createdAt, settings: brand, version: APP_VERSION };
    if (u.status === 'rejected') return { state: 'denied', rejected: true, note: u.reviewNote, email: s.email, settings: brand, version: APP_VERSION };
    if (u.status !== 'active') return { state: 'disabled', email: s.email, settings: brand, version: APP_VERSION };
    const roles = rolesOf_(u);
    if (!roles.length) return { state: 'denied', email: s.email, settings: brand, version: APP_VERSION };
    // Không chọn vai trò khi đăng nhập: tài khoản có quyền quản trị mặc định vào không gian quản trị.
    const w = roles.indexOf(ws) >= 0 ? ws : roles.indexOf('admin') >= 0 ? 'admin' : roles[0];
    if (!u.lastLogin || u.lastLogin.slice(0, 10) !== today_()) {
      try { tx_(() => { const x = T_('Users').find(r => r.email === u.email); if (x) { x.lastLogin = now_(); upsert_('Users', x, 'email'); } }); } catch (e) {}
    }
    const base = {
      state: 'ok', version: APP_VERSION, ws: w, roles: roles, me: { email: u.email, name: u.name, unit: u.unit },
      settings: Object.assign({}, brand, w === 'admin' ? st : {}), catalog: catalog_(), levelRules: levelRules_(st), today: today_()
    };
    return Object.assign(base, w === 'admin' ? adminPayload_() : expertPayload_(u.email));
  } catch (err) {
    return { state: 'error', message: 'Không đọc được dữ liệu: ' + ((err && err.message) || err) };
  }
}

function expertPayload_(email) {
  const mine = name => T_(name).filter(r => r.email === email);
  const rounds = {};
  T_('Rounds').forEach(r => { rounds[r.id] = r; });
  const matches = mine('Matches').filter(m => m.status !== 'draft').map(m => {
    const r = rounds[m.roundId] || {};
    return Object.assign({}, m, { round: { title: r.title, needType: r.needType, period: r.period, goal: r.goal, tags: r.tags, partner: r.partner } });
  });
  return {
    profile: mine('Profiles')[0] || { email: email },
    derived: derived_(email),
    credentials: mine('Credentials'), work: mine('Work'), projects: mine('Projects'), pubs: mine('Publications'),
    awards: mine('Awards'), needs: mine('Needs')[0] || null, matches: matches, files: mine('Files'), support: mine('Support')
  };
}
function adminPayload_() {
  const cat = catalog_();
  const users = T_('Users');
  const derived = {};
  users.forEach(u => { derived[u.email] = derived_(u.email, cat); });
  return {
    users: users, profiles: T_('Profiles'), derivedAll: derived, credentials: T_('Credentials'), pubs: T_('Publications'),
    needsAll: T_('Needs'), work: T_('Work'), projects: T_('Projects'), awards: T_('Awards'),
    rounds: T_('Rounds'), matchesAll: T_('Matches'), files: T_('Files'), supportAll: T_('Support')
  };
}

/* =====================================================================
   7. API CHUYÊN GIA — HỒ SƠ
   ===================================================================== */
function api_saveProfile(token, p) {
  const c = expert_(token);
  p = p || {};
  const errs = [];
  const out = { email: c.email };
  SL.PROFILE_FIELDS.forEach(f => {
    if (!(f.key in p)) return;
    let v = f.type === 'json' ? JSON.stringify(Array.isArray(p[f.key]) ? p[f.key].slice(0, 10).map(x => ({ name: clip_(x.name, 60), level: clip_(x.level, 80) })) : []) : clip_(p[f.key], f.key === 'bio' ? 1500 : 300);
    if (f.type === 'date' && v) { const d = SL.parseDate(v); if (!d.ok) errs.push(f.label + ': ngày không hợp lệ.'); else v = d.iso; }
    if (/Year$/.test(f.key) && v && !/^(19|20)\d{2}$/.test(v)) errs.push(f.label + ': nhập năm 4 chữ số.');
    if (f.key === 'contactEmail' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errs.push('E-mail liên hệ chưa đúng định dạng.');
    if (f.key === 'orcid' && v && !/^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v)) errs.push('ORCID có dạng 0000-0000-0000-0000.');
    out[f.key] = v;
  });
  if (errs.length) throw new Error(errs.join(' '));
  return tx_(() => {
    const cur = T_('Profiles').find(r => r.email === c.email) || {};
    const row = Object.assign({}, cur, out, { updatedAt: now_() });
    upsert_('Profiles', row, 'email');
    if (out.fullName && out.fullName !== c.user.name) {
      const u = T_('Users').find(r => r.email === c.email);
      if (u) { u.name = out.fullName; upsert_('Users', u, 'email'); }
    }
    log_(c.email, 'profile_save', c.email, Object.keys(out).filter(k => k !== 'email').join(', '));
    return { ok: true, profile: row };
  });
}

const LIST_DEF = {
  work: { sheet: 'Work', cols: { from: 20, to: 20, place: 200, role: 200 }, need: 'place' },
  projects: { sheet: 'Projects', cols: { name: 400, from: 20, to: 20, level: 60, role: 60 }, need: 'name' },
  awards: { sheet: 'Awards', cols: { name: 300, year: 10, org: 200, note: 300 }, need: 'name' }
};
/** Thay toàn bộ danh sách công tác / đề tài / giải thưởng của chính người dùng. */
function api_saveList(token, kind, rows) {
  const c = expert_(token);
  const def = LIST_DEF[kind];
  if (!def) throw new Error('Danh sách không hợp lệ.');
  const clean = (rows || []).slice(0, 200).map((r, i) => {
    const x = { id: /^[A-Z0-9]{4,}$/.test(r.id || '') ? r.id : uid_(kind.charAt(0).toUpperCase()), email: c.email, order: String(i) };
    Object.keys(def.cols).forEach(k => { x[k] = clip_(r[k], def.cols[k]); });
    return x;
  }).filter(x => x[def.need]);
  return tx_(() => {
    const others = T_(def.sheet).filter(r => r.email !== c.email);
    save_(def.sheet, others.concat(clean));
    log_(c.email, 'list_save', kind, clean.length + ' dòng');
    return { ok: true, rows: clean };
  });
}

/** Thêm sự kiện học vị / chức danh / chức vụ. Luôn ở trạng thái chờ xác minh. */
function api_addCredential(token, x) {
  const c = expert_(token);
  x = x || {};
  if (['degree', 'title', 'position'].indexOf(x.kind) < 0) throw new Error('Loại không hợp lệ.');
  const value = clip_(x.value, 120);
  if (!value) throw new Error('Nhập giá trị (ví dụ: Tiến sĩ).');
  const d = SL.parseDate(x.date);
  if (!d.ok) throw new Error('Nhập ngày đạt / ngày bổ nhiệm (dd/mm/yyyy).');
  return tx_(() => {
    const row = {
      id: x.id && T_('Credentials').some(r => r.id === x.id && r.email === c.email && r.status !== 'verified') ? x.id : uid_('C'),
      email: c.email, kind: x.kind, value: value, date: d.iso, country: clip_(x.country, 60),
      fileId: clip_(x.fileId, 80), fileName: clip_(x.fileName, 200), status: 'pending', source: x.source === 'cv' ? 'cv' : 'manual',
      note: clip_(x.note, 500), reviewNote: '', prevHighest: '', reviewedBy: '', reviewedAt: '', createdAt: now_()
    };
    upsert_('Credentials', row);
    log_(c.email, 'credential_add', row.id, row.kind + ': ' + row.value);
    return { ok: true, credential: row };
  });
}
function api_withdrawCredential(token, id) {
  const c = expert_(token);
  return tx_(() => {
    const rows = T_('Credentials');
    const x = rows.find(r => r.id === id && r.email === c.email);
    if (!x) throw new Error('Không tìm thấy mục.');
    if (x.status === 'verified') throw new Error('Mục đã xác minh. Liên hệ quản trị viên nếu cần điều chỉnh.');
    save_('Credentials', rows.filter(r => r !== x));
    log_(c.email, 'credential_withdraw', id, x.value);
    return { ok: true };
  });
}

function api_saveNeeds(token, n) {
  const c = expert_(token);
  n = n || {};
  const st = settings_();
  const der = derived_(c.email);
  const rules = levelRules_(st);
  const errs = [];
  const on = k => n[k] === true || n[k] === 'true';
  if (on('council')) { const e = SL.eligible(der.degree, n.councilLevel, rules); if (!n.councilLevel) errs.push('Chọn bậc đào tạo cho hội đồng.'); else if (!e.ok) errs.push('Hội đồng: ' + e.reason); }
  if (on('supervise')) { const e = SL.eligible(der.degree, n.superviseLevel, rules); if (!n.superviseLevel) errs.push('Chọn bậc đào tạo cho hướng dẫn.'); else if (!e.ok) errs.push('Hướng dẫn: ' + e.reason); }
  if (on('guestLecture') && !SL.trim(n.teachField)) errs.push('Nhập lĩnh vực muốn giảng dạy.');
  if (on('consult') && !SL.trim(n.consultField)) errs.push('Nhập chuyên môn tư vấn.');
  if (on('jointResearch') && !SL.trim(n.researchDirection)) errs.push('Nhập hướng nghiên cứu chung với doanh nghiệp.');
  if (n.until) { const d = SL.parseDate(n.until); if (!d.ok) errs.push('Ngày nhận đề xuất đến không hợp lệ.'); else if (d.iso < today_()) errs.push('Ngày nhận đề xuất đến phải từ hôm nay trở đi.'); else n.until = d.iso; }
  if (errs.length) throw new Error(errs.join(' '));
  return tx_(() => {
    const row = { email: c.email, updatedAt: now_() };
    ['council', 'supervise', 'consult', 'jointResearch', 'guestLecture', 'teamUp', 'allowSuggest'].forEach(k => { row[k] = on(k) ? 'true' : 'false'; });
    ['councilLevel', 'superviseLevel'].forEach(k => { row[k] = rules.some(l => l.code === n[k]) ? n[k] : ''; });
    ['teachField', 'consultField', 'researchDirection', 'area'].forEach(k => { row[k] = clip_(n[k], 300); });
    row.availability = n.availability === 'paused' ? 'paused' : 'ready';
    row.until = n.until || '';
    upsert_('Needs', row, 'email');
    log_(c.email, 'needs_save', c.email, ['council', 'supervise', 'consult', 'jointResearch', 'guestLecture', 'teamUp'].filter(k => row[k] === 'true').join(', ') || 'tắt hết');
    return { ok: true, needs: row };
  });
}

function api_respondMatch(token, id, status, note) {
  const c = expert_(token);
  if (['seen', 'interested', 'declined'].indexOf(status) < 0) throw new Error('Phản hồi không hợp lệ.');
  return tx_(() => {
    const m = T_('Matches').find(r => r.id === id && r.email === c.email && r.status !== 'draft');
    if (!m) throw new Error('Không tìm thấy đề xuất.');
    if (status === 'seen' && m.status !== 'sent') return { ok: true, match: m };
    m.status = status; m.note = clip_(note, 500); m.respondedAt = now_();
    upsert_('Matches', m);
    log_(c.email, 'match_' + status, m.roundId, note || '');
    return { ok: true, match: m };
  });
}

function api_support(token, subject, body) {
  const c = ctx_(token);
  if (!SL.trim(subject) || !SL.trim(body)) throw new Error('Nhập tiêu đề và nội dung cần hỗ trợ.');
  return tx_(() => {
    const row = { id: uid_('S'), email: c.email, subject: clip_(subject, 150), body: clip_(body, 3000), status: 'open', reply: '', createdAt: now_(), repliedAt: '', repliedBy: '' };
    upsert_('Support', row);
    log_(c.email, 'support_open', row.id, row.subject);
    notifyAdmins_('Yêu cầu hỗ trợ mới: ' + row.subject, '<p><b>' + esc_(c.user.name || c.email) + '</b> gửi yêu cầu:</p><blockquote>' + esc_(row.body).replace(/\n/g, '<br>') + '</blockquote>');
    return { ok: true, support: row };
  });
}

/* =====================================================================
   8. API CHUYÊN GIA — CÔNG BỐ
   ===================================================================== */
function cleanPub_(p, email) {
  const type = SL.PUB_TYPES.some(t => t.code === p.type) ? p.type : 'journal';
  const year = SL.yearOf(p.year);
  const doi = SL.normDoi(p.doi);
  return {
    type: type, title: clip_(p.title, 400), authors: clip_(p.authors, 500), year: year, month: /^(0?[1-9]|1[0-2])$/.test(String(p.month || '')) ? String(Number(p.month)) : '',
    venue: clip_(p.venue, 300), issn: clip_(p.issn, 30), volume: clip_(p.volume, 30), pages: clip_(p.pages, 30), doi: doi,
    keywords: clip_(p.keywords, 300), email: email
  };
}
function validatePub_(x) {
  const e = [];
  if (!x.title) e.push('Nhập tên bài báo / công trình.');
  if (!x.year) e.push('Nhập năm xuất bản.');
  else if (Number(x.year) > Number(today_().slice(0, 4)) + 1) e.push('Năm xuất bản không hợp lệ.');
  if (!x.venue) e.push(x.type === 'book' || x.type === 'textbook' ? 'Nhập nhà xuất bản.' : 'Nhập tên tạp chí / hội nghị.');
  if (x.doi && !SL.isDoi(x.doi)) e.push('DOI có dạng 10.xxxx/....');
  return e;
}
/**
 * Lưu công bố. action: 'draft' (lưu nháp) | 'submit' (gửi xác minh).
 * - Trùng DOI hoặc tiêu đề + năm với bài đã có → hỏi lại (trừ khi confirmDup).
 * - Ngày tải lên lần đầu không đổi khi sửa hay thay file (thống kê theo kỳ).
 * - Sửa nội dung bài đã xác minh → quay lại "Chờ duyệt".
 */
function api_savePublication(token, p, action) {
  const c = expert_(token);
  p = p || {};
  const x = cleanPub_(p, c.email);
  const errs = validatePub_(x);
  if (errs.length) throw new Error(errs.join(' '));
  return tx_(() => {
    const all = T_('Publications');
    const cur = p.id ? all.find(r => r.id === p.id && r.email === c.email) : null;
    if (p.id && !cur) throw new Error('Không tìm thấy công bố.');
    const dup = SL.findDup(Object.assign({ id: p.id }, x), all.filter(r => r.email === c.email));
    if (dup && !p.confirmDup) return { ok: false, dup: { id: dup.id, title: dup.title, year: dup.year, status: dup.status } };
    const row = Object.assign({}, cur || { id: uid_('P'), source: p.source === 'cv' ? 'cv' : 'manual', uploadedAt: now_(), metaStatus: '', metaNote: '', fileId: '', fileName: '' }, x);
    if (p.fileId !== undefined && T_('Files').some(f => f.id === p.fileId && f.email === c.email)) {
      row.fileId = p.fileId; row.fileName = (T_('Files').find(f => f.id === p.fileId) || {}).name || '';
    }
    const changed = cur && ['title', 'authors', 'year', 'venue', 'doi', 'type'].some(k => String(cur[k]) !== String(row[k]));
    if (action === 'submit') {
      if (!row.fileId) throw new Error('Cần tải file minh chứng (paper, quyết định…) trước khi gửi xác minh.');
      row.status = cur && cur.status === 'verified' && !changed ? 'verified' : 'pending';
    } else if (!cur) row.status = 'draft';
    else if (cur.status === 'verified' && changed) row.status = 'pending';
    if (!row.status) row.status = 'draft';
    if (p.metaStatus) { row.metaStatus = clip_(p.metaStatus, 20); row.metaNote = clip_(p.metaNote, 500); }
    row.updatedAt = now_();
    upsert_('Publications', row);
    log_(c.email, cur ? 'pub_update' : 'pub_add', row.id, row.title + ' → ' + row.status);
    return { ok: true, pub: row };
  });
}
function api_deletePublication(token, id) {
  const c = expert_(token);
  return tx_(() => {
    const all = T_('Publications');
    const x = all.find(r => r.id === id && r.email === c.email);
    if (!x) throw new Error('Không tìm thấy công bố.');
    if (x.status === 'verified') throw new Error('Công bố đã xác minh không xóa được. Liên hệ quản trị viên.');
    save_('Publications', all.filter(r => r !== x));
    log_(c.email, 'pub_delete', id, x.title);
    return { ok: true };
  });
}

/** Đối chiếu metadata với Crossref. Khớp metadata KHÔNG có nghĩa bài đã được duyệt. */
function api_checkDoi(token, doi, title, year) {
  ctx_(token);
  doi = SL.normDoi(doi);
  if (!SL.isDoi(doi)) throw new Error('DOI có dạng 10.xxxx/....');
  const res = UrlFetchApp.fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), {
    muteHttpExceptions: true, headers: { 'User-Agent': 'Fluxience/' + APP_VERSION + ' (mailto:' + (ownerEmail_() || 'admin@example.com') + ')' }
  });
  if (res.getResponseCode() === 404) return { found: false, status: 'notfound', notes: ['Crossref không có DOI này.'] };
  if (res.getResponseCode() !== 200) throw new Error('Crossref chưa phản hồi (HTTP ' + res.getResponseCode() + '). Thử lại sau.');
  return compareMeta_(JSON.parse(res.getContentText()).message || {}, title, year);
}
function compareMeta_(m, title, year) {
  const t = (m.title || [])[0] || '';
  const y = String(((m.issued || {})['date-parts'] || [[]])[0][0] || '');
  const authors = (m.author || []).map(a => [a.family, a.given].filter(Boolean).join(' ')).join('; ');
  const venue = (m['container-title'] || [])[0] || m.publisher || '';
  const notes = [];
  const wt = SL.words(title), wm = SL.words(t);
  const overlap = wt.length ? wt.filter(w => wm.indexOf(w) >= 0).length / Math.max(wt.length, wm.length) : 0;
  const titleOk = SL.normTitle(t) === SL.normTitle(title) || overlap >= 0.8;
  if (!titleOk) notes.push('Tiêu đề khác Crossref: "' + t + '".');
  if (year && y && String(year) !== y) notes.push('Năm khác Crossref: ' + y + '.');
  return {
    found: true, status: notes.length ? 'mismatch' : 'match', notes: notes,
    meta: { title: t, year: y, authors: authors, venue: venue, issn: (m.ISSN || [])[0] || '', type: m.type || '', volume: m.volume || '', pages: m.page || '' }
  };
}

/* =====================================================================
   9. KHO FILE (Drive riêng tư của chủ script)
   ===================================================================== */
function rootFolder_() {
  const id = prop_('FILES_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('Fluxience · Kho tài liệu (riêng tư)');
  PROPS.setProperty('FILES_FOLDER', f.getId());
  return f;
}
function userFolder_(email) {
  const root = rootFolder_();
  const it = root.getFoldersByName(email);
  return it.hasNext() ? it.next() : root.createFolder(email);
}
const OK_MIME = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/(png|jpe?g|webp))$/;

/**
 * Tải file lên kho. f = { name, mimeType, data (base64) }. link = 'pub:ID' | 'cred:ID' | 'cv' | ''.
 * File không bao giờ được chia sẻ công khai; tải xuống đi qua api_getFile (kiểm tra quyền).
 */
function api_uploadFile(token, f, link) {
  const c = ctx_(token);
  if (!f || !f.data) throw new Error('Chưa chọn file.');
  const mime = String(f.mimeType || '');
  if (!OK_MIME.test(mime)) throw new Error('Chỉ nhận PDF, DOC, DOCX hoặc ảnh (PNG, JPG).');
  const bytes = Utilities.base64Decode(String(f.data));
  if (bytes.length > MAX_UPLOAD_MB * 1024 * 1024) throw new Error('File tối đa ' + MAX_UPLOAD_MB + ' MB.');
  link = String(link || '');
  const owner = c.email;
  if (/^pub:/.test(link) && !T_('Publications').some(r => 'pub:' + r.id === link && r.email === owner)) throw new Error('Công bố không thuộc hồ sơ của bạn.');
  if (/^cred:/.test(link) && !T_('Credentials').some(r => 'cred:' + r.id === link && r.email === owner)) throw new Error('Mục học vị không thuộc hồ sơ của bạn.');
  const name = clip_(f.name, 180) || 'tai-lieu';
  const file = userFolder_(owner).createFile(Utilities.newBlob(bytes, mime, name));
  return tx_(() => {
    const prev = link ? T_('Files').filter(r => r.link === link && r.email === owner) : [];
    const row = {
      id: file.getId(), email: owner, name: name, mime: mime, size: String(bytes.length), link: link,
      kind: link === 'cv' ? 'cv' : /^pub:/.test(link) ? 'paper' : /^cred:/.test(link) ? 'decision' : 'other',
      version: String(prev.length + 1), access: 'private', uploadedAt: now_(), uploadedBy: c.email
    };
    upsert_('Files', row);
    if (/^pub:/.test(link)) {
      const p = T_('Publications').find(r => 'pub:' + r.id === link);
      p.fileId = row.id; p.fileName = name; p.updatedAt = now_();
      if (p.status === 'needs_info') p.status = 'pending';
      upsert_('Publications', p);
    }
    if (/^cred:/.test(link)) {
      const x = T_('Credentials').find(r => 'cred:' + r.id === link);
      x.fileId = row.id; x.fileName = name;
      if (x.status === 'needs_info') x.status = 'pending';
      upsert_('Credentials', x);
    }
    log_(c.email, 'file_upload', row.id, name + (link ? ' → ' + link : '') + ' · v' + row.version);
    return { ok: true, file: row };
  });
}
/** Tải file về (chủ hồ sơ hoặc quản trị viên). */
function api_getFile(token, id) {
  const c = ctx_(token);
  const row = T_('Files').find(r => r.id === id);
  if (!row) throw new Error('Không tìm thấy file.');
  if (row.email !== c.email && c.roles.indexOf('admin') < 0) throw new Error('Bạn không có quyền xem file này.');
  const blob = DriveApp.getFileById(id).getBlob();
  if (blob.getBytes().length > 15 * 1024 * 1024) throw new Error('File lớn hơn 15 MB: mở trực tiếp trong Drive của quản trị viên.');
  log_(c.email, 'file_view', id, row.name);
  return { name: row.name, mime: row.mime, data: Utilities.base64Encode(blob.getBytes()) };
}

/* =====================================================================
   10. NHẬP CV & XUẤT HỒ SƠ
   ===================================================================== */
/** Đọc .docx bằng cách giải nén (không cần dịch vụ nâng cao). */
function docFromDocx_(blob) {
  const parts = Utilities.unzip(blob.setContentType('application/zip'));
  const xml = parts.find(b => b.getName() === 'word/document.xml');
  if (!xml) throw new Error('File .docx không có nội dung văn bản.');
  return SL.docxToDoc(xml.getDataAsString('UTF-8'));
}
/** .doc / .pdf: chuyển sang Google Docs (cần bật Drive API nâng cao), đọc rồi xóa bản tạm. */
function docViaDrive_(blob, mime) {
  if (typeof Drive === 'undefined') throw new Error('Để đọc file .doc hoặc .pdf, quản trị viên cần bật dịch vụ "Drive API" (Services → Drive API v3). Hoặc lưu CV sang .docx rồi tải lại.');
  const opts = mime === 'application/pdf' ? { ocrLanguage: 'vi' } : {};
  const tmp = Drive.Files.create({ name: 'tmp-cv-' + Date.now(), mimeType: MimeType.GOOGLE_DOCS, parents: [rootFolder_().getId()] }, blob, opts);
  try {
    const body = DocumentApp.openById(tmp.id).getBody();
    const paras = [], tables = [];
    for (let i = 0; i < body.getNumChildren(); i++) {
      const el = body.getChild(i);
      const t = el.getType();
      if (t === DocumentApp.ElementType.PARAGRAPH || t === DocumentApp.ElementType.LIST_ITEM) paras.push(el.asText().getText());
      else if (t === DocumentApp.ElementType.TABLE) {
        const tb = el.asTable(), rows = [];
        for (let r = 0; r < tb.getNumRows(); r++) {
          const row = tb.getRow(r), cells = [];
          for (let k = 0; k < row.getNumCells(); k++) cells.push(row.getCell(k).getText());
          rows.push(cells);
        }
        tables.push(rows);
      }
    }
    return { paras: paras, tables: tables };
  } finally {
    try { DriveApp.getFileById(tmp.id).setTrashed(true); } catch (e) {}
  }
}
/** Bước 1–2 nhập CV: lưu file gốc, tách dữ liệu thành BẢN NHÁP. Không ghi gì vào hồ sơ. */
function api_parseCV(token, f) {
  const c = expert_(token);
  const up = api_uploadFile(token, f, 'cv').file;
  const blob = DriveApp.getFileById(up.id).getBlob();
  const mime = up.mime;
  let doc;
  if (/wordprocessingml/.test(mime)) doc = docFromDocx_(blob);
  else if (mime === 'application/msword' || mime === 'application/pdf') doc = docViaDrive_(blob, mime);
  else throw new Error('Chỉ đọc được DOC, DOCX hoặc PDF.');
  const prof = T_('Profiles').find(r => r.email === c.email) || {};
  const draft = SL.parseLLKH(doc, { ownerName: prof.fullName || c.user.name, existingPubs: T_('Publications').filter(r => r.email === c.email) });
  const source = (doc.paras || []).join('\n') + '\n' + (doc.tables || []).map(t => t.map(r => r.join(' | ')).join('\n')).join('\n\n');
  log_(c.email, 'cv_parse', up.id, up.name + ' · ' + draft.summary.total + ' mục, ' + draft.summary.flagged + ' cần kiểm tra');
  return { draft: draft, source: source.slice(0, 30000), file: up };
}
/**
 * Bước 3: ghi những mục người dùng đã chọn.
 * plan = { fields:{k:v}, languages:[], work:{mode,rows}, projects:{mode,rows}, awards:{mode,rows},
 *          pubs:[{action:'add'|'merge'|'skip', data, dupId}], credentials:[...] }
 */
function api_importCV(token, plan) {
  const c = expert_(token);
  plan = plan || {};
  if (plan.fields && Object.keys(plan.fields).length || plan.languages) {
    const pf = Object.assign({}, plan.fields || {});
    if (plan.languages) pf.languages = plan.languages;
    api_saveProfile(token, pf);
  }
  ['work', 'projects', 'awards'].forEach(k => {
    const part = plan[k];
    if (!part || !part.rows || !part.rows.length) return;
    MEMO_ = {};
    const cur = T_(LIST_DEF[k].sheet).filter(r => r.email === c.email);
    const key = r => SL.fold([r.from, r.place, r.name, r.year].join('|')).replace(/[^a-z0-9|]/g, '');
    const have = new Set(cur.map(key));
    api_saveList(token, k, part.mode === 'replace' ? part.rows : cur.concat(part.rows.filter(r => !have.has(key(r)))));
  });
  let added = 0, merged = 0;
  (plan.pubs || []).forEach(it => {
    if (!it || it.action === 'skip') return;
    MEMO_ = {};
    if (it.action === 'merge' && it.dupId) {
      tx_(() => {
        const cur = T_('Publications').find(r => r.id === it.dupId && r.email === c.email);
        if (!cur) return;
        const x = cleanPub_(it.data || {}, c.email);
        ['authors', 'venue', 'doi', 'issn', 'volume', 'pages', 'keywords', 'month'].forEach(k => { if (!cur[k] && x[k]) cur[k] = x[k]; });
        cur.updatedAt = now_();
        upsert_('Publications', cur);
        merged++;
      });
    } else {
      const r = api_savePublication(token, Object.assign({}, it.data, { source: 'cv', confirmDup: true }), 'draft');
      if (r.ok) added++;
    }
  });
  (plan.credentials || []).forEach(x => {
    MEMO_ = {};
    // Đã có mục cùng loại + giá trị (đang chờ hoặc đã xác minh) thì không tạo yêu cầu trùng
    if (T_('Credentials').some(r => r.email === c.email && r.kind === x.kind && SL.fold(r.value) === SL.fold(x.value) && r.status !== 'rejected')) return;
    try { api_addCredential(token, Object.assign({}, x, { source: 'cv', date: x.date || '' })); } catch (e) {
      if (x.kind !== 'position') throw e;   // chức vụ thiếu ngày: bỏ qua, nhắc ở giao diện
    }
  });
  log_(c.email, 'cv_import', plan.fileId || '', 'thêm ' + added + ' công bố, gộp ' + merged);
  MEMO_ = {};
  return { ok: true, added: added, merged: merged, data: api_bootstrap(token, 'expert') };
}

/**
 * Xuất hồ sơ ra .docx / .pdf: HTML (đã xem trước & xác nhận ở giao diện) → Google Docs → tải về.
 * Cần dịch vụ Drive API nâng cao. Bản tạm bị xóa ngay sau khi xuất.
 */
function api_renderDoc(token, html, name, format, meta) {
  const c = ctx_(token);
  meta = meta || {};
  if (meta.email && meta.email !== c.email && c.roles.indexOf('admin') < 0) throw new Error('Chỉ quản trị viên được xuất hồ sơ của người khác.');
  if (typeof Drive === 'undefined') throw new Error('Chưa bật dịch vụ Drive API nâng cao: dùng "Tải Word (.doc)" hoặc "In / Lưu PDF" trong lúc chờ quản trị viên bật.');
  const fmt = format === 'pdf' ? 'pdf' : 'docx';
  const mimes = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const tmp = Drive.Files.create({ name: 'tmp-export-' + Date.now(), mimeType: MimeType.GOOGLE_DOCS, parents: [rootFolder_().getId()] },
    Utilities.newBlob(String(html || ''), 'text/html', 'export.html'));
  try {
    const d = DocumentApp.openById(tmp.id);
    const b = d.getBody();
    // A4, lề theo thể thức văn bản hành chính: trên/dưới 2 cm, trái 3 cm, phải 2 cm
    b.setPageWidth(595.3).setPageHeight(841.9).setMarginTop(56.7).setMarginBottom(56.7).setMarginLeft(85).setMarginRight(56.7);
    d.saveAndClose();
    const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + tmp.id + '/export?mimeType=' + encodeURIComponent(mimes[fmt]), {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error('Google Docs không xuất được file (HTTP ' + res.getResponseCode() + ').');
    const fileName = clip_(name, 120).replace(/[\\/:*?"<>|]+/g, '-') + '.' + fmt;
    log_(c.email, 'export', meta.email || c.email, fileName + ' · ' + (meta.template || '') + ' · ' + (meta.sections || ''));
    return { name: fileName, mime: mimes[fmt], data: Utilities.base64Encode(res.getBlob().getBytes()) };
  } finally {
    try { DriveApp.getFileById(tmp.id).setTrashed(true); } catch (e) {}
  }
}
/** Ghi nhật ký cho bản xuất làm ở trình duyệt (.doc, in PDF, CSV). */
function api_logExport(token, meta) {
  const c = ctx_(token);
  meta = meta || {};
  if (meta.email && meta.email !== c.email && c.roles.indexOf('admin') < 0) throw new Error('Không có quyền.');
  log_(c.email, 'export', meta.email || c.email, [meta.name, meta.format, meta.template, meta.sections].filter(Boolean).join(' · '));
  return { ok: true };
}

/* =====================================================================
   11. API QUẢN TRỊ
   ===================================================================== */
function api_saveUser(token, u) {
  const a = admin_(token);
  u = u || {};
  const email = String(u.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email không hợp lệ.');
  const roles = (Array.isArray(u.roles) ? u.roles : String(u.roles || '').split(/[,\s]+/)).filter(r => r === 'admin' || r === 'expert');
  if (!roles.length) throw new Error('Chọn ít nhất một vai trò.');
  if (email === a.email && roles.indexOf('admin') < 0) throw new Error('Không tự gỡ quyền quản trị của chính mình.');
  if (email === a.email && u.status === 'disabled') throw new Error('Không tự khoá tài khoản của chính mình.');
  return tx_(() => {
    const cur = T_('Users').find(r => r.email === email);
    const row = Object.assign({}, cur || { createdAt: now_(), createdBy: a.email, lastLogin: '' }, {
      email: email, name: clip_(u.name, 100) || (cur && cur.name) || email.split('@')[0], roles: roles.join(','),
      unit: clip_(u.unit, 150), status: u.status === 'disabled' ? 'disabled' : 'active'
    });
    upsert_('Users', row, 'email');
    log_(a.email, cur ? 'user_update' : 'user_add', email, row.roles + ' · ' + row.status);
    return { ok: true, user: row };
  });
}
/** Duyệt yêu cầu truy cập: cấp vai trò (approve) hoặc từ chối kèm lý do (reject). */
function api_reviewAccess(token, email, decision, roles, unit, note) {
  const a = admin_(token);
  email = String(email || '').trim().toLowerCase();
  if (['approve', 'reject'].indexOf(decision) < 0) throw new Error('Quyết định không hợp lệ.');
  const rs = (Array.isArray(roles) ? roles : String(roles || '').split(/[,\s]+/)).filter(r => r === 'admin' || r === 'expert');
  if (decision === 'approve' && !rs.length) throw new Error('Chọn ít nhất một vai trò để cấp quyền.');
  if (decision === 'reject' && !SL.trim(note)) throw new Error('Ghi lý do từ chối để người dùng biết.');
  return tx_(() => {
    const x = T_('Users').find(r => r.email === email);
    if (!x) throw new Error('Không tìm thấy yêu cầu của ' + email + '.');
    if (x.status === 'active') throw new Error('Tài khoản này đã được cấp quyền.');
    Object.assign(x, decision === 'approve'
      ? { status: 'active', roles: rs.join(','), unit: clip_(unit, 150) || x.unit }
      : { status: 'rejected', roles: '' }, { reviewNote: clip_(note, 500), reviewedBy: a.email, reviewedAt: now_() });
    upsert_('Users', x, 'email');
    log_(a.email, decision === 'approve' ? 'access_approve' : 'access_reject', email, decision === 'approve' ? x.roles : x.reviewNote);
    notify_(email, decision === 'approve' ? 'Tài khoản đã được cấp quyền' : 'Yêu cầu truy cập chưa được chấp nhận',
      decision === 'approve'
        ? '<p>Tài khoản <b>' + esc_(email) + '</b> đã được cấp quyền ' + rs.map(r => r === 'admin' ? 'quản trị' : 'chuyên gia').join(' và ') + '. Đăng nhập lại để bắt đầu.</p>'
        : '<p>Yêu cầu truy cập của <b>' + esc_(email) + '</b> chưa được chấp nhận.</p><p>Lý do: ' + esc_(note) + '</p>');
    return { ok: true, user: x };
  });
}
/** Cấp tài khoản hàng loạt: mỗi dòng "email, Họ tên, Đơn vị, vai trò". */
function api_importUsers(token, text) {
  const a = admin_(token);
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 500);
  let added = 0, skipped = [];
  tx_(() => {
    const rows = T_('Users').slice();
    lines.forEach(l => {
      const p = l.split(/\t|,|;/).map(s => s.trim());
      const email = (p[0] || '').toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped.push(l); return; }
      const role = /quan tri|admin/.test(SL.fold(p[3] || '')) ? 'admin' : 'expert';
      const old = rows.find(r => r.email === email);
      if (old && old.status !== 'pending' && old.status !== 'rejected') { skipped.push(email + ' (đã có)'); return; }
      if (old) { Object.assign(old, { name: p[1] || old.name, roles: role, unit: p[2] || old.unit, status: 'active', reviewedBy: a.email, reviewedAt: now_() }); added++; return; }
      rows.push({ email: email, name: p[1] || email.split('@')[0], roles: role, unit: p[2] || '', status: 'active', createdAt: now_(), createdBy: a.email, lastLogin: '' });
      added++;
    });
    save_('Users', rows);
  });
  log_(a.email, 'user_import', '', added + ' tài khoản');
  return { ok: true, added: added, skipped: skipped };
}

/** Duyệt học vị / chức danh / chức vụ. Ghi lại cao nhất trước–sau để đối chiếu. */
function api_reviewCredential(token, id, decision, note) {
  const a = admin_(token);
  if (['verified', 'needs_info', 'rejected'].indexOf(decision) < 0) throw new Error('Quyết định không hợp lệ.');
  if (decision !== 'verified' && !SL.trim(note)) throw new Error('Ghi lý do để chuyên gia bổ sung.');
  return tx_(() => {
    const x = T_('Credentials').find(r => r.id === id);
    if (!x) throw new Error('Không tìm thấy yêu cầu.');
    const before = derived_(x.email);
    x.status = decision; x.reviewNote = clip_(note, 500); x.reviewedBy = a.email; x.reviewedAt = now_();
    x.prevHighest = x.kind === 'title' ? before.title : before.degree;
    upsert_('Credentials', x);
    const after = derived_(x.email);
    log_(a.email, 'credential_' + decision, id, x.email + ' · ' + x.kind + ': ' + x.value + ' · cao nhất ' + (x.prevHighest || '—') + ' → ' + ((x.kind === 'title' ? after.title : after.degree) || '—'));
    notify_(x.email, 'Kết quả xác minh ' + SL.labelOf(SL.CRED_KINDS, x.kind).toLowerCase(),
      '<p>' + esc_(SL.labelOf(SL.CRED_KINDS, x.kind)) + ' <b>' + esc_(x.value) + '</b>: ' + ({ verified: 'đã được xác minh.', needs_info: 'cần bổ sung.', rejected: 'không được ghi nhận.' })[decision] + '</p>' + (note ? '<p>Ghi chú: ' + esc_(note) + '</p>' : ''));
    return { ok: true, credential: x, derived: after };
  });
}
function api_reviewPublication(token, id, decision, note) {
  const a = admin_(token);
  if (['verified', 'needs_info', 'rejected'].indexOf(decision) < 0) throw new Error('Quyết định không hợp lệ.');
  if (decision !== 'verified' && !SL.trim(note)) throw new Error('Ghi lý do để chuyên gia bổ sung.');
  return tx_(() => {
    const p = T_('Publications').find(r => r.id === id);
    if (!p) throw new Error('Không tìm thấy công bố.');
    if (decision === 'verified' && !p.fileId) throw new Error('Công bố chưa có file minh chứng.');
    p.status = decision; p.reviewNote = clip_(note, 500); p.reviewedBy = a.email; p.reviewedAt = now_();
    upsert_('Publications', p);
    log_(a.email, 'pub_' + decision, id, p.email + ' · ' + p.title + ' · tiêu chí ' + (settings_().PUB_CRITERIA || 'v1'));
    notify_(p.email, 'Kết quả xét duyệt công bố',
      '<p>Công bố <b>' + esc_(p.title) + '</b>: ' + ({ verified: 'đã xác minh.', needs_info: 'cần bổ sung.', rejected: 'không đạt.' })[decision] + '</p>' + (note ? '<p>Ghi chú: ' + esc_(note) + '</p>' : ''));
    return { ok: true, pub: p };
  });
}
function api_setPubMeta(token, id, status, noteText) {
  const c = ctx_(token);
  return tx_(() => {
    const p = T_('Publications').find(r => r.id === id && (r.email === c.email || c.roles.indexOf('admin') >= 0));
    if (!p) throw new Error('Không tìm thấy công bố.');
    p.metaStatus = clip_(status, 20); p.metaNote = clip_(noteText, 500);
    upsert_('Publications', p);
    return { ok: true, pub: p };
  });
}

/**
 * Lưu đợt ghép nối và danh sách đã chọn (shortlist, trạng thái nháp).
 * Server lọc lại điều kiện: người không đủ điều kiện không vào được danh sách.
 */
function api_saveRound(token, r, picks) {
  const a = admin_(token);
  r = r || {};
  if (!SL.trim(r.title)) throw new Error('Đặt tên đợt ghép nối.');
  if (!SL.NEED_TYPES.some(t => t.code === r.needType)) throw new Error('Chọn loại nhu cầu.');
  const st = settings_();
  return tx_(() => {
    const cur = r.id ? T_('Rounds').find(x => x.id === r.id) : null;
    const row = Object.assign({}, cur || { id: uid_('R'), status: 'draft', createdBy: a.email, createdAt: now_(), sentAt: '' }, {
      title: clip_(r.title, 150), needType: r.needType, level: clip_(r.level, 20), period: clip_(r.period, 60), goal: clip_(r.goal, 1000),
      tags: (Array.isArray(r.tags) ? r.tags : String(r.tags || '').split(/[;,]/)).map(s => SL.trim(s)).filter(Boolean).slice(0, 12).join('; '),
      partner: clip_(r.partner, 150)
    });
    upsert_('Rounds', row);
    if (Array.isArray(picks)) {
      const need = { needType: row.needType, level: row.level, tags: row.tags.split('; ').filter(Boolean), goal: row.goal };
      const all = T_('Matches');
      const keep = all.filter(m => m.roundId !== row.id || m.status !== 'draft');
      const already = keep.filter(m => m.roundId === row.id).map(m => m.email);
      const rejected = [];
      picks.forEach(email => {
        if (already.indexOf(email) >= 0) return;
        const sc = SL.matchScore(expertView_(email), need, today_(), levelRules_(st));
        if (!sc.eligible) { rejected.push(email + ': ' + sc.blockers.join(' ')); return; }
        keep.push({ id: uid_('M'), roundId: row.id, email: email, score: String(sc.score), reason: sc.reasons.join('; '), status: 'draft', note: '', createdAt: now_(), sentAt: '', respondedAt: '' });
      });
      save_('Matches', keep);
      if (rejected.length) log_(a.email, 'round_skip', row.id, rejected.join(' | '));
      log_(a.email, cur ? 'round_update' : 'round_add', row.id, row.title);
      return { ok: true, round: row, rejected: rejected };
    }
    log_(a.email, cur ? 'round_update' : 'round_add', row.id, row.title);
    return { ok: true, round: row, rejected: [] };
  });
}
function expertView_(email) {
  const der = derived_(email);
  return {
    profile: T_('Profiles').find(p => p.email === email) || {}, needs: T_('Needs').find(n => n.email === email) || {},
    degree: der.degree, pubs: T_('Publications').filter(p => p.email === email)
  };
}
/** Gửi đề xuất riêng: mỗi người chỉ thấy đề xuất của mình, không thấy danh sách người khác. */
function api_sendMatches(token, roundId) {
  const a = admin_(token);
  return tx_(() => {
    const round = T_('Rounds').find(r => r.id === roundId);
    if (!round) throw new Error('Không tìm thấy đợt ghép nối.');
    const all = T_('Matches');
    const drafts = all.filter(m => m.roundId === roundId && m.status === 'draft');
    if (!drafts.length) throw new Error('Danh sách chưa có ai ở trạng thái chờ gửi.');
    drafts.forEach(m => { m.status = 'sent'; m.sentAt = now_(); });
    save_('Matches', all);
    round.status = 'sent'; round.sentAt = now_();
    upsert_('Rounds', round);
    drafts.forEach(m => notify_(m.email, 'Đề xuất kết nối mới: ' + round.title,
      '<p>Bạn có một đề xuất <b>' + esc_(SL.labelOf(SL.NEED_TYPES, round.needType)) + '</b>: ' + esc_(round.title) + '.</p><p>' + esc_(round.goal) + '</p><p>Mở Fluxience → Đề xuất kết nối để chọn Quan tâm hoặc Không phù hợp.</p>'));
    log_(a.email, 'round_send', roundId, drafts.length + ' người');
    return { ok: true, sent: drafts.length };
  });
}
function api_removeMatch(token, id) {
  const a = admin_(token);
  return tx_(() => {
    const all = T_('Matches');
    const m = all.find(x => x.id === id);
    if (!m) throw new Error('Không tìm thấy.');
    if (m.status !== 'draft') throw new Error('Đề xuất đã gửi không gỡ được.');
    save_('Matches', all.filter(x => x !== m));
    log_(a.email, 'match_remove', m.roundId, m.email);
    return { ok: true };
  });
}

function api_saveCatalog(token, type, items) {
  const a = admin_(token);
  if (!/^[a-zA-Z]{2,20}$/.test(type || '')) throw new Error('Loại danh mục không hợp lệ.');
  const clean = (items || []).slice(0, 300).map((x, i) => ({
    type: type, code: clip_(x.code, 30) || String(i + 1), label: clip_(x.label, 120), rank: String(Number(x.rank) || 0), active: x.active === false ? 'false' : 'true'
  })).filter(x => x.label);
  return tx_(() => {
    save_('Catalog', T_('Catalog').filter(r => r.type !== type).concat(clean));
    log_(a.email, 'catalog_save', type, clean.length + ' mục');
    return { ok: true, catalog: catalog_() };
  });
}
function api_saveSettings(token, s) {
  const a = admin_(token);
  s = s || {};
  return tx_(() => {
    const cur = settings_();
    Object.keys(DEFAULT_SETTINGS).forEach(k => {
      if (!(k in s)) return;
      let v = s[k];
      if (k === 'LEVEL_RULES') {
        const arr = Array.isArray(v) ? v : JSON.parse(v || '[]');
        v = JSON.stringify(arr.map(l => ({ code: clip_(l.code, 20), label: clip_(l.label, 40), minDegree: clip_(l.minDegree, 40) })).filter(l => l.code && l.minDegree));
      } else if (TEXT_KEYS.indexOf(k) >= 0) v = clip_(v, 200);
      else v = String(v === true || v === 'true');
      cur[k] = v;
    });
    save_('Settings', Object.keys(cur).map(k => ({ key: k, value: cur[k] })));
    log_(a.email, 'settings_save', '', Object.keys(s).join(', '));
    return { ok: true, settings: cur };
  });
}
function api_replySupport(token, id, reply, close) {
  const a = admin_(token);
  return tx_(() => {
    const x = T_('Support').find(r => r.id === id);
    if (!x) throw new Error('Không tìm thấy yêu cầu.');
    x.reply = clip_(reply, 3000); x.status = close ? 'closed' : 'answered'; x.repliedAt = now_(); x.repliedBy = a.email;
    upsert_('Support', x);
    notify_(x.email, 'Phản hồi hỗ trợ: ' + x.subject, '<p>' + esc_(x.reply).replace(/\n/g, '<br>') + '</p>');
    log_(a.email, 'support_reply', id, x.subject);
    return { ok: true, support: x };
  });
}
function api_setFileAccess(token, id, access) {
  const a = admin_(token);
  if (['private', 'internal'].indexOf(access) < 0) throw new Error('Quyền không hợp lệ.');
  return tx_(() => {
    const f = T_('Files').find(r => r.id === id);
    if (!f) throw new Error('Không tìm thấy file.');
    f.access = access;
    upsert_('Files', f);
    log_(a.email, 'file_access', id, f.name + ' → ' + access);
    return { ok: true, file: f };
  });
}
function api_getLogs(token, n) {
  admin_(token);
  const sh = ss_().getSheetByName('Logs');
  if (!sh || sh.getLastRow() < 2) return [];
  const count = Math.min(Number(n) || 200, 1000, sh.getLastRow() - 1);
  const vals = sh.getRange(sh.getLastRow() - count + 1, 1, count, 5).getDisplayValues();
  return vals.reverse().map(v => ({ time: v[0], email: v[1], action: v[2], target: v[3], detail: v[4] }));
}

/* =====================================================================
   12. THÔNG BÁO EMAIL (bật/tắt trong Cài đặt)
   ===================================================================== */
function notify_(to, subject, html) {
  try {
    const st = settings_();
    if (!bool_(st.SEND_EMAIL) || !to) return;
    MailApp.sendEmail({
      to: to, subject: '[' + st.APP_NAME + '] ' + subject, name: st.APP_NAME,
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#172b45;line-height:1.6">' + html +
        '<p style="color:#56677d;font-size:12px">Thư tự động từ ' + esc_(st.APP_NAME) + ' · ' + esc_(st.SCHOOL_NAME) + '. ' +
        (AUTH.webAppUrl() ? '<a href="' + esc_(AUTH.webAppUrl()) + '">Mở ứng dụng</a>' : '') + '</p></div>'
    });
  } catch (e) { log_('system', 'mail_error', to, String(e && e.message || e)); }
}
function notifyAdmins_(subject, html) {
  T_('Users').filter(u => u.status === 'active' && rolesOf_(u).indexOf('admin') >= 0).forEach(u => notify_(u.email, subject, html));
}

/* =====================================================================
   13. CÀI ĐẶT — CHẠY TRONG TRÌNH SOẠN THẢO APPS SCRIPT
   ===================================================================== */
/** BƯỚC 1 — tạo Google Sheet, danh mục mặc định; bạn (chủ script) là quản trị viên. */
function setup_() {
  const ss = ss_();
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (me) PROPS.setProperty('ADMIN_EMAIL', me);
  tx_(() => {
    Object.keys(SCHEMA).forEach(name => {
      if (!ss.getSheetByName(name)) save_(name, []);
      else if (T_(name).length === 0) save_(name, []);
    });
    if (!T_('Users').some(u => u.email === me) && me) {
      upsert_('Users', { email: me, name: '', roles: 'admin,expert', unit: 'Ban quản trị', status: 'active', createdAt: now_(), createdBy: 'setup', lastLogin: '' }, 'email');
    }
    if (!T_('Catalog').length) save_('Catalog', defaultCatalog_());
    if (!T_('Settings').length) save_('Settings', Object.keys(DEFAULT_SETTINGS).map(k => ({ key: k, value: DEFAULT_SETTINGS[k] })));
    ss.getSheets().forEach(sh => { if (!SCHEMA[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  });
  rootFolder_();
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  const out = [
    '================ SETUP HOÀN TẤT ================',
    'Google Sheet   : ' + ss.getUrl(),
    'Kho tài liệu   : ' + rootFolder_().getUrl(),
    'Quản trị viên  : ' + me,
    'URL web app    : ' + (url || '(chưa deploy — Deploy > New deployment > Web app)'),
    '',
    'TIẾP THEO (xem README.md):',
    '1. Deploy > New deployment > Web app · Execute as: Me · Who has access: Anyone',
    '2. Google Cloud Console > Credentials > OAuth client (Web application)',
    '   Authorized redirect URIs = URL /exec ở trên',
    '3. Điền 3 giá trị vào napCauHinh_() rồi chạy',
    '4. Chạy capQuyen_() để cấp quyền Drive/Docs/Mail',
    '================================================'
  ].join('\n');
  Logger.log(out);
  return out;
}
function defaultCatalog_() {
  const rows = [];
  SL.DEGREES.forEach(d => rows.push({ type: 'degree', code: d.code, label: d.label, rank: String(d.rank), active: 'true' }));
  SL.TITLES.forEach(d => rows.push({ type: 'title', code: d.code, label: d.label, rank: String(d.rank), active: 'true' }));
  ['Quản lý công nghiệp', 'Logistics & chuỗi cung ứng', 'Kỹ thuật hệ thống công nghiệp', 'Quản trị kinh doanh', 'Kinh tế', 'Công nghệ thông tin',
    'Khoa học dữ liệu', 'Cơ khí', 'Điện – điện tử', 'Công nghệ thực phẩm', 'Môi trường', 'Xây dựng', 'Sư phạm kỹ thuật', 'Ngôn ngữ']
    .forEach((l, i) => rows.push({ type: 'field', code: 'F' + (i + 1), label: l, rank: String(i), active: 'true' }));
  SL.PROJECT_LEVELS.forEach((l, i) => rows.push({ type: 'projectLevel', code: 'L' + (i + 1), label: l, rank: String(i), active: 'true' }));
  return rows;
}
/** Điền OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, WEBAPP_URL trong Script Properties; chạy napCauHinh_() để kiểm tra và lưu. */
function napCauHinh_() {
  return setOAuthCredentials_(prop_('OAUTH_CLIENT_ID'), prop_('OAUTH_CLIENT_SECRET'), prop_('WEBAPP_URL'));
}
function setOAuthCredentials_(clientId, clientSecret, webAppUrl) {
  clientId = String(clientId || '').trim(); clientSecret = String(clientSecret || '').trim(); webAppUrl = String(webAppUrl || '').trim();
  if (!webAppUrl) { try { webAppUrl = String(ScriptApp.getService().getUrl() || '').trim(); } catch (e) {} }
  if (!webAppUrl) throw new Error('Chưa có link web app: Triển khai > Tùy chọn triển khai mới > Ứng dụng web trước, rồi chạy lại.');
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('CLIENT_ID phải kết thúc bằng .apps.googleusercontent.com');
  if (!clientSecret) throw new Error('Thiếu CLIENT_SECRET.');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^\/]+|macros)\/s\/[\w-]+\/exec$/.test(webAppUrl)) throw new Error('Link web app phải có dạng https://script.google.com/macros/s/.../exec (không phải /dev). Đang nhận: ' + webAppUrl);
  PROPS.setProperties({ OAUTH_CLIENT_ID: clientId, OAUTH_CLIENT_SECRET: clientSecret, WEBAPP_URL: webAppUrl }, false);
  const out = 'Đã lưu cấu hình OAuth.\nRedirect URI phải khớp tuyệt đối: ' + webAppUrl + '\nMở URL đó (kể cả cửa sổ ẩn danh) để thử đăng nhập.';
  Logger.log(out);
  return out;
}
/** BƯỚC 3 — chạy một lần để Google hỏi đủ quyền; chạy xong Deploy lại "New version". */
function capQuyen_() {
  const r = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/certs', { muteHttpExceptions: true });
  rootFolder_();
  const d = DocumentApp.create('tmp-cap-quyen');
  DriveApp.getFileById(d.getId()).setTrashed(true);
  const quota = MailApp.getRemainingDailyQuota();
  const drive = typeof Drive !== 'undefined' ? 'đã bật' : 'CHƯA BẬT (Services → Drive API → v3) — cần cho xuất .docx/.pdf và đọc .doc/.pdf';
  const out = 'Gọi mạng: HTTP ' + r.getResponseCode() + '\nDrive/Docs: OK\nEmail còn lại hôm nay: ' + quota + '\nDrive API nâng cao: ' + drive +
    '\nTiếp theo: Deploy > Manage deployments > sửa > Version: New version > Deploy.';
  Logger.log(out);
  return out;
}
function kiemTraCauHinh_() {
  const out = [
    'Phiên bản code      : ' + APP_VERSION,
    'SPREADSHEET_ID      : ' + (prop_('SPREADSHEET_ID') || '(chưa có — chạy setup_())'),
    'Kho tài liệu        : ' + (prop_('FILES_FOLDER') ? 'đã tạo' : '(chưa có)'),
    'OAUTH_CLIENT_ID     : ' + (prop_('OAUTH_CLIENT_ID') || '(CHƯA CÓ)'),
    'OAUTH_CLIENT_SECRET : ' + (prop_('OAUTH_CLIENT_SECRET') ? '(đã lưu)' : '(CHƯA CÓ)'),
    'WEBAPP_URL          : ' + (prop_('WEBAPP_URL') || '(CHƯA CÓ)'),
    'ADMIN_EMAIL         : ' + (prop_('ADMIN_EMAIL') || '(chưa có)'),
    'Drive API nâng cao  : ' + (typeof Drive !== 'undefined' ? 'đã bật' : 'chưa bật'),
    'Sẵn sàng đăng nhập  : ' + (AUTH.isConfigured() ? 'CÓ' : 'CHƯA'),
    'Mỗi lần dán code mới: Deploy > Manage deployments > bút chì > Version: New version > Deploy (giữ nguyên link /exec).'
  ].join('\n');
  Logger.log(out);
  return out;
}
/** Hủy mọi phiên đăng nhập (khi nghi lộ token). */
function dangXuatTatCa_() { PROPS.deleteProperty('SESSION_SECRET'); Logger.log('Đã hủy mọi phiên. Mọi người đăng nhập lại.'); return 'OK'; }

/**
 * DỮ LIỆU MINH HỌA để trình bày (khớp các màn hình Figma). Tài khoản mẫu dùng tên miền example.edu.vn
 * nên không ai đăng nhập được bằng chúng; bạn (chủ script) có thêm hồ sơ chuyên gia mẫu để thử.
 */
function napDuLieuMau_() {
  const me = ownerEmail_();
  const d = sampleData_(me);
  tx_(() => {
    Object.keys(d).forEach(name => {
      const key = name === 'Users' || name === 'Profiles' || name === 'Needs' ? 'email' : 'id';
      const cur = T_(name).slice();
      d[name].forEach(r => { const i = cur.findIndex(x => x[key] === r[key]); if (i < 0) cur.push(r); });
      save_(name, cur);
    });
  });
  const out = 'Đã nạp dữ liệu minh họa (không ghi đè dữ liệu đã có). Mở app để xem.';
  Logger.log(out);
  return out;
}
function sampleData_(me) {
  const t = now_();
  const ex = ['hoang.nguyen@example.edu.vn', 'ha.le@example.edu.vn', 'huy.pham@example.edu.vn'];
  const prof = (email, name, field, kw, unit) => ({ email, fullName: name, gender: 'Nam', unit, field, keywords: kw, ugSystem: 'Chính quy', ugPlace: 'Trường ĐH Sư phạm Kỹ thuật TP.HCM', ugMajor: field, ugYear: '2010', dob: '1988-08-15', birthPlace: 'TP. Hồ Chí Minh', updatedAt: t });
  return {
    Users: [
      { email: ex[0], name: 'Nguyễn Hoàng', roles: 'expert', unit: 'Kỹ thuật hệ thống', status: 'active', createdAt: t, createdBy: 'sample', lastLogin: '' },
      { email: ex[1], name: 'Lê Thanh Hà', roles: 'expert', unit: 'Quản trị vận hành', status: 'active', createdAt: t, createdBy: 'sample', lastLogin: '' },
      { email: ex[2], name: 'Phạm Gia Huy', roles: 'expert', unit: 'Sản xuất bền vững', status: 'active', createdAt: t, createdBy: 'sample', lastLogin: '' }
    ],
    Profiles: [
      prof(me, 'Trần Minh Anh', 'Quản lý công nghiệp', 'chuỗi cung ứng; tối ưu hóa; sản xuất', 'Khoa Kinh tế'),
      prof(ex[0], 'Nguyễn Hoàng', 'Kỹ thuật hệ thống công nghiệp', 'tối ưu hóa; mô phỏng; chuyển đổi số', 'Khoa Cơ khí'),
      prof(ex[1], 'Lê Thanh Hà', 'Quản trị vận hành', 'vận hành; lean; chuỗi cung ứng', 'Khoa Kinh tế'),
      prof(ex[2], 'Phạm Gia Huy', 'Sản xuất bền vững', 'sản xuất bền vững; kinh tế tuần hoàn', 'Khoa Môi trường')
    ],
    Credentials: [me].concat(ex).map((e, i) => ({ id: 'CS' + i, email: e, kind: 'degree', value: 'Tiến sĩ', date: '2021-11-20', country: 'Việt Nam', fileId: '', fileName: 'Bang_tien_si.pdf', status: i === 3 ? 'pending' : 'verified', source: 'sample', note: '', reviewNote: '', prevHighest: '', reviewedBy: 'sample', reviewedAt: t, createdAt: t })),
    Publications: [
      { id: 'PS1', email: me, type: 'journal', title: 'Tối ưu chuỗi cung ứng trong sản xuất', authors: 'Trần Minh Anh; cộng sự', year: '2026', month: '8', venue: 'Tạp chí Khoa học Giáo dục Kỹ thuật', doi: '', fileId: '', fileName: 'Paper_01.pdf', status: 'verified', source: 'sample', uploadedAt: '2026-09-28 09:00:00', updatedAt: t },
      { id: 'PS2', email: me, type: 'conference', title: 'Chuyển đổi số trong doanh nghiệp vừa và nhỏ', authors: 'Trần Minh Anh; Nguyễn Hoàng', year: '2026', month: '6', venue: 'Kỷ yếu Hội nghị Quản lý Công nghiệp', fileId: '', fileName: '', status: 'draft', source: 'sample', uploadedAt: '2026-09-22 10:00:00', updatedAt: t },
      { id: 'PS3', email: ex[2], type: 'journal', title: 'Mô hình sản xuất bền vững', authors: 'Phạm Gia Huy', year: '2026', month: '9', venue: 'Tạp chí Môi trường', fileId: '', fileName: 'Paper_03.pdf', status: 'pending', source: 'sample', uploadedAt: '2026-09-18 10:00:00', updatedAt: t }
    ],
    Needs: [
      { email: me, council: 'false', supervise: 'true', superviseLevel: 'cao_hoc', consult: 'true', jointResearch: 'true', guestLecture: 'true', teamUp: 'true', teachField: 'Quản lý chuỗi cung ứng', consultField: 'Quản trị vận hành', researchDirection: 'Tối ưu vận hành; sản xuất bền vững', availability: 'ready', until: '2027-03-31', area: 'TP.HCM & trực tuyến', allowSuggest: 'true', updatedAt: t },
      { email: ex[0], council: 'false', supervise: 'false', consult: 'true', jointResearch: 'true', guestLecture: 'false', teamUp: 'false', consultField: 'Tối ưu hóa', researchDirection: 'Chuyển đổi số sản xuất; tối ưu hóa', availability: 'ready', until: '2027-06-30', area: 'TP.HCM', allowSuggest: 'true', updatedAt: t },
      { email: ex[1], council: 'false', supervise: 'false', consult: 'true', jointResearch: 'false', guestLecture: 'true', teamUp: 'false', teachField: 'Quản trị vận hành', consultField: 'Lean; vận hành', availability: 'ready', until: '2027-06-30', area: 'TP.HCM', allowSuggest: 'true', updatedAt: t },
      { email: ex[2], council: 'false', supervise: 'false', consult: 'false', jointResearch: 'true', guestLecture: 'false', teamUp: 'true', researchDirection: 'Sản xuất bền vững; chuỗi cung ứng xanh', availability: 'ready', until: '2027-06-30', area: 'Trực tuyến', allowSuggest: 'true', updatedAt: t }
    ]
  };
}

/** Include only the two trusted static UI snippets. Private to the server. */
function include_(name) {
  if (['Styles', 'Scripts'].indexOf(name) < 0) throw new Error('Tệp giao diện không hợp lệ.');
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Run in the Apps Script editor. Reports status without printing secrets. */
function kiemTraGoiCaiDat_() {
  const result = { phienBan: APP_VERSION, giaoDien: [], DriveAPI: typeof Drive !== 'undefined', coCSDL: !!prop_('SPREADSHEET_ID'), coKhoFile: !!prop_('FILES_FOLDER'), OAuth: { clientId: !!prop_('OAUTH_CLIENT_ID'), clientSecret: !!prop_('OAUTH_CLIENT_SECRET'), webAppUrl: !!AUTH.webAppUrl() } };
  const sources = {};
  ['Index', 'Styles', 'Scripts'].forEach(name => {
    try { sources[name] = HtmlService.createHtmlOutputFromFile(name).getContent(); result.giaoDien.push({tep:name,ok:!!sources[name].trim()}); }
    catch (e) { result.giaoDien.push({tep:name,ok:false,loi:'Thiếu file hoặc tên file chưa đúng.'}); }
  });
  const indexVersion = (String(sources.Index || '').match(/name="fluxience-build" content="([^"]+)"/) || [])[1] || '';
  const scriptVersion = (String(sources.Scripts || '').match(/const UI_VERSION = '([^']+)'/) || [])[1] || '';
  result.dongBoPhienBan = { Index: indexVersion, Scripts: scriptVersion, Styles: String(sources.Styles || '').includes('Fluxience build ' + APP_VERSION), dat: indexVersion === APP_VERSION && scriptVersion === APP_VERSION && String(sources.Styles || '').includes('Fluxience build ' + APP_VERSION) };
  result.fontQDP = { soFontNhung: (String(sources.Styles || '').match(/data:font\/woff2;base64,/g) || []).length, coSans: String(sources.Styles || '').includes('--font:"Fluxience QDP Sans"'), coDisplay: String(sources.Styles || '').includes('--font-display:"Fluxience QDP Display"') };
  result.fontQDP.dat = result.fontQDP.soFontNhung === 5 && result.fontQDP.coSans && result.fontQDP.coDisplay;
  let serviceUrl = ''; try { serviceUrl = String(ScriptApp.getService().getUrl() || ''); } catch (e) {}
  result.lienKet = { WEBAPP_URL: AUTH.webAppUrl(), urlDichVu: serviceUrl, khop: !!serviceUrl && AUTH.webAppUrl() === serviceUrl, ghiChu: 'Đối chiếu WEBAPP_URL với chính link /exec đang mở và redirect URI OAuth. Dự án có nhiều deployment cần kiểm tra từng deployment.' };
  if (result.giaoDien.every(x => x.ok)) {
    try { result.ghepGiaoDien = !!HtmlService.createTemplateFromFile('Index').evaluate().getContent(); }
    catch (e) { result.ghepGiaoDien = false; }
  } else result.ghepGiaoDien = false;
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
