// Test _detectBaseCounterCol_ (gas_v13.js): ma bo dem o COT U (index 20) ngoai A:T phai duoc tim thay (truoc day tra -1 -> 0 don ghep Base).
// Chay: node tools/test-detect-bodem-col.js
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const grab = n => { const i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const line = n => src.match(new RegExp('var ' + n + ' *=[^\\n]*'))[0];
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
function run(cols, rows, cache) {
  const store = cache || {};
  const body = 'var CacheService = { getScriptCache: function(){ return { get: function(k){ return k in STORE ? STORE[k] : null; }, put: function(k, v){ STORE[k] = v; } }; } };\n' +
    line('DT_TONG_WIDTH') + '\n' + line('DT_COL_BODEM') + '\n' + line('COUNTER_CODE_INNER_') + '\n' + line('COUNTER_CODE_RE_SRC_') + '\n' + grab('_detectBaseCounterCol_') + '\nreturn _detectBaseCounterCol_(SH, ' + (rows.length + 1) + ');';
  const sh = { getLastColumn: () => cols, getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)) }) };
  return new Function('STORE', 'SH', body)(store, sh);
}
const mk = (n, codeCol, cols = 24) => Array.from({ length: n }, (_, i) => { const r = Array(cols).fill(''); r[0] = '05/10/2026'; r[13] = 'sale' + i; if (codeCol >= 0) r[codeCol] = (100 + i) + 'T10/2026'; return r; });
ok(run(24, mk(50, 20)) === 20, 'ma bo dem o cot U (20) -> tim thay cot 20 (truoc day -1)');
ok(run(24, mk(50, 5)) === 5, 'ma o cot khac trong A:T van tim thay (khong doi hanh vi cu)');
ok(run(24, mk(50, -1)) === -1, 'khong cot nao co ma -> -1');
const both = mk(50, 20); both.forEach((r, i) => { r[16] = 'ghi chu ' + (200 + i) + 'T10/2026'; });
ok(run(24, both) === 20, 'cot U co ma + cot ghi chu co ma lan -> uu tien cot U');
ok(run(20, mk(50, 5, 20)) === 5, 'sheet chi co 20 cot (A:T) van chay (khong vuot lastColumn)');
const cache = { dtCounterCol_v1: '-1' };
ok(run(24, mk(50, 20), cache) === 20 && cache.dtCounterCol_v2 === '20', 'cache cu v1=-1 bi bo qua (khoa v2) va luu v2=20');
console.log(bad ? bad + ' LOI' : 'TAT CA QUA'); process.exit(bad ? 1 : 0);
