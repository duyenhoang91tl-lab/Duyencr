#!/usr/bin/env node
// Test (jsdom) muc "🖼 Tim anh san pham": Zalo AI (initImgSearchZai_/renderImgDynZai_/_loadImgSlotZai_/_zaiParseMaterialTree_) SONG SONG voi Pancake AI.
// Cat NGUYEN VAN ma 2 ben, chay CUNG danh muc mau + CUNG chuoi thao tac chon, so khop HTML (sau khi quy ve class/id chung) va ket qua tach chat lieu 2 cap.
// CAN: npm i jsdom (thieu thi bo qua). Chay: node tools/test-img-ui.js -> "ALL IMG UI TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function fnSpan(src, sig) { const i = src.indexOf(sig); if (i < 0) throw new Error('khong thay ' + sig); const st = src.lastIndexOf('\n', i) + 1; let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(st, m + 1); } } }
const constSpan = (src, name) => { const i = src.indexOf('const ' + name); if (i < 0) throw new Error('khong thay const ' + name); const st = src.lastIndexOf('\n', i) + 1; let depth = 0; for (let j = i; j < src.length; j++) { const ch = src[j]; if ('({['.includes(ch)) depth++; else if (')}]'.includes(ch)) depth--; else if (ch === ';' && depth === 0) return src.slice(st, j + 1); } };
const zchunk = zsrc.slice(zsrc.indexOf('  function _zaiImgStatus_('), zsrc.indexOf('  // ── MAU TIN NHAN TU VAN'));
const pParts = [constSpan(psrc, '_fold_') ? '' : '', fnSpan(psrc, 'function _stripVNlocal_'), constSpan(psrc, '_fold_'), constSpan(psrc, '_vnSort_'), constSpan(psrc, '_itemNames_'), fnSpan(psrc, 'function _parseNumberedList_'), fnSpan(psrc, 'function _splitTopLevel_'), fnSpan(psrc, 'function _parseMaterialTree_')];
const pstate = psrc.match(/  let _imgFlatItems = null;[\s\S]*?let _imgBld = _imgBldBlank_\(\);\n/)[0];
const pchunk = pParts.join('\n') + '\n' + pstate + ['initImgSearch_', 'loadImgFlat_', '_bindImgBuilder_', '_loadImgSlot_', 'renderImgDyn_'].map(n => fnSpan(psrc, 'function ' + n)).join('\n');
const esc1 = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');   // escHtml cua Zalo
const escA = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ITEMS = [
  { n: 'Charm', t: 'Charm Tỷ hưu', m: 'TH-01', s: '', c: '1. Aqua xanh biển 2. Citrin: vàng mỡ gà 3. Thạch anh: dâu xanh, dâu hồng', mau: 'Xanh', img: 'https://drive/1' },
  { n: 'Charm', t: 'Charm Tỷ hưu', m: 'TH-01', s: '', c: 'Bạc 925', mau: 'Đỏ', img: 'https://drive/2' },
  { n: 'Charm', t: 'Charm Rồng', m: 'R-02', s: 'Size M', c: 'Bạc 925', mau: '', img: 'https://drive/3' },
  { n: 'Nhẫn', t: 'Nhẫn Bạc Trơn', m: 'NBT', s: 'Size 12', c: 'Bạc 925', mau: '', img: 'https://drive/4' },
  { n: 'Nhẫn', t: 'Nhẫn Bạc Trơn', m: 'NBT', s: 'Size 14', c: 'Bạc 925', mau: '', img: 'https://drive/4' },   // trung link anh
  { n: 'Nhẫn', t: 'Nhẫn Trơn <b>x</b>', m: '', s: 'Size 16', c: '', mau: '', img: '' },   // chua co link anh + HTML trong ten
  { n: 'Vòng', t: 'Vòng Phong Thủy', m: 'VPT', s: '16cm', c: 'Vàng 18K - Bạc 925', mau: '', img: 'https://drive/5' }
];
for (let i = 0; i < 8; i++) ITEMS.push({ n: 'Vòng', t: 'Vòng Nhiều', m: 'VN', s: 'Size ' + (10 + i), c: 'Bạc 925', mau: '', img: 'https://drive/v' + i });   // 8 bien the CUNG TEN (thu gioi han 6 anh)
for (let i = 0; i < 9; i++) ITEMS.push({ n: 'Dây chuyền', t: 'Dây Ý ' + i, m: 'DY' + i, s: '', c: 'Bạc', mau: '', img: 'https://drive/d' + i });   // nhieu bien the (>6) de thu "Con N bien the khac"
const SLOT = { 'https://drive/1': { ok: true, image: { mimeType: 'image/png', base64: 'AAAA', name: 'a' }, imageLink: 'https://drive/1?x=1&y="2"' }, 'https://drive/2': { ok: true, imageLink: 'https://drive/2' }, 'https://drive/3': { ok: false, error: 'Khong doc duoc <anh>' }, 'https://drive/4': { ok: true, imageLink: '' } };
const CP = [['pk-price-item', 'ITEM'], ['pk-ctkm-title', 'TITLE'], ['pk-price-loading', 'LOADING'], ['pk-builder-row', 'ROW'], ['pk-btn-outline', 'BTN'], ['pkimg-', 'img-'], ['var(--pk-border,#e5e7eb)', '#e5e7eb']];
const CZ = [['zai-ctkm-item', 'ITEM'], ['zai-ctkm-title', 'TITLE'], ['zai-ctkm-loading', 'LOADING'], ['zai-builder-row', 'ROW'], ['zai-btn zai-btn-secondary zai-btn-sm', 'BTN'], ['zaiimg-', 'img-']];
const canon = (h, m) => { let x = h; for (const [a, b] of m) x = x.split(a).join(b); return x.replace(/\s+/g, ' '); };

function zalo(flat) {
  const dom = new JSDOM('<!doctype html><body><div id="zai-img-body"><input id="zai-img-q"><div id="zai-img-status"></div><div id="zai-img-dyn"></div></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], flat };
  const fetchFn = async url => { env.calls.push(url); if (/action=productImageFlat/.test(url)) { if (env.flat instanceof Error) throw env.flat; return { json: async () => env.flat }; }
    const link = decodeURIComponent(url.split('link=')[1]); return { json: async () => SLOT[link] || { ok: true, imageLink: link } }; };
  const f = new w.Function('escAttrZai_', 'GAS_URL', 'fetch', 'document', zchunk + '\nreturn { init: initImgSearchZai_, render: renderImgDynZai_, tree: _zaiParseMaterialTree_, state: () => _zaiImgBld };');
  const S = f(escA, 'https://gas.test/exec', fetchFn, w.document);
  return Object.assign(S, { env, w, name: 'Zalo', q: w.document.getElementById('zai-img-q'), dyn: w.document.getElementById('zai-img-dyn'), id: s => 'zaiimg-' + s, norm: h => canon(h, CZ) });
}
function pancake(flat) {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><div id="pk-img-body"><input id="pk-img-q"><div id="pk-img-dyn"></div></div></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], flat };
  const safeSendMessage_ = (msg, cb) => { env.calls.push(msg.type); setTimeout(() => {
    if (msg.type === 'GET_PRODUCT_IMAGE_FLAT') { const r = env.flat; cb(r instanceof Error ? { ok: false, error: r.message } : (r.ok ? { ok: true, data: { items: r.items || [] } } : { ok: false, error: r.error })); }
    else { const r = SLOT[msg.payload.link] || { ok: true, imageLink: msg.payload.link }; cb(r.ok ? { ok: true, data: r } : { ok: false, error: r.error }); } }, 0); };
  const f = new w.Function('panelEl', 'safeSendMessage_', 'escapeHtml', 'document', pchunk + '\nreturn { init: initImgSearch_, render: renderImgDyn_, tree: _parseMaterialTree_, state: () => _imgBld };');
  const S = f(w.document.getElementById('panel'), safeSendMessage_, escA, w.document);
  return Object.assign(S, { env, w, name: 'Pancake', q: w.document.getElementById('pk-img-q'), dyn: w.document.getElementById('pk-img-dyn'), id: s => 'pkimg-' + s, norm: h => canon(h, CP) });
}
const FLAT = { ok: true, items: ITEMS };
(async () => {
  // 1. tach chat lieu 2 cap: 2 ben cho cung ket qua
  const Z0 = zalo(FLAT), P0 = pancake(FLAT);
  for (const str of ['1. Aqua xanh biển 2. Citrin: vàng mỡ gà 3. Thạch anh: dâu xanh, dâu hồng 4. Ngọc: Cẩm thạch Type B, lam thủy, ngọc bích', 'Bạc 925', 'Vàng 18K - Bạc 925', '2 Bạc, 3 Vàng', '', 'Citrin: vàng; Aqua', '1. Citrin: a, b']) {
    ok(JSON.stringify(Z0.tree(str)) === JSON.stringify(P0.tree(str)), 'tach chat lieu giong nhau: ' + str.slice(0, 40));
  }
  const tr = Z0.tree('1. Aqua xanh biển 2. Citrin: vàng mỡ gà 3. Thạch anh: dâu xanh, dâu hồng');
  ok(tr.length === 3 && tr[1].parent === 'Citrin' && tr[1].children.join() === 'vàng mỡ gà' && tr[2].children.join() === 'dâu xanh,dâu hồng', 'cha/con tach dung: ' + JSON.stringify(tr));
  // 2. chuoi thao tac chon: HTML 2 ben GIONG HET o moi buoc
  const typeQ = async (S, v) => { S.q.value = v; S.q.dispatchEvent(new S.w.Event('input')); await sleep(200); };
  const pick = async (S, id, v, type) => { const el = S.dyn.querySelector('#' + S.id(id)); ok(el, S.name + ': khong co o ' + id); el.value = v; el.dispatchEvent(new S.w.Event('change')); await sleep(60); };
  const Z = zalo(FLAT), P = pancake(FLAT);
  Z.init(); P.init(); await sleep(60);
  const cmp = (label) => { ok(Z.norm(Z.dyn.innerHTML) === P.norm(P.dyn.innerHTML), 'HTML 2 ben GIONG HET o buoc "' + label + '":\nZALO    ' + Z.norm(Z.dyn.innerHTML).slice(0, 900) + '\nPANCAKE ' + P.norm(P.dyn.innerHTML).slice(0, 900)); };
  cmp('mo lan dau (chua go gi)'); ok(Z.dyn.querySelector('#zaiimg-nhom') && /Gõ tên ở ô trên hoặc chọn Nhóm/.test(Z.dyn.textContent), 'Zalo: chi hien o Nhom + goi y');
  ok(Z.env.calls.length === 1 && /action=productImageFlat/.test(Z.env.calls[0]) && P.env.calls[0] === 'GET_PRODUCT_IMAGE_FLAT', 'nap danh muc 1 lan');
  await typeQ(Z, 'ty huu'); await typeQ(P, 'ty huu'); cmp('go "ty huu" (khong dau van khop)');
  await pick(Z, 'ten', 'Charm Tỷ hưu'); await pick(P, 'ten', 'Charm Tỷ hưu'); cmp('chon ten Charm Ty huu');
  ok(Z.dyn.querySelectorAll('.zai-ctkm-item').length === 2 && Z.dyn.querySelector('#zaiimg-cl'), 'Zalo: 2 bien the + o chat lieu');
  await pick(Z, 'cl', 'Citrin'); await pick(P, 'cl', 'Citrin'); cmp('chon chat lieu cha Citrin'); ok(Z.dyn.querySelector('#zaiimg-cl2'), 'Zalo: hien o chi tiet (con) cua Citrin');
  await pick(Z, 'cl2', 'vàng mỡ gà'); await pick(P, 'cl2', 'vàng mỡ gà'); cmp('chon con vang mo ga');
  await sleep(60);
  ok(Z.dyn.querySelectorAll('.zai-ctkm-item').length === 1 && /<img src="data:image\/png;base64,AAAA"/.test(Z.dyn.innerHTML) && /Mở trên Drive/.test(Z.dyn.textContent) && Z.dyn.querySelector('a[target=_blank]').getAttribute('href') === 'https://drive/1?x=1&y="2"', 'Zalo: anh hien + link Drive (gia tri thuoc tinh co dau nhay nguyen ven)');
  ok(Z.env.calls.some(u => /action=driveImageFromLink&link=https%3A%2F%2Fdrive%2F1$/.test(u)), 'goi driveImageFromLink voi link ma hoa');
  // nhom -> ten, nhieu bien the, trung link, thieu anh, HTML trong ten, loi doc anh
  const Z2 = zalo(FLAT), P2 = pancake(FLAT); Z2.init(); P2.init(); await sleep(60);
  const cmp2 = l => ok(Z2.norm(Z2.dyn.innerHTML) === P2.norm(P2.dyn.innerHTML), 'B2 "' + l + '": HTML khac:\nZALO    ' + Z2.norm(Z2.dyn.innerHTML).slice(0, 700) + '\nPANCAKE ' + P2.norm(P2.dyn.innerHTML).slice(0, 700));
  await pick(Z2, 'nhom', 'Nhẫn'); await pick(P2, 'nhom', 'Nhẫn'); cmp2('chon nhom Nhan');
  ok(!Z2.dyn.querySelector('script, b'), 'HTML trong ten san pham bi escape');
  await pick(Z2, 'ten', 'Nhẫn Bạc Trơn'); await pick(P2, 'ten', 'Nhẫn Bạc Trơn'); cmp2('chon ten Nhan Bac Tron (2 size cung link -> 1 anh)'); await sleep(60);
  ok(Z2.dyn.querySelectorAll('.zai-ctkm-item').length === 1, 'trung link anh chi hien 1 the');
  await pick(Z2, 'ten', 'Nhẫn Trơn <b>x</b>'); await pick(P2, 'ten', 'Nhẫn Trơn <b>x</b>'); cmp2('san pham chua co link anh'); ok(/chưa có link ảnh/.test(Z2.dyn.textContent), 'Zalo: bao chua co link anh');
  await pick(Z2, 'nhom', 'Charm'); await pick(P2, 'nhom', 'Charm'); await pick(Z2, 'ten', 'Charm Rồng'); await pick(P2, 'ten', 'Charm Rồng'); await sleep(60); cmp2('anh bi loi doc');
  ok(/Lỗi: Khong doc duoc <anh>/.test(Z2.dyn.textContent) && !Z2.dyn.querySelector('anh'), 'Zalo: loi doc anh hien nguyen van, da escape');
  // >6 bien the cung ten: chi hien 6 anh + nhac con bao nhieu bien the
  await pick(Z2, 'nhom', 'Vòng'); await pick(P2, 'nhom', 'Vòng'); await pick(Z2, 'ten', 'Vòng Nhiều'); await pick(P2, 'ten', 'Vòng Nhiều'); await sleep(80); cmp2('8 bien the cung ten');
  ok(Z2.dyn.querySelectorAll('.zai-ctkm-item').length === 6 && /Còn 2 biến thể khác chưa hiện/.test(Z2.dyn.textContent), 'toi da 6 anh + nhac "Con 2 bien the khac"');
  await pick(Z2, 'size', 'Size 12'); await pick(P2, 'size', 'Size 12'); await sleep(60); cmp2('thu hep theo Size'); ok(Z2.dyn.querySelectorAll('.zai-ctkm-item').length === 1 && !/Còn \d+ biến thể/.test(Z2.dyn.textContent), 'thu hep -> 1 anh, het nhac');
  const Z3 = zalo(FLAT), P3 = pancake(FLAT); Z3.init(); P3.init(); await sleep(60);
  await pick(Z3, 'nhom', 'Dây chuyền'); await pick(P3, 'nhom', 'Dây chuyền'); ok(Z3.norm(Z3.dyn.innerHTML) === P3.norm(P3.dyn.innerHTML), 'nhom Day chuyen giong nhau');
  // 9 san pham khac ten -> chua chon ten; gõ ten rieng thu hep
  await typeQ(Z3, 'khong co san pham nay'); await typeQ(P3, 'khong co san pham nay'); ok(/Không tìm thấy sản phẩm nào khớp/.test(Z3.dyn.textContent) && Z3.norm(Z3.dyn.innerHTML) === P3.norm(P3.dyn.innerHTML), 'khong khop: cung thong bao');
  // 3. loi nap danh muc
  for (const flat of [{ ok: false, error: 'Khong doc duoc <DANH_MUC>' }, new Error('mat mang'), { ok: true, items: [] }]) {
    const a = zalo(flat), b = pancake(flat); a.init(); b.init(); await sleep(60);
    ok(a.norm(a.dyn.innerHTML) === b.norm(b.dyn.innerHTML) && /Lỗi|Không tải được danh mục/.test(a.dyn.textContent) && !a.dyn.querySelector('DANH_MUC'), 'loi nap danh muc giong het + da escape: ' + a.dyn.textContent.slice(0, 80));
  }
  // 4. nap lai khi mo lan 2: khong goi lai danh muc
  Z.init(); await sleep(30); ok(Z.env.calls.filter(u => /productImageFlat/.test(u)).length === 1, 'mo lai muc khong nap lai danh muc');
  // 5. noi vao menu + cau chu
  ok(/\{ v: 'img', label: '🖼 Tìm ảnh sản phẩm' \}/.test(zsrc) && /imgBody\.style\.display = v === 'img'/.test(zsrc) && /if \(v === 'img'\) initImgSearchZai_\(\)/.test(zsrc), 'Zalo: muc menu + goi init');
  ok(/<option value="img">🖼 Tìm ảnh sản phẩm<\/option>/.test(psrc), 'ten muc giong het Pancake');
  for (const s of ['Gõ tên sản phẩm (VD: tỷ hưu, nhẫn, charm) — có thể bỏ trống các mục dưới', 'Đang tải danh mục sản phẩm...', 'Không tìm thấy sản phẩm nào khớp.', 'Sản phẩm này chưa có link ảnh.', '🔗 Mở trên Drive']) ok(zsrc.includes(s) && psrc.includes(s), 'cau chu giong nhau: ' + s);
  console.log('ALL IMG UI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });
