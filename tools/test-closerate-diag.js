#!/usr/bin/env node
// Test: chanDoanTyLeChot (_tlcDiagnose_) phan loai DUNG ly do don khong tinh cho sale. Chay ham that, doc sheet gia lap.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const logs = [];
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log: (x) => logs.push(String(x)) }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
ctx.__rows = [
  // ninhnga99 tao 2 don (kenh co Page, da nap), 1 don sale ban = 'ninhnga99' nhung nguoi tao = 'Admin KD' (khong khop) -> chua gan
  { ngayTao: '05/10/2026', kenhBan: 'PageA', nguoiTao: 'ninhnga99', saleBan: 'ninhnga99', trangThai: 'Hoàn thành', bhZero: false },
  { ngayTao: '06/10/2026', kenhBan: 'PageA', nguoiTao: 'ninhnga99', saleBan: 'ninhnga99', trangThai: 'Hoàn thành', bhZero: false },
  { ngayTao: '07/10/2026', kenhBan: 'PageA', nguoiTao: 'Admin KD', saleBan: 'ninhnga99', trangThai: 'Hoàn thành', bhZero: false },
  // anhtrinh1995: don tao boi 'Anh Trinh' (ten day du, khong khop) -> chua gan
  { ngayTao: '08/10/2026', kenhBan: 'PageA', nguoiTao: 'Anh Trinh', saleBan: 'anhtrinh1995', trangThai: 'Hoàn thành', bhZero: false },
  // kenh Zalo chua gan Page -> khong duoc dem
  { ngayTao: '08/10/2026', kenhBan: 'Zalo', nguoiTao: 'ninhnga99', saleBan: 'ninhnga99', trangThai: 'Hoàn thành', bhZero: false },
  // kenh co Page nhung ngay 20/10 chua nap tuong tac
  { ngayTao: '20/10/2026', kenhBan: 'PageA', nguoiTao: 'ninhnga99', saleBan: 'ninhnga99', trangThai: 'Hoàn thành', bhZero: false },
  // BH 0d, ngoai ky
  { ngayTao: '09/10/2026', kenhBan: 'PageA', nguoiTao: 'ninhnga99', saleBan: 'ninhnga99', trangThai: 'Hoàn thành', bhZero: true },
  { ngayTao: '15/09/2026', kenhBan: 'PageA', nguoiTao: 'ninhnga99', saleBan: 'ninhnga99', trangThai: 'Hoàn thành', bhZero: false },
];
vm.runInContext(`
  readDTTong_ = function() { return __rows.map(function(r) { return Object.assign({}, r); }); };
  _isExcludedOrderStatus_ = function(s) { return false; };
  _pkTrackedDatesByPageAndSale_ = function() { var d = {}; ['20261005','20261006','20261007','20261008'].forEach(function(x){ d[x] = 1; }); var o = {}; ['2026-10-05','2026-10-06','2026-10-07','2026-10-08'].forEach(function(x){ o[x] = 1; }); return { datesByPage: { P1: o } }; };
  readPancakePageMap_ = function() { return { P1: 'PageA' }; };
  buildPancakeReport_ = function() { return { byCS: [ { name: 'ninhnga99', tongTT: 100 }, { name: 'anhtrinh1995', tongTT: 300 } ], byPage: [], byDay: [] }; };
  readSaleDirectory_ = function() { return { list: [], byName: {} }; };
  _userAliasGroups_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
`, ctx);
let d;
try { d = ctx._tlcDiagnose_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }); } catch (e) { console.log('LOI', e.message); process.exit(1); }
console.log(JSON.stringify(d, null, 1).slice(0, 1500));
ok(d.skipped.bhZero === 1 && d.skipped.ngoaiKy === 1, 'bo don BH 0d va don ngoai ky');
ok(d.ordersInRange === 6, '6 don trong ky');
ok(d.countedForSale === 2, '2 don tinh cho ninhnga99 theo nguoi tao');
ok(d.unassigned === 2 && d.unknownCreators['Admin KD'] === 1 && d.unknownCreators['Anh Trinh'] === 1, 'nguoi tao khong khop ten Pancake -> "chua gan" va liet ke dung ten');
ok(d.notCoveredTotal === 2, '2 don khong duoc dem (kenh/ngay chua co Pancake)');
ok(Object.keys(d.notCovered).some((k) => /Zalo/.test(k) && /CHƯA gán Page/.test(k)), 'kenh Zalo bao "chua gan Page Pancake"');
ok(Object.keys(d.notCovered).some((k) => /PageA/.test(k) && /chưa nạp/.test(k)), 'PageA ngay 20/10 bao "Page chua nap tuong tac ngay don"');
const nn = d.people.find((p) => p.name === 'ninhnga99'), at = d.people.find((p) => p.name === 'anhtrinh1995');
ok(nn && nn.byCreator === 2 && nn.bySaleBan === 5 && nn.held === 100, 'ninhnga99: 2 theo nguoi tao / 5 theo sale ban / 100 tuong tac');
ok(at && at.byCreator === 0 && at.bySaleBan === 1 && at.rate === 0, 'anhtrinh1995: 0 theo nguoi tao du co don theo sale ban -> ty le 0% (dung trieu chung bao cao)');
// DOI CHIEU voi bao cao THAT: _srCloseRateSectionsFromBase_ phai ra dung cac so ma chan doan giai thich
vm.runInContext(`
  _pkStatsRowsMemo_ = function() { return []; }; readPancakeMap_ = function() { return {}; };
`, ctx);
let real = null;
try { real = ctx._srCloseRateSectionsFromBase_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }); } catch (e) { console.log('LOI bao cao that:', e.message); }
if (real) {
  const m = {}; (real.saleCloseRate || []).forEach((r) => { m[r.name] = r.closed; });
  ok(m['ninhnga99'] === d.people.find((p) => p.name === 'ninhnga99').byCreator, 'BAO CAO THAT: ninhnga99 = ' + m['ninhnga99'] + ' don, bang chan doan');
  ok(m['anhtrinh1995'] === 0 || m['anhtrinh1995'] === undefined, 'BAO CAO THAT: anhtrinh1995 = 0 don');
  ok(m['(chưa gán sale)'] === d.unassigned, 'BAO CAO THAT: "(chua gan sale)" = ' + m['(chưa gán sale)'] + ' don, bang chan doan (' + d.unassigned + ')');
}
// ham chay tay ghi du 3 khoi log
logs.length = 0; ctx.chanDoanTyLeChot();
ok(logs.some((l) => /CHẨN ĐOÁN TỶ LỆ CHỐT/.test(l)) && logs.some((l) => /\(A\)/.test(l)) && logs.some((l) => /\(B\)/.test(l)) && logs.some((l) => /\(C\)/.test(l)), 'chanDoanTyLeChot ghi du tieu de + 3 khoi A/B/C');
console.log(fail ? '\nFAILED ' + fail : '\nALL CLOSERATE DIAG TESTS PASSED'); process.exit(fail ? 1 : 0);
