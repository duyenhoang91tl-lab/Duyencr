#!/usr/bin/env node
// Test _gsFetchTO_ (js/01): tu thu lai nhanh khi loi THOANG QUA (404/502/503/504, loi mang), khong thu lai khi het gio hoac ma khac. Chay: node tools/test-gsfetch-retry.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '01-fn-splitmulti.js'), 'utf8');
const a = src.indexOf('function _gsFetchTO_('), b = src.indexOf('async function syncFromGS(');
let fails = 0; const eq = (x, y, m) => { if (JSON.stringify(x) !== JSON.stringify(y)) { fails++; console.log('FAIL', m, '\n  co :', JSON.stringify(x), '\n  can:', JSON.stringify(y)); } else console.log('ok  ', m); };
function mk(script) {   // script = mang buoc: so (ma HTTP) | 'net' (loi mang) | 'abort'
  const calls = []; let n = 0;
  const ctx = { setTimeout, clearTimeout, AbortController, Promise,
    fetch: (url) => { calls.push(url); const st = script[Math.min(n++, script.length - 1)];
      if (st === 'net') return Promise.reject(new TypeError('Failed to fetch'));
      if (st === 'abort') { const e = new Error('aborted'); e.name = 'AbortError'; return Promise.reject(e); }
      return Promise.resolve({ status: st, ok: st >= 200 && st < 300, text: () => Promise.resolve('body' + st) }); } };
  vm.createContext(ctx); ctx._GS_RETRY_DELAYS_ = [5, 5]; vm.runInContext(src.slice(a, b), ctx);
  return { ctx, calls };
}
const run = async (script) => { const { ctx, calls } = mk(script); try { const r = await ctx._gsFetchTO_('u', 2000); return { calls: calls.length, status: r.status, body: await r.text() }; } catch (e) { return { calls: calls.length, error: e.name || String(e) }; } };
(async () => {
  eq(await run([200]), { calls: 1, status: 200, body: 'body200' }, '200 -> 1 lan goi, khong thu lai');
  eq(await run([502, 200]), { calls: 2, status: 200, body: 'body200' }, '502 roi 200 -> thu lai 1 lan, ra du lieu');
  eq(await run([404, 404, 200]), { calls: 3, status: 200, body: 'body200' }, '404 (Apps Script vua deploy) 2 lan roi 200 -> thanh cong o lan 3');
  eq(await run([503, 504, 502]), { calls: 3, status: 502, body: 'body502' }, 'loi mai -> toi da 3 lan roi tra ma loi cuoi (callers xu ly nhu cu)');
  eq(await run([404]), { calls: 3, status: 404, body: 'body404' }, '404 vinh vien -> 3 lan roi tra 404 (khong lap vo han)');
  eq(await run(['net', 200]), { calls: 2, status: 200, body: 'body200' }, 'loi mang chop roi 200 -> thu lai');
  eq(await run(['net', 'net', 'net']), { calls: 3, error: 'TypeError' }, 'mat mang that -> 3 lan roi nem loi nhu cu');
  eq(await run(['abort', 200]), { calls: 1, error: 'AbortError' }, 'HET GIO (abort) -> KHONG thu lai (da cho lau), nem loi nhu cu');
  for (const code of [400, 401, 403, 500]) eq(await run([code, 200]), { calls: 1, status: code, body: 'body' + code }, code + ' -> khong thuoc loi thoang qua, khong thu lai');
  // thoi gian that voi do tre mac dinh (khong sua bien) — chi kiem tra khong thu lai thi tra ngay
  const { ctx } = mk([200]); const t0 = Date.now(); await ctx._gsFetchTO_('u', 2000); eq(Date.now() - t0 < 200, true, 'thanh cong ngay lan dau -> khong tre');
  const fresh = vm.createContext({ setTimeout, clearTimeout, AbortController, Promise, fetch: () => Promise.resolve({ status: 200, ok: true, text: () => Promise.resolve('') }) }); vm.runInContext(src.slice(a, b), fresh);
  eq(vm.runInContext('typeof _GS_RETRY_DELAYS_', fresh), 'undefined', 'khong ghi de -> dung mac dinh trong ham (1.5s roi 4s, toi da them ~5.5s)');
  { let n = 0; const f2 = vm.createContext({ setTimeout: (fn, ms) => { f2.delaysSeen.push(ms); return setTimeout(fn, 1); }, clearTimeout, AbortController, Promise, delaysSeen: [], fetch: () => Promise.resolve({ status: ++n < 3 ? 502 : 200, ok: n >= 3, text: () => Promise.resolve('') }) }); vm.runInContext(src.slice(a, b), f2); await f2._gsFetchTO_('u', 5000); eq(f2.delaysSeen.filter((m) => m !== 5000), [1500, 4000], 'do tre mac dinh dung 1500ms roi 4000ms'); }
  console.log(fails ? '\n' + fails + ' CA SAI' : '\nALL GSFETCH RETRY TESTS PASSED'); process.exit(fails ? 1 : 0);
})();
