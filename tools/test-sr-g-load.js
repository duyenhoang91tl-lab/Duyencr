// Test "bao cao G load mai ko ra" (26/11/2026): (1) _srFetch ton trong timeoutMs rieng + thong bao dung so giay; (2) G ve loi thanh khung do thay vi ket "Dang tai".
// Chay: node tools/test-sr-g-load.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const s10 = fs.readFileSync(path.join(root, 'js/10-fn-pkkpipct.js'), 'utf8');
const part = s10.slice(s10.indexOf('var _SR_CACHE_ACTIONS_'), s10.indexOf('// Dung chung cho MOI man hinh bao cao'));
let mode = 'hang', usedTimeout = [];
const ctx = { gsUrl: 'https://gs/exec', _srState: {}, AbortController, clearTimeout, encodeURIComponent,
  setTimeout: (fn, ms) => { usedTimeout.push(ms); return setTimeout(fn, 20); },   // thu nho thoi gian that, ghi lai ms duoc yeu cau
  fetch: (u, o) => new Promise((res, rej) => { if (mode === 'hang') o.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); else res({ ok: true, text: async () => '{"orders":[]}' }); }) };
vm.createContext(ctx); vm.runInContext(part, ctx);
// render G: lay ham that
const s12 = fs.readFileSync(path.join(root, 'js/12-fn-rendersalesreporttabe.js'), 'utf8');
const i = s12.indexOf('function renderSalesReportTabG_('); let d = 0, k = s12.indexOf('{', i), end = k;
for (; end < s12.length; end++) { if (s12[end] === '{') d++; else if (s12[end] === '}') { d--; if (!d) break; } }
const gctx = { _srState: { loading: false, dataG: null }, esc: x => String(x == null ? '' : x).replace(/</g, '&lt;'), _srGFiltersHtml_: () => '', _srRenderG_: () => { throw new Error('boom du lieu'); },
  uiReportFrame_: o => (o.loading ? 'LOADING' : '') + o.bodyHtml };
vm.createContext(gctx); vm.runInContext(s12.slice(i, end + 1), gctx);
(async () => {
  let r = await ctx._srFetch('salesReportB', { dateFrom: '2026-11-01', dateTo: '2026-12-30' }, false, 150000);
  ok(r === null && usedTimeout.indexOf(150000) >= 0, 'G xin 150000ms thi _srFetchText_ dung 150000ms');
  ok(/quá 150 giây/.test(ctx._srState.lastFetchError), 'thong bao ghi dung 150 giay: ' + ctx._srState.lastFetchError.slice(0, 40));
  usedTimeout = []; await ctx._srFetch('salesReportA', { dateFrom: '2026-11-01', dateTo: '2026-11-30' }, false);
  ok(usedTimeout.indexOf(55000) >= 0 && /quá 55 giây/.test(ctx._srState.lastFetchError), 'khong truyen timeout -> van 55s nhu cu');
  mode = 'ok'; r = await ctx._srFetch('salesReportB', {}, false, 150000); ok(r && Array.isArray(r.orders), 'tra loi binh thuong van doc duoc');
  const wrap = { innerHTML: '' }; gctx.renderSalesReportTabG_(wrap, '');
  ok(/Báo cáo G lỗi khi vẽ: boom du lieu/.test(wrap.innerHTML) && !/LOADING/.test(wrap.innerHTML), 'loi khi ve G -> khung do co noi dung loi, khong ket Dang tai');
  console.log('ALL SR-G-LOAD TESTS PASSED');
})();
