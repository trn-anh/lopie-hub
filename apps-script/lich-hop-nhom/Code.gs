/**
 * LỊCH HỌP NHÓM — BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * Phiên bản 3.7 — Đăng nhập bằng Google OAuth 2.0 thật, phòng HCMUTE nạp sẵn,
 * tự kiểm tra link chính (/exec) có đang chạy đúng phiên bản không
 *
 * KIẾN TRÚC XÁC THỰC
 * ------------------
 * Web app deploy ở chế độ "Execute as: Me" nên Google Sheet vẫn riêng tư,
 * không cần chia sẻ cho bất kỳ ai. Danh tính người dùng KHÔNG lấy từ
 * Session.getActiveUser() (hàm này trả về rỗng với người ngoài tổ chức)
 * mà lấy từ luồng OAuth 2.0 Authorization Code do chính web app này chạy:
 *
 *   1. Người dùng bấm "Đăng nhập với Google" -> chuyển sang accounts.google.com
 *   2. Chọn tài khoản, đồng ý cấp scope openid/email/profile
 *   3. Google chuyển ngược về URL /exec kèm ?code=...
 *   4. doGet() đổi code lấy id_token, đọc email thật của người đăng nhập
 *   5. Server phát một session token có chữ ký HMAC, nhúng vào trang web
 *   6. Mọi lời gọi API sau đó đều gửi kèm token này để server biết là ai
 *
 * CÀI ĐẶT MỘT LẦN: chạy setup(), rồi chạy setOAuthCredentials(...)
 * Xem hướng dẫn chi tiết ở cuối file (hàm huongDanCaiDat).
 */

/* =====================================================================
   0. CẤU HÌNH
   ===================================================================== */
var SESSION_HOURS = 12;              // Session token sống bao lâu
var SCRIPT_PROPS = PropertiesService.getScriptProperties();
var APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';
var APP_VERSION = '3.7';
var DEFAULT_SCHOOL = 'Trường Đại học Công nghệ Kỹ thuật TP.HCM';
var TEXT_SETTINGS = ['APP_NAME', 'ORG_NAME', 'SCHOOL_NAME'];   // luôn là chữ, kể cả khi gõ toàn số

function prop_(key) {
  return String(SCRIPT_PROPS.getProperty(key) || '').trim();
}

/**
 * Google Sheets có thể trả ô ngày/giờ dưới dạng Date, kể cả khi ứng dụng đã
 * ghi chuỗi YYYY-MM-DD / HH:mm. Chuẩn hóa ngay tại biên dữ liệu để giao diện,
 * bộ lọc và kiểm tra trùng luôn làm việc với cùng một định dạng.
 */
function sheetTimeZone_(ss) {
  try { return String(ss.getSpreadsheetTimeZone() || APP_TIME_ZONE); } catch (e) { return APP_TIME_ZONE; }
}

function validDateObject_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function normalizeDateValue_(v, timeZone) {
  if (validDateObject_(v)) return Utilities.formatDate(v, timeZone || APP_TIME_ZONE, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  var ymd = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (ymd) return ymd[1] + '-' + LHN.pad(Number(ymd[2])) + '-' + LHN.pad(Number(ymd[3]));

  var dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (dmy) {
    var a = Number(dmy[1]), b = Number(dmy[2]);
    var day = a > 12 ? a : (b > 12 ? b : a);
    var month = a > 12 ? b : (b > 12 ? a : b);
    return dmy[3] + '-' + LHN.pad(month) + '-' + LHN.pad(day);
  }

  var named = s.match(/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})\b/i);
  if (named) {
    var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return named[3] + '-' + LHN.pad(months[named[1].toLowerCase()]) + '-' + LHN.pad(Number(named[2]));
  }

  var parsed = new Date(s);
  return isNaN(parsed.getTime()) ? s : Utilities.formatDate(parsed, timeZone || APP_TIME_ZONE, 'yyyy-MM-dd');
}

function normalizeTimeValue_(v, timeZone) {
  if (validDateObject_(v)) return Utilities.formatDate(v, timeZone || APP_TIME_ZONE, 'HH:mm');
  if (typeof v === 'number' && isFinite(v)) {
    var total = Math.round(((v % 1) + 1) % 1 * 24 * 60) % (24 * 60);
    return LHN.pad(Math.floor(total / 60)) + ':' + LHN.pad(total % 60);
  }
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var plain = s.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (plain) return LHN.pad(Number(plain[1])) + ':' + plain[2];
  var ampm = s.match(/\b(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)\b/i);
  if (ampm) {
    var h = Number(ampm[1]) % 12;
    if (ampm[3].toUpperCase() === 'PM') h += 12;
    return LHN.pad(h) + ':' + ampm[2];
  }
  var embedded = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
  return embedded ? LHN.pad(Number(embedded[1])) + ':' + embedded[2] : s;
}

/* =====================================================================
   1. SHARED UTILITIES & VALIDATION (LHN) — giữ nguyên
   ===================================================================== */
var LHN = (function () {
  function pad(n) { return String(n).padStart(2, '0'); }
  function lc(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function toMin(t) { var p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function fromMin(n) { return pad(Math.floor(n / 60)) + ':' + pad(n % 60); }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
  function isTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)); }
  function addDays(s, n) {
    var p = String(s).split('-').map(Number);
    var t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  function dow(s) { var p = String(s).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function monday(s) { return addDays(s, -((dow(s) + 6) % 7)); }
  function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }
  function isHttp(u) { return /^https?:\/\/\S+$/i.test(String(u || '').trim()); }
  function fmtDM(s) { var p = String(s).split('-'); return p[2] + '/' + p[1]; }
  function participants(m) {
    var out = [];
    [m.chair, m.secretary].concat(m.members || []).forEach(function (e) {
      e = lc(e); if (e && out.indexOf(e) < 0) out.push(e);
    });
    return out;
  }

  function validate(input, ctx) {
    var d = input || {};
    var errors = [], warnings = [], freeRooms = [], dates = [], conflictDates = [];
    var U = ctx.userBy || {};
    var nameOf = function (e) { return (U[e] && U[e].name) || e; };

    var title = String(d.title || '').trim();
    if (!title) errors.push('Nhập tiêu đề cuộc họp.');
    else if (title.length > 120) errors.push('Tiêu đề tối đa 120 ký tự.');
    if (String(d.desc || '').length > 2000) errors.push('Nội dung tối đa 2000 ký tự.');

    var repeat = ctx.editingId ? 1 : Math.floor(Number(d.repeatWeeks || 1));
    var maxRepeat = Number(ctx.maxRepeat || 12);
    if (!(repeat >= 1 && repeat <= maxRepeat)) { errors.push('Số tuần lặp phải từ 1 đến ' + maxRepeat + '.'); repeat = 1; }

    var room = null;
    (ctx.rooms || []).forEach(function (r) { if (r.id === d.room) room = r; });
    if (!room) errors.push('Chọn phòng họp.');
    else if (!room.active && !(ctx.original && ctx.original.room === d.room)) errors.push('Phòng ' + room.name + ' đang tạm ngưng sử dụng.');

    var chair = lc(d.chair), sec = lc(d.secretary);
    var okUser = function (e) { return U[e] && U[e].status === 'active'; };
    if (!chair) errors.push('Chọn người chủ trì.');
    else if (!okUser(chair)) errors.push('Người chủ trì không có trong danh sách thành viên.');
    if (sec && !okUser(sec)) errors.push('Thư ký không có trong danh sách thành viên.');
    if (chair && sec && chair === sec) errors.push('Chủ trì và thư ký phải là hai người khác nhau.');
    var members = (d.members || []).map(lc).filter(Boolean);
    var bad = members.filter(function (e) { return !okUser(e); });
    if (bad.length) errors.push('Thành viên không hợp lệ: ' + bad.join(', '));

    var docs = d.docs || [];
    if (docs.length > 10) errors.push('Tối đa 10 tài liệu cho mỗi cuộc họp.');
    docs.forEach(function (doc) {
      if (!isHttp(doc.url)) errors.push('Link tài liệu "' + (doc.name || doc.url || 'không tên') + '" phải bắt đầu bằng http:// hoặc https://');
      else if (String(doc.name || '').length > 100) errors.push('Tên tài liệu tối đa 100 ký tự.');
    });

    if (!(isDate(d.date) && isTime(d.start) && isTime(d.end))) {
      errors.push('Chọn đủ ngày, giờ bắt đầu và giờ kết thúc.');
      return { errors: errors, warnings: warnings, freeRooms: freeRooms, dates: dates, conflictDates: conflictDates };
    }
    var s = toMin(d.start), e = toMin(d.end);
    if (e <= s) errors.push('Giờ kết thúc phải sau giờ bắt đầu.');
    else if (s < ctx.dayStart * 60 || e > ctx.dayEnd * 60) errors.push('Chỉ đặt được trong khung ' + pad(ctx.dayStart) + ':00 – ' + pad(ctx.dayEnd) + ':00.');
    else if (e - s < 15) errors.push('Cuộc họp cần dài ít nhất 15 phút.');
    else {
      var o = ctx.original;
      // Chỉ chặn "thời điểm đã qua" khi dời ngày hoặc giờ bắt đầu: kéo dài giờ kết thúc
      // của cuộc họp đang diễn ra vẫn được.
      var timeChanged = !o || o.date !== d.date || o.start !== d.start;
      if (timeChanged && (d.date < ctx.today || (d.date === ctx.today && s < ctx.nowMin))) errors.push('Không thể đặt lịch cho thời điểm đã qua.');
      for (var i = 0; i < repeat; i++) dates.push(addDays(d.date, 7 * i));
      var active = (ctx.meetings || []).filter(function (m) { return m.status !== 'cancelled' && m.id !== ctx.editingId; });
      var busyAt = function (roomId, dt) {
        for (var k = 0; k < active.length; k++) {
          var m = active[k];
          if (m.room === roomId && m.date === dt && overlap(s, e, toMin(m.start), toMin(m.end))) return m;
        }
        return null;
      };
      if (room && !room.online) {
        dates.forEach(function (dt) {
          var c = busyAt(room.id, dt);
          if (c) {
            conflictDates.push(dt);
            errors.push((repeat > 1 ? 'Ngày ' + fmtDM(dt) + ': ' : '') + room.name + ' đã có "' + c.title + '" (' + c.start + '–' + c.end + ').');
          }
        });
        if (conflictDates.length) {
          freeRooms = (ctx.rooms || []).filter(function (r) {
            return r.active && r.id !== room.id && (r.online || dates.every(function (dt) { return !busyAt(r.id, dt); }));
          }).map(function (r) { return r.id; });
        }
      }
      // Một người không thể dự hai cuộc họp cùng lúc. Cuộc họp người đó đã báo
      // "Vắng" thì bỏ qua. Chủ trì hoặc thư ký bị trùng thì chặn lưu; thành viên
      // bị trùng thì chỉ nhắc, để họ tự chọn buổi sẽ dự.
      var declined = {};
      (ctx.attendance || []).forEach(function (a) {
        if (a && a.response === 'no') declined[a.meetingId + '|' + lc(a.email)] = true;
      });
      var ppl = participants({ chair: chair, secretary: sec, members: members });
      var same = active.filter(function (m) { return dates.indexOf(m.date) >= 0 && overlap(s, e, toMin(m.start), toMin(m.end)); });
      ppl.forEach(function (p) {
        for (var k = 0; k < same.length; k++) {
          if (participants(same[k]).indexOf(p) >= 0 && !declined[same[k].id + '|' + p]) {
            var busy = nameOf(p) + ' đang có lịch "' + same[k].title + '" (' + fmtDM(same[k].date) + ', ' + same[k].start + '–' + same[k].end + ').';
            if (p === chair) errors.push('Trùng lịch chủ trì: ' + busy);
            else if (p === sec) errors.push('Trùng lịch thư ký: ' + busy);
            else warnings.push(busy);
            break;
          }
        }
      });
      // Sức chứa 0 = chưa rõ (VD phòng vừa nạp từ sơ đồ): không cảnh báo quá chỗ
      if (room && !room.online && Number(room.capacity) > 0 && ppl.length > Number(room.capacity)) warnings.push(room.name + ' chỉ có ' + room.capacity + ' chỗ nhưng có ' + ppl.length + ' người tham dự.');
    }
    return { errors: errors, warnings: warnings, freeRooms: freeRooms, dates: dates, conflictDates: conflictDates };
  }

  return { pad: pad, lc: lc, toMin: toMin, fromMin: fromMin, isDate: isDate, isTime: isTime, addDays: addDays, dow: dow,
    monday: monday, overlap: overlap, isHttp: isHttp, fmtDM: fmtDM, participants: participants, validate: validate };
})();

/* =====================================================================
   2. XÁC THỰC GOOGLE OAUTH 2.0 + SESSION TOKEN
   ===================================================================== */
var AUTH = (function () {

  /* ---- Tiện ích mã hoá ---- */
  function pad4(s) { var r = s.length % 4; return r ? s + new Array(5 - r).join('=') : s; }
  function b64u(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
  function encodeStr(s) { return b64u(Utilities.newBlob(s).getBytes()); }
  function decodeStr(s) { return Utilities.newBlob(Utilities.base64DecodeWebSafe(pad4(String(s)))).getDataAsString(); }

  function sessionSecret() {
    var s = prop_('SESSION_SECRET');
    if (!s) {
      s = Utilities.getUuid() + '-' + Utilities.getUuid();
      SCRIPT_PROPS.setProperty('SESSION_SECRET', s);
    }
    return s;
  }
  function sign(payload) {
    return b64u(Utilities.computeHmacSha256Signature(payload, sessionSecret()));
  }

  /* ---- URL của web app (phải trùng tuyệt đối với Authorized redirect URI) ---- */
  function webAppUrl() {
    var u = prop_('WEBAPP_URL');
    if (u) return u;
    try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { u = ''; }
    return u;
  }

  function isConfigured() {
    return !!(prop_('OAUTH_CLIENT_ID') && prop_('OAUTH_CLIENT_SECRET') && webAppUrl());
  }

  /* ---- Session token có chữ ký (stateless, không cần lưu server) ---- */
  function makeToken(profile) {
    var body = encodeStr(JSON.stringify({
      e: String(profile.email || '').toLowerCase(),
      n: String(profile.name || ''),
      x: Date.now() + SESSION_HOURS * 3600 * 1000
    }));
    return body + '.' + sign(body);
  }

  function readToken(token) {
    if (!token) return null;
    var parts = String(token).split('.');
    if (parts.length !== 2) return null;
    if (sign(parts[0]) !== parts[1]) return null;      // chữ ký sai -> token giả
    var data;
    try { data = JSON.parse(decodeStr(parts[0])); } catch (e) { return null; }
    if (!data || !data.e || !data.x) return null;
    if (Number(data.x) < Date.now()) return null;      // hết hạn
    return { email: String(data.e).toLowerCase().trim(), name: String(data.n || '') };
  }

  /* ---- Bước 1: tạo URL đăng nhập Google ---- */
  function loginUrl() {
    if (!isConfigured()) return '';
    var state = Utilities.getUuid().replace(/-/g, '');
    CacheService.getScriptCache().put('oauth_state_' + state, '1', 3600);
    var q = {
      client_id: prop_('OAUTH_CLIENT_ID'),
      redirect_uri: webAppUrl(),
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      prompt: 'select_account',
      access_type: 'online'
    };
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(q).map(function (k) {
      return k + '=' + encodeURIComponent(q[k]);
    }).join('&');
  }

  /* ---- Bước 2: đổi authorization code lấy id_token ---- */
  function exchangeCode(code) {
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      payload: {
        code: code,
        client_id: prop_('OAUTH_CLIENT_ID'),
        client_secret: prop_('OAUTH_CLIENT_SECRET'),
        redirect_uri: webAppUrl(),
        grant_type: 'authorization_code'
      },
      muteHttpExceptions: true
    });
    var body = {};
    try { body = JSON.parse(res.getContentText() || '{}'); } catch (e) {}
    if (res.getResponseCode() !== 200 || !body.id_token) {
      throw new Error(body.error_description || body.error || 'Google từ chối mã đăng nhập (HTTP ' + res.getResponseCode() + ').');
    }
    return readIdToken(body.id_token);
  }

  /* ---- Bước 3: đọc & kiểm tra id_token ---- */
  function readIdToken(jwt) {
    var seg = String(jwt).split('.');
    if (seg.length < 2) throw new Error('id_token không hợp lệ.');
    var c;
    try { c = JSON.parse(decodeStr(seg[1])); } catch (e) { throw new Error('Không đọc được id_token.'); }
    if (String(c.aud) !== prop_('OAUTH_CLIENT_ID')) throw new Error('id_token không thuộc ứng dụng này.');
    if (['accounts.google.com', 'https://accounts.google.com'].indexOf(String(c.iss)) < 0) throw new Error('id_token không do Google phát hành.');
    if (Number(c.exp) * 1000 < Date.now()) throw new Error('id_token đã hết hạn.');
    if (c.email_verified === false) throw new Error('Email Google này chưa được xác minh.');
    if (!c.email) throw new Error('Không lấy được email từ tài khoản Google.');
    return {
      email: String(c.email).toLowerCase().trim(),
      name: String(c.name || c.given_name || '').trim()
    };
  }

  /* ---- Bước 4: mã trao tay một lần, để token không nằm lại trên URL ---- */
  function putHandoff(token) {
    var code = Utilities.getUuid().replace(/-/g, '');
    CacheService.getScriptCache().put('handoff_' + code, token, 180);
    return code;
  }
  function takeHandoff(code) {
    if (!code) return '';
    var cache = CacheService.getScriptCache();
    var token = cache.get('handoff_' + code) || '';
    if (token) cache.remove('handoff_' + code);
    return token;
  }

  function checkState(state) {
    if (!state) return false;
    var cache = CacheService.getScriptCache();
    var hit = cache.get('oauth_state_' + state);
    if (hit) cache.remove('oauth_state_' + state);
    return !!hit;
  }

  return {
    isConfigured: isConfigured, webAppUrl: webAppUrl, loginUrl: loginUrl,
    exchangeCode: exchangeCode, makeToken: makeToken, readToken: readToken,
    putHandoff: putHandoff, takeHandoff: takeHandoff, checkState: checkState
  };
})();

/* =====================================================================
   3. GOOGLE SHEETS DATABASE LAYER
   ===================================================================== */
function getSpreadsheet_() {
  var sheetId = prop_('SPREADSHEET_ID');
  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      throw new Error('Không mở được Google Sheet (ID: ' + sheetId + '). Hãy kiểm tra file còn tồn tại và chạy lại setup().');
    }
  }
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) ss = SpreadsheetApp.create('CSDL Lịch Họp Nhóm');
  SCRIPT_PROPS.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheetData_(sheetName, ss) {
  ss = ss || getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var vals = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = vals[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < vals.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function saveSheetData_(sheetName, rows, headers, ss) {
  ss = ss || getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clearContents();

  var matrix = [headers];
  if (rows && rows.length > 0) {
    for (var i = 0; i < rows.length; i++) {
      var line = [];
      for (var j = 0; j < headers.length; j++) {
        var val = rows[i][headers[j]];
        if (val === undefined || val === null) val = '';
        // Nội dung bắt đầu bằng "=" phải được lưu như văn bản, không phải công thức Sheet.
        if (typeof val === 'string' && val.charAt(0) === '=') val = "'" + val;
        line.push(val);
      }
      matrix.push(line);
    }
  }
  var target = sheet.getRange(1, 1, matrix.length, headers.length);
  // Giữ chuỗi ngày/giờ và nội dung người dùng ở dạng văn bản; không để Sheets
  // tự đổi 07:00 thành ngày 30/12/1899 hoặc diễn giải tiêu đề như công thức.
  target.setNumberFormat('@');
  target.setValues(matrix);
}

function getDatabase_(ss) {
  ss = ss || getSpreadsheet_();
  var timeZone = sheetTimeZone_(ss);
  var usersRaw = getSheetData_('Users', ss);
  var roomsRaw = getSheetData_('Rooms', ss);
  var meetingsRaw = getSheetData_('Meetings', ss);
  var docsRaw = getSheetData_('Docs', ss);
  var attendanceRaw = getSheetData_('Attendance', ss);
  var settingsRaw = getSheetData_('Settings', ss);
  var logsRaw = getSheetData_('Logs', ss);

  var settings = {
    APP_NAME: 'Lịch Họp Nhóm',
    ORG_NAME: 'CLB Khởi nghiệp HCMUTE',
    SCHOOL_NAME: DEFAULT_SCHOOL,
    DAY_START: 7,
    DAY_END: 18,
    SEND_EMAIL: true,
    CREATE_CALENDAR_EVENT: false,
    ALLOW_SELF_REGISTER: true,
    MAX_REPEAT_WEEKS: 12
  };
  settingsRaw.forEach(function (s) {
    if (s.key) {
      if (s.value === 'true') settings[s.key] = true;
      else if (s.value === 'false') settings[s.key] = false;
      else if (!isNaN(Number(s.value)) && TEXT_SETTINGS.indexOf(s.key) < 0) settings[s.key] = Number(s.value);
      else settings[s.key] = s.value;
    }
  });

  var users = usersRaw.map(function (u) {
    return {
      email: String(u.email || '').trim().toLowerCase(),
      name: String(u.name || ''),
      unit: String(u.unit || ''),
      role: u.role === 'admin' ? 'admin' : 'member',
      status: String(u.status || 'active'),
      createdAt: String(u.createdAt || ''),
      photo: String(u.photo || ''),
      avatar: String(u.avatar || ''),
      showPresence: String(u.showPresence).toLowerCase() !== 'false'
    };
  }).filter(function (u) { return !!u.email; });

  // Ô TRUE/FALSE có thể về dạng boolean hoặc chuỗi "TRUE"/"true" tùy định dạng ô.
  // Đọc sai cờ online thì phòng Online bị coi là phòng thật (báo trùng oan),
  // đọc sai cờ active thì phòng tạm ngưng vẫn nhận đặt.
  var flag = function (v, dflt) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return dflt;
  };
  var rooms = roomsRaw.map(function (r) {
    return {
      id: String(r.id || '').trim(),
      name: String(r.name || ''),
      capacity: Number(r.capacity || 0),
      building: String(r.building || ''),
      equipment: String(r.equipment || ''),
      online: flag(r.online, false),
      active: flag(r.active, true),
      sample: flag(r.sample, false)
    };
  });

  var meetings = meetingsRaw.map(function (m) {
    var members = [];
    if (typeof m.members === 'string') {
      try { members = JSON.parse(m.members); } catch (e) { members = m.members ? m.members.split(',').map(function (x) { return x.trim().toLowerCase(); }) : []; }
    } else if (Array.isArray(m.members)) {
      members = m.members;
    }
    return {
      id: String(m.id || ''),
      seriesId: String(m.seriesId || ''),
      requestId: String(m.requestId || ''),
      title: String(m.title || ''),
      desc: String(m.desc || ''),
      date: normalizeDateValue_(m.date, timeZone),
      start: normalizeTimeValue_(m.start, timeZone),
      end: normalizeTimeValue_(m.end, timeZone),
      room: String(m.room || '').trim(),
      chair: String(m.chair || '').trim().toLowerCase(),
      secretary: String(m.secretary || '').trim().toLowerCase(),
      members: members,
      remind: Number(m.remind || 30),
      status: String(m.status || 'active'),
      createdBy: String(m.createdBy || '').toLowerCase(),
      createdAt: String(m.createdAt || ''),
      updatedAt: String(m.updatedAt || ''),
      minutes: String(m.minutes || ''),
      minutesBy: String(m.minutesBy || ''),
      minutesAt: String(m.minutesAt || ''),
      cancelReason: String(m.cancelReason || '')
    };
  });

  var docs = docsRaw.map(function (d) {
    return {
      id: String(d.id || ''),
      meetingId: String(d.meetingId || ''),
      name: String(d.name || ''),
      url: String(d.url || '')
    };
  });

  var attendance = attendanceRaw.map(function (a) {
    return {
      meetingId: String(a.meetingId || ''),
      email: String(a.email || '').toLowerCase(),
      response: String(a.response || 'none'),
      note: String(a.note || ''),
      updatedAt: String(a.updatedAt || '')
    };
  });

  return {
    users: users, rooms: rooms, meetings: meetings,
    docs: docs, attendance: attendance, settings: settings, logs: logsRaw
  };
}

function saveDatabase_(db, ss) {
  ss = ss || getSpreadsheet_();
  dirInvalidate_();
  saveSheetData_('Users', db.users, ['email', 'name', 'unit', 'role', 'status', 'createdAt', 'photo', 'avatar', 'showPresence'], ss);
  saveSheetData_('Rooms', db.rooms, ['id', 'name', 'capacity', 'building', 'equipment', 'online', 'active', 'sample'], ss);

  var meetHeaders = ['id', 'seriesId', 'requestId', 'title', 'desc', 'date', 'start', 'end', 'room', 'chair', 'secretary', 'members', 'remind', 'status', 'createdBy', 'createdAt', 'updatedAt', 'minutes', 'minutesBy', 'minutesAt', 'cancelReason'];
  var meetRows = db.meetings.map(function (m) {
    var copy = Object.assign({}, m);
    copy.members = JSON.stringify(copy.members || []);
    return copy;
  });
  saveSheetData_('Meetings', meetRows, meetHeaders, ss);

  saveSheetData_('Docs', db.docs, ['id', 'meetingId', 'name', 'url'], ss);
  saveSheetData_('Attendance', db.attendance, ['meetingId', 'email', 'response', 'note', 'updatedAt'], ss);

  var settingRows = Object.keys(db.settings).map(function (k) {
    return { key: k, value: String(db.settings[k]) };
  });
  saveSheetData_('Settings', settingRows, ['key', 'value'], ss);
  dirInvalidate_();   // xoá lần nữa: nhịp "đang online" chạy song song có thể vừa đệm lại danh bạ cũ
}

function addLog_(email, action, mid, detail) {
  try {
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName('Logs');
    if (!sheet) {
      sheet = ss.insertSheet('Logs');
      sheet.appendRow(['time', 'email', 'action', 'meetingId', 'detail']);
    }
    sheet.appendRow([nowStr, email || 'system', action, mid || '', detail || '']);
  } catch (e) {}
}

/* =====================================================================
   4. WEB APP ENTRY POINT
   ===================================================================== */
function doGet(e) {
  var p = (e && e.parameter) || {};

  // Máy chủ tự hỏi link chính đang chạy phiên bản nào (xem probeExec_). Chỉ trả số phiên bản.
  if (p.lhn_probe) {
    return ContentService.createTextOutput('LHN-VERSION:' + APP_VERSION).setMimeType(ContentService.MimeType.TEXT);
  }

  // Người dùng bấm "Huỷ" ở màn hình Google
  if (p.error) {
    return errorPage_('Đăng nhập chưa hoàn tất',
      'Google báo: ' + p.error + '. Bạn có thể thử lại.');
  }

  // Google chuyển ngược về kèm authorization code
  if (p.code) {
    try {
      if (!AUTH.checkState(p.state)) {
        return errorPage_('Phiên đăng nhập đã hết hạn',
          'Liên kết đăng nhập chỉ dùng được trong 60 phút. Hãy mở lại ứng dụng và bấm "Đăng nhập với Google" một lần nữa.');
      }
      var profile = AUTH.exchangeCode(p.code);
      syncUser_(profile);
      addLog_(profile.email, 'login', '', '');
      var handoff = AUTH.putHandoff(AUTH.makeToken(profile));
      return redirectPage_(AUTH.webAppUrl() + '?t=' + handoff, profile.email);
    } catch (err) {
      return errorPage_('Đăng nhập thất bại', (err && err.message) ? err.message : String(err));
    }
  }

  // Trang ứng dụng bình thường
  var bootToken = '';
  try { bootToken = AUTH.takeHandoff(p.t); } catch (err) {}

  var html = HtmlService.createHtmlOutputFromFile('Index').getContent();
  html = html.replace('__LHN_BOOT_TOKEN__', bootToken.replace(/[^A-Za-z0-9._\-]/g, ''));

  return HtmlService.createHtmlOutput(html)
    .setTitle('Lịch Họp Nhóm')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function shellPage_(inner) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="vi"><head><base target="_top"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F8FB;' +
    'font-family:"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Roboto,Arial,sans-serif;color:#102A3A}' +
    '.card{width:min(440px,calc(100% - 32px));background:#fff;border:1px solid #C9D9E5;border-top:5px solid #0072BC;' +
    'border-radius:10px;padding:32px;box-shadow:0 4px 16px rgba(16,42,58,.08)}' +
    'h1{font-size:22px;margin:0 0 10px}p{color:#526C7B;margin:0 0 18px;line-height:1.55}' +
    '.btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;border-radius:6px;' +
    'background:#0072BC;color:#fff;text-decoration:none;font-weight:700}code{background:#F4F8FB;padding:2px 5px;border-radius:4px;font-size:13px}</style>' +
    '</head><body><div class="card">' + inner + '</div></body></html>')
    .setTitle('Lịch Họp Nhóm')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function redirectPage_(url, email) {
  var safe = String(url).replace(/"/g, '&quot;');
  return shellPage_(
    '<h1>Đăng nhập thành công</h1>' +
    '<p>Xin chào <b>' + String(email || '').replace(/</g, '&lt;') + '</b>. Đang mở lịch họp…</p>' +
    '<a class="btn" href="' + safe + '" target="_top">Tiếp tục vào ứng dụng</a>' +
    '<script>setTimeout(function(){try{window.top.location.href="' + safe + '";}catch(e){}},400);<\/script>'
  );
}

function errorPage_(title, message) {
  var back = String(AUTH.webAppUrl() || '').replace(/"/g, '&quot;');
  return shellPage_(
    '<h1>' + String(title).replace(/</g, '&lt;') + '</h1>' +
    '<p>' + String(message).replace(/</g, '&lt;') + '</p>' +
    (back ? '<a class="btn" href="' + back + '" target="_top">Quay lại ứng dụng</a>' : '')
  );
}

/* =====================================================================
   5. PHIÊN LÀM VIỆC — mọi API đều đi qua đây
   ===================================================================== */

/** Tạo hồ sơ lần đầu đăng nhập; hồ sơ đã có thì chỉ bổ sung tên nếu còn trống. */
function syncUser_(profile) {
  var db = getDatabase_();
  var found = null;
  db.users.forEach(function (u) { if (u.email === profile.email) found = u; });

  if (found) {
    if (!found.name && profile.name) { found.name = profile.name; saveDatabase_(db); }
    return found;
  }

  var ownerEmail = prop_('ADMIN_EMAIL').toLowerCase();
  if (!ownerEmail) {
    try { ownerEmail = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) {}
  }

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');

  // Chủ sở hữu script luôn là quản trị viên. Người khác phải chờ duyệt.
  if (db.users.length === 0 || profile.email === ownerEmail) {
    var admin = {
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      unit: 'Ban Quản trị',
      role: 'admin',
      status: 'active',
      createdAt: nowStr,
      photo: '',
      avatar: '',
      showPresence: true
    };
    db.users.push(admin);
    saveDatabase_(db);
    addLog_(profile.email, 'admin_created', '', 'Tạo quản trị viên đầu tiên');
    return admin;
  }
  return null;
}

/** Đọc token -> trả về { db, user, email }. Ném lỗi nếu chưa đăng nhập. */
function ctx_(token, needActive) {
  var s = AUTH.readToken(token);
  if (!s) throw new Error('Phiên đăng nhập đã hết hạn. Hãy tải lại trang và đăng nhập lại.');
  var db = getDatabase_();
  var user = null;
  db.users.forEach(function (u) { if (u.email === s.email) user = u; });
  if (needActive !== false) {
    if (!user) throw new Error('Tài khoản ' + s.email + ' chưa có trong danh sách thành viên.');
    if (user.status !== 'active') throw new Error('Tài khoản của bạn chưa được duyệt hoặc đã bị khoá.');
  }
  return { db: db, user: user, email: s.email, profileName: s.name };
}

function requireAdmin_(c) {
  if (!c.user || c.user.role !== 'admin') throw new Error('Chỉ quản trị viên mới có quyền.');
  return c.user;
}

/** Phần cài đặt được hiện trước khi đăng nhập. */
function publicSettings_(st) {
  return {
    APP_NAME: st.APP_NAME, ORG_NAME: st.ORG_NAME, SCHOOL_NAME: st.SCHOOL_NAME,
    ALLOW_SELF_REGISTER: st.ALLOW_SELF_REGISTER
  };
}

function appPayload_(db, user) {
  var now = new Date();
  var nowTime = Utilities.formatDate(now, APP_TIME_ZONE, 'HH:mm').split(':').map(Number);
  return {
    state: 'ok',
    mode: 'gas',
    email: user.email,
    me: user,
    settings: db.settings,
    today: Utilities.formatDate(now, APP_TIME_ZONE, 'yyyy-MM-dd'),
    nowMin: nowTime[0] * 60 + nowTime[1],
    version: APP_VERSION,
    users: user.role === 'admin' ? db.users : db.users.filter(function (x) { return x.status === 'active'; }),
    rooms: db.rooms,
    meetings: db.meetings,
    docs: db.docs,
    attendance: db.attendance
  };
}

/* =====================================================================
   6. API — mọi hàm đều nhận token ở tham số đầu tiên
   ===================================================================== */
function api_bootstrap(token) {
  try {
    if (!AUTH.isConfigured()) {
      return {
        state: 'error',
        message: 'Ứng dụng chưa được cấu hình đăng nhập Google. Quản trị viên cần chạy hàm setOAuthCredentials() trong Apps Script (xem hướng dẫn trong Code.gs).'
      };
    }

    var db = getDatabase_();
    // Màn hình chưa đăng nhập chỉ cần tên app/trường, không lộ lịch họp hay cài đặt khác
    var brand = publicSettings_(db.settings);

    var s = AUTH.readToken(token);
    if (!s) {
      return { state: 'login', mode: 'gas', authUrl: AUTH.loginUrl(), settings: brand, version: APP_VERSION };
    }

    var user = null;
    db.users.forEach(function (u) { if (u.email === s.email) user = u; });
    if (!user) user = syncUser_({ email: s.email, name: s.name });
    if (!user) return { state: 'unregistered', email: s.email, settings: brand, version: APP_VERSION };
    if (user.status === 'pending') return { state: 'pending', email: user.email, settings: brand, version: APP_VERSION };
    if (user.status === 'disabled') return { state: 'disabled', email: user.email, settings: brand, version: APP_VERSION };

    var seeded = seedHcmute_();
    if (seeded) db = getDatabase_();
    var out = appPayload_(db, user);
    if (seeded && seeded.added && user.role === 'admin') out.seeded = seeded;
    return out;
  } catch (err) {
    return {
      state: 'error',
      message: 'Không đọc được dữ liệu Google Sheet: ' + ((err && err.message) ? err.message : String(err))
    };
  }
}

function api_requestAccess(token, data) {
  var s = AUTH.readToken(token);
  if (!s) throw new Error('Phiên đăng nhập đã hết hạn.');
  var db = getDatabase_();
  if (db.settings.ALLOW_SELF_REGISTER === false) throw new Error('Hệ thống đang tắt chức năng tự đăng ký.');

  var existing = null;
  db.users.forEach(function (u) { if (u.email === s.email) existing = u; });
  if (existing) throw new Error('Yêu cầu của bạn đã tồn tại.');

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
  db.users.push({
    email: s.email,
    name: String((data && data.name) || '').trim() || s.name || s.email.split('@')[0],
    unit: String((data && data.unit) || '').trim(),
    role: 'member',
    status: 'pending',
    createdAt: nowStr,
    photo: '',
    avatar: '',
    showPresence: true
  });
  saveDatabase_(db);
  addLog_(s.email, 'request_access', '', s.email);
  return { ok: true };
}

function api_saveMeeting(token, input) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Hệ thống đang xử lý một lượt đặt lịch khác. Vui lòng thử lại sau vài giây.');
  try {
    var c = ctx_(token);
    var db = c.db, user = c.user, email = c.email;

  var editing = null;
  if (input.id) {
    db.meetings.forEach(function (m) { if (m.id === input.id) editing = m; });
    if (!editing) throw new Error('Không tìm thấy cuộc họp.');
    if (user.role !== 'admin' && editing.createdBy !== email && editing.chair !== email) {
      throw new Error('Bạn không có quyền sửa cuộc họp này.');
    }
  }

  var requestId = String(input.requestId || '').trim();
  if (!editing && requestId) {
    var existingIds = db.meetings.filter(function (m) {
      return m.requestId === requestId && m.createdBy === email;
    }).map(function (m) { return m.id; });
    if (existingIds.length) return { ok: true, ids: existingIds, warnings: [], data: appPayload_(db, user) };
  }

  var now = new Date();
  var todayStr = Utilities.formatDate(now, APP_TIME_ZONE, 'yyyy-MM-dd');
  var nowClock = Utilities.formatDate(now, APP_TIME_ZONE, 'HH:mm').split(':').map(Number);
  var nowMin = nowClock[0] * 60 + nowClock[1];

  var userBy = {};
  db.users.forEach(function (u) { userBy[u.email] = u; });

  var res = LHN.validate(input, {
    rooms: db.rooms, userBy: userBy, meetings: db.meetings, attendance: db.attendance,
    dayStart: Number(db.settings.DAY_START), dayEnd: Number(db.settings.DAY_END),
    maxRepeat: Number(db.settings.MAX_REPEAT_WEEKS),
    today: todayStr, nowMin: nowMin,
    editingId: editing ? editing.id : null, original: editing
  });
  if (res.errors.length > 0) throw new Error(res.errors.join('\n'));

  var nowStr = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
  var members = (input.members || []).filter(function (e) { return e !== input.chair && e !== input.secretary; });
  var fields = {
    title: String(input.title || '').trim(),
    desc: String(input.desc || '').trim(),
    start: input.start,
    end: input.end,
    room: input.room,
    chair: String(input.chair || '').toLowerCase(),
    secretary: String(input.secretary || '').toLowerCase(),
    members: members,
    remind: Number(input.remind || 30)
  };

  var ids = [];
  if (editing) {
    Object.assign(editing, fields, { date: input.date, updatedAt: nowStr });
    ids.push(editing.id);
    addLog_(email, 'update', editing.id, fields.title);
  } else {
    var sid = res.dates.length > 1 ? 's_' + Utilities.getUuid().slice(0, 8) : '';
    res.dates.forEach(function (dt) {
      var mid = 'm_' + Utilities.getUuid().slice(0, 8);
      var m = Object.assign({
        id: mid, seriesId: sid, requestId: requestId, date: dt, status: 'active',
        createdBy: email, createdAt: nowStr, updatedAt: nowStr,
        minutes: '', minutesBy: '', minutesAt: '', cancelReason: ''
      }, fields);
      db.meetings.push(m);
      ids.push(mid);
      if (LHN.participants(m).indexOf(email) >= 0) {
        db.attendance.push({ meetingId: mid, email: email, response: 'yes', note: '', updatedAt: nowStr });
      }
    });
    addLog_(email, 'create', ids[0], fields.title + ' · ' + res.dates.join(', '));
  }

  ids.forEach(function (mid) {
    db.docs = db.docs.filter(function (d) { return d.meetingId !== mid; });
    (input.docs || []).forEach(function (d) {
      if (d.name || d.url) {
        db.docs.push({ id: 'd_' + Utilities.getUuid().slice(0, 8), meetingId: mid, name: d.name || d.url, url: d.url });
      }
    });
  });

  saveDatabase_(db);
  return { ok: true, ids: ids, warnings: res.warnings, data: appPayload_(db, user) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Kéo thả trên lịch: chỉ đổi ngày, giờ, phòng; tài liệu và thành phần giữ nguyên.
 * Vẫn kiểm tra đầy đủ như khi sửa bằng form: trùng phòng, chủ trì/thư ký bận, giờ đã qua.
 */
function api_moveMeeting(token, mid, patch) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Hệ thống đang xử lý một lượt đặt lịch khác. Vui lòng thử lại sau vài giây.');
  try {
    var c = ctx_(token);
    var db = c.db, user = c.user, email = c.email;
    var m = null;
    db.meetings.forEach(function (x) { if (x.id === mid) m = x; });
    if (!m) throw new Error('Không tìm thấy cuộc họp.');
    if (m.status === 'cancelled') throw new Error('Cuộc họp đã bị hủy.');
    if (user.role !== 'admin' && m.createdBy !== email && m.chair !== email) {
      throw new Error('Chỉ người tạo, chủ trì hoặc quản trị viên được dời cuộc họp này.');
    }
    patch = patch || {};
    var input = {
      id: m.id, title: m.title, desc: m.desc, chair: m.chair, secretary: m.secretary, members: m.members,
      date: String(patch.date || m.date), start: String(patch.start || m.start),
      end: String(patch.end || m.end), room: String(patch.room || m.room), docs: [], repeatWeeks: 1
    };
    var now = new Date();
    var clock = Utilities.formatDate(now, APP_TIME_ZONE, 'HH:mm').split(':').map(Number);
    var userBy = {};
    db.users.forEach(function (u) { userBy[u.email] = u; });
    var res = LHN.validate(input, {
      rooms: db.rooms, userBy: userBy, meetings: db.meetings, attendance: db.attendance,
      dayStart: Number(db.settings.DAY_START), dayEnd: Number(db.settings.DAY_END),
      maxRepeat: Number(db.settings.MAX_REPEAT_WEEKS),
      today: Utilities.formatDate(now, APP_TIME_ZONE, 'yyyy-MM-dd'), nowMin: clock[0] * 60 + clock[1],
      editingId: m.id, original: m
    });
    if (res.errors.length > 0) throw new Error(res.errors.join('\n'));

    var before = m.date + ' ' + m.start + '–' + m.end + ' ' + m.room;
    m.date = input.date; m.start = input.start; m.end = input.end; m.room = input.room;
    m.updatedAt = Utilities.formatDate(now, APP_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
    saveDatabase_(db);
    addLog_(email, 'move', m.id, before + ' → ' + m.date + ' ' + m.start + '–' + m.end + ' ' + m.room);
    return { ok: true, ids: [m.id], warnings: res.warnings, data: appPayload_(db, user) };
  } finally {
    lock.releaseLock();
  }
}

function api_cancelMeeting(token, mid, scope, reason) {
  var c = ctx_(token);
  var db = c.db, user = c.user, email = c.email;

  var m = null;
  db.meetings.forEach(function (x) { if (x.id === mid) m = x; });
  if (!m) throw new Error('Không tìm thấy cuộc họp.');
  if (user.role !== 'admin' && m.createdBy !== email && m.chair !== email) {
    throw new Error('Bạn không có quyền hủy.');
  }

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
  var targets = (scope === 'series' && m.seriesId)
    ? db.meetings.filter(function (x) { return x.seriesId === m.seriesId && x.date >= m.date && x.status !== 'cancelled'; })
    : [m];

  targets.forEach(function (x) {
    x.status = 'cancelled';
    x.cancelReason = String(reason || '').trim();
    x.updatedAt = nowStr;
  });

  saveDatabase_(db);
  addLog_(email, 'cancel', mid, targets.length + ' buổi');
  return { ok: true, ids: targets.map(function (x) { return x.id; }), data: appPayload_(db, user) };
}

function api_restoreMeeting(token, ids) {
  var c = ctx_(token);
  var db = c.db, user = c.user, email = c.email;

  var idList = [].concat(ids);
  var done = [];
  idList.forEach(function (mid) {
    var m = null;
    db.meetings.forEach(function (x) { if (x.id === mid) m = x; });
    if (!m) return;
    if (user.role !== 'admin' && m.createdBy !== email && m.chair !== email) {
      throw new Error('Bạn không có quyền khôi phục.');
    }
    var room = null;
    db.rooms.forEach(function (r) { if (r.id === m.room) room = r; });
    var clash = null;
    if (room && !room.online) {
      db.meetings.forEach(function (x) {
        if (!clash && x.status !== 'cancelled' && x.id !== m.id && x.room === m.room && x.date === m.date &&
            LHN.overlap(LHN.toMin(m.start), LHN.toMin(m.end), LHN.toMin(x.start), LHN.toMin(x.end))) clash = x;
      });
    }
    if (clash) throw new Error('Không khôi phục được buổi ' + LHN.fmtDM(m.date) + ': ' + room.name + ' đã được đặt cho "' + clash.title + '".');
    m.status = 'active';
    m.cancelReason = '';
    done.push(mid);
  });

  saveDatabase_(db);
  addLog_(email, 'restore', done[0], done.length + ' buổi');
  return { ok: true, ids: done, data: appPayload_(db, user) };
}

function api_rsvp(token, mid, response, note) {
  var c = ctx_(token);
  var db = c.db, email = c.email;

  var m = null;
  db.meetings.forEach(function (x) { if (x.id === mid) m = x; });
  if (!m) throw new Error('Không tìm thấy cuộc họp.');
  if (['yes', 'maybe', 'no'].indexOf(response) < 0) throw new Error('Phản hồi không hợp lệ.');
  if (LHN.participants(m).indexOf(email) < 0) throw new Error('Bạn không có trong thành phần cuộc họp này.');

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
  var att = null;
  db.attendance.forEach(function (a) { if (a.meetingId === mid && a.email === email) att = a; });
  if (!att) {
    att = { meetingId: mid, email: email };
    db.attendance.push(att);
  }
  att.response = response;
  att.note = String(note || '').trim();
  att.updatedAt = nowStr;

  saveDatabase_(db);
  addLog_(email, 'rsvp', mid, response);
  return { ok: true, data: appPayload_(db, c.user) };
}

function api_saveMinutes(token, mid, text) {
  var c = ctx_(token);
  var db = c.db, user = c.user, email = c.email;

  var m = null;
  db.meetings.forEach(function (x) { if (x.id === mid) m = x; });
  if (!m) throw new Error('Không tìm thấy cuộc họp.');
  if (user.role !== 'admin' && m.chair !== email && m.secretary !== email) {
    throw new Error('Chỉ chủ trì, thư ký hoặc admin được ghi biên bản.');
  }

  m.minutes = String(text || '').slice(0, 20000);
  m.minutesBy = email;
  m.minutesAt = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');

  saveDatabase_(db);
  addLog_(email, 'minutes', mid, m.minutes.length + ' ký tự');
  return { ok: true, data: appPayload_(db, user) };
}

/** Thư mục Drive chứa tài liệu cuộc họp, tạo một lần rồi dùng lại (thay vì rải ở thư mục gốc). */
function docsFolder_() {
  var id = prop_('DOCS_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {}
  }
  var folder = DriveApp.createFolder('Lich Hop Nhom — Tai lieu');
  SCRIPT_PROPS.setProperty('DOCS_FOLDER_ID', folder.getId());
  return folder;
}

function api_uploadDoc(token, fileData) {
  var c = ctx_(token);
  var bytes = Utilities.base64Decode(String((fileData && fileData.data) || ''));
  if (!bytes || !bytes.length) throw new Error('Không đọc được nội dung tệp.');
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Tệp tối đa 10 MB. Hãy tải lên Drive rồi dán link.');
  var name = String(fileData.name || 'tai-lieu').slice(0, 200);
  var blob = Utilities.newBlob(bytes, String(fileData.mimeType || 'application/octet-stream'), name);
  var file = docsFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  addLog_(c.email, 'upload', '', file.getName());
  return { name: file.getName(), url: file.getUrl() };
}

function api_saveRoom(token, x) {
  var c = ctx_(token);
  requireAdmin_(c);
  var db = c.db;

  var rid = String(x.id || '').trim().replace(/[^\w\-.]/g, '-');
  var r = null;
  db.rooms.forEach(function (y) { if (y.id === rid) r = y; });
  if (x.isNew && r) throw new Error('Mã phòng đã tồn tại.');
  if (!r) { r = { id: rid }; db.rooms.push(r); }
  Object.assign(r, {
    name: String(x.name || '').trim(),
    capacity: Math.max(0, Number(x.capacity || 0)),
    building: String(x.building || '').trim() || 'Khác',
    equipment: String(x.equipment || '').trim(),
    online: Boolean(x.online),
    active: x.active !== false,
    sample: false
  });

  saveDatabase_(db);
  addLog_(c.email, 'room_save', '', rid);
  return { ok: true, data: api_bootstrap(token) };
}

/**
 * Thêm nhiều phòng một lần (tạo dãy phòng, dán danh sách, nạp địa điểm theo sơ đồ trường).
 * Mã phòng đã có thì bỏ qua, không ghi đè. opts.deactivate: mã các phòng mẫu muốn tạm ngưng.
 */
function api_importRooms(token, list, opts) {
  var c = ctx_(token);
  requireAdmin_(c);
  var db = c.db;
  list = Array.isArray(list) ? list : [];
  if (list.length > 1000) throw new Error('Mỗi lần thêm tối đa 1000 phòng.');
  var byId = {};
  db.rooms.forEach(function (r) { byId[r.id] = r; });
  var added = [], skipped = [], paused = [];
  list.forEach(function (x) {
    x = x || {};
    var id = String(x.id || x.name || '').trim().replace(/[^\w\-.]/g, '-').slice(0, 40);
    if (!id) return;
    if (byId[id]) { skipped.push(id); return; }
    var r = {
      id: id,
      name: String(x.name || id).trim().slice(0, 80),
      capacity: Math.max(0, Math.floor(Number(x.capacity) || 0)),   // 0 = chưa rõ
      building: String(x.building || '').trim().slice(0, 80) || 'Khác',
      equipment: String(x.equipment || '').trim().slice(0, 200),
      online: false,
      active: x.active !== false,
      sample: x.sample === true
    };
    db.rooms.push(r); byId[id] = r; added.push(id);
  });
  ((opts && opts.deactivate) || []).forEach(function (id) {
    var r = byId[String(id)];
    if (r && r.active && !r.online) { r.active = false; paused.push(r.id); }
  });
  if (added.length || paused.length) {
    saveDatabase_(db);
    addLog_(c.email, 'room_import', '', 'Thêm ' + added.length + ' phòng' +
      (added.length ? ' (' + added.slice(0, 4).join(', ') + (added.length > 4 ? '…' : '') + ')' : '') +
      (paused.length ? ', tạm ngưng ' + paused.join(', ') : ''));
  }
  return { ok: true, added: added.length, skipped: skipped, paused: paused, data: api_bootstrap(token) };
}

/**
 * Xoá phòng. Phòng đã từng có lịch họp (kể cả lịch cũ, lịch đã huỷ) không bị xoá
 * mà chuyển sang tạm ngưng, để lịch sử vẫn hiện đúng tên phòng.
 */
function api_deleteRooms(token, ids) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Hệ thống đang xử lý một thao tác khác. Vui lòng thử lại sau vài giây.');
  try {
    var c = ctx_(token);
    requireAdmin_(c);
    var db = c.db;
    var want = {}, used = {};
    [].concat(ids || []).forEach(function (id) { want[String(id)] = true; });
    db.meetings.forEach(function (m) { used[m.room] = true; });
    var deleted = [], paused = [];
    db.rooms = db.rooms.filter(function (r) {
      if (!want[r.id]) return true;
      if (!used[r.id]) { deleted.push(r.id); return false; }
      if (r.active) { r.active = false; paused.push(r.id); }
      return true;
    });
    if (!db.rooms.some(function (r) { return r.active; })) throw new Error('Phải còn ít nhất một phòng đang sử dụng.');
    if (deleted.length || paused.length) {
      saveDatabase_(db);
      addLog_(c.email, 'room_delete', '', 'Xoá ' + deleted.length + ' phòng' +
        (deleted.length ? ' (' + deleted.slice(0, 4).join(', ') + (deleted.length > 4 ? '…' : '') + ')' : '') +
        (paused.length ? ', tạm ngưng ' + paused.length + ' phòng đã có lịch họp' : ''));
    }
    return { ok: true, deleted: deleted.length, paused: paused, data: appPayload_(db, c.user) };
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
   6. (tiếp) LINK CHÍNH ĐANG CHẠY BẢN NÀO
   ---------------------------------------------------------------------
   Đăng nhập Google xong luôn quay về link chính (WEBAPP_URL, đuôi /exec).
   Link này chỉ chạy phiên bản đã gắn trong "Quản lý triển khai", còn link thử
   (đuôi /dev) luôn chạy code mới nhất. Nếu quên cập nhật triển khai thì mở /dev
   thấy bản mới, đăng nhập lại lại rơi về bản cũ.
   Máy chủ hỏi thẳng link chính (?lhn_probe=1): từ bản 3.7 trở đi link trả về
   "LHN-VERSION:x.y"; bản cũ hơn trả về trang HTML bình thường.
   ===================================================================== */
function deployIdOf_(url) {
  var m = /\/s\/([\w-]+)\/exec/.exec(String(url || ''));
  return m ? m[1] : '';
}

/** Trả về { state: 'ok' | 'old' | 'unknown', version, current, url, deployId }. Đệm 10 phút. */
function probeExec_(force) {
  var url = AUTH.webAppUrl();
  var out = { state: 'unknown', version: '', current: APP_VERSION, url: url, deployId: deployIdOf_(url) };
  if (!url) return out;
  var cache = CacheService.getScriptCache();
  if (!force) {
    var hit = cache.get('lhn_exec_probe');
    if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  }
  try {
    var res = UrlFetchApp.fetch(url + '?lhn_probe=1', { muteHttpExceptions: true, followRedirects: true });
    var code = res.getResponseCode(), text = String(res.getContentText() || '');
    var m = /LHN-VERSION:([\w.\-]+)/.exec(text);
    if (m) {
      out.version = m[1];
      out.state = m[1] === APP_VERSION ? 'ok' : 'old';
    } else if (code === 200 && !/ServiceLogin|accounts\.google\.com\/(v3\/)?signin|signin\/identifier/i.test(text)) {
      out.state = 'old';   // link vẫn chạy nhưng không biết câu hỏi này: bản trước 3.7
    }
  } catch (err) {}
  try { cache.put('lhn_exec_probe', JSON.stringify(out), 600); } catch (e) {}
  return out;
}

/** Quản trị viên: link chính có đang chạy đúng phiên bản của code hiện tại không. */
function api_checkDeploy(token, force) {
  var c = ctx_(token);
  requireAdmin_(c);
  return probeExec_(!!force);
}

/* =====================================================================
   6A. PHÒNG HCMUTE NẠP SẴN (từ bản 3.6)
   ---------------------------------------------------------------------
   Theo "Bản đồ hiện trạng" cơ sở 1 (1 Võ Văn Ngân), cơ sở 2 (Lê Văn Việt)
   và bảng phân bố sân GDTC. Sơ đồ chỉ ghi tên khu, không ghi số phòng hay
   sức chứa, nên:
   - places: địa điểm có tên rõ trên sơ đồ;
   - blocks: phòng học MẪU theo từng khu (cột sample = TRUE, sức chứa 0 =
     chưa rõ) để đặt thử được ngay. Có danh sách phòng thật thì vào
     Quản trị > Phòng họp > "Xoá phòng mẫu", rồi "Thêm hàng loạt > Dán danh sách".
   Tự nạp đúng một lần (Script Property HCMUTE_SEED = 1). Đặt HCMUTE_SEED = off
   để không bao giờ tự nạp; chạy napPhongHCMUTE() để nạp lại phần còn thiếu.
   ===================================================================== */
var HCMUTE_SEED = {
  places: [
    { id: 'CS1-HOITRUONG', name: 'Hội trường lớn', building: 'CS1 · Hội trường' },
    { id: 'CS1-MAIVOM-A', name: 'Nhà mái vòm khu A', building: 'CS1 · Thể thao', equipment: 'Bóng rổ, bóng chuyền, cầu lông' },
    { id: 'CS1-NHATAP-E', name: 'Nhà tập khu E', building: 'CS1 · Thể thao', equipment: 'Bóng chuyền, cầu lông' },
    { id: 'CS1-QUANVOT-E', name: 'Sân quần vợt khu E', building: 'CS1 · Thể thao', equipment: 'Quần vợt' },
    { id: 'CS1-SANBONG', name: 'Sân bóng đá', building: 'CS1 · Thể thao', equipment: 'Bóng đá, điền kinh' },
    { id: 'CS2-HOITRUONG', name: 'Hội trường CS2', building: 'CS2 · Hội trường' },
    { id: 'CS2-SANBONG', name: 'Sân bóng CS2', building: 'CS2 · Thể thao' },
    { id: 'CS2-CAULONG', name: 'Sân cầu lông CS2', building: 'CS2 · Thể thao' }
  ],
  // [khu, tiền tố mã phòng, từ tầng, đến tầng, số phòng mỗi tầng] -> mã dạng A4-101
  blocks: [
    ['CS1 · Khu A2', 'A2', 1, 3, 4], ['CS1 · Khu A3', 'A3', 1, 3, 4],
    ['CS1 · Khu A4', 'A4', 1, 3, 4], ['CS1 · Khu A5', 'A5', 1, 3, 4],
    ['CS1 · Khối B', 'B', 1, 3, 3], ['CS1 · Khối C', 'C', 1, 3, 3], ['CS1 · Khối D', 'D', 1, 3, 3],
    ['CS1 · Khối E4', 'E4', 1, 1, 4], ['CS1 · Khối F1', 'F1', 1, 2, 3], ['CS1 · Khối G', 'G', 1, 2, 3],
    ['CS2 · Khối V', 'V', 1, 9, 3], ['CS2 · Khối phòng học', 'PH', 1, 1, 4]
  ],
  // Phòng mẫu do setup() bản cũ tạo: tạm ngưng khi đã có phòng trường (chỉ khi tên chưa bị sửa)
  demo: { P1: 'Phòng họp 1', P2: 'Phòng họp 2', HT: 'Hội trường A5', CLB: 'Phòng CLB' }
};

function hcmuteRooms_() {
  var out = HCMUTE_SEED.places.map(function (p) {
    return { id: p.id, name: p.name, capacity: 0, building: p.building, equipment: p.equipment || '', online: false, active: true, sample: false };
  });
  HCMUTE_SEED.blocks.forEach(function (b) {
    for (var f = b[2]; f <= b[3]; f++) {
      for (var i = 1; i <= b[4]; i++) {
        var code = b[1] + '-' + f + LHN.pad(i);
        out.push({ id: code, name: code, capacity: 0, building: b[0], equipment: '', online: false, active: true, sample: true });
      }
    }
  });
  return out;
}

/**
 * Thêm phòng HCMUTE còn thiếu vào db (chưa lưu). Địa điểm đã có mã thì bỏ qua;
 * khu đã có phòng nào (do quản trị viên tự thêm) thì không thêm phòng mẫu cho khu đó.
 */
function applyHcmuteSeed_(db) {
  var byId = {}, khuHas = {};
  db.rooms.forEach(function (r) { byId[r.id] = r; khuHas[r.building] = true; });
  var added = 0, paused = [];
  hcmuteRooms_().forEach(function (r) {
    if (byId[r.id] || (r.sample && khuHas[r.building])) return;
    db.rooms.push(r); byId[r.id] = r; added++;
  });
  Object.keys(HCMUTE_SEED.demo).forEach(function (id) {
    var r = byId[id];
    if (r && r.active && !r.online && r.name === HCMUTE_SEED.demo[id]) { r.active = false; paused.push(id); }
  });
  return { added: added, paused: paused };
}

/** Gọi từ api_bootstrap: bản đã cài từ trước được nạp phòng HCMUTE đúng một lần. */
function seedHcmute_() {
  var st = prop_('HCMUTE_SEED');
  if (st === '1' || st === 'off') return null;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return null;   // lần mở app sau sẽ thử lại
  try {
    st = prop_('HCMUTE_SEED');
    if (st === '1' || st === 'off') return null;
    var db = getDatabase_();
    var res = applyHcmuteSeed_(db);
    if (res.added || res.paused.length) {
      saveDatabase_(db);
      addLog_('system', 'room_seed', '', 'Nạp ' + res.added + ' phòng HCMUTE' +
        (res.paused.length ? ', tạm ngưng phòng mẫu cũ ' + res.paused.join(', ') : ''));
    }
    SCRIPT_PROPS.setProperty('HCMUTE_SEED', '1');
    return res;
  } finally {
    lock.releaseLock();
  }
}

function api_saveUser(token, x) {
  var c = ctx_(token);
  requireAdmin_(c);
  var db = c.db;

  var targetEmail = String(x.email || '').toLowerCase().trim();
  if (!targetEmail) throw new Error('Thiếu email.');
  var u = null;
  db.users.forEach(function (y) { if (y.email === targetEmail) u = y; });
  if (x.isNew && u) throw new Error('Email đã có trong danh sách.');

  // Không cho phép tự hạ quyền admin cuối cùng
  var next = {
    name: String(x.name || '').trim() || targetEmail.split('@')[0],
    unit: String(x.unit || '').trim(),
    role: x.role === 'admin' ? 'admin' : 'member',
    status: ['active', 'pending', 'disabled'].indexOf(x.status) >= 0 ? x.status : 'active'
  };
  if (u && u.role === 'admin' && next.role !== 'admin') {
    var admins = db.users.filter(function (y) { return y.role === 'admin' && y.status === 'active'; });
    if (admins.length <= 1) throw new Error('Phải còn ít nhất một quản trị viên đang hoạt động.');
  }

  if (!u) {
    u = { email: targetEmail, createdAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss') };
    db.users.push(u);
  }
  Object.assign(u, next);

  saveDatabase_(db);
  addLog_(c.email, 'user_save', '', targetEmail + ' · ' + next.status);
  return { ok: true, data: api_bootstrap(token) };
}

function api_saveSettings(token, x) {
  var c = ctx_(token);
  requireAdmin_(c);
  var db = c.db;

  Object.assign(db.settings, {
    APP_NAME: String(x.APP_NAME || '').trim() || 'Lịch Họp Nhóm',
    ORG_NAME: String(x.ORG_NAME || '').trim(),
    SCHOOL_NAME: String(x.SCHOOL_NAME || '').trim() || DEFAULT_SCHOOL,
    DAY_START: Number(x.DAY_START || 7),
    DAY_END: Number(x.DAY_END || 18),
    SEND_EMAIL: Boolean(x.SEND_EMAIL),
    CREATE_CALENDAR_EVENT: Boolean(x.CREATE_CALENDAR_EVENT),
    ALLOW_SELF_REGISTER: Boolean(x.ALLOW_SELF_REGISTER),
    MAX_REPEAT_WEEKS: Number(x.MAX_REPEAT_WEEKS || 12)
  });

  saveDatabase_(db);
  addLog_(c.email, 'settings', '', 'Cập nhật cài đặt');
  return { ok: true, data: api_bootstrap(token) };
}

function api_getLogs(token, n) {
  var c = ctx_(token);
  requireAdmin_(c);
  return getSheetData_('Logs').reverse().slice(0, n || 100);
}

/* =====================================================================
   6B. ẢNH ĐẠI DIỆN & TRẠNG THÁI ONLINE
   ---------------------------------------------------------------------
   Apps Script không có WebSocket, nên trạng thái online làm theo kiểu
   "heartbeat": mỗi ~45 giây trình duyệt gọi api_heartbeat để báo còn mở
   trang. Server ghi mốc thời gian vào CacheService; ai quá 90 giây không
   báo thì coi như đã offline. Danh bạ người dùng cũng được đệm 5 phút để
   heartbeat không phải đọc Google Sheet liên tục.
   ===================================================================== */
var PRESENCE_KEY = 'lhn_presence_v1';
var PRESENCE_TTL_SEC = 90;
var DIR_KEY = 'lhn_dir_v1';

/** Danh bạ người dùng, đệm trong cache để heartbeat chạy nhẹ. */
function directory_() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get(DIR_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  var db = getDatabase_();
  var dir = {};
  db.users.forEach(function (u) {
    dir[u.email] = {
      email: u.email, name: u.name, unit: u.unit, role: u.role,
      status: u.status, avatar: u.avatar,
      showPresence: u.showPresence !== false
    };
  });
  try { cache.put(DIR_KEY, JSON.stringify(dir), 300); } catch (e) {}
  return dir;
}

function dirInvalidate_() {
  try { CacheService.getScriptCache().remove(DIR_KEY); } catch (e) {}
}

function presenceRead_() {
  var raw = '';
  try { raw = CacheService.getScriptCache().get(PRESENCE_KEY) || ''; } catch (e) {}
  var map = {};
  if (raw) { try { map = JSON.parse(raw) || {}; } catch (e) { map = {}; } }
  var now = Date.now(), live = {};
  Object.keys(map).forEach(function (k) {
    if (now - Number(map[k]) < PRESENCE_TTL_SEC * 1000) live[k] = map[k];
  });
  return live;
}

/** Ghi nhận "còn đây" (on=true) hoặc gỡ khỏi danh sách (on=false). */
function presenceTouch_(email, on) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try { locked = lock.tryLock(3000); } catch (e) {}
  try {
    var map = presenceRead_();
    if (on) map[email] = Date.now(); else delete map[email];
    try { CacheService.getScriptCache().put(PRESENCE_KEY, JSON.stringify(map), 21600); } catch (e) {}
    return map;
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (e) {} }
  }
}

/**
 * Gọi định kỳ từ trình duyệt. Trả về danh sách người đang mở trang.
 * Cố tình không ném lỗi: heartbeat hỏng thì chỉ mất danh sách online,
 * không được phép làm hỏng trải nghiệm chính.
 */
function api_heartbeat(token) {
  try {
    var s = AUTH.readToken(token);
    if (!s) return { ok: false, online: [] };

    var dir = directory_();
    var me = dir[s.email];
    if (!me || me.status !== 'active') return { ok: false, online: [] };

    var map = presenceTouch_(s.email, me.showPresence !== false);

    var out = [];
    Object.keys(map).forEach(function (email) {
      var u = dir[email];
      if (!u || u.status !== 'active') return;
      out.push({
        email: u.email,
        name: u.name || u.email.split('@')[0],
        unit: u.unit || '',
        photo: avatarUrl_(u),
        isMe: email === s.email
      });
    });
    out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'vi'); });

    return { ok: true, online: out, visible: me.showPresence !== false };
  } catch (err) {
    return { ok: false, online: [], error: (err && err.message) ? err.message : String(err) };
  }
}

/** Bật/tắt hiển thị trạng thái hoạt động của chính mình. */
function api_setPresence(token, on) {
  var c = ctx_(token);
  c.user.showPresence = !!on;
  saveDatabase_(c.db);
  presenceTouch_(c.email, !!on);
  addLog_(c.email, 'presence', '', on ? 'hiện' : 'ẩn');
  return { ok: true, visible: !!on };
}

/** Ảnh đại diện đang dùng: chỉ ảnh người dùng tự tải lên (từ bản 3.6 bỏ ảnh Google). */
function avatarUrl_(u) {
  var a = String((u && u.avatar) || '');
  return /^https:\/\//.test(a) ? a : '';
}

/** Thư mục Drive chứa ảnh đại diện, tạo một lần rồi dùng lại. */
function avatarFolder_() {
  var id = prop_('AVATAR_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {}
  }
  var folder = DriveApp.createFolder('Lich Hop Nhom — Anh dai dien');
  SCRIPT_PROPS.setProperty('AVATAR_FOLDER_ID', folder.getId());
  return folder;
}

/**
 * Lưu ảnh đại diện tự chọn. fileData = null (hoặc 'none') để bỏ ảnh, chỉ hiện chữ viết tắt.
 * fileData: { name, mimeType, data (base64 không kèm tiền tố data:) }
 */
function api_saveAvatar(token, fileData) {
  var c = ctx_(token);

  var oldUrl = String(c.user.avatar || '');

  if (!fileData || fileData === 'none') {
    c.user.avatar = '';
    saveDatabase_(c.db);
    trashAvatar_(oldUrl);
    addLog_(c.email, 'avatar', '', 'dùng chữ viết tắt');
    return { ok: true, url: '', data: api_bootstrap(token) };
  }

  var mime = String(fileData.mimeType || '');
  if (mime.indexOf('image/') !== 0) throw new Error('Chỉ nhận tệp ảnh (PNG, JPG, GIF, WebP).');

  var bytes = Utilities.base64Decode(String(fileData.data || ''));
  if (!bytes || !bytes.length) throw new Error('Không đọc được nội dung ảnh.');
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Ảnh tối đa 2 MB. Hãy chọn ảnh nhỏ hơn hoặc giảm kích thước trước.');

  var safe = c.email.replace(/[^\w]/g, '_');
  var blob = Utilities.newBlob(bytes, mime, 'avatar_' + safe + '_' + Date.now());
  var file = avatarFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  c.user.avatar = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w240';
  saveDatabase_(c.db);
  trashAvatar_(oldUrl);
  addLog_(c.email, 'avatar', '', 'đổi ảnh đại diện');

  return { ok: true, url: c.user.avatar, data: api_bootstrap(token) };
}

/** Dọn ảnh đại diện cũ trên Drive cho đỡ rác. Lỗi ở đây không quan trọng. */
function trashAvatar_(url) {
  try {
    var m = /[?&]id=([\w-]+)/.exec(String(url || ''));
    if (m) DriveApp.getFileById(m[1]).setTrashed(true);
  } catch (e) {}
}

/* =====================================================================
   7. CÀI ĐẶT — CHẠY TRONG TRÌNH SOẠN THẢO APPS SCRIPT
   ===================================================================== */

/**
 * BƯỚC 1 — Chạy hàm này một lần. Nó tạo Google Sheet, dữ liệu mẫu,
 * và in ra URL của web app để bạn dán vào Google Cloud Console.
 */
function setup() {
  var ss = getSpreadsheet_();
  var myEmail = String(Session.getEffectiveUser().getEmail() || '').toLowerCase().trim();
  if (myEmail) SCRIPT_PROPS.setProperty('ADMIN_EMAIL', myEmail);

  var onlineRoom = { id: 'ONL', name: 'Online', capacity: 100, building: 'Google Meet', equipment: 'Link Meet gửi kèm lời mời', online: true, active: true, sample: false };

  var defaultSettings = {
    APP_NAME: 'Lịch Họp Nhóm',
    ORG_NAME: 'CLB Khởi nghiệp HCMUTE',
    SCHOOL_NAME: DEFAULT_SCHOOL,
    DAY_START: 7, DAY_END: 18,
    SEND_EMAIL: true, CREATE_CALENDAR_EVENT: false,
    ALLOW_SELF_REGISTER: true, MAX_REPEAT_WEEKS: 12
  };

  var db = getDatabase_(ss);
  if (db.users.length === 0 && myEmail) {
    db.users = [{
      email: myEmail, name: myEmail.split('@')[0], unit: 'Ban Quản trị',
      role: 'admin', status: 'active',
      createdAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss')
    }];
  }
  var freshRooms = db.rooms.length === 0;
  if (freshRooms) {
    db.rooms = [onlineRoom];
    applyHcmuteSeed_(db);
  }
  db.meetings = db.meetings || [];
  db.docs = db.docs || [];
  db.attendance = db.attendance || [];
  db.settings = Object.assign({}, defaultSettings, db.settings || {});
  saveDatabase_(db, ss);
  if (freshRooms) SCRIPT_PROPS.setProperty('HCMUTE_SEED', '1');

  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}

  var out = [
    '================ SETUP HOÀN TẤT ================',
    'Google Sheet : ' + ss.getUrl(),
    'Quản trị viên: ' + myEmail,
    'URL web app  : ' + (url || '(chưa deploy — hãy Deploy > New deployment trước)'),
    '',
    'BƯỚC TIẾP THEO:',
    '1. Deploy > New deployment > Web app',
    '     Execute as       : Me (' + myEmail + ')',
    '     Who has access   : Anyone',
    '2. Copy URL kết thúc bằng /exec',
    '3. Vào Google Cloud Console tạo OAuth Client ID (loại Web application),',
    '   dán URL /exec đó vào mục "Authorized redirect URIs"',
    '4. Quay lại đây chạy: setOAuthCredentials("CLIENT_ID","CLIENT_SECRET","URL_/exec")',
    '================================================'
  ].join('\n');
  Logger.log(out);
  return out;
}

/**
 * BƯỚC 2 — Dán 3 giá trị lấy từ Google Cloud Console vào đây rồi chạy.
 * Ví dụ:
 *   setOAuthCredentials(
 *     '1234567890-abcxyz.apps.googleusercontent.com',
 *     'GOCSPX-xxxxxxxxxxxxxxxx',
 *     'https://script.google.com/macros/s/AKfycbxxxxxxxx/exec'
 *   );
 */
function setOAuthCredentials(clientId, clientSecret, webAppUrl) {
  clientId = String(clientId || '').trim();
  clientSecret = String(clientSecret || '').trim();
  webAppUrl = String(webAppUrl || '').trim();

  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
    throw new Error('CLIENT_ID phải kết thúc bằng .apps.googleusercontent.com');
  }
  if (!clientSecret) throw new Error('Thiếu CLIENT_SECRET.');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(webAppUrl)) {
    throw new Error('URL web app phải có dạng https://script.google.com/macros/s/.../exec (không phải /dev).');
  }

  SCRIPT_PROPS.setProperties({
    OAUTH_CLIENT_ID: clientId,
    OAUTH_CLIENT_SECRET: clientSecret,
    WEBAPP_URL: webAppUrl
  }, false);

  var out = 'Đã lưu cấu hình OAuth.\nRedirect URI phải khớp tuyệt đối: ' + webAppUrl +
    '\nBây giờ mở URL đó trên trình duyệt (kể cả cửa sổ ẩn danh) để thử đăng nhập.';
  Logger.log(out);
  return out;
}

/** Kiểm tra nhanh cấu hình hiện tại. Chạy khi nghi ngờ có gì đó sai. */
function kiemTraCauHinh() {
  var cid = prop_('OAUTH_CLIENT_ID');
  var pr = probeExec_(true);
  var out = [
    'SPREADSHEET_ID     : ' + (prop_('SPREADSHEET_ID') || '(chưa có — chạy setup())'),
    'OAUTH_CLIENT_ID    : ' + (cid || '(CHƯA CÓ)'),
    'OAUTH_CLIENT_SECRET: ' + (prop_('OAUTH_CLIENT_SECRET') ? '(đã lưu)' : '(CHƯA CÓ)'),
    'WEBAPP_URL         : ' + (prop_('WEBAPP_URL') || '(CHƯA CÓ)'),
    'ADMIN_EMAIL        : ' + (prop_('ADMIN_EMAIL') || '(chưa có)'),
    'SESSION_SECRET     : ' + (prop_('SESSION_SECRET') ? '(đã có)' : '(sẽ tự tạo khi đăng nhập lần đầu)'),
    'Phòng HCMUTE       : ' + ({ '1': 'đã nạp', off: 'đã tắt tự nạp' }[prop_('HCMUTE_SEED')] || 'chưa nạp (tự nạp khi mở app lần tới)'),
    '',
    'Code trong trình soạn thảo: bản ' + APP_VERSION,
    'Link chính đang chạy      : ' + (pr.state === 'ok' ? 'bản ' + pr.version + '  ✓ khớp, không cần làm gì'
      : pr.state === 'old' ? (pr.version ? 'bản ' + pr.version : 'BẢN CŨ (trước 3.7)') + '  ✗ CẦN CẬP NHẬT TRIỂN KHAI (xem 4 bước bên dưới)'
      : 'không kiểm tra được (kiểm tra WEBAPP_URL và quyền truy cập "Anyone")'),
    'Mã triển khai link chính  : ' + (pr.deployId || '(chưa có)'),
    '',
    'Sẵn sàng đăng nhập: ' + (AUTH.isConfigured() ? 'CÓ' : 'CHƯA'),
    'URL đăng nhập thử : ' + (AUTH.loginUrl() || '(chưa cấu hình)'),
    '',
    'CẬP NHẬT LINK CHÍNH (làm mỗi lần dán code mới):',
    '1. Triển khai (Deploy) > Quản lý triển khai (Manage deployments).',
    '2. Bên trái chọn triển khai có Mã triển khai (Deployment ID) = ' + (pr.deployId || '...') + '.',
    '3. Bấm biểu tượng bút chì (Edit) > Phiên bản (Version): Phiên bản mới (New version) > Triển khai (Deploy).',
    '4. Chạy lại hàm này: dòng "Link chính đang chạy" phải có dấu ✓.',
    '- Không bấm "Triển khai mới" (New deployment): sẽ ra link khác, đăng nhập vẫn về link cũ.',
    '- Link thử (Test deployments, đuôi /dev) luôn chạy code mới nhất nhưng chỉ bạn mở được;',
    '  đăng nhập xong Google đưa về link chính, nên nếu link chính chưa cập nhật bạn sẽ thấy bản cũ.',
    '- Không thấy mã triển khai trên trong danh sách: link chính thuộc dự án Apps Script khác.',
    '  Dán code vào đúng dự án đó, hoặc chạy lại setOAuthCredentials với link /exec của dự án này.',
    '- Kiểm tra: mở app, bấm ảnh đại diện góc phải, dòng "Phiên bản" phải là ' + APP_VERSION + '.'
  ].join('\n');
  Logger.log(out);
  return out;
}

/** Xoá toàn bộ phiên đăng nhập của mọi người (dùng khi nghi ngờ lộ token). */
function dangXuatTatCa() {
  SCRIPT_PROPS.deleteProperty('SESSION_SECRET');
  Logger.log('Đã huỷ mọi phiên đăng nhập. Mọi người cần đăng nhập lại.');
  return 'OK';
}

/**
 * Nạp lại phòng HCMUTE theo sơ đồ. Chỉ thêm phần còn thiếu: địa điểm chưa có mã,
 * và phòng mẫu cho khu chưa có phòng nào. Không sửa, không xoá phòng đang có.
 */
function napPhongHCMUTE() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var db = getDatabase_();
    var res = applyHcmuteSeed_(db);
    if (res.added || res.paused.length) saveDatabase_(db);
    SCRIPT_PROPS.setProperty('HCMUTE_SEED', '1');
    var msg = 'Đã thêm ' + res.added + ' phòng HCMUTE' +
      (res.paused.length ? ', tạm ngưng phòng mẫu cũ ' + res.paused.join(', ') : '') + '.';
    addLog_('system', 'room_seed', '', msg);
    Logger.log(msg);
    return msg;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Điền 3 giá trị thật vào đây rồi chọn hàm này, bấm Run một lần duy nhất.
 * Giá trị được lưu vào Script Properties, nên chạy xong hãy xoá lại về rỗng.
 * KHÔNG commit client secret thật lên GitHub.
 * Để rỗng thì hàm báo lỗi và không ghi đè cấu hình đang có.
 */
function napCauHinh() {
  return setOAuthCredentials(
    '',   // CLIENT_ID  (…apps.googleusercontent.com)
    '',   // CLIENT_SECRET (GOCSPX-…)
    ''    // URL web app (https://script.google.com/macros/s/…/exec)
  );
}

/**
 * CHẠY MỘT LẦN — cấp quyền gọi mạng ra ngoài (script.external_request).
 * Bắt buộc phải chạy, vì luồng đăng nhập cần gọi sang oauth2.googleapis.com
 * để đổi mã, mà Google chỉ hỏi xin quyền này khi có hàm thực sự dùng tới nó.
 * Chạy xong nhớ Triển khai lại phiên bản mới thì web app mới nhận được quyền.
 */
function capQuyenMang() {
  var res = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/certs', { muteHttpExceptions: true });
  var msg = 'HTTP ' + res.getResponseCode() + ' — đã có quyền gọi mạng ra ngoài.\n' +
            'Bước tiếp theo: Triển khai > Quản lý triển khai > sửa > Phiên bản mới > Triển khai.';
  Logger.log(msg);
  return msg;
}
