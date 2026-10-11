#!/usr/bin/env node
// Test Node (fetch gia, sheet gia) cho BUOC B cua docs/MIGRATE-SUPABASE-FULL.md: sbSyncCare_ (dong bo dinh ky CareData Sheet -> care_data).
// Chay: node tools/test-supabase-care-sync.js -> in "ALL CARE SYNC TESTS PASSED". Khong goi mang that, khong can key that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) {
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i);
  for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
const hdrStart = src.indexOf('var CARE_HEADERS'), hdr = src.slice(hdrStart, src.indexOf('];', hdrStart) + 2);
const code = ["var SH_CARE = 'CareData';", hdr, fnSrc('normPhone_'), src.slice(src.indexOf('var SB_BATCH_ ='))].join('\n');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const W = 22, CS = 3;

const rows = [new Array(W).fill('h')];          // dong 1 = header
for (let i = 0; i < 450; i++) { const r = new Array(W).fill(''); r[0] = '0912' + String(300000 + i); r[1] = 'st'; r[CS] = 'CS' + (i % 4); r[14] = '2026-10-0' + (1 + i % 9) + ' 08:00'; rows.push(r); }
rows[11][0] = Number('912300010');                // SDT number thieu so 0 -> van phai ra '0912300010'
rows[20] = new Array(W).fill(''); rows[20][3] = 'khong co sdt';   // khong SDT -> bo
rows[300][0] = rows[5][0];                         // trung SDT o khoi sau -> bo, giu dong dau
const DISTINCT = 450 - 1 - 1;                      // tru 1 khong SDT, 1 trung

const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY' };
const R = (c, b) => ({ getResponseCode: () => c, getContentText: () => b, getAllHeaders: () => ({}) });
const table = new Map(); let posts = 0, deletes = 0, failPost = 0, lockBusy = false;
const ctx = {
  Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k] }) },
  LockService: { getScriptLock: () => ({ tryLock: () => !lockBusy, releaseLock() {} }) },
  ScriptApp: (() => { const tr = []; return { getProjectTriggers: () => tr.slice(), deleteTrigger: x => tr.splice(tr.indexOf(x), 1),
    newTrigger: fn => ({ timeBased: () => ({ everyMinutes: m => ({ create: () => tr.push({ getHandlerFunction: () => fn, minutes: m }) }) }) }) }; })(),
  getSheet_: () => ({ getLastRow: () => rows.length,
    getRange: (r, c, n, w) => ({ getValues: () => rows.slice(r - 1, r - 1 + n).map(x => { const y = x.slice(c - 1, c - 1 + w); while (y.length < w) y.push(''); return y; }) }) }),
  UrlFetchApp: { fetch(url, o) {
    if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
    if (o.method === 'DELETE') { deletes++; return R(204, ''); }
    if (o.method === 'POST') {
      posts++; if (failPost && posts === failPost) return R(500, 'boom');
      const a = JSON.parse(o.payload), seen = new Set();
      for (const r of a) { if (seen.has(r.phone)) return R(400, 'ON CONFLICT row twice'); seen.add(r.phone); }
      for (const r of a) table.set(r.phone, r);
      return R(201, '');
    }
    return R(200, '[]'); } }
};
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = c => vm.runInContext(c, ctx);

// 1) Lan dau: day het 3 khoi (450 dong / 200), dung so SDT, bo dong khong SDT + trung
let r = run('sbSyncCare_()');
ok(r.ok && r.complete && r.blocks === 3 && r.changedBlocks === 3 && r.pushedRows === DISTINCT, 'lan dau: ' + JSON.stringify(r));
ok(r.skippedNoPhone === 1 && r.dupSkipped === 1, 'bo dong khong SDT + SDT trung: ' + JSON.stringify(r));
ok(table.size === DISTINCT && table.has('0912300010') && !table.has('912300010'), 'SDT number thieu so 0 duoc chuan hoa');
ok(table.get(rows[5][0]).cs === 'CS0', 'SDT trung: giu dong DAU (khong bi dong sau ghi de)');
ok(props.SB_CARE_DIGESTS.split(',').length === 3 && JSON.parse(props.SB_CARE_SYNC_STATE).blocks === 3, 'luu dau van tay + trang thai');

// 2) Khong doi gi -> khong gui gi
posts = 0; r = run('sbSyncCare_()');
ok(r.ok && r.complete && r.changedBlocks === 0 && posts === 0, 'khong doi: khong POST: ' + JSON.stringify(r));

// 3) Sua TAY 1 o trong khoi 2 (khong doi cot `updated`) -> chi 1 khoi duoc day, updated_at moi
const phone = rows[250][0], before = table.get(phone).updated_at;
rows[250][CS] = 'CS-SUA-TAY'; posts = 0;
r = run('sbSyncCare_()');
ok(r.changedBlocks === 1 && posts === 1 && table.get(phone).cs === 'CS-SUA-TAY', 'sua tay -> 1 khoi: ' + JSON.stringify(r));
ok(table.get(phone).updated_at > before, 'updated_at = luc dong bo (client delta thay duoc): ' + before + ' -> ' + table.get(phone).updated_at);

// 4) Khong bao gio DELETE; xoa dong tren Sheet khong lam mat dong Supabase
rows[100] = new Array(W).fill(''); const gone = rows[99][0];
r = run('sbSyncCare_()');
ok(deletes === 0 && r.ok, 'khong DELETE');
rows[99] = new Array(W).fill(''); run('sbSyncCare_()'); ok(deletes === 0 && table.has(gone), 'xoa dong tren Sheet KHONG xoa tren Supabase');

// 5) Loi POST giua chung: lan sau thu lai dung khoi loi, khoi truoc giu
rows[10][CS] = 'A'; rows[250][CS] = 'B'; rows[430][CS] = 'C';    // ca 3 khoi doi
posts = 0; failPost = 2;
r = run('sbSyncCare_()');
ok(!r.ok && /500|boom/.test(r.error) && table.get(rows[10][0]).cs === 'A', 'loi o khoi 2: ' + JSON.stringify(r));
ok(JSON.parse(props.SB_CARE_SYNC_STATE).err, 'ghi loi vao trang thai');
failPost = 0; posts = 0;
r = run('sbSyncCare_()');
ok(r.ok && r.complete && r.changedBlocks === 2 && table.get(rows[250][0]).cs === 'B' && table.get(rows[430][0]).cs === 'C', 'chay lai: thu lai khoi loi + khoi sau: ' + JSON.stringify(r));

// 6) Khoa ban (CRM dang ghi): bo khoi, khong complete, lan sau van day du
rows[10][CS] = 'D'; lockBusy = true; posts = 0;
r = run('sbSyncCare_()');
ok(r.ok && !r.complete && r.lockBusy >= 1 && posts === 0 && table.get(rows[10][0]).cs === 'A', 'khoa ban: ' + JSON.stringify(r));
lockBusy = false; r = run('sbSyncCare_()');
ok(r.complete && table.get(rows[10][0]).cs === 'D', 'het ban -> day bu: ' + JSON.stringify(r));

// 7) fresh:true day lai moi khoi; chua cau hinh -> bao loi gon
posts = 0; r = run('sbSyncCare_({ fresh: true })'); ok(r.changedBlocks === 3 && posts === 3, 'fresh day lai 3 khoi');
const keep = props.SUPABASE_KEY; delete props.SUPABASE_KEY;
r = run('sbSyncCare_()'); ok(!r.ok && /cau hinh/i.test(r.error), 'thieu key -> loi gon'); props.SUPABASE_KEY = keep;

// 8) Trigger idempotent + trang thai
ok(/Da tao/.test(run('installSbCareTrigger_()')) && /da ton tai/.test(run('installSbCareTrigger_()')), 'cai trigger 2 lan khong nhan doi');
ok(run('sbCareSyncStatus_()').triggerOn === true && run('sbCareSyncStatus_()').blocks === 3, 'status');
ok(/Da go 1/.test(run('removeSbCareTrigger_()')) && run('sbCareSyncStatus_()').triggerOn === false, 'go trigger');
console.log('ALL CARE SYNC TESTS PASSED');
