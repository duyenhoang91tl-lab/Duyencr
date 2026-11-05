#!/usr/bin/env node
// Test bang CHIA BO SUNG cua CRM (Settings acctSplitExtra) cho Bao cao B — chay ham GAS THAT: node tools/test-acct-extra.js
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


// ── Bang CHIA BO SUNG cua CRM (Settings acctSplitExtra): dung _loadAcctSplit_ THAT; chi gia lap file KT (SpreadsheetApp) + Settings ──
const don = (ghi, sale, val) => ({ ngayTaoDon: '02/10/2026', trangThai: 'Hoàn thành', theSale: sale, soDienThoai: '0900000001', nguonDon: 'Fb Phạm Thu Hiền', giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K', cod: 0, marketer: '', ghiChu: ghi });
let KTVALS = [['Kênh bán', 'Sale bán', 'Giá trị cọc', 'Tổng giá trị đơn', 'Giá trị chênh', 'Mã bộ đếm', 'Xác nhận']], EXTRA = '';
ctx.CacheService = new Proxy(svc(), { get: (t, p) => p === 'getScriptCache' ? () => ({ get: () => null, put() {}, remove() {} }) : t[p] });
const _SSBASE = svc();
ctx.SpreadsheetApp = new Proxy(_SSBASE, { get: (t, p) => p === 'openById' ? (id) => (id === ctx.ACCT_SPLIT_SS_ID_ ? { getSheets: () => [{ getDataRange: () => ({ getValues: () => KTVALS }) }] } : _SSBASE.openById(id)) : t[p] });
ctx.__getSetting = k => (k === 'acctSplitExtra' ? EXTRA : null);
vm.runInContext('getSetting_ = function(k) { return __getSetting(k); }; _acctExtraMemo_ = null;', ctx);
const run = (dons, extra, kt) => { EXTRA = extra ? JSON.stringify(extra) : ''; KTVALS = [KTVALS[0]].concat(kt || []); ctx.__rows = []; ctx.__don = dons;
  vm.runInContext('_acctExtraMemo_ = null;', ctx);
  return J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx)); };
const g = (B, n) => Math.round((B.bySale.find(r => r.name === n) || {}).giaTri || 0);
// 1) 268T10: Pos 14.960.000 chia 10.780.000 (Ninh+Nga) + 4.180.000 (Nga) => tong = Pos, khong can xac nhan
let B = run([don('268T10/2026', 'ninhnga99, ninhLTK1984', 14960000)], [{ code: '268T10/2026', sales: ['ninhLTK1984', 'ninhnga99'], tong: 10780000 }, { code: '268T10/2026', sales: ['ninhnga99'], tong: 4180000 }]);
ok(g(B, 'ninhnga99') === 9570000 && g(B, 'ninhLTK1984') === 5390000 && B.totalGiaTri === 14960000, '268T10: ninhnga99 9.570.000 (5.390.000 + 4.180.000) / ninhLTK1984 5.390.000, tong 14.960.000 = Pos');
// 2) don quay chi ghi ma don Pos "M44707" (khong co ma bo dem): 690.000 -> 1.335.000 theo bang bo sung
B = run([don('M44707', 'ninhnga99', 690000)], [{ code: 'M44707', sales: ['ninhnga99'], tong: 1335000 }]);
ok(g(B, 'ninhnga99') === 1335000 && B.totalGiaTri === 1335000, 'M44707 khop theo ma don Pos: 690.000 -> 1.335.000 (tong khac Pos van dung vi dong bo sung = da xac nhan)');
// 3) don COD 1162T10: 3.300.000 -> 5.664.000
B = run([don('1162T10/2026\nthu cod', 'thuyha88', 3300000)], [{ code: '1162T10/2026', sales: ['thuyha88'], tong: 5664000 }]);
ok(g(B, 'thuyha88') === 5664000, '1162T10 thu COD: 3.300.000 -> 5.664.000');
// 4) bao hanh KT tinh 0 => bo khoi bao cao; bao hanh them the lanVH1995 (chia deu)
B = run([don('1331T10/2026 + BH445T10/2026/6740', 'minhanh99', 350000), don('1339T10/2026 + BH441T10/2026/5790', 'minhanh99', 3930000)],
  [{ code: '1331T10/2026', sales: ['minhanh99', 'lanVH1995'], tong: 0 }, { code: '1339T10/2026', sales: ['minhanh99', 'lanVH1995'], tong: 1755000 }]);
ok(g(B, 'minhanh99') === 877500 && g(B, 'lanVH1995') === 877500 && B.totalGiaTri === 1755000, 'BH: 1331T10 tong 0 => bo don; 1339T10 3.930.000 -> 1.755.000 chia 877.500 minhanh99 / 877.500 lanVH1995');
// 5) UU TIEN hon file KT: KT chua xac nhan 17T10 (chia deu), bang bo sung dat 14.058.000/3.350.000
const ktRows = [['Fb', 'ninhnga99, huyenmaii1990', 0, 6700000, 0, '17T10/2026', ''], ['Fb', 'ninhnga99', 0, 10708000, 0, '17T10/2026', '']];
B = run([don('17T10/2026', 'ninhnga99, huyenmaii1990', 17332000)], null, ktRows);
ok(g(B, 'ninhnga99') === 8666000 && g(B, 'huyenmaii1990') === 8666000, 'KHONG co bang bo sung: hanh vi cu giu nguyen (file KT chua x => chia deu)');
B = run([don('17T10/2026', 'ninhnga99, huyenmaii1990', 17332000)], [{ code: '17T10/2026', sales: ['ninhnga99', 'huyenmaii1990'], tong: 6700000 }, { code: '17T10/2026', sales: ['ninhnga99'], tong: 10708000 }], ktRows);
ok(g(B, 'ninhnga99') === 14058000 && g(B, 'huyenmaii1990') === 3350000 && B.totalGiaTri === 17408000, 'Co bang bo sung: 17T10 = KT 14.058.000 / 3.350.000 (thay dong file KT cung ma, khong can x)');
// 6) don khong co trong bang bo sung (BH386 theo Pos) + don thuong: KHONG doi
B = run([don('BH386T10/2026/6190', 'huyenmaii1990', 6150000), don('999T10/2026', 'anhtrinh1995', 1000000)], [{ code: 'M44707', sales: ['ninhnga99'], tong: 1335000 }]);
ok(g(B, 'huyenmaii1990') === 6150000 && g(B, 'anhtrinh1995') === 1000000 && B.totalGiaTri === 7150000, 'BH386T10/2026 (theo Pos) + don thuong khong co trong bang bo sung: giu nguyen');
// 7) JSON hong / sai dinh dang => bo qua, khong lam hong bao cao
B = run([don('999T10/2026', 'anhtrinh1995', 1000000)], null); EXTRA = '{khong phai json'; vm.runInContext('_acctExtraMemo_ = null;', ctx);
B = J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx));
ok(g(B, 'anhtrinh1995') === 1000000, 'JSON hong: bo qua bang bo sung, bao cao van chay');
// 8) tong 0 duoc chap nhan, tong am bi bo; ma khong co sale bi bo
vm.runInContext('_acctExtraMemo_ = null;', ctx); EXTRA = JSON.stringify([{ code: 'X1T10', sales: [], tong: 5 }, { code: '', sales: ['a'], tong: 5 }, { code: 'X2T10', sales: ['a'], tong: -3 }]);
ok(J(vm.runInContext('_loadAcctExtra_().length', ctx)) === 0, 'dong sai (khong sale / khong ma / tong am) bi bo qua');
console.log(fails ? '\nFAILED ' + fails : '\nALL ACCT-EXTRA TESTS PASSED'); process.exit(fails ? 1 : 0);
