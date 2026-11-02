#!/usr/bin/env node
// Test (2026-10-25): Viet Tat trong Pancake AI (extension-pancake/pancake-viettat.js) — chay NGUYEN file trong jsdom voi chrome.* gia.
// Can jsdom: NODE_PATH=<thu muc co node_modules/jsdom> node tools/test-viettat-ext.js
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can `npm i jsdom` (NODE_PATH)'); process.exit(0); }
const code = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-viettat.js'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SN = [
  { id: 'a', abbr: 'ch', keyword: 'chao', options: ['Chào {tên} ạ', 'Dạ em chào chị {tên} ạ'], scope: 'team', nhom: '' },
  { id: 'b', abbr: 'gb', keyword: 'giá, bảng giá', options: ['Giá nhẫn bạc từ 500k'], scope: 'me', nhom: '' },
  { id: 'c', abbr: 'dc', keyword: '', options: ['Hôm nay {ngày} lúc {giờ}\nDòng 2'], scope: 'team', nhom: '' }
];
async function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><body><textarea id="t"></textarea><div id="ce" contenteditable="true"></div></body>', { runScripts: 'outside-only', url: 'https://pancake.vn/x', pretendToBeVisual: true });
  const w = dom.window, calls = { msgs: [], sets: [] };
  Object.defineProperty(w.HTMLElement.prototype, 'isContentEditable', { get() { return this.getAttribute('contenteditable') === 'true'; } });
  w.CSS = w.CSS || { escape: (s) => String(s) };
  w.document.execCommand = (cmd, _u, val) => {   // jsdom khong co execCommand: mo phong tren Selection
    const sel = w.getSelection(); if (!sel.rangeCount) return false; const r = sel.getRangeAt(0);
    if (cmd === 'delete') { r.deleteContents(); return true; }
    if (cmd === 'insertText') { r.deleteContents(); const n = w.document.createTextNode(val); r.insertNode(n); r.setStartAfter(n); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return true; }
    if (cmd === 'insertLineBreak') { r.deleteContents(); const n = w.document.createTextNode('\n'); r.insertNode(n); r.setStartAfter(n); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return true; }
    return false;
  };
  const store = { local: Object.assign({ vtData: opts.noData ? [] : SN, vtAt: opts.stale ? 0 : Date.now(), vtBy: opts.by === undefined ? '' : opts.by }, opts.local || {}), sync: Object.assign({ csName: '' }, opts.sync || {}) };
  const listeners = [];
  const area = (k) => ({ get: (keys, cb) => { const o = {}; if (typeof keys === 'string') keys = [keys]; if (Array.isArray(keys)) keys.forEach((x) => { if (x in store[k]) o[x] = store[k][x]; }); else Object.keys(keys).forEach((x) => { o[x] = x in store[k] ? store[k][x] : keys[x]; }); cb(o); },
    set: (o, cb) => { calls.sets.push(o); const ch = {}; Object.keys(o).forEach((x) => { ch[x] = { newValue: o[x] }; store[k][x] = o[x]; }); listeners.forEach((l) => l(ch, k)); cb && cb(); } });
  w.chrome = { storage: { local: area('local'), sync: area('sync'), onChanged: { addListener: (f) => listeners.push(f) } },
    runtime: { sendMessage: (m, cb) => { calls.msgs.push(m); if (m.type === 'GET_VIETTAT_IMAGE') { cb(opts.imgResp ? opts.imgResp(m) : { ok: true, data: { base64: 'QUJD', mimeType: 'image/png' } }); return; } cb({ ok: true, data: { snippets: opts.server || [{ id: 'z', abbr: 'zz', keyword: '', options: ['Từ server'], scope: 'team' }] } }); } } };
  w.DataTransfer = class { constructor() { this.files = []; this.items = { add: (f) => this.files.push(f) }; } };
  w.ClipboardEvent = class extends w.Event { constructor(t, i) { super(t, i); this.clipboardData = i && i.clipboardData; } };
  calls.pastes = []; w.document.addEventListener('paste', (e) => calls.pastes.push([...e.clipboardData.files]), true);
  if (opts.coarse) w.matchMedia = () => ({ matches: true });
  w.URL.createObjectURL = () => 'blob:img' + Math.random();
  w.eval(code); await sleep(30);
  const popup = () => { const h = w.document.getElementById('pk-viettat-host'); const b = h && h.shadowRoot.querySelector('.b'); return b && b.style.display === 'block' ? [...b.querySelectorAll('.o span')].map((x) => x.textContent) : null; };
  const head = () => { const h = w.document.getElementById('pk-viettat-host'); return h ? h.shadowRoot.querySelector('.h').textContent : ''; };
  const typeTA = (el, text, caret) => { el.focus(); el.value = text; const c = caret === undefined ? text.length : caret; el.setSelectionRange(c, c); el.dispatchEvent(new w.InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' })); };
  const key = (el, k, extra) => { const e = new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {})); el.dispatchEvent(e); return e; };
  return { w, calls, store, popup, head, typeTA, key, listeners };
}
(async () => {
  let E = await boot(); const ta = E.w.document.getElementById('t');
  E.typeTA(ta, 'xin ch');
  ok(JSON.stringify(E.popup()) === JSON.stringify(['Chào {tên} ạ', 'Dạ em chào chị {tên} ạ']), 'go "ch" -> hien 2 lua chon (chua co ten -> giu {tên}): ' + JSON.stringify(E.popup()));
  ok(/Chưa thấy tên khách/.test(E.head()), 'tieu de bao chua thay ten khach');
  let ev = E.key(ta, 'Tab'); ok(ev.defaultPrevented, 'Tab bi chan (khong nhay o khac)');
  ok(ta.value === 'xin Chào {tên} ạ' && E.popup() === null, 'Tab chen lua chon dau, thay dung "ch", dong popup: ' + JSON.stringify(ta.value));

  E.typeTA(ta, 'ch Thanh Huyền');
  ok(E.popup() && E.popup()[0] === 'Chào Huyền ạ', 'kieu "viet tat + ten": ch Thanh Huyền -> Chào Huyền ạ: ' + JSON.stringify(E.popup()));
  E.key(ta, 'ArrowDown'); E.key(ta, 'Tab');
  ok(ta.value === 'Dạ em chào chị Huyền ạ', 'ArrowDown chon lua chon 2, thay ca "ch Thanh Huyền" boi noi dung: ' + JSON.stringify(ta.value));

  E.typeTA(ta, 'ch Huyền, em gửi thêm', 'ch Huyền'.length);   // con tro o GIUA van ban: phan sau con tro giu nguyen
  ok(E.popup() && E.popup()[0] === 'Chào Huyền ạ', 'con tro giua cau van nhan duoc');
  E.key(ta, '1', { altKey: true });
  ok(ta.value === 'Chào Huyền ạ, em gửi thêm', 'Alt+1 chen lua chon 1, giu nguyen phan sau con tro: ' + JSON.stringify(ta.value));

  E.typeTA(ta, 'gia'); ok(JSON.stringify(E.popup()) === JSON.stringify(['Giá nhẫn bạc từ 500k']), 'tu khoa khong dau "gia" khop "giá, bảng giá"');
  E.typeTA(ta, 'bang'); ok(E.popup() && E.popup().length === 1, 'tu khoa thu 2 "bảng giá" khop dau tu "bang"');
  E.typeTA(ta, 'g'); ok(E.popup() === null, 'tu khoa chi 1 ky tu khong goi y (chi khop viet tat day du)');
  E.typeTA(ta, 'ch '); ok(E.popup() === null, 'sau dau cach khong goi y nua');
  E.typeTA(ta, 'xyz'); ok(E.popup() === null, 'khong khop -> khong popup');
  E.typeTA(ta, 'dc'); E.key(ta, 'Tab');
  ok(/^Hôm nay \d\d\/\d\d\/\d{4} lúc \d\d:\d\d\nDòng 2$/.test(ta.value), 'bien {ngày} {giờ} + xuong dong duoc thay: ' + JSON.stringify(ta.value));
  E.typeTA(ta, 'ch'); E.key(ta, 'Escape'); ok(E.popup() === null, 'Esc dong popup');
  E.typeTA(ta, 'ch'); E.w.document.body.dispatchEvent(new E.w.MouseEvent('mousedown', { bubbles: true })); ok(E.popup() === null, 'bam ra ngoai dong popup');

  // ten tu o "Ten khach" cua panel Pancake AI
  const panel = E.w.document.createElement('div'); panel.id = 'pk-ai-panel'; panel.innerHTML = '<input id="pk-name-input"><textarea id="pk-inner"></textarea>'; E.w.document.body.appendChild(panel);
  E.w.document.getElementById('pk-name-input').value = 'Nguyễn Thị Lan';
  E.typeTA(ta, 'ch'); ok(E.popup() && E.popup()[0] === 'Chào Lan ạ', 'tu lay ten tu o "Tên khách" cua panel: ' + JSON.stringify(E.popup()));
  ok(/Khách: Lan/.test(E.head()), 'tieu de hien ten goi');
  E.key(ta, 'Escape');
  const inner = E.w.document.getElementById('pk-inner'); E.typeTA(inner, 'ch'); ok(E.popup() === null, 'go trong o cua CHINH panel Pancake AI -> khong popup');

  // contenteditable (o chat that cua Pancake/Messenger)
  const ce = E.w.document.getElementById('ce'); ce.focus(); ce.textContent = ''; const tn = E.w.document.createTextNode('em gb'); ce.appendChild(tn);
  const sel = E.w.getSelection(); const r = E.w.document.createRange(); r.setStart(tn, 5); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
  ce.dispatchEvent(new E.w.InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'b' }));
  ok(E.popup() && E.popup()[0] === 'Giá nhẫn bạc từ 500k', 'contenteditable: nhan ra viet tat "gb"');
  E.key(ce, 'Tab'); ok(ce.textContent === 'em Giá nhẫn bạc từ 500k', 'contenteditable: chen dung, giu chu truoc: ' + JSON.stringify(ce.textContent));

  // tat / bat
  E = await boot({ local: { vtOn: false } }); E.typeTA(E.w.document.getElementById('t'), 'ch'); ok(E.popup() === null, 'tat trong Cai dat -> khong goi y');
  E = await boot({ noData: true, stale: true }); E.typeTA(E.w.document.getElementById('t'), 'ch'); ok(E.popup() === null, 'chua co du lieu -> khong goi y, khong loi');

  // dong bo
  E = await boot({ stale: true });
  ok(E.calls.msgs.length === 1 && E.calls.msgs[0].type === 'GET_VIETTAT', 'du lieu cu (>5 phut) -> hoi server 1 lan (GET_VIETTAT)');
  ok(E.store.local.vtData.length === 1 && E.store.local.vtData[0].abbr === 'zz' && E.store.local.vtBy === '', 'luu ket qua vao storage.local ' + JSON.stringify([E.store.local.vtData.length, E.store.local.vtBy, E.calls.sets.length]));
  E.typeTA(E.w.document.getElementById('t'), 'zz'); ok(E.popup() && E.popup()[0] === 'Từ server', 'dung du lieu moi ngay (khong can tai lai trang)');
  E = await boot({ by: '' }); ok(E.calls.msgs.length === 0, 'du lieu con moi (<5 phut) va cung CS -> KHONG goi server');
  E = await boot({ by: 'Hoa cu' }); ok(E.calls.msgs.length === 1, 'da doi ten CS so voi lan nap truoc -> nap lai (muc rieng cua nguoi khac phai bien mat)');
  E = await boot(); E.listeners.forEach((l) => l({ csName: { newValue: 'Binh' } }, 'sync')); await sleep(20);
  ok(E.calls.msgs.length === 1, 'doi CS trong khi dang mo trang -> nap lai ngay');
  E = await boot({ stale: true, server: 'khong phai mang' }); ok(E.store.local.vtData.length === 3, 'server tra sai dinh dang -> giu ban cu, khong ghi de');

  
  // ===== ANH KEM + THU MUC CON (2026-10-25) =====
  const IM = [{ id: 'IMG_AAAAAAAAAAAAAAAA', name: 'fiole 1.jpg' }, { id: 'IMG_BBBBBBBBBBBBBBBB', name: 'bang gia' }];
  const SI = [{ id: 'i1', abbr: 'tt', keyword: '', options: ['Túi tiền cổ nè'], scope: 'team', nhom: 'Túi tiền/Cổ', images: IM }, { id: 'i2', abbr: 'tn', keyword: '', options: ['Chỉ chữ'], scope: 'team', nhom: '', images: [] }];
  const fbar = (E) => { const h = E.w.document.getElementById('pk-viettat-host'); const f = h && h.shadowRoot.querySelector('.f'); return f && f.style.display === 'block' ? f.textContent : null; };
  let I = await boot({ local: { vtData: SI } });
  let tI = I.w.document.getElementById('t'); I.typeTA(tI, 'tt');
  let bhtml = I.w.document.getElementById('pk-viettat-host').shadowRoot.querySelector('.b').innerHTML;
  ok(/Túi tiền › Cổ/.test(bhtml) && /🖼 2/.test(bhtml), 'goi y hien thu muc con "Túi tiền › Cổ" va so anh');
  I.typeTA(tI, 'tn'); bhtml = I.w.document.getElementById('pk-viettat-host').shadowRoot.querySelector('.b').innerHTML; ok(!/🖼/.test(bhtml) && !/<em>/.test(bhtml), 'muc khong anh/khong nhom: khong hien huy hieu');
  I.typeTA(tI, 'tt'); I.key(tI, 'Tab'); await sleep(30);
  ok(tI.value === 'Túi tiền cổ nè', 'Tab chen chu truoc: ' + JSON.stringify(tI.value));
  const imgMsgs = I.calls.msgs.filter((m) => m.type === 'GET_VIETTAT_IMAGE');
  ok(imgMsgs.length === 2 && imgMsgs[0].id === IM[0].id && imgMsgs[1].id === IM[1].id, 'lay byte 2 anh qua background');
  ok(I.calls.pastes.length === 1 && I.calls.pastes[0].length === 2 && I.calls.pastes[0][0].name === 'fiole 1.jpg' && I.calls.pastes[0][1].name === 'bang gia.png' && I.calls.pastes[0][1].type === 'image/png', 'dan 2 anh trong 1 su kien paste (ten giu, them duoi theo mime): ' + JSON.stringify(I.calls.pastes.map((x) => x.map((f) => f.name))));
  ok(/Chưa hiện|chưa hiện/.test(fbar(I) || '') && /Copy ảnh 1\/2/.test(fbar(I) || ''), 'hien thanh du phong "Copy anh 1/2"');
  I.w.document.getElementById('pk-viettat-host').shadowRoot.querySelector('.f button[data-a="x"]').dispatchEvent(new I.w.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  ok(fbar(I) === null, 'nut Dong tat thanh du phong');
  I.calls.msgs.length = 0; I.calls.pastes.length = 0; I.typeTA(tI, 'tt'); I.key(tI, 'Tab'); await sleep(30);
  ok(I.calls.msgs.filter((m) => m.type === 'GET_VIETTAT_IMAGE').length === 0 && I.calls.pastes.length === 1, 'dung lai viet tat: anh lay tu bo nho tam, khong goi server lan nua');
  I.w.document.getElementById('pk-viettat-host').shadowRoot.querySelector('.f button[data-a="x"]').dispatchEvent(new I.w.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  I.calls.pastes.length = 0; I.typeTA(tI, 'tn'); I.key(tI, 'Tab'); await sleep(30);
  ok(I.calls.pastes.length === 0 && fbar(I) === null, 'muc khong co anh: khong dan, khong hien thanh');

  const P = await boot({ local: { vtData: SI }, imgResp: (m) => m.id === IM[0].id ? { ok: false, error: 'Khong doc duoc anh' } : { ok: true, data: { base64: 'QUJD', mimeType: 'image/jpeg' } } });
  let tP = P.w.document.getElementById('t'); P.typeTA(tP, 'tt'); P.key(tP, 'Tab'); await sleep(30);
  ok(tP.value === 'Túi tiền cổ nè' && P.calls.pastes.length === 1 && P.calls.pastes[0].length === 1 && P.calls.pastes[0][0].name === 'bang gia.jpg', '1 anh loi: van dan cac anh con lai, chu van duoc chen');
  const Q = await boot({ local: { vtData: SI }, imgResp: () => ({ ok: false, error: 'FORBIDDEN' }) });
  let tQ = Q.w.document.getElementById('t'); Q.typeTA(tQ, 'tt'); Q.key(tQ, 'Tab'); await sleep(30);
  ok(tQ.value === 'Túi tiền cổ nè' && Q.calls.pastes.length === 0 && fbar(Q) === null, 'tat ca anh loi: khong dan, khong hien thanh, chu van chen');
  const Ce = await boot({ local: { vtData: SI } }); const ceI = Ce.w.document.getElementById('ce'); ceI.focus();
  ceI.textContent = 'tt'; const r0 = Ce.w.document.createRange(); r0.setStart(ceI.firstChild, 2); r0.collapse(true); const sl = Ce.w.getSelection(); sl.removeAllRanges(); sl.addRange(r0);
  ceI.dispatchEvent(new Ce.w.InputEvent('input', { bubbles: true, inputType: 'insertText', data: 't' })); Ce.key(ceI, 'Tab'); await sleep(30);
  ok(/Túi tiền cổ nè/.test(ceI.textContent) && Ce.calls.pastes.length === 1 && Ce.calls.pastes[0].length === 2, 'o contenteditable (kieu o chat Pancake): chen chu + dan 2 anh');

  // ===== MAN CHON LON: chon nhieu chu + hinh, bam dup phong/thu (2026-10-25) =====
  {
    const SP = [{ id: 'p1', abbr: 'tt', keyword: '', options: ['Túi tiền cổ nè', 'Dòng thứ hai'], scope: 'team', nhom: '', images: IM }];
    const P = await boot({ local: { vtData: SP } }); const D = P.w.document, pta = D.getElementById('t');
    const root = () => D.getElementById('pk-viettat-host').shadowRoot, pk = () => root().querySelector('.p');
    const click = (el) => el.dispatchEvent(new P.w.MouseEvent('click', { bubbles: true, composed: true }));
    const down = (el) => el.dispatchEvent(new P.w.MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true }));   // thanh goi y dung mousedown (giu con tro trong o chat)
    P.typeTA(pta, 'xin tt');
    ok(/Chọn nhiều/.test(P.head()) && P.popup() !== null, 'may tinh: van hien thanh goi y Tab/↑↓ co nut "Chon nhieu + anh"');
    down(root().querySelector('#pkm')); await sleep(40);
    ok(pk().style.display === 'flex' && root().querySelector('.b').style.display === 'none', 'bam "Chon nhieu + anh" -> mo man chon lon, an thanh goi y');
    const cs = () => [...pk().querySelectorAll('.c')];
    ok(cs().length === 4 && cs().filter((c) => c.classList.contains('im')).length === 2, 'liet ke du 4 muc: 2 chu + 2 hinh');
    ok(pk().querySelectorAll('img').length === 2 && P.calls.msgs.filter((m) => m.type === 'GET_VIETTAT_IMAGE').length === 2, 'hinh tai qua GET_VIETTAT_IMAGE va hien chinh hinh');
    ok(!/Hình ảnh|Hinh anh|🖼/.test(pk().textContent), 'KHONG co nhan chu "Hinh anh" tren the hinh');
    click(cs()[0]); ok(cs()[0].classList.contains('on') && /Đã chọn 1/.test(pk().textContent), 'bam 1 lan vao chu = chon (ngay lap tuc)');
    click(cs()[1]); ok(cs()[0].classList.contains('on') && cs()[1].classList.contains('on') && /Chèn \(2\)/.test(pk().textContent), 'chon duoc nhieu chu 1 luc, nut hien so luong');
    click(cs()[2]); await sleep(80); ok(!cs()[2].classList.contains('on'), 'bam 1 lan vao hinh: cho 300ms moi chon (de nhan ra bam dup)');
    await sleep(320); ok(cs()[2].classList.contains('on') && !cs()[2].classList.contains('z'), 'sau 300ms hinh duoc chon, chua phong');
    click(cs()[3]); click(cs()[3]); await sleep(10); ok(cs()[3].classList.contains('z') && !cs()[3].classList.contains('on'), 'bam dup hinh = phong full, KHONG doi trang thai chon');
    await sleep(340); ok(cs()[3].classList.contains('z') && !cs()[3].classList.contains('on'), 'bam dup khong bi chon xen vao sau 300ms');
    click(cs()[3]); click(cs()[3]); await sleep(10); ok(!cs()[3].classList.contains('z'), 'bam dup lan nua = thu nho');
    click(cs()[1]); ok(!cs()[1].classList.contains('on'), 'bam lai chu = bo chon');
    click(cs()[1]);
    P.calls.pastes.length = 0;
    click(pk().querySelector('[data-a=ins]')); await sleep(60);
    ok(pta.value === 'xin Túi tiền cổ nè\nDòng thứ hai', 'Chen: chu da chon noi bang xuong dong, thay dung viet tat: ' + JSON.stringify(pta.value));
    ok(P.calls.pastes.length === 1 && P.calls.pastes[0].length === 1 && pk().style.display === 'none', 'hinh da chon dan vao o chat (1 hinh), dong man chon');
    P.typeTA(pta, 'xin tt'); down(root().querySelector('#pkm')); await sleep(40);
    click(cs()[2]); await sleep(340); P.calls.pastes.length = 0; click(pk().querySelector('[data-a=ins]')); await sleep(60);
    ok(pta.value === 'xin ' && P.calls.pastes.length === 1, 'chi chon hinh: xoa viet tat, dan hinh: ' + JSON.stringify(pta.value));
    P.typeTA(pta, 'xin tt'); down(root().querySelector('#pkm')); await sleep(40); P.key(pta, 'Escape'); ok(pk().style.display === 'none', 'Esc dong man chon');
    const C = await boot({ local: { vtData: SP }, coarse: true }); const cd = C.w.document, cta = cd.getElementById('t');
    C.typeTA(cta, 'chao tt'); await sleep(40);
    const cp = cd.getElementById('pk-viettat-host').shadowRoot;
    ok(cp.querySelector('.p').style.display === 'flex' && cp.querySelector('.b').style.display !== 'block', 'man cam ung: go viet tat -> mo thang man chon lon');
    const C2 = await boot({ local: { vtData: [{ id: 'z', abbr: 'zz', keyword: '', options: ['A', 'B'], scope: 'team', nhom: '', images: [] }] }, coarse: true }); const c2 = C2.w.document.getElementById('t');
    C2.typeTA(c2, 'zz'); await sleep(30); ok(C2.w.document.getElementById('pk-viettat-host').shadowRoot.querySelectorAll('.p .c').length === 2, 'muc chi co chu: man chon chi co 2 the chu');
  }
  // ===== 50 ANH: lay song song toi da 4, dan dung thu tu (2026-10-25) =====
  const IM50 = []; for (let i = 0; i < 50; i++) IM50.push({ id: 'BIG' + String(i).padStart(13, '0') + 'ZZ', name: 'a' + String(i).padStart(2, '0') });
  const B = await boot({ local: { vtData: [{ id: 'b1', abbr: 'bb', keyword: '', options: ['nhieu anh'], scope: 'team', nhom: 'A/B', images: IM50 }] } });
  const tB = B.w.document.getElementById('t'); B.typeTA(tB, 'bb'); B.key(tB, 'Tab'); await sleep(300);
  ok(B.calls.msgs.filter((m) => m.type === 'GET_VIETTAT_IMAGE').length === 50 && B.calls.pastes.length === 1 && B.calls.pastes[0].length === 50, '50 anh: lay du 50 va dan 1 lan');
  ok(B.calls.pastes[0].every((f, i) => f.name.replace(/\.\w+$/, '') === 'a' + String(i).padStart(2, '0')), '50 anh: dan DUNG THU TU du lay song song');
console.log(bad ? ('\n' + bad + ' LOI') : '\nALL VIETTAT-EXT TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
