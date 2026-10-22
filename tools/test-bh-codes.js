// Test MA BAO HANH BH (gas_v13.js _splitBhCodes_): don BH la don DOC LAP — khong tham gia ghep, khong tra don goc; tinh theo The. Chay: node tools/test-bh-codes.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ham ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const consts = ['COUNTER_CODE_INNER_', 'COUNTER_CODE_RE_SRC_'].map(n => { const m = new RegExp('var ' + n + ' = [^\\n]*;').exec(src); if (!m) throw new Error('thieu ' + n); return m[0]; }).join('\n');
const F = new Function(consts + '\n' + grab('_normCounterCode_') + grab('_extractCounterCodes_') + grab('_splitBhCodes_') + '; return {split:_splitBhCodes_, ext:_extractCounterCodes_};')();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
let s = F.split(F.ext('Bh395T09/2026'));
ok(s.bh.length === 1 && s.bh[0] === 'BH395T09/2026' && s.normal.length === 0, 'BH395T09/2026 -> ma BH, khong co ma thuong');
s = F.split(F.ext('BH395T09/2026 + 835T09/2026'));
ok(s.bh.length === 1 && s.normal.length === 1 && s.normal[0] === '835T09/2026', 'BH + ma thuong: ma BH tach rieng, chi con 1 ma thuong');
s = F.split(['NG30T10/2026', '208T10/2026']); ok(s.bh.length === 0 && s.normal.length === 2, 'ma thuong (NG..) KHONG bi coi la BH');
s = F.split(['BHQ12T10']); ok(s.bh.length === 0 && s.normal.length === 1, '"BHQ.." (khong phai BH + so) khong tach');
// Noi day trong buildSalesReportB_: ma BH khong vao danh sach ghep; khong con tra don goc
ok(/_splitBhCodes_\(_extractCounterCodes_\(pre\[pi\]\.ghiChu\)\)\.normal/.test(src), 'buildSalesReportB_: chi ma THUONG moi vao ghep (don BH doc lap)');
ok(!/_resolveBhOrigin_|bhOrigByRow|bhHasSale/.test(src), 'khong con code tra don goc cho don BH');
console.log(fail ? 'CO LOI' : 'ALL BH TESTS PASSED'); process.exit(fail ? 1 : 0);
