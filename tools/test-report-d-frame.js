#!/usr/bin/env node
// R7b — báo cáo D: nội dung _srRenderD_ GIỐNG HỆT bản cũ (renderSalesReportTabD_ trước khi tách). Chạy: node tools/test-report-d-frame.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const F = 'js/11-fn-srload.js';
const cur = fs.readFileSync(path.join(__dirname, '..', F), 'utf8');
const old = cp.execSync('git show 822bd4b:' + F, { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
function mk(src, names, frame) {
  const ctx = { location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, _srState: { loading: false, dCsView: 'table', dataD: null }, esc: s => String(s == null ? '' : s).replace(/</g, '&lt;'), fmt: n => String(n), _srBarHtml_: () => '<BAR/>', _srNoDataHtml_: () => '<NODATA/>',
    _srViewToggleHtml: () => '<TG/>', _srTotalRowHtml_: a => '<TOT>' + a.join(',') + '</TOT>', _srChartSvg: () => '<SVG/>', _moreRowsLimit_: () => 50, _moreRowsBtn_: () => '<MORE/>', _custLinkHtml_: (p, h) => '<a>' + h + '</a>' };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(names.map(n => fn(src, n)).join('\n') + (frame ? '\n' + fs.readFileSync(path.join(__dirname, '..', 'js/68-ui-kit.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'js/76-report-frame.js'), 'utf8') : ''), ctx); return ctx;
}
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
const D = { total: 3, byCS: [{ name: 'A', count: 2 }, { name: 'B', count: 1 }], rows: [{ phone: '0901', name: 'X', note: '[{"text":"ghi chú 1"}]', cs: 'A', createdAt: '2026-11-01T09:30:00' }, { phone: '0902', name: 'Y', note: 'tay', cs: 'B', createdAt: '2026-11-02T10:00:00' }] };
for (const [nm, d, view, loading] of [['bảng', D, 'table', false], ['biểu đồ', D, 'bar', false], ['không dữ liệu', null, 'table', false], ['đang tải', D, 'table', true], ['rỗng', { total: 0, byCS: [], rows: [] }, 'table', false]]) {
  const o = mk(old, ['renderSalesReportTabD_'], false), n = mk(cur, ['renderSalesReportTabD_', '_srRenderD_'], true), n0 = mk(cur, ['renderSalesReportTabD_', '_srRenderD_'], false);
  for (const c of [o, n, n0]) { c._srState.dataD = d; c._srState.dCsView = view; c._srState.loading = loading; }
  const a = { innerHTML: '' }, b = { innerHTML: '' }, b0 = { innerHTML: '' }; o.renderSalesReportTabD_(a); n.renderSalesReportTabD_(b); n0.renderSalesReportTabD_(b0);
  t(a.innerHTML === b0.innerHTML, 'D "' + nm + '": thiếu js/76 → HTML y hệt bản cũ');
  const miss = text(a.innerHTML).filter(x => !text(b.innerHTML).includes(x) && x !== 'Đang tải...');
  t(!miss.length, 'D "' + nm + '": qua khuôn đủ chữ/số bản cũ' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
}
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
