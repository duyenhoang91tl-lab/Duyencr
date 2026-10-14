#!/usr/bin/env node
// Test Node cho BUOC 4b cua docs/SECURITY-PLAN.md: cong tac bat buoc xac thuc (_enforceCheck_) + hook doGet/doPost. Khong goi mang that.
// Chay: node tools/test-enforce.js -> "ALL ENFORCE TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const secret = 'test-secret', b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
let cacheStore = {}, props = {}, propReads = 0;
const ctx = {
  CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] ?? null, put: (k, v) => { cacheStore[k] = v; }, remove: k => { delete cacheStore[k]; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => { propReads++; return props[k] ?? null; }, setProperty: (k, v) => { props[k] = v; } }) },
  Utilities: { getUuid: () => crypto.randomUUID(), base64EncodeWebSafe: x => b64u(x), base64DecodeWebSafe: x => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    computeHmacSha256Signature: (m, k) => crypto.createHmac('sha256', k).update(m).digest(), newBlob: b => ({ getDataAsString: () => b.toString() }) },
  Logger: { log() {} }
};
vm.createContext(ctx);
const mapSrc = src.slice(src.indexOf('var NTL_ACTIONS_ ='), src.indexOf('function _ntlKey_'));
const encSrc = src.slice(src.indexOf('var EXT_ALLOWED_ ='), src.indexOf('function _enfModes_'));
vm.runInContext(mapSrc + encSrc + 'var ENF_SOURCES_ = ["web","zalo","pancake","other"]; var EXT_KEY_NAMES_ = ["zalo","pancake"];\n' +
  fn('_secEq_') + fn('_extKeys_') + fn('_extKeyNew_') + fn('_extKeyEnsure_') + fn('_extKeyWho_') + fn('_enfModes_') + fn('_enfSet_') + fn('_srcBucket_') + fn('_enforceCheck_') + fn('xemTrangThaiChan') +
  fn('batChanWeb') + fn('tatChanWeb') + fn('batChanZalo') + fn('tatChanZalo') + fn('batChanPancake') + fn('tatChanPancake') + fn('batChanKhac') + fn('tatChanKhac') + fn('xemBiMatPhien') +
  `var _sessSecret_ = function(){ return ${JSON.stringify(secret)}; };\n` + fn('_sessSign_') + fn('_sessVerify_'), ctx);
const mk = (u, e) => { const b = b64u(JSON.stringify({ u, e })); return b + '.' + b64u(crypto.createHmac('sha256', secret).update(b).digest()); };
const good = mk('duyen', Date.now() + 1e6), expired = mk('duyen', Date.now() - 1);
const keys = ctx._extKeyEnsure_();
const chk = (action, token, ek, srcName) => ctx._enforceCheck_(action, token, ek, srcName);

// 1) MAC DINH TAT: khong anh huong gi (ke ca khong token)
ok(chk('customers', '', '', 'web') === null && chk('deleteOrder', '', '', undefined) === null, 'mac dinh tat -> cho qua het');
// 2) action ngoai danh sach theo doi luon qua (users, verifyLogin, webLogin...)
ctx.batChanWeb(); ctx.batChanZalo(); ctx.batChanPancake(); ctx.batChanKhac();
ok(chk('users', '', '', 'web') === null && chk('webLogin', '', '', 'web') === null && chk('getSetting', '', '', '') === null, 'action ngoai NTL luon qua');
// 3) bat ca 4: web
ok(chk('customers', good, '', 'web') === null, 'token hop le qua');
let r = chk('customers', '', '', 'web'); ok(r && r.code === 'AUTH', 'web khong token bi chan');
ok(chk('customers', expired, '', 'web').code === 'AUTH', 'token het han bi chan');
ok(chk('customers', good + 'x', '', 'web').code === 'AUTH', 'token sua chu ky bi chan');
ok(chk('deleteOrder', 'abc.def', '', 'web').code === 'AUTH', 'token rac bi chan');
// 4) extension co khoa dung: chi action trong danh sach
ok(chk('lookup', '', keys.zalo, 'zalo') === null && chk('deleteDuplicateOrders', '', keys.zalo, 'zalo') === null, 'zalo: action cho phep qua');
r = chk('deleteOrder', '', keys.zalo, 'zalo'); ok(r && r.code === 'FORBIDDEN', 'zalo: deleteOrder bi tu choi du khoa dung');
ok(chk('replaceOrders', '', keys.pancake, 'pancake').code === 'FORBIDDEN' && chk('saveUsers', '', keys.pancake, 'pancake') === null, 'pancake: replaceOrders bi chan (saveUsers khong thuoc NTL, co co che rieng)');
ok(chk('toggleAssignDone', '', keys.pancake, 'pancake') === null && chk('toggleAssignDone', '', keys.zalo, 'zalo').code === 'FORBIDDEN', 'danh sach cho phep rieng tung extension');
// 5) khoa tin vao KHOA chu khong tin src tu khai
ok(chk('lookup', '', keys.zalo, 'web') === null, 'khoa zalo nhung khai src=web -> van theo khoa zalo');
ok(chk('toggleAssignDone', '', keys.pancake, 'zalo') === null, 'khoa pancake khai src=zalo -> theo khoa pancake');
// 6) khoa sai / khong khoa -> nhu khong xac thuc
ok(chk('lookup', '', 'ek_saisai', 'zalo').code === 'AUTH' && chk('lookup', '', '', 'zalo').code === 'AUTH', 'khoa sai / khong khoa bi chan');
// 7) gia src la / thieu src -> bucket other
ok(chk('customers', '', '', undefined).code === 'AUTH' && chk('customers', '', '', 'hacker').code === 'AUTH' && chk('customers', '', '', 'worker').code === 'AUTH', 'src la/thieu/worker -> chan theo nguon other');
// 8) tat tung nguon: chi nguon do duoc qua
ctx.tatChanZalo(); ctx.tatChanKhac();
ok(chk('lookup', '', '', 'zalo') === null, 'tat zalo -> request src=zalo khong khoa qua (giai doan chuyen tiep)');
ok(chk('customers', '', '', 'web').code === 'AUTH' && chk('customers', '', '', 'pancake').code === 'AUTH', 'web/pancake van chan');
ok(chk('customers', '', '', 'hacker') === null, 'tat other -> src la qua (can bat khac moi het ke gia src)');
ok(chk('deleteOrder', '', keys.zalo, 'zalo') === null, 'zalo tat -> khoa dung cung khong bi gioi han action');
// 9) tat het -> tro lai nhu cu
ctx.tatChanWeb(); ctx.tatChanPancake();
ok(chk('customers', '', '', 'web') === null && chk('deleteOrder', '', '', 'x') === null, 'tat het -> cho qua het');
// 10) cong tac luu o Script Properties; bo nho dem 20s: doi cong tac xoa dem ngay
ok(JSON.parse(props.enforceModes).web === 0, 'luu Script Properties');
ctx.batChanWeb(); ok(chk('customers', '', '', 'web').code === 'AUTH', 'bat lai co hieu luc ngay trong cung process (dem bi xoa)');
// 11) bo nho dem giam doc Properties
ctx.batChanWeb(); propReads = 0; for (let i = 0; i < 50; i++) chk('customers', '', '', 'web'); ok(propReads <= 1, 'doc Properties toi da 1 lan / 50 request, got ' + propReads);
// 12) du lieu cong tac hong -> coi nhu TAT (khong chan nham ca he thong)
cacheStore = {}; props.enforceModes = '{hong'; ok(chk('customers', '', '', 'web') === null, 'cau hinh hong -> tat het');
// 13) nguon khong hop le bi tu choi
let thr = false; try { ctx._enfSet_('hack', true); } catch (e) { thr = true; } ok(thr, 'ten nguon la bi tu choi');
// 14) hook that su nam trong doGet/doPost, SAU _ntlNote_ va SAU cac kiem tra demo/saveUsers (khong bi bo sot khi sua sau nay)
ok(/_ntlNote_\('GET'[^\n]*\n\s*var _denG = _enforceCheck_\(action, p\.token, p\.ek, p\.src\);\s*\n\s*if \(_denG\) return jsonOut_\(_denG\);\s*\n(?:\s*var _gateErr = _featureGate_\(action, p\.token\);\s*\n\s*if \(_gateErr\) return jsonOut_\(_gateErr\);\s*\n)?(?:\s*var _ownErr = _ownerGate_\(action, p\.token\);\s*\n\s*if \(_ownErr\) return jsonOut_\(_ownErr\);\s*\n)?(?:\s*var _scpErr = _scopeGate_\(action, p\.token, p\.phone\);\s*\n\s*if \(_scpErr\) return jsonOut_\(_scpErr\);\s*\n)?\s*return doGetCore_\(e\);/.test(src), 'doGet phai goi _enforceCheck_ truoc doGetCore_');
ok(/_ntlNote_\('POST'[^\n]*\n\s*var _denP = _enforceCheck_\(d0\.action, d0\.token, d0\.ek, d0\.src\);\s*\n\s*if \(_denP\) return jsonOut_\(_denP\);\s*\n(?:\s*var _ownP = _ownerGate_\(d0\.action, d0\.token\);\s*\n\s*if \(_ownP\) return jsonOut_\(_ownP\);\s*\n)?\s*\}\s*\n\s*return doPostCore_\(e\);/.test(src), 'doPost phai goi _enforceCheck_ truoc doPostCore_');
// 15) moi action trong EXT_ALLOWED_ la action that va nam trong NTL_ACTIONS_ (khong ghi nham ten)
const allowed = vm.runInContext('EXT_ALLOWED_', ctx), tracked = vm.runInContext('NTL_ACTIONS_', ctx);
for (const e of Object.keys(allowed)) for (const a of Object.keys(allowed[e])) ok(tracked[a] === 1, e + ' cho phep "' + a + '" nhung khong nam trong NTL_ACTIONS_');
// 16) extension that su goi cac action nay (doi chieu code extension) — danh sach cho phep khong duoc thieu action extension dang dung
const used = (dir) => { const out = new Set(); for (const f of fs.readdirSync(path.join(__dirname, '..', dir)).filter(f => f.endsWith('.js'))) { const t = fs.readFileSync(path.join(__dirname, '..', dir, f), 'utf8'); for (const m of t.matchAll(/action=(\w+)|action\s*:\s*['"](\w+)['"]/g)) out.add(m[1] || m[2]); } return out; };
for (const [e, dir] of [['zalo', 'extension-zalo'], ['pancake', 'extension-pancake']]) {
  const miss = [...used(dir)].filter(a => tracked[a] === 1 && allowed[e][a] !== 1);
  ok(miss.length === 0, 'extension ' + e + ' dang goi action chua nam trong danh sach cho phep: ' + miss.join(','));
}
console.log('ALL ENFORCE TESTS PASSED');
