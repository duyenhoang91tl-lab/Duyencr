#!/usr/bin/env node
// Test tab "Combo" (js/93-combo-tab.js): format giá, nội dung Copy, lọc đang áp dụng, bỏ kết quả tải chậm, hiện lỗi GAS, esc HTML.
// Chạy: node tools/test-combo-tab.js -> "ALL COMBO TAB TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const wrap = { innerHTML: '' }; const calls = []; const bodies = []; let confirmAns = true; const toasts = []; let reply = null; const resolvers = [];
const ctx = { console, Date, JSON, Math, String, Number, Array, Object, setTimeout, clearTimeout, encodeURIComponent,
  gsUrl: 'https://x/exec', esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  document: { getElementById: id => id === 'xt-wrap-combo' ? wrap : null, activeElement: null },
  registerExtraTab: (id, label, fn) => { ctx._reg = { id, label, fn }; },
  _authAccount: { role: 'admin' }, confirm: () => confirmAns, toast: m => toasts.push(m),
  fetch: (url, o) => { calls.push(url); bodies.push(o && o.body); return new Promise(res => resolvers.push(() => res({ json: async () => reply(url) }))); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', '93-combo-tab.js'), 'utf8'), ctx, { filename: '93-combo-tab.js' });
const C1 = { code: 'CB1', name: 'Combo <Lắc> 4 lá', items: [{ name: 'Lắc cỏ 4 lá', chatLieu: 'Bạc 925', size: '16cm', qty: 1 }, { name: 'Nhẫn bạc trơn', chatLieu: '', size: 'Size 12', qty: 2 }],
  priceVnd: 1299000, priceText: '1.299', note: 'Chỉ online', end: '2026-12-31', usable: true, statusLabel: '✅ Còn áp dụng' };
const C2 = { code: 'CB2', name: 'Hết hạn', items: [{ name: 'Nhẫn', qty: 1 }], priceVnd: 0, priceText: '990', usable: false, statusLabel: '❌ Đã hết hạn' };
// GAS thật trả thêm itemsText/active/start/keywords (mẫu cho ca sửa combo)
Object.assign(C1, { itemsText: 'Lắc cỏ 4 lá | Bạc 925 | 16cm | 1\nNhẫn bạc trơn |  | Size 12 | 2', active: true, start: '', keywords: 'lắc, nhẫn' });
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

  // ═══ BƯỚC 4: admin thêm / sửa / xóa ═══
  // giá: người dùng nhập ĐỒNG; <100000 phải tròn nghìn và gửi dạng nghìn (server coi <100000 là nghìn) → không nhân 1000 hai lần khi sửa lại
  const P = v => JSON.stringify(run('_cbPriceToSend_(' + JSON.stringify(v) + ')'));
  ok(P('250000') === '{"n":250000}' && P('1.299.000') === '{"n":1299000}', 'giá >=100000 gửi nguyên: ' + P('250000'));
  ok(P('85000') === '{"n":85}' && P('85.000') === '{"n":85}', 'giá 85.000đ gửi 85 (nghìn): ' + P('85000'));
  ok(P('99500').includes('err') && P('500').includes('err') && P('').includes('err') && P('abc').includes('err'), 'giá lẻ/trống/chữ → lỗi');
  // quyền: không phải admin thì không thấy nút
  const savedAcc = ctx._authAccount; ctx._authAccount = { role: 'cs' };
  reply = () => ({ ok: true, total: 1, rows: [C1] }); let p5 = run('_cbLoad()'); resolvers.shift()(); await p5;
  ok(!wrap.innerHTML.includes('Thêm combo') && !wrap.innerHTML.includes('✏️') && !wrap.innerHTML.includes('🗑'), 'CS thường không thấy nút thêm/sửa/xóa');
  ctx._authAccount = savedAcc; run('_cbRender()');
  ok(wrap.innerHTML.includes('➕ Thêm combo') && wrap.innerHTML.includes('✏️ Sửa') && wrap.innerHTML.includes('🗑 Xóa'), 'admin thấy đủ 3 nút');
  // sửa: form điền sẵn; gõ rồi tải nền không mất; lưu gửi đúng body (không priceText, giữ mã)
  run('_cb.all=false'); run('_cbEditAt(0)');
  ok(wrap.innerHTML.includes('Sửa combo CB1') && wrap.innerHTML.includes('value="1299000"') && wrap.innerHTML.includes('Combo &lt;Lắc&gt; 4 lá'), 'form sửa điền sẵn + escape');
  run("_cbEF('name','Tên mới'); _cbEF('price','1.350.000'); _cbRender()");
  ok(wrap.innerHTML.includes('value="Tên mới"'), 'vẽ lại form vẫn giữ chữ đang gõ');
  calls.length = 0; bodies.length = 0;
  reply = () => ({ ok: true, code: 'CB1', created: false });
  let ps = run('_cbSave()'); resolvers.shift()(); await ps;
  const b1 = JSON.parse(bodies[0]);
  ok(b1.action === 'comboSave' && b1.combo.code === 'CB1' && b1.combo.name === 'Tên mới' && b1.combo.price === 1350000 && !('priceText' in b1.combo) && b1.combo.active === true, 'body comboSave: ' + bodies[0]);
  ok(run('_cb.edit') === null && toasts.some(m => m.includes('Đã lưu combo CB1')), 'lưu xong đóng form + toast');
  ok(calls.some(u => String(u).includes('action=comboList')), 'lưu xong tải lại danh sách');
  while (resolvers.length) resolvers.shift()();
  // sửa combo giá "85" nghìn: ô giá hiện 85000, lưu lại gửi 85 (không thành 85 triệu)
  reply = () => ({ ok: true, total: 1, rows: [Object.assign({}, C1, { priceVnd: 85000, priceText: '85' })] }); let p6 = run('_cbLoad()'); resolvers.shift()(); await p6;
  run('_cbEditAt(0)'); bodies.length = 0; reply = () => ({ ok: true, code: 'CB1' }); ps = run('_cbSave()'); resolvers.shift()(); await ps;
  ok(JSON.parse(bodies[0]).combo.price === 85, 'sửa lại combo 85 nghìn vẫn gửi 85: ' + bodies[0]);
  while (resolvers.length) resolvers.shift()();
  // thêm mới: kiểm tra phía client TRƯỚC khi gọi mạng
  run('_cbNew()'); bodies.length = 0;
  ok(wrap.innerHTML.includes('Thêm combo mới'), 'form thêm mới');
  await run('_cbSave()'); ok(wrap.innerHTML.includes('Nhập tên combo') && !bodies.length, 'thiếu tên → báo lỗi, không gọi mạng');
  run("_cbEF('name','X')"); await run('_cbSave()'); ok(wrap.innerHTML.includes('ít nhất 1 sản phẩm') && !bodies.length, 'thiếu sản phẩm');
  run("_cbEF('itemsText','2 x Nhẫn')"); await run('_cbSave()'); ok(wrap.innerHTML.includes('Nhập giá combo') && !bodies.length, 'thiếu giá');
  run("_cbEF('price','99500')"); await run('_cbSave()'); ok(wrap.innerHTML.includes('tròn nghìn') && !bodies.length, 'giá lẻ <100k');
  run("_cbEF('price','250000'); _cbEF('start','2026-12-31'); _cbEF('end','2026-12-01')"); await run('_cbSave()'); ok(wrap.innerHTML.includes('Ngày kết thúc trước') && !bodies.length, 'ngày ngược');
  run("_cbEF('end','')");
  reply = () => ({ error: 'Chi admin moi duoc them/sua combo.', code: 'FORBIDDEN' });
  ps = run('_cbSave()'); resolvers.shift()(); await ps;
  ok(wrap.innerHTML.includes('Chi admin moi duoc') && run('_cb.edit') !== null && run('_cb.saving') === false, 'server từ chối → hiện lỗi trong form, giữ form, mở khóa nút');
  const b2 = JSON.parse(bodies[0]); ok(b2.combo.code === '' && b2.combo.price === 250000 && b2.combo.itemsText === '2 x Nhẫn', 'thêm mới: mã trống để server tự sinh');
  run('_cbCancel()'); ok(run('_cb.edit') === null && wrap.innerHTML.includes('Tìm combo'), 'Hủy quay về danh sách');
  while (resolvers.length) resolvers.shift()();
  // xóa
  reply = () => ({ ok: true, total: 1, rows: [C1] }); let p7 = run('_cbLoad()'); resolvers.shift()(); await p7;
  bodies.length = 0; confirmAns = false; await run('_cbDelete(0)'); ok(!bodies.length, 'Hủy xác nhận → không xóa');
  confirmAns = true; reply = () => ({ ok: true }); const pd = run('_cbDelete(0)'); resolvers.shift()(); await pd;
  const b3 = JSON.parse(bodies[0]); ok(b3.action === 'comboDelete' && b3.code === 'CB1', 'body comboDelete: ' + bodies[0]);
  ok(toasts.some(m => m.includes('Đã xóa combo')), 'toast xóa');
  while (resolvers.length) resolvers.shift()();
  reply = () => ({ error: 'Khong tim thay combo.' }); const pd2 = run('_cbDelete(0)'); resolvers.shift()(); await pd2;
  ok(wrap.innerHTML.includes('Khong tim thay combo.'), 'xóa lỗi hiện trên tab');
  // ── 2026-11-18: ẢNH COMBO ──
  const FID = '1AbCdEfGhIjKlMnOpQrStUv', linkEl = { value: '' };
  ctx.document.getElementById = id => id === 'xt-wrap-combo' ? wrap : id === 'cb-img-link' ? linkEl : null;
  const C3 = Object.assign({}, C1, { code: 'CB3', usable: true, images: ['https://drive.google.com/thumbnail?id=' + FID + '&sz=w600', 'https://cdn.example.com/b.jpg'], imagesText: 'https://drive.google.com/uc?export=view&id=' + FID + '\nhttps://cdn.example.com/b.jpg' });
  reply = () => ({ ok: true, total: 1, rows: [C3] }); let pi = run('_cbLoad()'); resolvers.shift()(); await pi;
  ok(wrap.innerHTML.includes('src="https://drive.google.com/thumbnail?id=' + FID + '&amp;sz=w600"') && wrap.innerHTML.includes('src="https://cdn.example.com/b.jpg"'), 'thẻ combo hiện ảnh (thumbnail + link http)');
  ok(!run('_cbCard(' + JSON.stringify(C1) + ',0)').includes('<img'), 'combo không ảnh: không vẽ khung ảnh');
  run('_cbEditAt(0)');
  ok(run('_cb.edit.images.length') === 2 && wrap.innerHTML.includes('Tải ảnh từ máy') && wrap.innerHTML.includes('onclick="_cbImgDel(1)"'), 'form sửa nạp ảnh cũ + nút xóa + nút tải');
  run('_cbImgDel(0)'); ok(run('_cb.edit.images.length') === 1 && run('_cb.edit.images[0]') === 'https://cdn.example.com/b.jpg', 'xóa ảnh');
  linkEl.value = 'https://drive.google.com/drive/folders/' + FID; run('_cbImgAddLink()');
  ok(run('_cb.edit.images.length') === 1 && wrap.innerHTML.includes('không hợp lệ'), 'link thư mục Drive bị từ chối');
  linkEl.value = 'abc'; run('_cbImgAddLink()'); ok(run('_cb.edit.images.length') === 1, 'chữ rác bị từ chối');
  linkEl.value = 'https://drive.google.com/file/d/' + FID + '/view'; run('_cbImgAddLink()'); ok(run('_cb.edit.images.length') === 2, 'link file Drive được thêm');
  linkEl.value = 'https://x.com/1.png'; run('_cbImgAddLink()'); linkEl.value = 'https://x.com/2.png'; run('_cbImgAddLink()');
  ok(run('_cb.edit.images.length') === 4, 'thêm đủ 4 ảnh');
  linkEl.value = 'https://x.com/3.png'; run('_cbImgAddLink()'); ok(run('_cb.edit.images.length') === 4 && wrap.innerHTML.includes('Tối đa 4'), 'quá 4 ảnh bị chặn');
  bodies.length = 0; reply = () => ({ ok: true, code: 'CB3' }); let pz = run('_cbSave()'); resolvers.shift()(); await pz;
  const bi = JSON.parse(bodies[0]); ok(bi.action === 'comboSave' && Array.isArray(bi.combo.images) && bi.combo.images.length === 4 && bi.combo.images[0] === 'https://cdn.example.com/b.jpg', 'comboSave gửi images: ' + bodies[0].slice(0, 200));
  while (resolvers.length) resolvers.shift()();
  ctx.FileReader = function(){ this.readAsDataURL = () => { this.result = 'data:image/png;base64,QUJD'; setTimeout(() => this.onload(), 0); }; };
  ctx.Image = function(){ Object.defineProperty(this, 'src', { set: () => setTimeout(() => this.onerror(), 0) }); };
  run('_cbNew()');
  reply = () => ({ ok: true, url: 'https://drive.google.com/uc?export=view&id=' + FID }); bodies.length = 0;
  let pk = run('_cbImgPick([{ name: "Ảnh 1.PNG", type: "image/png", size: 1000 }, { name: "a.pdf", type: "application/pdf", size: 10 }, { name: "big.jpg", type: "image/jpeg", size: 13 * 1024 * 1024 }])');
  await new Promise(r => setTimeout(r, 30)); ok(run('_cb.edit.imgBusy') === true && wrap.innerHTML.includes('Đang tải ảnh'), 'đang tải: báo trạng thái');
  await run('_cbSave()'); ok(!bodies.some(b => JSON.parse(b).action === 'comboSave') && wrap.innerHTML.includes('chờ xong rồi lưu'), 'đang tải ảnh: chặn bấm Lưu');
  while (resolvers.length) resolvers.shift()(); await pk;
  const bu = bodies.map(b => JSON.parse(b)).filter(b => b.action === 'uploadTemplateImage');
  ok(bu.length === 1 && bu[0].imageBase64 === 'QUJD' && bu[0].filename === 'Ảnh 1.jpg' && bu[0].mimeType === 'image/png', 'upload: gọi uploadTemplateImage 1 lần (bỏ PDF + ảnh >12MB): ' + JSON.stringify(bu).slice(0, 160));
  ok(run('_cb.edit.images.length') === 1 && run('_cb.edit.imgBusy') === false && wrap.innerHTML.includes('không phải ảnh') && wrap.innerHTML.includes('quá 12MB'), 'ảnh hợp lệ vào danh sách; lỗi 2 tệp còn lại hiện rõ');
  reply = () => ({ ok: false, error: 'Can dang nhap de upload anh' }); run('_cb.edit.images=[]');
  pk = run('_cbImgPick([{ name: "z.png", type: "image/png", size: 5 }])'); await new Promise(r => setTimeout(r, 30)); while (resolvers.length) resolvers.shift()(); await pk;
  ok(run('_cb.edit.images.length') === 0 && wrap.innerHTML.includes('Can dang nhap de upload anh'), 'server từ chối upload: hiện lỗi, không thêm ảnh');
  console.log('ALL COMBO TAB TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
