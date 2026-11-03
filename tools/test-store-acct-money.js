// Test Bao cao L — KHOP TIEN voi file ke toan (Duyen yeu cau 2026-11-01). Mo phong CAU TRUC THAT cua file "THEO DOI DON CHIA SALE":
// tab "quay t10" (tieu de cach vai dong, o ma bo dem GOP theo cap dong Quay + Sale, ma lap 2 dong, don chi co dong Quay, 1 dong nhieu sale) + tab "onl T10" (khong co dong Quay).
// Chay HAM THAT trong gas_v13.js voi du lieu GIA (khong co du lieu ca nhan that).
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function line(prefix) { const i = src.indexOf(prefix); return src.slice(i, src.indexOf('\n', i)); }
const FNS = ['_stripVN_', '_normCounterCode_', '_counterCodeNoYear_', '_counterCodeHasYear_', '_extractCounterCodes_', '_storeCodeTokens_', '_storeCaseMergeContinuation_', '_normMoney_', '_storeCodesFromNote_', '_loadAcctCodeSet_', '_storeAcctClassify_', '_storeAcctMoney_', '_storeCaseYmdAdd_', '_storeCaseDayList_', '_storeCaseDaysToYmd_', '_storeCaseVisitDates_', '_storeCaseArrivalDates_', 'buildStoreCaseReport_'];
const code = [line("var COUNTER_CODE_INNER_ ="), line("var COUNTER_CODE_RE_SRC_ ="), line("var STORE_M_CODE_RE_ ="), line("var ACCT_SPLIT_SS_ID_ ="), ...FNS.map(fn)].join('\n');
const H = ['STT', 'Kênh bán', 'Sale bán', 'Giá trị cọc đơn hàng (số tiền...', 'Tổng giá trị đơn hàng (ko shi...', 'SDT', 'Mã bộ đếm', 'TP Kinh Doanh', 'Cửa hàng phản hồi', 'Kế toán chốt'];
const Q = 'Quầy Hào Nam', row = (stt, kenh, sale, tong, sdt, ma) => [stt, kenh, sale, '', tong, sdt, ma, '', '', ''];
const QUAY = [['', '', '', '', '', '', '', '', '', ''], ['', '', '', '', 205201000, '', '', '', '', ''], H,           // tieu de nam o dong 3 (tren do la dong tong)
  row(2, Q, 'Kim Thuy', 21700000, '979687852', 'M44756'), row(3, 'Fb Phạm Thu Hiền', 'ninhnga99', 9300000, '979687852', ''),            // [4-5]  GOP: khop 30%
  row(4, Q, 'Lê Trà My', 3760000, '966321991', 'M44707'), row(5, 'Hiền Phạm Tourmaline', 'ninhnga99', 690000, '966321991', ''),        // [6-7]  GOP: phan sale 15,5% (lech chia)
  row(6, Q, 'Nguyễn Thuỳ Trang', 2065000, '945462365', 'M44773'), row(7, 'Fb Phạm Thu Hiền', 'huyenmaii1990', 885000, '945462365', ''),  // [8-9]  GOP: khop
  row(10, 'Page HT3', 'phuongthao2000', 4380000, '984386507', 'M45330'), row(11, Q, 'Nguyễn Thuỳ Trang', 10220000, '984386507', ''),      // [10-11] GOP, dong SALE dung truoc: khop
  row(42, Q, 'Nguyễn Thuỳ Trang', 875000, '962688485', 'M46906'),                                                                        // [12]   CHI co dong Quay
  row(43, 'Hiền Phạm Tourmaline', 'TrangNH2005', 1335000, '352849198', 'M45335'), row(44, Q, 'Nguyễn Thuỳ Trang', 3115000, '352849198', 'M45335'),   // [13-14] ma LAP o ca 2 dong: tong KT 4.450.000
  row('', Q, 'Tú Anh', 6300000, '332728258', 'M47179'), row('', 'Zalo / zalo CSKH up (1536015976)', 'trangbeCSKH1995, linhNM1995', 2700000, '332728258', ''),   // [15-16] GOP, 1 dong nhieu sale: khop
  row(20, 'HienPham tourmaline', 'TrangNH2005', 7147500, '986820840', 'M45310'), row(21, Q, 'Lê Trà My', 16677500, '986820840', '')];        // [17-18] GOP: tien dung nhung SAI NGUOI
const MERGES_QUAY = [[4, 2], [6, 2], [8, 2], [10, 2], [15, 2], [17, 2]];   // [dong 1-based cua o tren cung, so dong]
const ONL = [['STT', 'Ngày đặt lịch', 'Ngày khách mua', 'Kênh bán', 'Sale bán', 'Giá trị cọc đơn hàng', 'Tổng giá trị đơn hàng', 'SDT', 'Mã bộ đếm', ''],
  ['', '', '', 'Fb Phạm Thu Hiền', 'ninhnga99, huyenmaii1990', '', 6700000, '', '17T10/2026', 'dthu 1.5'], ['', '', '', 'Fb Phạm Thu Hiền', 'ninhnga99', '', 10708000, '', '', '']];
const MERGES_ONL = [[2, 2]];
const pad = n => String(n).padStart(2, '0'), FIXED = new Date(2026, 9, 31);
class FDate extends Date { constructor(...a) { if (a.length === 0) super(FIXED.getTime()); else super(...a); } }
const R = (o) => Object.assign({ stt: '', thang: '10', ngayHen: '10', kenh: '', saleRaw: '', tenKh: '', phone: '', thongTin: '', spOrder: '', capNhat: '', tinhTrang: '', ngayDen: '', spMua: '', doanhThuSheet: '', nvCh: '', maDon: '' }, o);
const pos = (posRow, phone, giaTri) => ({ posRow, soDienThoai: phone, ngayTaoDon: '10/10/2026', nguonDon: 'Quầy Hào Nam', khachHang: 'K' + posRow, sanPham: 'SP', trangThai: 'Thành công', theSale: '', ghiChu: '', giaTriSauGiam: giaTri });
function sheetOf(vals, merges) { return { getName: () => 'x', getDataRange: () => ({ getValues: () => vals }), getRange: () => ({ getMergedRanges: () => merges.map(m => ({ getRow: () => m[0], getNumRows: () => m[1] })) }) }; }
function run(rows, posRows, opt) {
  opt = opt || {};
  const tabs = [Object.assign(sheetOf(QUAY, opt.noMerge ? [] : MERGES_QUAY), { getName: () => 'quầy t10' }), Object.assign(sheetOf(ONL, opt.noMerge ? [] : MERGES_ONL), { getName: () => 'onl T10' })];
  if (opt.noRangeApi) tabs.forEach(t => { t.getRange = () => { throw new Error('khong co getMergedRanges'); }; });
  const ctx = { Date: FDate, Math, JSON, String, Number, Object, Array, RegExp, parseInt, parseFloat, isNaN, Error,
    _vnYmd_: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    parseVNDate_: s => { const m = /^(\d+)\/(\d+)\/(\d+)/.exec(s || ''); return m ? new FDate(+m[3], +m[2] - 1, +m[1]) : null; },
    _dateStrToVnYmd_: s => String(s || ''), normPhone_: p => { const d = String(p || '').replace(/\D/g, ''); return d ? (d[0] === '0' ? d : '0' + d) : ''; },
    _storeCaseShare_: () => 0.3, _storeCaseReadSheet_: () => ({ sheetId: 'S', sheetName: 'T', maDonCol: 'R', rows: rows.map(r => Object.assign({}, r)) }),
    readDonChiTiet_: () => posRows.map(r => Object.assign({}, r)), _donSaleNamesFromThe_: t => String(t || '').split(',').map(x => x.trim()).filter(Boolean),
    _donHasExcludedStatus_: s => /hoàn/i.test(s || ''), _quaySaleRatio_: () => 0.3, _foldSaleKey_: s => String(s || '').toLowerCase().replace(/\s+/g, ''),
    _storeCaseBuildCtx_: () => ({ resolve: raw => ({ raw, name: String(raw).trim(), how: 'x' }), same: (a, b) => String(a).toLowerCase().replace(/\s+/g, '') === String(b).toLowerCase().replace(/\s+/g, '') }),
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) }, SpreadsheetApp: { openById: () => ({ getSheets: () => tabs }) } };
  vm.createContext(ctx); vm.runInContext(code, ctx); return ctx;
}
// ---- doc file KT: tien tung dong, o gop ----
let c = run([], []);
let a = c._loadAcctCodeSet_();
const g = k => a.codes[k];
ok(a.err === '' && a.tabs.join('|') === 'quầy t10|onl T10', 'doc ca 2 tab (tieu de "quay t10" nam o dong 3, dong tong o tren bi bo qua)');
ok(g('M44756').rows.length === 2 && g('M44756').rows[0].tong === 21700000 && g('M44756').rows[1].tong === 9300000 && g('M44756').rows[1].line === 5 && /Fb/.test(g('M44756').rows[1].kenh), 'O MA GOP: dong con (o trong khi doc) duoc dien ma -> du 2 dong cua cap voi tien + kenh + so dong');
ok(g('M45330').rows.length === 2 && g('M45330').rows[0].tong === 4380000, 'cap co dong SALE dung truoc dong Quay van du 2 dong');
ok(g('M45335').rows.length === 2 && g('M46906').rows.length === 1, 'ma lap o ca 2 dong -> 2 dong; don chi co 1 dong -> 1 dong');
ok(g('M47179').rows[1].sales === 'trangbeCSKH1995, linhNM1995', 'dong nhieu sale giu nguyen chuoi sale');
ok(g('17T10/2026').rows.length === 2 && g('17T10/2026').rows[1].tong === 10708000, 'tab online cung doc du 2 dong');
a = run([], [], { noMerge: true })._loadAcctCodeSet_();
ok(a.codes.M44756.rows.length === 2 && a.codes.M44756.rows[1].tong === 9300000 && a.codes.M44707.rows.length === 2, 'KHONG doc duoc thong tin o gop: du phong "dong trong ma ngay duoi dong co ma + cung SDT" van ra du cap');
a = run([], [], { noRangeApi: true })._loadAcctCodeSet_();
ok(a.err === '' && a.codes.M44756.rows.length === 2, 'getMergedRanges loi -> khong nem loi, dung du phong');
// ---- ham khop tien (thuan) ----
c = run([], []);
const same = (x, y) => String(x).toLowerCase() === String(y).toLowerCase();
const G = (rows) => [{ rows }];
const K = 100000;   // don vi thuc te (tien dong): 100 -> 10 trieu; tranh roi vao dung sai 1.000d
const q = (tong) => ({ line: 1, kenh: 'Quầy Hào Nam', sales: 'x', tong: tong * K }), s = (tong, sales) => ({ line: 2, kenh: 'Fb', sales: sales || 'a', tong: tong * K });
const mny = (grp, v, sales) => c._storeAcctMoney_(grp, v * K, 0.3, sales || ['a'], same);
ok(mny(G([q(70), s(30, 'a')]), 100).status === 'khop', 'khop: tong dung, sale 30%, dung nguoi');
ok(c._storeAcctMoney_(G([{ line: 1, kenh: Q, sales: 'x', tong: 700000 }, { line: 2, kenh: 'Fb', sales: 'a', tong: 300500 }]), 1000500, 0.3, ['a'], same).status === 'khop', 'dung sai: lech <= 1.000d van khop');
ok(mny(G([q(70), s(30, 'a')]), 0).status === 'lech-tong', 'Pos = 0 ma KT co tien -> lech tong');
ok(c._storeAcctMoney_(G([{ line: 1, kenh: Q, sales: 'x', tong: 70000000 }, { line: 2, kenh: 'Fb', sales: 'a', tong: 30000000 }]), 100150000, 0.3, ['a'], same).status === 'khop', 'dung sai theo % (0,2%): 100 trieu lech 150k van khop');
ok(c._storeAcctMoney_(G([{ line: 1, kenh: Q, sales: 'x', tong: 70000000 }, { line: 2, kenh: 'Fb', sales: 'a', tong: 30000000 }]), 100250000, 0.3, ['a'], same).status === 'lech-tong', '... lech 250k > 0,2% -> lech tong');
ok(mny(G([q(60), s(40, 'a')]), 100).status === 'lech-chia', 'tong dung nhung phan sale 40% (khong phai 30%) -> lech chia');
ok(mny(G([q(100)]), 100).status === 'thieu-dong-sale', 'chi co dong Quay -> thieu dong sale');
ok(mny(G([q(70), s(30, 'b')]), 100).status === 'sai-sale', 'ten sale KT khac Sale cua bao cao L -> sai sale');
ok(mny(G([q(70), s(30, 'a, b')]), 100, ['b']).status === 'khop', 'dong KT co nhieu sale, Sale L la 1 trong do -> khop');
ok(mny(G([s(30, 'a'), s(70, 'b')]), 100).status === 'khong-ro' && mny([], 100).status === 'khong-ro', 'khong co dong Quay (tab online) / khong co du lieu -> khong-ro (khong bao nham)');
ok(mny([{ rows: [q(70)] }, { rows: [s(30, 'a')] }], 100).status === 'khop', 'don co 2 ma (2 nhom dong) -> cong chung');
const m = mny(G([q(70), s(20, 'a')]), 100);
ok(m.lechSale === -10 * K && m.saleDuKien === 30 * K && m.ktSale === 20 * K && m.quayDuKien === 70 * K && m.ktQuay === 70 * K && m.lechTong === -10 * K, 'so lieu chi tiet: lech sale -10, du kien 30/70');
// ---- bao cao L dau-cuoi ----
const rows = [R({ row: 2, stt: '1', saleRaw: 'ninhnga99', phone: '979687852', tenKh: 'A', maDon: 'M44756' }), R({ row: 3, stt: '2', saleRaw: 'ninhnga99', phone: '966321991', tenKh: 'B', maDon: 'M44707' }),
  R({ row: 4, stt: '3', saleRaw: 'huyenmaii1990', phone: '945462365', tenKh: 'C', maDon: 'M44773' }), R({ row: 5, stt: '4', saleRaw: 'phuongthao2000', phone: '984386507', tenKh: 'D', maDon: 'M45330' }),
  R({ row: 6, stt: '5', saleRaw: 'ninhnga99', phone: '962688485', tenKh: 'E', maDon: 'M46906' }), R({ row: 7, stt: '6', saleRaw: 'TrangNH2005', phone: '352849198', tenKh: 'F', maDon: 'M45335' }),
  R({ row: 8, stt: '7', saleRaw: 'trangbeCSKH1995, linhNM1995', phone: '332728258', tenKh: 'G', maDon: 'M47179' }), R({ row: 9, stt: '8', saleRaw: 'ninhnga99', phone: '986820840', tenKh: 'H', maDon: 'M45310' }),
  R({ row: 10, stt: '9', saleRaw: 'ninhnga99', phone: '900000010', tenKh: 'I', maDon: '17T10/2026' })];
const POS = [pos(401, '0979687852', 31000000), pos(402, '0966321991', 4450000), pos(403, '0945462365', 2950000), pos(404, '0984386507', 14600000), pos(405, '0962688485', 875000),
  pos(406, '0352849198', 4500000), pos(407, '0332728258', 9000000), pos(408, '0986820840', 23825000), pos(409, '0900000010', 5000000)];
c = run(rows, POS);
const rep = c.buildStoreCaseReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }), ac = rep.acctCheck, S = ac.summary;
const tien = n => rep.rows.find(r => r.row === n).orders[0].acct.tien;
ok(rep.ok && ac.ok && S.daGhi === 9 && S.chuaGhi === 0, 'bao cao L: 9 don deu da co ma o file KT');
ok(tien(2).status === 'khop' && tien(2).ktTong === 31000000 && tien(2).ktSale === 9300000 && tien(2).saleDuKien === 9300000 && tien(2).quayDuKien === 21700000, 'M44756 (cap gop): khop 31 trieu, sale 9,3 trieu = 30%');
ok(tien(3).status === 'lech-chia' && tien(3).ktSale === 690000 && tien(3).saleDuKien === 1335000 && tien(3).lechSale === -645000 && tien(3).lechTong === 0, 'M44707: tong dung 4,45 trieu nhung KT ghi sale 690k (15,5%) thay vi 1.335k -> lech chia -645.000');
ok(tien(4).status === 'khop' && tien(5).status === 'khop', 'M44773 va M45330 (dong sale dung truoc): khop');
ok(tien(6).status === 'thieu-dong-sale' && tien(6).saleDuKien === 262500 && tien(6).ktSale === 0 && tien(6).lechSale === -262500, 'M46906: chi co dong Quay -> THIEU DONG SALE (du kien 262.500)');
ok(tien(7).status === 'lech-tong' && tien(7).ktTong === 4450000 && tien(7).posTong === 4500000 && tien(7).lechTong === -50000, 'M45335 (ma lap 2 dong): tong KT 4.450.000 lech Pos 4.500.000 -> lech tong -50.000');
ok(tien(8).status === 'khop' && tien(8).salesKT.join('|') === 'trangbeCSKH1995|linhNM1995', 'M47179: 1 dong nhieu sale, ca 2 sale co trong KT -> khop');
ok(tien(9).status === 'sai-sale' && tien(9).saleKhac.join() === 'ninhnga99' && tien(9).salesKT.join() === 'TrangNH2005' && tien(9).lechSale === 0, 'M45310: tien dung nhung KT ghi cho TrangNH2005, bao cao L la ninhnga99 -> SAI SALE');
ok(tien(10).status === 'khong-ro', '17T10/2026 (tab online, khong co dong Quay): khong-ro');
ok(S.khopTien === 4 && S.lechTien === 4 && S.tienKhongRo === 1 && S.lechSaleTong === -645000 - 262500 - 15000 + 0, 'tong hop: khop 4 / lech 4 / khong ro 1 / lech sale cong -922.500 — thuc te ' + JSON.stringify(S));
ok(ac.lech.length === 4 && ac.lech.map(x => x.tien.status).sort().join() === 'lech-chia,lech-tong,sai-sale,thieu-dong-sale', 'acctCheck.lech: 4 don lech, moi don kem chi tiet tien');
const e = ac.lech.find(x => x.posRow === 402);
ok(e.codes.join() === 'M44707' && e.sales.join() === 'ninhnga99' && e.phone === '0966321991' && e.giaTri === 4450000 && e.tien.lines.join() === '6,7', 'moi dong lech: ma, sale, SDT, gia tri, va SO DONG trong file KT de ke toan tim (6,7)');
ok(rep.rows.find(r => r.row === 3).flags.some(f => f.indexOf('KT ghi lệch tiền (lech-chia)') === 0) && !rep.rows.find(r => r.row === 2).flags.some(f => f.indexOf('lệch tiền') !== -1), 'dong lech co canh bao; dong khop thi khong');
ok(JSON.stringify(rep).indexOf('"groups"') === -1, 'khong ro ri doi tuong noi bo "groups" ra ket qua tra ve');
// don chua ghi / khong co ma khong bi tinh tien
const rep2 = run([R({ row: 2, stt: '1', saleRaw: 'ninhnga99', phone: '979687852', tenKh: 'A', maDon: 'M99999' })], [pos(401, '0979687852', 1000000)]).buildStoreCaseReport_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' }).acctCheck;
ok(rep2.summary.chuaGhi === 1 && rep2.summary.lechTien === 0 && rep2.lech.length === 0, 'don CHUA GHI khong bi tinh vao lech tien (khong co gi de so)');
process.exit(bad ? 1 : 0);
