/**
 * Chép src/shared.js vào giữa dấu mốc SL-SHARED trong Code.gs và Index.html.
 * Chạy: node qtda/scholarlink/tools/sync-shared.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BEGIN = '/* ==== SL-SHARED BEGIN', END = '/* ==== SL-SHARED END ==== */';
const shared = fs.readFileSync(path.join(ROOT, 'src', 'shared.js'), 'utf8').trim();

for (const f of ['Code.gs', 'Index.html']) {
  const file = path.join(ROOT, f);
  const s = fs.readFileSync(file, 'utf8');
  const a = s.indexOf(BEGIN), b = s.indexOf(END);
  if (a < 0 || b < a) { console.error('Thiếu dấu mốc trong ' + f); process.exitCode = 1; continue; }
  const next = s.slice(0, a) + shared + s.slice(b + END.length);
  if (next !== s) { fs.writeFileSync(file, next); console.log('Đã cập nhật ' + f); }
  else console.log(f + ' đã đồng bộ');
}
