#!/usr/bin/env node
// Test js/91-pos-revenue.js (DS KH KHOP DON POS, buoc 5/7): DT + so don theo don POS dang loc. Chay: node tools/test-pos-revenue.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const B = 'biichnguyen1993';
const rows = [
  { ds: '2026-11-16', sales: [B], rev: 6000000, shares: [[B, 6000000]] },
  { ds: '2026-11-16', sales: [B, 'ninhnga99', 'thuydinh95'], rev: 3000000, shares: [[B, 1000000], ['ninhnga99', 1000000], ['thuydinh95', 1000000]] },
  { ds: '2026-10-01', sales: [B], rev: 500000, shares: [[B, 500000]] },
  { ds: '2026-11-17', sales: ['ninhnga99'], rev: 2000000, shares: [['ninhnga99', 2000000]] },
  { ds: '2026-11-18', sales: [B, 'x'], rev: 800000, shares: [] },   // khong co shares -> chia deu
];
const by = { '0900000001': rows };
const customers = [{ phone: '0900000001', totalOrders: 5, totalRevenue: 12300000 }, { phone: '0900000002', totalOrders: 1, totalRevenue: 100 }];
let called = 0; const ctx = { console, document: { getElementById: id => (id in ctx.dom ? { value: ctx.dom[id] } : null) }, dom: {}, allCustomers: customers,
  posOrders: { loadedAt: 1 }, posOrdersByPhone: by, fmtVND: v => v + 'd', _custRev_: c => (c === customers[0] ? 12300000 : 100), _custOrderCount_: c => (c === customers[0] ? 5 : 1),
  _csFilterListMatch: () => ctx.cs, cs: [], applyFilters: function () { called++; } };
ctx.posOrdersOnChange_ = fn => { ctx._chg = fn; };
vm.createContext(ctx); vm.runInContext(R('js/91-pos-revenue.js'), ctx);
const V = (a, f, t, cs) => ctx.posRevView_(a, f, t, cs);
let v = V(rows, '2026-11-16', '2026-11-16', [B]);
ok(v.n === 2 && v.rev === 7000000, 'B ngay 16/11: 2 don, 6tr + 1tr (phan chia the chung) = 7tr');
v = V(rows, '2026-11-16', '2026-11-16', []);
ok(v.n === 2 && v.rev === 9000000, 'khong loc CS: ca 2 don nguyen gia 9tr');
v = V(rows, '', '', [B]);
ok(v.n === 4 && v.rev === 6000000 + 1000000 + 500000 + 400000, 'khong loc ngay, loc B: gom ca don cu + don khong shares chia deu (400k)');
v = V(rows, '2026-11-16', '2026-11-16', ['NINHNGA99']);
ok(v.n === 1 && v.rev === 1000000, 'CS viet hoa/thuong khac van khop');
v = V(rows, '2026-12-01', '2026-12-31', [B]);
ok(v.n === 0 && v.rev === 0, 'ngoai khoang -> 0');
// boc applyFilters
ctx.dom = { 'ymf-date-from': '2026-11-16', 'ymf-date-to': '2026-11-16' }; ctx.cs = [B];
vm.runInContext('applyFilters()', ctx);
ok(called === 1, 'goi ham goc 1 lan');
const c0 = customers[0];
ok(c0.totalOrders === 2 && c0.totalRevenue === 7000000 && c0.posLife.n === 5 && c0.posLife.rev === 12300000, 'dang loc: totalRevenue = muc 2 (de sap xep/KPI), posLife = ca doi');
ok(customers[1].totalRevenue === 0 && customers[1].totalOrders === 0, 'khach khong co don POS trong khoang -> 0 (khong de so ca doi)');
const html = ctx.posRevCellHtml_(c0);
ok(/5<\/span>.*12300000d/.test(html) && /2 đơn \/ 7000000d/.test(html) && /biichnguyen1993/.test(html), 'o hien dong 1 = ca doi, dong 2 = muc 2 co ten CS');
// bo loc -> tra ve ca doi
ctx.dom = {}; ctx.cs = [];
vm.runInContext('applyFilters()', ctx);
ok(c0.totalOrders === 5 && c0.totalRevenue === 12300000 && !c0.posView && ctx.posRevCellHtml_(c0) === '', 'bo loc: tra ve ca doi, xoa posView, o in nhu cu');
ok(customers[1].totalRevenue === 100, 'khach 2 tra ve ca doi');
// chua tai POS -> khong dong
ctx.posOrders = { loadedAt: 0 }; ctx.dom = { 'ymf-date-from': '2026-11-16' };
vm.runInContext('applyFilters()', ctx);
ok(c0.totalRevenue === 12300000, 'chua tai POS -> khong doi so');
// hook trong js/02 + index
const j02 = R('js/02-fn-showrowerrorbanner.js');
ok(/typeof posRevCellHtml_==='function' && posRevCellHtml_\(c\)/.test(j02), 'js/02 goi posRevCellHtml_ (guard typeof)');
const idx = R('index.html'); const a = idx.indexOf('js/90-pos-filter.js'), b = idx.indexOf('js/91-pos-revenue.js');
ok(a > 0 && b > a, 'js/91 nap SAU js/90');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA DAT'); process.exit(fails ? 1 : 0);
