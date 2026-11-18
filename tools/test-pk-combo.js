// Duyen 2026-11-18: Pancake AI "Soan don" — chon COMBO CO SAN (sheet COMBO) them ca bo vao gio (buoc 5/6).
// Chay doan ma THAT trich tu extension-pancake/pancake-content.js trong jsdom. Chay: node tools/test-pk-combo.js
// (can jsdom; khong co thi bo qua — npm i jsdom o /tmp/jsd, hoac JSDOM_PATH)
const fs = require('fs');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) {
  try { ({ JSDOM } = require(process.env.JSDOM_PATH || '/tmp/jsd/node_modules/jsdom')); } catch (e2) { console.log('SKIP: khong co jsdom'); process.exit(0); }
}
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../extension-pancake/pancake-content.js', 'utf8');
const bg = fs.readFileSync(__dirname + '/../extension-pancake/pancake-background.js', 'utf8');

// ---- kiem nguon ----
ok(/msg\?\.type === "GET_COMBOS"/.test(bg) && /action=comboList/.test(bg), 'background: co GET_COMBOS goi GAS action=comboList');
ok(/GAS_NO_COMBO/.test(bg), 'background: GAS cu (khong co rows) bao GAS_NO_COMBO');
ok(/msg\?\.type === "GET_COMBO_IMAGE"/.test(bg) && /action=comboImage&id=/.test(bg) && /\^\[A-Za-z0-9_-\]\{15,\}\$/.test(bg.slice(bg.indexOf('async function handleGetComboImage'))), 'background: GET_COMBO_IMAGE goi GAS comboImage, kiem dinh dang ID');
ok(/new ClipboardEvent\('paste'/.test(src) && /async function sendComboImages_/.test(src) && /_slashGetChatBox_\(\)/.test(src.slice(src.indexOf('async function sendComboImages_'), src.indexOf('async function sendComboImages_') + 600)), 'content: sendComboImages_ dan anh vao o chat bang paste');
ok(/<div id="pkb-combo"><\/div>\s*<div id="pkb-dyn">/.test(src), 'HTML: #pkb-combo nam ngoai #pkb-dyn (renderBuilderDyn_ khong xoa)');
ok(/if \(_comboRows === null && !_comboLoading\) loadCombos_\(\);/.test(src), 'initBuilder_ tai combo 1 lan');
ok(/filter\(\(r\) => r && r\.usable\)/.test(src), 'chi giu combo DANG AP DUNG (usable)');

// ---- trich ma that ----
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('no ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
function cst(name) { const i = src.indexOf('const ' + name + ' = '); const e = src.indexOf(';\n', i); return src.slice(i, e + 1); }
const dom = new JSDOM('<body><div id="pk-ai-panel"><div id="pkb-combo"></div></div></body>');
const { document } = dom.window;
const panelEl = document.getElementById('pk-ai-panel');
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _stripVNlocal_ = s => String(s).replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cart = []; let status = ''; const sent = [];
const addToCart_ = (it) => cart.push(it);
const setStatus = (t) => { status = t; };
const body = [cst('_fold_'), cst('_comboVndOf_'), cst('_fmtVnd_'), fn('_comboMatches_'), fn('_comboImgIds_'), fn('renderBuilderCombos_'), fn('addComboToCart_'),
  'return { setRows: (r) => { _comboRows = r; }, setQ: (q) => { _bld.q = q; }, render: renderBuilderCombos_, match: _comboMatches_, add: addComboToCart_, fmt: _fmtVnd_ };'].join('\n');
const api = new Function('panelEl', 'escapeHtml', '_stripVNlocal_', 'addToCart_', 'setStatus', '_getComboImageFile_', 'sendComboImages_', '_copyComboImage_', 'let _comboRows = null; let _bld = { q: "" };\n' + body)(panelEl, escapeHtml, _stripVNlocal_, addToCart_, setStatus, () => Promise.reject(new Error('stub')), (c) => { sent.push(c.code); }, () => {});

const combos = [
  { code: 'CB1', name: 'Combo Tỳ hưu đôi', priceVnd: 850000, usable: true, statusLabel: '✅ Đang áp dụng', keywords: 'ty huu cap', itemsText: '2 x Tỳ hưu', note: 'Tặng dây',
    items: [{ name: 'Tỳ hưu', chatLieu: 'Bạc', size: '', qty: 2 }, { name: 'Dây đeo', chatLieu: '', size: 'M', qty: 1 }] },
  { code: 'CB2', name: 'Lắc cỏ 4 lá + charm', priceVnd: 1200000, usable: true, statusLabel: '', keywords: '', itemsText: 'Lắc cỏ 4 lá | Bạc | 16 | 1', note: '', items: [{ name: 'Lắc cỏ 4 lá', chatLieu: 'Bạc', size: '16', qty: 1 }] },
  { code: 'CB3\" onmouseover=\"alert(1)\" <x>', name: 'Combo "lỗi" & thử', priceVnd: 0, usable: true, statusLabel: '', keywords: '', itemsText: '', note: '', items: [] }
];

// 1) rong / null → khong hien gi
api.setRows(null); api.render(); ok(panelEl.querySelector('#pkb-combo').innerHTML === '', 'chua tai → khong hien');
api.setRows([]); api.render(); ok(panelEl.querySelector('#pkb-combo').innerHTML === '', 'rong (GAS cu) → an');

// 2) loc khong dau
api.setRows(combos);
ok(api.match(combos, '').length === 3, 'bo trong → tat ca');
ok(api.match(combos, 'ty huu').map(c => c.code).join() === 'CB1', 'go "ty huu" khong dau → CB1');
ok(api.match(combos, 'co 4 la').map(c => c.code).join() === 'CB2', 'go "co 4 la" khop ten khong dau → CB2');
ok(api.match(combos, 'khong co gi').length === 0, 'khong khop → rong');

// 3) render + thoat HTML
api.setQ(''); api.render();
const host = panelEl.querySelector('#pkb-combo');
ok(host.querySelectorAll('.pkb-combo-add').length === 3, 'hien 3 nut + Them combo');
ok(/850\.000đ/.test(host.textContent), 'hien gia dong day du: ' + (host.textContent.match(/\d[\d.]*đ/g) || []).join(','));
// Ma combo la du lieu tu sheet (admin go) nen coi nhu KHONG TIN CAY: ma chua dau " + onmouseover + the <x> khong duoc thoat khoi thuoc tinh data-code.
// (Luu y: trong thuoc tinh co ngoac kep thi < > vo hai — thu can escape that su la dau ". Kiem bang DOM, khong so chuoi innerHTML vi serializer jsdom ghi < > tho.)
const evilCode = 'CB3" onmouseover="alert(1)" <x>';
const evilBtns = [...host.querySelectorAll('.pkb-combo-add'), ...host.querySelectorAll('.pkb-combo-qty')];
ok(evilBtns.length === 6 && host.querySelectorAll('[onmouseover]').length === 0, 'ma co chua dau " khong chen duoc thuoc tinh onmouseover (' + host.querySelectorAll('[onmouseover]').length + ' phan tu bi chen, ' + evilBtns.length + '/6 nut+o so luong)');
ok(host.querySelector('x') === null && evilBtns.filter(el => el.getAttribute('data-code') === evilCode).length === 2, 'ma co giu dung chuoi goc trong data-code (nut + o so luong) va khong sinh the <x>');
api.setQ('zzz'); api.render(); ok(/Không có combo nào khớp/.test(host.textContent), 'khong khop → thong bao');

// 4) bam them combo (so bo = 2)
api.setQ('ty huu'); api.render();
host.querySelector('.pkb-combo-qty').value = '2';
host.querySelector('.pkb-combo-add').click();
ok(cart.length === 3, 'combo 2 mon → 3 dong (1 tieu de + 2 mon): ' + cart.length);
ok(cart[0].price === 850000 && cart[0].qty === 2 && /Combo Tỳ hưu đôi \(CB1\)/.test(cart[0].name), 'dong tieu de mang gia combo, qty = so bo');
ok(cart[1].price === 0 && cart[1].qty === 4 && cart[1].chatLieu === 'Bạc', 'mon 1: gia 0, SL 2 x 2 bo = 4');
ok(cart[2].price === 0 && cart[2].qty === 2 && cart[2].size === 'M', 'mon 2: gia 0, SL 1 x 2 bo = 2');
ok(cart.reduce((s, it) => s + it.price * it.qty, 0) === 1700000, 'tong gio = 2 bo x 850.000 = 1.700.000');
ok(/Đã thêm combo/.test(status), 'bao da them');

// 5) combo thieu mon/gia → chan, khong them dong nao
cart.length = 0; api.add(combos[2], 1);
ok(cart.length === 0 && /thiếu món hoặc giá/.test(status), 'combo thieu mon/gia → bao loi, khong them');

// ── ẢNH COMBO: nút "📷 Gửi N ảnh" + dải ảnh nhỏ chỉ khi combo có ảnh Drive; bấm nút → sendComboImages_(combo) ──
{
  const ID1 = '1AbCdEfGhIjKlMnOpQrSt', ID2 = '1ZyXwVuTsRqPoNmLkJiHg';
  const withImg = { code: 'CBI', name: 'Combo ảnh', priceVnd: 500000, usable: true, statusLabel: '', keywords: '', itemsText: '', note: '', items: [{ name: 'Nhẫn', qty: 1 }],
    images: ['https://drive.google.com/thumbnail?id=' + ID1 + '&sz=w600', 'https://drive.google.com/thumbnail?id=' + ID2 + '&sz=w600', 'https://example.com/x.jpg'] };
  api.setRows([withImg, combos[1]]); api.setQ(''); api.render();
  const host2 = panelEl.querySelector('#pkb-combo');
  const sendBtns = host2.querySelectorAll('.pkb-combo-send');
  if (sendBtns.length !== 1 || !/Gửi 2 ảnh/.test(sendBtns[0].textContent)) { console.error('FAIL: nut gui anh chi cho combo co anh Drive (2 anh, bo link ngoai Drive): ' + sendBtns.length); process.exit(1); }
  console.log('ok   combo co anh -> nut "Gui 2 anh" (link ngoai Drive bi bo), combo khong anh -> khong co nut');
  if (host2.querySelectorAll('.pkb-combo-img').length !== 2 || host2.querySelectorAll('.pkb-combo-img')[0].getAttribute('data-id') !== ID1) { console.error('FAIL: dai anh nho'); process.exit(1); }
  console.log('ok   dai anh nho dung 2 o, dung id');
  sendBtns[0].click();
  if (sent.join() !== 'CBI') { console.error('FAIL: bam nut phai goi sendComboImages_(combo CBI): ' + sent.join()); process.exit(1); }
  console.log('ok   bam nut -> goi sendComboImages_ dung combo');
}
console.log(bad ? ('\n' + bad + ' LOI') : '\nTAT CA DAT'); process.exit(bad ? 1 : 0);
