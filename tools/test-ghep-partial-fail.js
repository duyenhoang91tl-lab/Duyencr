#!/usr/bin/env node
// Duyen xac nhan 2026-11-11: don Pos ghep 2 don goc Base, don A THAT BAI + don B THANH CONG -> Pos VAN tinh don (dem 1 don) cho sale cua don B.
// Chay ham GAS that _resolveGhepDon_. Chay: node tools/test-ghep-partial-fail.js
const fs = require('fs'), vm = require('vm'), path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8'), ctx);
const run = (ratioOff, aStatus, bStatus) => { ctx.__r = ratioOff; ctx.__a = aStatus; ctx.__b = bStatus; return JSON.parse(vm.runInContext(`
  _posGhepRatioMemo_ = null; getSetting_ = function(k) { return k === 'POS_GHEP_RATIO' && __r ? '0' : null; };
  var A = { rowIndex: 1, code: '10T11/2026', trangThai: __a, giaTriDon: 4000000, saleBan: 'saleA', ngayTao: '02/11/2026 09:00', creator: 'saleA' };
  var B = { rowIndex: 2, code: '11T11/2026', trangThai: __b, giaTriDon: 6000000, saleBan: 'saleB', ngayTao: '02/11/2026 10:00', creator: 'saleB' };
  var idx = { exact: { '10T11/2026': [A], '11T11/2026': [B] }, fuzzy: {} };
  JSON.stringify(_resolveGhepDon_(['10T11/2026', '11T11/2026'], idx, {}, 10000000, ['saleA']));`, ctx)); };
let r = run(false, 'Thất bại', 'Hoàn thành');
ok(r.status === 'ok' && r.total === 10000000 && r.shares.length === 1 && r.shares[0].name === 'saleB' && r.shares[0].frac === 1, 'A that bai + B thanh cong (ty le bat): van tinh don, 100% cho saleB, sale A khong nhan');
r = run(true, 'Thất bại', 'Hoàn thành');
ok(r.status === 'ok' && r.shares.some(s => s.name === 'saleB' && s.frac === 0.6), 'A that bai + B thanh cong (ty le tat): van tinh don, saleB nhan phan Base cua B');
r = run(false, 'Thất bại', 'Thất bại');
ok(r.status === 'gocBiLoai', 'CA 2 don goc that bai: bo don Pos');
r = run(false, 'Hoàn thành', 'Hoàn thành');
ok(r.status === 'ok' && r.shares.length === 2, 'ca 2 deu thanh cong: chia cho 2 sale nhu cu');
console.log(fails ? '\nFAILED ' + fails : '\nALL GHEP-PARTIAL-FAIL TESTS PASSED'); process.exit(fails ? 1 : 0);
