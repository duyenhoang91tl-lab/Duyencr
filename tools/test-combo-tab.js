#!/usr/bin/env node
// Test tab "Combo" (js/93-combo-tab.js): format giá, nội dung Copy, lọc đang áp dụng, bỏ kết quả tải chậm, hiện lỗi GAS, esc HTML.
// Chạy: node tools/test-combo-tab.js -> "ALL COMBO TAB TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const wrap = { innerHTML: '' }; const calls = []; let reply = null; const resolvers = [];
const ctx = { console, Date, JSON, Math, String, Number, Array, Object, setTimeout, clearTimeout, encodeURIComponent,
  gsUrl: 'https://x/exec', esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  document: { getElementById: id => id === 'xt-wrap-combo' ? wrap : null, activeElement: null },
  registerExtraTab: (id, label, fn) => { ctx._reg = { id, label, fn }; },
  fetch: url => { calls.push(url); return new Promise(res => resolvers.push(() => res({ json: async () => reply(url) }))); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '93-combo-tab.js'), 'utf8'), ctx, { filename: '93-combo-tab.js' });
const C1 = { code: 'CB1', name: 'Combo <Lắc> 4 lá', items: [{ name: 'Lắc cỏ 4 lá', chatLieu: 'Bạc 925', size: '16cm', qty: 1 }, { name: 'Nhẫn bạc trơn', chatLieu: '', size: 'Size 12', qty: 2 }],
  priceVnd: 1299000, priceText: '1.299', note: 'Chỉ online', end: '2026-12-31', usable: true, statusLabel: '✅ Còn áp dụng' };
const C2 = { code: 'CB2', name: 'Hết hạn', items: [{ name: 'Nhẫn', qty: 1 }], priceVnd: 0, priceText: '990', usable: false, statusLabel: '❌ Đã hết hạn' };
const run = s => vm.runInContext(s, ctx);
ok(ctx._reg && ctx._reg.id === 'combo', 'đăng ký tab combo');
ok(run('_cbVnd(1299000)') === '1.299.000đ' && run('_cbVnd(0)') === '', 'format giá');
const t = run('_cbCopyText(' + JSON.stringify(C1) + ')');
ok(t.split('\n')[0] === '🎁 Combo <Lắc> 4 lá (CB1)', 'dòng tên: ' + t);
ok(t.includes('Giá combo: 1.299.000đ') && t.includes('- Lắc cỏ 4 lá · Bạc 925 · 16cm × 1') && t.includes('- Nhẫn bạc trơn · Size 12 × 2'), 'món + giá: ' + t);
ok(t.includes('Lưu ý: Chỉ online') && t.includes('Áp dụng đến hết 31/12/2026'), 'ghi chú + hạn');
ok(run('_cbCopyText(' + JSON.stringify(C2) + ')').includes('Giá combo: 990'), 'không có priceVnd thì dùng priceText');
(async () => {
  // tải thành công: mặc định chỉ hiện combo usable, ẩn combo hết hạn; escape HTML tên
  reply = () => ({ ok: true, total: 2, rows: [C1, C2] });
  const p = run('_cbLoad()'); resolvers.shift()(); await p;
  ok(calls[0].includes('action=comboList&q='), 'gọi action comboList');
  ok(wrap.innerHTML.includes('Combo &lt;Lắc&gt; 4 lá') && !wrap.innerHTML.includes('<Lắc>'), 'escape tên combo');
  ok(wrap.innerHTML.includes('1.299.000đ') && !wrap.innerHTML.includes('Hết hạn</div>'), 'ẩn combo hết hạn mặc định');
  ok(wrap.innerHTML.includes('ẩn 1 combo'), 'báo số combo ẩn');
  run('_cbToggleAll()'); ok(wrap.innerHTML.includes('Hết hạn'), 'xem tất cả hiện combo hết hạn');
  // kết quả chậm của lần tải cũ bị bỏ
  run('_cb.q="a"'); reply = u => ({ ok: true, total: 1, rows: [Object.assign({}, C1, { name: u.includes('q=a') ? 'CU' : 'MOI' })] });
  const p1 = run('_cbLoad()'); run('_cb.q="b"'); const p2 = run('_cbLoad()');
  const r1 = resolvers.shift(), r2 = resolvers.shift(); r2(); await p2; r1(); await p1;
  ok(wrap.innerHTML.includes('MOI') && !wrap.innerHTML.includes('CU<'), 'bỏ kết quả tải chậm');
  // GAS chưa deploy
  reply = () => ({ error: 'Unknown action' }); const p3 = run('_cbLoad()'); resolvers.shift()(); await p3;
  ok(wrap.innerHTML.includes('Unknown action'), 'hiện lỗi GAS');
  reply = () => ({ ok: true, total: 0, rows: [] }); const p4 = run('_cbLoad()'); resolvers.shift()(); await p4;
  ok(wrap.innerHTML.includes('chưa có combo nào'), 'sheet trống có hướng dẫn');
  console.log('ALL COMBO TAB TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
