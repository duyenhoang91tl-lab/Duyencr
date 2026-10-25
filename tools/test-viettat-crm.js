#!/usr/bin/env node
// Test (2026-10-25): Viet Tat tren CRM (js/57-viettat.js) — quan ly (tab Zalo AI) + go tat trong <textarea>. Nap NGUYEN file trong jsdom voi fetch gia.
// Can jsdom: NODE_PATH=<thu muc co node_modules/jsdom> node tools/test-viettat-crm.js
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
  w.fetch = async (u, init) => { calls.push({ u, body: init && init.body }); if (/action=vietTat/.test(u)) { if (o.fail) throw new Error('mang'); return { json: async () => (o.resp || { ok: true, snippets: SN, canTeam: !!o.admin, me: 'Hoa' }) }; } return { json: async () => (o.save || { ok: true, id: 'vt_new' }) }; };
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
  let E = await boot({ admin: true });
  E.w.switchTab('zaloai'); await sleep(20);
  ok(E.calls.some((c) => c.u && /action=vietTat/.test(c.u)), 'mo tab Zalo AI -> tai danh sach viet tat');
  ok(E.$('vt-list').querySelectorAll('code').length === 2 && /Chào hỏi/.test(E.$('vt-list').textContent), 've danh sach 2 muc, co nhom');
  ok(!/<b>từ<\/b>/.test(E.$('vt-list').innerHTML) && /&lt;b&gt;từ&lt;\/b&gt;/.test(E.$('vt-list').innerHTML), 'noi dung duoc ESCAPE HTML (khong chay duoc the)');
  ok(E.$('vt-list').querySelectorAll('button[title="Sửa"]').length === 2, 'admin sua/xoa duoc ca muc chung va muc rieng');
  ok(/Bạn là admin/.test(E.$('vt-hint').textContent), 'goi y cho admin');
  E.$('vt-search').value = 'bang gia'; E.w.vtRender();   // (jsdom outside-only khong chay oninput inline)
  ok(E.$('vt-list').querySelectorAll('code').length === 1, 'tim khong dau theo tu khoa "bảng giá"');
  E.$('vt-search').value = ''; E.$('vt-scope-filter').value = 'team'; E.w.vtRender(); ok(E.$('vt-list').querySelectorAll('code').length === 1 && E.$('vt-list').querySelector('code').textContent === 'ch', 'loc theo Chung');
  E.$('vt-scope-filter').value = '';

  // nhan vien: muc chung khong sua duoc
  const U = await boot({ admin: false }); U.w.switchTab('zaloai'); await sleep(20);
  ok(U.$('vt-list').querySelectorAll('button[title="Sửa"]').length === 1, 'nhan vien chi sua/xoa duoc muc RIENG cua minh');
  U.w.vtOpenForm(); ok(U.$('vt-f-scope').querySelector('option[value="team"]').disabled === true && U.$('vt-f-scope').value === 'me', 'nhan vien khong chon duoc "Chung"');

  // them moi (admin)
  E.w.vtOpenForm(); ok(E.$('vt-form-wrap').style.display === 'block' && E.$('vt-f-opts').children.length === 1, 'mo form them moi voi 1 o noi dung');
  E.w.vtAddOpt(); ok(E.$('vt-f-opts').children.length === 2, 'them lua chon');
  E.$('vt-f-abbr').value = 'co khoang'; E.$('vt-f-opts').querySelector('textarea').value = 'abc'; await E.w.vtSave();
  ok(E.calls.some((c) => c.alert && /1 từ/.test(c.alert)), 'viet tat co khoang trang -> canh bao, KHONG gui'); ok(!E.calls.some((c) => c.body && /saveVietTat/.test(c.body)), 'khong goi server khi du lieu sai');
  E.$('vt-f-abbr').value = 'sp'; E.$('vt-f-opts').querySelectorAll('textarea')[0].value = '  Cảm ơn {tên}  '; E.$('vt-f-opts').querySelectorAll('textarea')[1].value = '   '; E.$('vt-f-scope').value = 'team'; E.$('vt-f-nhom').value = 'Cảm ơn'; E.$('vt-f-keyword').value = ' camon ';
  E.calls.length = 0; await E.w.vtSave(); await sleep(20);
  const post = E.calls.find((c) => c.body && /saveVietTat/.test(c.body)); const pj = post && JSON.parse(post.body);
  ok(pj && pj.action === 'saveVietTat' && pj.snippet.abbr === 'sp' && JSON.stringify(pj.snippet.options) === JSON.stringify(['Cảm ơn {tên}']) && pj.snippet.scope === 'team' && pj.snippet.keyword === 'camon' && pj.snippet.nhom === 'Cảm ơn' && !pj.snippet.id, 'gui dung payload (cat khoang trang, bo o rong): ' + JSON.stringify(pj && pj.snippet));
  ok(E.$('vt-form-wrap').style.display === 'none' && E.calls.some((c) => c.u && /action=vietTat/.test(c.u)), 'luu xong dong form + tai lai danh sach');

  // sua
  E.w.vtOpenForm('vt_1'); ok(E.$('vt-f-abbr').value === 'ch' && E.$('vt-f-opts').children.length === 2 && E.$('vt-f-scope').disabled === true, 'mo form sua: dien san 2 lua chon, khoa o chung/rieng');
  E.calls.length = 0; await E.w.vtSave(); const pj2 = JSON.parse(E.calls.find((c) => c.body).body); ok(pj2.snippet.id === 'vt_1', 'sua gui kem id');
  // loi server
  const F = await boot({ admin: true, save: { error: 'Chi admin' } }); F.w.vtOpenForm(); F.$('vt-f-abbr').value = 'q'; F.$('vt-f-opts').querySelector('textarea').value = 'x'; await F.w.vtSave();
  ok(F.calls.some((c) => c.alert && /Chi admin/.test(c.alert)) && F.$('vt-form-wrap').style.display === 'block', 'server tu choi -> bao loi, GIU form de sua');
  // xoa
  E.calls.length = 0; await E.w.vtDelete('vt_2'); ok(E.calls.some((c) => c.body && JSON.parse(c.body).action === 'deleteVietTat' && JSON.parse(c.body).id === 'vt_2'), 'xoa goi deleteVietTat');
  const N = await boot({ admin: true, confirm: false }); N.calls.length = 0; await N.w.vtDelete('vt_2'); ok(!N.calls.some((c) => c.body), 'huy xac nhan -> khong xoa');
  const X = await boot({ fail: true }); X.w.switchTab('zaloai'); await sleep(20); ok(/Lỗi tải/.test(X.$('vt-list').textContent), 'loi mang -> bao loi + nut Thu lai');

  // go tat trong textarea
  const ta = E.$('t'); await E.w.loadVietTat(true);
  E.typeTA(ta, 'xin ch'); ok(E.popup() && E.popup()[0] === 'Chào {tên} ạ', 'textarea: go "ch" hien goi y (chua mo khach -> giu {tên}): ' + JSON.stringify(E.popup()));
  E.key(ta, 'Tab'); ok(ta.value === 'xin Chào {tên} ạ', 'Tab chen: ' + JSON.stringify(ta.value));
  E.typeTA(ta, 'ch Thu Hà'); E.key(ta, 'ArrowDown'); E.key(ta, 'Tab'); ok(ta.value === 'Dạ em chào chị Hà ạ', 'ch + ten: ' + JSON.stringify(ta.value));
  E.typeTA(ta, 'gb'); ok(E.popup()[0] === 'Giá nhẫn bạc <b>từ</b> 500k', 'noi dung giu NGUYEN van ban (khong bien thanh HTML) khi chen'); E.key(ta, '1', { altKey: true }); ok(ta.value === 'Giá nhẫn bạc <b>từ</b> 500k', 'Alt+1');
  const popHtml = E.w.document.getElementById('vt-host').shadowRoot.querySelector('.b').innerHTML; E.typeTA(ta, 'gb'); ok(!/<b>từ<\/b>/.test(E.w.document.getElementById('vt-host').shadowRoot.querySelector('.b').innerHTML), 'popup ESCAPE HTML noi dung');
  E.key(ta, 'Escape'); ok(E.popup() === null, 'Esc dong');
  E.typeTA(E.$('off'), 'ch'); ok(E.popup() === null, 'o co data-vt="off" -> khong goi y');
  E.typeTA(E.$('inp'), 'ch'); ok(E.popup() === null, 'o <input> (ten/SDT/tim) khong bi dong vao');
  const f = E.$('vt-f-opts'); E.w.vtOpenForm(); E.typeTA(f.querySelector('textarea'), 'ch'); ok(E.popup() === null, 'dang SOAN viet tat (o noi dung) -> khong tu bung');
  const C = await boot({ admin: true, phone: '0912345678' }); await C.w.loadVietTat(true); C.typeTA(C.$('t'), 'ch'); ok(C.popup() && C.popup()[0] === 'Chào Hà ạ', 'khach dang mo o ngan ho so -> tu lay ten: ' + JSON.stringify(C.popup()));
  const Z = await boot({ resp: { ok: true, snippets: [], canTeam: false, me: '' } }); await Z.w.loadVietTat(true); Z.typeTA(Z.$('t'), 'ch'); ok(Z.popup() === null, 'chua co viet tat -> im lang');
  console.log(bad ? ('\n' + bad + ' LOI') : '\nALL VIETTAT-CRM TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
