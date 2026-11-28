// Test chuan hoa ten goc theo Pancake cho tai khoan DA CO (js/99-acct-pk-normalize.js + _pkOrigNameOf_/_acctPancakeFirst_ o js/15).
const fs = require('fs'), vm = require('vm');
function fnOf(src, name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('khong thay ' + name); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
const s15 = fs.readFileSync('js/15-fn-hidelogin.js', 'utf8'), s99 = fs.readFileSync('js/99-acct-pk-normalize.js', 'utf8');
const ctx = { _pkState: { nameMap: {} } }; vm.createContext(ctx);
vm.runInContext(['_pkOrigNameOf_', '_acctPancakeFirst_'].map(n => fnOf(s15, n)).join('\n') + '\n' + ['_apnFold_', '_acctPkNormPlan_', '_acctPkNormApply_'].map(n => fnOf(s99, n)).join('\n'), ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
const namesOf = a => a.names || [], rb = r => r;
// Ca thuc te Duyen: yennth + yenNTH2004 la 1 nguoi; ten Pancake = yennth
ctx._pkState.nameMap = { 'yennth': 'yenNTH2004', 'Ninh Nga': 'ninhnga99', 'Chung': 'a|b' };
const acc = [
  { username: 'yen', role: 'cs', name: 'yenNTH2004', names: ['yenNTH2004', 'yennth'], active: true },
  { username: 'nga', role: 'cs', name: 'ninhnga99', names: ['ninhnga99'], active: true },
  { username: 'ok1', role: 'cs', name: 'yennth2', names: ['yennth2'], active: true },
  { username: 'adm', role: 'admin', name: 'Admin', names: ['Admin'], active: true },
  { username: 'off', role: 'cs', name: 'yenNTH2004', names: ['yenNTH2004'], active: false },
  { username: 'sh', role: 'cs', name: 'a', names: ['a'], active: true },
];
let plan = ctx._acctPkNormPlan_(acc, namesOf, rb);
const by = Object.fromEntries(plan.map(p => [p.username, p]));
ok(by.yen && by.yen.newName === 'yennth' && by.yen.newNames.join() === 'yennth,yenNTH2004' && !by.yen.added, 'yen: ten chinh yenNTH2004 -> yennth, giu du 2 ten, khong them moi');
ok(by.nga && by.nga.newName === 'Ninh Nga' && by.nga.added && by.nga.newNames.join() === 'Ninh Nga,ninhnga99', 'nga: THEM ten Pancake Ninh Nga len dau, giu ninhnga99');
ok(!by.ok1, 'tai khoan khong co Khop ten Pancake -> bo qua');
ok(!by.adm && !by.off, 'admin va tai khoan khoa khong bi dong toi');
ok(!by.sh, 'ten Pancake chia cho nhieu nguoi (a|b, chi a la cua tai khoan) -> KHONG lay lam goc');
// da chuan -> khong de xuat
const acc2 = [{ username: 'yen', role: 'cs', name: 'yennth', names: ['yennth', 'yenNTH2004'], active: true }];
ok(ctx._acctPkNormPlan_(acc2, namesOf, rb).length === 0, 'da chuan (names[0] la ten Pancake) -> khong de xuat lai');
// ten goc co names[0] dung nhung a.name lech -> van de xuat de dong bo
ok(ctx._acctPkNormPlan_([{ username: 'yen', role: 'cs', name: 'yenNTH2004', names: ['yennth', 'yenNTH2004'], active: true }], namesOf, rb).length === 1, 'names[0] dung nhung name lech -> de xuat dong bo');
// ten Pancake se THEM dang thuoc tai khoan khac -> dupes
const acc3 = acc.concat([{ username: 'nga2', role: 'cs', name: 'Ninh Nga', names: ['Ninh Nga', 'x'], active: true }]);
plan = ctx._acctPkNormPlan_(acc3, namesOf, rb);
ok((plan.find(p => p.username === 'nga').dupes || []).length === 1 && plan.find(p => p.username === 'nga').dupes[0].other === 'nga2', 'ten se them dang thuoc tai khoan khac -> canh bao dupes');
// Ap dung
const teamOf = n => (n === 'yennth' ? { name: 'TeamA' } : null);
const accA = JSON.parse(JSON.stringify(acc));
const n = ctx._acctPkNormApply_(accA, [by.yen], teamOf);
ok(n === 1 && accA[0].name === 'yennth' && accA[0].names.join() === 'yennth,yenNTH2004' && accA[0].team === 'TeamA', 'ap dung: doi name/names, cap nhat team khi tim thay');
ok(accA[1].name === 'ninhnga99' && accA[1].names.join() === 'ninhnga99', 'tai khoan khong tick giu nguyen');
const accB = [{ username: 'yen', role: 'cs', name: 'yenNTH2004', names: ['yenNTH2004', 'yennth'], team: 'Cu', active: true }];
ctx._acctPkNormApply_(accB, [by.yen], () => null);
ok(accB[0].team === 'Cu', 'khong tim thay team -> GIU team cu (khong xoa)');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);
