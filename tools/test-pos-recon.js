#!/usr/bin/env node
// Test js/92-pos-recon.js (DS KH KHOP DON POS, buoc 6/7). Chay: node tools/test-pos-recon.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const B = 'biichnguyen1993';
const mkRows = (rev, sales) => [{ ds: '2026-11-16', name: 'K', sales: sales || [B], rev, shares: (sales || [B]).map(s => [s, rev / (sales || [B]).length]) }];
const by = {}; for (let i = 0; i < 9; i++) by['09000000' + i] = mkRows(1000000 * (i + 1), i % 2 ? [B, 'x'] : [B]);
by['0911111111'] = [{ ds: '2026-10-01', name: 'cu', sales: [B], rev: 5, shares: [[B, 5]] }];   // ngoai khoang
by['0922222222'] = mkRows(7, ['ninhnga99']);   // sale khac
const els = {}; const bar = { style: {}, innerHTML: '', addEventListener() {} };
const tb = { parentNode: { insertBefore(n) { els.bar = n; } }, nextSibling: null };
const ctx = { console, Array, Object, String, fmtVND: v => v + 'd', document: { getElementById: id => (id === 'pos-recon-bar' ? (els.bar || null) : (id in ctx.dom ? { value: ctx.dom[id] } : null)), querySelector: () => tb, createElement: () => bar },
  dom: {}, allCustomers: [], posOrders: { loadedAt: 1, skipped: { noPhone: 2, noPhoneRev: 300000, noDate: 0, noDateRev: 0 } }, posOrdersByPhone: by, _csFilterListMatch: () => ctx.cs, cs: [B],
  applyFilters() {}, posOrdersOnChange_() {} };
ctx.allCustomers = Object.keys(by).map(p => ({ phone: p }));
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(R('js/91-pos-revenue.js'), ctx); vm.runInContext(R('js/92-pos-recon.js'), ctx);
const ph = i => '09000000' + i;
// 1) hien du 9 khach -> khop
ctx.__omeFiltered = Object.keys(by).filter(p => p.startsWith('0900')).map(p => ({ phone: p }));
let r = ctx.posReconCompute_(by, ctx.__omeFiltered, { [ph(0)]: 1 }, '2026-11-16', '2026-11-16', [B], ctx.posRevView_);
ok(r.cust === 9 && r.missing.length === 0 && r.inCust === 9, '9 khach POS cua B ngay 16/11, danh sach du -> khop');
// 2) thieu 2 khach (3 khach nhu CRM cu: bo 6)
r = ctx.posReconCompute_(by, ctx.__omeFiltered.slice(0, 3), { [ph(3)]: 1 }, '2026-11-16', '2026-11-16', [B], ctx.posRevView_);
ok(r.missing.length === 6 && r.cust === 9, 'danh sach chi 3 khach -> bao thieu 6');
ok(r.missing.find(m => m.phone === ph(3)).why === 'bị bộ lọc khác' && r.missing.find(m => m.phone === ph(4)).why === 'chưa có khách', 'ly do: bi loc khac vs chua co khach');
ok(r.missing[0].rev >= r.missing[r.missing.length - 1].rev, 'sap xep theo tien giam dan');
// 3) chia the chung: tien thieu tinh theo phan cua B, khong nguyen don
const m1 = r.missing.find(m => m.phone === ph(3)); ok(m1.rev === 2000000, 'khach 3 (don 4tr, the chung 2 sale) phan cua B = 2tr');
// 4) render thanh
ctx.dom = { 'ymf-date-from': '2026-11-16', 'ymf-date-to': '2026-11-16' }; ctx.cs = [B];
ctx.__omeFiltered = ctx.__omeFiltered.slice(0, 3);
vm.runInContext('applyFilters()', ctx);
ok(/Lệch POS/.test(bar.innerHTML) && /thiếu 6 \/ 9/.test(bar.innerHTML) && /2 đơn không có SĐT/.test(bar.innerHTML), 'thanh bao lech 6/9 + ghi chu don khong SDT');
ctx.__omeFiltered = Object.keys(by).filter(p => p.startsWith('0900')).map(p => ({ phone: p }));
vm.runInContext('applyFilters()', ctx);
ok(/Khớp POS/.test(bar.innerHTML) && /9 khách/.test(bar.innerHTML), 'du khach -> Khop POS 9 khach');
// 5) khong loc / chua tai POS -> an
ctx.dom = {}; ctx.cs = []; vm.runInContext('applyFilters()', ctx); ok(bar.style.display === 'none', 'khong loc -> an thanh');
ctx.dom = { 'ymf-date-from': '2026-11-16' }; ctx.posOrders = { loadedAt: 0 }; vm.runInContext('applyFilters()', ctx); ok(bar.style.display === 'none', 'chua tai POS -> an thanh');
const idx = R('index.html'); ok(idx.indexOf('js/91-pos-revenue.js') < idx.indexOf('js/92-pos-recon.js') && idx.indexOf('js/92-pos-recon.js') > 0, 'js/92 nap SAU js/91');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA DAT'); process.exit(fails ? 1 : 0);
