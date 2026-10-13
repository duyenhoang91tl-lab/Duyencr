#!/usr/bin/env node
// Test (jsdom) cho Pancake AI: nút "Tìm" ở tab Tra cứu giá ra DANH SÁCH SẢN PHẨM + TIN NHẮN MẪU đi kèm (không cần API key),
// chèn vào ô trả lời, gợi ý khi AI lỗi. CẦN: npm i jsdom (thiếu thì tự bỏ qua). Chạy: node tools/test-pancake-tpl-suggest.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function fnSrc(name) {
  const i = src.indexOf('  function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0; for (let j = src.indexOf('{', i); j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
const NAMES = ['_stripVNlocal_', 'rankMsgTemplates_', '_ensureTplsForSearch_', 'doPriceSearch_', '_tplsForRow_', '_priceTplCardHtml_', '_bindPriceTplBtns_', 'renderPriceRows_', 'showAiFallbackHint_', 'escapeHtml'];
const chunk = "let _msgTemplates = []; let _msgTplTs = 0; let _lastPriceRows = []; let _lastPriceQ = ''; let _stonePref = '';\nconst _parsePriceNum_ = (v) => parseFloat(String(v).replace(/[^\\d.]/g, '')) || 0;\n" + NAMES.map(fnSrc).join('\n') +
  "\nreturn { doPriceSearch_, renderPriceRows_, showAiFallbackHint_, _tplsForRow_, getTpls: () => _msgTemplates, setTpls: (t) => { _msgTemplates = t; _msgTplTs = Date.now(); } };";
const T = [
  { id: 't1', status: 'approved', title: 'Chào khách hỏi giá nhẫn', product: 'Nhẫn vàng, Lắc tay', topic: 'Khách hỏi giá', tags: '', content: 'Dạ chào anh/chị, nhẫn vàng bên em giá từ 2tr ạ.' },
  { id: 't2', status: 'approved', title: 'Bảo hành', product: 'Nhẫn vàng', topic: 'Bảo hành', tags: '', content: 'Bảo hành 12 tháng <b>miễn phí</b>.' },
  { id: 't3', status: 'approved', title: 'Mẫu chung khách hỏi giá', product: '', topic: 'Khách hỏi giá', tags: '', content: 'Dạ anh/chị cho em xin ảnh sản phẩm quan tâm ạ.' },
  { id: 't4', status: 'pending', title: 'Chưa duyệt', product: 'Nhẫn vàng', topic: '', tags: '', content: 'KHONG DUOC HIEN' }];
const ROWS = [{ 'Tên sản phẩm': 'Nhẫn vàng 10K Type B', 'Giá': '4450' }, { 'Tên sản phẩm': 'Lắc tay bạc', 'Giá': '900' }];
function mk(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><body><div id="panel"><select id="pk-menu-sel"><option value=""></option><option value="price">p</option></select><input id="pk-price-q"><div id="pk-price-result"></div><div id="pk-ai-suggestions"></div><input id="pk-ctx-input"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window, log = { msgs: [], inserted: [], clip: [], status: [], cart: [] };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.navigator.clipboard = { writeText: async t => { log.clip.push(t); } };
  const panelEl = w.document.getElementById('panel');
  const safeSendMessage_ = (m, cb) => { log.msgs.push(m.type); setTimeout(() => {
    if (m.type === 'GET_PRICE') cb({ ok: true, data: { rows: opts.rows || ROWS } });
    else if (m.type === 'GET_MESSAGE_TEMPLATES') cb(opts.tplFail ? { ok: false, error: 'x' } : { ok: true, data: { templates: T } }); }, 1); };
  const fn = new w.Function('panelEl', 'safeSendMessage_', 'insertReply', 'setStatus', 'addToCart_', 'navigator', 'Event', chunk);
  const api = fn(panelEl, safeSendMessage_, t => log.inserted.push(t), s => log.status.push(s), x => log.cart.push(x), w.navigator, w.Event);
  return { w, d: w.document, api, log };
}
(async () => {
  let { d, api, log, w } = mk();
  d.getElementById('pk-price-q').value = 'nhẫn vàng'; api.doPriceSearch_(); await sleep(30);
  let html = d.getElementById('pk-price-result').innerHTML;
  ok(log.msgs.includes('GET_PRICE') && log.msgs.includes('GET_MESSAGE_TEMPLATES'), 'goi ca GET_PRICE + GET_MESSAGE_TEMPLATES: ' + log.msgs);
  ok(/Nhẫn vàng 10K Type B/.test(html) && /Lắc tay bạc/.test(html) && /4\.450\.000đ/.test(html), 'hien san pham + gia (4450 nghin -> 4.450.000d)');
  ok(d.querySelectorAll('.pk-price-addbtn').length === 2, 'nut + Them gio hang van con');
  ok(/Chào khách hỏi giá nhẫn/.test(html) && /Bảo hành/.test(html), 'tin nhan mau di kem san pham');
  ok(!/KHONG DUOC HIEN/.test(html), 'mau chua duyet KHONG hien');
  ok(/&lt;b&gt;miễn phí&lt;\/b&gt;/.test(html), 'noi dung mau duoc escape');
  // mẫu gắn đúng dòng: item đầu có t1+t2, item hai chỉ t1
  const items = d.querySelectorAll('.pk-price-item'); ok(items[0].querySelectorAll('.pk-price-tpl').length === 2 && items[1].querySelectorAll('.pk-price-tpl').length === 1, 'gan dung mau cho tung san pham');
  d.querySelector('[data-ptfill]').click(); ok(log.inserted.length === 1 && /nhẫn vàng bên em|Bảo hành/.test(log.inserted[0]), 'Chen vao o tra loi goi insertReply');
  d.querySelector('[data-ptcopy]').click(); await sleep(5); ok(log.clip.length === 1, 'copy');
  // lần tìm thứ hai trong 60s: KHÔNG tải lại mẫu
  log.msgs.length = 0; api.doPriceSearch_(); await sleep(30); ok(!log.msgs.includes('GET_MESSAGE_TEMPLATES'), 'dung cache mau trong 60 giay');
  // không có sản phẩm nhưng có mẫu theo chủ đề
  ({ d, api, log } = mk({ rows: [] })); d.getElementById('pk-price-q').value = 'khách hỏi giá'; api.doPriceSearch_(); await sleep(30);
  html = d.getElementById('pk-price-result').innerHTML; ok(/Không tìm thấy sản phẩm/.test(html) && /Tin nhắn gợi ý/.test(html) && /xin ảnh sản phẩm/.test(html), 'khong co san pham van ra tin nhan goi y');
  // lỗi tải mẫu không hỏng danh sách sản phẩm
  ({ d, api } = mk({ tplFail: true })); d.getElementById('pk-price-q').value = 'nhẫn'; api.doPriceSearch_(); await sleep(30);
  ok(/Nhẫn vàng 10K Type B/.test(d.getElementById('pk-price-result').innerHTML) && d.querySelectorAll('.pk-price-tpl').length === 0, 'loi tai mau van hien san pham');
  // đổi loại đá render lại với cache mẫu vẫn giữ mẫu
  ({ d, api } = mk()); api.setTpls(T); api.renderPriceRows_(ROWS, 'nhẫn'); ok(d.querySelectorAll('.pk-price-tpl').length >= 2, 'render lai (doi loai da) van co mau');
  // AI lỗi -> nhắc + nút
  ({ d, api, log } = mk()); d.getElementById('pk-ctx-input').value = 'nhẫn vàng'; api.showAiFallbackHint_();
  ok(/chưa có API key/.test(d.getElementById('pk-ai-suggestions').textContent), 'nhac AI chua dung duoc');
  d.getElementById('pk-ai-fallback-go').click(); await sleep(30);
  ok(d.getElementById('pk-menu-sel').value === 'price' && d.getElementById('pk-price-q').value === 'nhẫn vàng' && /Chào khách hỏi giá nhẫn/.test(d.getElementById('pk-price-result').innerHTML), 'nut chuyen sang tab gia, dien ngu canh, tim luon');
  console.log('ALL PANCAKE TPL SUGGEST TESTS PASSED');
})().catch(e => { console.error('FAIL (exception):', e); process.exit(1); });
