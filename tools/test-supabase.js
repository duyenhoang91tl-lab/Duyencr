#!/usr/bin/env node
// Test Node (fetch gia) cho phan SUPABASE cuoi gas_v13.js (buoc 2 cua docs/SUPABASE-PLAN.md).
// Chay: node tools/test-supabase.js   -> in "ALL TESTS PASSED" neu dat. Khong goi mang that, khong can key that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const sec = src.slice(src.indexOf('var SB_BATCH_ ='));
const np = src.slice(src.indexOf('function normPhone_(p)'), src.indexOf('// SDT di dong Viet Nam HOP LE'));
const CARE_HEADERS = ['phone','status','zalo','cs','note','schedules','schedGoi','schedGoiNote','schedSP','schedSPNote','schedCS','schedCSNote','schedHen','schedHenNote','updated','khStatus','nickZalos','birthday','zaloSetBy','name','custom','zaloPhones'];
const blank = () => new Array(22).fill('');
const mk = (phone, o) => { const r = blank(); r[0] = phone; Object.keys(o || {}).forEach(k => r[CARE_HEADERS.indexOf(k)] = o[k]); return r; };

// Sheet gia: header + 1200 dong (1/7 SDT la kieu number thieu so 0) + 2 SDT trung (1 trong lo, 1 xuyen lo) + 2 dong rong
const rows = [CARE_HEADERS.slice()];
for (let i = 0; i < 1200; i++) {
  const r = mk(i % 7 === 0 ? Number('912' + String(100000 + i)) : '0912' + String(100000 + i),
    { cs: 'cs' + (i % 5), note: 'note ' + i, updated: '2026-10-0' + (1 + i % 9) + 'T01:00:00.000Z', nickZalos: i % 2 ? '["a"]' : '' });
  if (i === 5) r[17] = new Date('1990-05-01T00:00:00Z');
  rows.push(r);
}
rows.splice(1201, 0, mk('0988000001', { status: 'first' }), mk('0988000001', { status: 'second' }));   // trung trong cung lo
rows.push(mk('0912100003', { status: 'dup-xuyen-lo' }));                                                // trung xuyen lo (dong dau o lo 1)
rows.push(blank(), blank());

const table = new Map(); let posts = 0, fail = false, failPostNo = 0, postNo = 0;
const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY' };
const R = (code, body, h) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => h || {} });
const ctx = {
  Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k] }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ create() {} }) }) }) },
  SH_CARE: 'CareData', CARE_HEADERS,
  getSheet_: () => ({ getLastRow: () => rows.length, getRange: (r, c, n, w) => ({ getValues: () => rows.slice(r - 1, r - 1 + n).map(x => x.slice(c - 1, c - 1 + w)) }) }),
  UrlFetchApp: { fetch(url, o) {
    if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
    const u = new URL(url);
    if (fail) return R(500, 'boom');
    if (o.method === 'POST') {
      postNo++; if (failPostNo && postNo === failPostNo) return R(500, 'boom o lo ' + postNo);
      posts++; const a = JSON.parse(o.payload), seen = new Set();
      for (const r of a) { if (seen.has(r.phone)) return R(400, 'ON CONFLICT row twice'); seen.add(r.phone); table.set(r.phone, r); }
      return R(201, '');
    }
    const sel = u.searchParams.get('phone');
    if (sel) { const list = sel.slice(4, -1).split(',').map(s => s.replace(/"/g, '')); return R(200, JSON.stringify(list.map(p => table.get(p)).filter(Boolean))); }
    if (o.headers.Prefer === 'count=exact') return R(206, '[]', { 'Content-Range': '0-0/' + table.size });
    return R(200, '[]'); } }
};
vm.createContext(ctx); vm.runInContext(np + sec, ctx);
const run = c => vm.runInContext(c, ctx);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };

// --- 2c: backfill ---
let r = run('sbBackfillCare_({})');
ok(r.ok && r.dryRun && r.done && r.batches === 3, 'dryRun mac dinh: ' + JSON.stringify(r));
ok(posts === 0 && !props.SB_CARE_CURSOR, 'dryRun KHONG duoc ghi / dich con tro');
ok(r.pushed === 1201 && r.dupSkipped === 2 && r.skippedNoPhone === 2, 'dem dryRun: ' + JSON.stringify(r));
r = run('sbBackfillCare_({dryRun:false})');
ok(r.ok && r.done && !r.dryRun && table.size === 1201, 'ghi that: size ' + table.size + ' ' + JSON.stringify(r));
ok(table.get('0988000001').status === 'first', 'trung trong lo: dong DAU thang');
ok(table.get('0912100003').status === '' && table.get('0912100003').note === 'note 3', 'trung xuyen lo: dong DAU thang (khong bi dong sau ghi de)');
ok(table.has('0912100000'), 'SDT number thieu so 0 phai duoc chuan hoa');
ok(table.get('0912100005').birthday === '1990-05-01T00:00:00.000Z', 'Date -> ISO');
ok(table.get('0912100002').nick_zalos === '[]' && table.get('0912100002').zalo_phones === '[]', 'mac dinh []');
ok(props.SB_CARE_CURSOR === '1207', 'con tro sau khi xong = lastRow+1: ' + props.SB_CARE_CURSOR);
// resume theo thoi gian: ngan sach am -> khong lo nao chay, con tro giu nguyen; sau do chay du
run('SB_TIME_BUDGET_MS_=-1'); delete props.SB_CARE_CURSOR; table.clear(); posts = 0;
let a = run('sbBackfillCare_({dryRun:false})');
ok(!a.done && a.batches === 1 && a.nextRow === 502, 'het ngan sach van chay dung 1 lo (bao dam tien trien): ' + JSON.stringify(a));
run('SB_TIME_BUDGET_MS_=1'); // moi lan chi kip 1 lo -> kiem tra resume nhieu lan goi
let calls = 0; do { a = run('sbBackfillCare_({dryRun:false})'); calls++; ok(calls < 10, 'resume lap vo han'); } while (!a.done);
ok(calls >= 2 && table.size === 1201, 'resume qua nhieu lan goi: ' + calls + ' lan, size ' + table.size);
run('SB_TIME_BUDGET_MS_=240000');
// loi HTTP o lo thu 2: con tro dung o dau lo loi (khong mat du lieu), khong lo key; goi lai thi chay tiep
delete props.SB_CARE_CURSOR; table.clear(); postNo = 0; failPostNo = 2;
r = run('sbBackfillCare_({dryRun:false})');
ok(!r.ok && !JSON.stringify(r).includes('SECRETKEY') && r.error.includes('HTTP 500'), 'loi HTTP: ' + JSON.stringify(r));
ok(props.SB_CARE_CURSOR === '502', 'con tro dung dau lo loi: ' + props.SB_CARE_CURSOR);
failPostNo = 0; r = run('sbBackfillCare_({dryRun:false})');
ok(r.ok && r.done && table.size === 1201, 'chay tiep sau loi: ' + JSON.stringify(r));
r = run('sbBackfillCare_({dryRun:false,reset:true})');
ok(r.ok && r.done && r.batches === 3, 'reset ve dong 2');
r = run("sbBackfillCare_({dryRun:'false'})"); ok(!r.dryRun, "dryRun chuoi 'false' = ghi that");
// chua cau hinh
const k = props.SUPABASE_KEY; delete props.SUPABASE_KEY;
r = run('sbBackfillCare_({})'); ok(!r.ok && r.error.includes('Chua cau hinh'), 'chua cau hinh');
props.SUPABASE_KEY = k;

// --- 2d: compare (chi chay khi da co ham) ---
if (run("typeof sbCompareCare_") === 'function') {
  let c = run('sbCompareCare_({sample:200})');
  ok(c.ok && c.sheetDistinctPhones === 1201 && c.supabaseRows === 1201 && c.mismatchCount === 0, 'compare khop: ' + JSON.stringify(c));
  table.get('0912100008').note = 'SAI';   // chi so 8 nam trong mau (buoc nhay 4 khi sample=300)
  c = run('sbCompareCare_({sample:300})'); ok(!c.ok && c.mismatchCount >= 1 && c.mismatches[0].cols.includes('note'), 'phat hien lech truong');
  table.get('0912100008').note = 'note 8';
  table.delete('0912100020'); c = run('sbCompareCare_({sample:300})'); ok(!c.ok && c.supabaseRows === 1200, 'phat hien lech so dong');
  fail = true; c = run('sbCompareCare_({})'); ok(!c.ok && !JSON.stringify(c).includes('SECRETKEY'), 'compare loi HTTP'); fail = false;
  table.clear(); c = run('sbCompareCare_({sample:50})'); ok(!c.ok && c.supabaseRows === 0 && c.mismatchCount === 50, 'bang Supabase rong: bao thieu, khong ok');
  console.log('compare section: da chay');
}
console.log('ALL TESTS PASSED');
