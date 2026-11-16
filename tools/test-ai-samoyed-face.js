#!/usr/bin/env node
// Icon AI = MẶT SAMOYED (js/38-pro-dock.js proCatIconSvg_; tên hàm "Cat" giữ vì nhiều nơi gọi). Chạy: node tools/test-ai-samoyed-face.js
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(root, 'js/38-pro-dock.js'), 'utf8');
const a = src.indexOf('function proCatIconSvg_'), b = src.indexOf('// Dock phải + panel trợ lý');
const c = { window: { matchMedia: () => ({ matches: false }) } }; vm.createContext(c); vm.runInContext(src.slice(a, b), c);
const svg = c.proCatIcon_(32);
ok(/<polygon/.test(svg) && (svg.match(/<polygon/g) || []).length === 6, '2 tai tam giác đứng (mỗi tai 3 lớp viền/lông/lòng tai)');
ok(/fill="#2b2420"/.test(svg) && /M29\.2 38\.6/.test(svg), 'có mũi đen');
ok(/Q29\.6 46\.6 26\.2 43/.test(svg) && /Q34\.4 46\.6 37\.8 43/.test(svg), 'nụ cười Sammy: khoé miệng cong lên 2 bên');
ok(/#ff8fa6/.test(svg) && /<path d="M29\.8 45\.4/.test(svg), 'có lưỡi hồng');
ok(!/M16 45 L9\.5/.test(svg) && !/<line /.test(svg), 'hết ria mèo + hết dây ăng-ten');
ok(/class="pro-cat-ant"/.test(svg) && /class="pro-cat"/.test(svg), 'giữ class pro-cat + pro-cat-ant (thẻ tên vòng cổ) cho hiệu ứng "bận"');
ok(/rotate\(-8 23 32\.5\)/.test(svg) && /rotate\(8 41 32\.5\)/.test(svg), 'mắt hơi xếch đối xứng');
ok(/<animate /.test(svg) && !/<animate /.test(c.proCatIconSvg_(32, false)), 'chớp mắt có/tắt theo cờ');
ok(!/🐱|mèo/i.test(svg), 'SVG không còn nhắc mèo');
console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);
