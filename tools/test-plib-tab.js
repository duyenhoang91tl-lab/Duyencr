#!/usr/bin/env node
// Test tab "Thư viện sản phẩm" (js/94-plib-tab.js). Chạy: node tools/test-plib-tab.js -> "ALL PLIB TAB TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const wrap = { innerHTML: '' }; const calls = [], bodies = []; let counts = {}, folder = [], uploadN = 0; const imgCalls = [];
let scanReply = { ok: true, rootName: 'Hình ảnh theo File Giá', folders: [ { id: 'GRPNHAN00001', name: 'Nhẫn', path: 'Nhẫn' }, { id: 'FOLDKIMTIEN1', name: 'Nhẫn Kim Tiền', path: 'Nhẫn / Nhẫn Kim Tiền' }, { id: 'FOLDNAMBICH1', name: 'Nam Bich Gold', path: 'Vòng / Nam Bich Gold' }, { id: 'GRPCOMBO0001', name: 'Combo', path: 'Combo' }, { id: 'FOLDTET000001', name: 'Tết 2026 nhẫn + vòng', path: 'Combo / Tết 2026 nhẫn + vòng' }, { id: 'FOLDLONELY001', name: 'Mẫu lạ', path: 'Mẫu lạ' } ], links: {} };
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
      if (b.action === 'plibInfoSave') return j(b.info === 'FAIL' ? { ok: false, error: 'Chi admin' } : { ok: true, info: { text: b.info, by: 'ad', at: '2026-11-18T01:00:00Z' } });
      if (b.action === 'plibLinkSave') return j(b.folder === 'FAIL' ? { ok: false, error: 'Chi admin' } : { ok: true, link: b.folder ? { folderId: (/folders\/([-\w]+)/.exec(b.folder) || [0, b.folder])[1], name: 'Gắn tay' } : null });
      return j({ ok: true }); }
    if (/action=priceCatalogFlat/.test(url)) return j({ ok: true, items: [ { n: 'Nhẫn', t: 'Nhẫn Kim Tiền', s: '12', c: 'Vàng 18k' }, { n: 'Nhẫn', t: 'nhan kim tien', s: '14' }, { n: 'Vòng', t: 'Vòng cuốn Nam Bích', m: 'Nam Bich Gold' } ] });
    if (/action=comboList/.test(url)) return j({ ok: true, rows: [ { name: 'Tết 2026 nhẫn + vòng', items: [1, 2] } ] });
    if (/action=plibDriveScan/.test(url)) return j(scanReply);
    if (/action=plibFolderImages/.test(url)) { const id = decodeURIComponent(/folderId=([^&]*)/.exec(url)[1]); imgCalls.push(id); return j(id === 'BADBADBAD001' ? { ok: false, error: 'Khong co quyen' } : { ok: true, items: [ { fileId: 'DF1', name: 'a.jpg', url: 'https://drive.google.com/file/d/DF1/view' }, { fileId: 'DF2', name: 'b.jpg', url: 'https://drive.google.com/file/d/DF2/view' } ], more: false }); }
    if (/action=plibList&key=/.test(url)) { const k = ctx._plKey(decodeURIComponent(/key=([^&]*)/.exec(url)[1])); return j({ ok: true, items: folder, n: folder.length, max: 50, me: 'a', admin: false, info: { text: (counts[k] || {}).info || '', by: 'ad', at: '2026-11-18T01:00:00Z' } }); }
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
  // ── thông tin sản phẩm ──
  counts = { 'nhan kim tien': { n: 3, cover: 'C1', name: 'Nhẫn Kim Tiền', info: 'Ý nghĩa:\nTài lộc, may mắn' }, 'vong cuon nam bich': { n: 0, cover: '', name: 'Vòng cuốn Nam Bích', info: 'Tặng mẹ nhân dịp sinh nhật, tượng trưng cho sự bình an' } };
  run('_pl.loadedCat = false; _pl.cur = null; _pl.q = ""'); await run('_plEnsureData(true)');
  let r = run("plibSearch('tai loc')"); ok(r.length === 1 && r[0].viaInfo && r[0].hasInfo, 'tìm trong nội dung thông tin: ' + JSON.stringify(r));
  r = run("plibSearch('binh an')"); ok(r.length === 1 && r[0].name === 'Vòng cuốn Nam Bích', 'tìm "bình an" ra vòng');
  r = run("plibSearch('nhan')"); ok(r[0].name === 'Nhẫn Kim Tiền' && !r[0].viaInfo, 'khớp tên xếp trước');
  r = run("plibSearch('vong')"); ok(r[0].name === 'Vòng cuốn Nam Bích', 'tên bắt đầu bằng cụm gõ');
  run("_pl.q='tang me'"); run('_plRender()'); ok(/khớp trong thông tin/.test(wrap.innerHTML) && /📝/.test(wrap.innerHTML), 'thẻ báo khớp trong thông tin + 📝');
  run("_pl.q=''");
  folder = []; await run("plibOpen('Nhẫn Kim Tiền','Nhẫn')");
  ok(/Tài lộc, may mắn/.test(wrap.innerHTML), 'hiện thông tin có sẵn ngay (từ counts)');
  ok(!/Thêm thông tin|Sửa<\/button>/.test(wrap.innerHTML.replace('✏️ Sửa','')) || !/_plInfoEdit/.test(wrap.innerHTML), 'không phải admin: không có nút sửa');
  run('_pl.admin = true'); run('_plRender()'); ok(/_plInfoEdit/.test(wrap.innerHTML), 'admin có nút Sửa');
  run('_plInfoEdit()'); ok(/pl-info/.test(wrap.innerHTML) && run('_pl.editInfo'), 'vào chế độ sửa');
  run('_plInfoAdd(3)'); ok(/Phù hợp tặng ai:/.test(run('_pl.draft')), 'nút chèn mục');
  run('_plInfoAdd(3)'); ok(run("_pl.draft.split('Phù hợp tặng ai:').length") === 2, 'không chèn trùng mục');
  run("_pl.draft='Ý nghĩa:\\nMới'"); await run('_plInfoSave()');
  ok(bodies[bodies.length - 1].action === 'plibInfoSave' && bodies[bodies.length - 1].productName === 'Nhẫn Kim Tiền', 'gửi plibInfoSave');
  ok(!run('_pl.editInfo') && run('_pl.counts["nhan kim tien"].info') === 'Ý nghĩa:\nMới', 'lưu xong cập nhật counts (ô tìm thấy ngay)');
  run('_plInfoEdit()'); run("_pl.draft='FAIL'"); await run('_plInfoSave()'); ok(/⚠/.test(run('_pl.infoMsg')) && run('_pl.editInfo'), 'lỗi server giữ nguyên chế độ sửa');
  run("_pl.draft='x'.repeat(4001)"); const nb = bodies.length; await run('_plInfoSave()'); ok(bodies.length === nb, 'quá 4000 ký tự không gửi');
  ok(/<b[^>]*>Ý nghĩa:<\/b>/.test(run("_plInfoHtml('Ý nghĩa:\\nabc')")) && !/<b/.test(run("_plInfoHtml('Dòng thường: có nội dung')")), 'tiêu đề mục in đậm, dòng thường thì không');
  run("_pl.cur=null");
  // ── ảnh có sẵn trên Google Drive ──
  counts = {}; folder = []; run('_pl.cur = null; _pl.q = ""; _pl.admin = false; _pl.links = {}; _pl.loadedCat = false'); await run('_plEnsureData(true)');
  ok(calls.some(u => /action=plibDriveScan&fresh=1/.test(u) && /token=TOK/.test(u)), 'Làm mới quét Drive với fresh=1 kèm token');
  ok(run('_pl.src.loaded') && !run('_pl.src.err') && run('_pl.src.folders.length') === 6, 'đã quét 6 thư mục');
  ok(run("_plSrcFor('nhan kim tien', '').length") === 1 && run("_plSrcFor('nhan kim tien', '')[0].id") === 'FOLDKIMTIEN1', 'tự khớp theo tên SP');
  ok(run("_plSrcFor('vong cuon nam bich', 'nam bich gold')[0].id") === 'FOLDNAMBICH1', 'tự khớp theo TÊN THƯƠNG MẠI');
  ok(run("_plSrcFor('combo tet 2026 nhan vong', 'tet 2026 nhan vong')[0].id") === 'FOLDTET000001', 'combo tự khớp theo tên combo');
  ok(run("_plSrcFor('khong co', '').length") === 0, 'không khớp → rỗng');
  const all = run('_plBuildList()'); ok(all.find(f => f.key === 'vong cuon nam bich').alt === 'nam bich gold', 'alt = tên thương mại');
  const st = run('_plSrcStats(_plBuildList())'); ok(st.matched === 3 && st.miss.length === 1 && st.miss[0].name === 'Mẫu lạ', 'thống kê: 3 khớp, "Mẫu lạ" chưa khớp, thư mục nhóm (Nhẫn, Combo) không tính: ' + JSON.stringify([st.matched, st.miss.map(f => f.name)]));
  run('_plRender()'); ok(/3 đã khớp sản phẩm/.test(wrap.innerHTML) && /1 chưa khớp/.test(wrap.innerHTML) && /Mẫu lạ/.test(wrap.innerHTML), 'màn danh sách hiện thống kê + tên thư mục chưa khớp');
  ok(/📂/.test(wrap.innerHTML.split('Kim Tiền')[1] || ''), 'thẻ có biểu tượng 📂 khi có thư mục Drive');
  // mở SP: tải ảnh Drive
  imgCalls.length = 0; await run("plibOpen('Nhẫn Kim Tiền', 'Nhẫn')");
  ok(imgCalls.length === 1 && imgCalls[0] === 'FOLDKIMTIEN1', 'mở SP → gọi plibFolderImages đúng thư mục: ' + imgCalls);
  ok(/DF1/.test(wrap.innerHTML) && /tự khớp tên/.test(wrap.innerHTML) && /2 ảnh/.test(wrap.innerHTML) && /Ảnh từ Google Drive/.test(wrap.innerHTML) && /Ảnh tải lên CRM/.test(wrap.innerHTML), 'hiện ảnh Drive riêng với ảnh tải lên');
  ok(!/_plPickOpen/.test(wrap.innerHTML), 'không phải admin: không có nút Gắn thư mục');
  run("_plCopySrc(0, 1)"); ok(true, 'chép link ảnh Drive không lỗi');
  await run("plibOpen('Combo: Tết 2026 nhẫn + vòng', 'Combo')"); ok(imgCalls[imgCalls.length - 1] === 'FOLDTET000001', 'mở combo → thư mục Drive combo');
  imgCalls.length = 0; await run("plibOpen('Sản phẩm lạ', '')"); ok(imgCalls.length === 0 && /Chưa có thư mục Drive khớp tên/.test(wrap.innerHTML) && /nhờ admin gắn/.test(wrap.innerHTML), 'không khớp: báo + hướng dẫn, không gọi plibFolderImages');
  // admin: gắn tay
  run('_pl.admin = true'); await run("plibOpen('Nhẫn Kim Tiền', 'Nhẫn')"); run('_pl.admin = true'); run('_plRender()');
  ok(/_plPickOpen/.test(wrap.innerHTML) && /Gắn thư mục Drive/.test(wrap.innerHTML) && !/Gỡ gắn/.test(wrap.innerHTML), 'admin có nút Gắn, chưa có Gỡ');
  run('_plPickOpen()'); ok(run('_pl.pick') && /pl-pq/.test(wrap.innerHTML), 'mở bảng chọn');
  let top = run('_plPickCandidates()'); ok(top.length >= 1 && top[0].id === 'FOLDKIMTIEN1', 'gợi ý thông minh: thư mục gần tên SP nhất lên đầu: ' + top.map(f => f.name));
  run("_pl.pickQ = 'nam bich'"); let html = run('_plPickListHtml()'); ok(/Nam Bich Gold/.test(html) && !/Nhẫn Kim Tiền/.test(html) && run('_pl.pickShown.length') === 1, 'gõ lọc không dấu theo đường dẫn');
  run("_pl.pickQ = 'khong ton tai'"); ok(/Không có thư mục Drive khớp/.test(run('_plPickListHtml()')), 'không có kết quả');
  run("_pl.pickQ = 'https://drive.google.com/drive/folders/LINKFOLDER01?usp=sharing'"); ok(/Gắn link này/.test(run('_plPickListHtml()')), 'dán link → nút Gắn link này');
  run("_pl.pickQ = 'nam bich'"); run('_plPickListHtml()'); bodies.length = 0; imgCalls.length = 0; await run('_plLinkIdx(0)');
  const lb = bodies[bodies.length - 1]; ok(lb.action === 'plibLinkSave' && lb.productName === 'Nhẫn Kim Tiền' && lb.folder === 'FOLDNAMBICH1', 'gửi plibLinkSave: ' + JSON.stringify(lb));
  ok(run("_pl.links['nhan kim tien'].folderId") === 'FOLDNAMBICH1' && !run('_pl.pick'), 'lưu xong: links cập nhật + đóng bảng');
  ok(imgCalls[imgCalls.length - 1] === 'FOLDNAMBICH1' && /gắn tay/.test(wrap.innerHTML) && /Đổi thư mục Drive/.test(wrap.innerHTML) && /Gỡ gắn/.test(wrap.innerHTML), 'gắn tay thắng tự khớp, hiện ảnh thư mục đã gắn');
  run('_plPickOpen()'); run("_pl.pickQ = 'https://drive.google.com/drive/folders/LINKFOLDER01?usp=sharing'"); await run('_plLinkRaw()');
  ok(run("_pl.links['nhan kim tien'].folderId") === 'LINKFOLDER01', 'dán link gắn được');
  run('_plPickOpen()'); run("_pl.pickQ = 'FAIL'"); await run('_plLinkRaw()'); ok(/⚠/.test(run('_pl.srcMsg')) && run("_pl.links['nhan kim tien'].folderId") === 'LINKFOLDER01', 'server từ chối: giữ nguyên gắn cũ + báo lỗi');
  await run('_plUnlink()'); ok(!run("_pl.links['nhan kim tien']") && bodies[bodies.length - 1].folder === '', 'gỡ gắn gửi folder rỗng');
  ok(run("_plSrcFor('nhan kim tien','')[0].id") === 'FOLDKIMTIEN1', 'gỡ gắn → quay lại tự khớp tên');
  // lỗi quyền
  scanReply = { ok: false, srcError: true, error: 'Khong mo duoc thu muc anh tren Drive — hay chia se thu muc do cho owner@x.com (quyen Nguoi xem).' };
  run('_pl.cur = null; _pl.loadedCat = false'); await run('_plEnsureData(true)'); run('_plRender()');
  ok(/owner@x.com/.test(wrap.innerHTML), 'lỗi quyền hiện ở màn danh sách kèm email cần chia sẻ');
  ok(run('_pl.src.loaded') && run('_pl.prods.length') > 0, 'lỗi quét Drive không chặn danh sách sản phẩm');
  run("_pl.cur=null; _pl.admin=false");
  console.log('ALL PLIB TAB TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
