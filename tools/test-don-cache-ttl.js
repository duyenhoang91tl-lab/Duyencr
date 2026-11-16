#!/usr/bin/env node
// Test cache sheet don Pos (Duyen 2026-11-16: "an load bao cao lau du chi xem thang"): TTL 600s dung chung cho 'donChiTiet_v4' + 'don_phones_v6',
// readDonChiTiet_ THAT chi doc sheet 1 lan khi cache con han, va removeAll([...'_n']) (nhap file/xoa trung) buoc doc lai. Chay: node tools/test-don-cache-ttl.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const store = new Map(), ttls = {};
const cache = {
  get: k => (store.has(k) ? store.get(k) : null),
  put: (k, v, t) => { if (String(v).length > 100 * 1024) throw new Error('Argument too large: value'); store.set(k, String(v)); ttls[k] = t; },
  putAll: (o, t) => { Object.keys(o).forEach(k => cache.put(k, o[k], t)); },
  getAll: ks => { const out = {}; ks.forEach(k => { if (store.has(k)) out[k] = store.get(k); }); return out; },
  remove: k => store.delete(k), removeAll: ks => ks.forEach(k => store.delete(k))
};
const ctx = { SpreadsheetApp: svc(), CacheService: { getScriptCache: () => cache }, PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
ok(vm.runInContext('DON_CACHE_TTL_', ctx) === 600, 'DON_CACHE_TTL_ = 600');
// Gia lap sheet Pos: dem so lan doc
let reads = 0;
vm.runInContext(`
  var __reads = 0;
  getDTSS_ = function() { return { getSheetByName: function() { return { getLastRow: function() { return 3; }, getMaxColumns: function() { return 30; },
    getRange: function() { __reads++; return { getValues: function() { return [[1],[2]]; } }; } }; } }; };
  _donConvertRows_ = function(vals, start) { return { items: vals.map(function(v, i) { return { obj: { ghiChu: 'r' + v[0] }, srcRow: i + start }; }) }; };
`, ctx);
const a = vm.runInContext('readDonChiTiet_()', ctx);
ok(a.length === 2 && a[0].posRow === 2, 'lan 1 doc sheet that (co posRow)');
ok(ttls['donChiTiet_v4_0'] === 600 && ttls['donChiTiet_v4_n'] === 600, 'cache donChiTiet_v4 luu voi TTL 600s (khong con 90s)');
const r1 = vm.runInContext('__reads', ctx); vm.runInContext('readDonChiTiet_()', ctx);
ok(vm.runInContext('__reads', ctx) === r1, 'lan 2 trong TTL: KHONG doc lai sheet');
// Nhap file / xoa trung xoa dung 2 key _n -> doc lai ngay (khong doi 600s)
cache.removeAll(['donChiTiet_v4_n', 'don_phones_v6_n']);
vm.runInContext('readDonChiTiet_()', ctx);
ok(vm.runInContext('__reads', ctx) === r1 + 1, 'sau removeAll(_n) (nhap file/xoa trung) doc lai ngay so moi');
// don_phones_v6 cung TTL 600: kiem trong source (action donPhones nam trong doGet, kho chay rieng)
ok(/_cachePutBig_\('don_phones_v6', JSON\.stringify\(resDP\), DON_CACHE_TTL_\)/.test(src), 'don_phones_v6 dung cung hang so TTL');
ok(!/_cachePutBig_\('(donChiTiet_v4|don_phones_v6)',[^;]*, 90\)/.test(src), 'khong con TTL 90 cung cho 2 key');
// Moi cho GHI sheet Pos da co removeAll 2 key _n (neu them duong ghi moi ma quen -> test nay do de nhac)
const n = (src.match(/removeAll\(\[[^\]]*'donChiTiet_v4_n'[^\]]*'don_phones_v6_n'[^\]]*\]\)/g) || []).length;
ok(n >= 6, 'cac duong ghi/xoa Pos xoa ca 2 key (' + n + ' cho)');
console.log(fails ? '\nCO LOI' : '\nTAT CA QUA'); process.exit(fails ? 1 : 0);
