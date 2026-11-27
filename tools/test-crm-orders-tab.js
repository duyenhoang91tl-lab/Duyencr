#!/usr/bin/env node
// Test tab "🧾 Đơn CRM" (js/99-d-crm-orders.js): hàm thuần, HTML + escape, lọc/tổng, tải GAS (token, khoảng ngày), lỗi, bỏ kết quả cũ, đăng ký tab.
// Chạy: node tools/test-crm-orders-tab.js -> "ALL CRM ORDERS TAB TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const calls = [], resolvers = [], wrap = { innerHTML: '' }, list = { innerHTML: '' }; const reg = {};
let reply = null;
const ctx = { console, Date, JSON, Math, Number, String, Object, Array, setTimeout, encodeURIComponent, Error,
  gsUrl: 'https://x/exec', localStorage: { getItem: k => k === 'ome_sess_token' ? 'TK en' : null },
  registerExtraTab: (id, label, fn) => { reg[id] = { label, fn }; },
  document: { getElementById: id => id === 'xt-wrap-crmorders' ? wrap : id === 'cro-list' ? list : null },
  fetch: url => { calls.push(url); const rp = reply; return new Promise(res => resolvers.push(() => res({ json: async () => rp(url) }))); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '99-d-crm-orders.js'), 'utf8'), ctx, { filename: '99-d-crm-orders.js' });
const run = s => vm.runInContext(s, ctx), flush = () => new Promise(r => setTimeout(r, 5));
const O1 = { orderId: 'CRM261127-0001', status: 'Mới', createdAt: new Date(2026, 10, 27, 9, 5).getTime(), createdBy: 'duyen', custName: 'Lan <b>', phone: '912345678', saleName: 'anhNP1999', tags: 'vip',
  items: [{ code: 'N01', name: 'Nhẫn "A"', qty: 1, price: 990000, discType: 'pct', discValue: 10, discount: 99000, amount: 891000, note: 'size 12' }],
  qty: 1, gross: 990000, itemDiscount: 99000, orderDiscount: 0, shipFee: 40000, surcharge: 0, total: 931000, paid: 300000, due: 631000, recvName: 'Lan', address: '1 Lê Lợi', province: 'HCM', note: 'giao giờ HC <script>', printNote: '' };
O1.tax = 72000; O1.items[0].taxPct = 8; O1.items[0].tax = 72000;
const O2 = { orderId: 'CRM261127-0002', status: 'Mới', createdAt: new Date(2026, 10, 27, 10, 0).getTime(), custName: 'Mai', phone: '987654321', saleName: 'dungnguyen1995', items: [{ name: 'Vòng', qty: 2, price: 625000, discount: 0, amount: 1250000 }],
  qty: 2, gross: 1250000, itemDiscount: 0, orderDiscount: 0, shipFee: 40000, surcharge: 0, total: 1290000, paid: 1290000, due: 0 };
// ── hàm thuần
ok(run('_croVnd(931000)') === '931.000đ' && run('_croVnd(0)') === '0đ' && run('_croVnd("x")') === '0đ', 'format tiền');
ok(run('_croDmyHm(' + O1.createdAt + ')') === '27/11/2026 09:05' && run('_croDmyHm("")') === '', 'format ngày giờ');
ok(run('_croAddDays("2026-11-01", -1)') === '2026-10-31', 'cộng ngày qua tháng');
ok(run('_croFiltered(' + JSON.stringify([O1, O2]) + ', "")').length === 2, 'không tìm = tất cả');
ok(run('_croFiltered(' + JSON.stringify([O1, O2]) + ', "NHAN")').length === 1, 'tìm theo tên SP, không dấu');
ok(run('_croFiltered(' + JSON.stringify([O1, O2]) + ', "mai")')[0].orderId === 'CRM261127-0002', 'tìm theo tên khách');
ok(run('_croFiltered(' + JSON.stringify([O1, O2]) + ', "dung")').length === 1 && run('_croFiltered(' + JSON.stringify([O1, O2]) + ', "0002")').length === 1, 'tìm theo sale / mã đơn');
const T = run('_croTotals(' + JSON.stringify([O1, O2]) + ')'); ok(T.n === 2 && T.total === 2221000 && T.paid === 1590000 && T.due === 631000, 'tổng');
// ── HTML + escape
let h = run('_croCardHtml(' + JSON.stringify(O1) + ', false)');
ok(h.includes('931.000đ') && h.includes('thiếu 631.000đ') && h.includes('Lan &lt;b&gt;') && !h.includes('Lan <b>') && !h.includes('size 12'), 'thẻ đóng: số tiền, escape, chưa hiện chi tiết');
h = run('_croCardHtml(' + JSON.stringify(O1) + ', true)');
ok(h.includes('Nhẫn &quot;A&quot;') && h.includes('-99.000đ (10%)') && h.includes('891.000đ') && h.includes('size 12'), 'chi tiết: dòng SP + giảm %');
ok(h.includes('Thuế') && h.includes('72.000đ') && h.includes('Thuế 8%: +72.000đ'), 'chi tiết: thuế tổng + thuế dòng');
ok(h.includes('Tiền cần thu') && h.includes('Còn thiếu') && h.includes('631.000đ') && h.includes('Phí vận chuyển') && h.includes('40.000đ') && !h.includes('Phụ thu'), 'chi tiết: khối tiền (ẩn phụ thu = 0)');
ok(h.includes('giao giờ HC &lt;script&gt;') && !h.includes('<script>'), 'escape ghi chú');
ok(run('_croCardHtml(' + JSON.stringify(O2) + ', false)').includes('đã đủ'), 'đơn đủ tiền');
// ── tải
reply = () => ({ ok: true, scope: 'team', total: 2, orders: [O2, O1] });
run('_croSetRange("month")'); ok(calls.length === 1 && /action=crmOrders/.test(calls[0]) && /token=TK%20en/.test(calls[0]) && /from=\d{4}-\d{2}-01/.test(calls[0]) && /to=\d{4}-\d{2}-\d{2}/.test(calls[0]) && /limit=500/.test(calls[0]), 'gọi crmOrders có token + khoảng ngày');
ok(wrap.innerHTML.includes('Đang tải'), 'hiện đang tải');
(async () => {
  reply = () => ({ ok: true, total: 2, orders: [O2, O1] });
  resolvers.shift()(); await flush();
  ok(wrap.innerHTML.includes('CRM261127-0001') && wrap.innerHTML.includes('CRM261127-0002') && wrap.innerHTML.includes('Số đơn'), 'vẽ danh sách + tổng kết');
  ok(wrap.innerHTML.includes('đơn của team bạn làm trưởng'), 'hiện phạm vi xem theo scope');
  run('_croSel("CRM261127-0001")'); ok(list.innerHTML.includes('Tiền cần thu'), 'bấm đơn → mở chi tiết');
  run('_croSel("CRM261127-0001")'); ok(!list.innerHTML.includes('Tiền cần thu'), 'bấm lại → đóng');
  run('_croSetQ("mai")'); ok(list.innerHTML.includes('0002') && !list.innerHTML.includes('0001'), 'ô tìm lọc ngay');
  run('_croSetQ("zzz")'); ok(list.innerHTML.includes('Không có đơn nào khớp'), 'tìm không ra');
  run('_croSetQ("")');
  // cảnh báo bị cắt bớt
  reply = () => ({ ok: true, total: 900, orders: [O1] }); run('_croLoad()'); resolvers.shift()(); await flush();
  ok(wrap.innerHTML.includes('có 900 đơn') || wrap.innerHTML.includes('Có 900 đơn'), 'cảnh báo chỉ hiện đơn mới nhất');
  // lỗi GAS (chưa deploy / không quyền)
  reply = () => ({ ok: false, error: 'Unknown action' }); run('_croLoad()'); resolvers.shift()(); await flush();
  ok(wrap.innerHTML.includes('Unknown action') && wrap.innerHTML.includes('Thử lại'), 'hiện lỗi server + nút thử lại');
  reply = () => ({ ok: false }); run('_croLoad()'); resolvers.shift()(); await flush();
  ok(wrap.innerHTML.includes('cần deploy lại GAS'), 'không có error → nhắc deploy GAS');
  // kết quả muộn của lần tải cũ bị bỏ
  reply = () => ({ ok: true, total: 1, orders: [O1] }); run('_croLoad()');
  const oldR = resolvers.shift(); reply = () => ({ ok: true, total: 1, orders: [O2] }); run('_croLoad()'); const newR = resolvers.shift();
  newR(); await flush(); oldR(); await flush();
  ok(wrap.innerHTML.includes('0002') && !wrap.innerHTML.includes('CRM261127-0001'), 'lần tải cũ về muộn không đè lần mới');
  // đăng ký tab
  ok(reg.crmorders && reg.crmorders.label.includes('Đơn CRM'), 'đăng ký tab crmorders');
  console.log('ALL CRM ORDERS TAB TESTS PASSED');
})();
