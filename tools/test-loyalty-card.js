#!/usr/bin/env node
// Test khối "🎖️ Hạng & điểm" trong hồ sơ khách (js/99-c-loyalty-card.js): xem trước giảm giá (cùng luật server), tải lười + cache,
// bỏ kết quả của khách cũ, trừ điểm (confirm, refKey chống bấm 2 lần giữ nguyên khi lỗi), escape HTML.
// Chạy: node tools/test-loyalty-card.js -> "ALL LOYALTY CARD TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const calls = [], bodies = [], resolvers = [], host = { id: '', style: {}, innerHTML: '' }, els = {};
const tabs = { parentNode: { insertBefore: h => { ctxHost.set(h); } } }; const ctxHost = { cur: null, set(h) { this.cur = h; } };
let reply = null, confirmAns = true; const toasts = [];
const ctx = { console, Date, JSON, Math, Number, String, Object, Array, setTimeout, encodeURIComponent, module: undefined,
  gsUrl: 'https://x/exec', currentPhone: '0912345678', toast: m => toasts.push(m), confirm: () => confirmAns, get uiConfirm() { return async (...a) => this.confirm(...a); },
  esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  document: { getElementById: id => id === 'dp-loy' ? ctxHost.cur : (els[id] || null), querySelector: () => tabs, createElement: () => host },
  fetch: (url, o) => { calls.push(url); if (o && o.body) bodies.push(JSON.parse(o.body)); return new Promise(res => resolvers.push(() => res({ json: async () => reply(url) }))); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '99-c-loyalty-card.js'), 'utf8'), ctx, { filename: '99-c-loyalty-card.js' });
const run = s => vm.runInContext(s, ctx), flush = () => new Promise(r => setTimeout(r, 5));
const DATA = { ok: true, phone: '912345678', tier: 'vip', tierLabel: 'Vip <b>', config: { pointValue: 1000 },
  tierHistory: [{ date: '2026-02-10', orderId: 'o', from: 'tt', to: 'vip', fromLabel: 'Ưu tiên', toLabel: 'Vip', cumulative: 31000000 }],
  points: { year: 2026, earned: 310, refunded: 30, redeemed: 40, balance: 240, deficit: 0, expired: 5, expiresOn: '2026-12-31' },
  ledger: [{ type: 'earn', date: '2026-03-10', points: 30, amount: 3000000, note: '' }, { type: 'redeem', date: '2026-04-01', points: 40, amount: 2000000, note: 'ghi chú' }] };
// ── hàm thuần
ok(run('_loyVnd(31000000)') === '31.000.000đ' && run('_loyVnd(0)') === '0đ', 'format tiền');
ok(run('_loyDmy("2026-03-10")') === '10/03/2026', 'format ngày');
let x = run('_loyPreview(2000000, 100, 240, 1000)'); ok(x.points === 100 && x.discount === 100000 && x.payable === 1900000, 'preview 100');
x = run('_loyPreview(2000000, 9999, 240, 1000)'); ok(x.points === 240, 'không vượt số dư');
x = run('_loyPreview(30500, 60, 240, 1000)'); ok(x.points === 30 && x.payable === 500, 'không vượt giá trị đơn');
x = run('_loyPreview("", "", 240)'); ok(x.points === 0 && x.payable === 0, 'trống');
ok(run('_loyLedgerLabel(' + JSON.stringify(DATA.ledger[1]) + ')') === '01/04/2026 · － Dùng 40 điểm (đơn 2.000.000đ) · ghi chú', 'nhãn sổ');
// ── HTML
let h = run('_loyBodyHtml(' + JSON.stringify(DATA) + ')');
ok(h.includes('Vip &lt;b&gt;') && !h.includes('Vip <b>'), 'escape tên hạng');
ok(h.includes('>240<') && h.includes('240.000đ') && h.includes('31/12/2026') && h.includes('Ưu tiên → <b>Vip</b>') && h.includes('tổng 31.000.000đ'), 'số dư + hết hạn + lịch sử hạng');
ok(!h.includes('disabled'), 'còn điểm → nút Trừ bật');
h = run('_loyBodyHtml(' + JSON.stringify(Object.assign({}, DATA, { points: { year: 2026, balance: 0, deficit: 30, earned: 0, refunded: 0, redeemed: 0 }, tierHistory: [], ledger: [] })) + ')');
ok(h.includes('disabled') && h.includes('Thiếu 30 điểm') && h.includes('chưa có đơn đủ điều kiện'), 'hết điểm: nút tắt, báo thiếu hụt');
// ── tải lười
run('_loyRender()'); ok(calls.length === 0 && host.innerHTML.includes('Hạng &amp; điểm') && !host.innerHTML.includes(' open'), 'mở hồ sơ KHÔNG gọi GAS, khối đóng');
(async () => {
  reply = () => DATA;
  run('_loyToggle({ open: true })'); resolvers.shift()(); await flush();
  ok(calls.length === 1 && calls[0].includes('action=loyaltyGet&phone=0912345678'), 'bấm mở mới gọi loyaltyGet: ' + calls[0]);
  ok(host.innerHTML.includes('Vip &lt;b&gt; · 240 điểm') && host.innerHTML.includes(' open'), 'tiêu đề hiện hạng + điểm');
  run('_loyLoad(false)'); await flush(); ok(calls.length === 1, 'cache 60s không gọi lại');
  // đổi khách giữa chừng → bỏ kết quả cũ
  ctx.currentPhone = '0988000111'; reply = () => Object.assign({}, DATA, { phone: '988000111', tierLabel: 'MOI' });
  const p = run('_loyLoad(false)'); ctx.currentPhone = '0999999999'; resolvers.shift()(); await p;
  ok(!host.innerHTML.includes('MOI'), 'kết quả của khách cũ bị bỏ');
  // lỗi GAS chưa deploy
  ctx.currentPhone = '0912345678'; reply = () => ({ error: 'Unknown action' }); run('_loyLoad(true)'); resolvers.shift()(); await flush();
  ok(host.innerHTML.includes('Unknown action') && host.innerHTML.includes('Thử lại'), 'lỗi hiện + nút thử lại');
  reply = () => DATA; run('_loyLoad(true)'); resolvers.shift()(); await flush();
  // ── trừ điểm
  const set = (ov, pt) => { els['loy-ov'] = { value: ov }; els['loy-pt'] = { value: pt }; };
  bodies.length = 0; set('2000000', '100'); confirmAns = false; await run('_loyRedeem()'); ok(!bodies.length, 'hủy xác nhận → không POST');
  set('', '100'); confirmAns = true; await run('_loyRedeem()'); ok(!bodies.length && ctx._loy.msg.includes('Nhập giá trị đơn'), 'đơn trống → không POST');
  set('2000000', '100'); reply = () => ({ error: 'loi tam' }); let pr = run('_loyRedeem()'); await flush(); resolvers.shift()(); await pr; const ref1 = bodies[0].refKey;
  ok(bodies[0].action === 'loyaltyRedeem' && bodies[0].phone === '0912345678' && bodies[0].orderValue === 2000000 && bodies[0].points === 100 && ref1, 'POST đúng nội dung: ' + JSON.stringify(bodies[0]));
  ok(ctx._loy.msg.includes('loi tam'), 'hiện lỗi server'); resolvers.shift && 0;
  while (resolvers.length) resolvers.shift()();
  await flush();
  reply = u => /loyaltyGet/.test(u) ? DATA : { ok: true, redeemed: { points: 100, discount: 100000, payable: 1900000 }, points: { balance: 140 } };
  pr = run('_loyRedeem()'); await flush(); resolvers.shift()(); await pr; await flush(); while (resolvers.length) resolvers.shift()(); await flush();
  ok(bodies[1].refKey === ref1, 'thử lại sau lỗi DÙNG LẠI refKey (chống trừ 2 lần)');
  ok(ctx._loy.msg.includes('Đã trừ 100 điểm') && ctx._loy.msg.includes('100.000đ') && ctx._loy.msg.includes('1.900.000đ') && toasts.some(t => t.includes('100 điểm')), 'báo thành công + số tiền');
  ok(ctx._loy.refKey === '', 'thành công → đổi refKey cho lần sau');
  reply = u => /loyaltyGet/.test(u) ? DATA : { ok: false, code: 'DUPLICATE' };
  pr = run('_loyRedeem()'); await flush(); resolvers.shift()(); await pr; await flush(); while (resolvers.length) resolvers.shift()(); await flush();
  ok(ctx._loy.msg.includes('đã được ghi trước đó'), 'DUPLICATE báo không trừ lại');
  // ── hoàn tác (admin)
  const L2 = Object.assign({}, DATA, { ledger: [{ key: 'redeem|p|1', type: 'redeem', date: '2026-04-01', points: 40, amount: 2000000, note: '' }, { key: 'redeem|p|0', type: 'redeem', date: '2026-03-01', points: 10, amount: 500000, note: '', undone: true }, { type: 'undo', date: '2026-03-02', points: 10, amount: 500000, note: 'hoan tac' }] });
  ctx.currentUser = { role: 'sale' }; let hh = run('_loyBodyHtml(' + JSON.stringify(L2) + ')');
  ok(!hh.includes('_loyUndo') && hh.includes('<s ') && hh.includes('đã hoàn tác') && hh.includes('＋ Hoàn tác dùng điểm'), 'sale không thấy nút ↩; dòng đã hoàn tác bị gạch');
  ctx.currentUser = { role: 'admin' }; hh = run('_loyBodyHtml(' + JSON.stringify(L2) + ')');
  ok(hh.includes('_loyUndo(0)') && !hh.includes('_loyUndo(1)') && !hh.includes('_loyUndo(2)'), 'admin chỉ thấy ↩ ở lần dùng CHƯA hoàn tác');
  ctx._loy.data = L2; ctx._loy.phone = '0912345678'; bodies.length = 0; confirmAns = false; await run('_loyUndo(0)'); ok(!bodies.length, 'hủy xác nhận → không POST');
  confirmAns = true; reply = u => /loyaltyGet/.test(u) ? DATA : { ok: true, undone: { points: 40 } };
  pr = run('_loyUndo(0)'); await flush(); resolvers.shift()(); await pr; await flush(); while (resolvers.length) resolvers.shift()(); await flush();
  ok(bodies[0].action === 'loyaltyUndo' && bodies[0].key === 'redeem|p|1' && bodies[0].phone === '0912345678' && ctx._loy.msg.includes('Đã hoàn tác 40 điểm'), 'POST loyaltyUndo đúng key: ' + JSON.stringify(bodies[0]));
  ctx.currentUser = { role: 'sale' }; ctx._loy.data = L2; bodies.length = 0; await run('_loyUndo(0)'); ok(!bodies.length, 'non-admin gọi thẳng cũng không POST');
  console.log('ALL LOYALTY CARD TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
