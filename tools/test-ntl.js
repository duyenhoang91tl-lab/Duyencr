#!/usr/bin/env node
// Test Node cho BUOC 3 cua docs/SECURITY-PLAN.md: log request du lieu KHONG co token hop le (_ntlNote_/_ntlReport_). Khong goi mang that.
// Chay: node tools/test-ntl.js  -> "ALL NTL TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const mapSrc = src.slice(src.indexOf('var NTL_ACTIONS_ ='), src.indexOf('function _ntlKey_'));
const secret = 'test-secret';
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
let store = {}, failCache = false;
const ctx = {
  CacheService: { getScriptCache: () => ({
    get: k => { if (failCache) throw new Error('cache down'); return store[k] ?? null; },
    put: (k, v) => { if (failCache) throw new Error('cache down'); store[k] = v; } }) },
  Utilities: { formatDate: () => '20261011', base64EncodeWebSafe: x => b64u(x), base64DecodeWebSafe: x => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    computeHmacSha256Signature: (m, k) => crypto.createHmac('sha256', k).update(m).digest(), newBlob: b => ({ getDataAsString: () => b.toString() }) },
  Logger: { log() {} }, jsonOut_: o => o
};
vm.createContext(ctx);
// _sessVerify_ that, nhung bi mat lay tu bien test (khong dung Script Properties)
vm.runInContext(mapSrc + '\n' + fn('_ntlKey_') + fn('_secEq_') + fn('_ntlNote_') + fn('_ntlReport_') +
  `var _sessSecret_ = function(){ return ${JSON.stringify(secret)}; };\n` + fn('_sessSign_') + fn('_sessVerify_'), ctx);
const mk = (u, e) => { const b = b64u(JSON.stringify({ u, e })); return b + '.' + b64u(crypto.createHmac('sha256', secret).update(b).digest()); };
const good = mk('duyen', Date.now() + 1e6), expired = mk('duyen', Date.now() - 1);

// 1) action khong theo doi -> bo qua
ctx._ntlNote_('GET', 'priceSearch', '', 'web');
ok(Object.keys(store).length === 0, 'action ngoai danh sach khong duoc ghi');
// 2) khong token / token sai / het han -> NO-TOKEN ; token dung -> token
ctx._ntlNote_('GET', 'customers', '', 'zalo');
ctx._ntlNote_('GET', 'customers', 'abc.def', 'zalo');
ctx._ntlNote_('GET', 'customers', expired, 'zalo');
ctx._ntlNote_('GET', 'customers', good + 'x', 'zalo');   // chu ky bi sua
ctx._ntlNote_('GET', 'customers', good, 'web');
ctx._ntlNote_('POST', 'saveSingle', '', undefined);
let r = ctx._ntlReport_();
const get = k => (r.rows.find(x => x.k === k) || {}).n;
ok(get('GET customers | src=zalo | NO-TOKEN') === 4, 'dem NO-TOKEN customers/zalo phai = 4, got ' + get('GET customers | src=zalo | NO-TOKEN'));
ok(get('GET customers | src=web | token') === 1, 'token dung phai tinh la token');
ok(get('POST saveSingle | src=? | NO-TOKEN') === 1, 'src thieu = ?');
ok(r.noTokenTotal === 5 && r.tokenTotal === 1, 'tong ' + r.noTokenTotal + '/' + r.tokenTotal);
ok(r.rows[0].k.indexOf('NO-TOKEN') >= 0 && r.rows[r.rows.length - 1].k.indexOf('| token') >= 0, 'NO-TOKEN phai len dau');
ok(r.date === '20261011', 'ngay: ' + r.date);
// 3) src co ky tu la bi lam sach, dai bi cat
ctx._ntlNote_('GET', 'lookup', '', 'we<b>b/../../x'.repeat(5));
ok(Object.keys(JSON.parse(store.ntl_20261011)).every(k => !/[<>\/]/.test(k)), 'src phai duoc lam sach');
// 4) chan phinh to: >200 khoa khac nhau thi ngung them
store = {};
for (let i = 0; i < 260; i++) ctx._ntlNote_('GET', 'customers', '', 's' + i);
ok(Object.keys(JSON.parse(store.ntl_20261011)).length <= 201, 'bo dem khong duoc phinh qua 200 khoa');
// 5) cache loi -> KHONG nem loi ra ngoai (khong lam hong request that)
failCache = true;
let threw = false; try { ctx._ntlNote_('GET', 'customers', '', 'web'); } catch (e) { threw = true; }
ok(!threw, 'loi cache bi nuot');
// 6) du lieu cache hong -> khong nem loi, dem lai tu dau
failCache = false; store = { ntl_20261011: '{hong' };
ctx._ntlNote_('GET', 'customers', '', 'web');
ok(ctx._ntlReport_().noTokenTotal === 1, 'cache hong thi dem lai tu 1');
// 7) doGet/doPost that su goi _ntlNote_ (khong bi bo sot khi sua sau nay)
ok(/_ntlNote_\('GET', action, p\.token, p\.src\);\s*\n\s*return doGetCore_\(e\);/.test(src), 'doGet phai goi _ntlNote_ truoc doGetCore_');
ok(/_ntlNote_\('POST', d0\.action, d0\.token, d0\.src\)/.test(src), 'doPost phai goi _ntlNote_');
ok(!/_ntlNote_\('GET'[^\n]*\n[^\n]*_demoClip_/.test(src), 'tai khoan demo khong duoc di qua log');
// 8) moi action trong danh sach theo doi la action that (grep doGetCore_/doPostCore_)
const names = Object.keys(JSON.parse(JSON.stringify(vm.runInContext('NTL_ACTIONS_', ctx))));
const missing = names.filter(a => src.indexOf("action === '" + a + "'") < 0);
ok(missing.length === 0, 'action khong ton tai trong code: ' + missing.join(','));
console.log('ALL NTL TESTS PASSED (' + names.length + ' action duoc theo doi)');
