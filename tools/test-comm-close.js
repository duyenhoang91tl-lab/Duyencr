#!/usr/bin/env node
// Test CHỐT KỲ HOA HỒNG + TRỪ ĐƠN HOÀN Ở KỲ SAU (gas/34c_CommClose.gs, mục 7 bước 7b).
// Chạy: node tools/test-comm-close.js -> "ALL COMM CLOSE TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ctx = { console, Math, Number, isFinite, JSON, String, Object, Array };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas', '34c_CommClose.gs'), 'utf8'), ctx, { filename: '34c_CommClose.gs' });
const J = x => JSON.stringify(x), run = s => vm.runInContext(s, ctx);
const settle = (lines, ledger, period, carry) => run('_commSettle_(' + J(lines) + ',' + J(ledger || []) + ',"' + period + '",' + J(carry || null) + ')');
// ── kỳ & cửa sổ chốt 1–5
ok(run('_commPeriodOf_("2026-10-31")') === '2026-10' && run('_commPeriodOf_("abc")') === '', 'kỳ theo ngày lên đơn');
ok(run('_commNextPeriod_("2026-12")') === '2027-01' && run('_commNextPeriod_("2026-10")') === '2026-11', 'kỳ kế tiếp qua năm');
const st = (p, today, closed) => run('_commPeriodState_("' + p + '","' + today + '",' + J(closed || []) + ')');
ok(st('2026-10', '2026-10-31') === 'open', '31/10: tháng 10 chưa kết thúc → open');
ok(st('2026-10', '2026-11-01') === 'closing' && st('2026-10', '2026-11-05') === 'closing', '1–5/11: đang trong cửa sổ chốt tháng 10');
ok(st('2026-10', '2026-11-06') === 'overdue', '6/11 chưa chốt → overdue');
ok(st('2026-10', '2026-11-03', ['2026-10']) === 'closed' && st('2026-10', '2026-12-20', ['2026-10']) === 'closed', 'đã chốt → closed');
ok(st('2026-12', '2027-01-04') === 'closing', 'tháng 12 chốt đầu tháng 1 năm sau');
// ── chốt tháng 10: đơn tháng khác / hoàn / hủy không có hoa hồng
const L10 = [
  { orderId: 'A', sale: 'hoa', date: '2026-10-03', commission: 150000, refunded: false },
  { orderId: 'B', sale: 'hoa', date: '2026-10-20', commission: 90000, refunded: false },
  { orderId: 'C', sale: 'hoa', date: '2026-10-25', commission: 200000, refunded: true },     // hoàn TRƯỚC khi chốt → không trả
  { orderId: 'D', sale: 'lan', date: '2026-10-31', commission: 300000, refunded: false },
  { orderId: 'E', sale: 'lan', date: '2026-11-01', commission: 999999, refunded: false }];  // tháng 11 → không thuộc kỳ này
let r = settle(L10, [], '2026-10');
ok(r.sales.hoa.commission === 240000 && r.sales.hoa.payable === 240000 && r.sales.lan.commission === 300000 && !r.sales.lan.clawback, 'kỳ 10: hoa 240k, lan 300k: ' + J(r.totals));
ok(r.totals.commission === 540000 && r.totals.payable === 540000 && r.totals.clawback === 0, 'tổng kỳ 10');
// ── ghi sổ để kỳ sau không trả/trừ trùng
let led = run('_commLedgerRows_(' + J(r) + ')');
ok(led.length === 3 && led.every(e => e.type === 'pay' && e.period === '2026-10'), 'sổ kỳ 10: 3 dòng pay: ' + J(led));
// ── chốt LẠI chính kỳ 10 với sổ đã có → không trả lần 2
r = settle(L10, led, '2026-10'); ok(r.totals.commission === 0 && r.totals.payable === 0, 'chốt lại cùng kỳ không trả trùng: ' + J(r.totals));
// ── chốt lại CHÍNH kỳ 10 sau khi B đã bị hoàn: B đã trả TRONG kỳ này (sổ cùng kỳ) → không trả lại và cũng không trừ lại (việc trừ thuộc kỳ SAU)
r = settle(L10.map(l => l.orderId === 'B' ? Object.assign({}, l, { refunded: true }) : l), led, '2026-10'); ok(r.totals.commission === 0 && r.totals.clawback === 0, 'chốt lại cùng kỳ: đơn đã trả trong kỳ rồi bị hoàn → không trừ trong chính kỳ này: ' + J(r.totals));
// ── tháng 11: đơn B (đã trả ở kỳ 10) bị HOÀN sau khi chốt → trừ lại ở kỳ 11; đơn tháng 11 vẫn được trả
const L11 = L10.map(l => l.orderId === 'B' ? Object.assign({}, l, { refunded: true }) : l);
r = settle(L11, led, '2026-11');
ok(r.sales.hoa.clawback === -90000 && r.sales.hoa.commission === 0 && r.sales.hoa.net === -90000 && r.sales.hoa.payable === 0 && r.sales.hoa.carryOut === -90000, 'B hoàn sau chốt → trừ 90k, không có đơn mới nên chuyển nợ sang kỳ sau: ' + J(r.sales.hoa));
ok(r.sales.lan.commission === 999999 && r.sales.lan.clawback === 0, 'lan: đơn E tháng 11 được trả, không bị trừ');
ok(r.totals.clawback === -90000 && r.totals.carryOut === -90000, 'tổng kỳ 11');
// ── hoa còn có đơn mới trong tháng 11 → trừ trực tiếp vào tiền kỳ này
const L11b = L11.concat([{ orderId: 'F', sale: 'hoa', date: '2026-11-10', commission: 250000, refunded: false }]);
r = settle(L11b, led, '2026-11'); ok(r.sales.hoa.net === 160000 && r.sales.hoa.payable === 160000 && r.sales.hoa.carryOut === 0, 'đơn mới 250k − 90k = trả 160k: ' + J(r.sales.hoa));
// ── ghi sổ kỳ 11 (có claw) rồi chốt kỳ 12: không trừ B lần 2; nợ chuyển kỳ được trừ tiếp
const led11 = led.concat(run('_commLedgerRows_(' + J(settle(L11, led, '2026-11')) + ')'));
ok(led11.some(e => e.type === 'claw' && e.orderId === 'B' && e.amount === -90000 && e.period === '2026-11'), 'sổ kỳ 11 có dòng claw của B');
r = settle(L11, led11, '2026-12'); ok(!r.sales.hoa || (r.sales.hoa.clawback === 0), 'kỳ 12 không trừ B lần 2: ' + J(r.sales));
const L12 = L11.concat([{ orderId: 'G', sale: 'hoa', date: '2026-12-05', commission: 100000, refunded: false }]);
r = settle(L12, led11, '2026-12', { hoa: -90000 }); ok(r.sales.hoa.net === 10000 && r.sales.hoa.payable === 10000 && r.sales.hoa.carryOut === 0, 'nợ −90k chuyển sang kỳ 12: 100k − 90k = 10k: ' + J(r.sales.hoa));
r = settle([{ orderId: 'H', sale: 'hoa', date: '2026-12-05', commission: 30000, refunded: false }], led11, '2026-12', { hoa: -90000 }); ok(r.sales.hoa.payable === 0 && r.sales.hoa.carryOut === -60000, 'đơn mới chưa đủ bù nợ → trả 0, còn nợ −60k chuyển tiếp: ' + J(r.sales.hoa));
// ── đơn hoàn rồi KHÔNG hoàn lại: carry dương bị bỏ (chỉ nợ âm mới chuyển)
r = settle([], [], '2026-12', { hoa: 50000 }); ok(r.sales.hoa.carryIn === 0, 'carryIn dương bị bỏ qua (chỉ chuyển nợ âm)');
// ── mỗi sale tách riêng: đơn chia 2 sale
const split = [{ orderId: 'S', sale: 'hoa', date: '2026-10-05', commission: 50000, refunded: false }, { orderId: 'S', sale: 'lan', date: '2026-10-05', commission: 50000, refunded: false }];
const ledS = run('_commLedgerRows_(' + J(settle(split, [], '2026-10')) + ')');
r = settle(split.map(l => Object.assign({}, l, { refunded: true })), ledS, '2026-11'); ok(r.sales.hoa.clawback === -50000 && r.sales.lan.clawback === -50000, 'đơn chia 2 sale hoàn → mỗi người bị trừ đúng phần của mình: ' + J(r.totals));
// ── an toàn dữ liệu
r = settle([{ orderId: 'Z', sale: 'hoa', date: 'xấu', commission: 100, refunded: false }, { orderId: 'Y', sale: 'hoa', date: '2026-10-01', commission: -5, refunded: false }, null], [null], '2026-10'); ok(r.totals.commission === 0, 'ngày lỗi / hoa hồng âm / dòng rỗng → bỏ qua, không ném lỗi');
console.log('ALL COMM CLOSE TESTS PASSED');
