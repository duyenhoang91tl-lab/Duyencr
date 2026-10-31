#!/usr/bin/env node
// Test Bao cao L — quy tac NGAY (Duyen chinh 2026-10-31): "25-27" = khoang; dung cot "Ngay KH den" khi co. Chay ham THAT trong gas_v13.js.
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const c = vm.createContext({ parseVNDate_: s => { const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null; }, _vnYmd_: d => d.toISOString().slice(0, 10) });
vm.runInContext(['_storeCaseYmdAdd_', '_storeCaseDayList_', '_storeCaseDaysToYmd_', '_storeCaseVisitDates_', '_storeCaseArrivalDates_'].map(fn).join('\n'), c);
const T = '2026-10-31', V = (m, d) => c._storeCaseVisitDates_(m, d, T).join(','), A = (a, m, h) => c._storeCaseArrivalDates_(a, m, h, T).join(',');
ok(V('10', '25-27') === '2026-10-25,2026-10-26,2026-10-27', '"25-27" = ca khoang 25,26,27');
ok(V('10', '10-11') === '2026-10-10,2026-10-11', '"10-11" = 10 va 11');
ok(V('10', '25-26-27') === '2026-10-25,2026-10-26,2026-10-27', '"25-26-27" khong lap');
ok(V('10', '28/29') === '2026-10-28,2026-10-29', '"28/29" = liet ke');
ok(V('10', '3,4') === '2026-10-03,2026-10-04', '"3,4" = liet ke');
ok(V('10', '25–27') === '2026-10-25,2026-10-26,2026-10-27', 'gach noi dai (–) cung la khoang');
ok(V('10', '25 den 27') === '2026-10-25,2026-10-26,2026-10-27', '"25 den 27" la khoang');
ok(V('10', '27-25') === '2026-10-27,2026-10-25', 'khoang nguoc -> liet ke');
ok(V('9', '30-31') === '2026-09-30', 'ngay 31/9 khong ton tai bi bo');
ok(V('10', '10/10/2026') === '2026-10-10' && V('', '2026-10-10') === '2026-10-10', 'co nam day du -> dung ngay do');
ok(V('', '25') === '', 'thieu thang -> khong co ngay');
ok(V('12', '25') === '2025-12-25', 'hen xa >45 ngay tuong lai -> lui 1 nam (giu nguyen quy tac)');
ok(A('26', '10', ['2026-10-25']) === '2026-10-26', 'Ngay KH den "26" -> 26/10');
ok(A('26/10', '', []) === '2026-10-26', 'Ngay KH den "26/10"');
ok(A('26/10/2026', '10', []) === '2026-10-26', 'Ngay KH den day du');
ok(A('25-27', '10', []) === '2026-10-25,2026-10-26,2026-10-27', 'Ngay KH den "25-27" cung la khoang');
ok(A('26', '', ['2026-10-25']) === '2026-10-26', 'cot Thang trong -> lay thang cua ngay hen');
ok(A('', '10', ['2026-10-25']) === '', 'trong -> khong co (de dung ngay hen)');
ok(A('abc', '10', []) === '', 'chu khong ra ngay -> rong');
process.exit(bad ? 1 : 0);
