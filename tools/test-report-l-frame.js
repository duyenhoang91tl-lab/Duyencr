#!/usr/bin/env node
// R7b (báo cáo L) — L vẽ qua khuôn uiReportFrame_ mà chữ/số không đổi; thiếu js/76 thì giao diện cũ giữ NGUYÊN từng ký tự. Chạy: node tools/test-report-l-frame.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const src = R('js/11-fn-srload.js');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const line = p => { const i = src.indexOf(p); return src.slice(i, src.indexOf('};', i) + 2); };
const NAMES = ['renderSalesReportTabL_', '_srRenderL_', '_srLDetailTable_', '_srLOrderHtml_', '_srLAcctHtml_', '_srLTienLbl_', '_srLAcctBadge_', '_srLDmy_', '_srLRowMatchesSearch_', '_srLCardsHtml_', '_srLRows_', '_srLStats_', '_srLTopHtml_', '_srLWarnHtml_', '_srLTablesHtml_'];
function load(frame) {
  const c = { console, esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])), fmt: n => String(n || 0), _srMoney: n => Math.round(n || 0) + '₫',
    _srState: { dataL: null, loading: false, lSearch: '', lastFetchError: '' }, _srBarHtml_: () => '<div class="srb-bar">BAR</div>', _srTotalRowHtml_: a => '<tr class="tot"><td>' + a.join('</td><td>') + '</td></tr>',
    _custLinkHtml_: (p, i) => i, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} } };
  c.window = c; vm.createContext(c);
  vm.runInContext((frame ? R('js/68-ui-kit.js') + '\n' + R('js/76-report-frame.js') + '\n' : '') + line('var _SR_L_STATUS_') + '\n' + NAMES.map(fn).join('\n'), c); return c;
}
const data = { ok: true, sharePct: 30, note: 'ghi chú', sheetName: 'T10', sheetId: 'abc', totals: { dongHen: 10, dongCoDon: 4, soDon: 5, doanhThuDon: 5000000, daTinh: 1500000, trungBoQua: 200000 },
  dataQuality: { thieuSdt: 2, thieuNgay: 0, thieuSale: 1 }, unresolved: [{ raw: 'ngaa', count: 2 }],
  acctCheck: { ok: true, soMa: 5, tabs: ['t'], summary: { daGhi: 2, chuaGhi: 1, thieuMa: 0 }, missing: [] },
  bySale: [{ sale: 'Ngà', khHen: 6, khCoDon: 3, soDon: 3, doanhThuDon: 3000000, credited: 900000, dupSkipped: 0 }, { sale: 'Ninh', khHen: 4, khCoDon: 1, soDon: 2, doanhThuDon: 2000000, credited: 600000, dupSkipped: 100000 }],
  rows: [{ row: 3, visitDates: ['2026-10-10'], ngayHen: '10/10', tenKh: 'A', phone: '0900000001', sales: [{ name: 'Ngà', raw: 'ngà' }], orders: [], flags: ['f1'] }] };
const cases = { 'đủ dữ liệu': [data], 'rỗng bảng': [Object.assign({}, data, { bySale: [], rows: [] })], 'không có kế toán/cảnh báo': [Object.assign({}, data, { acctCheck: null, unresolved: [], dataQuality: {} })] };
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
function run(c, d, loading) { c._srState.dataL = d; c._srState.loading = !!loading; const w = { innerHTML: '' }; c.renderSalesReportTabL_(w, null); return w.innerHTML; }
const A = load(true), B = load(false);
for (const k in cases) {
  const a = text(run(A, cases[k][0])), b = text(run(B, cases[k][0])), miss = b.filter(x => !a.includes(x));
  t(!miss.length, 'L "' + k + '": mọi chữ/số của bản cũ còn đủ trong bản khuôn' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
}
// bản dự phòng = ghép lại đúng như cũ: thẻ → đối chiếu → cảnh báo → bảng
const old = run(B, data), pos = ['kpi-grid', 'Đối chiếu file kế toán', 'thiếu SĐT', 'Theo Sale', 'sr-l-detail'].map(s => old.indexOf(s));
t(pos.every(i => i >= 0) && pos.every((v, i) => !i || v > pos[i - 1]), 'dự phòng giữ thứ tự cũ: thẻ → đối chiếu → cảnh báo → Theo Sale → chi tiết');
t(/kpi-card/.test(old) && !/rf-/.test(old), 'thiếu js/76 → giao diện cũ (kpi-card), không có khối rf-');
const h = run(A, data), p2 = ['srb-bar', 'thiếu SĐT', 'ui-stat-grid', 'Đối chiếu file kế toán', 'Theo Sale', 'sr-l-detail'].map(s => h.indexOf(s));
t(p2.every(i => i >= 0) && p2.every((v, i) => !i || v > p2[i - 1]), 'khuôn: thanh lọc → cảnh báo → thẻ số → đối chiếu → Theo Sale → chi tiết');
t(/id="sr-l-detail"/.test(h) && /_srLRerenderDetail_\(\)/.test(h), 'ô tìm chi tiết + vùng sr-l-detail vẫn còn (tìm kiếm không hỏng)');
t((h.match(/ui-stat ui-tone/g) || []).length === 7 && /ui-tone-danger/.test(h) && /ui-tone-success/.test(h) && /ui-tone-warning/.test(h), '7 thẻ số (đủ thẻ "Đơn KT chưa ghi"), màu theo ý nghĩa: chia Sale xanh, bỏ qua vàng, KT chưa ghi đỏ');
t((run(A, Object.assign({}, data, { acctCheck: null })).match(/ui-stat ui-tone/g) || []).length === 6, 'không có kế toán → 6 thẻ');
t(/rf-loading/.test(run(A, data, true)) && !/Theo Sale/.test(run(A, data, true)), 'đang tải: không bảng');
const er = run(A, { ok: false, error: 'sai<b>' }); t(/rf-error/.test(er) && /sai&lt;b&gt;/.test(er) && /_srApply\(\)/.test(er) && /BAR/.test(er), 'lỗi: escape + nút Thử lại + vẫn có thanh lọc');
t(/rf-empty/.test(run(A, null)) && /bấm &quot;Lọc&quot;/.test(run(A, null)), 'chưa có dữ liệu: hiện hướng dẫn bấm Lọc');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
