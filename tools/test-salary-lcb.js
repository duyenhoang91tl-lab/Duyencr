#!/usr/bin/env node
// Test LUONG CO BAN (LCB) Sale Offline theo % KPI + ngay cong admin nhap tay (gas_v13.js, Quy che 26/10/2026 Phan I muc 1). Chay: node tools/test-salary-lcb.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const run = (c) => vm.runInContext(c, ctx);
ctx.__set__ = {};
run(`LockService = { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } };
  getSetting_ = function(k) { return __set__[k] === undefined ? '' : __set__[k]; };
  setSetting_ = function(k, v) { __set__[k] = v; return { ok: true }; };
  jsonOut_ = function(o) { return o; };
  _todayYm_ = function() { return '2026-11'; };
  _sessUser_ = function(t) { return t === 'admin' ? { username: 'admin', role: 'admin' } : t === 'cs' ? { username: 'cs1', role: 'cs' } : null; };
  buildSaleKpiReport_ = function(f) { return { ok: true, rows: [
    { name: 'Nam', nhomKey: 'offline', tier: 'CT', revenue: 350000000, target: 500000000, pct: 70 },
    { name: 'Tan', nhomKey: 'probation', tier: 'TV', revenue: 100000000, target: 100000000, pct: 100 },
    { name: 'Lan', nhomKey: 'online', tier: 'CT', revenue: 600000000, target: 500000000, pct: 120 },
    { name: 'Moi', nhomKey: 'offline', tier: '', revenue: 0, target: 0, pct: null },
    { name: 'Bao', nhomKey: 'offline', tier: 'CT', revenue: 430000000, target: 500000000, pct: 86 },
    { name: 'Hoa', nhomKey: 'offline', tier: 'CT', revenue: 100000000, target: 500000000, pct: 20 } ] }; };`);
const T = run('SALARY_DEFAULT_CFG_.lcbTiers');
const L = (p) => run('_lcbFor_')(p, T);
ok(L(0) === 3e6 && L(64.9) === 3e6 && L(65) === 3.5e6 && L(84.9) === 3.5e6 && L(85) === 4.25e6 && L(99.9) === 4.25e6 && L(100) === 5e6 && L(250) === 5e6, 'LCB theo % KPI: <65%=3tr, 65-<85=3,5tr, 85-<100=4,25tr, >=100=5tr (bien dung moc)');
ok(L(null) === null, 'chua co KPI (pct null) -> khong tinh LCB');
ok(run('_lcbNet_')(3.5e6, 26, 13) === 1750000 && run('_lcbNet_')(5e6, 26, 26) === 5e6 && run('_lcbNet_')(5e6, 26, 20.5) === Math.round(5e6 / 26 * 20.5) && run('_lcbNet_')(5e6, 26, null) === 5e6 && run('_lcbNet_')(5e6, 26, 0) === 0, 'LCB thuc nhan = LCB / ngay cong chuan x ngay cong thuc te; chua nhap = LCB nguyen; 0 ngay = 0');
// quyen
ok(run('buildSalaryReport_({token:"cs"})').code === 'FORBIDDEN' && run('buildSalaryReport_({})').code === 'AUTH', 'chi admin xem bang luong (cs bi tu choi, khong token -> AUTH)');
// bao cao khi chua nhap ngay cong
let r = run('buildSalaryReport_({token:"admin", month:"2026-11"})');
const by = {}; r.rows.forEach(x => by[x.name] = x);
ok(r.ok && Object.keys(by).sort().join() === 'Bao,Hoa,Nam,Tan', 'chi Sale Offline + Thu viec co bac: loai Lan (online) va Moi (chua co bac)');
ok(by.Nam.lcbTier === 3.5e6 && by.Tan.lcbTier === 5e6 && by.Bao.lcbTier === 4.25e6 && by.Hoa.lcbTier === 3e6, 'LCB theo % cua tung nguoi (Nam 70%, Tan 100%, Bao 86%, Hoa 20%)');
ok(r.standardDays === 26 && r.missingCount === 4 && by.Nam.missingWorkdays && by.Nam.lcbNet === 3.5e6, 'chua nhap ngay cong: hien LCB theo ty le, danh dau thieu (4 nguoi), cong chuan mac dinh 26');
ok(run('buildSalaryReport_({token:"admin", month:"2026-11", all:"1"})').rows.some(x => x.name === 'Lan'), 'all=1 hien ca Sale kenh khac');
// nhap ngay cong
let s = run('salarySaveWorkdays_({token:"admin", month:"2026-11", standard:"25", byName:{Nam:"12.5", Tan:"25", Bao:"", Hoa:"20.3"}})');
ok(s.ok, 'admin luu ngay cong: ' + JSON.stringify(s));
r = run('buildSalaryReport_({token:"admin", month:"2026-11"})'); r.rows.forEach(x => by[x.name] = x);
ok(r.standardDays === 25 && by.Nam.workdays === 12.5 && by.Nam.lcbNet === Math.round(3.5e6 / 25 * 12.5) && by.Tan.lcbNet === 5e6, 'LCB thuc nhan Nam = 3,5tr/25 x 12,5 = ' + by.Nam.lcbNet + '; Tan di du 25/25 = 5tr');
ok(by.Hoa.workdays === 20.5, 'ngay cong lam tron buoc 0,5 (20,3 -> 20,5)');
ok(by.Bao.workdays === null && by.Bao.missingWorkdays && r.missingCount === 1, 'ngay cong de trong = chua nhap (Bao) -> con thieu 1 nguoi');
// gop, khong ghi de nguoi khac; xoa bang rong
s = run('salarySaveWorkdays_({token:"admin", month:"2026-11", byName:{Bao:"26", Nam:""}})');
r = run('buildSalaryReport_({token:"admin", month:"2026-11"})'); r.rows.forEach(x => by[x.name] = x);
ok(s.ok && by.Bao.workdays === 26 && by.Nam.workdays === null && by.Tan.workdays === 25 && r.standardDays === 25, 'luu tiep chi doi nguoi gui kem, giu cong chuan + nguoi khac; ngay cong "" = xoa');
// thang khac tach rieng
ok(run('buildSalaryReport_({token:"admin", month:"2026-12"})').standardDays === 26 && run('buildSalaryReport_({token:"admin", month:"2026-12"})').missingCount === 4, 'thang khac khong lan ngay cong thang truoc');
// kiem tra dau vao
ok(!run('salarySaveWorkdays_({token:"admin", month:"2026-11", byName:{Nam:"40"}})').ok && !run('salarySaveWorkdays_({token:"admin", month:"2026-11", byName:{Nam:"-1"}})').ok && !run('salarySaveWorkdays_({token:"admin", month:"11/2026", byName:{}})').ok && !run('salarySaveWorkdays_({token:"admin", month:"2026-11", standard:"0", byName:{}})').ok, 'tu choi ngay cong >31, am, thang sai, cong chuan 0');
ok(run('salarySaveWorkdays_({token:"cs", month:"2026-11", byName:{Nam:"20"}})').code === 'FORBIDDEN', 'nhan vien khong tu nhap ngay cong');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
