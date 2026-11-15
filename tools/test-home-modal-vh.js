#!/usr/bin/env node
// Test: hộp danh sách chip Tổng quan (js/36 hmOpenList) không dùng vh (WebView Android kẹt vh=0 → hộp chỉ còn dải trắng). Chạy: node tools/test-home-modal-vh.js
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync('js/36-fn-homechips.js', 'utf8');
function run(innerH) {
  let html = '', css = '';
  const modal = { style: {}, set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const doc = { createElement: () => modal, getElementById: () => null, body: { appendChild() {} }, addEventListener() {} };
  const sb = { console, document: doc, window: { innerHeight: innerH }, setInterval() {}, setTimeout() {}, esc: x => String(x == null ? '' : x), hmRenderChips() {},
  };
  vm.createContext(sb); vm.runInContext(src + '\nthis.f = { hmModalMaxH_, hmOpenList };', sb);
  sb._hmLast = { cfg: { cycle: 30, idle: 7 }, overdue: [{ phone: '0901', name: 'A', label: 'x' }], today: [], rebuy: [], idle: [] };   // script tự khai báo _hmLast nên gán SAU khi nạp
  return { f: sb.f, html: () => html, modal };
}
let r = run(722);
ok(r.f.hmModalMaxH_(722) === '606px', '722px cao → 84% = 606px');
ok(r.f.hmModalMaxH_(0) === '84%' && r.f.hmModalMaxH_(undefined) === '84%' && r.f.hmModalMaxH_(100) === '84%', 'chưa có kích thước (0/undefined/<120) → 84% theo lớp phủ, không phải 0');
try { r.f.hmOpenList('overdue'); } catch (e) { ok(false, 'hmOpenList văng lỗi: ' + e.message); }
ok(/max-height:606px/.test(r.html()) && !/\d+vh/.test(r.html()), 'hộp dùng px thật, KHÔNG còn đơn vị vh');
ok(/Việc quá hạn \(1\)/.test(r.html()), 'vẫn hiện tiêu đề + số lượng');
r = run(0); try { r.f.hmOpenList('overdue'); } catch (e) {}
ok(/max-height:84%/.test(r.html()), 'innerHeight=0 (WebView chưa đo) → max-height:84%');
console.log(bad ? '\nFAIL ' + bad : '\nPASS tất cả'); process.exit(bad ? 1 : 0);
