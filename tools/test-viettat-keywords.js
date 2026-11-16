#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — GOI Y TU KHOA tu noi dung trong form. Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-keywords.js
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
(async () => {
  const E = await boot({ admin: true, resp: { ok: true, snippets: [], canTeam: true, me: 'Duyen' } });
  const w = E.w, $ = E.$, d = w.document; E.w.switchTab('zaloai'); await sleep(30);
  const S = (texts, abbr, cur) => w._vtSuggestKeywords(texts, abbr, cur);
  const j = (a) => JSON.stringify(a);
  // ham thuan
  ok(j(S(['Dạ em gửi chị bảng giá nhẫn bạc, giá nhẫn bạc từ 500k ạ'])) === j(['giá', 'nhẫn', 'bạc', 'gửi', 'bảng', '500k']), 'bo tu dem (da, em, chi, a), xep theo so lan lap roi thu tu: ' + j(S(['Dạ em gửi chị bảng giá nhẫn bạc, giá nhẫn bạc từ 500k ạ'])));
  ok(j(S(['Chào {tên khách} {ngày} bảo hành']).filter((x) => /ten|ngay|khach/i.test(x))) === '[]', 'bo bien {ten}/{ngay}');
  ok(!S(['Số 123 và 4567 giá ship']).some((x) => /^\d+$/.test(x)), 'bo so thuan');
  ok(!S(['ok ab cd ship']).includes('ab') && S(['ok ab cd ship']).includes('ship'), 'bo tu < 3 ky tu, giu tu dai hon');
  ok(j(S(['giá nhẫn bạc'], 'gia', '')) === j(['nhẫn', 'bạc']), 'bo tu trung viet tat (gia): ' + j(S(['giá nhẫn bạc'], 'gia', '')));
  ok(j(S(['giá nhẫn bạc'], '', 'Nhan, GIA')) === j(['bạc']), 'bo tu da co trong o tu khoa (khong phan biet dau/hoa-thuong): ' + j(S(['giá nhẫn bạc'], '', 'Nhan, GIA')));
  ok(S(['một hai ba bốn năm sáu bảy tám chín mười mười một'.replace(/mười/g, 'mười')]).length <= 6, 'toi da 6 goi y');
  ok(j(S([])) === '[]' && j(S([''])) === '[]', 'noi dung trong -> khong goi y');
  ok(S(['GIÁ Giá giá'])[0] === 'giá' && S(['GIÁ Giá giá']).length === 1, 'gop hoa/thuong thanh 1 tu');
  // giao dien
  w.vtOpenForm();
  ok($('vt-f-kwmsg').innerHTML === '', 'form moi: chua goi y');
  const t0 = $('vt-f-opts').querySelector('textarea'); t0.value = 'Bảo hành nhẫn bạc 12 tháng, đổi size miễn phí'; t0.dispatchEvent(new w.Event('input', { bubbles: true }));
  const chips = () => [...d.querySelectorAll('#vt-f-kwmsg [data-vtk]')].map((x) => x.getAttribute('data-vtk'));
  ok(chips().length > 0 && chips()[0] === 'bảo', 'go noi dung -> hien chip goi y tu khoa: ' + chips());
  d.querySelector('#vt-f-kwmsg [data-vtk="bảo"]').click();
  ok($('vt-f-keyword').value === 'bảo' && !chips().includes('bảo'), 'cham chip -> them vao o tu khoa va chip bien mat');
  d.querySelector('#vt-f-kwmsg [data-vtk="hành"]').click();
  ok($('vt-f-keyword').value === 'bảo, hành', 'them tiep -> noi bang dau phay: ' + $('vt-f-keyword').value);
  $('vt-f-keyword').value = 'x'.repeat(198); d.querySelector('#vt-f-kwmsg [data-vtk]').click();
  ok($('vt-f-keyword').value.length === 198, 'vuot 200 ky tu -> khong them');
  // clone/sua cap nhat goi y
  $('vt-f-keyword').value = ''; w.vtAbbrCheck(); ok(chips().length > 0, 'xoa het tu khoa -> goi y quay lai');
  // luu: tu khoa chip di vao payload
  $('vt-f-keyword').value = ''; $('vt-f-abbr').value = 'bh'; d.querySelector('#vt-f-kwmsg [data-vtk="nhẫn"]').click();
  await w.vtSave(); await sleep(20);
  const pj = JSON.parse(E.calls.filter((c) => c.body && /saveVietTat/.test(c.body)).pop().body).snippet;
  ok(pj.keyword === 'nhẫn', 'luu: payload mang tu khoa da chon: ' + pj.keyword);
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-KEYWORDS TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
