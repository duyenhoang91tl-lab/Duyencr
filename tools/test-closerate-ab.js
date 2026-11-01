#!/usr/bin/env node
// Test: Bao cao B (Pos) phai AN Sale/Kenh bi an theo cai dat admin (vd Dung1987 da nghi) — truoc day chi A va Pancake kiem.
// (Ty le chot A = B do ham dung chung _srCloseRateSectionsFromBase_; quy tac don BH khong doanh thu nam o do va co test rieng.)
// Chay HAM THAT trong gas_v13.js voi doc sheet gia lap:  node tools/test-closerate-ab.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + '\n  co :' + JSON.stringify(a) + '\n  can:' + JSON.stringify(b));

// 1) _donHiddenChecker_: an theo NGUOI (moi ten cung 1 nguoi), an kenh theo ID Page / TEN Page
function makeCtx(o) {
  const settings = { hiddenSales: JSON.stringify(o.hiddenSales || []), hiddenChannels: JSON.stringify(o.hiddenChannels || []) };
  const ctx = { Logger: { log() {} }, getSetting_: (k) => settings[k] || '', _userAliasGroups_: () => o.userGroups || {}, readSaleDirectory_: () => ({ list: [] }), readPancakeMap_: () => ({}),
    readPancakePageMap_: () => o.pageById || {}, readPancakePageMapByName_: () => o.pageByName || {} };
  vm.createContext(ctx);
  ['_normTxt_', '_stripVN_', '_foldSaleKey_', '_salePersonKeyFn_', '_salePersonIdentity_', '_salePersonKeyWithOrphanFold_', '_psheetNoAccent_', '_hiddenPageSaleSets_', '_donHiddenChecker_', '_donKenhFromNguon_',
   '_extractPageIdFromNguonDon_', '_extractPageNameFromNguonDon_'].forEach((n) => { try { vm.runInContext(grab(n), ctx); } catch (e) { if (!/khong thay ham/.test(e.message)) throw e; } });
  return ctx;
}
let C = makeCtx({ hiddenSales: ['Dung1987'], hiddenChannels: ['K9'], userGroups: { dung1987: ['dung1987', 'dungnguyen87'], dungnguyen87: ['dung1987', 'dungnguyen87'] }, pageById: { '123': 'K9', '456': 'K1' }, pageByName: { 'page khac': 'K9' } });
const H = vm.runInContext('_donHiddenChecker_()', C);
ok(H, 'co cai dat an thi tra ve checker');
ok(H.saleHidden('Dung1987') && H.saleHidden('dung1987') && H.saleHidden('dungnguyen87'), 'an theo NGUOI: moi ten cua Dung1987 (ke ca ten Pos khac) deu bi an');
ok(!H.saleHidden('ninhnga99'), 'sale khac khong bi an');
ok(H.channelHidden('Facebook / Page A (123)') && !H.channelHidden('Facebook / Page B (456)') && H.channelHidden('Facebook / Page Khac'), 'an kenh theo ID Page va theo TEN Page');
ok(vm.runInContext('_donHiddenChecker_()', makeCtx({})) === null, 'khong an gi -> null (khong ton chi phi)');

// 2) TICH HOP: chay Bao cao B THAT (nap nguyen gas_v13.js, chi gia lap phan doc sheet)
(function integration() {
  const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
  const svc = () => new Proxy(function () {}, handler);
  const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
    DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
  const mk = (ngay, sale, gia, kh) => ({ ngayTaoDon: ngay, khachHang: kh, soDienThoai: '09' + kh, nguonDon: 'Pancake', theSale: sale, trangThai: 'Hoàn thành', sanPham: 'SP', maSanPham: 'M1', soLuong: '1', giaTriSauGiam: gia, cod: 0, marketer: 'M', ghiChu: '' });
  ctx.__DON = [mk('05/10/2026', 'Dung1987', 1000000, '01'), mk('05/10/2026', 'Dung1987, ninhnga99', 2000000, '02'), mk('06/10/2026', 'ninhnga99', 3000000, '03')];
  ctx.__hidden = ['Dung1987'];
  vm.runInContext(`
    readDonChiTiet_ = function() { return __DON.map(function(r) { return Object.assign({}, r); }); };
    getCrmSS_ = function() { return { getSheetByName: function() { return null; } }; };
    readTeams_ = function() { return []; }; readPancakeMap_ = function() { return {}; }; readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; };
    _pancakeKnownSaleNameSet_ = function() { return {}; }; _userAliasGroups_ = function() { return {}; }; readSaleDirectory_ = function() { return { list: [] }; };
    _hiddenPageSaleSets_ = function() { return { channels: [], sales: __hidden }; };
    _srCloseRateSectionsFromBase_ = function() { return { saleCloseRate: [], closeFrom: '', kenhCloseRate: [], saleCloseByPage: [] }; };
    var ARCHIVE_APPLY_ENABLED_ = false;`, ctx);
  const f = { dateFrom: '2026-10-01', dateTo: '2026-10-31', sale: [], nguon: [], marketer: [], sanPham: '', careStatus: [], khStatus: [], zaloStatus: [], nickZalo: '' };
  let r = ctx.buildSalesReportB_(f);
  eq(r.totalOrders, 2, 'B: don chi co Dung1987 (da an) bi loai, con 2 don (don co ca ninhnga99 van giu)');
  ok(r.bySale.map((x) => x.name).indexOf('ninhnga99') >= 0, 'B van co ninhnga99');
  vm.runInContext('__hidden = [];', ctx); r = ctx.buildSalesReportB_(f);
  eq(r.totalOrders, 3, 'bo an -> B hien du 3 don'); ok(r.bySale.map((x) => x.name).indexOf('Dung1987') >= 0, 'bo an -> Dung1987 hien lai');
})();
console.log('ALL CLOSERATE A/B TESTS PASSED');
