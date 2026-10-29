// Test: doi sale Online/Van phong xem them nhom Sale "Quay" + phong CSKH (2026-10-29).
// Chay: node tools/test-view-extra.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
function stripVN(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
const settings = {
  saleChannels: { 'Hoa Online': 'online', 'Nam Văn Phòng': 'offline', 'Lan Quầy': 'quay', 'Minh Quầy': 'quay', 'Tân Thử Việc': 'probation' },
  saleGroups: [{ key: 'online', label: 'Online' }, { key: 'offline', label: 'Văn phòng' }, { key: 'quay', label: 'Quầy' }, { key: 'probation', label: 'Thử việc' }],
};
const depts = [{ key: 'sale', label: 'Sale' }, { key: 'cskh', label: 'CSKH' }];
const saleDepts = { 'Quỳnh CS': 'cskh', 'Mến CS': 'cskh', 'Hoa Online': 'sale' };
const ctx = {
  Logger: { log() {} },
  _csJsonSetting_: (k, f) => settings[k] || f,
  readSaleGroups_: () => settings.saleGroups,
  readDeptList_: () => depts,
  readSaleDepts_: () => ({ raw: saleDepts, byNorm: {} }),
  _stripVN_: stripVN,
  _profNames_: u => { const o = []; (u.names || []).concat([u.name, u.username]).forEach(x => { if (x && o.indexOf(x) < 0) o.push(x); }); return o; },
  readTeams_: () => [], getCrmSS_: () => ({ getSheetByName: () => null }), SH_TEAM: 'Teams',
};
vm.createContext(ctx);
['_foldSaleKey_', '_viewExtraShared_', '_viewExtraNames_', '_scopeAllowedNames_', '_usersForClient_'].forEach(n => vm.runInContext(grab(n), ctx));
vm.runInContext("var _VIEW_EXTRA_SALE_KEYS_ = { online: 1, offline: 1 }; var __viewExtraMemo_ = {}, __viewExtraShared_ = null;", ctx);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const names = r => Object.keys(r || {}).sort().join('|');

// 1) Sale Online (cs) -> ten minh + 2 nguoi nhom Quay + 2 nguoi phong CSKH
let u = { username: 'hoa', role: 'cs', name: 'Hoa Online', names: ['Hoa Online'] };
ok(names(ctx._scopeAllowedNames_(u)) === ['Hoa Online', 'Lan Quầy', 'Minh Quầy', 'Mến CS', 'Quỳnh CS'].sort().join('|'), 'sale Online: ten minh + nhom Quay + phong CSKH');
// 2) Sale Van phong (leader, khong co ten team) -> cung duoc them
u = { username: 'nam', role: 'leader', name: 'Nam Văn Phòng', names: ['Nam Văn Phòng'] };
ok(ctx._scopeAllowedNames_(u)['Lan Quầy'] === 1 && ctx._scopeAllowedNames_(u)['Quỳnh CS'] === 1, 'sale Van phong (leader): thay Quay + CSKH');
// 3) Sale "Thu viec" KHONG thuoc Online/Van phong -> khong them
u = { username: 'tan', role: 'cs', name: 'Tân Thử Việc', names: ['Tân Thử Việc'] };
ok(names(ctx._scopeAllowedNames_(u)) === 'Tân Thử Việc', 'sale Thu viec: giu nguyen, chi ten minh');
// 4) Nhan vien CSKH (khong phai sale Online/Van phong) -> khong them
u = { username: 'quynh', role: 'cs', name: 'Quỳnh CS', names: ['Quỳnh CS'] };
ok(names(ctx._scopeAllowedNames_(u)) === 'Quỳnh CS', 'nhan vien CSKH: chi ten minh');
// 5) admin / viewer: khong gioi han (null) nhu cu
ok(ctx._scopeAllowedNames_({ username: 'ad', role: 'admin', name: 'Ad' }) === null, 'admin: null (khong gioi han)');
// 6) tai khoan chua co ten trong saleChannels nhung cot saleType = online
u = { username: 'moi', role: 'cs', name: 'Moi Vao', names: ['Moi Vao'], saleType: 'online' };
ok(ctx._scopeAllowedNames_(u)['Lan Quầy'] === 1, 'saleType=online (chua co trong saleChannels): van duoc them');
// 7) Khop khong dau / hoa-thuong: nhom 'Kenh Quay' va phong 'cskh' viet khac
settings.saleGroups = [{ key: 'online', label: 'Online' }, { key: 'kenhquay', label: 'Kênh Quầy' }];
settings.saleChannels = { 'Hoa Online': 'online', 'Lan Quầy': 'kenhquay' };
vm.runInContext('__viewExtraMemo_ = {}; __viewExtraShared_ = null;', ctx);
ok(ctx._viewExtraNames_({ username: 'hoa', name: 'Hoa Online', names: ['Hoa Online'] }).names.indexOf('Lan Quầy') >= 0, "nhom key 'kenhquay' / nhan 'Kênh Quầy' van nhan ra la Quay");
// 8) Chua co nhom Quay / phong CSKH nao -> khong them gi, khong loi
settings.saleGroups = [{ key: 'online', label: 'Online' }]; settings.saleChannels = { 'Hoa Online': 'online' };
depts.length = 0; depts.push({ key: 'sale', label: 'Sale' });
vm.runInContext('__viewExtraMemo_ = {}; __viewExtraShared_ = null;', ctx);
ok(names(ctx._scopeAllowedNames_({ username: 'hoa', role: 'cs', name: 'Hoa Online', names: ['Hoa Online'] })) === 'Hoa Online', 'chua cau hinh Quay/CSKH: khong them gi');

// 9) _usersForClient_(full) tra viewNames (de pullUsers/_findAccount cua web giu dung sau khi tai lai trang); khong full thi KHONG tra
vm.runInContext('__viewExtraMemo_ = {}; __viewExtraShared_ = null;', ctx);
settings.saleGroups = [{ key: 'online', label: 'Online' }, { key: 'quay', label: 'Quầy' }]; settings.saleChannels = { 'Hoa Online': 'online', 'Lan Quầy': 'quay' };
depts.push({ key: 'cskh', label: 'CSKH' }); saleDepts['Quỳnh CS'] = 'cskh';
const us = [{ username: 'hoa', name: 'Hoa Online', names: ['Hoa Online'], role: 'cs' }, { username: 'quynh', name: 'Quỳnh CS', names: ['Quỳnh CS'], role: 'cs' }];
const full = ctx._usersForClient_(us, true), lite = ctx._usersForClient_(us, false);
ok(JSON.stringify(full[0].viewNames) === JSON.stringify(['Lan Quầy', 'Quỳnh CS', 'Mến CS']) && full[1].viewNames.length === 0, 'users(full): sale Online co viewNames, nhan vien CSKH rong');
ok(lite[0].viewNames === undefined, 'users khong token: khong tra viewNames');
// 10) Cau hinh Settings chi doc 1 lan cho nhieu tai khoan (khong doc lai moi user)
let reads = 0; const old = ctx._csJsonSetting_; ctx._csJsonSetting_ = (k, f) => { reads++; return old(k, f); };
vm.runInContext('__viewExtraMemo_ = {}; __viewExtraShared_ = null;', ctx);
ctx._usersForClient_(us.concat([{ username: 'a', name: 'A', names: ['A'], role: 'cs' }, { username: 'b', name: 'B', names: ['B'], role: 'cs' }]), true);
ok(reads === 1, 'Settings saleChannels doc dung 1 lan cho ca danh sach tai khoan (reads=' + reads + ')');
// 11) Moc ma nguon: _splitScope_ da noi vao helper; webLogin_ dung _usersForClient_(full) nen co viewNames
ok(/_viewExtraNames_\(user\)\.names\.forEach\(add\)/.test(src), '_splitScope_ them ten Quay/CSKH');
ok(/user: _usersForClient_\(\[r\.acct\], true\)\[0\]/.test(src), 'webLogin_ tra user qua _usersForClient_(full) -> co viewNames');
process.exit(fail ? 1 : 0);
