#!/usr/bin/env node
// Test: ty le chot o BAO CAO B (Pos) phai la DON BASE (DT TONG) / tuong tac Pancake — khong phu thuoc don Pos (yeu cau Duyen 12/10/2026).
// Chay: node tools/test-close-rate-base.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __pos = [];                                             // DON POS — co tinh de TRONG (Pos cuoi tuan len so cham)
  readDonChiTiet_ = function() { return __pos; };
  _mergeTachDon_ = function(r) { return r; };
  var __b = function(day, sale, st, kenh, sp) { return { ngayTao: day, kenhBan: kenh || 'K1', saleBan: sale, trangThai: st || 'Hoàn thành', sanPham: sp || 'Nhẫn vàng', nguoiTao: sale, giaTriDon: 1000000, giaTriCoc: 0 }; };
  var __base = [];
  for (var i = 0; i < 6; i++) __base.push(__b('05/10/2026', 'saleA'));
  __base.push(__b('06/10/2026', 'saleA', 'Thất bại'));       // loai: don that bai
  for (var j = 0; j < 3; j++) __base.push(__b('06/10/2026', 'saleB'));
  __base.push(__b('07/10/2026', 'saleA'));                    // ngay khong co Pancake -> khong vao ty le
  __base.push(__b('05/10/2026', 'saleA', 'Hoàn thành', 'K1', 'Vòng bạc'));   // san pham khac
  __base.push(__b('05/10/2026', 'saleC', 'Hoàn thành', 'K2'));              // kenh K2 (khong co Pancake)
  __base.push(__b('30/09/2026', 'saleA'));                    // ngoai ky
  __base.push(Object.assign(__b('05/10/2026', 'saleA'), { nguoiTao: 'mktX' }));   // nguoi tao KHONG phai sale -> chi dem cho kenh
  __base.push(Object.assign(__b('05/10/2026', 'saleA'), { bhZero: true }));       // don BH khong doanh thu -> loai
  readDTTong_ = function() { return __base; };
  readPancakePageMap_ = function() { return { P1: 'K1', '862972056891669': 'K1' }; };
  readPancakePageMapByName_ = function() { return { 'page mot': 'K1' }; };
  readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; };
  _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: { P1: { '2026-10-05': true, '2026-10-06': true } }, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [{ name: 'saleA', tongTT: 100 }, { name: 'saleB', tongTT: 50 }], byPage: [{ pageId: 'P1', tongTT: 150 }] }; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  readTeams_ = function() { return []; };
  readMktTeams_ = function() { return []; };
  readUsers_ = function() { return []; };
  getCrmSS_ = function() { return { getSheetByName: function() { return null; } }; };
`, ctx);
const F = { dateFrom: '2026-10-01', dateTo: '2026-10-12' };
const B = (f) => vm.runInContext('buildSalesReportB_(' + JSON.stringify(Object.assign({}, F, f || {})) + ')', ctx);
const A = (f) => vm.runInContext('buildSalesReportA_(' + JSON.stringify(Object.assign({}, F, f || {})) + ')', ctx);

// 1) Pos TRONG nhung Base co don -> ty le chot van tinh theo Base (tu so = don Base theo NGUOI TAO; mau so = tuong tac Pancake)
let r = B();
const sale = n => r.saleCloseRate.find(x => x.name === n);
eq(r.totalOrders, 0, 'so don/doanh thu cua B van tinh tu Pos (Pos trong -> 0 don)');
eq(sale('saleA'), { name: 'saleA', held: 100, closed: 7, closeRate: 7 }, 'saleA: 7 don Base / 100 tuong tac = 7%, KHONG bi keo thap boi Pos');
eq(sale('saleB'), { name: 'saleB', held: 50, closed: 3, closeRate: 6 }, 'saleB: 3 don Base / 50 tuong tac = 6%');
eq(sale('(chưa gán sale)').closed, 1, 'nguoi tao khong phai sale (mktX) -> don do vao "(chua gan sale)", khong tinh cho sale nao');
const k1 = r.kenhCloseRate.find(x => x.name === 'K1'); eq([k1.held, k1.closed, k1.closeRate], [150, 11, 7.3], 'kenh K1 dem moi don Base (ke ca nguoi tao khong phai sale): 11 / 150 = 7.3%');
ok(!r.kenhCloseRate.some(x => x.name === 'K2' && x.closed), 'don kenh/ngay khong co du lieu Pancake bi bo qua');
// don That bai, don BH khong doanh thu, don ngoai ky, ngay khong co Pancake deu KHONG vao tu so (da nam trong con so 7/3/11 o tren)

// 2) Khi Pos co don thi ty le chot KHONG doi — chi doanh thu/so don cua B theo Pos
vm.runInContext("__pos = [{ ngayTaoDon: '05/10/2026', trangThai: 'Hoàn thành', theSale: 'saleA', soDienThoai: '0900000001', nguonDon: 'Facebook / Page Mot (862972056891669)', giaTri: 1, sanPham: 'Nhẫn vàng' }];", ctx);
const r2 = B(); eq(r2.saleCloseRate.find(x => x.name === 'saleA').closed, 7, 'co don Pos hay khong, tu so ty le chot van la don Base');

// 3) Hai bao cao ra CUNG con so khi chon cung ngay (A = nguon chuan)
const a = A(); eq(r2.saleCloseRate, a.saleCloseRate, 'A va B: ty le chot theo Sale giong het'); eq(r2.kenhCloseRate, a.kenhCloseRate, 'A va B: ty le chot theo Kenh giong het');

// 4) Bo loc Sale/San pham/Nguon cua tung bao cao CHI ap cho bang doanh thu — khong lam doi ty le chot (A va B van cung so)
const rs = B({ sale: ['saleB'], sanPham: 'Vòng bạc', nguon: ['Facebook / Page Mot (862972056891669)'] }), as = A({ sale: ['saleB'], sanPham: 'Vòng bạc' });
eq(rs.saleCloseRate, r2.saleCloseRate, 'B co loc Sale/San pham/Nguon: ty le chot khong doi'); eq(as.saleCloseRate, r2.saleCloseRate, 'A co loc: ty le chot khong doi');
console.log('ALL CLOSE-RATE-BASE TESTS PASSED');
