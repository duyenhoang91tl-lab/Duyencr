#!/usr/bin/env node
// Test giao dien Bao cao L: nhan "KT chua ghi", bang don thieu, xuat file doi chieu ke toan (ham THAT trong js/11-fn-srload.js).
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const line = p => { const i = src.indexOf(p); return src.slice(i, src.indexOf('};', i) + 2); };
const sheets = [], files = [], toasts = [];
const c = vm.createContext({ esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])), fmt: n => String(n || 0), _srMoney: n => (Math.round(n || 0)) + '₫',
  _srState: { dataL: null }, toast: m => toasts.push(m), XLSX: { utils: { book_new: () => ({ s: [] }), aoa_to_sheet: a => a, book_append_sheet: (wb, ws, nm) => sheets.push([nm, ws]) }, writeFile: (wb, n) => files.push(n) } });
vm.runInContext(line('var _SR_L_STATUS_') + '\n' + ['_srLAcctBadge_', '_srLAcctHtml_', '_srLExportAcct_', '_srLOrderHtml_'].map(fn).join('\n'), c);
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
process.exit(bad ? 1 : 0);
