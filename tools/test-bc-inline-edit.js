// Test sửa tay tiền từng sale NGAY trong bảng "check ngược Base" (js/11-fn-srload.js): Admin nhập tiền 1 sale → sale còn lại tự bù; lưu vào acctSplitExtra.
// Chạy: node tools/test-bc-inline-edit.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
const s50 = fs.readFileSync(__dirname + '/../js/50-split-orders.js', 'utf8');
function grab(text, n) {
  const i = text.indexOf((text.indexOf('async function ' + n + '(') >= 0 ? 'async function ' : 'function ') + n + '(');
  if (i < 0) throw new Error('thiếu hàm ' + n);
  let depth = 0, j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) { if (text[k] === '{') depth++; else if (text[k] === '}') { depth--; if (!depth) return text.slice(i, k + 1) + '\n'; } }
}
let code = "var _SR_UNASSIGNED_='(chưa gán sale)'; var _SR_BC_LIM_=100; var _isAdmin=true; function _srIsAdmin_(){return _isAdmin;} var toasts=[]; function toast(m){toasts.push(m);} var confirmMsg=''; function confirm(m){confirmMsg=m;return true;}\n" +
  "function _custLinkHtml_(p, h){ return h; } function fmt(n){return (n||0).toLocaleString('vi-VN');} function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');} function _srMoney(n){return fmt(Math.round(n||0))+'đ';}\n" +
  "var _srState={}; var store=[]; var loads=0; function _srLoad(){loads++;} var document={getElementById:function(id){return null;}};\n" +
  "async function _splitFixGetExtra_(){ return JSON.parse(JSON.stringify(store)); } async function _splitFixPutExtra_(a){ store=JSON.parse(JSON.stringify(a)); }\n";
for (const n of ['_srOrdNames_', '_srOrderShares_', '_srBcOrders_', '_srBcBuild_', '_srBcBaseSum_', '_srBcPosVal_', '_srBcQuayTxt_', '_srBcEditable_', '_srBcRebalance_', '_srBcEditState_', '_srBcSumHtml_', '_srBcEdit_', '_srBcReset_', '_srBcEditCellHtml_', '_srBcSave_', '_srBaseCheckPanelHtml_']) code += grab(src, n);
for (const n of ['splitFixCodeNy_', 'splitFixRemoveCode_', 'splitFixMergeExtra_']) code += grab(s50, n);
const C = new Function(code + 'return {_srBcRebalance_,_srBcEditable_,_srBcEdit_,_srBcSave_,_srBaseCheckPanelHtml_,_srState,setAdmin:function(v){_isAdmin=v;},store:function(){return store;},toasts:function(){return toasts;},loads:function(){return loads;},confirmMsg:function(){return confirmMsg;}};')();
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const B = (ma, sale, gt) => ({ dong: 1, ma, ngay: '2026-10-05', nguoiTao: 'cr', saleBan: sale, trangThai: 'Hoàn thành', giaTri: gt, tinh: true });
const mk = (code, khach, pos, base, shares, extra) => Object.assign({ posRow: 1, ngayTaoDon: '05/10/2026', khachHang: khach, soDienThoai: '0900000001', theSale: 'A, B', giaTriPos: pos, giaTriSauGiam: pos, cod: 0, ghiChu: code, ghepCodes: [code], ghepBase: [B(code, 'A, B', base)], saleShares: shares }, extra || {});

// 1) Rebalance — ví dụ Duyên: 5tr, sale A 3tr → sale B 2tr
let a = C._srBcRebalance_([2500000, 2500000], 5000000, 0, 3000000);
ok(a[0] === 3000000 && a[1] === 2000000, 'Ví dụ 5tr: A=3.000.000 → B tự = 2.000.000');
a = C._srBcRebalance_([2500000, 2500000], 5000000, 1, 4200000);
ok(a[0] === 800000 && a[1] === 4200000, 'Sửa sale B (cuối) = 4.200.000 → A tự = 800.000');
a = C._srBcRebalance_([2500000, 2500000], 5000000, 0, 9000000);
ok(a[0] === 5000000 && a[1] === 0, 'Nhập vượt tổng → kẹp ở 5.000.000, sale còn lại 0');
a = C._srBcRebalance_([2000000, 2000000, 1000000], 5000000, 0, 3000000);
ok(a.reduce((x, y) => x + y, 0) === 5000000 && a[0] === 3000000 && a[1] === 1333333 && a[2] === 666667, '3 sale: phần còn 2tr chia theo tỷ lệ 2:1 (1.333.333 + 666.667), tổng vẫn 5.000.000');
a = C._srBcRebalance_([0, 0, 0], 3000000, 0, 600000);
ok(a.reduce((x, y) => x + y, 0) === 3000000 && a[1] === 1200000 && a[2] === 1200000, 'Các sale khác đang 0 → chia đều phần còn lại');

// 2) Điều kiện hiện ô sửa
const o2 = mk('17T10/2026', 'K1', 5000000, 4000000, [{ name: 'A', frac: 0.5 }, { name: 'B', frac: 0.5 }]);
let e = C._srBcEditable_(o2);
ok(e && e.code === '17T10/2026' && e.total === 5000000 && e.names.join() === 'A,B', 'Đơn 2 sale, lệch → sửa được (tổng 5.000.000)');
ok(!C._srBcEditable_(mk('18T10/2026', 'K', 5000000, 4000000, [{ name: 'A', frac: 1 }])), 'Đơn 1 sale → không có ô sửa');
ok(!C._srBcEditable_(mk('19T10/2026', 'K', 5000000, 4000000, [{ name: 'A', frac: 0.5 }, { name: 'B', frac: 0.5 }], { saleRatio: 0.3 })), 'Đơn quầy 30/70 → không sửa ở đây');
C.setAdmin(false);
ok(!C._srBcEditable_(o2), 'Không phải Admin → không có ô sửa');
let html = C._srBaseCheckPanelHtml_({ orders: [o2], ghep: {}, ghepCheck: { count: 0 } });
ok(!/sr-bc-in-/.test(html), 'Panel với user thường: không có ô nhập');
C.setAdmin(true);
html = C._srBaseCheckPanelHtml_({ orders: [o2], ghep: {}, ghepCheck: { count: 0 } });
ok(/sr-bc-in-0-0/.test(html) && /sr-bc-in-0-1/.test(html) && /Lưu chia tay/.test(html) && /2\.500\.000/.test(html), 'Panel Admin: 2 ô nhập (A, B) điền sẵn 2.500.000');

// 3) Nhập + Lưu: sale A 3tr → B 2tr → acctSplitExtra có 2 dòng
(async () => {
  C._srBcEdit_(0, 0, '3.000.000');
  await C._srBcSave_(0);
  const st = C.store();
  ok(st.length === 2 && st[0].code === '17T10/2026' && st[0].sales[0] === 'A' && st[0].tong === 3000000 && st[1].sales[0] === 'B' && st[1].tong === 2000000, 'Lưu: A=3.000.000, B=2.000.000 vào acctSplitExtra');
  ok(C.loads() === 1 && /5\.000\.000/.test(C.confirmMsg()), 'Lưu xong tính lại báo cáo; hỏi xác nhận có ghi tổng');
  // lưu lần 2 cùng mã thay SẠCH dòng cũ, không đụng mã khác
  C._srState.bcView = [o2];
  C._srBaseCheckPanelHtml_({ orders: [o2], ghep: {}, ghepCheck: { count: 0 } });
  C._srBcEdit_(0, 1, '1000000');
  await C._srBcSave_(0);
  const st2 = C.store();
  ok(st2.length === 2 && st2.find(x => x.sales[0] === 'A').tong === 4000000 && st2.find(x => x.sales[0] === 'B').tong === 1000000, 'Lưu lại cùng mã: thay sạch dòng cũ (A=4tr, B=1tr), không nhân đôi');
  // sale = 0 → bỏ dòng sale đó
  C._srBcEdit_(0, 0, '5000000');
  await C._srBcSave_(0);
  ok(C.store().length === 1 && C.store()[0].sales[0] === 'A' && C.store()[0].tong === 5000000, 'Sale về 0 → chỉ còn 1 dòng (A=5.000.000)');
  console.log(fail ? '\n' + fail + ' FAIL' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);
})();
