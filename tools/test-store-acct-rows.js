// Test Bao cao L (doi chieu ke toan) — DONG NOI TIEP, cot R la khoa chinh thuc, ma chua ghep duoc don Pos (Duyen chot 2026-10-31).
// Chay HAM THAT trong gas_v13.js voi du lieu GIA mo phong cau truc that cua trang tinh "Khach Sale qua cua hang".
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function line(prefix) { const i = src.indexOf(prefix); return src.slice(i, src.indexOf('\n', i)); }
const FNS = ['_stripVN_', '_normCounterCode_', '_counterCodeNoYear_', '_counterCodeHasYear_', '_extractCounterCodes_', '_storeCodeTokens_', '_storeCaseMergeContinuation_', '_normMoney_', '_storeCodesFromNote_', '_loadAcctCodeSet_', '_storeAcctClassify_', '_storeAcctMoney_', '_storeCaseYmdAdd_', '_storeCaseDayList_', '_storeCaseDaysToYmd_', '_storeCaseVisitDates_', '_storeCaseArrivalDates_', 'buildStoreCaseReport_'];
const code = [line("var COUNTER_CODE_INNER_ ="), line("var COUNTER_CODE_RE_SRC_ ="), line("var STORE_M_CODE_RE_ ="), line("var ACCT_SPLIT_SS_ID_ ="), ...FNS.map(fn)].join('\n');
const ACCT = [['', 'Kênh bán', 'Sale bán', '', 'Tổng', 'SDT', 'Mã bộ đếm'], ['', 'Quầy', 'a', '', 1, '912468474', 'M45933'], ['', 'Fb', 'b', '', 1, '912468474', ''], ['', 'Quầy', 'c', '', 1, '979687852', 'M44756']];
const pad = n => String(n).padStart(2, '0'), FIXED = new Date(2026, 9, 31);
class FDate extends Date { constructor(...a) { if (a.length === 0) super(FIXED.getTime()); else super(...a); } }
const R = (o) => Object.assign({ stt: '', thang: '10', ngayHen: '', kenh: '', saleRaw: '', tenKh: '', phone: '', thongTin: '', spOrder: '', capNhat: '', tinhTrang: '', ngayDen: '', spMua: '', doanhThuSheet: '', nvCh: '', maDon: '' }, o);
const pos = (posRow, phone, ngay, extra) => Object.assign({ posRow, soDienThoai: phone, ngayTaoDon: ngay, nguonDon: 'Quầy Hào Nam', khachHang: 'K' + posRow, sanPham: 'SP', trangThai: 'Thành công', theSale: 'Lê Trà My', ghiChu: '', giaTriSauGiam: 1000000 }, extra || {});
function run(rows, posRows, acctTab) {
  const ctx = { Date: FDate, Math, JSON, String, Number, Object, Array, RegExp, parseInt, parseFloat, isNaN, Error,
    _vnYmd_: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    parseVNDate_: s => { const m = /^(\d+)\/(\d+)\/(\d+)/.exec(s || ''); return m ? new FDate(+m[3], +m[2] - 1, +m[1]) : null; },
    _dateStrToVnYmd_: s => String(s || ''), normPhone_: p => { const d = String(p || '').replace(/\D/g, ''); return d ? (d[0] === '0' ? d : '0' + d) : ''; },
    _storeCaseShare_: () => 0.3, _storeCaseReadSheet_: () => ({ sheetId: 'S', sheetName: 'T', maDonCol: 'R «»', rows: rows.map(r => Object.assign({}, r)) }),
    readDonChiTiet_: () => posRows.map(r => Object.assign({}, r)), _donSaleNamesFromThe_: t => String(t || '').split(',').map(x => x.trim()).filter(Boolean),
    _donHasExcludedStatus_: s => /hoàn/i.test(s || ''), _quaySaleRatio_: () => 0.3, _foldSaleKey_: s => String(s || '').toLowerCase().replace(/\s+/g, ''),
    _storeCaseBuildCtx_: () => ({ resolve: raw => ({ raw, name: String(raw).trim(), how: 'x' }), same: (a, b) => String(a).toLowerCase().replace(/\s+/g, '') === String(b).toLowerCase().replace(/\s+/g, '') }),
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    SpreadsheetApp: { openById: () => ({ getSheets: () => [{ getName: () => 'tháng 10', getDataRange: () => ({ getValues: () => (acctTab || ACCT) }) }] }) } };
  vm.createContext(ctx); vm.runInContext(code, ctx); return ctx;
}
// ---- gop dong noi tiep (ham thuan) ----
let c = run([], []);
const mg = rows => c._storeCaseMergeContinuation_(rows);
const P = R({ row: 2, stt: '41', saleRaw: 'ninhnga99', phone: '904940392', tenKh: 'A', ngayHen: '19' });
const K = R({ row: 3, ngayHen: '19-20', ngayDen: '20/10', doanhThuSheet: '1750000', nvCh: 'kimthuy', maDon: 'M46228', spMua: 'vòng' });
let m = mg([P, K]);
ok(m.rows.length === 1 && m.merged === 1 && m.rows[0].maDon === 'M46228' && m.rows[0].ngayDen === '20/10' && m.rows[0].nvCh === 'kimthuy' && m.rows[0].merged.join() === '3', 'dong noi tiep (khong STT/SDT/Sale/ten, co ma + ngay den + doanh thu) duoc GOP vao khach phia tren');
m = mg([R({ row: 2, stt: '1', phone: '1', saleRaw: 'x', maDon: 'M111' }), R({ row: 3, maDon: 'M222' }), R({ row: 4, maDon: 'M111, M333' })]);
ok(m.rows.length === 1 && m.rows[0].maDon === 'M111, M222, M333', 'nhieu dong noi tiep: ma gop lai, khong lap');
m = mg([R({ row: 2, stt: '1', phone: '9', maDon: 'M1' }), R({ row: 3, ngayDen: '5/10', maDon: '' })]);
ok(m.rows.length === 1 && m.rows[0].ngayDen === '5/10', 'dong nối tiếp chi co ngay den cung duoc gop');
m = mg([R({ row: 2, stt: '1', phone: '9', ngayDen: '1/10', doanhThuSheet: '5' }), R({ row: 3, ngayDen: '9/10', doanhThuSheet: '7' })]);
ok(m.rows[0].ngayDen === '1/10' && m.rows[0].doanhThuSheet === '5', 'o cua dong cha da co thi GIU, khong bi dong con ghi de');
m = mg([R({ row: 2, stt: '1', phone: '9' }), R({ row: 3, phone: '900000010', saleRaw: 'x', maDon: 'M5' })]);
ok(m.rows.length === 2 && m.merged === 0, 'dong khong STT nhung co SDT/Sale rieng van la khach RIENG');
m = mg([R({ row: 2, stt: '1', phone: '9' }), R({ row: 3, ngayHen: '19' })]);
ok(m.rows.length === 2, 'dong mau chi co ngay hen (khong co ma/ngay den/doanh thu) KHONG bi gop');
m = mg([R({ row: 2, maDon: 'M9', ngayDen: '5/10' }), R({ row: 3, stt: '1', phone: '9' })]);
ok(m.rows.length === 2, 'dong nối tiếp o DAU bang (khong co dong cha) giu nguyen');
m = mg([R({ row: 2, stt: '7', phone: '9' }), R({ row: 3, stt: '8', maDon: 'M5' })]);
ok(m.rows.length === 2, 'dong co STT rieng khong phai dong noi tiep');
// ---- bao cao L dau-cuoi ----
const rows = [
  P, K,                                                                                                                            // M46228: nối tiếp, KHONG co trong file KT
  R({ row: 4, stt: '42', saleRaw: 'ninhnga99', phone: '912468474', tenKh: 'B', ngayHen: '18' }), R({ row: 5, ngayDen: '18/10', maDon: 'M45933' }),   // M45933 co trong file KT
  R({ row: 6, stt: '43', saleRaw: 'huyenmaii1990', phone: '900000006', tenKh: 'C', ngayHen: '15' }), R({ row: 7, maDon: 'M60001' }), R({ row: 8, maDon: 'M60002' }),
  R({ row: 9, stt: '44', saleRaw: 'phuongthao2000', phone: '', tenKh: 'D', ngayHen: '10', maDon: 'M70001', doanhThuSheet: '2000000' }),             // khong SDT -> khong ghep duoc don Pos
  R({ row: 10, stt: '45', saleRaw: 'yenNTH2004', phone: '900000010', tenKh: 'E', ngayHen: '12', maDon: 'M44756, M99998' }),                             // 1 co / 1 thieu
  R({ row: 11, stt: '46', saleRaw: 'yenNTH2004', phone: '900000011', tenKh: 'F', ngayHen: '12' }),                                                // R trong, ma o ghi chu Pos: M44756 + M99997
  R({ row: 12, stt: '47', saleRaw: 'yenNTH2004', phone: '900000012', tenKh: 'G', ngayHen: '12', maDon: 'M99999' }),                               // R = thieu, ghi chu Pos co ma co
  R({ row: 13, stt: '48', saleRaw: 'yenNTH2004', phone: '900000013', tenKh: 'H', ngayHen: '12', maDon: 'M88888' })];                              // chi co don hoan
const POS = [pos(201, '0904940392', '20/10/2026'), pos(202, '0912468474', '18/10/2026'), pos(203, '0900000006', '15/10/2026'),
  pos(210, '0900000010', '12/10/2026'), pos(211, '0900000011', '12/10/2026', { ghiChu: 'M44756 M99997' }), pos(212, '0900000012', '12/10/2026', { ghiChu: 'M44756' }),
  pos(213, '0900000013', '12/10/2026', { trangThai: 'Hoàn' })];
c = run(rows, POS);
const rep = c.buildStoreCaseReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }), ac = rep.acctCheck, by = n => ac.missing.find(x => x.posRow === n), rowOf = n => rep.rows.find(r => r.row === n);
ok(rep.ok && ac.ok, 'bao cao L chay duoc');
ok(!rowOf(3) && !rowOf(5) && !rowOf(7) && !rowOf(8) && rowOf(2) && rowOf(4) && rep.dataQuality.tongDong === 8, 'dong noi tiep khong con la dong rieng (12 dong -> 8 khach, khong dem thieu SDT cho dong con)');
ok(rowOf(2).flags.some(f => f.indexOf('Đã gộp dòng nối tiếp: dòng 3') === 0), 'dong cha co canh bao "Đã gộp dòng nối tiếp"');
ok(rowOf(2).ngayDen === '20/10' && rowOf(2).dateSrc === 'den' && rowOf(2).orders.length === 1 && rowOf(2).orders[0].posRow === 201 && rowOf(2).orders[0].lech === 0, 'ngay DEN lay tu dong con (20/10) -> khop DUNG ngay don Pos (khong con lech)');
ok(by(201) && by(201).status === 'chua-ghi' && by(201).codes.join() === 'M46228' && by(201).sales.join() === 'ninhnga99', 'M46228 (nối tiếp, khong co o file KT) -> KT CHUA GHI, gan voi don Pos 201');
ok(!by(202) && rowOf(4).orders[0].acct.status === 'da-ghi', 'M45933 (nối tiếp, co o file KT) -> da ghi');
ok(by(203) && by(203).codes.join() === 'M60001,M60002', '2 dong nối tiếp: gop 2 ma, ca 2 thieu -> chua ghi liet ke dung 2 ma');
const only = ac.missing.find(x => x.posRow === null && x.codes[0] === 'M70001');
ok(only && only.status === 'chua-ghi' && only.giaTri === 2000000 && only.chiaSale === 600000 && only.phanQuay === 1400000 && only.sales.join() === 'phuongthao2000' && only.loaiXuLy === 'chua-ghep-don' && only.storeRows.join() === '9', 'ma cot R khong gan duoc don Pos (khong SDT): van liet ke, gia tri = cot Doanh thu cua trang tinh, chia 30/70 san');
ok(rowOf(9).flags.some(f => f.indexOf('KT chưa ghi: M70001 (chưa ghép được đơn Pos)') === 0), 'dong do co canh bao tuong ung');
ok(by(210) && by(210).status === 'chua-ghi' && by(210).codes.join() === 'M99998', 'cot R co 2 ma (1 co / 1 thieu): R la chinh thuc -> CHUA GHI, chi liet ke ma THIEU M99998');
ok(!by(211) && rowOf(11).orders[0].acct.status === 'da-ghi' && rowOf(11).orders[0].codesAll.join() === 'M44756,M99997', 'R trong -> dung ma o ghi chu Pos; khong strict: chi can 1 ma khop -> da ghi');
ok(by(212) && by(212).codes.join() === 'M99999', 'R co ma thieu (M99999) du ghi chu Pos co ma khop -> CHUA GHI (R la khoa chinh thuc)');
ok(!by(213) && !ac.missing.some(x => x.codes.indexOf('M88888') !== -1), 'dong CHI co don hoan: ma R khong bi liet ke (khong co doanh thu de ghi)');
const S = ac.summary;
ok(S.chuaGhi === 5 && S.daGhi === 2 && S.thieuMa === 0 && S.chuaGhiGiaTri === 6000000 && S.chuaGhiChia === 1800000, 'tong hop: chua ghi 5 (don 201, 203, 210, 212 + ma M70001), da ghi 2 (202, 211), tien 6.000.000 / sale 1.800.000 — thuc te ' + JSON.stringify(S));
// dong khong con trung 2 lan neu ca ma o R lan chua don
ok(ac.missing.filter(x => x.codes.indexOf('M46228') !== -1).length === 1, 'M46228 chi xuat hien 1 lan (khong lap giua don Pos va dong theo ma)');
// ---- DU PHONG khop theo SDT file ke toan khi don chua co ma (Duyen chot 2026-10-31) ----
const rows2 = [R({ row: 2, stt: '1', saleRaw: 'yenNTH2004', phone: '912468474', tenKh: 'X', ngayHen: '25' }),    // SDT co trong file KT, chua co ma -> co-sdt
  R({ row: 3, stt: '2', saleRaw: 'yenNTH2004', phone: '900000015', tenKh: 'Y', ngayHen: '25' }),                 // SDT khong co trong file KT, chua ma -> thieu-ma
  R({ row: 4, stt: '3', saleRaw: 'yenNTH2004', phone: '979687852', tenKh: 'Z', ngayHen: '25', maDon: 'M77777' })]; // co ma (thieu) -> chua-ghi du SDT co trong file KT
const POS2 = [pos(301, '0912468474', '25/10/2026'), pos(302, '0900000015', '25/10/2026'), pos(303, '0979687852', '25/10/2026')];
c = run(rows2, POS2);
const r2 = c.buildStoreCaseReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }), a2 = r2.acctCheck;
const ord = n => r2.rows.find(r => r.row === n).orders[0];
ok(ord(2).acct.status === 'co-sdt' && ord(2).acct.sheet === 'tháng 10' && ord(2).acct.line === 2, 'don chua co ma + SDT khach co trong file KT -> "co-sdt" (kem tab + dong)');
ok(ord(3).acct.status === 'thieu-ma', 'don chua co ma + SDT khong co trong file KT -> van "thieu-ma"');
ok(ord(4).acct.status === 'chua-ghi' && ord(4).acct.missingCodes.join() === 'M77777', 'don CO ma (thieu): SDT co trong file KT cung KHONG cuu duoc -> van chua ghi');
ok(a2.summary.coSdt === 1 && a2.summary.thieuMa === 1 && a2.summary.chuaGhi === 1 && a2.summary.daGhi === 0, 'tong hop co dem rieng coSdt: ' + JSON.stringify(a2.summary));
ok(!a2.missing.some(x => x.posRow === 301) && a2.missing.some(x => x.posRow === 302 && x.status === 'thieu-ma'), '"co-sdt" KHONG nam trong danh sach thieu / chua ghi; thieu-ma van nam');
ok(r2.rows.find(r => r.row === 2).flags.some(f => f.indexOf('KT có SĐT khách này nhưng đơn chưa có mã bộ đếm') === 0), 'dong co canh bao "KT có SĐT... điền cột R"');
const noPh = run(rows2, POS2, [['', 'Kênh', 'Sale', 'Tổng', 'Mã bộ đếm'], ['', 'Q', 'a', 1, 'M44756']]);   // tab cu khong co cot SDT
ok(noPh.buildStoreCaseReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }).rows.find(r => r.row === 2).orders[0].acct.status === 'thieu-ma', 'file KT khong co cot SDT -> khong khop duoc, thieu-ma (khong loi)');
ok(c._storeAcctClassify_([], { codes: {}, noYear: {}, phones: { '0912468474': { sheet: 't', line: 9 } } }, false, '0912468474').status === 'co-sdt' && c._storeAcctClassify_([], { codes: {}, noYear: {}, phones: {} }, false, '0912468474').status === 'thieu-ma' && c._storeAcctClassify_([], { codes: {}, noYear: {} }, false, '0912468474').status === 'thieu-ma', 'classify: co-sdt / thieu-ma / acct cu khong co phones');
const loaded = c._loadAcctCodeSet_();
ok(loaded.phones['0912468474'] && loaded.phones['0912468474'].line === 2 && loaded.phones['0979687852'].line === 4 && Object.keys(loaded.phones).length === 2, 'doc cot SDT: 2 so khac nhau (so lap chi lay dong dau), chuan hoa them so 0 dau');
process.exit(bad ? 1 : 0);
