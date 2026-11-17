#!/usr/bin/env node
// Test js/86-pos-diag.js (DS KH KHOP DON POS, buoc 8): phan loai tung SDT. Chay: node tools/test-pos-diag.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const ctx = { console, Array, Object, String, Set, document: undefined, setTimeout() {}, fmtVND: v => v + 'd' }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(R('js/86-pos-diag.js'), ctx);
const B = 'biichnguyen1993', D = '2026-11-16';
const it = (phone, rev, excluded, raw) => ({ phone, rawPhone: raw || phone, name: 'K' + phone, the: B, sales: [B], rev, status: excluded ? 'Đã hoàn' : 'Mới', excluded: !!excluded });
const diag = { ok: true, date: D, orders: 7, phones: 6, revenue: 0, items: [it('0900000001', 1e6), it('0900000002', 2e6), it('0900000003', 3e6), it('0900000004', 4e6), it('0900000005', 5e6), it('0900000006', 6e6, true), it('', 7e6, false, '912345678')] };
const cust = [
  { phone: '0900000001', ymList: [{ ds: D }], csSet: new Set([B]) },                      // trong danh sach
  { phone: '0900000002', ymList: [{ ds: D }], csSet: new Set([B]) },                      // co du nhung bi loc khac
  { phone: '0900000003', ymList: [], csSet: new Set([B]) },                                 // thieu ngay
  { phone: '0900000004', ymList: [{ ds: D }], csSet: new Set(['ninhnga99']) },             // thieu CS
  { phone: '0900000006', ymList: [], csSet: new Set() },
];
const r = ctx.khDiagClassify_(diag, cust, [{ phone: '0900000001' }], B, null);
const w = p => r.rows.find(x => x.phone === p).why;
ok(w('0900000001') === 'OK', 'khach trong danh sach -> OK');
ok(w('0900000002') === 'HIDDEN', 'du khach+CS+ngay nhung khong hien -> D bi bo loc khac');
ok(w('0900000003') === 'NO_DAY', 'khach khong co ngay don -> B');
ok(w('0900000004') === 'NO_CS', 'CS khong nam trong csSet -> C');
ok(w('0900000005') === 'NO_CUST', 'SDT khong co khach -> A');
ok(w('0900000006') === 'EXCL', 'chi co don Huy/Hoan -> loai');
ok(r.rows.find(x => x.phone === '912345678').why === 'NO_CUST', 'SDT khong chuan hoa duoc -> A, hien SDT tho');
ok(r.rows[r.rows.length - 1].why === 'OK' || r.rows.every(x => x.why !== 'OK' || r.rows.indexOf(x) >= r.rows.filter(y => y.why !== 'OK').length), 'dong OK xep cuoi');
ok(r.summary.OK === 1 && r.summary.NO_CUST === 2, 'tong ket dung');
// alias: csSet chua ten khac cung nguoi
const r2 = ctx.khDiagClassify_(diag, [{ phone: '0900000004', ymList: [{ ds: D }], csSet: new Set(['thuydinh95']) }], [], 'Thuydinh1995', s => ['thuydinh95']);
ok(r2.rows.find(x => x.phone === '0900000004').why === 'HIDDEN', 'alias cung nguoi coi la khop CS');
ok(/Doi soat|ĐỐI SOÁT POS 2026-11-16/.test(ctx.khDiagText_(r)) && ctx.khDiagText_(r).split('\n').length === r.rows.length + 3, 'text copy: 3 dong dau + moi SDT 1 dong');
const idx = R('index.html'); ok(idx.indexOf('js/85-kh-sb-toggle') < idx.indexOf('js/86-pos-diag.js') && idx.indexOf('js/86-pos-diag.js') < idx.indexOf('js/88-pos-orders.js'), 'js/86 nap giua js/85 va js/88');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA DAT'); process.exit(fails ? 1 : 0);
