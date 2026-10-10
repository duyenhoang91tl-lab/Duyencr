// Duyen AI CRM — Cloudflare Worker CACHE phia truoc Google Apps Script (GAS). Chay duoc tren goi FREE.
// Muc dich: giam so lan goi vao Apps Script voi cac action DOC ma NHIEU may cung doc 1 du lieu (FULL khach, don hang, bao cao, bang gia...).
// KHONG doi gi o GAS/index.html/extension: chi doi dia chi backend (gsUrl / ome_gas_url / gasUrl) sang URL cua Worker. Lui = doi lai dia chi GAS.
// Cau hinh: bien moi truong GAS_URL = URL /exec cua Web App (Worker -> Settings -> Variables). DISABLED=1 -> chi chuyen tiep, khong cache.
//
// QUY TAC AN TOAN (co test trong tools/test-cloudflare-worker.js):
//  - CHI cache GET cua cac action trong bang TTL_SEC ben duoi. Moi thu khac (POST, action ghi, lookup, reminders, users, getSetting, assign, ...) chuyen thang.
//  - Request co tham so `demo` hoac `adminKey` -> chuyen thang, KHONG cache (khong tron du lieu giua nguoi dung / khong luu khoa).
//  - customers co `since` (delta, moi may moi gia tri khac, ~3 giay/lan) -> chuyen thang. Chi cache customers FULL (khong since).
//  - Khong bao gio cache phan hoi loi ({"error":...}) hoac khong phai JSON, hoac > MAX_CACHE_BYTES.
//  - Origin loi / sap: neu con ban cu (<= STALE_MAX_SEC) thi tra ban cu (x-crm-cache: STALE) thay vi bao loi.
//  - Khoa cache = URL goc + tham so da SAP XEP (moi tham so deu nam trong khoa: khac tham so = khac muc cache).
// SWR (2026-10-10): ban het han thi tra ngay + lam moi nen; request cung luc cung khoa duoc gop thanh 1 lan goi GAS (trong 1 isolate Worker). Goi free: 100.000 request/ngay (tinh ca request trung cache).
const TTL_SEC = {
  // doc chung, doi thuong xuyen — cache ngan
  customers: 15, orders: 15, careLeads: 15, cskhDuyenLite: 15,
  // bao cao / danh muc nhom — GAS tinh lau, nhieu nguoi cung xem
  salesReportA: 60, salesReportB: 60, salesReportC: 60, saleKpiReport: 60, failedOrderReport: 60, careLeadReport: 60, kpiReport: 60,
  mktChecklist: 60, salesReportOptions: 60, pancakeReport: 60, pancakeSdtReport: 60, dashboard: 60,
  teams: 60, mktTeams: 60, saleDirectory: 60, saleGroups: 60, pancakeNameMap: 60, pancakePageMap: 60,
  followUpTemplates: 60, messageTemplates: 60, aiExamples: 60,
  // danh muc gia / khuyen mai — it doi
  priceCatalogFlat: 120, priceCatalogTree: 120, ctkmCatalog: 120
};
const STALE_MAX_SEC = 600;
// STALE-WHILE-REVALIDATE (2026-10-10, giam lag): ban cache vua het han thi tra NGAY ban cu (x-crm-cache: SWR) va lam moi o nen,
// thay vi bat nguoi dung cho GAS (vai giay -> hang chuc giay voi bao cao/orders/cskhDuyenLite lon). Cua so SWR = ttl x SWR_FACTOR
// (toi da STALE_MAX_SEC): orders/customers 15s -> toi da 60s cu; bao cao 60s -> 240s; bang gia 120s -> 480s. Qua cua so thi cho ban moi nhu cu.
const SWR_FACTOR = 4;
const _inflight = new Map();   // khoa cache -> Promise lam moi dang chay (gop nhieu request cung luc thanh 1 lan goi GAS, trong cung isolate)
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
const NO_CACHE_PARAMS = ['demo', 'adminKey'];
// Tham so KHONG dua vao khoa cache (van chuyen tiep cho GAS): web client gan token phien + src cho moi request (buoc 3b bao mat) -> neu dua vao khoa thi moi nguoi 1 cache rieng, mat tac dung cache dung chung.
const KEY_IGNORE_PARAMS = ['token', 'src'];

function cors(res) {
  const h = new Headers(res.headers);
  h.set('access-control-allow-origin', '*');
  h.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  h.set('access-control-allow-headers', '*');
  h.set('access-control-expose-headers', 'x-crm-cache');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
function mark(res, note) {
  const h = new Headers(res.headers); h.set('x-crm-cache', note);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
const jsonRes = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8' } });

// Tra { ttl } neu request nay duoc phep cache, nguoc lai { why } (ly do chuyen thang).
export function cachePolicy(method, params) {
  if (method !== 'GET') return { why: 'method' };
  for (const k of NO_CACHE_PARAMS) if (params.has(k)) return { why: 'private-param' };
  const action = params.get('action') || '';
  const ttl = Object.prototype.hasOwnProperty.call(TTL_SEC, action) ? TTL_SEC[action] : 0;
  if (!ttl) return { why: 'action' };
  if (action === 'customers' && params.has('since')) return { why: 'delta' };
  return { ttl: ttl };
}
export function cacheKeyUrl(requestUrl) {
  const u = new URL(requestUrl);
  const pairs = []; u.searchParams.forEach((v, k) => { if (KEY_IGNORE_PARAMS.indexOf(k) === -1) pairs.push([k, v]); });
  pairs.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const k = new URL(u.origin + u.pathname); pairs.forEach(p => k.searchParams.append(p[0], p[1]));
  return k.toString();
}
export function isGoodJson(text) {
  if (!text || text.length > MAX_CACHE_BYTES) return false;
  let o; try { o = JSON.parse(text); } catch (e) { return false; }
  if (o === null || typeof o !== 'object') return false;
  if (!Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, 'error')) return false;
  return true;
}

async function passThrough(request, originUrl, note) {
  const init = { method: request.method, redirect: 'follow' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
    const ct = request.headers.get('content-type'); if (ct) init.headers = { 'content-type': ct };
  }
  try {
    const r = await fetch(originUrl, init);
    return cors(mark(new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }), note));
  } catch (e) {
    return cors(jsonRes({ error: 'Khong ket noi duoc GAS: ' + String(e && e.message || e) }, 502));
  }
}

export async function handle(request, env, ctx) {
  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
  const gas = env && env.GAS_URL;
  if (!gas) return cors(jsonRes({ error: 'Worker chua cau hinh bien GAS_URL.' }, 500));
  const url = new URL(request.url);
  const originUrl = new URL(gas); url.searchParams.forEach((v, k) => originUrl.searchParams.append(k, v));
  // Nguoi goi chua gan src (GET) -> danh dau 'worker' de log khong-token o GAS biet request di qua Worker (buoc 3b).
  if (request.method === 'GET' && !originUrl.searchParams.has('src')) originUrl.searchParams.set('src', 'worker');
  const policy = (env.DISABLED === '1' || env.DISABLED === 1) ? { why: 'disabled' } : cachePolicy(request.method, url.searchParams);
  if (!policy.ttl) return passThrough(request, originUrl.toString(), 'BYPASS:' + policy.why);

  const cache = caches.default, keyUrl = cacheKeyUrl(request.url), key = new Request(keyUrl, { method: 'GET' });
  const now = Date.now(); let stale = null;
  const swrMs = Math.min(STALE_MAX_SEC, policy.ttl * SWR_FACTOR) * 1000;
  const hit = await cache.match(key);
  if (hit) {
    const at = parseInt(hit.headers.get('x-crm-at') || '0', 10);
    if (at && now - at < policy.ttl * 1000) return cors(mark(hit, 'HIT'));
    if (at && now - at < swrMs) {
      // het han nhung con trong cua so SWR: tra ngay ban cu, lam moi o nen (gop request trung khoa)
      const bg = refresh(cache, key, keyUrl, originUrl.toString(), policy.ttl, now);
      if (ctx && ctx.waitUntil) ctx.waitUntil(bg.catch(() => {}));
      return cors(mark(hit, 'SWR'));
    }
    if (at && now - at < STALE_MAX_SEC * 1000) stale = hit;
  }
  try {
    const out = await refresh(cache, key, keyUrl, originUrl.toString(), policy.ttl, now, ctx);
    if (out.good) return cors(mark(new Response(out.text, { status: 200, headers: out.headers }), 'MISS'));   // Response moi cho MOI nguoi goi (body chi doc 1 lan)
    if (stale) return cors(mark(stale, 'STALE'));
    return cors(mark(new Response(out.text, { status: out.status, headers: { 'content-type': out.ct || 'application/json; charset=utf-8' } }), 'BYPASS:not-cacheable'));
  } catch (e) {
    if (stale) return cors(mark(stale, 'STALE'));
    return cors(jsonRes({ error: 'Khong ket noi duoc GAS: ' + String(e && e.message || e) }, 502));
  }
}

// Goi GAS 1 lan va luu cache neu phan hoi tot. Trung khoa dang chay thi dung lai cung Promise (khong goi GAS them).
// Tra { good, text, headers } (da luu cache) hoac { text, status, ct } (khong cache duoc). Nem loi neu khong ket noi duoc.
function refresh(cache, key, keyUrl, originUrl, ttl, now, ctx) {
  let p = _inflight.get(keyUrl);
  if (p) return p;
  p = (async () => {
    const r = await fetch(originUrl, { redirect: 'follow' });
    const text = await r.text();
    if (r.ok && isGoodJson(text)) {
      const res = new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + (ttl + STALE_MAX_SEC), 'x-crm-at': String(now) } });
      const put = cache.put(key, res.clone());
      if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put;
      return { good: true, text, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + (ttl + STALE_MAX_SEC), 'x-crm-at': String(now) } };
    }
    return { text, status: r.status, ct: r.headers.get('content-type') };
  })();
  _inflight.set(keyUrl, p);
  const done = () => { if (_inflight.get(keyUrl) === p) _inflight.delete(keyUrl); };
  p.then(done, done);
  return p;
}

export default { fetch: (request, env, ctx) => handle(request, env, ctx) };
