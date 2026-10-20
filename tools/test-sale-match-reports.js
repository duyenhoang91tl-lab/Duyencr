#!/usr/bin/env node
// Ra soat 2026-10-15: MOI bao cao/bo loc phai theo DANH TINH CHUAN (Khop Sale) — chon/ghi ten nao cua 1 nguoi cung ra du du lieu cua nguoi do, hai chieu,
// va 1 nguoi co nhieu ten KHONG bi tach thanh nhieu dong/nhieu nguoi. Test nay phu cac cho da sua: Bao cao D, KPI Pancake (loc), Bao cao L (same()),
// buildTeamMetrics_/orgOverview_ (gom nguoi), nhac lich hen (CS), loc "data chia" (assign). Chay: node tools/test-sale-match-reports.js
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
  getCrmSS_ = function() { return { getSheetByName: function() { return null; } }; };
  // 2 nguoi, moi nguoi co 2 ten: Anh = anhNP1999 + "Anh"; Yen = yenNTH2004 + "Yen" (tai khoan Sale). Leader/admin liet ke nhieu nguoi KHAC NHAU.
  readUsers_ = function() { return [
    { username: 'saleA', name: 'Anh', names: ['anhNP1999'], role: 'cs' }, { username: 'saleY', name: 'Yen', names: ['yenNTH2004'], role: 'cs' },
    { username: 'lead1', name: 'Lan', names: ['anhNP1999', 'yenNTH2004'], role: 'leader' } ]; };
  getSetting_ = function() { return ''; };
  readSaleDirectory_ = function() { return { list: [], byName: {} }; };
  var __pk = { 'Hai Yen FB': 'yenNTH2004' };                 // ten tren Pancake khop 1-1 voi ten Sale
  readPancakeMap_ = function() { return __pk; };
  jsonOut_ = function(o) { return o; };
`, ctx);
const run = (c) => vm.runInContext(c, ctx);
run('var __origBuildKpi = buildKpiReport_;');   // ban that — o muc TeamMetrics ben duoi bi thay bang ban gia

// ── Bao cao D (khach tu them): loc CS theo ten bat ky cua nguoi do ──
run(`readCareLeads_ = function() { return [
  { createdAt: '2026-10-05T01:00:00Z', cs: 'Anh' }, { createdAt: '2026-10-05T02:00:00Z', cs: 'anhNP1999' },
  { createdAt: '2026-10-05T03:00:00Z', cs: 'Yen' }, { createdAt: '2026-10-05T04:00:00Z', cs: 'nguoiLa' } ]; };`);
let d = run(`buildCareLeadReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-12', cs: ['anhNP1999'] })`);
eq(d.total, 2, 'D: loc anhNP1999 -> ra ca dong ghi "Anh" va "anhNP1999" (cung 1 nguoi), khong ra Yen');
d = run(`buildCareLeadReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-12', cs: ['Anh'] })`);
eq(d.total, 2, 'D: loc "Anh" -> cung ket qua (hai chieu)');
eq(run(`buildCareLeadReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-12', cs: [] })`).total, 4, 'D: khong loc -> du 4 dong');

// ── Bao cao L (khach qua cua hang): same() nhan ra 2 ten cua cung nguoi (khop thu cong / tai khoan), khong nham nguoi khac ──
const same = (a, b) => run(`_storeCaseBuildCtx_({}).same(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
ok(same('Anh', 'anhNP1999') && same('anhNP1999', 'ANH'), 'L: tai khoan Sale -> "Anh" va "anhNP1999" la 1 nguoi (2 chieu, khong phan biet hoa/thuong)');
ok(same('Hai Yen FB', 'yenNTH2004') && same('Yen', 'Hai Yen FB'), 'L: ten Pancake khop 1-1 -> cung nguoi (bac cau qua tai khoan)');
ok(!same('Anh', 'Yen') && !same('anhNP1999', 'yenNTH2004'), 'L: 2 nguoi khac nhau KHONG bi gop (ke ca khi leader liet ke ca 2)');

// ── buildTeamMetrics_: 1 nguoi co nhieu ten o cac nguon (KPI Sale/Pancake/CS them KH) -> GOM THANH 1 NGUOI ──
run(`
  buildSaleKpiReport_ = function() { return { rows: [ { name: 'yenNTH2004', revenue: 5000000, orders: 5, nhomChungKey: 'KD1', nhomChung: 'Phòng 1', target: 0 }, { name: 'anhNP1999', revenue: 2000000, orders: 2 } ] }; };
  buildKpiReport_ = function() { return { bySale: [ { name: 'Hai Yen FB', tongTT: 100, sdtMangVe: 30, tyLeChot: 5 }, { name: 'Anh', tongTT: 50, sdtMangVe: 10, tyLeChot: 4 } ] }; };
  buildFailedOrderReport_ = function() { return { bySale: [ { name: 'Yen', orders: 1 } ] }; };
  readCareLeads_ = function() { return [ { createdAt: '2026-10-05T01:00:00Z', cs: 'Yen' }, { createdAt: '2026-10-06T01:00:00Z', cs: 'yenNTH2004' } ]; };   // CS them KH ghi ten hien thi + ten Sale cua cung 1 nguoi
`);
let m = run(`buildTeamMetrics_('2026-10-01', '2026-10-12', null)`);
eq(m.list.length, 2, 'TeamMetrics: 2 NGUOI (khong phai 5 ten tach roi) — Yen va Anh moi nguoi gop du nguon');
const yen = m.list.find(p => /yenNTH2004|Yen/.test(p.name));
eq([yen.revenue, yen.tongTT, yen.sdtMangVe, yen.failedOrders], [5000000, 100, 30, 1], 'TeamMetrics: doanh thu (KPI Sale) + tuong tac (Pancake "Hai Yen FB") + don huy ("Yen") vao CUNG 1 nguoi');
eq(yen.careLeads, 2, 'TeamMetrics: CS them KH ghi "Yen" va "yenNTH2004" cung gop vao 1 nguoi (2 KH)');
const anh = m.list.find(p => /anhNP1999|Anh/.test(p.name)); eq([anh.revenue, anh.tongTT], [2000000, 50], 'TeamMetrics: Anh gop dung');

// ── orgOverview_: thanh vien Team ghi bang ten khac van khop dung nguoi, khong sinh nguoi trung ──
run(`
  posMetrics_ = function() { return { ok: true, warnings: [], bySale: [], bySaleDay: { anhNP1999: { '2026-10-05': [1, 1000] } }, total: { failedOrders: 0 } }; };
  readTeams_ = function() { return [ { id: 't1', name: 'Team 1', leader: 'Yen', members: ['Anh'] } ]; };   // team ghi bang TEN HIEN THI, bao cao dung ten Sale
  readDeptList_ = function() { return [{ key: 'KD1', label: 'Phòng 1' }]; };
  readSaleDepts_ = function() { return { byNorm: {} }; };
  _cacheGetBig_ = function() { return null; }; _cachePutBig_ = function() {};
`);
const o = run(`orgOverview_({ from: '2026-10-01', to: '2026-10-12', refresh: '1' })`);
ok(o.ok !== false, 'orgOverview chay: ' + JSON.stringify(o).slice(0, 120));
eq(o.people.length, 2, 'orgOverview: 2 nguoi (ten trong Team "Yen"/"Anh" KHONG sinh them 2 nguoi trung)');
eq(o.teams[0].members.length, 2, 'orgOverview: Team 1 co 2 thanh vien');
const py = o.people.find(p => /yen/i.test(p.name)), pa = o.people.find(p => /anh/i.test(p.name));
ok(py.isLeader && py.revenue === 5000000, 'orgOverview: leader "Yen" khop dung nguoi co doanh thu 5tr (yenNTH2004), khong thanh nguoi rong');
eq(pa.teams, ['Team 1'], 'orgOverview: "Anh" thuoc Team 1'); eq(pa.activeDays, 1, 'orgOverview: ngay co don (theo ten Sale) gan dung cho nguoi khop ten hien thi');

// ── Nhac lich hen: CS dang nhap ten nay, du lieu ghi ten khac cua cung nguoi ──
const today = new Date(); today.setHours(0, 0, 0, 0);
const row = (phone, cs) => { const r = new Array(14).fill(''); r[0] = phone; r[3] = cs; r[12] = today; return r; };
ctx.__rows = [row('0900000001', 'Anh'), row('0900000002', 'anhNP1999'), row('0900000003', 'Yen')];
const rem = run(`_remindersFromRows_(__rows, 'anhNP1999')`);
eq(rem.map(r => r.phone).sort(), ['0900000001', '0900000002'], 'Nhac hen: CS "anhNP1999" thay lich hen ghi "Anh" va "anhNP1999", khong thay cua Yen');
eq(run(`_remindersFromRows_(__rows, 'Yen')`).length, 1, 'Nhac hen: CS Yen chi thay cua minh');
eq(run(`_remindersFromRows_(__rows, '')`).length, 3, 'Nhac hen: khong loc -> tat ca');

// ── KPI Pancake (buildKpiReport_): bo loc Sale = pham vi du lieu (server-side). Don ghi ten khac cua cung nguoi van thuoc ve nguoi do ──
run(`
  buildKpiReport_ = __origBuildKpi;
  readAllOrders_ = function() { var o = function(cs) { return { orderDate: '05/10/2026', cs: cs, source: 'Page 1', status: 'Hoàn thành', revenue: 1000000, giaTriDon: 1000000 }; };
    return [o('Anh'), o('anhNP1999'), o('Yen'), o('nguoiLa'), o('Anh, Yen')]; };
  readPancakePageMap_ = function() { return { P1: 'Page 1' }; };
  readMktTeams_ = function() { return []; };
  _pkSheetDateSpan_ = function() { return { rows: 1, rowsInRange: 1, minDate: '2026-10-01', maxDate: '2026-10-12' }; };
  _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: { P1: { '2026-10-05': true } }, datesBySale: {}, datesByKenh: {} }; };
  buildPancakeReport_ = function() { return { byPage: [{ pageId: 'P1', pageName: 'Page 1', tongTT: 100, tongDH: 0 }], byCS: [] }; };
  buildPancakeSdtReport_ = function() { return { byPage: [], byCS: [] }; };
  buildPancakeTagReport_ = function() { return { totals: {}, byPage: {} }; };
  _dtApplyBoDem_ = function(x) { return x; };
`);
const kpi = (f) => run('buildKpiReport_("2026-10-01", "2026-10-12", ' + JSON.stringify(f) + ')').totalDonHang;
eq(kpi([]), 5, 'KPI Pancake: khong loc -> 5 don');
eq(kpi(['anhNP1999']), 3, 'KPI Pancake: pham vi anhNP1999 -> don ghi "Anh", "anhNP1999" va don dong sale "Anh, Yen" (3), khong lay Yen/nguoiLa');
eq(kpi(['Anh']), 3, 'KPI Pancake: pham vi "Anh" -> cung ket qua (hai chieu)');
eq(kpi(['Yen']), 2, 'KPI Pancake: pham vi Yen -> 2 don (Yen + don dong sale)');
eq(kpi(['anhNP1999', 'yenNTH2004']), 4, 'KPI Pancake: pham vi 2 nguoi (vd Leader) -> dung 4 don, khong phinh sang nguoi la');

// ── Checklist MKT (Theo Team Sale): ten Pancake khong co trong SaleDirectory nhung la ten khac cua nguoi co trong do -> dung nhom, 1 nguoi = 1 Sale ──
run(`
  readSaleDirectory_ = function() { var b = {}; b[_normTxt_('yenNTH2004')] = { nhom: 'Văn phòng' }; return { list: [], byName: b }; };
  readMktConfigAll_ = function() { return {}; }; readMktTeams_ = function() { return []; };
  _pkSheetDateSpan_ = function() { return { rows: 1, rowsInRange: 1, minDate: '2026-10-01', maxDate: '2026-10-12' }; };
  readPancakePageMap_ = function() { return { P1: 'Page 1' }; };
  _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: { P1: { '2026-10-05': true } }, datesBySale: {}, datesByKenh: {} }; };
  buildPancakeReport_ = function() { return { byPage: [{ pageId: 'P1', pageName: 'Page 1', tongTT: 150, khMoi: 90, khCu: 60 }],
    byCS: [{ name: 'Hai Yen FB', tongTT: 100, khMoi: 60, khCu: 40 }, { name: 'yenNTH2004', tongTT: 30, khMoi: 20, khCu: 10 }, { name: 'Ten La', tongTT: 20, khMoi: 10, khCu: 10 }] }; };
  buildPancakeSdtReport_ = function() { return { byPage: [], byCS: [] }; };
  buildPancakeTagReport_ = function() { return { totals: {}, byPage: {} }; };
  readDTTong_ = function() { return []; };
`);
const mk = run('buildMktChecklistReport_("2026-10-01", "2026-10-12")');
const vp = mk.groups.sale.find(g => g.nhom === 'Văn phòng'), la = mk.groups.sale.find(g => g.nhom === '(ngoài danh sách)');
ok(vp && vp.soSale === 1 && vp.tongTT === 130, 'Checklist MKT: "Hai Yen FB" (ten Pancake khop 1-1) + "yenNTH2004" -> cung nhom Van phong, tinh la 1 Sale, tuong tac gop 130 — ' + JSON.stringify(vp && { soSale: vp.soSale, tongTT: vp.tongTT }));
ok(la && la.soSale === 1 && la.tongTT === 20, 'Checklist MKT: ten la khong thuoc ai -> nhom "(ngoai danh sach)"');
console.log('ALL SALE MATCH REPORTS TESTS PASSED');
