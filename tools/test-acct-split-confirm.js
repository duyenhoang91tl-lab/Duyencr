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


const don = (ghi, sale, val) => ({ ngayTaoDon: '02/10/2026', trangThai: 'Hoàn thành', theSale: sale, soDienThoai: '0900000001', nguonDon: 'Fb Phạm Thu Hiền', giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K', cod: 0, marketer: '', ghiChu: ghi });
const mk = (confirmed) => { ctx.__rows = []; ctx.__don = [don('17T10/2026', 'ninhnga99, huyenmaii1990', 17332000)];
  ctx.__acct = { rows: [{ line: 1450, kenh: 'Fb', sales: ['ninhnga99', 'huyenmaii1990'], coc: 0, tong: 6700000, chenh: 0, code: '17T10/2026', confirmed },
                         { line: 1451, kenh: 'Fb', sales: ['ninhnga99'], coc: 0, tong: 10708000, chenh: 0, code: '17T10/2026', confirmed }], byCode: {}, byCodeNoYear: {}, err: '' };
  ctx.__acct.rows.forEach(r => { (ctx.__acct.byCode[r.code] = ctx.__acct.byCode[r.code] || []).push(r); (ctx.__acct.byCodeNoYear['17T10'] = ctx.__acct.byCodeNoYear['17T10'] || []).push(r); });
  vm.runInContext('_loadAcctSplit_ = function() { return __acct; };', ctx);
  return J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx)); };
const B0 = mk(false), B1 = mk(true);
const g = (B, n) => Math.round((B.bySale.find(r => r.name === n) || {}).giaTri || 0);
ok(g(B0, 'ninhnga99') === 8666000 && g(B0, 'huyenmaii1990') === 8666000 && B0.totalGiaTri === 17332000, '17T10 CHUA danh dau Xac nhan: CRM chia deu 8.666.000/8.666.000 (KT cong 17.408.000 lech gia Pos 17.332.000 > 1d nen CRM khong tu dung)');
ok(B0.acctSplit ? B0.acctSplit.needConfirmCount === 1 : true, 'don nam trong danh sach can xac nhan');
ok(g(B1, 'ninhnga99') === 14058000 && g(B1, 'huyenmaii1990') === 3350000 && B1.totalGiaTri === 17408000, '17T10 CO dau Xac nhan: CRM = KT 14.058.000 / 3.350.000 (tong don tinh 17.408.000, +76.000 so voi Pos)');
console.log(fails ? '\nFAILED ' + fails : '\nALL ACCT-SPLIT-CONFIRM TESTS PASSED'); process.exit(fails ? 1 : 0);
