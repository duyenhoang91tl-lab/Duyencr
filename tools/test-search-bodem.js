#!/usr/bin/env node
// Test: searchOrderCode_ phai tim duoc MA BO DEM (cot U DT TONG) — vd "1011T09/2026" (Duyen bao 2026-10-23: ma co tren Base nhung search CRM khong ra).
// NGUYEN NHAN GOC: ham chi do cot ID (T) + ghi chu don Pos, khong do cot U. Chay: node tools/test-search-bodem.js -> "SEARCH BODEM TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
// Du lieu gia: dong sheet 2 co ID 'A100' + ma bo dem '1011T09/2026'; dong 3 co ID '1011T09/2026' o cot ID (kieu cu); dong 4 khac
vm.runInContext(`
  readAllOrders_ = function(){ return [
    { id:'A100', rowIndex:2, phone:'0901111222', orderDate:'2026-10-01', product:'HAT NG LAM THUY', revenue:9016000 },
    { id:'1011T09/2026', rowIndex:3, phone:'0903333444', orderDate:'2026-10-02', product:'CHARM', revenue:100 },
    { id:'B200', rowIndex:4, phone:'0905555666', orderDate:'2026-10-03', product:'VONG', revenue:200 } ]; };
  _dtBoDemCol_ = function(){ return ['1011T09/2026', '', '254T10/2026']; };
  readDonChiTiet_ = function(){ return [ { ghiChu:'254T10/2026/1 TACH', soDienThoai:'0907777888', ngayTaoDon:'2026-10-05', sanPham:'X', giaTriSauGiam:5 } ]; };
`, ctx);
const run = q => vm.runInContext('searchOrderCode_(' + JSON.stringify(q) + ')', ctx);
let r = run('1011T09/2026');
ok(r.some(x => x.phone === '0901111222' && x.code === '1011T09/2026' && x.src.indexOf('Mã bộ đếm') === 0), 'tim ra don co ma bo dem o cot U: ' + JSON.stringify(r));
ok(r.some(x => x.phone === '0903333444' && x.src === 'DT TỔNG'), 'van tim duoc theo cot ID nhu cu');
r = run('1011t09');
ok(r.some(x => x.phone === '0901111222'), 'khong phan biet hoa/thuong');
r = run('254T10/2026');
ok(r.some(x => x.phone === '0905555666' && x.src.indexOf('Mã bộ đếm') === 0), 'ma bo dem dong 4 -> dung SDT dong 4');
ok(r.some(x => x.src === 'Dữ liệu đơn' && x.phone === '0907777888'), 'van tim ghi chu don Pos nhu cu');
ok(run('zzz999').length === 0 && run('10').length === 0, 'khong khop / qua ngan => rong');
console.log('SEARCH BODEM TESTS PASSED');
