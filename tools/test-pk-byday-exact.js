#!/usr/bin/env node
// Test GAS _pkApplyRealDaily_: byDay dung so THAT Page x ngay (sheet By time) khi co, thay vi tong da rai/lam tron theo NV. Chay: node tools/test-pk-byday-exact.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const i = src.search(/function _pkApplyRealDaily_\(/); let d = 0, j = src.indexOf('{', i), e = 0; for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) { e = k; break; } } }
const ctx = { normOrderDate_: v => String(v || '') }; vm.createContext(ctx); vm.runInContext(src.slice(i, e + 1), ctx);
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const L = [{ date: '2026-08-01', pageId: 'P', tongTT: 14, tongDH: 1, est: 1 }, { date: '2026-08-02', pageId: 'P', tongTT: 10, tongDH: 0, est: 2 }, { date: '2026-08-03', pageId: 'P', tongTT: 9, tongDH: 1, est: 0 }, { date: '2026-08-01', pageId: 'Q', tongTT: 5, tongDH: 0, est: 1 }];
const daily = [['2026-08-01', 'P', 'Page P', 0, 0, 11, 0, 0, 0, 0, 0, 2], ['2026-08-03', 'P', 'Page P', 0, 0, 99, 0, 0, 0, 0, 0, 9]];
const n = ctx._pkApplyRealDaily_(L, daily);
ok(n === 1 && L[0].tongTT === 11 && L[0].tongDH === 2 && L[0].est === 0, 'ngay da rai + co so that → dung so that, het uoc tinh');
ok(L[1].tongTT === 10 && L[1].est === 2, 'ngay chi co uoc tinh (khong co so that) → giu nguyen');
ok(L[2].tongTT === 9 && L[2].est === 0, 'ngay vi du dong NV that (est=0) khong bi de len');
ok(L[3].tongTT === 5 && L[3].est === 1, 'Page khac khong co so that → giu nguyen');
ok(ctx._pkApplyRealDaily_(null, null) === 0 && ctx._pkApplyRealDaily_([], []) === 0, 'rong/null khong loi');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
