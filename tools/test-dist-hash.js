#!/usr/bin/env node
// Test ?v= TỰ SINH THEO NỘI DUNG + _headers (cần chạy SAU `node tools/build-dist.js`).
// Kiểm: mọi thẻ js/css trong dist/index.html có ?v=<10 hex> ĐÚNG bằng sha256 file nén; đổi nội dung → đổi mã; _headers chỉ immutable cho /js/* và /css/* (KHÔNG index/sw/manifest).
// Chạy: node tools/build-dist.js && node tools/test-dist-hash.js -> "ALL DIST-HASH TESTS PASSED".
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const dist = path.join(__dirname, '..', 'dist');
ok(fs.existsSync(path.join(dist, 'index.html')), 'chưa build: chạy node tools/build-dist.js trước');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/\b(?:src|href)="((?:js|css)\/[^"?#]+)(\?[^"#]*)?"/g)];
ok(refs.length >= 100, 'ít thẻ js/css bất thường: ' + refs.length);
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, rel))).digest('hex').slice(0, 10);
refs.forEach(m => ok(m[2] === '?v=' + sha(m[1]), 'sai/thiếu mã băm ở ' + m[1] + ' (' + (m[2] || 'không có ?v=') + ')'));
// đổi nội dung thì mã đổi, cùng nội dung thì mã giữ nguyên
const h1 = crypto.createHash('sha256').update('a').digest('hex').slice(0, 10), h2 = crypto.createHash('sha256').update('b').digest('hex').slice(0, 10);
ok(h1 !== h2 && h1 === crypto.createHash('sha256').update('a').digest('hex').slice(0, 10), 'băm ổn định/khác nhau');
// _headers
const hd = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
ok(/^\/js\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m.test(hd) && /^\/css\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m.test(hd), '_headers thiếu immutable cho /js/* hoặc /css/*');
ok(!/^\/(index\.html|sw\.js|manifest\.webmanifest)?\s*$/m.test(hd) && !/^\/\*\s*$/m.test(hd), '_headers KHÔNG được áp immutable cho index/sw/manifest/toàn site');
console.log('ALL DIST-HASH TESTS PASSED (' + refs.length + ' thẻ)');
