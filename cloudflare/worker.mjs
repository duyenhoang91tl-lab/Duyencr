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
// Action GAS chan theo phan quyen (vai tro/bo phan) -> KHONG duoc dung chung cache giua cac nguoi (neu khong nguoi bi chan van doc duoc ban cache cua nguoi khac).
// Khoa cache them user trong token; khong co SESS_SECRET (khong xac thuc duoc token) thi khong cache.
export const GATED_ACTIONS = ['salesReportA', 'salesReportB', 'salesReportC', 'saleKpiReport', 'failedOrderReport', 'careLeadReport', 'kpiReport', 'mktChecklist', 'pancakeReport', 'pancakeSdtReport'];
export function tokenUser(tok) {
  try {
    tok = String(tok || ''); const i = tok.indexOf('.'); if (i < 1) return '';
    const raw = atob(tok.slice(0, i).replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
    return p && p.u ? String(p.u) : '';
  } catch (e) { return ''; }
}
const STALE_MAX_SEC = 600;
// STALE-WHILE-REVALIDATE (2026-10-10, giam lag): ban cache vua het han thi tra NGAY ban cu (x-crm-cache: SWR) va lam moi o nen,
// thay vi bat nguoi dung cho GAS (vai giay -> hang chuc giay voi bao cao/orders/cskhDuyenLite lon). Cua so SWR = ttl x SWR_FACTOR
// (toi da STALE_MAX_SEC): orders/customers 15s -> toi da 60s cu; bao cao 60s -> 240s; bang gia 120s -> 480s. Qua cua so thi cho ban moi nhu cu.
const SWR_FACTOR = 4;
const _inflight = new Map();   // khoa cache -> Promise lam moi dang chay (gop nhieu request cung luc thanh 1 lan goi GAS, trong cung isolate)
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
const NO_CACHE_PARAMS = ['demo', 'adminKey'];
// Tham so KHONG dua vao khoa cache (van chuyen tiep cho GAS): web client gan token phien + src cho moi request (buoc 3b bao mat) -> neu dua vao khoa thi moi nguoi 1 cache rieng, mat tac dung cache dung chung.
const KEY_IGNORE_PARAMS = ['token', 'src', 'ek'];

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

// ═══ WEBHOOK PANCAKE -> SUPABASE (them 2026-10-12, docs/PANCAKE-INBOX.md buoc 1) ═══
// Pancake goi POST {worker}/pancake-webhook?key=<PANCAKE_WEBHOOK_KEY> moi khi co su kien (tin nhan moi...). Worker ghi NGUYEN payload
// vao bang Supabase pk_webhook_raw (chua tach tin nhan). NGUYEN NHAN ghi tho truoc: tai lieu Pancake khong mo ta dinh dang webhook,
// nen phai xem mau that roi moi thiet ke bang hoi thoai/tin nhan (buoc 2) — khong doan cau truc roi lam mat du lieu.
// Bien moi truong (dat tren Cloudflare Dashboard, loai Secret): PANCAKE_WEBHOOK_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Route nay KHONG dung GAS_URL, KHONG cache, KHONG co CORS (chi may chu Pancake goi). Tinh vao han muc 100.000 request/ngay cua Worker.
const PK_WEBHOOK_PATH = '/pancake-webhook';
const PK_MAX_BODY = 1024 * 1024;
const pkJson = (obj, status) => new Response(JSON.stringify(obj), { status: status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
// So sanh chuoi khong ro ri do dai/vi tri khac nhau (tranh do khoa tung ky tu qua thoi gian phan hoi).
export function pkSafeEqual(a, b) {
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
// Lay page_id / event_type CHI de loc nhanh (vai cho thuong gap, co the rong). Sai/thieu khong sao vi payload tho van duoc luu day du.
export function pkExtract(p) {
  const o = (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
  const d = (o.data && typeof o.data === 'object') ? o.data : {};
  const c = (d.conversation && typeof d.conversation === 'object') ? d.conversation : {};
  const pick = (...vals) => { for (const v of vals) if (v != null && typeof v !== 'object' && String(v) !== '') return String(v).slice(0, 100); return ''; };
  return { page_id: pick(o.page_id, d.page_id, c.page_id), event_type: pick(o.event_type, o.type, d.event_type) };
}
// BUOC 4b bao mat: xac thuc token phien (cung dinh dang GAS _sessIssue_: base64url(JSON{u,e}) + '.' + base64url(HMAC-SHA256)) bang bi mat chung SESS_SECRET.
// Dung de Worker KHONG phuc vu cache cho nguoi khong co token hop le (neu khong, bat chan o GAS van bi vong qua cache cua Worker).
export async function verifySessToken(tok, secret) {
  try {
    tok = String(tok || ''); const i = tok.indexOf('.');
    if (i < 1 || !secret) return false;
    const b64 = tok.slice(0, i), sig = tok.slice(i + 1);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(b64)));
    let bin = ''; for (const b of mac) bin += String.fromCharCode(b);
    const want = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (!pkSafeEqual(sig.replace(/=+$/, ''), want)) return false;
    const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
    return !!(p && p.u && p.e && p.e > Date.now());
  } catch (e) { return false; }
}
async function pancakeWebhook(request, env) {
  if (!env.PANCAKE_WEBHOOK_KEY) return pkJson({ error: 'Chua cau hinh PANCAKE_WEBHOOK_KEY.' }, 503);
  const url = new URL(request.url);
  if (!pkSafeEqual(url.searchParams.get('key'), env.PANCAKE_WEBHOOK_KEY)) return pkJson({ error: 'Sai khoa.' }, 401);
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'].filter(k => !env[k]);
  if (missing.length) return pkJson({ error: 'Chua cau hinh: ' + missing.join(', ') }, 503);
  // Chan doan (them 2026-10-12): GET ...&diag=1 thu GHI 1 dong that vao pk_webhook_raw va tra nguyen nhan Supabase (da qua khoa ?key=).
  // NGUYEN NHAN GOC: Pancake giau noi dung loi khi luu URL webhook, con POST that chi tra 502 chung chung -> khong biet sai URL Supabase,
  // sai khoa service_role hay thieu cot. Chan doan tra ma tinh trang + thong bao loi cua PostgREST (khong gom khoa).
  if (request.method === 'GET' && url.searchParams.get('diag') === '1') {
    try {
      const r = await fetch(String(env.SUPABASE_URL).replace(/\/+$/, '') + '/rest/v1/pk_webhook_raw', {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: env.SUPABASE_SERVICE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, prefer: 'return=minimal' },
        body: JSON.stringify({ page_id: '', event_type: 'diag', payload: { _diag: true } })
      });
      const t = r.ok ? '' : String(await r.text()).slice(0, 300);
      return pkJson({ ok: r.ok, supabase_status: r.status, detail: t }, r.ok ? 200 : 502);
    } catch (e) { return pkJson({ ok: false, error: 'Khong ket noi duoc Supabase (kiem tra SUPABASE_URL).' }, 502); }
  }
  if (request.method === 'GET') return pkJson({ ok: true, service: 'pancake-webhook', ready: true }, 200);   // mo bang trinh duyet de thu
  if (request.method !== 'POST') return pkJson({ error: 'Chi nhan POST.' }, 405);
  const text = await request.text();
  if (text.length > PK_MAX_BODY) return pkJson({ error: 'Payload qua lon.' }, 413);
  let payload; try { payload = JSON.parse(text); } catch (e) { payload = { _non_json: text.slice(0, 20000) }; }
  if (payload === null || typeof payload !== 'object') payload = { _value: payload };
  const ex = pkExtract(payload);
  // Ghi 1 dong vao pk_webhook_raw; tra {ok,status,detail}. NGUYEN NHAN GOC them ham: Pancake chi hien 'Endpoint phan hoi: 502' khi luu URL,
  // nen phai (1) luu lai ly do that vao DB (dong _fallback) va (2) thu lai bang dang an toan hon truoc khi tra 502.
  const sbInsert = async (row) => {
    try {
      const r = await fetch(String(env.SUPABASE_URL).replace(/\/+$/, '') + '/rest/v1/pk_webhook_raw', {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: env.SUPABASE_SERVICE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, prefer: 'return=minimal' },
        body: JSON.stringify(row)
      });
      return { ok: r.ok, status: r.status, detail: r.ok ? '' : String(await r.text()).split(String(env.SUPABASE_SERVICE_KEY)).join('***').split(String(env.PANCAKE_WEBHOOK_KEY)).join('***').slice(0, 300) };
    } catch (e) { return { ok: false, status: 0, detail: 'Khong ket noi duoc Supabase' }; }
  };
  const r1 = await sbInsert({ page_id: ex.page_id, event_type: ex.event_type, payload: payload });
  if (r1.ok) return pkJson({ ok: true }, 200);
  // Lan 1 loi (vd ky tu NUL \u0000 trong JSON bi jsonb tu choi, hoac dang payload la): luu NGUYEN van ban tho, bo NUL, kem ly do loi -> khong mat tin va biet nguyen nhan.
  const r2 = await sbInsert({ page_id: '', event_type: '_fallback', payload: { _raw_text: text.replace(/\u0000/g, '').slice(0, 20000), _first_status: r1.status, _first_error: r1.detail, _page_id: ex.page_id, _event_type: ex.event_type } });
  if (r2.ok) return pkJson({ ok: true, stored: 'fallback' }, 200);
  // Loi ghi DB -> tra 502 (khong 200) de neu Pancake co co che gui lai thi khong mat tin. Kem ma + thong bao loi PostgREST (khong chua khoa).
  return pkJson({ error: 'Supabase tu choi ghi.', status: r1.status, detail: r1.detail }, 502);
}

export async function handle(request, env, ctx) {
  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
  if (new URL(request.url).pathname === PK_WEBHOOK_PATH) return pancakeWebhook(request, env || {});
  const gas = env && env.GAS_URL;
  if (!gas) return cors(jsonRes({ error: 'Worker chua cau hinh bien GAS_URL.' }, 500));
  const url = new URL(request.url);
  const originUrl = new URL(gas); url.searchParams.forEach((v, k) => originUrl.searchParams.append(k, v));
  // Nguoi goi chua gan src (GET) -> danh dau 'worker' de log khong-token o GAS biet request di qua Worker (buoc 3b).
  if (request.method === 'GET' && !originUrl.searchParams.has('src')) originUrl.searchParams.set('src', 'worker');
  const policy = (env.DISABLED === '1' || env.DISABLED === 1) ? { why: 'disabled' } : cachePolicy(request.method, url.searchParams);
  if (!policy.ttl) return passThrough(request, originUrl.toString(), 'BYPASS:' + policy.why);

  // Da cau hinh SESS_SECRET: chi phuc vu/ghi cache cho request co token phien HOP LE. Con lai chuyen thang GAS (GAS quyet dinh co cho qua khong) va KHONG cache.
  if (env.SESS_SECRET && !(await verifySessToken(url.searchParams.get('token'), env.SESS_SECRET))) return passThrough(request, originUrl.toString(), 'BYPASS:no-valid-token');

  let keyUrl = cacheKeyUrl(request.url);
  if (GATED_ACTIONS.indexOf(url.searchParams.get('action') || '') !== -1) {
    const who = env.SESS_SECRET ? tokenUser(url.searchParams.get('token')) : '';
    if (!who) return passThrough(request, originUrl.toString(), 'BYPASS:gated-no-user');
    keyUrl += (keyUrl.indexOf('?') === -1 ? '?' : '&') + '_u=' + encodeURIComponent(who);
  }
  const cache = caches.default, key = new Request(keyUrl, { method: 'GET' });
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
