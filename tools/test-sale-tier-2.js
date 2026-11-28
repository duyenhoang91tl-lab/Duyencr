#!/usr/bin/env node
// Test mo hinh 2 BAC Sale (gas_v13.js): Thu viec KPI 100tr dung 1 thang -> Chinh thuc 500tr. Duyen chot 27/11/2026, ap dung ca Sale Offline.
// Chay: node tools/test-sale-tier-2.js (ham THAT trong gas_v13.js, khong goi mang)
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const run = (c) => vm.runInContext(c, ctx);
ctx.__set__ = {}; ctx.__writes__ = 0;
run(`getSetting_ = function(k) { return __set__[k] === undefined ? '' : __set__[k]; };
     setSetting_ = function(k, v) { __set__[k] = v; __writes__++; return { ok: true }; };
     _todayYm_ = function() { return '2026-11'; };`);
// ---- 1) hang so ----
ok(JSON.stringify(run('SALE_TIER_ORDER_')) === '["TV","CT"]' && run('SALE_TIER_DEFAULT_TARGETS_.TV') === 100000000 && run('SALE_TIER_DEFAULT_TARGETS_.CT') === 500000000, 'chi con 2 bac: TV 100tr, CT 500tr');
// ---- 2) chuyen doi cau hinh cu 9 bac ----
ctx.__set__.saleKpiConfig = JSON.stringify({ tierTargets: { F1: 4e8, TVF1: 2.4e8 }, trackingStartMonth: '2026-09',
  startTier: { thuongBT: 'TVF1', nguyetTTA1995: 'TVF2', 'ngocNM': 'F1', Lan: 'F2', An: 'O1', Ba: 'O', Tu: 'TVF1' }, overrides: { 'Bình': 3e8 } });
ctx.__set__.saleChannels = JSON.stringify({ 'Cường': 'offline', 'Dũng': '' });
let cfg = run('readSaleKpiConfig_()');
const T = (n) => cfg.startTier[n];
ok(T('thuongBT') === 'TV' && T('nguyetTTA1995') === 'TV' && T('ngocNM') === 'TV', 'thuongBT / nguyetTTA / ngocNM = Thu viec (ke ca khi truoc do la F1)');
ok(['Lan', 'An', 'Ba', 'Tu', 'Bình', 'Cường'].every((n) => T(n) === 'CT'), 'ca doi cu (ke ca TVF1 cu, Commit rieng, da phan loai doi) = Chinh thuc');
ok(T('Dũng') === undefined, 'ten khong thuoc nhom nao (kenh rong) khong tu gan');
ok(cfg.startMonth.thuongBT === '2026-11' && cfg.tierModel === 2, 'Thu viec bat dau tu thang hien tai (2026-11), danh dau tierModel 2');
ok(cfg.tierTargets.TV === 100000000 && cfg.tierTargets.CT === 500000000 && cfg.tierTargets.F1 === undefined, 'KPI = 100tr / 500tr, bo muc bac cu');
ok(ctx.__writes__ === 1 && JSON.parse(ctx.__set__.saleKpiConfig).startTier.Lan === 'CT', 'da luu lai 1 lan');
// sua tay roi doc lai KHONG bi chuyen doi de
const st = JSON.parse(ctx.__set__.saleKpiConfig); st.startTier.thuongBT = 'CT'; st.tierTargets.TV = 120000000; ctx.__set__.saleKpiConfig = JSON.stringify(st);
cfg = run('readSaleKpiConfig_()');
ok(T('thuongBT') === 'CT' && cfg.tierTargets.TV === 120000000 && ctx.__writes__ === 1, 'sau khi chuyen doi: sua tay duoc giu nguyen, khong ghi de lai');
// khong co cau hinh -> mac dinh, khong ghi
ctx.__set__.saleKpiConfig = ''; ctx.__writes__ = 0; cfg = run('readSaleKpiConfig_()');
ok(Object.keys(cfg.startTier).length === 0 && cfg.tierTargets.TV === 100000000 && ctx.__writes__ === 0, 'chua co cau hinh: mac dinh 100tr/500tr, khong tu ghi');
// ---- 3) dong thoi gian bac ----
const tl = (st, months, begin) => run('_computeSaleTierTimeline_(' + JSON.stringify(st) + ',' + JSON.stringify(months) + ',{},{},' + JSON.stringify(begin || '') + ')');
const M = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];
ok(JSON.stringify(tl('TV', M, '2026-11')) === JSON.stringify({ '2026-11': 'TV', '2026-12': 'CT', '2027-01': 'CT' }), 'TV bat dau 11/2026: thang 11 TV, thang 12 tro di CT; thang truoc 11 khong tinh');
ok(JSON.stringify(tl('TV', M)) === JSON.stringify({ '2026-09': 'TV', '2026-10': 'CT', '2026-11': 'CT', '2026-12': 'CT', '2027-01': 'CT' }), 'TV khong co thang bat dau: TV dung 1 thang dau theo doi roi CT');
ok(tl('TV', M, '2026-08')['2026-09'] === 'CT', 'TV bat dau truoc ky theo doi da qua 1 thang: thang dau theo doi da la CT');
ok(Object.keys(tl('CT', M)).every((k) => tl('CT', M)[k] === 'CT'), 'CT giu CT (khong tu len/xuong theo doanh thu)');
ok(Object.keys(tl('TV', M, '2028-01')).length === 0, 'thang bat dau o tuong lai: chua tinh KPI');
// ---- 4) bao cao F ----
run(`buildSalesReportB_ = function() { return { bySale: [ { name: 'thuongBT', giaTri: 60000000, orders: 5 }, { name: 'Lan', giaTri: 400000000, orders: 30 } ], totalOrders: 35, totalGiaTri: 460000000 }; };
     _computeSaleMonthlyRevenue_ = function() { return {}; }; readSaleGroups_ = function() { return []; }; _saleGroupLabel_ = function() { return ''; };
     _todayYm_ = function() { return '2026-12'; };`);
ctx.__set__.saleKpiConfig = JSON.stringify({ tierModel: 2, trackingStartMonth: '2026-09', startTier: { thuongBT: 'TV', Lan: 'CT' }, startMonth: { thuongBT: '2026-11' }, tierTargets: { TV: 1e8, CT: 5e8 } });
ctx.__set__.saleChannels = '{}';
let r = run('buildSaleKpiReport_({ dateFrom: "2026-11-01", dateTo: "2026-12-31" })');
const row = (n) => r.rows.filter((x) => x.name === n)[0];
ok(row('thuongBT').target === 600000000 && row('thuongBT').tier === 'CT' && row('thuongBT').nhom === 'Chính thức', 'thuongBT xem thang 11+12: KPI 100tr + 500tr = 600tr, hien tai la Chinh thuc: ' + row('thuongBT').target);
ok(row('Lan').target === 1000000000 && row('Lan').pct === 40, 'Chinh thuc 2 thang = 1 ty; 400tr = 40%');
r = run('buildSaleKpiReport_({ dateFrom: "2026-11-01", dateTo: "2026-11-30" })');
ok(row('thuongBT').target === 100000000 && row('thuongBT').nhom === 'Thử việc' && row('thuongBT').pct === 60, 'xem rieng thang 11: Thu viec KPI 100tr, 60tr = 60%');
r = run('buildSaleKpiReport_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })');
ok(row('thuongBT').target === 0 || row('thuongBT').target === null || row('thuongBT').pct === null, 'thang 10 (truoc ngay bat dau thu viec): khong tinh KPI');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
