// Test: đơn Pos tách 2 dòng cùng SĐT + cùng bộ mã (vd #M47323 "62T11 + 79T11/2026": 8.123.000 + 5.850.000 = 13.973.000 = tổng 2 đơn Base)
// KHÔNG được báo "Pos lệch Base" ở Báo cáo check ngược Base. Chạy: node tools/test-bc-pos-sibling.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
let code = '';
for (const n of ['_srBcBaseSum_', '_srBcPosVal_', '_srBcIsLech_']) {
  const i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { code += src.slice(i, k + 1) + '\n'; break; } } }
}
code += src.match(/var _SRBC_SHIP_FEES_[^\n]*\n/)[0];
const C = new Function(code + 'return {_srBcBaseSum_,_srBcPosVal_,_srBcIsLech_};')();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const base = [{ ma: '79T11/2026', giaTri: 8123000, tinh: true }, { ma: '62T11/2026', giaTri: 5850000, tinh: true }];
// TRƯỚC khi sửa: backend chỉ trả dòng đầu (8.123.000) -> lệch 5.850.000
const cu = { giaTriPos: 8123000, giaTriSauGiam: 8123000, ghepBase: base };
ok(C._srBcIsLech_(C._srBcBaseSum_(cu) - C._srBcPosVal_(cu), C._srBcBaseSum_(cu)) === true, 'Không có giaTriPosPhu (dữ liệu cũ): vẫn lệch 5.850.000 (hành vi cũ)');
// SAU khi sửa: backend gắn thêm dòng anh em 5.850.000
const moi = Object.assign({}, cu, { giaTriPosPhu: 5850000, posPhuRows: 1 });
ok(C._srBcPosVal_(moi) === 13973000, 'Pos = 8.123.000 + 5.850.000 = 13.973.000');
ok(C._srBcIsLech_(C._srBcBaseSum_(moi) - C._srBcPosVal_(moi), C._srBcBaseSum_(moi)) === false, 'Pos 13.973.000 = Base 13.973.000 → KHỚP, không báo lệch');
// Đơn thật sự lệch vẫn phải báo
const that = Object.assign({}, moi, { giaTriPosPhu: 5000000 });
ok(C._srBcIsLech_(C._srBcBaseSum_(that) - C._srBcPosVal_(that), C._srBcBaseSum_(that)) === true, 'Dòng anh em 5.000.000 (lệch 850.000) → vẫn báo lệch');
// Đơn thường không có trường mới: không đổi
const th = { giaTriSauGiam: 1000000, ghepBase: [{ giaTri: 1000000, tinh: true }] };
ok(C._srBcPosVal_(th) === 1000000, 'Đơn không có giaTriPos/giaTriPosPhu: giữ nguyên giaTriSauGiam');
// Mô phỏng logic GAS (khóa SĐT + bộ mã sắp xếp)
const key = (p, codes) => p + '|' + codes.slice().sort().join('|');
const holders = {}; const rows = [{ p: '0942926655', c: ['62T11/2026', '79T11/2026'], v: 8123000, first: true }, { p: '0942926655', c: ['79T11/2026', '62T11/2026'], v: 5850000 }, { p: '0900000000', c: ['79T11/2026', '62T11/2026'], v: 111 }];
holders[key(rows[0].p, rows[0].c)] = { phu: 0, rows: 0 };
rows.slice(1).forEach(r => { const h = holders[key(r.p, r.c)]; if (h) { h.phu += r.v; h.rows++; } });
const h0 = holders[key('0942926655', ['62T11/2026', '79T11/2026'])];
ok(h0.phu === 5850000 && h0.rows === 1, 'Khóa SĐT+mã không phụ thuộc thứ tự mã; SĐT khác không bị cộng nhầm');
// ===== 2026-11-18: dòng Pos anh em CHỈ cộng khi làm GẦN Base hơn (ví dụ THẬT trong bảng check ngược Base Duyên gửi) — chạy hàm THẬT _posSiblingAdd_ trong gas_v13.js =====
const gsrc = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const gi = gsrc.indexOf('function _posSiblingAdd_('); let gd = 0, gj = gsrc.indexOf('{', gi), gcode = '';
for (let k = gj; k < gsrc.length; k++) { if (gsrc[k] === '{') gd++; else if (gsrc[k] === '}') { gd--; if (!gd) { gcode = gsrc.slice(gi, k + 1); break; } } }
const add = new Function(gcode + '; return _posSiblingAdd_;')();
const hold = (pos, base) => ({ phu: 0, rows: 0, pos, base, boQua: 0, boQuaGia: 0 });
let h = hold(8123000, 13973000);
ok(add(h, 5850000) === true && h.phu === 5850000 && h.rows === 1 && h.boQua === 0, '#M47323: 8.123.000 + 5.850.000 = Base 13.973.000 -> CỘNG (hành vi cũ giữ nguyên)');
[['ninhnga99 (207... dòng 2)', 16725000, 16725000], ['dungnguyen1995', 13917000, 13917000], ['phuongthao2000', 10202000, 10202000], ['ninhnga99 (113T11)', 8100000, 8100000]].forEach(([n, v, b]) => {
  const x = hold(v, b), r = add(x, v);
  ok(r === false && x.phu === 0 && x.rows === 0 && x.boQua === 1 && x.boQuaGia === v, n + ': Pos dòng 1 = Base ' + v + ', dòng 2 trùng -> KHÔNG cộng (trước đây ra Pos gấp đôi, chênh âm cả đơn)');
});
h = hold(16725000, 16725000); add(h, 16725000);
ok(16725000 + h.phu - 16725000 === 0, 'Sau sửa: Pos 16.725.000 − Base 16.725.000 = 0 (không còn chênh -16.725.000)');
h = hold(6000000, 10000000); add(h, 3000000); add(h, 1000000);
ok(h.phu === 4000000 && h.rows === 2, '3 dòng 6tr + 3tr + 1tr = Base 10tr: cộng cả 2 dòng anh em');
h = hold(6000000, 7000000); add(h, 6000000);
ok(h.phu === 0 && h.boQua === 1, 'Pos 6tr (lệch 1tr), dòng 6tr lặp (6+6=12tr lệch 5tr, xa hơn) -> bỏ qua');
h = hold(3000000, 0); ok(add(h, 1000000) === false, 'Base = 0 (đơn Base 0đ): không cộng thêm để khỏi làm lệch to hơn');
console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);
