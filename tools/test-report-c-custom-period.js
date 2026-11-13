#!/usr/bin/env node
// Test ky tuy chinh Bao cao C doc duoc ngay 'yyyy-MM-dd' (o <input type=date>) lan 'dd/MM/yyyy'. Chay: node tools/test-report-c-custom-period.js
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const grab = n => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const ctx = vm.createContext({});
vm.runInContext('var VN_OFFSET_MS = 7*3600*1000;\n' + ['_vnMidnight_', '_vnYmd_', 'parseVNDate_', '_dateStrToVnYmd_', '_customDateToDate_'].map(grab).join('\n'), ctx);
const f = s => { const d = vm.runInContext('_customDateToDate_', ctx)(s); return d ? vm.runInContext('_vnYmd_', ctx)(d) : null; };
ok(f('2026-11-01') === '2026-11-01' && f('2026-11-09') === '2026-11-09', "'yyyy-MM-dd' tu <input type=date> doc dung (loi cu: null -> hom nay)");
ok(f('01/10/2026') === '2026-10-01', "'dd/MM/yyyy' van doc dung");
ok(f('') === null && f('abc') === null, 'rong / sai dinh dang -> null');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
