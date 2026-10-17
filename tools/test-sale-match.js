#!/usr/bin/env node
// Test KHOP SALE (gom cac ten cua CUNG 1 NGUOI) o backend gas_v13.js: _userAliasGroups_, _salePersonKeyFn_, _expandSaleFilterWithPancakeAliases_.
// Loi da sua 2026-10-15: tai khoan Leader/Quan ly/Admin (cot 'names' = nhieu NGUOI KHAC NHAU) bi gop thanh 1 nguoi -> loc Sale/Team ra sai.
// Chay: node tools/test-sale-match.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __users = [], __tags = '', __dir = [], __pk = {};
  getCrmSS_ = function() { return { getSheetByName: function() { return null; } }; };
  readUsers_ = function() { return __users; };
  getSetting_ = function(k) { return k === 'salePersonTags' ? __tags : ''; };
  readSaleDirectory_ = function() { return { list: __dir, byName: {} }; };
  readPancakeMap_ = function() { return __pk; };
`, ctx);
const set = (u, tags, dir, pk) => { ctx.__users = u; ctx.__tags = tags || ''; ctx.__dir = dir || []; ctx.__pk = pk || {}; };
const U = (username, name, names, role) => ({ username, name, names, role });
const groups = () => vm.runInContext('_userAliasGroups_()', ctx);
const expand = (n) => vm.runInContext('_expandSaleFilterWithPancakeAliases_(' + JSON.stringify(n) + ')', ctx);
const sameP = (a, b) => vm.runInContext('(function(){ var f = _salePersonKeyFn_(); return f(' + JSON.stringify(a) + ') === f(' + JSON.stringify(b) + '); })()', ctx);

// 1) Tai khoan Sale (cs) nhieu ten = 1 nguoi — giu nguyen
set([U('saleA', 'Anh', ['anhNP1999', 'anhnp99'], 'cs'), U('saleB', 'Dung', ['dungnguyen1995'], 'cs')]);
eq(groups().anhnp1999.slice().sort(), ['Anh', 'anhNP1999', 'anhnp99'], 'tai khoan cs: cac ten cua cung 1 nguoi gop lai');
ok(sameP('anhNP1999', 'anhnp99'), 'union-find: anhNP1999 va anhnp99 la 1 nguoi');
ok(!sameP('anhNP1999', 'dungnguyen1995'), '2 nguoi khac nhau khong gop');

// 2) LOI DA SUA: Leader/Quan ly/Admin liet ke nhieu NGUOI KHAC NHAU — KHONG duoc gop thanh 1 nguoi
set([U('saleA', 'Anh', ['anhNP1999'], 'cs'), U('saleB', 'Dung', ['dungnguyen1995'], 'cs'), U('saleC', 'Thu', ['thuNH1986'], 'cs'),
     U('lead1', 'Lan', ['lanLeader', 'anhNP1999', 'dungnguyen1995'], 'leader'), U('mgr1', 'Quan', ['anhNP1999', 'thuNH1986', 'ninhLTK'], 'manager'),
     U('admin1', 'Admin', ['yenNTH2004', 'thuNH1986'], 'admin')]);
ok(!sameP('anhNP1999', 'dungnguyen1995'), 'leader liet ke 2 sale -> van la 2 NGUOI (loi cu: gop thanh 1)');
ok(!sameP('anhNP1999', 'thuNH1986') && !sameP('dungnguyen1995', 'thuNH1986'), 'cac danh sach chong nhau cua leader/quan ly/admin khong gop thanh 1 cuc');
eq(expand(['anhNP1999']).slice().sort(), ['Anh', 'anhNP1999'], 'chon 1 Sale -> chi ra ten cua dung nguoi do (tai khoan cs: ten dang nhap + ten hien thi), KHONG keo theo danh sach cua leader');
eq(expand(['dungnguyen1995', 'thuNH1986']).slice().sort(), ['Dung', 'Thu', 'dungnguyen1995', 'thuNH1986'], 'chon vai Sale (vd 1 Team) -> chi them ten hien thi cua chinh ho, khong phinh them ten nguoi khac');

// 3) Cac nguon khop con lai van hoat dong: The (salePersonTags), SaleDirectory, PancakeNameMap 1-1 (bo qua 'a|b')
set([], JSON.stringify({ thuthuy95: ['thuthuy1995', 'thuydinh1995'] }));
ok(sameP('thuthuy95', 'thuydinh1995') && sameP('THUTHUY1995', 'thuthuy95'), 'The: moi ten cua 1 nguoi la 1 (khong phan biet hoa/thuong)');
eq(expand(['thuthuy1995']).slice().sort(), ['thuthuy1995', 'thuthuy95', 'thuydinh1995'], 'chon 1 the -> ra du cac the cua nguoi do (hai chieu)');
eq(expand(['thuthuy95']).slice().sort(), ['thuthuy1995', 'thuthuy95', 'thuydinh1995'], 'chon ten chinh -> ra du cac the');
set([], '', [{ maSale: 'S4', tenFacebook: 'Thu Nguyen', userBase: 'thuNH1986', tenTagPancake: 'thuNH1986tag' }]);
ok(sameP('Thu Nguyen', 'thuNH1986tag') && sameP('S4', 'thuNH1986'), 'SaleDirectory: ma Sale / ten Facebook / user Base / the tag Pancake cua 1 dong la 1 nguoi');
set([], '', [], { 'Hai Yen': 'yenNTH2004', 'Chung': 'saleX|saleY' });
ok(sameP('Hai Yen', 'yenNTH2004'), 'PancakeNameMap 1-1: ten Pancake = ten Sale');
ok(!sameP('saleX', 'saleY') && !sameP('Chung', 'saleX'), 'PancakeNameMap chia nhieu Sale (a|b): bo qua, khong gop nham 2 nguoi');
console.log('ALL SALE MATCH TESTS PASSED');
