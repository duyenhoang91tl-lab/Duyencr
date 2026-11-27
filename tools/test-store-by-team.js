// Test: _storeCaseByTeam_ (GAS) gom phan Sale 30% khach qua cua hang THEO TEAM cho Bao cao B "Theo Team Sale".
const fs = require('fs'), vm = require('vm');
const s = fs.readFileSync('gas_v13.js', 'utf8');
const i = s.search(/function _storeCaseByTeam_\s*\(/); let j = s.indexOf('{', i), d = 0, e = j;
for (let k = j; k < s.length; k++){ if (s[k] == '{') d++; else if (s[k] == '}'){ d--; if (!d){ e = k + 1; break; } } }
const ctx = {}; vm.createContext(ctx); vm.runInContext(s.slice(i, e), ctx);
const team = { An: 'Team 1', Binh: 'Team 1', Chi: 'Team 2' };
const rows = [
  { koDen: false, orders: [ { excluded: false, credits: [ { sale: 'An', amount: 300, dup: false }, { sale: 'Binh', amount: 300, dup: false }, { sale: 'Chi', amount: 300, dup: false } ] } ] },
  { koDen: true,  orders: [ { excluded: false, credits: [ { sale: 'An', amount: 999, dup: false } ] } ] },            // khach KHONG den -> bo
  { koDen: false, orders: [ { excluded: true,  credits: [ { sale: 'Chi', amount: 999, dup: false } ] } ] },          // don hoan -> bo
  { koDen: false, orders: [ { excluded: false, credits: [ { sale: 'An', amount: 500, dup: true } ] } ] },            // trung the Pos -> bo
  { koDen: false, orders: [ { excluded: false, credits: [ { sale: 'La', amount: 100, dup: false } ] } ] }            // sale chua co team
];
const out = ctx._storeCaseByTeam_(rows, n => team[n] || '', '(chua co Team)');
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
const by = {}; out.forEach(x => by[x.name] = x);
ok(by['Team 1'] && by['Team 1'].amount === 600, 'Team 1 = 300 (An) + 300 (Binh) = 600');
ok(by['Team 1'].orders === 1, 'Team 1: 2 sale cung team tren 1 don chi dem 1 don');
ok(by['Team 2'] && by['Team 2'].amount === 300 && by['Team 2'].orders === 1, 'Team 2 = 300, 1 don (don hoan khong tinh)');
ok(by['(chua co Team)'] && by['(chua co Team)'].amount === 100, 'sale chua co team -> (chua co Team)');
ok(out.reduce((a, x) => a + x.amount, 0) === 1000, 'tong = 1000 (khach khong den / hoan / trung khong cong)');
ok(out[0].name === 'Team 1', 'sap xep giam dan theo tien');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);
