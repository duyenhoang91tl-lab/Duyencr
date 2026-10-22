// Test: _resolveGhepDon_ (gas_v13.js) tra them baseOrders (tung don goc Base) ma KHONG doi cach tinh total/shares. Chay: node tools/test-ghep-base-orders.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('thieu ham ' + name);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); } }
}
const stubs = `
function _pickBaseRowsForCode_(c, idx){ return idx.exact[c] || null; }
function _isExcludedOrderStatus_(t){ return String(t) === 'Thất bại'; }
function parseVNDate_(v){ var m = /^(\\d+)\\/(\\d+)\\/(\\d+)$/.exec(String(v)); return m ? new Date(Date.UTC(+m[3], +m[2]-1, +m[1])) : null; }
function _vnYmd_(d){ return d.toISOString().slice(0,10); }
function _normTxt_(s){ return String(s).toLowerCase(); }
`;
const f = new Function(stubs + grab('_resolveGhepDon_') + '; return _resolveGhepDon_;')();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const mk = (rowIndex, code, tt, sale, gt, creator, ngay) => ({ rowIndex, code, trangThai: tt, saleBan: sale, giaTriDon: gt, creator, ngayTao: ngay });
const idx = { exact: {
  'A1T10/2026': [mk(10, 'A1T10/2026', 'Hoàn thành', 'sale1, sale2', 3000000, 'cr1', '05/10/2026')],
  'A2T10/2026': [mk(11, 'A2T10/2026', 'Thất bại', 'sale3', 1000000, 'cr2', '06/10/2026')],
  'A3T10/2026': [mk(12, 'A3T10/2026', 'Thất bại', 'sale4', 500000, 'cr3', '07/10/2026')] } };
let r = f(['A1T10/2026', 'A2T10/2026'], idx, {});
ok(r.status === 'ok' && r.total === 3000000, 'ghep ok, total chi tinh don goc con song (3.000.000)');
ok(r.baseOrders.length === 2, 'baseOrders liet ke CA don goc bi loai (2 dong)');
ok(r.baseOrders[0].tinh === true && r.baseOrders[1].tinh === false, 'co tinh=true cho don song, false cho don Thất bại');
ok(r.baseOrders[0].ngay === '2026-10-05' && r.baseOrders[0].nguoiTao === 'cr1' && r.baseOrders[0].saleBan === 'sale1, sale2' && r.baseOrders[0].dong === 10, 'giu dong/ngay/nguoi tao/sale ban cua don goc');
ok(r.shares.length === 2 && Math.abs(r.shares[0].frac - 0.5) < 1e-9, 'chia sale khong doi (2 sale chia deu)');
r = f(['A3T10/2026'], idx, {});
ok(r.status === 'gocBiLoai', 'moi don goc Thất bại -> gocBiLoai (khong doi hanh vi cu)');
r = f(['A1T10/2026', 'ZZ9T10/2026'], idx, {});
ok(r.status === 'khongKhop' && r.missing[0] === 'ZZ9T10/2026', 'ma khong tim thay -> khongKhop (khong doi)');
r = f(['A1T10/2026'], idx, { 10: true });
ok(r.status === 'trungDonGoc', 'dong Base da dung -> trungDonGoc (khong doi)');
console.log(fail ? ('\n' + fail + ' LOI') : '\nTAT CA DAT'); process.exit(fail ? 1 : 0);
