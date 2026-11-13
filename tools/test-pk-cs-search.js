// Duyen 2026-11-12: Pancake AI — dropdown "CS dang dung" co o TIM KIEM (gõ không dấu, ↑/↓/Enter, bấm chọn).
// Chay doan ma THAT trich tu extension-pancake/pancake-content.js trong jsdom. Chay: node tools/test-pk-cs-search.js
// (can jsdom; khong co thi bo qua — cai: npm i jsdom o thu muc ngoai repo roi dat NODE_PATH)
const fs = require('fs');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) {
  try { ({ JSDOM } = require(process.env.JSDOM_PATH || '/tmp/jsd/node_modules/jsdom')); } catch (e2) { console.log('SKIP: khong co jsdom'); process.exit(0); }
}
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../extension-pancake/pancake-content.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../extension-pancake/pancake-content.css', 'utf8');

// ---- kiem nguon ----
ok(/<input type="text" id="pk-cs-search"/.test(src) && /<select id="pk-cs-sel" style="display:none">/.test(src), 'HTML: co o tim kiem + select an giu lam nguon du lieu');
ok(/#pk-cs-sel \{ display: none; \}/.test(css) && /#pk-cs-list \{/.test(css), 'CSS: select an, co danh sach tha xuong');
const nSet = (src.match(/csSel\.value = /g) || []).length, nSync = (src.match(/_csComboSync_\(\);/g) || []).length;
ok(nSync >= 5, 'moi cho gan csSel.value bang code deu goi _csComboSync_ (' + nSync + ' lan)');

// ---- trich ma that ----
function fn(name) { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const a = src.indexOf('const csSearch = panelEl.querySelector'), bMark = '_csComboSync_();', b = src.indexOf(bMark, a) + bMark.length;
const block = src.slice(a, b);
const dom = new JSDOM('<body><div id="pk-ai-panel"><div id="pk-ai-cs-row"><div id="pk-cs-combo"><input type="text" id="pk-cs-search"><div id="pk-cs-list"></div></div><select id="pk-cs-sel"></select></div></div></body>');
const { document, Event, KeyboardEvent } = dom.window;
dom.window.Element.prototype.scrollIntoView = function () {};   // jsdom khong co (Chrome that co)
const panelEl = document.getElementById('pk-ai-panel');
const csSel = document.getElementById('pk-cs-sel');
const names = ['Hà Nguyễn', 'Đức Anh', 'Mai', 'Linh', 'Hạnh'];
csSel.innerHTML = '<option value="">— Chọn CS —</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let changes = [];
csSel.addEventListener('change', () => changes.push(csSel.value));
new Function('panelEl', 'csSel', 'document', 'escapeHtml', 'Event', fn('_csComboSync_') + '\n' + block)(panelEl, csSel, document, escapeHtml, Event);

const S = document.getElementById('pk-cs-search'), L = document.getElementById('pk-cs-list');
const items = () => Array.from(L.querySelectorAll('.pk-cs-opt')).map(e => e.dataset.v);
const key = k => S.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const type = v => { S.value = v; S.dispatchEvent(new Event('input', { bubbles: true })); };

S.focus();
ok(L.style.display === 'block' && items().length === 5, 'focus: hien du 5 CS (khong co dong "— Chon CS —")');
type('ha');
ok(JSON.stringify(items().sort()) === JSON.stringify(['Hà Nguyễn', 'Hạnh'].sort()), 'go "ha" (khong dau): ra Hà Nguyễn + Hạnh -> ' + items().join('|'));
type('DUC');
ok(JSON.stringify(items()) === JSON.stringify(['Đức Anh']), 'go "DUC" (hoa, khong dau): ra Đức Anh (Đ->d)');
type('nguyen');
ok(JSON.stringify(items()) === JSON.stringify(['Hà Nguyễn']), 'tim theo ho/ten giua chuoi: "nguyen" -> Hà Nguyễn');
type('xyz');
ok(items().length === 0 && /Không tìm thấy/.test(L.textContent), 'khong khop: bao "Không tìm thấy CS nào"');
key('Enter');
ok(changes.length === 0, 'khong khop + Enter: khong chon nham');
type('a');
ok(L.querySelector('.pk-cs-act') && items().length >= 3, 'go "a": nhieu ket qua, dong dau sang');

// Enter chon dong dau
type('mai'); key('Enter');
ok(csSel.value === 'Mai' && changes.length === 1 && changes[0] === 'Mai', 'Enter chon "Mai": select doi + ban dung 1 su kien change');
ok(L.style.display === 'none' && S.value === 'Mai', 'chon xong: dong danh sach, o hien "Mai"');

// ArrowDown + Enter
S.focus(); type('h');
const first = items()[0], second = items()[1];
key('ArrowDown'); key('Enter');
ok(csSel.value === second && changes.length === 2, 'ArrowDown + Enter chon dong thu 2 (' + second + ')');

// Escape / blur khoi phuc
S.focus(); type('lin'); key('Escape');
ok(L.style.display === 'none' && S.value === csSel.value, 'Escape: dong, khoi phuc ten CS hien tai, khong doi CS');
ok(changes.length === 2, 'Escape khong ban change');

// bam chuot chon (mousedown tren dong)
S.focus(); type('linh');
const opt = L.querySelector('.pk-cs-opt');
opt.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
ok(csSel.value === 'Linh' && changes[changes.length - 1] === 'Linh', 'bam chuot (mousedown) chon "Linh"');

// chon lai CS dang chon -> khong ban change thua
const n = changes.length; S.focus(); type('linh'); key('Enter');
ok(changes.length === n, 'chon lai CS dang dung: khong ban change thua');

// gan bang code + sync (loadCsNames_/_applyCs_)
S.blur(); csSel.value = 'Hạnh';
new Function('panelEl', 'document', fn('_csComboSync_') + '; _csComboSync_();')(panelEl, document);
ok(S.value === 'Hạnh', '_csComboSync_: o tim kiem theo gia tri select khi gan bang code');

// CS dang khoa: handler 'change' tra ve gia tri cu -> o phai hien lai ten cu
csSel.addEventListener('change', () => { csSel.value = 'Hạnh'; new Function('panelEl', 'document', fn('_csComboSync_') + '; _csComboSync_();')(panelEl, document); });
S.focus(); type('mai'); key('Enter');
ok(csSel.value === 'Hạnh' && S.value === 'Hạnh', 'CS da khoa (handler tra ve gia tri cu): o hien lai "Hạnh"');

// ten co ky tu dac biet khong vo HTML
csSel.innerHTML = '<option value="">—</option><option value=\'A "B" &amp; C\'>x</option>';
S.focus(); type('');
ok(items()[0] === 'A "B" & C', 'ten co dau " va & van chon dung (data-v da escape)');
process.exit(bad ? 1 : 0);
