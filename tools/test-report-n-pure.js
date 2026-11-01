#!/usr/bin/env node
// Test "Báo cáo N — Tính đơn thuần" (tách khỏi cuối Báo cáo B, Duyên 2026-10-23). Chạy: node tools/test-report-n-pure.js -> "REPORT N PURE TESTS PASSED".
// N = chế độ xem của B (sub 'B' + bView 'pure'): kiểm chuyển báo cáo, ẩn/hiện theo cấu hình, và code js/11 đã gỡ khỏi B + gắn vào N.
const fs = require('fs'), vm = require('vm'), path = require('path');
const j06 = fs.readFileSync(path.join(__dirname, '..', 'js', '06-main-renew-sources.js'), 'utf8');
const j11 = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const a = j06.indexOf('var _SR_DEFAULT_ITEMS_'), b = j06.indexOf('setTimeout(_syncReportsCfgFromGAS'); ok(a > 0 && b > a, 'tim thay khoi js/06');
const ctx = { loadLS: () => null, saveLS() {}, gsUrl: '', fetch: async () => ({}), _srState: { sub: 'A' }, _srIsAdmin: () => false, esc: s => String(s) };
vm.createContext(ctx); vm.runInContext(j06.slice(a, b), ctx);
const run = e => vm.runInContext(e, ctx);
// (1) N có trong danh sách, đứng sau M
ok(run('_srItems_().map(function(i){return i[0]}).join(",")').endsWith('L,M,N') && run('_srItems_().filter(function(i){return i[0]==="N"})[0][1]') === 'Báo cáo N — Tính đơn thuần', 'N co trong danh sach bao cao');
// (2) chuyển báo cáo: N => sub B + bView pure; mã khác xóa cờ; ô chọn hiện đúng N / B
run('_srApplySub_("N")'); ok(run('_srState.sub') === 'B' && run('_srState.bView') === 'pure' && run('_srCurCode_()') === 'N', 'chon N => sub B + bView pure, ma hien thi N');
run('_srApplySub_("B")'); ok(run('_srState.sub') === 'B' && !run('_srState.bView') && run('_srCurCode_()') === 'B', 'chon B => xoa co pure');
run('_srApplySub_("N")'); run('_srApplySub_("E")'); ok(run('_srState.sub') === 'E' && !run('_srState.bView') && run('_srCurCode_()') === 'E', 'tu N sang E: xoa co pure');
run('_srState.sub = "K"; _srState.bView = ""'); ok(run('_srCurCode_()') === 'G', 'K van hien nhu G');
// (3) cấu hình ẩn: người thường đang ở N mà N bị ẩn => chuyển sang báo cáo bật đầu tiên (A) và xóa cờ; B bị ẩn nhưng N bật => KHÔNG đuổi khỏi N
run('_rcApply_({ N: { enabled: false } })'); run('_srApplySub_("N")');
ok(run('_srEnsureSubAllowed_()') === true && run('_srState.sub') === 'A' && !run('_srState.bView'), 'N bi an => nguoi thuong chuyen sang A, xoa co pure');
run('_rcApply_({ B: { enabled: false } })'); run('_srApplySub_("N")'); ok(run('_srEnsureSubAllowed_()') === false && run('_srCurCode_()') === 'N', 'B an, N bat => van o N');
ctx._srIsAdmin = () => true; run('_rcApply_({ N: { enabled: false } })'); run('_srApplySub_("N")'); ok(run('_srEnsureSubAllowed_()') === false, 'admin khong bi ep chuyen');
// (4) js/11: B KHÔNG còn mục thuần; N hiển thị bảng thuần; chọn báo cáo đi qua _srApplySub_
const rb = j11.slice(j11.indexOf('function _srRenderB(d){'), j11.indexOf('function _srRenderB(d){') + 20000);
const rbEnd = rb.indexOf('\n}\n'); ok(rbEnd > 0, 'tach duoc than _srRenderB');
ok(!rb.slice(0, rbEnd).includes('_srPurePanelHtml_'), '_srRenderB khong con goi bang thuan (da tach)');
ok(/else if \(_srState\.bView === 'pure'\)\s*\{\s*[^}]*_srRenderPure_\(_srState\.dataB\)/.test(j11), 'renderSalesReportTab: bView pure => _srRenderPure_(dataB)');
ok(/function _srRenderPure_\(d\)\{[^}]*_srPurePanelHtml_\(d\)/.test(j11), '_srRenderPure_ ve bang thuan');
ok(/function _srSetSub\(sub\)\{ _srApplySub_\(sub\); _srLoad\(\); \}/.test(j11), '_srSetSub dung _srApplySub_');
ok(/var cur = _srCurCode_\(\);/.test(j11), 'o chon bao cao dung _srCurCode_');
ok((j11.match(/_srPurePanelHtml_\(/g) || []).length === 2, 'chi con dinh nghia + 1 noi goi (trong _srRenderPure_)');
console.log('REPORT N PURE TESTS PASSED');
