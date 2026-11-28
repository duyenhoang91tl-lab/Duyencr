// Test R5c — tìm kiếm thông minh (js/69-pro-smart-search.js). Logic thuần + (nếu có jsdom) hộp gợi ý. File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), path = require('path');
const m = require('../js/69-pro-smart-search.js'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const N = m.ssNormQuery_;
ok(m.ssFold_('Nguyễn Văn Đạt ') === 'nguyen van dat', 'bỏ dấu + đ→d + gọn khoảng trắng');
ok(N('').kind === 'empty' && N('   ').kind === 'empty', 'rỗng');
ok(N('0912 345 678').kind === 'phone' && N('0912 345 678').phone === '0912345678', 'SĐT có dấu cách');
ok(N('0912.345.678').phone === '0912345678' && N('0912-345-678').phone === '0912345678' && N('(0912) 345678').phone === '0912345678', 'SĐT có . - ( )');
ok(N('+84 912 345 678').phone === '0912345678' && N('+84912345678').q === '0912345678', '+84 → 0');
ok(N('84912345678').phone === '0912345678', '84xxxxxxxxx (11 số) → 0');
ok(N('0912').kind === 'phone' && N('0912').phone === '0912', 'gõ dở ≥4 số vẫn là SĐT');
ok(N('091').kind === 'text' && N('091').q === '091', '<4 số: chưa coi là SĐT (giữ kiểu cũ)');
ok(N('162T10').kind === 'mixed', 'mã đơn (chữ + số) → mixed');
ok(N('nguyen van').kind === 'text' && N('nguyen van').tokens.join() === 'nguyen,van', 'tên → tách từ');
ok(N('Nguyễn  VĂN').fold === 'nguyen van', 'hoa/thường + dấu');
const C = [
  { phone: '0912345678', name: 'Nguyễn Văn An', nameLower: 'nguyễn văn an', totalOrders: 5 },
  { phone: '0987654321', name: 'Trần Thị Bình', nameLower: 'trần thị bình', totalOrders: 1, cskhNameLower: 'bình tt|chị bình' },
  { phone: '0912000111', name: 'Văn Nguyễn', nameLower: 'văn nguyễn', totalOrders: 9 },
  { phone: '0333444555', name: 'Đặng Quốc Anh', nameLower: 'đặng quốc anh', totalOrders: 0 },
];
const M = (q) => C.filter(c => m.ssMatchText_(c, N(q))).map(c => c.phone);
ok(M('nguyen van').join() === '0912345678,0912000111', 'tên KHÔNG dấu khớp tên CÓ dấu, mọi thứ tự từ');
ok(M('NGUYỄN').length === 2 && M('dang quoc').join() === '0333444555', 'có dấu / hoa; đ ↔ d');
ok(M('0912 345 678').join() === '0912345678' && M('+84 912 345 678').join() === '0912345678', 'SĐT nhiều kiểu → đúng khách');
ok(M('0912').join() === '0912345678,0912000111', 'SĐT khớp phần đầu');
ok(M('chi binh').join() === '0987654321', 'khớp cả tên CSKH khác (bỏ dấu)');
ok(M('khong co').length === 0 && M('xyz123').length === 0, 'không khớp → rỗng');
ok(M('').length === 4, 'ô rỗng → mọi khách');
// Gợi ý
const S = (q, lim) => m.ssSuggest_(C, N(q), lim, null).map(x => x.c.phone);
ok(S('nguyen van').join() === '0912000111,0912345678' || S('nguyen van').join() === '0912345678,0912000111', 'gợi ý đủ 2 khách');
ok(S('van nguyen')[0] === '0912000111', 'tên trùng đúng thứ tự (điểm cao) lên đầu');
ok(S('0912')[0] === '0912345678' || S('0912')[0] === '0912000111', 'gợi ý theo SĐT');
ok(S('0912').join() === '0912000111,0912345678', 'hoà điểm → nhiều đơn hơn trước (9 đơn > 5 đơn)');
ok(S('0912345678').join() === '0912345678', 'SĐT đủ → đúng 1 khách');
ok(S('a').length === 0 && S('162T10').length === 0 && S('').length === 0, 'quá ngắn / giống mã đơn / rỗng → không gợi ý');
ok(S('nguyen', 1).length === 1, 'giới hạn số gợi ý');
ok(m.ssSuggest_(C, N('nguyen'), 8, c => c.phone === '0912000111').map(x => x.c.phone).join() === '0912000111', 'tôn trọng phạm vi quyền (inScope)');
const many = Array.from({ length: 5000 }, (_, i) => ({ phone: '09' + String(10000000 + i), name: 'Khách ' + i, nameLower: 'khách ' + i, totalOrders: i % 7 }));
let t0 = Date.now(); const r = m.ssSuggest_(many, N('khach'), 8, null); ok(r.length === 8 && Date.now() - t0 < 500, 'quét 5.000 khách giữ top 8 nhanh');
const big = Array.from({ length: 136000 }, (_, i) => ({ phone: '09' + String(10000000 + i), name: 'Khách Hàng ' + i, nameLower: 'khách hàng ' + i, totalOrders: i % 7 }));
t0 = Date.now(); m.ssSuggest_(big, N('khach hang'), 8, null); const t1 = Date.now() - t0; t0 = Date.now(); m.ssSuggest_(big, N('khach hang'), 8, null); ok(Date.now() - t0 < 600, '136.000 khách: lần 2 (đã cache bỏ dấu) < 600ms; lần 1 = ' + t1 + 'ms');
const xs = [{ phone: '09"x', name: '<b>An</b>', nameLower: '<b>an</b>', totalOrders: 2 }]; const h = m.ssSuggestHtml_(m.ssSuggest_(xs, N('an'), 8, null));
ok(h.includes('&lt;b&gt;An&lt;/b&gt;') && !h.includes('<b>An</b>') && h.includes('&quot;'), 'escape tên/SĐT trong HTML gợi ý');
// ── 18/11/2026: gợi ý thêm SẢN PHẨM / COMBO (Thư viện sản phẩm, js/94) trong ô tìm khách ──
global.plibSearch = (q, lim) => [{ name: 'Nhẫn Kim Tiền', group: 'Nhẫn', combo: false, n: 3, hasInfo: true, viaInfo: false }, { name: 'Combo: Tết <b>', group: 'Combo', combo: true, n: 0, hasInfo: false, viaInfo: true }];
ok(m.ssProdSuggest_(N('kim tien')).length === 2, 'ssProdSuggest_: chữ → ra SP/combo');
ok(m.ssProdSuggest_(N('0912345678')).length === 0 && m.ssProdSuggest_(N('162T10')).length === 0 && m.ssProdSuggest_(N('k')).length === 0, 'SĐT / mã đơn / 1 ký tự → không gợi ý SP');
const ph = m.ssProdHtml_(m.ssProdSuggest_(N('kim tien')), 0);
ok(ph.includes('data-pn="Nhẫn Kim Tiền"') && ph.includes('3 ảnh · 📝') && ph.includes('🎁') && ph.includes('chưa có ảnh · khớp trong thông tin'), 'ssProdHtml_: tên, số ảnh, 📝, combo, khớp trong thông tin');
ok(!ph.includes('<b>') || ph.includes('&lt;b&gt;'), 'escape tên combo'); ok(/css-pl on/.test(ph) && !/css-pl on/.test(m.ssProdHtml_(m.ssProdSuggest_(N('kim tien')), 2)), 'dòng đầu "on" chỉ khi không có khách phía trên');
delete global.plibSearch; ok(m.ssProdSuggest_(N('kim tien')).length === 0, 'thiếu js/94 → không lỗi, không hiện');
// Nối vào applyFilters / exportCSV (kiểm bằng mã nguồn: tránh quên móc)
const j02 = fs.readFileSync(path.join(__dirname, '..', 'js/02-fn-showrowerrorbanner.js'), 'utf8'), j05 = fs.readFileSync(path.join(__dirname, '..', 'js/05-fn-saveeditphone.js'), 'utf8');
if (/ssNormQuery_/.test(j02)) { ok(/ssMatchText_\(c, *_sn\)/.test(j02), 'applyFilters (js/02) dùng ssMatchText_'); ok(/ssMatchText_\(c, *_sn\)/.test(j05), 'exportCSV (js/05) dùng ssMatchText_'); } else console.log('skip  (js/02, js/05 chưa nối — bước B)');
// Hộp gợi ý trên DOM thật (cần jsdom)
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP DOM: chưa cài jsdom'); }
if (JSDOM) {
  const dom = new JSDOM('<body><div class="search-wrap"><input id="search-input"><div id="ord-search-res" style="display:none"></div></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true }), w = dom.window;
  w.allCustomers = C; w.opened = []; w.openDp = p => w.opened.push(p);
  w.eval(fs.readFileSync(path.join(__dirname, '..', 'js/69-pro-smart-search.js'), 'utf8').replace(/if \(typeof module[^\n]*\n?$/, ''));
  if (w.ssInit_) w.ssInit_();   // js/69 chi tu khoi tao khi readyState != 'loading'; jsdom dang 'loading' ngay sau new JSDOM => goi tay (ssInit_ co chot inp._ssInit nen an toan)
  const inp = w.document.getElementById('search-input'), box = () => w.document.getElementById('cust-suggest');
  ok(!!box() && box().style.display === 'none', 'DOM: tạo #cust-suggest, ban đầu ẩn');
  w.ssInit_ && 0; inp.value = 'nguyen van'; w.ssRender_();
  ok(box().style.display === 'block' && box().querySelectorAll('.css-i').length === 2, 'DOM: gõ tên không dấu → 2 gợi ý');
  inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  ok(box().querySelectorAll('.css-i')[1].classList.contains('on'), 'DOM: ↓ chuyển dòng chọn');
  inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok(w.opened.length === 1 && box().style.display === 'none', 'DOM: Enter mở hồ sơ khách đang chọn + ẩn hộp');
  inp.value = '+84 912 345 678'; w.ssRender_(); box().querySelector('.css-i').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(w.opened[1] === '0912345678', 'DOM: gõ +84… → bấm gợi ý → mở đúng SĐT');
  inp.value = '162T10'; w.ssRender_(); ok(box().style.display === 'none', 'DOM: mã đơn → không hiện gợi ý khách (nhường cho tìm mã đơn)');
  // SP/combo trong hộp gợi ý: khách trước, SP sau; Enter/bấm SP → plibOpen
  w.plibOpened = []; w.plibOpen = (n, g) => w.plibOpened.push([n, g]);
  w.plibSearch = () => [{ name: 'Vòng Nam Bích', group: 'Vòng', combo: false, n: 2, hasInfo: false, viaInfo: false }];
  inp.value = 'zzzz'; w.ssRender_();
  ok(box().style.display === 'block' && box().querySelectorAll('.css-pl').length === 1 && box().querySelectorAll('.css-i').length === 1, 'DOM: không có khách vẫn hiện SP');
  inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); ok(w.plibOpened.length === 1 && w.plibOpened[0][0] === 'Vòng Nam Bích', 'DOM: Enter mở thư mục SP');
  inp.value = 'zzzz'; w.ssRender_(); box().querySelector('.css-pl').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); ok(w.plibOpened.length === 2, 'DOM: bấm SP mở thư mục');
  inp.value = 'nguyen van'; w.ssRender_(); ok(box().querySelectorAll('.css-i').length === 3 && box().querySelectorAll('.css-i')[0].hasAttribute('data-ph') && box().querySelectorAll('.css-i')[2].hasAttribute('data-pn'), 'DOM: khách trước, SP sau');
  inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); ok(w.plibOpened.length === 3, 'DOM: ↑ từ khách đầu quay vòng xuống SP cuối + Enter mở SP');
  delete w.plibSearch;
  inp.value = 'nguyen'; w.ssRender_(); inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok(box().style.display === 'none', 'DOM: Esc ẩn hộp');
}
// Chạy NGUYÊN dòng lọc đã nối trong js/02 (trích từ mã nguồn) với ví dụ thật — cả khi có js/69 lẫn khi thiếu (kiểu cũ)
{
  const mm = j02.match(/\n(\s*if \(q && !\(_sn \? ssMatchText_[^\n]*return false;)/);
  ok(!!mm, 'tìm thấy dòng lọc đã nối trong applyFilters');
  if (mm) {
    const pred = new Function('ssMatchText_', 'c', 'q', '_sn', mm[1].replace(/\breturn false;$/, 'return false; return true;').replace(/^\s*/, ''));
    const run = (raw, withModule) => { const sn = withModule ? N(raw) : null; const q = sn ? sn.q : raw.trim().toLowerCase(); return C.filter(c => pred(m.ssMatchText_, c, q, sn)).map(c => c.phone).join(); };
    ok(run('nguyen van', true) === '0912345678,0912000111', 'applyFilters: "nguyen van" ra 2 khách Nguyễn Văn / Văn Nguyễn');
    ok(run('nguyen van', false) === '', 'applyFilters kiểu CŨ (thiếu js/69): "nguyen van" → 0 khách (đúng lỗi gốc)');
    ok(run('nguyễn văn', false) === '0912345678', 'kiểu cũ vẫn chạy khi gõ đủ dấu (không vỡ khi thiếu js/69)');
    ok(run('0912 345 678', true) === '0912345678' && /^\d{4,}$/.test(N('0912 345 678').q), 'SĐT có dấu cách → q thành dãy số → còn đi vào nhánh isPhoneSearch');
    ok(run('+84 987 654 321', true) === '0987654321', '+84 → đúng khách');
    ok(run('', true) === C.map(c => c.phone).join(), 'ô rỗng → không lọc');
  }
}
console.log(bad ? ('FAILED ' + bad) : 'ALL SMART-SEARCH TESTS PASSED'); process.exit(bad ? 1 : 0);
