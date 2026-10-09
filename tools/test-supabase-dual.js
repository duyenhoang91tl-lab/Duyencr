#!/usr/bin/env node
// Test Node (fetch gia + sheet gia) cho BUOC 3 cua docs/SUPABASE-PLAN.md: ghi song song CareData -> Supabase + lookup doc Supabase.
// Chay: node tools/test-supabase-dual.js   -> "ALL DUAL-WRITE TESTS PASSED" neu dat. Khong goi mang that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
const sbSec = src.slice(src.indexOf('var SB_BATCH_ ='));
const NAMES = ['normPhone_', 'careRow_', 'careObjFromRow_', 'mergeExtFields_', 'readExistingExtFields_', 'invalidateLookupCache_', 'saveAllCare_', 'saveSingleCare_',
  'saveBatchCare_', 'syncZaloFriendStatus_', 'applyCustomerNameGuesses_', '_aaSetCareCS_', 'dedupeCare_', 'findCareByPhone_'];
const CARE_HEADERS = ['phone','status','zalo','cs','note','schedules','schedGoi','schedGoiNote','schedSP','schedSPNote','schedCS','schedCSNote','schedHen','schedHenNote','updated','khStatus','nickZalos','birthday','zaloSetBy','name','custom','zaloPhones'];
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };

// ---- sheet gia ----
const sheetRows = [CARE_HEADERS.slice()];
const sheet = {
  getLastRow: () => sheetRows.length, getLastColumn: () => 22,
  getRange(r, c, n, w) { n = n || 1; w = w || 1; return {
    getValues: () => { const o = []; for (let i = 0; i < n; i++) { const row = sheetRows[r - 1 + i] || []; const x = []; for (let j = 0; j < w; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
    setValues: v => { for (let i = 0; i < v.length; i++) { while (sheetRows.length < r + i) sheetRows.push(new Array(22).fill('')); const row = sheetRows[r - 1 + i]; while (row.length < 22) row.push(''); for (let j = 0; j < v[i].length; j++) row[c - 1 + j] = v[i][j]; } },
    setValue: v => { while (sheetRows.length < r) sheetRows.push(new Array(22).fill('')); const row = sheetRows[r - 1]; while (row.length < 22) row.push(''); row[c - 1] = v; },
    getValue: () => { const row = sheetRows[r - 1] || []; return row[c - 1] === undefined ? '' : row[c - 1]; } }; },
  appendRow: row => sheetRows.push(row.slice()), clearContents: () => { sheetRows.length = 0; },
  getDataRange: () => ({ getValues: () => sheetRows.map(x => x.slice()) })
};

// ---- Supabase gia ----
const logs = []; const table = new Map(); const props = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_KEY: 'SECRETKEY' };
const net = { posts: 0, patches: 0, deletes: 0, gets: 0, failWrite: false, failGet: false };
const R = (code, body, h) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => h || {} });
const inList = v => v.replace(/^in\.\(/, '').replace(/\)$/, '').split(',').map(x => x.replace(/"/g, ''));
const ctx = {
  Logger: { log(m) { logs.push(String(m)); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k], getProperties: () => Object.assign({}, props) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ remove() {}, removeAll() {}, get: () => null, put() {} }) },
  SH_CARE: 'CareData', CARE_HEADERS, jsonOut_: o => o, getSheet_: () => sheet, getCrmSS_: () => ({ getSheetByName: () => sheet }),
  UrlFetchApp: { fetch(url, o) {
    ok(o.headers.apikey === 'SECRETKEY', 'thieu key');
    const u = new URL(url); const ph = u.searchParams.get('phone');
    if (o.method === 'POST') { net.posts++; if (net.failWrite) return R(500, 'boom'); const seen = new Set(); for (const r of JSON.parse(o.payload)) { if (seen.has(r.phone)) return R(400, 'ON CONFLICT row twice'); seen.add(r.phone); table.set(r.phone, Object.assign({}, r)); } return R(201, ''); }
    if (o.method === 'PATCH') { net.patches++; if (net.failWrite) return R(500, 'boom'); const f = JSON.parse(o.payload); inList(ph).forEach(p => { if (table.has(p)) Object.assign(table.get(p), f); }); return R(204, ''); }
    if (o.method === 'DELETE') { net.deletes++; if (net.failWrite) return R(500, 'boom'); inList(ph).forEach(p => table.delete(p)); return R(204, ''); }
    net.gets++; if (net.failGet) return R(500, 'boom');
    if (ph && ph.startsWith('eq.')) { const g = table.get(ph.slice(3)); return R(200, JSON.stringify(g ? [g] : [])); }
    if (ph && ph.startsWith('in.(')) return R(200, JSON.stringify(inList(ph).map(p => table.get(p)).filter(Boolean)));
    if (o.headers.Prefer === 'count=exact') return R(206, '[]', { 'Content-Range': '0-0/' + table.size });
    return R(200, '[]'); } }
};
vm.createContext(ctx);
vm.runInContext(NAMES.map(fn).join('\n') + '\n' + sbSec, ctx);
const run = c => vm.runInContext(c, ctx);
const call = (name, ...args) => { ctx.__a = args; return run(name + '(...__a)'); };
const sheetRec = phone => { const row = sheetRows.slice(1).find(r => String(r[0]) === phone); return row ? call('sbCareRowToRec_', row) : null; };
const same = (phone, m) => { const a = sheetRec(phone), b = table.get(phone); ok(a && b, m + ': thieu o ' + (a ? 'Supabase' : 'Sheet') + ' ' + phone);
  const diff = vm.runInContext('SB_CARE_COLS_', ctx).filter(c => String(a[c]) !== String(b[c])); ok(!diff.length, m + ': lech cot ' + diff.join(',') + ' ' + phone); };

// seed 120 dong
for (let i = 0; i < 120; i++) { const r = new Array(22).fill(''); r[0] = '0912' + String(100000 + i); r[3] = 'cs' + (i % 4); r[4] = 'note ' + i; r[14] = '2026-10-0' + (1 + i % 9) + 'T01:00:00.000Z'; r[19] = i % 3 === 0 ? 'N' + i : ''; if (i === 5) r[17] = new Date('1990-05-01T00:00:00Z'); sheetRows.push(r); }

// ===== 3a: che do =====
ok(call('sbMode_') === 'off' && !call('sbWriteOn_'), 'mac dinh phai la off');
let r = call('sbSetMode_', 'bậy'); ok(!r.ok, 'mode sai');
delete props.SUPABASE_KEY; r = call('sbSetMode_', 'write'); ok(!r.ok && r.error.includes('Chua cau hinh'), 'write khi chua cau hinh'); props.SUPABASE_KEY = 'SECRETKEY';
// mode off: ghi KHONG goi mang
call('saveSingleCare_', { phone: '0912100001', status: 'a', cs: 'csA' });
ok(net.posts === 0 && net.patches === 0 && net.gets === 0, 'mode off phai KHONG goi Supabase');
ok(call('sbReadCare_', '0912100001') === undefined, 'off: sbReadCare_ phai undefined');
// seed Supabase bang backfill (dung ham that cua buoc 2)
r = call('sbBackfillCare_', { dryRun: false }); ok(r.ok && r.done && table.size === 120, 'backfill seed ' + JSON.stringify(r));
r = call('sbSetMode_', 'write'); ok(r.ok && r.mode === 'write', 'set write');

// ===== 3b: ghi song song =====
net.posts = 0;
call('saveSingleCare_', { phone: '0912100001', status: 'quan tam', cs: 'csB', note: 'doi note' });   // update
ok(net.posts === 1, 'saveSingle update: 1 POST'); same('0912100001', 'saveSingle update');
call('saveSingleCare_', { phone: '0933000001', status: 'moi', cs: 'csC', nickZalos: ['n1'] });         // them moi
same('0933000001', 'saveSingle moi'); ok(table.get('0933000001').nick_zalos === '["n1"]', 'nick_zalos JSON');
// bao toan truong mo rong: name cu cua dong i=3 khong bi mat o Supabase
call('saveSingleCare_', { phone: '0912100003', note: 'x' }); ok(table.get('0912100003').name === 'N3', 'mergeExtFields_ giu name o Supabase: ' + table.get('0912100003').name);
// saveBatch nho: 1 update + 1 moi + 1 trung SDT trong cung lo (dong sau thang)
call('saveBatchCare_', [{ phone: '0912100010', note: 'b1', cs: 'csZ' }, { phone: '0944000001', note: 'moi1' }, { phone: '0944000001', note: 'moi2' }]);
['0912100010', '0944000001'].forEach(p => same(p, 'saveBatch nho')); ok(table.get('0944000001').note === 'moi2', 'trung trong lo: dong sau thang (giong Sheet)');
// saveBatch lon (>50): chi mirror cac dong cham vao
const big = []; for (let i = 0; i < 60; i++) big.push({ phone: '0912' + String(100020 + i), note: 'big' + i });
net.posts = 0; call('saveBatchCare_', big); big.forEach(x => same(x.phone, 'saveBatch lon')); ok(net.posts === 1, 'saveBatch lon: 1 POST (60 dong < 500)');
// syncZalo: cap nhat + them moi; chay lai khong doi -> khong POST
const zrows = [{ phone: '0912100002', zalo: 'da ket ban', scannedBy: 'csA', nick: 'nickA' }, { phone: '0988111222', zalo: 'cho', scannedBy: 'csA', nick: 'nickA' }];
call('syncZaloFriendStatus_', zrows, false); ['0912100002', '0988111222'].forEach(p => same(p, 'syncZalo')); ok(table.get('0912100002').zalo === 'da ket ban', 'zalo status');
net.posts = 0; call('syncZaloFriendStatus_', zrows, false); ok(net.posts === 0, 'syncZalo khong doi gi thi KHONG mirror');
// applyCustomerNameGuesses_: 1 cap nhat, 1 them moi, 1 da co ten -> bo qua
call('applyCustomerNameGuesses_', [{ phone: '0912100004', name: 'An' }, { phone: '0977000001', name: 'Binh' }, { phone: '0912100003', name: 'KHONG' }]);
['0912100004', '0977000001'].forEach(p => same(p, 'applyNames')); ok(table.get('0912100003').name === 'N3', 'ten da co khong bi ghi de');
// _aaSetCareCS_: dong co -> PATCH theo nhom cs; dong moi -> upsert
net.posts = 0; net.patches = 0;
call('_aaSetCareCS_', { '0912100040': 'csX', '0912100041': 'csX', '0912100042': 'csY', '0966000001': 'csZ' });
ok(net.patches === 2 && net.posts === 1, '_aaSetCareCS_: 2 nhom PATCH + 1 POST moi: ' + net.patches + '/' + net.posts);
['0912100040', '0912100041', '0912100042', '0966000001'].forEach(p => same(p, '_aaSetCareCS_'));
// doi chieu tong the sau chuoi ghi
let c = call('sbCompareCare_', { sample: 300 }); ok(c.ok && c.mismatchCount === 0, 'compare sau dual-write: ' + JSON.stringify(c));

// ===== ham chay tay tu Editor =====
logs.length = 0; table.get('0912100001').note = 'LECH'; run('sbBatDocSupabase()');
ok(call('sbMode_') === 'write' && logs.join('\n').includes('KHONG BAT'), 'sbBatDocSupabase phai TU CHOI khi doi chieu lech'); table.set('0912100001', sheetRec('0912100001'));
logs.length = 0; run('sbBatDocSupabase()'); ok(call('sbMode_') === 'read', 'sbBatDocSupabase bat read khi ok:true: ' + logs.join('|'));
call('sbSetMode_', 'write'); logs.length = 0; run('sbXemTrangThai()'); ok(logs.join('').includes('"mode": "write"'), 'sbXemTrangThai log'); run('sbKiemTraKetNoi()'); ok(logs.join('').includes('"ok": true'), 'sbKiemTraKetNoi log');
run('sbBackfillThu()'); run('sbBackfillThat()'); ok(logs.join('\n').includes('XONG'), 'sbBackfillThat bao XONG'); run('sbDoiChieu()'); run('sbSuaSDTLoi()'); run('sbTatSupabase()'); ok(call('sbMode_') === 'off', 'sbTatSupabase'); call('sbSetMode_', 'write');
// ===== 3c: lookup doc Supabase =====
const sheetLookup = p => { props.SB_MODE = 'off'; const o = JSON.stringify(call('findCareByPhone_', p)); props.SB_MODE = 'read'; return o; };
r = call('sbSetMode_', 'read'); ok(r.ok && r.mode === 'read', 'set read');
net.gets = 0;
['0912100001', '0912100005', '0912100003', '0933000001', '0912100002', '0912100040'].forEach(p => {
  const viaSheets = sheetLookup(p); const g0 = net.gets; const viaSb = JSON.stringify(call('findCareByPhone_', p));
  ok(net.gets === g0 + 1, 'read: phai goi Supabase cho ' + p); ok(viaSb === viaSheets, 'lookup Supabase PHAI giong Sheets ' + p + '\n SB: ' + viaSb + '\n SH: ' + viaSheets); });
net.gets = 0; ok(JSON.stringify(call('findCareByPhone_', '0999999999')) === 'null' && net.gets === 1, 'khong co o ca 2 noi -> null (da thu Supabase roi Sheets)');
// Supabase miss nhung Sheets co (dong sua tay) -> fallback doc Sheets
sheetRows.push(Object.assign(new Array(22).fill(''), { 0: '0955123456', 4: 'sua tay' })); ok(call('findCareByPhone_', '0955123456').note === 'sua tay', 'miss -> fallback Sheets');
// Supabase loi -> fallback Sheets, khong nem loi
net.failGet = true; ok(call('findCareByPhone_', '0912100001').cs === 'csB', 'Supabase loi -> doc Sheets'); net.failGet = false;

// ===== loi mirror: dirty + resync =====
net.failWrite = true;
r = call('saveSingleCare_', { phone: '0912100050', note: 'MIRROR LOI', cs: 'csQ' });
ok(r.ok === true, 'mirror loi KHONG duoc lam hong thao tac luu'); ok(sheetRec('0912100050').note === 'MIRROR LOI', 'Sheets van duoc ghi');
ok(call('sbDirtyList_').indexOf('0912100050') !== -1, 'SDT phai vao danh sach dirty'); ok(table.get('0912100050').note !== 'MIRROR LOI', 'Supabase chua co ban moi');
net.failWrite = false; net.gets = 0;
ok(call('findCareByPhone_', '0912100050').note === 'MIRROR LOI' && net.gets === 0, 'SDT dirty: doc Sheets, KHONG goi Supabase (tranh tra du lieu cu)');
table.set('0955000009', { phone: '0955000009', note: 'ma' }); call('sbMarkDirty_', ['0955000009'], 'test');   // dong co o Supabase nhung khong con o Sheets
r = call('sbResyncCare_'); ok(r.ok && r.resynced === 1 && r.removed === 1, 'resync: ' + JSON.stringify(r));
same('0912100050', 'sau resync'); ok(!table.has('0955000009'), 'resync xoa dong khong con tren Sheets'); ok(call('sbDirtyList_').length === 0, 'dirty duoc xoa');
ok(call('sbStatus_').dirtyCount === 0, 'sbStatus');

// ===== STALE =====
r = call('sbMirrorCare_', Array.from({ length: 2001 }, (_, i) => ({ phone: '0900' + String(100000 + i) })), 'qua nhieu');
ok(r === false && call('sbStaleInfo_') && !table.has('0900100000'), 'mirror > 2000 dong -> STALE, khong ghi');
net.gets = 0; ok(call('findCareByPhone_', '0912100001').cs === 'csB' && net.gets === 0, 'STALE: lookup doc Sheets, khong goi Supabase');
r = call('sbSetMode_', 'read'); ok(!r.ok && r.error.includes('STALE'), 'khong cho bat read khi dang STALE');
r = call('sbSetMode_', 'read', true); ok(r.ok && !call('sbStaleInfo_'), 'clearStale');
call('sbMarkDirty_', Array.from({ length: 301 }, (_, i) => '0901' + String(100000 + i)), 'nhieu'); ok(call('sbStaleInfo_'), 'dirty > 300 -> STALE'); call('sbSetMode_', 'read', true);
call('dedupeCare_'); ok(call('sbStaleInfo_').includes('dedupeCare_'), 'dedupeCare_ -> STALE'); call('sbSetMode_', 'read', true);
call('saveAllCare_', [{ phone: '0912100001', note: 'all' }]); ok(call('sbStaleInfo_').includes('saveAllCare_'), 'saveAllCare_ -> STALE');
// mode off: dedupe/saveAll KHONG dat STALE
call('sbSetMode_', 'off'); props.SB_STALE = undefined; delete props.SB_STALE; call('dedupeCare_'); ok(!call('sbStaleInfo_'), 'off: khong STALE');
// sbReadSheetRows_: nhieu doan roi rac -> doc 1 doan bao
sheetRows.length = 1; for (let i = 0; i < 300; i++) { const x = new Array(22).fill(''); x[0] = '0912' + String(200000 + i); sheetRows.push(x); }
const scattered = []; for (let i = 0; i < 60; i++) scattered.push(2 + i * 4);
let got = call('sbReadSheetRows_', sheet, scattered); ok(got.length === 60 && got[7][0] === '0912' + String(200000 + 28 - 0), 'doc dong roi rac: ' + (got && got[7] && got[7][0]));
console.log('ALL DUAL-WRITE TESTS PASSED');
