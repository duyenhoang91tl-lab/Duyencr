#!/usr/bin/env node
// Test QUYỀN LỢI THEO THẺ (gas/34_Loyalty.gs, mục 9 bước 9b): thẻ VIP (mua lần 2) giảm 5%, SUPER VIP (≥ 50tr) giảm 10%, miễn ship đơn ≥ 1tr,
// mã KHÔNG GIẢM / TỐI ĐA 5% theo danh sách docx. Chạy: node tools/test-loyalty-benefit.js -> "ALL LOYALTY BENEFIT TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ctx = { console, Math, Number, isFinite, JSON, String, Object, Array,
  _TIER_DEFAULT_: [{ key: 'thuong', label: 'Khách thường', min: 0 }, { key: 'tt', label: 'Ưu tiên', min: 15000000 }, { key: 'vip', label: 'Vip', min: 30000000 }, { key: 'super', label: 'Super VVip', min: 50000000 }] };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas', '34_Loyalty.gs'), 'utf8'), ctx, { filename: '34_Loyalty.gs' });
const run = s => vm.runInContext(s, ctx), J = x => JSON.stringify(x);
const lvl = (n, c) => run('_loyaltyBenefitLevel_(' + n + ',' + c + ')');
const app = (items, level, cfg) => run('_loyaltyBenefitApply_(' + J(items) + ',"' + level + '",' + J(cfg || null) + ')');
const it = (name, price, qty) => ({ name, price, qty: qty || 1 });
const pct = (name, level) => app([it(name, 1000000)], level).lines[0];
// ── cấp thẻ
ok(lvl(0, 0) === 'none', 'khách lần đầu: không thẻ');
ok(lvl(1, 3000000) === 'vip', 'mua lần 2 (đã có 1 đơn) → VIP, dù hạng doanh thu còn thấp');
ok(lvl(5, 49999999) === 'vip' && lvl(5, 50000000) === 'super' && lvl(0, 60000000) === 'super', 'ranh giới 50tr → SUPER VIP');
// ── giảm 5% / 10% + miễn ship
let r = app([it('Nhẫn bạc trơn', 1500000), it('Lắc bạc 925', 500000)], 'vip');
ok(r.subtotal === 2000000 && r.discount === 100000 && r.afterDiscount === 1900000 && r.freeShip === true, 'VIP 2tr: giảm 5% = 100k, miễn ship: ' + J(r));
r = app([it('Nhẫn bạc trơn', 800000)], 'vip'); ok(r.discount === 40000 && r.freeShip === false, 'VIP dưới 1tr: vẫn giảm 5% nhưng KHÔNG miễn ship: ' + J(r));
r = app([it('Nhẫn bạc trơn', 1000000)], 'vip'); ok(r.freeShip === true, 'đúng 1 triệu → miễn ship (từ 1 triệu)');
r = app([it('Nhẫn bạc trơn', 999999)], 'vip'); ok(r.freeShip === false, '999.999đ → chưa miễn ship');
r = app([it('Dây chuyền bạc', 60000000)], 'super'); ok(r.discount === 6000000 && r.freeShip === true, 'SUPER VIP giảm 10%: ' + J(r));
r = app([it('Nhẫn bạc trơn', 5000000)], 'none'); ok(r.discount === 0 && r.freeShip === false && r.lines[0].rule === 'none', 'không thẻ: không giảm, không miễn ship');
r = app([it('Nhẫn bạc', 100000, 3)], 'vip'); ok(r.subtotal === 300000 && r.discount === 15000, 'nhân số lượng');
// ── mã KHÔNG GIẢM (0% dù có thẻ VIP / SUPER)
['Charm 24k hoa sen', 'Cham bi vàng 10k', 'Charm 10k không gắn đá', 'Mặt vàng 18k kiểu A', 'Kim tiền phát lộc', 'Dây vàng 10k', 'Nhẫn thiết kế 2 hàng đá', 'Nhẫn kết nối đôi',
 'Lắc đúc vàng', 'Nhẫn nam bạc', 'Dây vàng đeo cổ Như Ý Nguyện', 'Dây vàng đeo cổ Lộc Như Ý', 'Dây vàng đeo cổ mẫu Tourmaline tinh thể', 'NHẪN NAM'].forEach(n => {
  ['vip', 'super'].forEach(l => { const x = pct(n, l); ok(x.pct === 0 && x.discount === 0 && x.rule === 'excluded', 'KHÔNG GIẢM: ' + n + ' (' + l + ') → ' + J(x)); });
});
// ── mã TỐI ĐA 5%: VIP vẫn 5%, SUPER bị chặn ở 5% (không phải 10%)
['Vòng cẩm thạch type A', 'Lắc tay vàng Như Ý Nguyện', 'Lộc phúc tình', 'Đồng điếu đa thông', 'Cổ tỳ hưu nam bọc vàng', 'Charm vàng khởi lộc 10k'].forEach(n => {
  let x = pct(n, 'vip'); ok(x.pct === 5 && x.rule === 'full', 'TỐI ĐA 5% (VIP vẫn 5%): ' + n + ' → ' + J(x));
  x = pct(n, 'super'); ok(x.pct === 5 && x.discount === 50000 && x.rule === 'cap', 'TỐI ĐA 5% (SUPER chặn ở 5%): ' + n + ' → ' + J(x));
});
// ── không loại nhầm sản phẩm thường; charm 10k CÓ gắn đá/ngọc không thuộc nhóm không giảm
ok(pct('Charm bạc 925 gắn đá', 'super').pct === 10, 'charm bạc gắn đá: giảm bình thường');
ok(pct('Charm 10k gắn đá CZ', 'vip').pct === 5 && pct('Charm 10k gắn ngọc trai', 'vip').pct === 5, 'charm 10k CÓ đá/ngọc: được giảm');
ok(pct('Nhẫn bạc nữ đính đá', 'vip').pct === 5, '"nhẫn nữ" không bị nhầm với "nhẫn nam"');
// ── đơn hỗn hợp: giảm đúng từng dòng
r = app([it('Nhẫn bạc trơn', 2000000), it('Charm 24k', 500000), it('Lắc tay vàng như ý nguyện', 1000000)], 'super');
ok(r.discount === 200000 + 0 + 50000 && r.subtotal === 3500000 && r.afterDiscount === 3250000 && r.freeShip, 'đơn hỗn hợp SUPER: ' + J(r));
// ── cấu hình
const c0 = run('_loyaltyBenefitCfgNormalize_("{xấu")'); ok(c0.vipPct === 5 && c0.superPct === 10 && c0.superMin === 50000000 && c0.freeShipMin === 1000000 && c0.noDiscount.length === 13 && c0.cap5.length === 6, 'JSON hỏng → mặc định');
ok(app([it('Nhẫn bạc', 1000000)], 'vip', { vipPct: 7 }).discount === 70000, 'đổi % thẻ VIP');
ok(app([it('Nhẫn bạc', 1000000)], 'vip', { vipPct: 999 }).discount === 50000, '% vô lý → mặc định');
ok(app([it('Sản phẩm X', 1000000)], 'vip', { noDiscount: [{ all: ['san pham x'] }] }).lines[0].rule === 'excluded', 'admin khai thêm mã không giảm (có bỏ dấu)');
ok(app([it('Charm 24k', 1000000)], 'vip', { noDiscount: [] }).lines[0].rule === 'excluded', 'danh sách rỗng → dùng danh sách mặc định (không vô tình bật giảm hết)');
ok(app([], 'vip').subtotal === 0 && app([], 'vip').freeShip === false, 'đơn rỗng');
console.log('ALL LOYALTY BENEFIT TESTS PASSED');
