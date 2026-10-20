#!/usr/bin/env node
// Test: loc theo Sale thi cac bang "Theo Sale ban"/"Theo Team Sale" CHI hien nguoi trong bo loc (don dong ban voi nguoi khac thi nguoi khac KHONG hien).
// Duyen bao 2026-10-17: loc 16 Sale nhung van thay menbui2002 / phongketoan. Chay ham THAT buildSalesReportA_/C_ trong gas_v13.js voi du lieu gia.
// Chay: node tools/test-sale-filter-cosellers.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __rows = [];
  readDTTong_ = function() { return __rows; };
  getSetting_ = function() { return null; };
  readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; }; _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: {}, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [], byPage: [] }; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  readTeams_ = function() { return [{ id: 't1', name: 'Team Online', leader: '', members: ['anhtrinh1995', 'yenNTH2004'] }, { id: 't2', name: 'Phòng Kế toán', leader: '', members: ['menbui2002', 'phongketoan'] }]; };
  readMktTeams_ = function() { return []; }; readUsers_ = function() { return []; };
  readKPITargets_ = function() { return {}; }; readSaleDirectory_ = function() { return { list: [] }; }; readDonChiTiet_ = function() { return []; }; _mergeTachDon_ = function(r) { return r; };
`, ctx);
const row = (day, sale, val) => ({ ngayTao: day, kenhBan: 'K1', saleBan: sale, trangThai: 'Hoàn thành', sanPham: 'Nhẫn', nguoiTao: 'x', giaTriDon: val, giaTriCoc: 0 });
const rows = [row('05/10/2026', 'anhtrinh1995, menbui2002', 1000000), row('06/10/2026', 'anhtrinh1995', 500000), row('07/10/2026', 'yenNTH2004, phongketoan', 2000000), row('08/10/2026', 'menbui2002', 700000)];
const F = { dateFrom: '01/10/2026', dateTo: '31/10/2026' };
const J = x => JSON.parse(JSON.stringify(x));
const run = (fn, f) => { ctx.__rows = rows; return J(vm.runInContext(fn + '(' + JSON.stringify(Object.assign({}, F, f)) + ')', ctx)); };
const names = arr => (arr || []).map(x => x.name).sort().join(',');
const by = (arr, n) => (arr || []).find(x => x.name === n);

// ── BAO CAO A ──
let a = run('buildSalesReportA_', { sale: ['anhtrinh1995', 'yenNTH2004'] });
ok(names(a.bySale) === 'anhtrinh1995,yenNTH2004', 'A: loc 2 sale -> bang Theo Sale CHI co 2 nguoi do (khong co menbui2002/phongketoan): ' + names(a.bySale));
ok(by(a.bySale, 'anhtrinh1995').orders === 2 && by(a.bySale, 'anhtrinh1995').giaTri === 500000 + 500000, 'A: so don giu nguyen (2); tien van chia deu theo SO SALE TREN DON (1.000.000/2 + 500.000 = 1.000.000)');
ok(by(a.bySale, 'yenNTH2004').giaTri === 1000000, 'A: yenNTH2004 dong ban voi phongketoan: nhan 1/2 = 1.000.000');
ok(a.totalOrders === 3 && a.totalGiaTri === 1000000 + 500000 + 2000000, 'A: the tong KPI van la tong cac DON khop bo loc (3 don, 3.500.000) — khong doi');
ok(!by(a.byTeamSale, 'Phòng Kế toán') && by(a.byTeamSale, 'Team Online'), 'A: bang Theo Team Sale cung khong con "Phòng Kế toán": ' + names(a.byTeamSale));
// khong loc -> day du moi nguoi
a = run('buildSalesReportA_', {});
ok(names(a.bySale) === 'anhtrinh1995,menbui2002,phongketoan,yenNTH2004', 'A: KHONG loc Sale -> van liet ke day du 4 nguoi: ' + names(a.bySale));
// loc 1 nguoi, don dong ban
a = run('buildSalesReportA_', { sale: ['menbui2002'] });
ok(names(a.bySale) === 'menbui2002' && by(a.bySale, 'menbui2002').orders === 2 && by(a.bySale, 'menbui2002').giaTri === 500000 + 700000, 'A: loc rieng menbui2002 -> chi 1 dong (2 don; 500.000 + 700.000)');
// chua ten khac (alias): ten tren don la ten chuan, bo loc chon ten khac cua cung nguoi
vm.runInContext("_expandSaleFilterWithPancakeAliases_ = function(a) { var o = a.slice(); a.forEach(function(x) { if (x === 'trinhpa') o.push('anhtrinh1995'); if (x === 'anhtrinh1995') o.push('trinhpa'); }); return o; };", ctx);
a = run('buildSalesReportA_', { sale: ['trinhpa'] });
ok(names(a.bySale) === 'anhtrinh1995', 'A: loc theo TEN KHAC (alias) cua cung nguoi van giu dung dong anhtrinh1995 (khong mat): ' + names(a.bySale));
vm.runInContext('_expandSaleFilterWithPancakeAliases_ = function(a) { return a; };', ctx);

// ── BAO CAO C (ky tu chon: periodType=custom) ──
const PC = { periodType: 'custom', customCurFrom: '01/10/2026', customCurTo: '31/10/2026', customPrevFrom: '01/09/2026', customPrevTo: '30/09/2026' };
let c = run('buildSalesReportC_', Object.assign({ sale: ['anhtrinh1995', 'yenNTH2004'] }, PC));
const cn = x => (x.byEmployee || []).map(r => r.name).sort().join(',');
ok(cn(c) === 'anhtrinh1995,yenNTH2004', 'C: loc 2 sale -> bang theo nhan vien CHI co 2 nguoi do: ' + cn(c));
ok((c.byEmployee.find(r => r.name === 'anhtrinh1995') || {}).resultCur === 1000000 && (c.byEmployee.find(r => r.name === 'yenNTH2004') || {}).resultCur === 1000000, 'C: tien chia deu theo SO SALE TREN DON van dung (1.000.000 moi nguoi)');
ok(c.ordersCur.length === 3, 'C: danh sach don van la cac don khop bo loc (3 don)');
c = run('buildSalesReportC_', PC);
ok(cn(c) === 'anhtrinh1995,menbui2002,phongketoan,yenNTH2004', 'C: KHONG loc Sale -> day du 4 nguoi: ' + cn(c));

// ── B (POS) va Bao cao don that bai: cung 1 co che — kiem tra tinh vi 2 bao cao nay can nhieu du lieu gia (Base ghep, don chi tiet) ──
const bBody = src.slice(src.indexOf('function buildSalesReportB_('), src.indexOf('function buildSalesReportB_(') + 60000);
ok(/var wantSaleB_ = _saleWantedFn_\(saleFilterFold\);/.test(bBody) && /if \(!wantSaleB_\(sName\)\) continue;[^\n]*\n\s*var fr = fracOf\(sName\)/.test(bBody), 'B: vong cong don Theo Sale co kiem tra nguoi trong bo loc truoc khi cong');
const fBody = src.slice(src.indexOf('function buildFailedOrderReport_('), src.indexOf('function buildFailedOrderReport_(') + 9000);
ok(/var wantSaleF_ = _saleWantedFn_\(saleFilterFold\);/.test(fBody) && /if \(!wantSaleF_\(salesList\[k\]\)\) continue; add_\(bySale/.test(fBody), 'Don that bai: vong cong don Theo Sale co kiem tra nguoi trong bo loc');
console.log(fails ? '\nFAILED ' + fails : '\nALL PASS'); process.exit(fails ? 1 : 0);
