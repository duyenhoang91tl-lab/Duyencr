// Test datPhongBanTuFileNhanSu (2026-10-21): xem truoc khong ghi; ghi that GOP khong de; khong tao khoa trung; ten trung 2 bo phan bi bo qua.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(startMarker, endMarker) { const i = src.indexOf(startMarker), j = src.indexOf(endMarker, i); return src.slice(i, j); }
const dflt = grab('var DEPT_LIST_DEFAULT_', 'function readDeptList_');
const code = dflt + grab('var PHONGBAN_NHANSU_NEW_', 'function orgOverview_(p)');
const store = {}, logs = [];
const ctx = { _normTxt_: s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(),
  getSetting_: k => store[k] || '', setSetting_: (k, v) => { store[k] = v; },
  readDeptList_: () => JSON.parse(store.deptList || '[{"key":"sale","label":"Sale"},{"key":"hr","label":"HR"},{"key":"tuychinh","label":"Phòng tự tạo"}]'),
  Logger: { log: m => logs.push(m) }, CacheService: { getScriptCache: () => ({ remove() {} }) }, JSON, Object, Array, String };
vm.createContext(ctx); vm.runInContext(code, ctx);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
store.saleDepts = JSON.stringify({ 'TRỊNH PHƯƠNG ANH': 'marketing', 'Người ngoài file': 'tuychinh', 'lê trà my': 'cuahang' });
const before = store.saleDepts;
ctx.datPhongBanTuFileNhanSu();
ok(store.saleDepts === before && !store.deptList, 'xem truoc: KHONG ghi gi');
const plan = ctx.datPhongBanTuFileNhanSu(true);
const sd = JSON.parse(store.saleDepts), dl = JSON.parse(store.deptList);
ok(sd['Người ngoài file'] === 'tuychinh', 'giu nguoi dang co ngoai file');
ok(sd['TRỊNH PHƯƠNG ANH'] === 'sale' && !sd['Trịnh Phương Anh'], 'ten da co (khac hoa/thuong) -> doi phong, khong tao khoa trung');
ok(sd['lê trà my'] === 'cuahang' && !sd['Lê Trà My'], 'nguoi da dung phong -> giu nguyen');
ok(dl.some(g => g.key === 'tuychinh') && ['banlanhdao', 'cskh', 'khobaohanh', 'khoncc', 'khonhacungcap'].every(k => dl.some(g => g.key === k)), 'giu phong tu tao + them phong moi');
ok(!sd['Nguyễn Thu Huyền'] && plan.skipped.indexOf('Nguyễn Thu Huyền') >= 0, 'ten trung o KCS + Ke toan luong -> bo qua va bao');
ok(sd['Hoàng Thị Duyên'] === 'sale' && sd['Lại Thị Thảo'] === 'banlanhdao' && sd['Nguyễn Khánh Ly'] === 'ketoan', 'gan dung mot so nguoi mau');
const vals = Object.values(sd), keys = new Set(dl.map(g => g.key));
ok(vals.every(v => keys.has(v)), 'moi key phong duoc gan deu co trong deptList');
const again = ctx.datPhongBanTuFileNhanSu(true);
ok(again.added.length === 0 && again.changed.length === 0, 'chay lai lan 2 khong doi gi (idempotent)');
console.log('Tong so nguoi gan:', Object.keys(sd).length);
process.exit(fail ? 1 : 0);
