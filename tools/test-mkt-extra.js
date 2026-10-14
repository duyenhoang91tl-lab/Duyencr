#!/usr/bin/env node
// Test 3 CHI SO BO SUNG cua Checklist MKT (XCT/XL5/XL9, gas_v13.js buildMktChecklistReport_). Khong goi mang that.
// Chay: node tools/test-mkt-extra.js
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
  var __cfg = {};
  readMktConfigAll_ = function() { return __cfg; };
  readMktTeams_ = function() { return []; };
  readPancakePageMap_ = function() { return { P1: 'K1' }; };
  _pkSheetDateSpan_ = function() { return { rows: 1, rowsInRange: 1, minDate: '2026-10-01', maxDate: '2026-10-12' }; };
  buildPancakeReport_ = function() { return { byPage: [{ pageId: 'P1', pageName: 'Page 1', tongTT: 100, khMoi: 60, khCu: 40 }],
    byCS: [{ name: 'saleA', tongTT: 70, khMoi: 40, khCu: 30 }, { name: 'saleB', tongTT: 30, khMoi: 20, khCu: 10 }] }; };
  buildPancakeSdtReport_ = function() { return { byPage: [{ pageId: 'P1', sdtMangVe: 30 }], byCS: [{ name: 'saleA', sdtMangVe: 20 }, { name: 'saleB', sdtMangVe: 10 }] }; };
  buildPancakeTagReport_ = function() { return { totals: { L1: 50, L5: 5, 'L5.1': 3, 'L5.2': 2, L9: 4, 'L9.1': 1 }, byPage: { P1: { pageId: 'P1', L5: 5, 'L5.1': 3, 'L5.2': 2, L9: 4, 'L9.1': 1 } } }; };
  _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: { P1: { '2026-10-05': true } }, datesBySale: { saleA: { '2026-10-05': true }, saleB: { '2026-10-05': true } } }; };
  readSaleDirectory_ = function() { var b = {}; b[_normTxt_('saleA')] = { nhom: 'Văn phòng' }; b[_normTxt_('saleB')] = { nhom: 'Online' }; return { list: [], byName: b }; };
  var __row = function(day, creator, sale, st) { return { ngayTao: day, kenhBan: 'K1', saleBan: sale, nguoiTao: creator, giaTriDon: 1000000, trangThai: st || 'Hoàn thành' }; };
  readDTTong_ = function() { return [
    __row('05/10/2026', 'saleA', 'saleA'), __row('05/10/2026', 'SALEA', 'saleA'), __row('05/10/2026', 'mktX', 'saleA'), __row('05/10/2026', 'saleB', 'saleB'),
    __row('05/10/2026', 'saleA', 'saleA', 'Thất bại'),      // loai: don that bai
    __row('07/10/2026', 'saleA', 'saleA') ]; };            // khong tinh vao XCT: ngay khong co du lieu Pancake
`, ctx);
const rep = vm.runInContext('buildMktChecklistReport_("2026-10-01", "2026-10-12")', ctx);
ok(rep.ok, 'bao cao chay');
// --- bao cao goc KHONG doi ---
eq(rep.tags.map(t => t.code).slice(0, 9), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'], 'cac dong L1..L9 giu nguyen');
eq(rep.baseOrders, 5, 'tong don Base van nhu cu (6 don tru 1 that bai)');
eq(rep.tags.find(t => t.code === 'L5').count, 5, 'L5 van = tong don Base');
// --- chi so bo sung ---
eq(rep.extra.map(t => t.code), ['XCT', 'XL5', 'XL9'], '3 chi so bo sung');
const X = c => rep.extra.find(t => t.code === c);
eq(X('XCT').count, 3, 'XCT: 3 don do sale tao (saleA x2 khong phan biet hoa/thuong + saleB); bo mktX, don that bai, ngay khong co Pancake');
eq(X('XCT').denom, 'tt', 'XCT chia cho tong tuong tac'); eq(X('XCT').denomValue, 100, 'mau so XCT = 100'); eq(X('XCT').rate, 3, 'XCT = 3/100 = 3%');
eq(X('XL5').count, 10, 'XL5 = L5(5)+L5.1(3)+L5.2(2)'); eq(X('XL5').denom, 'ttMoi', 'XL5 chia cho tuong tac khach MOI'); eq(X('XL5').denomValue, 60, 'mau so 60'); eq(X('XL5').rate, 16.7, 'XL5 = 10/60');
eq(X('XL9').count, 5, 'XL9 = L9(4)+L9.1(1)+L9.2(0 - khong co)'); eq(X('XL9').denom, 'ttCu', 'XL9 chia cho khach CU'); eq(X('XL9').denomValue, 40, 'mau so 40'); eq(X('XL9').rate, 12.5, 'XL9 = 5/40');
eq(X('XL5').passed, null, 'chua dat muc tieu -> khong ket luan dat/chua dat');
// --- theo Team MKT (page chua gan MKT -> nhom "(chua gan MKT)") ---
const g = rep.groups.mkt[0]; ok(g && g.extra && g.extra.length === 3, 'nhom MKT co 3 chi so bo sung');
eq(g.extra.find(t => t.code === 'XCT').count, 3, 'nhom MKT: XCT'); eq(g.extra.find(t => t.code === 'XL5').count, 10, 'nhom MKT: XL5 theo tag cua Page');
// --- theo Team Sale: XCT chia theo nhom cua NGUOI TAO; tag theo Page nen XL5/XL9 khong co du lieu (null) ---
const vp = rep.groups.sale.find(x => x.nhom === 'Văn phòng'), ol = rep.groups.sale.find(x => x.nhom === 'Online');
eq(vp.extra.find(t => t.code === 'XCT').count, 2, 'Van phong: 2 don do saleA tao'); eq(ol.extra.find(t => t.code === 'XCT').count, 1, 'Online: 1 don do saleB tao');
eq(vp.extra.find(t => t.code === 'XL5').count, null, 'tag theo Page -> sale khong co XL5'); eq(vp.extra.find(t => t.code === 'XL5').rate, null, 'rate XL5 theo sale = null');
// --- cau hinh: sua muc tieu/mau so luu duoc, co trong config tra ve ---
eq(rep.config.XCT, { target: null, denom: 'tt', op: 'gte' }, 'config tra ve co XCT');
vm.runInContext('__cfg = { "2026-10": { XL5: { target: 0.2, denom: "sum:L5+L9", op: "gte" } } };', ctx);
const rep2 = vm.runInContext('buildMktChecklistReport_("2026-10-01", "2026-10-12")', ctx);
const x5 = rep2.extra.find(t => t.code === 'XL5');
eq(x5.target, 0.2, 'muc tieu XL5 doc tu cau hinh thang'); eq(x5.denom, 'sum:L5+L9', 'mau so tuy chon'); ok(x5.passed === false || x5.passed === true, 'co ket luan dat/chua dat khi da dat muc tieu');
eq(rep2.extra.find(t => t.code === 'XCT').denom, 'tt', 'thang da luu cau hinh nhung chua co XCT -> van dung mac dinh');
// luu cau hinh: khoa XCT/XL5/XL9 duoc giu, khoa la bi bo
vm.runInContext('jsonOut_ = function(o) { return o; }; var __saved = null; setSetting_ = function(k, v) { __saved = JSON.parse(v); return { ok: true }; }; __cfg = {};', ctx);
vm.runInContext('saveMktChecklistConfig_("2026-10", { L1: { target: 0.8, denom: "tt" }, XCT: { target: 0.05, denom: "tt", op: "gte" }, XL9: { target: null, denom: "ttCu" }, HACK: { target: 1 } })', ctx);
const saved = vm.runInContext('__saved', ctx)['2026-10'];
eq(Object.keys(saved).sort(), ['L1', 'XCT', 'XL9'], 'luu cau hinh giu XCT/XL9, bo khoa la'); eq(saved.XCT.target, 0.05, 'muc tieu XCT duoc luu');
console.log('ALL MKT EXTRA TESTS PASSED');
