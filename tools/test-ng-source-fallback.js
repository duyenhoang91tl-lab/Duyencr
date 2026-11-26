#!/usr/bin/env node
// Duyen 2026-11-25: don ma "NG..." (kenh nguon). Neu CHUA cap nhat bao cao Base kenh nguon thi ma NG khong co tren Base
// -> van tinh theo The Pos (nhan vien tren the) nhu binh thuong, KHONG bao "khong khop". Co tren Base -> ghep nhu cu.
// Chay ham GAS that _resolveGhepDon_. Chay: node tools/test-ng-source-fallback.js
const fs = require('fs'), vm = require('vm'), path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
vm.createContext(ctx); vm.runInContext(src, ctx);

const run = (codes, rows, pos) => { ctx.__codes = codes; ctx.__exact = rows; ctx.__pos = pos; return JSON.parse(vm.runInContext(`
  _posGhepRatioMemo_ = null; getSetting_ = function() { return null; };
  JSON.stringify(_resolveGhepDon_(__codes, { exact: __exact, fuzzy: {} }, {}, __pos, ['saleThe']));`, ctx)); };
const base = (rowIndex, code, gia, sale) => ({ rowIndex, code, trangThai: 'Hoàn thành', giaTriDon: gia, saleBan: sale, ngayTao: '02/11/2026 09:00', creator: sale });

// 1) Don 1 ma thuong + 1 ma NG; Base chi co ma thuong (chua cap nhat nguon) -> ngChuaCapNhat (caller roi ve Pos), KHONG phai khongKhop
let r = run(['1326T10/2026', 'NG139T10/2026'], { '1326T10/2026': [base(1, '1326T10/2026', 8000000, 'saleBase')] }, 11300000);
ok(r.status === 'ngChuaCapNhat' && r.missing.join() === 'NG139T10/2026', 'ma NG thieu tren Base -> ngChuaCapNhat (khong bao khongKhop), missing = ma NG');
ok(r.status !== 'khongKhop' && r.total === undefined && r.shares === undefined, 'khong ghep mot phan (khong co total/shares) -> caller tinh theo The Pos nhu cu');

// 2) Toan ma NG, Base chua co gi -> ngChuaCapNhat (KHONG bi gocBiLoai lam mat don)
r = run(['NG2T11/2026', 'NG38T11/2026'], {}, 5000000);
ok(r.status === 'ngChuaCapNhat', 'tat ca ma deu la NG va chua co Base -> ngChuaCapNhat (don khong bi bo)');

// 3) Thieu them 1 ma THUONG (khong phai NG) -> van khongKhop nhu cu
r = run(['681T10/2026', 'NG139T10/2026'], {}, 5000000);
ok(r.status === 'khongKhop' && r.missing.length === 2, 'thieu ca ma thuong lan ma NG -> van khongKhop (kiem tra tay nhu cu)');
r = run(['681T10/2026', '937T10/2026'], { '937T10/2026': [base(2, '937T10/2026', 3000000, 'saleX')] }, 3000000);
ok(r.status === 'khongKhop' && r.missing.join() === '681T10/2026', 'ma thuong thieu -> khongKhop (khong doi)');

// 4) Da cap nhat bao cao nguon: ma NG co tren Base -> ghep nhu moi ma khac
r = run(['1326T10/2026', 'NG139T10/2026'], { '1326T10/2026': [base(1, '1326T10/2026', 8000000, 'saleA')], 'NG139T10/2026': [base(2, 'NG139T10/2026', 3300000, 'saleB')] }, 11300000);
ok(r.status === 'ok' && r.total === 11300000 && r.shares.length === 2, 'da cap nhat Base (co ma NG) -> ghep binh thuong, chia theo sale tren Base');

// 5) Ma BH khong anh huong: ma "BH" khong khop /^NG\d/
r = run(['BH395T09/2026', 'NG1T11/2026'], {}, 1000000);
ok(r.status === 'khongKhop', 'ma khac NG (BH...) thieu -> van khongKhop');

// 6) buildSalesReportB_ co nhanh rieng cho ngChuaCapNhat va KHONG dem vao khongKhop / trungDonGoc
ok(/gh\.status === 'ngChuaCapNhat'\) \{ ghepStats\.ngChuaCapNhatCount\+\+/.test(src), 'buildSalesReportB_ dem rieng don NG chua co Base');
ok(/ngChuaCapNhat: \[\], ngChuaCapNhatCount: 0 \}/.test(src), 'ghepStats co truong ngChuaCapNhat/ngChuaCapNhatCount');

console.log(fails ? '\nFAILED ' + fails : '\nALL NG-SOURCE-FALLBACK TESTS PASSED'); process.exit(fails ? 1 : 0);
