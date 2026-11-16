#!/usr/bin/env node
// proCatTag_ (js/38): mèo nhúng trong dòng chữ thay 🤖 ở các màn khác; fallback 🤖 khi chưa có hàm vẽ. Chạy: node tools/test-ai-cat-tag.js
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(root, 'js/38-pro-dock.js'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b); if (i < 0 || j < i) throw new Error('không tìm thấy khối ' + a); return src.slice(i, j); };
const { JSDOM } = require('jsdom');
const w = new JSDOM('<body></body>', { runScripts: 'outside-only' }).window;
w.eval(cut('function proCatIconSvg_', '// Hiệu ứng mèo khi AI đang trả lời:'));
let h = w.eval('proCatTag_(16)');
ok(/^<span class="pro-cat-tag"/.test(h) && /<svg class="pro-cat"/.test(h) && h.indexOf('🤖') < 0, 'px=16 → span bọc SVG mèo, không còn 🤖');
w.document.body.innerHTML = '<button>' + h + 'Phân tích</button>';
const btn = w.document.body.firstChild, sp = btn.firstChild;
ok(sp.style.width === '16px' && sp.style.height === '16px' && sp.style.display === 'inline-block', 'kích thước 16px, inline-block (nằm cùng hàng chữ)');
ok(btn.textContent === 'Phân tích', 'textContent của nút chỉ còn chữ "Phân tích" (SVG không thêm chữ nào) — code đọc textContent không bị lệch');
ok(btn.querySelector('svg[aria-hidden="true"]') && sp.getAttribute('aria-hidden') === 'true', 'ẩn khỏi trình đọc màn hình (trang trí)');
ok(/pointer-events:none/.test(h), 'SVG không bắt chuột → bấm vào mèo vẫn là bấm nút');
ok(w.eval('proCatTag_(1)').indexOf('width:10px') > 0 && w.eval('proCatTag_(999)').indexOf('width:64px') > 0 && w.eval('proCatTag_("abc")').indexOf('width:16px') > 0, 'kẹp kích thước 10..64, rác → 16');
ok(!/pro-cat-ant/.test('') && /pro-cat-ant/.test(h), 'có bi ăng-ten để hiệu ứng "bận" áp được nếu cha có pro-cat-busy');
// Fallback: hàm vẽ chưa nạp
const w2 = new JSDOM('<body></body>', { runScripts: 'outside-only' }).window;
w2.eval(cut('function proCatTag_', '// Hiệu ứng mèo khi AI đang trả lời:'));
ok(w2.eval('proCatTag_(16)') === '🤖', 'chưa nạp proCatIcon_ → fallback 🤖');
w.eval('proCatIcon_ = function(){ throw new Error("x"); }');
ok(w.eval('proCatTag_(16)') === '🤖', 'proCatIcon_ ném lỗi → fallback 🤖, không làm hỏng màn gọi');
console.log(fail ? 'CÓ LỖI ' + fail : 'TẤT CẢ QUA (' + pass + ')'); process.exit(fail ? 1 : 0);
