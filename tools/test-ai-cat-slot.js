#!/usr/bin/env node
// proCatFill_ (js/38) + tab "Zalo AI" ở index.html: ô giữ chỗ .ai-cat-slot được điền mèo, không điền thì giữ 🤖. Chạy: node tools/test-ai-cat-slot.js
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(root, 'js/38-pro-dock.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const i = src.indexOf('function proCatIconSvg_'), j = src.indexOf('function proCatStyle_');
if (i < 0 || j < i) throw new Error('không tìm thấy khối hàm mèo trong js/38');
const { JSDOM } = require('jsdom');
const tabHtml = (html.match(/<div class="tab"[^>]*tab-zaloai[^>]*>.*?<\/div>/) || [''])[0];
ok(/ai-cat-slot/.test(tabHtml) && /Zalo AI<\/div>$/.test(tabHtml) && !/>🤖 Zalo AI</.test(tabHtml), 'index.html: tab Zalo AI dùng ô giữ chỗ .ai-cat-slot (🤖 chỉ còn là nội dung tạm)');
const w = new JSDOM('<body><div class="tabs">' + tabHtml + '</div></body>', { runScripts: 'outside-only' }).window;
const tab = () => w.document.querySelector('.tab');
w.eval(src.slice(i, j));
ok(/^🤖\s*Zalo AI$/.test(tab().textContent), 'trước khi điền: chữ tab vẫn "🤖 Zalo AI" (fallback nếu js/38 không chạy)');
ok(w.eval('proCatFill_()') === 1, 'điền 1 ô');
ok(tab().querySelector('.ai-cat-slot svg.pro-cat') && tab().textContent.trim() === 'Zalo AI', 'sau khi điền: có mèo, chữ tab còn "Zalo AI" (không còn 🤖)');
ok(tab().getAttribute('onclick') === "switchTab('zaloai',this)" && tab().getAttribute('data-bar-id') === 'tab-zaloai', 'thuộc tính tab (onclick, data-bar-id) không đổi');
ok(w.eval('proCatFill_()') === 0 && tab().querySelectorAll('svg.pro-cat').length === 1, 'gọi lại không nhân đôi mèo');
w.document.body.insertAdjacentHTML('beforeend', '<span class="ai-cat-slot" data-px="24">🤖 </span>');
ok(w.eval('proCatFill_()') === 1 && /width:24px/.test(w.document.body.lastChild.innerHTML), 'ô mới thêm sau (data-px=24) cũng được điền đúng cỡ');
w.eval('proCatIcon_ = function(){ throw new Error("x"); }'); w.document.body.insertAdjacentHTML('beforeend', '<span class="ai-cat-slot">🤖 </span>');
ok(w.eval('proCatFill_()') === 0 && /🤖/.test(w.document.body.lastChild.textContent), 'mèo lỗi → giữ 🤖, không ném lỗi');
console.log(fail ? 'CÓ LỖI ' + fail : 'TẤT CẢ QUA (' + pass + ')'); process.exit(fail ? 1 : 0);
