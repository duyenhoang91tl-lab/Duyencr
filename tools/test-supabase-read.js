#!/usr/bin/env node
// Test Node (fetch gia, sheet gia) cho BUOC 4c cua docs/SUPABASE-PLAN.md: doc don hang / lich hen tu Supabase sau co bat-tat, co fallback Sheets.
// Chay: node tools/test-supabase-read.js  -> in "ALL ORDER READ TESTS PASSED". Khong goi mang that, khong can key that.
// Y tuong: dong bo that (sbOrdersSync_) tu sheet gia len Supabase gia, roi so KET QUA GIONG HET giua duong Sheets (co tat) va duong Supabase (co bat)
// cho tung ham doc; sau do ep tung dieu kien fallback (dirty, cu, dang dong bo, lech so dong, loi HTTP, STALE...) va kiem tra ket qua van dung + khong goi mang.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) {
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i);
  for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
function between(a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('khong thay moc ' + a); return src.slice(i, j); }
const consts = between("var DT_TONG_SHEET", "// SUA 2026-10-04: 15") + between("var DON_CHITIET_WIDTH = 17;", "// ─── DT TỔNG = nguon") + between("var DT_COL_NGAYTAO", "// Sentinel dung thay cho");
const NAMES = ['_vnYmdParts_', '_vnMidnight_', 'normPhone_', '_dtCellToVnStr_', '_normMoney_', 'parseVNDate_', 'splitMulti_', '_donConvertRows_', 'dtRowToOrder_',
  '_hiddenPageSaleSets_', '_isDTRowHidden_', '_donSaleNamesFromThe_', 'readDTTong_', 'readOrdersByPhone_', '_dedupeSameOrders_', '_readOrdersByPhoneSheets_',
  'findDonRowsByPhone_', 'readDonChiTiet_', 'readRemindersToday_', '_remindersFromRows_'];
const code = [consts, 'var VN_OFFSET_MS = 7 * 3600 * 1000; var SH_CARE = "CareData";', NAMES.map(fnSrc).join('\n'), src.slice(src.indexOf('var SB_BATCH_ ='))].join('\n');

const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const D = (y, m, d, h = 0, mi = 0) => new Date(Date.UTC(y, m - 1, d, h, mi));

// ---- sheet "DT TỔNG " gia (20 cot) ----
const dtRows = [];
for (let i = 0; i < 1100; i++) {
  const r = new Array(20).fill('');
  r[0] = i % 3 === 0 ? D(2026, 10, 1 + (i % 28), 9, 30) : '0' + (1 + (i % 9)) + '/10/2026 08:00';
  r[1] = ' Nguoi ' + (i % 4) + ' '; r[2] = 'giao' + i;
  r[3] = i % 7 === 0 ? Number('912' + String(100000 + i)) : '0912' + String(100000 + i);
  if (i >= 1090) r[3] = '0912100000';                                  // 10 dong cuoi cung SDT voi dong dau (1 khach nhieu don; 2 dong giong het -> khu trung)
  r[6] = 'gd' + (i % 3); r[7] = 'Hoan thanh'; r[10] = D(2026, 10, 2 + (i % 27), 14, 5);
  r[12] = ' kenh' + (i % 2) + ' '; r[13] = 'Sale A, Sale B'; r[14] = i >= 1090 ? 'spTrung' : 'sp ' + i; r[15] = 'pl';
  r[16] = 100000; r[17] = i >= 1090 ? 500000 : (i % 5 === 0 ? '1.500.000đ' : 2000000 + i); r[18] = -5; r[19] = 'ID' + i;
  if (i >= 1090) { r[0] = D(2026, 10, 5, 9, 0); r[10] = D(2026, 10, 6, 9, 0); }   // cung ngay (date = thoi gian HT) -> 10 dong 1090..1099 giong het nhau (date|revenue|product)
  dtRows.push(r);
}
const onlyVal = new Array(20).fill(''); onlyVal[17] = 777000; dtRows.splice(500, 0, onlyVal);
dtRows.push(new Array(20).fill(''), new Array(20).fill(''));
// ---- sheet "dữ liệu đơn" gia (17 cot) ----
const donRows = [];
for (let i = 0; i < 1100; i++) {
  const r = new Array(17).fill('');
  r[1] = i % 10 === 5 ? '' : D(2026, 10, 1 + (i % 28), 0, 0);          // dong thu 10 thieu ngay -> ke thua ngay dong tren (khong luu duoc trong raw cua rieng dong!)
  r[2] = 'Sale A,Sale B'; r[3] = 'Khach ' + i; r[4] = i < 6 ? '0912999999' : '0912' + String(200000 + i); r[7] = 'Base'; r[8] = 'SP ' + i; r[9] = 'M' + i; r[10] = '1';
  r[11] = 1000000 + i; r[12] = 30000; r[13] = ' Mkt ' + (i % 3); r[14] = 'Hoan thanh';
  donRows.push(r);
}
donRows.push(new Array(17).fill(''));
const sheets = { 'DT TỔNG ': { rows: [new Array(20).fill('h')].concat(dtRows), maxCols: 20 }, 'dữ liệu đơn': { rows: [new Array(17).fill('h')].concat(donRows), maxCols: 17 } };
const mkSheet = o => ({ getLastRow: () => o.rows.length, getMaxColumns: () => o.maxCols,
  getRange: (r, c, n, w) => ({ getValues: () => o.rows.slice(r - 1, r - 1 + n).map(x => { const y = x.slice(c - 1, c - 1 + w); while (y.length < w) y.push(''); return y; }) }) });

// ---- sheet CareData gia (22 cot) cho reminders ----
const careRows = [new Array(22).fill('h')];
const today = new Date(); today.setHours(0, 0, 0, 0);
const todayNoon = new Date(today.getTime() + 12 * 3600 * 1000), yesterday = new Date(today.getTime() - 86400000 + 3600000);
function careRow(phone, cs, hen, note) { const r = new Array(22).fill(''); r[0] = phone; r[1] = 'st'; r[2] = 'z'; r[3] = cs; r[12] = hen; r[13] = note; return r; }
careRows.push(careRow('0900000001', 'CS1', todayNoon, 'goi lai'), careRow('0900000002', ' CS1 ', todayNoon, 'cs co khoang trang'), careRow('0900000003', 'CS2', todayNoon, 'cs2'),
  careRow('0900000004', 'CS1', yesterday, 'qua han'), careRow('0900000005', 'CS1', '', 'khong hen'), careRow('0900000006', 'CS1', todayNoon, 'dong 6'), careRow('0900000006', 'CS1', todayNoon, 'dong 6'),   // SDT trung CUNG noi dung (khac noi dung: Sheets lay dong DAU, ban mirror lay dong CUOI — da biet tu buoc 3, xu ly bang runDedupeCare truoc khi bat read)
  
  careRow('0900000007', 'CS1', 'abc khong phai ngay', 'chuoi tay'));
const careSheet = { getLastRow: () => careRows.length, getDataRange: () => ({ getValues: () => careRows.map(x => x.slice()) }) };

// ---- Supabase gia ----
const tables = { dt_tong: new Map(), don_chi_tiet: new Map(), care_data: new Map() };
const keyOf = (t, r) => t === 'dt_tong' ? r.id + '|' + r.src_row : t === 'care_data' ? r.phone : String(r.src_row);
const net = { gets: 0, fails: false };
const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY' };
let settings = {};
const R = (code, body, h) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => h || {} });
function fetchOne(url, o) {
  if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
  const u = new URL(url), t = u.pathname.split('/').pop(), tb = tables[t];
  if (!tb) return R(404, 'khong co bang ' + t);
  const method = String(o.method || 'get').toUpperCase();
  if (method === 'DELETE') {
    const fl = u.searchParams.getAll('src_row').map(x => x.split('.'));
    for (const [k, r] of [...tb]) if (fl.every(([op, v]) => op === 'gte' ? r.src_row >= +v : op === 'lte' ? r.src_row <= +v : op === 'gt' ? r.src_row > +v : false)) tb.delete(k);
    return R(204, '');
  }
  if (method === 'POST') { for (const r of JSON.parse(o.payload)) tb.set(keyOf(t, r), JSON.parse(JSON.stringify(r))); return R(201, ''); }   // di qua JSON that nhu jsonb
  net.gets++;
  if (net.fails) return R(500, 'boom');
  const sr = u.searchParams.get('src_row');
  if (sr && sr.startsWith('in.(')) { const set = new Set(sr.slice(4, -1).split(',').map(Number)); return R(200, JSON.stringify([...tb.values()].filter(r => set.has(r.src_row)))); }
  if ((o.headers.Prefer || '') === 'count=exact') return R(206, '[]', { 'Content-Range': '0-0/' + [...tb.values()].filter(r => !r.archived).length });
  let rows = [...tb.values()];
  for (const [k, v] of u.searchParams) {
    if (k === 'archived' && v === 'eq.false') rows = rows.filter(r => !r.archived);
    else if (k === 'phone' && v.startsWith('eq.')) rows = rows.filter(r => r.phone === v.slice(3));
    else if (k === 'sched_hen' && v === 'neq.') rows = rows.filter(r => r.sched_hen !== '');
  }
  const ord = u.searchParams.get('order');
  if (ord) { const f = ord.split('.')[0]; rows.sort((a, b) => typeof a[f] === 'number' ? a[f] - b[f] : String(a[f]).localeCompare(String(b[f]))); }
  const off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || 1000);
  rows = rows.slice(off, off + lim);
  const sel = u.searchParams.get('select');
  if (sel && sel !== '*') rows = rows.map(r => { const o2 = {}; sel.split(',').forEach(c => o2[c] = r[c]); return o2; });
  return R(200, JSON.stringify(rows));
}
const ctx = {
  Logger: { log(m) { if (process.env.DBG) console.error('LOG', m); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => props[k] = String(v), deleteProperty: k => delete props[k], getProperties: () => Object.assign({}, props) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ScriptApp: (() => { const tr = []; return { getProjectTriggers: () => tr.slice(), deleteTrigger: x => tr.splice(tr.indexOf(x), 1),
    newTrigger: fn => ({ timeBased: () => ({ everyMinutes: m => ({ create: () => tr.push({ getHandlerFunction: () => fn, minutes: m }) }) }) }) }; })(),
  getDTSS_: () => ({ getSheetByName: n => sheets[n] ? mkSheet(sheets[n]) : null }),
  getCrmSS_: () => ({ getSheetByName: n => n === 'CareData' ? careSheet : null }),
  getSetting_: k => settings[k] || '', _pancakeKnownSaleNameSet_: () => ({}), _normTxt_: x => String(x == null ? '' : x).trim().toLowerCase(), POS_EXTRA_SALE_NAMES_: [], _cacheGetBig_: () => null, _cachePutBig_() {},
  UrlFetchApp: { fetch: fetchOne, fetchAll: reqs => reqs.map(r => fetchOne(r.url, r)) }
};
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = c => vm.runInContext(c, ctx);
const J = x => JSON.stringify(x);
const calls = () => net.gets;
const PHONES = ['0912100000', '0912100007', '0912100001', '0912999999', '0912555555'];   // nhieu don+khu trung / SDT number thieu 0 / binh thuong / don chi tiet nhieu dong / khong co

// ===== 0) mac dinh TAT: khong goi mang, ket qua = Sheets =====
const base = {
  dt: J(run('readDTTong_()')), ph: PHONES.map(p => J(run('readOrdersByPhone_("' + p + '")'))), don: PHONES.map(p => J(run('findDonRowsByPhone_("' + p + '")'))),
  rem1: J(run('readRemindersToday_("CS1")')), remAll: J(run('readRemindersToday_("")'))
};
ok(calls() === 0, 'co TAT thi khong duoc goi Supabase: ' + calls());
ok(JSON.parse(base.dt).length === 1101, 'baseline dt co 1101 dong: ' + JSON.parse(base.dt).length);
ok(JSON.parse(base.ph[0]).length === 2, 'baseline: 11 dong cung SDT, 10 dong giong het gop thanh 1 + dong goc = 2: ' + JSON.parse(base.ph[0]).length);
ok(JSON.parse(base.don[3]).length === 6, 'baseline don chi tiet SDT 0912999999 co 6 dong');
const rems1 = JSON.parse(base.rem1);
ok(rems1.map(x => x.phone).join() === '0900000001,0900000002,0900000006', 'baseline reminders CS1 hom nay (trim cs, gop SDT trung, bo qua han / khong hen / chuoi tay): ' + rems1.map(x => x.phone));
ok(/GMT|^[A-Z][a-z]{2} /.test(rems1[0].schedHen), 'baseline schedHen la String(Date): ' + rems1[0].schedHen);

// ===== 1) dong bo that, nhung chua bat co: van khong goi doc =====
let r = run('sbOrdersSync_()');
ok(r.ok && r.complete && tables.dt_tong.size === 1101 && tables.don_chi_tiet.size === 1100, 'dong bo: ' + J(r).slice(0, 300) + ' dt ' + tables.dt_tong.size + ' don ' + tables.don_chi_tiet.size);
let g0 = calls();
ok(J(run('readDTTong_()')) === base.dt && calls() === g0, 'co TAT: readDTTong_ doc Sheets, khong goi mang');
ok(run('sbOrdReadStatus_()').on === false, 'status: tat');

// ===== 2) sbDonHangBatDoc / sbOrdReadEnable_ =====
ctx.sbCompareDT_ = () => ({ ok: false }); let en = run('sbOrdReadEnable_()');   // doi chieu khong khop -> tu choi
ok(!en.ok && !props.SB_ORD_READ, 'doi chieu khong khop -> khong bat: ' + J(en));
vm.runInContext('sbCompareDT_ = function (o) { return sbCompareOrders_("dt", o); }', ctx);
props.SB_DT_DIRTY = String(Date.now()); en = run('sbOrdReadEnable_()');
ok(!en.ok && /dirty|ghi Sheet/.test(en.error) && !props.SB_ORD_READ, 'dirty -> khong bat: ' + J(en)); delete props.SB_DT_DIRTY;
const savedState = props.SB_ORD_STATE; { const s = JSON.parse(savedState); s.don.syncedAt = Date.now() - 31 * 60000; props.SB_ORD_STATE = J(s); }
en = run('sbOrdReadEnable_()'); ok(!en.ok && /phut/.test(en.error), 'du lieu cu >30 phut -> khong bat: ' + J(en)); props.SB_ORD_STATE = savedState;
en = run('sbOrdReadEnable_()');
ok(en.ok && props.SB_ORD_READ === 'on' && en.warning && /trigger/.test(en.warning), 'bat duoc + canh bao chua co trigger: ' + J(en).slice(0, 300));
ok(run('sbOrdReadStatus_()').dt.readsSupabaseNow === true, 'status: dt dang doc Supabase');

// ===== 3) CO BAT: ket qua GIONG HET Sheets =====
g0 = calls();
ok(J(run('readDTTong_()')) === base.dt, 'readDTTong_ giong het Sheets');
ok(calls() > g0, 'readDTTong_ co goi Supabase khi bat');
PHONES.forEach((p, i) => {
  g0 = calls(); const gotO = J(run('readOrdersByPhone_("' + p + '")')), usedO = calls() - g0;
  ok(gotO === base.ph[i], 'readOrdersByPhone_ ' + p + ' giong het:\n' + gotO + '\n' + base.ph[i]);
  ok(usedO === 1, 'readOrdersByPhone_ ' + p + ' dung dung 1 lan goi: ' + usedO);
  g0 = calls(); const gotD = J(run('findDonRowsByPhone_("' + p + '")')), usedD = calls() - g0;
  ok(gotD === base.don[i], 'findDonRowsByPhone_ ' + p + ' giong het:\n' + gotD + '\n' + base.don[i]);
  ok(usedD === 1, 'findDonRowsByPhone_ ' + p + ' dung dung 1 lan goi: ' + usedD);
});
{ // ngay ke thua: dong thieu ngay (i%10==5) phai ra ngay dong tren, khong rong
  const rows = JSON.parse(base.don[3]); ok(rows.every(x => x.date), 'moi dong don chi tiet co ngay (ke thua): ' + J(rows));
}
// loc ẩn kenh (Settings) ap dung y nhu cu tren du lieu Supabase
settings = { hiddenChannels: J(['kenh0']) };
const hidden = run('readDTTong_()');
ok(J(hidden) === J(JSON.parse(base.dt).filter(x => x.kenhBan !== 'kenh0')) && hidden.length < 1101, 'an kenh0 van ap dung y nhu cu (' + hidden.length + ')');
settings = {};
// nhieu trang: > 1000 dong phai tai du (1101 dong = 2 trang + 1 trang du)
ok(run('readDTTong_()').length === 1101, 'phan trang tai du 1101 dong');

// ===== 4) FALLBACK: moi dieu kien sai -> doc Sheets (khong goi Supabase) va ket qua van dung =====
function fallsBack(label, setup, teardown, fnCall, expected) {
  setup(); g0 = calls(); const got = J(run(fnCall)); const used = calls() - g0; teardown();
  ok(got === expected, label + ': ket qua phai bang Sheets');
  return used;
}
const keep = {}; ['SB_DT_DIRTY', 'SB_DON_DIRTY', 'SB_ORD_RUNNING', 'SB_ORD_STATE', 'SB_ORD_READ'].forEach(k => keep[k] = props[k]);
const restore = () => Object.keys(keep).forEach(k => { if (keep[k] === undefined) delete props[k]; else props[k] = keep[k]; });
ok(fallsBack('dt dirty (readDTTong_)', () => props.SB_DT_DIRTY = String(Date.now()), restore, 'readDTTong_()', base.dt) === 0, 'dt dirty khong duoc goi Supabase');
ok(fallsBack('dt dirty (theo SDT)', () => props.SB_DT_DIRTY = String(Date.now()), restore, 'readOrdersByPhone_("0912100000")', base.ph[0]) === 0, 'dt dirty theo SDT khong goi');
ok(fallsBack('don dirty khong anh huong dt', () => props.SB_DON_DIRTY = String(Date.now()), restore, 'readOrdersByPhone_("0912100001")', base.ph[2]) === 1, 'don dirty khong chan doc dt');
ok(fallsBack('don dirty (findDon)', () => props.SB_DON_DIRTY = String(Date.now()), restore, 'findDonRowsByPhone_("0912999999")', base.don[3]) === 0, 'don dirty khong goi');
ok(fallsBack('dang dong bo', () => props.SB_ORD_RUNNING = String(Date.now()), restore, 'readDTTong_()', base.dt) === 0, 'dang dong bo khong goi');
ok(fallsBack('co RUNNING het han thi van doc Supabase', () => props.SB_ORD_RUNNING = String(Date.now() - 7 * 60000), restore, 'readOrdersByPhone_("0912100001")', base.ph[2]) === 1, 'RUNNING het han bi bo qua');
ok(fallsBack('du lieu cu', () => { const s = JSON.parse(props.SB_ORD_STATE); s.dt.syncedAt = Date.now() - 31 * 60000; props.SB_ORD_STATE = J(s); }, restore, 'readDTTong_()', base.dt) === 0, 'cu khong goi');
ok(fallsBack('chua tung dong bo', () => props.SB_ORD_STATE = '{}', restore, 'readOrdersByPhone_("0912100001")', base.ph[2]) === 0, 'chua dong bo khong goi');
ok(fallsBack('co tat', () => delete props.SB_ORD_READ, restore, 'readDTTong_()', base.dt) === 0, 'co tat khong goi');
ok(fallsBack('thieu cau hinh', () => { props.__u = props.SUPABASE_URL; delete props.SUPABASE_URL; }, () => { props.SUPABASE_URL = props.__u; delete props.__u; }, 'readDTTong_()', base.dt) === 0, 'thieu URL khong goi');
// Supabase loi HTTP -> khong nem loi, doc Sheets
ok(fallsBack('Supabase HTTP 500', () => net.fails = true, () => net.fails = false, 'readDTTong_()', base.dt) >= 1, 'da thu goi roi roi ve Sheets (dt)');
ok(fallsBack('Supabase HTTP 500 (SDT)', () => net.fails = true, () => net.fails = false, 'readOrdersByPhone_("0912100000")', base.ph[0]) >= 1, 'loi (SDT)');
ok(fallsBack('Supabase HTTP 500 (don)', () => net.fails = true, () => net.fails = false, 'findDonRowsByPhone_("0912999999")', base.don[3]) >= 1, 'loi (don)');
// lech so dong (Supabase mat 1 dong) -> readDTTong_ ve Sheets
{ const k = 'ID5|7'; const saved = tables.dt_tong.get(k); ok(saved, 'co dong de xoa');
  tables.dt_tong.delete(k); g0 = calls(); const got = J(run('readDTTong_()')); ok(got === base.dt && calls() > g0, 'lech so dong -> ve Sheets, ket qua dung'); tables.dt_tong.set(k, saved); }
// tick dong bo xong sau khi CRM ghi: dirty bi xoa => lai doc Supabase
props.SB_DT_DIRTY = String(Date.now()); r = run('sbOrdersSync_()'); ok(r.ok && r.complete && !props.SB_DT_DIRTY, 'sau dong bo, dirty bi xoa');
g0 = calls(); ok(J(run('readOrdersByPhone_("0912100001")')) === base.ph[2] && calls() === g0 + 1, 'het dirty -> doc Supabase lai');

// ===== 5) reminders (care_data) =====
ctx.__rows = careRows.slice(1);
run('sbRowsToRecs_(__rows)').forEach(rec => tables.care_data.set(rec.phone, JSON.parse(JSON.stringify(rec))));   // mirror that: SDT trung -> ban ghi sau cung thang
ok(tables.care_data.size === 7, 'care_data gia co 7 SDT: ' + tables.care_data.size);
g0 = calls();
ok(J(run('readRemindersToday_("CS1")')) === base.rem1 && calls() === g0, 'SB_MODE chua dat -> doc Sheets, khong goi mang');
props.SB_MODE = 'write'; ok(J(run('readRemindersToday_("CS1")')) === base.rem1 && calls() === g0, 'SB_MODE=write -> doc Sheets');
props.SB_MODE = 'read';
ok(J(run('readRemindersToday_("CS1")')) === base.rem1, 'reminders CS1 giong het Sheets (ke ca schedHen String(Date), cs co khoang trang, gop SDT trung):\n' + J(run('readRemindersToday_("CS1")')) + '\n' + base.rem1);
ok(J(run('readRemindersToday_("")')) === base.remAll && calls() > g0, 'reminders khong loc cs giong het Sheets + co goi Supabase');
ok(JSON.parse(base.remAll).map(x => x.phone).join() === '0900000001,0900000002,0900000003,0900000006', 'baseline tat ca CS: ' + JSON.parse(base.remAll).map(x => x.phone));
{ const saved = props.SB_DIRTY_CARE; props.SB_DIRTY_CARE = '["0900000001"]'; g0 = calls();
  ok(J(run('readRemindersToday_("CS1")')) === base.rem1 && calls() === g0, 'co SDT dirty -> doc Sheets, khong goi'); if (saved === undefined) delete props.SB_DIRTY_CARE; else props.SB_DIRTY_CARE = saved; }
props.SB_STALE = 'x'; g0 = calls(); ok(J(run('readRemindersToday_("CS1")')) === base.rem1 && calls() === g0, 'STALE -> doc Sheets'); delete props.SB_STALE;
net.fails = true; ok(J(run('readRemindersToday_("CS1")')) === base.rem1, 'Supabase loi -> doc Sheets, khong nem loi'); net.fails = false;
ok(Object.prototype.toString.call(run('_sbCareTextToCell_("2026-10-09T05:00:00.000Z")')) === '[object Date]', 'ISO Z -> Date');
ok(run('_sbCareTextToCell_("09/10/2026")') === '09/10/2026' && run('_sbCareTextToCell_("")') === '' && run('_sbCareTextToCell_(null)') === '', 'chuoi khac giu nguyen');
// phan trang tuan tu care_data (> 1 trang)
for (let i = 0; i < 1500; i++) { const phone = '0911' + String(100000 + i); tables.care_data.set(phone, { phone, status: '', zalo: '', cs: 'CS9', sched_hen: '2026-01-01T00:00:00.000Z', sched_hen_note: '' }); }
ok(run('_sbGetPagesSeq_("care_data?select=phone,sched_hen&sched_hen=neq.&order=phone.asc")').length === 1500 + 6, 'phan trang tuan tu tai du: ' + run('_sbGetPagesSeq_("care_data?select=phone,sched_hen&sched_hen=neq.&order=phone.asc")').length);

// ===== 6) rollback =====
ok(props.SB_ORD_READ === 'on', 'truoc rollback co dang bat');
ctx.__x = null; let m = run('sbSetMode_("off", false)');
ok(m.ok && !props.SB_ORD_READ && props.SB_MODE === 'off', 'sbSetMode off tat luon doc don hang');
g0 = calls(); ok(J(run('readDTTong_()')) === base.dt && calls() === g0, 'sau rollback doc Sheets');
props.SB_ORD_READ = 'on'; run('sbOrdReadDisable_()'); ok(!props.SB_ORD_READ, 'sbOrdReadDisable_');
ok(!JSON.stringify(run('sbOrdReadStatus_()')).includes('SECRETKEY'), 'status khong lo key');
// cac ham chay tay cho nguoi dung khong-code: khong gach duoi cuoi ten
ok(typeof ctx.sbDonHangBatDoc === 'function' && typeof ctx.sbDonHangTatDoc === 'function', 'co ham chay tay sbDonHangBatDoc / sbDonHangTatDoc');
console.log('ALL ORDER READ TESTS PASSED');
