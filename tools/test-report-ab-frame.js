#!/usr/bin/env node
// R7b — báo cáo A / B / N vẽ qua khuôn uiReportFrame_ (_srPaintMain_); thân A/B/N KHÔNG đổi. Chạy: node tools/test-report-ab-frame.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/11-fn-srload.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show 8e15a15:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
for (const n of ['_srRenderA', '_srRenderB']) t(fn(cur, n) === fn(old, n), n + ': thân hàm KHÔNG đổi so với bản cũ');
const main = fn(cur, 'renderSalesReportTab'); t(/_srPaintMain_\(wrap, bar \+ hiddenPanelHtml, body, !!_srState\.loading\)/.test(main) && !/wrap\.innerHTML = bar \+ hiddenPanelHtml/.test(main), 'renderSalesReportTab gọi _srPaintMain_ (A/B/N cùng đường vẽ)');
function load(frame, sub) {
  const ctx = { location: { search: '' }, document: { readyState: 'complete', addEventListener() {} }, console, esc: s => String(s), fmt: String, _srState: { sub: sub, loading: false } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((frame ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/76-report-frame.js'), 'utf8') + '\n' : '') + fn(cur, '_srPaintMain_'), ctx); return ctx;
}
const BAR = '<div id="BAR"></div>', HID = '<div id="HID"></div>', BODY = '<div class="dash-section-title" id="BODY">x</div><table id="TB"></table>';
for (const sub of ['A', 'B']) {
  const c0 = load(false, sub), w0 = { innerHTML: '' }; c0._srPaintMain_(w0, BAR + HID, BODY, false); t(w0.innerHTML === BAR + HID + BODY, sub + ': thiếu js/76 → ghép y hệt cũ');
  const c = load(true, sub), w = { innerHTML: '' }; c._srPaintMain_(w, BAR + HID, BODY, false); const h = w.innerHTML;
  t(h.indexOf('data-rf="' + sub + '"') >= 0, sub + ': gắn data-rf');
  t(['id="BAR"', 'id="HID"', 'id="BODY"'].map(s => h.indexOf(s)).every((v, i, a) => v >= 0 && (!i || v > a[i - 1])) && /id="TB"/.test(h), sub + ': thanh lọc → bảng ẩn Admin → nội dung, bảng chèn nguyên');
  const wl = { innerHTML: '' }; c._srPaintMain_(wl, BAR + HID, '<i>Đang tải...</i>' + BODY, true); t(/rf-loading/.test(wl.innerHTML) && /id="BAR"/.test(wl.innerHTML) && /id="HID"/.test(wl.innerHTML) && !/id="BODY"/.test(wl.innerHTML), sub + ': đang tải giữ thanh lọc, không nội dung');
}
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
