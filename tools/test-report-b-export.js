#!/usr/bin/env node
// Test BAM O BAO CAO A/B -> XEM DON CHI TIET (js/59-report-drill.js + phan gop trong gas_v13.js). Chay ham GAS THAT voi du lieu gia roi dua qua cua so chi tiet (jsdom).
// Chay: NODE_PATH=<noi co jsdom> node tools/test-report-drill.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const J = x => JSON.parse(JSON.stringify(x));
// ── GAS ──
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const ctx = { SpreadsheetApp: svc(), CacheService: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(),
  DocumentApp: svc(), ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console };
vm.createContext(ctx); vm.runInContext(R('gas_v13.js'), ctx, { filename: 'gas_v13.js' });
vm.runInContext(`
  var __rows = [], __don = [];
  readDTTong_ = function() { return __rows; }; readDonChiTiet_ = function() { return __don; }; _mergeTachDon_ = function(r) { return r; };
  getSetting_ = function() { return null; };
  readPancakePageMap_ = function() { return {}; }; readPancakePageMapByName_ = function() { return {}; }; readPancakeMap_ = function() { return {}; };
  _pkStatsRowsMemo_ = function() { return []; }; _pkTrackedDatesByPageAndSale_ = function() { return { datesByPage: {}, datesBySale: {} }; };
  buildPancakeReport_ = function() { return { byCS: [], byPage: [] }; }; _pancakeKnownSaleNameSet_ = function() { return {}; };
  _expandSaleFilterWithPancakeAliases_ = function(a) { return a; };
  readTeams_ = function() { return [{ id: 't1', name: 'Team Online', leader: '', members: ['anhtrinh1995', 'yenNTH2004'] }, { id: 't2', name: 'Phòng Kế toán', leader: '', members: ['menbui2002', 'phongketoan'] }]; };
  readMktTeams_ = function() { return [{ id: 'm1', name: 'MKT Hoa', pages: ['K1'] }]; }; readUsers_ = function() { return []; };
  _mktKenhWeights_ = function() { return { K1: [{ id: 'm1', name: 'MKT Hoa', w: 0.5 }, { id: 'm2', name: 'MKT Lan', w: 0.5 }] }; };
  readKPITargets_ = function() { return {}; }; readSaleDirectory_ = function() { return { list: [] }; };
`, ctx);

// ===== Bao cao B: phan chia CHINH XAC theo sale (bsx/bcx) de Excel doi chieu ke toan cong lai KHOP bang "Theo Sale" =====
const don = (day, sale, val, cod, phone) => ({ ngayTaoDon: day, trangThai: 'Hoàn thành', theSale: sale, soDienThoai: phone, nguonDon: 'Zalo', giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K' + phone.slice(-2), cod: cod, marketer: '', ghiChu: '' });
ctx.__rows = [];
ctx.__don = [don('05/10/2026', 'anhtrinh1995, menbui2002, yenNTH2004', 1000000, 100000, '0900000011'),   // chia 3 -> 333.333,33 (le)
              don('06/10/2026', 'anhtrinh1995', 500000, 0, '0900000012'),
              don('07/10/2026', '', 300000, 50000, '0900000013'),                                         // khong co sale -> (chua gan sale)
              don('08/10/2026', 'menbui2002, yenNTH2004', 900001, 1, '0900000014')];                     // chia 2 -> 450.000,5
const B = J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx));
const pairs = (o, f) => (o[f] || []);
const sumBy = (f, name) => B.orders.reduce((s, o) => s + pairs(o, f).filter(p => p[0] === name).reduce((t, p) => t + p[1], 0), 0);
ok(B.orders.length === 4 && B.orders.every(o => Array.isArray(o.bsx) && Array.isArray(o.bcx)), 'B: moi don co bsx (gia tri) va bcx (COD) theo tung sale');
ok(B.orders.every(o => o.bsx.every(p => Math.round(p[1] * 100) / 100 === p[1]) && o.bcx.every(p => Math.round(p[1] * 100) / 100 === p[1])), 'bsx/bcx lam tron toi da 2 chu so thap phan (khong lam tron nguyen)');
ok(B.bySale.length >= 3 && B.bySale.every(r => Math.abs(sumBy('bsx', r.name) - r.giaTri) < 0.05), 'B: cong bsx theo tung sale = cot "Gia tri" bang Theo Sale (sai so < 0,05 d)');
ok(B.bySale.every(r => Math.abs(sumBy('bcx', r.name) - r.cod) < 0.05), 'B: cong bcx theo tung sale = cot "COD" bang Theo Sale');
const allV = B.orders.reduce((s, o) => s + pairs(o, 'bsx').reduce((t, p) => t + p[1], 0), 0), allC = B.orders.reduce((s, o) => s + pairs(o, 'bcx').reduce((t, p) => t + p[1], 0), 0);
ok(Math.abs(allV - B.totalGiaTri) < 0.1 && Math.abs(allC - B.totalCod) < 0.1, 'B: tong moi dong chia (ke ca "(chua gan sale)") = Tong gia tri va Tong COD cua bao cao: ' + allV + ' / ' + B.totalGiaTri);
ok(B.orders[2].bsx.length === 1 && B.orders[2].bsx[0][0] === '(chưa gán sale)' && B.orders[2].bsx[0][1] === 300000 && B.orders[2].bcx[0][1] === 50000, 'don khong co sale -> 1 dong "(chua gan sale)" mang du gia tri + COD (bang Theo Sale an dong nay, Excel van liet ke)');
ok(B.orders[0].bsx.length === 3 && B.orders[0].bsx.every(p => p[1] === 333333.33) && B.orders[0].bcx.every(p => p[1] === 33333.33), 'don 3 sale: moi nguoi 333.333,33 / COD 33.333,33');
ok(B.orders[3].bsx.every(p => p[1] === 450000.5) , 'don 2 sale le: moi nguoi 450.000,5 (bs cu lam tron nguyen = 450.001 -> cong lai lech)');
ok(B.orders[3].bs.every(p => Number.isInteger(p[1])), 'bs cu van la so nguyen (cua so chi tiet khong doi)');
const Bf = J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31", sale: ["menbui2002"] })', ctx));
ok(Bf.orders.every(o => o.bsx.every(p => p[0] === 'menbui2002')) && Math.abs(Bf.orders.reduce((s, o) => s + o.bsx.reduce((t, p) => t + p[1], 0), 0) - Bf.bySale.find(r => r.name === 'menbui2002').giaTri) < 0.05, 'dang loc Sale: bsx chi con sale duoc chon va khop bang');

// ===== PHIA WEB: _srBuildExportB_ (js/13) dung dB THAT tu buildSalesReportB_ =====
const js13 = fs.readFileSync(path.join(__dirname, '..', 'js', '13-fn-bpseedofficialonlinetemplate.js'), 'utf8');
const js11 = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
const fnSrc = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } };
const cctx = vm.createContext({ Math, Number, Array, Object, String, JSON, Date });
vm.runInContext([fnSrc(js11, '_srCloseRateAvg_'), fnSrc(js13, '_srExportBLabel_'), fnSrc(js13, '_srBuildExportB_'), fnSrc(js13, '_srBuildExportBSheets_')].join('\n'), cctx);
const X = cctx._srBuildExportB_(B, { dateFrom: '2026-10-01', dateTo: '2026-10-31', filters: ['Sale: menbui2002'], at: 'luc test' });
ok(X.detailRows.length === B.orders.length + 1 && X.detailRows.every(r => r.length === 20), 'Chi tiet don: dong/don + 20 cot (dong Pos, ghi chu, Pos goc, tinh bao cao, cach tinh...)');
ok(X.allocRows.length === 1 + B.orders.reduce((n, o) => n + o.bsx.length, 0) && X.allocRows.every(r => r.length === 12), 'Chia theo Sale: 1 dong = 1 don x 1 sale (tong ' + (X.allocRows.length - 1) + ' dong)');
const bySaleAlloc = {}; X.allocRows.slice(1).forEach(r => { bySaleAlloc[r[6]] = (bySaleAlloc[r[6]] || 0) + r[8]; });
ok(B.bySale.every(r => Math.abs((bySaleAlloc[r.name] || 0) - r.giaTri) < 0.05), 'cong cot "Gia tri chia" theo sale = bang Theo Sale');
ok(Math.abs(X.grandV - B.totalGiaTri) < 0.1 && Math.abs(X.grandC - B.totalCod) < 0.1, 'tong chi tiet = Tong gia tri / Tong COD cua bao cao');
const chk = X.checkRows; const body = chk.slice(1, 1 + B.bySale.length);
ok(body.every(r => r[2] && r[2].f && /^SUMIF\('Chia theo Sale'!\$G:\$G,A\d+,'Chia theo Sale'!\$I:\$I\)$/.test(r[2].f) && Math.abs(r[3].v) < 0.05 && /^ROUND\(B\d+-C\d+,2\)$/.test(r[3].f)), 'Doi chieu tong: moi sale co cong thuc SUMIF + chenh lech ~ 0');
ok(chk.some(r => String(r[0]).indexOf('(chưa gán sale)') === 0 && r[2].v === 300000 && r[5].v === 50000), 'dong "(chua gan sale)" xuat hien o Doi chieu tong (don khong sale) du gia tri 300.000 + COD 50.000');
ok(chk.some(r => String(r[0]).indexOf('✅ KHỚP') === 0), 'ket luan "KHOP" khi tong bang nhau');
ok(X.summary[2][1] === '2026-10-01 → 2026-10-31' && X.summary[3][1] === 'Sale: menbui2002' && X.summary.some(r => r[0] === 'Tổng COD' && r[1] === B.totalCod), 'Tong quan ghi khoang ngay + bo loc + tong');
ok(X.missing === false, 'khong thieu bsx/bcx -> khong canh bao');
// nhan "cach tinh"
const L = cctx._srExportBLabel_;
ok(L({}) === 'Chia đều theo cột Thẻ' && L({ dieuChinh: 'acct' }) === 'Chia theo file kế toán' && L({ dieuChinh: 'base' }) === 'Ghép đơn Base' && L({ saleRatio: 0.3 }) === 'Quầy 30/70 (sale hưởng 30%)' && L({ dieuChinh: 'base', tachSoDon: 2 }) === 'Ghép đơn Base + Gộp đơn tách 2 phần', 'nhan "Cach tinh" cho tung truong hop');
// ===== Chot thang Pos (2026-11-06): doanh thu CHUAN luon day du; da chot thang thi them SHEET "Hoan huy thang truoc" (danh sach DON, KHONG tru) =====
ctx.__settings_snap = JSON.stringify({ '2026-09': { closedAt: '2026-09-30', total: 1300000, bySale: { anhtrinh1995: 1000000, yenNTH2004: 300000 } } });
vm.runInContext('getSetting_ = function(k) { return k === "posMonthSnapshots" ? __settings_snap : null; }; _posRevenueBySale_ = function() { return { bySale: { anhtrinh1995: 850000, yenNTH2004: 300000 }, total: 1150000 }; }; ' +
  'var __origDon = readDonChiTiet_; readDonChiTiet_ = function() { return __origDon().concat([' +
  '{ posRow: 11, ngayTaoDon: "05/09/2026", theSale: "anhtrinh1995", giaTriSauGiam: 150000, trangThai: "Đã hoàn", nguonDon: "Facebook", khachHang: "KA", soDienThoai: "0900000011", sanPham: "SP1", ghiChu: "g1" },' +
  '{ posRow: 12, ngayTaoDon: "20/09/2026", theSale: "yenNTH2004, anhtrinh1995", giaTriSauGiam: 400000, trangThai: "Đang hoàn", nguonDon: "Zalo", khachHang: "KB", soDienThoai: "0900000012", sanPham: "SP2", ghiChu: "" },' +
  '{ posRow: 13, ngayTaoDon: "21/09/2026", theSale: "yenNTH2004", giaTriSauGiam: 300000, trangThai: "Thành công", nguonDon: "Facebook", khachHang: "KC", soDienThoai: "0900000013", sanPham: "SP3", ghiChu: "" }]); }; ' +
  '_expandSaleFilterWithPancakeAliases_ = function(a) { return a; };', ctx);
const Badj = J(vm.runInContext('applyPosMonthAdjustToReportB_(buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" }), { dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx));
ok(Badj.posAdjust && Badj.posAdjust.applied && Badj.posAdjust.refund && Badj.posAdjust.refund.soDon === 2 && Badj.posAdjust.refund.tongGiaTri === 550000 && Math.abs(Badj.totalGiaTri - B.totalGiaTri) < 0.01, 'GAS: thang 10 da chot thang 9: doanh thu CHUAN khong doi; bao cao hoan/huy thang 9 = 2 don, 550.000');
const Xa = cctx._srBuildExportB_(Badj, { dateFrom: '2026-10-01', dateTo: '2026-10-31', at: 'luc test' });
ok(Xa.bySaleRows[0].length === 4 && Xa.bySaleRows[0].join('|') === 'Sale|Số đơn|Giá trị sau giảm giá|COD', 'Theo Sale: CHI 4 cot (khong con cot Tru hoan/huy, Sau tru)');
ok(!Xa.bySaleRows.some(r => /chiCoHoan|Sau trừ|Trừ hoàn/.test(r.join('|'))) && !Xa.checkRows.some(r => /Nối với|trừ hoàn|Sau trừ/.test(String(r[0]))) && !Xa.summary.some(r => /Sau trừ|^  ↳ Trừ/.test(String(r[0]))), 'KHONG con dong/cot tru hoac sau tru o Theo Sale, Doi chieu tong, Tong quan');
const rowA = Xa.bySaleRows.find(r => r[0] === 'anhtrinh1995');
ok(Math.abs(rowA[2] - B.bySale.find(r => r.name === 'anhtrinh1995').giaTri) < 0.01, 'Theo Sale: anhtrinh1995 = doanh thu CHUAN');
ok(Xa.checkRows.some(r => String(r[0]).indexOf('✅ KHỚP: tổng báo cáo') === 0) && !Xa.checkRows.some(r => String(r[0]).indexOf('⚠ LỆCH') === 0), 'Doi chieu tong: so thang voi chi tiet KHOP — khong bao lech gia');
ok(Xa.summary.some(r => /Đơn hoàn\/hủy tháng 2026-09 \(đã chốt 2026-09-30\).*KHÔNG trừ/.test(String(r[0])) && r[1] === '2 đơn · 550000') && Xa.summary.some(r => r[0] === 'Tổng giá trị sau giảm giá (tính báo cáo)' && Math.abs(r[1] - B.totalGiaTri) < 0.01), 'Tong quan: tong gia tri = CHUAN; 1 dong ghi "Don hoan/huy thang 9: 2 don · 550.000 — KHONG tru"');
const rr = Xa.refundRows;
ok(rr && /Đơn hoàn\/hủy tháng 2026-09 \(đã chốt 2026-09-30\).*KHÔNG trừ/.test(rr[0][0]) && rr[1][1] === 2 && rr[1][3] === 550000, 'sheet Hoan huy thang truoc: tieu de + dong tom tat (2 don, 550.000)');
const hi = rr.findIndex(r => r[0] === 'Ngày đơn');
ok(hi > 0 && rr[hi].join('|') === 'Ngày đơn|Dòng trong sheet Pos|Nguồn đơn|Sale (thẻ)|Giá trị|Trạng thái|Khách|SĐT|Sản phẩm|Ghi chú', 'sheet Hoan huy: tieu de cot day du');
ok(rr[hi + 1].join('|') === '05/09/2026|11|Facebook|anhtrinh1995|150000|Đã hoàn|KA|0900000011|SP1|g1' && rr[hi + 2][4] === 400000 && rr[hi + 2][5] === 'Đang hoàn' && typeof rr[hi + 1][4] === 'number', 'sheet Hoan huy: tung don (ngay, dong Pos, nguon, the, gia tri LA SO, trang thai, khach, SDT...)');
const tot = rr[rr.length - 1];
ok(/TỔNG \(2 đơn/.test(tot[0]) && tot[4].f === 'SUM(E' + (hi + 2) + ':E' + (rr.length - 1) + ')' && tot[4].f === 'SUM(E5:E6)' && tot[4].v === 550000, 'sheet Hoan huy: dong TONG la cong thuc SUM dung vung don (E5:E6: tieu de o dong 4, don dau o dong 5)');
const SHr = cctx._srBuildExportBSheets_(Badj, { dateFrom: '2026-10-01', dateTo: '2026-10-31', at: 'luc test' }, 'B ', false);
ok(SHr.sheets.map(s => s.name).slice(-2).join('|') === 'B Đối chiếu tổng|B Hoàn hủy tháng trước' && SHr.sheets.every(s => s.name.length <= 31), 'danh sach sheet (co tien to "B "): them "B Hoàn hủy tháng trước" o cuoi, ten <= 31 ky tu');
const Xn = cctx._srBuildExportB_(B, {});   // khong posAdjust -> Excel y nhu cu
ok(Xn.bySaleRows[0].length === 4 && Xn.refundRows === null && cctx._srBuildExportBSheets_(B, {}, '', false).sheets.every(s => !/Hoàn hủy/.test(s.name)), 'chua chot thang: KHONG co sheet Hoan huy thang truoc (Excel y nhu cu)');
const Xb = cctx._srBuildExportB_(Object.assign({}, B, { bhPrepaid: { count: 27, total: 63405000 } }), {});
ok(Xb.summary.some(r => /trừ tiền trả trước đơn Bảo hành có thẻ sale \(27 đơn\)/.test(r[0]) && r[1] === -63405000), 'Excel Tong quan ghi so tien tra truoc don Bao hanh da tru (27 don, −63.405.000)');
// server cu (chua co bsx/bcx) -> canh bao, khong vo
const old = JSON.parse(JSON.stringify(B)); old.orders.forEach(o => { delete o.bsx; delete o.bcx; });
const Xo = cctx._srBuildExportB_(old, {});
ok(Xo.missing === true && Xo.summary.some(r => String(r[0]).indexOf('chưa có phần chia chính xác') > -1) && Xo.allocRows.length === 1, 'GAS chua cap nhat (thieu bsx/bcx): bao ro trong Tong quan, khong bi loi');
const Xe = cctx._srBuildExportB_({ orders: [], bySale: [], totalOrders: 0, totalGiaTri: 0, totalCod: 0 }, {});
ok(Xe.detailRows.length === 1 && Xe.allocRows.length === 1 && Xe.checkRows.some(r => String(r[0]).indexOf('✅ KHỚP') === 0), 'khong co don nao: van xuat duoc, khong loi');
// GHI RA FILE .xlsx THAT roi DOC LAI (cong thuc phai con nguyen)
let XLSX = null; try { XLSX = require('xlsx'); } catch (e) {}
if (XLSX) {
  const wb = XLSX.utils.book_new();
  [['Tổng quan', X.summary], ['Theo Sale', X.bySaleRows], ['Chi tiết đơn', X.detailRows], ['Chia theo Sale', X.allocRows], ['Đối chiếu tổng', X.checkRows]].forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const rb = XLSX.read(buf, { type: 'buffer' });
  ok(rb.SheetNames.join('|') === 'Tổng quan|Theo Sale|Chi tiết đơn|Chia theo Sale|Đối chiếu tổng' && rb.SheetNames.every(n => n.length <= 31), 'file .xlsx: du 5 sheet, ten <= 31 ky tu');
  const cs = rb.Sheets['Đối chiếu tổng'];
  ok(cs['C2'] && /^SUMIF\('Chia theo Sale'!\$G:\$G,A2,'Chia theo Sale'!\$I:\$I\)$/.test(cs['C2'].f) && typeof cs['C2'].v === 'number', 'file .xlsx doc lai: o C2 con cong thuc SUMIF + gia tri da tinh san');
  ok(rb.Sheets['Chia theo Sale']['I2'] && typeof rb.Sheets['Chia theo Sale']['I2'].v === 'number', 'file .xlsx doc lai: cot "Gia tri chia" la SO (cong duoc), khong phai chu');
} else console.log('(bo qua kiem tra file .xlsx that: chua cai thu vien xlsx)');
// --- Tach danh sach sheet (_srBuildExportBSheets_) dung chung cho nut "Xuat Excel" cua B va file gop "Excel doi soat" ---
const SH = (adm, pre) => cctx._srBuildExportBSheets_(B, { dateFrom: '2026-10-01', dateTo: '2026-10-31', at: 'luc test' }, pre, adm);
const namesOf = r => r.sheets.map(x => x.name).join('|');
ok(namesOf(SH(true, '')) === 'Tổng quan|Theo Sale|Báo cáo sản phẩm|Chi tiết đơn|Chia theo Sale|Đối chiếu tổng', 'admin: GIU sheet "Bao cao san pham" (dung thu tu cu)');
ok(namesOf(SH(false, '')) === 'Tổng quan|Theo Sale|Chi tiết đơn|Chia theo Sale|Đối chiếu tổng', 'khong admin: KHONG co sheet "Bao cao san pham"');
const SHp = SH(true, 'B ');
ok(namesOf(SHp) === 'B Tổng quan|B Theo Sale|B Báo cáo sản phẩm|B Chi tiết đơn|B Chia theo Sale|B Đối chiếu tổng' && SHp.sheets.every(x => x.name.length <= 31), 'file gop: tien to "B " cho moi sheet, ten <= 31 ky tu');
const chkP = SHp.sheets.find(x => x.name === 'B Đối chiếu tổng').rows;
ok(chkP.slice(1).filter(r => r[2] && r[2].f && /^SUMIF/.test(r[2].f)).length > 0 && chkP.slice(1).filter(r => r[2] && r[2].f && /^SUMIF/.test(r[2].f)).every(r => /SUMIF\('B Chia theo Sale'!\$G:\$G,A\d+,'B Chia theo Sale'!\$[IJ]:\$[IJ]\)/.test(r[2].f)) && !JSON.stringify(chkP).includes("'Chia theo Sale'!"), 'file gop: cong thuc SUMIF tro dung ten sheet co tien to (khong con tro ten cu)');
ok(JSON.stringify(SH(true, '').sheets.find(x => x.name === 'Đối chiếu tổng').rows) === JSON.stringify(X.checkRows), 'khong tien to: sheet Doi chieu tong GIONG HET ban truoc khi tach');
// exportSalesReport nhanh B: van dung ten file + canh bao thieu bsx/bcx va chi truyen admin cho sheet san pham
ok(/_srBuildExportBSheets_\(dB, \{ dateFrom: _srState\.dateFrom[^\n]*'', _srIsAdmin\(\)\)/.test(js13) && /BaoCaoDoanhSo_B_DoiChieu_/.test(js13) && /xb\.missing/.test(js13), 'exportSalesReport nhanh B goi _srBuildExportBSheets_ (truyen _srIsAdmin) + giu ten file + canh bao thieu bsx/bcx');

// ===== Sale (khong phai admin) TAI DUOC file doi soat B (Duyen 2026-11-06: "sale co the tai file doi soat") =====
const SHs = cctx._srBuildExportBSheets_(Badj, { dateFrom: '2026-10-01', dateTo: '2026-10-31', at: 'luc test' }, '', false).sheets.map(s => s.name);
const SHa = cctx._srBuildExportBSheets_(Badj, { dateFrom: '2026-10-01', dateTo: '2026-10-31', at: 'luc test' }, '', true).sheets.map(s => s.name);
ok(!SHs.includes('Báo cáo sản phẩm') && SHa.includes('Báo cáo sản phẩm') && SHs.length === SHa.length - 1, 'Sale (khong admin): file B co du sheet, CHI thieu "Bao cao san pham" (rieng admin)');
ok(['Tổng quan', 'Theo Sale', 'Chi tiết đơn', 'Chia theo Sale', 'Đối chiếu tổng', 'Hoàn hủy tháng trước'].every(n => SHs.includes(n)), 'Sale nhan duoc ca sheet "Hoan huy thang truoc" (khi da chot) va cac sheet doi chieu');
{ // nut "Xuat Excel" cua Bao cao B khong nam trong nhanh admin
  const src13 = fs.readFileSync(path.join(__dirname, '..', 'js', '13-fn-bpseedofficialonlinetemplate.js'), 'utf8');
  const a0 = src13.indexOf("if (sub === 'A' || sub === 'B'){"), blk = src13.slice(a0, src13.indexOf("} else if (sub === 'C'){", a0));
  const lines = blk.split('\n'), xl = lines.find(l => l.includes("t('📊 Xuất Excel', 'exportSalesReport()')"));
  ok(!!xl && !/admin/.test(xl), 'nut "📊 Xuat Excel" cua Bao cao B hien cho MOI vai tro (khong dieu kien admin)');
  const adminOnly = lines.filter(l => /if \(admin\)/.test(l)).join('\n');
  ok(!/exportSalesReport\(\)/.test(adminOnly) && /exportSalesReportToSheet/.test(adminOnly), 'chi "Xuat ra Sheet" / An-Hien Page&Sale la rieng admin');
}

console.log(fails ? '\nFAILED ' + fails : '\nALL REPORT-B-EXPORT (GAS) TESTS PASSED'); process.exit(fails ? 1 : 0);
