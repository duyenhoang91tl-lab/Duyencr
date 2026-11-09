// Test QUY TAC 2026-11-06: don Pos check nguoc Base; CO Base -> chia THEO TY LE Base (tong = gia Pos); KHONG co Base -> Pos. Settings POS_GHEP_RATIO='1'.
// Chay: node tools/test-ghep-ratio.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ham ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const stubs = `
function _pickBaseRowsForCode_(c, idx){ return idx.exact[c] || null; }
function _isExcludedOrderStatus_(t){ return String(t) === 'Thất bại'; }
function parseVNDate_(v){ var m = /^(\\d+)\\/(\\d+)\\/(\\d+)$/.exec(String(v)); return m ? new Date(Date.UTC(+m[3], +m[2]-1, +m[1])) : null; }
function _vnYmd_(d){ return d.toISOString().slice(0,10); }
function _normTxt_(s){ return String(s).toLowerCase(); }
`;
const build = (setting) => new Function('getSetting_', stubs + grab('_isNumericTag_') + '\nvar _posGhepRatioMemo_ = null;\n' + grab('_posGhepRatioOn_') + '\n' + grab('_resolveGhepDon_') + '; return _resolveGhepDon_;')(() => setting);
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const mk = (rowIndex, code, sale, gt) => ({ rowIndex, code, trangThai: 'Hoàn thành', saleBan: sale, giaTriDon: gt, creator: 'c', ngayTao: '05/10/2026' });
const fr = (r, n) => (r.shares.find(s => s.name === n) || {}).frac;
const money = (r, n) => Math.round(fr(r, n) * r.total);
// A: Base 10tr (An) + 5tr (Binh) = 15tr, Pos 12tr -> Base > Pos: co theo ty le: An 8tr, Binh 4tr
let idx = { exact: { 'A1T10/2026': [mk(1, 'A1T10/2026', 'An', 10e6)], 'A2T10/2026': [mk(2, 'A2T10/2026', 'Binh', 5e6)] } };
let r = build('1')(['A1T10/2026', 'A2T10/2026'], idx, {}, 12e6, ['Cuong']);
ok(r.status === 'ok' && r.total === 12e6, 'ty le: Base 15tr > Pos 12tr => tong = Pos 12tr');
ok(money(r, 'An') === 8e6 && money(r, 'Binh') === 4e6 && fr(r, 'Cuong') === undefined, 'An 8tr, Binh 4tr, the Pos (Cuong) KHONG nhan gi');
// B: Base 6tr (An) + 3tr (Binh) = 9tr, Pos 12tr -> Base < Pos: phan du 3tr KHONG cho the Pos, chia theo ty le Base: An 8tr, Binh 4tr
idx = { exact: { 'B1T10/2026': [mk(1, 'B1T10/2026', 'An', 6e6)], 'B2T10/2026': [mk(2, 'B2T10/2026', 'Binh', 3e6)] } };
r = build('1')(['B1T10/2026', 'B2T10/2026'], idx, {}, 12e6, ['Cuong']);
ok(r.total === 12e6 && money(r, 'An') === 8e6 && money(r, 'Binh') === 4e6 && !r.remainder, 'Base 9tr < Pos 12tr => chia theo ty le Base (8tr/4tr), khong co phan du cho the Pos');
// C: cung du lieu B nhung cong tac TAT (Settings POS_GHEP_RATIO='0') => quy tac cu (phan du 3tr chia cho Cuong): tong van 12tr, Cuong 3tr
r = build('0')(['B1T10/2026', 'B2T10/2026'], idx, {}, 12e6, ['Cuong']);
ok(r.total === 12e6 && money(r, 'Cuong') === 3e6 && money(r, 'An') === 6e6 && !r.scale, 'cong tac TAT => hanh vi cu giu nguyen (Cuong nhan phan du 3tr)');
// D: Base > Pos, cong tac TAT => cu: total = tong Base (15tr)
idx = { exact: { 'A1T10/2026': [mk(1, 'A1T10/2026', 'An', 10e6)], 'A2T10/2026': [mk(2, 'A2T10/2026', 'Binh', 5e6)] } };
r = build('0')(['A1T10/2026', 'A2T10/2026'], idx, {}, 12e6, ['Cuong']);
ok(r.total === 15e6, 'cong tac TAT, Base > Pos => van total = tong Base 15tr (hanh vi cu)');
// E: khong co Base (khong khop) => khongKhop, fallback Pos (khong ghep)
r = build('1')(['Z9T10/2026'], { exact: {} }, {}, 5e6, ['Cuong']);
ok(r.status === 'khongKhop', 'khong co Base => khongKhop => caller tinh theo Pos (the sale chia deu)');
// F: 1 don Base, 1 sale, Pos khac gia => 100% cho sale cua Base, tong = Pos
idx = { exact: { 'F1T10/2026': [mk(1, 'F1T10/2026', 'An, Binh', 4e6)] } };
r = build('1')(['F1T10/2026'], idx, {}, 5e6, ['Cuong']);
ok(r.total === 5e6 && money(r, 'An') === 2.5e6 && money(r, 'Binh') === 2.5e6 && r.scale === 1.25, 'sale ban tren Base (An, Binh) chia deu 5tr theo Pos; scale = 1,25');
// G: tong cac phan = Pos (khong lech lam tron)
idx = { exact: { 'G1T10/2026': [mk(1, 'G1T10/2026', 'An', 3333333)], 'G2T10/2026': [mk(2, 'G2T10/2026', 'Binh', 1111111)] } };
r = build('1')(['G1T10/2026', 'G2T10/2026'], idx, {}, 7777777, []);
ok(Math.abs(r.shares.reduce((s, x) => s + x.frac * r.total, 0) - 7777777) < 1e-6, 'tong cac phan chia = Pos (7.777.777)');
// H: MAC DINH (Settings trong / khong dat) = BAT (Duyen 2026-11-06 'luon bat')
r = build('')(['B1T10/2026', 'B2T10/2026'], { exact: { 'B1T10/2026': [mk(1, 'B1T10/2026', 'An', 6e6)], 'B2T10/2026': [mk(2, 'B2T10/2026', 'Binh', 3e6)] } }, {}, 12e6, ['Cuong']);
ok(r.scale === 12e6 / 9e6 && money(r, 'An') === 8e6 && !r.remainder, 'Settings trong => MAC DINH BAT che do ty le');
console.log(fail ? 'FAIL ' + fail : 'ALL OK'); process.exit(fail ? 1 : 0);
