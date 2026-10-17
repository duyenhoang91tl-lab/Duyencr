#!/usr/bin/env node
// Test: the "Ty le chot TB" tren cum KPI dau Bao cao A va B (cung cong thuc voi dong "Trung binh" cua bieu do).
const fs = require('fs'), vm = require('vm'), path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
const xl = fs.readFileSync(path.join(__dirname, '..', 'js', '13-fn-bpseedofficialonlinetemplate.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function fnSrc(name) { const i = js.indexOf('function ' + name + '('); let j = js.indexOf('{', i), d = 0, k = j; for (; k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) break; } } return js.slice(i, k + 1); }
const ctx = { fmt: (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') }; vm.createContext(ctx);
vm.runInContext(fnSrc('_srCloseRateAvg_') + '\n' + fnSrc('_srCloseRateKpiCard_'), ctx);
const rows = [{ name: 'a', held: 3414, closed: 65 }, { name: 'b', held: 1968, closed: 31 }, { name: 'c', held: 0, closed: 5 }, { name: '(chưa gán sale)', held: 0, closed: 66 }];
const a = ctx._srCloseRateAvg_(rows);
ok(a.held === 5382 && a.closed === 96 && a.avg === 1.8 && a.has, 'TB = tong chot / tong tuong tac cua cac dong co tuong tac (dong mo coi khong tinh): ' + JSON.stringify(a));
ok(ctx._srCloseRateAvg_([]).has === false && ctx._srCloseRateAvg_(null).avg === 0 && ctx._srCloseRateAvg_([{ held: 0, closed: 4 }]).has === false, 'rong / khong co tuong tac -> has=false, khong chia cho 0');
// khop dong "Trung binh" cua bieu do: 333/39781 = 0.8
ok(ctx._srCloseRateAvg_([{ held: 39781, closed: 333 }]).avg === 0.8, 'giu 1 chu so thap phan nhu bieu do (333/39781 = 0.8%)');
let h = ctx._srCloseRateKpiCard_({ saleCloseRateFrom: '2026-10-01', saleCloseRate: [{ held: 39781, closed: 333 }] });
ok(/kpi-card/.test(h) && />0\.8%</.test(h) && /333 đơn ÷ 39\.781 tương tác Pancake/.test(h) && /Tỷ lệ chốt TB/.test(h), 'the hien 0.8% + (333 don ÷ 39.781 tuong tac)');
ok(ctx._srCloseRateKpiCard_({ saleCloseRate: [{ held: 10, closed: 1 }] }) === '', 'chua nap Pancake (khong co saleCloseRateFrom) -> khong ve the');
ok(ctx._srCloseRateKpiCard_({ saleCloseRateFrom: 'x', saleCloseRate: [] }) === '' && ctx._srCloseRateKpiCard_(null) === '', 'khong du lieu -> khong ve the');
ok(/_srCloseRateKpiCard_\(d\) \+\s*\n\s*'<\/div>' \+/.test(js), 'Bao cao A goi the trong cum KPI');
const rb = js.slice(js.indexOf('function _srRenderB(d)'), js.indexOf('function _srRenderB(d)') + 1800);
ok(/_srCloseRateKpiCard_\(d\)/.test(rb), 'Bao cao B goi the trong cum KPI');
ok(/Tỷ lệ chốt TB \(%\)/.test(xl) && (xl.match(/_srCloseRateAvg_\(/g) || []).length >= 2, 'xuat Excel A va B them dong Ty le chot TB');
console.log(fail ? '\nFAILED ' + fail : '\nALL CLOSERATE KPI CARD TESTS PASSED'); process.exit(fail ? 1 : 0);
