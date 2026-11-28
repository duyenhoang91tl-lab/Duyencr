// Test UI bang "Ty le chot theo ngay" (buoc 4b Pancake gop thang): _pkDayTableHtml_ / _pkEstLabel_ (js/10-fn-pkkpipct.js).
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('js/10-fn-pkkpipct.js', 'utf8');
function fn(name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('khong thay ' + name); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
const ctx = { esc: s => String(s).replace(/</g, '&lt;'), fmt: n => String(n) };
vm.createContext(ctx); vm.runInContext(fn('_pkEstLabel_') + '\n' + fn('_pkDayTableHtml_'), ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
ok(ctx._pkDayTableHtml_({}) === '' && ctx._pkDayTableHtml_(null) === '' && ctx._pkDayTableHtml_({ byDay: [] }) === '', 'GAS cu / rong -> khong hien gi');
let h = ctx._pkDayTableHtml_({ byDay: [{ date: '2026-08-01', tongTT: 10, tongDH: 1, tyLeCD: 10, est: 0 }, { date: '2026-08-02', tongTT: 30, tongDH: 3, tyLeCD: 10, est: 0 }] });
ok(h.includes('2026-08-01') && h.includes('số thật') && !h.includes('~') && !h.includes('ước tính'), 'toan so that: khong nhan uoc tinh');
ok(h.includes('<td>Tổng</td><td style="text-align:right">40</td><td style="text-align:right">4</td><td style="text-align:right">10%</td>'), 'dong Tong 40 TT / 4 DH / 10%');
h = ctx._pkDayTableHtml_({ byDay: [{ date: '2026-08-01', tongTT: 10, tongDH: 1, tyLeCD: 10, est: 1 }, { date: '2026-08-02', tongTT: 10, tongDH: 0, tyLeCD: 0, est: 2 }] });
ok(h.includes('~10') && h.includes('rải theo số liệu ngày thật') && h.includes('chia đều'), 'est 1 va 2 co nhan + dau ~');
ok(h.includes('tổng cả khoảng vẫn đúng'), 'co chu thich khi co so uoc tinh');
ok(ctx._pkEstLabel_(0) === '', 'est 0 khong co nhan');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);
