#!/usr/bin/env node
// Test (jsdom) muc "🎁 Tra cuu khuyen mai (CTKM)": Zalo AI (doCtkmSearchZai_/renderCtkmRowsZai_) SONG SONG voi Pancake AI (doCtkmSearch_/renderCtkmRows_).
// Cat NGUYEN VAN ham render tu 2 content.js, chay CUNG du lieu mau, roi so khop HTML sinh ra (sau khi doi tien to class pk-/zai-) -> 2 ben hien thi GIONG HET.
// CAN: npm i jsdom (thieu thi bo qua). Chay: node tools/test-ctkm-ui.js -> "ALL CTKM UI TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
const cut = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error('khong thay: ' + a.slice(0, 50)); return src.slice(i, j); };
function fnSrc(src, name) { const i = src.indexOf('function ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(i, m + 1); } } throw new Error('khong thay ham ' + name); }
const zchunk = cut(zsrc, '  let _zaiCtkmLoadedOnce = false;', '  // ── HOI AI VE GIA');
const pchunk = cut(psrc, '  function doCtkmSearch_() {', '\n  // ── MAU TIN NHAN TU VAN KHACH');
const pstrip = fnSrc(psrc, '_stripVNlocal_');
const esc1 = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');   // escHtml cua Zalo
const esc2 = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // escapeHtml cua Pancake

const ROWS = [
  { STT: 1, 'Tên chương trình': 'Giảm 10% vòng tay bạc', 'Thời gian': '01/10 - 31/10', 'Nội dung': 'Giảm 10% cho đơn từ 2 triệu', __ctkmStatusLabel: '🟢 Đang áp dụng', __ctkmExclusionKey: 'Loại trừ', __ctkmExclusionNote: 'Không áp dụng hàng đã giảm' , 'Loại trừ': 'Không áp dụng hàng đã giảm' },
  { stt: 2, 'Tên chương trình': 'Noel sớm', 'Nội dung': 'Tặng hộp quà', __ctkmStatusLabel: '⏳ Sắp diễn ra', __ctkmUpcoming: true },
  { 'Tên chương trình': 'Tết 2025 <b>HẾT</b>', 'Nội dung': 'Quà "Tết" & \'lì xì\'', __ctkmStatusLabel: '⛔ Đã hết hạn', __ctkmExpired: true },
  { STT: 4, '': '', 'Tên': '', __ctkmInternal: 'x' },   // dong chi co STT/rong -> khong ve the
  { 'Tên chương trình': 'Không nhãn trạng thái', 'Mô tả': 'abc' }
];
const norm = (html, pre) => html.replace(/pk-price-item/g, 'X-item').replace(/pk-price-field/g, 'X-field').replace(/pk-ctkm-/g, 'X-').replace(/zai-ctkm-/g, 'X-').replace(/pk-price-loading/g, 'X-loading').replace(/\s+/g, ' ');

function zalo(gasUrl) {
  const dom = new JSDOM('<!doctype html><body><input id="zai-ctkm-q"><div id="zai-ctkm-result"></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], reply: null };
  const fetchFn = async (url, o) => { env.calls.push({ url, o }); if (env.reply instanceof Error) throw env.reply; return { json: async () => env.reply }; };
  const f = new w.Function('escHtml', 'GAS_URL', 'fetch', 'document', zchunk + '\nreturn { search: doCtkmSearchZai_, render: renderCtkmRowsZai_ };');
  return Object.assign(f(esc1, gasUrl, fetchFn, w.document), { env, box: w.document.getElementById('zai-ctkm-result'), input: w.document.getElementById('zai-ctkm-q') });
}
function pancake() {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><input id="pk-ctkm-q"><div id="pk-ctkm-result"></div></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], reply: null };
  const panelEl = w.document.getElementById('panel');
  const safeSendMessage_ = (msg, cb) => { env.calls.push(msg); cb(env.reply); };
  const f = new w.Function('panelEl', 'safeSendMessage_', 'escapeHtml', pstrip + '\n' + pchunk + '\nreturn { search: doCtkmSearch_, render: renderCtkmRows_ };');
  return Object.assign(f(panelEl, safeSendMessage_, esc2), { env, box: w.document.getElementById('pk-ctkm-result'), input: w.document.getElementById('pk-ctkm-q') });
}
(async () => {
  const Z = zalo('https://gas.test/exec'), P = pancake();
  // 1. cung du lieu -> cung HTML
  Z.render(ROWS, ''); P.render(ROWS, '');
  ok(Z.box.querySelectorAll('.zai-ctkm-item').length === 4 && P.box.querySelectorAll('.pk-price-item').length === 4, 've 4 the (dong chi co STT/rong bi bo): zalo ' + Z.box.querySelectorAll('.zai-ctkm-item').length + ' pancake ' + P.box.querySelectorAll('.pk-price-item').length);
  ok(norm(Z.box.innerHTML) === norm(P.box.innerHTML), 'HTML 2 ben GIONG HET:\nZALO   ' + norm(Z.box.innerHTML).slice(0, 700) + '\nPANCAKE ' + norm(P.box.innerHTML).slice(0, 700));
  ok(!Z.box.querySelector('b b') && !/STT/i.test(Z.box.textContent), 'cot STT khong hien');
  ok(Z.box.querySelector('.zai-ctkm-status-active') && Z.box.querySelector('.zai-ctkm-status-upcoming') && Z.box.querySelector('.zai-ctkm-status-expired') && Z.box.querySelector('.zai-ctkm-item-expired') && Z.box.querySelector('.zai-ctkm-excl'), 'trang thai han dung + het han mo + dieu kien loai tru noi bat');
  ok(!Z.box.querySelector('script, img') && /Tết 2025 <b>HẾT<\/b>/.test(Z.box.textContent) && Z.box.querySelectorAll('.zai-ctkm-excl').length === 1, 'HTML trong du lieu duoc escape; dieu kien loai tru chi hien 1 lan (khong lap o cac cot)');
  // 2. rong
  Z.render([], 'noel'); P.render([], 'noel'); ok(/Không tìm thấy cho "noel"/.test(Z.box.textContent) && norm(Z.box.innerHTML).replace(/X-loading/g, '') === norm(P.box.innerHTML).replace(/X-loading/g, ''), 'rong: cung cau chu');
  Z.render([], ''); ok(/Không tìm thấy — kiểm tra lại sheet CTKM/.test(Z.box.textContent), 'rong khong tu khoa');
  // 3. gioi han 30 the
  const many = Array.from({ length: 45 }, (_, i) => ({ 'Tên': 'CT ' + i })); Z.render(many, ''); P.render(many, ''); ok(Z.box.querySelectorAll('.zai-ctkm-item').length === 30 && P.box.querySelectorAll('.pk-price-item').length === 30, 'toi da 30 the');
  // 4. goi GAS (Zalo: GET truc tiep)
  Z.env.reply = { rows: ROWS, total: 5 }; Z.input.value = ' giảm giá & noel '; await Z.search();
  ok(Z.env.calls[0].url === 'https://gas.test/exec?action=ctkmSearch&q=' + encodeURIComponent('giảm giá & noel') && Z.env.calls[0].o.redirect === 'follow' && Z.box.querySelectorAll('.zai-ctkm-item').length === 4, 'GET ctkmSearch, q duoc trim + ma hoa: ' + Z.env.calls[0].url);
  Z.input.value = ''; await Z.search(); ok(Z.env.calls[1].url === 'https://gas.test/exec?action=ctkmSearch', 'de trong = xem tat ca (khong co &q)');
  const Z2 = zalo('https://gas.test/exec?x=1'); Z2.env.reply = { rows: [] }; await Z2.search(); ok(Z2.env.calls[0].url === 'https://gas.test/exec?x=1&action=ctkmSearch', 'URL da co ? thi noi &');
  Z.env.reply = { error: 'Khong doc duoc sheet CTKM' }; await Z.search(); ok(/^Lỗi: Khong doc duoc sheet CTKM/.test(Z.box.textContent), 'loi backend');
  Z.env.reply = new Error('mat mang'); await Z.search(); ok(/Lỗi: mat mang/.test(Z.box.textContent), 'loi mang');
  const Z3 = zalo(''); await Z3.search(); ok(/Chưa cài đặt URL GAS/.test(Z3.box.textContent) && Z3.env.calls.length === 0, 'chua co URL GAS: nhac, khong goi');
  // 5. noi vao menu (cau truc) + cau chu 2 ben
  ok(/\{ v: 'ctkm', label: '🎁 Tra cứu khuyến mãi' \}/.test(zsrc) && /id="zai-ctkm-btn"/.test(zsrc) && /ctkmBody\.style\.display = v === 'ctkm'/.test(zsrc) && /!_zaiCtkmLoadedOnce\) \{ _zaiCtkmLoadedOnce = true; doCtkmSearchZai_\(\)/.test(zsrc), 'Zalo: muc menu + nap san lan dau mo');
  ok(/<option value="ctkm">🎁 Tra cứu khuyến mãi<\/option>/.test(psrc), 'ten muc menu giong het Pancake');
  for (const s of ['Từ khoá khuyến mãi (để trống = xem tất cả)...', 'Đang tìm...', ' — kiểm tra lại sheet CTKM (cùng file với bảng giá).', 'Điều kiện không áp dụng']) ok(zchunk.includes(s) || zsrc.includes(s), 'Zalo co cau: ' + s), ok(psrc.includes(s), 'Pancake co cau: ' + s);
  console.log('ALL CTKM UI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });
