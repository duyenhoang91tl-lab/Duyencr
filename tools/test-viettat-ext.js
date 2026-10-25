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
    runtime: { sendMessage: (m, cb) => { calls.msgs.push(m); cb({ ok: true, data: { snippets: opts.server || [{ id: 'z', abbr: 'zz', keyword: '', options: ['Từ server'], scope: 'team' }] } }); } } };
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

  console.log(bad ? ('\n' + bad + ' LOI') : '\nALL VIETTAT-EXT TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
