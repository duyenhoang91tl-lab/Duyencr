// Test (2026-11-26, lan 5): dot chia ghi TEN DANG NHAP (vd 'thaoptp') nhung tai khoan co ten hien thi khac (names=['Pham Thi Thao'])
// -> server phai coi username la 1 ten cua tai khoan (client js/08 da coi nhu vay) -> khach nam trong pham vi, danh sach KH co khach.
const fs = require('fs'), vm = require('vm');
const s = fs.readFileSync('gas_v13.js', 'utf8');
function fn(src, name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('no ' + name); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
function ctxFor(user, assignNames){
  const ctx = { console, Logger: { log(){} }, _leadMonths_: () => [], _scopeNamesForPhone_: () => ({}), _scopeAssignIndex_: () => ({ '0901': assignNames }),
    normPhone_: p => String(p), _phoneHasOrderInMonths_: () => false, _userAliasGroups_: () => ({}), _viewExtraNames_: () => ({ names: [] }),
    readTeams_: () => [], getCrmSS_: () => ({ getSheetByName: () => null }), SH_TEAM: 'Team' };
  vm.createContext(ctx);
  vm.runInContext(['_normTxt_', '_stripVN_', '_scopeNameKey_', '_scopeSameNameKeys_', '_scopeVerdict_', '_scopeAllowedNames_', '_leadOwnNames_'].map(n => fn(s, n)).join('\n'), ctx);
  ctx.u = user; return ctx;
}
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
const V = (u, a) => vm.runInContext("_scopeVerdict_(u, '0901')", ctxFor(u, a));
const A = u => { const r = vm.runInContext('_scopeAllowedNames_(u)', ctxFor(u, [])); return r === null ? null : Object.keys(r); };
// Ca loi that: ten hien thi khac ten dang nhap, dot chia ghi ten dang nhap
ok(V({ role: 'cs', username: 'thaoptp', names: ['Pham Thi Thao'] }, ['thaoptp']) === true, "names=['Pham Thi Thao'], dot chia 'thaoptp' -> TRONG pham vi");
ok(V({ role: 'cs', username: 'thaoptp', name: 'Pham Thi Thao' }, ['Thaoptp']) === true, 'chi co name, dot chia viet hoa username -> trong pham vi');
ok(V({ role: 'cs', username: 'thaoptp', names: [], name: '' }, ['thaoptp']) === true, 'tai khoan khong co ten nao, dot chia theo username -> trong pham vi');
ok(V({ role: 'manager', username: 'thaoptp', names: ['Pham Thi Thao'] }, ['thaoptp']) === true, 'manager cung vay');
// Khong lo data
ok(V({ role: 'cs', username: 'thaoptp', names: ['Pham Thi Thao'] }, ['nguoikhac']) === false, 'dot chia cho nguoi khac -> NGOAI pham vi');
ok(V({ role: 'cs', username: 'thaoptp', names: ['Pham Thi Thao'] }, []) === false, 'khong co dot chia -> NGOAI pham vi');
ok(V({ role: 'cs', username: 'lephuonganh', names: ['Le Phuong Anh'] }, ['thaoptp']) === false, 'tai khoan khac khong thay data cua thaoptp');
// Ca cu van dung
ok(V({ role: 'cs', username: 'lephuonganh', names: ['lephuonganh'] }, ['Lê Phương Anh']) === true, 'ca Le Phuong Anh (da chay) van dung');
ok(V({ role: 'admin', username: 'x' }, []) === true, 'admin khong gioi han');
ok(V({ role: 'viewer', username: 'x' }, []) === true, 'viewer khong gioi han');
ok(A({ role: 'cs', username: 'thaoptp', names: ['Pham Thi Thao'] }).sort().join() === 'Pham Thi Thao,thaoptp', '_scopeAllowedNames_ = names + username');
ok(A({ role: 'viewer', username: 'x' }) === null, 'viewer -> null (khong gioi han)');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);
