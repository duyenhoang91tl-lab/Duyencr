// Test nhan nguyen nhan dong lech o Bao cao check nguoc Base (_srBcCause_). Chay: node tools/test-bc-cause.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
let code = '';
for (const n of ['_srBcBaseSum_', '_srBcPosVal_', '_srBcCause_']) {
  const i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { code += src.slice(i, k + 1) + '\n'; break; } } }
}
const C = new Function('fmt', 'esc', code + 'return {c:_srBcCause_};')(n => String(n), s => s);
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const has = (o, re) => C.c(o).some(x => re.test(x));
// 4 don gap doi that (33.450k vs 16.725k) khi dong 2 van duoc cong (du lieu cu)
ok(has({ giaTriPos: 33450000, giaTriSauGiam: 33450000, ghepBase: [{ giaTri: 16725000, tinh: true }] }, /Pos gấp đôi Base/), 'Pos gấp đôi Base');
ok(has({ giaTriPos: 16725000, ghepBase: [{ giaTri: 16725000, tinh: true }], posBoQuaRows: 1, posBoQuaGia: 16725000 }, /bỏ qua 1 dòng Pos trùng/i), 'Đã bỏ qua dòng Pos trùng');
// (c) Base nhap 0d, ghi chu noi tong 7tr300
ok(has({ giaTriPos: 7300000, ghiChu: 'tong 7tr300', ghepBase: [{ giaTri: 0, tinh: true, trangThai: 'Đang xử lý' }] }, /Base nhập 0đ/), 'Base 0đ');
// (b) bao hanh / tien cong
ok(has({ giaTriPos: 14948000, ghiChu: 'CHI PHÍ BẢO HÀNH, TIỀN CÔNG', ghepBase: [{ giaTri: 1470000, tinh: true, trangThai: 'Bảo hành' }] }, /bảo hành/), 'Bảo hành / chi phí');
// (a) Base lon hon Pos, 1 don
ok(has({ giaTriPos: 36526000, ghepBase: [{ giaTri: 57833000, tinh: true }] }, /^Base lớn hơn Pos/), 'Base lớn hơn Pos');
ok(has({ giaTriPos: 10000000, ghepBase: [{ giaTri: 5000000, tinh: true }, { giaTri: 2000000, tinh: true }] }, /Pos lớn hơn Base \(2 đơn/), 'Pos lớn hơn, 2 đơn gốc');
// 1 trong cac don goc bi loai
ok(has({ giaTriPos: 9000000, ghepBase: [{ giaTri: 5000000, tinh: true }, { giaTri: 4000000, tinh: false }] }, /bị loại/), 'Một đơn gốc bị loại');
// khop -> khong nhan
ok(C.c({ giaTriPos: 5000000, ghepBase: [{ giaTri: 5000000, tinh: true }] }).length === 0, 'Khớp giá → không nhãn');
// "doi" khong khop nham "doi tuong"/"dai"
ok(!has({ giaTriPos: 5000000, ghiChu: 'giao doi tac', ghepBase: [{ giaTri: 5100000, tinh: true }] }, /bảo hành/), '"đối tác" không bị coi là đơn đổi');
ok(has({ giaTriPos: 5000000, ghiChu: 'doi size nhan', ghepBase: [{ giaTri: 5100000, tinh: true }] }, /chi phí \/ đổi/), '"đổi size" → nhãn đổi');
if (fail) { console.error(fail + ' FAIL'); process.exit(1); }
console.log('ALL BC-CAUSE TESTS PASSED');
