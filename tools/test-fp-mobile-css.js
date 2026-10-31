// Test CSS dien thoai cua o mau loc nhanh (css/10-filter-presets.css, 31/10/2026). Khong co trinh duyet nen kiem tra RANG BUOC quan trong trong CSS. Chay: node tools/test-fp-mobile-css.js
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', '10-filter-presets.css'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const media = (q) => { const i = css.indexOf(q); if (i < 0) return ''; let d = 0, j = css.indexOf('{', i); for (let k = j; k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}' && --d === 0) return css.slice(j + 1, k); } return ''; };
const small = media('@media (max-width:640px)'), coarse = media('@media (pointer:coarse)');
ok(/\.fp-gear\{[^}]*max-width:calc\(100vw - 16px\)/.test(css), 'menu mau: toi da bang man hinh tru 16px (khong tran)');
ok(/\.fp-ctl\{[^}]*flex:1 1 100%/.test(small), 'dien thoai: cum mau chiem tron 1 hang');
ok(/\.fp-sel\{[^}]*max-width:none/.test(small) && /min-height:36px/.test(small), 'dien thoai: o chon mau rong + cao >= 36px de cham');
ok(/\.fp-gear\{[^}]*min-width:0/.test(small), 'dien thoai: bo min-width 250px cua menu mau');
ok(/\.fp-gear \.fp-mn\{[^}]*max-width:62vw/.test(small), 'dien thoai: ten mau dai bi gioi han (ellipsis co san o .fp-mn)');
ok(/\.fp-gear \.fp-mrow \.fp-ic\{[^}]*padding:9px 11px/.test(coarse), 'man cam ung: nut sua/xoa mau du to');
ok(/\.fp-gear \.fp-mn\{[^;}]*overflow:hidden;text-overflow:ellipsis/.test(css) || /\.fp-mn\{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis/.test(css), 'ten mau co ellipsis (khong day nut ra ngoai)');
let d = 0; for (const ch of css) { if (ch === '{') d++; else if (ch === '}') d--; } ok(d === 0, 'CSS can ngoac { } (khong thieu/thua)');
console.log(fail ? 'CO LOI' : 'ALL FP MOBILE CSS TESTS PASSED'); process.exit(fail ? 1 : 0);
