#!/usr/bin/env node
// Mèo máy "làm việc" khi AI trả lời (js/38-pro-dock.js): _proDock.busy là thuộc tính có setter → bật/tắt lớp pro-cat-busy + aria-busy.
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(root, 'js/38-pro-dock.js'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b); if (i < 0 || j < i) throw new Error('không tìm thấy khối ' + a); return src.slice(i, j); };
const accessor = cut('var _proDock = {', 'function proTabsLoad_');
const funcs = cut('function proCatIconSvg_', '// Dock phải + panel trợ lý');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<body><div id="pro-dock"><button><svg class="pro-cat"></svg></button></div><div id="pro-ai"><div id="pro-ai-log"></div></div></body>', { runScripts: 'outside-only' });
const w = dom.window; w.eval(funcs + '\n' + accessor);
const D = w.eval('_proDock'), has = (id) => w.document.getElementById(id).classList.contains('pro-cat-busy');
ok(D.busy === false && !has('pro-dock') && !has('pro-ai'), 'ban đầu: không bận, không có lớp pro-cat-busy');
D.busy = true;
ok(D.busy === true && has('pro-dock') && has('pro-ai'), 'busy=true → mèo ở nút nổi + tiêu đề khung cùng "làm việc"');
ok(w.document.getElementById('pro-ai-log').getAttribute('aria-busy') === 'true', 'busy=true → aria-busy trên khung chat');
D.busy = true; ok(has('pro-dock'), 'gán busy=true lần nữa vẫn đúng (idempotent)');
D.busy = false;
ok(D.busy === false && !has('pro-dock') && !has('pro-ai') && !w.document.getElementById('pro-ai-log').hasAttribute('aria-busy'), 'busy=false → tắt hiệu ứng + bỏ aria-busy');
D.busy = 1; ok(D.busy === true, 'gán giá trị truthy → true (ép boolean)'); D.busy = 0; ok(D.busy === false, 'gán 0 → false');
ok(['tabs', 'mode', 'log', 'busy', 'items'].every(k => Object.keys(D).includes(k)), 'các thuộc tính cũ của _proDock còn nguyên, busy vẫn liệt kê được');
D.tabs.push({ id: 1 }); ok(JSON.parse(JSON.stringify(D)).tabs.length === 1, 'JSON hoá _proDock vẫn chạy');
// style
w.eval('proCatStyle_(); proCatStyle_();');
ok(w.document.querySelectorAll('#pro-cat-style').length === 1, 'style chèn đúng 1 lần dù gọi 2 lần');
const css = w.document.getElementById('pro-cat-style').textContent;
ok(/@keyframes proCatWag/.test(css) && /\.pro-cat-busy \.pro-cat\{animation:proCatWag/.test(css), 'có keyframes lắc + áp cho .pro-cat khi bận');
ok(/\.pro-cat-busy \.pro-cat-ant\{fill:#ff9800/.test(css), 'bi ăng-ten đổi cam khi bận (tín hiệu không cần chuyển động)');
ok(/@media \(prefers-reduced-motion:reduce\)\{[^}]*animation:none/.test(css), 'giảm chuyển động → tắt animation');
ok(!/@media \(prefers-reduced-motion:reduce\)\{[^}]*fill:/.test(css), 'giảm chuyển động KHÔNG tắt màu cam (vẫn báo đang bận)');
// icon có class cho CSS bám vào
const svg = w.eval('proCatIcon_(32)'); ok(/class="pro-cat"/.test(svg) && /class="pro-cat-ant"/.test(svg), 'SVG có class pro-cat + pro-cat-ant');
// không có DOM (các test khác của dock chạy code trong vm trần): đặt busy không được ném lỗi
const bare = {}; vm.createContext(bare); vm.runInContext(accessor, bare);
let threw = false; try { vm.runInContext('_proDock.busy = true; if (_proDock.busy !== true) throw new Error("x"); _proDock.busy = false;', bare); } catch (e) { threw = true; }
ok(!threw, 'môi trường không DOM / không có proCatBusy_: đặt busy không lỗi, giá trị vẫn đúng');
// nối dây trong dock + mọi chỗ gán busy là phép gán thường
ok(/proCatStyle_\(\); proCatBusy_\(_proDock\.busy\)/.test(src), 'proDockEnsure_ chèn style + đồng bộ trạng thái khi tạo dock');
ok(!/_proDock\.busy\s*\+\+|_proDock\.busy\s*[-+*|&]=/.test(src), 'không có toán tử gán phức hợp lên busy (tương thích setter)');
console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);
