#!/usr/bin/env node
// Test Node cho HO SO NHAN VIEN (gas_v13.js, khoi "HO SO NHAN VIEN": profileGet_/profileSave_/staffOverview_). Khong goi mang that.
// Chay: node tools/test-staff-profile.js  -> in "ALL STAFF PROFILE TESTS PASSED" neu dat.
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

// ---- 1) _profClean_ ----
const clean = (p) => run('_profClean_(' + JSON.stringify(p) + ')');
let r = clean({ fullName: '  Nguyễn  Thu   Hiền ', phone: '0912 345.678', email: 'hien@abc.vn', facebook: 'facebook.com/thuhien' });
ok(r.ok, 'ho so hop le'); eq(r.profile.fullName, 'Nguyễn Thu Hiền', 'gon khoang trang ho ten'); eq(r.profile.phone, '0912345678', 'bo ky tu phan cach SDT, giu so 0 dau');
eq(r.profile.facebook, 'https://facebook.com/thuhien', 'tu them https://');
ok(clean({ fullName: '=HYPERLINK("x")' }).ok === false, 'chan ho ten mo dau bang =');
ok(clean({ phone: '12ab' }).ok === false && clean({ phone: '123' }).ok === false, 'SDT sai bi tu choi');
ok(clean({ email: 'abc' }).ok === false && clean({ email: 'a@b' }).ok === false, 'email sai bi tu choi');
ok(clean({ facebook: 'https://evil.com/facebook.com' }).ok === false, 'link khong phai Facebook bi tu choi');
ok(clean({ facebook: 'https://facebook.com.evil.com/x' }).ok === false, 'ten mien gia (facebook.com.evil.com) bi tu choi');
ok(clean({ facebook: 'https://m.facebook.com/profile.php?id=1' }).ok, 'm.facebook.com hop le');
ok(clean({ fullName: 'x'.repeat(81) }).ok === false, 'ho ten qua dai');
ok(clean({}).ok && clean({}).profile.phone === '', 'ho so rong hop le (xoa het)');

// ---- 2) _profRank_ ----
eq(run('_profRank_([{me:true,revenue:5},{revenue:8},{revenue:2}])'), { rank: 2, of: 3 }, 'hang 2/3');
eq(run('_profRank_([{me:true,revenue:5},{revenue:5},{revenue:2}])'), { rank: 1, of: 3 }, 'dong hang chung hang');
eq(run('_profRank_([{revenue:5}])'), null, 'khong co "me" -> null');

// ---- 3) staffOverview_ / profileGet_ / profileSave_ voi du lieu gia ----
const users = [
  { username: 'admin1', name: 'Admin', names: [], role: 'admin', team: '', active: true },
  { username: 'lead1', name: 'Lan', names: ['lanLeader'], role: 'leader', team: 'Team 1', active: true },
  { username: 'mgr1', name: 'Quan', names: [], role: 'manager', team: 'KD1', active: true },
  { username: 'saleA', name: 'Anh', names: ['anhNP1999'], role: 'cs', team: 'Team 1', active: true },
  { username: 'saleB', name: 'Dung', names: ['dungnguyen1995'], role: 'cs', team: 'Team 1', active: true },
  { username: 'saleC', name: 'Thu', names: ['thuNH1986'], role: 'cs', team: 'Team 9', active: true }
];
ctx.__users__ = users; ctx.__rows__ = [];
vm.runInContext(`
  CacheService = { getScriptCache: function() { return { get: function() { return null; }, put: function() {} }; } };
  LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
  var __sheet = { getLastRow: function() { return __rows__.length + 1; },
    getRange: function(r, c, nr, nc) { return { getValues: function() { return __rows__.slice(r - 2, r - 2 + (nr || 1)).map(function(x) { return x.slice(c - 1, c - 1 + nc); }); },
      setNumberFormat: function() { return this; }, setValues: function(v) { __rows__[r - 2] = v[0]; } }; } };
  getCrmSS_ = function() { return { getSheetByName: function() { return __sheet; } }; };
  getSheet_ = function() { return __sheet; };
  readUsers_ = function() { return __users__; };
  _sessUser_ = function(t) { for (var i = 0; i < __users__.length; i++) if (__users__[i].username === t) return __users__[i]; return null; };
  readTeams_ = function() { return [{ name: 'Team 1', leader: 'lanLeader', members: ['anhNP1999', 'dungnguyen1995'] }]; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  posMetrics_ = function() { return { ok: true, bySale: [{ name: 'anhNP1999', revenue: 5000000 }, { name: 'dungnguyen1995', revenue: 8000000 }, { name: 'thuNH1986', revenue: 2000000 }, { name: 'lanLeader', revenue: 1000000 }] }; };
  buildTeamMetrics_ = function() { return { warnings: [], list: [
    { name: 'anhNP1999', dept: 'Phòng KD 1', deptKey: 'KD1', revenue: 5000000, tongTT: 200, sdtMangVe: 60, tyLeChot: 10 },
    { name: 'dungnguyen1995', dept: 'Phòng KD 1', deptKey: 'KD1', revenue: 8000000, tongTT: 100, sdtMangVe: 20, tyLeChot: 20 },
    { name: 'thuNH1986', dept: 'Phòng KD 2', deptKey: 'KD2', revenue: 2000000, tongTT: 50, sdtMangVe: 10, tyLeChot: 4 },
    { name: 'lanLeader', dept: 'Phòng KD 1', deptKey: 'KD1', revenue: 1000000, tongTT: 0, sdtMangVe: 0, tyLeChot: null } ] }; };
  buildCsStats_ = function(cs) { return { ok: true, names: [cs === 'saleA' ? 'anhNP1999' : cs === 'saleB' ? 'dungnguyen1995' : cs], totalOrders: 12, revenue: 5000000, commission: { total: 150000 }, bonus: { total: 40000 }, closeRate: null, ghepLoi: '' }; };
`, ctx);
const ov = (viewer, user) => run('staffOverview_({ token: ' + JSON.stringify(viewer) + ', username: ' + JSON.stringify(user) + ', from: "2026-10-01", to: "2026-10-12" })');

let o = ov('saleA', 'saleA');
ok(o.ok, 'nhan vien xem so lieu cua chinh minh'); eq(o.totalOrders, 12, 'tong don'); eq(o.revenue, 5000000, 'doanh thu'); eq(o.commission, 150000, 'hoa hong'); eq(o.bonus, 40000, 'thuong');
eq(o.closeRatePancake, 10, 'ty le chot Pancake'); eq(o.phoneConnectRate, 30, 'ty le ket noi SDT = 60/200'); eq(o.pancakeConversations, 200, 'so hoi thoai');
eq(o.rankTeam, { name: 'Team 1', rank: 2, of: 3 }, 'hang trong Team 1: A(5tr) sau B(8tr), truoc leader(1tr) -> 2/3');
eq(o.rankDept, { name: 'Phòng KD 1', rank: 2, of: 3 }, 'hang trong phong KD1 (A, B, leader) = 2/3');
o = ov('saleB', 'saleB'); eq(o.rankTeam.rank, 1, 'B doanh thu cao nhat team'); eq(o.rankDept.rank, 1, 'B hang 1 phong');
ok(ov('saleA', 'saleB').code === 'FORBIDDEN', 'sale khong xem duoc so lieu nguoi khac');
ok(ov('lead1', 'saleA').ok, 'leader xem duoc thanh vien team minh');
ok(ov('lead1', 'saleC').code === 'FORBIDDEN', 'leader khong xem duoc nguoi ngoai team');
ok(ov('mgr1', 'saleA').ok && ov('mgr1', 'saleB').ok, 'quan ly phong KD1 xem duoc nhan vien phong KD1');
ok(ov('mgr1', 'saleC').code === 'FORBIDDEN', 'quan ly KD1 khong xem duoc nhan vien phong KD2');
ok(ov('admin1', 'saleC').ok, 'admin xem duoc tat ca');
ok(ov('khong-co-token', 'saleA').code === 'AUTH', 'token sai -> AUTH');
eq(run('staffOverview_({ token: "saleA", from: "2026-10-12", to: "2026-10-01" })').ok, false, 'khoang ngay nguoc bi tu choi');

// jsonOut_ tra ContentService (proxy) nen thay jsonOut_ bang ham tra object de doc ket qua
vm.runInContext('jsonOut_ = function(o) { return o; };', ctx);
const sv = (viewer, user, profile) => run('profileSave_({token:' + JSON.stringify(viewer) + ',username:' + JSON.stringify(user) + ',profile:' + JSON.stringify(profile) + '})');
let s = sv('saleA', 'saleA', { fullName: 'Nguyễn Anh', phone: '0911222333', email: 'a@x.vn', facebook: 'facebook.com/anh' });
ok(s.ok && s.profile.fullName === 'Nguyễn Anh', 'nhan vien tu luu ho so'); eq(ctx.__rows__.length, 1, 'ghi 1 dong');
s = sv('saleA', 'saleA', { fullName: 'Nguyễn Anh 2' }); eq(ctx.__rows__.length, 1, 'luu lan 2 ghi de dong cu (khong them dong)'); eq(s.profile.fullName, 'Nguyễn Anh 2', 'noi dung moi');
ok(sv('saleA', 'saleB', { fullName: 'Hack' }).code === 'FORBIDDEN', 'nhan vien khong sua ho so nguoi khac');
ok(sv('admin1', 'saleB', { fullName: 'Dũng' }).ok && ctx.__rows__.length === 2, 'admin sua ho so ho nhan vien');
ok(sv('saleA', 'saleA', { phone: 'abc' }).ok === false, 'du lieu sai bi tu choi, khong ghi');
let g = run('profileGet_({ token: "saleA" })'); ok(g.ok && g.profile.fullName === 'Nguyễn Anh 2' && g.canEdit, 'doc lai ho so cua minh');
ok(run('profileGet_({ token: "saleA", username: "saleB" })').code === 'FORBIDDEN', 'sale khong xem ho so nguoi khac');
g = run('profileGet_({ token: "lead1", username: "saleB" })'); ok(g.ok && g.profile.fullName === 'Dũng' && !g.canEdit, 'leader xem duoc, khong sua duoc');
ok(run('profileGet_({ token: "admin1", username: "saleB" })').canEdit, 'admin sua duoc');
console.log('ALL STAFF PROFILE TESTS PASSED');
