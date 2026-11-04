#!/usr/bin/env node
// Test "Thi dua thang" (js/64-thidua.js). Chay: node tools/test-thidua.js [orders.json]  (tham so tuy chon: orders.json that cua tools/bonus-t10 de doi chieu bang tinh T10)
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const j64 = fs.readFileSync(__dirname + '/../js/64-thidua.js', 'utf8'), j12 = fs.readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
const m = j12.match(/function _ddmmyyyyToYmd_\(s\)\{[\s\S]*?\n\}\n/); ok(!!m, 'tim thay _ddmmyyyyToYmd_ that');
const ctx = vm.createContext({ _orderRevenueShares_: o => { const ns = [...new Set(String(o.saleBan || '').split(/[,;]/).map(s => s.trim()).filter(Boolean))]; return ns.map(n => ({ name: n, share: (Number(o.giaTriDon) || 0) / ns.length })); } });
vm.runInContext(m[0] + '\n' + j64, ctx);
const run = (os, ym) => vm.runInContext('(function(o,y){return _computeThiDua_(o,y);})', ctx)(os, ym);
ok(run([], '2026-09') === null, 'thang chua cau hinh -> null');
// Ca nho T10: FB 1,4 ty. 1 don FB 700tr (50%) -> phat 0,025% x 1,4 ty = 350.000, chia 4 sale FB + Men (chi tinh FB) + Duyen = 6 nguoi = 58.333
const o = (id, sale, nguon, v) => ({ id, saleBan: sale, nguonDon: nguon, giaTriDon: v, ngayTao: '10/10/2026', baoHanh: false });
let r = run([o(1, 'ninhnga99', 'Fb Phạm Thu Hiền', 700e6), o(2, 'anhtrinh1995, thuydinh95', 'Zalo', 3000e6), o(3, 'anhtrinh1995', 'Zalo', 1e9), { ...o(4, 'haPTN', 'Zalo', 5e9), baoHanh: true }, { ...o(5, 'haPTN', 'Zalo', 5e9), ngayTao: '30/09/2026' }], '2026-10');
const g = u => r.rows.find(x => x.user === u);
ok(r.fb.rev === 700e6 && Math.abs(r.fb.pct - 0.5) < 1e-9 && r.fb.penalty === 350000, 'kenh FB: 700tr/1,4ty = 50% -> phat 350.000');
ok(r.nFb === 6 && r.perFb === 58333 && g('ninhnga99').penFb === 58333 && g('menbui2002').penFb === 58333 && g('menbui2002').penRest === 0 && g('menbui2002').ok && r.duyen.penFb === 58333 && g('anhtrinh1995').penFb === 0, 'chia phat FB 6 dau nguoi (4 sale + Men + Duyen) = 58.333; Men khong dinh phat phan con lai');
ok(r.rest.rev === 4e9 && r.rest.kpi === 8e9 && r.rest.penalty === 2000000, 'phan con lai: 4 ty/8 ty = 50% -> phat 0,025% x 8 ty = 2.000.000 (bao hanh + thang khac bi bo)');
ok(g('anhtrinh1995').rev === 2.5e9 && g('anhtrinh1995').ok && g('anhtrinh1995').penRest === 0, 'sale dat cam ket 100% khong bi phat');
ok(g('thuydinh95').rev === 1.5e9 && g('thuydinh95').ok, 'don 2 sale chia deu (1,5 ty moi nguoi)');
ok(r.nRest === 16 + 1 && r.rows.filter(x => !x.ok).length === 16, '16 sale chua dat + Duyen = 17 nguoi chia');
ok(Math.abs(g('ninhnga99').penRest - 2000000 / 17) <= 1 && g('ninhnga99').total === 58333 + g('ninhnga99').penRest, 'tong phat 1 sale = FB + phan con lai');
// Bien: dung 90% -> 0,015% ; 100% -> 0
const mk = v => run([o(1, 'ninhnga99', 'Facebook Phạm Thu Hiền', v)], '2026-10').fb;
{ const rm = run([o(1, 'menbui2002', 'Fb Phạm Thu Hiền', 100e6), o(2, 'menbui2002', 'Zalo', 400e6), o(3, 'anhtrinh1995', 'Zalo', 200e6)], '2026-10'); const m = rm.rows.find(x => x.user === 'menbui2002');
  ok(m.rev === 100e6 && m.revFb === 100e6 && rm.rest.rev === 200e6 && rm.fb.rev === 100e6 && m.penRest === 0, 'Men chi tinh don kenh FB: don Zalo 400tr cua Men bi loai khoi doanh thu (con lai chi 200tr cua sale khac)'); }
ok(mk(1.26e9).rate === 0.00015 && mk(1.4e9).penalty === 0 && mk(1.4e9).bonus === 700000 && mk(1.3e9).rate === 0.00005, 'moc 90% -> 0,015%; 100% -> khong phat (thuong 700.000); 92,9% -> 0,005%');
// T11 (Duyen chot 2026-11-04): FB 1,5 ty + CSKH-Duyen 100tr (chua xac dinh cach tinh DT) + Duyen&MKT 6,9 ty; Men chia phat FB; Huy 6 ty & Hung 900tr la 2 kenh rieng
r = run([], '2026-11');
ok(r.rest.kpi === 6.9e9 && r.fb.kpi === 1.5e9 && r.cskh.kpi === 1e8 && r.rows.length === 16 && r.rows.reduce((s, x) => s + x.commit, 0) === 9.9e9, 'T11: KPI 1,5 + 0,1 + 6,9 = 8,5 ty; 15 sale + Men; tong cam ket 9,9 ty');
ok(r.cskh.pending === false && r.cskh.rev === 0 && r.cskh.penalty === 25000 && r.perCs === Math.round(25000 / 16), 'kenh CSKH-Duyen 100tr: chua co don -> 0% -> phat 0,025% x 100tr = 25.000 chia 15 sale + Duyen = 16 nguoi (khong gom Men)');
const o2 = (id, sale, nguon, v, mk) => ({ id, saleBan: sale, nguonDon: nguon, giaTriDon: v, ngayTao: '12/11/2026', baoHanh: false, marketer: mk });
r = run([o2(1, 'menbui2002', 'Fb Phạm Thu Hiền', 750e6), o2(2, 'ninhnga99', 'Facebook / Hiền Tour (1)', 3e9, 'Ngô Việt Huy'), o2(3, 'anhtrinh1995', 'Zalo', 450e6, 'Nguyễn Văn Hưng')], '2026-11');
ok(r.fb.rev === 750e6 && r.fb.penalty === 375000 && r.nFb === 6 && r.perFb === 62500, 'T11 FB: 750tr/1,5ty = 50% -> 375.000 chia 6 (4 sale FB chinh + Men + Duyen) = 62.500');
const gm = r.rows.find(x => x.user === 'menbui2002'); ok(gm.penFb === 62500 && gm.penRest === 0 && gm.ok && r.nRest === 14 + 1, 'Men: chia phat FB, khong xet cam ket, khong chia phan Duyen+MKT');
ok(r.rest.rev === 3.45e9 && r.rest.kpi === 6.9e9 && r.rest.penalty === 1725000, 'T11 Duyen+MKT: 3,45 ty/6,9 ty = 50% -> 0,025% x 6,9 ty = 1.725.000');
const huy = r.marketing[0], hung = r.marketing[1];
ok(huy.name === 'Ngô Việt Huy' && huy.rev === 3e9 && huy.penalty === 1500000 && hung.rev === 450e6 && hung.penalty === 225000 && huy.orders === 1, 'Huy 6 ty: 3 ty (50%) phat 1.500.000; Hung 900tr: 450tr phat 225.000 (kenh rieng theo cot Marketer)');
// Kenh CSKH-Duyen = phan don NGOAI FB cua Men; phat chia Duyen + sale chua dat (KHONG gom Men)
r = run([o2(4, 'menbui2002', 'Zalo / ZALO CSKH UP MỚI (1)', 50e6), o2(5, 'anhtrinh1995', 'Zalo', 450e6), o2(6, 'menbui2002, anhtrinh1995', 'Zalo', 100e6)], '2026-11');
const mm = r.rows.find(x => x.user === 'menbui2002'), aa = r.rows.find(x => x.user === 'anhtrinh1995'), nn = r.rows.find(x => x.user === 'ninhnga99');
ok(r.cskh.rev === 100e6 && r.cskh.pct === 1 && r.cskh.penalty === 0 && r.rest.rev === 500e6, 'CSKH-Duyen: Men 50tr + phan Men 50tr (don chia voi sale) = 100tr = 100% -> khong phat; phan cua sale (50tr) + 450tr van vao Duyen+MKT');
ok(mm.rev === 0 && mm.penCskh === 0 && mm.penRest === 0 && mm.ok, 'Men khong chiu phat CSKH / Duyen+MKT, don ngoai FB khong tinh vao doanh thu ca nhan');
r = run([o2(4, 'menbui2002', 'Zalo', 50e6)], '2026-11');   // 50% -> 25.000 chia 16 = 1.563
ok(r.cskh.penalty === 25000 && r.perCs === 1563 && r.rows.find(x => x.user === 'ninhnga99').penCskh === 1563 && r.duyen.penCskh === 1563 && r.rows.find(x => x.user === 'menbui2002').penCskh === 0 && Math.abs(r.totals.penCskh - 25000) <= 20, 'CSKH-Duyen 50%: 25.000 chia Duyen + 15 sale chua dat (1.563/nguoi), Men 0');
const ex = vm.runInContext('(function(o,y){return _tdExportRows_(_computeThiDua_(o,y));})', ctx)([], '2026-11');
ok(ex.kenh.length === 1 + 5 && ex.sale.length === 1 + 16 + 2 && ex.kenh.every(x => x.length === ex.kenh[0].length) && ex.sale.every(x => x.length === ex.sale[0].length), 'xuat Excel: 5 kenh (FB, Duyen+MKT, CSKH, Huy, Hung), 16 sale + Duyen + Tong, so cot deu');
// Render HTML khong loi (stub esc/_srMoney/_srState) + nut Xuat Excel
Object.assign(ctx, { esc: s => String(s), _srMoney: n => Math.round(n || 0).toLocaleString('en-US') + 'd', _srState: { eDateFrom: '2026-11-01', eDateTo: '2026-11-30' } });
const html = vm.runInContext('(function(d){return _srThiDuaSectionHtml_(d);})', ctx)({ orders: [o2(1, 'menbui2002', 'Fb Phạm Thu Hiền', 750e6)] });
ok(/Xuất Excel thi đua/.test(html) && /Ngô Việt Huy/.test(html) && /Bùi Mến/.test(html) && /Duyên/.test(html) && !/undefined|NaN/.test(html), 'render muc thi dua: co nut Xuat Excel, Huy, Men, Duyen; khong undefined/NaN');
ctx._srState.eDateTo = '2026-09-30'; ok(vm.runInContext('_srThiDuaSectionHtml_({orders:[]})', ctx) === '', 'thang chua cau hinh -> khong hien muc');
if (process.argv[2]) { // doi chieu voi bang tinh T10 (Phat_thi_dua_T10_2026.xlsx)
  // 24 dong cuoi sheet DON PT trong file KT (phan sale 30% cua don quay) khong co ngay, khong co trong Pos/CRM -> bang tinh T10 co tinh, nen gan ngay T10 de doi chieu dung bang tinh
  const ords = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(x => x.sheet === 'ĐƠN PT').map(x => /^\d\d\/\d\d\/\d{4}/.test(x.ngayTao) ? x : { ...x, ngayTao: '15/10/2026' });
  const R = run(ords, '2026-10');
  ok(R.fb.penalty === 280000 && R.rest.penalty === 1200000 && Math.abs(R.totals.total - 1480000) <= 20 && R.nRest === 17 && R.nFb === 6, 'DOI CHIEU T10 that: FB 280.000 + con lai 1.200.000 = 1.480.000 (17 + 6 dau nguoi, Men chi tinh kenh FB; lech <=20d do lam tron tung nguoi)');
  console.log('   nFb',R.nFb,'nRest',R.nRest,'fbPen',R.fb.penalty,'restPen',R.rest.penalty,'tot',R.totals.total,'ok:',R.rows.filter(x=>x.ok).map(x=>x.user).join()); console.log('   FB', Math.round(R.fb.rev), (R.fb.pct * 100).toFixed(1) + '%', '| con lai', Math.round(R.rest.rev), (R.rest.pct * 100).toFixed(1) + '%');
}
console.log(bad ? bad + ' LOI' : 'TAT CA DAT'); process.exit(bad ? 1 : 0);
