#!/usr/bin/env node
// Test Node cho DONG BO XOA CareData (sbPruneCare_): dong da xoa khoi Sheet -> xoa khoi Supabase, nhieu lop an toan. Sheet/Drive/fetch GIA.
// Chay: node tools/test-supabase-prune.js -> "ALL PRUNE TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };

function makeEnv(nSheet, nExtra, opt) {
  opt = opt || {};
  const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY' };
  const env = { props, events: [], dels: [], fail: null, folders: new Map(), files: new Map(), cache: [] };
  const old = new Date(Date.now() - 5 * 3600000).toISOString();
  env.sheetPhones = []; env.db = [];
  for (let i = 0; i < nSheet; i++) { const p = '09' + String(10000000 + i); env.sheetPhones.push(p); env.db.push({ phone: p, cs: 'cs' + i, updated_at: old }); }
  for (let i = 0; i < nExtra; i++) env.db.push({ phone: '08' + String(10000000 + i), cs: 'x' + i, updated_at: old });
  env.db.sort((a, b) => a.phone < b.phone ? -1 : 1);
  env.sheet = { getLastRow: () => env.sheetPhones.length + 1, getRange: (r, c, n) => ({ getValues: () => { env.events.push('sheet'); const o = []; for (let i = 0; i < n; i++) o.push([env.sheetPhones[r - 2 + i]]); return o; } }) };
  const blob = (buf, name) => ({ buf: Buffer.from(buf), _n: name, getBytes() { return this.buf; }, getDataAsString() { return this.buf.toString('utf8'); }, getName() { return this._n; } });
  let id = 0;
  const mkFolder = name => { const f = { id: 'F' + (++id), name, files: [], getId() { return this.id; },
    createFile(b) { if (env.corrupt) b = blob('corrupt', b._n); const file = { id: 'f' + (++id), blob: b, trashed: false, getId() { return this.id; }, getName() { return this.blob._n; }, getBlob() { return this.blob; }, setTrashed(v) { this.trashed = !!v; } }; this.files.push(file); return file; },
    getFiles() { const l = this.files.filter(x => !x.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; } }; env.folders.set(f.id, f); return f; };
  const R = (code, body, h) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => h || {} });
  const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, encodeURIComponent, decodeURIComponent, Buffer,
    Logger: { log: m => (env.logs = env.logs || []).push(String(m)) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove: k => env.cache.push(k), removeAll: a => env.cache.push(...a) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
    ScriptApp: { getProjectTriggers: () => [] },
    Utilities: { newBlob: (d, m, n) => blob(typeof d === 'string' ? Buffer.from(d, 'utf8') : d, n), gzip: (b, n) => blob(zlib.gzipSync(b.buf), n), ungzip: b => blob(zlib.gunzipSync(b.buf), '') },
    DriveApp: { getFolderById: i => { const f = env.folders.get(i); if (!f) throw new Error('nf'); return f; },
      getFoldersByName: n => { const l = [...env.folders.values()].filter(f => f.name === n); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }, createFolder: n => mkFolder(n) },
    UrlFetchApp: { fetch(url, o) {
      if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
      if (env.fail === 'all') return R(500, 'boom');
      const u = new URL(url), q = u.searchParams;
      if (o.method === 'DELETE') { if (env.fail === 'delete') return R(500, 'boom'); const list = decodeURIComponent(q.get('phone')).slice(4, -1).split(','); env.dels.push(list); env.db = env.db.filter(r => !list.includes(r.phone)); return R(204, ''); }
      const sel = q.get('select');
      if (sel === 'phone,updated_at') { env.events.push('sb-keys'); const off = parseInt(q.get('offset'), 10), lim = parseInt(q.get('limit'), 10); return R(200, JSON.stringify(env.db.slice(off, off + lim).map(r => ({ phone: r.phone, updated_at: r.updated_at })))); }
      if (sel === '*') { const list = q.get('phone').slice(4, -1).split(','); return R(200, JSON.stringify(env.db.filter(r => list.includes(r.phone)))); }
      return R(200, '[]'); } } };
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
  ctx.getSheet_ = () => env.sheet;
  if (opt.backup !== false) props.SB_BACKUP_STATE = JSON.stringify({ lastOkAt: Date.now() - 2 * 3600000, last: {} });
  env.run = c => vm.runInContext(c, ctx); env.ctx = ctx;
  env.folder = () => [...env.folders.values()][0];
  return env;
}

// 1. chay thu mac dinh: tim dong thua, KHONG xoa/khong tao file
let e = makeEnv(200, 5);
let r = e.run('sbPruneCare_()');
ok(r.ok && r.dryRun && r.extra === 5 && r.supabaseRows === 205 && r.sheetPhones === 200 && r.sample.length === 5 && r.sample.every(p => p.startsWith('08')) && !r.refused, 'dry-run: ' + JSON.stringify(r));
ok(e.dels.length === 0 && e.folders.size === 0 && e.db.length === 205 && r.backupOk === true && /Chay thu/.test(r.hint), 'dry-run khong xoa, khong dung Drive');
ok(e.run('sbPruneCare_({dryRun:"true"})').dryRun === true, 'dryRun dang chuoi "true" van la chay thu');
// 2. doc Supabase TRUOC roi moi doc Sheet (chong dong vua them bi coi la thua)
ok(e.events.indexOf('sb-keys') < e.events.indexOf('sheet'), 'thu tu: Supabase truoc, Sheet sau: ' + e.events.slice(0, 3));
// 3. xoa that
r = e.run('sbPruneCare_({dryRun:false})');
ok(r.ok && !r.dryRun && r.deleted === 5 && r.backupRows === 5 && /^pruned_care_data_/.test(r.backupFile) && e.db.length === 200 && e.db.every(x => x.phone.startsWith('09')), 'xoa that: ' + JSON.stringify(r));
const pf = e.folder().files.find(f => f.getName() === r.backupFile), pj = JSON.parse(zlib.gunzipSync(pf.blob.buf).toString('utf8'));
ok(pj.pruned && pj.count === 5 && pj.rows.length === 5 && pj.rows[0].cs && pj.rows.every(x => x.phone.startsWith('08')), 'file ban sao chua DAY DU cac dong da xoa (ke ca cot du lieu)');
ok(e.cache.includes('customers_v12') && e.cache.includes('lk_0810000000'), 'xoa cache danh sach + lookup');
ok(JSON.parse(e.props.SB_CARE_PRUNE_STATE).deleted === 5, 'ghi trang thai');
ok(e.run("_sbBackupFiles_(DriveApp.getFolderById('" + e.folder().id + "'), 'care_data')").length === 0, 'file pruned_ KHONG lot vao danh sach ban sao luu / khoi phuc cua care_data');
r = e.run('sbPruneCare_()'); ok(r.ok && r.extra === 0 && /Khong co dong thua/.test(r.hint), 'sau khi xoa: khong con dong thua');
// 4. khong co ban sao luu <= 36 gio -> tu choi
e = makeEnv(200, 5, { backup: false }); r = e.run('sbPruneCare_({dryRun:false})');
ok(r.ok && /sao luu/.test(r.refused) && r.deleted === undefined && e.db.length === 205 && e.folders.size === 0, 'khong sao luu: tu choi');
e.props.SB_BACKUP_STATE = JSON.stringify({ lastOkAt: Date.now() - 40 * 3600000 }); r = e.run('sbPruneCare_({dryRun:false})'); ok(/sao luu/.test(r.refused) && e.db.length === 205, 'sao luu cu 40 gio: tu choi');
// 5. vuot nguong: Sheet mat nhieu SDT -> DUNG
e = makeEnv(100, 40); r = e.run('sbPruneCare_({dryRun:false})');
ok(r.ok && r.extra === 40 && r.maxAllowed === 20 && /vuot nguong/.test(r.refused) && e.db.length === 140 && e.dels.length === 0, 'vuot nguong 20: khong xoa: ' + JSON.stringify(r));
e = makeEnv(2000, 30); r = e.run('sbPruneCare_({dryRun:true})'); ok(r.maxAllowed === 41 && !r.refused, 'nguong 2% cua 2030 = 41 > 20');
e = makeEnv(100, 40); r = e.run('sbPruneCare_({dryRun:false, max:50})'); ok(r.deleted === 40 && e.db.length === 100 && e.dels.length === 1, 'ghi de nguong bang max');
// 6. dong vua cap nhat (grace) khong bi xoa
e = makeEnv(100, 3); e.db.find(x => x.phone === '0810000001').updated_at = new Date(Date.now() - 10 * 60000).toISOString();
r = e.run('sbPruneCare_({dryRun:false})'); ok(r.extra === 2 && r.graced === 1 && r.deleted === 2 && e.db.some(x => x.phone === '0810000001'), 'bo qua dong cap nhat 10 phut truoc');
// 7. Sheet trong -> khong xoa gi
e = makeEnv(0, 10); r = e.run('sbPruneCare_({dryRun:false})'); ok(r.ok && /khong co SDT nao/.test(r.refused) && e.db.length === 10 && e.dels.length === 0, 'Sheet rong: khong xoa gi');
// 8. chuan hoa SDT: o Sheet kieu so (thieu so 0) hoac co dau cach van khop
e = makeEnv(10, 2); e.sheetPhones[0] = Number(e.sheetPhones[0]); e.sheetPhones[1] = ' ' + e.sheetPhones[1] + ' ';
r = e.run('sbPruneCare_({dryRun:true})'); ok(r.extra === 2 && r.sheetPhones === 10, 'SDT sheet kieu so/co dau cach khop dung: ' + JSON.stringify(r));
// 9. nhieu hon 1 lo xoa (100/lo) + phan trang 1000 keys
e = makeEnv(2500, 15); r = e.run('sbPruneCare_({dryRun:false})'); ok(r.supabaseRows === 2515 && r.deleted === 15 && e.dels.length === 1, '3 trang keys, 1 lo xoa');
e = makeEnv(1200, 130); r = e.run('sbPruneCare_({dryRun:false, max:200})'); ok(r.deleted === 130 && e.dels.length === 2 && e.dels[0].length === 100 && e.db.length === 1200, 'xoa 130 dong = 2 lo (100 + 30)');
// 10. loi: file ban sao hong -> chua xoa gi; DELETE loi; HTTP loi; chua cau hinh; khong lo key
e = makeEnv(100, 5); e.corrupt = true; r = e.run('sbPruneCare_({dryRun:false})'); ok(!r.ok && /KHONG khop/.test(r.error) && e.db.length === 105 && e.dels.length === 0 && e.folder().files.every(f => f.trashed), 'ban sao hong -> khong xoa gi, xoa file loi');
e = makeEnv(100, 5); e.fail = 'delete'; r = e.run('sbPruneCare_({dryRun:false})'); ok(!r.ok && /HTTP 500/.test(r.error) && !JSON.stringify(r).includes('SECRETKEY') && e.folder().files.some(f => !f.trashed), 'DELETE loi: bao loi, ban sao da luu san');
e = makeEnv(100, 5); e.fail = 'all'; r = e.run('sbPruneCare_()'); ok(!r.ok && /HTTP 500/.test(r.error) && !JSON.stringify(r).includes('SECRETKEY'), 'HTTP loi khi doc');
e = makeEnv(100, 5); delete e.props.SUPABASE_KEY; r = e.run('sbPruneCare_({dryRun:false})'); ok(!r.ok && /Chua cau hinh/.test(r.error) && e.db.length === 105, 'chua cau hinh');
// 11. ham chay tay
e = makeEnv(50, 3); e.run('sbXoaDongThuaThu()'); ok(e.db.length === 53 && /Chay thu/.test(e.logs[e.logs.length - 1]), 'sbXoaDongThuaThu chi doc');
e.run('sbXoaDongThuaThat()'); ok(e.db.length === 50, 'sbXoaDongThuaThat xoa');
console.log('ALL PRUNE TESTS PASSED');
