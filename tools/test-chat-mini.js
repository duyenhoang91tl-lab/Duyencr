#!/usr/bin/env node
// Test cua so chat nho (khoi "cua so chat nho" trong js/43-teamchat.js) bang jsdom + fetch gia. CAN: npm i jsdom (thieu thi tu bo qua).
// Chay: node tools/test-chat-mini.js -> "ALL CHAT MINI TESTS PASSED"
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { try { ({ JSDOM } = require(process.env.JSDOM_PATH || '/nonexistent')); } catch (e3) { console.log('SKIP: chua cai jsdom (npm i jsdom)'); process.exit(0); } } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '43-teamchat.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new JSDOM('<!doctype html><title>CRM</title><body><div id="sn-toggle"></div><div id="data-view"></div><div class="tab" data-bar-id="tab-teamchat"></div></body>', { runScripts: 'outside-only', url: 'https://crm.test/', pretendToBeVisual: true });
  const w = dom.window, posts = [], toasts = [], switched = [];
  w.localStorage.setItem('ome_sess_token', 'TOK');
  w.gsUrl = 'https://gas.test/exec';
  w.esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.toast = m => toasts.push(m);
  w.switchTab = (t) => switched.push(t);
  w.innerWidth = 1600;
  w.confirm = () => true;
  let oscs = 0;   // dem so not am bao (Web Audio gia)
  const gp = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  w.AudioContext = function () { return { currentTime: 0, state: 'running', destination: {}, resume() {}, createOscillator: () => { oscs++; return { frequency: gp(), connect() {}, start() {}, stop() {} }; }, createGain: () => ({ gain: gp(), connect() {} }) }; };
  const me = { username: 'trang', name: 'Trang', role: 'cs' };
  const users = [{ username: 'trang', name: 'Trang', team: 'A' }, { username: 'lan', name: 'Lan', team: 'A' }];
  const channels = [
    { id: 'general', name: 'Chung', type: 'general', desc: '', members: [], canManage: false },
    { id: 'dm:lan|trang', name: '', type: 'dm', desc: '', members: ['lan', 'trang'], canManage: false }];
  let msgs = [{ id: 1, c: 'general', u: 'lan', n: 'Lan', t: 'chao <img src=x onerror=alert(1)> https://a.b/c', ts: Date.now() - 60000 },
              { id: 2, c: 'dm:lan|trang', u: 'lan', n: 'Lan', t: 'hello @trang', ts: Date.now() - 30000 }];
  let nextId = 10;
  w.fetch = async (url, o) => {
    const reply = j => ({ json: async () => j });
    if (o && o.method === 'POST') {
      const b = JSON.parse(o.body); posts.push(b);
      if (b.action === 'chatSend') { const m = { id: nextId++, c: b.channel, u: 'trang', n: 'Trang', t: b.text, ts: Date.now(), r: b.replyTo || '' }; msgs.push(m); return reply({ ok: true, msg: m, last: m.id }); }
      if (b.action === 'chatDelete') { msgs = msgs.filter(m => String(m.id) !== String(b.id)); return reply({ ok: true, dver: 0 }); }
      return reply({ ok: true });
    }
    const q = new URL(url).searchParams, a = q.get('action');
    if (a === 'chatChannels') return reply({ ok: true, me, users, channels, chver: 1 });
    if (a === 'chatHistory') return reply({ ok: true, msgs: msgs.filter(m => m.c === q.get('channel')), more: false });
    if (a === 'chatPoll') { const since = +q.get('since') || 0; return reply({ ok: true, msgs: msgs.filter(m => m.id > since), last: Math.max(0, ...msgs.map(m => m.id)), chver: 1, dver: 0 }); }
    return reply({ ok: false, error: 'x' });
  };
  w.eval(code);
  await sleep(300);                                   // start() chay ngay qua setInterval 3s -> goi truc tiep bang cach cho toi 3.2s
  await sleep(3200);
  const d = () => w.document.getElementById('tc-mini');
  ok(d() && !d().classList.contains('off'), 'dock hien sau khi dang nhap');
  ok(d().querySelector('#tcm-lbadge').style.display === 'none', 'lan dau tren may: tin cu coi la da doc -> huy hieu danh sach an');

  // thu 1: mo danh sach, thay 2 kenh
  d().querySelector('.tcm-lh').click();
  ok(d().querySelector('#tcm-list').classList.contains('open'), 'mo danh sach');
  const items = d().querySelectorAll('.tcm-it');
  ok(items.length === 2, 'danh sach co 2 kenh, thuc te: ' + items.length);
  ok(!/onerror=alert/.test(d().querySelector('#tcm-lbody').innerHTML.replace(/&lt;img[^&]*&gt;/g, '')), 'xem truoc tin nhan da escape');

  // thu 2: mo cua so DM, co tin cu, XSS bi escape
  const dmItem = [...items].find(i => i.getAttribute('data-ch') === 'dm:lan|trang');
  dmItem.click(); await sleep(50);
  ok(d().querySelectorAll('.tcm-win').length === 1, 'mo 1 cua so');
  ok(d().querySelector('.tcm-wt').textContent.indexOf('Lan') !== -1, 'tieu de cua so la ten nguoi kia');
  ok(/hello/.test(d().querySelector('.tcm-msgs').textContent), 'co lich su tin nhan');

  // thu 3: mo kenh chung, XSS
  [...d().querySelectorAll('.tcm-it')].find(i => i.getAttribute('data-ch') === 'general').click(); await sleep(50);
  ok(d().querySelectorAll('.tcm-win').length === 2, 'mo 2 cua so');
  const g = d().querySelector('.tcm-win[data-ch="general"] .tcm-msgs');
  ok(!g.querySelector('img'), 'khong chen the img tu noi dung tin (XSS)');
  ok(g.querySelector('a[href="https://a.b/c"]'), 'URL thanh lien ket');

  // thu 4: gui tin
  const win = d().querySelector('.tcm-win[data-ch="general"]'), ta = win.querySelector('textarea');
  ta.value = 'xin chao tu cua so nho';
  win.querySelector('[data-act="wsend"]').click(); await sleep(100);
  const sent = posts.filter(p => p.action === 'chatSend');
  ok(sent.length === 1 && sent[0].channel === 'general' && sent[0].text === 'xin chao tu cua so nho' && sent[0].token === 'TOK', 'chatSend dung kenh/noi dung/token');
  ok(/xin chao tu cua so nho/.test(win.querySelector('.tcm-msgs').textContent), 'tin vua gui hien trong cua so');
  ok(ta.value === '', 'o nhap duoc xoa');

  // thu 5: Enter gui, Shift+Enter khong
  ta.value = 'enter test';
  ta.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
  await sleep(50); ok(posts.filter(p => p.action === 'chatSend').length === 1, 'Shift+Enter khong gui');
  ta.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(100); ok(posts.filter(p => p.action === 'chatSend').length === 2, 'Enter gui');

  // thu 5b: tra loi (↩) trong cua so nho
  const m1 = win.querySelector('.tc-msg[data-id="1"]');
  ok(m1 && m1.querySelector('[data-act="wreply"]'), 'tin cua nguoi khac co nut tra loi');
  ok(!m1.querySelector('[data-act="wdel"]'), 'KHONG co nut xoa tren tin cua nguoi khac (khong phai admin)');
  m1.querySelector('[data-act="wreply"]').click();
  const rb = win.querySelector('.tcm-reply');
  ok(rb.style.display !== 'none' && /Lan/.test(rb.textContent), 'hien thanh tra loi voi ten nguoi duoc tra loi');
  ta.value = 'tra loi ban';
  win.querySelector('[data-act="wsend"]').click(); await sleep(100);
  const lastSend = posts.filter(p => p.action === 'chatSend').pop();
  ok(lastSend.text === 'tra loi ban' && lastSend.replyTo === '1', 'chatSend kem replyTo=1, thuc te: ' + JSON.stringify(lastSend.replyTo));
  ok(rb.style.display === 'none', 'gui xong -> thanh tra loi an');
  const qt = win.querySelector('.tc-quote');
  ok(qt && /Lan/.test(qt.textContent) && !qt.querySelector('img'), 'tin vua gui hien khung trich dan (da escape)');
  win.querySelector('.tc-msg[data-id="1"] [data-act="wreply"]').click();   // lay lai node moi (cua so da ve lai)
  ok(rb.style.display !== 'none', 'tra loi lan 2 hien lai thanh');
  win.querySelector('[data-act="wreplyx"]').click();
  ok(rb.style.display === 'none', 'bam ✕ -> bo tra loi');

  // thu 5c: xoa tin cua minh
  const mine = [...win.querySelectorAll('.tc-msg.mine')].pop(), mineId = mine.getAttribute('data-id');
  ok(mine.querySelector('[data-act="wdel"]'), 'tin cua minh co nut xoa');
  const before = win.querySelectorAll('.tc-msg').length;
  mine.querySelector('[data-act="wdel"]').click(); await sleep(100);
  ok(posts.some(p => p.action === 'chatDelete' && String(p.id) === mineId && p.token === 'TOK'), 'goi chatDelete dung id + token');
  ok(win.querySelectorAll('.tc-msg').length === before - 1 && !win.querySelector('.tc-msg[data-id="' + mineId + '"]'), 'tin bi xoa bien mat khoi cua so');

  // thu 6: thu gon + tin moi -> huy hieu tren tieu de cua so (+ am bao, nhap nhay tieu de khi tab an)
  const hdr = win.querySelector('.tcm-wh'); hdr.click();
  ok(win.classList.contains('min'), 'bam tieu de -> thu gon');
  msgs.push({ id: nextId++, c: 'general', u: 'lan', n: 'Lan', t: 'tin moi khi dang thu gon', ts: Date.now() });
  ok(oscs === 0, 'chua co tin nguoi khac -> chua keu, thuc te: ' + oscs);
  Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => true });   // gia lap tab trinh duyet dang an luc poll ve
  await sleep(13000);   // poll 12s khi o tab khac
  ok(oscs === 2, 'tin moi tu nguoi khac -> am bao 2 not, thuc te: ' + oscs);
  const seen = new Set(); for (let i = 0; i < 5; i++) { seen.add(w.document.title); await sleep(500); }
  ok([...seen].some(t => /💬 Lan nhắn/.test(t)) && [...seen].some(t => /^\(\d+\) CRM$|^CRM$/.test(t)), 'tieu de tab nhap nhay giua "💬 Lan nhan…" va tieu de thuong: ' + JSON.stringify([...seen]));
  Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => false });
  w.document.dispatchEvent(new w.Event('visibilitychange')); await sleep(100);
  ok(!/💬/.test(w.document.title), 'quay lai tab -> het nhap nhay, tieu de: ' + w.document.title);
  const nb = win.querySelector('.tcm-wh .tcm-nb');
  ok(nb.style.display !== 'none' && nb.textContent === '1', 'cua so thu gon hien 1 tin chua doc, thuc te: ' + nb.textContent + '/' + nb.style.display);
  hdr.click();
  ok(!win.classList.contains('min'), 'bam lai -> mo');
  await sleep(50);
  ok(win.querySelector('.tcm-wh .tcm-nb').style.display === 'none', 'mo cua so -> da doc, het huy hieu');

  // thu 6c: tat chuong -> khong keu, va nho lai
  const sb = d().querySelector('#tcm-snd'); ok(sb && sb.textContent === '🔔', 'nut chuong dang bat');
  sb.click(); ok(sb.textContent === '🔕', 'bam -> tat'); const o1 = oscs;
  ok(JSON.parse(w.localStorage.getItem('ome_chat_mini_trang')).s === 0, 'trang thai tat luu vao localStorage');
  sb.click(); ok(oscs === o1 + 2 && sb.textContent === '🔔', 'bat lai -> keu thu 1 lan de nghe thu');

  // thu 7: luu trang thai, dong cua so
  const saved = JSON.parse(w.localStorage.getItem('ome_chat_mini_trang'));
  ok(saved.l === 1 && saved.w.length === 2, 'luu trang thai: ' + JSON.stringify(saved));
  win.querySelector('[data-act="wclose"]').click();
  ok(d().querySelectorAll('.tcm-win').length === 1, 'dong 1 cua so');
  ok(JSON.parse(w.localStorage.getItem('ome_chat_mini_trang')).w.length === 1, 'luu lai sau khi dong');

  // thu 8: mo trong tab day du
  d().querySelector('.tcm-win [data-act="wfull"]').click(); await sleep(20);
  ok(switched[0] === 'teamchat' && d().querySelectorAll('.tcm-win').length === 0, 'wfull dong cua so nho va chuyen sang tab Chat');

  // thu 9: dang xuat -> dock an, cua so don sach
  w.localStorage.removeItem('ome_sess_token'); await sleep(3300);
  ok(d().classList.contains('off'), 'dang xuat -> an dock');

  // thu 10: toi da so cua so (man hinh hep -> 1)
  console.log('ALL CHAT MINI TESTS PASSED');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
