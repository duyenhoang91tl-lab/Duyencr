// Test: thưởng theo ĐƠN GỐC Base — đơn chia A+B (Duyên 04/11/2026).
// Chạy: node tools/test-bonus-goc-split.js   (nạp hàm thật từ js/12, js/01, js/62 giống test-bonus-programs.js)
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync('tools/test-bonus-programs.js', 'utf8');
// dùng lại nguyên phần dựng context của test-bonus-programs (dòng đến trước "const calc")
const head = src.slice(0, src.indexOf('const calc =')).replace(/^#!.*\n/, '');
const run = new Function('require', 'process', '__dirname', head + '\nreturn {ctx};');
const { ctx } = run(require, process, require('path').join(__dirname));
const base = { dateFrom: '', dateTo: '', audience: { online: false, offline: false }, product: '', requireProduct: '', tier: { enabled: false, rows: [] }, revenue: { enabled: false, scope: 'order', min: '', max: '' }, firstOrder: { enabled: false, amount: '' }, bonusAmount: 0 };
const calc = (progs, orders) => { ctx.P = progs; ctx.O = orders; return JSON.parse(vm.runInContext('BONUS_PROGRAMS = P; JSON.stringify(_computeBonusData_(O))', ctx)); };
const tier = Object.assign({}, base, { id: 't', name: 'Bậc đơn/ngày', tier: { enabled: true, rows: [{ count: 2, bonus: 50000 }, { count: 3, bonus: 120000 }] } });
const day = Object.assign({}, base, { id: 'd', name: 'DS ngày', revenue: { enabled: true, scope: 'day', min: 10000000, max: '' }, bonusAmount: 100000 });
const D = '2026-10-20';
const mk = (id, saleBan, val, shares, extra) => Object.assign({ id, saleBan, giaTriDon: val, baseNgayTao: D, ngayTao: '20/10/2026 10:00', donGoc: true, saleShares: shares }, extra || {});
// A bán riêng 1 đơn 6tr; đơn chia A+B 8tr (Base: A 50%, B 50%); B còn 1 đơn riêng 3tr
const O = [mk(1, 'A', 6e6, [{ name: 'A', frac: 1 }]), mk(2, 'A, B', 8e6, [{ name: 'A', frac: .5 }, { name: 'B', frac: .5 }]), mk(3, 'B', 3e6, [{ name: 'B', frac: 1 }])];
let r = calc([tier, day], O); const get = (n) => r.bySale.find(x => x.name === n) || { total: 0, items: [] };
ok(get('A').items.some(x => x.scope === 'Theo ngày (số đơn)' && /Đạt 2 đơn/.test(x.detail)), 'A có 2 đơn (1 riêng + 1 chia) → đạt bậc 2 đơn');
ok(get('A').items.some(x => x.scope === 'Theo ngày (doanh số)' && /10000000/.test(x.detail)), 'DS ngày A = 6tr gốc + 4tr phần chia = 10tr → đạt mốc 10tr');
ok(get('B').items.some(x => /Đạt 2 đơn/.test(x.detail)), 'B có 2 đơn (1 chia + 1 riêng) → đạt bậc 2 đơn');
ok(!get('B').items.some(x => x.scope === 'Theo ngày (doanh số)'), 'DS ngày B = 4tr + 3tr = 7tr → KHÔNG đạt mốc 10tr (không dính doanh thu của A)');
ok(get('A').total === 150000 && get('B').total === 50000, 'tổng: A 50k+100k, B 50k — thưởng A không liên quan B (A=' + get('A').total + ', B=' + get('B').total + ')');
// sale có phần chia trên Base nhưng KHÔNG có tên trên thẻ Pos vẫn được đếm đơn; người chỉ có tên trên thẻ Pos nhưng không có phần chia thì không
r = calc([tier], [mk(1, 'A', 5e6, [{ name: 'A', frac: 1 }]), mk(2, 'X', 5e6, [{ name: 'A', frac: 1 }])]);
ok(get('A').items.some(x => /Đạt 2 đơn/.test(x.detail)) && !r.bySale.some(x => x.name === 'X'), 'người tham gia theo Base (saleShares), không theo thẻ Pos');
// đơn KHÔNG phải đơn gốc (khi backend có field gốc) không được đếm
r = calc([tier], [mk(1, 'A', 5e6, [{ name: 'A', frac: 1 }]), mk(2, 'A', 5e6, undefined, { donGoc: false })]);
ok(r.total === 0, 'đơn không phải đơn gốc không tính số đơn (A chỉ còn 1 đơn → chưa đạt bậc 2)');
// backend cũ (không có baseNgayTao) → giữ cách cũ theo thẻ Pos
const old = (id, s) => ({ id, saleBan: s, giaTriDon: 1e6, ngayTao: '20/10/2026 10:00' });
r = calc([tier], [old(1, 'A'), old(2, 'A')]);
ok(r.total === 50000, 'backend cũ: vẫn đếm theo thẻ Pos');
// ===== Gộp đơn NG "ghép/ship cùng đơn" (Duyên 04/11/2026): 1326T10 (5,85tr) + NG139T10 (5,45tr) cùng sale = 1 bill 11,3tr =====
const big = Object.assign({}, base, { id: 'm', name: 'Đơn từ 10tr', revenue: { enabled: true, scope: 'order', min: 10000000, max: '' }, bonusAmount: 20000 });
const gh = (id, note, val, sale, goc, extra) => Object.assign({ id, saleBan: sale, giaTriDon: val, ghiChu: note, baseNgayTao: D, ngayTao: '20/10/2026 10:00', donGoc: goc, sanPham: 'x' }, extra || {});
let O2 = [gh(1, '1326T10/2026', 5850000, 'thuydinh95', true, { saleShares: [{ name: 'thuydinh95', frac: 1 }] }), gh(2, 'NG139T10/2026 GHÉP CÙNG ĐƠN 1326T10/2026', 5450000, 'thuydinh95', false)];
r = calc([big], O2);
ok(r.total === 20000 && r.bySale.length === 1, 'đơn NG ghép cùng đơn gốc cùng sale → 1 bill 11,3tr đạt mốc 10tr (' + r.total + ')');
O2 = [gh(1, '807T10/2026', 5850000, 'a', true, { saleShares: [{ name: 'a', frac: 1 }] }), gh(2, '702T10/2026 GHÉP CÙNG ĐƠN 807T10/2026', 5450000, 'a', true, { saleShares: [{ name: 'a', frac: 1 }] })];
ok(calc([big], O2).total === 0, '2 đơn gốc Base riêng (không có NG) KHÔNG gộp → 0');
O2 = [gh(1, '1326T10/2026', 5850000, 'a', true, { saleShares: [{ name: 'a', frac: 1 }] }), gh(2, 'NG139T10/2026 GHÉP CÙNG ĐƠN 1326T10/2026', 5450000, 'b', false, { saleShares: [{ name: 'b', frac: 1 }] })];
ok(calc([big], O2).total === 0, 'khác bộ sale → không gộp');
ok(calc([tier], [gh(1, '1326T10/2026', 5e6, 'A', true, { saleShares: [{ name: 'A', frac: 1 }] }), gh(2, 'NG1T10/2026 SHIP CÙNG ĐƠN 1326T10/2026', 5e6, 'A', false)]).total === 0, 'đơn gộp tính là 1 đơn (không đạt bậc 2 đơn/ngày)');
// ===== Tourmaline cao cấp xét theo GIÁ NIÊM YẾT (cột T "Đơn giá" của dữ liệu đơn) — đơn 1301T10 (Duyên 05/11/2026) =====
const t21 = Object.assign({}, base, { id: 't21', name: 'Tourmaline cao cấp — đơn từ 21tr500', requireProduct: 'TRANG SỨC NHẪN TOUR TRƠN CAO CẤP', revenue: { enabled: true, scope: 'order', min: 21500000, max: '' }, bonusAmount: 100000 });
const t31 = Object.assign({}, base, { id: 't31', name: 'Tourmaline cao cấp — đơn từ 31tr500', requireProduct: 'TRANG SỨC NHẪN TOUR TRƠN CAO CẤP', revenue: { enabled: true, scope: 'order', min: 31500000, max: '' }, bonusAmount: 200000 });
const tour = (val, niem, sp) => ({ id: 1, saleBan: 'A', giaTriDon: val, giaTriTruocGiam: niem, sanPham: sp || 'TRANG SỨC NHẪN TOUR TRƠN CAO CẤP', ghiChu: '1301T10/2026', baseNgayTao: D, ngayTao: '20/10/2026 10:00', donGoc: true, saleShares: [{ name: 'A', frac: 1 }] });
ok(calc([t21, t31], [tour(29925000, 31500000)]).total === 200000, '1301T10: niêm yết 31,5tr, sau giảm 29,925tr → T31 200.000 (không chỉ T21 100.000)');
ok(calc([t21, t31], [tour(29925000, undefined)]).total === 100000, 'chưa có giá niêm yết → xét theo giá sau giảm như cũ (T21 100.000)');
ok(calc([t21, t31], [tour(29925000, 31500000, 'NHẪN VÀNG THƯỜNG')]).total === 0, 'đơn không có nhẫn Tourmaline cao cấp → không dùng giá niêm yết');
const c10 = Object.assign({}, base, { id: 'c10', name: 'Đơn từ 10tr', revenue: { enabled: true, scope: 'order', min: 10000000, max: '' }, bonusAmount: 20000 });
ok(calc([c10], [tour(9000000, 11000000)]).total === 0, 'CT khác (10tr…) vẫn xét theo giá sau giảm, không dùng giá niêm yết');
process.exit(bad ? 1 : 0);
