#!/usr/bin/env node
// Test: hồ sơ khách trên điện thoại cuộn được cả ngăn (không để .dp-body bị ép ~100px, không khoá cứng). Chạy: node tools/test-dp-mobile-scroll.js
const fs = require('fs'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const css = fs.readFileSync('css/06-pro.css', 'utf8'), base = fs.readFileSync('css/01-base.css', 'utf8'), html = fs.readFileSync('index.html', 'utf8');
const mq = css.match(/@media \(max-width:640px\)\{([\s\S]*?)\n\}\n?$/);
ok(!!mq, 'css/06 có khối @media (max-width:640px) ở cuối file (khớp MOBILE_FIT_MAX_W=640)');
const b = mq ? mq[1] : '';
ok(/html\.ui-pro #dp\{[^}]*overflow-y:auto/.test(b), 'màn hẹp: cả ngăn #dp cuộn dọc');
ok(/html\.ui-pro #dp \.dp-body\{[^}]*flex:none[^}]*overflow:visible[^}]*padding-bottom:\d+px/.test(b), 'màn hẹp: .dp-body hết cuộn riêng/cao theo nội dung + chừa đáy cho thanh tab');
ok(/html\.ui-pro #dp \.dp-hdr\{[^}]*position:sticky[^}]*top:0/.test(b), 'màn hẹp: thanh tên + ✕ dính trên cùng (luôn đóng được)');
ok(/\.dp\{[^}]*flex-direction:column;overflow:hidden/.test(base) && /\.dp-body\{flex:1;overflow-y:auto/.test(base), 'quy tắc gốc (màn rộng) css/01 KHÔNG đổi → màn máy tính giữ nguyên');
ok(/css\/06-pro\.css\?v=20261115f/.test(html), 'index.html tăng ?v= css/06');
console.log(bad ? '\nFAIL ' + bad : '\nPASS tất cả'); process.exit(bad ? 1 : 0);
