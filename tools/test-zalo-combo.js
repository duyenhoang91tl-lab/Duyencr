// Duyen 2026-11-18: Zalo AI "Soan don" — chon COMBO CO SAN (sheet COMBO) them ca bo vao gio (parity voi Pancake buoc 5/6).
// Chay doan ma THAT trich tu extension-zalo/zalo-content.js trong jsdom. Chay: node tools/test-zalo-combo.js
// (can jsdom; khong co thi bo qua — npm i jsdom o /tmp/jsd, hoac JSDOM_PATH)
const fs = require('fs');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) {
  try { ({ JSDOM } = require(process.env.JSDOM_PATH || '/tmp/jsd/node_modules/jsdom')); } catch (e2) { console.log('SKIP: khong co jsdom'); process.exit(0); }
}
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../extension-zalo/zalo-content.js', 'utf8');


// ---- kiem nguon ----
ok(/'GET_COMBOS'\) url = GAS_URL \+ sep \+ 'action=comboList'/.test(src), 'proxy: GET_COMBOS goi GAS action=comboList');
ok(/throw new Error\('GAS_NO_COMBO'\)/.test(src) && /GAS_NO_FLAT\|GAS_NO_CTKM\|GAS_NO_COMBO/.test(src), 'GAS cu (khong co rows) bao GAS_NO_COMBO, khong bi doi thanh "Loi API"');
ok(/<div id="zaib-combo"><\/div>\s*<div id="zaib-dyn">/.test(src), 'HTML: #zaib-combo nam ngoai #zaib-dyn (renderBuilderDynZai_ khong xoa)');
ok(/if \(_zaiComboRows === null && !_zaiComboLoading\) loadCombosZai_\(\);/.test(src), 'initBuilderZai_ tai combo 1 lan');
ok(/filter\(\(r\) => r && r\.usable\)/.test(src), 'chi giu combo DANG AP DUNG (usable)');
ok(/"version": "2026\.11\.18\.1"/.test(fs.readFileSync(__dirname + '/../extension-zalo/manifest.json', 'utf8')), 'manifest da bump version');

// ---- trich ma that ----
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('no ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
function cst(name) { const i = src.indexOf('const ' + name + ' = '); if (i < 0) throw new Error('no const ' + name); const e = src.indexOf(';\n', i); return src.slice(i, e + 1); }
const dom = new JSDOM('<body><div id="zaib-combo"></div></body>');
const { document } = dom.window;
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');   // y nhu escHtml cua Zalo: KHONG escape dau nhay
const _zaiLocalStripVN_ = s => String(s).replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cart = []; let status = '';
const addToCartZai_ = (it) => cart.push(it);
const _zaiCartStatus_ = (t) => { status = t; };
const body = [cst('_zaiItemFold_'), cst('escAttrZai_'), cst('_zaiComboVndOf_'), cst('_zaiFmtVnd_'), fn('_zaiComboMatches_'), fn('renderBuilderCombosZai_'), fn('addComboToCartZai_'),
  'return { setRows: (r) => { _zaiComboRows = r; }, setQ: (q) => { _zaiBld.q = q; }, render: renderBuilderCombosZai_, match: _zaiComboMatches_, add: addComboToCartZai_ };'].join('\n');
const api = new Function('document', 'escHtml', '_zaiLocalStripVN_', 'addToCartZai_', '_zaiCartStatus_', 'let _zaiComboRows = null; let _zaiBld = { q: "" };\n' + body)(document, escHtml, _zaiLocalStripVN_, addToCartZai_, _zaiCartStatus_);

const combos = [
  { code: 'CB1', name: 'Combo Tỳ hưu đôi', priceVnd: 850000, usable: true, statusLabel: '✅ Đang áp dụng', keywords: 'ty huu cap', itemsText: '2 x Tỳ hưu', note: 'Tặng dây',
    items: [{ name: 'Tỳ hưu', chatLieu: 'Bạc', size: '', qty: 2 }, { name: 'Dây đeo', chatLieu: '', size: 'M', qty: 1 }] },
  { code: 'CB2', name: 'Lắc cỏ 4 lá + charm', priceVnd: 1200000, usable: true, statusLabel: '', keywords: '', itemsText: 'Lắc cỏ 4 lá | Bạc | 16 | 1', note: '', items: [{ name: 'Lắc cỏ 4 lá', chatLieu: 'Bạc', size: '16', qty: 1 }] },
  { code: 'CB3\" onmouseover=\"alert(1)\" <x>', name: 'Combo "lỗi" & thử', priceVnd: 0, usable: true, statusLabel: '', keywords: '', itemsText: '', note: '', items: [] }
];

// 1) rong / null → khong hien gi
api.setRows(null); api.render(); ok(document.getElementById('zaib-combo').innerHTML === '', 'chua tai → khong hien');
api.setRows([]); api.render(); ok(document.getElementById('zaib-combo').innerHTML === '', 'rong (GAS cu) → an');

// 2) loc khong dau
api.setRows(combos);
ok(api.match(combos, '').length === 3, 'bo trong → tat ca');
ok(api.match(combos, 'ty huu').map(c => c.code).join() === 'CB1', 'go "ty huu" khong dau → CB1');
ok(api.match(combos, 'co 4 la').map(c => c.code).join() === 'CB2', 'go "co 4 la" khop ten khong dau → CB2');
ok(api.match(combos, 'khong co gi').length === 0, 'khong khop → rong');

// 3) render + thoat HTML
api.setQ(''); api.render();
const host = document.getElementById('zaib-combo');
ok(host.querySelectorAll('.zaib-combo-add').length === 3, 'hien 3 nut + Them combo');
ok(/850\.000đ/.test(host.textContent), 'hien gia dong day du: ' + (host.textContent.match(/\d[\d.]*đ/g) || []).join(','));
// Ma combo la du lieu tu sheet (admin go) nen coi nhu KHONG TIN CAY: ma chua dau " + onmouseover + the <x> khong duoc thoat khoi thuoc tinh data-code.
// (Luu y: trong thuoc tinh co ngoac kep thi < > vo hai — thu can escape that su la dau ". Kiem bang DOM, khong so chuoi innerHTML vi serializer jsdom ghi < > tho.)
const evilCode = 'CB3" onmouseover="alert(1)" <x>';
const evilBtns = [...host.querySelectorAll('.zaib-combo-add'), ...host.querySelectorAll('.zaib-combo-qty')];
ok(evilBtns.length === 6 && host.querySelectorAll('[onmouseover]').length === 0, 'ma co chua dau " khong chen duoc thuoc tinh onmouseover (' + host.querySelectorAll('[onmouseover]').length + ' phan tu bi chen, ' + evilBtns.length + '/6 nut+o so luong)');
ok(host.querySelector('x') === null && evilBtns.filter(el => el.getAttribute('data-code') === evilCode).length === 2, 'ma co giu dung chuoi goc trong data-code (nut + o so luong) va khong sinh the <x>');
api.setQ('zzz'); api.render(); ok(/Không có combo nào khớp/.test(host.textContent), 'khong khop → thong bao');

// 4) bam them combo (so bo = 2)
api.setQ('ty huu'); api.render();
host.querySelector('.zaib-combo-qty').value = '2';
host.querySelector('.zaib-combo-add').click();
ok(cart.length === 3, 'combo 2 mon → 3 dong (1 tieu de + 2 mon): ' + cart.length);
ok(cart[0].price === 850000 && cart[0].qty === 2 && /Combo Tỳ hưu đôi \(CB1\)/.test(cart[0].name), 'dong tieu de mang gia combo, qty = so bo');
ok(cart[1].price === 0 && cart[1].qty === 4 && cart[1].chatLieu === 'Bạc', 'mon 1: gia 0, SL 2 x 2 bo = 4');
ok(cart[2].price === 0 && cart[2].qty === 2 && cart[2].size === 'M', 'mon 2: gia 0, SL 1 x 2 bo = 2');
ok(cart.reduce((s, it) => s + it.price * it.qty, 0) === 1700000, 'tong gio = 2 bo x 850.000 = 1.700.000');
ok(/Đã thêm combo/.test(status), 'bao da them');

// 5) combo thieu mon/gia → chan, khong them dong nao
cart.length = 0; api.add(combos[2], 1);
ok(cart.length === 0 && /thiếu món hoặc giá/.test(status), 'combo thieu mon/gia → bao loi, khong them');

console.log(bad ? ('\n' + bad + ' LOI') : '\nTAT CA DAT'); process.exit(bad ? 1 : 0);
