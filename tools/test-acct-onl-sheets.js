#!/usr/bin/env node
// Test (Duyen 2026-11-06): don chia tay ke toan o cac tab "onl T10", "onl T11"... cua file THEO DOI DON CHIA SALE; tab "quay" khong doc; UU TIEN hon ghep Base, thua bang CRM (acctSplitExtra). Du lieu T10 = dong that cua sheet. Chay: node tools/test-acct-onl-sheets.js
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



const don = (ghi, sale, val) => ({ ngayTaoDon: '02/10/2026', trangThai: 'Hoàn thành', theSale: sale, soDienThoai: '0900000001', nguonDon: 'Fb Phạm Thu Hiền', giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K', cod: 0, marketer: '', ghiChu: ghi });
const HEAD = ['STT', 'Kênh bán', 'Sale bán', 'Giá trị cọc đơn hàng (số tiền ck)', 'Tổng giá trị đơn hàng (ko ship)', 'SDT', 'Mã bộ đếm', 'Tỷ lệ'];
const ONL_T10 = [HEAD,   // dong THAT cua tab onl T10 (2026-11-06)
  [1, 'Fb Phạm Thu Hiền', 'ninhnga99, huyenmaii1990', '', '6.700.000', '', '17T10/2026', 'dthu 1.5'],
  [2, 'Fb Phạm Thu Hiền', 'ninhnga99', '', '10.708.000', '', '17T10/2026', ''],
  [5, 'HienPham tourmaline', 'ninhnga99, minhquach1995', '', 4250000, '', '416T10/2026', ''],
  [6, 'HienPham tourmaline', 'ninhnga99', '', '6.780.000', '', '416T10/2026', ''],
  [13, 'Zalo CSKH up mới', 'menbui2002', '', 20432000, '', '1222T10/2026', ''],
  [14, 'Zalo CSKH up mới', 'phuongthao2000', '', 42950000, '', '1222T10/2026', ''],
  [15, 'Page HT3', 'huyenmaii1990', '', 3550000, 904074569, 'M45869', 'dthu 1.5'],
  [16, 'Page HT3', 'ngocNB2003saleoff', '', 14523000, 904074569, 'M45869', ''],
  [17, 'Page HT3', 'khongco', '', '', '', '777T10/2026', '']];       // thieu tong => bo qua, KHONG lam mat don
const QUAY = [HEAD, [1, 'Quầy', 'quaySale', '', 5000000, '', '999T10/2026', '']];
const ONL_T11 = [HEAD, [1, 'Page HT3', 'anhtrinh1995', '', 8000000, '', '55T11/2026', '']];
let SHEETS = [], EXTRA = '';
const mkSheet = (name, vals) => ({ getName: () => name, getDataRange: () => ({ getValues: () => vals }) });
ctx.CacheService = new Proxy(svc(), { get: (t, p) => p === 'getScriptCache' ? () => ({ get: () => null, put() {}, remove() {} }) : t[p] });
const _SSBASE = svc();
ctx.SpreadsheetApp = new Proxy(_SSBASE, { get: (t, p) => p === 'openById' ? (id) => (id === ctx.ACCT_SPLIT_SS_ID_ ? { getSheets: () => SHEETS } : _SSBASE.openById(id)) : t[p] });
ctx.__getSetting = k => (k === 'acctSplitExtra' ? EXTRA : null);
vm.runInContext('getSetting_ = function(k) { return __getSetting(k); }; _acctExtraMemo_ = null;', ctx);
const run = (dons, sheets, extra) => { SHEETS = sheets; EXTRA = extra ? JSON.stringify(extra) : ''; ctx.__rows = []; ctx.__don = dons; vm.runInContext('_acctExtraMemo_ = null;', ctx);
  return J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx)); };
const g = (B, n) => Math.round((B.bySale.find(r => r.name === n) || {}).giaTri || 0);
const ALL = [mkSheet('quầy t10', QUAY), mkSheet('onl T10', ONL_T10), mkSheet('onl T11', ONL_T11)];
let B = run([don('17T10/2026', 'ninhnga99, huyenmaii1990', 17332000)], ALL);
ok(g(B, 'ninhnga99') === 14058000 && g(B, 'huyenmaii1990') === 3350000 && B.totalGiaTri === 17408000, 'onl T10: 17T10 = ninhnga99 14.058.000 / huyenmaii1990 3.350.000 (tong KT 17.408.000, khong can x)');
B = run([don('1222T10/2026', 'phuongthao2000, menbui2002', 60000000)], ALL);
ok(g(B, 'phuongthao2000') === 42950000 && g(B, 'menbui2002') === 20432000 && B.totalGiaTri === 63382000, 'onl T10: 1222T10 = phuongthao2000 42.950.000 + menbui2002 20.432.000 (don 42.950.000 phuongthao2000 da co ma)');
B = run([don('M45869', 'huyenmaii1990', 10000000)], ALL);
ok(g(B, 'huyenmaii1990') === 3550000 && g(B, 'ngocNB2003saleoff') === 14523000, 'onl T10: don quay ghi ma don Pos M45869 khop (3.550.000 / 14.523.000)');
B = run([don('416T10/2026', 'ninhnga99, minhquach1995', 11000000)], ALL);
ok(g(B, 'ninhnga99') === 2125000 + 6780000 && g(B, 'minhquach1995') === 2125000, 'onl T10: 416T10 chia tay (ninhnga99 2.125.000+6.780.000, minhquach1995 2.125.000)');
B = run([don('55T11/2026', 'anhtrinh1995', 7000000)], ALL);
ok(g(B, 'anhtrinh1995') === 8000000, 'tab onl T11 cung duoc doc (55T11: 7tr Pos -> 8tr KT)');
B = run([don('999T10/2026', 'anhtrinh1995', 1000000)], ALL);
ok(g(B, 'anhtrinh1995') === 1000000 && g(B, 'quaySale') === 0, 'tab "quầy t10" KHONG doc: 999T10 giu theo Pos');
B = run([don('777T10/2026', 'anhtrinh1995', 2000000)], ALL);
ok(g(B, 'anhtrinh1995') === 2000000 && B.totalGiaTri === 2000000, 'dong onl thieu tong (777T10) bi bo qua, don KHONG bi mat doanh thu');
B = run([don('17T10/2026', 'ninhnga99, huyenmaii1990', 17332000)], ALL, [{ code: '17T10/2026', sales: ['huyenmaii1990'], tong: 1000000 }]);
ok(g(B, 'huyenmaii1990') === 1000000 && g(B, 'ninhnga99') === 0, 'bang CRM (acctSplitExtra) thang tab onl khi cung ma');
B = run([don('17T10/2026', 'ninhnga99, huyenmaii1990', 17332000)], [mkSheet('Sheet1', [HEAD.concat(['Xác nhận'])].concat([[1, 'Fb', 'ninhnga99', '', 5000000, '', '17T10/2026', '', 'x']]))]);
ok(g(B, 'ninhnga99') === 5000000, 'khong co tab onl => doc tab dau tien nhu cu (legacy)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
