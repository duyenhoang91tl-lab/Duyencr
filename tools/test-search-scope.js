// Test: tra cuu chu dich (via=search) khong bi chan boi scopeMode=enforce; request thuong van bi chan. (2026-10-21)
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const notes = [];
const ctx = { SCOPE_ACTIONS_: { lookup: 1, donOrdersByPhone: 1, cskhDetail: 1 }, SCOPE_LIST_ACTIONS_: { searchOrder: 1, customers: 1 },
  _scopeMode_: () => 'enforce', _sessUser_: () => ({ username: 'sale1', role: 'cs', names: ['Sale A'] }),
  _scopeVerdict_: (u, ph) => ph === '0900000001', _scopeNote_: (u, a, ph, v) => notes.push(a + ':' + v), console };
vm.createContext(ctx);
vm.runInContext(grab('_scopeGate_'), ctx);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
ok(ctx._scopeGate_('lookup', 't', '0900000002') && ctx._scopeGate_('lookup', 't', '0900000002').code === 'FORBIDDEN', 'khach ngoai pham vi, khong via -> van FORBIDDEN');
ok(ctx._scopeGate_('lookup', 't', '0900000002', 'search') === null, 'khach ngoai pham vi + via=search -> cho qua');
ok(ctx._scopeGate_('donOrdersByPhone', 't', '0900000002', 'search') === null, 'donOrdersByPhone + via=search -> cho qua');
ok(ctx._scopeGate_('lookup', 't', '0900000001') === null, 'khach trong pham vi -> cho qua');
ok(notes.indexOf('lookup:search-out') >= 0, 'ghi log search-out');
// searchOrder khong bi loc: _scopeListServe_ tra null ngay (khong goi doGetCore_)
const body = grab('_scopeListServe_');
ok(/action === 'searchOrder'\)[^;]*;[^;]*return null/.test(body.replace(/\n/g, ' ')) && body.indexOf("search-unfiltered") > 0, 'searchOrder bo qua loc pham vi');
// chuoi gate trong doGet truyen p.via
ok(src.indexOf('_scopeGate_(action, p.token, p.phone, p.via)') > 0, 'doGet truyen p.via vao _scopeGate_');
process.exit(fail ? 1 : 0);
