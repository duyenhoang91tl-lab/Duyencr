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
// T11 cau hinh: KPI 8,5 ty, FB 1,5 ty, con lai 7 ty; 15 sale cam ket
r = run([], '2026-11');
ok(r.cfg.kpiTotal - r.cfg.kpiFb === 7e9 && r.rows.length === 15 && r.rows.reduce((s, x) => s + x.commit, 0) === 9.9e9, 'T11: con lai 7 ty, 15 sale, tong cam ket 9,9 ty');
ok(r.fb.penalty === 1500000 * 0.0 + Math.round(1.5e9 * 0.00025) && r.rest.penalty === Math.round(7e9 * 0.00025), 'T11 khong co don: 0% -> phat 0,025% tren 1,5 ty va 7 ty');
if (process.argv[2]) { // doi chieu voi bang tinh T10 (Phat_thi_dua_T10_2026.xlsx)
  // 24 dong cuoi sheet DON PT trong file KT (phan sale 30% cua don quay) khong co ngay, khong co trong Pos/CRM -> bang tinh T10 co tinh, nen gan ngay T10 de doi chieu dung bang tinh
  const ords = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(x => x.sheet === 'ĐƠN PT').map(x => /^\d\d\/\d\d\/\d{4}/.test(x.ngayTao) ? x : { ...x, ngayTao: '15/10/2026' });
  const R = run(ords, '2026-10');
  ok(R.fb.penalty === 280000 && R.rest.penalty === 1200000 && Math.abs(R.totals.total - 1480000) <= 20 && R.nRest === 17 && R.nFb === 6, 'DOI CHIEU T10 that: FB 280.000 + con lai 1.200.000 = 1.480.000 (17 + 6 dau nguoi, Men chi tinh kenh FB; lech <=20d do lam tron tung nguoi)');
  console.log('   nFb',R.nFb,'nRest',R.nRest,'fbPen',R.fb.penalty,'restPen',R.rest.penalty,'tot',R.totals.total,'ok:',R.rows.filter(x=>x.ok).map(x=>x.user).join()); console.log('   FB', Math.round(R.fb.rev), (R.fb.pct * 100).toFixed(1) + '%', '| con lai', Math.round(R.rest.rev), (R.rest.pct * 100).toFixed(1) + '%');
}
console.log(bad ? bad + ' LOI' : 'TAT CA DAT'); process.exit(bad ? 1 : 0);
