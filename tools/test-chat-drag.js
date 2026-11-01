#!/usr/bin/env node
// Test keo-tha + thu nho hang cua dock Chat noi bo (khoi "keo-tha + thu nho hang" trong js/43-teamchat.js) bang jsdom. CAN jsdom (thieu thi tu bo qua).
// Chay: node tools/test-chat-drag.js -> "ALL CHAT DRAG TESTS PASSED"
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: thieu jsdom (npm i jsdom)'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '43-teamchat.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok  ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 1600, H = 900;

async function boot(presets) {
  const dom = new JSDOM('<!doctype html><body><div id="sn-toggle"></div><div id="data-view"></div><div class="tab" data-bar-id="tab-teamchat"></div></body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
  const w = dom.window;
  w.localStorage.setItem('ome_sess_token', 'TOK');
  Object.keys(presets || {}).forEach((k) => w.localStorage.setItem(k, presets[k]));
  w.gsUrl = 'https://gas.test/exec';
  w.esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.toast = () => {}; w.switchTab = () => {}; w.innerWidth = W; w.innerHeight = H;
  // jsdom khong co layout -> gia lap kich thuoc + toa do theo style.right/bottom dang co (mac dinh CSS: right 76, bottom 38)
  const size = (el) => el.id === 'tc-mini' ? [620, 300] : el.id === 'tc-bubble' ? [48, 48] : [0, 0];
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return size(this)[0]; } });
  Object.defineProperty(w.HTMLElement.prototype, 'offsetHeight', { get() { return size(this)[1]; } });
  w.Element.prototype.getBoundingClientRect = function () {
    const r = parseFloat(this.style.right), b = parseFloat(this.style.bottom), s = size(this);
    const right = W - (isNaN(r) ? 76 : r), bottom = H - (isNaN(b) ? 38 : b);
    return { right, bottom, left: right - s[0], top: bottom - s[1], width: s[0], height: s[1] };
  };
  const me = { username: 'trang', name: 'Trang', role: 'cs' };
  const users = [{ username: 'trang', name: 'Trang', team: 'A' }, { username: 'lan', name: 'Lan', team: 'A' }];
  const channels = [{ id: 'general', name: 'Chung', type: 'general', desc: '', members: [], canManage: false }];
  const msgs = [{ id: 1, c: 'general', u: 'lan', n: 'Lan', t: 'chao', ts: Date.now() - 60000 }, { id: 2, c: 'general', u: 'lan', n: 'Lan', t: 'ban oi', ts: Date.now() - 30000 }];
  w.fetch = async (url, o) => {
    const reply = (j) => ({ json: async () => j });
    if (o && o.method === 'POST') return reply({ ok: true });
    const q = new URL(url).searchParams, a = q.get('action');
    if (a === 'chatChannels') return reply({ ok: true, me, users, channels, chver: 1 });
    if (a === 'chatHistory') return reply({ ok: true, msgs: msgs.filter((m) => m.c === q.get('channel')), more: false });
    if (a === 'chatPoll') { const since = +q.get('since') || 0; return reply({ ok: true, msgs: msgs.filter((m) => m.id > since), last: 2, chver: 1, dver: 0 }); }
    return reply({ ok: false, error: 'x' });
  };
  w.eval(code);
  await sleep(3500);
  return w;
}
const ev = (w, type, x, y) => new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
const drag = (w, el, from, to) => { el.dispatchEvent(ev(w, 'pointerdown', from[0], from[1])); el.dispatchEvent(ev(w, 'pointermove', to[0], to[1])); el.dispatchEvent(ev(w, 'pointerup', to[0], to[1])); el.dispatchEvent(ev(w, 'click', to[0], to[1])); };

(async () => {
  // ===== Lan 1: may moi, chua co vi tri luu, chua doc het =====
  let w = await boot({ 'ome_chat_lr_trang': JSON.stringify({ general: 0 }) });   // lastRead=0 -> 2 tin cua Lan la chua doc
  const $ = (id) => w.document.getElementById(id);
  const dock = $('tc-mini'), bub = () => $('tc-bubble');
  ok(dock && !dock.classList.contains('off'), 'dock hien sau khi dang nhap');
  ok(dock.style.right === '' && dock.style.bottom === '', 'chua keo -> khong co vi tri inline (dung mac dinh CSS, giu hanh vi nhuong Tro ly AI)');
  ok(dock.querySelector('[data-act="hide"]'), 'co nut "–" thu nho han tren thanh tieu de');
  ok($('tcm-lbadge').textContent === '2', 'huy hieu danh sach hien 2 chua doc');

  // --- keo that: sang trai 100, len tren 100 ---
  const lh = dock.querySelector('.tcm-lh');
  drag(w, lh, [1200, 800], [1100, 700]);
  ok(dock.style.right === '176px' && dock.style.bottom === '138px', 'keo (-100,-100) -> right 176 / bottom 138, thuc te ' + dock.style.right + '/' + dock.style.bottom);
  ok(!$('tcm-list').classList.contains('open'), 'sau khi keo, click ngay sau do KHONG toggle danh sach (khong bam nham)');
  const saved = JSON.parse(w.localStorage.getItem('ome_chat_pos_trang'));
  ok(saved.d && saved.d.r === 176 && saved.d.b === 138, 'vi tri duoc luu theo tai khoan: ' + JSON.stringify(saved));
  // click binh thuong sau do van hoat dong
  await sleep(150);
  lh.click(); ok($('tcm-list').classList.contains('open'), 'click thuong (khong keo) van mo danh sach');
  lh.click();

  // --- keo < 5px = click ---
  lh.dispatchEvent(ev(w, 'pointerdown', 1000, 800)); lh.dispatchEvent(ev(w, 'pointermove', 1002, 801)); lh.dispatchEvent(ev(w, 'pointerup', 1002, 801));
  ok(dock.style.right === '176px', 'di chuyen < 5px khong bi coi la keo');

  // --- bam nut tren thanh tieu de thi KHONG keo ---
  const btn = dock.querySelector('[data-act="newdm"]');
  btn.dispatchEvent(ev(w, 'pointerdown', 1500, 800)); btn.dispatchEvent(ev(w, 'pointermove', 1300, 600)); btn.dispatchEvent(ev(w, 'pointerup', 1300, 600));
  ok(dock.style.right === '176px', 'bam nut tren tieu de khong gay keo dock');

  // --- chan khong cho keo ra ngoai man hinh ---
  drag(w, lh, [1200, 800], [-5000, -5000]);
  ok(dock.style.right === (W - 280) + 'px' && dock.style.bottom === (H - 300) + 'px', 'keo qua xa -> bi chan trong man hinh (thanh tieu de danh sach luon con): ' + dock.style.right + '/' + dock.style.bottom);
  await sleep(150);
  drag(w, lh, [100, 100], [5000, 5000]);
  ok(dock.style.right === '0px' && dock.style.bottom === '0px', 'keo qua goc duoi phai -> chan o 0/0');
  await sleep(150);
  drag(w, lh, [1200, 800], [1100, 700]);   // dat lai 1 vi tri dep de test tiep
  await sleep(150);

  // --- thu nho han thanh bong bong ---
  dock.querySelector('[data-act="hide"]').click();
  ok(dock.classList.contains('off') && bub() && !bub().classList.contains('off'), 'bam "–" -> dock an, bong bong 💬 hien');
  ok($('tcb-badge').textContent === '2' && $('tcb-badge').style.display !== 'none' && bub().classList.contains('has'), 'bong bong hien huy hieu 2 chua doc + nhap nhay');
  ok(JSON.parse(w.localStorage.getItem('ome_chat_mini_trang')).h === 1, 'trang thai thu nho duoc luu (h=1)');
  ok(bub().style.right === '' && bub().style.bottom === '', 'bong bong chua keo -> o vi tri mac dinh, doc lap voi vi tri dock');

  // --- keo bong bong, khong bi mo lai nham ---
  drag(w, bub(), [1500, 850], [1400, 750]);
  ok(bub().style.right === '176px' && bub().style.bottom === '138px' && !bub().classList.contains('off'), 'keo bong bong -> doi vi tri, van la bong bong (khong mo lai nham)');
  ok(JSON.parse(w.localStorage.getItem('ome_chat_pos_trang')).b.r === 176, 'vi tri bong bong duoc luu rieng (khoa b)');
  await sleep(150);
  bub().click();
  ok(!dock.classList.contains('off') && bub().classList.contains('off'), 'bam bong bong -> mo lai dock, bong bong an');
  ok(JSON.parse(w.localStorage.getItem('ome_chat_mini_trang')).h === 0, 'mo lai -> luu h=0');
  w.close();

  // ===== Lan 2: "tai lai trang" voi vi tri + trang thai thu nho da luu =====
  w = await boot({ 'ome_chat_pos_trang': JSON.stringify({ d: { r: 300, b: 200 }, b: { r: 50, b: 60 } }), 'ome_chat_mini_trang': JSON.stringify({ l: 0, h: 1, w: [] }), 'ome_chat_lr_trang': JSON.stringify({ general: 2 }) });
  const d2 = w.document.getElementById('tc-mini'), b2 = w.document.getElementById('tc-bubble');
  ok(d2.classList.contains('off') && !b2.classList.contains('off'), 'tai lai trang: van o trang thai thu nho (chi con bong bong)');
  ok(b2.style.right === '50px' && b2.style.bottom === '60px' && d2.style.right === '300px' && d2.style.bottom === '200px', 'tai lai trang: khoi phuc dung vi tri dock + bong bong');
  ok(w.document.getElementById('tcb-badge').style.display === 'none' && !b2.classList.contains('has'), 'da doc het -> bong bong khong co huy hieu');
  w.close();

  // ===== Lan 3: du lieu vi tri hong / man hinh nho lai =====
  w = await boot({ 'ome_chat_pos_trang': '{"d":{"r":99999,"b":-50}}' });
  const d3 = w.document.getElementById('tc-mini');
  ok(d3.style.right === (W - 280) + 'px' && d3.style.bottom === '0px', 'vi tri luu nam ngoai man hinh -> tu keo vao vung nhin thay: ' + d3.style.right + '/' + d3.style.bottom);
  w.localStorage.setItem('ome_chat_pos_trang', 'khong-phai-json'); w.close();
  w = await boot({ 'ome_chat_pos_trang': 'khong-phai-json' });
  ok(w.document.getElementById('tc-mini') && !w.document.getElementById('tc-mini').classList.contains('off'), 'du lieu vi tri hong khong lam sap dock');
  w.close();
  console.log('\nALL CHAT DRAG TESTS PASSED'); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
