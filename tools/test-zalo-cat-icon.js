// Kiểm tra mặt Samoyed trong extension Zalo AI: nút nổi + header + popup (giống CRM / Pancake AI).
const fs = require('fs'), vm = require('vm');
let ok = 0, bad = 0;
const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };
const js = fs.readFileSync('extension-zalo/zalo-content.js', 'utf8');
t('nút nổi dùng zaiCatSvg_', js.includes("toggle.innerHTML = zaiCatSvg_(34, false)") && !js.includes("toggle.textContent = '🤖 AI'"));
t('header dùng zaiCatSvg_', js.includes('${zaiCatSvg_(24, false)}') && !js.includes('zai-hdr-title">🤖'));
const m = js.match(/  function zaiCatSvg_[\s\S]*?\n  \}\n/);
t('tách được zaiCatSvg_', !!m);
const ctx = {}; vm.createContext(ctx); vm.runInContext(m[0] + ';this.f=zaiCatSvg_;', ctx);
const svg = ctx.f(24, true);
t('svg hợp lệ', svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.includes('width="24"'));
t('có chớp mắt khi blink', svg.includes('<animate') && !ctx.f(24, false).includes('<animate'));
t('class zai-cat, không còn pro-/pk-', svg.includes('class="zai-cat"') && !svg.includes('pro-cat') && !svg.includes('pk-cat'));
t('là Samoyed: lưỡi hồng + thẻ tên vàng, không ăng-ten', svg.includes('#ff8fa6') && svg.includes('class="zai-cat-ant"') && !svg.includes('y2="8.6"'));
console.log(ok + '/' + (ok + bad)); process.exit(bad ? 1 : 0);
