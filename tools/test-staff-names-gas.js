#!/usr/bin/env node
// Test Node cho TEN THEO HE THONG trong HO SO NHAN VIEN (gas_v13.js): _profNamesClean_, profileSave_ (names), _profSyncTags_, staffNamesList_.
// Yeu cau Duyen 26/11/2026: 1 ho so chuan (vd Ninh Thi Nga) gom ten Pancake + CRM + Base + POS; Team chon theo ho so.
// Chay: node tools/test-staff-names-gas.js -> "ALL STAFF NAMES TESTS PASSED". Khong goi mang that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const run = (code) => vm.runInContext(code, ctx);

// ---- 1) _profNamesClean_ ----
const clean = (n) => run('_profNamesClean_(' + JSON.stringify(n) + ')');
let r = clean({ pancake: ['  Ngà   Ninh ', 'ngà ninh', ''], crm: 'ninhnga99', base: 'Ninh Nga; Ninh Thị Ngà\nninh nga', pos: [] });
ok(r.ok, 'names hop le');
eq(r.names.pancake, ['Ngà Ninh'], 'gon khoang trang + bo trung (khong phan biet hoa/thuong)');
eq(r.names.crm, ['ninhnga99'], 'chuoi 1 ten -> mang');
eq(r.names.base, ['Ninh Nga', 'Ninh Thị Ngà'], 'tach theo ; va xuong dong, bo trung ninh nga');
ok(!clean({ base: ['=SUM(1)'] }).ok, 'chan ten mo dau bang =');
ok(!clean({ pos: ['x'.repeat(61)] }).ok, 'ten qua dai');
ok(!clean({ pos: Array.from({ length: 21 }, (_, i) => 'n' + i) }).ok, 'qua 20 ten/he thong');
eq(clean(undefined).names, { pancake: [], crm: [], base: [], pos: [] }, 'khong gui gi -> 4 mang rong');

// ---- 2) profileSave_ / staffNamesList_ voi du lieu gia ----
const users = [
  { username: 'admin1', name: 'Admin', names: [], role: 'admin', team: '', active: true },
  { username: 'ninhnga99', name: 'ninhnga99', names: [], role: 'cs', team: 'VP', active: true },
  { username: 'thuydinh95', name: 'thuydinh95', names: [], role: 'cs', team: 'VP', active: true },
  { username: 'dungntk1987', name: 'dungNTK1987', names: [], role: 'cs', team: 'VP', active: true },
  { username: 'lead1', name: 'Lan', names: [], role: 'leader', team: 'VP', active: true }
];
ctx.__users__ = users; ctx.__rows__ = []; ctx.__set__ = { salePersonTags: JSON.stringify({ 'dungNTK1987': ['Nguyễn Viên Sa'], 'manhTay': ['Thuydinh1995'] }) };
vm.runInContext(`
  LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
  var __sheet = { getLastRow: function() { return __rows__.length + 1; },
    getRange: function(r, c, nr, nc) { return { getValues: function() { return __rows__.slice(r - 2, r - 2 + (nr || 1)).map(function(x) { return x.slice(c - 1, c - 1 + nc); }); },
      setNumberFormat: function() { return this; }, setValues: function(v) { __rows__[r - 2] = v[0]; } }; } };
  getCrmSS_ = function() { return { getSheetByName: function() { return __sheet; } }; };
  getSheet_ = function() { return __sheet; };
  readUsers_ = function() { return __users__; };
  _roleBase_ = function(r) { return r; };
  _sessUser_ = function(t) { for (var i = 0; i < __users__.length; i++) if (__users__[i].username === t) return __users__[i]; return null; };
  getSetting_ = function(k) { return __set__[k] === undefined ? '' : __set__[k]; };
  setSetting_ = function(k, v) { __set__[k] = v; return { ok: true }; };
  jsonOut_ = function(o) { return o; };
`, ctx);
const sv = (viewer, user, names, profile) => run('profileSave_({token:' + JSON.stringify(viewer) + ',username:' + JSON.stringify(user) + ',profile:' + JSON.stringify(profile || { fullName: 'Ninh Thị Ngà' }) + (names === undefined ? '' : ',names:' + JSON.stringify(names)) + '})');
const tags = () => JSON.parse(ctx.__set__.salePersonTags);

// 2a) admin luu ho so Ninh Thi Nga kem ten 4 he thong
let s = sv('admin1', 'ninhnga99', { pancake: ['Ngà Ninh'], crm: ['ninhnga99'], base: ['Ninh Nga', 'ninhnga.base'], pos: ['ninhnga99 pos'] });
ok(s.ok, 'admin luu ho so + ten: ' + JSON.stringify(s));
eq(s.profile.names.base, ['Ninh Nga', 'ninhnga.base'], 'doc lai ten Base');
eq(tags().ninhnga99, ['Ngà Ninh', 'Ninh Nga', 'ninhnga.base', 'ninhnga99 pos'], 'ten tu moi he thong vao salePersonTags[ten chinh] (ten chinh khong lap lai trong the)');
eq(tags().dungNTK1987, ['Nguyễn Viên Sa'], 'nhom the cua nguoi khac khong bi dung toi');

// 2b) nhan vien tu sua ho so (khong kem names) -> giu nguyen ten cu; kem names -> FORBIDDEN
s = sv('ninhnga99', 'ninhnga99', undefined, { fullName: 'Ninh Thị Ngà', phone: '0912345678' });
ok(s.ok && s.profile.phone === '0912345678', 'nhan vien tu sua SDT'); eq(s.profile.names.pancake, ['Ngà Ninh'], 'ten theo he thong GIU NGUYEN khi khong gui names');
s = sv('ninhnga99', 'ninhnga99', { pancake: ['ai do'] }); ok(s.code === 'FORBIDDEN', 'nhan vien KHONG tu sua ten theo he thong');
s = sv('lead1', 'ninhnga99', { pancake: ['ai do'] }); ok(s.code === 'FORBIDDEN', 'leader khong sua duoc');
eq(tags().ninhnga99.length, 4, 'the khong doi sau cac lan bi tu choi');

// 2c) xung dot: ten dang thuoc nguoi khac -> tu choi, KHONG ghi gi
const rowsBefore = JSON.stringify(ctx.__rows__), tagsBefore = ctx.__set__.salePersonTags;
s = sv('admin1', 'thuydinh95', { base: ['Thuydinh1995'] });
ok(s.ok === false && /manhTay/.test(s.error), 'ten da la the cua nhom khac -> bao ro nhom nao: ' + s.error);
s = sv('admin1', 'thuydinh95', { pos: ['Nguyễn Viên sa'] });
ok(s.ok === false && /dungNTK1987/.test(s.error), 'khong phan biet hoa/thuong/dau khi do trung');
s = sv('admin1', 'thuydinh95', { crm: ['DUNGNTK1987'] });
ok(s.ok === false, 'ten trung username/ten tai khoan khac -> tu choi');
eq(JSON.stringify(ctx.__rows__), rowsBefore, 'xung dot -> khong ghi dong nao'); eq(ctx.__set__.salePersonTags, tagsBefore, 'xung dot -> khong doi salePersonTags');
s = sv('admin1', 'ninhnga99', { base: ['ninhnga99'] }); ok(s.ok, 'ten giong ten chinh cua chinh minh khong bi coi la xung dot');

// 2d) bo ten khoi ho so -> xoa dung ten ho so, GIU the admin gan tay o Quan ly Team
s = sv('admin1', 'ninhnga99', { pancake: ['Ngà Ninh'], base: ['Ninh Nga'] });
ctx.__set__.salePersonTags = JSON.stringify(Object.assign(tags(), { ninhnga99: tags().ninhnga99.concat(['the-gan-tay']) }));
s = sv('admin1', 'ninhnga99', { pancake: ['Ngà Ninh'] });
ok(s.ok, 'bo bot ten'); eq(tags().ninhnga99, ['Ngà Ninh', 'the-gan-tay'], 'Ninh Nga bi go (la ten ho so cu), the-gan-tay (gan tay) con nguyen');
s = sv('admin1', 'ninhnga99', { pancake: [], crm: [], base: [], pos: [] });
eq(tags().ninhnga99, ['the-gan-tay'], 'xoa het ten ho so: chi con the gan tay');

// 2e) tich hop voi gop theo NGUOI cua backend: _userAliasGroups_ phai ra du moi ten
s = sv('admin1', 'ninhnga99', { pancake: ['Ngà Ninh'], base: ['Ninh Nga'], pos: ['ninhnga99 pos'] });
const grp = run('_userAliasGroups_()');
const k = run('_normTxt_("Ninh Nga")');
ok(grp[k] && ['ninhnga99', 'Ngà Ninh', 'Ninh Nga', 'ninhnga99 pos', 'the-gan-tay'].every((x) => grp[k].indexOf(x) > -1), 'moi ten ho so cung 1 nhom nguoi (doanh thu gop): ' + JSON.stringify(grp[k]));

// 2f) staffNamesList_
let l = run('staffNamesList_({token:"admin1"})');
ok(l.ok, 'admin xem danh sach ho so'); const nn = l.list.filter((x) => x.username === 'ninhnga99')[0];
eq(nn.display, 'Ninh Thị Ngà', 'hien ten chuan (ho ten) thay vi ten CRM'); eq(nn.names.base, ['Ninh Nga'], 'co ten theo he thong');
eq(nn.all, ['Ngà Ninh', 'Ninh Nga', 'ninhnga99 pos'], 'all = hop ten 4 he thong');
const th = l.list.filter((x) => x.username === 'thuydinh95')[0]; eq(th.display, 'thuydinh95', 'chua co ho so -> hien ten tai khoan');
ok(run('staffNamesList_({token:"lead1"})').ok, 'leader xem duoc'); ok(run('staffNamesList_({token:"ninhnga99"})').code === 'FORBIDDEN', 'sale khong xem duoc danh sach');
ok(run('staffNamesList_({token:"zzz"})').code === 'AUTH', 'khong token -> AUTH');
console.log('ALL STAFF NAMES TESTS PASSED');
