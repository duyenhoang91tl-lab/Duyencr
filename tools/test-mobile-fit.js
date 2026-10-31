#!/usr/bin/env node
// Test "vừa màn điện thoại" (css/15-mobile.css + js/59-fn-mobilefit.js): thanh trên không tràn, các lớp theo chiều cao thật của thanh trên.
// Chạy: node tools/test-mobile-fit.js -> "ALL MOBILE FIT TESTS PASSED". Phần DOM cần jsdom. (Không đo bố cục thật được — jsdom không tính layout — nên test kiểm LUẬT CSS + logic; hình dáng thật cần ảnh chụp.)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const { mobileFitHeaderH_, mobileFitAppH_, MOBILE_FIT_MAX_W } = require(path.join(ROOT, 'js', '59-fn-mobilefit.js'));

// ===== logic thuần =====
ok(MOBILE_FIT_MAX_W === 640, 'ngưỡng 640px (khớp @media của CSS)');
ok(mobileFitHeaderH_(360, 118) === 118 && mobileFitHeaderH_(412, 117.6) === 118 && mobileFitHeaderH_(640, 50) === 50, 'điện thoại: lấy chiều cao thật (làm tròn)');
ok(mobileFitHeaderH_(641, 118) === null && mobileFitHeaderH_(1400, 50) === null, 'màn rộng: không đặt biến (dùng 50px mặc định)');
ok(mobileFitHeaderH_(360, 0) === null && mobileFitHeaderH_(360, NaN) === null && mobileFitHeaderH_(360, 900) === null && mobileFitHeaderH_(0, 100) === null && mobileFitHeaderH_(undefined, 100) === null, 'chưa đo được / bất thường: không đặt');

// ===== chiều cao khung .app =====
ok(mobileFitAppH_(360, 722, 118) === 604 && mobileFitAppH_(411, 410, 50) === 360 && mobileFitAppH_(360, 700, 0) === 700, '.app = innerHeight - chiều cao thanh trên thật (thanh trên ẩn -> đủ innerHeight)');
ok(mobileFitAppH_(360, 0, 118) === null && mobileFitAppH_(360, 119, 50) === null && mobileFitAppH_(1280, 800, 50) === null && mobileFitAppH_(0, 800, 50) === null, 'WebView chưa có kích thước (innerHeight 0) / màn rộng: không đặt — để luật của app/CSS lo');
ok(mobileFitAppH_(360, 400, 500) === 400 && mobileFitAppH_(360, 150, 100) === null, 'thanh trên đo bất thường -> bỏ qua; còn quá thấp (<80px) -> không đặt');

// ===== CSS =====
const raw = fs.readFileSync(path.join(ROOT, 'css', '15-mobile.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
ok(/^@media \(max-width:640px\)\{/.test(css) && css.endsWith('}'), 'toàn bộ luật nằm trong 1 khối @media (max-width:640px) -> máy tính không bị ảnh hưởng');
let depth = 0, minDepth = 99; for (const ch of css) { if (ch === '{') depth++; else if (ch === '}') depth--; if (depth < 1 && ch !== '}' ) minDepth = Math.min(minDepth, depth); } ok(depth === 0, 'ngoặc cân bằng');
const inner = css.slice(css.indexOf('{') + 1, css.lastIndexOf('}'));
const rules = inner.split('}').map(r => r.trim()).filter(Boolean).map(r => { const i = r.indexOf('{'); return { sel: r.slice(0, i).trim(), body: r.slice(i + 1) }; });
const R = sel => rules.filter(r => r.sel.split(',').map(s => s.trim()).includes(sel));
ok(R('header').some(r => /flex-wrap:wrap/.test(r.body) && /height:auto/.test(r.body)), 'thanh trên xuống dòng + cao tự do');
ok(R('header>*').some(r => /min-width:0/.test(r.body)), 'mọi phần tử con thanh trên được phép co (min-width:0)');
ok(R('#sn-toggle').some(r => /overflow:hidden/.test(r.body) && /text-overflow:ellipsis/.test(r.body)), 'nút Menu · tên màn cắt "…" thay vì tràn');
ok(R('#qs-wrap').some(r => /flex:0 0 42%/.test(r.body)) && R('header .hdr-r').some(r => /flex-wrap:wrap/.test(r.body)), 'ô Tìm nhanh 42%, cụm nút tài khoản xuống dòng được');
ok(R('header .logo span').some(r => /display:none/.test(r.body)) && R('header .fstatus').some(r => /display:none/.test(r.body)), 'ẩn nhãn phiên bản + dòng trạng thái trên điện thoại');
for (const sel of ['.sidebar-backdrop', '#sn-backdrop', '.sidebar', '#data-view .tabs', 'html.ui-pro #pro-ai']) ok(R(sel).some(r => /top:var\(--hdr-h,50px\)/.test(r.body)), sel + ' theo chiều cao thật của thanh trên (--hdr-h)');
ok(R('.app').some(r => /height:calc\(100dvh - var\(--hdr-h,50px\)\)/.test(r.body) && /height:calc\(100vh - var\(--hdr-h,50px\)\)/.test(r.body)), '.app: có 100vh dự phòng + 100dvh, trừ chiều cao thật');
ok(R('html.ui-pro #pro-dock').some(r => /right:12px/.test(r.body)), 'nút robot AI nằm gọn mép phải');
ok(R('.sc-dock').some(r => /width:100%/.test(r.body) && /max-width:100%/.test(r.body)), 'cột hồ sơ khách cạnh khung chat (rộng cố định 380–440px) vừa bề ngang điện thoại');
ok(!/(^|[^-])html\s*\{[^}]*overflow/.test(css) && !/overflow-x:\s*clip/.test(css), 'KHÔNG đụng overflow của html (sẽ làm hỏng cuộn trang)');
ok(!/body\s*\{/.test(css), 'không ghi đè body (đã có body{overflow-x:hidden} ở css/01-base.css)');

// ===== đã nối vào index.html, nạp SAU css/01-base,05,06,13 =====
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const pos = n => idx.indexOf(n);
ok(pos('css/15-mobile.css') > pos('css/13-shell.css') && pos('css/15-mobile.css') > pos('css/06-pro.css') && pos('css/15-mobile.css') > pos('css/05-sidenav.css') && pos('js/59-fn-mobilefit.js') > 0, 'index.html nạp CSS sau các CSS nó ghi đè + nạp script');

let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bỏ qua phần DOM: chưa cài jsdom)'); console.log('ALL MOBILE FIT TESTS PASSED (chỉ logic + CSS)'); process.exit(0); }
const src = fs.readFileSync(path.join(ROOT, 'js', '59-fn-mobilefit.js'), 'utf8');
const wait = (ms) => new Promise(r => setTimeout(r, ms || 20));
function boot(width, h, withRO, innerH) {
  const dom = new JSDOM('<html><body><header></header><div class="app"></div></body></html>', { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window; let height = h;
  Object.defineProperty(w, 'innerWidth', { value: width, configurable: true, writable: true });
  Object.defineProperty(w, 'innerHeight', { value: innerH === undefined ? 700 : innerH, configurable: true, writable: true });
  Object.defineProperty(w.document.querySelector('header'), 'offsetHeight', { get: () => height });
  w.__setH = v => { height = v; };
  w.__roCalls = 0;
  if (withRO) w.ResizeObserver = function (cb) { this.observe = () => { w.__roCb = cb; }; };
  w.eval(src); return w;
}
const val = w => w.document.documentElement.style.getPropertyValue('--hdr-h');
(async () => {
  let w = boot(360, 118, true); await wait();
  ok(val(w) === '118px', 'điện thoại: đặt --hdr-h = chiều cao thật: ' + val(w));
  w.__setH(150); w.__roCb(); ok(val(w) === '150px', 'thanh trên đổi cao (nút thêm sau đăng nhập): ResizeObserver cập nhật lại');
  w.innerWidth = 1280; w.dispatchEvent(new w.Event('resize')); ok(val(w) === '', 'phóng to ra màn rộng: bỏ biến (về 50px mặc định)');
  w.innerWidth = 400; w.dispatchEvent(new w.Event('resize')); ok(val(w) === '150px', 'thu lại điện thoại: đặt lại');
  w = boot(1400, 50, false); await wait(); ok(val(w) === '', 'máy tính: không đặt biến');
  w = boot(360, 96, false); await wait(); ok(val(w) === '96px', 'không có ResizeObserver: vẫn đo lúc nạp'); w.__setH(130); await wait(900); ok(val(w) === '130px', 'không có ResizeObserver: đo lại sau 0.8s');
  w = boot(360, 118, true); w.document.querySelector('header').remove(); w.mobileFitApply(); ok(val(w) === '', 'không có thanh trên (chưa dựng xong): không lỗi, không đặt');
  // khung .app: inline !important, thắng luật !important của app Android (.app{height:(innerHeight-50)px!important})
  w = boot(360, 118, true, 722); await wait(); const app = () => w.document.querySelector('.app');
  ok(app().style.getPropertyValue('height') === '604px' && app().style.getPropertyPriority('height') === 'important', '.app = 722 - 118 = 604px, inline !important');
  const st = w.document.createElement('style'); st.textContent = '.app{height:672px!important}'; w.document.head.appendChild(st);   // luật app chèn: innerHeight-50
  w.mobileFitApply(); ok(app().style.getPropertyValue('height') === '604px', 'luật app (672px, giả định thanh trên 50px) KHÔNG đè được: vẫn 604px');
  w.__setH(150); w.__roCb(); ok(app().style.getPropertyValue('height') === '572px', 'thanh trên cao thêm: khung co lại cho khớp');
  w.innerHeight = 500; w.dispatchEvent(new w.Event('resize')); ok(app().style.getPropertyValue('height') === '350px', 'xoay/đổi kích thước: cập nhật');
  w.innerHeight = 0; w.dispatchEvent(new w.Event('resize')); ok(app().style.getPropertyValue('height') === '', 'WebView chưa có kích thước (innerHeight 0): không đặt, để luật khác lo');
  w.innerHeight = 800; w.innerWidth = 1280; w.dispatchEvent(new w.Event('resize')); ok(app().style.getPropertyValue('height') === '', 'màn rộng: bỏ style inline');
  w = boot(1400, 50, false, 900); await wait(); ok(w.document.querySelector('.app').style.getPropertyValue('height') === '', 'máy tính: không đặt chiều cao');
  w = boot(360, 118, true, 722); w.document.querySelector('.app').remove(); w.mobileFitApply(); ok(true, 'chưa có .app: không lỗi');
  console.log('ALL MOBILE FIT TESTS PASSED');
})().catch(e => { console.error('LOI:', e); process.exit(1); });
