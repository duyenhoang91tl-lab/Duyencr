// Kiểm tra mèo máy trong extension Pancake AI: header, nút thu nhỏ, popup.
const fs = require('fs'), vm = require('vm');
let ok = 0, bad = 0;
const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };
const js = fs.readFileSync('extension-pancake/pancake-content.js', 'utf8');
const popup = fs.readFileSync('extension-pancake/pancake-popup.html', 'utf8');
t('header dùng pkCat_', js.includes('${pkCat_(24)}') && !js.includes('🤖 Pancake AI</div>'));
t('nút thu nhỏ dùng mèo', js.includes('btn.innerHTML = pkCat_(26)'));
t('popup có svg mèo', /<h1[^>]*><svg/.test(popup) && !popup.includes('🤖 Duyên AI'));
const m = js.match(/function pkCatSvg_[\s\S]*?\n  \}\n/);
t('tách được pkCatSvg_', !!m);
const ctx = {}; vm.createContext(ctx); vm.runInContext(m[0] + ';this.f=pkCatSvg_;', ctx);
const svg = ctx.f(24, true);
t('svg hợp lệ', svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.includes('width="24"'));
t('có chớp mắt khi blink', svg.includes('<animate') && !ctx.f(24, false).includes('<animate'));
t('không còn class pro-', !svg.includes('pro-cat'));
t('là mặt Samoyed như CRM: có lưỡi + thẻ tên vàng pk-cat-ant, KHÔNG còn ăng-ten', svg.includes('#ff8fa6') && svg.includes('class="pk-cat-ant"') && !svg.includes('y2="8.6"'));
console.log(ok + '/' + (ok + bad)); process.exit(bad ? 1 : 0);
