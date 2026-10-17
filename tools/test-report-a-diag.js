#!/usr/bin/env node
// Test CHAN DOAN 0 don cua Bao cao A (buildSalesReportA_ that, du lieu gia). Chay: node tools/test-report-a-diag.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __b = function(day, sale, st) { return { ngayTao: day, kenhBan: 'K1', saleBan: sale, trangThai: st || 'Hoàn thành', sanPham: 'Nhẫn', nguoiTao: sale, giaTriDon: 1000000, giaTriCoc: 0 }; };
  var __rows = [];
  readDTTong_ = function() { return __rows; };
  getSetting_ = function() { return null; };
  readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; }; _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: {}, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [], byPage: [] }; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  readTeams_ = function() { return []; }; readMktTeams_ = function() { return []; }; readUsers_ = function() { return []; };
  readSaleDirectory_ = function() { return { list: [] }; }; readDonChiTiet_ = function() { return []; }; _mergeTachDon_ = function(r) { return r; };
`, ctx);
const run = (rows, f) => { ctx.__rows = rows; return vm.runInContext('buildSalesReportA_(' + JSON.stringify(Object.assign({ dateFrom: '01/10/2026', dateTo: '31/10/2026' }, f)) + ')', ctx); };
const J = x => JSON.parse(JSON.stringify(x));
const b = (d, s, st) => vm.runInContext('__b(' + JSON.stringify([d, s, st || '']).slice(1, -1) + ')', ctx);

let r = run([], {}); ok(r.totalOrders === 0 && r.diag.rows === 0, 'nguon trong: rows=0');
r = run([b('05/09/2026', 'a'), b('20/09/2026', 'a')], {}); ok(r.diag.rows === 2 && r.diag.inDate === 0 && r.diag.dateMin === '05/09/2026' && r.diag.dateMax === '20/09/2026', 'het trong ky: bao khoang ngay du lieu: ' + JSON.stringify(J(r.diag)));
r = run([b('05/10/2026', 'a', 'Thất bại'), b('06/10/2026', 'a', 'Thất bại')], {}); ok(r.diag.inDate === 2 && r.diag.notExcluded === 0, 'tat ca bi loai vi trang thai');
r = run([b('05/10/2026', 'Trịnh Phương Anh'), b('06/10/2026', 'Trịnh Phương Anh'), b('06/10/2026', 'Dung')], { sale: ['anhtrinh1995'] });
ok(r.totalOrders === 0 && r.diag.afterKenh === 3 && r.diag.afterSale === 0 && r.diag.missNames[0] === 'Trịnh Phương Anh (2)', 'loc Sale khong khop: liet ke ten Sale that: ' + JSON.stringify(J(r.diag.missNames)));
r = run([b('05/10/2026', 'anhtrinh1995'), b('06/10/2026', 'Dung')], { sale: ['AnhTrinh1995'] });
ok(r.totalOrders === 1 && r.diag.afterSale === 1 && r.totalGiaTri === 1000000, 'khop khong phan biet hoa/thuong -> tinh du lieu dung, diag van di kem');
console.log('ALL REPORT-A DIAG TESTS PASSED');
