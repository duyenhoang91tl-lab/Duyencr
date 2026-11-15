#!/usr/bin/env node
// R1b — đổi giá trị CỨNG của border-radius / font-size / bóng lớn sang biến --ui-* (css/00-tokens.css) mà KHÔNG lệch 1 pixel:
// chỉ thay khi giá trị khớp ĐÚNG mốc đã chốt (vd 12px → var(--ui-r-xl) = 12px). Mốc lẻ (12.5px, 99px, "8px 8px 0 0"...) giữ nguyên.
// Dùng:  node tools/tokenize-css.js            # áp dụng cho FILES bên dưới
//        node tools/tokenize-css.js --verify   # kiểm: thay ngược var(--ui-*) → giá trị cũ phải ra đúng file gốc ở git HEAD (không lệch) — không ghi gì
// Chỉ đụng file trong FILES (lớp giao diện mới). KHÔNG đụng css/01–04 (CSS cũ) và KHÔNG đụng chú thích.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const FILES = ['05-sidenav', '06-pro', '11-roles', '13-shell', '14-qrpills', '15-mobile', '16-mobile-list', '17-reports-pro', '18-list-pro'].map(n => 'css/' + n + '.css');
const R = { '4px': 'xs', '6px': 'sm', '8px': 'md', '10px': 'lg', '12px': 'xl', '999px': 'pill', '50%': 'round' };
const F = { '10px': '2xs', '11px': 'xs', '12px': 'sm', '13px': 'base', '14px': 'md', '16px': 'lg', '18px': 'xl', '22px': '2xl' };
const SHADOW_LG = '0 12px 40px rgba(0,0,0,.25)';
const tok = { ...Object.fromEntries(Object.entries(R).map(([v, n]) => ['--ui-r-' + n, v])), ...Object.fromEntries(Object.entries(F).map(([v, n]) => ['--ui-fs-' + n, v])), '--ui-shadow-lg': SHADOW_LG };

function convert(text) {
  let n = 0;
  const parts = text.split(/(\/\*[\s\S]*?\*\/)/);   // phần lẻ = chú thích → giữ nguyên
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i]
      .replace(/(^|[^-\w])(border-radius|font-size)(\s*:\s*)([\d.]+(?:px|%))(\s*!important)?(?=\s*[;}])/g, (m, pre, prop, sep, val, imp) => {
        const name = (prop === 'border-radius' ? R : F)[val]; if (!name) return m;
        n++; return pre + prop + sep + 'var(--ui-' + (prop === 'border-radius' ? 'r-' : 'fs-') + name + ')' + (imp || '');
      })
      .replace(/(^|[^-\w])(box-shadow)(\s*:\s*)([^;}{]+?)(\s*!important)?(?=\s*[;}])/g, (m, pre, prop, sep, val, imp) => {
        if (val.replace(/\s+/g, '') !== SHADOW_LG.replace(/\s+/g, '')) return m;
        n++; return pre + prop + sep + 'var(--ui-shadow-lg)' + (imp || '');
      });
  }
  return { text: parts.join(''), n };
}
const revert = t => t.replace(/var\((--ui-(?:r|fs)-[a-z0-9]+|--ui-shadow-lg)\)/g, (m, k) => tok[k] || m);

if (process.argv.includes('--verify')) {
  let bad = 0;
  for (const f of FILES) {
    const head = cp.execSync('git show HEAD:' + f, { cwd: ROOT, maxBuffer: 1 << 26 }).toString('utf8');
    const now = fs.readFileSync(path.join(ROOT, f), 'utf8');
    // so với bản gốc đã được CONVERT từ HEAD: ngược lại bản hiện tại thay ngược phải == HEAD (nếu file chưa có thay đổi nào khác ngoài R1b)
    const same = revert(now) === head; if (!same) { bad++; console.log('LỆCH ' + f); } else console.log('ok   ' + f);
  }
  process.exit(bad ? 1 : 0);
}
let total = 0;
for (const f of FILES) {
  const p = path.join(ROOT, f), src = fs.readFileSync(p, 'utf8'), r = convert(src);
  if (revert(r.text) !== src) { console.error('DỪNG: thay ngược ' + f + ' không ra file gốc'); process.exit(2); }
  if (r.n) fs.writeFileSync(p, r.text); total += r.n; console.log(f + ': ' + r.n + ' chỗ');
}
console.log('tổng ' + total + ' chỗ đã đổi sang --ui-*');
