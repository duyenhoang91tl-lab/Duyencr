#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — NHAN BAN muc (vtClone). Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-clone.js
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
const IMG = 'IMGabcdefghijklmnopqrs', AUD = 'AUDabcdefghijklmnopqrs';
const SNIP = [
  { id: 'a', abbr: 'ch', keyword: 'chào, hello', options: ['Chào {tên}', 'Xin chào'], scope: 'team', nhom: 'Chào hỏi/Mở đầu', images: [{ id: IMG, name: 'a.jpg' }], audios: [{ id: AUD, name: 'v.mp3' }] },
  { id: 'b', abbr: 'ch2', keyword: '', options: ['x'], scope: 'me', nhom: '' },
  { id: 'c', abbr: 'tpl', keyword: 'mau', options: ['Mẫu tin nội dung'], scope: 'team', nhom: 'Mẫu tin', fromTpl: true, tplId: 'mt_1', createdBy: 'ai do' }
];
(async () => {
  for (const admin of [true, false]) {
    const E = await boot({ admin, resp: { ok: true, snippets: SNIP, canTeam: admin, me: 'Duyen' } });
    const w = E.w, $ = E.$, d = w.document; E.w.switchTab('zaloai'); await sleep(30);
    const tag = admin ? '[admin] ' : '[nhan vien] ';
    ok(d.querySelectorAll('#vt-list button[onclick^="vtClone"]').length === 3, tag + 'moi the co nut nhan ban (ke ca muc tu Mau tin / muc khong sua duoc)');
    w.vtClone('a');
    ok($('vt-f-id').value === '', tag + 'nhan ban = muc MOI (khong mang id cu)');
    ok($('vt-f-abbr').value === 'ch3', tag + 'viet tat tu them so cho khoi trung (ch, ch2 da co -> ch3): ' + $('vt-f-abbr').value);
    ok($('vt-f-keyword').value === 'chào, hello' && $('vt-f-nhom').value === 'Chào hỏi/Mở đầu', tag + 'giu tu khoa + thu muc me/con');
    ok([...d.querySelectorAll('#vt-f-opts textarea')].map((t) => t.value).join('|') === 'Chào {tên}|Xin chào', tag + 'giu du cac noi dung');
    ok(w.eval('_vtDraftImgs.length') === 1 && w.eval('_vtDraftAuds.length') === 1 && $('vt-f-media').open === true, tag + 'giu anh + ghi am, khoi media tu mo');
    ok($('vt-f-scope').value === (admin ? 'team' : 'me') && $('vt-f-scope').disabled === false, tag + 'pham vi: ' + $('vt-f-scope').value + (admin ? ' (admin giu Chung)' : ' (nhan vien -> Cua toi)'));
    if (admin) {
      $('vt-f-abbr').value = 'chb'; await w.vtSave(); await sleep(20);
      const pj = JSON.parse(E.calls.filter((c) => c.body && /saveVietTat/.test(c.body)).pop().body).snippet;
      ok(!pj.id && pj.abbr === 'chb' && pj.nhom === 'Chào hỏi/Mở đầu' && pj.images.length === 1 && pj.audios.length === 1 && pj.options.length === 2, 'luu nhan ban gui tao MOI day du: ' + JSON.stringify(pj).slice(0, 160));
    }
    w.vtClone('c'); ok($('vt-f-abbr').value === 'tpl2' && $('vt-f-id').value === '' && $('vt-f-opts').querySelector('textarea').value === 'Mẫu tin nội dung', tag + 'nhan ban duoc ca muc lay tu Mau tin (khong mo man sua mau)');
  }
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-CLONE TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
