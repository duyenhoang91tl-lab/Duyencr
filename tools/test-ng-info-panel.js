#!/usr/bin/env node
// Duyen 2026-11-25: Bao cao B › "Check nguoc Base" hien dong thong tin "Don ma NG chua co tren Base (tinh theo The Pos)" — KHONG phai loi.
// Trich ham that tu js/11-fn-srload.js. Chay: node tools/test-ng-info-panel.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
const names = ['_srOrdNames_', '_srOrderShares_', '_srPureCalc_', '_srBcOrders_', '_srBcBaseSum_', '_srBcPosVal_', '_srBcQuayTxt_', '_srBcIsLech_', '_srBcCause_', '_srBcBuild_', '_srBcCheckRows_', '_srBaseCheckPanelHtml_'];
let code = "var _SR_BC_LIM_=100; var _srState={}; function _srBcEditCellHtml_(){ return ''; } function _custLinkHtml_(p, h){ return h; } var _SR_UNASSIGNED_='(chưa gán sale)'; function fmt(n){return (n||0).toLocaleString('vi-VN');} function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');} function _srMoney(n){return fmt(Math.round(n||0))+'đ';}\n";
for (const n of names) {
  const i = src.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('thiếu hàm ' + n);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) { code += src.slice(i, k + 1) + '\n'; break; } } }
}
const m = src.match(/var _SRBC_SHIP_FEES_[^\n]*\n/); if (m) code += m[0];
const C = new Function(code + 'return {_srBaseCheckPanelHtml_};')();
let fail = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fail++; };

// 1) Co don NG chua co Base -> hien dong thong tin, so dung, nhan "khong phai loi"
let h = C._srBaseCheckPanelHtml_({ orders: [], ghep: { khongKhopCount: 0, trungDonGocCount: 0, gocBiLoai: 0, ngChuaCapNhatCount: 4 }, ghepCheck: { count: 0 } });
ok(/Đơn mã NG chưa có trên Base \(tính theo Thẻ Pos\): <b>4<\/b>/.test(h), 'hien "Don ma NG chua co tren Base (tinh theo The Pos): 4"');
ok(/không phải lỗi/.test(h), 'chu thich ro day khong phai loi');
ok(/không khớp <b>0<\/b>/.test(h), 'don NG KHONG bi cong vao "khong khop" (van 0)');

// 2) Khong co don NG -> khong hien dong nay (khong gay roi)
h = C._srBaseCheckPanelHtml_({ orders: [], ghep: { khongKhopCount: 2, trungDonGocCount: 0, gocBiLoai: 0 }, ghepCheck: { count: 0 } });
ok(!/mã NG chưa có trên Base/.test(h), 'khong co don NG -> an dong thong tin');
ok(/không khớp <b>2<\/b>/.test(h), 'khongKhop that van hien dung (2)');

// 3) File nguon da khai bao ngChuaCapNhatCount + dong Excel tong hop
ok(/mã NG \(kênh nguồn\) chưa có trên Base → tính theo Thẻ Pos/.test(src), 'sheet tong hop Excel co dong "ma NG chua co tren Base"');
ok(((fs.readFileSync(__dirname + '/../index.html', 'utf8').match(/js\/11-fn-srload\.js\?v=([0-9a-z]+)/) || [])[1] || '') >= '20261125a', 'index.html da bump ?v= (tu 20261125a tro len) cho js/11');

console.log(fail ? ('\n' + fail + ' LỖI') : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);
