#!/usr/bin/env node
// Test (jsdom) cho Zalo AI: nút "Tìm" ra DANH SÁCH SẢN PHẨM + TIN NHẮN MẪU đi kèm (không cần API key), dán vào ô chat, gợi ý khi AI lỗi.
// CẦN: npm i jsdom (thiếu thì tự bỏ qua). Chạy: node tools/test-zalo-tpl-suggest.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function cut(a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('khong thay ' + a + ' .. ' + b); return src.slice(i, j); }
// khối helper + render + doPriceSearch + fallback hint (không phụ thuộc phần còn lại của content script)
const chunk = cut('  async function doPriceSearchZai_()', '  // Nguồn dữ liệu thứ 3') + '\n' + cut('  async function callAI_', '  async function callAI_').slice(0, 0) +
  src.slice(src.indexOf('  // AI khong dung duoc (chua co API key'), src.indexOf('  // Gui tin nhan vao o chat Zalo'));
const mk = (rowsResp, tplResp, tplFail) => {
  const dom = new JSDOM('<!doctype html><body><input id="zai-price-q"><div id="zai-price-result"></div><div id="zai-sug"></div><input id="zai-ctx"><div id="chat" contenteditable="true"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window, log = { cmds: [], clip: [], fetches: [], clicks: 0 };
  w.document.execCommand = (c, _, t) => { log.cmds.push([c, t]); return true; };
  const chat = w.document.getElementById('chat'); chat.getBoundingClientRect = () => ({ height: 60, width: 400 });
  w.navigator.clipboard = { writeText: async t => { log.clip.push(t); } };
  w.InputEvent = w.InputEvent || w.Event; w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = async url => { log.fetches.push(url); if (/priceSearch/.test(url)) return { json: async () => rowsResp }; if (tplFail) throw new Error('net'); return { json: async () => tplResp }; };
  const fn = new w.Function('escHtml', 'GAS_URL', 'fetch', 'document', 'navigator', 'window', 'InputEvent', chunk + '\nreturn { zaiFold_, zaiRankTpls_, zaiTplsForRow_, renderPriceRowsZai_, doPriceSearchZai_, _zaiAiFallbackHint_, fillZaloInput_ };');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { w, log, api: fn(esc, 'https://gas.test/exec', w.fetch, w.document, w.navigator, w, w.InputEvent), d: w.document };
};
const T = [
  { id: 't1', status: 'approved', title: 'Chào khách hỏi giá nhẫn', product: 'Nhẫn vàng, Lắc tay', topic: 'Khách hỏi giá', tags: 'chào hỏi', content: 'Dạ chào anh/chị, nhẫn vàng bên em giá từ 2tr ạ.' },
  { id: 't2', status: 'approved', title: 'Bảo hành', product: 'Nhẫn vàng', topic: 'Bảo hành', tags: '', content: 'Bảo hành 12 tháng <b>miễn phí</b>.' },
  { id: 't3', status: 'approved', title: 'Mẫu chung khách hỏi giá', product: '', topic: 'Khách hỏi giá', tags: '', content: 'Dạ anh/chị cho em xin ảnh sản phẩm quan tâm ạ.' },
  { id: 't4', status: 'pending', title: 'Chưa duyệt', product: 'Nhẫn vàng', topic: '', tags: '', content: 'KHONG DUOC HIEN' },
  { id: 't5', status: 'approved', title: 'Vòng', product: 'Tỳ hưu', topic: '', tags: '', content: 'Tỳ hưu mang lại tài lộc.' }];
const ROWS = [{ 'Tên SP': 'Nhẫn vàng 10K Type B', 'Giá bán': '4.450.000' }, { 'Tên SP': 'Lắc tay bạc', 'Giá bán': '900.000' }];

(async () => {
  let { api, d, w, log } = mk({ rows: ROWS }, { templates: T });
  ok(api.zaiFold_('  Nhẫn  VÀNG đẹp ') === 'nhan vang dep', 'fold bo dau/thua khoang trang');
  const approved = T.filter(t => t.status === 'approved');
  let rk = api.zaiRankTpls_(approved, 'nhan vang');
  ok(rk.map(t => t.id).join() === 't1,t2' || rk.map(t => t.id).join() === 't2,t1', 'rank: chi mau khop san pham: ' + rk.map(t => t.id));
  ok(api.zaiRankTpls_(approved, 'nhan xyz').length === 0, 'moi tu khoa phai khop it nhat 1 truong');
  ok(api.zaiRankTpls_(approved, 'khach hoi gia').map(t => t.id).includes('t3'), 'tim theo noi dung hoi thoai ra mau chung');
  ok(api.zaiTplsForRow_(ROWS[0], approved).map(t => t.id).sort().join() === 't1,t2', 'gan mau cho dong san pham (t1,t2 cho Nhan vang)');
  ok(api.zaiTplsForRow_(ROWS[1], approved).map(t => t.id).join() === 't1', 'Lac tay -> chi t1');
  ok(api.zaiTplsForRow_({ a: 'Ty huu da' }, approved).map(t => t.id).join() === 't5', 'khop khong dau: Ty huu <-> Tỳ hưu');

  // Bấm Tìm: sản phẩm + mẫu kèm theo; mẫu chưa duyệt không hiện; XSS an toàn
  d.getElementById('zai-price-q').value = 'nhẫn vàng'; await api.doPriceSearchZai_(); await sleep(10);
  const html = d.getElementById('zai-price-result').innerHTML;
  ok(/Nhẫn vàng 10K Type B/.test(html) && /4\.450\.000/.test(html) && /Lắc tay bạc/.test(html), 'hien danh sach san pham + gia');
  ok(/Chào khách hỏi giá nhẫn/.test(html) && /Bảo hành/.test(html), 'hien tin nhan mau di kem san pham');
  ok(!/KHONG DUOC HIEN/.test(html), 'mau chua duyet KHONG hien');
  ok(/&lt;b&gt;miễn phí&lt;\/b&gt;/.test(html), 'noi dung mau duoc escape (khong tao the <b> that)');
  ok(log.fetches.some(u => /action=priceSearch&q=/.test(u)) && log.fetches.some(u => /action=messageTemplates/.test(u)), 'goi ca priceSearch va messageTemplates');
  // dán: chỉ điền, KHÔNG gửi
  const fillBtn = d.querySelector('[data-zai-tpl-fill]'); fillBtn.click();
  ok(log.cmds.some(c => c[0] === 'insertText' && /nhẫn vàng bên em/.test(c[1])) && !log.cmds.some(c => /send|enter/i.test(c[0])), 'dan vao o chat bang insertText, khong tu gui');
  ok(/Đã dán/.test(fillBtn.textContent), 'bao da dan');
  const cp = d.querySelector('[data-zai-tpl-copy]'); cp.click(); await sleep(5); ok(log.clip.length === 1 && /nhẫn vàng/.test(log.clip[0]), 'copy dung noi dung');

  // Từ khoá chung: không có sản phẩm nhưng có mẫu theo chủ đề -> hiện mục "Tin nhắn gợi ý"
  ({ api, d, log } = mk({ rows: [] }, { templates: T }));
  d.getElementById('zai-price-q').value = 'khách hỏi giá'; await api.doPriceSearchZai_(); await sleep(10);
  let h2 = d.getElementById('zai-price-result').innerHTML;
  ok(/Không tìm thấy sản phẩm/.test(h2) && /Tin nhắn gợi ý/.test(h2) && /xin ảnh sản phẩm/.test(h2), 'khong co san pham van ra tin nhan goi y theo chu de');

  // Lỗi tải mẫu KHÔNG làm hỏng danh sách sản phẩm
  ({ api, d } = mk({ rows: ROWS }, null, true));
  d.getElementById('zai-price-q').value = 'nhẫn'; await api.doPriceSearchZai_(); await sleep(10);
  ok(/Nhẫn vàng 10K Type B/.test(d.getElementById('zai-price-result').innerHTML), 'loi tai mau van hien san pham');

  // Không tìm thấy ô chat -> fallback copy
  ({ api, d, log, w } = mk({ rows: ROWS }, { templates: T })); d.getElementById('chat').remove();
  const b = d.createElement('button'); api.fillZaloInput_('abc', b); await sleep(5); ok(log.clip[0] === 'abc' && /Đã copy/.test(b.textContent), 'khong thay o chat -> copy');

  // AI lỗi/không có key -> gợi ý + nút nhảy sang tìm kiếm với ngữ cảnh
  ({ api, d, log } = mk({ rows: ROWS }, { templates: T }));
  d.getElementById('zai-ctx').value = 'nhẫn vàng'; api._zaiAiFallbackHint_(d.getElementById('zai-sug'));
  ok(/chưa có API key/.test(d.getElementById('zai-sug').textContent), 'hien nhac AI chua dung duoc');
  d.getElementById('zai-fallback-go').click(); await sleep(20);
  ok(d.getElementById('zai-price-q').value === 'nhẫn vàng' && /Chào khách hỏi giá nhẫn/.test(d.getElementById('zai-price-result').innerHTML), 'nut goi y dien ngu canh va tim ngay');
  console.log('ALL ZALO TPL SUGGEST TESTS PASSED');
})().catch(e => { console.error('FAIL (exception):', e); process.exit(1); });
