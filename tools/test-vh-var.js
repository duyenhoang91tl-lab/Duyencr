#!/usr/bin/env node
// Biến --vh (js/59) + khoá: không còn `max-height:NNvh` trần trong js/ và css/ (trừ css/99 tự sinh) — phải là calc(var(--vh,1vh)*NN) để khỏi bị dải trắng khi WebView kẹt vh=0.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const mf = require(path.join(root, 'js/59-fn-mobilefit.js'));
ok(mf.mobileFitVhPx_(722) === 7.22, '722px → 7.22px/1vh');
ok(mf.mobileFitVhPx_(0) === null && mf.mobileFitVhPx_(undefined) === null && mf.mobileFitVhPx_(100) === null && mf.mobileFitVhPx_('x') === null, 'chưa đo → null (dùng 1vh)');
ok(mf.mobileFitVhPx_(120) === 1.2, 'đúng ngưỡng 120');
// quét mã nguồn
const bare = /max-height:\s*\d+(?:\.\d+)?d?vh/g;
const files = [];
['js', 'css'].forEach(d => fs.readdirSync(path.join(root, d)).forEach(n => { if (/\.(js|css)$/.test(n) && !/^99-/.test(n)) files.push(d + '/' + n); }));
files.push('index.html');
const left = [];
files.forEach(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => { const m = l.match(bare); if (m && !/^\s*(\/\/|\/\*)/.test(l)) left.push(f + ':' + (i + 1) + ' ' + m[0]); }));
ok(left.length === 0, 'còn max-height:NNvh trần: ' + left.join(' | '));
const withVar = files.filter(f => /max-height:calc\(var\(--vh,1vh\)\*\d/.test(fs.readFileSync(path.join(root, f), 'utf8'))).length;
ok(withVar >= 20, 'đã dùng calc(var(--vh,1vh)*N) ở >= 20 file, hiện ' + withVar);
console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);
