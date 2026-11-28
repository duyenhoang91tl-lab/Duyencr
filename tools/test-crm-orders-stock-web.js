#!/usr/bin/env node
// Test kết quả trừ kho + nút "Chạy lại trừ kho" ở tab Đơn CRM (js/99-d-crm-orders.js, bước 4c-2). Chạy: node tools/test-crm-orders-stock-web.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const bodies = [], list = { innerHTML: '' }; let reply = null, confirmAns = true;
const ctx = { console, Date, JSON, Math, Number, String, Object, Array, setTimeout, encodeURIComponent, Error,
  gsUrl: 'https://x/exec', currentUser: { role: 'admin' }, localStorage: { getItem: () => 'T' }, registerExtraTab: () => {}, uiConfirm: async () => confirmAns,
  document: { getElementById: id => id === 'cro-list' ? list : null },
  fetch: async (u, o) => { bodies.push(JSON.parse(o.body)); const r = reply(); return { json: async () => r }; } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '99-d-crm-orders.js'), 'utf8'), ctx);
const info = s => ctx._croStockInfo(s);
ok(info(null) === null, 'không có stock → không hiện gì');
ok(/TẮT/.test(info({ status: 'off' }).text) && !info({ status: 'off' }).warn, 'kho tắt');
ok(info({ status: 'held', reasons: ['Dong 1 chua co ma SP'] }).warn && /CHƯA trừ: Dong 1 chua co ma SP/.test(info({ status: 'held', reasons: ['Dong 1 chua co ma SP'] }).text), 'bị giữ + lý do');
const d = info({ status: 'deducted', lines: 2, shortage: ['A01 thieu 1'], unknown: ['DV'] });
ok(/đã trừ 2 dòng/.test(d.text) && /Thiếu tồn: A01 thieu 1/.test(d.text) && /bỏ qua\): DV/.test(d.text) && d.warn, 'đã trừ + thiếu + mã ngoài kho');
ok(!info({ status: 'deducted', lines: 1, shortage: [], unknown: [] }).warn, 'trừ đủ → không cảnh báo');
ok(/không trừ lần 2/.test(info({ status: 'already', lines: 3 }).text) && /cộng trả 2/.test(info({ status: 'returned', lines: 2 }).text) && /chưa trừ/.test(info({ status: 'none' }).text) && /không trừ/.test(info({ status: 'no_stock', unknown: [] }).text), 'các trạng thái còn lại');
const O = { orderId: 'CRM-1', status: 'Mới', phone: '0912345678', items: [] };
ctx._cro.data = { total: 1, orders: [O] }; ctx._cro.sel = 'CRM-1';
(async () => {
  ok(!/Chạy lại trừ kho/.test(ctx._croStatusHtml(O)), 'đơn Mới: chưa có nút chạy lại');
  reply = () => ({ ok: true, order: Object.assign({}, O, { status: 'Đã xác nhận' }), stock: { status: 'held', reasons: ['Dong 1 <x> chua co ma SP'] } });
  await ctx._croSetStatus('CRM-1', 'Đã xác nhận', '');
  ok(/Kho GIỮ đơn/.test(list.innerHTML) && /&lt;x&gt;/.test(list.innerHTML) && !/<x>/.test(list.innerHTML), 'đổi trạng thái → hiện kết quả kho (đã escape)');
  ok(/Chạy lại trừ kho/.test(list.innerHTML), 'admin thấy nút chạy lại');
  reply = () => ({ ok: true, order: Object.assign({}, O, { status: 'Đang giao' }), stock: null });
  await ctx._croSetStatus('CRM-1', 'Đang giao', '');
  ok(/Kho GIỮ đơn/.test(list.innerHTML), 'bước không đụng kho → vẫn giữ thông báo cũ');
  bodies.length = 0; reply = () => ({ ok: true, stock: { status: 'deducted', lines: 1, shortage: [] } });
  await ctx._croStockRetry('CRM-1');
  ok(bodies[0].action === 'crmOrderStockRetry' && bodies[0].orderId === 'CRM-1' && bodies[0].token === 'T' && /đã trừ 1 dòng/.test(list.innerHTML) && !ctx._cro.busy, 'chạy lại → gửi đúng, hiện kết quả');
  bodies.length = 0; confirmAns = false; await ctx._croStockRetry('CRM-1'); ok(bodies.length === 0, 'không xác nhận → không gửi');
  confirmAns = true; reply = () => ({ ok: false, error: 'Chi admin duoc chay lai tru kho.' }); await ctx._croStockRetry('CRM-1');
  ok(/Chi admin/.test(list.innerHTML) && !ctx._cro.busy, 'server từ chối → hiện lỗi');
  ctx.currentUser.role = 'cs'; bodies.length = 0; await ctx._croStockRetry('CRM-1');
  ok(bodies.length === 0 && !/Chạy lại trừ kho/.test(ctx._croStatusHtml(ctx._cro.data.orders[0])), 'không phải admin: ẩn nút, không gửi');
  console.log('ALL PASS');
})().catch(e => { console.error('ERR', e); process.exit(1); });
