#!/usr/bin/env node
// Test ĐIỂM TÍCH LUỸ + LỊCH SỬ HẠNG (gas/34_Loyalty.gs). Chạy: node tools/test-loyalty.js -> "ALL LOYALTY TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ctx = { console, Math, Number, isFinite, JSON, String, Object, Array,
  _TIER_DEFAULT_: [{ key: 'thuong', label: 'Khách thường', min: 0 }, { key: 'tt', label: 'Ưu tiên', min: 15000000 }, { key: 'vip', label: 'Vip', min: 30000000 }, { key: 'super', label: 'Super VVip', min: 50000000 }] };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas', '34_Loyalty.gs'), 'utf8'), ctx, { filename: '34_Loyalty.gs' });
const J = x => JSON.stringify(x), run = s => vm.runInContext(s, ctx);
// cấu hình
ok(J(run('_loyaltyCfgNormalize_(null)')) === J({ rate: 0.01, pointValue: 1000 }), 'cfg mặc định');
ok(run('_loyaltyCfgNormalize_("{\\"rate\\":0.02,\\"pointValue\\":500}")').pointValue === 500, 'cfg từ JSON');
ok(run('_loyaltyCfgNormalize_({rate:-1,pointValue:0})').rate === 0.01 && run('_loyaltyCfgNormalize_("{xấu")').pointValue === 1000, 'cfg sai → mặc định');
// tích điểm: 1% giá trị, 1 điểm = 1.000đ
ok(run('_loyaltyEarnPoints_(10000000)') === 100, '10tr → 100 điểm');
ok(run('_loyaltyEarnPoints_(3000000)') === 30, '3tr → 30 điểm');
ok(run('_loyaltyEarnPoints_(199999)') === 1 && run('_loyaltyEarnPoints_(99999)') === 0, 'làm tròn xuống');
ok(run('_loyaltyEarnPoints_(-5)') === 0 && run('_loyaltyEarnPoints_("abc")') === 0, 'đơn âm/lỗi → 0');
// số dư theo năm, hoàn trừ đúng điểm đơn gốc, hết hạn 31/12
const ev = [
  { type: 'earn', orderId: 'A', date: '2026-03-10', points: 100 },
  { type: 'earn', orderId: 'B', date: '2026-05-01', points: 30 },
  { type: 'refund', orderId: 'B', date: '2026-06-01', points: 30 },
  { type: 'redeem', date: '2026-07-01', points: 40 },
  { type: 'earn', orderId: 'C', date: '2025-12-30', points: 500 } ];
let b = run('_loyaltyBalance_(' + J(ev) + ', "2026-08-01")');
ok(b.earned === 130 && b.refunded === 30 && b.redeemed === 40 && b.balance === 60 && b.expiresOn === '2026-12-31', 'số dư 2026: ' + J(b));
ok(b.expired === 500, 'điểm 2025 đã hết hạn: ' + b.expired);
ok(run('_loyaltyBalance_(' + J(ev) + ', "2026-04-01")').balance === 100, 'chưa tới ngày hoàn/dùng thì chưa trừ');
ok(run('_loyaltyBalance_(' + J(ev) + ', "2025-12-31")').balance === 500, 'năm 2025 còn 500 vào 31/12/2025');
// hoàn đơn năm trước trừ vào quỹ năm trước (không trừ quỹ năm nay)
b = run('_loyaltyBalance_(' + J(ev.concat([{ type: 'refund', orderId: 'C', date: '2026-02-01', points: 500 }])) + ', "2026-08-01")');
ok(b.balance === 60 && b.expired === 0, 'hoàn đơn 2025 chỉ trừ quỹ 2025: ' + J(b));
// dùng hết rồi đơn bị hoàn → thiếu hụt, số dư không âm
b = run('_loyaltyBalance_(' + J([{ type: 'earn', orderId: 'X', date: '2026-01-05', points: 50 }, { type: 'redeem', date: '2026-01-06', points: 50 }, { type: 'refund', orderId: 'X', date: '2026-01-07', points: 50 }]) + ', "2026-02-01")');
ok(b.balance === 0 && b.deficit === 50, 'thiếu hụt khi hoàn đơn đã dùng điểm: ' + J(b));
// trừ điểm vào đơn: giới hạn theo số dư, theo giá trị đơn, 1 điểm = 1.000đ
let r = run('_loyaltyRedeem_(2000000, 60, 40)'); ok(r.points === 40 && r.discount === 40000 && r.payable === 1960000, 'trừ 40 điểm: ' + J(r));
r = run('_loyaltyRedeem_(2000000, 60, 100)'); ok(r.points === 60 && r.discount === 60000, 'không vượt số dư');
r = run('_loyaltyRedeem_(30500, 60, 60)'); ok(r.points === 30 && r.payable === 500, 'không vượt giá trị đơn: ' + J(r));
r = run('_loyaltyRedeem_(1000000, 0, 10)'); ok(r.points === 0 && r.payable === 1000000, 'không có điểm');
// lịch sử hạng — ví dụ docx: đã mua 28tr (Ưu tiên) + đơn 3tr = 31tr → Vip
const orders = [{ orderId: 'O1', date: '2026-01-10', value: 16000000 }, { orderId: 'O2', date: '2026-02-10', value: 12000000 }, { orderId: 'O3', date: '2026-03-10', value: 3000000 }];
let h = run('_loyaltyTierHistory_(' + J(orders) + ')');
ok(h.tier === 'vip' && h.cumulative === 31000000, 'lên Vip ở 31tr: ' + J(h));
ok(h.history.length === 2 && h.history[0].to === 'tt' && h.history[0].orderId === 'O1' && h.history[1].from === 'tt' && h.history[1].to === 'vip' && h.history[1].orderId === 'O3' && h.history[1].cumulative === 31000000, 'lịch sử 2 lần lên hạng: ' + J(h.history));
// 1 đơn nhảy nhiều hạng = 1 sự kiện; đơn hoàn không tính; hạng giữ trọn đời
h = run('_loyaltyTierHistory_(' + J([{ orderId: 'Z', date: '2026-01-01', value: 60000000 }]) + ')');
ok(h.tier === 'super' && h.history.length === 1 && h.history[0].from === 'thuong', 'nhảy thẳng Super');
h = run('_loyaltyTierHistory_(' + J([{ orderId: 'a', date: '2026-01-01', value: 20000000 }, { orderId: 'b', date: '2026-02-01', value: 20000000, refunded: true }, { orderId: 'c', date: '2026-03-01', value: 5000000 }]) + ')');
ok(h.tier === 'tt' && h.cumulative === 25000000 && h.history.length === 1, 'đơn hoàn không tính vào hạng: ' + J(h));
h = run('_loyaltyTierHistory_(' + J([{ orderId: 'a', date: '2026-02-01', value: 31000000 }, { orderId: 'b', date: '2026-01-01', value: 1000000 }]) + ')');
ok(h.history[0].orderId === 'a' && h.history[0].cumulative === 32000000 && h.history.length === 1 && h.history[0].to === 'vip', 'sắp theo ngày đơn, không theo thứ tự nhập: ' + J(h));
ok(run('_loyaltyTierHistory_([])').tier === 'thuong', 'chưa có đơn → Khách thường');
console.log('ALL LOYALTY TESTS PASSED');
