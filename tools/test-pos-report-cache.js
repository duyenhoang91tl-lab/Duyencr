#!/usr/bin/env node
// Test CACHE Bao cao B (Duyen 2026-11-09: "tai bao cao Pos rat lau / khong tai duoc"). Chay ham GAS THAT voi CacheService gia co GIOI HAN 100KB/gia tri nhu that.
// Kiem: (1) so thang truoc chi tinh 1 lan khi cache con han; (2) chot thang / nut "Xem sau khi tru" van doc SO MOI (khong dung cache); (3) ket qua lon > 100KB van cache duoc theo cum.
// Chay: node tools/test-pos-report-cache.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
// CacheService gia: giong that — gia tri > 100KB thi NEM LOI (day chinh la loi bi nuot im lang trong code cu).
const store = new Map();
const cache = {
  get: k => (store.has(k) ? store.get(k) : null),
  put: (k, v) => { if (String(v).length > 100 * 1024) throw new Error('Argument too large: value'); store.set(k, String(v)); },
  putAll: o => { Object.keys(o).forEach(k => cache.put(k, o[k])); },
  getAll: ks => { const out = {}; ks.forEach(k => { if (store.has(k)) out[k] = store.get(k); }); return out; },
  remove: k => store.delete(k), removeAll: ks => ks.forEach(k => store.delete(k))
};
const ctx = { SpreadsheetApp: svc(), CacheService: { getScriptCache: () => cache }, PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(R('gas_v13.js'), ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __settings = {}; getSetting_ = function(k) { return __settings[k] == null ? null : __settings[k]; }; setSetting_ = function(k, v) { __settings[k] = v; };
  var __today = '2026-11', __last = false; _todayYm_ = function() { return __today; }; _isLastDayOfMonthVn_ = function() { return __last; };
  _vnYmd_ = function() { return '2026-10-31'; };
  _acctExtraRaw_ = function() { return ''; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  var __ord = []; readDonChiTiet_ = function() { return __ord; };
  var __data = {}, __builds = {};   // ym -> so lan buildSalesReportB_ duoc goi cho thang do
  buildSalesReportB_ = function(f) { var ym = f.dateFrom.slice(0, 7); __builds[ym] = (__builds[ym] || 0) + 1; var d = __data[ym] || {};
    var bs = Object.keys(d).map(function(n) { return { name: n, orders: 5, giaTri: d[n], cod: 0 }; });
    return { totalOrders: 5 * bs.length, totalGiaTri: bs.reduce(function(s, r) { return s + r.giaTri; }, 0), bySale: bs }; };
`, ctx);
const run = c => J(vm.runInContext(c, ctx));
const builds = ym => vm.runInContext('(__builds["' + ym + '"] || 0)', ctx);

// ── 1. So thang truoc: tinh 1 lan, lan sau lay cache ──
ctx.__data = { '2026-10': { a: 100, b: 50 }, '2026-11': { a: 80 } };
const c1 = run('_posRevenueBySaleCached_("2026-10")'), c2 = run('_posRevenueBySaleCached_("2026-10")');
ok(builds('2026-10') === 1 && c1.total === 150 && c2.total === 150 && c2.bySale.a === 100, 'goi 2 lan cung thang: buildSalesReportB_ chi chay 1 lan, so lieu giong nhau');
ok(run('_posRevenueBySaleCached_("2026-09")').total === 0 && builds('2026-09') === 1, 'thang khac -> tinh rieng (khoa cache theo thang)');

// ── 2. applyPosMonthAdjustToReportB_ nhieu lan (moi lan cache bao cao het han) KHONG tinh lai thang truoc ──
vm.runInContext('__settings.posMonthSnapshots = JSON.stringify({"2026-10": {closedAt: "2026-10-31", total: 160, bySale: {a: 110, b: 50}}})', ctx);
const F = { dateFrom: '2026-11-01', dateTo: '2026-11-30' };
const before = builds('2026-10');
let r1 = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + JSON.stringify(F) + '), ' + JSON.stringify(F) + ')');
let r2 = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + JSON.stringify(F) + '), ' + JSON.stringify(F) + ')');
ok(builds('2026-10') === before && r1.posAdjust.applied && r2.posAdjust.applied, 'xem thang 11 hai lan: thang 10 KHONG bi tinh lai (truoc day moi lan chay lai ca Bao cao B thang 10)');
ok(r1.posAdjust.totalDeduction === 10 && r2.posAdjust.totalDeduction === 10, 'so tru hoan/huy van dung (110 chot - 100 hien tai = 10) o ca 2 lan');

// ── 3. Chot thang + nut "Xem sau khi tru" PHAI doc so MOI, khong dung cache ──
ctx.__data['2026-10'].a = 90;   // don vua bi hoan them sau khi cache duoc tao
const pm = run('posMonthAdjust_("2026-11")');
ok(pm.rows.find(x => x.name === 'a').deduction === 20, 'posMonthAdjust_ doc so moi (110 - 90 = 20), khong lay so cache cu 100');
const b0 = builds('2026-10'); run('closePosMonth_("2026-10", true)');
ok(builds('2026-10') === b0 + 1 && JSON.parse(vm.runInContext('__settings.posMonthSnapshots', ctx))['2026-10'].bySale.a === 90, 'closePosMonth_ chot bang so MOI (a = 90), khong phai so cache');

// ── 4. Doi cong tac chia (ty le Base) -> khoa cache doi, khong dung nham so cu ──
store.clear(); ctx.__builds = {};
run('_posRevenueBySaleCached_("2026-10")');
vm.runInContext('__settings.POS_GHEP_RATIO = "1"; _posGhepRatioMemo_ = null;', ctx);   // memo chi song 1 lan chay GAS that; test dung chung 1 context nen phai xoa tay
run('_posRevenueBySaleCached_("2026-10")');
ok(builds('2026-10') === 2, 'bat POS_GHEP_RATIO: tinh lai (khoa cache khac), khong dung so cua che do cu');

// ── 5. Ket qua lon (> 100KB) van cache duoc nho luu theo cum ──
const big = JSON.stringify({ orders: Array.from({ length: 3000 }, (_, i) => ({ posRow: i, ghiChu: 'x'.repeat(380), khachHang: 'Khach ' + i })) });
ok(big.length > 100 * 1024, 'du lieu thu > 100KB (' + Math.round(big.length / 1024) + 'KB)');
let threw = false; try { cache.put('k_single', big); } catch (e) { threw = true; }
ok(threw, 'CacheService.put 1 khoa that su NEM LOI voi gia tri > 100KB (nguyen nhan cache khong bao gio hoat dong truoc day)');
vm.runInContext('_cachePutBig_("salesB6_test", ' + JSON.stringify(big) + ', 120)', ctx);
const back = vm.runInContext('_cacheGetBig_("salesB6_test")', ctx);
ok(back === big, '_cachePutBig_/_cacheGetBig_: luu va doc lai NGUYEN VEN ket qua > 100KB');

console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA QUA');
process.exit(fails ? 1 : 0);
