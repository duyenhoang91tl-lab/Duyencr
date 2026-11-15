#!/usr/bin/env node
// Test (2026-11-14): Viet tat — TIM THEO TEN ANH/GHI AM dinh kem (CRM js/57 + PWA viettat.html). Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-imgsearch.js
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
  { id: 'a', abbr: 'aa', keyword: '', options: ['Noi dung A'], scope: 'team', nhom: '', images: [{ id: 'IMGabcdefghijklmnopqrs', name: 'Nhẫn bạc vòng tay 01.jpg' }] },
  { id: 'b', abbr: 'bb', keyword: '', options: ['Noi dung B'], scope: 'team', nhom: '', audios: [{ id: 'AUDabcdefghijklmnopqrs', name: 'huong-dan-size.mp3' }] },
  { id: 'c', abbr: 'cc', keyword: '', options: ['Noi dung C'], scope: 'team', nhom: '' }
];
(async () => {
  const E = await boot({ admin: true, resp: { ok: true, snippets: SNIP, canTeam: true, me: 'Duyen' } });
  const w = E.w, $ = E.$; E.w.switchTab('zaloai'); await sleep(30);
  const codes = () => [...$('vt-list').querySelectorAll('code')].map((x) => x.textContent).join(',');
  const find = (q) => { $('vt-search').value = q; w.vtRender(); return codes(); };
  ok(find('nhan bac') === 'aa', 'CRM: tim "nhan bac" (khong dau) -> ra muc co anh "Nhẫn bạc vòng tay 01.jpg": ' + find('nhan bac'));
  ok(find('01.jpg') === 'aa', 'CRM: tim theo duoi file');
  ok(find('huong-dan') === 'bb', 'CRM: tim theo ten tep ghi am');
  ok(find('khong-co-gi') === '' , 'CRM: khong khop -> rong');
  ok(find('') === 'aa,bb,cc', 'CRM: xoa tu khoa -> du 3 muc');
  // PWA
  const { JSDOM } = require('jsdom'); const fs = require('fs');
  const ph = fs.readFileSync(path.join(root, 'viettat.html'), 'utf8');
  const dom = new JSDOM(ph, { runScripts: 'outside-only', url: 'https://x.test/' }); const pw = dom.window; pw.fetch = () => Promise.reject(new Error('off'));
  pw.eval(ph.match(/<script>([\s\S]*?)<\/script>/)[1].replace("if (S.name) start(); else showSetup();", '').replace("'use strict';", ''));
  pw.eval('S.snaps=' + JSON.stringify(SNIP) + '; $("top").style.display="block"; fillNhom(); render();');
  const pm = (q) => pw.eval('S.snaps.filter(function (s) { return matches(s, ' + JSON.stringify(q) + '); }).map(function (s) { return s.abbr; }).join()');
  ok(pm('nhan bac') === 'aa', 'PWA: tim theo ten anh (khong dau): ' + pm('nhan bac'));
  ok(pm('ab') === 'aa' || pm('ab') === '', 'PWA: tu < 3 ky tu khong khop ten anh (tranh nhieu): ' + pm('ab'));
  ok(pm('nhan') === 'aa', 'PWA: 3+ ky tu khop ten anh');
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-IMGSEARCH TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
