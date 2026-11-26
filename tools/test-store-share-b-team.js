#!/usr/bin/env node
// Test gop PHAN SALE 30% DON QUAY vao Bao cao B "Theo Team Sale" (js/63 _srMergeStoreIntoByTeam_). Chay: node tools/test-store-share-b-team.js
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const ctx = vm.createContext({}); vm.runInContext(fs.readFileSync(__dirname + '/../js/63-fn-saleincome.js', 'utf8'), ctx);
const M = (b, s) => vm.runInContext('_srMergeStoreIntoByTeam_', ctx)(b, s);
const base = [{ name: 'Online', orders: 10, giaTri: 100e6, cod: 5, trungBinhDon: 10e6 }];
// 1) don quay 10tr, 2 sale cung team Online: moi sale 1.5tr (30%/2) -> team +3tr, dem 1 don (khong 2)
let r = M(base, { rows: [{ orders: [{ posRow: 5, credits: [{ sale: 'a', team: 'Online', amount: 1.5e6 }, { sale: 'b', team: 'Online', amount: 1.5e6 }] }] }] });
ok(r.rows[0].name === 'Online' && r.rows[0].giaTri === 103e6 && r.rows[0].orders === 11, 'cung team: +3tr, +1 don: ' + JSON.stringify(r.rows[0]));
ok(r.rows[0].trungBinhDon === Math.round(103e6 / 11), 'TB don tinh lai');
// 2) 2 team khac nhau tren 1 don -> moi team +1 don; team moi (chua co trong B) duoc tao
r = M(base, { rows: [{ orders: [{ posRow: 7, credits: [{ sale: 'a', team: 'Online', amount: 1e6 }, { sale: 'c', team: 'Offline', amount: 1e6 }] }] }] });
ok(r.rows.length === 2 && r.rows.find(x => x.name === 'Offline').orders === 1 && r.rows.find(x => x.name === 'Online').orders === 11, '2 team: moi team +1 don');
// 3) bo qua: khach khong den, don hoan, dup, amount<=0, thieu team
r = M(base, { rows: [
  { koDen: true, orders: [{ posRow: 1, credits: [{ sale: 'a', team: 'Online', amount: 9e6 }] }] },
  { orders: [{ posRow: 2, excluded: true, credits: [{ sale: 'a', team: 'Online', amount: 9e6 }] },
             { posRow: 3, credits: [{ sale: 'a', team: 'Online', amount: 0, dup: true }, { sale: 'b', team: 'Online', amount: 0 }, { sale: 'c', amount: 5e6 }] }] }] });
ok(r.rows.length === 1 && r.rows[0].giaTri === 100e6 && r.storeTotal === 0, 'bo qua koDen/hoan/dup/0/thieu team');
// 4) cung don nam 2 dong sheet, cung team: tien cong 2 lan (nhu Theo Sale) nhung dem don 1 lan
r = M(base, { rows: [{ orders: [{ posRow: 9, credits: [{ sale: 'a', team: 'Online', amount: 1e6 }] }] }, { orders: [{ posRow: 9, credits: [{ sale: 'b', team: 'Online', amount: 1e6 }] }] }] });
ok(r.rows[0].giaTri === 102e6 && r.rows[0].orders === 11, 'cung don 2 dong sheet: dem don 1 lan');
// 5) khong co storeData -> giu nguyen, khong sua mang goc
r = M(base, null); ok(r.rows[0].giaTri === 100e6 && base[0].giaTri === 100e6, 'khong store: giu nguyen');
// 6) khop ten team khong phan biet hoa/thuong
r = M(base, { rows: [{ orders: [{ posRow: 11, credits: [{ sale: 'a', team: 'ONLINE', amount: 1e6 }] }] }] });
ok(r.rows.length === 1 && r.rows[0].giaTri === 101e6, 'ten team khong phan biet hoa/thuong');
console.log(bad ? ('\n' + bad + ' FAIL') : '\nALL PASS'); process.exit(bad ? 1 : 0);
