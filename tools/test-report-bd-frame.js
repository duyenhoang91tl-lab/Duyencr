#!/usr/bin/env node
// R7b — báo cáo BD (chi tiết thưởng) vẽ qua khuôn uiReportFrame_; nội dung KHÔNG đổi. Chạy: node tools/test-report-bd-frame.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/28-fn-bonusdetail.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show 2217c59:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
t(fn(cur, '_bdRenderBody_') === fn(old, '_bdRenderBody_'), '_bdRenderBody_: thân hàm KHÔNG đổi so với bản cũ');
function mk(src, frame, loading) {
  const ctx = { location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, console, esc: s => String(s), _srState: { loading, dataG: {} },
    _srGFiltersHtml_: () => '<div class="srb-bar" id="BAR"></div>', _bdRenderBody_: d => '<div class="dash-section-title" id="BODY">mục</div><table id="TB"></table>' };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((frame ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/76-report-frame.js'), 'utf8') + '\n' : '') + fn(src, 'renderSalesReportTabBD_'), ctx); return ctx;
}
const run = (src, frame, loading) => { const c = mk(src, frame, loading), w = { innerHTML: '' }; c.renderSalesReportTabBD_(w); return w.innerHTML; };
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
for (const loading of [false, true]) {
  const nm = loading ? 'đang tải' : 'có dữ liệu', a = run(old, false, loading), b0 = run(cur, false, loading), b = run(cur, true, loading);
  t(a === b0, 'BD "' + nm + '": thiếu js/76 → HTML y hệt bản cũ');
  const miss = text(a).filter(x => !text(b).includes(x) && x !== 'Đang tải...'); t(!miss.length, 'BD "' + nm + '": qua khuôn đủ chữ bản cũ (nút "← Về báo cáo thưởng" còn)' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
  t(b.indexOf('data-rf="BD"') >= 0 && b.indexOf('id="BAR"') < b.indexOf('_srSetSub') && b.indexOf('_srSetSub') >= 0, 'BD "' + nm + '": gắn data-rf, thanh lọc → nút quay về');
  if (loading) t(/rf-loading/.test(b) && !/id="BODY"/.test(b), 'BD: đang tải giữ thanh lọc, không nội dung'); else t(b.indexOf('id="BODY"') > b.indexOf('_srSetSub') && /id="TB"/.test(b), 'BD: nội dung sau nút quay về, bảng chèn nguyên');
}
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
