#!/usr/bin/env node
// Test 17T10 (KT chia tay 14.058.000/3.350.000): don chia KT lech gia Pos can dau Xac nhan.
// (ghi chu cu) Test BAM O BAO CAO A/B -> XEM DON CHI TIET (js/59-report-drill.js + phan gop trong gas_v13.js). Chay ham GAS THAT voi du lieu gia roi dua qua cua so chi tiet (jsdom).
// Chay: NODE_PATH=<noi co jsdom> node tools/test-report-drill.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
// ── GAS ──
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(R('gas_v13.js'), ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __rows = [], __don = [];
  readDTTong_ = function() { return __rows; }; readDonChiTiet_ = function() { return __don; }; _mergeTachDon_ = function(r) { return r; };
  getSetting_ = function() { return null; };
  readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; }; _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: {}, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [], byPage: [] }; }; _pancakeKnownSaleNameSet_ = function() { return {}; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  readTeams_ = function() { return [{ id: 't1', name: 'Team Online', leader: '', members: ['anhtrinh1995', 'yenNTH2004'] }, { id: 't2', name: 'Phòng Kế toán', leader: '', members: ['menbui2002', 'phongketoan'] }]; };
  readMktTeams_ = function() { return [{ id: 'm1', name: 'MKT Hoa', pages: ['K1'] }]; }; readUsers_ = function() { return []; };
  _mktKenhWeights_ = function() { return { K1: [{ id: 'm1', name: 'MKT Hoa', w: 0.5 }, { id: 'm2', name: 'MKT Lan', w: 0.5 }] }; };
  readKPITargets_ = function() { return {}; }; readSaleDirectory_ = function() { return { list: [] }; };
`, ctx);


// Test: don nguon "Bao hanh" CO the sale -> cot S "Tien tra truoc" TRU khoi doanh thu sale (KT yeu cau 2026-11-03).
const don = (ghi, sale, val, nguon, ttt) => ({ ngayTaoDon: '02/10/2026', trangThai: 'Hoàn thành', theSale: sale, soDienThoai: '09000000' + String(Math.floor(Math.random() * 90) + 10), nguonDon: nguon, giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K', cod: 0, marketer: '', ghiChu: ghi, tienTraTruoc: ttt });
ctx.__acct = { rows: [], byCode: {}, byCodeNoYear: {}, err: '' };
vm.runInContext('_loadAcctSplit_ = function() { return __acct; };', ctx);
const run = d => { ctx.__don = d; return J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx)); };
const g = (B, n) => Math.round((B.bySale.find(r => r.name === n) || {}).giaTri || 0);
// 1) BH 3.930.000, khach da ck 2.175.000, the minhanh99 -> doanh thu con 1.755.000
let B = run([don('1339T10/2026 + BH441T10/2026/5', 'minhanh99', 3930000, 'Bảo hành', 2175000)]);
ok(g(B, 'minhanh99') === 1755000 && B.totalGiaTri === 1755000 && B.totalOrders === 1, 'BH co the sale: 3.930.000 − tien tra truoc 2.175.000 = 1.755.000 (van 1 don)');
ok(B.bhPrepaid && B.bhPrepaid.count === 1 && B.bhPrepaid.total === 2175000, 'bhPrepaid bao: 1 don, tru 2.175.000');
// 2) 2 sale tren the: tru chia deu nhu doanh thu
B = run([don('BH1T10/2026', 'minhanh99, lanVH1995', 6000000, 'Bảo hành', 2000000)]);
ok(g(B, 'minhanh99') === 2000000 && g(B, 'lanVH1995') === 2000000, 'BH 2 sale: (6.000.000 − 2.000.000)/2 = 2.000.000 moi nguoi');
// 3) BH KHONG co the sale -> khong tru
B = run([don('BH2T10/2026', '', 1000000, 'Bảo hành', 400000)]);
ok(B.totalGiaTri === 1000000 && B.bhPrepaid.count === 0, 'BH khong gan the sale: khong tru');
// 4) nguon khac (Facebook) co tien tra truoc -> khong tru
B = run([don('2T10/2026', 'minhanh99', 5000000, 'Fb Phạm Thu Hiền', 1000000)]);
ok(g(B, 'minhanh99') === 5000000 && B.bhPrepaid.count === 0, 'nguon KHAC Bao hanh co tien tra truoc: khong tru');
// 5) BH tra truoc > gia tri don: phan du la tien ship -> khong tinh, doanh thu = 0 (khong am)
B = run([don('BH3T10/2026', 'minhanh99', 95000, 'Bảo hành', 135000)]);
ok(g(B, 'minhanh99') === 0 && B.bhPrepaid.count === 1 && B.bhPrepaid.total === 95000, 'BH 95.000, tra truoc 135.000: chi tru toi da 95.000 (40.000 du la tien ship) -> doanh thu 0, khong am');
B = run([don('BH7T10/2026', 'minhanh99, lanVH1995', 100000, 'Bảo hành', 300000)]);
ok(g(B, 'minhanh99') === 0 && g(B, 'lanVH1995') === 0 && B.totalGiaTri === 0, 'BH 2 sale tra truoc vuot gia tri: ca hai ve 0, khong am');
// 6) BH tien tra truoc = 0 / thieu cot S -> nhu cu
B = run([don('BH4T10/2026', 'minhanh99', 500000, 'Bảo hành', 0), Object.assign(don('BH5T10/2026', 'minhanh99', 300000, 'Bảo hành', 0), { tienTraTruoc: undefined })]);
ok(g(B, 'minhanh99') === 800000 && B.bhPrepaid.count === 0, 'tien tra truoc 0 / khong co cot S: giu nguyen 800.000');
// 7) Ten nguon go khac dau/hoa-thuong van nhan ra
B = run([don('BH6T10/2026', 'minhanh99', 1000000, 'BẢO HÀNH', 300000)]);
ok(g(B, 'minhanh99') === 700000, 'nguon "BẢO HÀNH" viet hoa van tru');
// 8) Cot S doc tu sheet: _donConvertRows_ lay r[18]
const row = new Array(19).fill(''); row[1] = '02/10/2026'; row[2] = 'minhanh99'; row[3] = 'K'; row[7] = 'Bảo hành'; row[11] = 3930000; row[18] = '2.175.000'; row[16] = 'BH1T10/2026';
const conv = J(vm.runInContext('_donConvertRows_', ctx)([row], 2, ''));
ok(conv.items[0].obj.tienTraTruoc === 2175000, '_donConvertRows_ doc cot S (index 18), chuoi "2.175.000" -> 2175000');
const row17 = row.slice(0, 17); ok(J(vm.runInContext('_donConvertRows_', ctx)([row17], 2, '')).items[0].obj.tienTraTruoc === 0, 'sheet chi co A:Q (khong cot S): tienTraTruoc = 0, khong loi');
// 9) tach don: cong tien tra truoc cac phan
const realMerge = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'); const mctx = Object.assign({}, ctx); vm.createContext(mctx); vm.runInContext(realMerge.slice(realMerge.indexOf('var TACH_DON_RE_SRC_'), realMerge.indexOf('// ── DON QUAY HAO NAM CO GAN THE SALE')) + '\nfunction _donHasExcludedStatus_(){return false;} function normPhone_(x){return String(x);} function parseVNDate_(x){return new Date(2026,9,2);} function _normTxt_(x){return String(x).toLowerCase();} function _isNumericTag_(x){return /^\\d+$/.test(x);}', mctx);
const m = J(vm.runInContext('_mergeTachDon_', mctx)([Object.assign(don('254T10/2026/1 TÁCH', 'minhanh99', 1000000, 'Bảo hành', 100000), { soDienThoai: '0911111111' }), Object.assign(don('254T10/2026/2', 'minhanh99', 2000000, 'Bảo hành', 200000), { soDienThoai: '0911111111' })]));
ok(m.length === 1 && m[0].giaTriSauGiam === 3000000 && m[0].tienTraTruoc === 300000, '_mergeTachDon_: gop 2 phan, tien tra truoc cong lai 300.000');
console.log(fails ? '\nFAILED ' + fails : '\nALL BH-PREPAID TESTS PASSED'); process.exit(fails ? 1 : 0);
