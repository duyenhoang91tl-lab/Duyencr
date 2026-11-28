#!/usr/bin/env node
// Test (jsdom) ZALO AI — o TIM GIA gom cac dong CUNG SAN PHAM thanh 1 the (song song voi tools/test-pancake-price-group.js, quy tac docs/crm-kb/08-extension-parity.md).
// NGUYEN NHAN GOC (Duyen 21/11/2026, kem anh): renderPriceRowsZai_ ve MOI DONG SHEET 1 THE lap du Nhom/Ten/Chat lieu, va nhan cot gia bang /gia|price/i truc tiep tren tieu de CO DAU
// ("Giá thường") nen KHONG BAO GIO khop -> gia hien lan trong cac truong khac, la so NGHIN tho. Zalo CHUA co nut "+ Them" o ket qua tim gia (chi o che do Soan don) nen khong test gio hang.
// Chay: node tools/test-zalo-price-group.js -> "ALL ZALO PRICE-GROUP TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.error('FAIL: ' + m); } else console.log('ok  ', m); };
function fnSrc(name) { const i = src.indexOf('  function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0; for (let j = src.indexOf('{', i); j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
const chunk = "let _zaiStonePref = '';\n" + ['escHtml', 'zaiFold_', 'renderPriceRowsZai_'].map(fnSrc).join('\n') + "\nreturn { renderPriceRowsZai_, setStone: (v) => { _zaiStonePref = v; } };";
function mk() {
  const dom = new JSDOM('<!doctype html><body><div id="zai-price-result"></div></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
  const w = dom.window; const api = new w.Function(chunk)();
  return { d: w.document, api, box: w.document.getElementById('zai-price-result') };
}
const txt = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const MAT1 = 'VÀNG 10K\nNgọc bích, lam thủy, cẩm thạch type B\nĐá Tourmaline ( Xanh lá, vàng, hồng tím )\nĐá moon trắng';
const NAME = 'TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC';
const TY = (size, gia, cl) => ({ 'Nhóm sản phẩm': 'NHẪN 10K', 'Tên thương mại': NAME, 'Tên sản phẩm': NAME, 'Chất liệu': cl || '', 'Kiểu/Size': size, 'Giá thường': gia });

// 1) CA TRONG ANH
let { d, api, box } = mk();
api.renderPriceRowsZai_([TY('SIZE 1', 6350, MAT1), TY('SIZE 2', 7350), TY('SIZE 3', 8350)], 'nhẫn tỷ hưu');
ok(box.querySelectorAll('.zai-price-item').length === 1 && box.querySelectorAll('.zai-price-group').length === 1, 'ca trong anh: 3 dong sheet -> CHI 1 the');
ok((txt(box).match(/TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC/g) || []).length === 1 && (txt(box).match(/Nhóm sản phẩm/g) || []).length === 1, 'ten san pham + nhom hien DUNG 1 LAN ("Ten thuong mai" trung bi an)');
ok(box.querySelectorAll('.zai-price-mat').length === 1 && /VÀNG 10K · Ngọc bích, lam thủy, cẩm thạch type B · Đá Tourmaline \( Xanh lá, vàng, hồng tím \) · Đá moon trắng/.test(txt(box.querySelector('.zai-price-mat'))), 'chat lieu 1 lan, o nhieu dong gop 1 dong');
const vars = [...box.querySelectorAll('.zai-price-var')];
ok(vars.length === 3 && vars.map(v => txt(v.querySelector('.zai-price-vlabel')) + '=' + txt(v.querySelector('.zai-price-vprice'))).join('|') === 'SIZE 1=6.350.000đ|SIZE 2=7.350.000đ|SIZE 3=8.350.000đ', '3 dong LIEN TIEP: SIZE 1=6.350.000đ | SIZE 2=7.350.000đ | SIZE 3=8.350.000đ');
ok(!/\(không ghi\)|6350/.test(txt(box)), 'khong con gia nghin tho');

// 2) xen ke + the le: gia QUY RA DONG, nhan cot gia co dau duoc nhan dung
({ d, api, box } = mk());
const A = (s, g) => ({ 'Tên sản phẩm': 'NHẪN A', 'Kiểu/Size': s, 'Giá': g }), B = { 'Tên sản phẩm': 'VÒNG B', 'Giá': 900 };
api.renderPriceRowsZai_([A('12', 450), B, A('13', 480)], 'x');
let items = [...box.querySelectorAll('.zai-price-item')];
ok(items.length === 2 && items[0].classList.contains('zai-price-group') && !items[1].classList.contains('zai-price-group'), 'A xen ke B: A gom 1 the, B la the le');
ok(/Size 12/.test(txt(items[0])) && /Size 13/.test(txt(items[0])) && /450\.000đ/.test(txt(items[0])) && /480\.000đ/.test(txt(items[0])), 'size so -> "Size 12", "Size 13", gia ra dong');
ok(/Giá thường:\s*900\.000đ/.test(txt(items[1])) && box.querySelectorAll('.zai-price-amount').length === 1, 'the le: cot "Giá" (co dau) nay duoc NHAN la cot gia -> "Giá thường: 900.000đ" tach dong rieng (truoc day lan trong truong khac, so tho 900)');

// 3) nhieu chat lieu khong lien tiep
({ d, api, box } = mk());
const V = (cl, s, g) => ({ 'Tên sản phẩm': 'VÒNG CUỐN', 'Chất liệu': cl, 'Kiểu/Size': s, 'Giá thường': g });
api.renderPriceRowsZai_([V('BẠC 925', '12', 450), V('VÀNG 10K', '12', 2310), V('BẠC 925', '13', 480)], 'x');
ok(box.querySelectorAll('.zai-price-mat').length === 2 && /Size 12.*450\.000đ.*Size 13.*480\.000đ.*Size 12.*2\.310\.000đ/.test(txt(box)), 'chat lieu khong lien tiep: BAC 925 (12,13) gom 1 dong, roi VANG 10K');

// 4) truong khac nhau giua cac dong
({ d, api, box } = mk());
const M = (mau, s, g) => ({ 'Tên sản phẩm': 'CHARM', 'Màu': mau, 'Kiểu/Size': s, 'Giá': g });
api.renderPriceRowsZai_([M('Đỏ', 'S', 100), M('Xanh', 'S', 120)], 'x');
ok(/\(Màu: Đỏ\)/.test(txt(box)) && /\(Màu: Xanh\)/.test(txt(box)), 'truong khac nhau (Mau) ghi tren tung dong');

// 5) loai da RUBY (radio Zalo)
({ d, api, box } = mk()); api.setStone('RUBY');
const S = (s, g, r) => { const o = { 'Tên sản phẩm': 'NHẪN RUBY', 'Kiểu/Size': s, 'Giá thường': g }; if (r) o['Giá RUBY'] = r; return o; };
api.renderPriceRowsZai_([S('1', 500, 700), S('2', 600)], 'x');
ok(/Loại giá:\s*Giá RUBY/.test(txt(box)) && /700\.000đ/.test(txt(box)) && /không có giá riêng cho RUBY/.test(txt(box)) && /600\.000đ/.test(txt(box)), 'tick RUBY: "Loai gia: Gia RUBY", 700.000đ, dong thieu lui ve gia thuong + ghi chu');

// 6) khong co gia; 7) escape; 8) 2 SP khac nhau cung nhom; khong co cot ten; >30; rong
({ d, api, box } = mk()); api.renderPriceRowsZai_([{ 'Tên sản phẩm': 'MẪU', 'Kiểu/Size': 'A' }, { 'Tên sản phẩm': 'MẪU', 'Kiểu/Size': 'B' }], 'x');
ok(/chưa có giá/.test(txt(box.querySelector('.zai-price-vprice'))), 'dong khong co cot gia -> "chua co gia"');
({ d, api, box } = mk());
api.renderPriceRowsZai_([{ 'Tên sản phẩm': '<b>X</b>', 'Chất liệu': '<i>m</i>', 'Kiểu/Size': '"><img src=x onerror=1>', 'Giá': 100 }, { 'Tên sản phẩm': '<b>X</b>', 'Chất liệu': '<i>m</i>', 'Kiểu/Size': 'S2', 'Giá': 200 }], 'x');
ok(box.querySelectorAll('img, i').length === 0 && /<b>X<\/b>/.test(txt(box)) && box.querySelectorAll('[onerror]').length === 0, 'ten/chat lieu/size co HTML duoc escape');
({ d, api, box } = mk());
const NH = (ten, s, g) => ({ 'Nhóm sản phẩm': 'NHẪN 10K', 'Tên sản phẩm': ten, 'Kiểu/Size': s, 'Giá thường': g });
api.renderPriceRowsZai_([NH('NHẪN TỶ HƯU', 'SIZE 1', 6350), NH('NHẪN LỘC PHÚC', 'SIZE 1', 4100), NH('NHẪN TỶ HƯU', 'SIZE 2', 7350)], 'x');
items = [...box.querySelectorAll('.zai-price-item')];
ok(items.length === 2 && items[0].querySelectorAll('.zai-price-var').length === 2 && items[1].querySelectorAll('.zai-price-var').length === 0, '2 san pham KHAC nhau cung nhom: chi gom dung san pham');
({ d, api, box } = mk()); api.renderPriceRowsZai_([{ 'Nhóm sản phẩm': 'NHẪN 10K', 'Kiểu/Size': 'S1', 'Giá': 100 }, { 'Nhóm sản phẩm': 'NHẪN 10K', 'Kiểu/Size': 'S2', 'Giá': 200 }], 'x');
ok(box.querySelectorAll('.zai-price-item').length === 2 && box.querySelectorAll('.zai-price-group').length === 0, 'chi co cot nhom (khong co cot TEN) -> KHONG gom');
({ d, api, box } = mk()); api.renderPriceRowsZai_([{ 'STT': 1, 'Tên sản phẩm': 'SP', 'Khóa tra cứu (ẩn)': 'xxkey', 'Giá': 100 }], 'x');
ok(!/xxkey|STT/.test(txt(box)), 'cot STT + "Khoa" bi an (nhu Pancake)');
({ d, api, box } = mk()); api.renderPriceRowsZai_(Array.from({ length: 45 }, (_, i) => ({ 'Tên sản phẩm': 'SP ' + i, 'Giá': 10 })), 'x'); ok(box.querySelectorAll('.zai-price-item').length === 30, 'toi da 30 dong');
({ d, api, box } = mk()); api.renderPriceRowsZai_([], 'zzz'); ok(/Không tìm thấy sản phẩm cho "zzz"/.test(box.textContent), 'rong -> "Khong tim thay" nhu cu');
console.log(bad ? '\n' + bad + ' LOI' : '\nALL ZALO PRICE-GROUP TESTS PASSED'); process.exit(bad ? 1 : 0);
