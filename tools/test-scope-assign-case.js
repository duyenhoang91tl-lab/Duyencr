// Test GAS: dot chia ghi ten khac hoa/thuong voi ten tai khoan van thuoc pham vi CS (_scopeVerdict_).
const fs = require('fs'), vm = require('vm');
const s = fs.readFileSync('gas_v13.js', 'utf8');
function fn(name){ const i = s.search(new RegExp('function ' + name + '\\s*\\(')); let j = s.indexOf('{', i), d = 0; for (let k = j; k < s.length; k++){ if (s[k] == '{') d++; else if (s[k] == '}'){ d--; if (!d) return s.slice(i, k + 1); } } }
function run(assignNames, userNames, phone, groups){
  const ctx = { console, _leadMonths_: () => [], _scopeAllowedNames_: u => { const o = {}; u.names.forEach(n => o[n] = 1); return o; },
    _scopeNamesForPhone_: () => ({}), _scopeAssignIndex_: () => ({ '0901': assignNames }), normPhone_: p => String(p), _phoneHasOrderInMonths_: () => false, _leadOwnNames_: () => ({}), Logger: { log(){} }, _userAliasGroups_: () => groups || {} };
  vm.createContext(ctx); vm.runInContext(fn('_normTxt_') + '\n' + fn('_stripVN_') + '\n' + fn('_scopeNameKey_') + '\n' + fn('_scopeSameNameKeys_') + '\n' + fn('_scopeVerdict_'), ctx);
  ctx.u = { role: 'cs', names: userNames }; return vm.runInContext("_scopeVerdict_(u, '" + phone + "')", ctx);
}
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
ok(run(['ngocnm'], ['ngocnm'], '0901') === true, 'dung ten -> trong pham vi');
ok(run(['Ngocnm'], ['ngocnm'], '0901') === true, "dot chia 'Ngocnm', tai khoan 'ngocnm' -> trong pham vi");
ok(run([' NGOCNM '], ['ngocnm'], '0901') === true, 'viet hoa + du khoang trang -> trong pham vi');
ok(run(['nguoikhac'], ['ngocnm'], '0901') === false, 'dot chia cho nguoi khac -> NGOAI pham vi');
ok(run([], ['ngocnm'], '0901') === false, 'khong co dot chia -> NGOAI pham vi');
// 2026-11-26: ten hien thi co dau + khoang trang vs tai khoan khong khoang trang
ok(run(['Lê Phương Anh'], ['lephuonganh'], '0901') === true, "dot chia 'Lê Phương Anh', tai khoan 'lephuonganh' -> trong pham vi");
ok(run(['Le Phuong Anh'], ['lephuonganh'], '0901') === true, "khong dau 'Le Phuong Anh' -> trong pham vi");
ok(run(['Lê Phương Anh'], ['tuoipham1993'], '0901') === false, 'ten khac hoan toan -> NGOAI pham vi');
// 2026-11-26 (lan 3): dot chia ghi TEN THE (Khop sale) cua tai khoan -> trong pham vi
const G = { thuydinh1995: ['thuydinh1995', 'thuydinh95'], thuydinh95: ['thuydinh1995', 'thuydinh95'] };
ok(run(['thuydinh95'], ['thuydinh1995'], '0901') === false, 'chua noi the: dot chia ten the khong khop tai khoan -> NGOAI pham vi (tai hien loi)');
ok(run(['thuydinh95'], ['thuydinh1995'], '0901', G) === true, 'da noi the Khop sale -> trong pham vi');
ok(run(['Thuydinh95'], ['thuydinh1995'], '0901', G) === true, 'ten the viet hoa -> trong pham vi');
ok(run(['thuydinh95'], ['tuoipham1993'], '0901', G) === false, 'tai khoan khac -> NGOAI pham vi (khong lo data)');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);
