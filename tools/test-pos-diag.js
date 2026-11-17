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
// probe: dong D kem dieu kien nao loai khach + dong "Bo loc dang bat"
{
  const ctx2 = { console, Array, Object, String, Set, document: { getElementById: id => (id === 'ymf-hour-from' ? { value: '' } : null) }, setTimeout() {}, fmtVND: v => v + 'd',
    currentTier: 'vip', currentCare: 'all', currentZalo: 'all', currentBuy: 'all', colFilters: { tier: new Set(), care: new Set(['Đã mua']) }, advFilters: {}, currentCF: {}, _inUserScope: () => true };
  ctx2.window = ctx2; vm.createContext(ctx2); vm.runInContext(R('js/86-pos-diag.js'), ctx2);
  const c = { phone: '0900000002', tier: 'normal', careStatus: 'Mới', zaloStatus: '', ymList: [{ ds: D }], csSet: new Set([B]) };
  const pr = ctx2.khDiagProbe_(c);
  ok(/LOẠI BỞI: tier,cột\.care/.test(pr), 'probe: tier + cot care loai khach -> ' + pr);
  ok(/tier=vip/.test(ctx2.khDiagFilters_()) && /cột\.care\(1\)/.test(ctx2.khDiagFilters_()), 'khDiagFilters_ liet ke tier + cot.care');
  const rr = ctx2.khDiagClassify_(diag, [c], [], B, null, ctx2.khDiagProbe_);
  const row = rr.rows.find(x => x.phone === '0900000002');
  ok(row.why === 'HIDDEN' && /LOẠI BỞI/.test(row.probe), 'dong HIDDEN mang probe');
  rr.filters = ctx2.khDiagFilters_();
  ok(/Bộ lọc đang bật: tier=vip/.test(ctx2.khDiagText_(rr)) && /\{LOẠI BỞI/.test(ctx2.khDiagText_(rr)), 'text copy co dong bo loc + probe');
}
const idx = R('index.html'); ok(idx.indexOf('js/85-kh-sb-toggle') < idx.indexOf('js/86-pos-diag.js') && idx.indexOf('js/86-pos-diag.js') < idx.indexOf('js/88-pos-orders.js'), 'js/86 nap giua js/85 va js/88');
// LOI THAT 17/11 (C Trang): khach da co san, khong co don Base ngay 16/11 nhung CLIENT DANG GIU don POS ngay do -> khong duoc bao nham la "B khong co ngay"
ctx.posOrdersByPhone = { '0387099422': [{ ds: D, sales: [B, 'thuyha88'], rev: 2200000 }] };
const diagT = { ok: true, date: D, orders: 1, phones: 1, revenue: 2200000, items: [it('0387099422', 2200000)] };
const rT = ctx.khDiagClassify_(diagT, [{ phone: '0387099422', ymList: [], csSet: new Set([B, 'thuyha88']) }], [], B, null);
ok(rT.rows[0].why === 'HIDDEN' && rT.rows[0].posRows === 1, 'co don POS dung ngay o client (ymList rong) -> D (khong con bao nham la B), kem so don POS client giu');
ok(/client giữ 1 đơn POS/.test(ctx.khDiagText_(rT)), 'text copy ghi so don POS client dang giu cho SDT');
ctx.posOrdersByPhone = {};
const rT2 = ctx.khDiagClassify_(diagT, [{ phone: '0387099422', ymList: [], csSet: new Set([B]) }], [], B, null);
ok(rT2.rows[0].why === 'NO_DAY' && rT2.rows[0].posRows === 0, 'client KHONG giu don POS nao + khong co don Base ngay do -> van la B');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA DAT'); process.exit(fails ? 1 : 0);
