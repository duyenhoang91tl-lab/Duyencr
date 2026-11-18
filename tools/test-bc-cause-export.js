// Test bước 3: sheet "Check ngược từng đơn" (Excel) có cột "Nguyên nhân lệch (gợi ý)" — chạy hàm THẬT _srBcBuild_ + _srBcCause_ trong js/11-fn-srload.js. Chạy: node tools/test-bc-cause-export.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
let code = '';
for (const n of ['_srBcBaseSum_', '_srBcPosVal_', '_srBcQuayTxt_', '_srBcIsLech_', '_srBcCause_', '_srBcBuild_']) {
  const i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { code += src.slice(i, k + 1) + '\n'; break; } } }
}
code += src.match(/var _SRBC_SHIP_FEES_[^\n]*\n/)[0];
const B = new Function('fmt', '_srOrderShares_', code + 'return _srBcBuild_;')(n => String(n), () => []);
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const mk = (pos, bases, extra) => Object.assign({ giaTriPos: pos, giaTriSauGiam: pos, khachHang: 'K', soDienThoai: '0900000000', ghepBase: bases.map((g, i) => ({ ma: 'M' + i, giaTri: g, tinh: true })) }, extra || {});
const orders = [
  mk(16725000, [16725000], { posBoQuaRows: 1, posBoQuaGia: 16725000 }),            // dòng lặp đã bỏ qua, Pos = Base → khớp
  mk(7300000, [0], { ghiChu: 'Tổng đơn 7tr300' }),                                  // Base 0đ
  mk(14948014, [1470000], { ghiChu: 'CHI PHÍ BẢO HÀNH, TIỀN CÔNG' }),               // bảo hành
  mk(36526000, [57833000]),                                                         // Base lớn hơn
  mk(5000000, [5000000])                                                            // khớp
];
const r = B(orders), H = r.detail[0], ci = H.indexOf('Nguyên nhân lệch (gợi ý, 1 lần/đơn)');
ok(ci === H.length - 1 && ci > 0, 'Tiêu đề có cột "Nguyên nhân lệch (gợi ý)" ở cuối');
ok(r.detail.every(row => row.length === H.length), 'Mọi dòng có đủ ' + H.length + ' cột (không lệch cột)');
const d = r.detail.slice(1);
ok(d[0][ci] === '' && d[4][ci] === '', 'Đơn khớp (Pos = Base) để trống nhãn');
ok(/Base nhập 0đ/.test(d[1][ci]), 'Đơn Base 0đ → nhãn "Base nhập 0đ"');
ok(/bảo hành/.test(d[2][ci]), 'Đơn bảo hành 14.948k vs 1.470k → nhãn bảo hành');
ok(/Base lớn hơn Pos/.test(d[3][ci]), 'Đơn 36.526k vs 57.833k → nhãn "Base lớn hơn Pos"');
const two = B([mk(10000000, [6000000, 4500000], { })]).detail;   // 2 đơn gốc Base → 2 dòng; nhãn chỉ ở dòng đầu
ok(two.length === 3 && two[1][ci] !== '' && two[2][ci] === '', 'Đơn có 2 đơn gốc Base: nhãn chỉ ghi dòng đầu (không lặp)');
console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);
