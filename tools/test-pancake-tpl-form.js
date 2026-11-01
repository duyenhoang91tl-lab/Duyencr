#!/usr/bin/env node
// Test (jsdom) Pancake AI — form "Tao mau luu san" (Duyen 21/10/2026): nhom SP tu bang gia, goi y ten SP, tu nhan nhom, tu dat tieu de, payload co `nhom`.
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function fnSrc(src, name) { const i = src.indexOf('function ' + name); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(i, m + 1); } } }
const a = psrc.indexOf('const _fold_ ='), b = psrc.indexOf('};', psrc.indexOf('const _itemNames_ =')) + 2;
const consts = psrc.slice(a, b);
const help = ['_stripVNlocal_', 'ensureTplCatalog_', 'openTplForm_'].map(n => fnSrc(psrc, n)).join('\n');
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ITEMS = [{ n: 'Nhẫn', t: 'Nhẫn Vàng 9999', m: 'Nhẫn Lộc', s: '', c: '', img: '' }, { n: 'Nhẫn', t: 'Nhẫn Bạc', m: '', s: '', c: '', img: '' },
  { n: 'Lắc', t: 'Lắc Tay Vàng', m: '', s: '', c: '', img: '' }, { n: 'Charm', t: 'Lắc Tay Vàng', m: '', s: '', c: '', img: '' }];
async function mk(catalogOk) {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><div id="pk-tpl-form"></div></div></body>', { runScripts: 'outside-only' }), w = dom.window;
  const env = { calls: [], status: '', loaded: 0, listReload: 0 };
  const safe = (msg, cb) => { if (msg.type === 'GET_PRODUCT_IMAGE_FLAT') { env.loaded++; setTimeout(() => cb(catalogOk ? { ok: true, data: { items: ITEMS } } : { ok: false, error: 'loi' }), 0); }
    else { env.calls.push(msg.payload); setTimeout(() => cb({ ok: true }), 0); } };
  const f = new w.Function('panelEl', 'settings', 'safeSendMessage_', 'escapeHtml', 'setStatus', 'PK_API_ERR', 'loadMsgTemplates_',
    'let _imgFlatItems = null, _imgFlatLoading = false;\n' + consts + '\n' + help + '\nreturn { open: openTplForm_, items: () => _imgFlatItems };');
  const S = f(w.document.getElementById('panel'), { csName: 'Hoa' }, safe, esc, t => { env.status = t; }, 'LOI API', () => { env.listReload++; });
  return Object.assign(S, { env, w, host: w.document.getElementById('pk-tpl-form'), $: id => w.document.querySelector(id) });
}
(async () => {
  let S = await mk(true); S.open(null); await sleep(20);
  const opts = id => [...S.w.document.querySelectorAll(id + ' option')].map(o => o.value);
  ok(S.host.textContent.includes('Tạo mẫu lưu sẵn'), 'tieu de form la "Tao mau luu san"');
  ok(opts('#pk-tpl-nhom-dl').join('|') === 'Charm|Lắc|Nhẫn', 'datalist NHOM lay tu bang gia (sap xep, khong trung): ' + opts('#pk-tpl-nhom-dl').join('|'));
  ok(opts('#pk-tpl-prod-dl').length === 4 && opts('#pk-tpl-prod-dl').includes('Nhẫn Lộc'), 'datalist ten SP gom ten + ten thuong mai, khong trung');
  // chon nhom -> goi y ten SP thu hep theo nhom
  S.$('#pk-tpl-f-nhom').value = 'Nhẫn'; S.$('#pk-tpl-f-nhom').dispatchEvent(new S.w.Event('input'));
  ok(opts('#pk-tpl-prod-dl').join('|') === 'Nhẫn Bạc|Nhẫn Lộc|Nhẫn Vàng 9999', 'chon nhom Nhan -> chi goi y san pham trong nhom: ' + opts('#pk-tpl-prod-dl').join('|'));
  // tu nhan nhom khi ten khop (nhom dang trong)
  S.$('#pk-tpl-f-nhom').value = ''; S.$('#pk-tpl-f-product').value = 'nhan vang 9999'; S.$('#pk-tpl-f-product').dispatchEvent(new S.w.Event('input'));
  ok(S.$('#pk-tpl-f-nhom').value === 'Nhẫn' && S.$('#pk-tpl-f-hint').textContent.includes('tự nhận nhóm'), 'go ten SP (khong dau/khong phan biet hoa-thuong) -> tu nhan nhom Nhan');
  // khong ghi de nhom CS da chon
  S.$('#pk-tpl-f-nhom').value = 'Charm'; S.$('#pk-tpl-f-product').value = 'Nhẫn Bạc'; S.$('#pk-tpl-f-product').dispatchEvent(new S.w.Event('input'));
  ok(S.$('#pk-tpl-f-nhom').value === 'Charm', 'khong ghi de nhom CS da tu chon');
  // ten thuoc nhieu nhom -> khong tu chon, co goi y
  S.$('#pk-tpl-f-nhom').value = ''; S.$('#pk-tpl-f-product').value = 'Lắc Tay Vàng'; S.$('#pk-tpl-f-product').dispatchEvent(new S.w.Event('input'));
  ok(S.$('#pk-tpl-f-nhom').value === '' && S.$('#pk-tpl-f-hint').textContent.includes('nhiều nhóm'), 'ten SP thuoc nhieu nhom: khong tu doan, goi y chon');
  // ten chua co trong bang gia -> van luu duoc
  S.$('#pk-tpl-f-product').value = 'San pham moi tinh'; S.$('#pk-tpl-f-product').dispatchEvent(new S.w.Event('input'));
  ok(S.$('#pk-tpl-f-hint').textContent.includes('chưa có trong bảng giá'), 'ten ngoai bang gia: bao van luu duoc, AI nhan dien theo ten go');
  // validate
  S.$('#pk-tpl-f-product').value = ''; S.$('#pk-tpl-f-nhom').value = ''; S.$('#pk-tpl-f-topic').value = ''; S.$('#pk-tpl-f-content').value = '';
  S.$('#pk-tpl-f-save').click(); ok(S.env.calls.length === 0 && S.env.status.includes('nội dung'), 'thieu noi dung -> khong gui');
  S.$('#pk-tpl-f-content').value = 'Em chào chị\nDạ vâng ạ'; S.$('#pk-tpl-f-save').click();
  ok(S.env.calls.length === 0 && S.env.status.includes('nhóm sản phẩm'), 'khong co nhom/SP/tinh huong -> khong gui (AI khong biet dung cho dau)');
  // luu thanh cong: tu dat tieu de + payload co nhom
  S.$('#pk-tpl-f-nhom').value = 'Nhẫn'; S.$('#pk-tpl-f-product').value = 'Nhẫn Vàng 9999'; S.$('#pk-tpl-f-topic').value = 'Khách hỏi giá'; S.$('#pk-tpl-f-save').click(); await sleep(20);
  const p = S.env.calls[0];
  ok(p && p.nhom === 'Nhẫn' && p.product === 'Nhẫn Vàng 9999' && p.topic === 'Khách hỏi giá' && p.content === 'Em chào chị\nDạ vâng ạ' && p.createdBy === 'Hoa', 'payload day du co nhom, giu xuong dong');
  ok(p.title === 'Nhẫn Vàng 9999 — Khách hỏi giá', 'bo trong tieu de -> tu dat theo san pham + tinh huong: ' + p.title);
  ok(S.host.innerHTML === '' && S.env.listReload === 1 && S.env.status.includes('chờ duyệt'), 'luu xong: dong form, tai lai danh sach, bao cho duyet');
  // sua mau co san: dien lai nhom
  S = await mk(true); S.open({ id: 'z', title: 'T', content: 'C', nhom: 'Lắc', product: 'Lắc Tay Vàng', topic: 'x', tags: 'g' }); await sleep(20);
  ok(S.$('#pk-tpl-f-nhom').value === 'Lắc' && S.$('#pk-tpl-f-title').value === 'T' && S.$('#pk-tpl-f-content').value === 'C', 'sua mau: dien san nhom/tieu de/noi dung');
  S.$('#pk-tpl-f-save').click(); await sleep(20); ok(S.env.calls[0].id === 'z' && S.env.calls[0].nhom === 'Lắc', 'sua giu id + nhom');
  // bang gia khong tai duoc -> form van dung duoc, go tay
  S = await mk(false); S.open(null); await sleep(20);
  S.$('#pk-tpl-f-nhom').value = 'Nhom tu go'; S.$('#pk-tpl-f-content').value = 'Noi dung'; S.$('#pk-tpl-f-save').click(); await sleep(20);
  ok(S.env.calls.length === 1 && S.env.calls[0].nhom === 'Nhom tu go' && S.w.document.querySelectorAll('#pk-tpl-nhom-dl option').length === 0 && S.items() === null, 'bang gia loi: form van go tay duoc, khong khoa cache tai lai');
  console.log('ALL PANCAKE TPL FORM TESTS PASSED');
})().catch(e => { console.error('FAIL (ngoai le):', e); process.exit(1); });
