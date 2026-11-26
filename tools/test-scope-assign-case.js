// Test GAS: dot chia ghi ten khac hoa/thuong voi ten tai khoan van thuoc pham vi CS (_scopeVerdict_).
const fs = require('fs'), vm = require('vm');
const s = fs.readFileSync('gas_v13.js', 'utf8');
function fn(name){ const i = s.search(new RegExp('function ' + name + '\\s*\\(')); let j = s.indexOf('{', i), d = 0; for (let k = j; k < s.length; k++){ if (s[k] == '{') d++; else if (s[k] == '}'){ d--; if (!d) return s.slice(i, k + 1); } } }
function run(assignNames, userNames, phone){
  const ctx = { console, _leadMonths_: () => [], _scopeAllowedNames_: u => { const o = {}; u.names.forEach(n => o[n] = 1); return o; },
    _scopeNamesForPhone_: () => ({}), _scopeAssignIndex_: () => ({ '0901': assignNames }), normPhone_: p => String(p), _phoneHasOrderInMonths_: () => false, _leadOwnNames_: () => ({}) };
  vm.createContext(ctx); vm.runInContext(fn('_normTxt_') + '\n' + fn('_scopeVerdict_'), ctx);
  ctx.u = { role: 'cs', names: userNames }; return vm.runInContext("_scopeVerdict_(u, '" + phone + "')", ctx);
}
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
ok(run(['ngocnm'], ['ngocnm'], '0901') === true, 'dung ten -> trong pham vi');
ok(run(['Ngocnm'], ['ngocnm'], '0901') === true, "dot chia 'Ngocnm', tai khoan 'ngocnm' -> trong pham vi");
ok(run([' NGOCNM '], ['ngocnm'], '0901') === true, 'viet hoa + du khoang trang -> trong pham vi');
ok(run(['nguoikhac'], ['ngocnm'], '0901') === false, 'dot chia cho nguoi khac -> NGOAI pham vi');
ok(run([], ['ngocnm'], '0901') === false, 'khong co dot chia -> NGOAI pham vi');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);
