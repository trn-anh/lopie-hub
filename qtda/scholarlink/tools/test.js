/**
 * Kiểm thử nhanh các quy tắc dùng chung (không cần Apps Script).
 * Chạy: node qtda/scholarlink/tools/test.js [file.docx ...]
 *  - Khối SL-SHARED trong Code.gs và Index.html phải trùng src/shared.js
 *  - Bộ tách CV đọc đúng file mẫu đã điền (tools/fixtures)
 *  - Quy tắc học vị, điều kiện vai trò, khử trùng công bố, chấm điểm ghép nối
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SHARED = fs.readFileSync(path.join(ROOT, 'src', 'shared.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(SHARED + '\nthis.SL = SL;', ctx);
const SL = ctx.SL;

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + (e && e.message)); }
}

/** Đọc một mục trong file zip (đủ cho .docx). */
function unzipEntry(buf, wanted) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Không phải file zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    if (name === wanted) {
      const ln = buf.readUInt16LE(local + 26), lx = buf.readUInt16LE(local + 28);
      const data = buf.slice(local + 30 + ln + lx, local + 30 + ln + lx + csize);
      return (method === 0 ? data : zlib.inflateRawSync(data)).toString('utf8');
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error('Không có ' + wanted);
}
function docOf(file) { return SL.docxToDoc(unzipEntry(fs.readFileSync(file), 'word/document.xml')); }

console.log('1. Khối dùng chung đồng bộ');
for (const f of ['Code.gs', 'Index.html']) {
  test(f + ' chứa đúng src/shared.js', () => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const a = s.indexOf('/* ==== SL-SHARED BEGIN'), b = s.indexOf('/* ==== SL-SHARED END ==== */');
    assert(a >= 0 && b > a, 'thiếu dấu mốc SL-SHARED');
    const block = s.slice(a, b + '/* ==== SL-SHARED END ==== */'.length);
    assert.strictEqual(block.trim(), SHARED.trim(), 'khối khác src/shared.js — chạy tools/sync-shared.js');
  });
}

console.log('2. Tách lý lịch khoa học mẫu đã điền');
const fixture = path.join(__dirname, 'fixtures', 'llkh-mau-da-dien.docx');
const existing = [{ id: 'P1', title: 'Tối ưu chuỗi cung ứng trong sản xuất', year: '2026', authors: 'Trần Minh Anh', status: 'verified' }];
const d = SL.parseLLKH(docOf(fixture), { ownerName: 'Trần Minh Anh', existingPubs: existing });
const F = k => d.fields[k] && d.fields[k].value;
test('nhận ra mẫu LLKH', () => assert(d.template));
test('họ tên, giới tính', () => { assert.strictEqual(F('fullName'), 'Trần Minh Anh'); assert.strictEqual(F('gender'), 'Nam'); });
test('ngày sinh → ISO', () => assert.strictEqual(F('dob'), '1988-08-15'));
test('nơi sinh, quê quán, dân tộc', () => { assert.strictEqual(F('birthPlace'), 'TP. Hồ Chí Minh'); assert.strictEqual(F('hometown'), 'Đồng Tháp'); assert.strictEqual(F('ethnicity'), 'Kinh'); });
test('chức vụ, đơn vị', () => { assert.strictEqual(F('position'), 'Phó Trưởng bộ môn'); assert(/Khoa Kinh tế/.test(F('unit'))); });
test('điện thoại CQ, DĐ; bỏ NR trống', () => { assert.strictEqual(F('phoneOffice'), '028 3896 8641'); assert.strictEqual(F('mobile'), '0909 123 456'); assert(!F('phoneHome')); });
test('email, CMND, ngày cấp', () => { assert.strictEqual(F('contactEmail'), 'anhtm@hcmute.edu.vn'); assert.strictEqual(F('idNumber'), '079088001234'); assert.strictEqual(F('idDate'), '2021-03-12'); });
test('đại học', () => { assert.strictEqual(F('ugSystem'), 'Chính quy'); assert.strictEqual(F('ugMajor'), 'Quản lý công nghiệp'); assert.strictEqual(F('ugYear'), '2010'); assert(/Sư phạm/.test(F('ugPlace'))); });
test('bằng 2 trống không bị gán nhầm', () => { assert(!F('ug2Major')); assert(!F('ug2Year')); });
test('thạc sĩ, tiến sĩ đúng nơi đào tạo', () => {
  assert.strictEqual(F('msMajor'), 'Quản trị kinh doanh'); assert.strictEqual(F('msYear'), '2014'); assert(/Kinh tế/.test(F('msPlace')));
  assert.strictEqual(F('phdYear'), '2021'); assert(/Bách khoa/.test(F('phdPlace')));
});
test('tên luận án', () => assert(/^Tối ưu hóa chuỗi cung ứng/.test(F('thesis'))));
test('học vị → sự kiện chờ xác minh', () => {
  const c = d.credentials.find(x => x.kind === 'degree');
  assert(c && c.value === 'Tiến sĩ' && c.date === '2021-01-01' && c.country === 'Việt Nam', JSON.stringify(c));
  assert(!d.credentials.find(x => x.kind === 'title'), 'chức danh trống không được tạo');
});
test('ngoại ngữ (2 dòng, bỏ dòng trống)', () => {
  assert.strictEqual(d.languages.map(l => l.name + '|' + l.level).join(';'), 'Tiếng Anh|IELTS 7.0;Tiếng Nhật|N3');
});
test('quá trình công tác', () => {
  assert.strictEqual(d.work.length, 2);
  assert.strictEqual([d.work[1].from, d.work[1].to, d.work[1].role].join('|'), '2014|nay|Giảng viên');
});
test('đề tài', () => {
  assert.strictEqual(d.projects.length, 2);
  assert.strictEqual([d.projects[0].from, d.projects[0].to, d.projects[0].level, d.projects[0].role].join('|'), '2019|2021|Trường|Chủ nhiệm');
});
test('công bố: loại, DOI, tác giả, trùng', () => {
  assert.strictEqual(d.pubs.length, 3);
  assert.strictEqual(d.pubs[1].type, 'conference');
  assert.strictEqual(d.pubs[2].doi, '10.1234/jie.2025.0042');
  assert(/Nguyen/.test(d.pubs[2].authors) && d.pubs[2].year === '2025');
  assert(d.pubs[0].dup && d.pubs[0].dup.id === 'P1', 'phải phát hiện trùng với P1');
  assert.strictEqual(d.summary.dups, 1);
});

for (const extra of process.argv.slice(2)) {
  console.log('   + ' + extra);
  const x = SL.parseLLKH(docOf(extra), {});
  console.log(JSON.stringify({ template: x.template, fields: x.fields, summary: x.summary, work: x.work.length, pubs: x.pubs.length }, null, 1));
}

console.log('3. Học vị, điều kiện vai trò');
const creds = [
  { kind: 'degree', value: 'Thạc sĩ', date: '2014-06-10', status: 'verified' },
  { kind: 'degree', value: 'Tiến sĩ', date: '2021-11-20', status: 'pending' },
  { kind: 'degree', value: 'Cử nhân', date: '2022-01-01', status: 'verified' }
];
test('cao nhất theo thứ bậc, chỉ tính đã xác minh', () => assert.strictEqual(SL.highest(creds, 'degree').value, 'Thạc sĩ'));
test('duyệt Tiến sĩ → cao nhất đổi', () => { creds[1].status = 'verified'; assert.strictEqual(SL.highest(creds, 'degree').value, 'Tiến sĩ'); });
test('đại học từ Thạc sĩ, cao học từ Tiến sĩ', () => {
  assert(SL.eligible('Thạc sĩ', 'dai_hoc').ok);
  assert(!SL.eligible('Thạc sĩ', 'cao_hoc').ok);
  assert(SL.eligible('Tiến sĩ', 'cao_hoc').ok);
  assert(!SL.eligible('', 'dai_hoc').ok);
});
test('chuẩn hóa học vị tự do', () => {
  assert.strictEqual(SL.normDegree('TS.'), 'Tiến sĩ'); assert.strictEqual(SL.normDegree('ThS'), 'Thạc sĩ');
  assert.strictEqual(SL.normDegree('Tiến sỹ khoa học'), 'Tiến sĩ khoa học'); assert.strictEqual(SL.normDegree('Ph.D'), 'Tiến sĩ');
});

console.log('4. Công bố, ngày, trích dẫn');
test('cùng DOI là trùng dù khác tiêu đề', () => assert(SL.sameWork({ doi: 'https://doi.org/10.1/AB', title: 'x' }, { doi: '10.1/ab', title: 'y' })));
test('không DOI: tiêu đề + năm', () => {
  assert(SL.sameWork({ title: 'Tối ưu chuỗi cung ứng!', year: '2026' }, { title: 'tối ưu chuỗi cung ứng', year: '2026' }));
  assert(!SL.sameWork({ title: 'A study', year: '2025' }, { title: 'A study', year: '2026' }));
});
test('ngày dd/mm/yyyy, ngày sai', () => { assert.strictEqual(SL.parseDate('05/09/2026').iso, '2026-09-05'); assert(!SL.parseDate('31/02/2026').ok); });
test('trích dẫn APA', () => {
  const r = SL.parseRef('Tran, M. A., & Le, T. H. (2024). Lean in SMEs. Journal of Ops, 3(1). doi:10.5555/xyz.1');
  assert.strictEqual(r.year, '2024'); assert.strictEqual(r.title, 'Lean in SMEs'); assert.strictEqual(r.doi, '10.5555/xyz.1'); assert(/Journal of Ops/.test(r.venue));
});
test('khoảng thời gian', () => { assert.strictEqual(JSON.stringify(SL.splitPeriod('2014 – nay')), '{"from":"2014","to":"nay"}'); assert.strictEqual(JSON.stringify(SL.splitPeriod('2019/2021')), '{"from":"2019","to":"2021"}'); });

console.log('5. Ghép nối');
const expert = {
  profile: { field: 'Quản lý công nghiệp', keywords: 'chuỗi cung ứng; tối ưu hóa' },
  needs: { jointResearch: 'true', availability: 'ready', until: '2027-03-31', allowSuggest: 'true', researchDirection: 'Tối ưu vận hành; sản xuất bền vững' },
  degree: 'Tiến sĩ', pubs: [{ title: 'Tối ưu chuỗi cung ứng trong sản xuất', status: 'verified' }]
};
test('đủ điều kiện, điểm cao khi trùng chủ đề', () => {
  const m = SL.matchScore(expert, { needType: 'joint', tags: ['Chuỗi cung ứng', 'Tối ưu hóa'], goal: 'Tối ưu vận hành chuỗi cung ứng cho doanh nghiệp' }, '2026-10-11');
  assert(m.eligible && m.band === 'high', JSON.stringify(m));
});
test('không bật nhu cầu → không đủ điều kiện', () => {
  const m = SL.matchScore(expert, { needType: 'consult', tags: [], goal: '' }, '2026-10-11');
  assert(!m.eligible);
});
test('hết hạn nhận đề xuất', () => {
  const m = SL.matchScore(expert, { needType: 'joint', tags: [], goal: '' }, '2027-04-01');
  assert(!m.eligible && /hết/.test(m.blockers.join(' ')));
});

console.log('\n' + pass + ' đạt, ' + fail + ' lỗi');
process.exit(fail ? 1 : 0);
