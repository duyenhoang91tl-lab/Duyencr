#!/usr/bin/env node
// Test UI cam ket KPI (js/12, khoi "CAM KET KPI 8b-3"): gop commit da duyet vao cot Commit, the nhap/duyet, goi dung action. Chay: node tools/test-kpi-commit-ui.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '12-fn-rendersalesreporttabe.js'), 'utf8');
const blk = src.slice(src.indexOf('var _kcState'));
const calls = []; let listResp;
const ctx = { console, Date, JSON, Math, Object, Number, String, Array, encodeURIComponent, setTimeout: f => { calls.push('timer'); }, gsUrl: 'https://gas/x',
  localStorage: { getItem: () => 'TK' }, toast: m => calls.push('toast:' + m), prompt: () => 'khong du so',
  esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
  _srState: { fDateFrom: '2026-11-01', sub: 'F' }, renderSalesReportTab: () => calls.push('render'), _srLoad: () => calls.push('srload'),
  document: { getElementById: id => ({ 'kc-amt': { value: '120' }, 'kc-name': { value: 'Lan' } })[id] },
  fetch: async (url, o) => { calls.push((o && o.method || 'GET') + ' ' + (o && o.body ? JSON.parse(o.body).action : url.split('action=')[1].split('&')[0])); if (o && o.body) calls.push(o.body); return { json: async () => (o && o.body ? { ok: true } : listResp) }; } };
vm.createContext(ctx); vm.runInContext(blk, ctx);
ok(ctx._kcPeriod_() === '2026-11', 'ky = thang cua fDateFrom');
// chua tai: the "dang tai", rows khong doi
ok(/đang tải/.test(ctx._srKpiCommitCardHtml_([])), 'chua co data -> dang tai');
const rows = [{ name: 'Lan', revenue: 50e6, commit: 100e6, pctCommit: 50 }, { name: 'Hà', revenue: 30e6, commit: null, pctCommit: null }];
ok(ctx._srKpiMergeCommit_(rows) === rows, 'chua co data -> giu nguyen rows');
listResp = { ok: true, period: '2026-11', canApprove: true, requireApproval: true, pending: 1, myNames: ['Quản lý'], rows: [
  { sale: 'Lan', amount: 80e6, approvedAmount: null, status: 'pending', effective: { commit: 100e6, source: 'override', pendingAmount: 80e6 } },
  { sale: 'Hà', amount: 60e6, approvedAmount: 60e6, status: 'approved', effective: { commit: 60e6, source: 'commitment' } }] };
(async () => {
  await ctx._kcLoad_();
  ok(calls.includes('GET kpiCommitList'), 'goi kpiCommitList');
  const m = ctx._srKpiMergeCommit_(rows);
  ok(m[0].commit === 100e6 && m[0].pctCommit === 50, 'ban cho duyet KHONG doi commit (van 100tr): ' + JSON.stringify(m[0]));
  ok(m[1].commit === 60e6 && m[1].pctCommit === 50, 'da duyet 60tr -> %HT = 30/60 = 50: ' + JSON.stringify(m[1]));
  ok(rows[1].commit === null, 'khong sua doi tuong goc');
  const h = ctx._srKpiCommitCardHtml_(rows);
  ok(/Chờ duyệt/.test(h) && /Đã duyệt/.test(h) && /_kcDecide_\(this\.dataset\.s,'approve'\)/.test(h) && /kc-name/.test(h), 'quan ly: thay nut Duyet/Tu choi + o nhap ho');
  ok((h.match(/_kcDecide_\(this\.dataset\.s,'approve'\)/g) || []).length === 1, 'chi dong cho duyet co nut Duyet');
  calls.length = 0; await ctx._kcDecide_('Lan', 'reject');
  ok(calls.some(c => /"action":"kpiCommitDecide"/.test(c) && /"decision":"reject"/.test(c) && /"sale":"Lan"/.test(c) && /"token":"TK"/.test(c) && /"period":"2026-11"/.test(c) && /khong du so/.test(c)), 'tu choi gui dung action/ky/ly do/token: ' + calls.join(' | '));
  calls.length = 0; await ctx._kcSubmit_();
  ok(calls.some(c => /"action":"kpiCommitSubmit"/.test(c) && /"amount":120000000/.test(c) && /"sale":"Lan"/.test(c)), 'nhap ho: 120 trieu = 120000000, sale tu o ten: ' + calls.join(' | '));
  // sale thuong: khong co nut duyet, khong o ten
  ctx._kcState.data = { ok: true, period: '2026-11', canApprove: false, requireApproval: true, pending: 0, myNames: ['Lan'], rows: [{ sale: 'Lan', amount: 80e6, status: 'pending', effective: { commit: 100e6 } }] };
  const h2 = ctx._srKpiCommitCardHtml_(rows);
  ok(!/_kcDecide_/.test(h2) && !/kc-name/.test(h2) && /Gửi cam kết/.test(h2) && /value="80"/.test(h2), 'sale thuong: chi o gui cam ket cua minh (80tr dien san), khong nut duyet');
  // so tien sai
  ctx.document.getElementById = id => ({ value: '' }); calls.length = 0; await ctx._kcSubmit_();
  ok(!calls.some(c => /POST/.test(c)) && calls.some(c => /lớn hơn 0/.test(c)), 'so rong -> khong gui');
  // loi GAS cu
  ctx._kcState.data = null; ctx._kcState.period = ''; ctx.fetch = async () => { throw new Error('x'); }; await ctx._kcLoad_(true);
  ok(/deploy GAS/.test(ctx._srKpiCommitCardHtml_([])), 'GAS chua deploy -> bao ro, khong vo bao cao');
  console.log('ALL KPI-COMMIT-UI TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
