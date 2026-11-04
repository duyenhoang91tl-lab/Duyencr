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
process.exit(bad ? 1 : 0);
