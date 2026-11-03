#!/usr/bin/env node
// Test "EXCEL DOI SOAT" GOP B+E+G+L+N (js/61-recon-export.js). Dung DU LIEU B THAT tu buildSalesReportB_ (gas_v13.js) roi chay HAM THAT cua web:
// B (js/13) · N, L (js/11) · G (js/12) · E (js/01 _computeCommissionData_) -> kiem tra so tong cheo, cong thuc, tach loi tung bao cao, ghi file .xlsx that + doc lai.
// Chay: NODE_PATH=<noi co xlsx> node tools/test-recon-export.js   (khong co xlsx thi bo qua phan ghi file that)
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

// ===== 1) Du lieu B THAT tu GAS =====
const don = (day, sale, val, cod, phone, extra) => Object.assign({ ngayTaoDon: day, trangThai: 'Hoàn thành', theSale: sale, soDienThoai: phone, nguonDon: 'Zalo', giaTri: val, giaTriSauGiam: val, sanPham: 'Nhẫn', maSanPham: 'N1', soLuong: '1', khachHang: 'K' + phone.slice(-2), cod: cod, marketer: '', ghiChu: '' }, extra || {});
ctx.__rows = [];
ctx.__don = [don('05/10/2026', 'anhtrinh1995, menbui2002, yenNTH2004', 1000000, 100000, '0900000011'),
              don('06/10/2026', 'anhtrinh1995', 500000, 0, '0900000012', { nguonDon: 'Facebook' }),     // kenh % rieng (1%)
              don('07/10/2026', '', 300000, 50000, '0900000013'),                                        // chua gan sale
              don('08/10/2026', 'menbui2002, yenNTH2004', 900001, 1, '0900000014'),                      // chia 2 le
              don('09/10/2026', 'anhtrinh1995', 16000000, 0, '0900000015')];                             // don >= 15tr
const B = J(vm.runInContext('buildSalesReportB_({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })', ctx));
ok(B.orders.length === 5 && B.orders.every(o => Array.isArray(o.bsx)), 'B that tu GAS: 5 don, co bsx/bcx');

// ===== 2) Ham THAT cua web =====
const j01 = R('js/01-fn-splitmulti.js'), j11 = R('js/11-fn-srload.js'), j12 = R('js/12-fn-rendersalesreporttabe.js'), j13 = R('js/13-fn-bpseedofficialonlinetemplate.js'), j61 = R('js/61-recon-export.js'), j62 = R('js/62-sale-channel-periods.js'), j63 = R('js/63-fn-saleincome.js');
const fnSrc = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); } };
let XLSX = null; try { XLSX = require('xlsx'); } catch (e) {}
const toasts = [];
const w = vm.createContext({ Math, Number, Array, Object, String, JSON, Date, RegExp, console, XLSX, toast: m => toasts.push(m) });
vm.runInContext(`
  var COMMISSION_THRESHOLD = 15000000, BONUS_PROGRAMS = [{ id: 'p1' }];
  var _goldChannelRule_ = function() { return null; };
  var _channelCommissionRate_ = function(n) { return /^facebook$/i.test(String(n || '').trim()) ? 1 : null; };
  var _resolveCommissionRate_ = function(n) { return { above15: 1.5, below15: 1, sourceAbove15: 'Cá nhân', sourceBelow15: 'Team X' }; };
  var _commThrLabel_ = function() { return '15tr'; };
  var _srState = { bSale: [], byCreator: false };
  var CH = { anhtrinh1995: 'online', menbui2002: 'offline', yenNTH2004: 'probation' };
  var _saleChannelOf_ = function(n) { return CH[n] || ''; };
  var _saleStartDate_ = function() { return '2026-09-20'; }, _daysSinceStart_ = function() { return 12; };
  var __bonusThrow = false;
  var _computeBonusData_ = function(orders) {
    if (__bonusThrow) throw new Error('loi gia lap chuong trinh thuong');
    var by = {}; orders.forEach(function(o) { String(o.saleBan || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).forEach(function(n) { (by[n] = by[n] || { name: n, total: 0, items: [] }); var amt = 1000; by[n].total += amt; by[n].items.push({ date: '2026-10-05', scope: 'Theo đơn', program: 'CT <A>', detail: 'Đơn &lt;&gt; 1 triệu', amount: amt, maDonPos: 'M1' }); }); });
    return { total: 0, bySale: Object.keys(by).map(function(k) { return by[k]; }) };
  };
`, w);
vm.runInContext(['splitMulti_'].map(n => fnSrc(j01, n)).join('\n') + '\n' + j01.match(/function isNumTagSale_\(x\)\{[^\n]*\}/)[0] + '\n' + fnSrc(j01, '_computeCommissionData_'), w);
vm.runInContext('var _srLTienLbl_ = function(s) { return String(s || ""); };', w);
vm.runInContext(['_srCloseRateAvg_', '_srOrdNames_', '_srOrderShares_', '_srPureCalc_', '_srAdjTypes_', '_srPureOrders_', '_srPureDetailRows_', '_srPureBuildSheets_', '_srLLechSheet_', '_srLBuildAcctSheets_', '_srLBuildRows_'].map(n => fnSrc(j11, n)).join('\n'), w);
vm.runInContext("var _SR_UNASSIGNED_ = '(chưa gán sale)'; var _srKeepSelectedSales_ = function(rows) { return rows; };", w);
vm.runInContext(['_srGEligible_', '_srGSaleTypeLabel_', '_srGDecode_', '_srGBuildGroups_', '_srGBuildExport_', '_srGNum_', '_srGSheet_'].map(n => fnSrc(j12, n)).join('\n'), w);
vm.runInContext(['_srExportBLabel_', '_srBuildExportB_', '_srBuildExportBSheets_'].map(n => fnSrc(j13, n)).join('\n'), w);
// Phan loai Sale theo moc ngay (js/62, ham THAT) + Thu nhap tung Sale cua Bao cao E (js/63, ham THAT)
vm.runInContext("var SALE_CHANNEL_PERIODS = {}; var _cfgByAlias = function(m, n) { return m && m[n]; };", w);
vm.runInContext(['_scpNorm_', '_scpListOf_', '_saleChannelOn_'].map(n => fnSrc(j62, n)).join('\n'), w);
vm.runInContext(['_incomeIsTrialProgram_', '_computeSaleIncome_', '_incomeExportRows_'].map(n => fnSrc(j63, n)).join('\n') + '\n' + j63.match(/var _INCOME_GROUPS_ = [^\n]*/)[0], w);
vm.runInContext(j61, w);
const info = { dateFrom: '2026-10-01', dateTo: '2026-10-31', filters: ['Sale: anhtrinh1995'], at: 'luc test', ymd: '2026-11-02', user: 'Duyen', admin: true };

// L mau (cau truc nhu storeCaseReport)
const L = { ok: true, sharePct: 30, dateFrom: '2026-10-01', dateTo: '2026-10-31', totals: { dongHen: 2, dongCoDon: 1, soDon: 1, doanhThuDon: 1000000, daTinh: 300000, trungBoQua: 0 },
  bySale: [{ sale: 'anhtrinh1995', khHen: 2, khCoDon: 1, soDon: 1, doanhThuDon: 1000000, credited: 300000, dupSkipped: 0 }],
  rows: [{ row: 5, stt: 1, visitDates: ['01/10/2026'], tenKh: 'Khách A', phone: '0911111111', kenh: 'Zalo', saleRaw: 'anhtrinh1995', sales: [{ name: 'anhtrinh1995' }], tinhTrang: 'x', doanhThuSheet: 1000000, nvCh: 'NV', flags: [],
    orders: [{ ngay: '01/10/2026', nguonDon: 'Zalo', codes: ['M1'], posRow: 9, ghiChu: 'M1', sanPham: 'Nhẫn', giaTri: 1000000, theSale: '', status: 'tinh', note: '', credits: [{ sale: 'anhtrinh1995', amount: 300000, dup: false }] }] }],
  acctCheck: { missing: [{ codes: ['M2'], ngay: '02/10/2026', phone: '0922222222', khachHang: 'B', nguonDon: 'Zalo', sales: ['anhtrinh1995'], giaTri: 500000, chiaSale: 150000, phanQuay: 350000, posRow: 11, storeRows: [6], status: 'chua-ghi', loaiXuLy: 'tinh' }], lech: [] } };

let plan = w.eval ? null : null;
w.__B = B; w.__L = L; w.__info = info;
plan = vm.runInContext('_reconCollect_(__B, __L, __info)', w);
const names = plan.items.map(i => i.name), cnt = (re) => names.filter(n => re.test(n)).length;
ok(names[0] === 'Mục lục', 'sheet dau = "Muc luc"');
ok(cnt(/^B /) === 6 && cnt(/^E /) >= 6 && cnt(/^G /) === 3 && cnt(/^L /) >= 3 && cnt(/^N /) === 4, 'du sheet 5 bao cao: ' + names.join(' | '));
const orderedOK = ['B', 'E', 'G', 'L', 'N'].every((p, i, a) => !i || names.findIndex(n => n.startsWith(p + ' ')) > names.findIndex(n => n.startsWith(a[i - 1] + ' ')));
ok(orderedOK, 'thu tu sheet: B → E → G → L → N');
ok(names.every(n => n.length <= 31) && new Set(names.map(n => n.toLowerCase())).size === names.length, 'ten sheet <= 31 ky tu va khong trung');
ok(plan.warnings.length === 0, 'khong canh bao khi du lieu day du: ' + JSON.stringify(plan.warnings));
const S = n => plan.items.find(i => i.name === n);

// --- Doi chieu cheo ---
const chk = c => plan.checks.find(x => x.code === c[0] && c[1].test(x.name));
const cE = chk(['E', /Tổng doanh thu/]), cG = chk(['G', /Số đơn/]), cNadj = chk(['N', /sau điều chỉnh/]), cNp = chk(['N', /thuần/]);
ok(cE && cE.ok === true && Math.abs(cE.diff) < 1, 'E: tong doanh thu 3 nhom == tong gia tri B (' + (cE && cE.value) + ' vs ' + B.totalGiaTri + ')');
ok(cG && cG.ok === true, 'G: so don dung tinh thuong == so don B');
ok(cNadj && cNadj.ok === true, 'N: tong sau dieu chinh (tinh lai) == tong gia tri B: diff=' + (cNadj && cNadj.diff));
ok(cNp && cNp.ok === null && typeof cNp.value === 'number', 'N: don thuan chi de tham khao (khong ket luan lech)');
const idxRows = S('Mục lục').rows, flat = JSON.stringify(idxRows);
ok(flat.includes('✅ KHỚP') && !flat.includes('⚠ LỆCH'), 'Muc luc: cac dong doi chieu cheo deu ✅ KHOP');
ok(idxRows.some(r => r[0] === 'N' || String(r[1]) === 'N') && idxRows.filter(r => r.length === 3 && typeof r[2] === 'number').length >= plan.items.length - 1, 'Muc luc liet ke du tung sheet kem so dong');

// --- E: cong thuc hoa hong ---
const E = S('E Hoa hồng').rows, ehead = E.findIndex(r => r[0] === 'Sale'), eData = E.slice(ehead + 1).filter(r => r[0] && r[0] !== 'TỔNG' && r.length > 5);
ok(eData.length >= 3 && eData.every(r => r[10].f && /^D\d+\*F\d+\/100\+E\d+\*G\d+\/100\+I\d+$/.test(r[10].f) && r[11].f && Math.abs(r[11].v) < 0.005), 'E Hoa hong: moi sale co cong thuc tinh lai, chenh lech = 0');
const eTot = E.find(r => r[0] === 'TỔNG');
ok(eTot && /^SUM\(J/.test(eTot[9].f) && Math.abs(eTot[9].v - plan.meta.e.commission) < 0.01, 'E Hoa hong: dong TONG = tong hoa hong he thong (' + plan.meta.e.commission + ')');
const aboveRow = eData.find(r => r[0] === 'anhtrinh1995');
ok(aboveRow && aboveRow[3] > 0 && aboveRow[7] === 500000 && aboveRow[8] === 5000, 'E: don Facebook 500k vao "DT kenh % rieng" voi HH 1% = 5.000; don 16tr vao nhom >= 15tr');
ok(S('E Hoa hồng kênh riêng') && S('E Hoa hồng kênh riêng').rows.some(r => r[1] === 'Facebook' && r[3] === 1) && /ROUND\(E\d+-'E Hoa hồng'!I\d+,2\)/.test(JSON.stringify(S('E Hoa hồng kênh riêng').rows)), 'E: co sheet kenh % rieng + doi chieu ve cot HH kenh % rieng cua sheet chinh');
// --- E: thuong ---
const ET = S('E Thưởng').rows, ED = S('E Thưởng chi tiết').rows;
const etData = ET.filter(r => r.length === 6 && r[0] && r[0] !== 'Sale' && r[0] !== 'TỔNG');
ok(etData.length === 3 && etData.every(r => /^SUMIF\('E Thưởng chi tiết'!\$A:\$A,A\d+,'E Thưởng chi tiết'!\$F:\$F\)$/.test(r[4].f) && r[5].v === 0 && r[1]), 'E Thuong: moi sale co SUMIF ve sheet chi tiet, chenh = 0, co loai sale');
ok(ED.some(r => r[3] === 'CT <A>' && r[4] === 'Đơn <> 1 triệu'), 'E Thuong chi tiet: giai ma HTML (&lt; &gt;) trong cot Chi tiet');
// --- E: Thu nhap tung Sale (js/63) + doi chieu cheo ---
const TI = S('E Thu nhập tổng hợp').rows, TD = S('E Thu nhập chi tiết').rows;
ok(TI[0][0] === 'Sale' && TI[0][7] === 'TỔNG NHẬN' && TI[TI.length - 1][0] === 'TỔNG' && TD[0][2] === 'Nguồn / chương trình', 'E Thu nhap: 2 sheet dung dinh dang nut xuat Thu nhap cua E (tong hop + chi tiet)');
const chkH = plan.checks.find(x => x.name === 'Hoa hồng ở Thu nhập'), chkT = plan.checks.find(x => x.name === 'Thưởng ở Thu nhập');
ok(chkH && chkH.ok === true && chkT && chkT.ok === true, 'Muc luc: hoa hong va thuong trong "E Thu nhap" khop tong hoa hong / tong thuong cua E: ' + JSON.stringify([chkH && chkH.diff, chkT && chkT.diff]));
ok(TI[TI.length - 1][7] === TI[TI.length - 1].slice(2, 7).reduce((a, b) => a + b, 0), 'E Thu nhap: dong TONG = hoa hong + kenh + cua hang + thuong');
ok(plan.meta.e.income.totals.store === 3000 && TD.some(r => r[1] === 'Hoa hồng đơn chia với cửa hàng' && r[0] === 'anhtrinh1995'), 'E Thu nhap: don chia cua hang (L: 300.000 chia them x 1% vi don < 15tr = 3.000) vao dung Sale: store=' + plan.meta.e.income.totals.store);
// --- G ---
const G = S('G Tổng hợp').rows;
ok(G[0][0] === 'BÁO CÁO THƯỞNG SALE — ĐỐI CHIẾU THEO POS' && G.some(r => r[0] === 'Kỳ báo cáo' && /2026-10-01/.test(r[1])) && G.some(r => r[0] === 'Số đơn Pos dùng để tính' && r[1] === 5), 'G Tong hop: tieu de + ky + so don');
const GO = S('G Đơn Pos đối chiếu').rows, gTot = GO[GO.length - 1];
ok(/^TỔNG \(5 đơn\)/.test(gTot[0]) && Math.abs(gTot[5] - B.totalGiaTri) < 1 && Math.abs(gTot[6] - B.totalCod) < 1, 'G Don Pos: dong TONG = tong gia tri / COD cua B');
ok(['G Tổng hợp', 'G Chi tiết thưởng', 'G Đơn Pos đối chiếu'].every(n => S(n).mode === 'g'), 'G: dung dinh dang so cua nut xuat le G (mode g)');
// --- N ---
ok(S('N Tổng hợp theo Sale').rows[0][0] === 'Sale' && S('N Chi tiết thuần từng đơn').rows.length > 5 && S('N Cần kiểm tra tay').rows.length >= 2, 'N: du 4 sheet nhu file xuat le (tong hop / don dieu chinh / can kiem tra / chi tiet thuan)');
// --- L ---
ok(S('L Tổng hợp theo Sale') && S('L Chi tiết đơn') && S('L KT chưa ghi').rows.length === 2 && !S('L Thiếu mã bộ đếm') && !S('L KT ghi lệch tiền'), 'L: tong hop + chi tiet + KT chua ghi (1 don); khong tao sheet rong cho "Thieu ma"/"Lech tien"');
ok(plan.meta.l.daTinh === 300000 && idxRows.some(r => r[1] === 'L' && r[2] === 300000), 'Muc luc: dong L ghi doanh thu chia them 300.000');
// --- B ---
ok(S('B Đối chiếu tổng').rows.some(r => String(r[0]).indexOf('✅ KHỚP') === 0), 'B: sheet "B Doi chieu tong" van ✅ KHOP');

// --- G voi moc ngay (js/62): menbui2002 la Thu viec den 05/10 roi len Offline -> luot thuong ngay 05/10 vao nhom THU VIEC, khong mat tien ---
vm.runInContext("SALE_CHANNEL_PERIODS = { menbui2002: [{ from: '2026-09-01', channel: 'probation' }, { from: '2026-10-06', channel: 'offline' }] };", w);
const pm = vm.runInContext('_reconCollect_(__B, __L, __info)', w);
const gm = pm.items.find(i => i.name === 'G Tổng hợp').rows;
ok(pm.warnings.length === 0 && gm.some(r => r[1] === 'menbui2002' && r[0] === 'Thử việc') && !gm.some(r => r[1] === 'menbui2002' && r[0] === 'Chính thức'), 'G co moc ngay: luot thuong cua menbui2002 ngay 05/10 xep vao nhom Thu viec (theo loai TAI NGAY don), khong loi');
ok(Math.abs(pm.meta.g.total - plan.meta.g.total) < 0.01 && plan.meta.g.total > 0, 'G co moc ngay: chuyen nhom Thu viec/Chinh thuc KHONG doi tong thuong (' + plan.meta.g.total + ' -> ' + pm.meta.g.total + ')');
vm.runInContext('SALE_CHANNEL_PERIODS = {};', w);

// ===== 3) Truong hop loi =====
// L khong tai duoc
w.__Ln = null; let p2 = vm.runInContext('_reconCollect_(__B, __Ln, __info)', w);
ok(p2.items.some(i => i.name === 'L (không có dữ liệu)') && p2.warnings.some(x => /Báo cáo L/.test(x)) && p2.items.filter(i => /^[BEGN] /.test(i.name)).length >= 13, 'L khong tai duoc: van xuat B/E/G/N, co sheet bao + canh bao o Muc luc');
w.__Le = { ok: false, error: 'Không đọc được trang tính cửa hàng' }; p2 = vm.runInContext('_reconCollect_(__B, __Le, __info)', w);
ok(p2.items.some(i => i.name === 'L (lỗi tải)') && p2.warnings.some(x => /không đọc được trang tính/i.test(x)), 'L loi tu may chu: ghi ro ly do');
// 1 bao cao dung loi khong lam hong ca file
vm.runInContext('__bonusThrow = true', w); p2 = vm.runInContext('_reconCollect_(__B, __L, __info)', w); vm.runInContext('__bonusThrow = false', w);
// G cung goi _computeBonusData_ (qua _srGBuildGroups_) nen cung thanh "G LOI" — dung: moi bao cao loi tach rieng, B/L/N khong bi anh huong
ok(p2.items.some(i => i.name === 'E LỖI') && p2.items.some(i => i.name === 'G LỖI') && p2.warnings.some(x => /Báo cáo E.*loi gia lap/.test(x)) && p2.items.filter(i => /^[BLN] /.test(i.name)).length === 13 && !p2.items.some(i => /^[BLN] LỖI/.test(i.name)), 'thuong dung loi: E va G (cung dung _computeBonusData_) thanh sheet LOI rieng, B/L/N van day du (13 sheet)');
ok(JSON.stringify(p2.items[0].rows).includes('⚠ Báo cáo E'), 'E dung loi: canh bao hien o Muc luc');
// thieu B
let thrown = ''; try { w.__Bn = { totalOrders: 0 }; vm.runInContext('_reconCollect_(__Bn, __L, __info)', w); } catch (e) { thrown = e.message; }
ok(/Báo cáo B/.test(thrown), 'chua co du lieu B: bao loi ro, khong xuat file rong');
// khong co don nao
w.__Bz = { orders: [], bySale: [], totalOrders: 0, totalGiaTri: 0, totalCod: 0 }; let pz = null, thrownZ = '';
try { pz = vm.runInContext('_reconCollect_(__Bz, __L, __info)', w); } catch (e) { thrownZ = e.message; }
ok(!thrownZ && pz && pz.items.length > 10, 'khong co don nao: van dung duoc file (khong loi): ' + thrownZ);
// B co posAdjust (chot thang): so sanh voi so TRUOC tru
const Badj = J(B); Badj.posAdjust = { applied: true, prevMonth: '2026-09', closedAt: '2026-09-30', totalDeduction: 150000 }; Badj.totalGiaTriGoc = B.totalGiaTri; Badj.totalGiaTri = B.totalGiaTri - 150000;
w.__Ba = Badj; const pa = vm.runInContext('_reconCollect_(__Ba, __L, __info)', w);
ok(pa.checks.filter(c => c.ok !== null).every(c => c.ok) && JSON.stringify(pa.items[0].rows).includes('TRƯỚC trừ hoàn/hủy tháng 2026-09'), 'co posAdjust (chot thang): doi chieu cheo so voi so TRUOC tru, van ✅ KHOP');

// ===== 4) Ghi file .xlsx THAT, doc lai, tinh lai cong thuc =====
if (XLSX) {
  w.__plan = plan;
  const wb = vm.runInContext('_reconBuildWorkbook_(__plan)', w);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), rb = XLSX.read(buf, { type: 'buffer', cellNF: true });
  ok(rb.SheetNames.join('|') === names.join('|'), 'file .xlsx that: du ' + names.length + ' sheet, dung thu tu');
  // moi cong thuc tro toi sheet CO THAT
  const refs = new Set(); let nF = 0;
  rb.SheetNames.forEach(sn => { const ws = rb.Sheets[sn]; Object.keys(ws).forEach(k => { if (k[0] !== '!' && ws[k].f) { nF++; (ws[k].f.match(/'([^']+)'!/g) || []).forEach(m => refs.add(m.slice(1, -2))); } }); });
  ok(nF > 30 && [...refs].every(r => rb.SheetNames.includes(r)), 'file .xlsx that: ' + nF + ' cong thuc, moi tham chieu sheet deu ton tai (' + [...refs].join(', ') + ')');
  const m = rb.Sheets['Mục lục']; ok(m && m['A1'].v.startsWith('EXCEL ĐỐI SOÁT'), 'file .xlsx that: Muc luc o sheet dau');
  const ehd = rb.Sheets['E Hoa hồng']; const aNum = Object.keys(ehd).filter(k => k[0] !== '!' && ehd[k].t === 'n' && ehd[k].z);
  ok(aNum.length > 10, 'E Hoa hong: o so co dinh dang so (#,##0)');
  // LibreOffice tinh lai: moi cot "Chenh lech" phai = 0
  let lo = null; try { require('child_process').execSync('which soffice', { stdio: 'ignore' }); lo = true; } catch (e) {}
  if (lo) {
    const os = require('os'), cp = require('child_process'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-')), f = path.join(dir, 'in.xlsx'); fs.writeFileSync(f, buf);
    try {
      cp.execSync('soffice --headless --calc --convert-to ods --outdir "' + dir + '" "' + f + '"', { stdio: 'ignore', timeout: 120000 });
      cp.execSync('soffice --headless --calc --convert-to xlsx:"Calc MS Excel 2007 XML" --outdir "' + path.join(dir, 'out') + '" "' + path.join(dir, 'in.ods') + '"', { stdio: 'ignore', timeout: 120000 });
      const rc = XLSX.read(fs.readFileSync(path.join(dir, 'out', 'in.xlsx')), { type: 'buffer' });
      const diffCols = { 'E Hoa hồng': 'L', 'E Thưởng': 'F', 'B Đối chiếu tổng': 'D' };
      let bad = [], seen = 0, unassignedSeen = 0;
      Object.keys(diffCols).forEach(sn => { const ws = rc.Sheets[sn]; Object.keys(ws).forEach(k => { const mm = /^([A-Z]+)(\d+)$/.exec(k); if (mm && mm[1] === diffCols[sn] && +mm[2] > 1 && typeof ws[k].v === 'number') {
        // dong "(chua gan sale)" cua B Doi chieu tong CHU Y lech = -tong don khong co sale (bang web an dong nay; B da ghi chu) → kiem rieng
        if (sn === 'B Đối chiếu tổng' && ws['A' + mm[2]] && ws['A' + mm[2]].v === '(chưa gán sale)') { unassignedSeen++; if (Math.abs(ws[k].v + 300000) > 0.01) bad.push(sn + '!' + k + ' (chua gan sale) phai = -300000, thuc te ' + ws[k].v); return; }
        seen++; if (Math.abs(ws[k].v) > 0.01) bad.push(sn + '!' + k + '=' + ws[k].v); } }); });
      ok(unassignedSeen === 1, 'LibreOffice: dong "(chua gan sale)" cua B Doi chieu tong lech dung = -300.000 (don khong co sale, bang web an dong nay)');
      ok(seen >= 8 && bad.length === 0, 'LibreOffice TINH LAI cong thuc: ' + seen + ' o "Chenh lech" (E Hoa hong / E Thuong / B Doi chieu tong) deu = 0' + (bad.length ? ' LECH: ' + bad.join(',') : ''));
      const idx = rc.Sheets['Mục lục']; const diffs = Object.keys(idx).filter(k => /^D\d+$/.test(k) && typeof idx[k].v === 'number');
      const lab = k => String((idx['A' + k.slice(1)] || {}).v || ''), nS = plan.meta.e.nSales;
      // 4 dong so voi B: chenh < 1d. 2 dong "trong E Thu nhap" (js/63 lam tron dong tung khoan tung Sale): chenh <= 1d + 1d/Sale (dung dung sai ghi o Muc luc)
      const dB = diffs.filter(k => !/Thu nhập/.test(lab(k))), dI = diffs.filter(k => /Thu nhập/.test(lab(k)));
      ok(dB.length >= 3 && dB.every(k => Math.abs(idx[k].v) < 1) && dI.length === 2 && dI.every(k => Math.abs(idx[k].v) <= 1 + nS), 'LibreOffice tinh lai: cot "Chenh" o Muc luc: ' + dB.length + ' dong so voi B < 1d; 2 dong Thu nhap trong dung sai lam tron (' + dI.map(k => idx[k].v).join(', ') + ' <= ' + (1 + nS) + 'd)');
    } catch (e) { console.log('(bo qua LibreOffice: ' + e.message.split('\n')[0] + ')'); }
  } else console.log('(bo qua tinh lai LibreOffice: khong co soffice)');
} else console.log('(bo qua kiem tra file .xlsx that: chua cai thu vien xlsx)');

console.log(fails ? '\nFAILED ' + fails : '\nALL RECON-EXPORT TESTS PASSED'); process.exit(fails ? 1 : 0);
