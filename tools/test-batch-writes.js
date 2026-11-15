#!/usr/bin/env node
// Test (2026-11-15) toi uu so lan goi Sheet: syncZaloFriendStatus_ (doc 3 cot 1 lan + ghi gom dong lien nhau), markNotifRead_ (RangeList),
// _autoDedupExactRowsInSheet_ (deleteRows theo cum). So sanh KET QUA voi ban cu (git HEAD~ / tep goc luu trong test) tren nhieu kich ban,
// va dem so lan goi Sheet phai it hon.   Chay: node tools/test-batch-writes.js [duong-dan-gas-cu.js]
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..');
const NEW = fs.readFileSync(path.join(root, 'gas_v13.js'), 'utf8');
let OLD = null;
const oldArg = process.argv[2];
if (oldArg) OLD = fs.readFileSync(oldArg, 'utf8');
else { try { OLD = cp.execSync('git show 6dcfa0d:gas_v13.js', { cwd: root, maxBuffer: 1 << 28 }).toString(); } catch (e) { OLD = null; } }
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
function mkSheet(rows, name) {
  const st = { calls: 0, rows: rows.map(r => r.slice()), name };
  const cnt = () => { st.calls++; };
  const sh = {
    getName: () => name, getMaxColumns: () => 30,
    getLastRow: () => st.rows.length, getLastColumn: () => (st.rows[0] || []).length,
    appendRow: r => { st.rows.push(r.slice()); },
    getDataRange: () => ({ getValues: () => { cnt(); return st.rows.map(r => r.slice()); } }),
    deleteRow: r => { cnt(); st.rows.splice(r - 1, 1); },
    deleteRows: (r, n) => { cnt(); st.rows.splice(r - 1, n); },
    getRangeList: a1 => ({ setValue: v => { cnt(); a1.forEach(a => { const m = /^([A-Z])(\d+)$/.exec(a); st.rows[+m[2] - 1][m[1].charCodeAt(0) - 65] = v; }); } }),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => { cnt(); const o = []; for (let i = 0; i < nr; i++) { const row = st.rows[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
      getValue: () => { cnt(); const v = (st.rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; },
      setValues: v => { cnt(); for (let i = 0; i < nr; i++) { st.rows[r - 1 + i] = st.rows[r - 1 + i] || []; for (let j = 0; j < nc; j++) st.rows[r - 1 + i][c - 1 + j] = v[i][j]; } },
      setValue: v => { cnt(); st.rows[r - 1] = st.rows[r - 1] || []; st.rows[r - 1][c - 1] = v; },
    }),
  }; st.sh = sh; return st;
}
function boot(src, sheetsInit) {
  const sheets = {};
  const ctx = { console, Date, JSON, Math, parseInt, isNaN, String, Object, Array,
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
    Utilities: {}, SpreadsheetApp: {}, CacheService: { getScriptCache: () => ({ remove() {} }) }, PropertiesService: {}, Logger: { log() {} } };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  ctx.jsonOut_ = o => o; ctx.invalidateLookupCache_ = () => {}; ctx.sbMirrorSheetRows_ = () => {};
  for (const k in sheetsInit) sheets[k] = mkSheet(sheetsInit[k], k);
  ctx.getSheet_ = (n) => sheets[n].sh;
  ctx.getCrmSS_ = () => ({ getSheetByName: n => (sheets[n] ? sheets[n].sh : null) });
  return { ctx, sheets };
}
const run = (E, code) => vm.runInContext(code, E.ctx);
function careGrid(E) {
  const H = run(E, 'CARE_HEADERS'); const mk = (ph, z, nz, sb) => { const r = H.map(() => ''); r[0] = ph; r[2] = z; r[16] = nz; r[18] = sb; return r; };
  return { H, mk };
}
function scenario(src, name, rowsIn, dry) {
  const probe = boot(src, {}); const { H, mk } = careGrid(probe);
  const grid = [H.slice()];
  for (let i = 0; i < 40; i++) grid.push(mk('09' + String(10000000 + i), i % 3 ? 'friend' : '', i % 4 ? '["a"]' : '', i % 5 ? JSON.stringify({ cs: 'X', nick: 'a', at: 't' }) : ''));
  const E = boot(src, { [probe.ctx.SH_CARE]: grid });
  E.ctx.__rows = rowsIn; E.ctx.__dry = dry;
  const res = run(E, 'syncZaloFriendStatus_(__rows, __dry)');
  const st = E.sheets[probe.ctx.SH_CARE];
  // 'updated' (col O) la ISO now -> chuan hoa
  const norm = st.rows.map(r => r.map((v, j) => (j === 14 && v ? 'NOW' : (typeof v === 'string' ? v.replace(/"at":"[^"]*"/, '"at":"T"') : v))));
  return { res, norm, calls: st.calls };
}
const R = (n, o) => Object.assign({ phone: '09' + String(10000000 + n), zalo: 'friend', nick: '', scannedBy: 'CS1' }, o || {});
const cases = {
  'doi zalo + nick moi nhieu dong lien nhau': Array.from({ length: 20 }, (_, i) => R(i, { zalo: i % 2 ? 'friend' : 'not', nick: 'n' + (i % 3) })),
  'khong doi gi (khong ghi)': [R(1, { zalo: 'friend', nick: 'a' }), R(3, { zalo: 'friend', nick: 'a' })],
  'dong cach quang': [R(2, { zalo: 'x' }), R(9, { zalo: 'y' }), R(30, { zalo: 'z', nick: 'q' })],
  'trung SDT trong 1 lan gui': [R(5, { zalo: 'a', nick: 'm' }), R(5, { zalo: 'b', nick: 'n' }), R(5, { zalo: 'b', nick: 'n' })],
  'SDT moi (them dong) + cu': [R(1, { zalo: 'k' }), { phone: '0999000111', zalo: 'friend', nick: 'new', scannedBy: 'CS9' }, { phone: '0999000111', zalo: 'friend', nick: 'new2', scannedBy: 'CS9' }],
  'bo SDT rong': [{ phone: '', zalo: 'x' }, R(4, { zalo: 'q' })],
};
for (const [name, rows] of Object.entries(cases)) {
  const n = scenario(NEW, name, JSON.parse(JSON.stringify(rows)), false);
  if (OLD) {
    const o = scenario(OLD, name, JSON.parse(JSON.stringify(rows)), false);
    ok(JSON.stringify(n.norm) === JSON.stringify(o.norm) && JSON.stringify(n.res) === JSON.stringify(o.res), 'zalo sync [' + name + ']: ket qua y het ban cu');
    ok(n.calls <= o.calls + 3, 'zalo sync [' + name + ']: so lan goi Sheet ' + n.calls + ' <= cu ' + o.calls + ' (+3 cho yeu cau rat nho)');
    if (name.startsWith('doi zalo')) ok(n.calls * 3 < o.calls, 'zalo sync: 20 dong giam > 3 lan (' + o.calls + ' -> ' + n.calls + ')');
  } else ok(n.res.ok === true, 'zalo sync [' + name + ']: chay duoc (khong co ban cu de so)');
}
// dry-run xung dot
{
  const rows = [R(1, { zalo: 'other', scannedBy: 'AAA' }), R(2, { zalo: 'other', scannedBy: 'AAA' }), R(3, { zalo: 'friend', scannedBy: 'AAA' })];
  const n = scenario(NEW, 'dry', JSON.parse(JSON.stringify(rows)), true);
  ok(n.res.ok && n.res.dryRun && Array.isArray(n.res.conflicts), 'dry-run tra conflicts');
  if (OLD) { const o = scenario(OLD, 'dry', JSON.parse(JSON.stringify(rows)), true); ok(JSON.stringify(n.res) === JSON.stringify(o.res), 'dry-run: conflicts y het ban cu (' + n.res.conflicts.length + ')'); ok(n.calls <= o.calls, 'dry-run: so lan goi ' + n.calls + ' <= ' + o.calls); ok(n.calls === 3, 'dry-run: chi 3 lan doc cot (A, C, S)'); }
}
// markNotifRead_
function notif(src, ids, all) {
  const H = ['id', 'user', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'readAt'];
  const rows = [H]; for (let i = 0; i < 30; i++) rows.push(['n' + i, i % 3 ? 'duyen' : 'ha', '', '', '', '', '', '', '', i % 7 === 0 ? 'x' : '']);
  const E = boot(src, { [boot(src, {}).ctx.SH_NOTIF]: rows });
  E.ctx.__a = ['Duyen', ids, all];
  const r = run(E, 'markNotifRead_(...__a)'); const st = E.sheets[Object.keys(E.sheets)[0]];
  return { r, rows: st.rows.map(x => x.map((v, j) => (j === 9 && v && v !== 'x' ? 'NOW' : v))), calls: st.calls };
}
for (const [ids, all] of [[['n1', 'n2', 'n4'], false], [[], true], [['zzz'], false]]) {
  const n = notif(NEW, ids, all);
  if (OLD) { const o = notif(OLD, ids, all); ok(JSON.stringify(n.r) === JSON.stringify(o.r) && JSON.stringify(n.rows) === JSON.stringify(o.rows), 'notif ' + (all ? 'tat ca' : ids.join()) + ': y het ban cu (marked ' + n.r.marked + ')'); ok(n.calls <= o.calls, 'notif so lan goi ' + n.calls + ' <= ' + o.calls); }
  else ok(n.r.ok, 'notif chay duoc');
}
// dedup
function dedup(src) {
  const rows = [['h1', 'h2']]; const pat = [1, 1, 1, 2, 3, 3, 4, 5, 5, 5, 5, 6, 1, 7];
  pat.forEach(v => rows.push(['k' + v, 'v' + v])); rows.push(['', '']); rows.push(['k9', 'v9']);
  const E = boot(src, { S: rows });
  const r = run(E, "_autoDedupExactRowsInSheet_(getSheet_('S'), 2)"); return { r, rows: E.sheets.S.rows, calls: E.sheets.S.calls };
}
{
  const n = dedup(NEW);
  if (OLD) { const o = dedup(OLD); ok(JSON.stringify(n.r) === JSON.stringify(o.r) && JSON.stringify(n.rows) === JSON.stringify(o.rows), 'dedup: ket qua y het ban cu (xoa ' + n.r.deleted + ')'); ok(n.calls < o.calls, 'dedup: goi Sheet ' + o.calls + ' -> ' + n.calls); }
  else ok(n.r.deleted > 0, 'dedup chay duoc');
}
console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);
