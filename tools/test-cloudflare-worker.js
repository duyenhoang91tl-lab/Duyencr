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
  ok(mod.cacheKeyUrl(W + '?action=orders&token=A&src=web') === mod.cacheKeyUrl(W + '?action=orders&src=zalo&token=B') && mod.cacheKeyUrl(W + '?action=orders&token=A') === mod.cacheKeyUrl(W + '?action=orders'), 'token/src KHONG nam trong khoa cache (cache dung chung)');
  ok(mod.isGoodJson('{"rows":[]}') && mod.isGoodJson('[1,2]') && !mod.isGoodJson('{"error":"x"}') && !mod.isGoodJson('<html>') && !mod.isGoodJson('') && !mod.isGoodJson('"str"') && !mod.isGoodJson('null'), 'isGoodJson');

  // ===== cache MISS -> HIT -> het han -> MISS =====
  // cskhDuyenLite nay thuoc GATED_ACTIONS (4c-2c): tam go no khoi danh sach de kiem hanh vi cache CHUNG (khong khoa user), khoi phuc o cuoi phan nay.
  const _gIdx = mod.GATED_ACTIONS.indexOf('cskhDuyenLite'); if (_gIdx !== -1) mod.GATED_ACTIONS.splice(_gIdx, 1);
  reset(); let r = await go('action=cskhDuyenLite');
  ok(r.status === 200 && r.headers.get('x-crm-cache') === 'MISS' && calls.length === 1 && putCount === 1, 'lan 1 MISS, goi GAS 1 lan, luu cache');
  ok(calls[0].url === GAS + '?action=cskhDuyenLite&src=worker' && calls[0].init.redirect === 'follow', 'goi dung URL GAS + theo redirect: ' + calls[0].url);
  ok(r.headers.get('access-control-allow-origin') === '*' && /x-crm-cache/.test(r.headers.get('access-control-expose-headers')), 'co CORS');
  const first = await r.text();
  now += 5000; r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1 && (await r.text()) === first, 'sau 5s: HIT, khong goi GAS, noi dung y het');
  now += 11000; r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'SWR' && calls.length === 2, 'sau 16s (> 15s, trong cua so SWR 60s): tra NGAY ban cu + lam moi nen');
  ok(JSON.parse(await r.text()).n === 1, 'SWR tra ban cu (n=1) ngay lap tuc');
  r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 2 && JSON.parse(await r.text()).n === 2, 'lan sau: HIT voi ban moi da lam xong o nen (n=2), khong goi GAS them');
  reset(); await go('action=cskhDuyenLite'); now += 100000; r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, 'qua cua so SWR (100s > 60s): cho ban moi nhu cu');
  // gop request cung luc: 5 request cung khoa luc het han -> chi 1 lan goi GAS them
  reset(); await go('action=cskhDuyenLite'); now += 20000; originFn = () => ({ status: 200, body: { ok: true, n: 99 } });
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => worker.fetch(req('action=cskhDuyenLite'), env, ctx))); await Promise.all(pending.splice(0));
  ok(rs.every(q => q.headers.get('x-crm-cache') === 'SWR') && calls.length === 2, 'het han + 5 request cung luc: tat ca SWR, GAS chi bi goi them 1 lan (gop): ' + calls.length);
  reset(); originFn = () => ({ status: 200, body: { ok: true, n: 7 } });
  const ms = await Promise.all([1, 2, 3].map(() => worker.fetch(req('action=salesReportOptions'), env, ctx))); await Promise.all(pending.splice(0));
  ok(calls.length === 1 && ms.every(q => q.status === 200), 'MISS cung luc 3 request: gop 1 lan goi GAS');
  for (const q of ms) ok(JSON.parse(await q.text()).n === 7, 'moi nguoi goi doc duoc body day du');
  // SWR + GAS loi o nen: van tra ban cu, khong nem loi
  reset(); await go('action=cskhDuyenLite'); now += 20000; originFn = () => ({ throw: true }); r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'SWR' && r.status === 200, 'SWR + lam moi nen loi: van tra ban cu 200');
  // tham so khac thu tu van trung cache
  reset(); await go('action=salesReportOptions&from=2026-10-01&to=2026-10-08'); r = await go('to=2026-10-08&action=salesReportOptions&from=2026-10-01'); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'doi thu tu tham so van HIT');
  r = await go('action=salesReportOptions&from=2026-10-01&to=2026-10-09'); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, 'khoang ngay khac = muc khac');
  // origin nhan DUNG thu tu/tham so goc
  ok(calls[1].url === GAS + '?action=salesReportOptions&from=2026-10-01&to=2026-10-09&src=worker', 'tham so chuyen tiep nguyen ven');
  // Buoc 3b: token/src cua tung nguoi KHONG chia nho cache; van chuyen tiep nguyen ven cho GAS; src san co khong bi ghi de
  reset(); await go('action=cskhDuyenLite&src=web&token=AAA&ek=X1'); r = await go('action=cskhDuyenLite&src=zalo&ek=X2');
  ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'ek (khoa extension) khong chia nho cache');
  reset(); await go('action=cskhDuyenLite&src=web&token=AAA'); r = await go('action=cskhDuyenLite&src=web&token=BBB');
  ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'hai nguoi khac token cung dung 1 cache');
  ok(calls[0].url === GAS + '?action=cskhDuyenLite&src=web&token=AAA', 'GAS nhan nguyen src + token cua nguoi goi: ' + calls[0].url);

  // ===== chuyen thang (khong cache) =====
  reset();
  r = await go('action=customers&since=2026-10-09T00:00:00.000Z'); ok(r.headers.get('x-crm-cache') === 'BYPASS:delta', 'delta chuyen thang');
  r = await go('action=customers&since=2026-10-09T00:00:00.000Z'); ok(calls.length === 2 && putCount === 0, 'delta luon goi GAS, khong luu');
  r = await go('action=lookup&phone=0912345678'); ok(r.headers.get('x-crm-cache') === 'BYPASS:action', 'lookup chuyen thang');
  r = await go('action=cskhDuyenLite&demo=tok'); ok(r.headers.get('x-crm-cache') === 'BYPASS:private-param' && putCount === 0, 'demo chuyen thang');
  r = await go('action=salesReportA&adminKey=SECRET'); ok(r.headers.get('x-crm-cache') === 'BYPASS:private-param' && putCount === 0, 'adminKey chuyen thang');
  ok([...store.keys()].every(k => !/SECRET|demo=/.test(k)), 'khong luu khoa/token vao cache');
  // POST: giu body + content-type, khong cache
  reset(); originFn = (u, i) => ({ status: 200, body: { ok: true, got: new TextDecoder().decode(i.body), ct: i.headers && i.headers['content-type'] } });
  r = await go('', { method: 'POST', body: '{"action":"saveSingle","phone":"0912"}', headers: { 'content-type': 'text/plain;charset=utf-8' } });
  const pj = JSON.parse(await r.text()); ok(pj.got === '{"action":"saveSingle","phone":"0912"}' && /text\/plain/.test(pj.ct) && calls[0].init.method === 'POST' && calls[0].url === GAS && putCount === 0, 'POST chuyen nguyen body + content-type, khong cache: ' + J(pj));
  ok(r.headers.get('x-crm-cache') === 'BYPASS:method', 'POST danh dau BYPASS');

  // ===== khong cache phan hoi loi =====
  reset(); originFn = () => ({ status: 200, body: { error: 'Thieu quyen' } });
  r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'BYPASS:not-cacheable' && putCount === 0 && JSON.parse(await r.text()).error, 'phan hoi {"error"} khong cache, van tra cho client');
  originFn = () => ({ status: 200, body: '<html>Dang nhap Google</html>' }); r = await go('action=cskhDuyenLite'); ok(putCount === 0 && (await r.text()).startsWith('<html>'), 'HTML (trang dang nhap) khong cache');
  originFn = () => ({ status: 500, body: { rows: [] } }); r = await go('action=cskhDuyenLite'); ok(putCount === 0 && r.status === 500, 'HTTP 500 khong cache, giu status');
  originFn = () => ({ status: 200, body: { ok: true } }); r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'MISS', 'sau loi, lan sau van cache binh thuong');
  const big = '{"rows":"' + 'x'.repeat(9 * 1024 * 1024) + '"}'; reset(); originFn = () => ({ status: 200, body: big });
  r = await go('action=cskhDuyenLite'); ok(putCount === 0 && (await r.text()).length === big.length, 'phan hoi > 8MB khong cache nhung van tra du');

  // ===== stale-if-error =====
  reset(); await go('action=cskhDuyenLite'); now += 90000;   // het han (15s) + qua cua so SWR (60s) nhung con trong 600s
  originFn = () => ({ throw: true }); r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'STALE' && r.status === 200, 'GAS sap + con ban cu -> tra STALE');
  originFn = () => ({ status: 200, body: { error: 'quota' } }); r = await go('action=cskhDuyenLite'); ok(r.headers.get('x-crm-cache') === 'STALE', 'GAS tra loi + con ban cu -> STALE');
  now += 700000; originFn = () => ({ throw: true }); r = await go('action=cskhDuyenLite'); ok(r.status === 502 && JSON.parse(await r.text()).error, 'ban cu qua 10 phut -> 502 co thong bao');
  reset(); originFn = () => ({ throw: true }); r = await go('action=lookup&phone=1'); ok(r.status === 502, 'chuyen thang + GAS sap -> 502 co CORS'); ok(r.headers.get('access-control-allow-origin') === '*', 'loi van co CORS (de client doc duoc thong bao)');

  // ===== CORS preflight, thieu cau hinh, kill switch =====
  r = await worker.fetch(req('', { method: 'OPTIONS' }), env, ctx); ok(r.status === 204 && r.headers.get('access-control-allow-origin') === '*', 'OPTIONS 204 + CORS');
  r = await worker.fetch(req('action=cskhDuyenLite'), {}, ctx); ok(r.status === 500 && /GAS_URL/.test(await r.text()), 'thieu GAS_URL -> bao ro');
  reset(); r = await go('action=cskhDuyenLite', undefined, { GAS_URL: GAS, DISABLED: '1' }); ok(r.headers.get('x-crm-cache') === 'BYPASS:disabled' && putCount === 0, 'DISABLED=1 -> chi chuyen tiep');
  r = await go('action=cskhDuyenLite', undefined, { GAS_URL: GAS, DISABLED: '1' }); ok(calls.length === 2, 'DISABLED luon goi GAS');
  // ===== webhook Pancake -> Supabase (/pancake-webhook) =====
  const SB = 'https://abc.supabase.co', SBKEY = 'service-role-secret', WK = 'khoa-bi-mat-123';
  const wenv = { PANCAKE_WEBHOOK_KEY: WK, SUPABASE_URL: SB + '/', SUPABASE_SERVICE_KEY: SBKEY };   // CO Y khong co GAS_URL: route nay khong duoc phu thuoc GAS
  const wh = async (qs, init, e) => { const r = await worker.fetch(new Request('https://crm.example.workers.dev/pancake-webhook' + qs, init), e || wenv, ctx); await Promise.all(pending.splice(0)); return r; };
  const post = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  ok(mod.pkSafeEqual('abc', 'abc') && !mod.pkSafeEqual('abc', 'abd') && !mod.pkSafeEqual('abc', 'abcd') && !mod.pkSafeEqual('', 'x') && !mod.pkSafeEqual(null, 'x') && mod.pkSafeEqual(null, ''), 'pkSafeEqual');
  let ex = mod.pkExtract({ page_id: 'P1', event_type: 'messaging' }); ok(ex.page_id === 'P1' && ex.event_type === 'messaging', 'pkExtract tang tren cung');
  ex = mod.pkExtract({ data: { conversation: { page_id: 77 } }, type: 'x' }); ok(ex.page_id === '77' && ex.event_type === 'x', 'pkExtract tu data.conversation + type');
  ex = mod.pkExtract({ page_id: { a: 1 } }); ok(ex.page_id === '' && mod.pkExtract(null).page_id === '' && mod.pkExtract([1]).event_type === '', 'pkExtract an toan voi du lieu la');
  reset(); r = await wh('?key=' + WK, undefined, { SUPABASE_URL: SB, SUPABASE_SERVICE_KEY: SBKEY });
  ok(r.status === 503 && calls.length === 0, 'thieu PANCAKE_WEBHOOK_KEY -> 503, khong goi gi');
  reset(); r = await wh('?key=sai', post({ a: 1 })); ok(r.status === 401 && calls.length === 0, 'sai khoa -> 401, KHONG ghi Supabase');
  r = await wh('', post({ a: 1 })); ok(r.status === 401 && calls.length === 0, 'khong co khoa -> 401');
  reset(); r = await wh('?key=' + WK, undefined, { PANCAKE_WEBHOOK_KEY: WK, SUPABASE_URL: SB });
  ok(r.status === 503 && /SUPABASE_SERVICE_KEY/.test(await r.text()) && calls.length === 0, 'thieu khoa Supabase -> 503 neu dung ten bien');
  reset(); r = await wh('?key=' + WK); ok(r.status === 200 && JSON.parse(await r.text()).ready === true && calls.length === 0, 'GET dung khoa -> ready, khong ghi gi');
  reset(); originFn = () => ({ status: 201, body: '' }); r = await wh('?key=' + WK + '&diag=1');
  ok(r.status === 200 && JSON.parse(await r.text()).ok === true && calls.length === 1 && JSON.parse(calls[0].init.body).event_type === 'diag', 'diag=1: ghi 1 dong thu, tra ok');
  reset(); originFn = () => ({ status: 400, body: { message: "Could not find the 'page_id' column" } }); r = await wh('?key=' + WK + '&diag=1'); let dj = JSON.parse(await r.text());
  ok(r.status === 502 && dj.supabase_status === 400 && /page_id/.test(dj.detail) && !/service-role-secret/.test(JSON.stringify(dj)), 'diag=1: loi Supabase -> 502 kem thong bao, KHONG lo khoa');
  reset(); r = await wh('?key=sai&diag=1'); ok(r.status === 401 && calls.length === 0, 'diag=1 sai khoa -> 401, khong ghi');
  reset(); originFn = () => ({ status: 201, body: '' });
  const ev = { event_type: 'messaging', page_id: 'P9', data: { message: { id: 'm1', message: 'xin chao' } } };
  r = await wh('?key=' + WK, post(ev)); ok(r.status === 200 && JSON.parse(await r.text()).ok === true, 'POST dung khoa -> 200');
  ok(calls.length === 1 && calls[0].url === SB + '/rest/v1/pk_webhook_raw' && calls[0].init.method === 'POST', 'ghi dung bang pk_webhook_raw (bo dau / cuoi URL): ' + calls[0].url);
  ok(calls[0].init.headers.apikey === SBKEY && calls[0].init.headers.authorization === 'Bearer ' + SBKEY && calls[0].init.headers.prefer === 'return=minimal', 'gui khoa service_role dung header');
  let row = JSON.parse(calls[0].init.body); ok(row.page_id === 'P9' && row.event_type === 'messaging' && J(row.payload) === J(ev), 'luu NGUYEN payload + page_id/event_type de loc');
  ok(!calls.some(c => c.url.indexOf(GAS) === 0), 'khong goi GAS');
  reset(); originFn = () => ({ status: 201, body: '' }); await wh('?key=' + WK, post('khong phai json {{')); row = JSON.parse(calls[0].init.body);
  ok(row.payload._non_json === 'khong phai json {{', 'body khong phai JSON van luu (khong mat du lieu)');
  reset(); originFn = () => ({ status: 201, body: '' }); await wh('?key=' + WK, post('123')); row = JSON.parse(calls[0].init.body); ok(row.payload._value === 123, 'JSON khong phai object duoc boc lai');
  reset(); originFn = () => ({ status: 500, body: { message: 'bi mat: ' + SBKEY } }); r = await wh('?key=' + WK, post(ev)); const t502 = await r.text();
  ok(r.status === 502 && t502.indexOf(SBKEY) === -1 && t502.indexOf(WK) === -1, 'Supabase loi -> 502, khong lo khoa/noi dung loi');
  // Lan ghi dau bi tu choi nhung lan 2 (dang an toan) duoc -> 200, giu NGUYEN van ban + ly do loi (khong mat tin, biet nguyen nhan)
  reset(); let nIns = 0; originFn = () => (++nIns === 1 ? { status: 400, body: { message: 'unsupported Unicode escape \\u0000' } } : { status: 201, body: '' });
  r = await wh('?key=' + WK, post('{"a":"x\\u0000y"}')); ok(r.status === 200 && JSON.parse(await r.text()).stored === 'fallback' && calls.length === 2, 'ghi lan 1 loi, lan 2 (fallback) duoc -> 200');
  let fb = JSON.parse(calls[1].init.body); ok(fb.event_type === '_fallback' && fb.payload._first_status === 400 && /Unicode/.test(fb.payload._first_error) && fb.payload._raw_text.indexOf('\u0000') === -1, 'fallback luu ly do loi + van ban da bo NUL');
  reset(); originFn = () => ({ status: 400, body: { message: 'loi cot page_id' } }); r = await wh('?key=' + WK, post(ev)); dj = JSON.parse(await r.text());
  ok(r.status === 502 && dj.status === 400 && /page_id/.test(dj.detail) && calls.length === 2, 'ca 2 lan loi -> 502 kem ma + thong bao (de chan doan)');
  reset(); originFn = () => ({ throw: true }); r = await wh('?key=' + WK, post(ev)); ok(r.status === 502, 'mat mang toi Supabase -> 502');
  reset(); r = await wh('?key=' + WK, post('x'.repeat(1024 * 1024 + 1))); ok(r.status === 413 && calls.length === 0, 'payload > 1MB -> 413, khong ghi');
  reset(); r = await wh('?key=' + WK, { method: 'PUT', body: '{}' }); ok(r.status === 405 && calls.length === 0, 'PUT -> 405');
  reset(); r = await worker.fetch(req('action=cskhDuyenLite'), env, ctx); await Promise.all(pending.splice(0)); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 1 && calls[0].url.indexOf(GAS) === 0, 'route cu (cache GAS) khong bi anh huong');
  // ===== BUOC 4b: SESS_SECRET -> Worker chi phuc vu cache cho token phien hop le =====
  {
    const nodeCrypto = require('crypto'), SEC = 'bi-mat-phien';
    const b64w = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');   // y het GAS base64EncodeWebSafe (giu dau =)
    const mkTok = (u, e) => { const b = b64w(JSON.stringify({ u: u, e: e })); return b + '.' + b64w(nodeCrypto.createHmac('sha256', SEC).update(b).digest()); };
    const goodT = mkTok('duyen', Date.now() + 1e6), expT = mkTok('duyen', Date.now() - 1), vnT = mkTok('Nguyễn Văn Ạ', Date.now() + 1e6);
    ok(await mod.verifySessToken(goodT, SEC) && await mod.verifySessToken(vnT, SEC), 'token dung (ke ca ten co dau)');
    ok(!(await mod.verifySessToken(expT, SEC)) && !(await mod.verifySessToken(goodT.slice(0, -3) + 'AAA', SEC)) && !(await mod.verifySessToken(goodT, 'sai-bi-mat')) && !(await mod.verifySessToken('', SEC)) && !(await mod.verifySessToken('abc', SEC)) && !(await mod.verifySessToken(goodT, '')), 'het han / sua chu ky / sai bi mat / rong / rac deu bi tu choi');
    const senv = { GAS_URL: GAS, SESS_SECRET: SEC };
    reset(); r = await go('action=cskhDuyenLite&token=' + goodT, undefined, senv); ok(r.headers.get('x-crm-cache') === 'MISS' && putCount === 1, 'token hop le -> cache binh thuong');
    r = await go('action=cskhDuyenLite&token=' + goodT, undefined, senv); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'token hop le -> HIT');
    // nguoi khong co token / token gia / het han KHONG duoc an cache cua nguoi khac, va khong ghi cache
    for (const [name, qs] of [['khong token', 'action=cskhDuyenLite'], ['token gia', 'action=cskhDuyenLite&token=abc.def'], ['token het han', 'action=cskhDuyenLite&token=' + expT]]) {
      const before = calls.length; r = await go(qs, undefined, senv);
      ok(r.headers.get('x-crm-cache') === 'BYPASS:no-valid-token' && calls.length === before + 1 && calls[calls.length - 1].url.indexOf(GAS) === 0, name + ' -> chuyen thang GAS, khong an cache');
    }
    reset(); await go('action=cskhDuyenLite', undefined, senv); await go('action=cskhDuyenLite', undefined, senv); ok(putCount === 0 && calls.length === 2, 'request khong token khong bao gio ghi cache');
    // GAS tu choi -> loi duoc tra nguyen, khong cache
    reset(); originFn = () => ({ status: 200, body: { error: 'Can dang nhap lai', code: 'AUTH' } }); r = await go('action=cskhDuyenLite', undefined, senv);
    ok(JSON.parse(await r.text()).code === 'AUTH' && putCount === 0, 'loi AUTH cua GAS duoc chuyen nguyen ve client');
    // Action bi chan theo phan quyen: cache RIENG tung nguoi; khong xac thuc duoc user thi khong cache
    {
      const t2 = mkTok('hoa', Date.now() + 1e6);
      ok(mod.tokenUser(goodT) === 'duyen' && mod.tokenUser(vnT) === 'Nguyễn Văn Ạ' && mod.tokenUser('abc') === '', 'tokenUser doc dung user (ke ca co dau)');
      reset(); await go('action=salesReportA&from=1&to=2&token=' + goodT, undefined, senv);
      r = await go('action=salesReportA&from=1&to=2&token=' + goodT, undefined, senv); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'bao cao bi chan: cung nguoi -> HIT');
      r = await go('action=salesReportA&from=1&to=2&token=' + t2, undefined, senv); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, 'bao cao bi chan: nguoi khac KHONG an cache cua nguoi truoc');
      reset(); r = await go('action=salesReportA&from=1&to=2&token=' + goodT, undefined, env); ok(r.headers.get('x-crm-cache') === 'BYPASS:gated-no-user' && putCount === 0, 'khong co SESS_SECRET: bao cao bi chan khong cache');
      reset(); await go('action=cskhDuyenLite&token=' + goodT, undefined, senv); r = await go('action=cskhDuyenLite&token=' + t2, undefined, senv); ok(r.headers.get('x-crm-cache') === 'HIT', 'action khong bi chan van dung chung cache');
    // 4c-2b: customers/orders/careLeads da loc theo pham vi o GAS -> cache PHAI khoa theo user
    for (const act of ['customers', 'orders', 'careLeads']) {
      ok(mod.GATED_ACTIONS.indexOf(act) !== -1, act + ' nam trong GATED_ACTIONS');
      reset(); await go('action=' + act + '&token=' + goodT, undefined, senv);
      r = await go('action=' + act + '&token=' + goodT, undefined, senv); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, act + ': cung nguoi -> HIT');
      r = await go('action=' + act + '&token=' + t2, undefined, senv); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, act + ': nguoi khac KHONG an cache cua nguoi truoc');
      reset(); r = await go('action=' + act + '&token=' + goodT, undefined, env); ok(r.headers.get('x-crm-cache') === 'BYPASS:gated-no-user' && putCount === 0, act + ': khong SESS_SECRET -> khong cache');
    }
    }
    // KHONG cau hinh SESS_SECRET -> hanh vi cu y het (khong can token)
    reset(); r = await go('action=cskhDuyenLite', undefined, env); ok(r.headers.get('x-crm-cache') === 'MISS' && putCount === 1, 'khong co SESS_SECRET -> nhu cu');
    // 4c-2c: khoi phuc cskhDuyenLite vao GATED_ACTIONS (da go tam o dau phan cache chung) va kiem cache khoa theo user
    mod.GATED_ACTIONS.push('cskhDuyenLite');
    const t2c = mkTok('hoa', Date.now() + 1e6);
    ok(mod.GATED_ACTIONS.indexOf('cskhDuyenLite') !== -1, 'cskhDuyenLite nam trong GATED_ACTIONS');
    reset(); await go('action=cskhDuyenLite&token=' + goodT, undefined, senv);
    r = await go('action=cskhDuyenLite&token=' + goodT, undefined, senv); ok(r.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'cskhDuyenLite: cung nguoi -> HIT');
    r = await go('action=cskhDuyenLite&token=' + t2c, undefined, senv); ok(r.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, 'cskhDuyenLite: nguoi khac KHONG an cache cua nguoi truoc');
  }
  // ===== HOP THU PANCAKE DOC THANG TU WORKER (PK_NATIVE) =====
  {
    const nodeCrypto = require('crypto'), SEC = 'bi-mat-phien', SB = 'https://sb.example.supabase.co';
    const b64w = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const mkTok = (u, e) => { const b = b64w(JSON.stringify({ u: u, e: e })); return b + '.' + b64w(nodeCrypto.createHmac('sha256', SEC).update(b).digest()); };
    const T = mkTok('lan', Date.now() + 1e6), TX = mkTok('lan', Date.now() - 1), TD = mkTok('Demo1', Date.now() + 1e6);
    const nenv = { GAS_URL: GAS, SESS_SECRET: SEC, SUPABASE_URL: SB + '/', SUPABASE_SERVICE_KEY: 'svc-key', PK_NATIVE: '1', PK_DENY_USERS: 'demo1, test2' };
    const sb = url => calls.filter(c => c.url.indexOf(SB) === 0), gasCalls = () => calls.filter(c => c.url.indexOf(GAS) === 0);
    let failSb = false, crmCol = false;
    const route = (url) => {
      if (url.indexOf(SB) !== 0) return { status: 200, body: { ok: true, via: 'gas' } };
      if (failSb) return { throw: true };
      if (url.indexOf('/pk_staff') > -1) return { status: 200, body: [{ id: 'u-1', name: 'Lan Sale' }] };
      if (url.indexOf('/pk_tags') > -1) return { status: 200, body: [{ page_id: 'P1', tag_id: 109, text: 'VIP', color: '#ff0000' }] };
      if (url.indexOf('/pk_conversations') > -1) return { status: 200, body: [{ id: 'P1_C1', page_id: 'P1', customer_name: 'Khach A', customer_phone: '0378996789', last_message_at: '2026-10-13T16:49:36+00:00', last_text: 'Sdt test', seen: false, is_replied: false, conv_type: 'INBOX', tags: [109, 999], assignee_ids: ['u-1', 'u-x'] }] };
      if (url.indexOf('/pk_messages') > -1) {
        if (url.indexOf('crm_user') > -1 && !crmCol) return { status: 400, body: { message: 'column crm_user does not exist' } };
        return { status: 200, body: [{ id: 'm2', conversation_id: 'P1_C1', direction: 'out', text: 'Da em', sent_at: '2026-10-13T16:50:00+00:00', sender_name: 'Page', fromraw: { admin_name: 'Lan' }, attachments: [{ url: 'https://x/img.png', type: 'image' }, { url: 'javascript:1' }] },
                                       { id: 'm1', conversation_id: 'P1_C1', direction: 'in', text: 'Sdt test', sent_at: '2026-10-13T16:49:36+00:00', sender_name: 'Khach A', fromraw: { id: '1' }, attachments: [] }] };
      }
      return { status: 404, body: {} };
    };
    const arm = () => { reset(); mod.pkMemoClear(); failSb = false; originFn = route; };
    const nat = async (qs, e) => go(qs, undefined, e || nenv);

    arm(); let r = await nat('action=pkChatInbox&token=' + T);
    let j = JSON.parse(await r.text());
    ok(r.headers.get('x-crm-cache') === 'NATIVE' && gasCalls().length === 0 && j.ok && j.conversations.length === 1, 'PK_NATIVE: doc thang Supabase, KHONG goi GAS');
    ok(j.conversations[0].tags.length === 1 && j.conversations[0].tags[0].t === 'VIP' && j.conversations[0].tags[0].c === '#ff0000', 'ma so the 109 -> ten + mau; ma khong co trong danh muc (999) bi bo');
    ok(j.conversations[0].assignees.join() === 'Lan Sale' && j.conversations[0].assigneeIds.length === 2 && j.conversations[0].phone === '0378996789', 'ten nhan vien tu pk_staff, id chua biet khong lo ra ten');
    ok(sb().every(c => c.init.headers && c.init.headers.apikey === 'svc-key' && /Bearer svc-key/.test(c.init.headers.authorization)) && sb().some(c => c.url.indexOf(SB + '/rest/v1/pk_conversations?select=') === 0), 'goi Supabase dung URL (bo / cuoi) + khoa service');
    const n1 = sb().length; now += 3000; r = await nat('action=pkChatInbox&token=' + T);
    ok(sb().length === n1 && r.headers.get('x-crm-cache') === 'NATIVE', 'poll lai trong 10s: khong goi Supabase them (bo nho tam)');
    now += 11000; await nat('action=pkChatInbox&token=' + T); ok(sb().length > n1, 'qua 10s: doc lai Supabase');
    // khong du dieu kien -> chuyen GAS nhu cu
    arm(); r = await nat('action=pkChatInbox&token=' + T, Object.assign({}, nenv, { PK_NATIVE: '' })); ok(gasCalls().length === 1 && sb().length === 0, 'PK_NATIVE tat (mac dinh) -> GAS nhu cu');
    arm(); await nat('action=pkChatInbox', nenv); ok(gasCalls().length === 1 && sb().length === 0, 'khong co token -> GAS (GAS tra "Can dang nhap")');
    arm(); await nat('action=pkChatInbox&token=' + TX, nenv); ok(gasCalls().length === 1 && sb().length === 0, 'token het han -> GAS');
    arm(); await nat('action=pkChatInbox&token=' + T.slice(0, -3) + 'abc', nenv); ok(gasCalls().length === 1 && sb().length === 0, 'chu ky sai -> GAS');
    arm(); await nat('action=pkChatInbox&token=' + TD, nenv); ok(gasCalls().length === 1 && sb().length === 0, 'tai khoan trong PK_DENY_USERS (khong phan biet hoa thuong) -> GAS tu choi dung vai tro');
    arm(); await nat('action=pkChatInbox&token=' + T, Object.assign({}, nenv, { SUPABASE_SERVICE_KEY: '' })); ok(gasCalls().length === 1 && sb().length === 0, 'thieu khoa Supabase -> GAS');
    arm(); failSb = true; r = await nat('action=pkChatInbox&token=' + T); ok(gasCalls().length === 1 && r.status === 200, 'Supabase loi/mat mang -> du phong GAS, khong tra trang loi');
    arm(); r = await nat('action=cskhDuyenLite&token=' + T); ok(r.headers.get('x-crm-cache') !== 'NATIVE' && sb().length === 0, 'action khac khong bi anh huong');
    arm(); r = await go('action=pkChatInbox&token=' + T, { method: 'POST', body: '{}' }, nenv); ok(sb().length === 0, 'POST khong di vao nhanh doc truc tiep');
    // tim kiem + bao ve tham so
    arm(); await nat('action=pkChatInbox&token=' + T + '&q=' + encodeURIComponent('0378 996"789*')); ok(sb().some(c => c.url.indexOf('customer_phone=like.') > -1 && c.url.indexOf('customer_phone=like.*0378996789*') > -1), 'tim theo SDT -> customer_phone=like, ky tu dac biet bi bo');
    arm(); await nat('action=pkChatInbox&token=' + T + '&q=' + encodeURIComponent('Nguy(n,*')); const cu = sb().find(c => c.url.indexOf('pk_conversations') > -1).url; ok(/customer_name=ilike\.\*Nguy/.test(cu) && !/[(]n/.test(decodeURIComponent(cu.split('customer_name=')[1].split('&')[0])), 'tim theo ten -> ilike, bo ( , * " \\');
    arm(); r = await nat('action=pkChatFind&token=' + T + '&q=a'); j = JSON.parse(await r.text()); ok(j.error === 'Nhap it nhat 2 ky tu de tim.' && sb().length === 0, 'tim <2 ky tu -> bao loi giong GAS, khong goi Supabase');
    // doc tin nhan theo SDT: lam phang crm_user chua co cot -> thu lai
    arm(); r = await nat('action=pkChat&token=' + T + '&phone=' + encodeURIComponent('+84 378 996 789')); j = JSON.parse(await r.text());
    ok(j.ok && j.phone === '0378996789' && j.conversations.length === 1 && j.messages.length === 2, 'pkChat theo SDT (+84...) -> chuan hoa 0378996789');
    ok(j.messages[0].id === 'm1' && j.messages[1].id === 'm2' && j.messages[1].dir === 'out' && j.messages[1].staff === 'Lan' && j.messages[1].att.length === 1 && j.messages[1].att[0].url === 'https://x/img.png', 'tin xep tu cu den moi; ten nhan vien tu fromraw; chi giu dinh kem http(s)');
    ok(sb().some(c => c.url.indexOf('crm_user') > -1) && sb().filter(c => c.url.indexOf('pk_messages') > -1).length === 2, 'cot crm_user chua co -> tu thu lai khong cot do (giong GAS)');
    ok(sb().some(c => c.url.indexOf('customer_phone=eq.0378996789') > -1) && sb().some(c => decodeURIComponent(c.url).indexOf('conversation_id=in.("P1_C1")') > -1), 'loc dung theo SDT va theo danh sach hoi thoai');
    arm(); r = await nat('action=pkChat&token=' + T + '&phone=123'); j = JSON.parse(await r.text()); ok(j.error === 'SDT khong hop le.' && sb().length === 0, 'SDT ngan -> bao loi giong GAS');
    arm(); crmCol = true; r = await nat('action=pkChatConv&token=' + T + '&conv=P1_C1&after=2026-10-13T16:49:36.000Z'); j = JSON.parse(await r.text());
    ok(j.ok && j.messages.length === 2 && sb().some(c => decodeURIComponent(c.url).indexOf('sent_at=gt.2026-10-13T16:49:36.000Z') > -1 && c.url.indexOf('limit=100') > -1), 'pkChatConv + after: chi tin moi hon, limit 100');
    arm(); await nat('action=pkChatConv&token=' + T + '&conv=x&after=2026-10-13;drop'); ok(sb().every(c => c.url.indexOf('sent_at=gt') === -1), 'tham so after sai dinh dang bi bo (chong chen loc)');
    arm(); r = await nat('action=pkChatConv&token=' + T); ok(JSON.parse(await r.text()).error === 'Thieu conv.', 'thieu conv -> bao loi giong GAS');
  }
  // ===== 2026-10-26: donPhones/staffOverview co cache + THU LAI 1 LAN khi GAS tra 502/404 thoang qua (app Android bao 502/404 o action nang) =====
  {
    const nodeCrypto = require('crypto'), SEC = 'bi-mat-phien-2';
    const b64w = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const mkTok = (u, e) => { const b = b64w(JSON.stringify({ u: u, e: e })); return b + '.' + b64w(nodeCrypto.createHmac('sha256', SEC).update(b).digest()); };
    const tA = mkTok('duyen', Date.now() + 1e6), tB = mkTok('hoa', Date.now() + 1e6), senv2 = { GAS_URL: GAS, SESS_SECRET: SEC };
    ok(P('GET', 'action=donPhones').ttl === 30 && P('GET', 'action=staffOverview&username=a').ttl === 60, 'donPhones 30s, staffOverview 60s duoc cache');
    ok(mod.GATED_ACTIONS.indexOf('staffOverview') !== -1 && mod.GATED_ACTIONS.indexOf('donPhones') === -1, 'staffOverview khoa theo user; donPhones (GAS khong loc theo user) dung chung');
    reset(); await go('action=donPhones&src=web&token=' + tA, undefined, senv2); let rr = await go('action=donPhones&src=web&token=' + tB, undefined, senv2);
    ok(rr.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'donPhones: nguoi thu 2 dung chung ban cache (chi 1 lan goi GAS)');
    reset(); rr = await go('action=donPhones', undefined, senv2); ok(rr.headers.get('x-crm-cache') === 'BYPASS:no-valid-token' && putCount === 0, 'donPhones khong token hop le -> chuyen thang, khong cache');
    reset(); await go('action=staffOverview&username=duyenht&from=2026-10-01&to=2026-10-31&token=' + tA, undefined, senv2);
    rr = await go('action=staffOverview&username=duyenht&from=2026-10-01&to=2026-10-31&token=' + tA, undefined, senv2); ok(rr.headers.get('x-crm-cache') === 'HIT' && calls.length === 1, 'staffOverview: cung nguoi xem -> HIT');
    rr = await go('action=staffOverview&username=duyenht&from=2026-10-01&to=2026-10-31&token=' + tB, undefined, senv2); ok(rr.headers.get('x-crm-cache') === 'MISS' && calls.length === 2, 'staffOverview: nguoi xem khac KHONG an cache cua nguoi truoc (GAS kiem quyen theo nguoi xem)');
    rr = await go('action=staffOverview&username=hoa&from=2026-10-01&to=2026-10-31&token=' + tA, undefined, senv2); ok(rr.headers.get('x-crm-cache') === 'MISS' && calls.length === 3, 'staffOverview: khac username = khac muc cache');
    // --- thu lai ---
    let n = 0; reset(); originFn = () => (++n === 1 ? { status: 502, body: '<html>Bad Gateway</html>' } : { status: 200, body: { ok: true, n: 2 } });
    rr = await go('action=donPhones'); ok(rr.status === 200 && rr.headers.get('x-crm-cache') === 'MISS' && calls.length === 2 && JSON.parse(await rr.text()).n === 2, '502 thoang qua -> tu thu lai 1 lan, tra du lieu that (client khong thay loi)');
    n = 0; reset(); originFn = () => (++n === 1 ? { status: 404, body: '<html>Sorry, unable to open the file</html>' } : { status: 200, body: { ok: true } });
    rr = await go('action=donPhones'); ok(rr.status === 200 && calls.length === 2, '404 thoang qua cua Google cung duoc thu lai');
    n = 0; reset(); originFn = () => { if (++n === 1) return { throw: true }; return { status: 200, body: { ok: true } }; };
    rr = await go('action=donPhones'); ok(rr.status === 200 && calls.length === 2, 'dut ket noi lan 1 -> thu lai lan 2 duoc');
    reset(); originFn = () => ({ status: 502, body: '<html>Bad Gateway</html>' }); rr = await go('action=donPhones');
    ok(rr.status === 502 && calls.length === 2, 'loi that su keo dai: chi thu lai DUNG 1 lan (khong vong lap), tra nguyen ma loi');
    reset(); originFn = () => ({ throw: true }); rr = await go('action=donPhones'); ok(rr.status === 502 && calls.length === 2 && JSON.parse(await rr.text()).error, 'mat ket noi keo dai -> 502 co thong bao, dung 2 lan goi');
    reset(); originFn = () => ({ status: 200, body: { error: 'Can dang nhap' } }); rr = await go('action=donPhones'); ok(calls.length === 1, '{"error"} 200 cua GAS KHONG thu lai (khong phai loi ha tang)');
    reset(); await go('action=donPhones'); now += 200000; originFn = () => ({ status: 502, body: '<html>x</html>' }); const c0 = calls.length; rr = await go('action=donPhones');
    ok(rr.headers.get('x-crm-cache') === 'STALE' && calls.length === c0 + 1, 'con ban cu: tra STALE ngay, KHONG thu lai (khong bat nguoi dung cho them)');
    reset(); originFn = () => ({ status: 502, body: '<html>x</html>' }); const c1 = calls.length; await go('action=saveSingle&phone=0900000000'); ok(calls.length === 1, 'action ghi (khong cache) khong bao gio bi thu lai');
  }
  console.log('ALL CLOUDFLARE WORKER TESTS PASSED');
})().catch(e => { console.error('LOI:', e); process.exit(1); });
function J(x) { return JSON.stringify(x); }
