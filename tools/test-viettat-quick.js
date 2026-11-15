#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — DUNG NHANH tren dien thoai: cham noi dung = sao chep (thay {ten} theo khach dang mo), chip "Dung gan day".
// Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-quick.js
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
  { id: 'a', abbr: 'ch', keyword: '', options: ['Dạ em chào chị {tên} ạ', 'Chào {tên}'], scope: 'team', nhom: 'Chào hỏi' },
  { id: 'b', abbr: 'gb', keyword: '', options: ['Giá nhẫn bạc từ 500k'], scope: 'me', nhom: '' },
  { id: 'c', abbr: 'cc', keyword: '', options: ['Cảm ơn chị'], scope: 'me', nhom: 'Chào hỏi' }
];
async function run(phone) {
  const E = await boot({ admin: true, phone, resp: { ok: true, snippets: SNIP, canTeam: true, me: 'Duyen' } });
  const w = E.w, clip = []; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { clip.push(t); } }, configurable: true });
  const toasts = []; w.toast = (m) => toasts.push(m);
  w.switchTab('zaloai'); await sleep(30);
  return { E, w, clip, toasts, d: w.document };
}
(async () => {
  let { E, w, clip, toasts, d } = await run('0901234567');
  ok(d.querySelectorAll('#vt-list .vt-copy').length === 4, 'moi noi dung la 1 vung cham de chep (2+1+1)');
  ok(!d.querySelector('#vt-list [data-vtr]'), 'chua dung gi -> chua co chip gan day');
  d.querySelector('#vt-list [data-vtc="a#0"]').click(); await sleep(20);
  ok(clip.length === 1 && clip[0] === 'Dạ em chào chị Hà ạ', 'cham -> chep, thay {ten} bang ten khach dang mo (chu cuoi): ' + JSON.stringify(clip[0]));
  ok(/Đã chép "ch"/.test(toasts[toasts.length - 1]) && !/giữ nguyên/.test(toasts[toasts.length - 1]), 'bao da chep');
  d.querySelector('#vt-list [data-vtc="a#1"]').click(); await sleep(20);
  ok(clip[1] === 'Chào Hà', 'chon noi dung thu 2 cua cung muc chep dung: ' + clip[1]);
  d.querySelector('#vt-list [data-vtc="b#0"]').click(); await sleep(20);
  const chips = [...d.querySelectorAll('#vt-list [data-vtr]')].map((x) => x.textContent);
  ok(chips.join(',') === 'gb,ch', 'chip gan day: moi dung nhat dung truoc, khong trung: ' + chips.join(','));
  d.querySelector('#vt-list [data-vtr="a"]').click(); await sleep(20);
  ok(clip[clip.length - 1] === 'Dạ em chào chị Hà ạ' && [...d.querySelectorAll('#vt-list [data-vtr]')][0].textContent === 'ch', 'bam chip -> chep noi dung dau + len dau danh sach');
  d.getElementById('vt-search').value = 'gb'; w.vtRender();
  ok(!d.querySelector('#vt-list [data-vtr]'), 'dang tim kiem -> an chip gan day');
  d.getElementById('vt-search').value = ''; w.vtRender();
  ok(JSON.parse(w.localStorage.getItem('vt_recent')).join() === 'a,b', 'luu id da dung (moi nhat truoc) vao localStorage');
  for (let i = 0; i < 9; i++) { w._vtPushRecent('x' + i); } ok(JSON.parse(w.localStorage.getItem('vt_recent')).length === 6, 'chi nho toi da 6 muc');
  // khong co khach dang mo
  ({ E, w, clip, toasts, d } = await run(''));
  d.querySelector('#vt-list [data-vtc="a#0"]').click(); await sleep(20);
  ok(clip[0] === 'Dạ em chào chị {tên} ạ' && /giữ nguyên/.test(toasts[toasts.length - 1]), 'chua chon khach -> giu {ten} va bao ro: ' + toasts[toasts.length - 1]);
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-QUICK TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
