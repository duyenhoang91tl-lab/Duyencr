#!/usr/bin/env node
// Test (jsdom) cho Pancake AI: TRA CUU GIA chi con san pham + gia (nhu ban dau, KHONG tron tin nhan mau);
// tin nhan goi y nam o muc rieng "Mau tin nhan tu van" (chi danh sach mau) co O LOC NHOM SAN PHAM; nut du phong khi AI loi mo muc do.
// CAN: npm i jsdom (thieu thi bo qua). Chay: node tools/test-pancake-price-tpl-split.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function fnSrc(name) {
  const i = src.indexOf('  function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0; for (let j = src.indexOf('{', i); j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
const NAMES = ['_stripVNlocal_', 'rankMsgTemplates_', 'isMyOpenTpl_', 'tplLines_', 'doPriceSearch_', 'renderPriceRows_', 'loadMsgTemplates_', 'fillTplGroupSelect_', 'renderMsgTemplateRows_', 'showAiFallbackHint_'];
const chunk = "let _msgTemplates = []; let _msgTplTs = 0; let _msgTplGroups = []; let _lastPriceRows = []; let _lastPriceQ = ''; let _stonePref = ''; const PK_API_ERR = 'LOI-API';\n" +
  "const _parsePriceNum_ = (v) => parseFloat(String(v).replace(/[^\\d.]/g, '')) || 0; const escapeHtml = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');\n" +
  "const openTplForm_ = () => {};\n" + NAMES.map(fnSrc).join('\n') +
  "\nreturn { doPriceSearch_, renderPriceRows_, loadMsgTemplates_, renderMsgTemplateRows_, showAiFallbackHint_, getTpls: () => _msgTemplates };";
const T = [
  { id: 't1', status: 'approved', title: 'Báo giá nhẫn', product: 'Nhẫn vàng', topic: 'Hỏi giá', tags: '', content: 'Dạ nhẫn vàng giá từ 2tr ạ.', nhom: 'Nhẫn', nhomAuto: true, createdBy: 'Admin' },
  { id: 't2', status: 'approved', title: 'Bảo hành lắc', product: '', topic: 'Bảo hành', tags: '', content: 'Bảo hành 12 tháng <b>miễn phí</b>.', nhom: 'Lắc tay', nhomAuto: false, createdBy: 'Admin' },
  { id: 't3', status: 'approved', title: 'Chào khách', product: '', topic: '', tags: '', content: 'Dạ em chào anh/chị ạ.', nhom: '', nhomAuto: false, createdBy: 'Admin' },
  { id: 't4', status: 'pending', title: 'Mẫu của Lan chờ duyệt', product: 'Nhẫn', topic: '', tags: '', content: 'Nhẫn đẹp lắm ạ', nhom: 'Nhẫn', nhomAuto: false, createdBy: 'Lan' }];
const ROWS = [{ 'Tên sản phẩm': 'Nhẫn vàng 10K Type B', 'Giá': '4450' }, { 'Tên sản phẩm': 'Lắc tay bạc', 'Giá': '900' }];
function mk(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><body><div id="panel"><select id="pk-menu-sel"><option value=""></option><option value="price">p</option><option value="tpl">t</option></select>' +
    '<input id="pk-price-q"><div id="pk-price-result"></div><input id="pk-tpl-q"><select id="pk-tpl-group"><option value="">🗂 Tất cả nhóm</option></select><div id="pk-tpl-result"></div>' +
    '<input id="pk-ctx-input"><div id="pk-ai-suggestions"></div></div></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
  const w = dom.window, log = { msgs: [], inserted: [], clip: [], status: [], cart: [] };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.navigator.clipboard = { writeText: async t => { log.clip.push(t); } };
  const panelEl = w.document.getElementById('panel');
  const safeSendMessage_ = (m, cb) => { log.msgs.push(m.type); setTimeout(() => {
    if (m.type === 'GET_PRICE') cb(opts.priceFail ? { ok: false, error: 'sheet loi' } : { ok: true, data: { rows: opts.rows || ROWS } });
    else if (m.type === 'GET_MESSAGE_TEMPLATES') cb({ ok: true, data: { templates: T, groups: ['Nhẫn', 'Lắc tay', 'Vòng'] } }); }, 1); };
  const fn = new w.Function('panelEl', 'safeSendMessage_', 'insertReply', 'setStatus', 'addToCart_', 'navigator', 'Event', 'settings', 'CSS', chunk);
  const api = fn(panelEl, safeSendMessage_, t => log.inserted.push(t), s => log.status.push(s), x => log.cart.push(x), w.navigator, w.Event, { csName: 'Mai' }, { escape: s => s });
  return { w, d: w.document, api, log };
}
(async () => {
  // ===== 1) Tra cuu gia: nhu cu — chi san pham + gia =====
  let { d, api, log } = mk();
  d.getElementById('pk-price-q').value = 'nhẫn vàng'; api.doPriceSearch_(); await sleep(30);
  let html = d.getElementById('pk-price-result').innerHTML;
  ok(log.msgs.join() === 'GET_PRICE', 'tra gia CHI goi GET_PRICE (khong tai mau tin nhan): ' + log.msgs);
  ok(/Nhẫn vàng 10K Type B/.test(html) && /Lắc tay bạc/.test(html) && /4\.450\.000đ/.test(html), 'hien san pham + gia (4450 nghin -> 4.450.000d)');
  ok(d.querySelectorAll('.pk-price-addbtn').length === 2, 'nut "+ Them" vao don con nguyen');
  ok(!/pk-price-tpl|Tin nhắn gợi ý|Dạ nhẫn vàng giá/.test(html) && d.querySelectorAll('[data-ptfill],[data-ptcopy]').length === 0, 'KHONG con tin nhan mau/goi y tron trong ket qua gia');
  d.querySelector('.pk-price-addbtn').click(); ok(log.cart.length === 1 && log.cart[0].price === 4450000, 'bam + Them -> vao don dung gia 4.450.000');
  ({ d, api, log } = mk({ rows: [] })); d.getElementById('pk-price-q').value = 'xyz'; api.doPriceSearch_(); await sleep(30);
  ok(/Không tìm thấy cho "xyz"/.test(d.getElementById('pk-price-result').innerHTML) && log.msgs.join() === 'GET_PRICE', 'khong co san pham -> thong bao nhu cu, khong goi mau');
  ({ d, api } = mk({ priceFail: true })); api.doPriceSearch_(); await sleep(30);
  ok(/sheet loi/.test(d.getElementById('pk-price-result').innerHTML) && !/Lỗi:/.test(d.getElementById('pk-price-result').innerHTML), 'loi tra gia hien thong bao API (khong them tien to "Loi:", theo test-pancake-apierr)');

  // ===== 2) Muc "Mau tin nhan tu van": rieng, chi danh sach mau + loc nhom =====
  ({ d, api, log } = mk()); api.loadMsgTemplates_(); await sleep(30);
  const opts = [...d.getElementById('pk-tpl-group').options].map(o => o.value);
  ok(opts.join() === ',Nhẫn,Lắc tay,Vòng,__none__', 'o loc nhom: Tat ca + nhom DANH_MUC + Chung: ' + opts.join('|'));
  let box = d.getElementById('pk-tpl-result');
  ok(box.querySelectorAll('[data-tid]').length === 4 && !/Nhẫn vàng 10K|Giá/.test(box.textContent.replace(/Báo giá nhẫn/, '')), 'chi hien DANH SACH MAU (4 mau), khong co san pham/gia');
  ok(/🗂 Nhẫn · tự phân loại/.test(box.textContent) && /🗂 Lắc tay/.test(box.textContent) && !/🗂 Lắc tay · tự phân loại/.test(box.textContent), 'chip nhom: he thong xep thi ghi "tu phan loai", nguoi soan chon thi khong');
  ok(/Chưa duyệt — Lan đề xuất/.test(box.textContent), 'mau cho duyet cua nguoi khac van co huy hieu (quy tac cu giu nguyen)');
  ok(/&lt;b&gt;miễn phí&lt;\/b&gt;/.test(box.innerHTML), 'noi dung mau duoc escape');
  const sel = d.getElementById('pk-tpl-group');
  sel.value = 'Nhẫn'; api.renderMsgTemplateRows_();
  let ids = [...box.querySelectorAll('[data-tid]')].map(e => e.dataset.tid).sort().join();
  ok(ids === 't1,t4', 'loc nhom "Nhẫn" -> chi mau cua nhom Nhan: ' + ids);
  sel.value = 'Lắc tay'; api.renderMsgTemplateRows_(); ok([...box.querySelectorAll('[data-tid]')].map(e => e.dataset.tid).join() === 't2', 'loc nhom "Lắc tay" -> chi t2');
  sel.value = 'Vòng'; api.renderMsgTemplateRows_(); ok(/Không tìm thấy mẫu phù hợp/.test(box.textContent), 'nhom khong co mau nao -> thong bao, khong loi');
  sel.value = '__none__'; api.renderMsgTemplateRows_(); ok([...box.querySelectorAll('[data-tid]')].map(e => e.dataset.tid).join() === 't3', 'loc "Chung" -> chi mau chua phan nhom (t3)');
  sel.value = ''; d.getElementById('pk-tpl-q').value = 'bảo hành'; api.renderMsgTemplateRows_(); ok([...box.querySelectorAll('[data-tid]')].map(e => e.dataset.tid).join() === 't2', 'tim kiem van hoat dong cung bo loc nhom');
  d.getElementById('pk-tpl-q').value = ''; sel.value = 'Nhẫn'; api.loadMsgTemplates_(); await sleep(30);
  ok(d.getElementById('pk-tpl-group').value === 'Nhẫn', 'tai lai danh sach van giu nhom dang loc');
  box.querySelector('[data-iid="t1"]').click(); ok(log.inserted.length === 1 && /nhẫn vàng giá từ 2tr/.test(log.inserted[0]), 'Chen ca cau vao o tra loi van hoat dong');

  // ===== 3) AI loi -> nhac + nut mo muc Mau tin nhan (khong con tro sang tra gia) =====
  ({ d, api, log } = mk()); d.getElementById('pk-ctx-input').value = 'nhẫn vàng'; api.showAiFallbackHint_();
  ok(/chưa có API key/.test(d.getElementById('pk-ai-suggestions').textContent) && !/Tìm sản phẩm/.test(d.getElementById('pk-ai-suggestions').textContent), 'nhac AI chua dung duoc, tro sang muc Mau tin nhan');
  d.getElementById('pk-ai-fallback-go').click(); await sleep(30);
  ok(d.getElementById('pk-menu-sel').value === 'tpl' && d.getElementById('pk-tpl-q').value === 'nhẫn vàng', 'nut mo muc Mau tin nhan + dien san tu khoa tu o ngu canh');
  console.log('\nALL PANCAKE PRICE/TPL SPLIT TESTS PASSED');
})().catch(e => { console.error('FAIL (exception):', e); process.exit(1); });
