#!/usr/bin/env node
// Test (2026-10-25): goi PWA cua trang Viet tat (iPhone/Android): manifest tro dung file, icon dung kich thuoc, sw luu du file, viettat.html noi du dây.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8'), ex = (f) => fs.existsSync(path.join(root, f));
const mf = JSON.parse(rd('viettat.webmanifest')), html = rd('viettat.html'), sw = rd('viettat-sw.js');
ok(mf.start_url === 'viettat.html' && mf.display === 'standalone' && ex(mf.start_url), 'manifest: start_url dung, standalone');
ok(!/^\//.test(mf.start_url) && !/^\//.test(mf.scope), 'manifest dung duong dan tuong doi (chay duoc duoi /Duyencr/ cua GitHub Pages)');
for (const i of mf.icons) { const b = fs.readFileSync(path.join(root, i.src)); const w = b.readUInt32BE(16), h = b.readUInt32BE(20); ok(i.sizes === w + 'x' + h, 'icon ' + i.src + ' dung kich thuoc ' + w + 'x' + h); }
const a = fs.readFileSync(path.join(root, 'viettat-icon-180.png')); ok(a.readUInt32BE(16) === 180 && a.readUInt32BE(20) === 180, 'apple-touch-icon 180x180');
ok(/rel="manifest" href="viettat\.webmanifest"/.test(html) && /rel="apple-touch-icon" href="viettat-icon-180\.png"/.test(html), 'viettat.html link manifest + apple-touch-icon');
ok(/serviceWorker'\)?.*register\('viettat-sw\.js'\)|register\('viettat-sw\.js'\)/.test(html), 'viettat.html dang ky service worker');
const shell = (sw.match(/SHELL = \[([^\]]*)\]/) || [])[1] || ''; const files = [...shell.matchAll(/'([^']+)'/g)].map((m) => m[1]);
ok(files.length >= 4 && files.every(ex), 'sw luu san cac file ton tai: ' + files.join(','));
ok(/standalone/.test(html) && /Thêm vào MH chính/.test(html) && /beforeinstallprompt/.test(html), 'goi y cai dat: iOS (Them vao MH chinh) + Android (beforeinstallprompt)');
ok(/u\.origin !== location\.origin\) return/.test(sw), 'sw khong chen vao yeu cau GAS (khac mien)');
console.log(bad ? '\n' + bad + ' LOI' : '\nALL VIETTAT-PWA TESTS PASSED'); process.exit(bad ? 1 : 0);
