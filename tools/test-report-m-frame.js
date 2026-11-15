#!/usr/bin/env node
// R7b — báo cáo M (đơn chia sale) vẽ qua khuôn uiReportFrame_; GIỮ id sr-m-fix / sr-m-body. Chạy: node tools/test-report-m-frame.js
const fs = require('fs'), vm = require('vm'), cp = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), F = 'js/50-split-orders.js';
const cur = fs.readFileSync(path.join(root, F), 'utf8');
const old = cp.execSync('git show 6bb8c6c:' + F, { cwd: root, maxBuffer: 1 << 26 }).toString('utf8');
function fn(src, n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
function mk(src, frame, loading) {
  const els = {}; const ctx = { location: { search: '' }, console, esc: s => String(s), splitEsc_: s => String(s == null ? '' : s), _srState: { loading, mSearch: 'ab', mSel: null, dataM: {} },
    _srBarHtml_: () => '<div class="srb-bar" id="BAR"></div>', _srIsAdmin_: () => true, splitGhepBtnHtml_: () => '<i id="GHEP"></i>', splitRatioBtnHtml_: () => '<i id="RATIO"></i>',
    splitFixPanelHtml_: () => '<p id="FIXP">fix</p>', splitMBodyHtml_: () => '<table id="TB"><tr><td>dòng</td></tr></table>', _srMClick_: function () {}, _srMFbChange_: function () {} };
  ctx.document = { readyState: 'complete', addEventListener() {}, getElementById: id => els[id] };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((frame ? fs.readFileSync(path.join(root, 'js/68-ui-kit.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/76-report-frame.js'), 'utf8') + '\n' : '') + fn(src, 'renderSalesReportTabM_'), ctx);
  ctx._els = els; return ctx;
}
const run = (src, frame, loading) => { const c = mk(src, frame, loading), w = { innerHTML: '' }; c.document.getElementById = id => (w.innerHTML.indexOf('id="' + id + '"') >= 0 ? (c._els[id] = c._els[id] || {}) : null); c.renderSalesReportTabM_(w); return { h: w.innerHTML, els: c._els }; };
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
for (const loading of [false, true]) {
  const nm = loading ? 'đang tải' : 'có dữ liệu', a = run(old, false, loading), b0 = run(cur, false, loading), b = run(cur, true, loading);
  t(a.h === b0.h, 'M "' + nm + '": thiếu js/76 → HTML y hệt bản cũ');
  const miss = text(a.h).filter(x => !text(b.h).includes(x) && x !== 'Đang tải…'); t(!miss.length, 'M "' + nm + '": qua khuôn đủ chữ bản cũ' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
  t(b.h.indexOf('data-rf="M"') >= 0 && ['id="BAR"', 'id="GHEP"', 'id="sr-fix-btn"', 'id="sr-m-fix"'].every(s => b.h.indexOf(s) >= 0 || s === 'id="sr-fix-btn"') && /id="sr-m-fix"/.test(b.h), 'M "' + nm + '": gắn data-rf, thanh lọc + công cụ + bảng Sửa lệch (id sr-m-fix) còn');
  if (loading) t(/rf-loading/.test(b.h) && !/sr-m-body/.test(b.h), 'M: đang tải giữ thanh lọc/công cụ, không nội dung');
  else { t(b.h.indexOf('id="sr-m-body"') > b.h.indexOf('id="sr-m-fix"') && /id="TB"/.test(b.h), 'M: nội dung nằm trong #sr-m-body, sau bảng Sửa lệch'); t(typeof (b.els['sr-m-body'] || {}).onclick === 'function' && typeof (b.els['sr-m-body'] || {}).onchange === 'function', 'M: onclick/onchange vẫn gắn vào #sr-m-body'); }
}
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
