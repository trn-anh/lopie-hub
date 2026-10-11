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
