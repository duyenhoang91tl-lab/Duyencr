// Test CSS dien thoai cua thanh "Mau loc nhanh" (css/10-filter-presets.css buoc 2). Chay: node tools/test-fp-mobile-css.js
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', '10-filter-presets.css'), 'utf8');
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const m = css.indexOf('@media (max-width:640px){'); ok(m > 0, 'co khoi @media (max-width:640px)');
let d = 0, end = -1; for (let k = css.indexOf('{', m); k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}') { d--; if (!d) { end = k; break; } } }
const mob = css.slice(m, end + 1), desk = css.slice(0, m) + css.slice(end + 1);
const rule = (src, sel) => { const i = src.indexOf(sel + '{'); if (i < 0) return ''; return src.slice(i, src.indexOf('}', i)); };
ok(/flex:1 1 100%/.test(rule(mob, '.fp-ctl')), 'dien thoai: o mau chiem tron 1 hang (.fp-ctl 100%)');
const sel = rule(mob, '.srb-bar .fp-sel');
ok(/max-width:none/.test(sel) && /min-width:0/.test(sel) && /min-height:38px/.test(sel), 'o chon mau: gian het hang, cao >=38px, khong bi max-width:230px cua .srb-bar select');
ok(/font-size:16px !important/.test(sel) && /padding:6px 10px !important/.test(sel), 'ghi de duoc font/padding !important cua .srb-bar select (16px de iOS khong phong to)');
ok(/width:min\(320px,calc\(100vw - 16px\)\)/.test(rule(mob, '.fp-gear')) && /min-width:0/.test(rule(mob, '.fp-gear')), 'menu mau: rong toi da 320px nhung khong vuot man hinh (bo min-width:250px)');
ok(/min-width:40px/.test(rule(mob, '.fp-gear .fp-mrow .fp-ic')) && /min-height:40px/.test(rule(mob, '.fp-gear .fp-mrow .fp-ic')), 'nut sua/ghi de/xoa mau cao >=40px de cham');
ok(/text-overflow:ellipsis/.test(sel) && /text-overflow:ellipsis/.test(rule(mob, '.fp-go')) && /overflow:hidden/.test(rule(mob, '.fp-one')), 'ten mau dai bi cat bang "…" (o chon, the mau, nut 1 mau)');
ok(/\.fp-gear \.fp-mn\{[^}]*padding:11px 0/.test(mob) && /\.fp-mn\{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis/.test(desk), 'ten trong danh sach quan ly: co dem cham + van cat "…" (luat goc giu nguyen)');
// may tinh khong doi
ok(/\.fp-gear\{min-width:250px;\}/.test(desk) && /\.fp-sel\{max-width:210px;/.test(desk), 'may tinh giu nguyen: .fp-gear min-width 250, .fp-sel max-width 210');
ok(!/@media/.test(desk.replace(/\/\*[\s\S]*?\*\//g, '')), 'khong co @media nao khac lam doi may tinh');
ok(/css\/10-filter-presets\.css\?v=20261031a/.test(idx), 'index.html da doi ?v= de tranh cache CSS cu');
process.exit(fail ? 1 : 0);
