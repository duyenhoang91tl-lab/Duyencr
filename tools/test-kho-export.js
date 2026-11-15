#!/usr/bin/env node
// R7c-4 — Tồn kho: nút "📤 Xuất Excel" (Mã · Tên · Tồn · Tình trạng; kho đang xem hoặc mọi kho; áp bộ lọc tìm/sắp hết). Chạy: node tools/test-kho-export.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/46-fn-kho.js'), 'utf8');
function fn(n, pre) { const i = src.indexOf((pre || '') + 'function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ITEMS = { k1: [{ maHang: 'A1', tenHang: 'Nhẫn', ton: 2, minTon: 5 }, { maHang: 'B2', tenHang: '', ton: 50 }, { maHang: 'C3', tenHang: 'Vòng', ton: 9, minTon: 3 }], k2: [{ maHang: 'Z9', tenHang: 'Lắc', ton: 1, minTon: 4 }] };
function mk(o) {
  o = o || {}; const log = { aoa: null, file: null, sheet: null, toast: [], gets: [] }; const els = {};
  const btn = id => els[id] || (els[id] = { id, disabled: false, textContent: '', onclick: null });
  const box = { querySelector: s => btn(s.slice(1)), querySelectorAll: () => Object.values(els) };
  const ctx = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, esc,
    _tk: { kho: [{ id: 'k1', name: 'Kho Hà Nội' }, { id: 'k2', name: 'Kho SG' }], cur: 'k1', items: ITEMS.k1, q: o.q || '', low: !!o.low, shown: 200 },
    _tkDlg: () => box, tkDlgClose() { log.closed = true; }, _tkToast: m => log.toast.push(m), _tkErr: j => (j && j.error) || 'Lỗi không rõ',
    _tkGet: async qs => { log.gets.push(qs); const id = /khoId=([^&]+)/.exec(qs)[1]; return o.err ? { error: 'Hết phiên' } : { items: ITEMS[id] }; },
    XLSX: o.noXlsx ? undefined : { utils: { aoa_to_sheet: a => { log.aoa = a; return {}; }, book_new: () => ({}), book_append_sheet: (w, s, n) => { log.sheet = n; } }, writeFile: (w, f) => { log.file = f; } } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(['_tkNorm', '_tkNum', '_tkIsLow', '_tkCurKho', '_tkFiltered', '_tkFilterItems_', '_tkExportRows_', '_tkExportName_', '_tkFilterNote_', 'tkExportDlg'].map(n => fn(n)).join('\n') + '\nvar TK_EXPORT_HEAD = ' + JSON.stringify(['Kho', 'Mã hàng', 'Tên hàng', 'Tồn', 'Tình trạng']) + ';', ctx);
  return { ctx, log, btn };
}
(async () => {
  let m = mk(); m.ctx.tkExportDlg(); await m.btn('tk-x-cur').onclick.call(m.btn('tk-x-cur'));
  t(JSON.stringify(m.log.aoa[0]) === '["Kho","Mã hàng","Tên hàng","Tồn","Tình trạng"]', 'tiêu đề đủ cột Kho · Mã · Tên · Tồn · Tình trạng');
  t(m.log.aoa.length === 4 && m.log.aoa[1][1] === 'A1' && m.log.aoa[1][4] === 'Sắp hết (≤ 5)' && m.log.aoa[2][4] === 'Còn hàng' && m.log.aoa[2][2] === '', 'kho đang xem: 3 dòng, tình trạng đúng, tên trống giữ trống');
  t(typeof m.log.aoa[1][3] === 'number' && m.log.aoa[1][3] === 2 && m.log.aoa[1][0] === 'Kho Hà Nội', 'Tồn là SỐ (Excel cộng được) + cột Kho');
  t(/^TonKho_Kho_Ha_Noi_\d{4}-\d{2}-\d{2}\.xlsx$/.test(m.log.file) && m.log.sheet === 'Tồn kho', 'tên file + sheet kho đang xem: ' + m.log.file);
  t(m.log.gets.length === 0 && m.log.closed, 'kho đang xem dùng dữ liệu đã tải, không gọi lại server');
  m = mk({ low: true }); m.ctx.tkExportDlg(); await m.btn('tk-x-cur').onclick.call(m.btn('tk-x-cur'));
  t(m.log.aoa.length === 2 && m.log.aoa[1][1] === 'A1', 'lọc "Sắp hết" áp vào file xuất (chỉ A1; C3 tồn 9 > ngưỡng 3 nên không sắp hết)');
  m = mk({ q: 'vong' }); m.ctx.tkExportDlg(); await m.btn('tk-x-cur').onclick.call(m.btn('tk-x-cur'));
  t(m.log.aoa.length === 2 && m.log.aoa[1][1] === 'C3', 'ô tìm (không dấu) áp vào file xuất');
  m = mk(); m.ctx.tkExportDlg(); await m.btn('tk-x-all').onclick.call(m.btn('tk-x-all'));
  t(m.log.gets.length === 2 && m.log.aoa.length === 5 && m.log.aoa[4][0] === 'Kho SG' && m.log.aoa[4][1] === 'Z9', 'mọi kho: gọi từng kho, gộp 1 sheet, có cột tên kho');
  t(m.log.file.startsWith('TonKho_TatCaKho_') && m.log.sheet === 'Tất cả kho', 'tên file/sheet mọi kho');
  m = mk({ low: true }); m.ctx.tkExportDlg(); await m.btn('tk-x-all').onclick.call(m.btn('tk-x-all'));
  t(m.log.aoa.length === 3 && m.log.aoa.slice(1).map(r => r[1]).join() === 'A1,Z9', 'mọi kho + lọc sắp hết cũng áp cho từng kho');
  m = mk({ err: true }); m.ctx.tkExportDlg(); await m.btn('tk-x-all').onclick.call(m.btn('tk-x-all'));
  t(!m.log.file && /Hết phiên/.test(m.btn('tk-res').textContent), 'lỗi server → báo lỗi, không tạo file rỗng');
  m = mk({ noXlsx: true }); m.ctx.tkExportDlg(); await m.btn('tk-x-cur').onclick.call(m.btn('tk-x-cur'));
  t(!m.log.file && /Thư viện Excel/.test(m.btn('tk-res').textContent), 'thiếu thư viện XLSX → báo, không lỗi');
  m = mk({ q: 'zzz' }); m.ctx.tkExportDlg(); await m.btn('tk-x-cur').onclick.call(m.btn('tk-x-cur'));
  t(!m.log.file && /Không có mặt hàng/.test(m.btn('tk-res').textContent), 'không có dòng khớp → báo, không tạo file');
  t(/id="tk-exp">📤 Xuất Excel/.test(src) && /getElementById\('tk-exp'\)\.addEventListener\('click', tkExportDlg\)/.test(src), 'nút Xuất có trong thanh công cụ + gắn sự kiện');
  t(/_tkNorm\(it\.maHang\)\.indexOf\(q\)/.test(src) && !/_tk\.items\.filter\(function\(it\)\{\s*if \(_tk\.low/.test(src), 'một bộ lọc dùng chung (không nhân đôi logic)');
  if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
})();
