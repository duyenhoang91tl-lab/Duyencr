#!/usr/bin/env node
// R7b — các báo cáo nhiều mục (H, F, G…) vẽ qua khuôn uiReportFrame_ (ô bodyHtml); nội dung từng báo cáo KHÔNG đổi. Chạy: node tools/test-report-body-frame.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
// id: mã báo cáo · file/render: hàm vẽ ngoài · bar/body: hàm ghép (stub) · loadKey: có cờ đang tải không
const CASES = [
  { id: 'H', file: 'js/13-fn-bpseedofficialonlinetemplate.js', render: 'renderSalesReportTabH_', bar: '_srBarHtml_', body: '_srRenderH_', build: '_hBuild_', loading: false },
  { id: 'F', file: 'js/12-fn-rendersalesreporttabe.js', render: 'renderSalesReportTabF_', bar: '_srBarHtml_', body: '_srRenderF_', loading: true },
  /*@@CASES@@*/
];
function load(c, frame) {
  const ctx = { console, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, _srState: { loading: false, dataF: {}, dataG: {} } };
  ctx[c.bar] = () => '<div class="srb-bar" id="BAR"></div>';
  ctx[c.body] = d => d ? '<div class="dash-section-title" id="BODY">mục a</div><table id="TB"></table>' : '<div id="NODATA">Chưa có dữ liệu</div>';
  if (c.build) ctx[c.build] = () => ({ x: 1 });
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((frame ? R('js/68-ui-kit.js') + '\n' + R('js/76-report-frame.js') + '\n' : '') + fn(R(c.file), c.render), ctx); return ctx;
}
function run(ctx, c, over) { Object.assign(ctx._srState, over || {}); const w = { innerHTML: '' }; ctx[c.render](w, null); return w.innerHTML; }
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
for (const c of CASES) {
  const states = [['có dữ liệu', {}]].concat(c.loading ? [['đang tải', { loading: true }]] : []);
  for (const [nm, over] of states) {
    const a = text(run(load(c, true), c, over)), b = text(run(load(c, false), c, over)), miss = b.filter(x => !a.includes(x) && x !== 'Đang tải...');
    t(!miss.length, c.id + ' "' + nm + '": mọi chữ của bản cũ còn đủ trong bản khuôn' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
  }
  const h = run(load(c, true), c, {});
  t(h.indexOf('data-rf="' + c.id + '"') >= 0, c.id + ': gắn data-rf');
  t(['id="BAR"', 'id="BODY"'].map(s => h.indexOf(s)).every((v, i, a) => v >= 0 && (!i || v > a[i - 1])) && /id="TB"/.test(h), c.id + ': thanh lọc → nội dung, bảng chèn nguyên');
  const old = run(load(c, false), c, {}); t(/id="BODY"/.test(old) && !/rf-/.test(old), c.id + ': thiếu js/76 → giao diện cũ (bar + nội dung)');
  if (c.loading) { const ld = run(load(c, true), c, { loading: true }); t(/rf-loading/.test(ld) && /BAR/.test(ld) && !/BODY/.test(ld), c.id + ': đang tải: giữ thanh lọc, không nội dung'); }
}
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
