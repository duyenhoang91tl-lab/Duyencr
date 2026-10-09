#!/usr/bin/env node
// Test Node (fetch gia, sheet gia) cho BUOC 4e cua docs/SUPABASE-PLAN.md: action 'customers' doc tu Supabase sau co bat-tat.
//   4e-1 delta (sbReadCareDelta_)  [4e-2 FULL se them sau]
// Chay: node tools/test-supabase-carelist.js -> "ALL CARE LIST TESTS PASSED". Khong goi mang that.
// So KET QUA (JSON) giua duong Sheets (readCareDelta_/readCare_) va duong Supabase, roi ep tung dieu kien fallback.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) {
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i);
  for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
const CARE_HEADERS = ['phone','status','zalo','cs','note','schedules','schedGoi','schedGoiNote','schedSP','schedSPNote','schedCS','schedCSNote','schedHen','schedHenNote','updated','khStatus','nickZalos','birthday','zaloSetBy','name','custom','zaloPhones'];
const code = ['var SH_CARE = "CareData";', ['normPhone_', 'careObjFromRow_', 'readCare_', 'readCareDelta_'].map(fnSrc).join('\n'), src.slice(src.indexOf('var SB_BATCH_ ='))].join('\n');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const J = x => JSON.stringify(x);

// ---- CareData gia: 2500 dong (3 trang), Date va chuoi lan lon, 1 dong rong cuoi ----
const base = Date.UTC(2026, 9, 1, 0, 0, 0);
const rows = [CARE_HEADERS.slice()];
for (let i = 0; i < 2500; i++) {
  const r = new Array(22).fill('');
  r[0] = i % 9 === 0 ? Number('91' + String(1000000 + i)) : '09' + String(10000000 + i);   // 1/9 SDT la number thieu so 0
  r[1] = 'st' + (i % 5); r[2] = i % 2 ? 'Đã kết bạn' : ''; r[3] = ' CS' + (i % 3) + ' '; r[4] = 'ghi chu ' + i;
  r[12] = i % 4 === 0 ? new Date(base + i * 60000) : (i % 4 === 1 ? '09/10/2026' : '');
  r[14] = i % 3 === 0 ? new Date(base + i * 60000) : new Date(base + i * 60000).toISOString();   // updated: Date that / chuoi ISO
  r[16] = i % 6 === 0 ? JSON.stringify([{ nick: 'n' + i }]) : ''; r[17] = i % 10 === 0 ? '01/01/1990' : '';
  r[20] = i % 7 === 0 ? JSON.stringify({ f1: 'v' + i }) : ''; r[21] = i % 8 === 0 ? JSON.stringify(['0911222333']) : '';
  rows.push(r);
}
rows.push(new Array(22).fill(''));
const sheet = { getLastRow: () => rows.length, getDataRange: () => ({ getValues: () => rows.map(x => x.slice()) }),
  getRange: (r, c, n, w) => ({ getValues: () => rows.slice(r - 1, r - 1 + n).map(x => { const y = x.slice(c - 1, c - 1 + w); while (y.length < w) y.push(''); return y; }) }) };

// ---- Supabase gia ----
const care = new Map(); const net = { gets: 0, fails: false, countLie: 0 };
const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY', SB_MODE: 'read', SB_CARE_DELTA_READ: 'on', SB_CARE_FULL_READ: 'on' };
const R = (code, body, h) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => h || {} });
function fetchOne(url, o) {
  if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
  const u = new URL(url); if (!u.pathname.endsWith('/care_data')) return R(404, 'khong co bang');
  const method = String(o.method || 'get').toUpperCase();
  if (method === 'POST') { for (const r of JSON.parse(o.payload)) care.set(r.phone, JSON.parse(JSON.stringify(r))); return R(201, ''); }
  net.gets++; if (net.fails) return R(500, 'boom');
  if ((o.headers.Prefer || '') === 'count=exact') return R(206, '[]', { 'Content-Range': '0-0/' + (care.size + net.countLie) });
  let list = [...care.values()];
  const ua = u.searchParams.get('updated_at'); if (ua && ua.startsWith('gte.')) list = list.filter(r => new Date(r.updated_at) >= new Date(ua.slice(4)));
  const ord = u.searchParams.get('order'); if (ord === 'phone.asc') list.sort((a, b) => a.phone < b.phone ? -1 : a.phone > b.phone ? 1 : 0);
  const off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || 1000);
  list = list.slice(off, off + lim);
  const sel = u.searchParams.get('select'); if (sel && sel !== '*') list = list.map(r => { const o2 = {}; sel.split(',').forEach(c => o2[c] = r[c]); return o2; });
  return R(200, JSON.stringify(list));
}
// Date: dung chung Date cua Node voi sandbox, neu khong `u instanceof Date` trong readCareDelta_ sai (Date tao o ngoai vm != Date trong vm).
const ctx = { Date, Logger: { log(m) { if (process.env.DBG) console.error('LOG', m); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => props[k] = String(v), deleteProperty: k => delete props[k], getProperties: () => Object.assign({}, props) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  CARE_HEADERS, getSheet_: () => sheet, UrlFetchApp: { fetch: fetchOne, fetchAll: reqs => reqs.map(r => fetchOne(r.url, r)) } };
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = c => vm.runInContext(c, ctx);
const byPhone = a => a.slice().sort((x, y) => x.phone < y.phone ? -1 : x.phone > y.phone ? 1 : 0);
// SDT dang SO thieu 0: Sheets tra o goc, Supabase tra SDT chuan hoa (khac biet da biet) -> chuan hoa phia Sheets truoc khi so.
const normSheet = a => a.map(o => Object.assign({}, o, { phone: run('normPhone_("' + o.phone + '")') }));

ctx.__rows = rows.slice(1); ctx.__sh = sheet;
run('sbRowsToRecs_(__rows)').forEach(rec => { if (!care.has(rec.phone)) care.set(rec.phone, JSON.parse(JSON.stringify(rec))); });
ok(care.size === 2500, 'care_data gia co 2500 SDT: ' + care.size);
const gets = () => net.gets;
const sheetDelta = since => run('readCareDelta_(__sh, "' + since + '")');

// ===== 4e-1 DELTA: giong het Sheets, nhieu moc since =====
const sample = run('readCare_(__sh)');
ok(sample.length === 2500 && sample.some(o => o.phone[0] !== '0'), 'du lieu test co o SDT dang so thieu 0');
for (const k of [0, 1, 1200, 2490, 2600]) {
  const since = new Date(base + k * 60000).toISOString();
  const a = sheetDelta(since); let g0 = gets(); const b = run('sbReadCareDelta_("' + since + '")');
  ok(a && b && a.delta && b.delta && gets() > g0, 'delta co ket qua + goi Supabase k=' + k);
  ok(J(byPhone(b.rows)) === J(byPhone(normSheet(a.rows))), 'delta giong het Sheets k=' + k + ' (' + a.rows.length + ' vs ' + b.rows.length + ')');
}
const sinceMid = new Date(base + 2000 * 60000).toISOString();
ok(run('sbReadCareDelta_("' + sinceMid + '")').rows.length === 499, 'delta moc giua: 499 dong moi hon');
ok(run('sbReadCareDelta_("khong phai ngay")') === undefined, 'since khong hop le -> Sheets');
ok(run('sbReadCareDelta_("' + new Date(base + 99999999 * 60000).toISOString() + '")').rows.length === 0, 'since o tuong lai -> 0 dong');

// nguong delta: > 3000 dong thay doi -> null (client keo FULL), y nhu readCareDelta_
const saved = new Map(care);
for (let i = 0; i < 3100; i++) { const phone = '0933' + String(100000 + i); care.set(phone, { phone, status: '', zalo: '', cs: '', note: '', updated: '2030-01-01T00:00:00.000Z', updated_at: '2030-01-01T00:00:00.000Z', nick_zalos: '[]', zalo_phones: '[]' }); }
ok(run('sbReadCareDelta_("2029-12-31T00:00:00.000Z")') === null, '> 3000 thay doi -> null');
care.clear(); saved.forEach((v, k) => care.set(k, v));

// ===== FALLBACK: moi dieu kien sai -> undefined, khong goi mang =====
const keep = Object.assign({}, props); const restore = () => { Object.keys(props).forEach(k => delete props[k]); Object.assign(props, keep); };
function undefNoNet(label, setup, call) { setup(); const g = gets(); const v = run(call); const used = gets() - g; restore(); ok(v === undefined, label + ': phai tra undefined'); ok(used === 0, label + ': khong duoc goi mang (' + used + ')'); }
const D = 'sbReadCareDelta_("' + sinceMid + '")', DF = 'SB_CARE_DELTA_READ';
undefNoNet('DELTA tat', () => delete props[DF], D);
undefNoNet('DELTA SB_MODE=write', () => props.SB_MODE = 'write', D);
undefNoNet('DELTA SB_MODE chua dat', () => delete props.SB_MODE, D);
undefNoNet('DELTA STALE', () => props.SB_STALE = 'x', D);
undefNoNet('DELTA co SDT dirty', () => props.SB_DIRTY_CARE = '["0910000001"]', D);
undefNoNet('DELTA thieu URL', () => delete props.SUPABASE_URL, D);
net.fails = true; { const g = gets(); ok(run(D) === undefined, 'DELTA HTTP 500 -> undefined (khong nem loi)'); ok(gets() > g, 'DELTA da thu goi'); } net.fails = false;
// dirty xuat hien TRONG LUC tai -> bo ket qua, doc Sheets
{ const f0 = ctx.UrlFetchApp.fetch; ctx.UrlFetchApp.fetch = (u, o) => { const r = f0(u, o); props.SB_DIRTY_CARE = '["0910000001"]'; return r; };
  ok(run(D) === undefined, 'dirty xuat hien giua luc tai -> undefined'); ctx.UrlFetchApp.fetch = f0; restore(); }

// ===== bat / tat =====
delete props[DF];
vm.runInContext('sbCompareCare_ = function () { return { ok: false }; }', ctx);
let en = run('sbCareListEnable_("SB_CARE_DELTA_READ")'); ok(!en.ok && !props[DF], 'doi chieu khong khop -> khong bat');
vm.runInContext('sbCompareCare_ = function () { return { ok: true }; }', ctx);
props.SB_MODE = 'write'; en = run('sbCareListEnable_("SB_CARE_DELTA_READ")'); ok(!en.ok && /sbBatDocSupabase/.test(en.error), 'chua SB_MODE=read -> khong bat'); props.SB_MODE = 'read';
props.SB_STALE = 'x'; en = run('sbCareListEnable_("SB_CARE_DELTA_READ")'); ok(!en.ok && /STALE/.test(en.error), 'STALE -> khong bat'); delete props.SB_STALE;
props.SB_DIRTY_CARE = '["0910000001"]'; en = run('sbCareListEnable_("SB_CARE_DELTA_READ")'); ok(!en.ok && /dirty/.test(en.error), 'dirty -> khong bat'); delete props.SB_DIRTY_CARE;
en = run('sbCareListEnable_("SB_CARE_DELTA_READ")'); ok(en.ok && props[DF] === 'on' && en.careListRead.deltaReadsSupabaseNow, 'bat DELTA');
run('sbCareListDisable_("SB_CARE_DELTA_READ")'); ok(!props[DF], 'tat DELTA');
props[DF] = 'on'; props.SB_ORD_READ = 'on';
const m = run('sbSetMode_("off", false)'); ok(m.ok && !props[DF] && !props.SB_ORD_READ, 'sbSetMode off tat sach cac cong tac doc');
ok(typeof ctx.sbKHDeltaBat === 'function' && typeof ctx.sbKHDeltaTat === 'function', 'co ham chay tay khong gach duoi');
ok(!JSON.stringify(run('sbCareListStatus_()')).includes('SECRETKEY'), 'status khong lo key');
console.log('ALL CARE LIST TESTS PASSED');
