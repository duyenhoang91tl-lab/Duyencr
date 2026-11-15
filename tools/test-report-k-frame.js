#!/usr/bin/env node
// R7b (báo cáo K) — K vẽ qua khuôn uiReportFrame_ mà SỐ LIỆU/chữ không đổi so với bản cũ. Chạy: node tools/test-report-k-frame.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
function load(withFrame) {
  const ctx = { console, window: null, location: { search: '' }, document: { readyState: 'complete', addEventListener() {} },
    _srState: { loading: false, kMonth: '2026-11', dataK: null, lastFetchError: '' },
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    _srMoney: n => Math.round(n || 0).toLocaleString('en-US') + '₫', _srBarHtml_: d => '<div class="srb-bar">BAR' + (d || '') + '</div>',
    _srIsAdmin: () => true, _srPosMonthClose_() {}, _srLoad() {}, _srFetch() {} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((withFrame ? R('js/68-ui-kit.js') + '\n' + R('js/76-report-frame.js') + '\n' : '') + R('js/67-report-k.js'), ctx); return ctx;
}
const data = { ok: true, applied: true, month: '2026-11', prevMonth: '2026-10', closedAt: '30/10/2026', canClose: true, closedMonths: ['2026-10'],
  total: { revenue: 30000000, deduction: 1500000, net: 28500000 },
  rows: [{ name: 'Ngà', group: 'Online', revenue: 20000000, deduction: 1500000, net: 18500000 }, { name: 'Ninh', group: 'Văn phòng', revenue: 10000000, deduction: 0, net: 10000000 }],
  recon: { allTotal: 35000000, inScope: 30000000, outsideTotal: 5000000, unattributed: 0, outsideCount: 3, outside: [{ name: 'X', revenue: 3000000 }, { name: 'Y', revenue: 2000000 }] } };
const text = h => h.replace(/<[^>]+>/g, '|').split('|').map(x => x.trim()).filter(Boolean);
function run(ctx, d, loading) { ctx._srState.dataK = d; ctx._srState.loading = !!loading; const w = { innerHTML: '' }; ctx.renderSalesReportTabK_(w, null); return w.innerHTML; }

const A = load(true), B = load(false);   // A = có khuôn, B = dự phòng (giao diện cũ)
const cases = { 'đủ dữ liệu': data, 'chưa áp dụng': Object.assign({}, data, { applied: false, reason: 'Chưa chốt' }),
  'không có sale': Object.assign({}, data, { rows: [], total: { revenue: 0, deduction: 0, net: 0 } }) };
for (const k in cases) {
  const a = text(run(A, cases[k])), b = text(run(B, cases[k]));
  const miss = b.filter(x => !a.includes(x) && !/CSV/.test(x));
  t(!miss.length, 'K "' + k + '": mọi chữ/số của bản cũ còn đủ trong bản khuôn' + (miss.length ? ' — THIẾU: ' + miss.join(' | ') : ''));
}
const h = run(A, data);
const pos = ['srb-bar', 'ui-stat-grid', 'dash-table', 'Đối chiếu với Báo cáo B', 'rf-export', 'Chốt tháng này làm mốc'].map(s => h.indexOf(s));
t(pos.every(i => i >= 0) && pos.every((v, i) => !i || v > pos[i - 1]), 'thứ tự: thanh lọc → thẻ số → bảng → đối chiếu → Xuất → khối chốt tháng');
t(/onclick="_srKCsv_\(\)"/.test(h) && /onclick="_srKShift_\(-1\)"/.test(h) && /_srKSetMonth_\(this\.value\)/.test(h), 'nút CSV + chuyển tháng vẫn gọi đúng hàm cũ');
t(/28,500,000₫/.test(h) && /−1,500,000₫/.test(h) && /… và 1 sale khác/.test(h), 'số liệu mẫu đúng (sau hoàn/hủy, trừ, "… và 1 sale khác")');
const ld = run(A, data, true); t(/rf-loading/.test(ld) && !/dash-table/.test(ld) && !/Chốt tháng này/.test(ld), 'đang tải: không bảng, không khối chốt');
const er = run(A, { ok: false, error: 'sai<b>' }); t(/rf-error/.test(er) && /sai&lt;b&gt;/.test(er) && /_srLoad\(\)/.test(er) && /Chốt tháng này/.test(er), 'lỗi: escape + nút Thử lại + vẫn có khối chốt tháng (như cũ)');
t(/dash-table/.test(run(B, data)) && !/rf-/.test(run(B, data)), 'thiếu js/76 → tự dùng giao diện cũ');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');
