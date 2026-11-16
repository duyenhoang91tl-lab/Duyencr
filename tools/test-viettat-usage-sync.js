#!/usr/bin/env node
// Test (2026-11-14): CRM Viet tat — DONG BO LUOT DUNG giua cac may (client): delta cho gui, cong don tren server, keo tong ve may khac, loi mang/chua dang nhap khong mat luot.
// Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-usage-sync.js
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
  { id: 'a', abbr: 'aa', keyword: '', options: ['A'], scope: 'team', nhom: '' },
  { id: 'b', abbr: 'bb', keyword: '', options: ['B'], scope: 'team', nhom: '' }
];
// "server": cong don delta theo nguoi; che do loi/forbidden
const server = { counts: {}, mode: 'ok', hits: [] };
async function mkDevice(seed) {
  const E = await boot({ admin: true, resp: { ok: true, snippets: SNIP, canTeam: true, me: 'Hoa' } });
  const w = E.w; if (seed) Object.keys(seed).forEach((k) => w.localStorage.setItem(k, seed[k]));
  const orig = w.fetch; E.usagePosts = [];
  w.fetch = async (u, init) => {
    if (init && init.body && /"vietTatUsage"/.test(init.body)) {
      const delta = JSON.parse(init.body).delta; E.usagePosts.push(delta);
      if (server.mode === 'down') throw new Error('mang');
      if (server.mode === 'forbidden') return { json: async () => ({ ok: false, code: 'FORBIDDEN', error: 'x' }) };
      Object.keys(delta).forEach((k) => { server.counts[k] = (server.counts[k] || 0) + delta[k]; });
      return { json: async () => ({ ok: true, counts: JSON.parse(JSON.stringify(server.counts)) }) };
    }
    return orig(u, init);
  };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  E.copy = async (id) => { await w.vtCopyOption(id, 0); };
  E.ls = (k) => JSON.parse(w.localStorage.getItem(k) || 'null');
  return E;
}
(async () => {
  // 1) gom delta, chua gui ngay; gui xong -> pending rong, usage = tong server
  let A = await mkDevice(); A.w.switchTab('zaloai'); await sleep(40);
  A.usagePosts.length = 0;
  await A.copy('a'); await A.copy('a'); await A.copy('b');
  ok(A.usagePosts.length === 0, 'cham de chep khong gui ngay (doi 4s/dong tab de gom) — chua co POST: ' + A.usagePosts.length);
  ok(JSON.stringify(A.ls('vt_usage_pending')) === '{"a":2,"b":1}', 'delta cho gui: ' + JSON.stringify(A.ls('vt_usage_pending')));
  ok(await A.w.vtSyncUsage() === true, 'dong bo thanh cong');
  ok(JSON.stringify(A.usagePosts[A.usagePosts.length - 1]) === '{"a":2,"b":1}', 'gui dung delta {a:2,b:1}');
  ok(JSON.stringify(A.ls('vt_usage_pending')) === '{}' && JSON.stringify(A.ls('vt_usage')) === '{"a":2,"b":1}', 'sau dong bo: pending rong, tong = server');
  // 2) may B (may khac cua cung nguoi): keo tong ve khi tai danh sach
  let B = await mkDevice(); B.w.switchTab('zaloai'); await sleep(60);
  ok(JSON.stringify(B.ls('vt_usage')) === '{"a":2,"b":1}', 'may B tai danh sach -> KEO tong tu server ve (a2,b1): ' + JSON.stringify(B.ls('vt_usage')));
  const pulls = B.usagePosts.length; await B.w.loadVietTat(true); await sleep(30);
  ok(B.usagePosts.length === pulls, 'chi keo 1 lan/phien khi khong co delta (khong spam server): ' + pulls + ' -> ' + B.usagePosts.length);
  // 3) may B dung them, A keo ve -> cong chung 2 may
  await B.copy('b'); await B.copy('b'); await B.w.vtSyncUsage();
  await A.copy('a'); await A.w.vtSyncUsage();
  ok(JSON.stringify(A.ls('vt_usage')) === '{"a":3,"b":3}', 'A + B dung xen ke -> cung ra tong a3,b3: ' + JSON.stringify(A.ls('vt_usage')));
  // 4) mat mang: giu delta, lan sau gui du
  server.mode = 'down'; await A.copy('a'); await A.copy('b');
  ok(await A.w.vtSyncUsage() === false && JSON.stringify(A.ls('vt_usage_pending')) === '{"a":1,"b":1}', 'mat mang -> KHONG mat luot (delta van giu)');
  ok(JSON.stringify(A.ls('vt_usage')) === '{"a":4,"b":4}', 'tong hien tren may van cong luot moi (dung offline van thay so)');
  server.mode = 'forbidden'; ok(await A.w.vtSyncUsage() === false && JSON.stringify(A.ls('vt_usage_pending')) === '{"a":1,"b":1}', 'chua dang nhap (FORBIDDEN) -> giu delta, khong loi');
  server.mode = 'ok'; ok(await A.w.vtSyncUsage() === true && JSON.stringify(A.ls('vt_usage_pending')) === '{}', 'co mang/dang nhap lai -> gui bu du');
  ok(JSON.stringify(server.counts) === '{"a":4,"b":4}', 'server nhan du, khong thieu/khong gap doi: ' + JSON.stringify(server.counts));
  // 5) luot phat sinh GIUA luc dang gui khong bi mat
  let C = await mkDevice(); C.w.switchTab('zaloai'); await sleep(40); await C.copy('a');
  const origFetch = C.w.fetch; let release; C.w.fetch = (u, init) => { if (init && init.body && /"vietTatUsage"/.test(init.body)) return new Promise((res) => { release = () => res(origFetch(u, init)); }); return origFetch(u, init); };
  const p = C.w.vtSyncUsage(); await sleep(5); await C.copy('b'); release(); await p;
  ok(JSON.stringify(C.ls('vt_usage_pending')) === '{"b":1}', 'luot dung luc dang gui van con trong delta: ' + JSON.stringify(C.ls('vt_usage_pending')));
  // 6) di chuyen so luot cu (chua tung dong bo) len server lan dau
  server.counts = {}; server.mode = 'ok';
  let D = await mkDevice({ vt_usage: JSON.stringify({ a: 7 }) }); D.w.switchTab('zaloai'); await sleep(60);
  ok(server.counts.a === 7 && JSON.stringify(D.ls('vt_usage')) === '{"a":7}', 'may da co so dem rieng (a7) tu truoc -> day len server lan dau: ' + JSON.stringify(server.counts));
  // 7) du lieu hong
  let F = await mkDevice({ vt_usage_pending: 'khong-json' }); ok(await F.w.vtSyncUsage() === true, 'vt_usage_pending hong -> coi nhu rong, khong loi');
  console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-USAGE-SYNC TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
