#!/usr/bin/env node
// Test (Duyen 2026-11-09): Bao cao B mo lan dau khong chon ngay -> request salesReportB co dateFrom/dateTo RONG (tinh toan bo don) -> vuot 55s "signal is aborted".
// Nay lan DAU trong phien tu dat "Thang nay"; neu nguoi dung CHU DONG xoa ngay thi ton trong. Chay ham THAT trong js/11-fn-srload.js + js/10-fn-pkkpipct.js.
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const calls = [];
const ctx = { console, setTimeout, clearTimeout, encodeURIComponent, Date, JSON, Object, Array, String, Promise, Math,
  gsUrl: 'https://x.test/exec', AbortController, document: {}, window: {}, renderSalesReportTab() {}, _hLoadManual_() {}, _hLoadChot_() {},
  fetch: async url => { calls.push(url); return { ok: true, text: async () => '{"totalOrders":0,"bySale":[]}' }; } };
vm.createContext(ctx);
function grab(file, startRe) { const s = R(file); const i = s.search(startRe); let d = 0, j = s.indexOf('{', i); for (let k = j; k < s.length; k++) { if (s[k] === '{') d++; else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); } } }
vm.runInContext(grab('js/04-fn-synczalophonesettingsfromgas.js', /function _ymd\(d\)/), ctx);
vm.runInContext(grab('js/10-fn-pkkpipct.js', /function _pkQuickRange\(key\)/), ctx);
vm.runInContext(grab('js/10-fn-pkkpipct.js', /async function _srFetch\(/), ctx);
vm.runInContext(grab('js/11-fn-srload.js', /async function _srLoad\(\)/), ctx);
vm.runInContext("var _srState = { sub: 'B', dateFrom: '', dateTo: '', dateQuick: 'custom', bSale: [], bNguon: [], bMarketer: [], bCareStatus: [], bKhStatus: [], bZaloStatus: [] }; function _srStoreForBOk_() { return false; }", ctx);
(async () => {
  const q = u => Object.fromEntries(new URL(u).searchParams);
  await vm.runInContext('_srLoad()', ctx);
  let p = q(calls[0]); const y = new Date().getFullYear(), m = String(new Date().getMonth() + 1).padStart(2, '0');
  ok(p.action === 'salesReportB' && p.dateFrom === y + '-' + m + '-01' && /^\d{4}-\d\d-\d\d$/.test(p.dateTo), 'mo B lan dau khong chon ngay -> goi voi THANG NAY (' + p.dateFrom + ' .. ' + p.dateTo + '), khong con rong');
  ok(vm.runInContext('_srState.dateQuick', ctx) === 'thisMonth', 'o chon nhanh hien "Thang nay"');
  vm.runInContext("_srState.dateFrom = ''; _srState.dateTo = ''; _srState.dateQuick = 'custom';", ctx);   // nguoi dung CHU DONG xoa ngay de xem tat ca
  await vm.runInContext('_srLoad()', ctx);
  p = q(calls[1]); ok(p.dateFrom === '' && p.dateTo === '', 'nguoi dung chu dong xoa ngay -> ton trong (khong ep lai Thang nay)');
  vm.runInContext("_srState.dateFrom = '2026-10-01'; _srState.dateTo = '2026-10-31';", ctx);
  await vm.runInContext('_srLoad()', ctx);
  p = q(calls[2]); ok(p.dateFrom === '2026-10-01' && p.dateTo === '2026-10-31', 'da chon ngay -> giu nguyen');
  // thong bao khi bi huy 55s ma khong co ngay
  ctx.fetch = async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; };
  await vm.runInContext("_srFetch('salesReportB', { dateFrom: '', dateTo: '' })", ctx);
  ok(/TẤT CẢ thời gian/.test(vm.runInContext('_srState.lastFetchError', ctx)), 'bi huy 55s khi chua chon ngay -> noi ro "dang xem TAT CA thoi gian"');
  await vm.runInContext("_srFetch('salesReportB', { dateFrom: '2026-01-01', dateTo: '2026-10-31' })", ctx);
  ok(/quá rộng/.test(vm.runInContext('_srState.lastFetchError', ctx)), 'co ngay ma van huy -> thong bao khoang ngay qua rong nhu cu');
  console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA QUA'); process.exit(fails ? 1 : 0);
})();
