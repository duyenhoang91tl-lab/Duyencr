// Test: gộp bill GHÉP khi xét thưởng THEO ĐƠN (Duyên 04/11/2026) — js/12 _computeBonusData_ → _mergeGhepBills.
// Chạy: node tools/test-bonus-ghep-bill.js   (nạp hàm thật như test-bonus-goc-split.js)
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync('tools/test-bonus-programs.js', 'utf8');
const head = src.slice(0, src.indexOf('const calc =')).replace(/^#!.*\n/, '');
const run = new Function('require', 'process', '__dirname', head + '\nreturn {ctx};');
const { ctx } = run(require, process, require('path').join(__dirname));
const base = { dateFrom: '', dateTo: '', audience: { online: false, offline: false }, product: '', requireProduct: '', tier: { enabled: false, rows: [] }, revenue: { enabled: false, scope: 'order', min: '', max: '' }, firstOrder: { enabled: false, amount: '' }, bonusAmount: '' };
const calc = (progs, orders) => { ctx.P = progs; ctx.O = orders; return JSON.parse(vm.runInContext('BONUS_PROGRAMS = P; JSON.stringify(_computeBonusData_(O))', ctx)); };
const c10 = Object.assign({}, base, { id: 'a', name: 'Đơn từ 10tr (combo 2 sản phẩm)', revenue: { enabled: true, scope: 'order', min: 10e6, max: '' }, bonusAmount: 20000 });
const c15 = Object.assign({}, base, { id: 'b', name: 'Đơn từ 15tr (combo 3 sản phẩm)', revenue: { enabled: true, scope: 'order', min: 15e6, max: '' }, bonusAmount: 30000 });
const tier = Object.assign({}, base, { id: 't', name: 'Bậc đơn/ngày', tier: { enabled: true, rows: [{ count: 2, bonus: 50000 }] } });
const P = [c10, c15];
const D = '2026-10-19';
const mk = (id, sale, val, note, codes, qty, extra) => Object.assign({ id, saleBan: sale, giaTriDon: val, baseNgayTao: D, ngayTao: '19/10/2026 10:00', donGoc: true, ghiChu: note, maSanPham: codes, soLuong: qty, sanPham: '', soDienThoai: '0978925771', saleShares: sale.split(',').map(x => ({ name: x.trim(), frac: 1 / sale.split(',').length })) }, extra || {});
const get = (r, n) => r.bySale.find(x => x.name === n) || { total: 0, items: [] };
// 663T10 (10,26tr, 2 SP) + 704T10 (7,742tr, 1 SP) cùng sale, cùng SĐT, ghi chú "GHÉP ĐƠN CÙNG 663T10/2026" (ĐÚNG ví dụ Duyên)
const o663 = mk(1, 'A', 10260000, '663T10/2026\n chụp ảnh\n Phôi mặt cổ và nhẫn đồng màu', 'NH1;MC1', '1 ,1');
const o704 = mk(2, 'A', 7742000, '704T10/2026\n chụp ảnh\n GHÉP ĐƠN CÙNG 663T10/2026', 'LC1', '1');
let r = calc(P, [o663, o704]);
ok(get(r, 'A').total === 30000 && get(r, 'A').items.length === 1, '704+663 = bill 18.002.000 / 3 SP → 1 lần mốc 15tr 30k (không 20k+0) — total=' + get(r, 'A').total);
ok(/18002000/.test(get(r, 'A').items[0].detail) && /3 sản phẩm/.test(get(r, 'A').items[0].detail) && /gộp 2 đơn GHÉP/.test(get(r, 'A').items[0].detail), 'chi tiết ghi giá trị gộp + số SP + "gộp 2 đơn GHÉP": ' + get(r, 'A').items[0].detail);
// khác SĐT → 2 bill riêng (663 vẫn 20k, 704 <10tr = 0)
r = calc(P, [o663, Object.assign({}, o704, { soDienThoai: '0912345678' })]);
ok(get(r, 'A').total === 20000, 'khác SĐT, không NG → KHÔNG gộp (A=' + get(r, 'A').total + ')');
// khác bộ sale → không gộp
r = calc(P, [o663, mk(2, 'B', 7742000, o704.ghiChu, 'LC1', '1')]);
ok(get(r, 'A').total === 20000 && get(r, 'B').total === 0, 'khác sale → không gộp');
// cách viết cũ "GHÉP CÙNG ĐƠN" + đơn thêm NG (không cần SĐT)
const ng = mk(3, 'A', 5450000, 'NG139T10/2026\n GHÉP CÙNG ĐƠN 1326T10/2026', 'MC2', '1', { soDienThoai: '', donGoc: false });
const x1326 = mk(4, 'A', 5850000, '1326T10/2026\n SHIP CÙNG ĐƠN NG139T10/2026', 'NH2', '1', { soDienThoai: '' });
r = calc(P, [ng, x1326]);
ok(get(r, 'A').total === 20000 && /11300000/.test(get(r, 'A').items[0].detail), 'NG139T10 + 1326T10 (NG không phải đơn gốc) = 11,3tr / 2 SP → 20k');
// số đơn/ngày KHÔNG đổi khi gộp: CT bậc 2 đơn/ngày vẫn đếm 2 đơn (704 + 663)
r = calc([tier, c10, c15], [o663, o704]);
ok(get(r, 'A').items.some(x => x.scope === 'Theo ngày (số đơn)' && /Đạt 2 đơn/.test(x.detail)), 'bậc số đơn/ngày vẫn đếm 2 đơn (gộp chỉ áp cho thưởng theo đơn)');
// 2 sale chung bill: thưởng chia đều
const s1 = mk(5, 'A, B', 10260000, '663T10/2026', 'NH1;MC1', '1 ,1'), s2 = mk(6, 'A, B', 7742000, '704T10/2026\n GHÉP ĐƠN CÙNG 663T10/2026', 'LC1', '1');
r = calc(P, [s1, s2]);
ok(get(r, 'A').total === 15000 && get(r, 'B').total === 15000, 'bill gộp 2 sale → 30k chia đều (A=' + get(r, 'A').total + ', B=' + get(r, 'B').total + ')');
// backend cũ (không có field gốc) vẫn gộp
const old = (o) => { const c = Object.assign({}, o); delete c.baseNgayTao; delete c.donGoc; delete c.saleShares; return c; };
r = calc(P, [old(o663), old(o704)]);
ok(get(r, 'A').total === 30000, 'backend cũ (không baseNgayTao/donGoc) vẫn gộp bill');
process.exit(bad ? 1 : 0);
