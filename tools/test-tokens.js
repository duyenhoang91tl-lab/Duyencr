#!/usr/bin/env node
// R1d — kiểm bộ mã thiết kế css/00-tokens.css (HANDOFF.md "KẾ HOẠCH THIẾT KẾ LẠI TOÀN BỘ CRM"). Chạy: node tools/test-tokens.js (không cần cài thêm gì).
// Kiểm: (1) mọi var(--ui-*) đang dùng trong css/js/index.html đều đã khai báo; (2) bí danh --ui-* trỏ tới biến CÓ THẬT ở css/01-base.css;
// (3) token có màu RIÊNG (không phải bí danh) đều có bản chế độ tối; (4) file CSS trong TOKEN_ONLY không được viết mã màu cứng;
// (5) 00-tokens.css nạp TRƯỚC 01-base.css trong index.html; (6) thang chữ/bo góc có đúng các mốc đã đếm (để R1b không lệch pixel).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0;
const ok = m => console.log('ok   ' + m), bad = m => { fail++; console.log('FAIL ' + m); };
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '');

// File CSS MỚI chỉ được dùng var(--ui-*) / var(--biến-cũ); THÊM tên file mới vào đây khi tạo (vd '20-kit.css'). 00-tokens.css là nơi duy nhất được khai báo màu.
const TOKEN_ONLY = ['20-kit.css'];

const tokens = strip(read('css/00-tokens.css'));
const base = strip(read('css/01-base.css'));

// khối :root và khối tối
const rootBlock = (tokens.match(/:root\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
const darkBlock = (tokens.match(/html\[data-theme="dark"\]\s*\{([\s\S]*?)\}/) || [])[1] || '';
const decl = b => { const m = {}; b.replace(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi, (_, k, v) => { m[k] = v.trim(); }); return m; };
const defs = decl(rootBlock), dark = decl(darkBlock);
Object.keys(defs).length > 30 ? ok('00-tokens.css khai báo ' + Object.keys(defs).length + ' biến --ui-*') : bad('00-tokens.css khai báo quá ít biến (' + Object.keys(defs).length + ')');

// (1) mọi var(--ui-*) đang dùng đều có định nghĩa
const files = [...fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f),
  ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f), 'index.html'];
const undef = new Set();
for (const f of files) for (const m of read(f).matchAll(/var\(\s*(--ui-[a-z0-9-]+)/g)) if (!(m[1] in defs)) undef.add(m[1] + '  (' + f + ')');
undef.size ? bad('dùng biến --ui-* CHƯA khai báo: ' + [...undef].slice(0, 8).join(' | ')) : ok('mọi var(--ui-*) đang dùng đều đã khai báo');

// (2) bí danh trỏ tới biến có thật ở 01-base.css :root
const baseRoot = (base.match(/:root\s*\{([\s\S]*?)\n\}/) || [])[1] + (base.match(/:root\{([^}]*)\}/) || [])[1];
const baseVars = decl(baseRoot);
const badAlias = [];
for (const [k, v] of Object.entries(defs)) { const m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i); if (m && !(m[1] in baseVars) && !(m[1] in defs)) badAlias.push(k + ' → ' + m[1]); }
badAlias.length ? bad('bí danh trỏ tới biến KHÔNG có ở 01-base.css: ' + badAlias.join(', ')) : ok('mọi bí danh trỏ tới biến có thật');

// (3) token có màu riêng (hex/rgb/hsl, không phải bí danh, không phải bóng) phải có bản tối
const isColor = v => /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\(/i.test(v);
const needDark = Object.entries(defs).filter(([k, v]) => isColor(v)).map(([k]) => k);
const missDark = needDark.filter(k => !(k in dark));
missDark.length ? bad('token màu riêng thiếu bản chế độ tối: ' + missDark.join(', ')) : ok('token màu riêng đều có bản tối (' + needDark.join(', ') + ')');
const strayDark = Object.keys(dark).filter(k => !(k in defs));
strayDark.length ? bad('khối tối khai báo token chưa có bản sáng: ' + strayDark.join(', ')) : ok('khối tối khớp khối sáng');

// (4) file CSS mới không có mã màu cứng
for (const f of TOKEN_ONLY) {
  const t = strip(read('css/' + f)), hit = t.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  hit ? bad(f + ' có mã màu cứng "' + hit[0] + '" — dùng var(--ui-*)') : ok(f + ' không có mã màu cứng');
}
if (!TOKEN_ONLY.length) ok('(chưa có file CSS nào trong TOKEN_ONLY — thêm khi tạo file CSS mới)');

// (5) thứ tự nạp
const idx = read('index.html'), a = idx.indexOf('css/00-tokens.css'), b = idx.indexOf('css/01-base.css');
a > 0 && b > a ? ok('index.html nạp 00-tokens.css trước 01-base.css') : bad('index.html phải nạp css/00-tokens.css TRƯỚC css/01-base.css');

// (6) thang đã chốt (đổi mốc = phải đếm lại, vì R1b dùng đúng các mốc này để thay giá trị cứng không lệch pixel)
const want = { '--ui-r-xs': '4px', '--ui-r-sm': '6px', '--ui-r-md': '8px', '--ui-r-lg': '10px', '--ui-r-xl': '12px', '--ui-r-pill': '999px', '--ui-r-round': '50%',
  '--ui-fs-2xs': '10px', '--ui-fs-xs': '11px', '--ui-fs-sm': '12px', '--ui-fs-base': '13px', '--ui-fs-md': '14px', '--ui-fs-lg': '16px', '--ui-fs-xl': '18px', '--ui-fs-2xl': '22px' };
const wrong = Object.entries(want).filter(([k, v]) => defs[k] !== v).map(([k, v]) => k + ' phải = ' + v + ' (đang ' + defs[k] + ')');
wrong.length ? bad('thang bị đổi: ' + wrong.join('; ')) : ok('thang chữ + bo góc đúng mốc đã chốt');

console.log(fail ? '\n' + fail + ' lỗi' : '\ntất cả đạt');
process.exit(fail ? 1 : 0);
