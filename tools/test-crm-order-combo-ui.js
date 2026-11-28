// Test chọn "Combo có sẵn" ở màn Tạo đơn (js/99-d-crm-order.js). Chạy: node tools/test-crm-order-combo-ui.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const g = { normPhone_: p => String(p).replace(/\D/g, '').replace(/^84/, '0') }; vm.createContext(g); vm.runInContext(fs.readFileSync(path.join(root, 'gas/35_CrmOrder.gs'), 'utf8'), g);
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '', value: '' });
['co-cmb', 'co-cmb-res', 'co-promo', 'co-promo-res', 'co-f-discValue'].forEach(fakeEl);
const COMBOS = [
  { code: 'CB1', name: 'Combo Ngũ hành', usable: true, priceVnd: 3000000, discount: 300000, finalPrice: 2700000, freeship: true, ship: 0, gifts: [],
    items: [{ name: 'VÒNG TAY NGŨ ĐIỀU', chatLieu: 'Cẩm thạch', size: 'S', qty: 1, price: 1650000, gift: false }, { name: 'NHẪN BẠC', chatLieu: 'Bạc 925', size: '12', qty: 1, price: 1350000, gift: false }, { name: 'Túi tiền', qty: 1, price: 0, gift: true }] },
  { code: 'CB2', name: 'Combo chưa có giá món', usable: true, priceVnd: 2000000, discount: 0, finalPrice: 2000000, freeship: false, ship: 30000, gifts: [{ name: 'Quà CTKM', gift: 'Hộp quà' }],
    items: [{ name: 'MẶT DÂY', qty: 2, price: 0, gift: false }, { name: 'DÂY', qty: 1, price: 0, gift: false }] },
  { code: 'CB3', name: 'Combo hết hạn', usable: false, priceVnd: 1, discount: 0, finalPrice: 1, items: [{ name: 'X', qty: 1, price: 1 }] },
  { code: 'CB4', name: 'Combo giá cao hơn niêm yết', usable: true, priceVnd: 500000, discount: 0, finalPrice: 500000, items: [{ name: 'A', qty: 1, price: 300000 }, { name: 'B', qty: 1, price: 100000 }] },
  { code: 'CB5', name: 'Vòng cầu đơn', usable: true, priceVnd: 3300000, discount: 0, finalPrice: 3300000, freeship: false, ship: 0, gifts: [],
    items: [{ name: 'CHARM BI MÂU SÔ 10 SIZE 3', qty: 2, price: 380, gift: false }, { name: 'CHUỖI LAM THỦY 6 LI', qty: 1, price: 1550, gift: false }, { name: 'HẠT ĐÔNG ĐIÊU LAM THỦY', qty: 1, price: 990, gift: false }] },
  { code: 'CB6', name: 'Vòng cầu đơn (món chưa lưu giá)', usable: true, priceVnd: 3300000, discount: 0, finalPrice: 3300000, freeship: false, ship: 0, gifts: [],
    items: [{ name: 'CHARM BI MÂU SÔ 10 SIZE 3', qty: 2, price: 0, gift: false }, { name: 'CHUỖI LAM THỦY 6 LI', qty: 1, price: 0, gift: false }, { name: 'HẠT ĐÔNG ĐIÊU LAM THỦY', qty: 1, price: 0, gift: false }] },
  ,{ code: 'CB7', name: 'Vòng cầu đơn (GAS cũ, chỉ có itemsText)', usable: true, priceVnd: 3300000, discount: 0, finalPrice: 3300000, freeship: false, ship: 0, gifts: [],
    itemsText: 'CHARM BI MẪU SỐ 10 SIZE 3 |  |  | 2 | 10k | 380000 | \nCHUỖI LAM THỦY 6 LI | 1 VÒNG ĐƠN |  | 1 |  | 1550000 | \nHẠT ĐỒNG ĐIẾU LAM THỦY |  |  | 1 |  | 990000 | ',
    items: [{ name: 'CHARM BI MẪU SỐ 10 SIZE 3', qty: 2, gift: false }, { name: 'CHUỖI LAM THỦY 6 LI', qty: 1, gift: false }, { name: 'HẠT ĐỒNG ĐIẾU LAM THỦY', qty: 1, gift: false }] }
];
const POS = { 'CHARM BI': 380000, 'CHUOI LAM THUY': 1550000, 'HAT DONG DIEU': 990000 };
let urls = [];
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => id === 'xt-wrap-taodon' ? fakeEl(id) : (els[id] || null), addEventListener() {} },
  fetch: async (u) => { urls.push(u); return { json: async () => {
    if (/comboList/.test(u)) return { ok: true, total: COMBOS.length, count: COMBOS.length, rows: COMBOS };
    if (/posPrice/.test(u) && w.__posOn) { const q = JSON.parse(decodeURIComponent(u.split('q=')[1])); const strip = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').toUpperCase();
      return { ok: true, results: q.map(o => { const k = Object.keys(POS).find(n => strip(o.t).indexOf(n) === 0); return k ? { found: true, price: POS[k] } : { found: false }; }) }; }
    return {}; } }; },
  Math, Date, Number, String, Object, JSON, isFinite, setTimeout, clearTimeout, console, encodeURIComponent, Array, RegExp };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(root, 'js/99-d-crm-order.js'), 'utf8'), w);
(async () => {
  w._co = w._coBlank(); w._co.phone = '0912345678'; w._coRender();
  ok(/id="co-cmb"/.test(fakeEl('xt-wrap-taodon').innerHTML) && /Combo có sẵn/.test(fakeEl('co-cmb').innerHTML), 'form có nút Combo có sẵn');
  ok(urls.length === 0, 'chưa mở thì chưa gọi GAS');
  w._coCmbToggle(); await new Promise(r => setTimeout(r, 20));
  ok(urls.length === 1 && /action=comboList/.test(urls[0]), 'mở → gọi GAS comboList');
  const vis = w._coCmbVisible(); ok(vis.length === 6 && !vis.some(c => c.code === 'CB3'), 'chỉ hiện combo đang áp dụng (ẩn combo hết hạn)');
  ok(/Combo Ngũ hành/.test(fakeEl('co-cmb-res').innerHTML) && /2\.700\.000đ/.test(fakeEl('co-cmb-res').innerHTML) && /miễn ship/.test(fakeEl('co-cmb-res').innerHTML), 'danh sách: tên, giá sau giảm, miễn ship');
  // thêm combo 1: giá chia theo tỉ lệ, tổng = finalPrice
  w._coCmbAdd(0);
  let it = w._co.items; ok(it.length === 3, 'combo 1 → 2 món + 1 quà = 3 dòng');
  ok(it[0].price === 1485000 && it[1].price === 1215000 && it[0].price + it[1].price === 2700000, 'giá chia tỉ lệ: 1.485.000 + 1.215.000 = 2.700.000 (giá combo sau giảm)');
  ok(it[2].name === 'Túi tiền' && it[2].price === 0 && /Quà tặng/.test(it[2].note), 'quà trong combo = dòng 0đ');
  ok(it[0].note === 'Cẩm thạch · S' && it.every(x => x.comboName === 'Combo Ngũ hành'), 'ghi chú dòng = chất liệu · size; gắn tên combo');
  ok(w._co.freeShip === true, 'combo miễn ship → tick Miễn phí giao');
  let c = w._coCalc(w._coNow()); ok(c.total === 2700000 && c.orderDiscount === 0 && c.itemDiscount === 0, 'Cần thu 2.700.000, KHÔNG dùng ô giảm giá (để dành cho CTKM/thẻ)');
  ok(/Đã thêm combo/.test(fakeEl('co-cmb-res').innerHTML), 'báo đã thêm');
  // combo 2: chưa có giá từng món → gán cả giá combo vào món đầu, ship combo, quà CTKM
  w._co = w._coBlank(); await w._coCmbAdd(1); it = w._co.items;
  ok(it[0].qty === 2 && it[0].price * 2 === 2000000 && it[1].price === 0, 'combo chưa có giá món: cả 2.000.000 gán vào món đầu (SL2 × 1.000.000), món sau 0đ');
  ok(it.some(x => x.name === 'Hộp quà' && x.price === 0), 'quà CTKM của combo thành dòng 0đ');
  ok(w._co.shipFee === 30000 && !w._co.freeShip, 'combo có phí ship 30.000 → điền Phí vận chuyển (đang trống)');
  // combo 4: giá cao hơn niêm yết → giữ niêm yết + cảnh báo
  w._co = w._coBlank(); await w._coCmbAdd(2); ok(w._co.items[0].price === 300000 && w._co.items[1].price === 100000 && /cao hơn/.test(w._coCmb.msg), 'giá combo > niêm yết: giữ niêm yết + cảnh báo');
  // combo 5 (ví dụ Duyên): giá món lưu theo NGHÌN đồng (1550 / 990 / 380×2 = 3300) → phải ra đúng 1.550.000 / 990.000 / 380.000×2
  w._co = w._coBlank(); await w._coCmbAdd(3); it = w._co.items;
  ok(it.length === 3 && it[0].price === 380000 && it[0].qty === 2 && it[1].price === 1550000 && it[2].price === 990000, 'Vòng cầu đơn (giá nghìn đồng): 380.000×2, 1.550.000, 990.000');
  c = w._coCalc(w._coNow()); ok(c.total === 3300000, 'Vòng cầu đơn: Cần thu 3.300.000');
  // combo 6: món chưa lưu giá → tra giá POS rồi chia (có POS) / báo rõ (không có POS)
  w.__posOn = true; w._co = w._coBlank(); await w._coCmbAdd(4); it = w._co.items;
  ok(it[0].price === 380000 && it[1].price === 1550000 && it[2].price === 990000 && w._coCalc(w._coNow()).total === 3300000, 'món chưa có giá → tra POS: 380.000×2 + 1.550.000 + 990.000 = 3.300.000');
  w.__posOn = false; w._co = w._coBlank(); await w._coCmbAdd(4);
  ok(w._co.items[0].price * 2 === 3300000 && /đơn giá từng món/.test(w._coCmb.msg), 'không tra được giá → giữ cách cũ nhưng CẢNH BÁO rõ');
  // combo 7: GAS cũ (items không có giá, itemsText có giá) → đọc giá từ itemsText, không báo thiếu giá
  w.__posOn = false; w._co = w._coBlank(); await w._coCmbAdd(5); it = w._co.items;
  ok(it[0].price === 380000 && it[0].qty === 2 && it[1].price === 1550000 && it[2].price === 990000 && !/chưa có đơn giá/.test(w._coCmb.msg) && w._coCalc(w._coNow()).total === 3300000, 'GAS cũ: đọc giá từ itemsText → 3.300.000, không cảnh báo');
  // payload + server
  w._co = w._coBlank(); Object.assign(w._co, { phone: '0912345678', custName: 'An' }); await w._coCmbAdd(0);
  const P = w._coPayload(w._co); ok(/\[Combo: Combo Ngũ hành\]/.test(P.note), 'ghi chú đơn có tên combo');
  const sv = g._crmOrderNormalize_(P); ok(!sv.error && sv.order.total === 2700000, 'server nhận đơn combo, tổng 2.700.000 khớp');
  // xoá hết dòng combo → không còn ghi chú combo
  w._co.items = []; ok(!/Combo/.test(w._coPayload(w._co).note), 'xoá dòng combo → bỏ khỏi ghi chú');
  // kết hợp CTKM giá vẫn dùng ô giảm giá đơn riêng
  w._co = w._coBlank(); w._coCmbAdd(0); w._coDiscType('pct'); w._coDiscInput('10'); c = w._coCalc(w._coNow());
  ok(c.orderDiscount === 270000 && c.total === 2430000, 'combo + giảm đơn 10% vẫn cộng được: 2.430.000');
  // tìm combo
  urls = []; w._coCmb.q = 'ngu hanh'; await w._coCmbLoad(); ok(/q=ngu%20hanh/.test(urls[0]), 'tìm combo gửi từ khoá lên GAS');
  console.log('ALL PASS');
})().catch(e => { console.error('ERR', e); process.exit(1); });
