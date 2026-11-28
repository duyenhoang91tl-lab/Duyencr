#!/usr/bin/env node
// Test IN ĐƠN CRM (js/99-d-crm-orders.js, bước 4d). Chạy: node tools/test-crm-order-print.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const list = { innerHTML: '' }; let doc = '', printed = 0, blocked = false;
const ctx = { console, Date, JSON, Math, Number, String, Object, Array, Error, encodeURIComponent, setTimeout: f => f(), registerExtraTab: () => {},
  document: { getElementById: id => id === 'cro-list' ? list : null },
  window: { open: () => blocked ? null : { document: { open() {}, write: h => { doc = h; }, close() {} }, focus() {}, print: () => { printed++; } } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '99-d-crm-orders.js'), 'utf8'), ctx);
const O = { orderId: 'CRM261128-0001', status: 'Đã xác nhận', createdAt: new Date(2026, 10, 28, 9, 5).getTime(), custName: 'Lan', phone: '0912345678', recvName: 'Mẹ <Lan>', recvPhone: '0987654321',
  address: '1 Lê Lợi', ward: 'P. Bến Nghé', province: 'TP.HCM', carrier: 'GHTK', saleName: 'anhNP', source: 'Facebook', tags: 'vip', note: 'NOI BO bi mat', printNote: 'Gọi trước khi giao <b>',
  items: [{ code: 'N01', name: 'Nhẫn "A"', note: 'size 12', qty: 2, price: 500000, amount: 1000000 }], gross: 1000000, itemDiscount: 0, orderDiscount: 100000, shipFee: 30000, total: 930000, paid: 300000, due: 630000 };
const h = ctx._croPrintHtml(O);
ok(/ĐƠN HÀNG CRM261128-0001/.test(h) && /28\/11\/2026 09:05/.test(h), 'mã đơn + ngày giờ');
ok(/Mẹ &lt;Lan&gt;/.test(h) && /0987654321/.test(h) && !/0912345678/.test(h) && /1 Lê Lợi, P\. Bến Nghé, TP\.HCM/.test(h), 'người nhận + SĐT nhận + địa chỉ');
ok(/Nhẫn &quot;A&quot;/.test(h) && /\[N01\]/.test(h) && /size 12/.test(h) && /1\.000\.000đ/.test(h), 'dòng sản phẩm');
ok(/Giảm giá<\/td><td class="r">-100\.000đ/.test(h) && /CÒN PHẢI THU<\/td><td class="r">630\.000đ/.test(h) && /930\.000đ/.test(h), 'tiền lấy đúng từ server');
ok(/Gọi trước khi giao &lt;b&gt;/.test(h), 'ghi chú in (đã escape)');
ok(!/NOI BO|anhNP|Facebook|vip/.test(h), 'không in ghi chú nội bộ / sale / nguồn / thẻ');
ok(!/KHÔNG GỬI/.test(h) && /ĐƠN ĐÃ HUỶ — KHÔNG GỬI/.test(ctx._croPrintHtml(Object.assign({}, O, { status: 'Hủy' }))) && /ĐƠN ĐÃ HOÀN/.test(ctx._croPrintHtml(Object.assign({}, O, { status: 'Hoàn' }))), 'đơn huỷ/hoàn đóng dấu không gửi');
const bare = ctx._croPrintHtml({ orderId: 'X', phone: '0912', custName: 'An', items: [] });
ok(/An/.test(bare) && /0912/.test(bare) && !/undefined|NaN|Địa chỉ:/.test(bare), 'đơn thiếu trường không ra undefined');
ctx._cro.data = { total: 1, orders: [O] };
ok(/In đơn/.test(ctx._croDetailHtml(O)), 'chi tiết đơn có nút In đơn');
ctx._croPrint('CRM261128-0001'); ok(/ĐƠN HÀNG CRM261128-0001/.test(doc) && printed === 1, 'bấm → mở cửa sổ, ghi phiếu, gọi in');
blocked = true; ctx._cro.sel = O.orderId; ctx._croPrint(O.orderId); ok(/chặn cửa sổ in/.test(list.innerHTML), 'popup bị chặn → báo');
console.log('ALL PASS');
