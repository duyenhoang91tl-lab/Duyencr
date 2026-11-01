#!/usr/bin/env node
// Test (jsdom) SOAN DON — S2 BO CHON SAN PHAM: Zalo AI (initBuilderZai_/renderBuilderDynZai_/_bindBuilderZai_/loadCtkmZai_/_zaiBldCall_/bindPriceModeZai_/bindStoneZai_)
// SONG SONG voi Pancake AI (cung ma goc). Cat NGUYEN VAN ma 2 ben, chay CUNG danh muc + CUNG chuoi thao tac chon + CUNG CTKM, so khop HTML bo chon, GIO HANG sau "Them vao don", loai da.
// CAN: npm i jsdom (thieu thi bo qua). Chay: node tools/test-builder-ui.js -> "ALL BUILDER UI TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function declSpan(src, name) {
  for (const p of ['function ', 'const ', 'let ']) { const key = p + name; const i = src.indexOf(key); if (i < 0 || /[A-Za-z0-9_]/.test(src[i + key.length] || '')) continue; const st = src.lastIndexOf('\n', i) + 1;
    if (p === 'function ') { let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(st, m + 1); } } }
    let depth = 0; for (let j = i; j < src.length; j++) { const ch = src[j]; if ('({['.includes(ch)) depth++; else if (')}]'.includes(ch)) depth--; else if (ch === ';' && depth === 0) return src.slice(st, j + 1); } }
  throw new Error('khong thay ' + name);
}
const dd = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return ' @' + i + '\nZALO    ...' + a.slice(Math.max(0, i - 120), i + 220) + '\nPANCAKE ...' + b.slice(Math.max(0, i - 120), i + 220); };
const escA = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normStyle = h => h.replace(/style="([^"]*)"/g, (m, v) => 'style="' + v.replace(/:\s+/g, ':').replace(/;\s*$/, '') + '"');
const norm = h => normStyle(h).replace(/ci_\d+_\d+/g, 'ci_ID').replace(' hoặc Options Pancake AI', '').replace(/\s*<div id="(?:pk|zai)-cart-msg">[^<]*<\/div>/g, '').replace(/\bpkb-/g, 'Xb-').replace(/\bzaib-/g, 'Xb-').replace(/\b(?:pk|zai)-/g, 'X-').replace(/ data-ever-opened="1"/g, '').replace(/\s+/g, ' ');

// ---- ma 2 ben ----
const P_BLD_CONSTS = ['PK_CTKM_TTL_MS', '_bldBlank_', '_priceOfItem_', '_stoneLabel_'], P_BLD_LETS = ['_flatItems', '_flatMode', '_flatLoading', '_liveTimer', '_ctkmRows', '_ctkmLoading', '_bld', '_showCtkmInfo'];
const P_BLD_FUNCS = ['_normPriceRow_', '_setBldMsg_', 'initBuilder_', 'loadFlat_', 'loadCtkm_', '_ctkmRowText_', '_ctkmForProduct_', '_liveSearch_', 'renderBuilderDyn_', '_refreshBldTotal_', '_bindBuilder_'];
const P_CART_FUNCS = ['_applyPromo_', '_lineTotal_', '_cartKey_', 'loadCartForCurrentPhone_', 'saveCart_', 'addToCart_', '_updateCartItem_', '_cartTotals_', '_renderCartTotal_', 'sanitizeProductName_', '_sentenceCase_', '_buildCartSummaryText_', 'renderCart_', 'updateGoldUnitLabel_'];
const P_HELP = ['_stripVNlocal_', '_fold_', '_vnSort_', '_itemNames_', '_parseNumberedList_', '_splitTopLevel_', '_parseMaterialTree_'];
const pstate = ['_cartItems', '_cartExtra', '_cartLoadedFor', 'PK_SHIP_FEE', 'PRODUCT_NAME_OVERRIDES'].map(n => declSpan(psrc, n)).join('\n');
const tabsStart = psrc.indexOf("    panelEl.querySelectorAll('.pk-price-mode-btn').forEach((btn) => {"), tabsEnd = psrc.indexOf("    panelEl.querySelector('#pk-cart-add-manual')");
const pconsts = ['PK_FLAT_TTL_MS', 'PK_COLOR_OPTS', 'PK_SHADE_OPTS'].map(n => declSpan(psrc, n)).join('\n');
const pchunk = pconsts + '\n' + 'let _stonePref = "", _bannedWords = [], _goldUnitAmount = 350000, _currentPhone = "";\n' + P_HELP.map(n => declSpan(psrc, n)).join('\n') + '\n' + pstate + '\n' + P_CART_FUNCS.map(n => declSpan(psrc, n)).join('\n') + '\n' +
  P_BLD_CONSTS.map(n => declSpan(psrc, n)).join('\n') + '\n' + P_BLD_LETS.map(n => declSpan(psrc, n)).join('\n') + '\n' + P_BLD_FUNCS.map(n => declSpan(psrc, n)).join('\n') + '\nfunction bindTabs(){\n' + psrc.slice(tabsStart, tabsEnd) + '\n}\n';
const Z_HELP = ['_zaiLocalStripVN_', '_zaiItemFold_', '_zaiVnSort_', '_zaiItemNames_', '_zaiParseNumberedList_', '_zaiSplitTopLevel_', '_zaiParseMaterialTree_'];
const zchunk = Z_HELP.map(n => declSpan(zsrc, n)).join('\n') + '\n' + zsrc.slice(zsrc.indexOf('  let _zaiBannedWords = [];'), zsrc.indexOf('  // ── TIM ANH SAN PHAM'));
const pCartHtml = (() => { let h = psrc.slice(psrc.indexOf('<div id="pk-cart-section" style="display:none">'), psrc.indexOf('\n\n        ${IS_PHONGTHUY')); return h.replace(/\s*<div class="pk-cart-extra-row" id="pk-cart-promo-row">[\s\S]*?<div id="pk-cart-promo-out"[^>]*><\/div>\s*<\/div>/, ''); })();
const zCartInner = zsrc.slice(zsrc.indexOf('cartSection.innerHTML = `') + 'cartSection.innerHTML = `'.length, zsrc.indexOf('`;\n    body.appendChild(cartSection)'));
const STONE_HTML = p => '<div id="' + p + '-stone-row"><input type="radio" name="' + p + '-stone" value="" checked><input type="radio" name="' + p + '-stone" value="SAPHIA"><input type="radio" name="' + p + '-stone" value="RUBY"></div>';
const TABS_HTML = p => '<div id="' + p + '-price-mode-tabs"><button class="' + p + '-price-mode-btn active" data-mode="search">S</button><button class="' + p + '-price-mode-btn" data-mode="builder">B</button></div><div id="' + p + '-price-search-mode">search</div><div id="' + p + '-price-builder-mode" style="display:none"><div id="' + p + (p === 'pk' ? '' : '') + '-builder-steps"></div></div>';

const FLAT = [
  { n: 'Charm', t: 'Charm Tỷ hưu', m: 'TH-01', s: '', c: '1. Aqua xanh biển 2. Citrin: vàng mỡ gà', p: 380, sp: 420, r: 450, mau: 'Xanh', img: '' },
  { n: 'Charm', t: 'Charm Tỷ hưu', m: 'TH-01', s: '', c: 'Bạc 925', p: 350, sp: 0, r: 0, mau: 'Đỏ', img: '' },
  { n: 'Nhẫn', t: 'Nhẫn Bạc Trơn', m: 'NBT', s: 'Size 12', c: 'Bạc 925', p: 450, sp: 0, r: 520, mau: '', img: '' },
  { n: 'Nhẫn', t: 'Nhẫn Bạc Trơn', m: 'NBT', s: 'Size 14', c: 'Bạc 925', p: 470, sp: 0, r: 540, mau: '', img: '' },
  { n: 'Vòng', t: 'Vòng Phong Thủy', m: 'VPT', s: '16cm', c: 'Vàng 18K - Bạc 925', p: 2310, sp: 2600, r: 0, mau: '', img: '' },
  { n: 'Vòng', t: 'Vòng <b>Lạ</b> "x"', m: '', s: '', c: '', p: 0, sp: 0, r: 0, mau: '', img: '' }
];
const CTKM = [
  { 'Tên chương trình': 'Giảm 10% Charm Tỷ hưu', 'Nội dung': 'Giảm 10% đơn từ 2 triệu', __ctkmStatusLabel: '🟢 Đang áp dụng' },
  { 'Tên chương trình': 'Noel Nhẫn bạc', 'Nội dung': 'Tặng hộp', __ctkmUpcoming: true, __ctkmStatusLabel: '⏳ Sắp diễn ra' },
  { 'Tên chương trình': 'Tết cũ Nhẫn', 'Nội dung': 'x', __ctkmExpired: true, __ctkmStatusLabel: '⛔ Hết hạn' },
  { 'Tên chương trình': 'Freeship Vòng', 'Nội dung': 'Miễn ship', __ctkmStatusLabel: '🟢 Đang áp dụng', __ctkmExclusionKey: 'Loại trừ', __ctkmExclusionNote: 'Hàng sale', 'Loại trừ': 'Hàng sale' }
];

function makeSide(kind, opt) {
  opt = opt || {}; const z = kind === 'zalo', pre = z ? 'zai' : 'pk', pb = z ? 'zaib' : 'pkb';
  const stepsHtml = '<div id="' + pre + '-price-mode-tabs"><button class="' + pre + '-price-mode-btn active" data-mode="search">S</button><button class="' + pre + '-price-mode-btn" data-mode="builder">B</button></div>' +
    STONE_HTML(pre).replace(new RegExp(pre + '-stone', 'g'), pre + '-stone') +
    '<div id="' + pre + '-price-search-mode">search</div><div id="' + pre + '-price-builder-mode" style="display:none"><div id="' + pre + '-builder-steps"></div></div>';
  const cartHtml = z ? '<div id="zai-cart-section" style="display:none">' + zCartInner + '</div>' : pCartHtml;
  const dom = new JSDOM('<!doctype html><body>' + (z ? '' : '<div id="panel">') + stepsHtml + cartHtml + (z ? '' : '</div>') + '</body>', { runScripts: 'outside-only' }), w = dom.window;
  const env = { store: opt.store ? JSON.parse(JSON.stringify(opt.store)) : {}, calls: [], status: [], flat: opt.flat === undefined ? { ok: true, data: { items: FLAT } } : opt.flat, ctkm: opt.ctkm === undefined ? { ok: true, data: { rows: CTKM } } : opt.ctkm, price: opt.price || { ok: true, data: { rows: [], total: 0 } } };
  w.chrome = { storage: { local: { get: (keys, cb) => { const o = {}; keys.forEach(k => { if (env.store[k] !== undefined) o[k] = JSON.parse(JSON.stringify(env.store[k])); }); cb(o); }, set: o => { Object.keys(o).forEach(k => { env.store[k] = JSON.parse(JSON.stringify(o[k])); }); } } } };
  w.navigator.clipboard = { writeText: async () => {} }; w.confirm = () => true;
  const reply = (type, p) => { env.calls.push(type + (p && p.q !== undefined ? ':' + p.q : '')); return type === 'GET_PRICE_FLAT' ? env.flat : type === 'GET_CTKM' ? env.ctkm : (typeof env.price === 'function' ? env.price(p) : env.price); };
  let api;
  if (z) {
    const gasToJson = r => r.ok ? (r.data.items ? { items: r.data.items } : { rows: r.data.rows, total: r.data.total }) : { error: r.error };
    const fetchFn = async url => { const t = /^https:\/\/gas\.test\/exec\?action=priceCatalogFlat$/.test(url) ? 'GET_PRICE_FLAT' : /^https:\/\/gas\.test\/exec\?action=ctkmCatalog$/.test(url) ? 'GET_CTKM' : /^https:\/\/gas\.test\/exec\?action=priceSearch(?:&q=|$)/.test(url) ? 'GET_PRICE' : (() => { throw new Error('URL la: ' + url); })(); const q = /[?&]q=([^&]*)/.exec(url); const r = reply(t, q ? { q: decodeURIComponent(q[1]) } : {}); if (r instanceof Error) throw r; return { json: async () => gasToJson(r) }; };
    const f = new w.Function('escAttrZai_', 'GAS_URL', 'fetch', 'document', 'navigator', 'chrome', 'confirm', '_sink', 'Date', zchunk.replace(/_zaiCartStatus_\(text\) \{[^\n]*\n/, '_zaiCartStatus_(text) { _sink(text); }\n') +
      '\nlet _currentPhone = "0912000001";\nreturn { init: initBuilderZai_, render: renderBuilderDynZai_, bld: () => _zaiBld, items: () => _zaiCartItems, extra: () => _zaiCartExtra, flat: () => _zaiFlatItems, mode: () => _zaiFlatMode, ctkm: () => _zaiCtkmRows, loadCart: loadCartForCurrentPhoneZai_, setStone: v => { _zaiStonePref = v; }, bindTabs: bindPriceModeZai_, bindStone: bindStoneZai_, stone: () => _zaiStonePref, bindCart: bindCartZai_ };');
    api = f(escA, 'https://gas.test/exec', fetchFn, w.document, w.navigator, w.chrome, w.confirm, t => env.status.push(t), Date);
  } else {
    const f = new w.Function('panelEl', 'escapeHtml', 'chrome', 'setStatus', 'safeSendMessage_', 'navigator', 'confirm', 'document', pchunk + '\n_currentPhone = "0912000001";\nreturn { init: initBuilder_, render: renderBuilderDyn_, bld: () => _bld, items: () => _cartItems, extra: () => _cartExtra, flat: () => _flatItems, mode: () => _flatMode, ctkm: () => _ctkmRows, loadCart: loadCartForCurrentPhone_, setStone: v => { _stonePref = v; }, bindTabs: bindTabs, stone: () => _stonePref, bindCart: () => {} };');
    const smm = (msg, cb) => { const r = reply(msg.type, msg.payload); setTimeout(() => cb(r instanceof Error ? { ok: false, error: r.message } : r), 0); };
    api = f(w.document.getElementById('panel'), escA, w.chrome, t => env.status.push(t), smm, w.navigator, w.confirm, w.document);
  }
  const q = s => w.document.querySelector(s.replace(/#Xb-/g, '#' + pb + '-').replace(/#X-/g, '#' + pre + '-').replace(/\.X-/g, '.' + pre + '-'));
  const qa = s => [...w.document.querySelectorAll(s.replace(/#Xb-/g, '#' + pb + '-').replace(/#X-/g, '#' + pre + '-').replace(/\.X-/g, '.' + pre + '-'))];
  const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  const rootHtml = () => norm(w.document.body.innerHTML);
  return Object.assign(api, { name: z ? 'Zalo' : 'Pancake', kind, w, env, q, qa, fire, pb, pre, dyn: () => norm(q('#Xb-dyn') ? q('#Xb-dyn').outerHTML : ''), cartHtml: () => norm(w.document.getElementById(pre + '-cart-section').outerHTML), rootHtml });
}
module.exports = { makeSide, FLAT, CTKM, norm, dd, sleep, ok };
if (require.main === module) (async () => {
  const keyFlat = S => S.kind === 'zalo' ? 'zaiPriceFlat' : 'pkPriceFlat', keyCtkm = S => S.kind === 'zalo' ? 'zaiCtkm' : 'pkCtkm';
  const same = (Z, P, label) => ok(Z.dyn() === P.dyn(), 'HTML bo chon GIONG HET o buoc "' + label + '":' + dd(Z.dyn(), P.dyn()));
  const setv = async (S, id, v, evs) => { const el = S.q('#Xb-' + id); ok(el, S.name + ': khong co o ' + id); el.value = v; (evs || ['input', 'change']).forEach(e => S.fire(el, e)); await sleep(230); };
  const chk = async (S, id, on) => { const el = S.q('#Xb-' + id); el.checked = on; S.fire(el, 'change'); await sleep(60); };
  const both = async (Z, P, fn) => { await fn(Z); await fn(P); };
  // ===== 1. mo lan dau + goi y =====
  let Z = makeSide('zalo'), P = makeSide('pancake'); const SIDES = () => [Z, P];
  for (const S of SIDES()) { S.init(); await sleep(60); }
  same(Z, P, 'mo lan dau'); ok(Z.mode() === 'full' && Z.flat().length === 6 && Z.env.calls.filter(c => c === 'GET_PRICE_FLAT').length === 1, 'nap danh muc phang 1 lan, che do full');
  ok(Z.env.store.zaiPriceFlat && Z.env.store.zaiPriceFlat.items.length === 6 && P.env.store.pkPriceFlat.items.length === 6, 'cache danh muc o chrome.storage.local');
  for (const S of SIDES()) { S.init(); await sleep(30); } ok(Z.env.calls.filter(c => c === 'GET_PRICE_FLAT').length === 1, 'mo lai khong nap lai (dung cache)');
  // cache: mo lai trang (side moi, cung chrome.storage) -> dung cache, KHONG nap lai; qua han 15 phut -> nap lai
  for (const kind of ['zalo', 'pancake']) { const src = kind === 'zalo' ? Z : P, k = keyFlat(src);
    const fresh = makeSide(kind, { store: src.env.store }); fresh.init(); await sleep(60); ok(fresh.mode() === 'full' && fresh.flat().length === 6 && !fresh.env.calls.includes('GET_PRICE_FLAT'), kind + ': mo lai trang -> dung cache danh muc, khong goi GAS');
    const st = JSON.parse(JSON.stringify(src.env.store)); st[k].ts = Date.now() - 16 * 60 * 1000; const old = makeSide(kind, { store: st }); old.init(); await sleep(60); ok(old.env.calls.includes('GET_PRICE_FLAT'), kind + ': cache qua 15 phut -> nap lai');
    const st2 = JSON.parse(JSON.stringify(src.env.store)); st2[k].ts = Date.now() - 14 * 60 * 1000; const ok14 = makeSide(kind, { store: st2 }); ok14.init(); await sleep(60); ok(!ok14.env.calls.includes('GET_PRICE_FLAT'), kind + ': cache 14 phut con dung duoc'); }
  // ===== 2. chuoi chon =====
  await both(Z, P, S => setv(S, 'q', 'ty huu')); same(Z, P, 'go "ty huu" (khong dau)');
  await both(Z, P, S => setv(S, 'q', '')); await both(Z, P, S => setv(S, 'nhom', 'Charm')); same(Z, P, 'chon nhom Charm');
  await both(Z, P, S => setv(S, 'ten', 'Charm Tỷ hưu')); same(Z, P, 'chon ten');
  await both(Z, P, S => setv(S, 'cl', 'Bạc 925')); same(Z, P, 'chon chat lieu Bac 925');
  ok(Z.q('#Xb-price').value === '350' && Z.q('#Xb-line-total').textContent === 'Thành tiền: 350.000đ', 'gia mac dinh 350k (dong Bac 925)');
  await both(Z, P, S => setv(S, 'qty', '3')); await both(Z, P, S => setv(S, 'mau', 'Xanh rêu')); await both(Z, P, S => setv(S, 'dam', 'Đậm'));
  await both(Z, P, S => setv(S, 'promotype', 'percent', ['change'])); await both(Z, P, S => setv(S, 'promoval', '10'));
  same(Z, P, 'so luong 3, mau, dam, giam 10%'); ok(/Thành tiền: 945\.000đ/.test(Z.q('#Xb-line-total').textContent), 'thanh tien: 3 x 350k giam 10% = 945.000d: ' + Z.q('#Xb-line-total').textContent);
  // ===== 3. loai da =====
  await both(Z, P, S => setv(S, 'cl', '1. Aqua xanh biển 2. Citrin: vàng mỡ gà')); for (const S of SIDES()) { S.setStone('SAPHIA'); S.render(); await sleep(30); }
  same(Z, P, 'chat lieu danh so + loai da SAPHIA'); ok(Z.q('#Xb-price').value === '420', 'SAPHIA -> gia 420k: ' + Z.q('#Xb-price').value);
  for (const S of SIDES()) { S.setStone('RUBY'); S.render(); await sleep(30); } same(Z, P, 'loai da RUBY'); ok(Z.q('#Xb-price').value === '450', 'RUBY -> 450k');
  for (const S of SIDES()) { S.setStone(''); S.render(); await sleep(30); } ok(Z.q('#Xb-price').value === '380', 'mac dinh -> 380k');
  // ===== 4. CTKM tham khao =====
  await both(Z, P, S => chk(S, 'ctkm-info-toggle', true)); await sleep(80); same(Z, P, 'bat thong tin CTKM'); 
  ok(Z.ctkm().length === 4 && Z.env.calls.filter(c => c === 'GET_CTKM').length === 1 && Z.env.store.zaiCtkm.rows.length === 4, 'nap CTKM 1 lan + cache');
  const info = Z.q('#Xb-dyn').textContent; ok(/Giảm 10% Charm Tỷ hưu/.test(info) && !/Tết cũ|Noel Nhẫn/.test(info), 'CTKM: chi hien CTKM dang ap dung & lien quan san pham (bo het han / sap dien ra / khong lien quan)');
  // ===== 5. them vao don =====
  for (const S of SIDES()) S.env.status.length = 0;
  await both(Z, P, S => setv(S, 'cl', 'Bạc 925')); await both(Z, P, S => { S.q('#Xb-add-btn').click(); return sleep(120); });
  ok(Z.items().length === 1 && P.items().length === 1, 'them 1 dong vao gio'); const strip = a => a.map(x => Object.assign({}, x, { id: 'ID' }));
  ok(JSON.stringify(strip(Z.items())) === JSON.stringify(strip(P.items())), 'dong gio GIONG HET:\n' + JSON.stringify(strip(Z.items())) + '\n' + JSON.stringify(strip(P.items())));
  const it = Z.items()[0]; ok(it.qty === 3 && it.price === 350000 && it.chatLieu === 'Bạc 925' && /Xanh rêu/.test(it.mauSac) && /Đậm/.test(it.mauSac + (it.note || '')) && it.promoType === 'percent' && it.promoValue === 10, 'noi dung dong: ' + JSON.stringify(it));
  same(Z, P, 'form ve trang sau khi them'); ok(Z.cartHtml() === P.cartHtml(), 'HTML GIO HANG sau khi them GIONG HET:' + dd(Z.cartHtml(), P.cartHtml()));
  ok(JSON.stringify(Z.env.status) === JSON.stringify(P.env.status) && /Đã thêm "Charm Tỷ hưu" vào đơn/.test(Z.env.status.join('|')), 'thong bao them vao don giong het: ' + JSON.stringify(Z.env.status));
  ok(Z.q('#X-cart-section').style.display !== 'none', 'gio hang hien ra sau khi them');
  // san pham thu 2 co chat lieu danh so (tick nhieu) + san pham khong co gia
  await both(Z, P, S => setv(S, 'nhom', 'Charm')); await both(Z, P, S => setv(S, 'ten', 'Charm Tỷ hưu')); await both(Z, P, S => setv(S, 'cl', '1. Aqua xanh biển 2. Citrin: vàng mỡ gà'));
  for (const S of SIDES()) { S.setStone('SAPHIA'); S.render(); } await sleep(30); await both(Z, P, S => { S.q('#Xb-add-btn').click(); return sleep(100); });
  await both(Z, P, S => setv(S, 'nhom', 'Vòng')); await both(Z, P, S => setv(S, 'ten', 'Vòng <b>Lạ</b> "x"')); same(Z, P, 'san pham co HTML trong ten + khong gia'); ok(![...Z.qa('#Xb-dyn b')].some(b => b.textContent === 'Lạ') && /Vòng <b>Lạ<\/b> "x"/.test(Z.q('#Xb-ten').value), 'HTML trong ten bi escape (chi con la chuoi chu)'); await both(Z, P, S => { S.q('#Xb-add-btn').click(); return sleep(100); });
  ok(Z.items().length === 3 && JSON.stringify(strip(Z.items())) === JSON.stringify(strip(P.items())), 'gio 3 dong, giong het');
  ok(Z.items()[1].chatLieuOptions && Z.items()[1].chatLieuOptions.length === 2 && Z.items()[1].price === 420000, 'dong 2: chat lieu danh so tach thanh lua chon tick + gia SAPHIA 420k');
  ok(Z.cartHtml() === P.cartHtml(), 'HTML gio hang sau 3 dong GIONG HET:' + dd(Z.cartHtml(), P.cartHtml()));
  // ===== 6. che do tim truc tiep khi GAS cu chua co danh muc phang =====
  const rows = [{ 'Nhóm sản phẩm': 'Charm', 'Tên sản phẩm': 'Charm Tỷ hưu', 'Tên thương mại': 'TH-01', 'Kiểu / Size': '', 'Chất liệu': 'Bạc 925', 'Giá bán': '350', 'Giá SAPHIA': '420', 'Giá RUBY': '450' }, { 'Nhóm sản phẩm': 'Nhẫn', 'Tên sản phẩm': 'Nhẫn Bạc', 'Tên thương mại': '', 'Size': 'Size 12', 'Chất liệu': 'Bạc', 'Giá': '450.000' }];
  Z = makeSide('zalo', { flat: { ok: false, error: 'GAS_NO_FLAT' }, price: p => ({ ok: true, data: { rows: /ty/.test((p.q || '').replace(/ỷ/g, 'y')) ? rows : [], total: rows.length } }) }); P = makeSide('pancake', { flat: { ok: false, error: 'GAS_NO_FLAT' }, price: p => ({ ok: true, data: { rows: /ty/.test((p.q || '').replace(/ỷ/g, 'y')) ? rows : [], total: rows.length } }) });
  for (const S of SIDES()) { S.init(); await sleep(60); } same(Z, P, 'GAS cu: chuyen sang tim truc tiep'); ok(Z.mode() === 'live' && /thiếu <b>priceCatalogFlat<\/b>/.test(Z.q('#Xb-msg').innerHTML), 'canh bao GAS cu');
  await both(Z, P, S => setv(S, 'q', 'ty huu')); await sleep(500); same(Z, P, 'tim truc tiep "ty huu"'); ok(Z.flat().length === 2 && Z.flat()[0].sp === 420 && Z.flat()[0].r === 450 && Z.flat()[0].p === 350 && Z.flat()[1].p === 450000 && Z.flat()[1].s === 'Size 12', 'chuan hoa dong tho: gia thuong / SAPHIA / RUBY (+ gia ghi 450.000 -> so)');
  ok(Z.env.calls.some(c => c === 'GET_PRICE:ty huu'), 'goi priceSearch voi tu khoa'); await both(Z, P, S => setv(S, 'q', 'x')); await sleep(500); same(Z, P, 'go <2 ky tu'); ok(/Gõ ít nhất 2 chữ để tìm\./.test(Z.q('#Xb-dyn').textContent), 'nhac go it nhat 2 chu');
  // ===== 7. loi =====
  for (const flat of [{ ok: false, error: 'Khong doc duoc <sheet>' }, { ok: true, data: { items: [] } }]) {
    const a = makeSide('zalo', { flat }), b = makeSide('pancake', { flat }); a.init(); b.init(); await sleep(60); const mA = norm(a.q('#Xb-msg').outerHTML), mB = norm(b.q('#Xb-msg').outerHTML), strip = h => h.replace(/>[^<]*</, '><');   // bo noi dung cau loi: Pancake dung cau chuan 'Lỗi API' (ddaf130), Zalo van 'Lỗi tải danh mục: <chi tiet>'
    ok(a.dyn() === b.dyn() && strip(mA) === strip(mB) && b.q('#Xb-msg').textContent.length > 0, 'loi nap danh muc: cung bo cuc (noi dung cau loi moi ben):' + dd(mA, mB));
    if (mA !== mB) console.log('!!   CANH BAO: cau bao loi nap danh muc cua Zalo CHUA giong Pancake — can lam Zalo song song');
    ok(!a.q('#Xb-msg').querySelector('sheet') && /Lỗi tải danh mục|không nhận diện được cột/.test(a.q('#Xb-msg').textContent), 'thong bao loi/khong nhan dien cot (da escape)');
  }
  // ===== 8. tab che do (Go tim <-> Soan don) =====
  const A = makeSide('zalo'), B = makeSide('pancake'); A.bindTabs(); B.bindTabs();
  for (const S of [A, B]) { ok(S.q('#X-price-search-mode').style.display !== 'none' && S.q('#X-price-builder-mode').style.display === 'none', S.name + ': mac dinh Go tim'); S.qa('.X-price-mode-btn')[1].click(); await sleep(80);
    ok(S.q('#X-price-search-mode').style.display === 'none' && S.q('#X-price-builder-mode').style.display !== 'none' && S.qa('.X-price-mode-btn')[1].classList.contains('active') && S.env.calls.includes('GET_PRICE_FLAT'), S.name + ': bam Soan don -> hien bo chon + nap danh muc');
    S.qa('.X-price-mode-btn')[0].click(); await sleep(20); ok(S.q('#X-price-search-mode').style.display !== 'none' && S.q('#X-price-builder-mode').style.display === 'none', S.name + ': quay lai Go tim'); }
  ok(A.dyn() === B.dyn(), 'bo chon sau khi chuyen tab GIONG HET');
  // ===== 9. loai da (rieng Zalo): nho theo may + bat lai =====
  const C = makeSide('zalo'); C.env.store.ome_stone_pref = 'RUBY'; C.bindStone(); await sleep(20);
  ok(C.stone() === 'RUBY' && C.q('input[name="zai-stone"][value="RUBY"]').checked, 'Zalo: nap loai da da luu (RUBY)');
  C.q('input[name="zai-stone"][value="SAPHIA"]').checked = true; C.fire(C.q('input[name="zai-stone"][value="SAPHIA"]'), 'change'); await sleep(20);
  ok(C.stone() === 'SAPHIA' && C.env.store.ome_stone_pref === 'SAPHIA', 'Zalo: doi loai da -> luu lai theo may');
  // ===== 10. noi vao panel + cau chu =====
  ok(/const priceTabs = addEl\(priceWrap/.test(zsrc) && /name="zai-stone"/.test(zsrc) && /id:'zai-builder-steps'/.test(zsrc) && /bindPriceModeZai_\(\);\s*bindStoneZai_\(\);/.test(zsrc) && /cartSection\.style\.display = 'none'/.test(zsrc), 'Zalo: tab che do + loai da + vung bo chon + gio an cho den khi dung');
  for (const t of ['Nhóm sản phẩm (', 'Tên sản phẩm (', 'Kiểu / Size (', 'Chất liệu (', 'Màu (ghi chú, bỏ trống được)', 'Đậm / nhạt', 'CTKM cho sản phẩm này', '+ Thêm vào đơn', 'Không tìm thấy sản phẩm nào khớp.', 'Gõ ít nhất 2 chữ để tìm.', 'Đang tải danh mục sản phẩm...']) ok(zsrc.includes(t) && psrc.includes(t), 'cau chu giong nhau: ' + t);
  console.log('ALL BUILDER UI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });
