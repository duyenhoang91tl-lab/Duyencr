#!/usr/bin/env node
// Test (2026-11-14): lưới nút công cụ của giao diện v2 Pancake AI — chạy NGUYÊN đoạn "Giao diện v2" trích từ pancake-content.js trong jsdom.
// Cần jsdom: NODE_PATH=<thư mục có node_modules/jsdom> node tools/test-pancake-chips.js
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: cần `npm i jsdom` (NODE_PATH)'); process.exit(0); }
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
const a = src.indexOf('// ── Giao diện v2 (2026-11-14)'), b = src.indexOf('panelEl.querySelector("#pk-rem-refresh")', a);
if (a < 0 || b < 0) { console.log('FAIL không thấy đoạn Giao diện v2'); process.exit(1); }
const code = src.slice(a, b);
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const dom = new JSDOM('<div id="p"><div id="w"><div id="pk-menu-row"><select id="pk-menu-sel"><option value="">— Chọn mục —</option><option value="rem">⏰ Nhắc hẹn hôm nay (0)</option><option value="price">💰 Tra cứu bảng giá</option><option value="assign">📋 Data được chia (3)</option></select></div></div></div>', { runScripts: 'outside-only' });
  const w = dom.window; w.panelEl = w.document.getElementById('p');
  w.eval(code);
  const q = (s) => [...w.document.querySelectorAll(s)], sel = w.document.getElementById('pk-menu-sel');
  let changes = 0; sel.addEventListener('change', () => changes++);
  ok(q('.pk-chip').length === 3, '3 nút công cụ (bỏ option rỗng)');
  ok(q('.pk-chip-tx').map((e) => e.textContent).join('|') === 'Nhắc hẹn hôm nay|Tra cứu bảng giá|Data được chia', 'nhãn đúng, đã tách số đếm khỏi chữ');
  ok(q('.pk-chip-n').map((e) => e.textContent).join(',') === '0,3' && q('.pk-chip-n.zero').length === 1, 'badge số đếm: 0 (xám) và 3; mục không có số thì không có badge');
  q('.pk-chip')[1].click();
  ok(sel.value === 'price' && changes === 1, 'bấm nút → gán select + bắn change qua đường cũ');
  ok(q('.pk-chip.active').length === 1 && q('.pk-chip.active')[0].dataset.v === 'price', 'nút đang mở được tô active');
  q('.pk-chip.active')[0].click();
  ok(sel.value === '' && q('.pk-chip.active').length === 0, 'bấm lại nút đang mở → tắt (value rỗng)');
  sel.options[1].textContent = '⏰ Nhắc hẹn hôm nay (5)'; await sleep(20);   // code cũ đổi chữ option khi tải xong nhắc hẹn
  ok(q('.pk-chip-n')[0].textContent === '5' && !q('.pk-chip-n')[0].classList.contains('zero'), 'đổi chữ option (đếm nhắc hẹn) → badge tự cập nhật');
  sel.value = 'assign'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(q('.pk-chip.active')[0].dataset.v === 'assign', 'nơi khác mở mục bằng code (vd "Mở mẫu tin nhắn") → nút tương ứng sáng lên');
  w.eval(code); ok(q('.pk-chip').length === 3 && q('#pk-menu-chips').length === 1, 'gọi lại không tạo trùng lưới');
  console.log(bad ? bad + ' FAIL' : 'ALL PANCAKE-CHIPS TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
