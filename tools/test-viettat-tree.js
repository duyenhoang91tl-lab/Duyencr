#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — CAY THU MUC me/con: loc theo thu muc (me gom con chau), chon thu muc trong form, tao thu muc con/me moi (toi da 3 cap), thu/xo tieu de thu muc.
// Nap NGUYEN js/57-viettat.js + khoi #vt-section cua index.html that trong jsdom. Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-tree.js
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
  { id: 'a', abbr: 'ckm', keyword: '', options: ['Chào khách mới'], scope: 'team', nhom: 'Mẫu tin' },
  { id: 'b', abbr: 'tt', keyword: '', options: ['Túi tiền cổ'], scope: 'team', nhom: 'Túi tiền/Cổ' },
  { id: 'c', abbr: 'tl', keyword: '', options: ['Túi tiền lắc'], scope: 'team', nhom: 'Túi tiền/Lắc' },
  { id: 'd', abbr: 'tlb', keyword: '', options: ['Lắc bạc'], scope: 'team', nhom: 'Túi tiền/Lắc/Bạc' },
  { id: 'e', abbr: 'tui', keyword: '', options: ['Túi chung'], scope: 'team', nhom: 'Túi' },
  { id: 'f', abbr: 'xx', keyword: '', options: ['khac'], scope: 'team', nhom: '' }
];
(async () => {
  const E = await boot({ admin: true, resp: { ok: true, snippets: SNIP, canTeam: true, me: 'Duyen' } });
  E.w.switchTab('zaloai'); await sleep(30);
  const w = E.w, $ = E.$, d = w.document, codes = () => [...$('vt-list').querySelectorAll('code')].map((x) => x.textContent).sort().join(',');
  ok(codes() === 'ckm,tl,tlb,tt,tui,xx', 'mac dinh: thay du 6 muc: ' + codes());
  // --- loc ---
  w.vtToggleTree('f'); ok(!$('vt-nf-panel').hidden, 'bam nut thu muc -> dropdown mo');
  ok(!$('vt-nf-panel').querySelector('[data-p="Túi tiền/Cổ"]'), 'con dang THU gon (chua xo me)');
  $('vt-nf-panel').querySelector('[data-vtn="tg"][data-p="Túi tiền"]').click();
  ok($('vt-nf-panel').querySelector('[data-vtn="pick"][data-p="Túi tiền/Cổ"]') && $('vt-nf-panel').querySelector('[data-vtn="pick"][data-p="Túi tiền/Lắc"]'), 'bam ▸ me -> con Co/Lac hien theo hang doc');
  ok(!$('vt-nf-panel').querySelector('[data-p="Túi tiền/Lắc/Bạc"]'), 'chau van thu gon');
  $('vt-nf-panel').querySelector('[data-vtn="pick"][data-p="Túi tiền"]').click();
  ok($('vt-nf-panel').hidden, 'chon xong dong dropdown');
  ok(codes() === 'tl,tlb,tt', 'chon me "Tui tien" -> gom con chau, KHONG lan thu muc "Tui": ' + codes());
  ok(/Túi tiền/.test($('vt-nf-btn').textContent), 'nut loc hien ten thu muc dang chon');
  w.vtToggleTree('f'); $('vt-nf-panel').querySelector('[data-vtn="pick"][data-p="Túi tiền/Lắc"]').click();
  ok(codes() === 'tl,tlb', 'chon con "Lac" -> gom ca chau Bac: ' + codes());
  w.vtToggleTree('f'); $('vt-nf-panel').querySelector('[data-vtn="pick"][data-p="*chung"]').click();
  ok(codes() === 'xx', 'chon "Chua phan nhom": ' + codes());
  w.vtToggleTree('f'); $('vt-nf-panel').querySelector('[data-vtn="pick"][data-p=""]').click();
  ok(codes() === 'ckm,tl,tlb,tt,tui,xx', 'chon "Tat ca" -> ra du lai');
  // --- thu/xo tieu de thu muc trong danh sach ---
  d.querySelector('#vt-list [data-vtn="fold"][data-p="Túi tiền"]').click();
  ok(codes() === 'ckm,tui,xx', 'bam tieu de thu muc me -> thu gon ca con chau: ' + codes());
  $('vt-search').value = 'lac'; w.vtRender(); ok(/tl\b/.test(codes()), 'dang tim kiem -> bo qua thu gon, van thay ket qua');
  $('vt-search').value = ''; w.vtRender();
  d.querySelector('#vt-list [data-vtn="fold"][data-p="Túi tiền"]').click(); ok(codes() === 'ckm,tl,tlb,tt,tui,xx', 'bam lai -> xo ra');
  // --- chon thu muc trong FORM ---
  w.vtOpenForm();
  w.vtToggleTree('p'); ok(!$('vt-np-panel').hidden, 'form: mo dropdown chon thu muc');
  $('vt-np-panel').querySelector('[data-vtn="tg"][data-p="Túi tiền"]').click();
  $('vt-np-panel').querySelector('[data-vtn="pick"][data-p="Túi tiền/Cổ"]').click();
  ok($('vt-f-nhom').value === 'Túi tiền/Cổ' && $('vt-np-panel').hidden, 'chon thu muc co san -> dien vao o Thu muc: ' + $('vt-f-nhom').value);
  // tao thu muc con
  let asked = ['Dây chuyền']; w.prompt = () => asked.shift();
  w.vtToggleTree('p');
  ok($('vt-np-panel').querySelector('[data-vtn="add"][data-p="Túi tiền"]'), 'moi thu muc cap 1-2 co nut ＋ tao con');
  ok(!$('vt-np-panel').querySelector('[data-vtn="add"][data-p="Túi tiền/Lắc/Bạc"]'), 'cap 3 KHONG co nut ＋ (server chi nhan toi da 3 cap)');
  $('vt-np-panel').querySelector('[data-vtn="add"][data-p="Túi tiền"]').click();
  ok($('vt-f-nhom').value === 'Túi tiền/Dây chuyền', 'tao thu muc con moi -> "Me/Con": ' + $('vt-f-nhom').value);
  asked = ['Phụ kiện']; w.vtToggleTree('p'); $('vt-np-panel').querySelector('[data-vtn="newroot"]').click();
  ok($('vt-f-nhom').value === 'Phụ kiện', 'tao thu muc me moi: ' + $('vt-f-nhom').value);
  asked = ['a/b']; w.vtToggleTree('p'); $('vt-np-panel').querySelector('[data-vtn="add"][data-p="Túi tiền"]').click();
  ok($('vt-f-nhom').value === 'Phụ kiện', 'ten co dau / bi tu choi, giu nguyen gia tri cu');
  // luu: payload mang dung duong dan thu muc moi
  $('vt-f-nhom').value = 'Túi tiền/Dây chuyền'; $('vt-f-abbr').value = 'dc'; $('vt-f-opts').querySelectorAll('textarea')[0].value = 'Dây chuyền bạc'; $('vt-f-scope').value = 'team';
  await w.vtSave(); await sleep(20);
  const pj = JSON.parse(E.calls.filter((c) => c.body && /saveVietTat/.test(c.body)).pop().body);
  ok(pj.snippet.nhom === 'Túi tiền/Dây chuyền', 'luu mau gui dung nhom me/con: ' + pj.snippet.nhom);
  // bam ra ngoai dong panel
  w.vtOpenForm(); w.vtToggleTree('p'); d.body.click(); ok($('vt-np-panel').hidden, 'bam ra ngoai -> dong dropdown');
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-TREE TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
