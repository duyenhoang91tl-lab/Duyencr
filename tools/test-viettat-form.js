#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — FORM THONG MINH: bao trung viet tat luc go (canh bao mem), goi y viet tat tu chu cai dau, khoi anh/ghi am thu gon.
// Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-form.js
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
  { id: 'a', abbr: 'ch', keyword: '', options: ['Chào {tên}'], scope: 'team', nhom: 'Chào hỏi' },
  { id: 'b', abbr: 'CH', keyword: '', options: ['Chào 2'], scope: 'me', nhom: '' },
  { id: 'c', abbr: 'decc', keyword: '', options: ['x'], scope: 'me', nhom: '', images: [{ id: 'IMGabcdefghijklmnopqrs', name: 'a.jpg' }] },
  { id: 'd', abbr: 'tpl', keyword: '', options: ['t'], scope: 'team', nhom: 'Mẫu tin', fromTpl: true }
];
(async () => {
  const E = await boot({ admin: true, resp: { ok: true, snippets: SNIP, canTeam: true, me: 'Duyen' } });
  const w = E.w, $ = E.$, d = w.document; E.w.switchTab('zaloai'); await sleep(30);
  const fire = (el) => el.dispatchEvent(new w.Event('input', { bubbles: true }));
  const msg = () => $('vt-f-abbrmsg').textContent;
  w.vtOpenForm();
  ok($('vt-f-media').open === false, 'muc moi: khoi anh & ghi am THU GON mac dinh');
  ok(/không bắt buộc/.test($('vt-f-mediasum').textContent), 'tieu de thu gon ghi "khong bat buoc"');
  ok(msg() === '', 'form moi, chua go gi -> chua co goi y');
  const t0 = $('vt-f-opts').querySelector('textarea'); t0.value = 'Dạ em chào chị {tên} ạ'; fire(t0);
  ok(/Gợi ý/.test(msg()) && d.querySelector('[data-vta]').getAttribute('data-vta') === 'decc2', 'go noi dung, abbr trong -> goi y chu cai dau "decc", trung muc c nen thanh decc2: ' + msg());
  d.querySelector('[data-vta]').click(); ok($('vt-f-abbr').value === 'decc2' && /Chưa trùng/.test(msg()), 'cham goi y -> dien vao o viet tat + bao chua trung');
  t0.value = 'Giá'; $('vt-f-abbr').value = ''; fire(t0); ok(d.querySelector('[data-vta]').getAttribute('data-vta') === 'gia', 'noi dung 1 tu -> 3 chu cai dau: ' + (d.querySelector('[data-vta]') || {}).textContent);
  t0.value = '😀 {tên}'; fire(t0); ok(msg() === '', 'noi dung khong co chu -> khong goi y');
  $('vt-f-abbr').value = 'Ch'; fire($('vt-f-abbr'));
  ok(/đã dùng ở/.test(msg()) && /👥 Chung · Chào hỏi/.test(msg()) && /🙋 Của tôi/.test(msg()), 'trung "Ch" (khong phan biet hoa/thuong) -> bao ca 2 muc + pham vi/thu muc: ' + msg());
  $('vt-f-abbr').value = 'tpl'; fire($('vt-f-abbr')); ok(/📝 Mẫu tin/.test(msg()), 'trung voi muc lay tu Mau tin cung duoc bao');
  $('vt-f-abbr').value = 'a b'; fire($('vt-f-abbr')); ok(/1 từ/.test(msg()), 'co khoang trang -> bao loi 1 tu');
  // sua chinh muc 'a' -> khong tu bao trung voi chinh no
  w.vtOpenForm('a'); ok($('vt-f-abbr').value === 'ch' && /🙋 Của tôi/.test(msg()) && !/👥/.test(msg()), 'dang sua muc a: khong bao trung voi chinh no, chi bao muc CH khac: ' + msg());
  // sua muc co anh -> tu mo khoi anh + dem
  w.vtOpenForm('c'); ok($('vt-f-media').open === true && /1 ảnh/.test($('vt-f-mediasum').textContent), 'sua muc co anh -> tu mo khoi + hien "1 anh": ' + $('vt-f-mediasum').textContent);
  w.vtOpenForm('b'); ok($('vt-f-media').open === false && /không bắt buộc/.test($('vt-f-mediasum').textContent), 'mo muc khong anh -> thu gon lai');
  // van luu duoc khi trung (canh bao mem)
  w.vtOpenForm(); $('vt-f-abbr').value = 'ch'; $('vt-f-opts').querySelector('textarea').value = 'Mục trùng'; fire($('vt-f-abbr'));
  await w.vtSave(); await sleep(20);
  ok(E.calls.some((c) => c.body && /saveVietTat/.test(c.body) && /Mục trùng/.test(c.body)), 'trung viet tat van gui luu (server cho phep, chi canh bao)');
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-FORM TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
