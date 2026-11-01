#!/usr/bin/env node
// Test (jsdom) CRM — Kho mau luu san (js/20-loadaiexamples.js): Copy ca cau / Tung doan, chip nhom (form nhom SP + tu phan loai do phien khac lam: xem HANDOFF) (Duyen 21/10/2026).
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '20-loadaiexamples.js'), 'utf8');
const html = `<!doctype html><body>
<select id="mt-status-filter"><option value="">all</option><option value="pending">p</option><option value="approved">a</option><option value="rejected">r</option><option value="mine">m</option></select>
<input id="mt-search" value=""><div id="mt-list"></div><div id="mt-pending-badge"></div>
<div id="mt-form-wrap" style="display:none"><input type="hidden" id="mt-f-id"><div id="mt-form-hint"></div>
<input id="mt-f-nhom" list="mt-nhom-dl" oninput="mtFormLists()"><datalist id="mt-nhom-dl"></datalist><input id="mt-f-product" list="mt-prod-dl" oninput="mtFormDetect()" onchange="mtFormDetect()"><datalist id="mt-prod-dl"></datalist><div id="mt-f-autohint"></div>
<input id="mt-f-title"><input id="mt-f-topic"><input id="mt-f-tags"><textarea id="mt-f-content"></textarea><button id="mt-f-save-btn">Lưu mẫu</button></div></body>`;
const ITEMS = [{ n: 'Nhẫn', t: 'Nhẫn Vàng 9999', m: '' }, { n: 'Lắc', t: 'Lắc Tay Vàng', m: '' }, { n: 'Charm', t: 'Lắc Tay Vàng', m: '' }];
const TPLS = [
  { id: 'a1', title: 'Chao', content: 'Em chào chị Lan ạ\nChị có khỏe không?\n\n  Em tư vấn nhé  ', product: 'Nhẫn', nhom: 'Nhẫn', status: 'approved', createdBy: 'Admin', tags: '', topic: '' },
  { id: 'a2', title: 'Mot dong', content: 'Chi 1 dong', product: 'Lắc', status: 'approved', createdBy: 'Admin', tags: '', topic: '' },
  { id: 'p1', title: 'Cho duyet cua Lan', content: 'A\nB', product: 'Charm', status: 'pending', createdBy: 'Lan', tags: '', topic: '' }
];
(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://crm.test/' }), w = dom.window;
  const clip = [], posts = [], toasts = [];
  w.navigator.clipboard = { writeText: async t => { clip.push(t); } };
  w.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  w.gsUrl = 'https://gas.test/exec'; w.currentUser = { name: 'Hoa' }; w.toast = t => toasts.push(t); w.alert = t => { w.__alert = t; }; w.loadMsgTemplates = () => {};
  w.fetch = async (url, o) => { if (o && o.method === 'POST') { posts.push(JSON.parse(o.body)); return { json: async () => ({ ok: true, status: 'pending' }) }; }
    if (String(url).includes('productImageFlat')) return { json: async () => ({ ok: true, items: ITEMS }) }; return { json: async () => ({ templates: [] }) }; };
  w._foldVi = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  w.switchTab = function () {}; w.eval(src);
  w.eval('_msgTemplates = ' + JSON.stringify(TPLS) + ';');
  w.renderMsgTemplateList();
  const list = w.document.getElementById('mt-list');
  const cards = [...list.children];
  ok(cards.length === 3, 'hien du 3 mau (da duyet + cho duyet cua nguoi khac)');
  const c1 = cards.find(c => c.textContent.includes('Chao'));
  ok(c1.textContent.includes('Copy cả câu') && c1.textContent.includes('Từng đoạn (3)'), 'mau 3 dong: Copy ca cau + Tung doan (3)');
  ok(c1.textContent.includes('🗂 Nhẫn'), 'chip nhom san pham');
  ok(!cards.find(c => c.textContent.includes('Mot dong')).textContent.includes('Từng đoạn'), 'mau 1 dong: khong co Tung doan');
  ok(cards.find(c => c.textContent.includes('Cho duyet cua Lan')).textContent.includes('Chờ duyệt'), 'mau cho duyet cua nguoi khac hien huy hieu Cho duyet');
  const box = c1.querySelector('.mt-lines'); ok(box && box.style.display === 'none' && box.querySelectorAll('button').length === 3, '3 dong, mac dinh thu gon');
  [...c1.querySelectorAll('button')].find(b => b.textContent.includes('Từng đoạn')).click();
  ok(box.style.display !== 'none', 'bam Tung doan mo danh sach');
  [...c1.querySelectorAll('button')].find(b => b.textContent.includes('Copy cả câu')).click(); await sleep(5);
  ok(clip[0] === TPLS[0].content, 'Copy ca cau = nguyen van (giu xuong dong)');
  box.querySelectorAll('button')[1].click(); await sleep(5);
  ok(clip[1] === 'Chị có khỏe không?', 'Copy doan 2 = "Chi co khoe khong?"');
  box.querySelectorAll('button')[2].click(); await sleep(5);
  ok(clip[2] === 'Em tư vấn nhé', 'doan co khoang trang thua duoc cat');
  // tim kiem theo nhom
  w.document.getElementById('mt-search').value = 'nhan'; w.renderMsgTemplateList();
  ok(w.document.getElementById('mt-list').children.length >= 1 && w.document.getElementById('mt-list').textContent.includes('Chao'), 'tim theo nhom/san pham ra mau Nhan');
  w.document.getElementById('mt-search').value = '';
  console.log('ALL CRM TPL LINES TESTS PASSED');
})().catch(e => { console.error('FAIL (ngoai le):', e && e.message, e && e.name, e && e.stack ? String(e.stack).split('\n').slice(0,4).join(' | ') : ''); process.exit(1); });
