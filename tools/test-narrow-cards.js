#!/usr/bin/env node
// Test: thẻ Mẫu tin (js/20) + thẻ Viết tắt (js/57) không bị ép cột hẹp trên điện thoại (ảnh Duyên 15/11). Chạy: node tools/test-narrow-cards.js
const fs = require('fs'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const a = fs.readFileSync('js/20-loadaiexamples.js', 'utf8'), b = fs.readFileSync('js/57-viettat.js', 'utf8');
ok(/justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;flex-wrap:wrap/.test(a), 'Mẫu tin: hàng tiêu đề+nút được xuống dòng (flex-wrap)');
ok(/font-size:13px;flex:1 1 200px;min-width:0;overflow-wrap:anywhere">' \+ esc\(t\.title\)/.test(a), 'Mẫu tin: tiêu đề có min-width:0 + flex-basis, không bị cụm nút ép');
ok(!/flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">' \+ acts/.test(a), 'Mẫu tin: cụm nút không còn flex-shrink:0 chiếm hết chỗ');
ok(/display:flex;flex-wrap:wrap;gap:6px 10px;align-items:flex-start;margin-bottom:4px/.test(b), 'Viết tắt: thẻ được flex-wrap');
ok(/<code style="font-size:13px;font-weight:700;overflow-wrap:anywhere;word-break:break-all">/.test(b), 'Viết tắt: mã viết tắt dài (vd trangsucnhankimvanloc2027tuvan) tự ngắt dòng');
ok(/<div style="flex:1 1 200px;min-width:0"><div style="margin-bottom:3px">/.test(b), 'Viết tắt: cột nội dung có flex-basis 200px, không bị bóp còn vài ký tự');
ok(!/display:flex;gap:4px;flex-shrink:0">/.test(b) && (b.match(/flex:0 0 auto;margin-left:auto/g) || []).length === 2, 'Viết tắt: 2 cột nút (Sửa viết tắt / ✏️🗑) cùng dạng mới, xuống dòng khi hẹp');
console.log(bad ? '\nFAIL ' + bad : '\nPASS tất cả'); process.exit(bad ? 1 : 0);
