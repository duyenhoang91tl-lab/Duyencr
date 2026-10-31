// Test Bao cao L — doi chieu file ke toan "THEO DOI DON CHIA SALE" (Duyen yeu cau 2026-10-31): don nao KT chua ghi / thieu ma bo dem.
// Chay HAM THAT trong gas_v13.js (buildStoreCaseReport_, _loadAcctCodeSet_, ...) voi sheet/don GIA (khong co du lieu ca nhan that).
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function line(prefix) { const i = src.indexOf(prefix); return src.slice(i, src.indexOf('\n', i)); }
const code = [line("var COUNTER_CODE_INNER_ ="), line("var COUNTER_CODE_RE_SRC_ ="), line("var STORE_M_CODE_RE_ ="), line("var ACCT_SPLIT_SS_ID_ ="),
  ...['_stripVN_', '_normCounterCode_', '_counterCodeNoYear_', '_counterCodeHasYear_', '_extractCounterCodes_', '_storeCodeTokens_', '_storeCodesFromNote_', '_loadAcctCodeSet_', '_storeAcctClassify_', '_storeCaseDayList_', '_storeCaseDaysToYmd_', '_storeCaseVisitDates_', '_storeCaseArrivalDates_', 'buildStoreCaseReport_'].map(fn)].join('\n');
// ---- du lieu gia ----
const ACCT_TABS = {   // file ke toan: nhieu tab; o gop -> dong thu 2 cua cap de trong
  'tháng 10': [['', '', ''], ['', 'Kênh bán', 'Sale bán', 'Giá trị cọc', 'Tổng giá trị', 'SDT', 'Mã bộ đếm', ''],
    ['', 'Quầy Hào Nam', 'Kim Thuy', '', 21700000, '979687852', 'M44756', ''], ['', 'Fb', 'ninhnga99', '', 9300000, '979687852', '', ''],
    ['', 'Quầy Hào Nam', 'Nguyễn Thuỳ Trang', '', 875000, '962688485', 'M46906', ''], ['', 'Page', 'x', '', 1, '', '[merged] 17T10/2026', ''], ['', 'y', 'z', '', 2, '', '', 'dthu 1.5']],
  'tháng 11': [['', 'Kênh bán', 'Sale bán', '', 'Tổng', 'SDT', 'Mã bộ đếm'], ['', 'Quầy Hào Nam', 'Tú Anh', '', 5, '', 'M45000']],
  'Ghi chú': [['không có cột mã', 'abc'], ['M77777', 'x']]
};
const CASE_ROWS = [   // trang tinh cua hang (cot R = maDon)
  { row: 2, thang: '10', ngayHen: '10', saleRaw: 'ninhnga99', phone: '979687852', tenKh: 'KH A', maDon: 'M44756', capNhat: '', tinhTrang: '' },
  { row: 3, thang: '10', ngayHen: '10', saleRaw: 'huyenmaii1990', phone: '945462365', tenKh: 'KH B', maDon: 'M99999', capNhat: '', tinhTrang: '' },
  { row: 4, thang: '10', ngayHen: '10', saleRaw: 'yenNTH2004', phone: '862473774', tenKh: 'KH C', maDon: '', capNhat: '', tinhTrang: '' },
  { row: 5, thang: '10', ngayHen: '10', saleRaw: 'phuongthao2000', phone: '984386507', tenKh: 'KH D', maDon: '', capNhat: '', tinhTrang: '' },
  { row: 6, thang: '10', ngayHen: '11', saleRaw: 'ninhnga99', phone: '900000006', tenKh: 'KH E', maDon: 'M45000', capNhat: '', tinhTrang: '' },
  { row: 7, thang: '10', ngayHen: '10', saleRaw: 'dungnguyen1995', phone: '900000007', tenKh: 'KH F', maDon: '17T10/2025', capNhat: '', tinhTrang: '' },
  { row: 8, thang: '10', ngayHen: '10', saleRaw: 'dungnguyen1995', phone: '900000008', tenKh: 'KH G', maDon: '17T10', capNhat: '', tinhTrang: '' },
  { row: 9, thang: '10', ngayHen: '10', saleRaw: 'Kim Thuy', phone: '900000009', tenKh: 'KH H', maDon: 'M12345', capNhat: '', tinhTrang: '' },   // the Pos da co Sale -> trung nhung van doi chieu
  { row: 10, thang: '10', ngayHen: '10', saleRaw: 'ninhnga99', phone: '900000010', tenKh: 'KH I', maDon: 'M55555', capNhat: '', tinhTrang: '' },   // don hoan -> khong doi chieu
  { row: 11, thang: '10', ngayHen: '10', saleRaw: 'ninhnga99', phone: '979687852', tenKh: 'KH A (dong 2)', maDon: 'M44756', capNhat: '', tinhTrang: '' }];  // cung SDT+ngay lap lai
const POS = [
  { posRow: 101, soDienThoai: '0979687852', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH A', sanPham: 'SP', trangThai: 'Thành công', theSale: 'Kim Thuy', ghiChu: '', giaTriSauGiam: 31000000 },
  { posRow: 102, soDienThoai: '0945462365', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH B', sanPham: 'SP', trangThai: 'Thành công', theSale: '', ghiChu: '', giaTriSauGiam: 3000000 },
  { posRow: 103, soDienThoai: '0862473774', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH C', sanPham: 'SP', trangThai: 'Thành công', theSale: 'Tú Anh', ghiChu: 'chia 30/70 M46906', giaTriSauGiam: 1000000 },
  { posRow: 104, soDienThoai: '0984386507', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH D', sanPham: 'SP', trangThai: 'Thành công', theSale: 'Tú Anh', ghiChu: '30/70', giaTriSauGiam: 2000000 },
  { posRow: 105, soDienThoai: '0900000006', ngayTaoDon: '11/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH E', sanPham: 'SP', trangThai: 'Thành công', theSale: 'Tú Anh', ghiChu: '', giaTriSauGiam: 500000 },
  { posRow: 106, soDienThoai: '0900000007', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH F', sanPham: 'SP', trangThai: 'Thành công', theSale: 'Tú Anh', ghiChu: '', giaTriSauGiam: 600000 },
  { posRow: 107, soDienThoai: '0900000008', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH G', sanPham: 'SP', trangThai: 'Thành công', theSale: 'Tú Anh', ghiChu: '', giaTriSauGiam: 700000 },
  { posRow: 108, soDienThoai: '0900000009', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH H', sanPham: 'SP', trangThai: 'Thành công', theSale: 'Kim Thuy', ghiChu: '', giaTriSauGiam: 800000 },
  { posRow: 109, soDienThoai: '0900000010', ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'KH I', sanPham: 'SP', trangThai: 'Hoàn', theSale: '', ghiChu: '', giaTriSauGiam: 900000 }];
const FIXED = new Date(2026, 9, 31);
class FDate extends Date { constructor(...a) { if (a.length === 0) super(FIXED.getTime()); else super(...a); } }
const pad = n => String(n).padStart(2, '0');
function makeCtx(opts) {
  opts = opts || {};
  const ctx = { Date: FDate, Math, JSON, String, Number, Object, Array, RegExp, parseInt, parseFloat, isNaN, Error,
    _vnYmd_: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    parseVNDate_: s => { const m = /^(\d+)\/(\d+)\/(\d+)/.exec(s || ''); return m ? new FDate(+m[3], +m[2] - 1, +m[1]) : null; },
    _dateStrToVnYmd_: s => String(s || ''), normPhone_: p => { const d = String(p || '').replace(/\D/g, ''); return d ? (d[0] === '0' ? d : '0' + d) : ''; },
    _storeCaseShare_: () => 0.3, _storeCaseReadSheet_: () => ({ sheetId: 'S', sheetName: 'T', rows: CASE_ROWS.map(r => Object.assign({}, r)) }),
    readDonChiTiet_: () => POS.map(r => Object.assign({}, r)), _donSaleNamesFromThe_: t => String(t || '').split(',').map(x => x.trim()).filter(Boolean),
    _donHasExcludedStatus_: s => /hoàn/i.test(s || ''), _quaySaleRatio_: () => 0.3, _foldSaleKey_: s => String(s || '').toLowerCase().replace(/\s+/g, ''),
    _storeCaseBuildCtx_: () => ({ resolve: raw => ({ raw, name: String(raw).trim(), how: 'x' }), same: (a, b) => String(a).toLowerCase().replace(/\s+/g, '') === String(b).toLowerCase().replace(/\s+/g, '') }),
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    SpreadsheetApp: { openById: () => { if (opts.denied) throw new Error('Không có quyền'); return { getSheets: () => Object.keys(ACCT_TABS).map(n => ({ getName: () => n, getDataRange: () => ({ getValues: () => ACCT_TABS[n] }) })) }; } } };
  vm.createContext(ctx); vm.runInContext(code, ctx); return ctx;
}
// ---- tach ma ----
let c = makeCtx();
ok(c._storeCodeTokens_('M44756, [merged] 17T10/2026;\nm45000  x').join('|') === 'M44756|17T10/2026|M45000|X'.replace('|X', ''), 'tach ma tu cot R: ngan cach , ; xuong dong, bo [merged], viet hoa');
ok(c._storeCodeTokens_('').length === 0 && c._storeCodeTokens_(null).length === 0 && c._storeCodeTokens_('ab').length === 0 && c._storeCodeTokens_('abc').length === 0, 'rong / qua ngan / khong co chu so -> khong coi la ma');
ok(c._storeCodesFromNote_('chia 30/70 M46906 va 17T10/2026').join('|') === '17T10/2026|M46906', 'ma trong ghi chu Pos: nhan CA dang 17T10/2026 lan dang quay M46906');
ok(c._storeCodesFromNote_('Mua M3 hoac AM46906 hay XM44756Y').length === 0, 'khong nhan nham: M3 (qua ngan), AM46906 / XM44756Y (dinh vao chu khac)');
// ---- doc file ke toan nhieu tab ----
const a = c._loadAcctCodeSet_();
ok(a.err === '' && a.tabs.join('|') === 'tháng 10|tháng 11', 'doc MOI tab co cot "Mã bộ đếm" (bo tab khong co cot nay)');
ok(a.codes['M44756'] && a.codes['M46906'] && a.codes['17T10/2026'] && a.codes['M45000'] && !a.codes['M77777'], 'tap ma: co ma o ca 2 tab; "[merged]" duoc bo; ma o tab khong co cot ma KHONG tinh');
ok(a.codes['M45000'].sheet === 'tháng 11' && a.codes['M44756'].line === 3, 'luu tab + so dong de ke toan tim');
ok(makeCtx({ denied: true })._loadAcctCodeSet_().err.indexOf('Không đọc được file kế toán') === 0, 'khong mo duoc file ke toan -> err ro rang, khong nem loi');
// ---- phan loai ----
const cl = x => c._storeAcctClassify_(x, a).status;
ok(cl(['M44756']) === 'da-ghi' && cl(['M99999']) === 'chua-ghi' && cl([]) === 'thieu-ma', 'da-ghi / chua-ghi / thieu-ma');
ok(cl(['17T10']) === 'da-ghi' && cl(['17T10/2026']) === 'da-ghi' && cl(['17T10/2025']) === 'chua-ghi', 'ma khong nam khop ma co nam; ma CO nam khac nam thi KHONG khop');
ok(cl(['M99999', 'M46906']) === 'da-ghi', 'don co nhieu ma: chi can 1 ma co trong file ke toan');
ok(c._storeAcctClassify_(['M1'], { err: 'x' }).status === 'khong-ro', 'khong doc duoc file ke toan -> khong ro (khong bao nham la chua ghi)');
// ---- bao cao L dau-cuoi ----
const rep = c.buildStoreCaseReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
ok(rep.ok && rep.acctCheck && rep.acctCheck.ok && rep.acctCheck.tabs.length === 2, 'bao cao L tra acctCheck (ok, 2 tab)');
const ac = rep.acctCheck, S = ac.summary, miss = ac.missing;
const by = n => miss.find(x => x.posRow === n);
ok(S.daGhi === 4 && S.chuaGhi === 3 && S.thieuMa === 1, 'dem theo DON POS duy nhat: da ghi 4 (101,103,105,107) / chua ghi 3 (102,106,108) / thieu ma 1 (104) — thuc te: ' + JSON.stringify(S));
ok(by(102) && by(102).status === 'chua-ghi' && by(102).codes.join() === 'M99999', 'don 102 (cot R = M99999, ke toan khong co) -> KT CHUA GHI');
ok(!by(101), 'don 101 (M44756, ke toan co) -> khong nam trong danh sach thieu; 2 dong trang tinh cung SDT+ngay khong tinh trung');
ok(!by(103), 'don 103: cot R trong, ma M46906 lay tu GHI CHU Pos -> ke toan co -> da ghi');
ok(by(104) && by(104).status === 'thieu-ma' && by(104).codes.length === 0, 'don 104: khong cot R, ghi chu khong co ma -> THIEU MA (khong doi chieu duoc)');
const o105 = rep.rows.find(r => r.row === 6).orders[0];
ok(!by(105) && o105 && o105.posRow === 105 && o105.acct.status === 'da-ghi' && o105.acct.sheet === 'tháng 11', 'don 105: ma M45000 nam o tab "tháng 11" -> da ghi (tra ve ten tab)');
ok(by(106) && by(106).status === 'chua-ghi', 'don 106: 17T10/2025 khac nam voi ke toan 17T10/2026 -> chua ghi');
ok(!by(107), 'don 107: 17T10 (khong nam) -> khop 17T10/2026 -> da ghi');
ok(by(108) && by(108).status === 'chua-ghi' && by(108).loaiXuLy === 'trung', 'don 108: the Pos da co Sale (trung) van doi chieu, ghi loai xu ly de loc');
const o109 = rep.rows.find(r => r.row === 10).orders[0];
ok(!by(109) && o109.excluded === true && o109.acct === undefined, 'don hoan (109) khong doi chieu (khong co acct)');
ok(by(102).chiaSale === 900000 && by(102).phanQuay === 2100000 && by(102).giaTri === 3000000, 'chia san de ke toan ghi cap dong: sale 30% = 900.000, quay 70% = 2.100.000');
ok(S.chuaGhiGiaTri === 3000000 + 600000 + 800000 && S.chuaGhiChia === 900000 + 180000 + 240000, 'tong don CHUA GHI (khong tinh thieu-ma): gia tri 4.400.000, phan sale 30% = 1.320.000');
ok(miss[0].status === 'chua-ghi' && miss[miss.length - 1].status === 'thieu-ma', 'sap xep: chua-ghi len truoc, thieu-ma xuong cuoi');
ok(by(102).sales.join() === 'huyenmaii1990' && by(102).storeRows.join() === '3', 'danh sach: sale can ghi + dong trang tinh cua hang de truy lai');
const rowB = rep.rows.find(r => r.row === 3);
ok(rowB.flags.some(f => f.indexOf('KT chưa ghi: M99999') === 0) && rowB.orders[0].acct.status === 'chua-ghi', 'dong bang chi tiet L co co "KT chưa ghi"');
ok(rep.rows.find(r => r.row === 5).flags.some(f => f.indexOf('Thiếu mã bộ đếm') === 0), 'dong thieu ma co canh bao "điền cột R"');
ok(rep.rows.find(r => r.row === 2).flags.every(f => f.indexOf('KT') !== 0), 'don da ghi khong co canh bao');
ok(rep.rows.every(r => r.maDon !== undefined), 'moi dong tra ve cot R (maDon)');
// ke toan loi quyen -> khong bao nham
const rep2 = makeCtx({ denied: true }).buildStoreCaseReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
ok(rep2.ok && rep2.acctCheck.ok === false && rep2.acctCheck.missing.length === 0 && rep2.acctCheck.summary.chuaGhi === 0, 'khong doc duoc file ke toan: bao loi trong acctCheck, KHONG liet ke don nao la "chua ghi"');
process.exit(bad ? 1 : 0);
