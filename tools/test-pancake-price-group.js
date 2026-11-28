#!/usr/bin/env node
// Test (jsdom) Pancake AI: nut TIM GIA gom cac dong CUNG SAN PHAM thanh 1 the — truong chung 1 lan, moi chat lieu 1 dong, moi SIZE 1 dong "SIZE n — gia [+ Them]".
// NGUYEN NHAN GOC (Duyen 21/11/2026, kem anh): renderPriceRows_ ve MOI DONG SHEET = 1 THE lap du Nhom/Ten/Chat lieu... nen 1 san pham 3 size ra 3 the giong het nhau ("hien lai noi dung 1 loat ben duoi").
// Chay: node tools/test-pancake-price-group.js -> "ALL PANCAKE PRICE-GROUP TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.error('FAIL: ' + m); } else console.log('ok  ', m); };
function fnSrc(name) { const i = src.indexOf('  function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0; for (let j = src.indexOf('{', i); j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } }
const chunk = "let _lastPriceRows = []; let _lastPriceQ = ''; let _stonePref = '';\n" +
  "const _parsePriceNum_ = (v) => parseFloat(String(v).replace(/[^\\d.]/g, '')) || 0; const escapeHtml = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;');\n" +
  ['_stripVNlocal_', 'renderPriceRows_'].map(fnSrc).join('\n') + "\nreturn { renderPriceRows_, setStone: (v) => { _stonePref = v; } };";
function mk() {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><div id="pk-price-result"></div></div></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
  const w = dom.window, cart = [];
  const api = new w.Function('panelEl', 'addToCart_', chunk)(w.document.getElementById('panel'), x => cart.push(x));
  return { d: w.document, api, cart, box: w.document.getElementById('pk-price-result') };
}
const txt = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const MAT1 = 'VÀNG 10K\nNgọc bích, lam thủy, cẩm thạch type B\nĐá Tourmaline ( Xanh lá, vàng, hồng tím )\nĐá moon trắng';
const NAME = 'TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC';
const TY = (size, gia, cl) => ({ 'Nhóm sản phẩm': 'NHẪN 10K', 'Tên thương mại': NAME, 'Tên sản phẩm': NAME, 'Chất liệu': cl || '', 'Kiểu/Size': size, 'Giá thường': gia });

// 1) CA TRONG ANH
let { d, api, cart, box } = mk();
api.renderPriceRows_([TY('SIZE 1', 6350, MAT1), TY('SIZE 2', 7350), TY('SIZE 3', 8350)], 'nhẫn tỷ hưu');
ok(box.querySelectorAll('.pk-price-item').length === 1 && box.querySelectorAll('.pk-price-group').length === 1, 'ca trong anh: 3 dong sheet -> CHI 1 the (truoc day 3 the)');
ok((txt(box).match(/TRANG SỨC NHẪN TỶ HƯU THIÊN LỘC/g) || []).length === 1 && (txt(box).match(/Nhóm sản phẩm/g) || []).length === 1, 'ten san pham + nhom hien DUNG 1 LAN (khong lap cho tung size)');
ok(box.querySelectorAll('.pk-price-mat').length === 1 && /VÀNG 10K · Ngọc bích, lam thủy, cẩm thạch type B · Đá Tourmaline \( Xanh lá, vàng, hồng tím \) · Đá moon trắng/.test(txt(box.querySelector('.pk-price-mat'))), 'chat lieu hien 1 lan, o nhieu dong gop thanh 1 dong');
const vars = [...box.querySelectorAll('.pk-price-var')];
ok(vars.length === 3 && vars.map(v => txt(v.querySelector('.pk-price-vlabel')) + '=' + txt(v.querySelector('.pk-price-vprice'))).join('|') === 'SIZE 1=6.350.000đ|SIZE 2=7.350.000đ|SIZE 3=8.350.000đ', '3 dong LIEN TIEP: SIZE 1=6.350.000đ | SIZE 2=7.350.000đ | SIZE 3=8.350.000đ: ' + vars.map(v => txt(v)).join(' / '));
ok(!/\(không ghi\)|6350/.test(txt(box)), 'khong con "(khong ghi)" / gia nghin tho');
const btns = [...box.querySelectorAll('.pk-price-addbtn')];
ok(btns.length === 3 && btns.map(b => b.dataset.size + ':' + b.dataset.price).join() === 'SIZE 1:6350000,SIZE 2:7350000,SIZE 3:8350000', 'moi dong 1 nut + Them mang dung size + gia: ' + btns.map(b => b.dataset.size + ':' + b.dataset.price).join());
ok(btns[0].dataset.chatlieu === MAT1 && btns[1].dataset.chatlieu === '' && btns[0].dataset.name === NAME, 'data-* cua tung dong giu nguyen nhu cu (chat lieu that cua dong sheet, khong ke thua)');
btns[1].click(); ok(cart.length === 1 && cart[0].price === 7350000 && cart[0].size === 'SIZE 2' && cart[0].name === NAME && cart[0].qty === 1, 'bam + Them o SIZE 2 -> vao gio dung 7.350.000đ, size 2');

// 2) xen ke san pham + the le khong doi
({ d, api, cart, box } = mk());
const A = (s, g) => ({ 'Tên sản phẩm': 'NHẪN A', 'Kiểu/Size': s, 'Giá': g }), B = { 'Tên sản phẩm': 'VÒNG B', 'Giá': 900 };
api.renderPriceRows_([A('12', 450), B, A('13', 480)], 'x');
let items = [...box.querySelectorAll('.pk-price-item')];
ok(items.length === 2 && items[0].classList.contains('pk-price-group') && !items[1].classList.contains('pk-price-group'), 'A xen ke B: A gom 1 the (thu tu theo lan xuat hien dau), B (1 dong) van la the le: ' + items.length);
ok(/Size 12/.test(txt(items[0])) && /Size 13/.test(txt(items[0])) && /450\.000đ/.test(txt(items[0])) && /480\.000đ/.test(txt(items[0])), 'size so -> "Size 12", "Size 13"');
ok(/Giá thường|Giá:/.test(txt(items[1])) && /900\.000đ/.test(txt(items[1])) && items[1].querySelectorAll('.pk-price-var').length === 0, 'the le giu nguyen dang cu (nhan "Gia: 900.000đ", khong co dong size)');

// 3) nhieu chat lieu, khong lien tiep van gom
({ d, api, cart, box } = mk());
const V = (cl, s, g) => ({ 'Tên sản phẩm': 'VÒNG CUỐN', 'Chất liệu': cl, 'Kiểu/Size': s, 'Giá thường': g });
api.renderPriceRows_([V('BẠC 925', '12', 450), V('VÀNG 10K', '12', 2310), V('BẠC 925', '13', 480)], 'x');
const mats = [...box.querySelectorAll('.pk-price-mat')].map(m => txt(m));
ok(mats.length === 2 && /BẠC 925/.test(mats[0]) && /VÀNG 10K/.test(mats[1]) && box.querySelectorAll('.pk-price-var').length === 3, 'chat lieu khong lien tiep: gom BAC 925 (12,13) 1 dong + VANG 10K: ' + mats.join(' | '));
ok(/Size 12.*450\.000đ.*Size 13.*480\.000đ.*Size 12.*2\.310\.000đ/.test(txt(box)), 'thu tu: BAC 925 -> (12, 13), roi VANG 10K -> 12');

// 4) truong KHAC nhau giua cac dong -> nho trong ngoac o dong size
({ d, api, cart, box } = mk());
const M = (mau, s, g) => ({ 'Tên sản phẩm': 'CHARM', 'Màu': mau, 'Kiểu/Size': s, 'Giá': g });
api.renderPriceRows_([M('Đỏ', 'S', 100), M('Xanh', 'S', 120)], 'x');
ok(/\(Màu: Đỏ\)/.test(txt(box)) && /\(Màu: Xanh\)/.test(txt(box)) && !/Màu: Đỏ.*Màu: Đỏ/.test(txt(box)), 'truong khac nhau (Mau) ghi ngay tren tung dong; truong giong nhau khong lap');

// 5) loai da RUBY: nhan + gia rieng + ghi chu khi thieu
({ d, api, cart, box } = mk()); api.setStone('RUBY');
const S = (s, g, r) => { const o = { 'Tên sản phẩm': 'NHẪN RUBY', 'Kiểu/Size': s, 'Giá thường': g }; if (r) o['Giá RUBY'] = r; return o; };
api.renderPriceRows_([S('1', 500, 700), S('2', 600)], 'x');
ok(/Loại giá:\s*Giá RUBY/.test(txt(box)) && /700\.000đ/.test(txt(box)) && /không có giá riêng cho RUBY/.test(txt(box)) && /600\.000đ/.test(txt(box)), 'tick RUBY: ghi "Loai gia: Gia RUBY", size co gia RUBY dung 700.000đ, size thieu lui ve gia thuong + ghi chu');
ok([...box.querySelectorAll('.pk-price-addbtn')].map(b => b.dataset.price).join() === '700000,600000', 'nut + Them mang dung gia theo loai da');

// 6) khong co gia
({ d, api, cart, box } = mk()); api.renderPriceRows_([{ 'Tên sản phẩm': 'MẪU', 'Kiểu/Size': 'A' }, { 'Tên sản phẩm': 'MẪU', 'Kiểu/Size': 'B' }], 'x');
ok(/chưa có giá/.test(txt(box.querySelector('.pk-price-vprice'))) && /\+ Thêm \(chưa có giá\)/.test(box.querySelector('.pk-price-addbtn').textContent), 'dong khong co cot gia -> "chua co gia" + nut ghi ro');

// 7) escape HTML
({ d, api, cart, box } = mk());
api.renderPriceRows_([{ 'Tên sản phẩm': '<b>X</b>', 'Chất liệu': '<i>m</i>', 'Kiểu/Size': '"><img src=x onerror=1>', 'Giá': 100 }, { 'Tên sản phẩm': '<b>X</b>', 'Chất liệu': '<i>m</i>', 'Kiểu/Size': 'S2', 'Giá': 200 }], 'x');
ok(box.querySelectorAll('img, i').length === 0 && /<b>X<\/b>/.test(txt(box)) && box.querySelectorAll('[onerror]').length === 0, 'ten/chat lieu/size co HTML duoc escape, khong chen duoc the/onerror');

// 7b) NGUYEN NHAN GOC phat hien khi lam: nameKey truoc day so regex voi tieu de CO DAU nen khong khop -> lay nham cot dau ("Nhom san pham") lam ten.
// 2 san pham KHAC nhau cung nhom (NHAN 10K) KHONG duoc gom thanh 1 the; ten nut + Them phai la TEN SAN PHAM.
({ d, api, cart, box } = mk());
const NH = (ten, s, g) => ({ 'Nhóm sản phẩm': 'NHẪN 10K', 'Tên sản phẩm': ten, 'Kiểu/Size': s, 'Giá thường': g });
api.renderPriceRows_([NH('NHẪN TỶ HƯU', 'SIZE 1', 6350), NH('NHẪN LỘC PHÚC', 'SIZE 1', 4100), NH('NHẪN TỶ HƯU', 'SIZE 2', 7350)], 'x');
items = [...box.querySelectorAll('.pk-price-item')];
ok(items.length === 2 && /NHẪN TỶ HƯU/.test(txt(items[0])) && items[0].querySelectorAll('.pk-price-var').length === 2 && /NHẪN LỘC PHÚC/.test(txt(items[1])) && items[1].querySelectorAll('.pk-price-var').length === 0, '2 san pham khac nhau cung nhom: chi gom dung san pham (TY HUU 2 size), san pham kia la the le');
ok([...box.querySelectorAll('.pk-price-addbtn')].map(b => b.dataset.name).join() === 'NHẪN TỶ HƯU,NHẪN TỶ HƯU,NHẪN LỘC PHÚC', 'nut + Them ghi TEN SAN PHAM (truoc day ghi ten nhom "NHAN 10K")');
({ d, api, cart, box } = mk());
api.renderPriceRows_([{ 'Nhóm sản phẩm': 'NHẪN 10K', 'Kiểu/Size': 'S1', 'Giá': 100 }, { 'Nhóm sản phẩm': 'NHẪN 10K', 'Kiểu/Size': 'S2', 'Giá': 200 }], 'x');
ok(box.querySelectorAll('.pk-price-item').length === 2 && box.querySelectorAll('.pk-price-group').length === 0, 'khong co cot TEN san pham that (chi co cot nhom) -> KHONG gom (tranh dong nham san pham khac nhau)');
({ d, api, cart, box } = mk());
api.renderPriceRows_([{ 'Tên thương mại': 'ABC', 'Kiểu/Size': '1', 'Giá': 100 }, { 'Tên thương mại': 'ABC', 'Kiểu/Size': '2', 'Giá': 200 }], 'x');
ok(box.querySelectorAll('.pk-price-group').length === 1, 'chi co cot "Ten thuong mai" -> van gom theo cot do');

// 8) khong co cot ten -> khong gom nham; > 30 dong chi lay 30
({ d, api, cart, box } = mk());
api.renderPriceRows_([{ 'Giá': 100 }, { 'Giá': 200 }], 'x'); ok(box.querySelectorAll('.pk-price-item').length === 2 && box.querySelectorAll('.pk-price-group').length === 0, 'dong khong co cot ten (ten gia "San pham N") khong bi gom nham');
({ d, api, cart, box } = mk()); api.renderPriceRows_(Array.from({ length: 45 }, (_, i) => ({ 'Tên sản phẩm': 'SP ' + i, 'Giá': 10 })), 'x'); ok(box.querySelectorAll('.pk-price-item').length === 30, 'van chi hien toi da 30 dong (45 -> 30)');
({ d, api, cart, box } = mk()); api.renderPriceRows_([], 'zzz'); ok(/Không tìm thấy cho "zzz"/.test(box.textContent), 'rong -> "Khong tim thay" nhu cu');
console.log(bad ? '\n' + bad + ' LOI' : '\nALL PANCAKE PRICE-GROUP TESTS PASSED'); process.exit(bad ? 1 : 0);
