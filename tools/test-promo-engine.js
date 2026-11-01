// Test engine khuyến mãi (js/53-fn-promo-engine.js). Chạy: node tools/test-promo-engine.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../js/53-fn-promo-engine.js', 'utf8'), ctx);
const { calcPromo_, promoNormalize_ } = ctx;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const P = (o) => promoNormalize_([o])[0];
const D = '2026-10-17';
const items = [{ name: 'Vòng tay Thạch anh', qty: 2, price: 1000000 }, { name: 'Dây chuyền Bạc', qty: 1, price: 500000 }];

ok('không CT: total = subtotal', () => { const r = calcPromo_(items, [], { date: D }); assert.strictEqual(r.subtotal, 2500000); assert.strictEqual(r.total, 2500000); });
ok('giảm %: 10% trên SP khớp (không dấu)', () => {
  const r = calcPromo_(items, [P({ id: 'a', name: '10% thạch anh', type: 'percent', value: 10, products: 'thach anh' })], { date: D });
  assert.strictEqual(r.discount, 200000); assert.strictEqual(r.total, 2300000);
});
ok('giảm số tiền cố định, không vượt giá trị khớp', () => {
  const r = calcPromo_(items, [P({ id: 'a', name: 'g', type: 'amount', value: 9999999, products: 'bac' })], { date: D });
  assert.strictEqual(r.discount, 500000);
});
ok('combo: 2 món giá cao nhất = 1.700.000', () => {
  const r = calcPromo_(items, [P({ id: 'c', name: 'combo', type: 'combo', comboQty: 2, comboPrice: 1700000 })], { date: D });
  assert.strictEqual(r.discount, 300000); // lấy 2 món 1tr: 2.000.000 -> 1.700.000
});
ok('combo chưa đủ món: bỏ qua có lý do', () => {
  const r = calcPromo_([items[1]], [P({ id: 'c', name: 'combo', type: 'combo', comboQty: 2, comboPrice: 1 })], { date: D });
  assert.strictEqual(r.discount, 0); assert.ok(r.skipped[0].why.includes('combo'));
});
ok('quà tặng: không giảm giá, trả quà', () => {
  const r = calcPromo_(items, [P({ id: 'g', name: 'quà', type: 'gift', gift: 'Túi gấm', giftQty: 2, minAmount: 2000000 })], { date: D });
  assert.strictEqual(r.discount, 0); assert.deepStrictEqual(JSON.parse(JSON.stringify(r.gifts)), [{ name: 'Túi gấm', qty: 2 }]);
});
ok('quà không đủ giá trị tối thiểu', () => {
  const r = calcPromo_(items, [P({ id: 'g', name: 'quà', type: 'gift', gift: 'X', minAmount: 9000000 })], { date: D });
  assert.strictEqual(r.gifts.length, 0);
});
ok('voucher cần nhập mã (không phân biệt hoa thường)', () => {
  const v = P({ id: 'v', name: 'vc', type: 'voucher', code: 'sale50', vkind: 'amount', value: 50000 });
  assert.strictEqual(calcPromo_(items, [v], { date: D }).discount, 0);
  assert.strictEqual(calcPromo_(items, [v], { date: D, vouchers: ['Sale50'] }).discount, 50000);
});
ok('hết hạn / chưa bắt đầu / tắt', () => {
  const mk = (o) => P(Object.assign({ id: 'x', name: 'x', type: 'percent', value: 10 }, o));
  assert.strictEqual(calcPromo_(items, [mk({ end: '2026-10-16' })], { date: D }).discount, 0);
  assert.strictEqual(calcPromo_(items, [mk({ start: '2026-10-18' })], { date: D }).discount, 0);
  assert.strictEqual(calcPromo_(items, [mk({ active: false })], { date: D }).discount, 0);
  assert.strictEqual(calcPromo_(items, [mk({ start: '2026-10-17', end: '2026-10-17' })], { date: D }).discount, 250000);
});
ok('áp đồng thời: 2 CT stackable cộng dồn', () => {
  const r = calcPromo_(items, [P({ id: 'a', name: 'a', type: 'percent', value: 10, stackable: true }), P({ id: 'b', name: 'b', type: 'amount', value: 100000, stackable: true })], { date: D });
  assert.strictEqual(r.discount, 350000); assert.strictEqual(r.applied.length, 2);
});
ok('KHÔNG áp cùng CT khác: chọn CT giảm nhiều hơn', () => {
  const r = calcPromo_(items, [P({ id: 'a', name: 'a', type: 'percent', value: 10 }), P({ id: 'b', name: 'b', type: 'amount', value: 100000, stackable: true })], { date: D });
  assert.strictEqual(r.discount, 250000); assert.strictEqual(r.applied[0].id, 'a');
  assert.ok(r.skipped.some(s => s.id === 'b'));
});
ok('excludes: 2 CT stackable nhưng loại trừ nhau', () => {
  const r = calcPromo_(items, [P({ id: 'a', name: 'a', type: 'percent', value: 10, stackable: true, excludes: 'b' }), P({ id: 'b', name: 'b', type: 'amount', value: 100000, stackable: true })], { date: D });
  assert.strictEqual(r.applied.length, 1); assert.strictEqual(r.discount, 250000);
});
ok('tập tốt nhất: A(non-stack 300k) vs B+C(stack 200k+150k=350k) → chọn B+C', () => {
  const r = calcPromo_(items, [P({ id: 'A', name: 'A', type: 'amount', value: 300000 }), P({ id: 'B', name: 'B', type: 'amount', value: 200000, stackable: true }), P({ id: 'C', name: 'C', type: 'amount', value: 150000, stackable: true })], { date: D });
  assert.strictEqual(r.discount, 350000); assert.strictEqual(r.applied.map(x => x.id).sort().join(), 'B,C');
});
ok('quà + giảm giá cùng lúc cho tập hợp (gift stackable)', () => {
  const r = calcPromo_(items, [P({ id: 'a', name: 'a', type: 'percent', value: 10, stackable: true }), P({ id: 'g', name: 'g', type: 'gift', gift: 'Hộp', stackable: true })], { date: D });
  assert.strictEqual(r.discount, 250000); assert.strictEqual(r.gifts.length, 1);
});
ok('tổng giảm không vượt tổng tiền', () => {
  const r = calcPromo_([{ name: 'x', qty: 1, price: 100 }], [P({ id: 'a', name: 'a', type: 'amount', value: 90, stackable: true }), P({ id: 'b', name: 'b', type: 'amount', value: 90, stackable: true })], { date: D });
  assert.ok(r.discount <= 100 && r.total >= 0);
});
ok('chuẩn hoá: loại CT sai (thiếu tên, % > 100, combo thiếu giá)', () => {
  assert.strictEqual(promoNormalize_([{ name: '', type: 'percent', value: 5 }, { name: 'a', type: 'percent', value: 150 }, { name: 'b', type: 'combo', comboQty: 2 }, { name: 'c', type: 'zzz' }]).length, 0);
});
ok('chuẩn hoá nhận chuỗi JSON và {promos:[]}, bỏ id trùng', () => {
  const s = JSON.stringify({ v: 1, promos: [{ id: 'a', name: 'a', type: 'percent', value: 5 }, { id: 'a', name: 'dup', type: 'percent', value: 6 }] });
  assert.strictEqual(promoNormalize_(s).length, 1); assert.strictEqual(promoNormalize_('xx').length, 0);
});
ok('giỏ rỗng / qty 0', () => { const r = calcPromo_([{ name: 'a', qty: 0, price: 5 }], [P({ id: 'a', name: 'a', type: 'percent', value: 5 })], { date: D }); assert.strictEqual(r.total, 0); });
console.log('\nOK', n, 'ca');
// Bản sao trong extension phải GIỐNG HỆT nguồn (quy tắc: sửa js/53 thì chép lại sang các extension)
const src = fs.readFileSync(__dirname + '/../js/53-fn-promo-engine.js', 'utf8');
for (const f of ['extension-pancake/pancake-promo.js']) {
  const p = __dirname + '/../' + f;
  if (fs.existsSync(p)) { assert.strictEqual(fs.readFileSync(p, 'utf8'), src, f + ' lệch khỏi js/53-fn-promo-engine.js — chạy: cp js/53-fn-promo-engine.js ' + f); console.log('✓ bản sao ' + f + ' khớp'); }
}
