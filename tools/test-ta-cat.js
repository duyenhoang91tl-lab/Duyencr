#!/usr/bin/env node
// js/30 (AI phân tích team): 🤖 → mèo máy qua proCatTag_, fallback 🤖 + dấu cách; nút khôi phục dùng innerHTML. Chạy: node tools/test-ta-cat.js
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(root, 'js/30-fn-teamanalysis.js'), 'utf8');
const i = src.indexOf('function _taCat_'), j = src.indexOf('\n', i);
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(i, j), ctx);
ok(vm.runInContext('_taCat_(16)', ctx) === '🤖 ', 'chưa nạp proCatTag_ → "🤖 " (có dấu cách, y như bản cũ)');
vm.runInContext('proCatTag_ = function(px){ return "<span class=\\"pro-cat-tag\\">M" + px + "</span>"; }', ctx);
ok(vm.runInContext('_taCat_(22)', ctx) === '<span class="pro-cat-tag">M22</span>', 'có proCatTag_ → dùng HTML mèo (đã có margin phải)');
vm.runInContext('proCatTag_ = function(){ return "🤖"; }', ctx);
ok(vm.runInContext('_taCat_(16)', ctx) === '🤖 ', 'proCatTag_ trả fallback 🤖 → thêm dấu cách');
vm.runInContext('proCatTag_ = function(){ throw new Error("x"); }', ctx);
ok(vm.runInContext('_taCat_(16)', ctx) === '🤖 ', 'proCatTag_ ném lỗi → "🤖 "');
ok(!/>🤖 AI phân tích toàn team</.test(src) && !/>🤖 Phân tích</.test(src), 'không còn 🤖 cứng ở tiêu đề / nút Phân tích');
ok(/btn\.innerHTML = _taCat_\(16\) \+ 'Phân tích'/.test(src) && !/btn\.textContent = '🤖/.test(src), 'khôi phục nút sau khi chạy dùng innerHTML (textContent sẽ hiện thẻ <span> thành chữ)');
ok(/btn\.textContent = '⏳ Đang phân tích…'/.test(src), 'trạng thái đang chạy vẫn là chữ thuần');
console.log(fail ? 'CÓ LỖI ' + fail : 'TẤT CẢ QUA (' + pass + ')'); process.exit(fail ? 1 : 0);
