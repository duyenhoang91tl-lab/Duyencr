#!/usr/bin/env node
// Test giao dien Bao cao L: nhan "KT chua ghi", bang don thieu, xuat file doi chieu ke toan (ham THAT trong js/11-fn-srload.js).
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const line = p => { const i = src.indexOf(p); return src.slice(i, src.indexOf('};', i) + 2); };
const sheets = [], files = [], toasts = [];
const c = vm.createContext({ esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])), fmt: n => String(n || 0), _srMoney: n => (Math.round(n || 0)) + '₫',
  _srState: { dataL: null }, toast: m => toasts.push(m), XLSX: { utils: { book_new: () => ({ s: [] }), aoa_to_sheet: a => a, book_append_sheet: (wb, ws, nm) => sheets.push([nm, ws]) }, writeFile: (wb, n) => files.push(n) } });
vm.runInContext(line('var _SR_L_STATUS_') + '\n' + ['_srLTienLbl_', '_srLAcctBadge_', '_srLAcctHtml_', '_srLLechSheet_', '_srLExportAcct_', '_srLOrderHtml_'].map(fn).join('\n'), c);
const miss = [
  { posRow: 5, ngay: '10/10/2026', phone: '0900000001', khachHang: 'A', sales: ['ninhnga99'], codes: ['M99999'], giaTri: 1000000, chiaSale: 300000, phanQuay: 700000, status: 'chua-ghi', loaiXuLy: 'tinh', storeRows: [3], nguonDon: 'Quầy Hào Nam' },
  { posRow: 6, ngay: '11/10/2026', phone: '0900000002', khachHang: 'B', sales: ['x'], codes: [], giaTri: 500000, chiaSale: 150000, phanQuay: 350000, status: 'thieu-ma', loaiXuLy: 'tinh', storeRows: [4], nguonDon: 'Fb' }];
const d = { sharePct: 30, dateFrom: '2026-10-01', dateTo: '2026-10-31', acctCheck: { ok: true, soMa: 12, tabs: ['t10'], sheetUrl: 'https://x', summary: { daGhi: 3, chuaGhi: 1, thieuMa: 1, chuaGhiChia: 300000 }, missing: miss } };
let h = c._srLAcctHtml_(d);
ok(/KT chưa ghi: 1 đơn/.test(h) && /M99999/.test(h) && /thiếu mã bộ đếm/.test(h) && /Xuất file đối chiếu kế toán/.test(h), 'panel: so don KT chua ghi + bang + nut xuat');
ok(/đã ghi 3/.test(h), 'panel: hien so da ghi');
h = c._srLAcctHtml_({ sharePct: 30, acctCheck: { ok: true, soMa: 5, tabs: [], summary: { daGhi: 2, chuaGhi: 0, thieuMa: 0 }, missing: [] } });
ok(/Mọi đơn có Sale được chia đều đã có/.test(h) && !/Xuất file/.test(h), 'khong thieu gi: bao du, khong nut xuat');
h = c._srLAcctHtml_({ acctCheck: { ok: false, error: 'Không đọc được file kế toán X' } });
ok(/Không đọc được file kế toán X/.test(h) && /KHÔNG có nghĩa/.test(h), 'file KT loi: bao ro, khong noi la da ghi du');
ok(c._srLAcctHtml_({}) === '', 'bao cao cu khong co acctCheck: khong hien gi');
const o = (st) => ({ status: 'tinh', giaTri: 1, codes: [], credits: [], acct: st ? { status: st, sheet: 't10', line: 3 } : null });
ok(/❌ KT chưa ghi/.test(c._srLOrderHtml_(o('chua-ghi'))) && /Thiếu mã bộ đếm/.test(c._srLOrderHtml_(o('thieu-ma'))) && /KT đã ghi/.test(c._srLOrderHtml_(o('da-ghi'))), 'nhan canh don: chua-ghi / thieu-ma / da-ghi');
ok(!/KT/.test(c._srLOrderHtml_(o(null))) && !/KT chưa ghi/.test(c._srLOrderHtml_(o('khong-ro'))), 'don khong doi chieu / khong ro: khong nhan');
c._srState.dataL = d; c._srLExportAcct_();
ok(files[0] === 'DoiChieuKeToan_2026-10-01_2026-10-31.xlsx' && sheets[0][0] === 'KT chưa ghi' && sheets[0][1].length === 2 && sheets[0][1][1][0] === 'M99999' && sheets[1][0] === 'Thiếu mã bộ đếm' && sheets[1][1].length === 2, 'xuat Excel: sheet KT chua ghi (theo ma bo dem) + sheet thieu ma');
c._srState.dataL = { acctCheck: { missing: [] } }; c._srLExportAcct_(); ok(toasts.length === 1 && files.length === 1, 'khong co don: bao, khong xuat file rong');
// ---- 2026-10-31: du phong khop theo SDT ("co-sdt") + dong theo ma chua ghep duoc don Pos ----
ok(/🔎 KT có SĐT \(chưa có mã\)/.test(c._srLOrderHtml_(o('co-sdt'))) && /tab t10, dòng 3/.test(c._srLOrderHtml_(o('co-sdt'))) && !/KT chưa ghi/.test(c._srLOrderHtml_(o('co-sdt'))), 'nhan canh don: co-sdt (xanh, kem tab + dong), KHONG nham la chua ghi');
h = c._srLAcctHtml_({ sharePct: 30, acctCheck: { ok: true, soMa: 5, tabs: ['t'], summary: { daGhi: 2, chuaGhi: 0, thieuMa: 0, coSdt: 4 }, missing: [] } });
ok(/có SĐT, chưa mã 4/.test(h) && /Mọi đơn có Sale được chia đều đã có/.test(h), 'panel: dem rieng "co SDT, chua ma" va khong tinh la thieu');
h = c._srLAcctHtml_({ sharePct: 30, acctCheck: { ok: true, soMa: 5, tabs: ['t'], summary: { daGhi: 0, chuaGhi: 1, thieuMa: 0, chuaGhiChia: 600000 }, missing: [{ posRow: null, ngay: '19-20', phone: '0900000009', tenKh: 'KH', sales: ['phuongthao2000'], codes: ['M70001'], giaTri: 2000000, chiaSale: 600000, phanQuay: 1400000, status: 'chua-ghi', loaiXuLy: 'chua-ghep-don', storeRows: [9, 10], nguonDon: 'Trang tính cửa hàng (chưa ghép đơn Pos)' }] } });
ok(/M70001/.test(h) && /phuongthao2000/.test(h) && /KT chưa ghi: 1 đơn/.test(h), 'dong theo ma chua ghep duoc don Pos (posRow null) van hien trong bang');
c._srState.dataL = { sharePct: 30, dateFrom: 'a', dateTo: 'b', acctCheck: { missing: [{ posRow: null, ngay: '19-20', phone: '0900000009', tenKh: 'KH', sales: ['phuongthao2000'], codes: ['M70001'], giaTri: 2000000, chiaSale: 600000, phanQuay: 1400000, status: 'chua-ghi', loaiXuLy: 'chua-ghep-don', storeRows: [9, 10], nguonDon: 'Trang tính cửa hàng (chưa ghép đơn Pos)' }] } };
sheets.length = 0; files.length = 0; c._srLExportAcct_();
ok(sheets[0][1][1][0] === 'M70001' && /Chưa ghép được đơn Pos/.test(sheets[0][1][1][11]) && sheets[0][1][1][6] === 2000000, 'Excel: dong theo ma co nhan "Chưa ghép được đơn Pos" va gia tri tu cot Doanh thu');
// ---- 2026-11-01: KHOP TIEN voi ke toan (KT ghi lech tien) ----
const tien = (st, extra) => Object.assign({ status: st, posTong: 4450000, ktTong: 4450000, saleDuKien: 1335000, ktSale: 690000, quayDuKien: 3115000, ktQuay: 3760000, lechTong: 0, lechSale: -645000, salesKT: ['ninhnga99'], saleKhac: [], lines: [6, 7] }, extra || {});
const oT = (st, tn) => ({ status: 'tinh', giaTri: 1, codes: [], credits: [], acct: { status: st, sheet: 'quầy t10', line: 6, tien: tn } });
const bd = c._srLOrderHtml_(oT('da-ghi', tien('lech-chia')));
ok(/KT đã ghi/.test(bd) && /💸 KT lệch tiền/.test(bd) && /Phần sale KT ≠ tỷ lệ chia/.test(bd), 'don da ghi nhung lech tien: co CA 2 nhan (da ghi + 💸 lech tien) va tooltip noi loai lech');
ok(!/💸/.test(c._srLOrderHtml_(oT('da-ghi', tien('khop')))) && !/💸/.test(c._srLOrderHtml_(oT('da-ghi', tien('khong-ro')))) && !/💸/.test(c._srLOrderHtml_(oT('da-ghi', null))), 'tien khop / khong ro / chua co du lieu tien: KHONG hien nhan lech');
ok(!/💸/.test(c._srLOrderHtml_(oT('chua-ghi', tien('lech-tong')))), 'don CHUA ghi khong co nhan lech tien');
ok(c._srLTienLbl_('thieu-dong-sale') === 'KT thiếu dòng sale (chỉ ghi dòng Quầy)' && c._srLTienLbl_('sai-sale') === 'Tên sale KT ≠ Sale báo cáo L' && c._srLTienLbl_('lech-tong') === 'Tổng KT ≠ giá trị đơn Pos', 'nhan 4 loai lech');
const L1 = { posRow: 402, ngay: '10/10/2026', phone: '0966321991', khachHang: 'B', tenKh: 'B', sales: ['ninhnga99'], codes: ['M44707'], giaTri: 4450000, status: 'da-ghi', sheet: 'quầy t10', storeRows: [3], tien: tien('lech-chia') };
const L2 = { posRow: 405, ngay: '10/10/2026', phone: '0962688485', khachHang: 'E', tenKh: 'E', sales: ['ninhnga99'], codes: ['M46906'], giaTri: 875000, status: 'da-ghi', sheet: 'quầy t10', storeRows: [6], tien: tien('thieu-dong-sale', { posTong: 875000, ktTong: 875000, saleDuKien: 262500, ktSale: 0, quayDuKien: 612500, ktQuay: 875000, lechSale: -262500, salesKT: [], lines: [12] }) };
const dT = { sharePct: 30, dateFrom: '2026-10-01', dateTo: '2026-10-31', acctCheck: { ok: true, soMa: 20, tabs: ['quầy t10', 'onl T10'], sheetUrl: 'https://x', summary: { daGhi: 9, chuaGhi: 0, thieuMa: 0, khopTien: 4, lechTien: 2, tienKhongRo: 3, lechSaleTong: -907500 }, missing: [], lech: [L1, L2] } };
h = c._srLAcctHtml_(dT);
ok(/💸 KT ghi lệch tiền: 2 đơn/.test(h) && /-907500₫/.test(h) && /✔ tiền khớp 4/.test(h), 'panel: chip "KT ghi lech tien: 2 don" + lech phan sale cong lai + so don tien khop');
ok(/Xuất file đối chiếu kế toán/.test(h) && /Mọi đơn có Sale được chia đều đã có trong file kế toán/.test(h), 'panel: chi co don lech tien (khong thieu ma) -> van co nut xuat, va van bao du ma o file KT');
ok(/Mã bộ đếm<\/th><th>Loại lệch/.test(h) && /M44707/.test(h) && /M46906/.test(h) && /KT thiếu dòng sale/.test(h) && /dòng 6, 7/.test(h) && /dòng 12/.test(h), 'bang lech tien: ma, loai lech, dong trong file KT de ke toan tim');
ok(h.indexOf('M44707') > -1 && h.indexOf('M44707') < h.indexOf('M46906'), 'sap theo muc lech phan sale GIAM DAN (-645.000 truoc -262.500)');
ok(/<td style="text-align:right;font-weight:700;color:#b91c1c">-645000₫<\/td>/.test(h), 'lech am (KT ghi thieu cho sale) to do');
h = c._srLAcctHtml_({ sharePct: 30, acctCheck: { ok: true, soMa: 5, tabs: [], summary: { daGhi: 2, chuaGhi: 0, thieuMa: 0, khopTien: 2, lechTien: 0 }, missing: [], lech: [] } });
ok(!/lệch tiền/.test(h) && !/Xuất file/.test(h) && /tiền khớp 2/.test(h), 'khong lech: khong co bang / chip lech, khong nut xuat; van thay "tien khop 2"');
// Excel: sheet thu 3
sheets.length = 0; files.length = 0; c._srState.dataL = dT; c._srLExportAcct_();
ok(files.length === 1 && sheets.length === 2 && sheets[0][0] === 'KT chưa ghi' && sheets[1][0] === 'KT ghi lệch tiền', 'xuat Excel (khong co don chua ghi / thieu ma): sheet "KT chưa ghi" (rong) + sheet "KT ghi lệch tiền"');
const sl = sheets[1][1];
ok(sl[0].join('|') === 'Mã bộ đếm|Loại lệch|Ngày đơn Pos|SĐT|Khách|Sale (báo cáo L)|Sale (KT ghi)|Giá trị đơn Pos|Tổng KT|Lệch tổng|Sale dự kiến (30%)|Sale KT ghi|Lệch sale|Quầy dự kiến|Quầy KT ghi|Tab KT|Dòng trong file KT|Dòng Pos|Dòng trang tính cửa hàng', 'sheet lech tien: tieu de cot');
ok(sl.length === 3 && sl[1][0] === 'M44707' && sl[2][0] === 'M46906', 'sap theo ma bo dem A-Z');
ok(sl[1][7] === 4450000 && sl[1][8] === 4450000 && sl[1][10] === 1335000 && sl[1][11] === 690000 && sl[1][12] === -645000 && sl[1][13] === 3115000 && sl[1][14] === 3760000 && sl[1][3] === '0966321991' && sl[1][16] === '6, 7', 'tien la SO (cong duoc), SDT giu so 0, dong trong file KT "6, 7"');
ok(sl[2][1] === 'KT thiếu dòng sale (chỉ ghi dòng Quầy)' && sl[2][6] === '' && sl[2][11] === 0, 'don thieu dong sale: Sale KT ghi trong, 0 dong');
// ket hop: co ca chua ghi + lech tien -> du 3 sheet
sheets.length = 0; files.length = 0; c._srState.dataL = { sharePct: 30, dateFrom: 'a', dateTo: 'b', acctCheck: { missing: miss, lech: [L1] } }; c._srLExportAcct_();
ok(sheets.map(x => x[0]).join('|') === 'KT chưa ghi|Thiếu mã bộ đếm|KT ghi lệch tiền', 'co du 3 loai -> 3 sheet theo thu tu: chua ghi, thieu ma, lech tien');
process.exit(bad ? 1 : 0);
