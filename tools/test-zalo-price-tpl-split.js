#!/usr/bin/env node
// Test (jsdom) cho Zalo AI (song song test-pancake-price-tpl-split.js): TRA CUU GIA chi con san pham + gia (KHONG tron tin nhan mau);
// tin nhan goi y nam o muc rieng "Mau tin nhan tu van" (chi danh sach mau) co O LOC NHOM SAN PHAM. Chay: NODE_PATH=<jsdom> node tools/test-zalo-price-tpl-split.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.error('FAIL: ' + m); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function fnSrc(name) {
  let i = src.indexOf('  function ' + name + '('); if (i < 0) i = src.indexOf('  async function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0; for (let j = src.indexOf('{', i); j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
const NAMES = ['escHtml', 'zaiFold_', 'zaiRankTpls_', 'zaiTplLines_', 'isMyOpenTplZai_', '_zaiTplStatus_', 'fillTplGroupSelectZai_', 'renderMsgTemplateRowsZai_', 'loadMsgTemplatesZai_', 'doPriceSearchZai_', 'renderPriceRowsZai_'];
const chunk = "let _zaiMsgTemplates = [], _zaiMsgTplGroups = [], _currentCS = 'Mai'; const GAS_URL = 'https://gas.test/exec';\n" +
  "const escAttrZai_ = (s) => escHtml(s).replace(/\"/g, '&quot;').replace(/'/g, '&#39;'); const _zaiTplFlashProxy_ = {}; const fillZaloInput_ = () => {}; const openTplFormZai_ = () => {}; const deleteTplZai_ = () => {};\n" +
  NAMES.map(fnSrc).join('\n') + "\nreturn { doPriceSearchZai_, renderPriceRowsZai_, loadMsgTemplatesZai_, renderMsgTemplateRowsZai_, fillTplGroupSelectZai_, getTpls: () => _zaiMsgTemplates };";
const T = [
  { id: 't1', status: 'approved', title: 'Báo giá nhẫn', product: 'Nhẫn vàng', topic: 'Hỏi giá', tags: '', content: 'Dạ nhẫn vàng giá từ 2tr ạ.', nhom: 'Nhẫn', nhomAuto: true, createdBy: 'Admin' },
  { id: 't2', status: 'approved', title: 'Bảo hành lắc', product: '', topic: 'Bảo hành', tags: '', content: 'Bảo hành 12 tháng.\nMiễn phí.', nhom: 'Lắc tay', nhomAuto: false, createdBy: 'Admin' },
  { id: 't3', status: 'approved', title: 'Chào khách', product: '', topic: '', tags: '', content: 'Dạ em chào anh/chị ạ.', nhom: '', nhomAuto: false, createdBy: 'Admin' }];
const ROWS = [{ 'Tên sản phẩm': 'Nhẫn vàng 10K Type B', 'Giá': '4450' }, { 'Tên sản phẩm': 'Lắc tay bạc', 'Giá': '900' }];
function mk(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><body><input id="zai-price-q"><div id="zai-price-result"></div><input id="zai-tpl-q"><select id="zai-tpl-group"><option value="">🗂 Tất cả nhóm</option></select><div id="zai-tpl-status"></div><div id="zai-tpl-result"></div></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
  const w = dom.window, urls = [];
  const fetch = async (u) => { urls.push(u); await sleep(1);
    if (/action=priceSearch/.test(u)) return { json: async () => (opts.priceFail ? { error: 'sheet loi' } : { rows: ROWS }) };
    if (/action=messageTemplates/.test(u)) return { json: async () => ({ templates: T, groups: ['Nhẫn', 'Lắc tay', 'Vòng'] }) };
    return { json: async () => ({}) }; };
  const api = new w.Function('document', 'fetch', 'navigator', 'setTimeout', chunk)(w.document, fetch, { clipboard: { writeText: async () => {} } }, setTimeout);
  return { w, d: w.document, api, urls };
}
(async () => {
  let { d, api, urls } = mk();
  d.getElementById('zai-price-q').value = 'nhẫn vàng'; await api.doPriceSearchZai_();
  let html = d.getElementById('zai-price-result').innerHTML;
  ok(urls.length === 1 && /action=priceSearch/.test(urls[0]) && !urls.some(u => /messageTemplates/.test(u)), 'tra gia CHI goi priceSearch (khong tai mau tin nhan): ' + urls.join(' | '));
  ok(/Nhẫn vàng 10K Type B/.test(html) && /Lắc tay bạc/.test(html) && /Giá/.test(html) && /4450/.test(html), 'hien san pham + gia');
  ok(!/Tin nhắn gợi ý|zai-tpl-item|Dạ nhẫn vàng giá/.test(html), 'KHONG con tin nhan goi y / the mau trong ket qua tra gia');
  ({ d, api, urls } = mk({ priceFail: true })); await api.doPriceSearchZai_();
  ok(/Lỗi: sheet loi/.test(d.getElementById('zai-price-result').innerHTML), 'loi bang gia -> bao loi ro');
  // ---- Muc mau tin nhan: o loc nhom ----
  ({ d, api, urls } = mk()); await api.loadMsgTemplatesZai_();
  const sel = d.getElementById('zai-tpl-group'), opts = [...sel.options].map(o => o.value);
  ok(opts[0] === '' && opts.includes('Nhẫn') && opts.includes('Lắc tay') && opts.includes('Vòng') && opts[opts.length - 1] === '__none__', 'o loc nhom: Tat ca + nhom DANH_MUC (ke ca nhom chua co mau: Vong) + Chung');
  const cards = () => [...d.querySelectorAll('#zai-tpl-result [data-tid]')].map(x => x.dataset.tid).join();
  ok(cards() === 't1,t2,t3' || [...d.querySelectorAll('#zai-tpl-result [data-tid]')].length === 3, 'mac dinh hien ca 3 mau');
  sel.value = 'Nhẫn'; sel.dispatchEvent(new d.defaultView.Event('change')); api.renderMsgTemplateRowsZai_();
  ok(cards() === 't1', 'loc nhom Nhan -> chi mau t1');
  sel.value = '__none__'; api.renderMsgTemplateRowsZai_(); ok(cards() === 't3', 'loc Chung (chua phan nhom) -> chi mau t3');
  sel.value = 'Vòng'; api.renderMsgTemplateRowsZai_(); ok(/Không tìm thấy mẫu phù hợp/.test(d.getElementById('zai-tpl-result').innerHTML), 'nhom khong co mau -> bao khong tim thay');
  sel.value = 'Nhẫn'; d.getElementById('zai-tpl-q').value = 'bảo hành'; api.renderMsgTemplateRowsZai_(); ok(!cards(), 'loc nhom + tu khoa ket hop (Nhan + "bao hanh" khong khop)');
  d.getElementById('zai-tpl-q').value = ''; sel.value = 'Lắc tay'; await api.loadMsgTemplatesZai_(); ok(d.getElementById('zai-tpl-group').value === 'Lắc tay' && cards() === 't2', 'tai lai (🔄) giu lua chon nhom dang co');
  sel.value = ''; api.renderMsgTemplateRowsZai_();
  ok(/tự phân loại/.test(d.querySelector('[data-tid="t1"]').innerHTML) && !/tự phân loại/.test(d.querySelector('[data-tid="t2"]').innerHTML), 'chip nhom ghi "tu phan loai" chi voi mau he thong tu xep nhom');
  console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
})();
