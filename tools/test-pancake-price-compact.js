// Pancake AI "Hoi AI": gop cac dong "- Chat lieu | Kieu/Size | Gia" thanh 1 dong / chat lieu (size 1: gia · size 2: gia).
// NGUYEN NHAN GOC: cung 1 san pham khac size bi lap lai ca dong -> CS doc 1 loat dai (Duyen 18/11/2026).
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
const i = src.indexOf('  function compactPriceText_('), j = src.indexOf('  function askPriceAi_()');
if (i < 0 || j < 0) { console.error('FAIL: khong thay compactPriceText_'); process.exit(1); }
const compact = new Function(src.slice(i, j) + '\nreturn compactPriceText_;')();
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };

const raw = 'SẢN PHẨM: NHẪN BẠC TRƠN\n' +
  '- Chất liệu: Bạc 925 | Kiểu/Size: 12 | Giá: 450\n' +
  '- Chất liệu: Bạc 925 | Kiểu/Size: 13 | Giá: 480\n' +
  '- Chất liệu: Vàng 10K | Kiểu/Size: 12 | Giá: 2.310\n' +
  '- Chất liệu: Vàng 10K | Kiểu/Size: 13 | Giá: 2.450';
const out = compact(raw).split('\n');
ok(out.length === 3 && out[0] === 'SẢN PHẨM: NHẪN BẠC TRƠN', 'giu dong ten san pham, 4 dong bien the -> 2 dong chat lieu: ' + JSON.stringify(out));
ok(out[1] === '• Bạc 925 → size 12: 450 · size 13: 480', 'size 12 / size 13 noi tiep tren 1 dong: ' + out[1]);
ok(out[2] === '• Vàng 10K → size 12: 2.310 · size 13: 2.450', 'chat lieu thu 2 tuong tu: ' + out[2]);

const two = compact('SẢN PHẨM: A\n- Chất liệu: Bạc | Kiểu/Size: (mặc định) | Giá: 100\n\nSẢN PHẨM: B\n- Chất liệu: Vàng | Kiểu/Size: 16cm | Giá: 200 · Giá SAPHIA: 250');
ok(/• Bạc → 100/.test(two) && /• Vàng → 16cm: Giá: 200 · Giá SAPHIA: 250/.test(two) && /SẢN PHẨM: B/.test(two), 'mac dinh khong ghi size; nhieu loai gia giu nhan; nhieu san pham tach dung: ' + JSON.stringify(two));

const ai = 'Dạ nhẫn bạc trơn size 12 giá 450.000đ ạ.\nBạc 925 - 16cm - 2.310.000đ';
ok(compact(ai) === ai, 'van tu do cua AI giu NGUYEN, khong bi dong cham');
ok(compact('') === '' && compact(null) === '', 'rong/null an toan');
const fb = compact('Giá theo bảng giá (nghìn đồng — vd 2.310 = 2.310.000đ):\n' + raw);
ok(/^Giá theo bảng giá/.test(fb) && /size 12: 450 · size 13: 480/.test(fb), 'du phong khi AI loi (co dong dan) van gop');
if (bad) { console.error(bad + ' LOI'); process.exit(1); } console.log('ALL PANCAKE PRICE-COMPACT TESTS PASSED');
