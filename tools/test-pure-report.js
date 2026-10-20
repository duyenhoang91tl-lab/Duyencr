// Test báo cáo "tính đơn thuần" (Báo cáo B, js/11-fn-srload.js) — trích hàm thật, chạy ví dụ có ghép Base / kế toán / quầy 30/70.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
const names = ['_srOrdNames_', '_srOrderShares_', '_srPureCalc_', '_srAdjTypes_'];
let code = "var _SR_UNASSIGNED_='(chưa gán sale)';\n";
for (const n of names) {
  const i = src.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('thiếu hàm ' + n);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) { code += src.slice(i, k + 1) + '\n'; break; } } }
}
const ctx = new Function(code + 'return {_srPureCalc_,_srOrderShares_,_srAdjTypes_};')();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const O = [
  { saleThe: 'A,B', saleBanValid: 'A,B', giaTriSauGiam: 1000, cod: 100 },                                                   // thường, chia đều
  { saleThe: 'A', giaTriSauGiam: 3000, giaTriPos: 2000, cod: 0, dieuChinh: 'base', saleShares: [{ name: 'B', frac: 0.75 }, { name: 'C', frac: 0.25 }], saleBanValid: 'B,C' }, // ghép Base: giá 3000, Pos gốc 2000
  { saleThe: 'D', saleBanValid: 'D', giaTriSauGiam: 1000, cod: 0, saleRatio: 0.3 },                                         // quầy 30/70
  { saleThe: '', saleBanValid: '', giaTriSauGiam: 500, cod: 0 }                                                            // chưa gán sale
];
const pure = ctx._srPureCalc_(O, 'pure'), adj = ctx._srPureCalc_(O, 'adj');
const g = (c, n) => c.rows.find(r => r.name === n) || { orders: 0, giaTri: 0 };
ok(g(pure, 'A').giaTri === 500 + 2000 && g(pure, 'A').orders === 2, 'Thuần: A = 1/2 đơn1 + CẢ đơn Pos gốc 2000 (không ghép Base)');
ok(g(pure, 'B').giaTri === 500 && g(pure, 'C').orders === 0, 'Thuần: B chỉ nhận phần đơn 1, C không có');
ok(g(pure, 'D').giaTri === 1000, 'Thuần: quầy không nhân 0.3');
ok(g(adj, 'D').giaTri === 300, 'Sau điều chỉnh: quầy 30%');
ok(g(adj, 'B').giaTri === 500 + 2250 && g(adj, 'C').giaTri === 750 && g(adj, 'A').giaTri === 500, 'Sau điều chỉnh: ghép Base chia 75/25 theo giá Base 3000');
ok(pure.unassigned.orders === 1 && adj.unassigned.orders === 1 && !pure.rows.some(r => r.name === '(chưa gán sale)'), 'Đơn chưa gán sale tách riêng, không vào bảng');
ok(ctx._srAdjTypes_(O[1]).join() === 'Ghép Base' && ctx._srAdjTypes_(O[2]).join() === 'Quầy 30/70' && ctx._srAdjTypes_(O[0]).length === 0, 'Nhận diện loại điều chỉnh');
if (fail) { console.log('CÓ LỖI'); process.exit(1); } console.log('ALL PURE-REPORT TESTS PASSED');
