#!/usr/bin/env node
// Test Node: TAI KHOAN TEST (role 'demo') bi gioi han theo sale da chon, chi XEM, khong lay duoc ma GAS. Khong goi mang that.
// NGUYEN NHAN GOC can test: demo di nhanh rieng bang demoToken dung chung -> khong loc theo sale; POST chi bi chan khi kem truong demo.
// Chay: node tools/test-demo-scope.js -> "ALL DEMO SCOPE TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
const varLine = name => { const i = src.indexOf('\nvar ' + name + ' ='); if (i < 0) throw new Error('khong thay bien ' + name); const j = src.indexOf(';\n', i); return src.slice(i + 1, j + 2); };
let fails = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); fails++; } else console.log('  ok  ' + m); };

// ── du lieu gia ──
const OWN = { '0911000001': 'salea', '0911000002': 'saleb', '0911000003': 'salea', '0911000004': 'QUAY' };
for (let i = 10; i < 22; i++) OWN['09110000' + i] = 'salea';   // 12 khach nua cua salea => tong salea = 14 (> 5 dong cat cu)
const users = {
  tester: { username: 'tester', name: 'Test', names: ['salea'], role: 'demo', active: true },
  nosale: { username: 'nosale', name: '', names: [], role: 'demo', active: true },
  csuser: { username: 'csuser', name: 'CS', names: ['salea'], role: 'cs', active: true }
};
const tokOf = u => 'TOK:' + u;
let settings = {}, cacheStore = {}, coreCalls = [], coreFixture = {};
const jsonOut_ = o => ({ getContent: () => JSON.stringify(o), _o: o });
const ctx = {
  Logger: { log() {} },
  CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] ?? null, put: (k, v) => { cacheStore[k] = v; }, remove: k => { delete cacheStore[k]; } }) },
  jsonOut_,
  getSetting_: k => settings[k] ?? '',
  normPhone_: p => String(p || '').replace(/\D/g, ''),
  _normTxt_: t => String(t || '').toLowerCase().replace(/\s+/g, ''),
  _scopeNameKey_: t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  _sessVerify_: t => (String(t).indexOf('TOK:') === 0 ? { u: String(t).slice(4) } : null),
  _sessUser_: t => (String(t).indexOf('TOK:') === 0 ? (users[String(t).slice(4)] || null) : null),
  _leadMonths_: () => [], _scopeAssignIndex_: () => ({}), _userAliasGroups_: () => ({}),
  _viewExtraNames_: () => ({ sale: true, names: ['QUAY'] }),   // neu demo bi cong them ten nay thi se thay khach 0911000004 => test phai bat duoc
  _scopeNamesForPhone_: ph => { const o = {}; const n = OWN[String(ph).replace(/\D/g, '')]; if (n) o[n] = 1; return o; },
  _scopePhoneSet_: (user, allowed) => { const s = {}; Object.keys(OWN).forEach(ph => { if (allowed[OWN[ph]]) s[ph] = 1; }); return s; },
  doGetCore_: e => { coreCalls.push(e.parameter.action); return jsonOut_(coreFixture[e.parameter.action] || {}); }
};
vm.createContext(ctx);
const code = [
  varLine('SCOPE_ACTIONS_'), varLine('SCOPE_LIST_ACTIONS_'), varLine('SCOPE_LIST_KEY_'),
  varLine('DEMO_MAX_ROWS_'),
  src.slice(src.indexOf('var DEMO_ALLOWED_GET_ ='), src.indexOf('function _secEq_(')),
  src.slice(src.indexOf('var DEMO_CLIP_KEYS_'), src.indexOf('function _secEq_(')),
  fn('_demoSrcOf_'), fn('_demoClipPerSource_'),
  src.slice(src.indexOf('var DEMO_PHONE_KEY_RE_'), src.indexOf('function _demoMaskPhone_(')),
  fn('_demoMaskPhone_'), fn('_demoMaskText_'), varLine('DEMO_PHONE_STR_RE_'), fn('_demoMaskDeep_'), fn('_demoClip_'),
  src.slice(src.indexOf('var DEMO_SESSION_EXTRA_GET_'), src.indexOf('// Dang nhap tai khoan test: kiem tra user role "demo"')),
  fn('_scopeSameNameKeys_'), fn('_scopeVerdict_'), fn('_scopeAllowedNames_'), fn('_scopeHit_'), fn('_scopeFilterObj_'),
  fn('doGet'), fn('doPost')
].join('\n');
vm.runInContext(code, ctx);

const get = (action, token, extra) => { coreCalls = []; const p = Object.assign({ action, token }, extra || {}); const r = ctx.doGet({ parameter: p }); return JSON.parse(r.getContent()); };

// doGet/doPost can cac ham cong khac: gia lap "khong lam gi" de di den nhanh cua minh
Object.assign(ctx, {
  _adminKeyOk_: () => false, _isSensitiveSettingKey_: () => false, _demoTokenOk_: () => false, _ntlReport_: () => ({}),
  PLIB_GET_ACTIONS_: {}, MLIB_GET_ACTIONS_: {}, KHD_GET_ACTIONS_: {}, LOYALTY_GET_ACTIONS_: {}, CRM_ORDER_GET_ACTIONS_: {}, TEAMBONUS_GET_ACTIONS_: {}, SPLIT_GET_ACTIONS_: {}, CHAT_GET_ACTIONS_: {},
  _ntlNote_() {}, _enforceCheck_: () => null, _featureGate_: () => null, _ownerGate_: () => null, _scopeGate_: () => null, _scopeListServe_: () => null,
  _cfgGate_: () => null, _usersWriteAuth_: () => ({ ok: true }), _isSensitiveWriteKey_: () => false, _AUDIT_TOKEN_: '',
  demoLogin_: () => jsonOut_({}), webLogin_: () => jsonOut_({}), _secEq_: (a, b) => a === b,
  doPostCore_: () => { postCore = true; return jsonOut_({ ok: true, wrote: true }); }
});
let postCore = false;
const post = body => { postCore = false; const r = ctx.doPost({ postData: { contents: JSON.stringify(body) } }); return JSON.parse(r.getContent()); };

// 1) Loc theo sale da chon: customers chi tra khach cua salea, KHONG cat 5 dong, KHONG thay khach ten Quay (ten cong them)
coreFixture.customers = { rows: Object.keys(OWN).map(ph => ({ phone: ph, cs: OWN[ph] })), careStatus: { x: 1 } };
let r = get('customers', tokOf('tester'));
ok(Array.isArray(r.rows) && r.rows.length === 14, 'customers: tra du 14 khach cua salea (khong bi cat 5 dong): ' + (r.rows && r.rows.length));
ok(r.rows.every(x => OWN[x.phone] === 'salea'), 'customers: chi co khach cua sale da chon (khong co saleb / QUAY)');
ok(r.careStatus && r.careStatus.x === 1 && r._demoScoped === true, 'customers: giu truong khac + danh dau _demoScoped');
ok(r.rows[0].phone === '0911000001', 'customers: SDT KHONG bi che mac dinh (de tra cuu/mo ho so duoc)');
// 2) Chua chon sale nao => khong thay khach nao
r = get('customers', tokOf('nosale'));
ok(Array.isArray(r.rows) && r.rows.length === 0, 'tai khoan test chua chon sale: danh sach rong');
// 3) orders/careLeads/reminders loc theo SDT cung quy tac
coreFixture.orders = { orders: [{ phone: '0911000001' }, { phone: '0911000002' }, { phone: '0911000003' }] };
r = get('orders', tokOf('tester'));
ok(r.orders.length === 2 && r.orders.every(o => o.phone !== '0911000002'), 'orders: loc theo SDT cua sale da chon');
coreFixture.reminders = { reminders: [{ phone: '0911000002' }, { phone: '0911000001' }] };
r = get('reminders', tokOf('tester'));
ok(r.reminders.length === 1 && r.reminders[0].phone === '0911000001', 'reminders: loc theo sale');
// 4) Tra cuu 1 SDT
coreFixture.lookup = { ok: true, care: { phone: 'x' } };
r = get('lookup', tokOf('tester'), { phone: '0911000001' });
ok(r.ok === true, 'lookup SDT trong pham vi: duoc');
r = get('lookup', tokOf('tester'), { phone: '0911000002' });
ok(r.code === 'FORBIDDEN', 'lookup SDT cua sale khac: bi tu choi');
r = get('lookup', tokOf('tester'), { phone: '0911000002', via: 'search' });
ok(r.code === 'FORBIDDEN', 'lookup SDT ngoai pham vi + via=search: VAN bi tu choi (tai khoan test khong co ngoai le tra cuu)');
r = get('lookup', tokOf('tester'), { phone: '0911000004' });
ok(r.code === 'FORBIDDEN', 'lookup khach ten Quay (chi thuoc nhom cong them): bi tu choi => demo khong duoc cong ten Quay/CSKH');
r = get('donOrdersByPhone', tokOf('tester'), { phone: '0911000002' });
ok(r.code === 'FORBIDDEN', 'donOrdersByPhone ngoai pham vi: bi tu choi');
r = get('cskhDetail', tokOf('tester'), {});
ok(r.code === 'FORBIDDEN', 'cskhDetail khong co phone: bi tu choi');
// 5) cskhDuyenLite: so tong/ten khach khong SDT cua ca cong ty khong lo
coreFixture.cskhDuyenLite = { ok: true, rows: [{ phone: '0911000001' }, { phone: '0911000002' }], total: 134000, noPhone: 99, noPhoneSample: ['Nguyen Van A'] };
r = get('cskhDuyenLite', tokOf('tester'));
ok(r.rows.length === 1 && r.total === 1 && r.noPhone === 0 && r.noPhoneSample.length === 0, 'cskhDuyenLite: total=so dong da loc, khong lo noPhoneSample');
// 6) Action khong cho phep: ma GAS, tac vu, hop thu, thao luan...
['getGasSource', 'ntlReport', 'tasks', 'saveSingle', 'dedupeCare', 'runFollowUpScan', 'audit', 'pkChatInbox', 'getSettings', 'donDaily', 'donPhones', 'staffOverview', 'profileGet', 'notifications'].forEach(a => {
  coreCalls = [];
  const x = get(a, tokOf('tester'));
  ok(!!x.error && coreCalls.length === 0, 'GET ' + a + ': bi chan (' + (x.code || 'can adminKey') + ') va KHONG chay xu ly');
});
// 7) Bao cao tong hop van xem duoc nhung chi tiet bi cat 5 dong + che SDT
coreFixture.salesReportA = { total: 123, ordersDetail: Array.from({ length: 8 }, (_, i) => ({ phone: '09123456' + String(10 + i), source: 'fb' })) };
r = get('salesReportA', tokOf('tester'));
ok(r.total === 123 && r.ordersDetail.length === 5 && r._demo === true, 'bao cao A: so tong day du, chi tiet cat con 5 dong');
ok(r.ordersDetail.every(x => /0000$/.test(x.phone)), 'bao cao A: SDT trong chi tiet bi che (du lieu khong loc duoc theo sale)');
// 8) Che SDT bat bang Settings demoMaskPhone=1
settings.demoMaskPhone = '1';
r = get('customers', tokOf('tester'));
ok(r.rows.every(x => /0000$/.test(x.phone)), 'demoMaskPhone=1: SDT danh sach bi che');
settings.demoMaskPhone = '';
// 9) Tai khoan thuong khong bi anh huong
r = get('customers', tokOf('csuser'));
ok(coreCalls.indexOf('customers') !== -1 && !r._demoScoped, 'tai khoan CS thuong: KHONG di nhanh test');
// 10) POST: tai khoan test khong ghi duoc, KE CA khi bo truong demo, chi gui token phien
r = post({ action: 'saveSingle', token: tokOf('tester'), phone: '0911000001' });
ok(r.code === 'FORBIDDEN' && postCore === false, 'POST saveSingle voi token test (khong co truong demo): bi chan, khong chay doPostCore_');
r = post({ action: 'setSetting', token: tokOf('tester'), key: 'x', value: 'y' });
ok(r.code === 'FORBIDDEN' && postCore === false, 'POST setSetting voi token test: bi chan');
r = post({ action: 'setGasSource', token: tokOf('tester') });
ok(postCore === false, 'POST setGasSource voi token test: khong chay (ngoai ra con can adminKey)');
r = post({ action: 'saveSingle', token: tokOf('csuser'), phone: '0911000001' });
ok(postCore === true && r.wrote === true, 'POST cua tai khoan CS thuong van ghi binh thuong');
// 11) Lay ma GAS: khong adminKey thi tai khoan test khong lay duoc (nhanh demo chan truoc; thuong chan boi adminKey)
r = get('getGasSource', tokOf('tester'), { adminKey: 'doan' });
ok(!!r.error && coreCalls.length === 0, 'getGasSource kem adminKey doan mo: bi chan, khong tra ma nguon');

console.log(fails ? '\n' + fails + ' TEST FAIL' : '\nALL DEMO SCOPE TESTS PASSED');
process.exit(fails ? 1 : 0);
