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
process.exit(bad ? 1 : 0);
