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
vm.runInContext([fnSrc(js11, '_srCloseRateAvg_'), fnSrc(js13, '_srExportBLabel_'), fnSrc(js13, '_srBuildExportB_')].join('\n'), cctx);
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
ok(/_srIsAdmin\(\)\) XLSX\.utils\.book_append_sheet\(wbB, XLSX\.utils\.aoa_to_sheet\(productRows\), 'Báo cáo sản phẩm'\)/.test(js13), 'KHONG lam mat sheet "Bao cao san pham" (chi admin) vom co o xuat Excel B');
ok(/_srBuildExportB_\(dB, \{ dateFrom: _srState\.dateFrom/.test(js13) && /BaoCaoDoanhSo_B_DoiChieu_/.test(js13) && /'Chia theo Sale'/.test(js13) && /'Đối chiếu tổng'/.test(js13), 'exportSalesReport nhanh B goi _srBuildExportB_ va them 2 sheet moi');
console.log(fails ? '\nFAILED ' + fails : '\nALL REPORT-B-EXPORT (GAS) TESTS PASSED'); process.exit(fails ? 1 : 0);
