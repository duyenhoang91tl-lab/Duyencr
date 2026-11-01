#!/usr/bin/env node
// Test (jsdom) Zalo AI — moi mau co "Copy ca cau" + "Chen ca cau" + TUNG DOAN (moi dong = 1 tin) + huy hieu CHUA DUYET cua nguoi khac (song song voi Pancake AI, Duyen 21/10/2026).
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
function fnSrc(src, name) { const i = src.indexOf('function ' + name); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(i, m + 1); } } }
const help = ['zaiFold_', 'zaiRankTpls_', 'isMyOpenTplZai_', 'zaiTplLines_', 'renderMsgTemplateRowsZai_'].map(n => fnSrc(zsrc, n)).join('\n');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TPLS = [
  { id: 'a1', title: 'Chao khach', content: 'Em chào chị Lan ạ\nChị có khỏe không?\n\n  Em tư vấn chị nhẫn nhé  ', product: 'Nhẫn', nhom: 'Nhẫn', status: 'approved', createdBy: 'Admin' },
  { id: 'a2', title: 'Mau 1 dong', content: 'Chi 1 dong', product: 'Lắc', status: 'approved', createdBy: 'Admin' },
  { id: 'p1', title: 'Cua Lan cho duyet', content: 'Dòng A\nDòng B', product: 'Charm', status: 'pending', createdBy: 'Lan' },
  { id: 'p2', title: 'Cua Hoa cho duyet', content: 'Hoa 1\nHoa 2', product: 'Vòng', status: 'pending', createdBy: 'Hoa' }
];
(async () => {
  const dom = new JSDOM('<!doctype html><body><input id="zai-tpl-q"><div id="zai-tpl-status"></div><div id="zai-tpl-form"></div><div id="zai-tpl-result"></div></body>', { runScripts: 'outside-only' }), w = dom.window;
  const clip = [], filled = []; let status = '';
  w.navigator.clipboard = { writeText: async t => { clip.push(t); } };
  const f = new w.Function('escHtml', 'escAttrZai_', '_currentCS', 'fillZaloInput_', '_zaiTplStatus_', '_zaiTplFlashProxy_', 'navigator', 'confirm', 'openTplFormZai_', '_zaiTplCall_', 'loadMsgTemplatesZai_',
    'let _zaiMsgTemplates = [];\n' + help + '\nreturn { set: (l) => { _zaiMsgTemplates = l; }, render: renderMsgTemplateRowsZai_, lines: zaiTplLines_ };');
  const S = f(esc, esc, 'Hoa', (t, btn) => filled.push(t), t => { status = t; }, {}, w.navigator, () => true, () => {}, async () => ({ ok: true }), () => {});
  S.set(TPLS); S.render();
  const box = w.document.getElementById('zai-tpl-result');
  const card = id => box.querySelector('[data-tid="' + id + '"]');
  ok(JSON.stringify(S.lines('Em chào chị lan ạ\nChị có khỏe không?')) === JSON.stringify(['Em chào chị lan ạ', 'Chị có khỏe không?']), 'vi du cua Duyen: 2 dong = 2 doan');
  ok(S.lines('a\r\n\r\n  b  \n').join('|') === 'a|b' && S.lines('').length === 0 && S.lines(null).length === 0, 'bo dong trong, cat khoang trang, CRLF, rong/null');
  const c1 = card('a1');
  ok(c1.querySelector('[data-cid]').textContent.includes('Copy cả câu') && c1.querySelector('[data-iid]').textContent.includes('Chèn cả câu'), 'co nut Copy ca cau + Chen ca cau');
  ok(c1.querySelector('[data-ltog]').textContent.includes('(3)') && c1.textContent.includes('🗂 Nhẫn'), 'mau 3 dong co Tung doan (3); chip nhom');
  ok(!card('a2').querySelector('[data-ltog]') && !card('a2').querySelector('.zai-tpl-lines'), 'mau 1 dong: khong co danh sach tung doan');
  ok(c1.querySelector('.zai-tpl-lines').style.display === 'none', 'mac dinh thu gon');
  c1.querySelector('[data-ltog]').click(); ok(c1.querySelector('.zai-tpl-lines').style.display !== 'none', 'bam Tung doan mo danh sach');
  c1.querySelector('[data-cid]').click(); await sleep(5); ok(clip[0] === TPLS[0].content, 'Copy ca cau = nguyen van (giu xuong dong)');
  c1.querySelector('[data-iid]').click(); ok(filled[0] === TPLS[0].content, 'Chen ca cau vao o chat');
  const lines = [...c1.querySelectorAll('.zai-tpl-line')];
  lines[1].querySelector('[data-lc]').click(); await sleep(5); ok(clip[1] === 'Chị có khỏe không?', 'Copy doan 2 = 1 tin');
  lines[0].querySelector('[data-li]').click(); ok(filled[1] === 'Em chào chị Lan ạ', 'Chen doan 1');
  lines[2].querySelector('[data-li]').click(); ok(filled[2] === 'Em tư vấn chị nhẫn nhé', 'doan co khoang trang thua duoc cat');
  ok(filled.length === 3 && clip.length === 2, 'bam nut KHONG lan len the (khong chen ca mau)');
  c1.querySelector('.zai-tpl-line-txt').click(); ok(filled.length === 3, 'bam vao chu tung doan khong chen ca mau');
  ok(card('p1').textContent.includes('Chưa duyệt') && card('p1').textContent.includes('Lan') && !card('p1').querySelector('[data-eid]'), 'mau cho duyet cua nguoi khac: huy hieu + khong sua/xoa');
  ok(card('p2').textContent.includes('Chờ quản lý duyệt') && card('p2').querySelector('[data-eid]'), 'mau cua chinh minh: giu nhan cu + Sua/Xoa');
  S.set([{ id: 'x', title: '<img src=x onerror=1>', content: '<b>a</b>\n<i>b</i>', status: 'approved', createdBy: 'x' }]); S.render();
  ok(!box.querySelector('img') && !box.querySelector('b') && !box.querySelector('i'), 'escape HTML');
  console.log('ALL ZALO TPL LINES TESTS PASSED');
})().catch(e => { console.error('FAIL (ngoai le):', e && e.message); process.exit(1); });
