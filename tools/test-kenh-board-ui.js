#!/usr/bin/env node
// Test giao diện bảng ĐƠN CÁC KÊNH (js/100-a-kenh-board.js): cột giai đoạn, kênh bên trái, lọc, kéo-thả, bắt buộc lý do Thất bại, điểm nối B3/B4.
// Chạy: node tools/test-kenh-board-ui.js -> "ALL KENH BOARD UI TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const els = {}; const el = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, value: '', textContent: '', focus() {} });
const stages = ['Tiếp nhận đơn', 'Tạo đơn POS', 'Phân loại đơn', 'Phòng sản xuất', 'Kho thành phẩm', 'Đóng hàng', 'Hoàn thành', 'Thất bại'];
const card = (id, stage, extra) => Object.assign({ id, maBoDem: id + 'T11/2026', phone: '09' + id, custName: '', kenh: 'Page HT3', saleName: 'hoa', product: 'Nhẫn bạc', phanLoai: 'Cọc trước', total: 2250000, deposit: 1000000, stage, stageAt: Date.now() - 3 * 3600e3, createdAt: Date.now(), taskOpen: 0, taskTotal: 0, commentCount: 0 }, extra || {});
let board = { ok: true, scope: 'all', stages, channels: [{ name: 'Page HT3', count: 3 }, { name: 'Zalo cá nhân', count: 1 }], orders: [card('100001', 'Tiếp nhận đơn', { taskTotal: 2, taskOpen: 1, commentCount: 4 }), card('100002', 'Tạo đơn POS'), card('100003', 'Đóng hàng', { kenh: 'Zalo cá nhân' })] };
const calls = []; let toasts = [], tabs = {}, posts = [];
const w = { gsUrl: 'https://gs/exec', toast: m => toasts.push(m), registerExtraTab: (id, label, fn) => { tabs[id] = { label, fn }; },
  localStorage: { getItem: () => 'TOK' }, document: { getElementById: id => (id === 'xt-wrap-kenhboard' || id === 'kn-modal' && els['kn-modal'] || id === 'kn-fail' || id === 'kn-fail-err') ? el(id) : null, createElement: () => el('kn-modal'), body: { appendChild() {} } },
  fetch: async (u, o) => { if (o && o.method === 'POST') { const b = JSON.parse(o.body); posts.push(b); if (b.action === 'kenhMove') { if (b.stage === 'Thất bại' && !b.note) return { json: async () => ({ ok: false, error: 'ly do' }) }; return { json: async () => ({ ok: true, order: { id: b.id, stage: b.stage, stageAt: Date.now() } }) }; } } calls.push(u); return { json: async () => board }; },
  Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent, Promise, Array, parseInt };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/100-a-kenh-board.js'), 'utf8'), w);
const run = c => vm.runInContext(c, w), flush = () => new Promise(r => setTimeout(r, 5));
const html = () => els['xt-wrap-kenhboard'].innerHTML;
(async () => {
  ok(tabs.kenhboard && /Đơn các kênh/.test(tabs.kenhboard.label), 'đăng ký tab kenhboard');
  tabs.kenhboard.fn(); await flush();
  ok(/action=kenhBoard/.test(calls[0]) && /token=TOK/.test(calls[0]) && /from=/.test(calls[0]), 'gọi GET kenhBoard kèm token + khoảng ngày mặc định 30 ngày');
  const h = html();
  ok(stages.every(s => h.indexOf(s) >= 0), 'hiện đủ 8 cột giai đoạn');
  ok(/CÁC KÊNH/.test(h) && /Tất cả kênh/.test(h) && /Page HT3/.test(h) && /Zalo cá nhân/.test(h), 'cột trái: Tất cả kênh + từng kênh');
  ok(h.indexOf('Tất cả kênh') < h.indexOf('Tiếp nhận đơn'), 'kênh nằm BÊN TRÁI (trước cột giai đoạn)');
  ok(/100001T11\/2026/.test(h) && /#100001/.test(h), 'thẻ hiện mã bộ đếm + mã nhiệm vụ');
  ok(/☑ 1\/2 việc chưa xong/.test(h) && /💬 4/.test(h), 'thẻ báo việc chưa xong + số bình luận');
  ok(/2\.250\.000đ/.test(h) && /CK 1\.000\.000đ/.test(h), 'thẻ hiện tổng tiền + số tiền CK');
  // đếm theo cột
  ok(run('JSON.stringify(_knStageCounts())') === JSON.stringify({ 'Tiếp nhận đơn': 1, 'Tạo đơn POS': 1, 'Phân loại đơn': 0, 'Phòng sản xuất': 0, 'Kho thành phẩm': 0, 'Đóng hàng': 1, 'Hoàn thành': 0, 'Thất bại': 0 }), 'đếm đơn theo từng giai đoạn');
  // chọn kênh → tải lại có kenh=
  w._knPickKenh('Zalo cá nhân'); await flush();
  ok(/kenh=Zalo%20c%C3%A1%20nh%C3%A2n/.test(calls[calls.length - 1]), 'chọn kênh → gọi lại kenhBoard?kenh=…');
  w._knPickKenh(''); await flush();
  // điểm nối B3/B4 khi chưa có
  w._knOpenCreateSafe(); ok(/B3/.test(toasts.pop()), 'chưa có B3 → báo "sẽ có ở bước B3"');
  w._knOpen('100001'); ok(/B4/.test(toasts.pop()), 'chưa có B4 → báo "sẽ có ở bước B4"');
  run('var _opened=[]; function _knOpenDetail(id){ _opened.push(id); } function _knOpenCreate(){ _opened.push("create"); }');
  w._knOpen('100002'); w._knOpenCreateSafe(); ok(run('_opened.join(",")') === '100002,create', 'có B3/B4 thì gọi đúng hàm');
  // kéo-thả
  w._knDragStart({ dataTransfer: { setData() {} } }, '100001'); w._knDrop({ preventDefault() {}, dataTransfer: { getData: () => '' } }, 'Tạo đơn POS'); await flush();
  ok(posts.length === 1 && posts[0].action === 'kenhMove' && posts[0].id === '100001' && posts[0].stage === 'Tạo đơn POS' && posts[0].token === 'TOK', 'kéo thẻ sang cột → POST kenhMove');
  ok(run("_knCards().filter(x=>x.id==='100001')[0].stage") === 'Tạo đơn POS' && /Đã chuyển sang &quot;Tạo đơn POS&quot;/.test(html()), 'thẻ nhảy sang cột mới ngay + thông báo');
  w._knMove('100001', 'Tạo đơn POS'); await flush(); ok(posts.length === 1, 'thả vào đúng cột đang đứng = không gọi server');
  // Thất bại bắt buộc lý do
  w._knMove('100002', 'Thất bại'); ok(/Lý do thất bại/.test(els['kn-modal'].innerHTML) && posts.length === 1, 'sang Thất bại → hiện ô lý do, CHƯA gọi server');
  w._knConfirmFail('100002'); ok(posts.length === 1 && /Phải ghi lý do/.test(els['kn-fail-err'].textContent), 'bỏ trống lý do bị chặn ngay ở trình duyệt');
  els['kn-fail'].value = ' khách huỷ '; w._knConfirmFail('100002'); await flush();
  ok(posts.length === 2 && posts[1].stage === 'Thất bại' && posts[1].note === 'khách huỷ', 'có lý do → POST kenhMove kèm note đã cắt khoảng trắng');
  // lỗi server
  board = { ok: false, error: 'Can dang nhap.' }; await w._knLoad(); ok(/Can dang nhap/.test(html()), 'lỗi từ server hiện ra, không trắng trang');
  // an toàn HTML
  board = { ok: true, scope: 'own', stages, channels: [{ name: '<img onerror=x>', count: 1 }], orders: [card('100009', 'Tiếp nhận đơn', { product: '<script>alert(1)</script>' })] };
  await w._knLoad(); ok(html().indexOf('<script>alert') < 0 && html().indexOf('<img onerror') < 0, 'thoát HTML tên kênh + sản phẩm (không chèn được script)');
  ok(run('_knAgo(Date.now()-30*60000)') === '30 phút' && run('_knAgo(Date.now()-5*3600000)') === '5 giờ' && run('_knAgo(Date.now()-72*3600000)') === '3 ngày', 'thời gian ở giai đoạn: phút / giờ / ngày');
  console.log('ALL KENH BOARD UI TESTS PASSED');
})();
