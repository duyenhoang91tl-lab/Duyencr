// Test Node cho CHE DO TOI tu sinh (tools/gen-dark-theme.js -> css/99-dark-auto.css) + FONT toan CRM (Be Vietnam Pro). Khong can trinh duyet.
// Chay: node tools/test-dark-theme.js  -> "ALL DARK THEME TESTS PASSED" neu dat.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'); const R = f => fs.readFileSync(path.join(root, f), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const g = require('./gen-dark-theme.js');
const hex = c => /^#[0-9a-f]{6}$/.test(c);
const lum = h => { const n = parseInt(h.slice(1), 16), f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); };
const rgb = h => { const n = parseInt(h.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

// 1) file sinh ra khop nguon (quen chay lai sau khi doi mau cung se do o day)
const chk = cp.spawnSync('node', [path.join(__dirname, 'gen-dark-theme.js'), '--check'], { encoding: 'utf8' });
ok(chk.status === 0, 'css/99-dark-auto.css phai khop nguon — chay: node tools/gen-dark-theme.js\n' + chk.stderr);
// 2) anh xa mau: nen
ok(g.mapBg(rgb('#ffffff')) === 'var(--surface)' && g.mapBg(rgb('#fdfdfd')) === 'var(--surface)', 'nen trang -> --surface');
ok(g.mapBg(rgb('#fafafa')) === 'var(--surface2)', 'nen trang ngà (#fafafa) -> --surface2 (tach khoi the trang)');
ok(g.mapBg(rgb('#f3f4f6')) === 'var(--surface2)' && g.mapBg(rgb('#f1f5f9')) === 'var(--surface2)', 'nen xam rat nhat -> --surface2');
ok(g.mapBg(rgb('#e5e7eb')) === 'var(--surface3)', 'nen xam nhat -> --surface3');
for (const c of ['#fef3c7', '#dcfce7', '#fee2e2', '#dbeafe', '#ffedd5']) { const m = g.mapBg(rgb(c)); ok(hex(m) && lum(m) < 0.05, 'nen pha mau ' + c + ' -> mau toi cung sac: ' + m); }
ok(g.mapBg(rgb('#fef3c7')) !== g.mapBg(rgb('#dbeafe')), 'giu SAC: vang != xanh sau khi doi toi');
ok(g.mapBg(rgb('#16a34a')) === null && g.mapBg(rgb('#1d4ed8')) === null && g.mapBg(rgb('#0a7a3a')) === null, 'nen dac/dam (nut xanh, badge) GIU NGUYEN');
// 3) chu
ok(g.mapText(rgb('#111827')) === 'var(--text)' && g.mapText(rgb('#374151')) === 'var(--text)' && g.mapText(rgb('#222222')) === 'var(--text)', 'chu toi trung tinh -> --text');
ok(g.mapText(rgb('#6b7280')) === 'var(--muted)', 'chu xam -> --muted');
ok(g.mapText(rgb('#ffffff')) === null && g.mapText(rgb('#e5e7eb')) === null, 'chu sang GIU NGUYEN');
const SURF = '#1d1f26';   // --surface cua che do toi (css/10-dark.css)
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
for (const c of ['#9a3412', '#166534', '#92400e', '#991b1b', '#1d4ed8', '#4a2c8f']) { const m = g.mapText(rgb(c)); ok(hex(m) && contrast(m, SURF) >= 4.5, 'chu mau toi ' + c + ' -> do tuong phan >= 4.5:1 tren nen toi (WCAG AA): ' + m + ' = ' + contrast(m, SURF).toFixed(1)); }
// nen pha toi phai du toi de chu sang doc duoc tren do
for (const c of ['#fef3c7', '#dcfce7', '#fee2e2', '#dbeafe', '#ffedd5']) { const m = g.mapBg(rgb(c)), t = g.mapText(rgb({ '#fef3c7': '#92400e', '#dcfce7': '#166534', '#fee2e2': '#991b1b', '#dbeafe': '#1e40af', '#ffedd5': '#9a3412' }[c])); ok(contrast(m, t) >= 4.5, 'cap nen pha ' + c + ' + chu di kem: tuong phan ' + contrast(m, t).toFixed(1)); }
// 4) vien
ok(g.mapBorder(rgb('#e5e7eb')) === 'var(--border-md)' && g.mapBorder(rgb('#ffffff')) === 'var(--border-md)', 'vien sang -> --border-md');
ok(g.mapBorder(rgb('#16a34a')) === null, 'vien dam GIU NGUYEN');
// 5) ngu canh: chu tren nen KHONG doi thi chu cung giu nguyen (tranh chu toi tren nen vang dam bi sang len)
ok(JSON.stringify(g.darkDecls([['background', '#7fbf93'], ['color', '#14532d']])) === '[]', 'nen xanh TRUNG BINH (giu nguyen) + chu xanh dam: chu cung giu nguyen (khong bi sang len tren nen sang vua)');
ok(g.darkDecls([['background', '#fbbf24'], ['color', '#78350f']]).length === 2, 'nen vang sang + chu nau: ca hai doi (nen -> vang toi, chu -> vang sang) nen van tuong phan');
const both = g.darkDecls([['background', '#fef3c7'], ['color', '#92400e']]); ok(both.length === 2 && hex(both[0][1]) && hex(both[1][1]), 'nen pha vang + chu nau: doi ca hai');
ok(g.darkDecls([['color', '#111827']])[0][1] === 'var(--text)', 'chi co chu (nen ke thua): van doi');
ok(g.darkDecls([['border', '1px solid #e5e7eb']])[0].join('=') === 'border-color=var(--border-md)', 'border shorthand -> border-color');
ok(g.darkDecls([['border-bottom', '2px solid #d1d5db']])[0][0] === 'border-bottom-color', 'border-bottom shorthand');
const grad = g.darkDecls([['background', 'linear-gradient(180deg,#7fbf93 0%,#d3ecd9 28%,#eef1f5 62%)']])[0][1];
ok(!/#7fbf93|#d3ecd9|#eef1f5/.test(grad) && (grad.match(/#[0-9a-f]{6}|var\(--[a-z0-9]+\)/g) || []).length === 3, 'gradient: doi CA diem trung binh (#7fbf93) khi co diem sang, khong con dau sang: ' + grad);
// 6) bien mau tuy chinh theo ten + bien "muc" dung lam nen thuong hieu
const vars = g.darkDecls([['--pro-line', '#e6e3ee'], ['--pro-soft', '#f5f3fa'], ['--pro-grey', '#c9c6d1'], ['--pro-ink', '#1b1740'], ['--accent', '#1d4ed8']]);
const vm = Object.fromEntries(vars); ok(vm['--pro-line'] === 'var(--border-md)' && vm['--pro-grey'] === 'var(--surface3)', 'bien --pro-line/grey doi theo vai tro');
// --pro-soft: da CHINH TAY trong css/10-dark.css (html.ui-pro[data-theme=dark] { --pro-soft:#0f1a12 }) -> bo sinh tu dong KHONG ghi de (HAND_VARS), tranh 2 nguon mau xung dot
ok(vm['--pro-soft'] === undefined && /--pro-soft\s*:/.test(fs.readFileSync(path.join(__dirname, '..', 'css', '10-dark.css'), 'utf8')), 'bien --pro-soft da chinh tay o 10-dark.css -> khong sinh them');
ok(!('--pro-ink' in vm) && !('--accent' in vm), '--pro-ink KHONG doi gia tri (dang lam nen thanh tab); bien khong ro vai tro khong dong vao');
ok(g.darkDecls([['color', 'var(--pro-ink)']])[0][1] === 'var(--text)' && g.darkDecls([['color', 'var(--pro-blue)']])[0][1] === '#7eb0ff' && g.darkDecls([['fill', 'var(--pro-ink)']])[0][1] === 'var(--text)', 'DUNG bien muc lam mau chu -> mau chu sang');
ok(g.darkDecls([['background', 'linear-gradient(90deg,var(--pro-ink),var(--pro-purple))']]).length === 0, 'DUNG bien muc lam NEN (gradient thanh tab) khong bi doi');
// 7) bo phan tich CSS
const pr = g.parseCss('/* c */ .a, .b > i{background:#fff;color:#111 !important} @media (max-width:600px){.c{color:#222}} @keyframes k{from{color:#fff}} @font-face{src:url(data:x;base64,AA)} .d{background:url("a;b.png") #fff}');
ok(pr.length === 3 && pr[0].sel.length === 2 && pr[0].decls.length === 2 && pr[0].decls[1][1] === '#111', 'parser: danh sach selector, !important, comment');
ok(pr[1].at && pr[1].children[0].sel[0] === '.c', 'parser: @media long nhau'); ok(!pr.some(x => x.at && /keyframes|font-face/.test(x.at)), 'parser: bo qua @keyframes/@font-face');
ok(pr[2].decls[0][1].includes('url("a;b.png")'), 'parser: dau ; trong chuoi/url khong cat khai bao');
// 8) file sinh ra: MOI quy tac chi co hieu luc o che do toi (khong lam doi che do sang)
const css = R('css/99-dark-auto.css').replace(/\/\*[\s\S]*?\*\//g, ''); const lines = css.split('\n').filter(l => l && !l.startsWith('/*') && !l.startsWith('@') && !/^\s*\}/.test(l));
const bad = lines.filter(l => !l.trimStart().startsWith('html[data-theme="dark"]')); ok(bad.length === 0, 'quy tac KHONG co tien to che do toi (se doi ca che do sang): ' + (bad[0] || '').slice(0, 120));
ok(lines.length > 200, 'so quy tac: ' + lines.length);
ok(!/:root\s*\{/.test(css), 'khong ghi de :root');
// 9) thu tu nap + ten thuoc tinh thong nhat voi bo chuyen che do
const idx = R('index.html'); const links = [...idx.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);   // bo ?v=... (tham so phien ban)
ok(links[links.length - 1] === 'css/99-dark-auto.css', 'css/99-dark-auto.css phai nap SAU CUNG (de thang cac quy tac khac): ' + links.slice(-2).join(','));
ok(links.indexOf('css/10-dark.css') < links.indexOf('css/99-dark-auto.css') && links.every(l => fs.existsSync(path.join(root, l))), 'moi file css duoc link deu ton tai');
ok(/html\[data-theme="dark"\]/.test(R('css/10-dark.css')) && /data-theme/.test(R('js/43-fn-uxtools.js')), 'bo chuyen che do dung thuoc tinh data-theme');
ok(/css\/99-dark-auto\.css/.test(R('tools/build-dist.js')) || /gen-dark-theme/.test(R('tools/build-dist.js')), 'build-dist sinh lai lop che do toi truoc khi nen');
// 9b) phan tu gan style bang JS cssText (generator khong bat duoc) phai co ngoai le thu cong; moi cho `style.cssText='...#hex...'` phai nam trong danh sach da biet
const dk = R('css/10-dark.css');
for (const id of ['sync-err-banner', 'row-err-banner', 'dp-refresh-hint', 'deploy-guide-banner']) ok(dk.includes('#' + id), 'ngoai le thu cong cho #' + id + ' trong css/10-dark.css');
const known = ['sync-err-banner', 'row-err-banner', 'dp-refresh-hint', 'deploy-guide-banner', 'bar.style'];   // img (vien thumbnail) khong can
const jsDir = path.join(root, 'js'); const unknownCss = [];
for (const f of fs.readdirSync(jsDir).filter(x => x.endsWith('.js'))) { const t = R('js/' + f); for (const m of t.matchAll(/(\w+)\.style\.cssText\s*=\s*['"`][^'"`]*(?:background|border)[^'"`]*#[0-9a-fA-F]{3,6}/g)) { const ctx = t.slice(Math.max(0, m.index - 400), m.index); if (!known.some(k => ctx.includes(k))) unknownCss.push(f + ':' + m[1]); } }
// chi canh bao (khong lam do): cho moi nay co the can ngoai le; hien ra de nguoi sua biet
if (unknownCss.length) console.log('LUU Y: cssText co nen/vien hex chua co ngoai le che do toi:', unknownCss.join(', '));
// 10) FONT: Be Vietnam Pro toan CRM
ok(/fonts\.googleapis\.com\/css2\?family=Be\+Vietnam\+Pro:wght@400;500;600;700[^"]*display=swap/.test(idx), 'index.html nap Be Vietnam Pro 400/500/600/700 voi display=swap');
const base = R('css/01-base.css');
ok(/--font:'Be Vietnam Pro',system-ui/.test(base) && /body\{font-family:var\(--font\)/.test(base), 'body dung var(--font) = Be Vietnam Pro, co font he thong du phong');
ok(/button,input,select,textarea,optgroup\{font-family:inherit/.test(base), 'o nhap/nut ke thua font (mac dinh trinh duyet dung font he thong rieng)');
ok(!/body\{font-family:-apple-system/.test(base), 'khong con font he thong cu o body');
console.log('ALL DARK THEME TESTS PASSED');
