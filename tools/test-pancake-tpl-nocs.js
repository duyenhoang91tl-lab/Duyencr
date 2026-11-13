#!/usr/bin/env node
// Test (jsdom) Pancake AI — bam "Tao mau luu san" khi CHUA chon CS (Duyen 13/11/2026: "tao mau tin nhan khong duoc").
// Nguyen nhan goc: thong bao chi vao #pk-ai-status (cuoi panel) nen CS khong thay gi. Nay: hien ngay trong #pk-tpl-form + keo toi o CS + to sang; chon CS roi bam lai mo form binh thuong.
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function fnSrc(src, name) { const i = src.indexOf('function ' + name); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}' && --d === 0) return src.slice(i, m + 1); } }
const a = psrc.indexOf('const _fold_ ='), b = psrc.indexOf('};', psrc.indexOf('const _itemNames_ =')) + 2;
const help = ['_stripVNlocal_', 'ensureTplCatalog_', 'openTplForm_'].map(n => fnSrc(psrc, n)).join('\n');
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dom = new JSDOM('<!doctype html><body><div id="panel"><input id="pk-cs-search"><div id="pk-tpl-form"></div></div></body>', { runScripts: 'outside-only' }), w = dom.window;
const env = { status: '', scrolled: 0, focused: 0 };
const cs = w.document.getElementById('pk-cs-search'); cs.scrollIntoView = () => { env.scrolled++; }; const f0 = cs.focus.bind(cs); cs.focus = () => { env.focused++; f0(); };
const settings = { csName: '' };
const safe = (msg, cb) => { setTimeout(() => cb({ ok: true, data: { items: [] } }), 0); };
const fn = new w.Function('panelEl', 'settings', 'safeSendMessage_', 'escapeHtml', 'setStatus', 'PK_API_ERR', 'loadMsgTemplates_',
  'let _imgFlatItems = null, _imgFlatLoading = false;\n' + psrc.slice(a, b) + '\n' + help + '\nreturn { open: openTplForm_ };');
const S = fn(w.document.getElementById('panel'), settings, safe, esc, t => { env.status = t; }, 'LOI API', () => {});
const host = w.document.getElementById('pk-tpl-form');
(async () => {
  S.open(null);
  ok(/Chưa chọn CS/.test(host.textContent) && /CS đang dùng/.test(host.textContent), 'chua chon CS: thong bao hien NGAY trong khung mau (khong chi o dong trang thai cuoi panel)');
  ok(!host.querySelector('#pk-tpl-f-save'), 'chua chon CS: chua mo form nhap mau');
  ok(/Chọn tên CS/.test(env.status), 'van ghi dong trang thai nhu cu');
  ok(env.scrolled === 1 && env.focused === 1 && /f59e0b/i.test(cs.style.outline.replace(/\s/g, '')) || /245, ?158, ?11/.test(cs.style.outline), 'tu keo toi + focus + to sang o CS: scroll=' + env.scrolled + ' focus=' + env.focused + ' outline=' + cs.style.outline);
  host.querySelector('#pk-tpl-goto-cs').click();
  ok(env.scrolled === 2 && env.focused === 2, 'nut "Chon CS ngay" keo toi o CS lan nua');
  settings.csName = 'Hoa'; S.open(null);
  ok(host.querySelector('#pk-tpl-f-save') && host.querySelector('#pk-tpl-f-content'), 'da chon CS -> bam lai mo form tao mau binh thuong');
  process.exit(fails ? 1 : 0);
})();
