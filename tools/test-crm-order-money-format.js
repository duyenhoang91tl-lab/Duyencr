// Test ô tiền hiện dấu chấm ngăn hàng nghìn ở màn Tạo đơn (js/99-d-crm-order.js). Chạy: node tools/test-crm-order-money-format.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '', value: '' });
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => id === 'xt-wrap-taodon' ? fakeEl(id) : (els[id] || null), addEventListener() {} },
  fetch: async () => ({ json: async () => ({}) }), Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/99-d-crm-order.js'), 'utf8'), w);
const html = () => fakeEl('xt-wrap-taodon').innerHTML;
// ô giả lập: gõ chuỗi `v` với con trỏ ở `pos`
const typeIn = (v, pos) => ({ value: v, selectionStart: pos == null ? v.length : pos, setSelectionRange(a) { this.sel = a; } });

// 1) định dạng
ok(w._coFmtMoney(100000) === '100.000' && w._coFmtMoney(1650000) === '1.650.000' && w._coFmtMoney(999) === '999' && w._coFmtMoney(0) === '0', '_coFmtMoney: 100000→100.000, 1650000→1.650.000, 999, 0');
ok(w._coFmtMoney('') === '' && w._coFmtMoney(null) === '', '_coFmtMoney: rỗng/null → rỗng');

// 2) gõ vào ô Đơn giá của dòng: hiện dấu chấm + dữ liệu là số thuần
w._co = w._coBlank(); w._co.items = [{ name: 'Vòng', note: '', qty: 1, price: 1650000, discType: 'amt', discValue: 100000 }]; w._coRender();
ok(/Đơn giá \(đ\)<input type="text" inputmode="numeric"[^>]*value="1\.650\.000"/.test(html()), 'ô Đơn giá hiện 1.650.000 (không phải 1650000)');
ok(/Giảm giá dòng<span[^>]*><input type="text" inputmode="numeric"[^>]*value="100\.000"/.test(html()), 'ô Giảm giá dòng (đ) hiện 100.000');
let el = typeIn('1650000'); w._coMoneyItem(el, 0, 'price');
ok(el.value === '1.650.000' && w._co.items[0].price === 1650000, 'gõ 1650000 → ô hiện 1.650.000, dữ liệu = 1650000 (không bị đọc thành 1.65)');
el = typeIn('100000'); w._coMoneyItem(el, 0, 'discValue');
ok(el.value === '100.000' && w._co.items[0].discValue === 100000, 'giảm dòng 100000 → ô hiện 100.000, dữ liệu 100000');
ok(w._coCalc(w._coNow()).total === 1550000, 'tổng tiền tính đúng sau khi định dạng (1.650.000 − 100.000 = 1.550.000)');

// 3) gõ tiếp / xoá: định dạng lại, con trỏ giữ đúng chỗ
el = typeIn('1.6500', 6); w._coMoneyItem(el, 0, 'price');       // đang có 1.650 gõ thêm số 0 ở cuối → 16.500
ok(el.value === '16.500' && w._co.items[0].price === 16500, 'gõ thêm số: 1.6500 → 16.500');
el = typeIn('1.2345', 3); w._coMoneyItem(el, 0, 'price');       // con trỏ giữa dãy số
ok(el.value === '12.345' && el.sel === 2, 'con trỏ giữa dãy số giữ đúng chỗ: đang sau chữ số thứ 2 → vẫn sau chữ số thứ 2 (12|.345)');
el = typeIn('1.65', 4); w._coMoneyItem(el, 0, 'price');         // xoá bớt số 0
ok(el.value === '165' && w._co.items[0].price === 165, 'xoá bớt số → 165 (không còn dấu chấm thừa)');
el = typeIn('', 0); w._coMoneyItem(el, 0, 'price');
ok(el.value === '' && w._co.items[0].price === 0, 'xoá hết → rỗng, dữ liệu 0');
el = typeIn('abc12x345', 9); w._coMoneyItem(el, 0, 'price');
ok(el.value === '12.345' && w._co.items[0].price === 12345, 'ký tự lạ bị bỏ, chỉ giữ chữ số');
el = typeIn('0050000'); w._coMoneyItem(el, 0, 'price');
ok(el.value === '50.000' && w._co.items[0].price === 50000, 'bỏ số 0 đầu thừa: 0050000 → 50.000');

// 4) ô phí vận chuyển / phụ thu / đã chuyển khoản
w._co.shipFee = 30000; w._co.paid = 1000000; w._coRender();
ok(/id="co-f-shipFee" type="text" inputmode="numeric"[^>]*value="30\.000"/.test(html()), 'Phí vận chuyển hiện 30.000');
ok(/id="co-f-paid" type="text" inputmode="numeric"[^>]*value="1\.000\.000"/.test(html()), 'Đã chuyển khoản hiện 1.000.000');
el = typeIn('45000'); w._coMoneyNum(el, 'shipFee');
ok(el.value === '45.000' && w._co.shipFee === 45000, 'gõ phí ship 45000 → 45.000, dữ liệu 45000');

// 5) giảm giá đơn: tiền có dấu chấm, % giữ ô số (cho phép số lẻ)
w._co.items[0].price = 1650000; w._co.items[0].discValue = 0;   // đưa dòng về giá thật (các bước gõ trên đã đổi giá) để giảm đơn không bị kẹp về 0
w._co.discType = 'amt'; w._co.discValue = 50000; w._coRender();
ok(/id="co-f-discValue" type="text" inputmode="numeric"[^>]*value="50\.000"/.test(html()), 'Giảm giá đơn (đ) hiện 50.000');
el = typeIn('100000'); w._coMoneyDisc(el);
ok(el.value === '100.000' && w._coCalc(w._coNow()).orderDiscount === 100000, 'giảm đơn 100000 → hiện 100.000, tính giảm đúng 100000');
w._co.discType = 'pct'; w._co.discValue = 7.5; w._coRender();
ok(/id="co-f-discValue" type="number" min="0" max="100" value="7\.5"/.test(html()), 'giảm % vẫn là ô số, giữ 7.5 (không bị coi là dấu nghìn)');
w._co.items[0].discType = 'pct'; w._co.items[0].discValue = 12.5; w._coRender();
ok(/Giảm giá dòng<span[^>]*><input type="number" min="0" max="100" value="12\.5"/.test(html()), 'giảm % theo dòng giữ ô số, 12.5');

// 6) dữ liệu gửi đi vẫn là số thuần
w._co.discType = 'amt'; w._co.discValue = 100000; w._co.items[0].discType = 'amt'; w._co.items[0].discValue = 100000; w._co.items[0].price = 1650000;
const P = JSON.stringify(w._coNow ? w._coNow() : {});
ok(!/\d\.\d{3}/.test(P), 'dữ liệu đơn không chứa dấu chấm ngăn nghìn');
console.log('ALL PASS');
