// Test: gộp đơn GHÉP thành 1 bill khi xét thưởng THEO ĐƠN (Duyên 04/11/2026): 704T10 "GHÉP ĐƠN CÙNG 663T10" + 663T10 (trangNH2005, cùng khách).
// Chạy: node tools/test-bonus-ghep-bill.js   (nạp hàm thật từ js/12 + js/27 giống test-bonus-goc-split.js)
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync('tools/test-bonus-programs.js', 'utf8');
const head = src.slice(0, src.indexOf('const calc =')).replace(/^#!.*\n/, '');
const run = new Function('require', 'process', '__dirname', head + '\nreturn {ctx};');
const { ctx } = run(require, process, require('path').join(__dirname));
const base = { dateFrom: '', dateTo: '', audience: { online: false, offline: false }, product: '', requireProduct: '', tier: { enabled: false, rows: [] }, revenue: { enabled: false, scope: 'order', min: '', max: '' }, firstOrder: { enabled: false, amount: '' }, probationDay: { enabled: false, from: '', to: '' }, sources: [], prodRules: { enabled: false, items: [] }, bonusAmount: '' };
const rev = (id, min, amt, nsp) => Object.assign({}, base, { id, name: 'Đơn từ ' + min / 1e6 + 'tr', revenue: { enabled: true, scope: 'order', min, max: '' }, bonusAmount: amt, minProducts: nsp });
const P = [rev('a', 10e6, 20000, 2), rev('b', 15e6, 30000, 3), rev('c', 20e6, 40000, 4)];
const calc = (orders) => { ctx.P = P; ctx.O = orders; return JSON.parse(vm.runInContext('BONUS_PROGRAMS = P; JSON.stringify(_computeBonusData_(O))', ctx)); };
const D = '2026-10-16';
// 663T10: 10.260.000 (2 SP); 704T10: 7.742.000 (1 SP) "GHÉP ĐƠN CÙNG 663T10/2026" — cùng SĐT, cùng sale
const o663 = { id: 663, saleBan: 'trangNH2005', soDienThoai: '0912345678', giaTriDon: 10260000, baseNgayTao: D, ngayTao: '16/10/2026 10:00', donGoc: true, ghiChu: '663T10/2026', sanPham: 'Nhẫn A, Vòng B', maSanPham: 'NH-A;VT-B', soLuong: '1, 1', saleShares: [{ name: 'trangNH2005', frac: 1 }] };
const o704 = { id: 704, saleBan: 'trangNH2005', soDienThoai: '0912345678', giaTriDon: 7742000, baseNgayTao: D, ngayTao: '16/10/2026 11:00', donGoc: true, ghiChu: '704T10/2026\nGHÉP ĐƠN CÙNG 663T10/2026', sanPham: 'Mặt cổ C', maSanPham: 'MC-C', soLuong: '1', saleShares: [{ name: 'trangNH2005', frac: 1 }] };
const tot = (r, n) => (r.bySale.find(x => x.name === n) || { total: 0 }).total;
let r = calc([o663, o704]);
ok(tot(r, 'trangNH2005') === 30000, 'gộp 663+704 = 18.002.000, 3 SP → mốc 15tr 30.000 (1 lần), thực tế ' + tot(r, 'trangNH2005'));
ok(r.bySale[0].items.length === 1 && /GỘP 2 đơn ghép/.test(r.bySale[0].items[0].detail), 'chỉ 1 dòng thưởng, ghi rõ gộp 2 đơn');
r = calc([o663]); ok(tot(r, 'trangNH2005') === 20000, 'đơn 663 đứng riêng = 20.000 (combo 2 SP)');
r = calc([o663, Object.assign({}, o704, { soDienThoai: '0999999999' })]); ok(tot(r, 'trangNH2005') === 20000 && true, 'KHÁC SĐT → không gộp (663 20.000, 704 7,7tr không thưởng)');
r = calc([o663, Object.assign({}, o704, { saleBan: 'khacSale' })]); ok(tot(r, 'trangNH2005') === 20000, 'KHÁC sale → không gộp');
r = calc([o663, Object.assign({}, o704, { ghiChu: '704T10/2026' })]); ok(tot(r, 'trangNH2005') === 20000, 'ghi chú không trỏ tới 663 → không gộp');
r = calc([o663, Object.assign({}, o704, { trangThai: 'Đã hủy' })]); ok(tot(r, 'trangNH2005') === 20000, 'đơn đã hủy không tham gia gộp');
// thứ tự chữ kiểu cũ vẫn nhận; không gộp đơn không phải đơn gốc
r = calc([o663, Object.assign({}, o704, { ghiChu: '704T10/2026 GHÉP CÙNG ĐƠN 663T10' })]); ok(tot(r, 'trangNH2005') === 30000, '"GHÉP CÙNG ĐƠN 663T10" vẫn nhận');
r = calc([o663, Object.assign({}, o704, { donGoc: false })]); ok(tot(r, 'trangNH2005') === 20000, 'đơn không phải đơn gốc không gộp');
// 2 sale chung: thưởng gộp chia đều
const sh = (o) => Object.assign({}, o, { saleBan: 'A, B', saleShares: [{ name: 'A', frac: .5 }, { name: 'B', frac: .5 }] });
r = calc([sh(o663), sh(o704)]); ok(tot(r, 'A') === 15000 && tot(r, 'B') === 15000, 'bill gộp 2 sale: 30.000 chia đều 15.000/người');
// số đơn + doanh thu NGÀY vẫn tính từng đơn (không gộp)
const tier = Object.assign({}, base, { id: 't', name: 'Bậc đơn/ngày', tier: { enabled: true, rows: [{ count: 2, bonus: 50000 }] } });
ctx.P = [tier]; ctx.O = [o663, o704]; r = JSON.parse(vm.runInContext('BONUS_PROGRAMS = P; JSON.stringify(_computeBonusData_(O))', ctx));
ok(tot(r, 'trangNH2005') === 50000, 'thưởng theo NGÀY vẫn đếm 2 đơn riêng (đạt bậc 2 đơn)');
// hàm thuần
ok(vm.runInContext('_bcMergeGhepBills_([],null).length', ctx) === 0, 'danh sách rỗng ổn');
process.exit(bad ? 1 : 0);
