#!/usr/bin/env node
// Test: Ty le chot theo Sale — che do gan don (saleban/nguoitao) + chan doan (_tlcDiagnose_). Chay HAM THAT, doc sheet gia lap.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const logs = [];
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log: (x) => logs.push(String(x)) }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const R = (ngay, kenh, tao, sale, extra) => Object.assign({ ngayTao: ngay, kenhBan: kenh, nguoiTao: tao, saleBan: sale, trangThai: 'Hoàn thành', bhZero: false }, extra || {});
ctx.__rows = [
  R('05/10/2026', 'PageA', 'ninhnga99', 'ninhnga99'),
  R('06/10/2026', 'PageA', 'ninhnga99', 'ninhnga99'),
  R('07/10/2026', 'PageA', 'Admin KD', 'ninhnga99'),                 // nguoi tao la tai khoan khac (khong khop) -> creator: chua gan
  R('08/10/2026', 'PageA', 'Chi Tuyet', 'anhtrinh1995'),             // nguoi tao ten khac han -> creator: chua gan
  R('08/10/2026', 'Zalo', 'ninhnga99', 'ninhnga99'),                 // kenh chua gan Page -> khong dem
  R('20/10/2026', 'PageA', 'ninhnga99', 'ninhnga99'),                // ngay chua nap Pancake -> khong dem
  R('09/10/2026', 'PageA', 'ninhnga99', 'ninhnga99', { bhZero: true }),
  R('15/09/2026', 'PageA', 'ninhnga99', 'ninhnga99'),                // ngoai ky
  R('06/10/2026', 'PageA', 'minhquach95', 'minhquach1995'),          // nguoi tao = ten POS (gop ten mo coi) cua minhquach1995
  R('08/10/2026', 'PageA', 'ninhnga99', 'ninhnga99, anhtrinh1995'),  // don 2 sale
];
ctx.__by = 'saleban';
vm.runInContext(`
  getSetting_ = function(k) { return k === 'closeRateBy' ? __by : null; };
  readDTTong_ = function() { return __rows.map(function(r) { return Object.assign({}, r); }); };
  _isExcludedOrderStatus_ = function(s) { return false; };
  _pkTrackedDatesByPageAndSale_ = function() { var o = {}; ['2026-10-05','2026-10-06','2026-10-07','2026-10-08'].forEach(function(x){ o[x] = 1; }); return { datesByPage: { P1: o } }; };
  readPancakePageMap_ = function() { return { P1: 'PageA' }; };
  buildPancakeReport_ = function() { return { byCS: [ { name: 'ninhnga99', tongTT: 100 }, { name: 'anhtrinh1995', tongTT: 300 }, { name: 'minhquach1995', tongTT: 200 } ], byPage: [], byDay: [] }; };
  readSaleDirectory_ = function() { return { list: [], byName: {} }; };
  _userAliasGroups_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; };
`, ctx);
const F = { dateFrom: '2026-10-01', dateTo: '2026-10-31' };
const rep = () => { const r = ctx._srCloseRateSectionsFromBase_(F); const m = {}; (r.saleCloseRate || []).forEach((x) => { m[x.name] = x.closed; }); return m; };

// ---- cai dat ----
ok(ctx._closeRateBy_() === 'saleban', 'MAC DINH (va gia tri la) = saleban');
ctx.__by = ''; ok(ctx._closeRateBy_() === 'saleban', 'chua cai dat -> saleban');
ctx.__by = 'NguoiTao'; ok(ctx._closeRateBy_() === 'nguoitao', 'nguoitao (khong phan biet hoa thuong)');
ctx.__by = 'rac'; ok(ctx._closeRateBy_() === 'saleban', 'gia tri la -> saleban');
let threw = false; try { ctx.datTyLeChotTheo('xxx'); } catch (e) { threw = true; } ok(threw, 'datTyLeChotTheo tu choi gia tri la');

// ---- che do SALE BAN (BAO CAO THAT) ----
ctx.__by = 'saleban'; let m = rep();
ok(m['ninhnga99'] === 4, 'SALE BAN: ninhnga99 = 4 don (3 don PageA + don 2 sale), khong tinh don Zalo/20-10/BH0/ngoai ky — got ' + m['ninhnga99']);
ok(m['anhtrinh1995'] === 2, 'SALE BAN: anhtrinh1995 = 2 don (1 don rieng + don 2 sale) — dung thieu 0/3422 cu — got ' + m['anhtrinh1995']);
ok(m['minhquach1995'] === 1, 'SALE BAN: minhquach1995 = 1 don — got ' + m['minhquach1995']);
ok(!m['(chưa gán sale)'], 'SALE BAN: khong con don "(chua gan sale)" khi moi don co sale ban');

// ---- che do NGUOI TAO (BAO CAO THAT) ----
ctx.__by = 'nguoitao'; m = rep();
ok(m['ninhnga99'] === 3, 'NGUOI TAO: ninhnga99 = 3 — got ' + m['ninhnga99']);
ok(m['minhquach1995'] === 1, 'NGUOI TAO: nguoi tao "minhquach95" duoc GOP vao minhquach1995 (truoc day bi loai thanh chua gan) — got ' + m['minhquach1995']);
ok(m['(chưa gán sale)'] === 2, 'NGUOI TAO: 2 don chua gan (Admin KD, Chi Tuyet) — got ' + m['(chưa gán sale)']);
ok((m['anhtrinh1995'] || 0) === 0, 'NGUOI TAO: anhtrinh1995 = 0 (nguoi tao ten khac)');

// ---- chan doan ----
const d = ctx._tlcDiagnose_(F);
ok(d.mode === 'nguoitao', 'chan doan ghi che do dang dung');
ok(d.skipped.bhZero === 1 && d.skipped.ngoaiKy === 1 && d.ordersInRange === 8, 'bo BH0 + ngoai ky -> 8 don trong ky');
ok(d.countedForSale === 4 && d.unassigned === 2 && d.notCoveredTotal === 2, 'tong: 4 tinh cho sale / 2 chua gan / 2 khong duoc dem');
ok(d.unknownCreators['Admin KD'] === 1 && d.unknownCreators['Chi Tuyet'] === 1 && !d.unknownCreators['minhquach95'], 'liet ke ten nguoi tao khong khop dung (minhquach95 da duoc gop)');
ok(Object.keys(d.notCovered).some((k) => /Zalo/.test(k) && /CHƯA gán Page/.test(k)) && Object.keys(d.notCovered).some((k) => /PageA/.test(k) && /chưa nạp/.test(k)), 'ly do khong dem: kenh chua gan Page / Page chua nap ngay');
const nn = d.people.find((p) => p.name === 'ninhnga99'), at = d.people.find((p) => p.name === 'anhtrinh1995');
ok(nn.byCreator === 3 && nn.bySaleBan === 6 && nn.bySaleBanCov === 4 && nn.rateSaleBan === 4, 'ninhnga99: nguoi tao 3 / sale ban 6 / sale ban trong kenh Pancake 4 / ty le 4%');
ok(at.byCreator === 0 && at.bySaleBanCov === 2 && at.rateSaleBan === 0.7, 'anhtrinh1995: nguoi tao 0 nhung sale ban (kenh Pancake) 2 -> 0.7%');
// ham chay tay
logs.length = 0; ctx.chanDoanTyLeChot();
ok(logs.some((l) => /CHẨN ĐOÁN TỶ LỆ CHỐT/.test(l)) && logs.some((l) => /Cách gán đơn đang dùng/.test(l)) && ['(A)', '(B)', '(C)'].every((x) => logs.some((l) => l.indexOf(x) >= 0)), 'chanDoanTyLeChot ghi tieu de + che do + 3 khoi A/B/C');
console.log(fail ? '\nFAILED ' + fail : '\nALL CLOSERATE DIAG TESTS PASSED'); process.exit(fail ? 1 : 0);
