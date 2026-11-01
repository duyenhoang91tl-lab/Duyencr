#!/usr/bin/env node
// Test BAM O BAO CAO A/B -> XEM DON CHI TIET (js/59-report-drill.js + phan gop trong gas_v13.js). Chay ham GAS THAT voi du lieu gia roi dua qua cua so chi tiet (jsdom).
// Chay: NODE_PATH=<noi co jsdom> node tools/test-report-drill.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
// ── GAS ──
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(R('gas_v13.js'), ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __rows = [], __don = [];
  readDTTong_ = function() { return __rows; }; readDonChiTiet_ = function() { return __don; }; _mergeTachDon_ = function(r) { return r; };
  getSetting_ = function() { return null; };
  readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; }; _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: {}, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [], byPage: [] }; }; _pancakeKnownSaleNameSet_ = function() { return {}; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  readTeams_ = function() { return [{ id: 't1', name: 'Team Online', leader: '', members: ['anhtrinh1995', 'yenNTH2004'] }, { id: 't2', name: 'Phòng Kế toán', leader: '', members: ['menbui2002', 'phongketoan'] }]; };
  readMktTeams_ = function() { return [{ id: 'm1', name: 'MKT Hoa', pages: ['K1'] }]; }; readUsers_ = function() { return []; };
  _mktKenhWeights_ = function() { return { K1: [{ id: 'm1', name: 'MKT Hoa', w: 0.5 }, { id: 'm2', name: 'MKT Lan', w: 0.5 }] }; };
  readKPITargets_ = function() { return {}; }; readSaleDirectory_ = function() { return { list: [] }; };
`, ctx);

// ===== Bao cao B: phan chia CHINH XAC theo sale (bsx/bcx) de Excel doi chieu ke toan cong lai KHOP bang "Theo Sale" =====
const don = (day, sale, val, cod, phone) => ({ ngayTaoDon: day, trangThai: 'Hoàn thành', theSale: sale, soDienThoai: phone, nguonDon: 'Zalo', giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K' + phone.slice(-2), cod: cod, marketer: '', ghiChu: '' });
ctx.__rows = [];
ctx.__don = [don('05/10/2026', 'anhtrinh1995, menbui2002, yenNTH2004', 1000000, 100000, '0900000011'),   // chia 3 -> 333.333,33 (le)
              don('06/10/2026', 'anhtrinh1995', 500000, 0, '0900000012'),
              don('07/10/2026', '', 300000, 50000, '0900000013'),                                         // khong co sale -> (chua gan sale)
              don('08/10/2026', 'menbui2002, yenNTH2004', 900001, 1, '0900000014')];                     // chia 2 -> 450.000,5
const B = J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx));
const pairs = (o, f) => (o[f] || []);
const sumBy = (f, name) => B.orders.reduce((s, o) => s + pairs(o, f).filter(p => p[0] === name).reduce((t, p) => t + p[1], 0), 0);
ok(B.orders.length === 4 && B.orders.every(o => Array.isArray(o.bsx) && Array.isArray(o.bcx)), 'B: moi don co bsx (gia tri) va bcx (COD) theo tung sale');
ok(B.orders.every(o => o.bsx.every(p => Math.round(p[1] * 100) / 100 === p[1]) && o.bcx.every(p => Math.round(p[1] * 100) / 100 === p[1])), 'bsx/bcx lam tron toi da 2 chu so thap phan (khong lam tron nguyen)');
ok(B.bySale.length >= 3 && B.bySale.every(r => Math.abs(sumBy('bsx', r.name) - r.giaTri) < 0.05), 'B: cong bsx theo tung sale = cot "Gia tri" bang Theo Sale (sai so < 0,05 d)');
ok(B.bySale.every(r => Math.abs(sumBy('bcx', r.name) - r.cod) < 0.05), 'B: cong bcx theo tung sale = cot "COD" bang Theo Sale');
const allV = B.orders.reduce((s, o) => s + pairs(o, 'bsx').reduce((t, p) => t + p[1], 0), 0), allC = B.orders.reduce((s, o) => s + pairs(o, 'bcx').reduce((t, p) => t + p[1], 0), 0);
ok(Math.abs(allV - B.totalGiaTri) < 0.1 && Math.abs(allC - B.totalCod) < 0.1, 'B: tong moi dong chia (ke ca "(chua gan sale)") = Tong gia tri va Tong COD cua bao cao: ' + allV + ' / ' + B.totalGiaTri);
ok(B.orders[2].bsx.length === 1 && B.orders[2].bsx[0][0] === '(chưa gán sale)' && B.orders[2].bsx[0][1] === 300000 && B.orders[2].bcx[0][1] === 50000, 'don khong co sale -> 1 dong "(chua gan sale)" mang du gia tri + COD (bang Theo Sale an dong nay, Excel van liet ke)');
ok(B.orders[0].bsx.length === 3 && B.orders[0].bsx.every(p => p[1] === 333333.33) && B.orders[0].bcx.every(p => p[1] === 33333.33), 'don 3 sale: moi nguoi 333.333,33 / COD 33.333,33');
ok(B.orders[3].bsx.every(p => p[1] === 450000.5) , 'don 2 sale le: moi nguoi 450.000,5 (bs cu lam tron nguyen = 450.001 -> cong lai lech)');
ok(B.orders[3].bs.every(p => Number.isInteger(p[1])), 'bs cu van la so nguyen (cua so chi tiet khong doi)');
const Bf = J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31", sale: ["menbui2002"] })', ctx));
ok(Bf.orders.every(o => o.bsx.every(p => p[0] === 'menbui2002')) && Math.abs(Bf.orders.reduce((s, o) => s + o.bsx.reduce((t, p) => t + p[1], 0), 0) - Bf.bySale.find(r => r.name === 'menbui2002').giaTri) < 0.05, 'dang loc Sale: bsx chi con sale duoc chon va khop bang');
console.log(fails ? '\nFAILED ' + fails : '\nALL REPORT-B-EXPORT (GAS) TESTS PASSED'); process.exit(fails ? 1 : 0);
