#!/usr/bin/env node
// Test (2026-10-26): _gsFetchTO_ (js/01) — fetch co gioi han thoi gian cho syncFromGS: yeu cau treo bi cat, yeu cau binh thuong khong bi anh huong.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/01-fn-splitmulti.js', 'utf8');
const i = src.indexOf('function _gsFetchTO_('); let d = 0, j = src.indexOf('{', i), end = -1;
for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) { end = k + 1; break; } }
const code = src.slice(i, end);
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const mkCtx = (fetchImpl) => { const c = { setTimeout, clearTimeout, AbortController, fetch: fetchImpl, Promise }; vm.createContext(c); vm.runInContext(code, c); return c; };
const hang = (url, o) => new Promise((res, rej) => { o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))); });
const fast = (body) => (url, o) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) });
const slowBody = (url, o) => Promise.resolve({ ok: true, status: 200, text: () => new Promise((res, rej) => { o.signal.addEventListener('abort', () => rej(new Error('body aborted'))); }) });
(async () => {
  let c = mkCtx(hang), t0 = Date.now();
  ok(await c._gsFetchTO_('u', 60).then(() => false, (e) => e.name === 'AbortError') && Date.now() - t0 < 500, 'yeu cau treo (khong tra ve) bi cat sau het gio');
  c = mkCtx(slowBody);
  const r = await c._gsFetchTO_('u', 60); ok(await r.text().then(() => false, (e) => /aborted/.test(e.message)), 'co header nhung than phan hoi treo -> text() cung bi cat');
  c = mkCtx(fast('{"a":1}')); const r2 = await c._gsFetchTO_('u', 60); ok((await r2.text()) === '{"a":1}', 'yeu cau binh thuong: doc dung noi dung');
  await new Promise((r) => setTimeout(r, 120)); ok(true, 'het gio sau khi da doc xong khong gay loi (dong ho da huy)');
  c = mkCtx(() => Promise.reject(new Error('mang'))); ok(await c._gsFetchTO_('u', 60).then(() => false, (e) => e.message === 'mang'), 'loi mang duoc nem nguyen ven');
  const c2 = { setTimeout, clearTimeout, fetch: (u, o) => Promise.resolve({ marker: o && o.redirect }), Promise }; vm.createContext(c2); vm.runInContext(code, c2);
  ok((await c2._gsFetchTO_('u', 60)).marker === 'follow', 'trinh duyet khong co AbortController: van goi fetch redirect follow (khong bo cuoc)');
  console.log(bad ? ('\n' + bad + ' LOI') : '\nALL GS-FETCH-TIMEOUT TESTS PASSED'); process.exit(bad ? 1 : 0);
})();
