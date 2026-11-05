// Test: _donListPriceTotal_ (gas_v13.js) — cột T "Đơn giá" niêm yết của "dữ liệu đơn". Chạy: node tools/test-don-listprice.js
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(n) { const i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] == '{') d++; else if (src[k] == '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const f = new Function(grab('_donMoneyToken_') + '\n' + grab('_donListPriceTotal_') + '\nreturn _donListPriceTotal_;')();
let bad = 0; const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) bad++; };
ok(f(31500000, '1') === 31500000, 'ô số 1 sản phẩm × SL 1');
ok(f('31.500.000', '1') === 31500000 && f('31,500,000đ', '1') === 31500000 && f('31500000', '') === 31500000, 'các kiểu viết tiền VN; SL trống = 1');
ok(f(1200000, '2') === 2400000, 'đơn giá × số lượng');
ok(f('31.500.000; 1.200.000', '1, 2') === 33900000, 'nhiều sản phẩm tách ; ghép theo thứ tự số lượng');
ok(f('1200000\n300000', '1, 3') === 2100000, 'tách theo xuống dòng');
ok(f('1200000, 300000', '1, 3') === 2100000, 'tách theo , khi số giá = số dòng SL');
ok(f('1200000', '1, 3') === 0, '1 giá mà 2 sản phẩm → không đoán (0)');
ok(f('abc', '1') === 0 && f('', '1') === 0 && f(undefined, '1') === 0 && f(-5, '1') === 0, 'rỗng/rác/âm → 0');
process.exit(bad ? 1 : 0);
