// Test báo cáo "tính đơn thuần" (Báo cáo B, js/11-fn-srload.js) — trích hàm thật, chạy ví dụ có ghép Base / kế toán / quầy 30/70.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
const names = ['_srOrdNames_', '_srOrderShares_', '_srPureCalc_', '_srAdjTypes_', '_srPureDetailRows_'];
let code = "var _SR_UNASSIGNED_='(chưa gán sale)';\n";
code += require('fs').readFileSync(__dirname + '/../js/01-fn-splitmulti.js', 'utf8').match(/function isNumTagSale_\(x\)\{[^\n]*\}/)[0] + '\n';   // isNumTagSale_ (js/01): loai token toan so (STT Pancake) khoi ten sale
for (const n of names) {
  const i = src.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('thiếu hàm ' + n);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) { code += src.slice(i, k + 1) + '\n'; break; } } }
}
const ctx = new Function(code + 'return {_srPureCalc_,_srOrderShares_,_srAdjTypes_,_srPureDetailRows_};')();
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
// Sheet chi tiết: mỗi dòng = đơn × sale; tổng "Tiền chia" của từng sale = bảng Theo Sale (thuần)
const det = ctx._srPureDetailRows_([
  Object.assign({ posRow: 12, ngayTaoDon: '05/10/2026', khachHang: 'K1', soDienThoai: '0900', nguonDon: 'X', theSale: 'A, B, Chưa đối soát', trangThai: 'Đã nhận', ghiChu: 'n1' }, O[0]),
  Object.assign({ posRow: 40, theSale: 'A', trangThai: 'Đã gửi hàng', tachSoDon: 2, tachGiaTri: [900, 600] }, { saleThe: 'A', giaTriSauGiam: 1500, cod: 0 }),
  { posRow: 7, theSale: '', saleThe: '', giaTriSauGiam: 500, cod: 0 }
]);
ok(det.length === 1 + 2 + 1 + 1, 'Chi tiết: 1 dòng tiêu đề + 2 dòng (đơn chia 2 sale) + 1 + 1 (chưa gán sale vẫn có dòng)');
const sumBy = n => det.slice(1).filter(r => r[9] === n).reduce((s, r) => s + r[11], 0);
ok(sumBy('A') === 500 + 1500 && sumBy('B') === 500, 'Chi tiết: tổng "Tiền chia" từng sale khớp bảng thuần');
ok(det[1][0] === 12 && det[1][6] === 'Đã nhận' && det[1][8] === 2 && det[1][10] === 50 && det[1][5] === 'A, B, Chưa đối soát', 'Chi tiết: dòng sheet, trạng thái CRM, số sale, % chia, Thẻ nguyên văn');
ok(/Gộp 2 phần: 900 \+ 600/.test(det[3][13]) && det[4][9] === '(chưa gán sale)', 'Chi tiết: ghi rõ đơn tách đã gộp + dòng chưa gán sale');
if (fail) { console.log('CÓ LỖI'); process.exit(1); } console.log('ALL PURE-REPORT TESTS PASSED');
