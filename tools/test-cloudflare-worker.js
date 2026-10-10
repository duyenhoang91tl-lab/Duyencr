#!/usr/bin/env node
// Test Node cho cloudflare/worker.mjs (Worker cache truoc Apps Script). Chay: node tools/test-cloudflare-worker.js -> "ALL CLOUDFLARE WORKER TESTS PASSED".
// Khong goi mang that: fetch + caches.default + dong ho deu la gia.
const path = require('path'), { pathToFileURL } = require('url');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const GAS = 'https://script.google.com/macros/s/AKFAKE/exec';
const W = 'https://crm.example.workers.dev/';

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'cloudflare', 'worker.mjs')).href);
  const worker = mod.default;
  // ---- gia lap ----
  let now = 1_000_000_000_000; Date.now = () => now;
  const store = new Map(); let putCount = 0;
  globalThis.caches = { default: {
    async match(req) { const e = store.get(req.url); return e ? new Response(e.text, { status: e.status, headers: e.headers }) : undefined; },
    async put(req, res) { putCount++; store.set(req.url, { text: await res.text(), status: res.status, headers: [...res.headers.entries()] }); } } };
  const calls = []; let originFn = () => ({ status: 200, body: { ok: true, n: calls.length } });
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init: init || {} }); const r = originFn(String(url), init || {}); if (r.throw) throw new Error('mang chet');
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8' } }); };
  const pending = []; const ctx = { waitUntil: p => pending.push(p) };
  const env = { GAS_URL: GAS };
  const req = (qs, init) => new Request(W + (qs ? '?' + qs : ''), init);
  const go = async (qs, init, e) => { const r = await worker.fetch(req(qs, init), e || env, ctx); await Promise.all(pending.splice(0)); return r; };
  const reset = () => { store.clear(); calls.length = 0; putCount = 0; originFn = () => ({ status: 200, body: { ok: true, n: calls.length } }); };

  // ===== chinh sach (cachePolicy) =====
  const P = (m, qs) => mod.cachePolicy(m, new URLSearchParams(qs));
  ok(P('GET', 'action=customers').ttl === 15, 'customers FULL cache 15s');
  ok(P('GET', 'action=customers&since=2026-10-01T00:00:00.000Z').why === 'delta', 'customers delta KHONG cache');
  ok(P('GET', 'action=orders').ttl === 15 && P('GET', 'action=salesReportA&from=1&to=2').ttl === 60 && P('GET', 'action=priceCatalogFlat').ttl === 120, 'ttl theo nhom');
  for (const a of ['lookup', 'reminders', 'users', 'getSetting', 'saveSingle', 'assign', 'sbStatus', 'getGasSource', 'setSetting', 'demoLogin', 'priceSearch', ''])
    ok(P('GET', 'action=' + a).why === 'action', 'action ' + (a || '(rong)') + ' khong duoc cache');
  ok(P('POST', 'action=customers').why === 'method', 'POST khong cache');
  ok(P('GET', 'action=orders&demo=tok').why === 'private-param', 'co demo -> khong cache');
  ok(P('GET', 'action=salesReportA&adminKey=k').why === 'private-param', 'co adminKey -> khong cache');
  ok(P('GET', 'action=toString').why === 'action' && P('GET', 'action=__proto__').why === 'action' && P('GET', 'action=constructor').why === 'action', 'khong bi qua mat khau prototype');
  ok(mod.cacheKeyUrl(W + '?b=2&a=1&action=orders') === mod.cacheKeyUrl(W + '?action=orders&a=1&b=2'), 'khoa cache khong phu thuoc thu tu tham so');
  ok(mod.cacheKeyUrl(W + '?action=orders&x=1') !== mod.cacheKeyUrl(W + '?action=orders&x=2'), 'khac tham so = khac khoa');
  ok(mod.isGoodJson('{"rows":[]}') && mod.isGoodJson('[1,2]') && !mod.isGoodJson('{"error":"x"}') && !mod.isGoodJson('<html>') && !mod.isGoodJson('') && !mod.isGoodJson('"str"') && !mod.isGoodJson('null'), 'isGoodJson');

  // ===== cache MISS -> HIT -> het han -> MISS =====
  reset(); let r = await go('action=orders');
  ok(r.status === 200 && r.headers.get('x-crm-cache') === 'MISS' && calls.length === 1 && putCount === 1, 'lan 1 MISS, goi GAS 1 lan, luu cache');
  ok(calls[0].url === GAS + '?action=orders' && calls[0].init.redirect === 'follow', 'goi dung URL GAS + theo redirect: ' + calls[0].url);
  ok(r.headers.get('access-control-allow-origin') === '*' && /x-crm-cache/.test(r.headers.get('access-control-expose-headers')), 'co CORS');
  const first = await r.text();
  now += 5000; r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1 && (await r.text()) === first, 'sau 5s: HIT, khong goi GAS, noi dung y het');
  now += 11000; r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'SWR' && calls.length === 2, 'sau 16s (> 15s, trong cua so SWR 60s): tra NGAY ban cu + lam moi nen');
  ok(JSON.parse(await r.text()).n === 1, 'SWR tra ban cu (n=1) ngay lap tuc');
  r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 2 && JSON.parse(await r.text()).n === 2, 'lan sau: HIT voi ban moi da lam xong o nen (n=2), khong goi GAS them');
  reset(); await go('action=orders'); now += 100000; r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, 'qua cua so SWR (100s > 60s): cho ban moi nhu cu');
  // gop request cung luc: 5 request cung khoa luc het han -> chi 1 lan goi GAS them
  reset(); await go('action=orders'); now += 20000; originFn = () => ({ status: 200, body: { ok: true, n: 99 } });
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => worker.fetch(req('action=orders'), env, ctx))); await Promise.all(pending.splice(0));
  ok(rs.every(q => q.headers.get('x-crm-cache') === 'SWR') && calls.length === 2, 'het han + 5 request cung luc: tat ca SWR, GAS chi bi goi them 1 lan (gop): ' + calls.length);
  reset(); originFn = () => ({ status: 200, body: { ok: true, n: 7 } });
  const ms = await Promise.all([1, 2, 3].map(() => worker.fetch(req('action=salesReportB'), env, ctx))); await Promise.all(pending.splice(0));
  ok(calls.length === 1 && ms.every(q => q.status === 200), 'MISS cung luc 3 request: gop 1 lan goi GAS');
  for (const q of ms) ok(JSON.parse(await q.text()).n === 7, 'moi nguoi goi doc duoc body day du');
  // SWR + GAS loi o nen: van tra ban cu, khong nem loi
  reset(); await go('action=orders'); now += 20000; originFn = () => ({ throw: true }); r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'SWR' && r.status === 200, 'SWR + lam moi nen loi: van tra ban cu 200');
  // tham so khac thu tu van trung cache
  reset(); await go('action=salesReportA&from=2026-10-01&to=2026-10-08'); r = await go('to=2026-10-08&action=salesReportA&from=2026-10-01'); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'doi thu tu tham so van HIT');
  r = await go('action=salesReportA&from=2026-10-01&to=2026-10-09'); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, 'khoang ngay khac = muc khac');
  // origin nhan DUNG thu tu/tham so goc
  ok(calls[1].url === GAS + '?action=salesReportA&from=2026-10-01&to=2026-10-09', 'tham so chuyen tiep nguyen ven');

  // ===== chuyen thang (khong cache) =====
  reset();
  r = await go('action=customers&since=2026-10-09T00:00:00.000Z'); ok(r.headers.get('x-crm-cache') === 'BYPASS:delta', 'delta chuyen thang');
  r = await go('action=customers&since=2026-10-09T00:00:00.000Z'); ok(calls.length === 2 && putCount === 0, 'delta luon goi GAS, khong luu');
  r = await go('action=lookup&phone=0912345678'); ok(r.headers.get('x-crm-cache') === 'BYPASS:action', 'lookup chuyen thang');
  r = await go('action=orders&demo=tok'); ok(r.headers.get('x-crm-cache') === 'BYPASS:private-param' && putCount === 0, 'demo chuyen thang');
  r = await go('action=salesReportA&adminKey=SECRET'); ok(r.headers.get('x-crm-cache') === 'BYPASS:private-param' && putCount === 0, 'adminKey chuyen thang');
  ok([...store.keys()].every(k => !/SECRET|demo=/.test(k)), 'khong luu khoa/token vao cache');
  // POST: giu body + content-type, khong cache
  reset(); originFn = (u, i) => ({ status: 200, body: { ok: true, got: new TextDecoder().decode(i.body), ct: i.headers && i.headers['content-type'] } });
  r = await go('', { method: 'POST', body: '{"action":"saveSingle","phone":"0912"}', headers: { 'content-type': 'text/plain;charset=utf-8' } });
  const pj = JSON.parse(await r.text()); ok(pj.got === '{"action":"saveSingle","phone":"0912"}' && /text\/plain/.test(pj.ct) && calls[0].init.method === 'POST' && calls[0].url === GAS && putCount === 0, 'POST chuyen nguyen body + content-type, khong cache: ' + J(pj));
  ok(r.headers.get('x-crm-cache') === 'BYPASS:method', 'POST danh dau BYPASS');

  // ===== khong cache phan hoi loi =====
  reset(); originFn = () => ({ status: 200, body: { error: 'Thieu quyen' } });
  r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'BYPASS:not-cacheable' && putCount === 0 && JSON.parse(await r.text()).error, 'phan hoi {"error"} khong cache, van tra cho client');
  originFn = () => ({ status: 200, body: '<html>Dang nhap Google</html>' }); r = await go('action=orders'); ok(putCount === 0 && (await r.text()).startsWith('<html>'), 'HTML (trang dang nhap) khong cache');
  originFn = () => ({ status: 500, body: { rows: [] } }); r = await go('action=orders'); ok(putCount === 0 && r.status === 500, 'HTTP 500 khong cache, giu status');
  originFn = () => ({ status: 200, body: { ok: true } }); r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'MISS', 'sau loi, lan sau van cache binh thuong');
  const big = '{"rows":"' + 'x'.repeat(9 * 1024 * 1024) + '"}'; reset(); originFn = () => ({ status: 200, body: big });
  r = await go('action=orders'); ok(putCount === 0 && (await r.text()).length === big.length, 'phan hoi > 8MB khong cache nhung van tra du');

  // ===== stale-if-error =====
  reset(); await go('action=orders'); now += 90000;   // het han (15s) + qua cua so SWR (60s) nhung con trong 600s
  originFn = () => ({ throw: true }); r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'STALE' && r.status === 200, 'GAS sap + con ban cu -> tra STALE');
  originFn = () => ({ status: 200, body: { error: 'quota' } }); r = await go('action=orders'); ok(r.headers.get('x-crm-cache') === 'STALE', 'GAS tra loi + con ban cu -> STALE');
  now += 700000; originFn = () => ({ throw: true }); r = await go('action=orders'); ok(r.status === 502 && JSON.parse(await r.text()).error, 'ban cu qua 10 phut -> 502 co thong bao');
  reset(); originFn = () => ({ throw: true }); r = await go('action=lookup&phone=1'); ok(r.status === 502, 'chuyen thang + GAS sap -> 502 co CORS'); ok(r.headers.get('access-control-allow-origin') === '*', 'loi van co CORS (de client doc duoc thong bao)');

  // ===== CORS preflight, thieu cau hinh, kill switch =====
  r = await worker.fetch(req('', { method: 'OPTIONS' }), env, ctx); ok(r.status === 204 && r.headers.get('access-control-allow-origin') === '*', 'OPTIONS 204 + CORS');
  r = await worker.fetch(req('action=orders'), {}, ctx); ok(r.status === 500 && /GAS_URL/.test(await r.text()), 'thieu GAS_URL -> bao ro');
  reset(); r = await go('action=orders', undefined, { GAS_URL: GAS, DISABLED: '1' }); ok(r.headers.get('x-crm-cache') === 'BYPASS:disabled' && putCount === 0, 'DISABLED=1 -> chi chuyen tiep');
  r = await go('action=orders', undefined, { GAS_URL: GAS, DISABLED: '1' }); ok(calls.length === 2, 'DISABLED luon goi GAS');
  console.log('ALL CLOUDFLARE WORKER TESTS PASSED');
})().catch(e => { console.error('LOI:', e); process.exit(1); });
function J(x) { return JSON.stringify(x); }
