#!/usr/bin/env node
// Test giao dien tab "Mini game T11" + cot tong hop + xuat Excel khong vo voi loai thuong moi (js/60-team-bonus.js). Chay: node tools/test-minigame-nov-ui.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/60-team-bonus.js', 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const grab = name => { const i = src.search(new RegExp('function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const ctx = { console, _tbEsc_: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), _tbMoney_: n => Math.round(n).toLocaleString('en-US') + 'đ' };
vm.createContext(ctx);
vm.runInContext("var _TB_MG_KINDS_ = ['dayTarget', 'monthTarget', 'topRevenue', 'allowance'];", ctx);
['_tbMgOf_', '_tbMiniGameHtml_', '_tbTotalsHtml_', '_tbExportRows_'].forEach(n => vm.runInContext(grab(n), ctx));
const d = { cfg: { dailyTiers: [{ min: 6e7, reward: 5e4 }, { min: 1e8, reward: 1e5 }], monthTiers: [{ min: 5e8, reward: 5e5 }], topRevenue: { pct: 0.1, base: 'self', minRevenue: 1e9 }, onlineAllowance: { minRevenue: 7e8, amount: 1e6 }, monthlyReward: 1e6 },
  dayTargets: [{ date: '2026-11-03', name: 'Hoa', revenue: 65e6, min: 6e7, reward: 5e4, partial: false }, { date: '2026-11-04', name: 'Hoa', revenue: 1e8, min: 1e8, reward: 1e5, partial: true }],
  monthTargets: [{ name: 'Nam', revenue: 1109e6, min: 1e9, reward: 1.5e6, partial: false }], topRevenue: { partial: false, winners: [{ name: 'Nam', revenue: 1109e6, amount: 1109000 }] }, allowances: [{ name: 'Mai', revenue: 710e6, amount: 1e6, partial: false }],
  rewards: [{ kind: 'dayTarget', name: 'Hoa', amount: 5e4, period: '2026-11-03' }, { kind: 'monthTarget', name: 'Nam', amount: 1.5e6 }, { kind: 'topRevenue', name: 'Nam', amount: 1109000 }, { kind: 'day', name: 'Nam', amount: 5e4 }],
  totals: [{ name: 'Nam', reward: 2659000, penalty: 0, net: 2659000, dayWins: 1, weekWins: 0, monthWins: 0, penaltyCount: 0 }, { name: 'Hoa', reward: 5e4, penalty: 0, net: 5e4, dayWins: 0, weekWins: 0, monthWins: 0, penaltyCount: 0 }],
  daily: [], weekly: [], monthly: null, penalties: [], month: '2026-11' };
const h = vm.runInContext('_tbMiniGameHtml_', ctx)(d);
ok(/C\. Thưởng doanh số ngày/.test(h) && /D1\./.test(h) && /D2\./.test(h) && /D4\./.test(h), 'tab co du muc C, D1, D2, D4');
ok(/Hoa/.test(h) && /65,000,000đ/.test(h) && /50,000đ/.test(h) && /\(tạm tính\)/.test(h), 'hien dong thuong ngay + danh dau tam tinh');
ok(/Nam/.test(h) && /1,500,000đ/.test(h) && /1,109,000đ/.test(h) && /Mai/.test(h), 'hien moc thang, Top 1 DT, phu cap Online');
ok(/Báo cáo G/.test(h) && /TẮT/.test(h) === false || /TẮT/.test(h), 'ghi ro muc A, B tinh o Bao cao G; muc C bao dang tat khi chua bat');
ok(vm.runInContext('_tbMgOf_', ctx)(d, 'Nam') === 1.5e6 + 1109000 && vm.runInContext('_tbMgOf_', ctx)(d, 'Hoa') === 5e4, 'tong mini game theo Sale (khong lan thuong ngay cu)');
const tot = vm.runInContext('_tbTotalsHtml_', ctx)(d);
ok(/Mini game T11/.test(tot) && /2,609,000đ/.test(tot), 'bang tong hop co cot Mini game T11 (Nam 2,609,000đ)');
let ex; try { ex = vm.runInContext('_tbExportRows_', ctx)(d); } catch (e) { ex = e; }
ok(!(ex instanceof Error) && ex.sum && ex.sum[0].indexOf('Mini game T11 (đ)') > -1 && ex.sum[1].length === ex.sum[0].length, 'xuat Excel khong loi voi loai thuong moi, so cot khop');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
