#!/usr/bin/env node
// Test L1 — khung xanh navy (js/55-fn-shell.js + css/13-shell.css). Chay: node tools/test-shell.js -> "ALL SHELL TESTS PASSED". Phan DOM can jsdom (khong co thi chi chay logic + CSS).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const { shellDecide_, SHELL_MIN_W } = require(path.join(ROOT, 'js', '55-fn-shell.js'));

// ===== logic thuan =====
const base = { pref: 'on', width: 1400, dataViewShown: true, blocked: false, collapsed: false };
const D = o => shellDecide_(Object.assign({}, base, o));
ok(SHELL_MIN_W === 1100, 'nguong 1100px');
ok(D({}).on && !D({}).collapsed, 'man rong + data-view hien -> bat khung');
ok(!D({ width: 1099 }).on && D({ width: 1100 }).on, 'duoi 1100px -> tat (ngan keo cu); dung 1100 -> bat');
ok(!D({ dataViewShown: false }).on, 'dang o man dang nhap/tai -> khong bat (nen khong tran navy)');
ok(!D({ pref: 'off' }).on, 'chon Giao dien cu -> tat');
ok(!D({ blocked: true }).on, 'dashboard/bao cao doc lap -> tat');
ok(D({ collapsed: true }).on && D({ collapsed: true }).collapsed, 'thu gon -> van bat mau, collapsed=true');
ok(!D({ collapsed: true, width: 800 }).collapsed, 'tat khung thi khong co trang thai thu gon');

// ===== CSS: moi luat deu nam trong pham vi .ui-shell (hoac chan menu .sh-foot) =====
const css = fs.readFileSync(path.join(ROOT, 'css', '13-shell.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const sels = []; css.split('}').forEach(r => { const i = r.indexOf('{'); if (i > -1) r.slice(0, i).split(',').forEach(s => { s = s.trim(); if (s) sels.push(s); }); });
const bad = sels.filter(s => !s.startsWith('html.ui-pro.ui-shell') && !s.startsWith('#data-view .tabs .sh-foot'));
ok(sels.length > 20 && bad.length === 0, 'moi selector nam trong .ui-shell hoac .sh-foot; vi pham: ' + bad.join(' | '));
ok(/html\.ui-pro\.ui-shell:not\(\.shell-collapsed\) \.app\{margin-left:240px/.test(css), 'cham: noi dung dich 240px khi ghim');
ok(/#sn-toggle[^}]*display:none!important/.test(css), 'an nut Menu khi da ghim');
ok(!/#1b3558|#2c4a78/.test(css) && /linear-gradient\(180deg,#14532d/.test(css), 'khong con navy, menu xanh la gradient');
ok(/body\.pro-has-tabs #data-view \.tabs\{bottom:38px/.test(css) && /#pro-tabbar\{left:240px/.test(css), 'thanh tab ho so o day: menu dung tren thanh, thanh bat dau sau menu');

let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bo qua phan DOM: chua cai jsdom)'); console.log('ALL SHELL TESTS PASSED (chi logic + CSS)'); process.exit(0); }
const src = fs.readFileSync(path.join(ROOT, 'js', '55-fn-shell.js'), 'utf8');
const wait = (ms) => new Promise(r => setTimeout(r, ms || 20));
function boot(o) {
  o = o || {};
  const dom = new JSDOM('<html><body><div id="data-view" style="display:' + (o.shown === false ? 'none' : 'flex') + '"><div class="tabs"><div class="tab" data-bar-id="overview">Tổng quan</div><div class="sn-gh" data-k="ov">NHÓM</div></div></div></body></html>',
    { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w, 'innerWidth', { value: o.width || 1400, configurable: true, writable: true });
  if (o.pref) w.localStorage.setItem('ome_shell', o.pref); w.localStorage.setItem('ome_shell_col', o.col ? '1' : '0');  /* mac dinh that la THU GON (xem js/55); test mac dinh ghim */
  if (o.cls) o.cls.forEach(c => w.document.documentElement.classList.add(c));
  if (o.bodyCls) w.document.body.classList.add(o.bodyCls);
  w.confirm = () => (o.confirm === undefined ? true : o.confirm);
  w.eval(src); return w;
}
const html = w => w.document.documentElement;
const tabs = w => w.document.querySelector('#data-view .tabs');
const btn = (w, c) => w.document.querySelector('.sh-foot .' + c);

(async () => {
  let w = boot(); await wait();
  ok(html(w).classList.contains('ui-shell') && !html(w).classList.contains('shell-collapsed'), 'man rong + data-view hien: bat khung, chua thu gon');
  ok(tabs(w).querySelectorAll('.sh-foot').length === 1 && tabs(w).lastElementChild.className === 'sh-foot', 'chan menu them 1 lan, nam cuoi');
  ok(btn(w, 'sh-col').textContent === '⟨ Thu gọn' && btn(w, 'sh-old').textContent === '⇄ Giao diện cũ', 'nut: Thu gon + Giao dien cu');
  // them muc menu sau (sidenav tao muon): chan menu van nam cuoi
  const nt = w.document.createElement('div'); nt.className = 'tab'; tabs(w).appendChild(nt); await wait();
  ok(tabs(w).lastElementChild.className === 'sh-foot', 'sau khi menu them muc moi, chan menu van o cuoi');
  w.shellApply(); w.shellApply(); ok(tabs(w).querySelectorAll('.sh-foot').length === 1, 'goi lai nhieu lan khong nhan doi chan menu');
  // thu gon / ghim
  btn(w, 'sh-col').click();
  ok(html(w).classList.contains('ui-shell') && html(w).classList.contains('shell-collapsed') && btn(w, 'sh-col').textContent === '📌 Ghim menu' && w.localStorage.getItem('ome_shell_col') === '1', 'bam Thu gon: collapsed + nho lua chon + nut thanh Ghim menu');
  btn(w, 'sh-col').click(); ok(!html(w).classList.contains('shell-collapsed') && w.localStorage.getItem('ome_shell_col') === '0', 'bam Ghim menu: ghim lai');
  // giao dien cu / moi
  w.confirm = () => false; btn(w, 'sh-old').click(); ok(html(w).classList.contains('ui-shell'), 'Giao dien cu nhung Huy o hop xac nhan -> giu nguyen');
  w.confirm = () => true; btn(w, 'sh-old').click();
  ok(!html(w).classList.contains('ui-shell') && w.localStorage.getItem('ome_shell') === 'off' && btn(w, 'sh-old').textContent === '✨ Giao diện mới' && btn(w, 'sh-col').style.display === 'none', 'Giao dien cu: tat khung, hien nut Giao dien moi, an Thu gon');
  btn(w, 'sh-old').click(); ok(html(w).classList.contains('ui-shell') && w.localStorage.getItem('ome_shell') === 'on', 'bam Giao dien moi: bat lai');
  // doi do rong cua so
  w.innerWidth = 900; w.dispatchEvent(new w.Event('resize')); ok(!html(w).classList.contains('ui-shell'), 'thu nho < 1100px: tu tat (ngan keo cu)');
  ok(btn(w, 'sh-old').style.display === 'none' && btn(w, 'sh-col').style.display === 'none', 'man nho: an ca 2 nut chan menu');
  w.innerWidth = 1500; w.dispatchEvent(new w.Event('resize')); ok(html(w).classList.contains('ui-shell'), 'phong to lai: bat lai');
  // data-view an/hien (dang nhap -> vao app)
  w = boot({ shown: false }); await wait(); ok(!html(w).classList.contains('ui-shell'), 'data-view dang an (man dang nhap): khong bat khung');
  w.document.getElementById('data-view').style.display = 'flex'; await wait(); ok(html(w).classList.contains('ui-shell'), 'data-view hien ra: tu bat khung');
  w.document.getElementById('data-view').style.display = 'none'; await wait(); ok(!html(w).classList.contains('ui-shell'), 'data-view an lai: tat khung');
  // da luu lua chon tu truoc
  w = boot({ pref: 'off' }); await wait(); ok(!html(w).classList.contains('ui-shell') && btn(w, 'sh-old').textContent === '✨ Giao diện mới', 'luu Giao dien cu: mo lai van cu, co nut bat lai');
  w = boot({ col: true }); await wait(); ok(html(w).classList.contains('shell-collapsed'), 'luu Thu gon: mo lai van thu gon');
  w = boot({ cls: ['db-standalone'] }); await wait(); ok(!html(w).classList.contains('ui-shell'), 'dashboard doc lap: khong bat');
  w = boot({ bodyCls: 'rpt-mode' }); await wait(); ok(!html(w).classList.contains('ui-shell'), 'che do bao cao (rpt-mode): khong bat');
  w = boot({ width: 800 }); await wait(); ok(!html(w).classList.contains('ui-shell') && btn(w, 'sh-old').style.display === 'none', 'man nho: khong bat, khong hien nut');
  // localStorage hong (che do rieng tu) khong lam loi
  const w3 = boot({}); Object.defineProperty(w3, 'localStorage', { get() { throw new Error('blocked'); } }); w3.shellApply(); ok(true, 'localStorage bi chan: khong nem loi');
  console.log('ALL SHELL TESTS PASSED');
})().catch(e => { console.error('LOI:', e); process.exit(1); });
