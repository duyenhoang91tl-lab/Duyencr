#!/usr/bin/env node
// Tach gas_v13.js -> gas/NN_Ten.gs (de dan tung file vao Apps Script Editor cho nhe/do lag).
// gas_v13.js VAN LA NGUON CHINH. Sau MOI lan sua gas_v13.js, chay lai:  node tools/split-gas.js
// Tim ham nam o file nao:                                                 node tools/split-gas.js --where <ten>
// Kiem tra khong lech (khong ghi file):                                   node tools/split-gas.js --check
// Cat tai ranh gioi hàm/biến cấp cao nhất, tìm bằng "mốc" (đầu dòng) chứ không dùng số dòng -> bền khi file đổi.
// Comment liền ngay phía trên mốc (không cách dòng trống) được kéo theo sang file mới.
// Nối các file theo thứ tự tên PHẢI ra đúng 100% gas_v13.js (script tự kiểm tra, lệch thì báo lỗi).
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'gas_v13.js'), OUT = path.join(ROOT, 'gas');
// [tên file, mốc bắt đầu file]. File 01 bắt đầu từ dòng 1.
const PARTS = [
  ['01_Config_Utils', null],
  ['02_PriceCatalog_CTKM', 'var PRICE_LAST_COL_ = 13;'],
  ['03_Settings_CareRead', 'function getSetting_(key) {'],
  ['04_doGet', 'function doGet(e) {'],
  ['05_Orders_DTTong', 'function buildDashboard_() {'],
  ['06_CSKH_CareLeads_Don', "var CSKH_DUYEN_SHEET_KEY_ ="],
  ['07_SalesReportA', 'function getSalesReportOptions_() {'],
  ['08_SaleKPI_FailedOrders', 'var SALE_TIER_ORDER_ ='],
  ['09_SalesReportB_POS', 'var POS_GHEP_BASE_ENABLED_ ='],
  ['10_CSStats_KPI_ReportC', 'var CS_COMMISSION_THRESHOLD_ ='],
  ['11_ExportSheet_doPost', 'function exportSalesReportToSheet_('],
  ['12_SaveCare_Orders_Dedupe', 'function invalidateLookupCache_('],
  ['13_Teams_Pancake', 'function saveTeams_('],
  ['14_KpiReport_Users_Assign', 'function buildKpiReport_('],
  ['15_ProductSheets_Drive', 'var _PSHEET_STOPWORDS_ ='],
  ['16_BannedWords_AI', 'var BANNED_WORDS_SS_ID ='],
  ['17_Broadcast_FollowUp', 'var SH_BROADCAST ='],
  ['18_Tasks_Menh_MsgTpl', 'var SH_TASK ='],
  ['19_BannedList_MktChecklist', 'var REPORT_SALE_SS_ID ='],
  ['20_ExportLog_AutoAssign', 'var EXPORT_LOG_SS_ID =']
];
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split('\n');
const starts = PARTS.map(([name, anchor], i) => {
  if (anchor === null) return 0;
  const hits = lines.map((l, k) => l.startsWith(anchor) ? k : -1).filter(k => k >= 0);
  if (hits.length !== 1) throw new Error('Mốc "' + anchor + '" (' + name + ') khớp ' + hits.length + ' dòng, cần đúng 1');
  let k = hits[0];
  while (k > 0 && lines[k - 1].startsWith('//')) k--;   // kéo theo comment liền kề phía trên
  return k;
});
for (let i = 1; i < starts.length; i++) if (starts[i] <= starts[i - 1]) throw new Error('Thứ tự mốc sai ở ' + PARTS[i][0]);
const files = PARTS.map(([name], i) => [name + '.gs', lines.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : lines.length).join('\n') + (i + 1 < starts.length ? '\n' : '')]);
if (files.map(f => f[1]).join('') !== src) throw new Error('Nối các phần KHÔNG ra đúng gas_v13.js (lỗi script)');
files.forEach(([n, c]) => { try { new vm.Script(c, { filename: n }); } catch (e) { throw new Error('Cú pháp lỗi trong ' + n + ': ' + e.message); } });
// ---- INDEX.md (tu sinh): file nao chua ham/bien nao ----
const MAIN_FNS = ['doGet', 'doPost'];
function topNames(c) {
  const fn = [], vr = [];
  c.split('\n').forEach(l => { let m = l.match(/^function\s+([A-Za-z0-9_$]+)\s*\(/); if (m) fn.push(m[1]); else if ((m = l.match(/^var\s+([A-Za-z0-9_$]+)\s*=/))) vr.push(m[1]); });
  return { fn, vr };
}
const idx = files.map(([n, c]) => [n, topNames(c)]);
if (process.argv.includes('--where')) {
  const q = (process.argv[process.argv.indexOf('--where') + 1] || '').toLowerCase();
  if (!q) { console.error('Dung: node tools/split-gas.js --where <ten ham/bien (go mot phan cung duoc)>'); process.exit(1); }
  let n = 0;
  idx.forEach(([f, t]) => t.fn.concat(t.vr).filter(x => x.toLowerCase().includes(q)).forEach(x => { console.log('gas/' + f + '  <-  ' + x); n++; }));
  if (!n) console.log('Khong thay "' + q + '" — thu tu khoa ngan hon, hoac grep trong gas_v13.js (co the nam trong ham, khong phai ham cap cao nhat).');
  process.exit(0);
}
let indexMd = '# gas/ — bảng tra: sửa gì thì mở file nào\n\n' +
  '> **TỰ SINH bởi `node tools/split-gas.js` — KHÔNG sửa tay.** Nguồn chính là `gas_v13.js`; file trong `gas/` chỉ để dán vào Apps Script.\n\n' +
  'Tìm nhanh: `node tools/split-gas.js --where <tên hàm>`\n\n' +
  '## QUY TẮC KHI SỬA BACKEND GAS (cho mọi phiên Claude / người sửa)\n' +
  '1. **Chỉ sửa `gas_v13.js`** (nguồn chính). KHÔNG sửa tay file trong `gas/`.\n' +
  '2. Tìm chỗ cần sửa: `node tools/split-gas.js --where <tên hàm>` hoặc xem bảng bên dưới; hàm dùng chung thì grep toàn bộ nơi gọi trong `gas_v13.js` trước khi sửa.\n' +
  '3. Sửa xong chạy `node tools/split-gas.js` (sinh lại `gas/*.gs` + file này), rồi `node tools/split-gas.js --check` phải báo OK.\n' +
  '4. Chạy `git status --short gas/` (hoặc `git diff --stat gas/`): **các file `.gs` bị đổi chính là danh sách file người dùng phải dán lại** vào Apps Script Editor.\n' +
  '5. Trong câu trả lời, LUÔN nêu rõ: *\"Dán đè các file: <tên file 1>, <tên file 2>… rồi Deploy → Manage deployments → New version → Deploy\"*. Không cần dán các file không đổi.\n' +
  '6. Thêm hàm mới thì nó nằm đúng file theo vị trí trong `gas_v13.js`; nếu 1 file phình quá ~45KB hoặc thêm cả mảng chức năng mới, thêm mốc mới vào `PARTS` trong `tools/split-gas.js` (tạo file mới → nhắc người dùng tạo thêm file đó trong Editor).\n' +
  '7. Nếu file được sinh ra là file MỚI (chưa có trong Editor) hoặc bị đổi tên: nhắc người dùng tạo/đổi tên file tương ứng trong Editor.\n\n';
idx.forEach(([n, t]) => {
  indexMd += '## ' + n + '\n' + (t.fn.length ? '- Hàm: ' + t.fn.map(x => '`' + x + '`').join(', ') + '\n' : '') +
    (t.vr.length ? '- Hằng/biến: ' + t.vr.map(x => '`' + x + '`').join(', ') + '\n' : '') + '\n';
});
if (process.argv.includes('--check')) {
  let bad = [];
  files.forEach(([n, c]) => { const p = path.join(OUT, n); if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== c) bad.push(n); });
  if (!fs.existsSync(path.join(OUT, 'INDEX.md')) || fs.readFileSync(path.join(OUT, 'INDEX.md'), 'utf8') !== indexMd) bad.push('INDEX.md');
  const extra = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter(f => f.endsWith('.gs') && !files.some(x => x[0] === f)) : [];
  if (bad.length || extra.length) { console.error('LỆCH so với gas_v13.js: ' + bad.concat(extra).join(', ') + '\n=> chạy: node tools/split-gas.js'); process.exit(1); }
  console.log('OK: ' + files.length + ' file gas/*.gs khớp 100% gas_v13.js'); process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).filter(f => f.endsWith('.gs')).forEach(f => fs.unlinkSync(path.join(OUT, f)));
files.forEach(([n, c]) => fs.writeFileSync(path.join(OUT, n), c));
fs.writeFileSync(path.join(OUT, 'INDEX.md'), indexMd);
files.forEach(([n, c]) => console.log(n.padEnd(34), String(Math.round(c.length / 1024)).padStart(4) + 'KB', String(c.split('\n').length).padStart(5) + ' dòng'));
console.log('Đã tạo ' + files.length + ' file trong gas/ — nối lại khớp 100% gas_v13.js, mỗi file qua kiểm tra cú pháp.');
