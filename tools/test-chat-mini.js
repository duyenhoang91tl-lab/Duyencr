#!/usr/bin/env node
// Test cua so chat nho (khoi "cua so chat nho" trong js/43-teamchat.js) bang jsdom + fetch gia. CAN: npm i jsdom (thieu thi tu bo qua).
// Chay: node tools/test-chat-mini.js -> "ALL CHAT MINI TESTS PASSED"
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { try { ({ JSDOM } = require(process.env.JSDOM_PATH || '/nonexistent')); } catch (e3) { console.log('SKIP: chua cai jsdom (npm i jsdom)'); process.exit(0); } } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '43-teamchat.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new JSDOM('<!doctype html><body><div id="sn-toggle"></div><div id="data-view"></div><div class="tab" data-bar-id="tab-teamchat"></div></body>', { runScripts: 'outside-only', url: 'https://crm.test/', pretendToBeVisual: true });
  const w = dom.window, posts = [], toasts = [], switched = [];
  w.localStorage.setItem('ome_sess_token', 'TOK');
  w.gsUrl = 'https://gas.test/exec';
  w.esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.toast = m => toasts.push(m);
  w.switchTab = (t) => switched.push(t);
  w.innerWidth = 1600;
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
      if (b.action === 'chatSend') { const m = { id: nextId++, c: b.channel, u: 'trang', n: 'Trang', t: b.text, ts: Date.now() }; msgs.push(m); return reply({ ok: true, msg: m, last: m.id }); }
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

  // thu 6: thu gon + tin moi -> huy hieu tren tieu de cua so
  const hdr = win.querySelector('.tcm-wh'); hdr.click();
  ok(win.classList.contains('min'), 'bam tieu de -> thu gon');
  msgs.push({ id: nextId++, c: 'general', u: 'lan', n: 'Lan', t: 'tin moi khi dang thu gon', ts: Date.now() });
  await sleep(13000);   // poll 12s khi o tab khac
  const nb = win.querySelector('.tcm-wh .tcm-nb');
  ok(nb.style.display !== 'none' && nb.textContent === '1', 'cua so thu gon hien 1 tin chua doc, thuc te: ' + nb.textContent + '/' + nb.style.display);
  hdr.click();
  ok(!win.classList.contains('min'), 'bam lai -> mo');
  await sleep(50);
  ok(win.querySelector('.tcm-wh .tcm-nb').style.display === 'none', 'mo cua so -> da doc, het huy hieu');

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
