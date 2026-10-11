#!/usr/bin/env node
// Test Node cho SAO LUU Supabase -> Google Drive (sbBackup_, sbRestoreBackup_, trigger, trang thai). Drive/Utilities/fetch GIA, gzip that (zlib).
// Chay: node tools/test-supabase-backup.js -> "ALL BACKUP TESTS PASSED". Khong goi mang that.
const fs = require('fs'), vm = require('vm'), path = require('path'), zlib = require('zlib');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };

function makeEnv(sizes) {
  sizes = sizes || { care_data: 2500, dt_tong: 30, don_chi_tiet: 5 };
  const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY' };
  const env = { props, db: {}, posts: [], triggers: [], folders: new Map(), fetches: 0, fail: false, corrupt: false, totalOverride: null, logs: [] };
  const mk = {
    care_data: i => ({ phone: '09' + String(10000000 + i), cs: 'cs' + i, updated_at: '2026-10-01T00:00:00Z' }),
    dt_tong: i => ({ id: 'ID' + i, src_row: i + 2, phone: '09' + i, raw: [{ $d: '2026-09-01T00:00:00Z' }, 'x'], archived: i % 5 === 0 }),
    don_chi_tiet: i => ({ src_row: i + 2, phone: '09' + i, san_pham: 'SP ' + i, raw: ['a', 1] })
  };
  Object.keys(sizes).forEach(t => { env.db[t] = []; for (let i = 0; i < sizes[t]; i++) env.db[t].push(mk[t](i)); });
  env.mk = mk;
  const blob = (buf, name) => ({ buf: Buffer.from(buf), _n: name, getBytes() { return this.buf; }, getDataAsString() { return this.buf.toString('utf8'); }, getName() { return this._n; } });
  let id = 0;
  const mkFolder = name => { const f = { id: 'F' + (++id), name, files: [], getId() { return this.id; },
    createFile(b) { if (env.corrupt) b = blob('corrupt', b._n); const file = { id: 'f' + (++id), blob: b, trashed: false, getId() { return this.id; }, getName() { return this.blob._n; }, getBlob() { return this.blob; }, setTrashed(v) { this.trashed = !!v; } }; this.files.push(file); env.files.set(file.id, file); return file; },
    getFiles() { const l = this.files.filter(x => !x.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; } }; env.folders.set(f.id, f); return f; };
  env.files = new Map();
  const R = (code, body, h) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => h || {} });
  let stamp = 0, trigId = 0;
  const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, encodeURIComponent, Buffer,
    Logger: { log: m => env.logs.push(String(m)) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
    ScriptApp: { getProjectTriggers: () => env.triggers.slice(), deleteTrigger: t => { env.triggers.splice(env.triggers.indexOf(t), 1); },
      newTrigger: fn => { const c = { timeBased() { return c; }, everyDays() { return c; }, atHour() { return c; }, everyMinutes() { return c; }, create() { env.triggers.push({ getHandlerFunction: () => fn, n: ++trigId }); } }; return c; } },
    Utilities: { newBlob: (d, m, n) => blob(typeof d === 'string' ? Buffer.from(d, 'utf8') : d, n), gzip: (b, n) => blob(zlib.gzipSync(b.buf), n || b._n + '.gz'), ungzip: b => blob(zlib.gunzipSync(b.buf), String(b._n).replace(/\.gz$/, '')) },
    DriveApp: { getFolderById: i => { const f = env.folders.get(i); if (!f) throw new Error('khong co folder'); return f; },
      getFoldersByName: n => { const l = [...env.folders.values()].filter(f => f.name === n); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
      createFolder: n => mkFolder(n), getFileById: i => { const f = env.files.get(i); if (!f) throw new Error('khong co file'); return f; } },
    UrlFetchApp: { fetch(url, o) {
      env.fetches++;
      if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
      if (env.fail) return R(500, 'boom');
      const u = new URL(url), t = u.pathname.split('/rest/v1/')[1];
      if (o.method === 'POST') { env.posts.push({ t, on_conflict: u.searchParams.get('on_conflict'), n: JSON.parse(o.payload).length }); const a = JSON.parse(o.payload); env.restored = (env.restored || []).concat(a); return R(201, ''); }
      const all = env.db[t] || [], lim = parseInt(u.searchParams.get('limit'), 10), off = parseInt(u.searchParams.get('offset') || '0', 10);
      let page = all.slice(off, off + lim);
      if (env.dupAtBoundary && off > 0) page = [all[off - 1]].concat(page.slice(0, lim - 1));   // dong cuoi trang truoc lap lai (du lieu doi giua 2 trang)
      const total = env.totalOverride != null ? env.totalOverride : all.length;
      return R(200, JSON.stringify(page), o.headers.Prefer === 'count=exact' ? { 'Content-Range': (page.length ? off + '-' + (off + page.length - 1) : '*') + '/' + total } : {}); } } };
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
  ctx._sbBackupStamp_ = () => 'S' + String(++stamp).padStart(3, '0');
  env.run = c => vm.runInContext(c, ctx); env.ctx = ctx;
  env.folder = () => [...env.folders.values()][0];
  env.live = t => env.folder().files.filter(f => !f.trashed && f.getName().indexOf(t + '_') === 0).map(f => f.getName());
  env.content = name => JSON.parse(zlib.gunzipSync(env.folder().files.find(f => f.getName() === name).blob.buf).toString('utf8'));
  return env;
}

// ───── 1. sao luu day du ─────
let e = makeEnv();
ok(e.run('sbBackupStatus_()').lastOkAt === null, 'ban dau chua co sao luu');
let r = e.run('sbBackup_()');
ok(r.ok && r.complete && !r.error, 'sao luu xong: ' + JSON.stringify(r).slice(0, 300));
ok(e.folders.size === 1 && e.folder().name === 'CRM Supabase Backup' && e.props.SB_BACKUP_FOLDER_ID === e.folder().id, 'tao thu muc rieng + nho id');
ok(r.tables.care_data.rows === 2500 && r.tables.dt_tong.rows === 30 && r.tables.don_chi_tiet.rows === 5, 'dem dong: ' + JSON.stringify(Object.values(r.tables).map(x => x.rows)));
ok(Object.values(r.tables).every(x => !x.warn && x.bytes > 0), 'khong canh bao, co dung luong');
const nm = e.live('care_data')[0]; ok(/^care_data_S001\.json\.gz$/.test(nm), 'ten file: ' + nm);
const c1 = e.content(nm); ok(c1.table === 'care_data' && c1.count === 2500 && c1.rows.length === 2500 && c1.rows[2499].phone === e.db.care_data[2499].phone && c1.takenAt, 'noi dung file care_data dung');
ok(JSON.stringify(e.content(e.live('dt_tong')[0]).rows) === JSON.stringify(e.db.dt_tong), 'dt_tong (ke ca dong archived + raw) giong het');
ok(e.fetches === 5, 'phan trang 1000/trang: ' + e.fetches + ' request (care 3 trang + dt 1 + don 1)');
ok(!e.props.SB_BACKUP_RUNNING, 'xoa co dang chay');
let s = e.run('sbBackupStatus_()'); ok(s.lastOkAt && s.ageHours < 0.1 && !s.lastError && s.files.care_data.rows === 2500 && !s.running, 'trang thai sau khi xong');
ok(!JSON.stringify(e.logs).includes('SECRETKEY') && !JSON.stringify(s).includes('SECRETKEY'), 'khong lo key');

// ───── 2. giu SB_BACKUP_KEEP_ ban moi nhat ─────
for (let i = 0; i < 8; i++) e.run('sbBackup_()');
ok(e.live('care_data').length === 7 && e.live('dt_tong').length === 7 && e.live('don_chi_tiet').length === 7, 'giu dung 7 ban moi bang');
ok(e.live('care_data').includes('care_data_S009.json.gz') && !e.live('care_data').includes('care_data_S001.json.gz') && !e.live('care_data').includes('care_data_S002.json.gz'), 'xoa ban CU NHAT, giu ban moi');
ok(e.folder().files.filter(f => f.trashed).length === 6, 'ban cu duoc dua vao thung rac (khong xoa han)');

// ───── 3. so dong doi giua chung -> canh bao ─────
e = makeEnv(); e.totalOverride = 2503; r = e.run('sbBackup_()');
ok(r.ok && r.complete && /khac so dem/.test(r.tables.care_data.warn), 'canh bao khi so dong != so dem');
e = makeEnv(); e.dupAtBoundary = true; r = e.run('sbBackup_()');
ok(r.ok && r.tables.care_data.rows === 2500 && !r.tables.care_data.warn, 'dong lap giua 2 trang bi loai (khong nhan doi), du dong: ' + r.tables.care_data.rows);
{ const rows = e.content(e.live('care_data')[0]).rows, set = new Set(rows.map(x => x.phone)); ok(set.size === rows.length, 'khong co khoa trung trong file'); }

// ───── 4. file ghi xong doc lai khong khop -> loi, xoa file loi, GIU ban cu ─────
e = makeEnv(); e.run('sbBackup_()'); const goodNames = e.live('care_data');
e.corrupt = true; r = e.run('sbBackup_()'); e.corrupt = false;
ok(!r.ok && /KHONG khop/.test(r.error), 'file hong -> bao loi: ' + r.error);
ok(JSON.stringify(e.live('care_data')) === JSON.stringify(goodNames), 'ban cu con nguyen, file loi da bi xoa');
s = e.run('sbBackupStatus_()'); ok(s.lastError && /KHONG khop/.test(s.lastError) && s.lastOkAt, 'trang thai ghi loi nhung van nho lan thanh cong truoc');
r = e.run('sbBackup_()'); ok(r.ok && r.complete && !e.run('sbBackupStatus_()').lastError, 'lan sau chay lai OK -> xoa loi');

// ───── 5. loi HTTP -> khong nem, khong mat ban cu, khong lo key ─────
e = makeEnv(); e.run('sbBackup_()'); const before = JSON.stringify(e.live('care_data'));
e.fail = true; r = e.run('sbBackup_()'); e.fail = false;
ok(!r.ok && /HTTP 500/.test(r.error) && !JSON.stringify(r).includes('SECRETKEY') && JSON.stringify(e.live('care_data')) === before && !e.props.SB_BACKUP_RUNNING, 'loi HTTP an toan');
e = makeEnv(); delete e.props.SUPABASE_KEY; r = e.run('sbBackup_()'); ok(!r.ok && /Chua cau hinh/.test(r.error) && e.folders.size === 0, 'chua cau hinh: khong lam gi');

// ───── 6. het gio giua chung -> lan sau TIEP TUC dot cu, khong lam lai bang da xong ─────
e = makeEnv({ care_data: 500, dt_tong: 30, don_chi_tiet: 5 }); e.run('SB_TIME_BUDGET_MS_ = -1');   // bang <1 trang: khong het gio giua 1 bang, chi giua cac bang
r = e.run('sbBackup_()'); ok(r.ok && !r.complete && r.timeUp && Object.keys(r.tables).join() === 'care_data', 'het gio: moi xong 1 bang');
ok(e.run('sbBackupStatus_()').running && e.run('sbBackupStatus_()').lastOkAt === null, 'chua tinh la xong');
r = e.run('sbBackup_()'); ok(r.ok && !r.complete && Object.keys(r.tables).join() === 'dt_tong', 'lan 2: tiep tuc bang ke tiep');
r = e.run('sbBackup_()'); ok(r.ok && r.complete && Object.keys(r.tables).join() === 'don_chi_tiet', 'lan 3: xong');
ok(e.live('care_data').length === 1 && e.live('care_data')[0] === 'care_data_S001.json.gz' && e.run('sbBackupStatus_()').lastOkAt, 'cung 1 dau thoi gian (1 dot), khong tao file thua');
// dot do dang tu lau -> bat dau dot moi
e = makeEnv({ care_data: 500, dt_tong: 30, don_chi_tiet: 5 }); e.run('SB_TIME_BUDGET_MS_ = -1'); e.run('sbBackup_()'); e.run('SB_TIME_BUDGET_MS_ = 240000');
const st = JSON.parse(e.props.SB_BACKUP_STATE); st.run.startedAt -= 21 * 3600 * 1000; e.props.SB_BACKUP_STATE = JSON.stringify(st);
r = e.run('sbBackup_()'); ok(r.ok && r.complete && Object.keys(r.tables).length === 3, 'dot do qua 20 gio -> lam lai tu dau du 3 bang');
// fresh
e = makeEnv({ care_data: 500, dt_tong: 30, don_chi_tiet: 5 }); e.run('SB_TIME_BUDGET_MS_ = -1'); e.run('sbBackup_()'); e.run('SB_TIME_BUDGET_MS_ = 240000');
r = e.run('sbBackup_({fresh:true})'); ok(r.ok && r.complete && Object.keys(r.tables).length === 3, 'fresh bo dot dang do');

// bang lon het gio GIUA CHUNG -> bao loi ro (khong tao file do), ban cu giu nguyen
e = makeEnv(); e.run('sbBackup_()'); const keep6 = JSON.stringify(e.live('care_data')); e.run('SB_TIME_BUDGET_MS_ = -1'); r = e.run('sbBackup_()'); e.run('SB_TIME_BUDGET_MS_ = 240000');
ok(!r.ok && /Het gio khi doc care_data/.test(r.error) && JSON.stringify(e.live('care_data')) === keep6, 'het gio giua bang lon: loi ro, khong dong den ban cu');

// ───── 7. co dang chay ─────
e = makeEnv(); e.props.SB_BACKUP_RUNNING = String(Date.now() - 1000);
r = e.run('sbBackup_()'); ok(r.ok && r.skipped && e.fetches === 0 && e.props.SB_BACKUP_RUNNING, 'dang co lan khac chay -> bo qua, khong dung co cua no');
e.props.SB_BACKUP_RUNNING = String(Date.now() - 9 * 60000); r = e.run('sbBackup_()'); ok(r.ok && r.complete, 'co het han (9 phut) -> chay');

// ───── 8. trigger ─────
e = makeEnv(); ok(!e.run('sbBackupStatus_()').triggerOn, 'chua co trigger');
ok(/Da tao/.test(e.run('installSbBackupTrigger_()')) && e.triggers.length === 1 && e.run('sbBackupStatus_()').triggerOn, 'cai trigger');
ok(/da ton tai/.test(e.run('installSbBackupTrigger_()')) && e.triggers.length === 1, 'cai lai khong tao them');
ok(/Da go 1/.test(e.run('removeSbBackupTrigger_()')) && e.triggers.length === 0, 'go trigger');
e.run('sbBackupTick_()'); ok(e.logs.some(l => /sbBackupTick .*"complete":true/.test(l)), 'tick chay duoc');

// ───── 9. khoi phuc ─────
e = makeEnv(); e.run('sbBackup_()'); e.posts.length = 0;
ok(!e.run("sbRestoreBackup_({table:'xxx'})").ok, 'bang sai bi tu choi');
r = e.run("sbRestoreBackup_({table:'care_data'})");
ok(r.ok && r.dryRun && r.backupRows === 2500 && r.supabaseRowsNow === 2500 && r.file === 'care_data_S001.json.gz' && e.posts.length === 0, 'chay thu: khong ghi gi: ' + JSON.stringify(r));
r = e.run('sbKhoiPhucThu()'); ok(e.posts.length === 0 && e.logs.filter(l => /"dryRun": true/.test(l)).length === 3, 'sbKhoiPhucThu chi doc 3 bang');
// mat du lieu that -> khoi phuc
e.db.care_data.length = 100; e.restored = [];
r = e.run("sbRestoreBackup_({table:'care_data', dryRun:false})");
ok(r.ok && r.done && r.restored === 2500 && e.posts.length === 5 && e.posts.every(p => p.t === 'care_data' && p.on_conflict === 'phone') && e.restored.length === 2500, 'khoi phuc het: ' + JSON.stringify(r) + ' posts ' + e.posts.length);
ok(e.restored[2499].phone === e.mk.care_data(2499).phone && !e.props.SB_RESTORE_CARE_DATA, 'dung du lieu + xoa con tro');
e.posts.length = 0; e.run('sbRestoreBackup_({table:"dt_tong", dryRun:false})'); ok(e.posts[0].on_conflict === 'id,src_row' && e.restored.length === 2530, 'dt_tong dung khoa (id,src_row)');
// resume khi het gio
e.posts.length = 0; e.run('SB_BATCH_ = 1000; SB_TIME_BUDGET_MS_ = -1');
r = e.run("sbRestoreBackup_({table:'care_data', dryRun:false, reset:true})"); ok(r.ok && !r.done && r.restored === 1000 && JSON.parse(e.props.SB_RESTORE_CARE_DATA).i === 1000, 'het gio: dung o 1000, nho con tro');
r = e.run("sbRestoreBackup_({table:'care_data', dryRun:false})"); ok(r.restored === 2000 && !r.done, 'tiep tuc tu con tro');
r = e.run("sbRestoreBackup_({table:'care_data', dryRun:false})"); ok(r.done && r.restored === 2500 && e.posts.length === 3 && !e.props.SB_RESTORE_CARE_DATA, 'xong, 3 lo (khong lam lai lo da ghi)');
// file khong dung bang / khong co file / file loi
e.run('SB_BATCH_ = 500; SB_TIME_BUDGET_MS_ = 240000');
const dtFile = e.folder().files.find(f => /^dt_tong_/.test(f.getName()));
r = e.run("sbRestoreBackup_({table:'care_data', fileId:'" + dtFile.id + "'})"); ok(!r.ok && /khong phai ban sao luu cua care_data/.test(r.error), 'file cua bang khac bi tu choi');
e = makeEnv(); r = e.run("sbRestoreBackup_({table:'care_data'})"); ok(!r.ok && /Khong co file sao luu/.test(r.error), 'chua co file -> bao ro');
e = makeEnv(); e.run('sbBackup_()'); e.fail = true; r = e.run("sbRestoreBackup_({table:'care_data', dryRun:false})"); ok(!r.ok && !JSON.stringify(r).includes('SECRETKEY'), 'loi HTTP khi khoi phuc khong lo key');
console.log('ALL BACKUP TESTS PASSED');
