#!/usr/bin/env node
// Test CHOT THANG POS -> bang "Theo Sale" cua Bao cao B TU NHAY theo moc chot (Duyen 2026-11-02). Chay ham GAS THAT voi du lieu gia.
// Chay: node tools/test-pos-month-adjust.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(R('gas_v13.js'), ctx, { filename: 'gas_v13.js' });
// Gia lap: bySale cua tung thang lay tu 1 bang cho truoc; setting luu o bien.
vm.runInContext(`
  var __settings = {}; getSetting_ = function(k) { return __settings[k] == null ? null : __settings[k]; }; setSetting_ = function(k, v) { __settings[k] = v; };
  var __today = '2026-11', __last = false; _todayYm_ = function() { return __today; }; _isLastDayOfMonthVn_ = function() { return __last; };
  _vnYmd_ = function() { return '2026-10-31'; };
  var __data = {};   // ym -> { sale: giaTri }  (so HIEN TAI cua tung thang)
  var __ord = []; readDonChiTiet_ = function() { return __ord; };   // don Pos (bao cao hoan/huy thang truoc doc don that -> phai gia lap cho MOI ca)
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  buildSalesReportB_ = function(f) { var ym = f.dateFrom.slice(0, 7), d = __data[ym] || {}; var bs = Object.keys(d).map(function(n) { return { name: n, orders: 5, giaTri: d[n], cod: 0 }; });
    return { totalOrders: 5 * bs.length, totalGiaTri: bs.reduce(function(s, r) { return s + r.giaTri; }, 0), bySale: bs, trungBinhDon: 0 }; };
`, ctx);
const run = c => J(vm.runInContext(c, ctx));

// ── 1. Cho chot thang hien tai CHI vao ngay cuoi thang ──
ctx.__today = '2026-10'; ctx.__last = false;
ok(run('_posCanCloseMonth_("2026-10")').ok === false, 'giua thang 10: chua chot duoc thang 10');
ctx.__last = true;
ok(run('_posCanCloseMonth_("2026-10")').ok === true, 'NGAY CUOI thang 10: chot duoc thang 10 (yeu cau cua Duyen)');
ok(run('_posCanCloseMonth_("2026-11")').ok === false, 'thang tuong lai van bi chan');
ok(run('_posCanCloseMonth_("2026-09")').ok === true, 'thang da qua chot binh thuong');

// ── 2. Chot thang 10 vao cuoi thang, sau do thang 11 tru hoan/huy phat sinh sau luc chot ──
ctx.__data = { '2026-10': { anhtrinh1995: 1000000, yenNTH2004: 600000 } };
const c1 = run('closePosMonth_("2026-10")');
ok(c1.ok && c1.total === 1600000 && c1.saleCount === 2, 'chot thang 10 luc cuoi thang: luu anh chup 1.600.000 / 2 sale');
// sau chot: don thang 10 cua anhtrinh1995 bi hoan 150.000 -> so thang 10 tinh lai con 850.000
ctx.__data = { '2026-10': { anhtrinh1995: 850000, yenNTH2004: 600000 }, '2026-11': { anhtrinh1995: 700000, yenNTH2004: 300000, menbui2002: 200000 } };
ctx.__today = '2026-11'; ctx.__last = true;   // NGAY CUOI thang 11: moi tru hoan/huy thang truoc (giua thang thi khong tru — xem muc 7)
const F11 = { dateFrom: '2026-11-01', dateTo: '2026-11-30' };
let r = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-11-01",dateTo:"2026-11-30"}), ' + JSON.stringify(F11) + ')');
const byN = n => r.bySale.find(x => x.name === n);
ok(r.posAdjust && r.posAdjust.applied && r.posAdjust.prevMonth === '2026-10', 'thang 11: posAdjust.applied, tru hoan/huy cua thang 10');
ok(byN('anhtrinh1995').giaTri === 700000 && byN('anhtrinh1995').giaTriGoc === 700000 && byN('anhtrinh1995').truHoanHuy === 150000 && byN('anhtrinh1995').giaTriSauTru === 550000, 'DOANH THU CHUAN giu nguyen 700.000 (KHONG tru truc tiep); phan tru 150.000 va sau tru 550.000 nam o cot rieng');
ok(byN('yenNTH2004').giaTri === 300000 && byN('menbui2002').giaTri === 200000 && byN('yenNTH2004').truHoanHuy === 0 && byN('menbui2002').giaTriSauTru === 200000, 'sale khong bi hoan: giu nguyen, tru 0');
ok(r.totalGiaTri === 1200000 && r.totalGiaTriGoc === 1200000 && r.totalGiaTriSauTru === 1050000 && r.posAdjust.totalDeduction === 150000 && r.posAdjust.totalGiaTri === 1200000 && r.posAdjust.totalSauTru === 1050000, 'TONG CHUAN 1.200.000 giu nguyen; tru rieng 150.000 -> sau tru 1.050.000');
ok(r.bySale.map(x => x.name).join() === 'anhtrinh1995,yenNTH2004,menbui2002' && r.posAdjust.rows.map(x => x.name).join() === 'anhtrinh1995,yenNTH2004,menbui2002', 'bang chinh sap theo doanh thu chuan; bang tru (posAdjust.rows) sap theo so sau tru');
ok(r.posAdjust.rows.length === 3 && r.posAdjust.rows[0].name === 'anhtrinh1995' && r.posAdjust.rows[0].giaTri === 700000 && r.posAdjust.rows[0].truHoanHuy === 150000 && r.posAdjust.rows[0].giaTriSauTru === 550000 && r.posAdjust.rows[0].orders === byN('anhtrinh1995').orders, 'posAdjust.rows: tung sale co chuan / tru / sau tru / so don de hien bang ben duoi');
// khop voi nut "Xem sau khi tru hoan/huy" (posMonthAdjust_)
const adj = run('posMonthAdjust_("2026-11")');
ok(adj.rows.every(x => byN(x.name) && byN(x.name).giaTri === x.revenue && byN(x.name).giaTriSauTru === x.net) && adj.totalNet === r.totalGiaTriSauTru, 'cot chuan / sau tru khop nut Xem sau khi tru hoan/huy (posMonthAdjust_): cung 1 so');

// ── 3. Cac truong hop KHONG ap ──
r = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-12-01",dateTo:"2026-12-31"}), {dateFrom:"2026-12-01",dateTo:"2026-12-31"})');
ok(r.posAdjust && !r.posAdjust.applied && /Chưa chốt/.test(r.posAdjust.reason), 'chua chot thang truoc (thang 12): giu nguyen + ly do');
const rg = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-11-05",dateTo:"2026-11-30"}), {dateFrom:"2026-11-05",dateTo:"2026-11-30"})');
ok(rg.posAdjust === undefined && rg.bySale.length === 3 && rg.bySale[0].truHoanHuy === undefined, 'khoang ngay KHONG phai tron 1 thang: khong tru');
r = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-11-01",dateTo:"2026-11-30"}), {dateFrom:"2026-11-01",dateTo:"2026-11-30",nguon:["Zalo"]})');
ok(r.posAdjust && !r.posAdjust.applied && /Nguồn/.test(r.posAdjust.reason), 'dang loc Nguon: khong tru, co ly do');
// loc theo danh sach sale: chi tru cho sale trong danh sach
r = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-11-01",dateTo:"2026-11-30"}), {dateFrom:"2026-11-01",dateTo:"2026-11-30",sale:["yenNTH2004"]})');
ok(r.posAdjust.applied && r.posAdjust.totalDeduction === 0, 'loc sale khong bi hoan: tong tru = 0 (khong tru nham cua sale khac)');
r = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-11-01",dateTo:"2026-11-30"}), {dateFrom:"2026-11-01",dateTo:"2026-11-30",sale:["anhtrinh1995"]})');
ok(r.posAdjust.totalDeduction === 150000, 'loc dung sale bi hoan: tru 150.000');

// ── 4. Sale chi co hoan/huy, thang M khong co don -> van hien dong am ──
ctx.__data = { '2026-10': { anhtrinh1995: 850000, yenNTH2004: 600000 }, '2026-11': { yenNTH2004: 300000 } };
r = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-11-01",dateTo:"2026-11-30"}), {dateFrom:"2026-11-01",dateTo:"2026-11-30"})');
ok(!r.bySale.some(x => x.name === 'anhtrinh1995') && r.posAdjust.rows.some(x => x.name === 'anhtrinh1995' && x.giaTri === 0 && x.orders === 0 && x.truHoanHuy === 150000 && x.giaTriSauTru === -150000), 'sale khong co don thang 11 nhung co hoan/huy thang 10: KHONG them dong vao bang chinh; chi co dong am −150.000 o bang tru');
ok(r.totalGiaTri === 300000 && r.totalGiaTriSauTru === 150000, 'tong chuan 300.000; sau tru 150.000');

ctx.__last = false;   // tu day: giua thang 11 (chua ket thuc)
// ── 5. Anh chup luc chot la so GOC (khong bi tru long nhau) ──
ctx.__data = { '2026-10': { a: 100 }, '2026-11': { a: 80 } };
vm.runInContext('__settings = {}', ctx);
run('closePosMonth_("2026-10")'); ctx.__data['2026-10'].a = 90;
run('closePosMonth_("2026-11", false)');   // thang 11 chua ket thuc -> bi chan
const snaps = JSON.parse(vm.runInContext('__settings.posMonthSnapshots', ctx));
ok(snaps['2026-10'] && snaps['2026-10'].bySale.a === 100 && !snaps['2026-11'], 'snapshot thang 10 = so goc 100; thang 11 chua ket thuc nen khong chot');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA QUA');
ctx.__last = true;   // muc 6 xem NGAY CUOI thang 11
// ── 6. BAO CAO DON HOAN/HUY THANG TRUOC (2026-11-05): chi liet ke don, khong tru; chi co khi da chot; sale chi thay don cua minh ──
const od = (posRow, ngay, the, gt, tt) => ({ posRow, ngayTaoDon: ngay, theSale: the, giaTriSauGiam: gt, trangThai: tt, nguonDon: 'Facebook', khachHang: 'K' + posRow, soDienThoai: '09' + posRow, sanPham: 'SP', ghiChu: '' });
ctx.__ord = [od(2, '05/10/2026', 'anhtrinh1995', 150000, 'Đã hoàn'), od(3, '20/10/2026', 'yenNTH2004, anhtrinh1995', 400000, 'Đang hoàn'), od(4, '12/10/2026', 'yenNTH2004', 300000, 'Thành công'),
  od(5, '28/10/2026', 'menbui2002', 90000, 'Đã hoàn'), od(6, '03/11/2026', 'menbui2002', 70000, 'Đã hoàn'), od(7, '30/09/2026', 'yenNTH2004', 50000, 'Đã hoàn')];
let q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + JSON.stringify(F11) + '), ' + JSON.stringify(F11) + ')');
const rf = q.posAdjust.refund;
ok(rf && rf.month === '2026-10' && rf.soDon === 3 && rf.tongGiaTri === 640000, 'da chot thang 10: bao cao hoan/huy thang 10 = 3 don (Da hoan + Dang hoan, KHONG lan thang 9/11 va don Thanh cong) tong 640.000');
ok(rf.orders.map(o => o.posRow).join() === '2,3,5' && rf.orders[0].ngay === '05/10/2026' && rf.orders[0].trangThai === 'Đã hoàn' && rf.orders[1].sales.join() === 'yenNTH2004,anhtrinh1995', 'danh sach sap theo ngay, kem trang thai + cac ten sale tren the');
ok(q.totalGiaTri === q.totalGiaTriGoc && q.totalGiaTri === q.bySale.reduce((a, x) => a + x.giaTri, 0) && q.bySale.every(x => x.giaTri === x.giaTriGoc), 'doanh thu chuan KHONG doi (tong = tong cac dong = so goc) khi co bao cao hoan/huy');
const fS = JSON.stringify(Object.assign({ sale: ['yenNTH2004'] }, F11));
q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + fS + '), ' + fS + ')');
ok(q.posAdjust.refund && q.posAdjust.refund.orders.map(o => o.posRow).join() === '3' && q.posAdjust.refund.soDon === 1 && q.posAdjust.refund.tongGiaTri === 400000, 'Sale chi xem DON CUA MINH (yenNTH2004: 1 don 400.000, khong thay don cua nguoi khac)');
q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-12-01",dateTo:"2026-12-31"}), {dateFrom:"2026-12-01",dateTo:"2026-12-31"})');
ok(q.posAdjust && q.posAdjust.applied === false && q.posAdjust.refund === undefined, 'thang 12: thang 11 CHUA chot -> KHONG co bao cao hoan/huy');
q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_({dateFrom:"2026-11-01",dateTo:"2026-11-15"}), {dateFrom:"2026-11-01",dateTo:"2026-11-15"})');
ok(q.posAdjust === undefined || !q.posAdjust.refund, 'xem khoang ngay khong tron thang -> khong co bao cao hoan/huy');
ctx.__ord = Array.from({ length: 3100 }, (_, i) => od(1000 + i, '10/10/2026', 'anhtrinh1995', 10, 'Đã hoàn'));
q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + JSON.stringify(F11) + '), ' + JSON.stringify(F11) + ')');
ok(q.posAdjust.refund.orders.length === 3000 && q.posAdjust.refund.soDon === 3100 && q.posAdjust.refund.truncated === true && q.posAdjust.refund.tongGiaTri === 31000, 'qua 3000 don: cat danh sach, van tinh dung so don + tong tren TAT CA, truncated = true');

// ── 7. (2026-11-09) Tru hoan/huy thang truoc CHI vao CUOI THANG: dang giua thang moi (chua chot so) thi KHONG tru, KHONG liet ke, KHONG tinh lai thang truoc ──
ctx.__ord = []; ctx.__data = { '2026-10': { a: 90 }, '2026-11': { a: 70 } };
vm.runInContext('__settings.posMonthSnapshots = JSON.stringify({"2026-10": {closedAt: "2026-10-31", total: 100, bySale: {a: 100}}}); __today = "2026-11"; __last = false; var __b10 = 0; var __orig = buildSalesReportB_; buildSalesReportB_ = function(f) { if (f.dateFrom.slice(0, 7) === "2026-10") __b10++; return __orig(f); };', ctx);
q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + JSON.stringify(F11) + '), ' + JSON.stringify(F11) + ')');
ok(q.posAdjust === undefined && q.bySale[0].truHoanHuy === undefined && q.totalGiaTri === 70, 'GIUA thang 11 (chua toi ngay cuoi): khong co posAdjust, doanh thu chuan giu nguyen');
ok(ctx.__b10 === 0, 'giua thang: KHONG tinh lai Bao cao B thang 10');
vm.runInContext('__last = true', ctx);
q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + JSON.stringify(F11) + '), ' + JSON.stringify(F11) + ')');
ok(q.posAdjust && q.posAdjust.applied && q.posAdjust.totalDeduction === 10, 'NGAY CUOI thang 11: tru hoan/huy thang 10 (100 - 90 = 10)');
vm.runInContext('__today = "2026-12"; __last = false;', ctx);
q = run('applyPosMonthAdjustToReportB_(buildSalesReportB_(' + JSON.stringify(F11) + '), ' + JSON.stringify(F11) + ')');
ok(q.posAdjust && q.posAdjust.applied, 'sang thang 12 xem lai thang 11 (da ket thuc): van tru binh thuong');

process.exit(fails ? 1 : 0);
