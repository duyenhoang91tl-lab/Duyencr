// Test tang toc tai bao cao (js/10 cache + js/11 _srLoad): B/E chay SONG SONG store+Pos, duong XEM dung cache, duong GHI lay so moi, loi khong bi ghi de. Chay: node tools/test-srload-fast.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function grab(src, startRe) { const i = src.search(startRe); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const s10 = R('js/10-fn-pkkpipct.js'), s11 = R('js/11-fn-srload.js');
let log = [], t0 = 0, delays = { salesReportB: 80, storeCaseReport: 80 }, failAction = '', calls = 0;
const ctx = {
  gsUrl: 'https://gs/exec', AbortController, setTimeout, clearTimeout, encodeURIComponent, Date, Object, Promise, Array, String, JSON,
  _srState: { sub: 'B', bAutoMonthDone_: true, dateFrom: '2026-11-01', dateTo: '2026-11-30', eDateFrom: '2026-11-01', eDateTo: '2026-11-30', bSale: [], eSale: [] },
  renderSalesReportTab() {}, _srStoreForBOk_: () => true, _srRegisterIdentity_() {}, _hLoadManual_() {}, _hLoadChot_() {}, _pkQuickRange: () => null,
  fetch: async (u) => {
    const a = /action=(\w+)/.exec(u)[1]; calls++; log.push(a + '@' + (Date.now() - t0));
    await new Promise(r => setTimeout(r, delays[a] || 10));
    if (a === failAction) return { ok: false, status: 500 };
    return { ok: true, text: async () => JSON.stringify(a === 'storeCaseReport' ? { ok: true, rows: [1] } : { orders: [{ saleBanValid: 'A', theSale: 'A', giaTriSauGiam: 5, ngayTaoDon: '2026-11-02' }], totalOrders: 1 }) };
  }
};
vm.createContext(ctx);
vm.runInContext(s10.slice(s10.indexOf('var _SR_CACHE_ACTIONS_'), s10.indexOf('// Dung chung cho MOI man hinh bao cao')), ctx);
vm.runInContext(grab(s11, /async function _srLoad\(/) + '\n' + grab(s11, /function _srApply\(/) + '\nfunction _srSetSub(sub){ _srState.sub = sub; _srLoad(true); }', ctx);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } else console.log('OK   ' + m); };
(async () => {
  // B lan dau: song song
  t0 = Date.now(); log = []; await ctx._srLoad(true); let dt = Date.now() - t0;
  ok(dt < 140, 'B: store + salesReportB chay song song (' + dt + 'ms, noi tiep ~170ms)');
  ok(ctx._srState.dataB && ctx._srState.dataBStore && ctx._srState.dataBStore.rows.length === 1, 'B: du lieu B + store deu co');
  // Xem lai (duong XEM) -> cache
  calls = 0; await ctx._srLoad(true); ok(calls === 0, 'B: bam Loc lai ngay (duong XEM) = 0 request (calls=' + calls + ')');
  // Duong GHI -> so moi
  calls = 0; await ctx._srLoad(); ok(calls === 2, 'B: duong GHI (_srLoad khong tham so) lay so MOI (calls=' + calls + ')');
  // Sau duong GHI, cache bi xoa -> xem lai van phai lay moi 1 lan
  calls = 0; await ctx._srLoad(true); ok(calls === 0, 'B: sau khi GHI da nap lai cache nen XEM tiep nhanh (calls=' + calls + ')');
  // Store loi KHONG lam hong B, khong hien loi
  ctx._srCacheClear_(); failAction = 'storeCaseReport'; await ctx._srLoad(); ok(ctx._srState.dataB && !ctx._srState.dataBStore && !ctx._srState.lastFetchError, 'B: store loi -> B van hien thi, khong bao loi');
  // B loi -> giu dung loi B
  failAction = 'salesReportB'; ctx._srCacheClear_(); await ctx._srLoad(); ok(ctx._srState.dataB === null && /HTTP 500/.test(ctx._srState.lastFetchError), 'B: B loi -> bao loi HTTP 500, khong bi store ghi de');
  failAction = '';
  // E song song
  ctx._srState.sub = 'E'; ctx._srCacheClear_(); t0 = Date.now(); log = []; await ctx._srLoad(true); dt = Date.now() - t0;
  ok(dt < 140, 'E: store + salesReportB chay song song (' + dt + 'ms)');
  ok(ctx._srState.dataE && ctx._srState.dataE.orders[0].saleBan === 'A' && ctx._srState.dataE.orders[0].giaTriDon === 5 && ctx._srState.dataEStore, 'E: map saleBan/giaTriDon dung + co du lieu store');
  const first = ctx._srState.dataE; calls = 0; await ctx._srLoad(true);
  ok(calls === 0 && ctx._srState.dataE !== first && ctx._srState.dataE.orders[0].saleBan === 'A', 'E: xem lai = 0 request, moi lan nhan ban sao rieng (khong dung chung object bi sua)');
  failAction = 'storeCaseReport'; ctx._srCacheClear_(); await ctx._srLoad(); ok(ctx._srState.dataE && ctx._srState.dataEStoreErr && !ctx._srState.dataEStore && !ctx._srState.lastFetchError, 'E: store loi -> dataEStoreErr co thong bao, E van hien thi');
  failAction = 'salesReportB'; ctx._srCacheClear_(); await ctx._srLoad(); ok(ctx._srState.dataE === null && /HTTP 500/.test(ctx._srState.lastFetchError), 'E: Pos loi -> giu dung loi HTTP 500');
  // _srSetSub la duong xem
  failAction = ''; ctx._srState.dateFrom = '2026-11-01'; await ctx._srSetSub('B'); calls = 0; await ctx._srSetSub('B'); ok(calls === 0, 'doi bao cao (_srSetSub) cung bo loc = dung cache');
  // Doi khoang ngay -> goi moi
  ctx._srState.dateFrom = '2026-10-01'; ctx._srState.dateTo = '2026-10-31'; calls = 0; await ctx._srApply(); ok(calls === 2, 'doi khoang ngay -> goi moi (calls=' + calls + ')');
})();
