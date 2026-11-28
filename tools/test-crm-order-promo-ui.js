// Test ô "Áp dụng CTKM" màn Tạo đơn (js/99-d-crm-order.js + engine js/53). Chạy: node tools/test-crm-order-promo-ui.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const g = { normPhone_: p => String(p).replace(/\D/g, '').replace(/^84/, '0') }; vm.createContext(g); vm.runInContext(fs.readFileSync(path.join(root, 'gas/35_CrmOrder.gs'), 'utf8'), g);
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '', value: '' });
const PROMOS = [
  { id: 'p10', name: 'Giảm 10% vòng', type: 'percent', value: 10, products: ['vong'], stackable: true },
  { id: 'pq', name: 'Tặng túi', type: 'gift', gift: 'Túi đựng', giftQty: 1, minAmount: 1000000, stackable: true },
  { id: 'pv', name: 'Voucher VIP50', type: 'voucher', code: 'VIP50', vkind: 'amount', value: 50000, stackable: true },
  { id: 'pe', name: 'Hết hạn', type: 'percent', value: 50, end: '2020-01-01' }
];
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => id === 'xt-wrap-taodon' ? fakeEl(id) : (els[id] || null), addEventListener() {} },
  fetch: async (u) => ({ json: async () => (/getSettings/.test(u) ? { values: { promoConfig: JSON.stringify({ v: 1, promos: PROMOS }) } } : {}) }),
  Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent, Array, RegExp };
w.window = w; vm.createContext(w);
vm.runInContext(fs.readFileSync(path.join(root, 'js/53-fn-promo-engine.js'), 'utf8'), w);
vm.runInContext(fs.readFileSync(path.join(root, 'js/99-d-crm-order.js'), 'utf8'), w);
const html = () => fakeEl('xt-wrap-taodon').innerHTML;
['co-promo', 'co-promo-res', 'co-f-discValue'].forEach(fakeEl);   // DOM giả: _coPromoRender ghi vào các phần tử này
(async () => {
  w._co = w._coBlank(); w._co.phone = '0912345678';
  w._co.items = [{ name: 'VÒNG TAY NGŨ ĐIỀU', note: '', qty: 1, price: 1650000, discType: 'amt', discValue: 0, taxPct: 0 }];
  w._coRender(); await w._coPromoLoad();
  ok(w._coPromo.list && w._coPromo.list.length === 4 && !w._coPromo.err, 'tải được cấu hình CTKM (4 CT)');
  ok(/id="co-promo"/.test(html()) && /Áp dụng CTKM/.test(fakeEl('co-promo').innerHTML), 'form có ô Áp dụng CTKM');
  let ev = w._coPromoEval(); ok(ev.discount === 165000 && ev.gifts.length === 1, 'đơn 1.650.000: giảm 10% vòng = 165.000 + tặng túi (CT hết hạn bị bỏ)');
  const res = () => fakeEl('co-promo-res').innerHTML;
  ok(/Giảm 10% vòng/.test(res()) && /Áp dụng CTKM \(−165\.000đ\)/.test(res()), 'liệt kê CTKM áp được + nút Áp dụng kèm số giảm');
  w._coPromoApply();
  ok(w._co.discType === 'amt' && w._co.discValue === 165000, 'Áp dụng → Giảm giá đơn = 165.000đ');
  ok(w._co.items.length === 2 && w._co.items[1].promoGift && w._co.items[1].price === 0 && w._co.items[1].name === 'Túi đựng', 'thêm dòng quà tặng 0đ');
  let c = w._coCalc(w._coNow()); ok(c.total === 1485000 && c.due === 1485000, 'Cần thu = 1.650.000 − 165.000 = 1.485.000');
  // tự cập nhật khi đổi số lượng
  w._coItemSet(0, 'qty', 2); c = w._coCalc(w._coNow()); ok(w._co.discValue === 330000 && c.total === 2970000, 'đổi SL=2 → giảm tự cập nhật 330.000, cần thu 2.970.000');
  // KHÔNG giảm 2 lần: giảm dòng 20% rồi CTKM tính trên giá sau giảm
  w._coItemDiscType(0, 'pct'); w._coItemSet(0, 'discValue', 20); c = w._coCalc(w._coNow());
  ok(c.itemDiscount === 660000 && w._co.discValue === 264000 && c.total === 3300000 - 660000 - 264000, 'giảm dòng 20% + CTKM 10% trên giá đã giảm (không giảm trùng): 2.376.000');
  w._coItemSet(0, 'discValue', 0); w._coItemDiscType(0, 'amt');
  // voucher
  w._coPromoCodes('vip50'); ok(w._co.discValue === 380000, 'nhập voucher vip50 → thêm 50.000: giảm 380.000 (khi đã áp thì tự cập nhật)');
  w._coPromoCodes('SAI'); ok(/Mã SAI: không có trong cấu hình/.test(fakeEl('co-promo-res').innerHTML), 'mã sai báo rõ');
  w._coPromoCodes('');
  // payload có tên CTKM; server nhận được dòng quà 0đ
  const P = w._coPayload(w._co); ok(/\[CTKM: Giảm 10% vòng, Tặng túi\]/.test(P.note), 'ghi chú đơn có tên CTKM đã áp');
  const sv = g._crmOrderNormalize_(P); ok(!sv.error && sv.order.total === w._coCalc(w._coNow()).total && sv.order.orderDiscount === w._co.discValue, 'server nhận đơn có CTKM + quà 0đ, tổng tiền KHỚP client');
  // sửa tay giảm giá đơn → thôi theo CTKM
  w._coDiscInput('1000'); ok(w._co.promoApplied === null, 'sửa tay Giảm giá đơn → thôi theo CTKM');
  w._coItemSet(0, 'qty', 3); ok(w._co.discValue === 1000, 'đã thôi theo CTKM: đổi SL không ghi đè số tay');
  // Bỏ CTKM
  w._coDiscInput('0'); w._coPromoApply(); w._coPromoClear();
  ok(w._co.promoApplied === null && w._co.discValue === 0 && !w._co.items.some(i => i.promoGift), 'Bỏ CTKM: về 0 + xoá quà');
  // chưa có SP / không CT phù hợp
  w._co.items = []; w._coRender(); ok(/Thêm sản phẩm/.test(fakeEl('co-promo-res').innerHTML), 'chưa có SP: nhắc thêm sản phẩm');
  w._co.items = [{ name: 'Nhẫn', qty: 1, price: 500000, discType: 'amt', discValue: 0 }]; w._coRender(); ok(/Chưa có CTKM nào phù hợp/.test(fakeEl('co-promo-res').innerHTML), 'SP không thuộc CTKM nào: báo chưa phù hợp');
  console.log('ALL PASS');
})().catch(e => { console.error('ERR', e); process.exit(1); });
