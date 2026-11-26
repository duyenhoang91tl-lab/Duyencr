// Test: bấm "📝 Ghi chú" / ô ghi chú phải MỞ mục "Thông tin chăm sóc" (ô #cs-note-new nằm trong mục gập).
// Chạy: NODE_PATH=<thư mục chứa jsdom> node tools/test-dp-note-open.js
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/03-fn-refreshopendptab.js'), 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); const s = j; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
const dom = new JSDOM('<div id="dp-body"><div class="dp-section dp-acc" data-acc="care"><div class="dp-acc-h"></div><textarea id="cs-note-new"></textarea></div><div class="dp-section dp-acc open" data-acc="sched"><div class="dp-acc-h"></div><input id="new-snote"></div></div>');
const w = dom.window; global.document = w.document;
let _dpAccOpen = 'sched';
eval(grab('dpAccShow_').replace('function dpAccShow_', 'var dpAccShow_ = function'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const care = () => document.querySelector('[data-acc=care]').classList, sched = () => document.querySelector('[data-acc=sched]').classList;
ok(!care().contains('open') && sched().contains('open'), 'trước: mục care gập, sched mở (ô ghi chú bị ẩn bởi CSS)');
const sec = dpAccShow_('care');
ok(care().contains('open') && !sched().contains('open'), 'dpAccShow_(care) mở care, gập sched (1 mục một lúc)');
ok(sec && sec.contains(document.getElementById('cs-note-new')), 'trả về đúng mục chứa ô ghi chú');
ok(_dpAccOpen === 'care', 'cập nhật _dpAccOpen = care (vẽ lại hồ sơ vẫn mở care)');
dpAccShow_('');
ok(!care().contains('open') && !sched().contains('open'), 'dpAccShow_("") gập hết');
console.log(fail ? 'FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
