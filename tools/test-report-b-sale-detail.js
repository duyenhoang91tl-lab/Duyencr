#!/usr/bin/env node
// Test CHI TIET DOANH THU TUNG DON khi bam dong Sale o Bao cao B (js/59-report-drill.js). Khong can jsdom: dung vm + stub DOM toi thieu.
// 5 thong tin moi don: (1) ngay len don theo Base (2) san pham order (3) sale tham gia (+%) (4) doanh thu ca nhan (5) nguon.
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const j11 = R('js/11-fn-srload.js');
const grab = n => { const i = j11.indexOf('function ' + n + '('); let d = 0, k = j11.indexOf('{', i); for (let e = k; e < j11.length; e++) { if (j11[e] === '{') d++; else if (j11[e] === '}' && --d === 0) return j11.slice(i, e + 1); } };
const ctx = { console, document: { addEventListener() {}, getElementById() { return null; } }, window: {} };
ctx.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
ctx.fmt = n => String(Math.round(Number(n) || 0)); ctx._srMoney = n => String(Math.round(Number(n) || 0)) + 'đ';
vm.createContext(ctx);
vm.runInContext("var _srState = { dataA: null, dataB: null, bSale: [], byCreator: false }; var _SR_UNASSIGNED_='(chưa gán sale)'; function isNumTagSale_(x){ return /^\\d+$/.test(String(x).trim()); }\n" +
  ['_srOrdNames_', '_srOrderShares_', '_srAdjTypes_'].map(grab).join('\n'), ctx);
vm.runInContext(R('js/59-report-drill.js'), ctx, { filename: 'js/59-report-drill.js' });
const run = s => vm.runInContext(s, ctx);
const B = { orders: [
  // Don GHEP Base: 2 sale chia 60/40, ngay Base (05/11) khac ngay Pos (09/11)
  { ngayTaoDon: '09/11/2026', khachHang: 'Chi Lan', soDienThoai: '0900000001', nguonDon: 'Facebook', theSale: 'anh, men', trangThai: 'Hoàn thành', sanPham: 'Nhẫn A,Dây B', soLuong: '1,2',
    giaTriSauGiam: 1000000, cod: 600000, dieuChinh: 'base', saleShares: [{ name: 'anh', frac: 0.6 }, { name: 'men', frac: 0.4 }], bs: [['anh', 600000], ['men', 400000]],
    ghepBase: [{ ma: '10T11', ngay: '2026-11-05', tinh: true }, { ma: '11T11', ngay: '2026-11-06', tinh: true }, { ma: '12T11', ngay: '2026-11-01', tinh: false }], baseNgayTao: '2026-11-05' },
  // Don thuong khong ghep Base: chia deu 2 sale theo The, chua co ngay Base -> hien ngay Pos
  { ngayTaoDon: '10/11/2026', khachHang: 'Khach 2', soDienThoai: '0900000002', nguonDon: 'Zalo', theSale: 'anh, 8', trangThai: 'Hoàn thành', sanPham: 'Vòng', soLuong: '1',
    giaTriSauGiam: 500000, cod: 0, saleBanValid: 'anh', bs: [['anh', 500000]] },
] };
run('_srState.dataB = ' + JSON.stringify(B));
const r = run("_srDrillCompute_('bSale', 'anh')");
ok(r.ok && r.rows.length === 2, 'bSale: 2 don cua sale "anh"');
ok(run('_srDrillIsSaleDetail_')(r), 'nhan dien che do chi tiet Sale cua B');
const cols = run('_srDrillCols_')(r);
ok(cols.join('|') === 'Ngày lên đơn (Base)|Khách hàng|SĐT|Sản phẩm order|Sale tham gia|Doanh thu cá nhân|Nguồn|Cách tính', 'cot: du 5 thong tin yeu cau (+ Cach tinh)');
const c0 = run('_srDrillCells_')(r, r.rows.find(x => x.o.khachHang === 'Chi Lan'));
ok(c0[0] === '05/11/2026, 06/11/2026', '(1) ngay len don = ngay cac don Base DANG TINH (bo don bi loai 01/11, khong lay ngay Pos 09/11): ' + c0[0]);
ok(c0[3] === 'Nhẫn A × 1; Dây B × 2', '(2) san pham ghep so luong: ' + c0[3]);
ok(c0[4] === 'anh (60%), men (40%)', '(3) sale tham gia kem %: ' + c0[4]);
ok(c0[5] === 600000, '(4) doanh thu ca nhan cua "anh" = 600.000 (phan chia, khong phai ca don)');
ok(c0[6] === 'Facebook', '(5) nguon');
ok(c0[7] === 'Ghép Base', 'cach tinh = Ghep Base: ' + c0[7]);
const c1 = run('_srDrillCells_')(r, r.rows.find(x => x.o.khachHang === 'Khach 2'));
ok(c1[0] === '10/11/2026 (Pos)', 'don chua ghep Base: hien ngay Pos co danh dau (Pos): ' + c1[0]);
ok(c1[4] === 'anh (100%)' && c1[5] === 500000 && c1[7] === 'Chia đều theo Thẻ Pos', 'don 1 sale (tag so "8" bi bo): ' + c1[4] + ' / ' + c1[7]);
const tr = run('_srDrillRowHtml_')(r, r.rows.find(x => x.o.khachHang === 'Chi Lan'));
ok(/<b>600000đ<\/b>/.test(tr) && /05\/11\/2026, 06\/11\/2026/.test(tr) && !/09\/11\/2026/.test(tr), 'HTML dong: co doanh thu in dam + ngay Base');
// Cac o B khac KHONG bi anh huong (van bo cuc cu)
const rn = run("_srDrillCompute_('bNguon', 'Zalo')");
ok(run('_srDrillCols_')(rn)[0] === 'Ngày tạo' && run('_srDrillCols_')(rn).length >= 10, 'bNguon van dung cot cu');
process.exit(fails ? 1 : 0);
