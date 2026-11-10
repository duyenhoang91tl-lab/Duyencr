#!/usr/bin/env node
// Test splitFixList_ (admin: don ghep lech Pos-Base de chia tay). Chay: node tools/test-split-fixlist.js
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


const mkO = (ghi, the, giaPos, tong, shares, base, kh) => ({ ngayTaoDon: '05/10/2026', khachHang: kh || 'K', soDienThoai: '0900', theSale: the, ghiChu: ghi, giaTriPos: giaPos, giaTriSauGiam: tong, saleShares: shares, ghepBase: base });
const bo = (ma, sale, gt, tinh) => ({ ma, ngay: '2026-10-04', nguoiTao: 'x', saleBan: sale, giaTri: gt, trangThai: 'Hoàn thành', tinh: tinh !== false });
const ORDERS = [
  mkO('10T10/2026', 'An', 12000000, 12000000, [{ name: 'An', frac: 2 / 3 }, { name: 'Binh', frac: 1 / 3 }], [bo('10T10/2026', 'An', 10e6), bo('11T10/2026', 'Binh', 5e6)]),         // Base 15tr vs Pos 12tr: LECH
  mkO('20T10/2026', 'An, Binh', 8000000, 8000000, [{ name: 'An', frac: 0.5 }, { name: 'Binh', frac: 0.5 }], [bo('20T10/2026', 'An, Binh', 8e6)]),                                // khop tien + khop nguoi: KHONG hien
  mkO('30T10/2026', 'An', 6000000, 6000000, [{ name: 'Cuong', frac: 1 }], [bo('30T10/2026', 'Cuong', 6e6)]),                                                                       // dung tien nhung SALE khac the: LECH
  mkO('40T10/2026', 'An', 7000000, 7000000, [{ name: 'An', frac: 1 }], [bo('40T10/2026', 'An', 7000500)]),                                                                         // lech 500d <= 1000: KHONG hien
  mkO('50T10/2026', 'An', 5000000, 5000000, [{ name: 'An', frac: 1 }], [bo('50T10/2026', 'Binh', 5e6, false)]),                                                                    // goc Base bi loai: baseSum 0 -> lech tien 5tr
  { ngayTaoDon: '05/10/2026', theSale: 'An', ghiChu: '60T10', giaTriSauGiam: 1e6 }                                                                                                  // khong ghep Base: bo qua
];
vm.runInContext('buildSalesReportB_ = function() { return { orders: __ORD }; };', Object.assign(ctx, { __ORD: ORDERS }));
const call = (u, p) => J(vm.runInContext('splitFixList_(' + JSON.stringify(p || {}) + ', ' + JSON.stringify(u) + ')', ctx));
let r = call({ role: 'sale' });
ok(r.ok === false && r.code === 'AUTH', 'khong phai admin => tu choi');
r = call({ role: 'admin' }, { dateFrom: '2026-10-01', dateTo: '2026-10-31' });
const codes = r.rows.map(x => x.code);
ok(r.ok && r.total === 3 && codes.join() === '50T10/2026,10T10/2026,30T10/2026', 'chi hien don lech (50T10 goc Base bi loai lech 5tr, 10T10 lech 3tr, 30T10 lech nguoi) — xep theo |lech tien| giam dan: ' + codes.join());
const a = r.rows.find(x => x.code === '10T10/2026');
ok(a.posVal === 12000000 && a.baseSum === 15000000 && a.lechTien === 3000000 && a.base.length === 2 && a.the.join() === 'An', '10T10: Pos 12tr, Base 15tr, lech +3tr, the Pos = An, 2 don goc Base');
ok(a.current.find(x => x.name === 'An').tien === 8000000 && a.current.find(x => x.name === 'Binh').tien === 4000000, '10T10: chia hien tai An 8tr / Binh 4tr (theo ty le Base, tong = Pos)');
ok(r.rows.find(x => x.code === '30T10/2026').lechSale === true && r.rows.find(x => x.code === '30T10/2026').lechTien === 0, '30T10: dung tien nhung sale ban tren Base (Cuong) khac the Pos (An)');
r = call({ role: 'admin' }, { q: 'cuong' });
ok(r.total === 1 && r.rows[0].code === '30T10/2026', 'tim kiem theo ten sale Base');
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
