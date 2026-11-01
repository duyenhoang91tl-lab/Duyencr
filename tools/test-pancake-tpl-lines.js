#!/usr/bin/env node
// Test (jsdom) Pancake AI: moi mau co "Copy ca cau" + "Chen ca cau" + danh sach TUNG DOAN (moi dong = 1 tin), va huy hieu CHUA DUYET cua nguoi khac (Duyen 21/10/2026).
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function fnSrc(src, name) { const i = src.indexOf('function ' + name); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(i, m + 1); } } }
const help = ['_stripVNlocal_', 'isMyOpenTpl_', 'tplLines_', 'rankMsgTemplates_', 'renderMsgTemplateRows_'].map(n => fnSrc(psrc, n)).join('\n');
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TPLS = [
  { id: 'a1', title: 'Chao khach', content: 'Em chào chị Lan ạ\nChị có khỏe không?\n\n  Em tư vấn chị nhẫn nhé  ', product: 'Nhẫn', status: 'approved', createdBy: 'Admin' },
  { id: 'a2', title: 'Mau 1 dong', content: 'Chi 1 dong', product: 'Lắc', status: 'approved', createdBy: 'Admin' },
  { id: 'p1', title: 'Cua Lan cho duyet', content: 'Dòng A\nDòng B', product: 'Charm', status: 'pending', createdBy: 'Lan' },
  { id: 'p2', title: 'Cua Hoa cho duyet', content: 'Hoa 1\nHoa 2', product: 'Vòng', status: 'pending', createdBy: 'Hoa' }
];
(async () => {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><input id="pk-tpl-q"><div id="pk-tpl-form"></div><div id="pk-tpl-result"></div></div></body>', { runScripts: 'outside-only' }), w = dom.window;
  const clip = [], inserted = []; let status = '';
  w.navigator.clipboard = { writeText: async t => { clip.push(t); } };
  const f = new w.Function('panelEl', 'settings', 'safeSendMessage_', 'escapeHtml', 'insertReply', 'setStatus', 'navigator', 'confirm',
    'let _msgTemplates = [], _msgTplTs = 0;\n' + help + '\nreturn { set: (l) => { _msgTemplates = l; }, render: renderMsgTemplateRows_, lines: tplLines_ };');
  const S = f(w.document.getElementById('panel'), { csName: 'Hoa' }, () => {}, esc, t => inserted.push(t), t => { status = t; }, w.navigator, () => true);
  S.set(TPLS); S.render();
  const box = w.document.getElementById('pk-tpl-result');
  const card = id => box.querySelector('[data-tid="' + id + '"]');
  // tach doan
  ok(JSON.stringify(S.lines('Em chào chị lan ạ\nChị có khỏe không?')) === JSON.stringify(['Em chào chị lan ạ', 'Chị có khỏe không?']), 'vi du cua Duyen: 2 dong = 2 doan');
  ok(S.lines('a\r\n\r\n  b  \n').join('|') === 'a|b', 'bo dong trong, cat khoang trang, chiu CRLF');
  ok(S.lines('').length === 0 && S.lines(null).length === 0, 'rong/null -> 0 doan');
  // nut tren the
  const c1 = card('a1');
  ok(c1.querySelector('[data-cid]').textContent.includes('Copy cả câu') && c1.querySelector('[data-iid]').textContent.includes('Chèn cả câu'), 'co nut Copy ca cau + Chen ca cau');
  ok(c1.querySelector('[data-ltog]') && c1.querySelector('[data-ltog]').textContent.includes('(3)'), 'mau 3 dong co nut "Tung doan (3)"');
  ok(!card('a2').querySelector('[data-ltog]') && !card('a2').querySelector('.pk-tpl-lines'), 'mau 1 dong: khong co danh sach tung doan');
  ok(c1.querySelectorAll('.pk-tpl-line').length === 3 && c1.querySelector('.pk-tpl-lines').style.display === 'none', '3 dong, mac dinh thu gon');
  c1.querySelector('[data-ltog]').click();
  ok(c1.querySelector('.pk-tpl-lines').style.display !== 'none', 'bam "Tung doan" mo danh sach');
  // copy ca cau giu nguyen xuong dong
  c1.querySelector('[data-cid]').click(); await sleep(5);
  ok(clip[0] === TPLS[0].content, 'Copy ca cau = nguyen van ca doan (giu xuong dong)');
  // chen ca cau
  c1.querySelector('[data-iid]').click();
  ok(inserted[0] === TPLS[0].content, 'Chen ca cau vao o chat');
  // tung doan
  const lines = [...c1.querySelectorAll('.pk-tpl-line')];
  lines[1].querySelector('[data-lc]').click(); await sleep(5);
  ok(clip[1] === 'Chị có khỏe không?', 'Copy doan 2 = dung 1 tin "Chị có khỏe không?"');
  lines[0].querySelector('[data-li]').click();
  ok(inserted[1] === 'Em chào chị Lan ạ', 'Chen doan 1 vao o chat');
  lines[2].querySelector('[data-li]').click();
  ok(inserted[2] === 'Em tư vấn chị nhẫn nhé', 'doan co khoang trang thua duoc cat sach');
  ok(inserted.length === 3 && clip.length === 2, 'bam nut KHONG kich hoat chen ca mau (khong lan len the)');
  // bam vao vung tung doan khong chen ca mau
  c1.querySelector('.pk-tpl-line-txt').click();
  ok(inserted.length === 3, 'bam vao chu cua tung doan khong chen ca mau');
  // huy hieu chua duyet
  ok(card('p1').textContent.includes('Chưa duyệt') && card('p1').textContent.includes('Lan'), 'mau cho duyet cua NGUOI KHAC co huy hieu "Chua duyet" + ten nguoi de xuat');
  ok(card('p2').textContent.includes('Chờ quản lý duyệt') && !card('p2').textContent.includes('Chưa duyệt —'), 'mau cua CHINH MINH (Hoa) van hien nhan cua chu mau + co Sua/Xoa');
  ok(card('p2').querySelector('[data-eid]') && !card('p1').querySelector('[data-eid]'), 'chi sua/xoa duoc mau cua minh');
  ok(!card('a1').textContent.includes('Chưa duyệt'), 'mau da duyet khong co huy hieu');
  // XSS
  S.set([{ id: 'x', title: '<img src=x onerror=1>', content: '<b>a</b>\n<i>b</i>', status: 'approved', createdBy: 'x' }]); S.render();
  ok(!box.querySelector('img') && !box.querySelector('b') && !box.querySelector('i'), 'noi dung/tieu de duoc escape, khong chen HTML');
  console.log('ALL PANCAKE TPL LINES TESTS PASSED');
})().catch(e => { console.error('FAIL (ngoai le):', e); process.exit(1); });
