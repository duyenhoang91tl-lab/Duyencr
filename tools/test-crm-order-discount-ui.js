// Test nút chọn giảm giá đ | % của màn Tạo đơn (js/99-d-crm-order.js). Chạy: node tools/test-crm-order-discount-ui.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '', value: '' });
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => id === 'xt-wrap-taodon' ? fakeEl(id) : (els[id] || null), addEventListener() {} },
  fetch: async () => ({ json: async () => ({}) }), Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/99-d-crm-order.js'), 'utf8'), w);
const html = () => fakeEl('xt-wrap-taodon').innerHTML;
w._co = w._coBlank(); w._co.items = [{ name: 'Vòng', note: '', qty: 1, price: 1650000, discType: 'amt', discValue: 0 }]; w._coRender();
ok(/_coDiscType\('amt'\)/.test(html()) && /_coDiscType\('pct'\)/.test(html()), 'giảm giá đơn có 2 nút đ và %');
ok(/_coItemDiscType\(0,'amt'\)/.test(html()) && /_coItemDiscType\(0,'pct'\)/.test(html()), 'giảm giá dòng có 2 nút đ và %');
ok(!/<select onchange="_coSet\('discType'/.test(html()), 'hộp chọn nhỏ cũ đã bỏ');
// đ: 100.000đ
w._coDiscInput('100000'); ok(w._coCalc(w._coNow()).orderDiscount === 100000 && w._coCalc(w._coNow()).total === 1550000, 'giảm 100.000đ → cần thu 1.550.000');
// chuyển sang %: giữ giá trị 100000 → kẹp 100% (không giảm quá)
w._coDiscType('pct'); ok(w._co.discType === 'pct' && w._co.discValue === 100, 'đổi sang % kẹp giá trị tối đa 100');
w._coDiscInput('10'); ok(w._coCalc(w._coNow()).orderDiscount === 165000 && w._coCalc(w._coNow()).total === 1485000, '10% của 1.650.000 = 165.000');
ok(/max="100"/.test(html()) && /% giảm/.test(html()), 'chế độ % có max=100 + gợi ý %');
w._coDiscType('amt'); ok(w._co.discType === 'amt', 'đổi lại về đ');
// dòng
w._coItemDiscType(0, 'pct'); w._coItemSet(0, 'discValue', 20);
ok(w._coCalc(w._coNow()).itemDiscount === 330000 && w._co.items[0].discType === 'pct', 'giảm dòng 20% = 330.000');
w._coItemDiscType(0, 'amt'); ok(w._co.items[0].discType === 'amt' && w._co.items[0].discValue === 20, 'đổi dòng về đ');
// payload gửi đúng kiểu
w._co.discType = 'pct'; w._co.discValue = 7; const P = w._coPayload(w._co); ok(P.discType === 'pct' && P.discValue === 7, 'payload gửi discType=pct, discValue=7');
console.log('ALL PASS');
