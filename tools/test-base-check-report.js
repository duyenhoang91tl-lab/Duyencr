// Test "Báo cáo check ngược Base" (Báo cáo B, js/11-fn-srload.js): trích hàm thật, chạy ví dụ có ghép Base nhiều đơn gốc / đơn gốc bị loại / quầy 30/70.
// Chạy: node tools/test-base-check-report.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
const names = ['_srOrdNames_', '_srOrderShares_', '_srPureCalc_', '_srBcOrders_', '_srBcBaseSum_', '_srBcPosVal_', '_srBcQuayTxt_', '_srBcBuild_', '_srBcCheckRows_', '_srBaseCheckPanelHtml_'];
let code = "var _SR_UNASSIGNED_='(chưa gán sale)'; function fmt(n){return (n||0).toLocaleString('vi-VN');} function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');} function _srMoney(n){return fmt(Math.round(n||0))+'đ';}\n";
// _custLinkHtml_ (js/29-sidenav.js, 'bam SDT mo ho so khach'): lay ham THAT de bang check render dung
const _sn = fs.readFileSync(__dirname + '/../js/29-sidenav.js', 'utf8'); { const i = _sn.indexOf('function _custLinkHtml_('); let d = 0, j = _sn.indexOf('{', i); for (let k = j; k < _sn.length; k++) { if (_sn[k] === '{') d++; else if (_sn[k] === '}' && --d === 0) { code += _sn.slice(i, k + 1) + '\n'; break; } } }
for (const n of names) {
  const i = src.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('thiếu hàm ' + n);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) { code += src.slice(i, k + 1) + '\n'; break; } } }
}
const C = new Function(code + 'return {_srBcBuild_,_srBcOrders_,_srBcCheckRows_,_srBaseCheckPanelHtml_,_srPureCalc_};')();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const B = (dong, ma, nt, sale, tt, gt, tinh) => ({ dong, ma, ngay: '2026-10-05', nguoiTao: nt, saleBan: sale, trangThai: tt, giaTri: gt, tinh });
const O = [
  // đơn 1: 2 đơn gốc Base (1.000.000 sale A + 2.000.000 sale A,B) -> tổng 3.000.000; Pos ghi 2.500.000 (lệch -500.000)
  { posRow: 11, ngayTaoDon: '05/10/2026', khachHang: 'K1', soDienThoai: '0900000001', nguonDon: 'Page', theSale: 'A', giaTriPos: 2500000, giaTriSauGiam: 3000000, cod: 0, ghiChu: '1T10/2026 + 2T10/2026', ghepCodes: ['1T10/2026', '2T10/2026'],
    ghepBase: [B(5, '1T10/2026', 'cr1', 'A', 'Hoàn thành', 1000000, true), B(6, '2T10/2026', 'cr1', 'A, B', 'Hoàn thành', 2000000, true)],
    saleShares: [{ name: 'A', frac: 2 / 3 }, { name: 'B', frac: 1 / 3 }], dieuChinh: 'base' },
  // đơn 2: 1 đơn gốc sống + 1 đơn gốc bị loại; quầy 30%
  { posRow: 12, ngayTaoDon: '06/10/2026', khachHang: 'K2', soDienThoai: '0900000002', nguonDon: 'Quầy Hào Nam', theSale: 'C', giaTriPos: 1000000, giaTriSauGiam: 1000000, cod: 0, ghiChu: '3T10/2026 + 4T10/2026', ghepCodes: ['3T10/2026', '4T10/2026'],
    ghepBase: [B(7, '3T10/2026', 'cr2', 'C', 'Hoàn thành', 1000000, true), B(8, '4T10/2026', 'cr2', 'C', 'Thất bại', 400000, false)],
    saleShares: [{ name: 'C', frac: 1 }], saleRatio: 0.3, dieuChinh: 'base' },
  // đơn 3: thường, KHÔNG ghép -> không có trong báo cáo
  { posRow: 13, ngayTaoDon: '07/10/2026', khachHang: 'K3', soDienThoai: '0900000003', theSale: 'D', saleThe: 'D', giaTriSauGiam: 700000, cod: 0 }
];
const orders = C._srBcOrders_({ orders: O });
ok(orders.length === 2, 'Chỉ lấy đơn Pos đã ghép Base (bỏ đơn thường): 2 đơn');
const r = C._srBcBuild_(orders);
ok(r.tot.don === 2 && r.tot.pos === 3500000 && r.tot.base === 4000000 && r.tot.lech === 1, 'Tổng: 2 đơn, Pos 3.500.000, Base (chỉ đơn còn tính) 4.000.000, 1 đơn lệch giá');
ok(r.detail.length === 1 + 4, 'Chi tiết: 4 dòng (đơn1 × 2 đơn gốc + đơn2 × 2 đơn gốc, kể cả đơn gốc bị loại)');
const sumCol = (rows, c) => rows.slice(1).reduce((s, x) => s + (Number(x[c]) || 0), 0);
ok(sumCol(r.detail, 7) === 3500000 && sumCol(r.detail, 18) === 4000000, 'Giá Pos / Tổng Base chỉ ghi dòng đầu mỗi đơn → SUM cột không bị lặp');
ok(sumCol(r.detail, 19) === 500000, 'Chênh Base − Pos = (3.000.000 − 2.500.000) + (1.000.000 − 1.000.000) = 500.000');
ok(r.detail[4][17] === 'Không (đơn Base bị loại)' && r.detail[4][16] === 400000, 'Đơn gốc Thất bại vẫn liệt kê, đánh dấu không tính');
const sale = n => r.chia.slice(1).filter(x => x[5] === n).reduce((s, x) => s + x[7], 0);
ok(sale('A') === 2000000 && sale('B') === 1000000, 'Chia: A 2.000.000, B 1.000.000 (đơn 3.000.000 chia 2/3 – 1/3)');
ok(sale('C') === 300000, 'Quầy 30/70: C nhận 30% của 1.000.000 = 300.000');
ok(r.chia.some(x => x[8] === 'Quầy 30%'), 'Ghi chú "Quầy 30%" trong sheet chia');
const chk = C._srBcCheckRows_({ ghep: { khongKhop: [{ ngay: 'n', sdt: 's', maCoDon: ['X'], maKhongTim: ['X'], ghiChu: 'g' }], gocBiLoaiList: [{ ngay: 'n', sdt: 's', khach: 'K', theSale: 'T', giaPos: 5, ma: ['Y'], ghiChu: 'g' }], trungDonGoc: [] }, ghepCheck: { list: [] } });
ok(chk.length === 3 && /KHÔNG khớp/.test(chk[1][0]) && /BỊ BỎ/.test(chk[2][0]), 'Sheet cần kiểm tra tay: có nhóm không khớp + đơn Pos bị bỏ vì gốc Thất bại');
ok(C._srBcCheckRows_({}).length === 2, 'Không có mục nào → 1 dòng thông báo');
const html = C._srBaseCheckPanelHtml_({ orders: O, ghep: { khongKhopCount: 1, trungDonGocCount: 0, gocBiLoai: 2 }, ghepCheck: { count: 3 } });
ok(/check ngược Base/.test(html) && /K1/.test(html) && /K2/.test(html) && !/K3/.test(html), 'Panel hiện đơn ghép (K1, K2), không hiện đơn thường (K3)');
ok(/bị loại: Thất bại/.test(html), 'Panel ghi rõ đơn gốc bị loại');
ok(C._srBaseCheckPanelHtml_({ orders: [{ posRow: 1, giaTriSauGiam: 1 }], ghep: {}, ghepCheck: {} }).indexOf('không có đơn Pos nào ghép') > 0, 'Không có đơn ghép → báo rõ, không lỗi');
ok(C._srBaseCheckPanelHtml_(null) === '' && C._srBaseCheckPanelHtml_({}) === '', 'Chưa có dữ liệu → trả rỗng, không lỗi');
console.log(fail ? ('\n' + fail + ' LỖI') : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);
