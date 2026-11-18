#!/usr/bin/env node
// Test tab "Thư viện sản phẩm" (js/94-plib-tab.js). Chạy: node tools/test-plib-tab.js -> "ALL PLIB TAB TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const wrap = { innerHTML: '' }; const calls = [], bodies = []; let counts = {}, folder = [], uploadN = 0;
const ctx = { console, Date, JSON, Math, String, Number, Array, Object, setTimeout, clearTimeout, encodeURIComponent, Promise,
  gsUrl: 'https://x/exec', esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  document: { getElementById: id => id === 'xt-wrap-plib' ? wrap : null, activeElement: null, querySelector: () => null },
  localStorage: { getItem: () => 'TOK' }, registerExtraTab: (id, label, fn) => { ctx._reg = { id, label, fn }; }, confirm: () => true, toast() {},
  switchTab: t => { ctx._tab = t; },
  fetch: (url, o) => {
    calls.push(url);
    const j = v => Promise.resolve({ json: () => Promise.resolve(v) });
    if (o && o.body) { const b = JSON.parse(o.body); bodies.push(b);
      if (b.action === 'plibUpload') { if (uploadN >= 50) return j({ ok: false, full: true, error: 'full' }); uploadN++; return j({ ok: true, n: uploadN, item: { id: 'i' + uploadN, fileId: 'F' + uploadN, url: 'u', name: b.name, by: 'a' } }); }
      return j({ ok: true }); }
    if (/action=priceCatalogFlat/.test(url)) return j({ ok: true, items: [ { n: 'Nhẫn', t: 'Nhẫn Kim Tiền', s: '12', c: 'Vàng 18k' }, { n: 'Nhẫn', t: 'nhan kim tien', s: '14' }, { n: 'Vòng', t: 'Vòng cuốn Nam Bích' } ] });
    if (/action=comboList/.test(url)) return j({ ok: true, rows: [ { name: 'Tết 2026 nhẫn + vòng', items: [1, 2] } ] });
    if (/action=plibList&key=/.test(url)) return j({ ok: true, items: folder, n: folder.length, max: 50, me: 'a', admin: false });
    if (/action=plibList/.test(url)) return j({ ok: true, counts, max: 50, me: 'a', admin: false });
    return j({ ok: false });
  } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/94-plib-tab.js'), 'utf8'), ctx);
const run = s => vm.runInContext(s, ctx);
(async () => {
  ok(ctx._reg && ctx._reg.id === 'plib', 'đăng ký tab plib');
  ok(run("_plKey('  Vòng  Cuốn - Nam Bích! ')") === 'vong cuon nam bich', 'key giống server');
  ok(run("_plKey('Đồng Đỏ')") === 'dong do', 'key đ→d');
  counts = { 'nhan kim tien': { n: 3, cover: 'C1', name: 'Nhẫn Kim Tiền' } };
  await run('_plEnsureData(true)');
  const list = run('_plBuildList()');
  ok(list.length === 3, 'gộp size cùng tên + combo = 3 thư mục, có ' + list.length);
  ok(list.filter(f => f.combo).length === 1, '1 combo');
  ok(run("_plSearch(_plBuildList(), 'kim tien').length") === 1, 'tìm không dấu ra SP');
  ok(run("_plSearch(_plBuildList(), 'tet nhan').length") === 1 && run("_plSearch(_plBuildList(), 'tet nhan')[0].combo"), 'tìm ra cả combo');
  ok(run("plibSearch('nhan', 8).length") === 2, 'plibSearch (ô tìm toàn cục) ra SP + combo chứa "nhan"');
  ok(run("plibSearch('kim tien')[0].n") === 3, 'plibSearch kèm số ảnh');
  ok(/3\/50 ảnh/.test(wrap.innerHTML) && /C1/.test(wrap.innerHTML), 'thẻ hiện 3/50 ảnh + ảnh bìa');
  // phím tắt: gõ -> Enter mở thẳng thư mục đầu tiên; ↑↓ đổi mục chọn
  run("_pl.q='kim tien'"); run('_plRender()');
  ok(run('_pl.shown.length') === 1, 'có 1 kết quả');
  folder = [{ id: 'k', fileId: 'F', url: 'u', name: 'k.jpg', by: 'a' }];
  const ev = k => ({ key: k, preventDefault() {} });
  ctx._ev = ev('Enter'); await run('_plKeydown(_ev)');
  ok(run('_pl.cur && _pl.cur.key') === 'nhan kim tien', 'Enter mở thư mục đầu tiên');
  run("_pl.cur=null;_pl.q='nhan';_pl.hi=0"); run('_plRender()');
  ctx._ev = ev('ArrowDown'); run('_plKeydown(_ev)'); ok(run('_pl.hi') === 1, '↓ chọn mục 2');
  ctx._ev = ev('ArrowDown'); run('_plKeydown(_ev)'); ok(run('_pl.hi') === 0, '↓ quay vòng');
  run("_pl.q='';_pl.hi=0;_pl.cur=null");
  folder = [{ id: 'a1', fileId: 'F', url: 'u', name: 'x.jpg', by: 'a' }];
  await run("plibOpen('Nhẫn Kim Tiền', 'Nhẫn')");
  ok(ctx._tab === 'plib', 'plibOpen chuyển tab');
  ok(calls.some(u => /action=plibList&key=/.test(u) && /token=TOK/.test(u)), 'gọi plibList theo key kèm token');
  ok(/1\/50 ảnh/.test(wrap.innerHTML) && /Tải ảnh lên/.test(wrap.innerHTML), 'trong thư mục: đếm + nút tải');
  // chặn 50: đã có n=49, tải 3 ảnh -> chỉ nhận 1 ảnh, báo bỏ 2
  run("_pl.n = 49; _pl.items = [];"); uploadN = 49;
  const fakeFile = n => ({ type: 'image/png', size: 100, name: n + '.png' });
  ctx.FileReader = function () { this.readAsDataURL = function () { this.result = 'data:image/png;base64,QUJD'; this.onload(); }; };
  await run("_plUpload([{type:'image/png',size:100,name:'a.png'},{type:'image/png',size:100,name:'b.png'},{type:'image/png',size:100,name:'c.png'}])");
  ok(bodies.filter(b => b.action === 'plibUpload').length === 1, 'chỉ gửi 1 ảnh (còn 1 chỗ), gửi ' + bodies.filter(b => b.action === 'plibUpload').length);
  ok(/Bỏ 2 ảnh/.test(run('_pl.up')), 'báo bỏ 2 ảnh: ' + run('_pl.up'));
  ok(bodies[0].productName === 'Nhẫn Kim Tiền' && bodies[0].group === 'Nhẫn', 'gửi tên + nhóm SP');
  await run("_plUpload([{type:'image/png',size:100,name:'d.png'}])");
  ok(/đủ 50 ảnh/.test(run('_pl.up')), 'đủ 50 -> không gửi nữa: ' + run('_pl.up'));
  ok(bodies.filter(b => b.action === 'plibUpload').length === 1, 'không gửi thêm khi đủ');
  run("_pl.items=[{id:'a1',fileId:'F',url:'u',name:'x',by:'a'}];_pl.n=50");
  await run('_plDel(0)'); ok(bodies[bodies.length - 1].action === 'plibDelete' && run('_pl.n') === 49, 'xóa giảm đếm');
  run("_pl.cur=null"); ok(true, 'ok');
  console.log('ALL PLIB TAB TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
