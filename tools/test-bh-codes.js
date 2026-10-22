// Test MA BAO HANH BH (gas_v13.js _splitBhCodes_ / _resolveBhOrigin_): bo chu BH -> don goc de biet sale; doanh thu giu theo Pos. Chay: node tools/test-bh-codes.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ham ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const stubs = `
function _pickBaseRowsForCode_(c, idx){ return idx.exact[c] || null; }
function _isExcludedOrderStatus_(t){ return String(t) === 'Thất bại'; }
function parseVNDate_(v){ var p = String(v).split('/'); return p.length === 3 ? new Date(Date.UTC(+p[2], +p[1]-1, +p[0])) : null; }
function _vnYmd_(d){ return d.toISOString().slice(0,10); }
`;
const consts = ['COUNTER_CODE_INNER_', 'COUNTER_CODE_RE_SRC_'].map(n => { const m = new RegExp('var ' + n + ' = [^\\n]*;').exec(src); if (!m) throw new Error('thieu ' + n); return m[0]; }).join('\n');
const F = new Function(stubs + consts + '\n' + grab('_normCounterCode_') + grab('_extractCounterCodes_') + grab('_splitBhCodes_') + grab('_resolveBhOrigin_') + '; return {split:_splitBhCodes_, res:_resolveBhOrigin_, ext:_extractCounterCodes_};')();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const mk = (rowIndex, code, tt, sale, gt) => ({ rowIndex, code, trangThai: tt, saleBan: sale, giaTriDon: gt, creator: 'cr', ngayTao: '05/09/2026' });
const idx = { exact: { '395T09/2026': [mk(10, '395T09/2026', 'Hoàn thành', 'saleA, saleB', 8000000)], '17T09/2026': [mk(11, '17T09/2026', 'Thất bại', 'saleC', 1000000)] } };

let s = F.split(F.ext('Bh395T09/2026'));
ok(s.normal.length === 0 && s.bh[0] === 'BH395T09/2026' && s.bhOrig[0] === '395T09/2026', 'tach: BH395T09/2026 -> goc 395T09/2026');
s = F.split(F.ext('BH395T09/2026 + 395T09/2026'));
ok(s.bhOrig.length === 1 && s.normal.length === 1, 'BH + chinh don goc: goc 1 ma, ma thuong 1');
s = F.split(['NG30T10/2026', '208T10/2026']); ok(s.bh.length === 0 && s.normal.length === 2, 'ma thuong (NG..) KHONG bi coi la BH');
s = F.split(['BHQ12T10']); ok(s.bh.length === 0, '"BHQ.." (khong phai BH + so) khong tach');
s = F.split(['bh7T10/2026', 'BH7T10/2026']); ok(s.bhOrig.length === 1, 'BH trung nhau chi 1 goc');

let r = F.res(['395T09/2026'], idx, 1500000);
ok(r.status === 'ok' && r.total === 1500000, 'doanh thu = gia Pos cua don bao hanh (1.500.000), KHONG lay 8.000.000 cua don goc');
ok(r.shares.length === 2 && Math.abs(r.shares[0].frac - 0.5) < 1e-9 && r.shares[0].name === 'saleA' && r.shares[1].name === 'saleB', 'chia deu theo sale cua DON GOC (saleA, saleB)');
ok(Array.isArray(r.creators) && r.creators.length === 0, 'khong tao nguoi nhan thuong tu don bao hanh');
ok(r.baseOrders.length === 1 && r.baseOrders[0].saleBan === 'saleA, saleB', 'baseOrders ghi don goc de doi chieu');
r = F.res(['999T09/2026'], idx, 1500000);
ok(r.status === 'khongKhop' && r.missing[0] === '999T09/2026', 'khong tim thay don goc -> roi ve chia theo The Pos (khongKhop), khong mat doanh thu');
r = F.res(['17T09/2026'], idx, 700000);
ok(r.status === 'khongKhop', 'don goc Base da Thất bại -> khong dung chia, roi ve The Pos (khong bo don bao hanh)');
r = F.res(['395T09/2026', '17T09/2026'], idx, 900000);
ok(r.status === 'ok' && r.shares.length === 2 && r.total === 900000, '2 goc, 1 goc thất bại: chia theo goc con song');
ok(/bhOrigByRow\[pj\]\s*\?\s*_resolveBhOrigin_/.test(src) && /bhSp\.bh\.length && !bhSp\.normal\.length/.test(src), 'buildSalesReportB_ da noi cac ham BH');
console.log(fail ? 'CO LOI' : 'ALL BH TESTS PASSED'); process.exit(fail ? 1 : 0);
