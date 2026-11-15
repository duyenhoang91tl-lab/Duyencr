#!/usr/bin/env node
// Icon AI = mèo máy Anh lông dài (js/38-pro-dock.js: proCatIconSvg_/proCatIcon_). SVG tự vẽ, nội tuyến.
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(root, 'js/38-pro-dock.js'), 'utf8');
const a = src.indexOf('function proCatIconSvg_'), b = src.indexOf('// Dock phải + panel trợ lý');
ok(a > 0 && b > a, 'tìm thấy khối hàm icon');
function load(reduced) { const c = { window: { matchMedia: () => ({ matches: reduced }) } }; vm.createContext(c); vm.runInContext(src.slice(a, b), c); return c; }
const { JSDOM } = require('jsdom');
const parse = svg => new JSDOM('').window.eval ? new (new JSDOM('').window.DOMParser)().parseFromString(svg, 'image/svg+xml') : null;
const normal = load(false), reduced = load(true);
const s1 = normal.proCatIcon_(32), s2 = reduced.proCatIcon_(32);
[['bình thường', s1], ['giảm chuyển động', s2]].forEach(([n, s]) => {
  const d = parse(s);
  ok(!d.querySelector('parsererror'), n + ': SVG hợp lệ (parse XML không lỗi)');
  ok(d.documentElement.getAttribute('width') === '32' && d.documentElement.getAttribute('viewBox') === '0 0 64 64', n + ': đúng kích thước/viewBox');
  ok(d.documentElement.getAttribute('aria-hidden') === 'true', n + ': aria-hidden (nút đã có aria-label)');
  ok(!/\sid="/.test(s), n + ': không có id (dùng 2 nơi cùng lúc không trùng id)');
  ok(!/<script|on\w+=|href=/i.test(s), n + ': không script/sự kiện/liên kết');
  ok(d.querySelectorAll('circle,ellipse').length > 20, n + ': đủ lông xù/mắt/mũi');
});
ok(/<animate /.test(s1), 'bình thường: có chớp mắt');
ok(!/<animate /.test(s2), 'giảm chuyển động: KHÔNG chớp mắt');
ok(/pointer-events:none/.test(s1), 'svg không chặn chuột (kéo thả dock vẫn ăn trên nút)');
ok(normal.proCatIcon_(24).includes('width="24"'), 'đổi kích thước theo tham số');
// Nối đúng 2 chỗ, không còn 🤖 ở nút/tiêu đề AI (các chỗ 🤖 khác trong app KHÔNG đụng)
ok(/id="pro-dock-ai"[^']*aria-label="Trợ lý AI">' \+ proCatIcon_\(32\)/.test(src), 'nút dock dùng icon mèo');
ok(/proCatIcon_\(24\) \+ ' Trợ lý AI<\/b>/.test(src), 'tiêu đề khung AI dùng icon mèo');
ok(!/id="pro-dock-ai"[^']*>🤖/.test(src) && !/<b>🤖 Trợ lý AI/.test(src), 'hết 🤖 ở nút + tiêu đề AI');
console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);
