#!/usr/bin/env node
// R7b (báo cáo E) — E vẽ qua khuôn uiReportFrame_ (ô bodyHtml vì E nhiều mục có tiêu đề riêng); nội dung E giữ nguyên. Chạy: node tools/test-report-e-frame.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const src = R('js/12-fn-rendersalesreporttabe.js');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function load(frame, banner) {
  const c = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, _srState: { loading: false, dataE: { orders: [] } },
    _srBarHtml_: () => '<div class="srb-bar" id="BAR"></div>', _srEMismatchBanner_: () => banner ? '<div id="BANNER">lệch</div>' : '',
    _srRenderE_: d => d ? '<div class="dash-section-title" id="BODY">a) Doanh thu theo mức đơn hàng</div><table id="TB"></table>' : '<div id="NODATA">Chưa có dữ liệu</div>' };
  c.window = c; vm.createContext(c);
  vm.runInContext((frame ? R('js/68-ui-kit.js') + '\n' + R('js/76-report-frame.js') + '\n' : '') + fn('renderSalesReportTabE_'), c); return c;
}
function run(c, over) { Object.assign(c._srState, over || {}); const w = { innerHTML: '' }; c.renderSalesReportTabE_(w, null); return w.innerHTML; }
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
for (const [name, banner, over] of [['có dữ liệu', false, {}], ['có cảnh báo lệch', true, {}], ['chưa có dữ liệu', false, { dataE: null }], ['đang tải', true, { loading: true }]]) {
  const a = text(run(load(true, banner), over)), b = text(run(load(false, banner), over)), miss = b.filter(x => !a.includes(x) && x !== 'Đang tải...');
  t(!miss.length, 'E "' + name + '": mọi chữ của bản cũ còn đủ trong bản khuôn' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
}
const h = run(load(true, true), { loading: false, dataE: { orders: [] } });
t(['id="BAR"', 'id="BANNER"', 'id="BODY"'].map(s => h.indexOf(s)).every((v, i, a) => v >= 0 && (!i || v > a[i - 1])), 'khuôn: thanh lọc → cảnh báo lệch → nội dung E');
t(/data-rf="E"/.test(h) && /id="TB"/.test(h), 'nội dung E chèn nguyên (bảng còn nguyên)');
const ld = run(load(true, true), { loading: true }); t(/rf-loading/.test(ld) && !/BANNER|BODY/.test(ld) && /BAR/.test(ld), 'đang tải: giữ thanh lọc, không cảnh báo, không nội dung (như cũ)');
const old = run(load(false, true), { loading: false }); t(/id="BANNER"/.test(old) && !/rf-/.test(old), 'thiếu js/76 → giao diện cũ (bar + banner + nội dung)');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
