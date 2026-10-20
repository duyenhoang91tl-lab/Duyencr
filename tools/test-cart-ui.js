#!/usr/bin/env node
// Test (jsdom) SOAN DON — S1 GIO HANG: Zalo AI (addToCartZai_/renderCartZai_/_zaiBuildCartSummaryText_/loadCartForCurrentPhoneZai_/bindCartZai_...) SONG SONG voi Pancake AI.
// Cat NGUYEN VAN ma 2 ben, chay CUNG gio hang + CUNG thao tac, so khop: HTML, TONG TIEN, TIN NHAN TONG KET (so sanh chuoi chinh xac), luu/nap theo SDT, nut Copy/Xoa.
// CAN: npm i jsdom (thieu thi bo qua). Chay: node tools/test-cart-ui.js -> "ALL CART UI TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function declSpan(src, name) {   // function X(){...} | const X = ...; | let X = ...;
  for (const p of ['function ', 'const ', 'let ']) { const key = p + name; const i = src.indexOf(key); if (i < 0) continue; const st = src.lastIndexOf('\n', i) + 1;
    if (p === 'function ') { let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(st, m + 1); } } }
    let depth = 0; for (let j = i; j < src.length; j++) { const ch = src[j]; if ('({['.includes(ch)) depth++; else if (')}]'.includes(ch)) depth--; else if (ch === ';' && depth === 0) return src.slice(st, j + 1); } }
  throw new Error('khong thay ' + name);
}
const dd = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return ' @' + i + '\nZALO    ...' + a.slice(Math.max(0, i - 100), i + 200) + '\nPANCAKE ...' + b.slice(Math.max(0, i - 100), i + 200); };
const escA = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ---- mã 2 bên ----
const P_FUNCS = ['_applyPromo_', '_lineTotal_', '_cartKey_', 'loadCartForCurrentPhone_', 'saveCart_', 'addToCart_', '_updateCartItem_', '_cartTotals_', '_renderCartTotal_', 'sanitizeProductName_', '_sentenceCase_', '_buildCartSummaryText_', 'renderCart_', 'updateGoldUnitLabel_', '_parseNumberedList_', '_splitTopLevel_'];
const pstate = ['_cartItems', '_cartExtra', '_cartLoadedFor', 'PK_SHIP_FEE', 'PRODUCT_NAME_OVERRIDES'].map(n => declSpan(psrc, n)).join('\n');
let pbind = psrc.slice(psrc.indexOf("panelEl.querySelector('#pk-cart-add-manual')"), psrc.indexOf('    if (IS_PHONGTHUY) {', psrc.indexOf("panelEl.querySelector('#pk-cart-add-manual')")));
pbind = pbind.split('\n').filter(l => !/#pk-cart-promo-calc/.test(l)).join('\n');
const pchunk = 'let _bannedWords = [], _goldUnitAmount = 350000, _currentPhone = "";\n' + pstate + '\n' + P_FUNCS.map(n => declSpan(psrc, n)).join('\n') + '\nfunction bindCart(){\n' + pbind + '\n}\n';
const zchunk = zsrc.slice(zsrc.indexOf('  let _zaiBannedWords = [];'), zsrc.indexOf('  // ── TIM ANH SAN PHAM'));
const zhelp = ['_zaiParseNumberedList_', '_zaiSplitTopLevel_'].map(n => declSpan(zsrc, n)).join('\n');
const pHtml = (() => { let h = psrc.slice(psrc.indexOf('<div id="pk-cart-section" style="display:none">'), psrc.indexOf('\n\n        ${IS_PHONGTHUY')); return h.replace(/\s*<div class="pk-cart-extra-row" id="pk-cart-promo-row">[\s\S]*?<div id="pk-cart-promo-out"[^>]*><\/div>\s*<\/div>/, ''); })();
const zInner = zsrc.slice(zsrc.indexOf('cartSection.innerHTML = `') + 'cartSection.innerHTML = `'.length, zsrc.indexOf('`;\n    body.appendChild(cartSection)'));
const zHtml = '<div id="zai-cart-section">' + zInner + '</div>';
const normStyle = h => h.replace(/style="([^"]*)"/g, (m, v) => 'style="' + v.replace(/:\s+/g, ':').replace(/;\s*$/, '') + '"');   // jsdom in lai style sau khi JS doi -> chuan hoa cach viet
const norm = h => normStyle(h).replace(/ci_\d+_\d+/g, 'ci_ID')   // id dong sinh theo thoi gian + ngau nhien
  .replace(/\s*<div id="(?:pk|zai)-cart-msg">[^<]*<\/div>/g, '')   // dong thong bao rieng cua Zalo (Pancake dung thanh trang thai chung)
  .replace(' hoặc Options Pancake AI', '')   // CO Y khac: trang Options cai don gia vang chi co o Pancake AI
  .replace(/\b(?:pk|zai)-/g, 'X-').replace(/ data-ever-opened="1"/g, '').replace(/\s+/g, ' ').replace(/ id="X-cart-msg"><\/div>/g, '></div>');

function makeSide(kind, phone) {
  const z = kind === 'zalo';
  const dom = new JSDOM('<!doctype html><body>' + (z ? zHtml : '<div id="panel">' + pHtml + '</div>') + '</body>', { runScripts: 'outside-only' }), w = dom.window;
  const env = { store: {}, status: [], clip: [], clipFail: false, confirmAns: true, gets: [], goldReply: { value: '350000' } };
  w.chrome = { storage: { local: { get: (keys, cb) => { const o = {}; keys.forEach(k => { if (env.store[k] !== undefined) o[k] = JSON.parse(JSON.stringify(env.store[k])); }); cb(o); }, set: o => { Object.keys(o).forEach(k => { env.store[k] = JSON.parse(JSON.stringify(o[k])); }); } } } };
  w.navigator.clipboard = { writeText: async t => { if (env.clipFail) throw new Error('no'); env.clip.push(t); } };
  w.confirm = () => env.confirmAns;
  const setStatus = t => env.status.push(t);
  const fetchFn = async (url) => { env.gets.push(url); if (env.goldReply instanceof Error) throw env.goldReply; return { json: async () => env.goldReply }; };
  let api;
  if (z) {
    const f = new w.Function('escAttrZai_', 'GAS_URL', 'fetch', 'document', 'navigator', 'chrome', 'confirm', '_zaiStatusSink', zhelp + '\nlet _currentPhone = "' + (phone || '') + '";\n' + zchunk.replace(/_zaiCartStatus_\(text\) \{[^\n]*\n/, '_zaiCartStatus_(text) { _zaiStatusSink(text); const el = document.getElementById("zai-cart-msg"); if (el) el.textContent = text; }\n') +
      '\nreturn { add: addToCartZai_, render: renderCartZai_, load: loadCartForCurrentPhoneZai_, summary: _zaiBuildCartSummaryText_, totals: _zaiCartTotals_, items: () => _zaiCartItems, extra: () => _zaiCartExtra, setPhone: p => { _currentPhone = p; }, bind: bindCartZai_, gold: loadGoldUnitAmountZai_, goldUnit: () => _zaiGoldUnitAmount, sanitize: sanitizeProductNameZai_ };');
    api = f(escA, 'https://gas.test/exec', fetchFn, w.document, w.navigator, w.chrome, w.confirm, setStatus);
  } else {
    const f = new w.Function('panelEl', 'escapeHtml', 'chrome', 'setStatus', 'navigator', 'confirm', 'document', pchunk + '\nreturn { add: addToCart_, render: renderCart_, load: loadCartForCurrentPhone_, summary: _buildCartSummaryText_, totals: _cartTotals_, items: () => _cartItems, extra: () => _cartExtra, setPhone: p => { _currentPhone = p; }, bind: bindCart, goldUnit: () => _goldUnitAmount, setGold: n => { _goldUnitAmount = n; updateGoldUnitLabel_(); }, sanitize: sanitizeProductName_ };');
    api = f(w.document.getElementById('panel'), escA, w.chrome, setStatus, w.navigator, w.confirm, w.document);
  }
  api.setPhone(phone || '');
  const root = () => w.document.getElementById(z ? 'zai-cart-section' : 'pk-cart-section');
  const q = s => w.document.querySelector(s.replace(/#X-/g, z ? '#zai-' : '#pk-').replace(/\.X-/g, z ? '.zai-' : '.pk-'));
  const qa = s => [...w.document.querySelectorAll(s.replace(/#X-/g, z ? '#zai-' : '#pk-').replace(/\.X-/g, z ? '.zai-' : '.pk-'))];
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  return Object.assign(api, { name: z ? 'Zalo' : 'Pancake', kind, w, env, root, q, qa, fire, html: () => norm(root().outerHTML) });
}
const ITEMS = [
  { name: 'Charm Tỷ Hưu "đặc biệt" <b>x</b>', qty: 2, price: 380000, chatLieu: '1. Bạc 925 2. Vàng 18K: vàng hồng, vàng trắng', mauSac: 'Xanh', size: 'M', note: 'ghi chú nguồn' },
  { name: 'Nhẫn Bạc Trơn', qty: 1, price: 450000, chatLieu: 'Bạc 925', size: '(mặc định)' },
  { name: 'Túi tiền thiên lộc Lộc phúc tình', qty: 3, price: 100000, promoType: 'percent', promoValue: 10, noteExtra: 'tặng hộp' },
  { name: 'Vòng Phong Thủy', qty: 1, price: 2310000, promoType: 'amount', promoValue: 100, inTotalDiscount: false },
  { name: 'Dây Chuyền Quà', qty: 1, price: 1250000, promoType: 'gift', promoValue: 'hộp quà cao cấp' }
];
(async () => {
  const P = makeSide('pancake', '0912000001'), Z = makeSide('zalo', '0912000001'), SIDES = [Z, P];
  for (const S of SIDES) { S.bind(); S.load(); await sleep(5); }
  // 1. rong
  ok(P.html().length > 0 && Z.items().length === 0 && P.items().length === 0, 'khoi tao: gio rong');
  ok(Z.html() === P.html(), 'HTML ban dau (gio rong) GIONG HET:' + dd(Z.html(), P.html()));
  ok(Z.summary() === '' && P.summary() === '', 'chua co san pham: tong ket rong');
  // 2. them dong giong nhau
  for (const S of SIDES) ITEMS.forEach(it => S.add(JSON.parse(JSON.stringify(it))));
  ok(Z.items().length === 5 && Z.items().every((x, i) => x.checked === true && x.id), 'them 5 dong, mac dinh tick');
  const strip = a => a.map(x => Object.assign({}, x, { id: 'ID' }));
  ok(JSON.stringify(strip(Z.items())) === JSON.stringify(strip(P.items())), 'du lieu dong giong het (ke ca tach chat lieu thanh danh sach tick)');
  ok(Z.items()[0].chatLieuOptions.length === 2 && Z.items()[0].chatLieu === '', 'chat lieu danh so -> tach thanh lua chon tick, chua chon gi');
  ok(Z.html() === P.html(), 'HTML sau khi them 5 dong GIONG HET:' + dd(Z.html(), P.html()));
  ok(!Z.q('#X-cart-list').querySelector('script, img, b') && /Charm Tỷ Hưu "đặc biệt" <b>x<\/b>/.test(Z.q('.X-cart-name').value), 'ten co dau nhay / HTML duoc escape trong o nhap');
  // 3. tong tien
  const tz = Z.totals(), tp = P.totals();
  ok(JSON.stringify(tz) === JSON.stringify(tp.constructor === Object ? tp : tp) || (tz.total === tp.total && tz.subtotal === tp.subtotal), 'tong tien giong nhau');
  // tay tinh: 2*380000=760000; 450000; 3*100000 giam 10% = 270000; 2310000-100000 = 2210000; 1250000 -> subtotal
  ok(tz.subtotal === 760000 + 450000 + 270000 + 2210000 + 1250000 && tz.ship === 40000 && tz.total === tz.subtotal + 40000, 'tay tinh: ' + JSON.stringify(tz));
  // 4. sua bang thao tac that: cung chuoi thao tac tren 2 ben
  const edit = async S => {
    const pre = S.kind === 'zalo' ? 'zai' : 'pk', R = (e, sel) => e.querySelector(sel.replace(/\.X-/g, '.' + pre + '-')), RA = (e, sel) => [...e.querySelectorAll(sel.replace(/\.X-/g, '.' + pre + '-'))];
    const rows = S.qa('.X-cart-row'); ok(rows.length === 5, S.name + ': 5 dong');
    const r0 = rows[0];
    RA(r0, '.X-cl-opt-chk')[1].checked = true; S.fire(RA(r0, '.X-cl-opt-chk')[1], 'change');
    const qty = R(r0, '.X-cart-qty'); qty.value = '3'; S.fire(qty, 'input');
    const pr = R(rows[1], '.X-cart-price'); pr.value = '480000'; S.fire(pr, 'input');
    const nm = R(rows[1], '.X-cart-name'); nm.value = 'Nhẫn Bạc Trơn size 12'; S.fire(nm, 'input');
    const mau = R(rows[1], '.X-cart-mausac'); mau.value = 'Trắng'; S.fire(mau, 'input');
    const pt = R(rows[2], '.X-cart-promotype'); pt.value = 'amount'; S.fire(pt, 'change'); const pv = R(rows[2], '.X-cart-promoval'); pv.value = '30'; S.fire(pv, 'input');
    S.fire(R(rows[3], '.X-cart-chk'), 'change');   // chua doi checked -> khong doi
    R(rows[3], '.X-cart-chk').checked = false; S.fire(R(rows[3], '.X-cart-chk'), 'change');   // bo tick dong 4
    const ne = R(rows[4], '.X-cart-noteextra'); ne.value = 'giao nhanh'; S.fire(ne, 'input');
    S.q('#X-cart-showcust').checked = true; S.fire(S.q('#X-cart-showcust'), 'change');
    S.q('#X-cart-honorific').value = 'Chị'; S.fire(S.q('#X-cart-honorific'), 'change');
    S.q('#X-cart-custname').value = 'Lan <x>'; S.fire(S.q('#X-cart-custname'), 'input'); S.q('#X-cart-custphone').value = '0912000001'; S.fire(S.q('#X-cart-custphone'), 'input');
    S.q('#X-cart-address').value = '12 Hàng Bạc, HN'; S.fire(S.q('#X-cart-address'), 'input');
    S.q('#X-cart-discount-type').value = 'percent'; S.fire(S.q('#X-cart-discount-type'), 'change'); S.q('#X-cart-discount-value').value = '5'; S.fire(S.q('#X-cart-discount-value'), 'input');
    S.q('#X-cart-gold').value = '2'; S.fire(S.q('#X-cart-gold'), 'input');
    S.q('#X-cart-freeship').checked = true; S.fire(S.q('#X-cart-freeship'), 'change');
    S.q('#X-cart-status').value = 'ĐÃ CHUYỂN FULL'; S.fire(S.q('#X-cart-status'), 'input'); S.fire(S.q('#X-cart-status'), 'change');
    S.q('#X-cart-gift').value = 'tặng vòng nhỏ'; S.fire(S.q('#X-cart-gift'), 'input'); S.fire(S.q('#X-cart-gift'), 'change');
    const lastTick = R(rows[0], '.X-cart-chk'); S.fire(lastTick, 'change');
  };
  for (const S of SIDES) await edit(S);
  ok(JSON.stringify(Z.extra()) === JSON.stringify(P.extra()), 'phan "extra" giong het: ' + JSON.stringify(Z.extra()) + '\n' + JSON.stringify(P.extra()));
  ok(JSON.stringify(strip(Z.items())) === JSON.stringify(strip(P.items())), 'cac dong sau khi sua giong het');
  ok(Z.html() === P.html(), 'HTML sau khi sua GIONG HET:' + dd(Z.html(), P.html()));
  const Zt = Z.summary(), Pt = P.summary();
  ok(Zt === Pt && Zt.length > 50, 'TIN NHAN TONG KET giong het:\nZALO\n' + Zt + '\nPANCAKE\n' + Pt);
  ok(/túi TL lpt/.test(Zt) && !/túi tiền|thiên lộc|Lộc phúc tình/i.test(Zt), 'quy tac doi ten san pham (PRODUCT_NAME_OVERRIDES) ap dung: ' + Zt.split('\n').find(l => /túi/i.test(l)));
  ok(/Chị Lan <x> 0912000001/.test(Zt) && /Địa chỉ: 12 Hàng Bạc, HN/.test(Zt) && /giảm 30k còn/.test(Zt) && !/Vòng phong thủy/i.test(Zt) && /tặng hộp quà cao cấp|tặng vòng nhỏ/.test(Zt), 'noi dung: KH, dia chi, giam k, bo dong khong tick, qua tang');
  // 5. luu/nap theo SDT
  const key = S => S.kind === 'zalo' ? 'zaiCart_0912000001' : 'pkCart_0912000001';
  for (const S of SIDES) { ok(S.env.store[key(S)] && S.env.store[key(S)].items.length === 5 && S.env.store[key(S)].extra.freeship === true, S.name + ': da luu gio theo SDT'); }
  ok(JSON.stringify(strip(Z.env.store.zaiCart_0912000001.items)) === JSON.stringify(strip(P.env.store.pkCart_0912000001.items)), 'noi dung luu giong het');
  for (const S of SIDES) { S.setPhone('0988888888'); S.load(); await sleep(5); ok(S.items().length === 0 && S.extra().freeship === false && S.extra().discountType === 'none', S.name + ': doi SDT -> gio rong, extra mac dinh'); }
  ok(Z.html() === P.html(), 'HTML gio rong sau doi SDT GIONG HET:' + dd(Z.html(), P.html()));
  for (const S of SIDES) { S.setPhone('0912000001'); S.load(); await sleep(5); ok(S.items().length === 5 && S.extra().custName === 'Lan <x>', S.name + ': quay lai SDT cu -> nap lai gio'); }
  ok(Z.summary() === P.summary(), 'tong ket sau khi nap lai giong het');
  for (const S of SIDES) { S.setPhone(''); S.load(); await sleep(5); S.add({ name: 'X', price: 1000 }); await sleep(5); ok(Object.keys(S.env.store).some(k => /_no_phone_$/.test(k)), S.name + ': chua co SDT -> luu vao khoa _no_phone_'); S.setPhone('0912000001'); S.load(); await sleep(5); }
  // 6. nut Copy / Xoa
  for (const S of SIDES) {
    S.env.status.length = 0; S.q('#X-cart-copy').click(); await sleep(10);
    ok(S.env.clip[0] === S.summary() && /Đã sao chép đơn hàng/.test(S.env.status.join('|')), S.name + ': Copy ghi dung tin nhan + thong bao');
    S.env.clipFail = true; S.env.status.length = 0; S.q('#X-cart-copy').click(); await sleep(10); S.env.clipFail = false;
    ok(/Không sao chép được/.test(S.env.status.join('|')), S.name + ': Copy loi -> thong bao');
  }
  ok(Z.env.clip[0] === P.env.clip[0], 'noi dung Copy 2 ben giong het');
  for (const S of SIDES) { S.items().forEach(i => { i.checked = false; }); S.env.status.length = 0; S.q('#X-cart-copy').click(); await sleep(5); ok(/Chưa có sản phẩm nào được tick/.test(S.env.status.join('|')) && S.env.clip.length === 1, S.name + ': khong tick gi -> nhac, khong copy'); S.items().forEach(i => { i.checked = true; }); }
  for (const S of SIDES) { S.env.confirmAns = false; S.q('#X-cart-clear').click(); ok(S.items().length === 5, S.name + ': huy xoa -> giu nguyen'); S.env.confirmAns = true; S.q('#X-cart-clear').click(); await sleep(5); ok(S.items().length === 0 && S.extra().custName === '' && S.extra().freeship === false, S.name + ': Xoa het -> gio + extra ve mac dinh'); ok(S.env.store[key(S)].items.length === 0, S.name + ': da luu gio rong'); }
  ok(Z.html() === P.html(), 'HTML sau Xoa het GIONG HET:' + dd(Z.html(), P.html()));
  // 7. them dong thu cong
  for (const S of SIDES) { S.q('#X-cart-add-manual').click(); await sleep(50); ok(S.items().length === 1 && S.items()[0].name === '(chưa đặt tên)' && S.root().querySelector('.' + (S.kind === 'zalo' ? 'zai' : 'pk') + '-cart-name'), S.name + ': them dong thu cong'); }
  ok(Z.html() === P.html(), 'HTML sau them dong thu cong GIONG HET:' + dd(Z.html(), P.html()));
  // 8. nhap gia theo nghin (k)
  for (const S of SIDES) { S.items()[0].price = 2800000; S.q('#X-cart-price-k').checked = true; S.fire(S.q('#X-cart-price-k'), 'change'); ok(S.q('.X-cart-price').value === '2800', S.name + ': hien gia theo nghin'); }
  ok(Z.html() === P.html(), 'HTML che do gia nghin GIONG HET:' + dd(Z.html(), P.html()));
  // 9. gia vang
  Z.env.goldReply = { value: '420000' }; await Z.gold(); ok(Z.goldUnit() === 420000 && /420\.000đ/.test(Z.q('#X-cart-gold-label').textContent) && /action=getSetting&key=goldUnitAmount/.test(Z.env.gets.pop()), 'Zalo: don gia vang tu GAS getSetting goldUnitAmount, cap nhat nhan');
  P.setGold(420000); const nOpt = t => t.replace(' hoặc Options Pancake AI', '');   // CO Y khac (xem ghi chu o dau)
  ok(nOpt(Z.q('#X-cart-gold-label').textContent) === nOpt(P.q('#X-cart-gold-label').textContent) && nOpt(Z.q('#X-cart-gold').title) === nOpt(P.q('#X-cart-gold').title), 'nhan + goi y o vang giong het Pancake: [' + Z.q('#X-cart-gold-label').textContent + '] vs [' + P.q('#X-cart-gold-label').textContent + '] / [' + Z.q('#X-cart-gold').title + '] vs [' + P.q('#X-cart-gold').title + ']');
  for (const bad of [{ value: '0' }, { value: 'abc' }, {}, new Error('mat mang')]) { Z.env.goldReply = bad; await Z.gold(); ok(Z.goldUnit() === 350000, 'don gia vang khong hop le/loi -> mac dinh 350.000d: ' + JSON.stringify(bad)); }
  Z.items()[0].price = 100000; Z.extra().gold = 2; Z.extra().freeship = true; ok(Z.totals().gold === 700000, 'tong tien dung don gia vang: ' + Z.totals().gold);
  // 10. noi vao panel Zalo + menu/cau chu
  ok(/cartSection\.id = 'zai-cart-section'/.test(zsrc) && /bindCartZai_\(\);\s*\/\/ sau khi panel/.test(zsrc) && /loadGoldUnitAmountZai_\(\); startCartWatchZai_\(\)/.test(zsrc), 'Zalo: vung gio hang + gan su kien + khoi tao');
  for (const s of ['Đơn hàng đang tính', 'Nhập giá theo nghìn (k)', '＋ Thêm dòng thủ công', 'Thêm thông tin KH (tên, SĐT, địa chỉ)', '📋 Sao chép đơn hàng', '🗑 Xoá hết', 'Chưa có sản phẩm nào được tick trong đơn.', 'Xoá toàn bộ đơn hàng đang tính cho khách này?']) ok(zsrc.includes(s) && psrc.includes(s), 'cau chu giong nhau: ' + s);
  console.log('ALL CART UI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });
