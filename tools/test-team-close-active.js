// Test mau so "tuong tac TB" chi tinh sale Online/Offline co tuong tac trong thang (Duyen 2026-11-13). Chay: node tools/test-team-close-active.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const ctx = { Math, Object, Number, _normTxt_: s => String(s || '').trim().toLowerCase() };
vm.createContext(ctx); vm.runInContext(grab('_tbPickClose_'), ctx);
const memberOf = { hoa: 'Hoa', nam: 'Nam', mai: 'Mai' };   // Lan Quay khong thuoc doi
const R = (n, h, c) => ({ name: n, held: h, closed: c });
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
// thang: Hoa, Nam, Mai co tuong tac; Lan Quay ngoai doi bi bo
let m = ctx._tbPickClose_([R('Hoa', 600, 90), R('Nam', 500, 100), R('Mai', 90, 50), R('Lan Quay', 900, 400)], memberOf);
ok(m.rows.length === 3 && m.avgHeld === 396.7, 'thang: TB = (600+500+90)/3 = 396,7; sale ngoai doi khong tinh');
ok(m.winners.length === 1 && m.winners[0].name === 'Nam', 'thang: Mai 55% nhung tuong tac < TB -> khong du; Nam 20% > Hoa 15% thang');
const active = m.rows.map(x => x.name);   // Hoa, Nam, Mai (co tuong tac trong thang)
// tuan: Mai 0 tuong tac tuan nay (khong co trong rows) nhung active trong thang -> van nam trong mau so
let w = ctx._tbPickClose_([R('Hoa', 200, 30), R('Nam', 100, 25)], memberOf, active);
ok(w.avgHeld === 100 && w.rows.length === 2, 'tuan: TB = (200+100)/3 = 100 (Mai 0 tuong tac tuan nay van tinh vao mau so)');
ok(w.winners.length === 1 && w.winners[0].name === 'Nam' && w.rows.find(x => x.name === 'Nam').eligible, 'tuan: Nam 25% du tuong tac (100 >= 100) thang');
// cach cu (khong active) mau so chi 2 nguoi => TB 150, Nam khong du -> Hoa thang: xac nhan khac biet
let old = ctx._tbPickClose_([R('Hoa', 200, 30), R('Nam', 100, 25)], memberOf);
ok(old.avgHeld === 150 && old.winners[0].name === 'Hoa', 'doi chieu: khong truyen active thi mau so 2 nguoi, ket qua khac');
// sale co tuong tac tuan nay nhung KHONG active trong thang (vi du khong co o thang) bi loai
let x = ctx._tbPickClose_([R('Hoa', 200, 30), R('Nam', 300, 90)], memberOf, ['Hoa']);
ok(x.rows.length === 1 && x.rows[0].name === 'Hoa' && x.avgHeld === 200, 'sale khong thuoc tap active khong xet');
process.exit(fail ? 1 : 0);
