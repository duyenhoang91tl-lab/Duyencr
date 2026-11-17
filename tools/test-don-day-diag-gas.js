// Test action chẩn đoán donDayDiag_ (gas_v13.js): đơn POS của 1 ngày + lọc theo sale trong thẻ, tái hiện ví dụ thật của Duyên (16/11/2026, biichnguyen1993).
// Chạy: node tools/test-don-day-diag-gas.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = n => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thiếu hàm ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const names = ['_vnMidnight_', '_vnYmd_', 'parseVNDate_', 'splitMulti_', '_normTxt_', '_isNumericTag_', '_donSaleNamesFromThe_', 'normPhone_', '_stripVN_', '_donHasExcludedStatus_', 'donDayDiag_'];
const vnLine = (src.match(/^var VN_OFFSET_MS\s*=.*$/m) || ['var VN_OFFSET_MS = 7 * 3600 * 1000;'])[0];
// Dữ liệu mô phỏng đúng ảnh POS của Duyên (SĐT thiếu số 0 đầu; thẻ chung nhiều sale; 1 đơn Hủy; 1 đơn ngày khác; 1 đơn sale khác)
const rows = [
  { ngayTaoDon: '16/11/2026', theSale: 'biichnguyen1993', khachHang: 'Lê phương thảo', soDienThoai: '326996443', giaTriSauGiam: 1000000, trangThai: '' },
  { ngayTaoDon: '16/11/2026', theSale: 'biichnguyen1993', khachHang: 'Phương Thùy', soDienThoai: 981081135, giaTriSauGiam: 2000000, trangThai: '' },
  { ngayTaoDon: '16/11/2026', theSale: 'biichnguyen1993, ninhnga99, thuydinh95', khachHang: 'Huynh Kim Nguyet', soDienThoai: '976881068', giaTriSauGiam: 3000000, trangThai: '' },
  { ngayTaoDon: '16/11/2026', theSale: 'ninhnga99, biichnguyen1993, thuydinh95', khachHang: 'Thanh Phương', soDienThoai: '972489847', giaTriSauGiam: 4000000, trangThai: '' },
  { ngayTaoDon: '16/11/2026', theSale: 'biichnguyen1993, huyenmaii1990, thuydinh95, ninhnga99', khachHang: 'Trần tươi', soDienThoai: '397070935', giaTriSauGiam: 5000000, trangThai: '' },
  { ngayTaoDon: '16/11/2026', theSale: 'Biichnguyen1993', khachHang: 'Lọ Lem (hoa thường)', soDienThoai: '974511679', giaTriSauGiam: 6000000, trangThai: '' },
  { ngayTaoDon: '16/11/2026', theSale: 'biichnguyen1993', khachHang: 'Bị hủy', soDienThoai: '912345678', giaTriSauGiam: 9000000, trangThai: 'Hủy đơn' },
  { ngayTaoDon: '16/11/2026', theSale: 'minhthu98', khachHang: 'Khách sale khác', soDienThoai: '933333333', giaTriSauGiam: 7000000, trangThai: '' },
  { ngayTaoDon: '15/11/2026', theSale: 'biichnguyen1993', khachHang: 'Ngày khác', soDienThoai: '944444444', giaTriSauGiam: 8000000, trangThai: '' },
  { ngayTaoDon: '16/11/2026 10:30', theSale: 'biichnguyen1993, ninhnga99', khachHang: 'Có giờ trong ngày', soDienThoai: '0905555555', giaTriSauGiam: 100000, trangThai: '' },
];
const ctx = { VN_OFFSET_MS: 7 * 3600 * 1000, _pancakeKnownSaleNameSet_: () => ({}), POS_EXTRA_SALE_NAMES_: [], _bizRules_: () => ({ posSet: { 'huy don': 1, 'hoan don': 1, 'da hoan': 1, 'dang hoan': 1 } }), readDonChiTiet_: () => rows, Date, JSON, Math, String, Object, Array, Number, RegExp, isNaN };
vm.createContext(ctx); vm.runInContext(names.map(fn).join('\n') + ';this.api = donDayDiag_;', ctx);
let ok = 0, fail = 0; const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
let r = ctx.api('2026-11-16', 'biichnguyen1993');
t('trả ok + đúng ngày/sale', r.ok && r.date === '2026-11-16' && r.sale === 'biichnguyen1993');
t('đếm đủ đơn của sale trong ngày (6 chia thẻ + 1 hủy + 1 có giờ = 8; KHÔNG tính sale khác / ngày khác)', r.orders === 8);
t('SĐT thiếu số 0 được chuẩn hoá (326996443 → 0326996443; số kiểu number 981081135 → 0981081135)', r.items.some(x => x.phone === '0326996443') && r.items.some(x => x.phone === '0981081135'));
t('thẻ chung nhiều sale vẫn tính cho CẢ sale (Huynh Kim Nguyet, Thanh Phương thứ tự đảo, Trần tươi có 4 sale)', ['0976881068', '0972489847', '0397070935'].every(p => r.items.some(x => x.phone === p)));
t('sale khác kiểu hoa/thường (Biichnguyen1993) vẫn khớp', r.items.some(x => x.phone === '0974511679'));
t('đơn có giờ "16/11/2026 10:30" vẫn khớp đúng ngày', r.items.some(x => x.phone === '0905555555'));
t('đơn Hủy: có trong danh sách nhưng đánh dấu excluded và KHÔNG cộng doanh thu', r.items.find(x => x.phone === '0912345678').excluded === true && r.revenue === 1000000 + 2000000 + 3000000 + 4000000 + 5000000 + 6000000 + 100000);
t('số SĐT duy nhất = 8', r.phones === 8);
t('không lẫn sale khác / ngày khác', !r.items.some(x => x.phone === '0933333333' || x.phone === '0944444444'));
t('tách đúng danh sách sale của thẻ', JSON.stringify(r.items.find(x => x.phone === '0397070935').sales) === JSON.stringify(['biichnguyen1993', 'huyenmaii1990', 'thuydinh95', 'ninhnga99']));
r = ctx.api('2026-11-16', '');
t('không truyền sale → mọi sale trong ngày (9 đơn: thêm minhthu98)', r.ok && r.orders === 9 && r.phones === 9);
t('date sai định dạng → báo lỗi, không ném', ctx.api('16/11/2026', '').ok === false && ctx.api('', 'x').ok === false);
t('ngày không có đơn → 0 đơn', ctx.api('2026-01-01', 'biichnguyen1993').orders === 0);
t('handler doGet có action donDayDiag gọi donDayDiag_', /action === 'donDayDiag'[\s\S]{0,300}donDayDiag_\(/.test(src));
console.log(`\n${ok} OK, ${fail} FAIL`); process.exit(fail ? 1 : 0);
