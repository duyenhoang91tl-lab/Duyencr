#!/usr/bin/env node
// Test (jsdom) Zalo AI — form "Tao mau luu san" (song song voi Pancake AI): nhom SP tu bang gia, goi y ten SP, tu nhan nhom, tu dat tieu de, payload co `nhom`; nhom de trong = '' (server tu phan loai).
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
function fnSrc(src, name) { const i = src.indexOf('function ' + name); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(i, m + 1); } } }
function constSrc(src, name) { const i = src.indexOf('const ' + name + ' ='); if (i < 0) throw new Error('khong thay const ' + name); const j = src.indexOf('\n  };', i); const k = src.indexOf('\n', i); return src.slice(i, (src.slice(i, k).trim().endsWith(';') || src.slice(i, k).trim().endsWith('}') ) ? k : j + 5); }
const help = [fnSrc(zsrc, 'zaiFold_'), fnSrc(zsrc, '_zaiLocalStripVN_'), constSrc(zsrc, '_zaiItemFold_'), constSrc(zsrc, '_zaiItemNames_'), fnSrc(zsrc, 'zaiEnsureTplCatalog_'), fnSrc(zsrc, 'openTplFormZai_')].join('\n');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ITEMS = [{ n: 'Nhẫn', t: 'Nhẫn Vàng 9999', m: 'Nhẫn Lộc' }, { n: 'Nhẫn', t: 'Nhẫn Bạc', m: '' }, { n: 'Lắc', t: 'Lắc Tay Vàng', m: '' }, { n: 'Charm', t: 'Lắc Tay Vàng', m: '' }];
async function mk(catalogOk) {
  const dom = new JSDOM('<!doctype html><body><div id="zai-tpl-form"></div></body>', { runScripts: 'outside-only' }), w = dom.window;
  const env = { calls: [], status: '', reload: 0, fetches: 0 };
  const fetchFn = async (url) => { env.fetches++; if (!catalogOk) throw new Error('mang loi'); return { json: async () => ({ ok: true, items: ITEMS }) }; };
  const call = async (type, p) => { env.calls.push(p); return { ok: true }; };
  const f = new w.Function('document', 'escHtml', 'escAttrZai_', '_currentCS', '_zaiTplStatus_', '_zaiTplCall_', 'loadMsgTemplatesZai_', 'GAS_URL', 'fetch',
    'let _zaiTplCatalog_ = null, _zaiTplCatalogLoading_ = false;\n' + help + '\nreturn { open: openTplFormZai_, cat: () => _zaiTplCatalog_ };');
  const S = f(w.document, esc, esc, 'Hoa', t => { env.status = t; }, call, () => { env.reload++; }, 'https://gas.test/exec', fetchFn);
  return Object.assign(S, { env, w, host: w.document.getElementById('zai-tpl-form'), $: id => w.document.querySelector(id) });
}
(async () => {
  let S = await mk(true); S.open(null); await sleep(20);
  const opts = id => [...S.w.document.querySelectorAll(id + ' option')].map(o => o.value);
  const fire = (el, ev) => el.dispatchEvent(new S.w.Event(ev));
  ok(S.host.textContent.includes('Tạo mẫu lưu sẵn'), 'tieu de form');
  ok(opts('#zai-tpl-nhom-dl').join('|') === 'Charm|Lắc|Nhẫn', 'datalist nhom tu bang gia: ' + opts('#zai-tpl-nhom-dl').join('|'));
  S.$('#zai-tpl-f-nhom').value = 'Nhẫn'; fire(S.$('#zai-tpl-f-nhom'), 'input');
  ok(opts('#zai-tpl-prod-dl').join('|') === 'Nhẫn Bạc|Nhẫn Lộc|Nhẫn Vàng 9999', 'chon nhom -> goi y ten SP trong nhom: ' + opts('#zai-tpl-prod-dl').join('|'));
  S.$('#zai-tpl-f-nhom').value = ''; S.$('#zai-tpl-f-product').value = 'nhan vang 9999'; fire(S.$('#zai-tpl-f-product'), 'input');
  ok(S.$('#zai-tpl-f-nhom').value === 'Nhẫn' && S.$('#zai-tpl-f-hint').textContent.includes('tự nhận nhóm'), 'go ten SP -> tu nhan nhom');
  S.$('#zai-tpl-f-nhom').value = 'Charm'; S.$('#zai-tpl-f-product').value = 'Nhẫn Bạc'; fire(S.$('#zai-tpl-f-product'), 'input');
  ok(S.$('#zai-tpl-f-nhom').value === 'Charm', 'khong ghi de nhom da chon');
  S.$('#zai-tpl-f-nhom').value = ''; S.$('#zai-tpl-f-product').value = 'Lắc Tay Vàng'; fire(S.$('#zai-tpl-f-product'), 'input');
  ok(S.$('#zai-tpl-f-nhom').value === '' && S.$('#zai-tpl-f-hint').textContent.includes('nhiều nhóm'), 'ten thuoc nhieu nhom: chi goi y');
  S.$('#zai-tpl-f-product').value = 'SP la'; fire(S.$('#zai-tpl-f-product'), 'input');
  ok(S.$('#zai-tpl-f-hint').textContent.includes('chưa có trong bảng giá'), 'ten ngoai bang gia: van luu duoc');
  S.$('#zai-tpl-f-product').value = ''; S.$('#zai-tpl-f-save').click(); ok(S.env.calls.length === 0 && S.env.status.includes('nội dung'), 'thieu noi dung');
  S.$('#zai-tpl-f-content').value = 'A\nB'; S.$('#zai-tpl-f-save').click(); ok(S.env.calls.length === 0 && S.env.status.includes('nhóm sản phẩm'), 'khong nhom/SP/tinh huong -> khong gui');
  S.$('#zai-tpl-f-nhom').value = 'Nhẫn'; S.$('#zai-tpl-f-product').value = 'Nhẫn Vàng 9999'; S.$('#zai-tpl-f-topic').value = 'Hỏi giá'; S.$('#zai-tpl-f-save').click(); await sleep(20);
  const p = S.env.calls[0];
  ok(p && p.nhom === 'Nhẫn' && p.product === 'Nhẫn Vàng 9999' && p.content === 'A\nB' && p.createdBy === 'Hoa' && p.title === 'Nhẫn Vàng 9999 — Hỏi giá', 'payload day du + tieu de tu dat: ' + JSON.stringify(p));
  ok(S.host.innerHTML === '' && S.env.reload === 1 && S.env.status.includes('chờ duyệt'), 'luu xong: dong form, tai lai, bao cho duyet');
  // nhom de trong -> gui '' (server tu phan loai)
  S = await mk(true); S.open(null); await sleep(20);
  S.$('#zai-tpl-f-topic').value = 'Hỏi giá'; S.$('#zai-tpl-f-content').value = 'X'; S.$('#zai-tpl-f-save').click(); await sleep(20);
  ok(S.env.calls[0].nhom === '', 'nhom de trong gui "" de server tu phan loai');
  // sua: nhom tu phan loai khong dien san; nhom chon tay dien san
  S = await mk(true); S.open({ id: 'z', title: 'T', content: 'C', nhom: 'Lắc', nhomAuto: true, product: 'x' }); await sleep(20);
  ok(S.$('#zai-tpl-f-nhom').value === '', 'nhom tu phan loai KHONG dien san vao o');
  S.$('#zai-tpl-f-save').click(); await sleep(20); ok(S.env.calls[0].id === 'z' && S.env.calls[0].nhom === '', 'sua giu id, nhom van de trong (tiep tuc tu phan loai)');
  S = await mk(true); S.open({ id: 'z', title: 'T', content: 'C', nhom: 'Lắc', nhomAuto: false, product: 'x' }); await sleep(20);
  ok(S.$('#zai-tpl-f-nhom').value === 'Lắc', 'nhom chon tay duoc dien san khi sua');
  // bang gia loi
  S = await mk(false); S.open(null); await sleep(20);
  S.$('#zai-tpl-f-nhom').value = 'Tu go'; S.$('#zai-tpl-f-content').value = 'N'; S.$('#zai-tpl-f-save').click(); await sleep(20);
  ok(S.env.calls.length === 1 && S.env.calls[0].nhom === 'Tu go' && S.cat() === null, 'bang gia loi: van go tay duoc, khong khoa cache');
  console.log('ALL ZALO TPL FORM TESTS PASSED');
})().catch(e => { console.error('FAIL (ngoai le):', e && e.message); process.exit(1); });
