#!/usr/bin/env node
// Test Node cho P0d (docs/ROADMAP-YEU-CAU.md): posMetrics_ — chi so Pos dung chung. Khong goi mang that, khong can sheet that.
// Chay: node tools/test-metrics.js  -> in "ALL METRICS TESTS PASSED" neu dat.
// Y tuong: nap NGUYEN gas_v13.js (buildSalesReportB_ / buildFailedOrderReport_ / _mergeTachDon_ that), chi thay phan DOC sheet bang du lieu gia,
// roi (1) so posMetrics_ voi chinh Bao cao B/G tren cung bo loc — phai SAI LECH 0; (2) kiem tra tay phan "ban lai" tren du lieu co dap an biet truoc.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(a === b, m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const near = (a, b, m) => ok(Math.abs(a - b) < 1e-6, m + ' (got ' + a + ', want ' + b + ')');

const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'gas_v13.js' });

// ---- Quy tac loai don cua POS (Duyen xac nhan 10/2026, commit 711bd52 + 7c8504e): CHI loai 'Hủy đơn', 'Hoàn đơn', 'Đang hoàn' (khop CA chuoi,
// khong dau, khong phan biet hoa/thuong). Truoc do test dung 'Đã hoàn' (quy tac cu) nen sau khi doi quy tac don H bi tinh -> 10 don thay vi 9.
const excl = t => vm.runInContext('_donHasExcludedStatus_(' + JSON.stringify(t) + ')', ctx);
ok(excl('Hủy đơn') && excl('Hoàn đơn') && excl('Đang hoàn'), 'POS loai dung 3 trang thai: Huy don, Hoan don, Dang hoan');
ok(excl('HOÀN ĐƠN') && excl('  hoan don '), 'khop khong dau/khong phan biet hoa-thuong, bo khoang trang');
ok(!excl('Hoàn thành') && !excl('') && !excl('Đã hoàn') && !excl('Đã hủy'), 'trang thai khac (Hoan thanh, rong, Da hoan, Da huy) KHONG bi loai — theo dung quy tac 3 trang thai');

// ---- du lieu gia cho phan DOC sheet (ghi de sau khi nap) ----
let DON = [];
vm.runInContext(`
  var __DON__ = [];
  readDonChiTiet_ = function() { return __DON__.map(function(r) { return Object.assign({}, r); }); };
  getCrmSS_ = function() { return { getSheetByName: function() { return null; } }; };
  readTeams_ = function() { return [{ name: 'Team 1', members: ['anhNP1999', 'dungnguyen1995'] }]; };
  readPancakeMap_ = function() { return {}; };
  readPancakePageMap_ = function() { return {}; };
  readPancakePageMapByName_ = function() { return {}; };
  _pancakeKnownSaleNameSet_ = function() { return {}; };
  _srCloseRateSections_ = function() { return { saleCloseRate: [], closeFrom: '', kenhCloseRate: [], saleCloseByPage: [] }; }; // ty le chot doc sheet Pancake, khong thuoc chi so nay
  var ARCHIVE_APPLY_ENABLED_ = false;
`, ctx);
const setDon = rows => { vm.runInContext('__DON__ = ' + JSON.stringify(rows) + ';', ctx); };
let seq = 0;
const row = (ngay, phone, the, trangThai, gia, extra) => Object.assign({ ngayTaoDon: ngay, khachHang: 'K' + (++seq), soDienThoai: phone, nguonDon: 'Pancake', theSale: the, trangThai: trangThai || 'Hoàn thành',
  sanPham: 'SP', maSanPham: 'M1', soLuong: '1', giaTriSauGiam: gia, cod: 0, marketer: 'Mkt A', ghiChu: '' }, extra || {});

// ===== Bo du lieu 1: dap an biet truoc =====
// Ky loc: 2026-10-05 .. 2026-10-10.   (khach cu = co don hop le TRUOC ngay cua don dang xet)
setDon([
  // lich su (ngoai ky): khach 0901 mua 01/09 (hop le), khach 0902 chi co don "Hoàn đơn" 02/09 (KHONG tinh la da mua), khach 0903 mua 20/09
  row('01/09/2026', '0901111111', 'anhNP1999', 'Hoàn thành', 1000000),
  row('02/09/2026', '0902222222', 'anhNP1999', 'Hoàn đơn', 500000),
  row('20/09/2026', '0903333333', 'dungnguyen1995', 'Hoàn thành', 700000),
  // trong ky
  row('05/10/2026', '0901111111', 'anhNP1999', 'Hoàn thành', 2000000),                      // A: khach cu (01/09) -> BAN LAI, 1 sale
  row('06/10/2026', '0902222222', 'anhNP1999', 'Hoàn thành', 3000000),                      // B: don hoan truoc do khong tinh -> khach MOI
  row('06/10/2026', '0904444444', 'anhNP1999, dungnguyen1995', 'Hoàn thành', 4000000),      // C: khach moi, 2 sale chia deu
  row('08/10/2026', '0904444444', 'anhNP1999, dungnguyen1995', 'Hoàn thành', 1000000),      // D: khach 0904 mua lai (06/10) -> BAN LAI, chia deu 2 sale
  row('09/10/2026', '0905555555', 'dungnguyen1995', 'Hoàn thành', 500000),                  // E: khach moi
  row('09/10/2026', '0905555555', 'dungnguyen1995', 'Hoàn thành', 600000),                  // F: CUNG NGAY voi don dau -> van la khach MOI (khong tinh ban lai)
  row('07/10/2026', '', 'anhNP1999', 'Hoàn thành', 800000),                                 // G: khong co SDT -> khong xep loai
  row('07/10/2026', '0906666666', 'anhNP1999', 'Hoàn đơn', 900000),                         // H: don hoan trong ky
  row('10/10/2026', '0907777777', 'dungnguyen1995', 'Đang hoàn', 400000),                   // I: dang hoan trong ky
  row('10/10/2026', '0903333333', 'dungnguyen1995', 'Hoàn thành', 1500000),                 // J: khach cu (20/09) -> BAN LAI
  // don tach: 2 phan cung ma, gop thanh 1 don 06/10, khach 0908 chua mua truoc -> MOI
  row('06/10/2026', '0908888888', 'anhNP1999', 'Hoàn thành', 1000000, { ghiChu: '254T10/2026/1' }),
  row('07/10/2026', '0908888888', 'anhNP1999', 'Hoàn thành', 500000, { ghiChu: '254T10/2026/2' }),
  // ngoai ky (sau): khong duoc lot vao
  row('15/10/2026', '0901111111', 'anhNP1999', 'Hoàn thành', 9999999),
]);
const F = { from: '2026-10-05', to: '2026-10-10' };
const f = { dateFrom: F.from, dateTo: F.to, sale: [], nguon: [], marketer: [], sanPham: '', careStatus: [], khStatus: [], zaloStatus: [], nickZalo: '' };
const m = ctx.posMetrics_(F), B = ctx.buildSalesReportB_(f), G = ctx.buildFailedOrderReport_(f);
ok(m.ok, 'posMetrics_ phai ok'); eq(m.warnings.length, 0, 'khong co canh bao');

// (1) SAI LECH 0 so voi Bao cao B / G
eq(m.total.orders, B.totalOrders, 'so don = Bao cao B'); eq(m.total.revenue, B.totalGiaTri, 'doanh thu = Bao cao B');
eq(m.total.failedOrders, G.totalOrders, 'huy/hoan = Bao cao G'); eq(m.total.failedValue, G.totalGiaTri, 'gia tri huy/hoan = Bao cao G');
eq(m.total.aov, B.trungBinhDon, 'trung binh don = Bao cao B');
const bs = {}; B.bySale.forEach(x => { bs[x.name] = x; }); const gs = {}; G.bySale.forEach(x => { gs[x.name] = x; });
const names = new Set(Object.keys(bs).concat(Object.keys(gs)));
eq(m.bySale.length, names.size, 'so sale = hop B va G');
m.bySale.forEach(s => {
  const b = bs[s.name] || { orders: 0, giaTri: 0 }, g = gs[s.name] || { orders: 0, giaTri: 0 };
  eq(s.orders, b.orders, s.name + ': so don'); near(s.revenue, b.giaTri, s.name + ': doanh thu');
  eq(s.failedOrders, g.orders, s.name + ': huy/hoan'); near(s.failedValue, g.giaTri, s.name + ': gia tri huy/hoan');
});
// theo ngay: tong = tong ky
near(m.byDay.reduce((a, d) => a + d.revenue, 0), m.total.revenue, 'tong doanh thu theo ngay = tong');
eq(m.byDay.reduce((a, d) => a + d.orders, 0), m.total.orders, 'tong don theo ngay = tong');
eq(m.byDay.reduce((a, d) => a + d.failedOrders, 0), m.total.failedOrders, 'tong huy/hoan theo ngay = tong');

// (2) Dap an tinh tay
// don hop le trong ky (sau gop tach): A,B,C,D,E,F,G(khong SDT),J, tach(1 don) = 9 don; doanh thu = 2+3+4+1+0.5+0.6+0.8+1.5+1.5 (tach 1.0+0.5) = 14.9tr
eq(m.total.orders, 9, 'tong so don Pos trong ky = 9'); near(m.total.revenue, 14900000, 'tong doanh thu = 14.900.000');
eq(m.total.failedOrders, 2, 'huy/hoan = 2 (H, I)'); near(m.total.failedValue, 1300000, 'gia tri huy/hoan = 1.300.000');
near(m.total.failRate, Math.round(2 / 11 * 1000) / 10, 'ty le huy/hoan = 2/(9+2)');
// ban lai: A, D, J = 3 don, doanh thu 2 + 1 + 1.5 = 4.5tr ; khong xep loai: G (1 don 0.8tr) ; con lai 5 don la khach moi (B,C,E,F,tach)
eq(m.resale.orders, 3, 'ban lai = 3 don (A, D, J)'); near(m.resale.revenue, 4500000, 'doanh thu ban lai = 4.500.000');
eq(m.resale.newOrders, 5, 'khach moi = 5 don (B, C, E, F, tach)'); eq(m.resale.unknownPhoneOrders, 1, 'khong SDT = 1 don'); near(m.resale.unknownPhoneRevenue, 800000, 'doanh thu khong SDT');
near(m.resale.revenue + m.resale.newRevenue + m.resale.unknownPhoneRevenue, m.total.revenue, 'ban lai + moi + khong SDT = doanh thu tong');
eq(m.resale.orders + m.resale.newOrders + m.resale.unknownPhoneOrders, m.total.orders, 'ban lai + moi + khong SDT = so don tong');
near(m.resale.rate, 37.5, 'ty le ban lai = 3/8 = 37,5%');
// theo sale: anhNP1999 co A(2tr) + D(1tr chia doi = 0.5tr) ; dungnguyen1995 co D(0.5tr) + J(1.5tr)
const an = m.bySale.find(s => s.name === 'anhNP1999'), du = m.bySale.find(s => s.name === 'dungnguyen1995');
eq(an.resaleOrders, 2, 'anhNP1999: 2 don ban lai'); near(an.resaleRevenue, 2500000, 'anhNP1999: doanh thu ban lai 2,5tr');
eq(du.resaleOrders, 2, 'dungnguyen1995: 2 don ban lai'); near(du.resaleRevenue, 2000000, 'dungnguyen1995: doanh thu ban lai 2tr');
near(an.resaleRevenue + du.resaleRevenue, m.resale.revenue, 'tong ban lai theo sale = tong ban lai');
// theo ngay: 05/10 co 1 don ban lai (A), 08/10 co 1 (D), 10/10 co 1 (J)
const dayR = {}; m.byDay.forEach(d => { dayR[d.day] = d.resaleOrders; });
eq(dayR['2026-10-05'], 1, 'ngay 05/10: 1 ban lai'); eq(dayR['2026-10-08'], 1, 'ngay 08/10: 1 ban lai'); eq(dayR['2026-10-10'], 1, 'ngay 10/10: 1 ban lai'); eq(dayR['2026-10-06'], 0, 'ngay 06/10: 0 ban lai');

// (3) Bo loc: loc theo sale phai cho cung ket qua voi B/G tren cung bo loc
const m2 = ctx.posMetrics_(Object.assign({ sale: ['dungnguyen1995'] }, F)), B2 = ctx.buildSalesReportB_(Object.assign({}, f, { sale: ['dungnguyen1995'] })), G2 = ctx.buildFailedOrderReport_(Object.assign({}, f, { sale: ['dungnguyen1995'] }));
eq(m2.total.orders, B2.totalOrders, 'loc sale: so don = B'); near(m2.total.revenue, B2.totalGiaTri, 'loc sale: doanh thu = B'); eq(m2.total.failedOrders, G2.totalOrders, 'loc sale: huy/hoan = G');

// (4) Ky khong co don -> khong tra 0 gia: ty le/ trung binh la null
const m3 = ctx.posMetrics_({ from: '2025-01-01', to: '2025-01-31' });
ok(m3.ok, 'ky rong van ok'); eq(m3.total.orders, 0, 'ky rong: 0 don'); eq(m3.total.aov, null, 'ky rong: trung binh don = null'); eq(m3.total.failRate, null, 'ky rong: ty le huy/hoan = null'); eq(m3.resale.rate, null, 'ky rong: ty le ban lai = null');

// (5) Mot nguon loi khong lam mat nguon kia; ca hai loi -> ok:false
vm.runInContext('var __origG = buildFailedOrderReport_; buildFailedOrderReport_ = function() { throw new Error("G hong"); };', ctx);
const m4 = ctx.posMetrics_(F);
ok(m4.ok && m4.total.orders === 9 && m4.total.failedOrders === null && m4.total.failRate === null, 'G loi: van co doanh thu, huy/hoan = null');
ok(m4.warnings.some(w => /hủy\/hoàn/.test(w)), 'G loi: co canh bao');
vm.runInContext('buildFailedOrderReport_ = __origG; var __origB = buildSalesReportB_; buildSalesReportB_ = function() { throw new Error("B hong"); };', ctx);
const m5 = ctx.posMetrics_(F);
ok(m5.ok && m5.total.revenue === null && m5.total.failedOrders === 2 && m5.resale === null, 'B loi: van co huy/hoan, doanh thu/ban lai = null');
vm.runInContext('buildFailedOrderReport_ = function() { throw new Error("G hong"); };', ctx);
eq(ctx.posMetrics_(F).ok, false, 'ca B va G loi -> ok:false');
vm.runInContext('buildSalesReportB_ = __origB; buildFailedOrderReport_ = __origG;', ctx);

// (6) Don quay 30/70 + ghep: chia sale phai khop B ngay ca khi co saleRatio
setDon([
  row('06/10/2026', '0911111111', 'anhNP1999', 'Hoàn thành', 1000000),
  row('08/10/2026', '0911111111', 'anhNP1999, dungnguyen1995', 'Hoàn thành', 2000000, { nguonDon: 'Quầy Hào Nam', ghiChu: 'quay 30/70' }), // ban lai, quay 30/70: sale chi nhan 30%, chia 2 -> moi nguoi 15%
]);
const m6 = ctx.posMetrics_(F), B6 = ctx.buildSalesReportB_(f);
const b6 = {}; B6.bySale.forEach(x => { b6[x.name] = x; });
m6.bySale.forEach(s => near(s.revenue, b6[s.name].giaTri, 'quay 30/70 ' + s.name + ': doanh thu = B'));
eq(m6.resale.orders, 1, 'quay: 1 don ban lai');
near(m6.bySale.find(s => s.name === 'anhNP1999').resaleRevenue, 2000000 * 0.15, 'quay 30/70: anhNP1999 nhan 15% doanh thu ban lai');
near(m6.bySale.find(s => s.name === 'dungnguyen1995').resaleRevenue, 2000000 * 0.15, 'quay 30/70: dungnguyen1995 nhan 15%');

// (7) Canh bao khi bat luu tru don cu
setDon([row('06/10/2026', '0911111111', 'anhNP1999', 'Hoàn thành', 1000000)]);
vm.runInContext('ARCHIVE_APPLY_ENABLED_ = true;', ctx);
ok(ctx.posMetrics_(F).warnings.some(w => /lưu trữ/.test(w)), 'bat luu tru -> co canh bao lich su ban lai co the thieu');

console.log('ALL METRICS TESTS PASSED');
