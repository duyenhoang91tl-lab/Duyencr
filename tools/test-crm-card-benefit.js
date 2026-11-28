#!/usr/bin/env node
// Test quyền lợi thẻ ở màn Tạo đơn (js/99-e-crm-card-benefit.js): chữ ký, nhãn ngắn, điền giảm %/miễn ship, bấm "Áp dụng", debounce + bỏ kết quả cũ,
// không gọi khi thiếu SĐT/sản phẩm, lỗi GAS hiện nhãn ngắn. Chạy: node tools/test-crm-card-benefit.js -> "ALL CRM CARD BENEFIT TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const calls = [], bodies = [], resolvers = [], host = { id: '', style: {}, innerHTML: '' }; let reply = null, renders = 0, summaries = 0, hostAttached = null;
const loy = { parentNode: { insertBefore: h => { hostAttached = h; } } };
const ctx = { console, Date, JSON, Math, Number, String, Object, Array, setTimeout, clearTimeout, module: undefined, gsUrl: 'https://x/exec',
  _coEsc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  _co: { phone: '0912345678', freeShip: false, items: [{ name: 'Nhẫn bạc', qty: 1, price: 1500000, discType: 'amt', discValue: 0 }, { name: 'Charm 24k', qty: 1, price: 500000, discType: 'amt', discValue: 0 }] },
  _coRender() { renders++; }, _coSummary() { summaries++; },
  document: { getElementById: id => id === 'co-loy' ? loy : id === 'co-card-benefit' ? hostAttached : null, createElement: () => host },
  fetch: (url, o) => { calls.push(url); bodies.push(JSON.parse(o.body)); return new Promise(res => resolvers.push(() => res({ json: async () => reply(JSON.parse(o.body)) }))); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '99-e-crm-card-benefit.js'), 'utf8'), ctx, { filename: '99-e-crm-card-benefit.js' });
const run = s => vm.runInContext(s, ctx), J = x => JSON.stringify(x), flush = () => new Promise(r => setTimeout(r, 5));
const Q_VIP = { ok: true, level: 'vip', label: 'Thẻ VIP (mua lại)', discount: 75000, freeShip: true, lines: [{ name: 'Nhẫn bạc', pct: 5, rule: 'full' }, { name: 'Charm 24k', pct: 0, rule: 'excluded' }] };
// ── chữ ký: đổi SĐT/tên/SL/giá thì đổi; đổi giảm giá/ship thì KHÔNG đổi
const sig0 = run('_cbnSig(_co)');
run('_co.items[0].discValue = 7; _co.freeShip = true'); ok(run('_cbnSig(_co)') === sig0, 'giảm giá/ship không đổi chữ ký (bấm Áp dụng không gọi lại báo giá)');
run('_co.items[0].discValue = 0; _co.freeShip = false');
run('_co.items[0].qty = 2'); ok(run('_cbnSig(_co)') !== sig0, 'đổi số lượng → đổi chữ ký'); run('_co.items[0].qty = 1');
ok(sig0.startsWith('0912345678|'), 'SĐT chỉ giữ chữ số');
// ── nhãn
let h = run('_cbnHtml(' + J(Q_VIP) + ', "", _co)');
ok(h.includes('Thẻ VIP (mua lại)') && h.includes('giảm 5%') && h.includes('−75.000đ') && h.includes('miễn ship') && h.includes('_cbnApply()'), 'nhãn VIP có nút Áp dụng: ' + h);
ok(run('_cbnHtml(' + J(Object.assign({}, Q_VIP, { level: 'none' })) + ', "", _co)') === '' && run('_cbnHtml(null, "", _co)') === '', 'chưa có thẻ / chưa có báo giá → không hiện gì (không thêm dòng chỉ dẫn)');
h = run('_cbnHtml(null, "Unknown action <x>", _co)'); ok(h.includes('Chưa tải được quyền lợi thẻ') && h.includes('Unknown action &lt;x&gt;'), 'lỗi: nhãn ngắn, chi tiết ở tooltip (đã escape)');
// ── áp dụng
run('_cbnApplyTo(' + J(Q_VIP) + ', _co)');
ok(run('_co.items[0].discType') === 'pct' && run('_co.items[0].discValue') === 5 && run('_co.items[1].discValue') === 0 && run('_co.freeShip') === true, 'điền 5% dòng thường, 0 cho mã không giảm, tick miễn ship');
ok(run('_cbnApplied(' + J(Q_VIP) + ', _co)') === true && run('_cbnHtml(' + J(Q_VIP) + ', "", _co)').includes('Đã áp dụng'), 'sau khi áp dụng hiện ✓');
run('_co.items[1].discType = "amt"; _co.items[1].discValue = 30000'); ok(run('_cbnApplied(' + J(Q_VIP) + ', _co)') === false, 'sale tự nhập giảm cho mã không giảm → hiện lại nút Áp dụng');
run('_co.items[0].discType = "amt"; _co.items[0].discValue = 0; _co.items[1].discValue = 0; _co.freeShip = false');
// ── tải: debounce, đúng nội dung, bỏ kết quả cũ, không gọi khi thiếu dữ liệu
(async () => {
  reply = () => Q_VIP; run('_cbnSchedule(); _cbnSchedule(); _cbnSchedule()'); await new Promise(r => setTimeout(r, 600));
  ok(calls.length === 1, 'debounce: 3 lần đổi liên tiếp chỉ gọi 1 lần, có ' + calls.length);
  ok(bodies[0].action === 'loyaltyBenefitQuote' && bodies[0].phone === '0912345678' && bodies[0].items.length === 2 && bodies[0].items[0].name === 'Nhẫn bạc' && bodies[0].items[0].price === 1500000, 'POST đúng nội dung: ' + J(bodies[0]));
  resolvers.shift()(); await flush(); ok(run('_cbn.q').level === 'vip' && hostAttached && hostAttached.innerHTML.includes('Thẻ VIP'), 'có báo giá → hiện nhãn ở khối gắn cạnh #co-loy');
  run('_cbnLoad()'); await flush(); ok(calls.length === 1, 'chữ ký không đổi → không gọi lại');
  // đổi nhanh 2 lần: kết quả cũ bị bỏ
  run('_co.items[0].price = 1600000'); reply = b => Object.assign({}, Q_VIP, { label: 'CU' }); const p1 = run('_cbnLoad()');
  run('_co.items[0].price = 1700000'); reply = b => Object.assign({}, Q_VIP, { label: 'MOI' }); const p2 = run('_cbnLoad()');
  const r1 = resolvers.shift(), r2 = resolvers.shift(); r2(); await p2; r1(); await p1;
  ok(run('_cbn.q').label === 'MOI', 'kết quả cũ bị bỏ');
  // thiếu SĐT → không gọi, xoá nhãn
  const n = calls.length; run('_co.phone = "09"'); await run('_cbnLoad()'); ok(calls.length === n && run('_cbn.q') === null, 'SĐT thiếu → không gọi, xoá báo giá');
  run('_co.phone = "0912345678"; _co.items = [{ name: "", qty: 1, price: 0 }]'); await run('_cbnLoad()'); ok(calls.length === n, 'chưa có sản phẩm hợp lệ → không gọi');
  // lỗi GAS
  run('_co.items = [{ name: "Nhẫn", qty: 1, price: 100000 }]'); reply = () => ({ error: 'Unknown action' }); const pe = run('_cbnLoad()'); resolvers.shift()(); await pe;
  ok(run('_cbn.err') === 'Unknown action' && hostAttached.innerHTML.includes('Chưa tải được'), 'lỗi GAS → nhãn ngắn');
  // bấm Áp dụng gọi _coRender (dựng lại form)
  run('_cbn.q = ' + J(Q_VIP) + '; _cbn.err = ""'); const r0 = renders; run('_cbnApply()'); ok(renders === r0 + 1, 'Áp dụng → dựng lại form để ô giảm giá cập nhật');
  // wrapper: _coRender/_coSummary vẫn chạy bản gốc
  const s0 = summaries; run('_coSummary()'); ok(summaries === s0 + 1, 'bản gốc _coSummary vẫn được gọi');
  console.log('ALL CRM CARD BENEFIT TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
