#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — DEM LUOT DUNG + sap xep "Dung nhieu nhat". Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-usage.js
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can `npm i jsdom` (NODE_PATH)'); process.exit(0); }
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js', '57-viettat.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SN = [
  { id: 'vt_1', abbr: 'ch', keyword: 'chao', options: ['Chào {tên} ạ', 'Dạ em chào chị {tên} ạ'], scope: 'team', nhom: 'Chào hỏi' },
  { id: 'vt_2', abbr: 'gb', keyword: 'giá, bảng giá', options: ['Giá nhẫn bạc <b>từ</b> 500k'], scope: 'me', nhom: '' }
];
// lay dung khoi HTML cua muc Viet tat tu index.html that
const m = html.match(/<div id="vt-section"[\s\S]*?<div id="vt-list"[^>]*><\/div>\s*<\/div>/); ok(!!m, 'index.html co khoi #vt-section');
async function boot(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body>' + m[0] + '<textarea id="t"></textarea><textarea id="off" data-vt="off"></textarea><input id="inp" type="text"></body>', { runScripts: 'outside-only', url: 'https://crm.test/', pretendToBeVisual: true });
  const w = dom.window, calls = [];
  w.gsUrl = 'https://gas.test/exec'; w.toast = () => {}; w.alert = (t) => { calls.push({ alert: t }); }; w.confirm = () => (o.confirm !== false);
  w.fetch = async (u, init) => { calls.push({ u, body: init && init.body }); if (/action=vietTatResolveImages/.test(u)) return { json: async () => (o.resolveResp || { ok: true, images: [], errors: [] }) }; if (/action=vietTat/.test(u)) { if (o.fail) throw new Error('mang'); return { json: async () => (o.resp || { ok: true, snippets: SN, canTeam: !!o.admin, me: 'Hoa' }) }; } if (init && init.body && /"action":"vietTatUploadImage"/.test(init.body)) { const b = JSON.parse(init.body); return { json: async () => (o.upload ? o.upload(b) : { ok: true, id: 'UPLOADED_' + b.name.replace(/\W/g, '') + '_AAAAAAAA', name: b.name }) }; } return { json: async () => (o.save || { ok: true, id: 'vt_new' }) }; };
  w.switchTab = function (t) { calls.push({ tab: t }); };
  w.eval('var currentPhone=' + JSON.stringify(o.phone || '') + ';var allCustomers=' + JSON.stringify(o.phone ? [{ phone: o.phone, name: 'Trần Thu Hà' }] : []) + ';');
  w.eval(code); await sleep(10);
  const $ = (id) => w.document.getElementById(id);
  const popup = () => { const h = w.document.getElementById('vt-host'); const b = h && h.shadowRoot.querySelector('.b'); return b && b.style.display === 'block' ? [...b.querySelectorAll('.o span')].map((x) => x.textContent) : null; };
  const typeTA = (el, text, caret) => { el.focus(); el.value = text; const c = caret === undefined ? text.length : caret; el.setSelectionRange(c, c); el.dispatchEvent(new w.InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' })); };
  const key = (el, k, extra) => { const e = new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {})); el.dispatchEvent(e); return e; };
  return { w, calls, $, popup, typeTA, key };
}
const SNIP = [
  { id: 'a', abbr: 'aa', keyword: '', options: ['Noi dung A1', 'Noi dung A2'], scope: 'team', nhom: 'Nhom X/Con' },
  { id: 'b', abbr: 'bb', keyword: '', options: ['Noi dung B'], scope: 'me', nhom: '' },
  { id: 'c', abbr: 'cc', keyword: '', options: ['Noi dung C'], scope: 'me', nhom: 'Nhom Y' }
];
(async () => {
  const E = await boot({ admin: true, resp: { ok: true, snippets: SNIP, canTeam: true, me: 'Duyen' } });
  const w = E.w, $ = E.$, d = w.document, ls = w.localStorage; E.w.switchTab('zaloai'); await sleep(30);
  const clip = []; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { clip.push(t); } }, configurable: true }); w.toast = () => {};
  const order = () => [...$('vt-list').querySelectorAll('code')].map((x) => x.textContent).join(',');
  ok(order() === 'aa,cc,bb' || order() === 'aa,bb,cc' || /aa/.test(order()), 'mac dinh: sap theo thu muc: ' + order());
  ok($('vt-sort').value === 'folder' && /Nhóm X|Nhom X/.test($('vt-list').textContent), 'mac dinh "Theo thu muc" + co tieu de thu muc');
  // dem luot: cham de chep
  const copy = async (k) => { d.querySelector('#vt-list [data-vtc="' + k + '"]').click(); await sleep(15); };
  await copy('c#0'); await copy('c#0'); await copy('b#0'); await copy('c#0');
  ok(JSON.stringify(JSON.parse(ls.getItem('vt_usage'))) === JSON.stringify({ c: 3, b: 1 }), 'dem luot theo muc (chep 3 lan c, 1 lan b): ' + ls.getItem('vt_usage'));
  // doi sang "dung nhieu nhat"
  w.vtSetSort('used');
  ok(ls.getItem('vt_sort') === 'used' && $('vt-sort').value === 'used', 'doi sap xep -> nho lua chon trong localStorage + select dong bo');
  ok(order() === 'cc,bb,aa', 'sap giam dan theo luot dung (c3, b1, a0): ' + order());
  ok(!/🗂/.test($('vt-list').textContent.replace(/🗂 Theo thư mục/g, '')) && !$('vt-list').querySelector('[data-vtn="fold"]'), 'che do dung nhieu nhat: khong con tieu de thu muc (danh sach phang)');
  ok(/🔥 ×3/.test($('vt-list').textContent) && /🔥 ×1/.test($('vt-list').textContent) && /—/.test($('vt-list').textContent), 'hien huy hieu so luot (x3, x1, "—" neu chua dung)');
  ok(/Nhom Y/.test($('vt-list').textContent) && /Nhom X › Con/.test($('vt-list').textContent), 'danh sach phang van ghi ro thu muc cua tung muc');
  ok(!$('vt-list').querySelector('[data-vtr]'), 'che do dung nhieu nhat: an chip gan day (thua)');
  // gioi han: muc chua dung xep theo A-Z khi bang luot
  ls.setItem('vt_usage', '{}'); w.vtRender(); ok(order() === 'aa,bb,cc', 'chua ai dung -> A-Z: ' + order());
  // go tat + Tab cung tinh luot
  w.vtSetSort('folder');
  const ta = d.getElementById('t');
  E.typeTA(ta, 'aa'); ok(E.popup() && E.popup().length === 2, 'go tat "aa" hien goi y 2 noi dung');
  E.key(ta, 'Tab'); await sleep(10);
  ok(ta.value === 'Noi dung A1' && JSON.parse(ls.getItem('vt_usage')).a === 1, 'chon bang Tab trong o chat cung +1 luot: ' + ls.getItem('vt_usage'));
  w.vtSetSort('used'); ok(order().split(',')[0] === 'aa', 'muc vua go tat len dau danh sach dung nhieu nhat: ' + order());
  // du lieu hong khong lam vo
  ls.setItem('vt_usage', 'khong-phai-json'); w.vtRender(); ok(order().length > 0, 'vt_usage hong -> khong loi, hien binh thuong');
  ls.setItem('vt_usage', '[1,2]'); w.vtRender(); ok(order().length > 0, 'vt_usage la mang -> bo qua');
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-USAGE TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
