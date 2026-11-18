#!/usr/bin/env node
// Test màn ADMIN combo (js/93-combo-tab.js, bước 4/6): chỉ admin thấy nút; kiểm tra nhập liệu; payload comboSave/comboDelete đúng; ánh xạ lỗi AUTH/FORBIDDEN;
// chống bấm Lưu 2 lần; xem trước giá (<100.000 = nghìn đồng như GAS); escape HTML; tải lại sau lưu/xoá; combo tắt → mở "xem tất cả".
// Chạy: node tools/test-combo-admin.js -> "ALL COMBO ADMIN TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.error('FAIL: ' + m); } else console.log('ok   ' + m); };
const wrap = { innerHTML: '' }, ppEl = { textContent: '' }, calls = [], toasts = [], confirms = []; let reply = null, confirmAnswer = true;
const ctx = { console, Date, JSON, Math, String, Number, Array, Object, parseInt, setTimeout, clearTimeout, encodeURIComponent, gsUrl: 'https://x/exec', currentUser: { role: 'admin', name: 'Duyen' },
  esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  toast: m => toasts.push(m), confirm: m => { confirms.push(m); return confirmAnswer; },
  document: { getElementById: id => id === 'xt-wrap-combo' ? wrap : id === 'cb-f-pp' ? ppEl : null, activeElement: null },
  registerExtraTab: () => {},
  fetch: (url, init) => { calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null }); return Promise.resolve({ json: async () => reply(url, init && init.body ? JSON.parse(init.body) : null) }); } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '93-combo-tab.js'), 'utf8'), ctx, { filename: '93-combo-tab.js' });
const run = s => vm.runInContext(s, ctx), posts = () => calls.filter(c => c.body);
const C1 = { code: 'CB1', name: 'Combo <Lắc> 4 lá', items: [{ name: 'Lắc cỏ 4 lá', chatLieu: 'Bạc 925', size: '16cm', qty: 1 }, { name: 'Nhẫn', chatLieu: '', size: '12', qty: 2 }], price: 1299000, priceVnd: 1299000, priceText: '1.299', note: 'Chỉ online', start: '2026-11-01', end: '2026-12-31', keywords: 'quà, 8/3', active: true, usable: true, statusLabel: '✅' };
const LIST = () => ({ ok: true, total: 1, rows: [C1] });
(async () => {
  reply = (u, b) => b ? { ok: true } : LIST();
  run('_cbLoad()'); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
  // --- quyền hiển thị
  ok(wrap.innerHTML.includes('＋ Thêm combo') && wrap.innerHTML.includes('✏️ Sửa') && wrap.innerHTML.includes('🗑 Xoá'), 'admin thấy nút Thêm/Sửa/Xoá');
  ctx.currentUser = { role: 'cs' }; run('_cbRender()');
  ok(!wrap.innerHTML.includes('Thêm combo') && !wrap.innerHTML.includes('✏️ Sửa') && !wrap.innerHTML.includes('🗑 Xoá') && wrap.innerHTML.includes('📋 Copy'), 'nhân viên KHÔNG thấy nút sửa (vẫn có Copy)');
  run('_cbNew()'); ok(run('_cb.form') === null, 'nhân viên gọi _cbNew bằng tay cũng không mở form'); run('_cbEdit(0)'); ok(run('_cb.form') === null, '... _cbEdit cũng không');
  ctx.currentUser = undefined; run('_cbRender()'); ok(!wrap.innerHTML.includes('Thêm combo'), 'chưa đăng nhập: không có nút admin');
  ctx.currentUser = { role: 'admin' }; run('_cbRender()');
  // --- form thêm mới
  run('_cbNew()'); ok(wrap.innerHTML.includes('＋ Thêm combo mới') && !wrap.innerHTML.includes('onclick="_cbNew()"'), 'mở form thêm; nút Thêm ẩn khi form đang mở');
  await run('_cbSave()'); ok(run('_cb.form.err') === 'Nhập tên combo.' && posts().length === 0, 'thiếu tên → báo, không gọi server');
  run('_cbFSet("name","  Combo A  ")'); await run('_cbSave()'); ok(/ít nhất 1 sản phẩm/.test(run('_cb.form.err')), 'thiếu sản phẩm');
  run('_cbFItem(0,"name","Nhẫn bạc")'); await run('_cbSave()'); ok(/giá combo/i.test(run('_cb.form.err')), 'thiếu giá');
  run('_cbFSet("priceText","abc")'); await run('_cbSave()'); ok(/giá combo/i.test(run('_cb.form.err')), 'giá không phải số');
  run('_cbFSet("priceText","850")'); ok(ppEl.textContent === '= 850.000đ', 'xem trước: 850 = 850.000đ (nghìn): ' + ppEl.textContent);
  run('_cbFSet("priceText","1.299.000")'); ok(ppEl.textContent === '= 1.299.000đ', 'xem trước: 1.299.000 = đồng đầy đủ');
  run('_cbFSet("priceText","99999")'); ok(ppEl.textContent === '= 99.999.000đ', 'ranh giới <100.000 vẫn là nghìn (giống _comboVnd_ GAS): ' + ppEl.textContent);
  run('_cbFSet("priceText","100000")'); ok(ppEl.textContent === '= 100.000đ', '100.000 là đồng đầy đủ');
  run('_cbFSet("priceText","850")'); run('_cbFSet("start","2026-12-31")'); run('_cbFSet("end","2026-12-01")'); await run('_cbSave()'); ok(/trước ngày bắt đầu/.test(run('_cb.form.err')) && posts().length === 0, 'ngày kết thúc trước ngày bắt đầu → báo, không gọi server');
  run('_cbFSet("start","")'); run('_cbFSet("end","")');
  run('_cbFAdd()'); run('_cbFItem(1,"name","  ")'); run('_cbFAdd()'); run('_cbFItem(2,"name","Lắc"); _cbFItem(2,"qty","3"); _cbFItem(2,"chatLieu"," Bạc ")');
  run('_cbFDel(1)'); ok(run('_cb.form.items.length') === 2, 'xoá hàng món');
  // --- lưu: payload + chống bấm đôi
  let release; reply = (u, b) => b ? new Promise(r => { release = () => r({ ok: true, code: 'CB260101', created: true }); }) : LIST();
  ctx.fetch = (url, init) => { calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null }); const b = init && init.body ? JSON.parse(init.body) : null; return Promise.resolve({ json: async () => reply(url, b) }); };
  const p1 = run('_cbSave()'); const p2 = run('_cbSave()');
  ok(posts().length === 1, 'bấm Lưu 2 lần chỉ gửi 1 request'); ok(wrap.innerHTML.includes('Đang lưu…') && wrap.innerHTML.includes('disabled'), 'nút Lưu bị khoá khi đang lưu');
  const pl = posts()[0].body;
  ok(pl.action === 'comboSave' && pl.combo.name === 'Combo A' && pl.combo.priceText === '850' && pl.combo.code === '' && pl.combo.active === true, 'payload: action/tên (đã trim)/giá gốc/mã trống (server tự sinh)');
  ok(JSON.stringify(pl.combo.items) === JSON.stringify([{ name: 'Nhẫn bạc', chatLieu: '', size: '', qty: 1 }, { name: 'Lắc', chatLieu: 'Bạc', size: '', qty: 3 }]), 'payload items: bỏ hàng trống, trim, SL: ' + JSON.stringify(pl.combo.items));
  await new Promise(r => setImmediate(r)); release(); await p1; await p2; await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
  ok(run('_cb.form') === null && /Đã thêm combo CB260101/.test(toasts[toasts.length - 1]), 'lưu xong: đóng form + toast mã mới');
  ok(calls.some(c => !c.body && c.url.includes('action=comboList')), 'lưu xong: tải lại danh sách');
  // --- sửa: nạp đủ trường, giữ mã, lưu đúng
  reply = (u, b) => b ? { ok: true, code: 'CB1', created: false } : LIST(); run('_cbEdit(0)');
  const f = JSON.parse(run('JSON.stringify(_cb.form)'));
  ok(f.code === 'CB1' && f.name === C1.name && f.priceText === '1.299' && f.start === '2026-11-01' && f.end === '2026-12-31' && f.keywords === 'quà, 8/3' && f.items.length === 2 && f.active === true, 'sửa: nạp đủ trường từ combo');
  ok(wrap.innerHTML.includes('✏️ Sửa combo CB1') && wrap.innerHTML.includes('Combo &lt;Lắc&gt; 4 lá') && !wrap.innerHTML.includes('value="Combo <Lắc>'), 'tiêu đề sửa + escape HTML trong ô nhập');
  run('_cbFSet("active",false)'); await run('_cbSave()'); await new Promise(r => setImmediate(r));
  const pl2 = posts()[posts().length - 1].body; ok(pl2.combo.code === 'CB1' && pl2.combo.active === false && pl2.combo.start === '2026-11-01', 'sửa: gửi đúng mã CB1 + active=false');
  ok(/Đã lưu combo CB1/.test(toasts[toasts.length - 1]) && run('_cb.all') === true, 'tắt combo → toast "Đã lưu" + tự mở xem tất cả (khỏi tưởng bị mất)');
  // --- lỗi từ server
  for (const [rep, re, label] of [[{ error: 'x', code: 'AUTH' }, /đăng nhập lại/, 'AUTH'], [{ error: 'x', code: 'FORBIDDEN' }, /Chỉ admin/, 'FORBIDDEN'], [{ error: 'Thieu gia combo (so > 0).' }, /Thieu gia/, 'lỗi khác hiện nguyên văn']]) {
    reply = (u, b) => b ? rep : LIST(); run('_cbEdit(0)'); await run('_cbSave()'); ok(re.test(run('_cb.form.err')) && run('_cb.form.saving') === false && wrap.innerHTML.includes('Lưu combo'), 'lỗi server ' + label + ' → báo trong form, mở khoá nút, giữ dữ liệu');
  }
  ctx.fetch = () => Promise.reject(new Error('mạng đứt')); run('_cbEdit(0)'); await run('_cbSave()'); ok(/mạng đứt/.test(run('_cb.form.err')) && run('_cb.form.saving') === false, 'mất mạng → báo lỗi, không mất dữ liệu form');
  ctx.fetch = (url, init) => { calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null }); const b = init && init.body ? JSON.parse(init.body) : null; return Promise.resolve({ json: async () => reply(url, b) }); };
  run('_cbCancel()'); ok(run('_cb.form') === null && !wrap.innerHTML.includes('Lưu combo'), 'Huỷ đóng form');
  // --- xoá
  reply = (u, b) => b ? { ok: true } : LIST(); run('_cb.all=false'); confirmAnswer = false; const n0 = posts().length; await run('_cbDelete(0)');
  ok(posts().length === n0 && /Xoá combo "Combo <Lắc> 4 lá" \(CB1\)/.test(confirms[confirms.length - 1]), 'xoá: hỏi lại có tên+mã; chọn Huỷ → không gọi server');
  confirmAnswer = true; await run('_cbDelete(0)'); await new Promise(r => setImmediate(r));
  ok(posts()[posts().length - 1].body.action === 'comboDelete' && posts()[posts().length - 1].body.code === 'CB1' && /Đã xoá combo/.test(toasts[toasts.length - 1]), 'xoá: gửi comboDelete + mã, báo đã xoá');
  reply = (u, b) => b ? { error: 'Chi admin', code: 'FORBIDDEN' } : LIST(); await run('_cbDelete(0)'); ok(/Chỉ admin/.test(run('_cb.err')), 'xoá bị từ chối → hiện lỗi trên tab');
  ctx.currentUser = { role: 'cs' }; const n1 = posts().length; await run('_cbDelete(0)'); ok(posts().length === n1, 'nhân viên gọi _cbDelete bằng tay → không gọi server');
  console.log(bad ? '\n' + bad + ' LỖI' : '\nALL COMBO ADMIN TESTS PASSED'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
